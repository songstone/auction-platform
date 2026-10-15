package spike.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

/** Experimental PostgreSQL authority. All mutable lane decisions share a database row gate.
 * No Java mutex, local queue, outbox global-id cursor, or in-memory value is authoritative.
 * Authentication, product catalog, deployment and production fault detection are out of scope.
 */
public final class Engine {
    public record Command(String actor, String key, String kind, int lane, String auction,
                          Long amount, String reason, String stopId) {}
    public record Fixture(int lanes, int itemsPerLane, long startMs, long prepMs,
                          long initialMs, long followMs, long startPrice, long increment, long reserve) {}
    @FunctionalInterface public interface Hook { void hit(String point, Map<String,Object> context); }
    private final DataSource dataSource;
    private final ObjectMapper json = new ObjectMapper();
    private volatile Hook hook = (point, context) -> {};
    public Engine(DataSource dataSource) { this.dataSource = Objects.requireNonNull(dataSource); }
    public void setHook(Hook hook) { this.hook = hook == null ? (p,c) -> {} : hook; }

    @FunctionalInterface private interface Work<T> { T run(Connection c) throws Exception; }
    private <T> T tx(Work<T> work) {
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
            try { T value = work.run(c); c.commit(); return value; }
            catch (Exception | Error e) { try { c.rollback(); } catch (SQLException ignored) {} throw e; }
        } catch (RuntimeException | Error e) { throw e; }
        catch (Exception e) { throw new EngineException(e); }
    }
    /** Shared epoch lock permits independent lane writes. Only a detected PostgreSQL restart
     * requires the exclusive lock, and its hold commits before the original operation retries.
     * This detects postmaster restart, not network partitions or database promotion continuity.
     */
    private <T> T mutation(Work<T> work) {
        for (;;) {
            boolean changed;
            try (Connection c=dataSource.getConnection()) {
                c.setAutoCommit(false);
                c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
                try {
                    one(c,"SELECT pg_advisory_xact_lock_shared(71001002)");
                    changed=!sameServerEpoch(c);
                    if(changed)c.rollback();
                    else { T value=work.run(c);c.commit();return value; }
                } catch(Exception | Error e) { try { c.rollback(); } catch(SQLException ignored) {} throw e; }
            } catch(RuntimeException | Error e) { throw e; }
            catch(Exception e) { throw new EngineException(e); }
            if(changed)holdAfterDatabaseRestart();
        }
    }
    private boolean sameServerEpoch(Connection c) throws SQLException {
        Map<String,Object> row=one(c,"SELECT server_epoch=pg_postmaster_start_time() AS matches FROM spike_metadata WHERE name='authority'");
        if(row==null)throw new IllegalStateException("Missing authority epoch metadata");
        return bool(row,"matches");
    }
    private void holdAfterDatabaseRestart() {
        tx(c -> {
            one(c,"SELECT pg_advisory_xact_lock(71001002)");
            if(sameServerEpoch(c))return null;
            List<Map<String,Object>> lanes=query(c,"SELECT lane FROM spike_lane ORDER BY lane FOR UPDATE");
            long observed=clock(c);
            for(Map<String,Object> lane:lanes)hold(c,(int)number(lane,"lane"),"POSTGRES_RESTART",true,observed);
            exec(c,"UPDATE spike_metadata SET server_epoch=pg_postmaster_start_time() WHERE name='authority'");
            return null;
        });
    }
    private <T> T readSnapshot(Work<T> work) {
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            c.setReadOnly(true);
            try { T value=work.run(c); c.commit(); return value; }
            catch(Exception | Error e) { try { c.rollback(); } catch(SQLException ignored) {} throw e; }
        } catch(RuntimeException | Error e) { throw e; }
        catch(Exception e) { throw new EngineException(e); }
    }
    public static final class EngineException extends RuntimeException { public EngineException(Throwable e) { super(e); } }
    public void initializeSchema() {
        tx(c -> {
            one(c,"SELECT pg_advisory_xact_lock(71001001)");
            try (InputStream in = Engine.class.getResourceAsStream("/schema.sql")) {
                if (in == null) throw new IllegalStateException("schema.sql missing");
                String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                for (String statement : sql.split(";")) if (!statement.isBlank()) exec(c, statement);
            }
            return null;
        });
    }
    public long now() { return tx(this::clock); }
    private long clock(Connection c) throws SQLException {
        return number(one(c,"SELECT floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms"),"ms");
    }
    private long at(Connection c, Long fixtureMs) throws SQLException { return fixtureMs == null ? clock(c) : fixtureMs; }
    public Map<String,Object> reset(Fixture f) {
        if (f.lanes < 1 || f.lanes > 4 || f.itemsPerLane < 1 || f.prepMs < 0 || f.initialMs <= 0 || f.followMs <= 0)
            throw new IllegalArgumentException("Invalid isolated fixture");
        return mutation(c -> {
            exec(c,"LOCK TABLE spike_lane IN ACCESS EXCLUSIVE MODE");
            exec(c,"TRUNCATE spike_outbox,spike_bid,spike_request,spike_intent,spike_auction,spike_lane RESTART IDENTITY CASCADE");
            for (int lane = 1; lane <= f.lanes; lane++) {
                exec(c,"INSERT INTO spike_lane(lane,item_count,prep_ms,initial_ms,follow_ms) VALUES(?,?,?,?,?)",lane,f.itemsPerLane,f.prepMs,f.initialMs,f.followMs);
                for (int item=1; item<=f.itemsPerLane; item++) {
                    exec(c,"INSERT INTO spike_auction(auction,lane,ordinal,seller,stage,start_price,increment,reserve,open_ms,window_start_ms,deadline_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                        auctionId(lane,item),lane,item,"seller-"+lane+"-"+item,item==1?"PREPARING":"READY",f.startPrice,f.increment,f.reserve,
                        item==1?f.startMs+f.prepMs:null,item==1?f.startMs+f.prepMs:null,item==1?f.startMs+f.prepMs+f.initialMs:null);
                }
                emit(c,lane,f.startMs);
            }
            return map("status","RESET","lanes",f.lanes,"startMs",f.startMs);
        });
    }
    private static String auctionId(int lane,int item) { return "L"+lane+"-A"+item; }

    public Map<String,Object> registerIntent(String actor,String key,String auction,long amount) {
        requireIdentity(actor,key);
        try { return tx(c -> {
            Map<String,Object> original = one(c,"SELECT * FROM spike_intent WHERE actor=? AND request_key=?",actor,key);
            if (original != null) return intent(original, sameIntent(original,auction,amount)?"REGISTERED":"CONFLICT_CONTENT");
            exec(c,"INSERT INTO spike_intent(actor,request_key,auction,amount) VALUES(?,?,?,?)",actor,key,auction,amount);
            return intent(one(c,"SELECT * FROM spike_intent WHERE actor=? AND request_key=?",actor,key),"REGISTERED");
        }); } catch (EngineException e) {
            if (!hasSqlState(e,"23505")) throw e;
            return tx(c -> {
                Map<String,Object> original = one(c,"SELECT * FROM spike_intent WHERE actor=? AND request_key=?",actor,key);
                if (original != null) return intent(original,sameIntent(original,auction,amount)?"REGISTERED":"CONFLICT_CONTENT");
                Map<String,Object> pending = one(c,"SELECT * FROM spike_intent WHERE actor=? AND auction=? AND NOT acknowledged",actor,auction);
                return pending == null ? map("status","RETRY_REGISTRATION") : intent(pending,"CONFLICT_PENDING");
            });
        }
    }
    public Map<String,Object> currentIntent(String actor,String auction) {
        return tx(c -> { Map<String,Object> v=one(c,"SELECT * FROM spike_intent WHERE actor=? AND auction=? AND NOT acknowledged",actor,auction); return v==null?map("status","NONE"):intent(v,"REGISTERED"); });
    }
    public Map<String,Object> acknowledge(String actor,String key) {
        return tx(c -> {
            Map<String,Object> request=one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",actor,key);
            if (request==null || "PENDING".equals(request.get("outcome"))) return map("status","NOT_FINAL");
            int n=exec(c,"UPDATE spike_intent SET acknowledged=true WHERE actor=? AND request_key=?",actor,key);
            return map("status",n==1?"ACKNOWLEDGED":"NO_INTENT","actor",actor,"key",key);
        });
    }
    public Map<String,Object> submit(Command command,Long fixtureTimeMs) {
        requireIdentity(command.actor,command.key);
        if (!Set.of("BID","STOP","RESUME","CANCEL","SELLER_CANCEL").contains(command.kind)) throw new IllegalArgumentException("Unsupported command kind");
        if ("BID".equals(command.kind) && (command.amount==null || command.auction==null)) throw new IllegalArgumentException("Bid amount/auction required");
        if (("CANCEL".equals(command.kind)||"STOP".equals(command.kind)) && (command.reason==null || command.reason.isBlank())) throw new IllegalArgumentException("Reason required");
        Map<String,Object> result;
        try { result=mutation(c -> {
            Map<String,Object> lane=lock(c,command.lane);
            hook.hit("receipt_locked",context(command));
            Map<String,Object> old=one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",command.actor,command.key);
            if (old!=null) return sameCommand(old,command)?requestMap(old):map("outcome","CONFLICT","code","CONTENT_MISMATCH","original",requestMap(old));
            if ("BID".equals(command.kind)) {
                Map<String,Object> intent=one(c,"SELECT * FROM spike_intent WHERE actor=? AND request_key=?",command.actor,command.key);
                if (intent==null || !sameIntent(intent,command.auction,command.amount) || bool(intent,"acknowledged"))
                    return map("outcome","CONFLICT","code","INTENT_NOT_CONFIRMED");
                Map<String,Object> target=one(c,"SELECT lane FROM spike_auction WHERE auction=?",command.auction);
                if (target==null || number(target,"lane")!=command.lane) return map("outcome","CONFLICT","code","TARGET_LANE_MISMATCH");
            }
            long now=at(c,fixtureTimeMs), seq=number(lane,"next_seq")+1;
            exec(c,"UPDATE spike_lane SET next_seq=?,last_received_ms=? WHERE lane=?",seq,now,command.lane);
            exec(c,"INSERT INTO spike_request(actor,request_key,kind,lane,auction,amount,reason,stop_id,seq,received_ms) VALUES(?,?,?,?,?,?,?,?,?,?)",
                command.actor,command.key,command.kind,command.lane,command.auction,command.amount,command.reason,command.stopId,seq,now);
            if (lane.get("last_received_ms")!=null && now<number(lane,"last_received_ms"))
                hold(c,command.lane,"CLOCK_REGRESSION",false,now);
            Map<String,Object> saved=requestMap(one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",command.actor,command.key));
            hook.hit("before_receipt_commit",saved);
            return saved;
        }); } catch (EngineException e) {
            if (!hasSqlState(e,"23505")) throw e;
            result=tx(c -> { Map<String,Object> old=one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",command.actor,command.key); if(old==null)throw e; return sameCommand(old,command)?requestMap(old):map("outcome","CONFLICT","code","CONTENT_MISMATCH","original",requestMap(old)); });
        }
        hook.hit("after_receipt_commit",result);
        return result;
    }
    public Map<String,Object> processNext(int laneId,Long fixtureTimeMs) {
        Map<String,Object> result=mutation(c -> {
            Map<String,Object> lane=lock(c,laneId);
            if (!bool(lane,"history_complete")) return map("status","HELD_HISTORY_UNKNOWN","lane",laneId);
            Map<String,Object> req=one(c,"SELECT * FROM spike_request WHERE lane=? AND outcome='PENDING' ORDER BY seq LIMIT 1",laneId);
            if (req==null) return map("status","IDLE","lane",laneId);
            long now=at(c,fixtureTimeMs), received=number(req,"received_ms");
            if(now<received || (lane.get("last_received_ms")!=null && now<number(lane,"last_received_ms"))) {
                hold(c,laneId,"CLOCK_REGRESSION_DECISION",false,now);
                return map("status","HELD_HISTORY_UNKNOWN","lane",laneId);
            }
            boolean historicHold=bool(lane,"held") && lane.get("hold_cutoff_seq")!=null && number(req,"seq")<=number(lane,"hold_cutoff_seq") && received<=number(lane,"hold_since_ms");
            advance(c,laneId,received,now,historicHold);
            lane=one(c,"SELECT * FROM spike_lane WHERE lane=?",laneId);
            Map<String,Object> a=current(c,lane);
            String kind=str(req,"kind"), code;
            boolean accepted=false;
            switch (kind) {
                case "BID" -> {
                    code=bidRejection(lane,a,req,historicHold);
                    if(code==null) {
                        long amount=number(req,"amount"), deadline=Math.addExact(received,number(lane,"follow_ms"));
                        exec(c,"INSERT INTO spike_bid(auction,actor,request_key,lane,seq,amount,received_ms) VALUES(?,?,?,?,?,?,?)",req.get("auction"),req.get("actor"),req.get("request_key"),laneId,req.get("seq"),amount,received);
                        exec(c,"UPDATE spike_auction SET highest_amount=?,highest_bidder=?,stage='FOLLOWUP',deadline_ms=? WHERE auction=?",amount,req.get("actor"),deadline,a.get("auction"));
                        accepted=true; code="BID_ACCEPTED";
                        if (now>=deadline && !bool(lane,"held")) hold(c,laneId,"DECISION_DELAY",true,now);
                        else emit(c,laneId,now);
                    }
                }
                case "STOP" -> {
                    if(a==null) code="LANE_ENDED";
                    else if(bool(lane,"manual_stopped")) code="ALREADY_STOPPED";
                    else { exec(c,"UPDATE spike_lane SET manual_stopped=true,stop_id=? WHERE lane=?",stopKey(req),laneId); accepted=true;code="STOPPED";emit(c,laneId,now); }
                }
                case "RESUME" -> {
                    if(a==null) code="LANE_ENDED";
                    else if(!bool(lane,"manual_stopped") && !bool(lane,"held")) code="NOT_STOPPED";
                    else if(!Objects.equals(req.get("stop_id"),lane.get("stop_id"))) code="STOP_ID_MISMATCH";
                    else if(bool(lane,"held") && !bool(lane,"recovery_confirmed")) code="RECOVERY_NOT_CONFIRMED";
                    else {
                        String stage=str(a,"stage");
                        long duration="PREPARING".equals(stage)?number(lane,"prep_ms"):"INITIAL".equals(stage)?number(lane,"initial_ms"):number(lane,"follow_ms");
                        if("PREPARING".equals(stage)) exec(c,"UPDATE spike_auction SET open_ms=?,window_start_ms=?,deadline_ms=? WHERE auction=?",now+duration,now+duration,now+duration+number(lane,"initial_ms"),a.get("auction"));
                        else exec(c,"UPDATE spike_auction SET window_start_ms=?,deadline_ms=? WHERE auction=?",now,now+duration,a.get("auction"));
                        exec(c,"UPDATE spike_lane SET manual_stopped=false,held=false,hold_reason=NULL,hold_since_ms=NULL,hold_cutoff_seq=NULL,recovery_confirmed=false,stop_id=NULL WHERE lane=?",laneId);
                        accepted=true;code="RESUMED";emit(c,laneId,now);
                    }
                }
                case "CANCEL", "SELLER_CANCEL" -> {
                    if(a==null || !Objects.equals(req.get("auction"),a.get("auction"))) code="TARGET_NOT_CURRENT";
                    else if(a.get("result")!=null) code="ALREADY_FINAL";
                    else if("SELLER_CANCEL".equals(kind) && (!Objects.equals(req.get("actor"),a.get("seller")) || bool(a,"started"))) code="SELLER_CANCEL_NOT_ALLOWED";
                    else {
                        exec(c,"UPDATE spike_auction SET result='CANCELLED',stage='CANCELLED',result_ms=?,cancel_reason=? WHERE auction=?",now,req.get("reason"),a.get("auction"));
                        accepted=true;code="CANCELLED";moveNext(c,laneId,now);emit(c,laneId,now);
                    }
                }
                default -> throw new IllegalStateException("Invalid persisted command");
            }
            Map<String,Object> decision=map("outcome",accepted?"ACCEPTED":"REJECTED","code",code,"seq",req.get("seq"),"receivedMs",received,"decidedMs",now,"snapshot",snapshot(c,laneId,now));
            exec(c,"UPDATE spike_request SET outcome=?,code=?,decided_ms=?,result_json=? WHERE actor=? AND request_key=? AND outcome='PENDING'",accepted?"ACCEPTED":"REJECTED",code,now,encode(decision),req.get("actor"),req.get("request_key"));
            Map<String,Object> saved=requestMap(one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",req.get("actor"),req.get("request_key")));
            hook.hit("before_decision_commit",saved);
            return saved;
        });
        if (result.containsKey("outcome")) hook.hit("after_decision_commit",result);
        return result;
    }
    public List<Map<String,Object>> drain(int lane,Long timeMs,int max) {
        List<Map<String,Object>> results=new ArrayList<>();
        for(int i=0;i<max;i++){ Map<String,Object> r=processNext(lane,timeMs); if(!r.containsKey("outcome"))break; results.add(r); }
        return results;
    }
    public Map<String,Object> tick(int lane,Long fixtureTimeMs) {
        return mutation(c -> {
            Map<String,Object> state=lock(c,lane);
            long now=at(c,fixtureTimeMs);
            if(state.get("last_received_ms")!=null && now<number(state,"last_received_ms")) {
                hold(c,lane,"CLOCK_REGRESSION_TIMER",false,now);
                return map("status","HELD_HISTORY_UNKNOWN","lane",lane);
            }
            if(one(c,"SELECT seq FROM spike_request WHERE lane=? AND outcome='PENDING' LIMIT 1",lane)!=null)
                return map("status","PENDING_REQUESTS","lane",lane);
            advance(c,lane,now,now,false); return snapshot(c,lane,now);
        });
    }
    private String bidRejection(Map<String,Object> l,Map<String,Object> a,Map<String,Object> r,boolean historicHold) {
        if(a==null || !Objects.equals(a.get("auction"),r.get("auction"))) return "TARGET_NOT_CURRENT";
        if(a.get("result")!=null) return "ALREADY_FINAL";
        if(bool(l,"manual_stopped")) return "MANUAL_STOPPED";
        if(bool(l,"held") && !historicHold) return "HELD";
        if(!Set.of("INITIAL","FOLLOWUP").contains(str(a,"stage"))) return "NOT_OPEN";
        long received=number(r,"received_ms");
        if(received<number(a,"window_start_ms")) return "BEFORE_WINDOW";
        if(received>=number(a,"deadline_ms")) return "AT_OR_AFTER_DEADLINE";
        if(Objects.equals(r.get("actor"),a.get("seller"))) return "SELF_BID";
        if(Objects.equals(r.get("actor"),a.get("highest_bidder"))) return "ALREADY_HIGHEST";
        long expected=a.get("highest_amount")==null?number(a,"start_price"):Math.addExact(number(a,"highest_amount"),number(a,"increment"));
        return number(r,"amount")!=expected?"PRICE_MISMATCH":null;
    }
    private void advance(Connection c,int laneId,long effectiveMs,long now,boolean historicHold) throws Exception {
        Map<String,Object> l=one(c,"SELECT * FROM spike_lane WHERE lane=?",laneId);
        if(bool(l,"manual_stopped") || (bool(l,"held") && !historicHold))return;
        Map<String,Object> a=current(c,l); if(a==null)return;
        if("PREPARING".equals(a.get("stage")) && effectiveMs>=number(a,"open_ms")) {
            exec(c,"UPDATE spike_auction SET stage='INITIAL',started=true WHERE auction=?",a.get("auction"));
            emit(c,laneId,now); a=current(c,l);
        }
        if(!bool(l,"held") && Set.of("INITIAL","FOLLOWUP").contains(str(a,"stage")) && effectiveMs>=number(a,"deadline_ms")) {
            String result=a.get("highest_amount")!=null && number(a,"highest_amount")>=number(a,"reserve")?"SOLD":"UNSOLD";
            exec(c,"UPDATE spike_auction SET result=?,stage=?,result_ms=? WHERE auction=?",result,result,number(a,"deadline_ms"),a.get("auction"));
            moveNext(c,laneId,now); emit(c,laneId,now);
        }
    }
    private void moveNext(Connection c,int laneId,long now) throws SQLException {
        Map<String,Object> l=one(c,"SELECT * FROM spike_lane WHERE lane=?",laneId);
        int next=(int)number(l,"current_ordinal")+1;
        exec(c,"UPDATE spike_lane SET current_ordinal=? WHERE lane=?",next,laneId);
        if(next<=number(l,"item_count")){
            long open=now+number(l,"prep_ms");
            exec(c,"UPDATE spike_auction SET stage='PREPARING',open_ms=?,window_start_ms=?,deadline_ms=? WHERE lane=? AND ordinal=?",open,open,open+number(l,"initial_ms"),laneId,next);
        } else {
            exec(c,"UPDATE spike_lane SET manual_stopped=false,held=false,hold_reason=NULL,hold_since_ms=NULL,hold_cutoff_seq=NULL,stop_id=NULL,recovery_confirmed=false WHERE lane=?",laneId);
        }
    }
    public Map<String,Object> recover(List<Integer> lanes,String reason,boolean historyComplete,Long fixtureTimeMs) {
        // Ascending gate order prevents cross-lane recovery deadlocks. The caller explicitly supplies scope/evidence.
        List<Integer> ordered=lanes.stream().distinct().sorted().toList();
        return mutation(c -> { for(int lane:ordered)lock(c,lane); long now=at(c,fixtureTimeMs); for(int lane:ordered)hold(c,lane,reason,historyComplete,now); return map("status","HELD","lanes",ordered,"historyComplete",historyComplete); });
    }
    public Map<String,Object> confirmRecovery(int lane) {
        return mutation(c -> { Map<String,Object> l=lock(c,lane); if(!bool(l,"history_complete"))return map("status","HISTORY_UNKNOWN");
            if(one(c,"SELECT seq FROM spike_request WHERE lane=? AND outcome='PENDING' LIMIT 1",lane)!=null)return map("status","PENDING_REQUESTS");
            // Connection and immutable history are available; full evidence assessment remains an operator experiment input.
            exec(c,"UPDATE spike_lane SET recovery_confirmed=true WHERE lane=?",lane); emit(c,lane,clock(c)); return map("status","CONFIRMED","stopId",l.get("stop_id")); });
    }
    private void hold(Connection c,int lane,String reason,boolean complete,long now) throws Exception {
        Map<String,Object> l=one(c,"SELECT * FROM spike_lane WHERE lane=?",lane); if(current(c,l)==null)return;
        // Preserve the earliest fault boundary: a second incident cannot reclassify post-fault receipts as historical.
        // Each invocation records a new experimental incident. A new cause invalidates older resume tokens,
        // including a fault layered on a manual stop. Repeated observation of one production incident
        // would require an incident identity; that deduplication protocol is outside this experiment.
        exec(c,"UPDATE spike_lane SET held=true,hold_reason=?,hold_since_ms=COALESCE(hold_since_ms,?),hold_cutoff_seq=COALESCE(hold_cutoff_seq,next_seq),history_complete=history_complete AND ?,recovery_confirmed=false,stop_id=? WHERE lane=?",
            reason,now,complete,"fault-"+UUID.randomUUID(),lane); emit(c,lane,now);
    }
    private void emit(Connection c,int lane,long now) throws Exception {
        exec(c,"UPDATE spike_lane SET version=version+1 WHERE lane=?",lane);
        Map<String,Object> s=snapshot(c,lane,now);
        exec(c,"INSERT INTO spike_outbox(lane,version,payload_json,created_ms) VALUES(?,?,?,?)",lane,s.get("version"),encode(s),now);
    }
    public Map<String,Object> snapshot(int lane) { return readSnapshot(c -> snapshot(c,lane,clock(c))); }
    public List<Map<String,Object>> snapshots() {
        return readSnapshot(c -> { List<Map<String,Object>> lanes=query(c,"SELECT lane FROM spike_lane ORDER BY lane"); long now=clock(c); List<Map<String,Object>> out=new ArrayList<>();for(Map<String,Object> l:lanes)out.add(snapshot(c,(int)number(l,"lane"),now));return out; });
    }
    private Map<String,Object> snapshot(Connection c,int lane,long now) throws SQLException {
        Map<String,Object> l=one(c,"SELECT * FROM spike_lane WHERE lane=?",lane), a=current(c,l);
        Map<String,Object> last=one(c,"SELECT auction,result,highest_amount,result_ms FROM spike_auction WHERE lane=? AND result IS NOT NULL ORDER BY ordinal DESC LIMIT 1",lane);
        Map<String,Object> lastResult=last==null?null:map("auction",last.get("auction"),"result",last.get("result"),"amount","SOLD".equals(last.get("result"))?last.get("highest_amount"):null,"resultMs",last.get("result_ms"));
        Long high=a==null?null:nullableNumber(a,"highest_amount");
        return map("lane",lane,"auction",a==null?null:a.get("auction"),"ordinal",l.get("current_ordinal"),"stage",a==null?"ENDED":a.get("stage"),"version",l.get("version"),
            "highestAmount",high,"hasBid",high!=null,"reserveMet",high!=null&&high>=number(a,"reserve"),"openMs",a==null?null:a.get("open_ms"),"windowStartMs",a==null?null:a.get("window_start_ms"),"deadlineMs",a==null?null:a.get("deadline_ms"),
            "manualStopped",l.get("manual_stopped"),"held",l.get("held"),"holdReason",l.get("hold_reason"),"stopId",l.get("stop_id"),"recoveryConfirmed",l.get("recovery_confirmed"),"historyComplete",l.get("history_complete"),
            "result",a==null?null:a.get("result"),"lastResult",lastResult,"nextAmount",a==null?null:high==null?a.get("start_price"):Math.addExact(high,number(a,"increment")),"serverMs",now);
    }
    public Map<String,Object> request(String actor,String key) {return tx(c->{Map<String,Object>r=one(c,"SELECT * FROM spike_request WHERE actor=? AND request_key=?",actor,key);return r==null?map("outcome","NOT_FOUND"):requestMap(r);});}
    public List<Map<String,Object>> requests(int lane) {return tx(c->{List<Map<String,Object>> out=new ArrayList<>();for(Map<String,Object>r:query(c,"SELECT * FROM spike_request WHERE lane=? ORDER BY seq",lane))out.add(requestMap(r));return out;});}
    public List<Map<String,Object>> events(int lane,long afterVersion,int limit) {
        if(limit<1||limit>10000)throw new IllegalArgumentException("event limit 1..10000");
        return tx(c->{List<Map<String,Object>> out=new ArrayList<>();for(Map<String,Object>r:query(c,"SELECT *,CASE WHEN current_setting('track_commit_timestamp')='on' THEN floor(extract(epoch FROM pg_xact_commit_timestamp(original_xid::xid))*1000)::bigint ELSE NULL END AS committed_ms FROM spike_outbox WHERE lane=? AND version>? ORDER BY version LIMIT ?",lane,afterVersion,limit))out.add(eventMap(r));return out;});
    }
    public void markPublished(long id) {tx(c->{exec(c,"UPDATE spike_outbox SET published=true WHERE id=?",id);return null;});}
    public Map<String,Object> audit(int lane) {
        return tx(c->{lock(c,lane);List<Map<String,Object>> req=new ArrayList<>();for(Map<String,Object>r:query(c,"SELECT * FROM spike_request WHERE lane=? ORDER BY seq",lane))req.add(requestMap(r));
            return map("lane",one(c,"SELECT * FROM spike_lane WHERE lane=?",lane),"auctions",query(c,"SELECT * FROM spike_auction WHERE lane=? ORDER BY ordinal",lane),"requests",req,"bids",query(c,"SELECT * FROM spike_bid WHERE lane=? ORDER BY seq",lane),
                "intents",query(c,"SELECT i.* FROM spike_intent i JOIN spike_auction a ON a.auction=i.auction WHERE a.lane=? ORDER BY i.actor,i.request_key",lane),"outbox",query(c,"SELECT id,lane,version,created_ms,published FROM spike_outbox WHERE lane=? ORDER BY version",lane));});
    }
    private Map<String,Object> eventMap(Map<String,Object> r) {return map("id",r.get("id"),"lane",r.get("lane"),"version",r.get("version"),"payload",decode(str(r,"payload_json")),"createdMs",r.get("created_ms"),"committedMs",r.get("committed_ms"),"originalXid",r.get("original_xid"),"published",r.get("published"));}
    private Map<String,Object> requestMap(Map<String,Object> r) {return map("actor",r.get("actor"),"key",r.get("request_key"),"kind",r.get("kind"),"lane",r.get("lane"),"auction",r.get("auction"),"amount",r.get("amount"),"reason",r.get("reason"),"stopId",r.get("stop_id"),"seq",r.get("seq"),"receivedMs",r.get("received_ms"),"outcome",r.get("outcome"),"code",r.get("code"),"decidedMs",r.get("decided_ms"),"result",r.get("result_json")==null?null:decode(str(r,"result_json")));}
    private static Map<String,Object> intent(Map<String,Object> r,String status) {return map("actor",r.get("actor"),"key",r.get("request_key"),"auction",r.get("auction"),"amount",r.get("amount"),"acknowledged",r.get("acknowledged"),"status",status);}
    private static boolean sameIntent(Map<String,Object> i,String auction,long amount) {return Objects.equals(i.get("auction"),auction)&&number(i,"amount")==amount;}
    private static boolean sameCommand(Map<String,Object> r,Command c) {return Objects.equals(r.get("kind"),c.kind)&&number(r,"lane")==c.lane&&Objects.equals(r.get("auction"),c.auction)&&Objects.equals(nullableNumber(r,"amount"),c.amount)&&Objects.equals(r.get("reason"),c.reason)&&Objects.equals(r.get("stop_id"),c.stopId);}
    private static void requireIdentity(String actor,String key) {if(actor==null||actor.isBlank()||key==null||key.isBlank())throw new IllegalArgumentException("actor/key required");}
    private static Map<String,Object> context(Command c) {return map("actor",c.actor,"key",c.key,"kind",c.kind,"lane",c.lane);}
    private static String stopKey(Map<String,Object> r) {return "stop-"+UUID.randomUUID();}
    private Map<String,Object> lock(Connection c,int lane) throws SQLException {Map<String,Object> l=one(c,"SELECT * FROM spike_lane WHERE lane=? FOR UPDATE",lane);if(l==null)throw new IllegalArgumentException("Unknown lane "+lane);return l;}
    private Map<String,Object> current(Connection c,Map<String,Object> l) throws SQLException {return one(c,"SELECT * FROM spike_auction WHERE lane=? AND ordinal=?",l.get("lane"),l.get("current_ordinal"));}
    private String encode(Object value) {try{return json.writeValueAsString(value);}catch(Exception e){throw new EngineException(e);}}
    private Map<String,Object> decode(String value) {try{return json.readValue(value,new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new EngineException(e);}}
    private static boolean hasSqlState(Throwable e,String state) {for(Throwable x=e;x!=null;x=x.getCause())if(x instanceof SQLException s&&state.equals(s.getSQLState()))return true;return false;}
    private static long number(Map<String,Object> m,String key) {return ((Number)m.get(key)).longValue();}
    private static Long nullableNumber(Map<String,Object> m,String key) {return m.get(key)==null?null:number(m,key);}
    private static boolean bool(Map<String,Object> m,String key) {return Boolean.TRUE.equals(m.get(key));}
    private static String str(Map<String,Object> m,String key) {return (String)m.get(key);}
    private static Map<String,Object> map(Object... pairs) {Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)m.put((String)pairs[i],pairs[i+1]);return m;}
    private static int exec(Connection c,String sql,Object...args) throws SQLException {try(PreparedStatement p=c.prepareStatement(sql)){bind(p,args);return p.executeUpdate();}}
    private static Map<String,Object> one(Connection c,String sql,Object...args) throws SQLException {List<Map<String,Object>> rows=query(c,sql,args);return rows.isEmpty()?null:rows.getFirst();}
    private static List<Map<String,Object>> query(Connection c,String sql,Object...args) throws SQLException {
        try(PreparedStatement p=c.prepareStatement(sql)){bind(p,args);try(ResultSet r=p.executeQuery()){List<Map<String,Object>> rows=new ArrayList<>();ResultSetMetaData md=r.getMetaData();while(r.next()){Map<String,Object> row=new LinkedHashMap<>();for(int i=1;i<=md.getColumnCount();i++)row.put(md.getColumnLabel(i),r.getObject(i));rows.add(row);}return rows;}}
    }
    private static void bind(PreparedStatement p,Object[] args) throws SQLException {for(int i=0;i<args.length;i++)p.setObject(i+1,args[i]);}
}

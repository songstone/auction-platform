"""Actual dedicated PostgreSQL restarts and recorded-time/commit-gap probes.

Every attempted case and external command is persisted, including failures.
The gap case characterizes a limitation; it does not certify commit-time duration.
"""
import argparse
import concurrent.futures
import datetime
import json
import subprocess
import sys
import time
import traceback
import uuid
from pathlib import Path
from client import Api, Trace

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'auction-spike-001-db'

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db-repeats', type=int, default=10)
    parser.add_argument('--timing-repeats', type=int, default=10)
    parser.add_argument('--skip-db', action='store_true')
    args = parser.parse_args()
    if min(args.db_repeats,args.timing_repeats)<0:
        parser.error('repetition counts must be nonnegative')
    run_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
    output=ROOT/'results'/'environment-failures'/run_id
    output.mkdir(parents=True)
    trace=Trace(output/'trace.jsonl')
    api,peer=Api('http://127.0.0.1:18081',trace),Api('http://127.0.0.1:18082',trace)
    rows,setup_errors=[],[]
    completed=False
    db_requested=0 if args.skip_db else args.db_repeats

    def group_status(prefix,requested):
        selected=[r for r in rows if r['case'].startswith(prefix)]
        if not selected:return 'NOT_RUN'
        if any(r['status']=='FAIL' for r in selected):return 'FAIL'
        return 'PASS' if len(selected)==requested and all(r['status']=='PASS' for r in selected) else 'INCOMPLETE'

    def persist():
        failed=sum(r['status']=='FAIL' for r in rows)
        summary={'runId':run_id,'updatedUtc':utc(),'completed':completed,'command':[sys.executable,*sys.argv],
                 'scope':'REAL_POSTGRES_RESTART_AND_REAL_DB_COMMIT_TIMESTAMP',
                 'status':'FAIL' if failed or setup_errors else ('PASS' if rows else 'NOT_RUN') if completed else 'RUNNING',
                 'requested':{'dbRestart':db_requested,'timing':args.timing_repeats},
                 'attempted':len(rows),'passed':sum(r['status']=='PASS' for r in rows),'failed':failed,
                 'dbRestartStatus':group_status('ACTUAL_POSTGRES',db_requested),
                 'timingProbeStatus':group_status('RESUME_RECORDED',args.timing_repeats),
                 'physicalCommitResumeGapRiskObserved':any(r.get('physicalCommitFullDurationSatisfied') is False for r in rows),
                 'setupErrors':setup_errors,'rows':rows}
        temporary=output/'summary.tmp.json'
        temporary.write_text(json.dumps(summary,indent=2),encoding='utf-8')
        temporary.replace(output/'summary.json')

    def call(client,path,data=None):
        result=client.get(path) if data is None else client.post(path,data)
        if result.status!=200:raise AssertionError((path,result.status,result.body,result.error))
        return result.body

    def wait(predicate,timeout=30):
        started=time.monotonic()
        last_error=None
        while time.monotonic()-started<timeout:
            try:
                value=predicate()
                if value:return value
            except (AssertionError,KeyError,ValueError) as exc:last_error=str(exc)
            time.sleep(.05)
        raise AssertionError({'waitTimeoutSeconds':timeout,'elapsedSeconds':time.monotonic()-started,'lastError':last_error})

    def reset(initial=10000,follow=5000,auto=False):
        for client in (api,peer):
            call(client,'/admin/mode',{'manual':True,'realClock':True})
            call(client,'/admin/dispatcher',{'paused':True})
            call(client,'/admin/fault/release',{})
        time.sleep(.1)
        call(api,'/admin/reset',{'lanes':4,'itemsPerLane':3,'prepMs':0,'initialMs':initial,'followMs':follow,'startPrice':10000,'increment':1000,'reserve':10000,'manual':not auto})
        if auto:call(peer,'/admin/mode',{'manual':False,'realClock':True})

    def docker(*arguments):
        command=['docker',*arguments]
        evidence={'externalCommand':command,'startedUtc':utc(),'monotonicStartNs':time.monotonic_ns()}
        try:
            result=subprocess.run(command,capture_output=True,text=True,timeout=45)
            evidence.update(exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr,timedOut=False)
        except subprocess.TimeoutExpired as exc:
            def decoded(v):return v.decode('utf-8','replace') if isinstance(v,bytes) else v
            evidence.update(exitCode=None,stdout=decoded(exc.stdout),stderr=decoded(exc.stderr),timedOut=True,timeoutSeconds=45)
            raise AssertionError({'externalCommandTimedOut':command,'timeoutSeconds':45}) from exc
        except OSError as exc:
            evidence.update(exitCode=None,error=f'{type(exc).__name__}: {exc}')
            raise
        finally:
            evidence['endedUtc']=utc()
            evidence['monotonicEndNs']=time.monotonic_ns()
            evidence['elapsedMs']=(evidence['monotonicEndNs']-evidence['monotonicStartNs'])/1_000_000
            trace.write(evidence)
        if result.returncode:raise AssertionError((command,result.returncode,result.stderr))
        return result.stdout.strip(),evidence

    def database_probe():
        # Local container authentication; no password/token is read or logged.
        sql="SELECT json_build_object('epoch',pg_postmaster_start_time()::text,'serverMs',floor(extract(epoch FROM clock_timestamp())*1000)::bigint)::text"
        text,evidence=docker('exec',CONTAINER,'psql','-X','-U','spike','-d','spike001','-At','-c',sql)
        return {**json.loads(text),'commandTiming':{k:evidence[k] for k in ('startedUtc','endedUtc','monotonicStartNs','monotonicEndNs','elapsedMs')}}

    def held_snapshot():
        value=call(api,'/snapshot')
        return value if len(value['lanes'])==4 and all(l['held'] for l in value['lanes']) else None

    def run_case(name,repetition,action):
        row={'case':name,'repeat':repetition,'status':'RUNNING','startedUtc':utc(),'cleanupErrors':[]}
        rows.append(row)
        began=time.monotonic_ns()
        persist()
        try:
            action(row)
            if row['cleanupErrors']:raise AssertionError({'cleanupErrors':row['cleanupErrors']})
            row['status']='PASS'
        except BaseException as exc:
            row.update(status='FAIL',error=f'{type(exc).__name__}: {exc}',traceback=traceback.format_exc())
            if not isinstance(exc,Exception):raise
        finally:
            row['endedUtc']=utc()
            row['elapsedMs']=(time.monotonic_ns()-began)/1_000_000
            trace.write({'caseResult':row})
            with (output/'cases.jsonl').open('a',encoding='utf-8') as stream:stream.write(json.dumps(row)+'\n')
            persist()
            print(json.dumps({'case':name,'repeat':repetition,'status':row['status'],'error':row.get('error')}),flush=True)
        return row['status']=='PASS'

    def restart_case(row):
        kill_attempted=False
        try:
            reset(initial=20000,follow=5000,auto=True)
            row['appPidsBefore']=[call(c,'/health')['pid'] for c in (api,peer)]
            actor,key='db-'+uuid.uuid4().hex,uuid.uuid4().hex
            body={'actor':actor,'key':key,'auction':'L1-A1','lane':1,'amount':10000}
            call(api,'/intents',body)
            call(api,'/bids',body)
            original=wait(lambda:(r if (r:=call(api,f'/requests?actor={actor}&key={key}'))['outcome']=='ACCEPTED' else None))
            row['original']=original
            before=call(api,'/snapshot')
            row['before']=before
            assert len(before['lanes'])==4 and all(l['ordinal']==1 and l['result'] is None and not l['held'] for l in before['lanes']),before
            deadline=next(l['deadlineMs'] for l in before['lanes'] if l['lane']==1)
            prior=database_probe()
            row.update(databaseBefore=prior,targetDeadlineMs=deadline)
            # The DB sample occurred inside the command interval. Its start yields
            # a conservative upper bound if there is no wall-clock step in this interval.
            projected=prior['serverMs']+1+(time.monotonic_ns()-prior['commandTiming']['monotonicStartNs'])/1_000_000
            row['preKillConservativeMarginMs']=deadline-projected
            assert row['preKillConservativeMarginMs']>=2000,{'invalidFixture':'insufficient pre-kill margin','marginMs':row['preKillConservativeMarginMs']}
            kill_attempted=True
            _,kill=docker('kill','--signal=KILL',CONTAINER)
            row['killCommand']=kill
            upper=prior['serverMs']+1+(kill['monotonicEndNs']-prior['commandTiming']['monotonicStartNs'])/1_000_000
            row['killEndProjectedDbMsUpper']=upper
            row['clockProjectionAssumption']='No DB wall-clock step in probe-to-kill interval; subprocess sampling uncertainty conservatively bracketed.'
            assert upper<deadline,{'invalidFixture':'kill not established before deadline','upperMs':upper,'deadlineMs':deadline}
            slept=time.monotonic_ns()
            time.sleep(5.2)
            row.update(downSleepMsRequested=5200,downSleepMsObserved=(time.monotonic_ns()-slept)/1_000_000)
            _,start=docker('start',CONTAINER)
            row['startCommand']=start
            after_probe=wait(database_probe,40)
            row['databaseAfter']=after_probe
            assert after_probe['epoch']!=prior['epoch'],(prior,after_probe)
            assert after_probe['serverMs']>deadline,(after_probe,deadline)
            after=wait(held_snapshot,40)
            row['after']=after
            replay=call(api,f'/requests?actor={actor}&key={key}')
            row['replayed']=replay
            audit=call(api,'/admin/audit?lane=1')
            row['audit']=audit
            first=next(a for a in audit['auctions'] if a['auction']=='L1-A1')
            assert first['result'] is None,first
            assert first['highest_amount']==10000,first
            assert replay==original,(original,replay)
            assert all(l['ordinal']==1 for l in after['lanes']),after
            row['appPidsAfter']=[call(c,'/health')['pid'] for c in (api,peer)]
            assert row['appPidsBefore']==row['appPidsAfter'],row
            row['metrics']=[call(c,'/metrics') for c in (api,peer)]
        finally:
            if kill_attempted:
                try:
                    # Idempotent; also handles an ambiguous docker kill/start timeout.
                    _,cleanup=docker('start',CONTAINER)
                    row['cleanupStartCommand']=cleanup
                    row['cleanupDatabaseReady']=wait(database_probe,40)
                except Exception as exc:row['cleanupErrors'].append(f'DB restart cleanup: {type(exc).__name__}: {exc}')

    def timing_case(row):
        reset()
        actor='operator-'+uuid.uuid4().hex
        call(api,'/commands',{'actor':actor,'key':'stop','kind':'STOP','lane':1,'reason':'timing probe'})
        call(api,'/admin/process',{'lane':1})
        stop=call(api,'/snapshot')['lanes'][0]
        assert stop['stage']=='INITIAL' and stop['manualStopped'],stop
        call(api,'/commands',{'actor':actor,'key':'resume','kind':'RESUME','lane':1,'stopId':stop['stopId']})
        executor=concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            call(api,'/admin/fault',{'point':'before_decision_commit','action':'pause','lane':1,'key':'resume'})
            future=executor.submit(call,api,'/admin/process',{'lane':1})
            wait(lambda:call(api,'/admin/fault/status')['hit'])
            row['hookHitUtc']=utc()
            began=time.monotonic_ns()
            time.sleep(.5)
            row['injectedPauseMsObserved']=(time.monotonic_ns()-began)/1_000_000
            call(api,'/admin/fault/release',{})
            future.result(timeout=20)
            result=call(api,f'/requests?actor={actor}&key=resume')
            row['originalResume']=result
            assert result['outcome']=='ACCEPTED',result
            snapshot=result['result']['snapshot']
            assert snapshot['stage']=='INITIAL',snapshot
            assert snapshot['deadlineMs']-snapshot['windowStartMs']==10000,snapshot
            events=call(api,'/admin/events?lane=1&afterVersion=0')
            event=next(e for e in events if e['version']==snapshot['version'])
            row['resumeEvent']=event
            assert event.get('committedMs') is not None,{'missingCommitTimestamp':event}
            gap=event['committedMs']-snapshot['windowStartMs']
            remaining=snapshot['deadlineMs']-event['committedMs']
            assert gap>=450,(gap,event,snapshot)
            assert remaining==10000-gap,(remaining,gap)
            row.update(observationConfirmed=True,contract='RECORDED_TRANSITION_TIMESTAMP_IS_NOT_PHYSICAL_COMMIT_TIMESTAMP',recordedResumeMs=snapshot['windowStartMs'],commitMs=event['committedMs'],deadlineMs=snapshot['deadlineMs'],recordToCommitGapMs=gap,deadlineMinusCommitMs=remaining,usableAfterCommitMs=max(0,remaining),configuredDurationMs=10000,physicalCommitFullDurationSatisfied=False)
        finally:
            try:call(api,'/admin/fault/release',{})
            except Exception as exc:row['cleanupErrors'].append(f'Hook release: {type(exc).__name__}: {exc}')
            executor.shutdown(wait=True,cancel_futures=True)

    persist()
    try:
        if db_requested:
            label,_=docker('inspect',CONTAINER,'--format','{{index .Config.Labels "purpose"}}')
            assert label=='auction-spike-001',{'unexpectedDedicatedContainerLabel':label}
        proceed=True
        for repetition in range(1,db_requested+1):
            if not run_case('ACTUAL_POSTGRES_KILL_RESTART_PAST_DEADLINE',repetition,restart_case):
                proceed=False
                break
        if proceed:
            for repetition in range(1,args.timing_repeats+1):
                if not run_case('RESUME_RECORDED_TIME_TO_COMMIT_GAP',repetition,timing_case):break
        completed=True
    except BaseException as exc:
        setup_errors.append({'error':f'{type(exc).__name__}: {exc}','traceback':traceback.format_exc(),'utc':utc()})
        raise
    finally:
        persist()
        api.close_all()
        peer.close_all()
        print(str(output),flush=True)
    return 1 if setup_errors or any(r['status']=='FAIL' for r in rows) else 0

if __name__=='__main__':sys.exit(main())

"""Targeted independent integration regressions found during spike review."""
from __future__ import annotations

import argparse
import time
import urllib.parse
from pathlib import Path

from correctness import Suite


class RegressionSuite(Suite):
    def stop_occurrence_collision(self):
        self.reset()
        def command(actor,key,kind,stop=None):
            body={"actor":actor,"key":key,"kind":kind,"lane":1,"auction":"L1-A1","reason":"synthetic experiment","stopId":stop}
            self.ok(self.primary.post("/commands",body))
            self.process()
            return body
        first=command("a:b","c","STOP")
        self.outcome(first,"ACCEPTED")
        old_id=self.lane()["stopId"]
        resume=command("operator","resume-first","RESUME",old_id)
        self.outcome(resume,"ACCEPTED")
        second=command("a","b:c","STOP")
        self.outcome(second,"ACCEPTED")
        new_id=self.lane()["stopId"]
        stale=command("operator","never-received-old-resume","RESUME",old_id)
        stale_result=self.request(stale)
        self.active["observations"]["audit"]=self.audit()
        self.active["observations"]["firstStopId"]=old_id
        self.active["observations"]["secondStopId"]=new_id
        self.check("distinct stop occurrences remain distinct for delimiter-bearing identities",old_id!=new_id,{"firstStopId":old_id,"secondStopId":new_id,"staleResumeOutcome":stale_result})
        self.check("first-arrival stale resume cannot clear later stop",stale_result["outcome"]=="REJECTED" and self.lane()["manualStopped"] and self.lane()["stopId"]==new_id,self.lane(),new_id)

    def auto_worker_independence(self):
        self.reset()
        first=self.body("blocked-member","blocked-lane-1")
        self.bid(first)
        self.arm("before_decision_commit",key=first["key"])
        self.ok(self.primary.post("/admin/mode",{"manual":False}))
        try:
            self.wait_hook()
            second=self.body("unblocked-member","independent-lane-2",lane=2)
            self.bid(second,self.peer)
            started=time.monotonic()
            observed=None
            while time.monotonic()-started<3:
                observed=self.request(second,self.peer)
                if observed["outcome"]!="PENDING":break
                time.sleep(.01)
            self.check("automatic lane-2 worker progresses while lane-1 transaction is paused",observed["outcome"]=="ACCEPTED",observed)
            snapshot=self.peer.call("GET","/snapshot",timeout=2)
            states=self.ok(snapshot)
            self.check("MVCC snapshot returns committed state while writer holds lane gate",snapshot.status==200 and states["lanes"][0]["highestAmount"] is None and states["lanes"][1]["highestAmount"]==10000,states)
            self.active["observations"]["snapshotDuringPausedWriterMs"]=snapshot.elapsed_ms
            self.active["observations"]["lane2FinalObservedAfterMs"]=(time.monotonic()-started)*1000
            status=self.ok(self.primary.get("/admin/fault/status"))
            self.check("lane-1 latch remains held during independent observation",status.get("hit"),status)
        finally:
            self.primary.post("/admin/mode",{"manual":True})
            self.primary.post("/admin/fault/release")
        deadline=time.monotonic()+3
        while time.monotonic()<deadline:
            first_result=self.request(first)
            if first_result["outcome"]!="PENDING":break
            time.sleep(.01)
        self.outcome(first,"ACCEPTED")

    def registration_response_loss(self):
        self.reset(itemsPerLane=1)
        self.clock(8000)
        body=self.body("handoff-member","lost-register-response")
        # The HTTP response is intentionally discarded by the simulated first
        # device. Only the second device's authoritative lookup allows submit.
        self.intent(body)
        self.outcome(body,"NOT_FOUND")
        query=urllib.parse.urlencode({"actor":body["actor"],"auction":body["auction"]})
        discovered=self.ok(self.peer.get("/intents/current?"+query))
        self.check("other device retrieves registered shared intent",discovered["status"]=="REGISTERED" and discovered["key"]==body["key"] and discovered["amount"]==body["amount"],discovered)
        self.clock(12000)
        self.ok(self.submit(body,self.peer))
        self.process(now=12000,api=self.peer)
        original=self.outcome(body,"REJECTED")
        self.check("registration-response recovery does not backdate official receipt",original["receivedMs"]==12000,original,12000)
        self.ok(self.primary.post("/ack",{"actor":body["actor"],"key":body["key"]}))
        released=self.ok(self.peer.get("/intents/current?"+query))
        self.check("explicit original-result acknowledgement releases shared current intent",released["status"]=="NONE",released)

    def processing_clock_regression(self):
        self.reset()
        self.control("STOP","clock-stop")
        self.process()
        old_id=self.lane()["stopId"]
        self.clock(20000)
        resume=self.control("RESUME","clock-resume",stop=old_id)
        self.clock(20100)
        body=self.body("clock-regression-member","clock-later-bid")
        self.bid(body)
        self.process(now=19000)
        self.outcome(resume,"PENDING")
        self.outcome(body,"PENDING")
        state=self.lane()
        self.check("regressed decision clock cannot resume or backdate live window",state["manualStopped"] and state["held"] and not state["historyComplete"] and state["windowStartMs"]==0 and state["deadlineMs"]==10000,state)

    def timer_clock_regression(self):
        self.reset()
        body=self.body("timer-regression-member","timer-later-receipt")
        self.bid(body)
        self.ok(self.primary.post("/admin/tick",{"lane":1,"nowMs":900}))
        self.outcome(body,"PENDING")
        state=self.lane()
        self.check("regressed timer clock holds unresolved history",state["held"] and not state["historyComplete"] and not state["hasBid"],state)

    def original_rejection_after_open(self):
        self.reset(prepMs=5000)
        self.clock(4990)
        body=self.body("pre-open-member","original-pre-open-reject")
        self.bid(body)
        self.process(now=4990)
        original=self.outcome(body,"REJECTED")
        self.clock(5000)
        self.ok(self.primary.post("/admin/tick",{"lane":1,"nowMs":5000}))
        before=self.lane()
        duplicate=self.ok(self.submit(body,self.peer))
        self.check("formerly too-early request keeps original rejection when conditions become valid",duplicate["outcome"]=="REJECTED" and duplicate["seq"]==original["seq"] and duplicate["receivedMs"]==4990,duplicate,original)
        after=self.lane()
        self.check("original rejection cannot create bid or deadline update",not after["hasBid"] and after["version"]==before["version"] and after["deadlineMs"]==before["deadlineMs"],after,before)

    def original_accept_after_result(self):
        self.reset(itemsPerLane=1)
        body=self.body("finished-member","original-accepted")
        self.bid(body)
        self.process()
        original=self.outcome(body,"ACCEPTED")
        self.clock(6000)
        self.ok(self.primary.post("/admin/tick",{"lane":1,"nowMs":6000}))
        self.check("fixture normally finalized sold",self.audit()["auctions"][0]["result"]=="SOLD",self.audit()["auctions"][0])
        duplicate=self.ok(self.submit(body,self.peer))
        self.check("finished auction returns immutable original acceptance",duplicate["outcome"]=="ACCEPTED" and duplicate["result"]==original["result"],duplicate,original)
        self.check("finished replay creates no new receipt or bid effect",len(self.audit()["requests"])==1 and len(self.audit()["bids"])==1,self.audit())

    def pending_ack_and_content_binding(self):
        self.reset()
        body=self.body("binding-member","original-key")
        self.ok(self.intent(body))
        acknowledgement=self.ok(self.primary.post("/ack",{"actor":body["actor"],"key":body["key"]}))
        self.check("missing receipt cannot count as original-result acknowledgement",acknowledgement["status"]=="NOT_FINAL",acknowledgement)
        new=self.body("binding-member","new-key",11000)
        conflict=self.ok(self.intent(new,self.peer))
        self.check("unreceived registered intent remains protected",conflict["status"]=="CONFLICT_PENDING",conflict)
        self.ok(self.submit(body))
        acknowledgement=self.ok(self.primary.post("/ack",{"actor":body["actor"],"key":body["key"]}))
        self.check("pending receipt cannot count as final acknowledgement",acknowledgement["status"]=="NOT_FINAL",acknowledgement)
        changed=self.ok(self.submit(dict(body,amount=11000),self.peer))
        self.check("same request key cannot change submitted amount",changed.get("outcome")=="CONFLICT",changed)
        other_target=self.ok(self.submit(dict(body,lane=2,auction="L2-A1"),self.peer))
        self.check("same request key cannot change auction",other_target.get("outcome")=="CONFLICT",other_target)
        self.process()
        original=self.outcome(body,"ACCEPTED")
        self.check("content collision preserves original amount and target",original["amount"]==10000 and original["auction"]=="L1-A1",original)

    def layered_stop_identity(self,fault_first):
        self.reset()
        if fault_first:
            self.ok(self.primary.post("/admin/recover",{"lanes":[1],"reason":"first synthetic fault","historyComplete":True,"nowMs":2000}))
        else:
            self.control("STOP","first-manual-stop")
            self.process()
        old_id=self.lane()["stopId"]
        if fault_first:
            self.clock(2100)
            stop=self.control("STOP","new-manual-stop-after-fault")
            self.process(now=2100)
            self.outcome(stop,"ACCEPTED")
        else:
            self.ok(self.primary.post("/admin/recover",{"lanes":[1],"reason":"new synthetic fault after manual stop","historyComplete":True,"nowMs":2000}))
        new_state=self.lane()
        self.ok(self.primary.post("/admin/confirm",{"lane":1}))
        self.clock(2200)
        stale=self.control("RESUME","first-arrival-resume-for-earlier-cause",stop=old_id)
        self.process(now=2200)
        decision=self.request(stale)
        after=self.lane()
        self.active["observations"].update({"oldStopId":old_id,"stateAfterNewCause":new_state,"staleResumeDecision":decision,"stateAfterStaleResume":after,"audit":self.audit()})
        self.check("old resume cannot clear a later layered stop cause",decision["outcome"]=="REJECTED" and after["manualStopped"] and after["held"],{"faultFirst":fault_first,"oldStopId":old_id,"newState":new_state,"decision":decision,"after":after})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls",nargs="+",default=["http://127.0.0.1:18081","http://127.0.0.1:18082"])
    parser.add_argument("--output",default=str(Path(__file__).resolve().parents[1]/"results"/"regressions"))
    parser.add_argument("--repeats",type=int,default=10)
    parser.add_argument("--seed",type=int,default=20261015)
    parser.add_argument("--only")
    args=parser.parse_args()
    suite=RegressionSuite(args)
    for repetition in range(1,args.repeats+1):
        suite.case("E2_stop_occurrence_delimiter_collision",repetition,suite.stop_occurrence_collision)
        suite.case("E1_automatic_worker_and_snapshot_independence",repetition,suite.auto_worker_independence)
        suite.case("E2_registration_response_loss_lookup_handoff",repetition,suite.registration_response_loss)
        suite.case("E2_processing_clock_regression",repetition,suite.processing_clock_regression)
        suite.case("E2_timer_clock_regression",repetition,suite.timer_clock_regression)
        suite.case("E2_original_reject_after_open",repetition,suite.original_rejection_after_open)
        suite.case("E2_original_accept_after_result",repetition,suite.original_accept_after_result)
        suite.case("E2_pending_ack_and_content_binding",repetition,suite.pending_ack_and_content_binding)
        suite.case("E2_layered_stop_fault_then_manual",repetition,lambda:suite.layered_stop_identity(True))
        suite.case("E2_layered_stop_manual_then_fault",repetition,lambda:suite.layered_stop_identity(False))
    return suite.finish()


if __name__=="__main__":
    raise SystemExit(main())

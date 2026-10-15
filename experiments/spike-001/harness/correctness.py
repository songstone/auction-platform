"""Independent policy scenarios for the isolated SPIKE-001 HTTP service.

Run from any directory: python .../harness/correctness.py --help
All fixtures are synthetic. A passing case describes only the exercised path.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import platform
import re
import sys
import time
import traceback
import urllib.parse
import uuid
from pathlib import Path

from client import Api, Response, Trace, VersionedView, SseReader, parallel


class Failure(AssertionError):
    pass


class Suite:
    def __init__(self, args):
        self.args = args
        self.run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
        self.directory = Path(args.output) / self.run_id
        self.directory.mkdir(parents=True, exist_ok=False)
        self.trace = Trace(self.directory / "http-trace.jsonl")
        self.apis = [Api(url, self.trace) for url in args.urls]
        self.primary = self.apis[0]
        self.peer = self.apis[-1]
        self.cases = []
        self.active = None
        self.seed = args.seed
        self.process_termination_scope = "NOT_RUN by this command"
        jar = Path(__file__).resolve().parents[1]/"target"/"spike-001-0.0.1.jar"
        self.jar_hash = hashlib.sha256(jar.read_bytes()).hexdigest() if jar.exists() else None

    def check(self, name, condition, observed=None, expected=None):
        assertion = {"name": name, "passed": bool(condition), "observed": observed, "expected": expected}
        self.active["assertions"].append(assertion)
        if not condition:
            raise Failure(f"{name}: observed={observed!r}, expected={expected!r}")

    def ok(self, response: Response):
        self.check("HTTP request completed", 200 <= response.status < 300,
                   {"status": response.status, "error": response.error, "body": response.body}, "2xx")
        return response.body

    def case(self, name, repetition, action):
        if self.args.only and not re.search(self.args.only, name):
            return
        started = time.monotonic_ns()
        self.active = {"name": name, "repetition": repetition, "assertions": [], "observations": {}}
        try:
            action()
            self.active["status"] = "PASS"
        except Exception as exc:
            self.active["status"] = "FAIL"
            self.active["error"] = f"{type(exc).__name__}: {exc}"
            self.active["traceback"] = traceback.format_exc()
            print(f"FAIL {name}[{repetition}]: {exc}", flush=True)
            for api in self.apis:
                api.post("/admin/fault/release")
        self.active["elapsedMs"] = (time.monotonic_ns() - started) / 1_000_000
        self.cases.append(self.active)
        with (self.directory / "cases.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(self.active, ensure_ascii=False, default=str) + "\n")
        if self.active["status"] == "PASS" and (repetition % 10 == 0 or repetition == 1):
            print(f"PASS {name}[{repetition}] {self.active['elapsedMs']:.1f}ms", flush=True)

    def reset(self, **changes):
        fixture = dict(lanes=4, itemsPerLane=3, startMs=0, prepMs=0, initialMs=10000,
                       followMs=5000, startPrice=10000, increment=1000, reserve=10000, manual=True)
        fixture.update(changes)
        for api in self.apis:
            self.ok(api.post("/admin/fault/release"))
            self.ok(api.post("/admin/mode", {"manual": True}))
        self.ok(self.primary.post("/admin/reset", fixture))
        self.clock(0)
        for lane in range(1, fixture["lanes"] + 1):
            self.ok(self.primary.post("/admin/tick", {"lane": lane, "nowMs": 0}))
        self.clock(1000)
        return fixture

    def clock(self, value):
        for api in self.apis:
            self.ok(api.post("/admin/clock", {"nowMs": value}))

    def body(self, actor, key, amount=10000, lane=1, auction=None):
        return {"actor": actor, "key": key, "lane": lane, "auction": auction or f"L{lane}-A1", "amount": amount}

    def intent(self, body, api=None):
        return (api or self.primary).post("/intents", body)

    def submit(self, body, api=None):
        return (api or self.primary).post("/bids", body)

    def bid(self, body, api=None):
        intent = self.ok(self.intent(body, api))
        self.check("intent registered before bid", intent.get("status") == "REGISTERED", intent)
        return self.ok(self.submit(body, api))

    def process(self, lane=1, now=1000, api=None, max_count=100):
        return self.ok((api or self.primary).post("/admin/process", {"lane": lane, "nowMs": now, "max": max_count}))

    def request(self, body, api=None):
        query = urllib.parse.urlencode({"actor": body["actor"], "key": body["key"]})
        return self.ok((api or self.primary).get("/requests?" + query))

    def lanes(self):
        data = self.ok(self.primary.get("/snapshot"))
        return data["lanes"] if isinstance(data, dict) else data

    def lane(self, number=1):
        return next(item for item in self.lanes() if int(item["lane"]) == number)

    def audit(self, lane=1):
        return self.ok(self.primary.get(f"/admin/audit?lane={lane}"))

    def outcome(self, body, expected, api=None):
        result = self.request(body, api)
        self.check("original outcome", result.get("outcome") == expected, result, expected)
        return result

    def control(self, kind, key, lane=1, auction=None, stop=None, api=None):
        body = {"actor": "operator", "key": key, "kind": kind, "lane": lane,
                "auction": auction or f"L{lane}-A1", "reason": "synthetic experiment", "stopId": stop}
        self.ok((api or self.primary).post("/commands", body))
        return body

    def wait_hook(self, api=None):
        api = api or self.primary
        deadline = time.monotonic() + 10
        observations = []
        while time.monotonic() < deadline:
            result = api.get("/admin/fault/status")
            observations.append(result.body)
            value = result.body or {}
            if value.get("hit") or value.get("entered") or value.get("waiting") or value.get("hits", 0) > 0:
                self.active["observations"]["hook"] = value
                return
            time.sleep(0.01)
        self.check("fault hook reached", False, observations[-5:], "hit/entered/waiting")

    def arm(self, point, action="pause", key=None, lane=1, api=None):
        body = {"point": point, "action": action, "lane": lane}
        if key:
            body["key"] = key
        return self.ok((api or self.primary).post("/admin/fault", body))

    def same_price(self):
        self.reset()
        bodies = [self.body(f"member-{i}", f"same-{i}") for i in range(20)]
        registrations = parallel([lambda b=b, i=i: self.intent(b, self.apis[i % len(self.apis)]) for i,b in enumerate(bodies)])
        for response in registrations:
            value = self.ok(response)
            self.check("unique member intent registered", value.get("status") == "REGISTERED", value)
        receipts = parallel([lambda b=b,i=i: self.submit(b,self.apis[i % len(self.apis)]) for i,b in enumerate(bodies)])
        for response in receipts:
            self.ok(response)
        self.process(api=self.peer)
        records = [self.request(body) for body in bodies]
        ordered = sorted(records, key=lambda item: item["seq"])
        expected = ["ACCEPTED"] + ["REJECTED"] * 19
        self.check("official first valid same-price bid only", [r["outcome"] for r in ordered] == expected,
                   [{"actor": r["actor"], "seq": r["seq"], "receivedMs": r["receivedMs"], "outcome": r["outcome"], "code": r["code"]} for r in ordered], expected)
        self.check("one official receipt per unique key", len({r["seq"] for r in ordered}) == 20, [r["seq"] for r in ordered], 20)
        state = self.lane()
        self.check("highest amount matches accepted request", state["highestAmount"] == 10000, state, 10000)
        self.check("deadline derives from receipt not old deadline", state["deadlineMs"] == 6000, state, 6000)
        self.check("other lanes unaffected", all(not item["hasBid"] for item in self.lanes() if item["lane"] != 1), self.lanes())
        self.active["observations"]["audit"] = self.audit()

    def decision_order(self):
        self.reset()
        invalid = self.body("invalid-member", "order-invalid", 9000)
        valid = self.body("valid-member", "order-valid", 10000)
        self.bid(invalid)
        self.bid(valid, self.peer)
        self.arm("before_decision_commit", key=invalid["key"])
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            first = pool.submit(self.primary.post, "/admin/process", {"lane":1,"nowMs":1000,"max":1})
            self.wait_hook()
            second = pool.submit(self.peer.post, "/admin/process", {"lane":1,"nowMs":1000,"max":1})
            independent = self.body("lane-two-member", "independent", lane=2)
            self.bid(independent, self.peer)
            self.process(lane=2, api=self.peer)
            self.outcome(independent, "ACCEPTED")
            self.check("lane 2 progresses while lane 1 decision paused", not first.done(), first.done(), False)
            self.ok(self.primary.post("/admin/fault/release"))
            self.ok(first.result(timeout=20))
            self.ok(second.result(timeout=20))
        a, b = self.outcome(invalid,"REJECTED"), self.outcome(valid,"ACCEPTED")
        self.check("predecessor retained official order", a["seq"] < b["seq"], [a["seq"],b["seq"]])
        self.check("invalid predecessor does not block valid successor", self.lane()["highestAmount"] == 10000, self.lane())
        self.active["observations"]["audit"] = self.audit()

    def receipt_gap(self):
        self.reset()
        self.clock(9950)
        body = self.body("gap-member", "gap-request")
        self.ok(self.intent(body))
        self.arm("before_receipt_commit", key=body["key"])
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            admission = pool.submit(self.submit, body)
            self.wait_hook()
            self.clock(10000)
            ending = pool.submit(self.peer.post, "/admin/tick", {"lane":1,"nowMs":10000})
            time.sleep(.03)
            self.check("timer does not finish past uncommitted predecessor", not ending.done(), ending.done(), False)
            self.ok(self.primary.post("/admin/fault/release"))
            self.ok(admission.result(timeout=20))
            self.ok(ending.result(timeout=20))
        self.process(now=10000, api=self.peer)
        record = self.outcome(body,"ACCEPTED")
        state = self.lane()
        self.check("receipt timestamp survives commit gap", record["receivedMs"] == 9950, record, 9950)
        self.check("uncommitted pre-deadline bid not missed", state["deadlineMs"] == 14950 and state["result"] is None, state)
        self.active["observations"]["audit"] = self.audit()

    def boundary(self, precursor_valid=True):
        self.reset()
        self.clock(9950)
        first = self.body("first", "boundary-first",10000 if precursor_valid else 9000)
        self.bid(first)
        self.clock(10000)
        second = self.body("second", "boundary-second",11000 if precursor_valid else 10000)
        self.bid(second,self.peer)
        self.process(now=10000,api=self.peer)
        self.outcome(first,"ACCEPTED" if precursor_valid else "REJECTED")
        self.outcome(second,"ACCEPTED" if precursor_valid else "REJECTED")
        audit = self.audit()
        self.active["observations"]["audit"] = audit
        if precursor_valid:
            state=self.lane()
            self.check("same original deadline uses new deadline",state["highestAmount"]==11000 and state["deadlineMs"]==15000,state)
            self.ok(self.primary.post("/admin/tick",{"lane":1,"nowMs":10000}))
            self.check("old timer cannot close extended auction",self.lane()["result"] is None,self.lane())
        else:
            self.check("invalid precursor produced no accepted bid", all(r["outcome"]!="ACCEPTED" for r in audit["requests"] if r["kind"]=="BID"),audit["requests"])

    def opening(self, time_ms):
        self.reset(prepMs=5000)
        self.clock(time_ms)
        body=self.body("opening-member","opening")
        self.bid(body)
        self.process(now=max(5100,time_ms))
        self.outcome(body,"ACCEPTED" if time_ms>=5000 else "REJECTED")
        state=self.lane()
        if time_ms>=5000:
            self.check("late open callback does not change receipt deadline",state["deadlineMs"]==time_ms+5000,state,time_ms+5000)
        self.active["observations"]["audit"]=self.audit()

    def late_decision(self):
        self.reset()
        self.clock(9900)
        body=self.body("late-member","late")
        self.bid(body)
        self.clock(16000)
        self.process(now=16000)
        self.outcome(body,"ACCEPTED")
        state=self.lane()
        self.check("long decision delay retains receipt deadline",state["deadlineMs"]==14900,state,14900)
        self.check("long decision delay holds result",state["held"] and state["result"] is None,state)

    def delayed_timer(self):
        self.reset(itemsPerLane=1)
        self.clock(9900)
        body=self.body("timer-member","timer")
        self.bid(body)
        self.process(now=9900)
        self.clock(16000)
        self.ok(self.primary.post("/admin/tick",{"lane":1,"nowMs":16000}))
        state=self.lane()
        auction=self.audit()["auctions"][0]
        self.check("late timer alone permits normal result",auction["result"]=="SOLD" and not state["held"],{"lane":state,"auction":auction})

    def bid_control(self,kind,control_first):
        self.reset()
        body=self.body("bidder","ordered-bid")
        if control_first:
            command=self.control(kind,"ordered-control")
            self.bid(body,self.peer)
        else:
            self.bid(body)
            command=self.control(kind,"ordered-control",api=self.peer)
        self.process()
        self.outcome(body,"REJECTED" if control_first else "ACCEPTED")
        self.outcome(command,"ACCEPTED")
        self.active["observations"]["audit"]=self.audit()

    def duplicate(self,accepted=True):
        self.reset()
        body=self.body("repeat-member","duplicate",10000 if accepted else 9000)
        self.ok(self.intent(body))
        observations=parallel([lambda i=i:self.submit(body,self.apis[i%len(self.apis)]) for i in range(20)])
        for observation in observations:self.ok(observation)
        self.process()
        original=self.outcome(body,"ACCEPTED" if accepted else "REJECTED")
        before=self.lane()
        self.clock(20000)
        duplicates=parallel([lambda i=i:self.submit(body,self.apis[i%len(self.apis)]) for i in range(20)])
        for response in duplicates:
            record=self.ok(response)
            self.check("retransmission returns immutable original decision",record["seq"]==original["seq"] and record["receivedMs"]==original["receivedMs"] and record["outcome"]==original["outcome"],record,original)
        after=self.lane()
        self.check("retransmission has no state effect",before["version"]==after["version"] and before["deadlineMs"]==after["deadlineMs"],after,before)
        requests=self.audit()["requests"]
        self.check("one persisted request identity",len([r for r in requests if r["actor"]==body["actor"] and r["key"]==body["key"]])==1,requests)

    def shared_intent(self):
        self.reset()
        first=self.body("shared-member","device-a")
        second=self.body("shared-member","device-b")
        results=parallel([lambda:self.intent(first),lambda:self.intent(second,self.peer)])
        bodies=[self.ok(response) for response in results]
        self.check("one pending shared intent across processes",sorted(b["status"] for b in bodies)==["CONFLICT_PENDING","REGISTERED"],bodies)
        chosen=first if bodies[0]["status"]=="REGISTERED" else second
        rejected=second if chosen is first else first
        self.ok(self.submit(chosen,self.peer))
        self.process()
        self.outcome(chosen,"ACCEPTED")
        blocked=self.ok(self.intent(rejected))
        self.check("final outcome does not itself release pending intent",blocked["status"]=="CONFLICT_PENDING",blocked)
        self.ok(self.primary.post("/ack",{"actor":chosen["actor"],"key":chosen["key"]}))
        changed=dict(rejected,amount=11000)
        registered=self.ok(self.intent(changed,self.peer))
        self.check("one device acknowledgement permits next intent",registered["status"]=="REGISTERED",registered)
        self.ok(self.primary.post("/ack",{"actor":chosen["actor"],"key":chosen["key"]}))
        third=self.body("shared-member","device-c",11000)
        conflict=self.ok(self.intent(third))
        self.check("old acknowledgement cannot clear new intent",conflict["status"]=="CONFLICT_PENDING",conflict)
        changed_key=dict(chosen,amount=12000)
        content=self.intent(changed_key)
        self.check("same key content conflict preserves old record",content.status in (200,409) and isinstance(content.body,dict) and "CONFLICT" in str(content.body),content.body)
        self.outcome(chosen,"ACCEPTED")
        other=self.ok(self.intent(self.body("shared-member","other-lane",lane=2)))
        self.check("pending restriction scoped to member and auction",other["status"]=="REGISTERED",other)

    def no_backdating(self):
        self.reset(itemsPerLane=1)
        self.clock(8000)
        body=self.body("late-arrival","registration-is-not-receipt")
        self.ok(self.intent(body))
        self.clock(12000)
        self.ok(self.submit(body,self.peer))
        self.process(now=12000)
        original=self.outcome(body,"REJECTED")
        self.check("first official submission has actual receipt time",original["receivedMs"]==12000,original,12000)

    def commit_exception(self,point):
        self.reset()
        body=self.body("fault-member",f"throw-{point}")
        self.ok(self.intent(body))
        self.arm(point,"throw",body["key"])
        if "receipt" in point:
            response=self.submit(body)
        else:
            self.ok(self.submit(body))
            response=self.primary.post("/admin/process",{"lane":1,"nowMs":1000,"max":100})
        self.active["observations"]["injectedResponse"]={"status":response.status,"body":response.body,"error":response.error}
        self.check("injected operation interrupted",response.status>=400 or response.error is not None,response.body)
        self.ok(self.primary.post("/admin/fault/release"))
        self.ok(self.submit(body,self.peer))
        self.process(api=self.peer)
        original=self.outcome(body,"ACCEPTED")
        state=self.lane()
        self.check("retry resolves exactly one accepted effect",state["highestAmount"]==10000 and state["deadlineMs"]==6000,state)
        requests=self.audit()["requests"]
        self.check("one request after injected transactional failure",len(requests)==1,requests)
        self.active["observations"]["original"]=original
        self.active["observations"]["audit"]=self.audit()

    def recovery(self):
        self.reset(itemsPerLane=1)
        first=self.body("confirmed-member","confirmed")
        self.bid(first)
        self.process()
        original=self.request(first)
        command=self.control("STOP","manual-stop",lane=2)
        self.process(lane=2)
        self.ok(self.primary.post("/admin/recover",{"lanes":[1,2,3,4],"reason":"synthetic whole-service outage","historyComplete":True,"nowMs":2000}))
        states=self.lanes()
        self.check("all unfinished lanes held for whole-service outage",all(s["held"] for s in states),states)
        self.check("manual stop survives fault hold",self.lane(2)["manualStopped"],self.lane(2))
        self.ok(self.primary.post("/admin/confirm",{"lane":2}))
        self.check("recovery confirmation does not itself resume manual stop",self.lane(2)["manualStopped"] and self.lane(2)["held"],self.lane(2))
        self.clock(50000)
        for lane in range(1,5):self.ok(self.primary.post("/admin/tick",{"lane":lane,"nowMs":50000}))
        self.check("held lanes do not auto-finalize on elapsed deadline",all(s["result"] is None for s in self.lanes()),self.lanes())
        again=self.request(first)
        self.check("recovery preserves original accepted decision",again["outcome"]==original["outcome"] and again["seq"]==original["seq"],again,original)
        self.active["observations"]["audit"]=self.audit()

    def stop_resume(self):
        self.reset()
        stop=self.control("STOP","stop-one")
        self.process()
        stop_id=self.lane()["stopId"]
        self.clock(20000)
        resume=self.control("RESUME","resume-one",stop=stop_id)
        self.process(now=20800)
        original=self.outcome(resume,"ACCEPTED")
        state=self.lane()
        self.check("resume grants full stage from actual transition",state["deadlineMs"]==30800,state,30800)
        self.clock(21000)
        self.control("STOP","stop-two")
        self.process(now=21000)
        second=self.lane()
        duplicate=self.ok(self.primary.post("/commands",resume))
        self.check("old resume returns original result",duplicate["outcome"]==original["outcome"] and duplicate["seq"]==original["seq"],duplicate,original)
        self.check("old resume cannot clear new stop",self.lane()["stopId"]==second["stopId"] and self.lane()["manualStopped"],self.lane(),second)
        stale=self.control("RESUME","first-arrival-stale-resume",stop=stop_id)
        self.process(now=22000)
        self.outcome(stale,"REJECTED")
        self.check("unreceived stale resume cannot clear new stop",self.lane()["manualStopped"],self.lane())

    def before_actual_resume(self):
        self.reset()
        self.control("STOP","stop")
        self.process()
        self.clock(20000)
        self.control("RESUME","resume",stop=self.lane()["stopId"])
        self.clock(20100)
        body=self.body("early-member","between-receipt-and-resume")
        self.bid(body)
        self.process(now=20800)
        self.outcome(body,"REJECTED")
        self.check("resume actual lower bound retained",self.lane()["windowStartMs"]==20800,self.lane(),20800)

    def event_merge(self):
        self.reset()
        baseline=self.lanes()
        view=VersionedView()
        view.snapshot(baseline)
        for i in range(3):
            self.clock(1000+i*100)
            self.bid(self.body(f"event-member-{i}",f"event-{i}",10000+i*1000))
            self.process(now=1000+i*100)
        current=self.lanes()
        audit=self.audit()
        events=self.ok(self.primary.get("/admin/events?lane=1&afterVersion=0&limit=10000"))
        self.check("committed changes have outbox rows",len(events)>=3,events)
        observed=[e for e in events if e["version"]>baseline[0]["version"]]
        self.check("outbox contains newer lane versions",len(observed)>=3,observed)
        for event in reversed(observed):view.event(event)
        for event in observed: view.event(event);view.event(event)
        view.snapshot(current)
        before=dict(view.lanes[1])
        for event in reversed(observed):view.event(event)
        self.check("event duplicates and inversion cannot regress snapshot",view.lanes[1]==before,view.lanes[1],before)
        self.check("snapshot converges every lane independently",all(view.lanes[int(s["lane"])]==s for s in current),view.lanes,current)
        # Simulate the otherwise undetectable final notification loss. Explicit
        # authoritative version checking, not an event arrival, repairs it.
        old=VersionedView();old.snapshot(baseline)
        self.check("last-event loss leaves stale version before reconciliation",old.lanes[1]["version"]<current[0]["version"],old.lanes[1])
        old.snapshot(self.lanes())
        self.check("periodic authoritative snapshot repairs final loss",old.lanes[1]["version"]==current[0]["version"],old.lanes[1],current[0])
        self.active["observations"].update({"realOutboxEvents":events,"ignoredDuplicates":view.ignored,"detectedGaps":view.gaps,"scope":"HTTP state + actual DB outbox + independent client merge; browser and SSE transport excluded"})

    def known_pending_recovery(self):
        self.reset(prepMs=500)
        self.clock(1000)
        body=self.body("pending-member","known-pending")
        self.bid(body)
        self.ok(self.primary.post("/admin/recover",{"lanes":[1],"reason":"synthetic known-complete history","historyComplete":True,"nowMs":2000}))
        self.process(now=2500)
        original=self.outcome(body,"ACCEPTED")
        state=self.lane()
        self.check("known pre-fault pending receipt preserves original time",original["receivedMs"]==1000 and state["deadlineMs"]==6000,original)
        self.check("historic processing preserves fault hold",state["held"] and state["result"] is None,state)
        self.check("single lane fault does not hold other lanes",all(not s["held"] for s in self.lanes() if s["lane"]!=1),self.lanes())

    def unknown_history(self):
        self.reset()
        body=self.body("unknown-member","unknown-effect")
        self.bid(body)
        self.ok(self.primary.post("/admin/recover",{"lanes":[1],"reason":"synthetic unknown authoritative effect","historyComplete":False,"nowMs":2000}))
        self.process(now=2500)
        self.outcome(body,"PENDING")
        confirm=self.ok(self.primary.post("/admin/confirm",{"lane":1}))
        self.check("unknown history cannot be confirmed",confirm.get("status")=="HISTORY_UNKNOWN",confirm)
        state=self.lane()
        self.check("unknown history does not fabricate final rejection",state["held"] and not state["historyComplete"] and not state["hasBid"],state)

    def clock_regression(self):
        self.reset()
        first=self.body("clock-a","clock-first")
        self.bid(first)
        self.process()
        self.clock(900)
        second=self.body("clock-b","clock-regressed",11000)
        self.bid(second,self.peer)
        self.process(now=1100)
        self.outcome(second,"PENDING")
        state=self.lane()
        self.check("clock regression preserves evidence and holds rather than guessing",state["held"] and not state["historyComplete"] and state["highestAmount"]==10000,state)

    def outbox_late_commit(self):
        self.reset()
        baseline=self.ok(self.primary.get("/admin/events?lane=1&afterVersion=0&limit=10000"))
        baseline_version=max(e["version"] for e in baseline)
        first=self.body("late-outbox-one","late-outbox-one")
        self.bid(first)
        self.arm("before_decision_commit",key=first["key"])
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending=pool.submit(self.primary.post,"/admin/process",{"lane":1,"nowMs":1000,"max":1})
            self.wait_hook()
            second=self.body("early-outbox-two","early-outbox-two",lane=2)
            self.bid(second,self.peer)
            self.process(lane=2,api=self.peer)
            committed_second=self.ok(self.peer.get("/admin/events?lane=2&afterVersion=0&limit=10000"))[-1]
            invisible=self.ok(self.peer.get(f"/admin/events?lane=1&afterVersion={baseline_version}&limit=10000"))
            self.check("uncommitted lane 1 event is invisible",len(invisible)==0,invisible)
            self.ok(self.primary.post("/admin/fault/release"))
            self.ok(pending.result(timeout=20))
        late=self.ok(self.peer.get(f"/admin/events?lane=1&afterVersion={baseline_version}&limit=10000"))
        self.check("lane version cursor finds lower global id after late commit",len(late)==1 and late[0]["id"]<committed_second["id"],{"late":late,"earlierCommitted":committed_second})
        self.active["observations"]["counterexampleToGlobalCursor"]={"globalCursorAfterLane2":committed_second["id"],"laterVisibleLane1Event":late[0],"wouldGlobalIdGreaterThanCursorMissIt":late[0]["id"]<committed_second["id"]}

    def finish(self):
        failures=[case for case in self.cases if case["status"]!="PASS"]
        summary={"runId":self.run_id,"generatedUtc":dt.datetime.now(dt.timezone.utc).isoformat(),
                 "command":[sys.executable,*sys.argv],"python":sys.version,"platform":platform.platform(),"seed":self.seed,
                 "seedUsage":"Scenario label only: fixtures are deterministic; OS thread scheduling and network arrival order are not seeded.",
                 "serverJarAtInvocationSha256":self.jar_hash,
                 "serverUrls":self.args.urls,"caseCount":len(self.cases),"passed":len(self.cases)-len(failures),
                 "failed":len(failures),"status":"PASS" if self.cases and not failures else "FAIL",
                 "failedCases":[{"name":case["name"],"repetition":case["repetition"],"error":case.get("error")} for case in failures],
                 "boundaries":{"fixtureClock":"synthetic epoch milliseconds","httpDuration":"monotonic client clock", "loadOrBrowserPerformance":"NOT_RUN by this correctness command","processTermination":self.process_termination_scope, "database":"service integration; DB runtime version and durability captured by outer orchestration"},
                 "sourceHashes":{path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in Path(__file__).parent.glob("*.py")}}
        (self.directory/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
        for api in self.apis:api.close_all()
        print(json.dumps({"directory":str(self.directory),**{k:summary[k] for k in ("caseCount","passed","failed","status")}},ensure_ascii=False),flush=True)
        return 0 if summary["status"]=="PASS" else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls",nargs="+",default=["http://127.0.0.1:18081","http://127.0.0.1:18082"])
    parser.add_argument("--output",default=str(Path(__file__).resolve().parents[1]/"results"/"correctness"))
    parser.add_argument("--repeats",type=int,default=100,help="E1 concurrent/inversion repetitions per scenario")
    parser.add_argument("--failure-repeats",type=int,default=10,help="E2/E3 failure and recovery repetitions per scenario")
    parser.add_argument("--seed",type=int,default=20261015)
    parser.add_argument("--only",help="regular expression for case names")
    args=parser.parse_args()
    suite=Suite(args)
    for repetition in range(1,args.repeats+1):
        suite.case("E1_same_price_20",repetition,suite.same_price)
        suite.case("E1_processing_inversion_and_lane_independence",repetition,suite.decision_order)
    for repetition in range(1,args.failure_repeats+1):
        suite.case("E1_receipt_commit_deadline_gap",repetition,suite.receipt_gap)
        suite.case("E1_boundary_valid_precursor",repetition,lambda:suite.boundary(True))
        suite.case("E1_boundary_invalid_precursor",repetition,lambda:suite.boundary(False))
        for boundary in (4990,5000,5010):suite.case(f"E1_opening_{boundary}",repetition,lambda b=boundary:suite.opening(b))
        suite.case("E1_long_decision_delay",repetition,suite.late_decision)
        suite.case("E1_timer_callback_delay",repetition,suite.delayed_timer)
        for kind in ("STOP","CANCEL"):
            for control_first in (True,False):suite.case(f"E1_bid_{kind}_control_first_{control_first}",repetition,lambda k=kind,c=control_first:suite.bid_control(k,c))
        suite.case("E2_duplicate_original_accept",repetition,lambda:suite.duplicate(True))
        suite.case("E2_duplicate_original_reject",repetition,lambda:suite.duplicate(False))
        suite.case("E2_shared_intent_and_old_ack",repetition,suite.shared_intent)
        suite.case("E2_registration_not_receipt",repetition,suite.no_backdating)
        for point in ("before_receipt_commit","after_receipt_commit","before_decision_commit","after_decision_commit"):
            suite.case(f"E2_exception_{point}",repetition,lambda p=point:suite.commit_exception(p))
        suite.case("E2_recovery_hold",repetition,suite.recovery)
        suite.case("E2_resume_identity",repetition,suite.stop_resume)
        suite.case("E2_bid_before_actual_resume",repetition,suite.before_actual_resume)
        suite.case("E2_known_pending_recovery",repetition,suite.known_pending_recovery)
        suite.case("E2_unknown_history_hold",repetition,suite.unknown_history)
        suite.case("E2_clock_regression_hold",repetition,suite.clock_regression)
        suite.case("E3_outbox_reorder_duplicate_and_snapshot",repetition,suite.event_merge)
        suite.case("E3_lower_global_id_late_commit",repetition,suite.outbox_late_commit)
    return suite.finish()


if __name__=="__main__":
    raise SystemExit(main())

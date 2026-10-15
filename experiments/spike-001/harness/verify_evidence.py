"""Replay independent persisted invariants from captured HTTP audit responses.

This is offline evidence verification, not an additional service execution.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path


def validate(audit):
    problems=[]
    requests=audit["requests"]
    bids=audit["bids"]
    request_by_key={(r["actor"],r["key"]):r for r in requests}
    accepted={(r["actor"],r["key"]):r for r in requests if r["kind"]=="BID" and r["outcome"]=="ACCEPTED"}
    persisted={(b["actor"],b["request_key"]):b for b in bids}
    if len(request_by_key)!=len(requests):problems.append("duplicate member/request identity")
    if len({r["seq"] for r in requests})!=len(requests):problems.append("duplicate official lane sequence")
    if len(persisted)!=len(bids):problems.append("duplicate accepted bid effect")
    if accepted.keys()!=persisted.keys():problems.append("accepted requests and bid effects differ")
    for key,bid in persisted.items():
        r=accepted.get(key)
        if r is None:continue
        if (r["amount"],r["seq"],r["receivedMs"],r["auction"])!=(bid["amount"],bid["seq"],bid["received_ms"],bid["auction"]):
            problems.append("accepted bid differs from its immutable request")
    for request in requests:
        if request["outcome"]=="PENDING":continue
        decision=request["result"]
        if (decision["outcome"],decision["seq"],decision["receivedMs"],decision["decidedMs"])!=(request["outcome"],request["seq"],request["receivedMs"],request["decidedMs"]):
            problems.append("stored original decision differs from request")
    for auction in audit["auctions"]:
        history=sorted([b for b in bids if b["auction"]==auction["auction"]],key=lambda b:b["seq"])
        prior_actor=None
        expected=auction["start_price"]
        for bid in history:
            if bid["amount"]!=expected:problems.append("accepted amount is not exact fixed step")
            if bid["actor"]==prior_actor:problems.append("same current highest member bid again")
            if bid["actor"]==auction["seller"]:problems.append("seller accepted own item")
            expected+=auction["increment"]
            prior_actor=bid["actor"]
        if history:
            latest=history[-1]
            if (auction["highest_amount"],auction["highest_bidder"])!=(latest["amount"],latest["actor"]):
                problems.append("persisted highest price/member do not identify last accepted bid")
        elif auction["highest_amount"] is not None or auction["highest_bidder"] is not None:
            problems.append("highest bid exists without accepted history")
        if auction["result"]=="SOLD" and (not history or auction["highest_amount"]<auction["reserve"]):
            problems.append("sold result violates reserve/accepted history")
        if auction["result"]=="UNSOLD" and history and auction["highest_amount"]>=auction["reserve"]:
            problems.append("unsold result contradicts reserve")
    pending=[(i["actor"],i["auction"]) for i in audit["intents"] if not i["acknowledged"]]
    if len(pending)!=len(set(pending)):problems.append("multiple pending intents per member/auction")
    versions=sorted(event["version"] for event in audit["outbox"])
    if versions!=list(range(1,audit["lane"]["version"]+1)):
        problems.append("committed lane versions and durable outbox versions differ")
    return problems


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("runs",nargs="+",type=Path)
    args=parser.parse_args()
    status=0
    for run in args.runs:
        count,requests,bids=0,0,0
        failures=[]
        for line in (run/"http-trace.jsonl").read_text(encoding="utf-8").splitlines():
            record=json.loads(line)
            if record.get("status")!=200 or not record.get("path","").startswith("/admin/audit?"):continue
            audit=record["response"]
            count+=1
            requests+=len(audit["requests"])
            bids+=len(audit["bids"])
            problems=validate(audit)
            if problems:failures.append({"traceSequence":record["traceSequence"],"problems":problems})
        result={"type":"OFFLINE_AUDIT_INVARIANT_VERIFICATION","generatedUtc":dt.datetime.now(dt.timezone.utc).isoformat(),
                "sourceRun":run.name,"status":"PASS" if count>0 and not failures else "FAIL","auditObservations":count,
                "requestRowsAcrossObservations":requests,"bidRowsAcrossObservations":bids,"failures":failures,
                "countBoundary":"row counts include repeated observations; not unique requests or new service executions"}
        (run/"audit-invariants.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
        print(json.dumps(result),flush=True)
        if result["status"]!="PASS":status=1
    return status


if __name__=="__main__":raise SystemExit(main())

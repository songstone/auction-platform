"""Offline-only load evidence summary. Never opens HTTP or database connections.

Example (from repository root):
  python experiments/spike-001/harness/summarize_load.py RUN_DIR ... \
    --resources experiments/spike-001/results/resources/RUN/samples.jsonl \
    --output experiments/spike-001/results/load-analysis.json
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path


def read(path: Path, lines=False):
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    if lines:
        data = []
        for index, line in enumerate(text.splitlines()):
            if line.strip():
                try:
                    data.append(json.loads(line))
                except json.JSONDecodeError as error:
                    raise ValueError(f"Incomplete/invalid JSONL at {path}:{index + 1}; retry after writer finishes") from error
    else:
        data = json.loads(text)
    return data, {"path": str(path.resolve()), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def distribution(values):
    values = sorted(float(v) for v in values if isinstance(v, (int, float)) and math.isfinite(v))
    def percentile(q):
        return values[max(0, math.ceil(len(values) * q) - 1)] if values else None
    return {"status": "MEASURED" if values else "NOT_MEASURED", "n": len(values), "p50": percentile(.5), "p95": percentile(.95), "p99": percentile(.99), "max": values[-1] if values else None}


def counts(rows):
    complete = [r for r in rows if r.get("outcome") in ("ACCEPTED", "REJECTED")]
    decision_delays = []
    missing_decision_timestamps = []
    negative_decision_delays = []
    for row in complete:
        received, decided = row.get("receivedMs"), row.get("decidedMs")
        if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in (received, decided)):
            missing_decision_timestamps.append({"key": row.get("key"), "receivedMs": received, "decidedMs": decided})
            continue
        delay = decided - received
        decision_delays.append(delay)
        if delay < 0:
            negative_decision_delays.append({"key": row.get("key"), "receivedMs": received, "decidedMs": decided, "durationMs": delay})
    return {"attempts": len(rows), "completed": len(complete), "accepted": sum(r["outcome"] == "ACCEPTED" for r in complete),
            "rejected": sum(r["outcome"] == "REJECTED" for r in complete), "failures": len(rows) - len(complete),
            "outcomes": dict(Counter(r.get("outcome", "MISSING") for r in rows)), "codes": dict(Counter(r.get("code", "NONE") for r in rows)),
            "completedProtocolLatencyMs": distribution(r.get("elapsedMs") for r in complete),
            "receiptToDecisionMs": {**distribution(decision_delays), "boundary": "DB_RECORDED_decidedMs_MINUS_receivedMs; includes queue/decision wait to recorded decision time, excludes physical decision commit and client response/DOM",
                                    "missingTimestampCount": len(missing_decision_timestamps), "missingTimestamps": missing_decision_timestamps,
                                    "negativeDurationCount": len(negative_decision_delays), "negativeDurations": negative_decision_delays,
                                    "negativeValuesRetainedInDistribution": True},
            "launchDelayMs": distribution(r.get("launchDelayMs") for r in rows)}


def utc_ms(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000


def iso(value):
    return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat() if value is not None else None


def windows(summary, result, rows):
    estimates = [r["metrics"]["serverMs"] - r["elapsedMs"] for r in result.get("serverConnectionSamples", []) if isinstance(r.get("metrics", {}).get("serverMs"), (int, float))]
    start = estimates[0] if estimates else None
    warmup = summary.get("warmupMs", 0)
    duration = summary.get("measureMs", 0)
    receipts = [r["receivedMs"] for r in rows if isinstance(r.get("receivedMs"), (int, float))]
    measured_receipts = [r["receivedMs"] for r in rows if r.get("measurement") and isinstance(r.get("receivedMs"), (int, float))]
    def window(left, right):
        return {"startMs": left, "endMs": right, "startUtc": iso(left), "endUtc": iso(right)}
    return {"mapping": "ESTIMATED: first serverConnectionSample.metrics.serverMs - its pre-request elapsedMs; includes unmeasured metrics request transport delay. Later estimate spread is diagnostic, not a rigorous clock error bound.",
            "estimateCount": len(estimates), "startEstimateSpreadMs": max(estimates) - min(estimates) if estimates else None,
            "warmupAndMeasurement": window(start, start + warmup + duration) if start is not None else None,
            "measurement": window(start + warmup, start + warmup + duration) if start is not None else None,
            "observedReceiptExtent": window(min(receipts), max(receipts)) if receipts else None,
            "observedMeasuredReceiptExtent": window(min(measured_receipts), max(measured_receipts)) if measured_receipts else None}


def within(value, window):
    return isinstance(value, (int, float)) and window is not None and window["startMs"] <= value < window["endMs"]


def resource_summary(resources, window):
    if window is None:
        return {"status": "NOT_MAPPED_NO_SERVER_TIMING_SAMPLES"}
    result = {"scope": "COARSE_OBSERVED_SAMPLES_ONLY_NOT_CONTINUOUS_PEAKS", "interval": "[startMs,endMs)", "window": window, "jvm": {}}
    for port in ("18081", "18082"):
        samples = [r[port] for r in resources if within(r.get(port, {}).get("serverMs"), window)]
        samples.sort(key=lambda r: r["serverMs"])
        cpu = []
        for left, right in zip(samples, samples[1:]):
            elapsed = right["serverMs"] - left["serverMs"]
            delta = right.get("processCpuNs", 0) - left.get("processCpuNs", 0)
            if elapsed > 0 and delta >= 0:
                cpu.append(delta / (elapsed * 1_000_000) * 100)
        result["jvm"][port] = {"samples": len(samples), "heapUsedBytes": distribution(r.get("heapUsed") for r in samples),
                "liveThreads": distribution(r.get("liveThreads") for r in samples), "activeSseConnections": distribution(r.get("activeConnections") for r in samples),
                "cpuPercentOneLogicalCore": distribution(cpu), "cpuScope": "Delta process CPU time between retained samples; 100% means one logical core, not whole machine",
                "lastMetrics": samples[-1] if samples else None, "firstServerMs": samples[0]["serverMs"] if samples else None, "lastServerMs": samples[-1]["serverMs"] if samples else None}
    pg = [r["postgres"] for r in resources if within(r.get("postgres", {}).get("serverMs"), window)]
    pg.sort(key=lambda r: r["serverMs"])
    result["postgres"] = {"samples": len(pg), "lockWaiters": distribution(r.get("sessions", {}).get("lockWaiting") for r in pg),
            "activeSessions": distribution(r.get("sessions", {}).get("active") for r in pg),
            "pendingRequests": distribution(sum(l.get("pending", 0) for l in r.get("lanes", [])) for r in pg),
            "oldestPendingMs": distribution(max((l.get("oldest_pending_ms", 0) for l in r.get("lanes", [])), default=0) for r in pg),
            "unmarkedOutboxRows": distribution(r.get("outbox", {}).get("unmarked") for r in pg),
            "counterDeltasFirstToLastRetainedSample": {key: pg[-1]["database"].get(key, 0) - pg[0]["database"].get(key, 0) for key in ("xact_commit", "xact_rollback", "deadlocks", "blks_read", "blks_hit", "temp_bytes")} if len(pg) >= 2 else None}
    container = [r for r in resources if r.get("utc") and within(utc_ms(r["utc"]), window)]
    cpu = []
    for row in container:
        try:
            cpu.append(float(row.get("container", {}).get("CPUPerc", "").rstrip("%")))
        except (ValueError, AttributeError):
            pass
    result["container"] = {"samples": len(container), "cpuPercent": distribution(cpu), "lastObservation": container[-1].get("container") if container else None,
            "mapping": "Collector UTC at sample start, not exact docker observation timestamp; HTTP/SQL/docker reads are sequential",
            "collectorElapsedMs": distribution(r.get("samplingElapsedMs") for r in container)}
    return result


def raw_audit_checks(audits, rows):
    """Cross-check saved responses/effects without claiming to rerun JS policy replay."""
    checks = []
    for audit in audits:
        lane = audit["lane"]["lane"]
        requests = audit.get("requests", [])
        key = lambda row: (row.get("actor"), row.get("key", row.get("request_key")))
        saved = {key(r): r for r in requests}
        effects = Counter(key(b) for b in audit.get("bids", []))
        errors = []
        if len(saved) != len(requests):
            errors.append({"code": "DUPLICATE_ORIGINAL_REQUEST"})
        for r in requests:
            if r.get("kind") == "BID" and effects[key(r)] != int(r.get("outcome") == "ACCEPTED"):
                errors.append({"code": "EFFECT_COUNT", "key": r.get("key")})
            if r.get("outcome") == "PENDING":
                errors.append({"code": "PENDING_ORIGINAL", "key": r.get("key")})
        for bid_key in effects:
            if bid_key not in saved:
                errors.append({"code": "BID_WITHOUT_ORIGINAL_REQUEST", "key": bid_key[1]})
        for row in rows:
            if row.get("lane") != lane or row.get("outcome") not in ("ACCEPTED", "REJECTED"):
                continue
            original = saved.get(key(row))
            if original is None or any(original.get(f) != row.get(f) for f in ("outcome", "code", "seq", "receivedMs", "decidedMs", "amount", "auction")):
                errors.append({"code": "RESPONSE_NOT_DURABLE_ORIGINAL", "key": row.get("key")})
        checks.append({"lane": lane, "requests": len(requests), "bids": len(audit.get("bids", [])), "outboxRows": len(audit.get("outbox", [])), "passed": not errors, "errors": errors})
    return {"scope": "OFFLINE_ORIGINAL_RESPONSE_AND_BID_EFFECT_CROSSCHECK_ONLY", "lanes": checks, "passed": len(checks) == 4 and all(c["passed"] for c in checks)}


def summarize_run(directory, resources):
    summary, source = read(directory / "summary.json")
    rows, row_source = read(directory / "requests.jsonl", lines=True)
    report = {"runId": summary["runId"], "scenario": summary.get("scenario"), "connections": summary.get("connections"), "warmupMs": summary.get("warmupMs"), "measureMs": summary.get("measureMs"), "requestedRepetitions": summary.get("repetitions"),
              "finished": summary.get("finished"), "command": summary.get("command"), "scope": "PROTOCOL_INTENT_TO_FINAL_RESPONSE; excludes DOM/render latency and ack completion; no production capacity conclusion", "sources": [source, row_source], "repeats": []}
    condition_fields = ("passed", "fatal", "expectedTotalAttempts", "actualTotalAttempts", "expectedMeasuredAttempts", "measuredAttempts", "completed", "failures", "skippedScheduleSlots", "lateBeyondOneScheduleSlot", "minimumContinuousClientConnections", "minimumSampledServerConnections", "workerMode", "postMeasurementWorkerFrozenForExactAudit", "protocolResponseReferenceTarget", "conditionLimit", "extraMonitoringOverhead")
    for result in summary.get("results", []):
        repeat = result["repeat"]
        repeat_rows = [r for r in rows if r.get("repeat") == repeat]
        measured = [r for r in repeat_rows if r.get("measurement")]
        mapped = windows(summary, result, repeat_rows)
        entry = {"repeat": repeat, "conditions": {k: result[k] for k in condition_fields if k in result}, "allPhases": counts(repeat_rows), "measurement": counts(measured),
                 "perLaneMeasurement": {str(lane): counts([r for r in measured if r.get("lane") == lane]) for lane in range(1, 5)},
                 "policyValidationRecordedByLoad": result.get("policyValidation"), "windowMapping": mapped,
                 "resourcesMeasurement": resource_summary(resources, mapped["measurement"]), "resourcesWarmupAndMeasurement": resource_summary(resources, mapped["warmupAndMeasurement"]),
                 "summaryCountAgreement": len(measured) == result.get("measuredAttempts") and len(repeat_rows) == result.get("actualTotalAttempts"),
                 "recordedErrorCounts": {k: len(result.get(k, [])) for k in ("allPhaseFailures", "finalStateBehindTarget", "publicErrors", "streamErrors")}}
        audit_path = directory / f"audit-{repeat}.json"
        if audit_path.exists():
            audits, audit_source = read(audit_path)
            entry["auditSource"] = audit_source
            entry["rawAuditCrosscheck"] = raw_audit_checks(audits, repeat_rows)
        else:
            entry["rawAuditCrosscheck"] = {"passed": False, "status": "MISSING_AUDIT_ARTIFACT"}
        report["repeats"].append(entry)
    report["recordedLoadConditionsAllPassed"] = bool(report["repeats"]) and all(r["conditions"].get("passed") is True for r in report["repeats"])
    report["offlineCrosschecksAllPassed"] = bool(report["repeats"]) and all(r["summaryCountAgreement"] and r["rawAuditCrosscheck"]["passed"] for r in report["repeats"])
    report["allRequestedRepeatsFinished"] = summary.get("finished") is not None and len(report["repeats"]) == summary.get("repetitions")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dirs", type=Path, nargs="+")
    parser.add_argument("--resources", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    resources, resource_source = read(args.resources, lines=True)
    report = {"generatedUtc": datetime.now(timezone.utc).isoformat(), "mode": "OFFLINE_FILES_ONLY", "resourceSource": resource_source,
              "limitations": ["No live service, database or container access", "Existing JS policy results are reported, not rerun; Python independently cross-checks durable original responses and accepted bid effect counts", "Protocol p95 reference target is separate from the load harness correctness/condition PASS", "Resource observations are coarse samples and cannot establish true maximum queues, lock waits or CPU peaks", "Window timestamps are estimated from existing server/elapsed samples; resources near boundaries may be assigned to an adjacent phase"],
              "runs": [summarize_run(p, resources) for p in args.run_dirs]}
    text = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        print(json.dumps({"output": str(args.output.resolve()), "runs": [{"runId": r["runId"], "repeats": len(r["repeats"]), "recordedConditions": r["recordedLoadConditionsAllPassed"], "offlineCrosschecks": r["offlineCrosschecksAllPassed"], "finished": r["allRequestedRepeatsFinished"]} for r in report["runs"]]}))
    else:
        print(text, end="")
    return 0 if all(r["offlineCrosschecksAllPassed"] for r in report["runs"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())

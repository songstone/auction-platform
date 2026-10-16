"""Independent M-01 real HTTP expectations against the approved canonical schemas."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import runpy
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
COMMON = runpy.run_path(str(ROOT / "scripts/verify-public-round-contract.py"))
require = COMMON["require"]
Failure = COMMON["VerificationFailure"]
BIG = "1234567890123456789012345678901234567890"
RESERVED_ID = " QA/한글 +%?#= "
HIDDEN = ["demo-hidden", "discovery-hidden-no-fact", "discovery-hidden-cancelled",
          "discovery-hidden-scheduled", "discovery-hidden-recruiting"]


def expected_rounds() -> list[dict]:
    # Independent, explicit expected values; never import the product parser or cursor codec.
    common = {"recruitmentOpensAt": "2099-12-01T00:00:00Z", "publicationAt": "2099-12-31T15:00:00Z",
              "roundVersion": BIG, "actualStartedAt": None, "completedAt": None, "cancelledAt": None,
              "durations": {"preparationSeconds": 5, "initialBidSeconds": 10, "followupBidSeconds": 5},
              "durationsFrozen": False}
    result = [{**common, "roundId": "demo-round", "roundVersion": "9007199254740993", "status": "PUBLISHED",
               "recruitmentOpensAt": "2099-10-01T00:00:00Z", "publicationAt": "2099-10-14T15:00:00Z",
               "scheduledStartsAt": "2099-10-16T01:00:00Z", "laneCount": 4}]
    statuses = ["PUBLISHED", "WAITING", "ACTIVE", "COMPLETED", "CANCELLED"]
    for i in range(47):
        result.append({**common, "roundId": f"discovery-{i:03}", "status": statuses[i % 5], "laneCount": i % 4 + 1,
                       "scheduledStartsAt": "2100-01-02T01:00:00.12345" + ("6Z" if i < 42 else "7Z"),
                       "actualStartedAt": "2100-01-02T01:00:01.654321Z" if i % 5 in (2, 3) else None,
                       "completedAt": "2100-01-02T01:30:00.000001Z" if i % 5 == 3 else None,
                       "cancelledAt": "2100-01-01T00:00:00.000001Z" if i % 5 == 4 else None,
                       "durationsFrozen": i % 5 in (2, 3)})
    for identifier in [RESERVED_ID, " discovery-tie ", "DISCOVERY-TIE", "discovery-Tie", "한글-동률"]:
        result.append({**common, "roundId": identifier, "status": "PUBLISHED", "laneCount": 4,
                       "scheduledStartsAt": "2100-01-03T01:00:00.123456Z" if identifier == RESERVED_ID
                       else "2100-01-04T01:00:00.123456Z"})
    return result


def inspect(base: str, spec: dict, registry, name: str, path: str, expected_status: int,
            *, route: str = "/rounds", method: str = "GET", code: str | None = None) -> tuple[dict, dict]:
    status, headers, raw = COMMON["fetch_response"](base, path, method)
    require(status == expected_status, f"{name}: unexpected HTTP status {status}.")
    cache_tokens = [token.strip().lower() for value in headers.get_all("Cache-Control", []) for token in value.split(",")]
    require("no-store" in cache_tokens, f"{name}: no-store missing.")
    evidence = {"case": name, "status": "PASS", "method": method, "httpStatus": status,
                "responseSha256": hashlib.sha256(raw).hexdigest()}
    if method == "HEAD":
        require(not raw, "HEAD must have no body.")
        return evidence, {}
    require(headers.get_content_type() == "application/json", f"{name}: JSON content type missing.")
    payload = json.loads(raw.decode("utf-8"), object_pairs_hook=COMMON["unique_object"],
                         parse_constant=COMMON["reject_non_json_number"])
    # Protected surfaces intentionally remain default-deny; use the canonical Error403 schema.
    validation_route = "/me/lots" if status == 403 else route
    errors = list(COMMON["response_validator"](spec, registry, status, validation_route).iter_errors(payload))
    require(not errors, f"{name}: canonical response schema rejected the body.")
    require(bool(headers.get("X-Trace-Id")), f"{name}: trace header missing.")
    if code:
        require(payload["code"] == code, f"{name}: unexpected problem code.")
        require(payload["traceId"] == headers.get("X-Trace-Id"), f"{name}: trace mismatch.")
        evidence["code"] = code
    return evidence, payload


def verify(base: str, phase: str, output: Path, cursor_file: Path | None = None) -> int:
    report = {"scope": "ROUND_DISCOVERY_REAL_HTTP", "phase": phase, "status": "FAIL", "cases": [],
              "startedAt": COMMON["utc_now"](), "evidenceClass": "FUNCTIONAL_REAL_DB_HTTP"}
    try:
        spec, registry, digest = COMMON["load_contract"]()
        require(spec["paths"]["/rounds"]["get"]["operationId"] == "listPublicRounds", "Missing list operation.")
        report["contractSha256"] = digest

        def check(name, path="/api/v1/rounds", status=200, **kwargs):
            case, body = inspect(base, spec, registry, name, path, status, **kwargs)
            report["cases"].append(case)
            return body

        if phase in ("down", "unconfigured"):
            check("list-" + phase, status=503, code="SERVICE_UNAVAILABLE")
        elif phase in ("empty", "tail"):
            path = "/api/v1/rounds"
            if phase == "tail":
                require(cursor_file is not None, "Tail check requires a returned cursor artifact.")
                cursor = json.loads(cursor_file.read_text(encoding="utf-8"))["returnedCursor"]
                path += "?cursor=" + quote(cursor, safe="")
            require(check(phase + "-list", path) == {"items": [], "nextCursor": None}, "Empty list differs.")
        else:
            expected = expected_rounds()
            first_cursor = None
            for walk in range(2):
                cursor, rows, cursors, page_count = None, [], set(), 0
                while True:
                    path = "/api/v1/rounds" + ("?cursor=" + quote(cursor, safe="") if cursor is not None else "")
                    page = check(f"walk-{walk + 1}-page-{page_count + 1}", path)
                    rows.extend(page["items"])
                    page_count += 1
                    cursor = page["nextCursor"]
                    if first_cursor is None and cursor is not None:
                        first_cursor = cursor
                    if cursor is None:
                        break
                    require(cursor not in cursors and page_count < len(expected) + 1, "Cursor traversal did not progress.")
                    cursors.add(cursor)
                require(page_count > 1, "Synthetic rows did not cross a page boundary.")
                require(rows == expected, "Traversal omitted, duplicated, reordered or changed fixture values.")
                report["cases"].append({"case": f"walk-{walk + 1}-exact-values-and-order", "status": "PASS",
                                        "pages": page_count, "items": len(rows)})
            report["returnedCursor"] = first_cursor
            require(first_cursor is not None, "Expected an opaque continuation from server.")
            replay_path = "/api/v1/rounds?cursor=" + quote(first_cursor, safe="")
            require(check("returned-cursor-replay-1", replay_path) == check("returned-cursor-replay-2", replay_path),
                    "Unchanged cursor replay differs.")
            hidden_problems = []
            for identifier in HIDDEN + ["discovery-missing"]:
                problem = check("private-or-missing-" + identifier, "/api/v1/rounds/" + quote(identifier, safe=""), 404,
                                route="/rounds/{roundId}", code="RESOURCE_NOT_FOUND")
                hidden_problems.append({key: value for key, value in problem.items() if key not in {"traceId", "serverTime"}})
            require(all(problem == hidden_problems[-1] for problem in hidden_problems), "Hidden/missing public problems differ.")
            report["cases"].append({"case": "hidden-and-missing-indistinguishable", "status": "PASS"})
            for identifier in [RESERVED_ID, " discovery-tie ", "DISCOVERY-TIE", "discovery-Tie"]:
                body = check("exact-id-detail", "/api/v1/rounds/" + quote(identifier, safe=""), route="/rounds/{roundId}")
                require(body == next(row for row in expected if row["roundId"] == identifier), "Exact ID detail changed.")
            for index, invalid in enumerate(["", " ", "cursor_demo_3_8_1_1_1", "qa-do-not-log-cursor", "' OR 1=1 --"]):
                check(f"invalid-cursor-{index}", "/api/v1/rounds?cursor=" + quote(invalid, safe=""), 400, code="VALIDATION_FAILED")
            for path in ["/api/v1/rounds/", "/api/v1/rounds/demo-round/extra", "/api/v1/me/lots",
                         "/api/v1/operator/rounds", "/api/v1/auth/session", "/actuator/env"]:
                check("default-deny", path, 403, code="ROLE_REQUIRED")
            check("post-list-denied", status=403, method="POST", code="CSRF_INVALID")
            check("head-list-denied", status=403, method="HEAD")
        report["status"] = "PASS"
    except Exception as error:
        report["error"] = str(error) if isinstance(error, Failure) else "Verification failed: " + type(error).__name__
    report["completedAt"] = COMMON["utc_now"]()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"phase": phase, "status": report["status"], "cases": len(report["cases"])}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--phase", required=True, choices=("empty", "up", "tail", "down", "unconfigured"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cursor-file", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / ".artifacts"):
        parser.error("Output must stay inside repository .artifacts.")
    raise SystemExit(verify(COMMON["normalize_base_url"](args.base_url), args.phase, output, args.cursor_file))

"""Verify the public Round HTTP slice against the sealed, canonical OpenAPI document."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import runpy
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_URI = "urn:auction:openapi"
ROUTE = "/rounds/{roundId}"
MAX_RESPONSE_BYTES = 1024 * 1024


class VerificationFailure(Exception):
    """A fixed, non-sensitive explanation suitable for verification artifacts."""


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationFailure(message)


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        require(key not in result, "JSON contains duplicate object keys.")
        result[key] = value
    return result


def reject_non_json_number(value: str) -> None:
    raise VerificationFailure("JSON contains a non-finite number.")


def normalize_base_url(value: str) -> str:
    parsed = urlsplit(value)
    require(parsed.scheme in ("http", "https") and bool(parsed.hostname), "Base URL must be an HTTP(S) server root.")
    require(parsed.username is None and parsed.password is None, "Base URL must not contain credentials.")
    require(parsed.path in ("", "/") and not parsed.query and not parsed.fragment, "Base URL must be the server root, without an API path, query, or fragment.")
    return value.rstrip("/")


def load_contract() -> tuple[dict, Registry, str]:
    integrity = runpy.run_path(str(ROOT / "scripts/check-approved-baseline.py"))["check"](ROOT, strict_evidence=True)
    require(integrity["status"] == "PASS", "Approved baseline integrity check failed.")
    raw = (ROOT / "contracts/openapi.yaml").read_bytes()
    spec = yaml.safe_load(raw.decode("utf-8"))
    operation = spec["paths"][ROUTE]["get"]
    require(operation["operationId"] == "getPublicRound", "Expected public Round operation is missing.")
    require(operation["security"] == [] and operation["x-required-role"] == "PUBLIC", "Round operation must remain public.")
    registry = Registry().with_resource(CONTRACT_URI, Resource.from_contents(spec, default_specification=DRAFT202012))
    return spec, registry, hashlib.sha256(raw).hexdigest()


def response_validator(spec: dict, registry: Registry, status: int, route: str = ROUTE) -> Draft202012Validator:
    # Resolve only the response object. The schema itself remains a reference into
    # the canonical document, including the HTTP-status-specific code constraint.
    pointer = "#/paths/" + route.replace("~", "~0").replace("/", "~1") + "/get/responses/" + str(status)
    response = spec["paths"][route]["get"]["responses"][str(status)]
    while "$ref" in response:
        pointer = response["$ref"]
        require(pointer.startswith("#/"), "Response reference must belong to the canonical document.")
        response = spec
        for segment in pointer[2:].split("/"):
            response = response[segment.replace("~1", "/").replace("~0", "~")]
    require("application/json" in response["content"], "Expected JSON response media type is missing.")
    checker = FormatChecker()

    @checker.checks("date-time", raises=(TypeError, ValueError))
    def valid_datetime(value: object) -> bool:
        if not isinstance(value, str):
            return True  # The schema's type rule handles other JSON types.
        return datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is not None

    # UtcInstant's canonical pattern additionally enforces UTC and <= 6 digits.
    return Draft202012Validator(
        {"$ref": CONTRACT_URI + pointer + "/content/application~1json/schema"},
        registry=registry,
        format_checker=checker,
    )


def fetch_response(base_url: str, path: str, method: str = "GET") -> tuple[int, object, bytes]:
    # No CookieJar, Authorization, or session token is installed. Redirects must
    # remain visible; a redirect to login must never become a successful GET.
    opener = build_opener(ProxyHandler({}), NoRedirects())
    request = Request(base_url + path, headers={"Accept": "application/json"}, method=method)
    try:
        try:
            response = opener.open(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            require(len(raw) <= MAX_RESPONSE_BYTES, "Response exceeded the verification capture limit.")
            return response.status, response.headers, raw
    except (URLError, TimeoutError, OSError) as error:
        raise VerificationFailure("HTTP request failed (" + type(error).__name__ + ").") from None


def verify_case(base_url: str, spec: dict, registry: Registry, name: str, identifier: str,
                expected_status: int, expected_code: str | None = None) -> tuple[dict, dict | None]:
    path = "/api/v1/rounds/" + identifier
    result = {"case": name, "method": "GET", "path": path, "expectedStatus": expected_status, "status": "FAIL"}
    try:
        status, headers, raw = fetch_response(base_url, path)
        result["actualStatus"] = status
        result["responseSha256"] = hashlib.sha256(raw).hexdigest()
        require(status == expected_status, "Unexpected HTTP status.")
        require(headers.get_content_type() == "application/json", "Response Content-Type must be application/json.")
        cache_tokens = [token.strip().lower() for value in headers.get_all("Cache-Control", []) for token in value.split(",")]
        require("no-store" in cache_tokens, "Response must include Cache-Control: no-store.")
        try:
            payload = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object, parse_constant=reject_non_json_number)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise VerificationFailure("Response must be valid UTF-8 JSON.") from None
        errors = list(response_validator(spec, registry, expected_status).iter_errors(payload))
        if errors:
            # jsonschema's message/instance may contain submitted or secret data.
            rules = sorted({str(error.validator) for error in errors})
            raise VerificationFailure("Canonical response schema rejected the body; rules: " + ", ".join(rules) + ".")
        if expected_code is not None:
            require(payload["code"] == expected_code, "Unexpected contract error code.")
            result["code"] = expected_code
            if re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", payload["traceId"]):
                result["traceId"] = payload["traceId"]
        else:
            expected = {
                "roundId": "demo-round", "roundVersion": "9007199254740993", "status": "PUBLISHED",
                "recruitmentOpensAt": "2099-10-01T00:00:00Z", "publicationAt": "2099-10-14T15:00:00Z",
                "scheduledStartsAt": "2099-10-16T01:00:00Z", "actualStartedAt": None,
                "completedAt": None, "cancelledAt": None, "laneCount": 4,
                "durations": {"preparationSeconds": 5, "initialBidSeconds": 10, "followupBidSeconds": 5},
                "durationsFrozen": False,
            }
            require(payload == expected, "Published Round response did not preserve the agreed database fixture.")
            result["roundId"] = payload["roundId"]
            result["roundVersion"] = payload["roundVersion"]
        result["checks"] = ["anonymous-get", "http-status", "json-content-type", "no-store", "canonical-status-schema",
                            "error-code" if expected_code else "database-fixture-exact-values"]
        result["status"] = "PASS"
        return result, payload
    except VerificationFailure as error:
        result["error"] = str(error)
    except Exception as error:
        result["error"] = "Verifier failed (" + type(error).__name__ + "); response contents were not recorded."
    return result, None


def run_checks(base_url: str, phase: str, spec: dict, registry: Registry) -> list[dict]:
    if phase == "down":
        result, _ = verify_case(base_url, spec, registry, "database-unavailable", "demo-round", 503, "SERVICE_UNAVAILABLE")
        return [result]
    definitions = [
        ("published-round", "demo-round", 200, None),
        ("hidden-round", "demo-hidden", 404, "RESOURCE_NOT_FOUND"),
        ("missing-round", "demo-missing", 404, "RESOURCE_NOT_FOUND"),
        ("blank-round-id", "%20", 400, "VALIDATION_FAILED"),
    ]
    cases, payloads = [], {}
    for name, identifier, status, code in definitions:
        result, payload = verify_case(base_url, spec, registry, name, identifier, status, code)
        cases.append(result)
        payloads[name] = payload
    hidden, missing = payloads["hidden-round"], payloads["missing-round"]
    indistinguishable = {"case": "hidden-and-missing-have-identical-public-errors", "status": "FAIL"}
    if hidden is None or missing is None:
        indistinguishable["error"] = "Both 404 responses must first pass their individual checks."
    else:
        omit = {"traceId", "serverTime"}
        if {key: value for key, value in hidden.items() if key not in omit} == {key: value for key, value in missing.items() if key not in omit}:
            indistinguishable["status"] = "PASS"
            indistinguishable["checks"] = ["identical-code-message-fieldErrors", "per-request-trace-and-time-excluded"]
        else:
            indistinguishable["error"] = "Hidden and missing Round responses reveal different public error details."
    cases.append(indistinguishable)
    return cases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="HTTP(S) server root, without /api/v1.")
    parser.add_argument("--phase", required=True, choices=("up", "down"))
    parser.add_argument("--output", required=True, type=Path, help="JSON evidence path inside repository .artifacts.")
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / ".artifacts"):
        parser.error("Output must stay inside the repository .artifacts directory.")
    report = {"scope": "PUBLIC_ROUND_HTTP_CONTRACT", "phase": args.phase, "status": "FAIL", "startedAt": utc_now(), "cases": []}
    try:
        base_url = normalize_base_url(args.base_url)
        spec, registry, digest = load_contract()
        report["contract"] = {"path": "contracts/openapi.yaml", "sha256": digest,
                              "version": spec["info"]["version"], "operationId": "getPublicRound"}
        report["cases"] = run_checks(base_url, args.phase, spec, registry)
        if all(case["status"] == "PASS" for case in report["cases"]):
            report["status"] = "PASS"
    except VerificationFailure as error:
        report["error"] = str(error)
    except Exception as error:
        report["error"] = "Verifier setup failed (" + type(error).__name__ + "); sensitive details were not recorded."
    report["completedAt"] = utc_now()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"scope": report["scope"], "phase": args.phase, "status": report["status"],
                      "passed": sum(case["status"] == "PASS" for case in report["cases"]),
                      "total": len(report["cases"]), "output": output.relative_to(ROOT).as_posix()}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

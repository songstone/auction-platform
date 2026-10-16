"""Check the adopted contract without modifying it or its approval evidence."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

MANIFEST = "contracts/approved-baseline-0.1.0.json"
PINNED_MANIFEST_SHA256 = "1f3f6d5be1896304b5d72ede521717d6ff6440f7b10a84ff338e3bd6d3b2d795"


def check(root: Path, strict_evidence: bool = False) -> dict:
    root = root.resolve()
    failures: list[dict] = []
    evidence_changes: list[str] = []
    manifest_path = root / MANIFEST
    if not manifest_path.is_file():
        return {"scope": "APPROVED_BASELINE_INTEGRITY", "status": "FAIL", "failures": [{"path": MANIFEST, "reason": "MISSING"}]}
    if hashlib.sha256(manifest_path.read_bytes()).hexdigest() != PINNED_MANIFEST_SHA256:
        return {"scope": "APPROVED_BASELINE_INTEGRITY", "status": "FAIL", "failures": [{"path": MANIFEST, "reason": "APPROVAL_MANIFEST_CHANGED"}]}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if (manifest["status"], manifest["sealingState"], manifest["contractVersion"]) != ("USER_APPROVED", "SEALED", "0.1.0"):
        failures.append({"path": MANIFEST, "reason": "UNAPPROVED_BASELINE"})
    checked = 0
    for group in ("approvedFiles", "sourceFiles", "staticEvidenceFiles"):
        for entry in manifest[group]:
            path = (root / entry["path"]).resolve()
            if not path.is_relative_to(root):
                failures.append({"path": entry["path"], "reason": "OUTSIDE_REPOSITORY"})
                continue
            matches = path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"]
            checked += 1
            if not matches:
                if group == "staticEvidenceFiles" and not strict_evidence:
                    evidence_changes.append(entry["path"])
                else:
                    failures.append({"path": entry["path"], "reason": "MISSING_OR_CHANGED", "group": group})
    return {"scope": "APPROVED_BASELINE_INTEGRITY", "status": "FAIL" if failures else "PASS", "contractVersion": "0.1.0", "checkedFiles": checked, "failures": failures, "changedApprovalTimeEvidence": evidence_changes, "note": "Hash agreement only; no runtime correctness proof or protected-branch enforcement."}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--strict-evidence", action="store_true")
    args = parser.parse_args()
    result = check(args.repo, args.strict_evidence)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

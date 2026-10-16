"""Mutation checks for the approved-baseline gate; never write to approved source files."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("baseline_guard", ROOT / "scripts/check-approved-baseline.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class BaselineMutationChecks(unittest.TestCase):
    def setUp(self):
        if guard.check(ROOT, True)["status"] != "PASS":
            raise RuntimeError("Source baseline must pass before mutation checks copy its files.")
        self.temporary = tempfile.TemporaryDirectory(prefix="auction-baseline-mutation-")
        self.root = Path(self.temporary.name).resolve()
        if not self.root.is_relative_to(Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError("Unexpected temporary directory.")
        manifest = json.loads((ROOT / guard.MANIFEST).read_text(encoding="utf-8"))
        paths = [guard.MANIFEST] + [entry["path"] for group in ("approvedFiles", "sourceFiles", "staticEvidenceFiles") for entry in manifest[group]]
        for relative in paths:
            source = (ROOT / relative).resolve()
            target = (self.root / relative).resolve()
            if not source.is_relative_to(ROOT) or not target.is_relative_to(self.root):
                raise RuntimeError("Mutation check path escaped its allowed root.")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        self.manifest = manifest

    def tearDown(self):
        self.temporary.cleanup()

    def change(self, relative):
        with (self.root / relative).open("ab") as stream:
            stream.write(b"\nMUTATION_CHECK\n")

    def test_unchanged_copy_passes(self):
        self.assertEqual(guard.check(self.root, True)["status"], "PASS")

    def test_changed_contract_fails(self):
        self.change("contracts/openapi.yaml")
        self.assertEqual(guard.check(self.root)["status"], "FAIL")

    def test_changed_policy_source_fails(self):
        self.change(self.manifest["sourceFiles"][0]["path"])
        self.assertEqual(guard.check(self.root)["status"], "FAIL")

    def test_replacing_manifest_cannot_self_approve(self):
        self.change(guard.MANIFEST)
        self.assertEqual(guard.check(self.root)["failures"][0]["reason"], "APPROVAL_MANIFEST_CHANGED")

    def test_approval_evidence_is_distinct_from_contract_and_strictly_preserved(self):
        relative = self.manifest["staticEvidenceFiles"][0]["path"]
        self.change(relative)
        report = guard.check(self.root)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["changedApprovalTimeEvidence"], [relative])
        self.assertEqual(guard.check(self.root, True)["status"], "FAIL")


if __name__ == "__main__":
    unittest.main(verbosity=2)

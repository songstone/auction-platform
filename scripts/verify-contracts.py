"""Run the existing validator on byte-identical temporary copies, preserving approval files."""
from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(".artifacts/contracts/validation-report.json"))
    args = parser.parse_args()
    output = (root / args.output).resolve()
    if not output.is_relative_to(root) or not output.is_relative_to(root / ".artifacts"):
        parser.error("Output must stay inside the repository .artifacts directory.")
    subprocess.run([sys.executable, str(root / "scripts/check-approved-baseline.py"), "--strict-evidence"], check=True)
    for line in (root / "contracts/requirements-validation.txt").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            name, version = line.split("==")
            if importlib.metadata.version(name) != version:
                raise RuntimeError(f"Install pinned tools: python -m pip install -r contracts/requirements-validation.txt ({name})")
    with tempfile.TemporaryDirectory(prefix="auction-contracts-") as temporary:
        work = Path(temporary).resolve()
        if not work.is_relative_to(Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError("Unexpected temporary directory.")
        (work / "contracts").mkdir()
        for name in ("openapi.yaml", "validate_contracts.py"):
            shutil.copyfile(root / "contracts" / name, work / "contracts" / name)
        subprocess.run([sys.executable, "contracts/validate_contracts.py"], cwd=work, check=True)
        report = json.loads((work / "contracts/validation-report.json").read_text(encoding="utf-8"))
        report["execution"] = "Existing validator run on byte-identical temporary copies; approval-time report preserved."
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run([sys.executable, str(root / "scripts/check-approved-baseline.py"), "--strict-evidence"], check=True)
    print(json.dumps({"scope": "CONTRACT_STATIC_ONLY", "status": "PASS", "output": output.relative_to(root).as_posix()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

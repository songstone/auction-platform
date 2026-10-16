"""Probe launch isolation with nonfunctional synthetic settings; never opens a DB."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from verification_environment import blocked, isolated_environment

ROOT = Path(__file__).resolve().parents[1]
SENTINELS = {"SPRING_PROFILES_ACTIVE": "local-infra", "DB_URL": "jdbc:postgresql://verification.invalid:1/blocked",
             "DB_USER": "synthetic-probe", "DB_PASSWORD": "synthetic-probe", "server_port": "1",
             "management_port": "1", "mail_host": "verification.invalid", "photo_root": "synthetic-probe",
             "JAVA_TOOL_OPTIONS": "-Dverification.sentinel=true", "JDK_JAVA_OPTIONS": "-Dverification.sentinel=true",
             "_JAVA_OPTIONS": "-Dverification.sentinel=true", "JAVA_OPTS": "-Dverification.sentinel=true",
             "GRADLE_OPTS": "-Dverification.sentinel=true", "sPrInG_application_json": "{}"}
probe = "import os,json;print(json.dumps(dict(os.environ)))"
source = os.environ.copy() | SENTINELS | {"QA_TOOL_SENTINEL": "preserved"}
cleaned = isolated_environment(source)
result = subprocess.run([sys.executable, "-c", probe], env=cleaned, capture_output=True, text=True, check=True, timeout=15)
observed = json.loads(result.stdout)
assert not any(blocked(name) for name in observed), "Application/JVM settings reached isolated child"
assert observed["QA_TOOL_SENTINEL"] == "preserved"
for key in ("PATH", "JAVA_HOME", "DOCKER_HOST", "DOCKER_CONFIG", "TESTCONTAINERS_HOST_OVERRIDE"):
    if key in source:
        assert observed[key] == source[key], "Tool infrastructure setting changed"
assert all(name in source for name in SENTINELS), "Source environment was mutated"
report = {"scope": "VERIFICATION_ENVIRONMENT_ISOLATION", "pythonChild": "PASS",
          "powershellChild": "NOT_RUN: pwsh unavailable", "sentinelNames": sorted(SENTINELS), "databaseConnections": 0}
pwsh = shutil.which("pwsh")
if pwsh:
    # Read values only inside the synthetic probe process. Public output contains names/status only.
    script = """
    . ./scripts/verification-environment.ps1
    $saved = Clear-VerificationEnvironment
    $names = @(Get-ChildItem Env: | Select-Object -ExpandProperty Name)
    Restore-VerificationEnvironment $saved
    $restored = @($saved.Keys | Where-Object { (Get-Item -LiteralPath "Env:$_").Value -eq $saved[$_] })
    @{ remainingNames = $names; removedNames = @($saved.Keys); restoredCount = $restored.Count } | ConvertTo-Json -Compress
    """
    result = subprocess.run([pwsh, "-NoProfile", "-Command", script], cwd=ROOT, env=source,
                            capture_output=True, text=True, check=True, timeout=30)
    observed = json.loads(result.stdout)
    assert not any(blocked(name) for name in observed["remainingNames"]), "PowerShell inherited unsafe settings"
    assert observed["restoredCount"] == len(observed["removedNames"]), "PowerShell did not restore caller environment"
    report["powershellChild"] = "PASS"
print(json.dumps(report))

"""Run the public-round vertical slice against a disposable PostgreSQL database.

Requires Corretto 25, Docker, Node/npm, and contracts/requirements-validation.txt.
The default builds/tests both apps first. CI may supply built artifacts with --skip-build.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener
import uuid
import zipfile
from verification_environment import blocked, isolated_environment

import yaml

ROOT = Path(__file__).resolve().parents[1]
IS_WINDOWS = os.name == "nt"
HTTP = build_opener(ProxyHandler({}))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def run(command: list[str], *, cwd: Path = ROOT, env: dict | None = None,
        stdin: str | None = None, timeout: int = 600, log: Path | None = None) -> str:
    if env is None:
        env = isolated_environment(os.environ.copy())
    process = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
                               creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
                               start_new_session=not IS_WINDOWS)
    try:
        stdout, stderr = process.communicate(input=stdin, timeout=timeout)
    except subprocess.TimeoutExpired:
        stop(process)
        stdout, stderr = process.communicate(timeout=5)
        if log:
            log.write_text(stdout + stderr, encoding="utf-8")
        raise RuntimeError(f"{Path(command[0]).name} timed out; owned process tree was stopped") from None
    output = stdout + stderr
    if log:
        log.write_text(output, encoding="utf-8")
    if process.returncode:
        raise RuntimeError(f"{Path(command[0]).name} failed (exit {process.returncode}); "
                           + (f"see {log.relative_to(ROOT)}" if log else output[-1500:]))
    return stdout.strip()


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def get(url: str) -> tuple[int, str]:
    try:
        with HTTP.open(url, timeout=3) as response:
            return response.status, response.read().decode("utf-8")
    except HTTPError as error:
        return error.code, error.read().decode("utf-8")


def wait_http(url: str, process: subprocess.Popen, expected: int = 200) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("Application exited during startup; inspect process log")
        try:
            if get(url)[0] == expected:
                return
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(0.3)
    raise RuntimeError(f"Timed out waiting for local application on {url}")


def start(command: list[str], env: dict, log: Path, *, cwd: Path = ROOT) -> subprocess.Popen:
    with log.open("w", encoding="utf-8") as output:
        return subprocess.Popen(command, cwd=cwd, env=env, stdout=output,
                                stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
                                start_new_session=not IS_WINDOWS)


def stop(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    if IS_WINDOWS:
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=True)
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        if IS_WINDOWS:
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=5)


def dist_fingerprint() -> dict:
    root = ROOT / "frontend/dist"
    files = {path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in sorted(root.rglob("*")) if path.is_file()}
    return {"files": files, "sha256": hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()}


def browser_cases(report: dict) -> list[dict]:
    cases = []
    def visit(suite: dict) -> None:
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                cases.append({"file": spec["file"], "title": spec["title"], "project": test["projectName"],
                              "expectedStatus": test.get("expectedStatus"), "status": test.get("status"),
                              "results": [result["status"] for result in test.get("results", [])]})
        for child in suite.get("suites", []):
            visit(child)
    for suite in report.get("suites", []):
        visit(suite)
    return cases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", default=os.environ.get("AUCTION_JAVA_HOME") or os.environ.get("JAVA_HOME"))
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--install-browser", action="store_true", help="Install the lockfile's Chromium build")
    args = parser.parse_args()
    if not args.java_home:
        parser.error("Pass --java-home or set AUCTION_JAVA_HOME/JAVA_HOME to Corretto 25")
    java_home = Path(args.java_home).resolve()
    java = str(java_home / "bin" / ("java.exe" if IS_WINDOWS else "java"))
    if not Path(java).is_file():
        parser.error("Java executable not found")
    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if IS_WINDOWS else "npm")
    if not node or not npm or not shutil.which("docker"):
        parser.error("Node/npm and Docker are required")
    run_id = time.strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
    artifacts = ROOT / ".artifacts/integration" / run_id
    artifacts.mkdir(parents=True)
    summary: dict = {"scope": "M01_ROUND_DISCOVERY", "runId": run_id,
                     "status": "FAIL", "baseCommit": run(["git", "rev-parse", "HEAD"]), "checks": [],
                     "browserRuns": [], "httpRuns": [], "notRun": ["authentication_sessions", "bidding",
                     "official_receipt_order", "SSE", "performance_acceptance", "production_readiness"]}
    environment = isolated_environment(os.environ.copy())
    summary["environmentIsolation"] = {"removedNames": sorted(name for name in os.environ if blocked(name)),
                                       "valuesRecorded": False, "scope": "all child builds/tests/apps"}
    environment["JAVA_HOME"] = str(java_home)
    environment["PATH"] = str(java_home / "bin") + os.pathsep + environment["PATH"]
    backend = frontend = recovery_process = None
    processes = []
    password = None
    browser_directories = []
    volumes = []
    ports = []
    container = "auction-round-it-" + uuid.uuid4().hex[:12]
    container_created = False
    try:
        source_status = run(["git", "status", "--porcelain"])
        summary["sourceStatus"] = "CLEAN" if not source_status else "DIRTY"
        require(not source_status, "Commit the verification candidate before collecting final integration evidence")
        if os.environ.get("GITHUB_SHA"):
            require(os.environ["GITHUB_SHA"] == summary["baseCommit"], "CI checkout does not match workflow SHA")
        summary["environment"] = {"os": platform.platform(), "python": platform.python_version(),
                                  "node": run([node, "--version"]), "npm": run([npm, "--version"]),
                                  "docker": run(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=30),
                                  "viewports": [1280, 390], "databaseScope": "runner-owned disposable only"}
        version = subprocess.run([java, "-version"], env=environment, capture_output=True, text=True, check=True)
        java_description = version.stdout + version.stderr
        if 'version "25.' not in java_description or "Corretto" not in java_description:
            raise RuntimeError("Corretto 25 is required for the integration runtime")
        (artifacts / "java-version.log").write_text(java_description, encoding="utf-8")
        run(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=30)
        run([sys.executable, "scripts/check-approved-baseline.py", "--strict-evidence"], log=artifacts / "baseline.log")
        run([sys.executable, "scripts/test-verification-environment.py"], env=environment, log=artifacts / "environment-isolation.log")
        if not args.skip_build:
            gradle = [str(ROOT / "backend/gradlew.bat")] if IS_WINDOWS else ["bash", "./gradlew"]
            run(gradle + ["--no-daemon", "--console=plain", "clean", "build", "integrationTest"],
                cwd=ROOT / "backend", env=environment, log=artifacts / "backend-build.log")
            run([npm, "ci", "--no-fund", "--no-audit"], cwd=ROOT / "frontend", env=environment, log=artifacts / "npm-ci.log")
            run([npm, "test"], cwd=ROOT / "frontend", env=environment, log=artifacts / "frontend-test.log")
            run([npm, "run", "build"], cwd=ROOT / "frontend", env=environment, log=artifacts / "frontend-build.log")
        jar = ROOT / "backend/build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar"
        if not jar.is_file() or not (ROOT / "frontend/dist/index.html").is_file():
            raise RuntimeError("Build the backend and frontend before using --skip-build")
        summary["jarSha256"] = hashlib.sha256(jar.read_bytes()).hexdigest()
        summary["frontendDist"] = dist_fingerprint()
        summary["buildInput"] = ("same-workflow-artifacts" if os.environ.get("GITHUB_ACTIONS") else
                                 "prebuilt-artifacts-caller-responsibility" if args.skip_build else "built-in-this-run-from-clean-checkout")
        summary["environment"]["playwright"] = run([node, str(ROOT / "frontend/node_modules/playwright/cli.js"), "--version"])
        markers = [b"discovery-hidden-no-fact", b"discovery-000", b"QA/", b"DEV_CONTRACT_PREVIEW_ONLY"]
        with zipfile.ZipFile(jar) as archive:
            for name in archive.namelist():
                if name.startswith("BOOT-INF/classes/"):
                    require("fixtures/" not in name and not any(marker in archive.read(name) for marker in markers),
                            "Synthetic fixture found in backend artifact")
        for path in (ROOT / "frontend/dist").rglob("*"):
            if path.is_file():
                require(not any(marker in path.read_bytes() for marker in markers), "Synthetic fixture found in frontend artifact")
        summary["checks"].append("synthetic_fixtures_excluded_from_jar_and_dist")
        browser_cli = str(ROOT / "frontend/node_modules/playwright/cli.js")
        if args.install_browser:
            run([node, browser_cli, "install", "chromium"], log=artifacts / "browser-install.log")
        postgres_image = yaml.safe_load((ROOT / "infra/compose.yaml").read_text(encoding="utf-8"))["services"]["postgres"]["image"]
        password = secrets.token_urlsafe(32)
        docker_env = environment | {"POSTGRES_PASSWORD": password}
        # Keep the chosen mapping stable across docker stop/start. Docker-assigned
        # ephemeral bindings may change at restart, which would test a moved URL.
        selected_db_port = free_port()
        run(["docker", "create", "--name", container,
             "--label", "com.auctionplatform.purpose=round-integration",
             "--publish", f"127.0.0.1:{selected_db_port}:5432", "--env", "POSTGRES_PASSWORD",
             "--env", "POSTGRES_USER=auction_test", "--env", "POSTGRES_DB=auction_test", postgres_image],
            env=docker_env, log=artifacts / "postgres-create.log")
        container_created = True
        volumes = json.loads(run(["docker", "inspect", "--format", '{{json .Mounts}}', container]))
        volumes = [mount["Name"] for mount in volumes if mount["Type"] == "volume"]
        run(["docker", "start", container], log=artifacts / "postgres-start.log")

        def wait_database() -> None:
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                ready = subprocess.run(["docker", "exec", container, "pg_isready", "-U", "auction_test", "-d", "auction_test"], capture_output=True, timeout=5)
                if ready.returncode == 0:
                    return
                time.sleep(0.5)
            raise RuntimeError("Disposable PostgreSQL did not become ready")

        def sql(statement: str) -> str:
            return run(["docker", "exec", "-i", container, "psql", "-U", "auction_test", "-d", "auction_test",
                        "-v", "ON_ERROR_STOP=1", "-At"], stdin=statement, timeout=30)

        wait_database()
        binding = json.loads(run(["docker", "inspect", "--format", '{{json (index .NetworkSettings.Ports "5432/tcp")}}', container]))[0]
        db_port = int(binding["HostPort"])
        require(db_port == selected_db_port, "Disposable database port mapping changed")
        api_port, ui_port = free_port(), free_port()
        while ui_port == api_port:
            ui_port = free_port()
        api_url, ui_url = f"http://127.0.0.1:{api_port}", f"http://127.0.0.1:{ui_port}"
        ports = [api_port, ui_port]
        app_env = environment.copy()
        app_env.update(SERVER_ADDRESS="127.0.0.1", SERVER_PORT=str(api_port))

        def http_check(phase: str, label: str | None = None, cursor_file: Path | None = None) -> None:
            label = label or phase
            command = [sys.executable, "scripts/verify-round-discovery-contract.py", "--base-url", api_url,
                       "--phase", phase, "--output", str(artifacts / f"discovery-http-{label}.json")]
            if cursor_file:
                command += ["--cursor-file", str(cursor_file)]
            run(command, log=artifacts / f"discovery-http-{label}.log")
            report = json.loads((artifacts / f"discovery-http-{label}.json").read_text(encoding="utf-8"))
            summary["httpRuns"].append({"phase": phase, "label": label, "cases": len(report["cases"]),
                                        "status": report["status"], "artifact": f"discovery-http-{label}.json"})

        # This profile has no datasource; inherited external DB settings were removed above.
        backend = start([java, "-jar", str(jar)], app_env, artifacts / "backend-unconfigured.log")
        processes.append(("backend-unconfigured", backend))
        wait_http(api_url + "/actuator/health", backend)
        http_check("unconfigured")
        stop(backend)
        app_env.update(SPRING_PROFILES_ACTIVE="local-infra",
                       DB_URL=f"jdbc:postgresql://127.0.0.1:{db_port}/auction_test", DB_USER="auction_test", DB_PASSWORD=password,
                       DB_CONNECTION_TIMEOUT_MS="1000", DB_VALIDATION_TIMEOUT_MS="500")
        backend = start([java, "-jar", str(jar)], app_env, artifacts / "backend-first-start.log")
        processes.append(("backend-first", backend))
        wait_http(api_url + "/actuator/health", backend)
        require(sql("SELECT count(*) FROM auction.rounds;") == "0", "Migration must not inject example rounds")
        require(sql("SELECT count(*) FROM public.flyway_schema_history WHERE success;") == "1", "Expected one successful migration")
        http_check("empty")
        frontend = start([node, str(ROOT / "frontend/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1",
                          "--port", str(ui_port), "--strictPort"], app_env | {"AUCTION_API_TARGET": api_url},
                         artifacts / "frontend-preview.log", cwd=ROOT / "frontend")
        processes.append(("frontend", frontend))
        wait_http(ui_url, frontend)

        def browser_setup(phase: str, label: str | None = None) -> tuple[dict, Path]:
            label = label or phase
            directory = ROOT / "output/playwright/round-discovery" / run_id / label
            browser_directories.append(directory)
            browser_env = environment | {"E2E_BASE_URL": ui_url, "E2E_PHASE": phase, "E2E_ARTIFACT_DIR": str(directory)}
            collected = json.loads(run([node, browser_cli, "test", "--list", "--reporter=json"],
                                       cwd=ROOT / "frontend", env=browser_env, log=artifacts / f"browser-{label}-collection.json"))
            cases = browser_cases(collected)
            require(bool(cases), "Browser phase collected no cases")
            # New QA scenarios are an explicit test inventory, independent of historical smoke counts.
            expected_new_cases = {"empty": 2, "discovery": 2, "fault": 7, "recovery": 2}
            if phase in expected_new_cases:
                require(len(cases) == expected_new_cases[phase], "New QA scenario case inventory is incomplete")
            summary["browserRuns"].append({"phase": phase, "label": label, "collected": len(cases), "status": "NOT_RUN",
                                           "collectedCases": cases, "artifact": directory.relative_to(ROOT).as_posix(),
                                           "evidenceClass": "SYNTHETIC_HTTP_FAULT" if phase == "fault" else "BROWSER_INTEGRATION"})
            return browser_env, directory

        def browser_finished(directory: Path) -> None:
            report = json.loads((directory / "report.json").read_text(encoding="utf-8"))
            actual = browser_cases(report)
            record = next(item for item in summary["browserRuns"] if item["artifact"] == directory.relative_to(ROOT).as_posix())
            record.update(executedCases=actual, stats=report["stats"], status="FAIL")
            require([(item["file"], item["title"], item["project"]) for item in actual] ==
                    [(item["file"], item["title"], item["project"]) for item in record["collectedCases"]], "Collected/executed cases differ")
            require(not report.get("errors") and all(item["results"] == ["passed"] for item in actual), "Browser cases failed, skipped or retried")
            require(report["stats"]["skipped"] == 0 and report["stats"]["unexpected"] == 0
                    and report["stats"]["expected"] == len(actual), "Browser result counts do not match case inventory")
            record["status"] = "PASS"

        def browser(phase: str, label: str | None = None) -> None:
            browser_env, directory = browser_setup(phase, label)
            try:
                run([node, browser_cli, "test"], cwd=ROOT / "frontend", env=browser_env,
                    log=artifacts / f"browser-{label or phase}.log", timeout=240)
            finally:
                if (directory / "report.json").is_file():
                    browser_finished(directory)
            summary["checks"].append("browser_" + (label or phase))

        browser("empty")
        sql((ROOT / "infra/fixtures/public-rounds.sql").read_text(encoding="utf-8"))
        sql((ROOT / "infra/fixtures/public-rounds.sql").read_text(encoding="utf-8"))
        require(sql("SELECT count(*) FROM auction.rounds;") == "2", "Explicit seed must be repeatable")
        summary["checks"].append("empty_database_migration_and_explicit_repeatable_seed")
        stop(backend)
        backend = start([java, "-jar", str(jar)], app_env, artifacts / "backend-restart.log")
        processes.append(("backend-restart", backend))
        wait_http(api_url + "/actuator/health", backend)
        require(sql("SELECT count(*) FROM public.flyway_schema_history WHERE success;") == "1", "Restart must preserve migration history")
        require(sql("SELECT count(*) FROM auction.rounds;") == "2", "Restart must preserve seeded rows")
        summary["checks"].append("restart_preserves_migration_history_and_data")
        run([sys.executable, "scripts/verify-public-round-contract.py", "--base-url", api_url,
             "--phase", "up", "--output", str(artifacts / "http-up.json")], log=artifacts / "http-up.log")
        summary["checks"].append("approved_http_contract_up")
        browser("up")
        for _ in range(2):
            sql((ROOT / "infra/fixtures/round-discovery.sql").read_text(encoding="utf-8"))
        require(sql("SELECT count(*) FROM auction.rounds;") == "58", "Discovery seed must be explicit and repeatable")
        fingerprint_sql = "SELECT md5(string_agg(row_to_json(r)::text, '' ORDER BY round_id)) FROM auction.rounds r;"
        before = sql(fingerprint_sql)
        http_check("up")
        browser("discovery")
        browser("fault")
        require(sql(fingerprint_sql) == before, "Public traversal changed auction records")
        summary["checks"].append("public_reads_preserve_all_database_rows")
        (artifacts / "database-evidence.json").write_text(json.dumps({"rows": 58, "publicRows": 53,
            "beforeReadFingerprint": before, "afterReadFingerprint": sql(fingerprint_sql)}), encoding="utf-8")
        # Retain the returned opaque cursor while making its tail empty. No decoding or fabricated cursor.
        sql("TRUNCATE TABLE auction.rounds;")
        http_check("tail", cursor_file=artifacts / "discovery-http-up.json")
        sql((ROOT / "infra/fixtures/public-rounds.sql").read_text(encoding="utf-8"))
        sql((ROOT / "infra/fixtures/round-discovery.sql").read_text(encoding="utf-8"))
        require(sql(fingerprint_sql) == before, "Tail experiment did not restore its synthetic records")
        sql("UPDATE auction.rounds SET initial_bid_seconds=15, round_version=round_version+1 WHERE round_id='demo-round';")
        browser("changed")

        handshake = artifacts / "handshake"
        handshake.mkdir()
        recovery_env, recovery_output = browser_setup("recovery")
        recovery_process = start([node, browser_cli, "test"], recovery_env | {"E2E_HANDSHAKE_DIR": str(handshake)},
                                 artifacts / "browser-recovery.log", cwd=ROOT / "frontend")
        processes.append(("recovery-browser", recovery_process))
        def wait_signal(width: int, name: str) -> None:
            deadline = time.monotonic() + 65
            while time.monotonic() < deadline:
                if (handshake / f"{width}-{name}.json").is_file():
                    return
                require(recovery_process.poll() is None, "Recovery browser exited before handshake completed")
                time.sleep(0.1)
            raise RuntimeError("Recovery browser handshake timed out")
        for width in (1280, 390):
            wait_signal(width, "stop-request")
            run(["docker", "stop", "--time", "5", container], timeout=30, log=artifacts / f"postgres-stop-{width}.log")
            http_check("down", f"down-{width}")
            if width == 1280:
                run([sys.executable, "scripts/verify-public-round-contract.py", "--base-url", api_url,
                     "--phase", "down", "--output", str(artifacts / "http-down.json")], log=artifacts / "http-down.log")
                browser("down")
            (handshake / f"{width}-stopped.json").write_text(json.dumps({"containerRunning": False}), encoding="utf-8")
            wait_signal(width, "restore-request")
            run(["docker", "start", container], log=artifacts / f"postgres-restart-{width}.log")
            wait_database()
            binding = json.loads(run(["docker", "inspect", "--format", '{{json (index .NetworkSettings.Ports "5432/tcp")}}', container]))[0]
            require(int(binding["HostPort"]) == selected_db_port, "Restart moved the disposable database endpoint")
            wait_http(api_url + "/api/v1/rounds", backend)
            (handshake / f"{width}-restored.json").write_text(json.dumps({"sameBackendPid": backend.pid,
                "sameContainer": container, "sameDatabasePort": True}), encoding="utf-8")
        recovery_process.wait(timeout=30)
        browser_finished(recovery_output)
        require(recovery_process.returncode == 0, "Recovery browser failed")
        summary["checks"].append("same_open_page_database_recovery_desktop_and_mobile")
        require(hashlib.sha256(jar.read_bytes()).hexdigest() == summary["jarSha256"] and
                dist_fingerprint() == summary["frontendDist"], "Executed artifacts changed during verification")
        run([sys.executable, "scripts/check-approved-baseline.py", "--strict-evidence"], log=artifacts / "baseline-after.log")
        summary["status"] = "PASS"
        summary["postgresImage"] = postgres_image
    except Exception as error:
        summary["error"] = str(error)
    finally:
        cleanup_errors = []
        for name, process in reversed(processes):
            try:
                stop(process)
                require(process.poll() is not None, "Owned process remains alive")
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
        if container_created:
            try:
                purpose = run(["docker", "inspect", "--format", '{{index .Config.Labels "com.auctionplatform.purpose"}}', container])
                if purpose != "round-integration":
                    raise RuntimeError("Refusing to remove an unrecognized container")
                run(["docker", "rm", "--force", "--volumes", container], log=artifacts / "cleanup.log")
                require(not run(["docker", "ps", "-aq", "--filter", f"name=^/{container}$"]), "Disposable container remains")
                for volume in volumes:
                    require(volume not in run(["docker", "volume", "ls", "-q"]).splitlines(), "Disposable volume remains")
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
        for port in ports:
            with socket.socket() as connection:
                connection.settimeout(1)
                if connection.connect_ex(("127.0.0.1", port)) == 0:
                    cleanup_errors.append("OwnedListenerStillOpen")
        summary["cleanupEvidence"] = {"processes": [{"name": name, "pid": process.pid, "exitCode": process.poll()}
                                                   for name, process in processes], "container": container,
                                      "containerRemoved": container_created and not cleanup_errors,
                                      "anonymousVolumes": volumes, "listenerPortsClosed": not cleanup_errors}
        # Scan captured application/runner artifacts, including browser trace members, for the actual injected secret.
        leaks = []
        scan_errors = []
        safe_to_upload = True
        needles = [b"qa-do-not-log-cursor"] + ([password.encode()] if password else [])
        def redact(payload: bytes) -> bytes:
            for needle in needles:
                payload = payload.replace(needle, b"[REDACTED]")
            return payload
        # Error text is also an artifact; sanitize before serializing or printing the final summary.
        safe_summary = redact(json.dumps(summary, ensure_ascii=False).encode("utf-8"))
        if safe_summary != json.dumps(summary, ensure_ascii=False).encode("utf-8"):
            leaks.append("summary.json")
            summary = json.loads(safe_summary)
        for directory in [artifacts, *browser_directories]:
            for path in directory.rglob("*"):
                if not path.is_file():
                    continue
                raw = path.read_bytes()
                try:
                    if path.suffix == ".zip":
                        with zipfile.ZipFile(path) as archive:
                            entries = [(entry, archive.read(entry)) for entry in archive.infolist()]
                            comment = archive.comment
                        changed = any(redact(payload) != payload for _, payload in entries) or redact(comment) != comment
                        if changed:
                            rewritten = io.BytesIO()
                            with zipfile.ZipFile(rewritten, "w") as archive:
                                for entry, payload in entries:
                                    archive.writestr(entry, redact(payload))
                                archive.comment = redact(comment)
                            path.write_bytes(rewritten.getvalue())
                    else:
                        changed = redact(raw) != raw
                        if changed:
                            path.write_bytes(redact(raw))
                    if changed:
                        leaks.append(path.relative_to(ROOT).as_posix())
                except (OSError, zipfile.BadZipFile):
                    cleanup_errors.append("ArtifactScanOrRedactionFailed")
                    scan_errors.append(path.relative_to(ROOT).as_posix())
                    # Never let an unscanned/unsanitized owned artifact reach always-upload.
                    try:
                        path.unlink()
                    except OSError:
                        safe_to_upload = False
        summary["secretScan"] = {"status": "FAIL" if leaks or scan_errors else "PASS", "leakingFiles": leaks,
                                  "scanFailures": scan_errors,
                                  "scope": "captured logs/HTTP reports/browser artifacts including trace contents and summary",
                                  "detectedValuesRedacted": bool(leaks), "safeToUpload": safe_to_upload}
        summary["cleanup"] = "PASS" if not cleanup_errors else cleanup_errors
        if cleanup_errors:
            summary["status"] = "FAIL"
        if leaks:
            summary["status"] = "FAIL"
        if recovery_process is not None and 'recovery_output' in locals() and (recovery_output / "report.json").is_file():
            # Preserve failing test names/results even when the handshake aborted early.
            record = next(item for item in summary["browserRuns"] if item["phase"] == "recovery")
            if record["status"] == "NOT_RUN":
                record.update(status="FAIL", executedCases=browser_cases(json.loads((recovery_output / "report.json").read_text(encoding="utf-8"))))
        summary = json.loads(redact(json.dumps(summary, ensure_ascii=False).encode("utf-8")))
        (artifacts / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        task_artifacts = ROOT / ".artifacts/tasks/T-003" / run_id
        task_artifacts.mkdir(parents=True, exist_ok=True)
        (task_artifacts / "evidence-index.json").write_text(json.dumps({"candidateCommit": summary["baseCommit"],
            "status": summary["status"], "summary": artifacts.relative_to(ROOT).as_posix() + "/summary.json",
            "browserArtifacts": [path.relative_to(ROOT).as_posix() for path in browser_directories]}, indent=2) + "\n", encoding="utf-8")
        if safe_to_upload:
            (artifacts / "SAFE_TO_UPLOAD").write_text("Captured artifacts scanned; any detected known secret redacted and run marked FAIL.\n", encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print("Evidence: " + str(artifacts.relative_to(ROOT)))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

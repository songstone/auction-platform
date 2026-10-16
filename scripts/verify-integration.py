"""Run the public-round vertical slice against a disposable PostgreSQL database.

Requires Corretto 25, Docker, Node/npm, and contracts/requirements-validation.txt.
The default builds/tests both apps first. CI may supply built artifacts with --skip-build.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
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

import yaml

ROOT = Path(__file__).resolve().parents[1]
IS_WINDOWS = os.name == "nt"
HTTP = build_opener(ProxyHandler({}))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def run(command: list[str], *, cwd: Path = ROOT, env: dict | None = None,
        stdin: str | None = None, timeout: int = 600, log: Path | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, env=env, input=stdin, capture_output=True,
                            text=True, encoding="utf-8", errors="replace", timeout=timeout)
    output = result.stdout + result.stderr
    if log:
        log.write_text(output, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"{Path(command[0]).name} failed (exit {result.returncode}); "
                           + (f"see {log.relative_to(ROOT)}" if log else output[-1500:]))
    return result.stdout.strip()


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
    summary: dict = {"scope": "PUBLIC_ROUND_VERTICAL_SLICE", "runId": run_id,
                     "status": "FAIL", "baseCommit": run(["git", "rev-parse", "HEAD"]), "checks": []}
    environment = os.environ.copy()
    environment["JAVA_HOME"] = str(java_home)
    environment["PATH"] = str(java_home / "bin") + os.pathsep + environment["PATH"]
    backend = frontend = None
    container = "auction-round-it-" + uuid.uuid4().hex[:12]
    container_created = False
    try:
        version = subprocess.run([java, "-version"], capture_output=True, text=True, check=True)
        java_description = version.stdout + version.stderr
        if 'version "25.' not in java_description or "Corretto" not in java_description:
            raise RuntimeError("Corretto 25 is required for the integration runtime")
        (artifacts / "java-version.log").write_text(java_description, encoding="utf-8")
        run(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=30)
        run([sys.executable, "scripts/check-approved-baseline.py", "--strict-evidence"], log=artifacts / "baseline.log")
        if not args.skip_build:
            gradle = [str(ROOT / "backend/gradlew.bat")] if IS_WINDOWS else ["bash", "./gradlew"]
            run(gradle + ["--no-daemon", "--console=plain", "clean", "build", "integrationTest"],
                cwd=ROOT / "backend", env=environment, log=artifacts / "backend-build.log")
            run([npm, "ci", "--no-fund", "--no-audit"], cwd=ROOT / "frontend", log=artifacts / "npm-ci.log")
            run([npm, "test"], cwd=ROOT / "frontend", log=artifacts / "frontend-test.log")
            run([npm, "run", "build"], cwd=ROOT / "frontend", log=artifacts / "frontend-build.log")
        jar = ROOT / "backend/build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar"
        if not jar.is_file() or not (ROOT / "frontend/dist/index.html").is_file():
            raise RuntimeError("Build the backend and frontend before using --skip-build")
        summary["jarSha256"] = hashlib.sha256(jar.read_bytes()).hexdigest()
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
        run(["docker", "start", container], log=artifacts / "postgres-start.log")

        def wait_database() -> None:
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                ready = subprocess.run(["docker", "exec", container, "pg_isready", "-U", "auction_test", "-d", "auction_test"], capture_output=True)
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
        app_env = {key: value for key, value in environment.items()
                   if not key.startswith(("SPRING_", "DB_", "SERVER_", "MANAGEMENT_", "MAIL_", "PHOTO_"))
                   and key not in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS")}
        app_env.update(SPRING_PROFILES_ACTIVE="local-infra", SERVER_ADDRESS="127.0.0.1", SERVER_PORT=str(api_port),
                       DB_URL=f"jdbc:postgresql://127.0.0.1:{db_port}/auction_test", DB_USER="auction_test", DB_PASSWORD=password,
                       DB_CONNECTION_TIMEOUT_MS="1000", DB_VALIDATION_TIMEOUT_MS="500")
        backend = start([java, "-jar", str(jar)], app_env, artifacts / "backend-first-start.log")
        wait_http(api_url + "/actuator/health", backend)
        require(sql("SELECT count(*) FROM auction.rounds;") == "0", "Migration must not inject example rounds")
        require(sql("SELECT count(*) FROM public.flyway_schema_history WHERE success;") == "1", "Expected one successful migration")
        sql((ROOT / "infra/fixtures/public-rounds.sql").read_text(encoding="utf-8"))
        sql((ROOT / "infra/fixtures/public-rounds.sql").read_text(encoding="utf-8"))
        require(sql("SELECT count(*) FROM auction.rounds;") == "2", "Explicit seed must be repeatable")
        summary["checks"].append("empty_database_migration_and_explicit_repeatable_seed")
        stop(backend)
        backend = start([java, "-jar", str(jar)], app_env, artifacts / "backend-restart.log")
        wait_http(api_url + "/actuator/health", backend)
        require(sql("SELECT count(*) FROM public.flyway_schema_history WHERE success;") == "1", "Restart must preserve migration history")
        require(sql("SELECT count(*) FROM auction.rounds;") == "2", "Restart must preserve seeded rows")
        summary["checks"].append("restart_preserves_migration_history_and_data")
        run([sys.executable, "scripts/verify-public-round-contract.py", "--base-url", api_url,
             "--phase", "up", "--output", str(artifacts / "http-up.json")], log=artifacts / "http-up.log")
        summary["checks"].append("approved_http_contract_up")
        frontend = start([node, str(ROOT / "frontend/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1",
                          "--port", str(ui_port), "--strictPort"], app_env | {"AUCTION_API_TARGET": api_url},
                         artifacts / "frontend-preview.log", cwd=ROOT / "frontend")
        wait_http(ui_url, frontend)

        def browser(phase: str, label: str | None = None) -> None:
            label = label or phase
            browser_output = ROOT / "output/playwright/round-query" / run_id / label
            browser_env = environment | {"E2E_BASE_URL": ui_url, "E2E_PHASE": phase, "E2E_ARTIFACT_DIR": str(browser_output)}
            run([npm, "run", "test:e2e"], cwd=ROOT / "frontend", env=browser_env, log=artifacts / f"browser-{label}.log", timeout=180)
            summary["checks"].append("browser_" + label)

        browser("up")
        sql("UPDATE auction.rounds SET initial_bid_seconds=15, round_version=round_version+1 WHERE round_id='demo-round';")
        browser("changed")
        run(["docker", "stop", "--time", "5", container], timeout=30, log=artifacts / "postgres-stop.log")
        run([sys.executable, "scripts/verify-public-round-contract.py", "--base-url", api_url,
             "--phase", "down", "--output", str(artifacts / "http-down.json")], log=artifacts / "http-down.log")
        summary["checks"].append("approved_http_contract_database_down")
        browser("down")
        run(["docker", "start", container], log=artifacts / "postgres-restart.log")
        wait_database()
        wait_http(api_url + "/actuator/health", backend)
        browser("changed", "database-recovered")
        summary["status"] = "PASS"
        summary["postgresImage"] = postgres_image
    except Exception as error:
        summary["error"] = str(error)
    finally:
        cleanup_errors = []
        for process in (frontend, backend):
            try:
                stop(process)
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
        if container_created:
            try:
                purpose = run(["docker", "inspect", "--format", '{{index .Config.Labels "com.auctionplatform.purpose"}}', container])
                if purpose != "round-integration":
                    raise RuntimeError("Refusing to remove an unrecognized container")
                run(["docker", "rm", "--force", "--volumes", container], log=artifacts / "cleanup.log")
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
        summary["cleanup"] = "PASS" if not cleanup_errors else cleanup_errors
        if cleanup_errors:
            summary["status"] = "FAIL"
        (artifacts / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print("Evidence: " + str(artifacts.relative_to(ROOT)))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

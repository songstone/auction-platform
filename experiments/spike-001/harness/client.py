"""HTTP-only spike client. No direct calls into the implementation or database.

The append-only trace records requests and observations, not inferred successes.
Synthetic fixture time is carried separately from monotonic HTTP durations.
"""
from __future__ import annotations

import concurrent.futures
import http.client
import json
import queue
import threading
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


@dataclass
class Response:
    status: int
    body: Any
    elapsed_ms: float
    error: str | None = None


class Trace:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.sequence = 0

    def write(self, record: dict) -> None:
        with self.lock:
            self.sequence += 1
            record = {"traceSequence": self.sequence, **record}
            with self.path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")


class Api:
    def __init__(self, url: str, trace: Trace, timeout: float = 20):
        self.url = url.rstrip("/")
        self.parts = urllib.parse.urlsplit(self.url)
        self.trace = trace
        self.timeout = timeout
        self.connections = queue.LifoQueue(maxsize=32)

    def close_all(self):
        """Discard only this runner's idle HTTP connections before a server restart."""
        while True:
            try:
                self.connections.get_nowait().close()
            except queue.Empty:
                return

    def call(self, method: str, path: str, body: Any = None,
             *, timeout: float | None = None) -> Response:
        try:
            connection = self.connections.get_nowait()
        except queue.Empty:
            connection = http.client.HTTPConnection(self.parts.hostname, self.parts.port,
                                                    timeout=timeout or self.timeout)
        connection.timeout = timeout or self.timeout
        if connection.sock:
            connection.sock.settimeout(timeout or self.timeout)
        started = time.monotonic_ns()
        status, parsed, error = 0, None, None
        try:
            encoded = None if body is None else json.dumps(body).encode("utf-8")
            connection.request(method, self.parts.path + path, body=encoded,
                               headers={"Content-Type": "application/json"})
            response = connection.getresponse()
            status = response.status
            data = response.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(data) if data else None
            except json.JSONDecodeError:
                parsed = {"raw": data[:4000]}
        except (OSError, http.client.HTTPException) as exc:
            error = f"{type(exc).__name__}: {exc}"
        finally:
            if error:
                connection.close()
            else:
                try:
                    self.connections.put_nowait(connection)
                except queue.Full:
                    connection.close()
        duration = (time.monotonic_ns() - started) / 1_000_000
        result = Response(status, parsed, duration, error)
        self.trace.write({"monotonicStartNs": started, "url": self.url, "method": method,
                          "path": path, "request": body, "status": status,
                          "response": parsed, "error": error, "elapsedMs": duration})
        return result

    def get(self, path: str) -> Response:
        return self.call("GET", path)

    def post(self, path: str, body: Any = None) -> Response:
        return self.call("POST", path, body or {})


def parallel(actions: list[Callable[[], Any]]) -> list[Any]:
    """Start every participant from one client-side barrier; server order is observed."""
    barrier = threading.Barrier(len(actions))
    def execute(action):
        barrier.wait(timeout=30)
        return action()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(actions)) as pool:
        futures = [pool.submit(execute, action) for action in actions]
        return [future.result(timeout=60) for future in futures]


def nearest_rank(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    import math
    return sorted(values)[max(0, math.ceil(percentile * len(values)) - 1)]


class VersionedView:
    """A tiny independent read-side client, not the server's decision algorithm.

    Versions are local to each lane. Events with gaps require a fresh snapshot;
    an old event must never overwrite a later snapshot or another lane.
    """
    def __init__(self):
        self.lanes: dict[int, dict] = {}
        self.needs_snapshot: set[int] = set()
        self.ignored = 0
        self.gaps = 0

    def snapshot(self, lanes: list[dict]) -> None:
        for lane in lanes:
            identity = int(lane.get("lane", lane.get("id", lane.get("lane_id", 0))))
            previous = self.lanes.get(identity)
            if previous is None or int(lane["version"]) >= int(previous["version"]):
                self.lanes[identity] = dict(lane)
                self.needs_snapshot.discard(identity)

    def event(self, event: dict) -> None:
        lane = int(event.get("lane", event.get("lane_id", 0)))
        version = int(event["version"])
        previous = self.lanes.get(lane)
        old_version = int(previous["version"]) if previous else -1
        if version <= old_version:
            self.ignored += 1
            return
        if version != old_version + 1:
            self.gaps += 1
            self.needs_snapshot.add(lane)
            return
        payload = event.get("snapshot", event.get("state", event.get("payload")))
        if isinstance(payload, str):
            payload = json.loads(payload)
        if isinstance(payload, dict):
            self.snapshot([payload])
        else:
            self.needs_snapshot.add(lane)


class SseReader:
    """Real HTTP SSE observer. Receiving a frame is not browser DOM proof."""
    def __init__(self, url: str, path: str = "/events"):
        self.url, self.path = url, path
        self.events: list[dict] = []
        self.errors: list[str] = []
        self.ready = threading.Event()
        self.stop_event = threading.Event()
        self.connection = None
        self.response = None
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()
        if not self.ready.wait(10):
            raise RuntimeError("SSE connection did not receive HTTP headers within 10 seconds")
        if self.errors:
            raise RuntimeError(self.errors[0])
        return self

    def _run(self):
        parts = urllib.parse.urlsplit(self.url)
        self.connection = http.client.HTTPConnection(parts.hostname, parts.port, timeout=10)
        try:
            self.connection.request("GET", self.path, headers={"Accept": "text/event-stream"})
            self.response = self.connection.getresponse()
            if self.response.status != 200:
                raise RuntimeError(f"SSE HTTP {self.response.status}")
            self.ready.set()
            frame = {}
            data = []
            while not self.stop_event.is_set():
                line = self.response.readline()
                if not line:
                    break
                line = line.decode("utf-8", "replace").rstrip("\r\n")
                if not line:
                    if data:
                        raw = "\n".join(data)
                        try:
                            frame["data"] = json.loads(raw)
                        except json.JSONDecodeError:
                            frame["data"] = raw
                        frame["receivedMonotonicNs"] = time.monotonic_ns()
                        self.events.append(frame)
                    frame, data = {}, []
                elif line.startswith("data:"):
                    data.append(line[5:].lstrip())
                elif line.startswith("id:"):
                    frame["id"] = line[3:].lstrip()
                elif line.startswith("event:"):
                    frame["event"] = line[6:].lstrip()
        except (OSError, http.client.HTTPException, RuntimeError) as exc:
            if not self.stop_event.is_set():
                self.errors.append(f"{type(exc).__name__}: {exc}")
        finally:
            self.ready.set()
            if self.connection:
                self.connection.close()

    def stop(self):
        self.stop_event.set()
        if self.response and self.response.fp:
            try:
                self.response.fp.raw._sock.shutdown(2)
            except (OSError, AttributeError):
                pass
        self.thread.join(timeout=2)

# Independent HTTP experiment harness

This folder is disposable spike code. It calls the running Spring service through HTTP and checks approved policy examples against persisted requests, bids, state, and outbox observations. It does not call the Java engine directly or reproduce its implementation as unit tests.

Prerequisites: two dedicated experiment processes on ports 18081 and 18082, the same isolated PostgreSQL database, Python 3. No third-party Python packages are required. Only one runner may own the database at a time because every case replaces the synthetic fixture.

```powershell
python experiments/spike-001/harness/correctness.py --repeats 1 --failure-repeats 1
python experiments/spike-001/harness/correctness.py --repeats 100 --failure-repeats 10
python experiments/spike-001/harness/regressions.py --repeats 10
python experiments/spike-001/harness/crashes.py --repeats 10
python experiments/spike-001/harness/stream_crashes.py --repeats 10
python experiments/spike-001/harness/verify_evidence.py <run-directory>
```

`--urls` changes the isolated service URLs. `--only` selects case names using a regular expression. `--output` changes the evidence directory. The default correctness command executes 480 cases: 100 simultaneous same-price cases, 100 processing-order cases, and 28 temporal/fault/recovery/event cases repeated 10 times. Each same-price case launches 20 independent members from one client barrier, and records the actual official order; no member is assumed to win in advance.

`--seed` is a recorded scenario label. These fixtures are deterministic, and the harness does not seed OS scheduling or network arrival order; the raw official sequence is the evidence for each race.

The regression command adds ten cases repeated ten times: stop occurrence identity collisions, independent automatic lane workers and snapshot reads, shared-intent lookup after a discarded registration response, regressed decision and timer clocks, preservation of pre-opening rejection after opening, preservation of approval after final sale, pending acknowledgement/content binding, and both orders of layering manual stop with fault hold. The evidence verifier independently compares persisted accepted requests, bid rows, highest amount/member, reserve results, and pending-intent uniqueness from the captured HTTP audits. Its row totals count repeated observations, not additional service executions.

The crash command invokes the server's explicit `Runtime.halt` fault hook at four transaction boundaries, ten times each. It captures the actual Windows process exit code, queries committed state through the surviving service, and restarts the terminated service with `start.ps1 -Recover`. It reads only the dedicated server PID file and never enumerates or kills unrelated processes. A receipt that never committed is expected to be absent; it is submitted for the first time after explicit recovery confirmation and resume. A committed receipt keeps its original time and sequence across restart.

The stream-crash command observes two real network boundaries ten times each. It pauses the dispatcher before enqueue, or after enqueue while publication remains false. In the latter case an independent HTTP SSE reader must receive the exact target state frame before the JVM is terminated; `emitter.send` alone is not evidence. It verifies the dedicated PID against `/health`, terminates that process, restarts it, and receives the durable event through the other server. A client that already saw the old version must ignore the actual replay, and authoritative snapshots restore all four lanes. This script uses Windows `TerminateProcess` with observed exit code 72 and never terminates an unverified process.

Each invocation writes:

- `http-trace.jsonl`: actual HTTP request/response bodies, network failures, and monotonic client durations.
- `cases.jsonl`: individual policy assertions and actual before/after audit observations.
- `summary.json`: exact invocation, source hashes, runtime identity, case counts, and failures.

Failures remain in their original run directory. Later successful evidence does not rewrite the failed run. These fixtures use synthetic member identities and no authentication credentials. Synthetic milliseconds control temporal examples; HTTP durations use the client monotonic clock. Neither is browser DOM performance evidence. Runtime restart tests establish transaction durability under process termination; they do not establish power-loss, disk-loss, failover, or automatic outage-detection behavior. E3 merge cases use actual committed outbox records but deliberately corrupt delivery in the independent test client; real SSE transport and browser measurements are provided by the separate realtime harness.

The HTTP client maintains a bounded reusable connection pool (32 idle connections per server). The original runner opened a new connection per request and eventually observed Windows ephemeral-port exhaustion; that failed evidence is retained. A failed network operation is recorded and is not silently retried by the harness.

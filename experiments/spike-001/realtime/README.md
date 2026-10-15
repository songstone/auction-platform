# SPIKE-001 E3 client and reproducible harness

This directory and `../src/main/resources/static/` are isolated experimental code. Dependencies are pinned locally in `package-lock.json`; no global package or browser installation is required when Chrome is already installed.

```powershell
npm.cmd ci
node model-test.mjs
```

The pure client model covers old/duplicate/reordered events, missing versions, bounded buffer overflow, subscription/snapshot races, silent loss detected by authority versions, and four independent lane versions. It does not establish server or browser correctness.

After E1/E2 pass and exclusive access to the experiment DB is handed over, run:

```powershell
node corruption.mjs --core-passed
node browser-run.mjs --core-passed
node reconnect.mjs --core-passed
node load.mjs --core-passed --scenario base
node load.mjs --core-passed --scenario concentrated
```

The separately reported artificial 100ms round-trip condition uses a loopback proxy, with 50ms delay before forwarding a request and 50ms delay on each response chunk. Timer scheduling and same-host contention remain part of that result:

```powershell
node delay-proxy.mjs --upstream http://127.0.0.1:18081 --port 18091 --rtt-ms 100
# In another shell, after core pass and exclusive experiment ownership:
node browser-run.mjs --core-passed --base http://127.0.0.1:18091
```

Default base URL is `http://127.0.0.1:18081`; `--base http://127.0.0.1:18082` targets the second application. The mutation APIs are loopback-only fixtures. These harnesses reset the dedicated experimental fixture, so do not run two resetting harnesses against the same DB concurrently. `--core-passed` is an explicit execution gate, not a test result produced by the harness itself.

The harness pauses the dispatcher before each DB fixture reset, then enables it afterward. This prevents a poll from repopulating an old cursor between hub reset and DB reset. It is a fixture procedure, not evidence for online round transitions or version rollback after backup restoration.

`load.mjs` defaults to 100 protocol connections (20 bidder identities, 80 viewers), 60-second warm-up, 300-second measurement, and three repetitions. Base schedules two attempts per second across four lanes. Concentration schedules 20 same-price attempts every five seconds on lane 1, while other three lanes share one attempt per second. Attempts are transmitted even when the current fixture is preparing or at a closing boundary, preserving the planned request rate; each batch records the observed stage and deadline, and completed normal business rejections are latency samples. Slots with no remaining item are counted separately. Raw rows retain the actual request amount, outcome, official sequence, and receipt/decision times. Default five-second follow-up deadline coincides with the concentration interval, so individual bursts can encounter closing boundaries; do not assume every scheduled burst has one approval.

200/400 connection exploration requires `--connections 200 --core-and-base-passed` after the prior correctness and baseline evidence. The browser sample uses five actual Chrome contexts plus 95 live protocol SSE backgrounds, verifying 100 active connections in server metrics. The roles are two browser bidders, three browser viewers, 18 designated idle protocol bidder roles, and 77 protocol viewers. It defaults to 100 real DOM click samples paced at two attempts per second, and five actual browser network disconnections for each 5/15-second duration. This does not represent 100 browser tabs or 20 actively bidding browsers. Browser latency includes intent registration, bid submission, polling, and final DOM application; acknowledgement is sent after final DOM application. It aborts one response after the upstream bid request and separately verifies recovery using the original request key and durable outcome. Event receive-to-DOM uses a monotonic clock. PostgreSQL commit-to-DOM records require non-null `committedMs` and browser `/clock` RTT midpoint calibration, with half-RTT plus millisecond timestamp resolution recorded as uncertainty. These actual DOM samples run under 100 connections separately from the longer protocol load trials.

`reconnect.mjs` disconnects 20 protocol clients simultaneously and restores them ten times for each 5/15-second duration. Its fixtures use 100ms preparation and 1s initial/follow-up windows to exercise item replacement during disconnection. It measures ready-event to snapshot/model application, not browser DOM recovery. `corruption.mjs` runs eight actual SSE integration cases ten times each, using the server's drop/duplicate/reorder/delay hooks and dispatcher pause. They include an older prior-product event arriving after replacement and a bounded server-queue overflow: a client with 1000ms write delay receives 90 accepted bid changes, is disconnected at the queue limit, and explicitly reconnects to an authoritative snapshot while the healthy connection continues. The 1000ms slow-writer condition is separate from the approved 100ms HTTP round-trip proxy. The suite also validates the public snapshot shape for prohibited seller/winner/reserve-value/credential fields.

Short smoke parameters are explicit and must be reported as smoke, not as the default approved repetitions:

The browser disconnect procedure explicitly clicks the UI disconnect control (closing EventSource), sets the browser context offline, verifies the server connection count fell from 100 to 95, then restores the network and clicks connect. Native EventSource automatic reconnection is **NOT_RUN**: context offline alone did not reliably close the existing SSE connection in the initial browser fixture. Those failed runs remain in results. The protocol reconnect suite additionally injects offline manual STOP and known-history fault HOLD on selected repetitions.

Final reconnect/browser verification freezes the experiment worker mode after offline transitions and waits for one second of observed stable authority fields before choosing the comparison target. It compares exact lane versions and core state, and verifies the target remained unchanged afterward. Browser checks additionally compare actual product/price/status/deadline/button text. This fixture setup is outside ready-to-restored latency; it is not proof of a production pause barrier. A prior fixed100ms wait allowed an already-started worker to finish after target capture; that failed run is retained. Subscription races under live changes remain separate corruption cases.

The browser driver serially waits for each click's result and records actual click-launch times, schedule lag and achieved rate. Its nominal two clicks/second is not an independent open-loop load generator. The default protocol load is the longer scheduled-rate test. The 200-connection exploration failed with DB pool acquisition timeout in this environment; the stop-on-degradation rule left400 connections **NOT_RUN**. See [load evidence](../results/realtime/LOAD-EVIDENCE.md).

For read-only 15-second resource sampling, run `python harness/resource_monitor.py --interval 15` from the experiment root in another shell. Create `.runtime/stop-monitor` to stop it; remove that marker before a later monitoring run. This adds two metrics reads, one SQL aggregate and Docker stats per interval. It does not measure Hikari acquisition waits or continuous maximum lock/queue depth.

```powershell
node corruption.mjs --core-passed --repetitions 1
node browser-run.mjs --core-passed --samples 8
```

Playwright CLI visual inspection follows a fresh snapshot before element references:

```powershell
npm.cmd exec -- playwright-cli -s=spike-e3-visual open http://127.0.0.1:18081/ --browser chrome
npm.cmd exec -- playwright-cli -s=spike-e3-visual snapshot
npm.cmd exec -- playwright-cli -s=spike-e3-visual screenshot --filename output/playwright/visual.png --full-page
npm.cmd exec -- playwright-cli -s=spike-e3-visual console error
npm.cmd exec -- playwright-cli -s=spike-e3-visual close
```

Each run writes the actual argv, repetition counts, measurements, failure counts, merge statistics, and raw fixture history under `../results/realtime/`; browser screenshots originate under `output/playwright/` and are copied into the durable results directory. The load trials independently replay the bid-only fixture policy against four raw DB audits for each repetition, checking original sequence and response, eligibility, exact increment, unique effects, current highest amount/leader, receipt-based deadline, final results, and committed outbox versions. Load latency is `PROTOCOL_INTENT_TO_FINAL_RESPONSE`, not click-to-DOM. Timeout and system failure counts remain separate; a completed-sample p95 alone cannot establish a passing run. All processes share one Windows host with the DB and applications, so resource contention includes the load generator. No deployed-system, external-network, power-loss, disk-loss, or DB failover claim follows from these runs.

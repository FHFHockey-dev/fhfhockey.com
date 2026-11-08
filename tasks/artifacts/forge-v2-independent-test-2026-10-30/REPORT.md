# Independent FORGE v2 test report — 2026-10-30

**Disposition: changes required for one newly reproduced P2 correctness defect.** The five previously audited defects pass independent regressions against the repaired interfaces. The existing v2 suite and browser cases pass after resolving local test-environment restrictions. This is synthetic engineering evidence, not scientific qualification or release approval.

## Exact source and isolation

- Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`.
- Product repair: `7113329d2c24b8629f54484df37441f95a63d853`.
- Evidence/tasks: `156030056f62836f4b0a42f4c9064e8ddb057002`.
- Preparation/HEAD: `514614ed79a75498c81ad1df0c812150d51a46b0`.
- Every copied source matched HEAD before execution; all 56 pinned source/document/preparation paths still matched afterward. See `source-pins.json`, `continuation-source-pins.json`, and `verification.json`.
- Tested from `/tmp/forge-v2-independent-hkh8ulbm`; product files copied byte-for-byte. Test-only adjustments: independent Vitest config with `envDir:false`; original browser screenshot path redirected; failed PostgreSQL startup logs retained. New independent tests exist only in the snapshot and this artifact directory.
- Node 22.11.0; actual installed dependency versions in `cloud-feasibility.json`. Existing `web/node_modules` was linked read-only in practice; no installation or lockfile changes. Tests used an explicit environment allowlist, no `.env` files, live credentials, data captures or holdouts.
- PostgreSQL 17.11 used a disposable cluster, synthetic roles and records, `listen_addresses=''`, private temporary Unix socket, and `LC_ALL=C`. Each cluster was shut down and removed by test cleanup. Browser tests used a loopback synthetic HTTP server and blocked external page requests. Public page/API and RSO gates remain unchanged and disabled.
- Resource lock `/private/tmp/fhfh-heavy.lock` acquired per check and released. Existing ownership documents report prior writers handed back; no product ownership assumed and no shared leases edited. Runtime model/effort could not be independently attested; no further agents were spawned.

## New finding F1 — P2: older concurrent preparation replaces the latest corrected context

**Trigger:** Two `preparePlayerReadContext` calls for the same player start from the same previous context. An older-as-of job pauses just before its final append; a newer job finishes, then the older job resumes.

**Observed:** The newer job materializes a subsequent official correction, but the older job is still allowed to append after it. The current reader then returns the older context and its old outcome revision. Both immutable contexts remain retained; the defect is regression of the current serving head, not deletion of history.

**Cause and references:**

- `web/lib/forge-v2/preparation.server.ts:80` reads the latest context and checks its predecessor only before doing the preparation work (through line 87).
- `web/lib/forge-v2/preparation.server.ts:171` appends the context without an atomic expected-head or monotonic-as-of condition.
- `web/lib/forge-v2/history.server.ts:129` checks record identity/idempotency, but not whether a supplied predecessor is still the current context head. The schema predecessor is a foreign key, not a single-successor fence (`supabase/migrations/20261029235656_forge_v2_immutable_history.sql:73`).
- `web/lib/forge-v2/api.server.ts:59` serves the last inserted context (`order by ordinal desc limit 1`), including when its as-of time is older.

**Two independent executions:**

1. `reproductions/lib/forge-v2/independent-concurrency.test.ts`: real issuance fixture and production preparation/read functions, with only the final append deliberately delayed. Older as-of `2026-01-13T04:00:00.000Z`; newer `2026-01-14T04:00:00.000Z`. Expected corrected outcome `independent-new-correction`; repository returned older `integrated-corrected-outcome`. Exit 1, `concurrency.log`.
2. `reproductions/lib/forge-v2/independent-native-race.test.ts`: real PostgreSQL store and `PostgresContextReader`, focused test `independent:`. Both context appends sharing the old predecessor succeeded; `staleAppendRejected:false`; reader returned `race-older` instead of `race-newer`. Exit 1, `native-race.log`. Thirteen unrelated cases in the copied test file were deliberately filtered/skipped.

This violates the intended current corrected-outcome/accountability behavior of FR-14/FR-22/FR-23 and the task's context-head preservation guarantee. Fix before admitting overlapping preparation workers. Public serving is presently disabled, so no production impact was demonstrated. A suitable repair would atomically fence context-head publication by player and expected predecessor and prevent as-of regression, while retaining immutable contexts; simply checking the predecessor earlier does not close this race. Product repair was not authorized in this test-only task and was not attempted.

## Executed results

| Check | Result | Evidence |
|---|---|---|
| Existing v2 Vitest suite | **183 unique passed** across focused runs | `suite.log`, `native.log` |
| Prior five defects, independently reproduced against repaired interfaces | **5 passed** | `adverse.log`, four retained reproduction files |
| New overlapping-preparation regression | **Failed: F1** | `concurrency.log` |
| Native database confirmation of F1 | **Failed: F1** | `native-race.log` |
| Chromium actual queue → prepared HTTP API → UI, desktop 1440 and phone 390 | **2 passed** | `browser.log`, `screens/issued-1440.png`, `screens/issued-390.png` |
| Chromium display/keyboard/history/scoring/responsive fixtures | **2 passed**, no observed overflow or external page requests | `browser.log`, `screens/desktop.png`, `screens/phone.png` |
| Preparation metadata/runner checks from 514614ed7 | **11 passed** | `intake.log` |
| Chronological model/calibrator availability and interval replay | **Passed**, 32 synthetic calibration rows | `chronology.log` |

The initial existing suite had 173 passes and ten native tests unable to start. After fixing the environment, all 13 native/artifact tests passed: ten newly executed native tests plus three artifact cases already counted. Therefore the unique existing count is **183**, not 186. Database coverage includes publication retries/concurrency, committed-readback timing, savepoints, role denial, immutable updates/deletes/truncation, stable 3,007-row pagination amid writes, queue CAS, stale worker fences, archive identity/permission/decoding failures, and native issuance-to-prepared-reader integration.

The old five-defect reproduction files were first run unchanged: three passed; two failed because their old harness used no atomic `saveQueueWithRecords` and tried to substitute a separately pinned calibrator. Those are not reported as current product failures. The adapted tests keep the original PRD expectations, implement the new atomic storage interface, and exercise both scoring profiles from one pre-issued calibration bundle with independently calculated interval endpoints. All five then pass. The tests also verify altered calibration bytes are refused. Original outputs remain in `outside.log`.

The five repaired requirements checked: immutable failed-refresh gap; zero-weight missing PIM not suppressing default joint; original/custom calibrated intervals from unchanged issued bytes; authoritative actual-start correction restoring final eligibility; resetting default weights accepting the API's original-scoring label.

Initial sandbox errors and the stripped-environment locale failure are retained. Execution escalation was granted for the same isolated checks; there was no automatic-review denial, pending approval or uncertain operation. The test runner's initial continuation setup typo (`checkcwd` self-assignment) was corrected before intake execution; it did not execute tests or acquire the lock. `*-receipt.json` files record the child test exit codes; earlier wrapper invocations returned zero independently of child failure, so the report uses child receipts/logs. The wrapper now propagates child exits.

## Limits and remaining work

- The two F1 tests are a single new product finding, not two separate defects.
- Browser lifecycle uses a durable-store double with real production issuance/preparation/API/UI functions. Native PostgreSQL issuance-to-read is tested separately. No single native-PostgreSQL-through-Chromium test is claimed.
- No real calibration, forecast accuracy, official source/appearance validation, source rights, protected evaluation, prospective execution, production capacity or full-v2 scientific acceptance was tested. The previously open fifteen scientific/external subtasks plus NEW-07/NEW-08 remain open.
- No full application build, broad repository tests, separate v1/RSO compatibility rerun, lint/typecheck, hosted migration, 200% zoom or RTL assessment. No representative full-scale capacity claim; existing continuation capacity measurements were not rerun.
- No product code edits, commits, pushes, deployments, public gates, schedules, hosted changes, production/provider requests, credential use or cloud uploads.

## Reproduction and cloud transition

`run.py` preserves the exact child commands and environment allowlist; `snapshot-path.txt` identifies the retained local snapshot. To rerun without replacing retained evidence, make a new test-artifact/output directory and reconstruct the snapshot from the exact source pins/commits, link or install reviewed dependencies, copy the retained reproduction files into matching `web/` paths, and use the recorded child commands. Native tests require PostgreSQL shared memory/Unix-socket permissions; browser tests require loopback/Chromium permission. Keep original public gates disabled and do not copy environment files.

A minimal allowlisted package of the **51 initial code/test/config/PRD files** is **1,487,208 bytes raw**, approximately **357,500 bytes (349 KiB) gzip-compressed**, measured by creating the archive only in memory. Core code/tests/config excluding the lockfile and PRD/tasks is about 562 KiB raw. The five continuation scripts and new reproductions are small optional additions. It contains **private project code**, despite containing no credentials or sports/account datasets. No bundle was written or transferred.

Cloud needs Node 22.11.0, Linux npm dependencies (reviewed lockfile, public npm registry), PostgreSQL 17, matching Playwright Chromium plus Linux browser dependencies, and an unprivileged user for `initdb`. Mac `node_modules`, binaries and browser cache should not be copied. The existing tests are otherwise portable after setting the PostgreSQL/browser paths and separate output directories. A cloud run was not executed, so dependency-install cost and cloud runtime/capacity are unmeasured.

Recommendation: retain this completed Mac evidence; address F1 locally or in a later authorized test environment. For future iterations, use an explicitly approved transfer of only the pinned private source/fixtures into the preferred cloud environment, verify hashes there, and provision dependencies once. No production credentials, provider access, holdouts or duplicate Mac run are needed.

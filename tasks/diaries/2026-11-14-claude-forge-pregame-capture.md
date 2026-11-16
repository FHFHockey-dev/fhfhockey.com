# FORGE pregame input capture (Claude Chef)

- **Scope:** private, model-free, one-game FORGE input capture with an atomic claim, one immutable save and an independent T−60 witness; then a hosted per-game slate queue. Not in scope: scoring, forecast or revision writes, serving, the rolling rerun, Scout's Start Chart accuracy lane, the 10:05 repair.
- **Where:** `/Users/tim/Code/fhfhockey.com`, `octoberBranch` at HEAD `6d77ede69`; production master is `89da739cb`. The capture files (`run-forge-projections.ts`, `inputCapture.ts`, `gameRevisions.ts`, `issuedContext.ts`, `starterBoardFlags.ts`, `starter-board.ts`) are byte-identical to master.
- **Ownership:** `TJ-OWNERSHIP-STEER-PREGAME-CAPTURE-20261115`, confirmed by TJ's pop-up here; claim `CLAUDE-PREGAME-CAPTURE-CLAIM-20261115`.
- **Staffing:** Chef runs Opus 5.5 at high. TJ chose to raise Chef to xhigh, but the app refuses a self-change, so TJ has to do it. Until then, workers run at medium or below.

## Verified findings (2026-11-15T00:00Z)
- `starter-board.ts:32-46`: "capture-only" runs only `retryPendingLineSourceEvents()` (line/news). It saves no native inputs.
- `run-forge-projections.ts:474`: `captureEnabled = captureFlag && computeEnabled`. The snapshot is built after `runProjectionCalculations` (live writes run inside capture), saved at `:583`, then `publishForgeGameRevisions` runs when compute is on.
- `run-forge-projections.ts:560` and `:641`: `decisionAsOf` uses string `>` on ISO timestamps.
- `saveForgeInputSnapshot` (`gameRevisions.ts:155`) inserts into `player_forecast_source_observations`, which is append-only with a no-update/delete trigger and service_role only. `available_at` is the writer clock. There is no witness.
- `inputCapture.ts`: with `suppressWrites` set, a table mutation returns a fake success instead of being refused. RPCs throw. The deadline aborts reads only. No row or byte caps.
- Reconstruction (`captureForgeReconstruction`) requires compute+capture flags, runs scoring with writes suppressed and is classified historical. It does not qualify.
- No existing T−60 runner, frozen receipt or capture scheduler. `forge_final_pregame_revisions` has readers but no writer.
- Reuse candidates:
  - `forge-research-pregame-capture-v1` (`web/lib/forge-v2/researchCapture.ts`): a pure freeze/hash/clock contract.
  - `forge_v2_private` immutable schema with `committed_readback` receipts. Its vintage inserts are lease-gated (issuance-gated), so don't reuse that claim.
  - The `run-forge-local.ts` GET/HEAD-only preview and budget pattern.
  - `forge_execution_internal` advisory locks.

## Next
- Survey the native read graph inside `runProjectionCalculations`: which reads depend on compute output.
- Fix the packet contract.
- Staff the extraction and parity lane.

## Checkpoint 2026-11-15T00:45Z: custody foundations (Chef)
- **TJ decisions (pop-ups):** Claude owns the lane end to end, including the needed edits to existing files. Raise Chef to xhigh: TJ has to do it in the app, since a self-change is refused. Witness = RFC 3161 TSA + DB clock cross-check.
- **Claims:** `CLAUDE-PREGAME-CAPTURE-CLAIM-20261115` (744c15549, which also committed Scout's steer entry) and addendum 1 (a5af283c9).
- **Built:**
  - `pregameCapture/time.ts`: µs instants, no string order.
  - `pregameCapture/deadline.ts`: T−60, earliest start, start budget.
  - `pregameCapture/der.ts` + `pregameCapture/rfc3161.ts`: request builder; strict token verification with ESS binding, EKU, chain to pinned anchor, nonce, policy and accuracy.
  - TSA test fixtures and their generator script.
  - Migration `20261115000000_forge_pregame_capture_custody.sql` (not applied).
  - Proof `supabase/tests/forge_pregame_capture_custody.py` + rollback.
- **Checks:**
  - Vitest pregameCapture 16/16.
  - OpenSSL parses the builder's TimeStampReq.
  - SQL proof 55/55 on local PG15.
- **Gotchas:**
  - `vitest --root /` hangs: it scans the whole filesystem. Use esbuild for one-off scripts.
  - OpenSSL refuses to sign a TSA reply with a non-EKU cert, so the EKU refusal has no fixture. The code path is checked by reading only.
- **Pending:** the authority row 150 and test count pins, added when the migration bytes freeze.

## Checkpoint 2026-11-15T02:10Z: transport + custody orchestrator (Chef)
- **TJ pop-ups:**
  - Full stage load/compute split by a high-effort worker session. Proposed as card `task_558b7a87`: the app refused a direct start from a notification-started turn, so TJ starts it.
  - Exactly two GET RPCs allowlisted.
  - Chef is now at xhigh.
- **Decisions:**
  - Parity = identical read multiset. The writer's target-game PBP/shift completeness reads stay; the capture refuses if they show any result. Removing them would break replay of all retained snapshots: unconsumed reads throw.
  - The stated cutoff = end of the read window. The claim's DB clock is the as-of value passed to filters (null cutoff → claimed_at).
  - A function-level `SET statement_timeout` does NOT bound its own call (PG15 measured: a 3 s sleep completed). Unknown saves are settled through `settle_v1` (claim row lock + fence), never timed out.
  - HTTP-layer refusals come back as `{ error }` results (supabase-js wraps fetch throws), so the runner fails any capture with a recorded refusal.
- **Commits:**
  - 9078b6f0e: fence + proof.
  - 93089a4fe: strict transport and the `inputCapture` option.
  - This checkpoint: packet, rpc, verifier, custody, test TSA signer, acceptance tests.
- **Checks:**
  - SQL proof 69/69.
  - Vitest pregameCapture 39/39.
  - inputCapture consumers: 15 files, 839 passed.
  - ESLint clean.
  - Full typecheck running under `/tmp/fhfh-heavy.lock`.
- **Next:**
  - Wire `runner.ts` (real pin/collect via the worker's `collectNativePregameInputs`, HTTP TSA client, Supabase clients) and a local script with a dry offline mode.
  - Fresh-context review of custody (`d4625ed40` onward).
  - Then the pilot packet for TJ.

## Checkpoint 2026-11-15T02:45Z
- **Worker:** TJ started [FORGE stage load/compute split](local_e8e29114-61cc-4add-bcc5-77515117bf0d) from the first card. An amendment was sent by message: the collector returns `issuedContextAfter`, must give zero transport refusals in the fixture world, and the oracle must not use `suppressWrites`. A duplicate card was proposed and withdrawn.
- **Commits:**
  - ede7f2d8f: runner wiring plus type fixes. The repo targets ES2015, so BigInt values use `BigInt(...)`. A `u8()` view covers @types/node 18 Buffer vs TS 5.7 `Uint8Array`.
  - 5b2b67103: no runner-added read in the packet.
- **Checks:** scoped tsc (pregameCapture + inputCapture) shows 0 errors; vitest 42/42; ESLint clean. The full typecheck before the fixes exited 2, with errors only in the new files; rerun it at freeze.
- **Pending:**
  - Fresh-context review (subagent) of custody.
  - Migration authority row 150 and the count pins, after the review settles the SQL bytes.
  - `web/scripts/forge-pregame-capture.ts`, after the worker lands `nativeInputs.ts`.
  - Pilot packet: TSA choice, anchor, a probe for the accuracy field.
- 2026-11-15T03:00Z **Parity decision (Chef):** the worker found that the goalie-input read *order* depends on model output: the top starter is loaded first, and its ranking uses skater compute output. The read *set* doesn't.
  - Approved: the per-team goalie-input block is compared as a multiset (same op-chain hashes and counts). Everything else stays exact-order. Writes must be byte-identical.
  - The loader uses a deterministic, model-free order. Candidate coverage is asserted. Existing resume, local-attempt and startChart tests must pass unmodified. Error-path and deadline differences get listed.
  - Replay is unaffected, since it matches by hash.
- 2026-11-15T03:20Z **Worker:**
  - The oracle is committed on the unmodified writer: 1216f6e17, enriched in 52c3b6919.
  - Goalie read order confirmed model-dependent. Scenario: goalie-model-reorders-candidates.
  - The seasonBootstrap decision moves to a pure exported function in the writer. The runner records the value in the packet.
  - **Gotchas:**
    - My directory pathspec commits (daded823b, ede7f2d8f) swept in the worker's in-progress `__fixtures__/world/**` and `parity/**`. From now on Chef commits by exact file.
    - 1216f6e17 carries a Co-Authored-By trailer, against TJ's no-attribution rule. It's on shared history, so not rewritten; flagged to TJ.

## Checkpoint 2026-11-15T05:30Z: independent review fixed (Chef)
- **Review:** fresh-context subagent; 2 P1, 5 P2, many P3.
- **Fixed:**
  - **P1-1:** failed reads could still qualify. Network errors, aborts and HTTP status ≥400 (except 406/416) are now recorded refusals.
  - **P1-2:** the outcome slot wasn't bound to the claim. Outcomes now agree with claim state under the claim lock; lookup reconciles lost responses; a closed game stays closed.
  - **P2-4:** idempotent settle is retried. Witness and outcome writes are reconciled by readback, never retried.
  - **P2-5:** unexpected errors after the claim close it consistently. A sweeper closes orphaned claims and skips row-locked ones.
  - **P2-6:** embedding and profile switching refused.
  - **P2-7:** cross-clock cutoff check removed.
  - **P2-3 (partial):** SQL now computes the statement digest, checks upper = gen + accuracy, read order and row version; `reverifyStoredWitness` re-checks offline.
  - **P3:** EKU critical-only, sid/version/digest-list checks, accuracy ranges, DER INTEGER/OID minimality, GeneralizedTime and pre-epoch ranges, `ENABLE ALWAYS` triggers, code-unit canonical sort, ASCII migration, stricter "filtered" rule, target-game checks via in/match/filter/or and nested RPC rows, naive stamps read as UTC and counted, extra availability columns, schedule PPD/CNCL and missing start, stated cutoff includes the stamp tolerance.
- **Deferred to TJ at the pilot:**
  - A separate DB role for the verifier (new permission; P2-3 remainder).
  - TSA revocation (OCSP would be another external call).
  - Gateway body limit and packet size: measure in the pilot.
- **Commits:** 6478ec5d0 (SQL v2, proof 108/108 as a non-superuser owner); 09498f181 (TS, vitest 95/95, ESLint clean, scoped tsc 0).
- **Not changed:** the claim "ack_upper understates the true ack by TSA latency". The witness proves commit ≤ read ≤ genTime ≤ upper, so a slow TSA only makes the bound later (more conservative).

## Checkpoint 2026-11-15: offline prerequisites done; packet ready (Chef)
- **Authority:** authority row 150 is pending (`ee4d5fc96`; hash updated in `55ed51604`). Count pins are 150 rows / 7 pending, and the summary count is updated. Claim note: `CLAUDE-PREGAME-CAPTURE-AUTHORITY-ROW-20261115`. The baseline test had failed since `d4625ed40` because the migration file was unregistered; that is fixed.
- **Pilot script:** `web/scripts/forge-pregame-capture.ts`.
  - Default: plan only.
  - `--rehearse`: forces synthetic env and traps network.
  - `--tsa-probe` and `--execute`: separately gated.
  - The runner now goes through an injectable `captureDeps`; the fake custody database is a shared fixture.
- **TJ's mid-task cutoff rule:**
  - The fail-first test failed on the old verifier, as expected.
  - Qualification now also needs the final committed readback (database clock) at or before T−60 of the earliest start, enforced in both the verifier and SQL (`final_read_at`, `capture_witness_final_read_late`).
  - The rehearsal case passes. SQL proof 112/112.
- **RFC 3161 hardening:** the exhaustive single-bit flip test now passes (each of 2,253 bytes refused).
  - Exact tags are required.
  - Algorithm parameters must be absent or NULL.
  - No unsigned content is accepted.
  - Bundled certificates must be on the validated path or equal to an anchor.
  - The test CA's validity is fixed at 2020–2100, because the verifier enforces certificate validity at genTime.
- **Packet:** `tasks/artifacts/forge-pregame-capture-2026-11-14/PILOT-APPROVAL-PACKET.md`.
  - Candidate `55ed51604`; its clean-export typecheck exits 0.
  - Migration SHA-256 `0d2b6aa6…d177`.
  - Proposed game: 2026020334 WSH@TBL, launch 18:00 ET / 23:00Z on 2026-11-17, T−60 at 18:30 ET / 23:30Z.
  - TSA: DigiCert, root G4 (PEM saved).
- **Next:** TJ reviews the packet. Nothing live until D1–D4 and P1/P2 are each approved.
- **Gotcha:** `rg`/glob searches over the live-capture artifact folders are slow; target specific files.

## Checkpoint 2026-11-15: probe fixed and pinned (Chef)
- TJ: "Fix and repin the probe now"; the earliest eligible game comes after the probe passes and the migration and verifier are cleared; Tuesday is the fallback; TJ approves the replacement game before it runs.
- **TSA profile `digicert-g4-v1`:** pinned in `tsaProfiles.ts`. The G4 PEM is embedded, with its SHA-256 checked on load. The policy slot stays empty until a probe; a capture refuses an unpinned profile.
- **Probe:** reports each property through `tokenInspect.ts` and retains its request, response and report in a new 0700 folder. Offline tests cover pass, missing accuracy, a wrong signer, an unreachable TSA and a reused folder.
- **Candidate re-pinned:** `1cd29b4b9`. Clean-export typecheck exits 0. Vitest 147/147. Migration unchanged (`0d2b6aa6…`).
- **Next:** TJ's go-ahead for P1 (one probe call). Then re-pin the policy, D1/D2 clearance, the G1 schedule lookup, and propose the earliest eligible game for approval.

## Checkpoint 2026-11-15T03:xxZ: P1 probe run and re-pinned (Chef)
- **P1 (TJ-approved):** one POST to DigiCert at 02:37:45Z, 235 ms. Receipt in `~/forge-pilot/probe-20261115T023745Z/`.
  - The strict verifier refused on accuracy; OpenSSL `ts -verify` passed.
  - The token has no Accuracy field, whole-second genTime, policy 2.16.840.1.114412.7.1, and bundles a cross-signed G4 (`33846b54…`).
- **Fixes:**
  - Bound adds genTime resolution (code + SQL `tsa_resolution_us`).
  - Off-path certificates are accepted only by exact pinned SHA-256. A first "same subject + key" attempt was caught by the exhaustive flip test.
  - Policy re-pinned. D3 = 60 s (TJ).
  - DigiCert's real token kept as a regression fixture.
- **Candidate:** `6562138932`; clean-export typecheck exit 0. Migration SHA-256 `4213b110…`; SQL proof 113/113; vitest 131 + baseline 21.
- **Next:** D1 (migration apply) and D2 (verifier credential), each cleared separately by TJ; then G1 schedule lookup → earliest eligible game for TJ's approval (fallback: Tue 2026020334).

## Checkpoint 2026-11-15T14:10Z: D1 applied, D2 decided (Chef)
- **D1:** migration 150 applied at 14:06:02Z (atomic, ledger row). Readback all as expected; receipt in `MIGRATION-150-APPLY-RECEIPT.md`. Authority row 150 is applied; pins 116/6.
- **D2 (TJ):** same service_role key + separate client; Astra's post-hoc OpenSSL check after the run.
- **Other lanes:**
  - Side session started for the 12:40Z served-snapshot verification: `local_dee180eb`.
  - BLSH asked about a 2026-11-17 13:45–14:15Z slot; replied clear.
- **Next:** G1 (one read-only schedule lookup) needs TJ's go-ahead. Then propose the earliest eligible game for approval; fallback is Tue 2026020334.
- **Gotcha:** `$TMPDIR/pgpool.sh` from earlier lanes no longer exists. I rebuilt an equivalent in the scratchpad: pooler aws-0-us-east-1:5432, user postgres.<ref>, read from `SUPABASE_DB_URL`, never echoed.

## Checkpoint 2026-11-15T14:45Z: pilot 1 = source_failed (Chef)
- **G1 lookup:** earliest eligible game is 2026020326. TJ approved it, launched in about 30 min, attended. The gate at 14:40:09Z was clean.
- **Result:** `source_failed`, `http_status:500` on `sustainability_trend_bands`, in 31 s (reads 30.3 s). No save, no TSA call. Claim `216da95d…` fenced; one outcome. Readback matches. Receipt and mailbox finding are posted.
- The live writer swallows this same error, which is the honest-input failure the capture must refuse.
- **Next:**
  - Diagnose the 500 read-only (needs TJ's approval): API/Postgres logs for that window, recent `forge_runs` trend diagnostics, an EXPLAIN without ANALYZE.
  - Offline: keep the bounded PostgREST error code/message in refusal metadata.
  - Then propose the next game (Tuesday fallback or the next eligible game).
- **Gotcha:** refusing on status before reading the body cost the diagnosis. Fix offline.

## Checkpoint 2026-11-15T18:00Z: 0327 investigated (Chef)
- **0327:** stopped at the pin ("context read was incomplete", 10.5 s, no claim).
- **I missed reporting it** when the timer ended; TJ found the receipt.
- **Cause:** local DNS. The gate's psql couldn't resolve the pooler at 15:15:01Z. TJ-approved edge logs show **no pin request reached Supabase** during the run.
- **The gate failed open** (my bug).
- **Fixes (TJ: log check + offline fixes):**
  - fail-closed `operator/gate.sh` and `launch-capture.sh`, self-tested;
  - refusals keep DB error and network cause codes;
  - pin/collect errors are prefixed with the refusals.
- **Tests:** vitest 133/133.
- **Decision:** no retry of 0326/0327 (TJ).
- **Open:**
  - The trend-bands timeout fix belongs to Astra/Scout; routed.
  - The next capture needs a new candidate SHA and TJ's approval.

- 2026-11-15: clean-export typecheck of candidate `dcb8f50bb` (13,414 files): exit 0, 0 errors.

## Checkpoint 2026-11-15T18:05Z: trend-band reader prototype started (Chef, TJ plan)
- **Scope:** offline prototype of a batched latest-row trend-band read. Mailbox claim `cb42e6c12`. `skater-queries.ts` and `skater-stage.ts` stay unedited until Astra/Scout acknowledge.
- **Effective cap (edge logs, read-only):** at 14:40:24Z the old GET sent `limit=12000` and got `Content-Range 0-999/*`, origin 2,553 ms. Team 2's GET took 8,050 ms and returned 500. Production max_rows = 1,000.
- **Retained run evidence:** `tasks/artifacts/goalie-h1-2026-11-13/READBACK.json` (2 teams) has `rows_eligible 2000`, which is cap-saturated; players with rows 15, missing 21.
- **Writer shape:**
  - The daily cron writes `snapshot_date = today` for player_totals_unified rows 0–999, ordered by player_id.
  - Each snapshot has 15 metrics × 4 windows (l3/l5/l10/l20).
  - A window is skipped when it has no known value. History mode re-upserts up to `game_limit` game-date snapshots.
- **Plan:**
  - The candidate SQL lives in this lane's artifact dir, not `supabase/migrations`, until TJ approves it (no accidental push).
  - Test against a disposable PG15 with about 11M production-shaped rows.
  - Run the real old SQL and the new function against the same rows, then through the real TS selection.
  - Report pages read, calibrated against production's 2.55 s and 8.05 s timings.

## Checkpoint 2026-11-15T18:30Z (local 13:30 ET): trend-band reader prototype ready for review (Chef)
- **Note:** `trend-band-reader/TREND-BAND-READER-PROTOTYPE.md`. Candidate SQL in `trend-band-reader/sql/` (not in supabase/migrations). TS `web/lib/projections/queries/trendBandLatest.ts` + test (13/13) + gz fixture.
- **Checks:**
  - narrow tsc (temp tsconfig on the two files): exit 0;
  - eslint: exit 0;
  - function proof: 11/11 on local PG15.
- **Findings:**
  - In-cap selection is identical for 95/95 players.
  - Beyond-cap players are now stale, not missing.
  - The boundary tie is plan-dependent in the old read.
  - `eligibleRows` goes from 1000 to 70–144 (counter change).
- **Headroom (pages):** old 6.8k–11.8k; new 206–351 for normal teams. The worst case without statistics is 4.1k–10.2k. The narrow index gives 275–374 in every case.
- **Gotchas:**
  - Unix socket paths are limited to 103 bytes, so the bench socket is `/tmp/stb-sock-55542`.
  - `python3 -I` drops the script dir from sys.path.
  - The PostgREST tie order differs from both explicit tie orders.
- **Next:** TJ's decisions (counter, beyond-cap, read-only production EXPLAIN, then index or ANALYZE). Astra/Scout acknowledgement before any reader switch.
- **Local data:** the bench DB (≈5.4 GB) stays in the scratchpad (`stb-bench`), server stopped.
- **Review fixes (18:45Z):**
  - Production has statistics: its 29,699-row estimate matches the analyzed plans. Under `random_page_cost = 1.1` the old read uses `idx_stb_player_metric`, as production's did, and the probe stays on the primary key.
  - The capped count preserving `eligibleRows` costs 48–94 pages.
  - "Rates unchanged" is conditional on the inert reader; the test asserts it.
  - Plan excerpts added; the production EXPLAIN SQL is drafted, not run. Wider suites 243/243.

## Checkpoint 2026-11-15T18:35Z: TJ decisions + production EXPLAIN (Chef)
- **TJ:**
  - counter: rename to `trend_adjustment_candidate_rows` and drop the old key;
  - stale-not-missing: accepted;
  - production EXPLAIN: approved.
- **EXPLAIN** (18:33:47Z; read-only transaction, 5 s/1 s timeouts, pooler DNS checked first): generic and custom plans both use a backward primary-key scan with all four columns in `Index Cond`. No index and no ANALYZE needed. Production has `random_page_cost` 1.1, `jit` off and statistics present. Private copy in `~/forge-pilot/trend-explain-20261115/`.
- **Next (integration; each needs its own approval):**
  - after Astra/Scout acknowledge: switch `skater-queries.ts` and rename the counter in `skater-stage.ts` and `run-forge-projections.ts`;
  - capture refusal on `fetchFailed`;
  - fixture-world RPC handler and oracle regeneration;
  - then TJ approves: applying the function, the third GET RPC in `CAPTURE_RPCS`, and the push.

## Checkpoint 2026-11-15T19:15Z: trend-band reader integrated offline (Chef)
- **TJ:**
  - integrate now (without waiting for Astra/Scout);
  - the third capture RPC is allowed (the table read stays for the release window);
  - re-record the oracles with a diff note.
- **Done:**
  - RPC-first reader with a history-GET fallback (reconstruction, legacy replay, PGRST202);
  - counter renamed to `trend_adjustment_candidate_rows`;
  - `loadForgeNativeInputs` refuses failed trend reads;
  - `CAPTURE_RPCS` has 3 entries, and the source audit is updated;
  - fixture-world RPC;
  - oracles re-recorded: `ORACLE-DIFF-20261115.md`. The two goalie-reorder oracles were patched with only the trend delta, to keep the pre-split order check;
  - pending migration 151, proof 18/18, rollback.
- **Checks:**
  - projections suite: 96 files, 1,901 tests;
  - migration-reading tests 15/15;
  - capture and query suites 282/282;
  - eslint clean.
- **Next:**
  - typecheck on a clean export of the commit;
  - TJ approvals: apply migration 151, then release.
- **Gotcha:** a full oracle re-record would have erased the goalie-reorder baseline, which `parity.test.ts:149` requires to differ.
- **Follow-up (19:35Z):**
  - The clean-export typecheck of `bbb85af7b` gave exit 0. The first attempt exported only `web/`, which produced 46 false "Cannot find module ../../../supabase/functions" errors; export web and supabase together.
  - A 404 PGRST202 is a transport refusal, so a capture needs migration 151 applied first.
  - Added the stale-player end-to-end test and a transport HTTP test.
  - Suites: 107 files, 2,076 tests.
  - The pilot packet needs a revision (three RPCs, new SHA).

## Checkpoint 2026-11-15T19:35Z: migration 151 apply packet ready (Chef)
- **Prepared:** `trend-band-reader/MIGRATION-151-APPLY-PACKET.md`, `operator/apply-migration-151.sh` (fail-closed: preflight, apply, readback, smoke) and `operator/apply-migration-151-selftest.sh` (10/10 on a disposable PG15).
- **Not run in production:** no preflight, apply or smoke yet. They wait on TJ's pop-up.
- **Gotcha:** a local postmaster under the default macOS locale fails with "became multithreaded during startup". Set `LC_ALL=C`.

## Checkpoint 2026-11-15T19:32Z: migration 151 applied (Chef)
- **TJ:** "Apply + 2-read smoke".
- **Gate (19:30:17Z):** clean.
- **Applied:** 19:30:17.888359Z (database clock); readback exact.
- **Smoke:**
  - SQL as service_role: 144/144 keys, 2.4 ms;
  - PostgREST: HTTP 200, 144 rows.
  - Team 2's 18 players all have rows: 4 at age 0 and 14 at age 4.
- **Recorded:** receipt, authority row 151 set to applied, pins 117/6 (21/21 pass), super-goal sentence updated.
- **Next (each needs TJ):**
  - reader release (push/deploy);
  - pilot packet revision (three RPCs, new candidate SHA);
  - next capture game.

## Checkpoint 2026-11-15T19:36Z: pilot packet rev 4 (Chef)
- **Candidate:** `29451c573`. Clean export: typecheck exit 0; 16 files / 326 tests pass.
- **Proposed game:** 2026020328 (CGY @ ANA), puck drop 01:00Z, T−60 00:00Z, last claim 23:56Z. Fallbacks: 0329/0330 tonight, 0331 Monday.
- **Pending:** TJ's P2 approval.
- **19:35Z:** TJ approved P2 for 2026020328 (launch about 30 minutes later). Fresh export: `~/forge-pilot/export-29451c573-20261115T193518Z` (13,437 files). Migration hashes match authority rows 150 and 151. Launch no earlier than 20:05Z, aiming for about 20:10Z (the 20:17Z cron is avoided).

## Checkpoint 2026-11-15T20:12Z: PILOT 3 QUALIFIED (Chef)
- **Capture:** game 2026020328 launched 20:10:10Z through the fail-closed gate. `qualified` in 20.7 s: 133 reads, 163 KB packet, genTime 20:10:32Z, bound 20:11:33Z against T−60 00:00Z.
- **Checks:** post-run readback matches (hashes, binding); `reverifyStoredWitness` OK; OpenSSL `ts -verify` OK against the pinned root.
- **Receipt:** `PILOT-3-RECEIPT-2026020328.md`.
- **Parallel:** session `forge-slate-queue` (`local_4478746c`) is building the hosted slate queue offline (TJ: use the hour).
- **Gotcha:** a stray `cat >> file` with no input hung a command (it reads stdin). Never leave a bare `cat` in a chain.

## Checkpoint 2026-11-15T20:30Z: slate queue reviewed; TJ decisions (Chef)
- **Review:** slate-queue session commits `005ad051d`, `ae3346d11` and `0fc8b7f9e` touch only new files plus `SLATE-QUEUE-PACKET.md`, with no attribution lines. The Chef rerun passes 190/190 (slate, capture, script, trend, baseline pins).
- **Logic:** lookup on every entry; retry only pin failures with no claim; ambiguous cases settled by lookup and sweep; an empty refresh is ignored. Finding: a crash after the save commits ends as `saved_without_valid_witness`.
- **TJ:**
  - Mac hosting;
  - live queue pilot tonight on 2026020329 + 2026020330 (02:00Z);
  - build the stop rules first;
  - record `never_dispatched` for removed games.
- **Chef defaults:** keep the `claim_failed` handling, lead 10 min, global sweep OK for the pilot.
- **Sent to the session:** stop rules, `--execute`, `launch-slate.sh`, rehearsal, packet run plan; due 22:00Z. Then Chef verifies a clean export and asks TJ to approve the exact run.
- **20:45Z:** candidate `e0cbb19a8` verified on a clean export: typecheck exit 0, 350/350 tests, rehearse with 0 network attempts, plan matches. Bringing TJ the queue-pilot run approval.
- **20:37Z:** TJ approved the slate queue pilot: 2026020329 + 2026020330, candidate `e0cbb19a8`, attended launch 19:10–19:35 ET (00:10–00:35Z).
  - Plan: fresh export about 00:05Z, launch about 00:15Z.
  - Token: `tj-slate-2026020329-2026020330-20261115`.
  - Command: `operator/launch-slate.sh <export>/web e0cbb19a8… 2026-11-15 <token> <new out> 2026020329@2026-11-16T02:00:00Z,2026020330@2026-11-16T02:00:00Z`.

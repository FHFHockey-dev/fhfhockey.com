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

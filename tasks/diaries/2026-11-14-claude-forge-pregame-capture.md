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

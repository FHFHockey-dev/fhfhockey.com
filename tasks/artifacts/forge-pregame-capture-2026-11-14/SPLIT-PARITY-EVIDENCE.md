# FORGE stage load/compute split: byte-level output parity (Chef verification)

- **Status:** kept local. Nothing pushed, deployed or applied (TJ, 2026-11-15).
- **Unmodified writer:** `52c3b6919` (oracle commit).
- **Split:** `9a312597e` by the worker session `local_e8e29114`. Later test-only follow-up: `5a7ca3cd1`.
- **Writer files unchanged since the split:** `run-forge-projections.ts`, `stages/**`, `queries/**`, `inputCapture.ts`. `git diff 9a312597e HEAD` is empty for these.

## Method (independent of the worker's own parity test)
1. `git archive` both commits' `web/` into scratch copies outside the repo. Both share the repo's `node_modules`. No worktree, no repo edits.
2. Add the same scratch-only test to both copies. It runs every oracle scenario through the production writer, `runProjectionV2ForDate`, on the fixture world with the clock frozen at `2026-11-14T20:00:00Z`.
3. Serialize every write op chain, plus the run result, with `JSON.stringify`. Order is issue order and key insertion order. `-0`, `NaN`, `±Infinity` and `undefined` are encoded distinctly.
4. Compare the files with `cmp`.
5. **Sensitivity check:**
   - A forced change in the split copy (`as_of_date` metric) changed all 9 writes dumps, so each copy ran its own code.
   - A nudge to the role-stability clamp floor (0.7 → 0.70001) changed nothing, because no scenario reaches that floor.

## Result: 18 of 18 files byte-identical

| file | bytes | sha256 (first 16) |
| --- | ---: | --- |
| goalie-model-reorders-candidates.result.json | 233 | 75536a3a8d8a12fd |
| goalie-model-reorders-candidates.writes.json | 611373 | a8754313d2ea6351 |
| goalie-override-multi-candidate.result.json | 233 | fa9cb1e6ee89abfe |
| goalie-override-multi-candidate.writes.json | 596848 | db8f7e74bd64e371 |
| lineup-evidence-gate.result.json | 233 | fa9cb1e6ee89abfe |
| lineup-evidence-gate.writes.json | 618557 | d1f431f516ed3503 |
| normal-one-game.result.json | 233 | 75536a3a8d8a12fd |
| normal-one-game.writes.json | 603863 | 9d4d898754dd8cdc |
| opponent-shots-gate.result.json | 233 | 3110131a3f4a60ab |
| opponent-shots-gate.writes.json | 292873 | 2095e2fe6de60fff |
| reserve-pass-on.result.json | 233 | 75536a3a8d8a12fd |
| reserve-pass-on.writes.json | 611358 | a5fc8dd30c8fd1f1 |
| season-bootstrap.result.json | 233 | 9894809cc6ffa9b3 |
| season-bootstrap.writes.json | 636435 | ebd9766fec4fca10 |
| skater-pool-recovery.result.json | 233 | 75536a3a8d8a12fd |
| skater-pool-recovery.writes.json | 603583 | 0c55bdf660485943 |
| target-pbp-pregame.result.json | 233 | 75536a3a8d8a12fd |
| target-pbp-pregame.writes.json | 603863 | 9d4d898754dd8cdc |

**Tables written across the scenarios:** `forge_runs`, `forge_player_projections`, `forge_team_projections`, `forge_goalie_projections`, `forge_reserve_projections`, `player_prediction_outputs`, `game_prediction_outputs`, `model_market_flags_daily`.

## Repository suites at HEAD
`vitest`: 11 files, 294 tests passed:
- `pregameCapture/**`, including the worker's parity suite (oracle reads, writes and candidates; the collector equals the writer; replay consumes every read; mutation checks);
- `reserveProjections.test.ts`;
- `run-forge-projections.{resume,local-attempt,external-inputs}.test.ts`;
- `startChartPipeline.test.ts`.

The resume, local-attempt, external-inputs and Start Chart suites are byte-unmodified by the split (`git diff --stat 52c3b6919 9a312597e` on them is empty).

Full typecheck at HEAD (`5a7ca3cd1` tree, split included, `npm run typecheck` under the heavy lock): exit 0.

## Why `reserveProjections.test.ts` changed
- **What the test is:** a source audit. It runs `git grep` for every non-test file under `lib/pages/components/scripts` that names `forge_reserve_projections`, and pins that list. The point is that no reader (Start Chart, accuracy, team rows, game revisions) ever sees reserve rows.
- **What the split added to the list:** test support that names the table only as a recorded write:
  - the four oracle JSON files under `pregameCapture/__fixtures__/world/oracle/` (reserve-pass-on, lineup-evidence-gate, goalie-override-multi-candidate, goalie-model-reorders-candidates);
  - `pregameCapture/parity/scenarios.ts`.
- **The change:** those two directories are excluded from the audit. The production list is unchanged: `reserveProjections.ts`, `run-forge-projections.ts`, `stages/persistence-stage.ts`, `lib/rosterScheduleData/forgeDailyBridge.ts`.
- **Checked:**
  - Nothing outside those directories imports from them (`rg`).
  - The oracle JSONs are byte-unchanged since they were recorded (`git diff 52c3b6919 9a312597e` on `oracle/` is empty).

## Limits
- Parity is proven for the 9 fixture scenarios: normal; pool recovery; season bootstrap; reserve pass on; lineup evidence gate; opponent-shots gate; incomplete target-game PBP; goalie override / multiple candidates; model-reordered goalie candidates.
- Compute branches no scenario reaches are not covered. The role-stability clamp floor is one known example. No coverage provider is installed, and adding one would change dependencies.
- Reads match the oracle exactly in 8 scenarios. In goalie-model-reorders-candidates only the per-goalie input block reorders (compared as a multiset, per Chef's decision). Writes are byte-identical there too.

## Open before acceptance (TJ: keep local until proven)
- Production runs FORGE today with `STARTER_BOARD_COMPUTE_ENABLED` off, on the uncaptured, resumable path, and no scenario covers it yet. The worker is adding compute-off scenarios (normal, reserve on, goalie multi-candidate, and if possible one resumed run). Their oracle is recorded from a `git archive 52c3b6919` export; existing oracle files are never re-recorded. This byte-level comparison will be repeated on them.
- Season bootstrap under the strict transport was refused (`games!inner` embed). Chef narrowed the rule: embedding is admitted only for allowlisted relations, and dotted filters only on those embeds. The worker removes that known refusal next.

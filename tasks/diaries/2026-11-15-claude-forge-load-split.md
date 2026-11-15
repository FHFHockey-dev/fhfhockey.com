# FORGE load/compute split (Claude worker for Chef local_e8064f61)

- **Scope:** split skater/goalie stages into loaders + compute; add `pregameCapture/nativeInputs.ts` collector; offline oracle recorded on unmodified code first; parity tests. No prod reads/writes, no network.
- **Where:** `octoberBranch`. Oracle commits `1216f6e17` (has an unwanted Co-Authored-By trailer; not amended) and `52c3b6919` (enriched, still unmodified writer). Split commit: see git log after 52c3b6919.
- **Files:** `stages/skater-stage.ts`, `stages/goalie-stage.ts`, `run-forge-projections.ts`, `pregameCapture/nativeInputs.ts`, `pregameCapture/parity/**`, `pregameCapture/__fixtures__/world/**`, plus a narrowed guard in `reserveProjections.test.ts` (skip the parity fixtures).

## Design
- Skater: `loadSkaterTeamInputs` (all reads and read-set selection, incl. reads that used to sit in compute: strength averages, official PP usage, current goalie ids, reserve ids and reserve rolling reads, goalie candidates) → `computeSkaterTeamProjection` (no reads). Per team load then compute, so `metrics.warnings` order is unchanged. Lineup gate is one pure helper (`isLineupSkater`) used by both; compute fails closed if its rows differ from the loader's lineup.
- Goalie: `loadGoalieGameInputs` reads into the run caches (gate = opponent projected); compute reads caches through a fail-closed `loaded()`.
- Seams `skaterStageLoaders` / `goalieStageLoaders` let tests observe the writer's bundles.
- Writer: `runPerGameSkaterStage` / `runPerGameGoalieStage` stay the per-game entry points (resume tests stub them). Stage args, caches and completeness reads are built only in shared helpers in `run-forge-projections.ts`; `loadForgeNativeInputs` drives the loaders with no compute. `decisionAsOf` uses `latestInstant`.

## Checks (2026-11-15)
- Parity 36/36. Writer vs oracle: reads exact in 8/9 scenarios. The 9th (`goalie-model-reorders-candidates`) differs only in goalie-input read order; writes are identical in all 9. Collector vs writer: exact reads and candidates in every scenario. Writer replay on collector reads: every oracle write, all reads consumed. Mutation checks pass.
- `vitest run lib/projections`: 94 files, 1839 tests pass. `npm run typecheck` exit 0. eslint clean on touched files.

## Pending / for Chef
- Goalie-input read order is model-dependent (selected goalie first). The loader uses candidate order; parity compares that block as a multiset. Approved by Chef (diary e3b2a0beb).
- Collector takes an optional `seasonBootstrap`; the writer rule is now the pure export `forgeSeasonBootstrapApplies` (Chef diary decision) for the runner to record. `readCount` not returned (not observable from inside capture; Chef's runner type doesn't take it).
- `captureForgeReconstruction` with an offset-less `inputCutoff` would now throw at snapshot build (strict parse).

## Gotchas
- Chef's directory-level `git add` swept in my in-progress world files (daded823b, ede7f2d8f).
- macOS sed has no `\b`; use perl.

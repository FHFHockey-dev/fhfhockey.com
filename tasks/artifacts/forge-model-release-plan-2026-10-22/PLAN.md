# FORGE model release plan (prepared 2026-10-22, not pushed)

Owner: Claude model lane. For Chef to freeze and release once TJ approves. Nothing here is pushed or built.

## What ships

Base: `origin/master` `9d789c372` (Release A). The prototype is [candidate-prototype.patch](candidate-prototype.patch): `git diff 9d789c372 <prototype>`, 36 files under `web/`, sha256 `b5eb9939…`. It was built in a throwaway shared clone and is reproducible from the pieces below.

| piece | source | why it must ride |
|---|---|---|
| History hydration | `6767073ea`, ported 3-way onto master's S-F-lite reader | task 2. TJ approved release as an improvement ([gate verdict](../forge-task2-gate-2026-10-22/VERDICT.md)). |
| Full S-F reader: RPC sidecar hydration (task 2.4) | octoberBranch `skater-queries.ts` (+test) at `721486d0f`, plus `lib/rollingPlayerCountSupport.ts` | **Production reads through the RPC.** Master's RPC path ignores `support_row`, so without this, hydration only reaches the legacy scan (reconstruction). The aligned-count branch is inert because master's writer stores no `alignedCountSupport`. |
| F/D-prior hits/blocks model (F3/F4) | `b8fe1072e` FORGE parts + `34a5588db`: `skater-adjustments.ts`, `projection-weights.ts`, `skater-stage.ts` physical hunks, `run-forge-projections.ts` cache, types | task 2. It's half of what the gate measured. |
| Task 2 repair | `721486d0f` (`computeSkaterPhysicalEventRates` pair rule; `fetchLeaguePhysicalTotals` `rpc_missing` / `read_only_reconstruction`) | task 2. Migration 88 stays unapplied (TJ), so production runs on F/D priors with scale 1 via `rpc_missing`. |
| Goalie model 7.x, market probabilities 6.x, NB distributions 8.x | `6b4898a95` model files: `goalieModel.ts`, `goalie-stage.ts`, `goalie/*`, `utils/devig.ts`, `utils/market-output-builders.ts`, `dispersion.ts`, `uncertainty.ts`, `skater-stage.ts` NB/market hunks, the goalie moneyline wiring in `run-forge-projections.ts`, plus scripts `fit-forge-dispersion.ts` and `forge-goalie-backtest.ts` | held back from `d45a287f0` |
| League save % per-run cache | `59daabf00` (`leagueSavePct.ts`, `goalie-stage.ts`, runner wiring) | reproducible captures |
| Review lane fixes | `6f0c58471` (6.2 Yes-only market probability), `d65812dc2` (7.2 team win kept apart from credited W) | Codex review answers |
| Nullable GF/W (HOLD dependency) | the goalie-only parts of `6e14053ff`: `calculators/goalie-starter.ts`, `utils/projection-metadata-builders.ts`, `proj_win_prob: number \| null` in `types/run-forge-projections.types.ts` | the goalie stage at `6b4898a95` assigns nullable GF/W. Without it, tsc fails with 10 errors. DB columns are already nullable. |
| 7.3 bridge | `293b5dc36` **bridge part only**: `forgeDailyBridge.ts` from octoberBranch; test = master's test + 7.3's hunks, with the planner test given team priors | the commit says "release with or after the 7.2 goalie model". It imports `goalieOutcomes`. octoberBranch's bridge test also carries P07 planner fixtures (`1a9c48975`: `currentPlanningRead`, `rsoUsePolicy`), which are not on master. |

**Explicitly NOT shipping:**
- HOLD `65fc4b9ee` (Q7/Q8), `07c7f71af` (per-goal assists), `f0ab2b9fd` (octoberBranch ES refit; master already has R18) and `e316db4c0` (PP targets).
- The skater-side aligned-count requirement from `6e14053ff`.
- P07 planner/RSO files.
- Migration 88.

## Verified on the prototype

- `tsc --noEmit` clean on the whole web tree, run under `/private/tmp/fhfh-heavy.lock`.
- Vitest: `lib/projections`, `lib/rosterScheduleData`, `lib/player-forecasts` and `lib/rosterScheduleOptimizer` all pass: **96/96 files, 2,615 tests**. eslint is clean on the edited bridge test.
- `scripts/qualify-native-players-offline.test.ts`: **54/56** with octoberBranch's fixture and test (checksum `12953ed6…`, already in `qualify-native-players-offline.ts`).
- Gate evidence for the skater side is [forge-task2-gate-2026-10-22](../forge-task2-gate-2026-10-22/VERDICT.md): variant c is this candidate's skater model minus the RPC reader, which reconstruction can't exercise. The goalie, market and NB evidence is the 10-22 sprint holdouts recorded in the improvements task list (7.1/7.2/7.4, 8.1/8.2).

## Open before freezing (Chef / TJ)

1. **Two qualification expectations.** In the "reproduces current native calculations" test and the "keeps PPP missing and blocked when PP rows and aligned count support are absent" test, PPP is expected `missing` when PP rows and aligned counts are absent. That's `6e14053ff` skater behaviour; the candidate models PPP (0.075, `present_native_diagnostic`). Either adapt those two expectations to the released behaviour (recommended: smallest scope) or bring `6e14053ff`'s skater PPP rule into the release (wider: a model change the gate didn't measure).
2. **Review lane.** Confirm it's finished with `goalieModel` / `goalie-stage` / `goalie/*` / `devig.ts` / `market-output-builders.ts`. The tree was clean on those at 19:40Z, with last commits `6f0c58471` and `d65812dc2`. Any later commit means rebuilding the candidate.
3. **`proj_win_prob` semantics change** (7.2: credited goalie W, per-game pairs summing to 1). The readers are the bridge (7.3, shipping), the served-forecast ledger, the scoreboard and the start chart. Typed consumers compile; the ledger's naive baseline still imports the old xG win function (noted in 7.3).
4. **Release mechanics** (task list "Release path", memory "Push octoberBranch together"):
   - build a master candidate with commit-tree from these file versions;
   - gate it in a clean export (tests above, tsc, eslint);
   - re-check the 4 Vercel projects' preview settings with TJ;
   - push only with TJ's approval, smoke-test, then sync octoberBranch.
5. **After release:** run a served-forecast ledger check (dressed only) for a week. Then rerun FP audit Q5/Q6: zero hit/block projections should stay below 10%.

## Follow-ups this release doesn't fix

- HIT over-prediction: +10.9% bias, 0.883 top decile. Next step is a tuning pass on `SKATER_PHYSICAL_RATE_PRIORS` or migration 88's rescale, each with its own gate run.
- A/PPP under-prediction (A −26%, PPP −30%): task 3.
- Early-season stale rolling rows (09-29..10-06): TJ runs the refresh ([verdict](../forge-task2-gate-2026-10-22/VERDICT.md#decisions-tj-this-session-2026-10-22-1900z)).

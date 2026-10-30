# Handoff diary: review-forge-model-82-ga (82-game assumptions in the FORGE model)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_ee800bea-ca4a-4ea0-9de1-3ac4f2c47343` ("Review FORGE model 82-game assumptions for 84 games"), idle, 34 turns. Started from `local_08a0bf1c`. It started the follow-up session `forge-baseline-v2-prior` (see that diary).

## 1. Scope
- TJ noticed season code hard-coding 82 games; 2026-27 is the first 84-game NHL regular season. He asked that models also be changed if 82 makes this season's model data wrong or sub-par.
- Task: analyse, and fix only if warranted, the 82-game sites in the FORGE player-forecast model. The display code and season endpoint had already been fixed (commit `79492e495`, octoberBranch). The game-prediction blend cap (`web/lib/game-predictions/featureBuilder.ts`, 82 ends a saturating roster-blend curve) was reviewed and kept by TJ; this session left it alone.
- FORGE live-run files were frozen until 2026-10-20 17:00 UTC (list in `tasks/prd-forge-daily-pipeline.md`, "v2 build ownership"), so this was analysis only.

## 2. Where
- Analysis note: `~/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/forge-82-game-audit-2026-10-19.md`.
- Sites examined: `web/lib/player-forecasts/baselinePolicy.ts:60`; `modeling/player_forecasts/season.py` lines about 3192, 3198, 3464, 3623, 4882, 4903.
- No code edited, nothing committed (git is clean for these files; `previousAppearanceWindow: 82` is still at `baselinePolicy.ts:60`).

## 3. State
- Done (analysis). Verdicts:
  - `baselinePolicy.ts:60` `previousAppearanceWindow: 82`: KEEP for 2026-27, CHANGE before 2027-28. It caps the previous season's appearances; 2025-26 had 82 games so nothing is dropped now. In 2027-28 the prior season (2026-27) has 84; `buildPriorAppearanceSkaterRates` (`baselineRates.ts:205`) throws on more than the window, and the legacy/goalie paths (`baselineRates.ts:127`, `goalieBaselineRates.ts:114`, `scripts/forge-walk-forward-native.ts:173`) would silently drop each player's 2 earliest games.
  - `season.py` 3192/3198 (appearances or starts / 82), 3464 (82 x seasons), 3623 (sqrt(sampleGames/82)), 4882/4903 (team confidence): all KEEP. Training data is limited to 2025-26 and earlier (all 82-game seasons), so /82 is exact; the rate is applied per scheduled game over the real 84-game schedule; confidence terms are saturating scales capped at 1.
- `seasons.numberOfGames` is per-team games (NHL stats `/season` field copied verbatim by `update-seasons.ts`). One public NHL feed read showed 84 for 20262027 and 82 for 20232024-20252026; the league total (1344 / 1312) is a separate field `totalRegularSeasonGames`. The `1312` rows in `web/lib/NHL/server/index.test.ts` are mislabeled fixtures (the tests never assert the count).
- Impact on published forecasts and replays: none. No tests were run (no code changed).

## 4. Next
- Proposed and started a separate session for the baseline v2 window change (task_781c1a94, session `local_1a6919f9`), to run after the freeze lifts. See `forge-baseline-v2-prior.md`.

## 5. Blocked / needs TJ
- Nothing outstanding for this analysis. The 2027-28 change needs a new versioned baseline definition (v2); that is a method-level change TJ/Chef must approve.

## 6. Insights
- Changing the window changes the pinned `BASELINE_CANDIDATE_DEFINITION_HASH` (`baselinePolicy.ts:74`, throws on mismatch) and every baseline/prior-appearance definition hash. It needs a v2 definition with v1 kept so archived replays still verify. `baselinePolicy.ts` is not itself on the freeze list, but everything that imports it is.
- Latent: when `season.py` training first includes 2026-27, the /82 ratios (3192, 3198, 3464) must divide by each historical season's own `numberOfGames`, or 84-game seasons give rates above 1 (min-capped in the priors, uncapped at 3464 before a 0.995 clamp). `season.py` also hard-codes season id 20262027 and the 84 / 1344 schedule checks, so it needs a deliberate next-season pass anyway.
- `season.py` is an offline CLI; `forge-daily.ts` does not call it.
- Optional cosmetic: change the `1312` fixtures in `index.test.ts` to 82 (a file other sessions own).

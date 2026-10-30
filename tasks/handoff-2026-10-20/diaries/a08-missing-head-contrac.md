> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# a08-missing-head-contrac (session local_458e7b96-a62b-413b-82d7-9270acbe6f7d)

Title: "Shared missing-forecast-value rule for FORGE readers (A-08)". Idle after 48 turns.

## 1. Scope
- Finding A-08 in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`: FORGE readers disagree about a missing modeled value ("head"). Start Chart's `sumProjectionParts` returned null if ES or PP was unknown; `forge/players.ts` substituted zero; the accuracy job substituted zero and used `proj_win_prob ?? 0`. Production summed partial values everywhere, so shipping only the Start Chart change would make products disagree and distort accuracy evaluation.
- Task: one shared helper (ES and PP are modeled heads; PK adds nothing until modeled), used by start-chart, forge/players and the accuracy job; accuracy must skip unknown predictions (including null win probability) and count the skips. Do not change `web/lib/game-predictions/featureBuilder.ts` (model inputs); list its partial sum instead.
- Precheck done: none of the target files were on the FORGE frozen list in `tasks/prd-forge-daily-pipeline.md` ("v2 build ownership").
- Started by local_08a0bf1c. Tied to A-09/A-11 in the native serving plan (the serving slice imports this helper).

## 2. Where
- Branch octoberBranch; commit `b47c512fb` (TJ, 10-19 11:18); released to master in R5 `bb21d5942`.
- 8 files: new `web/lib/projections/modeledHeadTotals.ts` and `.test.ts` (identical blobs on master and octoberBranch); `web/pages/api/v1/start-chart.ts`; `web/pages/api/v1/forge/players.ts` (built on the stale-run age cap, commit `cc3be5c09`); `web/pages/api/v1/db/run-projection-accuracy.ts`; tests `forge/players.test.ts`, `start-chart.test.ts`, `run-projection-accuracy.test.ts`.
- On master the start-chart, players and accuracy files are hand-ported variants (R5 notes: players = A-02/A-08 minus the unreleased `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` gate; start-chart A-08 port was the "optional F2" item). Master's copies contain the helper and `unknownPredictionSkips` (grep verified); octoberBranch's `start-chart.ts` and `players.ts` carry more unreleased work.

## 3. State
- Done and released. Session checks: 4 test files pass (130 passed, 1 skipped; the skip only runs when `START_CHART_ACCEPTANCE_PACKET` is set); ESLint clean on all 8 files; full tsc under the lock exit 0.
- Behaviour: helper returns unknown for any total needing a missing ES or PP value; fully known rows come out unchanged. `forge/players` g, a, pts, ppp, sog are null when a needed value is missing. Accuracy skips a skater row with any unknown needed total, and skips a goalie row entirely (saves and goals-against too) when win probability is null; skips are reported as `unknownPredictionSkips` in the response, per-date range results and scan summary row counts, and nothing is written to the database.

## 4. Next
- None stated.

## 5. Blocked / needs TJ (items the session left outside its scope)
- `web/lib/game-predictions/featureBuilder.ts` lines 1233-1240 still sum partial goals and shots (null only when both ES and PP are missing). Left unchanged as instructed; TJ decides whether model inputs should follow the same rule.
- Pages that turn null back into zero when building rankings: `web/pages/FORGE.tsx:351-353`, `web/components/forge-dashboard/TopAddsRail.tsx:559-561`, `web/pages/forge/player/[playerId].tsx:349-351` (`?? 0`). Displays already show "--" for null. Line numbers are as of the session; not re-checked.
- The accuracy job still treats a missing shutout probability as zero; the writer never stores null there today.

## 6. Insights
- A same-row fixture (ES 0.2, PP null) is the acceptance case: unknown in all three consumers and excluded from accuracy with a count. The start-chart test's masked row was switched to that shape and its sum assertions moved into the helper test.
- On master before R5 all readers agreed on "unknown = 0" (the audit says the disagreement existed only on the branch), which is why the three consumers needed to move together.
- The R5 candidate notes drop the `sumProjectionParts` import and 3 partial-sum assertions from master's `start-chart.test.ts`; the null rule is covered by `modeledHeadTotals.test.ts`.
- The A-20 session's tsc failure (TS2339 at `start-chart.test.ts:291`, `sumProjectionParts` missing) most likely came from this session editing start-chart files mid-flight (the A-20 session only said "presumably another session"); this session's own full tsc exit 0 ran after both files were updated.

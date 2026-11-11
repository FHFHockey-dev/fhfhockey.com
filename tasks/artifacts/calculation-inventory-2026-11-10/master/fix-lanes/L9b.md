# L9b · FORGE goalie path, starters, Start Chart

**Stage 3 (models).** Depends on: nothing hard; coordinates with L9a (shared goalie-quality input). Feeds: L10 (ledger goalie heads), L11 (RSO bridge per-candidate rows). Read `_COMMON.md` first. Codex's 2026-11-04 reservation covers `web/lib/projections/**`, `start-chart`, `api/v1/forge/**`: do the claim step before editing.

## Owned files
- `web/lib/projections/stages/goalie-stage.ts`, `calculators/goalie-starter.ts`, `calculators/goalie-save-pct-context.ts`, `queries/goalie-queries.ts`, `goalie/**` (`leagueSavePct.ts`, `workloadEvidence.ts`, `goalieOutcomes.ts`), `goalieModel.ts`, `goaliePipeline.ts`, `goalieStarterMixtures.ts`, `reserveProjections.ts`, `starterBoard*.ts` (Dataset, Flags, Operations, Personalization, Queue, Scoring, Validation), `startChartContract.ts`, `startChartFantasyScoring.ts`, `startChartTeamForm.ts`, `derived/buildGoalieGameV2.ts`
- `web/pages/start-chart.tsx`, `web/pages/start-chart.module.scss`, `web/pages/api/v1/start-chart.ts`, `web/pages/api/v1/forge/goalies.ts`, `web/components/forge-dashboard/GoalieRiskCard.tsx`, `web/components/StarterBoard*.tsx`, `web/pages/api/v1/db/update-goalie-starter-mixtures.ts`
- **Not** `web/pages/api/internal/starter-board.ts`, `run-projection-accuracy.ts`, `update-goalie-projections-v2.ts` (Codex).

## Findings
| ID | P | Reach | Fix (corrected wording) | Source |
|---|---|---|---|---|
| W1-5 credited start | P0 root | live | Max TOI doesn't identify the credited starter (pulled at 600 s vs reliever at 3,000 s; all 2,699 `toi_seconds` null so the first row wins, `goalie-queries.ts:113-123`): one official `games_started = 1` label per completed team-game, unknown if missing or contradictory; keep last appearance, last credited start and workload separate; key by game id. | BA §W1-5 A; BC Batch A table |
| W1 P0 #16 | P0 | live | Starter probability over-confident. **Fix order (TJ):** actual-start outcome, then timestamps, then pregame cutoffs, then refit. Three-candidate vector sums > 1 (`goalie-starter.ts:236-241`): closed complete sets sum to 1, incomplete sets carry an explicit unknown bucket. Refit is a model change: held-out, separate top-pick from all-candidate calibration, reliability intervals, paired time-ordered comparisons; do not weaken `starterBoardValidation.ts:59-75` (200 games, 30 slates). | BA §W1-5 A, B |
| W1 P0 #17 | P0 cond. | cond. | Start Chart "start probability" is raw L10 share and ignores B2B. **First** establish the effective serving branch (native resolver `start-chart.ts:1196-1242` + `player-forecasts/forecastServingSource.ts`, then `STARTER_BOARD_SERVING_ENABLED` defaulting from `START_CHART_GAME_REVISIONS`) from source; then fix the path that serves. Mixture zeroes the whole team at 1.0001 (M-FRG-092): keep lost mass unresolved, don't redistribute. | BA §W1-5 B; BC §W1-7 B |
| W1 P0 #20 | P0 | live | Goalie row = team slot under one goalie's id; API "Win" = team win (`goalie-stage.ts:656-685,804-824`): one row per candidate (if-starts line, P(start), unconditional product); goalie's own Win separate from team win %; no slot rescale (decision 25). Unconditional = P(start)·E[start] + P(relief)·E[relief] (decision 63) or an explicit, labelled zero-relief assumption; W, regulation L, OTL, no-decision follow the credited outcome. | BC §W1-6 B (D2/D9/D12), C; decisions 25, 63 |
| BC W1-6 D24 / W3-4 N6 | P1 | live | Horizon: no probability × horizon scalar (decision 28) in the goalie stage and goalie metadata; reserve shutout is correctly per game: label its single-game basis (`reserveProjections.ts:143-158`). | BC §W1-6 B; W3 §W3-4 A N6 |
| GSAA .900 readers | P1 | live | Goalie evidence residuals and tiers (M-FRG-031/033) use fixed .900: decision 10 league SV%. ELITE is reachable: the "every tier non-empty" test is rejected. | BC Batch A table; §W1-6 B (D23) |
| W3-4 N1 | P2 | latent | Rest-split SV% inert on one-game WGO rows; unknown rest → `4_plus` bonus: guard against accidental activation now (null rest = unknown); later replacement is held-out vs legacy and no-rest (decision 60). | W3 §W3-4 A N1, E #1 |
| W2-8 PR5 | P1 | live | Selected goalie row is a top-starter scenario mixture read as "per start": candidate identity first, then relief; label "starts only" until qualified. | W2 §W2-8 A D4 |
| BA W1-5 B (issuance) | P1 | live | Immutable pregame issuances: candidate set, receipt clocks, information cutoff, publication time, frozen start; reuse `starterBoardDataset.ts:42-55`. | BA §W1-5 B |
| Accuracy job | P0 part | live | `run-projection-accuracy.ts` scores `actualRow ? 1 : 0`, latest run by date, `_30d` gates on one day, empty Brier subgate passes, actual TOI ≤ 80 as minutes, .900 baseline: **Codex-owned file → blocked on Codex.** Write the proposal (credited-start labels, unknowns excluded, latest pregame issuance per game, real 30-day accumulators, adapter). | BA §W1-5 A; BC §W1-6 D10, §W1-7 |

## Decisions and rules
10, 25, 28, 40, 60, 63, 66; rules 2, 5, 9, 10, 11, 19, 25. **Traps:** every candidate's probability is already stored in metadata (`candidate_goalies`, `daily_board_candidates`); never reconstruct a partner as 1 − p(top); start-only credited wins normally sum below team win; 0.3 shrink and 8.7%/0.09 B2B values are hypotheses.

## Readers and tests
Readers: `/api/v1/forge/goalies`, GoalieRiskCard, Start Chart, skater opponent-goalie weights (L9a), served ledger (L10), RSO bridge and provider override (L11), game-prediction goalie blend (L22). Tests at the final payload: pulled starter vs long reliever; missing/contradictory label → unknown; three-candidate sum; per-candidate rows with distinct ids; relief term or labelled zero-relief; null rest.

## Production steps (TJ approval)
Starter refit promotion only through the existing validation gate; FORGE rerun after landing; any new column for per-candidate rows (migration).

## Tier B questions
None open beyond the settled decisions.

## Out of scope
Skater stage (L9a); ledger (L10); RSO bridge (L11); Codex-owned accuracy and v2 goalie routes; Python starter board issuer (L15, decision 66).

## Done
Credited-start label and P0 #20 contract landed with payload tests; #16 steps 1–3 landed and refit plan written; #17 branch established and served path fixed; Codex proposal filed.

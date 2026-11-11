# L4b · WiGO readers, ratings, writer and player radar

**Stage 2 (readers).** Depends on: L4a (views, game predicate), L8 (decision 71 PP-share definition). Read `_COMMON.md` first.

## Owned files
- `web/utils/fetchWigo*.ts` (`fetchWigoPlayerStats.ts`, `fetchWigoPercentiles.ts`, `fetchWigoRatingStats.ts`), `web/utils/calculateWigoRatings.ts`
- `web/components/WiGO/**`, `web/hooks/useWigoGameLog.ts`, `web/pages/wigoCharts.tsx`, `web/styles/wigoCharts.module.scss`
- `web/pages/api/v1/db/calculate-wigo-stats.ts`
- `web/components/PlayerStats/PlayerRadarChart.tsx` and `web/lib/nst/radarSeasonStats.ts` (radar only; the rest of `components/PlayerStats/**` is L17)

## Findings
| ID | P | Reach | Fix (corrected wording) | Source |
|---|---|---|---|---|
| W1 P0 #8 | P0 | live | Player radar: move **both** the player value and the cohort to 5v5 with the same minimum and season, labelled 5v5 (decision 15); fix rank N+1 of N (`PlayerRadarChart.tsx:428`); radar "HDCF/60" is individual: on-ice value or relabel iHDCF/60. | BA §W1-2 C; nst-derived D6; decision 15 |
| W3-1 D3 | P1 | live | WiGO PP/PK ratings and percentiles gate on games: per-strength minutes floor, visible and user-lowerable, validated by split-half stability, "insufficient sample" below; **F and D cohorts separate** (decision 81). | W3 §W3-1 A D3, E #2; decision 81 |
| W3-1 A3 | P1/P2 | live | Panel checks peers before per-stat null removal (rank 1, 50th alone); ratings divide by available weights (97.6 on 25 of 100 weight units): per-stat finite cohort with its size; partial ratings show coverage or are withheld (Wave 2 Q20 pattern). | W3 §W3-1 B A3 |
| W3-1 D4 | P1 | live | Team drivers print a mean of PP% and PK% percentiles as an ordinal percentile (27th vs 15.6): compute a true composite percentile in the 32-team cohort, or show two drivers. Keep the 90% coverage rule. | W3 §W3-1 A D4, E #3 |
| W3-1 D5 | P1 | live | Game-log and calendar readers filter by season label only: one game predicate (id, season, type 2) via a game ledger; the GP sanitiser stays an alarm. Absent NST rows do not occupy a chart slot. | W3 §W3-1 A D5, E #4 |
| W3-1 A1, A2 | P1 | live | Writer `calculate-wigo-stats.ts:524-541,571-581` `?? 0` zeroes unknown seasonal ixG/goals/points (STD/LY/3YA/CA); reader `derivePer60` (`fetchWigoPlayerStats.ts:301-349`) revives a published null rate from WGO minutes: metric-level support at the writer; the reader never revives a null (rule 23). | W3 §W3-1 B, E #5 |
| W3-1 D9, D11, D12 | P2 | live | One-side "overall" fallback; shrink is continuous at 10 GP (no "hard step" fix); unweighted recent `pp_pct` (pool by PP time, per L8's decision 71 definition); IPP across WGO 67 / NST 66 GP; `gp = max`; DIFF on percent stats is a label issue. | W3 §W3-1 A |
| W2-1 D9 (reader) | P2 | live | OZS% in WiGO percentiles inherits the SQL error; reader follows L4a's corrected view. | W2 §W2-1 A D9 |

## Decisions and rules
9, 15, 16, 69, 71, 74, 81; rules 5, 13, 20, 22, 23, 26. **Traps:** mid-rank percentile helper stays (Q41); provider GP ≠ games with time at strength; do not change social shared definitions or MCM.

## Readers and tests
Readers: `/wigoCharts` comparison matrix, DIFF, reference lines, game-log/PPG/Consistency/TOI/Game Score charts, `gameLogMean.ts`, `PlayerRatingsDisplay.tsx`, `TeamPerformanceDrivers.tsx:104`, the player radar wherever it mounts. Tests: published null → served null end to end; full, one missing stat, one missing side, zero cohort; 32-team driver fixture (compute the true rank, do not hard-code 70); selected-stat and shared-calendar tests with a playoff and a mislabelled-season row.

## Production steps
WiGO seasonal rows rebuilt by `calculate-wigo-stats` after the writer fix (bounded, TJ approval). Depends on L4a's view migrations being applied first.

## Tier B questions (Chef asks at start)
Q41 one percentile convention (recommended: keep both, label each; WiGO, social and the radar mid-rank). Q2 answered: decision 85 (house Game Score, labelled).

## Out of scope
SQL views (L4a); `components/PlayerStats/**` other than the radar (L17); rankings percentile (L5).

## Done
Radar P0 fixed with cohort/value 5v5 tests; P1s fixed with reader-level tests; rebuild plan for Chef.

## Reader tickets from L4a (2026-11-11; migrations 125–132 written, unapplied)
NST season views (migrations 125/126) return NULL, not 0/50/100, for unknown or zero-denominator rates and shares, and fewer GP (regular season only). WiGO percentiles, `radarSeasonStats.ts`, `fetchWigoRatingStats.ts` and `fetchWigoPlayerStats.ts` must render NULL as unknown. Game Score RPC (127) is scoped to the season's type-2 games; the visible chart label (`GameScoreLineChart`) is yours (decision 85). Also own `web/pages/api/v1/player/[id]/percentile-rank.ts` (granted): it returns zeros for a player with no games (rule 5).
Migration 133 (`percent_games`): NULL for multi-team seasons; the radar (`radarSeasonStats.ts`, `PlayerRadarChart.tsx`) must treat NULL as unknown.

# Recent Team Form v2: checkpoint protocol for predictive use (2026-27)

**Status:** written 2026-11-13 from TJ's direction, before any 2026-27 forecast batch was graded. **Frozen 2026-11-13:** TJ adopted every completed game 10 … 30 as the formal set (section 3).

Harness: `ctpi-v2-checkpoints.ts`, which reuses `ctpi-v2-validation.ts` and is offline over CSV inputs.

## 1. Forecasts

- **Issue point.** Forecast k for team t is issued when t has completed k games, for every k from 10 to 40. The formal set is k = 10 … 30.
  - The snapshot date D is the day after t's k-th game; the inputs are games strictly before D, so exactly games 1 … k.
  - Team game counts come from the regular-season schedule (`games`, type 2), not calendar dates.
- **Target.** t's games k+1 … k+10: goal differential per game, and points% (points ÷ 20; W = 2, OTL = 1).
  - Results come from the NST all-situations team counts.
  - A forecast **matures** when all 10 games are played and have result rows.
- **Matched variants,** all from the same pregame inputs and date:
  - v1 (with PDO) and v1 without PDO;
  - v2 (without PDO) and v2 + PDO (v1's hand-set 0.1 weight; exploratory, rule 12).
- **Checks on the inputs.**
  - Issued v2 rows are checked against the offline v2 recompute (32 of 32 equal at game 10).
  - Historically issued v1 rows (stored through 2026-11-13) are reported separately and never mixed into the comparison.
- **Eligible:** matured, and all four variants score the team.

## 2. Schedule (each team's completed games, not calendar dates)

Dates are projected from the 2026-27 schedule; postponements move them.

| Look | When (all 32 teams have completed) | Content | Status |
|---|---|---|---|
| Game 10 | Done by 2026-10-27 | Coverage, stability, whether the display is understandable | **Run 2026-11-13 (below)** |
| Game 20 | About 2026-11-21 | First fully graded batch (forecasts issued at game 10) | Informational |
| Game 30 | About 2026-12-12 | Batches 10 … 20 matured; does the comparison hold? | Informational |
| Game 40 | About 2027-01-04 | **Formal decision** on eligible, fully matured forecasts from batches 10 … 30 (672 if all are eligible) | Decision |
| Game 50 | About 2027-01-24 | Forecasts issued at games 31 … 40 mature (reported, not part of the decision) | Informational |

- **Complete batches only.** A batch is graded only when every team has reached checkpoint k and every team's window has been played; there are no partial peeks.
- **Informational looks** (games 20 and 30) are reported, but they are not chances to pass.
- **Formal look guard.** The script refuses a formal look before every team has completed game 40.

## 3. Statistic, margin, and decision

- **Statistic.** For each batch, take the Spearman correlation across teams between the score and the target. The headline Δ is the mean over batches of ρ(v2) − ρ(v1), for GD/game and for points%.
  - v2 vs v1 without PDO, v2 + PDO vs v1, and each version's PDO on/off effect are reported beside it.
- **Margin:** the preset −0.03, judged on unrounded values.
- **Uncertainty,** with the wider interval used for the decision:
  - (a) A team-cluster bootstrap (2,000 draws; one team draw applies to every batch).
  - (b) A dependency-graph jackknife. Leave-one-forecast-out pseudo-values; forecasts are linked when they belong to the same team, or when one's target games intersect the other's target or input games. This covers shared games and overlapping windows; the independent-jackknife variance is the floor.
- **Decision at game 40:**
  - **Pass:** the lower 95% bound is ≥ −0.03 for both targets. Then propose the successor approval change: `approved` from a stated date, candidate rows never relabelled. The approval itself is a separate TJ decision.
  - **Inferior:** the upper bound is < −0.03 for either target. Then report the options.
  - **Otherwise inconclusive:** keep the descriptive beta and leave predictive use gated.

### Formal set: every completed game 10 … 30 (TJ, 2026-11-13)

TJ chose this set over the 10/20/30 batches, by pop-up, before any 2026-27 batch was graded. The choice was based on this rehearsal on 2025-26:

| Formal set (rehearsed on 2025-26, as of season end) | Forecasts | Δ v2 − v1, GD/game | Δ v2 − v1, points% | Outcome |
|---|---|---|---|---|
| Batches 10, 20, 30 | 96 | −0.014 [−0.090, +0.063] | +0.014 [−0.056, +0.088] | inconclusive |
| Every game 10 … 30 (overlapping windows) | 672 | +0.008 [−0.024, +0.044] | +0.025 [−0.008, +0.059] | pass |

- **What the rehearsal shows.** The batch design's interval (about ±0.075) is more than twice the margin, so at game 40 it can almost only return "inconclusive". The every-game design halves the width (about ±0.035), so a decision becomes possible.
- **The adopted set is the script's default.** `--batches-only` reproduces the batch design for reference only.
- **What it does not show.** 2025-26 was already analysed, so these rehearsal outcomes are a power check, not evidence for approval.
- Both designs use the same checkpoints, margin, uncertainty method and decision rule.

## 4. Game-10 look (2026-27, run 2026-11-13; informational)

| Check | Result |
|---|---|
| Coverage at game 10 | 32 of 32 teams issued (issue dates 2026-10-18 → 10-28); all `ready`; no missing components; PDO context for all 32 |
| Issued v2 vs offline recompute | 32 of 32 equal |
| v1 and v2 rank agreement at game 10 | Spearman 0.976 |
| Day-to-day stability (issued v2 rows, 2026-10-07 → 11-13, 1,102 rows) | Rank Spearman between consecutive days: mean 0.963 (min 0.896) |
| Display score moves after a team game | Median 1.98 points, p90 4.62, max 10.1 |
| Moves with no team game (league re-centring only) | Median 0.17, p90 0.53, max 1.06 |
| Weekly change | Median 3.35, p90 8.08; 3.2% of team-weeks move more than 10 points |
| Display understandable | Pending TJ's review of `DISPLAY-PLAN.md`, then a local screenshot of the built card |

- **Grading so far.** No batch is graded yet: only 16 teams have completed game 20.
- **Discarded development run.** One development run, before the complete-batch rule existed, computed figures for those 16 teams. Those figures are not part of the protocol and are not reported.

## 5. Inputs for each look (read hygiene)

- **Read pass:** one read-only pass after `pg_stat_activity` shows 5 or fewer active queries and none older than 10 s.
- **Tables:**
  - the four NST team game-log tables (selected columns, `gp = 1`, the season);
  - `team_ctpi_daily` (`ctpi_version, season_id, team, date, ctpi_raw, ctpi_0_to_100`; no jsonb);
  - the `games` schedule joined to `teams` for abbreviations.
- No NST or NHL calls.
- **Command,** from `web/`:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/artifacts/calculation-inventory-2026-11-10/master/production/ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts --data=<csv dir> --season=20262027 --as-of=<YYYY-MM-DD> --out=<json> [--formal]
```

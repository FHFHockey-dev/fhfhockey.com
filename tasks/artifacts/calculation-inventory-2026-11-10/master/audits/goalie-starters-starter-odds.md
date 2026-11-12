# Audit: Goalie starters and starter odds (M-GST-001 to M-GST-020)

Wave 1, pass W1-5. Audited 2026-11-10 against `octoberBranch` at `ae529a5f3` plus the dirty working tree. No code was changed. Line numbers are from the current checkout; paths are relative to the repo root.

**How this was done.** I read every cited file myself and followed each start probability from its writer to its readers. I then ran bounded, read-only SQL against production (aggregates over `goalie_start_projections`, `forge_goalie_projections`, `forge_goalie_game`, date-indexed reads of `wgo_goalie_stats`, and catalog reads). `pg_stat_activity` showed 0 or 1 active queries before each read. No NHL API, NST or Yahoo calls, no writes, no tests run.

**Two served start probabilities exist.** They are different numbers with different populations:

| Name in this report | Where it is made | What it is | Who shows it |
|---|---|---|---|
| **L10 share** | `web/pages/api/v1/db/update-goalie-projections-v2.ts:427-429`, stored as `goalie_start_projections.start_probability` | The goalie's credited starts (NHL `gamesStarted`) in the team's last 10 game dates, divided by those dates | Start Chart goalie rows when the starter-board serving flag is off (`web/pages/api/v1/start-chart.ts:838-844`, `:1539-1556`); RSO start shares when FORGE has no row; game-prediction goalie weights; the FORGE prior |
| **FORGE probability** | `web/lib/projections/calculators/goalie-starter.ts:126-243`, stored as `forge_goalie_projections.starter_probability` for the top-ranked goalie only (`web/lib/projections/stages/goalie-stage.ts:447-456`, `:812`) | A hand-weighted score turned into a probability by a sigmoid (two candidates) or softmax (three) | RSO expected goalie stats and the "Likely starter" mark (`web/lib/rosterScheduleData/forgeDailyBridge.ts:566`), the FORGE goalies API, the starter board |

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 10 | 005, 007, 009, 010, 011, 012, 013, 014, 017, 020 |
| Mis-specified | 3 | 008, 015, 016 |
| Wrong | 7 | 001, 002, 003, 004, 006, 018, 019 |
| Undetermined | 0 | |

M-GST-002 and M-GST-004 are the same code (the v2 route), and M-GST-001 and M-GST-003 are the same legacy SQL function, so the seven "wrong" entries are five distinct pieces of code.

The descriptive side of this family is in good shape: the social-share start shares, team lenses, rank bands, board scoring and the operations report all do what they say. The problems are in the two numbers that are called probabilities, and in the bookkeeping around the table that feeds them.

### Top 5 findings by user impact

1. **The FORGE starter probability is far too confident (M-GST-006, P0).** Over 300 team-games this season (2026-10-01 to 11-09, latest run created before puck drop), the top-ranked goalie's mean stated probability was **0.83** and he started **60%** of the time. In the 0.95 to 0.98 bin (70 team-games) he started 64%. The Brier score is **0.294**, worse than the 0.25 a coin flip earns and above the project's own 0.20 launch gate. Anything that multiplies a goalie's "if he starts" line by this probability inherits it: on average the named starter's expected saves and wins are about **37% too high** and his partner's about **56% too low**. The main cause is that the recent start share is counted three times in the score (finding detail in M-GST-006).
2. **The Start Chart's "start probability" is a raw 10-game share, and it ignores back-to-backs (M-GST-002/004, P0).** Reconstructed pregame over 2,311 team-games, a 90% share turned into a start 60% of the time and a 10% share 22% of the time. On the second night of a back-to-back the goalie who started the night before carried an average share of 55.5% and started **8.7%** of the time (392 team-games).
3. **`goalie_start_projections.updated_at` never changes after the first insert (new, P1).** All 8,941 rows have `updated_at = created_at`; the upsert sends no timestamp and the table has no trigger. Today's rows were refreshed at 09:30 UTC but still say 2026-11-07. Three guards read this column and so do nothing useful: the Start Chart's staleness flags (every goalie has been "hard stale, low confidence" on game day since about 10-28), the Start Chart's as-of filter, and the game-prediction as-of filter (which uses `created_at`).
4. **Stored history is post-game, and the accuracy job scores the wrong outcome (M-GST-002/004, P1).** 96% of last season's rows and every row from 2026-09-29 to 10-21 include the target game itself in the L10 share. Scored against who actually started, those stored values earn a Brier of 0.164 where the honest pregame value earns 0.198, a 17% flattering. Live FORGE runs are not affected (they read the row on game morning), but 1,514 team-games have only FORGE runs created after puck drop, and the accuracy job scores the latest succeeded run without a puck-drop check. Separately, that job scores the starter probability against "has any stat row that day", which counts a relief appearance as a start.
5. **FORGE's starter context is built on a column that is always null (M-GST-019, P1).** `forge_goalie_game.toi_seconds` is null on all 2,693 rows, so "starter = most ice time" picks whichever row comes back first. This season 33 of 556 team-games (5.9%) have two goalie rows. The same function gives a newly acquired goalie no last-played date, which costs him 6 logits (a start chance near 2%), and the line-combination prior lists both dressed goalies in 400 of 400 recent rows, so it cannot separate them.

### Answers to the brief's questions

**What population is each start probability about?**

| Number | Numerator | Denominator | Unit |
|---|---|---|---|
| v2 `start_probability`, `l10_start_pct` | Credited starts | Team game dates in the last 10 dates with a goalie log | Team-game |
| v2 `season_start_pct` | Credited starts | Team game dates this season | Team-game |
| Legacy SQL (dead) | Credited starts | All credited starts in the window, not team games | Credited start |
| FORGE `starter_probability` | Modelled chance that this candidate starts | One team-game | Team-game; history counts "the goalie with a row that date", in effect an appearance |
| Mixture `normalized_start_probability` | The v2 value, capped so the team total is at most 1 | | Team-game; missing mass means "unresolved" |
| RSO `startProbability` | FORGE's value for its top goalie; the rest share 1 − p | | Team-game |
| Social share `teamStartShare` | Official starts | Completed team games | Team-game, descriptive |
| GoalieShareChart pie | Appearances, relief included | All appearances | Goalie-appearance, descriptive |
| Accuracy job's starter Brier | FORGE top goalie's probability | Outcome is "appeared", not "started" | Mixed (defect D5) |

**Does look-ahead reach any accuracy report?** Yes, by two routes, and no by one. Live daily runs are clean. Backfilled FORGE runs for past dates read post-game rows and are eligible for scoring (finding 4). Any offline evaluation that reads stored `goalie_start_projections` for dates up to 2026-10-21 is inflated. Since 10-22 the stored rows have stayed pregame, but only by accident: the pipeline's second daily call writes rows up to six days ahead, which stops the 09:30 run from re-processing yesterday (`update-goalie-projections-v2.ts:224-231`). If that second call stops, the next-day rewrite returns.

**Do team start probabilities sum to 1 on every path?**

| Path | Sums to 1? | Tested? |
|---|---|---|
| v2 rows per team-game | 349 of 354 team-games since 10-22; 5 below 1 (lowest 0.80) after a departed goalie is excluded; none above | No sum test in `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts` |
| Mixture (`goalieStarterMixtures.ts:165-173`) | By design at most 1; missing mass is kept as residual; a total above 1 zeroes every row | Yes (`goalieStarterMixtures.test.ts:111-125`) |
| Mixture back-to-back branch | No: the repeat starter is cut to 65% and nothing is added to the other goalie | Yes, the test asserts the shortfall (`:89-109`) |
| FORGE, two candidates | Exactly 1 (`goalie-starter.ts:228-234`) | Only two-candidate cases are tested |
| FORGE, three candidates | Within about ±0.02: values are clamped to 0.01–0.98 after the softmax and not renormalised (`:236-241`) | **No test** |
| Top-2 scenarios | Renormalised to 1 (`:258-263`), used as a label only; the blend weights by raw probability plus residual, which totals 1 (`:56-57`) | Yes (`runProjectionV2.test.ts:2007-2021`) |
| News override, CONFIRMED | 1 and 0 | Yes |
| News override, LIKELY | No: 0.5–1 for the named goalie, 0 for the rest (`preflight-stage.ts:173-176`) | No |
| RSO bridge | 1 when every roster goalie has a share; less when one is unknown (`forgeDailyBridge.ts:575-584`) | RSO packet |
| Game-prediction weights | Renormalised to 1 (`web/lib/game-predictions/featureBuilder.ts:1424-1433`) | Game-predictions packet |

**Is GSAA with a fixed .900 acceptable?** The arithmetic is right: saves − shots × .900 equals Hockey-Reference's GSAA with .900 as the league rate. The constant is not the league rate. Stored league save percentage is **.8962** for 2025-26 and **.8907** for 2026-27 to date, so an exactly average goalie shows about −0.11 and −0.26 GSAA per 60 in those seasons (the stored median this season is −0.35). The value is also unshrunk: 39% of this season's rows are outside ±0.6, with a range of −6.60 to +2.85. For starter odds the damage is small, because the bias is nearly the same for both goalies on a team and FORGE clamps the input to ±0.6. For anything that shows the number or compares teams it is a biased, noisy figure. FORGE's projection stage already uses a season league rate (`goalie-stage.ts:186`); the prior should too.

**Does L10 share enter FORGE twice?** Three times. Once directly from `forge_goalie_game` (`goalie-starter.ts:168`, `:190`, weight 2.4), once as the logit of the v2 prior, which is the L10 share from the NHL API (`skater-stage.ts:3560-3563`, `goalie-starter.ts:191`, weight 0.7), and once more as the season share (`:194-197`, weight 0.28). For two goalies with complementary shares the score gap is 4.8 × (s − 0.5) + 1.4 × logit(s): a 70% share becomes a 90% probability and an 80% share 97%, where the measured start rates are 62% and 65%.

### Reliability tables

**Table A. L10 share as a pregame probability.** Regular-season team-games from 2025-10-07 to 2026-10-21 where the team had at least 10 earlier games: 2,311 team-games, 6,314 goalie rows. The pregame share for game k is the stored post-game share of the team's game k − 1. Outcome: `wgo_goalie_stats.games_started = 1` on the game date.

| L10 share | Goalie rows | Started |
|---:|---:|---:|
| 0.0 | 1,247 | 4.0% |
| 0.1 | 394 | 21.6% |
| 0.2 | 539 | 31.5% |
| 0.3 | 786 | 32.7% |
| 0.4 | 741 | 39.4% |
| 0.5 | 858 | 47.8% |
| 0.6 | 726 | 56.5% |
| 0.7 | 588 | 61.6% |
| 0.8 | 339 | 64.9% |
| 0.9 | 88 | 60.2% |
| 1.0 | 8 | 50.0% |

| Predictor (same 6,314 rows) | Brier |
|---|---:|
| Constant base rate (36.6%) | 0.232 |
| L10 share, pregame | 0.198 |
| Season share, pregame | 0.197 |
| Mean of L10 and season share | 0.193 |
| 0.12 + 0.62 × L10 share (eyeball shrink, fitted on the same rows) | 0.195 |
| Stored value for the game itself (post-game, look-ahead) | 0.164 |

| Situation | Team-games | Share said | Started |
|---|---:|---:|---:|
| Back-to-back second night, goalie who started the night before | 392 | 55.5% | **8.7%** |
| Back-to-back second night, other goalies with a share above 0 | 455 rows | 37.7% | 73.0% |
| Rested, goalie who started the previous game | 1,941 | 54.9% | 46.6% |
| Rested, other goalies with a share above 0 | 2,298 rows | 37.2% | 43.4% |

The brief asked for a sanity range from published back-to-back studies. I measured the repeat-starter rate on the site's own data instead (8.7%) and cite no study.

**Table B. FORGE `starter_probability`, top-ranked goalie.** Regular-season team-games 2026-10-01 to 11-09, latest horizon-1 run created before puck drop: 300 team-games.

| Stated probability | Team-games | Mean stated | Started |
|---|---:|---:|---:|
| 0.50–0.60 | 41 | 0.554 | 46.3% |
| 0.60–0.70 | 23 | 0.648 | 43.5% |
| 0.70–0.80 | 42 | 0.759 | 73.8% |
| 0.80–0.90 | 65 | 0.852 | 61.5% |
| 0.90–0.95 | 57 | 0.931 | 63.2% |
| 0.95–0.98 | 70 | 0.973 | 64.3% |
| 1.00 | 2 | 1.000 | 0% |
| **All** | **300** | **0.827** | **60.3%** |

Brier 0.294. Over the 264 team-games from 10-22, FORGE's top pick started 59.8% of the time; picking the goalie with the larger L10 share got 54.2%. FORGE's ranking is a little better than the raw share. Its confidence is the problem. The accuracy job's own stored values for two recent days were 0.352 and 0.231 against a gate of 0.20 (`web/pages/api/v1/db/run-projection-accuracy.ts:422`).

Pregame FORGE rows from December 2025 to March 2026 all carry exactly 0.5 and the named goalie started about 15% of the time. That is an older code state and is left out of Table B.

## 2. Per-entry table

"HR" is Hockey-Reference's GSAA (shots against × (1 − league SV%) − goals against, season league rate). "Calibration" is the reliability-table and Brier standard in the brief.

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| M-GST-001 | Wrong (dead) | `supabase/migrations/20260716112908_production_schema_baseline.sql:2733-2737`: GSAA is (SA × .900 − GA) ÷ TOI × 60, which is expected saves minus goals against; `:2708` assumes minutes, stored `time_on_ice` is seconds (3,600 for a full game). Start share divides by total starts, not team games (`:2731`). The function still exists in the database; its coordinator is a tombstone (`supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:8`) | HR | An average goalie facing 28 shots a game would get about +0.37 instead of 0 | No caller found in `web/`. Nothing live |
| M-GST-002 | Wrong | v2 route. Look-ahead filter `update-goalie-projections-v2.ts:365-367` (comment `:357-363`); L10 share as probability `:427-429`; fixed .900 `:431-433`; upsert payload has no `updated_at` (`:435-446`, `:77-79`) | Calibration; HR | Tables A; finding 3; GSAA bias −0.11 and −0.26 per 60 | Start Chart, FORGE prior, RSO shares, rankings start share, game predictions, lineup-source model row |
| M-GST-003 | Wrong (dead) | Same function as M-GST-001 (`migrations/20251126_calculate_goalie_projections.sql:28-95`) | HR | As M-GST-001 | None |
| M-GST-004 | Wrong | Same code as M-GST-002. Eligibility filters are sound: current roster for today onward, latest observed team for history (`:133-172`, `:352`, `:416-423`). `confirmed_status` is always false (`:445`; 0 of 8,941 rows true) | Calibration; HR | As M-GST-002 | As M-GST-002 |
| M-GST-005 | Sound | Expected = conditional × start probability with zero relief minutes, stated in the payload (`web/lib/projections/starterBoardScoring.ts:62-66`, `:185-188`); points withheld if a weighted category is missing (`:50-60`); goals against negated for sorting (`:256`); competition ranks. Status is labelled `uncalibrated_model` | Expected value = P(start) × conditional | None in the arithmetic. It inherits the FORGE probability | Starter board; only one revision row exists (2026-09-28), so this path is barely exercised in production |
| M-GST-006 | Wrong | `web/lib/projections/calculators/goalie-starter.ts:166-226`. Share counted three times (`:190`, `:191`, `:194-197`). Three-candidate clamp without renormalising (`:236-241`). Back-to-back terms (`:200-204`) are in a sensible range: they take a 55% goalie to about 6%, against 8.7% measured | Calibration | Table B: 0.83 stated, 0.60 observed, Brier 0.294 | RSO expected goalie stats and "Likely starter" text, FORGE goalies API, starter board, the accuracy gate |
| M-GST-007 | Sound | Candidate ranking is a tie-breaking heuristic (`goalie-starter.ts:103-123`); scenarios `:245-266`; the blend is a correct mixture mean with the residual sent to the fallback line (`:42-73`) | Mixture expectation | None | Goalie stage |
| M-GST-008 | Mis-specified | `web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx:204-207` prints "Likely starter (p%)" for p ≥ 0.5 | Calibration | The printed percentage is the FORGE value: at "95–98%" the goalie started 64% | RSO slot grid |
| M-GST-009 | Sound | Nearest-rank percentiles (`web/lib/projections/starterBoardOperations.ts:19-23`); late and unseen events stay in the denominator (`:70-81`); any out-of-order timestamp is marked invalid, so a null latency cannot pass as on time (`:45-58`); limits are stated (`:105-109`) | Nearest-rank percentile; on-time share | None | Admin release route |
| M-GST-010 | Sound | `web/lib/socialShare/modules/shared/goalieBoards.ts:34-39`. Colour strength is relative to the largest value shown, as the comment says | None | Colours are not comparable between posts, by design | Goalie board posts |
| M-GST-011 | Sound | Rates are pooled sums over games (`web/lib/socialShare/modules/shared/goalieInventory.sources.ts:137-141`); PP% and PK% match the NHL definitions (`:175-176`); ranks only when every team has the value for every game (`:184-188`); the weaker-opponent flag is null on ties or unknowns (`:283-291`) | NHL.com PP% and PK% | None. Goal differential per game is not schedule-adjusted, which the name does not claim | Start/Sit, Risky Starts |
| M-GST-012 | Sound | `goalieInventory.sources.ts:369-389`. With 32 teams the bands are ranks 1–11, 12–21, 22–32. Head-to-head compares two league ranks, which is a fair like-for-like scale | None | Rank cuts ignore the size of gaps; acceptable for a chip | Risky Starts, Start/Sit |
| M-GST-013 | Sound | `web/lib/socialShare/modules/shared/goalieLedger.ts:61-81`: official starts ÷ team games, relief counted apart, withheld unless every game has exactly one labelled starter. The inner `share` is 0 rather than null when incomplete (`:79`); both callers check `complete` first (`creaseShift.ts:117`, `goalieInventory.sources.ts:308`) | Starts ÷ team games | None | Crease Shift, Goalie Period, inventory |
| M-GST-014 | Sound | `web/lib/goalieWorkload.ts:61-118`: SV% pooled, GAA = GA × 3,600 ÷ TOI seconds, starts withheld unless complete; the pie is appearance share and the docblock says so. `workloadEvidence.ts` is descriptive and dormant by its own label | NHL SV% and GAA | None | GoalieShareChart |
| M-GST-015 | Mis-specified | CONFIRMED → 1 is sound (`web/lib/projections/stages/preflight-stage.ts:167-184`, `web/lib/projections/dailyBoardEvidence.ts:224-229`). LIKELY stores 0.5–1 for the named goalie and 0 for every other candidate, and the stat line is still 100% his (`goalie-stage.ts:398-410`) | Mixture expectation | No live effect: `forge_roster_events` has 0 goalie rows | FORGE goalie stage |
| M-GST-016 | Mis-specified | Precedence is sensible (`web/lib/sources/lineupSourceIngestion.ts:1746-1792`). The model source declares a 4-hour life (`:162-167`) but is built with no expiry (`:1739`), and no expiry means always fresh (`:285-292`) | None | The model row never ages out. It ranks last, so it only shows when no news source exists | Lineup-source provenance, Start Chart badges |
| M-GST-017 | Sound | `web/lib/projections/starterBoardValidation.ts:55-77`. Note: a protected metric blocks promotion only when it is worse by more than 2% **and** the interval excludes zero (`:70`), so a noisy 10% drop passes. That is a weak guard, not an error | Paired comparison with intervals | No review exists yet | Validation disclosure |
| M-GST-018 | Wrong | Staleness and confidence read `updated_at` (`web/lib/projections/goalieStarterMixtures.ts:181-183`, `:93-105`). The back-to-back cut (`:159-161`) is never reached from the Start Chart, which passes no back-to-back inputs (`start-chart.ts:1539-1542`). The mixtures route writes to `nhl_goalie_starter_mixture_distributions` (`web/pages/api/v1/db/update-goalie-starter-mixtures.ts:134`), which does not exist in the database | Calibration | Every Start Chart goalie is flagged hard-stale on game day. If the cut were applied it would say 36% where 8.7% is measured, and leave the other goalie at 38% where 73% is measured | Start Chart payload (`start-chart.ts:1710-1712`, `:1866`) |
| M-GST-019 | Wrong | Starter by greatest TOI (`web/lib/projections/queries/goalie-queries.ts:113-123`) with TOI always null (`web/lib/projections/derived/buildGoalieGameV2.ts:138`); last-played is team-scoped and set only for "starters" (`:126-144`); line-combo prior counts every listed goalie (`:42-58`) | None | 5.9% of this season's team-games ambiguous; an acquired goalie is treated as 75+ days idle (−6); prior is 1.0 for both dressed goalies in 400 of 400 rows. `forge_goalie_game` also has gaps: 102 of 484 team-games in March 2026 | FORGE starter probability |
| M-GST-020 | Sound (dead) | `web/components/Variance/skaterVariance.ts`. Population standard deviation of points + 0.1 × shots. Only its own test imports it | None | None | None. It is a skater helper filed in the goalie family |

## 3. Defects

**D1 (P0). FORGE starter probability is uncalibrated and over-confident (M-GST-006).**
- *Fix.* Enter recent usage once. Fit the score on stored history as a logistic model (shrunk start share, back-to-back flag, rest days, who started last) and check it against Table B's layout on held-out dates. As a stopgap, shrink the score gap before the sigmoid; the measured means suggest a factor near 0.3. Renormalise after the three-candidate clamp.
- *Tests.* A frozen fixture of at least 200 team-games with outcomes: the mean stated probability must be within 0.05 of the observed start rate, and the Brier score must beat 0.25. A unit test that three-candidate outputs sum to 1.
- *Affected.* RSO goalie lines, the starter board, the FORGE goalies API.

**D2 (P0). The served "start probability" on the Start Chart is the raw L10 share (M-GST-002/004).**
- *Fix.* Either label it "L10 start share" and stop calling it a probability, or serve a calibrated value. A cheap honest version: the mean of L10 and season share on rested days (Brier 0.193), and on a back-to-back about 0.09 for the goalie who started the night before with the rest given to the other goalies.
- *Tests.* The same reliability fixture as D1. A route test that a back-to-back second night does not give yesterday's starter more than the other goalie.

**D3 (P1). `updated_at` is never advanced (M-GST-002/004/018/016).**
- *Fix.* Add `updated_at: new Date().toISOString()` to each upsert row (`update-goalie-projections-v2.ts:435-446`). A database trigger would also work but is a migration and needs approval. Then point as-of filters at a column that means "content as of".
- *Tests.* Route test: every upserted row carries a fresh `updated_at`. Mixture test: a row refreshed an hour ago is not stale.

**D4 (P1). Stored history contains the target game (M-GST-002/004).**
- *Fix.* Compute the prior from logs strictly before the game date. If the owner wants a post-game tally, keep it in separate columns. Mark or recompute rows through 2026-10-21 before any backtest reads them; a recompute means NHL API calls and needs approval. Do not rely on the second daily call to keep rows pregame.
- *Tests.* Route test: a completed game with a log on its own date yields a row that excludes that log.

**D5 (P1). The accuracy job's starter Brier uses the wrong outcome and can score post-game runs.**
- *Where.* `web/pages/api/v1/db/run-projection-accuracy.ts:2073-2083` scores against "an actuals row exists"; run selection near `:1726-1738` has no puck-drop filter.
- *Fix.* Score against the credited start (`wgo_goalie_stats.games_started`), score every candidate rather than only the top one, and only score runs created before the game's start time.
- *Tests.* A relief appearance scores 0; a run created after `startTime` is skipped.

**D6 (P1). FORGE starter context (M-GST-019).**
- *Fix.* Take the starter from the official label in `wgo_goalie_stats`, or write real ice time into `forge_goalie_game`. Read last-played across teams. Drop the line-combination prior or rebuild it from a source that names the starter.
- *Tests.* A date with a starter and a reliever returns the starter. A goalie traded yesterday has days-since-played of 1.

**D7 (P1). Mixture layer (M-GST-018).**
- *Fix.* Feed staleness from the D3 timestamp. Remove the 0.65 cut, or replace it with measured rates and move the mass to the other goalie. Delete the mixtures route or create its table.
- *Tests.* Covered by D2 and D3 tests, plus a route test that fails loudly when the target table is missing.

**D8 (P2). GSAA baseline and noise (M-GST-002/004).** Use the season league save percentage and shrink by shots faced (add a fixed number of league-average shots). *Test:* a league-average goalie returns 0; a 5-shot relief outing returns close to 0.

**D9 (P2). Legacy SQL (M-GST-001/003).** Drop `process_team_goalie_projections`; it is still callable and its GSAA is wrong in formula and units. *Test:* extend `web/lib/supabase/supportedBaselineMigration.test.ts` to expect its absence. Needs an approved migration.

**D10 (P2). RSO "Likely starter (p%)" (M-GST-008).** Print the percentage only once D1 is fixed; until then the word "Likely" alone is more honest.

**D11 (P2). LIKELY override (M-GST-015).** Give the remaining mass to the other candidates. No events exist today, so this is latent.

**D12 (P2). Model source expiry (M-GST-016).** Set `freshnessExpiresAt` from the D3 timestamp plus 4 hours. *Test:* a 5-hour-old model row is not selected.

**D13 (P2). Dead code (M-GST-020).** Delete `skaterVariance.ts` and its test, or move it to the skater family.

## 4. Questions for the owner

1. Is `STARTER_BOARD_SERVING_ENABLED` on in production? It decides which probability the Start Chart shows. Only one revision row exists (2026-09-28), which suggests it is off.
2. Until a calibrated model exists, should the Start Chart value be relabelled "L10 start share", or replaced with the shrunk blend in D2?
3. Should stored rows keep a post-game "rolling tally" at all (the code comment says a user asked for it)? If so, it needs its own columns.
4. Owner decision 10 records GSAA as "shots against × league SV% − GA". That expression is expected saves minus goals against, the same slip as the legacy SQL. Hockey-Reference's GSAA is shots against × (1 − league SV%) − GA. Please confirm the second form is the contract.
5. May `process_team_goalie_projections` be dropped from the database?
6. May a refit of the starter model use a one-off local export of last season's goalie starts?

## 5. Limits

- **Serving flag.** I could not see production environment values, so I describe both Start Chart paths rather than the one in use.
- **Table A is a reconstruction.** It uses each team's previous stored row as the pregame share, restricted to teams with 10 or more earlier games. Candidates are the goalies eligible at the previous game. It does not know about injuries or call-ups on the day.
- **Table B is small.** 300 team-games over six weeks, and only the top-ranked goalie's probability is stored, so the partner's calibration is inferred. Bins of 23 to 70 are noisy; the overall gap (0.83 against 0.60) is not.
- **Post-game content** was confirmed by comparing stored `games_played` with the goalie's game count: 2,691 of 2,791 checked rows for 2025-26 and 323 of 323 for 2026-09-29 to 10-21. Playoff rows were not checked.
- **No NHL API calls.** I did not confirm the live payload's `gamesStarted` or `timeOnIce` fields; the seconds unit is inferred from `wgo_goalie_stats`, which stores the same feed.
- **Fixtures.** `web/scripts/forge-goalie-backtest.ts` reads fixture files that are not in the repo, so I did not run it. I read the social-share code and tests but did not execute them. No test suite was run.
- **Display.** I found the stale flags and confidence in the Start Chart API payload but no component that renders them, so their on-screen effect is unconfirmed.
- **Not math, seen in passing.** The pipeline's call to the v2 route failed on 2026-11-05, 11-06 and 11-07 with every row rejected (224 to 230 rows each); the 09:30 run still refreshed each game day. `forge_goalie_game` is missing most team-games for March and April 2026.
- **Back-to-back studies.** None cited; the rate is measured on stored data.

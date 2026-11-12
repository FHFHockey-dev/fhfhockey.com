# Triage: where the math audit should look first

Triage pass over the 35 audit packets in [packets/](packets/), written 2026-11-10 against `octoberBranch` at `8440a7c29` plus the dirty working tree. Inputs: [MASTER.md](MASTER.md), [MERGE-NOTES.md](MERGE-NOTES.md), the packets, [../AUDIT-CONTEXT.md](../AUDIT-CONTEXT.md).

**Headline.** 44 issues are confirmed in code (section 3). The worst cluster in the shared inputs: team power ratings, the in-house and heuristic xG, and the rolling/goalie priors all carry confirmed defects, and FORGE, game predictions, sustainability and RSO are built on them. Audit in dependency order or the downstream audits will chase symptoms.

## How this was done, and its limits

- Read-only. No code edits, no database reads (no data tables and no catalog queries), no NST, NHL or Yahoo calls, no tests run. Deployed SQL definitions and production env values are therefore **unverified**; only the repo was read.
- One reviewer, no subagents. Every classification below marked *confirmed* was read in the current checkout at the cited line. *Likely* means the inventory lead is consistent with what was read nearby but the exact code path was not traced end to end. *Unlikely* and *false* were read and did not hold.
- 63 leads were opened in code across the 35 packets: 44 confirmed, 11 likely, 5 unlikely, 1 false, 2 left open (need data). Many more leads are quoted in the briefs from the inventory text alone; those are marked as leads, not findings. Depth was weighted to the owner's priority areas. The brief asked for 3–5 code checks per packet; these packets got fewer and should not be read as cleared:
  - No substantive leads to check (Codex-only records carrying only "not vetted" boilerplate): forge-projections-part3, forge-projections-part4, player-forecasts-season-part4, player-forecasts-season-part5, rankings-part2, sustainability-part2, rolling-player-averages-trends-part2.
  - One or two checks only: xg-part2, sko, vudu, trade-value, wigo, player-cards-homepage-stats, stats-helpers, misc-other, player-forecasts-season-part3, underlying-stats-summaries-part2, lines-toi-pp-units, goalie-starters-starter-odds, blsh-buy-low-sell-high.
- Line numbers were re-located in the current tree; packet line numbers (from `d31dcb33f` / `11e4192d3`) have drifted in places.
- The 3,632 "leads" are mostly noise: about 1,650 are Codex boilerplate. The roughly 2,000 Opus red flags are the real list, and they are observations, not findings.

Scores: **Risk** 1–5 (how likely the math is wrong, unsound or mis-specified against its stated intent and against community definitions). **Impact** 1–5 (user-facing reach, downstream fan-out, and whether it is live). **Effort** S/M/L for a full audit. Rank is Risk × Impact, ties broken by fan-out.

## 1. Ranked table (all 35 packets)

| # | Packet | Risk | Impact | R×I | Effort | Why, in one line | Depends on → feeds |
|---:|---|:-:|:-:|:-:|:-:|---|---|
| 1 | team-ratings-power-ctpi-sos | 5 | 5 | 25 | L | Live power ratings double-count games and z-score against only that night's teams; they feed four other families | NST team stats, WGO → game predictions, sustainability opponent factors, FORGE team context, underlying landing, SOS |
| 2 | forge-projections-part1 | 5 | 5 | 25 | L | Skater and goalie stages: four confirmed defects, plus context multipliers that cancel in reconciliation | rolling metrics, lines/PP units, goalie priors, team ratings, sustainability bands → RSO, start chart, fantasy points, game predictions, BLSH/Sko |
| 3 | xg-part1 | 5 | 4 | 20 | L | Production feature set contains a label leak; candidate model barely beats the base rate; a second, outcome-leaking heuristic xG is what team and goalie pages show | NHL PBP parser, shift stints → xG aggregates, adjusted impact, QoT/QoC, underlying stats, goalie GSAx, season forecasts (advanced) |
| 4 | rolling-player-averages-trends-part1 | 4 | 5 | 20 | L | Mixed TOI units and ratio conventions in the table that FORGE, rankings and sustainability all read | WGO, NST gamelogs → FORGE skater stage, rankings windows, sustainability, trends, social share |
| 5 | sustainability-part1 | 5 | 4 | 20 | L | PK-tier scale bug inflates every opponent adjustment; baselines include the season being judged; two score definitions | rolling, player_totals_unified, team ratings (pk_tier), priors → trends pages, dashboard, FORGE trend adjustment |
| 6 | game-predictions-odds | 5 | 4 | 20 | L | Served win probability is a hand-weighted logistic with no home-ice term; trained models are never loaded | team ratings, goalie priors, recent form, FORGE team projections → homepage, game pages, weekScore odds, market edges |
| 7 | rso-roster-optimizer | 4 | 5 | 20 | L | Streaming rank blends a conditional 10-game average into an unconditional projection; goalie losses overstated; zero-filled lines | FORGE bridge, native forecasts, goalie start probabilities, schedule → user add/drop/start decisions |
| 8 | fantasy-scoring | 4 | 5 | 20 | M | weekScore sentinel breaks pickup boost; category z-scores mis-standardised; several unreconciled off-night valuations | win odds, schedule, league settings → Game Grid, pickup table, start chart, draft values, social share |
| 9 | forge-projections-part2 | 4 | 4 | 16 | L | Spread edge has the wrong sign; API renormalises win probabilities across populations; uncertainty model ignores correlation | part1 outputs, sportsbook lines → market flags, goalie API, accuracy dashboards |
| 10 | goalie-starters-starter-odds | 4 | 4 | 16 | M | Start prior is a raw L10 share with look-ahead and a fixed .900 GSAA; it enters FORGE twice | WGO goalie logs, line combos, news → FORGE goalie stage, RSO goalie starts, game predictions |
| 11 | nst-derived-stats | 4 | 4 | 16 | M | In-house "NST parity" layer: leaky heuristic xG, GSAx labelled GSAA, inverted penalty classes, score-state labels differ from NST | PBP, shifts → underlying stats pages, xG validation |
| 12 | player-forecasts-season-part1 | 4 | 4 | 16 | L | Native means drop last season after one game; Python interval widths are wrong; calibration gates pass by construction | boxscores, PBP labels, xG → RSO (when admitted), fantasy projections page, served ledger |
| 13 | underlying-stats-summaries-part1 | 4 | 4 | 16 | L | Goalie MD/LD goals double-counted; strength filter falls through to PK; many unit assumptions in SQL views | parity layer, NST/WGO tables → player/team/goalie stats pages |
| 14 | rankings-part1 | 4 | 4 | 16 | L | Composites publish on 1 GP / 5 minutes; luck index rendered as a percentile; inconsistent missing-component policy | rolling windows, NST goalie stats → rankings matrices, BEAST tiers |
| 15 | draft-tools | 4 | 3 | 12 | M | VONA counted twice in the recommendation score; shared z-score issues; moving replacement level. Impact is 5 in draft season, low now | projections sources, categoryScores, ADP → Draft Dashboard, mock drafts |
| 16 | player-forecasts-season-part2 | 4 | 3 | 12 | L | Python season model: circular GLM features, selection and reporting on the same folds, non-standard labels | season labels SQL, PBP → season artifact, fantasy projections page |
| 17 | lines-toi-pp-units | 3 | 4 | 12 | M | PP units are TOI rank slices, not co-deployment; PP timing assumes 20-minute periods; penalty code mapping is a no-op | shift charts, PBP → FORGE PP allocation, rolling PP usage, rankings deployment, RSO chips |
| 18 | player-forecasts-season-part3 | 3 | 4 | 12 | M | Planning contribution resolver feeds RSO; goalie start-mass check only rejects sums above 1 | part1/2, FORGE → RSO, start chart |
| 19 | underlying-stats-summaries-part2 | 4 | 3 | 12 | M | OT game-clock bug; PBP-only fallback mixes xG models and skips the score-state filter on shots | PBP → stats pages (fallback games), xG explorer |
| 20 | blsh-buy-low-sell-high | 3 | 3 | 9 | M | Frozen offline snapshot with documented provisional constants; season hard-coded; Game Score variant unlabelled | WGO, NST, FORGE expectations → BLSH page, trade comparison, cards |
| 21 | forge-projections-part3 | 3 | 3 | 9 | M | Codex-only fine-grained records of part1/2 heads, v2 kernel and fitting scripts; no leads of their own | same as part1/2 |
| 22 | player-forecasts-season-part4 | 3 | 3 | 9 | M | Codex-only season primitives and derived metrics; no leads of their own | same as part1/2 |
| 23 | sustainability-part2 | 3 | 3 | 9 | S | Codex-only band-metric records; inherits part1 baseline problem | part1 |
| 24 | rolling-player-averages-trends-part2 | 3 | 3 | 9 | S | Codex-only per-metric records; inherits part1 unit issues | part1 |
| 25 | wigo | 3 | 3 | 9 | S | Overall rating averages AS, ES and ST although AS contains both; all-situations Game Score | NST season views, WGO → WiGO page |
| 26 | xg-part2 | 3 | 2 | 6 | S | Approval gates need only 10 goals; shot map fold; rolling xG windows | part1 → xG explorer, shot map |
| 27 | sko | 3 | 2 | 6 | S | Almost all legacy, quarantined or fixture-stage; "sKO" names four unrelated things | — → preview only |
| 28 | player-cards-homepage-stats | 2 | 3 | 6 | S | Display arithmetic; mixed percent scales; model-vs-market edge picks the less-negative side | game predictions, NST → homepage, cards |
| 29 | stats-helpers | 2 | 3 | 6 | S | Three percentile conventions across the site; null projections ranked as 0 | — → WiGO, rankings, projections table |
| 30 | misc-other | 2 | 2 | 4 | M | Social-share and legacy helpers; one confirmed 60× unit error in a legacy averages route | various → share cards, legacy pages |
| 31 | trade-value | 2 | 2 | 4 | S | Structural counts plus a per-game rate sum across uneven sides; scaffolding otherwise | BLSH, FORGE → trade page |
| 32 | forge-projections-part4 | 2 | 2 | 4 | S | Six Codex-only records | part1/2 |
| 33 | player-forecasts-season-part5 | 2 | 2 | 4 | S | 24 Codex-only records (SQL runtime features, diagnostics) | part1/2 |
| 34 | rankings-part2 | 2 | 2 | 4 | S | Five Codex-only records | part1 |
| 35 | vudu | 1 | 1 | 1 | S | No live gap is computed anywhere; fixture pass-through | sKO contract → preview only |

### Dependency order (audit upstream first)

1. **Event layer:** PBP parsing, coordinates, shift stints, strength state (xg-part1, nst-derived-stats, lines-toi-pp-units). Open item that gates all of it: who owns a `blocked-shot` event in the stored NHL payload.
2. **Shot value:** the trained xG model and the heuristic bucket xG (xg-part1, nst-derived-stats). Two more xG universes are imported from NST (ixG, team xGF).
3. **Aggregates:** rolling player metrics, team power ratings, goalie start priors, underlying summaries (rolling part1, team-ratings, goalie-starters, underlying part1/2).
4. **Models:** FORGE (part1 then part2), native and season player forecasts, sustainability, game predictions. Note one loop: sustainability trend bands feed FORGE rates (M-FRG-056) while FORGE expectations feed BLSH/Sko.
5. **Decisions:** RSO, fantasy scoring and weekScore, draft tools, rankings composites, trade value.

## 2. Wave plan

**Wave 1 (12 passes, in this order).** xg-part1 · nst-derived-stats · rolling-player-averages-trends-part1 · team-ratings-power-ctpi-sos · goalie-starters-starter-odds · forge-projections-part1 · forge-projections-part2 · player-forecasts-season-part1 · sustainability-part1 · game-predictions-odds · rso-roster-optimizer · fantasy-scoring.

**Wave 2 (9 passes).** SQL definitions cross-cut (below) · underlying-stats-summaries-part1 · underlying-stats-summaries-part2 · rankings-part1 · draft-tools (move into Wave 1 if it must be right before the next draft season) · lines-toi-pp-units · player-forecasts-season-part2 · player-forecasts-season-part3 · blsh-buy-low-sell-high.

**Wave 3 (the rest).** wigo · stats-helpers · player-cards-homepage-stats · xg-part2 · sko and vudu (after the owner writes the intent) · trade-value · misc-other · and the Codex-only parts as cross-checks behind their part 1: forge-projections-part3/4, player-forecasts-season-part4/5, sustainability-part2, rolling-part2, rankings-part2.

**SQL cross-cut (Wave 2, first).** The owner asked for every SQL function or view that computes something. They are spread over ten packets: M-TEAM-001–010, 017, 033, 034 · M-UST-001–010, 038, 039 · M-SUS-001, 002, 037–039 · M-SKO-001–003, 016 · M-FRG-001–003 · M-PFC-001 · M-LINE-001, 002, 004, 013 · M-GST-001, 003 · M-DRF-001, 002, 004, 047 · M-WIGO-001, 003 · M-MISC-001, 002, plus the Codex-only SQL records in player-forecasts part 3–5 and rankings-part2. One auditor should (a) confirm each deployed definition with a handful of `pg_views` / `pg_matviews` / `pg_proc` catalog reads, (b) find its live readers, and (c) check units and season filters. The live SQL inside Wave 1 packets is covered by those briefs.

### Wave 1 audit briefs

**W1-1 · xg-part1 (M-XG-001–060)**
- *Questions.* Which artifact does production score with (`NHL_XG_MODEL_ARTIFACT_PATH`), and does it contain `missReasonBucket`, `isShortSideMiss` or `isFlurryShot`? How much does `isFlurryShot` leak (refit without it and compare)? Is the logistic fit converged? What does 0-imputation of missing coordinates do to predictions? Are empty-net shots handled sensibly by one boolean? Who owns blocked-shot events, and does that mirror coordinates or break rebound and rush sources? State, as a table, what the model includes and excludes: location, distance, angle (signed or not), shot type, rebound, rush, strength, score state, shooter, goalie, seasons trained, calibration method.
- *Reference standard.* No single community formula. Compare the design and metrics with Evolving-Hockey's xG write-up (Younggren & Younggren, "A New Expected Goals Model for Predicting Goals in the NHL": per-strength gradient boosting on unblocked shots, multi-season, AUC about 0.77–0.78 at even strength), MoneyPuck's published methodology (rebound and rush definitions, flurry adjustment, arena adjustment), and HockeyViz's Magnus notes. For evaluation: log loss, Brier and AUC against the base-rate model, reliability diagrams with quantile bins, and Niculescu-Mizil & Caruana (2005) for Platt versus isotonic calibration. Judge internal soundness and honest labelling, not agreement with any one model.
- *Fixtures.* `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/` (model and dataset artifacts), `web/scripts/output/xg-approval-run-20260522/`, the tests beside `web/lib/xg/` and `web/lib/supabase/Upserts/nhl*.ts`, `tasks/artifacts/nhl-pbp-recon-2026-03-30.json` for payload shapes.
- *Done when.* The production artifact is identified and its feature list checked against the forbidden list; a leak-free refit is scored on a held-out split with log loss, Brier, AUC and a reliability table; every include/exclude is written down; each of the 60 entries is marked sound, mis-specified or wrong with a magnitude.

**W1-2 · nst-derived-stats (M-NST-001–034)**
- *Questions.* Where is the heuristic bucket xG (0.18 / 0.08 / 0.02, goals floored at 0.25) shown to users, and should any of it survive once a trained model exists? Which labels promise NST parity (HDCF, SCF, GSAA, Leading/Trailing, OZS%) but use a different definition? Do score-state filters work when per-event scores are null? Is the penalty classification right?
- *Reference standard.* Natural Stat Trick's glossary (scoring chance and high-danger definitions inherited from War-On-Ice, zone start %, score states), Hockey-Reference for GSAA (shots against × (1 − league SV%) − goals against; corrected 2026-11-10) versus MoneyPuck and Evolving-Hockey for GSAx (xGA − GA), NHL rule 16–23 penalty classes.
- *Fixtures.* `web/__tests__/fixtures/nst/oct1-identity-source.json`, inline games in `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`, `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md`, `web/scripts/run-nhl-xg-release-validation.ts` outputs.
- *Done when.* Each parity metric has a stated definition and a measured difference from NST on the fixture games; every label that is not the community metric is renamed or footnoted in the report; the heuristic xG's consumers are listed.

**W1-3 · rolling-player-averages-trends-part1 (M-ROLL-001–060)**
- *Questions.* For every stored column: unit (seconds or minutes, 0–1 or 0–100), strength, source (NST or WGO), and whether it is a ratio of sums or a mean of per-game ratios. Where do FORGE, rankings and sustainability read a per-game average as a total? Are traded players' denominators right? Do last-N windows cross seasons on purpose?
- *Reference standard.* Rate stats are pooled (sum of events ÷ sum of exposure), the convention at NST, Evolving-Hockey and Hockey-Reference. NHL.com definitions for S%, PP share. NST's definitions for IPP, on-ice SH%/SV%, PDO (on-ice SH% + SV%, centred on 100 or 1.000).
- *Fixtures.* `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/`, `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`, `web/scripts/check-rolling-player-family-reconstruction.ts`, `web/scripts/check-rolling-player-disputed-metrics.ts`.
- *Done when.* A column dictionary exists with unit, scale, strength and aggregation for every column; each downstream reader is checked against it; hand-recomputed values match for at least five players including one traded player and one with PP-only games.

**W1-4 · team-ratings-power-ctpi-sos (M-TEAM-001–056)**
- *Questions.* What is the intended power rating (window, half-life, all-situations or 5v5, reference population)? Quantify the effect of the mode mix and of the slate-only league distribution. Are PP/PK tiers season-to-date or single-game? Is "goalie rating" (team xGA − GA) labelled honestly? What should CTPI be, given weights that sum to 1.10 and add PDO? Which SOS definition is intended (record-based, RPI-style, or the PRD's 50/50)? Which legacy SQL views still have readers?
- *Reference standard.* For ratings: score- and venue-adjusted 5v5 shot and xG rates (Micah McCurdy's score-adjustment method), FiveThirtyEight's NHL Elo and Sports-Reference SRS for opponent adjustment. For SOS: RPI (25% WP, 50% OWP excluding head-to-head, 25% OOWP) and SRS. Standardisation must be against all 32 teams on one date.
- *Fixtures.* `tasks/artifacts/ctpi-independent-review-2026-10-22`, `tasks/artifacts/sos-candidate-2026-10-23`, `tasks/artifacts/ctpi-duplicate-upsert-audit-2026-10-22`, `web/__tests__/pages/underlying-stats/index.test.tsx`, existing `team_power_ratings_daily` rows (bounded read, with approval).
- *Done when.* Intended definitions are written and approved; ratings are recomputed for one date under the intended definition and the rank changes reported; each downstream consumer's exposure is listed; legacy views are marked dead or scheduled for audit.

**W1-5 · goalie-starters-starter-odds (M-GST-001–020)**
- *Questions.* What population is each start probability about (team-game, goalie-appearance, credited start)? Does look-ahead reach any accuracy report? Do team start probabilities sum to 1 on every path? Is GSAA with a fixed .900 acceptable, and does L10 share enter FORGE twice?
- *Reference standard.* Calibration of starter probabilities by reliability table and Brier score against confirmed starters; GSAA per Hockey-Reference with the season league SV%; back-to-back starter tendencies from published studies as a sanity range.
- *Fixtures.* `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`, `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`, `web/scripts/forge-goalie-backtest.ts`.
- *Done when.* A reliability table exists for the served start probability; the look-ahead is either removed from scoring inputs or shown not to reach them; every sum-to-one path is tested.

**W1-6 · forge-projections-part1 (M-FRG-001–060)**
- *Questions.* Walk one skater and one goalie through every stage and record each multiplier. Which adjustments survive team reconciliation, and which are computed and then cancelled? Is the sample weight meant to see total TOI? Are rest buckets meant to be `legacy`? How are goalie starts identified with `toi_seconds` null? Is the win probability a per-game quantity at every horizon? Are percent inputs (PDO, IPP) on the scale the code assumes?
- *Reference standard.* Marcel-style projection (Tom Tango: weighted recent seasons, regression to the mean by sample size, age adjustment) as the minimum sensible baseline. Regression amounts from published stabilisation work (Tango's "The Book" method; shooting-percentage regression studies by Eric Tulsky). Poisson and Skellam for goals and win probability; beta-binomial for save percentage. Projection means must reconcile: player goals sum to team goals, team goals to the game total.
- *Fixtures.* `web/scripts/fixtures/forge-reconstruction-backtest/`, `web/scripts/fixtures/forge-counterfactual-backtest/`, `tasks/artifacts/forge-priors-2026-10-22`, the served forecast ledger for realised accuracy.
- *Done when.* A stage-by-stage trace for two players and two goalies matches stored rows; each context multiplier is labelled effective, cancelled or double-counted; unit and scale assumptions are verified against stored data; each confirmed defect has a measured effect on fantasy points.

**W1-7 · forge-projections-part2 (M-FRG-061–120)**
- *Questions.* Are all market edges signed correctly (totals, spread, props)? Is a start-weighted goalie line ever compared with a single-goalie market line? Do p10/p90 bands cover 80% out of sample? Does the goalies API report a meaningful win probability?
- *Reference standard.* Sportsbook conventions (the favourite's spread is negative; cover means margin + line > 0), proportional de-vig and Shin's method, proper scoring rules (Gneiting & Raftery 2007: Brier, log loss, CRPS, interval score), negative binomial for over-dispersed counts.
- *Fixtures.* `web/lib/projections/externalInputProof.fixtures.ts`, `web/lib/forge-v2/fixtures.ts`, market rows already stored, the accuracy tables.
- *Done when.* Every edge formula is checked against a worked example; interval coverage is measured on settled games; the API's win probability is defined in words and matches the stage output.

**W1-8 · player-forecasts-season-part1 (M-PFC-001–060)**
- *Questions.* Which entries are actually served (many are status "unknown")? Should native means blend prior and current season? Are goalie rates regressed at all? Are the 80% intervals 80%? Can any release gate fail?
- *Reference standard.* Marcel weighting and regression; empirical Bayes shrinkage (David Robinson, "Introduction to Empirical Bayes"); conformal prediction with a held-out calibration set (Angelopoulos & Bates 2021); Vollman's quality-start definition; rolling-origin evaluation with selection, calibration and reporting on separate folds.
- *Fixtures.* `modeling/player_forecasts/tests/test_harness.py`, `web/scripts/seed-player-forecast-fixtures.ts`, `web/lib/forecast-diagnostics/fixtures.ts`, the season artifact's golden vectors (generated, not in the repo).
- *Done when.* A served-or-not status is recorded for every entry; interval coverage is measured on data not used for fitting; the native-means policy is compared with a blended baseline on the served ledger.

**W1-9 · sustainability-part1 (M-SUS-001–060)**
- *Questions.* Which of the two "sustainability scores" is canonical? What is a baseline allowed to contain? Are all z-scores on one standardisation basis? What happens to a player with missing components? Is every percent input on the scale the code assumes (PDO near 1 or near 100, PP share 0–1 or 0–100, TOI seconds or minutes)?
- *Reference standard.* Regression to the mean with stat-specific reliability, n/(n+k) (Tango); beta-binomial empirical Bayes for percentages; PDO as on-ice SH% + SV%; out-of-sample test: does the score predict the next-N-game change better than the raw rate?
- *Fixtures.* `web/__tests__/pages/trendsSandbox.test.tsx`, `tasks/artifacts/sko-model-v3-2026-11-03/`, stored score snapshots (bounded read, with approval).
- *Done when.* One written definition exists; baselines are shown to exclude the judged window; opponent factors are recomputed with the PK scale fixed and the shift reported; a simple predictive check is run on stored history.

**W1-10 · game-predictions-odds (M-GPR-001–045)**
- *Questions.* What model does production serve, and was it ever fitted? Is there a home-ice term? Which features have zero weight, and which weighted features are forced to zero? Is the output calibrated, and does the 0.52 winner rule make accuracy and confidence inconsistent? How many implied-probability implementations exist and do they agree?
- *Reference standard.* Home win rate as the naive baseline (about 54%), FiveThirtyEight-style Elo and the closing moneyline (de-vigged) as benchmarks; log loss and Brier with reliability bins; Dixon & Coles (1997) for the Poisson score models; proportional de-vig.
- *Fixtures.* `tasks/artifacts/nhl-game-prediction-supabase-source-audit.md`, `web/__tests__/pages/statsGame.test.tsx`, stored predictions and outcomes.
- *Done when.* The served model's provenance is documented; its log loss and Brier are compared with home-rate and market baselines on settled games; the public calibration summary works; duplicate odds code is reconciled.

**W1-11 · rso-roster-optimizer (M-RSO-001–060)**
- *Questions.* Is recent form allowed to rank streamers, and on what basis (conditional or unconditional)? What should a player with no forecast contribute: zero or unknown? Are goalie W/L lines consistent with league scoring (OTL, no-decisions)? Do the two lineup assigners agree on the same day? Does the chain DP's value match what its picks deliver?
- *Reference standard.* Assignment by the Hungarian method or min-cost max-flow is exact for a single day; check optimality against brute force on small rosters. Yahoo's published scoring and lineup rules for W, L, OTL and goalie minimums. Shrink short-window form before use (Tango).
- *Fixtures.* `web/e2e/roster-schedule-optimizer-fixtures.ts`, `web/e2e/fixtures/rso-acceptance/`, `web/e2e/fixtures/rso-continuity/`, `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`.
- *Done when.* Daily assignment is proven optimal on fixtures; the ranking basis is stated and unit-consistent; goalie expected stats reconcile (W + L + OTL = starts × decision share); the zero-versus-unknown rule is decided and tested.

**W1-12 · fantasy-scoring (M-FSC-001–053)**
- *Questions.* What is weekScore meant to measure, and are the 6/4 weights, the ±0.5 matchup bonus and the −100 sentinel intended? Which off-night valuation is the real one (four exist)? Are category z-scores standardised on the right pool, with rate stats volume-weighted and every lower-is-better category inverted? Do default point weights match Yahoo's?
- *Reference standard.* Yahoo Fantasy Hockey default scoring and category rules; z-score and standings-gain-points valuation (Art McGee, "How to Value Players for Rotisserie Baseball") with the mean and SD taken over the rostered pool and rate stats converted to impact (rate above average × volume).
- *Fixtures.* `web/e2e/fixtures/game-grid-previews/real-week-32.ts`, `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`, `web/lib/scoring/` tests.
- *Done when.* weekScore's intent is written and the formula checked against it on the real-week fixture; one off-night definition is chosen; category scores are recomputed on a rostered pool and the rank changes reported.

## 3. Confirmed-at-a-glance issues (44)

Read in the current checkout. Paths are relative to the repo root. Severity is my estimate of user-visible effect: **H** high, **M** medium, **L** low. Nothing was fixed.

### Expected goals and the parity layer

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C1 | H | `web/lib/supabase/Upserts/nhlFlurries.ts:211-228`; `web/lib/xg/baselineDataset.ts:164` | `isFlurryShot` is true for every shot in a sequence of two or more, including the first, so it encodes that a later shot followed. A goal stops play, so any non-final flurry shot is by construction not a goal. It is a default production feature (M-XG-001, 017). | Label leak. Flurry and rebound-sequence shots are pushed down; rebound xG is understated. Size needs a refit. |
| C2 | M | `web/lib/xg/baselineDataset.ts:454`; `web/lib/xg/shotFeaturePersistence.ts:541` | Missing numeric features become 0 with no missing flag: a null distance is 0 feet, a null x is centre ice. The zeros also enter the standardisation mean. | Affects every shot with null coordinates or a null PP/shift age (sparse features are mostly null). |
| C3 | H | `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/lib/xg/binaryLogistic.ts:89-90` | The approved candidate barely beats the base rate. Over all 118,299 scored shots (7.18% goals) the mean prediction is 7.68% and log loss is 0.2413 (test split 0.2434) against 0.2583 for the base-rate model. Only 185 shots are predicted at 0.30 or more and none at 0.50 or more. On the training split alone the mean prediction is 7.67% against 7.17% observed; a converged logistic fit with a free intercept matches the training mean, so the fit has not converged. The trainer runs a fixed 800 gradient steps at rate 0.05 with no convergence test. One season, no shooter, goalie or score-state terms, linear distance and angle. | Compressed xG: empty-net and prime chances are undervalued, low-danger shots overvalued. A 6.6% log-loss gain over the base rate is small next to published models; compare like for like on the same shot universe. |
| C4 | H | `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:407-418`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:481-497`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3443-3447` | A second "xG" is a three-bucket constant (0.18 / 0.08 / 0.02) and a goal is floored at 0.25. The outcome sets the expectation. Three copies. It feeds team xGF/xGA on the underlying-stats pages and goalie xGA (M-NST-005, M-UST-080, M-XG-040). | Every goal adds at least 0.07–0.23 xG that a save would not. xGF% drifts toward GF%; goalie "saved above expected" shrinks toward zero. |
| C5 | M | `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1359-1363` | Penalty classes: 2 minutes is a minor, 5 or more is a "major" (so 10-minute misconducts are majors), and everything else, including 4-minute double minors, is a "misconduct". | Every double minor and misconduct is in the wrong column. |
| C6 | L | `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:782-799` | Score state "leading" and "trailing" mean a margin of two or more; a one-goal lead is "upOne". NST's Leading includes any lead. | Label mismatch for anyone comparing with NST. |

### FORGE

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C7 | M | `web/lib/projections/stages/goalie-stage.ts:820-823` | `proj_win_prob` and `proj_shutout_prob` are multiplied by the horizon scalar sum. A probability scaled by a game count is not a probability (M-FRG-027, 029, 077). | None at the default horizon of 1; above 1 for any multi-game horizon. |
| C8 | H | `web/lib/projections/stages/skater-stage.ts:2149-2154`; `web/lib/projections/calculators/skater-adjustments.ts:436-440` | The small-sample weight is `evidence / (evidence + scale)` with evidence = `toi_seconds_avg_all`, a per-game average, not accumulated TOI (M-FRG-046). | The weight sits near 0.5 for nearly every skater whether he has played 2 games or 200. Rookies are under-regressed, veterans over-regressed. |
| C9 | M | `web/lib/projections/stages/skater-stage.ts:1945`; `web/lib/projections/calculators/skater-adjustments.ts:358`, `:381` | Production passes `buckets: "legacy"`, which the code comment reserves "for offline backtests only". It shifts rest days by one, so a back-to-back gets the milder bucket (M-FRG-045). | Back-to-back fatigue is understated (the lead cites 0.035 instead of 0.11). Team reconciliation then removes most of it anyway. |
| C10 | M | `web/lib/projections/derived/buildGoalieGameV2.ts:138` | `forge_goalie_game.toi_seconds` is always written null, yet readers pick the starter by max TOI (M-FRG-023, 026, 078). | Starter identification falls back to row order; relief appearances count as starts in L10 share and workload. |
| C11 | H | `web/lib/projections/run-forge-projections.ts:1100-1108` | Spread edge = (home expected goals − away) − home line. A home favourite's line is negative, so a −1.5 line with a model margin of +0.5 gives an edge of +2.0 and a "model_home_cover" flag. It should be margin + line (M-FRG-095). | Every spread flag is wrong by twice the line. Favourites are flagged to cover almost always. |
| C12 | M | `web/pages/api/v1/forge/goalies.ts:150-205` | The API rescales all goalie rows in a matchup so their win probabilities sum to 1. The inputs are P(start) × P(win given start) × decision share, so they should not sum to 1 (M-FRG-011, 094). | Inflates every listed win probability when starters are uncertain; mixes populations the stage keeps apart. |

### RSO and player forecasts

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C13 | H | `web/lib/rosterScheduleOptimizer/streamingChain.ts:187-190`; `web/lib/rosterScheduleOptimizer/recentForm.ts:50` | Streaming rank = (projected points + last-10 points per game) ÷ 2. The comment on recent form says "A hint only: never a projection input". Projected is unconditional (a goalie's is scaled by start probability); form is per game played (M-RSO-007, 060). | Half the ranking is a raw 10-game sample. Backup goalies and hot streaks are over-ranked. |
| C14 | M | `web/lib/rosterScheduleData/forgeDailyBridge.ts:624-626` | Goalie `LOSSES_GOALIE` = 1 − P(team win) × 0.984. Overtime losses and no-decisions are counted as losses (M-RSO-017). | About +0.12 losses per start at a 50% win chance, in leagues that score losses. |
| C15 | M | `web/lib/rosterScheduleData/forgeDailyBridge.ts:651-655` | A player with no FORGE line gets an all-zero stat line, a known zero, not an unknown (M-RSO-014, 030). | Uncovered players rank as the worst known contributors and become first drop proposals. Needs an owner ruling; it contradicts the "unknown is never auto-dropped" policy. |
| C16 | H | `web/lib/player-forecasts/nativeDailyMeansCapture.ts:467-468`; `web/lib/player-forecasts/baselineRates.ts:15`, `:251-252` | Native skater means use the current-season policy as soon as one current observation exists, else last season. No blend, no shrinkage: a 0.9-decay mean of up to 20 games (M-PFC-013, 089). | Large jumps at the switch; effective sample of about 8 games for goals. Matters whenever the native source is admitted to RSO. |
| C17 | M | `modeling/player_forecasts/advanced.py:1997-2001`, `:2172` | `residual80` is the 80th percentile of absolute error (about 1.28 SD). It is squared as the variance, then ±1.2816 SD is applied again (M-PFC-007). | "80%" bands are about 1.64 SD wide, roughly 90% coverage. |
| C18 | L | `web/lib/player-forecasts/servedForecastLedger.ts:159` (skaters at `:146`) | The goalie control named `naive_last5` uses the last 10 starts and 10 team games (M-PFC-097). | Mislabelled baseline in every goalie skill comparison. |
| C19 | M | `modeling/player_forecasts/season.py:556-563` | Quality start (starter with at least 59 minutes) = goals against ≤ 2 **or** SV% ≥ .917. Vollman's definition is SV% above league average, or at least .885 when allowing two or fewer (M-PFC-113). | Any 2-goal game counts, even on 10 shots. Inflates projected QS. |
| C20 | L | `web/lib/player-forecasts/planningContributions.ts:112` | The goalie start-mass check rejects only sums above 1; a team whose start probabilities sum to 0.6 passes (M-PFC-122). | Team goalie starts under-allocated without warning. |

### Team ratings, game predictions, goalie priors

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C21 | H | `web/pages/api/v1/db/update-team-power-ratings.ts:183-198`; `web/lib/power-ratings.ts:269`, `:306`; `web/lib/teamRatingsTrend.ts:58` | The writer passes every log row per team to the EWMA with no `data_mode` filter, and logs hold both an `all` and a `5v5` row per game. The trend path filters to `all` (M-TEAM-019). | Each game is counted twice: the 25-row window is about 12.5 games and the half-life halves. All-situation and 5v5 rates are averaged; 5v5 rows carry null pace and high-danger fields; `gp_to_date` is doubled. |
| C22 | H | `web/lib/power-ratings.ts:328-330`; `web/pages/api/v1/db/update-team-power-ratings.ts:196-208` | `calculateEwma` returns null unless the team played on the target date, and the league mean and SD are built from the teams that returned a value (M-TEAM-020, 021). | Ratings (100 + 15z) are standardised against that night's slate, 2 to 16 teams, not the league. The scale moves day to day. |
| C23 | L | `supabase/migrations/20260716112908_production_schema_baseline.sql:23554-23562` | View `power_rankings`: penalty-kill % is subtracted and PIM is added to the score (M-TEAM-007). | Legacy; needs a catalog and reader check before it matters. |
| C24 | H | `web/lib/game-predictions/workflow.ts:48-71`, `:914` | The served model `INITIAL_BASELINE_MODEL` is 15 hand-typed weights, the rest zero, bias 0. There is no home-ice term and no feature normalisation (M-GPR-026). | Home win probability is 50% for evenly rated teams, against a league home rate near 54%. Not a fitted model despite the name `regularized_logistic_baseline`. |
| C25 | L | `web/lib/game-predictions/publicPredictions.ts:552-556`; `web/lib/game-predictions/evaluation.ts:48`, `:185` | The public calibration summary filters bins on `bin.count`, but bins store `predictions` (M-GPR-034). | The summary is always null. |
| C26 | M | `web/pages/api/v1/db/update-goalie-projections-v2.ts:360-366`, `:431-433` | Goalie start projections use logs with `gameDate <= game.date`; the comment admits "peeking". Start probability is the plain L10 share. GSAA uses a fixed .900 league SV%, unshrunk (M-GST-002, 004; M-FRG-034, 044). | Look-ahead in any backfilled or historical row. The fixed .900 biases GSAA upward in a higher-SV% season and downward in a lower one. |

### Sustainability

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C27 | H | `web/lib/sustainability/features.ts:175`, `:759-760`, `:765-777`; `web/lib/teamRatingsService.ts:3` | Opponent PK baseline is 16, a rank scale, but `pk_tier` is a tier of 1, 2 or 3. `pkEdge = (16 − tier) / 16` is always +0.81 to +0.94 (M-SUS-019). | Every opponent looks like a weak penalty kill: about +4% on the goal-rate multiplier and +3.5% on assists at full sample weight, plus about +0.07 on the defense score, before clamps. |
| C28 | H | `web/lib/sustainability/bandService.ts:146-157`; `web/lib/sustainability/bandCalculator.ts:79` | Trend-band baselines take the latest four seasons of `player_totals_unified`, including the one in progress, weighted 0.6 / 0.3 / 0.1 (M-SUS-006). | The baseline is 60% the sample being judged, so deviations are muted; historical snapshots use future seasons. |
| C29 | L | `web/pages/api/v1/sustainability/trends.ts:202-208`, `:239-246` | `luck_pressure` is the negated weighted sum, but `component_breakdown` contributions are not negated (M-SUS-042). | Components do not add up to the total shown; signs disagree. |

### Fantasy scoring, draft tools, rankings

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C30 | M | `web/components/GameGrid/utils/calcWeekScore.ts:62`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2759-2774`, `:1886` | weekScore returns −100 for a team with no games. The pickup table's team boost (on by default) min-max scales weekScore with no filter (M-FSC-019, 042). | In any window with an idle team, every other team lands near the top of the scale and the boost stops discriminating. |
| C31 | L | `web/components/GameGrid/utils/calcWinOdds.ts:6-15` | `calculateBlendedWinOdds` returns the model odds on both branches; market odds are fetched and ignored (M-FSC-021, M-GPR-016). | No blend happens. The effect on weekScore is bounded at ±0.5. |
| C32 | M | `web/hooks/usePlayerRecommendations.ts:73`; `web/hooks/useVORPCalculations.ts:253` | Recommendation score = 0.7 × VBD + 0.3 × VONA, and VBD already = 0.6 VORP + 0.3 VONA + 0.1 VOLS (M-DRF-026). | Effective weights: VORP 0.42, VONA 0.51, VOLS 0.07. Availability outweighs value. |
| C33 | M | `web/lib/scoring/categoryScores.ts:96-118`, `:127-130`, `:35-41` | Category z-scores: mean and SD over the whole passed pool, not a draftable pool; goalie rates are shrunk after the mean and SD were taken from unshrunk values; `OTL_GOALIE` is not inverted; rate categories are not volume-weighted (M-DRF-033, M-FSC-013). | Deep pools compress the gaps between top players; a 10-start goalie with a good SV% scores close to a 60-start one. |
| C34 | M | `web/lib/rankings/playerMatrix.ts:884-888` | `results_luck_index` (0–200, centred on 100) is clamped to 0–100 and put in the percentile slot (M-RNK-031, 038). | Every player at or above neutral shows 100 and the top tone. |
| C35 | L | `web/utils/projectionsRanking.ts:14-25` | Null projected or actual fantasy points are ranked as 0; ties get sequential ranks; skaters and goalies share one scale (M-HLP-005, M-FRG-010). | Display ranks only. |

### Underlying stats, rolling, lines, others

| # | Sev | Where | What is wrong | Expected magnitude |
|---|:-:|---|---|---|
| C36 | H | `web/lib/underlying-stats/playerStatsLandingServer.ts:3548`, `:3551`, `:3564`, `:3458`, `:3461` | Goalie medium- and low-danger goals against are added from the parity counts and again by `accumulateGoalieShotFeatureBucketMetrics`. High-danger goals are added once (M-UST-048, 049). | MD and LD goals against are about double. MD/LD GAA and the danger "GSAA" are wrong. |
| C37 | M | `web/lib/underlying-stats/playerStatsLandingServer.ts:1644-1664` | `resolveSkaterSplitKey` returns `pk` for every strength other than all, even, 5v5 and power play: 5-on-4 PP, 4-on-5 PK, 3-on-3, with and against empty net (M-UST-060). | Those filters show penalty-kill numbers. |
| C38 | M | `web/lib/underlying-stats/playerStatsLandingServer.ts:921-935` | For period 4 and later, completed periods are multiplied by that period's own duration. A regular-season OT event gets 3 × 300 + x seconds instead of 3,600 + x (M-UST-073). | OT events sort inside the first period on any elapsed-time ordering; gaps across the regulation–OT boundary go negative. |
| C39 | H | `web/lib/trends/playerTrendCalculator.ts:251-255`, `:270-274`, `:20-30` | The per-60 fallback is (count ÷ `toi_per_game`) × 60, which assumes minutes. Playoff rows are converted from seconds to minutes; regular-season rows are passed through (M-ROLL-018). The repair audit already counts `repairedSixtyTimesLowShots` (M-ROLL-029). | 60× low wherever the fallback runs on a seconds value. |
| C40 | L | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1317-1326`, `:1364-1372` | `shooting_pct` is stored 0–100 and returns 0 with no shots; its sibling `expected_sh_pct` is 0–1 and returns null (M-ROLL-005). | A unit trap for any reader that subtracts one from the other. |
| C41 | M | `web/utils/extractPPDetails.ts:81`, `:204-214` | `playTypeKeyToCode` maps `minor` and `major`, but it is passed `details.typeCode`, which the NHL payload gives as `MIN` / `MAJ`. The result is an empty string (M-LINE-035). Assumes the payload values; no API call was made to confirm. | A power play never ends early on a goal; PP durations are overstated. |
| C42 | L | `web/lib/api/averages/statsService.ts:158`; `web/lib/api/averages/helpers.ts:121-125` | TOI is parsed to seconds, then SOG/60 = SOG ÷ TOI × 60 (M-MISC-007). | 60× low. Legacy averages route; live readers not confirmed. |
| C43 | L | `web/lib/buyLowSellHigh/currentInput.ts:3`, `:192`, `:239`, `:243`; `web/lib/buyLowSellHigh/currentWindows.ts:199` | BLSH hard-codes season 20262027, game-id year 2026 and a 2026-07-01 cutoff (M-BLSH-005, 014). | Not a math error. It stops working next season until edited. |
| C44 | L | `web/pages/api/v1/ml/update-predictions-sko.ts:112-118`, `:342` | The column `stability_cv` stores a standard deviation, not a coefficient of variation (M-SKO-004, 024). | Flagged off. A naming trap if revived. |

### Checked and not confirmed

| Lead | Verdict | Reason and location |
|---|---|---|
| M-RSO-015 "blended prior mixes units" | **False** | `web/lib/rosterScheduleData/forgeDailyBridge.ts:109-116` is a consistent pseudo-count blend: a total over played + 20 games, divided by the same count. |
| M-XG-039 "hd_goals_against never incremented" | Unlikely | No such field exists; it is derivable as HD shots − HD saves (`nhlNstParityMetrics.ts:1524-1536`). The real problem is C36. |
| M-FSC-019 "off-night weight double-counts" | Unlikely as a bug | `calcWeekScore.ts:45-52` documents the 6/4 weights on purpose. It is an uncalibrated heuristic, not an error. |
| M-DRF-027 "VONA off by one" | Unlikely | `web/hooks/useVORPCalculations.ts:216-227`: with nobody expected to go at the position, VONA is 0 because the player is still there next pick. The own-index offset, the floor of a fractional count and self-counting are non-standard and need an owner definition. |
| M-NST-027 "semi-burst up to 78 breaks policy" | Unlikely as a violation | `web/lib/cron/nstRateLimitPolicy.ts:120-124` allows two 39-attempt waves with the shared ledger deciding each start, which fits 40 per minute and 80 per 5 minutes. It is looser than the AGENTS.md wording. |
| M-GST-006 "probabilities need not sum to 1" | Unlikely | `web/lib/projections/calculators/goalie-starter.ts:237-240` clamps after softmax, but `:258-263` renormalises the ranked candidates. |

Open, needs stored data or a fixture: who owns a `blocked-shot` event in the stored payload (M-XG-007, M-NST-024), and whether stored `shootingPlusSavePct5v5` is near 1.0 (then `web/lib/projections/calculators/skater-adjustments.ts:74-80`, `:259`, `:279` clamps PDO edge to −0.08 for every team above 1.000).

Likely, read in code but not traced end to end (11; carry into the audits):

- FORGE team shot volume is pinned to the team's last-10 average, so context multipliers only redistribute shots among teammates (`web/lib/projections/stages/skater-stage.ts:2661-2684`; M-FRG-059).
- Power-rating PP/PK tiers are read from per-date `wgo_team_stats` rows (`web/lib/power-ratings.ts:699-746`); whether those hold one game or the season to date needs a data look (M-TEAM-025).
- Rankings: the season sample-TOI gate is fed a per-game average (`web/lib/rankings/skaterWindowAggregation.ts:93`, `:273-274`; M-RNK-041).
- Rankings: Defense Rating renormalises to on-ice GF% and blocks when 5v5 inputs are missing (`web/lib/rankings/skaterCompositeWriter.ts:365-382`; M-RNK-019).
- Sustainability: the 3-year baseline fallback divides a weighted rate by weighted games (`web/lib/baselines/aggregations.ts:462-517`; M-SUS-004).
- Season model: two rest-day conventions, back-to-back = 1 in `modeling/player_forecasts/season.py:1688` and 0 in `horizons.py` (M-PFC-102).
- Rolling: the minutes-or-seconds heuristic on WGO TOI (`web/lib/supabase/Upserts/rollingPlayerToiContract.ts:39-82`; M-ROLL-038).
- WiGO: the overall rating averages AS, ES and ST although AS contains both (`web/utils/calculateWigoRatings.ts:253-258`; M-WIGO-005).
- Shot map: folding by the sign of x does not mirror the lateral axis (`web/components/ShotVisualization/ShotVisualization.tsx:398-412`; M-XG-052).
- xG approval gate needs only 10 goals in the test and holdout splits (`web/scripts/train-nhl-xg-baseline.ts:333-334`; M-XG-066, 070).
- Trade fallback sums per-game rates across uneven sides (`web/components/blshTrade/retrospective.ts:34`; M-TRD-004).

Not math, noted in passing: `web/lib/supabase/GoaliePage/updateWeeklyData.ts:16-17` logs the Supabase URL and a key value to the console (a legacy standalone script).

## 4. Undocumented intent

AUDIT-CONTEXT.md marks 395 of 1,029 Opus entries UNDOCUMENTED. An auditor cannot call these right or wrong until the owner states what they should compute. The ones that matter, grouped by the decision needed:

1. **Team power rating** (M-TEAM-018–022, 025, 044, 045). Window and half-life, all-situations or 5v5, the reference population for z-scores, what "pace" and "goalie rating" mean, and whether pace belongs in a power score.
2. **CTPI and SOS** (M-TEAM-014, 026, 037, 048). Is PDO meant to add to CTPI? Should weights sum to 1? Record-based SOS, RPI-style, or the PRD's 50% record and 50% predictive?
3. **Served win probability** (M-GPR-022, 023, 026–028). Is the hand-weighted model a placeholder? Is a home-ice term intended? Why a 0.52 winner threshold? What is dampening toward 50% for?
4. **xG feature definitions** (44 live entries, M-XG-005–013, 053–058). Rebound window, rush window (10 s here against 4 s at MoneyPuck), royal-road rule, PP age, empty-net handling, and which model the site's headline xG is: in-house, heuristic or NST.
5. **In-house parity labels** (M-NST-003–005, 020, 022, 028; M-UST-059, 060, 079, 080). Are HDCF, SCF, GSAA, Leading/Trailing and OZS% meant to equal NST's, or to be FHFH definitions under the same names?
6. **Sustainability** (M-SUS-006, 007, 019, 024, 025, 029, 030, 042, 054, 055). Which score is canonical (M-SUS-027 or 028), what a baseline may include, the quintile direction, and what "luck pressure" means in sign and units.
7. **sKO and VuDu** (M-SKO-026 and the family). The name covers a legacy points × stability score, the Sko Element contract, the sustainability "sKO score model v3", and `combineSKO`. Which one is sKO? VuDu has no live definition at all.
8. **FORGE context adjustments** (M-FRG-009, 042–044, 051, 053, 056, 060, 062, 064). Each multiplier's purpose and expected size, whether adjustments should survive reconciliation, and whether the sustainability-band adjustment is meant as momentum or regression.
9. **FORGE goalie model** (M-FRG-023, 031–033, 093). What `proj_win_prob` is a probability of, the meaning of horizon-scaled probabilities, and the starter definition.
10. **Fantasy scoring heuristics** (M-FSC-013, 021, 026, 027, 040, 041). weekScore's target, the one true off-night value, and whether pickup percentiles should use season totals or per-game rates.
11. **Draft value** (M-DRF-033 and the VORP/VONA/VBD entry M-DRF-027). Replacement level (fixed or moving), the VBD blend weights, how UTIL is split, and the pool for z-scores.
12. **Rankings composites** (M-RNK-007, 009, 031, 038, 043, 044). Sample floors for publication, what a composite cell's "percentile" means, and one quality-start definition (three exist).
13. **Underlying SQL views** (M-UST-002–009, 038; M-TEAM-002, 004, 005). Season filters, TOI units, and whether percentages should be pooled.
14. **RSO policy** (M-RSO-019, 035, 043, 047). What an unknown forecast should do to a plan, and when a plan with drops is "safe".

## 5. Open questions for the owner

1. Which xG artifact does production point at (`NHL_XG_MODEL_ARTIFACT_PATH`), and is the earlier approved run `cfg9bac2706` (which used post-shot features) still referenced anywhere?
2. Is `INITIAL_BASELINE_MODEL` the intended live game model, or a placeholder that was never replaced?
3. Should streaming ranks use recent form at all? The code and its own comment disagree (C13).
4. For a player with no FORGE line, should RSO treat his contribution as zero or as unknown (C15)?
5. What is the live FORGE horizon? If it is always 1, C7 is cosmetic.
6. Is `buckets: "legacy"` deliberate in production (C9)?
7. Which outputs are meant to match NST exactly, and which are FHFH definitions that need their own names?
8. Which Python season artifact is served on the fantasy projections page? Most `modeling/player_forecasts` entries have status "unknown".
9. Are the legacy SQL views (`power_rankings`, `nst_att_def_scores`, `combined_sos`, `nst_avg_*`) still read by anything? A few catalog reads would settle it; may the SQL auditor run them?
10. May auditors run bounded reads of stored rows (for example one date of `team_power_ratings_daily`, a handful of `wgo_team_stats` rows) to settle unit and scale questions? Several findings (PDO scale, PP/PK tier inputs, TOI units, blocked-shot owner) cannot be closed from code alone.
11. Draft tools are low-traffic now. Audit them in Wave 2, or pull them forward?
12. AGENTS.md says an NST job may burst only below 40 requests; the code allows two 39-request waves (78). Which is the rule?

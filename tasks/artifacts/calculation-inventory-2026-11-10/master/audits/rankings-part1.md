# Math audit W2: rankings-part1 (M-RNK-001 to M-RNK-060)

Auditor: Claude (Fable), 2026-11-11. Checkout: `octoberBranch` at 3e81061cb. Audit only: no code, data, migration or deployment was changed. Line numbers are from this checkout.

Evidence labels (Batch B/C): **executed** = I ran a bounded production read; **source-confirmed** = I read the code path; **packet** = taken from the inventory description and not re-read; **reported** = from an upstream audit. Reach labels (rule 8): **live**, **conditional**, **dormant**, **dead** (no non-test caller).

---

## 0. Brief (written before the audit)

TRIAGE gives this packet one line: "Composites publish on 1 GP / 5 minutes; luck index rendered as a percentile; inconsistent missing-component policy", plus the section 4 intent gap on rankings composites (sample floors, what a composite cell's "percentile" means, one quality-start definition).

**Questions**
1. Core convention (001–003, 030, 041, 042, 046–060): are the per-60 rates, shares and percentiles computed from matching numerators and denominators, in the units their labels claim, for both season and last-N windows?
2. Sample gates (002, 035, 036, 037, 040): which minimums actually apply to what is published and displayed, and do they compare like with like (total TOI against total TOI)?
3. Results luck (016, 017): does the written index follow decision 23 (rates per 60 against a non-overlapping baseline), does its sign match its label, and is the baseline really non-overlapping?
4. Composites (018–022, 031, 038): are Offense, Defense, MCM, BEAST and the archetypes what they claim; is the 0–100 scale a percentile; is the missing-component policy consistent; what does the matrix show in the "percentile" slot?
5. Goalies (011–015, 035, 044): do GSAA, GSAx, SV%, HD SV%, QS, RBS and start share follow decisions 10 and 40 and their sources' units?
6. Teams (004–006, 010, 033, 034): which xG feeds team style and luck (decisions 6, 12), and are the per-game means defensible?
7. Other models (007, 026, 027, 028, 045): are QoT/QoC and the impact ratings leak-free, unit-consistent and fresh; is the percentile-rank route right?
8. Reach: which of these are live, conditional, dormant or dead?

**Reference standards** (named, none invented)
- Natural Stat Trick glossary conventions: per-60 = count ÷ TOI × 60; on-ice GF% and xGF% as for ÷ (for + against); iCF = all individual attempts, iFF = unblocked; GSAA = SA × (1 − league SV%) − GA. Owner decisions 9, 10 and 17 bind these.
- GSAx = xGA − GA on unblocked shots (MoneyPuck and Evolving-Hockey usage).
- Rob Vollman's Quality Start and Really Bad Start (decision 40 binds QS; RBS is SV% below .850 in the same source).
- Percentile rank conventions: exclusive `below ÷ (N − 1)` against mid-rank `(below + 0.5 × ties) ÷ N`.
- Order statistics of uniform variables, for the expected centre of the MCM formula.
- Owner decisions 6, 7, 10, 12, 16, 17, 18, 23, 34, 40, 62 and Batch A/B/C rules 1–12.
- Where no community formula exists (MCM, BEAST, archetypes, style badges, deployment tiers): internal soundness and honest labelling.

**Fixtures and data**
- Code reads of `web/lib/rankings/*`, `web/lib/ratings/playerImpactRatings.ts`, `web/lib/xg/qotQoc.ts`, `web/lib/splits/splitsServer.ts`, `web/pages/api/v1/player/[id]/percentile-rank.ts`.
- Bounded production reads listed in section 6 (catalog, one aggregate over `skater_composite_ratings` scalar columns, single-date and primary-key reads elsewhere). No jsonb.
- Upstream audits cited, not redone: W1-3 rolling (D1, D2, D6, D13), W1-2 NST (D4), W1-4 team ratings (D1–D3), W1-5 goalie starters, W1-1 xG, W2 underlying-stats part 2 (M-UST-080).

**Done when** every entry has a verdict with file:line evidence and a reach label; each defect has a size or a statement of what would size it, its readers, a fix and a valid test; owner questions exclude anything settled by decisions 1–68.

---

## 1. Summary

**Verdict counts (60 entries)**

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 19 | 001, 003, 005\*, 012, 025, 029, 034, 039, 043, 045, 046, 047, 050, 051, 052, 055, 056, 058, 053 |
| Mis-specified | 25 | 002, 004, 006, 008, 009, 010, 011, 014, 015, 018, 019, 020, 021, 022, 024, 026, 030, 031, 033, 035, 036, 037, 038, 040, 042 |
| Wrong | 11 | 013, 016, 017, 027, 028, 032, 041, 044, 048, 049, 057 |
| Undetermined | 5 | 007, 023, 054, 059, 060 |

\* 005's arithmetic is sound; its input is the wrong xG (see D2, owned by M-UST-080). 023, 059 and 060 are "undetermined" only in the sense that nothing runs: 023 is dead code and 059/060 are planned metrics with no implementation.

**Top 5 findings by user impact**

1. **Goalie GSAA/60 is 60× too large (P0, live; M-RNK-013).** `nst_5v5_counts_toi` is stored in **minutes**; the goalie matrix divides by it and multiplies by 3,600 as if it were seconds (`goalieMatrix.ts:619-622`, accumulated at `:727-731`). Executed sample, six goalie rows on 2026-11-05: TOI values 34.5 to 53.5. A goalie with −0.39 GSAA in 48.05 minutes shows −29.22 where the per-60 value is −0.49. The test fixtures pin seconds (`goalieMatrix.test.ts:166` uses 3000), so the suite passes. Order and percentile are unaffected; the printed value is wrong. The same column also sums NST's per-game GSAA, which decision 10 forbids.
2. **Team xGF%, Shot Quality, Event Rate, Fin Luck and Save Luck are built on the bucket-heuristic xG (P0, live; M-RNK-004, 005, 033).** `teamMatrix.ts:1205-1228` reads `team_underlying_stats_summary` (fiveOnFive, allScores). Executed sample, 2026-27 regular season to 2026-11-10, 568 team-games: 5v5 GF 1,134 against xGF 2,122.8, so xG runs 87% above goals. League-wide "Fin Luck" is −989 goals and "Save Luck" +989: on average every team shows about −31 finishing luck and +31 save luck after about 18 games. Teams missing from that table fall back to NST rows in the same ranked column (`:1438-1442`), so two xG models can share one percentile. Decisions 6 and 12 apply; this reader is not on the Batch A/B/C reader lists.
3. **Results Luck Index is inverted and almost never published (P1 now, P0 once last-N cohorts publish; M-RNK-017, 031, 038).** Its largest component subtracts a per-60 rate from a season goal count (the W1-3 D2 reader), and its on-ice component compares counts over different exposure. Executed sample, 61 players (2025-26, 5v5, last 20, snapshot 2026-04-16): the stored index correlates **−0.45** with the window's own goals-above-expected rate. In the current season 0 of 732 rows carry a value, so the matrix's "clamp to 0–100 and show as a percentile" (triage C34) is real in code but shows nothing today.
4. **Last-N "Goals Above Expected" and "Unrealized xG" are per-60 differences labelled as goals (P0, live; M-RNK-041, 049).** `skaterWindowAggregation.ts:314-321` reads the rate aliases; the season branch reads real counts, so one metric key holds two units. Executed example, Draisaitl all strengths at 2026-11-05: last-20 shows +0.85 where the count over that window is about +5.8 (0.853 × 24,652 s ÷ 3,600). This is the second reader of Batch P0 #10.
5. **Composite scales are not what their labels say (P1, live; M-RNK-018–021, 036, 037, 040).**
   - MCM is centred near 61, not 50 (executed: mean 59.3, median 62.5, n = 731), so the "MCM ≥ 70" tier floor sits only about 8 points above the median. 148 of 732 players (20%) carry a tier.
   - Offense and Defense are stored as `percentile_0_to_100` but are weighted means of percentiles (executed means 47.5 and 49.9; they are compressed toward 50 and are not percentiles).
   - Every published composite is computed against a 1 GP / 300 s population while the page default is 10 GP; the writer refuses any other threshold (`skaterCompositeWriter.ts:737-739`).
   - Offense and Defense silently reweight when inputs are missing; MCM refuses. Outside 5v5, Defense becomes on-ice GF% (64%) plus blocks (36%).

Also notable: xS% and SAX% divide by all attempts (iCF) under a "verified Fenwick" label, against decision 17 (D5); the season xGA/60 sample gate compares per-game TOI with a total (D6); the `/rankings` default season is hard-coded to 2025-26 (D12); the Splits page uses a third quality-start rule (D9); the impact ratings behind QoT/QoC, the underlying-stats overlay and game-prediction features stopped at 2026-03-08 (D10).

---

## 2. Per-entry table

| ID | Verdict | Evidence | Reference | Magnitude | Downstream / reach |
|---|---|---|---|---|---|
| 001 Raw value and direction | **Sound** | `rankingCalculator.ts:144-176`. Rate = n ÷ d × 3600; sign flip for lower-is-better. The non-rate fallback returns 0–1 where the primary path returns 0–100 (`skaterWindowAggregation.ts:185-188`), but it is unreachable from the rolling path: `rawValue` is null only when the inputs are null. | NST per-60 | None found | All contextual surfaces. Live. Note: `results_luck_index` is `higherIsBetter: false` (`metricDefinitions.ts:862`), so "hotter" ranks lower; see D3. |
| 002 Sample gate and confidence | **Mis-specified** | `rankingCalculator.ts:195-229`. Defaults 1 GP and 300 s (600 s for regression and on-ice metrics, 120 s PP). Confidence = min(GP ÷ minGP, TOI ÷ minTOI): 2 GP and 10 minutes is "high". Peer groups of 1 or 2 are ranked with a warning only (`:257-260`); N = 1 gives 100. | NST-style TOI cut-offs; reliability-based thresholds | "High confidence" at 2 GP / 600 s. Composite inputs require ≥ 3 peers (`skaterCompositeWriter.ts:189`), the surfaces do not. | Every surface. Live. D4. |
| 003 Percentile and dense rank | **Sound** | `rankingCalculator.ts:84-142`: strictly worse ÷ (N − 1), ties share, dense rank. Internally consistent and stated in `MCM_SCORE_CONTRACT.percentileConvention`. | Exclusive percentile rank; differs from mid-rank | Top-tied values score below 100 and bottom-tied score 0; dense rank "1, 1, 2 of N" understates distance. Presentation only. | All surfaces. A label note ("ties share the lower bound") is enough. |
| 004 Team style profile | **Mis-specified** | Formulas right (`teamStyleMethodology.ts:120-196`). Input is the bucket xG (D2). Event rate is per game, not per 60 of 5v5 time (`:171`). League average is an unweighted mean of teams (`teamMatrix.ts:1444-1458`). Badge cut-offs 1.1 / 0.9 and 55 / 45 are hand-set. | NST 5v5 xGF%; decisions 6, 12 | Shot quality 0.116 xG per unblocked attempt on the sample against 0.062 goals per attempt | Team matrix, style badge. Live. D2. |
| 005 Team luck | **Sound** arithmetic, **wrong input** | `teamStyleMethodology.ts:198-227`: GF − xGF, xGA − GA, sum. Cumulative goals, unnormalised for games played. | GAx; decision 6 | D2: about −31 and +31 per team. Net luck = (GF − GA) − (xGF − xGA), so the level bias cancels in the net only. | Team matrix Fin/Save/Net Luck. Live. |
| 006 Team game context | **Mis-specified** | `teamStyleMethodology.ts:242-289`. "1-Goal%" counts \|GF − GA\| ≤ 1, so every overtime and shootout game counts and empty-net two-goal games do not; the description says "one goal or fewer" (`teamMatrix.ts:432`), which is accurate. Pen/60 and PP Opp/G are means of per-game values, not pooled. Home edge = mean home point% − mean road point%, in points × 100. | — | Pooled against mean-of-games Pen/60 differs only through unequal game length; small. Not measured. | Team matrix. Live. Low. |
| 007 QoT / QoC | **Undetermined** (conditional) | `qotQoc.ts:101-183`. Ratings are re-percentiled inside position × TOI tercile, so a percentile of an ordinal rating is taken twice and quality is coupled to usage. The rating snapshot defaults to the latest one and is applied to every historical game (`update-nhl-xg-qot-qoc.ts:90-104`): look-ahead if used as a model feature (rule 10). | Evolving-Hockey / NST QoT-QoC use TOI-weighted TOI% or xGF% | Source ratings stop at 2026-03-08 (executed), so there is no 2026-27 rating snapshot to apply. | Feature tables for adjusted impact and game predictions. Not established whether any current-season rows exist. Settle with a catalog/`max(game_date)` read of the QoT/QoC table. |
| 008 Deployment tier summaries | **Mis-specified** | `deploymentTiers.ts:263-345`: bucket metric average = unweighted mean of member percentiles; bucket average = mean of those. `SPECIAL_TEAMS_MIN_TOI_SECONDS = 0` (`:137`, used `:728`), so a few PP or PK seconds earn a percentile. | — | Not measured | Deployment Tiers panel. Live. D4. |
| 009 Deployment buckets | **Mis-specified** | `skaterDeploymentAggregation.ts:107-158`: slot clamps; PK1 if PK TOI per game ≥ 90 s, a fixed cut-off, and only resolved when strength = pk (`rankingQueries.ts:516-518`). The peer group uses the latest row's line slot (one game), not the windowed mode; `buildSkaterDeploymentAggregate` and `assignEvDeploymentBucketFromToiRank` have no non-test caller. Deployment confidence is hard-coded "medium" when a slot exists (`rankingQueries.ts` `toApiRow`). | Line-combination conventions | A one-game line change moves a player into a different peer group and changes every "deployment" percentile. Not measured. | Deployment peer groups, tiers, splits. Live. TRIAGE §4 intent gap. |
| 010 Team unit-usage indices | **Mis-specified** (minor) | `teamMatrix.ts:848-…`: mean of per-game shares; "coverage-qualified" from 3 complete games (`:658`). | — | Small | Team matrix. Live. Low. |
| 011 Goalie value signal | **Mis-specified** | `goalieMatrix.ts:529-539`, `:603-608`. Mean of cumulative 5v5 GSAx and summed NST GSAA; unavailable if either source is partial (`:736`, `:787`), which matches the description. Two baselines (shot quality and league-average SV%) are averaged into one number and the total favours workload. | GSAx and GSAA are distinct standards | Inherits D1's GSAA summation (not the 60× error: this uses the count) | Goalie matrix. Live. Label as an FHFH blend. |
| 012 Goalie relative SV% | **Sound** | `goalieMatrix.ts:548-566`, `:872-940`, `:978-1034`: pooled saves ÷ shots against the same team's other goalies over the team's game window, with a 50-shot baseline floor and strict completeness checks. | Team-relative SV% | 50 baseline shots is noisy (binomial SE about .042 at .900); the cell carries a warning | Goalie matrix. Live. |
| 013 Goalie window aggregation | **Wrong** | D1. Also: GSAx is 5v5 NST xGA − GA, cumulative (`:781-787`); xGA/Shot divides an unblocked-attempt xG by shots on goal (`:743-747`, `:596-600`); SV% is all situations beside 5v5 columns; the 100-shot gate is on all-situation shots. | Decision 10; NST GSAA; GSAx | GSAA/60 × 60 | Goalie matrix. Live. P0. |
| 014 QS / RBS / steal | **Mis-specified** | QS% reads WGO `quality_start` (`goalieMatrix.ts:801-803`): the NHL's own flag. RBS% and Steal Rate use 5v5 GSAx ≤ −2 and a win with 5v5 GSAx ≥ +1 (`goalieMethodology.ts:74-83`, `:138-178`). "RBS%" carries Vollman's name with a different rule. `isGoalieQualityStart` has no non-test caller; its classic mode hard-codes .900. | Vollman QS and RBS; decision 40 | Executed sample (6 rows, 2026-11-05): the WGO flag is 0 at .895, .852, .865 and .875 and 1 at .969 and .963, consistent with a league-average rule. Whether it equals Vollman at the boundaries is unverified. | Goalie matrix. Live. D9. |
| 015 Goalie role and start share | **Mis-specified** | `goalieMatrix.ts:623-630`, `:1041-1104`. "Start Share" is the projection's `season_start_pct` when present, otherwise the observed window share: two different quantities in one ranked column. `adjustedStartShare` is hard-coded null (`:1064`); `calculateAdjustedCoreNetshare` and `getGoalieStartsShareBucket` have no caller. Cut-offs .65/.55/.45/.30/.10 are hand-set. | — | Inherits W1-5 (M-GST-002: the projection is the raw L10 share with look-ahead issues) | Goalie matrix role chip and column. Live. |
| 016 Luck index, older version | **Wrong**, dead | `resultsLuckIndex.ts:241-358`. Ratio of rates with a 1,200 s peer blend; a ratio index breaks for signed or near-zero baselines. No non-test caller. | Decision 23 | None | None. No deletion (rule 6). |
| 017 Luck index, written | **Wrong** | D3. `resultsLuckSources.ts:87-247`, `resultsLuckIndex.ts:121-224`. | Decisions 23, 34 | Corr −0.45 with the window signal (n = 61) | `skater_composite_ratings.results_luck_index` → player matrix. Conditional today. |
| 018 Offense Rating | **Mis-specified** | `skaterCompositeWriter.ts:333-363`. Weighted mean of sub-score means with renormalisation over missing parts; one available component still publishes a full rating. Scale label `percentile_0_to_100` (`skaterCompositeMethodology.ts:13`). Finishing sub-score inherits D3's GAx unit problem for last-N and D5's denominator. Collinear inputs (G/60 with P/60; ixG, iCF and SOG per 60). | — | Executed: mean 47.5 (n = 731) | Player matrix, snapshot panel. Live. D7. |
| 019 Defense Rating | **Mis-specified** | `:365-382`. 0.45 xGA/60 + 0.35 mean(on-ice xGF%, GF%) + 0.20 blocks/60. xGA/60 and xGF% are 5v5-only (`rankingQueries.ts:668-672`), so other strengths become GF% (63.6%) and blocks (36.4%). On-ice shares are two-way, and blocks rise with time spent defending. The caveats say so and the label is "Defensive Impact in Context". D6 removes the 45% component for low-minute regulars. | — | Executed: mean 49.9. Only 5v5 is published, so the non-5v5 collapse is conditional. | Player matrix. Live. D7. |
| 020 MCM Score | **Mis-specified** | `:384-404`. 0.45 × mean(top 2 of 3 peripherals) + 0.35 × max(scoring) + 0.20 × mean(all). Strict about missing inputs. Uses per-60 rates for a fantasy-category claim, so low-minute players can score high. | Order statistics | For independent uniform inputs the expected value is 0.45 × 62.5 + 0.35 × 75 (max of 3 at 5v5) or 80 (max of 4) + 0.20 × 50 = 64.4 or 66.1. Executed: mean 59.3, median 62.5. | Player matrix, BEAST tiers. Live. D7. |
| 021 BEAST tier | **Mis-specified** | `:406-428`, gates at `skaterCompositeMethodology.ts:104-133`. Hand-set; "MCM Watch" has no score floor; BEAST+ needs all three peripherals ≥ 80. | — | Executed: 148 of 732 (20%) tiered at 1 GP / 300 s | Tier chips. Live. D7. |
| 022 Archetype scores and tags | **Mis-specified** | `:430-510`. A missing opposing percentile is read as 0 (`?? 0`, `:486`, `:493`), so "shoot first" or "pass first" can fire on absence of data (rule 5). Labels say "Proxy" and `source_pending`, which is honest. | — | Not measured | Tags. Live. Low. |
| 023 xG denominator helpers | **Undetermined** (dead) | `xgDenominatorSemantics.ts:35-67`: correct Fenwick formulas with no non-test caller (also W1-1 M-XG-031). The live path does not use them (D5). | Decision 17 | None | None. They are the right home for the D5 fix. |
| 024 Trending | **Mis-specified** | `trending.ts:286-289`, `:368-422`. Percentile(last 5) − percentile(last 20): the windows overlap, the two percentiles come from different qualified pools (min GP 2 against 5), and there is no shrinkage. Cut-offs 8/15/25 points and 30/60/120 s are hand-set. Labels are descriptive ("TOI Up", "Shot Volume Spike"). | Decisions 2, 48 (form is shrunk by sample) by analogy | Not measured | Trending tab. Live. P2. |
| 025 WAR placeholder | **Sound** | `war.ts:127-196`: returns `source_pending` and no numbers. `parseSeason` defaults to 20252026 (`:60`). | — | None | WAR tab stub. |
| 026 Season-decayed priors | **Mis-specified**, dead | `playerImpactRatings.ts:504-…`. Weights 1 / .65 / .35 / .20; no regression to the mean despite the name; multiple snapshots per season would each get full weight. No non-test caller. | Marcel-style weighting regresses to the mean | None | None. |
| 027 Player impact ratings | **Wrong** (stale and mis-specified) | `playerImpactRatings.ts:88-115`, `:155-300`, `:395-500`. Forwards and defencemen share one z pool; a missing component is z = 0 (`:161-164`), a silent league-average imputation (rule 5); every player with any TOI is ranked; the rating is an ordinal rank with sequential ties. Goalie GSAA mixes all-situation and 5v5 rows (packet). **TOI units lead not confirmed**: executed, mean `sample_toi_seconds` 39,951 over 40.3 games, about 990 s per game. **Latest snapshot is 2026-03-08** (executed). | — | Eight months stale | `entityRatingsOverlay.ts` (underlying stats), `game-predictions/featureBuilder.ts`, QoT/QoC. D10. |
| 028 Percentile-rank route | **Wrong**, dormant | `percentile-rank.ts:83-92`. `Array.sort()` without a comparator sorts numbers as strings: negatives (`plusMinus`) and values ≥ 10 are misordered; `findIndex` gives ties the lowest position; a player with no games returns 0 for everything, indistinguishable from a real zero. No games floor. | — | Wrong for every negative plus-minus. No caller found in `web/` (`rg "percentile-rank"`). | Public API route only. P2. |
| 029 Legacy /api/v1/rankings | **Sound** | Deprecated stub returning an empty list (packet). | — | None | None. |
| 030 Metric catalogue | **Mis-specified** | `metricDefinitions.ts`. `shot_attempts_per_60` says NST iCF (`:370-371`); `expected_shooting_percentage` and `sax_percentage` describe the same field as unblocked with `denominatorStatus: "verified"` (`:551`, `:569-575`, `:600-604`). `results_luck_index` formula text "100 × current ÷ baseline" (`:861`) does not match the implementation. | Decision 17 | D5 | Tooltips and methodology metadata. Live. |
| 031 Matrix composite cells | **Mis-specified** | `playerMatrix.ts:872-890`: composite raw value goes in the percentile slot; `results_luck_index` is clamped to 0–100 (triage C34 confirmed). Composite rank flips with sort direction (`:1099-1113`). `overall ?? deployment` fallback (`:581-586`). | — | Luck: dormant for the current season (0 of 732). Offense/Defense/MCM: live, coloured with percentile tones. | Player matrix, snapshot panel. D7, D3. |
| 032 All-strength TOI per game | **Wrong** | `playerMatrix.ts:649-668`: last-N TOI ÷ min(season GP, N), while last-N windows reach into the prior season. | — | Early season only. A player with 5 season GP shows last-20 TOI ÷ 5, four times too high. Executed example of the crossing: Draisaitl's last-20 total (24,652 s) at 17 season GP. | Matrix TOI column. Live from October to roughly game 20. D8. |
| 033 Team matrix ranking | **Mis-specified** | `teamMatrix.ts:752-763`, `:1365-…`. Passthrough of power-rating columns (W1-4 D1–D3 apply unchanged); per-team NST fallback inside one ranked column (`:1438-1442`); no minimum games. | Decisions 6, 12, 19, 58 | D2 | Team matrix. Live. |
| 034 Team unit TOI builder | **Sound** | `teamUnitToiBuilder.ts:239-…`; generated `unit_share` confirmed sound by the SQL cross-cut (M-LINE-013). 5v5 detection counts skaters only; "line 1" is the most-used exact trio that game. Not re-derived on data. | — | — | `team_unit_toi` → team matrix. |
| 035 Goalie gate and ranking | **Mis-specified** | `goalieMatrix.ts:637-650`, `:1121-1133`. Defaults 3 starts / 100 shots (packet); the role filter is applied before ranking, so percentiles change meaning with the filter. | SV% binomial SE ≈ .030 at 100 shots | A 100-shot SV% percentile is mostly noise | Goalie matrix. Live. D4. |
| 036 Composite source population | **Mis-specified** | Packet plus `skaterCompositeWriter.ts:639-648`. Each player is taken at his own last game, so injured players are ranked on stale windows beside current ones. | Decision 18 by analogy | Not measured | Composite cohort. |
| 037 Composite publication gate | **Mis-specified** | `:202-224`, `:704-747`. The population re-check is a good control. The gate forces 1 GP / 300 s (`:737-739`). | — | D4 | Composite writer. |
| 038 UI tones | **Mis-specified** | `matrixScoreFormatting.ts:3-17`: percentile bands and a "%" suffix applied to composite scores that are not percentiles. | — | A median MCM (62.5) is toned "positive" (≥ 60) | Matrix tiles, strengths and weak spots. Live. D7. |
| 039 Snapshot writer/reader | **Sound** | Reader re-ranks stored raw values under the request's minimums (`entityMetricRankingReader.ts:426-440`). Writer chunking is not atomic (packet; not re-read). Stored season xGA/60 inherits D6. | — | — | Snapshot-first surfaces. |
| 040 Window-scaled min GP | **Mis-specified** | `rankingUrlState.ts:63-108`. Page defaults 10/5/3/2 GP; composites use 1 GP; min TOI 300 s for every window; default season hard-coded (`:101`). | — | D4, D12 | Page defaults. Live. |
| 041 Window aggregation | **Wrong** | D4 (last-N GAx units), D5 (denominator), D6 (season xGA gate). Rates themselves are right: stored pooled rate preferred, and season pairs reproduce (W1-3 M-ROLL-023, with Astra's caveat). | NST | See defects | Every skater surface. Live. |
| 042 Last-N GP and TOI | **Mis-specified** | `skaterWindowAggregation.ts:230-289`. GP is inferred from TOI ratios with a 1.05 heuristic because the writer fills `toi_seconds_avg_last5` only. | — | Not measured | Sample gates and confidence for last-N. Needs explicit window game counts (W1-3 enhancement). |
| 043 Rankings splits | **Sound** | Packet: re-runs the calculator per split. The deployment split changes the peer group, so percentiles across rows are on different populations; needs a label. | — | — | Splits panel. Live. |
| 044 Team-vs-opponent splits | **Wrong** | `splitsServer.ts:825-832`: QS = SV% > .910, or ≤ 20 shots and ≥ .885. A third definition, labelled "QS". Tiny opponent samples with no gate (packet). | Decision 40 | Differs from Vollman for any start between the season league average and .910 | `/splits` page (in the nav). Live. D9. |
| 045 Adjusted-impact gate | **Sound** | Static contract; statuses are constants, not live checks (packet). Used only in ranking metadata. | — | — | Metadata. |
| 046 Assists/60 | **Sound** | `skaterWindowAggregation.ts:74-80`; pooled rate upstream (W1-3 M-ROLL-014). Assists numerator is NST-only upstream (Batch A W1-3 A). | NST | Upstream 60× fallback (W1-3 D1) applies where NST rows are missing | Live. |
| 047 Blocks/60 | **Sound** | `:125-131`. Scorekeeper-sensitive flag is set. | NST | — | Live. |
| 048 xS% | **Wrong** | D5. | Decision 17 | About a quarter low against Fenwick (sized by assumption, see D5) | Live. |
| 049 Goals Above Expected | **Wrong** (last-N) | D4. Season value is a real count. | — | D4 | Live. |
| 050 Goals/60 | **Sound** | `:67-73`. | NST | — | Live. |
| 051 Hits/60 | **Sound** | `:118-124`. | NST | — | Live. |
| 052 Individual xG/60 | **Sound** | `:139-145`; NST ixG. | NST; decision 6 | — | Live. Label should say NST. |
| 053 On-ice GF% | **Sound** | `:342-357`. Season uses `oi_gf_avg_season` and `oi_ga_avg_season`: a ratio of per-game means, equal to the ratio of sums when both average the same games. | NST | — | Live. Strength-scoped; "all" includes special teams. |
| 054 On-ice xGF% | **Undetermined** | `:359-375`, same construction. Whether `oi_xgf_avg_season` and `oi_xga_avg_season` are averaged over identical game sets was not checked. | NST | — | Live (5v5 only). A five-player recompute against NST settles it. |
| 055 Penalties Taken/60 | **Sound** | `:132-138`. Counts penalties, stated in the caveat. Inherits W1-2 D3 (penalty classes) through NST `total_penalties`: check after that fix. | Decision 13 | — | Live. |
| 056 Points/60 | **Sound** | `:88-95`: (avg × GP) ÷ (avg × GP) for season, totals for last-N. | NST | — | Live. |
| 057 PP Points/60 | **Wrong** (inherited) | `:96-103`. Uses `pp_toi_seconds`; W1-3 D6 found the PP denominator wrong upstream. | NST | See W1-3 D6 | MCM (all/pp only, unpublished today). Conditional. |
| 058 Primary Assists/60 | **Sound** | `:81-87`. | NST | — | Live. |
| 059 Relative 5v5 GF% | **Undetermined** | `availabilityStatus: "planned"` (`metricDefinitions.ts:737`); no implementation. | NST Rel | — | None. |
| 060 Relative 5v5 xGF% | **Undetermined** | Planned (`:769`). | NST Rel | — | None. |

---

## 3. Defects, fixes, tests and priority

P0 = a user-visible wrong number on a live surface today. Suggested constants are hypotheses (rule 12).

### D1 · Goalie GSAA/60 unit error and per-game summation (M-RNK-013, 011) · **P0, live**
- **Where.** `goalieMatrix.ts:727-731` accumulates `nst_5v5_counts_toi` as `nst5v5ToiSeconds`; `:619-622` computes `gsaa ÷ toi × 3600`.
- **Evidence.** Executed: six rows of `goalie_stats_unified` on 2026-11-05 hold 48.05, 52, 34.47, 48.78, 53.45, 48.78, which are minutes. Fixtures use 3000 (`goalieMatrix.test.ts:166` and nine more).
- **Size.** Displayed value is 60 × the per-60 figure. Rank and percentile do not change. Dated sample of six rows; the unit is a property of the column, but confirm on the view definition before relying on it.
- **Second defect.** GSAA is the sum of NST's per-game values. On the sample all six games imply the same league SV% (.897), a per-date baseline, so a window sum mixes daily baselines. Decision 10 requires the aggregate formula.
- **Readers.** Goalie matrix GSAA/60 column and the Value Signal (uses the summed count). Check `playerImpactRatings.ts` goalie `gsaaPer60` for the same assumption.
- **Fix.** Convert at the adapter with a named unit; compute GSAA = SA × (1 − league 5v5 SV%) − GA over the window, with the league rate for the same season, strength and date range; unavailable when the league rate is missing.
- **Test.** From components on a frozen fixture in minutes: GSAA/60 must equal GSAA ÷ minutes × 60. Add a unit-contract test that fails if a 5v5 TOI per game exceeds 65 (minutes) or falls below 200 when seconds are expected. Replace the fixtures' 3000 with realistic minutes.

### D2 · Team style and luck read the bucket-heuristic xG (M-RNK-004, 005, 033) · **P0, live** (owner: M-UST-080 / W1-1 D6)
- **Where.** `teamMatrix.ts:1205-1228`, `:765-803`; NST fallback per team `:1438-1442`.
- **Evidence.** Executed aggregate on indexed columns: season 20262027, game type 2, fiveOnFive, allScores, to 2026-11-10: 568 rows, 32 teams, GF 1,134.0, xGF 2,122.8, FF 18,236.
- **Size.** xG 87% above goals. Mean team Fin Luck about −31 and Save Luck about +31. Relative order partly survives, but the heuristic's goal floor rewards teams by their goal counts, so the order is not NST's either. Not compared team by team.
- **Readers.** Team matrix xGF%, Shot Quality, Event Rate, Fin/Save/Net Luck, the style badge and their percentiles.
- **Fix.** Per decisions 6 and 12: read NST 5v5 xG for all 32 teams from one source, labelled NST, or hide these columns until a clean model exists. Never mix sources inside one ranked column; if a team is missing, show unavailable (rule 5). Per decision 7, exclude empty-net shots.
- **Test.** Selection test: every team in a ranked column has the same `source`. Identity on a frozen fixture: Σ Fin Luck + Σ Save Luck = 0 across the league when each game is counted for both teams. A league-level sanity alarm (not a pass rule): |Σ(GF − xGF)| ÷ ΣGF stays small for a calibrated source.

### D3 · Results Luck Index: units, exposure, baseline and sign (M-RNK-017, 016, 031, 038) · **P1 today (conditional), P0 when published**
- **Where.** `resultsLuckSources.ts:105-123` (rate aliases read as counts and subtracted from season counts), `:140-153` (window count against season-remainder count), `:155-165` (flag from field presence), `:266` (source rows only for players who played on the snapshot date); `resultsLuckIndex.ts:151-153`; `playerMatrix.ts:884-888`.
- **Mechanics.**
  - GAx component: current = G/60 − ixG/60; baseline = (season G − G/60) − (season ixG − ixG/60); index = 100 + (current − baseline) ÷ 2 × 100. Executed example, Draisaitl, all strengths, 2026-11-05: current 0.853, baseline 4.72, component −93, clamped to 0 ("running cold") for a player 5.6 goals above expected.
  - On-ice component: a 20-game GF − xGF count against the remainder's count; a player at the same rate over a longer remainder always reads "cold".
  - SAX component: the "baseline" subtracts a rate of about 1 from counts of 60 to 120, so it is the full season including the window (same example: 4.63 against 4.65).
  - `baselineWindowExcluded` is true whenever the seven numbers are non-null (Batch A W1-3 A).
  - IPP is the only component built from real window and remainder counts.
- **Evidence of the sign.** Executed: 61 published rows (2025-26, 5v5, last 20, 2026-04-16, mean 74 GP): corr(index, window GAx rate) = −0.449; corr(index, season GAx) = −0.276; range 48.3 to 137.3; 9 "hot", 13 "cold". One date, n = 61: an alarm consistent with the algebra, not a population rate.
- **Coverage.** Current season: 0 of 732. 2025-26 last-20 all-skaters cohort: 61 of 776 (8%). Causes: season windows cannot publish (no peer fallback is wired), and `:266` drops everyone who did not play on the snapshot date.
- **Readers.** `skater_composite_ratings.results_luck_index`; player matrix cell (clamped, shown with a "%" tone), composite sort, snapshot strengths and weak spots; the metric's `higherIsBetter: false` then reverses the rank.
- **Fix.** Decision 23: every signed component is (G − ixG) ÷ TOI × 3600 in the window against the same rate on the non-overlapping baseline, from explicit count and TOI fields (W1-3 D2's component pairs). Prove window membership inside the season; otherwise unavailable. Decision 34: the judged games are never in the baseline. Present it as an index centred on 100 with its own scale, never in a percentile slot; decide the rank direction once. Scales 2, 10 and 4 and the 0–200 clamp need fitting or a "presentation choice" label.
- **Tests.** (a) Algebraic: equal window and baseline rates give exactly 100 whatever the two exposures. (b) Monotone: raising window goals with everything else frozen never lowers the index. (c) The Draisaitl-type fixture (window crossing the season start) returns unavailable. (d) Reader test: the matrix cell does not clamp and does not use percentile tones. Correct `skaterWindowAggregation.test.ts:27-30` (W1-3 D2).

### D4 · Last-N "Goals Above Expected" and "Unrealized xG" are rate differences (M-RNK-041, 049) · **P0, live**
- **Where.** `skaterWindowAggregation.ts:314-321`, `:417-431`.
- **Size.** Executed example above: +0.85 shown for about +5.8 goals. Roughly TOI ÷ 3,600 too small for any player with more than 60 minutes in the window. The ranking order also differs from the count's because the divisor is each player's TOI.
- **Readers.** Rankings table and matrix for those two metrics in last-N windows; Offense Rating finishing sub-score; entity snapshot rows.
- **Fix.** Read explicit window counts (the W1-3 D2 fix). Decide whether the ranked metric is a count or a per-60 rate and label it; season and last-N must share one unit.
- **Test.** From a fixture row: last-N GAx = window goals − window ixG; season and last-N on an identical game set give identical values.

### D5 · xS% and SAX% denominators (M-RNK-048, 030, 041) · **P1, live**
- **Where.** `skaterWindowAggregation.ts:311`, `:321`, `:391-415`; labels at `metricDefinitions.ts:551`, `:569-575`.
- **Evidence.** The field is `shot_attempts_per_60_shot_attempts_*`, which the same file defines as NST iCF. Batch A already lists rankings as "ixG ÷ all attempts". Executed: Draisaitl has 120 attempts on 62 shots on goal (ratio .52), in the range expected of all attempts rather than unblocked ones. I did not re-read the rolling writer; the upstream audit owns that.
- **Size.** If blocked attempts are about a quarter of all attempts (an assumption, not measured), xS% is about a quarter low against decision 17 and SAX% is scaled by the same factor. "Actual shooting %" inside SAX% is goals ÷ attempts, not goals ÷ shots on goal.
- **Fix.** One definition (decision 17): ixG ÷ unblocked attempts, 0–100. Use `xgDenominatorSemantics.ts` and an iFF field; drop the "verified" flag until a test proves it. The last-N ratio of two pooled rates is correct only while both share one TOI; read counts instead.
- **Test.** Recompute from ixG and iFF on a fixture; assert the denominator field's semantic tag is Fenwick.

### D6 · Season xGA/60 sample gate uses per-game TOI (M-RNK-041, 039, 019) · **P1, live**
- **Where.** `skaterWindowAggregation.ts:310` (component = `toi_seconds_avg_season`), `:553-558` (rate stats take the denominator as sample TOI), `:273-274`.
- **Size.** Executed, single date 2026-11-07, 5v5: of 106 skaters with a row, 8 average under 600 s per game; 5 of those have 10 or more games (over 100 minutes) and are excluded; 1 player with 2 or fewer games passes. Dated sample of one night's players.
- **Readers.** xGA/60 ranking, Defense Rating's 45% suppression term (dropped and renormalised for those players), stored snapshot rows.
- **Fix.** Sample TOI = per-game average × season games (the fallback two lines below already does this), or better, a stored season total.
- **Test.** A 40-GP, 550 s-per-game fixture qualifies; a 1-GP, 700 s fixture does not at a 1,200 s floor.

### D7 · Composite scale, policy and sample (M-RNK-018–021, 031, 036–038, 040) · **P1, live**
- **Evidence.** Executed aggregate over 17 published cohorts (scalar columns only). Current season: one cohort (2026-11-07, season, 5v5, all skaters, n = 732; 731 scored). MCM mean 59.3 and median 62.5; Offense mean 47.5; Defense 49.9; 148 tiered. Rows carry `contextual_composites_v1` (written 2026-11-09) while the code constant is `_v2` (`skaterCompositeMethodology.ts:70`): the publisher ran older code or has not re-run.
- **Issues.**
  1. Scale: none of the three is a percentile, yet contracts say `percentile_0_to_100` for two of them and the UI prints "%" with percentile tones. MCM's centre is about 61.
  2. Missing inputs: Offense/Defense reweight; MCM refuses (TRIAGE headline). Rule 5 favours MCM's policy or an explicit "partial" state.
  3. Sample: published at 1 GP / 300 s only. The matrix hides a cell when the player misses the request's minimum (`playerMatrix.ts:846-870`), but the percentiles inside it were still measured against the 1-GP population.
  4. Only 5v5 is published; all, ev, pp and pk requests find no row.
  5. Population: each player at his own last game date (036).
- **Fix.** Name the scale ("score, 0–100, not a percentile") or convert to a true percentile of the composite inside the published cohort; one missing-input policy; let the durable key carry the sample thresholds, or publish at the page defaults (owner question 1); state the cohort date rule.
- **Tests.** Identity: with every component at 50 each composite returns 50 (true today; it shows the scale claim is about the centre of inputs, not of outputs). Distribution check on a frozen cohort as an alarm. Policy: a rating with a missing required component is null or flagged partial. Reader: composite cells never use percentile formatting unless the value is a percentile.

### D8 · All-strength TOI per game in last-N (M-RNK-032) · **P1, live early season**
- **Where.** `playerMatrix.ts:649-668`. Fix: divide by the window's own game count (same source as 042's fix). Test: a fixture whose window crosses the season start returns window TOI ÷ N.

### D9 · Quality-start family (M-RNK-014, 044) · **P1, live**
- Splits QS (`splitsServer.ts:825-832`) is a fixed .910 rule under the "QS" label: breach of decision 40.
- Matrix QS% uses the NHL flag: verify its boundaries against Vollman once, then either adopt the shared implementation or label it "NHL QS".
- "RBS%" is a 5v5 GSAx ≤ −2 rule: rename as an FHFH measure or use Vollman's SV% < .850. Steal Rate is FHFH-defined and says so.
- Fix: the one shared implementation decision 40 calls for (league average for the matching season and scope, credited starter only), used by matrix, splits and W1-8's reader. Tests: boundary cases at the league average, at .885 with ≤ 2 GA, low shots, missing league average → unavailable.

### D10 · Impact ratings are stale and pooled (M-RNK-027, 007, 026) · **P1, readers live**
- Executed: `skater_offensive_ratings_daily` latest snapshot 2026-03-08 (881 rows). Readers: `entityRatingsOverlay.ts`, `game-predictions/featureBuilder.ts`, `qotQoc.ts`.
- Method issues: one z pool for F and D; missing = league average; no minimum TOI; ordinal 0–100 from a shrunk raw score.
- Fix order: establish what each reader does with an 8-month-old snapshot (selection tests, rule 4) before touching the method; then position-specific pools, explicit missing handling and a TOI floor. QoT/QoC needs an as-of rating per game date (rule 10).

### D11 · Sample floors and special-teams gates (M-RNK-002, 008, 035) · **P2**
- "High" confidence at twice a tiny minimum; zero-second PP/PK floor; 100-shot goalie percentiles. Fix after owner question 1. Tests are definitional once floors are chosen.

### D12 · Default season hard-coded to 2025-26 (M-RNK-040, 025) · **P1, not observed in a browser**
- `rankingUrlState.ts:101`, applied at `:352`; `war.ts:60`. Source-confirmed that no override exists in `pages/rankings.tsx`. If so, `/rankings` without `?season=` shows last season. Fix: resolve the current season from the seasons table. Test: default filters equal the current season id on a mocked clock.

### D13 · Smaller items · **P2**
- 028: numeric comparator, mid-rank ties, null for no games (dormant route).
- 022: no tag when the opposing percentile is missing.
- 009: use the windowed mode for deployment peers, or label "last game's line".
- 024: say "percentile change, last 5 against last 20 (overlapping)"; shrink before any ranking use.
- 006/010: pooled rates where exposure differs.
- 015: split "projected share" from "observed share".

---

## 4. Owner questions (not answered by decisions 1–68)

1. **Composite sample floor.** Should Offense, Defense and MCM be published against the page's default minimums (10 / 5 / 3 / 2 GP) instead of 1 GP and 5 minutes, and should minimum TOI scale with the window?
2. **What a composite cell means.** Is each composite a score on its own 0–100 scale, or should it be re-expressed as a true percentile within the published cohort? This also sets what the BEAST thresholds mean.
3. **Missing inputs.** One policy for all composites: refuse (as MCM does), or publish a labelled partial score?
4. **Rankings last-N windows.** Decision 61 lets sustainability offer both a current-season view and a labelled cross-season view. Does rankings follow the same rule, with current-season as the default?
5. **Count or rate for "Goals Above Expected" and "Unrealized xG"** as ranked metrics. Decision 23 settles the luck index only.
6. **Goalie matrix strength.** SV%, QS% and Start Share are all situations; GSAx, GSAA/60, HD SV% and Rel SV% are 5v5. Keep the mix with labels, or one strength per view? And is the Value Signal (mean of GSAx and GSAA) wanted at all?
7. **Deployment peer group.** A player's line from his last game, or his usual line over the window?
8. **RBS and Steal names.** Vollman's RBS, or a separately named FHFH measure (decision 40 covers only "Quality Start")?

---

## 5. Limits

- **Not re-read (classified from the packet):** `trending.ts` surface builder beyond the delta and signal functions; `splits.ts`; `deploymentTiers.ts` surface assembly; `teamUnitToiBuilder.ts` PP branch and writer; `skaterCompositeSourceCoverage.ts`; `entityMetricRankingWriter.ts`; `comparison.ts`; `adjustedImpactPromotionContract.ts`; goalie impact aggregation (`playerImpactRatings.ts:293-394`); the rolling writer (owned by W1-3).
- **Not run:** no tests, no browser. D12 and every "live" label are from source and routing, not an observed page.
- **Not established:** whether QoT/QoC rows exist for 2026-27; whether `oi_xgf_avg_season` and `oi_xga_avg_season` cover identical games; the WGO `quality_start` boundary rule; the exact blocked share for D5; team-by-team order change in D2; why published rows are `_v1`.
- **Magnitudes are dated samples** (rule 1): each states its date and n. The −0.45 correlation is one date and 61 players.
- **Database reads** (all read-only; `pg_stat_activity` checked before each heavier read: 1 other active query, none over 10 s):
  1. `pg_class` sizes for `skater_composite_ratings`, `entity_metric_rankings`, `team_unit_toi`, `rolling_player_game_metrics`, the three ratings tables, `team_power_ratings_daily`.
  2. `skater_composite_ratings` grouped by season, snapshot, window, strength, peer group and methodology version: counts of rows, `mcm_score`, `results_luck_index`, offense, defense, `beast_tier`; mean and median MCM; mean offense and defense; `max(updated_at)`. 3,836 rows; no jsonb columns selected.
  3. `pg_indexes` for `rolling_player_game_metrics`, `skater_offensive_ratings_daily`, `team_underlying_stats_summary`.
  4. `team_underlying_stats_summary`: `count, sum(gf), sum(xgf), sum(ff), count(distinct team_id), max(game_date)` where `strength='fiveOnFive' and score_state='allScores' and season_id=20262027 and game_type=2 and game_date>='2026-10-01'`.
  5. `skater_offensive_ratings_daily` at its `max(snapshot_date)`: count, mean and max `sample_toi_seconds`, mean and max `sample_games`.
  6. `rolling_player_game_metrics`: scalar window and season fields for `player_id in (8478402, 8477934)`, strength all and 5v5, season 20262027, `game_date >= '2026-11-01'`, limit 4 (only 8477934 returned within the limit).
  7. Join of the 61 non-null luck rows (`season_id=20252026, snapshot_date='2026-04-16', window_type='last_20', strength_state='5v5', peer_group_key='all_skaters'`) to `rolling_player_game_metrics` on its primary key (`game_date='2026-04-16'`, 5v5): correlations, mean, min, max, band counts, mean GP.
  8. `goalie_stats_unified where date='2026-11-05' limit 6`: starts, `quality_start`, saves, shots, NST 5v5 TOI, GSAA, xGA, GA, shots.
  9. `rolling_player_game_metrics where season=20262027 and strength_state='5v5' and game_date='2026-11-07'`: counts under 600 s per game, by games played.
- No NST, NHL API or Yahoo calls; no secrets printed; `GIT_DIR` never set; no scratch scripts were written.

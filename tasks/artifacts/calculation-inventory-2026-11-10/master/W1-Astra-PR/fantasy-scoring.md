# W1-12 fantasy-scoring: independent peer review

2026-11-11. Review of Fable's `fantasy-scoring.md`, audit commit **`fbceea028f71737b2d55745b9556f96ebe1d26aa`**, on the canonical `octoberBranch` checkout on Tim's Mac. Fable cites source `37106e4ab`; the principal scoring, Game Grid, pickup, comparison and Yahoo-history implementation paths have no diff between that source and this review's commit. Paths below are relative to `web/` unless stated otherwise.

**Late coordination check:** checkout HEAD advanced during review to `3c65bd45adcefff9e184706f4e638fe0345edcf0` through owner-decision documentation and the Crease Shift release merge. Reviewed scoring, provider-history, Game Grid, pickup, draft and comparison implementation paths have no diff from `fbceea028`; no working-tree edits in those paths were present. Newly added decisions 24–39 were read before delivery. Decision 30 keeps sportsbook ingestion held until repairs; 38 keeps the native path unserved pending qualification, without abandoning it; 39 requires independent calibration evidence and uncalibrated interval labels meanwhile. None settles the off-night/idle-player/default-label questions below.

This is an addendum to [Fable's audit](../audits/fantasy-scoring.md). Read with the [W1-12 prompt](../wave1-prompts/w1-12-fantasy-scoring.md), [owner decisions](../OWNER-DECISIONS.md), [Batch A consolidation](../BATCH-A-CONSOLIDATED.md), and the [RSO](rso-roster-optimizer.md), [game predictions](game-predictions-odds.md), [season forecasts](player-forecasts-season.md) and FORGE peer reviews. Only this report was saved. No application modifications, DB access, provider or production requests, installs, deployments, pushes or commits.

## Assessment

**Keep the sentinel-normalization defect, the goalie-rate valuation concern, and the weak common-factor sensitivity scenario. Correct D6's reader evidence, the claims about Sunday and lexicographic ranking, and several proposed invariants. Add false-zero handling in category valuation and Yahoo historical results, and the date-range state mismatch.**

- Independently reproduced Fable's weekend numbers: Saturday active-team multipliers **1.203189–1.25**, versus the intended full range 0.75–1.25; Sunday all 14 active teams get 1.25. However, Sunday's 14 teams have **identical one-game/off-night schedules and no odds in this fixture**. Equal active-team boosts are not independently a defect, and the boost still distinguishes them from idle teams.
- Independently reproduced shrinkage against an unshrunk standard deviation. With two 1,200-shot goalies, the SV% z-score SD is **0.5**, not 1. Adding a one-shot .500 goalie moves the established goalies from **−0.353553/+0.353553 to +0.267314/+0.309522**. The mechanism is real; Fable's actual-total sample does not measure current projection-rank errors.
- **New:** a player with no observed category values receives a numeric **0**, outranking a real below-average player. Missing goalie workload also silently erases rate contributions.
- **New:** Yahoo past points and credited goalie appearances can return **false zero** for partial game loads and trades. Synthetic old-team two-goal performance produces **0 instead of 6 points** after selecting the current team's other game.
- **Correct D6:** Draft Pro recommendations preserve a negative category sign; the cited `Math.abs` is in a normalization denominator. Actual remaining inconsistencies exist in settings validation, standings and reports, but two cited lines describe unrelated kinds of weights.

The audit's **26 Sound / 20 Mis-specified / 6 Wrong / 1 Undetermined** tally is not independently certified. Entries 043/044 require revision, 013 needs an additional missing-data defect, and several “mis-specified” verdicts are proposed product policy rather than proven formula errors. No fresh production incidence, calibration result or current serving flag is established.

## 1. Additional defects

### R1. Missing categories and missing rate exposure become average value

**M-FSC-013; P1, conditional on incomplete inputs reaching category readers.**

`lib/scoring/categoryScores.ts:119-140` initializes every player's score to zero, skips missing category values and zero-deviation categories, and always inserts a numeric result. With GOALS=[1,3,missing], actual output is **[−0.707107,+0.707107,0]**. A completely unknown player ranks above the measured low player. Partial players receive composites over different observed category sets without coverage in the return type.

For rates, `:73-79` treats absent SA or starts as zero workload, making the regressed rate exactly the pool mean. Two otherwise distinct SV% values .900/.920 with absent SA both score **0**. This differs from explicitly choosing a conservative score for a measured, genuinely zero-exposure projection. Nonfinite workload can also poison the sum and be replaced wholesale by 0 at `:139`.

Readers include `pages/fantasy-projections.tsx:1057-1068`, `lib/draftDashboard/playerValues.ts:43-87`, and `lib/draft-pro/recommendations.ts:157-168`. The latter does add a missing-category reason and derives ratio components (`:85-105,124-129`), but its global category scorer still has this numeric fallback. The dashboard synthesizes SA/starts aliases where possible; that does not justify assuming missing exposure is known zero. Complete published projection contracts may prevent some inputs in normal operation; that was not measured here.

**Repair:** return explicit category coverage and unknown composite eligibility. Preserve measured zero and zero-variance categories separately. Require valid, matched rate exposure, or use a deliberately named rate-only method rather than manufacture a population-average contribution. Do not make incomplete players outrank complete ones through an undocumented zero-fill policy.

**Tests:** wholly missing player, one missing enabled category, absent versus genuine-zero exposure, nonfinite exposure, and complete zero-variance population. Test each reader's display, rank eligibility and replacement-pool behavior. A known subtotal can be shown, but not labeled a complete comparable value.

### R2. Yahoo historical points and goalie credits mistake absence for a confirmed nonappearance

**M-FSC-043/044: revise Sound to Wrong for these input cases. P1; historical attribution/completeness, not measured live prevalence.**

`lib/integrations/yahoo/rosterPlanning.ts:52,74` resolves each past game using the player's **current** `teamAbbreviation`. The appearance counter repeats this at `:118`. Neither uses a team-of-record-by-date or a game identity attached to the historical entry.

Executed actual exported functions with an in-memory query stub:

1. Player now on NEW; on Nov 1 he scored two goals in OLD game 1. NEW also played game 2 with another player's row. Past points selects game 2 and returns **0**, instead of the supported **6** under G=3.
2. Goalie now on NEW; only OLD had his historical game. The credited-appearance reader skips the missing NEW game at `:119` and returns **0**, despite an OLD appearance row in the synthetic data.
3. Final game contains only an unrelated skater row. Missing target-player row returns **0 points** at `:78-81`.
4. Final game contains only the opposing/another goalie's row. Missing target-goalie row returns **0 credited appearances** at `:130-134`.

The last two cases contradict the “unknown on any gap” claim: existence of *one game row* is not a completed ingestion/roster receipt. This is distinct from the actual-start-label defects already owned by W1-5. These functions intentionally count **appearances**, not official starts; do not conflate the two contracts. Null `games_played` on an own goalie row also fails the `>0` test rather than establishing unknown.

**Repair:** resolve historical team/game by dated roster membership or an immutable game binding. Use a complete per-game/player-population ingestion receipt before inferring a DNP from absence; otherwise return null. Retain explicit zero only when supported. Apply owner decision 16's date-of-record principle without pretending that decision itself specifies Yahoo's provider minimum rule.

**Tests:** trade before/after date, old/current teams both play, current team idle, incomplete one-side goalie load, explicit DNP in a complete load, absent own row and null appearance field. Verify downstream banked totals and goalie-minimum risk preserve unknown. Coordinate with the RSO review; no duplicate implementation is requested.

### R3. Date-range grid also counts postponed/cancelled games and playoffs

**M-FSC-049; P2, visible only when such schedule cells are present.**

The mismatch is broader than “only ranges that include preseason.” `components/GameGrid/DateRangeTeamGrid.tsx:50-61,123-139` counts B2Bs and venue games from any positive game ID. Off-nights require type 2 but never reject PPD/CNCL. `utils/useDateRangeTeamGrid.ts:111-138` likewise recounts regular-season game IDs and stores cells without state filtering. The server preserves `gameScheduleState` and `gameState` (`lib/NHL/server/index.ts:530-539`). In contrast, the main grid uses `isRegularScheduleGame` (`utils/helper.ts:12-16`), which rejects both states.

Executed the actual `computeBackToBacks` function on one postponed game followed by one future game: **1 B2B**. This fixture confirms the counting mechanism, not a live cancelled-game example. Playoff cells also count toward B2B/home/away while contributing no off-nights.

**Repair:** decide whether this calendar intentionally includes multiple season phases; label those totals if so. For regular-season streaming metrics use the same phase/state eligibility helper for every count, including league slates. Do not classify missing slate metadata as a confirmed zero-game off-night. Include the day before the range when the metric means “second nights occurring in the range.”

**Tests:** postponed/cancelled/regular/playoff fixtures and a boundary-spanning B2B. Do not fix only preseason filtering.

## 2. Corrections and tighter remedies

### C1. D1 is a real sentinel defect, but its description and fix need bounds

`calcWeekScore.ts:62` returns −100 for no games, and `components/PlayerPickupTable/PlayerPickupTable.tsx:2755-2779` includes it in min/max. Boost is enabled by default (`:1886`) and past weekdays are automatically excluded (`components/GameGrid/GameGrid.tsx:528-532`). Fixture replay agrees with Fable:

| Included horizon | Idle teams | Active multipliers |
|---|---:|---:|
| Full week | 0 | 0.75–1.25 |
| Saturday onward | 1 | 1.203188864–1.25 |
| Sunday | 18 | 1.25–1.25 |

Saturday still has a nonzero spread, so “no schedule information” is too strong. Sunday active teams all have GP=1, ON=1 and the same crowding score; **they should tie** absent matchup differences. The arbitrary −100 baseline shifts all active multipliers upward and changes active-versus-idle calibration; it does not erase an actual Sunday schedule distinction in this fixture.

The proposed typed no-games result is good, with all readers updated. But min/max scaling on the remaining active teams can expand a tiny matchup-only difference into a full 0.5 multiplier spread. Freeze a meaningful reference scale or explicitly document relative rank normalization, including all-equal/one-active/all-idle cases. Idle-team policy is still an owner decision. Relabeling a boosted blend is preferable to blindly capping at 100, which creates ties and destroys ordering. `sortByValue=-1` in no-metric mode should not be multiplied (`:2736-2739,2793-2797`).

### C2. D2 proves attenuation, not a universal sixfold current error

The source does shrink the numerator while retaining raw-rate population SD (`categoryScores.ts:67-82,98-118,128-136`). If all workloads are equal, the rate z-score is exactly the raw z-score multiplied by **SA/(SA+1200)** for SV% or **starts/(starts+25)** for GAA. At SA=1200 or starts=25, SD becomes 0.5. At 60 starts the GAA factor is about 0.706; “nearly ignores GAA” does not follow generally.

This could be a deliberate reliability-weighted composite, not invalid algebra. It is **not** an equal-scale z-score of the transformed population and does not implement the brief's roster-pool impact valuation. The existing test deliberately pins the attenuation (`categoryScores.test.ts:32-53`); a passing test is not validation of the desired fantasy-ranking contract.

Fable's 98-goalie/951-skater DB aggregates, 36-goalie/170-skater comparison pools, correlations and rank moves are **reported 2026-11-11 sample evidence, not independently rerun**. They use actual results and noisy one-game rates, not the regressed projections the readers normally score. The report's .15 versus .62 SD comparison implies about **one quarter** as much variation as wins in that specified comparison, not universally one sixth. The 36-player pool and rank positions beyond 36 also require a retained evaluated-cohort manifest to reproduce exactly. Do not use those figures as current user-impact measurements.

For a candidate impact method, define components and direction explicitly:
- SV%: `SV − poolSV% × SA`.
- GAA: `poolGAA × TOI_seconds/3600 − GA` (positive is better).
- Pool rates: summed numerators divided by their matched summed exposure.

GAA exposure is actual projected ice time, **not starts**. Select/validate the rostered reference pool under real roster constraints and provider rules. Population choice, uncertainty shrinkage and impact conversion are separate decisions; do not assume dropping all uncertainty treatment is universally right because a projection is already regressed.

**Correct invariants:** sample SD=1 only for an unweighted standardized, finite, nonconstant feature in the fixed reference pool, using the same SD convention. Weighted feature SD is |weight|. Zero variance cannot have SD 1. Adding an excluded goalie must leave scores unchanged only when the pool/baseline is frozen; a fitted/selected pool can legitimately change. Above-average workload monotonicity must hold with the baseline and all other categories fixed, and GAA direction reversed. Validate ranks and predictive usefulness separately from these algebraic properties.

### C3. D3 executes, but the UI already says this is a stress scenario

An actual-source fixture with baseline=10 and candidate=11 GOALS gives differences **0.8,1,1.2**, always `candidate`. Thus the uniform shock provides no meaningful sign sensitivity for fixed linear counting-stat comparisons with common banked totals. The code already labels these as **stress scenarios, not calibrated probabilities or confidence intervals** (`planComparison.ts:140-144`); do not say it reports statistical robustness or confidence.

The exemption is the entire `/MINUTES|TIME_ON_ICE|PERCENTAGE|AVERAGE/` regex (`:156`), not only PIM. PIM is the clear counting-stat mistake. For mixed exempt/nonexempt scoring the sign can change; for missing comparison evidence the result is `unavailable`, not a reassuring pass. Keep the lineage/eligibility safeguards at `:41-76`.

A useful replacement stresses differential contributions while reusing exactly the same draw for shared player-games. Define deterministic differential/participation scenarios first, or fit a joint error model before sampling. Do not invent calibrated distributions from ±20%. The proposed “candidate wins by less than 20% of added-player contribution” test needs a fully specified scenario and retained baseline; it is not a universal rule for every comparison.

### C4. D6's overall inconsistency stands; three reader claims need correction

- **Draft Pro recommendations do not lose the sign.** `lib/draft-pro/recommendations.ts:164-168` calls `calculateCategoryScores` with the signed weight. `:133` uses `abs(weight)` only in `totalNeed`; the directional numerator at `:140-145` uses the signed score. Executed FACEOFFS_LOST weights −1, positive need, equal baseline: 1 loss gets **0.353553** bonus and 3 losses gets **0**. The alleged sign-loss mechanism is false.
- **The cited standings line 100 checks a rate's workload**, not category weight. The actual direction bug is `lib/draftDashboard/categoryStandings.ts:263-268`: in category mode it ignores signed weights and trusts `STATS_MASTER_LIST.higherIsBetter`. Executed higher-is-better GAA encoded with weight −1: category score prefers GAA=4, but standings rank GAA=2 first.
- **The cited settings-validation line 227 checks source multipliers.** Negative category weights really are rejected, at `settingsValidation.ts:183-194`. Keep that finding with the correct evidence.
- `lib/draft-pro/reports.ts:58-60` really uses the fixed inversion list, so its comparison can disagree with signed scoring.
- There is already another stat definition registry: `lib/projectionsConfig/statsMasterList.ts`, including FACEOFFS_LOST lower-is-better (`:240-243`) and OTL lower-is-better (`:281-284`). The shared scorer's three-key inversion list omits both. Prefer consolidating/extending existing definitions and preserving provider overrides rather than introducing yet another independent registry.
- Yahoo adaptation drops provider direction in its positive-one category mapping (`liveDraft.ts:449-498`); Fantrax mapping does not show a direction field (`normalize.ts:619-641`). Neither today's provider payloads nor published provider rules were fetched. “OTL must be bad” or “common setups all work” are not universal statements across leagues.

**Start Chart scope:** `BOARD_CATEGORIES` does not include GAA, SV% or starts (`starterBoardScoring.ts:11`), request parsing rejects unsupported categories (`:34`), and Yahoo personalization adds unsupported-setting limitations (`starterBoard.ts:142-145`). The suffix-only routing at `:244` is defective for these keys if it is reached, but Fable correctly observes failure/limitation rather than a verified silent live mis-rank. Do not infer a production bug from a branch whose serving and fallback flags remain unverified, per the owner/W1-5 notes. Current supported category inversion is only GA; test future supported additions rather than silently expanding capability.

### C5. Off-night conventions are not inherently one interchangeable score

There is a common **≤8 regular-season game** threshold in the principal helpers, but differing values and horizons. Week Score weights an off-night game 10 versus a busy-night game 6; opportunity weights 1.25 versus 1. These can be different documented product utilities. Their coexistence is a consistency/owner-decision question, not proof that either arithmetic is wrong.

The formula does **not** rank lexicographically “games first, then off-nights” for all inputs. With equal centering and neutral nudges, 3GP/3ON scores **30**, beating 4GP/1ON **28**. Fable's own summary contains this counterexample. The source promise is narrower: it preserves the particular 4GP/1ON versus 3GP/2ON edge and bounds matchup/crowding effects (`calcWeekScore.ts:44-48`). A fixture ordering is not a proof of a universal ordering contract.

Two additional numerical corrections:
- Weighted off-night helper ranges from **0.285714 at 7–8 games to 0.392857 at 1 game**, not 0.286–0.32 (`helper.ts:78-108`). This is a separate legacy/display-path concern.
- Dormant `getFourWeekScore` adds the raw **difference of 0–1 points percentages** (`scheduleSummary.ts:35-41`). Pool .600 versus opponent .400 contributes **0.2 games**, not inherently “a hundredth of a game.” The full possible magnitude is 1.0; typical magnitude requires data.

The four-week opportunity also excludes already started/final games (`scheduleOpportunity.ts:40-47`), while weekly day-level counts include today's finished games (`helper.ts:12-16`). A single weight cannot make those horizons identical. If the owner chooses common semantics, align window/state eligibility, unknown coverage, ratio and labels. Test identical inputs and frozen horizons. Do not require every existing schedule score to have identical ordering while one deliberately includes matchup/crowding and another does not. Inventory dependencies before deleting dormant helpers.

### C6. Back-to-back remedy must preserve probability validity

The 55→41.25 cut, missing-previous-odds detection and lack of prior-window date are confirmed (`calcWinOdds.ts:53-77`). Synthetic null-odds Monday followed by 55% Tuesday returns **[null,55]**; with Monday odds it returns **[55,41.25]**. This affects the Week Score bonus, not the unadjusted odds displayed by TeamRow.

Do not replace it with an arbitrary additive offset. A fitted paired probability/log-odds model must stay in [0,1], use net rest/venue information and preserve complementarity without double-counting the underlying odds model. Detect rest from dated schedule, not non-null odds; sequence position need not always mean the previous calendar date. Dropping/withholding the adjustment pending upstream repair remains consistent with owner direction. “A few percentage points” is uncited recollection, not a fitted repair parameter. The cited 0/274 API-odds rows are a dated W1-10 sample, not a new current fact.

### C7. Other conclusions to narrow

- **012:** an explicit SHG bonus plus SHP bonus gives 5 points for a shorthanded goal under this legacy custom dictionary (`scripts/fantasy_points_analysis.py:53-66`). That is not automatically double-counting error: leagues can intentionally score overlapping categories, just as G and PPP overlap. Establish desired weights before removing either bonus; dormant script scope remains.
- **009:** neutral per-play category utility is deliberate (`planning.ts:319-321`); complete plans still compare category outcomes through `categoryRelation` (`:67-77`). “Every play=0” does not prove all category recommendations ignore quality. Do not replace it wholesale with z-scores without defining the selected objective and reconciling W1-11's AGP-versus-category distinction.
- **040/041:** missing metric raw values are excluded from the all-metric composite, but their percentiles are stored as numeric 0 (`PlayerPickupTable.tsx:2547,2620-2640`) and then **included** in multiple-metric and single-mode display averages (`:2710-2733`). Fable's “left out of the average” is not true in all modes. Preserve unknown percentiles consistently.
- **045:** default copies match the local FHFH dictionary; no current Yahoo public-default reference was checked. The ledger explicitly calls these “League-default (TJ's)” (`servedForecastLedger.ts:59`). Do not infer a Yahoo compatibility promise from the existence of a default. Manual-default merging is real; choose missing-versus-zero semantics separately.
- **025:** retain the positive-input no-op tie redistribution finding, but incorporate W1-10 peer review's zero/zero NaN boundary. “Display unaffected” is only safe for the demonstrated ordinary positive lambdas. No rewrite of regulation draws into full-game outcomes without an explicit OT model.

## 3. Coverage of all 53 entries

“Retain” means no additional contradiction found within this review's stated scope, not validation of every production input or all of Fable's experiments. Executed checks are identified above/under Verification; other entries are source inspection. Reader/activation caveats override a blanket Sound label.

| ID | Peer-review disposition and evidence |
|---|---|
| 001 | Retain local weight equality; `modeling/player_forecasts/daily_board_training.py:17,24-26`, `daily_board_context.py:181-183`, `daily_board_baseline_issuance.py:97,110`. This is default skater arithmetic, not Yahoo verification or evidence of native serving. |
| 002 | Retain joint-draw weighted sum and coherent-count checks, `modeling/player_forecasts/daily_board.py:51-67`. Marginal quantiles must not be summed. It deliberately requires nonnegative category draws; do not generalize to arbitrary signed stats without changing contract. |
| 003 | Retain paired linear scoring under supported complete outcomes, `lib/player-forecasts/evaluation.ts:141-176`. Mixed-role absent keys exclude the row. No non-test caller established. |
| 004 | Confirm common-factor limitation with executed fixture; qualify exemptions, disclosure and eligibility, C3. `planComparison.ts:41-76,80-104,149-158`. |
| 005 | Retain default-only arithmetic; unsupported custom keys are ignored, `servedForecastLedger.ts:60-70`. Sound is conditional on its current default-weight callers, not a generic scorer contract. |
| 006 | Retain finite weighted arithmetic and permissions, `planning.ts:120-160`. Expiry filtering is specifically in `forecastPointsReader(:152-153)`; `gameForecastPoints` is documented readback of an already-admitted forecast, not an independent admission/expiry gate. |
| 007 | Retain per-player gains/sacrifices and explicit ratio components, `planning.ts:198-250`. These are outcome deltas, not sums of individual ratio changes. |
| 008 | Retain arithmetic/no live importer finding for the old `planning.ts:253-299,1580-1582` helpers. Do not confuse similarly named active `candidatePlanMetrics` code with this helper. |
| 009 | Qualify Mis-specified, C7. Neutral assignment weight is intentional, and complete category lineups have a separate partial-order comparison. `planning.ts:301-321,67-77`. |
| 010 | Retain pooled component-ratio arithmetic and unknown opponent guard, `planning.ts:60-90`; projected means compared with opponent means are not win probabilities. |
| 011 | Retain recent-form blend concern at its ranking consumer, subject to W1-11 corrections. `recentForm.ts:25-66` itself correctly sums/averages its declared played-game window. Provider loss semantics remain unverified. |
| 012 | Downgrade asserted error to intent question for the dormant custom scoring dictionary; C7. `scripts/fantasy_points_analysis.py:53-66,177-232`. |
| 013 | Retain valuation-contract concern with magnitude limits; add unknown-value failure R1. `lib/scoring/categoryScores.ts:67-140`; C2. |
| 014 | Retain assignment algorithm and conditional router limitation; C4. `weightedAssignment.ts:2-42`, `starterBoard.ts:142-145,238-245`. Fable's 4,000 trials were not independently rerun; see RSO review for separate matching evidence. |
| 015 | Retain stale ownership/window issue and percentage-point versus percent distinction, `ownership-trends.ts:183-198,443-460`. A universal 3-day rule/renaming is a product policy, not a mathematical cure by itself. |
| 016 | Retain historical-hint scope, `lib/rosterAutopsy/manual.ts:216-221`; it delegates rather than projecting from recent data. |
| 017 | Retain wrong unknown/partial percentage in an unread field, `GameGrid.tsx:540-549`; `getOpponentPointPct` already gives complete-only semantics. Not current evidence of a misleading rendered number. |
| 018 | Retain bounded interim matchup bonus, `calcWeekScore.ts:27-42`; inherited unvalidated odds and rest handling are separate. |
| 019 | Formula meets the narrower source promise, not universal games-first ordering. Sentinel consumer defect retained; C1/C5. `calcWeekScore.ts:44-77`. |
| 020 | Retain one bounded crowding term and explicit incomplete-coverage neutrality, `calcWeekScore.ts:6-24`. Neutrality here does not certify completeness of all other score components. |
| 021 | Confirm source/fixture defect and limited downstream role; C6. `calcWinOdds.ts:53-77`. |
| 022 | Retain midpoint tie bands and competition ranks, `fourWeekMetricBands.ts:4-21`, `metricRanks.ts:4-24`. Equal-size bands are not an invariant under ties. |
| 023 | Retain regular-game/state helper and league deduplication, `helper.ts:12-56,116-128`. Per-team day helpers do not themselves deduplicate repeated IDs; upstream normalized one-game/day data is assumed. |
| 024 | Correct numeric range; legacy alternative value is not inherently an arithmetic defect. `helper.ts:71-113`, `lib/socialShare/schedule.ts:100-108`; C5. |
| 025 | Retain ordinary positive-lambda no-op; add W1-10 zero-lambda qualification. `poissonHelpers.ts:45-61`; C7. |
| 026 | Retain observed midrank percentile with eligible coverage, `scheduleOpportunity.ts:12-38`. No claim of a calibrated predictive opponent rating. |
| 027 | Retain arithmetic for explicitly remaining-only opportunity; differing utility from Week Score is an owner/labeling decision. `scheduleOpportunity.ts:71-138`; C5. |
| 028 | Correct opponent contribution units and magnitude; dormant heuristic, `scheduleSummary.ts:21-42`; C5. |
| 029 | Retain explicit roster reconciliation and partial subtotal labels, `teamForecasts.ts:175-224`, `teamGameExpectations.ts:54-92`. No non-test production caller found for these functions. |
| 030 | Retain deliberate rounded-card sum, shared-vintage check and partial status, `TeamDetails.tsx:119-153`. Rounding discrepancy bounded by 0.05 per included game before floating-point tolerance. |
| 031 | Retain differing key applicability and fallback behavior, `planning.ts:91-104`; use fixed registry/provider role rather than infer from whichever forecasts happen to exist. |
| 032 | Retain copied default arithmetic on known values, `pages/trendsSandbox.tsx:200-207,2006-2012`. The sandbox explicitly zero-fills null raw fields, so not an unknown-preserving generic scorer. |
| 033 | Retain equality of goalie default constants, `pages/trueGoalieValue.tsx:104-109`. This does not audit that page's whole valuation model. |
| 034 | Retain explicit missing/future/stale date rejection, `lib/NHL/edgeFeatureContract.ts:245-268`. No non-test caller established. |
| 035 | Retain NHL-ID type extraction and downstream regular recount, `lib/NHL/server/index.ts:530-539`, `GameGrid.tsx:277-279`; state-preserving source also matters to R3. |
| 036 | Retain documented threshold arithmetic, `lib/NHL/statsPageFetch.ts:239-250`: floor(avg×0.25) only for avg>10. No claim this is an NHL/provider qualification rule. |
| 037 | Retain dead-path denominator/manpower concern, `lib/NHL/TOI.ts:31-75,93-110`. No API called to reverify endpoint retirement. Cleanup remains dependency-gated. |
| 038 | Retain ownership null/freshness semantics, `PlayerPickupTable.tsx:171-228`. Unknown/future dates do not become current ownership. |
| 039 | Retain team-of-record violation and clamp, `PlayerPickupTable.tsx:2464-2494`; apply owner decision 16 without guessing trade dates. |
| 040 | Retain dynamic-pool/season-volume concerns; correct missing-percentile averaging statement, C7. `PlayerPickupTable.tsx:2543-2640`. Those choices need labels/intent before a total redesign. |
| 041 | Retain metric-blend semantics and display/sort difference, `PlayerPickupTable.tsx:2656-2752`. An equal blend is not inherently a false league-points calculation unless represented as one. |
| 042 | Confirm sentinel normalization and no-metric negative sort sentinel, C1. `PlayerPickupTable.tsx:2755-2799`. |
| 043 | Revise Sound for historical team/completeness false zeros; R2. `rosterPlanning.ts:104-135`. Yahoo minimum-appearance rule itself not independently fetched. |
| 044 | Revise Sound for false-zero/trade attribution, not weighted-sum algebra; R2. `rosterPlanning.ts:43-96`. |
| 045 | Keep external-default identity undecided; local default agreement and manual merge established. `fantasyPointsConfig.ts:8-30`, `user-settings/mappers.ts:16-35,118-138`; C7. |
| 046 | Retain signed-direction transport mismatch with corrected actual readers, C4. `espn/normalize.ts:270-278`; encoding itself works in the shared scorer. |
| 047 | Retain no explicit per-category direction in inspected Fantrax mapping, `fantrax/normalize.ts:619-641`. No provider payload or documented reverse flag verified. |
| 048 | Retain Yahoo direction omission, `yahoo/liveDraft.ts:449-498`; actual custom-league prevalence unknown. |
| 049 | Strengthen with postseason and cancelled/postponed state mismatch; R3. `DateRangeTeamGrid.tsx:50-61,123-139`. |
| 050 | Retain regular daily-row totals/count semantics, `TotalGamesPerDayRow.tsx:90-125`; count of league days is distinct from a team's off-night appearances. |
| 051 | Retain explicit category-effect signs/conflict withholding, `opponentCategoryEffects.ts:30-70`. Defensible descriptive signs are not empirically estimated causal coefficients. |
| 052 | Retain dormant no-odds/no-coveredDays calculation, `useFourWeekSchedule.ts:109-111,146-149`; do not make it a second active Week Score defect. |
| 053 | Retain per-opponent complete-observation means and PTS% units, `useOpponentMetricsData.ts:77-141`; schedule-frequency-weighted descriptive observations, not a strength-adjusted forecast. |

## 4. Verification and remaining decisions

**Executed:** isolated actual TypeScript modules/source-function extractions with only synthetic inputs; fixture NHL schedule is the already committed `e2e/fixtures/game-grid-previews/real-week-32.ts`. No remote read. The reproduction appendix retains the inputs and assertions inside this sole allowed report artifact.

**Passed:** five existing test files, **42 tests**:

```text
cd web
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key npm test -- --run lib/scoring/categoryScores.test.ts lib/player-forecasts/planComparison.test.ts lib/draft-pro/recommendations.test.ts components/GameGrid/utils/calcWeekScore.test.js components/GameGrid/utils/calcWinOdds.test.js
```

These establish the current implementation/test contract; some deliberately pin the disputed shrinkage. No full suite, build, lint, typecheck, browser/private-provider acceptance or production validation was run for this review-only deliverable.

**Reported only:** Fable's DB samples and rank moves, original matching trials, actual provider settings/defaults, deployment flags and current user impact. No attempt was made to reconstruct the unpublished production samples or use live services to size them. New fixtures demonstrate mechanisms under specified inputs, not prevalence.

**Owner/product decisions still needed:** intended off-night utility/horizon and idle-player policy; default score label; roster-pool/rate-impact contract and provider direction; whether category-mode optimization should change its documented objective. No need to ask whether unknown results should silently become zero: the adopted Batch A rule already says they must remain unknown. No legacy deletion, refit or deployment is implied by this review.

**Checkpoint record:** source/task/owner review completed; priority fixtures reproduced; downstream direction claims corrected; five targeted suites passed. Final report and embedded runner checked, with only this assigned file saved. No unresolved execution blocker.

## Appendix: retained offline fixture runner

Run this JavaScript from the repository root with the installed Node and `web/node_modules/typescript`. It transpiles the actual named source modules in memory, denies outside-root imports, supplies no database client, and uses only an in-memory query stub for the two extracted Yahoo functions. It writes no file. The booster expression is a literal reconstruction of the inspected React `useMemo` expression, not a browser rendering. The committed schedule fixture is a retained historical schedule with synthetic identities/states, not a fresh NHL response. This runner is embedded here to honor the one-file write boundary.

```javascript
const fs = require('fs'), path = require('path'), assert = require('assert');
const ts = require('./web/node_modules/typescript');
const root = path.resolve('web'), cache = new Map();
global.fetch = () => { throw Error('Network disabled in audit fixture'); };
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
function load(file) {
  file = path.resolve(root, file);
  if (!file.startsWith(root + '/')) throw Error('Outside fixture source root');
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} }; cache.set(file, m);
  const localRequire = id => load(id.startsWith('.')
    ? path.resolve(path.dirname(file), id) : path.resolve(root, id));
  new Function('require', 'module', 'exports', compile(fs.readFileSync(file, 'utf8')))
    (localRequire, m, m.exports);
  return m.exports;
}
function extract(file, names, bindings = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const parts = ast.statements.filter(s => s.name && names.includes(s.name.text));
  assert.equal(parts.length, names.length);
  const m = { exports: {} };
  new Function('module', 'exports', ...Object.keys(bindings),
    compile(parts.map(s => s.getText(ast)).join('\n')))
    (m, m.exports, ...Object.values(bindings));
  return m.exports;
}
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9,
  `${actual} != ${expected}`);
const result = {};
const week = load('components/GameGrid/utils/calcWeekScore.ts');
const real = load('e2e/fixtures/game-grid-previews/real-week-32.ts').REAL_WEEK_32;
const cells = Object.values(real).map(v => v.split(','));
const counts = Array.from({ length: 7 }, (_, d) => cells.filter(r => r[d]).length / 2);
assert.deepEqual(counts, [5, 9, 2, 14, 1, 14, 7]);
const boost = scores => {
  const lo = Math.min(...scores), hi = Math.max(...scores);
  return scores.map(s => 1 + ((hi === lo ? 0.5 : (s - lo) / (hi - lo)) * 2 - 1) * 0.25);
};
result.weekend = [0, 5, 6].map(start => {
  const games = counts.slice(start).reduce((a, b) => a + b, 0);
  const rows = cells.map(row => {
    const slate = row.flatMap((v, d) => v && d >= start ? [counts[d]] : []);
    return { gp: slate.length, score: week.default([], slate.filter(n => n <= 8).length,
      games, slate.length, slate) };
  });
  const mult = boost(rows.map(r => r.score));
  const active = mult.filter((_, i) => rows[i].gp > 0);
  return { start, idle: rows.filter(r => !r.gp).length,
    min: Math.min(...active), max: Math.max(...active) };
});
near(result.weekend[0].min, 0.75);
near(result.weekend[1].min, 1.2031888640394848);
near(result.weekend[2].min, 1.25);
assert.deepEqual(result.weekend.map(r => r.idle), [0, 1, 18]);
near(week.default([], 3, 0, 3), 30); near(week.default([], 1, 0, 4), 28);
const cat = load('lib/scoring/categoryScores.ts').calculateCategoryScores;
const goalies = [
  { id: 'a', role: 'goalie', values: { SAVE_PERCENTAGE: 0.9,
    SHOTS_AGAINST_GOALIE: 1200, GOALS_AGAINST_AVERAGE: 2, GAMES_STARTED: 25 } },
  { id: 'b', role: 'goalie', values: { SAVE_PERCENTAGE: 0.92,
    SHOTS_AGAINST_GOALIE: 1200, GOALS_AGAINST_AVERAGE: 4, GAMES_STARTED: 25 } }
];
result.rates = Object.fromEntries(cat(goalies, { SAVE_PERCENTAGE: 1 }));
near(result.rates.a, -0.5 / Math.sqrt(2));
near(cat(goalies, { GOALS_AGAINST_AVERAGE: 1 }).get('a'), 0.5 / Math.sqrt(2));
result.tiny = Object.fromEntries(cat([...goalies, { id: 'tiny', role: 'goalie',
  values: { SAVE_PERCENTAGE: 0.5, SHOTS_AGAINST_GOALIE: 1 } }], { SAVE_PERCENTAGE: 1 }));
near(result.tiny.a, 0.26731413874459214); near(result.tiny.b, 0.3095216343358436);
result.missing = Object.fromEntries(cat([
  { id: 'low', role: 'skater', values: { GOALS: 1 } },
  { id: 'high', role: 'skater', values: { GOALS: 3 } },
  { id: 'missing', role: 'skater', values: {} }
], { GOALS: 1 }));
assert(result.missing.missing > result.missing.low);
const noExposure = cat(goalies.map(g => ({ ...g,
  values: { SAVE_PERCENTAGE: g.values.SAVE_PERCENTAGE } })), { SAVE_PERCENTAGE: 1 });
assert.deepEqual([...noExposure.values()], [0, 0]);
const recommendations = load('lib/draft-pro/recommendations.ts').buildPersonalizedRecommendations;
const candidates = [1, 3].map((n, i) => ({ id: String(i), name: String(i), role: 'skater',
  eligiblePositions: [], globalVorp: 0, rankValue: 0, categoryValues: { FACEOFFS_LOST: n } }));
result.negativeDirection = recommendations(candidates, { leagueType: 'categories',
  categoryWeights: { FACEOFFS_LOST: -1 }, categoryNeeds: { FACEOFFS_LOST: 1 } })
  .map(r => ({ id: r.candidate.id, score: r.recommendationScore }));
assert.equal(result.negativeDirection[0].id, '0');
near(result.negativeDirection[0].score, 0.5 / Math.sqrt(2));
const ranks = load('lib/draftDashboard/categoryStandings.ts').rankTeamCategories;
result.reversedGaa = Object.fromEntries(cat(goalies, { GOALS_AGAINST_AVERAGE: -1 }));
result.reversedGaaRanks = ranks(goalies.map(g => ({ teamId: g.id,
  categoryTotals: { GOALS_AGAINST_AVERAGE: g.values.GOALS_AGAINST_AVERAGE } })),
  { GOALS_AGAINST_AVERAGE: -1 }, 'categories');
assert(result.reversedGaa.b > result.reversedGaa.a);
assert.equal(result.reversedGaaRanks.a.GOALS_AGAINST_AVERAGE, 1);
const comparison = load('lib/player-forecasts/planComparison.ts').comparePlanSensitivity;
const forecast = (playerId, value) => ({ playerId, gameId: 'g', stats: { GOALS: value },
  conditioning: 'unconditional', allowedUses: { assignment: true, totals: true, comparison: true,
    conditionalTieBreak: false }, startProbability: null, confirmedStart: false,
  revisionId: 'r-' + playerId, issuedAt: '2026-10-01T00:00:00Z', modelVersion: null, limitations: [] });
const plan = row => ({ legal: true, projectedValue: row.stats.GOALS, projectedStats: row.stats,
  recommendation: { eligible: true }, comparisonEligible: true, forecastManifestId: 'snap',
  forecastInputs: [row], assignments: [{ playerId: row.playerId, gameId: 'g' }] });
const sensitivity = comparison({ id: 'snap', rules: { scoring: {
  mode: 'points', weights: { GOALS: 1 }, categories: [] } } },
  plan(forecast('a', 10)), plan(forecast('b', 11)));
result.sensitivity = sensitivity.scenarios.map(r => r.difference);
assert.equal(sensitivity.direction, 'candidate');
[0.8, 1, 1.2].forEach((value, i) => near(result.sensitivity[i], value));
const odds = load('components/GameGrid/utils/calcWinOdds.ts').convertTeamRowToWinOddsList;
const game = (id, p) => ({ id, gameType: 2, gameState: 'FUT', gameScheduleState: 'OK',
  homeTeam: { id: 1, winOdds: p }, awayTeam: { id: 2, winOdds: 45 } });
result.noPreviousOdds = odds({ teamId: 1, weekNumber: 1,
  MON: game(1, null), TUE: game(2, 55) }, [], ['MON', 'TUE']);
result.previousOdds = odds({ teamId: 1, weekNumber: 1,
  MON: game(1, 55), TUE: game(2, 55) }, [], ['MON', 'TUE']);
assert.deepEqual(result.noPreviousOdds, [null, 55]);
assert.deepEqual(result.previousOdds, [55, 41.25]);
const helper = load('components/GameGrid/utils/helper.ts');
near(helper.calcWeightedOffNights({ MON: game(1, 50) }, [1], [], ['MON']), 0.39285714285714285);
near(helper.calcWeightedOffNights({ MON: game(1, 50) }, [8], [], ['MON']), 0.2857142857142857);
const summaries = load('components/GameGrid/utils/scheduleSummary.ts');
near(summaries.getFourWeekScore({ totals: { gamesPlayed: 4, offNights: 2 }, avgOpponentPointPct: 0.4 },
  { gamesPlayed: 4, offNights: 2, avgOpponentPointPct: 0.6 }), 0.2);
// Extract the non-exported React-file helper without importing the component or its clients.
const dateFile = 'web/components/GameGrid/DateRangeTeamGrid.tsx';
const dateSource = fs.readFileSync(dateFile, 'utf8');
const dateAst = ts.createSourceFile(dateFile, dateSource, ts.ScriptTarget.Latest, true);
const b2bSource = dateAst.statements.find(s => s.name?.text === 'computeBackToBacks').getText(dateAst);
const b2b = new Function(compile(b2bSource) + '\nreturn computeBackToBacks;')();
result.postponedB2b = b2b(['2026-11-01', '2026-11-02'], {
  '2026-11-01': { ...game(1, 50), gameScheduleState: 'PPD' }, '2026-11-02': game(2, 50) });
assert.equal(result.postponedB2b, 1);
const recent = load('lib/rosterScheduleOptimizer/recentForm.ts');
const yahoo = extract('web/lib/integrations/yahoo/rosterPlanning.ts',
  ['yahooPastLineupPoints', 'yahooCreditedGoalieAppearances'], {
    SKATER_POINT_COLUMNS: recent.SKATER_RECENT_COLUMNS, GOALIE_POINT_COLUMNS: recent.GOALIE_RECENT_COLUMNS,
    isGoalieStat: key => key.endsWith('_GOALIE') ||
      ['GAMES_STARTED', 'GOALS_AGAINST_AVERAGE', 'SAVE_PERCENTAGE'].includes(key)
  });
function fakeDb(rows) {
  return { from() {
    let selected = rows;
    return { select() { return this; }, order() { return this; },
      in(key, ids) { selected = selected.filter(r => ids.includes(r[key])); return this; },
      range(a, b) { return Promise.resolve({ data: selected.slice(a, b + 1), error: null }); },
      then(fn) { return Promise.resolve({ data: selected, error: null }).then(fn); } };
  } };
}
(async () => {
  const player = { id: 'p', nhlId: 1, playerClass: 'skater', teamAbbreviation: 'NEW' };
  const args = { pastLineups: [{ date: '2026-11-01', entries: [{ playerId: 'p', slotId: 'C1' }] }],
    players: [player], games: [{ id: '1', date: '2026-11-01', teamAbbreviation: 'NEW', status: 'final' }],
    scoring: { mode: 'points', weights: { GOALS: 3 } } };
  const points = async (rows, input) => (await yahoo.yahooPastLineupPoints(fakeDb(rows), input))[0].entries[0].points;
  result.partialPoints = await points([{ game_id: 1, player_id: 99, goals: 1 }], args);
  result.tradePoints = await points([{ game_id: 1, player_id: 1, goals: 2 },
    { game_id: 2, player_id: 99, goals: 1 }], { ...args, games: [
    { id: '1', date: '2026-11-01', teamAbbreviation: 'OLD', status: 'final' },
    { id: '2', date: '2026-11-01', teamAbbreviation: 'NEW', status: 'final' }] });
  const goalieArgs = { periodStart: '2026-11-01', today: '2026-11-02',
    pastLineups: [{ date: '2026-11-01', entries: [{ playerId: 'p', slotId: 'G1' }] }],
    slots: [{ id: 'G1', type: 'G' }], players: [{ ...player, playerClass: 'goalie' }], games: args.games };
  result.partialCredits = await yahoo.yahooCreditedGoalieAppearances(fakeDb([
    { game_id: 1, goalie_id: 99, games_played: 1 }]), goalieArgs);
  result.tradeCredits = await yahoo.yahooCreditedGoalieAppearances(fakeDb([
    { game_id: 1, goalie_id: 1, games_played: 1 }]), { ...goalieArgs, games: [
    { id: '1', date: '2026-11-01', teamAbbreviation: 'OLD', status: 'final' }] });
  for (const key of ['partialPoints', 'tradePoints', 'partialCredits', 'tradeCredits']) assert.equal(result[key], 0);
  console.log(JSON.stringify({ status: 'all assertions passed', ...result }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
```

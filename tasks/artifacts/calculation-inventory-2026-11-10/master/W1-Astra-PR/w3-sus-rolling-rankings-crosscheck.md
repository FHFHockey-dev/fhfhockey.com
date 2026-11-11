# Independent peer review: W3 sustainability, rolling and rankings cross-check

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Target: Fable's `audits/sus-rolling-rankings-part2-crosscheck.md`, commit `2fd0e10528ead57db70112241f8100d276d7cd7c`. Additive review, not an implementation or replacement of that audit. HEAD advanced during concurrent documentation work to `2372f694ec7ba2ff5001ca835d27c496f8801620`; the inspected source paths have no diff from the target commit. Other agents' work is preserved.

## Verdict

**Accept the underlying unit, exposure, baseline and labelling findings; revise the fix instructions and some reach/magnitude claims before implementation.** No new production P0 is established by this offline review. Fable's 27 covered / 8 extended entries remain its inventory classification, not 35 independent certifications from this review.

Most consequential corrections:

1. **An existing per-game 5v5 TOI source was missed.** `player_stats_unified.toi_per_game_5v5` is present in the committed view/types and feeds the season denominator. The band service omits it. A new column, provider source or migration is not established as necessary. Relabelling the current numerator/time pair “even strength” would still be misleading.
2. **Twice the baseline does not have to be statistically hot.** Strong PP shrinkage is confirmed, but N3's proposed mandatory-hot acceptance test repeats the statistical mistake already rejected by the W1 peer review. Prior influence and detection of an unusual observed window are different questions.
3. **The IPP failure goes beyond a negative prior parameter.** The band helper silently floors the invalid posterior beta to `1e-6`, while retaining a point value above 1. An actual fixture is displayed as hot. Conversely, a fallback can be active with a perfectly ordinary baseline below 1, so “zero baselines above 1” does not prove the fallback was absent.
4. **Limit the last-N fallback repair to rate aliases.** The same extraction branch also handles real points and PP-points counts correctly. Deleting the entire count/time fallback would break those metrics. Current-writer pairing is not proof about every historical stored row.
5. **Correct the FORGE reader map.** Its selected band metrics include fantasy score and 5v5 points, but exclude PP goals/points, hits and blocks. The cross-check's hits/blocks FORGE claim is incorrect for direct band consumption.

## Evidence and limits

Read the named Wave 3 packet/prompt/report, rules digest and relevant owner decisions, scoped Batch A/B-C consolidation sections, and the rolling, sustainability and rankings peer-review qualifications. Traced the consequential producer and reader functions rather than repeating the full 35-entry audit.

- **Executed:** offline actual-TypeScript fixtures in [`w3-sus-rolling-rankings-fixtures.cjs`](w3-sus-rolling-rankings-fixtures.cjs), with input/output receipt and source SHA-256 hashes in [`w3-sus-rolling-rankings-fixtures.json`](w3-sus-rolling-rankings-fixtures.json). Only explicitly allowlisted local modules can load; no DB client, application route or provider is invoked. The literal Sandbox status expression is extracted from the component AST and executed on fixture output.
- **Executed:** five existing isolated Vitest files, **66 tests passed**. Log: [`w3-sus-rolling-rankings-tests.log`](w3-sus-rolling-rankings-tests.log). They assert current behavior, not that the defects are fixed.
- **Not executed:** production DB reads/writes, provider requests, application HTTP requests, browser QA, writer/rebuild routes, migrations, deployment, source edits, commit or push. No broad build, lint or typecheck was warranted for this additive document/fixture review.
- **Reported only:** Fable's 2026-11-11 snapshot populations, their means/zero-baseline counts, player 8478402's four-season measurements and missing rolling dates. Those production observations were not independently refreshed, and reproducible raw query/result receipts are not attached to the audited report.
- “Wired” below means source-traced reach, not verified deployed state, traffic or fresh rows. The committed view is evidence of an available schema contract, not a fresh production catalog read.

## 1. N2: confirm exposure mismatch; use the existing 5v5 source first

`web/lib/sustainability/bandCalculator.ts:228-236` uses `points_5v5 / ev_time_on_ice`. Its baseline at `:402-408` uses `points_5v5 / (toi_5v5_total ?? ev_time_on_ice)`. These are incompatible when ES includes non-5v5 minutes.

**Actual-function fixture:** five identical games each have one 5v5 point, 1,000 seconds of 5v5 TOI and 1,200 ES seconds. Season history contains 50 points, 50,000 5v5 seconds and 60,000 ES seconds. Despite the per-game `toi_per_game_5v5` field being present in each fixture row, the calculator returns:

- baseline: **3.6** points/60;
- EWMA: **3.0**, a **16.67% downward exposure bias**;
- blended value: **3.47948057**; current UI status and FORGE adjustment remain neutral.

This is a deliberately oriented synthetic example, not the observed population magnitude.

### Correct the proposed source/migration requirement

The source already exists in the repository:

- `web/lib/supabase/Upserts/fetchWGOskaterStats.js:531` maps provider `timeOnIcePerGame5v5` into `toi_per_game_5v5`.
- `supabase/migrations/20260716112908_production_schema_baseline.sql:22793,22869` defines/selects it in `player_stats_unified`.
- The totals view reads `psu.toi_per_game_5v5` at `:23125` and sums it into `toi_5v5_total` at `:23327`.
- `web/lib/supabase/database-generated.types.ts:44411,44633` includes the field in that view's row contract.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1802-1803,2966` already selects/uses it for the 5v5 fallback.
- The band service's select list, `web/lib/sustainability/bandService.ts:103-133`, **does not select it**.

**Remedy:** qualify the existing field's unit, game identity and coverage, select it in `fetchPlayerGameRows`, and pair it with the same game's 5v5 points. Use matched pre-window observations for the baseline. Missing/zero exposure must not trigger substitution of ES time or zero-filled counts. Do not automatically declare a migration necessary; production schema/coverage verification, if needed later, is a separately authorized check.

N2's alternative “use ES time on both sides and label even strength” is not a complete ES scoring-rate repair: the numerator remains **5v5 points**, excluding points in other ES configurations. Either retain the intended 5v5 measure with 5v5 exposure, or explicitly adopt a different, accurately named estimand with matched ES counts. The owner need not choose between two options premised on a nonexistent source gap.

**Magnitude qualification:** four historical TOI ratios establish a structural direction on those samples. They do not establish that the entire earlier population mean gap of 12% was caused by this error, nor that every player must become cold. Different recent scoring, baseline contamination, zero production and ES=5v5 cases remain possible. N2 strengthens D14's diagnosis without measuring a population-wide causal decomposition.

**Acceptance:** same frozen game set and constant per-5v5-minute rate must yield the same observed rate and baseline; extra non-5v5 ES minutes must not change a 5v5 rate. Cover missing points/time independently, legitimate zero points, partial coverage and season boundaries. Do not let an out-of-window replacement hide missing coverage.

## 2. N3: PP shrinkage is real; its acceptance test is not valid

The PP prior is coherently expressed in **player PP minutes**, not accidentally in total minutes or team PP time (`bands.ts:209-226`; `bandCalculator.ts:238-257,530-561`). With discounted exposure E, the point value is `baseline + E/(E+180) × (EWMA−baseline)`. The reported 2–4% weights are plausible for the reported 4.35/6.45-minute samples, but not independently measured here.

**Actual-function fixture:** five games, one PP point and four PP minutes each, prior 7.5 PP points/60. Observed EWMA is **15**, discounted exposure **16.08666620 minutes**, data weight **8.203855%**, and blended point value **8.11528914**. The actual Sandbox expression returns neutral because the interval is approximately **[6.17284234,10.18919828]**. This confirms the strong blending and own-value-versus-own-interval semantics, not that neutral is statistically wrong for these counts.

**Counterexample to “twice baseline must not be neutral”:** a fully specified Poisson baseline of 7.5 points/60 over those 20 raw PP minutes has mean **2.5 points**. Five observed points doubles the rate, yet its exact central 80% predictive interval is **[1,5]**, and `P(X>=5)=0.10882198`. Five is not outside that range. Baseline uncertainty would not justify a universal forced-hot rule either. This is a mathematical counterexample, not endorsement of Poisson as the fitted PP model or of ignoring decay in the eventual chosen model.

The W1 review already rejected the same kind of twice-baseline test (`sustainability-part1.md`, D2 discussion). Preserve that correction. Decision 33 calls for a sample-adjusted expectation range, not guaranteed detection at an arbitrary relative increase. A large prior weight is not itself evidence that the prior is scientifically too strong; its fitted suitability needs held-out evidence. The present **misuse and labelling of the blended value as the observed comparison** remains a concrete defect.

**Better acceptance:** verify observed counts/exposure and rate exactly, separately from the shrunk estimate. For classification, specify a fitted/frozen baseline distribution, uncertainty, exposure, tail/interval convention and boundary rule; assert the resulting mathematically derived decision. Test both an unsurprising doubled low-count case and a genuinely extreme fixed example. Validate range coverage and proper scores on later data. Do not tune k merely to force a fixture hot.

### Window bounds and continuity need one qualification

For four PP minutes per game, actual data weights are **5.63%, 8.20%, 12.24%, 15.50%** for L3/L5/L10/L20. Although the PP specs list only L3/L5/L10, `bandService.ts:24` defaults to all four windows, and `computeTrendBandsForPlayer` validates only `WINDOW_SIZES`, not `spec.defaultWindows` (`bandCalculator.ts:675-676,708-724`). An L20 PP band is emitted. Thus “no window can pass about 12%” is only a rough L10 statement under the assumed four-minute usage, not a global ceiling. Longer PP games can also exceed that assumed exposure.

Astra A1's backward expansion is independently reproduced for PP: five newest games with zero PP time yield no L5 PP band; append five older one-point/four-minute games and L5 returns EWMA **15**. The older games retain their original `gamesAgo` decay, so this is not identical to simply renumbering the last five PP appearances from zero. Fix membership first, retain true zero opportunity without inventing a rate at zero total exposure, and distinguish appearance count from discounted minutes.

Decision 61's current-season and optional labelled cross-season views, decision 34's pre-window baseline, and the existing suffix-invariance requirement still apply. A deliberately different “last five PP opportunities” feature would need its own name/window/decay contract; it is not the silent repair for an L5-games view.

## 3. N4: unsafe IPP fallback confirmed; presence and downstream behavior need correction

`bandCalculator.ts:442-449` pairs all-situation points with `nst_oi_gf ?? es_goals_for`. `clamp` only checks finiteness (`:518-522`). N4 correctly identifies the cross-strength/domain problem.

**Actual-function fixture:** season `{points:48,nst_oi_gf:null,es_goals_for:35}` and five valid recent games of one point/two all-situations on-ice goals produce baseline **1.37142857** and prior beta **−18.07142857**. Unlike the separate `priors.ts` implementation discussed in W1, **`bands.ts:309-317` floors the posterior alpha/beta**. Here it stores beta **0.000001**, but the independently blended point value stays **1.24324329**. The computed interval collapses numerically near 1, warnings remain empty, and the literal Sandbox expression labels the impossible value **hot**.

Do not describe this as a negative posterior surviving unchanged. The precise failure is an invalid baseline plus silent shape flooring and an unreconciled out-of-domain point value. It is a reachable conditional defect; incidence is unmeasured.

**Withdraw the inference “0 of 268 above 1, so fallback is not firing.”** A second fixture with points 5, NST GF null and ES GF 10 activates the fallback and returns baseline **0.5**. Even an invalid season's contribution could be diluted by other seasons. No out-of-domain final baselines only rules out those final values, not fallback use or strength bias.

**Removing `es_goals_for` alone is insufficient.** `computeBaselinePercentage` independently sums successes and trials (`bandCalculator.ts:147-164`). A null-GF season with four points plus a valid season with two points/four GF gives baseline **2.5** under the current weights when both GF alternatives are null. The missing denominator must exclude the matching numerator too; simply replacing the fallback with zero preserves contamination.

**Remedy/test:** admit matched all-situations points/GF observations, validate `0 <= successes <= trials`, and preserve missingness and source coverage. If only incomplete season totals exist, do not pretend the pair is qualified. Use the remaining eligible history or the qualified position prior under decision 34. Test invalid fallback, in-domain fallback, null both denominators, partial season source coverage, mixed seasons, zero trials and an unambiguous legitimate zero. Validate the saved/read band as well as intermediate parameters. Do not clip a bad ratio to one or silently use shape floors as data validation.

## 4. N1: retain the rate/count finding, but constrain the repair

Confirmed from the writer: `fetchRollingPlayerAverages.ts:2878-2885` emits the same pooled rate into `_total_lastN`, `_avg_lastN` and the canonical `_lastN` via `applyCanonicalScopedSnapshotOutputs` (`:2001-2021`). The reader at `skaterWindowAggregation.ts:495-503` treats the `_total_` alias as a count if the direct value is absent.

**Actual-function fixtures:** with `sog_per_60_total_last5=8.4` and `toi_seconds_total_last5=6852`:

- direct `_last5=null`: aggregate raw value **4.413310**, from dividing an already-per-60 rate again;
- direct `_last5=8.4`: raw value **8.4**, but exported numerator **8.4** and denominator **6852** remain dimensionally incompatible;
- pass those components without raw value to `calculateMetricRawValue`: **4.413310** again.

This independently verifies the mechanism, not Fable's particular stored 8.406-rate row. Both ranking/deployment candidate builders pass the fields (`rankingQueries.ts:548-555`; `deploymentTiers.ts:706-715`). A populated raw value currently takes precedence (`rankingCalculator.ts:150-151`), so do not claim these fixtures prove live ranking corruption in ordinary current paired rows.

**Narrow “stored rows cannot reach it.”** The current writer emits both aliases together and keeps the selected fields. That supports a current-writer invariant, not a census of legacy imports, partially migrated rows, old schemas or future reader selections. No such anomalous production row was observed here. Label the fallback conditional/latent under the current writer rather than universally unreachable in storage.

**Do not delete the shared fallback indiscriminately.** `points_per_60` and `pp_points_per_60` use actual count bases (`skaterWindowAggregation.ts:89-104`). Executed fixtures return **1.576182 points/60** from 3 points/6,852 seconds, and **30 PP points/60** from 1 point/120 player-PP seconds. They require count/time evaluation and are not the rate-alias bug. The PP denominator must remain player PP time, consistent with Astra's withdrawal of the upstream M-RNK-057 inheritance.

**Remedy/test:** distinguish genuine count-based specs from rate-alias specs. For the latter, never expose a per-60 number as a count; return no reconstructible numerator until matched components exist. A fail-closed null is a defensible interim policy for a missing canonical rate; an explicitly versioned rate-alias fallback could also preserve a known equivalent rate, but must never divide it by time. The arithmetic defect does not mandate discarding a verified equivalent representation.

The complete lane still owns writer support fields, `rollingRankingSelectFields.ts`, `skaterWindowAggregation.ts`, ranking/deployment and snapshot readers, `resultsLuckSources.ts`/`resultsLuckIndex.ts` and composite consumers. Preserve prior-review requirements for matched game/strength/coverage sets and actual cross-season window membership. Do not reconstruct counts from a generic TOI that may cover different observations. Test true count paths alongside missing canonical rate, direct rate zero, unequal metric coverage and partial cross-season history.

## 5. Reader reach and forecast corrections

### Direct band consumers

- Sandbox: `entitySurfaceServer.ts:1080-1165` fetches current skater bands, and `normalizeLegacyBandRow` at `:719-770` carries the stored point, EWMA, baseline and interval through. `trendsSandbox.tsx:592-597,2317-2322,2960-2965` performs the own-point-versus-own-interval comparisons. The fixtures execute the actual first status expression, not a browser page.
- `trend-bands.ts` GET reads saved rows; POST **and GET with recompute** enter the authorized writer. Do not use that route casually as read-only verification (`web/pages/api/v1/sustainability/trend-bands.ts:31-41,135-145`). No route was called here.
- FORGE's actual query filters `TREND_BAND_METRIC_PRIORITY`, which is **fantasy_score, ixg_per_60, shots_per_60, points_per_60_5v5** (`projection-weights.ts:163-168`; `skater-queries.ts:643-653`). Thus M-SUS-073/074 hits/blocks bands are **not direct FORGE band inputs**; M-SUS-075 fantasy score **is**. PP-rate bands are not selected. Hits/blocks can still affect the fantasy-score calculation through their counts, a different path from the corrupt hits/blocks band.
- The selected 5v5 fixture produces `within_band_neutral` via actual `computeSkaterTrendAdjustment`. Prior neutral examples do not prove no possible downstream effect for every boundary or invalid row. A band redesign can change eligible FORGE adjustments and needs coordinated validation under decision 26, including metric-selection priority, recency and old/new row versions.

### N5: numerical coverage confirmed; specify the interval convention

Actual `emitForecastBands` output plus independent exact Poisson summation reproduces 50% interval coverage **90.48%, 74.08%, 34.76%, 58.57%, 61.61%, 45.89%** at means **0.1, 0.3, 0.7, 1.5, 3, 6**. The report's detailed figures are right; its headline “35–74%” omits the 90% example. The emitted `median` is the mean: for mean 0.1 the exact discrete median is 0. `evaluateBandCalibration` also returns zero hit rates at zero samples, confirmed directly.

Retain the exact-quantile, honest-coverage and no-sample-as-unknown direction. But “smallest integer range with at least nominal coverage” is an additional interval convention, not equivalent to central quantiles. At Poisson mean 0.7, exact central 80% quantiles are **[0,2]**, whereas **[0,1]** already contains **84.42%** and is shorter. Pick and document a convention before asserting one implementation must satisfy both. Exact discrete intervals can exceed nominal coverage because of probability atoms; report achieved coverage rather than treating all overcoverage as approximation error. For count PIT diagnostics, use the appropriate discrete/randomized convention.

This path is deferred/unserved by owner decision 37. I verified the local feature function and `model.ts` call site, not a fresh deployment-wide activation census. The negative-binomial branch is still not evaluated here. No activation, scheduling or removal is authorized.

### N6 and the collector-less specs

The default-scoring label correction stands. `bands.ts:247-255` supplies “Fantasy Score”; `getDefaultFantasyPointsConfig("skater")` supplies FHFH's own weights. Use “FHFH default” consistently through spec-derived labels and hard-coded Sandbox comparison text (`trendsSandbox.tsx:2349,2848`), without changing the formula merely to rename it. Include the FORGE metadata reader in dependency review, as above.

Actual fixture calls for `hdcf_pct`, `sh_pct_5v5` and `pp_sh_pct` emit no rows because their collectors are missing. That verifies the producer gap, not the absence of every possible stored/historical row or external writer. Keep their dormant/collector-less status qualified; dependency inventory precedes any deletion.

## Implementation handoff

1. **Sustainability bands:** retain decisions 32–34/61/68 and the established W1 defects. Establish fixed window membership, matched exposure and pre-window baselines. Use the existing 5v5 field after qualification. Separate observed output, baseline expectation and shrunk estimates; reject impossible IPP inputs. Version saved distributions and consumer selection. No arbitrary mandatory-hot test or prior strength chosen to satisfy it.
2. **Rankings/rolling units:** repair only rate-alias component handling while preserving real points/PP-points count paths. Carry explicit count/exposure/membership support through every reader. Preserve decisions 17/23/75 and earlier matched-coverage qualifications; no team-PP denominator substitution.
3. **Reader coordination:** Sandbox/API and the actual four-metric FORGE allowlist must receive consistent changed semantics. Hits/blocks band repairs must not be reported as demonstrated direct FORGE band fixes. Verify final served payloads and selection with fixture-backed reader tests before any deployment claim.
4. **Deferred projections/labels:** exact discrete intervals, uncertainty/coverage and no-sample handling remain in the unserved decision-37 lane. Apply N6's FHFH-default label without changing scoring coefficients.
5. **Data repair remains separate:** no rebuild, migration, provider retry or activation was performed. Decision 36's bounded history rebuild and the held rolling-run reconciliation need their own approval and verified manifests. Source-only fixes do not prove historical rows repaired.

No additional owner decision is needed merely to accept these review corrections. A genuinely new estimand, window convention or predictive activation should be brought back explicitly, rather than smuggled in through an invalid acceptance test or a source gap already addressed by the schema.

## Verification receipt

From repository root:

`node tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-sus-rolling-rankings-fixtures.cjs`

From `web/`, using explicitly synthetic Supabase environment values:

`./node_modules/.bin/vitest --run lib/sustainability/bandCalculator.test.ts lib/sustainability/features.test.ts lib/rankings/skaterWindowAggregation.test.ts lib/rankings/rankingCalculator.test.ts lib/projections/utils/trend-adjustments.test.ts`

Result: **5 files, 66 tests passed**. The post-test shell wrapper failed when assigning zsh's reserved variable `status`; the completed Vitest log was inspected and the successful tests were not rerun. This shell bookkeeping error did not alter the test result. The final offline fixture run succeeded after adding count-path regression checks, actual UI-expression evaluation and FORGE selection checks.

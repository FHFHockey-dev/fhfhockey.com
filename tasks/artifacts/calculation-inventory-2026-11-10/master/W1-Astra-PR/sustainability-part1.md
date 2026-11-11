# Independent peer review: W1-9 sustainability, part 1

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `5ae1037cc4155acf586564187cddc4390bf99f90`. Additive review of Fable's `audits/sustainability-part1.md`, not an implementation or replacement. The inspected sustainability, baselines, score UI, legacy routes, FORGE trend-adjustment and cron source paths have no committed differences from Fable's `e56c5d635` to this HEAD. Preserve the original audit and its dated observations.

## Verdict

**Accept the principal implementation findings, but do not implement the audit verbatim.** The TOI fallback, legacy aggregation, comparison-scale, reason-text, PK-factor and missing-finalization defects are credible. Several reproduce directly. The proposed score redesign, interval semantics, confidence labels and acceptance thresholds need correction or an owner decision.

Most important additions and qualifications:

1. Band collectors filter unusable or zero-trial games **before** applying L3/L5/L10/L20. Older games can replace games in the named window.
2. Missing components can produce a score of **50 with `guardrailState: "ok"`**, which the dashboard marks ready. A null metric with present NST TOI becomes a measured zero.
3. Luck priors do not fully exclude the judged period: historical player counts are completed-season only, but the league prior is rebuilt from the current season. Historical baseline rebuilds also admit future game rows, beyond the future-season problem already identified.
4. The band's point value and credible interval are not exactly the same posterior. Boundary examples produce false cold flags. “Can never fire” and “percentile is a constant” are too broad.
5. FORGE uses the same own-value-versus-own-interval comparison. A reproduced 60× fallback error and a genuinely doubled shot rate both yield neutral projection multipliers today. Do not claim a measured FORGE projection bias from corrupt band values alone.
6. Near-unit marginal z-score SD is not evidence of calibration. Two overlapping, undocumented historical samples and partial correlations do not establish predictive improvement.
7. The current public badge and API already describe a **descriptive process-support index**, not a calibrated probability or observed-versus-expected measure. A luck-only replacement is a product/model change requiring a decision.

Fable's 16 sound / 28 mis-specified / 15 wrong / 1 undetermined counts are its classifications, not an independently recounted consensus. In particular, the unconditional “sound” conclusions for M-SUS-017/018, 025 and 056 need the qualifications below.

## Evidence and limits

Read the W1-9 prompt and brief, audit, packet references, owner decisions through decision 23, Batch A consolidation and relevant prior review material. Followed the consequential source/reader paths and inspected offline/debug implementations as described below.

- **Executed:** 11 existing isolated Vitest files, **103 tests passed**. They cover band calculation, windows, score, priors, features, model, entity surface/server, guardrails, backtest and FORGE trend adjustments. The requested `lib/baselines/aggregations.test.ts` path has no test file; it is not included in the 11-file pass.
- **Executed:** actual TypeScript functions compiled in memory with the installed TypeScript compiler. Local imports were allowlisted; the Supabase import was replaced by a throwing stub or an in-memory fixture client. No runtime application/provider calls. Inputs and results are documented here.
- **Not executed:** application build, broad lint/typecheck, browser/production smoke, provider calls, DB reads or writes, writer routes, migration, deployment, commit or push. This review edits only this report.
- **Reported, not remeasured:** all production counts/distributions, the eight-date 272-player band samples, active configuration row, empty projection/snapshot tables, catalog definitions and absences, league-prior means, and the two predictive samples. Their original SQL, inputs and output manifests are not preserved in the audit. Keep their date/sample qualifiers; archive a reproducible extract before relying on a magnitude.
- Source wiring is not fresh evidence of a deployed flag, a completed cron, current rows or user traffic. “Active path” below means reachable/currently wired in checked source, supported where applicable by Fable's dated observation. “Dormant” means explicitly offline or an unscheduled/unpopulated feature as qualified below.

## 1. Additional defects

### A1. Named windows expand backward after filtering (P1; M-SUS-029/055)

`bandCalculator.ts:190-283,285-326` builds metric-specific samples, dropping null/zero-exposure and zero-trial rows; `:530`, `:573`, `:614` then takes the first N surviving samples. `gamesAgo` retains the original row position, so decay is not reset, but membership is still wrong. `bandService.ts:98-140` fetches 40 games, allowing this expansion well beyond N. It affects shooting/IPP/on-ice proportions, PP rates, missing NST metrics and PDO.

**Reproduced:** the three newest rows have zero shots/goals; three older rows each have one goal on one shot. L3 SH% from just the newest rows produces no band. Appending the three older rows produces an L3 band with `ewma=1`, effective trials `2.33469647`, `value=0.12053289` against a 0.10 baseline. No game in the actual L3 had a shot. Adding data outside the advertised window changes the result.

**Fix/test:** choose the N chronological appearance rows first, then admit each metric's matched numerator/exposure within that fixed set. Zero-opportunity games remain in the membership count; they contribute zero trials, not replacements. Missing data stays missing. Test suffix invariance: changing/appending games older than the selected N cannot affect an L-N result. Check every collector and distinguish `appearance_count`, valid observations, discounted exposure and calendar freshness.

### A2. Missing-score evidence is labelled ready (P1; M-SUS-025/028/042)

`score.ts:209-235,248-265` records missing components but replaces missing luck terms with zero and sums missing skill terms as zero. `guardrails.ts:73-84,123-135` decides state using only warnings generated during that guard call, not incoming missing warnings/fallback flags. The dashboard route maps any state other than `degraded` to `ready` after filtering blocked rows (`pages/api/v1/sustainability/trends.ts:210-237`).

**Reproduced end to end through the actual pure producer/guard functions:** empty window-z and player-stat fixture results yield `s_raw=0`, `s_100=50`, all seven components missing, eight stored warnings, and `guardrailState="ok"`. The dashboard guard returns `state="ok"`, `warnings=[]`, `luckPressure=0`. Thus the route's status expression is `ready`. Global prerequisites only require that *some* baseline/window rows exist, not a complete player-window set (`dependencyChecks.ts:98-148`).

**Fix/test:** establish a component-coverage contract. An all-missing player is unavailable, not a neutral observed player. Partial scores need explicit provisional status and disclosed coverage if permitted at all. Propagate missing flags/warnings through producer, guard, trend feed, player API, leaderboard and Sandbox. Test absent, null, invalid, true zero and zero-trial cases separately. Do not automatically renormalize surviving weights and imply an equivalent score.

### A3. Present NST TOI is not proof of valid metric coverage or freshness (P1; M-SUS-056)

`score.ts:96-105` checks only NST TOI, then converts each null metric to zero with `Number(...) || 0`. It uses one shared denominator. `:110-112` reports the newest fetched row and total row count even when that row was skipped for missing NST TOI.

**Reproduced:** `{nst_toi:1200, nst_ixg:null, nst_icf:4, nst_hdcf:1}` returns `ixg60=0`, `icf60=12`, `hdcf60=3`; it does not return unknown ixG. Combining a valid 0.3-ixG/600-second game with a null-ixG/600-second game would halve the valid ixG rate by admitting the unmatched exposure.

**Fix/test:** use matched valid numerator/exposure pairs per metric, preserving legitimate zero counts. Emit metric coverage and the last admitted source date, not merely the latest appearance. Apply the same principle to band and baseline collection. This is a source-contract counterexample, not an observed frequency of partially populated NST rows.

### A4. League and player-history IPP can mix incompatible coverage (P1; M-SUS-017/018)

The window path deliberately counts points only for games with an NST GF observation (`windows.ts:111-115`). The league prior instead sums *all* points and the available NST GF independently (`priors.ts:93-105`). Historical player aggregation also sums points and GF independently (`:248-261`). The committed totals definition independently sums those fields (`supabase/migrations/20260716112908_production_schema_baseline.sql:23291-23295,23410-23413`); it does not encode the matched coverage needed to recover IPP. A current live view definition was not re-read.

**Reproduced:** fixture inputs with two points/four on-ice GF on an observed row plus two points/no NST GF on another row yield league IPP **1.0**; the window admission rule yields **2/4 = 0.5**. Matching season labels is not enough to prove matching observations. At more severe mismatch, successes can exceed trials. `betaPosterior` does not validate that domain (`priors.ts:324-347`): synthetic prior `(6,4)` with `(s,n)=(30,10)` returns beta `-16`, mean `1.8`, variance `-0.0685714`.

**Fix/test:** persist/reconstruct matched all-situations points and on-ice goals plus their coverage before pooling or blending. Reject unknown or impossible `0 <= s <= n` inputs; do not repair them by silently inflating n, clipping a ratio or pretending missing points/GF were zero. Test missing-GF rows, partial-season source coverage and zero trials. Same-strength is necessary but not sufficient. Population incidence remains unmeasured.

### A5. As-of repair must cover all baseline producers and current league priors (P1; M-SUS-003/004/006/017/018/028/058)

Fable correctly identifies future season totals in trend-band history (`bandService.ts:146-157,243,299-306`). Two further paths need inclusion:

- `pages/api/v1/db/sustainability/rebuild-baselines.ts:181-186` accepts an old snapshot date, but the game fetch at `:248-256` has **no date bound at all**. The player selection has a lower bound only (`:205-213`), and season totals are also unrestricted (`:258-266`). `aggregations.ts:529-532` takes the newest N rows supplied. Historical L5/L10/L20 baseline rebuilds can therefore incorporate games after the stamped snapshot, not merely future season aggregates.
- `getHistorySeasonIds` correctly excludes the current season from the player's historical counts. However, `fetchLeagueMeans` explicitly selects the target/current season (`priors.ts:54-105`), `upsertLeaguePriors` rebuilds that mean (`:399-418`), and `upsertPlayerPosteriors` mixes it into the posterior (`:436-468`). The prior tables are keyed by season, not the observation cutoff. Likewise skill references read mutable target-season totals (`score.ts:23-40`). A retrospective recomputation is not prefix-invariant when later totals or refreshed priors are available.

**Correction:** “the current season is excluded by construction” is true only of the *player-history count term*. It is false for the complete baseline. Current-cohort empirical Bayes is not automatically forbidden for a contemporaneous descriptive index, and same-player contribution to a large league mean may be tiny. But it is not a strictly non-overlapping prior and it cannot support an honest historical predictive replay without as-of versions.

**Fix/test:** define pregame/postgame cutoff once; bound raw rows, cohort, season totals, prior version and skill reference accordingly. Persist source cutoffs/effective prior identities. A fixed historical snapshot must remain unchanged when future games or later-season rows are appended. If the owner wants complete non-overlap, choose a frozen earlier reference or an explicitly leave-window-out/as-of construction; merely changing player-season selection is insufficient.

### A6. The normal band's uncertainty is unsupported, not repaired by Kish n alone (P1; M-SUS-029/032)

`bandCalculator.ts:608-650` shrinks the mean to a prior but estimates variance only from the same few recent samples, floors variance at `1e-4`, and uses `sd/sqrt(sum(weights))`. Prior uncertainty, the uncertainty of a shrunk estimator and future-observation noise are not represented. The fixed variance floor also has radically different meanings for a 0–1 share and fantasy points.

**Reproduced:** one observed PP-share value of 1.0, prior mean 0.5 and strength 15 gives value **0.53125**, interval **[0.5184345, 0.5440655]**, z **3.125004**. One observation has manufactured a very precise distribution using the numerical floor. Replacing sum(weights) with Kish effective n does nothing for this example.

For ten games and half-life 5, `sum(w)=5.793768`, Kish n is `8.670029`; keeping the same variance, the existing standard-error divisor yields a margin 22.3% larger. That algebra is correct, but it is **not a coverage result** and does not establish that the full band is 22% too wide. A posterior/predictive model or explicitly validated descriptive interval is needed. Test known-distribution simulations, very small n, constant samples, bounded shares and empirical interval coverage; specify what random quantity is covered.

### A7. Config identity does not include effective prior overrides (P2, conditional; M-SUS-053)

`pages/api/v1/sustainability/rebuild-priors.ts:47-50` accepts `k_shp`, `k_oishp`, `k_ipp` independently of the active config. It stamps the unchanged active hash/model on player posteriors at `:84-95`; the canonical seed does not include these prior strengths (`config.ts:83-101`). Two different prior computations can therefore carry the same advertised config identity. This is not a reason to equate Python SHA-256 and TS FNV-1a or to change hashing algorithms.

**Fix/test:** either reject overrides in the canonical writer or include the effective prior parameters and source/reference versions in computation provenance. With identical input counts, changing k must change the effective identity or be rejected. No production override usage was observed here.

## 2. Review of Fable's defects and remedies

### D1: confirmed; preserve weighting and missingness in the test

Five games at three shots and 1,080 seconds each, baseline 10 shots/60:

| Fixture | EWMA shots/60 | Discounted exposure, minutes | Shrunk value | Stored z |
|---|---:|---:|---:|---:|
| All five NST TOI values present | 10.000000 | 69.525216 | 10.000000 | 0 |
| Newest NST TOI null, same fallback TOI 1,080 | 0.614438 | 1,131.525216 | 2.879772 | -20.963103 |

Actual source: `bandCalculator.ts:198-225,258-275,530-554`. The five collectors and null-to-zero NST counts are confirmed. Fable's production percentages and per-date counts remain reported only.

**Correct the test:** EWMA uses `sum(w*count)/sum(w*seconds)*3600`, and stored exposure is **discounted minutes**, not unweighted total minutes. D1's suggested exposure-within-1%-of-sum(seconds)/60 test fails even on correct code: 69.525 discounted minutes versus 90 raw minutes in this fixture. A point `value` additionally includes the prior and is not the observed pooled rate. Test each quantity against its declared equation. Do not merely skip a missing NST game and let A1 backfill an older one.

### D2: real semantic failure, but “never” and “constant” are incorrect

The consumer comparisons at `trendsSandbox.tsx:592-597,2317-2322,2960-2965` are wrong for detecting departure from a player's baseline. The stored percentile is a linear interpolation inside a posterior interval (`bandCalculator.ts:100-106,743-746`), not a CDF or population percentile. It is exactly 50 for a nondegenerate symmetric normal interval, approximately central for common gamma/beta shapes, and variable near boundaries.

**The two estimators are not fully reconciled:** beta `value` is `(weightedSuccess+k*baseline)/(weightedTrials+k)`, while the interval uses an extra 0.5 success and 0.5 failure (`:581-602`). Gamma adds `1e-3` to both prior shape and rate but not to its blend (`:540-561`). They are close for routine shapes, not identical. The audit's near-refutation overlooks a visible boundary effect.

**Reproduced:** five 0-for-4 games with a zero shooting baseline return value **0**, beta posterior mean **0.00421223**, interval **[0.00006693495, 0.01140328]**, percentile **9.528**. The UI labels that player cold even though observed rate equals baseline. True equal-tailed intervals also need not contain the mean for every extremely skew distribution; an absolute mathematical impossibility claim is unwarranted.

**Important reader addition:** `projections/queries/skater-queries.ts:643-653,688-694` reads these rows; `projections/utils/trend-adjustments.ts:69-109` uses the same comparison. The doubled-shot fixture has EWMA 20, prior 10, value 11.618653 and interval [10.018926,13.278412], yet FORGE returns `within_band_neutral` and all four multipliers 1. The corrupt D1 fixture also returns all multipliers 1. Fable's blanket downstream attribution needs this qualification. A redesigned band can activate previously inert FORGE adjustments, so this is a behavior change requiring coordinated validation.

**Fix choices:** (a) compare observed window data with a baseline predictive distribution, or (b) keep a posterior interval for talent and ask whether the *baseline* lies outside that interval, with appropriate uncertainty. These answer different questions. An expectation interval is a reasonable proposal, not the only valid repair. Update all three UI checks, stored percentile/z semantics, both API shapes and FORGE together with version handling for old rows.

**Correct the test:** twice a baseline need not be statistically hot with low exposure, uncertainty or a zero baseline. Choose fixed baseline/posterior/exposure parameters, derive the predictive tail probability and assert that exact decision. A universal “percentile changes by >30” is not a statistical invariant.

### D3/D5: confirmed, but pooling must use valid paired components

The precedence error is explicit at `pages/api/CareerAverages/[playerId].ts:111-124,127-134`; the exact reducer gives **33.75** for `[60,"-",70,65]`. The two shooting seasons 1/4 and 20/250 yield unweighted mean **0.165**, pooled **21/254 = 0.0826772**. The same mean-of-game-ratios problem reproduces in `aggregations.ts:116-121,247-258`.

Additional reproduced outputs: raw `nst_ipp` values 60/70 give baseline `mu=65`; a 0–1 band compared against it is a unit mismatch. Three 82-game PDO seasons 1.01/1.00/0.99 produce a 3-year `rate=0.0122561` because the numerator lacks GP multiplication (`aggregations.ts:496-514`). Career missing-field fallback and `nst_oi_shots` typo are source-confirmed (`:563-568,600-649`). `win_season_prev` and PP reference take newest totals (`rebuild-baselines.ts:297-320`). The comparison reader uses these mu values (`entitySurfaceServer.ts:260-273,366-396,432-464`).

Do not apply “use the saved numer/denom” indiscriminately. Those are independently accumulated, with zero-filling (`aggregations.ts:276-305`), and `toi_seconds` is later overwritten with `nst_toi || toi_per_game` for three NST metrics (`:351-362`), potentially contradicting the saved denominator. Recompute from matched valid observations and explicit units/strength. IPP needs matched points/GF, PDO needs separate SH/SV components, 5v5 shooting needs 5v5 attempts, not all-situations shots (`:561`). Use null/coverage for an unavailable denominator.

For legacy career history, define handling of current seasons and traded-team split rows before pooling; avoiding duplicate full-season-plus-split counts is essential. Completed seasons are a proposed comparison policy, not yet a general owner decision. Fix both legacy recent and career xS% together under decision 17; repair the chart label and its display scaling.

### D4/D11: leakage confirmed; magnitudes and owner inference need narrowing

The exposure-share equation is `0.6*currentExposure/(0.6*currentExposure+0.3*priorExposure1+0.1*priorExposure2)`. Fable's **21.5% at 15 GP** and **60% at 82 GP** require equal exposure/opportunities per game and two 82-game prior seasons. Counts, shots and TOI need not grow in identical proportion to GP. A fourth fetched season has zero weight (`bandCalculator.ts:109-119`), so “three full prior seasons” is not the operative denominator. Fantasy-score season means do have the stated 60% weight when all three seasons have GP. Same-season overlap and future-season use are nevertheless real.

Last-N across seasons is established at `windows.ts:80-96`; the score and band game fetches likewise lack a season bound (`score.ts:84-90`, `bandService.ts:134-140`). Crossing a season is not inherently wrong for a last-N-games definition. Overlap with a supposedly excluded baseline and undocumented scope are the defects. **Decision 18 is about calendar-day windows ending today, not an instruction to truncate last-N appearances at season start.** Keep the explicit owner question; either fix the overlapping prior while retaining N appearances or adopt an approved season-local contract. Carry short-window/zero-game coverage honestly.

### D6/D7: correct the framing, but do not turn a design preference into a proven replacement

Trust/fade ordering is luck pressure only (`trends.ts:202-208,256-260`; `SustainabilityCard.tsx:252-265`). “Trust High” is an absolute pressure threshold (`:59-64`), not calibrated predictive confidence. Component signs disagree with the total (`trends.ts:239-250`). Badge cutoffs come from the supplied extreme-row set (`SustainabilityCard.tsx:270-273`), not a stable league reference.

However, the displayed badge currently says **High/Mid/Low index**, with a tooltip explicitly calling it a descriptive process-support index (`components/sustainability/SustainabilityBadge.tsx:18-25`). The Sandbox API sets `score_semantics="process_support_index"` and refuses to infer an expectation state (`entitySurfaceServer.ts:664-670`; `entitySurface.ts:263-268`; also `read.ts:23-26`). Internal enum names durable/volatile do not prove those words are currently shown. The canonical index is the weighted composite as documented in source; it does not purport everywhere to be a calibrated probability.

The sigmoid saturation and mixed reference populations are factual design properties. Correlated features are not by themselves an arithmetic “triple-counting” defect; they require covariance/ablation analysis and predictive or descriptive justification. Adding `n/(n+k)` to an already sample-aware predictive z can double-attenuate it if the new estimand is not specified. Likewise, replacing the index with a within-position luck percentile changes its meaning and removes deliberate quality/process terms. Make that an explicit choice.

**Statistical claims to withdraw or downgrade:**

- SD 0.90–1.06 is only a marginal spread check, not “well calibrated.” Conditional calibration requires forecast/interval coverage or residual-distribution checks by exposure, position, missingness and season phase, on held-out snapshots. Discrete small-n z-scores are not standard normal merely because their variance is near 1.
- The reported partial correlations around -0.2 are suggestive associations, not evidence that the luck component “carries real signal beyond the raw rate.” The inputs and scripts are unavailable, dates overlap, effective independent n is unknown, priors/references may not be as-of, and no interval or held-out fitted comparison is supplied. Correlating earlier rate X with Y-X also introduces mathematical coupling. These are exploratory checks only.
- High-index players having lower earlier PPG is consistent with a regression-oriented construction. It does not prove poor future ability or usefulness, nor establish a calibrated trust/fade rule.
- A percentile of absolute pressure is an **extremeness rank**, not confidence in a direction or future gain. Trial count alone is not predictive confidence either. “85% High must fail” is an arbitrary prevalence target.
- “<5% of synthetic scores outside 5–95” is not a correctness invariant. Seven independent unit-variance z's with the stated weights have un-clipped sum variance **4.9**; a logistic transform naturally reaches its tails. Correlation/clipping changes that distribution. Choose and validate a display scale instead of imposing an undocumented statistical theorem.

**Better evaluation:** archive cutoff/versioned inputs and outcomes; compare a fitted baseline using raw recent and historical rates with the same model plus luck/process components, on identical qualified players and chronological held-out dates. Report paired MAE/RMSE for the declared next-N-game outcome or change, clustered uncertainty for repeated players/dates, and coverage/abstention. Evaluate luck-only and blended candidates as alternatives. Rename uncalibrated labels now if desired; do not declare a winning model from the existing correlations.

### D8: confirmed, including the exact emitted text

Actual `extractReasonHighlights({z_shp:1.2, extremeThreshold:5})` leads with **“ExtremeThreshold is running above baseline by 5.00 standard deviations.”** Source `entitySurface.ts:293-309`, metadata `observability.ts:5-17`. The exact text does not insert a space in ExtremeThreshold. Allowlist valid z metrics, preserve missingness, distinguish player-history and league-reference comparisons. If a field is called impact/contribution, report signed weighted contribution rather than raw z (`read.ts:29-37` currently names raw z `impact`).

### D9: confirmed exposure mismatch; do not pool PDO with one total-shot weight

PDO spec is at `bands.ts:191-198` (not the audit's cited 132–138). It assigns prior strength 300 while the normal calculator uses sum of game-decay weights; exposure computed in `bandCalculator.ts:341-350` is ignored at `:618-628`.

**Reproduced:** ten identical PDO=1.08 games, each SF=SA=30, yield `n_eff=6.982892`, value **1.00181975**, percentile **50**. This supports the pinning mechanism, not the reported production averages.

Use separate matched GF/SF and saves/SA posterior/predictive components, respecting potentially different exposures and any dependence. Simply weighting game PDO by SF+SA is generally not equivalent. Example: game A GF/SF=20/100, saves/SA=1/1 gives PDO 1.2; game B 0/1 and 90/100 gives 0.9. Both have total exposure 101, so a total-shot-weighted mean is **1.05**, while pooled component PDO is **111/101 = 1.0990099**. A universal “ten games imply >1.02” test needs specified baseline, strengths, exposure and interval target.

### D10: scale and direction confirmed; replacement magnitude is hypothetical

Actual `deriveOpponentAdjustmentFactors` at 15 GP and otherwise default context gives goal multipliers **1.017578 / 1.016406 / 1.015234** for PK tiers 1/2/3; assists **1.014063 / 1.013125 / 1.012188**. This independently reproduces the stated scale/direction issue (`features.ts:170-176,738-778`). Full-weight figures are asymptotic because `GP/(GP+25)` never equals 1 at finite GP.

The suggested `tier-2` repair and ±5% goal effect are hypotheses, not fitted effects. Prefer the owner's pooled PP/PK input contract; do not feed the previously flagged one-game tier into a new formula. A neutral-PK test must hold every other opponent feature at its reference, otherwise total goal multiplier need not equal 1. A league-average PK is not necessarily the midpoint of an ordinal tier. Snapshot projections and opponent-game projections are separate: only the latter receives opponent adjustment (`recompute.ts:123-128,157-164`).

The feature is reachable via an admin recompute route and read APIs; absence of a cron and Fable's 2026-11-11 zero-row observation make it **unscheduled/unpopulated as reported**, not proof it can never execute. Preserve it without activation until a decision and isolated validation.

### D12: confirmed definitions; repair the entire pair of legacy readers

`SustainabilityStats/[playerId].ts:59-82,101-107` selects by current team and then name, not stable NST player identity across the date window. Changing the team filter alone still needs a deterministic identity match and careful split aggregation. No provider request was made, so live parsing behavior and current NST table layouts remain unverified.

Decision 17 fixes expected shooting percentage to **100*ixG/Fenwick**. This applies to the legacy career route too (`CareerAverages/[playerId].ts:100-108`), not only the recent route (`SustainabilityStats/[playerId].ts:122-125`). Update the current fraction-based display/colour contract simultaneously. Colour cutoffs are heuristics, not a validated inferential test; a binomial-SD replacement also needs a precise null/target and coverage, rather than only a name change.

### D13: missing finalization confirmed in source; finalize after verified completion

The four cron slices omit `runAll` (`web/vercel.json:55-68`), and score distribution/quintile work is conditional on it (`rebuild-score.ts:147-171`). A queue finalizer exists (`process-recompute-queue.ts:74-84`). Stored null/empty counts are Fable's observation only.

Do **not** merely finalize when the highest-offset slice returns: scheduled order does not prove all earlier slices succeeded or share one version/reference. Require a complete expected player/window manifest, successful bounded receipts, common model/config and cutoff, idempotence, then finalization. Test late/failing/retried slices and mixed versions. Also, `shapeSustainabilityLeaderboardPayload` does not emit a quintile field at all (`read.ts:248-267`), although its query selects one; the audit's “leaderboard returns null quintile” is not literally true for that response shape. Align distribution definitions across SQL/TS before relying on them for labels.

### D14 and smaller claims

- Rookie K boost really narrows predictive variance: same `(s,n)=(6,30)`, mean 0.1, K=200 versus 400 gives z **1.706764 → 1.763102**, a 3.30% increase (`priors.ts:351-379`, `windows.ts:161-184`). “More conservative mean” is not “more uncertain prediction.” Select the intended hierarchical prior, do not infer a universal corrective K from this example.
- Half-life 5 implies total **game weights** approach 7.725, not a universal 28% data-weight ceiling. The gamma weight uses **minutes** and depends on per-game TOI; 28% assumes roughly 18 minutes/game against 360 prior minutes. Other metrics have different half-lives/prior units (`bands.ts:55-252`).
- 5v5 points versus EV exposure is source-confirmed (`bandCalculator.ts:228-236,402-408`). Its reported 12% sample difference is not a measured causal effect. Decision 23 additionally requires matched non-overlapping rates for finishing residuals (`aggregations.ts:52-60`).
- Numerical quantile smoke checks passed: Beta(1,1) 80% interval approximately [0.1,0.9], Gamma(shape=1,rate=2) approximately [0.05268026,1.15129255]. This is not an extreme-shape/convergence validation. Fractional discounted counts imply a power-likelihood heuristic, and ixG is a sum of shot probabilities, not a Poisson event count. Calibration is needed before treating such intervals as nominal coverage.
- Count quantiles are normal approximations (`features.ts:207-224`), not exact Poisson quantiles. At mean 0.1, p90 is **0.505262**, whereas the exact discrete Poisson 90th percentile is **0**; at mean zero it emits p90 **0.000041**. “Small at a five-game horizon” cannot be assumed for rare goals/PP events. Dormant projection/debug scope limits immediate impact.
- Independent count variances add only under the stated independence/known-rate model (`features.ts:813-845`). Shared uncertain player talent induces covariance across future games; do not use that helper to claim full predictive uncertainty without adding it.
- Offline Python defects are correctly separated from serving. `README.md`, `offline.py` and `pipeline.py:133-136` explicitly prohibit production persistence. Prior season arithmetic (`player_priors.py:72-73`) is wrong for eight-digit seasons, but “every player is a rookie” is conditional: the rookie flag examines all supplied prior-season rows (`:139`), so explicitly supplied correct history can prevent that flag even while the blend still omits it.
- Python guardrail mismatch is real (`pipeline.py:162`, `config_loader.py:39-43`, `scoring.py:44-65`). The unrounded scale difference is at most 0.5 points; **rounded integer scores can differ by 1**, so ≤0.5 is not a universal bound on displayed scores. Different TS/Python quintile directions and shrinkage/clipping are compatibility differences, not independent proof each mathematical choice is wrong.
- The Python finishing “rate” is `(G-ixG)/shots`, not per 60 (`finishing.py:67-70`), so it also violates decision 23 if revived. The claimed 2.1×/12.6× magnitudes lack retained fixture inputs; no independent numeric endorsement.
- Debug Platt fit reuses training logits (`model.ts:522-534`). Softmax(log probabilities) is renormalisation, which is not itself a bug; it is not multinomial calibration. The raw composite is intentionally clamped to [0,100] (`:888-896`), so its unclamped range alone is not an output-range defect. The sign-insensitive flag condition remains suspect (`:950-960`).
- Reproduced debug model: raw features `[0,0,0,0,1]` yield **97.1709% hot**; literal `[0,0,0,0,0]` yields **98.8549% normal**. Thus the audit's 97% claim relies on default PDO=1, not an all-zero feature vector (`trendsDebug.tsx:140-153,322-325,1333-1334`). This remains an admin demonstration, not the canonical score.

## 3. Entry coverage crosswalk

All IDs below use the `M-SUS-` prefix. “Retain” means retain the limited conclusion, not independent verification of the original production magnitude or every historical implementation.

| Entries | Peer-review disposition |
|---|---|
| 001 | Illustrative, unscheduled SQL confirmed. Non-renormalised common numerator/denominator weights do not alone bias their ratio; absent-view claim remains reported. |
| 002 | Deployed-view body/parity is reported only; no fresh catalog check. |
| 003–007 | Retain source defects; add A1/A4/A5 and matched-component requirements. PP-control no-reader claim is not proof of no external caller. |
| 008 | Retain unpaired-cohort/mixed-metric critique. Three-class unnormalised Brier uniform value 2/3 is correct (`backtest.ts:187-202`). |
| 009–010 | Seconds-based basic rates sound under valid inputs. Percentage inference `>1` remains ambiguous. Helper/test-only scope, not canonical score logic. |
| 011–014 | Retain offline divergence and fixed-spread concerns; qualify magnitudes, rookie claim and impossible-count handling. Python priors inflate invalid denominators (`priors.py:109-112`), which is not an acceptable coverage repair. |
| 015–018 | Algebraic shrinkage/posterior helpers are conditional on valid inputs. Add A4/A5; rookie uncertainty concern confirmed. Current prior means/sample SDs are not independently measured. |
| 019–021 | Retain PK defect and approximate uncertainty caveats; unpopulated projection status is dated, debug faceoff claim is not a measured coverage deficit. |
| 022–024 | Offline compatibility findings retained with rounding qualification. TS assignment implementation read; cron omission confirmed. |
| 025 | Downgrade unconditional sound: A2 missing-coverage status failure. Numeric clipping behavior itself is as stated. |
| 026–028 | Retain demo defects/unvalidated-index concerns; correct current semantic labels, calibration language and proposed redesign/test claims. |
| 029–032 | Add A1/A6 and posterior-point mismatch; qualify 28% cap and numerical “sound” designation; PDO exposure mismatch confirmed. |
| 033–035 | Offline windows/fixed z and sqrt dampers confirmed. Distinguish a z damping choice from a posterior-mean shrinkage coefficient. |
| 036 | Beta-binomial rate-variance identity is correct for valid counts/positive shapes; this is not empirical calibration or input-domain validation. |
| 037–039 | Placeholder/inert settings supported by source. Current catalog absence, SQL finalizer and view-label definitions remain reported observations, not fresh verification. |
| 040–044 | Retain legacy/current-UI source defects, with own-interval and demo-input qualifications above. |
| 045–047 | Benchmark Poisson fallback/date issue supported; joined-feature as-of concern retained. Expected shooting contract is already settled by decision 17. |
| 048–050 | Cohort-dependent labels are real; current user-facing labels are index labels. Colour semantics remain heuristic. Metadata-as-z text directly reproduced. |
| 051–053 | Verification/drift are diagnostics, not calibration. Rookie helper is a no-history proxy over only the current/two-prior-season query (`read.ts:309,328`), not NHL rookie eligibility or a full-career proof. Config adds A7. |
| 054–056 | Trust framing confirmed, sample claims unverified; collectors add A1/A6; skill collector's unconditional sound conclusion fails A3. |
| 057–060 | Cross-season selection confirmed but intended season scope unresolved; skill cohort/current-reference caveats retained; approximate counts/independence require the qualifications above. |

## 4. Owner decisions and repair sequencing

Already settled: decision 17's Fenwick-based 0–100 expected shooting definition; decision 23's matched non-overlapping results-luck per-60 rates; Batch A's pooled PP/PK direction and explicit unknown-data policy. Decision 18 does not resolve last-N season crossing. No owner decision in the reviewed file authorizes a luck-only score, new tier scaling, a projection activation or a history rebuild.

Needed choices, in order:

1. Preserve the descriptive blended process-support index, or replace/split it into a defined luck signal and process trend? Specify direction and avoid predictive confidence claims until validated.
2. What do bands cover: uncertainty in underlying talent, expected observed window variation, or future outcomes? Update labels, status and FORGE together.
3. Baseline/reference cutoff and last-N scope, including zero-trial, rookie and missing-source behavior. Distinguish completed-season player history from an as-of current-league reference.
4. Is the separate `sustainability_projections` feature parked? Do not activate it merely to test a correction.
5. After isolated fixes and versioned reader handling, whether to correct historical rows via a separately approved bounded rebuild. Preserve current stored evidence first and reconcile any uncertain writes before retries.

Suggested local fix-plan sequence: coverage/time/unit contracts → collectors/baselines and missing-state propagation → interval/statistic semantics and all readers → complete-batch finalization/provenance → held-out calibration/model comparisons → separately authorized history repair/release. Do not fit a replacement to corrupted band history or infer safety from a passing existing suite.

## 5. Verification receipt and reproduction notes

Existing tests ran with explicit inert Supabase URL/key values, from `web/`, using the installed `vitest` binary and `run` mode. Passed files: `lib/sustainability/{bandCalculator,windows,score,priors,features,model,entitySurface,entitySurfaceServer,guardrails,backtest}.test.ts` and `lib/projections/utils/trend-adjustments.test.ts`. No application suite was run simply for the Markdown output.

Fixture runner technique: `typescript.transpileModule` to CommonJS/ES2020 in memory, resolving only relative and `lib/` local modules. `lib/supabase/server` was either a throwing stub or a fixture-only chain implementing select/eq/in/lte/order/limit/range/then. The stub deliberately did not contact any server. No installed dependencies or source files were modified.

Core reproducible calls (all synthetic):

- `computeTrendBandsForPlayer`: player 1, snapshot 2026-11-11, season 20262027, newest-first rows; shots baseline totals `{season_id:20252026,shots:150,toi_all_situations:54000}`, five rows `{shots:3,nst_toi:1080,toi_per_game:1080}`, window l5. Null only newest `nst_toi` for D1; set every `shots:6` for D2. Pass resulting row to `computeSkaterTrendAdjustment` with same as-of date.
- A1: sh_pct/l3, baseline `{goals:10,shots:100}`; first three rows `{goals:0,shots:0}`; append three older `{goals:1,shots:1}` rows. Check result before/after append.
- Boundary D2: sh_pct/l5, baseline `{goals:0,shots:100}`, five `{goals:0,shots:4}` rows.
- A6: pp_toi_pct/l3, totals `{pp_toi_pct_of_team:0.5,games_played:82}`, one `{pp_toi_pct_per_game:1}` row.
- D9: pdo/l10, ten `{nst_oi_pdo:1.08,nst_oi_sf:30,nst_oi_sa:30}` rows, no totals needed because PDO prior baseline is fixed 1.
- A2: `buildScoreForPlayerWindow` with no z rows/no stat rows; all three league references finite; default weights. Then pass its row/components and pressure 0 into `guardSustainabilityDashboardRow`.
- A3: `fetchSkillWindowRates` fixture client returns `{date:"2026-11-11",nst_ixg:null,nst_icf:4,nst_hdcf:1,nst_toi:1200}`.
- A4: `fetchLeagueMeans` fixture rows `{points:2,nst_oi_gf:4,nst_oi_sf:40}` and `{points:2,nst_oi_gf:null,nst_oi_sf:null}`. Compare its count admission to `fetchWindowCountsAll` with those same synthetic records, not a production query.

This report records the fixtures rather than introducing a new application test file in an audit-only task. It does not claim the proposed fixes have been implemented or verified. Final artifact review checked that the original audit/owner decisions and application source were not edited by this task.

Final concurrent-checkout check: HEAD advanced to `fbceea028f71737b2d55745b9556f96ebe1d26aa`; only the fantasy-scoring and FORGE part-2 audit reports changed between those two commits. The reviewed source paths, W1-9 audit and owner decisions were unchanged. Markdown whitespace check passed; this report remains uncommitted.

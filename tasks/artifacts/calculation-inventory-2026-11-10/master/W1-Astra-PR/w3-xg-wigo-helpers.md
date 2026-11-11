# Independent peer review: W3-1 xG, WiGO and stats helpers

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Audit: `../audits/xg-part2-wigo-helpers.md`, commit `859cfb51288ed9730358618b164bdefe45304b65`. HEAD advanced during review to `8d95393baa2dc6bfabf6a5d0ecbc137a6e57323f` through two unrelated audit-document commits. All 20 source files loaded by the saved fixture harness match their contents at `859cfb512` by SHA-256; the xG page and relevant route/reader files also have no diff from that commit.

Scope: source and offline fixtures, relevant packets, rules digest/owner decisions, and upstream xG/SQL/rankings review context. No production database queries, provider requests, endpoint execution, registry changes, deployments, source edits, commits or pushes. Original audit and other reviews remain untouched.

## Verdict

**Accept the main diagnoses, but do not consolidate the audit unchanged.** There is one material reach correction and four additional implementation findings. In particular:

1. **The xG Lab defaults to 2025–26, not the empty 2026–27 season.** Its mixing/zero-fill problems are reachable on the default historical page. The API's no-argument default is not the UI request.
2. **The approval gate can approve an unapplied calibration remedy.** An executed fixture with 140 test shots, 10 goals and constant 0.5 predictions passes, despite Brier 0.25 versus a constant-base-rate 0.06633. The final gate sees an adoptable calibration *method*, not proof that the artifact applied it.
3. **Seasonal WiGO nulls still become zeros, and a null NST rate can be revived from WGO exposure.** M-WIGO-012's unconditional “Sound” verdict must be withdrawn.
4. **The percentile panel can still rank a player alone for an individual stat.** Its peer check occurs before stat-specific missing-value removal. Ratings separately renormalize incomplete inputs into full-looking scores.
5. **xG aggregation mixes feature versions, not just seasons.** A single game represented under two feature versions counts as two rolling games, and the flurry lookup also cross-contaminates the versions.

The two refuted leads are correctly refuted: `overall.final` has no non-test reader, and `calculateTierThresholds` is called from the projections page. Do not revive the dormant overall-rating finding as current displayed double-counting.

## 1. Corrections to reach, magnitude and remediation

### C1. Correct D7 / M-XG-062 and the final “nothing users see today” conclusion

`web/pages/underlying-stats/xg/index.tsx:213-235` initializes `seasonId` to `"20252026"`, window to 10 and scope to players. `buildXgRequestPath` explicitly includes that season (`:39-57`). The API defaults to the current season only when the parameter is omitted (`web/pages/api/v1/underlying-stats/xg.ts:254-257`).

Consequently the audit's reported absence of 2026–27 rows does **not** make the default Lab empty. Classify D7 as a **live historical reader, conditional on the stored rows**, with no fresh production-render claim. The same qualification applies to old rolling xG rows consumed by it. Keeping the old champion serving under decision 5 does not make existing incorrect displays a future-only problem.

D7's mechanism is confirmed, with two details to preserve:
- Supplemental transition/rebound values are sums of the **bounded fetched preview**, not necessarily complete season totals. The API orders and limits source rows globally (`xg.ts:94-96,159-180,391-433`), then discards game identity before aggregation. Different players may have different coverage.
- Equal `windowGames` does not establish equal games or cutoff. Created-xG and core xG choose their latest row independently (`xgExplorer.ts:344-367`). The saved fixture combines a January 10 core row with a February 10 created-xG row and presents them together under January 10. Missing transitions and rebounds become zero.

Fix the exact `(model, feature, season, entity, game set, cutoff)` support contract, not only the window-size label. Carry absent/partial support separately from verified zero. Preserve the upstream caution that demotion alone does not hide old aggregates.

### C2. D6 is confirmed, but the calibration hole is more specific than “only mean prediction is checked”

The goal gate does consult `calibrationAssessment.adoptabilityBlockingReasons` and `requiresPostCalibration` (`train-nhl-xg-baseline.ts:554-570`). `assessCalibration` contains bin/mean-gap diagnostics and minimum rebound/rush-positive checks (`calibration.ts:179-269,491-542`). Do not imply these diagnostics do not exist.

**They are insufficiently connected to the model actually approved.** `buildValidationCalibration` skips calibration for fewer than 10 validation observations or a single validation class (`train-nhl-xg-baseline.ts:1558-1576`). The subsequent assessment on validation plus test can suggest a usable calibrator. The final approval gate rejects required calibration only if `adoptableMethod == null`; it never requires that method to have been fitted/applied to this artifact.

Executed source-derived fixture:
- Nine validation rows, all non-goals; 140 test rows, 10 goals; every prediction 0.5.
- One positive rebound and one positive rush satisfy the slice-coverage checks; selected `isFlurryShot` is not forbidden.
- Validation calibration: `selectedMethod: raw`, `fitSplit: none`, `applied: false`.
- Final assessment: `requiresPostCalibration: true`, `adoptableMethod: platt`.
- Gate: `isEligible: true`, no blocking reasons.
- Actual test log loss **0.693147**, Brier **0.25**; constant observed-test-base-rate comparators **0.257319** and **0.066327**.

This proves a gate defect, not that an artifact with these exact characteristics is deployed. The constant observed-test-rate comparison is a diagnostic oracle baseline here; choose/freeze the operational baseline without test-label fitting for an honest prospective benchmark.

Retain the audit's other D6 points: 10-goal floors, no direct goal-model proper-score requirement, allowed future-dependent flurry input, and validation reuse after calibration. The benchmark is weaker still: both a missing eligibility block **and** `{isEligible:false, blockingReasons:[]}` pass; a completely absent `testExampleCount` also passes because the check is `=== 0` (`benchmark-nhl-xg-baselines.ts:115-128`). The scoring route normally checks `isEligible === true`, but has an explicit `allowUnapproved` override (`update-nhl-xg-shot-predictions.ts:380-415`); it is not an unconditional assertion. Unapproved predictions still carry their approval state and the aggregate reader filters approved rows, so this is not evidence of an automatic aggregate bypass.

**Fix/test:** validate the saved, actually applied artifact pipeline on untouched test games. A calibration recommendation is not fulfillment of a calibration requirement. Require a valid affirmative eligibility schema in the benchmark; reject absent/malformed sample counts. Preserve backward-only feature lineage tests and test-set proper scores with clustered uncertainty. The proposed “about 370 goals” precision target assumes independent Bernoulli observations and a particular error tolerance; it remains an owner/model-validation choice, not a universal approval theorem. Do not tune/re-fit a calibrator on the test set to make this fixture pass.

### C3. Tighten D1's attribution and its zero-fill proposal

The attempt-conditioned player-window mechanism is confirmed (`aggregates.ts:516-545,712-745`). In the executed fixture, every one of 12 team games has a prediction from another shooter; the target has attempts in eight. Its latest “10” window has `games_count=8`, ixG 2.0 and includes all eight attempt-games. A dressed-game last 10 would contain seven of those attempts, ixG 1.75. No production participation ledger was queried.

The reported 6,833 absent player-game aggregate rows are **not independently proven to all be genuine zero-attempt games**. They may also include missing/partial prediction coverage or identity mismatches. An annual 20% deficit also does not prove each affected player's latest 10 attempt-games spans at least 12 appearances. Keep the annual comparison as the original dated coverage observation, not a measured rolling-window distribution.

Zero-fill only when both participation and complete eligible prediction coverage establish a true zero. A missing prediction batch must remain unknown. The same coverage requirement applies to teams and goalies; the audit's blanket “team and goalie windows do not have the missing-row problem” is too strong. In particular a goalie appearance with no eligible attempts cannot be inferred from prediction rows. Ordinary complete team games need not suffer the player's frequent zero-attempt problem, but this is not a guarantee about data completeness.

Empty-net inclusion is confirmed for team/player totals. In the fixture, a 0.9 empty-net goal with no goalie ID enters team/player totals and creates **no goalie row**. Do not describe this as universal empty-net inflation of an identified goalie's totals; that depends on goalie attribution. Preserve decision 7's separate net-state policy.

### C4. Other precision corrections

- D2 mutates shared **player objects**, but creates a new combined array; it does not sort the original skater/goalie arrays. Its second (actual) sort starts from projected-sort order. Thus equal/missing actuals can inherit **projected rank order**, not original input order. Null-as-zero and arbitrary sequential ties are reproduced and remain defects.
- D9's shrinkage is continuous at 10 GP for a fixed cohort and percentile: `GP/10 × percentile + (1−GP/10) × mean` meets the unshrunk percentile at 10. It has a slope change, not an inherent discontinuous “hard step.” Cohort membership changes can separately change ranks. Constants remain unvalidated hypotheses.
- D3's comparator GP filter deliberately keeps the target regardless of its GP (`calculateWigoRatings.ts:49-52`; `RateStatPercentiles.tsx:285-289`), and the panel warns when it is below the chosen threshold. Describe the current policy precisely before changing it to a target-withholding rule. The SQL sums provider GP; it does not itself prove GP means only positive-strength-time appearances. Missing minute qualifications are real without assuming that semantic detail.
- D4's independent-uniform illustration is not a measured 32-team effect, as the audit correctly states. Its proposed 90th/50th fixture must compute the complete cohort's composite rank; the true rank could coincidentally equal 70. The saved complete 32-team fixture instead shows a displayed **27th** from an unranked composite **26.5625**, versus a true composite percentile **15.625**.
- D10's overlap is reproduced: round means `[5,5.4,4.1]` place 5.2 in both Tier 1 and Tier 3; negative values are uncovered. Sorting numeric boundaries fixes geometry but can silently rename which draft round a band represents. Preserve the chosen tier meaning or explicitly relabel it; test missing and tied boundaries as well.

## 2. Additional findings

### A1. P1, live writer / missing-data dependent: seasonal nulls are zeroed before metric support is checked

M-WIGO-009/011's D11 does not cover this failure. Seasonal ingestion uses `record.ixg ?? 0`, similar NST fields, and `rec.goals ?? 0`, `rec.points ?? 0`, etc. (`calculate-wigo-stats.ts:524-541,571-581`). Merely having a source row sets `has_nst_ind` or `has_wgo`; `writePeriod` then computes counts/rates from the zero-filled values (`:630-634,674-736`).

Executed fixture: one 10-GP season, 200 NST minutes, WGO 1,200 seconds/game, unknown NST ixG and unknown WGO goals/points. The writer produces `std_ixg=0`, `std_ixg_per_60=0`, `std_g=0`, `std_g_per_60=0`, `std_pts=0`. These are unsupported zeros, not valid observations. STD/LY/3YA/CA share the builder.

The **recent** builder now has per-field completeness guards at `:956-983`; do not incorrectly report the same recent zero-imputation merely from its intermediate `?? 0` reducer. Those guards do not protect seasonal/career calculations.

Readers: `fetchPlayerAggregateSources` → `buildWigoAggregatedStatsResult` → comparison matrix, DIFF and chart reference lines. No live prevalence was measured.

**Fix/test:** carry finite metric-level count/exposure support before aggregation, including absent seasons and unequal game identities. Null counts remain null for the advertised complete period; supported-subset figures need their own visible coverage and matched denominator. Test missing counts with positive TOI, mixed supported/unsupported seasons and a genuine zero. Do not “fix” only all-null totals while admitting partial sums as full-period totals.

### A2. P1, live reader / missing-data dependent: a correctly null rate is revived with the wrong exposure

**Withdraw M-WIGO-012's unqualified Sound verdict.** `derivePer60` uses the generic career `ATOI × GP` for every supported count, including NST ixG/iCF, whenever the published rate is null (`fetchWigoPlayerStats.ts:301-349`). Generic ATOI prefers WGO time; this does not establish matching NST support.

Executed producer-to-reader fixture: a 10-GP season has WGO ATOI 20 minutes and NST ixG 5, but NST TOI is null. The seasonal writer publishes `std_ixg_per_60=null`. The actual production assembly path, `buildWigoAggregatedStatsResult` (which passes `ratesData:null`), changes it to **1.5 ixG/60** using 200 WGO minutes. The unavailable denominator was not repaired; the reader replaced it.

This is not dependent on the dormant legacy `wigo_rates` override. The live fetcher no longer reads that table (`:685-687`). Recent rates are handled separately and retain their source completeness guard (`:392-402`).

**Fix/test:** treat an authoritative null as unavailable, not an invitation to derive from unrelated exposure. Allow a legacy fallback only with an explicit absent-field/source-version distinction and matched metric-specific count, exposure and sample support. Test the end-to-end published-null → served-null path, plus supported zero → zero. Repair the writer and reader together.

### A3. P1/P2, live rating/panel paths / incomplete-input dependent: cohort support and score coverage remain inconsistent

**Panel peer-count failure (P2).** `RateStatPercentiles.tsx:292-301` checks for any other GP-qualified player before per-stat filtering. At `:324-344`, missing metric values are removed but peer presence is not checked again. Fixture: target ixG/60=2, one peer ixG/60=null, both GP-qualified. The actual component calculation returns **rank 1, percentile 50%** for ixG/60. The general warning also checks GP-qualified peers, so it does not expose the stat-specific singleton (`:385-392`). This contradicts the nearby intention to avoid ranking someone alone. The ratings helper already checks peers per stat; preserve that behavior.

**Incomplete ratings (P1).** `calculateWigoRatings.ts:215-239` sums only available metric weights and divides by their sum. With 21 eligible players and only `total_points_per_60` present, the top player's All Offense is **97.619**, though only **25 of 100 configured weight units** have evidence. With no defense, Overall All becomes the same 97.619 (`:246-254`). `PlayerRatingsDisplay.tsx:145-175` renders full-looking 97.6 scores without weight coverage. The special-teams combination similarly renormalizes away missing components (`:261-278`). D9 identifies the final offense/defense fallback, but misses the earlier within-side loss of meaning.

**Fix/test:** compute the eligible finite cohort separately for each stat and expose its size. Suppress a stat with no valid comparison peers; choose any stricter minimum explicitly rather than silently borrowing the ratings' 20-peer threshold. For composites, define required inputs or a visible partial-score policy with retained weight coverage and versioned meaning. Test full input, one missing stat, one missing side, and supported zero. A minutes floor alone does not fix these defects. Position splitting remains an owner choice, not a mathematical necessity established here.

### A4. P1, conditional rebuild path: feature-version collisions corrupt game and rolling aggregates

`update-nhl-xg-aggregates.ts:70-112,394-407` restricts model version, but feature version is optional. The pure builder keys game rows by version, then groups rolling rows by entity only (`aggregates.ts:468-475,521-528,572-579`). More severely, it drops model/feature identity when building `flurryAdjustedByEvent` (`:632-643`).

Executed fixture: one game/event/player, same approved model, feature v1 xG **0.25**, feature v2 xG **0.50**, no flurry sequence.
- v1 game/rolling row raw ixG is 0.25 but its flurry-adjusted ixG is **0.50**, copied from v2.
- v2 rolling row reports **two games**, raw ixG **0.75**, flurry-adjusted ixG **1.00**, though there is only one unique game.
- Team and goalie rolling outputs have the same partition flaw.

A separate two-season fixture produces a 2026–27 row with two games and 0.50 ixG from one game in each season, confirming D1's season issue. The default route only proves multi-feature input is allowed, not that it currently exists in production. Cross-model mixing is possible in the pure builder but the named route filters model version, so do not label it a demonstrated route failure.

**Fix/test:** either require a single validated model/feature/season partition at admission, or partition all processing, including flurry survival and event lookups, by the full identity. Count unique qualified games, not versioned rows. Add input-order invariance, no-flurry adjusted=raw, version-isolation, and season-window tests. Check duplicate identities before any upsert. This belongs in the D1 rebuild plan; no rebuild is authorized here.

## 3. D5 playoff readers: retain the diagnosis, qualify the completeness promise

Source confirms the direct selected-stat reader only filters player and `season`/`season_id`, with neither canonical game identity nor game type in its returned rows (`fetchWigoPlayerStats.ts:478-620`). The saved stubbed-query fixture returns both regular-season and playoff-dated rows under one season. Its query trace contains no game-type predicate. The shared WGO calendar adds `games_played=1` and deduplicates valid game IDs, but still does not validate season identity/type (`:925-968`). This is a real reader inventory extension to PR-SQL-3, not fixed by changing season views alone.

Two qualifications matter:
- The audit's 99/67 example, current-season row counts and older WGO identity contamination are inherited reported evidence, not reproduced DB measurements here. The query fixture proves selection behavior, not actual production prevalence.
- Existing **rows** with null values remain gaps; entirely **absent NST rows do not**. `fetchPlayerGameLogForStat` returns only fetched rows, and `WigoComparisonMatrix.tsx:217-232` passes those directly to `gameLogMean` and the selected-stat chart. There is no join to the shared WGO appearance calendar. Do not claim all missing games already occupy a chart slot. Reconcile to the qualified game ledger first, then preserve null gaps. The PPG/TOI/Game Score shared-calendar paths and this selected-stat path require separate tests.

`sanitizePercentileCohortGp` cannot repair postseason rates by changing only GP. Retain it as a diagnostic if desired, but do not treat a plausible GP or equal source GP as proof of equal game coverage.

## 4. Disposition of the original findings

| Original item | Disposition |
|---|---|
| D1 rolling xG | Confirmed; attribution/zero-fill and team/goalie blanket claim corrected in C3; add A4 version isolation. |
| D2 ranks | Confirmed by execution; shared-object mutation and actual-tie order clarified in C4. |
| D3 minutes floors | Confirmed absent from code; target GP exemption and provider-GP semantics clarified. Reported PP/PK counts not re-queried. |
| D4 team percentile composite | Confirmed with complete 32-team fixture. Preserve the owner-approved 90% coverage rule; the ordinal error does not invalidate that separate policy. |
| D5 playoffs / GP sanitization | Confirmed selection mechanism; see section 3 for absent-row and historical-evidence limits. |
| D6 approval | Confirmed and strengthened by C2. Not a deployed-model or production incident claim. |
| D7 explorer | Confirmed, corrected to reachable historical default; bounded preview and exact cutoff also matter. |
| D8 rich rebound offline | Retain as research tooling and inherited proven bug. Re-read chunked caller and `(eventId)` possession map; did not rerun training or refit artifact. `promotionAuthorized:false` limits reach, not validity of quoted research. |
| D9 rating definitions | Retain overall fallback/dormant-final qualifications; correct shrinkage continuity; add A3. |
| D10 tier bands | Confirmed overlapping/uncovered ranges; preserve intended round labels when repairing. |
| D11 writer support | Confirmed source mismatch/PP-share issues; add A1 and A2. The 67/66 GP example does not bound the ratio error or prove “small”; the missing game's numerator contribution is unknown. |
| D12 percent DIFF | Confirmed as relative percent change, not an arithmetic bug if labelled that way; do not infer the user chose percentage points. |

Unchanged or bounded conclusions: M-WIGO-004 / M-HLP-003 mid-rank arithmetic is correct for finite, prefiltered inputs; the bug is in cohort admission, not its formula. PPG/consistency/rolling-mean arithmetic and percentage formatting are not refuted, but inherit calendar/source coverage. M-WIGO-012 is specifically withdrawn as universally sound. M-XG-069 tracking alignment and M-HLP-001 generic math remain dormant by the audit's/source import scope, not production performance certifications. Covered-by entries retain their prior audit/review qualifications; this review does not recertify all inherited SQL/parity findings independently.

## 5. Verification and fix-plan handoff

**Passed:** saved offline bug-reproduction harness, using unchanged source modules and verbatim extracted unexported calculation blocks. No route/CLI body was executed. The panel fixture executes its actual `useMemo` callback, not a browser render. The writer fixture executes the actual seasonal calculation block, not a database write. Full fixtures and source hashes are in:
- `w3-xg-wigo-helpers-fixtures.cjs`
- `w3-xg-wigo-helpers-fixtures.json`

Run from repository root:
`node tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-xg-wigo-helpers-fixtures.cjs`

**Passed:** 10 existing Vitest files, **146 tests**, with synthetic Supabase environment values and mocked source readers. First batch: aggregates, calibration, xG explorer, WiGO ratings, aggregate/game-log reader, percentile fetcher/panel and WiGO writer (116). Second batch: team-driver model and component (30). Log: `w3-xg-wigo-helpers-tests.log`. The first command named a nonexistent `teamPerformanceDriverModel.test.ts`; it matched eight real files, not nine. The actual team-driver tests were located and run separately. Expected mock-source-error diagnostics appear in the passing log.

**Harness setup corrected before success:** initial relative root was one directory too high; the extracted exported benchmark function also needed an `exports` object in its VM context. These were review-harness fixes, not application failures. No application source or environment file was modified/read by the harness. Passing existing tests does not clear the counterexample fixtures.

**Not run:** production/DB validation, provider requests, application build, full suite, live browser render, model training, aggregate rebuild. Current deployment and reported DB prevalence remain unverified. Documentation-only delivery does not warrant those actions.

Priority for consolidation:
1. Correct the Lab reach statement and add reader/source coverage to the displayed-number lane.
2. Repair seasonal metric support and the reader's null-rate revival together (A1/A2); include comparison table, DIFF and chart references.
3. Repair stat-specific panel peer support and visibly define partial ratings (A3), coordinated with the owner choice on strength minutes/position.
4. Put the unapplied-calibrator acceptance and malformed benchmark contract into the xG release-gate lane (C2).
5. Add feature/version identity to the xG aggregate rebuild prerequisites (A4), alongside exact game-ledger support, empty-net separation and consumer-specific old-row handling.

Keep decision 5 in force. This review neither authorizes champion demotion nor a rewrite of stored aggregates, migrations or deployment. Review artifacts are the only deliverables changed.

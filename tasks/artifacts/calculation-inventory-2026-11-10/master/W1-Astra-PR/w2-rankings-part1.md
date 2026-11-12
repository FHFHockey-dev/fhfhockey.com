# Independent peer review: W2-4 rankings, part 1

Reviewed 2026-11-11 on Tim's Mac, `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `68d907dc20e186f974509a590be49424d0b994a0`. Target: Fable's audit commit `576dc57a38511520238f24d102e95269796a24eb`, `../audits/rankings-part1.md`, M-RNK-001–060. The relevant application files have no changes between that audit commit and this review's HEAD. Owner decisions 1–68 and both Wave 1 consolidations govern this review. Original audits, other reviews and application files are unchanged.

## Decision

**Accept the main diagnoses, but do not use the audit unchanged as an implementation specification.** Independently reproduced the goalie GSAA/60 factor, last-N count/rate mismatch, xGA sample-exposure mismatch, broken luck baseline, composite formatting/rank inconsistency and stale default season. The heuristic team-xG lineage and mixed-source fallback are source-confirmed. The original verdict tally is not independently certified.

Important changes for consolidation:

1. **M-RNK-042 is a demonstrated wrong game count, not just an undesirable heuristic.** A valid three-appearance history spanning two seasons is reported as 20 games. Fixing the matrix TOI denominator to N, as D8 proposes, would still be wrong.
2. **Withdraw M-RNK-057's asserted inheritance of the PP-share defect.** PP points/60 uses the player's PP ice time; the upstream bug concerns reconstructed *team* PP ice time. Replacing this denominator with the team clock would introduce a new error.
3. **A correct xG source is not enough: require matched team-game coverage.** The live primary aggregation accepts partial fields and incomplete game sets as complete totals. Its NST alternative rejects null fields in returned rows, but does not establish that every eligible game was returned.
4. **The MCM weighted score already explicitly disclaims being a percentile.** A mean above 50 is not itself a mathematical defect. The UI and Offense/Defense scale contracts are wrong; do not “fix” the MCM formula or BEAST thresholds solely to make the population mean 50.
5. **Composite rank changes when the user reverses sort order.** An actual mocked surface build changes the 80-score player's rank from 1 to 2, while the displayed “percentile” stays 80. Sorting and the definition of quality rank need separating.
6. **Do not interpret negative cross-sectional luck correlation as an algebraically reversed sign, or league-wide net-luck cancellation as model validation.** Both proposed conclusions require narrowing; reproducible counterexamples follow.

**Evidence boundary:** no production DB reads/writes, provider requests, application requests, browser session, cron invocation, app edits, migration, deployment, commit or push. “Live” below means a reachable source path, not a newly observed production page. All Fable production counts, dates, distributions and correlations remain reported observations, not independently refreshed measurements.

## Verification receipt

Nine existing isolated Vitest files passed: **196 tests** in 1.04 seconds. Tests used explicit inert Supabase settings; a temporary Node preload disabled fetch, HTTP(S), net and TLS connections, and was removed afterward. The passing tests do not refute the defects: several fixtures encode the incorrect units.

From `web/`, with those safeguards:

```sh
./node_modules/.bin/vitest --run \
  lib/rankings/skaterWindowAggregation.test.ts \
  lib/rankings/resultsLuckIndex.test.ts \
  lib/rankings/resultsLuckSources.test.ts \
  lib/rankings/rankingCalculator.test.ts \
  lib/rankings/playerMatrix.test.ts \
  lib/rankings/goalieMatrix.test.ts \
  lib/rankings/teamMatrix.test.ts \
  lib/rankings/skaterCompositeWriter.test.ts \
  lib/rankings/rankingUrlState.test.ts
```

Additional synthetic fixtures executed actual source functions through installed TypeScript's in-memory CommonJS transpiler. Supabase and unused I/O functions were replaced by throwing stubs. Private helpers were exported only in the in-memory source string, never by editing an application file. The composite-sort fixture called the actual `buildPlayerMatrixSurface` with synthetic ranking surfaces and table rows. No full app suite, build, typecheck or lint was warranted or run for this document-only review.

| Executed fixture | Current output | Expected interpretation |
|---|---|---|
| GSAA −0.39, NST TOI 48.05 minutes | −29.219563 GSAA/60 | −0.486992716 per 60 minutes |
| Identical 20-game set: G 6, ixG 4, TOI 18,000 s | Season GAx 2; last-20 GAx 0.4 | Counts should agree at 2, or both deliberately be labelled rates |
| 40 GP, 550 s/game, on-ice xGA average 0.5 | xGA/60 3.272727; sample TOI 550 | Sample exposure is 22,000 s, subject to matched coverage |
| Three lifetime appearances, two this season, 900 s/game, last-20 TOI 2,700 s | Aggregation GP 20; matrix TOI/game 1,350 | Actual GP 3 and TOI/game 900 |
| Same current and preceding 20-game production rates | Results Luck 65, `canPublish=true`, no warnings | A genuinely matched baseline gives neutral 100 under this index design |
| Only goals percentile 80 / only blocks percentile 80 | Offense 80 / Defense 80 | Confirms silent partial-component reweighting |
| Actual matrix build with MCM scores 80 and 20 | Desc: 80 is #1; asc: 20 is #1 | Quality rank should be stable, or explicitly labelled display position |
| Empty rankings URL / explicit `season=20262027` | 20252026 / 20262027 | Missing-season default is stale; explicit selection works |
| Two team games, one missing xGF | Fin Luck 4, Save Luck −2, net 2, event rate 2 | Full-window xG-derived metrics should be unavailable or explicitly partial |
| PP zero own TOI and zero team share | Own TOI 0; reconstructed share components null | Distinct denominator paths; PP points/60 is not a team-share rate |

## 1. D1: GSAA/60 is wrong; retain the aggregate-GSAA repair, reject heuristic unit detection

**Scope:** M-RNK-011/013, live goalie matrix. P0 under the audit's user-visible-number definition, with production prevalence taken only from Fable's dated sample.

The local chain is explicit:

- `web/pages/api/v1/db/update-nst-goalies.ts:114-116,478-497` maps NST `TOI` to `toi` and parses the decimal number without a unit conversion. The writer adds identity and upserts that same row at `:548-567`.
- `supabase/migrations/20260716112908_production_schema_baseline.sql:9704,9997` projects `n5c.toi` unchanged from `nst_gamelog_goalie_5v5_counts` into the unified column. This is the committed schema evidence, not a read of the currently deployed definition.
- `web/lib/rankings/goalieMatrix.ts:727-732` sums it into the misleadingly named `nst5v5ToiSeconds`; `:621-624` multiplies GSAA/that value by 3,600. `:1450-1455` emits the raw value, formatted value and its ranking.
- Existing tests use 3,000 in the NST field (`goalieMatrix.test.ts:166,189` and others), so they establish a seconds-valued mock contract rather than the minutes-valued source contract.

An actual `aggregateGoalieGameRows` → `metricValue` fixture with −0.39 GSAA and 48.05 minutes produces −29.219563. Converting exactly once gives −0.486992716. Fable's six November 5 rows corroborate the source-unit interpretation, but those rows were not reread here.

**Two fixes, not one.** Owner decision 10 also forbids summing game-level GSAA. With daily league save rates L_j, that sum is `Σ SA_j·(1−L_j) − Σ GA_j`. The required aggregate is `Σ SA_j·(1−L_window) − Σ GA_j`; their difference is `Σ SA_j·(L_window−L_j)`. Converting minutes fixes units, not this baseline error. The matrix Value Signal consumes the summed count (`goalieMatrix.ts:609-613`), so it needs the aggregate-baseline correction too, but not a 60× count correction.

**Qualification to “rank unaffected”:** pure positive rescaling preserves order before rounding. It is not a promise about the complete repair: replacing mixed daily baselines with a matched aggregate baseline can change relative order. Rounding can also merge ties. Test those changes independently.

**Do not implement D1's proposed “seconds must be at least 200” rule.** A legitimate short relief appearance violates it. Numeric magnitude is not a unit tag. Use an adapter with declared input/output units, exact examples including a short appearance, zero exposure, partial source coverage and appropriate overtime scope. A bound can be an alarm, not the conversion rule.

**Follow-up reader checked:** `web/lib/ratings/playerImpactRatings.ts:303,328-341,395-404` does not divide by `nst_5v5_counts_toi`. It uses official TOI and either the provider's per-60 rate or a count fallback. Do not copy the matrix's factor fix there. Its all-strength/5v5 fallback mixing and summed GSAA remain separate problems. Likewise, the committed season goalie view repeats the 3,600/minutes expression (`...production_schema_baseline.sql:11402-11404`); include it in dependency verification before any eventual repair, without asserting that this committed definition is the currently deployed view.

## 2. D2: heuristic xG is confirmed; source replacement must include coverage and model-specific provenance

**Scope:** M-RNK-004/005/033. Live reader; occurrence of mixed sources and incomplete production coverage was not measured.

`web/lib/underlying-stats/teamStatsSummaryRefresh.ts:489-514,657-679` uses the danger-bucket constants and goal-dependent floor, then accumulates that xG. `web/lib/rankings/teamMatrix.ts:1204-1228` reads those stored summaries; `:1398-1402` filters to the selected regular-season game identities; `:1425-1442` falls back to NST only for a team with no primary aggregate. The aggregate flows to xGF%, xG per Fenwick, xG events/game and luck via `teamStyleMethodology.ts:120-227`. This is an additional reader of the already-owned heuristic-xG defect, not a new independent xG-model discovery.

Decisions 6/12 support using labelled, qualified NST inputs or withholding the affected metrics. They do not authorize using the known heuristic until convenient, silently substituting sources by team, or treating “same table” as proof of same model/window.

### A1. Additional P1: partial team totals are accepted as full-window evidence

`teamMatrix.ts:607-616` omits missing values from each sum independently. `:780-798` counts every returned game but sums xGF, xGA, GF, GA and FF independently. Two rows, each GF 3 / GA 2 / FF 20, with xGF `(2,null)` and xGA `(1,1)`, produce:

- `gamesCount=2`, GF 6, GA 4, xGF 2, xGA 2, FF 40;
- Fin Luck 4, Save Luck −2, net 2;
- event rate `(2+2)/2=2`.

All are accepted numbers despite incomplete xGF. The missing numerator does not remove its game, goals or FF. The test demonstrates a conditional defect on a reachable path, not that current summary rows actually contain nulls.

The NST branch has a useful stronger field check (`:1029-1038`): null/negative fields invalidate that field's returned-row total. Preserve it. It still cannot detect an *absent row for an eligible game*. Neither branch compares its actual game coverage against the complete selected team-game population. A one-game aggregate can block fallback for a team missing the rest of its requested season.

**Required remedy:** define the eligible game ledger, join one source/model to that ledger, and either require complete matching numerator/denominator coverage or expose a specifically labelled covered subset. Count source gaps, show source/window dates, and keep missing metrics unavailable. Test missing row, missing xGF, missing FF, asymmetric opponent coverage, duplicates and a team with only one of several required games. A source-name assertion alone is inadequate.

### Corrections to the net-luck and calibration claims

League-wide `Σ Fin Luck + Σ Save Luck = 0` is a useful paired-record identity because every team's GF is its opponent's GA and its xGF the opponent's xGA. It is true even if every shot receives completely wrong xG. It is **not** evidence of calibration, and on arbitrary team-specific last-N windows the paired-game prerequisite need not hold.

A level bias does not generally cancel in each team's net luck. Fixture: GF 3, GA 2, xGF 2, xGA 1 gives net 0. Multiplying both xG figures by two gives net −1. Exact cancellation holds for a common additive error on that team's two sides, not for arbitrary heuristic bias. Fable's 87% excess, 568 team-games and ±31-goal averages are its 2026-11-10 aggregate, not a newly verified magnitude or an order-change estimate.

## 3. D4/D6/D8: repair counts, exposure and window membership together

### Retain D4's count/rate defect

`web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2854-2879` puts a pooled ratio in both `_total_lastN` and `_avg_lastN` aliases. `web/lib/rankings/skaterWindowAggregation.ts:314-321,417-430` reads those aliases as counts for GAx and unrealized xG. Season reads real count fields (`:303-311`). The executed identical-game-set case gives 2 goals above expected in season and 0.4 in last-20. These are different units, not rounding.

Affected consumers include ranking values, composite finishing (`skaterCompositeWriter.ts:347-350`), and luck (`resultsLuckSources.ts:105-123`). The select list explicitly requests the old aliases (`rollingRankingSelectFields.ts:22-30,70-78`). Change producer support fields, selectors, both consumers, stored-snapshot readers and tests as one unit contract. A writer-only rename is not a fix.

Do not infer counts merely by multiplying the rate by a generic window TOI. The prior rolling peer review proved different metrics can have different admitted observations; season support pairs can also differ from the rate's paired exposure. Carry actual count/exposure pairs and metric-specific coverage. A season/last-N equivalence test must explicitly freeze an identical game/strength/coverage set.

### Retain D6, qualify the proposed multiplication

`skaterWindowAggregation.ts:310,377-387,553-557` uses season average TOI for the raw xGA/60 ratio **and** passes it as sample TOI. With 40 GP and 550 s/game, the source returns sample TOI 550 rather than 22,000. The raw xGA rate can still be correct if both averages have the same coverage; the gate is wrong regardless.

Multiplying average TOI by GP is acceptable only when that GP counts the observations behind the average. Prefer matched stored exposure. Keep the 40-GP example, but distinguish the fixture's chosen 1,200-second floor from the current configured floor. Correcting a physical unit does not decide the scientifically appropriate publication/confidence threshold.

### A2. Upgrade M-RNK-042: the last-N GP heuristic fabricates a full window

At `skaterWindowAggregation.ts:243-264`, missing last-10/20 average TOI triggers this inference: if window TOI exceeds current-season TOI by 5%, return N. That does not prove N appearances exist.

Executed fixture: two current-season games at 900 s each plus one prior-season game at 900 s; the player has only three eligible appearances. `toi_seconds_total_last20=2700`, `toi_seconds_avg_season=900`, season GP 2, and no last-20 average. The function reports **20 GP**, because 2700 exceeds 1890. A min-GP gate of five can therefore be met by only three appearances. With the ordinary 300-second exposure floor, `getSampleConfidence` would label this inferred sample high at minGP five (`rankingCalculator.ts:208-228`). This is a real logical defect, not an empirical claim about its frequency.

The separate matrix helper `playerMatrix.ts:649-668` instead divides by current-season GP and returns **1,350 s/game**. D8's suggested `TOI/N` would return **135**, also wrong. The correct answer is **900**.

**Remedy:** persist actual selected-window observation counts/membership alongside matching totals. Support an incomplete last-N history without fabricating missing games. Test: fewer than N lifetime games, cross-season partial history, a full cross-season N, missing observations, short special-teams participation, and current-season mode if chosen. Owner decision 61 applies specifically to sustainability; extending its two-view product policy to rankings remains a reasonable question. Neither policy justifies an incorrect denominator.

### Withdraw the stated M-RNK-057 dependency

`skaterWindowAggregation.ts:96-103,464-471,495-503` computes PP points divided by **player PP TOI**. That producer is `fetchRollingPlayerAverages.ts:1140-1145,1469-1472`; `rollingPlayerPpShareContract.ts:84-98` preserves a known zero own TOI and falls back to WGO own TOI. The separate share path (`fetchRollingPlayerAverages.ts:1130-1137`, `rollingPlayerPpShareContract.ts:65-81`) reconstructs **team** PP time through `resolveShareComponents`.

Actual helpers return own TOI **0**, but share components **null**, for player TOI 0/share 0. A one-point/120-player-second window returns **30 PP points/60**, correctly, whether other games had zero PP participation. Zero-player-PP games add zero to this denominator; their omitted team PP time is not required for a player-PP scoring rate.

Therefore W1-3 D6 does **not** establish M-RNK-057 is wrong. Withdraw that causal claim rather than globally certify the metric: independently matched PP points/TOI coverage, source units and season-average reconstruction still require qualification. Never replace its player denominator with team exposure as the “fix.”

## 4. D3: broken baseline confirmed, but do not reverse the index to repair it

**Scope:** last-N published Results Luck cohorts and their readers. Current-season publication scarcity and the 61-row historical distribution remain Fable's dated findings. This is not globally dead code merely because one season cohort has no values.

The producer passes a rate difference as current and subtracts those rates from season counts (`resultsLuckSources.ts:105-123,175-188`). Presence of seven finite derived values certifies `baselineWindowExcluded` (`:155-165`); no game-membership check exists. Its date query uses exact `game_date=snapshotDate` (`:261-267`), unlike the all-player latest-appearance composite population, so idle players are omitted from luck source coverage.

**Executed neutral fixture:** current 20 games: G 6, ixG 4, TOI 18,000 s, attempts 100. Preceding 20 games: exactly the same. Season counts: G 12, ixG 8, attempts 200. On-ice and IPP current/remainder ratios are also held equal. The current GAx alias is 0.4; the bogus remainder is `12−1.2−(8−0.8)=3.6`. That component clamps to 0, the other three score 100, and the actual index publishes **65**, without warnings. Correct matching GAx rates are 0.4 versus 0.4, neutral 100.

**Narrow “inverted.”** `resultsLuckIndex.ts:151-153` is increasing in current minus baseline. Holding baseline fixed, raising the current component does not decrease it. Even holding season difference fixed in the bad alias subtraction gives a positive slope before clipping. The reported −0.449 cross-player correlation is an alarm compatible with confounded season totals, not proof the arithmetic sign is globally reversed. Multiplying by −1 or reversing rank would not repair the incompatible units/exposures.

Decision 23 settles count-derived, matched per-60 GAx comparison; decision 34 requires pre-window baseline information. Match observations and establish the baseline cutoff, including source receipt timing for historical claims. Do not treat `season GP >= N` or non-null differences as proof.

D3's sentence “every signed component is (G−ixG)/TOI” is too broad as a literal recipe. The present `sax_percentage` component is explicitly a percentage-point difference (`resultsLuckSources.ts:190-214`), not another GAx/60. Align each retained component to a declared, matched unit, or replace the composite under an explicit design decision; do not accidentally duplicate the GAx component. Owner decision 17 already fixes xS% to Fenwick. The existing Fenwick helper also defines SAX as `(G−ixG)/iFF×100` (`xgDenominatorSemantics.ts:45-54`), so label that definition rather than silently comparing ordinary SOG shooting percentage to Fenwick xS%.

**Acceptance:** the equal-rate, unequal-exposure and partial-cross-season fixtures must fail closed or produce the specified neutral rate comparison. Add unequal component coverage, known zero versus missing, and zero-baseline IPP cases. A monotonicity test alone can pass the current bad implementation. The UI test must cover both the tile and sort payload: `playerMatrix.ts:884-888` clamps a tile to 100, while `:1341-1342,1370-1372` emits the raw composite/index under the sort percentile field.

## 5. D7: distinguish score design from mislabelled output, and keep rank independent of sorting

**Confirmed:** Offense and Defense call weighted averages that silently renormalize over available subcomponents (`skaterCompositeWriter.ts:145-167,333-381`). Actual one-component fixtures return 80 for goals-only Offense and blocks-only Defense. MCM refuses missing required inputs (`:388-396`). The 1 GP/300 s durable-key gate is explicit (`:734-739`); hiding low-sample cells later (`playerMatrix.ts:846-869`) does not recompute the population that supplied their component percentiles.

**Correction to MCM criticism:** `skaterCompositeMethodology.ts:73-100` already names a `weighted_score_0_to_100`, describes the six/seven-input difference and says it is *not* a percentile or calibrated future-fantasy prediction. The top-two/max construction can intentionally reward category strengths. The independent-uniform expectation in Fable is a valid hypothetical calculation, not a population centre requirement; actual percentiles have ties and correlated inputs. A sample mean/median around 59/62 is not itself a wrong formula or evidence that 20% tiered is too many. Keep those observations dated and methodology-version-specific.

By contrast, Offense/Defense explicitly claim `percentile_0_to_100` (`:9-38`), and the matrix reuses scores as percentiles (`playerMatrix.ts:884-891,1341-1342`). `PlayerMatrixTable.tsx:129-146` prints and colors them with percentile formatting. These are concrete contract/presentation defects. The audit's suggested all-inputs-50 test is useful arithmetic but does not demonstrate percentile calibration: it passes today.

### A3. Promote the existing rank-direction observation into an actionable reader correction

The actual matrix builder negates composite values whenever `sort_direction=asc` (`playerMatrix.ts:1091-1107`), recomputing rank rather than just reversing row order. It exports that rank at `:1337-1347,1365-1378`, and the table renders it as “Rank” (`PlayerMatrixTable.tsx:373-381,517-528`). Ordinary metric ranks come from the underlying fixed ranking rather than this composite-only reversal.

Actual `buildPlayerMatrixSurface` fixture with published MCM scores 80 and 20:

- Descending: player 1, score 80, rank 1, “percentile” 80; player 2, score 20, rank 2, “percentile” 20.
- Ascending: player 2, score 20, rank 1, “percentile” 20; player 1, score 80, rank 2, “percentile” 80.

**Remedy:** define metric quality direction once and compute stable quality rank independently of display ordering. If the product wants sorted-list position instead, call it that and apply it consistently rather than presenting it beside a percentile. Results Luck needs its own “hot/cold” semantics, not an unqualified “better” direction. Keep score, rank and percentile as separate fields. Test ascending/descending, ties, nulls, sample filtering and pagination using the actual surface builder, not only the generic rank helper.

**Publication policy:** choosing a score versus a re-percentiled composite, supported minimum exposure and whether to expose labelled partials are legitimate owner questions. Missing data must remain visible under either choice. If re-percentiling, keep the underlying score separately: existing BEAST thresholds operate on the unrounded weighted score and are not automatically percentile thresholds (`skaterCompositeWriter.ts:406-425`). Do not silently reuse 70/80/88 on a new scale.

**Narrow the stale-player claim:** `skaterCompositeSourceCoverage.ts:22-25,69-79,122-134` deliberately requires the latest observed regular-season appearance for every expected player. A player who has not played recently is not necessarily a failed recomputation. For a last-N-appearance statistic, old calendar dates are a freshness/context issue, not automatically an incorrect window. Retain player-specific dates and distinguish inactive players from a rolling row that failed to catch up to a newer actual appearance. Do not turn calendar-day decision 18 into an unapproved last-N exclusion rule.

## 6. D12 is source-proven, including Reset; D10 needs reader-specific stale-data handling

**Default season:** `rankingUrlState.ts:98-108,330-352` defaults to 20252026; `pages/rankings.tsx:1261-1291` normalizes the query and builds skater, goalie, team and other tab requests from it. Reset uses the same constant (`:1594-1600`). Actual normalization returns 20252026 for `{}` and preserves explicit 20262027. The claim need not remain “if no override exists”: that source chain is established. No browser or network request was made, so do not claim an observed production page.

Use a single current-season resolution policy for first load, API defaults where applicable and Reset. A seasons table may contain future seasons: “max season id” is not a sufficient implementation. Define active season/offseason behavior, preserve explicit historical URLs, and test rollover and a failed/missing season lookup. A mocked clock test is only meaningful if the chosen resolver actually uses that clock.

**Ratings readers:** Fable's latest March 8 snapshot is reported evidence, not a fresh all-table census. Source behavior differs:

- `web/lib/underlying-stats/entityRatingsOverlay.ts:66-107,114-137` fetches by player IDs with no season or as-of predicate, independently chooses the latest offense and defense rows, then exposes only one preferred snapshot date. This can overlay an old rating on a current season, or a later rating on a historical page. It can also conceal differing offense/defense dates. Add explicit context/date selection and per-field provenance, not just a scheduled refresh.
- `web/lib/game-predictions/featureBuilder.ts:2675-2707` already requires `snapshot_date < sourceAsOfDate`, but has no age floor or season restriction there. Do not remove that useful cutoff or claim it has the same latest-any-date selection as the overlay. Date ordering still does not prove original pregame issuance for a backfilled record.
- `web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts:83-98` limits the latest ratings query to the requested season when one is supplied. With no eligible current-season snapshot, prior-season availability should not be assumed. Its arbitrary historical snapshot application remains a separate issue to qualify before predictive use.

A producer refresh is not a complete remedy for these selectors. Keep unserved game-model paths distinct from observed page overlays and do not activate them as part of this audit.

## 7. Disposition of other high-impact claims and remaining decisions

- **xS%/SAX denominator, D5:** confirmed from the producer, not merely inferred from a shots ratio. `fetchRollingPlayerAverages.ts:1207-1217` uses `counts.icf`; the ranking consumer divides by that alias (`skaterWindowAggregation.ts:391-413`), while `metricDefinitions.ts:545-576,580-610` asserts verified Fenwick provenance. Decision 17 is settled. Replace the wrong provenance as well as the denominator. The assumed 25% blocked share is not a measured correction factor.
- **Quality Start, D9:** retain the source contradiction: `splitsServer.ts:825-831` uses a fixed .910 plus a shots-based exception, unlike decision 40's shared season/scope-aware contract. Six NHL flags away from boundaries cannot establish equivalence. Test credited starts, exact boundaries, low shots and missing league average; do not “fix” it simply by relabelling it NHL QS while still calling it Quality Start elsewhere. RBS/Steal naming remains separately open.
- **Goalie blended signal:** weighting two count measures is not inherently invalid arithmetic. Establish the intended FHFH measure, distinguish workload from rate and disclose inputs. Its completeness guard should be preserved. xGA/SOG is likewise not automatically a probability or an average over the xG shot universe; if meant as shot-quality per attempt, choose and label the appropriate denominator.
- **Percentile convention:** the exclusive-below convention is internally explicit (`rankingCalculator.ts:84-142`). Ties/singletons need clear interpretation. Do not replace it with mid-rank merely because another route has a genuine lexicographic-sort bug.
- **Confidence/sample floors:** “high” at twice a small threshold is an unvalidated evidence label, not a calibrated probability. Owner sample choices should be separated from empirical reliability validation. GP, exposure and peer count should be accurate before selecting replacement thresholds.
- **Not recertified:** all 60 inventory entries, dormant percentile route reach, deployment summaries, adjusted-impact promotion, team-unit generation, every legacy SQL dependency and all operational writer schedules were not exhaustively re-audited. Original caveats remain. No deletion follows from a dead/dormant classification.

Owner questions still useful: composite score/percentile presentation and partial-input policy; qualified cohort/sample design; rankings current-season versus cross-season views; count/rate meaning of GAx outside the already-settled luck contract; goalie mixed-strength presentation; deployment-window policy; separately named RBS/Steal semantics. Do **not** reopen the settled NST headline, Fenwick xS%, aggregate GSAA or matching/pre-window exposure requirements.

Before implementation, enumerate the raw, snapshot-first and composite readers, reconcile stored methodology versions, and define any bounded data-repair plan separately. Fable's `_v1` stored cohort versus `_v2` code is an unresolved provenance observation; it is not permission to rebuild or proof the current source formula generated those stored distributions.

## Fixture reproduction details

The following identifies the exact synthetic inputs and calls used, without requiring a database or provider. In `web/`, load modules with `typescript.transpileModule` using CommonJS/ES2020 and `esModuleInterop`; recursively resolve only local imports. Stub `lib/supabase/server` to throw on `from`/`rpc`; stub ranking-query/snapshot loaders and the composite coverage loader to throw. Export `metricValue` and `allStrengthsToiPerGame` by appending in-memory export statements. Do not invoke a writer or fetch function. Disable network entry points as in the verification receipt.

1. **Goalie:** call `aggregateGoalieGameRows([row], 'season')`, then `metricValue(aggregate,null,'gsaa_per_60')`. Row: player/team 1, date `2026-11-05`, GP/starts 1, WGO saves 27, SA 30, GA 3, TOI 3600, QS/wins 0; NST TOI 48.05, GSAA −.39, xGA 2.1, GA 2, SA 25, saves 23, HD saves 3/SA 4. Compare with `-.39/48.05*60`.
2. **Shared skater row:** player/team 1, season 20262027, date `2026-11-05`, strength `5v5`, all three season/participation/games fields 20, average TOI 900, last20 TOI 18000, goal-rate alias 1.2, ixG-rate alias .8, season goals 6, season ixG 4, average on-ice xGA .5. Call `buildSkaterWindowAggregatesFromRollingRow` for GAx in `['season','last20']`. For xGA exposure change participation GP to 40 and average TOI to 550 and request season xGA/60.
3. **Three-game window:** same row, season/participation GP 2, last20 TOI 2700, no last20 average. Request last20 GAx; then call `allStrengthsToiPerGame({season_games_played:2,toi_seconds_total_last20:2700},'last20')`. The stipulated actual membership is three 900-second appearances, one prior season and two current.
4. **Luck:** shared row with season/participation GP 40, season G 12/ixG 8/attempts 200, attempt-rate alias 20; current IPP points/on-ice goals 10/20, season IPP 20/40; current on-ice GF/xGF 20/18, season averages 1/.9. Feed `buildResultsLuckRollingSourceFromRow({row,window:'last20'})` into `calculateComponentAwareResultsLuckIndex`, using its components/provenance and `currentWindow:'last20'`. The two underlying 20-game windows each have G 6/ixG 4/attempts 100/TOI 18000.
5. **PP:** call `resolvePlayerPpToiSeconds({strength:'all',builderPlayerPpToi:0})` and `resolvePpShareComponents({builderPlayerPpToi:0,builderTeamShare:0})`; for PP rate use the shared skater row with strength `all`, `pp_points_total_last5:1`, `pp_toi_seconds_total_last5:120`, requesting last5 PP points/60.
6. **Partial team:** call `aggregateTeamStyleRows` with team 1/TST and game IDs 1/2 on November 1/2, GF 3/GA 2/FF 20 each, xGF 2/null and xGA 1/1. Pass its totals to `calculateTeamLuckComponents` and `calculateRunAndGunProfile`. Separately compare luck for `(GF,GA,xGF,xGA)=(3,2,2,1)` and `(3,2,4,2)`.
7. **Composite functions:** `calculateOffenseRating({goals_per_60:80})`, `calculateDefenseRating({blocks_per_60:80})`, and `calculateMcmScore` with all six non-PP components 50 at 5v5. These return 80, 80 and 50.
8. **Full matrix:** reuse the exact `rankingRow` helper in `playerMatrix.test.ts:38-84`; return IDs 1/2 for every requested metric from a stubbed `buildContextualRankingsSurfaces`. Metadata snapshot is `2026-11-05`, available, with the requested metric. Fake Supabase chains return two composite rows only for `skater_composite_ratings`, empty rows for the all-strength TOI lookup. Composite rows have player IDs 1/2, MCM and offense 80/20, defense 50, null tier/luck, identical snapshot date, and methodology `fixture`. Call actual `buildPlayerMatrixSurface(parsePlayerMatrixRequest({season:'20262027',strength:'5v5',window:'season',sort_metric:'mcm_score',sort_direction:direction,ranking_source:'fallback'}))` once each for `desc` and `asc`. Compare each player's `sort.rank`/`sort.percentile`; no real I/O occurs.
9. **Season:** `normalizeRankingsFilters({}).season` and `normalizeRankingsFilters({season:'20262027'}).season`.

All fixture runs completed successfully. No rejected operation, unresolved execution blocker or uncertain write outcome. The only saved deliverable is this review.

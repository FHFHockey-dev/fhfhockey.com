# Relationship math and meaning audit

Read-only follow-up, 2026-11-12, canonical `octoberBranch`, observed HEAD `ee2b1c19c5cfc261e5242f48a63b1eafe79091da` plus concurrent local fixes. Scope: relationship calculations before upsert, payload/persistence guarantees, and direct DRM consumers. No application edits, remote calls, ingestion, or test-suite reruns in this follow-up. Accepted canonical interval and five-game replay evidence from `CALCULATION.md` / `LIVE-REPLAY-RESULTS.json` was reused.

Subsequently Chef assigned only the proven payload chronology defect for implementation. That local fix and regression evidence are recorded at the end. Other formulas and approved legacy meanings remain unchanged.

## Findings and interpretation

### 1. Stored percentage uses a different denominator than the product's player-relative percentage

`web/pages/api/v1/db/shift-charts.ts:979–987` persists `100 × sharedSeconds / gameLengthSeconds`, formatted to two decimals. The active DRM contract instead requires player-relative shared percentages (`tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md:84`), and the visible tooltip explicitly says “of [player]'s all-strength TOI” (`web/components/DateRangeMatrix/index.tsx:568–571`). Both direct readers recompute `100 × sharedSeconds / playerTotalTOI` (`fetchAggregatedData.ts:1216–1230`, `useTOIData.tsx:792–804`).

Independent numeric case: 10 shared minutes, player A TOI 20 minutes, player B TOI 30 minutes, game length 60 minutes. Stored percentages are 16.67% in both directions; intended own-TOI shares are A→B 50% and B→A 33.33%. Symmetric shared seconds do **not** imply symmetric own-TOI percentages.

Classification: proven semantic inconsistency in the stored percentage columns; current DRM reader math is correct for its explicit tooltip. Targeted runtime searches found no reader of the snake-case persisted percentage columns outside the writer/payload/generated types. It is therefore not evidence of a current visible DRM percentage error. A future direct consumer could silently obtain the wrong denominator.

The prior independent review explicitly keeps both as valid descriptive fractions, rather than requiring either to replace the other: `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w2-lines-toi-pp-units.md:116` (D5). The original finding calls for named denominators at `master/audits/lines-toi-pp-units.md:136–138`. Preserve the existing meanings; separate names/documentation resolve the ambiguity without silently redefining history.

Bounded repair choice: align persisted `percent_toi_with*` with the documented player-relative meaning, or explicitly rename/document them as fraction of game clock if that is an independent desired metric. Do not silently assume these are equivalent. A semantic output change needs a relationship algorithm version change and corresponding historical replay policy.

### 2. Persisted inferred lines are greedy grouping, not observed simultaneous trios

`shift-charts.ts:454–502` sorts forwards by total all-strength game TOI, takes the highest remaining player as pivot, then picks the two remaining forwards with the most pairwise shared seconds **with that pivot**. It never computes three-way intersection, never uses the other two players' mutual overlap, never imposes a positive overlap threshold, and never optimizes the total grouping score. Defense pairs use the same greedy pattern at `:511–546` with one partner. Incomplete groups are still assigned a line/pair number after a warning. These numbers are inferred labels, not NHL-reported units or an official depth chart.

Executed the actual `generateTeamLogs` function in isolation, extracted from current source without changing it:

- A is on 0–20 minutes, B on 0–10, C on 10–20. A–B and A–C each share 10 minutes, B–C share zero, and three-way shared time is zero. The function nevertheless assigns `[A,B,C]` to Line 1.
- Four defensemen with descending TOI 20,19,18,17 minutes and overlaps AB=10, AC=9, BD=9, all other pairs=0 produce greedy pairs AB/CD (10 total shared minutes). AC/BD would produce 18. This is not a maximum-weight pairing solver. These overlap values are physically feasible in disjoint AB/AC/BD time blocks plus individual ice time.

All strengths feed the pair overlap score, so a PP combination can drive a label users interpret as an even-strength line. There is no ES-specific line inference here.

The direct UI adds another heuristic layer: `lineCombinationHelper.ts:19–35` explicitly labels its 4/3/2/1 line weights and 3/2/1 pair weights an FHFH presentation choice, not a fitted usage measure. It sums per-game label frequencies into `comboPoints`, selects pivots by that score, and again selects partners by pivot shared seconds (`:42–80`). More appearances can outweigh a higher average usage rank; this is a frequency-weighted presentation score. `useDateRangeMatrixData.ts:349–356` applies this one grouping to matrix and adjacent cards. Visible labels say “Forward Lines” and “Defense Pairs” (`LinePairGrid.tsx:124/:148`); they do not disclose that no three-way simultaneous line time was measured.

Classification: intended deterministic approximation at the UI scoring layer; it cannot be certified as true observed units, ES units, globally optimal units, or official lines. Owner decision107 (`tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md:328`) already defines the most-used observed 5v5 unit as the line for `/lines` and FORGE's line prior, while preserving the all-strength grouping as a labelled legacy view. That decision does not itself authorize replacing this DRM grouping. For this legacy DRM display, explicit “inferred, all-strength” labeling is the lowest-risk meaning repair. Measuring observed trios requires an actual three-way interval calculation; pair overlaps alone are insufficient.

### 3. Payload sorting is deterministic but fails chronological clock order

Canonical intervals now emit unpadded minute clocks (`ingest/shifts.ts:708–712`). `shiftChartRelationshipPayload.ts:93–99` sorts within periods using string `localeCompare`; `sortShiftSegments` at `:63–86` joins period and clock values into a string key. Thus “10:00” precedes “2:00”. Executing the actual payload builder with two segments yielded `start_times=["10:00","2:00"]`, `shift_numbers=[2,1]`, and the same reversed PP segment order.

Classification: proven payload chronology defect, currently low user impact. Parallel arrays retain alignment, every segment is present, and TOI/pairs are calculated before this sort, so totals are unchanged. No direct DRM reader uses these stored interval arrays. Sorting period values as part of the PP/ES string key also gives lexical rather than numeric order for multi-digit periods.

Bounded fix: compare numeric period, parsed start/end seconds, numeric shift number and parsed duration; preserve a deterministic final tie-breaker. Extend the existing payload ordering test. This is not an interval-union defect and does not require rerunning the accepted canonical proofs.

### 4. “Total TOI” view actually sorts by ATOI

The direct consumer's option label is “Total TOI” (`DateRangeMatrix/index.tsx:72`), but `sortByTotalTOI` parses and sorts `ATOI` (`:211–215`), called by the active matrix at `:289–290`. A player with 100 total minutes over 10 appearances (10:00 ATOI) sorts behind a player with 60 total minutes over 3 appearances (20:00 ATOI).

Classification: visible label/order semantic mismatch, separate from ingestion or persistence correctness. Either the label should promise average ice time, or the comparator should use `totalTOI`. The actual ATOI formula is sound; this finding does not justify changing it.

## Formula-by-formula assessment

Let `I[p,k]` be player p's canonical, disjoint half-open intervals in period k; `T[p]` their total length; `L` the completed physical game length; and `S[p,q]` the sum of pair intersections across periods.

| Calculation / location | Actual meaning and assessment |
| --- | --- |
| Clock parsing and formatting, route `:274–276/:308–336` | Minutes×60+seconds; sums integer seconds; formats minutes and modulo-60 seconds. Valid because the upstream canonical/strength functions validate clocks and return integer seconds. The local helpers are permissive in isolation (e.g. skip malformed duration), so they are not independent validators. Their current validated call path is the proof obligation. |
| `game_toi`, route `:742–752/:859–872` | `T[p] = Σ length(I[p,k])`. Summing disjoint canonical intervals measures physical on-ice time once per player. Previous overlap/sentinel corrections are accepted evidence, not rerun here. |
| `game_length`, route `:792–793` | Exact completed PBP terminal supplies L; regulation/OT/shootout handling belongs to `gameLength.ts` and root's separate review. Relationship percentages include physical OT duration when present and do not add shootout attempt time. |
| Player bound, route `:905–913` | Requires positive safe integer T[p] and T[p]≤L before persistence. Prevents known impossible appearance totals; it does not prove correct player identity or that upstream occupancy is complete. |
| Shared seconds, route `:928–968` | `S[p,q] = Σ max(0,min(endp,endq)−max(startp,startq))` within equal periods, same team, distinct players. Half-open touching intervals add zero. Because each player's intervals are disjoint, each shared instant is counted once. Correct all-strength shared time; it is not ES shared time or a two-/three-player unit duration. |
| Pair bound, route `:970–978` | S≤T[p] and S≤T[q]. Symmetry follows from the intersection formula. Accepted replay verified mirrored equality. Multiple partners can each have a 100% own-TOI share simultaneously, so row percentages need not sum to 100%. |
| Same/mixed bucket, route `:933–935/:981–987` | `(isForward(p)===isForward(q))`, not exact position equality. F–F, D–D, D–G and G–G are “same”; F–D and F–G are “mixed”. Both readers repeat this F-versus-non-F rule (`fetchAggregatedData.ts:366–372`, `useTOIData.tsx:280–286`); the PRD explicitly preserves it at line84. Goalie relationships are therefore included, and D–G being “same” is a deliberate legacy category, not a mathematical claim they play the same position. Goalie players are excluded from line/pair inference. |
| Persisted `percent_toi_with*`, route `:979–987` | `100S/L`, two-decimal strings. Valid fraction of game clock, wrong denominator for the current product's named own-TOI percentage; Finding1. |
| `pp_shifts`, route `:882–895` | Segments where this player's PBP-bound classifier says PP. Uses the same canonical interval boundary. No claim that these are original NHL shift boundaries. Classifier semantics are separately reviewed by the strength worker. |
| `es_shifts`, route `:883–888` | Deliberately all **non-PP** time, including PK. This is a legacy collection name, not exclusive even strength. It partitions canonical time with `pp_shifts`; its semantics differ from persisted exclusive `total_es_toi`. |
| Local `total_pp_toi` / `total_es_toi`, route `:898–904` | Sum segment durations. Local PP total means PP, local ES total actually means ES+PK. Neither is emitted by `buildShiftChartRelationshipUpsert`; the exclusive ES/PP/PK totals remain input-writer-owned. The omission is deliberate and regression-tested (`shiftChartRelationshipPayload.test.ts:51–53`), preventing the misleading local ES name from corrupting persisted strength totals. |
| Payload arrays, `shiftChartRelationshipPayload.ts:93–123` | Same sorted shift list populates shifts/shift_numbers/periods/start/end/duration, preserving index alignment. Current lexical clock order is wrong chronologically; Finding3. PP/ES ordering changes no sum. |
| GP and totalTOI, direct readers | Accumulate one validated player-game row; GP is distinct game-ID count, totalTOI is ΣT. Goalie appearances with positive ice time count, including relief appearances; this is not a starts count. `fetchAggregatedData.ts:1158–1161`; raw counterpart `useTOIData.tsx:709–711`. |
| ATOI, readers `:1244–1247` / raw `:840–843` | `ΣT / distinct GP`, then nearest whole-second formatting. Correct appearance-weighted mean, not per-shift mean, starts-only mean or TOI per scheduled team game. Rounding error at most 0.5 seconds; .5 rounds upward. No fractional seconds are discarded before aggregation. |
| Pair aggregation, aggregate `:1184–1208`, raw `:742–760` | Validate two mirrored observations, create one unordered pair/game fact, then add once to each direction. Does not double-count the two stored mirror entries. Zero observed overlap is a valid fact; missing overlap is not zero. |
| `timesPlayedWith` | Increment once for each included pair/game fact, including a zero-overlap fact. Means same-game coappearance count, not count of games with positive shared ice time. No direct displayed use found. |
| Reader `percentToiWith*`, aggregate `:1216–1230`, raw `:792–804` | `100ΣS / ΣT[p]`. Correct player-relative share over included appearances, with asymmetric denominator by direction. Ratio of sums, not mean of game percentages: a 100% share in a 10-minute appearance and 0% in a 30-minute appearance produce 25%, not 50%. |
| Reader `percentOfSeason`, aggregate `:1232–1238`, raw `:806–812` | `100ΣS / ΣL` for games where this player has included rows, same bucket only. Means share of included game clock during this player's appearances. It is not fraction of every team game or entire NHL season; name is broader than actual scope. No direct displayed use found. |
| Reader line/pair counts, aggregate `:1165–1169`, raw `:712–716` | Count assigned inferred rank once per appearance, not minutes on a real line/pair. Consumer `comboPoints` uses fixed presentation weights, not fitted importance; Finding2. |
| Visible matrix intensity, index `:307–321/:564–571` | Uses own-TOI share; divides by largest displayed pair share for opacity. Relative scale changes with the selected roster/window. Tooltip retains absolute own-TOI percentage to two decimals. This is presentation normalization, not new time or an absolute league-wide intensity scale. |

Precision: persisted integer-second durations preserve exact sums. Stored percentages `toFixed(2)` incur at most 0.005 percentage-point rounding error and do not feed present DRM aggregation. The readers calculate from seconds and round only for the visible tooltip. Do not require all partner shares to sum to 100%; several teammates can share the same ice-time second.

## Dead or non-publishing calculations

- `getPairwiseTOI` (`shift-charts.ts:384–408`) receives only `playerData.shifts` at `:999–1003`. For another player, its p2 shift array is empty, so every off-diagonal entry is zero. The computed `pairwiseTOI` matrix is passed to `generateTeamLogs`, whose parameter is unused. The actual line/pair inference reads `time_spent_with`; therefore this faulty-looking matrix currently has no output influence. Executed isolated function returned zero for the different-player call. Treat as dead misleading work, not the cause of a persisted pair error.
- `PlayerInfo.shared_toi` is populated from persisted game-denominator percentage maps at route442 but not read during grouping; grouping uses raw overlap seconds.
- The route's local ES+PK total is calculated and omitted by the payload as described above. It does not overwrite exclusive stored ES.
- In the direct UI, `avgSharedToi` (`index.tsx:299–305`) is average cumulative player TOI, despite its name; `teamAvgToi` is passed to `Cell` but unused. Self `sharedToi` uses `parseFloat` on a clock at `:471–473`, which would discard seconds, but self opacity is fixed to1 and its tooltip uses the valid ATOI string. Neither presently affects displayed numerical meaning.

## What “safe before upsert” currently guarantees

The route's validated interval boundary, scalar total bounds, real roster position resolution and same-game/team filters establish the current computed time facts. `relationshipMaterialization.ts:216–228` additionally checks nonempty scope, unique players, matching game ID and complete position classification. It binds exact input/source hashes and verifies the returned transaction receipt. The existing SQL RPC validates array shapes/cardinalities, two teams, unique players and clock-shaped total strings (`supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:2184–2204/:2250–2263`), then atomically replaces relationship-owned columns under the input-generation CAS.

That is **not** a second mathematical validator. Neither the application persistence adapter nor the SQL shape checks independently prove `game_toi = Σduration`, `PP+nonPP=game_toi`, numeric map values, map symmetry/completeness, correct percentage denominator, valid line semantics, or every bound. The route computes those values today; a success receipt proves exact supplied rows/generation and atomic publication, not their scientific or product meaning. Full database execution was not repeated here.

Recommended bounded acceptance contract, if implementation is assigned: validate computed payload immediately before persistence against integer-second interval sums, PP/nonPP partition equality, complete reciprocal same-team partner maps, S symmetry and both-player bounds, chosen percentage formula/rounding, numeric chronological arrays and position-valid inferred rank ranges. Keep semantic line/trio claims separate; no assertion can turn the current greedy heuristic into a measured simultaneous trio. Decide denominator and line meaning before changing persisted formulas.

## Evidence and limits

This follow-up ran two bounded local Node probes, with current functions transpiled/extracted in memory: (1) actual greedy grouping / dead pairwise function plus independent percentage and average arithmetic; (2) actual payload builder clock sorting. The probes establish the numeric examples above. No new application tests were added or previous suites rerun because this assignment is read-only and canonical regressions/replay already passed. No production behavior was asserted from these probes. Root and the separate strength reviewer own the PBP strength timeline, classifier, ingestion orchestration and live schedule conclusions.

## Exact intent/decision anchors

- DRM player-relative percentages, rounded ATOI, zero-aware pair facts and legacy F/nonF category: `tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md:84/:112`; implementation closure `tasks-prd-drm-refactor.md:112`. The PRD has older surrounding operational history, so only these explicit metric definitions are used here.
- Visible all-strength, own-TOI denominator: `web/components/DateRangeMatrix/index.tsx:568–571` (W2-6 D5 comment).
- Both game-clock and own-TOI fractions remain valid and need separate names: `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w2-lines-toi-pp-units.md:116`; original naming recommendation `master/audits/lines-toi-pp-units.md:136–138`.
- Exclusive ES/PP/PK with reconciliation and no historical relabelling: `master/OWNER-DECISIONS.md:201–204`, decision59. Legacy `es_shifts` collection includes PK by current explicit route comment at887–888; it must not be equated to exclusive persisted ES totals.
- Observed 5v5 unit definition for `/lines` and FORGE, plus labelled legacy preservation: `master/OWNER-DECISIONS.md:328`, decision107. Window-specific verified deployment basis/coverage and uncertain ties: `:326`, decision105. These scopes must not be silently broadened to mandate a different DRM algorithm.
- DRM pivot weights are presentation choices: `web/components/DateRangeMatrix/lineCombinationHelper.ts:19–21`; prior distinction between arithmetic and heuristic policy: `master/W1-Astra-PR/w2-lines-toi-pp-units.md:119` (D8).

## Implemented chronology correction

Authorized owned edits are limited to `web/lib/projections/shiftChartRelationshipPayload.ts` and its existing test file. The implementation imports the existing strict shift-clock parser; compares valid start/end/duration clocks numerically; compares periods and shift numbers numerically; and uses canonical JSON as a deterministic final tie-break. Missing/malformed legacy JSON segment values retain deterministic fallback ordering. The same sorted full-shift list still builds all parallel arrays. Percentage denominators, F/nonF grouping and non-PP `es_shifts` were not redefined.

Regression first: the new ordering case failed on the old payload (`10:00` before `2:00`), then passed after correction. A second case inside the same test exposed order dependence for equivalent padded/unpadded clock strings; the canonical JSON final tie-break corrected it. Final verification:

```sh
npm test -- --run lib/projections/shiftChartRelationshipPayload.test.ts lib/projections/relationshipMaterialization.test.ts
# 2 files / 23 tests passed (payload3, materialization20).
npx eslint lib/projections/shiftChartRelationshipPayload.ts lib/projections/shiftChartRelationshipPayload.test.ts
# Passed.
git diff --check -- lib/projections/shiftChartRelationshipPayload.ts lib/projections/shiftChartRelationshipPayload.test.ts
# Passed.
```

The existing materialization tests verify fingerprint order invariance and receipt behavior with the final payload change. This output-order correction can change relationship fingerprints, so Chef's planned algorithm-version bump must cover it. No remote action occurred. The Total TOI/ATOI UI mismatch remains documented as an adjacent reader issue; producer-only authorization did not cover changing it.

## Independent penalty-simulator regression lane

Subsequent assignment owns only the existing `web/utils/getPowerPlayBlocks.test.ts`; root owns the simulator implementation. Rule-derived expected clocks were written before implementation. The original team-identification opening event was moved from 05:00 to 00:01 so longer synthetic penalties do not conflict with an unrelated interior even-strength observation.

Old-simulator baseline, 2026-11-12: **26 tests, 8 failed / 18 passed**. The eight failures are penalty-shot goal releasing an unrelated minor; later same-offender penalty running concurrently; ambiguous cancellation choosing an arbitrary event-order result; two observation-resolved cancellation outcomes; protected coincidental 4v4 service slots lost; and both late Rule 19.4 difference cases. Expected values are independent service-clock calculations, not results copied from a replacement implementation.

| Scenario | Independently expected result |
| --- | --- |
| Away minor 01:00; home penalty-shot goal 02:00 (`1010`) | Home PP 01:00–03:00  = 120s; penalty-shot goals never release another minor |
| Same offender's minors 01:00 and 02:00 | Consecutive service 01:00–05:00  = 240s |
| Three distinct away offenders 01:00/01:30/02:00 | Third begins 03:00 when first slot frees; home PP 01:00–05:00  = 240s |
| Double minor 01:00; home goal 02:00 in first half | Second half 02:00–04:00; total PP 180s |
| Minors 01:00 and 02:00; home goal 03:00 | First interval already expired; goal releases remaining minor; PP 01:00–03:00 |
| Away minor 01:00; home goal 02:00 / away goal 02:00 | Home PP 60s / 120s respectively |
| Away major 01:00; multiple home goals | Major persists 01:00–06:00  = 300s |
| One offender's major + minor 03:00; home goal 08:30 | Major 03:00–08:00 then minor ends 08:30; PP 330s (Rulebook Table 12 B2) |
| Minor third period 19:00 into OT | PP ends OT 01:00 ; 120s physical clock |
| Coincidental minor pair plus another offender's minor | Only extra minor creates 120s PP |
| Home 101 major+minor,home 102 minor versus away 201 minor at 00:00 | Captain can choose parallel 5+2 (PP 300s) or serial 7 (PP 420s); no unique truth from event order alone. Without resolving evidence both permutations must throw an ambiguous-penalty error |
| Same captain-choice fixture with interior 05:30 evidence | ES 1551 selects 300s; away PP 1541 selects 420s, independently of input event order |
| Initial home/away minor pair 01:00,home 102 minor 01:30,home 103 minor 02:00 | Initial 4v4 service still occupies slots; away PP 01:30–05:00  = 210s |
| Same protected-slot fixture plus away goals 02:00 and 02:30 | Goals release eligible noncoincident minors; away PP 01:30–02:30  = 60s |
| Third period 16:00 one home major versus one away minor/doubleminor; away goal 16:30 | Rule 19.4 difference served first, not goal-terminable; away PP 180s/60s, ending 19:00 / 17:00 |
| Third period 16:00 home major versus minors to two distinct away offenders | Not Rule 19.4 one-offender exception: home PP 16:00–18:00  = 120s; away PP 18:00–OT 01:00  = 180s |
| Neutral empty-net 6v5 with no penalty | No penalty-advantage clock |

Rule anchors supplied by the independent reviewer: NHL 2026–27 Rules 16.2 / 24.6 for penalty-shot non-release; Rule 39.2(vi) for consecutive additional unsportsmanlike minor service; Table 12 B2 for major-before-minor service; Table 13 printed page 150 example 7 and printed page 152 example 27 establish captain-choice ambiguity. Root chose an explicit fail-closed ambiguity contract, retaining candidates only when interior observed manpower resolves the PP spans. This lane did not independently browse or query production.

```sh
npm test -- --run utils/getPowerPlayBlocks.test.ts
# Initial narrow baseline: 2 failed  / 15 passed.
# Expanded baseline after rule-review cases: 8 failed  / 18 passed.
```

Full-player official comparison remains a separate acceptance gate: `live-replay.json` has 190 stored/recomputed player rows but empty PBP summary objects; `OFFICIAL-CLOCK-CHECK.json` contains only 4 goalie strength records and team PP clocks. These artifacts alone cannot prove all 190 players agree with official TOI. Cached official game summaries/boxscores with identity-resolved player total/ES/PP/SH fields are needed. No new source requests were made by this lane.

Simulator green checkpoint: root replaced the implementation and reported 25/26 passing, with the intentional contradictory-situation test now correctly rejected by the fail-closed engine. This lane changed that test to expect an explicit-team disagreement error and retained standalone audit coverage by constructing the known period 3 10:00–12:00 home PP block directly. The final existing-file run passed **26/26 tests**. Scoped ESLint and `git diff --check` also passed. One intervening local run failed only because the new test's initial error-message regex omitted the actual word “disagrees”; that test assertion was corrected. No simulator implementation was edited by this lane. Wrapper qualification-contract regressions are pending root's final API contract.

### Official independent player-clock oracle

Root subsequently authorized at most five sequential public NHL ES report reads, then five sequential GS reads, for games 2026020009, 2026020115, 2026020159, 2026020205 and 2026020298. All ten reports were available. One initial Python TLS handshake failed before an HTTP response because its local CA bundle was absent; root authorized the changed verified-TLS system-curl approach. No HTTP error was retried, no certificate verification was disabled, and no NHL API/NST/database/application/ingestion request was made by this lane.

`official-player-clocks.json` contains **190 independent official fact rows: 180 skaters from ES reports and 10 played goalies from GS reports**. Each row has game/player/team/jersey identity, total/ES/PP/PK clocks and integer seconds, report type and source URL. Per-report metadata records SHA-256, verified game date, ordered away/home team IDs and coverage. Every team header is matched to the captured PBP's full place+common name, game number and date are checked, and jersey+team identifies the captured PBP roster player. Player names are not used for identity. Every official total reconciles to its three official strength clocks. Blank bench-goalie lines have `clocks:null` in metadata and produce no fabricated zero-TOI player fact.

The fresh GS facts exactly match all four prior `OFFICIAL-CLOCK-CHECK.json` goalie strength checksums. All five reports contain 36 skaters and 2 played goalies, with no missing captured played-player identity. These are independent source facts, not numbers derived from the repaired interval/simulator implementation. Root owns the actual 190-row producer output comparison; the oracle alone is not a claim the producer already matches it.

Offline reproducibility:

```sh
python3 tasks/artifacts/drm-pipeline-triage-2026-11-12/parse-official-player-clocks.py
# 10 cached reports -> 180 skaters + 10 played goalies; all 4 prior checksums true.
```

The parser reads `/tmp/drm-ES020009.HTM` and the corresponding ES/GS files for the five games, with `--report-dir` available; it performs no network or database work and uses preinstalled BeautifulSoup. Sources are the official `https://www.nhl.com/scores/htmlreports/20262027/ES020009.HTM` / `GS020009.HTM` family (all exact source URLs are recorded in the JSON).

### Residual source disagreement: 12 skaters

Root's actual producer comparison found PP and PK exact for all 190 players and all 10 goalie totals/ES exact, but 12 skater ES/total values differed. This lane independently diagnosed those 12 using four additionally authorized sequential TH/TV report reads (games 0009 and 0205, both teams), followed by two explicitly authorized read-only current NHL shiftcharts JSON requests. All responses were complete; no pagination/retry, ingestion or database write occurred. `source-discrepancies.json` records report/response hashes, source URLs, identities, independent interval unions and exact excess-coverage spans. `parse-source-discrepancies.py` reproduces the comparison offline from cached files without invoking application math.

For every affected player, the fresh printed shift-interval union exactly equals both that report's own summary and the independent official ES report total. Captured JSON has extra logical intervals; no printed interval/coverage is missing from the captured source. All 45 excess player-seconds are therefore attributable to source disagreement, not residual union arithmetic:

| Game | Player ID | Captured excess physical coverage in period 3 | Seconds | Current JSON |
| --- | --- | --- | --- | --- |
| 2026020009 | 8476474 | 18:00–18:09 | 9 | Now matches official |
| 2026020009 | 8479996 | 18:00–18:09 | 9 | Now matches official |
| 2026020009 | 8483695 | 18:01–18:09 | 8 | Now matches official |
| 2026020009 | 8481122 | 18:03–18:06 | 3 | Now matches official |
| 2026020009 | 8485406 | 18:00–18:06 | 6 | Now matches official |
| 2026020205 | 8477951 | 19:59–20:00 | 1 | Still differs |
| 2026020205 | 8482699 | 19:59–20:00 | 1 | Still differs |
| 2026020205 | 8476389 | 19:59–20:00 | 1 | Still differs |
| 2026020205 | 8483431 | 19:59–20:00 | 1 | Still differs |
| 2026020205 | 8480855 | 19:37–19:39 | 2 | Still differs |
| 2026020205 | 8478831 | 19:37–19:39 | 2 | Still differs |
| 2026020205 | 8477220 | 19:37–19:39 | 2 | Still differs |

Current diagnostic JSON requests returned complete declared counts 809/809 and 825/825 (limit 1000). Game 0009's current interval unions now match all five official player totals, demonstrating that its captured source was superseded. Game 0205's current unions still match the captured excess totals for all seven affected players, proving a persistent JSON-versus-HTML endpoint disagreement; refreshing from the same JSON endpoint alone will not settle it. Some extra JSON rows span 21 seconds but overlap printed coverage for 20 seconds; the table reports their actual net union excess, not a naive extra-row duration sum.

The immutable captured payloads remain unchanged. No total was capped, proportionally rescaled or silently changed to match the summary. Root owns any future source qualification/selection or repair policy. A claim that all190 producer totals exactly match the official source would remain false for the captured input and for current game 0205 JSON, even though the corrected arithmetic faithfully accounts for those inputs.

### Per-game qualification wrapper proof

After reviewer/root additions brought the service-rule suite to 33 tests, this lane added 11 existing-file qualification cases. Complete three-period final regulation fixtures qualify both a true 120-second advantage and a verified 0-second opportunity under source `fhfh-nhl-penalty-context-clock-v2`. Missing period coverage, remaining clock, game end, unique event IDs or correct period type retain a calculable 120 seconds but remain unqualified with the completeness reason. Unresolved captain choice, unsupported penalty and malformed elapsed clock return unknown seconds, unqualified; an outside-game requested team also returns unknown/unqualified after root's guard.

Initial wrapper run passed 43/44, exposing the still-pending outside-team guard; root added it. Final single-file check passed **44/44**. Scoped ESLint and `git diff --check` passed. No formula implementation was edited by this lane. Source qualification is per game and does not convert a supported algorithm flag into blanket trust in every payload.

Last wrapper hardening: root added strict all-event situation-code validation and brought source/audit qualification inside the error boundary. This lane added a deliberately malformed numeric `1551` on the final game-end event; it must return null/unqualified with a situation diagnostic instead of throwing an uncaught string `.trim` error. The unsupported-penalty fixture now replaces its typed details object instead of mutating an inferred narrow property. A final narrow run passed both changed cases (45 tests discovered,43 skipped), with scoped ESLint and diff integrity passing. Root owns the final complete typecheck/integration run.

The residual JSON-source conclusions above remain valid for that endpoint. Root subsequently switched the qualified-source replay to official printed intervals, corrected HTML overtime parsing, and reported all190 player rows /760 total-ES-PP-PK fields exactly matching the independent oracle. Those final route results are recorded separately in `LIVE-REPLAY-OFFICIAL-SOURCES.json`; this lane did not rerun root's accepted replay. Source selection and parser correction resolve the route's official comparison without capping totals or rewriting the immutable captured JSON.

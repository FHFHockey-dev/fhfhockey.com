# Shot map, skater variance and social display — batch14

Root source review at `89da739cb45d7d572ed59bfa0b209c79c5d99299`. All nine scope paths were read in full, in path order: ShotVisualization.tsx, shotMapTransform.test.ts, shotMapTransform.ts, SkaterAdvancedMetricsTable.tsx, seasonSkaterRows.ts, skaterMetrics.test.ts, skaterMetrics.ts, skaterTypes.ts and SocialShare.tsx. Exact counts/hashes and complete symbol inventory are in the manifest/TSV. Source snippets in dependencies do not earn whole-file credit. `skaterTypes.ts` contains static contracts only and is wholly no-math; nullable fields and units were still reviewed.

## Findings

### AFULL-COMP14-01 — P1: opponent density legend uses the team's scale

- **Claim/location:** `web/components/ShotVisualization/ShotVisualization.tsx:254–263,425–468,648–658`. Each event-frequency legend should describe its associated rink's numerical color scale.
- **Evidence/scenario:** Exact JSX scale prop and opponent legend initializer extracted in `components14-probe.cjs`. A team maximum of9 and opponent maximum of1 produce an opponent legend maximum9. Each rink independently normalizes its colors to its own maximum (`newMaxBin`), so the brightest opponent bin contains1 event while its legend says9. The opponent callback stores the correct scale but the parent passes `{min:0,mid:0,max:0}` instead.
- **Readers/reach:** Team stats page→TeamTabNavigation's visualization tab→ShotVisualization; the page provides both datasets and the tab always shows the opponent legend. `TeamTabNavigation.tsx:532–540`, `pages/stats/team/[teamAbbreviation].tsx:126–138,233–247`. No page load or D3/DOM execution occurred.
- **Fix/test:** Pass the actual opponent scale, or deliberately share one scale across both rinks and legends. Add an unequal-density fixture asserting each color endpoint and legend agree. Existing coordinate-transform tests do not cover legends.

### AFULL-COMP14-02 — P1: filtering out goals displays an unsupported shooting percentage

- **Claim/location:** `ShotVisualization.tsx:28–40,504–506,762–763`; shooting percentage requires both goals and saved shots over the selected sample.
- **Evidence/scenario:** Exact `shotSummary` returns0.0% for two saved-shot events. The same sample with its one goal returns33.3%. The event multiselect can request only `shot-on-goal`; `hooks/useShotData.ts:189–203` applies exactly that filter before returning events. The omitted goal is thus unqueried, not established zero. Summary receives no coverage identity and treats the filtered goal count as complete.
- **Readers/reach:** Team visualization filter flows through the page state/hook and both rink summaries. The existing goals-only withholding fix remains intact; this is the complementary saved-only path. No provider request or actual game incidence is asserted.
- **Fix/test:** Carry event-category coverage into the summary and withhold the ratio unless both goal and saved-shot populations are queried, or compute summary statistics from a separately complete event set. Add the saved-only fixture alongside default and goals-only cases; do not infer zeros from excluded event classes.

### AFULL-COMP14-03 — P1: standard skater totals zero-fill unknowns and rates mix support

- **Claim/location:** `web/components/SkaterPage/skaterMetrics.ts:185–218,324–366`; full-window metrics must preserve unknown counts and matched exposure.
- **Evidence/scenario:** Exact `buildSkaterMetricsRows` with one known appearance and null points/hits returns points0 and hits0. For two appearances, (goals1,shots2,TOI60) and (goalsunknown,shots8,TOIunknown), it reports SH%=0.1 and averageTOI60 over a displayed2GP. The first ratio combines known goals with unmatched shot support; the latter silently changes the exposure sample. `finiteOrZero`, independent sums and finite-only averages cause this.
- **Readers/reach:** `seasonSkaterRows.ts:4–34,64–69` selects nullable values and admits on GP>0, not count/exposure completeness. `SkaterLeaderboard.tsx:142–150` passes these rows to the standard metrics table and bucket averages. Generated numbers are reachable under the declared nullable contract; stored incidence unverified.
- **Fix/test:** Preserve full-window unknowns or explicitly expose common-support coverage; pool paired goals/shots and TOI/appearance support consistently. Extend `skaterMetrics.test.ts` with null counts and mismatched exposure. Its known two-game totals/0.125 ratio oracle is valid but does not test this standard path. Preserve the separate advanced `pairedPer60` and weighted individual-attempts fixes, whose missing-value tests already require null.

### AFULL-COMP14-04 — P1: tied and unavailable advanced values receive ordinal ranks

- **Claim/location:** `SkaterAdvancedMetricsTable.tsx:95–104,123,150–153`; a numerical Rank column must respect ties and unavailable values (decision90).
- **Evidence/scenario:** Exact comparator and exact `index + 1` expression sort values2,2,null into displayed ranks1,2,3. Equal values receive different ranks and an unknown value receives a supported-looking rank. Reversing tied input order reverses their claimed ranks. This is independent of the correct null-last comparator and raw-value N/A formatter.
- **Readers/reach:** `SkaterLeaderboard.tsx:412–418` mounts this table on the Advanced Analytics tab; default sorting is points/60. No browser execution.
- **Fix/test:** Compute tie-aware ranks from the eligible numeric cohort, retaining unknown rank for unknown values; distinguish a row number if that is the intended concept. Extend existing static-markup tests with ties and missing selected metrics. Existing assertions cover nullable rate text, units and ownership formatting, not ranks.

### AFULL-COMP14-05 — P2: social TOI formatting emits a sixty-second remainder

- **Claim/location:** `web/components/SocialShare/SocialShare.tsx:386–388`; a minute:second clock must carry rounded seconds into minutes.
- **Evidence/scenario:** Exact `clock` produces `0:60`, `1:60` and `11:60` for59.6,119.7 and719.6 seconds. It floors the unrounded quotient then independently rounds the remainder. These are invalid clock labels; numeric scoring is unaffected.
- **Readers/reach:** Recent-form text338, signed deltas387, nullable clocks388, deployment TOI528 and their alt text. `lib/socialShare/players.ts:280–281` directly supplies rolling average TOI, so fractional seconds are part of the producer contract rather than malformed input.
- **Fix/test:** Round the absolute total once, then derive quotient/remainder; preserve sign and unknown handling. Add carry-boundary examples to the existing SocialShare test file. No live rendered label was observed.

### AFULL-COMP14-06 — P2: tier alt text names a retired primary ranking formula

- **Claim/location:** `SocialShare.tsx:692–697`; exported text must describe the same ranking used by the card.
- **Evidence/scenario:** A trusted tier card's alt text first says players are ranked by points/game and goalies by QS%, then ends by saying last-five fantasy score times opportunity. Actual `lib/socialShare/tiers.ts:56–74` orders skaters/goalies through `scoreOrder`; `players.ts:147–153` and `score.ts:52–66` use the latter score, with season rate only as tiebreak. If A has higher season points/game but B a higher L5 score, B ranks first while the first sentence claims the opposite primary rule.
- **Readers/reach:** `squareAlt`859 selects this function for both tier variants; export/copy accessible description is affected. Static source evidence, not screenshot or export execution.
- **Fix/test:** Remove obsolete primary-sort wording and retain one accurate formula/fallback description. Assert alt text against a fixture where season-rate and current-score order disagree. Current score/missingness logic is not reopened by this label finding.

## Retained fixes, rejected hypotheses and numerical contracts

- Shot transforms preserve event-owner attacking direction from home defending side; fallback uses coordinate direction only when that metadata is absent. Half-rink coordinates preserve own-half events instead of reflecting them into attacks. Exact coordinate/direction fixtures were fully read, not run. No malformed nonfinite provider input is claimed without admission evidence. Both rink and controls summaries use the same helper; unknown goals-only shooting rate remains withheld. Layout coordinates/bin sizes are geometry, not calibrated rates.
- Skater season loading uses the season date window and `(date,player_id)` keyset, ordered by both fields; the cursor predicate is conjoined with `date>=cursor.date`. Nullable stat fields remain declared in the types. Invalid IDs are excluded by the metrics grouping. The advanced per-60 helper requires every count/exposure pair; individual attempts reconstruct each game's count from its own rate and TOI before pooling. Unsupported IPP/ixG remain hidden and the source-specific attempt label makes no unverified strength claim.
- `getLatestContextByPlayer` compares week keys lexically. A candidate week9/week10 ordering defect is **rejected**: the actual producer `skaterCalculations.ts:131–148` emits fixed-width ISO start/end date keys, not numeric week strings. Historical synthetic fixture labels do not establish a real defect. Bucket averages are explicitly per-player comparison summaries; no pooled-population estimand was inferred. Full upstream valuation/weekly source review remains pending.
- Social cards gate trusted schedule/player/trend evidence and display unavailable/expired/loading states. Unknown source scores do not become current-data claims. Tier selection, ownership thresholds, recent/season fallback labels, separate role direction, zero/unknown PP distinctions, finite percent formatting and sparkline gaps were checked. Sparklines segment missing values rather than drawing through absent evidence. Layout widths, row allocations, chip geometry and icon coordinates were reviewed as presentation arithmetic. Calendar date labels intentionally use date-only/UTC adapters; no new timezone defect established. Snapshot fetch/effect/export controls were source-read only, never invoked.
- Existing tests in this batch pin coordinate geometry, pooled per-60 units, source-qualified iCF, matched missing exposures, two-game standard totals, bucket placement, week-rating sorting and nullable formatting. They do not independently qualify production data or model predictions. Tests outside the nine-file assignment were used only in the named bounded traces, not credited as complete.

## Evidence and checks

`components14-probe.cjs` and `components14-probe-output.json` retain exact-source VM probes for findings01–05. One invocation exited0; installed TypeScript parser/transpiler and Node built-ins only. No application imports, React/D3 execution, test runner, database, provider, page, server or production action. Probe source files were independently byte-compared with the pinned target before extraction. Every scope file's target/current digest and all unique inventory identities were checked. No app/test changes or fixes were made. Findings are source-confirmed conditions, not observed live wrong numbers.

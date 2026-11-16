# Lines, linemate matrix and metrics timeline — components batch8

Read-only audit at `89da739cb45d7d572ed59bfa0b209c79c5d99299`, worker `/root/readfirst_lanes` (Astra/high previously verified). All16 scoped files were fully read in path order: **4,724 lines**, all matching checkout bytes. The **866-row TSV** covers450 function/closure bodies (including71 tests),411 initialized values and5 explicit display/gate expressions. AST enumeration was a completeness check after source reading. `audited` means source reviewed within this batch, not hosted/test/visual qualification.

| Scoped path under `web/components/` | Read | Bytes | SHA-256 |
|---|---:|---:|---|
|LineCombinations/LineShareBars.test.tsx|1–172|5405|fff285d14ffc6daca83f2b4aef9afe036306709d83348c2d426413d51d414fdb|
|LineCombinations/LineShareBars.tsx|1–163|5960|c0a5c5385bdf4d105d110e4026f01c9baca7a20882be409713d0f9911e8d40b6|
|LineCombinations/PlayerCard/GoalieCard.test.tsx|1–50|1718|bf4b2162b02a7ec3a51f0d5b0d9d36b6c64142313db4e7f03ec66c72d47c0002|
|LineCombinations/PlayerCard/GoalieCard.tsx|1–147|5080|bc08f92c355f5d155262610adb429164cc1cd33a670cc4741e68c562e3a822f1|
|LineCombinations/ProjectedLineups.test.tsx|1–26|1563|8bc65c3c98ff887ba71a4ddecaceb697c671de529066e05bbbb04b0590a470a1|
|LineCombinations/ProjectedLineups.tsx|1–86|6723|1c780998a158608059e08d6523f4adfba341ac2242891895f0ea0499edcadef5|
|LineCombinations/__test__/fiveOnFiveUnits.test.ts|1–117|3662|47c9833d1600195f62861fb10a5cb97f0ce8efdd4f6cdfe73b2fdb9dff6274ab|
|LineCombinations/__test__/utilities.test.ts|1–571|25044|799aa404a6ba786e380dbeddc2e077e7bd78d9cd398c4919a556a7bc156e76f0|
|LineCombinations/fiveOnFiveUnits.ts|1–139|5217|90660e4c2c0eef1f66bc37ce2f01715cf1ccd28933aa10e9c7fc3c29abd4983b|
|LineCombinations/utilities.ts|1–923|30351|801b98a3d95849488d841ac769a8627f6fd882b65e86a109076f3640e9ac547f|
|LinemateMatrix/index.test.tsx|1–290|12628|ae126b86593e14c87aaea2998a004c5d756164f46b7baf599b7e75317cca0374|
|LinemateMatrix/index.tsx|1–1046|34886|cb53de12fdaab35939c03e4a63d232dd9af62a10cc987e75ec036e5514180483|
|MetricsTimeline/MetricsTimeline.test.tsx|1–192|8568|e158cb37aacb632701c88505d95b68dc052270eeeb251cf8403b221b1e9f58fc|
|MetricsTimeline/MetricsTimeline.tsx|1–502|16022|0bd085c542ae116e7447895497506c306399f9b14a8438f465b9c2db8a8f5e2a|
|MetricsTimeline/metricsTimelineData.test.ts|1–166|6006|2e88f6b6f9c50480537e732cc6a6481bef44e8e4e654094162fceec7a7358ada|
|MetricsTimeline/metricsTimelineData.ts|1–134|4425|97aace858602aed4c840e8f1595ff3238a8c72b3046e9610e3a814b1d2e87013|

## Findings

### AFULL-LINES8-01 — P2: unknown goalie appearance count is labelled as no appearances

**Claim/location.** `LineCombinations/PlayerCard/GoalieCard.tsx:56` sets `hasNoAppearances = !rest.season?.GP`; the branch at101–117 displays “No appearances yet this season” and suppresses the stat grid. The actual producer deliberately returns `GP:null` when appearance membership is unproved (`LineCombinations/utilities.ts:783–789`), and its public type explicitly permits null (748–755).

**Concrete reproducer/evidence.** One known60-minute appearance with29/30 saves and1GA, followed by a retained row with nullTOI/nullsaveShots,0GA and no credited decision, produces unknown season/last10GP. The exact extracted `summarizeGoalieAppearances`, pooling/admission helpers and card predicate return `season.GP:null`, `hasNoAppearances:true`. A known appearance exists, so the rendered claim is false. This is a source-confirmed label defect, not a wrong pooled numeric rate or observed live incident. The report's JSX rendering assertion is based on direct source reading; no React render/browser was run.

**Contract/reader/fix.** Cross-cutting unknown rule5 and final-reader rule7 apply. `pages/lines/[abbreviation].tsx:300–310` passes goalie rows to `Line`; `LineCombinations/Line/Line.tsx:49–56` spreads those rows into this card. Preserve the repaired producer and distinguish `GP===0` from null/undefined. Unknown membership should retain unknown language/dashes, not assert zero appearances. The existing “No appearances” behavior for a proven zero remains valid.

**Regression oracle.** Extend `GoalieCard.test.tsx`, currently20–49: a GPnull card must not contain the no-appearance claim, while GP0 still does. Compose with the existing producer fixture `__test__/utilities.test.ts:399–410`, which already explicitly asserts unknownGP after this source condition. That producer test passes no rendered output to the card and therefore misses the consumer disagreement. No existing test failed or was rerun in this batch.

### AFULL-LINES8-02 — P1: compact position filters regroup PP units and change their displayed percentages

**Claim/location.** `LinemateMatrix/index.tsx:628–682` orders the complete PP roster into inferred PP1/PP2 groups. `sortedRoster:747–750` then applies the compact F/D filter. The PP summary at878–881 slices this *filtered* list into firstfive/nextfive and computes each group's mean own PPTOI. `PPTOIComparasion:1014–1043` labels the resulting normalized means PP1/PP2. Filtering the matrix thus changes group identity and arithmetic without changing any player's actual ice time.

**Concrete reproducer/evidence.** Ten players form two disjoint units, each4F+1D. Each PP1 member has90seconds and each PP2 member30seconds; same-unit pairwise overlap is90/30, cross-unit0. The exact source sorter, filter, `getAvg`, and percentage initializers return:

| Position filter | IDs included in first summary group | Means, seconds (PP1 / PP2) | Displayed percentages |
|---|---|---:|---:|
| All | Original PP1 players1–5 |90 /30|75.0% /25.0%|
| Defense | Both units' defensemen5 and10 |60 /0|100.0% /0.0%|
| Forwards | Four PP1 forwards plus one PP2 forward |78 /30|72.2% /27.8%|

A valid120-second qualified clock is compatible with this fixture; the probe does not execute or bypass the clock gate. With either a whole-unit or within-unit-position interpretation, symmetric4F1D units still retain the same75/25 split. The displayed100/0 therefore cannot describe the original PP1/PP2 units. Severity is proposedP1 because this is reachable numeric/identity disagreement, not merely wording or an absent test; Chef owns final severity.

**Reader/contract.** `ShiftChart/Replay.tsx:35–67` mounts `LinemateMatrixView` with `compact`, the chosen mode and the qualified verdict; each compact matrix offers the position filter. The PP view's availability gate at549–577 remains intact. This is conditional on selecting PP mode and a position filter with available data. No live incidence, real browser interaction or upstream qualification failure is claimed. Rules3/4/7/9 require correct frozen identities, every reader and one estimand per comparison.

**Small fix/regression.** Preserve inferred unit identity from the full roster before applying a display filter. Either show full-unit totals consistently or filter within each retained unit with an explicit within-position label; never reassign a PP2 player to PP1 because earlier players were hidden. Extend `LinemateMatrix/index.test.tsx` with the two-unit fixture and All→D→F transitions, asserting original memberships and75/25 in the intended summary. Current116–136 tests fewer than two full units and accepts100/0;138–156 tests per-team position filtering but no PP summary arithmetic. The combination is missing. Source probe passed; no runtime test failed.

**Closed work preserved.** This finding does not reopen decision152's numerator/qualification release. `ppModeVerdicts:367–385`, `lib/ppShare/serving.ts:40–112` and the hook still distinguish pending/error/N/A, require positive qualified exposure and exact stored/live clock agreement. The bar normalizes *two unit means*, not playerPPseconds/teamclock; denominator naming could be clearer, but that separate presentation question is not elevated to another defect here.

## Symbol, denominator and reader review

- **Line shares (`LineShareBars.tsx:23–163`).** The legacy line value is the mean of each member's totalTOI/ownGP; call-ups and two-player lines do not receive total-time or full-line-size penalties. Any missing member exposure withholds the ice shares. The5v5 board uses the unit's last-game shared clockseconds directly. Both divide by the corresponding sum of nonempty line values. Goals are separately labelled all-strength player-goal totals over the team's last10 games with lines. They are not five-on-five on-ice goals and are not divided by the ice denominator. The lines-page adapter455–467 passes the same unit's seconds. Existing concrete numeric oracles cover these distinct measures.
- **Observed5v5 units (`fiveOnFiveUnits.ts:48–139`; `utilities.ts:114–235`).** Latest snapshot wins per exact team/game; incomplete latest rows invalidate that team-game. Pooled player-seconds are divided by the unit's player count (3F or2D), then accumulated for identical sorted IDs. Greedy shared-time selection prevents player reuse, with numeric-ID tie-breaks and4F/3D limits. Both latest games must support the observed board, otherwise both compare on the labelled legacy basis. No older complete snapshot silently replaces an incomplete latest snapshot. Tests verify these choices; the live unit writer's completeness claims were not independently qualified.
- **Source identities and batching (`utilities.ts:250–637`).** Exact requested team and season are enforced. The batched landing reader pages200 newest line rows until every requested team has two, then shares board/movement logic with the per-team reader. The last10 skater sample is team games *with lines*; goalies use their own season appearances and latest10 appearances. Raw skaterTOI strings are summed in seconds; malformed strings can becomeNaN (later withheld), null violates the helper's type and throws. This is not a demonstrated missing-to-zero defect. Query finality/type admission, uniqueness and complete raw row coverage remain upstream boundaries, not claims of production verification.
- **Goalies (`utilities.ts:757–865`).** Strict save/shot and duration parsing; appearance evidence is positiveTOI/shots/GA/decision. Zero-duration penalty-shot events can prove an appearance, while a measuredzero backup with no positive evidence is excluded. Unknown membership is retained as unknown. SV%=Σsaves/Σshots, GAA=3600ΣGA/Σseconds, and W-L-OTL uses that goalie's credited decisions. Unknown components invalidate only the corresponding statistic, except unknown membership invalidates the entire window. No mean-of-ratios, team-win substitution or fabricated0/0 rate found. The card disagreement is AFULL-LINES8-01 only.
- **Projected reports (`ProjectedLineups.tsx:12–86`).** Retained reports are explicitly dated and do not claim today's confirmed lineup; disabled publishing hides them. Polling uses abort/unmount guards, resets scope and schedules60seconds after completion. Transient errors retain prior data with load/error context. Supporting `mergeFrozenEntries` requires a verified corrected-entry chain before replacing an already frozen entry; the rest of that component remains outside this batch. Content tests do not test polling/freezing.
- **Linemate matrix (`index.tsx:32–590,700–1046`).** Standalone rosters require scheduleOK and OFF/FINAL before showing the completed game. Pairwise shift intersections yield seconds, including diagonal ownTOI; PP mode intersects the same blocks used for live teamclock reconciliation. Supporting `getPairwiseTOI` unions occupied seconds within each period, so overlapping shift rows do not double-count. An explicitly empty PP-block list produces zero; undefined blocks mean all-strength. Cells show seconds and use clamped shared/mean opacity as a display scale, not probability. Missing diagonal/pair data defaulting and empty shift arrays rely on upstream completeness; no additional live-data defect asserted. The new verified failure is filtered-unit identity, not clock classification.
- **Timeline (`MetricsTimeline.tsx`; `metricsTimelineData.ts`).** WGO records are dated samples with sampleGP; points%=points/(2GP) only for positiveGP. Existing WGO per-game rates are displayed as supplied. Approved in-house xG stays *per-game*, never divided by WGO's sampleGP. The builder requires explicit true approval, shot_goal, positive safe gameID, exact model/feature pin, finite nonnegative category values; genuine0 survives, categories remain independently unknown. No source forwardfill. Two distinct games on one date make that daily per-game slot unknown. Latest/best/delta use available observations; the delta labels five observations, not five days/games; chart gaps remain unconnected. WGO field finiteness and duplicate identical-game rows remain source-schema assumptions.
- **Retirement/registry reader.** The exact timeline API filters approved aggregates to the server-selected model/feature pair. Supporting `modelRegistry.ts:238–322` excludes retired/inactive/unapproved rows, prefers exactly one eligible champion and otherwise exactly one eligible row; ambiguity returns no model. A null pin admits no xG. No bucket heuristic or silent unapproved fallback appears in these scoped readers. Full registry implementation/writers and live deployment state remain outside this batch.

## Test oracles and limits

All71 test callbacks and their helpers/assertions have separate TSV rows; these are source-audited tests, **not71 executed tests**.

| Scoped test | Concrete regression oracle | Important limit |
|---|---|---|
| `LineShareBars.test.tsx` |93–122:37/33.3/29.6% ice vs37.5/37.5/25% goals;124–137 unknown ice withheld;139–171 unit600/300/100 →60/30/10|First37–91 only verifies labels; fixtures do not prove upstream complete stats.|
| `PlayerCard/GoalieCard.test.tsx` |20–49 pooled.939/1.71, unknown recorddash and verifiedGP0 message|NoGPnull consumer oracle; AFULL-LINES8-01.|
| `ProjectedLineups.test.tsx` |9–25 older-date disclosure, legacy response shape, disabledpublishing|Pure content, no polling/error/freeze-chain execution.|
| `__test__/fiveOnFiveUnits.test.ts` |26–117 exact disjoint IDs, tie order, all120 permutations, pooled300+150 playerseconds /3=150 sharedseconds, latestpartial exclusion|Explicit flagtrue test is configuration evidence, not coverage qualification.|
| `__test__/utilities.test.ts` |75–83 TOI1365/480;239–442 own-goalie pooled31/33 and1.71, unknowns, zero-duration penaltyshot;305–397 observed/fallback/latest;510–570 batch parity and pagination|Mock does not execute joined filters/order; batched/per-team parity shares helpers, so common bugs can pass. Query-count assertion is fixture callcount, not production performance. Legacy importedfixture not opened here.|
| `LinemateMatrix/index.test.tsx` |Proxy errors; sparse/empty pair safety; supplied-data rendering/independent team filters; exactclock240 vs236 availability and N/A/error|No PPfilter+unit-identity combination; partial-unit100/0 expectation does not justify regrouping existing units.|
| `MetricsTimeline.test.tsx` |101–191 approval/modelselection, independent source failures, nullcategory/gaps, datedsample label; chartprop `connectNulls:false`|Queries and chart components mocked; no real SQL/schema, graphgeometry or runtime provider proof.|
| `metricsTimelineData.test.ts` |40/(2×30), invalidapproval/type/gameID, independentxGA,0preservation, nofill, champion/shadow bothorders, no pin, ambiguousdate, explicitdelta|Frozen builder fixtures do not establish retained production coverage or predictive calibration.|

## Receipts and completion boundary

The isolated probe `/tmp/astra-components-8/probe.cjs` ran once, exit0; its exact JSON output and SHA-256 are retained in the manifest. Only TypeScript parsing/transpilation and extracted pure code in a VM were used. The inventory generator ran twice, both exit0; the second corrected a test-fixture helper description. Pin/current byte comparisons succeeded for all16 scope files and13 supporting sources. No scoped unread sections remain. The manifest records exact supporting read ranges and every unread remainder.

No source/test changes, app imports, Vitest execution, React/browser render, server, database/provider/network requests or model execution occurred. Closed5v5/goalie-pooling/PP152/model-retirement repairs remain closed except for the two newly demonstrated consumer disagreements above. The canonical ledger/report remains Chef-owned. No broader source path is marked audited from these snippets.

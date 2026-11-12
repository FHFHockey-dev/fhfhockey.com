# Independent peer review: W2-3 underlying stats, part 2

Reviewed 2026-11-11 on Tim's Mac in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `3e81061cb60105e984ae7724365b2d9f22ba6d11`. Target: Fable audit commit `5bfdc98c4a`, `../audits/underlying-stats-summaries-part2.md`, M-UST-061–098. Owner decisions 1–68, both consolidated Wave 1 reports, and upstream NST/xG reviews were binding context. This is additive; the original audit and application files were not edited.

## Decision

**Accept the principal diagnoses, with additions and corrections before using the report as a fix specification.** Reversed strength orientation, missing running-score exposure, null-first descending sort, and missing/mislabelled variance columns are supported. The audit's 12 sound / 13 mis-specified / 13 wrong tally is its classification, not an independently certified tally. In particular, M-UST-095 is not sound, M-UST-093 has a demonstrated valid-input failure, and the blanket endorsement of goalie distance aggregation in M-UST-098 is wrong.

Most useful additions:

1. **Goalie average distance uses the wrong weights when geometry is incomplete.** A two-game fixture yields 13.636 feet instead of 30 feet.
2. **Team TOI can continue after a sudden-death game ends.** An overtime fixture ending after 60 seconds yields 300 seconds. The game-clock fix alone does not fix this separate exposure error.
3. **Variance per-60 rates silently discard missing exposure but retain its counts.** Two one-goal games, with TOI 1,200 seconds and unknown, produce 6 goals/60 rather than an unknown full-window rate.
4. **xG Lab says coverage is “ok” with no transition or rebound data.** Raw row-count ratios do not prove coverage of the displayed entities/windows.
5. **Do not implement the audit's WGO missing-games caveat:** the existing code already fails closed correctly. Also, the live-summary build condition is discoverable from source; no unknown serving flag is needed to establish that path.

No production database reads or writes, provider requests, application endpoint calls, app changes, deployments, commits or pushes were performed. Production magnitudes below remain the original auditor's dated observations.

## Independent verification

**Seven existing test files passed, 101 tests total.** From `web/`:

```sh
npm test -- --run \
  lib/underlying-stats/playerStatsLandingServer.test.ts \
  lib/underlying-stats/teamStatsSummaryRefresh.test.ts \
  lib/underlying-stats/teamStatsQueries.test.ts \
  lib/underlying-stats/xgExplorer.test.ts \
  components/SkaterPage/skaterMetrics.test.ts \
  lib/stats/percentUnits.test.ts \
  lib/underlying-stats/playerStatsRefreshWindow.test.ts
```

These are compatibility/coverage checks, not acceptance tests for the defects. The fixtures below exercised the actual source functions using installed `ts-node` and in-memory export instrumentation for private functions. No source was patched. Fixture processes used inert Supabase settings and denied `fetch`, HTTP and HTTPS requests.

| Fixture | Current output | Assessment |
|---|---|---|
| Home PP, situation `1451`, exact strength `4v5`, one home shot, 1,200-second interval | Home PP: TOI 1,200, CF 0; home PK: TOI 0, CF 1 | Confirms D1, including numerator/denominator mismatch |
| Same fixture, tied score filter, no per-event scores | Tied TOI 0, CF 1 | Confirms D2's missing-score failure without production reads |
| Team descending sort of null, .3, 0 | null, .3, 0 | Confirms D3 |
| OT starts at 0; winning goal, period-end and game-end at 60; valid `1331` situation on each | Segments 0–60 and 60–300, total 300 | Additional A2 |
| Goalie game A: 10 shots, one known distance 10 ft; game B: one shot at 50 ft | Stored weighted total 150, count 11, average 13.636 | Additional A1; correct known-geometry mean 30 |
| Variance skater: one goal/1,200 seconds, then one goal/unknown seconds | GP 2, G/60 6 | Additional A3 |
| Coverage: source 100, created 100, transition 0, rebound 0, supplemental 100 | status `ok`, no warnings | Additional A4 |
| `parseTime("20")`, `"20.0"`, `"20:00"` | NaN, 20, 20 | Reclassify M-UST-093 for valid integer minutes |
| WGO rows: GP 1 and GP null, each PPG 1 / opportunities 2 | Games and every aggregate null | Contradicts the audit's caveat; correct unknown propagation |
| Team last 1: id 100 on Nov 10, id 200 on Nov 9 | Selects id 200 / Nov 9 | Confirms date-order defect in the **per-team** branch too |

The first fixture process completed the checks printed before the distance case, then stopped because the harness requested a nonexistent `createLandingAggregateMetrics` helper. The follow-up used the actual `defaultAggregateMetrics` name and completed the distance/window checks. No implementation failure is inferred from that harness error. A reproduction recipe is retained below.

## Additions to the defect list

### A1. P1: goalie average distances are reweighted by the wrong population (M-UST-098)

**Reach:** live aggregation code; occurrence and frequency of incomplete geometry in production were not measured.

- Upstream distance means exclude missing coordinates and, for goal distance, own goals: `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1502-1514,1820-1826`. Their denominators are `shotDistanceCount` / `goalDistanceCount`, not all shots/goals against.
- `web/lib/underlying-stats/playerStatsLandingServer.ts:3554-3562` reconstructs the totals by multiplying those means by **all** shots/goals against. It stores those larger counts and later divides at `:5119-5126`.
- The two-context fixture above proves the mathematical error: `(10×10 + 50×1)/(10+1) = 13.636`, whereas the two known distances average `(10+50)/2 = 30`. A game with every coordinate missing is omitted; partially missing games are incorrectly overweighted.

**Fix:** carry distance sums and their valid-observation counts from parity through game summaries, aggregate those quantities, and expose geometry coverage. Do not reconstruct them with total SA/GA. Updating only the displayed division will not repair persisted summary metrics.

**Tests:** partially missing geometry across games with different SA/GA, fully missing geometry, own goals, and a complete-geometry control. Verify landing, detail and chart results. Repair old summary payloads only under a separately approved bounded plan.

### A2. P1: team exposure extends past the actual game end (M-UST-073/091)

**Reach:** team summary writer; conditional on the final included event having a valid situation and elapsed time before the nominal period length. This is not a measured claim about every OT game.

`web/lib/underlying-stats/teamStatsSummaryRefresh.ts:281-303` ends the last interval at `resolvePeriodDurationSeconds(event)` rather than the actual final clock. `:601` counts it. A valid `game-end` at OT 1:00 creates 240 phantom seconds, even when the goal, period-end and game-end are all present at 1:00. The fixture produced 300 OT seconds instead of 60. With regulation held at 3,600 seconds, that would make full-game exposure 3,900 instead of 3,660 and understate a matched per-60 rate by about **6.15%**. That percentage is fixture arithmetic, not a production estimate.

**Fix:** terminate exposure at explicit terminal game/period boundaries; do not extrapolate a sudden-death terminal event to the scheduled period end. Preserve uncertainty if the terminal clock is missing. Correct playoff period lengths separately. This is not repaired by changing `game_seconds_elapsed` alone.

**Tests:** regular-season OT ending at 1:00, playoff sudden death, multiple playoff OTs, regulation ending at 20:00, same-clock goal/end ordering, missing terminal clock, and both valid/missing situation codes on end markers. Check team TOI against the fixture's actual played duration and derived rates.

### A3. P1: variance count rates pair complete counts with incomplete TOI (M-UST-081)

**Reach:** live `/variance/skaters` advanced metrics; real missing-field prevalence unmeasured.

`web/components/SkaterPage/skaterMetrics.ts:185-209` turns every missing/nonfinite summand into zero. At `:337-379`, counts are summed independently of total/PP TOI. A second game with a goal but unknown TOI adds the goal and no exposure. Missing counts can conversely depress a rate while retaining all time. This is separate from the CF/60 naming error.

**Fix:** for a full-window rate, invalidate it if required counts or matching exposure are unknown; alternatively report an explicitly labelled complete-case subset with excluded games/exposure. Distinguish known zero from unknown. Apply the same rule to PP rates and any newly supplied CF/60/IPP/ixG inputs.

**Tests:** partial missing total TOI, partial missing PP TOI, missing numerator, known zero numerator at positive exposure, and unequal-exposure games. The two-game fixture must not report a complete-window G/60 of 6.

### A4. P1: xG coverage can report healthy while displayed fields have no data (M-UST-095)

**Reach:** live xG Lab code. Current production coverage was not read.

`web/lib/underlying-stats/xgExplorer.ts:300-322` warns about transition/rebound sparsity only when the corresponding count is **greater than zero**. One present supplemental family suppresses the general no-supplement warning (`:281-285`). Thus the fixture returns `ok` for completely absent transition and rebound inputs, whose displayed fields become zero at `:369-395`. `web/pages/underlying-stats/xg/index.tsx:384-386,423-428` displays this status and only shows coverage warnings for `warning`.

Additionally, the API counts entire rolling/created histories and season-level game aggregates (`web/pages/api/v1/underlying-stats/xg.ts:449-496`), while rows select each player's latest rolling record. A ratio of unrelated row counts can exceed one or appear healthy without proving any overlap in player, game, date, model or selected window. Keep such ratios as inventory diagnostics, not completeness evidence.

**Fix:** distinguish absent/unavailable/not-applicable from observed zero per family, and measure joins on the displayed entities and matching windows/model versions. Retain unknowns in the row, not merely a warning over zero-filled metrics.

**Tests:** each family independently absent, non-overlapping entities despite equal raw counts, stale latest created row, mixed model/window coverage, and no core rows. No universal 2% threshold establishes completeness.

### A5. P2: integer-minute TOI is a real parser failure, not a sound edge case (M-UST-093)

**Reach:** the exported parser has live callers; whether their actual NST text ever uses integer-only minutes remains unmeasured.

`web/lib/NHL/TOI.ts:82-90` treats any string without a decimal point as `mm:ss`. `"20"` becomes NaN. For example, `web/pages/api/SustainabilityStats/[playerId].ts:139-141` then turns the rate into zero via `|| 0`; CareerAverages and Teams also call it. The audit acknowledged the input but still marked the parser sound.

**Fix/test:** define the input contract and accept integer/decimal numeric minutes separately from colon clocks; reject malformed input as unknown. Test `20`, `20.0`, `20:00`, zero and malformed text. Keep the retired `fetchTOIData` path separate; no resurrection or deletion is needed.

## Corrections and implementation-plan qualifications

### C1. Retain D1–D4, with scoped tests and correct reader boundaries

The synthetic PP fixture and code confirm the reversed `strength_exact` parse in both team and goalie readers. The PBP-only fallback's exact 5v4/4v5 branches also reject the home-side cases (`playerStatsLandingServer.ts:2395-2400`). Broad fallback PP/PK uses `classifyTeamStrengthState`, so do not claim every fallback PP count is reversed. Preserve goalie/net flags when replacing the parsing: a shared manpower helper must also settle extra-attacker semantics, not simply rename the two integers.

The score-state defect does not imply every possible input produces zero TOI. A goal with populated scores followed by an event at a later clock can create one scored interval. The original “all six states zero” is a **reported 106-game sample**, not a theorem. D2's pre-event score for events/post-event score for following exposure is the right remedy; include goal/stoppage events sharing a clock and explicit terminal bounds from A2.

D3's null-placement correction is sound. Test both directions, zero, finite values, all-null columns, stable tiebreaking and pagination on both player/goalie and team code paths.

D4 is supported by `seasonSkaterRows.ts:4-33`, `skaterMetrics.ts:381-389` and `SkaterAdvancedMetricsTable.tsx:56-58`. The unweighted fallback is individual attempts/60, not on-ice CF/60. The “about 55–60 on-ice” comparison is illustrative, not a matched measured comparator for the six WGO rows. A repaired rate must use matched counts and seconds ×3,600, plus the A3 coverage policy. Owner choice of source versus hiding/relabeling remains open; heuristic in-house xG cannot be reintroduced against decisions 6/12.

### C2. The WGO null-games caveat is false (M-UST-089)

The audit says a null-GP row enters sums but contributes no games. In the reviewed source, unchanged from the audit commit, `web/lib/stats/percentUnits.ts:39-50,165-175` instead makes the games sum null and gates **all** metric sums on that result. The fixture confirms all outputs null. Preserve this behavior. The main pooled WGO formulas are sound; do not “fix” an already-correct missing-exposure guard.

### C3. D7's live-build branch is established, not an unverified environment flag

The UTC/local-date bug at `playerStatsLandingServer.ts:805-824` is real. However, its serving condition is source-resolvable:

- Broad season landing states eligible for the aggregate cache disable live builds (`:1935-1943,5320,5380-5384`).
- Scoped/team/venue/split states can bypass that cache and enable live builds for missing summaries.
- Chart and detail readers call the helper without an override (`:5453-5457,5486-5489`), whose default is true (`:4553-4560`). The public players API calls this service (`web/pages/api/v1/underlying-stats/players.ts:28-29`).

Keep actual mid-game ingestion and missing-summary exposure **conditional/unmeasured**, but do not leave the code-level branch as a mystery. Also, elapsed eight hours is a conservative heuristic, not proof of a final game: postponed/suspended games require an explicit completed-state policy (decision 21 and the audit's own D15). Add tests for delayed games and unknown start times rather than endorsing the refresh selectors as universally “right.”

### C4. Window questions and rank/average labels need narrower conclusions

- D5 correctly identifies a league-wide ID slice for `gameRange`; its intended semantics are still an owner question. Do not replace a deliberately distinct league-wide selector silently. Relabel it explicitly if that is intended, or make it per-team if promised.
- Regardless of that choice, **both** branches order by game ID, not played date (`teamStatsQueries.ts:880-901`). The second fixture demonstrates wrong chronology in the per-team branch. Test postponed/rescheduled games in both controls.
- “At most 20 teams with one game each” is imprecise: ten league games involve at most 20 distinct teams, but some teams may appear more than once.
- For D8, the team-of-record/date direction is already decision 16; retain explicit unknown handling for missing trade dates. The separate question of last N appearances versus last N appearances **with split exposure**, and the split GP denominator, still needs a precise label/contract.
- An unweighted **average player's** SH% is not mathematically wrong merely because it differs from pooled shots (M-UST-082). The row explicitly says `Avg` (`skaterMetrics.ts:483,494-496`). Pooled and mean-player rates answer different questions. Make the estimand explicit rather than automatically imposing D16's pooled replacement.
- Likewise, row index after sorting is an ordinal, not necessarily a failed sporting rank. The UI calls it “Rank” (`PlayerStatsTable.tsx:217,284`), and an existing test explicitly expects visible-row order (`PlayerStatsTable.test.tsx:696`). Relabel to `#` if ordinal is intended; only add direction-aware/tied ranks after choosing a metric-rank contract. Alphabetic sorts have no “good” sporting direction.
- M-UST-086's two start-share denominators are equal under complete same-window data because exactly one goalie starts each team game. Their existence alone does not prove a discrepancy. Preserve coverage checks and label starts, not appearances; the placeholder reach is low priority.

### C5. Team final-output provenance includes an official overlay

The team API is not merely a view of `team_underlying_stats_summary`. `web/lib/underlying-stats/teamStatsQueries.ts:425-438,597-624,1012-1018` permits an NHL overlay for a single season, no scope, all venues/opponents, all scores, and all-strength or 5v5. It replaces a subset of counts and recomputes ratios/rates when official GP equals native GP (`:505-591`). It falls back to native output on failure.

This does **not** rescue D1's PP/PK or D2's score-state views, which fail the overlay condition, nor the native danger/xG columns. It does mean storage measurements alone do not establish every served all-strength/5v5 value. W2 part 1 owns the overlay as M-UST-035; cross-reference it rather than creating a duplicate defect. Its unresolved shootout-goal convention must be settled before comparing official SH%/SV% with native event counts. Add final-output tests for overlay on/off/failure and mismatched coverage; a mock-client test that bypasses the overlay is not sufficient.

### C6. Remaining remedies and evidence limits

- D6's MD/LD addition is exact double counting **when the same goal is included by both paths**. Under asymmetric PP/PK selection it can instead sum different populations; “about 2×” is not a universal error factor. Fix orientation and duplicate credit together. Keep owner decision 10's aggregate GSAA and bucket-specific league baselines, decision 7's empty-net population, and decision 12's hide/retire requirements.
- D9 must align **as-of date and game identities**, not merely request the same numeric `windowGames`. Created rows select latest independently (`xgExplorer.ts:344-347`); stale created totals can be joined to a newer core window. Supplemental transition/rebound rows also lack retained game dates in the current builder inputs. Preserve those keys to make a true matching-window fix possible.
- D10's “two copies” should distinguish the stored game-elapsed-clock formula from the team duration fallback. The team copy does not itself compute `completedPeriods × duration`; it has the separate terminal-exposure problem in A2. Do not misapply a clock patch to the segment builder.
- D11's roster-based appearance remedy needs a verified **dressed** population. A generic roster row must not make scratches into GP. Test a dressed player with no logged event, a scratch, an event failing the split, and unavailable roster evidence separately. No unsupported positive PP exposure should be invented.
- D12 is valid for playoff OTL. Unknown outcomes must remain unknown in standings and their eligibility denominator; do not merely null the numerator and retain the unresolved game in point percentage. Repeated standings under split filters remain a product-label question.
- D13 is source-confirmed: `:4859-4866` calls `createLandingRowFromSummaryRows`, which reapplies the aggregate minimum to one game (`:4263-4268`). Eligibility should be decided on the aggregate and chart points should then retain their real per-game exposures.
- D15's hole-retry diagnosis is supported by goalie `goalieStatsRefreshWindow.ts:117-130` and team `teamStatsRefreshWindow.ts:118-131`. The player seven-day lookback is bounded and does not prove all older gaps are repaired. Define a bounded reconciliation queue for remaining gaps; no broad rebuild is authorized by this review.
- The original xG 1.57×/1.86× totals are alarms on a reported sample, not calibration proof or independent measurements. Blocked attempts, empty-net handling and outcome-dependent floors already establish specification defects. Do not treat correlated team-game rows as independent validation samples.
- No saved NST page/reference fixture was supplied or fetched. Exact external danger geometry and split-GP conventions remain reference gaps. Do not promote recalled conventions or ad hoc range checks into acceptance criteria.

## Per-entry disposition

“Retain” supports the cited calculation/diagnosis at the inspected boundary, not every live magnitude. Paths abbreviated `landing` = `web/lib/underlying-stats/playerStatsLandingServer.ts`, `teamWriter` = `web/lib/underlying-stats/teamStatsSummaryRefresh.ts`, `teamQuery` = `web/lib/underlying-stats/teamStatsQueries.ts`.

| ID | Review disposition | Decisive evidence / qualification |
|---|---|---|
| 061 | Retain sound formula | `landing:2059-2078`; matching exposure and upstream counts still required |
| 062 | Retain defect, fallback reach | `landing:2361-2400`; exact home 5v4/4v5 fails; broad PP/PK separate |
| 063 | Retain arithmetic, definition unresolved | `landing:2461-2465,2868-2873,2938-2943`; split-positive TOI conditions GP |
| 064 | Retain fallback defects | `landing:2544-2564,2721-2766`; state filters disagree, dressed-player remedy needs care |
| 065 | Retain grouping | `landing:3089-3096,4359-4365`; trade-date window issue belongs in 066 |
| 066 | Retain scope issue | `landing:4368-4437`; clarify split appearances and apply dated team-of-record policy |
| 067 | Retain unknown-aware minimum | `landing:4259-4268,4305-4310`; aggregate threshold must not govern each chart point |
| 068 | Retain per-season merge | `landing:4693-4753`; unique game IDs, ratio-of-sums inputs |
| 069 | Retain defect | `landing:4859-4866` plus `:4263-4268`; nondefault TOI minimum clears chart |
| 070 | Retain pooled formula | `landing:4916-4951`; unknown IPP denominator stays null |
| 071 | Retain ratio formula | `landing:4997-5042`; inherited chance/xG inputs not certified |
| 072 | Retain defect, sharpen reach | `landing:805-824,5380-5384,5453-5457,5486-5489`; C3 |
| 073 | Retain clock defect; add team exposure | `landing:929-935`; `teamWriter:281-303`; A2 |
| 074 | Retain exclusion problem | `playerStatsQueries.ts:249-275`; no affected-player count measured |
| 075 | Retain labelled fallback | `playerStatsFilters.ts:222-237,451-459`; not canonical scheduling proof |
| 076 | Retain hole retry issue | Player `playerStatsRefreshWindow.ts:132-144`; goalie/team watermark-only selectors; bounded repair required |
| 077 | Retain incomplete coverage issue | `teamQuery:957-978`; ceil(total rows/2) is not count of fully covered eligible games |
| 078 | Retain inactive legacy finding | `web/lib/supabase/shotsByCoord.js:112-146`; no runtime importer found; do not delete |
| 079 | Retain inherited definition gap | `teamWriter:462-479`; exact NST parity reference still missing |
| 080 | Retain owner-contract violation | `teamWriter:481-515,657-679`; variants/populations and decisions 6/7/12 govern |
| 081 | Retain naming/missing-column defects; add A3 | `skaterMetrics.ts:185-209,337-389`; unmatched exposure corrupts otherwise valid rate algebra |
| 082 | Narrow to estimand/label choice | `skaterMetrics.ts:478-510`; average-player SH% is not inherently wrong |
| 083 | Retain inactive code defect | `fetchSoSgameLog.js:288-304`; self-comparison partitions; no active importer found |
| 084 | Retain legacy qualification | `web/lib/supabase/sosStandings.js`; no active importer found; no deletion/revival |
| 085 | Retain null-sort; qualify rank | `landing:5179-5216`; `teamQuery:784-794,1023-1026`; ordinal versus tied-rank contract |
| 086 | Qualify claimed mismatch | `goalieTrends.js:12-33`; `GoalieWorkloadBars.js:9-19`; denominators agree when complete |
| 087 | Retain heuristic-label caution | `teamLandingDashboard.ts:186-229`; no predictive validation established |
| 088 | Retain predictive-wording caution | `teamRatingNarrative.ts:250-255`; unsupported regression language, not a measured accuracy defect |
| 089 | Retain sound; reject caveat | `percentUnits.ts:39-50,165-175`; null exposure invalidates sample |
| 090 | Retain selector issue, both date orders wrong | `teamQuery:880-901`; distinct-control intent remains open |
| 091 | Retain P0s; add A2 | `teamWriter:326-327,334-346,381,570-605,631-633`; final overlay does not rescue PP/score states |
| 092 | Retain conditional standings defect | `teamWriter:931-965`; preserve unknown-result denominator and source provenance |
| 093 | Reclassify integer-input path as wrong | `web/lib/NHL/TOI.ts:82-90`; reproduced NaN and live zero fallback; frequency conditional |
| 094 | Retain window defect; expand as-of alignment | `xgExplorer.ts:344-395`; independently latest created/core rows and season supplemental sums |
| 095 | Reclassify as wrong/incomplete coverage signal | `xgExplorer.ts:281-327`; A4 reproduced false `ok` |
| 096 | Retain mis-specified percentile | `PlayerPerformanceHeatmap.tsx:43-117,150-175,200-208`; hand-set thresholds/weighted score are not percentiles |
| 097 | Retain ratio algebra | `PlayerRadarChart.tsx:242-253`; cohort and 5v5 changes remain upstream decision 15 |
| 098 | Retain danger/GSAA defects; reject distance endorsement | `landing:3420-3464,3537-3564,5083-5126`; A1 |

## Reproduction recipe and limits

Run fixture code from `web/` with the installed runtime, without loading `.env` files:

```sh
NODE_PATH="$PWD" \
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","jsx":"react"}' \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=offline-fixture \
node -r ts-node/register/transpile-only
```

The fixture loader reads source and exposes private helpers **only in memory**:

```js
const fs = require('fs'), path = require('path');
const Module = require('module'), ts = require('typescript');
global.fetch = () => { throw new Error('NETWORK FORBIDDEN'); };
for (const name of ['http', 'https']) {
  require(name).request = require(name).get = () => {
    throw new Error('NETWORK FORBIDDEN');
  };
}
function load(file, names) {
  const filename = path.resolve(file), m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const source = fs.readFileSync(filename, 'utf8') +
    '\nexport { ' + names.join(',') + ' };';
  m._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true, jsx: ts.JsxEmit.React
  }}).outputText, filename);
  return m.exports;
}
```

Exact fixture specifications:

- **Strength/score:** expose `buildTeamUnderlyingSummaryRowsForGame` and `buildStrengthSegments` from `teamStatsSummaryRefresh.ts`. Game 100, season 20262027, type 2, date 2026-11-08, home 10/away 20. Two period-1 `REG` faceoff events at 0 and 1,200 seconds, sequential IDs/orders, situation `1451`, exact `4v5`, null home/away scores. One `shot-on-goal` feature owned by home 10, owner side home, both goalies present, owner pre-event score difference zero, distance 30 ft/angle zero, goalie 31; `isGoal`, `isOwnGoal`, `isShootoutEvent` false. Supply `{game, shotFeatures:[shot]}` as `gameParity`. Select home PP/allScores, PK/allScores and allStrengths/tied rows.
- **Terminal OT:** reuse the event shape, period 4/type OT/situation `1331`; faceoff at 0, home goal at 60 (score 1–0), period-end and game-end at 60, all ordered distinctly. Pass to `buildStrengthSegments(events,10,20)` and sum end minus start. No `time_remaining_seconds` is supplied, matching the actual source select omission.
- **Distance:** expose `defaultAggregateMetrics` and `accumulateLandingMetrics` from `playerStatsLandingServer.ts`. Start with default metrics. Add two goalie contexts for player 31 with `hasReliableToi:true`, `shotFeatures:[]`, TOI 600 each; other danger/rush/rebound counts zero. Context A: SA 10, saves 9, GA 1, xGA 1, mean shot distance 10, null goal distance. Context B: SA 1, saves 1, GA 0, xGA 1, mean shot distance 50, null goal distance. These means represent one known-distance shot in each context. Inspect `goalies.shotDistanceTotal/shotDistanceCount`; correct known-distance mean is 30. The downstream context fixture tests the weighting; raw-event coordinate coverage is established separately by the cited upstream source.
- **Missing variance TOI:** call exported `buildSkaterAdvancedMetricsRows` with player 1/name Fixture, dates Nov 1 and Nov 2, GP 1, goals 1, shots 2 each, TOI 1,200 and null; empty weekly aggregates and valuation mode `ownership`.
- **Coverage:** call `buildXgExplorerCoverageReport({scope:'players',sourceRows:100,supplementalRows:100,createdRows:100,transitionRows:0,reboundRows:0})`.
- **WGO:** call `aggregateWgoTeamGames` with `{games_played:1,power_play_goals_for:1,pp_opportunities:2}` and the same row with `games_played:null`.
- **TOI parser:** call exported `parseTime` with the three strings in the evidence table.
- **Team sort/window:** expose `sortRows` and `applyScopedRowWindow` from `teamStatsQueries.ts`. Sort three `{teamLabel,v}` rows with v null/.3/0 by `{sortKey:'v',direction:'desc'}`. For the window, use the default state with `scope:{kind:'teamGameRange',value:1}` and team 10 rows id 100/date Nov 10 and id 200/date Nov 9.

**Not run:** production/database/provider checks; full app suite; lint/typecheck/build; browser validation; data repairs. No deployed-schema, live freshness or production-impact claim was established by these local checks. The audit's 106-game/212-team-game strength and score-state sample, 277-game fallback-frequency sample, six WGO rows and 3,208-team-game outcome sample were not re-read. No production read authorization from an older audit was reused.

**Work record:** began with named audit/prompt/owner decisions and clean ownership of this report; recorded an initial checkpoint here; independently tested the principal defects and new coverage/exposure cases; completed 101 focused tests; reviewed the final report and file scope. Only this deliverable was intentionally written. Remaining decisions are the clarified split/window/label/source choices above, not permission to implement or rebuild.

## Deeper review: end-to-end contracts and repair invariants (2026-11-11)

**Work checkpoint:** Reopened on the same HEAD for a deeper, bounded review of the highest-impact conclusions, rather than increasing finding count. Trace writer-to-reader behavior, challenge proposed fixes with offline counterexamples, and distinguish proven code defects from unmeasured production prevalence. This section is the only owned write; no application edits, provider calls, production access, or rebuilds are authorized.

### DR1. Repair destination is part of correctness, not an operational afterthought

**High-confidence source finding; deployed schema/traffic not measured.** The phrase “rebuild player/goalie partitions” above is insufficient as an implementation instruction:

- Public `/api/v1/underlying-stats/goalies`, goalie detail and goalie chart use `goalieStatsServer.ts:15-43`, which delegates to the player landing/detail/chart service. Its shared partition reader selects `nhl_api_game_payloads_raw` (`playerStatsLandingServer.ts:1402-1515`) for the `derived://underlying-player-summary-v2/goalies/...` URLs. The direct PostgreSQL branch selects the same table.
- `refreshGoalieUnderlyingSummarySnapshotsForGameIds` instead writes **`goalie_underlying_summary_partitions`** (`goalieStatsSummaryRefresh.ts:215-237,305-313`). It does not publish those corrected payloads to the shared raw-payload table. Thus a successful goalie-only refresh is not evidence that these public readers have been repaired, even with `preferSharedSnapshotSeed:false`.
- The default refresh path reads old shared snapshots first. **Any shared snapshot for a game** adds it to `seededGameIds` and prevents a raw build of that whole game (`:285-303`). An offline fixture supplying exactly one stale shared partition yielded `rowsUpserted:1`, `seededGameIds:[100]`, `rawBuildGameIds:[]`, and copied its unchanged sentinel into the dedicated goalie table. Setting `preferSharedSnapshotSeed:false` did invoke the stubbed raw builder for `[100]`.
- This default is not used by every caller: `update-goalie-underlying-stats.ts:203-212` and the catch-up/raw-backfill paths explicitly pass false. However, `update-goalie-underlying-summaries.ts:252-259` enables seeding for `backfill_batch`, and `backfill-goalie-underlying-season.ts:184-192` explicitly enables it for summary-only backfill. Do not claim all refreshes seed stale data.
- The player refresh has an analogous optional **migration, not recalculation** path: `shouldMigrateLegacySummaries:true` repartitions old payloads and skips the raw build for migrated games (`playerStatsSummaryRefresh.ts:239-258`). A mathematical repair must not use that path as proof of recomputation.

**Consumer proof:** With an injected offline client, the actual goalie-state summary-fetch helper read only `nhl_api_game_payloads_raw`. A structurally accepted version-1 payload with no rows still counted as a present game and suppressed fallback (`missingSummaryGames:0`, returned rows 0). This does not establish that such empty payloads occur in production; it proves that presence alone is not row/partition completeness.

The checked-in goalie-table creation migration and schema-baseline references show no table-specific mirroring trigger. An uninspected deployed mechanism could alter the operational picture, so verify it under future authorization rather than assuming it exists or asserting its absence in production.

**Required repair receipt:** name the reader, exact storage keys it selects, source/input revision, formula revision, expected rows, and observed recomputed output. Repair the shared serving partitions as well as any dedicated copy that remains required, or explicitly change and test the reader contract. Neither an updated dedicated-table timestamp nor a positive upsert count proves public repair. Do not expose old shared fallback partitions as corrected results if a new partition is absent.

### DR2. The special-teams fix must align populations, not only string orientation

**D1 remains proven. An orientation-only patch fails a second, independently demonstrated case.** Parity classifies any absent goalie as `EN` before PP/SH (`nhlStrengthState.ts:87-105`); parity PP/PK inclusion requires that classified state (`nhlNstParityMetrics.ts:713-719`). Team and supplementary-goalie matchers instead use the skater inequality directly (`teamStatsSummaryRefresh.ts:421-427`; `playerStatsLandingServer.ts:1785-1791`). These are different populations even with the two integers correctly oriented.

**Adversarial offline test:** change only the reversed integer extraction **in memory**, leaving every source file unchanged. For situation `1560` (home six skaters, own net empty; away five skaters with goalie), the away goalie supplemental filter starts including the event in `penaltyKill`, while the parity PK predicate remains false (`EN`). Then give that goalie 60 seconds of real PK exposure and one real PK high-danger save. Add a separate high-danger goal during that 6v5 EN interval. The actual accumulator and API mapper return:

| Output within the PK row | Result |
|---|---:|
| Total GA from parity | 0 |
| HD GA from supplementary features | 1 |
| HD shots / HD saves from parity | 1 / 1 |
| HD SV% | 100% |
| HD GAA | 60 |

The positive real PK exposure is important: `buildGoalieContextsForGame` first drops parity rows with TOI ≤ 0 (`:2938-2943`). An EN-only game is not sufficient to prove this row reaches the consumer. The fixture supplies real PK exposure and traces the contradictory output through `accumulateLandingMetrics` to `mapLandingAggregationRowToApiRow` (`:3537-3564,5080-5116`). This is not the existing MD/LD duplicate-goal defect; it uses HD precisely to avoid that confound.

**Fix contract:** one agreed relative manpower/net-state predicate must govern time, base shots, supplementary danger metrics and PBP fallback. Retain both goalie flags and the team perspective. Do not infer real PP merely from 6 > 5. If the intended NST convention treats an extra-attacker state differently from current parity, change all relevant paths together and obtain a reference fixture; this review has not independently established that external convention. Decision 7's empty-net xG exclusion is a separate constraint, not permission to redefine every count split.

**Acceptance invariants, on explicitly matching populations:**

- For each included event, home PP-for corresponds to away PK-against, and away PP-for to home PK-against; reversing home/away IDs preserves this mirror relationship. Neither PP-for ≥ PP-against nor a league-average range is a valid single-game oracle.
- True 5v4/4v5, 5v3/3v5, 4v3/3v4, 3v3, 6v5/5v6 with one goalie absent, both-goalie-present six-skater cases, and unknown/invalid codes must have declared inclusion. Keep unknown separate from known zero.
- On ordinary credited save/goal shots with the same own-goal policy, bucket SA = saves + GA. HD/MD/LD plus an explicit unknown-geometry bucket reconcile to that same shot population; do not force known-geometry buckets to sum to all shots when coordinates are missing.
- Do not require all listed UI strengths to sum to allStrengths: 5v5 is a subset of evenStrength, 5v4 a subset of PP, and empty-net filters may overlap unless deliberately defined as a partition. State a mutually exclusive reconciliation basis first.

### DR3. Exposure has to survive from source evidence to final aggregation

**The A2 terminal-boundary fix and D2 running score fix are necessary, but not sufficient.** `buildStrengthSegments` skips an interval when the starting event lacks a situation code (`teamStatsSummaryRefresh.ts:281-304`). It returns no explicit gap or coverage measure. An offline period with a faceoff at 0 lacking a code, a known-state shot at 300, and period end at 1,200 produces only `[300,1200]`, i.e. 900 seconds. This proves a partial observed interval set can look like a complete numeric denominator. It does not authorize inventing which strength applied during the first 300 seconds.

There is also a useful negative control for A2: an OT faceoff at 0, goal at 60, and terminal event at 60 **without** a situation code produces only `[0,60]`. When that last marker has a valid code, the original fixture produces the spurious `[60,300]`. The defect depends on terminal-event contents, so “all overtime TOI is inflated” would overstate the evidence. Selecting `time_remaining_seconds` alone still does not solve sudden death: elapsed 60 plus remaining 240 is the scheduled 300-second period, not the 60 seconds actually played.

**A naive nullable fix also fails at the next boundary.** `teamStatsQueries.ts:305-347` uses numeric `+=` for TOI and counts. In JavaScript, adding null adds zero. Passing two summary rows with one CF each and TOI 1,200/null through the actual accumulator and API mapper returns GP 2, CF 2, TOI 1,200, CF/60 **6**. Therefore, simply making the writer/schema emit nullable TOI reproduces the A3 complete-count/incomplete-exposure error in the team reader. The current writer's numeric type makes this a **counterexample to a proposed repair**, not evidence of existing nullable team rows in production. A genuinely missing interval can already be encoded as an understated number instead.

**Required temporal/coverage contract:**

1. Sort by game, period, elapsed clock and event order. Use half-open intervals. Set actual period/game terminal bounds from evidence; account separately for regular-season and playoff OT. Retain unknown duration when evidence cannot establish it.
2. On a complete feed beginning at the game start, initialize 0–0 and carry goals forward. On a truncated feed, do not assume earlier scoring was zero. Use pre-event score for a goal's counts and post-event score for subsequent positive-duration exposure. Same-clock goal/stoppage/terminal events create no extra time.
3. For complete coverage, tied + any-leading + any-trailing equals all-score duration; upOne is a subset of leading and downOne of trailing, and withinOne = tied + upOne + downOne. Do not sum all seven score filters as though they were disjoint. Mirror home leading against away trailing, including event attribution.
4. Carry a completeness/unknown indicator from intervals through stored rows, merges, minimum-TOI eligibility and final per-60 calculations. Unknown exposure must not become zero or a partial denominator. If a complete-case rate is offered instead, report its restricted game set and exclusions. The same count/exposure population rule applies to variance PP TOI, goalie danger rates and repaired CF/60.
5. Counts can remain useful when TOI is unknown, but the rate and minimum-TOI eligibility must follow an explicit unknown policy. Fixing null placement cannot recover a row removed earlier by a minimum filter.

The fixtures establish failure modes and test oracles, not live missing-event prevalence. No source/provider completeness audit was performed.

### DR4. Null sorting is an API selection defect; test the fix before pagination

The writer-to-consumer chain is direct: undefined ratios become null; `sortLandingApiRows`/team `sortRows` reverse the comparison for descending order; only then are pages sliced (`playerStatsLandingServer.ts:5179-5243,5290-5312`; `teamStatsQueries.ts:784-794,1023-1037`). With a one-row page, the unknown player is the whole first page. A UI-only sort cannot repair server-selected page membership, and replacing null with zero silently changes its meaning and placement relative to real zeros or negative GSAA.

**Candidate fix challenged offline, not applied:** insert an exclusive missingness comparison before direction is applied, preserving the both-missing tie and existing fallback keys. Run all 120 permutations of five rows (null, undefined, zero, .3, .3), both directions, through the actual player/goalie and team sorters with that tiny **in-memory** change: **480 sort cases passed**. Each case also verified that concatenating pages of size two reconstructs the entire expected order without loss or duplication. Both equal finite values and both-missing values followed the existing deterministic name/label fallback.

This validates the proposed missingness branch over the tested contract, not a committed fix. Keep nonfinite-number handling at input validation, and add true route/pagination regression tests when implementing. Do not introduce sporting rank semantics as part of this repair; the ordinal-versus-rank choice in C4 remains distinct. No data rebuild is needed for a comparator-only change, but cached responses may still serve the old ordering until refreshed.

### DR5. A bounded rebuild needs key-level completeness and generation-level consistency

**A “two team rows” check is not a repair-completion check.** The current team writer generates 2 teams × 10 strengths × 7 score states = **140 rows per eligible game**, in team-first order (`teamStatsSummaryRefresh.ts:992-1046`), then writes batches of 100 (`:1057-1078`). An offline injected client accepted batch one and failed batch two. The actual generated rows left **70 home rows, 30 away rows, and both allStrengths/allScores rows** written before the exception. Thus both the API's all/all row-count coverage and a stronger two-team all/all check can appear complete while 40 split keys are still absent or stale. This is a proven partial-write possibility, not a measured production occurrence.

The checked-in coverage selector `fetchSeasonTeamSummaryGameIdSet` requires two positive-TOI all/all team rows (`:1120-1177`), but it does not check all split keys or their generation. D15 should distinguish basic game coverage from **repair completeness**. In the interruption example with positive all/all TOI, the basic selector can skip the incomplete game on a future missing-game-only pass. A retry based on an explicit repair manifest must revisit it.

**Before any future execution, the repair plan must specify:**

- **Exact scope:** explicit game IDs, seasons/types, source revision, formula revision, affected metrics/keys, and bounded read/write/request budget. A date-before-today selector (`:1212-1242`) is not evidence that postponed/suspended games are complete. Do not use normal “missing summary” detection to select already-present bad mathematics.
- **Actual recomputation:** derive from approved normalized event/shift evidence, not legacy repartitioning or shared-snapshot copying. Record the source key/hash used per game. Existing payload version 1 and the `...-v2/` source prefix (`playerStatsLandingServer.ts:215-222,4011-4022`) are not themselves evidence of the new mathematical generation.
- **Expected key sets:** compare generated versus stored keys per game and serving destination, plus output hashes/values. Team's current 140-key product is exact under current supported filters; player/goalie partitions are generated from contexts and need their own explicit expected set rather than a hardcoded “70 partitions.” Known no-exposure partitions and missing/failed partitions must be distinguishable.
- **Atomic visibility or guarded partial state:** a failure between batches must not present mixed old/new results as a fully repaired generation. Use a transaction/staged generation or an equivalent completeness gate, with resumable per-game receipts. Test interruption after any successful batch, retry, and idempotence against identical inputs. Compare semantic payloads separately from volatile timestamps.
- **Stale-key handling:** upsert does not remove obsolete keys. `findStaleTeamSummaryKeys` only reports them (`:1191-1209`); `reportStaleKeys` is not deletion or reconciliation. Plan reversible, authorized stale-key handling before dropping old contributions. Rebuilding only positive/new rows can leave old nonzero rows visible after a game/team/population correction.
- **Serving and caches:** verify the exact shared/raw payloads consumed by landing/detail/chart, not just the dedicated goalie destination (DR1). The season aggregate cache is process-local with a ten-minute TTL; player refresh clears its local cache after a write, while dedicated goalie refresh does not directly clear it. “Warm” calls can reuse an existing cached aggregate and only warm default state profiles (`playerStatsSummaryRefresh.ts:115-155`; `goalieStatsSummaryRefresh.ts:316-324`). A cache clear in a writer process does not establish invalidation in other serving processes. Public stats routes also specify private max-age 60 / stale-while-revalidate 300. Verify cold and warm consumers at an agreed generation after expiry/invalidation rather than treating `generatedAt` as source freshness.
- **Independent readback:** compare deterministic fixture expectations and stored recomputed values, then the actual landing, detail and chart mapped values for the same filters/game set. Exercise team official-overlay on/off/mismatched coverage as in C5. Reconcile counts, valid-distance sums/counts, unknown coverage, score-state conservation and selected strength populations. Repeated successful upserts and green compatibility tests are not this acceptance evidence.

**No execution permission is implied.** Repair, migration, schema change, deletion, cache operations and production readback all remain separately scoped future work.

### Deeper verification record and limits

This pass used sequential sub-second, offline Node processes with installed `ts-node`/TypeScript, inert Supabase configuration, and denied fetch/HTTP/HTTPS/socket connections. No `.env` file was loaded. The private-helper loader in the earlier reproduction recipe was reused; the orientation and null-comparator candidate changes existed only in its in-memory source string. Injected clients returned fixture rows and recorded calls; they did not contact a database.

Additional fixtures completed: extra-attacker filter versus parity and downstream goalie API mapping; incomplete initial exposure; null-situation OT terminal control; candidate-null team accumulation; player first-page sort; single stale shared goalie seed and forced-raw control; public goalie summary reader target/empty accepted payload; interrupted real 140-row team write; and 480 candidate-comparator permutation cases with page reconstruction. Exact small fixture values and expected results are above. To reproduce the seed test, inject one `derived://underlying-player-summary-v2/goalies/allStrengths/100` row with game 100, season 20262027, date 2026-11-08, string timestamps/hash and a sentinel payload; stub the raw builder to record game IDs and return an empty array, and record `.upsert` table/rows. For the interruption test, call the real team row builder for home 10/away 20 with empty event/shot arrays, then have the second 100-row-batch upsert return an error; the retained row/key counts are independent of the deliberately zero metrics.

One initial harness pass stopped after the successful seed tests because its Supabase mock returned a Promise from `.range()` before the real reader appended `.in()`. The follow-up changed the mock to a chainable thenable and completed the reader/interruption checks. This was a harness error, not a product defect or an unverified retry of a real write.

No existing application suite was rerun merely for this documentation-only pass; the earlier 101-test result remains the earlier pass's result, not a new run. No production rows, provider pages, browser/application endpoints, schema deployments, app source edits, commits or pushes occurred. No current-production impact percentage, true NST extra-attacker convention, deployed trigger/cache topology or source-feed completeness claim is established. The review identifies concrete failed fix strategies and the evidence a safe repair must supply; it does not certify an implementation that has not been made.

**Closing work checkpoint:** source and consumer traces, adversarial fixtures, repair invariants and limits are complete on HEAD `3e81061cb60105e984ae7724365b2d9f22ba6d11`. Only this individual review was intentionally appended; earlier review text and other agents' files were preserved.

# Pre-upsert strength mathematics review

2026-11-12, canonical `octoberBranch`, observed HEAD `ee2b1c19c5cfc261e5242f48a63b1eafe79091da` plus the ongoing local interval-union changes. The initial mathematical review was read-only; the subsequently authorized nominal-period correction is recorded at the end. No provider requests, database requests, or production execution. Root owns independent fixture/official-total comparisons. Evidence uses the five already-captured games in `live-replay.json` and the actual local functions with remote-capable imports blocked. Initial-audit line references describe the pre-correction source.

**Latest local state:** nominal-period validation and shared penalty-span exposure integration are implemented and pass focused checks. The captured five-second expiry counterexample now calculates ES correctly. Root's independent source qualification/release review remains separate; no global observed-PP qualification flag was promoted.

## Material findings

### 1. Event-state carry-forward overstates PP/PK after live penalty expiry

**Proven on captured source and actual calculation code; high priority.** `web/lib/projections/ingest/shifts.ts:228–258` sorts events, chooses the last situation at each clock time, then assigns that observed situation to the entire interval until the next event. No expiry boundary is inserted. The later sum/coverage checks prove conservation, not correct classification.

Captured game `2026020009`, period 1:

| Evidence | Clock | Source state |
| --- | --- | --- |
| Penalty event `211`, team 4, MIN duration 2 | 07:19 | `1551` before penalty |
| Resulting faceoff | 07:19 | `1451` home PP / away PK |
| Last PP faceoff `237` | 09:17 | `1451` |
| Minor expires, with no event required | **09:19** | Penalty advantage ends |
| First later ES hit `247` | 09:24 | `1551` |

No intervening goal or new penalty changes this simple minor. Its duration field supplies the independent 120-second clock. The algorithm therefore incorrectly classifies **09:19–09:24**, five seconds, as home PP / away PK. Both captured goalies' shifts cover the entire interval.

Executed actual `buildShiftStrengthUpserts` against the captured PBP and the two captured goalie identities/metadata, clipping their shifts to precisely `[09:19,09:24)`:

| Player / team | Actual result ES/PP/PK | Required by expiry |
| --- | --- | --- |
| `8474596` / 1 | `0:00 / 0:05 / 0:00` | `0:05 / 0:00 / 0:00` |
| `8479361` / 4 | `0:00 / 0:00 / 0:05` | `0:05 / 0:00 / 0:00` |

A second period-1 minor at **11:31** ends **13:31**, but next ES hit is **13:45**: another 14-second team-state error. This is not corrected by physical interval union and cannot be detected by ES+PP+PK=total or total<=game-length checks.

The independently located [NHL 2025–26 official rules, rule 16.1](https://media.nhl.com/site/asset/public/ext/2025-26/2025-26Rules.pdf) describes the ordinary minor as two minutes with no substitute. The current captured penalty itself explicitly carries duration 2. The PDF's full text exceeded browsing size limits; no claim of a complete current-2026–27 rulebook review is made.

### 2. Nominal-period validation permits internally consistent impossible regulation clocks

**Reproduced malformed-input acceptance; no affected live game established.** `shifts.ts:157–167` checks that `timeInPeriod + timeRemaining` is positive and constant; `212–216` checks only that played end is within that supplied nominal length. It never verifies the nominal length against game/period type.

Local probe altered only captured game `2026020009` period-1 `timeRemaining` values to `1300 - elapsedSeconds`, so every event implied **21:40 regulation** while the terminal remained 20:00. Actual `buildShiftStrengthUpserts` accepted both clipped player rows. Consistency alone therefore does not establish a legal period. A focused validation should require regulation nominal 1200 seconds, regular-season OT nominal 300, playoff OT nominal 1200, preserve shortened sudden-death *played* ends, and exclude shootout time. Historical exceptional/preseason formats need an explicit supported policy rather than guessed acceptance.

## Intended contract and what event situations mean

Owner decisions are explicit in `tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md:249–260`:

- Decision 70: PP/PK reflect actual penalty advantage; 4v4/3v3 without an advantage are ES. Empty-net is an overlapping attribute. Events and exposure use one classification; exclusive totals reconcile.
- Decision 71: a simulation becomes observed PP time only after official-record/source-definition/coverage qualification. Modeled FORGE inputs remain labeled as modeled. Do not cap impossible shares.

`derived/situation.ts:38–54` implements the approved pulled-goalie adjustment (subtract one extra attacker when a net is empty). It is algebraically consistent with approved normal examples, including 6v5 ES and 6v4 PP. This review does **not** redefine that shared other-owner classifier.

The captured feed disproves the assumption that every event describes an after-event state:

- A penalty event at 07:19 carries pre-call `1551`; same-clock ensuing faceoff carries `1451`.
- Game `2026020298`, P3 goal `843` at03:28 carries `1541` (the strength of the scoring event), while ensuing faceoff `844` at03:28 carries `1551` (post-goal strength). Similar PP-goal/faceoff pairs occur in games0115 and0159.
- Taking the last sorted same-clock event is useful for the *following* interval when the resumption event exists. A goal's own classification must retain its event state. Replacing every event state with the next state would misclassify PP goals.
- Expiry and goalie substitution can occur between events. No choice of previous versus next event alone identifies their exact boundary. Carry-backward would fix some expiries but move other transitions too early.

## Existing reusable penalty-clock implementation

**Reuse candidate found; qualification remains open. Do not create a second independent penalty engine without need.**

`web/utils/getPowerPlayBlocks.ts` default export is a penalty-box simulator:

| Concern | Existing location / behavior |
| --- | --- |
| Minor, double-minor halves, major; misconduct excluded | `321–332` |
| Coincidental cancellation and same-player sequencing | `339–377` |
| At most two serving, waiting queue | `379–394` |
| Expiry, goal-ended minor selection, penalties at stoppage | `437–480` |
| Non-overlapping PP spans | `405–485` |
| Compare simulated advantage with event observations, skip boundary-state ambiguity | `auditPpBlocksAgainstSituationCodes:522–565` |
| Observed-source qualification contract | `576–585`, `PP_CLOCK_QUALIFIED=false:589`, `buildTeamPpClock:593+` |

The same file's **named** `getPenaltyPowerPlayBlocks` at201 is legacy per-penalty output, explicitly documented at192–194 as *not manpower*. It should not supply this correction. `extractPPDetails` likewise is not a qualified replacement.

Executed the actual default simulator and audit, offline, on the five captured games:

| Game | Home PP seconds | Away PP seconds | Checked event states | Disagreements | Qualified |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026020009 | 480 | 120 | 350 | 0 | false |
| 2026020115 | 422 | 360 | 342 | 0 | false |
| 2026020159 | 214 | 120 | 316 | 0 | false |
| 2026020205 | 120 | 120 | 317 | 0 | false |
| 2026020298 | 523 | 272 | 325 | 0 | false |

Game0009's first three PP blocks end at09:19,13:31,17:29, resolving the demonstrated missed-expiry boundaries. These outputs are candidate simulation evidence, **not** independent official qualification. Event-sample agreement cannot validate unsampled seconds. The simulator still needs supported-period mapping, explicit team identity, schema/finality guards, and the official comparison root owns before a stronger claim.

A second implementation exists in `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:709–798`: expiry boundary heuristics. It covers minors/double-minors/majors and cross-period absolute timing. However `844–855` takes only the first expiry in each event gap and borrows the next event's entire situation after it. It cannot represent multiple intermediate state changes in one gap and may move goalie or other changes backward. Do not promote it to an exact clock merely because its focused fixtures pass.

## Boundaries, units, conservation, and remaining evidence limits

- Strict ingest clocks use `shiftChartCompleteness.ts:60–70`: integer minutes, two-digit seconds00–59, safe integer total. Physical unions and overlaps use integer-second half-open intervals. Adjacent intervals create no extra second; gaps are retained. `formatSecondsToClock` rounds, but valid inputs in this path are already integers, so no arithmetic rounding loss occurs. The generic permissive `ingest/time.ts` parser is not the strict validator used in the strength calculations.
- Actual timeline checks cover missing/malformed clocks, inconsistent elapsed+remaining, missing/duplicate period starts, conflicting/missing terminals, and events beyond terminal. They cannot establish physical state between sparse events or certify complete player coverage. The nominal-length hole above remains.
- A PP goal ending a simple minor is correctly bounded when same-clock resumption exists in these captures. Major penalties must survive goals; double-minor goals end only the current half; coincidental and queued penalties require penalty-box state, not independent two-minute timers. The existing simulator models these cases, but this lane did not independently certify all combinations.
- Regulation-to-OT carryover needs elapsed game-clock continuity and correct OT numerical rules. [NHL 2025–26 rule84.3](https://media.nhl.com/site/asset/public/ext/2025-26/2025-26Rules.pdf) describes the OT adjustment at the first stoppage after an advantage ends. Exact nominal manpower and PP classification should remain distinct. Captures do not independently cover every playoff/multiple-OT/carryover case.
- Delayed penalties and pulled-goalie examples in the captures preserve decision70's ES/PP/PK distinction. Sparse flags cannot certify the exact empty-net transition instant; goalie shift evidence is a separate cross-check. The current strength segment type does not persist an empty-net attribute. Do not claim all instantaneous strength/net-state changes are observed exactly.
- The exhaustive situation-code test derives its expected output from the same effective-skater formula as production. It proves implementation consistency, not an independent NHL-context oracle. Similarly, conservation tests cannot detect the demonstrated reassignment of five seconds from ES to PP/PK.

## Focused correction proposal

1. Retain physical unions and strict raw-source/provenance preservation.
2. Reuse/adapt the **default penalty-box simulator's non-overlapping spans** as the penalty-advantage timeline, with explicit game teams and validated period boundaries; split player physical intervals on every span boundary. Keep the current shared event classifier unchanged in this bounded task. A pure helper extraction may be necessary because the existing utility also imports hooks/React/network UI helpers; coordinate its exact file ownership first.
3. Preserve decision71's unqualified/model-source status until root's official comparisons qualify the supported scope. Failing coverage/context must remain visibly unknown or unqualified rather than silently converted to exact observed zeros. Reconcile event and exposure semantics deliberately; do not alter the event state of a PP goal to its post-goal faceoff state.
4. Add focused existing-file regressions for actual09:19 expiry, simple goal-ended minor versus major, both double-minor halves, coincidental/overlap/queue cases, OT carryover and expiry, and delayed-penalty extra attacker. Compare to independently enumerated expected intervals/official team exposure, not the algorithm's own formula. Nominal-period validation deserves its own small malformed-clock test.

At the initial review checkpoint, no correction had been implemented. Root subsequently authorized only nominal-period validation; the penalty-state timing correction remains root-owned and outstanding.

## Checks actually run

- Actual local clipped-goalie calculation against captured2026020009: reproduced PP/PK five-second error.
- Actual local malformed nominal-clock probe: reproduced acceptance of21:40 regulation nominal.
- Actual default simulator + event-audit replay: five games, outputs above, no remote effects.
- `npm test -- --run lib/supabase/Upserts/nhlNstParityMetrics.test.ts -t 'penalty-expiry TOI'`: **5passed,19skipped**.
- `npm test -- --run utils/getPowerPlayBlocks.test.ts`: **6passed**.

Not run during the initial review: new regression edits, full suites, type check/build, SQL/provider/database execution. Existing passing tests establish their specified fixtures only; the mathematical audit is **not clean** and the strength timing correction remains outstanding.

## Authorized nominal-period correction

Implemented finding2 only in `web/lib/projections/ingest/shifts.ts` and its existing `shifts.test.ts`. `buildSituationTimelineForPeriod` now receives the game's type and validates every physical period's descriptor and nominal clock:

- Periods1–3: `REG`, nominal1200 seconds.
- Preseason/regular-season period4: `OT`, nominal300 seconds.
- Playoff periods4 and later: `OT`, nominal1200 seconds.
- Inappropriate physical periods/types are rejected; a shortened sudden-death **played** terminal remains supported. Shootout events without physical shift rows are unaffected.

The snapshot/hash contract and exclusive strength-label timing were not changed by this patch. Existing goalie-union synthetic fixtures now declare proper five-minute OT nominal clocks and remaining time. Added seven rejection cases (21:40regulation, wrong regular/playoff OT length, wrong REG/OT type, physical shootout, second regular-season OT) and extended shortened-OT acceptance cases to preseason and a second playoff OT.

Regression-first verification demonstrated acceptance of the invalid inputs before implementation. Final checks:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/projections/ingest/shifts.test.ts
npm test -- --run lib/projections/ingest/shifts.storedSnapshot.test.ts lib/projections/ingest/projectionInputPersistence.test.ts
npx eslint lib/projections/ingest/shifts.ts lib/projections/ingest/shifts.test.ts --report-unused-disable-directives-severity warn
```

**46 strength tests passed;10 snapshot/persistence tests passed; scoped ESLint and diff-check passed.** Actual offline canonicalization accepted all five captured games under the new validation (row counts809/742/788/805/771 in ascending game order). No global type check/build or remote operations in this lane. Finding1 remains unresolved by this nominal-period-only patch.

## Authorized shared penalty-clock exposure integration

Root subsequently supplied the pure `web/lib/projections/penaltyClock.ts` engine and authorized integration in the same two ingestion files. `buildShiftStrengthUpserts` and `buildShiftRelationshipStrengthSegments` now call `buildPenaltyClock(plays,{homeTeamId,awayTeamId})` and intersect its non-overlapping absolute PP spans with each validated played period. Between spans, exposure is ES; within a span, the advantaged team is PP and its opponent PK. A single shared segment classifier serves both outputs.

The former sparse-event carry-forward exposure construction is removed. Strict event clocks, situation syntax, nominal/played-period validation, physical unions, zero-end handling, and immutable source hashing remain. Root's engine rejects invalid/ambiguous penalty contexts and unexplained interior manpower disagreements before strength persistence; there is no fallback to old situation interpolation. The event classifier in `derived/situation.ts` and `PP_CLOCK_QUALIFIED` in the display utility were not changed by this lane.

Five integration regressions were added to existing `shifts.test.ts`:

- Captured event timing: minor07:19 ends09:19 despite the next ES event09:24; both players' five-second interval is ES in totals and relationship segments.
- Double-minor first-half goal: half ends at01:30, next half expires03:30; PP exposure is2:30 rather than the old2:45 event-gap interpolation.
- Major survives goal: five minutes of PP exposure, rather than old5:15 interpolation.
- Regulation19:30 minor carries into OT and expires01:30; the sparse01:30–01:45 interval is ES in both outputs.
- Unexplained interior PP state with no penalty rejects **before** strength invalidation/upsert; relationship segmentation also rejects.

Existing PP fixtures had changed manpower flags without penalty details or ended PP after30seconds without an ending goal. Those were explicitly reconciled to a real minor plus same-clock PP-ending goal. The reversed-source-order fixture now tests true penalty context with proper pre-call and ensuing-faceoff states, including the opponent's PK exposure. No stale-state fallback was added to preserve impossible fixtures.

Final integration verification:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/projections/ingest/shifts.test.ts lib/projections/ingest/shifts.storedSnapshot.test.ts lib/projections/ingest/projectionInputPersistence.test.ts lib/projections/ingest/shifts.htmlFallback.test.ts
npx eslint lib/projections/ingest/shifts.ts lib/projections/ingest/shifts.test.ts --report-unused-disable-directives-severity warn
```

**73 tests passed across4files** (strength51, stored snapshot5, persistence5, HTML fallback12); scoped ESLint and diff-check passed. An additional actual-code offline replay against the *unmodified captured*2026020009 PBP and clipped goalie source rows now returns:

| Player | ES | PP | PK | Relationship segment |
| --- | --- | --- | --- | --- |
| 8474596 | 0:05 | 0:00 | 0:00 | ES0:05 |
| 8479361 | 0:05 | 0:00 | 0:00 | ES0:05 |

This resolves finding1's concrete counterexample locally. Root owns engine implementation evidence, broader independent interval/official-source comparison, materializer versions, deployment, and any approved data repair. This lane made no remote requests/writes and ran no global type check/build. No production values have been repaired by this work.

## Final affected-route integration verification

After root's current shared engine and version updates, ran this focused mocked integration set once:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts __tests__/pages/api/v1/db/update-PbP.test.ts __tests__/pages/api/v1/db/build-projection-derived-v2.test.ts lib/projections/relationshipMaterialization.test.ts lib/projections/ingest/projectionInputPersistence.test.ts lib/projections/derived/projectionDerivedQueue.test.ts lib/projections/derived/projectionDerivedPersistence.test.ts
```

**112 tests passed across10files.** Negative-case source/guard/audit logs were expected; there were no test failures or runtime changes made by this verification lane. These tests mock service boundaries; they do not establish live SQL acceptance or source qualification.

One stale self-consistent fixture remained: `shift-charts.queue.test.ts` mocked and expected the old `projection-input-materializer-v2-interval-union` literal. Updated only that existing test's mock and assertion to read the actual exported `PROJECTION_INPUT_MATERIALIZER_VERSION` (current root version `projection-input-materializer-v3-penalty-clock`), preserving its hash-function mocks and concurrent changes. Reran only the changed file with `--silent`: **2 tests passed**. Diff-check passed. The112 total includes these same2tests; the rerun is not an additional unique-test claim.

No additional app implementation edits, full suites, type/lint runs, provider/database requests, or deployment in this final verification lane. Root owns remaining combined type/lint/replay evidence and release decisions.

## Shared-consumer fixture compatibility

Root's subsequent shared-consumer run found18failures caused by incomplete synthetic penalty identities:17PP-combinations game tests omitted event IDs; one ShiftChart overtime fixture omitted the penalized player's identity. Corrected only the two existing test files:

- `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`: shared synthetic play helper now supplies deterministic unique IDs. Fixed opening faceoffs retain1/2; each test resets subsequent IDs to3. Penalty identity and chronological tie order are explicit.
- `web/components/ShiftChart/model.test.ts`: the overtime minor now identifies existing away-roster player201 as offender.

All existing numeric and behavioral assertions remain unchanged. No production guards, runtime implementations, or expectation values were relaxed. Ran only the previously failing files:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run __tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts components/ShiftChart/model.test.ts --silent
```

**58 tests passed across2files** (42PP-combinations,16ShiftChart model), with diff-check passed. Run log: `/tmp/fhfh-penalty-consumers-fixture-fix.log`; root's prior failing run remains `/tmp/fhfh-penalty-consumers.log`. Root's other60passing consumer tests were not rerun unnecessarily. These are additional fixture/consumer checks, not a new independent qualification claim.

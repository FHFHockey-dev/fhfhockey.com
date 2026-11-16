# Shift ingestion audit — 2026-11-12

- Scope: read-only trace from update-nhl-shift-charts through nhlRawGamecenterRoute writers and raw/initial shift storage; projections shifts source normalization. No remote queries or app edits.
- Where: canonical /Users/tim/Code/fhfhockey.com, octoberBranch; observed HEAD ca06cbf6c7ee6dcdb9e54e1f610ac109a8eb8de8 (assigned follow-up pin e86c15aba71d2c38937f11cf9d42217800383997). Preserve unrelated concurrent dirty files.
- Symptom supplied by Chef: game 2026020298 PIT/SJS 2026-11-11 has rows created 2026-11-12 09:45 UTC with game_toi/game_length null; DRM rejects invalid game TOI.
- Current state: applying audit + trace-pipeline; local source inspection in progress; no checks run yet.
- Next: identify exact writers, staged versus derived contracts, failure order, and source normalization risks. Report INGESTION.md with focused remediation proposal.
- Blockers/approvals: none for local read-only scope. Chef owns live diagnostics and implementation assignments.

## Checkpoint
- Runtime verified once from own matching CODEX_THREAD_ID JSONL turn_context: gpt-6.1-sol / high.
- Raw route + normalization v2 do not write aggregate shift_charts. Projection strength writer inserts strength-only rows; projection-input transaction intentionally clears relationship fields when inputs change. Both produce valid staging rows with game_toi/game_length null until relationship stage succeeds.
- Found distinct source dedup keys: raw canonicalizer ignores shiftNumber/duration; projection snapshot includes them. Neither rejects partial overlap. Focused local reproduction and existing mocked tests are in progress. No remote access or app edits.
- Next: record exact code boundaries, behavioral probe outcome, and minimal remediation recommendations in INGESTION.md.

## Handoff checkpoint
- INGESTION.md completed at tasks/artifacts/drm-pipeline-triage-2026-11-12/INGESTION.md.
- Passed focused mocked run: 2 files, 19 passed / 58 skipped; no full suite/type/lint/build/remote execution.
- Isolated actual-normalizer probe confirms raw1/projection2 for equal intervals differing shiftNumber or duration clock format; partial overlap accepted by both. Proposed projection normalization correction with existing-test extension; no implementation assigned yet.
- Chef live evidence resolves null-stage symptom as07:45 relationship cron preceding09:45 ingestion; pending relationship rows are intentional staging. Do not change writer ownership to fill invented relationship clocks.
- Next: Chef integrates findings, chooses implementation scope; this lane awaits assignment. No app edits. Diary retained for handoff.

## Implementation assignment
- Chef authorized local correction in ingest/shifts.ts + existing tests. Live diagnostics found four overlong goalie rows from duplicate/overlapping physical intervals (Woll/Saros/Kuemper/Cossa).
- Contract agreed with route worker: export buildCanonicalShiftIntervals(gameId,pbp,shiftRows), returning validated type517 physical-interval unions per player/team/period with resolved zero-end clocks; keep raw snapshot/hash contract unchanged. Use in strength totals + strength relationship segments; route worker owns route use. Root owns parser/version constants and invalidation strategy.
- Next: failing regression in existing shifts.test.ts, implementation, focused verification. No remote operations.

## Implementation handoff
- Exported physical interval union helper; strength totals and relationship strength segments use it. Every source interval validates before union; zero-end resolved; raw/source snapshot builder unchanged. Route worker notified helper ready and integrates separately.
- Regression first:4valid synthetic goalie-shape fixtures showed excess totals68:40/70:00/71:07/66:54 vs union63:23/65:00/62:43/63:27; partial overlap doubled PP0:30 to1:00. Initial goalie fixture was corrected to include final game-end before measuring red behavior. One edit command had wrong relative path; corrected to absolute, no source edit happened on that failed attempt.
- Final:47tests/3files passed (shifts37,storedSnapshot5,projectionInputPersistence5), scoped ESLint passed, diff-check passed. Source-preservation/order/idempotence/gaps/invalid nested duration checks included. No global tsc/build/remote operation.
- Owned uncommitted app changes: web/lib/projections/ingest/shifts.ts and shifts.test.ts. INGESTION.md updated with actual implementation and checks. Root owns version changes, integration and release decisions; no production repair performed. Await Chef review/corrections; retain diary for handoff.

## Mathematical vetting follow-up
- User requested comprehensive pre-upsert mathematical vetting; assigned read-only strength/state-semantics pass over shifts.ts, derived/situation.ts, time/PBP contracts. Preserve interval unions and concurrent changes. Root owns captured-fixture numeric oracle.
- Own output: tasks/artifacts/drm-pipeline-triage-2026-11-12/MATH-STRENGTH.md. No app edits until scope coordinated; no provider API/database requests. Primary NHL rules/docs browsing permitted.
- Next: trace event-before/after semantics at penalties/goals/expiry/goalie changes; distinguish conservation from correct classification and document numeric counterexamples.

## Mathematical review checkpoint / handoff
- Proven actual captured expiry error:2026020009P1 minor21107:19 expires09:19 but situation timeline carries1451 until hit24709:24. Actual clipped goalie calculation emits5sPP/PK instead ofES; conservation still holds. Second11:31minor overstates through13:45 instead of13:31.
- Existing candidate: default utils/getPowerPlayBlocks.ts405–485 with event audit522–565 and PP_CLOCK_QUALIFIED=false589. Captured5games event audits0disagreements but unqualified; root owns independent official oracle. Legacy named getPenaltyPowerPlayBlocks is explicitly not manpower; parity-metrics expiry heuristic only first expiry + next-state borrowing insufficient for exact general timeline.
- Reproduced separate malformed nominal-period acceptance: consistently21:40regulation elapsed+remaining still passes. No live instance established.
- Checks: actual offline clipped/nominal/simulator probes; parity-expiry5passed19skipped; getPowerPlayBlocks6passed. No follow-up application/test edits or remote execution.
- Report MATH-STRENGTH.md complete. Scope proposal sent root; await exact ownership/implementation assignment. Shared derived/situation.ts untouched; union fixes preserved. Current strength timing is not mathematically certified.

## Nominal-period correction assignment
- Chef authorized only shifts.ts + existing shifts.test.ts to enforce legal REG/OT nominal lengths/types/physical period numbers. Preserve union changes and leave penalty-state labeling unchanged.
- Policy:REG periods1–3 nominal1200; preseason/regular OT period4 nominal300; playoff OT periods4+ nominal1200; shortened sudden-death played ends valid. Regression first, then scoped verification.

## Nominal-period implementation handoff
- Implemented gameType-aware period definition/nominal validation in shifts.ts. Physical REG1–3 requires1200; preseason/regular OT4 requires300; playoff OT4+ requires1200. Reject wrong/missing type and unsupported physical period. Shortened played OT terminals remain valid. No strength-label or global situation changes.
- Regression first: invalid nominal/type/period inputs accepted;7rejection cases added. Acceptance fixtures extended to shortened preseason and second playoff OT; goalie-union fixtures corrected to real05:00OT nominal/remaining.
- Passed46shifts tests +10snapshot/persistence tests, scoped ESLint, diff-check. Offline actual helper accepted5captured games (809/742/788/805/771canonical rows). No tsc/build/remote actions.
- MATH-STRENGTH.md updated. Penalty-expiry timing finding remains unresolved/root-owned. App changes only shifts.ts and shifts.test.ts; handoff awaits Chef integration/review.

## Penalty-clock integration assignment
- Chef assigned shifts.ts + shifts.test.ts to replace sparse-event carry-forward exposure labels with shared pure penalty clock spans. Root owns new projections/penaltyClock.ts engine, source qualification and mismatch fail-closed.
- Contract:buildPenaltyClock(plays, {homeTeamId,awayTeamId}) -> {spans:[{teamId,start,end}]}; absolute game seconds=(period-1)*1200+elapsed; shootouts excluded. Strict clocks/period validation and event classifier remain intact. No fallback to sparse labels.
- Next:regression-first expiry and major/double/OT tests; integrate shared exposure segments, reconcile physically impossible existing fixtures explicitly; focused checks.

## Integration implementation checkpoint
- Replaced carry-forward exposure construction with per-period intersections of root penalty spans, one shared classification helper for totals and relationship segments. Canonical physical validation remains independent and strict; root engine invoked before any strength persistence.
- Red regressions:real07:19expiry5s mislabeledPP/PK, doubleminor2:45instead2:30PP, major5:15instead5:00PP, regulation-to-OTcarry15s mislabeledPP/PK. Added fail-closed prewrite disagreement test.
- Reconciled fake state-toggle fixtures to explicit minor+goal details and true penalty-context reversed-source-order assertion. No fallback classification. Source event classifier untouched.
- Waiting for root-owned penaltyClock.ts to exist before green test execution; root notified. No mock substitute engine or additional files created.

## Shared penalty-clock integration handoff
- Root supplied actual penaltyClock.ts; integration consumes its spans only for exposure. Strict source/clock/nominal validation retained, raw snapshot/hash unchanged, event classifier and global display qualification untouched.
- Root engine first run50/51passed:only reconciled reversed-source test retained stale awayPK0 assertion; corrected expectedPK0:30 (actualenginecorrect). Final73tests/4files pass (shifts51,stored5,persistence5,HTML12), scopedESLint+diff-check pass.
- Actual unmodified captured0009PBP+goalie rows clipped09:19–09:24 now bothES0:05/PP0/PK0; relationship segments ES0:05. Doubleminor/major/OTexpiry and fail-before-write mismatch regressions green.
- MATH-STRENGTH.md updated with currentlocalfix and remainingqualificationlimits. Appownership retainedonlyshifts.ts/shifts.test.ts. No remote actions/globaltsc/build/productionrepair. AwaitChef review; root owns engine, independentoracle, version/release/datarepair.

## Final integration verification assignment
- Own named existing route/integration tests only for verification/fixture corrections; no runtime changes. Root owns remaining types/lint/replay and current inputv3-penalty-clock/relationshipv5_penalty_clock constants.
- Next:one scoped affected-route + relationship/input/derived persistence run; reconcile stale version or impossible PP fixtures without relaxing runtime guards; report implementation defects to root.

## Final route verification handoff
- Scoped mocked integration run passed112tests/10files:6namedroutes +relationshipMaterialization/inputPersistence/derivedQueue/derivedPersistence. No runtime defect surfaced; negative-case logs expected.
- Found stale queue mock/assertion hardcodedv2intervalunion; changed onlyexisting shift-charts.queue.test.ts to source actual exported input materializer constant (rootcurrentv3penaltyclock). Preserved concurrent queue-test additions and hashfnmocks. Changedfile rerun2tests passed; diffcheckpassed. Do notsumrerunwith112unique count.
- MATH-STRENGTH.md updated. No runtimeimplementation/newfiles/remote/globaltype/lint/build in finalverificationlane. Root owns remaining checks/replay/release. Ready forChef integration.

## Shared-consumer fixture correction assignment
- Root found18consumer regressions:17PP-combinations-game tests lack eventId on synthetic penalties,1ShiftChart/model test lacks offender identity. Own only these2existingtestfiles for identity/physical-sourcefixture correction; no app guard changes.
- Next:inspect fixtures/log, add stable real identities preserving assertions, rerun failingfiles; report true semantic engine issues rather than alter expectations.

## Consumer fixture handoff
- Added stable unique syntheticeventIDs toPP-combinations-game sharedplayhelper (faceoffs1/2, resetpertest3+); added existingroster offender201 toShiftChartOTminor. Noexpectednumeric/assertion/runtimeguardchanges.
- Only2previouslyfailingfiles rerun:58testspassed (42+16), diffcheckpassed. Rootother60passingtestsnotrerun. Log/tmp/fhfh-penalty-consumers-fixture-fix.log retainsresults; originalrootfailureloguntouched.
- Reportupdated; nosemanticenginebugsurfaced. ReadyforChef integration.

## HTML overtime ingestion parser correction assignment
- Root official190player oracle found actual HTML source parser drops OT labels due numeric-only period gate, losing goalie203/207seconds while conservation holds.
- Own only nhlRawGamecenter.mjs + existing shifts.htmlFallback.test.ts (raw test if needed). Regression first:OT,playoff2OT,unknown physical period refusal. No live ingestion; root reruns full official offline oracle after fix.

## HTML overtime parser handoff
- Fixed shared numeric-only period gate:OT->4,2OT->5,etc; numberedphysicalrowunknown/nonpositive/unsafeperiodrefusesstrictparse. Numericperiods/header/TOTbehaviorpreserved; nootherappfileschanged.
- Regressionfirst:OT/2OTrowslost(2ratherthan4),unknownperiodsilentlyskipped. Final61tests/2filespassed(15fallback46raw), scopedESLint+diffcheckpassed.
- INGESTION.md updated. Rootnotifiedfixavailableforofficial190oracle. No liveingestion/provider/DBcalls; no parser/materializerversionedits; root owns fulloracle/version/release.

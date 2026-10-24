# P07 R2 independent review — qualified narrow acceptance

The pinned R2 correction passes this independent behavioral review. Both R1 findings are closed for the tested snapshot: modest browser clock skew no longer rejects valid current reads, and expiry of an applicable native review during computation withdraws all numeric outputs before publication. No new concrete defect was reproduced. This accepts the narrow correction; the moving canonical tree and release remain unqualified.

## Evidence boundary

- Candidate: `../p07-rso-use-policy-2026-10-22/r2/CANDIDATE.json`; baseline/observed HEAD `84cb1229cd1c1cdd037c43e660d2a181304ada51`, `octoberBranch`. The working-tree candidate is identified by hashes, not that commit alone.
- Reconstructed and verified all **3,375 fixed-source files** before testing. All **32 candidate pins** matched the isolated snapshot; **8 files** comprise the R2 delta. The other 24 pins match R1. All 32 tested pins remained unchanged afterward.
- Base archive SHA-256: `1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04`.
- R2 overlay SHA-256: `13c85ce88e9ec109791470315f724a61caafe324d6fcc9ea8a08197d83eec4b2`.
- Scratch: `/tmp/fhfh-p07-r2-review-n7g6bsdg/web`. `START-HASHES.json`, `SNAPSHOT-CHECK.json`, `END-HASHES.json` and `VERIFICATION.json` preserve the boundary. Canonical application files were not edited.
- Read the current repository instructions and named R2 packet. Reviewed actual current-read adapter, execution publication, route and hook changes, the policy-clock seam, and relevant unchanged callers. Followed the bounded R2 scope rather than repeating the application, stats or billing audits.

## Findings disposition and independent verification

**63 tests passed; zero failed:** 60 selected tests across seven files, plus three independent correlation cases. The owner's 294 executions were not repeated or adopted as independent receipts. See `COMMANDS.md`, `focused.log` and `independent-correlation.log`.

| Contract | Exact pinned implementation / test evidence | Result |
| --- | --- | --- |
| R1 clock-skew defect | `web/lib/rosterScheduleOptimizer/currentPlanningRead.ts:71` generates a fresh read nonce; lines 85–93 require the echoed nonce and agreement between server evaluation and manifest timestamps, then use server time plus bounded elapsed time. The original two ±5-second skew assertions in `p07IndependentBoundary.test.ts` are unchanged. | Both pass; no browser/server epoch equality required. |
| R1 review-expiry defect | `web/lib/rosterScheduleOptimizer/executionAdapter.ts:12` captures applicable review IDs/deadlines before computation; lines 35–42 re-evaluate capacity-only results if the publication deadline elapsed. `p07IndependentBoundary.test.ts:64` expires a synthetic positive native review during computation. | Pass; plan totals, candidate metrics and display values are withheld together. |
| Exact replay and timestamp correlation | `currentPlanningRead.ts:86` checks nonce, timestamp equality and the 20-second read limit. New `p07R2IndependentCorrelation.test.ts:7` replays the exact previously accepted body into a new generation; line 22 returns the current nonce with a different manifest timestamp. | Both fail closed with no admitted forecast graph or projected totals. |
| Revocation on a fresh correlated read | New `p07R2IndependentCorrelation.test.ts:29` removes the bridge allowlist in the second correctly correlated response. Existing adapter case at `executionAdapter.test.ts:109` also changes permission with unchanged source counts. | Current read succeeds but permission is denied; projected/display values are null. |
| Authority and saved-manifest impersonation | Unchanged C08 oracle; unchanged independent row-transplant and async-continuation tests at `p07IndependentBoundary.test.ts:25` and `:44`. Current-read scope is restored in `currentPlanningRead.ts:135`. | Pass; serialized metadata alone does not acquire live process authority. |
| Expiry, cancellation and refresh | Adapter tests cover source expiry during work, delayed responses, delivery time counting toward expiry, future issuance at server evaluation, aborted generations, actual worker handler and no-worker fallback. Hook tests at `useRosterPlanning.test.tsx:22`, `:55`, `:74`, `:87` cover render invalidation, cancellation, exactly one refresh and backward wall-clock movement. | Pass in mocked/offline execution. |
| Route and real UI seam | Eleven route tests; real component/hook/adapter mount with a single shared data read; three candidate hook tests. `data.ts:14` validates UUID-v4 receipt input, `:25` uses private/no-store, `:32` returns evaluation receipt. | Pass. Access/workspace requests remain separate from the single planning-data GET. |

The six-case independent boundary test is byte-identical to the earlier reviewer artifact (`27e59bb1412a411052a81097c6469cdd8262441b85a9cc30194b3b49d893a65e`). Only response fixtures were adapted for the additive nonce/evaluation receipt. Their diffs are retained; no original assertion was disabled. The new three-case fixture is included in this directory.

The nonce is correlation of the adapter's current same-origin fetch, not a signature or reusable authorization. The authority boundary still depends on the trusted route's current selection, immutable admitted rows, and the synchronous process scope. The R2 change does not grant native approvals: the production review list remains empty. Positive native cases are synthetic tests only. Manual capacity and existing approved-bridge behavior remain available under their existing valid conditions.

## Concurrent work — identified and excluded

`web/lib/rosterScheduleOptimizer/planning.ts` differs from the R2 pin:

- R2 pin: `f3ba1b151776a6fb1060a0b20d24eb2d28c2998cbab14682489c913c4f7791c9`.
- Observed canonical/task10 candidate: `09918cdb16f2eeee00554448b953c16f773b2e3f42455e213dac7e4f38ec5474`.

The diff is the additive `gameForecastPoints` helper. The task10 handoff and candidate, its diary (lines 10 and 14), and the parent's worker assignment identify ownership as task10 worker `01a1645a-6c9d-77ac-a105-0513908cb0fc`. The parent additionally confirms the ownership ledger agrees. There is no unidentified-owner blocker. `CONCURRENT-PLANNER.diff` and `CONCURRENT-OWNERSHIP.json` retain evidence.

Read-only inspection found the helper reuses per-target totals permissions and applicability, withholds incomplete/nonfinite weighted totals, and uses per-start conditional values for goalie “if starts.” It changes no existing planner function in the observed diff. It is outside the pinned R2 execution/tests and has no independent acceptance from this pass. Its callers must receive the admitted current display/forecast graph; the helper itself must not be treated as source authorization.

`RosterScheduleOptimizer.tsx` also changed during this review, consistent with the separately authorized task10 UI lease (including `SlotWeekGrid.tsx`). Its observed hash is in `END-HASHES.json`; it is not attributed to R2. All eight R2-delta files still matched at the end check. A combined fixed snapshot is required after task10 integration settles.

## Held gates and next actions

1. Complete R2 application-scoped TypeScript and scoped lint through the shared heavy-check protocol. They were **not run** by this reviewer and remain pending in the owner packet. No lock was acquired, deleted or bypassed; only bounded single-worker Vitest ran. The established protocol is recorded at `tasks/sprint-2026-10-18/SPRINT-REGISTER.md:18`.
2. Independently qualify the combined task10/P07 snapshot, including the actual UI forecast inputs and goalie display behavior. Current-tree drift is expected concurrent work, not coverage from these receipts.
3. Real browser worker packaging, cross-realm timing and browser lifecycle behavior remain untested here. Worker-handler/fallback unit execution and jsdom component mounting are narrower evidence.
4. Target-by-target native numerical approval, historical model qualification and all earlier held data-completeness gates remain open. No approval record was added; there is no blanket model-release qualification.

No services, network, database replay, production requests, credentials, installations, builds, commits or deployment were used. Prior stats/billing acceptance was not rerun or broadened. No tool action was denied or left with an uncertain outcome. This narrow review is complete; implementation, combined integration and release decisions are separate.

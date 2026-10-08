# RSO local implementation evidence

Date: October 8, 2026. Basis: the finalized [PRD](prd-rso.md), [audit](rso-audit-2026-10-08.md) and [task list](../tasks-prd-rso.md). TJ authorized local execution at 22:09 UTC. Updated after independent review: the new authoritative-timezone regression is repaired; the inherited connected manager-lock requirement remains incomplete. This report records scoped development and fixture evidence; it does not clear beta, full launch or commercial activation.

## Candidate and ownership

| Item | Evidence / status |
| --- | --- |
| Isolated worktree | `/tmp/fhf-rso-task-execution-20261008` (canonical `/private/tmp/fhf-rso-task-execution-20261008`) |
| Local branch | `chef/rso-task-execution-20261008` |
| Source candidate after review repair | `85b50ac927ef43188b413aef170333b9db252a7d` — 17 source/test files relative to the base; scoped local evidence, known connected lock gap, unpushed, undeployed |
| Initial independently reviewed candidate | `3828adc8683ff3b7fdfaf138f1589c16f9d3b56e`; application tree equaled `ef694b29aed53bbdaa95bbeae52499b2ec0b45b2`. Review: `/tmp/fhf-rso-independent-review-20261008/review.md` |
| Independent repair recheck | `32b51751e1c9e27a15e8999522c091dc04d7a4c9`, application source `85b50ac92`; `/tmp/fhf-rso-independent-review-20261008/recheck-32b51751.md` confirms P1 resolved, no new bounded-review defect and correct open P2/task/acceptance wording. Review reused current receipts and inspected source/documents; it did not rerun tests or clear beta |
| Clean base | `98c1b5036dea54a1d9fdf551f279d241b7851ecf`; release owner `01a1195f` confirmed local/remote base and consumer ownership boundary |
| Reused consumer scope | Nine-file patch from `cfa484fa27cccd614839b8edffb0e31453b1f890` relative to `171116877633d537a39b2a3e168882913269d47f`; applied before focused fixes |
| Reused M4 scope | Exact two-file patch `75dec3a81a5dfa9a7c790230defcd32f4d439c1a`; coordinator `01a11774` approved unchanged reuse. No M1–M3 chain was required |
| M4 equality | `consumerRevisionAdmission.ts` SHA-256 `3808757cacd57852acfc52fe5ed335426191607f6f1ca4057425141fc83d49f8`; data `planning.test.ts` SHA-256 `d488c13788a6f57cb4e234b9d8936aa77a0aba4477ce6ec169f2a5efbf20f2f7`. Both equal the retained M4 commit's blobs |
| Shared admission ownership | Existing implementation owner `01a11b87`; no parallel changes to the reused admission logic |
| Local execution ownership | Thread `01a11d48-c845-7454-90da-8784ecd1201b` owns this consumer/continuity/fixture/task-document candidate. Shared component and E2E edits were serialized; no new workers were dispatched |
| Production status | Retained production receipt remains `171116877633d537a39b2a3e168882913269d47f`; this task made no remote production inquiry or change. Local tests are not a release receipt |
| Protected work | Dirty master and unrelated files were preserved. UTA owner `01a10f57`, pin `6a91f09d888722d2828809e62e1b932ab43330d0`, its worktree/session/evidence were not used or changed |

The source history retains integration commit `67d51aee99bd2431c93925cc2f578b11906c4806`, the explicit late-team-response regression at `ef694b29a`, and the timezone repair at `85b50ac92`. The documentation update follows the source repair and leaves its application tree unchanged. The PRD and audit are copied byte-for-byte into the isolated worktree for review and remain unchanged after the findings. Their Library identities remain `libfile_5895d62bd0cc8191ba67ea8133791763` and `libfile_de0be4942c4481918c9ac55a2198799a`, respectively. This report does not claim a new Library upload.

No supported formal goal creation/attachment action was exposed. The active local thread was identified, and this limitation was reported; no formal goal attachment or unexposed model setting was claimed.

## Changes and reproduced failures

1. **Acquisition timing.** Candidate selection previously assigned the action time as the effective time even under next-day/waiver rules, and appended intents when timing was unknown. `planningTimeline.ts` now supplies one shared effective-time helper used by search and the consumer. It preserves league-local next midnight, later verified waiver clearance, preceding-day submissions and unresolved timing. Cost charging remains in the existing timeline's action/reset period. DST, Sunday-to-Monday and missing-clearance cases passed.
2. **Readable itinerary.** Selected adds now show acquisition cost, planned drop and named sequence prerequisites. Zero cost remains zero and missing cost remains unknown. The summary shows net starts against the no-move baseline, identifies the no-move maximum, and alternatives disclose their starts/outcome objective. Existing displacement, conditional-prefix and bounded-search behavior was reused.
3. **Refresh → undo → reopen.** A compound regression reproduced undo restoring the obsolete provider as-of, acquisition allowance and roster. Undo now restores manager choices against matched current provider authority, retaining new roster inputs, selected moves, protections/exclusions and stored lock bytes. Failed refresh leaves the prior workspace intact. Reconciliation is derived again from current connected authority and intent, so an unavailable selected player remains reviewable after undo. Repairs still require an explicit manager action. The compound fixture's provider already has the same locks: it proves retention and provider-lock use, not calculation using a workspace-only connected manager lock. That boundary remains incomplete below.
4. **One local plan per context.** A regression reproduced losing the first league's plan after switching and editing a second league. Versioned local records now retain one workspace for each exact provider/season/league/team/date-range/timezone key, plus the existing active-workspace key. Existing saved bytes remain readable. Reopening and switching recover each context without treating cached availability as current provider evidence.
5. **Response isolation.** League identity now participates in provider request identity and automatic refresh. Late account, league, team, timeframe or manager-timezone responses are discarded; a provider snapshot for a different selected scope is rejected. Another regression reproduced a late account save attaching an older timeframe's version and success notice to the current plan. Save acknowledgements/errors now require the original account and context to remain current. A stale-version save preserves the local plan.
6. **Partial availability.** Existing Yahoo adapter code was retained. Its nearest test now verifies repeated identities, oversized pages, stale transport, wrong league, failures, the discovery time guard, bounded list exhaustion and ownership-only rows. Repeated/unverified identities stay unknown. Individually verified rows can remain usable under partial discovery, while the list is never advertised as complete.
7. **Reused forecast/category behavior.** The cfa category presentation, result invalidation and hook tests were incorporated. The M4 admission and data tests were ported unchanged. Conflicting same-time or mismatched revisions and unsupported participation/permissions remain rejected; schedule capacity remains available.
8. **P1 repaired after independent review.** The new returned-context guard rejected an otherwise matching Yahoo snapshot when verified league settings normalized UTC to America/New_York. The adapter intentionally prefers the authoritative league timezone. The repair permits that returned timezone change while keeping the original request guard timezone-sensitive and preserving exact provider/season/league/team/horizon and account checks. Adapter, component, stale-manager-timezone and headless reload cases now pass. The reviewer's original timezone diagnostic also passes.
9. **P2 inherited acceptance gap remains open.** Connected input uses `supplementProviderRules(...).snapshot`, whose lock array comes from the provider. Stored `workspace.lockedAssignments` never enters that connected snapshot; an explicit saved future bench lock can remain in storage while being ignored by calculation. The independent diagnostic failed at both the clean base and initial candidate, and remains failing after the P1-only repair. The lock editor is manual-only. No connected editor or precedence policy was invented here. Task 3 and subtasks 3.2–3.4, connected AC-06 and related rule/forecast acceptance are reopened. PRD requirements 9/17/19 retain their exact explicit-lock requirements; this gap is required remaining work, not a deferred non-goal.

Relevant paths are listed in the task document. No access/grant logic, provider transactions, database schema/data, credentials, model fitting, manifests, lockfiles or production configuration were changed.

## Verification receipts

Runtime: Node `22.11.0`, npm. The clean worktree reused the installed dependency directory through a local symlink; no dependency installation occurred. All commands ran from `web/`.

Current repair evidence directory: `/tmp/fhf-rso-review-fix-evidence-20261008`. Initial evidence retained at `/tmp/fhf-rso-implementation-evidence-20261008` belongs to the pre-review source and is labeled accordingly below. The source has a passing `git diff --check` receipt. No production build, full application suite or remote build/deployment was run.

| Check | Result | Receipt |
| --- | --- | --- |
| Focused integrated Vitest suite after repair | **253/253 passed**, 12 files, 4.40 s | Current `unit-integrated253.log` |
| TypeScript after repair | **Passed**, exit 0 | Current `typescript.log` |
| Scoped ESLint after repair | **Passed**, exit 0; four pre-existing hook-dependency warnings remain | Current `lint-scoped.log` (four files changed by the repair) |
| Affected headless Chromium cases after repair | **3/3 passed**: selected-move repair; authoritative timezone/horizon/intent and reload; connected permissions/account-switch/save/cancellation/continuation | Current `browser-provider-guards.log` (2) and `browser-account-guards.log` (1) |
| Independent review diagnostics rerun after repair | **Timezone passed; connected manager-lock diagnostic failed** as the known open P2 gap; these are separate from the 253-test suite | Current `reviewer-diagnostics-known-gap.log`; focused timezone-only run also passed in `reviewer-timezone-reproduction.log` |
| Initial integrated Vitest and broad headless coverage | **Historical before repair**: 251/251 in 12 files; 26 distinct browser cases in groups of 14 and 12, with five repeated guard/presentation cases | Initial `unit-final251.log`, `browser-a.log`, `browser-b.log`, `browser-final-guards.log`; not final repaired-candidate pass counts |
| Initial visual inspection | Retained headless desktop streaming and mobile dense-lineup PNGs; source layout unchanged by the timezone repair | Initial `artifacts/roster-optimizer-stream-1440.png`, `artifacts/rso-mobile.png` |
| Account-switch readback after repair | Fictional authenticated sessions; late provider/save hidden, current intent retained, expired inputs read-only, explicit manual fork editable | Current browser account-guard run; intercepted fictional inputs, no actual account parity claim |

The unit command was:

```sh
npm test -- --run lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleOptimizer/workspace.test.ts lib/rosterScheduleOptimizer/reconciliation.test.ts lib/rosterScheduleOptimizer/providerRules.test.ts lib/integrations/yahoo/rosterPlanning.test.ts lib/rosterScheduleData/planning.test.ts __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx __tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx hooks/useRosterPlanning.test.tsx lib/in-season/access.test.ts lib/in-season/workspaceSchema.test.ts lib/in-season/workspaceRoutes.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit --pretty false
```

Browser runs used `npm run test:e2e -- e2e/roster-schedule-optimizer.spec.ts --project=chromium --timeout=30000`. After repair, `--grep 'provider refresh|connected context'` selected the two provider-refresh cases; `--grep 'connected refresh and account save'` selected the account/save/switch case. The older complementary broad groups and repeated five-case group remain historical. A localhost-only dev server ran on port 3138 with `PLAYWRIGHT_ISOLATED_NEXT=1`, fictional local Supabase URL/public key and intercepted data/provider/account/access responses. The server was stopped afterward, with no listener remaining. There was no visible desktop/browser/cursor use.

Initial browser setup was blocked by sandbox port binding; authorized local escalation resolved it. Temporal fixture failures were corrected by fixing the fixture date, and selectors were updated to the current lineup label and exact selected-step text. An earlier full run lost its local processes without a completion receipt; it is not counted as passed. Subsequent bounded groups completed. Failure/interruption logs are retained alongside the passing logs.

The added timezone component case failed before the repair (`timezone-red.log`) and passed afterward. An initial scoped-lint invocation used unsupported `--file` arguments; it did not run lint and is retained in current `lint.log`. The corrected direct ESLint invocation produced the passing `lint-scoped.log`. No failed or interrupted command is counted as a pass.

Desktop includes navigation at 1440×900 and expanded 1920×1080. Mobile includes 390×844 and 320×844. Keyboard Enter/Space/Tab focus and no document horizontal overflow were exercised. The 720×450 case is equivalent viewport reflow for 200% desktop zoom; no visible browser zoom control was operated.

## Acceptance matrix at the local candidate

| ID | Development/fixture status | Remaining release evidence |
| --- | --- | --- |
| AC-01 | **Partly verified local**: authoritative timezone normalization, stale account/league/team/horizon/manager-timezone rejection, manual setup and rule conflict/supplement fixtures pass | Actual Yahoo profiles/timezones/horizons; inherited connected manager-lock authority and calculation gap remains open |
| AC-02 | **Verified local**: feasible baseline, displacement/dual eligibility/utility, guarded category deltas and zero-versus-missing cases | Compatible actual inputs for the declared cohort |
| AC-03 | **Scoped verified local**: candidate timing, next-day/waiver/DST/preceding-day/reset, reserves/vacancies, engine/manual locks, provider-derived locks and successful-prefix cases | Workspace-only manager locks are ignored in connected calculation; actual Yahoo timing, limits/cost encoding and waiver semantics remain unqualified |
| AC-04 | **Verified local**: partial/repeated/stale/failed availability and explicit exclusion safeguards; ownership alone is not addability | Bounded actual league availability/source receipts |
| AC-05 | **Scoped verified local**: points/category/ratios, goalie coverage/tradeoffs, bench explanations, permission and participation negatives given the fixture's engine inputs | Connected legal assignments must consume applicable manager locks; native player/goalie semantics and positive numeric readbacks remain unqualified |
| AC-06 | **Incomplete, partly verified local**: undo/current authority, selected moves/repairs, save conflicts, scope isolation, timezone adoption and context retention pass; stored lock bytes survive | Stored workspace-only manager locks do not constrain connected calculation. Define authority/precedence and prove connected refresh → undo → reopen consumption; actual connected account/profile parity remains unqualified |
| AC-07 | **Verified local**: free/premium engine boundary, capability/API enforcement, independent grant union, expiry/read-only and manual continuation fixtures | Operational/commercial fulfillment remains separate; existing commitments preserved |
| AC-08 | **Verified local**: dense/expanded desktop, 320/390 mobile, retained workspace selection, keyboard focus and zoom-equivalent reflow | No broader device or actual browser-zoom claim is made |
| AC-09 | **Incomplete / not real-data accepted** | Fresh admitted native player/goalie revisions for the complete selected horizon, exact RSO selected/no-move/category consumption and matching Start Chart readback where required |
| AC-10 | **Partly verified local**: source-age distinctions, permissions/expiry, failed refresh, response/worker invalidation and reopened fixtures | Owner-defined permitted freshness/revocation lag; warm-cache/news/revocation acceptance against that bound |
| AC-11 | **Verified local weekly fixtures; actual qualification incomplete** | Exact Yahoo weekly windows, manual/connected profile and forecast qualification before full launch |
| AC-12 | **Not cleared**: required source patches are included locally | All profile/forecast/provider/freshness gates plus separate release authorization, exact deployed build and observed live acceptance |

Statuses are distinct: the repaired source has **scoped verified local** evidence and a **known incomplete connected-lock requirement**; it is **not pushed**, **not deployed**, **not real-data accepted**. Multiple named itineraries, public sharing/export, out-of-session notifications, FAAB bidding advice and a universal category blend remain deferred/out of scope.

## Performance observations and remaining measurement

| Fictional workload | Observed result |
| --- | --- |
| 1,000 players / 2,000 forecasts / 2 days | Exact full-plan candidate gains: 121.2 ms; 998 non-owned candidates evaluated |
| 1,000 players / 13,000 forecasts / 13 days | Exact full-plan candidate gains: 458.9 ms; full selected horizon retained |
| Browser candidate worker / 999 candidates | 125 ms; four main-thread timer ticks; maximum observed timer gap 49 ms; filters and zero-AGP ranking remained usable |
| Bounded multi-acquisition unit workload | The 25/300/7/4 workload test passed in 2.265 s; this is the entire fixture test duration, not an isolated alternatives latency |

These are retained observations at the pre-review source, not final repaired-candidate performance qualification, production SLAs or calibration. The proposed 100 ms edit/cancellation, 250 ms baseline, two-second alternatives and five-second stress targets are not adopted. Isolated baseline/edit/cancellation and typical-profile alternatives measurements remain open in task 6.5; end-to-end performance qualification requires a declared profile/workload. No selected horizon was shortened to improve a receipt.

## Bounded actual acceptance pack and next dependencies

The following pack is prepared for the relevant owners; it contains no invented approved account, live capture or permission to run:

| Required pack field | Current state / owner |
| --- | --- |
| Candidate | Review repaired source `85b50ac927ef43188b413aef170333b9db252a7d`, including the documented open connected-lock gap; release owner `01a1195f` coordinates later integration/release |
| Connected lock requirement | RSO workspace/consumer and provider-contract owners define manager/provider lock precedence and qualify applicable active/bench locks in calculation through refresh, undo and reopen. Retained lock bytes alone cannot clear task 3 or AC-06 |
| Daily cohort | Both manual and Yahoo-connected daily workflows; points/category/ratio and goalie profiles must be explicitly declared. Exact league/team/account IDs, timezones, horizons and supported exclusions remain unfilled |
| Yahoo evidence | Provider-contract owner supplies authorized read-only roster, lock/settings, transaction timing/cost/reset, waiver/reserve, availability and credited goalie-minimum receipts. Unknown fields stay unknown; no credential or transaction workaround |
| Forecast evidence | Existing FORGE/M4 and consumer owners supply fresh compatible native revisions, manifest/run/date/class/horizon/source/participation identity, permissions and coverage/exclusions, then exact RSO assignment/category and required Start Chart readbacks |
| Freshness bound | Lead/data owner declares permitted cache/revocation lag before warm-cache, news, reopen, expiry/revocation and failed-revalidation qualification; no numerical SLA is invented here |
| Weekly profile | Actual league-local lineup windows independent of acquisition resets, midpoint/bench locks and acquisition-after-lock evidence; remains unqualified for full launch |
| Commercial terms | Business/entitlement owner resolves branding, final price/billing, exact dates/timezone and first-100/preview/refund/duplicate/complimentary rules; no grant activation |

The independent recheck closed the P1 repair and confirmed the reopened scope at `32b51751e`; this final report addition records that result without changing application source. M4 inclusion remains unchanged. Next, complete task 3's connected lock authority and calculation requirement before accepting connected continuity or dependent legal/forecast conclusions. Tasks 4.4 and 5.2–5.3 may collect their independent provider/native-forecast receipts only through authorized owner paths. Define and verify task 5.4's freshness bound and finish the declared workload measurements in 6.5, then reconcile the complete daily acceptance matrix in task 6. Clear task 7 only after **both** daily workflows and positive real-data consumption pass; TJ's **A — Wait for both** decision remains binding. Separate team win-probability promotion is not a prerequisite. Task 8's actual weekly qualification must precede full launch. Task 9 remains an independent commercial decision/activation track.

No push, remote build, deployment, serving activation, production-data change, credential work, provider transaction, model fitting or commercial fulfillment occurred. Later releases require separate authorization.

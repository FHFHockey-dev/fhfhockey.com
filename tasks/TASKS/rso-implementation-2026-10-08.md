# RSO local implementation evidence

Date: October 8, 2026. Basis: the finalized [PRD](prd-rso.md), [audit](rso-audit-2026-10-08.md) and [task list](../tasks-prd-rso.md). TJ authorized local execution at 22:09 UTC. Independent review found timezone and connected manager-lock gaps. The timezone repair passed re-review; TJ then directed fixing the actionable local lock boundary. Both repairs now have focused local evidence, with lock re-review pending. This report does not clear beta, full launch or commercial activation.

## Candidate and ownership

| Item | Evidence / status |
| --- | --- |
| Isolated worktree | `/tmp/fhf-rso-task-execution-20261008` (canonical `/private/tmp/fhf-rso-task-execution-20261008`) |
| Local branch | `chef/rso-task-execution-20261008` |
| Source candidate after both repairs | `2630a3377722ea08186b6a662e70ce17aed057f8` — 23 source/test files relative to the base; scoped local evidence, unpushed, undeployed |
| Initial independently reviewed candidate | `3828adc8683ff3b7fdfaf138f1589c16f9d3b56e`; application tree equaled `ef694b29aed53bbdaa95bbeae52499b2ec0b45b2`. Review: `/tmp/fhf-rso-independent-review-20261008/review.md` |
| Independent repair recheck | `32b51751e1c9e27a15e8999522c091dc04d7a4c9`, application source `85b50ac92`; `/tmp/fhf-rso-independent-review-20261008/recheck-32b51751.md` confirms P1 resolved, no new bounded-review defect and correct open P2/task/acceptance wording. Review reused current receipts and inspected source/documents; it did not rerun tests or clear beta |
| Connected lock repair recheck | Pending focused independent review of `2630a3377` and the updated task/report scope; earlier P2 was reopened until TJ directed the local repair |
| Clean base | `98c1b5036dea54a1d9fdf551f279d241b7851ecf`; release owner `01a1195f` confirmed local/remote base and consumer ownership boundary |
| Reused consumer scope | Nine-file patch from `cfa484fa27cccd614839b8edffb0e31453b1f890` relative to `171116877633d537a39b2a3e168882913269d47f`; applied before focused fixes |
| Reused M4 scope | Exact two-file patch `75dec3a81a5dfa9a7c790230defcd32f4d439c1a`; coordinator `01a11774` approved unchanged reuse. No M1–M3 chain was required |
| M4 equality | `consumerRevisionAdmission.ts` SHA-256 `3808757cacd57852acfc52fe5ed335426191607f6f1ca4057425141fc83d49f8`; data `planning.test.ts` SHA-256 `d488c13788a6f57cb4e234b9d8936aa77a0aba4477ce6ec169f2a5efbf20f2f7`. Both equal the retained M4 commit's blobs |
| Shared admission ownership | Existing implementation owner `01a11b87`; no parallel changes to the reused admission logic |
| Local execution ownership | Thread `01a11d48-c845-7454-90da-8784ecd1201b` owns this consumer/continuity/fixture/task-document candidate. Shared component and E2E edits were serialized; no new workers were dispatched |
| Production status | Retained production receipt remains `171116877633d537a39b2a3e168882913269d47f`; this task made no remote production inquiry or change. Local tests are not a release receipt |
| Protected work | Dirty master and unrelated files were preserved. UTA owner `01a10f57`, pin `6a91f09d888722d2828809e62e1b932ab43330d0`, its worktree/session/evidence were not used or changed |

The source history retains integration `67d51aee99bd2431c93925cc2f578b11906c4806`, the late-team regression at `ef694b29a`, timezone repair at `85b50ac92` and connected-lock repair/performance fixtures at `2630a3377`. Documentation commits preserve their source application trees. PRD/audit copies remain byte-identical after both repairs, with Library identities `libfile_5895d62bd0cc8191ba67ea8133791763` and `libfile_de0be4942c4481918c9ac55a2198799a`. No new Library upload is claimed.

No supported formal goal creation/attachment action was exposed. The active local thread was identified, and this limitation was reported; no formal goal attachment or unexposed model setting was claimed.

## Changes and reproduced failures

1. **Acquisition timing.** Candidate selection previously assigned the action time as the effective time even under next-day/waiver rules, and appended intents when timing was unknown. `planningTimeline.ts` now supplies one shared effective-time helper used by search and the consumer. It preserves league-local next midnight, later verified waiver clearance, preceding-day submissions and unresolved timing. Cost charging remains in the existing timeline's action/reset period. DST, Sunday-to-Monday and missing-clearance cases passed.
2. **Readable itinerary.** Selected adds now show acquisition cost, planned drop and named sequence prerequisites. Zero cost remains zero and missing cost remains unknown. The summary shows net starts against the no-move baseline, identifies the no-move maximum, and alternatives disclose their starts/outcome objective. Existing displacement, conditional-prefix and bounded-search behavior was reused.
3. **Refresh → undo → reopen.** A compound regression reproduced undo restoring obsolete provider as-of, allowance and roster. Undo now restores manager choices against matched current provider authority. Failed refresh preserves the workspace; invalidated moves remain reviewable and repairs require a manager action. The initial compound fixture only proved lock-byte retention/provider-lock use. Added workspace-only active/bench-lock cases now verify actual connected engine contribution/assignments through refresh, undo, schema-valid save and reopen, including authority conflicts.
4. **One local plan per context.** A regression reproduced losing the first league's plan after switching and editing a second league. Versioned local records now retain one workspace for each exact provider/season/league/team/date-range/timezone key, plus the existing active-workspace key. Existing saved bytes remain readable. Reopening and switching recover each context without treating cached availability as current provider evidence.
5. **Response isolation.** League identity now participates in provider request identity and automatic refresh. Late account, league, team, timeframe or manager-timezone responses are discarded; a provider snapshot for a different selected scope is rejected. Another regression reproduced a late account save attaching an older timeframe's version and success notice to the current plan. Save acknowledgements/errors now require the original account and context to remain current. A stale-version save preserves the local plan.
6. **Partial availability.** Existing Yahoo adapter code was retained. Its nearest test now verifies repeated identities, oversized pages, stale transport, wrong league, failures, the discovery time guard, bounded list exhaustion and ownership-only rows. Repeated/unverified identities stay unknown. Individually verified rows can remain usable under partial discovery, while the list is never advertised as complete.
7. **Reused forecast/category behavior.** The cfa category presentation, result invalidation and hook tests were incorporated. The M4 admission and data tests were ported unchanged. Conflicting same-time or mismatched revisions and unsupported participation/permissions remain rejected; schedule capacity remains available.
8. **P1 repaired after independent review.** The new returned-context guard rejected an otherwise matching Yahoo snapshot when verified league settings normalized UTC to America/New_York. The adapter intentionally prefers the authoritative league timezone. The repair permits that returned timezone change while keeping the original request guard timezone-sensitive and preserving exact provider/season/league/team/horizon and account checks. Adapter, component, stale-manager-timezone and headless reload cases now pass. The reviewer's original timezone diagnostic also passes.
9. **P2 repaired locally using the existing authority contract.** The inherited connected path ignored stored manager locks. It now supplements the derived calculation with explicit workspace locks, while preserving provider assignments on player/slot conflicts for the same daily date or independent weekly window. Conflicting manager choices remain stored and are shown for review. Manager rows carry optional `source: "manager"` provenance in derived snapshots; the additive schema accepts legacy untagged rows. Cached manager-tagged rows are removed before current workspace intent is reapplied, so a saved simulation cannot become provider authority. Manager evidence is explicitly labelled as simulation with unknown source age. Snapshot identity changes when calculation inputs change. The planner and supplement share the existing league-local weekly-window lookup; acquisition resets do not define lock windows. No connected editor, live provider reads or transaction behavior was introduced. PRD 9/17/19 remains unchanged.

Relevant paths are listed in the task document. Only saved JSON validation gained the optional lock-source field; no database schema/data, access/grant logic, provider transactions, credentials, model fitting, manifests, lockfiles or production configuration changed.

## Verification receipts

Runtime: Node `22.11.0`, npm. The clean worktree reused the installed dependency directory through a local symlink; no dependency installation occurred. All commands ran from `web/`.

Current repair evidence directory: `/tmp/fhf-rso-review-fix-evidence-20261008`. Initial evidence retained at `/tmp/fhf-rso-implementation-evidence-20261008` belongs to the pre-review source and is labeled accordingly below. The source has a passing `git diff --check` receipt. No production build, full application suite or remote build/deployment was run.

| Check | Result | Receipt |
| --- | --- | --- |
| Focused integrated Vitest suite after both repairs | **264/264 passed**, 12 files, 4.38 s | Current `unit-integrated264.log` |
| TypeScript after both repairs and final E2E addition | **Passed**, exit 0 | Current `typescript-final.log` |
| Scoped ESLint after both repairs | **Passed**, exit 0; four pre-existing hook-dependency warnings remain | Current `lint-locks.log` (10 changed files), then `lint-final-e2e.log` for the performance addition |
| Affected headless Chromium cases | **5/5 passed**: selected-move repair; connected lock worker/authority/undo/save/reload; authoritative timezone; account/save/scope guards; native worker cancellation/performance | Current `browser-locks-final.log` (4) and `browser-planning-performance.log` (1) |
| Original diagnostic adapted to the derived lock revision | **2/2 passed**, separately from the 264-test suite | Current `provider-authority-final.log`; owner copy changes only expected derived ID and manager provenance. Original reviewer file remains unchanged; `provider-authority-adaptation.json` records the original SHA and exact scope |
| Isolated development workload measurement | **1/1 passed** for complete-horizon observations; numeric target misses and incomplete search recorded | Current `performance-engine.log` / `.json`; separate temporary harness, not an additional integrated unit case |
| Intermediate review stages | **Historical**: 253-unit/3-browser timezone-only repair passed; original lock diagnostic still failed before its later repair | `unit-integrated253.log`, `browser-provider-guards.log`, `browser-account-guards.log`, `reviewer-diagnostics-known-gap.log` |
| Initial integrated Vitest and broad headless coverage | **Historical before repair**: 251/251 in 12 files; 26 distinct browser cases in groups of 14 and 12, with five repeated guard/presentation cases | Initial `unit-final251.log`, `browser-a.log`, `browser-b.log`, `browser-final-guards.log`; not final repaired-candidate pass counts |
| Initial visual inspection | Retained headless desktop streaming and mobile dense-lineup PNGs; source layout unchanged by the timezone repair | Initial `artifacts/roster-optimizer-stream-1440.png`, `artifacts/rso-mobile.png` |
| Account-switch readback after repair | Fictional authenticated sessions; late provider/save hidden, current intent retained, expired inputs read-only, explicit manual fork editable | Current browser account-guard run; intercepted fictional inputs, no actual account parity claim |

The unit command was:

```sh
npm test -- --run lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleOptimizer/workspace.test.ts lib/rosterScheduleOptimizer/reconciliation.test.ts lib/rosterScheduleOptimizer/providerRules.test.ts lib/integrations/yahoo/rosterPlanning.test.ts lib/rosterScheduleData/planning.test.ts __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx __tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx hooks/useRosterPlanning.test.tsx lib/in-season/access.test.ts lib/in-season/workspaceSchema.test.ts lib/in-season/workspaceRoutes.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit --pretty false
```

Browser runs used `npm run test:e2e -- e2e/roster-schedule-optimizer.spec.ts --project=chromium --timeout=30000`. The current four-case group uses `--grep 'provider refresh|connected refresh and account save|connected manager bench locks'`; the performance case uses `--grep 'planning worker measures'`. Older broad groups and timezone-only runs remain historical. A localhost-only server used port 3138, `PLAYWRIGHT_ISOLATED_NEXT=1`, fictional Supabase URL/public key and intercepted responses. It was stopped, with no listener remaining. No visible desktop/browser/cursor was used.

Initial browser setup was blocked by sandbox port binding; authorized local escalation resolved it. Temporal fixture failures were corrected by fixing the fixture date, and selectors were updated to the current lineup label and exact selected-step text. An earlier full run lost its local processes without a completion receipt; it is not counted as passed. Subsequent bounded groups completed. Failure/interruption logs are retained alongside the passing logs.

Timezone and workspace-only active/bench cases failed before their repairs (`timezone-red.log`, `manager-locks-red.log`) and passed afterward. The initial lint invocation's unsupported `--file` arguments did not run lint; corrected direct ESLint passed. No failed/interrupted command is counted as a pass. The original reviewer lock diagnostic expected an unchanged raw snapshot ID; the owner adaptation expects a derived revision and explicit manager provenance so calculation invalidation is not weakened to fit that diagnostic.

Desktop includes navigation at 1440×900 and expanded 1920×1080. Mobile includes 390×844 and 320×844. Keyboard Enter/Space/Tab focus and no document horizontal overflow were exercised. The 720×450 case is equivalent viewport reflow for 200% desktop zoom; no visible browser zoom control was operated.

## Acceptance matrix at the local candidate

| ID | Development/fixture status | Remaining release evidence |
| --- | --- | --- |
| AC-01 | **Verified local fixture scope**: timezone adoption, stale scope/account rejection, manual setup, provider rule/lock authority and labelled simulation inputs | Actual Yahoo profiles/timezones/horizons and rule evidence |
| AC-02 | **Verified local**: feasible baseline, displacement/dual eligibility/utility, guarded category deltas and zero-versus-missing cases | Compatible actual inputs for the declared cohort |
| AC-03 | **Verified local fixture scope**: timing/reset/reserve/eligibility/conditional-prefix cases plus connected active/bench locks, provider precedence and independent weekly-window conflict handling | Actual Yahoo timing, lock windows, limits/cost encoding and waiver semantics |
| AC-04 | **Verified local**: partial/repeated/stale/failed availability and explicit exclusion safeguards; ownership alone is not addability | Bounded actual league availability/source receipts |
| AC-05 | **Verified local fixture scope**: points/category/ratio/goalie/participation guards plus numeric connected manager-lock/provider-conflict assignment readbacks | Native player/goalie semantics and positive real-data readbacks for declared profiles |
| AC-06 | **Verified local fixture scope**: current-authority undo, manager-approved repairs, scope isolation, saved-manager active/bench consumption, provenance, conflict review, schema-valid save and reopen; lock re-review pending | Actual connected account/profile parity and production evidence remain unqualified |
| AC-07 | **Verified local**: free/premium engine boundary, capability/API enforcement, independent grant union, expiry/read-only and manual continuation fixtures | Operational/commercial fulfillment remains separate; existing commitments preserved |
| AC-08 | **Verified local**: dense/expanded desktop, 320/390 mobile, retained workspace selection, keyboard focus and zoom-equivalent reflow | No broader device or actual browser-zoom claim is made |
| AC-09 | **Incomplete / not real-data accepted** | Fresh admitted native player/goalie revisions for the complete selected horizon, exact RSO selected/no-move/category consumption and matching Start Chart readback where required |
| AC-10 | **Partly verified local**: source-age distinctions, permissions/expiry, failed refresh, response/worker invalidation and reopened fixtures | Owner-defined permitted freshness/revocation lag; warm-cache/news/revocation acceptance against that bound |
| AC-11 | **Verified local weekly fixtures; actual qualification incomplete** | Exact Yahoo weekly windows, manual/connected profile and forecast qualification before full launch |
| AC-12 | **Not cleared**: required source patches are included locally | All profile/forecast/provider/freshness gates plus separate release authorization, exact deployed build and observed live acceptance |

Statuses remain distinct: both repairs have **scoped verified local** evidence, with connected-lock independent re-review pending. The source is **not pushed**, **not deployed**, **not real-data accepted**. Multiple named itineraries, public sharing/export, out-of-session notifications, FAAB bidding advice and a universal category blend remain deferred/out of scope.

## Performance observations and qualification limits

Current observations at `2630a3377` are in `performance-engine.json` and `performance-browser.json`. Both profiles use fictional complete detailed skater forecasts, C-only eligibility and C:10/BN:15. All seven/thirteen selected dates remain present. They are declared development workloads, not actual league acceptance or production SLAs.

| Measurement | Observed result / limits |
| --- | --- |
| 25 roster / 300 candidates / 7 days; 2,275 forecasts | Five warmed isolated no-move outcome samples: median 33.8 ms, maximum 41.5 ms |
| 25 roster / 975 candidates / 13 days; 13,000 forecasts | Same isolated baseline: median 124.2 ms, maximum 127.9 ms |
| Bounded whole-engine plan, typical profile | 2011.1 ms with 250-evaluation/40-candidate/8-beam/4-step/two-second budget; depth 3, incomplete search and unresolved bench work |
| Bounded whole-engine plan, stress profile | 2061.8 ms; depth 0, incomplete fit/search/bench work; full horizon retained |
| Native headless worker, typical profile, default quotas | 709 ms from post to result; 70 active games across all seven dates; depth 2, incomplete search and bench work quota reached |
| Native worker edit/cancellation | Two event-to-termination samples: 15/15 ms; obsolete result DOM clears in 23 ms; canceled workers produced no result |
| Main-thread timer during startup/compute | 182 ticks; maximum gap 269 ms. This includes startup/serialization/rendering and prevents a universal sub-100-ms responsiveness claim |

Observed baseline and sampled edit/cancellation values fit the proposed 250/100-ms targets. The bounded whole-engine runs slightly exceed two seconds; they include baseline/selected/alternatives/bench phases and do **not** isolate alternatives latency. Both are below five seconds but return incomplete searches, especially the stress case. The typical browser's faster default-quota result is also bounded and incomplete. No optimum, universal latency, calibrated outcome or release guarantee is adopted. Task 6.5's local measurement/assessment is complete; actual cohort/device/profile qualification and any adopted guarantee remain part of tasks 6/7. Earlier 1,000-player candidate timings and the 999-candidate browser receipt remain historical in the initial evidence directory.

## Bounded actual acceptance pack and next dependencies

The following pack is prepared for the relevant owners; it contains no invented approved account, live capture or permission to run:

| Required pack field | Current state / owner |
| --- | --- |
| Candidate | Review repaired source `2630a3377722ea08186b6a662e70ce17aed057f8`; release owner `01a1195f` coordinates later integration/release |
| Connected lock requirement | Local active/bench/provenance/provider-conflict/save/refresh/undo/reopen fixtures pass. Focused independent re-review remains pending; actual daily/weekly provider rule/profile evidence is still required |
| Daily cohort | Both manual and Yahoo-connected daily workflows; points/category/ratio and goalie profiles must be explicitly declared. Exact league/team/account IDs, timezones, horizons and supported exclusions remain unfilled |
| Yahoo evidence | Provider-contract owner supplies authorized read-only roster, lock/settings, transaction timing/cost/reset, waiver/reserve, availability and credited goalie-minimum receipts. Unknown fields stay unknown; no credential or transaction workaround |
| Forecast evidence | Existing FORGE/M4 and consumer owners supply fresh compatible native revisions, manifest/run/date/class/horizon/source/participation identity, permissions and coverage/exclusions, then exact RSO assignment/category and required Start Chart readbacks |
| Freshness bound | Lead/data owner declares permitted cache/revocation lag before warm-cache, news, reopen, expiry/revocation and failed-revalidation qualification; no numerical SLA is invented here |
| Weekly profile | Actual league-local lineup windows independent of acquisition resets, midpoint/bench locks and acquisition-after-lock evidence; remains unqualified for full launch |
| Commercial terms | Business/entitlement owner resolves branding, final price/billing, exact dates/timezone and first-100/preview/refund/duplicate/complimentary rules; no grant activation |

The prior recheck closed P1 and confirmed accurate open-P2 wording at `32b51751e`; TJ subsequently directed closing the actionable local lock boundary. That repair and declared local measurements now pass their focused checks. Next, independently re-review `2630a3377` and this scoped evidence. Actual Yahoo profiles/approved read-only accounts and native revisions are essential dependencies for tasks 4.4 and 5.2–5.3; no fixture can replace them. Task 5.4 also requires the lead/data owner's permitted freshness/revocation lag. Reconcile those results and actual workload/profile evidence in task 6. Clear task 7 only after **both** daily workflows and positive real-data consumption pass; TJ's **A — Wait for both** remains binding. Team win-probability promotion is not a prerequisite. Actual weekly qualification in task 8 must precede full launch. Commercial decisions/activation in task 9 remain separate.

No push, remote build, deployment, serving activation, production-data change, credential work, provider transaction, model fitting or commercial fulfillment occurred. Later releases require separate authorization.

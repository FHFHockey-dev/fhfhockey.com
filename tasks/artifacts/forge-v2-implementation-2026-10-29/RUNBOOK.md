# FORGE v2 morning handoff — 2026-10-29

**Current qualified subset: none.** No horizon, category, scoring profile, participation probability, or interval has passed real scientific qualification in this task. Local implementation and synthetic evidence do not authorize prospective capture, production writes, hosted migrations, public release, or RSO activation.

Work lives in the canonical `/Users/tim/Code/fhfhockey.com` checkout on `octoberBranch`. The lead owns final review, exact checkpoint commits, consolidated test receipts, and task-list acceptance. Preserve unrelated dirty work and other owners' research/resource reservations. This document records the local implementation and the remaining decision gates; it is not an execution approval.

## Accepted local candidate and evidence

The local code candidate is **`43d35f8020d2071e07d08da13f50f1f882277f26`** on `octoberBranch`. Its scoped sources are pinned in [source-pins.json](source-pins.json); [verification.json](verification.json) records actual commands, results, review disposition and limitations. The final documentation commit contains these records without changing the code candidate.

- `2bb04301c` — approved contracts, document custody and source inventory.
- `4c8150349` — game-level candidate, schedule/refresh and temporal evaluation.
- `92f9d63bd` — immutable persistence, prepared queue/ledger integration and bounded read API.
- `43d35f802` — disabled explorer and real browser acceptance.

**48 of 63 subtasks are complete locally; 15 remain evidence/authorization gated.** The parent groups complete locally are 1, 3, 4, 5, 6, 9, 10, 11, 12. Gate status is authoritative in the [task register](../../tasks-prd-forge-v2-skater-game-forecasts.md).

The retained focused-test inventory is **163 v2 tests plus 93 existing consumer regressions**, across recorded runs. Final native persistence/artifact 12 and API 7 passed; final pipeline 16/integration 7 and refresh 34 passed. Final scoped strict TypeScript and ESLint passed across all v2 source/test/UI/page/API/browser files. Two real Chromium cases passed. No full build/full unit suite was run. The final independent source review reports no remaining blocker in its inspected seams; it does not replace scientific or owner acceptance.

## What is available locally

| Flow | Exact implementation | Current boundary |
|---|---|---|
| Identity, clocks, explicit missingness, signed seven-category scoring | `web/lib/forge-v2/contracts.ts`, `identity.ts`, `hash.server.ts`, `fixtures.ts` | Source hashes and availability clocks are required; fixtures remain synthetic. |
| Bounded supplied-source admission | `web/lib/forge-v2/data.ts` | Validates approved-use evidence, identity, pagination, hashes, source age, and cutoff. It does not acquire data or establish original historical availability. |
| Independent roster/IR/reserve/call-up population and next ten games | `web/lib/forge-v2/schedule.ts` | Caller supplies accepted schedule history through the supported season. No calendar-window shortcut; incomplete capture is disclosed. Real source wiring remains gated. |
| Schedule, trade, lock and horizon semantics | `schedule.ts`, `evaluation.ts` | Same-ID history, replacement links, first observed episodes, immutable primary selections, and separate final pregame selection. Persisted `playBegun` prevents reopening even if actual start is unknown. Unknown actual timing stays provisional. |
| Daily, pregame and material refresh state | `web/lib/forge-v2/refresh.ts` | Pure bounded queue, leases, retries, deduplication/coalescing, stale/gap states. No deployed cron or provider fetches. Material routing uses a target index after the measured fanout bottleneck. |
| Prepared local issuance | `web/lib/forge-v2/pipeline.server.ts` | Binds accepted features, episode, lock, model availability and scoring; writes artifact references and immutable vintages through injected stores. Current allowed evidence classes are **fixture** and **retrospective reconstruction**; it cannot be called a prospective/public producer. |
| Persistence and artifacts | `web/lib/forge-v2/history.server.ts`, `artifacts.server.ts`; `supabase/migrations/20261029235656_forge_v2_immutable_history.sql` | Separate private records and operational queue; committed publication proof; immutable artifact bytes/manifests; archive/restore with hash checks. Local migration file is not evidence of hosted application. Chef owns native-database verification and final storage review. |
| Conditional means, baselines and participation | `web/lib/forge-v2/model.ts`, `participation.ts` | Development algorithms, cutoff-bound model availability, seven explicit heads, matched last-five/season-rate baselines, distinct official-appearance labels and adjustment once. No real fitting or probability qualification completed here. |
| Joint/scoring/interval reproduction and qualification | `web/lib/forge-v2/uncertainty.ts`, `qualification.ts` | Joint outcomes preserve dependence and PPP constraints; signed scoring and both interval levels; pinned dependencies and generator identities. Qualification requires external independent evidence and an H1–Hk scope. There is no accepted manifest for real use. |
| Settlement, accountability and exposure distinction | `web/lib/forge-v2/evaluation.ts` | FR26 first-vintage selection, final pregame series, official-appearance-only performance grades, append-only corrections, matched accuracy/interval/participation metrics and dependence groups. Stored, snapshot, served and displayed RSO evidence remain distinct. |
| Prepared reads and UI | `web/lib/forge-v2/api.ts`, `api.server.ts`; `web/components/ForgeV2/ForecastExplorer.tsx`, `ForecastExplorer.module.scss` | Prepared bounded reads, profile-bound pagination, separately supplied latest/final records, issued-vs-selected scores, history/uncertainty/actual markers, keyboard/mobile interactions. No inference or acquisition on reads. |
| Explicit release fences | `web/pages/forge/v2/index.tsx`; `web/pages/api/v2/forge/[operation].ts`; `web/lib/forge-v2/integration.ts` | Page returns `notFound`; API wrapper supplies `enabled:false, repository:null`; `RSO_V2_ADAPTER_ENABLED` is false. Qualification alone cannot lift these fences. |
| Operations and release proposals | `web/lib/forge-v2/operations.ts` | Read-only alarms and measurements; immutable scoped state proposals. `readyForActivation` remains false. State transitions do not change deployment settings. |

The prepared pipeline now captures content-addressed opportunity, episode, lock and event observations. An episode exit is a new immutable snapshot linked to its entry; reentry links to the prior closed episode. Native PostgreSQL tests verify original/closed/reentered snapshots remain separate. Scope reconciliation additionally fences superseded pending/running jobs through queue CAS before capture; no prior forecast is deleted.

## Evidence from this lane

| Check actually run | Result and limits |
|---|---|
| Focused `schedule.test.ts`, `evaluation.test.ts`, `lifecycle.test.ts` | 29 tests passed: 8 schedule, 17 evaluation, 4 lifecycle/operations. Synthetic only; native SQL totals belong to Chef's receipts. |
| Lifecycle after the model-availability contract change | Named H10→H1 case passed; three unrelated cases, including the capacity benchmark, were intentionally skipped. Synthetic dependencies became available December 15; fitting/availability are December 16, before the January 1 cutoff. |
| Real Chromium desktop 1440×1080, final CSS | Passed; initial fixture readiness approximately 53 ms and scripted interaction sequence approximately 396 ms. Zero page overflow, external requests, or page errors. |
| Real Chromium phone 390×844, final CSS | Passed; initial readiness approximately 50 ms and interaction sequence approximately 456 ms. Browser testing found a 25 px overflow from the native uncertainty select; the UI owner fixed its shrink/width rules and the full phone case then passed. Only the history table scrolls horizontally. |
| Artifact lifecycle | Real private temporary files: write, archive, verified read/restore, missing artifact, corruption, and no silent replacement from archive. Original and signed re-scored joint arithmetic reproduced. Unqualified public interval reproduction remained unavailable. |
| Operations/release proposals | Receipt mismatch, missing limits, stale sources, retry/integrity/settlement/qualification alarms and scoped disable/refusal paths passed. A separate pure-state rehearsal used explicitly fabricated trusted-reader proof to test promote→disable→restore and wrong/expired approval rejection. No real qualified candidate or production operation was fabricated. |

The lifecycle covers daily/material and unchanged-valued vintages, a failed refresh, missing first H8 episode through postponement/re-entry, final-vs-H1 selection, late-publication exclusion, penalty-only official credit, nonappearance/dressed-unused/ambiguous/cancelled branches, and corrected outcomes/grades. The UI exercises the real React component and Sass, with synthetic display DTOs visibly labeled as such; numeric display fixtures are not accepted qualification manifests.

Final screenshots: [desktop](screens/desktop.png), [phone](screens/phone.png). Browser harness: `web/e2e/forge-v2.spec.ts`. It builds into a temporary directory, listens only on an ephemeral `127.0.0.1` port, blocks other origins, and cleans up its server/bundle. It does not start Next, install browsers/dependencies, or use account/provider data.

Reproduce only after a relevant change, with the shared heavy lock acquired atomically and released by its owner:

```sh
# Owning directory: /Users/tim/Code/fhfhockey.com/web; Node 22.11.0
npm test -- --run lib/forge-v2/schedule.test.ts lib/forge-v2/evaluation.test.ts lib/forge-v2/lifecycle.test.ts --maxWorkers=1 --minWorkers=1
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e -- e2e/forge-v2.spec.ts --project=chromium --workers=1 --output=/private/tmp/forge-v2-browser-review-results
```

Do not rerun the full capacity case for a fixture-only or documentation change. Never remove or steal an existing `/private/tmp/fhfh-heavy.lock`.

## Capacity observations, not production limits

The bounded fixture used 1,200 skaters × 10 scopes, 12,000 daily jobs and one event adding 12,000 material jobs. Initial measurements: planning 114 ms; predictions using only five synthetic training rows 513 ms; daily enqueue 412 ms; lease recovery 917 ms; queue serialization 125 ms; 24,556,324 serialized JSON bytes.

Material fanout initially took 20,829 ms. The source owner indexed coalescible material jobs by target. A same-shape, fanout-only remeasurement took **948 ms**, preserving the 12,000-job input and producing 24,000 distinct issuance keys. These single local runs show approximately a 22× timing ratio, not a production throughput guarantee.

A 2,214-byte sample publication, at an illustrative two revisions per scope per day for 365 days, yields 8,760,000 rows and 19,394,640,000 uncompressed JSON bytes. This excludes distribution/calibration artifacts, indexes, replicas, backups and provider costs. The 365-day arithmetic is an estimate window, **not an expiry policy**: captured history and required artifacts have no automatic deletion under the PRD.

Unmeasured or unapproved: real-model universe inference, hosted database write/read latency, deployment memory/CPU limits, archive service latency, sustainable permanent retention, representative API/page sizes and latency at scale, and capacity reserved for v1/RSO. Fixture parameters such as concurrency four are test inputs, not approved production limits.

## Scientific and source blockers

The bounded [source inventory](source-audit.json) found useful code but did not establish complete original source captures, historical availability, intended-use rights, effective-and-observed affiliation history, or a complete injury/reserve/call-up population. Current mutable rows and timestamps are insufficient substitutes for original receipt evidence.

Official-source examples must still resolve legitimate zero-minute/penalty-only appearance credit, dressed-unused, true nonappearance, ambiguous/incomplete feeds, and PIM completeness. Existing positive-TOI definitions are not the approved event definition. WGO settled outcomes must remain outcome labels, never cutoff-time predictive inputs.

Before real fitting or evaluation, the source/data owners must register admissible datasets and exposure, chronological training/development/calibration/untouched allocations, exact candidate recipes, tuning/stopping budgets, baselines, squared-error selection, numerical support/calibration/regression thresholds, dependence treatment, missingness limits and proposed release scope. The frozen protocol needs independent methodological review before final labels are opened. No protected dataset or untouched period has been cleared by this lane.

No real evidence yet establishes baseline improvement, calibrated 50%/90% intervals, calibrated participation, qualified PIM/joint-category support, genuine prospective publication/start-time proof, sustainable retention, or actual RSO display exposure. Implementation review receipts are distinct from scientific approval. Review findings and their tested repairs are recorded in `review-followup.json`; final code pins are in `source-pins.json`. **The honest release decision remains no qualified subset.**

## Proposed shadow approval packet — incomplete and not executable

| Required field | Concrete proposal or unresolved prerequisite |
|---|---|
| Candidate | Local code candidate `43d35f8020d2071e07d08da13f50f1f882277f26` and `source-pins.json`. Real model/feature/source/joint-generator/calibration candidate hashes remain unavailable pending accepted datasets and frozen science. A moving branch is never approval. |
| Environment and isolation | Owner names the project/environment, isolated private schema/artifact paths, service identity, and resource owner. No hosted environment has been approved in this packet. |
| Data scope | Owner names exact source captures, intended-use evidence, player/team/game/season IDs and future observation period; source/exposure gates above must be resolved. Existing ingested inputs only; no per-player provider acquisition. |
| Producer readiness | A separately reviewed change is needed for genuine prospective issuance: the current prepared pipeline intentionally permits only fixture/reconstruction classes. Do not relabel existing synthetic/reconstructed records as originally issued. |
| Clock contract | Preserve observation/publication/receipt, cutoff, model availability, generation, committed readback, accepted schedule/lock epochs and authoritative actual starts. Freeze FR26 before observing outcomes. |
| Schedule | After authorization, use the PRD's daily-by-08:00 America/New_York, T−30 attempt, and 15-minute accepted-evidence target. Misses stay visible; no backdating or invented successful captures. No new deployed schedule is requested or installed here. |
| Limits and reservations | Owner supplies measured maximum dates/records/pages/events/jobs, batch size, concurrency, retries/lease times, wall-clock runtime, CPU/memory, storage growth, request/fanout bounds, and v1/RSO reservations. They are currently **unset**, so execution is blocked. |
| Cost | Identify paid services, expected request/build/storage usage and unknown attribution before approval. No budget or saving is asserted from local timing. |
| Monitoring and stop conditions | Stop admission/publication on source rights/provenance gaps, clock/hash/identity conflict, unsupported locks or play begun, qualification/dependency drift, capacity/reservation breach, or exhausted approved retry/runtime limits. Preserve data and emit explicit unavailable/stale/integrity evidence. |
| Settlement and evaluation | Capture all independent opportunities, including missing forecasts; append official outcomes/corrections. Keep evidence classes and FR26 selections fixed, and report coverage and matched baselines rather than selecting favorable rows. |
| Exit and review | Owner defines the finite stop date/job budget and the reviewer. Close with exact execution receipts, costs/unknowns, failures, completeness and rollback state. V1/V2 scientific gates remain separate. |

No database push, provider call, cron change, deployment, or prospective run follows from approving the implementation or reading this packet. Exact external scope and bounds require separate current-task authorization.

## Disabled RSO consumer acceptance package

The candidate proposes **zero edits to existing RSO consumer files**. Its only consumer-facing entry point is `web/lib/forge-v2/integration.ts`, and that adapter deliberately returns unavailable even after qualification. A concrete integration diff still requires the consumer owner's file transfer and acceptance. The read-only call-site inventory below identifies the proposed seams without changing them.

The intended contract is a qualified availability-adjusted contribution for the exact canonical player/game/season/conditioning/profile/horizon/cohort/cutoff, with separate performance and participation vintage IDs, freshness and qualification references. `availabilityAdjusted` in `participation.ts` applies probability once and rejects incompatible inputs or already-adjusted data. Unknown participation, unavailable contributing categories, unsupported scope, stale inputs or missing qualification must remain explicit; do not silently substitute v1 and label it v2.

The proposed owner-controlled patch would touch these exact seams only after qualification and an ownership transfer:

- `web/pages/api/v1/roster-schedule-optimizer/data.ts`: add an explicitly disabled v2 source branch before `loadPlanningData`, retain bounded transport and read nonce, and provide exact served-vintage receipts; an unavailable v2 result stays unavailable.
- `web/lib/player-forecasts/forecastServingSource.ts`: register a separate v2 source identity and exact approved scope; preserve the current native/legacy decisions and existing empty fallback behavior. Do not relabel an older source as v2.
- `web/lib/rosterScheduleData/planning.ts` and `bridgeForecastWire.ts`: the existing route imports these load/transport seams; owner review must define versioned contribution transport and validate identity, scoring, conditioning, freshness and one-time participation. They were not modified in this task.
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`: its existing `expandBridgeForecasts` response reconstruction is the inspected display seam. Bind actual displayed values to immutable v2 IDs and nonce/consumer version in an owner-approved display receipt path. No client display proof is inferred from the server response.

Existing policy, serving-source and healthy-reserve fixture regressions passed **93/93** unchanged during this task. V2 gate/adjustment tests separately show disabled behavior and one-time participation. These support isolation; they do not establish accepted qualified end-to-end consumer/display behavior. The current patch proposes zero active shared-file changes.

Before activation, the RSO owner must supply:

1. A reviewed diff naming the exact source-selector, scoring, persistence and rendering call sites; an explicit disabled default and separately approved rollout target.
2. Side-by-side fixtures comparing current RSO with the disabled candidate, including injury/trade, nonappearance, zero-minute official credit, missing categories, signed profiles and no double participation adjustment. Unchanged deployed consumer behavior is not established by this lane's adapter tests.
3. A receipt path that distinguishes stored forecast → bridge snapshot → served response → actual display. Bind immutable IDs, selected scoring/profile, consumer version, exact value/hash and exposure timestamp at every step. Missing display evidence stays missing; a later v2 forecast cannot replace what RSO displayed.
4. A finite enablement/rollback plan, expected resource use and designated owner. Public v2 release does not activate RSO.

`reportRsoEvidence` in `evaluation.ts` supports the distinction and rejects mismatched lineage. No real consumer/display receipts were collected here.

## Scoped disable, rollback and restore procedure

These steps describe proposals for an authorized operator. They do not connect the local state functions to production, weaken qualification, or grant authority over v1/RSO.

1. Read the incident, exact active scope/candidate, current qualification/artifact identities and publication/queue state. Preserve the source evidence, issued values, artifacts, selected IDs, outcomes and original grades. Determine the affected horizons/cohorts/profile rather than disabling unrelated systems.
2. Use `summarizeOperations` on bounded prepared inputs. It reports due/proven publication counts, latency, latest source age, unavailable categories/opportunities, queue/retries, artifact incidents, outcome lag and qualification drift. Missing limits/evidence fail closed. A clean report is not activation authority; `readyForActivation` is always false.
3. Build an append-only `transitionRelease(... action: "disable")` proposal for the affected scope, with a unique event ID, timestamp and reason. The result preserves other scopes and prior events. It **does not** change the literal page/API/RSO fences or hosted settings. Applying a hosted disable requires separately authorized owner scope.
4. Keep new affected values unavailable and retained values clearly historical/stale; retain full audit history. Do not delete failed vintages, outcomes or artifacts; do not replace missing artifacts with a newer model. Restore archived bytes only after identity/hash verification.
5. A restore proposal requires a candidate previously accepted in that exact scope, current valid qualification and dependencies, an exact candidate-content hash and scope hash, and a current approval ID/environment/time window. `transitionRelease` refuses missing proof; there is currently **no real qualified candidate to restore**. No successful production restore was tested or performed.
6. After an independently approved external action, use the approved bounded verification plan, record actual request/build counts and results, and stop when conclusive. The repository's default approved-release smoke budget is at most five sequential read-only application requests; it is not permission to send any now. Builds/pushes/deployments and a larger smoke budget require their own explicit approval.

The final task register and verification receipt retain the accepted/open IDs and evidence. Scientific, source, prospective, hosted and RSO-owner gates remain explicit.

## Independent audit requests

- **Astra scientific audit:** inspect the source inventory and proposed frozen protocol before any protected labels are opened. Vet official-appearance/PIM semantics, original availability clocks, grouped temporal allocations, finite candidate/stopping budget, paired baselines, FR26 first-episode selector, joint signed-weight calibration, minimum support and dependence-aware uncertainty. Challenge the kernel candidate and subset proposal; a code review cannot certify predictive value.
- **Claude Opus 5.5 implementation audit:** review exact source pins and the final local commits, especially top-level transaction publication proof, late-commit pagination snapshots, queue CAS/lease fencing and acknowledgement recovery, trade/cancel/reentry scope transitions, immutable episode closure, artifact restore/failure behavior, public DTO boundaries and disabled RSO source/receipt integration. Reproduce bounded native and browser fixtures locally; do not deploy or open protected data.
- Triage a newly found issue against the pinned candidate and add it to the task register. Preserve failed evidence. Do not tune on final labels and rerun the same holdout as though untouched.

## Smallest next actions for the unchecked work

| Open task IDs | Blocker and smallest next action | Recommendation |
|---|---|---|
| 2.2,2.4,7.1 | Data/source owner supplies or points to authorized original captures, rare official appearance/PIM examples, completeness/rights evidence and a hashed exposure register. No new production acquisition is authorized. | Resolve provenance and label semantics before fitting. |
| 2.5,7.3,8.3,8.5,13.4 | Freeze chronological partitions, finite recipes/budget, numerical support/calibration/regression criteria and dependence treatment with independent methodological review; identify untouched custody. Then explicitly clear the permitted fitting/evaluation data and bounded run. | Keep final labels closed; retain all registered trials/failures. |
| 13.2,14.1 | Owner specifies real-model scope, isolated environment, source captures, finite player/game/date/job bounds, retention/storage/cost budget and v1/RSO resource reservation. Current timings are synthetic. | Measure approved local real-data capacity first; approve a finite shadow packet only after all fields are concrete. |
| 14.2,14.3,14.5 | No original prospective vintages, untouched qualification or accepted full/category/horizon scope exists. | Run only the separately approved future capture; preserve misses and evaluate the preregistered contiguous H1–Hk candidate. Current decision remains no qualified subset. |
| 14.4,14.6 | Public and RSO release approvals and consumer display acceptance are absent. Shared consumer files remain owner-controlled. | Keep gates disabled; after qualification, approve exact candidate/environment/build effects and owner-scoped consumer changes with bounded smoke/rollback. |

Assumptions needing later vetting: the isolated empirical-kernel/full-vector candidate replaces rejected aggregate-horizon/positive-TOI assumptions; it has not earned predictive approval. Scope builders consume explicitly supplied complete accepted populations, not inferred missing rows. Historical custom scoring changes scores; prepared error metrics for an unregistered selected profile remain explicitly unavailable. A future prospective producer requires separately reviewed authority wiring; fixture/reconstruction outputs cannot be relabeled live.

# PRD: FHFH Comprehensive Completion, Audit, and Optimization

## 1. Introduction / Overview

This PRD is the canonical product and execution contract for the repository-wide completion program defined by `web/rules/super-goal.md`. It consolidates every discoverable FHFH PRD, task list, embedded checklist, audit, implementation plan, runbook, schema contract, research note, and current implementation signal into a single dependency-aware program.

The program is continuous. It first verifies and finishes unfinished initiatives (Wave A), then plans and completes not-started or untracked initiatives (Wave B), and finally audits and remediates every completed initiative (Wave C). Historical checkmarks are claims that require implementation evidence and a Wave-C audit; they are not accepted as proof by themselves.

### Canonical control artifacts

- `tasks/TASKS/super-goal/prd/prd-fhfh-comprehensive-completion-audit-optimization.md` — this PRD.
- `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md` — canonical task control plane and source-checkbox ledger.
- `tasks/TASKS/super-goal/super-goal-context-diary.md` — the only durable super-goal execution diary.
- `tasks/TASKS/super-goal/super-goal-final-summary.md` — final evidence report, maintained as a skeleton until completion.

## 2. Goals

1. Inventory and classify every artifact under `tasks/TASKS/` and every implementation location needed to verify it.
2. Preserve source provenance and import every actionable checkbox into the master task list using stable source identifiers.
3. Repair every missing, empty, duplicate, superseded, or conflicting PRD/task-list pair without erasing source history.
4. Complete every Wave-A initiative before broad Wave-B implementation, subject to documented dependency and risk ordering within each wave.
5. Complete every Wave-B initiative, including implementation, verification, documentation, and source/master synchronization.
6. Audit every initially completed and newly completed initiative; close every P0/P1 and complete every P2/P3 unless the user explicitly approves an exception.
7. Verify shared data, identity, auth, model, cron, API, UI, security, pagination, observability, and documentation contracts across initiatives.
8. Leave a recoverable diary and a final evidence-backed summary that reports every initiative consistently.

## 3. User Stories

- As the project owner, I want all scattered plans and checklists represented in one program so unfinished or untracked work cannot disappear.
- As the project owner, I want implementation to continue after planning so the repository reaches the actual Definition of Done.
- As a developer, I want each master task traceable to its source and verification evidence so status is auditable.
- As an operator, I want ingestion, cron, auth, and model workflows to have safe failure behavior, pagination, observability, and current runbooks.
- As a product user, I want FHFH surfaces to be correct, responsive, accessible, and clear about loading, empty, error, stale, and partial states.
- As a future Codex session, I want an exact restart point and understood working tree so prior work is preserved.

## 4. Functional Requirements

### FR-1 — Governing workflow and precedence

Read and apply `web/rules/super-goal.md`, `tasks/TASKS/rules/create-prd.mdc`, the compatibility pointer at `web/rules/generate-tasks.mdc`, the authoritative task-generation rule at `tasks/TASKS/rules/generate-tasks.mdc`, and `tasks/TASKS/rules/process-task-list.mdc`. Latest user instructions outrank the charter, which outranks governing rules, initiative artifacts, and inferred conventions. Record resolved conflicts in the diary and master task list.

### FR-2 — Exhaustive artifact and implementation inventory

For each initiative record a stable ID, domain, PRD, task list, supporting artifacts, claimed checkbox state, verified status, implementation evidence, dependencies, pair/duplicate/empty/conflict state, wave, and next action. Inventory implementation locations only as needed to verify active work; do not treat filenames as implementation proof.

### FR-3 — Source normalization and provenance

Import every source checkbox, including completed historical rows and embedded checklists. Each imported row must include its original state, source path, source line or stable ordinal, and master initiative mapping. Deduplicate only semantically identical work and retain all source references. Mark completed source work as claimed complete pending Wave C.

### FR-4 — Pair repair

Create a task list for a PRD-only initiative, derive a concise PRD for a task-list-only initiative, and recover empty scopes from neighboring artifacts plus implementation. A pair may be explicitly merged into a broader initiative when scope and provenance remain unambiguous. Do not delete historical artifacts.

### FR-5 — Wave A execution

Verify and finish all in-progress, nearly finished, partially implemented, active, and remediation-in-progress initiatives. Fix correctness and shared-contract blockers before downstream UI or polish. Synchronize source and master checkboxes immediately after evidence is obtained.

### FR-6 — Wave B execution

After Wave A, plan, start, implement, verify, and document every not-started, planned, untracked, missing-pair, or empty initiative. Add newly discovered work to both source and master lists as `NEW` tasks.

### FR-7 — Wave C audit and remediation

Audit every completed initiative after its latest implementation changes. Evaluate requirement alignment, data integrity/freshness/provenance, reliability/idempotency/cron behavior, security/auth/privacy, performance/pagination/caching, UX/accessibility/responsiveness, maintainability/ownership, documentation, and regression protection. Log findings as P0–P3 tasks, remediate in severity/dependency order, and re-verify.

### FR-8 — Dependency-aware ordering

Within each wave order work by: release/correctness/security blockers; shared ingestion/schema/identity/auth/cron/model foundations; multi-initiative blockers; nearly completed work; product surfaces and low-risk optimization. Document each material reorder.

### FR-9 — Initiative Definition of Done

An initiative is complete only when PRD requirements and all old/new tasks are closed or explicitly approved out of scope; source/master lists agree; required code/data/jobs/routes/UI/docs exist; narrow verification passes; important logic has proportionate regression protection; potentially large Supabase reads use verified pagination; relevant UI states and operational failures are handled; temporary debris is removed; and blockers/exceptions are explicit.

### FR-10 — Supabase and data safety

Treat PostgREST reads as paginated unless provably bounded. Verify full-table reads using `.range()` loops, RPC-side pagination, or another documented bounded strategy and continue until a short page. Before Supabase implementation, check current changelog/docs. Enforce RLS and ownership-aware policies on exposed data, avoid user-editable authorization claims, keep service-role secrets server-only, review view/function privilege behavior, and run the narrowest available advisors/query verification for schema work.

### FR-11 — Implementation discipline

Prefer targeted in-place edits and current repository conventions. Preserve unrelated dirty-tree work. Add tests for non-trivial calculations, parsing, normalization, transformations, meaningful branches, API behavior, and regressions; use direct verification for low-risk presentation or wiring changes. Remove scratch artifacts before completion.

### FR-12 — Pause protocol

Pause only for destructive/irreversible changes, broad architecture replacement, breaking contracts, mass deletion/route removal, production/provider/account actions, material conflicts or strategy forks, invalidated assumptions, or true user-owned manual action/verification. Before pausing, synchronize source/master tasks and diary and provide the exact checkpoint structure required by the charter.

### FR-13 — Durable context recovery

Maintain only the canonical diary. At initialization, significant task boundaries, pauses, resumes, compaction, dependency/scope/status changes, and completion checkpoints, append factual entries with files, decisions, checks, blockers, discoveries, and exact next action. Recovery requires re-reading the charter, rules, canonical PRD/list, latest three entries, status/diff, and active initiative artifacts before resuming.

### FR-14 — Final integration and summary

Reconcile shared contracts and verify critical end-to-end paths, build/type/lint/test status, completeness/pagination/identity/freshness/leakage boundaries, cron health, auth/entitlements, UI states, accessibility, performance, observability, and documentation. Populate the final summary with consistent category/initiative/path/status/goal/support/evidence/findings/exception sections and repository-wide totals. Severity rollups count each distinct explicitly classified root or independent child finding once, never its imported/master mirror or a same-root resolution row; approved-exception rollups include only durable exception packages still in force, not completed strategy choices or one-time rollout waivers that have been consumed.

### FR-15 — Initial initiative registry

The seed registry below is a starting classification; verified repository evidence may split, merge, or reorder entries. Every entry receives a Wave-C audit after its latest implementation.

#### Wave A — unfinished first

| ID | Initiative | Domain | Claimed state | Key dependency role |
|---|---|---|---|---|
| A-AUTH | Authentication and user settings | Platform | Wave A active; 189/208 rows, 19 open | Shared auth/entitlement foundation; callback, expired-session recovery, P1 autofill-exposed credential containment, canonical provider/manual-config documentation, and production confirmation/recovery Inbox receipt are reconciled; received-link/provider/PKCE gates plus value-free legacy-mailbox credential containment remain open |
| A-CRON-EMAIL | Cron audit email failures | Operations | Wave A active; 55/62 rows, 7 open. The audit-payload parent is closed by deployed wrapper provenance plus a natural `update-shift-charts` success/HTTP-200 row on the exact scheduled route. Cross-route auth inventory freezes 59 active HTTP jobs / 52 routes, 20 admin-or-cron, one exact-cron-only, 31 unprotected, and all browser/internal callers after projection input/derived and local `update-PbP` compatibility-adapter hardening; root enforcement remains route-by-route. P1 season-writer/WGO/missing-secret auth boundaries are verified locally; P0 finalized after stable redeploy, 59/59 literal-to-Vault conversion, 61/61 activation parity, 47/47 green probes, missing/old rejection and current authorization, canonical-one/candidate-zero cleanup, executable-helper removal, and honest provider/cron-history/WAL/backup/log retention documentation | Operational visibility and credential boundary; reconcile B-CRON-NST |
| A-GDL | GDL suite ingestion | Data ingestion | Wave A active; 73/85 rows, 12 open. Canonical provenance/RPC migration `20260716112909`, replacement-branch compatibility, production apply, one exact two-team Gamecenter probe, and local four-receiver processor-error containment through NEW 21 are verified. NEW 20 is closed by four distinct value-free Vercel/applet rotations, unchanged-source READY Production redeploy `dpl_43DPkUc3bVS2CVitR7vdiduf3CzJ`, and exact four-route retired/replacement `401/400` proof. IFTTT support found the account under NEW 22 and escalated historical-key retirement to engineering; the owner clarified that the request is precautionary with no known leak. No provider invalidation evidence exists. Promotion/events remain paused because payload repair NEW 14 remains, approved remove/reconnect failed to retire the prior provider key (NEW 13/15/16/17/18), and the disconnected podcast trigger drifted (NEW 19) | Shared lines identity/data foundation |
| A-3P | Three Pillars Analytics | Analytics | Wave A active; 83/85 rows, 2 open. Only external-provider parent 13.0 and live player-prop persistence/matching child 13.3 remain; no exception is approved | Umbrella dependency for sustainability/trends |
| A-SUST | Sustainability model | Analytics | Wave A active; 85/89 rows, 4 open. Backtest harness/docs are reconciled with an honest no-projection-history gate. Local NEW 8 canonical-name fallback passes bounded pagination/chunk/API/type proof; exact guarded publication, production deployment, and named-row verification remain separately authorized work | Depends on rolling metrics/model contracts and B-CRON-NST NEW 61's authoritative natural-scheduler ownership/order gate; unblocks Command Center Trust/Fade and B-SUST work |
| A-US-SOS | Underlying stats remediation/SOS | Stats surfaces | Wave A complete; 33/33 rows; final standings-detail freshness/coverage evidence verified; dynamic Wave-C audit pending | Shared underlying-stats foundation |
| A-SITE | Site surface expansion roadmap | Site | Wave A complete; 70/70 rows; dynamic Wave-C audit pending | Depends on underlying surfaces |
| A-STYLE | Style system/underlying restyle | UX | Wave A complete; 87/87 rows; dynamic Wave-C audit pending | Depends on stable routes/components |
| A-FORGE-V1 | FORGE projection model V1 | Models | Wave A complete; main 40/40, nested skater 55/55, embedded PRD 18/18; owner-approved runtime/14-day evidence exception blocks promotion/default switching; dynamic Wave-C audit pending | Shared FORGE model contract |
| A-FORGE-DASH | FORGE dashboard remediation | UX/models | Wave A complete; 75/75 remediation rows | Option A deployed; credential rotated across Vercel/Vault/60 commands; jobs 308/393 Vault-backed; legacy rollback hydration is request-safe; Top Adds promotion retains the prospective non-zero in-season evidence gate |
| A-FORGE-CC | FORGE Command Center | Operations/models | Wave A complete; 80/80 rows; one-release coexistence promoted | `/FORGE` primary actions use Command Center; `/forge/dashboard` remains labeled rollback; A-SUST owns null-name remediation; final swap is Wave-C NEW-006 |
| A-FORGE-P4 | FORGE ecosystem pass four | Models | Wave A complete; 91/91 rows | Multi-surface remediation complete; dynamic audit pending |
| A-FORGE-LIVE | FORGE living pass four | Models | Wave A complete; 63/63 rows; isolated selected-game probe passed at 15.157s | Dynamic Wave-C audit pending |
| A-PRED | NHL game prediction model | Models | Wave A complete; 228/228 rows across model/accuracy/roster-SOS lists | Candidate metrics persisted immutably; owner-approved evidence gate defers production until v6/v5 validation |
| A-XG-TREND | xG trending completion | Models | Wave A complete; 170/170 rows; production flurry materialized with raw invariance, corrected candidate shadowed inactive/non-champion, and richer-rebound heads verified offline without promotion | Depends on xG/NST foundations; dynamic Wave-C audit pending |
| A-XG-REL | xG release remediation | Release/models | Wave A complete; paired lists 47/47 | Training-use gate satisfied with visible approved exceptions; production cutover remains separate |
| A-DRAFT | Draft Dashboard | Yahoo/product | Wave A complete; 91/91 rows; owner-approved option A retains inline/collapsible settings | Dynamic Wave-C audit pending; B-DRAFT-STYLE may revisit presentation |
| A-DRAFT-DEBUG | Draft Dashboard debug/performance | Yahoo/product | Wave A complete; 14/14 reconciled rows; SHA complete; owner-approved option-A historical relative TTFP exception | Dynamic Wave-C audit pending |
| A-DRAFT-RANKER | Account-backed personal NHL Draft Ranker | Product/auth/rankings | Wave A launch scope complete; canonical task list 50/55 checked. DR-072/Phase 7 are complete from PR #352's aggregate-only final review and stage-only authenticated redeploy; ignored localhost authenticated-readiness is verified without tracked page/production mutation; the five open Phase 8 rows are reclassified to `B-DRAFT-RANKER-P8`. The separate launch runbook remains 10/10 checked | Depends on A-AUTH and canonical NHL/Yahoo identity contracts; beta entitlement, discovery, contribution collection, public Community Ranking, and every Phase 8 capability retain separate gates; dynamic Wave-C audit pending |

#### Wave B — plan/start after Wave A

| ID | Initiative | Domain | Claimed state | Key dependency role |
|---|---|---|---|---|
| B-CRON-NST | Cron NST/audit remediation | Operations | 57/66 source rows; 9 open. Baseline parents 1.0/2.0 are evidence-reconciled; placeholder `2025030417` remains terminal 0/0/0 and current-season discovery is zero. NEW 36 is complete for the credential-free `public` baseline through immutable old-history archive/checksums, replacement-branch catalog/ACL/runtime/advisor parity, contiguous production tracking `20260716112908`–`20260716112910`, and guarded authoritative publication at `09c4d96`; NEW 60 now records that the separately scripted exposed `analytics` schema was omitted, leaving a later data-less branch's PostgREST schema cache at 503/`PGRST002`. NEW 55 preserves all three trigger routes/row bounds with hidden fail-closed canonical-Vault auth and zero target bearer/direct-execution residue. Exact rollout deployment `dpl_5LADmdbVfdJEzKubKkpR7Yr7zxzk` passed five-alias 200/401/200 health; current customer aliases resolve READY descendant Production `dpl_3rviF6Zfuyk9s2MqjC7myNGKA6i9` at `7d55088`, while latest remote-tip deployment `dpl_EARfsnf1EbjN7dHx1aAS2bKRc1Qh` is READY/unpromoted. NEW 50 is closed by natural non-dry-run 64-job report/email proof; NEW 58 owns the locally repaired current-self-audit false warning and its production/natural zero-warning gate; NEW 59 owns the three-job/25-row residual partial-success reconciliation. NEW 56/57's value-free repository/history, catalog, retained-statement, and bounded 24-hour Supabase/Vercel log inventories found no current consumer, but cannot exclude unpublished, opaque, or pre-reset clients; both public-RPC security findings remain excluded from clean bootstrap and separately breaking-contract/public-contract approval-gated. NEW 60 requires authoritative analytics migration/catalog/security/type parity and guarded production tracking reconciliation. NEW 62 closes the import-time WGO batch/process-exit lifecycle defect through explicit script opt-in, import regression, successful production build, a persistent production server, and HTTP-200 DRM proof. NEW 61 owns the locally proven 10:42 priors and 10:43 window-z cross-provider collisions and requires authoritative ownership/non-overlapping scope plus deployed zero-concurrency, ordered-audit, and natural-run evidence. Historical pending remains 14,417 with 16 retained valid completions. Parents 3.0–5.0 remain open | Reconciles A-CRON-EMAIL and NST ownership |
| B-SUST-BAR | Sustainability Barometer | Analytics/UX | 0/8 | Depends on A-SUST |
| B-SUST-AUD | Sustainability/trends audit | Analytics | 0/5 | Depends on A-SUST and recovered trends scope |
| B-GAMEGRID | Game Grid master dashboard | Stats/product | 0/5 | Depends on underlying data/routes |
| B-SKO | SKO charts | Models/UX | Pair repaired; 0/53 generated rows complete | Reconciled with B-SKO-BURN; depends on stable model/data ownership |
| B-START | Start Chart/model | FORGE | Pair repaired; 0/51 generated rows complete | Depends on FORGE V1 |
| B-FORGE-COMBO | FORGE + Trends + Start Chart | Models/product | 0/10 | Depends on A-FORGE-V1, A-XG-TREND, B-START |
| B-XG-EX | xG release exception resolution | Release/models | Wave B dependency-closed early; 15/15 and paired PRD present | Exception-aware contract unblocked A-XG-REL while preserving production boundary |
| B-YAHOO | Yahoo ingestion/mapping audit | Yahoo/data | Pair repaired; 0/58 generated rows complete | Foundation for Draft Dashboard and bounded Draft Ranker identity evidence |
| B-DRAFT-STYLE | Game Grid/Draft style overhaul | UX | Pair repaired; 0/52 generated rows complete | After stable product paths |
| B-DRAFT-RANKER-P8 | Draft Ranker deferred mature-product capabilities | Product/auth/rankings | 0/5 Phase 8 rows complete; parent plus DR-080–083 remain explicitly deferred | Shares the A-DRAFT-RANKER pair; each capability requires its own evidence and approval gate after Wave-A launch completion |
| B-CLEAN | Code cleanup/warning reduction | Maintenance | Active at 96/140 with 44 open. Historical updater/reader/route/dependency/fixture NEW 98/99/102/103/106 are published. Writer authority NEW 104 and adjacent quarantine fixture NEW 108 are locally verified: one immutable per-season catalog owns active WGO and retained-loader ARI/53, UTA/59, and UTA/68 names/IDs with row-level proof, while the route stays 410 and its direct tests are audit-noise-free. Relocated-franchise NEW 92 follows; existing-row production repair NEW 105 and all-seasons relocation audit NEW 107 remain separate; NEW 100/101 retain catalog/SoS ownership. NEW 7/19–20/26/40–42/45/50/62–64/66/76–77/81–87/92/100–101/105/107 and broader image/hook/noise/toolchain/integrated work remain | Process NEW 92; retain NEW 105/107 as separate production/history work and continue NEW 100/101 by dependency |
| B-DEAD | Dead-code follow-through | Maintenance | Pair repaired; 0/35 generated rows complete | Requires consumer verification/approval for mass removal |
| B-DRM | Date Range Matrix refactor | Maintenance/product | Pair repaired; committed partial implementation; 84/110 rows complete after architecture/baseline, complete data-path parent 2.0–2.6, complete page/view/control parent 3.0–3.5, complete presentation/accessibility/performance parent 4.0–4.4, integrated verification 6.0–6.4, reader/card/raw remediation, base pagination/stable-hook/explicit-state/wrapper-inventory closure, NEW 31/35 physical no-DML, correction/removal, and first-adoption proof, NEW 36 supported-public-baseline compilation, NEW 40 immutable snapshot binding, NEW 42 named-conflict repair, NEW 34/43 durable terminal-state proof, NEW 44 exact ACL remediation, NEW 45 exact FK-index remediation, NEW 46 canonical CLI transaction-boundary remediation, NEW 30 deployed route-auth proof, NEW 47 frozen inventory reconciliation, NEW 48 relationship-position production closure, NEW 52 repeated-control rejection, NEW 53 strict calendar validation, NEW 54 canonical scheduled-route validation, NEW 55 exact coordinator-mode budget selection, NEW 56 canonical-group/independent partial-roster rendering, NEW 15 responsive/DatePicker closure, NEW 16 deterministic URL/season/source restoration, NEW 60 whole-game active-data partial containment, NEW 61 deterministic tie grouping, NEW 62 active styling-token alignment, NEW 63 dormant-wrapper memo stability, and the local NEW 65/67–74/76–84 exact-normalization and downstream replay-telemetry controls. The complete additive migration compiled/applied on the authorized data-less branch; four corrected functions retain eight named and zero positional conflict targets; all three writer replays, late rollback, stale pruning/version rejection, A→B→A correction/removal, current-version downstream publication, and real two-session races pass. Exact forced-RLS/browser-denial/service-role/raw-trigger/index contracts survived zero-residue cleanup; candidate-specific advisors are acceptable; the branch is deleted and confirmed absent. Exact published commits `d8e98d9570989e4840a9172980ccb3abf36fb9ce` and `4f8ba12ae7d7622299f3fccf6ec2cfbf2b63cd64` repaired the fail-closed production CLI boundary and relationship-position contract. Canonical production migrations `20260720105524` and `20260721013821` pass history/schema/security/advisor/log postconditions. One strict zero-overlap first-adoption canary completed input/relationship/derived at v1/v1/v1 with 382/38/42 verified rows, three deterministic roster fallbacks, zero invalid candidate positions or bounded-window non-candidate mutation, and exact physical no-DML replays. The exact-SHA Production target is READY across all five domains; live missing/invalid/current auth returns 401/401/405 and bounded build/runtime error evidence is empty. Exact authoritative checkpoint `58cca4e31e44981df3e3089b6ebd6f0cb1d20139` publishes NEW 27 and routes bounded/exact legacy shapes through one authenticated canonical transaction while retaining `games=all` as an explicit one-release legacy gate; NEW 33/37 have direct server/shared-queue behavioral proof. The combined local group passes 7 files/55 tests plus TypeScript and Prettier and keeps the auth inventory at 20/1/31. Exact checkpoint `3e74ac295373af6dfe8ea1c8983403b4531cac` locally remediates NEW 51 through one outer compatibility auth/audit owner plus a named caller-owned-audit relationship delegate; direct-route behavior and one-row success/failure regressions pass in a six-file/29-test group, with TypeScript, Prettier, diff integrity, and independent review green. A fail-closed local combined inventory now reconciles 64 active canonical pg_cron plus 20 Vercel jobs, proves the same-minute projection collision, and broadens NEW 50 to the coordinator plus direct jobs 308/393 using the shared 270-second default against the 240-second platform cap; closed NEW 54/55 reject dispatch-normalized route aliases and derive every coordinator budget from its exact scheduled mode before classification; exact published checkpoint `fb4e5fd778954546db174ff546dd099752cf9324` closes NEW 56 with fresh local/tracking/live equality and makes the unified hook the sole immutable group owner and renders independently capped forward/defense scopes, with focused 4-file/36-test and full 8-file/114-test DRM groups plus TypeScript, Prettier, Sass, dual-timezone page tests, lint, diff integrity, and independent review green. NEW 14/57–59 close native selector/grid accessibility, copy-before-sort purity, strict ATOI meaning, and logical roving focus across reorder; integrated 4-file/23-test and full 11-file/124-test DRM groups plus TypeScript, Prettier, Sass, dual-timezone page tests, zero-error scoped lint with five pre-existing warnings, diff integrity, and independent review pass; NEW 15 closes portal-safe calendar styling, explicit responsive controls/cards, readable matrix-local overflow, and visible keyboard focus through real Chromium at 1440/1008/1007/768/390/320 px with zero body overflow and the same 11-file/124-test/type/style/lint/integrity gates; NEW 16 closes deterministic query hydration, exact historical-season/raw-source constraints, strict canonicalization, and production-mode browser restoration through the 14-file/146-test, TypeScript, production-build, HTTP-200, and zero-console-error gates. Final production-mode Chromium covers regular/playoff, aggregate/raw, all layouts/selectors/states, portal/focus, logical grid navigation, six responsive widths, truthful partial containment, and zero browser warnings/errors | P0 NEW 22/64, P1 NEW 20/23–29/32–33/38–39/49–50/66/75, and P2 NEW 13/37/41/51 remain open for credential disposition, canonical cross-provider scheduling/order and runtime/audit ownership, stable backlog recovery, exact scope/history repair, truthful deployed/natural audit evidence, and UX/integration work; NEW 64/66/75 are locally remediated but remain temporary-branch executable gates |
| B-SKO-BURN | SKO pipeline burn-down | Models/maintenance | Explicitly merged into repaired B-SKO pair; 0/53 shared rows complete | Shares B-SKO execution and evidence |
| B-TRENDS | Trends scope recovery | Analytics | Empty PRD recovered and task list generated; 0/50 rows complete | Cross-cutting dependency for combo/audit |

Historical scheduler/generated-state publication evidence: exact checkpoint `36b3c38bf1db495b411b64fdf5dc8545ca9b434a` publishes the fail-closed 84-job cross-provider scheduler inventory, shared runtime-budget evidence, NEW 54/55 validation, B-CRON-NST NEW 61 discovery, and B-CLEAN NEW 13–17 forward generated-state containment. A normal push and fresh fetch proved local/tracking/live `octoberBranch` equality with zero divergence; no provider owner, schedule, deployment, database, or credential changed. Later bounded checkpoints supersede that recency; exact historical-team checkpoint `54752940f4bcb3ea96f468f13fda7c485a8692ec` is the latest published B-CLEAN implementation, with the same guarded normal-push equality proof.

Latest B-DRM local closure: NEW 16 restores and sanitizes complete query state through an exact historical-season API and selected-season reader constraints. Production-mode Chromium proves historical raw/custom and current/default URLs with zero console/runtime errors; 14 files/146 tests, full TypeScript, production build/static generation, and live HTTP 200 pass. Publication remains guarded by the current exact-scope checkpoint; no external system changed.

Latest B-DRM group-2 closure: base 2.0/2.1/2.4/2.5 and NEW 61 are evidence-closed. Raw and aggregate readers preserve one strict selected-scope/identity contract, feed one pure shared grouping helper, and use canonical score/ID tie-breaks that are input-order invariant. Full-group thresholds, line/pair caps, multi-position forwards, goalie/unknown exclusion, incomplete groups, and caller immutability pass focused regressions. A production-mode aggregate-to-raw switch preserved the exact Edmonton 2024–25 playoff/custom/date/total-TOI URL and ended in the same honest empty state with zero console/runtime errors; raw QA intentionally omits aggregate-only cards and source-specific coverage differences remain explicit.

Latest B-DRM group-2 publication: exact checkpoint `ef24b24e5d98ebe3bcad9c49ec6ea1e3fbc4592e` is published on `octoberBranch` through a normal non-force push. Fresh local/tracking/live equality and zero divergence pass; the eight-path scope contains only the reviewed deterministic grouping, same-scope QA regression, and synchronized canonical controls.

Latest B-DRM group-4 closure: base 4.0–4.4 and NEW 62–63 are evidence-closed through the existing responsive/accessibility/browser/request-ownership proof, a narrow shared-token correction for active selector/tooltip/position-badge styles, and exact dormant-wrapper memo dependencies. Three target Sass modules compile under bundled Node 24; complete DRM tests pass 10 files/135 tests; full TypeScript and Prettier pass; isolated lint has zero findings; stable rerender/mode/source/filter evidence proves bounded fetches and no demonstrated real-roster bottleneck justifies virtualization.

Latest B-DRM group-4 publication: exact checkpoint `d45240f398152d5dbd7f399669e2fea41e2bea25` is published on `octoberBranch` through a normal non-force push. Fresh local/tracking/live equality and zero divergence pass; its ten-path scope contains only the reviewed presentation/performance corrections and synchronized canonical controls.

Latest B-DRM integrated-verification reconciliation: base 6.0–6.4 is evidence-closed by complete 10-file/135-test DRM coverage, full TypeScript, changed-code formatting, zero-finding isolated lint, three-module bundled-Node-24 Sass, the successful 83-page production build/static generation, synchronized controls, publication receipts, and one final production-mode Chromium sweep. Representative regular/playoff, aggregate/raw, three-layout, both-selector, Custom/date/error/empty/loading/partial, portal/focus, logical-grid, and six-width responsive states pass with matrix-local sticky overflow and zero browser warnings/errors; the two reported TOI invariant scopes now remain usable with truthful partial notices. 5.2/NEW 13 still requires explicit wrapper-retirement approval.

#### Wave C — completed claims requiring audit

| ID | Initiative group | Included claimed-complete initiatives |
|---|---|---|
| C-OPS | Platform/operations | Cron schedule optimization; failed-job remediation; NST API migration; Lines/CCC ingestion |
| C-RANK | Rankings/analytics | Contextual Hockey Rankings; ecosystem alignment; post-alignment gap audit; rolling metrics audits/blueprints/remediation/pass-two |
| C-US | Underlying/site | Player/team/goalie underlying stats; standalone landing/power-ranking roadmaps; mobile optimization; WiGO charts |
| C-FORGE | FORGE | Goalie nested work; run modularization; dashboard refresh; component-health audit; ecosystem pass three; prediction-engine super list |
| C-XG | xG | NHL API foundation; baseline option/follow-up contracts |
| C-VAR | Variance | Skater leaderboard; variance section/goalies; second pass |
| C-DYNAMIC | Newly completed work | Every Wave-A and Wave-B initiative after its latest implementation |

### FR-16 — Dependency graphs and initial ordering

Wave A begins with shared foundations and release/correctness signals, then dependent product surfaces:

`A-AUTH → auth-dependent surfaces`; `A-AUTH + canonical NHL/Yahoo identity contracts → A-DRAFT-RANKER`; within the ranker, the owner-approved path `staff + homepage-only waiver → low-traffic final review → personal-ranker authenticated stage` completed on 2026-07-17, while beta entitlement, discovery, contribution collection, public Community Ranking, and `B-DRAFT-RANKER-P8` remain separately gated. `A-GDL/A-CRON-EMAIL → ingestion/operations`; within cron operations, `A-CRON-EMAIL P0 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6`, with all literal-bearing jobs held quiesced after 10.4 and restored only per verified Vault-backed batch in 10.5. The breaking season/WGO authorization boundary precedes the combined B-CRON-NST `NEW 29.0`/`31.0`/`32.0` transactional-status-cardinality decision. The authorized schema-only production clone first unblocked isolated runtime/rollback/ACL/cardinality validation; later `NEW 36.0` reconciliation archived both historical chains, established the supported baseline-plus-deltas bootstrap, proved replacement-branch parity, repaired production migration tracking, and published the exact deployment. This evidence-driven reorder kept migration-history repair independent until its own gates passed. `A-XG-REL → A-XG-TREND → A-PRED`; `A-FORGE-V1 → A-FORGE-CC/A-FORGE-DASH/A-FORGE-P4/A-FORGE-LIVE`; `A-3P → A-SUST → A-US-SOS → A-SITE/A-STYLE`; `B-YAHOO mapping evidence may be audited narrowly to unblock A-DRAFT/A-DRAFT-DEBUG/A-DRAFT-RANKER`.

Owner-approved temporary reorder (2026-07-18): A-GDL NEW 18 remains an open P0 external-provider dependency with bounded checks only at meaningful initiative checkpoints. Its held applet/event/email/data descendants do not block non-overlapping work. The previously omitted A-DRAFT-RANKER initiative was reconciled before queued local A-AUTH documentation work because the mandatory wave order prioritizes active/in-progress initiatives. A meaningful mailbox/remote checkpoint then exposed authoritative PR #352; the exact rollout evidence closes Wave-A Phase 7 and reclassifies only the five already-deferred Phase 8 rows to `B-DRAFT-RANKER-P8`. After the next safe-work audit found no locally closable A-AUTH/Cron row without an external or breaking-contract boundary, B-DRM moved ahead of not-started Wave-B scopes because its target tree contains committed partial implementation rather than merely planned work. Its refined internal graph is completed reader correctness → authoritative immutable snapshot identity and exact normalized scope (`NEW 25/27/29/40`) → canonical locked relationship replacement plus active scheduling (`NEW 20/26/38`) → atomic player/team/goalie derived replacement (`NEW 23/28`) → stable cross-day durable backlog (`NEW 24/39`) → supported-baseline compilation and named-conflict runtime proof (`NEW 36/42`) → temporary-branch rollback/concurrency/security/audit proof → bounded repair and production canary → natural cron evidence → legacy-owner retirement → duplicate-wrapper/UX/integrated verification. The refinement was required by the newly proven active legacy PBP collision, upsert-only relationship correction gap, stale-goalie scope, additive normalized-source behavior, absent canonical relationship schedule, explicit-argument durable-cursor bypass, date-bound retry identity, caller-asserted source hashes, false-success early audits, and runtime `RETURNS TABLE` conflict-target ambiguity; it prevents any status or cursor from claiming completion before all writers share the same authoritative per-game source version, lock, order, and durable retry identity. A-AUTH's remaining production/provider evidence, A-CRON/B-CRON's production or breaking-contract gates, and A-3P's missing external odds key remain explicit higher-order dependencies.

Reorder update (2026-07-21): A-GDL NEW 22 is complete after support found the account and escalated historical-key retirement to engineering; the owner clarified value-free that the request is precautionary with no known leak. NEW 18 remains at the meaningful-checkpoint bookmark until engineering responds and direct retired-key rejection/current-key authorization pass, while B-DRM resumes without touching held applet/event/email/data paths.

B-DRM dependency update (2026-07-21): NEW 30/31/35/36/40/42/44–48 and the temporary-branch rollback/concurrency/security/audit gate are complete. The disposable branch was cleaned and deleted. The first exact production CLI push failed closed before target/history mutation; exact published commit `d8e98d9570989e4840a9172980ccb3abf36fb9ce` added the full-file transaction, and the canonical migration now passes every production history/schema/head/security/advisor/log postcondition. Exact commit `4f8ba12ae7d7622299f3fccf6ec2cfbf2b63cd64` and production migration `20260721013821` close NEW 48 through a strict unique-date first-adoption input → relationship → derived canary and exact no-DML replays: 382/38/42 rows verify, three deterministic roster fallbacks retain complete position metadata, all manifests finish at v1, legacy-invalid history and every non-candidate scope remained unchanged in the bounded canary window; the immediate gate found zero writer/lock overlap and target runtime logs/clusters were empty in that bounded verification window. The same disposable-branch correction/removal, forced-rollback, and current-version continuity proof plus the legacy-strength production first-adoption canary close NEW 35 without claiming broader historical repair. The exact-SHA Production target is READY without alias error, all five project domains resolve it, and the live auth boundary returns 401/401/405. Remaining execution resumes at NEW 20/22–29/32–33/37–39/41/49–51, with NEW 49/50 gating coordinated schedule ownership/runtime, NEW 51 gating single-row audit ownership, NEW 29 retaining broader history/xG/TOI compatibility and B-CRON-NST NEW 60 separately owning the authoritative `analytics` baseline.

B-DRM NEW 29 local update (2026-07-21): the authoritative deployed Gamecenter normalization path remains additive, so root NEW 29 stays open. The local Option-A checkpoint adds one service-only transactional exact-normalization manifest/RPC: four immutable raw writes precede latest-head/CAS resolution; roster/PBP/shift scopes are deterministically replaced; source/scope fingerprints, versions, exact counts, and physical scope verification gate no-DML replay; direct normalized writes stale manifests and fail fast under shared serialization; and backfill accepts only current-parser complete manifests with positive usable coverage. Deterministic date/ID pagination, single canonical numeric/date controls, validation before season/database/source work, and separate verified-versus-written telemetry close NEW 82/83; NEW 84 extends the same physical-write contract to shared player/goalie/team catch-up and backfill telemetry, where idempotent replay reports zero `rawRowsUpserted`, only non-idempotent normalized rows count as writes, and `rawEndpointsStored` remains verification. Focused migration/client/route verification passes 4 files/43 tests, downstream underlying-stats/team-unit-TOI/xG compatibility passes 4 files/35 tests, and NEW 84's shared-helper, batch-helper, direct-route, and route-regression group passes 6 files/32 tests including fail-closed missing-proof and exact-replay cases. TypeScript, syntax, formatting, diff integrity, declaration diagnostics, and independent reviews pass. NEW 65/67–74/76–84 close locally. NEW 64/66/75 await temporary-branch compilation and two-session races; generated live types, bounded history/correction repair, live downstream proof, migration/deployment, writer/schedule integration, and production evidence remain separately approval-gated. No external state changed.

B-DRM control update (2026-07-21): a focused 9-file/115-test reader/view rerun closes base rows 2.2, 2.3, 2.6, and 5.1 without closing their parents or the wrapper-disposition decision. The post-canary schedule audit corrects stale NEW 38/39 descriptions and adds NEW 49 P1 cross-provider ownership, NEW 50 P1 coordinator-runtime cap, and NEW 51 P2 duplicate-audit ownership. The dependency graph is now immutable/exact inputs (`NEW 25/27/29/40`) → locked relationship replacement (`NEW 20/26`) → one scheduler owner with platform-safe runtime (`NEW 38/49/50`) → atomic derived publication (`NEW 23/28`) → durable backlog (`NEW 24/39`) → one truthful audit owner (`NEW 41/51`) → bounded repair/canary → natural evidence → retirement. No production schedule changed during this reconciliation.

B-DRM publication update (2026-07-21): exact authoritative checkpoint `58cca4e31e44981df3e3089b6ebd6f0cb1d20139` publishes the non-breaking first NEW 27 slice: the active scheduled/bounded/exact shapes now share the canonical input lock/hash/RPC behind one auth and audit owner, while `games=all` stays explicit authenticated legacy scope pending caller/backfill/retirement approval and production proof. NEW 33/37 now have direct latest-started-season and shared older-algorithm queue tests. NEW 52/53 close repeated-control ambiguity and invalid calendar ranges before writer/source work. The 7-file/55-test group, full TypeScript, Prettier, and diff integrity pass; the auth inventory is 20 admin-or-cron / 1 exact-cron-only / 31 unprotected. Job 104 remains active and its 100-second caller timeout versus the canonical 270-second default is an explicit temporary-deactivation/timing gate; deployments, databases, schedules, credentials, providers, and aliases remain unchanged.

B-DRM NEW 51 local update (2026-07-21): exact local checkpoint `3e74ac295373af6dfe8efea1c8983403b4531cac` keeps `update-shifts` as the sole outer auth/audit owner for job-16 compatibility calls and invokes an explicit caller-owned-audit relationship delegate; the direct `shift-charts` export retains its existing `adminOnly` plus manual-audit contract. Direct, compatibility-success, and compatibility-failure regressions prove one truthful insert per invocation; the six-file/29-test group, full TypeScript, Prettier, diff integrity, and independent no-blocker review pass. NEW 51 remains unchecked until exact deployment and bounded/natural one-call/one-row evidence are recorded downstream of NEW 49/50. No production or provider state changed.

B-CLEAN semantic-accessibility update (2026-07-22): dependency ordering moved the single five-warning correctness cluster ahead of hook/image work. Base 1.0–2.3 and 6.1/6.4 plus NEW 18/24/27–39 are verified at 44/71 after final review registered and closed four additional defects before publication: all three day-toggle views use stable included-state names, visual arrows agree with `aria-sort`, and both shared controls reject repeated Enter/Space after preventing default. Native table/header semantics, one labeled action per sort, edge/forced-colors focus, render-safe parent updates, two focused files/six tests, strict changed-scope 0/0 lint, full TypeScript, Sass, formatting/diff integrity, independent no-finding re-review, and the clean browser layout/focus sequence pass. NEW 44's fresh exact reruns supersede the stale undifferentiated count: the baseline-compatible directory invocation is 1,499 files/0 errors/127 warnings (64 hooks, 59 raw images, four anonymous defaults, zero ARIA), and the extension-complete JS/JSX/TS/TSX core is 1,500/0/129 (64 hooks, 61 raw images, four anonymous defaults, zero ARIA). The exact delta is the sole `.jsx` file and its two image warnings. Only the stable five-to-zero ARIA result is compared to the 1,497-file directory-form pre-change snapshot. NEW 7/19–23/25–26 remain open; NEW 20 remains strategy-held.

B-CLEAN stale-suppression and image-contract update (2026-07-22): NEW 21 closes the original four-item representative cohort; NEW 43/44 correct publication/count evidence; and the expanded suppression/config/formatting findings remain NEW 40–42. Base 4.1 and NEW 22/23 then close the bounded wrapper/stats-logo defect through explicit dimensions-or-fill typing/runtime validation, keyed one-attempt fallback, caller-safe error composition, alt preservation, and the tracked FHFH fallback in both stats paths. The five-file/20-test group, full TypeScript, zero-finding scoped lint, targeted formatting/diff integrity, React review, and independent no-blocker review pass. An 8 GiB build passes type validation and optimized compilation before isolated `/lines` prerender fails only for absent Supabase bindings; no secret is copied. Exact checkpoint `d5cc06cf57c26ac59f5ff9b5db1de8bf1e67f313` is normally published with fresh local/tracking/live equality. NEW 25/45 retain TeamLeaders/residual-logo scope, and B-CLEAN is 50/77 with 27 rows open.

B-CLEAN migrated-logo/TeamLeaders discovery update (2026-07-22): exact code, network, responsive-browser, and independent audits register NEW 46–50 before remediation. NEW 46 is the sole new P1 because normal-game metadata is dereferenced before the incomplete-game guard. NEW 47/48 retain playoff aspect-ratio/optimizer/sentinel work plus missing real-wrapper and deterministic browser evidence. NEW 49 retains the duplicate unused TeamDashboard leaders query, and NEW 50 keeps three residual StatsPage headshot callers outside TeamLeaders NEW 25. The order is NEW 46 → base 4.2/NEW 47/48 → NEW 25/49, while NEW 45/50 remain separate residual cohorts. B-CLEAN becomes 50/82 with 32 open; no code or external state changed during registration.

B-CLEAN TeamLeaders lifecycle update (2026-07-22): focused source/test review registers P2 NEW 51 for unresolved-input infinite loading, P2 NEW 52 for stale async result ownership, and P3 NEW 53 for the intentionally nonfatal image-query path's missing bounded diagnostic. The refined order is NEW 46 → base 4.2/NEW 47/48 → NEW 25/49/51–53, while NEW 45/50 remain separate residual cohorts. B-CLEAN becomes 50/85 with 35 open before remediation; no external state changed.

B-CLEAN migrated-logo/TeamLeaders closure update (2026-07-22): final review registered P2 NEW 54 for oversized native-width playoff optimizer candidates and P2 NEW 55 for the distinct parent-dashboard unresolved-season spinner. NEW 54 closed in that slice through explicit 420px-responsive/120px-capped `sizes` and public `getImageProps` evidence for smaller 640px/128px candidates; NEW 55 remained open at that checkpoint because `useCurrentSeason` did not yet distinguish loading from terminal absence. Base 4.2 and NEW 25/46–49/51–54 closed at the then-current 60/87 state. The final four-file/19-test group, full TypeScript, scoped lint, Prettier, Sass, diff integrity, responsive/network/browser proof, and independent no-other-finding review passed. Exact 17-path checkpoint `a1948f78baa16797a29ae98bf0c7796782efc2db` published the implementation and controls through a guarded normal push with fresh local/tracking/live equality; no external state changed. The following update supersedes only its current-status count.

B-CLEAN TeamDashboard season/request closure update (2026-07-22): NEW 55/56 close locally after `useCurrentSeasonQuery()` exposes React Query v5 pending/success/error state while the default data-only hook remains compatible for existing callers. TeamDashboard now keeps ordinary season resolution pending, terminates successful absence, terminal error, and missing team inputs with stable no-query states, lets an explicit season bypass unrelated lookup pending/failure, and rejects stale/unmounted continuation at all eleven awaited operations plus every catch/finalization boundary. Two focused files/13 tests, full TypeScript, zero-error scoped lint with the identical pre-existing exhaustive-deps warning, Prettier, diff integrity, and independent no-finding review pass. B-CLEAN is 62/99 with 37 open; NEW 57–67 remain explicit and ordered rather than folded into this closure.

B-CLEAN TeamDashboard terminal/display discovery update (2026-07-22): NEW 57/58 follow-through registers P2 NEW 68/69 before implementation because completed null/contained-failure goalie and ranking slices still render indefinite card-local loading copy after the page-level loader has ended. The independent review also registers P2 NEW 70 for false `Exhibition` regular-season copy, P3 NEW 71 for 11/12/13 ordinal suffixes, and P2 NEW 72 for non-finite zero-game GF/GP and GA/GP. The rows remain distinct so terminal, label, formatter, and denominator evidence are independently auditable. B-CLEAN is 62/104 with 42 open before remediation.

B-CLEAN TeamDashboard final date/result discovery update (2026-07-22): final independent review registers P2 NEW 73–75 before closure because future selected seasons can reverse the goalie date interval, independent empty schedule/nonempty goalie feeds can produce infinite workload, and a missing standings-detail row can fabricate three `0th` positions from otherwise valid summary data. B-CLEAN is 62/107 with 45 open before remediation; the three bounded findings join NEW 57/58/68–72 in the active parent slice.

B-CLEAN TeamDashboard data-identity closure update (2026-07-22): NEW 57/58/68–75 close and publish at exact checkpoint `47d90df8491fa9ac948a123498d4f475cfa2cf9b` through season-matched primitive dates and identity-inclusive render gating, deterministic complete slice reset, regular/playoff/historical/future goalie and NST boundaries, terminal empty copy, truthful mode/ordinal/rate output, finite lagging-schedule workload, and unavailable missing-detail positions. One focused file passes 14/14; full TypeScript, zero-error scoped lint with the same one pre-existing warning, Prettier, diff integrity, source/master/global parity, and independent no-finding review pass. Guarded normal-push equality passes; B-CLEAN is 72/107 with 35 open.

B-CLEAN parent-page standings discovery update (2026-07-22): NEW 76/77 are registered before remediation. TeamStatsPage independently converts absent positions to zero and uses last-digit ordinal suffixes, while its standings effect has neither latest-request ownership nor deterministic request-start/successful-empty clearing. These remain page-owned follow-ups rather than being hidden inside TeamDashboard NEW 59/67. B-CLEAN is 72/109 with 37 open; the global imported ledger is 4,187/4,801 with 614 open = 87.21% complete / 12.79% open.

B-CLEAN current-evidence contradiction discovery update (2026-07-22): control parity registers P3 NEW 78 before correction because one final-summary paragraph still calls published NEW 55 pending while every source/master status row records it closed. The row owns a bounded current-summary correction without reopening runtime work or rewriting historical checkpoints. B-CLEAN is 72/110 with 38 open; the global imported ledger is 4,187/4,802 with 615 open = 87.19% complete / 12.81% open.

B-CLEAN TeamDashboard identifier/dead-state closure update (2026-07-22): NEW 59/67/78 close locally. Three unrendered fabricated goalie-rank fields are removed completely; one strict pre-query boundary accepts only canonical positive safe-integer team IDs, exact own-key abbreviations with matching canonical IDs, and eight-digit consecutive-year seasons. Nine rejected-input variants make zero Supabase/NHL calls, the valid historical case proves exact numeric filters, and the final summary now describes published NEW 55 truthfully. One focused file passes 23/23; full TypeScript, zero-error/zero-warning scoped lint, Prettier, exact source searches, diff integrity, parity, and independent no-finding review pass. B-CLEAN is 75/110 with 35 open; the global imported ledger is 4,190/4,802 with 612 open = 87.26% complete / 12.74% open.

B-CLEAN TeamDashboard identifier/dead-state publication receipt (2026-07-22): exact eight-path checkpoint `3970fa3b63f7cdda6a543e4440a3fad03d7e6ee6` publishes NEW 59/67/78. Fresh parent equality, exact staging, generated/cache/binary/size/value-free gates, one-ahead/zero-behind proof, a normal non-force push, and post-push local/tracking/live equality all pass with zero divergence and a clean isolated checkout.

B-CLEAN shared schedule-hook identity discovery update (2026-07-22): NEW 79 is registered before remediation because truthy malformed team/season strings can become NaN/zero filters and a known but mismatched abbreviation/ID pair can query another team's schedule. This is distinct from NEW 60 pending/terminal state, NEW 61 `[object Object]` fallback corruption, and NEW 65 stale/unmounted/empty replacement ownership. B-CLEAN is 75/111 with 36 open; the global imported ledger is 4,190/4,803 with 613 open = 87.24% complete / 12.76% open.

B-CLEAN schedule-caller adjacency discovery update (2026-07-22): NEW 80–87 are registered before remediation. They preserve selected-date/current-season Forge drift, P1 calendar auxiliary stale/cross-team state, duplicate calendar source ownership, inherited-key SSR routing, split page-season identity, raw public errors/duplicate diagnostics, select-star overfetch, and optional-enrichment readiness as distinct work. The active patch remains only NEW 60/61/65/79. B-CLEAN is 75/119 with 44 open; the global imported ledger is 4,190/4,811 with 621 open = 87.09% complete / 12.91% open.

B-CLEAN schedule-hook independent-review update (2026-07-22): NEW 88 is registered before correction because TanStack Query may retain valid cached current-season data while a background refetch reports error, and the first local resolution order discarded that usable primitive. It is dependency-coherent with NEW 60/61/65/79 rather than part of later public-error semantics. B-CLEAN is 75/120 with 45 open; the global ledger is 4,190/4,812 with 622 open = 87.07% complete / 12.93% open.

B-CLEAN schedule-hook publication receipt (2026-07-22): exact eight-path checkpoint `c80f4b193209512a6318f009faceeebd9866215e` publishes NEW 60/61/65/79/88. The hook makes team-invalid state terminal before season waiting, separates genuine no-data pending/error from valid explicit/cached seasons, uses exact numeric season/team filters, prevents all stale/unmounted continuation across three awaits, and masks/replaces prior games/record/error deterministically. The valid-cached-season/background-error case remains usable. Two files/35 tests, full TypeScript, zero-error/zero-warning scoped lint, Prettier, diff integrity, exact staged/value-free scope, and independent review pass; the guarded normal push ends at exact local/tracking/live equality and zero divergence. B-CLEAN is 80/120 with 40 open; global parity is 4,195/4,812 with 617 open = 87.18% complete / 12.82% open.

B-CLEAN Forge selected-date audit update (2026-07-22): NEW 89–93 are registered before remediation. Persisted `seasons.startDate` / latest-started semantics must precede NEW 80; arithmetic July/September/October heuristics conflict across the repository and are not authoritative for Forge. Invalid calendar routes, historical WGO record-as-of state, relocated-franchise identity, and the stale source-PRD next action remain distinct. B-CLEAN is 80/125 with 45 open; global parity is 4,195/4,817 with 622 open = 87.09% complete / 12.91% open.

B-CLEAN current-control correction update (2026-07-22): NEW 93 closes locally. The source PRD now points to dependency-eligible persisted-season NEW 90 → selected-date NEW 80 and no longer directs execution to already-published TeamDashboard/schedule-hook work. Historical checkpoint evidence is untouched; NEW 89/91/92 remain open. B-CLEAN is 81/125 with 44 open; global parity is 4,196/4,817 with 621 open = 87.11% complete / 12.89% open.

B-CLEAN selected-date observability registration (2026-07-22): independent review found no correctness/security blocker and registered P3 NEW 94 before correction because both detail-page server-props failure branches fail closed without a bounded internal diagnostic. Public copy remains stable and provider detail remains hidden. B-CLEAN is 81/126 with 45 open; global parity is 4,196/4,818 with 622 open = 87.09% complete / 12.91% open.

B-CLEAN remaining shared-authority registration (2026-07-22): a cron-facing `run-projection-v2` route still repeats the exact latest-started season query and owns a duplicate row type despite delegating to the canonical runner. NEW 95 records that same NEW 90 root before correction and does not inflate the distinct P2 severity rollup. B-CLEAN is 81/127 with 46 open; global parity is 4,196/4,819 with 623 open = 87.07% complete / 12.93% open.

B-CLEAN route-test noise registration (2026-07-22): the first combined 7-file/123-test run is green but the projection-route fixture omits the cron-audit insert branch and prints a false `insert is not a function` audit diagnostic. P3 NEW 96 records this test-only defect before correction. B-CLEAN is 81/128 with 47 open; global parity is 4,196/4,820 with 624 open = 87.05% complete / 12.95% open; P3 becomes 17/14.

B-CLEAN persisted-season/selected-date closure update (2026-07-22): NEW 80/90/94–96 close locally. One client-injectable `seasons.startDate` authority resolves the exact selected date at end-of-day UTC for the player API, canonical projection runner, cron-facing route, and both detail-page server-props boundaries. Both pages pass explicit season identity to `useTeamSchedule`; no-row/error state uses a non-current sentinel, stable unavailable UI, and one fixed value-free warning. Former private resolvers and duplicate row types are absent, and the route fixture owns a truthful audit insert. Seven files/123 tests, full TypeScript, Prettier, diff/duplicate/caller integrity, scoped lint with zero errors and one pre-existing NEW-26 warning, and independent review pass. B-CLEAN is 86/128 with 42 open; global parity is 4,201/4,820 with 619 open = 87.16% complete / 12.84% open. P2 is 129/103 and P3 is 17/16; NEW 89/91/92 remain open.

B-CLEAN persisted-season/selected-date publication receipt (2026-07-22): exact 17-path checkpoint `f30cdea5226f10b6097ff5531ce71b03d79af5c9` publishes NEW 80/90/94–96 through a guarded normal push. Exact parent, scope, generated/cache/binary/size/value-free, test/type/lint/format/integrity, parity, one-ahead/zero-behind, and post-push local/tracking/live equality gates all pass; no external system changed.

B-CLEAN shared real-date closure update (2026-07-22): NEW 89 closes locally. One exported UTC round-trip predicate now gates requested dates, resolved dates, and generated links across all six active Forge route surfaces. The direct suite passes 16/16 and the complete eight-file consumer group passes 64/64 for canonical dates, leap/non-leap and impossible values, array-first/fallback semantics, invalid-link omission, and existing page behavior. Full TypeScript, scoped zero-finding lint, Prettier, diff/caller integrity, exact caller search, and independent no-blocker review pass.

B-CLEAN shared real-date publication update (2026-07-22): exact eight-path checkpoint `e34e8a46cd3a1f842b622f6d3b33c4e0782169ac` publishes NEW 89 through a guarded normal non-force push. Fresh-parent, exact text-only scope, generated/cache/binary/size/value-free, integrity, one-ahead/zero-behind, and post-push equality gates pass; local HEAD, tracking ref, and live fetched tip agree with zero divergence and the isolated checkout is clean.

B-CLEAN Forge record/team-source discovery update (2026-07-22): four separate findings are registered before remediation. P1 NEW 97 records that `useTeamSchedule` labels one-game WGO rows as cumulative season records even though all 38,484 bounded production rows have `games_played=1`; bounded `nhl_standings_details` as-of coverage exists for 2024–25/2025–26 and earlier unsupported dates must remain null. P1 NEW 98 records historical `update-teams` reconciliation against today's schedule and destructive legacy-membership deletion. P2 NEW 99 records `getTeams(seasonId)` canonicalization/current-team padding that erases historical membership. P3 NEW 100 records a stale secondary TeamLandingPage ARI/53 plus UTA/59 Utah Hockey Club catalog consumed by `statsPlaceholder`, while canonical current identity is UTA/68 Mammoth. Dependency order is `NEW 89 → (NEW 91 + NEW 97)`, then `NEW 98 + NEW 99 → NEW 92`, with NEW 100 later. B-CLEAN is 87/132 with 45 open; global parity is 4,202/4,824 with 622 open = 87.11% complete / 12.89% open. Severity is P0 15/10, P1 118/87, P2 130/104, and P3 18/16.

B-CLEAN historical-team follow-on discovery update (2026-07-22): P2 NEW 101 records `statsPlaceholder` reading every SoS season and independently grouping retired/current IDs; P2 NEW 102 records invalid season-route coercion toward current fallback; P3 NEW 103 records an unused current-team lookup in every schedule request; and P1 NEW 104 records active WGO/power-ranking writers mapping current franchise 40/UTA to stale ID 59/Utah Hockey Club instead of canonical ID 68/Mammoth. NEW 98/99/102/104 precede NEW 92; NEW 100/101 follow the authority correction and NEW 103 is independent. B-CLEAN is 87/136 with 49 open; global parity is 4,202/4,828 with 626 open = 87.03% complete / 12.97% open. Severity is P0 15/10, P1 119/87, P2 132/104, and P3 19/16.

B-CLEAN standings record-as-of closure update (2026-07-22): NEW 91/97 close locally. `useTeamSchedule` replaces false one-game WGO records with one exact-column `nhl_standings_details` row filtered by canonical team/season, optionally bounded to the requested date, descending, and limited to one. Both Forge detail pages pass requested route dates rather than resolved/projection dates; invalid, pre-snapshot, unsupported, optional-failure, omitted-latest, and stale-date ownership paths are explicit. Three files/53 tests, full TypeScript, scoped zero-error lint with one pre-existing NEW-26 warning, Prettier, diff integrity, and independent review pass. The active NEW 86 scope now truthfully retains only games and score select-star queries. B-CLEAN is 89/136 with 47 open; global parity is 4,204/4,828 with 624 open = 87.08% complete / 12.92% open. Severity is P0 15/10, P1 119/88, P2 132/105, and P3 19/16.

B-CLEAN standings record-as-of publication update (2026-07-22): exact 12-path checkpoint `78b7a3231af7903bc38bd14b56f15fe94974310e` publishes NEW 91/97 through a guarded normal non-force push. Fresh parent equality at `1158a27d7f383bd131d360289b12a0423d8b1f3a`, exact text-only scope, generated/cache/binary/size/value-free, integrity, one-ahead/zero-behind, and post-push equality gates pass; local HEAD, tracking ref, and live fetched tip agree with zero divergence and the isolated checkout is clean.

B-CLEAN current-Utah production-state discovery update (2026-07-22): P1 NEW 105 is registered separately from local writer correction NEW 104. Bounded public reads find 88 season-20252026 WGO rows under legacy team ID 59, all named Utah Mammoth and all with null game linkage, versus zero rows under canonical team ID 68. The uniqueness key includes team ID, so future writer correction does not reconcile these existing rows. Bounded idempotent repair/rematerialization, exact cardinality/link/duplicate/rollback proof, and separate production-mutation authorization remain required. B-CLEAN is 89/137 with 48 open; global parity is 4,204/4,829 with 625 open = 87.06% complete / 12.94% open. Severity is P0 15/10, P1 120/88, P2 132/105, and P3 19/16.

B-CLEAN rolling-pipeline fixture discovery update (2026-07-22): P3 NEW 106 is registered before correction because the independent NEW 98 combined rerun passes all 31 tests but emits eight false cron-audit insertion failures from the rolling-pipeline fixture's missing `cron_job_audit.insert()` branch. Production code is not implicated. B-CLEAN is 89/138 with 49 open; global parity is 4,204/4,830 with 626 open = 87.04% complete / 12.96% open. Severity is P0 15/10, P1 120/88, P2 132/105, and P3 20/16.

B-CLEAN all-seasons relocation discovery update (2026-07-22): P2 NEW 107 is registered separately from bounded current-Utah NEW 104. Live schedules identify 2010–11 Atlanta as ID 11 and 2013–14 Phoenix as ID 27, while the active WGO all-seasons path and existing attribution use current successors IDs 52/53 and current naming. The power-ranking loader is not active; its sole route is an intentional 410 quarantine, so NEW 104 is reconciled to active WGO plus retained-loader prevention. B-CLEAN is 89/139 with 50 open; global parity is 4,204/4,831 with 627 open = 87.02% complete / 12.98% open. Severity is P0 15/10, P1 120/88, P2 133/105, and P3 20/16.

B-CLEAN historical-team boundary local closure update (2026-07-22): NEW 98/99/102/103/106 close through exact persisted-season calendar ownership, additive historical ingestion, complete-current-catalog deletion gates, distinct exact/current reader modes, strict route parsing, explicit operational caller modes, dead schedule-query removal, and a corrected server-Supabase audit fixture. The combined 10-file/108-test group, full TypeScript, zero-error scoped lint, baseline-aware formatting, diff integrity, direct 2-file/37-test zero-stderr proof, and independent no-blocker reviews pass. B-CLEAN is 94/139 with 45 open; global parity is 4,209/4,831 with 622 open = 87.12% complete / 12.88% open. Severity is P0 15/10, P1 120/89, P2 133/107, and P3 20/18. NEW 104 is the exact next local dependency; NEW 105/107 remain separately held.

B-CLEAN historical-team publication update (2026-07-22): exact 25-path checkpoint `54752940f4bcb3ea96f468f13fda7c485a8692ec` publishes the reviewed NEW 98/99/102/103/106 implementation, tests, and synchronized controls. Fresh parent equality, exact text-only scope, generated/cache/binary/size/value-free and integrity gates, one-ahead/zero-behind proof, normal non-force push, and post-push local/tracking/live equality pass.

B-CLEAN writer-authority and quarantine-fixture local closure update (2026-07-22): NEW 104 replaces both stale writer catalogs with one strict, fresh, immutable season-aware authority. Active WGO resolves it per loop before I/O and now persists helper-owned names and IDs; executable one-date tests deliberately supply stale upstream names and prove exact ARI/53, UTA/59, and UTA/68 rows plus game/opponent linkage. The retained power loader resolves the same authority only after selecting a season and remains behind the unchanged 410 route. P3 NEW 108 records and closes the direct route test's unrelated audit side effect through the standard identity-wrapper fixture. Three files/33 tests pass with zero stderr plus full TypeScript, zero-error lint, clean-scope formatting with identical retained-loader baseline drift, syntax/diff/module/catalog integrity, and independent re-review. B-CLEAN is 96/140 with 44 open; global parity is 4,211/4,832 with 621 open = 87.15% complete / 12.85% open. Severity is P0 15/10, P1 120/90, P2 133/107, and P3 21/19. NEW 105/107 remain separately held.

Cross-provider scheduler inventory update (2026-07-21): one fail-closed local graph now reconciles 64 active canonical pg_cron jobs with 20 Vercel jobs, validates strict provider grammar plus pg_cron calendar semantics, and detects the projection-execution collision owned by B-DRM NEW 49 as well as same-domain sustainability priors/window-z collisions owned only by B-CRON-NST NEW 61. Shared runtime evidence broadens B-DRM NEW 50 to the coordinator plus direct projection jobs 308/393, all defaulting to 270 seconds against the 240-second platform cap absent an exact bounded override. Follow-up NEW 54/55 close two local P2 evidence gaps by rejecting raw-whitespace and dispatch-normalized route aliases before classification and requiring exactly one supported coordinator mode to select the shared daily, overnight, or targeted-repair runtime budget; the final four-file scheduler group passes 66 tests plus full TypeScript, Prettier, diff integrity, and independent re-review. A-SUST stays 85/89 and depends narratively on NEW 61. No schedule, lease, deployment, provider, database, or credential state changed; authoritative-owner cutover, rollback, deployed zero-overlap, ordered handoff/audits, and natural evidence remain open.

Wave B follows stable foundations:

`A-CRON-EMAIL/A-XG-REL → B-CRON-NST/B-XG-EX`; `A-SUST/B-TRENDS → B-SUST-BAR/B-SUST-AUD`; `A-US-SOS → B-GAMEGRID`; `A-FORGE-V1 + B-TRENDS + B-START → B-FORGE-COMBO`; `A-DRAFT-RANKER Phase 7 → B-DRAFT-RANKER-P8`; `B-SKO ↔ B-SKO-BURN` (merge decision from evidence); `B-YAHOO → B-DRAFT-STYLE`; active feature completion → `B-CLEAN/B-DEAD/B-DRM`.

Initial execution favors nearly complete release/foundation work when it does not bypass a higher-risk auth or data issue. Any reorder is recorded in the diary.

## 5. Non-Goals (Out of Scope)

- No speculative subsystem rewrites or architecture replacement for stylistic preference.
- No destructive production operations, mass deletion, breaking migration, provider/account change, or route removal without checkpoint approval.
- No erasure of source history or treating checked boxes as evidence.
- No proliferation of initiative-specific diaries or scratch documentation.
- No ritual test creation for trivial changes; verification effort follows risk.
- No silent scope reduction or completion claim while unapproved work remains.

## 6. Design Considerations

UI work follows `brand-style-cheat-sheet.md`, `fhfh-styles.md`, `vars_Audit.md`, established FHFH patterns, and current production behavior. Changes must preserve or improve accessibility, responsive/mobile behavior, information hierarchy, density, and communication of loading, empty, error, stale, fallback, and partial-success states. Existing mockups are inputs, not automatic authority over verified product requirements.

## 7. Technical Considerations

- The working tree was already heavily modified at initialization. Preserve unrelated changes and inspect relevant diffs before editing overlap.
- The repository includes Next.js/React/TypeScript, JavaScript API routes, Python/data jobs, Supabase/Postgres migrations, cron configuration, and external hockey/Yahoo/provider data.
- Reconcile canonical player/team/goalie identities across NHL, Yahoo, auth/Patreon, NST/GDL/CCC, and internal tables.
- Preserve model leakage boundaries and provenance for projections, xG, sustainability, trends, rankings, and predictions.
- Prefer single ownership and shared contracts over parallel ingestion or transformation implementations.
- Use current documentation/changelogs for temporally unstable Supabase behavior before implementation.

## 8. Success Metrics

Success requires: all artifacts inventoried; all initiatives paired or explicitly merged; every Wave-A/B task implemented and verified; every completed initiative audited after latest changes; all P0/P1 closed and P2/P3 completed or approved; source/master lists synchronized; required tests/checks/manual verification recorded; shared contracts reconciled; temporary debris removed; diary current; final summary complete; and working tree understood.

## 9. Open Questions

No launch question blocks bootstrap. Material conflicts, destructive changes, provider/account actions, strategy forks, or true user-owned verification become explicit `NEW` tasks and use the pause protocol. The former empty `web/rules/generate-tasks.mdc` is now an explicit compatibility pointer to the authoritative `tasks/TASKS/rules/generate-tasks.mdc`, closing the duplicate-rule drift without maintaining two copies.

## Appendix A — Artifact Inventory

This table classifies every non-canonical file discovered recursively under `tasks/TASKS/` at initialization plus later authoritative discoveries. Classification is functional and may be refined when implementation evidence is inspected. Task-list rows are separately imported in full in the canonical master task list.

| Path | Classification | Initiative mapping | Baseline note |
|---|---|---|---|
| `tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md` | supporting note/reference | A-AUTH | — |
| `tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md` | PRD | A-AUTH | — |
| `tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md` | task list | A-AUTH | 208 checkbox rows; 189 checked and 19 open after the value-free legacy-mailbox credential-retention discovery |
| `tasks/TASKS/contextual-hockey-rankings/2026-06-07-goal.md` | reference/supporting context | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/gpt-codex-suggested-prompt.md` | reference/supporting context | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md` | PRD | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/prd-rankings-ecosystem-alignment-audit.md` | PRD | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/prd-rankings-post-alignment-gap-audit.md` | PRD | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/prd-v2-pass-CHR.md` | PRD | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/research/deep-research-report.md` | research/decision support | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/tasks-prd-contextual-hockey-rankings.md` | task list | C-RANK | 467 checkbox rows |
| `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md` | task list | C-RANK | 123 checkbox rows |
| `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-post-alignment-gap-audit.md` | task list | C-RANK | 63/63 claimed complete; former untracked scope captured by `e0a433202`, with Wave-C verification still pending |
| `tasks/TASKS/contextual-hockey-rankings/workstation/Recommendations-DRR.md` | research/decision support | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/workstation/assets/current-state-fullpage.jpeg` | visual/style reference | C-RANK | binary asset |
| `tasks/TASKS/contextual-hockey-rankings/workstation/assets/target-mockup-fhfh-heatmap.jpeg` | visual/style reference | C-RANK | binary asset |
| `tasks/TASKS/contextual-hockey-rankings/workstation/assets/target-mockup-true-hockey-insights.jpeg` | visual/style reference | C-RANK | binary asset |
| `tasks/TASKS/contextual-hockey-rankings/workstation/context.md` | reference/supporting context | C-RANK | 32 checkbox rows |
| `tasks/TASKS/contextual-hockey-rankings/workstation/deep-research-report.md` | research/decision support | C-RANK | — |
| `tasks/TASKS/contextual-hockey-rankings/workstation/goal.md` | reference/supporting context | C-RANK | — |
| `tasks/TASKS/cron-operations/cron-schedule.md` | supporting note/reference | A-CRON-EMAIL / B-CRON-NST / C-OPS | — |
| `tasks/TASKS/cron-operations/prd/prd-cron-audit-and-schedule-optimization.md` | PRD | A-CRON-EMAIL / B-CRON-NST / C-OPS | — |
| `tasks/TASKS/cron-operations/prd/prd-cron-failed-jobs-remediation.md` | PRD | A-CRON-EMAIL / B-CRON-NST / C-OPS | — |
| `tasks/TASKS/cron-operations/prd/prd-cron-nst-audit-remediation.md` | PRD | A-CRON-EMAIL / B-CRON-NST / C-OPS | — |
| `tasks/TASKS/cron-operations/tasks-cron-audit-email-failures.md` | task list | A-CRON-EMAIL / B-CRON-NST / C-OPS | 62 checkbox rows |
| `tasks/TASKS/cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md` | task list | A-CRON-EMAIL / B-CRON-NST / C-OPS | 43 checkbox rows |
| `tasks/TASKS/cron-operations/tasks-prd-cron-failed-jobs-remediation.md` | task list | A-CRON-EMAIL / B-CRON-NST / C-OPS | 34 checkbox rows |
| `tasks/TASKS/cron-operations/tasks-prd-cron-nst-audit-remediation.md` | task list | A-CRON-EMAIL / B-CRON-NST / C-OPS | 66 checkbox rows; 57 checked and 9 open |
| `tasks/TASKS/cron-operations/tasks-prd-nst-api-audit-and-migration.md` | task list | A-CRON-EMAIL / B-CRON-NST / C-OPS | 46 checkbox rows |
| `tasks/TASKS/dead-code-cleanup/burn-down-plan.md` | implementation map/architecture plan | B-CLEAN / B-DEAD / B-DRM / B-SKO-BURN | — |
| `tasks/TASKS/dead-code-cleanup/prd-cleanup-tasks.md` | PRD | B-CLEAN / B-DEAD / B-DRM / B-SKO-BURN | — |
| `tasks/TASKS/dead-code-cleanup/prd-dead-code-report.md` | PRD | B-CLEAN / B-DEAD / B-DRM / B-SKO-BURN | — |
| `tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md` | PRD | B-CLEAN / B-DEAD / B-DRM / B-SKO-BURN | — |
| `tasks/TASKS/dead-code-cleanup/prd-file-inventory.md` | PRD | B-CLEAN / B-DEAD / B-DRM / B-SKO-BURN | — |
| `tasks/TASKS/draft-dashboard-yahoo/docs/DraftDashboard_Audit.md` | audit/remediation supporting record | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-dashboard-yahoo/docs/yahoo-tables.md` | schema/data contract | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-dashboard-yahoo/draft-dashbord-audit.md` | audit/remediation supporting record | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-dashboard-yahoo/prd-yahoo-audit.md` | PRD | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dash-debug.md` | PRD | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | 14 checkbox rows |
| `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dashboard.md` | PRD | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-dashboard-yahoo/prd/prd-gamegrid-draft-dashboard-style-overhaul.md` | PRD | A-DRAFT / A-DRAFT-DEBUG / B-YAHOO / B-DRAFT-STYLE | — |
| `tasks/TASKS/draft-ranker/community-ranking-runbook.md` | runbook | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/decision-record.md` | research/decision support | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/discovery-source-contract.md` | schema/data contract | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/dr-010-migration-review.md` | audit/remediation supporting record | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/dr-011-yahoo-mapping-review.md` | audit/remediation supporting record | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/dr-012-migration-review.md` | audit/remediation supporting record | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/execution-boundary.md` | execution/governance record | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/goal-prompt.md` | reference/supporting context | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/implementation-plan.md` | implementation map/architecture plan | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/launch-runbook.md` | runbook | A-DRAFT-RANKER / B-DRAFT-RANKER-P8 | 10/10 checked prerequisites; authenticated personal rollout and retained secondary/Phase-8 gates recorded |
| `tasks/TASKS/draft-ranker/prd-draft-ranker.md` | PRD | A-DRAFT-RANKER | canonical missing pair repaired 2026-07-18 |
| `tasks/TASKS/draft-ranker/product-strategy.md` | product strategy/reference | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/progress.md` | progress/status evidence | A-DRAFT-RANKER / B-DRAFT-RANKER-P8 | Phase 7 complete; Phase 8 deferred |
| `tasks/TASKS/draft-ranker/release-manifest.md` | release/evidence manifest | A-DRAFT-RANKER | — |
| `tasks/TASKS/draft-ranker/repository-audit.md` | audit/remediation supporting record | A-DRAFT-RANKER | canonical repository audit |
| `tasks/TASKS/draft-ranker/repository-record.md` | reference/supporting context | A-DRAFT-RANKER | historical noncanonical duplicate |
| `tasks/TASKS/draft-ranker/tasks-prd-draft-ranker.md` | task list | A-DRAFT-RANKER / B-DRAFT-RANKER-P8 | 55 rows; 50 checked and five deferred Phase 8 rows open |
| `tasks/TASKS/draft-ranker/technical-contract.md` | schema/data contract | A-DRAFT-RANKER | — |
| `tasks/TASKS/forge-projections/command-center/prd-forge-command-center-rebuild.md` | PRD | A-FORGE-CC | — |
| `tasks/TASKS/forge-projections/command-center/tasks-prd-forge-command-center-rebuild.md` | task list | A-FORGE-CC | 80 checkbox rows; Wave A complete under approved one-release coexistence |
| `tasks/TASKS/forge-projections/context/forge-tables.md` | schema/data contract | A-FORGE-V1 / C-FORGE | — |
| `tasks/TASKS/forge-projections/context/projection-model-research.md` | research/decision support | A-FORGE-V1 / C-FORGE | — |
| `tasks/TASKS/forge-projections/context/projectionTableStructure.md` | schema/data contract | A-FORGE-V1 / C-FORGE | — |
| `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard-component-health.md` | PRD | A-FORGE-DASH / C-FORGE | — |
| `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard.md` | PRD | A-FORGE-DASH / C-FORGE | — |
| `tasks/TASKS/forge-projections/dashboard-health/tasks-forge-dashboard-component-remediation.md` | task list | A-FORGE-DASH / C-FORGE | 75 checkbox rows; Wave A complete |
| `tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard-component-health.md` | task list | A-FORGE-DASH / C-FORGE | 46 checkbox rows |
| `tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard.md` | task list | A-FORGE-DASH / C-FORGE | 47 checkbox rows |
| `tasks/TASKS/forge-projections/docs/FORGE_ECOSYSTEM_ELI5_AUDIT.md` | audit/remediation supporting record | A-FORGE-V1 / C-FORGE | — |
| `tasks/TASKS/forge-projections/docs/FORGE_EXPLAINED.md` | reference/supporting context | A-FORGE-V1 / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/forge-trends-combo-architecture.md` | implementation map/architecture plan | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/prd-forge-pass-4-living-audit-remediation.md` | PRD | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` | PRD | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-ecosystem-pass-4-audit-remediation.md` | PRD | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-trends-combo-project.md` | PRD | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | — |
| `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` | task list | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | 46 checkbox rows |
| `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-ecosystem-pass-4-audit-remediation.md` | task list | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | 91 checkbox rows |
| `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-pass-4-living-audit-remediation.md` | task list | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | 63 checkbox rows |
| `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-trends-combo-project.md` | task list | A-FORGE-P4 / A-FORGE-LIVE / B-FORGE-COMBO / C-FORGE | 37 checkbox rows |
| `tasks/TASKS/forge-projections/prediction-engine/tasks-prd-forge-prediction-engine-super-task-list.md` | task list | C-FORGE | 101 checkbox rows |
| `tasks/TASKS/forge-projections/v1/docs/goalie-forge-operator-runbook.md` | runbook | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/goalie-forge.md` | reference/supporting context | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/prd/goalie-forge-implementation-plan.md` | PRD | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/prd/prd-projection-model.md` | PRD | A-FORGE-V1 / B-START / C-FORGE | 18 checkbox rows |
| `tasks/TASKS/forge-projections/v1/prd/prd-run-forge-projections-modularization.md` | PRD | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/prd/prd-start-chart-model.md` | PRD | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/prd/prd-start-chart.md` | PRD | A-FORGE-V1 / B-START / C-FORGE | — |
| `tasks/TASKS/forge-projections/v1/tasks-goalie-forge.md` | task list | A-FORGE-V1 / B-START / C-FORGE | 54 checkbox rows |
| `tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md` | task list | A-FORGE-V1 / B-START / C-FORGE | 40 checkbox rows |
| `tasks/TASKS/forge-projections/v1/tasks-prd-run-forge-projections-modularization.md` | task list | A-FORGE-V1 / B-START / C-FORGE | 34 checkbox rows |
| `tasks/TASKS/forge-projections/v1/tasks-skater-forge.md` | task list | A-FORGE-V1 / B-START / C-FORGE | 55 checkbox rows |
| `tasks/TASKS/lines-ccc-ingestion/prd-lines-ccc-ingestion.md` | PRD | C-OPS | — |
| `tasks/TASKS/lines-ccc-ingestion/tasks-prd-lines-ccc-ingestion.md` | task list | C-OPS | 93 checkbox rows |
| `tasks/TASKS/lines-gdl-ingestion/GDL-INGESTION-RUNBOOK.md` | runbook | A-GDL | — |
| `tasks/TASKS/lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md` | task list | A-GDL | 85 checkbox rows; 73 checked and 12 open after authoritative-root rollout, four-receiver downstream-error containment, failed provider retirement/removal recovery, completed provider account identification with engineering escalation, post-restore trigger drift, and completed receiver-secret containment |
| `tasks/TASKS/nhl-game-prediction-model/prd-nhl-game-prediction-model.md` | PRD | A-PRED | — |
| `tasks/TASKS/nhl-game-prediction-model/research/deep-research-report.md` | research/decision support | A-PRED | — |
| `tasks/TASKS/nhl-game-prediction-model/tasks-prd-game-prediction-accuracy-improvement.md` | task list | A-PRED | 49 checkbox rows |
| `tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-model.md` | task list | A-PRED | 115 checkbox rows |
| `tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-roster-sos-model.md` | task list | A-PRED | 64 checkbox rows |
| `tasks/TASKS/rules/brand-style-cheat-sheet.md` | active process/style reference | CONTROL | — |
| `tasks/TASKS/rules/create-prd.mdc` | active process/style reference | CONTROL | — |
| `tasks/TASKS/rules/fhfh-styles.md` | active process/style reference | CONTROL | — |
| `tasks/TASKS/rules/generate-tasks.mdc` | active process/style reference | CONTROL | 6 checkbox rows |
| `tasks/TASKS/rules/process-task-list.mdc` | active process/style reference | CONTROL | — |
| `tasks/TASKS/rules/vars_Audit.md` | active process/style reference | CONTROL | — |
| `tasks/TASKS/schema-docs/README.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/api-db.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/edge-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/goalie-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/other-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/skater-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/goalie-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/nst-goalie-table-schemas.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/nst-team-tables-schemas.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/player-table-schemas.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/supabase-sql-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/supabase-table-structure.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/supabase-table-structure.mdc` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/supabase-context/supabase-views.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/schema-docs/team-tables.md` | schema/data contract reference | REFERENCE-SCHEMA | — |
| `tasks/TASKS/sko-charts/prd-sko-charts.md` | PRD | B-SKO / B-SKO-BURN | 25 checkbox rows |
| `tasks/TASKS/sko-charts/prd-sko.md` | PRD | B-SKO / B-SKO-BURN | — |
| `tasks/TASKS/sko-charts/sko-modeling-notes.md` | research/decision support | B-SKO / B-SKO-BURN | 37 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/nhl-edge/nhl-edge-feature-contract.md` | schema/data contract | A-3P | — |
| `tasks/TASKS/three-pillars-analytics/nhl-edge/nhl-edge-stats-api.md` | supporting note/reference | A-3P | — |
| `tasks/TASKS/three-pillars-analytics/prd-three-pillars-analytics.md` | PRD | A-3P | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-averages.md` | PRD | C-RANK | 5 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-audit-pass-2-trends-debug.md` | PRD | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-audit.md` | PRD | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-remediation-blueprint.md` | PRD | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-remediation.md` | PRD | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/rolling-player-metrics-audit-notes.md` | audit/remediation supporting record | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/rpm-audit-action-items-pass-2.md` | audit/remediation supporting record | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/rpm-audit-notes-pass-2.md` | audit/remediation supporting record | C-RANK | — |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-audit-pass-2-trends-debug.md` | task list | C-RANK | 48 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-audit.md` | task list | C-RANK | 41 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-remediation-blueprint.md` | task list | C-RANK | 63 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-remediation.md` | task list | C-RANK | 30 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-rolling-player-pass-2-main-audit.md` | task list | C-RANK | 38 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-rpm-audit-action-items-pass-2.md` | task list | C-RANK | 36 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/fhfh-site-surface-expansion-implementation-map.md` | PRD | A-SITE / A-STYLE / C-US | — |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-site-surface-expansion-roadmap.md` | PRD | A-SITE / A-STYLE / C-US | — |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-style-system-and-underlying-stats-restyle.md` | PRD | A-SITE / A-STYLE / C-US | — |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-mobile-stats-page-optimization.md` | PRD | A-SITE / A-STYLE / C-US | — |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-site-surface-expansion-roadmap.md` | task list | A-SITE / A-STYLE / C-US | 65 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-style-system-and-underlying-stats-restyle.md` | task list | A-SITE / A-STYLE / C-US | 87 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-mobile-stats-page-optimization.md` | task list | A-SITE / A-STYLE / C-US | 39 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/sustainability/SUSTAINABILITY-RUNBOOK.md` | runbook | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/deep-research-report.md` | research/decision support | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-barometer.md` | PRD | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md` | PRD | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-step4.md` | PRD | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-trends-audit.md` | PRD | A-SUST / B-SUST-BAR / B-SUST-AUD | — |
| `tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-plan.md` | supporting note/reference | A-SUST / B-SUST-BAR / B-SUST-AUD | 19 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md` | task list | A-SUST / B-SUST-BAR / B-SUST-AUD | 87 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-model.md` | task list | A-SUST / B-SUST-BAR / B-SUST-AUD | 89 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-trends-audit.md` | task list | A-SUST / B-SUST-BAR / B-SUST-AUD | 42 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/tasks-prd-three-pillars-analytics.md` | task list | A-3P | 85 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/trends/prd-trends.md` | PRD | B-TRENDS | recovered from empty scope on 2026-07-11 |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md` | audit/remediation supporting record | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md` | audit/remediation supporting record | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md` | audit/remediation supporting record | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/game-grid-revamp-plan.md` | implementation map/architecture plan | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/modularization-of-the-game-page.md` | implementation map/architecture plan | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/prd-game-grid-master-table-dashboard.md` | PRD | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/goalie-underlying-stats-runbook.md` | runbook | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/player-underlying-stats-runbook.md` | runbook | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/power-ratings-tables.md` | schema/data contract | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md` | PRD | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md` | PRD | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md` | PRD | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md` | PRD | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-player-underlying-stats-landing-page.md` | task list | A-US-SOS / B-GAMEGRID / C-US | — |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-game-grid-master-table-dashboard.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 32 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-goalie-underlying-stats-landing-page.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 44 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-player-underlying-stats-landing-page.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 81 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-team-underlying-stats-landing-page.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 66 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-underlying-stats-landing-page-sos.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 33 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-landing-page.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 40 checkbox rows |
| `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-power-rankings-roadmap.md` | task list | A-US-SOS / B-GAMEGRID / C-US | 30 checkbox rows |
| `tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md` | PRD | C-VAR | — |
| `tasks/TASKS/variance/v1/prd/prd-variance-section.md` | PRD | C-VAR | — |
| `tasks/TASKS/variance/v1/tasks-prd-skater-variance-leaderboard.md` | task list | C-VAR | 91 checkbox rows |
| `tasks/TASKS/variance/v1/tasks-prd-variance-section.md` | task list | C-VAR | 52 checkbox rows |
| `tasks/TASKS/variance/v2/goalie-page-relevant-tables.md` | schema/data contract | C-VAR | — |
| `tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md` | PRD | C-VAR | — |
| `tasks/TASKS/variance/v2/tasks-prd-variance-goalies-skaters-second-pass.md` | task list | C-VAR | 66 checkbox rows |
| `tasks/TASKS/variance/v2/variance-runbook.md` | runbook | C-VAR | — |
| `tasks/TASKS/wigo-charts/prd-wigo-charts-optimization.md` | PRD | C-US | — |
| `tasks/TASKS/wigo-charts/tasks-prd-wigo-charts-optimization.md` | task list | C-US | 37 checkbox rows; 37 checked after P1 NEW 7 query-contract remediation; C-US 5.3.6 audit pending |
| `tasks/TASKS/xg-model/baseline/tasks-xg-baseline-follow-ups.md` | task list | C-XG | 32 checkbox rows |
| `tasks/TASKS/xg-model/baseline/tasks-xg-baseline-options.md` | task list | C-XG | 36 checkbox rows |
| `tasks/TASKS/xg-model/baseline/xg-training-dataset-contract.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/baseline/xg-training-materialization-decision.md` | research/decision support | C-XG | — |
| `tasks/TASKS/xg-model/docs/data-contract-boundaries.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/docs/definitions-and-parity.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/docs/event-dictionary.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/docs/failure-handling-policy.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/docs/final-implementation-summary.md` | reference/supporting context | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/corrective-migration-decision.md` | research/decision support | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/feature-leakage-registry.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/idempotent-backfill-behavior.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/legacy-ingest-conventions.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/live-schema-drift-audit.md` | audit/remediation supporting record | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/manual-audit-requirements.md` | audit/remediation supporting record | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/nhl-api-nst-migration-brief.md` | reference/supporting context | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/pbp-plays-vs-nhl-api-events-audit.md` | audit/remediation supporting record | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/post-drift-retry-verification.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/post-foundation-follow-ups.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/prd/prd-nhl-api-xg-model.md` | PRD | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/schema-recommendation.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md` | audit/remediation supporting record | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/strength-mapping.md` | schema/data contract | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/team-format-example.json` | data/example reference | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/upstream-ambiguities.md` | research/decision support | C-XG | — |
| `tasks/TASKS/xg-model/nhl-api-foundation/validation-checklist.md` | supporting note/reference | C-XG | — |
| `tasks/TASKS/xg-model/nst-migration/nst-api-migration-runbook.md` | runbook | C-OPS | — |
| `tasks/TASKS/xg-model/nst-migration/nst-config-contract.md` | schema/data contract | C-OPS | — |
| `tasks/TASKS/xg-model/nst-migration/nst-direct-caller-inventory.md` | supporting note/reference | C-OPS | — |
| `tasks/TASKS/xg-model/nst-migration/nst-route-ownership-decisions.md` | research/decision support | C-OPS | — |
| `tasks/TASKS/xg-model/nst-migration/prd/prd-nst-api-audit-and-migration.md` | PRD | C-OPS | — |
| `tasks/TASKS/xg-model/release/tasks-xg-release-exception-resolution.md` | task list | A-XG-REL / B-XG-EX | 15 checkbox rows |
| `tasks/TASKS/xg-model/release/tasks-xg-release-remediation.md` | task list | A-XG-REL / B-XG-EX | 32 checkbox rows |
| `tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md` | task list | C-XG | 72 checkbox rows |
| `tasks/TASKS/xg-model/trending-model/tasks-xg-trending-model-completion.md` | task list | A-XG-TREND | 170/170 checkbox rows after live hardening, containment, flurry, and offline rebound findings |
| `tasks/TASKS/lines-gdl-ingestion/prd/prd-gdl-suite-ingestion.md` | PRD | A-GDL | missing pair repaired 2026-07-11 |
| `tasks/TASKS/xg-model/trending-model/prd/prd-xg-trending-model-completion.md` | PRD | A-XG-TREND | missing pair repaired 2026-07-11 |
| `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-draft-dashboard.md` | task list | A-DRAFT | missing pair repaired; 91/91 rows complete after verified findings and option-A scope decision |
| `tasks/TASKS/sko-charts/tasks-prd-sko-charts.md` | task list | B-SKO / B-SKO-BURN | reconciled pair; 53 generated rows |
| `tasks/TASKS/forge-projections/v1/tasks-prd-start-chart.md` | task list | B-START | reconciled pair; 51 generated rows |
| `tasks/TASKS/xg-model/release/prd/prd-xg-release-validation-and-exception-resolution.md` | PRD | A-XG-REL / B-XG-EX | shared pair repaired 2026-07-11 |
| `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-yahoo-ingestion-mapping-audit.md` | task list | B-YAHOO | missing pair repaired; 58 generated rows |
| `tasks/TASKS/draft-dashboard-yahoo/tasks-prd-gamegrid-draft-dashboard-style-overhaul.md` | task list | B-DRAFT-STYLE | missing pair repaired; 52 generated rows |
| `tasks/TASKS/dead-code-cleanup/tasks-prd-cleanup-tasks.md` | task list | B-CLEAN | missing pair repaired; 140 current rows after containment, warning/accessibility/suppression, evidence correction, wrapper/fallback, TeamDashboard, schedule/Forge, and historical team-source findings; 96/140 verified; NEW 7/19–20/26/40–42/45/50/62–64/66/76–77/81–87/92/100–101/105/107 and broader image/hook/noise/toolchain/integrated work remain open |
| `tasks/TASKS/dead-code-cleanup/tasks-prd-dead-code-report.md` | task list | B-DEAD | missing pair repaired; 35 generated rows |
| `tasks/TASKS/dead-code-cleanup/tasks-prd-drm-refactor.md` | task list | B-DRM | missing pair repaired; 110 rows, 84 verified and 26 open; NEW 65/67–74/76–84 locally closed; NEW 64/66/75 await executable temporary-branch proof; NEW 29 remains open for generated types, races, bounded history/downstream repair, deployment, schedule integration, and production evidence |
| `tasks/TASKS/three-pillars-analytics/trends/tasks-prd-trends.md` | task list | B-TRENDS | recovered pair; 50 generated rows |

## Appendix B — Initiative Pair Reconciliation Matrix

`Direct` means a dedicated PRD/task pair exists. `Shared/merged` means the initiative has a usable governing PRD or task list through the explicit mapping below; source history remains in place. Pair repair does not prove implementation completion.

| Initiative | PRD ownership | Task-list ownership | Pair disposition |
|---|---|---|---|
| A-AUTH Authentication/settings | `auth-user-settings-platform/prd/prd-auth-user-settings-platform.md` | `auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md` | Direct; 189/208 reconciled with 19 received-link/provider/credential-retention rows open |
| A-CRON-EMAIL email failures | `cron-operations/prd/prd-cron-nst-audit-remediation.md` | `cron-operations/tasks-cron-audit-email-failures.md` | Shared PRD with B-CRON-NST; route/failure dedupe required |
| A-GDL GDL Suite | `lines-gdl-ingestion/prd/prd-gdl-suite-ingestion.md` | `lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md` | Direct; repaired |
| A-3P Three Pillars | `three-pillars-analytics/prd-three-pillars-analytics.md` | `three-pillars-analytics/tasks-prd-three-pillars-analytics.md` | Direct |
| A-SUST Sustainability model | `three-pillars-analytics/sustainability/prd/prd-sustainability-model.md` + Step 4 | `three-pillars-analytics/sustainability/tasks-prd-sustainability-model.md` | Direct/shared phase PRD |
| A-US-SOS Underlying/SOS | `three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md` | corresponding `tasks-prd-underlying-stats-landing-page-sos.md` | Direct |
| A-SITE Site roadmap | dedicated site-roadmap PRD | corresponding site-roadmap task list | Direct |
| A-STYLE Style system/restyle | dedicated site-roadmap style PRD | corresponding style task list | Direct |
| A-FORGE-V1 Projection V1 | `forge-projections/v1/prd/prd-projection-model.md` | main V1 plus skater/goalie nested lists | Shared/merged nested work |
| A-FORGE-DASH Dashboard remediation | component-health PRD + dashboard PRD | audit and remediation lists | Shared audit/remediation pair |
| A-FORGE-CC Command Center | dedicated command-center PRD | dedicated list | Direct |
| A-FORGE-P4 Ecosystem pass four | dedicated pass-four PRD | dedicated list | Direct |
| A-FORGE-LIVE Living pass four | dedicated living PRD | dedicated list | Direct |
| A-PRED Game prediction | `nhl-game-prediction-model/prd-nhl-game-prediction-model.md` | main, accuracy, and roster/SOS lists | Shared umbrella PRD for nested lists |
| A-XG-TREND xG completion | repaired trending-model PRD | trending completion list | Direct; repaired |
| A-XG-REL / B-XG-EX release | shared release validation/exception PRD | remediation + exception lists | Shared; repaired |
| A-DRAFT Draft Dashboard | dedicated Draft Dashboard PRD | reconstructed Draft Dashboard list | Direct; repaired |
| A-DRAFT-DEBUG debug/performance | `prd-draft-dash-debug.md` | embedded checklist plus overlaps synchronized to Draft list | Embedded/shared pair |
| A-DRAFT-RANKER / B-DRAFT-RANKER-P8 Account-backed personal NHL Draft Ranker | `draft-ranker/prd-draft-ranker.md` | `draft-ranker/tasks-prd-draft-ranker.md` plus launch-runbook source checklist | Direct; repaired; Phase 7/DR-072 and ignored localhost readiness complete, 50/55 overall, and the five deferred Phase 8 rows explicitly mapped to Wave B |
| B-CRON-NST Cron/NST audit | dedicated cron/NST PRD | dedicated list | Direct; also governs A-CRON-EMAIL |
| B-SUST-BAR Barometer | dedicated PRD | dedicated list | Direct |
| B-SUST-AUD trends audit | dedicated PRD | dedicated list; plan/report supporting | Direct |
| B-GAMEGRID master dashboard | dedicated Game Grid PRD | dedicated list | Direct |
| B-SKO / B-SKO-BURN | later SKO PRD; older SKO PRD marked research/superseded; burn plan supporting | reconciled SKO task list | Shared/merged; repaired |
| B-START Start Chart | both source PRDs with Daily MVP precedence | reconciled Start Chart list | Shared/merged; repaired |
| B-FORGE-COMBO | dedicated combo PRD + architecture | dedicated combo list | Direct |
| B-YAHOO Yahoo audit | Yahoo audit PRD | generated Yahoo list | Direct; repaired |
| B-DRAFT-STYLE Game Grid style | dedicated style PRD | generated style list | Direct; repaired |
| B-CLEAN warning cleanup | cleanup PRD | generated cleanup list | Direct; repaired |
| B-DEAD dead-code follow-through | audit PRD | generated follow-through list | Direct; repaired |
| B-DRM Date Range Matrix | DRM PRD | generated DRM list | Direct; repaired |
| B-TRENDS Trends | recovered formerly empty PRD | generated Trends list | Direct; repaired |
| C-OPS Cron schedule/failures | dedicated cron PRDs | dedicated lists | Direct |
| C-OPS NST migration | `xg-model/nst-migration/prd/prd-nst-api-audit-and-migration.md` | `cron-operations/tasks-prd-nst-api-audit-and-migration.md` | Cross-directory direct pair |
| C-OPS Lines/CCC | dedicated CCC PRD | dedicated list | Direct |
| C-RANK Contextual Rankings | contextual PRDs for base/alignment/gap | corresponding three lists | Direct |
| C-RANK Rolling metrics | audit/blueprint/remediation/pass-two PRDs | corresponding primary and nested lists | Direct/shared nested evidence |
| C-US player/team/goalie underlying | dedicated entity PRDs | dedicated entity lists | Direct |
| C-US standalone landing/power roadmaps | underlying/SOS and entity PRDs | `tasks-underlying-stats-landing-page.md` and power-ranking roadmap | Explicit merge into underlying initiative; no competing PRD |
| C-US Mobile stats | dedicated PRD | dedicated list | Direct |
| C-US WiGO | dedicated PRD | dedicated list | Direct |
| C-FORGE goalie nested | goalie implementation plan/`goalie-forge.md` plus V1 PRD | `tasks-goalie-forge.md` | Shared/merged into V1 |
| C-FORGE modularization/dashboard/pass three | dedicated PRDs | dedicated lists | Direct |
| C-FORGE prediction-engine super list | Projection V1 PRD and master PRD C-FORGE contract | prediction-engine super list | Explicit merge; standalone PRD unnecessary |
| C-XG NHL API foundation | dedicated foundation PRD | `tasks-nhl-api-xg-model.md` | Direct |
| C-XG baseline contracts | foundation PRD + dataset/feature/materialization contracts | baseline option/follow-up lists | Explicit merge into C-XG foundation |
| C-VAR variance initiatives | three dedicated PRDs | three dedicated lists | Direct |
| REFERENCE schema/process/style | Reference indices/contracts/rules | Tasks created only for verified drift | Reference-only, not missing implementation pairs |

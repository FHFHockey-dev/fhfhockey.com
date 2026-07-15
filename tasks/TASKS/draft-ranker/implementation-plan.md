# Implementation Plan

This plan implements the approved directions in the [decision record](./decision-record.md), is grounded in the [repository audit](./repository-audit.md), and is tracked through [progress.md](./progress.md). Product authority remains [product-strategy.md](./product-strategy.md), with execution governed by [goal-prompt.md](./goal-prompt.md).

Task statuses below are current as of 2026-07-14. Production migration application remains subject to the recorded approval checkpoints.
Phase 0 — Audit closure and approved decisions
Phase contract
Status: Completed 2026-07-14; documentation was reviewed through the implementation-goal handoff, the execution boundary was recorded, and the technical contract was frozen.
Scope: Persist approved records, isolate work, and establish security/migration gates.
Dependencies: None.
Affected systems: tasks/TASKS/draft-ranker, Git worktree, Supabase migration workflow.
Database/API/UI: No product changes.
Acceptance/tests: Documents reproduce these four sections; repository and live-schema facts are rechecked before implementation.
Security/observability: Capture advisor baseline and migration audit evidence.
Migration/rollback: No migration.
Feature flag: None.
Approval checkpoint: Review saved documents before implementation.
Non-goals: Product code or schema changes.
DR-001 — Persist and review the planning package
Status/Scope: Completed 2026-07-14; saved and reviewed the audit, decision record, implementation plan, and progress state.
Dependencies/Affected: None; tasks/TASKS/draft-ranker/*.md.
DB/API/UI: None.
Acceptance/Tests: All delimiters, stable IDs, statuses, and approved choices match this conversation; links resolve.
Security/Observability: Record no secrets or raw user data.
Migration/Rollback/Flag/Approval: Revertible documentation only; user review required.
Non-goals: Implementation.
DR-002 — Establish a clean execution boundary
Status/Scope: Completed 2026-07-14; inventoried overlapping dirty files, selected strict path isolation in the shared checkout, confirmed canonical migration ownership, and recorded live/local baseline drift in `execution-boundary.md`.
Dependencies/Affected: DR-001; Git, supabase/migrations, generated types, homepage/auth files.
DB/API/UI: None.
Acceptance/Tests: Unrelated user changes are identified and preserved; canonical migration path is confirmed.
Security/Observability: Record baseline migration list and advisor output.
Migration/Rollback/Flag/Approval: No apply; no flag; approval only if overlapping changes cannot be isolated.
Non-goals: Cleaning or reverting unrelated work.
DR-003 — Freeze schema, API, and security contracts
Status/Scope: Completed 2026-07-14; froze table/RPC/API, ownership, concurrency, idempotency, deletion, feature-flag, threat-model, and verification contracts in `technical-contract.md`.
Dependencies/Affected: DR-001–002; planned web/lib/draft-ranker/contracts.ts and migration design.
DB/API/UI: Design only.
Acceptance/Tests: Every owner boundary, RPC grant, idempotency rule, error response, and deletion path is specified.
Security/Observability: Triage public SECURITY DEFINER warnings, especially execute_sql; define ranker security tests.
Migration/Rollback/Flag/Approval: Production migration remains blocked; approval required before difficult-to-reverse changes.
Non-goals: Remediating all unrelated database advisories inside the ranker project.
Phase 1 — Identity and account-backed ranking foundation
Phase contract
Status: Completed 2026-07-14; DR-010 through DR-013 are live or code-complete behind the disabled server feature flag.
Scope: Additive FHFH identity, ownership schema, RLS, generated types, and authenticated API foundations.
Dependencies: Phase 0.
Affected systems: Canonical migrations, Supabase types, admin identity tools, draft-ranker API/lib directories.
Database/API/UI: New identity and owner tables; foundational authenticated endpoints; admin review only.
Acceptance/tests: Prospects can exist without NHL/Yahoo IDs; existing NHL joins remain unchanged; cross-user access fails.
Security/observability: Explicit grants/RLS and migration audit counts.
Migration/rollback: Additive, idempotent migrations; disable feature rather than dropping populated tables.
Feature flag: DRAFT_RANKER_ENABLED=false by default.
Approval checkpoint: Review identity migration before production apply.
Non-goals: Ranking UI or public community output.
DR-010 — Create the FHFH identity registry
Status/Scope: Completed 2026-07-14; the approved additive identity, external mapping, alias/history, lifecycle, and review migrations were applied to the linked project and verified.
Dependencies/Affected: DR-003; supabase/migrations/<timestamp>_draft_ranker_identity.sql, generated types.
DB/API/UI: New identity tables/indexes; no public write API; admin review types only.
Acceptance/Tests: Unique NHL links, provider-context uniqueness, duplicate-name support, no-name-only auto merge, prospects without NHL IDs; six focused Vitest contract tests and a rolled-back live behavior probe pass.
Security/Observability: All five tables are service-only; RLS, restrictive client-deny policies, grants, trigger security, migration ledger, and advisors were verified live. Six newly reported unindexed foreign keys were corrected in a follow-up migration.
Migration/Rollback/Flag/Approval: Additive and rerunnable; feature off; identity migration approval required.
Non-goals: Replacing players or importing a paid prospect source.
DR-011 — Backfill and reconcile identities
Status/Scope: Completed 2026-07-14; canonical NHL identities, NHL mappings, aliases, roster history, and the user-approved Yahoo 90/50 single-candidate promotion are reconciled live. Ten intentionally unresolved Yahoo review items remain queued for individual evidence review.
Dependencies/Affected: DR-010; backfill script/RPC, alias review UI/API.
DB/API/UI: Batched identity/mapping writes; admin review endpoints; review queue UI additions.
Acceptance/Tests: Counts reconcile; ambiguous mappings remain unresolved; reruns create no duplicates; 12 Python matcher/promotion tests and 14 focused identity migration tests pass.
Security/Observability: Service-only writes; structured matched/unmatched/ambiguous counts; explicit system-review actor and immutable manifest hash recorded; advisors report no identity-table security findings.
Migration/Rollback/Flag/Approval: Resume-safe batches; exact promotion migration passed a twice-run rollback rehearsal before approved live apply; rollback preserves audit history rather than silently deleting verified evidence.
Non-goals: Automatically accepting fuzzy matches.
DR-012 — Create ranking ownership tables and RLS
Status/Scope: Completed 2026-07-14; the approved 10-table additive ranking, entry, watchlist, event, seed, consent, prompt, comparison, preference, and placement foundation and its foreign-key index follow-up are live and verified.
Dependencies/Affected: DR-010; canonical migration and generated types.
DB/API/UI: Owner UUIDs, cascade rules, indexes, constraints, RLS; no user UI yet.
Acceptance/Tests: One default ranking per user/season; future named sets supported; all cross-user access and direct browser mutations denied; nine focused migration-contract tests and a two-account rollback-only live probe pass.
Security/Observability: RLS on all ten tables; 22 owner policies; anon denied; authenticated raw tables read-only; service/API mutation path; fixed-search-path invoker trigger; no target security or unindexed-FK advisor findings.
Migration/Rollback/Flag/Approval: Additive, feature-off, approved, and live as migrations `20260715011329` and `20260715011557`; behavior and cascade probes left zero residue.
Non-goals: Community aggregate tables or model.
DR-013 — Add authenticated ranker API conventions
Status/Scope: Completed 2026-07-14; added shared validation, stable response/error envelopes, owner-scoped reads, retry fingerprints, conflict codes, and the authenticated bootstrap/status endpoint.
Dependencies/Affected: DR-012; web/lib/draft-ranker/*, web/pages/api/v1/draft-ranker/*.
DB/API/UI: Read bootstrap/status endpoints; no full UI.
Acceptance/Tests: Consistent 400/401/403/404/405/409/500 behavior, strict operation validation, deterministic payload fingerprints, owner-scoped bootstrap queries, and redacted unexpected errors are covered by 12 focused tests; TypeScript passes.
Security/Observability: Uses requireApiUser with a backward-compatible envelope adapter; ignores client user IDs; structured request IDs; server-only service client; raw tables remain client-read-only.
Migration/Rollback/Flag/Approval: Code rollback safe; `DRAFT_RANKER_ENABLED` is strict and defaults off; no schema change or rollout approval consumed.
Non-goals: New global state or authentication architecture.
Phase 2 — Seed, continuous ordering, and direct editing
Phase contract
Status: In progress; implementation remains staff/beta-disabled pending the Phase 2 launch gate.
Scope: Idempotent Yahoo seed, sparse ordering RPCs, ranker page, direct manipulation, and conflict behavior.
Dependencies: Phase 1.
Affected systems: Ranking RPC migration, API routes, /draft-rankings, hooks/components.
Database/API/UI: Seed runs, reorder/normalize functions, ranking read/write endpoints, full-list UI.
Acceptance/tests: Persistent cross-device ranking; correct 250/251 behavior; ordinary moves update one entry.
Security/observability: Owner validation inside RPCs; reorder/seed metrics.
Migration/rollback: Functions can be replaced; feature disabled for rollback.
Feature flag: Staff/beta only.
Approval checkpoint: Validate production seed counts before enabling users.
Non-goals: Pairwise homepage or community output.
DR-020 — Implement idempotent Yahoo ADP initialization
Status/Scope: Completed 2026-07-14; atomically seeds 2026–27 from verified/rankable 2025 Yahoo preseason ADP with the approved scalar fallback and persists the full continuous candidate order.
Dependencies/Affected: DR-011–013; seed function/service and initialization endpoint.
DB/API/UI: Seed revision and provenance; POST .../initialize; onboarding state.
Acceptance/Tests: Live rollback rehearsal seeded 313 players in deterministic sparse order (250 top-ranked, 63 candidates), including 74 scalar fallbacks; same-operation and same-revision retries are no-ops and payload reuse conflicts.
Security/Observability: API derives the owner from requireApiUser; service-only invoker RPC records 1,494 source rows, 446 unmapped, 592 rankable/mapped invalid ADP, 313 seeded, failure state, operation hash, and initialization event. No target security findings.
Migration/Rollback/Flag/Approval: Live as `20260715012955_initialize_draft_ranker_from_yahoo_adp`; server flag remains off; seed rows are preserved if disabled and explicit reset is required to reseed.
Non-goals: Using ADP as eligibility or permanent personal evidence.
DR-021 — Implement atomic sparse reordering and repair
Status/Scope: Completed 2026-07-14; move-to-rank, insert-above/below, remove-to-bench, automatic normalization, validation, idempotency, and optimistic conflict behavior are live behind the disabled flag.
Dependencies/Affected: DR-012; ordering migration, API mutation routes.
DB/API/UI: Transactional functions and 409 conflict contract; no final styling.
Acceptance/Tests: Live 313-player rollback rehearsal covered rank 300→1, rank 1→251, insert-above, midpoint exhaustion, normalization, same-request replay, changed-payload conflict, stale-version conflict, and order validation with zero residue.
Security/Observability: API-derived ownership; service-only invoker functions; exact execute revocation; immutable reorder/normalization events; comparison-conflict counts; no target advisor findings.
Migration/Rollback/Flag/Approval: Live as `20260715013836_reorder_draft_ranking_sparse`; replaceable functions and server flag remains off.
Non-goals: Linked-list or event-replay read model.
DR-022 — Build the personal ranking page
Status/Scope: Completed 2026-07-14; responsive paginated top-250/candidate table backed by one continuous persisted order.
Dependencies/Affected: DR-020–021; web/pages/draft-rankings/index.tsx, web/components/DraftRanker/*, hooks/styles.
DB/API/UI: Ranking list endpoints; drag, numeric entry, insert controls, candidate boundary, loading/error/conflict states.
Acceptance/Tests: Numeric movement, select-and-insert-above/below, drag-to-insert, remove-to-bench, animated layout movement, 50-row pagination, candidate switching, loading/error/disabled/conflict states, and a clear rank-250 boundary are implemented. Focused component, server, route, contract, migration, and TypeScript checks pass; the owner-scoped list is reloaded from the persisted sparse order after every edit.
Security/Observability: The browser receives no service credential and never supplies ownership; the API derives the account from `requireApiUser`, checks ranking ownership before the entry read, redacts unexpected errors, and refreshes on stale-version conflicts without logging player-private content.
Migration/Rollback/Flag/Approval: UI removable behind flag.
Non-goals: Bulk tiers or multiple named rankings.
DR-023 — Verify ordering and event integrity
Status/Scope: Completed 2026-07-14; focused SQL, API, component, live rollback-only integrity, and signed-out/authenticated responsive browser coverage pass.
Dependencies/Affected: DR-020–022; test fixtures and repair checks.
DB/API/UI: No new feature surface.
Acceptance/Tests: A rollback-only live probe seeded 313 players and completed 100 randomized atomic moves; validation after every move preserved a unique 313-player total order. All 100 reorder events contained expected/resulting versions, before/after state, operation hashes, and result payloads. Fifty focused automated tests pass. Chrome confirms the real signed-out and authenticated routes render cleanly at desktop and 390x844 mobile widths. A real account-backed board initialized 313 players, persisted edits through reload and sign-out/sign-in, corrected displaced numeric-input state, promoted rank 251 to 250, displaced the prior rank 250 to 251, and preserved the 250/63 split. The repository-wide TypeScript check is currently blocked by five pre-existing errors outside Draft Ranker in `PlayerRadarChart.tsx`, `update-wgo-skaters.ts`, and `fetchWigoPlayerStats.ts`; no focused Draft Ranker test fails.
Security/Observability: Cross-user validation and reorder returned owner-safe `not_found`; route tests confirm forged user input is ignored. The explicitly approved isolated Auth account was signed out and deleted after verification; all 12 checked account-owned/auth rows and the temporary credential file were confirmed absent.
Migration/Rollback/Flag/Approval: Launch gate only.
Non-goals: Full community modeling.
Phase 3 — Search, watchlist, and assisted placement
Phase contract
Status: Completed 2026-07-15; DR-030 through DR-033 passed the approved phase checkpoint, automated verification, live database checks, and isolated authenticated browser verification.
Scope: Full-universe discovery/search, watched/unplaced state, deterministic placement, and resumption.
Dependencies: Phase 2.
Affected systems: Identity indexes/API, watchlist endpoints, placement engine/UI.
Database/API/UI: Search RPC/endpoint, watchlist CRUD, placement sessions.
Acceptance/tests: A verified non-ADP prospect can be found, watched, placed, and persisted.
Security/observability: Search/addition limits and placement audit.
Migration/rollback: Additive indexes/session functions; flag controlled.
Feature flag: Beta.
Approval checkpoint: Review search inclusion statuses and request-addition workflow.
Non-goals: Arbitrary player creation.
DR-030 — Build canonical player search and addition requests
Status/Scope: Completed 2026-07-14; normalized service-side search with disambiguated results and an editorial addition-request workflow.
Dependencies/Affected: DR-010–011; identity search indexes, API, autocomplete component.
DB/API/UI: Applied additive migration `20260715024101_add_draft_ranker_player_search.sql`; added service-only search and addition-request RPCs, authenticated search/request endpoints, typed contracts and generated function types, a debounced React Query hook, and the real Draft Ranker search/request UI. Addition requests reuse `fhfh_player_identity_review_queue`; no parallel queue or identity table was created.
Acceptance/Tests: Exact, prefix, alias, external-ID, and fuzzy search are bounded to 25 results; default results are verified `active_nhl`, `active_prospect`, and `unsigned_relevant` identities, while archived identities require the explicit filter and are non-rankable. Duplicate Elias Pettersson identities remain separately disambiguated. Prospect/organization/lifecycle/Yahoo labels, headshots, and fallbacks render. Seven focused suites pass 33/33 tests. The repository-wide TypeScript check adds no Draft Ranker errors and remains blocked only by the same five unrelated baseline errors. The real signed-out route was rechecked in Chrome; authenticated visual interaction is intentionally deferred to the consolidated Phase 3 verification so no additional temporary account is created for a single task.
Security/Observability: Both RPCs are SECURITY INVOKER and executable only by `service_role`; API ownership comes from `requireApiUser`. Addition requests validate context/candidate IDs, deduplicate per user and normalized name, serialize with an advisory transaction lock, and cap each user at five requests per 24 hours with `Retry-After`. A live service-role probe was rolled back with zero residue. Post-apply security advisors contain no target findings; the two new trigram indexes only have expected pre-traffic unused-index informational notices. A cold live exact-name search completed in approximately 154 ms.
Migration/Rollback/Flag/Approval: The migration was rehearsed transactionally before apply and its service-role execution was probed transactionally after apply. The two indexes and functions are additive/removable; editorial requests remain retained if the feature is disabled. The Phase 3 inclusion/request-workflow checkpoint was approved. Production `DRAFT_RANKER_ENABLED` remains off.
Non-goals: Free-form identities.
DR-031 — Implement watchlist and candidate actions
Status/Scope: Completed 2026-07-14; watch/unwatch, dismiss, not-relevant, restore, and persisted compare-now intent are owner-backed. The compare-now UI is intentionally withheld until DR-032 can start a real placement session.
Dependencies/Affected: DR-030; watchlist APIs/hooks/components.
DB/API/UI: Reused `draft_ranking_watchlist`; applied `20260715025809_add_draft_ranker_player_actions` for separate disposition/compare-intent state and service-only transactional actions, plus `20260715030450_add_draft_ranker_player_preference_fk_index`. Added owner-scoped GET/POST `/api/v1/draft-ranker/watchlist`, typed server/hook contracts, search-result controls, and a visible unplaced watchlist panel.
Acceptance/Tests: Watchlist membership remains independent of continuous ranking entries, dismiss/not-relevant remove watch state without deleting ranking evidence, restore clears discovery preference, and every action has an idempotent operation event. A full live rollback rehearsal passed watch, replay, dismiss, restore, compare intent, and cross-owner hiding. Nine focused suites pass 45/45 tests; TypeScript adds no Draft Ranker errors and still reports only the five unrelated baseline errors.
Security/Observability: Four owner RLS policies protect preference reads, authenticated raw writes remain revoked, and the action RPC is SECURITY INVOKER/service-role-only. Every mutation writes a `draft_ranking_events` record without changing ordered-rank version state. Post-apply security advisors contain no target finding; the composite FK is covered and only expected pre-traffic unused-index notices remain.
Migration/Rollback/Flag/Approval: Both migrations are additive and removable before rollout; watchlist/preferences cascade with ranking/account deletion. No special approval was required under the approved Phase 3 plan. Production `DRAFT_RANKER_ENABLED` remains off.
Non-goals: Automatic rank from watchlist.
DR-032 — Implement deterministic placement engine
Status/Scope: Completed 2026-07-14; deterministic rough-range placement, interval narrowing, local/cutoff validation, contradiction handling, bounded completion, and persisted lifecycle.
Dependencies/Affected: DR-021, DR-030; placement library, session API/RPC.
DB/API/UI: Applied additive migration `20260715032036_add_draft_ranker_assisted_placement`; added four service-only lifecycle RPCs, strict GET/POST `/api/v1/draft-ranker/placement`, a server-computed deterministic engine, persisted evidence/state, targeted generated types, and a React Query placement hook. DR-033 owns the visible flow.
Acceptance/Tests: Scripted range, midpoint, too-close, local-neighbor, explicit 250/251, contradiction, and question-cap scenarios are deterministic. Start/replay/answer/cross-owner/confirm/watch-preservation/compare-intent cleanup passed a full rollback-only live lifecycle probe. Four focused suites pass 28/28 tests, including rejection of forged engine-state fields.
Security/Observability: API ownership derives from `requireApiUser`; session reads are owner-filtered; the browser sends only rough range or answer outcomes. All four functions are fixed-search-path SECURITY INVOKER and executable only by `service_role`; immutable state and idempotency events retain prompt/answer evidence. Post-apply advisors contain no target security finding; the only target performance notice is the expected pre-traffic unused player-FK index.
Migration/Rollback/Flag/Approval: Sessions expire and may be cancelled; migration is additive and removable before rollout. Production `DRAFT_RANKER_ENABLED` remains off. No additional approval was required under the approved Phase 3 plan.
Non-goals: ML anchor selection.
DR-033 — Build assisted-placement UI and resume flow
Status/Scope: Completed 2026-07-15; compare cards, progress, rough-range explanation, confirm/cancel, resume, stale-board revalidation, and isolated authenticated visual/persistence verification are complete.
Dependencies/Affected: DR-032; DraftRanker components/hooks.
DB/API/UI: Uses the DR-032 APIs through `useDraftPlacement`; canonical search and watchlist results now expose real Place/Re-evaluate actions and persisted compare intent. The in-page assisted-placement panel offers seven rough ranges, deterministic head-to-head answers, bounded progress, transparent suggested neighbors/confidence, atomic confirm/cancel, active-session resume, and stale-version restart against the refreshed board. Applied hardening migration `20260715034601_enforce_single_active_draft_placement` so the ranking-level resume contract cannot strand a second active session; elapsed sessions transition to expired before a replacement starts.
Acceptance/Tests: Four panel tests cover server-owned start state, outcome-only answers, persisted resume, transparent confirmation, and stale revalidation. A rollback-only live rehearsal verified the single-active ranking invariant, stable existing-session conflict, expiration, and replacement with zero residue. The complete focused Draft Ranker suite passes 112/112 tests and TypeScript passes. An approved disposable account verified the real desktop and 390×844 mobile flows: exact canonical search found the verified non-ADP prospect Caleb Malhotra, watch state persisted, placement resumed after reload at comparison two, seven answers produced a transparent rank-201 suggestion and range, confirmation atomically inserted him at No. 201, the board retained 250 ranked players, the displaced boundary continued at No. 251, version advanced to one, and a second reload preserved the result. The rendered row, placed-watchlist state, Re-evaluate action, and responsive layouts were visually checked.
Security/Observability: UI submits only rough range or enumerated outcomes and never receives other users or hidden aggregate evidence. The single-active function remains fixed-search-path SECURITY INVOKER, anonymous/authenticated execution is denied, service-role execution is retained, and post-apply advisors have no target security finding. The confirmed placement persisted seven answers and an immutable `assisted_placement_confirmed` event. The approved disposable account was signed out and deleted; all Auth, settings, ranking, entry, event, seed, watchlist, placement, preference, pairwise, and contribution rows were verified absent. Current target advisor output contains no security finding and only expected pre-rollout unused-index informational notices.
Migration/Rollback/Flag/Approval: UI is controlled by the existing server flag; production `DRAFT_RANKER_ENABLED` remains off. The additive unique index/function hardening can be rolled back before rollout by dropping the new index and restoring the preceding function definition. Data migration `20260715040050_add_verified_2026_prospect` adds one real editorially verified prospect with official NHL provenance, organization history, and a resolved review record without hardcoded generated IDs; rollback preserves the identity while referenced. Phase 4 remains behind its separate homepage-slot product/visual checkpoint.
Non-goals: Community page.
Phase 4 — Homepage pairwise experience and adaptive queue
Phase contract
Status: In progress; DR-040 and DR-041 complete, DR-042 implemented with browser visual verification pending.
Scope: Consent-aware comparisons, deterministic matchup queue, homepage card, and animated preview.
Dependencies: Phases 2–3.
Affected systems: Comparison services, homepage module boundary, account privacy setting.
Database/API/UI: Prompt issuance, comparison writes, queue read, homepage integration.
Acceptance/tests: Ten-player preview slides correctly after a decision and persists after login/session change.
Security/observability: Prompt validation, rate limits, consent audit, no raw public evidence.
Migration/rollback: Feature can be removed without ranking loss.
Feature flag: Separate DRAFT_RANKER_HOMEPAGE_ENABLED.
Approval checkpoint: Visual/product review before replacing the current homepage slot.
Non-goals: Homepage-wide redesign.
DR-040 — Implement consent and comparison evidence
Status/Scope: Complete; consent versioning, prompt issuance, outcomes, reversals, skip, and too-close.
Dependencies/Affected: DR-012, DR-032; account/ranker APIs and comparison migration functions.
DB/API/UI: Consent setting and comparison endpoints; onboarding disclosure.
Acceptance/Tests: Duplicate retries are harmless; reversals supersede; opt-out removes evidence from future aggregates.
Security/Observability: Explicit opt-in; prompt/user/pair/season validation; no public user history.
Migration/Rollback/Flag/Approval: Approved privacy direction; flag defaults off.
Non-goals: Direct edits converted to community evidence.
DR-041 — Implement deterministic adaptive queue
Status/Scope: Complete; twenty-slot policy, cooldowns, diversity, and why-selected explanations.
Dependencies/Affected: DR-031–040; queue library/API.
DB/API/UI: Prompt queue response includes reason and mode.
Acceptance/Tests: Mix, repetition, cutoff, position diversity, and quick-five policies pass deterministic fixtures.
Security/Observability: Server selects eligible prompts; queue diagnostics aggregate only.
Migration/Rollback/Flag/Approval: Algorithm versioned; roll back to prior queue version.
Non-goals: Bandits or learned personalization.
DR-042 — Add homepage pairwise card and preview
Status/Scope: In verification; contained homepage module with blind default and expandable evidence is implemented, but the required browser visual pass is pending because both available browser backends failed to attach their created tabs to this Codex session.
Dependencies/Affected: DR-041; [index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/index.tsx) and existing homepage module/styles.
DB/API/UI: Queue/comparison calls; ten-player animated list and account prompts.
Acceptance/Tests: One card only, responsive layout, correct slide/refill animation, no ADP/community anchoring by default.
Security/Observability: Signed-in ownership; signed-out state does not create anonymous records.
Migration/Rollback/Flag/Approval: Separate kill switch; visual approval before broad rollout.
Non-goals: Rebuilding unrelated homepage sections.
DR-043 — Add abuse and rate controls
Status/Scope: Not started; distributed limits, burst checks, cooldowns, and community-eligibility suppression.
Dependencies/Affected: DR-040–042; database/platform limiter, API middleware, admin diagnostics.
DB/API/UI: Limit state and 429/retry metadata; personal comparison may remain while community contribution is suppressed.
Acceptance/Tests: Limits work across instances; retries do not double-count; coordinated pair targeting is flagged.
Security/Observability: No IP/user secrets in ordinary logs; moderation reason codes.
Migration/Rollback/Flag/Approval: Thresholds configurable; emergency community contribution kill switch.
Non-goals: Mature fraud-scoring model.
Phase 5 — Explainable discovery
Phase contract
Status: Not started.
Scope: Materialize existing-source signals and expose reproducible discovery groups.
Dependencies: Phases 1–4.
Affected systems: Projection/Yahoo/roster read paths, discovery tables/services/UI.
Database/API/UI: Snapshot/materialized signals, discovery endpoint, actionable cards.
Acceptance/tests: Every result has source, freshness, threshold, and reason.
Security/observability: No modification to upstream ingestion without separate approval.
Migration/rollback: Derived data rebuildable; source tables untouched.
Feature flag: DRAFT_RANKER_DISCOVERY_ENABLED.
Approval checkpoint: Approval required for conflicting Yahoo/projection ingestion changes.
Non-goals: News NLP or comprehensive role ML.
DR-050 — Audit and freeze discovery source contracts
Status/Scope: Not started; validate current projection, ownership, roster, contract, deployment, and performance freshness.
Dependencies/Affected: Phase 4; projection config and source-health scripts.
DB/API/UI: Read-only source contract; no UI.
Acceptance/Tests: Each launch signal has an exact source, season rule, refresh SLA, and null behavior.
Security/Observability: Source-health reporting.
Migration/Rollback/Flag/Approval: No source mutation; escalate conflicts.
Non-goals: Repairing every upstream source.
DR-051 — Materialize reproducible discovery signals
Status/Scope: Not started; projection gap, previously undrafted, cutoff challenger, ownership riser, and opportunity change.
Dependencies/Affected: DR-050; discovery migration/job/service.
DB/API/UI: Derived signal table/view and audited refresh route.
Acceptance/Tests: Threshold fixtures reproduce expected membership; expired/stale signals disappear.
Security/Observability: Service-only refresh; per-group counts, freshness, failures.
Migration/Rollback/Flag/Approval: Rebuildable tables; stop cron and clear derived rows if rolled back.
Non-goals: Editorial claims without stored evidence.
DR-052 — Build discovery UI and actions
Status/Scope: Not started; reason cards with compare/watch/dismiss/not-relevant.
Dependencies/Affected: DR-031, DR-051; DraftRanker discovery components.
DB/API/UI: Discovery endpoint/action writes.
Acceptance/Tests: Correct reason, source, freshness, and action persistence; empty/stale states.
Security/Observability: Owner-specific ranking context stays private.
Migration/Rollback/Flag/Approval: Feature controlled.
Non-goals: Infinite player directory.
Phase 6 — Community Ranking v1
Phase contract
Status: Not started.
Scope: Approved regularized Bradley–Terry model, snapshots, public evidence states, and abuse validation.
Dependencies: Consent/comparison infrastructure and adequate identity quality.
Affected systems: Community model library/job, aggregate tables, public API/page.
Database/API/UI: Service-only computation; aggregate-only public results.
Acceptance/tests: Seeded, emerging, and established states are distinguishable; undrafted entrants can qualify.
Security/observability: No user-level public data; rebuild after opt-out/deletion.
Migration/rollback: Model/version snapshots preserved; public flag can disable output.
Feature flag: COMMUNITY_DRAFT_RANKINGS_ENABLED.
Approval checkpoint: Algorithm already approved; methodology-change approval required later.
Non-goals: Mature Bayesian or segmented ranking.
DR-060 — Implement and validate Community v1 offline
Status/Scope: Not started; regularized BT, decaying market prior, dedupe, evidence tiers, and admission rules.
Dependencies/Affected: DR-040, DR-043; model library and reproducible fixtures.
DB/API/UI: Offline computation only.
Acceptance/Tests: Opponent-strength fixtures beat raw wins; prior decays; undrafted neutral prior works; one user cannot duplicate a pair.
Security/Observability: Inputs are consent-filtered and pseudonymous within the job.
Migration/Rollback/Flag/Approval: Model version pinned; no public output yet.
Non-goals: Precise confidence-interval claims.
DR-061 — Add community snapshots and audited refresh
Status/Scope: Not started; aggregate result/evidence/snapshot tables and scheduled refresh.
Dependencies/Affected: DR-060; migration, cron route, `web/vercel.json`, audit wrapper.
DB/API/UI: Service-only aggregate writes; public-safe reads.
Acceptance/Tests: Idempotent rebuild, deletion/opt-out rebuild, daily/weekly schedule rules, methodology version.
Security/Observability: Aggregate thresholds; cron audit with counts/duration/failure.
Migration/Rollback/Flag/Approval: Stop schedule and disable public flag; retain snapshots.
Non-goals: Realtime model update per click.
DR-062 — Build the Community Rankings page
Status/Scope: Not started; public table, evidence state, confidence, personal delta for signed-in users, and player details.
Dependencies/Affected: DR-061; /community-draft-rankings, API/components.
DB/API/UI: Aggregate API only; market-seeded/building/emerging/established labels.
Acceptance/Tests: No false community claims; undrafted state correct; signed-out/private behavior safe.
Security/Observability: Minimum cohorts and no user histories.
Migration/Rollback/Flag/Approval: Public flag controlled.
Non-goals: Expert weights or league segments.
DR-063 — Perform community red-team and calibration gate
Status/Scope: Not started; synthetic manipulation, sparse graph, deletion, burst, and cutoff testing.
Dependencies/Affected: DR-060–062; scripts/tests/runbook.
DB/API/UI: No new user feature.
Acceptance/Tests: Admission thresholds resist documented attacks; output remains labeled honestly with low evidence.
Security/Observability: Moderation and exclusion logs verified.
Migration/Rollback/Flag/Approval: Broad release blocked until gate passes.
Non-goals: Claiming universal fantasy consensus.
Phase 7 — Exports, operations, and rollout
Phase contract
Status: Not started.
Scope: CSV/JSON, repair tooling, monitoring, security hardening, staged rollout, and end-to-end launch verification.
Dependencies: Phases 1–6.
Affected systems: Export routes, admin tools, health scripts, flags, runbooks, tests.
Database/API/UI: Export APIs, repair/admin APIs, health summaries.
Acceptance/tests: Recoverable operations and verified production-like user journeys.
Security/observability: Advisor review, rate limits, audit coverage, deletion drill.
Migration/rollback: Kill switches and non-destructive rollback runbook.
Feature flag: All ranker flags staged independently.
Approval checkpoint: Production rollout approval.
Non-goals: Phase-8 mature features.
DR-070 — Implement versioned CSV and JSON exports
Status/Scope: Not started; schemas approved in DRD-012.
Dependencies/Affected: Phases 2–6; export library/API/UI.
DB/API/UI: Read-only owner export endpoints; include-candidates/watchlist options.
Acceptance/Tests: Stable column order, escaping, schema metadata, ADP tri-state, round-trip JSON fixtures.
Security/Observability: Authenticated owner only; rate-limited; no comparison evidence by default.
Migration/Rollback/Flag/Approval: No schema migration; flag controlled.
Non-goals: XLSX.
DR-071 — Add repair, identity-quality, and health tooling
Status/Scope: Not started; dry-run checks, normalization, orphan review, aggregate rebuild, and admin controls.
Dependencies/Affected: All prior phases; scripts/admin APIs/runbooks.
DB/API/UI: Admin-only repair functions and status dashboard.
Acceptance/Tests: Corruption fixtures detected; repairs are deterministic, audited, and idempotent.
Security/Observability: Admin/service-only; before/after counts and actor/reason.
Migration/Rollback/Flag/Approval: Destructive repair requires explicit confirmation and backup.
Non-goals: Unreviewed automatic identity merges.
DR-072 — Execute staged backfill and rollout
Status/Scope: Not started; staff, allowlisted beta, wider authenticated beta, public aggregate.
Dependencies/Affected: DR-063, DR-071; entitlements/flags, operational dashboard.
DB/API/UI: Feature availability only.
Acceptance/Tests: Each cohort meets error, integrity, latency, and support thresholds before expansion.
Security/Observability: Advisor and Postgres patch status reviewed; abuse and deletion metrics monitored.
Migration/Rollback/Flag/Approval: Immediate kill switches; production rollout approval required.
Non-goals: Automatic universal enablement.
DR-073 — Complete launch QA and rollback drill
Status/Scope: Not started; full account journey, visual verification, performance, accessibility, and recovery.
Dependencies/Affected: DR-070–072; Vitest, Playwright, build, runbooks.
DB/API/UI: No additional features.
Acceptance/Tests: Sign in → initialize → reorder → search prospect → place → homepage compare → export → opt out/delete test; build and targeted suites pass.
Security/Observability: Verify no cross-user access, private comparison leaks, or unaudited privileged jobs.
Migration/Rollback/Flag/Approval: Demonstrate flag disable and job stop without data loss.
Non-goals: Deferred mature capabilities.
Phase 8 — Deferred mature-product capabilities
Phase contract
Status: Deferred.
Scope: Expand after launch evidence and product validation.
Dependencies: Successful Phase 7.
Affected systems: Ranking versions, models, prospect sources, exports, discovery.
Database/API/UI: Future, separately designed.
Acceptance/tests: Each item requires its own PRD/decision update.
Security/observability: Preserve launch privacy and identity invariants.
Migration/rollback: Separate reviewed migrations.
Feature flag: Separate experiments.
Approval checkpoint: Required for algorithm changes, paid sources, or major homepage changes.
Non-goals: Treating deferred work as launch scope.
DR-080 — Multiple named and league-specific rankings
Status: Deferred.
Scope: Copy, archive, reset, named rankings, keeper/dynasty variants, Yahoo-league setting imports.
Dependencies: Phase 7.
Affected: Ranking-set APIs and selector UI.
DB/API/UI: Existing schema activated rather than replaced.
Acceptance/Tests: No cross-ranking evidence contamination.
Security/Observability: Same owner boundaries.
Migration/Rollback/Flag/Approval: Product approval before exposure.
Non-goals: Automatic silent conversion.
DR-081 — Mature community and adaptive models
Status: Deferred.
Scope: Bayesian uncertainty, time decay, segments, user reliability, information-gain queues.
Dependencies: Sufficient evidence volume.
Affected: Model/queue versions and methodology UI.
DB/API/UI: Versioned replacements with historical comparability.
Acceptance/Tests: Offline evaluation must outperform v1 without harming manipulation resistance.
Security/Observability: Bias/fairness and abuse monitoring.
Migration/Rollback/Flag/Approval: Explicit algorithm approval required.
Non-goals: Updating public behavior without methodology disclosure.
DR-082 — Expanded prospect and editorial infrastructure
Status: Deferred.
Scope: Official/licensed prospect feeds, editorial verification, camp/news role workflows.
Dependencies: Licensing and identity-quality review.
Affected: Identity ingestion and review tools.
DB/API/UI: Provider mappings, provenance, editorial queues.
Acceptance/Tests: Terms approved; match precision and rollback demonstrated.
Security/Observability: Provenance and review audit.
Migration/Rollback/Flag/Approval: Paid/restricted sources require explicit approval.
Non-goals: Scraping or storing data without verified rights.
DR-083 — XLSX and advanced exports/discovery
Status: Deferred.
Scope: Multi-sheet XLSX, richer history, role/news/ML discovery, tiers and bulk edits.
Dependencies: Launch validation.
Affected: Export/UI dependencies and discovery models.
DB/API/UI: New formats and optional tools.
Acceptance/Tests: Workbook compatibility and explainable model validation.
Security/Observability: Same export privacy boundaries.
Migration/Rollback/Flag/Approval: Separate scope review.
Non-goals: Blocking launch CSV/JSON.

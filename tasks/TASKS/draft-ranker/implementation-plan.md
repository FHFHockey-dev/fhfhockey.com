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
Acceptance/Tests: A rollback-only live probe seeded 313 players and completed 100 randomized atomic moves; validation after every move preserved a unique 313-player total order. All 100 reorder events contained expected/resulting versions, before/after state, operation hashes, and result payloads. Fifty focused automated tests pass. Chrome confirms the real signed-out and authenticated routes render cleanly at desktop and 390x844 mobile widths. A real account-backed board initialized 313 players, persisted edits through reload and sign-out/sign-in, corrected displaced numeric-input state, promoted rank 251 to 250, displaced the prior rank 250 to 251, and preserved the 250/63 split. Five repository-wide baseline errors outside Draft Ranker were present at this checkpoint; they were resolved during DR-073, and the final TypeScript/build gate passes.
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
Acceptance/Tests: Exact, prefix, alias, external-ID, and fuzzy search are bounded to 25 results; default results are verified `active_nhl`, `active_prospect`, and `unsigned_relevant` identities, while archived identities require the explicit filter and are non-rankable. Duplicate Elias Pettersson identities remain separately disambiguated. Prospect/organization/lifecycle/Yahoo labels, headshots, and fallbacks render. Seven focused suites pass 33/33 tests. Draft Ranker added no TypeScript errors at this checkpoint; the five unrelated baseline errors then present were resolved during DR-073. The real signed-out route was rechecked in Chrome; authenticated visual interaction was intentionally deferred to the consolidated Phase 3 verification so no additional temporary account was created for a single task.
Security/Observability: Both RPCs are SECURITY INVOKER and executable only by `service_role`; API ownership comes from `requireApiUser`. Addition requests validate context/candidate IDs, deduplicate per user and normalized name, serialize with an advisory transaction lock, and cap each user at five requests per 24 hours with `Retry-After`. A live service-role probe was rolled back with zero residue. Post-apply security advisors contain no target findings; the two new trigram indexes only have expected pre-traffic unused-index informational notices. A cold live exact-name search completed in approximately 154 ms.
Migration/Rollback/Flag/Approval: The migration was rehearsed transactionally before apply and its service-role execution was probed transactionally after apply. The two indexes and functions are additive/removable; editorial requests remain retained if the feature is disabled. The Phase 3 inclusion/request-workflow checkpoint was approved. Production `DRAFT_RANKER_ENABLED` remains off.
Non-goals: Free-form identities.
DR-031 — Implement watchlist and candidate actions
Status/Scope: Completed 2026-07-14; watch/unwatch, dismiss, not-relevant, restore, and persisted compare-now intent are owner-backed. The compare-now UI is intentionally withheld until DR-032 can start a real placement session.
Dependencies/Affected: DR-030; watchlist APIs/hooks/components.
DB/API/UI: Reused `draft_ranking_watchlist`; applied `20260715025809_add_draft_ranker_player_actions` for separate disposition/compare-intent state and service-only transactional actions, plus `20260715030450_add_draft_ranker_player_preference_fk_index`. Added owner-scoped GET/POST `/api/v1/draft-ranker/watchlist`, typed server/hook contracts, search-result controls, and a visible unplaced watchlist panel.
Acceptance/Tests: Watchlist membership remains independent of continuous ranking entries, dismiss/not-relevant remove watch state without deleting ranking evidence, restore clears discovery preference, and every action has an idempotent operation event. A full live rollback rehearsal passed watch, replay, dismiss, restore, compare intent, and cross-owner hiding. Nine focused suites pass 45/45 tests; Draft Ranker added no TypeScript errors, and the five unrelated baseline errors then present were resolved during DR-073.
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
Status: Complete; DR-040 through DR-043 are implemented, verified, and dark-launched behind disabled server flags.
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
Status/Scope: Complete; versioned top-down personal review, twenty-slot policy, cooldowns, diversity, and why-selected explanations.
Dependencies/Affected: DR-031–040; queue library/API.
DB/API/UI: Prompt queue response includes reason and mode.
Acceptance/Tests: A fresh personal queue starts with ranks 1 and 2 (the first two Yahoo-ADP-seeded players), advances top-down after each reviewed or skipped adjacent pair, and preserves the existing mix, repetition, cutoff, position-diversity, and quick-five policies in deterministic fixtures.
Security/Observability: Server selects eligible prompts; queue diagnostics aggregate only.
Migration/Rollback/Flag/Approval: Algorithm versioned; roll back to prior queue version.
Non-goals: Bandits or learned personalization.
DR-042 — Add homepage pairwise card and preview
Status/Scope: Complete; contained homepage module with blind default, expandable evidence, six modes, and responsive ten-player preview.
Dependencies/Affected: DR-041; [index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/index.tsx) and existing homepage module/styles.
DB/API/UI: Queue/comparison calls; ten-player animated list and account prompts.
Acceptance/Tests: A real flagged server passed signed-out and isolated signed-in desktop/390×844 Chrome verification. The module occupies one card, mobile has no horizontal overflow, and one saved choice moved Tony DeAngelo from No. 250 to No. 249, displaced Dylan Cozens to No. 250, refilled the next matchup and ten-row window, and persisted both order and the reviewed bookmark after reload. Automated component coverage remains green.
Security/Observability: Signed-in ownership; signed-out state does not create anonymous records.
Migration/Rollback/Flag/Approval: Separate kill switch; visual approval before broad rollout.
Non-goals: Rebuilding unrelated homepage sections.
DR-043 — Add abuse and rate controls
Status/Scope: Complete; distributed queue/response limits, burst checks, repeated-pair moderation, stable retry metadata, and community-only suppression.
Dependencies/Affected: DR-040–042; database/platform limiter, API middleware, admin diagnostics.
DB/API/UI: Applied `20260715051533_add_draft_ranker_pairwise_rate_controls`; guarded issue/response RPCs return stable 429/Retry-After metadata, while soft decisions retain personal comparison effects and suppress only community eligibility.
Acceptance/Tests: Exact-migration rollback rehearsal and post-apply probe verify advisory-lock serialization, payload conflicts, replay without double-counting, hard queue/response limits, disabled-collection suppression, automated-burst suppression, repeated-pair targeting, and personal-preference preservation. The current focused/homepage regression pass is 179/179 across 39 files and TypeScript passes.
Security/Observability: The service-only operational table stores moderation reason codes and window counts but no IP address, user agent, auth header, or request secret. RLS and a restrictive deny policy block browser access; three fixed-search-path SECURITY INVOKER functions are service-role only. Target security advisors are clear.
Migration/Rollback/Flag/Approval: Six threshold environment variables are bounded with reviewed defaults. `DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED` is a separate false-by-default emergency switch; the ranker and homepage flags also remain off. Rollback removes only wrappers, limiter, and empty/operational rate history, preserving prompts, comparisons, preferences, and personal order.
Non-goals: Mature fraud-scoring model.
Phase 5 — Explainable discovery
Phase contract
Status: Complete and dark-launched; production source health currently yields an honest empty state because no current-season projection source is available.
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
Status/Scope: Complete; the exact launch inputs, season rules, freshness windows, null behavior, and ownership boundaries are frozen in [discovery-source-contract.md](./discovery-source-contract.md).
Dependencies/Affected: Phase 4; projection config and source-health scripts.
DB/API/UI: Read-only source contract; no UI.
Acceptance/Tests: Each launch signal has an exact source, season rule, refresh SLA, null behavior, reproducible reason code, and prohibited-claim rule. The audit identified a real projection-season mismatch and did not mutate upstream ingestion.
Security/Observability: Source-health reporting.
Migration/Rollback/Flag/Approval: No source mutation; escalate conflicts.
Non-goals: Repairing every upstream source.
DR-051 — Materialize reproducible discovery signals
Status/Scope: Complete; projection gap, previously undrafted, cutoff challenger, ownership riser, and opportunity-change evidence are materialized only when their frozen source rules pass.
Dependencies/Affected: DR-050; discovery migration/job/service.
DB/API/UI: Applied `20260715055259_create_draft_ranker_discovery_materialization` and `20260715055404_add_draft_ranker_discovery_foreign_key_indexes`; the service-only audited refresh route writes rebuildable snapshots, source health, and signals.
Acceptance/Tests: Deterministic fixtures cover thresholds, ordering, expiry, and source mismatch. The first live refresh (`71d1f4a3-4884-4e00-8cd5-ffad73de1789`) inspected 15 real sources and correctly published zero signals rather than relabeling stale projections.
Security/Observability: Service-only refresh; per-group counts, freshness, failures.
Migration/Rollback/Flag/Approval: Rebuildable tables; stop cron and clear derived rows if rolled back.
Non-goals: Editorial claims without stored evidence.
DR-052 — Build discovery UI and actions
Status/Scope: Complete; owner-specific reason cards support compare, watch, dismiss, and not-relevant actions, with a transparent unavailable/empty state.
Dependencies/Affected: DR-031, DR-051; DraftRanker discovery components.
DB/API/UI: Discovery endpoint/action writes.
Acceptance/Tests: Component, API, server, and live-SSR checks verify source/freshness wording, action persistence, owner context, empty/stale behavior, and no invented recommendations. DR-073 subsequently completed the fresh responsive browser verification.
Security/Observability: Owner-specific ranking context stays private.
Migration/Rollback/Flag/Approval: Feature controlled.
Non-goals: Infinite player directory.
Phase 6 — Community Ranking v1
Phase contract
Status: Implementation and calibration complete; aggregate publication remains dark-launched behind its independent production flag.
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
Status/Scope: Complete; `regularized-bradley-terry-v1` implements the approved market prior, per-user/pair dedupe, consent/moderation eligibility, evidence states, and admission rules.
Dependencies/Affected: DR-040, DR-043; model library and reproducible fixtures.
DB/API/UI: Offline computation only.
Acceptance/Tests: Deterministic tests verify opponent strength, prior decay, neutral previously-undrafted entrants, one preference per user/pair, evidence thresholds, and cutoff admission.
Security/Observability: Inputs are consent-filtered and pseudonymous within the job.
Migration/Rollback/Flag/Approval: Model version pinned; no public output yet.
Non-goals: Precise confidence-interval claims.
DR-061 — Add community snapshots and audited refresh
Status/Scope: Complete; service-only immutable aggregate snapshots and the audited scheduled refresh are live.
Dependencies/Affected: DR-060; migration, cron route, `web/vercel.json`, audit wrapper.
DB/API/UI: Applied `20260715061931_create_draft_ranker_community_snapshots` and `20260715062048_add_draft_ranker_community_foreign_key_indexes`; the 12:15 UTC job writes public-safe aggregate rows only.
Acceptance/Tests: Idempotent rebuild, consent withdrawal/deletion rebuild, daily/weekly cadence, and model-version tests pass. Live snapshot `2dfdff1e-718c-4fec-946f-fd89f48f2a88` contains 1,148 real players, 313 displayable market seeds, and 835 neutral previously-undrafted candidates with zero comparisons honestly labeled as market-seeded.
Security/Observability: Aggregate thresholds; cron audit with counts/duration/failure.
Migration/Rollback/Flag/Approval: Stop schedule and disable public flag; retain snapshots.
Non-goals: Realtime model update per click.
DR-062 — Build the Community Rankings page
Status/Scope: Complete in code and live-data verification; the public table exposes evidence state and confidence, with an owner-only personal delta when signed in.
Dependencies/Affected: DR-061; /community-draft-rankings, API/components.
DB/API/UI: Aggregate API only; market-seeded/building/emerging/established labels.
Acceptance/Tests: Component/API tests and a live signed-out response verify 250 distinct ranks, real identity/headshot/ADP data, honest market-seeded wording, previously-undrafted state, optional owner context, and no user identifiers. DR-073 subsequently completed fresh desktop and 430×932 mobile browser verification.
Security/Observability: Minimum cohorts and no user histories.
Migration/Rollback/Flag/Approval: Public flag controlled.
Non-goals: Expert weights or league segments.
DR-063 — Perform community red-team and calibration gate
Status/Scope: Complete; synthetic manipulation, sparse graph, consent removal, burst, cutoff, and coordinated-cohort cases are recorded in tests and [community-ranking-runbook.md](./community-ranking-runbook.md).
Dependencies/Affected: DR-060–062; scripts/tests/runbook.
DB/API/UI: No new user feature.
Acceptance/Tests: Six red-team tests verify duplicate floods collapse, sparse graphs remain unestablished, consent withdrawal rebuilds cleanly, burst evidence is excluded, cutoff admission needs both sides, and moderated cohorts are removed. The runbook discloses the residual distinct-coordinated-account risk.
Security/Observability: Moderation and exclusion logs verified.
Migration/Rollback/Flag/Approval: Broad release blocked until gate passes.
Non-goals: Claiming universal fantasy consensus.
Phase 7 — Exports, operations, and rollout
Phase contract
Status: Implementation, local launch QA, reviewed production deployment, flag-off smoke, and staff-stage activation are complete; the staff real-traffic observation gate is active and broader cohort gates remain open.
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
Status/Scope: Complete; schema `fhfh-draft-ranking-v1` implements the DRD-012 CSV and JSON contracts.
Dependencies/Affected: Phases 2–6; export library/API/UI.
DB/API/UI: The read-only owner endpoint and ranking-page UI support CSV/JSON plus explicit candidate, watchlist, and event-summary options.
Acceptance/Tests: Unit/API/UI tests verify stable columns, escaping, metadata, ADP evidence state, authentication, privacy wording, and downloads. A live disposable-account export contained 250 top ranks, 64 candidates, one watchlist row, and 13 event summaries with no private comparison evidence.
Security/Observability: Authenticated owner only; rate-limited; no comparison evidence by default.
Migration/Rollback/Flag/Approval: No schema migration; flag controlled.
Non-goals: XLSX.
DR-071 — Add repair, identity-quality, and health tooling
Status/Scope: Complete; read-only health, deterministic ordering normalization, identity-review queuing, aggregate dry-run rebuild, and exact-confirmation admin controls are implemented.
Dependencies/Affected: All prior phases; scripts/admin APIs/runbooks.
DB/API/UI: Applied `20260715070405_add_draft_ranker_ordering_repair`; the admin-only audited endpoint and daily 12:45 UTC cron report aggregate health without user identifiers.
Acceptance/Tests: Rollback-only and post-apply probes verify advisory locking, expected-version conflicts, deterministic `row_number * 1024` repair, immutable before/after audit, no-op replay, and operation-payload conflict. Health counts use exact head queries so high-volume rate windows are not truncated.
Security/Observability: Admin/service-only; before/after counts and actor/reason.
Migration/Rollback/Flag/Approval: Destructive repair requires explicit confirmation and backup.
Non-goals: Unreviewed automatic identity merges.
DR-072 — Execute staged backfill and rollout
Status/Scope: In progress. Release infrastructure, product-owner staff-stage approval, and the explicitly approved homepage-only observation waiver are complete. PR [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335) merged as `722f1dff02b7a4b9486836b386c0b576f57c5cfd`; homepage PR [#338](https://github.com/FHFHockey-dev/fhfhockey.com/pull/338) merged as `3685ce1ef87bf96bbad6f2fc307a971220428615`; top-of-board queue PR [#342](https://github.com/FHFHockey-dev/fhfhockey.com/pull/342) merged as `1302ad84c34d87ae0c96999f2b83c4dcc6a0f421`; timestamp hydration PR [#343](https://github.com/FHFHockey-dev/fhfhockey.com/pull/343) merged as `e5bd6c83876cb6bedc981fed3bf3e0ad4e67eded`; and durable cron-audit PR [#347](https://github.com/FHFHockey-dev/fhfhockey.com/pull/347) merged as `7d5508860a5808580acfdd1caacc288bfe953bae`. Exact READY merge preview `dpl_HNrP6zSGj6AA8NGMcwb6H4hYzh3F` is promoted as current READY production deployment `dpl_3rviF6Zfuyk9s2MqjC7myNGKA6i9`. Exactly three verified Supabase admin accounts are entitled through a sensitive server-only allowlist whose count and fingerprint are recorded in [launch-runbook.md](./launch-runbook.md). The homepage module is enabled under the narrow waiver; discovery, contribution collection, public Community Ranking, beta entitlement, and wider authenticated entitlement remain off. Tim Branson is the named operator, support owner, and rollback owner. The product owner's reset was proven clean before they explicitly initialized a new board; their counts-only production checkpoint now provides the first eligible genuine journey with 42 decisive responses, lock version 23, 313 entries, and zero observed entry/comparison ownership mismatches. The July 16 health route returned HTTP 200 on schedule; after the silent audit-persistence path was removed, a production replay persisted a successful 385 ms audit row with zero ordering, seed, placement, ownership, error-log, or 5xx blockers. The honest staff volume is `1/50` under the current approved runbook. The product owner has questioned whether 50 journeys are attainable; a lower-volume criteria-led gate is recommended but remains pending explicit approval. Immediate prior production deployment `dpl_5LADmdbVfdJEzKubKkpR7Yr7zxzk`, prior Draft Ranker deployment `dpl_JDS7NpzpHgJa56ppWGQYoAcN7n8H`, and older retained deployment `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH` remain rollback candidates.
Dependencies/Affected: DR-063, DR-071, and the clean release boundary in [release-manifest.md](./release-manifest.md); entitlements/flags, operational dashboard.
DB/API/UI: Feature availability only.
Acceptance/Tests: Before staff exposure, a reviewed goal-scoped artifact had a READY production deployment, the feature routes were available with every flag off, and a production smoke test confirmed the closed state. Staff activation preserves anonymous denial, keeps the public aggregate disabled, visually confirms an allowlisted production sign-in, and produces no post-smoke runtime error cluster. The separately approved homepage waiver exposes only the account-backed homepage module; its live countdown, one-news/League Separation layout, anonymous gate, and hydration-safe rendering pass visual, API, console, and deployment-log checks. Every personal API enforces the server-side `off`/`staff`/`allowlist`/`authenticated` policy, missing or invalid values fail closed, and aggregate health reports only allowlist counts. The required cohort sizes, durations, latency, support, and integrity gates are frozen in [launch-runbook.md](./launch-runbook.md) and cannot honestly be simulated as completed production observation.
Security/Observability: Advisor and Postgres patch status reviewed; raw staff UUIDs exist only in sensitive Vercel production configuration; source records only cohort count and a one-way fingerprint. Abuse, deletion, owner isolation, health, latency, and unexpected 5xx metrics remain under observation.
Migration/Rollback/Flag/Approval: Immediate kill switches; product-owner staff-stage approval and the homepage-only waiver are recorded and consumed. The beta allowlist and all non-homepage secondary flags remain off. Disable `DRAFT_RANKER_HOMEPAGE_ENABLED` first for a homepage-only incident; roll back broader personal access by setting stage `off` and disabling the master flag. Retain `dpl_JDS7NpzpHgJa56ppWGQYoAcN7n8H` as the immediate prior artifact and `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH` as the older known-good fallback. Any broader cohort or secondary-flag expansion requires the staff evidence gate and its next recorded approval checkpoint.
Non-goals: Automatic universal enablement.
DR-073 — Complete launch QA and rollback drill
Status/Scope: Complete 2026-07-15; local launch QA, responsive Community/export verification, mobile overflow repair, and live recovery drills pass. Production cohort performance observation remains tracked by DR-072 and is not simulated by this task.
Dependencies/Affected: DR-070–072; Vitest, Playwright, build, runbooks.
DB/API/UI: No additional features.
Acceptance/Tests: A live disposable account passed sign in → initialize 313 players → persisted reorder → real prospect search/watch → assisted placement → consent/prompt comparison → private export → community owner delta → opt-out rebuild → account deletion with zero residue. A second disposable visual account verified the real 313-player board and export surface, then was deleted with zero Auth or account-owned residue. The focused suite passes 228/228 across 49 files, the affected WIGO regression suites pass 18/18, full TypeScript passes, and `npm run build` completes all 83 static pages plus sitemap generation. Community Ranking and personal export surfaces pass desktop and iPhone 14 Pro Max (430×932) inspection with accessible labels and real data. The mobile document is exactly 430 pixels wide while the 1,050-pixel board remains independently scrollable inside its 428-pixel table viewport.
Security/Observability: Verify no cross-user access, private comparison leaks, or unaudited privileged jobs.
Migration/Rollback/Flag/Approval: Local all-flags-on verification ended with the server stopped; deployed flags remain off. Flag disablement, dry-run rebuild, deletion, and zero-residue recovery were demonstrated without data loss. Production expansion still requires the recorded approval checklist, named owners and cohort IDs, real traffic, and the required observation windows.
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

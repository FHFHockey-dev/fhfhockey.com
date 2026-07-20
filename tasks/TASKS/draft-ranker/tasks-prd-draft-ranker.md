## Relevant Files

- `tasks/TASKS/draft-ranker/prd-draft-ranker.md` — Canonical reconciled PRD for the initiative.
- `tasks/TASKS/draft-ranker/product-strategy.md` — Authoritative product strategy and detailed UX/evidence model.
- `tasks/TASKS/draft-ranker/goal-prompt.md` — Original execution contract and required process.
- `tasks/TASKS/draft-ranker/repository-audit.md` — Canonical repository/schema/implementation audit; `repository-record.md` is a historical noncanonical duplicate retained only as supporting evidence.
- `tasks/TASKS/draft-ranker/decision-record.md` — Approved decisions DRD-001 through DRD-013.
- `tasks/TASKS/draft-ranker/execution-boundary.md` — Dirty-tree, migration-root, security, and execution isolation contract.
- `tasks/TASKS/draft-ranker/technical-contract.md` — Frozen schema/API/RLS/RPC/identity/rollout contract.
- `tasks/TASKS/draft-ranker/implementation-plan.md` — Detailed per-task dependencies, affected systems, acceptance tests, rollback, flags, and non-goals.
- `tasks/TASKS/draft-ranker/progress.md` — Current persistent status and exact next action.
- `tasks/TASKS/draft-ranker/launch-runbook.md` — Cohort gates, flags, health interpretation, repair controls, deletion drill, and rollback.
- `tasks/TASKS/draft-ranker/release-manifest.md` — Reviewed release boundary and production artifact evidence.
- `tasks/TASKS/draft-ranker/community-ranking-runbook.md` — Community model, privacy, calibration, moderation, and residual-risk operations.
- `tasks/TASKS/draft-ranker/discovery-source-contract.md` — Frozen discovery inputs, freshness, thresholds, and prohibited claims.
- `tasks/TASKS/draft-ranker/dr-010-migration-review.md`, `dr-011-yahoo-mapping-review.md`, and `dr-012-migration-review.md` — Migration and identity evidence.
- `web/lib/draft-ranker/`, `web/pages/api/v1/draft-ranker/`, `web/components/DraftRanker/`, and focused tests — Core implementation and regression ownership.
- `web/.env.development.local` — Ignored localhost-only master/stage override used to expose the authenticated personal ranker in development; never committed or promoted.
- `supabase/migrations/` Draft Ranker migrations — Additive identity, ownership, ordering, search, placement, comparison, discovery, community, and repair schema.

### Notes

- This checklist preserves the stable DR task IDs from `implementation-plan.md`; that file retains the detailed dependencies, files/systems, acceptance tests, security, migration/rollback, flag, approval, and non-goal fields for every row.
- Checked historical rows are evidence-backed implementation claims, not a substitute for the required dynamic Wave-C audit.
- DR-072 and the approved Phase-7 launch scope are complete. The aggregate-only final review passed, and the recorded authorization changed only the personal-ranker stage from `staff` to `authenticated`; beta entitlement and every non-homepage secondary/public flag remain closed.
- Phase 8 remains explicitly deferred and unchecked under `B-DRAFT-RANKER-P8`; no deferred capability was required for launch completion.

## Tasks

### Phase 0 — Audit closure and approved decisions

- [x] 0.0 Complete the repository audit, execution boundary, approved decisions, frozen contracts, and canonical planning controls.
  - [x] DR-001 Persist and review the planning package, stable task IDs, approvals, and durable progress record.
  - [x] DR-002 Establish the clean execution boundary, preserve unrelated work, and confirm canonical migration ownership and baseline drift.
  - [x] DR-003 Freeze schema, API, ownership, RLS/RPC, idempotency, deletion, feature-flag, threat-model, and verification contracts.
  - [x] NEW DR-074 Repair the super-goal's P1 Draft Ranker inventory omission by creating this canonical PRD/task-list pair, inventorying all initiative artifacts, importing every source checkbox, and adding the active initiative to Wave A and the final summary (completed 2026-07-18).
  - [x] NEW DR-075 Reconcile source-control drift without changing product behavior: mark Phase 2 complete, make the progress record title current, distinguish the historical repository-record duplicate from the canonical audit, and preserve DR-072/Phase-8 boundaries (completed 2026-07-18).
  - [x] NEW DR-076 Re-prove authoritative publication provenance after local history reconciliation. GitHub reports PR #335 merged at `722f1dff02b7a4b9486836b386c0b576f57c5cfd`; comparison against current `octoberBranch` reports that merge as the exact merge base with the branch 45 commits ahead and zero behind, so the reviewed release remains durable on the authoritative branch (verified read-only 2026-07-18).
  - [x] NEW DR-077 Reconcile stale shared-worktree copies against the newer clean checkpoint evidence before committing the canonical pair: restore the approved homepage waiver, top-of-board queue, deterministic timestamp, durable cron-audit, low-traffic exception, current production deployment, and exact DR-072 next gate without reverting any newer release evidence (completed 2026-07-18).

### Phase 1 — Identity and account-backed ranking foundation

- [x] 1.0 Complete the canonical identity and account-owned ranking foundation.
  - [x] DR-010 Create and verify the additive FHFH canonical identity registry, external mappings, aliases/history, lifecycle, and review workflow.
  - [x] DR-011 Backfill canonical NHL identities and reconcile Yahoo mappings without auto-promoting ambiguous matches; retain unresolved review items.
  - [x] DR-012 Create and verify owner-scoped ranking/evidence tables, constraints, indexes, cascades, raw-write denial, and RLS.
  - [x] DR-013 Add authenticated Draft Ranker API conventions with strict server flags, owner-safe reads, stable errors, validation, and retry fingerprints.

### Phase 2 — Seed, continuous ordering, and direct editing

- [x] 2.0 Complete verified initialization, continuous ordering, direct editing, and integrity behavior.
  - [x] DR-020 Implement idempotent prior-season verified Yahoo ADP initialization with approved fallback, complete continuous order, provenance, and replay protection.
  - [x] DR-021 Implement atomic sparse reordering, insert/remove/cutoff displacement, normalization, idempotency, and optimistic conflicts.
  - [x] DR-022 Build the responsive account-backed personal ranking page with top-250/candidate views, direct editing, pagination, and resilient states.
  - [x] DR-023 Verify 250/251 behavior, total-order/event integrity, owner isolation, session persistence, responsive UI, and zero-residue account cleanup.

### Phase 3 — Search, watchlist, and assisted placement

- [x] 3.0 Complete canonical search, candidate actions, and deterministic assisted placement.
  - [x] DR-030 Build canonical real-player search and editorial addition requests with disambiguation, lifecycle filters, dedupe, and rate limits.
  - [x] DR-031 Implement owner-backed watchlist and candidate actions without deleting or conflating ranking evidence.
  - [x] DR-032 Implement the deterministic server-owned placement engine, persisted sessions, bounded outcomes, and atomic confirmation.
  - [x] DR-033 Build and verify the assisted-placement/resume UI, stale-board recovery, single-active-session invariant, and real prospect placement.

### Phase 4 — Homepage pairwise experience and adaptive queue

- [x] 4.0 Complete consented pairwise collection, deterministic queueing, homepage integration, and abuse controls.
  - [x] DR-040 Implement versioned contribution consent, canonical prompt issuance, immutable outcomes, reversals, withdrawal, and personal-order alignment.
  - [x] DR-041 Implement the deterministic adaptive matchup queue with cooldown, diversity, cutoff coverage, and explainable reason codes.
  - [x] DR-042 Add the independently flagged, blind-by-default homepage pairwise card and responsive ten-player preview without redesigning the homepage.
  - [x] DR-043 Add distributed rate/burst/repeated-pair controls that suppress only community eligibility and preserve personal preference.

### Phase 5 — Explainable discovery

- [x] 5.0 Complete explainable discovery contracts, materialization, and owner UI.
  - [x] DR-050 Audit and freeze discovery source, season, freshness, null, ownership, and prohibited-claim contracts.
  - [x] DR-051 Materialize reproducible discovery signals only when their frozen source rules pass; retain an honest zero-result state when inputs do not qualify.
  - [x] DR-052 Build owner-specific discovery cards/actions with source/freshness/reason wording and truthful unavailable, empty, stale, and error states.

### Phase 6 — Community Ranking v1

- [x] 6.0 Complete Community Ranking v1, immutable refresh, aggregate-only UI/API, and red-team calibration.
  - [x] DR-060 Implement and validate pinned Community Ranking v1 offline with decaying market prior, consent/moderation eligibility, dedupe, evidence states, and admission rules.
  - [x] DR-061 Add service-only immutable community snapshots and audited daily/weekly refresh behavior with rebuild-safe consent/deletion handling.
  - [x] DR-062 Build the aggregate-only Community Rankings API/page with honest market-seeded wording, evidence/confidence state, and optional owner delta.
  - [x] DR-063 Complete manipulation/calibration red-team tests, disclose residual coordinated-account risk, and freeze the monitored broad-release gate.

### Phase 7 — Exports, operations, QA, and staged rollout

- [x] 7.0 Complete exports, operations, launch QA, and every staged-rollout evidence gate.
  - [x] DR-070 Implement versioned private CSV/JSON export with stable identity/provenance fields and no private comparison evidence by default.
  - [x] DR-071 Add read-only health plus exact-confirmation ordering repair, identity-review queueing, aggregate dry run, audit, and rollback controls.
  - [x] DR-072 Execute the staged production rollout through evidence-gated cohorts without inferring broader exposure from implementation or elapsed time.
    - [x] DR-072.1 Publish the reviewed release, pass the all-flags-off and staff-stage smokes, configure exactly three staff accounts value-free, enable only the separately approved homepage surface, and publish the queue, hydration, and durable-audit corrections without expanding any other cohort or flag.
    - [x] DR-072.2 Record the approved scope decisions: the homepage-only waiver does not close DR-072, and the 2026-07-16 low-traffic exception replaces the 72-hour/50-journey thresholds only for the next personal-ranker `staff` → `authenticated` move.
    - [x] DR-072.3 Prove the completed low-traffic prerequisites: one genuine owner journey, one durably persisted successful health audit, and one storage-level idempotent initialization replay with aggregate counts unchanged and no inspection of personal choices.
    - [x] DR-072.4 Complete the bounded final review after `2026-07-17T14:42:52.363386Z`: more than 30 clean production hours on the durable response-order artifact passed with no ordering, seed, placement, ownership/season, duplicate-operation, Draft Ranker runtime-error, or unexpected Draft Ranker 5xx blocker; the only health attention state was the ten already documented pending identity reviews.
    - [x] DR-072.5 Use the recorded advance authorization after DR-072.4 passed to change only `DRAFT_RANKER_ROLLOUT_STAGE` from `staff` to `authenticated`; exact-source redeploy, durable post-change health, anonymous denial, unchanged staff/beta counts, and every non-homepage secondary/public flag remaining off passed.
    - [x] DR-072.6 Synchronize the final evidence and close only the exact personal-ranker expansion scope; beta allowlist, discovery, contribution collection, public Community Ranking, and every later expansion remain behind their separate evidence and approval gates.
  - [x] DR-073 Complete launch QA and rollback/deletion drills, including focused suites, broader regressions, TypeScript/build, responsive/browser verification, privacy checks, and zero-residue disposable accounts.

### Phase 8 — Deferred mature-product capabilities

- [ ] 8.0 Plan and execute deferred mature-product capabilities only through later PRD/decision updates and their separate approvals.
  - [ ] DR-080 Plan and implement multiple named and league-specific rankings only after a separate product/migration approval; prevent cross-ranking evidence contamination.
  - [ ] DR-081 Evaluate mature community/adaptive models offline and obtain explicit methodology approval before changing public behavior.
  - [ ] DR-082 Plan expanded prospect/editorial infrastructure only after source rights, identity precision, and rollback are approved.
  - [ ] DR-083 Plan XLSX and advanced export/discovery capabilities without blocking the launch CSV/JSON contract.

## NEW Tasks

- [x] NEW DR-078 Reconcile authoritative PR #352 after the pre-commit mailbox checkpoint exposed newer rollout evidence: merge the exact 2026-07-17 authenticated-stage record, close DR-072/Phase 7 from aggregate-only proof, retain every secondary flag and Phase 8 gate, and reclassify the five deferred Phase 8 rows into Wave B without inspecting personal choices or mutating production (completed 2026-07-18).
- [x] NEW DR-079 Enable and verify the existing personal Draft Ranker on localhost without changing the page or production: keep the two required master/stage settings only in ignored `.env.development.local`; start the installed Next binary with process-level Watchpack polling without changing pnpm's dependency-build approval policy; pass the intended 2-file/18-test flag/API suite with the retained ignored clone explicitly excluded after its duplicate 4-file/36-test discovery; prove anonymous API denial is `401 authentication_required` rather than the disabled `503`; prove both Draft Ranker and home pages return meaningful 200 responses without disabled copy, a framework error overlay, or recurring watcher errors; and confirm the signed-in existing board renders read-only without initialize/reorder/watchlist/pairwise/export actions (completed 2026-07-20).

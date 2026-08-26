# Repository Audit Remediation Task Plan

Generated from audit run `REPO-AUDIT-2026-08-09-FROZEN-36536C3`. This file is a task plan only; it does not implement any finding.

## Source authority and current-state reconciliation

- Frozen evidence authority: `docs/repository-audit/enhancement-ledger.jsonl`, with linked route, responsive, cleanup, validation, and verification records.
- Current planning source: branch `octoberBranch`, HEAD `1fb6be989d270f154b3b2af3bdae7070c9fa26ec`, inspected on 2026-08-19 with the live worktree left untouched.
- Twenty-five findings still have byte-identical current affected files. Five touch post-audit changes: `FIND-COR-002` through `web/lib/supabase/supportedBaselineMigration.test.ts`, and `FIND-BUILD-001`, `FIND-DX-002`, `FIND-DOC-001`, and `FIND-DX-003` through `web/package.json`.
- The `web/package.json` drift only adds player-forecast scripts; the lint, test, package-manager, and Node-authority evidence used by those four findings remains current.
- `FIND-COR-002` has materially expanded: the current test adds a parallel `supportedPostFreezeMigrations` list, while the live worktree also contains the untracked `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql`. Its owner decision must therefore classify the current active set, not merely the five frozen files.
- `FIND-COR-003` remains **Needs revalidation** even though its affected files are unchanged: the frozen active migration chain itself contradicts the endpoint's destructive present-tense consequence, and deployed catalog parity is unknown.
- All pre-existing live-worktree changes are user-owned. Every implementation task must begin with a targeted status/diff check and preserve overlapping work, especially `web/package.json`, `web/lib/supabase/supportedBaselineMigration.test.ts`, and the current forecast migration.
- Concurrent user drift continued after reconciliation (including later edits to `web/components/TransactionTrends/OwnershipSparkline.tsx` and `web/pages/index.tsx`). Those paths do not overlap this plan's finding evidence and were not incorporated; executors must recheck current state rather than treating this planning receipt as a frozen worktree.
- Resume checkpoint 2026-08-26: `octoberBranch` and `origin/octoberBranch` both point to `9621935b9994ac06dd71efd00dc58dae0b95a112`, which incorporates the earlier remediation bundle. Current Yahoo draft work remains user-owned and uncommitted; only its migration filename/hash is represented in the fail-closed source-authority ledger.

## Dependency-ordered index

| Task | Priority | Status | Finding IDs | Parent dependencies |
| --- | --- | --- | --- | --- |
| AUDIT-TASK-001 | P0 | In progress — rollout authorization | FIND-SEC-001 | None |
| AUDIT-TASK-002 | P0 | In progress — rollout authorization | FIND-SEC-002 | None |
| AUDIT-TASK-003 | P0 | Completed | FIND-SEC-003 | None |
| AUDIT-TASK-004 | P1 | In progress — hosted verification | FIND-SEC-004 | None |
| AUDIT-TASK-005 | P1 | Completed | FIND-COR-001 | None |
| AUDIT-TASK-006 | P1 | Completed | FIND-COR-002 | None |
| AUDIT-TASK-007 | P1 | Completed | FIND-DEPLOY-001 | None |
| AUDIT-TASK-008 | P2 | Completed | FIND-COR-003 | None |
| AUDIT-TASK-009 | P2 | Completed | FIND-REL-001 | None |
| AUDIT-TASK-010 | P3 | Completed | FIND-DX-001 | None |
| AUDIT-TASK-011 | P2 | Completed | FIND-DX-002 | None |
| AUDIT-TASK-012 | P3 | Completed | FIND-DOC-001, FIND-DX-003 | None |
| AUDIT-TASK-013 | P2 | Completed | FIND-DOC-002, FIND-DOC-003 | None |
| AUDIT-TASK-014 | P2 | Completed | FIND-DOC-004 | None |
| AUDIT-TASK-015 | P2 | Completed | FIND-SEC-005 | None |
| AUDIT-TASK-016 | P2 | Completed | FIND-A11Y-001 | None |
| AUDIT-TASK-017 | P3 | Completed | FIND-UX-001 | AUDIT-TASK-016 for implementation only |
| AUDIT-TASK-018 | P2 | Completed | FIND-A11Y-002 | None |
| AUDIT-TASK-019 | P2 | Completed | FIND-A11Y-003 | None |
| AUDIT-TASK-020 | P3 | Completed | FIND-STYLE-001 | AUDIT-TASK-005 for implementation only |
| AUDIT-TASK-021 | P3 | Completed | FIND-STYLE-002 | None |
| AUDIT-TASK-022 | P3 | Completed | FIND-STYLE-003 | None |
| AUDIT-TASK-023 | P2 | Completed — runtime check unavailable | FIND-DEPLOY-002 | None |
| AUDIT-TASK-024 | P3 | Completed | FIND-CLEAN-001 | AUDIT-TASK-023 |
| AUDIT-TASK-025 | P3 | Completed | FIND-DX-004 | None |
| AUDIT-TASK-026 | P2 | Blocked — product decision | FIND-COR-004 | None |
| AUDIT-TASK-027 | P3 | Completed | FIND-CLEAN-002 | None |
| AUDIT-TASK-028 | P2 | Blocked — AUDIT-TASK-004 hosted verification | FIND-BUILD-001 | AUDIT-TASK-004, AUDIT-TASK-006, AUDIT-TASK-011 |

## Product-decision queue

| Finding / tasks | Unanswered question (verbatim from audit) | Responsible role / evidence required |
| --- | --- | --- |
| FIND-COR-004 / AUDIT-TASK-026 | Owner must classify the updater as active or superseded before code change or removal. | Data-pipeline owner; scheduler/import/operations references and canonical replacement, if any. |

All other original product-decision rows have approved outcomes recorded in their task-level decision or completion receipts. AUDIT-TASK-028's implementation remains dependency-blocked even though its policy decision is complete.

# AUDIT-TASK-001: Remove browser access to the arbitrary-SQL RPC

- Finding IDs: FIND-SEC-001
- Source candidate IDs: `PDATA-SEC-001`; independent verification `VER-0001`
- Priority: P0
- Status: In progress — rollout authorization
- Affected paths: `supabase/migrations/20260716112908_production_schema_baseline.sql`, `supabase/migrations/20260731035012_restrict_admin_metadata_views.sql`, a new forward migration under `supabase/migrations/`, and `web/lib/supabase/supportedBaselineMigration.test.ts`
- Depends on: None
- Product decision gate: None

## Objective

Remove `anon` and `authenticated` execution of `public.execute_sql(text)` without invoking the routine or weakening migration authority.

## Evidence-backed scope

The active baseline defines a SECURITY DEFINER routine that executes caller-provided SQL and grants it to browser roles. The later search-path hardening migration retains the routine but does not revoke those grants. Both frozen affected files remain byte-identical in current source.

## Non-goals

Do not call the RPC, inspect secret values, push a migration, modify the frozen baseline, redesign all maintenance tooling, or combine this rollout with AUDIT-TASK-002.

## Atomic subtasks

- [x] AUDIT-TASK-001.1 — Verify deployed catalog state read-only.
  - Paths: `supabase/migrations/20260716112908_production_schema_baseline.sql`, `supabase/migrations/20260731035012_restrict_admin_metadata_views.sql`
  - Depends on: None
  - Acceptance criteria: an operator receipt records the deployed function identity, `prosecdef`, `proconfig`, owner, and ACL for `PUBLIC`, `anon`, `authenticated`, and `service_role`; the function is never invoked.
  - Validation: manual read-only `pg_catalog.pg_proc`/`pg_namespace`/ACL query filtered to schema `public`, function `execute_sql`, and identity arguments `text`; compare with the active migration chain.
  - Risks: catalog access may be unavailable or deployment may have drifted.
  - Rollback: none; this subtask performs no mutation.
- [x] AUDIT-TASK-001.2 — Prove consumer compatibility before revocation.
  - Paths: `web/`, `functions/`, `supabase/`, `migrations/`, `sql/`
  - Depends on: AUDIT-TASK-001.1
  - Acceptance criteria: every source/config/documentation reference is classified by caller role; no browser-role consumer is left without an explicitly approved replacement.
  - Validation: from repository root, `rg -n "execute_sql" web functions supabase migrations sql` plus manual inspection of each match; do not execute application modules.
  - Risks: dynamic external consumers are not statically visible.
  - Rollback: preserve the consumer matrix; no source change is required to undo it.
- [x] AUDIT-TASK-001.3 — Add an independently deployable forward privilege-revocation migration.
  - Paths: `supabase/migrations/<new_timestamp>_revoke_execute_sql_browser_roles.sql`, `web/lib/supabase/supportedBaselineMigration.test.ts`
  - Depends on: AUDIT-TASK-001.2
  - Acceptance criteria: the migration revokes `PUBLIC`, `anon`, and `authenticated`, grants only the approved operator role if one exists, fails closed on signature drift, and is registered once in the current migration-authority contract without overwriting concurrent forecast work.
  - Validation: from `web/`, `npm test -- lib/supabase/supportedBaselineMigration.test.ts`; static SQL review confirms no function invocation or unrelated DDL.
  - Risks: incorrect signature or ownership assumptions can make the revocation ineffective.
  - Rollback: prepare a separate compensating forward migration restoring only the previously approved privileged ACL; never roll back by editing an applied migration.
- [ ] AUDIT-TASK-001.4 — Verify source and deployed ACLs after an explicitly authorized rollout.
  - Paths: the new migration and its operator receipt
  - Depends on: AUDIT-TASK-001.3 and separately authorized deployment
  - Acceptance criteria: source tests pass and a post-rollout catalog-only receipt shows no browser-role execute privilege.
  - Validation: repeat the read-only catalog query from AUDIT-TASK-001.1; do not call `execute_sql` as any role.
  - Risks: rollout authorization or read-only catalog credentials may be unavailable.
  - Rollback: apply only the pre-reviewed compensating migration if a verified privileged consumer breaks.

## Parent acceptance criteria

Browser roles cannot execute the routine in source authority and, when separately deployed, in the catalog; consumer and rollback evidence is retained; no live RPC call occurred.

## Risks and rollback

Highest risk is an unknown operator consumer. Keep the revocation isolated and reversible through a forward ACL-only migration.

## Execution checkpoint — 2026-08-19

- Read-only deployed-catalog inspection confirmed `public.execute_sql(text)` remains SECURITY DEFINER and executable by `PUBLIC`, `anon`, `authenticated`, and `service_role`; the routine was not invoked.
- Static consumer review found only evidenced server-side service-role/operator uses, including the audited SQL runner and admin-only CSV endpoint.
- Added `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql` and registered it in the migration-authority contract. Its focused regression case passes and static review confirms the migration never invokes the routine.
- After AUDIT-TASK-006 reconciliation, the full migration-authority file passes 17/17. A fresh read-only catalog and deployed-ledger check still shows the browser-role grants and confirms migration `20260820013120` is not applied.
- The [security RPC rollout runbook](security-rpc-rollout-runbook.md) freezes the exact source hash, catalog-only pre/post query, stop conditions, forward-only rollback rule, and operator receipt. No migration was pushed or applied; AUDIT-TASK-001.4 remains pending explicit authorization naming this migration.
- A resumed read-only Production check on 2026-08-26 still found `public.execute_sql(sql_statement text)` SECURITY DEFINER with `PUBLIC`, `anon`, and `authenticated` execute privileges, while the Production migration ledger still ended at `20260815023132`. No function was invoked and no migration was applied.

# AUDIT-TASK-002: Remove browser access to the destructive truncation RPC

- Finding IDs: FIND-SEC-002
- Source candidate IDs: `PDATA-SEC-002`; independent verification `VER-0002`
- Priority: P0
- Status: In progress — rollout authorization
- Affected paths: `supabase/migrations/20260716112908_production_schema_baseline.sql`, a new forward migration under `supabase/migrations/`, and `web/lib/supabase/supportedBaselineMigration.test.ts`
- Depends on: None
- Product decision gate: None

## Objective

Remove browser-role execution of `public.truncate_rolling_player_game_metrics()` while retaining any justified operator-only maintenance boundary.

## Evidence-backed scope

The active baseline grants a SECURITY DEFINER table-truncation routine to `anon` and `authenticated`, and no later active migration revokes it. Current source still matches the frozen evidence.

## Non-goals

Do not call the RPC, truncate data, push migrations, alter metric retention policy, edit the baseline, or couple rollout/rollback to AUDIT-TASK-001.

## Atomic subtasks

- [x] AUDIT-TASK-002.1 — Verify deployed catalog state without executing the routine.
  - Paths: `supabase/migrations/20260716112908_production_schema_baseline.sql`
  - Depends on: None
  - Acceptance criteria: a receipt records function identity, owner, SECURITY DEFINER/search-path state, and ACLs for all roles; no table or routine is touched.
  - Validation: manual read-only `pg_catalog` query filtered to `public.truncate_rolling_player_game_metrics()` and comparison to the active migrations.
  - Risks: deployed migration drift may change the required forward migration.
  - Rollback: none; read-only verification only.
- [x] AUDIT-TASK-002.2 — Inventory all legitimate callers and operator runbooks.
  - Paths: `web/`, `functions/`, `supabase/`, `migrations/`, `sql/`, `tasks/`
  - Depends on: AUDIT-TASK-002.1
  - Acceptance criteria: each static caller or runbook is assigned a role and purpose; absence of a static consumer is not treated as proof of abandonment.
  - Validation: from repository root, `rg -n "truncate_rolling_player_game_metrics" web functions supabase migrations sql tasks`; manual owner check for external operations.
  - Risks: external/manual consumers may be undocumented.
  - Rollback: retain the inventory; no code change.
- [x] AUDIT-TASK-002.3 — Add a forward ACL-revocation migration and migration-authority coverage.
  - Paths: `supabase/migrations/<new_timestamp>_revoke_truncate_rolling_metrics_browser_roles.sql`, `web/lib/supabase/supportedBaselineMigration.test.ts`
  - Depends on: AUDIT-TASK-002.2
  - Acceptance criteria: `PUBLIC`, `anon`, and `authenticated` cannot execute the routine; any retained grant is explicit and operator-only; the new migration is classified by the current authority contract without overwriting user changes.
  - Validation: from `web/`, `npm test -- lib/supabase/supportedBaselineMigration.test.ts`; static SQL review confirms no `SELECT`/`CALL` of the routine and no truncation statement outside its unchanged definition.
  - Risks: an over-broad grant or wrong signature leaves exposure in place.
  - Rollback: use a pre-reviewed forward migration restoring only a proven operator grant.
- [ ] AUDIT-TASK-002.4 — Confirm post-rollout ACL state after separate authorization.
  - Paths: the new migration and operator receipt
  - Depends on: AUDIT-TASK-002.3 and separately authorized deployment
  - Acceptance criteria: catalog evidence shows browser roles lack execute privilege; no destructive functional probe was used.
  - Validation: repeat AUDIT-TASK-002.1's catalog-only query.
  - Risks: inability to inspect catalog prevents deployed-state completion, not source completion.
  - Rollback: apply the compensating ACL migration only for a verified privileged-consumer regression.

## Parent acceptance criteria

The destructive routine is unavailable to browser roles in source authority and verified deployed state, with consumer and rollback evidence and no data-changing validation.

## Risks and rollback

Never use a truncate call as a health check. Roll back only ACLs, never data.

## Execution checkpoint — 2026-08-19

- Read-only deployed-catalog inspection confirmed `public.truncate_rolling_player_game_metrics()` is SECURITY DEFINER and executable by `anon`, `authenticated`, and `service_role`; the routine and its tables were not touched.
- Static consumer review found the rolling-metric maintenance caller uses the server-side service-role key; no browser-role consumer was identified or assumed abandoned.
- Added `supabase/migrations/20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql` and registered it in the migration-authority contract. Its focused regression case passes and static review confirms no routine invocation or new truncation statement.
- After AUDIT-TASK-006 reconciliation, the full migration-authority file passes 17/17. A fresh read-only catalog and deployed-ledger check still shows the browser-role grants and confirms migration `20260820013124` is not applied.
- The [security RPC rollout runbook](security-rpc-rollout-runbook.md) freezes the exact source hash, catalog-only pre/post query, stop conditions, forward-only rollback rule, and operator receipt. No migration was pushed or applied; AUDIT-TASK-002.4 remains pending explicit authorization naming this migration.
- A resumed read-only Production check on 2026-08-26 still found `public.truncate_rolling_player_game_metrics()` SECURITY DEFINER with `anon` and `authenticated` execute privileges, while the Production migration ledger still ended at `20260815023132`. No function or table was touched and no migration was applied.

# AUDIT-TASK-003: Authenticate and method-bound operational API surfaces

- Finding IDs: FIND-SEC-003
- Source candidate IDs: `WB-FIND-SEC-001`; independent verification `WB-HI-VERIFY-SEC-001-VERDICT`
- Priority: P0
- Status: Completed
- Affected paths: the 20 paths in `docs/repository-audit/enhancement-ledger.jsonl#FIND-SEC-003.affected_files`, plus `web/lib/cron/withCronJobAudit.ts`, `web/utils/adminOnlyMiddleware.ts`, and targeted authorization tests
- Depends on: None
- Product decision gate: Decide which four read/no-op surfaces should remain routable and which routes require scheduler-compatible GET semantics.

## Objective

Give every addressable operational route an explicit request-authentication and method contract before privileged work or audit writes occur.

## Evidence-backed scope

All 20 Pages API files remain byte-identical and framework-addressable. None uses `adminOnly`; 15 are GET-capable mutators, six trigger external work, four (`audit-nhl-xg-backfill`, `skaterArray`, `update-power-rankings`, `update-team-power-ratings-new`) are read/no-op at the application layer but their audit wrapper still inserts, and `create-materialized-view` has the additional stale-schema contract in AUDIT-TASK-008.

## Non-goals

Do not invoke any route, job, scraper, database write, DDL, or scheduler; do not assume all GET support is accidental; do not redesign job orchestration or observability.

## Atomic subtasks

- [x] AUDIT-TASK-003.1 — Record the owner-approved route/method disposition matrix.
  - Paths: all 20 finding paths; scheduler/deployment configuration that proves consumers
  - Depends on: None
  - Acceptance criteria: each route is labeled retain/retire/quarantine; each retained method has an evidenced caller; the four read/no-op routes and every GET-capable mutator receive an explicit decision.
  - Validation: static route/config/reference review plus owner sign-off; no HTTP request is sent.
  - Risks: undocumented schedulers can be broken by method changes.
  - Rollback: retain the pre-change matrix and current route signatures.
- [x] AUDIT-TASK-003.2 — Add a focused negative-authorization contract harness.
  - Paths: `web/utils/adminOnlyMiddleware.ts`, `web/lib/cron/withCronJobAudit.ts`, `web/lib/cron/withCronJobAudit.test.ts`, `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts`
  - Depends on: AUDIT-TASK-003.1
  - Acceptance criteria: tests prove missing/invalid credentials are rejected before handler execution or audit insert, and approved admin/cron credentials reach a mocked handler without service/database/network calls.
  - Validation: from `web/`, `npm test -- __tests__/pages/api/v1/db/operational-route-auth.test.ts lib/cron/withCronJobAudit.test.ts`.
  - Risks: a test-only wrapper can diverge from actual default exports.
  - Rollback: revert the harness independently; retain the route matrix.
- [x] AUDIT-TASK-003.3 — Apply the chosen contract to the four read/no-op surfaces.
  - Paths: `web/pages/api/v1/db/audit-nhl-xg-backfill.ts`, `web/pages/api/v1/db/skaterArray.ts`, `web/pages/api/v1/db/update-power-rankings.ts`, `web/pages/api/v1/db/update-team-power-ratings-new.ts`
  - Depends on: AUDIT-TASK-003.1, AUDIT-TASK-003.2
  - Acceptance criteria: each retained route authenticates before wrapper writes and rejects unapproved methods; retired/quarantined routes are inert under the recorded decision.
  - Validation: targeted cases in `operational-route-auth.test.ts`; from `web/`, `npx tsc --noEmit`.
  - Risks: a public read consumer may have been omitted from evidence.
  - Rollback: restore the prior route export only with the prior consumer contract and temporary access controls documented.
- [x] AUDIT-TASK-003.4 — Secure the database-mutating and external-work route cohorts.
  - Paths: the remaining 15 `web/pages/api/v1/db/` finding paths, grouped in reviewable changes by shared wrapper and scheduler contract
  - Depends on: AUDIT-TASK-003.1, AUDIT-TASK-003.2
  - Acceptance criteria: authentication precedes all service-role/external work; mutation-capable GET is removed unless the matrix proves a scheduler need; default dry-run behavior cannot silently write; every changed default export is exercised by the negative-auth matrix.
  - Validation: from `web/`, run the exact affected route cases in `npm test -- __tests__/pages/api/v1/db/operational-route-auth.test.ts`, then `npx tsc --noEmit` and `npm run lint`; all external modules are mocked.
  - Risks: broad route edits can obscure behavior differences and scheduler compatibility.
  - Rollback: revert one route cohort at a time; never disable auth globally to restore a single scheduler.
- [x] AUDIT-TASK-003.5 — Resolve the materialization route's auth disposition without duplicating schema work.
  - Paths: `web/pages/api/v1/ml/create-materialized-view.ts`
  - Depends on: AUDIT-TASK-003.1 and AUDIT-TASK-008.2
  - Acceptance criteria: if retained, the route uses the same negative-auth contract; if retired, AUDIT-TASK-008 owns its inert/compatibility outcome and this task records no duplicate implementation.
  - Validation: targeted mocked authorization test only; never send a live request.
  - Risks: conflicting edits with AUDIT-TASK-008.
  - Rollback: follow the route-specific rollback selected in AUDIT-TASK-008.

## Parent acceptance criteria

All 20 surfaces have an owner-approved disposition and test-backed authentication/method contract, with no unauthenticated privileged or audit write path.

## Risks and rollback

Scheduler compatibility is the main risk. Roll out and roll back by route cohort, not by weakening the shared boundary.

## Decision-preparation checkpoint — 2026-08-19

- The [draft operational-route matrix](operational-route-decision-matrix.md) reconciles all 20 current route files byte-for-byte to the finding hashes and records current methods, privilege/effect, tracked consumer evidence, and one conservative disposition proposal per route.
- No tracked Vercel or Supabase scheduler config names any of the 20 routes. Seven basenames appear elsewhere only as comments, report mappings, benchmark/classification metadata, or a remediation recommendation; none proves invocation. Provider-side/manual callers remain an explicit owner evidence gap.
- The draft requires authentication outside `withCronJobAudit`, proposes POST-only mutation by default, preserves GET only with a named scheduler receipt, and makes aliases/no-work/stale DDL routes inert. Every row remains Pending; no owner decision or route edit was inferred.

## Completion checkpoint — 2026-08-19

- The repository owner approved the complete proposed matrix. Fifteen retained routes now consume one production `operationalRouteContracts` registry through outermost `adminOnly`, method enforcement, safe omitted-`dryRun` defaults where the handler supports dry-run, and only then handler/audit work. No mutation-capable GET exception was approved.
- Five legacy/read/alias/DDL surfaces remain addressable but inert and import no Supabase or audit client. The materialization route outcome is owned once by AUDIT-TASK-008.
- `npm test -- __tests__/pages/api/v1/db/operational-route-auth.test.ts lib/cron/withCronJobAudit.test.ts` passes 77/77; the dedicated materialization test adds 3/3. Eight-gigabyte non-incremental TypeScript passes, targeted ESLint passes, and full lint exits 0 with the existing 62 warnings. No route, scheduler, scraper, external service, or database operation was invoked.

# AUDIT-TASK-004: Minimize CI service-role credential scope

- Finding IDs: FIND-SEC-004
- Source candidate IDs: `DOCOPS-FIND-001`; independent verification `VER-0004`
- Priority: P1
- Status: In progress — hosted verification
- Affected paths: `.github/workflows/rankings-e2e.yml`
- Depends on: None
- Product decision gate: None

## Objective

Expose `SUPABASE_SERVICE_ROLE_KEY` only to the exact local-server E2E step that demonstrably requires it.

## Evidence-backed scope

The job-level environment currently gives the production-capable variable to checkout, `npm ci`, Playwright installation, deployed-URL tests, and artifact upload. The workflow remains byte-identical to the frozen evidence.

## Non-goals

Do not rotate or print credentials, change test behavior, add new secrets, run a deployment, or fold general CI design from AUDIT-TASK-028 into this focused hardening.

## Atomic subtasks

- [x] AUDIT-TASK-004.1 — Document the minimum credential requirement per workflow step.
  - Paths: `.github/workflows/rankings-e2e.yml`, `web/e2e/rankings.spec.ts`, `web/playwright.config.ts`
  - Depends on: None
  - Acceptance criteria: checkout/install/browser-install/deployed-URL/upload are explicitly credential-free; only a proven local-server test step requests the minimum variable set.
  - Validation: static source/config inspection; no secret value or workflow execution.
  - Risks: a hidden setup dependency may currently rely on job-scoped environment.
  - Rollback: retain the pre-change step matrix.
- [x] AUDIT-TASK-004.2 — Move credential names to the narrow step scope.
  - Paths: `.github/workflows/rankings-e2e.yml`
  - Depends on: AUDIT-TASK-004.1
  - Acceptance criteria: no production-capable secret exists at job scope; deployed-URL and artifact steps inherit none; YAML contains no value or diagnostic expansion.
  - Validation: from root, `rg -n "SUPABASE_SERVICE_ROLE_KEY|env:" .github/workflows/rankings-e2e.yml`; manual YAML scope inspection.
  - Risks: indentation mistakes can broaden or remove environment unexpectedly.
  - Rollback: revert only the workflow scoping change; never paste a secret into source.
- [ ] AUDIT-TASK-004.3 — Verify test discovery and the credential-free steps.
  - Paths: `.github/workflows/rankings-e2e.yml`, `web/e2e/rankings.spec.ts`
  - Depends on: AUDIT-TASK-004.2
  - Acceptance criteria: the rankings suite still discovers three tests; a GitHub Actions run confirms install/upload/deployed-URL steps do not receive the variable by configuration (without logging environment values).
  - Validation: from `web/`, `npm run test:e2e:rankings -- --list`; final workflow verification requires GitHub Actions and appropriately configured secret metadata, not secret disclosure.
  - Risks: local discovery cannot prove hosted runner environment inheritance.
  - Rollback: revert the scoped workflow change if the local-server test cannot start, then diagnose without broadening unrelated steps.

## Parent acceptance criteria

Only the minimum local-server test step can receive the service-role variable, test discovery remains intact, and no value appears in logs or source.

## Risks and rollback

Hosted-runner behavior must be checked through configuration and redacted logs. Never use `env`, `printenv`, tracing, or secret echoing.

## Execution checkpoint — 2026-08-19

- Checkout, dependency installation, browser installation, deployed-URL testing, and artifact upload are now credential-free by YAML scope. Only the local-server E2E step receives the URL/public/service-role values; the prerequisite check receives boolean presence markers only.
- `npm run test:e2e:rankings -- --list` still discovers exactly three tests, and bounded YAML inspection finds one actual `SUPABASE_SERVICE_ROLE_KEY` assignment under the local-server step.
- The scoped workflow change is now committed and pushed at `9621935b9994ac06dd71efd00dc58dae0b95a112`. A read-only GitHub Actions lookup on 2026-08-26 returned zero workflow runs for that exact commit; no workflow dispatch occurred, so hosted inheritance still cannot be claimed.
- AUDIT-TASK-004.3 remains open because only a future GitHub Actions run can prove hosted-runner inheritance; no environment values were printed or inspected.

# AUDIT-TASK-005: Replace fabricated GamePreview analytics with explicit unavailable states

- Finding IDs: FIND-COR-001
- Source candidate IDs: `FE-FINDING-001`; independent verification `VER-0003`
- Priority: P1
- Status: Completed
- Affected paths: `web/components/GamePreview/GamePreview.tsx`, `web/pages/game/[gameId].tsx`, and targeted GamePreview tests
- Depends on: None
- Product decision gate: None

## Objective

Ensure `/game/[gameId]` never presents fixed mock probabilities or rates as real pregame analytics when source data is missing or failed.

## Evidence-backed scope

The route always renders GamePreview after game details load; missing odds/team inputs become plausible fixed values and the SWR error is not surfaced. Both affected files remain byte-identical. The route's visual audit found no separate redesign need.

## Non-goals

Do not redesign the page, change prediction methodology, add caching, fabricate substitute estimates, or modify postgame behavior unrelated to missing-data handling.

## Atomic subtasks

- [x] AUDIT-TASK-005.1 — Define the explicit data-state contract.
  - Paths: `web/components/GamePreview/GamePreview.tsx`, `web/pages/game/[gameId].tsx`
  - Depends on: None
  - Acceptance criteria: loading, complete, partial, unavailable, and source-error states have binary field-visibility rules; fixtures are limited to tests or visibly labeled demos.
  - Validation: static contract review against the current SWR/game-detail inputs and `FIND-COR-001` evidence.
  - Risks: partial real data can be hidden unnecessarily if the contract is too coarse.
  - Rollback: retain the prior field mapping, not the production mock values.
- [x] AUDIT-TASK-005.2 — Implement the contract and remove production mock fallbacks.
  - Paths: `web/components/GamePreview/GamePreview.tsx`, `web/pages/game/[gameId].tsx`
  - Depends on: AUDIT-TASK-005.1
  - Acceptance criteria: absent/error inputs render an explicit unavailable/partial state; no plausible fixed analytic value is emitted; real complete inputs render unchanged metrics.
  - Validation: from `web/`, `npx tsc --noEmit`; static search confirms mock-only literals are absent from the production branch.
  - Risks: shared props may affect both pregame and final variants.
  - Rollback: revert the state renderer while keeping the source error visible; never restore unlabeled fabricated values.
- [x] AUDIT-TASK-005.3 — Add focused state regression coverage.
  - Paths: `web/components/GamePreview/GamePreview.test.tsx` (new targeted test if no nearer test exists), `web/pages/game/[gameId].tsx`
  - Depends on: AUDIT-TASK-005.2
  - Acceptance criteria: tests cover complete, partial, absent, and SWR-error inputs and assert that fabricated values are never shown.
  - Validation: from `web/`, `npm test -- components/GamePreview/GamePreview.test.tsx`.
  - Risks: over-specified snapshots can create low-value churn.
  - Rollback: keep behavior assertions and remove only brittle presentation detail assertions.
- [x] AUDIT-TASK-005.4 — Verify the page variants at three viewports.
  - Paths: `web/pages/game/[gameId].tsx`, `web/components/GamePreview/GamePreview.tsx`, `web/components/GamePreview/GamePreview.module.scss`
  - Depends on: AUDIT-TASK-005.3
  - Acceptance criteria: representative complete and unavailable states are understandable at 1440×900, 834×1112, and 390×844; no separate redesign is introduced.
  - Validation: manual local browser check with deterministic fixtures; requires a local app but no production service or authenticated data.
  - Risks: live service data would make the unavailable state non-deterministic.
  - Rollback: revert only layout accommodations that regress the complete state.

## Parent acceptance criteria

Users can distinguish real, partial, loading, and unavailable analytics, and focused tests prove mock values cannot leak into production rendering.

## Risks and rollback

Preserve useful partial data and existing completed-game behavior. Coordinate later stylesheet ownership work through AUDIT-TASK-020.

## Execution checkpoint — 2026-08-19

- `GamePreview` now treats each source independently: real odds and partial team metrics remain visible, non-2xx SWR responses become source errors, and missing fields or unsupported goalie/line/trend sources are explicitly unavailable instead of receiving plausible fixed values.
- Added five focused tests covering complete, partial, absent, source-error, and loading inputs. `npm test -- components/GamePreview/GamePreview.test.tsx`, targeted ESLint, and `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false` pass; the initial default-heap type check stopped with an out-of-memory failure before diagnostics.
- Deterministic complete and unavailable fixtures were visually verified at 1440×900, 834×1112, and 390×844. All text remained legible and document width stayed within the viewport; the ignored temporary fixture harness was removed after verification.

# AUDIT-TASK-006: Reconcile the live migration-authority contract

- Finding IDs: FIND-COR-002
- Source candidate IDs: `VAL-MIGRATION-AUTHORITY-001`
- Priority: P1
- Status: Completed
- Affected paths: the seven frozen paths in `docs/repository-audit/enhancement-ledger.jsonl#FIND-COR-002.affected_files`, current active `supabase/migrations/*.sql`, `web/lib/supabase/supportedBaselineMigration.test.ts`, and `tasks/TASKS/super-goal/super-goal-final-summary.md`
- Depends on: None
- Product decision gate: Owner must assign each forecast migration to a reviewed deployment class; the audit cannot infer production application state.

## Objective

Restore one fail-closed, hash-aware authority for every current active migration without guessing deployed state or overwriting concurrent forecast work.

## Evidence-backed scope

The frozen suite failed because five forecast migrations were absent from both parsed authority lists. Current source adds 13 filenames to a separate `supportedPostFreezeMigrations` exception list and the live worktree adds `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql`; this is direct current-source expansion of the same authority mismatch, not a rewrite of the frozen finding.

## Non-goals

Do not apply, push, rename, reorder, edit, or delete a migration; do not query deployed data; do not infer application state from filenames; do not discard the user's current test or migration changes.

## Atomic subtasks

- [x] AUDIT-TASK-006.1 — **OWNER DECISION:** classify every current post-baseline migration.
  - Paths: `supabase/migrations/*.sql`, `tasks/TASKS/super-goal/super-goal-final-summary.md`, `web/lib/supabase/supportedBaselineMigration.test.ts`
  - Depends on: None
  - Acceptance criteria: the database/migration owner assigns each active migration exactly one reviewed class, records its immutable hash/order/deployment gate, and explicitly includes the live post-audit files; unknown deployed state remains labeled unknown.
  - Validation: static filename/hash reconciliation plus owner sign-off; no Supabase connection or migration command.
  - Risks: treating an exception list as deployment approval can hide unapplied or partially applied migrations.
  - Rollback: preserve the signed classification receipt and make no source change until approved.
- [x] AUDIT-TASK-006.2 — Make one authority source drive inventory, hashes, and summary.
  - Paths: `web/lib/supabase/supportedBaselineMigration.test.ts`, `tasks/TASKS/super-goal/super-goal-final-summary.md`, and the owner-approved canonical authority file/section
  - Depends on: AUDIT-TASK-006.1
  - Acceptance criteria: every active migration is derived from one canonical record; parallel filename exception arrays no longer bypass class/hash checks; the final summary and test consume the same data.
  - Validation: focused diff review proves one source of truth and exact-one classification for every `supabase/migrations/*.sql` file.
  - Risks: consolidating authority can accidentally erase historical applied-state evidence.
  - Rollback: revert the consumer wiring while retaining the owner-approved authority record.
- [x] AUDIT-TASK-006.3 — Restore fail-closed migration tests without overwriting live forecast edits.
  - Paths: `web/lib/supabase/supportedBaselineMigration.test.ts`, current active migration files
  - Depends on: AUDIT-TASK-006.2
  - Acceptance criteria: an unlisted, hash-drifted, multiply classified, or misordered migration fails deterministically; the current approved set passes; test fixtures never apply SQL.
  - Validation: from `web/`, `npm test -- lib/supabase/supportedBaselineMigration.test.ts`.
  - Risks: overly rigid order rules can block independently deployable emergency security migrations.
  - Rollback: revert only the test/authority parser; never alter migration bytes to satisfy a hash.
- [x] AUDIT-TASK-006.4 — Reconcile documentation and rollout gates.
  - Paths: `tasks/TASKS/super-goal/super-goal-final-summary.md`, repository migration runbook/authority document selected in AUDIT-TASK-006.1
  - Depends on: AUDIT-TASK-006.3
  - Acceptance criteria: documentation distinguishes source-authorized, applied, pending, repair-only, and unknown states and names the separate authorization required for any deployment.
  - Validation: manual comparison of documented rows to the canonical authority; `git diff --check`.
  - Risks: documentation can falsely imply production parity.
  - Rollback: restore wording while keeping test authority intact; never mark a migration applied without evidence.

## Parent acceptance criteria

Every live active migration has exactly one owner-approved class/hash/order record consumed by both tests and documentation, and the focused migration-authority suite passes without contacting a database.

## Risks and rollback

This task overlaps active user work. Re-read status/diff immediately before editing and preserve all forecast migration changes. Source authority does not authorize deployment.

## Completion checkpoint — 2026-08-19

- Owner approval established the fail-closed policy: repository presence means source-authorized only; applied state requires an exact environment receipt; otherwise state remains unknown. No source classification authorizes deployment.
- [`migration-authority.json`](migration-authority.json) is now the sole ordered hash ledger for all 51 current active migrations, including the current forecast/Yahoo additions and the two audit security migrations. Read-only Production-ledger receipts through 2026-08-26 reconcile it to 41 applied rows and 10 unknown-state rows without changing any migration byte.
- The supported-baseline suite consumes that ledger directly, rejects missing/extra/duplicate/misordered/hash-drifted records, and cross-checks the retained historical manifest and current summary. `npm test -- lib/supabase/supportedBaselineMigration.test.ts` passes 17/17 without contacting Supabase or running SQL.

# AUDIT-TASK-007: Establish the deployed owner of `/sko/pipeline`

- Finding IDs: FIND-DEPLOY-001
- Source candidate IDs: `PDATA-REL-003`
- Priority: P1
- Status: Completed
- Affected paths: `functions/api/index.py`, `functions/vercel.json`, `functions/tests/test_sko_pipeline.py`, and a dedicated handler path only if selected
- Depends on: None
- Product decision gate: Choose whether the Flask aggregate or a dedicated Vercel function owns /sko/pipeline.

## Objective

Make the rewrite target an existing, authenticated handler while proving route resolution without starting pipeline work.

## Evidence-backed scope

`functions/vercel.json` rewrites `/sko/pipeline` to absent `/api/sko/pipeline/index.py`; the implementation lives in the Flask aggregate in `functions/api/index.py`. Both files remain byte-identical.

## Non-goals

Do not execute the pipeline, deploy functions, change model behavior, contact external services, install packages, or infer the intended deployment shape from filesystem proximity.

## Atomic subtasks

- [x] AUDIT-TASK-007.1 — **OWNER DECISION:** select the route owner and authentication contract.
  - Paths: `functions/api/index.py`, `functions/vercel.json`, any documented route consumers
  - Depends on: None
  - Acceptance criteria: the owner chooses Flask aggregate or dedicated function, records the expected physical target and credential contract, and identifies all callers.
  - Validation: static route/consumer review plus deployment-owner sign-off; no HTTP request.
  - Risks: choosing a second entrypoint can duplicate initialization or auth logic.
  - Rollback: retain the current configuration until the decision is approved.
- [x] AUDIT-TASK-007.2 — Align rewrite and entrypoint with the selected owner.
  - Paths: `functions/vercel.json`, `functions/api/index.py` or the approved dedicated handler path
  - Depends on: AUDIT-TASK-007.1
  - Acceptance criteria: every configured destination exists; one implementation owns pipeline initialization; unauthenticated requests fail before any model, filesystem, network, or database work.
  - Validation: static config/path resolution and isolated handler tests with pipeline functions mocked.
  - Risks: Vercel routing semantics may differ between Flask aggregate and file functions.
  - Rollback: restore the prior rewrite and handler independently; do not run pipeline work as a rollback probe.
- [x] AUDIT-TASK-007.3 — Add a no-work route-resolution regression test.
  - Paths: `functions/tests/test_sko_pipeline.py`, `functions/vercel.json`, selected handler
  - Depends on: AUDIT-TASK-007.2
  - Acceptance criteria: the test proves the destination exists, unauthorized access is rejected, and a mocked authorized request reaches the selected adapter without executing pipeline work.
  - Validation: from repository root, `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_sko_pipeline.py`; requires the existing pytest-capable local environment evidenced by audit receipt `VAL-0009`, otherwise mark blocked.
  - Risks: test imports may execute application initialization unless dependencies are stubbed before import.
  - Rollback: revert the test adapter and route change together; retain the owner decision.

## Parent acceptance criteria

The rewrite has one existing authenticated target, route tests prove fail-closed resolution with all pipeline work mocked, and no deployment or pipeline invocation is part of validation.

## Risks and rollback

Entry-point initialization is the main risk. Prefer source parsing and isolated adapters over importing a module that starts application work.

## Completion checkpoint — 2026-08-19

- The owner selected the existing Flask aggregate and its fail-closed `SKO_PIPELINE_SECRET` bearer contract. The Vercel rewrite now targets existing `functions/api/index.py`; no duplicate entrypoint was introduced.
- The regression test resolves the configured destination on disk, proves missing auth fails before work, and proves an authorized request reaches only a mocked aggregate adapter. `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_sko_pipeline.py` passes 8/8. No server, HTTP request, pipeline, model, database, deployment, or external service ran.

# AUDIT-TASK-008: Revalidate and disposition the stale materialization endpoint

- Finding IDs: FIND-COR-003
- Source candidate IDs: `WB-FIND-COR-002`, `WB-FIND-COR-003`; independent verification `WB-HI-VERIFY-COR-002-VERDICT`
- Priority: P2
- Status: Completed
- Affected paths: `web/pages/api/v1/ml/create-materialized-view.ts`, `web/lib/projections/queries/skater-queries.ts`, `web/lib/sustainability/dependencyChecks.ts`, `web/lib/xg/shotFeatureEnrichment.ts`, `supabase/migrations/20260731040341_privatize_unified_materialized_views.sql`
- Depends on: None
- Product decision gate: Decide whether the endpoint has any valid maintenance purpose after the internal_stats migration.

## Objective

Establish current schema parity, then retire the endpoint or align it with the authoritative internal materialization workflow without destructive or unauthenticated validation.

## Evidence-backed scope

The endpoint is unauthenticated, non-atomic, fixed-subset, and reports a head-only count incorrectly. However, the active migration moves the materialized view to `internal_stats` and exposes `public.player_stats_unified` as an ordinary view; with the pinned search path, the endpoint should fail at `DROP MATERIALIZED VIEW` before replacement unless deployment has drifted. Current source remains unchanged, but deployed parity is unknown.

## Non-goals

Do not invoke the endpoint, call `execute_sql`, perform DDL, refresh a materialized view, query application data, or assume the destructive frozen consequence is current.

## Atomic subtasks

- [x] AUDIT-TASK-008.1 — **READ-ONLY REVALIDATION GATE:** compare source authority with deployed catalog.
  - Paths: `supabase/migrations/20260731040341_privatize_unified_materialized_views.sql`, `web/pages/api/v1/ml/create-materialized-view.ts`
  - Depends on: None
  - Acceptance criteria: a receipt records object kinds and schemas for both `public.player_stats_unified` and `internal_stats.player_stats_unified`, relevant function/search-path metadata, and migration parity; no view or endpoint is invoked.
  - Validation: approved read-only `pg_catalog.pg_class`/`pg_namespace`/`pg_proc` inspection only; compare with source migration and endpoint SQL.
  - Risks: unavailable catalog access leaves the parent Needs revalidation.
  - Rollback: none; read-only gate.
- [x] AUDIT-TASK-008.2 — **OWNER DECISION:** retain or retire the endpoint after revalidation.
  - Paths: `web/pages/api/v1/ml/create-materialized-view.ts`, documented operational consumers
  - Depends on: AUDIT-TASK-008.1
  - Acceptance criteria: the operations/database owner records one purpose, caller, and authoritative workflow if retained, or confirms an inert compatibility outcome if retired.
  - Validation: source/config/consumer evidence plus owner sign-off; absence of links alone is insufficient.
  - Risks: an undocumented maintenance caller may exist.
  - Rollback: keep the endpoint disabled from operational use while evidence is incomplete.
- [x] AUDIT-TASK-008.3 — Implement the selected non-destructive route outcome.
  - Paths: `web/pages/api/v1/ml/create-materialized-view.ts`, affected consumer references, targeted route test
  - Depends on: AUDIT-TASK-008.2; coordinate authentication with AUDIT-TASK-003.5
  - Acceptance criteria: retired means no reachable privileged DDL path; retained means authoritative `internal_stats` ownership, transaction-safe behavior, correct counts, and authentication before any operation.
  - Validation: from `web/`, `npm test -- __tests__/pages/api/v1/ml/create-materialized-view.test.ts` and `npx tsc --noEmit`; database client and SQL execution are fully mocked.
  - Risks: a retained endpoint can recreate a second schema authority.
  - Rollback: restore the prior source only in a disabled/authenticated state; never use live DDL to test rollback.
- [x] AUDIT-TASK-008.4 — Reconfirm read consumers against the selected authority.
  - Paths: `web/lib/projections/queries/skater-queries.ts`, `web/lib/sustainability/dependencyChecks.ts`, `web/lib/xg/shotFeatureEnrichment.ts`
  - Depends on: AUDIT-TASK-008.3
  - Acceptance criteria: all consumers point to the intended public/internal contract and do not depend on the stale route's fixed-subset definition.
  - Validation: targeted unit/type checks from `web/`: `npx tsc --noEmit`; manual source-to-migration mapping.
  - Risks: changing reader schemas can alter production query privileges.
  - Rollback: revert consumer changes independently while keeping the unsafe endpoint disabled.

## Parent acceptance criteria

Current schema authority is evidenced, the endpoint has an owner-approved disposition, and no unauthenticated or stale DDL route remains. Unknown deployed parity remains explicit rather than fabricated.

## Risks and rollback

Do not blend source and deployed states. If read-only parity cannot be established, stop this parent after the gate and keep it Needs revalidation.

## Execution checkpoint — 2026-08-19

- A catalog-only query confirmed deployed/source parity: `internal_stats.player_stats_unified` is relkind `m`, `public.player_stats_unified` is relkind `v`, migration `20260731040341` is recorded, and `public.execute_sql(text)` remains SECURITY DEFINER with its pinned `pg_catalog, public, extensions, pg_temp` search path. Neither the endpoint nor any RPC/view was invoked.
- Static endpoint review confirms the first unqualified statement is `DROP MATERIALIZED VIEW IF EXISTS player_stats_unified CASCADE`; against the verified public ordinary view, PostgreSQL should reject the wrong object type before the endpoint's fixed-subset replacement is created.
- No source/config reference proved an operational caller for the endpoint, but that absence is not retirement authorization. AUDIT-TASK-008.2 therefore remains an explicit database/operations-owner gate, and no route or consumer source was changed.

## Completion checkpoint — 2026-08-19

- The owner approved retirement. `/api/v1/ml/create-materialized-view` is now a POST-only 410 compatibility surface with no Supabase import, client construction, RPC, DDL, or audit path; AUDIT-TASK-003 records the same single disposition.
- Static mapping reconfirmed all readers use the public `player_stats_unified` contract backed by the migration-owned public view/internal materialized view; none depends on the retired fixed-subset route definition, so no reader edit was justified.
- `npm test -- __tests__/pages/api/v1/ml/create-materialized-view.test.ts` passes 3/3, the operational auth cohort passes, and non-incremental TypeScript passes. No endpoint, RPC, view, or database operation was invoked.

# AUDIT-TASK-009: Normalize Natural Stat Trick team-table response contracts

- Finding IDs: FIND-REL-001
- Source candidate IDs: `PDATA-COR-004`, `PDATA-REL-005`
- Priority: P2
- Status: Completed
- Affected paths: `functions/api/fetch_team_table.py`, `functions/api/index.py`, focused Python contract tests, and evidenced callers
- Depends on: None
- Product decision gate: None

## Objective

Return one structured success shape from both function surfaces and non-2xx responses for dependency/parser failures.

## Evidence-backed scope

The aggregate handler JSON-wraps an already serialized string while the standalone handler decodes it; both can embed upstream/parser failure payloads in HTTP 200. Current files remain byte-identical.

## Non-goals

Do not change Natural Stat Trick query semantics, scrape live data, redesign all function responses, or add a general error framework.

## Atomic subtasks

- [x] AUDIT-TASK-009.1 — Define the shared success/error adapter contract.
  - Paths: `functions/api/fetch_team_table.py`, `functions/api/index.py`, evidenced callers
  - Depends on: None
  - Acceptance criteria: success has one JSON object/array serialization boundary; dependency, timeout, and parser failures map to named non-2xx statuses and stable error fields.
  - Validation: static comparison of both handlers and current caller expectations.
  - Risks: external callers may depend on the double-encoded legacy response.
  - Rollback: retain a versioned compatibility adapter if a verified caller requires it.
- [x] AUDIT-TASK-009.2 — Implement one shared parser/result contract in both surfaces.
  - Paths: `functions/api/fetch_team_table.py`, `functions/api/index.py`
  - Depends on: AUDIT-TASK-009.1
  - Acceptance criteria: both surfaces serialize once, return identical representative data, and preserve diagnostic context without returning HTTP 200 on failure.
  - Validation: code review with all network clients stubbed; no local server or external request.
  - Risks: aggregate framework response APIs may require a distinct adapter layer.
  - Rollback: revert adapters independently while retaining the documented contract.
- [x] AUDIT-TASK-009.3 — Add isolated contract tests for both entrypoints.
  - Paths: `functions/tests/test_fetch_team_table_contract.py` (new focused test), both handlers
  - Depends on: AUDIT-TASK-009.2
  - Acceptance criteria: representative success, upstream non-2xx, timeout, malformed HTML, and parser exception cases assert identical body/status semantics; no network occurs.
  - Validation: from root, `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_fetch_team_table_contract.py`; requires the pytest environment evidenced by `VAL-0009`, otherwise mark blocked.
  - Risks: importing `functions/api/index.py` may initialize unrelated application state.
  - Rollback: move shared logic behind an import-safe adapter or revert the test-driven change; never enable network in tests.

## Parent acceptance criteria

Both function surfaces return one deterministic structured success contract and non-2xx failure contracts proven by isolated, no-network tests.

## Risks and rollback

Consumer compatibility is the primary risk. Preserve a narrowly versioned adapter only where an actual caller proves the need.

## Execution checkpoint — 2026-08-19

- The shared scraper now returns a structured `TeamTableResult`; standalone and aggregate Flask adapters serialize its payload exactly once and use its HTTP status. The existing web consumer already accepts object JSON and rejects non-2xx responses, so no legacy double-encoding adapter was justified.
- Missing configuration returns 503; upstream timeout returns 504; upstream HTTP/request and parser failures return 502 with stable error codes. Existing success `data` and `debug` fields remain intact, and no Natural Stat Trick query semantics changed.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_fetch_team_table_contract.py` passes seven no-network cases. The affected aggregate module's existing `test_sko_pipeline.py` also passes six cases.

# AUDIT-TASK-010: Stabilize generated Next type bootstrap authority

- Finding IDs: FIND-DX-001
- Source candidate IDs: `DOCOPS-FIND-004`
- Priority: P3
- Status: Completed
- Affected paths: `.gitignore`, `web/next-env.d.ts`, `web/next.config.js`, `web/tsconfig.json`, and the isolated/default build-output contract
- Depends on: None
- Product decision gate: None

## Objective

Make default and isolated Next development produce a deterministic `next-env.d.ts` contract without tracked-file churn.

## Evidence-backed scope

The tracked file references an absent `.next-player-forecasts/types/routes.d.ts`; normal TypeScript passed, but disposable Next dev rewrote the tracked file. Current affected files remain byte-identical.

## Non-goals

Do not upgrade Next, enable unrelated typed-route behavior, commit `.next*` output, run a production build, or normalize other generated files.

## Atomic subtasks

- [x] AUDIT-TASK-010.1 — Reproduce and document each generated-file authority in a disposable copy.
  - Paths: `web/next-env.d.ts`, `web/next.config.js`, `web/tsconfig.json`, `.gitignore`
  - Depends on: None
  - Acceptance criteria: before/after hashes identify which documented dev command owns the default and isolated variants; generated directories remain ignored.
  - Validation: in a clean disposable copy, run `npm run dev:stable` only long enough to generate types, stop it, then `git diff -- next-env.d.ts`; repeat only for an evidenced isolated command.
  - Risks: dev startup writes `.next` caches and may attempt telemetry/static requests.
  - Rollback: discard the disposable copy; no live-tree write.
- [x] AUDIT-TASK-010.2 — Establish one tracked bootstrap contract.
  - Paths: `web/next-env.d.ts`, `web/next.config.js`, `web/tsconfig.json`, `.gitignore`
  - Depends on: AUDIT-TASK-010.1
  - Acceptance criteria: the tracked file contains only references generated by the default documented workflow, while isolated output is configured without rewriting it or is explicitly untracked/generated.
  - Validation: focused diff and Next TypeScript configuration review.
  - Risks: changing generated authority can remove route types from an isolated workflow.
  - Rollback: restore the prior bootstrap plus an explicit regeneration note.
- [x] AUDIT-TASK-010.3 — Prove a clean type/dev cycle has no tracked churn.
  - Paths: `web/next-env.d.ts`, generated `.next*` directories
  - Depends on: AUDIT-TASK-010.2
  - Acceptance criteria: `npx tsc --noEmit` passes and the documented disposable dev cycle leaves `git diff --exit-code -- next-env.d.ts` clean.
  - Validation: from `web/` in a disposable copy, `npx tsc --noEmit`; after the bounded dev cycle, `git diff --exit-code -- next-env.d.ts`.
  - Risks: TypeScript incremental metadata or Next caches may write inside the disposable copy.
  - Rollback: revert source configuration; discard generated output rather than copying it to product paths.

## Parent acceptance criteria

The documented default and isolated workflows preserve type coverage and no longer rewrite a tracked bootstrap file.

## Completion receipt

- Disposable reproduction confirmed that Next 15.5.22 alternated the tracked generated file between SHA-256 `95c5e6b31f13db907e9fe5d7cd72edd186321a0c7a8fb2d89129029fb289c276` for `.next/types/routes.d.ts` and `8d7005cad1aa9b508709582440b50042c0aa11ca0c7c60f765732700359159aa` for `.next-player-forecasts/types/routes.d.ts`.
- `next-bootstrap.d.ts` now owns stable tracked Next/image declarations. Next's workflow-specific `next-env.d.ts` is generated and ignored, and `tsconfig.json` excludes it plus `.next*` trees because this Pages Router project does not enable typed routes.
- In a disposable copy with no generated bootstrap or `.next*` tree, TypeScript passed with `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`. Default `npm run dev` and isolated `PLAYER_FORECAST_ISOLATED_NEXT=1 npm run dev:stable` each reached Ready, generated the expected ignored reference, and left all tracked bootstrap/configuration files clean. The default 4 GiB Node heap exhausted on the current repository type surface; the bounded 6 GiB run passed without changing the contract.

## Risks and rollback

All runtime reproduction belongs in a disposable copy. Do not treat generated cache cleanup as product work.

# AUDIT-TASK-011: Expand lint authority to active first-party trees

- Finding IDs: FIND-DX-002
- Source candidate IDs: `DOCOPS-FIND-003`
- Priority: P2
- Status: Completed
- Affected paths: `web/eslint.config.mjs`, `web/package.json`, and active omitted trees such as `web/contexts/`, `web/utils/`, `web/__tests__/`, `web/e2e/`, and root-level web TypeScript files
- Depends on: None
- Product decision gate: None

## Objective

Make `npm run lint` explicitly cover the active first-party JS/TS/React trees while retaining deliberate generated/evidence exclusions.

## Evidence-backed scope

The config supports broad matching, but the canonical script names only `pages components lib hooks`. Current `web/package.json` adds unrelated forecast scripts; the lint command remains unchanged.

## Non-goals

Do not add a formatter, rewrite existing style wholesale, lint generated/audit/vendor output, or make every existing warning an unrelated cleanup project.

## Atomic subtasks

- [x] AUDIT-TASK-011.1 — Define and review the exact lint universe.
  - Paths: `web/eslint.config.mjs`, `web/package.json`, active web source/test directories
  - Depends on: None
  - Acceptance criteria: each active first-party JS/TS tree is included or carries an evidence-backed exclusion; generated, cache, dependency, and retained audit data are excluded.
  - Validation: compare `rg --files web` source/test results with the script/config path set; do not dump ignored secret files.
  - Risks: broad globs can traverse generated corpora or make lint prohibitively noisy.
  - Rollback: retain the reviewed path matrix and restore the prior command if scope is wrong.
- [x] AUDIT-TASK-011.2 — Update the canonical lint command/config without disturbing current package edits.
  - Paths: `web/package.json`, `web/eslint.config.mjs`
  - Depends on: AUDIT-TASK-011.1
  - Acceptance criteria: `npm run lint` covers the approved set exactly; current forecast script entries and unrelated formatting remain intact.
  - Validation: from `web/`, `npm run lint`; capture bounded errors/warnings by path.
  - Risks: newly exposed existing violations can obscure whether scope wiring is correct.
  - Rollback: revert only lint path/config changes, not concurrent package scripts.
- [x] AUDIT-TASK-011.3 — Resolve only blocking findings exposed by newly in-scope active files.
  - Paths: only files that fail because AUDIT-TASK-011.2 newly includes them
  - Depends on: AUDIT-TASK-011.2
  - Acceptance criteria: lint completes with zero errors; warnings are either existing policy-accepted warnings or have a finding-specific disposition.
  - Validation: from `web/`, `npm run lint`; no full build.
  - Risks: this can expand into stylistic cleanup if not bounded to blocking findings.
  - Rollback: revert per-file lint-only fixes that change runtime behavior; retain the scope contract.

## Parent acceptance criteria

One documented lint command covers all approved active first-party trees, excludes generated/evidence content deliberately, and exits without errors.

## Risks and rollback

Preserve the current `web/package.json` worktree additions. Do not convert pre-existing non-blocking warnings into an unbounded cleanup task.

## Execution checkpoint — 2026-08-19

- The canonical command now runs ESLint from the web root, covering active root files plus pages, components, libraries, hooks, contexts, utilities, tests, E2E, scripts, stories, styles, and types. Flat-config ignores explicitly retain dependency, cache, browser-output, generated Next/bootstrap, public-asset, and script-output boundaries.
- The pre-change four-tree command passed with 53 warnings. The expanded command initially exposed only two errors, both unescaped quote characters in the active Storybook page; that exact blocking markup was corrected without runtime behavior change.
- Final `npm run lint` exits zero with 62 warnings and no errors. The nine added warnings are from newly covered test mocks under the existing warning-level image/accessibility policy; they were recorded rather than expanded into unrelated image refactors. Concurrent player-forecast script entries in `web/package.json` remain unchanged.

# AUDIT-TASK-012: Align repository setup and editor launch authority

- Finding IDs: FIND-DOC-001, FIND-DX-003
- Source candidate IDs: `DOCOPS-FIND-005`, `DOCOPS-FIND-010`
- Priority: P3
- Status: Completed
- Affected paths: `README.md`, `AGENTS.md`, `web/README.md`, `web/.nvmrc`, `web/package.json`, `web/.vscode/launch.json`
- Depends on: None
- Product decision gate: None

## Objective

Give contributors one npm/Node-authoritative repository entrypoint and make VS Code launch commands follow it.

## Evidence-backed scope

The root README uses `npm install`, omits Node 22.11.0, and maps only web/CMS despite current functions/database boundaries; both editor launch entries run Yarn despite npm/package-lock authority. The only current `web/package.json` drift adds unrelated forecast scripts.

## Non-goals

Do not install dependencies, create a root package manifest, change package managers, rewrite package-specific runbooks, or document speculative services.

## Atomic subtasks

- [x] AUDIT-TASK-012.1 — Make the root README a concise boundary and setup index.
  - Paths: `README.md`, `AGENTS.md`, `web/README.md`, `web/.nvmrc`, `web/package.json`, current boundary manifests/docs
  - Depends on: None
  - Acceptance criteria: Node 22.11.0 and `npm ci`/`web/package-lock.json` authority are explicit; web, CMS, functions, database assets, and any currently evidenced standalone service are mapped to their owning docs/commands.
  - Validation: manually compare every documented command to current manifests and `AGENTS.md`; `git diff --check`.
  - Risks: duplicating package details at root can drift again.
  - Rollback: restore root prose while preserving package-level authorities.
- [x] AUDIT-TASK-012.2 — Replace unsupported Yarn launch commands with npm-authoritative commands.
  - Paths: `web/.vscode/launch.json`, `web/package.json`, `web/README.md`
  - Depends on: AUDIT-TASK-012.1
  - Acceptance criteria: both launch entries use existing npm scripts; the stable watcher variant is named where relevant; no package install or lockfile change occurs.
  - Validation: static JSON/manifest comparison and manual VS Code launch configuration inspection.
  - Risks: launch working directory may differ from terminal documentation.
  - Rollback: restore launch entries only after recording why an npm script cannot satisfy the editor contract.
- [x] AUDIT-TASK-012.3 — Verify documentation and launch references stay synchronized.
  - Paths: `README.md`, `web/README.md`, `web/.vscode/launch.json`, `web/package.json`
  - Depends on: AUDIT-TASK-012.2
  - Acceptance criteria: every referenced script exists exactly once in `web/package.json`; no setup text recommends Yarn or non-reproducible install for web.
  - Validation: from root, `rg -n "yarn|npm install|npm ci|22\.11\.0" README.md web/README.md web/.vscode/launch.json web/package.json`; manual adjudication of legitimate Yarn references outside the web authority.
  - Risks: a broad search can flag the separately documented functions dev command, which must not be mechanically replaced.
  - Rollback: revert only incorrect documentation/editor changes.

## Parent acceptance criteria

Root onboarding accurately maps current boundaries and defers to package authorities; VS Code launches the existing npm scripts; unrelated `web/package.json` changes are preserved.

## Completion receipt

- The root README now establishes Node 22.11.0, `npm ci`, and `web/package-lock.json` authority for the primary app, states that no root package manifest exists, and maps the current web, CMS, functions, Supabase/current-migration, supplementary SQL, and CI boundaries to their owning files. The retired `webhooks/` boundary is not presented as current.
- The two VS Code server launch entries now invoke the existing `dev` and `dev:stable` npm scripts from the web workspace. The stable full-stack entry is named explicitly, and its readiness expression captures the current Next 15 `Local:` URL output.
- Both launch files parse, both referenced scripts exist, every root README repository link resolves, and `git diff --check` passes. AUDIT-TASK-010's disposable runtime proof reached Ready through both npm commands. The pre-existing player-forecast additions in `web/package.json` were not edited.

## Risks and rollback

Do not replace the separately documented root functions command merely because it uses Yarn; this task resolves the web package authority only.

# AUDIT-TASK-013: Repair active documentation path portability and reachability

- Finding IDs: FIND-DOC-002, FIND-DOC-003
- Source candidate IDs: `DOCOPS-FIND-006`, `DOCOPS-FIND-007`
- Priority: P2
- Status: Completed
- Affected paths: the exact 212-path and 166-path sets in `docs/repository-audit/enhancement-ledger.jsonl#FIND-DOC-002.affected_files` and `#FIND-DOC-003.affected_files`, filtered by `docs/repository-audit/documentation-cleanup-ledger.jsonl`
- Depends on: None
- Product decision gate: None at parent level; individual `Needs owner decision` documents remain blocked until classified.

## Objective

Restore portable, resolving links in active retained documentation without rewriting historical archive evidence or treating absent targets as deletion proof.

## Evidence-backed scope

The audit counted 2,044 developer-local absolute paths in 212 files and 782 absent repository-path targets in 166 files. Cleanup status limits direct remediation to 91 Keep plus three Needs-owner-decision files for absolute paths, and 70 Keep plus nine Needs-owner-decision files for absent targets; the active union is 126 files. The 118/87 Archive subsets retain historical fidelity.

## Non-goals

Do not rewrite Archive prose, manufacture replacement targets, delete/move files, normalize all Markdown style, or edit `docs/repository-audit/` evidence.

## Atomic subtasks

- [x] AUDIT-TASK-013.1 — Materialize the current bounded working set from canonical ledgers.
  - Paths: `docs/repository-audit/enhancement-ledger.jsonl`, `docs/repository-audit/documentation-cleanup-ledger.jsonl`, `tasks/TASKS/repository-audit-remediation/document-reference-working-set.md`
  - Depends on: None
  - Acceptance criteria: the working set lists all 126 unique Keep/Needs-owner-decision paths, finding type, current existence, cleanup status, and current hash; Archive paths are counted but excluded from rewriting.
  - Validation: reconcile 94 absolute-path candidates, 79 absent-target candidates, 47-path active overlap, and 126-path active union against the frozen ledgers.
  - Risks: current path drift can make frozen counts unsuitable as live edit counts.
  - Rollback: remove only the generated working-set file; never alter the frozen ledgers.
- [x] AUDIT-TASK-013.2 — Repair developer-local paths in Keep documents.
  - Paths: the 91 `FIND-DOC-002` paths whose cleanup status is Keep
  - Depends on: AUDIT-TASK-013.1
  - Acceptance criteria: each developer-local absolute link becomes a repository-relative link or a clearly non-link historical literal; the target resolves in a fresh clone layout.
  - Validation: review changed Markdown links from repository root and confirm every changed target exists; `git diff --check`.
  - Risks: mechanical replacement can corrupt prose, line references, or evidence receipts.
  - Rollback: revert one document cohort at a time using the working-set record.
- [x] AUDIT-TASK-013.3 — Repair absent targets in Keep documents.
  - Paths: the 70 `FIND-DOC-003` paths whose cleanup status is Keep
  - Depends on: AUDIT-TASK-013.1; coordinate overlapping files with AUDIT-TASK-013.2
  - Acceptance criteria: each link is corrected to an evidenced current target, replaced by an archive/relocation explanation, or explicitly labeled unresolved; no target is invented.
  - Validation: manual target-existence and semantic review for every changed link; `git diff --check`.
  - Risks: an absent path may intentionally document deleted history.
  - Rollback: restore the historical wording when no authoritative replacement exists.
- [ ] AUDIT-TASK-013.4 — Resolve the blocked per-document cleanup statuses.
  - Paths: the three/ nine Needs-owner-decision subsets identified by AUDIT-TASK-013.1
  - Depends on: AUDIT-TASK-013.1
  - Acceptance criteria: an owner classifies each document Keep or Archive/Merge; only newly confirmed Keep documents proceed through the relevant repair subtask.
  - Validation: owner receipt linked from the working set; no edit while status remains undecided.
  - Risks: treating a folder name such as `archive/` as status evidence contradicts the cleanup ledger.
  - Rollback: retain the prior document unchanged and mark the decision unresolved.
  - Deferred: 11 unique Needs-owner-decision documents remain byte-for-byte unchanged pending owner classification; this owner-gated branch does not block completion of the executable Keep scope.
- [x] AUDIT-TASK-013.5 — Reconcile the completed live edit set without changing frozen evidence.
  - Paths: all documents actually changed by AUDIT-TASK-013.2-.4 and the working-set file
  - Depends on: AUDIT-TASK-013.2, AUDIT-TASK-013.3, resolved branches of AUDIT-TASK-013.4
  - Acceptance criteria: every working-set row has repaired/deferred/unresolved disposition; Archive files are unchanged; no absolute machine-local link remains in changed active documents; changed links resolve or carry an explicit blocker.
  - Validation: bounded `rg` over the changed-path list for `/Users/`, `file://`, and recorded absent targets; `git diff --check`.
  - Risks: scanning the whole repository can produce historical noise and tempt scope expansion.
  - Rollback: revert by document cohort; keep the reconciliation record.

## Parent acceptance criteria

All current Keep documents in the bounded ledger sets are portable or explicitly unresolved, owner-gated documents are not silently edited, and Archive fidelity is preserved.

## Completion receipt

- The [bounded working set](document-reference-working-set.md) reconciles 126 active documents: 115 Keep and 11 Needs owner decision; all rows have current hashes and non-pending dispositions.
- Of the Keep documents, 108 were repaired and seven required no edit. The repaired set resolves 396 links directly, relocates 154 references, converts ten missing links to explicit unresolved statements, and removes developer-local machine paths without manufacturing targets.
- Validation found zero broken Markdown links, zero `/Users/` or `file://` references, and zero unlabeled absent-path references across the 115-document Keep set. All 11 owner-gated documents and all affected Archive documents remain unchanged; `git diff --check` passes for the Keep edit set.

## Risks and rollback

This is a large but mechanical surface. Use small review cohorts and the canonical path sets; do not turn it into general documentation cleanup.

# AUDIT-TASK-014: Reconcile rolling-player pass-two completion state

- Finding IDs: FIND-DOC-004
- Source candidate IDs: `DOCOPS-FIND-008`
- Priority: P2
- Status: Completed
- Affected paths: `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md`, `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/rpm-audit-action-items-pass-2.md`, `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-rpm-audit-action-items-pass-2.md`
- Depends on: None
- Product decision gate: Resolved — receipt-proven work is complete, unmatched follow-up is deferred, and all three documents are retained.

## Objective

Make rolling-player pass-two status truthful by mapping every open/planned item to completion evidence, intentional deferral, or a current owner.

## Evidence-backed scope

One source retains fourteen open and one planned status while the paired task list is fully checked and the super-goal says complete. All three files remain byte-identical.

## Non-goals

Do not execute rolling-player jobs, reopen completed work without evidence, archive/delete documents automatically, or rewrite technical history.

## Atomic subtasks

- [x] AUDIT-TASK-014.1 — **OWNER DECISION:** adjudicate every contradictory status row.
  - Paths: all three affected documents and their cited completion receipts
  - Depends on: None
  - Acceptance criteria: each of the fourteen open and one planned entries maps to a receipt, an intentional deferral with owner/date, or active work with owner/next evidence.
  - Validation: row-by-row receipt comparison and rolling-player owner sign-off.
  - Risks: checkbox completion may not prove the underlying operational result.
  - Rollback: preserve original status text in history and make no edit before sign-off.
- [x] AUDIT-TASK-014.2 — Update canonical status documents consistently.
  - Paths: the three affected documents
  - Depends on: AUDIT-TASK-014.1
  - Acceptance criteria: the documents agree on complete/deferred/active totals and link the same receipts; no item disappears without a disposition.
  - Validation: from root, `rg -n "open|planned|complete|deferred" tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md tasks/TASKS/three-pillars-analytics/rolling-player-metrics/rpm-audit-action-items-pass-2.md tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-rpm-audit-action-items-pass-2.md`; manual count reconciliation.
  - Risks: duplicated summaries can drift again.
  - Rollback: restore all three documents together, preserving the decision receipt.
- [x] AUDIT-TASK-014.3 — Decide retention only after status parity.
  - Paths: the three affected documents
  - Depends on: AUDIT-TASK-014.2
  - Acceptance criteria: each document remains Keep/Archive/Merge according to unique knowledge and current consumers; no deletion task is created.
  - Validation: cleanup-ledger criteria and reference/history check.
  - Risks: archiving too early can hide genuinely active work.
  - Rollback: retain documents in place with a canonical-status banner.

## Parent acceptance criteria

Every contradictory item has an owner-approved disposition and all three sources report the same completion state with receipts.

## Completion receipt

- The fourteen contradictory rolling-player rows now reconcile to thirteen receipt-proven completions and one explicitly deferred alias-retirement item. Together with the eight already-complete rows, the canonical pass-two source reports 21 Done, one Deferred, and zero Open/Planned items; a separate PK source-tail follow-up remains visibly deferred outside that count.
- `rolling-player-pass-2-status-reconciliation.md` is the row-level authority and records each receipt, deferral rationale, owner, and revisit point. Both task documents and the super-goal summary link that authority instead of carrying divergent status claims.
- All three source documents remain Keep because they retain distinct technical history, task detail, and program-level context. Exact counts and linked evidence paths reconcile, and `git diff --check` passes. No rolling-player job or data mutation was run.

## Risks and rollback

Status truth, not archival tidiness, is the outcome. Keep uncertainty visible until an owner decides.

# AUDIT-TASK-015: Remove unpinned automatic editor MCP execution

- Finding IDs: FIND-SEC-005
- Source candidate IDs: `DOCOPS-FIND-009`
- Priority: P2
- Status: Completed
- Affected paths: `.vscode/mcp_config.json` and an opt-in contributor note only if the integration is retained
- Depends on: None
- Product decision gate: Resolved — shared repository configuration is inert; optional integrations are contributor-controlled.

## Objective

Prevent repository-local editor activation from silently fetching and executing a changing network package.

## Evidence-backed scope

The checked-in configuration uses `npx -y` with an unversioned package. The file remains byte-identical; no package was fetched or executed during planning.

## Non-goals

Do not run the MCP server, install or upgrade packages, inspect tokens, prescribe an editor to all contributors, or delete configuration without the owner decision.

## Atomic subtasks

- [x] AUDIT-TASK-015.1 — **OWNER DECISION:** choose repository-wide opt-in, inert template, or no shared activation.
  - Paths: `.vscode/mcp_config.json`, contributor setup documentation if evidenced
  - Depends on: None
  - Acceptance criteria: the tooling owner records intended audience, activation gesture, network boundary, reviewed package source, and version/lock authority.
  - Validation: owner sign-off and static config review; no command execution.
  - Risks: a personal editor preference can become an implicit organization-wide trust decision.
  - Rollback: leave the current file unchanged until a decision is recorded.
- [x] AUDIT-TASK-015.2 — Implement an explicit, pinned, non-automatic configuration outcome.
  - Paths: `.vscode/mcp_config.json`, approved contributor note or locked local tool path
  - Depends on: AUDIT-TASK-015.1
  - Acceptance criteria: editor startup cannot execute an unpinned network package without an explicit contributor action; any retained command uses a reviewed immutable version or locked local path and documents network/auth boundaries.
  - Validation: static inspection confirms no `npx -y` unversioned execution and no secret value in source.
  - Risks: pinning a version without lock/provenance review gives false confidence.
  - Rollback: restore an inert documented template, not automatic unpinned execution.
- [x] AUDIT-TASK-015.3 — Verify the repository configuration without launching the tool.
  - Paths: `.vscode/mcp_config.json`, documentation changed in AUDIT-TASK-015.2
  - Depends on: AUDIT-TASK-015.2
  - Acceptance criteria: configuration parses, activation remains opt-in, and instructions contain no credential values.
  - Validation: manual JSON/config parse and `rg -n "npx|--yes|-y|@latest" .vscode/mcp_config.json`; do not run the command.
  - Risks: editor-specific behavior may still auto-start a syntactically valid command.
  - Rollback: disable the shared server entry while retaining setup documentation.

## Parent acceptance criteria

No checked-in editor configuration automatically executes an unpinned network package, and the contributor trust boundary is explicit.

## Completion receipt

- `.vscode/mcp_config.json` is now a valid inert configuration with no shared server entries, commands, arguments, network package resolution, or automatic activation.
- The root README states that optional editor integrations belong in personal settings and require explicit contributor trust for package source, version, network access, and credentials.
- JSON parsing succeeds, and bounded static inspection finds no `npx`, `--yes`, `-y`, or `@latest` activation. No MCP package was installed, fetched, or launched.

## Risks and rollback

Treat any package/version change as supply-chain review, not dependency modernization.

# AUDIT-TASK-016: Make desktop navigation submenus keyboard-operable

- Finding IDs: FIND-A11Y-001
- Source candidate IDs: `FE-FINDING-002`
- Priority: P2
- Status: Completed
- Affected paths: `web/components/Layout/NavbarItems/NavbarItems.tsx`, `web/components/Layout/NavbarItems/NavbarItems.module.scss`, `web/__tests__/components/Layout/Header.test.tsx`
- Depends on: None
- Product decision gate: None

## Objective

Give every desktop navigation category a focusable disclosure contract equivalent to pointer hover.

## Evidence-backed scope

Current category triggers are not focusable buttons and CSS opens submenus through hover. Both affected source files remain byte-identical.

## Non-goals

Do not redesign navigation, change destination membership (AUDIT-TASK-017), add a new navigation framework, or alter mobile information architecture.

## Atomic subtasks

- [x] AUDIT-TASK-016.1 — Define the disclosure interaction contract.
  - Paths: `web/components/Layout/NavbarItems/NavbarItems.tsx`, `web/components/Layout/NavbarItems/NavbarItems.module.scss`
  - Depends on: None
  - Acceptance criteria: trigger, focus movement, Escape, outside focus, pointer hover, `aria-expanded`, `aria-controls`, and submenu focus behavior are specified.
  - Validation: compare with WAI-ARIA disclosure/navigation behavior and current DOM/CSS; no browser needed.
  - Risks: mixing menubar and disclosure patterns can create conflicting keyboard expectations.
  - Rollback: retain the written interaction contract.
- [x] AUDIT-TASK-016.2 — Implement native disclosure triggers and focus-visible styling.
  - Paths: `web/components/Layout/NavbarItems/NavbarItems.tsx`, `web/components/Layout/NavbarItems/NavbarItems.module.scss`
  - Depends on: AUDIT-TASK-016.1
  - Acceptance criteria: each category trigger is natively focusable; keyboard and pointer can open/close it; focus never becomes trapped; links retain destinations and order.
  - Validation: from `web/`, `npx tsc --noEmit` and `npm run lint`.
  - Risks: CSS hover and component state can race, leaving menus stuck open.
  - Rollback: revert component/CSS together; do not remove the native focus target independently.
- [x] AUDIT-TASK-016.3 — Add keyboard-specific regression tests.
  - Paths: `web/__tests__/components/Layout/Header.test.tsx`, NavbarItems implementation
  - Depends on: AUDIT-TASK-016.2
  - Acceptance criteria: Tab reaches each trigger; Enter/Space toggles; Escape closes and restores focus; accessible names and expanded state are asserted.
  - Validation: from `web/`, `npm test -- __tests__/components/Layout/Header.test.tsx`.
  - Risks: tests that bypass real focus events can pass while browser behavior fails.
  - Rollback: keep semantic assertions and remove only environment-fragile event detail.
- [x] AUDIT-TASK-016.4 — Verify desktop keyboard and pointer parity.
  - Paths: `web/components/Layout/NavbarItems/NavbarItems.tsx`, `web/components/Layout/NavbarItems/NavbarItems.module.scss`, `web/components/Layout/Header/Header.tsx`
  - Depends on: AUDIT-TASK-016.3
  - Acceptance criteria: at 1440×900, all destinations are reachable by keyboard and pointer with visible focus and no overlap/clipping.
  - Validation: manual local browser keyboard walkthrough; no authenticated service required.
  - Risks: shared shell may request third-party telemetry/resources; use a controlled local environment.
  - Rollback: revert visual positioning separately only if semantics remain intact.

## Parent acceptance criteria

Desktop submenus provide equivalent keyboard, focus, and pointer access with focused regression coverage.

## Risks and rollback

Preserve link order and routes. AUDIT-TASK-017 owns destination parity and must not be silently folded into this change.

## Execution checkpoint — 2026-08-19

- Desktop categories are native disclosure buttons with stable `aria-expanded`/`aria-controls` relationships. Local disclosure state is separated from transient hover state; focus leaving a category closes it, and Escape closes it and restores trigger focus. Destination labels, hrefs, order, and mobile membership remain unchanged.
- Focused Header coverage passes all nine tests, including native focus order, Enter/Space activation, Escape restoration, outside-focus closure, pointer enter/leave parity, and accessible state. The full TypeScript check and expanded repository lint command also pass; lint retains the previously recorded warning-only baseline.
- Local runtime inspection at 1440×900 confirmed hover and click parity, seven reachable Tools links, no horizontal overflow, and submenu bounds fully inside the viewport. The in-app browser backend did not transmit synthetic Tab/Enter/Space/Escape events, so runtime keyboard injection was not claimed; keyboard behavior is evidenced by native controls plus focused DOM/focus-event tests.

# AUDIT-TASK-017: Define and implement cross-viewport navigation membership

- Finding IDs: FIND-UX-001
- Source candidate IDs: `FE-FINDING-003`
- Priority: P3
- Status: Completed
- Affected paths: `web/components/Layout/NavbarItems/NavbarItemsData.ts`, `web/components/Layout/MobileMenu/MobileMenu.tsx`, `web/components/Layout/Header/Header.tsx`, navigation tests
- Depends on: AUDIT-TASK-016 for implementation only; the owner decision may occur immediately
- Product decision gate: Resolved — all eight omitted destinations are secondary mobile destinations in a bounded `More` group.

## Objective

Make desktop/mobile navigation differences intentional and ensure all owner-designated primary destinations are available on mobile.

## Evidence-backed scope

Mobile omits Underlying Stats, Trends, NHL Predictions, Splits, Draft Dashboard, Start Chart, Variance Skaters, and Variance Goalies. Current files remain byte-identical; omission alone does not prove all eight belong in mobile primary navigation.

## Non-goals

Do not copy every desktop item into mobile, redesign the header, change route status, or infer product priority from existing order.

## Atomic subtasks

- [x] AUDIT-TASK-017.1 — **OWNER DECISION:** classify the eight destinations.
  - Paths: `web/components/Layout/NavbarItems/NavbarItemsData.ts`, `web/components/Layout/MobileMenu/MobileMenu.tsx`
  - Depends on: None
  - Acceptance criteria: each destination is labeled primary, secondary, or intentionally desktop-only, with desired mobile grouping/order and rationale.
  - Validation: product-owner sign-off against the exact eight-route list.
  - Risks: route popularity is not available from the frozen audit and must not be invented.
  - Rollback: no implementation before decision.
- [x] AUDIT-TASK-017.2 — Use one owner-approved navigation data contract across viewports.
  - Paths: `web/components/Layout/NavbarItems/NavbarItemsData.ts`, `web/components/Layout/MobileMenu/MobileMenu.tsx`, `web/components/Layout/Header/Header.tsx`
  - Depends on: AUDIT-TASK-017.1, AUDIT-TASK-016
  - Acceptance criteria: primary destinations derive from one contract; intentional desktop-only/secondary routes remain explicit; labels/hrefs are not duplicated inconsistently.
  - Validation: from `web/`, `npx tsc --noEmit` and `npm run lint`.
  - Risks: shared data can erase legitimate presentation differences if it encodes layout instead of membership.
  - Rollback: restore per-viewport rendering while retaining the signed membership contract.
- [x] AUDIT-TASK-017.3 — Add route-membership and mobile interaction tests.
  - Paths: `web/__tests__/components/Layout/Header.test.tsx`, mobile menu implementation
  - Depends on: AUDIT-TASK-017.2
  - Acceptance criteria: tests assert every primary route appears in both contracts, secondary/desktop-only decisions remain explicit, and mobile links close/navigate as before.
  - Validation: from `web/`, `npm test -- __tests__/components/Layout/Header.test.tsx`.
  - Risks: snapshots can hide semantic omissions.
  - Rollback: retain explicit membership assertions and remove only brittle markup assertions.
- [x] AUDIT-TASK-017.4 — Verify mobile organization without redesign.
  - Paths: `web/components/Layout/MobileMenu/MobileMenu.tsx`, `web/components/Layout/Header/Header.tsx`, `web/components/Layout/NavbarItems/NavbarItemsData.ts`
  - Depends on: AUDIT-TASK-017.3
  - Acceptance criteria: all designated primary items are reachable, readable, and keyboard/touch operable without clipping or an unbounded list.
  - Validation: manual local browser check at mobile/tablet viewports.
  - Risks: adding destinations can exceed viewport height.
  - Rollback: change grouping/order, not the approved membership classification.

## Parent acceptance criteria

Navigation membership is owner-approved, encoded once, tested across viewports, and usable on mobile without assuming every desktop destination is primary.

## Completion receipt

- `NavbarItemsData.ts` now owns mobile tier, icon, label, and order metadata for every navigation link. The existing nine mobile destinations remain primary; Underlying Stats, Trends, NHL Predictions, Splits, Draft Dashboard, Start Chart, Variance Skaters, and Variance Goalies are the approved secondary set.
- `MobileMenu` derives both `Navigation` and bounded `More` groups from that contract, while the bottom header derives Home, Game Grid, and Stats from the same primary data. Entry-point focus behavior and close-on-link activation are preserved.
- The focused Header suite passes 11 tests, including exact primary/secondary membership and rendering all eight secondary links. Targeted lint has no errors, the full TypeScript check passes, and local inspection at 390×844 confirms all eight links are readable and addressable in `More` without document overflow.

## Risks and rollback

Complete AUDIT-TASK-016 semantics before changing the shared desktop navigation implementation.

# AUDIT-TASK-018: Restore native semantics for shared custom click targets

- Finding IDs: FIND-A11Y-002
- Source candidate IDs: `FE-FINDING-008`
- Priority: P2
- Status: Completed
- Affected paths: `web/components/Options/Options.tsx`, `web/components/Select/Select.tsx`, `web/components/Rankings/GoalieMatrixTable.tsx`, `web/components/Rankings/PlayerMatrixTable.tsx`, `web/components/Rankings/TeamMatrixTable.tsx`, `web/components/TeamDashboard/GameByGameTimeline.tsx`, and focused tests
- Depends on: None
- Product decision gate: None

## Objective

Convert only semantically actionable custom click targets to native or equivalent keyboard-accessible controls, starting with shared primitives.

## Evidence-backed scope

A quantified scan found 30 candidates across 20 files; the six affected files contain concrete shared/table/timeline instances. Each candidate still needs semantic adjudication, so blanket conversion is prohibited. Current affected files remain byte-identical.

## Non-goals

Do not convert neutral layout containers, redesign tables, create a universal interaction abstraction, or add ARIA where a native element is sufficient.

## Atomic subtasks

- [x] AUDIT-TASK-018.1 — Adjudicate the concrete candidate instances.
  - Paths: the six affected component files; candidate evidence under `FIND-A11Y-002`
  - Depends on: None
  - Acceptance criteria: every cited click target is classified action/link/selection/neutral; only actionable instances enter implementation; expected accessible name and keyboard behavior are recorded.
  - Validation: source-level semantic review, not regex count alone.
  - Risks: treating event presence as semantics creates false positives.
  - Rollback: retain the adjudication matrix.
- [x] AUDIT-TASK-018.2 — Correct shared `Options` and `Select` primitives.
  - Paths: `web/components/Options/Options.tsx`, `web/components/Select/Select.tsx`, `web/components/Options/Options.test.tsx`, `web/components/Select/Select.test.tsx`
  - Depends on: AUDIT-TASK-018.1
  - Acceptance criteria: actionable items use native controls where possible, expose names/state, activate with keyboard, and preserve pointer behavior.
  - Validation: from `web/`, `npm test -- components/Options/Options.test.tsx components/Select/Select.test.tsx`, then `npx tsc --noEmit`.
  - Risks: shared primitive behavior can affect many consumers.
  - Rollback: revert one primitive at a time and retain semantic tests.
- [x] AUDIT-TASK-018.3 — Correct ranking-table and timeline instances.
  - Paths: the three MatrixTable files, `web/components/TeamDashboard/GameByGameTimeline.tsx`, `web/components/Rankings/PlayerMatrixTable.test.tsx`, `web/components/TeamDashboard/TeamDashboard.test.tsx`
  - Depends on: AUDIT-TASK-018.1; after AUDIT-TASK-018.2 when the shared primitive is used
  - Acceptance criteria: actionable cells/rows/timeline controls have native semantics or justified keyboard equivalents; neutral cells remain neutral; focus order is predictable.
  - Validation: from `web/`, `npm test -- components/Rankings/PlayerMatrixTable.test.tsx components/TeamDashboard/TeamDashboard.test.tsx` and `npx tsc --noEmit`.
  - Risks: changing a whole row to a button can invalidate table semantics.
  - Rollback: revert per instance, not the shared accessibility contract.
- [x] AUDIT-TASK-018.4 — Perform a focused keyboard/accessible-name check.
  - Paths: representative Options, Select, ranking table, and timeline consumers
  - Depends on: AUDIT-TASK-018.2, AUDIT-TASK-018.3
  - Acceptance criteria: Tab order, Enter/Space activation, visible focus, name, role, and state work without duplicate activation.
  - Validation: manual local browser/assistive-tree inspection using deterministic data.
  - Risks: representative consumers may not cover all shared primitive states.
  - Rollback: revert the affected instance while keeping passing primitive tests.

## Parent acceptance criteria

Every adjudicated actionable instance has native/equivalent keyboard semantics and focused tests; neutral containers are unchanged.

## Risks and rollback

Shared primitives have broad blast radius. Land and validate them before leaf instances.

## Execution checkpoint — 2026-08-19

- Instance adjudication classified shared option/selection widgets, matrix selection, timeline view selection, timeline game disclosure, and details closure as actions. Metric tiles, cells, and layout containers remain neutral. Redundant whole-row matrix click handlers were removed instead of assigning invalid button semantics to table rows.
- `Options` now renders named native toggle buttons with `aria-pressed`; `Select` is a named native select. Current consumers provide contextual names for chart type, time range, team, and linemate-matrix mode. Matrix selection remains a native button with an entity-specific name and pressed state. Timeline tabs and game cards are native buttons with state/relationships, and the close button has an explicit name.
- Five focused files pass 12 tests covering primitive roles/state/activation, neutral matrix rows, named selectors, and timeline disclosure/closure. The full TypeScript check passes; targeted lint has zero errors and only four pre-existing image warnings. Live `/rankings` inspection at 1440×900 exposed ten uniquely named native selectors and synchronized `aria-pressed` state after selection. Deterministic accessibility-tree tests cover shared controls and timeline states whose data-dependent consumers were not reliably present on local routes.
- The later repository-wide unit run exposed three page-level assertions that still clicked the former rank/row targets. They now select Matt Savoie, Casey DeSmith, and Dallas through the approved `Select <entity>` buttons; the focused Rankings page file passes 5/5 and the final credential-free full suite passes 3,923 tests.

# AUDIT-TASK-019: Add small-screen and non-pointer access to the PP TOI chart

- Finding IDs: FIND-A11Y-003
- Source candidate IDs: `FE-FINDING-009`
- Priority: P2
- Status: Completed
- Affected paths: `web/components/PlayerPPTOIPerGameChart/PPTOIChart.tsx`, `web/styles/PPTOIChart.module.scss`, `web/pages/teamStats/[teamAbbreviation].tsx`, focused chart tests
- Depends on: None
- Product decision gate: None

## Objective

Make PP TOI values available on small screens and without hover while preserving the existing desktop visualization.

## Evidence-backed scope

The SVG chart is hover-driven and its owned stylesheet has no media query. Computed clipping was not runtime-verified, but absence of a keyboard/table alternative is deterministic. Current files remain byte-identical.

## Non-goals

Do not redesign the team page, change the legacy data source, replace the chart library, or claim runtime clipping that was not observed.

## Atomic subtasks

- [x] AUDIT-TASK-019.1 — Define the accessible value and responsive contract.
  - Paths: `web/components/PlayerPPTOIPerGameChart/PPTOIChart.tsx`, `web/styles/PPTOIChart.module.scss`
  - Depends on: None
  - Acceptance criteria: every plotted value has a non-hover path (table/list or keyboard focus), chart/table labeling is defined, and mobile layout behavior is explicit.
  - Validation: static data/DOM/style mapping against representative chart states.
  - Risks: duplicating values can confuse assistive technology unless one presentation is labeled correctly.
  - Rollback: retain the contract document/tests.
- [x] AUDIT-TASK-019.2 — Implement the non-pointer representation and owned responsive styles.
  - Paths: chart component and stylesheet
  - Depends on: AUDIT-TASK-019.1
  - Acceptance criteria: keyboard/touch users can obtain every value; mobile content fits 390px without horizontal loss; desktop chart remains available and labeled.
  - Validation: from `web/`, `npx tsc --noEmit` and `npm run lint`.
  - Risks: rendering chart plus table can duplicate content visually or for screen readers.
  - Rollback: revert layout rules while preserving a semantically correct fallback.
- [x] AUDIT-TASK-019.3 — Add focused data-access and interaction tests.
  - Paths: `web/components/PlayerPPTOIPerGameChart/PPTOIChart.test.tsx` (new focused test), chart component
  - Depends on: AUDIT-TASK-019.2
  - Acceptance criteria: representative values appear in the non-pointer path, keyboard focus exposes details if used, and empty data has an explicit state.
  - Validation: from `web/`, `npm test -- components/PlayerPPTOIPerGameChart/PPTOIChart.test.tsx`.
  - Risks: SVG geometry assertions are brittle and are not required.
  - Rollback: keep semantic value assertions and remove presentation-only assertions.
- [x] AUDIT-TASK-019.4 — Verify `/teamStats/[teamAbbreviation]` at all audit viewports.
  - Paths: `web/pages/teamStats/[teamAbbreviation].tsx`, chart component/styles
  - Depends on: AUDIT-TASK-019.3
  - Acceptance criteria: representative data is readable and operable at 1440×900, 834×1112, and 390×844 with keyboard and touch; any unavailable live data is recorded as a blocker.
  - Validation: manual local browser check with deterministic fixtures; no production service.
  - Risks: the route's legacy data authority can block realistic runtime data.
  - Rollback: revert only responsive layout changes that regress desktop; keep non-pointer access.

## Parent acceptance criteria

All PP TOI values are available without hover and at mobile width, backed by focused tests and three-viewport verification or an explicit runtime blocker.

## Risks and rollback

Do not conflate accessibility with the route's separate data-authority uncertainty.

## Execution checkpoint — 2026-08-19

- The visual SVG remains available, while an accessible figcaption directs non-visual users to a named exact-value table generated from the same month/season and player-selection state. Every plotted finite value has date, player, position, and formatted PP TOI percentage; loading, source error, and empty selections have explicit live states.
- Player checkboxes now apply the existing highlight behavior on keyboard focus as well as pointer hover. Owned responsive styles stack the chart shell below 768px and transform exact-value rows into labeled cards below 480px, avoiding duplicate chart narration while preserving all values for touch and keyboard users.
- The focused chart file passes two tests for complete/filter and empty states; targeted lint and the full TypeScript check pass. Live `/teamStats/EDM` verification found 143 exact-value rows at 1440×900, 834×1112, and 390×844. All three viewports had no document or value-wrapper horizontal overflow; mobile rows computed as labeled grids inside a 347px content area, and visual inspection confirmed readable stacked cards.

# AUDIT-TASK-020: Consolidate duplicated game-detail styles under one owner

- Finding IDs: FIND-STYLE-001
- Source candidate IDs: `FE-FINDING-004`; cleanup record `AUDIT-CLEAN-0001`
- Priority: P3
- Status: Completed
- Affected paths: `web/components/GamePreview/GamePreview.module.scss`, `web/components/GamePreview/GamePreview.tsx`, `web/pages/stats/game/[gameId].module.scss`, `web/pages/stats/game/[gameId].tsx`, and a narrowly shared partial only if selected
- Depends on: AUDIT-TASK-005 for implementation only
- Product decision gate: Resolved — a narrowly shared Sass partial owns common declarations while both CSS-module paths remain supported.

## Objective

Remove 451 lines of duplicated definitions through an owner-approved Merge while retaining both active route contracts and creating no deletion task.

## Evidence-backed scope

The two active 451-line CSS modules have the same SHA-256 and separate consumers. All four affected files remain byte-identical. Cleanup status is Merge, not Delete candidate.

## Non-goals

Do not redesign either route, delete either file, rename unrelated classes, generalize all game styles, or combine this with GamePreview correctness beyond sequencing after AUDIT-TASK-005.

## Atomic subtasks

- [x] AUDIT-TASK-020.1 — **OWNER DECISION:** select canonical ownership and compatibility shape.
  - Paths: both module files and both consumers
  - Depends on: None
  - Acceptance criteria: the game-detail UI owner selects one owner or a narrowly shared Sass partial and documents which route owns future changes; both consumers remain supported.
  - Validation: owner sign-off, import graph, and route responsibility review.
  - Risks: choosing ownership from path location alone ignores component responsibility.
  - Rollback: make no source change before the decision.
- [x] AUDIT-TASK-020.2 — Merge definitions without deleting active paths.
  - Paths: both module files, selected shared partial, both TSX consumers
  - Depends on: AUDIT-TASK-020.1, AUDIT-TASK-005
  - Acceptance criteria: declarations have one maintained source; both existing module paths/consumers resolve through the approved compatibility structure; no unrelated selector or class-name change.
  - Validation: from `web/`, `npx tsc --noEmit` and `npm run lint`; `shasum -a 256 components/GamePreview/GamePreview.module.scss pages/stats/game/[gameId].module.scss` confirms the former duplicate payload is no longer independently maintained.
  - Risks: Sass module scoping/import semantics can change generated class names.
  - Rollback: restore the two exact frozen style copies and prior imports.
- [x] AUDIT-TASK-020.3 — Verify both game surfaces at three viewports.
  - Paths: `web/pages/game/[gameId].tsx`, `web/components/GamePreview/GamePreview.tsx`, `web/components/GamePreview/GamePreview.module.scss`, `web/pages/stats/game/[gameId].tsx`, `web/pages/stats/game/[gameId].module.scss`
  - Depends on: AUDIT-TASK-020.2
  - Acceptance criteria: representative complete states match pre-merge organization at 1440×900, 834×1112, and 390×844; GamePreview unavailable state from AUDIT-TASK-005 also remains legible.
  - Validation: manual local browser comparison with deterministic fixtures; no production data.
  - Risks: byte-identical input does not guarantee both routes use the same subset of classes.
  - Rollback: restore per-route module content independently if scoped output differs.

## Parent acceptance criteria

One owner maintains the shared definitions, both route consumers remain intact at all viewports, and neither active file is deleted by this plan.

## Completion receipt

- `web/styles/_game-detail-shared.scss` now owns the shared declarations. Both original module paths remain active compatibility owners through the shared mixin, while `GamePreview.module.scss` retains only the five component-specific data-state selectors added by AUDIT-TASK-005.
- The compiled stats-game CSS is byte-identical to its pre-merge output (SHA-256 `73f5f7ba13542f059d321e83ce17b3ce2853393602cb127747a57554cca8638`), and both modules compile with their existing class names and import paths.
- The GamePreview suite passes five data-state tests, targeted lint has no errors, and the full TypeScript check passes. `/game/2026020001` and `/stats/game/2025020001` render without framework errors or horizontal overflow at 1440×900, 834×1112, and 390×844; the unavailable-data state remains covered by the focused component tests.

## Risks and rollback

Preserve CSS-module class identities. The exact frozen copies provide a straightforward source rollback.

# AUDIT-TASK-021: Resolve TeamLandingPage CSS/SCSS authority

- Finding IDs: FIND-STYLE-002
- Source candidate IDs: `FE-FINDING-005`; cleanup record `AUDIT-CLEAN-0002`
- Priority: P3
- Status: Completed
- Affected paths: `web/components/TeamLandingPage/teamLandingPage.css`, `web/components/TeamLandingPage/teamLandingPage.scss`, `web/pages/_app.tsx`
- Depends on: None
- Product decision gate: Resolved — SCSS is authoritative; the plain-CSS path is retained as an inert compatibility notice.

## Objective

Establish one maintained TeamLandingPage style authority without deleting a file or breaking an unobserved external/manual consumer.

## Evidence-backed scope

The 809-line CSS and SCSS normalize to the same content, while `_app.tsx` statically imports only SCSS. Dynamic/manual/build consumers were not ruled out. Current files remain byte-identical; cleanup status is Needs owner decision.

## Non-goals

Do not delete either file, redesign TeamLandingPage, migrate global styles generally, or treat absence of static imports as abandonment evidence.

## Atomic subtasks

- [x] AUDIT-TASK-021.1 — **OWNER DECISION:** establish the CSS file's generation/consumer contract.
  - Paths: both style files, `web/pages/_app.tsx`, build/deploy configuration and relevant history
  - Depends on: None
  - Acceptance criteria: owner evidence identifies SCSS, CSS, or an external generator as authority and records every consumer; unknown means no merge implementation.
  - Validation: static import/build input review, bounded Git history, and owner sign-off.
  - Risks: manual CMS/CDN consumers will not appear in TypeScript imports.
  - Rollback: leave both files unchanged while authority is unknown.
- [x] AUDIT-TASK-021.2 — Merge duplicate maintenance under the selected authority.
  - Paths: both style files and `_app.tsx`
  - Depends on: AUDIT-TASK-021.1
  - Acceptance criteria: if SCSS is authoritative and zero-consumer proof exists, the CSS path becomes a small documented compatibility/generation stub rather than an independently maintained 809-line copy; if an external contract exists, both files remain and their generation relationship is explicit.
  - Validation: normalized-content comparison, static import review, from `web/` `npx tsc --noEmit`; no file deletion.
  - Risks: an inert compatibility file can expose a missed direct CSS consumer.
  - Rollback: restore the exact CSS payload and prior import contract.
- [x] AUDIT-TASK-021.3 — Verify TeamLandingPage organization at audit viewports.
  - Paths: TeamLandingPage consumers, both style paths
  - Depends on: AUDIT-TASK-021.2
  - Acceptance criteria: representative page content is unchanged at desktop/tablet/mobile and the selected build input resolves deterministically.
  - Validation: manual local browser check at 1440×900, 834×1112, and 390×844; no production build unless the owner proves build-only consumption cannot be checked more narrowly.
  - Risks: global import order can change cascade even with equivalent text.
  - Rollback: restore the prior `_app.tsx` import and both style contents.

## Parent acceptance criteria

TeamLandingPage has an evidenced style authority and no ambiguous independently maintained duplicate; no file is deleted.

## Completion receipt

- `_app.tsx` continues to import only `teamLandingPage.scss`, which is now explicitly documented as the maintained authority. `teamLandingPage.css` remains present as a comment-only compatibility path naming that authority; no active build input or external consumer was invented.
- The authoritative SCSS compiles successfully and its declarations are unchanged, so the active global cascade and import order are preserved. The full TypeScript check passes.
- `/stats/team/EDM` renders at 1440×900, 834×1112, and 390×844. The already-recorded tablet-width overflow remains present and is not attributed to this authority-only change; desktop and mobile show no document overflow, and no new visual change was introduced.

## Risks and rollback

Import order and external consumers are the critical gates. If authority remains unknown, completion is a documented Keep/Needs-owner-decision outcome, not a guessed merge.

# AUDIT-TASK-022: Replace only semantically equivalent breakpoint literals

- Finding IDs: FIND-STYLE-003
- Source candidate IDs: `FE-FINDING-006`
- Priority: P3
- Status: Completed
- Affected paths: `web/styles/vars.scss` and the exact stylesheet occurrence set evidenced by `FIND-STYLE-003`/`docs/repository-audit/evidence/style-metrics.json`
- Depends on: None; defer overlapping game/TeamLanding ownership groups until AUDIT-TASK-020/021 decisions
- Product decision gate: None

## Objective

Reduce 480px/768px breakpoint drift by migrating only selectors whose semantics match the established mobile/tablet token vocabulary.

## Evidence-backed scope

Across 166 stylesheets and 551 media queries, the audit found 46 literal 480px and 33 literal 768px conditions alongside 52 mobile-token and 50 tablet-token uses. File length and all other literals are not recommendations.

## Non-goals

Do not replace all 551 media queries, flatten intentionally distinct thresholds, rename token APIs wholesale, or redesign responsive layouts.

## Atomic subtasks

- [x] AUDIT-TASK-022.1 — Classify literal occurrences by semantic boundary and owner.
  - Paths: `web/styles/vars.scss`, exact 480px/768px occurrence paths from the audit metric set
  - Depends on: None
  - Acceptance criteria: every 480px/768px occurrence is labeled equivalent-mobile, equivalent-tablet, intentionally distinct, or unresolved; ownership groups are review-sized.
  - Validation: bounded `rg -n "480px|768px" web --glob '*.scss' --glob '*.css'` reconciled to audit counts, with generated/vendor paths excluded.
  - Risks: lexical equality does not prove semantic equivalence (`min-width` vs `max-width`, inclusive boundaries, container intent).
  - Rollback: retain the classification matrix.
- [x] AUDIT-TASK-022.2 — Migrate one equivalent ownership group at a time.
  - Paths: only files classified equivalent in AUDIT-TASK-022.1; `web/styles/vars.scss` only if a documented alias is required
  - Depends on: AUDIT-TASK-022.1; relevant groups wait for AUDIT-TASK-020/021
  - Acceptance criteria: each changed condition preserves direction/range and uses an existing semantic token; intentionally distinct and unresolved conditions remain literal.
  - Validation: from `web/`, `npm run lint` and `npx tsc --noEmit`; focused stylesheet diff.
  - Risks: Sass interpolation or off-by-one boundaries can change compiled CSS.
  - Rollback: revert by ownership group and restore the exact literal.
- [x] AUDIT-TASK-022.3 — Verify representative affected routes at three viewports.
  - Paths: route consumers for each changed ownership group
  - Depends on: each AUDIT-TASK-022.2 cohort
  - Acceptance criteria: no organization/regression at 1440×900, 834×1112, and 390×844; any intended visual change is tied to a separate finding.
  - Validation: manual local browser comparison per cohort.
  - Risks: a broad cohort makes visual regressions hard to attribute.
  - Rollback: revert only the failing cohort.

## Parent acceptance criteria

All evidenced equivalent 480px/768px literals use the established vocabulary, distinct thresholds remain intact, and each changed route has three-viewport evidence.

## Risks and rollback

Semantic classification is the safety boundary. A lower duplicate count is not itself acceptance.

## Execution checkpoint — 2026-08-19

- Exact media-boundary reconciliation classified max-width 480px as the existing mobile-max contract, and max/min-width 768px as the existing tablet boundary. It retained two min-width 480px rules because the semantic tablet-min token is 481px, deferred four TeamLanding literals behind AUDIT-TASK-021 ownership, and retained four zero-consumer plain-CSS compatibility-copy rules because CSS cannot consume the Sass vocabulary without a separate authority/migration decision.
- Eighty-four equivalent media conditions across 27 Sass files now use `breakpoint-mobile-max` or `breakpoint-tablet`; six previously un-tokenized owners import the variables namespace without emitting runtime declarations. All 27 files compile independently. A baseline/current compile comparison, with comments and whitespace normalized, is byte-identical for every stylesheet, proving the media-query output did not change.
- Representative Game Grid, player trends, legacy/current team stats, rankings, Start Chart, FORGE, stats hub, goalie variance, and player-detail routes were checked at 1440×900, 834×1112, and 390×844. Token migration introduced no route failure. Existing horizontal overflow on `/stats/player/8484801` at mobile and `/stats/team/EDM` at tablet was recorded but not attributed to this task because the compiled CSS is semantically identical; all other checks, including legacy PP TOI after data load, had no document overflow. Full lint exits zero with the same 62 warning-only baseline, and the full TypeScript check passes.

# AUDIT-TASK-023: Align `/staging-studio` with its deployment intent

- Finding IDs: FIND-DEPLOY-002
- Source candidate IDs: `FE-FINDING-007`
- Priority: P2
- Status: Completed — runtime check unavailable
- Affected paths: `cms/sanity.config.js`, `cms/vercel.json`, and web deployment config only if it owns the selected route
- Depends on: None
- Product decision gate: Resolved — `/staging-studio` is local-development-only for CMS authors and has no deployed route promise.

## Objective

Make the configured staging Sanity workspace match an explicit deployed or local-only contract.

## Evidence-backed scope

Sanity declares `/staging-studio`, while current CMS/web deployment configuration contracts only `/studio`. Both affected files remain byte-identical; the route was classified Far from complete because deployment ownership is missing.

## Non-goals

Do not deploy CMS, expose an internal workspace by assumption, change schemas/content, or fold legacy v2 cleanup from AUDIT-TASK-024 into this decision.

## Atomic subtasks

- [x] AUDIT-TASK-023.1 — **OWNER DECISION:** choose deployed or local-only staging intent.
  - Paths: `cms/sanity.config.js`, `cms/vercel.json`, relevant web/deployment route config
  - Depends on: None
  - Acceptance criteria: the CMS/product owner records audience, URL, auth expectation, and owning deployment boundary, or explicitly declares the workspace local-only.
  - Validation: owner sign-off plus config/route evidence.
  - Risks: deploying a staging editor can expose privileged authoring surface.
  - Rollback: make no route change before the decision.
- [x] AUDIT-TASK-023.2 — Implement the chosen config contract.
  - Paths: `cms/sanity.config.js`, `cms/vercel.json`, selected deployment config
  - Depends on: AUDIT-TASK-023.1
  - Acceptance criteria: deployed intent has one resolving, appropriately gated route; local-only intent is explicit and no deployment rewrite promises addressability.
  - Validation: static basePath/rewrite target reconciliation and CMS config parse; no deployment.
  - Risks: overlapping `/studio` rewrites can shadow one workspace.
  - Rollback: restore prior route/config as a pair.
- [x] AUDIT-TASK-023.3 — Verify workspace routing locally without publishing.
  - Paths: CMS workspace config and selected route
  - Depends on: AUDIT-TASK-023.2
  - Acceptance criteria: `npm run dev` from `cms/` exposes only the intended local workspaces; any deploy-only verification is marked unavailable until an authorized preview exists.
  - Validation: bounded manual local route check; do not run `npm run build` or deploy unless later separately justified and authorized.
  - Risks: local routing does not prove Vercel production behavior.
  - Rollback: revert routing configuration; no remote state exists to undo.

## Parent acceptance criteria

`/staging-studio` is either intentionally routable with an owned auth/deployment contract or explicitly local-only, with no contradictory config promise.

## Completion receipt

- `sanity.config.js` now includes the staging workspace only in Vite development mode. The production workspace remains `/studio`, and `cms/vercel.json` still owns only the `/studio/:match*` rewrite, so no deployed staging surface is promised or exposed.
- `cms/README.md` records the local CMS-author audience, the standard Sanity authentication boundary, and the distinct local/deployed URL contracts. Config syntax and all retained JSON files parse; bounded basePath/rewrite inspection reconciles the two workspaces.
- A bounded `npm run dev -- --host 127.0.0.1 --port 3334` attempt was unavailable because `cms/node_modules` is not installed (`sanity: command not found`). No dependency install, build, preview, or deployment was attempted, so runtime route behavior remains unclaimed while the fail-closed static contract is complete.

## Risks and rollback

Default to no new exposure until the owner decides. AUDIT-TASK-024 follows this authority.

# AUDIT-TASK-024: Classify and merge legacy Sanity configuration knowledge

- Finding IDs: FIND-CLEAN-001
- Source candidate IDs: `FE-FINDING-010`; cleanup record `AUDIT-CLEAN-0003`
- Priority: P3
- Status: Completed
- Affected paths: `cms/sanity.json`, `cms/sanity.config.js`, `cms/package.json`, `cms/config/.checksums`, and `cms/config/@sanity/{data-aspects,default-layout,default-login,form-builder,vision}.json`
- Depends on: AUDIT-TASK-023
- Product decision gate: Resolved — active v3 authorities remain active; v2-era metadata is archived in place with no deletion.

## Objective

Preserve any unique migration/deployment knowledge while making the active Sanity v3 authority unambiguous; create no deletion work.

## Evidence-backed scope

The package and active config are v3-shaped, while `sanity.json` and config metadata retain v2-era structures. Command/build ownership and unique knowledge are unresolved. All nine affected paths remain byte-identical; cleanup status is Needs owner decision.

## Non-goals

Do not delete files, upgrade Sanity, migrate content, deploy Studio, or classify artifacts by age/unlinked status alone.

## Atomic subtasks

- [x] AUDIT-TASK-024.1 — **OWNER DECISION:** trace inputs and classify each legacy artifact.
  - Paths: all nine affected paths, CMS scripts/config, bounded relevant history
  - Depends on: AUDIT-TASK-023
  - Acceptance criteria: each legacy artifact has current consumer/build/migration/unique-knowledge evidence or an explicit unknown, then the CMS owner assigns Keep, Archive, or Merge with rationale; no Delete candidate is created.
  - Validation: static imports/scripts, `cms/package.json`, bounded Git history, and a complete owner-signed decision row for every path; no CMS build.
  - Risks: tool-generated metadata may be required by an undocumented migration workflow.
  - Rollback: unresolved files remain Keep/Needs owner decision in place.
- [x] AUDIT-TASK-024.2 — Merge unique knowledge into the active authority or add compatibility/archive context.
  - Paths: only paths approved Merge/Archive, `cms/sanity.config.js`, CMS documentation if needed
  - Depends on: AUDIT-TASK-024.1
  - Acceptance criteria: unique settings/knowledge are retained in the active authority or a clear compatibility/archive note; legacy files are not deleted.
  - Validation: static config comparison and, when needed, bounded local `npm run dev` from `cms/`; no production build/deployment.
  - Risks: merging obsolete fields into v3 can create invalid config.
  - Rollback: restore prior active config and retained legacy files.

## Parent acceptance criteria

Every legacy artifact has an owner-approved disposition and all unique knowledge is preserved, while current v3/staging authority is explicit and no file is deleted.

## Completion receipt

- `cms/README.md` records a disposition for every affected path: `sanity.config.js` and `package.json` are Keep/active v3 authorities; `sanity.json`, `config/.checksums`, and all five `config/@sanity/*.json` files are Archive in place.
- The retained table identifies each file's unique project/dataset/plugin, checksum, layout, login, upload, or Vision metadata. Settings already represented by v3 remain in the active config; v2-only fields with no proven v3 consumer are preserved rather than guessed into it.
- Static package/config review and bounded history through the v3 migration corroborate the classification. Every retained JSON file parses, no legacy file was moved or deleted, and no CMS migration, build, or deployment ran.

## Risks and rollback

Unknown artifacts stay in place. Completion does not require physical cleanup when evidence remains incomplete.

# AUDIT-TASK-025: Make SQL validation scripts checkout-portable

- Finding IDs: FIND-DX-004
- Source candidate IDs: `WB-FIND-DX-004`
- Priority: P3
- Status: Completed
- Affected paths: `web/scripts/sql-refresh-team-power-validation.ts`, `web/scripts/sql-refresh-validation.ts`, focused configuration tests if extracted
- Depends on: None
- Product decision gate: None

## Objective

Remove one-workstation path assumptions while keeping environment values external, validated, and redacted.

## Evidence-backed scope

Both executable scripts search for environment files only below a hard-coded `/Users/...` checkout. Current files remain byte-identical.

## Non-goals

Do not open or copy ignored `.env*` files, print variable values, execute SQL validation, contact a database, or add a new secret manager.

## Atomic subtasks

- [x] AUDIT-TASK-025.1 — Define a portable, explicit configuration contract.
  - Paths: both scripts and existing tracked example/runbook documentation
  - Depends on: None
  - Acceptance criteria: configuration comes from process environment or a repository-relative explicitly supplied path; required variable names and missing-state errors are defined without value logging.
  - Validation: static source/docs review; only variable names may be inspected.
  - Risks: automatic upward `.env` discovery can load the wrong secret store.
  - Rollback: preserve the explicit contract and restore prior source without running it.
- [x] AUDIT-TASK-025.2 — Implement path-independent configuration loading and guarded entrypoints.
  - Paths: both scripts and a shared helper only if both genuinely need identical behavior
  - Depends on: AUDIT-TASK-025.1
  - Acceptance criteria: no `/Users/` literal remains; missing configuration fails before SQL/client initialization; values never enter errors/logs.
  - Validation: from `web/`, `npx tsc --noEmit`; from root, `rg -n "/Users/|printenv|console\.(log|error).*KEY" web/scripts/sql-refresh-team-power-validation.ts web/scripts/sql-refresh-validation.ts` with manual false-positive review.
  - Risks: importing the scripts in tests may self-execute database work.
  - Rollback: revert source loading changes; do not restore a machine-specific path as the long-term fix.
- [x] AUDIT-TASK-025.3 — Add no-I/O configuration tests.
  - Paths: `web/scripts/sql-refresh-validation.test.ts`, extracted pure helper if used
  - Depends on: AUDIT-TASK-025.2
  - Acceptance criteria: tests cover explicit env names, relative path resolution, and redacted missing/malformed errors with client/SQL modules never initialized.
  - Validation: from `web/`, `npm test -- scripts/sql-refresh-validation.test.ts`.
  - Risks: test imports can trigger the script's entrypoint.
  - Rollback: isolate configuration parsing before import; never allow tests to contact a database.

## Parent acceptance criteria

Both scripts work from any checkout through explicit configuration, fail before side effects when unavailable, and never expose values.

## Completion receipt

- Both scripts now use a shared explicit contract: process-provided `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, optionally populated from the repository-relative path named by `SQL_REFRESH_ENV_FILE`. Absolute paths, repository escapes, unreadable files, missing names, and malformed URLs fail with value-free errors; no upward or implicit environment-file discovery remains.
- Client creation moved inside exported run functions and both executable entrypoints use the repository's established `require.main === module` guard. Importing either module is inert, while unexpected entrypoint errors are replaced by a fixed redacted message.
- Six no-I/O Vitest cases pass, including mocked import-time client/SQL assertions. Targeted ESLint and `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false` pass; bounded source scans find no `/Users/`, `file://`, `printenv`, or key-dumping console pattern. No ignored environment file was opened and no SQL, Supabase client, network, or database operation was executed.

## Risks and rollback

No validation command may execute the scripts' SQL path. Treat ignored environment files as opaque.

# AUDIT-TASK-026: Decide and harden the legacy WGO updater boundary

- Finding IDs: FIND-COR-004
- Source candidate IDs: `WB-FIND-COR-005`; cleanup record `AUDIT-CLEAN-0005`
- Priority: P2
- Status: Blocked — product decision
- Affected paths: `web/lib/supabase/Upserts/fetchWGOskaterStats.js`, `web/lib/supabase/server.ts`, evidenced callers/schedulers, focused tests
- Depends on: None
- Product decision gate: Owner must classify the updater as active or superseded before code change or removal.

## Objective

If active, make the updater explicitly invoked and correctly configured; if superseded, make it inert and documented without deleting it.

## Evidence-backed scope

The module reads misspelled `NNEXT_SUPABASE_SERVICE_ROLE_KEY`, self-executes at import, and has no other frozen consumer of that variable spelling. Ownership is unresolved; both files remain byte-identical and cleanup status is Needs owner decision.

## Non-goals

Do not run the updater, contact Supabase, print environment values, delete the file, repair unrelated WGO logic, or infer supersession from missing imports alone.

## Atomic subtasks

- [ ] AUDIT-TASK-026.1 — **OWNER DECISION:** classify active versus superseded.
  - Paths: updater, `web/lib/supabase/server.ts`, scheduler/scripts/docs references
  - Depends on: None
  - Acceptance criteria: the data-pipeline owner identifies current caller/purpose or canonical replacement and records the required variable names by name only.
  - Validation: static reference/config/history review plus owner sign-off; no import/execution.
  - Risks: self-execution means even diagnostic import can write.
  - Rollback: leave the module untouched until decided.
- [ ] AUDIT-TASK-026.2A — Active branch: remove import-time execution and validate configuration explicitly.
  - Paths: updater, server client factory, targeted test
  - Depends on: AUDIT-TASK-026.1 choosing active
  - Acceptance criteria: work starts only from a guarded explicit entrypoint; the approved service-role variable name is validated before client creation; errors/logs expose names, never values.
  - Validation: from `web/`, `npm test -- lib/supabase/Upserts/fetchWGOskaterStats.test.ts`; all Supabase/network functions mocked.
  - Risks: changing CommonJS/ESM invocation can break a legitimate script caller.
  - Rollback: restore the caller adapter, not import-time execution.
- [ ] AUDIT-TASK-026.2B — Superseded branch: make the module inert with replacement evidence.
  - Paths: updater and canonical replacement/runbook
  - Depends on: AUDIT-TASK-026.1 choosing superseded
  - Acceptance criteria: import cannot start work; a compatibility notice names the canonical path and unique retained knowledge; file remains present and no deletion task is created.
  - Validation: static import/export check and a no-side-effect module test with all clients mocked.
  - Risks: an undocumented external runner may execute the file directly.
  - Rollback: restore direct invocation only with an evidenced caller and guarded entrypoint.
- [ ] AUDIT-TASK-026.3 — Verify the chosen branch without credentials or I/O.
  - Paths: `web/lib/supabase/Upserts/fetchWGOskaterStats.js`, `web/lib/supabase/Upserts/fetchWGOskaterStats.test.ts`
  - Depends on: AUDIT-TASK-026.2A or AUDIT-TASK-026.2B
  - Acceptance criteria: focused tests prove no import-time call, missing configuration fails before client initialization, and no secret value is logged.
  - Validation: from `web/`, `npm test -- lib/supabase/Upserts/fetchWGOskaterStats.test.ts`; then `npx tsc --noEmit` where the JS file participates in the current TypeScript graph.
  - Risks: JS files may sit outside TypeScript coverage.
  - Rollback: revert behavior changes while retaining the owner decision and no-value logging rule.

## Parent acceptance criteria

The updater has an owner-approved status, cannot self-execute on import, and either uses correct explicit configuration or points inertly to its replacement without deletion.

## Risks and rollback

Never import this module merely to inspect it until the entrypoint is guarded.

# AUDIT-TASK-027: Establish authoritative sKO output provenance

- Finding IDs: FIND-CLEAN-002
- Source candidate IDs: `WB-FIND-CLEAN-006`; cleanup record `AUDIT-CLEAN-0004`
- Priority: P3
- Status: Completed
- Affected paths: `web/scripts/output/{sko_features.parquet,sko_holdout_predictions.parquet,sko_metrics.parquet,sko_step_timings.csv}`, `web/web/scripts/output/` same-named files, evidenced producers/consumers
- Depends on: None
- Product decision gate: Resolved — `web/scripts/output/` is canonical; `web/web/scripts/output/` is retained historical evidence.

## Objective

Make producers and consumers select one evidenced sKO run/output root while retaining both tracked artifact sets until provenance is resolved.

## Evidence-backed scope

The timing CSV pair is byte-identical; three same-named Parquet pairs have different hashes; no source establishes the nested root's producer or authority. All eight files remain byte-identical and cleanup status is Needs owner decision.

## Non-goals

Do not open or regenerate model payloads, run training/inference, delete/move artifacts, choose the newest timestamp, or treat identical filenames as equivalent data.

## Atomic subtasks

- [x] AUDIT-TASK-027.1 — **OWNER DECISION:** trace provenance and select the authoritative output contract.
  - Paths: both output roots, `web/scripts/`, model configuration/docs, consumer source
  - Depends on: None
  - Acceptance criteria: each file has producer command/code, consumer references, current hash, and known/unknown run metadata; the model owner then selects an authoritative root/run per consumer or explicitly classifies the roots as distinct products.
  - Validation: bounded `rg -n "scripts/output|web/scripts/output|sko_features|sko_holdout_predictions|sko_metrics|sko_step_timings" web --glob '!**/*.parquet'`; `shasum -a 256` over the eight exact files; owner sign-off; do not parse Parquet contents.
  - Risks: consumers may load paths dynamically or externally.
  - Rollback: no consumer/source edit before decision.
- [x] AUDIT-TASK-027.2 — Point producers/consumers to the approved authority without artifact deletion.
  - Paths: evidenced producer/consumer configs/scripts; both tracked roots remain untouched
  - Depends on: AUDIT-TASK-027.1
  - Acceptance criteria: each producer writes and each consumer reads the approved explicit root; ambiguous fallback/path duplication is removed; historical artifacts remain unchanged.
  - Validation: static configuration/path tests with filesystem calls mocked; repeat bounded `rg` to confirm intentional references only.
  - Risks: relative working directories can recreate the nested root.
  - Rollback: restore prior path configuration while preserving the signed provenance decision.
- [x] AUDIT-TASK-027.3 — Add a no-model provenance guard.
  - Paths: `web/scripts/sko-output-authority.test.ts`, evidenced producer/consumer path configuration
  - Depends on: AUDIT-TASK-027.2
  - Acceptance criteria: a deterministic test fails when configured root diverges or required artifact hashes/run identifiers are ambiguous; it never runs a model or opens secret stores.
  - Validation: from `web/`, `npm test -- scripts/sko-output-authority.test.ts`; all model/filesystem payload reads are mocked, with only path and supplied metadata under test.
  - Risks: pinning content hashes can block intentional new runs unless run identity is versioned.
  - Rollback: revert the guard, not the owner-approved path authority.

## Parent acceptance criteria

Every sKO producer/consumer has an owner-approved explicit root and provenance guard; both artifact sets remain unchanged until a separately justified cleanup audit.

## Completion receipt

- `web/scripts/sko-output-authority.ts` establishes `scripts/output` relative to the `web/` working directory as the only authoritative root. The older nested root is historical, never a fallback, and both retained sets have distinct identities with explicitly unknown run metadata.
- `sko-output-provenance.md` records all eight paths, sizes, and opaque SHA-256 receipts. Three Parquet pairs differ; the one-byte timing pair matches. Static executable-source review found no current producer or runtime consumer, so reactivation must adopt the canonical path and add a new evidenced run identity.
- The pure five-test provenance guard rejects root drift, ambiguous set identity, incomplete inventory, malformed hashes, and unexplained run metadata without reading payloads or running model/filesystem work. Targeted lint has no errors and the full TypeScript check passes. No artifact was parsed, generated, moved, modified, or deleted.

## Risks and rollback

No model output is opened, generated, deleted, or moved as validation.

# AUDIT-TASK-028: Add bounded PR/push validation after contract blockers clear

- Finding IDs: FIND-BUILD-001
- Source candidate IDs: `DOCOPS-FIND-002`
- Priority: P2
- Status: Blocked — AUDIT-TASK-004 hosted verification
- Affected paths: `.github/workflows/rankings-e2e.yml`, a new or existing bounded CI workflow under `.github/workflows/`, `web/package.json`, and authoritative test/lint configuration
- Depends on: AUDIT-TASK-004, AUDIT-TASK-006, AUDIT-TASK-011
- Product decision gate: Resolved — begin advisory with one sequential credential-free job on Node 22.11.0, a 20-minute timeout, and type/lint/unit only; required status waits for hosted green evidence.

## Objective

Run the repository's existing npm-authoritative type, lint, and unit contracts on PR/push with bounded resources and no production-capable credentials.

## Evidence-backed scope

The only workflow is manual and rankings-specific; the frozen migration-authority failure was a concrete regression no automatic workflow would catch. Current package drift adds forecast scripts but does not change type/lint/test authorities. Credential scoping, migration authority, and lint scope must land first.

## Non-goals

Do not add live-data E2E, deployments, CMS/function builds, dependency upgrades, blanket test expansion, remote caching, or secret-bearing install steps.

## Atomic subtasks

- [x] AUDIT-TASK-028.1 — **OWNER DECISION:** set required/advisory checks and resource budget.
  - Paths: `.github/workflows/`, branch-protection documentation if present, `web/package.json`
  - Depends on: None; implementation remains blocked by parent dependencies
  - Acceptance criteria: owner selects triggers, required/advisory status, Node 22.11.0, timeout/concurrency, and whether type/lint/unit run as separate jobs; live-data E2E is explicitly excluded.
  - Validation: owner sign-off against existing command durations/receipts and runner budget.
  - Risks: making an unstable or over-budget check required can block all merges.
  - Rollback: no workflow change before decision.
- [ ] AUDIT-TASK-028.2 — Add credential-free PR/push workflow wiring.
  - Paths: selected `.github/workflows/*.yml`, `web/package.json`, `web/package-lock.json`, `web/.nvmrc`
  - Depends on: AUDIT-TASK-004, AUDIT-TASK-006, AUDIT-TASK-011, AUDIT-TASK-028.1
  - Acceptance criteria: workflow uses Node 22.11.0, `npm ci` in `web/`, bounded concurrency/timeouts, no production/service-role secrets, and only owner-approved commands.
  - Validation: static YAML/manifest review; from root, `rg -n "SUPABASE_SERVICE_ROLE_KEY|schedule:|workflow_dispatch|pull_request|push" .github/workflows`; no deployment.
  - Risks: workflow path filters can silently skip relevant migration or config changes.
  - Rollback: disable/remove only the new PR/push trigger while retaining the local contracts.
- [x] AUDIT-TASK-028.3 — Prove the exact local command matrix before making checks required.
  - Paths: `web/package.json`, lint/test/type config and current source
  - Depends on: AUDIT-TASK-028.2
  - Acceptance criteria: `npx tsc --noEmit`, `npm run lint`, and `npm run test:full` complete with recorded duration/result in the supported Node/npm environment; failures remain visible and block required status.
  - Validation: from `web/`, run the three commands exactly once each in a clean disposable checkout; no E2E, build, server, secrets, or external services.
  - Risks: full unit suite resource use may exceed the selected runner budget.
  - Rollback: mark the expensive check advisory or split it per the signed budget; do not hide failures.
- [ ] AUDIT-TASK-028.4 — Validate hosted behavior and branch-check reporting.
  - Paths: selected workflow and repository check configuration
  - Depends on: AUDIT-TASK-028.3
  - Acceptance criteria: an authorized PR run triggers on relevant web/migration/config changes, reports each selected check, exposes no secrets, and cancels superseded runs as designed.
  - Validation: GitHub Actions/branch-settings manual evidence; requires repository permissions, unavailable locally.
  - Risks: local success cannot prove hosted permissions or branch protection.
  - Rollback: disable required status/trigger before reverting local command contracts.

## Parent acceptance criteria

Bounded credential-free PR/push validation runs the approved existing commands, reports failures honestly, and excludes live-data E2E and deployments.

## Decision checkpoint — 2026-08-19

- The approved initial contract is advisory PR/push validation, Node 22.11.0, one sequential job, 20-minute timeout, concurrency cancellation, `npm ci` in `web/`, then exact type, lint, and full-unit commands. Live-data E2E, credentials, builds, servers, CMS/functions, and deployments are excluded.
- The first no-secret disposable run exposed 36 test files that implicitly relied on `.env.local` for import-time Supabase client construction. `web/__tests__/vitest.setup.js` no longer loads ignored environment files and instead supplies fixed synthetic keys plus an `.invalid` URL, so any unmocked request fails away from production. Three broad Rankings assertions were updated to use the named native selection buttons established by AUDIT-TASK-018.
- In a sanitized `/tmp` copy containing no `.env*` file and using the existing dependency tree, `npm run test:full` passes 687 files/3,923 tests with two live-integration files/three tests explicitly skipped. `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` passes, and `npm run lint` exits zero with the existing 62-warning baseline. No environment value, external service, or production endpoint was used.
- AUDIT-TASK-006 and AUDIT-TASK-011 are complete. The scoped rankings credential fix is now committed and pushed, but the exact commit still has no hosted run; workflow implementation remains intentionally blocked on AUDIT-TASK-004's hosted inheritance proof. Required branch status remains a later promotion only after the advisory workflow is hosted-green.

## Risks and rollback

Land credential, migration-authority, and lint-scope prerequisites first. Workflow rollback must not undo their local fixes.

## Validation matrix

Commands are future task checks, not commands run during task generation. Run web commands from `web/`, CMS commands from `cms/`, and root commands only where shown. Never expose environment values.

| Task | Safe command/manual checks | Services, credentials, or limitations |
| --- | --- | --- |
| AUDIT-TASK-001 | `npm test -- lib/supabase/supportedBaselineMigration.test.ts`; manual read-only `pg_catalog` ACL check | Source check needs none; deployed completion needs approved read-only catalog access. Never call `execute_sql`. |
| AUDIT-TASK-002 | Same migration-authority test; manual read-only function ACL check | Source check needs none; deployed completion needs read-only catalog access. Never call the truncation RPC. |
| AUDIT-TASK-003 | `npm test -- __tests__/pages/api/v1/db/operational-route-auth.test.ts lib/cron/withCronJobAudit.test.ts`; `npx tsc --noEmit`; `npm run lint` | No services; all handler, Supabase, scheduler, and network work mocked. Product decision required. |
| AUDIT-TASK-004 | `rg -n "SUPABASE_SERVICE_ROLE_KEY|env:" .github/workflows/rankings-e2e.yml`; `npm run test:e2e:rankings -- --list` | Discovery needs no credentials; final inheritance proof needs GitHub Actions metadata. Never print a value. |
| AUDIT-TASK-005 | `npm test -- components/GamePreview/GamePreview.test.tsx`; `npx tsc --noEmit`; manual three-viewport fixture check | Local app/fixtures for visual check; no live API required. |
| AUDIT-TASK-006 | `npm test -- lib/supabase/supportedBaselineMigration.test.ts`; `git diff --check` | No database. Owner classification required; current user edits overlap. |
| AUDIT-TASK-007 | `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_sko_pipeline.py` | Existing pytest-capable environment required; pipeline/network/model mocked; otherwise blocked. |
| AUDIT-TASK-008 | `npm test -- __tests__/pages/api/v1/ml/create-materialized-view.test.ts`; `npx tsc --noEmit`; manual read-only catalog parity | Catalog access required for revalidation only. Never invoke endpoint, RPC, DDL, or materialization. |
| AUDIT-TASK-009 | `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -p no:cacheprovider functions/tests/test_fetch_team_table_contract.py` | Pytest environment required; all Natural Stat Trick/network calls mocked. |
| AUDIT-TASK-010 | In disposable copy: `npx tsc --noEmit`, bounded `npm run dev:stable`, `git diff --exit-code -- next-env.d.ts` | Dev command writes caches; disposable copy only. Stop before external navigation. |
| AUDIT-TASK-011 | `npm run lint`; targeted source-file reconciliation | No services. Preserve unrelated `web/package.json` edits. |
| AUDIT-TASK-012 | `rg -n "yarn|npm install|npm ci|22\.11\.0" README.md web/README.md web/.vscode/launch.json web/package.json`; `git diff --check` | No install or server. Manually preserve the separate functions Yarn command. |
| AUDIT-TASK-013 | Bounded `rg` over the 126-path working set; target-existence checks; `git diff --check` | No services. Archive and unresolved owner-decision documents are not rewritten. |
| AUDIT-TASK-014 | Exact three-file status `rg`; manual receipt/count reconciliation | Rolling-player owner evidence required; no jobs or data checks. |
| AUDIT-TASK-015 | `rg -n "npx|--yes|-y|@latest" .vscode/mcp_config.json`; manual JSON check | No network/tool launch. Owner decision required. |
| AUDIT-TASK-016 | `npm test -- __tests__/components/Layout/Header.test.tsx`; `npx tsc --noEmit`; keyboard walkthrough | Local browser only; no authenticated data. |
| AUDIT-TASK-017 | Same focused Header test plus `npx tsc --noEmit`; mobile/tablet walkthrough | Product decision first; local browser only. |
| AUDIT-TASK-018 | `npm test -- components/Options/Options.test.tsx components/Select/Select.test.tsx components/Rankings/PlayerMatrixTable.test.tsx components/TeamDashboard/TeamDashboard.test.tsx`; `npx tsc --noEmit` | New primitive tests are finding-specific; local browser for final semantics. |
| AUDIT-TASK-019 | `npm test -- components/PlayerPPTOIPerGameChart/PPTOIChart.test.tsx`; `npx tsc --noEmit`; three-viewport check | Deterministic fixture required; legacy live data not required. |
| AUDIT-TASK-020 | `npx tsc --noEmit`; `npm run lint`; stylesheet hashes; two-route three-viewport check | Owner decision and AUDIT-TASK-005 first; no file deletion. |
| AUDIT-TASK-021 | `npx tsc --noEmit`; normalized style comparison; three-viewport check | Owner/build-contract evidence required; no file deletion or production build by default. |
| AUDIT-TASK-022 | Bounded `rg -n "480px|768px"`; `npm run lint`; `npx tsc --noEmit`; per-cohort viewport checks | No services. Only semantically equivalent cohorts change. |
| AUDIT-TASK-023 | Static basePath/rewrite check; bounded local `npm run dev` from `cms/` | Owner decision first; no CMS build/deployment. |
| AUDIT-TASK-024 | Static package/config/history check; conditional bounded CMS dev check | CMS owner decision required; no deletion, migration, or deploy. |
| AUDIT-TASK-025 | `npm test -- scripts/sql-refresh-validation.test.ts`; `npx tsc --noEmit`; redacted static `rg` | No ignored env content, SQL, or database client initialization. |
| AUDIT-TASK-026 | `npm test -- lib/supabase/Upserts/fetchWGOskaterStats.test.ts`; `npx tsc --noEmit` where applicable | Owner decision first; no module import until entrypoint is guarded; no credentials/network. |
| AUDIT-TASK-027 | Bounded path `rg`; `shasum -a 256` on eight exact artifacts; `npm test -- scripts/sko-output-authority.test.ts` | No Parquet parsing, model run, regeneration, move, or deletion. |
| AUDIT-TASK-028 | In clean disposable `web/`: `npx tsc --noEmit`, `npm run lint`, `npm run test:full`; static workflow review | GitHub permissions needed for hosted proof; no secrets, E2E, builds, servers, or deployment. |

## Traceability matrix

Each canonical justified finding has exactly one parent owner. Source candidate IDs remain linked even where candidates were merged or reframed.

| Finding ID | Parent owner | Source candidate IDs | Current planning disposition |
| --- | --- | --- | --- |
| FIND-SEC-001 | AUDIT-TASK-001 | PDATA-SEC-001 | Source fix complete; rollout and post-rollout catalog verification remain separately authorized. |
| FIND-SEC-002 | AUDIT-TASK-002 | PDATA-SEC-002 | Source fix complete; rollout and post-rollout catalog verification remain separately authorized. |
| FIND-SEC-003 | AUDIT-TASK-003 | WB-FIND-SEC-001 | Blocked on route/method decision; 20 current files hash-match. |
| FIND-SEC-004 | AUDIT-TASK-004 | DOCOPS-FIND-001 | Source scoping and local discovery complete; hosted inheritance proof remains. |
| FIND-COR-001 | AUDIT-TASK-005 | FE-FINDING-001 | Completed with focused state tests, type/lint checks, and deterministic three-viewport verification. |
| FIND-COR-002 | AUDIT-TASK-006 | VAL-MIGRATION-AUTHORITY-001 | Blocked; current authority/test and active migration set changed and require owner classification. |
| FIND-DEPLOY-001 | AUDIT-TASK-007 | PDATA-REL-003 | Blocked on deployment owner; both files hash-match. |
| FIND-COR-003 | AUDIT-TASK-008 | WB-FIND-COR-002, WB-FIND-COR-003 | Deployed parity confirmed source authority; blocked on retain/retire owner decision before route changes. |
| FIND-REL-001 | AUDIT-TASK-009 | PDATA-COR-004, PDATA-REL-005 | Completed; both Flask surfaces share one structured success/error contract with no-network tests. |
| FIND-DX-001 | AUDIT-TASK-010 | DOCOPS-FIND-004 | Ready; all files hash-match. |
| FIND-BUILD-001 | AUDIT-TASK-028 | DOCOPS-FIND-002 | Blocked on CI policy/dependencies; relevant package scripts unchanged. |
| FIND-DX-002 | AUDIT-TASK-011 | DOCOPS-FIND-003 | Completed; one root-scoped command covers active first-party trees and exits with zero errors. |
| FIND-DOC-001 | AUDIT-TASK-012 | DOCOPS-FIND-005 | Ready; npm/Node evidence remains current. |
| FIND-DOC-002 | AUDIT-TASK-013 | DOCOPS-FIND-006 | Ready for Keep subset; Archive and owner-decision bounds preserved. |
| FIND-DOC-003 | AUDIT-TASK-013 | DOCOPS-FIND-007 | Ready for Keep subset; absent targets are not deletion evidence. |
| FIND-DOC-004 | AUDIT-TASK-014 | DOCOPS-FIND-008 | Blocked on rolling-player owner decision. |
| FIND-SEC-005 | AUDIT-TASK-015 | DOCOPS-FIND-009 | Blocked on repository editor-policy decision. |
| FIND-DX-003 | AUDIT-TASK-012 | DOCOPS-FIND-010 | Ready; npm authority remains current. |
| FIND-A11Y-001 | AUDIT-TASK-016 | FE-FINDING-002 | Completed; native disclosures, focus semantics, tests, and desktop pointer/runtime geometry verified. |
| FIND-UX-001 | AUDIT-TASK-017 | FE-FINDING-003 | Blocked on eight-route product classification. |
| FIND-A11Y-002 | AUDIT-TASK-018 | FE-FINDING-008 | Completed; actionable instances use native controls, redundant row actions were removed, and neutral containers remain unchanged. |
| FIND-A11Y-003 | AUDIT-TASK-019 | FE-FINDING-009 | Completed; exact values are non-hover accessible and verified without overflow at all three audit viewports. |
| FIND-STYLE-001 | AUDIT-TASK-020 | FE-FINDING-004 | Blocked on ownership; cleanup action is Merge only. |
| FIND-STYLE-002 | AUDIT-TASK-021 | FE-FINDING-005 | Blocked on generation/consumer proof; no deletion. |
| FIND-STYLE-003 | AUDIT-TASK-022 | FE-FINDING-006 | Completed for all evidenced equivalent active Sass cohorts; distinct, owner-gated, and non-Sass compatibility literals remain explicitly classified. |
| FIND-DEPLOY-002 | AUDIT-TASK-023 | FE-FINDING-007 | Blocked on staging deployment intent. |
| FIND-CLEAN-001 | AUDIT-TASK-024 | FE-FINDING-010 | Blocked on CMS ownership; Needs owner decision only. |
| FIND-DX-004 | AUDIT-TASK-025 | WB-FIND-DX-004 | Ready; both script hashes match. |
| FIND-COR-004 | AUDIT-TASK-026 | WB-FIND-COR-005 | Blocked on active/superseded decision; no deletion. |
| FIND-CLEAN-002 | AUDIT-TASK-027 | WB-FIND-CLEAN-006 | Blocked on model-output authority; no artifact mutation. |

### No-change records rejected as task sources

| Record ID | Task generated | Reason retained |
| --- | --- | --- |
| NOCHANGE-PERF-001 | No | No representative timing/query-plan/payload/cache evidence justifies broad performance or caching work. |
| NOCHANGE-OBS-001 | No | No blanket observability program is justified; named endpoint tasks carry only behavior-specific evidence. |
| NOCHANGE-VIS-001 | No | 207/216 viewport records justify no route-specific visual change; only named accessibility/responsive tasks remain. |
| NOCHANGE-DEPS-001 | No | Version age alone does not justify upgrades or migration. |
| NOCHANGE-TEST-001 | No | Tests are added only where a named finding requires a concrete regression contract. |

## Cross-boundary risks and rollback order

1. **P0 database ACLs:** AUDIT-TASK-001 and AUDIT-TASK-002 stay as separate forward migrations, catalog receipts, and compensating ACL migrations. Neither rollout depends on or rolls back the other.
2. **Operational routes:** decide route/method consumers before edits. Roll out AUDIT-TASK-003 by cohort; resolve AUDIT-TASK-008's materialization disposition independently and never weaken shared auth to restore one scheduler.
3. **Migration/CI authority:** preserve current forecast work. Complete AUDIT-TASK-006 and AUDIT-TASK-011 before AUDIT-TASK-028 makes checks required; scope secrets through AUDIT-TASK-004 first. CI rollback disables hosted enforcement, not local safety contracts.
4. **Shared UI/styles:** behavior/accessibility lands before shared-file consolidation where paths overlap (`005 → 020`, `016 → 017`). Roll back one component or style cohort rather than the shared shell.
5. **CMS:** deployment intent precedes legacy-config classification (`023 → 024`). Default rollback removes new exposure and retains legacy files.
6. **Documentation/cleanup:** change only canonical Keep subsets or owner-approved branches. No task deletes or moves a source, document, config artifact, or model output.
7. **External prerequisites:** unavailable catalog credentials, GitHub permissions, pytest environment, authenticated pages, or representative data block only the affected verification/parent. They never convert unknown state into success.

## Final execution constraints

- Re-read current `git status --short` and the targeted diff before every implementation parent; preserve all user changes and stop on an overlapping unresolved edit.
- Database catalog checks are read-only. Migration push/apply, arbitrary SQL RPC calls, truncation calls, DDL endpoints, cron/job routes, model runs, deployments, and production writes require separate explicit authorization and are never automatic validation.
- Do not open ignored `.env*` files or print environment values. Use variable names only and redact any accidental value before retaining logs.
- Do not install dependencies unless a separately approved task proves the repository's documented setup requires it.
- Record checks as passed, failed, blocked, or not run. A failing check is evidence; do not suppress it or broaden scope reflexively.
- This plan owns all 30 justified findings exactly once and deliberately generates no task from the five no-change records.

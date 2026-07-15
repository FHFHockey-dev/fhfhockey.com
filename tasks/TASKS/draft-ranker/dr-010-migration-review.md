# DR-010 Identity Migration Review

## Checkpoint status

Approved and completed on 2026-07-14. This document preserves the checkpoint scope and records the post-apply evidence.

Migration under review:

`supabase/migrations/20260714223013_create_fhfh_player_identity_registry.sql`

Advisor follow-up migration:

`supabase/migrations/20260714223217_add_fhfh_identity_foreign_key_indexes.sql`

Focused contract test:

`web/lib/supabase/fhfhPlayerIdentityMigration.test.ts`

## Scope

The migration is additive. It does not alter, backfill, truncate, or replace `public.players` or any existing Yahoo, roster, projection, authentication, or homepage system.

It creates:

1. `public.fhfh_player_identities`
2. `public.fhfh_player_external_identities`
3. `public.fhfh_player_identity_aliases`
4. `public.fhfh_player_organization_history`
5. `public.fhfh_player_identity_review_queue`
6. One fixed-search-path, `SECURITY INVOKER` updated-at trigger function
7. Supporting constraints, indexes, triggers, RLS policies, grants, and table comments

## Identity guarantees

- FHFH IDs are generated `bigint` identities.
- NHL ID is optional and uniquely linked when present.
- Names and teams are mutable metadata and are not unique identity keys.
- Verified prospects can exist without NHL or Yahoo IDs.
- External IDs are unique only within provider/context.
- Ambiguous mappings and player-addition requests remain in an admin/service review queue.
- Merge history is preserved through `merged_into_id`; it is not implemented as destructive deletion.

## Security posture

- RLS is enabled on all five tables.
- `PUBLIC`, `anon`, and `authenticated` receive no table privileges.
- Restrictive deny policies explicitly reject client access.
- `service_role` receives the required CRUD privileges.
- The trigger function is `SECURITY INVOKER`, uses `search_path = pg_catalog`, and has execution revoked from `PUBLIC`, `anon`, and `authenticated`.
- No public view or user-callable RPC is introduced.

The live project still has a pre-existing, unrelated critical concern: `public.execute_sql(text)` is `SECURITY DEFINER` and executable by `PUBLIC`, `anon`, and `authenticated`. That finding is recorded in `execution-boundary.md`. It must be remediated before user-owned ranking data is exposed under DR-012, but it is not modified silently by this identity migration.

## Validation completed

- Supabase CLI generated the migration filename and path.
- `pglast` parsed all 62 SQL statements successfully.
- All migration-defined identifiers are within PostgreSQL's 63-byte identifier limit.
- Focused Vitest contract suite: 5 tests passed.
- The test verifies:
  - no alteration, truncation, drop, or insert against `public.players`;
  - all five identity tables exist in the script;
  - provider/context identity uniqueness;
  - names and aliases are not globally unique;
  - RLS and service-only grants on every table;
  - five explicit restrictive deny policies;
  - no `SECURITY DEFINER` function;
  - trigger-function search path and execute revocations;
  - merge, confidence, provenance, and review constraints.
- Live read-only probes confirmed required dependencies:
  - `public.players(id bigint)`
  - `public.teams(id smallint)`
  - `public.seasons(id bigint)`, including `20262027`
  - `public."NHL_Position_Code"` values `L`, `R`, `G`, `D`, and `C`
  - `pgcrypto` for `gen_random_uuid()`

## Post-approval validation

- A fresh live-ledger/schema preflight confirmed that no target table existed and all dependencies/extensions were present.
- The exact reviewed migration was applied as live version `20260714223013`.
- Live catalog verification found five tables, five triggers, 50 constraints, RLS and one restrictive deny policy per table, no `anon`/`authenticated` CRUD, full `service_role` CRUD, and restricted execution of the SECURITY INVOKER trigger function.
- A transactional insert/update/check-constraint probe passed and rolled back with zero residual rows.
- Security advisors report no finding tied to the new objects.
- Performance advisors initially reported six uncovered foreign keys. The generated follow-up migration added those indexes as live version `20260714223217`; a rerun reports no target unindexed-foreign-key findings.
- Expected unused-index informational notices remain because the new tables have not yet been backfilled.
- The focused contract suite now contains six passing tests.
- Generated TypeScript types remain deferred until the DR-012 schema surface is frozen, avoiding churn in a baseline-overlapping generated file.

## Rollback posture

Before user/backfill data exists, rollback can drop the five new tables, their triggers, and the dedicated trigger function in dependency order. After verified identities or ranking references exist, rollback must be feature-disable and code rollback; populated identity history must not be destructively dropped.

## Approval outcome

The user approved the checkpoint. DR-010 is complete. DR-011 identity backfill is now authorized by the approved plan; DR-012 ownership tables retain their separate live-apply checkpoint.

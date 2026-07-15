# DR-012 Ownership and RLS Migration Review

## Checkpoint status

Approved and applied on 2026-07-14 as live migration `20260715011329_create_draft_ranker_ownership_foundation`. The applied SQL SHA-256 is `2e24bdc7286a9a8e64529cf2afe069b17e73c1ff4a378b0460402f8ab4c6efbd`.

## Proposed additive schema

The migration creates ten account-owned foundation tables:

1. `draft_rankings`
2. `draft_ranking_entries`
3. `draft_ranking_events`
4. `draft_ranking_seed_runs`
5. `draft_ranking_watchlist`
6. `draft_ranker_contribution_preferences`
7. `draft_ranker_pair_prompts`
8. `draft_ranker_pair_comparisons`
9. `draft_ranker_pair_preferences`
10. `draft_ranker_placement_sessions`

No existing table is altered or replaced. No community aggregate/read-model table, public ranking view, seeding RPC, reorder RPC, API route, or product UI is included.

## Contract choices captured

- One active default ranking is enforced per user and target season while the schema still permits future named or archived sets.
- Ranking entries store one sparse continuous `bigint` order. Top 250 and candidate membership remain derived; no cutoff boolean or separate bench rank is stored.
- Every ranking child carries `user_id` and a composite ownership foreign key. Auth-user deletion cascades the owned ranking graph.
- Pair prompts, submissions, and materialized preferences use canonical low/high player IDs.
- Composite foreign keys prevent a prompt, comparison, or preference from being attached to the wrong owner, ranking season, or player pair.
- Comparison submissions and ranking events are immutable to browser clients. Client operation IDs and prompt uniqueness provide the persistence foundation for later idempotent APIs.
- Contribution defaults to false and cannot be enabled without a policy version and consent timestamp.
- One active assisted-placement session is allowed per ranking/player.
- Community aggregate infrastructure remains deferred, matching DRD-009.

## RLS and privilege posture

- RLS is enabled on all ten tables.
- Every owner policy uses `(select auth.uid()) = user_id`; update policies have both `USING` and `WITH CHECK`.
- `anon` receives no table privileges.
- `authenticated` receives owner-filtered `SELECT` only at the raw table layer.
- All direct browser inserts, updates, and deletes remain denied. Mutations must pass through a future authenticated ranker API or separately reviewed narrow RPC, preventing clients from bypassing lock versions, event creation, rankability checks, prompt issuance, and consent rules.
- `service_role` receives table privileges for server/API and maintenance work.
- The only new function is a fixed-search-path `SECURITY INVOKER` timestamp trigger. It is not executable by `public`, `anon`, or `authenticated`.

## Validation completed

- The exact 487-line migration parsed and executed successfully inside a rolled-back transaction against the linked production schema.
- A two-account live RLS probe confirmed that an authenticated user sees only their own ranking row.
- The probe confirmed direct authenticated insert, update, and delete are denied, including direct immutable-event and comparison writes.
- The probe verified ten tables, RLS on all ten, 22 owner policies, required privilege denials, and zero residual tables after rollback.
- Eight focused Vitest migration-contract tests pass, including additive-only scope, ownership cascades, continuous ordering, canonical evidence, RLS, direct-mutation denial, function security, and PostgreSQL identifier-length checks.
- DR-011 regression tests remain green: 12 Python matcher/promotion tests and 14 focused identity Vitest tests.

## Migration and rollback boundary

Before any live apply, Codex will recheck the live migration ledger, target-table absence, required `seasons`/identity dependencies, and current migration hash. After an approved apply it will align the local filename to the authoritative live migration version, run behavior probes in rollback-only transactions, and run Supabase security/performance advisors.

The migration is additive. Before product data exists, database rollback can drop the ten tables and trigger function in reverse dependency order. After user data exists, rollback is feature disablement plus API withdrawal; populated owner/evidence history must not be silently dropped.

## Completed approval and verification

The user approved live application of the reviewed migration at hash `2e24bdc7286a9a8e64529cf2afe069b17e73c1ff4a378b0460402f8ab4c6efbd`.

- Applied live migration `20260715011329_create_draft_ranker_ownership_foundation` and aligned the local filename to the authoritative ledger.
- Reconciled ten tables, 104 constraints, 42 initial indexes, six triggers, RLS on all ten tables, and 22 owner policies.
- Verified zero `anon` privileges, `authenticated` SELECT on all ten tables, zero authenticated raw-write privileges, no `SECURITY DEFINER` function, and no public/client execution of the timestamp trigger.
- Ran a rolled-back two-account live behavior probe covering owner isolation, raw-write denial, one-active-default uniqueness, sparse-order uniqueness, prompt/comparison/preference integrity, full ranking-child cascades, and zero residual rows.
- Supabase advisors reported no DR-012 security findings. The initial performance pass reported 20 unindexed foreign keys.
- Added and applied `20260715011557_add_draft_ranker_foreign_key_indexes`; all 20 foreign-key findings cleared. Only expected unused-index informational notices remain while the new tables contain no production data.
- Regenerated the identity and draft-ranker portions of `database-generated.types.ts` from the live schema without overwriting unrelated generated-type changes.

DR-012 is complete. This approval did not authorize Yahoo initialization, reorder RPCs, community aggregation, or feature rollout.

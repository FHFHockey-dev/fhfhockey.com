-- PROPOSED, NOT APPLIED. Bring the private FORGE v2 history schema and the goalie tables to production for the H1–H10
-- shadow. Read-only checks first; then the two migrations, in order; then readback.
-- The bounded read on 2026-11-23 (q5) found v2_schema_applied = false: forge_v2_private does not exist in production.
-- Apply through the repo's gated migration process (supabase migration history), not `db push`, so no other pending
-- file rides along. Apply exactly these four files, in order, in one session, before any issuance:
--   1. supabase/migrations/20261029235656_forge_v2_immutable_history.sql (schema, sequence, vintages, receipts, records,
--      artifacts, work queue, triggers, grants)
--   2. supabase/migrations/20261123200000_forge_v2_goalie_h10.sql (goalie vintages + receipts; refuses if 1 is missing)
--   3. supabase/migrations/20261123210000_forge_v2_h10_partitions_archive.sql (Q2: rebuilds the five history tables as
--      monthly partitions by issuance time while empty, refusing otherwise; adds forge_h10_evidence, the archive
--      manifest and index, and month partitions through 2027-08)
--   4. supabase/migrations/20261123220000_forge_h10_hosted_dispatch.sql (Q3: one-use HMAC dispatches; creates no secret
--      or cron job)
-- All are additive to production (forge_v2_private does not exist there yet). No existing public table, function, grant
-- or cron job changes. Nothing reads these tables in production code: the v2 read route is enabled: false.

-- 0. Preflight (read-only).
select to_regclass('forge_v2_private.forge_v2_vintages') is null as v2_absent,
       exists (select from pg_roles where rolname = 'service_role') as service_role_exists,
       (select count(*) from supabase_migrations.schema_migrations where version in ('20261029235656', '20261123200000', '20261123210000', '20261123220000')) as already_recorded,
       exists (select from pg_extension where extname = 'pgcrypto') as pgcrypto_present;

-- 1. Apply the four files (the migration process records each version).

-- 2. Readback (read-only), expected after applying:
select n.nspname, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'forge_v2_private' order by c.relname;
--   expect: the five partitioned tables (relkind p: forge_v2_vintages, forge_v2_publication_receipts, forge_v2_records,
--           forge_v2_goalie_vintages, forge_v2_goalie_publication_receipts) with 10 month partitions each (2026_11..2027_08),
--           forge_v2_artifacts, forge_v2_work_queue, forge_h10_evidence, forge_v2_archives, forge_v2_archive_index,
--           forge_h10_dispatches, forge_v2_issuance_sequence (+ indexes, sequences)
select p.relname as parent, count(*) as months from pg_inherits i join pg_class p on p.oid = i.inhparent join pg_namespace n on n.oid = p.relnamespace
 where n.nspname = 'forge_v2_private' group by 1 order by 1;
select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'forge_v2_private' and not t.tgisinternal order by 1, 2;
--   expect a_unique, immutable, hash/barrier on the five parents (cloned to every month), no_truncate on each parent AND
--   each month partition, forge_v2_predecessor on records, immutable + no_truncate on evidence, archives, archive index.
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
 where table_schema = 'forge_v2_private' and grantee in ('anon', 'authenticated', 'service_role') group by 1, 2 order by 1, 2;
--   expect: service_role INSERT,SELECT on history tables; INSERT,SELECT,UPDATE on forge_v2_work_queue; nothing for anon or authenticated.
select (select count(*) from forge_v2_private.forge_v2_vintages) as vintages, (select count(*) from forge_v2_private.forge_v2_goalie_vintages) as goalie_vintages,
       (select count(*) from forge_v2_private.forge_h10_dispatches) as dispatches;
--   expect 0, 0, 0.
select has_function_privilege('service_role', 'forge_v2_private.forge_h10_tick_v1(text)', 'execute') as service_can_tick,
       has_function_privilege('service_role', 'public.forge_h10_dispatch_begin_v1(uuid, text, text, bigint)', 'execute') as service_can_begin;
--   expect false, true.

-- Rollback, valid only before the first issuance (every table empty); once rows exist they are immutable by design:
--   begin;
--   drop function public.forge_h10_dispatch_begin_v1(uuid, text, text, bigint), public.forge_h10_dispatch_finish_v1(uuid, text);
--   drop table forge_v2_private.forge_v2_goalie_publication_receipts, forge_v2_private.forge_v2_goalie_vintages;
--   drop function forge_v2_private.forge_v2_confirm_committed_goalie_output(), forge_v2_private.forge_v2_goalie_hash_payload();
--   drop schema forge_v2_private cascade;
--   delete from supabase_migrations.schema_migrations where version in ('20261123220000', '20261123210000', '20261123200000', '20261029235656');
--   commit;

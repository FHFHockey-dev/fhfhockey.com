-- NOT APPLIED. Math-audit follow-up, lane L4a; owner decision 135 (TJ pop-up 2026-11-13). Apply only with TJ's
-- pop-up approval, singly, then record schema_migrations and migration-authority.json (order 142).
--
-- public.player_forecast_accountability_revisions.composite_skill_score is NOT NULL and CHECKed to 0-100, so it
-- cannot hold the v2 settlement skill (scoring version player-forecast-skill-v2, decision 65): the aggregated
-- proper skill 1 - sum(model squared error) / sum(baseline squared error) over a checkpoint's cohort
-- (aggregateProperSkill in web/lib/fantasy-projections/properScore.ts). That skill is signed: 0 = no better than
-- the baseline, negative = worse, unbounded below, at most 1 (a perfect forecast).
-- Fix (additive only): one nullable numeric column v2_skill, CHECKed to NULL or a number <= 1 (never NaN).
-- composite_skill_score, its NOT NULL and 0-100 CHECK, every other column, RLS, grants (table-level: service_role
-- SELECT, INSERT, so the new column needs none) and the append-only triggers are unchanged. No row is touched:
-- every existing row reads v2_skill NULL (= not a v2 settlement), so no history is rewritten.
-- Readers and writers come afterwards (L10): readers show v2 skill only where it is not NULL. The ALTER takes a
-- brief ACCESS EXCLUSIVE lock while the new CHECK scans the (small) table.
--
-- READBACK (after apply; catalog and one count):
--   select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public'
--      and table_name = 'player_forecast_accountability_revisions' and column_name in ('v2_skill', 'composite_skill_score');
--   expect v2_skill numeric YES; composite_skill_score numeric NO.
--   select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--    where conname = 'player_forecast_accountability_revisions_v2_skill_check';
--   select count(*) from public.player_forecast_accountability_revisions where v2_skill is not null;  -- expect 0
-- ROLLBACK: supabase/tests/l4a_accountability_v2_skill_rollback.sql (refuses while any v2_skill is stored; the table
--   is append-only, so after the first v2 row it stays refused).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_accountability_v2_skill.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.player_forecast_accountability_revisions
  add column v2_skill numeric
    constraint player_forecast_accountability_revisions_v2_skill_check
    check (v2_skill is null or (v2_skill <= 1 and v2_skill <> 'NaN'::numeric));

comment on column public.player_forecast_accountability_revisions.v2_skill is
  'Signed v2 settlement skill (decision 135): 1 - sum model squared error / sum baseline squared error over the checkpoint cohort; 0 = baseline, negative = worse, at most 1. NULL = not a v2 settlement. composite_skill_score (0-100) is unchanged.';

commit;

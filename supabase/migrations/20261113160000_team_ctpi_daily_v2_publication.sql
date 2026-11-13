-- NOT APPLIED. CTPI v2 publication: math-audit follow-up lane F1 (BA W1-4 A "v2 publication needs an explicit
-- version migration"; rule 21). Apply only with TJ's pop-up approval, singly, then record schema_migrations and
-- migration-authority.json (order 144).
--
-- public.team_ctpi_daily is keyed (season_id, team, date), so a Recent Team Form v2 row for a date
-- (recent-team-form-v2-candidate-2: pooled PP/PK by ice time, decision 20) would overwrite the v1 row
-- (ctpi-formula-v1) already issued for that date. v1 rows are frozen issued history (rule 21). This migration:
--   1. Drops NOT NULL on the five component columns: v2 renormalises over the components it has, and PDO/luck is
--      context only in v2. Same statements as order 56 (20260828142331, state unknown); a no-op where it applied.
--   2. Adds ctpi_version smallint NOT NULL, CHECKed to 1 or 2. Every existing row was issued by the v1 writer, so
--      the add-time default 1 labels them v1. A constant default is catalog-only (no table rewrite, no row update;
--      the CHECK scans the small table once). The default is then dropped: a new row must state its version.
--   3. Replaces the primary key with (season_id, team, date, ctpi_version). The daily writer upserts on that key.
--   4. Adds a BEFORE INSERT OR UPDATE trigger that refuses a v1 insert and any update of a v1 row (55000
--      CTPI_V1_FROZEN). Deletes are not intercepted.
-- The public_read policy, RLS, grants and the date/team indexes are unchanged. No row value changes.
-- Rollout: apply before the release that ships the v2 writer. Until that release, the current v1 writer's upsert
-- (conflict target season_id, team, date) no longer matches a unique key, so its 10:10 UTC run fails closed
-- (42P10) and writes nothing; v1 is frozen anyway. Readers in both code versions keep working. Takes a brief
-- ACCESS EXCLUSIVE lock while the CHECK scans and the new key's index builds.
--
-- PRE-APPLY: select count(*) from public.team_ctpi_daily;  -- note N
-- READBACK (after apply; catalog and counts, no payload reads):
--   select column_name, data_type, is_nullable, column_default from information_schema.columns
--    where table_schema = 'public' and table_name = 'team_ctpi_daily'
--      and column_name in ('ctpi_version', 'offense', 'defense', 'goaltending', 'special_teams', 'luck');
--   expect ctpi_version smallint NO (default NULL); the five components YES.
--   select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--    where conrelid = 'public.team_ctpi_daily'::regclass order by 1;
--   expect team_ctpi_daily_ctpi_version_check CHECK ((ctpi_version = ANY (ARRAY[1, 2]))) and
--          team_ctpi_daily_pkey PRIMARY KEY (season_id, team, date, ctpi_version).
--   select tgname from pg_catalog.pg_trigger where tgrelid = 'public.team_ctpi_daily'::regclass and not tgisinternal;
--   expect team_ctpi_daily_v1_frozen.
--   select ctpi_version, count(*) from public.team_ctpi_daily group by 1;  -- expect only (1, N)
-- ROLLBACK: supabase/tests/f1_ctpi_v2_publication_rollback.sql (refuses while any v2 row is stored; leaves the
--   components nullable, since order 56's state is unknown).
-- PROOF: LC_ALL=C python3 -I supabase/tests/f1_ctpi_v2_publication.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.team_ctpi_daily
  alter column offense drop not null,
  alter column defense drop not null,
  alter column goaltending drop not null,
  alter column special_teams drop not null,
  alter column luck drop not null;

alter table public.team_ctpi_daily
  add column ctpi_version smallint not null default 1
    constraint team_ctpi_daily_ctpi_version_check check (ctpi_version in (1, 2));

alter table public.team_ctpi_daily
  alter column ctpi_version drop default;

alter table public.team_ctpi_daily
  drop constraint team_ctpi_daily_pkey;

alter table public.team_ctpi_daily
  add constraint team_ctpi_daily_pkey primary key (season_id, team, date, ctpi_version);

comment on column public.team_ctpi_daily.ctpi_version is
  'CTPI version (part of the row identity). 1 = ctpi-formula-v1, frozen issued history (rule 21); 2 = Recent Team Form v2 (pooled PP/PK, decision 20), issued by /api/v1/db/update-team-ctpi-daily. payload.formulaVersion and payload.inputVersion carry the exact contract.';

create function fhfh_internal.reject_ctpi_v1_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.ctpi_version = 1 or new.ctpi_version = 1 then
      raise exception using errcode = '55000',
        message = 'CTPI_V1_FROZEN: CTPI v1 rows are issued history (rule 21); write a versioned successor';
    end if;
  elsif new.ctpi_version = 1 then
    raise exception using errcode = '55000',
      message = 'CTPI_V1_FROZEN: CTPI v1 rows are issued history (rule 21); write a versioned successor';
  end if;
  return new;
end;
$$;

revoke all on function fhfh_internal.reject_ctpi_v1_write() from public, anon, authenticated, service_role;

create trigger team_ctpi_daily_v1_frozen
  before insert or update on public.team_ctpi_daily
  for each row execute function fhfh_internal.reject_ctpi_v1_write();

commit;

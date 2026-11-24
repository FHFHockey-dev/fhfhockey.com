-- NOT APPLIED. Additive: H1–H10 predictive interval editions (TJ, 2026-11-23: "Add uncertainty to the existing
-- Full-NHL H1–H10 shadow forecasts"). Applies after 20261123210000 on live data; it changes no existing row, column,
-- trigger or grant of the history tables.
--
-- One immutable edition per published vintage: the vintage's point forecast, target-specific 50% and 90% bands per
-- category (conditional on appearing / starting), the model and calibration versions and the as-of cutoff. Built by
-- lib/forge-v2/h10Intervals.ts and h10IntervalStore.server.ts. Vintages are untouched, so every earlier edition, and
-- its hash, stays as issued. Like the vintages, the table is range-partitioned by month on its insert clock and joins
-- the verified archive procedure.
-- - First write wins across partitions, as for vintages: a second edition for the same id or vintage is skipped.
-- - An edition must name a vintage that exists with the same output hash (checked on insert).
-- - The month function is replaced with the same body plus this table, and `forge_v2_archives` accepts it.
begin;
set lock_timeout = '5s';
set statement_timeout = '60s';

do $$ begin
  if to_regprocedure('forge_v2_private.forge_v2_ensure_month_partitions(date)') is null or to_regclass('forge_v2_private.forge_v2_goalie_vintages') is null then
    raise exception 'apply 20261123200000 and 20261123210000 first';
  end if;
  if to_regclass('forge_v2_private.forge_h10_interval_editions') is not null then raise exception 'forge_h10_interval_editions_exists'; end if;
end $$;

create table forge_v2_private.forge_h10_interval_editions (
  id text not null,
  vintage_id text not null,
  player_class text not null check (player_class in ('skater', 'goalie')),
  player_id bigint not null check (player_id > 0),
  game_id bigint not null check (game_id > 0),
  payload text not null,
  content_hash text not null,
  inserted_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(payload::jsonb) = 'object'),
  check (payload::jsonb ?& array['schemaVersion','id','vintageId','vintageOutputHash','playerClass','playerId','gameId','teamId','horizon','conditionalOn','combination',
    'inputCutoffAt','generatedAt','modelVersion','method','calibration','categories','limitations']),
  check (payload::jsonb->>'schemaVersion' = 'forge-h10-interval-edition-v1'),
  check (payload::jsonb->>'id' = id and payload::jsonb->>'vintageId' = vintage_id and payload::jsonb->>'playerClass' = player_class),
  check ((payload::jsonb->>'playerId')::bigint = player_id and (payload::jsonb->>'gameId')::bigint = game_id),
  check ((payload::jsonb->>'horizon')::int between 1 and 10),
  check (payload::jsonb->>'combination' = 'marginal_per_category_not_summable'),
  check (payload::jsonb->>'conditionalOn' = case player_class when 'goalie' then 'official_start' else 'official_appearance' end)
) partition by range (inserted_at);
alter table forge_v2_private.forge_h10_interval_editions add primary key (id, inserted_at);
create index forge_h10_interval_editions_vintage on forge_v2_private.forge_h10_interval_editions (vintage_id);
create index forge_h10_interval_editions_target on forge_v2_private.forge_h10_interval_editions (player_id, game_id);

-- First write wins across months (a duplicate is skipped, like ON CONFLICT DO NOTHING); the vintage must exist with
-- the hash the edition names.
create function forge_v2_private.forge_h10_interval_guard() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
declare hit integer;
begin
  select 1 into hit from forge_v2_private.forge_h10_interval_editions e where e.id = new.id or e.vintage_id = new.vintage_id limit 1;
  if hit is not null then return null; end if;
  if new.player_class = 'goalie' then
    select 1 into hit from forge_v2_private.forge_v2_goalie_vintages v where v.id = new.vintage_id and v.output_hash = new.payload::jsonb->>'vintageOutputHash';
  else
    select 1 into hit from forge_v2_private.forge_v2_vintages v where v.id = new.vintage_id and v.output_hash = new.payload::jsonb->>'vintageOutputHash';
  end if;
  if hit is null then raise exception 'FORGE_H10_INTERVAL_VINTAGE_MISSING' using errcode = 'foreign_key_violation'; end if;
  new.content_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex');
  return new;
end $$;
revoke all on function forge_v2_private.forge_h10_interval_guard() from public, anon, authenticated;
create trigger a_unique before insert on forge_v2_private.forge_h10_interval_editions for each row execute function forge_v2_private.forge_h10_interval_guard();

alter table forge_v2_private.forge_h10_interval_editions enable row level security;
revoke all on forge_v2_private.forge_h10_interval_editions from public, anon, authenticated, service_role;
grant select, insert on forge_v2_private.forge_h10_interval_editions to service_role;
create policy forge_v2_server_only on forge_v2_private.forge_h10_interval_editions to service_role using (true) with check (true);
create trigger forge_v2_immutable before update or delete on forge_v2_private.forge_h10_interval_editions for each row execute function forge_v2_private.forge_v2_reject_mutation();
create trigger forge_v2_no_truncate before truncate on forge_v2_private.forge_h10_interval_editions for each statement execute function forge_v2_private.forge_v2_reject_mutation();

-- The month function from 20261123210000, unchanged except for the added table. Existing months of the other tables
-- already exist and are skipped.
create or replace function forge_v2_private.forge_v2_ensure_month_partitions(p_through date) returns integer
language plpgsql security definer set search_path = pg_catalog, forge_v2_private as $$
declare
  m date := date_trunc('month', clock_timestamp() at time zone 'UTC')::date; created integer := 0; t text; name text;
begin
  if p_through > m + interval '13 months' then raise exception 'forge_v2_partition_horizon_too_far'; end if;
  while m <= p_through loop
    foreach t in array array['forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts',
      'forge_h10_interval_editions'] loop
      name := t || '_' || to_char(m, 'YYYY_MM');
      if to_regclass('forge_v2_private.' || name) is null then
        execute format('create table forge_v2_private.%I partition of forge_v2_private.%I for values from (%L) to (%L)', name, t,
          (m::timestamp at time zone 'UTC'), ((m + interval '1 month')::timestamp at time zone 'UTC'));
        execute format('alter table forge_v2_private.%I enable row level security', name);
        execute format('revoke all on forge_v2_private.%I from public, anon, authenticated, service_role', name);
        -- Row triggers are inherited from the parent; statement-level TRUNCATE triggers are not, so each month gets one.
        execute format('create trigger forge_v2_no_truncate before truncate on forge_v2_private.%I for each statement execute function forge_v2_private.forge_v2_reject_mutation()', name);
        created := created + 1;
      end if;
    end loop;
    m := (m + interval '1 month')::date;
  end loop;
  return created;
end $$;
select forge_v2_private.forge_v2_ensure_month_partitions(date '2027-08-01');

-- The archive manifest accepts the new table (same procedure, separate approval per month).
alter table forge_v2_private.forge_v2_archives drop constraint forge_v2_archives_table_name_check;
alter table forge_v2_private.forge_v2_archives add constraint forge_v2_archives_table_name_check check (table_name in
  ('forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts','forge_h10_interval_editions'));
commit;

-- Readback (read-only):
--   select to_regclass('forge_v2_private.forge_h10_interval_editions') is not null;
--   select count(*) from pg_inherits i join pg_class c on c.oid = i.inhparent where c.relname = 'forge_h10_interval_editions';  -- expect 10 (2026_11 .. 2027_08)
--   select has_table_privilege('service_role', 'forge_v2_private.forge_h10_interval_editions', 'insert');  -- expect true; update/delete false
-- Rollback (no interval rows yet): drop table forge_v2_private.forge_h10_interval_editions; drop function forge_v2_private.forge_h10_interval_guard();
--   re-create forge_v2_ensure_month_partitions from 20261123210000; restore the five-table archives check.

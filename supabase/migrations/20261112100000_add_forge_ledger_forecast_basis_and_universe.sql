-- NOT APPLIED. Math-audit fix lane L4a, SQL ticket from L10 (decisions 41 and 78). Apply only with TJ's pop-up
-- approval, singly, then record schema_migrations and migration-authority.json (order 138). L10 flips
-- LEDGER_BASIS_SCHEMA_ENABLED (web/lib/player-forecasts/servedForecastLedger.ts) only after this is applied.
--
-- 1. forge_served_forecast_ledger.forecast_basis: the declared scoring basis of each served row (decision 41),
--    'unconditional' (expected contribution over the full eligible pregame universe) or 'conditional_dressed'
--    (given the player dresses). Nullable: rows written before this migration stay NULL = basis not recorded
--    (the reader derives it from source and class); nothing is backfilled.
-- 2. forge_served_forecast_universe: the independent snapshot membership per (served_date, player_id, game_id),
--    including players with no forecast, settled later from boxscore receipts (decision 78). Column types follow
--    the ledger's (player_id and game_id bigint, season_id and team_id integer); season_id, player_class and
--    team_id are NOT NULL like the ledger's, and dressed / receipt / settled_at stay NULL until settled.
-- RLS and grants copy the ledger exactly (20261021230025): RLS on with no policies, everything revoked from
-- public / anon / authenticated / service_role, then SELECT, INSERT, UPDATE for service_role only. The same
-- set_updated_at trigger keeps updated_at current. The PK leads with served_date, which is how every reader
-- filters, so no extra index. The view forge_served_forecast_scoreboard_daily fixed its column list at
-- creation and is unaffected. Grants on the ledger are table-level, so the new column needs none.
-- Readers and writers (web/), all behind LEDGER_BASIS_SCHEMA_ENABLED: pages/api/v1/db/forge-served-forecast-snapshot.ts
-- (ledger forecast_basis; universe upsert on the PK), pages/api/v1/db/forge-served-forecast-settle.ts (select and
-- upsert of the universe settlement columns), pages/api/v1/forge/scoreboard.ts (select of both).
-- Writes no rows. The ledger ALTER takes a brief ACCESS EXCLUSIVE lock while the new CHECK scans the table.
--
-- READBACK (after apply; catalog and one count, no route call):
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'forge_served_forecast_ledger' and column_name = 'forecast_basis';
--   select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--    where conname = 'forge_served_forecast_ledger_forecast_basis_check';
--   select count(*) from public.forge_served_forecast_ledger where forecast_basis is not null;   -- expect 0
--   select c.relname, c.relrowsecurity, c.relacl from pg_catalog.pg_class c where c.relnamespace = 'public'::regnamespace
--    and c.relname in ('forge_served_forecast_ledger', 'forge_served_forecast_universe');
--   expect: text, YES; CHECK ((forecast_basis = ANY (ARRAY['unconditional'::text, 'conditional_dressed'::text])));
--   0; both tables relrowsecurity true with the same relacl (owner plus service_role=arw).
-- ROLLBACK: supabase/tests/l4a_ledger_basis_universe_rollback.sql (drops the universe table and the ledger column;
--   destroys any basis or universe rows written after L10's flag flip, so revert the flag first).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_ledger_basis_universe.py (disposable local PostgreSQL 15).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.forge_served_forecast_ledger
  add column forecast_basis text check (forecast_basis in ('unconditional', 'conditional_dressed'));

comment on column public.forge_served_forecast_ledger.forecast_basis is
  'Declared scoring basis (decision 41): unconditional (full eligible pregame universe) or conditional_dressed. Null on rows written before the column existed (basis not recorded).';

create table public.forge_served_forecast_universe (
  served_date date not null,
  season_id integer not null,
  player_id bigint not null,
  game_id bigint not null,
  player_class text not null check (player_class in ('skater', 'goalie')),
  team_id integer not null,
  dressed boolean,
  receipt jsonb,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forge_served_forecast_universe_pkey primary key (served_date, player_id, game_id)
);

comment on table public.forge_served_forecast_universe is
  'Served-forecast snapshot universe (decision 78): every eligible player-game on the served date, with or without a forecast, settled from boxscore receipts. Service role only.';

create trigger set_updated_at before update on public.forge_served_forecast_universe
  for each row execute function public.update_updated_at_column();

alter table public.forge_served_forecast_universe enable row level security;

revoke all on table public.forge_served_forecast_universe from public, anon, authenticated, service_role;
grant select, insert, update on table public.forge_served_forecast_universe to service_role;

commit;

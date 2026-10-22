-- Migration authority order 99: forge_served_forecast_ledger market source (FORGE improvements task 6.3).
-- Drafted 2026-10-22; apply only with TJ's explicit approval. Widens the source check to allow 'market' and adds the
-- nullable jsonb market_lines (per prop head: line, de-vigged market P(over | no push), implied mean, books, and each
-- served source's P(over | no push) at that line; plus the de-vigged moneyline team win for goalies).
-- Readers and writers (web/): pages/api/v1/db/forge-served-forecast-snapshot.ts (market rows, upsert on the PK),
-- pages/api/v1/forge/scoreboard.ts (select of market_lines). Both read or write the column only while
-- LEDGER_MARKET_ENABLED in lib/player-forecasts/servedForecastLedger.ts is true, so apply this before releasing that flag.
-- The settle route is unchanged: it neither reads nor writes market_lines.
-- Grants are table-level (service_role select/insert/update from migration 97), so the new column needs none.
-- The view forge_served_forecast_scoreboard_daily fixed its column list at creation and is unaffected.
-- Rollback: delete from public.forge_served_forecast_ledger where source = 'market'; drop column market_lines;
-- restore the five-source check.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Migration 97 declared the check inline on the column, so Postgres named it <table>_<column>_check.
-- No IF EXISTS: if the name differs the migration fails rather than leaving the old check in force.
alter table public.forge_served_forecast_ledger
  drop constraint forge_served_forecast_ledger_source_check;

alter table public.forge_served_forecast_ledger
  add constraint forge_served_forecast_ledger_source_check
  check (source in ('bridge_exact', 'bridge_reaimed', 'native', 'naive_last5', 'naive_season', 'market'));

alter table public.forge_served_forecast_ledger
  add column if not exists market_lines jsonb;

comment on column public.forge_served_forecast_ledger.market_lines is
  'Market rows only (task 6.3): per prop head the line, de-vigged market P(over | no push), implied mean, book counts and each served source''s P(over | no push) at that line; team_win holds the de-vigged moneyline for goalies. Null for other sources.';

-- Rollback for 20261112100000_add_forge_ledger_forecast_basis_and_universe.sql: drops the universe table and the
-- ledger's forecast_basis column (its CHECK goes with it). Destroys any rows or basis values written after
-- LEDGER_BASIS_SCHEMA_ENABLED was turned on, so set that flag back to false and release first.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
drop table public.forge_served_forecast_universe;
alter table public.forge_served_forecast_ledger drop column forecast_basis;
commit;

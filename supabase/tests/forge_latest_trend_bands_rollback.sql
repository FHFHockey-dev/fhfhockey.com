-- Rollback for 20261115190000_forge_latest_trend_bands.sql. The reader falls back to its history GET (PGRST202).
drop function if exists public.forge_latest_trend_bands(integer[], text[], text[], date);

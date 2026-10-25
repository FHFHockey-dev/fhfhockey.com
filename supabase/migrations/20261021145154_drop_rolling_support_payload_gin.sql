-- The GIN index on support_payload served no query path (readers select the column by key) and made every
-- support-payload upsert slow enough to hit the 8 s PostgREST statement timeout, stalling the rolling pipeline.
-- Dropped on production 2026-10-21 (about 14:16-14:20Z) by direct SQL with TJ's explicit approval; this migration
-- records that drop so an environment built from the baseline does not keep the index. Idempotent.
set local lock_timeout = '5s';
drop index if exists public.idx_rolling_player_metric_support_payloads_payload_gin;

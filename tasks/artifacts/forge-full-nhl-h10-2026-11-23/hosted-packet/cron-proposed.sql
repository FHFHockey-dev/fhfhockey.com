-- PROPOSED, NOT APPLIED. Hosted schedule for the FORGE Full-NHL H1–H10 prospective shadow issuance (packet rev 4).
-- Auth (TJ Q3, 2026-11-23): per-dispatch HMAC after the 11-17 pregame pattern; no bearer token. Each job calls the
-- owner-only forge_v2_private.forge_h10_tick_v1(mode) (migration 20261123220000), which records a one-use dispatch and
-- posts it signed with Vault 'forge_h10_dispatch_secret' (route, mode, run, dispatch id, 90 s expiry). Only the
-- signature travels. The route checks it before any work and consumes the dispatch once.
-- Prerequisites, each approved separately:
--   - migrations 20261029235656, 20261123200000, 20261123210000, 20261123220000 applied and read back (PACKET §2);
--   - Vault secret 'forge_h10_dispatch_secret' (≥32 printable characters) and the same value in Vercel env
--     FORGE_H10_DISPATCH_SECRET on the fhfhockey production project (a new secret, not CRON_SECRET or the pregame one);
--   - the candidate SHA deployed; FORGE_H10_SHADOW_ENABLED=true, FORGE_H10_SHADOW_APPROVAL_ID, FORGE_H10_SHADOW_APPROVED_AT.
--
-- Cadence (real-data basis):
--   * Nightly: every 15 minutes from 08:00 to 12:59 UTC (04:00–07:59 ET in EST and EDT): 20 ticks a day. A tick while
--     a dispatch is in flight sends nothing ('in_flight'); a started dispatch is stale after 6 minutes.
--   * Material (second job, approved separately, after G2c): :05 and :35 outside 08–12 UTC: 38 ticks a day.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
do $$ begin
  if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC') then raise exception 'cron_timezone_not_utc'; end if;
  if (select count(*) from vault.decrypted_secrets where name = 'forge_h10_dispatch_secret') <> 1 then raise exception 'h10_dispatch_secret_missing'; end if;
  if to_regprocedure('forge_v2_private.forge_h10_tick_v1(text)') is null then raise exception 'h10_dispatch_migration_not_applied'; end if;
  if to_regclass('forge_v2_private.forge_h10_evidence') is null then raise exception 'h10_partition_migration_not_applied'; end if;
  if exists (select from cron.job where jobname = 'forge-h10-shadow-nightly') then raise exception 'h10_job_already_scheduled'; end if;
end $$;
select cron.schedule('forge-h10-shadow-nightly', '*/15 8-12 * * *', $$ select forge_v2_private.forge_h10_tick_v1('nightly') $$);
commit;
-- Readback: select jobid, jobname, schedule, command, active from cron.job where jobname like 'forge-h10-shadow-%';
--           select state, outcome, count(*) from forge_v2_private.forge_h10_dispatches group by 1, 2;
-- Rollback (stops all issuance; rows already written stay, immutable):
--   select cron.unschedule('forge-h10-shadow-nightly');  and set FORGE_H10_SHADOW_ENABLED=false.

-- PROPOSED, NOT APPLIED, SEPARATE APPROVAL: the FxTwitter/News material job, only after G2c (read #3) and one watched
-- nightly run.
begin;
set local lock_timeout = '5s';
do $$ begin
  if not exists (select from cron.job where jobname = 'forge-h10-shadow-nightly') then raise exception 'h10_nightly_job_missing'; end if;
  if exists (select from cron.job where jobname = 'forge-h10-shadow-material') then raise exception 'h10_material_job_already_scheduled'; end if;
end $$;
select cron.schedule('forge-h10-shadow-material', '5,35 0-7,13-23 * * *', $$ select forge_v2_private.forge_h10_tick_v1('material') $$);
commit;
-- Rollback: select cron.unschedule('forge-h10-shadow-material');  (nightly keeps running; overlays already written stay.)

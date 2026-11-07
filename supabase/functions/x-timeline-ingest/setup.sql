-- Layer 3 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md), run by GitHub
-- Actions (.github/workflows/x-twscrape-fallback.yml).
-- Shadow mode's SQL (the ingest-secret check, x_timeline_twscrape_observations and its prune) is the migration
-- supabase/migrations/20261107181046_x_timeline_twscrape_shadow.sql. What is left here is not needed for shadow:
--
-- ===== DRAFT, NOT APPLIED: only for promoting to live (TJ's approval, then its own migration) =====
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Live takeover rule. The Pi wording below predates GitHub Actions: on a 15-minute schedule the job reads every
-- switched account each run, so crossCheck is unused there.
-- Pi takeover rule (layer 3), evaluated per account each time the Pi asks (every 4 minutes):
--   due = tweet_intake_providers.provider = 'fxtwitter'
--         AND (no poller result with results[].sourceKey = <key> and results[].ok = true in the last 2 hours
--              OR the newest such result is older than p_stale_minutes, default 6, minimum 2).
-- "Poller result" = a net._http_response row whose content starts {"ok":..,"providers":..}, the same source the
-- watchdog reads. results[].ok is true when public FxTwitter or the self-hosted mirror served the account and the
-- store/enqueue succeeded (a gap state of 'unrecovered' or 'abandoned' does not change ok). A stalled poller (no results)
-- makes every switched account due. Hand-back is the same rule turning false: one good poller read clears it.
-- Deliberately separate from the watchdog's email thresholds (account_down waits 8 runs) and from
-- x_timeline_alert_state (refreshed only every 5 minutes).
-- Cross-check rule (TJ, 2026-11-06), for a feed that answers but is stale (CCC's feed stuck at 19:16 UTC while its
-- 19:42 post existed):
--   crossCheck = provider = 'fxtwitter' AND extract(minute from now()) % 15 < 5
-- The Pi runs every ~4 minutes, so it lands in each 5-minute window once (occasionally twice) per 15 minutes and reads
-- every switched account then, whatever the poller says. Rows it adds that the poller lacked carry
-- raw_payload->>'provider' = 'twscrape' in x_timeline_shadow_posts: posts the poller missed.
create or replace function public.x_timeline_account_health(p_stale_minutes integer default 6)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with runs as (
    select created, content::jsonb as body
    from net._http_response
    where created > now() - interval '2 hours' and content like '{"ok":%"providers"%'
  ),
  good as (
    select result->>'sourceKey' as source_key, max(runs.created) as last_ok_at
    from runs, jsonb_array_elements(coalesce(runs.body->'results', '[]'::jsonb)) result
    where (result->>'ok')::boolean
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sourceKey', p.source_key,
      'switched', p.provider = 'fxtwitter',
      'lastOkAt', g.last_ok_at,
      'lastRunAt', (select max(created) from runs),
      'due', p.provider = 'fxtwitter'
        and (g.last_ok_at is null or g.last_ok_at < now() - make_interval(mins => greatest(coalesce(p_stale_minutes, 6), 2))),
      'crossCheck', p.provider = 'fxtwitter' and extract(minute from now())::integer % 15 < 5
    ) order by p.source_key), '[]'::jsonb)
  from public.tweet_intake_providers p
  left join good g using (source_key);
$$;

revoke all on function public.x_timeline_account_health(integer) from public, anon, authenticated;
grant execute on function public.x_timeline_account_health(integer) to service_role;

-- ===== not a migration: needed for shadow, run once by TJ in the dashboard =====
-- The ingest secret, generated inside Postgres. TJ copies it into the GitHub repository secret X_INGEST_SECRET.
--   select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
--     'x_timeline_ingest_secret', 'x-timeline-ingest (GitHub Actions twscrape fallback) auth; generated in Postgres');
-- Revoke the job: select vault.update_secret((select id from vault.secrets where name = 'x_timeline_ingest_secret'),
--   replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

-- X intake safety net, layer 3 in SHADOW mode (TJ, 2026-11-07): twscrape on GitHub Actions
-- (.github/workflows/x-twscrape-fallback.yml) posts what it reads to the x-timeline-ingest edge function, which stores
-- it here and nowhere else. NOT applied: applying it is its own TJ approval.
--
-- 1. public.x_timeline_ingest_secret_matches(text): the job's x-fhfh-ingest-secret header must match Vault
--    'x_timeline_ingest_secret' (created separately, in the dashboard; see supabase/functions/x-timeline-ingest/setup.sql).
-- 2. public.x_timeline_twscrape_observations: what twscrape read, kept apart from production. x_timeline_shadow_posts
--    is first-write-wins and the poller queues from first sightings, so a twscrape row there would change what
--    production keeps. Same columns as x_timeline_shadow_posts (compare column to column), plus:
--      timeline_id   where the post sits on the timeline (a repost's wrapper id), for paging back to an overlap;
--      reposted_at   the repost's own time, when the row is a repost (tweet_created_at is the post's own X time);
--      run_id        the GitHub run that first saw it; first_observed_at is when.
--    One row per (source_key, tweet_id): the edge function inserts with ON CONFLICT DO NOTHING, so repeated runs and
--    the paging overlap add nothing. The edge function may only select and insert.
-- 3. public.x_timeline_twscrape_observations_prune(integer): 14-day retention (TJ pop-up 2026-11-07), at most 1,000
--    rows a call. The edge function calls it at the start of every job run, so no new cron job is needed.
-- Service role only throughout: RLS on with no policies, nothing granted to anon or authenticated.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.x_timeline_ingest_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and exists (
    select 1 from vault.decrypted_secrets
    where name = 'x_timeline_ingest_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.x_timeline_ingest_secret_matches(text) from public, anon, authenticated;
grant execute on function public.x_timeline_ingest_secret_matches(text) to service_role;

create table if not exists public.x_timeline_twscrape_observations (
  source_key text not null,
  tweet_id text not null,
  timeline_id text not null,
  source_group text not null,
  source_account text not null,
  post_kind text not null,
  author_handle text not null,
  reposted_by_handle text,
  original_author_handle text,
  quoted_tweet_id text,
  quoted_author_handle text,
  quoted_text text,
  replying_to_handle text,
  full_text text,
  text text,
  link_to_tweet text not null,
  tweet_created_at timestamptz,
  reposted_at timestamptz,
  has_media boolean not null default false,
  media_alt_texts text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  run_id text,
  first_observed_at timestamptz not null default now(),
  primary key (source_key, tweet_id)
);

create index if not exists x_timeline_twscrape_observations_recent
  on public.x_timeline_twscrape_observations (source_key, first_observed_at desc);
create index if not exists x_timeline_twscrape_observations_age
  on public.x_timeline_twscrape_observations (first_observed_at);

alter table public.x_timeline_twscrape_observations enable row level security;
revoke all on table public.x_timeline_twscrape_observations from public, anon, authenticated, service_role;
grant select, insert on table public.x_timeline_twscrape_observations to service_role;

create or replace function public.x_timeline_twscrape_observations_prune(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.x_timeline_twscrape_observations
  where ctid in (
    select ctid from public.x_timeline_twscrape_observations
    where first_observed_at < now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
    limit 1000
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.x_timeline_twscrape_observations_prune(integer) from public, anon, authenticated;
grant execute on function public.x_timeline_twscrape_observations_prune(integer) to service_role;

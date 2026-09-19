begin;
set local lock_timeout = '5s';

alter table public.news_feed_items add column original_tweet_id text;
create unique index news_feed_items_original_tweet_id on public.news_feed_items(original_tweet_id);

create table public.tweet_projection_reports (
  report_key text primary key,
  team_id bigint not null references public.teams(id),
  game_id bigint references public.games(id),
  report_date date not null,
  published_at timestamptz,
  received_at timestamptz not null,
  interpretation_version text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  attribution_attempts integer not null default 0,
  attribution_next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index tweet_projection_reports_team_date on public.tweet_projection_reports(team_id, report_date desc, published_at desc);
create index tweet_projection_reports_game on public.tweet_projection_reports(game_id) where game_id is not null;

create table public.tweet_player_events (
  event_key text primary key,
  player_id bigint not null references public.players(id),
  published_at timestamptz not null,
  availability text not null check(availability in ('out','available','uncertain','unknown')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index tweet_player_events_history on public.tweet_player_events(player_id,published_at desc);

create table public.tweet_pipeline_jobs (
  job_key text primary key,
  status text not null default 'pending' check(status in ('pending','running','complete','failed')),
  owner uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  payload jsonb not null default '{}',
  failure_stage text,
  updated_at timestamptz not null default now()
);
create index tweet_pipeline_jobs_pending on public.tweet_pipeline_jobs(next_attempt_at) where status in ('pending','failed','running');

-- Organizational/camp membership is evidence, not an overwrite of historical rosters.
create table public.tweet_player_memberships (
  player_id bigint not null references public.players(id),
  team_id bigint not null references public.teams(id),
  season_id bigint not null references public.seasons(id),
  membership_kind text not null check(membership_kind in ('organization','camp','roster')),
  source_url text not null check(source_url like 'https://%'),
  verified_at timestamptz not null,
  expires_at timestamptz,
  primary key(player_id,team_id,season_id,membership_kind)
);

do $$ declare table_name text; begin
  foreach table_name in array array['tweet_projection_reports','tweet_pipeline_jobs','tweet_player_memberships','tweet_player_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public,anon,authenticated', table_name);
    execute format('grant select,insert,update,delete on public.%I to service_role', table_name);
  end loop;
end $$;

create function public.claim_tweet_pipeline_job(p_key text, p_owner uuid, p_reprocess boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed text;
begin
  insert into public.tweet_pipeline_jobs(job_key,status,owner,lease_expires_at,attempts)
    values(p_key,'running',p_owner,now()+interval '5 minutes',1)
  on conflict(job_key) do update set status='running',owner=p_owner,
    lease_expires_at=now()+interval '5 minutes',attempts=tweet_pipeline_jobs.attempts+1,updated_at=now()
  where (tweet_pipeline_jobs.status <> 'complete' or p_reprocess)
    and (tweet_pipeline_jobs.status <> 'running' or tweet_pipeline_jobs.lease_expires_at < now())
    and (tweet_pipeline_jobs.attempts < 8 or p_reprocess)
    and tweet_pipeline_jobs.next_attempt_at <= now()
  returning job_key into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_tweet_pipeline_job(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_tweet_pipeline_job(text,uuid,boolean) to service_role;
commit;

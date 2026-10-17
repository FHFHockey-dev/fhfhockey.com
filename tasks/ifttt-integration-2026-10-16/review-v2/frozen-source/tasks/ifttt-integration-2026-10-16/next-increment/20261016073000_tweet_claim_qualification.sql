begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Additive to the frozen staged migration. No production application authorized.
create table public.tweet_claim_context_clock(singleton boolean primary key default true check(singleton), version bigint not null default 0);
insert into public.tweet_claim_context_clock values(true,0);
create table public.tweet_claim_lineage_links (
  receipt text not null, origin_id text not null, fingerprint text not null, payload jsonb not null,
  created_at timestamptz not null default now(), primary key(receipt,origin_id,fingerprint)
);
create index tweet_claim_lineage_links_origin on public.tweet_claim_lineage_links(origin_id);
create table public.tweet_claim_qualification_versions (
  scope_key text not null references public.tweet_claim_scopes(scope_key), version bigint not null,
  fingerprint text not null, payload jsonb not null, created_at timestamptz not null default now(), primary key(scope_key,version)
);
alter table public.tweet_claim_scopes add column qualification_state jsonb;
-- Empty mutable sink tables cannot establish historical absence. A bounded,
-- independently evidenced retention/writer-fence audit is data, never auto-seeded.
create table public.tweet_claim_legacy_history (
  audit_id text primary key, game_id bigint not null, team_id bigint not null,
  known_at timestamptz not null default clock_timestamp(), payload jsonb not null
);
create index tweet_claim_legacy_history_scope on public.tweet_claim_legacy_history(game_id,team_id,known_at);
do $$ declare t text; begin
  foreach t in array array['tweet_claim_context_clock','tweet_claim_lineage_links','tweet_claim_qualification_versions','tweet_claim_legacy_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert on public.%I to service_role',t);
  end loop;
end $$;
grant update on public.tweet_claim_context_clock to service_role;

-- A finite cohort has both a clock boundary and a serialized receipt budget.
alter table public.tweet_claim_evaluation_cohorts add column ends_at timestamptz;
alter table public.tweet_claim_evaluation_cohorts add column max_samples integer;
-- No existing cohort can silently become eligible under a guessed budget.
alter table public.tweet_claim_evaluation_cohorts add constraint tweet_claim_cohort_bounds check
  ((ends_at is null and max_samples is null) or (ends_at>starts_at and ends_at<=starts_at+interval '31 days' and max_samples between 1 and 1000));
grant insert(ends_at,max_samples) on public.tweet_claim_evaluation_cohorts to service_role;
create function public.register_bounded_tweet_claim_evaluation(p_id text,p_start timestamptz,p_end timestamptz,p_max integer,p_version text)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.tweet_claim_evaluation_cohorts;
begin
  perform pg_catalog.pg_advisory_xact_lock(716051605);
  select * into c from public.tweet_claim_evaluation_cohorts where cohort_id=p_id;
  if found then
    if c.starts_at is distinct from p_start or c.ends_at is distinct from p_end or c.max_samples is distinct from p_max
      or c.extraction_version is distinct from p_version then raise exception 'evaluation cohort is immutable'; end if;
    return;
  end if;
  if p_start<=clock_timestamp() or p_end is null or p_max is null then raise exception 'finite future evaluation bounds required'; end if;
  insert into public.tweet_claim_evaluation_cohorts(cohort_id,starts_at,ends_at,max_samples,extraction_version) values(p_id,p_start,p_end,p_max,p_version);
end $$;
create function public.bound_tweet_claim_evaluation_sample() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.tweet_claim_evaluation_cohorts; n integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(716051605);
  select * into strict c from public.tweet_claim_evaluation_cohorts where cohort_id=new.cohort_id;
  if exists(select 1 from public.tweet_claim_evaluation_samples where sample_id=new.sample_id or (cohort_id=new.cohort_id and lineage_key=new.lineage_key)) then
    if not exists(select 1 from public.tweet_claim_evaluation_samples where sample_id=new.sample_id and payload=new.payload) then
      raise exception 'immutable evaluation sample collision';
    end if;
    return null;
  end if;
  -- Budget expiry does not fail raw receipt retention or resume legacy publication.
  if c.ends_at is null or c.max_samples is null or clock_timestamp()>=c.ends_at
    or (new.payload->>'capturedAt')::timestamptz>=c.ends_at then return null; end if;
  if new.payload->>'capturedAt' is null or new.payload->>'publishedAt' is null or new.payload->>'receivedAt' is null
    or (new.payload->>'publishedAt')::timestamptz<c.starts_at or (new.payload->>'receivedAt')::timestamptz<c.starts_at
    or (new.payload->>'capturedAt')::timestamptz< c.starts_at or (new.payload->>'capturedAt')::timestamptz>clock_timestamp()
    or (new.payload->>'publishedAt')::timestamptz>(new.payload->>'receivedAt')::timestamptz
    or (new.payload->>'receivedAt')::timestamptz>(new.payload->>'capturedAt')::timestamptz then raise exception 'invalid prospective sample clocks'; end if;
  select count(*) into n from public.tweet_claim_evaluation_samples where cohort_id=c.cohort_id;
  if n>=c.max_samples then return null; end if;
  return new;
end $$;
create trigger tweet_claim_evaluation_bound before insert on public.tweet_claim_evaluation_samples for each row execute function public.bound_tweet_claim_evaluation_sample();

-- One snapshot of the exact game/team sink scopes. Missing schema/capped reads
-- are explicit incomplete coverage, never an empty known-clear history.
create function public.read_tweet_claim_evidence(p_game bigint,p_team bigint,p_players bigint[],p_asof timestamptz,p_keys text[],p_tweets text[],p_date date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare identities jsonb:='[]'; sinks jsonb:='[]'; rows jsonb; t text; condition text; history jsonb;
begin
  if cardinality(p_players)>100 then raise exception 'identity lookup exceeds bound'; end if;
  if to_regclass('public.nhl_api_game_roster_spots') is not null and to_regclass('public.nhl_api_game_normalization_status') is not null
    and to_regclass('public.nhl_api_game_payloads_raw') is not null then
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('gameId',r.game_id,'date',r.game_date,'playerId',r.player_id,'teamId',r.team_id,
      'league','NHL','fullName',r.first_name||' '||r.last_name,'role',case when r.position_code='G' then 'goalie' else 'skater' end,
      'knownAt',greatest(n.completed_at,r.updated_at,p.fetched_at),'sourceUrl',p.source_url,'rawPayloadId',p.id::text,
      'rawPayloadHash',p.payload_hash,'normalizationFingerprint',n.normalization_fingerprint)),'[]')
      from public.nhl_api_game_roster_spots r join public.nhl_api_game_normalization_status n on n.game_id=r.game_id
      join public.nhl_api_game_payloads_raw p on p.id=n.pbp_raw_payload_id
      where r.game_id=$1 and cardinality($2)<=100 and n.status='complete' and p.game_id=r.game_id and p.endpoint='play-by-play'
      and p.payload_hash=r.source_play_by_play_hash and p.payload_hash=n.pbp_raw_payload_hash
      and r.position_code in ('G','C','L','R','D') and greatest(n.completed_at,r.updated_at,p.fetched_at)<=$3$q$
      into identities using p_game,p_players,p_asof;
  end if;
  foreach t in array array['tweet_projection_reports','tweet_player_events','line_source_snapshots','lines_ccc',
    'player_forecast_goalie_start_observations','player_forecast_lineup_snapshots','line_claim_revisions','line_entry_revisions','line_pp_decisions','line_source_captures'] loop
    if to_regclass('public.'||t) is null then
      sinks:=sinks||jsonb_build_array(jsonb_build_object('sink',t,'complete',false,'rows','[]'::jsonb,'reason','schema_missing'));
      continue;
    end if;
    -- Player-event rows do not have a game/team column: bounded exact aliases are
    -- supplemented by this conservative player/date inventory, never assumed absent.
    condition:=case
      when t='tweet_projection_reports' then '(game_id=$1 and team_id=$2) or report_key=any($5)'
      when t='tweet_player_events' then '(player_id=any($3) and published_at >= ($4::date::timestamp at time zone ''America/New_York'') and published_at < (($4::date+1)::timestamp at time zone ''America/New_York'')) or event_key=any($5)'
      when t in ('line_source_snapshots','lines_ccc') then '(game_id=$1 and team_id=$2) or tweet_id=any($6) or quoted_tweet_id=any($6) or capture_key=any($5)'
      when t in ('player_forecast_goalie_start_observations','player_forecast_lineup_snapshots') then '(game_id=$1 and team_id=$2) or source_capture_key=any($5)'
      when t='line_source_captures' then 'team_id=$2 and (original_identity=any($6) or capture_id=any($5))'
      else 'game_id=$1 and team_id=$2' end;
    execute format('select coalesce(jsonb_agg(j),''[]'') from (select to_jsonb(r) j from public.%I r where %s limit 257) s',t,condition)
      into rows using p_game,p_team,p_players,p_date,p_keys,p_tweets;
    sinks:=sinks||jsonb_build_array(jsonb_build_object('sink',t,'complete',jsonb_array_length(rows)<257,'rows',rows));
  end loop;
  select payload into history from public.tweet_claim_legacy_history where game_id=p_game and team_id=p_team and known_at<=p_asof
    order by known_at desc,audit_id limit 1;
  return jsonb_build_object('identities',identities,'sinks',sinks,'readAt',p_asof,'history',history);
end $$;

create function public.read_tweet_claim_context(p_scope text,p_incoming jsonb,p_asof timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipts text[]; origins text[]; players bigint[]; keys text[]; tweets text[]; source_date date; observations jsonb; links jsonb; g bigint; t bigint; evidence jsonb; v bigint;
begin
  select version into v from public.tweet_claim_context_clock where singleton for share;
  if jsonb_array_length(p_incoming)>256 then raise exception 'claim context bound exceeded'; end if;
  select array_agg(distinct c->>'lineageKey'),array_agg(distinct c->'semantic'->'original'->>'tweetId'),
    array_agg(distinct (c->'semantic'->'fact'->>'playerId')::bigint),max((c->'semantic'->'scope'->>'gameId')::bigint),max((c->'semantic'->'scope'->>'teamId')::bigint)
    into receipts,origins,players,g,t from jsonb_array_elements(p_incoming)c;
  select coalesce(jsonb_agg(payload),'[]') into links from public.tweet_claim_lineage_links where receipt=any(receipts) or origin_id=any(origins);
  origins:=origins||array(select value->>'originId' from jsonb_array_elements(links));
  select coalesce(jsonb_agg(payload),'[]') into links from public.tweet_claim_lineage_links where receipt=any(receipts) or origin_id=any(origins);
  select coalesce(array_agg(distinct value->>'receipt'),'{}')||receipts into receipts from jsonb_array_elements(links);
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into observations from (select payload,ordinal from public.tweet_claim_observations
    where scope_key=p_scope or lineage_key=any(receipts) or origin_id=any(origins) order by ordinal limit 257) bounded;
  if jsonb_array_length(observations)>256 then raise exception 'global lineage context exceeds 256; review required'; end if;
  select array_agg(distinct regexp_replace(a->>'key','^(report|event|capture):','')) into keys
    from jsonb_array_elements(p_incoming||observations)c cross join lateral jsonb_array_elements(c->'aliases')a;
  select array_agg(distinct x) into tweets from unnest(origins||array(select replace(r,'tweet-receipt-v2:','') from unnest(receipts)r))x;
  tweets:=tweets||array(select c->'attribution'->>'originalUrl' from jsonb_array_elements(p_incoming)c);
  select min((c->'semantic'->'original'->>'publishedAt')::timestamptz at time zone 'America/New_York')::date into source_date from jsonb_array_elements(p_incoming)c;
  evidence:=public.read_tweet_claim_evidence(g,t,players,p_asof,keys,tweets,source_date);
  return jsonb_build_object('clock',v,'qualificationFingerprint',(select qualification_state->>'fingerprint' from public.tweet_claim_scopes where scope_key=p_scope),
    'scope',public.read_tweet_claim_scope(p_scope),'observations',observations,'links',links,'evidence',evidence);
end $$;

create function public.commit_qualified_tweet_claim_scope(p_scope text,p_expected bigint,p_clock bigint,p_observations jsonb,p_reduction jsonb,p_reviewed jsonb,p_qualified jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v bigint; link jsonb;
begin
  select version into v from public.tweet_claim_context_clock where singleton for update;
  if v<>p_clock then return false; end if;
  if not public.commit_tweet_claim_scope(p_scope,p_expected,p_observations,p_reduction,p_reviewed) then return false; end if;
  for link in select value from jsonb_array_elements(p_qualified->'lineage'->'links') loop
    insert into public.tweet_claim_lineage_links(receipt,origin_id,fingerprint,payload)
      values(link->>'receipt',link->>'originId',md5(link::text),link) on conflict do nothing;
  end loop;
  insert into public.tweet_claim_qualification_versions(scope_key,version,fingerprint,payload)
    values(p_scope,p_expected+1,p_qualified->>'fingerprint',p_qualified);
  update public.tweet_claim_scopes set qualification_state=p_qualified where scope_key=p_scope;
  -- Every output remains held. Legacy writers do not share this lock, so this
  -- retained read snapshot cannot authorize a later production sink dispatch.
  update public.tweet_claim_outbox set payload=payload||jsonb_build_object('qualification',p_qualified-'plan'),requires_review=true
    where scope_key=p_scope;
  update public.tweet_claim_context_clock set version=version+1 where singleton;
  return true;
end $$;

revoke all on function public.register_bounded_tweet_claim_evaluation(text,timestamptz,timestamptz,integer,text),public.bound_tweet_claim_evaluation_sample(),
  public.read_tweet_claim_evidence(bigint,bigint,bigint[],timestamptz,text[],text[],date),public.read_tweet_claim_context(text,jsonb,timestamptz),
  public.commit_qualified_tweet_claim_scope(text,bigint,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.register_bounded_tweet_claim_evaluation(text,timestamptz,timestamptz,integer,text),public.bound_tweet_claim_evaluation_sample(),
  public.read_tweet_claim_evidence(bigint,bigint,bigint[],timestamptz,text[],text[],date),public.read_tweet_claim_context(text,jsonb,timestamptz),
  public.commit_qualified_tweet_claim_scope(text,bigint,bigint,jsonb,jsonb,jsonb,jsonb) to service_role;
commit;

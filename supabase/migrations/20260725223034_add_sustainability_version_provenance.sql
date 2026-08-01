-- Make the active TypeScript sustainability pipeline's model/config identity
-- first-class without rewriting legacy score or prior history.

alter table public.model_sustainability_config
  add column if not exists score_model_version text,
  add column if not exists config_hash text;

update public.model_sustainability_config
set score_model_version = coalesce(
      nullif(btrim(score_model_version), ''),
      'legacy_draft_v1'
    ),
    config_hash = coalesce(
      nullif(btrim(config_hash), ''),
      'legacy_unversioned'
    )
where score_model_version is null
   or config_hash is null
   or btrim(score_model_version) = ''
   or btrim(config_hash) = '';

alter table public.model_sustainability_config
  alter column score_model_version set not null,
  alter column config_hash set not null;

alter table public.model_sustainability_config
  drop constraint if exists model_sustainability_config_score_model_nonblank,
  add constraint model_sustainability_config_score_model_nonblank
    check (
      nullif(btrim(score_model_version), '') is not null
      and char_length(score_model_version) <= 80
    ),
  drop constraint if exists model_sustainability_config_hash_nonblank,
  add constraint model_sustainability_config_hash_nonblank
    check (
      nullif(btrim(config_hash), '') is not null
      and char_length(config_hash) <= 128
    );

create unique index if not exists
  model_sustainability_config_one_active_idx
on public.model_sustainability_config ((active))
where active;

revoke insert, update, delete, truncate, references, trigger
  on table public.model_sustainability_config
  from anon, authenticated;
revoke usage, select
  on sequence public.model_sustainability_config_id_seq
  from anon, authenticated;
grant select on table public.model_sustainability_config to anon, authenticated;

alter table public.sustainability_scores
  add column if not exists model_version text,
  add column if not exists config_hash text,
  add column if not exists sustainability_quintile smallint;

update public.sustainability_scores
set model_version = coalesce(
      nullif(btrim(model_version), ''),
      nullif(btrim(components ->> 'modelVersion'), ''),
      'legacy_unversioned'
    ),
    config_hash = coalesce(
      nullif(btrim(config_hash), ''),
      nullif(btrim(components ->> 'configHash'), ''),
      'legacy_unversioned'
    )
where model_version is null
   or config_hash is null
   or btrim(model_version) = ''
   or btrim(config_hash) = '';

alter table public.sustainability_scores
  alter column model_version set not null,
  alter column config_hash set not null;

alter table public.sustainability_scores
  drop constraint if exists sustainability_scores_model_version_nonblank,
  add constraint sustainability_scores_model_version_nonblank
    check (
      nullif(btrim(model_version), '') is not null
      and char_length(model_version) <= 80
    ),
  drop constraint if exists sustainability_scores_config_hash_nonblank,
  add constraint sustainability_scores_config_hash_nonblank
    check (
      nullif(btrim(config_hash), '') is not null
      and char_length(config_hash) <= 128
    ),
  drop constraint if exists sustainability_scores_quintile_range,
  add constraint sustainability_scores_quintile_range
    check (
      sustainability_quintile is null
      or sustainability_quintile between 0 and 4
    );

create index if not exists sustainability_scores_version_hash_idx
  on public.sustainability_scores (model_version, config_hash, snapshot_date desc);

create table if not exists public.sustainability_distribution_snapshots (
  config_revision integer not null,
  model_version text not null,
  config_hash text not null,
  season_id integer not null,
  snapshot_date date not null,
  window_code text not null,
  population_count integer not null,
  minimum double precision not null,
  maximum double precision not null,
  mean double precision not null,
  stdev double precision not null,
  percentiles jsonb not null,
  created_at timestamptz not null default now(),
  primary key (config_revision, season_id, snapshot_date, window_code),
  constraint sustainability_distribution_count_positive
    check (population_count > 0),
  constraint sustainability_distribution_window_code
    check (window_code in ('l3', 'l5', 'l10', 'l20')),
  constraint sustainability_distribution_model_nonblank
    check (nullif(btrim(model_version), '') is not null),
  constraint sustainability_distribution_hash_nonblank
    check (nullif(btrim(config_hash), '') is not null),
  constraint sustainability_distribution_percentiles_object
    check (jsonb_typeof(percentiles) = 'object')
);

alter table public.sustainability_distribution_snapshots enable row level security;
alter table public.sustainability_distribution_snapshots force row level security;
revoke all on table public.sustainability_distribution_snapshots
  from public, anon, authenticated;
grant select, insert, update on table public.sustainability_distribution_snapshots
  to service_role;

alter table public.sustainability_player_priors
  add column if not exists model_version text,
  add column if not exists config_hash text;

update public.sustainability_player_priors
set model_version = coalesce(
      nullif(btrim(model_version), ''),
      'legacy_unversioned'
    ),
    config_hash = coalesce(
      nullif(btrim(config_hash), ''),
      'legacy_unversioned'
    )
where model_version is null
   or config_hash is null
   or btrim(model_version) = ''
   or btrim(config_hash) = '';

alter table public.sustainability_player_priors
  alter column model_version set not null,
  alter column config_hash set not null;

alter table public.sustainability_player_priors
  drop constraint if exists sustainability_player_priors_model_version_nonblank,
  add constraint sustainability_player_priors_model_version_nonblank
    check (
      nullif(btrim(model_version), '') is not null
      and char_length(model_version) <= 80
    ),
  drop constraint if exists sustainability_player_priors_config_hash_nonblank,
  add constraint sustainability_player_priors_config_hash_nonblank
    check (
      nullif(btrim(config_hash), '') is not null
      and char_length(config_hash) <= 128
    );

create table if not exists public.sustainability_recompute_queue (
  id bigint generated by default as identity primary key,
  config_revision integer not null,
  model_version text not null,
  config_hash text not null,
  reason text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  cursor jsonb,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  enqueued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint sustainability_recompute_queue_revision_positive
    check (config_revision > 0),
  constraint sustainability_recompute_queue_model_nonblank
    check (
      nullif(btrim(model_version), '') is not null
      and char_length(model_version) <= 80
    ),
  constraint sustainability_recompute_queue_hash_nonblank
    check (
      nullif(btrim(config_hash), '') is not null
      and char_length(config_hash) <= 128
    ),
  constraint sustainability_recompute_queue_reason_check
    check (reason in ('config_change', 'data_backfill')),
  constraint sustainability_recompute_queue_status_check
    check (status in ('queued', 'running', 'completed', 'failed')),
  constraint sustainability_recompute_queue_attempts_nonnegative
    check (attempts >= 0)
);

create unique index if not exists
  sustainability_recompute_queue_active_config_idx
on public.sustainability_recompute_queue
  (config_revision, model_version, config_hash)
where status in ('queued', 'running');

alter table public.sustainability_recompute_queue enable row level security;
alter table public.sustainability_recompute_queue force row level security;
revoke all on table public.sustainability_recompute_queue from public, anon, authenticated;
revoke all on sequence public.sustainability_recompute_queue_id_seq
  from public, anon, authenticated;
grant select, insert, update on table public.sustainability_recompute_queue
  to service_role;
grant usage, select on sequence public.sustainability_recompute_queue_id_seq
  to service_role;

create or replace function public.claim_sustainability_recompute_queue()
returns setof public.sustainability_recompute_queue
language sql
security invoker
set search_path = pg_catalog
as $function$
  with candidate as (
    select queue.id
    from public.sustainability_recompute_queue as queue
    where queue.status = 'queued'
       or (
         queue.status = 'failed'
         and queue.next_attempt_at <= pg_catalog.now()
       )
    order by queue.enqueued_at, queue.id
    for update skip locked
    limit 1
  )
  update public.sustainability_recompute_queue as queue
  set status = 'running',
      attempts = queue.attempts + 1,
      started_at = pg_catalog.now(),
      last_error = null
  from candidate
  where queue.id = candidate.id
  returning queue.*;
$function$;

create or replace function public.advance_sustainability_recompute_queue(
  p_id bigint,
  p_cursor jsonb,
  p_completed boolean,
  p_error text default null
)
returns setof public.sustainability_recompute_queue
language sql
security invoker
set search_path = pg_catalog
as $function$
  update public.sustainability_recompute_queue as queue
  set cursor = coalesce(p_cursor, queue.cursor),
      status = case
        when p_error is not null then 'failed'
        when p_completed then 'completed'
        else 'queued'
      end,
      last_error = case
        when p_error is null then null
        else left(p_error, 240)
      end,
      next_attempt_at = case
        when p_error is null then pg_catalog.now()
        else pg_catalog.now()
          + pg_catalog.make_interval(
              secs => least(
                3600,
                30 * pg_catalog.power(2, least(greatest(queue.attempts - 1, 0), 7))
              )::integer
            )
      end,
      completed_at = case
        when p_error is null and p_completed then pg_catalog.now()
        else null
      end
  where queue.id = p_id
    and queue.status = 'running'
  returning queue.*;
$function$;

revoke all on function public.claim_sustainability_recompute_queue()
  from public, anon, authenticated;
grant execute on function public.claim_sustainability_recompute_queue()
  to service_role;
revoke all on function public.advance_sustainability_recompute_queue(
  bigint, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.advance_sustainability_recompute_queue(
  bigint, jsonb, boolean, text
) to service_role;

create or replace function public.finalize_sustainability_score_snapshot(
  p_config_revision integer,
  p_model_version text,
  p_config_hash text,
  p_season_id integer,
  p_snapshot_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_score_rows integer;
  v_snapshot_rows integer;
begin
  if p_config_revision is null
     or nullif(btrim(p_model_version), '') is null
     or nullif(btrim(p_config_hash), '') is null
     or p_season_id is null
     or p_snapshot_date is null then
    raise exception 'score snapshot finalization scope is invalid';
  end if;

  with ranked as (
    select
      score.player_id,
      score.snapshot_date,
      score.window_code,
      ntile(5) over (
        partition by score.window_code
        order by score.s_100, score.player_id
      ) - 1 as quintile
    from public.sustainability_scores as score
    where score.model_version = p_model_version
      and score.config_hash = p_config_hash
      and score.season_id = p_season_id
      and score.snapshot_date = p_snapshot_date
  )
  update public.sustainability_scores as score
  set sustainability_quintile = ranked.quintile
  from ranked
  where score.player_id = ranked.player_id
    and score.snapshot_date = ranked.snapshot_date
    and score.window_code = ranked.window_code;
  get diagnostics v_score_rows = row_count;

  insert into public.sustainability_distribution_snapshots (
    config_revision,
    model_version,
    config_hash,
    season_id,
    snapshot_date,
    window_code,
    population_count,
    minimum,
    maximum,
    mean,
    stdev,
    percentiles
  )
  select
    p_config_revision,
    p_model_version,
    p_config_hash,
    p_season_id,
    p_snapshot_date,
    score.window_code,
    count(*)::integer,
    min(score.s_100),
    max(score.s_100),
    avg(score.s_100),
    coalesce(stddev_pop(score.s_100), 0),
    jsonb_build_object(
      'p10', percentile_cont(0.10) within group (order by score.s_100),
      'p20', percentile_cont(0.20) within group (order by score.s_100),
      'p25', percentile_cont(0.25) within group (order by score.s_100),
      'p40', percentile_cont(0.40) within group (order by score.s_100),
      'p50', percentile_cont(0.50) within group (order by score.s_100),
      'p60', percentile_cont(0.60) within group (order by score.s_100),
      'p75', percentile_cont(0.75) within group (order by score.s_100),
      'p80', percentile_cont(0.80) within group (order by score.s_100),
      'p90', percentile_cont(0.90) within group (order by score.s_100)
    )
  from public.sustainability_scores as score
  where score.model_version = p_model_version
    and score.config_hash = p_config_hash
    and score.season_id = p_season_id
    and score.snapshot_date = p_snapshot_date
  group by score.window_code
  on conflict (config_revision, season_id, snapshot_date, window_code)
  do update set
    model_version = excluded.model_version,
    config_hash = excluded.config_hash,
    population_count = excluded.population_count,
    minimum = excluded.minimum,
    maximum = excluded.maximum,
    mean = excluded.mean,
    stdev = excluded.stdev,
    percentiles = excluded.percentiles,
    created_at = pg_catalog.now();
  get diagnostics v_snapshot_rows = row_count;

  if v_score_rows = 0 or v_snapshot_rows = 0 then
    raise exception 'score snapshot finalization found no canonical rows';
  end if;

  return jsonb_build_object(
    'scoreRows', v_score_rows,
    'snapshotRows', v_snapshot_rows
  );
end;
$function$;

revoke all on function public.finalize_sustainability_score_snapshot(
  integer, text, text, integer, date
) from public, anon, authenticated;
grant execute on function public.finalize_sustainability_score_snapshot(
  integer, text, text, integer, date
) to service_role;

create or replace function public.activate_sustainability_config(
  p_config_revision integer,
  p_model_version text,
  p_config_hash text,
  p_weights jsonb,
  p_toggles jsonb,
  p_constants jsonb,
  p_sd_mode text,
  p_freshness_days integer,
  p_reason text default 'config_change'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  v_current_revision integer;
  v_queue_id bigint;
begin
  if p_config_revision is null or p_config_revision <= 0 then
    raise exception 'config revision must be positive';
  end if;
  if nullif(btrim(p_model_version), '') is null
     or char_length(p_model_version) > 80 then
    raise exception 'model version is invalid';
  end if;
  if nullif(btrim(p_config_hash), '') is null
     or char_length(p_config_hash) > 128
     or p_config_hash !~ '^fnv1a_[0-9a-f]{8}$' then
    raise exception 'config hash is invalid';
  end if;
  if jsonb_typeof(p_weights) <> 'object'
     or jsonb_typeof(p_weights -> 'luck') <> 'object'
     or jsonb_typeof(p_weights -> 'skill') <> 'object'
     or not (p_weights -> 'luck' ?& array['shp', 'oishp', 'ipp', 'ppshp'])
     or not (p_weights -> 'skill' ?& array['ixg60', 'icf60', 'hdcf60']) then
    raise exception 'weights must match the canonical score contract';
  end if;
  if jsonb_typeof(p_toggles) <> 'object'
     or jsonb_typeof(p_constants) <> 'object' then
    raise exception 'toggles and constants must be objects';
  end if;
  if p_sd_mode not in ('fixed', 'empirical') then
    raise exception 'sd mode is invalid';
  end if;
  if p_freshness_days is null or p_freshness_days < 1
     or p_freshness_days > 365 then
    raise exception 'freshness days is invalid';
  end if;
  if p_reason not in ('config_change', 'data_backfill') then
    raise exception 'recompute reason is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sustainability_config_activation', 0)
  );

  select max(config.model_version)
    into v_current_revision
  from public.model_sustainability_config as config;

  if p_config_revision <> coalesce(v_current_revision, 0) + 1 then
    raise exception 'config revision must advance exactly once';
  end if;

  update public.model_sustainability_config
  set active = false,
      updated_at = now()
  where active;

  insert into public.model_sustainability_config (
    model_version,
    score_model_version,
    config_hash,
    active,
    weights_json,
    toggles_json,
    constants_json,
    sd_mode,
    freshness_days
  )
  values (
    p_config_revision,
    btrim(p_model_version),
    btrim(p_config_hash),
    true,
    p_weights,
    p_toggles,
    p_constants,
    p_sd_mode,
    p_freshness_days
  );

  insert into public.sustainability_recompute_queue (
    config_revision,
    model_version,
    config_hash,
    reason,
    cursor
  )
  values (
    p_config_revision,
    btrim(p_model_version),
    btrim(p_config_hash),
    p_reason,
    jsonb_build_object(
      'stage', 'priors',
      'season', 'current',
      'snapshotDate', 'current',
      'offset', 0,
      'limit', 250
    )
  )
  returning id into v_queue_id;

  return jsonb_build_object(
    'configRevision', p_config_revision,
    'modelVersion', btrim(p_model_version),
    'configHash', btrim(p_config_hash),
    'queueId', v_queue_id,
    'queueStatus', 'queued'
  );
end;
$function$;

revoke all on function public.activate_sustainability_config(
  integer, text, text, jsonb, jsonb, jsonb, text, integer, text
) from public, anon, authenticated;
grant execute on function public.activate_sustainability_config(
  integer, text, text, jsonb, jsonb, jsonb, text, integer, text
) to service_role;

-- The supported hosted-schema baseline is intentionally data-free. Preserve the
-- historical revision identity on a fresh replay without changing an existing
-- hosted configuration row.
insert into public.model_sustainability_config (
  model_version,
  score_model_version,
  config_hash,
  active,
  weights_json,
  toggles_json,
  constants_json,
  sd_mode,
  freshness_days
)
select
  1,
  'legacy_draft_v1',
  'legacy_unversioned',
  false,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'fixed',
  45
where not exists (
  select 1
  from public.model_sustainability_config
);

select public.activate_sustainability_config(
  2,
  'sustainability_score_v2',
  'fnv1a_91691726',
  '{
    "luck": {"shp": -1.2, "oishp": -1.0, "ipp": -0.8, "ppshp": -0.4},
    "skill": {"ixg60": 0.9, "icf60": 0.7, "hdcf60": 0.6}
  }'::jsonb,
  '{}'::jsonb,
  '{
    "scorePrecision": 2,
    "exactScoreProbabilityThresholds": {"lower": 0.005, "upper": 0.995},
    "windowCodes": ["l3", "l5", "l10", "l20"]
  }'::jsonb,
  'fixed',
  45,
  'config_change'
);

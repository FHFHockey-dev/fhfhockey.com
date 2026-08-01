-- Atomically version Yahoo game metadata and its complete normalized week set.

create table if not exists public.yahoo_game_week_snapshots (
  snapshot_id uuid primary key,
  game_id integer not null,
  game_key text not null,
  season integer not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  source_count integer not null check (source_count > 0),
  metadata_changed boolean not null,
  changed_count integer not null check (changed_count >= 0),
  removed_count integer not null check (removed_count >= 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists yahoo_game_week_snapshots_game_created_idx
  on public.yahoo_game_week_snapshots (game_id, created_at desc);

alter table public.yahoo_game_week_snapshots enable row level security;
alter table public.yahoo_game_week_snapshots force row level security;

revoke all on table public.yahoo_game_week_snapshots
  from public, anon, authenticated, service_role;
grant select, insert on table public.yahoo_game_week_snapshots
  to service_role;

create or replace function public.replace_yahoo_game_weeks_snapshot(
  p_snapshot_id uuid,
  p_game jsonb,
  p_weeks jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_game_id integer;
  resolved_game_key text;
  resolved_season integer;
  normalized_weeks jsonb;
  source_hash text;
  source_count integer;
  metadata_changed_count integer := 0;
  changed_count integer := 0;
  removed_count integer := 0;
  prior public.yahoo_game_week_snapshots%rowtype;
begin
  if p_snapshot_id is null
     or p_game is null
     or pg_catalog.jsonb_typeof(p_game) <> 'object'
     or p_weeks is null
     or pg_catalog.jsonb_typeof(p_weeks) <> 'array'
  then
    raise exception using message = 'YAHOO_GAME_WEEK_SNAPSHOT_INVALID';
  end if;

  begin
    resolved_game_id := (p_game ->> 'game_id')::integer;
    resolved_season := (p_game ->> 'season')::integer;
  exception when others then
    raise exception using message = 'YAHOO_GAME_WEEK_GAME_INVALID';
  end;
  resolved_game_key := pg_catalog.btrim(p_game ->> 'game_key');

  if resolved_game_id <= 0
     or resolved_season < 1900
     or resolved_game_key is null
     or resolved_game_key = ''
     or resolved_game_key !~ '^[A-Za-z0-9._-]+$'
  then
    raise exception using message = 'YAHOO_GAME_WEEK_GAME_INVALID';
  end if;

  begin
    select
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'week', parsed.week,
          'start_date', parsed.start_date,
          'end_date', parsed.end_date
        )
        order by parsed.week
      ),
      pg_catalog.count(*)::integer
    into normalized_weeks, source_count
    from (
      select
        (entry ->> 'week')::integer as week,
        (entry ->> 'start_date')::date as start_date,
        (entry ->> 'end_date')::date as end_date
      from pg_catalog.jsonb_array_elements(p_weeks) as item(entry)
    ) as parsed;
  exception when others then
    raise exception using message = 'YAHOO_GAME_WEEK_ROWS_INVALID';
  end;

  if source_count <= 0
     or exists (
       select 1
       from pg_catalog.jsonb_to_recordset(normalized_weeks)
         as week_row(week integer, start_date date, end_date date)
       where week_row.week <= 0
          or week_row.start_date is null
          or week_row.end_date is null
          or week_row.start_date > week_row.end_date
     )
     or (
       select pg_catalog.count(distinct week_row.week)
       from pg_catalog.jsonb_to_recordset(normalized_weeks)
         as week_row(week integer)
     ) <> source_count
  then
    raise exception using message = 'YAHOO_GAME_WEEK_ROWS_INVALID';
  end if;

  source_hash := pg_catalog.encode(
    extensions.digest(
      (
        p_game
        || pg_catalog.jsonb_build_object('weeks', normalized_weeks)
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:yahoo-game-weeks:' || resolved_game_id::text,
      0
    )
  );

  select *
  into prior
  from public.yahoo_game_week_snapshots
  where snapshot_id = p_snapshot_id;

  if found then
    if prior.game_id <> resolved_game_id
       or prior.game_key <> resolved_game_key
       or prior.season <> resolved_season
       or prior.source_hash <> source_hash
       or prior.source_count <> source_count
    then
      raise exception using message = 'YAHOO_GAME_WEEK_SNAPSHOT_CONFLICT';
    end if;

    return pg_catalog.jsonb_build_object(
      'snapshotId', prior.snapshot_id,
      'gameId', prior.game_id,
      'gameKey', prior.game_key,
      'season', prior.season,
      'sourceHash', prior.source_hash,
      'sourceCount', prior.source_count,
      'metadataChanged', prior.metadata_changed,
      'changed', prior.changed_count,
      'removed', prior.removed_count,
      'replayed', true
    );
  end if;

  insert into public.yahoo_game_keys (
    game_id,
    game_key,
    name,
    code,
    type,
    url,
    season,
    game_weeks,
    last_updated
  )
  values (
    resolved_game_id,
    resolved_game_key,
    nullif(pg_catalog.btrim(p_game ->> 'name'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'code'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'type'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'url'), ''),
    resolved_season,
    normalized_weeks,
    pg_catalog.clock_timestamp()
  )
  on conflict (game_id) do update
  set
    game_key = excluded.game_key,
    name = excluded.name,
    code = excluded.code,
    type = excluded.type,
    url = excluded.url,
    season = excluded.season,
    game_weeks = excluded.game_weeks,
    last_updated = excluded.last_updated
  where (
    public.yahoo_game_keys.game_key,
    public.yahoo_game_keys.name,
    public.yahoo_game_keys.code,
    public.yahoo_game_keys.type,
    public.yahoo_game_keys.url,
    public.yahoo_game_keys.season,
    public.yahoo_game_keys.game_weeks
  ) is distinct from (
    excluded.game_key,
    excluded.name,
    excluded.code,
    excluded.type,
    excluded.url,
    excluded.season,
    excluded.game_weeks
  );

  get diagnostics metadata_changed_count = row_count;

  insert into public.yahoo_matchup_weeks (
    game_key,
    game_id,
    name,
    code,
    type,
    url,
    season,
    week,
    start_date,
    end_date
  )
  select
    resolved_game_key,
    resolved_game_id::text,
    nullif(pg_catalog.btrim(p_game ->> 'name'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'code'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'type'), ''),
    nullif(pg_catalog.btrim(p_game ->> 'url'), ''),
    resolved_season::text,
    week_row.week,
    week_row.start_date,
    week_row.end_date
  from pg_catalog.jsonb_to_recordset(normalized_weeks)
    as week_row(week integer, start_date date, end_date date)
  on conflict (game_key, season, week) do update
  set
    game_id = excluded.game_id,
    name = excluded.name,
    code = excluded.code,
    type = excluded.type,
    url = excluded.url,
    start_date = excluded.start_date,
    end_date = excluded.end_date
  where (
    public.yahoo_matchup_weeks.game_id,
    public.yahoo_matchup_weeks.name,
    public.yahoo_matchup_weeks.code,
    public.yahoo_matchup_weeks.type,
    public.yahoo_matchup_weeks.url,
    public.yahoo_matchup_weeks.start_date,
    public.yahoo_matchup_weeks.end_date
  ) is distinct from (
    excluded.game_id,
    excluded.name,
    excluded.code,
    excluded.type,
    excluded.url,
    excluded.start_date,
    excluded.end_date
  );

  get diagnostics changed_count = row_count;

  delete from public.yahoo_matchup_weeks as existing
  where existing.game_key = resolved_game_key
    and existing.season = resolved_season::text
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(normalized_weeks)
        as week_row(week integer)
      where week_row.week = existing.week
    );

  get diagnostics removed_count = row_count;

  insert into public.yahoo_game_week_snapshots (
    snapshot_id,
    game_id,
    game_key,
    season,
    source_hash,
    source_count,
    metadata_changed,
    changed_count,
    removed_count
  )
  values (
    p_snapshot_id,
    resolved_game_id,
    resolved_game_key,
    resolved_season,
    source_hash,
    source_count,
    metadata_changed_count = 1,
    changed_count,
    removed_count
  );

  return pg_catalog.jsonb_build_object(
    'snapshotId', p_snapshot_id,
    'gameId', resolved_game_id,
    'gameKey', resolved_game_key,
    'season', resolved_season,
    'sourceHash', source_hash,
    'sourceCount', source_count,
    'metadataChanged', metadata_changed_count = 1,
    'changed', changed_count,
    'removed', removed_count,
    'replayed', false
  );
end;
$function$;

revoke all on function public.replace_yahoo_game_weeks_snapshot(
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.replace_yahoo_game_weeks_snapshot(
  uuid,
  jsonb,
  jsonb
) to service_role;

comment on function public.replace_yahoo_game_weeks_snapshot(
  uuid,
  jsonb,
  jsonb
) is
  'Atomically versions canonical Yahoo game metadata and one complete normalized matchup-week snapshot.';

-- Projection raw shift snapshots may come from the NHL HTML shift reports when
-- the JSON shiftcharts feed is empty for a final game. Both raw writers store
-- the same envelope, `source: "htmlreports"`, whose rows carry gameId and
-- typeCode 517, so the typed row-identity checks below apply unchanged.
-- Only the accepted source set widens; scope, identity, locking, collision and
-- head checks are identical to 20261011115124.

begin;
set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function public.capture_projection_raw_source_snapshots_v1(
  p_game_id bigint,
  p_season_id bigint,
  p_game_date date,
  p_pbp_source_url text,
  p_pbp_payload_hash text,
  p_pbp_payload jsonb,
  p_shift_source_url text,
  p_shift_payload_hash text,
  p_shift_payload jsonb
)
returns table (
  game_id bigint,
  pbp_raw_payload_id bigint,
  pbp_raw_snapshot_version bigint,
  pbp_raw_payload_hash text,
  shift_raw_payload_id bigint,
  shift_raw_snapshot_version bigint,
  shift_raw_payload_hash text
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '60s'
as $$
declare
  v_pbp_raw public.nhl_api_game_payloads_raw%rowtype;
  v_shift_raw public.nhl_api_game_payloads_raw%rowtype;
  v_pbp_head public.nhl_api_game_payload_snapshot_heads%rowtype;
  v_shift_head public.nhl_api_game_payload_snapshot_heads%rowtype;
  v_shift_count integer;
begin
  if p_game_id is null
    or p_game_id <= 0
    or p_game_id > 2147483647
    or p_season_id is null
    or p_season_id <= 0
    or p_game_date is null
  then
    raise exception using message = 'INVALID_PROJECTION_RAW_SNAPSHOT_SCOPE';
  end if;

  if p_pbp_payload_hash is null
    or p_pbp_payload_hash !~ '^[0-9a-f]{64}$'
    or p_shift_payload_hash is null
    or p_shift_payload_hash !~ '^[0-9a-f]{64}$'
    or p_pbp_source_url is distinct from (
      'https://api-web.nhle.com/v1/gamecenter/'
      || p_game_id::text
      || '/play-by-play'
    )
    or p_shift_source_url is distinct from (
      'https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId='
      || p_game_id::text
    )
  then
    raise exception using message = 'INVALID_PROJECTION_RAW_SNAPSHOT_IDENTITY';
  end if;

  if pg_catalog.jsonb_typeof(p_pbp_payload) is distinct from 'object'
    or p_pbp_payload->>'id' is distinct from p_game_id::text
    or p_pbp_payload->>'season' is distinct from p_season_id::text
    or p_pbp_payload->>'gameDate' is distinct from p_game_date::text
    or pg_catalog.jsonb_typeof(p_pbp_payload->'plays') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_pbp_payload->'plays') not between 1 and 1000
  then
    raise exception using message = 'INVALID_PROJECTION_RAW_PBP_PAYLOAD';
  end if;

  if pg_catalog.jsonb_typeof(p_shift_payload) is distinct from 'object'
    or p_shift_payload->>'source' is null
    or p_shift_payload->>'source' not in ('json-api', 'htmlreports')
    or pg_catalog.jsonb_typeof(p_shift_payload->'data') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_shift_payload->'data') not between 1 and 20000
    or p_shift_payload->>'total' is distinct from
      pg_catalog.jsonb_array_length(p_shift_payload->'data')::text
  then
    raise exception using message = 'INVALID_PROJECTION_RAW_SHIFT_PAYLOAD';
  end if;

  -- The upstream property names are camelCase. Keep the raw envelope intact
  -- and project those exact keys only for bounded identity validation.
  select
    pg_catalog.count(*)::integer
  into v_shift_count
  from pg_catalog.jsonb_to_recordset(p_shift_payload->'data') as incoming(
    "gameId" bigint,
    "playerId" bigint,
    "teamId" bigint,
    "shiftNumber" integer,
    period integer,
    "startTime" text,
    "endTime" text,
    duration text,
    "typeCode" integer
  );

  if v_shift_count <> pg_catalog.jsonb_array_length(p_shift_payload->'data')
    or exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_shift_payload->'data') as incoming(
        "gameId" bigint,
        "playerId" bigint,
        "teamId" bigint,
        "shiftNumber" integer,
        period integer,
        "startTime" text,
        "endTime" text,
        "typeCode" integer
      )
      where incoming."gameId" is distinct from p_game_id
        or incoming."playerId" is null
        or incoming."playerId" <= 0
        or incoming."teamId" is null
        or incoming."teamId" <= 0
        or incoming."shiftNumber" is null
        or incoming."shiftNumber" < 0
        or incoming.period is null
        or incoming.period < 0
        or incoming."startTime" is null
        or incoming."endTime" is null
        or incoming."typeCode" is null
    )
  then
    raise exception using message = 'INVALID_PROJECTION_RAW_SHIFT_ROWS';
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and game.date = p_game_date
  ) then
    raise exception using message = 'PROJECTION_RAW_SNAPSHOT_SCHEDULE_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:projection-game:' || p_game_id::text, 0)
  );

  insert into public.nhl_api_game_payloads_raw (
    game_id,
    endpoint,
    season_id,
    game_date,
    source_url,
    payload_hash,
    payload,
    fetched_at
  ) values (
    p_game_id,
    'play-by-play',
    p_season_id,
    p_game_date,
    p_pbp_source_url,
    p_pbp_payload_hash,
    p_pbp_payload,
    pg_catalog.transaction_timestamp()
  )
  on conflict on constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key
  do nothing;

  select raw.*
  into v_pbp_raw
  from public.nhl_api_game_payloads_raw as raw
  where raw.game_id = p_game_id
    and raw.endpoint = 'play-by-play'
    and raw.payload_hash = p_pbp_payload_hash;

  if not found
    or v_pbp_raw.season_id is distinct from p_season_id
    or v_pbp_raw.game_date is distinct from p_game_date
    or v_pbp_raw.source_url is distinct from p_pbp_source_url
    or v_pbp_raw.payload is distinct from p_pbp_payload
  then
    raise exception using message = 'PROJECTION_RAW_PBP_HASH_COLLISION';
  end if;

  insert into public.nhl_api_game_payloads_raw (
    game_id,
    endpoint,
    season_id,
    game_date,
    source_url,
    payload_hash,
    payload,
    fetched_at
  ) values (
    p_game_id,
    'shiftcharts',
    p_season_id,
    p_game_date,
    p_shift_source_url,
    p_shift_payload_hash,
    p_shift_payload,
    pg_catalog.transaction_timestamp()
  )
  on conflict on constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key
  do nothing;

  select raw.*
  into v_shift_raw
  from public.nhl_api_game_payloads_raw as raw
  where raw.game_id = p_game_id
    and raw.endpoint = 'shiftcharts'
    and raw.payload_hash = p_shift_payload_hash;

  if not found
    or v_shift_raw.season_id is distinct from p_season_id
    or v_shift_raw.game_date is distinct from p_game_date
    or v_shift_raw.source_url is distinct from p_shift_source_url
    or v_shift_raw.payload is distinct from p_shift_payload
  then
    raise exception using message = 'PROJECTION_RAW_SHIFT_HASH_COLLISION';
  end if;

  select head.*
  into v_pbp_head
  from public.nhl_api_game_payload_snapshot_heads as head
  where head.game_id = p_game_id
    and head.endpoint = 'play-by-play'
  for update;

  select head.*
  into v_shift_head
  from public.nhl_api_game_payload_snapshot_heads as head
  where head.game_id = p_game_id
    and head.endpoint = 'shiftcharts'
  for update;

  if v_pbp_head.raw_payload_id is distinct from v_pbp_raw.id
    or v_pbp_head.payload_hash is distinct from p_pbp_payload_hash
    or v_pbp_head.snapshot_version is null
    or v_pbp_head.snapshot_version <= 0
    or v_shift_head.raw_payload_id is distinct from v_shift_raw.id
    or v_shift_head.payload_hash is distinct from p_shift_payload_hash
    or v_shift_head.snapshot_version is null
    or v_shift_head.snapshot_version <= 0
  then
    raise exception using message = 'PROJECTION_RAW_SNAPSHOT_NOT_CURRENT';
  end if;

  return query
  select
    p_game_id,
    v_pbp_raw.id,
    v_pbp_head.snapshot_version,
    p_pbp_payload_hash,
    v_shift_raw.id,
    v_shift_head.snapshot_version,
    p_shift_payload_hash;
end;
$$;

commit;

-- Add fail-closed, versioned projection materialization receipts and make each
-- game-scoped write one exact, locked transaction. The new state tables are
-- service-only; no browser role receives a policy or object privilege.

begin;

set lock_timeout = '5s';
set statement_timeout = '120s';

-- Acquire the write-blocking lock before building the supporting index. This
-- avoids a lock-upgrade race with a raw writer that queues while the index is
-- being built, and keeps the seed-to-trigger interval closed to new inserts.
-- Plain readers remain available throughout the migration transaction.
lock table public.nhl_api_game_payloads_raw in share row exclusive mode;

-- Every raw Gamecenter insert participates in the same per-game transaction
-- lock as projection materialization. The head row is the monotonic database
-- authority for the current immutable payload at each endpoint; fetched_at is
-- retained as evidence, but never used as a version clock.
create unique index nhl_api_game_payloads_raw_snapshot_identity_idx
  on public.nhl_api_game_payloads_raw (id, game_id, endpoint, payload_hash);

create table public.nhl_api_game_payload_snapshot_heads (
  game_id bigint not null,
  endpoint text not null,
  snapshot_version bigint not null,
  raw_payload_id bigint not null,
  payload_hash text not null,
  fetched_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (game_id, endpoint),
  constraint nhl_raw_snapshot_head_exact_payload_fkey foreign key (
    raw_payload_id,
    game_id,
    endpoint,
    payload_hash
  ) references public.nhl_api_game_payloads_raw (
    id,
    game_id,
    endpoint,
    payload_hash
  ) on delete restrict,
  constraint nhl_raw_snapshot_head_endpoint_check check (
    endpoint in ('play-by-play', 'boxscore', 'landing', 'shiftcharts')
  ),
  constraint nhl_raw_snapshot_head_version_check check (snapshot_version > 0),
  constraint nhl_raw_snapshot_head_hash_check check (
    pg_catalog.btrim(payload_hash) <> ''
  )
);

insert into public.nhl_api_game_payload_snapshot_heads (
  game_id,
  endpoint,
  snapshot_version,
  raw_payload_id,
  payload_hash,
  fetched_at,
  created_at,
  updated_at
)
select
  ranked.game_id,
  ranked.endpoint,
  ranked.snapshot_count,
  ranked.id,
  ranked.payload_hash,
  ranked.fetched_at,
  pg_catalog.transaction_timestamp(),
  pg_catalog.transaction_timestamp()
from (
  select
    raw.id,
    raw.game_id,
    raw.endpoint,
    raw.payload_hash,
    raw.fetched_at,
    pg_catalog.count(*) over (
      partition by raw.game_id, raw.endpoint
    )::bigint as snapshot_count,
    pg_catalog.row_number() over (
      partition by raw.game_id, raw.endpoint
      order by raw.fetched_at desc, raw.id desc
    ) as recency_rank
  from public.nhl_api_game_payloads_raw as raw
) as ranked
where ranked.recency_rank = 1;

create or replace function public.lock_nhl_api_game_payload_snapshot_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_raw public.nhl_api_game_payloads_raw%rowtype;
  v_head public.nhl_api_game_payload_snapshot_heads%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:projection-game:' || new.game_id::text,
      0
    )
  );

  -- ON CONFLICT DO NOTHING does not fire AFTER INSERT. Treat an exact replay
  -- as idempotent while still allowing an upstream payload to legitimately
  -- revert to a previously observed immutable identity.
  select raw.*
  into v_existing_raw
  from public.nhl_api_game_payloads_raw as raw
  where raw.game_id = new.game_id
    and raw.endpoint = new.endpoint
    and raw.payload_hash = new.payload_hash;

  if found then
    select head.*
    into v_head
    from public.nhl_api_game_payload_snapshot_heads as head
    where head.game_id = new.game_id
      and head.endpoint = new.endpoint
    for update;

    if not found then
      insert into public.nhl_api_game_payload_snapshot_heads (
        game_id,
        endpoint,
        snapshot_version,
        raw_payload_id,
        payload_hash,
        fetched_at,
        updated_at
      ) values (
        v_existing_raw.game_id,
        v_existing_raw.endpoint,
        1,
        v_existing_raw.id,
        v_existing_raw.payload_hash,
        v_existing_raw.fetched_at,
        pg_catalog.transaction_timestamp()
      );
    elsif v_head.raw_payload_id is distinct from v_existing_raw.id then
      if v_head.snapshot_version = 9223372036854775807 then
        raise exception using message = 'PROJECTION_RAW_SNAPSHOT_VERSION_EXHAUSTED';
      end if;
      update public.nhl_api_game_payload_snapshot_heads as head
      set
        snapshot_version = head.snapshot_version + 1,
        raw_payload_id = v_existing_raw.id,
        payload_hash = v_existing_raw.payload_hash,
        fetched_at = v_existing_raw.fetched_at,
        updated_at = pg_catalog.transaction_timestamp()
      where head.game_id = new.game_id
        and head.endpoint = new.endpoint;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.advance_nhl_api_game_payload_snapshot_head()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    where head.game_id = new.game_id
      and head.endpoint = new.endpoint
      and head.snapshot_version = 9223372036854775807
    for update
  ) then
    raise exception using message = 'PROJECTION_RAW_SNAPSHOT_VERSION_EXHAUSTED';
  end if;

  insert into public.nhl_api_game_payload_snapshot_heads as head (
    game_id,
    endpoint,
    snapshot_version,
    raw_payload_id,
    payload_hash,
    fetched_at,
    updated_at
  ) values (
    new.game_id,
    new.endpoint,
    1,
    new.id,
    new.payload_hash,
    new.fetched_at,
    pg_catalog.transaction_timestamp()
  )
  on conflict on constraint nhl_api_game_payload_snapshot_heads_pkey
  do update set
    snapshot_version = head.snapshot_version + 1,
    raw_payload_id = excluded.raw_payload_id,
    payload_hash = excluded.payload_hash,
    fetched_at = excluded.fetched_at,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger nhl_api_game_payloads_raw_projection_lock
before insert on public.nhl_api_game_payloads_raw
for each row execute function public.lock_nhl_api_game_payload_snapshot_insert();

create trigger nhl_api_game_payloads_raw_advance_snapshot_head
after insert on public.nhl_api_game_payloads_raw
for each row execute function public.advance_nhl_api_game_payload_snapshot_head();

create trigger nhl_api_game_payloads_raw_no_delete
before delete on public.nhl_api_game_payloads_raw
for each row execute function public.prevent_nhl_api_game_payloads_raw_mutation();

revoke all on function public.lock_nhl_api_game_payload_snapshot_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.advance_nhl_api_game_payload_snapshot_head()
  from public, anon, authenticated, service_role;
revoke all on function public.prevent_nhl_api_game_payloads_raw_mutation()
  from public, anon, authenticated, service_role;

alter table public.nhl_api_game_payload_snapshot_heads
  enable row level security;
alter table public.nhl_api_game_payload_snapshot_heads
  force row level security;

revoke all on table public.nhl_api_game_payload_snapshot_heads
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.nhl_api_game_payload_snapshot_heads
  to service_role;

-- The baseline described this table as immutable but still granted destructive
-- service-role privileges. Inserts and reads are sufficient for the supported
-- raw writers; the existing UPDATE trigger and this ACL/DELETE trigger close
-- every ordinary service-role mutation path.
revoke update, delete, truncate on table public.nhl_api_game_payloads_raw
  from service_role;

create table public.projection_game_materialization_status (
  game_id bigint primary key references public.games(id) on delete cascade,

  input_status text not null default 'pending',
  input_fingerprint text,
  input_version bigint not null default 0,
  pbp_source_hash text,
  shift_source_hash text,
  pbp_raw_payload_id bigint references public.nhl_api_game_payloads_raw(id)
    on delete restrict,
  pbp_raw_snapshot_version bigint,
  pbp_raw_payload_hash text,
  shift_raw_payload_id bigint references public.nhl_api_game_payloads_raw(id)
    on delete restrict,
  shift_raw_snapshot_version bigint,
  shift_raw_payload_hash text,
  parser_version text,
  input_materializer_version text,
  expected_play_rows integer,
  observed_play_rows integer,
  expected_strength_rows integer,
  observed_strength_rows integer,
  input_completed_at timestamp with time zone,

  relationship_status text not null default 'pending',
  relationship_input_fingerprint text,
  relationship_fingerprint text,
  relationship_version bigint not null default 0,
  relationship_algorithm_version text,
  expected_relationship_rows integer,
  observed_relationship_rows integer,
  relationship_completed_at timestamp with time zone,

  derived_status text not null default 'pending',
  derived_input_fingerprint text,
  derived_fingerprint text,
  derived_version bigint not null default 0,
  derived_algorithm_version text,
  goalie_outcome text,
  goalie_justification text,
  expected_player_rows integer,
  observed_player_rows integer,
  expected_team_rows integer,
  observed_team_rows integer,
  expected_goalie_rows integer,
  observed_goalie_rows integer,
  derived_completed_at timestamp with time zone,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint projection_materialization_input_state_check check ((
    (
      input_status = 'pending'
      and input_fingerprint is null
      and input_version = 0
      and pbp_source_hash is null
      and shift_source_hash is null
      and pbp_raw_payload_id is null
      and pbp_raw_snapshot_version is null
      and pbp_raw_payload_hash is null
      and shift_raw_payload_id is null
      and shift_raw_snapshot_version is null
      and shift_raw_payload_hash is null
      and parser_version is null
      and input_materializer_version is null
      and expected_play_rows is null
      and observed_play_rows is null
      and expected_strength_rows is null
      and observed_strength_rows is null
      and input_completed_at is null
    )
    or
    (
      input_status = 'complete'
      and input_fingerprint ~ '^[0-9a-f]{64}$'
      and input_version > 0
      and pbp_source_hash ~ '^[0-9a-f]{64}$'
      and shift_source_hash ~ '^[0-9a-f]{64}$'
      and pbp_raw_payload_id > 0
      and pbp_raw_snapshot_version > 0
      and pbp_raw_payload_hash ~ '^[0-9a-f]{64}$'
      and shift_raw_payload_id > 0
      and shift_raw_snapshot_version > 0
      and shift_raw_payload_hash ~ '^[0-9a-f]{64}$'
      and pg_catalog.btrim(parser_version) <> ''
      and pg_catalog.char_length(parser_version) <= 128
      and pg_catalog.btrim(input_materializer_version) <> ''
      and pg_catalog.char_length(input_materializer_version) <= 128
      and expected_play_rows between 1 and 1000
      and observed_play_rows = expected_play_rows
      and expected_strength_rows between 1 and 100
      and observed_strength_rows = expected_strength_rows
      and input_completed_at is not null
    )
  ) is true),
  constraint projection_materialization_relationship_state_check check ((
    (
      relationship_status = 'pending'
      and relationship_input_fingerprint is null
      and relationship_fingerprint is null
      and relationship_version >= 0
      and relationship_algorithm_version is null
      and expected_relationship_rows is null
      and observed_relationship_rows is null
      and relationship_completed_at is null
    )
    or
    (
      relationship_status = 'complete'
      and input_status = 'complete'
      and relationship_input_fingerprint = input_fingerprint
      and relationship_fingerprint ~ '^[0-9a-f]{64}$'
      and relationship_version > 0
      and pg_catalog.btrim(relationship_algorithm_version) <> ''
      and pg_catalog.char_length(relationship_algorithm_version) <= 128
      and expected_relationship_rows between 1 and 100
      and observed_relationship_rows = expected_relationship_rows
      and relationship_completed_at is not null
    )
  ) is true),
  constraint projection_materialization_derived_state_check check ((
    (
      derived_status = 'pending'
      and derived_input_fingerprint is null
      and derived_fingerprint is null
      and derived_version >= 0
      and derived_algorithm_version is null
      and goalie_outcome is null
      and goalie_justification is null
      and expected_player_rows is null
      and observed_player_rows is null
      and expected_team_rows is null
      and observed_team_rows is null
      and expected_goalie_rows is null
      and observed_goalie_rows is null
      and derived_completed_at is null
    )
    or
    (
      derived_status = 'complete'
      and input_status = 'complete'
      and derived_input_fingerprint = input_fingerprint
      and derived_fingerprint ~ '^[0-9a-f]{64}$'
      and derived_version > 0
      and pg_catalog.btrim(derived_algorithm_version) <> ''
      and pg_catalog.char_length(derived_algorithm_version) <= 128
      and expected_player_rows between 1 and 100
      and observed_player_rows = expected_player_rows
      and expected_team_rows = 2
      and observed_team_rows = expected_team_rows
      and (
        (
          goalie_outcome = 'complete'
          and goalie_justification is null
          and expected_goalie_rows between 1 and 4
          and observed_goalie_rows = expected_goalie_rows
        )
        or
        (
          goalie_outcome = 'not_observed'
          and goalie_justification in (
            'completed_pbp_contains_no_countable_shot_events',
            'completed_pbp_countable_events_are_all_empty_net'
          )
          and expected_goalie_rows = 0
          and observed_goalie_rows = 0
        )
      )
      and derived_completed_at is not null
    )
  ) is true),
  constraint projection_materialization_versions_nonnegative_check check (
    input_version >= 0
    and relationship_version >= 0
    and derived_version >= 0
  )
);

create index nhl_api_game_payload_snapshot_heads_raw_payload_idx
  on public.nhl_api_game_payload_snapshot_heads (
    raw_payload_id,
    game_id,
    endpoint,
    payload_hash
  );
create index projection_materialization_pbp_raw_payload_idx
  on public.projection_game_materialization_status (pbp_raw_payload_id);
create index projection_materialization_shift_raw_payload_idx
  on public.projection_game_materialization_status (shift_raw_payload_id);

create table public.projection_pipeline_state (
  pipeline_key text not null,
  scope_key text not null,
  operation_key text not null,
  revision bigint not null default 0,
  status text not null default 'pending',
  cursor_game_id bigint,
  cursor_date date,
  range_start_date date,
  range_end_date date,
  lease_owner text,
  lease_expires_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (pipeline_key, scope_key, operation_key),
  constraint projection_pipeline_key_check check (
    pipeline_key ~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    and scope_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:@/+-]{0,127}$'
    and operation_key ~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
  ),
  constraint projection_pipeline_revision_check check (revision >= 0),
  constraint projection_pipeline_range_check check (
    (range_start_date is null and range_end_date is null)
    or (
      range_start_date is not null
      and range_end_date is not null
      and range_start_date <= range_end_date
      and range_end_date - range_start_date <= 366
    )
  ),
  constraint projection_pipeline_state_check check ((
    (
      status = 'pending'
      and lease_owner is null
      and lease_expires_at is null
      and last_error is null
    )
    or
    (
      status = 'running'
      and pg_catalog.btrim(lease_owner) <> ''
      and pg_catalog.char_length(lease_owner) <= 128
      and lease_expires_at is not null
      and last_error is null
    )
    or
    (
      status = 'complete'
      and lease_owner is null
      and lease_expires_at is null
      and last_error is null
    )
    or
    (
      status = 'failed'
      and lease_owner is null
      and lease_expires_at is null
      and pg_catalog.btrim(last_error) <> ''
      and pg_catalog.char_length(last_error) <= 1000
    )
  ) is true),
  constraint projection_pipeline_cursor_check check (
    cursor_game_id is null or cursor_game_id > 0
  )
);

create index projection_pipeline_state_lease_idx
  on public.projection_pipeline_state (lease_expires_at)
  where status = 'running';

alter table public.projection_game_materialization_status
  enable row level security;
alter table public.projection_game_materialization_status
  force row level security;
alter table public.projection_pipeline_state
  enable row level security;
alter table public.projection_pipeline_state
  force row level security;

revoke all on table public.projection_game_materialization_status
  from public, anon, authenticated, service_role;
revoke all on table public.projection_pipeline_state
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.projection_game_materialization_status
  to service_role;
grant select, insert, update on table public.projection_pipeline_state
  to service_role;

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
  v_shift_distinct_count integer;
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
    or p_shift_payload->>'source' is distinct from 'json-api'
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
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct row(
      incoming."gameId",
      incoming."playerId",
      incoming."teamId",
      incoming."shiftNumber",
      incoming.period,
      incoming."startTime",
      incoming."endTime",
      incoming.duration,
      incoming."typeCode"
    ))::integer
  into v_shift_count, v_shift_distinct_count
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
    or v_shift_distinct_count <> v_shift_count
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

revoke all on function public.capture_projection_raw_source_snapshots_v1(
  bigint, bigint, date, text, text, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.capture_projection_raw_source_snapshots_v1(
  bigint, bigint, date, text, text, jsonb, text, text, jsonb
) to service_role;

create or replace function public.persist_projection_game_inputs_v1(
  p_game_id bigint,
  p_expected_current_input_fingerprint text,
  p_input_fingerprint text,
  p_pbp_source_hash text,
  p_shift_source_hash text,
  p_pbp_raw_payload_id bigint,
  p_pbp_raw_snapshot_version bigint,
  p_pbp_raw_payload_hash text,
  p_shift_raw_payload_id bigint,
  p_shift_raw_snapshot_version bigint,
  p_shift_raw_payload_hash text,
  p_parser_version text,
  p_materializer_version text,
  p_game_row jsonb,
  p_play_rows jsonb,
  p_strength_rows jsonb,
  p_expected_play_rows integer,
  p_expected_strength_rows integer
)
returns table (
  game_id bigint,
  input_status text,
  input_fingerprint text,
  input_version bigint,
  pbp_raw_payload_id bigint,
  pbp_raw_snapshot_version bigint,
  pbp_raw_payload_hash text,
  shift_raw_payload_id bigint,
  shift_raw_snapshot_version bigint,
  shift_raw_payload_hash text,
  expected_play_rows integer,
  observed_play_rows integer,
  expected_strength_rows integer,
  observed_strength_rows integer,
  pruned_play_rows integer,
  pruned_strength_rows integer,
  idempotent boolean,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '60s'
as $$
declare
  v_game record;
  v_current public.projection_game_materialization_status%rowtype;
  v_has_current boolean := false;
  v_manifest_identity_matches boolean := false;
  v_game_content_matches boolean := false;
  v_play_content_matches boolean := false;
  v_strength_content_matches boolean := false;
  v_idempotent boolean := false;
  v_input_version bigint;
  v_play_payload_count integer;
  v_play_distinct_count integer;
  v_terminal_event_count integer;
  v_strength_payload_count integer;
  v_strength_distinct_count integer;
  v_strength_team_count integer;
  v_rows_are_valid boolean;
  v_existing_play_count integer;
  v_existing_strength_count integer;
  v_existing_shift_count integer;
  v_existing_player_derived_count integer;
  v_existing_team_derived_count integer;
  v_existing_goalie_derived_count integer;
  v_observed_play_count integer;
  v_observed_strength_count integer;
  v_pruned_play_count integer := 0;
  v_pruned_strength_count integer := 0;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null
    or p_game_id <= 0
    or p_game_id > 2147483647
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_GAME_ID';
  end if;

  if p_input_fingerprint is null
    or p_input_fingerprint !~ '^[0-9a-f]{64}$'
    or p_pbp_source_hash is null
    or p_pbp_source_hash !~ '^[0-9a-f]{64}$'
    or p_shift_source_hash is null
    or p_shift_source_hash !~ '^[0-9a-f]{64}$'
    or p_pbp_raw_payload_id is null
    or p_pbp_raw_payload_id <= 0
    or p_pbp_raw_snapshot_version is null
    or p_pbp_raw_snapshot_version <= 0
    or p_pbp_raw_payload_hash is null
    or p_pbp_raw_payload_hash !~ '^[0-9a-f]{64}$'
    or p_shift_raw_payload_id is null
    or p_shift_raw_payload_id <= 0
    or p_shift_raw_snapshot_version is null
    or p_shift_raw_snapshot_version <= 0
    or p_shift_raw_payload_hash is null
    or p_shift_raw_payload_hash !~ '^[0-9a-f]{64}$'
    or p_parser_version is null
    or pg_catalog.btrim(p_parser_version) = ''
    or pg_catalog.char_length(p_parser_version) > 128
    or p_parser_version !~ '^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$'
    or p_materializer_version is null
    or pg_catalog.btrim(p_materializer_version) = ''
    or pg_catalog.char_length(p_materializer_version) > 128
    or p_materializer_version !~ '^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$'
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_IDENTITY';
  end if;

  if p_expected_current_input_fingerprint is not null
    and p_expected_current_input_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception using message = 'INVALID_EXPECTED_PROJECTION_INPUT_FINGERPRINT';
  end if;

  if pg_catalog.jsonb_typeof(p_game_row) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_play_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_strength_rows) is distinct from 'array'
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_PAYLOAD_SHAPE';
  end if;

  if p_expected_play_rows is null
    or p_expected_play_rows not between 1 and 1000
    or pg_catalog.jsonb_array_length(p_play_rows) <> p_expected_play_rows
    or p_expected_strength_rows is null
    or p_expected_strength_rows not between 1 and 100
    or pg_catalog.jsonb_array_length(p_strength_rows) <> p_expected_strength_rows
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_EXPECTED_COUNTS';
  end if;

  select incoming.*
  into v_game
  from pg_catalog.jsonb_to_record(p_game_row) as incoming(
    id integer,
    date date,
    starttime timestamp with time zone,
    type integer,
    season character varying(255),
    hometeamid integer,
    awayteamid integer,
    hometeamname character varying(255),
    hometeamabbrev character varying(255),
    hometeamscore integer,
    awayteamname character varying(255),
    awayteamabbrev character varying(255),
    awayteamscore integer,
    location character varying(255),
    outcome character varying(255)
  );

  if v_game.id is distinct from p_game_id::integer
    or v_game.date is null
    or v_game.type is null
    or v_game.season is null
    or pg_catalog.btrim(v_game.season) = ''
    or v_game.hometeamid is null
    or v_game.hometeamid <= 0
    or v_game.awayteamid is null
    or v_game.awayteamid <= 0
    or v_game.hometeamid = v_game.awayteamid
    or v_game.hometeamscore is null
    or v_game.hometeamscore < 0
    or v_game.awayteamscore is null
    or v_game.awayteamscore < 0
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_GAME_ROW';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.id)::integer,
    pg_catalog.count(*) filter (
      where incoming.typedesckey = 'game-end'
    )::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.id > 0
            and incoming.gameid = p_game_id::integer
            and incoming.game_date = v_game.date
            and (incoming.periodnumber is null or incoming.periodnumber between 1 and 9)
            and (incoming.sortorder is null or incoming.sortorder >= 0)
            and (
              incoming.eventownerteamid is null
              or incoming.eventownerteamid in (v_game.hometeamid, v_game.awayteamid)
            )
            and (incoming.losingplayerid is null or incoming.losingplayerid > 0)
            and (incoming.winningplayerid is null or incoming.winningplayerid > 0)
            and (incoming.playerid is null or incoming.playerid > 0)
            and (incoming.shootingplayerid is null or incoming.shootingplayerid > 0)
            and (incoming.goalieinnetid is null or incoming.goalieinnetid > 0)
            and (incoming.blockingplayerid is null or incoming.blockingplayerid > 0)
            and (incoming.hittingplayerid is null or incoming.hittingplayerid > 0)
            and (incoming.hitteeplayerid is null or incoming.hitteeplayerid > 0)
            and (incoming.committedbyplayerid is null or incoming.committedbyplayerid > 0)
            and (incoming.drawnbyplayerid is null or incoming.drawnbyplayerid > 0)
            and (incoming.scoringplayerid is null or incoming.scoringplayerid > 0)
            and (incoming.assist1playerid is null or incoming.assist1playerid > 0)
            and (incoming.assist2playerid is null or incoming.assist2playerid > 0)
          ),
          false
        )
      ),
      false
    )
  into
    v_play_payload_count,
    v_play_distinct_count,
    v_terminal_event_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_play_rows) as incoming(
    id integer,
    gameid integer,
    periodnumber integer,
    periodtype character varying(255),
    timeinperiod character varying(255),
    timeremaining character varying(255),
    situationcode character varying(255),
    typedesckey character varying(255),
    hometeamdefendingside character varying(255),
    sortorder integer,
    eventownerteamid integer,
    losingplayerid integer,
    winningplayerid integer,
    playerid integer,
    zonecode character varying(255),
    xcoord integer,
    ycoord integer,
    reason character varying(255),
    typecode integer,
    shootingplayerid integer,
    goalieinnetid integer,
    awaysog integer,
    homesog integer,
    blockingplayerid integer,
    hittingplayerid integer,
    hitteeplayerid integer,
    durationofpenalty character varying(255),
    committedbyplayerid integer,
    drawnbyplayerid integer,
    penalizedteam character varying(255),
    scoringplayerid integer,
    scoringplayertotal integer,
    shottype character varying(255),
    assist1playerid integer,
    assist1playertotal integer,
    assist2playerid integer,
    assist2playertotal integer,
    homescore integer,
    awayscore integer,
    game_date date
  );

  if v_play_payload_count <> p_expected_play_rows
    or v_play_distinct_count <> p_expected_play_rows
    or v_terminal_event_count <> 1
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_PLAY_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.player_id)::integer,
    pg_catalog.count(distinct incoming.team_id)::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.game_id = p_game_id::integer
            and incoming.player_id > 0
            and incoming.team_id in (v_game.hometeamid, v_game.awayteamid)
            and incoming.opponent_team_id in (v_game.hometeamid, v_game.awayteamid)
            and incoming.opponent_team_id <> incoming.team_id
            and incoming.game_date = v_game.date
            and incoming.total_es_toi ~ '^[0-9]+:[0-5][0-9]$'
            and incoming.total_pp_toi ~ '^[0-9]+:[0-5][0-9]$'
            and incoming.total_pk_toi ~ '^[0-9]+:[0-5][0-9]$'
          ),
          false
        )
      ),
      false
    )
  into
    v_strength_payload_count,
    v_strength_distinct_count,
    v_strength_team_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_strength_rows) as incoming(
    game_id integer,
    game_type character varying(10),
    game_date date,
    player_id integer,
    player_first_name character varying(50),
    player_last_name character varying(50),
    team_id integer,
    team_abbreviation character varying(10),
    home_or_away character varying(10),
    opponent_team_id integer,
    opponent_team_abbreviation character varying(10),
    season_id integer,
    total_es_toi character varying,
    total_pp_toi character varying,
    total_pk_toi text
  );

  if v_strength_payload_count <> p_expected_strength_rows
    or v_strength_distinct_count <> p_expected_strength_rows
    or v_strength_team_count <> 2
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_PROJECTION_INPUT_STRENGTH_ROWS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:projection-game:' || p_game_id::text, 0)
  );

  if not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'play-by-play'
      and head.snapshot_version = p_pbp_raw_snapshot_version
      and head.raw_payload_id = p_pbp_raw_payload_id
      and head.payload_hash = p_pbp_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'play-by-play'
      and raw.payload_hash = p_pbp_raw_payload_hash
  ) or not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'shiftcharts'
      and head.snapshot_version = p_shift_raw_snapshot_version
      and head.raw_payload_id = p_shift_raw_payload_id
      and head.payload_hash = p_shift_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'shiftcharts'
      and raw.payload_hash = p_shift_raw_payload_hash
  ) then
    raise exception using message = 'PROJECTION_INPUT_RAW_SNAPSHOT_CAS_MISMATCH';
  end if;

  select status.*
  into v_current
  from public.projection_game_materialization_status as status
  where status.game_id = p_game_id
  for update;
  v_has_current := found;

  if not v_has_current then
    if p_expected_current_input_fingerprint is not null then
      raise exception using message = 'PROJECTION_INPUT_CAS_ABSENT';
    end if;
    v_input_version := 1;
  else
    if v_current.input_status <> 'complete'
      or v_current.input_fingerprint is null
      or v_current.input_version <= 0
    then
      raise exception using message = 'PROJECTION_INPUT_CURRENT_NOT_COMPLETE';
    end if;
    if p_expected_current_input_fingerprint is null
      or p_expected_current_input_fingerprint <> v_current.input_fingerprint
    then
      raise exception using message = 'PROJECTION_INPUT_CAS_MISMATCH';
    end if;
    if p_input_fingerprint = v_current.input_fingerprint then
      v_manifest_identity_matches := coalesce(
        v_current.input_status = 'complete'
        and v_current.pbp_source_hash is not distinct from p_pbp_source_hash
        and v_current.shift_source_hash is not distinct from p_shift_source_hash
        and v_current.pbp_raw_payload_id is not distinct from p_pbp_raw_payload_id
        and v_current.pbp_raw_snapshot_version is not distinct from p_pbp_raw_snapshot_version
        and v_current.pbp_raw_payload_hash is not distinct from p_pbp_raw_payload_hash
        and v_current.shift_raw_payload_id is not distinct from p_shift_raw_payload_id
        and v_current.shift_raw_snapshot_version is not distinct from p_shift_raw_snapshot_version
        and v_current.shift_raw_payload_hash is not distinct from p_shift_raw_payload_hash
        and v_current.parser_version is not distinct from p_parser_version
        and v_current.input_materializer_version is not distinct from p_materializer_version
        and v_current.expected_play_rows is not distinct from p_expected_play_rows
        and v_current.observed_play_rows is not distinct from p_expected_play_rows
        and v_current.expected_strength_rows is not distinct from p_expected_strength_rows
        and v_current.observed_strength_rows is not distinct from p_expected_strength_rows
        and v_current.input_completed_at is not null,
        false
      );
      if not v_manifest_identity_matches then
        raise exception using message = 'PROJECTION_INPUT_FINGERPRINT_COLLISION';
      end if;
      v_input_version := v_current.input_version;
    else
      if v_current.input_version = 9223372036854775807 then
        raise exception using message = 'PROJECTION_INPUT_VERSION_EXHAUSTED';
      end if;
      v_input_version := v_current.input_version + 1;
    end if;
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and game.date = v_game.date
      and game."homeTeamId" = v_game.hometeamid
      and game."awayTeamId" = v_game.awayteamid
  ) then
    raise exception using message = 'PROJECTION_INPUT_SCHEDULE_MISMATCH';
  end if;

  select pg_catalog.count(*)::integer
  into v_existing_play_count
  from public.pbp_plays as existing
  where existing.gameid = p_game_id::integer;

  select pg_catalog.count(*)::integer
  into v_existing_strength_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and (
      existing.total_es_toi is not null
      or existing.total_pp_toi is not null
      or existing.total_pk_toi is not null
    );

  select pg_catalog.count(*)::integer
  into v_existing_shift_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer;

  select pg_catalog.count(*)::integer
  into v_existing_player_derived_count
  from public.forge_player_game_strength as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_team_derived_count
  from public.forge_team_game_strength as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_goalie_derived_count
  from public.forge_goalie_game as existing
  where existing.game_id = p_game_id;

  if v_existing_play_count > 2000
    or v_existing_strength_count > 200
    or v_existing_shift_count > 200
    or v_existing_player_derived_count > 200
    or v_existing_team_derived_count > 4
    or v_existing_goalie_derived_count > 8
  then
    raise exception using message = 'UNBOUNDED_EXISTING_PROJECTION_INPUT_SCOPE';
  end if;

  if v_manifest_identity_matches then
    select exists (
      select 1
      from public.pbp_games as existing
      where existing.id = p_game_id::integer
        and row(
          existing.id,
          existing.date,
          existing.starttime,
          existing.type,
          existing.season,
          existing.hometeamid,
          existing.awayteamid,
          existing.hometeamname,
          existing.hometeamabbrev,
          existing.hometeamscore,
          existing.awayteamname,
          existing.awayteamabbrev,
          existing.awayteamscore,
          existing.location,
          existing.outcome
        ) is not distinct from row(
          v_game.id,
          v_game.date,
          v_game.starttime,
          v_game.type,
          v_game.season,
          v_game.hometeamid,
          v_game.awayteamid,
          v_game.hometeamname,
          v_game.hometeamabbrev,
          v_game.hometeamscore,
          v_game.awayteamname,
          v_game.awayteamabbrev,
          v_game.awayteamscore,
          v_game.location,
          v_game.outcome
        )
    )
    into v_game_content_matches;

    select
      v_existing_play_count = p_expected_play_rows
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_play_rows) as incoming(
          id integer,
          gameid integer,
          periodnumber integer,
          periodtype character varying(255),
          timeinperiod character varying(255),
          timeremaining character varying(255),
          situationcode character varying(255),
          typedesckey character varying(255),
          hometeamdefendingside character varying(255),
          sortorder integer,
          eventownerteamid integer,
          losingplayerid integer,
          winningplayerid integer,
          playerid integer,
          zonecode character varying(255),
          xcoord integer,
          ycoord integer,
          reason character varying(255),
          typecode integer,
          shootingplayerid integer,
          goalieinnetid integer,
          awaysog integer,
          homesog integer,
          blockingplayerid integer,
          hittingplayerid integer,
          hitteeplayerid integer,
          durationofpenalty character varying(255),
          committedbyplayerid integer,
          drawnbyplayerid integer,
          penalizedteam character varying(255),
          scoringplayerid integer,
          scoringplayertotal integer,
          shottype character varying(255),
          assist1playerid integer,
          assist1playertotal integer,
          assist2playerid integer,
          assist2playertotal integer,
          homescore integer,
          awayscore integer,
          game_date date
        )
        left join public.pbp_plays as existing
          on existing.gameid = p_game_id::integer
          and existing.id = incoming.id
        where existing.id is null
          or row(
            existing.id,
            existing.gameid,
            existing.periodnumber,
            existing.periodtype,
            existing.timeinperiod,
            existing.timeremaining,
            existing.situationcode,
            existing.typedesckey,
            existing.hometeamdefendingside,
            existing.sortorder,
            existing.eventownerteamid,
            existing.losingplayerid,
            existing.winningplayerid,
            existing.playerid,
            existing.zonecode,
            existing.xcoord,
            existing.ycoord,
            existing.reason,
            existing.typecode,
            existing.shootingplayerid,
            existing.goalieinnetid,
            existing.awaysog,
            existing.homesog,
            existing.blockingplayerid,
            existing.hittingplayerid,
            existing.hitteeplayerid,
            existing.durationofpenalty,
            existing.committedbyplayerid,
            existing.drawnbyplayerid,
            existing.penalizedteam,
            existing.scoringplayerid,
            existing.scoringplayertotal,
            existing.shottype,
            existing.assist1playerid,
            existing.assist1playertotal,
            existing.assist2playerid,
            existing.assist2playertotal,
            existing.homescore,
            existing.awayscore,
            existing.game_date
          ) is distinct from row(
            incoming.id,
            incoming.gameid,
            incoming.periodnumber,
            incoming.periodtype,
            incoming.timeinperiod,
            incoming.timeremaining,
            incoming.situationcode,
            incoming.typedesckey,
            incoming.hometeamdefendingside,
            incoming.sortorder,
            incoming.eventownerteamid,
            incoming.losingplayerid,
            incoming.winningplayerid,
            incoming.playerid,
            incoming.zonecode,
            incoming.xcoord,
            incoming.ycoord,
            incoming.reason,
            incoming.typecode,
            incoming.shootingplayerid,
            incoming.goalieinnetid,
            incoming.awaysog,
            incoming.homesog,
            incoming.blockingplayerid,
            incoming.hittingplayerid,
            incoming.hitteeplayerid,
            incoming.durationofpenalty,
            incoming.committedbyplayerid,
            incoming.drawnbyplayerid,
            incoming.penalizedteam,
            incoming.scoringplayerid,
            incoming.scoringplayertotal,
            incoming.shottype,
            incoming.assist1playerid,
            incoming.assist1playertotal,
            incoming.assist2playerid,
            incoming.assist2playertotal,
            incoming.homescore,
            incoming.awayscore,
            incoming.game_date
          )
      )
    into v_play_content_matches;

    select
      v_existing_strength_count = p_expected_strength_rows
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_strength_rows) as incoming(
          game_id integer,
          game_type character varying(10),
          game_date date,
          player_id integer,
          player_first_name character varying(50),
          player_last_name character varying(50),
          team_id integer,
          team_abbreviation character varying(10),
          home_or_away character varying(10),
          opponent_team_id integer,
          opponent_team_abbreviation character varying(10),
          season_id integer,
          total_es_toi character varying,
          total_pp_toi character varying,
          total_pk_toi text
        )
        left join public.shift_charts as existing
          on existing.game_id = p_game_id::integer
          and existing.player_id = incoming.player_id
        where existing.player_id is null
          or row(
            existing.game_id,
            existing.game_type,
            existing.game_date,
            existing.player_id,
            existing.player_first_name,
            existing.player_last_name,
            existing.team_id,
            existing.team_abbreviation,
            existing.home_or_away,
            existing.opponent_team_id,
            existing.opponent_team_abbreviation,
            existing.season_id,
            existing.total_es_toi,
            existing.total_pp_toi,
            existing.total_pk_toi
          ) is distinct from row(
            incoming.game_id,
            incoming.game_type,
            incoming.game_date,
            incoming.player_id,
            incoming.player_first_name,
            incoming.player_last_name,
            incoming.team_id,
            incoming.team_abbreviation,
            incoming.home_or_away,
            incoming.opponent_team_id,
            incoming.opponent_team_abbreviation,
            incoming.season_id,
            incoming.total_es_toi,
            incoming.total_pp_toi,
            incoming.total_pk_toi
          )
      )
    into v_strength_content_matches;

    v_idempotent := v_game_content_matches
      and v_play_content_matches
      and v_strength_content_matches;

    if v_idempotent then
      v_observed_play_count := v_existing_play_count;
      v_observed_strength_count := v_existing_strength_count;
      v_completed_at := v_current.input_completed_at;

      return query
      select
        p_game_id,
        'complete'::text,
        p_input_fingerprint,
        v_current.input_version,
        p_pbp_raw_payload_id,
        p_pbp_raw_snapshot_version,
        p_pbp_raw_payload_hash,
        p_shift_raw_payload_id,
        p_shift_raw_snapshot_version,
        p_shift_raw_payload_hash,
        p_expected_play_rows,
        v_observed_play_count,
        p_expected_strength_rows,
        v_observed_strength_count,
        0::integer,
        0::integer,
        true,
        v_completed_at;
      return;
    end if;

    if v_current.input_version = 9223372036854775807 then
      raise exception using message = 'PROJECTION_INPUT_VERSION_EXHAUSTED';
    end if;
    v_input_version := v_current.input_version + 1;
  end if;

  select pg_catalog.count(*)::integer
  into v_pruned_play_count
  from public.pbp_plays as existing
  where existing.gameid = p_game_id::integer
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_play_rows) as incoming(id integer)
      where incoming.id = existing.id
    );

  select pg_catalog.count(*)::integer
  into v_pruned_strength_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and (
      existing.total_es_toi is not null
      or existing.total_pp_toi is not null
      or existing.total_pk_toi is not null
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_strength_rows)
        as incoming(player_id integer)
      where incoming.player_id = existing.player_id
    );

  insert into public.pbp_games (
    id,
    date,
    starttime,
    type,
    season,
    hometeamid,
    awayteamid,
    hometeamname,
    hometeamabbrev,
    hometeamscore,
    awayteamname,
    awayteamabbrev,
    awayteamscore,
    location,
    outcome,
    created_at
  ) values (
    v_game.id,
    v_game.date,
    v_game.starttime,
    v_game.type,
    v_game.season,
    v_game.hometeamid,
    v_game.awayteamid,
    v_game.hometeamname,
    v_game.hometeamabbrev,
    v_game.hometeamscore,
    v_game.awayteamname,
    v_game.awayteamabbrev,
    v_game.awayteamscore,
    v_game.location,
    v_game.outcome,
    v_completed_at
  )
  on conflict on constraint pbp_games_pkey
  do update set
    date = excluded.date,
    starttime = excluded.starttime,
    type = excluded.type,
    season = excluded.season,
    hometeamid = excluded.hometeamid,
    awayteamid = excluded.awayteamid,
    hometeamname = excluded.hometeamname,
    hometeamabbrev = excluded.hometeamabbrev,
    hometeamscore = excluded.hometeamscore,
    awayteamname = excluded.awayteamname,
    awayteamabbrev = excluded.awayteamabbrev,
    awayteamscore = excluded.awayteamscore,
    location = excluded.location,
    outcome = excluded.outcome;

  delete from public.pbp_plays as existing
  where existing.gameid = p_game_id::integer;

  insert into public.pbp_plays (
    id,
    gameid,
    periodnumber,
    periodtype,
    timeinperiod,
    timeremaining,
    situationcode,
    typedesckey,
    hometeamdefendingside,
    sortorder,
    eventownerteamid,
    losingplayerid,
    winningplayerid,
    playerid,
    zonecode,
    xcoord,
    ycoord,
    reason,
    typecode,
    shootingplayerid,
    goalieinnetid,
    awaysog,
    homesog,
    blockingplayerid,
    hittingplayerid,
    hitteeplayerid,
    durationofpenalty,
    committedbyplayerid,
    drawnbyplayerid,
    penalizedteam,
    scoringplayerid,
    scoringplayertotal,
    shottype,
    assist1playerid,
    assist1playertotal,
    assist2playerid,
    assist2playertotal,
    homescore,
    awayscore,
    game_date,
    updated_at
  )
  select
    incoming.id,
    incoming.gameid,
    incoming.periodnumber,
    incoming.periodtype,
    incoming.timeinperiod,
    incoming.timeremaining,
    incoming.situationcode,
    incoming.typedesckey,
    incoming.hometeamdefendingside,
    incoming.sortorder,
    incoming.eventownerteamid,
    incoming.losingplayerid,
    incoming.winningplayerid,
    incoming.playerid,
    incoming.zonecode,
    incoming.xcoord,
    incoming.ycoord,
    incoming.reason,
    incoming.typecode,
    incoming.shootingplayerid,
    incoming.goalieinnetid,
    incoming.awaysog,
    incoming.homesog,
    incoming.blockingplayerid,
    incoming.hittingplayerid,
    incoming.hitteeplayerid,
    incoming.durationofpenalty,
    incoming.committedbyplayerid,
    incoming.drawnbyplayerid,
    incoming.penalizedteam,
    incoming.scoringplayerid,
    incoming.scoringplayertotal,
    incoming.shottype,
    incoming.assist1playerid,
    incoming.assist1playertotal,
    incoming.assist2playerid,
    incoming.assist2playertotal,
    incoming.homescore,
    incoming.awayscore,
    incoming.game_date,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_play_rows) as incoming(
    id integer,
    gameid integer,
    periodnumber integer,
    periodtype character varying(255),
    timeinperiod character varying(255),
    timeremaining character varying(255),
    situationcode character varying(255),
    typedesckey character varying(255),
    hometeamdefendingside character varying(255),
    sortorder integer,
    eventownerteamid integer,
    losingplayerid integer,
    winningplayerid integer,
    playerid integer,
    zonecode character varying(255),
    xcoord integer,
    ycoord integer,
    reason character varying(255),
    typecode integer,
    shootingplayerid integer,
    goalieinnetid integer,
    awaysog integer,
    homesog integer,
    blockingplayerid integer,
    hittingplayerid integer,
    hitteeplayerid integer,
    durationofpenalty character varying(255),
    committedbyplayerid integer,
    drawnbyplayerid integer,
    penalizedteam character varying(255),
    scoringplayerid integer,
    scoringplayertotal integer,
    shottype character varying(255),
    assist1playerid integer,
    assist1playertotal integer,
    assist2playerid integer,
    assist2playertotal integer,
    homescore integer,
    awayscore integer,
    game_date date
  );

  update public.shift_charts as existing
  set
    total_es_toi = null,
    total_pp_toi = null,
    total_pk_toi = null,
    updated_at = v_completed_at
  where existing.game_id = p_game_id::integer;

  insert into public.shift_charts (
    game_id,
    game_type,
    game_date,
    player_id,
    player_first_name,
    player_last_name,
    team_id,
    team_abbreviation,
    home_or_away,
    opponent_team_id,
    opponent_team_abbreviation,
    season_id,
    total_es_toi,
    total_pp_toi,
    total_pk_toi,
    updated_at
  )
  select
    incoming.game_id,
    incoming.game_type,
    incoming.game_date,
    incoming.player_id,
    incoming.player_first_name,
    incoming.player_last_name,
    incoming.team_id,
    incoming.team_abbreviation,
    incoming.home_or_away,
    incoming.opponent_team_id,
    incoming.opponent_team_abbreviation,
    incoming.season_id,
    incoming.total_es_toi,
    incoming.total_pp_toi,
    incoming.total_pk_toi,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_strength_rows) as incoming(
    game_id integer,
    game_type character varying(10),
    game_date date,
    player_id integer,
    player_first_name character varying(50),
    player_last_name character varying(50),
    team_id integer,
    team_abbreviation character varying(10),
    home_or_away character varying(10),
    opponent_team_id integer,
    opponent_team_abbreviation character varying(10),
    season_id integer,
    total_es_toi character varying,
    total_pp_toi character varying,
    total_pk_toi text
  )
  on conflict on constraint unique_shift
  do update set
    game_type = excluded.game_type,
    game_date = excluded.game_date,
    player_first_name = excluded.player_first_name,
    player_last_name = excluded.player_last_name,
    team_id = excluded.team_id,
    team_abbreviation = excluded.team_abbreviation,
    home_or_away = excluded.home_or_away,
    opponent_team_id = excluded.opponent_team_id,
    opponent_team_abbreviation = excluded.opponent_team_abbreviation,
    season_id = excluded.season_id,
    total_es_toi = excluded.total_es_toi,
    total_pp_toi = excluded.total_pp_toi,
    total_pk_toi = excluded.total_pk_toi,
    updated_at = excluded.updated_at;

  if not v_idempotent then
    delete from public.forge_team_game_strength as existing
    where existing.game_id = p_game_id;
    delete from public.forge_player_game_strength as existing
    where existing.game_id = p_game_id;
    delete from public.forge_goalie_game as existing
    where existing.game_id = p_game_id;

    update public.shift_charts as existing
    set
      shift_numbers = null,
      periods = null,
      start_times = null,
      end_times = null,
      durations = null,
      game_toi = null,
      display_position = null,
      primary_position = null,
      time_spent_with = null,
      percent_toi_with = null,
      time_spent_with_mixed = null,
      percent_toi_with_mixed = null,
      game_length = null,
      line_combination = null,
      pairing_combination = null,
      player_type = null,
      shifts = null,
      pp_shifts = null,
      es_shifts = null,
      updated_at = v_completed_at
    where existing.game_id = p_game_id::integer;

    -- Once a changed input invalidates relationship ownership, remove rows
    -- that belong to neither producer so strict readers cannot mistake them
    -- for partial strength evidence.
    delete from public.shift_charts as existing
    where existing.game_id = p_game_id::integer
      and existing.total_es_toi is null
      and existing.total_pp_toi is null
      and existing.total_pk_toi is null
      and existing.shift_numbers is null
      and existing.periods is null
      and existing.start_times is null
      and existing.end_times is null
      and existing.durations is null
      and existing.game_toi is null
      and existing.display_position is null
      and existing.primary_position is null
      and existing.time_spent_with is null
      and existing.percent_toi_with is null
      and existing.time_spent_with_mixed is null
      and existing.percent_toi_with_mixed is null
      and existing.game_length is null
      and existing.line_combination is null
      and existing.pairing_combination is null
      and existing.player_type is null
      and existing.shifts is null
      and existing.pp_shifts is null
      and existing.es_shifts is null;
  end if;

  select pg_catalog.count(*)::integer
  into v_observed_play_count
  from public.pbp_plays as stored
  where stored.gameid = p_game_id::integer;

  select pg_catalog.count(*)::integer
  into v_observed_strength_count
  from public.shift_charts as stored
  where stored.game_id = p_game_id::integer
    and stored.total_es_toi is not null
    and stored.total_pp_toi is not null
    and stored.total_pk_toi is not null;

  if v_observed_play_count <> p_expected_play_rows
    or v_observed_strength_count <> p_expected_strength_rows
  then
    raise exception using message = 'PROJECTION_INPUT_CARDINALITY_MISMATCH';
  end if;

  if v_has_current then
    update public.projection_game_materialization_status as status
    set
      input_status = 'complete',
      input_fingerprint = p_input_fingerprint,
      input_version = v_input_version,
      pbp_source_hash = p_pbp_source_hash,
      shift_source_hash = p_shift_source_hash,
      pbp_raw_payload_id = p_pbp_raw_payload_id,
      pbp_raw_snapshot_version = p_pbp_raw_snapshot_version,
      pbp_raw_payload_hash = p_pbp_raw_payload_hash,
      shift_raw_payload_id = p_shift_raw_payload_id,
      shift_raw_snapshot_version = p_shift_raw_snapshot_version,
      shift_raw_payload_hash = p_shift_raw_payload_hash,
      parser_version = p_parser_version,
      input_materializer_version = p_materializer_version,
      expected_play_rows = p_expected_play_rows,
      observed_play_rows = v_observed_play_count,
      expected_strength_rows = p_expected_strength_rows,
      observed_strength_rows = v_observed_strength_count,
      input_completed_at = v_completed_at,
      relationship_status = case
        when v_idempotent then status.relationship_status
        else 'pending'
      end,
      relationship_input_fingerprint = case
        when v_idempotent then status.relationship_input_fingerprint
        else null
      end,
      relationship_fingerprint = case
        when v_idempotent then status.relationship_fingerprint
        else null
      end,
      relationship_algorithm_version = case
        when v_idempotent then status.relationship_algorithm_version
        else null
      end,
      expected_relationship_rows = case
        when v_idempotent then status.expected_relationship_rows
        else null
      end,
      observed_relationship_rows = case
        when v_idempotent then status.observed_relationship_rows
        else null
      end,
      relationship_completed_at = case
        when v_idempotent then status.relationship_completed_at
        else null
      end,
      derived_status = case
        when v_idempotent then status.derived_status
        else 'pending'
      end,
      derived_input_fingerprint = case
        when v_idempotent then status.derived_input_fingerprint
        else null
      end,
      derived_fingerprint = case
        when v_idempotent then status.derived_fingerprint
        else null
      end,
      derived_algorithm_version = case
        when v_idempotent then status.derived_algorithm_version
        else null
      end,
      goalie_outcome = case
        when v_idempotent then status.goalie_outcome
        else null
      end,
      goalie_justification = case
        when v_idempotent then status.goalie_justification
        else null
      end,
      expected_player_rows = case
        when v_idempotent then status.expected_player_rows
        else null
      end,
      observed_player_rows = case
        when v_idempotent then status.observed_player_rows
        else null
      end,
      expected_team_rows = case
        when v_idempotent then status.expected_team_rows
        else null
      end,
      observed_team_rows = case
        when v_idempotent then status.observed_team_rows
        else null
      end,
      expected_goalie_rows = case
        when v_idempotent then status.expected_goalie_rows
        else null
      end,
      observed_goalie_rows = case
        when v_idempotent then status.observed_goalie_rows
        else null
      end,
      derived_completed_at = case
        when v_idempotent then status.derived_completed_at
        else null
      end,
      updated_at = v_completed_at
    where status.game_id = p_game_id;
  else
    insert into public.projection_game_materialization_status (
      game_id,
      input_status,
      input_fingerprint,
      input_version,
      pbp_source_hash,
      shift_source_hash,
      pbp_raw_payload_id,
      pbp_raw_snapshot_version,
      pbp_raw_payload_hash,
      shift_raw_payload_id,
      shift_raw_snapshot_version,
      shift_raw_payload_hash,
      parser_version,
      input_materializer_version,
      expected_play_rows,
      observed_play_rows,
      expected_strength_rows,
      observed_strength_rows,
      input_completed_at,
      updated_at
    ) values (
      p_game_id,
      'complete',
      p_input_fingerprint,
      v_input_version,
      p_pbp_source_hash,
      p_shift_source_hash,
      p_pbp_raw_payload_id,
      p_pbp_raw_snapshot_version,
      p_pbp_raw_payload_hash,
      p_shift_raw_payload_id,
      p_shift_raw_snapshot_version,
      p_shift_raw_payload_hash,
      p_parser_version,
      p_materializer_version,
      p_expected_play_rows,
      v_observed_play_count,
      p_expected_strength_rows,
      v_observed_strength_count,
      v_completed_at,
      v_completed_at
    );
  end if;

  return query
  select
    p_game_id,
    'complete'::text,
    p_input_fingerprint,
    v_input_version,
    p_pbp_raw_payload_id,
    p_pbp_raw_snapshot_version,
    p_pbp_raw_payload_hash,
    p_shift_raw_payload_id,
    p_shift_raw_snapshot_version,
    p_shift_raw_payload_hash,
    p_expected_play_rows,
    v_observed_play_count,
    p_expected_strength_rows,
    v_observed_strength_count,
    v_pruned_play_count,
    v_pruned_strength_count,
    v_idempotent,
    v_completed_at;
end;
$$;

revoke all on function public.persist_projection_game_inputs_v1(
  bigint, text, text, text, text, bigint, bigint, text, bigint, bigint, text,
  text, text, jsonb, jsonb, jsonb, integer, integer
) from public, anon, authenticated;
grant execute on function public.persist_projection_game_inputs_v1(
  bigint, text, text, text, text, bigint, bigint, text, bigint, bigint, text,
  text, text, jsonb, jsonb, jsonb, integer, integer
) to service_role;

create or replace function public.persist_shift_chart_relationships_v1(
  p_game_id bigint,
  p_expected_input_fingerprint text,
  p_expected_input_version bigint,
  p_relationship_fingerprint text,
  p_algorithm_version text,
  p_rows jsonb,
  p_expected_rows integer
)
returns table (
  game_id bigint,
  input_fingerprint text,
  input_version bigint,
  relationship_status text,
  relationship_fingerprint text,
  relationship_version bigint,
  algorithm_version text,
  expected_rows integer,
  observed_rows integer,
  pruned_rows integer,
  idempotent boolean,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '60s'
as $$
declare
  v_current public.projection_game_materialization_status%rowtype;
  v_relationship_version bigint;
  v_identity_matches boolean := false;
  v_idempotent boolean := false;
  v_rows_match boolean := false;
  v_payload_count integer;
  v_distinct_player_count integer;
  v_distinct_team_count integer;
  v_rows_are_valid boolean;
  v_existing_count integer;
  v_existing_relationship_count integer;
  v_unowned_count integer;
  v_observed_count integer;
  v_pruned_count integer := 0;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null
    or p_game_id <= 0
    or p_game_id > 2147483647
  then
    raise exception using message = 'INVALID_SHIFT_RELATIONSHIP_GAME_ID';
  end if;

  if p_expected_input_fingerprint is null
    or p_expected_input_fingerprint !~ '^[0-9a-f]{64}$'
    or p_expected_input_version is null
    or p_expected_input_version <= 0
    or p_relationship_fingerprint is null
    or p_relationship_fingerprint !~ '^[0-9a-f]{64}$'
    or p_algorithm_version is null
    or pg_catalog.btrim(p_algorithm_version) = ''
    or pg_catalog.char_length(p_algorithm_version) > 128
    or p_algorithm_version !~ '^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$'
  then
    raise exception using message = 'INVALID_SHIFT_RELATIONSHIP_IDENTITY';
  end if;

  if pg_catalog.jsonb_typeof(p_rows) is distinct from 'array'
    or p_expected_rows is null
    or p_expected_rows not between 1 and 100
    or pg_catalog.jsonb_array_length(p_rows) <> p_expected_rows
  then
    raise exception using message = 'INVALID_SHIFT_RELATIONSHIP_PAYLOAD_SHAPE';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.player_id)::integer,
    pg_catalog.count(distinct incoming.team_id)::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.game_id = p_game_id::integer
            and incoming.game_date is not null
            and incoming.player_id > 0
            and incoming.team_id > 0
            and incoming.opponent_team_id > 0
            and incoming.team_id <> incoming.opponent_team_id
            and incoming.home_or_away in ('home', 'away')
            and (
              incoming.player_type is null
              or incoming.player_type in ('G', 'F', 'D')
            )
            and incoming.shift_numbers is not null
            and pg_catalog.cardinality(incoming.shift_numbers) between 1 and 200
            and pg_catalog.cardinality(incoming.periods)
              = pg_catalog.cardinality(incoming.shift_numbers)
            and pg_catalog.cardinality(incoming.start_times)
              = pg_catalog.cardinality(incoming.shift_numbers)
            and pg_catalog.cardinality(incoming.end_times)
              = pg_catalog.cardinality(incoming.shift_numbers)
            and pg_catalog.cardinality(incoming.durations)
              = pg_catalog.cardinality(incoming.shift_numbers)
            and pg_catalog.jsonb_typeof(incoming.shifts) = 'array'
            and pg_catalog.jsonb_array_length(incoming.shifts)
              = pg_catalog.cardinality(incoming.shift_numbers)
            and pg_catalog.jsonb_typeof(incoming.pp_shifts) = 'array'
            and pg_catalog.jsonb_typeof(incoming.es_shifts) = 'array'
            and pg_catalog.jsonb_typeof(incoming.time_spent_with) = 'object'
            and pg_catalog.jsonb_typeof(incoming.percent_toi_with) = 'object'
            and pg_catalog.jsonb_typeof(incoming.time_spent_with_mixed) = 'object'
            and pg_catalog.jsonb_typeof(incoming.percent_toi_with_mixed) = 'object'
            and incoming.game_toi ~ '^[0-9]+:[0-5][0-9]$'
            and incoming.game_length ~ '^[0-9]+:[0-5][0-9]$'
          ),
          false
        )
      ),
      false
    )
  into
    v_payload_count,
    v_distinct_player_count,
    v_distinct_team_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_rows) as incoming(
    game_id integer,
    game_type character varying(10),
    game_date date,
    season_id integer,
    player_id integer,
    player_first_name character varying(50),
    player_last_name character varying(50),
    team_id integer,
    team_abbreviation character varying(10),
    home_or_away character varying(10),
    opponent_team_id integer,
    opponent_team_abbreviation character varying(10),
    shift_numbers integer[],
    periods integer[],
    start_times character varying[],
    end_times character varying[],
    durations character varying[],
    pp_shifts jsonb,
    es_shifts jsonb,
    game_toi character varying(10),
    game_length character varying(10),
    shifts jsonb,
    time_spent_with jsonb,
    percent_toi_with jsonb,
    time_spent_with_mixed jsonb,
    percent_toi_with_mixed jsonb,
    display_position character varying(10),
    primary_position character varying(10),
    player_type character(1),
    line_combination integer,
    pairing_combination integer
  );

  if v_payload_count <> p_expected_rows
    or v_distinct_player_count <> p_expected_rows
    or v_distinct_team_count <> 2
    or not v_rows_are_valid
    or exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_rows)
        as incoming(shifts jsonb)
      cross join lateral pg_catalog.jsonb_array_elements(incoming.shifts)
        as shift_row(value)
      where pg_catalog.jsonb_typeof(shift_row.value) <> 'object'
    )
  then
    raise exception using message = 'INVALID_SHIFT_RELATIONSHIP_ROWS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:projection-game:' || p_game_id::text, 0)
  );

  select status.*
  into v_current
  from public.projection_game_materialization_status as status
  where status.game_id = p_game_id
  for update;

  if not found
    or v_current.input_status <> 'complete'
    or v_current.input_fingerprint is null
    or v_current.input_version <= 0
  then
    raise exception using message = 'SHIFT_RELATIONSHIP_INPUT_NOT_COMPLETE';
  end if;

  if v_current.input_fingerprint <> p_expected_input_fingerprint
    or v_current.input_version <> p_expected_input_version
  then
    raise exception using message = 'SHIFT_RELATIONSHIP_INPUT_CAS_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'play-by-play'
      and head.snapshot_version = v_current.pbp_raw_snapshot_version
      and head.raw_payload_id = v_current.pbp_raw_payload_id
      and head.payload_hash = v_current.pbp_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'play-by-play'
      and raw.payload_hash = v_current.pbp_raw_payload_hash
  ) or not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'shiftcharts'
      and head.snapshot_version = v_current.shift_raw_snapshot_version
      and head.raw_payload_id = v_current.shift_raw_payload_id
      and head.payload_hash = v_current.shift_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'shiftcharts'
      and raw.payload_hash = v_current.shift_raw_payload_hash
  ) then
    raise exception using message = 'SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE';
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and not exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_rows) as incoming(
          game_date date,
          team_id integer,
          opponent_team_id integer
        )
        where incoming.game_date <> game.date
          or incoming.team_id not in (game."homeTeamId", game."awayTeamId")
          or incoming.opponent_team_id not in (
            game."homeTeamId",
            game."awayTeamId"
          )
          or incoming.team_id = incoming.opponent_team_id
      )
  ) then
    raise exception using message = 'SHIFT_RELATIONSHIP_SCHEDULE_MISMATCH';
  end if;

  select pg_catalog.count(*)::integer
  into v_existing_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer;

  if v_existing_count > 200 then
    raise exception using message = 'UNBOUNDED_EXISTING_SHIFT_RELATIONSHIP_SCOPE';
  end if;

  select pg_catalog.count(*)::integer
  into v_existing_relationship_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and (
      existing.shift_numbers is not null
      or existing.periods is not null
      or existing.start_times is not null
      or existing.end_times is not null
      or existing.durations is not null
      or existing.game_toi is not null
      or existing.display_position is not null
      or existing.primary_position is not null
      or existing.time_spent_with is not null
      or existing.percent_toi_with is not null
      or existing.time_spent_with_mixed is not null
      or existing.percent_toi_with_mixed is not null
      or existing.game_length is not null
      or existing.line_combination is not null
      or existing.pairing_combination is not null
      or existing.player_type is not null
      or existing.shifts is not null
      or existing.pp_shifts is not null
      or existing.es_shifts is not null
    );

  select pg_catalog.count(*)::integer
  into v_unowned_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and existing.total_es_toi is null
    and existing.total_pp_toi is null
    and existing.total_pk_toi is null
    and existing.shift_numbers is null
    and existing.periods is null
    and existing.start_times is null
    and existing.end_times is null
    and existing.durations is null
    and existing.game_toi is null
    and existing.display_position is null
    and existing.primary_position is null
    and existing.time_spent_with is null
    and existing.percent_toi_with is null
    and existing.time_spent_with_mixed is null
    and existing.percent_toi_with_mixed is null
    and existing.game_length is null
    and existing.line_combination is null
    and existing.pairing_combination is null
    and existing.player_type is null
    and existing.shifts is null
    and existing.pp_shifts is null
    and existing.es_shifts is null;

  select not exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_rows) as incoming(
      game_id integer,
      game_type character varying(10),
      game_date date,
      season_id integer,
      player_id integer,
      player_first_name character varying(50),
      player_last_name character varying(50),
      team_id integer,
      team_abbreviation character varying(10),
      home_or_away character varying(10),
      opponent_team_id integer,
      opponent_team_abbreviation character varying(10),
      shift_numbers integer[],
      periods integer[],
      start_times character varying[],
      end_times character varying[],
      durations character varying[],
      pp_shifts jsonb,
      es_shifts jsonb,
      game_toi character varying(10),
      game_length character varying(10),
      shifts jsonb,
      time_spent_with jsonb,
      percent_toi_with jsonb,
      time_spent_with_mixed jsonb,
      percent_toi_with_mixed jsonb,
      display_position character varying(10),
      primary_position character varying(10),
      player_type character(1),
      line_combination integer,
      pairing_combination integer
    )
    left join public.shift_charts as stored
      on stored.game_id = p_game_id::integer
      and stored.player_id = incoming.player_id
    where stored.player_id is null
      or stored.game_id is distinct from incoming.game_id
      or stored.game_type is distinct from incoming.game_type
      or stored.game_date is distinct from incoming.game_date
      or stored.season_id is distinct from incoming.season_id
      or stored.player_first_name is distinct from incoming.player_first_name
      or stored.player_last_name is distinct from incoming.player_last_name
      or stored.team_id is distinct from incoming.team_id
      or stored.team_abbreviation is distinct from incoming.team_abbreviation
      or stored.home_or_away is distinct from incoming.home_or_away
      or stored.opponent_team_id is distinct from incoming.opponent_team_id
      or stored.opponent_team_abbreviation is distinct from incoming.opponent_team_abbreviation
      or stored.shift_numbers is distinct from incoming.shift_numbers
      or stored.periods is distinct from incoming.periods
      or stored.start_times is distinct from incoming.start_times
      or stored.end_times is distinct from incoming.end_times
      or stored.durations is distinct from incoming.durations
      or stored.pp_shifts is distinct from incoming.pp_shifts
      or stored.es_shifts is distinct from incoming.es_shifts
      or stored.game_toi is distinct from incoming.game_toi
      or stored.game_length is distinct from incoming.game_length
      or stored.shifts is distinct from incoming.shifts
      or stored.time_spent_with is distinct from incoming.time_spent_with
      or stored.percent_toi_with is distinct from incoming.percent_toi_with
      or stored.time_spent_with_mixed is distinct from incoming.time_spent_with_mixed
      or stored.percent_toi_with_mixed is distinct from incoming.percent_toi_with_mixed
      or stored.display_position is distinct from incoming.display_position
      or stored.primary_position is distinct from incoming.primary_position
      or stored.player_type is distinct from incoming.player_type
      or stored.line_combination is distinct from incoming.line_combination
      or stored.pairing_combination is distinct from incoming.pairing_combination
  ) into v_rows_match;

  v_identity_matches :=
    v_current.relationship_status = 'complete'
    and v_current.relationship_input_fingerprint = v_current.input_fingerprint
    and v_current.relationship_fingerprint = p_relationship_fingerprint
    and v_current.relationship_algorithm_version = p_algorithm_version
    and v_current.expected_relationship_rows = p_expected_rows
    and v_current.observed_relationship_rows = p_expected_rows
    and v_current.relationship_completed_at is not null;

  v_idempotent :=
    v_identity_matches
    and v_existing_relationship_count = p_expected_rows
    and v_unowned_count = 0
    and v_rows_match;

  if v_current.relationship_fingerprint = p_relationship_fingerprint
    and not v_identity_matches
  then
    raise exception using message = 'SHIFT_RELATIONSHIP_FINGERPRINT_COLLISION';
  end if;

  if v_idempotent then
    v_relationship_version := v_current.relationship_version;
    v_observed_count := v_existing_relationship_count;
    v_completed_at := v_current.relationship_completed_at;

    return query
    select
      p_game_id,
      p_expected_input_fingerprint,
      p_expected_input_version,
      'complete'::text,
      p_relationship_fingerprint,
      v_relationship_version,
      p_algorithm_version,
      p_expected_rows,
      v_observed_count,
      0::integer,
      true,
      v_completed_at;
    return;
  end if;

  if v_current.relationship_version = 9223372036854775807 then
    raise exception using message = 'SHIFT_RELATIONSHIP_VERSION_EXHAUSTED';
  end if;
  v_relationship_version := v_current.relationship_version + 1;

  select pg_catalog.count(*)::integer
  into v_pruned_count
  from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and (
      existing.shift_numbers is not null
      or existing.periods is not null
      or existing.start_times is not null
      or existing.end_times is not null
      or existing.durations is not null
      or existing.game_toi is not null
      or existing.display_position is not null
      or existing.primary_position is not null
      or existing.time_spent_with is not null
      or existing.percent_toi_with is not null
      or existing.time_spent_with_mixed is not null
      or existing.percent_toi_with_mixed is not null
      or existing.game_length is not null
      or existing.line_combination is not null
      or existing.pairing_combination is not null
      or existing.player_type is not null
      or existing.shifts is not null
      or existing.pp_shifts is not null
      or existing.es_shifts is not null
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_rows)
        as incoming(player_id integer)
      where incoming.player_id = existing.player_id
    );

  -- Clear only relationship-owned columns. Strength totals and their exact
  -- producer scope remain untouched even for a withdrawn relationship row.
  update public.shift_charts as existing
  set
    shift_numbers = null,
    periods = null,
    start_times = null,
    end_times = null,
    durations = null,
    game_toi = null,
    display_position = null,
    primary_position = null,
    time_spent_with = null,
    percent_toi_with = null,
    time_spent_with_mixed = null,
    percent_toi_with_mixed = null,
    game_length = null,
    line_combination = null,
    pairing_combination = null,
    player_type = null,
    shifts = null,
    pp_shifts = null,
    es_shifts = null,
    updated_at = v_completed_at
  where existing.game_id = p_game_id::integer;

  insert into public.shift_charts (
    game_id,
    game_type,
    game_date,
    season_id,
    player_id,
    player_first_name,
    player_last_name,
    team_id,
    team_abbreviation,
    home_or_away,
    opponent_team_id,
    opponent_team_abbreviation,
    shift_numbers,
    periods,
    start_times,
    end_times,
    durations,
    pp_shifts,
    es_shifts,
    game_toi,
    game_length,
    shifts,
    time_spent_with,
    percent_toi_with,
    time_spent_with_mixed,
    percent_toi_with_mixed,
    display_position,
    primary_position,
    player_type,
    line_combination,
    pairing_combination,
    updated_at
  )
  select
    incoming.game_id,
    incoming.game_type,
    incoming.game_date,
    incoming.season_id,
    incoming.player_id,
    incoming.player_first_name,
    incoming.player_last_name,
    incoming.team_id,
    incoming.team_abbreviation,
    incoming.home_or_away,
    incoming.opponent_team_id,
    incoming.opponent_team_abbreviation,
    incoming.shift_numbers,
    incoming.periods,
    incoming.start_times,
    incoming.end_times,
    incoming.durations,
    incoming.pp_shifts,
    incoming.es_shifts,
    incoming.game_toi,
    incoming.game_length,
    incoming.shifts,
    incoming.time_spent_with,
    incoming.percent_toi_with,
    incoming.time_spent_with_mixed,
    incoming.percent_toi_with_mixed,
    incoming.display_position,
    incoming.primary_position,
    incoming.player_type,
    incoming.line_combination,
    incoming.pairing_combination,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_rows) as incoming(
    game_id integer,
    game_type character varying(10),
    game_date date,
    season_id integer,
    player_id integer,
    player_first_name character varying(50),
    player_last_name character varying(50),
    team_id integer,
    team_abbreviation character varying(10),
    home_or_away character varying(10),
    opponent_team_id integer,
    opponent_team_abbreviation character varying(10),
    shift_numbers integer[],
    periods integer[],
    start_times character varying[],
    end_times character varying[],
    durations character varying[],
    pp_shifts jsonb,
    es_shifts jsonb,
    game_toi character varying(10),
    game_length character varying(10),
    shifts jsonb,
    time_spent_with jsonb,
    percent_toi_with jsonb,
    time_spent_with_mixed jsonb,
    percent_toi_with_mixed jsonb,
    display_position character varying(10),
    primary_position character varying(10),
    player_type character(1),
    line_combination integer,
    pairing_combination integer
  )
  on conflict on constraint unique_shift
  do update set
    game_type = excluded.game_type,
    game_date = excluded.game_date,
    season_id = excluded.season_id,
    player_first_name = excluded.player_first_name,
    player_last_name = excluded.player_last_name,
    team_id = excluded.team_id,
    team_abbreviation = excluded.team_abbreviation,
    home_or_away = excluded.home_or_away,
    opponent_team_id = excluded.opponent_team_id,
    opponent_team_abbreviation = excluded.opponent_team_abbreviation,
    shift_numbers = excluded.shift_numbers,
    periods = excluded.periods,
    start_times = excluded.start_times,
    end_times = excluded.end_times,
    durations = excluded.durations,
    pp_shifts = excluded.pp_shifts,
    es_shifts = excluded.es_shifts,
    game_toi = excluded.game_toi,
    game_length = excluded.game_length,
    shifts = excluded.shifts,
    time_spent_with = excluded.time_spent_with,
    percent_toi_with = excluded.percent_toi_with,
    time_spent_with_mixed = excluded.time_spent_with_mixed,
    percent_toi_with_mixed = excluded.percent_toi_with_mixed,
    display_position = excluded.display_position,
    primary_position = excluded.primary_position,
    player_type = excluded.player_type,
    line_combination = excluded.line_combination,
    pairing_combination = excluded.pairing_combination,
    updated_at = excluded.updated_at;

  -- A player withdrawn from both producers must not survive as an
  -- identity-only row that strict readers can mistake for incomplete source
  -- data. Preserve every row still owned by either producer.
  delete from public.shift_charts as existing
  where existing.game_id = p_game_id::integer
    and existing.total_es_toi is null
    and existing.total_pp_toi is null
    and existing.total_pk_toi is null
    and existing.shift_numbers is null
    and existing.periods is null
    and existing.start_times is null
    and existing.end_times is null
    and existing.durations is null
    and existing.game_toi is null
    and existing.display_position is null
    and existing.primary_position is null
    and existing.time_spent_with is null
    and existing.percent_toi_with is null
    and existing.time_spent_with_mixed is null
    and existing.percent_toi_with_mixed is null
    and existing.game_length is null
    and existing.line_combination is null
    and existing.pairing_combination is null
    and existing.player_type is null
    and existing.shifts is null
    and existing.pp_shifts is null
    and existing.es_shifts is null;

  select pg_catalog.count(*)::integer
  into v_observed_count
  from public.shift_charts as stored
  where stored.game_id = p_game_id::integer
    and stored.shifts is not null
    and pg_catalog.jsonb_typeof(stored.shifts) = 'array'
    and stored.game_toi is not null;

  if v_observed_count <> p_expected_rows then
    raise exception using message = 'SHIFT_RELATIONSHIP_CARDINALITY_MISMATCH';
  end if;

  update public.projection_game_materialization_status as status
  set
    relationship_status = 'complete',
    relationship_input_fingerprint = status.input_fingerprint,
    relationship_fingerprint = p_relationship_fingerprint,
    relationship_version = v_relationship_version,
    relationship_algorithm_version = p_algorithm_version,
    expected_relationship_rows = p_expected_rows,
    observed_relationship_rows = v_observed_count,
    relationship_completed_at = v_completed_at,
    updated_at = v_completed_at
  where status.game_id = p_game_id
    and status.input_status = 'complete'
    and status.input_fingerprint = p_expected_input_fingerprint
    and status.input_version = p_expected_input_version;

  if not found then
    raise exception using message = 'SHIFT_RELATIONSHIP_INPUT_CHANGED';
  end if;

  return query
  select
    p_game_id,
    p_expected_input_fingerprint,
    v_current.input_version,
    'complete'::text,
    p_relationship_fingerprint,
    v_relationship_version,
    p_algorithm_version,
    p_expected_rows,
    v_observed_count,
    v_pruned_count,
    v_idempotent,
    v_completed_at;
end;
$$;

revoke all on function public.persist_shift_chart_relationships_v1(
  bigint, text, bigint, text, text, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.persist_shift_chart_relationships_v1(
  bigint, text, bigint, text, text, jsonb, integer
) to service_role;

create or replace function public.persist_projection_game_derived_v1(
  p_game_id bigint,
  p_expected_input_fingerprint text,
  p_expected_input_version bigint,
  p_derived_fingerprint text,
  p_algorithm_version text,
  p_player_rows jsonb,
  p_team_rows jsonb,
  p_goalie_rows jsonb,
  p_expected_player_rows integer,
  p_expected_team_rows integer,
  p_expected_goalie_rows integer,
  p_goalie_outcome text,
  p_goalie_justification text
)
returns table (
  game_id bigint,
  input_fingerprint text,
  input_version bigint,
  derived_status text,
  derived_fingerprint text,
  derived_version bigint,
  algorithm_version text,
  goalie_outcome text,
  goalie_justification text,
  expected_player_rows integer,
  observed_player_rows integer,
  expected_team_rows integer,
  observed_team_rows integer,
  expected_goalie_rows integer,
  observed_goalie_rows integer,
  pruned_player_rows integer,
  pruned_team_rows integer,
  pruned_goalie_rows integer,
  idempotent boolean,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '60s'
as $$
declare
  v_current public.projection_game_materialization_status%rowtype;
  v_derived_version bigint;
  v_identity_matches boolean := false;
  v_idempotent boolean := false;
  v_player_rows_match boolean := false;
  v_team_rows_match boolean := false;
  v_goalie_rows_match boolean := false;
  v_player_payload_count integer;
  v_player_distinct_count integer;
  v_player_team_count integer;
  v_team_payload_count integer;
  v_team_distinct_count integer;
  v_goalie_payload_count integer;
  v_goalie_distinct_count integer;
  v_rows_are_valid boolean;
  v_existing_player_count integer;
  v_existing_team_count integer;
  v_existing_goalie_count integer;
  v_observed_player_count integer;
  v_observed_team_count integer;
  v_observed_goalie_count integer;
  v_pruned_player_count integer := 0;
  v_pruned_team_count integer := 0;
  v_pruned_goalie_count integer := 0;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null
    or p_game_id <= 0
    or p_game_id > 2147483647
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_GAME_ID';
  end if;

  if p_expected_input_fingerprint is null
    or p_expected_input_fingerprint !~ '^[0-9a-f]{64}$'
    or p_expected_input_version is null
    or p_expected_input_version <= 0
    or p_derived_fingerprint is null
    or p_derived_fingerprint !~ '^[0-9a-f]{64}$'
    or p_algorithm_version is null
    or pg_catalog.btrim(p_algorithm_version) = ''
    or pg_catalog.char_length(p_algorithm_version) > 128
    or p_algorithm_version !~ '^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$'
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_IDENTITY';
  end if;

  if pg_catalog.jsonb_typeof(p_player_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_team_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_goalie_rows) is distinct from 'array'
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_PAYLOAD_SHAPE';
  end if;

  if p_expected_player_rows is null
    or p_expected_player_rows not between 1 and 100
    or pg_catalog.jsonb_array_length(p_player_rows) <> p_expected_player_rows
    or p_expected_team_rows is distinct from 2
    or pg_catalog.jsonb_array_length(p_team_rows) <> 2
    or p_expected_goalie_rows is null
    or pg_catalog.jsonb_array_length(p_goalie_rows) <> p_expected_goalie_rows
    or (
      p_goalie_outcome = 'complete'
      and (
        p_goalie_justification is not null
        or p_expected_goalie_rows not between 1 and 4
      )
    )
    or (
      p_goalie_outcome = 'not_observed'
      and (
        p_expected_goalie_rows <> 0
        or p_goalie_justification is null
        or p_goalie_justification not in (
          'completed_pbp_contains_no_countable_shot_events',
          'completed_pbp_countable_events_are_all_empty_net'
        )
      )
    )
    or p_goalie_outcome is null
    or p_goalie_outcome not in ('complete', 'not_observed')
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_EXPECTED_COUNTS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.player_id)::integer,
    pg_catalog.count(distinct incoming.team_id)::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.game_id = p_game_id
            and incoming.player_id > 0
            and incoming.team_id > 0
            and incoming.opponent_team_id > 0
            and incoming.team_id <> incoming.opponent_team_id
            and incoming.game_date is not null
            and incoming.toi_es_seconds >= 0
            and incoming.toi_pp_seconds >= 0
            and incoming.toi_pk_seconds >= 0
            and incoming.shots_es >= 0
            and incoming.shots_pp >= 0
            and incoming.shots_pk >= 0
            and incoming.goals_es >= 0
            and incoming.goals_pp >= 0
            and incoming.goals_pk >= 0
            and incoming.assists_es >= 0
            and incoming.assists_pp >= 0
            and incoming.assists_pk >= 0
            and (incoming.hits is null or incoming.hits >= 0)
            and (incoming.blocks is null or incoming.blocks >= 0)
            and (incoming.pim is null or incoming.pim >= 0)
          ),
          false
        )
      ),
      false
    )
  into
    v_player_payload_count,
    v_player_distinct_count,
    v_player_team_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_player_rows) as incoming(
    game_id bigint,
    player_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    toi_es_seconds integer,
    toi_pp_seconds integer,
    toi_pk_seconds integer,
    shots_es integer,
    shots_pp integer,
    shots_pk integer,
    goals_es integer,
    goals_pp integer,
    goals_pk integer,
    assists_es integer,
    assists_pp integer,
    assists_pk integer,
    hits integer,
    blocks integer,
    pim integer,
    plus_minus integer
  );

  if v_player_payload_count <> p_expected_player_rows
    or v_player_distinct_count <> p_expected_player_rows
    or v_player_team_count <> 2
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_PLAYER_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.team_id)::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.game_id = p_game_id
            and incoming.team_id > 0
            and incoming.opponent_team_id > 0
            and incoming.team_id <> incoming.opponent_team_id
            and incoming.game_date is not null
            and incoming.toi_es_seconds >= 0
            and incoming.toi_pp_seconds >= 0
            and incoming.toi_pk_seconds >= 0
            and incoming.shots_es >= 0
            and incoming.shots_pp >= 0
            and incoming.shots_pk >= 0
            and incoming.goals_es >= 0
            and incoming.goals_pp >= 0
            and incoming.goals_pk >= 0
          ),
          false
        )
      ),
      false
    )
  into
    v_team_payload_count,
    v_team_distinct_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
    game_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    toi_es_seconds integer,
    toi_pp_seconds integer,
    toi_pk_seconds integer,
    shots_es integer,
    shots_pp integer,
    shots_pk integer,
    goals_es integer,
    goals_pp integer,
    goals_pk integer
  );

  if v_team_payload_count <> 2
    or v_team_distinct_count <> 2
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_TEAM_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.goalie_id)::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming.game_id = p_game_id
            and incoming.goalie_id > 0
            and incoming.team_id > 0
            and incoming.opponent_team_id > 0
            and incoming.team_id <> incoming.opponent_team_id
            and incoming.game_date is not null
            and incoming.shots_against >= 0
            and incoming.goals_allowed >= 0
            and incoming.goals_allowed <= incoming.shots_against
            and incoming.saves = incoming.shots_against - incoming.goals_allowed
            and (incoming.toi_seconds is null or incoming.toi_seconds >= 0)
          ),
          false
        )
      ),
      p_expected_goalie_rows = 0
    )
  into
    v_goalie_payload_count,
    v_goalie_distinct_count,
    v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
    game_id bigint,
    goalie_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    shots_against integer,
    goals_allowed integer,
    saves integer,
    toi_seconds integer
  );

  if v_goalie_payload_count <> p_expected_goalie_rows
    or v_goalie_distinct_count <> p_expected_goalie_rows
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_PROJECTION_DERIVED_GOALIE_ROWS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:projection-game:' || p_game_id::text, 0)
  );

  select status.*
  into v_current
  from public.projection_game_materialization_status as status
  where status.game_id = p_game_id
  for update;

  if not found
    or v_current.input_status <> 'complete'
    or v_current.input_fingerprint is null
    or v_current.input_version <= 0
  then
    raise exception using message = 'PROJECTION_DERIVED_INPUT_NOT_COMPLETE';
  end if;

  if v_current.input_fingerprint <> p_expected_input_fingerprint
    or v_current.input_version <> p_expected_input_version
  then
    raise exception using message = 'PROJECTION_DERIVED_INPUT_CAS_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'play-by-play'
      and head.snapshot_version = v_current.pbp_raw_snapshot_version
      and head.raw_payload_id = v_current.pbp_raw_payload_id
      and head.payload_hash = v_current.pbp_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'play-by-play'
      and raw.payload_hash = v_current.pbp_raw_payload_hash
  ) or not exists (
    select 1
    from public.nhl_api_game_payload_snapshot_heads as head
    join public.nhl_api_game_payloads_raw as raw
      on raw.id = head.raw_payload_id
    where head.game_id = p_game_id
      and head.endpoint = 'shiftcharts'
      and head.snapshot_version = v_current.shift_raw_snapshot_version
      and head.raw_payload_id = v_current.shift_raw_payload_id
      and head.payload_hash = v_current.shift_raw_payload_hash
      and raw.game_id = p_game_id
      and raw.endpoint = 'shiftcharts'
      and raw.payload_hash = v_current.shift_raw_payload_hash
  ) then
    raise exception using message = 'PROJECTION_DERIVED_RAW_SNAPSHOT_STALE';
  end if;

  if v_current.relationship_status <> 'complete'
    or v_current.relationship_input_fingerprint is distinct from v_current.input_fingerprint
    or v_current.relationship_version <= 0
    or v_current.relationship_algorithm_version is null
    or pg_catalog.btrim(v_current.relationship_algorithm_version) = ''
    or v_current.expected_relationship_rows is null
    or v_current.expected_relationship_rows not between 1 and 100
    or v_current.observed_relationship_rows is distinct from v_current.expected_relationship_rows
  then
    raise exception using message = 'PROJECTION_DERIVED_RELATIONSHIP_NOT_COMPLETE';
  end if;

  if p_goalie_outcome = 'not_observed'
    and p_goalie_justification = 'completed_pbp_contains_no_countable_shot_events'
    and exists (
      select 1
      from public.pbp_plays as play
      where play.gameid = p_game_id::integer
        and play.typedesckey in ('shot-on-goal', 'goal')
    )
  then
    raise exception using message = 'PROJECTION_DERIVED_GOALIE_JUSTIFICATION_MISMATCH';
  end if;

  if p_goalie_outcome = 'not_observed'
    and p_goalie_justification = 'completed_pbp_countable_events_are_all_empty_net'
    and (
      not exists (
        select 1
        from public.pbp_plays as play
        where play.gameid = p_game_id::integer
          and play.typedesckey in ('shot-on-goal', 'goal')
      )
      or exists (
        select 1
        from public.pbp_plays as play
        where play.gameid = p_game_id::integer
          and play.typedesckey in ('shot-on-goal', 'goal')
          and play.goalieinnetid is not null
      )
    )
  then
    raise exception using message = 'PROJECTION_DERIVED_GOALIE_JUSTIFICATION_MISMATCH';
  end if;

  if p_goalie_outcome = 'complete'
    and (
      not exists (
        select 1
        from public.pbp_plays as play
        where play.gameid = p_game_id::integer
          and play.typedesckey in ('shot-on-goal', 'goal')
          and play.goalieinnetid is not null
      )
      or exists (
        select 1
        from pg_catalog.jsonb_to_recordset(p_goalie_rows)
          as incoming(goalie_id bigint)
        where not exists (
          select 1
          from public.pbp_plays as play
          where play.gameid = p_game_id::integer
            and play.typedesckey in ('shot-on-goal', 'goal')
            and play.goalieinnetid = incoming.goalie_id
        )
      )
      or exists (
        select 1
        from (
          select distinct play.goalieinnetid as goalie_id
          from public.pbp_plays as play
          where play.gameid = p_game_id::integer
            and play.typedesckey in ('shot-on-goal', 'goal')
            and play.goalieinnetid is not null
        ) as observed
        where not exists (
          select 1
          from pg_catalog.jsonb_to_recordset(p_goalie_rows)
            as incoming(goalie_id bigint)
          where incoming.goalie_id = observed.goalie_id
        )
      )
    )
  then
    raise exception using message = 'PROJECTION_DERIVED_GOALIE_EVIDENCE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and not exists (
        select 1
        from (
          select incoming.game_date, incoming.team_id, incoming.opponent_team_id
          from pg_catalog.jsonb_to_recordset(p_player_rows) as incoming(
            game_date date,
            team_id smallint,
            opponent_team_id smallint
          )
          union all
          select incoming.game_date, incoming.team_id, incoming.opponent_team_id
          from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
            game_date date,
            team_id smallint,
            opponent_team_id smallint
          )
          union all
          select incoming.game_date, incoming.team_id, incoming.opponent_team_id
          from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
            game_date date,
            team_id smallint,
            opponent_team_id smallint
          )
        ) as incoming
        where incoming.game_date <> game.date
          or incoming.team_id not in (game."homeTeamId", game."awayTeamId")
          or incoming.opponent_team_id not in (
            game."homeTeamId",
            game."awayTeamId"
          )
          or incoming.team_id = incoming.opponent_team_id
      )
  ) then
    raise exception using message = 'PROJECTION_DERIVED_SCHEDULE_MISMATCH';
  end if;

  select pg_catalog.count(*)::integer
  into v_existing_player_count
  from public.forge_player_game_strength as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_team_count
  from public.forge_team_game_strength as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_goalie_count
  from public.forge_goalie_game as existing
  where existing.game_id = p_game_id;

  if v_existing_player_count > 200
    or v_existing_team_count > 4
    or v_existing_goalie_count > 8
  then
    raise exception using message = 'UNBOUNDED_EXISTING_PROJECTION_DERIVED_SCOPE';
  end if;

  select not exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_player_rows) as incoming(
      game_id bigint,
      player_id bigint,
      team_id smallint,
      opponent_team_id smallint,
      game_date date,
      toi_es_seconds integer,
      toi_pp_seconds integer,
      toi_pk_seconds integer,
      shots_es integer,
      shots_pp integer,
      shots_pk integer,
      goals_es integer,
      goals_pp integer,
      goals_pk integer,
      assists_es integer,
      assists_pp integer,
      assists_pk integer,
      hits integer,
      blocks integer,
      pim integer,
      plus_minus integer
    )
    left join public.forge_player_game_strength as stored
      on stored.game_id = p_game_id
      and stored.player_id = incoming.player_id
    where stored.player_id is null
      or stored.game_id is distinct from incoming.game_id
      or stored.team_id is distinct from incoming.team_id
      or stored.opponent_team_id is distinct from incoming.opponent_team_id
      or stored.game_date is distinct from incoming.game_date
      or stored.toi_es_seconds is distinct from incoming.toi_es_seconds
      or stored.toi_pp_seconds is distinct from incoming.toi_pp_seconds
      or stored.toi_pk_seconds is distinct from incoming.toi_pk_seconds
      or stored.shots_es is distinct from incoming.shots_es
      or stored.shots_pp is distinct from incoming.shots_pp
      or stored.shots_pk is distinct from incoming.shots_pk
      or stored.goals_es is distinct from incoming.goals_es
      or stored.goals_pp is distinct from incoming.goals_pp
      or stored.goals_pk is distinct from incoming.goals_pk
      or stored.assists_es is distinct from incoming.assists_es
      or stored.assists_pp is distinct from incoming.assists_pp
      or stored.assists_pk is distinct from incoming.assists_pk
      or stored.hits is distinct from incoming.hits
      or stored.blocks is distinct from incoming.blocks
      or stored.pim is distinct from incoming.pim
      or stored.plus_minus is distinct from incoming.plus_minus
  ) into v_player_rows_match;

  select not exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
      game_id bigint,
      team_id smallint,
      opponent_team_id smallint,
      game_date date,
      toi_es_seconds integer,
      toi_pp_seconds integer,
      toi_pk_seconds integer,
      shots_es integer,
      shots_pp integer,
      shots_pk integer,
      goals_es integer,
      goals_pp integer,
      goals_pk integer
    )
    left join public.forge_team_game_strength as stored
      on stored.game_id = p_game_id
      and stored.team_id = incoming.team_id
    where stored.team_id is null
      or stored.game_id is distinct from incoming.game_id
      or stored.opponent_team_id is distinct from incoming.opponent_team_id
      or stored.game_date is distinct from incoming.game_date
      or stored.toi_es_seconds is distinct from incoming.toi_es_seconds
      or stored.toi_pp_seconds is distinct from incoming.toi_pp_seconds
      or stored.toi_pk_seconds is distinct from incoming.toi_pk_seconds
      or stored.shots_es is distinct from incoming.shots_es
      or stored.shots_pp is distinct from incoming.shots_pp
      or stored.shots_pk is distinct from incoming.shots_pk
      or stored.goals_es is distinct from incoming.goals_es
      or stored.goals_pp is distinct from incoming.goals_pp
      or stored.goals_pk is distinct from incoming.goals_pk
  ) into v_team_rows_match;

  select not exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
      game_id bigint,
      goalie_id bigint,
      team_id smallint,
      opponent_team_id smallint,
      game_date date,
      shots_against integer,
      goals_allowed integer,
      saves integer,
      toi_seconds integer
    )
    left join public.forge_goalie_game as stored
      on stored.game_id = p_game_id
      and stored.goalie_id = incoming.goalie_id
    where stored.goalie_id is null
      or stored.game_id is distinct from incoming.game_id
      or stored.team_id is distinct from incoming.team_id
      or stored.opponent_team_id is distinct from incoming.opponent_team_id
      or stored.game_date is distinct from incoming.game_date
      or stored.shots_against is distinct from incoming.shots_against
      or stored.goals_allowed is distinct from incoming.goals_allowed
      or stored.saves is distinct from incoming.saves
      or stored.toi_seconds is distinct from incoming.toi_seconds
  ) into v_goalie_rows_match;

  v_identity_matches :=
    v_current.derived_status = 'complete'
    and v_current.derived_input_fingerprint = v_current.input_fingerprint
    and v_current.derived_fingerprint = p_derived_fingerprint
    and v_current.derived_algorithm_version = p_algorithm_version
    and v_current.goalie_outcome = p_goalie_outcome
    and v_current.goalie_justification is not distinct from p_goalie_justification
    and v_current.expected_player_rows = p_expected_player_rows
    and v_current.observed_player_rows = p_expected_player_rows
    and v_current.expected_team_rows = p_expected_team_rows
    and v_current.observed_team_rows = p_expected_team_rows
    and v_current.expected_goalie_rows = p_expected_goalie_rows
    and v_current.observed_goalie_rows = p_expected_goalie_rows
    and v_current.derived_completed_at is not null;

  v_idempotent :=
    v_identity_matches
    and v_existing_player_count = p_expected_player_rows
    and v_existing_team_count = p_expected_team_rows
    and v_existing_goalie_count = p_expected_goalie_rows
    and v_player_rows_match
    and v_team_rows_match
    and v_goalie_rows_match;

  if v_current.derived_fingerprint = p_derived_fingerprint
    and not v_identity_matches
  then
    raise exception using message = 'PROJECTION_DERIVED_FINGERPRINT_COLLISION';
  end if;

  if v_idempotent then
    v_derived_version := v_current.derived_version;
    v_observed_player_count := v_existing_player_count;
    v_observed_team_count := v_existing_team_count;
    v_observed_goalie_count := v_existing_goalie_count;
    v_completed_at := v_current.derived_completed_at;

    return query
    select
      p_game_id,
      p_expected_input_fingerprint,
      v_current.input_version,
      'complete'::text,
      p_derived_fingerprint,
      v_derived_version,
      p_algorithm_version,
      p_goalie_outcome,
      p_goalie_justification,
      p_expected_player_rows,
      v_observed_player_count,
      p_expected_team_rows,
      v_observed_team_count,
      p_expected_goalie_rows,
      v_observed_goalie_count,
      0::integer,
      0::integer,
      0::integer,
      true,
      v_completed_at;
    return;
  end if;

  if v_current.derived_version = 9223372036854775807 then
    raise exception using message = 'PROJECTION_DERIVED_VERSION_EXHAUSTED';
  end if;
  v_derived_version := v_current.derived_version + 1;

  select pg_catalog.count(*)::integer
  into v_pruned_player_count
  from public.forge_player_game_strength as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_player_rows)
        as incoming(player_id bigint)
      where incoming.player_id = existing.player_id
    );

  select pg_catalog.count(*)::integer
  into v_pruned_team_count
  from public.forge_team_game_strength as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_team_rows)
        as incoming(team_id smallint)
      where incoming.team_id = existing.team_id
    );

  select pg_catalog.count(*)::integer
  into v_pruned_goalie_count
  from public.forge_goalie_game as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_goalie_rows)
        as incoming(goalie_id bigint)
      where incoming.goalie_id = existing.goalie_id
    );

  insert into public.forge_player_game_strength (
    game_id,
    player_id,
    team_id,
    opponent_team_id,
    game_date,
    toi_es_seconds,
    toi_pp_seconds,
    toi_pk_seconds,
    shots_es,
    shots_pp,
    shots_pk,
    goals_es,
    goals_pp,
    goals_pk,
    assists_es,
    assists_pp,
    assists_pk,
    hits,
    blocks,
    pim,
    plus_minus,
    updated_at
  )
  select
    incoming.game_id,
    incoming.player_id,
    incoming.team_id,
    incoming.opponent_team_id,
    incoming.game_date,
    incoming.toi_es_seconds,
    incoming.toi_pp_seconds,
    incoming.toi_pk_seconds,
    incoming.shots_es,
    incoming.shots_pp,
    incoming.shots_pk,
    incoming.goals_es,
    incoming.goals_pp,
    incoming.goals_pk,
    incoming.assists_es,
    incoming.assists_pp,
    incoming.assists_pk,
    incoming.hits,
    incoming.blocks,
    incoming.pim,
    incoming.plus_minus,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_player_rows) as incoming(
    game_id bigint,
    player_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    toi_es_seconds integer,
    toi_pp_seconds integer,
    toi_pk_seconds integer,
    shots_es integer,
    shots_pp integer,
    shots_pk integer,
    goals_es integer,
    goals_pp integer,
    goals_pk integer,
    assists_es integer,
    assists_pp integer,
    assists_pk integer,
    hits integer,
    blocks integer,
    pim integer,
    plus_minus integer
  )
  on conflict on constraint player_game_strength_v2_pkey
  do update set
    team_id = excluded.team_id,
    opponent_team_id = excluded.opponent_team_id,
    game_date = excluded.game_date,
    toi_es_seconds = excluded.toi_es_seconds,
    toi_pp_seconds = excluded.toi_pp_seconds,
    toi_pk_seconds = excluded.toi_pk_seconds,
    shots_es = excluded.shots_es,
    shots_pp = excluded.shots_pp,
    shots_pk = excluded.shots_pk,
    goals_es = excluded.goals_es,
    goals_pp = excluded.goals_pp,
    goals_pk = excluded.goals_pk,
    assists_es = excluded.assists_es,
    assists_pp = excluded.assists_pp,
    assists_pk = excluded.assists_pk,
    hits = excluded.hits,
    blocks = excluded.blocks,
    pim = excluded.pim,
    plus_minus = excluded.plus_minus,
    updated_at = excluded.updated_at;

  delete from public.forge_player_game_strength as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_player_rows)
        as incoming(player_id bigint)
      where incoming.player_id = existing.player_id
    );

  insert into public.forge_team_game_strength (
    game_id,
    team_id,
    opponent_team_id,
    game_date,
    toi_es_seconds,
    toi_pp_seconds,
    toi_pk_seconds,
    shots_es,
    shots_pp,
    shots_pk,
    goals_es,
    goals_pp,
    goals_pk,
    updated_at
  )
  select
    incoming.game_id,
    incoming.team_id,
    incoming.opponent_team_id,
    incoming.game_date,
    incoming.toi_es_seconds,
    incoming.toi_pp_seconds,
    incoming.toi_pk_seconds,
    incoming.shots_es,
    incoming.shots_pp,
    incoming.shots_pk,
    incoming.goals_es,
    incoming.goals_pp,
    incoming.goals_pk,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
    game_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    toi_es_seconds integer,
    toi_pp_seconds integer,
    toi_pk_seconds integer,
    shots_es integer,
    shots_pp integer,
    shots_pk integer,
    goals_es integer,
    goals_pp integer,
    goals_pk integer
  )
  on conflict on constraint team_game_strength_v2_pkey
  do update set
    opponent_team_id = excluded.opponent_team_id,
    game_date = excluded.game_date,
    toi_es_seconds = excluded.toi_es_seconds,
    toi_pp_seconds = excluded.toi_pp_seconds,
    toi_pk_seconds = excluded.toi_pk_seconds,
    shots_es = excluded.shots_es,
    shots_pp = excluded.shots_pp,
    shots_pk = excluded.shots_pk,
    goals_es = excluded.goals_es,
    goals_pp = excluded.goals_pp,
    goals_pk = excluded.goals_pk,
    updated_at = excluded.updated_at;

  delete from public.forge_team_game_strength as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_team_rows)
        as incoming(team_id smallint)
      where incoming.team_id = existing.team_id
    );

  insert into public.forge_goalie_game (
    game_id,
    goalie_id,
    team_id,
    opponent_team_id,
    game_date,
    shots_against,
    goals_allowed,
    saves,
    toi_seconds,
    updated_at
  )
  select
    incoming.game_id,
    incoming.goalie_id,
    incoming.team_id,
    incoming.opponent_team_id,
    incoming.game_date,
    incoming.shots_against,
    incoming.goals_allowed,
    incoming.saves,
    incoming.toi_seconds,
    v_completed_at
  from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
    game_id bigint,
    goalie_id bigint,
    team_id smallint,
    opponent_team_id smallint,
    game_date date,
    shots_against integer,
    goals_allowed integer,
    saves integer,
    toi_seconds integer
  )
  on conflict on constraint goalie_game_v2_pkey
  do update set
    team_id = excluded.team_id,
    opponent_team_id = excluded.opponent_team_id,
    game_date = excluded.game_date,
    shots_against = excluded.shots_against,
    goals_allowed = excluded.goals_allowed,
    saves = excluded.saves,
    toi_seconds = excluded.toi_seconds,
    updated_at = excluded.updated_at;

  delete from public.forge_goalie_game as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_goalie_rows)
        as incoming(goalie_id bigint)
      where incoming.goalie_id = existing.goalie_id
    );

  select pg_catalog.count(*)::integer
  into v_observed_player_count
  from public.forge_player_game_strength as stored
  where stored.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_team_count
  from public.forge_team_game_strength as stored
  where stored.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_goalie_count
  from public.forge_goalie_game as stored
  where stored.game_id = p_game_id;

  if v_observed_player_count <> p_expected_player_rows
    or v_observed_team_count <> 2
    or v_observed_goalie_count <> p_expected_goalie_rows
  then
    raise exception using message = 'PROJECTION_DERIVED_CARDINALITY_MISMATCH';
  end if;

  update public.projection_game_materialization_status as status
  set
    derived_status = 'complete',
    derived_input_fingerprint = status.input_fingerprint,
    derived_fingerprint = p_derived_fingerprint,
    derived_version = v_derived_version,
    derived_algorithm_version = p_algorithm_version,
    goalie_outcome = p_goalie_outcome,
    goalie_justification = p_goalie_justification,
    expected_player_rows = p_expected_player_rows,
    observed_player_rows = v_observed_player_count,
    expected_team_rows = p_expected_team_rows,
    observed_team_rows = v_observed_team_count,
    expected_goalie_rows = p_expected_goalie_rows,
    observed_goalie_rows = v_observed_goalie_count,
    derived_completed_at = v_completed_at,
    updated_at = v_completed_at
  where status.game_id = p_game_id
    and status.input_status = 'complete'
    and status.input_fingerprint = p_expected_input_fingerprint
    and status.input_version = p_expected_input_version;

  if not found then
    raise exception using message = 'PROJECTION_DERIVED_INPUT_CHANGED';
  end if;

  return query
  select
    p_game_id,
    p_expected_input_fingerprint,
    v_current.input_version,
    'complete'::text,
    p_derived_fingerprint,
    v_derived_version,
    p_algorithm_version,
    p_goalie_outcome,
    p_goalie_justification,
    p_expected_player_rows,
    v_observed_player_count,
    p_expected_team_rows,
    v_observed_team_count,
    p_expected_goalie_rows,
    v_observed_goalie_count,
    v_pruned_player_count,
    v_pruned_team_count,
    v_pruned_goalie_count,
    v_idempotent,
    v_completed_at;
end;
$$;

revoke all on function public.persist_projection_game_derived_v1(
  bigint, text, bigint, text, text, jsonb, jsonb, jsonb,
  integer, integer, integer, text, text
) from public, anon, authenticated;
grant execute on function public.persist_projection_game_derived_v1(
  bigint, text, bigint, text, text, jsonb, jsonb, jsonb,
  integer, integer, integer, text, text
) to service_role;

create or replace function public.advance_projection_pipeline_state_v1(
  p_pipeline_key text,
  p_scope_key text,
  p_operation_key text,
  p_transition text,
  p_expected_revision bigint,
  p_next_status text,
  p_next_cursor_game_id bigint,
  p_next_cursor_date date,
  p_range_start_date date,
  p_range_end_date date,
  p_lease_owner text,
  p_lease_expires_at timestamp with time zone,
  p_last_error text
)
returns table (
  pipeline_key text,
  scope_key text,
  operation_key text,
  revision bigint,
  status text,
  cursor_game_id bigint,
  cursor_date date,
  range_start_date date,
  range_end_date date,
  lease_owner text,
  lease_expires_at timestamp with time zone,
  last_error text,
  updated_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '30s'
as $$
declare
  v_current public.projection_pipeline_state%rowtype;
  v_has_current boolean := false;
  v_next_revision bigint;
  v_stored_lease_owner text;
  v_stored_lease_expires_at timestamp with time zone;
  v_stored_last_error text;
  v_now timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_pipeline_key is null
    or p_pipeline_key !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    or p_scope_key is null
    or p_scope_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:@/+-]{0,127}$'
    or p_operation_key is null
    or p_operation_key !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    or p_transition is null
    or p_transition not in ('acquire', 'advance', 'complete', 'fail')
    or p_expected_revision is null
    or p_expected_revision < 0
    or p_next_status is null
    or p_next_status not in ('running', 'complete', 'failed')
    or p_next_cursor_game_id is not null and p_next_cursor_game_id <= 0
    or (
      (p_range_start_date is null) <> (p_range_end_date is null)
    )
    or (
      p_range_start_date is not null
      and (
        p_range_start_date > p_range_end_date
        or p_range_end_date - p_range_start_date > 366
      )
    )
    or p_lease_owner is null
    or pg_catalog.btrim(p_lease_owner) = ''
    or pg_catalog.char_length(p_lease_owner) > 128
  then
    raise exception using message = 'INVALID_PROJECTION_PIPELINE_TRANSITION';
  end if;

  if p_transition in ('acquire', 'advance') then
    if p_next_status <> 'running'
      or p_lease_expires_at is null
      or p_lease_expires_at <= v_now
      or p_lease_expires_at > v_now + interval '15 minutes'
      or p_last_error is not null
    then
      raise exception using message = 'INVALID_PROJECTION_PIPELINE_RUNNING_STATE';
    end if;
    v_stored_lease_owner := p_lease_owner;
    v_stored_lease_expires_at := p_lease_expires_at;
    v_stored_last_error := null;
  elsif p_transition = 'complete' then
    if p_next_status <> 'complete'
      or p_lease_expires_at is not null
      or p_last_error is not null
    then
      raise exception using message = 'INVALID_PROJECTION_PIPELINE_COMPLETE_STATE';
    end if;
    v_stored_lease_owner := null;
    v_stored_lease_expires_at := null;
    v_stored_last_error := null;
  else
    if p_next_status <> 'failed'
      or p_lease_expires_at is not null
      or p_last_error is null
      or pg_catalog.btrim(p_last_error) = ''
      or pg_catalog.char_length(p_last_error) > 1000
    then
      raise exception using message = 'INVALID_PROJECTION_PIPELINE_FAILED_STATE';
    end if;
    v_stored_lease_owner := null;
    v_stored_lease_expires_at := null;
    v_stored_last_error := p_last_error;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'fhfh:projection-pipeline:'
        || p_pipeline_key
        || ':'
        || p_scope_key
        || ':'
        || p_operation_key,
      0
    )
  );

  select pipeline.*
  into v_current
  from public.projection_pipeline_state as pipeline
  where pipeline.pipeline_key = p_pipeline_key
    and pipeline.scope_key = p_scope_key
    and pipeline.operation_key = p_operation_key
  for update;
  v_has_current := found;

  if not v_has_current then
    if p_transition <> 'acquire' or p_expected_revision <> 0 then
      raise exception using message = 'PROJECTION_PIPELINE_STATE_ABSENT';
    end if;
    v_next_revision := 1;

    insert into public.projection_pipeline_state (
      pipeline_key,
      scope_key,
      operation_key,
      revision,
      status,
      cursor_game_id,
      cursor_date,
      range_start_date,
      range_end_date,
      lease_owner,
      lease_expires_at,
      last_error,
      updated_at
    ) values (
      p_pipeline_key,
      p_scope_key,
      p_operation_key,
      v_next_revision,
      p_next_status,
      p_next_cursor_game_id,
      p_next_cursor_date,
      p_range_start_date,
      p_range_end_date,
      v_stored_lease_owner,
      v_stored_lease_expires_at,
      v_stored_last_error,
      v_now
    );
  else
    if v_current.revision <> p_expected_revision then
      raise exception using message = 'PROJECTION_PIPELINE_REVISION_MISMATCH';
    end if;

    -- Completion is terminal for an operation identity. The TypeScript client
    -- normally short-circuits before this RPC, but the database boundary must
    -- also make a direct service-role replay a physical no-op. Preserve the
    -- exact stored receipt, including revision, cursor, and timestamps.
    if p_transition = 'acquire'
      and v_current.status = 'complete'
    then
      if v_current.range_start_date is distinct from p_range_start_date
        or v_current.range_end_date is distinct from p_range_end_date
      then
        raise exception using message = 'PROJECTION_PIPELINE_RANGE_CHANGED';
      end if;

      return query
      select
        v_current.pipeline_key,
        v_current.scope_key,
        v_current.operation_key,
        v_current.revision,
        v_current.status,
        v_current.cursor_game_id,
        v_current.cursor_date,
        v_current.range_start_date,
        v_current.range_end_date,
        v_current.lease_owner,
        v_current.lease_expires_at,
        v_current.last_error,
        v_current.updated_at;
      return;
    end if;

    if v_current.revision = 9223372036854775807 then
      raise exception using message = 'PROJECTION_PIPELINE_REVISION_EXHAUSTED';
    end if;

    if p_transition = 'acquire' then
      if v_current.status = 'running'
        and v_current.lease_expires_at > v_now
        and v_current.lease_owner <> p_lease_owner
      then
        raise exception using message = 'PROJECTION_PIPELINE_LEASE_HELD';
      end if;
    else
      if v_current.status <> 'running'
        or v_current.lease_owner <> p_lease_owner
      then
        raise exception using message = 'PROJECTION_PIPELINE_LEASE_MISMATCH';
      end if;
      if p_transition in ('advance', 'complete')
        and v_current.lease_expires_at <= v_now
      then
        raise exception using message = 'PROJECTION_PIPELINE_LEASE_EXPIRED';
      end if;
    end if;

    if v_current.range_start_date is distinct from p_range_start_date
      or v_current.range_end_date is distinct from p_range_end_date
    then
      raise exception using message = 'PROJECTION_PIPELINE_RANGE_CHANGED';
    end if;

    if v_current.cursor_date is not null
      and p_next_cursor_date is null
    then
      raise exception using message = 'PROJECTION_PIPELINE_CURSOR_REGRESSION';
    end if;
    if v_current.cursor_date is not null
      and p_next_cursor_date < v_current.cursor_date
    then
      raise exception using message = 'PROJECTION_PIPELINE_CURSOR_REGRESSION';
    end if;
    if v_current.cursor_date is not null
      and p_next_cursor_date = v_current.cursor_date
      and v_current.cursor_game_id is not null
      and (
        p_next_cursor_game_id is null
        or p_next_cursor_game_id < v_current.cursor_game_id
      )
    then
      raise exception using message = 'PROJECTION_PIPELINE_CURSOR_REGRESSION';
    end if;
    if v_current.cursor_date is null
      and v_current.cursor_game_id is not null
      and (
        p_next_cursor_game_id is null
        or p_next_cursor_game_id < v_current.cursor_game_id
      )
    then
      raise exception using message = 'PROJECTION_PIPELINE_CURSOR_REGRESSION';
    end if;

    v_next_revision := v_current.revision + 1;

    update public.projection_pipeline_state as pipeline
    set
      revision = v_next_revision,
      status = p_next_status,
      cursor_game_id = p_next_cursor_game_id,
      cursor_date = p_next_cursor_date,
      lease_owner = v_stored_lease_owner,
      lease_expires_at = v_stored_lease_expires_at,
      last_error = v_stored_last_error,
      updated_at = v_now
    where pipeline.pipeline_key = p_pipeline_key
      and pipeline.scope_key = p_scope_key
      and pipeline.operation_key = p_operation_key
      and pipeline.revision = p_expected_revision;

    if not found then
      raise exception using message = 'PROJECTION_PIPELINE_CONCURRENT_CHANGE';
    end if;
  end if;

  return query
  select
    p_pipeline_key,
    p_scope_key,
    p_operation_key,
    v_next_revision,
    p_next_status,
    p_next_cursor_game_id,
    p_next_cursor_date,
    p_range_start_date,
    p_range_end_date,
    v_stored_lease_owner,
    v_stored_lease_expires_at,
    v_stored_last_error,
    v_now;
end;
$$;

revoke all on function public.advance_projection_pipeline_state_v1(
  text, text, text, text, bigint, text, bigint, date, date, date,
  text, timestamp with time zone, text
) from public, anon, authenticated;
grant execute on function public.advance_projection_pipeline_state_v1(
  text, text, text, text, bigint, text, bigint, date, date, date,
  text, timestamp with time zone, text
) to service_role;

reset lock_timeout;
reset statement_timeout;

commit;

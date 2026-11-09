-- persist_nhl_api_gamecenter_normalized_v2: v1 unchanged except for the shift-head check.
-- v1 requires one scope row per raw shiftcharts entry, so NHL's exact-content duplicates
-- (same player, team, period, start, end, type code under distinct ids) reach
-- nhl_api_shift_rows. v2 keeps the raw head faithful and accepts only its canonical
-- rows: one per exact-content interval, lowest id. Additive: v1 stays for rollback.
-- Apply this before releasing the writer that calls v2. Proof: supabase/tests/gamecenter_normalized_v2_shift_dedupe.py

begin;

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function public.persist_nhl_api_gamecenter_normalized_v2(
  p_game_id bigint,
  p_season_id bigint,
  p_game_date date,
  p_expected_pbp_payload_hash text,
  p_expected_shift_payload_hash text,
  p_expected_current_fingerprint text,
  p_expected_current_version bigint,
  p_parser_fingerprint text,
  p_parser_version integer,
  p_strength_version integer,
  p_materializer_version text,
  p_roster_rows jsonb,
  p_event_rows jsonb,
  p_shift_rows jsonb,
  p_expected_roster_rows integer,
  p_expected_event_rows integer,
  p_expected_shift_rows integer
)
returns table (
  game_id bigint,
  normalization_status text,
  normalization_version bigint,
  normalization_fingerprint text,
  source_fingerprint text,
  parser_fingerprint text,
  pbp_raw_payload_id bigint,
  pbp_raw_snapshot_version bigint,
  pbp_raw_payload_hash text,
  shift_raw_payload_id bigint,
  shift_raw_snapshot_version bigint,
  shift_raw_payload_hash text,
  expected_roster_rows integer,
  observed_roster_rows integer,
  expected_event_rows integer,
  observed_event_rows integer,
  expected_shift_rows integer,
  observed_shift_rows integer,
  pruned_roster_rows integer,
  pruned_event_rows integer,
  pruned_shift_rows integer,
  idempotent boolean,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '90s'
as $$
declare
  v_current public.nhl_api_game_normalization_status%rowtype;
  v_has_current boolean := false;
  v_pbp_raw_payload_id bigint;
  v_pbp_raw_snapshot_version bigint;
  v_pbp_raw_payload_hash text;
  v_pbp_payload jsonb;
  v_shift_raw_payload_id bigint;
  v_shift_raw_snapshot_version bigint;
  v_shift_raw_payload_hash text;
  v_shift_payload jsonb;
  v_raw_shift_invalid_ids integer;
  v_canonical_shift_count integer;
  v_shift_scope_mismatches integer;
  v_source_fingerprint text;
  v_roster_fingerprint text;
  v_event_fingerprint text;
  v_shift_fingerprint text;
  v_normalization_fingerprint text;
  v_existing_roster_fingerprint text;
  v_existing_event_fingerprint text;
  v_existing_shift_fingerprint text;
  v_roster_count integer;
  v_roster_distinct_count integer;
  v_event_count integer;
  v_event_distinct_count integer;
  v_shift_count integer;
  v_shift_distinct_count integer;
  v_observed_roster_count integer;
  v_observed_event_count integer;
  v_observed_shift_count integer;
  v_pruned_roster_count integer := 0;
  v_pruned_event_count integer := 0;
  v_pruned_shift_count integer := 0;
  v_next_version bigint;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null
    or p_game_id <= 0
    or p_game_id > 2147483647
    or p_season_id is null
    or p_season_id <= 0
    or p_game_date is null
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_SCOPE';
  end if;

  if p_expected_pbp_payload_hash is null
    or p_expected_pbp_payload_hash !~ '^[0-9a-f]{64}$'
    or p_expected_shift_payload_hash is null
    or p_expected_shift_payload_hash !~ '^[0-9a-f]{64}$'
    or p_parser_fingerprint is null
    or p_parser_fingerprint !~ '^[0-9a-f]{64}$'
    or p_parser_version is null
    or p_parser_version <= 0
    or p_strength_version is null
    or p_strength_version <= 0
    or p_materializer_version is null
    or pg_catalog.btrim(p_materializer_version) = ''
    or pg_catalog.char_length(p_materializer_version) > 128
    or p_materializer_version !~ '^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,127}$'
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_IDENTITY';
  end if;

  if (p_expected_current_fingerprint is null)
      is distinct from (p_expected_current_version is null)
    or (
      p_expected_current_fingerprint is not null
      and p_expected_current_fingerprint !~ '^[0-9a-f]{64}$'
    )
    or (
      p_expected_current_version is not null
      and p_expected_current_version <= 0
    )
  then
    raise exception using message = 'INVALID_EXPECTED_NHL_NORMALIZATION_IDENTITY';
  end if;

  if pg_catalog.jsonb_typeof(p_roster_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_event_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_shift_rows) is distinct from 'array'
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_PAYLOAD_SHAPE';
  end if;

  if p_expected_roster_rows is null
    or p_expected_roster_rows not between 0 and 100
    or p_expected_event_rows is null
    or p_expected_event_rows not between 0 and 2000
    or p_expected_shift_rows is null
    or p_expected_shift_rows not between 0 and 20000
    or pg_catalog.jsonb_array_length(p_roster_rows) <> p_expected_roster_rows
    or pg_catalog.jsonb_array_length(p_event_rows) <> p_expected_event_rows
    or pg_catalog.jsonb_array_length(p_shift_rows) <> p_expected_shift_rows
    or pg_catalog.pg_column_size(p_roster_rows)
      + pg_catalog.pg_column_size(p_event_rows)
      + pg_catalog.pg_column_size(p_shift_rows) > 12000000
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_PAYLOAD_SIZE';
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and game.date = p_game_date
      and game."seasonId" = p_season_id
  ) then
    raise exception using message = 'NHL_NORMALIZATION_SCHEDULE_MISMATCH';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.player_id)::integer
  into v_roster_count, v_roster_distinct_count
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_game_roster_spots,
    p_roster_rows
  ) as incoming;

  if v_roster_count <> p_expected_roster_rows
    or v_roster_distinct_count <> p_expected_roster_rows
    or exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_game_roster_spots,
        p_roster_rows
      ) as incoming
      where incoming.game_id is distinct from p_game_id
        or incoming.season_id is distinct from p_season_id
        or incoming.game_date is distinct from p_game_date
        or incoming.player_id is null
        or incoming.player_id <= 0
        or incoming.team_id is null
        or incoming.team_id <= 0
        or incoming.source_play_by_play_hash is distinct from
          p_expected_pbp_payload_hash
        or incoming.parser_version is distinct from p_parser_version
    )
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_ROSTER_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.event_id)::integer
  into v_event_count, v_event_distinct_count
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_pbp_events,
    p_event_rows
  ) as incoming;

  if v_event_count <> p_expected_event_rows
    or v_event_distinct_count <> p_expected_event_rows
    or exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_pbp_events,
        p_event_rows
      ) as incoming
      where incoming.game_id is distinct from p_game_id
        or incoming.season_id is distinct from p_season_id
        or incoming.game_date is distinct from p_game_date
        or incoming.event_id is null
        or incoming.event_id <= 0
        or incoming.source_play_by_play_hash is distinct from
          p_expected_pbp_payload_hash
        or incoming.parser_version is distinct from p_parser_version
        or incoming.strength_version is distinct from p_strength_version
    )
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_EVENT_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming.shift_id)::integer
  into v_shift_count, v_shift_distinct_count
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_shift_rows,
    p_shift_rows
  ) as incoming;

  if v_shift_count <> p_expected_shift_rows
    or v_shift_distinct_count <> p_expected_shift_rows
    or exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_shift_rows,
        p_shift_rows
      ) as incoming
      where incoming.game_id is distinct from p_game_id
        or incoming.season_id is distinct from p_season_id
        or incoming.game_date is distinct from p_game_date
        or incoming.shift_id is null
        or incoming.shift_id <= 0
        or incoming.player_id is null
        or incoming.player_id <= 0
        or incoming.team_id is null
        or incoming.team_id <= 0
        or incoming.source_shiftcharts_hash is distinct from
          p_expected_shift_payload_hash
        or incoming.parser_version is distinct from p_parser_version
    )
  then
    raise exception using message = 'INVALID_NHL_NORMALIZATION_SHIFT_ROWS';
  end if;

  -- Every canonical, direct-normalized, raw-head, and raw-capture writer enters
  -- the same global-before-game order. This keeps a raw-head UPDATE from first
  -- waiting on a tuple held by this RPC and only then requesting the game lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:normalization-direct-writer', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:projection-game:' || p_game_id::text, 0)
  );

  select
    head.raw_payload_id,
    head.snapshot_version,
    head.payload_hash,
    raw.payload
  into
    v_pbp_raw_payload_id,
    v_pbp_raw_snapshot_version,
    v_pbp_raw_payload_hash,
    v_pbp_payload
  from public.nhl_api_game_payload_snapshot_heads as head
  join public.nhl_api_game_payloads_raw as raw
    on raw.id = head.raw_payload_id
    and raw.game_id = head.game_id
    and raw.endpoint = head.endpoint
    and raw.payload_hash = head.payload_hash
  where head.game_id = p_game_id
    and head.endpoint = 'play-by-play'
  for update of head;

  if not found
    or v_pbp_raw_payload_hash is distinct from p_expected_pbp_payload_hash
    or pg_catalog.jsonb_typeof(v_pbp_payload) is distinct from 'object'
  then
    raise exception using message = 'NHL_NORMALIZATION_PBP_HEAD_MISMATCH';
  end if;

  if v_pbp_payload->>'id' is distinct from p_game_id::text
    or v_pbp_payload->>'season' is distinct from p_season_id::text
    or v_pbp_payload->>'gameDate' is distinct from p_game_date::text
    or pg_catalog.jsonb_typeof(v_pbp_payload->'rosterSpots') is distinct from 'array'
    or pg_catalog.jsonb_typeof(v_pbp_payload->'plays') is distinct from 'array'
  then
    raise exception using message = 'NHL_NORMALIZATION_PBP_HEAD_MISMATCH';
  end if;

  if pg_catalog.jsonb_array_length(v_pbp_payload->'rosterSpots')
      <> p_expected_roster_rows
    or pg_catalog.jsonb_array_length(v_pbp_payload->'plays')
      <> p_expected_event_rows
  then
    raise exception using message = 'NHL_NORMALIZATION_PBP_HEAD_MISMATCH';
  end if;

  select
    head.raw_payload_id,
    head.snapshot_version,
    head.payload_hash,
    raw.payload
  into
    v_shift_raw_payload_id,
    v_shift_raw_snapshot_version,
    v_shift_raw_payload_hash,
    v_shift_payload
  from public.nhl_api_game_payload_snapshot_heads as head
  join public.nhl_api_game_payloads_raw as raw
    on raw.id = head.raw_payload_id
    and raw.game_id = head.game_id
    and raw.endpoint = head.endpoint
    and raw.payload_hash = head.payload_hash
  where head.game_id = p_game_id
    and head.endpoint = 'shiftcharts'
  for update of head;

  if not found
    or v_shift_raw_payload_hash is distinct from p_expected_shift_payload_hash
    or pg_catalog.jsonb_typeof(v_shift_payload) is distinct from 'object'
  then
    raise exception using message = 'NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH';
  end if;

  if pg_catalog.jsonb_typeof(v_shift_payload->'data') is distinct from 'array'
  then
    raise exception using message = 'NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH';
  end if;

  -- v2: NHL can publish one interval twice under different ids. The raw head keeps
  -- every entry; the scope must be exactly its canonical rows: one per exact-content
  -- interval (player, team, period, start, end, type code), keeping the lowest id.
  with raw_entry as (
    select
      entry.value as shift,
      case
        when pg_catalog.jsonb_typeof(entry.value->'id') = 'number'
          and (entry.value->>'id') ~ '^[1-9][0-9]{0,17}$'
        then (entry.value->>'id')::bigint
      end as raw_id
    from pg_catalog.jsonb_array_elements(v_shift_payload->'data') as entry
  ), ranked as (
    select
      raw_entry.raw_id,
      pg_catalog.row_number() over (
        partition by
          raw_entry.shift->>'playerId',
          raw_entry.shift->>'teamId',
          raw_entry.shift->>'period',
          raw_entry.shift->>'startTime',
          raw_entry.shift->>'endTime',
          raw_entry.shift->>'typeCode'
        order by raw_entry.raw_id
      ) as content_rank
    from raw_entry
  ), canonical as (
    select ranked.raw_id from ranked where ranked.content_rank = 1
  ), incoming as (
    select incoming_row.shift_id
    from pg_catalog.jsonb_populate_recordset(
      null::public.nhl_api_shift_rows,
      p_shift_rows
    ) as incoming_row
  )
  select
    (select pg_catalog.count(*) from raw_entry where raw_entry.raw_id is null)::integer,
    (select pg_catalog.count(*) from canonical)::integer,
    (select pg_catalog.count(*) from (
      (select canonical.raw_id from canonical
        except select incoming.shift_id from incoming)
      union all
      (select incoming.shift_id from incoming
        except select canonical.raw_id from canonical)
    ) as mismatch)::integer
  into v_raw_shift_invalid_ids, v_canonical_shift_count, v_shift_scope_mismatches;

  if v_raw_shift_invalid_ids <> 0
    or v_canonical_shift_count <> p_expected_shift_rows
    or v_shift_scope_mismatches <> 0
  then
    raise exception using message = 'NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH';
  end if;

  select status.*
  into v_current
  from public.nhl_api_game_normalization_status as status
  where status.game_id = p_game_id
  for update;
  v_has_current := found;

  if (
      not v_has_current
      and (
        p_expected_current_fingerprint is not null
        or p_expected_current_version is not null
      )
    )
    or (
      v_has_current
      and (
        p_expected_current_fingerprint is distinct from
          v_current.normalization_fingerprint
        or p_expected_current_version is distinct from
          v_current.normalization_version
      )
    )
  then
    raise exception using message = 'NHL_NORMALIZATION_CAS_MISMATCH';
  end if;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.concat_ws(
          '|',
          p_game_id::text,
          v_pbp_raw_payload_id::text,
          v_pbp_raw_snapshot_version::text,
          v_pbp_raw_payload_hash,
          v_shift_raw_payload_id::text,
          v_shift_raw_snapshot_version::text,
          v_shift_raw_payload_hash
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_source_fingerprint;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(incoming) - 'created_at' - 'updated_at'
            order by incoming.player_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_roster_fingerprint
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_game_roster_spots,
    p_roster_rows
  ) as incoming;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(incoming) - 'created_at' - 'updated_at'
            order by incoming.event_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_event_fingerprint
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_pbp_events,
    p_event_rows
  ) as incoming;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(incoming) - 'created_at' - 'updated_at'
            order by incoming.shift_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_shift_fingerprint
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_shift_rows,
    p_shift_rows
  ) as incoming;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.concat_ws(
          '|',
          v_source_fingerprint,
          p_parser_fingerprint,
          p_parser_version::text,
          p_strength_version::text,
          p_materializer_version,
          v_roster_fingerprint,
          v_event_fingerprint,
          v_shift_fingerprint
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_normalization_fingerprint;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(existing) - 'created_at' - 'updated_at'
            order by existing.player_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_existing_roster_fingerprint
  from public.nhl_api_game_roster_spots as existing
  where existing.game_id = p_game_id;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(existing) - 'created_at' - 'updated_at'
            order by existing.event_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_existing_event_fingerprint
  from public.nhl_api_pbp_events as existing
  where existing.game_id = p_game_id;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        coalesce(
          pg_catalog.jsonb_agg(
            to_jsonb(existing) - 'created_at' - 'updated_at'
            order by existing.shift_id
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_existing_shift_fingerprint
  from public.nhl_api_shift_rows as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_roster_count
  from public.nhl_api_game_roster_spots as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_event_count
  from public.nhl_api_pbp_events as existing
  where existing.game_id = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_shift_count
  from public.nhl_api_shift_rows as existing
  where existing.game_id = p_game_id;

  if v_has_current
    and v_current.status = 'complete'
    and v_current.season_id = p_season_id
    and v_current.game_date = p_game_date
    and v_current.normalization_fingerprint = v_normalization_fingerprint
    and v_current.source_fingerprint = v_source_fingerprint
    and v_current.parser_fingerprint = p_parser_fingerprint
    and v_current.parser_version = p_parser_version
    and v_current.strength_version = p_strength_version
    and v_current.materializer_version = p_materializer_version
    and v_current.pbp_raw_payload_id = v_pbp_raw_payload_id
    and v_current.pbp_raw_snapshot_version = v_pbp_raw_snapshot_version
    and v_current.pbp_raw_payload_hash = v_pbp_raw_payload_hash
    and v_current.shift_raw_payload_id = v_shift_raw_payload_id
    and v_current.shift_raw_snapshot_version = v_shift_raw_snapshot_version
    and v_current.shift_raw_payload_hash = v_shift_raw_payload_hash
    and v_current.roster_fingerprint = v_roster_fingerprint
    and v_current.event_fingerprint = v_event_fingerprint
    and v_current.shift_fingerprint = v_shift_fingerprint
    and v_current.expected_roster_rows = p_expected_roster_rows
    and v_current.observed_roster_rows = v_observed_roster_count
    and v_current.expected_event_rows = p_expected_event_rows
    and v_current.observed_event_rows = v_observed_event_count
    and v_current.expected_shift_rows = p_expected_shift_rows
    and v_current.observed_shift_rows = v_observed_shift_count
    and v_existing_roster_fingerprint = v_roster_fingerprint
    and v_existing_event_fingerprint = v_event_fingerprint
    and v_existing_shift_fingerprint = v_shift_fingerprint
    and v_observed_roster_count = p_expected_roster_rows
    and v_observed_event_count = p_expected_event_rows
    and v_observed_shift_count = p_expected_shift_rows
  then
    return query select
      p_game_id,
      v_current.status,
      v_current.normalization_version,
      v_current.normalization_fingerprint,
      v_current.source_fingerprint,
      v_current.parser_fingerprint,
      v_current.pbp_raw_payload_id,
      v_current.pbp_raw_snapshot_version,
      v_current.pbp_raw_payload_hash,
      v_current.shift_raw_payload_id,
      v_current.shift_raw_snapshot_version,
      v_current.shift_raw_payload_hash,
      v_current.expected_roster_rows,
      v_current.observed_roster_rows,
      v_current.expected_event_rows,
      v_current.observed_event_rows,
      v_current.expected_shift_rows,
      v_current.observed_shift_rows,
      0,
      0,
      0,
      true,
      v_current.completed_at;
    return;
  end if;

  if v_has_current
    and v_current.normalization_version = 9223372036854775807
  then
    raise exception using message = 'NHL_NORMALIZATION_VERSION_EXHAUSTED';
  end if;

  select pg_catalog.count(*)::integer
  into v_pruned_roster_count
  from public.nhl_api_game_roster_spots as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_game_roster_spots,
        p_roster_rows
      ) as incoming
      where incoming.player_id = existing.player_id
    );

  select pg_catalog.count(*)::integer
  into v_pruned_event_count
  from public.nhl_api_pbp_events as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_pbp_events,
        p_event_rows
      ) as incoming
      where incoming.event_id = existing.event_id
    );

  select pg_catalog.count(*)::integer
  into v_pruned_shift_count
  from public.nhl_api_shift_rows as existing
  where existing.game_id = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_populate_recordset(
        null::public.nhl_api_shift_rows,
        p_shift_rows
      ) as incoming
      where incoming.shift_id = existing.shift_id
    );

  delete from public.nhl_api_game_roster_spots as existing
  where existing.game_id = p_game_id;
  delete from public.nhl_api_pbp_events as existing
  where existing.game_id = p_game_id;
  delete from public.nhl_api_shift_rows as existing
  where existing.game_id = p_game_id;

  insert into public.nhl_api_game_roster_spots (
    game_id,
    season_id,
    game_date,
    team_id,
    player_id,
    first_name,
    last_name,
    sweater_number,
    position_code,
    headshot_url,
    source_play_by_play_hash,
    parser_version,
    raw_spot,
    created_at,
    updated_at
  )
  select
    incoming.game_id,
    incoming.season_id,
    incoming.game_date,
    incoming.team_id,
    incoming.player_id,
    incoming.first_name,
    incoming.last_name,
    incoming.sweater_number,
    incoming.position_code,
    incoming.headshot_url,
    incoming.source_play_by_play_hash,
    incoming.parser_version,
    incoming.raw_spot,
    v_completed_at,
    v_completed_at
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_game_roster_spots,
    p_roster_rows
  ) as incoming
  order by incoming.player_id;

  insert into public.nhl_api_pbp_events (
    game_id,
    season_id,
    game_date,
    event_id,
    sort_order,
    period_number,
    period_type,
    time_in_period,
    time_remaining,
    period_seconds_elapsed,
    time_remaining_seconds,
    situation_code,
    away_goalie,
    away_skaters,
    home_skaters,
    home_goalie,
    strength_exact,
    strength_state,
    home_team_defending_side,
    type_code,
    type_desc_key,
    event_owner_team_id,
    event_owner_side,
    is_shot_like,
    is_goal,
    is_penalty,
    details,
    losing_player_id,
    winning_player_id,
    shooting_player_id,
    scoring_player_id,
    goalie_in_net_id,
    blocking_player_id,
    hitting_player_id,
    hittee_player_id,
    committed_by_player_id,
    drawn_by_player_id,
    served_by_player_id,
    player_id,
    assist1_player_id,
    assist2_player_id,
    shot_type,
    penalty_type_code,
    penalty_desc_key,
    penalty_duration_minutes,
    reason,
    secondary_reason,
    x_coord,
    y_coord,
    zone_code,
    home_score,
    away_score,
    home_sog,
    away_sog,
    source_play_by_play_hash,
    parser_version,
    strength_version,
    raw_event,
    created_at,
    updated_at
  )
  select
    incoming.game_id,
    incoming.season_id,
    incoming.game_date,
    incoming.event_id,
    incoming.sort_order,
    incoming.period_number,
    incoming.period_type,
    incoming.time_in_period,
    incoming.time_remaining,
    incoming.period_seconds_elapsed,
    incoming.time_remaining_seconds,
    incoming.situation_code,
    incoming.away_goalie,
    incoming.away_skaters,
    incoming.home_skaters,
    incoming.home_goalie,
    incoming.strength_exact,
    incoming.strength_state,
    incoming.home_team_defending_side,
    incoming.type_code,
    incoming.type_desc_key,
    incoming.event_owner_team_id,
    incoming.event_owner_side,
    incoming.is_shot_like,
    incoming.is_goal,
    incoming.is_penalty,
    incoming.details,
    incoming.losing_player_id,
    incoming.winning_player_id,
    incoming.shooting_player_id,
    incoming.scoring_player_id,
    incoming.goalie_in_net_id,
    incoming.blocking_player_id,
    incoming.hitting_player_id,
    incoming.hittee_player_id,
    incoming.committed_by_player_id,
    incoming.drawn_by_player_id,
    incoming.served_by_player_id,
    incoming.player_id,
    incoming.assist1_player_id,
    incoming.assist2_player_id,
    incoming.shot_type,
    incoming.penalty_type_code,
    incoming.penalty_desc_key,
    incoming.penalty_duration_minutes,
    incoming.reason,
    incoming.secondary_reason,
    incoming.x_coord,
    incoming.y_coord,
    incoming.zone_code,
    incoming.home_score,
    incoming.away_score,
    incoming.home_sog,
    incoming.away_sog,
    incoming.source_play_by_play_hash,
    incoming.parser_version,
    incoming.strength_version,
    incoming.raw_event,
    v_completed_at,
    v_completed_at
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_pbp_events,
    p_event_rows
  ) as incoming
  order by incoming.event_id;

  insert into public.nhl_api_shift_rows (
    game_id,
    shift_id,
    season_id,
    game_date,
    player_id,
    team_id,
    team_abbrev,
    team_name,
    first_name,
    last_name,
    period,
    shift_number,
    start_time,
    end_time,
    duration,
    start_seconds,
    end_seconds,
    duration_seconds,
    type_code,
    detail_code,
    event_number,
    event_description,
    event_details,
    hex_value,
    source_shiftcharts_hash,
    parser_version,
    raw_shift,
    created_at,
    updated_at
  )
  select
    incoming.game_id,
    incoming.shift_id,
    incoming.season_id,
    incoming.game_date,
    incoming.player_id,
    incoming.team_id,
    incoming.team_abbrev,
    incoming.team_name,
    incoming.first_name,
    incoming.last_name,
    incoming.period,
    incoming.shift_number,
    incoming.start_time,
    incoming.end_time,
    incoming.duration,
    incoming.start_seconds,
    incoming.end_seconds,
    incoming.duration_seconds,
    incoming.type_code,
    incoming.detail_code,
    incoming.event_number,
    incoming.event_description,
    incoming.event_details,
    incoming.hex_value,
    incoming.source_shiftcharts_hash,
    incoming.parser_version,
    incoming.raw_shift,
    v_completed_at,
    v_completed_at
  from pg_catalog.jsonb_populate_recordset(
    null::public.nhl_api_shift_rows,
    p_shift_rows
  ) as incoming
  order by incoming.shift_id;

  select pg_catalog.count(*)::integer
  into v_observed_roster_count
  from public.nhl_api_game_roster_spots as observed
  where observed.game_id = p_game_id;
  select pg_catalog.count(*)::integer
  into v_observed_event_count
  from public.nhl_api_pbp_events as observed
  where observed.game_id = p_game_id;
  select pg_catalog.count(*)::integer
  into v_observed_shift_count
  from public.nhl_api_shift_rows as observed
  where observed.game_id = p_game_id;

  if v_observed_roster_count <> p_expected_roster_rows
    or v_observed_event_count <> p_expected_event_rows
    or v_observed_shift_count <> p_expected_shift_rows
  then
    raise exception using message = 'NHL_NORMALIZATION_COUNT_MISMATCH';
  end if;

  v_next_version := coalesce(v_current.normalization_version, 0) + 1;

  insert into public.nhl_api_game_normalization_status (
    game_id,
    season_id,
    game_date,
    status,
    normalization_version,
    normalization_fingerprint,
    source_fingerprint,
    parser_fingerprint,
    parser_version,
    strength_version,
    materializer_version,
    pbp_raw_payload_id,
    pbp_raw_snapshot_version,
    pbp_raw_payload_hash,
    shift_raw_payload_id,
    shift_raw_snapshot_version,
    shift_raw_payload_hash,
    roster_fingerprint,
    event_fingerprint,
    shift_fingerprint,
    expected_roster_rows,
    observed_roster_rows,
    expected_event_rows,
    observed_event_rows,
    expected_shift_rows,
    observed_shift_rows,
    completed_at,
    updated_at
  ) values (
    p_game_id,
    p_season_id,
    p_game_date,
    'complete',
    v_next_version,
    v_normalization_fingerprint,
    v_source_fingerprint,
    p_parser_fingerprint,
    p_parser_version,
    p_strength_version,
    p_materializer_version,
    v_pbp_raw_payload_id,
    v_pbp_raw_snapshot_version,
    v_pbp_raw_payload_hash,
    v_shift_raw_payload_id,
    v_shift_raw_snapshot_version,
    v_shift_raw_payload_hash,
    v_roster_fingerprint,
    v_event_fingerprint,
    v_shift_fingerprint,
    p_expected_roster_rows,
    v_observed_roster_count,
    p_expected_event_rows,
    v_observed_event_count,
    p_expected_shift_rows,
    v_observed_shift_count,
    v_completed_at,
    v_completed_at
  )
  on conflict on constraint nhl_api_game_normalization_status_pkey
  do update set
    season_id = excluded.season_id,
    game_date = excluded.game_date,
    status = excluded.status,
    normalization_version = excluded.normalization_version,
    normalization_fingerprint = excluded.normalization_fingerprint,
    source_fingerprint = excluded.source_fingerprint,
    parser_fingerprint = excluded.parser_fingerprint,
    parser_version = excluded.parser_version,
    strength_version = excluded.strength_version,
    materializer_version = excluded.materializer_version,
    pbp_raw_payload_id = excluded.pbp_raw_payload_id,
    pbp_raw_snapshot_version = excluded.pbp_raw_snapshot_version,
    pbp_raw_payload_hash = excluded.pbp_raw_payload_hash,
    shift_raw_payload_id = excluded.shift_raw_payload_id,
    shift_raw_snapshot_version = excluded.shift_raw_snapshot_version,
    shift_raw_payload_hash = excluded.shift_raw_payload_hash,
    roster_fingerprint = excluded.roster_fingerprint,
    event_fingerprint = excluded.event_fingerprint,
    shift_fingerprint = excluded.shift_fingerprint,
    expected_roster_rows = excluded.expected_roster_rows,
    observed_roster_rows = excluded.observed_roster_rows,
    expected_event_rows = excluded.expected_event_rows,
    observed_event_rows = excluded.observed_event_rows,
    expected_shift_rows = excluded.expected_shift_rows,
    observed_shift_rows = excluded.observed_shift_rows,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at;

  return query select
    p_game_id,
    'complete'::text,
    v_next_version,
    v_normalization_fingerprint,
    v_source_fingerprint,
    p_parser_fingerprint,
    v_pbp_raw_payload_id,
    v_pbp_raw_snapshot_version,
    v_pbp_raw_payload_hash,
    v_shift_raw_payload_id,
    v_shift_raw_snapshot_version,
    v_shift_raw_payload_hash,
    p_expected_roster_rows,
    v_observed_roster_count,
    p_expected_event_rows,
    v_observed_event_count,
    p_expected_shift_rows,
    v_observed_shift_count,
    v_pruned_roster_count,
    v_pruned_event_count,
    v_pruned_shift_count,
    false,
    v_completed_at;
end;
$$;

revoke all on function public.persist_nhl_api_gamecenter_normalized_v2(
  bigint, bigint, date, text, text, text, bigint, text, integer, integer,
  text, jsonb, jsonb, jsonb, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.persist_nhl_api_gamecenter_normalized_v2(
  bigint, bigint, date, text, text, text, bigint, text, integer, integer,
  text, jsonb, jsonb, jsonb, integer, integer, integer
) to service_role;

reset lock_timeout;
reset statement_timeout;

commit;

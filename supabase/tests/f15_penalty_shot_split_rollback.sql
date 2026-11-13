-- Rollback for 20261113200000_forge_strength_penalty_shot_split.sql.
-- Refuses while any split row (penalty_shot_split_version 1) is stored: dropping the PS columns
-- would lose those penalty shots from every all-situation total. To roll back:
--   1. revert the F15 code (the builder and persistence that call persist_projection_game_derived_v2);
--   2. rebuild each split game with the reverted code (it calls v1, which stores legacy rows);
--   3. run this file: it restores v1 exactly as 20260720105524 defined it, drops v2, the CHECKs
--      and the three columns.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (
    select 1 from public.forge_player_game_strength where penalty_shot_split_version is not null
  ) or exists (
    select 1 from public.forge_team_game_strength where penalty_shot_split_version is not null
  ) then
    raise exception using message = 'PENALTY_SHOT_SPLIT_ROWS_STORED';
  end if;
end;
$$;

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

drop function public.persist_projection_game_derived_v2(
  bigint, text, bigint, text, text, jsonb, jsonb, jsonb,
  integer, integer, integer, text, text
);

alter table public.forge_player_game_strength
  drop constraint forge_player_game_strength_penalty_shot_split_check,
  drop column penalty_shot_split_version,
  drop column goals_ps,
  drop column shots_ps;

alter table public.forge_team_game_strength
  drop constraint forge_team_game_strength_penalty_shot_split_check,
  drop column penalty_shot_split_version,
  drop column goals_ps,
  drop column shots_ps;

commit;

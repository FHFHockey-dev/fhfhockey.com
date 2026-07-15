-- Add a fail-closed, versioned completion manifest and make one game-stat
-- persistence call own all three stat tables plus terminal status.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public."statsUpdateStatus"
  add column outcome text,
  add column reason text,
  add column contract_version smallint,
  add column expected_team_rows integer,
  add column observed_team_rows integer,
  add column expected_skater_rows integer,
  add column observed_skater_rows integer,
  add column expected_goalie_rows integer,
  add column observed_goalie_rows integer,
  add column completed_at timestamp with time zone;

-- Existing true rows cannot be certified because their source cardinalities
-- were never recorded. Existing false rows are known pending work.
update public."statsUpdateStatus"
set
  outcome = case when updated then 'legacy_unverified' else 'pending' end,
  contract_version = case when updated then 0 else 1 end,
  reason = null,
  expected_team_rows = null,
  observed_team_rows = null,
  expected_skater_rows = null,
  observed_skater_rows = null,
  expected_goalie_rows = null,
  observed_goalie_rows = null,
  completed_at = null;

alter table public."statsUpdateStatus"
  alter column outcome set default 'pending',
  alter column outcome set not null,
  alter column contract_version set default 1,
  alter column contract_version set not null,
  add constraint stats_update_status_manifest_state_check check ((
    (
      outcome = 'pending'
      and updated = false
      and contract_version = 1
      and reason is null
      and expected_team_rows is null
      and observed_team_rows is null
      and expected_skater_rows is null
      and observed_skater_rows is null
      and expected_goalie_rows is null
      and observed_goalie_rows is null
      and completed_at is null
    )
    or
    (
      outcome = 'legacy_unverified'
      and updated = true
      and contract_version = 0
      and reason is null
      and expected_team_rows is null
      and observed_team_rows is null
      and expected_skater_rows is null
      and observed_skater_rows is null
      and expected_goalie_rows is null
      and observed_goalie_rows is null
      and completed_at is null
    )
    or
    (
      outcome = 'complete'
      and updated = true
      and contract_version = 1
      and reason is null
      and completed_at is not null
      and expected_team_rows = 2
      and observed_team_rows = expected_team_rows
      and expected_skater_rows between 1 and 100
      and observed_skater_rows = expected_skater_rows
      and expected_goalie_rows between 1 and 100
      and observed_goalie_rows = expected_goalie_rows
      and expected_skater_rows + expected_goalie_rows <= 100
    )
    or
    (
      outcome = 'quarantined'
      and updated = true
      and contract_version = 1
      and reason = 'game_not_finished'
      and completed_at is not null
      and expected_team_rows = 0
      and observed_team_rows = 0
      and expected_skater_rows = 0
      and observed_skater_rows = 0
      and expected_goalie_rows = 0
      and observed_goalie_rows = 0
    )
  ) is true);

create index if not exists idx_goaliesgamestats_gameid
  on public."goaliesGameStats" ("gameId");

create or replace function public.persist_complete_game_stats_v1(
  p_game_id bigint,
  p_team_rows jsonb,
  p_skater_rows jsonb,
  p_goalie_rows jsonb,
  p_expected_team_rows integer,
  p_expected_skater_rows integer,
  p_expected_goalie_rows integer
)
returns table (
  game_id bigint,
  outcome text,
  contract_version smallint,
  expected_team_rows integer,
  observed_team_rows integer,
  expected_skater_rows integer,
  observed_skater_rows integer,
  expected_goalie_rows integer,
  observed_goalie_rows integer,
  pruned_team_rows integer,
  pruned_skater_rows integer,
  pruned_goalie_rows integer,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_team_payload_count integer;
  v_skater_payload_count integer;
  v_goalie_payload_count integer;
  v_team_distinct_count integer;
  v_skater_distinct_count integer;
  v_goalie_distinct_count integer;
  v_existing_team_count integer;
  v_existing_skater_count integer;
  v_existing_goalie_count integer;
  v_observed_team_count integer;
  v_observed_skater_count integer;
  v_observed_goalie_count integer;
  v_pruned_team_count integer := 0;
  v_pruned_skater_count integer := 0;
  v_pruned_goalie_count integer := 0;
  v_rows_are_valid boolean;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_game_id is null or p_game_id <= 0 then
    raise exception using message = 'INVALID_GAME_STATS_GAME_ID';
  end if;

  if pg_catalog.jsonb_typeof(p_team_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_skater_rows) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_goalie_rows) is distinct from 'array'
  then
    raise exception using message = 'INVALID_GAME_STATS_PAYLOAD_SHAPE';
  end if;

  v_team_payload_count := pg_catalog.jsonb_array_length(p_team_rows);
  v_skater_payload_count := pg_catalog.jsonb_array_length(p_skater_rows);
  v_goalie_payload_count := pg_catalog.jsonb_array_length(p_goalie_rows);

  if p_expected_team_rows is distinct from 2
    or v_team_payload_count is distinct from p_expected_team_rows
    or p_expected_skater_rows is null
    or p_expected_skater_rows not between 1 and 100
    or v_skater_payload_count is distinct from p_expected_skater_rows
    or p_expected_goalie_rows is null
    or p_expected_goalie_rows not between 1 and 100
    or v_goalie_payload_count is distinct from p_expected_goalie_rows
    or (p_expected_skater_rows + p_expected_goalie_rows) > 100
  then
    raise exception using message = 'INVALID_GAME_STATS_EXPECTED_COUNTS';
  end if;

  -- Cast and validate every input row before acquiring the lock or writing.
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming."teamId")::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming."gameId" = p_game_id
            and incoming."teamId" > 0
            and incoming.score is not null
            and incoming.sog is not null
            and incoming."faceoffPctg" is not null
            and incoming.pim is not null
            and incoming.hits is not null
            and incoming."blockedShots" is not null
            and incoming.giveaways is not null
            and incoming.takeaways is not null
            and incoming."powerPlay" is not null
            and incoming."powerPlayConversion" is not null
            and incoming."powerPlayToi" is not null
          ),
          false
        )
      ),
      false
    )
  into v_team_payload_count, v_team_distinct_count, v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
    "gameId" bigint,
    "teamId" smallint,
    score smallint,
    sog smallint,
    "faceoffPctg" real,
    pim smallint,
    hits smallint,
    "blockedShots" smallint,
    giveaways smallint,
    takeaways smallint,
    "powerPlay" text,
    "powerPlayConversion" text,
    "powerPlayToi" text
  );

  if v_team_payload_count <> 2
    or v_team_distinct_count <> 2
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_TEAM_GAME_STATS_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming."playerId")::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming."gameId" = p_game_id
            and incoming."playerId" > 0
            and incoming.position <> 'G'::public."NHL_Position_Code"
            and incoming.goals is not null
            and incoming.assists is not null
            and incoming.points is not null
            and incoming."plusMinus" is not null
            and incoming.pim is not null
            and incoming.hits is not null
            and incoming."blockedShots" is not null
            and incoming."powerPlayGoals" is not null
            and incoming."powerPlayPoints" is not null
            and incoming."shorthandedGoals" is not null
            and incoming."shPoints" is not null
            and incoming.shots is not null
            and incoming.faceoffs is not null
            and incoming."faceoffWinningPctg" is not null
            and incoming.toi is not null
            and incoming."powerPlayToi" is not null
            and incoming."shorthandedToi" is not null
          ),
          false
        )
      ),
      false
    )
  into v_skater_payload_count, v_skater_distinct_count, v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_skater_rows) as incoming(
    "playerId" bigint,
    "gameId" bigint,
    position public."NHL_Position_Code",
    goals smallint,
    assists smallint,
    points smallint,
    "plusMinus" smallint,
    pim smallint,
    hits smallint,
    "blockedShots" smallint,
    "powerPlayGoals" smallint,
    "powerPlayPoints" smallint,
    "shorthandedGoals" smallint,
    "shPoints" smallint,
    shots smallint,
    faceoffs text,
    "faceoffWinningPctg" real,
    toi text,
    "powerPlayToi" text,
    "shorthandedToi" text
  );

  if v_skater_payload_count <> p_expected_skater_rows
    or v_skater_distinct_count <> p_expected_skater_rows
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_SKATER_GAME_STATS_ROWS';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct incoming."playerId")::integer,
    coalesce(
      pg_catalog.bool_and(
        coalesce(
          (
            incoming."gameId" = p_game_id
            and incoming."playerId" > 0
            and incoming.position = 'G'::public."NHL_Position_Code"
            and incoming."evenStrengthShotsAgainst" is not null
            and incoming."powerPlayShotsAgainst" is not null
            and incoming."shorthandedShotsAgainst" is not null
            and incoming."saveShotsAgainst" is not null
            and incoming."evenStrengthGoalsAgainst" is not null
            and incoming."powerPlayGoalsAgainst" is not null
            and incoming."shorthandedGoalsAgainst" is not null
            and incoming.pim is not null
            and incoming."goalsAgainst" is not null
            and incoming.toi is not null
            and incoming."savePctg" is not null
          ),
          false
        )
      ),
      false
    )
  into v_goalie_payload_count, v_goalie_distinct_count, v_rows_are_valid
  from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
    "playerId" bigint,
    "gameId" bigint,
    position public."NHL_Position_Code",
    "evenStrengthShotsAgainst" text,
    "powerPlayShotsAgainst" text,
    "shorthandedShotsAgainst" text,
    "saveShotsAgainst" text,
    "evenStrengthGoalsAgainst" smallint,
    "powerPlayGoalsAgainst" smallint,
    "shorthandedGoalsAgainst" smallint,
    pim smallint,
    "goalsAgainst" smallint,
    toi text,
    "savePctg" real
  );

  if v_goalie_payload_count <> p_expected_goalie_rows
    or v_goalie_distinct_count <> p_expected_goalie_rows
    or not v_rows_are_valid
  then
    raise exception using message = 'INVALID_GOALIE_GAME_STATS_ROWS';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_skater_rows)
      as skater("playerId" bigint)
    join pg_catalog.jsonb_to_recordset(p_goalie_rows)
      as goalie("playerId" bigint)
      on goalie."playerId" = skater."playerId"
  ) then
    raise exception using message = 'OVERLAPPING_SKATER_GOALIE_IDENTITIES';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fhfh:game-stats:' || p_game_id::text, 0)
  );

  if not exists (
    select 1 from public.games where id = p_game_id
  ) then
    raise exception using message = 'GAME_STATS_GAME_NOT_FOUND';
  end if;

  select pg_catalog.count(*)::integer
  into v_existing_team_count
  from public."teamGameStats"
  where "gameId" = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_skater_count
  from public."skatersGameStats"
  where "gameId" = p_game_id;

  select pg_catalog.count(*)::integer
  into v_existing_goalie_count
  from public."goaliesGameStats"
  where "gameId" = p_game_id;

  if v_existing_team_count > 2
    or v_existing_skater_count > 100
    or v_existing_goalie_count > 100
  then
    raise exception using message = 'UNBOUNDED_EXISTING_GAME_STATS_ROWS';
  end if;

  insert into public."teamGameStats" (
    "gameId", "teamId", score, sog, "faceoffPctg", pim, hits,
    "blockedShots", giveaways, takeaways, "powerPlay",
    "powerPlayConversion", "powerPlayToi"
  )
  select
    incoming."gameId", incoming."teamId", incoming.score, incoming.sog,
    incoming."faceoffPctg", incoming.pim, incoming.hits,
    incoming."blockedShots", incoming.giveaways, incoming.takeaways,
    incoming."powerPlay", incoming."powerPlayConversion",
    incoming."powerPlayToi"
  from pg_catalog.jsonb_to_recordset(p_team_rows) as incoming(
    "gameId" bigint, "teamId" smallint, score smallint, sog smallint,
    "faceoffPctg" real, pim smallint, hits smallint, "blockedShots" smallint,
    giveaways smallint, takeaways smallint, "powerPlay" text,
    "powerPlayConversion" text, "powerPlayToi" text
  )
  on conflict ("gameId", "teamId") do update set
    score = excluded.score,
    sog = excluded.sog,
    "faceoffPctg" = excluded."faceoffPctg",
    pim = excluded.pim,
    hits = excluded.hits,
    "blockedShots" = excluded."blockedShots",
    giveaways = excluded.giveaways,
    takeaways = excluded.takeaways,
    "powerPlay" = excluded."powerPlay",
    "powerPlayConversion" = excluded."powerPlayConversion",
    "powerPlayToi" = excluded."powerPlayToi";

  insert into public."skatersGameStats" (
    "playerId", "gameId", position, goals, assists, points, "plusMinus",
    pim, hits, "blockedShots", "powerPlayGoals", "powerPlayPoints",
    "shorthandedGoals", "shPoints", shots, faceoffs,
    "faceoffWinningPctg", toi, "powerPlayToi", "shorthandedToi"
  )
  select
    incoming."playerId", incoming."gameId", incoming.position,
    incoming.goals, incoming.assists, incoming.points, incoming."plusMinus",
    incoming.pim, incoming.hits, incoming."blockedShots",
    incoming."powerPlayGoals", incoming."powerPlayPoints",
    incoming."shorthandedGoals", incoming."shPoints", incoming.shots,
    incoming.faceoffs, incoming."faceoffWinningPctg", incoming.toi,
    incoming."powerPlayToi", incoming."shorthandedToi"
  from pg_catalog.jsonb_to_recordset(p_skater_rows) as incoming(
    "playerId" bigint, "gameId" bigint, position public."NHL_Position_Code",
    goals smallint, assists smallint, points smallint, "plusMinus" smallint,
    pim smallint, hits smallint, "blockedShots" smallint,
    "powerPlayGoals" smallint, "powerPlayPoints" smallint,
    "shorthandedGoals" smallint, "shPoints" smallint, shots smallint,
    faceoffs text, "faceoffWinningPctg" real, toi text,
    "powerPlayToi" text, "shorthandedToi" text
  )
  on conflict ("playerId", "gameId") do update set
    position = excluded.position,
    goals = excluded.goals,
    assists = excluded.assists,
    points = excluded.points,
    "plusMinus" = excluded."plusMinus",
    pim = excluded.pim,
    hits = excluded.hits,
    "blockedShots" = excluded."blockedShots",
    "powerPlayGoals" = excluded."powerPlayGoals",
    "powerPlayPoints" = excluded."powerPlayPoints",
    "shorthandedGoals" = excluded."shorthandedGoals",
    "shPoints" = excluded."shPoints",
    shots = excluded.shots,
    faceoffs = excluded.faceoffs,
    "faceoffWinningPctg" = excluded."faceoffWinningPctg",
    toi = excluded.toi,
    "powerPlayToi" = excluded."powerPlayToi",
    "shorthandedToi" = excluded."shorthandedToi";

  insert into public."goaliesGameStats" (
    "playerId", "gameId", position, "evenStrengthShotsAgainst",
    "powerPlayShotsAgainst", "shorthandedShotsAgainst", "saveShotsAgainst",
    "evenStrengthGoalsAgainst", "powerPlayGoalsAgainst",
    "shorthandedGoalsAgainst", pim, "goalsAgainst", toi, "savePctg"
  )
  select
    incoming."playerId", incoming."gameId", incoming.position,
    incoming."evenStrengthShotsAgainst", incoming."powerPlayShotsAgainst",
    incoming."shorthandedShotsAgainst", incoming."saveShotsAgainst",
    incoming."evenStrengthGoalsAgainst", incoming."powerPlayGoalsAgainst",
    incoming."shorthandedGoalsAgainst", incoming.pim,
    incoming."goalsAgainst", incoming.toi, incoming."savePctg"
  from pg_catalog.jsonb_to_recordset(p_goalie_rows) as incoming(
    "playerId" bigint, "gameId" bigint, position public."NHL_Position_Code",
    "evenStrengthShotsAgainst" text, "powerPlayShotsAgainst" text,
    "shorthandedShotsAgainst" text, "saveShotsAgainst" text,
    "evenStrengthGoalsAgainst" smallint, "powerPlayGoalsAgainst" smallint,
    "shorthandedGoalsAgainst" smallint, pim smallint,
    "goalsAgainst" smallint, toi text, "savePctg" real
  )
  on conflict ("playerId", "gameId") do update set
    position = excluded.position,
    "evenStrengthShotsAgainst" = excluded."evenStrengthShotsAgainst",
    "powerPlayShotsAgainst" = excluded."powerPlayShotsAgainst",
    "shorthandedShotsAgainst" = excluded."shorthandedShotsAgainst",
    "saveShotsAgainst" = excluded."saveShotsAgainst",
    "evenStrengthGoalsAgainst" = excluded."evenStrengthGoalsAgainst",
    "powerPlayGoalsAgainst" = excluded."powerPlayGoalsAgainst",
    "shorthandedGoalsAgainst" = excluded."shorthandedGoalsAgainst",
    pim = excluded.pim,
    "goalsAgainst" = excluded."goalsAgainst",
    toi = excluded.toi,
    "savePctg" = excluded."savePctg";

  delete from public."teamGameStats" as existing
  where existing."gameId" = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_team_rows)
        as incoming("teamId" smallint)
      where incoming."teamId" = existing."teamId"
    );
  get diagnostics v_pruned_team_count = row_count;

  delete from public."skatersGameStats" as existing
  where existing."gameId" = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_skater_rows)
        as incoming("playerId" bigint)
      where incoming."playerId" = existing."playerId"
    );
  get diagnostics v_pruned_skater_count = row_count;

  delete from public."goaliesGameStats" as existing
  where existing."gameId" = p_game_id
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_goalie_rows)
        as incoming("playerId" bigint)
      where incoming."playerId" = existing."playerId"
    );
  get diagnostics v_pruned_goalie_count = row_count;

  select pg_catalog.count(*)::integer
  into v_observed_team_count
  from public."teamGameStats"
  where "gameId" = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_skater_count
  from public."skatersGameStats"
  where "gameId" = p_game_id;

  select pg_catalog.count(*)::integer
  into v_observed_goalie_count
  from public."goaliesGameStats"
  where "gameId" = p_game_id;

  if v_observed_team_count <> p_expected_team_rows
    or v_observed_skater_count <> p_expected_skater_rows
    or v_observed_goalie_count <> p_expected_goalie_rows
  then
    raise exception using message = 'GAME_STATS_CARDINALITY_MISMATCH';
  end if;

  insert into public."statsUpdateStatus" (
    "gameId", updated, outcome, reason, contract_version,
    expected_team_rows, observed_team_rows,
    expected_skater_rows, observed_skater_rows,
    expected_goalie_rows, observed_goalie_rows, completed_at
  ) values (
    p_game_id, true, 'complete', null, 1,
    p_expected_team_rows, v_observed_team_count,
    p_expected_skater_rows, v_observed_skater_count,
    p_expected_goalie_rows, v_observed_goalie_count, v_completed_at
  )
  on conflict ("gameId") do update set
    updated = excluded.updated,
    outcome = excluded.outcome,
    reason = excluded.reason,
    contract_version = excluded.contract_version,
    expected_team_rows = excluded.expected_team_rows,
    observed_team_rows = excluded.observed_team_rows,
    expected_skater_rows = excluded.expected_skater_rows,
    observed_skater_rows = excluded.observed_skater_rows,
    expected_goalie_rows = excluded.expected_goalie_rows,
    observed_goalie_rows = excluded.observed_goalie_rows,
    completed_at = excluded.completed_at;

  return query select
    p_game_id,
    'complete'::text,
    1::smallint,
    p_expected_team_rows,
    v_observed_team_count,
    p_expected_skater_rows,
    v_observed_skater_count,
    p_expected_goalie_rows,
    v_observed_goalie_count,
    v_pruned_team_count,
    v_pruned_skater_count,
    v_pruned_goalie_count,
    v_completed_at;
end;
$$;

revoke all on function public.persist_complete_game_stats_v1(
  bigint, jsonb, jsonb, jsonb, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.persist_complete_game_stats_v1(
  bigint, jsonb, jsonb, jsonb, integer, integer, integer
) to service_role;

create or replace function public.quarantine_game_stats_v1(
  p_game_ids bigint[],
  p_reason text
)
returns table (
  game_id bigint,
  outcome text,
  reason text,
  contract_version smallint,
  expected_team_rows integer,
  observed_team_rows integer,
  expected_skater_rows integer,
  observed_skater_rows integer,
  expected_goalie_rows integer,
  observed_goalie_rows integer,
  completed_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_ids bigint[];
  v_game_id bigint;
  v_game_count integer;
  v_status_count integer;
  v_completed_at timestamp with time zone := pg_catalog.transaction_timestamp();
begin
  if p_reason is distinct from 'game_not_finished' then
    raise exception using message = 'INVALID_GAME_STATS_QUARANTINE_REASON';
  end if;

  if p_game_ids is null
    or pg_catalog.cardinality(p_game_ids) not between 1 and 10
    or exists (
      select 1
      from pg_catalog.unnest(p_game_ids) as requested(game_id)
      where requested.game_id is null or requested.game_id <= 0
    )
  then
    raise exception using message = 'INVALID_GAME_STATS_QUARANTINE_IDS';
  end if;

  select pg_catalog.array_agg(requested.game_id order by requested.game_id)
  into v_game_ids
  from (
    select distinct requested.game_id
    from pg_catalog.unnest(p_game_ids) as requested(game_id)
  ) as requested;

  if pg_catalog.cardinality(v_game_ids) <> pg_catalog.cardinality(p_game_ids) then
    raise exception using message = 'DUPLICATE_GAME_STATS_QUARANTINE_IDS';
  end if;

  foreach v_game_id in array v_game_ids loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('fhfh:game-stats:' || v_game_id::text, 0)
    );
  end loop;

  select pg_catalog.count(*)::integer
  into v_game_count
  from public.games
  where id = any(v_game_ids)
    and date < (current_date - 30);

  if v_game_count <> pg_catalog.cardinality(v_game_ids) then
    raise exception using message = 'GAME_STATS_QUARANTINE_GAME_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1 from public."teamGameStats" where "gameId" = any(v_game_ids)
    union all
    select 1 from public."skatersGameStats" where "gameId" = any(v_game_ids)
    union all
    select 1 from public."goaliesGameStats" where "gameId" = any(v_game_ids)
  ) then
    raise exception using message = 'GAME_STATS_QUARANTINE_PARTIAL_DATA_PRESENT';
  end if;

  update public."statsUpdateStatus" as status
  set
    updated = true,
    outcome = 'quarantined',
    reason = p_reason,
    contract_version = 1,
    expected_team_rows = 0,
    observed_team_rows = 0,
    expected_skater_rows = 0,
    observed_skater_rows = 0,
    expected_goalie_rows = 0,
    observed_goalie_rows = 0,
    completed_at = v_completed_at
  from pg_catalog.unnest(v_game_ids) as requested(game_id)
  where status."gameId" = requested.game_id
    and status.updated = false
    and status.outcome = 'pending'
    and status.reason is null
    and status.contract_version = 1
    and status.expected_team_rows is null
    and status.observed_team_rows is null
    and status.expected_skater_rows is null
    and status.observed_skater_rows is null
    and status.expected_goalie_rows is null
    and status.observed_goalie_rows is null
    and status.completed_at is null;
  get diagnostics v_status_count = row_count;

  if v_status_count <> pg_catalog.cardinality(v_game_ids) then
    raise exception using message = 'GAME_STATS_QUARANTINE_STATUS_NOT_PENDING';
  end if;

  return query
  select
    requested.game_id,
    'quarantined'::text,
    p_reason,
    1::smallint,
    0, 0, 0, 0, 0, 0,
    v_completed_at
  from pg_catalog.unnest(v_game_ids) as requested(game_id)
  order by requested.game_id;
end;
$$;

revoke all on function public.quarantine_game_stats_v1(bigint[], text)
  from public, anon, authenticated;
grant execute on function public.quarantine_game_stats_v1(bigint[], text)
  to service_role;

create or replace function public.get_unupdated_games()
returns table(gameid bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select games.id
  from public.games
  join public."statsUpdateStatus" as status
    on status."gameId" = games.id
  where status.outcome = 'pending'
    and status.updated = false
    and status.contract_version = 1
    and games."startTime" < current_date
  order by games.date desc, games.id desc
$$;

revoke all on function public.get_unupdated_games()
  from public, anon, authenticated;
grant execute on function public.get_unupdated_games()
  to service_role;

reset lock_timeout;
reset statement_timeout;

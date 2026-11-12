-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D7 forward slot; decision 86 PP deployment share).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
-- The nightly lineup-deployment cron (391) then rewrites the tallies with this function; nothing else runs.
--
-- 1. Forward slot. The tallies labelled each forward by his current roster position, so two centres on
--    one line were both "C" (and the LW or RW cell lost a game), and forwards whose roster position is not
--    L/C/R were dropped. The slot now follows the line card: each stored line is ordered L, C, R by position
--    (ties and other positions keep their stored order) and the three places are LW, C, RW, one player each.
-- 2. PP share, decision 86: both measures, each with its own denominator and coverage.
--    share (existing, PP rows) = games on that unit / games with a recorded PP-unit assignment.
--    share_of_dressed (new)    = games on that unit / dressed games whose team has recorded PP units.
--    pp_record_coverage (new)  = dressed games with recorded team PP units / dressed games.
--    Dressed games without a recorded team PP unit are unknown, never counted as non-PP games.
--    New columns are NULL on forward and defense rows. Players with no PP-unit game have no PP rows
--    (as before); a reader must not read their absence as a confirmed 0.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.player_lineup_deployment_tallies
  add column if not exists dressed_games integer,
  add column if not exists dressed_games_pp_recorded integer,
  add column if not exists share_of_dressed numeric(7,4),
  add column if not exists pp_record_coverage numeric(7,4);

CREATE OR REPLACE FUNCTION public.refresh_player_lineup_deployment_tallies(p_season_id integer DEFAULT NULL::integer, p_player_id bigint DEFAULT NULL::bigint) RETURNS TABLE(deleted_rows integer, inserted_rows integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_deleted_rows integer := 0;
  v_inserted_rows integer := 0;
begin
  delete from public.player_lineup_deployment_tallies t
  where (p_season_id is null or t.season_id = p_season_id)
    and (p_player_id is null or t.player_id = p_player_id);

  get diagnostics v_deleted_rows = row_count;

  insert into public.player_lineup_deployment_tallies (
    player_id,
    season_id,
    game_type,
    deployment_group,
    deployment_code,
    deployment_label,
    line_number,
    slot_number,
    slot_label,
    unit_number,
    games,
    total_games,
    share,
    team_ids,
    first_game_date,
    last_game_date,
    source_table,
    dressed_games,
    dressed_games_pp_recorded,
    share_of_dressed,
    pp_record_coverage,
    updated_at
  )
  with forward_raw as (
    -- Whole lines of every game the player dressed in: the slot depends on the linemates.
    select distinct
      f.player_id::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      lc."gameId"::bigint as game_id,
      g.date::date as game_date,
      lc."teamId"::integer as team_id,
      (floor((f.ordinality - 1) / 3)::integer + 1) as line_number,
      f.ordinality,
      case
        when upper(p.position::text) in ('LW', 'L') then 1
        when upper(p.position::text) = 'C' then 2
        when upper(p.position::text) in ('RW', 'R') then 3
        else 4
      end as position_rank
    from public."lineCombinations" lc
    join public.games g on g.id = lc."gameId"
    cross join lateral unnest(lc.forwards) with ordinality as f(player_id, ordinality)
    left join public.players p on p.id = f.player_id
    where f.ordinality <= 12
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or p_player_id = any(lc.forwards))
  ),
  forward_source as (
    -- Line-card slot: each line is ordered L, C, R by position (ties and other positions keep their
    -- stored order), then the three places are LW, C, RW, so every slot is held by exactly one player.
    select distinct
      player_id,
      season_id,
      game_type,
      game_id,
      game_date,
      team_id,
      line_number,
      (array['LW', 'C', 'RW'])[row_number() over (
        partition by game_id, team_id, line_number order by position_rank, ordinality
      )] as slot_label
    from forward_raw
  ),
  forward_counts as (
    select
      player_id,
      season_id,
      game_type,
      'forward'::text as deployment_group,
      ('F' || line_number::text || '_' || slot_label)::text as deployment_code,
      ('Forward Line ' || line_number::text || ' ' || slot_label)::text as deployment_label,
      line_number,
      case slot_label when 'LW' then 1 when 'C' then 2 when 'RW' then 3 end as slot_number,
      slot_label,
      null::integer as unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'lineCombinations'::text as source_table
    from forward_source
    where slot_label in ('LW', 'C', 'RW')
      and (p_player_id is null or player_id = p_player_id)
    group by player_id, season_id, game_type, line_number, slot_label
  ),
  defense_source as (
    select distinct
      d.player_id::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      lc."gameId"::bigint as game_id,
      g.date::date as game_date,
      lc."teamId"::integer as team_id,
      (floor((d.ordinality - 1) / 2)::integer + 1) as line_number,
      case ((d.ordinality - 1) % 2)
        when 0 then 'LD'
        else 'RD'
      end as slot_label
    from public."lineCombinations" lc
    join public.games g on g.id = lc."gameId"
    cross join lateral unnest(lc.defensemen) with ordinality as d(player_id, ordinality)
    where d.ordinality <= 6
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or d.player_id::bigint = p_player_id)
  ),
  defense_counts as (
    select
      player_id,
      season_id,
      game_type,
      'defense'::text as deployment_group,
      ('D' || line_number::text || '_' || slot_label)::text as deployment_code,
      ('Defense Pair ' || line_number::text || ' ' || slot_label)::text as deployment_label,
      line_number,
      case slot_label when 'LD' then 1 when 'RD' then 2 end as slot_number,
      slot_label,
      null::integer as unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'lineCombinations'::text as source_table
    from defense_source
    where line_number between 1 and 3
    group by player_id, season_id, game_type, line_number, slot_label
  ),
  power_play_source as (
    select distinct on (pp."playerId", g."seasonId", g.type, pp."gameId")
      pp."playerId"::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      pp."gameId"::bigint as game_id,
      g.date::date as game_date,
      case
        when g."homeTeamId" = lc."teamId" or g."awayTeamId" = lc."teamId"
          then lc."teamId"::integer
        else null
      end as team_id,
      pp.unit::integer as unit_number
    from public."powerPlayCombinations" pp
    join public.games g on g.id = pp."gameId"
    left join public."lineCombinations" lc
      on lc."gameId" = pp."gameId"
     and pp."playerId" = any(lc.forwards || lc.defensemen)
    where pp.unit in (1, 2)
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or pp."playerId"::bigint = p_player_id)
    order by pp."playerId", g."seasonId", g.type, pp."gameId", pp.unit
  ),
  power_play_counts as (
    select
      player_id,
      season_id,
      game_type,
      'power_play'::text as deployment_group,
      ('PP' || unit_number::text)::text as deployment_code,
      ('Power Play ' || unit_number::text)::text as deployment_label,
      null::integer as line_number,
      unit_number as slot_number,
      ('PP' || unit_number::text)::text as slot_label,
      unit_number,
      count(distinct game_id)::integer as games,
      array_remove(array_agg(distinct team_id order by team_id), null)::integer[] as team_ids,
      min(game_date) as first_game_date,
      max(game_date) as last_game_date,
      'powerPlayCombinations'::text as source_table
    from power_play_source
    group by player_id, season_id, game_type, unit_number
  ),
  dressed as (
    select distinct
      s.player_id::bigint as player_id,
      g."seasonId"::integer as season_id,
      g.type::integer as game_type,
      lc."gameId"::bigint as game_id,
      lc."teamId"::integer as team_id
    from public."lineCombinations" lc
    join public.games g on g.id = lc."gameId"
    cross join lateral unnest(lc.forwards || lc.defensemen) as s(player_id)
    where g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
      and (p_player_id is null or s.player_id::bigint = p_player_id)
  ),
  team_pp_recorded as (
    -- A team's PP units are recorded for a game when any of its dressed players has a PP-unit row.
    select distinct lc."gameId"::bigint as game_id, lc."teamId"::integer as team_id
    from public."powerPlayCombinations" pp
    join public.games g on g.id = pp."gameId"
    join public."lineCombinations" lc
      on lc."gameId" = pp."gameId"
     and pp."playerId" = any(lc.forwards || lc.defensemen)
    where pp.unit in (1, 2)
      and g.type in (2, 3)
      and (p_season_id is null or g."seasonId"::integer = p_season_id)
  ),
  dressed_totals as (
    select
      d.player_id,
      d.season_id,
      d.game_type,
      count(distinct d.game_id)::integer as dressed_games,
      (count(distinct d.game_id) filter (where r.game_id is not null))::integer as dressed_games_pp_recorded
    from dressed d
    left join team_pp_recorded r on r.game_id = d.game_id and r.team_id = d.team_id
    group by d.player_id, d.season_id, d.game_type
  ),
  pp_dressed_games as (
    select ps.player_id, ps.season_id, ps.game_type, ps.unit_number,
      count(distinct ps.game_id)::integer as games_dressed_recorded
    from power_play_source ps
    join dressed d on d.player_id = ps.player_id and d.game_id = ps.game_id
    join team_pp_recorded r on r.game_id = d.game_id and r.team_id = d.team_id
    group by ps.player_id, ps.season_id, ps.game_type, ps.unit_number
  ),
  combined_counts as (
    select * from forward_counts
    union all
    select * from defense_counts
    union all
    select * from power_play_counts
  ),
  with_totals as (
    select
      c.*,
      sum(c.games) over (
        partition by c.player_id, c.season_id, c.game_type, c.deployment_group
      )::integer as total_games
    from combined_counts c
  )
  select
    w.player_id,
    w.season_id,
    w.game_type,
    w.deployment_group,
    w.deployment_code,
    w.deployment_label,
    w.line_number,
    w.slot_number,
    w.slot_label,
    w.unit_number,
    w.games,
    w.total_games,
    round((w.games::numeric / nullif(w.total_games, 0)::numeric), 4) as share,
    w.team_ids,
    w.first_game_date,
    w.last_game_date,
    w.source_table,
    case when w.deployment_group = 'power_play' then dt.dressed_games end as dressed_games,
    case when w.deployment_group = 'power_play' then dt.dressed_games_pp_recorded end as dressed_games_pp_recorded,
    case when w.deployment_group = 'power_play' then
      round((coalesce(pd.games_dressed_recorded, 0)::numeric / nullif(dt.dressed_games_pp_recorded, 0)::numeric), 4)
    end as share_of_dressed,
    case when w.deployment_group = 'power_play' then
      round((dt.dressed_games_pp_recorded::numeric / nullif(dt.dressed_games, 0)::numeric), 4)
    end as pp_record_coverage,
    now() as updated_at
  from with_totals w
  left join dressed_totals dt
    on dt.player_id = w.player_id and dt.season_id = w.season_id and dt.game_type = w.game_type
  left join pp_dressed_games pd
    on pd.player_id = w.player_id and pd.season_id = w.season_id and pd.game_type = w.game_type
   and pd.unit_number = w.unit_number
  where w.total_games > 0;

  get diagnostics v_inserted_rows = row_count;

  return query select v_deleted_rows, v_inserted_rows;
end;
$$;

comment on column public.player_lineup_deployment_tallies.share is
  'Cell share within the player/season/game_type/deployment_group denominator. PP rows: share of games with a recorded PP-unit assignment (PP1 + PP2 games).';
comment on column public.player_lineup_deployment_tallies.share_of_dressed is
  'PP rows only: games on this unit / dressed games whose team has recorded PP units (decision 86). NULL when no such game.';
comment on column public.player_lineup_deployment_tallies.pp_record_coverage is
  'PP rows only: dressed games with recorded team PP units / dressed games. Uncovered games are unknown, not non-PP.';
comment on column public.player_lineup_deployment_tallies.dressed_games is
  'PP rows only: regular/playoff games (per game_type) the player appears in lineCombinations.';
comment on column public.player_lineup_deployment_tallies.dressed_games_pp_recorded is
  'PP rows only: dressed games whose team has at least one recorded PP-unit row.';

commit;

-- READBACK (bounded, one player):
-- select deployment_code, games, total_games, share, dressed_games, dressed_games_pp_recorded, share_of_dressed,
--        pp_record_coverage from public.player_lineup_deployment_tallies
--  where player_id = 8478402 and season_id = 20252026 and game_type = 2 order by deployment_group, deployment_code;
-- ROLLBACK: supabase/tests/l4a_lineup_deployment_rollback.sql (restores the baseline function; the four
--   added columns are left in place, NULL-able and unread, until a separate cleanup decision, rule 6).

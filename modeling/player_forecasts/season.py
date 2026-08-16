from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
from statistics import median
from typing import Any, Iterable
from urllib.request import Request, urlopen

from .contract import SEASON_CONTRACT_SHA256, SEASON_CONTRACT_VERSION
from .database import readonly_connection, stream_query
from .io import canonical_json, read_json, read_jsonl, write_json, write_jsonl

SEASON_ID = 20262027
TRAINING_CUTOFF_SEASON = 20252026
SKATER_TARGETS = (
    "GAMES_PLAYED", "TOTAL_TOI", "EV_TOI", "PP_TOI", "PK_TOI", "GOALS",
    "PRIMARY_ASSISTS", "SECONDARY_ASSISTS", "PLUS_MINUS", "SHOTS_ON_GOAL",
    "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "PP_GOALS", "PP_ASSISTS",
    "SH_GOALS", "SH_ASSISTS", "FACEOFFS_WON", "FACEOFFS_LOST",
)
GOALIE_TARGETS = (
    "GAMES_PLAYED", "GAMES_STARTED", "TOTAL_TOI", "WINS_GOALIE",
    "LOSSES_GOALIE", "OTL_GOALIE", "SHOTS_AGAINST_GOALIE",
    "GOALS_AGAINST_GOALIE", "SHUTOUTS_GOALIE",
)
NONNEGATIVE_TARGETS = set(SKATER_TARGETS + GOALIE_TARGETS) - {"PLUS_MINUS"}
DECAY_CANDIDATES = (0.5, 0.7, 0.85, 1.0)
SHRINK_CANDIDATES = (5.0, 10.0, 20.0, 40.0)
VALIDATION_FOLDS = (
    ("2025-11-01", "2025-12-15"),
    ("2025-12-16", "2026-02-15"),
    ("2026-02-16", "2026-04-16"),
)

TEAM_QUERY = """
select team.id::integer as team_id, btrim(team.abbreviation::text) as abbreviation, team.name
from public.teams team
join public.team_season membership on membership."teamId" = team.id
where membership."seasonId" = 20252026
order by team.id
"""

IDENTITY_QUERY = """
select id as fhfh_player_id, nhl_player_id, canonical_name,
       canonical_position::text as position, current_nhl_team_id::integer as team_id,
       lifecycle_status, verification_status, source_provenance
from public.fhfh_player_identities
where lifecycle_status in ('active_nhl', 'active_prospect', 'unsigned_relevant')
  and verification_status in ('verified', 'provisional')
order by id
"""

GAME_QUERY = """
select id as game_id, date::text as game_date, "seasonId" as season_id,
       "startTime"::text as start_time, "homeTeamId"::integer as home_team_id,
       "awayTeamId"::integer as away_team_id
from public.games
where "seasonId" = any(%s) and type = 2
order by date, id
"""

DEFENSE_HISTORY_QUERY = """
with player_shifts as (
  select shift.game_id, shift.season_id, shift.game_date::text as game_date,
         shift.player_id as nhl_player_id, shift.team_id::integer as team_id,
         player.position::text as position,
         sum(shift.duration_seconds)::double precision as toi_seconds
  from public.nhl_api_shift_rows shift
  join public.players player on player.id = shift.player_id and player.position <> 'G'
  where shift.season_id = any(%s) and shift.duration_seconds > 0
  group by shift.game_id, shift.season_id, shift.game_date, shift.player_id,
           shift.team_id, player.position
), exposures as (
  select shift.game_id, shift.player_id as nhl_player_id,
         count(distinct event.event_id) filter (where event.is_shot_like)::double precision as chances_against,
         count(distinct event.event_id) filter (where event.is_goal)::double precision as goals_against
  from public.nhl_api_shift_rows shift
  join public.nhl_api_pbp_events event
    on event.game_id = shift.game_id
   and event.period_number = shift.period
   and event.period_seconds_elapsed >= shift.start_seconds
   and event.period_seconds_elapsed < shift.end_seconds
   and event.event_owner_team_id is not null
   and event.event_owner_team_id is distinct from shift.team_id
  where shift.season_id = any(%s) and shift.duration_seconds > 0
  group by shift.game_id, shift.player_id
), game_teams as (
  select game.id as game_id, game."homeTeamId"::integer as team_id,
         game."awayTeamId"::integer as opponent_team_id
  from public.games game where game."seasonId" = any(%s) and game.type = 2
  union all
  select game.id, game."awayTeamId"::integer, game."homeTeamId"::integer
  from public.games game where game."seasonId" = any(%s) and game.type = 2
), team_against as (
  select teams.game_id, teams.team_id,
         count(event.event_id) filter (where event.is_shot_like)::double precision as team_chances_against,
         count(event.event_id) filter (where event.is_goal)::double precision as team_goals_against
  from game_teams teams
  left join public.nhl_api_pbp_events event
    on event.game_id = teams.game_id
   and event.event_owner_team_id is not null
   and event.event_owner_team_id is distinct from teams.team_id
  group by teams.game_id, teams.team_id
)
select shift.game_date, shift.season_id, shift.game_id, shift.nhl_player_id,
       shift.team_id, teams.opponent_team_id, shift.position, shift.toi_seconds,
       coalesce(exposure.chances_against, 0) as chances_against,
       coalesce(exposure.goals_against, 0) as goals_against,
       coalesce(team.team_chances_against, 0) as team_chances_against,
       coalesce(team.team_goals_against, 0) as team_goals_against
from player_shifts shift
join game_teams teams on teams.game_id = shift.game_id and teams.team_id = shift.team_id
left join exposures exposure on exposure.game_id = shift.game_id and exposure.nhl_player_id = shift.nhl_player_id
left join team_against team on team.game_id = shift.game_id and team.team_id = shift.team_id
order by shift.game_date, shift.game_id, shift.nhl_player_id
"""

SKATER_QUERY = """
with training_games as (
  select id, date, "seasonId", type
  from public.games
  where "seasonId" = any(%s) and type = 2
), shift_teams as (
  select shift.game_id, shift.player_id, min(shift.team_id)::integer as team_id
  from public.nhl_api_shift_rows shift
  join training_games game on game.id = shift.game_id
  group by shift.game_id, shift.player_id
), raw_availability as (
  select raw.game_id, max(raw.fetched_at) as source_available_at
  from public.nhl_api_game_payloads_raw raw
  join training_games game on game.id = raw.game_id
  where raw.endpoint in ('boxscore', 'play-by-play')
  group by raw.game_id
), boxscore_games as (
  select stats."gameId" as game_id, sum(stats.goals)::integer as goal_count
  from public."skatersGameStats" stats
  join training_games game on game.id = stats."gameId"
  group by stats."gameId"
), pbp_games as (
  select event.game_id,
         count(distinct event.event_id) filter (where event.is_goal)::integer as goal_count,
         max(event.created_at) as source_available_at
  from public.nhl_api_pbp_events event
  join training_games game on game.id = event.game_id
  group by event.game_id
), pbp as (
  select event.game_id, event.scoring_player_id as player_id,
         count(*) filter (where event.is_goal)::integer as goals_pbp,
         count(*) filter (where event.is_goal and event.strength_state = 'PP')::integer as pp_goals,
         count(*) filter (where event.is_goal and event.strength_state = 'SH')::integer as sh_goals,
         max(event.created_at) as source_available_at
  from public.nhl_api_pbp_events event
  join training_games game on game.id = event.game_id
  where event.scoring_player_id is not null
  group by event.game_id, event.scoring_player_id
), primary_assists as (
  select event.game_id, event.assist1_player_id as player_id,
         count(*)::integer as primary_assists,
         count(*) filter (where event.strength_state = 'PP')::integer as pp_primary_assists,
         count(*) filter (where event.strength_state = 'SH')::integer as sh_primary_assists,
         max(event.created_at) as source_available_at
  from public.nhl_api_pbp_events event
  join training_games game on game.id = event.game_id
  where event.is_goal and event.assist1_player_id is not null
  group by event.game_id, event.assist1_player_id
), secondary_assists as (
  select event.game_id, event.assist2_player_id as player_id,
         count(*)::integer as secondary_assists,
         count(*) filter (where event.strength_state = 'PP')::integer as pp_secondary_assists,
         count(*) filter (where event.strength_state = 'SH')::integer as sh_secondary_assists,
         max(event.created_at) as source_available_at
  from public.nhl_api_pbp_events event
  join training_games game on game.id = event.game_id
  where event.is_goal and event.assist2_player_id is not null
  group by event.game_id, event.assist2_player_id
), source_rows as (
  select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
         s."playerId" as nhl_player_id, s.position::text as position, st.team_id,
         greatest(
           s.created_at,
           coalesce(pbp.source_available_at, s.created_at),
           coalesce(pa.source_available_at, s.created_at),
           coalesce(sa.source_available_at, s.created_at),
           coalesce(pbp_game.source_available_at, s.created_at),
           coalesce(raw.source_available_at, s.created_at)
         )::text as source_available_at,
         s.toi, s."powerPlayToi", s."shorthandedToi", s.goals,
         s.assists as boxscore_assists, s."plusMinus", s.shots, s.hits,
         s."blockedShots", s.pim, s.faceoffs,
         coalesce(pbp.pp_goals, 0)::integer as pbp_pp_goals,
         coalesce(pbp.sh_goals, 0)::integer as pbp_sh_goals,
         coalesce(pa.primary_assists, 0)::integer as pbp_primary_assists,
         coalesce(sa.secondary_assists, 0)::integer as pbp_secondary_assists,
         coalesce(pa.pp_primary_assists, 0)::integer
           + coalesce(sa.pp_secondary_assists, 0)::integer as pbp_pp_assists,
         coalesce(pa.sh_primary_assists, 0)::integer
           + coalesce(sa.sh_secondary_assists, 0)::integer as pbp_sh_assists,
         (
           pbp_game.game_id is not null
           and pbp_game.goal_count = boxscore_game.goal_count
         ) as pbp_complete,
         wgo.id as wgo_row_id, wgo.assists as wgo_assists,
         wgo.total_primary_assists as wgo_primary_assists,
         wgo.total_secondary_assists as wgo_secondary_assists,
         coalesce(wgo.pp_goals, 0) as wgo_pp_goals,
         coalesce(wgo.pp_primary_assists, 0)
           + coalesce(wgo.pp_secondary_assists, 0) as wgo_pp_assists,
         coalesce(wgo.sh_goals, 0) as wgo_sh_goals,
         coalesce(wgo.sh_primary_assists, 0)
           + coalesce(wgo.sh_secondary_assists, 0) as wgo_sh_assists
  from public."skatersGameStats" s
  join training_games g on g.id = s."gameId"
  left join shift_teams st on st.game_id = g.id and st.player_id = s."playerId"
  left join boxscore_games boxscore_game on boxscore_game.game_id = g.id
  left join pbp_games pbp_game on pbp_game.game_id = g.id
  left join pbp on pbp.game_id = g.id and pbp.player_id = s."playerId"
  left join primary_assists pa on pa.game_id = g.id and pa.player_id = s."playerId"
  left join secondary_assists sa on sa.game_id = g.id and sa.player_id = s."playerId"
  left join raw_availability raw on raw.game_id = g.id
  left join public.wgo_skater_stats wgo
    on wgo.player_id = s."playerId" and wgo.date = g.date
), classified as (
  select source_rows.*,
         (
           pbp_complete
           and wgo_row_id is not null
           and wgo_assists = wgo_primary_assists + wgo_secondary_assists
           and (
             pbp_primary_assists, pbp_secondary_assists,
             pbp_pp_assists, pbp_sh_assists, pbp_pp_goals, pbp_sh_goals
           ) is distinct from (
             wgo_primary_assists, wgo_secondary_assists,
             wgo_pp_assists, wgo_sh_assists, wgo_pp_goals, wgo_sh_goals
           )
         ) as source_conflict
  from source_rows
), resolved as (
  select classified.*,
         case
           when source_conflict then null
           when pbp_complete then pbp_primary_assists
           when wgo_row_id is not null
             and wgo_assists = wgo_primary_assists + wgo_secondary_assists
             then wgo_primary_assists
           when boxscore_assists = 0 then 0
           else null
         end::double precision as resolved_primary_assists,
         case
           when source_conflict then null
           when pbp_complete then pbp_secondary_assists
           when wgo_row_id is not null
             and wgo_assists = wgo_primary_assists + wgo_secondary_assists
             then wgo_secondary_assists
           when boxscore_assists = 0 then 0
           else null
         end::double precision as resolved_secondary_assists,
         case
           when source_conflict then null
           when pbp_complete then pbp_pp_assists
           when wgo_row_id is not null
             and wgo_assists = wgo_primary_assists + wgo_secondary_assists
             then wgo_pp_assists
           when boxscore_assists = 0 then 0
           else null
         end::double precision as resolved_pp_assists,
         case
           when source_conflict then null
           when pbp_complete then pbp_sh_assists
           when wgo_row_id is not null
             and wgo_assists = wgo_primary_assists + wgo_secondary_assists
             then wgo_sh_assists
           when boxscore_assists = 0 then 0
           else null
         end::double precision as resolved_sh_assists,
         case
           when source_conflict then 'source_conflict'
           when pbp_complete then 'normalized_play_by_play'
           when wgo_row_id is not null
             and wgo_assists = wgo_primary_assists + wgo_secondary_assists
             then 'wgo_frozen_settled_outcome'
           when boxscore_assists = 0 then 'official_boxscore_zero'
           else 'unresolved'
         end as assist_label_source
  from classified
)
select game_date, season_id, game_id, nhl_player_id, position, team_id,
       source_available_at,
       1::integer as "GAMES_PLAYED",
       (
         split_part(toi, ':', 1)::integer * 60
         + split_part(toi, ':', 2)::integer
       )::double precision as "TOTAL_TOI",
       greatest(0,
         split_part(toi, ':', 1)::integer * 60 + split_part(toi, ':', 2)::integer
         - split_part("powerPlayToi", ':', 1)::integer * 60 - split_part("powerPlayToi", ':', 2)::integer
         - split_part("shorthandedToi", ':', 1)::integer * 60 - split_part("shorthandedToi", ':', 2)::integer
       )::double precision as "EV_TOI",
       (
         split_part("powerPlayToi", ':', 1)::integer * 60
         + split_part("powerPlayToi", ':', 2)::integer
       )::double precision as "PP_TOI",
       (
         split_part("shorthandedToi", ':', 1)::integer * 60
         + split_part("shorthandedToi", ':', 2)::integer
       )::double precision as "PK_TOI",
       goals::double precision as "GOALS",
       resolved_primary_assists as "PRIMARY_ASSISTS",
       resolved_secondary_assists as "SECONDARY_ASSISTS",
       (resolved_primary_assists + resolved_secondary_assists)::double precision
         as "ASSIST_LABEL_ASSISTS",
       boxscore_assists::double precision as "BOX_SCORE_ASSISTS",
       (
         resolved_primary_assists + resolved_secondary_assists - boxscore_assists
       )::double precision as "ASSIST_LABEL_BOX_SCORE_DELTA",
       assist_label_source as "ASSIST_LABEL_SOURCE",
       "plusMinus"::double precision as "PLUS_MINUS",
       shots::double precision as "SHOTS_ON_GOAL",
       hits::double precision as "HITS",
       "blockedShots"::double precision as "BLOCKED_SHOTS",
       pim::double precision as "PENALTY_MINUTES",
       case
         when source_conflict then null
         when pbp_complete then pbp_pp_goals
         when wgo_row_id is not null then wgo_pp_goals
         else 0
       end::double precision as "PP_GOALS",
       resolved_pp_assists as "PP_ASSISTS",
       case
         when source_conflict then null
         when pbp_complete then pbp_sh_goals
         when wgo_row_id is not null then wgo_sh_goals
         else 0
       end::double precision as "SH_GOALS",
       resolved_sh_assists as "SH_ASSISTS",
       case when faceoffs ~ '^[0-9]+/[0-9]+$'
         then split_part(faceoffs, '/', 1)::double precision else 0 end as "FACEOFFS_WON",
       case when faceoffs ~ '^[0-9]+/[0-9]+$'
         then greatest(0, split_part(faceoffs, '/', 2)::integer - split_part(faceoffs, '/', 1)::integer)::double precision
         else 0 end as "FACEOFFS_LOST"
from resolved
order by game_date, game_id, nhl_player_id
"""

GOALIE_QUERY = """
with shift_teams as (
  select game_id, player_id, min(team_id)::integer as team_id
  from public.nhl_api_shift_rows
  where season_id = any(%s)
  group by game_id, player_id
), raw_availability as (
  select game_id, max(fetched_at) as source_available_at
  from public.nhl_api_game_payloads_raw
  where season_id = any(%s) and endpoint in ('boxscore', 'play-by-play')
  group by game_id
), game_end as (
  select game_id,
         bool_or(period_type in ('OT', 'SO')) as ended_after_regulation,
         max(created_at) as source_available_at
  from public.nhl_api_pbp_events
  where season_id = any(%s)
  group by game_id
), goalie_rows as (
  select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
         s."playerId" as nhl_player_id, st.team_id,
         greatest(
           s.created_at,
           coalesce(ge.source_available_at, s.created_at),
           coalesce(raw.source_available_at, s.created_at)
         )::text
           as source_available_at,
         (split_part(s.toi, ':', 1)::integer * 60 + split_part(s.toi, ':', 2)::integer)::double precision as toi_seconds,
         coalesce(nullif(split_part(s."saveShotsAgainst", '/', 2), '')::integer, 0)::double precision as shots_against,
         s."goalsAgainst"::double precision as goals_against,
         outcome.outcome, coalesce(ge.ended_after_regulation, false) as ended_after_regulation,
         row_number() over (
           partition by g.id, st.team_id
           order by (split_part(s.toi, ':', 1)::integer * 60 + split_part(s.toi, ':', 2)::integer) desc,
                    s."playerId"
         ) as goalie_order
  from public."goaliesGameStats" s
  join public.games g on g.id = s."gameId"
  left join shift_teams st on st.game_id = g.id and st.player_id = s."playerId"
  left join public."gameOutcomes" outcome on outcome."gameId" = g.id and outcome."teamId" = st.team_id
  left join game_end ge on ge.game_id = g.id
  left join raw_availability raw on raw.game_id = g.id
  where g."seasonId" = any(%s) and g.type = 2
)
select game_date, season_id, game_id, nhl_player_id, 'G'::text as position, team_id,
       source_available_at,
       case when toi_seconds > 0 then 1 else 0 end::double precision as "GAMES_PLAYED",
       case when toi_seconds > 0 and goalie_order = 1 then 1 else 0 end::double precision as "GAMES_STARTED",
       toi_seconds as "TOTAL_TOI",
       case when outcome = 'WIN' and toi_seconds > 0 and goalie_order = 1 then 1 else 0 end::double precision as "WINS_GOALIE",
       case when outcome = 'LOSS' and not ended_after_regulation and toi_seconds > 0 and goalie_order = 1 then 1 else 0 end::double precision as "LOSSES_GOALIE",
       case when outcome = 'LOSS' and ended_after_regulation and toi_seconds > 0 and goalie_order = 1 then 1 else 0 end::double precision as "OTL_GOALIE",
       shots_against as "SHOTS_AGAINST_GOALIE",
       goals_against as "GOALS_AGAINST_GOALIE",
       case when goals_against = 0 and goalie_order = 1 and toi_seconds >= 3540 then 1 else 0 end::double precision as "SHUTOUTS_GOALIE"
from goalie_rows
where toi_seconds > 0
order by game_date, game_id, nhl_player_id
"""

TEAM_HISTORY_QUERY = """
select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
       own."teamId"::integer as team_id, opponent."teamId"::integer as opponent_team_id,
       own.score::double precision as goals_for, opponent.score::double precision as goals_against,
       own.sog::double precision as shots_for, opponent.sog::double precision as shots_against,
       case when own."powerPlay" ~ '^[0-9]+/[0-9]+$' then split_part(own."powerPlay", '/', 1)::double precision else 0 end as pp_goals,
       case when own."powerPlay" ~ '^[0-9]+/[0-9]+$' then split_part(own."powerPlay", '/', 2)::double precision else 0 end as pp_opportunities,
       case when opponent."powerPlay" ~ '^[0-9]+/[0-9]+$' then split_part(opponent."powerPlay", '/', 1)::double precision else 0 end as pk_goals_against,
       case when opponent."powerPlay" ~ '^[0-9]+/[0-9]+$' then split_part(opponent."powerPlay", '/', 2)::double precision else 0 end as pk_opportunities
from public."teamGameStats" own
join public."teamGameStats" opponent
  on opponent."gameId" = own."gameId" and opponent."teamId" <> own."teamId"
join public.games g on g.id = own."gameId"
where g."seasonId" = any(%s) and g.type = 2
order by g.date, g.id, own."teamId"
"""

DEPLOYMENT_TALLY_QUERY = """
select player_id as nhl_player_id, season_id, deployment_group,
       deployment_code, line_number, unit_number, games, total_games,
       share::double precision as share, team_ids, first_game_date::text,
       last_game_date::text, source_table, source_version
from public.player_lineup_deployment_tallies
where season_id = any(%s) and game_type = 2
order by season_id, player_id, deployment_group, deployment_code
"""

LINE_SNAPSHOT_QUERY = """
select * from (
  select 'line_source_snapshots'::text as source_table, capture_key,
         source, team_id::integer, greatest(observed_at, updated_at)::text as available_at,
         line_1_player_ids, line_2_player_ids, line_3_player_ids, line_4_player_ids,
         pair_1_player_ids, pair_2_player_ids, pair_3_player_ids,
         goalie_1_player_id, goalie_2_player_id,
         scratches_player_ids, injured_player_ids
  from public.line_source_snapshots
  where status = 'observed' and nhl_filter_status = 'accepted' and team_id is not null
  union all
  select 'lines_ccc', capture_key, source, team_id::integer,
         greatest(observed_at, updated_at)::text,
         line_1_player_ids, line_2_player_ids, line_3_player_ids, line_4_player_ids,
         pair_1_player_ids, pair_2_player_ids, pair_3_player_ids,
         goalie_1_player_id, goalie_2_player_id,
         scratches_player_ids, injured_player_ids
  from public.lines_ccc
  where status = 'observed' and nhl_filter_status = 'accepted' and team_id is not null
  union all
  select 'lines_nhl', capture_key, source, team_id::integer,
         greatest(observed_at, updated_at)::text,
         line_1_player_ids, line_2_player_ids, line_3_player_ids, line_4_player_ids,
         pair_1_player_ids, pair_2_player_ids, pair_3_player_ids,
         goalie_1_player_id, goalie_2_player_id,
         scratches_player_ids, injured_player_ids
  from public.lines_nhl
  where status = 'observed'
) snapshots
order by available_at, source_table, capture_key
"""


def _fetch_json_capture(url: str) -> tuple[dict[str, Any], str]:
    request = Request(url, headers={"User-Agent": "FHFH-player-forecasts/3.0"})
    with urlopen(request, timeout=45) as response:
        raw = response.read()
    return json.loads(raw.decode("utf-8")), hashlib.sha256(raw).hexdigest()


def _fetch_json(url: str) -> dict[str, Any]:
    payload, _ = _fetch_json_capture(url)
    return payload


def _default_text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("default") or value.get("en") or "")
    return str(value or "")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _official_game_status(game: dict[str, Any]) -> str:
    schedule_state = str(game.get("gameScheduleState") or "").upper()
    game_state = str(game.get("gameState") or "").upper()
    if schedule_state in {"PPD", "POSTPONED"}:
        return "postponed"
    if schedule_state in {"CNCL", "CANCELLED", "CANCELED"}:
        return "cancelled"
    if game_state in {"LIVE", "CRIT"}:
        return "started"
    if game_state in {"OFF", "FINAL"}:
        return "final"
    return "scheduled"


def _official_state(teams: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    games: dict[int, dict[str, Any]] = {}
    roster_rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for team in teams:
        abbreviation = str(team["abbreviation"])
        schedule = _fetch_json(
            f"https://api-web.nhle.com/v1/club-schedule-season/{abbreviation}/{SEASON_ID}"
        )
        team_games = [game for game in schedule.get("games", []) if int(game.get("gameType") or 0) == 2]
        if len(team_games) != 84:
            warnings.append(f"{abbreviation}: expected 84 games, found {len(team_games)}")
        for game in team_games:
            game_id = int(game["id"])
            schedule_row = {
                "game_id": game_id,
                "game_type": 2,
                "scheduled_start_at": game["startTimeUTC"],
                "home_team_id": int(game["homeTeam"]["id"]),
                "away_team_id": int(game["awayTeam"]["id"]),
                "game_status": _official_game_status(game),
            }
            schedule_row["source_revision_key"] = hashlib.sha256(
                canonical_json(schedule_row).encode()
            ).hexdigest()
            games[game_id] = schedule_row
        roster = _fetch_json(f"https://api-web.nhle.com/v1/roster/{abbreviation}/current")
        for group, position in (("forwards", None), ("defensemen", "D"), ("goalies", "G")):
            for player in roster.get(group, []):
                roster_rows.append(
                    {
                        "nhl_player_id": int(player["id"]),
                        "team_id": int(team["team_id"]),
                        "position": str(position or player.get("positionCode") or "C"),
                        "player_name": " ".join(
                            part for part in (
                                _default_text(player.get("firstName")),
                                _default_text(player.get("lastName")),
                            ) if part
                        ),
                        "official_roster": True,
                    }
                )
    return sorted(games.values(), key=lambda row: (row["scheduled_start_at"], row["game_id"])), roster_rows, warnings


def run_season_audit(database_url: str) -> dict[str, Any]:
    with readonly_connection(database_url) as connection:
        teams = [dict(row) for row in connection.execute(TEAM_QUERY).fetchall()]
        identities = [dict(row) for row in connection.execute(IDENTITY_QUERY).fetchall()]
        history = connection.execute(
            """
            select
              (select count(*) from public.games where "seasonId" = 20252026 and type = 2) as games,
              (select count(*) from public.nhl_api_pbp_events where season_id = 20252026) as pbp,
              (select count(*) from public.nhl_api_shift_rows where season_id = 20252026) as shifts
            """
        ).fetchone()
    schedule, rosters, warnings = _official_state(teams)
    roster_ids = {row["nhl_player_id"] for row in rosters}
    mapped_ids = {int(row["nhl_player_id"]) for row in identities if row.get("nhl_player_id") is not None}
    games_per_team: dict[int, int] = defaultdict(int)
    for game in schedule:
        games_per_team[game["home_team_id"]] += 1
        games_per_team[game["away_team_id"]] += 1
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "seasonId": SEASON_ID,
        "teams": len(teams),
        "uniqueRegularSeasonGames": len(schedule),
        "gamesPerTeam": dict(sorted(games_per_team.items())),
        "officialRosterPlayers": len(roster_ids),
        "officialRosterPlayersMappedToFhfh": len(roster_ids & mapped_ids),
        "unmappedOfficialRosterPlayerIds": sorted(roster_ids - mapped_ids),
        "eligibleIdentityRows": len(identities),
        "historicalCore": dict(history),
        "warnings": warnings,
        "ready": (
            len(teams) == 32
            and len(schedule) == 1344
            and set(games_per_team.values()) == {84}
            and not (roster_ids - mapped_ids)
            and int(history["games"] or 0) > 0
            and int(history["pbp"] or 0) > 0
            and int(history["shifts"] or 0) > 0
        ),
    }


def _assist_label_audit(path: Path, frozen_at: str) -> dict[str, Any]:
    source_counts: dict[str, int] = defaultdict(int)
    unresolved: list[dict[str, Any]] = []
    invalid_identities: list[dict[str, Any]] = []
    boxscore_disagreements: list[dict[str, Any]] = []
    row_count = 0
    for row in read_jsonl(path):
        row_count += 1
        source = str(row.get("ASSIST_LABEL_SOURCE") or "unresolved")
        source_counts[source] += 1
        identity = {
            "seasonId": int(row["season_id"]),
            "gameId": int(row["game_id"]),
            "nhlPlayerId": int(row["nhl_player_id"]),
            "gameDate": str(row["game_date"]),
            "source": source,
        }
        primary = row.get("PRIMARY_ASSISTS")
        secondary = row.get("SECONDARY_ASSISTS")
        label_total = row.get("ASSIST_LABEL_ASSISTS")
        if source == "unresolved" or primary is None or secondary is None or label_total is None:
            unresolved.append(identity)
            continue
        primary_value = float(primary)
        secondary_value = float(secondary)
        label_value = float(label_total)
        if (
            primary_value < 0
            or secondary_value < 0
            or not math.isclose(
                primary_value + secondary_value,
                label_value,
                rel_tol=0,
                abs_tol=1e-9,
            )
        ):
            invalid_identities.append({
                **identity,
                "primaryAssists": primary_value,
                "secondaryAssists": secondary_value,
                "labelAssists": label_value,
            })
        boxscore_value = float(row.get("BOX_SCORE_ASSISTS") or 0)
        if not math.isclose(label_value, boxscore_value, rel_tol=0, abs_tol=1e-9):
            boxscore_disagreements.append({
                **identity,
                "boxScoreAssists": boxscore_value,
                "settledLabelAssists": label_value,
            })
    return {
        "schemaVersion": "player-forecast-season-assist-label-audit-v1",
        "frozenAt": frozen_at,
        "rowCount": row_count,
        "sourceCounts": dict(sorted(source_counts.items())),
        "unresolvedRows": len(unresolved),
        "invalidIdentityRows": len(invalid_identities),
        "resolvedBoxScoreDisagreements": len(boxscore_disagreements),
        "eligibleForTraining": not unresolved and not invalid_identities,
        "unresolved": unresolved,
        "invalidIdentities": invalid_identities,
        "boxScoreDisagreements": boxscore_disagreements,
        "predictiveFeatureUse": False,
    }


def _official_landing_assist_labels(payload: dict[str, Any]) -> dict[int, dict[str, int]]:
    labels: dict[int, dict[str, int]] = defaultdict(
        lambda: {
            "primary": 0,
            "secondary": 0,
            "pp": 0,
            "sh": 0,
            "ppGoals": 0,
            "shGoals": 0,
        }
    )
    for period in (payload.get("summary") or {}).get("scoring") or []:
        for goal in period.get("goals") or []:
            assists = goal.get("assists") or []
            if len(assists) > 2:
                raise RuntimeError("official Gamecenter goal contains more than two assists")
            strength = str(goal.get("strength") or "").lower()
            scorer_id = goal.get("playerId")
            if scorer_id is None:
                raise RuntimeError("official Gamecenter goal is missing a player ID")
            scorer = labels[int(scorer_id)]
            if strength == "pp":
                scorer["ppGoals"] += 1
            elif strength == "sh":
                scorer["shGoals"] += 1
            for index, assist in enumerate(assists):
                player_id = assist.get("playerId")
                if player_id is None:
                    raise RuntimeError("official Gamecenter assist is missing a player ID")
                label = labels[int(player_id)]
                label["primary" if index == 0 else "secondary"] += 1
                if strength == "pp":
                    label["pp"] += 1
                elif strength == "sh":
                    label["sh"] += 1
    return dict(labels)


def _resolve_unresolved_assist_labels(
    path: Path,
    audit: dict[str, Any],
    fetched_at: str,
) -> list[dict[str, Any]]:
    unresolved = audit.get("unresolved") or []
    candidates = {
        (int(row["gameId"]), int(row["nhlPlayerId"])): row
        for row in [*unresolved, *(audit.get("boxScoreDisagreements") or [])]
    }
    if not candidates:
        return []
    labels_by_game: dict[int, dict[int, dict[str, int]]] = {}
    captures_by_game: dict[int, dict[str, Any]] = {}
    for game_id in sorted({game_id for game_id, _ in candidates}):
        source_url = f"https://api-web.nhle.com/v1/gamecenter/{game_id}/landing"
        payload, payload_hash = _fetch_json_capture(source_url)
        if int(payload.get("id") or 0) != game_id or str(payload.get("gameState") or "") not in {
            "OFF", "FINAL"
        }:
            raise RuntimeError(f"official Gamecenter assist resolution is not final for {game_id}")
        labels_by_game[game_id] = _official_landing_assist_labels(payload)
        captures_by_game[game_id] = {
            "gameId": game_id,
            "sourceUrl": source_url,
            "fetchedAt": fetched_at,
            "payloadSha256": payload_hash,
            "checkedRows": 0,
            "correctedRows": 0,
            "resolvedUnresolvedRows": 0,
        }

    unresolved_keys = {
        (int(row["gameId"]), int(row["nhlPlayerId"]))
        for row in unresolved
    }
    resolved_count = 0

    def resolved_rows() -> Iterable[dict[str, Any]]:
        nonlocal resolved_count
        for row in read_jsonl(path):
            key = (int(row["game_id"]), int(row["nhl_player_id"]))
            if key not in candidates:
                yield row
                continue
            label = labels_by_game[key[0]].get(
                key[1],
                {
                    "primary": 0,
                    "secondary": 0,
                    "pp": 0,
                    "sh": 0,
                    "ppGoals": 0,
                    "shGoals": 0,
                },
            )
            primary = int(label["primary"])
            secondary = int(label["secondary"])
            total = primary + secondary
            capture = captures_by_game[key[0]]
            capture["checkedRows"] += 1
            needs_correction = key in unresolved_keys or any((
                int(row.get("PRIMARY_ASSISTS") or 0) != primary,
                int(row.get("SECONDARY_ASSISTS") or 0) != secondary,
                int(row.get("PP_ASSISTS") or 0) != int(label["pp"]),
                int(row.get("SH_ASSISTS") or 0) != int(label["sh"]),
                int(row.get("PP_GOALS") or 0) != int(label["ppGoals"]),
                int(row.get("SH_GOALS") or 0) != int(label["shGoals"]),
            ))
            if not needs_correction:
                yield row
                continue
            row.update({
                "PRIMARY_ASSISTS": primary,
                "SECONDARY_ASSISTS": secondary,
                "ASSIST_LABEL_ASSISTS": total,
                "ASSIST_LABEL_BOX_SCORE_DELTA": total
                - int(row.get("BOX_SCORE_ASSISTS") or 0),
                "ASSIST_LABEL_SOURCE": "official_gamecenter_landing_resolution",
                "PP_ASSISTS": int(label["pp"]),
                "SH_ASSISTS": int(label["sh"]),
                "PP_GOALS": int(label["ppGoals"]),
                "SH_GOALS": int(label["shGoals"]),
            })
            capture["correctedRows"] += 1
            if key in unresolved_keys:
                capture["resolvedUnresolvedRows"] += 1
                resolved_count += 1
            yield row

    temporary = path.with_name(f"{path.name}.resolving")
    write_jsonl(temporary, resolved_rows())
    if resolved_count != len(unresolved_keys):
        temporary.unlink(missing_ok=True)
        raise RuntimeError("official Gamecenter did not resolve every assist label row")
    temporary.replace(path)
    return [captures_by_game[game_id] for game_id in sorted(captures_by_game)]


def freeze_season_dataset(
    database_url: str,
    output: Path,
    history_seasons: list[int],
    base_freeze: Path | None = None,
) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=False)
    frozen_at = datetime.now(timezone.utc).isoformat()
    with readonly_connection(database_url) as connection:
        identities = [dict(row) for row in connection.execute(IDENTITY_QUERY).fetchall()]
        base_manifest: dict[str, Any] | None = None
        inherited_files: list[str] = []
        if base_freeze is not None:
            base_freeze = base_freeze.expanduser().resolve()
            base_manifest = read_json(base_freeze / "manifest.json")
            if (
                base_manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256
                or int(base_manifest.get("seasonId") or 0) != SEASON_ID
                or int(base_manifest.get("trainingCutoffSeason") or 0) != TRAINING_CUTOFF_SEASON
            ):
                raise RuntimeError("base season freeze contract, season, or training cutoff mismatch")
            base_files = base_manifest.get("files", {})
            missing_history = {
                "games", "skaters", "goalies", "team_history"
            } - set(base_files)
            if missing_history:
                raise RuntimeError(
                    f"base season freeze is missing historical files: {', '.join(sorted(missing_history))}"
                )
            for metadata in base_files.values():
                source = (base_freeze / str(metadata["path"])).resolve()
                try:
                    source.relative_to(base_freeze)
                except ValueError as error:
                    raise RuntimeError("base season freeze contains a path outside its root") from error
                if not source.is_file() or _file_sha256(source) != metadata.get("sha256"):
                    raise RuntimeError(f"base season freeze checksum failed for {metadata['path']}")
                if source.suffix == ".jsonl":
                    row_count = sum(1 for _ in read_jsonl(source))
                else:
                    value = read_json(source)
                    row_count = len(value) if isinstance(value, list) else 1
                if row_count != int(metadata.get("rows", -1)):
                    raise RuntimeError(f"base season freeze row count failed for {metadata['path']}")
            seasons = [int(value) for value in base_manifest.get("historySeasons", [])]
            if TRAINING_CUTOFF_SEASON not in seasons:
                raise RuntimeError("base season freeze does not contain the training cutoff season")
            teams = read_json(base_freeze / "teams.json")
            season_row = read_json(base_freeze / "season.json")
        else:
            seasons = sorted(set(history_seasons + [TRAINING_CUTOFF_SEASON, SEASON_ID]))
            teams = [dict(row) for row in connection.execute(TEAM_QUERY).fetchall()]
            season_row = dict(connection.execute(
                """
                select id, "startDate"::text as start_date, "endDate"::text as end_date,
                       "regularSeasonEndDate"::text as regular_season_end_date,
                       "numberOfGames"::integer as number_of_games
                from public.seasons where id = %s
                """,
                (SEASON_ID,),
            ).fetchone())
        schedule, official_roster, warnings = _official_state(teams)
        files: dict[str, dict[str, Any]] = {}
        if base_manifest is not None and base_freeze is not None:
            for name in ("games", "skaters", "goalies", "team_history", "defense_history"):
                metadata = base_manifest.get("files", {}).get(name)
                destination = output / f"{name}.jsonl"
                if metadata is None:
                    count, checksum = write_jsonl(destination, [])
                else:
                    source = base_freeze / str(metadata["path"])
                    shutil.copyfile(source, destination)
                    count = int(metadata["rows"])
                    checksum = str(metadata["sha256"])
                    inherited_files.append(name)
                files[name] = {"path": destination.name, "rows": count, "sha256": checksum}
            query_specs = (
                ("deployment_tallies", DEPLOYMENT_TALLY_QUERY, (seasons,)),
                ("line_snapshots", LINE_SNAPSHOT_QUERY, ()),
            )
        else:
            query_specs = (
                ("games", GAME_QUERY, (seasons,)),
                ("skaters", SKATER_QUERY, (seasons,)),
                ("goalies", GOALIE_QUERY, (seasons, seasons, seasons, seasons)),
                ("team_history", TEAM_HISTORY_QUERY, (seasons,)),
                ("defense_history", DEFENSE_HISTORY_QUERY, (seasons, seasons, seasons, seasons)),
                ("deployment_tallies", DEPLOYMENT_TALLY_QUERY, (seasons,)),
                ("line_snapshots", LINE_SNAPSHOT_QUERY, ()),
            )
        for name, query, parameters in query_specs:
            current_rows = stream_query(
                connection, f"player_forecast_season_{name}", query, parameters
            )
            if base_manifest is not None and base_freeze is not None:
                base_metadata = base_manifest.get("files", {}).get(name)

                def merged_rows() -> Iterable[dict[str, Any]]:
                    seen: set[str] = set()
                    if base_metadata is not None:
                        for row in read_jsonl(base_freeze / str(base_metadata["path"])):
                            key = canonical_json(row)
                            seen.add(key)
                            yield row
                    for row in current_rows:
                        key = canonical_json(row)
                        if key not in seen:
                            seen.add(key)
                            yield row

                rows: Iterable[dict[str, Any]] = merged_rows()
                if base_metadata is not None:
                    inherited_files.append(name)
            else:
                rows = current_rows
            count, checksum = write_jsonl(
                output / f"{name}.jsonl",
                rows,
            )
            files[name] = {"path": f"{name}.jsonl", "rows": count, "sha256": checksum}

    base_audit_metadata = (
        base_manifest.get("files", {}).get("assist_label_audit")
        if base_manifest is not None
        else None
    )
    if base_audit_metadata is not None and base_freeze is not None:
        base_audit_path = base_freeze / str(base_audit_metadata["path"])
        assist_label_audit = read_json(base_audit_path)
        structural_audit = _assist_label_audit(output / "skaters.jsonl", frozen_at)
        for key in (
            "rowCount",
            "sourceCounts",
            "unresolvedRows",
            "invalidIdentityRows",
            "resolvedBoxScoreDisagreements",
        ):
            if structural_audit[key] != assist_label_audit.get(key):
                raise RuntimeError(
                    f"base season freeze assist-label audit no longer matches skater rows: {key}"
                )
        pre_resolution_source_counts = dict(
            assist_label_audit.get("preResolutionSourceCounts")
            or assist_label_audit["sourceCounts"]
        )
        official_resolutions = list(
            assist_label_audit.get("officialGamecenterResolutions") or []
        )
        shutil.copyfile(base_audit_path, output / "assist-label-audit.json")
    else:
        assist_label_audit = _assist_label_audit(output / "skaters.jsonl", frozen_at)
        pre_resolution_source_counts = dict(assist_label_audit["sourceCounts"])
        official_resolutions = _resolve_unresolved_assist_labels(
            output / "skaters.jsonl",
            assist_label_audit,
            frozen_at,
        )
        if official_resolutions:
            files["skaters"]["sha256"] = _file_sha256(output / "skaters.jsonl")
            assist_label_audit = _assist_label_audit(output / "skaters.jsonl", frozen_at)
        assist_label_audit["preResolutionSourceCounts"] = pre_resolution_source_counts
        assist_label_audit["officialGamecenterResolutions"] = official_resolutions
        write_json(output / "assist-label-audit.json", assist_label_audit)
    files["assist_label_audit"] = {
        "path": "assist-label-audit.json",
        "rows": 1,
        "sha256": _file_sha256(output / "assist-label-audit.json"),
    }
    if not assist_label_audit["eligibleForTraining"]:
        raise RuntimeError(
            "season freeze has unresolved or invalid primary/secondary assist labels"
        )

    by_nhl = {
        int(identity["nhl_player_id"]): identity
        for identity in identities
        if identity.get("nhl_player_id") is not None
    }
    official_by_nhl = {row["nhl_player_id"]: row for row in official_roster}
    player_pool_review = [
        {
            **row,
            "issue_code": "official_roster_identity_unmapped",
            "resolution_status": "pending",
        }
        for row in official_roster
        if row["nhl_player_id"] not in by_nhl
    ]
    recent_ids = {
        int(row["nhl_player_id"])
        for file_name in ("skaters.jsonl", "goalies.jsonl")
        for row in read_jsonl(output / file_name)
        if int(row["season_id"]) >= 20242025
    }
    player_pool: list[dict[str, Any]] = []
    for identity in identities:
        nhl_id = identity.get("nhl_player_id")
        official = official_by_nhl.get(int(nhl_id)) if nhl_id is not None else None
        lifecycle = str(identity["lifecycle_status"])
        if not official and lifecycle == "active_nhl" and (nhl_id is None or int(nhl_id) not in recent_ids):
            continue
        if not official and lifecycle not in ("active_prospect", "unsigned_relevant", "active_nhl"):
            continue
        position = str((official or {}).get("position") or identity.get("position") or "")
        if position not in ("C", "L", "R", "D", "G"):
            continue
        pool_status = (
            "verified_active" if official or lifecycle == "active_nhl"
            else "active_prospect" if lifecycle == "active_prospect"
            else "unsigned_relevant"
        )
        player_pool.append(
            {
                "fhfh_player_id": int(identity["fhfh_player_id"]),
                "nhl_player_id": int(nhl_id) if nhl_id is not None else None,
                "player_name": str((official or {}).get("player_name") or identity["canonical_name"]),
                "team_id": int((official or {}).get("team_id") or identity.get("team_id"))
                if ((official or {}).get("team_id") or identity.get("team_id")) is not None else None,
                "position": position,
                "pool_status": pool_status,
                "roster_confidence": 0.85 if official else 0.55 if lifecycle == "active_nhl" else 0.4,
                "prior_based": nhl_id is None or int(nhl_id) not in recent_ids,
                "source_provenance": {
                    "officialRoster": bool(official),
                    "identityVerification": identity["verification_status"],
                    "lifecycleStatus": lifecycle,
                },
            }
        )

    schedule_hash = hashlib.sha256(canonical_json(schedule).encode()).hexdigest()
    roster_hash = hashlib.sha256(canonical_json(player_pool).encode()).hexdigest()
    write_json(output / "schedule.json", schedule)
    write_json(output / "player-pool.json", player_pool)
    write_json(output / "player-pool-review.json", player_pool_review)
    write_json(output / "teams.json", teams)
    write_json(output / "season.json", season_row)
    files["schedule"] = {"path": "schedule.json", "rows": len(schedule), "sha256": _file_sha256(output / "schedule.json")}
    files["player_pool"] = {"path": "player-pool.json", "rows": len(player_pool), "sha256": _file_sha256(output / "player-pool.json")}
    files["player_pool_review"] = {
        "path": "player-pool-review.json",
        "rows": len(player_pool_review),
        "sha256": _file_sha256(output / "player-pool-review.json"),
    }
    files["teams"] = {"path": "teams.json", "rows": len(teams), "sha256": _file_sha256(output / "teams.json")}
    files["season"] = {"path": "season.json", "rows": 1, "sha256": _file_sha256(output / "season.json")}
    manifest = {
        "schemaVersion": "player-forecast-season-freeze-v1",
        "createdAt": frozen_at,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "seasonId": SEASON_ID,
        "trainingCutoffSeason": TRAINING_CUTOFF_SEASON,
        "historySeasons": seasons,
        "featureTrack": "historical_core",
        "scheduleRevisionHash": schedule_hash,
        "rosterRevisionHash": roster_hash,
        "files": files,
        "availabilityPolicy": "predictive features are cutoff-safe official or normalized rows; WGO is frozen settled outcome-label evidence only and never receives a synthesized available_at",
        "assistLabelPolicy": {
            "wgoUse": "frozen_settled_training_outcomes_only",
            "predictiveFeatureUse": False,
            "auditPath": "assist-label-audit.json",
            "auditSha256": files["assist_label_audit"]["sha256"],
            "sourceCounts": assist_label_audit["sourceCounts"],
            "resolvedBoxScoreDisagreements": assist_label_audit[
                "resolvedBoxScoreDisagreements"
            ],
            "unresolvedRows": assist_label_audit["unresolvedRows"],
            "invalidIdentityRows": assist_label_audit["invalidIdentityRows"],
            "detectedSourceConflictRows": pre_resolution_source_counts.get(
                "source_conflict", 0
            ),
            "officialGamecenterCheckedRows": sum(
                int(capture["checkedRows"]) for capture in official_resolutions
            ),
            "officialGamecenterCorrectedRows": sum(
                int(capture["correctedRows"]) for capture in official_resolutions
            ),
        },
        "warnings": warnings,
        "baseFreeze": (
            {
                "createdAt": base_manifest["createdAt"],
                "manifestSha256": _file_sha256(base_freeze / "manifest.json"),
                "inheritedHistoricalFiles": inherited_files,
            }
            if base_manifest is not None and base_freeze is not None
            else None
        ),
        "publicationBlockers": {
            "unmappedOfficialRosterPlayers": len(player_pool_review),
            "unresolvedAssistLabels": assist_label_audit["unresolvedRows"],
            "invalidAssistIdentities": assist_label_audit["invalidIdentityRows"],
        },
    }
    write_json(output / "manifest.json", manifest)
    return manifest


def _season_age(target: int, row_season: int) -> int:
    return max(0, target // 10000 - row_season // 10000)


def _weighted_summary(
    rows: Iterable[dict[str, Any]],
    target: str,
    decay: float,
    cutoff_date: str | None = None,
) -> tuple[dict[int, tuple[float, float, float]], tuple[float, float]]:
    players: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    total = weighted_total = 0.0
    weight_sum = 0.0
    for row in rows:
        if cutoff_date and str(row["game_date"]) >= cutoff_date:
            continue
        value = float(row.get(target) or 0)
        weight = decay ** _season_age(TRAINING_CUTOFF_SEASON, int(row["season_id"]))
        player = players[int(row["nhl_player_id"])]
        player[0] += value * weight
        player[1] += weight
        player[2] += value * value * weight
        weighted_total += value * weight
        weight_sum += weight
        total += 1
    prior = weighted_total / weight_sum if weight_sum else 0.0
    return {
        player_id: (values[0] / values[1], values[1], max(0.0, values[2] / values[1] - (values[0] / values[1]) ** 2))
        for player_id, values in players.items() if values[1] > 0
    }, (prior, total)


def _solve_ridge_system(
    matrix: list[list[float]],
    vector: list[float],
    penalty: float,
) -> list[float] | None:
    size = len(vector)
    augmented = [
        [
            float(matrix[row][column]) + (
                penalty if row == column and column > 0 else 0.0
            )
            for column in range(size)
        ] + [float(vector[row])]
        for row in range(size)
    ]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-10:
            return None
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [
                augmented[row][index] - factor * augmented[column][index]
                for index in range(size + 1)
            ]
    return [augmented[row][-1] for row in range(size)]


def _eb_rate(
    summaries: dict[int, tuple[float, float, float]],
    player_id: int,
    prior: float,
    shrinkage: float,
) -> tuple[float, float, float]:
    player_mean, support, variance = summaries.get(
        player_id,
        (prior, 0.0, max(abs(prior), 0.01)),
    )
    return (
        (support * player_mean + shrinkage * prior) / (support + shrinkage),
        support,
        variance,
    )


def _glm_features(eb_rate: float, toi_rate: float, target: str) -> list[float]:
    if target == "PLUS_MINUS":
        return [1.0, eb_rate, math.log1p(max(0.0, toi_rate))]
    return [
        1.0,
        math.log(max(1e-6, eb_rate + 1e-6)),
        math.log1p(max(0.0, toi_rate)),
    ]


def _glm_prediction(
    coefficients: list[float],
    eb_rate: float,
    toi_rate: float,
    target: str,
) -> float:
    linear = sum(
        coefficient * feature
        for coefficient, feature in zip(coefficients, _glm_features(eb_rate, toi_rate, target))
    )
    if target == "PLUS_MINUS":
        return linear
    return math.exp(max(-20.0, min(20.0, linear)))


def _fit_penalized_rate_glm(
    rows: list[dict[str, Any]],
    target: str,
    decay: float,
    shrinkage: float,
    cutoff_date: str | None,
) -> list[float] | None:
    summaries, (prior, _) = _weighted_summary(rows, target, decay, cutoff_date)
    toi_summaries, (toi_prior, _) = _weighted_summary(
        rows,
        "TOTAL_TOI",
        decay,
        cutoff_date,
    )
    points: list[tuple[list[float], float, float]] = []
    for player_id, (_, support, _) in summaries.items():
        if support <= 0:
            continue
        rate, _, _ = _eb_rate(summaries, player_id, prior, shrinkage)
        toi_rate, _, _ = _eb_rate(toi_summaries, player_id, toi_prior, shrinkage)
        observed_rate = summaries[player_id][0]
        points.append((_glm_features(rate, toi_rate, target), observed_rate, support))
    if len(points) < 10:
        return None
    dimensions = len(points[0][0])
    if target == "PLUS_MINUS":
        matrix = [[0.0] * dimensions for _ in range(dimensions)]
        vector = [0.0] * dimensions
        for features, observed_rate, weight in points:
            for left in range(dimensions):
                vector[left] += weight * features[left] * observed_rate
                for right in range(dimensions):
                    matrix[left][right] += weight * features[left] * features[right]
        return _solve_ridge_system(matrix, vector, 10.0)
    coefficients = [math.log(max(1e-6, prior)), 0.0, 0.0]
    for _ in range(12):
        matrix = [[0.0] * dimensions for _ in range(dimensions)]
        vector = [0.0] * dimensions
        for features, observed_rate, exposure in points:
            predicted_rate = math.exp(max(-20.0, min(20.0, sum(
                coefficient * feature
                for coefficient, feature in zip(coefficients, features)
            ))))
            mean = max(1e-6, exposure * predicted_rate)
            observed = max(0.0, exposure * observed_rate)
            working = math.log(mean) + (observed - mean) / mean - math.log(exposure)
            for left in range(dimensions):
                vector[left] += mean * features[left] * working
                for right in range(dimensions):
                    matrix[left][right] += mean * features[left] * features[right]
        solved = _solve_ridge_system(matrix, vector, 10.0)
        if solved is None:
            return None
        if max(abs(solved[index] - coefficients[index]) for index in range(dimensions)) < 1e-8:
            coefficients = solved
            break
        coefficients = solved
    return coefficients


def _select_rate_policy(
    rows: list[dict[str, Any]],
    target: str,
) -> dict[str, Any]:
    best: tuple[float, float, float, int] | None = None
    for decay in DECAY_CANDIDATES:
        for shrink in SHRINK_CANDIDATES:
            absolute_errors: list[float] = []
            for start, end in VALIDATION_FOLDS:
                summaries, (prior, _) = _weighted_summary(rows, target, decay, start)
                for row in rows:
                    game_date = str(row["game_date"])
                    if not start <= game_date <= end or int(row["season_id"]) != TRAINING_CUTOFF_SEASON:
                        continue
                    player_mean, support, _ = summaries.get(int(row["nhl_player_id"]), (prior, 0.0, prior))
                    estimate = (support * player_mean + shrink * prior) / (support + shrink)
                    absolute_errors.append(abs(float(row.get(target) or 0) - estimate))
            mae = sum(absolute_errors) / len(absolute_errors) if absolute_errors else math.inf
            choice = (mae, decay, shrink, len(absolute_errors))
            if best is None or choice < best:
                best = choice
    if best is None or not math.isfinite(best[0]):
        return {
            "modelFamily": "population_rate_fallback",
            "baselineModel": "population_rate",
            "decay": 1.0,
            "shrinkage": 20.0,
            "validationMae": None,
            "baselineMae": None,
            "chronologicalLift": None,
            "calibration80Coverage": None,
            "calibrationMethod": "rolling_origin_predictive_variance_p10_p90",
            "rows": 0,
            "players": 0,
            "fallback": True,
        }
    glm_errors: list[float] = []
    fold_glm: dict[str, list[float] | None] = {}
    for start, end in VALIDATION_FOLDS:
        coefficients = _fit_penalized_rate_glm(
            rows,
            target,
            best[1],
            best[2],
            start,
        )
        fold_glm[start] = coefficients
        if coefficients is None:
            continue
        summaries, (prior, _) = _weighted_summary(rows, target, best[1], start)
        toi_summaries, (toi_prior, _) = _weighted_summary(
            rows,
            "TOTAL_TOI",
            best[1],
            start,
        )
        for row in rows:
            game_date = str(row["game_date"])
            if not start <= game_date <= end or int(row["season_id"]) != TRAINING_CUTOFF_SEASON:
                continue
            player_id = int(row["nhl_player_id"])
            eb_rate, _, _ = _eb_rate(summaries, player_id, prior, best[2])
            toi_rate, _, _ = _eb_rate(toi_summaries, player_id, toi_prior, best[2])
            estimate = _glm_prediction(coefficients, eb_rate, toi_rate, target)
            glm_errors.append(abs(float(row.get(target) or 0) - estimate))
    glm_mae = sum(glm_errors) / len(glm_errors) if glm_errors else None
    baseline_errors: list[float] = []
    for start, end in VALIDATION_FOLDS:
        _, (baseline_prior, _) = _weighted_summary(rows, target, 1.0, start)
        baseline_errors.extend(
            abs(float(row.get(target) or 0) - baseline_prior)
            for row in rows
            if start <= str(row["game_date"]) <= end
            and int(row["season_id"]) == TRAINING_CUTOFF_SEASON
        )
    population_baseline_mae = (
        sum(baseline_errors) / len(baseline_errors) if baseline_errors else None
    )
    candidates = [("empirical_bayes_rate", best[0])]
    if population_baseline_mae is not None:
        candidates.insert(0, ("population_rate", population_baseline_mae))
    if glm_mae is not None and len(glm_errors) == best[3]:
        candidates.append(("penalized_glm", glm_mae))
    selected_family, selected_mae = min(candidates, key=lambda candidate: candidate[1])
    final_glm_coefficients = _fit_penalized_rate_glm(
        rows,
        target,
        best[1],
        best[2],
        None,
    )
    interval_hits: list[bool] = []
    evaluated_players: set[int] = set()
    for start, end in VALIDATION_FOLDS:
        summaries, (prior, _) = _weighted_summary(rows, target, best[1], start)
        toi_summaries, (toi_prior, _) = _weighted_summary(
            rows,
            "TOTAL_TOI",
            best[1],
            start,
        )
        _, (baseline_prior, _) = _weighted_summary(rows, target, 1.0, start)
        for row in rows:
            game_date = str(row["game_date"])
            if not start <= game_date <= end or int(row["season_id"]) != TRAINING_CUTOFF_SEASON:
                continue
            player_id = int(row["nhl_player_id"])
            actual = float(row.get(target) or 0)
            player_mean, support, player_variance = summaries.get(
                player_id,
                (prior, 0.0, max(abs(prior), 0.01)),
            )
            estimate = (support * player_mean + best[2] * prior) / (support + best[2])
            coefficients = fold_glm.get(start)
            if selected_family == "population_rate":
                estimate = baseline_prior
            elif selected_family == "penalized_glm" and coefficients is not None:
                toi_rate, _, _ = _eb_rate(
                    toi_summaries,
                    player_id,
                    toi_prior,
                    best[2],
                )
                estimate = _glm_prediction(coefficients, estimate, toi_rate, target)
            predictive_variance = (
                support * player_variance + best[2] * max(abs(prior), 0.01)
            ) / (support + best[2])
            radius = 1.281551565545 * math.sqrt(max(predictive_variance, 0.01))
            lower = estimate - radius
            if target in NONNEGATIVE_TARGETS:
                lower = max(0.0, lower)
            interval_hits.append(lower <= actual <= estimate + radius)
            evaluated_players.add(player_id)
    coverage = sum(interval_hits) / len(interval_hits) if interval_hits else None
    if selected_family == "penalized_glm" and (
        population_baseline_mae is None or best[0] <= population_baseline_mae
    ):
        baseline_model = "empirical_bayes_rate"
        baseline_mae = best[0]
    else:
        baseline_model = "population_rate"
        baseline_mae = population_baseline_mae
    return {
        "modelFamily": selected_family,
        "baselineModel": baseline_model,
        "decay": best[1],
        "shrinkage": best[2],
        "validationMae": selected_mae,
        "empiricalBayesMae": best[0],
        "penalizedGlmMae": glm_mae,
        "penalizedGlmCoefficients": final_glm_coefficients,
        "baselineMae": baseline_mae,
        "populationBaselineMae": population_baseline_mae,
        "chronologicalLift": (
            0.0 if selected_family == "population_rate"
            else 1 - selected_mae / baseline_mae if baseline_mae and baseline_mae > 0
            else None
        ),
        "calibration80Coverage": coverage,
        "calibrationMethod": "rolling_origin_predictive_variance_p10_p90",
        "rows": best[3],
        "players": len(evaluated_players),
        "fallback": selected_family == "population_rate",
    }


def _percentile(values: list[float], value: float) -> float:
    if not values:
        return 50.0
    less = sum(1 for item in values if item < value)
    equal = sum(1 for item in values if item == value)
    return 100.0 * (less + 0.5 * equal) / len(values)


def _team_contexts(team_rows: list[dict[str, Any]], teams: list[dict[str, Any]]) -> dict[str, Any]:
    recent = [row for row in team_rows if int(row["season_id"]) == TRAINING_CUTOFF_SEASON]
    league_gf = sum(float(row["goals_for"]) for row in recent) / max(1, len(recent))
    league_shots = sum(float(row["shots_for"]) + float(row["shots_against"]) for row in recent) / max(1, len(recent))
    by_team: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in recent:
        by_team[int(row["team_id"])].append(row)
    raw: dict[int, dict[str, float]] = {}
    for team in teams:
        team_id = int(team["team_id"])
        rows = by_team.get(team_id, [])
        games = max(1, len(rows))
        gf = sum(float(row["goals_for"]) for row in rows) / games
        ga = sum(float(row["goals_against"]) for row in rows) / games
        pace = sum(float(row["shots_for"]) + float(row["shots_against"]) for row in rows) / games
        pp_goals = sum(float(row["pp_goals"]) for row in rows)
        pp_opportunities = sum(float(row["pp_opportunities"]) for row in rows)
        pk_ga = sum(float(row["pk_goals_against"]) for row in rows)
        pk_opportunities = sum(float(row["pk_opportunities"]) for row in rows)
        raw[team_id] = {
            "gf": gf, "ga": ga, "pace": pace,
            "savePercentage": 1 - ga / max(
                1e-9,
                sum(float(row["shots_against"]) for row in rows) / games,
            ),
            "pp": pp_goals / pp_opportunities if pp_opportunities else 0.0,
            "pk": 1 - pk_ga / pk_opportunities if pk_opportunities else 0.0,
            "goalDifferential": gf - ga,
        }
    schedule_neutral = {team_id: values["goalDifferential"] for team_id, values in raw.items()}
    for _ in range(20):
        adjusted: dict[int, float] = {}
        for team_id, values in raw.items():
            opponents = [
                schedule_neutral.get(int(row["opponent_team_id"]), 0.0)
                for row in by_team.get(team_id, [])
            ]
            opponent_strength = sum(opponents) / len(opponents) if opponents else 0.0
            adjusted[team_id] = values["goalDifferential"] + opponent_strength
        center = sum(adjusted.values()) / max(1, len(adjusted))
        schedule_neutral = {
            team_id: 0.5 * schedule_neutral[team_id] + 0.5 * (value - center)
            for team_id, value in adjusted.items()
        }
    dimensions = {
        key: [row[key] for row in raw.values()]
        for key in ("gf", "ga", "pace", "savePercentage", "pp", "pk")
    }
    dimensions["scheduleNeutralGoalDifferential"] = list(schedule_neutral.values())
    return {
        str(team_id): {
            "teamId": team_id,
            "offenseMultiplier": max(0.65, min(1.35, values["gf"] / max(league_gf, 1e-9))),
            "defenseMultiplier": max(0.65, min(1.35, league_gf / max(values["ga"], 1e-9))),
            "paceMultiplier": max(0.75, min(1.25, values["pace"] / max(league_shots, 1e-9))),
            "ratings": {
                "offense": _percentile(dimensions["gf"], values["gf"]),
                "defense": 100 - _percentile(dimensions["ga"], values["ga"]),
                "goaltending": _percentile(dimensions["savePercentage"], values["savePercentage"]),
                "powerPlay": _percentile(dimensions["pp"], values["pp"]),
                "penaltyKill": _percentile(dimensions["pk"], values["pk"]),
                "pace": _percentile(dimensions["pace"], values["pace"]),
                "overall": _percentile(
                    dimensions["scheduleNeutralGoalDifferential"],
                    schedule_neutral[team_id],
                ),
            },
            "scheduleNeutralGoalDifferential": schedule_neutral[team_id],
            "projectedGoalsFor": values["gf"],
            "projectedGoalsAgainst": values["ga"],
            "sampleGames": len(by_team.get(team_id, [])),
        }
        for team_id, values in raw.items()
    }


def _roster_adjusted_team_contexts(
    contexts: dict[str, Any],
    players: dict[str, Any],
) -> dict[str, Any]:
    by_team: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for player in players.values():
        if player.get("teamId") is not None and player.get("poolStatus") != "excluded":
            by_team[int(player["teamId"])].append(player)
    raw: dict[int, dict[str, float]] = {}
    for team_key, context in contexts.items():
        team_id = int(team_key)
        members = by_team.get(team_id, [])
        skaters = [player for player in members if player["population"] != "goalie"]
        goalies = [player for player in members if player["population"] == "goalie"]
        roster_goals = sum(
            float(player["playProbability"])
            * float(player["conditionalRates"].get("GOALS", 0.0))
            for player in skaters
        )
        power_play = sum(
            float(player["playProbability"])
            * (
                float(player["conditionalRates"].get("PP_GOALS", 0.0))
                + float(player["conditionalRates"].get("PP_ASSISTS", 0.0))
            )
            for player in skaters
        )
        defense_suppression = sum(
            float(player["playProbability"])
            * float(player.get("ratingSignals", {}).get("defenseSuppressionPer60", 0.0))
            * float(player["conditionalRates"].get("TOTAL_TOI", 0.0))
            / 3600.0
            for player in skaters
        )
        pk_suppression = sum(
            float(player["playProbability"])
            * float(player.get("ratingSignals", {}).get("defenseSuppressionPer60", 0.0))
            * float(player["conditionalRates"].get("PK_TOI", 0.0))
            / 3600.0
            for player in skaters
        )
        start_weight = sum(float(player.get("startProbability") or 0.0) for player in goalies)
        goalie_ga = (
            sum(
                float(player.get("startProbability") or 0.0)
                * float(player["conditionalRates"].get("GOALS_AGAINST_GOALIE", 0.0))
                for player in goalies
            ) / start_weight
            if start_weight > 0
            else float(context["projectedGoalsAgainst"])
        )
        goalie_save = (
            sum(
                float(player.get("startProbability") or 0.0)
                * float(player.get("ratingSignals", {}).get("goalieSaveRate", 0.0))
                for player in goalies
            ) / start_weight
            if start_weight > 0 else 0.0
        )
        raw[team_id] = {
            "rosterGoals": roster_goals,
            "powerPlay": power_play,
            "defenseSuppression": defense_suppression,
            "pkSuppression": pk_suppression,
            "goalieGa": goalie_ga,
            "goalieSave": goalie_save,
        }
    league_roster_goals = sum(row["rosterGoals"] for row in raw.values()) / max(1, len(raw))
    league_base_goals = sum(
        float(context["projectedGoalsFor"]) for context in contexts.values()
    ) / max(1, len(contexts))
    scoring_scale = league_base_goals / max(1e-9, league_roster_goals)
    league_suppression = sum(row["defenseSuppression"] for row in raw.values()) / max(1, len(raw))
    projected: dict[int, dict[str, float]] = {}
    for team_id, values in raw.items():
        projected[team_id] = {
            **values,
            "goalsFor": values["rosterGoals"] * scoring_scale,
            "goalsAgainst": max(
                0.5,
                values["goalieGa"] - (values["defenseSuppression"] - league_suppression),
            ),
        }
        projected[team_id]["goalDifferential"] = (
            projected[team_id]["goalsFor"] - projected[team_id]["goalsAgainst"]
        )
    dimensions = {
        key: [row[key] for row in projected.values()]
        for key in (
            "goalsFor", "defenseSuppression", "goalieSave", "powerPlay",
            "pkSuppression", "goalDifferential",
        )
    }
    league_goals = sum(row["goalsFor"] for row in projected.values()) / max(1, len(projected))
    return {
        str(team_id): {
            **contexts[str(team_id)],
            "offenseMultiplier": max(0.65, min(1.35, values["goalsFor"] / max(league_goals, 1e-9))),
            "defenseMultiplier": max(0.65, min(1.35, league_goals / max(values["goalsAgainst"], 1e-9))),
            "ratings": {
                **contexts[str(team_id)]["ratings"],
                "offense": _percentile(dimensions["goalsFor"], values["goalsFor"]),
                "defense": _percentile(dimensions["defenseSuppression"], values["defenseSuppression"]),
                "goaltending": _percentile(dimensions["goalieSave"], values["goalieSave"]),
                "powerPlay": _percentile(dimensions["powerPlay"], values["powerPlay"]),
                "penaltyKill": _percentile(dimensions["pkSuppression"], values["pkSuppression"]),
                "overall": _percentile(dimensions["goalDifferential"], values["goalDifferential"]),
            },
            "scheduleNeutralGoalDifferential": values["goalDifferential"],
            "projectedGoalsFor": values["goalsFor"],
            "projectedGoalsAgainst": values["goalsAgainst"],
            "rosterAdjusted": True,
        }
        for team_id, values in projected.items()
    }


def _adjusted_defense_ratings(rows: list[dict[str, Any]]) -> dict[int, float]:
    team_games: dict[tuple[int, int], dict[str, float]] = {}
    for row in rows:
        team_games[(int(row["game_id"]), int(row["team_id"]))] = {
            "opponent": int(row["opponent_team_id"]),
            "chances": float(row["team_chances_against"]),
            "goals": float(row["team_goals_against"]),
        }
    defense_chances: dict[int, list[float]] = defaultdict(list)
    offense_chances: dict[int, list[float]] = defaultdict(list)
    defense_goals: dict[int, list[float]] = defaultdict(list)
    offense_goals: dict[int, list[float]] = defaultdict(list)
    for (_, team_id), values in team_games.items():
        opponent = int(values["opponent"])
        defense_chances[team_id].append(values["chances"])
        offense_chances[opponent].append(values["chances"])
        defense_goals[team_id].append(values["goals"])
        offense_goals[opponent].append(values["goals"])
    all_chances = [value["chances"] for value in team_games.values()]
    all_goals = [value["goals"] for value in team_games.values()]
    league_chances = sum(all_chances) / max(1, len(all_chances))
    league_goals = sum(all_goals) / max(1, len(all_goals))
    goal_per_chance = sum(all_goals) / max(1.0, sum(all_chances))

    def average(values: dict[int, list[float]], team_id: int, fallback: float) -> float:
        rows_for_team = values.get(team_id, [])
        return sum(rows_for_team) / len(rows_for_team) if rows_for_team else fallback

    player_totals: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0])
    player_positions: dict[int, str] = {}
    for row in rows:
        team_id = int(row["team_id"])
        opponent_id = int(row["opponent_team_id"])
        toi = max(0.0, float(row["toi_seconds"]))
        if toi <= 0:
            continue
        expected_chances_per_game = math.sqrt(
            max(0.01, average(defense_chances, team_id, league_chances))
            * max(0.01, average(offense_chances, opponent_id, league_chances))
        )
        expected_goals_per_game = math.sqrt(
            max(0.001, average(defense_goals, team_id, league_goals))
            * max(0.001, average(offense_goals, opponent_id, league_goals))
        )
        ice_share = min(1.0, toi / 3600.0)
        expected_chances = expected_chances_per_game * ice_share
        expected_goals = expected_goals_per_game * ice_share
        suppression_goal_equivalent = (
            (expected_chances - float(row["chances_against"])) * goal_per_chance
            + expected_goals - float(row["goals_against"])
        )
        player_id = int(row["nhl_player_id"])
        player_totals[player_id][0] += suppression_goal_equivalent
        player_totals[player_id][1] += toi
        player_positions[player_id] = str(row["position"])
    raw = {
        player_id: values[0] * 3600 / values[1]
        for player_id, values in player_totals.items()
        if values[1] > 0
    }
    position_priors: dict[str, float] = {}
    for position in sorted(set(player_positions.values())):
        values = [value for player_id, value in raw.items() if player_positions.get(player_id) == position]
        position_priors[position] = median(values) if values else 0.0
    result: dict[int, float] = {}
    for player_id, value in raw.items():
        equivalent_games = player_totals[player_id][1] / 1200.0
        prior = position_priors.get(player_positions.get(player_id, ""), 0.0)
        result[player_id] = (
            equivalent_games * value + 20.0 * prior
        ) / (equivalent_games + 20.0)
    return result


def _season_player_fallback_flags(
    prior_based: bool,
    population: str,
    nhl_player_id: int | None,
    adjusted_defense_by_nhl: dict[int, float],
) -> list[str]:
    return [
        *(["prior_based_projection"] if prior_based else []),
        *(
            ["defense_rating_plus_minus_fallback"]
            if population != "goalie" and (
                nhl_player_id is None or nhl_player_id not in adjusted_defense_by_nhl
            )
            else []
        ),
    ]


def _normalized_role_probabilities(values: dict[str, float]) -> dict[str, float]:
    positive = {key: max(0.0, float(value)) for key, value in values.items() if value > 0}
    total = sum(positive.values())
    if total <= 0:
        return {}
    return {key: _round_number(value / total) for key, value in sorted(positive.items())}


def _deployment_evidence(
    tallies: list[dict[str, Any]],
    snapshots: list[dict[str, Any]],
    as_of: str,
) -> dict[tuple[int, int], dict[str, Any]]:
    evidence: dict[tuple[int, int], dict[str, Any]] = defaultdict(
        lambda: {
            "families": defaultdict(lambda: defaultdict(float)),
            "sources": set(),
            "confidenceWeight": 0.0,
            "injuryWeight": 0.0,
            "scratchWeight": 0.0,
        }
    )
    latest_season = max((int(row["season_id"]) for row in tallies), default=0)
    for row in tallies:
        if int(row["season_id"]) != latest_season:
            continue
        family = {
            "forward": "forwardLine",
            "defense": "defensePair",
            "power_play": "powerPlayUnit",
        }.get(str(row["deployment_group"]))
        if family is None:
            continue
        code = str(row["deployment_code"]).split("_", 1)[0]
        weight = 0.25 * float(row["share"]) * min(1.0, float(row["games"]) / 20.0)
        for team_id in row.get("team_ids") or []:
            bucket = evidence[(int(row["nhl_player_id"]), int(team_id))]
            bucket["families"][family][code] += weight
            bucket["sources"].add(str(row["source_table"]))
            bucket["confidenceWeight"] = max(bucket["confidenceWeight"], weight)

    as_of_time = datetime.fromisoformat(as_of.replace("Z", "+00:00"))
    latest_snapshots: dict[tuple[str, int], dict[str, Any]] = {}
    for row in snapshots:
        available = datetime.fromisoformat(str(row["available_at"]).replace("Z", "+00:00"))
        if available > as_of_time:
            continue
        key = (str(row["source_table"]), int(row["team_id"]))
        if key not in latest_snapshots or str(row["available_at"]) > str(latest_snapshots[key]["available_at"]):
            latest_snapshots[key] = row
    source_reliability = {"lines_nhl": 1.0, "lines_ccc": 0.85, "line_source_snapshots": 0.7}
    for row in latest_snapshots.values():
        available = datetime.fromisoformat(str(row["available_at"]).replace("Z", "+00:00"))
        age_days = max(0.0, (as_of_time - available).total_seconds() / 86400)
        freshness = math.exp(-age_days / 45.0)
        weight = source_reliability.get(str(row["source_table"]), 0.5) * freshness
        team_id = int(row["team_id"])
        for family, prefix, count in (
            ("forwardLine", "line", 4),
            ("defensePair", "pair", 3),
        ):
            role_prefix = "F" if family == "forwardLine" else "D"
            for number in range(1, count + 1):
                for player_id in row.get(f"{prefix}_{number}_player_ids") or []:
                    if player_id is None:
                        continue
                    bucket = evidence[(int(player_id), team_id)]
                    bucket["families"][family][f"{role_prefix}{number}"] += weight
                    bucket["sources"].add(str(row["source_table"]))
                    bucket["confidenceWeight"] = max(bucket["confidenceWeight"], weight)
        for number in (1, 2):
            player_id = row.get(f"goalie_{number}_player_id")
            if player_id is not None:
                bucket = evidence[(int(player_id), team_id)]
                bucket["families"]["goalieOrder"][f"G{number}"] += weight
                bucket["sources"].add(str(row["source_table"]))
                bucket["confidenceWeight"] = max(bucket["confidenceWeight"], weight)
        for player_id in row.get("injured_player_ids") or []:
            if player_id is None:
                continue
            evidence[(int(player_id), team_id)]["injuryWeight"] = max(
                evidence[(int(player_id), team_id)]["injuryWeight"], weight
            )
        for player_id in row.get("scratches_player_ids") or []:
            if player_id is None:
                continue
            evidence[(int(player_id), team_id)]["scratchWeight"] = max(
                evidence[(int(player_id), team_id)]["scratchWeight"], weight
            )
    return evidence


def train_season_artifact(freeze: Path, output: Path) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256:
        raise RuntimeError("season freeze contract checksum mismatch")
    assist_policy = manifest.get("assistLabelPolicy") or {}
    audit_path = (freeze / str(assist_policy.get("auditPath") or "")).resolve()
    try:
        audit_path.relative_to(freeze.resolve())
    except ValueError as error:
        raise RuntimeError("assist label audit path is outside the season freeze") from error
    if (
        not audit_path.is_file()
        or _file_sha256(audit_path) != assist_policy.get("auditSha256")
    ):
        raise RuntimeError("assist label audit checksum mismatch")
    assist_label_audit = read_json(audit_path)
    if (
        assist_label_audit.get("eligibleForTraining") is not True
        or int(assist_label_audit.get("unresolvedRows") or 0) != 0
        or int(assist_label_audit.get("invalidIdentityRows") or 0) != 0
        or assist_label_audit.get("predictiveFeatureUse") is not False
        or assist_policy.get("predictiveFeatureUse") is not False
    ):
        raise RuntimeError("assist label audit is not eligible for season training")
    output.mkdir(parents=True, exist_ok=False)
    skaters = [row for row in read_jsonl(freeze / "skaters.jsonl") if int(row["season_id"]) <= TRAINING_CUTOFF_SEASON]
    goalies = [row for row in read_jsonl(freeze / "goalies.jsonl") if int(row["season_id"]) <= TRAINING_CUTOFF_SEASON]
    pool = read_json(freeze / "player-pool.json")
    teams = read_json(freeze / "teams.json")
    team_rows = [row for row in read_jsonl(freeze / "team_history.jsonl") if int(row["season_id"]) <= TRAINING_CUTOFF_SEASON]
    defense_rows = [
        row for row in read_jsonl(freeze / "defense_history.jsonl")
        if int(row["season_id"]) <= TRAINING_CUTOFF_SEASON
    ] if (freeze / "defense_history.jsonl").exists() else []
    deployment_tallies = (
        list(read_jsonl(freeze / "deployment_tallies.jsonl"))
        if (freeze / "deployment_tallies.jsonl").exists() else []
    )
    line_snapshots = (
        list(read_jsonl(freeze / "line_snapshots.jsonl"))
        if (freeze / "line_snapshots.jsonl").exists() else []
    )
    deployment_evidence = _deployment_evidence(
        deployment_tallies,
        line_snapshots,
        str(manifest["createdAt"]),
    )
    adjusted_defense_by_nhl = _adjusted_defense_ratings(defense_rows)
    policies: dict[str, dict[str, Any]] = {"forward": {}, "defense": {}, "goalie": {}}
    rows_by_population = {
        "forward": [row for row in skaters if row["position"] != "D"],
        "defense": [row for row in skaters if row["position"] == "D"],
        "goalie": goalies,
    }
    fitted: dict[
        tuple[str, str],
        tuple[dict[int, tuple[float, float, float]], float, float, dict[str, Any]],
    ] = {}
    for population, rows in rows_by_population.items():
        targets = GOALIE_TARGETS if population == "goalie" else SKATER_TARGETS
        for target in targets:
            policy = _select_rate_policy(rows, target)
            summaries, (prior, _) = _weighted_summary(rows, target, policy["decay"])
            fitted[(population, target)] = (
                summaries,
                prior,
                policy["shrinkage"],
                policy,
            )
            policies[population][target] = {**policy, "populationPrior": prior}

    participation: dict[tuple[str, int], dict[int, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"appearances": 0.0, "starts": 0.0})
    )
    for population, rows in rows_by_population.items():
        for row in rows:
            season = int(row["season_id"])
            player_id = int(row["nhl_player_id"])
            participation[(population, player_id)][season]["appearances"] += float(
                row.get("GAMES_PLAYED") or 0
            )
            participation[(population, player_id)][season]["starts"] += float(
                row.get("GAMES_STARTED") or 0
            )
    population_participation_priors: dict[str, tuple[float, float]] = {}
    for population in rows_by_population:
        appearance_rates = [
            min(1.0, values["appearances"] / 82)
            for (row_population, _), seasons in participation.items()
            if row_population == population
            for values in seasons.values()
        ]
        start_rates = [
            min(1.0, values["starts"] / 82)
            for (row_population, _), seasons in participation.items()
            if row_population == population
            for values in seasons.values()
        ]
        population_participation_priors[population] = (
            median(appearance_rates) if appearance_rates else (0.8 if population != "goalie" else 0.4),
            median(start_rates) if start_rates else (0.0 if population != "goalie" else 0.3),
        )

    contexts = _team_contexts(team_rows, teams)
    player_artifacts: dict[str, Any] = {}
    offense_signals: dict[str, list[tuple[int, float]]] = defaultdict(list)
    defense_signals: dict[str, list[tuple[int, float]]] = defaultdict(list)
    goalie_signals: list[tuple[int, float]] = []
    draft: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for player in pool:
        nhl_id = player.get("nhl_player_id")
        position = str(player["position"])
        population = "goalie" if position == "G" else "defense" if position == "D" else "forward"
        rates: dict[str, float] = {}
        baseline_rates: dict[str, float] = {}
        variances: dict[str, float] = {}
        supports: list[float] = []
        targets = GOALIE_TARGETS if population == "goalie" else SKATER_TARGETS
        for target in targets:
            summaries, prior, shrinkage, policy = fitted[(population, target)]
            player_mean, support, variance = summaries.get(int(nhl_id), (prior, 0.0, max(prior, 0.05))) if nhl_id is not None else (prior, 0.0, max(prior, 0.05))
            rate = (support * player_mean + shrinkage * prior) / (support + shrinkage)
            baseline_rates[target] = (
                rate if policy.get("baselineModel") == "empirical_bayes_rate" else prior
            )
            coefficients = policy.get("penalizedGlmCoefficients")
            if policy.get("modelFamily") == "population_rate":
                rate = prior
            elif policy.get("modelFamily") == "penalized_glm" and coefficients:
                toi_summaries, toi_prior, toi_shrinkage, _ = fitted[
                    (population, "TOTAL_TOI")
                ]
                toi_rate, _, _ = _eb_rate(
                    toi_summaries,
                    int(nhl_id) if nhl_id is not None else -1,
                    toi_prior,
                    toi_shrinkage,
                )
                rate = _glm_prediction(coefficients, rate, toi_rate, target)
            rates[target] = max(0.0, rate) if target in NONNEGATIVE_TARGETS else rate
            variances[target] = max(variance, abs(rate), 0.01) * (2.25 if player["prior_based"] else 1.0)
            supports.append(support)
        sample_games = max(supports or [0.0])
        appearance_prior, start_prior = population_participation_priors[population]
        seasons = participation.get((population, int(nhl_id)), {}) if nhl_id is not None else {}
        appearance_total = sum(values["appearances"] for values in seasons.values())
        start_total = sum(values["starts"] for values in seasons.values())
        schedule_opportunities = 82.0 * len(seasons)
        availability_shrinkage = policies[population]["GAMES_PLAYED"]["shrinkage"]
        play_probability = (
            appearance_total + availability_shrinkage * appearance_prior
        ) / (schedule_opportunities + availability_shrinkage) if schedule_opportunities else appearance_prior
        start_probability = (
            start_total + availability_shrinkage * start_prior
        ) / (schedule_opportunities + availability_shrinkage) if schedule_opportunities else start_prior
        play_probability = min(0.995, max(0.05, play_probability))
        start_probability = min(play_probability, max(0.0, start_probability))
        player_deployment_evidence = (
            deployment_evidence.get((int(nhl_id), int(player["team_id"])))
            if nhl_id is not None and player.get("team_id") is not None
            else None
        )
        if player_deployment_evidence:
            availability_multiplier = max(
                0.1,
                1.0
                - 0.5 * float(player_deployment_evidence["injuryWeight"])
                - 0.7 * float(player_deployment_evidence["scratchWeight"]),
            )
            play_probability *= availability_multiplier
            start_probability = min(start_probability, play_probability)
        rating_signals: dict[str, float] = {}
        if population != "goalie":
            offense_signal = rates["GOALS"] + rates["PRIMARY_ASSISTS"] + rates["SECONDARY_ASSISTS"]
            offense_signals[position].append((int(player["fhfh_player_id"]), offense_signal))
            toi = max(rates["TOTAL_TOI"], 1.0)
            defense_signal = adjusted_defense_by_nhl.get(
                int(nhl_id) if nhl_id is not None else -1,
                rates["PLUS_MINUS"] * 3600 / toi,
            )
            defense_signals[position].append((int(player["fhfh_player_id"]), defense_signal))
            rating_signals = {
                "offenseRate": offense_signal,
                "defenseSuppressionPer60": defense_signal,
            }
        else:
            shots = max(rates["SHOTS_AGAINST_GOALIE"], 1e-9)
            goalie_save_rate = (shots - rates["GOALS_AGAINST_GOALIE"]) / shots
            goalie_signals.append((int(player["fhfh_player_id"]), goalie_save_rate))
            rating_signals = {"goalieSaveRate": goalie_save_rate}
        draft.append((player, {
            "population": population, "rates": rates, "variances": variances,
            "baselineRates": baseline_rates,
            "sampleGames": sample_games, "playProbability": play_probability,
            "startProbability": start_probability, "appearancePrior": appearance_prior,
            "startPrior": start_prior, "deploymentEvidence": player_deployment_evidence,
            "ratingSignals": rating_signals,
        }))

    offense_lookup = {
        player_id: _percentile([value for _, value in values], value)
        for position, values in offense_signals.items() for player_id, value in values
    }
    defense_lookup = {
        player_id: _percentile([value for _, value in values], value)
        for position, values in defense_signals.items() for player_id, value in values
    }
    goalie_lookup = {
        player_id: _percentile([value for _, value in goalie_signals], value)
        for player_id, value in goalie_signals
    }
    by_team_population: dict[tuple[int, str], list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(list)
    for player, model in draft:
        if player["team_id"] is not None:
            by_team_population[(int(player["team_id"]), model["population"])].append((player, model))
    ranks: dict[int, int] = {}
    for members in by_team_population.values():
        members.sort(key=lambda item: item[1]["rates"].get("TOTAL_TOI", 0), reverse=True)
        for index, (player, _) in enumerate(members, 1):
            ranks[int(player["fhfh_player_id"])] = index
    pp_ranks: dict[int, int] = {}
    pk_ranks: dict[int, int] = {}
    skaters_by_team: dict[int, list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(list)
    for player, model in draft:
        if player.get("team_id") is not None and model["population"] != "goalie":
            skaters_by_team[int(player["team_id"])].append((player, model))
    for members in skaters_by_team.values():
        for rank_lookup, target in ((pp_ranks, "PP_TOI"), (pk_ranks, "PK_TOI")):
            for index, (player, _) in enumerate(
                sorted(members, key=lambda item: item[1]["rates"].get(target, 0), reverse=True),
                1,
            ):
                rank_lookup[int(player["fhfh_player_id"])] = index

    for player, model in draft:
        fhfh_id = int(player["fhfh_player_id"])
        nhl_id = player.get("nhl_player_id")
        population = model["population"]
        rank = ranks.get(fhfh_id, 99)
        evidence = model.get("deploymentEvidence") or {}
        evidence_families = evidence.get("families") or {}

        def probabilities(family: str, fallback: dict[str, float]) -> dict[str, float]:
            observed = _normalized_role_probabilities(dict(evidence_families.get(family) or {}))
            return observed or fallback

        pp_rank = pp_ranks.get(fhfh_id, 99)
        pk_rank = pk_ranks.get(fhfh_id, 99)
        pp_unit = 1 if pp_rank <= 5 else 2 if pp_rank <= 10 else None
        pk_unit = 1 if pk_rank <= 4 else 2 if pk_rank <= 8 else None
        if population == "goalie":
            goalie_probabilities = probabilities(
                "goalieOrder",
                {f"G{min(rank, 3)}": 0.7, "other": 0.3},
            )
            role = {"goalieOrder": int(max(goalie_probabilities, key=goalie_probabilities.get)[1:])}
            role_probabilities = {"goalieOrder": goalie_probabilities}
        elif population == "defense":
            pair_probabilities = probabilities(
                "defensePair",
                {f"D{min(3, (rank + 1) // 2)}": 0.65, "other": 0.35},
            )
            pair_key = max(pair_probabilities, key=pair_probabilities.get)
            role = {
                "defensePair": int(pair_key[1:]) if pair_key.startswith("D") else min(3, (rank + 1) // 2),
                "powerPlayUnit": pp_unit,
                "penaltyKillUnit": pk_unit,
            }
            role_probabilities = {
                "defensePair": pair_probabilities,
                "powerPlayUnit": probabilities(
                    "powerPlayUnit",
                    {f"PP{pp_unit}": 0.65, "other": 0.35} if pp_unit else {"none": 1.0},
                ),
                "penaltyKillUnit": {f"PK{pk_unit}": 0.65, "other": 0.35} if pk_unit else {"none": 1.0},
            }
        else:
            line_probabilities = probabilities(
                "forwardLine",
                {f"F{min(4, (rank + 2) // 3)}": 0.65, "other": 0.35},
            )
            line_key = max(line_probabilities, key=line_probabilities.get)
            role = {
                "forwardLine": int(line_key[1:]) if line_key.startswith("F") else min(4, (rank + 2) // 3),
                "powerPlayUnit": pp_unit,
                "penaltyKillUnit": pk_unit,
            }
            role_probabilities = {
                "forwardLine": line_probabilities,
                "powerPlayUnit": probabilities(
                    "powerPlayUnit",
                    {f"PP{pp_unit}": 0.65, "other": 0.35} if pp_unit else {"none": 1.0},
                ),
                "penaltyKillUnit": {f"PK{pk_unit}": 0.65, "other": 0.35} if pk_unit else {"none": 1.0},
            }
        historical_confidence = min(1.0, math.sqrt(model["sampleGames"] / 82))
        evidence_confidence = min(1.0, float(evidence.get("confidenceWeight") or 0.0))
        confidence = max(historical_confidence * 0.75, evidence_confidence) * float(player["roster_confidence"])
        ratings = (
            {"goaltending": goalie_lookup.get(fhfh_id, 50.0)}
            if population == "goalie"
            else {
                "offense": offense_lookup.get(fhfh_id, 50.0),
                "defense": defense_lookup.get(fhfh_id, 50.0),
            }
        )
        player_artifacts[str(fhfh_id)] = {
            "fhfhPlayerId": fhfh_id,
            "nhlPlayerId": player["nhl_player_id"],
            "playerName": player["player_name"],
            "population": population,
            "position": player["position"],
            "teamId": player["team_id"],
            "poolStatus": player["pool_status"],
            "rosterConfidence": player["roster_confidence"],
            "playProbability": model["playProbability"],
            "startProbability": model["startProbability"] if population == "goalie" else None,
            "baselinePlayProbability": model["appearancePrior"],
            "baselineStartProbability": model["startPrior"] if population == "goalie" else None,
            "conditionalRates": model["rates"],
            "baselineConditionalRates": model["baselineRates"],
            "conditionalVariances": model["variances"],
            "ratings": ratings,
            "ratingSignals": model["ratingSignals"],
            "ratingConfidence": confidence,
            "sampleGames": int(round(model["sampleGames"])),
            "deployment": {
                "mostLikelyRole": role,
                "roleProbabilities": role_probabilities,
                "confidence": confidence,
                "expectedEvToi": model["rates"].get("EV_TOI", 0),
                "expectedPpToi": model["rates"].get("PP_TOI", 0),
                "expectedPkToi": model["rates"].get("PK_TOI", 0),
                "expectedTotalToi": model["rates"].get("TOTAL_TOI", 0),
                "sourceManifest": sorted(evidence.get("sources") or ["historical_role_tallies"]),
            },
            "fallbackFlags": _season_player_fallback_flags(
                bool(player["prior_based"]),
                population,
                int(nhl_id) if nhl_id is not None else None,
                adjusted_defense_by_nhl,
            ),
            "sourceProvenance": player["source_provenance"],
        }

    contexts = _roster_adjusted_team_contexts(contexts, player_artifacts)
    artifact = {
        "schemaVersion": "player-forecast-season-artifact-v1",
        "seasonId": SEASON_ID,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "artifactVersion": "historical-core-tournament-v2",
        "featureSchemaVersion": "player-forecast-season-historical-core-v3",
        "trainingCutoffAt": "2026-04-16T23:59:59Z",
        "codeVersion": "season-model-v7",
        "players": player_artifacts,
        "teams": contexts,
        "selectionEvidence": policies,
        "review": {
            "modelFamily": "target_specific_chronological_rate_tournament",
            "challengerFallbackPolicy": "baseline_is_served_when_no_valid_challenger_exists",
            "wgoSettledOutcomeLabelsUsed": bool(
                assist_label_audit.get("sourceCounts", {}).get(
                    "wgo_frozen_settled_outcome"
                )
            ),
            "wgoOrNstPredictiveFeaturesUsed": False,
            "assistLabelAudit": {
                "sha256": assist_policy["auditSha256"],
                "sourceCounts": assist_label_audit["sourceCounts"],
                "resolvedBoxScoreDisagreements": assist_label_audit[
                    "resolvedBoxScoreDisagreements"
                ],
                "unresolvedRows": 0,
                "invalidIdentityRows": 0,
                "detectedSourceConflictRows": int(
                    assist_label_audit.get("preResolutionSourceCounts", {}).get(
                        "source_conflict", 0
                    )
                ),
                "officialGamecenterCheckedRows": sum(
                    int(capture["checkedRows"])
                    for capture in assist_label_audit.get(
                        "officialGamecenterResolutions", []
                    )
                ),
                "officialGamecenterCorrectedRows": sum(
                    int(capture["correctedRows"])
                    for capture in assist_label_audit.get(
                        "officialGamecenterResolutions", []
                    )
                ),
            },
            "fixedAssistWeightingUsed": False,
            "consumed2025_26LockboxCalledBlind": False,
        },
    }
    schedule = read_json(freeze / "schedule.json")
    golden_vectors: list[dict[str, Any]] = []
    for player_key in sorted(player_artifacts, key=int):
        player = player_artifacts[player_key]
        team_id = player.get("teamId")
        if team_id is None:
            continue
        scheduled_game = next(
            (
                game for game in schedule
                if int(team_id) in (int(game["home_team_id"]), int(game["away_team_id"]))
            ),
            None,
        )
        if scheduled_game is None:
            continue
        is_home = int(scheduled_game["home_team_id"]) == int(team_id)
        game = {
            "game_id": int(scheduled_game["game_id"]),
            "team_id": int(team_id),
            "opponent_team_id": int(
                scheduled_game["away_team_id"] if is_home else scheduled_game["home_team_id"]
            ),
        }
        golden_vectors.append({
            "fhfhPlayerId": int(player_key),
            "game": {
                "gameId": game["game_id"],
                "scheduledStartAt": scheduled_game["scheduled_start_at"],
                "teamId": game["team_id"],
                "opponentTeamId": game["opponent_team_id"],
                "isHome": is_home,
            },
            "expected": evaluate_season_game(artifact, player, game),
        })
        if len(golden_vectors) == 3:
            break
    if len(golden_vectors) != 3:
        raise RuntimeError("unable to construct three deterministic season golden vectors")
    artifact["goldenVectors"] = golden_vectors
    write_json(output / "season-artifact.json", artifact)
    artifact_checksum = _file_sha256(output / "season-artifact.json")
    artifact_manifest = {
        "artifactPath": "season-artifact.json",
        "artifactChecksum": artifact_checksum,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "playerCount": len(player_artifacts),
        "teamCount": len(contexts),
        "selectionEvidenceHash": hashlib.sha256(canonical_json(policies).encode()).hexdigest(),
    }
    write_json(output / "artifact-manifest.json", artifact_manifest)
    write_json(output / "training-report.json", {
        **artifact_manifest,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "targetPolicies": policies,
        "limitations": [
            "2025-26 is training and validation evidence, not a new blind test",
            "prospect outputs use flagged population priors until prospective NHL evidence exists",
            "defense uses regularized on-ice shot-attempt and goal suppression adjusted for team and opponent; it is a cutoff-safe baseline rather than a proprietary xG model",
        ],
    })
    return artifact_manifest


def _round_number(value: float) -> int | float:
    rounded = round(float(value), 10)
    return int(rounded) if rounded.is_integer() else rounded


def _portable_canonical_json(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if not math.isfinite(float(value)):
            raise RuntimeError("portable canonical JSON requires finite numbers")
        rounded = _round_number(float(value))
        if isinstance(rounded, int):
            return str(rounded)
        return f"{rounded:.10f}".rstrip("0").rstrip(".")
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(_portable_canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            json.dumps(str(key), ensure_ascii=False) + ":" + _portable_canonical_json(value[key])
            for key in sorted(value)
        ) + "}"
    raise RuntimeError("unsupported portable canonical JSON value")


def _reconcile(values: dict[str, float], population: str) -> dict[str, float]:
    reconciled = {key: float(value) for key, value in values.items()}
    if population == "goalie":
        reconciled["SAVES_GOALIE"] = max(
            0.0,
            reconciled.get("SHOTS_AGAINST_GOALIE", 0.0)
            - reconciled.get("GOALS_AGAINST_GOALIE", 0.0),
        )
        shots = reconciled.get("SHOTS_AGAINST_GOALIE", 0.0)
        toi = reconciled.get("TOTAL_TOI", 0.0)
        reconciled["SAVE_PERCENTAGE"] = reconciled["SAVES_GOALIE"] / shots if shots > 0 else 0.0
        reconciled["GOALS_AGAINST_AVERAGE"] = (
            3600 * reconciled.get("GOALS_AGAINST_GOALIE", 0.0) / toi if toi > 0 else 0.0
        )
    else:
        reconciled["ASSISTS"] = (
            reconciled.get("PRIMARY_ASSISTS", 0.0)
            + reconciled.get("SECONDARY_ASSISTS", 0.0)
        )
        reconciled["POINTS"] = reconciled.get("GOALS", 0.0) + reconciled["ASSISTS"]
        reconciled["PP_POINTS"] = (
            reconciled.get("PP_GOALS", 0.0) + reconciled.get("PP_ASSISTS", 0.0)
        )
        reconciled["SH_POINTS"] = (
            reconciled.get("SH_GOALS", 0.0) + reconciled.get("SH_ASSISTS", 0.0)
        )
    return {key: _round_number(value) for key, value in reconciled.items()}


def _target_multiplier(
    target: str,
    population: str,
    team: dict[str, Any] | None,
    opponent: dict[str, Any] | None,
) -> float:
    pace = math.sqrt(
        max(0.5, float((team or {}).get("paceMultiplier", 1)))
        * max(0.5, float((opponent or {}).get("paceMultiplier", 1)))
    )
    if population == "goalie" and target in ("SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE"):
        return pace * max(0.5, float((opponent or {}).get("offenseMultiplier", 1)))
    if population != "goalie" and target in {
        "GOALS", "PRIMARY_ASSISTS", "SECONDARY_ASSISTS", "SHOTS_ON_GOAL",
        "PP_GOALS", "PP_ASSISTS", "SH_GOALS", "SH_ASSISTS",
    }:
        return pace / max(0.5, float((opponent or {}).get("defenseMultiplier", 1)))
    return pace


def _reconcile_quantiles(
    quantiles: dict[str, dict[str, float]],
    population: str,
    maximum_games: int | None = None,
) -> dict[str, dict[str, float]]:
    reconciled = {
        level: {target: float(value) for target, value in values.items()}
        for level, values in quantiles.items()
    }
    if maximum_games is not None:
        for values in reconciled.values():
            if "GAMES_PLAYED" in values:
                values["GAMES_PLAYED"] = min(
                    float(maximum_games),
                    max(0.0, values["GAMES_PLAYED"]),
                )
            if "GAMES_STARTED" in values:
                values["GAMES_STARTED"] = min(
                    float(maximum_games),
                    values.get("GAMES_PLAYED", float(maximum_games)),
                    max(0.0, values["GAMES_STARTED"]),
                )
    if population != "goalie":
        return {
            level: _reconcile(values, population)
            for level, values in reconciled.items()
        }

    p10, p50, p90 = (reconciled[level] for level in ("p10", "p50", "p90"))
    p10_shots = max(0.0, p10.get("SHOTS_AGAINST_GOALIE", 0.0))
    p50_shots = max(0.0, p50.get("SHOTS_AGAINST_GOALIE", 0.0))
    p90_shots = max(0.0, p90.get("SHOTS_AGAINST_GOALIE", 0.0))
    p10_goals = max(0.0, p10.get("GOALS_AGAINST_GOALIE", 0.0))
    p50_goals = max(0.0, p50.get("GOALS_AGAINST_GOALIE", 0.0))
    p90_goals = max(0.0, p90.get("GOALS_AGAINST_GOALIE", 0.0))
    p10_toi = max(0.0, p10.get("TOTAL_TOI", 0.0))
    p50_toi = max(0.0, p50.get("TOTAL_TOI", 0.0))
    p90_toi = max(0.0, p90.get("TOTAL_TOI", 0.0))

    p10_saves = max(0.0, p10_shots - p90_goals)
    p50_saves = max(0.0, p50_shots - p50_goals)
    p90_saves = max(p50_saves, p90_shots - p10_goals)
    p10["SAVES_GOALIE"] = p10_saves
    p50["SAVES_GOALIE"] = p50_saves
    p90["SAVES_GOALIE"] = p90_saves

    save_percentage = p50_saves / p50_shots if p50_shots > 0 else 0.0
    lower_save_percentage = p10_saves / p90_shots if p90_shots > 0 else 0.0
    upper_save_percentage = p90_saves / p10_shots if p10_shots > 0 else 1.0
    p10["SAVE_PERCENTAGE"] = min(save_percentage, max(0.0, lower_save_percentage))
    p50["SAVE_PERCENTAGE"] = min(1.0, max(0.0, save_percentage))
    p90["SAVE_PERCENTAGE"] = min(1.0, max(save_percentage, upper_save_percentage))

    gaa = 3600 * p50_goals / p50_toi if p50_toi > 0 else 0.0
    lower_gaa = 3600 * p10_goals / p90_toi if p90_toi > 0 else 0.0
    upper_gaa = 3600 * p90_goals / p10_toi if p10_toi > 0 else max(gaa, lower_gaa)
    p10["GOALS_AGAINST_AVERAGE"] = min(gaa, max(0.0, lower_gaa))
    p50["GOALS_AGAINST_AVERAGE"] = max(0.0, gaa)
    p90["GOALS_AGAINST_AVERAGE"] = max(gaa, upper_gaa)
    return {
        level: {target: _round_number(value) for target, value in values.items()}
        for level, values in reconciled.items()
    }


def _quantiles(
    means: dict[str, float],
    variances: dict[str, float],
    population: str,
    maximum_games: int | None = None,
) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {"p10": {}, "p50": {}, "p90": {}}
    for target, mean in means.items():
        deviation = math.sqrt(max(0.0, float(variances.get(target, 0.0))))
        lower = mean - 1.2815515655446004 * deviation
        if target != "PLUS_MINUS":
            lower = max(0.0, lower)
        result["p10"][target] = _round_number(lower)
        result["p50"][target] = _round_number(mean)
        result["p90"][target] = _round_number(max(lower, mean + 1.2815515655446004 * deviation))
    return _reconcile_quantiles(result, population, maximum_games)


def evaluate_season_game(
    artifact: dict[str, Any],
    player: dict[str, Any],
    game: dict[str, Any],
) -> dict[str, Any]:
    population = str(player["population"])
    targets = GOALIE_TARGETS if population == "goalie" else SKATER_TARGETS
    playing_probability = min(1.0, max(0.0, float(player["playProbability"])))
    start_probability = (
        min(playing_probability, max(0.0, float(player.get("startProbability") or 0)))
        if population == "goalie" else None
    )
    team = artifact["teams"].get(str(game["team_id"]))
    opponent = artifact["teams"].get(str(game["opponent_team_id"]))
    conditional: dict[str, float] = {}
    unconditional: dict[str, float] = {}
    baseline_unconditional: dict[str, float] = {}
    variances: dict[str, float] = {}
    for target in targets:
        if target in ("GAMES_PLAYED", "GAMES_STARTED"):
            mean = 1.0
        else:
            mean = float(player["conditionalRates"].get(target, 0.0)) * _target_multiplier(
                target, population, team, opponent
            )
            if target != "PLUS_MINUS":
                mean = max(0.0, mean)
        probability = start_probability if target == "GAMES_STARTED" else playing_probability
        probability = float(probability or 0.0)
        conditional_variance = max(
            0.0,
            float(player["conditionalVariances"].get(target, abs(mean)))
            * _target_multiplier(target, population, team, opponent),
        )
        conditional[target] = _round_number(mean)
        unconditional[target] = _round_number(mean * probability)
        if target in ("GAMES_PLAYED", "GAMES_STARTED"):
            baseline_mean = 1.0
        else:
            baseline_mean = float(
                player.get("baselineConditionalRates", player["conditionalRates"]).get(target, 0.0)
            ) * _target_multiplier(target, population, team, opponent)
            if target != "PLUS_MINUS":
                baseline_mean = max(0.0, baseline_mean)
        baseline_probability = (
            float(player.get("baselineStartProbability") or 0.0)
            if target == "GAMES_STARTED"
            else float(player.get("baselinePlayProbability", playing_probability))
        )
        baseline_unconditional[target] = _round_number(baseline_mean * baseline_probability)
        variances[target] = _round_number(
            probability * conditional_variance
            + probability * (1 - probability) * mean * mean
        )
    conditional = _reconcile(conditional, population)
    unconditional = _reconcile(unconditional, population)
    baseline_unconditional = _reconcile(baseline_unconditional, population)
    payload = {
        "gameId": int(game["game_id"]),
        "fhfhPlayerId": int(player["fhfhPlayerId"]),
        "teamId": int(game["team_id"]),
        "opponentTeamId": int(game["opponent_team_id"]),
        "population": population,
        "playingProbability": _round_number(playing_probability),
        "startProbability": _round_number(start_probability) if start_probability is not None else None,
        "conditionalMeans": conditional,
        "unconditionalMeans": unconditional,
        "baselineUnconditionalMeans": baseline_unconditional,
        "variances": variances,
        "quantiles": _quantiles(unconditional, variances, population, 1),
        "deployment": player["deployment"],
        "fallbackFlags": sorted(player.get("fallbackFlags") or []),
    }
    payload["componentHash"] = hashlib.sha256(_portable_canonical_json(payload).encode()).hexdigest()
    return payload


def _aggregate_components(components: list[dict[str, Any]], population: str) -> dict[str, Any]:
    means: dict[str, float] = defaultdict(float)
    variances: dict[str, float] = defaultdict(float)
    for component in components:
        for target, value in component["unconditionalMeans"].items():
            means[target] += float(value)
        for target, value in component["variances"].items():
            variances[target] += float(value)
    reconciled = _reconcile(dict(means), population)
    rounded_variances = {key: _round_number(value) for key, value in variances.items()}
    manifest = sorted(
        (
            {"gameId": int(component["gameId"]), "componentHash": component["componentHash"]}
            for component in components
        ),
        key=lambda row: row["gameId"],
    )
    unsigned = {
        "means": reconciled,
        "variances": rounded_variances,
        "quantiles": _quantiles(
            reconciled,
            rounded_variances,
            population,
            len(components),
        ),
        "componentManifest": manifest,
    }
    return {
        **unsigned,
        "aggregateHash": hashlib.sha256(_portable_canonical_json(unsigned).encode()).hexdigest(),
    }


def _actuals_by_player(freeze: Path, cutoff_at: str) -> dict[int, dict[str, float]]:
    actuals: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    cutoff = datetime.fromisoformat(cutoff_at.replace("Z", "+00:00"))
    starts = {
        int(row["game_id"]): datetime.fromisoformat(str(row["start_time"]).replace("Z", "+00:00"))
        for row in read_jsonl(freeze / "games.jsonl")
        if row.get("start_time")
    }
    for name, population in (("skaters.jsonl", "skater"), ("goalies.jsonl", "goalie")):
        for row in read_jsonl(freeze / name):
            if int(row["season_id"]) != SEASON_ID:
                continue
            game_start = starts.get(int(row["game_id"]))
            available_at = row.get("source_available_at")
            if game_start is None or game_start >= cutoff or not available_at:
                continue
            available = datetime.fromisoformat(str(available_at).replace("Z", "+00:00"))
            if available > cutoff:
                continue
            player_id = int(row["nhl_player_id"])
            targets = GOALIE_TARGETS if population == "goalie" else SKATER_TARGETS
            for target in targets:
                actuals[player_id][target] += float(row.get(target) or 0)
    return {player_id: dict(values) for player_id, values in actuals.items()}


def build_season_settlement_bundle(
    freeze: Path,
    output: Path,
    cutoff_at: str,
) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256:
        raise RuntimeError("season freeze contract checksum mismatch")
    output.mkdir(parents=True, exist_ok=False)
    cutoff = datetime.fromisoformat(cutoff_at.replace("Z", "+00:00"))
    schedule = {int(row["game_id"]): row for row in read_json(freeze / "schedule.json")}
    identity_by_nhl = {
        int(row["nhl_player_id"]): int(row["fhfh_player_id"])
        for row in read_json(freeze / "player-pool.json")
        if row.get("nhl_player_id") is not None
    }
    outcomes: list[dict[str, Any]] = []
    skipped_unmapped: set[int] = set()
    completed_game_availability: dict[int, str] = {}
    for file_name, is_goalie in (("skaters.jsonl", False), ("goalies.jsonl", True)):
        for row in read_jsonl(freeze / file_name):
            if int(row["season_id"]) != SEASON_ID:
                continue
            game = schedule.get(int(row["game_id"]))
            if not game or game.get("game_status") != "final":
                continue
            start = datetime.fromisoformat(str(game["scheduled_start_at"]).replace("Z", "+00:00"))
            available_at = row.get("source_available_at")
            if start >= cutoff or not available_at:
                continue
            available = datetime.fromisoformat(str(available_at).replace("Z", "+00:00"))
            if available > cutoff:
                continue
            completed_game_availability[int(row["game_id"])] = max(
                completed_game_availability.get(int(row["game_id"]), str(available_at)),
                str(available_at),
            )
            nhl_player_id = int(row["nhl_player_id"])
            fhfh_player_id = identity_by_nhl.get(nhl_player_id)
            if fhfh_player_id is None:
                skipped_unmapped.add(nhl_player_id)
                continue
            position = str(row.get("position") or "G")
            population = "goalie" if is_goalie else "defense" if position == "D" else "forward"
            targets = GOALIE_TARGETS if is_goalie else SKATER_TARGETS
            primitive_values = {
                target: _round_number(float(row.get(target) or 0))
                for target in targets
            }
            finality = "final" if cutoff.timestamp() >= start.timestamp() + 48 * 3600 else "provisional"
            unsigned = {
                "gameId": int(row["game_id"]),
                "fhfhPlayerId": fhfh_player_id,
                "nhlPlayerId": nhl_player_id,
                "population": population,
                "primitiveValues": primitive_values,
                "observedAt": str(available_at),
                "availableAt": str(available_at),
                "eligibleFinality": finality,
                "source": "nhl_gamecenter_normalized_from_immutable_capture",
                "sourceRevisionKey": hashlib.sha256(
                    _portable_canonical_json({
                        "gameId": int(row["game_id"]),
                        "nhlPlayerId": nhl_player_id,
                        "primitiveValues": primitive_values,
                        "sourceAvailableAt": str(available_at),
                    }).encode()
                ).hexdigest(),
            }
            outcomes.append({
                **unsigned,
                "revisionHash": hashlib.sha256(_portable_canonical_json(unsigned).encode()).hexdigest(),
                "provenance": {
                    "scheduleRevisionHash": manifest["scheduleRevisionHash"],
                    "sourceFile": file_name,
                    "availabilityPolicy": "immutable Gamecenter capture fetched_at; never synthesized",
                },
            })
    outcomes.sort(key=lambda row: (row["gameId"], row["fhfhPlayerId"]))
    count, checksum = write_jsonl(output / "outcomes.jsonl", outcomes)
    bundle = {
        "schemaVersion": "player-forecast-season-settlement-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "seasonId": SEASON_ID,
        "cutoffAt": cutoff_at,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "scheduleRevisionHash": manifest["scheduleRevisionHash"],
        "outcomes": {"path": "outcomes.jsonl", "rows": count, "sha256": checksum},
        "completedGames": [
            {
                "gameId": game_id,
                "availableAt": available_at,
                "finality": (
                    "final"
                    if cutoff.timestamp() >= datetime.fromisoformat(
                        str(schedule[game_id]["scheduled_start_at"]).replace("Z", "+00:00")
                    ).timestamp() + 48 * 3600
                    else "provisional"
                ),
            }
            for game_id, available_at in sorted(completed_game_availability.items())
        ],
        "skippedUnmappedNhlPlayerIds": sorted(skipped_unmapped),
    }
    bundle["bundleHash"] = hashlib.sha256(_portable_canonical_json(bundle).encode()).hexdigest()
    write_json(output / "settlement-manifest.json", bundle)
    return bundle


def verify_season_settlement_bundle(bundle_path: Path) -> dict[str, Any]:
    root = bundle_path if bundle_path.is_dir() else bundle_path.parent
    manifest_path = root / "settlement-manifest.json" if bundle_path.is_dir() else bundle_path
    bundle = read_json(manifest_path)
    issues: list[str] = []
    if bundle.get("schemaVersion") != "player-forecast-season-settlement-v1":
        issues.append("settlement schema mismatch")
    if bundle.get("seasonId") != SEASON_ID:
        issues.append("season id mismatch")
    if bundle.get("contractChecksum") != SEASON_CONTRACT_SHA256:
        issues.append("contract checksum mismatch")
    unsigned = {key: value for key, value in bundle.items() if key != "bundleHash"}
    expected_bundle_hash = hashlib.sha256(_portable_canonical_json(unsigned).encode()).hexdigest()
    if bundle.get("bundleHash") != expected_bundle_hash:
        issues.append("settlement bundle hash mismatch")
    metadata = bundle.get("outcomes") or {}
    path = root / str(metadata.get("path") or "")
    if not path.is_file():
        issues.append("outcomes file is missing")
        rows: list[dict[str, Any]] = []
    else:
        if _file_sha256(path) != metadata.get("sha256"):
            issues.append("outcomes checksum mismatch")
        rows = list(read_jsonl(path))
        if len(rows) != int(metadata.get("rows", -1)):
            issues.append("outcomes row count mismatch")
    seen: set[tuple[int, int]] = set()
    completed_games = bundle.get("completedGames") or []
    if not isinstance(completed_games, list):
        issues.append("completed games manifest is invalid")
        completed_games = []
    completed_ids = {int(row["gameId"]) for row in completed_games}
    for row in rows:
        key = (int(row["gameId"]), int(row["fhfhPlayerId"]))
        if key in seen:
            issues.append(f"duplicate outcome {key[0]}:{key[1]}")
            continue
        seen.add(key)
        if row.get("eligibleFinality") not in {"provisional", "final"}:
            issues.append(f"invalid finality for {key[0]}:{key[1]}")
        if key[0] not in completed_ids:
            issues.append(f"outcome game missing from completed manifest {key[0]}")
        if str(row.get("availableAt")) < str(row.get("observedAt")):
            issues.append(f"availability precedes observation for {key[0]}:{key[1]}")
        unsigned_row = {key: value for key, value in row.items() if key not in {"revisionHash", "provenance"}}
        if hashlib.sha256(_portable_canonical_json(unsigned_row).encode()).hexdigest() != row.get("revisionHash"):
            issues.append(f"revision hash mismatch for {key[0]}:{key[1]}")
    return {
        "valid": not issues,
        "issues": issues,
        "outcomes": len(rows),
        "skippedUnmappedNhlPlayerIds": bundle.get("skippedUnmappedNhlPlayerIds") or [],
    }


def _add_actuals(
    values: dict[str, float],
    actuals: dict[str, float],
    population: str,
) -> dict[str, float]:
    return _reconcile(
        {
            target: float(value) + float(actuals.get(target, 0.0))
            for target, value in values.items()
        },
        population,
    )


def _team_deployment(players: list[dict[str, Any]]) -> dict[str, Any]:
    forwards = sorted(
        (player for player in players if player["population"] == "forward"),
        key=lambda player: float(player["conditionalRates"].get("TOTAL_TOI", 0)),
        reverse=True,
    )
    defense = sorted(
        (player for player in players if player["population"] == "defense"),
        key=lambda player: float(player["conditionalRates"].get("TOTAL_TOI", 0)),
        reverse=True,
    )
    goalies = sorted(
        (player for player in players if player["population"] == "goalie"),
        key=lambda player: float(player.get("startProbability") or 0),
        reverse=True,
    )
    return {
        "forwardLines": [
            [player["fhfhPlayerId"] for player in forwards[index:index + 3]]
            for index in range(0, min(len(forwards), 12), 3)
        ],
        "defensePairs": [
            [player["fhfhPlayerId"] for player in defense[index:index + 2]]
            for index in range(0, min(len(defense), 6), 2)
        ],
        "powerPlayUnits": [
            [player["fhfhPlayerId"] for player in sorted(
                forwards + defense,
                key=lambda player: float(player["conditionalRates"].get("PP_TOI", 0)),
                reverse=True,
            )[index:index + 5]]
            for index in (0, 5)
        ],
        "penaltyKillUnits": [
            [player["fhfhPlayerId"] for player in sorted(
                forwards + defense,
                key=lambda player: float(player["conditionalRates"].get("PK_TOI", 0)),
                reverse=True,
            )[index:index + 4]]
            for index in (0, 4)
        ],
        "goalieOrder": [player["fhfhPlayerId"] for player in goalies[:3]],
    }


def project_season_release(
    freeze: Path,
    artifact_path: Path,
    output: Path,
    view: str,
    cutoff_at: str,
) -> dict[str, Any]:
    if view not in ("opening", "current", "ros"):
        raise RuntimeError("season projection view must be opening, current, or ros")
    manifest = read_json(freeze / "manifest.json")
    artifact = read_json(artifact_path)
    if (
        artifact.get("contractVersion") != SEASON_CONTRACT_VERSION
        or artifact.get("contractChecksum") != SEASON_CONTRACT_SHA256
        or artifact.get("seasonId") != SEASON_ID
    ):
        raise RuntimeError("season artifact contract mismatch")
    output.mkdir(parents=True, exist_ok=False)
    schedule = read_json(freeze / "schedule.json")
    cutoff = datetime.fromisoformat(cutoff_at.replace("Z", "+00:00"))
    remaining_schedule = [
        game for game in schedule
        if datetime.fromisoformat(str(game["scheduled_start_at"]).replace("Z", "+00:00")) > cutoff
        and game["game_status"] != "cancelled"
    ]
    by_team: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for game in remaining_schedule:
        by_team[int(game["home_team_id"])].append({
            **game,
            "team_id": int(game["home_team_id"]),
            "opponent_team_id": int(game["away_team_id"]),
            "is_home": True,
        })
        by_team[int(game["away_team_id"])].append({
            **game,
            "team_id": int(game["away_team_id"]),
            "opponent_team_id": int(game["home_team_id"]),
            "is_home": False,
        })
    actuals = _actuals_by_player(freeze, cutoff_at) if view == "current" else {}
    game_outputs: list[dict[str, Any]] = []
    player_aggregates: list[dict[str, Any]] = []
    artifact_players = list(artifact["players"].values())
    for player in sorted(artifact_players, key=lambda row: int(row["fhfhPlayerId"])):
        team_id = player.get("teamId")
        games = by_team.get(int(team_id), []) if team_id is not None else []
        components = [evaluate_season_game(artifact, player, game) for game in games]
        game_outputs.extend(components)
        aggregate = _aggregate_components(components, str(player["population"]))
        player_actuals = actuals.get(int(player.get("nhlPlayerId") or -1), {})
        means = (
            _add_actuals(aggregate["means"], player_actuals, str(player["population"]))
            if view == "current" else aggregate["means"]
        )
        quantiles = {
            key: (
                _add_actuals(values, player_actuals, str(player["population"]))
                if view == "current" else values
            )
            for key, values in aggregate["quantiles"].items()
        }
        quantiles = _reconcile_quantiles(quantiles, str(player["population"]))
        player_aggregates.append({
            "fhfh_player_id": int(player["fhfhPlayerId"]),
            "team_id": team_id,
            "player_name": player["playerName"],
            "position": player["position"],
            "population": player["population"],
            "pool_status": player["poolStatus"],
            "roster_confidence": player["rosterConfidence"],
            "expected_games": means.get("GAMES_PLAYED", 0),
            "expected_starts": means.get("GAMES_STARTED") if player["population"] == "goalie" else None,
            "expected_toi": {
                "total": means.get("TOTAL_TOI", 0),
                "evenStrength": means.get("EV_TOI", 0),
                "powerPlay": means.get("PP_TOI", 0),
                "penaltyKill": means.get("PK_TOI", 0),
            },
            "ratings": {
                key: {
                    "value": value,
                    "confidence": player["ratingConfidence"],
                    "sampleGames": player["sampleGames"],
                    "modelVersion": artifact["artifactVersion"],
                }
                for key, value in player["ratings"].items()
            },
            "deployment": player["deployment"],
            "model_means": means,
            "p10": quantiles["p10"],
            "p50": quantiles["p50"],
            "p90": quantiles["p90"],
            "component_manifest": aggregate["componentManifest"],
            "fallback_flags": player.get("fallbackFlags") or [],
            "provenance": {
                "artifactVersion": artifact["artifactVersion"],
                "featureSchemaVersion": artifact["featureSchemaVersion"],
                "source": "historical_core",
            },
            "aggregate_hash": aggregate["aggregateHash"],
        })
    by_current_team: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for player in artifact_players:
        if player.get("teamId") is not None and player.get("poolStatus") != "excluded":
            by_current_team[int(player["teamId"])].append(player)
    team_names = {int(team["team_id"]): team for team in read_json(freeze / "teams.json")}
    team_aggregates = []
    for raw_team_id, context in sorted(artifact["teams"].items(), key=lambda item: int(item[0])):
        team_id = int(raw_team_id)
        team = team_names[team_id]
        members = by_current_team.get(team_id, [])
        counts = {
            "forwards": sum(player["population"] == "forward" for player in members),
            "defensemen": sum(player["population"] == "defense" for player in members),
            "goalies": sum(player["population"] == "goalie" for player in members),
        }
        ratings = {
            key: {
                "value": value,
                "confidence": min(1.0, context["sampleGames"] / 82),
                "sampleGames": context["sampleGames"],
                "modelVersion": artifact["artifactVersion"],
            }
            for key, value in context["ratings"].items()
        }
        unsigned = {
            "teamId": team_id,
            "ratings": ratings,
            "deployment": _team_deployment(members),
            "rosterCounts": counts,
            "scheduleNeutralGoalDifferential": context["scheduleNeutralGoalDifferential"],
        }
        team_aggregates.append({
            "team_id": team_id,
            "team_name": team["name"],
            "abbreviation": team["abbreviation"],
            "ratings": ratings,
            "deployment": unsigned["deployment"],
            "roster_counts": counts,
            "schedule_neutral_goal_differential": context["scheduleNeutralGoalDifferential"],
            "confidence": min(1.0, context["sampleGames"] / 82),
            "provenance": {
                "artifactVersion": artifact["artifactVersion"],
                "source": "official_historical_core",
            },
            "aggregate_hash": hashlib.sha256(canonical_json(unsigned).encode()).hexdigest(),
        })
    files: dict[str, Any] = {}
    for name, rows in (
        ("game-outputs", game_outputs),
        ("player-aggregates", player_aggregates),
        ("team-aggregates", team_aggregates),
    ):
        count, checksum = write_jsonl(output / f"{name}.jsonl", rows)
        files[name] = {"path": f"{name}.jsonl", "rows": count, "sha256": checksum}
    artifact_checksum = _file_sha256(artifact_path)
    run_hash = hashlib.sha256(canonical_json({
        "artifactChecksum": artifact_checksum,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "cutoffAt": cutoff_at,
        "view": view,
        "scheduleRevisionHash": manifest["scheduleRevisionHash"],
        "rosterRevisionHash": manifest["rosterRevisionHash"],
        "files": files,
    }).encode()).hexdigest()
    freeze_inputs = {
        "schedule": (freeze / "schedule.json", len(schedule)),
        "playerPool": (
            freeze / "player-pool.json",
            len(read_json(freeze / "player-pool.json")),
        ),
        "playerPoolReview": (
            freeze / "player-pool-review.json",
            len(read_json(freeze / "player-pool-review.json")),
        ),
        "teams": (freeze / "teams.json", len(read_json(freeze / "teams.json"))),
        "season": (freeze / "season.json", 1),
        "deploymentTallies": (
            freeze / "deployment_tallies.jsonl",
            sum(1 for _ in read_jsonl(freeze / "deployment_tallies.jsonl")),
        ),
        "lineSnapshots": (
            freeze / "line_snapshots.jsonl",
            sum(1 for _ in read_jsonl(freeze / "line_snapshots.jsonl")),
        ),
    }
    bundle = {
        "schemaVersion": "player-forecast-season-import-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "freezeCreatedAt": manifest["createdAt"],
        "seasonId": SEASON_ID,
        "view": view,
        "cutoffAt": cutoff_at,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "artifactPath": str(artifact_path.resolve()),
        "artifactChecksum": artifact_checksum,
        "artifactVersion": artifact["artifactVersion"],
        "featureSchemaVersion": artifact["featureSchemaVersion"],
        "trainingCutoffAt": artifact["trainingCutoffAt"],
        "codeVersion": artifact["codeVersion"],
        "scheduleRevisionHash": manifest["scheduleRevisionHash"],
        "rosterRevisionHash": manifest["rosterRevisionHash"],
        "sourceHighWatermark": cutoff_at,
        "runHash": run_hash,
        "files": files,
        **{
            name: {
                "path": str(path.resolve()),
                "rows": rows,
                "sha256": _file_sha256(path),
            }
            for name, (path, rows) in freeze_inputs.items()
        },
    }
    write_json(output / "import-manifest.json", bundle)
    return bundle


def verify_season_release_bundle(bundle_path: Path) -> dict[str, Any]:
    bundle = read_json(bundle_path / "import-manifest.json" if bundle_path.is_dir() else bundle_path)
    root = bundle_path if bundle_path.is_dir() else bundle_path.parent
    issues: list[str] = []
    if bundle.get("contractChecksum") != SEASON_CONTRACT_SHA256:
        issues.append("contract checksum mismatch")
    if bundle.get("seasonId") != SEASON_ID:
        issues.append("season id mismatch")
    for name, metadata in bundle.get("files", {}).items():
        path = root / metadata["path"]
        if not path.exists():
            issues.append(f"{name} is missing")
            continue
        if _file_sha256(path) != metadata["sha256"]:
            issues.append(f"{name} checksum mismatch")
        rows = sum(1 for _ in read_jsonl(path))
        if rows != int(metadata["rows"]):
            issues.append(f"{name} row count mismatch")
    for name in (
        "schedule", "playerPool", "playerPoolReview", "teams", "season",
        "deploymentTallies", "lineSnapshots",
    ):
        metadata = bundle.get(name)
        if not isinstance(metadata, dict):
            issues.append(f"{name} metadata is missing")
            continue
        path = Path(str(metadata.get("path", "")))
        if not path.exists():
            issues.append(f"{name} is missing")
            continue
        if _file_sha256(path) != metadata.get("sha256"):
            issues.append(f"{name} checksum mismatch")
        if path.suffix == ".jsonl":
            rows = sum(1 for _ in read_jsonl(path))
        else:
            raw = read_json(path)
            rows = len(raw) if isinstance(raw, list) else 1
        if rows != int(metadata.get("rows", -1)):
            issues.append(f"{name} row count mismatch")
    players = list(read_jsonl(root / bundle["files"]["player-aggregates"]["path"]))
    teams = list(read_jsonl(root / bundle["files"]["team-aggregates"]["path"]))
    if len(teams) != 32:
        issues.append(f"expected 32 team aggregates, found {len(teams)}")
    for player in players:
        population = str(player["population"])
        reconciled = _reconcile(dict(player["model_means"]), population)
        for target, value in reconciled.items():
            if not math.isclose(float(player["model_means"].get(target, value)), float(value), rel_tol=1e-8, abs_tol=1e-8):
                issues.append(f"player {player['fhfh_player_id']} derived identity failed for {target}")
                break
        for target in player["p50"]:
            if not (
                float(player["p10"].get(target, 0))
                <= float(player["p50"].get(target, 0))
                <= float(player["p90"].get(target, 0))
            ):
                issues.append(f"player {player['fhfh_player_id']} quantile order failed for {target}")
                break
        if not 0 <= float(player["expected_games"]) <= 84:
            issues.append(f"player {player['fhfh_player_id']} expected games is outside [0,84]")
    return {
        "valid": not issues,
        "issues": issues,
        "contractVersion": SEASON_CONTRACT_VERSION,
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "playerCount": len(players),
        "teamCount": len(teams),
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
    }

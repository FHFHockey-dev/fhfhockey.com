from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .contract import (
    GAME_TYPE,
    TARGET_SEASON,
    VALIDATION_CONTRACT_SHA256,
    VALIDATION_CONTRACT_VERSION,
)
from .database import readonly_connection, stream_query
from .freeze import GAME_QUERY, GOALIE_QUERY
from .io import write_json, write_jsonl


CHALLENGER_SKATER_QUERY = """
with assist_labels as (
  select gameid as game_id, player_id,
         sum(primary_assists)::integer as primary_assists,
         sum(secondary_assists)::integer as secondary_assists
  from (
    select gameid, assist1playerid as player_id, 1 as primary_assists, 0 as secondary_assists
    from public.pbp_plays
    where typedesckey = 'goal' and assist1playerid is not null
    union all
    select gameid, assist2playerid as player_id, 0 as primary_assists, 1 as secondary_assists
    from public.pbp_plays
    where typedesckey = 'goal' and assist2playerid is not null
  ) labels
  group by gameid, player_id
),
roster_team as (
  select game_id, player_id, min(team_id) as team_id
  from public.nhl_api_game_roster_spots
  group by game_id, player_id
),
shift_team as (
  select game_id, player_id, min(team_id) as team_id
  from public.shift_charts
  group by game_id, player_id
)
select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
       g."startTime"::text as start_time,
       s."playerId" as player_id, p.position::text as position,
       coalesce(rt.team_id, st.team_id) as team_id,
       case when rt.team_id is not null then 'official_game_roster'
            when st.team_id is not null then 'official_shift_chart'
            else null end as team_identity_source,
       s.goals, s.assists,
       coalesce(al.primary_assists, 0) as primary_assists,
       coalesce(al.secondary_assists, 0) as secondary_assists,
       (coalesce(al.primary_assists, 0) + coalesce(al.secondary_assists, 0) = s.assists)
         as official_assist_decomposition_complete,
       s.shots as shots_on_goal, s."blockedShots" as blocked_shots,
       s.hits, s.pim as penalty_minutes, s.toi
from public."skatersGameStats" s
join public.games g on g.id = s."gameId"
join public.players p on p.id = s."playerId"
left join assist_labels al on al.game_id = g.id and al.player_id = s."playerId"
left join roster_team rt on rt.game_id = g.id and rt.player_id = s."playerId"
left join shift_team st on st.game_id = g.id and st.player_id = s."playerId"
where g."seasonId" = any(%s) and g.type = %s
order by g.date, g.id, s."playerId"
"""


def freeze_challenger_dataset(
    database_url: str,
    output: Path,
    history_seasons: list[int],
    target_season: int = TARGET_SEASON,
) -> dict[str, Any]:
    seasons = sorted(set(history_seasons + [target_season]))
    output.mkdir(parents=True, exist_ok=False)
    files: dict[str, dict[str, Any]] = {}
    queries = (
        ("games", GAME_QUERY),
        ("skaters", CHALLENGER_SKATER_QUERY),
        ("goalies", GOALIE_QUERY),
    )
    with readonly_connection(database_url) as connection:
        for name, query in queries:
            count, checksum = write_jsonl(
                output / f"{name}.jsonl",
                stream_query(
                    connection,
                    f"player_forecast_validation_{name}",
                    query,
                    (seasons, GAME_TYPE),
                ),
            )
            files[name] = {"path": f"{name}.jsonl", "rows": count, "sha256": checksum}
    manifest = {
        "schemaVersion": "2.0.0-validation",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": VALIDATION_CONTRACT_VERSION,
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "baseLockboxContractPreserved": True,
        "targetSeason": target_season,
        "historySeasons": [season for season in seasons if season != target_season],
        "gameType": GAME_TYPE,
        "featureTrack": "historical_core_validation_challenger",
        "evidenceKind": "validation_after_consumed_lockbox",
        "promotionEligible": False,
        "files": files,
        "sourceSemantics": {
            "assistLabels": "official_nhl_play_by_play_settled_outcome_only",
            "teamIdentity": "actual_game_roster_or_shift_outcome_identity",
            "historicalSchedule": "final_schedule_reconstructed_validation",
            "providerConditionalInputsIncluded": False,
        },
    }
    write_json(output / "manifest.json", manifest)
    return manifest

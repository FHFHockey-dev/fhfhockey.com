from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import shutil
from pathlib import Path
from typing import Any

from .contract import CONTRACT_SHA256, CONTRACT_VERSION, GAME_TYPE, TARGET_SEASON
from .database import readonly_connection, stream_query
from .io import canonical_json, read_json, write_json, write_jsonl

GAME_QUERY = """
select id, date::text, "seasonId" as season_id, "startTime"::text as start_time,
       type, "homeTeamId" as home_team_id, "awayTeamId" as away_team_id
from public.games
where "seasonId" = any(%s) and type = %s
order by date, id
"""

SKATER_QUERY = """
select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
       s."playerId" as player_id, p.position::text as position,
       s.goals, s.assists, s.shots as shots_on_goal, s."blockedShots" as blocked_shots,
       s.hits, s.pim as penalty_minutes, s.toi
from public."skatersGameStats" s
join public.games g on g.id = s."gameId"
join public.players p on p.id = s."playerId"
where g."seasonId" = any(%s) and g.type = %s
order by g.date, g.id, s."playerId"
"""

GOALIE_QUERY = """
select g.date::text as game_date, g."seasonId" as season_id, g.id as game_id,
       s."playerId" as player_id, 'G'::text as position,
       coalesce(nullif(split_part(s."saveShotsAgainst", '/', 2), '')::integer, 0) as shots_against,
       s."goalsAgainst" as goals_against, s.toi
from public."goaliesGameStats" s
join public.games g on g.id = s."gameId"
where g."seasonId" = any(%s) and g.type = %s
order by g.date, g.id, s."playerId"
"""


def freeze_dataset(
    database_url: str,
    output: Path,
    history_seasons: list[int],
    target_season: int = TARGET_SEASON,
    evidence_kind: str = "primary_lockbox",
) -> dict[str, Any]:
    seasons = sorted(set(history_seasons + [target_season]))
    output.mkdir(parents=True, exist_ok=False)
    files: dict[str, dict[str, Any]] = {}
    with readonly_connection(database_url) as connection:
        for name, query in (("games", GAME_QUERY), ("skaters", SKATER_QUERY), ("goalies", GOALIE_QUERY)):
            count, checksum = write_jsonl(
                output / f"{name}.jsonl",
                stream_query(connection, f"player_forecast_{name}", query, (seasons, GAME_TYPE)),
            )
            files[name] = {"path": f"{name}.jsonl", "rows": count, "sha256": checksum}
    manifest = {
        "schemaVersion": "1.0.0",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": CONTRACT_VERSION,
        "contractChecksum": CONTRACT_SHA256,
        "targetSeason": target_season,
        "historySeasons": [season for season in seasons if season != target_season],
        "gameType": GAME_TYPE,
        "featureTrack": "historical_core",
        "files": files,
        "evidenceKind": evidence_kind,
    }
    if evidence_kind == "primary_lockbox":
        manifest["lockbox"] = {
            "sealed": True,
            "evaluationsAllowed": 1,
            "availabilityTargetsIncluded": False,
        }
    write_json(output / "manifest.json", manifest)
    return manifest


def freeze_prospective_dataset(
    database_url: str,
    output: Path,
    history_seasons: list[int],
    artifact_path: Path,
    primary_receipt_path: Path,
) -> dict[str, Any]:
    artifact = read_json(artifact_path)
    receipt = read_json(primary_receipt_path)
    unsigned_artifact = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    unsigned_receipt = {key: value for key, value in receipt.items() if key != "receiptChecksum"}
    if hashlib.sha256(canonical_json(unsigned_artifact).encode()).hexdigest() != artifact.get("artifactChecksum"):
        raise RuntimeError("model artifact checksum mismatch")
    if hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest() != receipt.get("receiptChecksum"):
        raise RuntimeError("primary lockbox receipt checksum mismatch")
    if artifact.get("artifactChecksum") != receipt.get("artifactChecksum"):
        raise RuntimeError("prospective freeze requires the unchanged primary artifact")
    manifest = freeze_dataset(
        database_url,
        output,
        history_seasons,
        target_season=20262027,
        evidence_kind="untouched_prospective",
    )
    shutil.copyfile(artifact_path, output / "model-artifact.json")
    manifest["prospective"] = {
        "primaryReceiptChecksum": receipt["receiptChecksum"],
        "artifactChecksum": artifact["artifactChecksum"],
        "tuningPermitted": False,
    }
    write_json(output / "manifest.json", manifest)
    return manifest

"""Capture one game's official club rosters before puck drop, outside the repository.

Club rosters define an observed candidate population, not a confirmed lineup or
proof of participation. Missing outcome rows never become negative labels.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .contract import repository_root
from .daily_board_data import validate_range
from .daily_board_settlement import _timestamp, fetch_official_json
from .io import assert_output_outside_repository, canonical_json, read_json, write_json, write_jsonl

VERSION = "starter-board-pregame-candidates-v1"


def normalize_candidate_pool(sources: dict, game_id: int, game_date: str) -> dict:
    validate_range(game_date, game_date)
    score = sources["schedule"]["payload"]
    if score.get("currentDate") != game_date or not isinstance(score.get("games"), list):
        raise ValueError("exact-date official schedule required")
    matches = [game for game in score["games"] if game.get("id") == game_id]
    if len(matches) != 1:
        raise ValueError("one exact scheduled game required")
    game = matches[0]
    if game.get("gameDate") != game_date or game.get("gameType") not in (1, 2) or game.get("gameState") not in ("FUT", "PRE") or game.get("gameScheduleState") != "OK":
        raise ValueError("normal pregame schedule required")
    year = game_id // 1_000_000
    if type(game_id) is not int or len(str(game_id)) != 10 or game.get("season") != year * 10000 + year + 1 or (game_id // 10000) % 100 != game["gameType"]:
        raise ValueError("official game and season identity mismatch")
    start = _timestamp(game["startTimeUTC"])
    receipts = [_timestamp(sources[key]["receivedAt"]) for key in ("schedule", "awayRoster", "homeRoster")]
    if any(receipt >= start or not 0 <= (date.fromisoformat(game_date) - receipt.astimezone(ZoneInfo("America/New_York")).date()).days <= 7 for receipt in receipts):
        raise ValueError("candidate sources must be captured within seven Eastern dates before this game")
    if min(receipts[1:]) < receipts[0]:
        raise ValueError("roster captures must follow schedule identity capture")
    if sources["schedule"].get("url") != f"https://api-web.nhle.com/v1/score/{game_date}":
        raise ValueError("official candidate schedule source required")
    players, seen_ids, team_ids = [], set(), set()
    for side, key in (("awayTeam", "awayRoster"), ("homeTeam", "homeRoster")):
        team = game[side]
        if type(team.get("id")) is not int or team["id"] <= 0 or team["id"] in team_ids or not re.fullmatch(r"[A-Z]{2,3}", team.get("abbrev", "")):
            raise ValueError("distinct scheduled team identities required")
        team_ids.add(team["id"])
        if sources[key].get("url") != f"https://api-web.nhle.com/v1/roster/{team['abbrev']}/{game['season']}":
            raise ValueError("roster source does not match the scheduled club and season")
        roster = sources[key]["payload"]
        count = 0
        for group, positions in (("forwards", {"C", "L", "R", "F"}), ("defensemen", {"D"}), ("goalies", {"G"})):
            rows = roster.get(group)
            if not isinstance(rows, list) or not rows:
                raise ValueError("all three official roster groups required")
            count += len(rows)
            for row in rows:
                player_id = row.get("id")
                first, last = row.get("firstName", {}).get("default"), row.get("lastName", {}).get("default")
                number = row.get("sweaterNumber")
                if type(player_id) is not int or player_id <= 0 or player_id in seen_ids or row.get("positionCode") not in positions:
                    raise ValueError("unique candidate IDs and consistent roster positions required")
                if not isinstance(first, str) or not first.strip() or not isinstance(last, str) or not last.strip():
                    raise ValueError("official candidate names required")
                if number is not None and (type(number) is not int or not 0 <= number <= 99):
                    raise ValueError("invalid candidate sweater number")
                seen_ids.add(player_id)
                players.append({"playerId": player_id, "teamId": team["id"], "teamAbbrev": team["abbrev"],
                    "name": " ".join(f"{first} {last}".split()), "sweaterNumber": number,
                    "population": "goalie" if group == "goalies" else "skater", "position": row["positionCode"]})
        if count > 100:
            raise ValueError("candidate club roster exceeds bounded population")
    return {"version": VERSION, "gameId": game_id, "gameDate": game_date, "gameType": game["gameType"],
        "scheduledStartAt": game["startTimeUTC"], "capturedAt": max(receipts).isoformat(),
        "selectionPolicy": "official_club_rosters_before_puck_drop_v1", "players": sorted(players, key=lambda row: row["playerId"]),
        "limitations": ["Club roster membership is not a confirmed lineup or a participation probability.",
            "Only uniquely matched explicit official scratch evidence supplies negative participation labels.",
            "A capture obtained after a forecast cutoff cannot resolve that forecast's candidate identity."]}


def verify_candidate_capture(bundle: Path) -> tuple[dict, str]:
    manifest = read_json(bundle / "manifest.json")
    if manifest.get("version") != VERSION:
        raise ValueError("unsupported candidate capture")
    for name in ("sources.json", "candidates.json"):
        if hashlib.sha256((bundle / name).read_bytes()).hexdigest() != manifest.get("files", {}).get(name):
            raise ValueError("candidate capture checksum mismatch")
    pool = read_json(bundle / "candidates.json")
    replay = normalize_candidate_pool(read_json(bundle / "sources.json"), manifest["gameId"], manifest["gameDate"])
    if canonical_json(pool) != canonical_json(replay) or manifest.get("candidates") != len(pool["players"]):
        raise ValueError("candidate capture normalization mismatch")
    return pool, hashlib.sha256((bundle / "manifest.json").read_bytes()).hexdigest()


def match_explicit_scratches(pool: dict, settlement: dict) -> dict:
    from .daily_board_roster_report import _name
    if pool.get("version") != VERSION or pool.get("gameId") != settlement["gameId"] or pool.get("gameDate") != settlement["gameDate"] or pool.get("gameType") != settlement["gameType"]:
        raise ValueError("candidate pool and settlement game mismatch")
    if _timestamp(pool["scheduledStartAt"]) != _timestamp(settlement["scheduledStartAt"]) or _timestamp(pool["capturedAt"]) >= _timestamp(settlement["scheduledStartAt"]):
        raise ValueError("candidate pool must precede the settled game's start")
    index = {}
    for player in pool["players"]:
        key = player["teamId"], _name(player["name"]), player["sweaterNumber"], player["population"]
        index.setdefault(key, []).append(player)
    evidence = settlement.get("scratchEvidence", {})
    labels, unresolved = {}, []
    recorded = {player["playerId"] for player in settlement["players"]}
    for scratch in evidence.get("scratches", []) if evidence.get("status") == "verified" else []:
        if scratch.get("participation") != 0 or scratch.get("identityStatus") != "requires_pregame_candidate_match":
            raise ValueError("explicit unresolved scratch evidence required")
        key = scratch["teamId"], _name(scratch["name"]), scratch["sweaterNumber"], scratch["population"]
        matches = index.get(key, [])
        if len(matches) != 1 or matches[0]["playerId"] in recorded or matches[0]["playerId"] in labels:
            unresolved.append({"teamId": scratch["teamId"], "sweaterNumber": scratch["sweaterNumber"],
                "reason": "candidate_identity_missing_ambiguous_or_conflicting"})
            continue
        player = matches[0]
        categories = ("SAVES_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE") if player["population"] == "goalie" else (
            "GOALS", "ASSISTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "PP_POINTS")
        labels[player["playerId"]] = {"playerId": player["playerId"], "teamId": player["teamId"], "population": player["population"],
            "participation": 0, "goalieStart": 0 if player["population"] == "goalie" else None,
            "outcomes": dict.fromkeys((*categories, "TIME_ON_ICE_PER_GAME"), 0)}
    return {"labels": labels, "unresolved": unresolved}


def candidate_label_rows(pool: dict, settlement: dict) -> dict:
    """Retain the whole observed pregame population, including unknown labels.

    This is a data-collection join, not issued predictions or a calibrated model.
    Its selection policy cannot be widened using players first seen postgame.
    """
    scratches = match_explicit_scratches(pool, settlement)
    official = {row["playerId"]: row for row in settlement["players"]}
    candidate_ids = {row["playerId"] for row in pool["players"]}
    if len(candidate_ids) != len(pool["players"]) or len(official) != len(settlement["players"]):
        raise ValueError("unique candidate and outcome identities required")
    rows = []
    for player in pool["players"]:
        observed = official.get(player["playerId"]) or scratches["labels"].get(player["playerId"])
        conflict = observed and (observed["teamId"] != player["teamId"] or observed["population"] != player["population"])
        for target, field in (("participation", "participation"), ("goalie_start", "goalieStart")):
            if target == "goalie_start" and player["population"] != "goalie":
                continue
            value = observed.get(field) if observed and not conflict else None
            if value is not None and (type(value) is not int or value not in (0, 1)):
                raise ValueError("official binary candidate label required")
            rows.append({"game_id": pool["gameId"], "game_date": pool["gameDate"], "game_type": pool["gameType"],
                "player_id": player["playerId"], "team_id": player["teamId"], "population": player["population"],
                "position": player["position"], "target_key": target, "label": value, "label_verified": value is not None,
                "label_source": ("explicit_official_scratch" if player["playerId"] in scratches["labels"] else "official_game_outcome") if value is not None else None,
                "unresolved_reason": "candidate_outcome_identity_conflict" if conflict else "official_label_unavailable" if value is None else None,
                "candidate_captured_at": pool["capturedAt"], "scheduled_start_at": pool["scheduledStartAt"],
                "selection_policy": pool["selectionPolicy"], "evidence_classification": "prospective_candidate_observation"})
    return {"rows": rows, "officialPlayersOutsideCandidatePool": sorted(set(official) - candidate_ids),
        "unresolvedScratchEvidence": scratches["unresolved"],
        "counts": {target: {"positive": sum(row["label"] == 1 for row in rows if row["target_key"] == target),
            "negative": sum(row["label"] == 0 for row in rows if row["target_key"] == target),
            "unknown": sum(row["label"] is None for row in rows if row["target_key"] == target)}
            for target in ("participation", "goalie_start")}}


def settle_candidate_artifact(candidate_bundle: Path, settlement_bundle: Path, output: Path) -> dict:
    from .daily_board_settlement import verify_settlement_capture
    assert_output_outside_repository(output, repository_root())
    pool, candidate_hash = verify_candidate_capture(candidate_bundle)
    settlement, settlement_hash = verify_settlement_capture(settlement_bundle)
    result = candidate_label_rows(pool, settlement)
    identity = {"candidateManifestSha256": candidate_hash, "settlementManifestSha256": settlement_hash,
        "labelerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    manifest = {"version": "starter-board-candidate-labels-v1", "gameId": pool["gameId"], "gameDate": pool["gameDate"],
        "gameType": pool["gameType"], "inputs": identity, "candidates": len(pool["players"]), "targetRows": len(result["rows"]),
        "counts": result["counts"], "promotionEligible": False, "limitations": [
            "Observed club rosters are not certified complete active/eligible candidate lists.",
            "Unknown labels and outcome-only players are retained in diagnostics, never inferred as negatives or added to the candidate pool.",
            "No issued probability forecasts, feature-training contract, fitted model or prospective accuracy result is established."]}
    if output.exists():
        previous = read_json(output / "manifest.json")
        if any(previous.get(key) != value for key, value in manifest.items()) or set(previous.get("files", {})) != {"labels.jsonl", "coverage.json"}:
            raise ValueError("refusing to replace immutable candidate labels")
        for name, checksum in previous["files"].items():
            if hashlib.sha256((output / name).read_bytes()).hexdigest() != checksum:
                raise ValueError("candidate label checksum mismatch")
        return previous
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    write_jsonl(output / "labels.jsonl", result["rows"])
    write_json(output / "coverage.json", {key: value for key, value in result.items() if key != "rows"})
    manifest["files"] = {}
    for name in ("labels.jsonl", "coverage.json"):
        (output / name).chmod(0o600)
        manifest["files"][name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    write_json(output / "manifest.json", manifest)
    (output / "manifest.json").chmod(0o600)
    return manifest


def capture_candidates(game_id: int, game_date: str, output: Path, *, schedule_source: dict | None = None) -> dict:
    validate_range(game_date, game_date)
    if type(game_id) is not int or len(str(game_id)) != 10 or game_id <= 0:
        raise ValueError("valid NHL game ID required")
    today = datetime.now(ZoneInfo("America/New_York")).date()
    if not 0 <= (date.fromisoformat(game_date) - today).days <= 7:
        raise ValueError("capture only today or the next seven Eastern dates")
    assert_output_outside_repository(output, repository_root())
    if output.exists():
        raise ValueError("refusing to replace immutable candidate capture")
    schedule = schedule_source if schedule_source is not None else fetch_official_json(f"https://api-web.nhle.com/v1/score/{game_date}")
    payload = schedule["payload"]
    if payload.get("currentDate") != game_date or not isinstance(payload.get("games"), list):
        raise ValueError("exact-date schedule required")
    matches = [game for game in payload["games"] if game.get("id") == game_id]
    if len(matches) != 1:
        raise ValueError("one exact scheduled game required")
    game = matches[0]
    if game.get("gameState") not in ("FUT", "PRE") or game.get("gameScheduleState") != "OK" or _timestamp(game["startTimeUTC"]) <= datetime.now(timezone.utc):
        raise ValueError("cannot capture a started or uncertain game")
    sources = {"schedule": schedule}
    for side, key in (("awayTeam", "awayRoster"), ("homeTeam", "homeRoster")):
        abbreviation = game[side].get("abbrev")
        if not isinstance(abbreviation, str) or not re.fullmatch(r"[A-Z]{2,3}", abbreviation) or type(game.get("season")) is not int:
            raise ValueError("official club and season identity required")
        sources[key] = fetch_official_json(f"https://api-web.nhle.com/v1/roster/{abbreviation}/{game['season']}")
    pool = normalize_candidate_pool(sources, game_id, game_date)
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    for name, value in (("sources.json", sources), ("candidates.json", pool)):
        write_json(output / name, value)
        (output / name).chmod(0o600)
    manifest = {"version": VERSION, "gameId": game_id, "gameDate": game_date, "candidates": len(pool["players"]),
        "capturedAt": pool["capturedAt"], "sourceOrigin": "official_nhl_api", "promotionEligible": False,
        "captureCodeHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "files": {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ("sources.json", "candidates.json")}}
    write_json(output / "manifest.json", manifest)
    (output / "manifest.json").chmod(0o600)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game-id", type=int, required=True)
    parser.add_argument("--game-date", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(canonical_json(capture_candidates(args.game_id, args.game_date, args.output)))


if __name__ == "__main__":
    main()

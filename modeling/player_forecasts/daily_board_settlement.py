"""Bounded official outcome capture and joins to forecasts issued before puck drop.

This does not infer nonparticipation from a missing player or turn an outcome
roster into a pregame candidate list. No database or serving-model writes occur.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .contract import repository_root
from .daily_board_data import _minutes, validate_range
from .daily_board import VERSION as EVALUATION_VERSION
from .daily_board_roster_report import normalize_roster_report
from .io import assert_output_outside_repository, canonical_json, read_json, write_json, write_jsonl

VERSION = "starter-board-settlement-v1"
JOIN_VERSION = "starter-board-settled-forecasts-v1"


def _timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone-qualified timestamp required")
    return parsed.astimezone(timezone.utc)


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def normalize_settlement(boxscore: dict, skaters: dict, goalies: dict, *, game_id: int, game_date: str, received_at: str,
                         roster_report: dict | None = None) -> dict:
    validate_range(game_date, game_date)
    if boxscore.get("id") != game_id or boxscore.get("gameDate") != game_date or boxscore.get("gameType") not in (1, 2):
        raise ValueError("official game identity or type mismatch")
    if boxscore.get("gameState") != "OFF" or _timestamp(received_at) <= _timestamp(boxscore["startTimeUTC"]):
        raise ValueError("official final outcome required after game start")
    teams = {side: boxscore[side] for side in ("homeTeam", "awayTeam")}
    if len({team["id"] for team in teams.values()}) != 2:
        raise ValueError("distinct official teams required")
    official: dict[tuple[str, int], dict] = {}
    for population, payload in (("skater", skaters), ("goalie", goalies)):
        rows = payload.get("data")
        if not isinstance(rows, list) or payload.get("total") != len(rows) or not rows:
            raise ValueError("complete official statistical response required")
        for row in rows:
            key = population, row.get("playerId")
            if row.get("gameId") != game_id or row.get("gameDate") != game_date or key in official or row.get("gamesPlayed") != 1:
                raise ValueError("duplicate, nonappearance or mismatched official statistic")
            if row.get("teamAbbrev") not in {team["abbrev"] for team in teams.values()}:
                raise ValueError("official game-time membership mismatch")
            official[key] = row
    normalized = []
    seen = set()
    for side, team in teams.items():
        source = boxscore.get("playerByGameStats", {}).get(side, {})
        if not all(isinstance(source.get(group), list) and source[group] for group in ("forwards", "defense", "goalies")):
            raise ValueError("incomplete final box score")
        if sum(row.get("starter") is True for row in source["goalies"]) != 1:
            raise ValueError("one explicitly identified starter per team required")
        for group in ("forwards", "defense", "goalies"):
            population = "goalie" if group == "goalies" else "skater"
            for player in source[group]:
                player_id = player.get("playerId")
                if not isinstance(player_id, int) or isinstance(player_id, bool) or player_id <= 0 or player_id in seen:
                    raise ValueError("ambiguous official player identity")
                seen.add(player_id)
                summary = official.get((population, player_id))
                if summary and summary["teamAbbrev"] != team["abbrev"]:
                    raise ValueError("conflicting official game-time membership")
                if population == "goalie":
                    if not isinstance(player.get("starter"), bool):
                        raise ValueError("explicit official starter flags required")
                    if summary and summary.get("gamesStarted") != int(player["starter"]):
                        raise ValueError("conflicting official starter labels")
                    stats = {target: player.get(key) for target, key in (("SAVES_GOALIE", "saves"),
                        ("SHOTS_AGAINST_GOALIE", "shotsAgainst"), ("GOALS_AGAINST_GOALIE", "goalsAgainst"))}
                    if any(not _number(value) for value in stats.values()) or stats["SAVES_GOALIE"] + stats["GOALS_AGAINST_GOALIE"] != stats["SHOTS_AGAINST_GOALIE"]:
                        raise ValueError("goalie accounting mismatch")
                    for target, key in (("SAVES_GOALIE", "saves"), ("SHOTS_AGAINST_GOALIE", "shotsAgainst"), ("GOALS_AGAINST_GOALIE", "goalsAgainst")):
                        if summary and summary.get(key) != stats[target]:
                            raise ValueError("conflicting official goalie statistics")
                    stats.update(WINS_GOALIE=summary.get("wins") if summary else None,
                        SHUTOUTS_GOALIE=summary.get("shutouts") if summary else None)
                else:
                    stats = {target: player.get(key) for target, key in (("GOALS", "goals"), ("ASSISTS", "assists"),
                        ("SHOTS_ON_GOAL", "sog"), ("HITS", "hits"), ("BLOCKED_SHOTS", "blockedShots"), ("PENALTY_MINUTES", "pim"))}
                    stats["PP_POINTS"] = summary.get("ppPoints") if summary else None
                    for key, source_key in (("GOALS", "goals"), ("ASSISTS", "assists"), ("SHOTS_ON_GOAL", "shots"), ("PENALTY_MINUTES", "penaltyMinutes")):
                        if summary and source_key in summary and summary[source_key] != stats[key]:
                            raise ValueError("conflicting official skater statistics")
                usage = summary.get("timeOnIce" if population == "goalie" else "timeOnIcePerGame") if summary else None
                stats["TIME_ON_ICE_PER_GAME"] = usage / 60 if _number(usage) else None
                box_minutes = _minutes(player.get("toi"))
                if box_minutes is not None and usage is not None and not math.isclose(box_minutes * 60, usage, abs_tol=0.01):
                    raise ValueError("conflicting official usage")
                if any(value is not None and not _number(value) for value in stats.values()):
                    raise ValueError("invalid official outcome")
                normalized.append({"playerId": player_id, "teamId": team["id"], "population": population,
                    "participation": 1 if summary else None, "goalieStart": int(player["starter"]) if population == "goalie" else None,
                    "outcomes": stats})
    if any(player_id not in seen for _, player_id in official):
        raise ValueError("official summaries and box score disagree on participants")
    scratch_evidence = None
    if roster_report is not None:
        scratch_evidence = {"status": "unavailable", "scratches": []}
        if isinstance(roster_report.get("payload"), str):
            try:
                scratch_evidence = normalize_roster_report(roster_report["payload"], boxscore)
            except (ValueError, KeyError, TypeError):
                scratch_evidence = {"status": "unusable", "scratches": [], "reason": "official_roster_report_validation_failed"}
    return {"version": VERSION, "gameId": game_id, "gameDate": game_date, "gameType": boxscore["gameType"],
        "scheduledStartAt": boxscore["startTimeUTC"], "receivedAt": received_at, "status": "final",
        "players": sorted(normalized, key=lambda row: row["playerId"]),
        **({"scratchEvidence": scratch_evidence} if scratch_evidence is not None else {}),
        "limitations": ["Missing players and missing statistics remain unknown; absence is not a nonparticipation label.",
            "Final rosters do not establish the pregame candidate pool."]}


def attach_official_outcomes(forecasts: list[dict], settlement: dict, *, candidate_pool: dict | None = None) -> dict:
    """Retain the issued population; never add players revealed by the outcome."""
    if settlement.get("version") != VERSION or settlement.get("status") != "final":
        raise ValueError("verified settlement contract required")
    players = {row["playerId"]: row for row in settlement["players"]}
    scratch_matches = None
    if candidate_pool is not None:
        from .daily_board_candidates import match_explicit_scratches
        scratch_matches = match_explicit_scratches(candidate_pool, settlement)
    settled, unresolved, seen = [], [], set()
    for forecast in forecasts:
        identity = forecast["player_id"], forecast["target_key"], forecast.get("conditioning")
        if identity in seen or forecast["game_id"] != settlement["gameId"] or forecast["game_date"] != settlement["gameDate"]:
            raise ValueError("duplicate forecast or settlement identity mismatch")
        if forecast.get("game_type") is not None and forecast["game_type"] != settlement["gameType"]:
            raise ValueError("forecast and official game type disagree")
        seen.add(identity)
        cutoff, issued = _timestamp(forecast["cutoff_at"]), _timestamp(forecast["issued_at"])
        start, received = _timestamp(settlement["scheduledStartAt"]), _timestamp(settlement["receivedAt"])
        if forecast.get("scheduled_start_at") and _timestamp(forecast["scheduled_start_at"]) != start:
            raise ValueError("forecast and official scheduled start disagree")
        if not _timestamp(forecast["maximum_feature_available_at"]) <= cutoff <= issued < start < received:
            raise ValueError("forecast was not issued using pregame information")
        row = players.get(forecast["player_id"])
        candidate_provenance = {}
        scratch = scratch_matches["labels"].get(forecast["player_id"]) if scratch_matches else None
        if row is None and scratch and _timestamp(candidate_pool["capturedAt"]) <= cutoff:
            row = scratch
            candidate_provenance = {"candidate_pool_hash": hashlib.sha256(canonical_json(candidate_pool).encode()).hexdigest(),
                "candidate_pool_captured_at": candidate_pool["capturedAt"], "participation_label_source": "explicit_official_scratch"}
        target = forecast["target_key"]
        outcome = None if not row else row["participation"] if target == "participation" else row["goalieStart"] if target == "goalie_start" else row["outcomes"].get(target)
        if target == "FANTASY_POINTS":
            weights = forecast.get("scoring_weights")
            if not isinstance(weights, dict) or any(not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) for value in weights.values()):
                raise ValueError("fantasy outcomes require the issued finite scoring weights")
            required = {key: weight for key, weight in weights.items() if weight}
            outcome = sum(row["outcomes"][key] * weight for key, weight in required.items()) if row and all(_number(row["outcomes"].get(key)) for key in required) else None
        if row and (forecast["team_id"] != row["teamId"] or forecast["population"] != row["population"]):
            raise ValueError("forecast and official membership disagree")
        condition_unobserved = row and ((forecast.get("conditioning") == "conditional_playing" and row["participation"] != 1)
            or (forecast.get("conditioning") == "conditional_start" and row["goalieStart"] != 1))
        if condition_unobserved:
            outcome = None
        if outcome is None:
            unresolved.append({"playerId": forecast["player_id"], "target": target,
                "conditioning": forecast.get("conditioning"), "reason": "conditioning_not_observed" if condition_unobserved else "candidate_capture_after_forecast_cutoff"
                if scratch and _timestamp(candidate_pool["capturedAt"]) > cutoff else "official_label_unavailable"})
        else:
            settled.append({**forecast, "game_type": settlement["gameType"], "outcome": outcome, "settlement_status": "final", "settlement_received_at": settlement["receivedAt"],
                "played": None if row["participation"] is None else bool(row["participation"]),
                "started": None if row["goalieStart"] is None else bool(row["goalieStart"]),
                "settlement_hash": hashlib.sha256(canonical_json(settlement).encode()).hexdigest(), **candidate_provenance})
    return {"rows": settled, "unresolved": unresolved,
        "outcomePlayersOutsideForecastPool": sorted(set(players) - {row["player_id"] for row in forecasts}),
        **({"unmatchedScratchEvidence": scratch_matches["unresolved"]} if scratch_matches is not None else {})}


def verify_settlement_capture(bundle: Path) -> tuple[dict, str]:
    """Verify both captured files and replay normalization without network access."""
    manifest = read_json(bundle / "manifest.json")
    if manifest.get("version") != VERSION:
        raise ValueError("unsupported official settlement capture")
    validate_range(manifest["gameDate"], manifest["gameDate"])
    for name in ("sources.json", "settlement.json"):
        if hashlib.sha256((bundle / name).read_bytes()).hexdigest() != manifest.get("files", {}).get(name):
            raise ValueError(f"official capture checksum mismatch: {name}")
    sources, settlement = read_json(bundle / "sources.json"), read_json(bundle / "settlement.json")
    received = max(_timestamp(sources[key]["receivedAt"]) for key in ("boxscore", "skaters", "goalies", "rosterReport") if key in sources)
    if _timestamp(settlement["receivedAt"]) != received:
        raise ValueError("settlement receipt differs from captured sources")
    replay = normalize_settlement(*(sources[key]["payload"] for key in ("boxscore", "skaters", "goalies")),
        game_id=manifest["gameId"], game_date=manifest["gameDate"], received_at=settlement["receivedAt"], roster_report=sources.get("rosterReport"))
    if canonical_json(replay) != canonical_json(settlement) or manifest["players"] != len(replay["players"]):
        raise ValueError("official settlement normalization mismatch; preserve and recapture explicitly")
    return settlement, hashlib.sha256((bundle / "manifest.json").read_bytes()).hexdigest()


def verify_forecast_export(bundle: Path) -> tuple[Path, dict]:
    manifest = read_json(bundle / "manifest.json")
    if manifest.get("version") == "starter-board-prospective-baselines-v1":
        from .daily_board_baseline_issuance import verify_issued_baselines
        return verify_issued_baselines(bundle)
    if manifest.get("version") != "starter-board-issued-forecasts-v1" or manifest.get("sourceOrigin") not in ("provided_capture", "immutable_database_records"):
        raise ValueError("frozen board forecast export required")
    validate_range(manifest["gameDate"], manifest["gameDate"])
    for name in ("source.json", "forecasts.jsonl"):
        if hashlib.sha256((bundle / name).read_bytes()).hexdigest() != manifest.get("files", {}).get(name):
            raise ValueError("forecast export checksum mismatch")
    source = read_json(bundle / "source.json")
    game, revision, observation, frozen = source["game"], source["revision"], source["observation"], source["frozen"]
    snapshot = observation["payload"]
    if (game["id"] != manifest["gameId"] or game["date"] != manifest["gameDate"]
        or type(game["type"]) is not int or game["type"] not in (1, 2) or game["type"] != manifest["gameType"]
        or frozen["game_id"] != game["id"] or game["homeTeamId"] == game["awayTeamId"]
        or revision["id"] != frozen["revision_id"] or revision["id"] != manifest["revisionId"]
        or revision["input_snapshot_id"] != observation["id"] or observation["payload_hash"] != manifest["inputSnapshotHash"]
        or revision["published_at"] != manifest["issuedAt"] or revision["game_id"] != manifest["gameId"]
        or revision["slate_date"] != manifest["gameDate"]
        or snapshot.get("version") != "forge-inputs-v1" or snapshot.get("replayClassification") != "captured_live"
        or snapshot.get("controlledScenario") or snapshot.get("horizonGames") != 1
        or snapshot.get("runId") != revision["run_id"] or observation["entity_key"] != revision["run_id"]
        or observation.get("provider") != "forge" or observation.get("dataset_key") != "forge-run-inputs-v1"
        or snapshot.get("slateDate") != game["date"] or not snapshot.get("modelMode")
        or snapshot["modelMode"] != revision["payload"].get("modelMode")
        or not snapshot.get("codeVersion") or snapshot["codeVersion"] != manifest["codeVersion"]
        or revision["payload"].get("codeVersion") != manifest["codeVersion"]):
        raise ValueError("forecast export revision provenance mismatch")
    # Cached exports bypass the TypeScript exporter on retry. Recheck the saved
    # capture timeline here rather than trusting each forecast's declared cutoff.
    cutoff, issued = _timestamp(snapshot["decisionAsOf"]), _timestamp(revision["published_at"])
    input_cutoff, start = _timestamp(snapshot["inputCutoff"]), _timestamp(frozen["scheduled_start_at"])
    frozen_at = _timestamp(frozen["frozen_at"])
    if not (input_cutoff <= cutoff == _timestamp(revision["decision_as_of"])
        <= _timestamp(snapshot["capturedAt"]) <= _timestamp(observation["available_at"])
        <= issued < start <= frozen_at) or frozen_at != _timestamp(manifest["frozenAt"]):
        raise ValueError("forecast export capture and publication must precede frozen game start")
    reads = snapshot.get("reads")
    if not isinstance(reads, list) or not reads:
        raise ValueError("captured input receipt evidence required")
    latest_read = max(_timestamp(read["receivedAt"]) for read in reads)
    if latest_read > cutoff:
        raise ValueError("captured input receipt is after forecast cutoff")
    rows = [json.loads(line) for line in (bundle / "forecasts.jsonl").read_text().splitlines() if line.strip()]
    if not 1 <= len(rows) <= 5000 or len(rows) != manifest["targetRows"] or any(row.get("revision_id") != manifest["revisionId"]
        or row.get("snapshot_hash") != manifest["inputSnapshotHash"] or row.get("issued_at") != manifest["issuedAt"]
        or row.get("model_code_version") != manifest["codeVersion"] or row.get("game_id") != manifest["gameId"]
        or row.get("game_date") != manifest["gameDate"] or row.get("cutoff_at") != snapshot["decisionAsOf"]
        or row.get("scheduled_start_at") != frozen["scheduled_start_at"] or row.get("game_type") != game["type"]
        or row.get("evidence_classification") != "captured_live" or row.get("checkpoint") != "frozen_final_pregame"
        or row.get("model_id") != f'forge:{snapshot["modelMode"]}:{snapshot["codeVersion"]}'
        or row.get("team_id") not in (game["homeTeamId"], game["awayTeamId"])
        or row.get("opponent_team_id") != (game["awayTeamId"] if row.get("team_id") == game["homeTeamId"] else game["homeTeamId"])
        or _timestamp(row["maximum_feature_available_at"]) != latest_read
        or _timestamp(row["source_query_cutoff_at"]) != input_cutoff for row in rows):
        raise ValueError("forecast rows do not match the frozen export")
    return bundle / "forecasts.jsonl", {"status": "artifact_integrity_revision_links_and_pregame_timing_verified",
        "manifestSha256": hashlib.sha256((bundle / "manifest.json").read_bytes()).hexdigest(),
        "sourceOrigin": manifest["sourceOrigin"], "sourceHash": manifest["sourceHash"], "exporterHash": manifest["exporterHash"],
        "revisionId": manifest["revisionId"], "completeParticipationCandidatePool": manifest["completeParticipationCandidatePool"]}


def settle_forecast_artifact(forecasts_file: Path, settlement_bundle: Path, output: Path, *, forecast_bundle: Path | None = None,
                             candidate_bundle: Path | None = None) -> dict:
    """Freeze one game's joined labels, with byte-verified idempotent retries.

    This verifies artifact integrity and temporal consistency. It does not certify
    the exporter or promote caller-supplied forecasts as independently audited.
    """
    assert_output_outside_repository(output, repository_root())
    provenance = None
    if forecast_bundle:
        verified_file, provenance = verify_forecast_export(forecast_bundle)
        if verified_file.resolve() != forecasts_file.resolve():
            raise ValueError("forecast file does not belong to the verified bundle")
    settlement, capture_hash = verify_settlement_capture(settlement_bundle)
    candidate_pool, candidate_hash = None, None
    if candidate_bundle is not None:
        from .daily_board_candidates import verify_candidate_capture
        candidate_pool, candidate_hash = verify_candidate_capture(candidate_bundle)
    forecast_bytes = forecasts_file.read_bytes()
    forecasts = [json.loads(line) for line in forecast_bytes.decode("utf-8").splitlines() if line.strip()]
    if not 1 <= len(forecasts) <= 5000:
        raise ValueError("one bounded game of 1–5000 forecast targets required")
    classes = set()
    for row in forecasts:
        if row.get("contractVersion") != EVALUATION_VERSION or row.get("evidence_classification") not in ("captured_live", "historical_reconstruction"):
            raise ValueError("daily-board forecast contract and evidence classification required")
        classes.add(row["evidence_classification"])
        if not row.get("snapshot_hash") or row.get("historical_team_membership_verified") is not True:
            raise ValueError("pregame input identity and verified membership required")
        if row.get("conditioning") not in ("conditional_playing", "conditional_start", "unconditional", "probability"):
            raise ValueError("explicit forecast conditioning required")
        if not row.get("scheduled_start_at") or not isinstance(row.get("estimates"), dict) or not row["estimates"]:
            raise ValueError("issued start time and model estimates required")
        if any(key in row for key in ("outcome", "played", "started", "settlement_status", "settlement_hash", "settlement_received_at")):
            raise ValueError("forecast artifact already contains outcome information")
        if any(not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) for value in row["estimates"].values()):
            raise ValueError("nonfinite model estimate")
        probability = row["target_key"] in ("participation", "goalie_start")
        if probability != (row["conditioning"] == "probability") or probability and any(not 0 <= value <= 1 for value in row["estimates"].values()):
            raise ValueError("incompatible probability target or estimate")
    if len(classes) != 1:
        raise ValueError("historical reconstruction and live issuance require separate artifacts")
    result = attach_official_outcomes(forecasts, settlement, candidate_pool=candidate_pool)
    identity = {"forecastFileSha256": hashlib.sha256(forecast_bytes).hexdigest(),
        "settlementCaptureManifestSha256": capture_hash,
        "joinerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "forecastProvenance": provenance,
        **({"candidatePoolManifestSha256": candidate_hash,
            "candidateMatcherSha256": hashlib.sha256(Path(__file__).with_name("daily_board_candidates.py").read_bytes()).hexdigest()} if candidate_hash else {})}
    if output.exists():
        previous = read_json(output / "manifest.json")
        if previous.get("version") != JOIN_VERSION or previous.get("inputs") != identity:
            raise ValueError("refusing to replace immutable joined forecasts")
        if set(previous.get("files", {})) != {"forecasts.jsonl", "settled.jsonl", "unresolved.json"}:
            raise ValueError("incomplete joined forecast artifact")
        for name, checksum in previous["files"].items():
            if hashlib.sha256((output / name).read_bytes()).hexdigest() != checksum:
                raise ValueError("joined forecast artifact checksum mismatch")
        return previous
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    # The manifest is written last; an interrupted directory is never a complete artifact.
    (output / "forecasts.jsonl").write_bytes(forecast_bytes)
    write_jsonl(output / "settled.jsonl", result["rows"])
    write_json(output / "unresolved.json", {key: value for key, value in result.items() if key != "rows"})
    files = {}
    for name in ("forecasts.jsonl", "settled.jsonl", "unresolved.json"):
        (output / name).chmod(0o600)
        files[name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    manifest = {"version": JOIN_VERSION, "gameId": settlement["gameId"], "gameDate": settlement["gameDate"],
        "gameType": settlement["gameType"], "evidenceClassification": next(iter(classes)), "inputs": identity, "files": files,
        "issuedTargetRows": len(forecasts), "settledTargetRows": len(result["rows"]), "unresolvedTargetRows": len(result["unresolved"]),
        "forecastPlayers": len({row["player_id"] for row in forecasts}),
        "outcomePlayersOutsideForecastPool": result["outcomePlayersOutsideForecastPool"],
        "promotionEligible": False, "limitations": ["Forecast issuance and candidate-pool provenance require an independent exporter audit.",
            "Missing official labels remain unknown; this join does not certify participation or model improvement.",
            "Preseason and regular-season evidence must be evaluated separately."]}
    write_json(output / "manifest.json", manifest)
    (output / "manifest.json").chmod(0o600)
    return manifest


def fetch_official_json(url: str) -> dict:
    # Caller constructs a bounded public NHL URL. Never send credentials or follow redirects.
    raw = subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--proto", "=https", "--max-time", "15",
        "--max-filesize", "8388608", url], timeout=20)
    return {"url": url, "receivedAt": datetime.now(timezone.utc).isoformat(),
        "rawSha256": hashlib.sha256(raw).hexdigest(), "payload": json.loads(raw)}


def capture_final(game_id: int, game_date: str, output: Path) -> dict:
    validate_range(game_date, game_date)
    if not isinstance(game_id, int) or game_id <= 0:
        raise ValueError("positive game ID required")
    assert_output_outside_repository(output, repository_root())
    if output.exists():
        raise ValueError("refusing to replace immutable capture")
    urls = {"boxscore": f"https://api-web.nhle.com/v1/gamecenter/{game_id}/boxscore",
        **{key: f"https://api.nhle.com/stats/rest/en/{population}/summary?isAggregate=false&isGame=true&cayenneExp=gameId%3D{game_id}"
            for key, population in (("skaters", "skater"), ("goalies", "goalie"))}}
    sources = {key: fetch_official_json(url) for key, url in urls.items()}
    # Reports supply explicit scratches, but may be unavailable (e.g. preseason).
    # Never let that invent zero labels or discard otherwise verified outcomes.
    year = game_id // 1_000_000
    report_url = f"https://www.nhl.com/scores/htmlreports/{year}{year + 1}/RO{game_id % 1_000_000:06d}.HTM"
    try:
        raw = subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--proto", "=https", "--max-time", "15",
            "--max-filesize", "1000000", report_url], timeout=20)
        report = {"url": report_url, "rawSha256": hashlib.sha256(raw).hexdigest(), "payload": raw.decode("utf-8")}
    except (subprocess.SubprocessError, UnicodeError):
        report = {"url": report_url, "payload": None}
    sources["rosterReport"] = {**report, "receivedAt": datetime.now(timezone.utc).isoformat()}
    settlement = normalize_settlement(*(sources[key]["payload"] for key in ("boxscore", "skaters", "goalies")),
        game_id=game_id, game_date=game_date, received_at=max(source["receivedAt"] for source in sources.values()), roster_report=sources["rosterReport"])
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    for name, value in (("sources.json", sources), ("settlement.json", settlement)):
        write_json(output / name, value)
        (output / name).chmod(0o600)
    manifest = {"version": VERSION, "gameId": game_id, "gameDate": game_date, "players": len(settlement["players"]),
        "normalizerHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "rosterParserHash": hashlib.sha256(Path(__file__).with_name("daily_board_roster_report.py").read_bytes()).hexdigest(),
        "files": {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ("sources.json", "settlement.json")},
        "promotionEligible": False, "pregameCandidatePoolCaptured": False}
    write_json(output / "manifest.json", manifest)
    (output / "manifest.json").chmod(0o600)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game-id", type=int)
    parser.add_argument("--game-date")
    parser.add_argument("--settlement-bundle", type=Path, help="Existing verified official capture; joining uses no network.")
    parser.add_argument("--forecasts", type=Path, help="Immutable daily-board forecast JSONL, without outcomes.")
    parser.add_argument("--forecast-bundle", type=Path, help="Private frozen-revision export; verifies its checksums and revision links.")
    parser.add_argument("--candidate-bundle", type=Path, help="Optional pregame club-roster capture for explicit scratch identity matching.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.settlement_bundle or args.forecasts or args.forecast_bundle or args.candidate_bundle:
        if not args.settlement_bundle or bool(args.forecasts) == bool(args.forecast_bundle) or args.game_id or args.game_date:
            parser.error("join mode requires --settlement-bundle and exactly one of --forecasts/--forecast-bundle, without --game-id/--game-date")
        forecast_file = args.forecasts or args.forecast_bundle / "forecasts.jsonl"
        result = settle_forecast_artifact(forecast_file, args.settlement_bundle, args.output, forecast_bundle=args.forecast_bundle,
            candidate_bundle=args.candidate_bundle)
    else:
        if not args.game_id or not args.game_date:
            parser.error("capture mode requires --game-id and --game-date")
        result = capture_final(args.game_id, args.game_date, args.output)
    print(canonical_json(result))


if __name__ == "__main__":
    main()

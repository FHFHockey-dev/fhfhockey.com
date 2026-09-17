"""Issue private conditional baseline means before games; never changes serving."""
from __future__ import annotations

import argparse
import hashlib
import math
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from .contract import repository_root
from .daily_board import VERSION as EVALUATION_VERSION
from .daily_board_candidates import verify_candidate_capture
from .daily_board_data import VERSION as DATASET_VERSION, validate_range
from .daily_board_models import historical_baselines
from .daily_board_settlement import _timestamp
from .daily_board_training import BASELINES, WEIGHTS
from .io import assert_output_outside_repository, canonical_json, read_json, read_jsonl, write_json, write_jsonl

POLICY = {"version": "starter-board-prospective-baselines-v1", "recentWeight": 0.5, "priorMinutes": 300,
    "historyLagDays": 2, "conditioning": "conditional_playing", "checkpoint": "daily_candidate_capture",
    "candidateSelection": "verified captured club-roster skaters with complete prior category history",
    "refitPolicy": "fixed definitions and coefficients; refresh only eligible historical observations",
    "historyScope": "available frozen appearances; current season when available, otherwise prior history",
    "servingActivation": False, "promotionEligible": False}


def _hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _inputs(freeze: Path, candidate: Path, cutoff: datetime) -> tuple[dict, list[dict], dict, dict]:
    manifest = read_json(freeze / "manifest.json")
    validate_range(manifest["start"], manifest["end"])
    if manifest.get("contractVersion") != DATASET_VERSION or _timestamp(manifest["createdAt"]) > cutoff:
        raise ValueError("historical freeze was not available by issuance cutoff")
    checksum = _hash(freeze / "history.jsonl")
    if checksum != manifest["files"]["history.jsonl"]["sha256"]:
        raise ValueError("history checksum mismatch")
    records = list(read_jsonl(freeze / "history.jsonl"))
    if not 1 <= len(records) == manifest["rows"] <= 100_000:
        raise ValueError("bounded historical freeze required")
    pool, candidate_hash = verify_candidate_capture(candidate)
    if not _timestamp(pool["capturedAt"]) <= cutoff < _timestamp(pool["scheduledStartAt"]):
        raise ValueError("candidate capture and issuance cutoff must precede puck drop")
    seen, eligible, excluded = set(), [], Counter()
    for row in records:
        identity = row["game_id"], row["player_id"]
        if identity in seen or not manifest["start"] <= row["game_date"] <= manifest["end"]:
            raise ValueError("duplicate historical row or date outside freeze")
        seen.add(identity)
        if row.get("evidence_classification") != "historical_reconstruction" or row.get("settlement_status") != "final":
            raise ValueError("settled historical reconstruction required")
        if row["game_date"] >= cutoff.date().isoformat() or (row.get("source_recorded_at") and _timestamp(row["source_recorded_at"]) > cutoff):
            raise ValueError("history contains current-day or future outcome information")
        if row["population"] != "skater":
            continue
        stats = row["outcomes"]
        counts_valid = all(type(stats.get(c)) in (int, float) and math.isfinite(stats[c]) and stats[c] >= 0 and stats[c] == int(stats[c]) for c in WEIGHTS)
        usage = stats.get("TIME_ON_ICE_PER_GAME")
        if (not counts_valid or type(usage) not in (int, float) or not math.isfinite(usage) or usage <= 0
            or stats["GOALS"] > stats["SHOTS_ON_GOAL"] or stats["PP_POINTS"] > stats["GOALS"] + stats["ASSISTS"]):
            excluded["invalid_or_incomplete_category_history"] += 1
        elif not row.get("historical_team_membership_verified"):
            excluded["unverified_historical_membership"] += 1
        else:
            eligible.append(row)
    provenance = {"historyChecksum": checksum, "historyManifestChecksum": _hash(freeze / "manifest.json"),
        "candidateManifestChecksum": candidate_hash, "historyAvailableAt": manifest["createdAt"],
        "candidateCapturedAt": pool["capturedAt"], "historyEnd": manifest["end"], "historyExclusions": dict(excluded)}
    return pool, eligible, provenance, manifest


def baseline_rows(freeze: Path, candidate: Path, *, cutoff_at: str, issued_at: str) -> tuple[list[dict], dict]:
    cutoff, issued = _timestamp(cutoff_at), _timestamp(issued_at)
    pool, history, provenance, _ = _inputs(freeze, candidate, cutoff)
    if not cutoff <= issued < _timestamp(pool["scheduledStartAt"]):
        raise ValueError("baseline issuance must precede puck drop")
    season_year = pool["gameId"] // 1_000_000
    skaters = [p for p in pool["players"] if p["population"] == "skater"]
    teams = {p["teamId"] for p in pool["players"]}
    candidates = [{"game_date": pool["gameDate"], "game_id": pool["gameId"], "player_id": p["playerId"],
        "team_id": p["teamId"], "population": "skater", "season_id": season_year * 10000 + season_year + 1,
        "historical_team_membership_verified": True} for p in skaters]
    predictions = historical_baselines(history, candidates=candidates,
        recent_weight=POLICY["recentWeight"], prior_minutes=POLICY["priorMinutes"])
    snapshot_hash = hashlib.sha256(canonical_json({"policy": POLICY, "inputs": provenance}).encode()).hexdigest()
    result, included = [], set()
    for prediction in predictions:
        estimates = {c: prediction["estimates"].get(c) for c in WEIGHTS}
        if not all(values and all(type(values.get(m)) in (int, float) and math.isfinite(values[m]) and values[m] >= 0 for m in BASELINES) for values in estimates.values()):
            continue
        for model in BASELINES:
            if (estimates["GOALS"][model] > estimates["SHOTS_ON_GOAL"][model] + 1e-9
                or estimates["PP_POINTS"][model] > estimates["GOALS"][model] + estimates["ASSISTS"][model] + 1e-9):
                raise ValueError("baseline category accounting mismatch")
        estimates["FANTASY_POINTS"] = {m: sum(estimates[c][m] * w for c, w in WEIGHTS.items()) for m in BASELINES}
        included.add(prediction["player_id"])
        for target, values in estimates.items():
            result.append({"contractVersion": EVALUATION_VERSION, "game_id": pool["gameId"], "game_date": pool["gameDate"],
                "game_type": pool["gameType"], "player_id": prediction["player_id"], "team_id": prediction["team_id"],
                "opponent_team_id": next(t for t in teams if t != prediction["team_id"]), "population": "skater",
                "target_key": target, "estimates": values, "conditioning": "conditional_playing",
                "evidence_classification": "captured_live", "history_evidence_classification": "historical_reconstruction",
                "checkpoint": POLICY["checkpoint"], "model_id": POLICY["version"], "snapshot_hash": snapshot_hash,
                "feature_hash": prediction["feature_hash"], "maximum_feature_game_date": prediction["maximum_feature_game_date"],
                "historical_team_membership_verified": True, "membership_basis": "captured_pregame_club_roster",
                "maximum_feature_available_at": max(provenance["historyAvailableAt"], provenance["candidateCapturedAt"], key=_timestamp),
                "cutoff_at": cutoff_at, "issued_at": issued_at, "scheduled_start_at": pool["scheduledStartAt"],
                "segments": prediction["segments"], **({"scoring_weights": WEIGHTS} if target == "FANTASY_POINTS" else {})})
    return result, {"inputs": provenance, "gameId": pool["gameId"], "gameDate": pool["gameDate"], "gameType": pool["gameType"],
        "scheduledStartAt": pool["scheduledStartAt"], "candidateSkaters": len(skaters), "forecastSkaters": len(included),
        "excludedPlayerIds": sorted(p["playerId"] for p in skaters if p["playerId"] not in included),
        "historyAgeDays": (date.fromisoformat(pool["gameDate"]) - date.fromisoformat(provenance["historyEnd"])).days}


def issue_baselines(freeze: Path, candidate: Path, output: Path) -> dict:
    assert_output_outside_repository(output, repository_root())
    if output.exists():
        manifest = read_json(output / "manifest.json")
        if manifest.get("sourcePaths") != {"freeze": str(freeze.resolve()), "candidate": str(candidate.resolve())}:
            raise ValueError("refusing to replace issued forecast sources")
        verify_issued_baselines(output)
        return manifest
    cutoff = datetime.now(timezone.utc).isoformat()
    # Compute once, then stamp the completed forecasts with the real issue time.
    rows, details = baseline_rows(freeze, candidate, cutoff_at=cutoff, issued_at=cutoff)
    if not rows:
        raise ValueError("no eligible baseline candidates")
    issued = datetime.now(timezone.utc)
    start = _timestamp(details["scheduledStartAt"])
    if issued >= start:
        raise ValueError("calculation passed puck drop; no forecasts issued")
    for row in rows:
        row["issued_at"] = issued.isoformat()
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    count, digest = write_jsonl(output / "forecasts.jsonl", rows)
    (output / "forecasts.jsonl").chmod(0o600)
    manifest = {"version": POLICY["version"], "policy": POLICY, **details, "cutoffAt": cutoff, "issuedAt": issued.isoformat(),
        "sourcePaths": {"freeze": str(freeze.resolve()), "candidate": str(candidate.resolve())}, "targetRows": count,
        "forecastChecksum": digest, "promotionEligible": False, "servingChanged": False,
        "codeHashes": {name: _hash(Path(__file__).with_name(name)) for name in ("daily_board_baseline_issuance.py", "daily_board_models.py",
            "daily_board_candidates.py", "daily_board_training.py", "daily_board_data.py", "daily_board_settlement.py", "io.py")},
        "limitations": ["Conditional skater means only; no participation, goalie, uncertainty or optimal-lineup claim.",
            "Historical features cover the supplied freeze, not necessarily recent or complete season history.",
            "Captured club-roster candidates are not confirmed lineups; players without valid history are excluded explicitly.",
            "FORGE is absent until a compatible issued serving forecast exists; never fill it with zero.",
            "Pair only compatible decision checkpoints and conditioning; this is not final-pregame issuance.",
            "Preseason issuance and outcomes cannot satisfy regular-season promotion gates."]}
    write_json(output / "manifest.json", manifest)
    (output / "manifest.json").chmod(0o600)
    if datetime.now(timezone.utc) >= start:
        (output / "manifest.json").unlink()
        raise ValueError("publication passed puck drop; no completed artifact")
    return manifest


def verify_issued_baselines(bundle: Path) -> tuple[Path, dict]:
    manifest = read_json(bundle / "manifest.json")
    if manifest.get("version") != POLICY["version"] or manifest.get("policy") != POLICY:
        raise ValueError("issued baseline policy mismatch; replay the original version")
    path = bundle / "forecasts.jsonl"
    if _hash(path) != manifest["forecastChecksum"]:
        raise ValueError("issued baseline checksum mismatch")
    rows, details = baseline_rows(Path(manifest["sourcePaths"]["freeze"]), Path(manifest["sourcePaths"]["candidate"]),
        cutoff_at=manifest["cutoffAt"], issued_at=manifest["issuedAt"])
    digest = hashlib.sha256("".join(canonical_json(row) + "\n" for row in rows).encode()).hexdigest()
    if digest != manifest["forecastChecksum"] or len(rows) != manifest["targetRows"] or any(manifest.get(key) != value for key, value in details.items()):
        raise ValueError("issued baseline replay mismatch")
    return path, {"status": "private_baseline_inputs_and_forecasts_replayed", "manifestSha256": _hash(bundle / "manifest.json"),
        "sourceOrigin": "private_pregame_baseline_artifact", "sourceHash": rows[0]["snapshot_hash"],
        "exporterHash": manifest["codeHashes"]["daily_board_baseline_issuance.py"], "completeParticipationCandidatePool": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("freeze", "candidate", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    report = issue_baselines(**vars(parser.parse_args()))
    print(canonical_json({k: report[k] for k in ("gameId", "gameType", "forecastSkaters", "historyAgeDays", "issuedAt", "promotionEligible")}))


if __name__ == "__main__":
    main()

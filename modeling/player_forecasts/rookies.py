from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from statistics import median
from typing import Any
from urllib.request import Request, urlopen

from .contract import (
    FANTASY_SEASON_CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_VERSION,
    SEASON_CONTRACT_SHA256,
)
from .io import canonical_json, read_json, read_jsonl, write_json, write_jsonl

NHL_LEAGUE = "NHL"
TARGET_SEASON = 20262027
LAST_COMPLETE_SEASON = 20252026
TRANSLATED_TARGETS = ("GOALS", "ASSISTS", "PENALTY_MINUTES")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _default_text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("default") or value.get("en") or "")
    return str(value or "")


def normalize_player_landing(
    payload: dict[str, Any],
    *,
    expected_player_id: int,
    fetched_at: str,
    source_hash: str,
) -> dict[str, Any]:
    if int(payload.get("playerId") or 0) != expected_player_id:
        raise RuntimeError("official NHL player landing returned a mismatched player ID")
    histories: list[dict[str, Any]] = []
    for raw in payload.get("seasonTotals") or []:
        season = int(raw.get("season") or 0)
        games = int(raw.get("gamesPlayed") or 0)
        if int(raw.get("gameTypeId") or 0) != 2 or not season or games <= 0:
            continue
        histories.append({
            "season": season,
            "league": str(raw.get("leagueAbbrev") or "UNKNOWN").upper(),
            "teamName": _default_text(raw.get("teamName")),
            "gamesPlayed": games,
            "goals": int(raw.get("goals") or 0),
            "assists": int(raw.get("assists") or 0),
            "points": int(raw.get("points") or 0),
            "penaltyMinutes": int(raw.get("pim") or 0),
            "plusMinus": int(raw.get("plusMinus") or 0),
        })
    histories.sort(key=lambda row: (row["season"], row["league"], row["teamName"]))
    draft = payload.get("draftDetails") or {}
    return {
        "nhlPlayerId": expected_player_id,
        "playerName": " ".join(
            part for part in (
                _default_text(payload.get("firstName")),
                _default_text(payload.get("lastName")),
            ) if part
        ),
        "position": str(payload.get("position") or ""),
        "birthDate": payload.get("birthDate"),
        "currentTeamId": int(payload["currentTeamId"])
        if payload.get("currentTeamId") is not None else None,
        "draftOverall": int(draft["overallPick"])
        if draft.get("overallPick") is not None else None,
        "fetchedAt": fetched_at,
        "availableAt": fetched_at,
        "sourceUrl": f"https://api-web.nhle.com/v1/player/{expected_player_id}/landing",
        "sourceHash": source_hash,
        "seasonTotals": histories,
    }


def _capture_one(player_id: int, fetched_at: str) -> dict[str, Any]:
    url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    request = Request(url, headers={"User-Agent": "FHFH-player-forecasts/4.0"})
    with urlopen(request, timeout=45) as response:
        raw = response.read()
    return normalize_player_landing(
        json.loads(raw.decode("utf-8")),
        expected_player_id=player_id,
        fetched_at=fetched_at,
        source_hash=hashlib.sha256(raw).hexdigest(),
    )


def capture_player_landings(
    freeze: Path,
    output: Path,
    *,
    max_workers: int = 12,
    base_freeze: Path | None = None,
) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") not in {
        SEASON_CONTRACT_SHA256,
        FANTASY_SEASON_CONTRACT_SHA256,
    }:
        raise RuntimeError("season freeze contract checksum mismatch")
    pool_path = freeze / "player-pool.json"
    pool_metadata = (manifest.get("files") or {}).get("player_pool") or {}
    if (
        not pool_path.is_file()
        or pool_metadata.get("sha256") != _file_sha256(pool_path)
    ):
        raise RuntimeError("season player-pool checksum mismatch")
    player_ids = sorted({
        int(player["nhl_player_id"])
        for player in read_json(pool_path)
        if player.get("nhl_player_id") is not None
    })
    if not player_ids:
        raise RuntimeError("season player pool contains no NHL identities")
    reused_captures: dict[int, dict[str, Any]] = {}
    base_manifest_hash: str | None = None
    if base_freeze is not None:
        base_freeze = base_freeze.expanduser().resolve()
        base_manifest_path = base_freeze / "manifest.json"
        base_manifest = read_json(base_manifest_path)
        if (
            base_manifest.get("schemaVersion")
            != "player-forecast-rookie-source-freeze-v1"
            or base_manifest.get("contractVersion")
            != FANTASY_SEASON_CONTRACT_VERSION
            or base_manifest.get("contractChecksum")
            != FANTASY_SEASON_CONTRACT_SHA256
            or int(base_manifest.get("seasonId") or 0) != TARGET_SEASON
        ):
            raise RuntimeError("base rookie source freeze contract mismatch")
        landing = (base_manifest.get("files") or {}).get("playerLandings") or {}
        landing_path = (base_freeze / str(landing.get("path") or "")).resolve()
        try:
            landing_path.relative_to(base_freeze)
        except ValueError as error:
            raise RuntimeError("base rookie source freeze path is outside its root") from error
        if (
            not landing_path.is_file()
            or _file_sha256(landing_path) != landing.get("sha256")
        ):
            raise RuntimeError("base rookie source freeze checksum mismatch")
        base_rows = list(read_jsonl(landing_path))
        if len(base_rows) != int(landing.get("rows", -1)):
            raise RuntimeError("base rookie source freeze row count mismatch")
        eligible_ids = set(player_ids)
        reused_captures = {
            int(row["nhlPlayerId"]): row
            for row in base_rows
            if int(row.get("nhlPlayerId") or 0) in eligible_ids
        }
        base_manifest_hash = _file_sha256(base_manifest_path)
    output.mkdir(parents=True, exist_ok=False)
    fetched_at = datetime.now(timezone.utc).isoformat()
    captures: list[dict[str, Any]] = list(reused_captures.values())
    failures: list[dict[str, Any]] = []
    workers = max(1, min(int(max_workers), 24))
    missing_player_ids = [
        player_id for player_id in player_ids if player_id not in reused_captures
    ]
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_capture_one, player_id, fetched_at): player_id
            for player_id in missing_player_ids
        }
        for future in as_completed(futures):
            player_id = futures[future]
            try:
                captures.append(future.result())
            except Exception as error:  # capture failures are recorded, never backfilled
                failures.append({
                    "nhlPlayerId": player_id,
                    "errorType": type(error).__name__,
                })
    captures.sort(key=lambda row: row["nhlPlayerId"])
    failures.sort(key=lambda row: row["nhlPlayerId"])
    count, checksum = write_jsonl(output / "player-landings.jsonl", captures)
    model = learn_rookie_transition_model(captures)
    model["validation"] = evaluate_rookie_transition_model(captures)
    write_json(output / "rookie-transition-model.json", model)
    write_json(output / "rookie-validation-report.json", model["validation"])
    result = {
        "schemaVersion": "player-forecast-rookie-source-freeze-v1",
        "createdAt": fetched_at,
        "seasonId": TARGET_SEASON,
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": FANTASY_SEASON_CONTRACT_SHA256,
        "sourcePolicy": "official player-landing captures only; availableAt equals actual capture time",
        "sourcePlayerPoolSha256": pool_metadata["sha256"],
        "requestedPlayers": len(player_ids),
        "requestedFromNetwork": len(missing_player_ids),
        "reusedPlayers": len(reused_captures),
        "capturedPlayers": count,
        "failures": failures,
        "complete": not failures and count == len(player_ids),
        "baseFreeze": (
            {
                "manifestSha256": base_manifest_hash,
                "reusedPlayers": len(reused_captures),
            }
            if base_manifest_hash is not None
            else None
        ),
        "files": {
            "playerLandings": {
                "path": "player-landings.jsonl",
                "rows": count,
                "sha256": checksum,
            },
            "transitionModel": {
                "path": "rookie-transition-model.json",
                "rows": 1,
                "sha256": _file_sha256(output / "rookie-transition-model.json"),
            },
            "validationReport": {
                "path": "rookie-validation-report.json",
                "rows": 1,
                "sha256": _file_sha256(output / "rookie-validation-report.json"),
            },
        },
    }
    write_json(output / "manifest.json", result)
    return result


def _season_start_year(season: int) -> int:
    return season // 10000


def _age_on_season_start(birth_date: str | None, season: int) -> float | None:
    if not birth_date:
        return None
    born = date.fromisoformat(str(birth_date))
    start = date(_season_start_year(season), 9, 15)
    return (start - born).days / 365.2425


def _trajectory(rows: list[dict[str, Any]]) -> float:
    ordered = sorted(rows, key=lambda row: row["season"])
    if len(ordered) < 2:
        return 0.0
    first, last = ordered[-2:]
    first_rate = float(first["points"]) / max(1, int(first["gamesPlayed"]))
    last_rate = float(last["points"]) / max(1, int(last["gamesPlayed"]))
    return max(-1.0, min(1.0, last_rate - first_rate))


def _latest_source_before(
    totals: list[dict[str, Any]], season: int
) -> dict[str, Any] | None:
    candidates = [
        row for row in totals
        if row["league"] != NHL_LEAGUE and int(row["season"]) <= season
    ]
    return max(
        candidates,
        key=lambda row: (int(row["season"]), int(row["gamesPlayed"])),
        default=None,
    )


def _nhl_row(totals: list[dict[str, Any]], season: int) -> dict[str, Any] | None:
    candidates = [
        row for row in totals
        if row["league"] == NHL_LEAGUE and int(row["season"]) == season
    ]
    if not candidates:
        return None
    return {
        key: sum(int(row.get(key) or 0) for row in candidates)
        for key in ("gamesPlayed", "goals", "assists", "points", "penaltyMinutes")
    }


def _clamp(value: float, lower: float, upper: float) -> float:
    return min(upper, max(lower, value))


def _logit(value: float) -> float:
    probability = _clamp(value, 1e-6, 1 - 1e-6)
    return math.log(probability / (1 - probability))


def _sigmoid(value: float) -> float:
    if value >= 0:
        return 1 / (1 + math.exp(-value))
    exponential = math.exp(value)
    return exponential / (1 + exponential)


def _transition_features(
    capture: dict[str, Any], source: dict[str, Any]
) -> list[float]:
    age = _age_on_season_start(capture.get("birthDate"), int(source["season"]))
    draft = capture.get("draftOverall")
    source_rows = [
        row for row in capture["seasonTotals"]
        if row["league"] == source["league"] and int(row["season"]) <= int(source["season"])
    ]
    return [
        _clamp(((age if age is not None else 21.0) - 21.0) / 5.0, -2, 2),
        0.0 if draft is None else _clamp((128.0 - float(draft)) / 128.0, -1, 1),
        _trajectory(source_rows),
        _clamp(float(source["points"]) / max(1, int(source["gamesPlayed"])), 0, 3),
        1.0 if capture.get("position") == "D" else 0.0,
        1.0 if capture.get("position") == "G" else 0.0,
    ]


def _fit_logistic_offsets(samples: list[dict[str, Any]]) -> list[float]:
    coefficients = [0.0] * 6
    if len(samples) < 30:
        return coefficients
    learning_rate = 0.04
    ridge = 0.2
    for _ in range(500):
        gradients = [0.0] * len(coefficients)
        for sample in samples:
            prediction = _sigmoid(
                _logit(float(sample["leagueProbability"]))
                + sum(
                    coefficient * feature
                    for coefficient, feature in zip(coefficients, sample["features"])
                )
            )
            error = prediction - float(sample["madeNhl"])
            for index, feature in enumerate(sample["features"]):
                gradients[index] += error * feature
        for index in range(len(coefficients)):
            gradients[index] = gradients[index] / len(samples) + ridge * coefficients[index]
            coefficients[index] -= learning_rate * gradients[index]
    return [round(value, 10) for value in coefficients]


def learn_rookie_transition_model(
    captures: list[dict[str, Any]],
    *,
    training_cutoff_season: int = 20242025,
) -> dict[str, Any]:
    raw_transitions: list[dict[str, Any]] = []
    for capture in captures:
        totals = capture.get("seasonTotals") or []
        for source_season in sorted({
            int(row["season"])
            for row in totals
            if row["league"] != NHL_LEAGUE
            and int(row["season"]) <= training_cutoff_season
        }):
            source = _latest_source_before(totals, source_season)
            if source is None or int(source["season"]) != source_season:
                continue
            nhl = _nhl_row(totals, source_season + 10001)
            made_nhl = bool(nhl and int(nhl["gamesPlayed"]) > 0)
            raw_transitions.append({
                "league": source["league"],
                "source": source,
                "nhl": nhl,
                "madeNhl": made_nhl,
                "features": _transition_features(capture, source),
            })

    global_made = sum(1 for row in raw_transitions if row["madeNhl"])
    global_probability = (global_made + 8) / (len(raw_transitions) + 16)
    by_league: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for transition in raw_transitions:
        by_league[str(transition["league"])].append(transition)
    leagues: dict[str, Any] = {}
    for league, transitions in sorted(by_league.items()):
        made = [transition for transition in transitions if transition["madeNhl"]]
        probability = (
            len(made) + 20 * global_probability
        ) / (len(transitions) + 20)
        conditional_games = (
            sum(int(transition["nhl"]["gamesPlayed"]) for transition in made) / len(made)
            if made else 0.0
        )
        factors: dict[str, float] = {}
        for target, source_key, nhl_key in (
            ("GOALS", "goals", "goals"),
            ("ASSISTS", "assists", "assists"),
            ("PENALTY_MINUTES", "penaltyMinutes", "penaltyMinutes"),
        ):
            numerator = denominator = 0.0
            for transition in made:
                source = transition["source"]
                nhl = transition["nhl"]
                source_rate = float(source[source_key]) / max(1, int(source["gamesPlayed"]))
                nhl_rate = float(nhl[nhl_key]) / max(1, int(nhl["gamesPlayed"]))
                numerator += nhl_rate * min(82, int(nhl["gamesPlayed"]))
                denominator += source_rate * min(82, int(nhl["gamesPlayed"]))
            factors[target] = numerator / denominator if denominator > 0 else 0.0
        leagues[league] = {
            "transitions": len(transitions),
            "nhlTransitions": len(made),
            "rosterProbability": round(probability, 10),
            "conditionalNhlGames": round(conditional_games, 10),
            "equivalencyFactors": factors,
        }

    valid_factors: dict[str, list[float]] = defaultdict(list)
    for league in leagues.values():
        if league["nhlTransitions"] >= 3:
            for target, factor in league["equivalencyFactors"].items():
                if factor > 0:
                    valid_factors[target].append(float(factor))
    global_factors = {
        target: median(valid_factors[target]) if valid_factors[target] else 0.35
        for target in TRANSLATED_TARGETS
    }
    global_nhl_totals = {target: 0.0 for target in TRANSLATED_TARGETS}
    global_nhl_games = 0.0
    for transition in raw_transitions:
        nhl = transition.get("nhl")
        if not nhl or int(nhl.get("gamesPlayed") or 0) <= 0:
            continue
        games = float(nhl["gamesPlayed"])
        global_nhl_games += games
        global_nhl_totals["GOALS"] += float(nhl.get("goals") or 0)
        global_nhl_totals["ASSISTS"] += float(nhl.get("assists") or 0)
        global_nhl_totals["PENALTY_MINUTES"] += float(
            nhl.get("penaltyMinutes") or 0
        )
    for league in leagues.values():
        support = float(league["nhlTransitions"])
        for target in TRANSLATED_TARGETS:
            raw_factor = float(league["equivalencyFactors"].get(target) or 0)
            if raw_factor <= 0:
                raw_factor = global_factors[target]
            league["equivalencyFactors"][target] = round(
                (support * raw_factor + 10 * global_factors[target]) / (support + 10),
                10,
            )

    logistic_samples = []
    for transition in raw_transitions:
        league = leagues[str(transition["league"])]
        logistic_samples.append({
            **transition,
            "leagueProbability": league["rosterProbability"],
        })
    return {
        "schemaVersion": "player-forecast-rookie-transition-model-v1",
        "trainingCutoffSeason": training_cutoff_season,
        "transitionCount": len(raw_transitions),
        "globalRosterProbability": round(global_probability, 10),
        "globalEquivalencyFactors": {
            key: round(value, 10) for key, value in global_factors.items()
        },
        "globalNhlRates": {
            target: round(value / global_nhl_games, 10)
            if global_nhl_games > 0 else 0.0
            for target, value in global_nhl_totals.items()
        },
        "leagues": leagues,
        "rosterLogisticOffsets": _fit_logistic_offsets(logistic_samples),
        "featureOrder": [
            "ageCentered", "draftCapital", "developmentTrajectory",
            "sourcePointsPerGame", "isDefense", "isGoalie",
        ],
    }


def _transition_prediction(
    capture: dict[str, Any],
    source: dict[str, Any],
    transition_model: dict[str, Any],
) -> tuple[float, dict[str, float]]:
    league_model = (transition_model.get("leagues") or {}).get(source["league"])
    global_probability = float(
        transition_model.get("globalRosterProbability") or 0.2
    )
    base_probability = float(
        (league_model or {}).get("rosterProbability") or global_probability
    )
    features = _transition_features(capture, source)
    offsets = transition_model.get("rosterLogisticOffsets") or [0.0] * len(features)
    probability = _sigmoid(
        _logit(base_probability)
        + sum(
            float(coefficient) * feature
            for coefficient, feature in zip(offsets, features)
        )
    )
    factors = (
        (league_model or {}).get("equivalencyFactors")
        or transition_model.get("globalEquivalencyFactors")
        or {}
    )
    rates = {
        target: (
            float(source[source_key]) / max(1, int(source["gamesPlayed"]))
        ) * float(factors.get(target) or 0)
        for target, source_key in (
            ("GOALS", "goals"),
            ("ASSISTS", "assists"),
            ("PENALTY_MINUTES", "penaltyMinutes"),
        )
    }
    return _clamp(probability, 0.01, 0.99), rates


def evaluate_rookie_transition_model(
    captures: list[dict[str, Any]],
    *,
    validation_source_season: int = 20242025,
) -> dict[str, Any]:
    """Score one untouched source season against a model fit to earlier transitions."""
    training_model = learn_rookie_transition_model(
        captures,
        training_cutoff_season=validation_source_season - 10001,
    )
    samples: list[dict[str, Any]] = []
    for capture in captures:
        totals = capture.get("seasonTotals") or []
        source = _latest_source_before(totals, validation_source_season)
        if source is None or int(source["season"]) != validation_source_season:
            continue
        nhl = _nhl_row(totals, validation_source_season + 10001)
        predicted_probability, predicted_rates = _transition_prediction(
            capture, source, training_model
        )
        samples.append({
            "madeNhl": 1.0 if nhl and int(nhl["gamesPlayed"]) > 0 else 0.0,
            "predictedProbability": predicted_probability,
            "nhl": nhl,
            "predictedRates": predicted_rates,
        })

    roster_prior = float(training_model.get("globalRosterProbability") or 0.2)
    roster_brier = (
        sum(
            (sample["predictedProbability"] - sample["madeNhl"]) ** 2
            for sample in samples
        ) / len(samples)
        if samples else None
    )
    baseline_roster_brier = (
        sum((roster_prior - sample["madeNhl"]) ** 2 for sample in samples)
        / len(samples)
        if samples else None
    )
    rate_samples = [sample for sample in samples if sample.get("nhl")]
    model_point_errors: list[float] = []
    baseline_point_errors: list[float] = []
    global_rates = training_model.get("globalNhlRates") or {}
    for sample in rate_samples:
        nhl = sample["nhl"]
        games = max(1, int(nhl["gamesPlayed"]))
        actual_points_rate = (
            float(nhl.get("goals") or 0) + float(nhl.get("assists") or 0)
        ) / games
        predicted_points_rate = (
            float(sample["predictedRates"].get("GOALS") or 0)
            + float(sample["predictedRates"].get("ASSISTS") or 0)
        )
        baseline_points_rate = (
            float(global_rates.get("GOALS") or 0)
            + float(global_rates.get("ASSISTS") or 0)
        )
        model_point_errors.append(abs(actual_points_rate - predicted_points_rate))
        baseline_point_errors.append(abs(actual_points_rate - baseline_points_rate))
    point_rate_mae = (
        sum(model_point_errors) / len(model_point_errors)
        if model_point_errors else None
    )
    baseline_point_rate_mae = (
        sum(baseline_point_errors) / len(baseline_point_errors)
        if baseline_point_errors else None
    )
    sufficient_support = len(samples) >= 20 and len(rate_samples) >= 10
    roster_improved = bool(
        roster_brier is not None
        and baseline_roster_brier is not None
        and roster_brier < baseline_roster_brier
    )
    point_rate_improved = bool(
        point_rate_mae is not None
        and baseline_point_rate_mae is not None
        and point_rate_mae < baseline_point_rate_mae
    )
    return {
        "schemaVersion": "player-forecast-rookie-validation-v1",
        "trainingThroughSeason": validation_source_season - 10001,
        "validationSourceSeason": validation_source_season,
        "transitionCount": len(samples),
        "nhlRateCount": len(rate_samples),
        "rosterBrier": round(roster_brier, 10) if roster_brier is not None else None,
        "baselineRosterBrier": round(baseline_roster_brier, 10)
        if baseline_roster_brier is not None else None,
        "pointRateMae": round(point_rate_mae, 10)
        if point_rate_mae is not None else None,
        "baselinePointRateMae": round(baseline_point_rate_mae, 10)
        if baseline_point_rate_mae is not None else None,
        "rosterProbabilityImproved": roster_improved,
        "pointRateImproved": point_rate_improved,
        "sufficientSupport": sufficient_support,
        "eligibleForServing": (
            sufficient_support and roster_improved and point_rate_improved
        ),
        "fallbackPolicy": "retain_generic_prior_with_wider_uncertainty",
    }


def rookie_projection_profile(
    capture: dict[str, Any],
    transition_model: dict[str, Any],
) -> dict[str, Any]:
    totals = capture.get("seasonTotals") or []
    career_nhl_games = sum(
        int(row["gamesPlayed"])
        for row in totals
        if row["league"] == NHL_LEAGUE and int(row["season"]) <= LAST_COMPLETE_SEASON
    )
    source = _latest_source_before(totals, LAST_COMPLETE_SEASON)
    rookie = career_nhl_games < 25 and source is not None
    if not rookie or source is None:
        return {
            "rookie": False,
            "careerNhlGames": career_nhl_games,
            "sourceCoverage": ["official_player_landing"],
        }
    league_model = (transition_model.get("leagues") or {}).get(source["league"])
    roster_probability, translated = _transition_prediction(
        capture, source, transition_model
    )
    conditional_games = float(
        (league_model or {}).get("conditionalNhlGames") or 32.0
    )
    expected_games = min(84.0, roster_probability * conditional_games)
    sample = int(source["gamesPlayed"])
    transition_support = int((league_model or {}).get("nhlTransitions") or 0)
    return {
        "rookie": True,
        "careerNhlGames": career_nhl_games,
        "rosterProbability": round(_clamp(roster_probability, 0.01, 0.99), 10),
        "conditionalNhlGames": round(_clamp(conditional_games, 1, 84), 10),
        "expectedNhlGames": round(_clamp(expected_games, 0, 84), 10),
        "sourceLeague": source["league"],
        "sourceSeason": int(source["season"]),
        "sourceGames": sample,
        "nhleMethod": "historical_league_transition_empirical_bayes_v1",
        "translatedConditionalRates": {
            key: round(max(0.0, value), 10) for key, value in translated.items()
        },
        "transitionSupport": transition_support,
        "modelValidation": transition_model.get("validation") or {},
        "uncertaintyMultiplier": round(
            1.5 + 20 / max(20, sample) + 10 / max(10, transition_support),
            10,
        ),
        "sourceCoverage": [
            "official_player_landing",
            "league_transition_model",
            "draft_and_age_features",
        ],
    }


def load_verified_rookie_source_freeze(path: Path) -> tuple[dict[int, dict[str, Any]], dict[str, Any]]:
    manifest = read_json(path / "manifest.json")
    if (
        manifest.get("contractVersion") != FANTASY_SEASON_CONTRACT_VERSION
        or manifest.get("contractChecksum") != FANTASY_SEASON_CONTRACT_SHA256
    ):
        raise RuntimeError("rookie source freeze contract mismatch")
    files = manifest.get("files") or {}
    landing = files.get("playerLandings") or {}
    model = files.get("transitionModel") or {}
    validation = files.get("validationReport") or {}
    landing_path = path / str(landing.get("path") or "")
    model_path = path / str(model.get("path") or "")
    validation_path = path / str(validation.get("path") or "")
    if (
        not landing_path.is_file()
        or _file_sha256(landing_path) != landing.get("sha256")
        or not model_path.is_file()
        or _file_sha256(model_path) != model.get("sha256")
        or not validation_path.is_file()
        or _file_sha256(validation_path) != validation.get("sha256")
    ):
        raise RuntimeError("rookie source freeze checksum mismatch")
    transition_model = read_json(model_path)
    if transition_model.get("validation") != read_json(validation_path):
        raise RuntimeError("rookie validation report does not match the model")
    captures = {
        int(row["nhlPlayerId"]): row for row in read_jsonl(landing_path)
    }
    return captures, transition_model

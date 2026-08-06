from __future__ import annotations

import bisect
import hashlib
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from .challenger_math import assist_candidate_features
from .contract import TARGET_SEASON, VALIDATION_CONTRACT_SHA256
from .features import DECAYS, parse_toi
from .horizons import reconstructed_vintages, team_schedules
from .io import canonical_json, read_json, read_jsonl, write_json


TARGETS = (
    "goals",
    "assists",
    "primary_assists",
    "secondary_assists",
    "shots_on_goal",
    "blocked_shots",
    "hits",
    "penalty_minutes",
    "time_on_ice_seconds",
)


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@dataclass(frozen=True)
class HistoricalSeries:
    instants: tuple[datetime, ...]
    values: tuple[float, ...]
    prefix: tuple[float, ...]
    exposures: tuple[float, ...]
    exposure_prefix: tuple[float, ...]

    @classmethod
    def from_entries(cls, entries: Iterable[tuple[datetime, float, float]]) -> "HistoricalSeries":
        ordered = sorted(entries, key=lambda entry: entry[0])
        values = tuple(entry[1] for entry in ordered)
        exposures = tuple(entry[2] for entry in ordered)
        prefix = [0.0]
        exposure_prefix = [0.0]
        for value, exposure in zip(values, exposures):
            prefix.append(prefix[-1] + value)
            exposure_prefix.append(exposure_prefix[-1] + exposure)
        return cls(
            tuple(entry[0] for entry in ordered),
            values,
            tuple(prefix),
            exposures,
            tuple(exposure_prefix),
        )

    def count_before(self, cutoff: datetime) -> int:
        return bisect.bisect_left(self.instants, cutoff)

    def mean_before(self, cutoff: datetime) -> float | None:
        count = self.count_before(cutoff)
        return self.prefix[count] / count if count else None

    def last_mean_before(self, cutoff: datetime, window: int) -> float | None:
        count = self.count_before(cutoff)
        start = max(0, count - window)
        return (self.prefix[count] - self.prefix[start]) / (count - start) if count > start else None

    def ewma_before(self, cutoff: datetime, alpha: float) -> float | None:
        count = self.count_before(cutoff)
        estimate = None
        for value in self.values[:count]:
            estimate = value if estimate is None else alpha * value + (1 - alpha) * estimate
        return estimate

    def totals_before(self, cutoff: datetime) -> tuple[float, float]:
        count = self.count_before(cutoff)
        return self.prefix[count], self.exposure_prefix[count]


def _row_outcomes(row: dict[str, Any]) -> dict[str, float]:
    return {
        "goals": float(row.get("goals") or 0),
        "assists": float(row.get("assists") or 0),
        "primary_assists": float(row.get("primary_assists") or 0),
        "secondary_assists": float(row.get("secondary_assists") or 0),
        "shots_on_goal": float(row.get("shots_on_goal") or 0),
        "blocked_shots": float(row.get("blocked_shots") or 0),
        "hits": float(row.get("hits") or 0),
        "penalty_minutes": float(row.get("penalty_minutes") or 0),
        "time_on_ice_seconds": float(parse_toi(row.get("toi")) or 0),
    }


def build_validation_features(
    freeze: Path,
    targets: tuple[str, ...] = TARGETS,
) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") != VALIDATION_CONTRACT_SHA256:
        raise RuntimeError("validation freeze contract checksum mismatch")
    target_season = int(manifest.get("targetSeason", TARGET_SEASON))
    requested_targets = tuple(dict.fromkeys(targets))
    unknown_targets = sorted(set(requested_targets) - set(TARGETS))
    if unknown_targets:
        raise ValueError(f"unknown validation targets: {', '.join(unknown_targets)}")
    calculation_targets = tuple(dict.fromkeys(
        requested_targets
        + (("primary_assists", "secondary_assists") if "assists" in requested_targets else ())
        + (("time_on_ice_seconds",) if "hits" in requested_targets else ())
    ))
    games = list(read_jsonl(freeze / "games.jsonl"))
    target_games = [game for game in games if int(game["season_id"]) == target_season]
    schedules = team_schedules(target_games)
    target_game_by_id = {int(game["id"]): game for game in target_games}
    skaters = list(read_jsonl(freeze / "skaters.jsonl"))

    player_entries: dict[tuple[int, str], list[tuple[datetime, float, float]]] = defaultdict(list)
    position_entries: dict[tuple[str, str], list[tuple[datetime, float, float]]] = defaultdict(list)
    team_entries: dict[tuple[int, str, str], list[tuple[datetime, float, float]]] = defaultdict(list)
    opponent_entries: dict[tuple[int, str, str], list[tuple[datetime, float, float]]] = defaultdict(list)
    season_player_entries: dict[tuple[int, int, str], list[tuple[datetime, float, float]]] = defaultdict(list)
    target_rows: list[dict[str, Any]] = []
    for row in skaters:
        instant = _instant(str(row["start_time"]))
        exposure = float(parse_toi(row.get("toi")) or 0)
        position = str(row["position"])
        player_id = int(row["player_id"])
        outcomes = _row_outcomes(row)
        for target in calculation_targets:
            outcome = outcomes[target]
            entry = (instant, outcome, exposure)
            player_entries[(player_id, target)].append(entry)
            position_entries[(position, target)].append(entry)
            season_player_entries[(int(row["season_id"]), player_id, target)].append(entry)
            team_id = row.get("team_id")
            game = target_game_by_id.get(int(row["game_id"]))
            if team_id is not None and game is not None:
                team_id = int(team_id)
                opponent_id = int(game["away_team_id"] if team_id == int(game["home_team_id"]) else game["home_team_id"])
                team_entries[(team_id, position, target)].append(entry)
                opponent_entries[(opponent_id, position, target)].append(entry)
        if int(row["season_id"]) == target_season and row.get("team_id") is not None:
            target_rows.append(row)

    player_series = {key: HistoricalSeries.from_entries(entries) for key, entries in player_entries.items()}
    position_series = {key: HistoricalSeries.from_entries(entries) for key, entries in position_entries.items()}
    team_series = {key: HistoricalSeries.from_entries(entries) for key, entries in team_entries.items()}
    opponent_series = {key: HistoricalSeries.from_entries(entries) for key, entries in opponent_entries.items()}
    season_player_series = {
        key: HistoricalSeries.from_entries(entries) for key, entries in season_player_entries.items()
    }

    output_path = freeze / "validation-features.jsonl"
    temporary_path = freeze / "validation-features.jsonl.tmp"
    digest = hashlib.sha256()
    count = 0
    assist_decomposition_excluded = 0
    with temporary_path.open("wb") as handle:
        for row in sorted(target_rows, key=lambda item: (item["game_date"], item["game_id"], item["player_id"])):
            team_id = int(row["team_id"])
            schedule = schedules.get(team_id)
            if not schedule:
                continue
            vintages = reconstructed_vintages(schedule, int(row["game_id"]))
            outcomes = _row_outcomes(row)
            position = str(row["position"])
            population = "defense" if position == "D" else "forward"
            for vintage in vintages:
                cutoff = _instant(vintage["cutoff_at"])
                target_features: dict[str, dict[str, float | int | None]] = {}
                for target in calculation_targets:
                    series = player_series[(int(row["player_id"]), target)]
                    season_series = season_player_series[(target_season, int(row["player_id"]), target)]
                    previous_series = season_player_series.get((target_season - 10001, int(row["player_id"]), target))
                    position_history = position_series[(position, target)]
                    position_prior = position_history.mean_before(cutoff)
                    current_mean = season_series.mean_before(cutoff)
                    previous_mean = previous_series.mean_before(cutoff) if previous_series else None
                    multi_season = (
                        0.7 * current_mean + 0.3 * previous_mean
                        if current_mean is not None and previous_mean is not None
                        else current_mean if current_mean is not None else previous_mean
                    )
                    history_count = series.count_before(cutoff)
                    history_total, history_exposure = series.totals_before(cutoff)
                    projected_toi = player_series[(int(row["player_id"]), "time_on_ice_seconds")].last_mean_before(cutoff, 10)
                    features: dict[str, float | int | None] = {
                        "history_count": history_count,
                        "career_rate": series.mean_before(cutoff),
                        "previous_season_rate": previous_mean,
                        "season_to_date_rate": current_mean,
                        "multi_season_weighted_rate": multi_season,
                        "position_prior": position_prior,
                        "team_position_rate": team_series.get((team_id, position, target), HistoricalSeries((), (), (0.0,), (), (0.0,))).mean_before(cutoff),
                        "opponent_allowed_position_rate": opponent_series.get((int(vintage["opponent_team_id"]), position, target), HistoricalSeries((), (), (0.0,), (), (0.0,))).mean_before(cutoff),
                        "projected_time_on_ice_seconds": projected_toi,
                        "prior_events": history_total,
                        "prior_time_on_ice_seconds": history_exposure,
                        "home_indicator": 1 if vintage["home_away"] == "home" else 0,
                        "rest_days": vintage["rest_days"],
                        "team_game_horizon": int(vintage["team_game_horizon"]),
                    }
                    for window in (5, 10, 20):
                        features[f"last_{window}_mean"] = series.last_mean_before(cutoff, window)
                    for alpha in DECAYS:
                        features[f"ewma_{str(alpha).replace('.', '_')}"] = series.ewma_before(cutoff, alpha)
                    target_features[target] = features
                if "assists" in requested_targets:
                    assist_features = target_features["assists"]
                    for base in (
                        "career_rate", "previous_season_rate", "season_to_date_rate",
                        "multi_season_weighted_rate", "last_5_mean", "last_10_mean", "last_20_mean",
                        "ewma_0_05", "ewma_0_1", "ewma_0_2", "ewma_0_35", "ewma_0_5",
                    ):
                        primary = target_features["primary_assists"].get(base)
                        secondary = target_features["secondary_assists"].get(base)
                        if primary is not None and secondary is not None:
                            for key, value in assist_candidate_features(float(primary), float(secondary)).items():
                                assist_features[f"{key}_{base}"] = value
                for target in requested_targets:
                    if target in {"primary_assists", "secondary_assists"} and not row.get("official_assist_decomposition_complete"):
                        assist_decomposition_excluded += 1
                        continue
                    output = {
                        **vintage,
                        "game_date": str(row["game_date"]),
                        "game_id": int(row["game_id"]),
                        "game_start_time": str(row["start_time"]),
                        "season_id": int(row["season_id"]),
                        "player_id": int(row["player_id"]),
                        "position": position,
                        "population": population,
                        "conditioning": "conditional_playing",
                        "target_key": target,
                        "outcome": outcomes[target],
                        "features": target_features[target],
                        "feature_available_before_target": True,
                        "validation_only": True,
                    }
                    encoded = f"{canonical_json(output)}\n".encode()
                    handle.write(encoded)
                    digest.update(encoded)
                    count += 1
    temporary_path.replace(output_path)
    result = {
        "path": "validation-features.jsonl",
        "rows": count,
        "sha256": digest.hexdigest(),
        "featureSchemaVersion": "historical-core-issued-vintages-v3-validation",
        "maximumTeamGameHorizon": 10,
        "targets": list(requested_targets),
        "assistDecompositionExcludedRows": assist_decomposition_excluded,
        "scheduleSemantics": "final_schedule_reconstructed_validation",
        "availabilityTargetsIncluded": False,
        "promotionEligible": False,
    }
    manifest["validationFeatures"] = result
    write_json(freeze / "manifest.json", manifest)
    return result

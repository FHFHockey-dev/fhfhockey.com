from __future__ import annotations

import hashlib
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from .contract import TARGET_SEASON
from .io import canonical_json, read_json, read_jsonl

SKATER_TARGETS = ("goals", "assists", "shots_on_goal", "blocked_shots", "hits", "penalty_minutes", "time_on_ice_seconds")
GOALIE_TARGETS = ("shots_against", "goals_against", "saves", "time_on_ice_seconds")
DECAYS = (0.05, 0.1, 0.2, 0.35, 0.5)
EMPIRICAL_BAYES_PRIOR_GAMES = 10


def parse_toi(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    pieces = str(value).split(":")
    if len(pieces) != 2:
        return None
    try:
        return float(int(pieces[0]) * 60 + int(pieces[1]))
    except ValueError:
        return None


def normalized_outcomes(path: Path, population: str):
    targets = SKATER_TARGETS if population == "skater" else GOALIE_TARGETS
    for row in read_jsonl(path):
        row = dict(row)
        row["population"] = population
        row["time_on_ice_seconds"] = parse_toi(row.get("toi"))
        if population == "goalie":
            shots = float(row.get("shots_against") or 0)
            goals = float(row.get("goals_against") or 0)
            row["saves"] = max(0.0, shots - goals)
        for target in targets:
            value = row.get(target)
            if value is not None:
                yield row, target, float(value)


def build_features(freeze: Path) -> dict[str, Any]:
    target_season = int(read_json(freeze / "manifest.json").get("targetSeason", TARGET_SEASON))
    records = list(normalized_outcomes(freeze / "skaters.jsonl", "skater"))
    # The raw goalie rows are retained in the sealed freeze, but appearance is
    # not a trustworthy historical starter label. Conditional-start targets
    # stay excluded until an audited starter reconstruction is approved.
    records.sort(key=lambda item: (item[0]["game_date"], item[0]["game_id"], item[0]["player_id"], item[1]))
    player_history: dict[tuple[int, str], deque[tuple[int, float]]] = defaultdict(lambda: deque(maxlen=1000))
    position_history: dict[tuple[str, str], deque[float]] = defaultdict(lambda: deque(maxlen=10000))
    player_rate_totals: dict[tuple[int, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    position_rate_totals: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    player_toi_history: dict[int, deque[float]] = defaultdict(lambda: deque(maxlen=1000))
    ewma: dict[tuple[int, str, float], float] = {}
    output_path = freeze / "features.jsonl"
    temporary_path = freeze / "features.jsonl.tmp"
    output_handle = temporary_path.open("wb")
    output_digest = hashlib.sha256()
    output_count = 0
    by_date: dict[str, list[tuple[dict[str, Any], str, float]]] = defaultdict(list)
    for record in records:
        by_date[record[0]["game_date"]].append(record)

    for game_date in sorted(by_date):
        date_records = by_date[game_date]
        for row, target, outcome in date_records:
            player_key = (int(row["player_id"]), target)
            position_key = (str(row["position"]), target)
            season_id = int(row["season_id"])
            history_with_season = list(player_history[player_key])
            history = [value for _, value in history_with_season]
            current_season = [value for season, value in history_with_season if season == season_id]
            previous_season = [value for season, value in history_with_season if season == season_id - 10001]
            position_values = list(position_history[position_key])
            position_prior = sum(position_values) / len(position_values) if position_values else None
            current_mean = sum(current_season) / len(current_season) if current_season else None
            previous_mean = sum(previous_season) / len(previous_season) if previous_season else None
            multi_season = (
                0.7 * current_mean + 0.3 * previous_mean
                if current_mean is not None and previous_mean is not None
                else current_mean if current_mean is not None else previous_mean
            )
            empirical_bayes = None
            if position_prior is not None:
                empirical_bayes = (
                    sum(history) + EMPIRICAL_BAYES_PRIOR_GAMES * position_prior
                ) / (len(history) + EMPIRICAL_BAYES_PRIOR_GAMES)
            features: dict[str, float | int | None] = {
                "history_count": len(history),
                "career_mean": sum(history) / len(history) if history else None,
                "career_rate": sum(history) / len(history) if history else None,
                "previous_season_rate": previous_mean,
                "season_to_date_rate": current_mean,
                "multi_season_weighted_rate": multi_season,
                "position_prior": position_prior,
                "empirical_bayes_rate": empirical_bayes,
            }
            for window in (5, 10, 20):
                values = history[-window:]
                features[f"last_{window}_mean"] = sum(values) / len(values) if values else None
            for alpha in DECAYS:
                features[f"ewma_{str(alpha).replace('.', '_')}"] = ewma.get((player_key[0], target, alpha))
            player_events, player_seconds = player_rate_totals[player_key]
            position_events, position_seconds = position_rate_totals[position_key]
            prior_toi = list(player_toi_history[player_key[0]])
            projected_toi = sum(prior_toi[-10:]) / len(prior_toi[-10:]) if prior_toi else None
            if target == "time_on_ice_seconds":
                opportunity_adjusted = empirical_bayes
            elif projected_toi is not None and position_seconds > 0:
                prior_rate = position_events / position_seconds if position_seconds > 0 else 0.0
                posterior_rate = (
                    player_events + prior_rate * EMPIRICAL_BAYES_PRIOR_GAMES * projected_toi
                ) / (player_seconds + EMPIRICAL_BAYES_PRIOR_GAMES * projected_toi)
                opportunity_adjusted = posterior_rate * projected_toi
            else:
                opportunity_adjusted = empirical_bayes
            features["empirical_bayes_opportunity_adjusted_rate"] = opportunity_adjusted
            features["projected_time_on_ice_seconds"] = projected_toi
            if int(row["season_id"]) == target_season:
                output_row = {
                    "game_date": game_date,
                    "game_id": int(row["game_id"]),
                    "player_id": player_key[0],
                    "position": str(row["position"]),
                    "population": "defense" if str(row["position"]) == "D" else "forward",
                    "target_key": target,
                    "outcome": outcome,
                    "features": features,
                    "feature_available_before_target": True,
                }
                encoded = f"{canonical_json(output_row)}\n".encode()
                output_handle.write(encoded)
                output_digest.update(encoded)
                output_count += 1
        for row, target, outcome in date_records:
            player_key = (int(row["player_id"]), target)
            player_history[player_key].append((int(row["season_id"]), outcome))
            position_history[(str(row["position"]), target)].append(outcome)
            toi = parse_toi(row.get("toi"))
            if toi is not None and toi > 0:
                player_rate_totals[player_key][0] += outcome
                player_rate_totals[player_key][1] += toi
                position_rate_totals[(str(row["position"]), target)][0] += outcome
                position_rate_totals[(str(row["position"]), target)][1] += toi
            for alpha in DECAYS:
                key = (player_key[0], target, alpha)
                prior = ewma.get(key)
                ewma[key] = outcome if prior is None else alpha * outcome + (1 - alpha) * prior
        seen_player_games: set[tuple[int, int]] = set()
        for row, _, _ in date_records:
            identity = (int(row["game_id"]), int(row["player_id"]))
            toi = parse_toi(row.get("toi"))
            if identity not in seen_player_games and toi is not None and toi > 0:
                player_toi_history[identity[1]].append(toi)
                seen_player_games.add(identity)

    output_handle.close()
    temporary_path.replace(output_path)
    return {
        "rows": output_count,
        "sha256": output_digest.hexdigest(),
        "featureSchemaVersion": "historical-core-v2",
        "availabilityTargetsIncluded": False,
        "goalieConditionalStartTargetsIncluded": False,
    }

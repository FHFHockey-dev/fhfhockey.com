from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable


def _instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _canonical_issue(day: date) -> datetime:
    return datetime.combine(day, time(10, 0), tzinfo=timezone.utc)


def team_schedules(games: Iterable[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    schedules: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for game in games:
        for team_key, opponent_key, side in (
            ("home_team_id", "away_team_id", "home"),
            ("away_team_id", "home_team_id", "away"),
        ):
            team_id = game.get(team_key)
            opponent_id = game.get(opponent_key)
            if team_id is None or opponent_id is None:
                continue
            schedules[int(team_id)].append({
                **game,
                "team_id": int(team_id),
                "opponent_team_id": int(opponent_id),
                "home_away": side,
            })
    for schedule in schedules.values():
        schedule.sort(key=lambda game: (_instant(str(game["start_time"])), int(game["id"])))
    return dict(schedules)


def reconstructed_vintages(
    schedule: list[dict[str, Any]],
    target_game_id: int,
    maximum_horizon: int = 10,
) -> list[dict[str, Any]]:
    index = next(
        (position for position, game in enumerate(schedule) if int(game["id"]) == int(target_game_id)),
        None,
    )
    if index is None:
        raise ValueError("target game is not in the supplied team schedule")
    target = schedule[index]
    puck_drop = _instant(str(target["start_time"]))
    season_open = _canonical_issue(_instant(str(schedule[0]["start_time"])).date())
    opening_horizon = min(maximum_horizon, index + 1)
    vintages: list[dict[str, Any]] = []
    previous_game = schedule[index - 1] if index > 0 else None
    rest_days = None
    if previous_game is not None:
        previous_date = date.fromisoformat(str(previous_game["date"]))
        target_date = date.fromisoformat(str(target["date"]))
        rest_days = max(0, (target_date - previous_date).days - 1)
    context = {
        "target_game_id": int(target["id"]),
        "team_id": int(target["team_id"]),
        "opponent_team_id": int(target["opponent_team_id"]),
        "home_away": str(target["home_away"]),
        "rest_days": rest_days,
        "schedule_semantics": "final_schedule_reconstructed_validation",
    }
    for horizon in range(opening_horizon, 0, -1):
        completed_index = index - horizon
        if completed_index < 0:
            issued_at = season_open
        else:
            completed_day = date.fromisoformat(str(schedule[completed_index]["date"]))
            issued_at = _canonical_issue(completed_day + timedelta(days=1))
        if issued_at >= puck_drop:
            continue
        vintages.append({
            **context,
            "team_game_horizon": horizon,
            "vintage_kind": "horizon_checkpoint",
            "issued_at": issued_at.isoformat(),
            "cutoff_at": issued_at.isoformat(),
        })
    final_issue = _canonical_issue(date.fromisoformat(str(target["date"])))
    if final_issue < puck_drop and all(item["issued_at"] != final_issue.isoformat() for item in vintages):
        vintages.append({
            **context,
            "team_game_horizon": 1,
            "vintage_kind": "final_pregame",
            "issued_at": final_issue.isoformat(),
            "cutoff_at": final_issue.isoformat(),
        })
    return sorted(vintages, key=lambda item: item["issued_at"])

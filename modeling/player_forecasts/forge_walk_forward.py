"""Finite private FORGE research. No database, serving, or production integration.

Original evidence is immutable. Retrospective development never becomes as-of
evidence. Final raw history may advance, but sealed evaluation is not an input.
"""
from __future__ import annotations

import argparse
import hashlib
import fcntl
import json
import math
import os
import random
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from itertools import combinations
from pathlib import Path
from typing import Callable
from zoneinfo import ZoneInfo

from .contract import LOCKBOX_END, LOCKBOX_START, repository_root
from .io import assert_output_outside_repository, canonical_json

VERSION = "forge-walk-forward-private-v1"
ROOT = Path("/Users/tim/Documents/FHFH-private/forge-walk-forward-20261014-v1")
EASTERN = ZoneInfo("America/New_York")
READOUT = datetime(2026, 10, 28, 12, tzinfo=EASTERN)
COHORT = {8157: 8473512, 9005: 8474141, 9016: 8474590, 9320: 8478402,
          9396: 8478550, 9431: 8474716, 9572: 8477942, 9711: 8479400,
          9857: 8480208, 9964: 8476853, 10012: 8477946, 10043: 8478439,
          10163: 8481540, 10164: 8481542, 10305: 8477949, 10448: 8484984,
          10648: 8485414}
INPUT_HASHES = {
    "native-private-capture/observations.json": "77d050b7439bad0ca01d86b9570ee71086a6c02db3b22500b861309d6df6f860",
    "remaining-skater-materialization/native-skater-observations-v1.json": "f284119f6b01ec125e67f0eae41a9756b1d2085ba327d47a4de98881e04c1477",
    "team-conflict-investigation/native-two-player-observations-v1.json": "822e891d248f952d6cf856d6134da0260db3432768a73644b18a114c5227fbcc",
    "participation-source-feasibility/official-calendar.body": "4880598198856a88df0ef5622b3e7612188516906818776f6b7933a8af0bbf70",
    "participation-denominator-diagnostic/rechecked/cell-evidence.json": "3db7213a1fb3ede19e350e952e853cc3709d34b57c39bccd809e80a1a71b26a9",
}
METHODS = ("A", "B", "C")
FOLDS = (("2025-11-17", "2025-11-30"), ("2025-12-01", "2025-12-14"),
         ("2025-12-15", "2026-01-02"))
POLICY = {
    "version": VERSION, "target": "BLOCKED_SHOTS", "conditioning": "positive_TOI",
    "methods": list(METHODS), "native": {"previousAppearanceWindow": 82,
        "recentAppearanceWindow": 20, "recentDecay": 0.9, "priorAppearanceWeight": 20},
    "pool": "one equal-weight observation per eligible frozen-cohort player-game; expanding since 2025-10-07; no protected or October13 rows",
    "fallback": "shared pooled mean when native prior or individual history is unavailable; no pool means abstain",
    "uncertainty": "nearest-rank empirical P10/P90 from method individual support; pooled support when individual N<5 or prior_only; descriptive uncalibrated",
    "bias": "prediction_minus_observation", "selection": "paired cumulative adaptive MAE; all A-covered valid rows required; ties A,B,C",
    "pairs": "all same exact pregame position pairs within a slate, lower NHL ID breaks prediction ties; evaluate only when both positive_TOI",
    "clusterBootstrap": {"seed": 20261014, "draws": 1000, "units": ["game", "slate"], "minimumUnits": 2},
    "adaptive": ["2026-10-14", "2026-10-18"], "final": ["2026-10-19", "2026-10-25"],
    "readoutAt": READOUT.isoformat(), "timezone": "America/New_York",
    "captureMinutesBeforeFirstGame": 100, "featureCutoffMinutesBeforeFirstGame": 75,
    "issuanceDeadlineMinutesBeforeFirstGame": 60,
    "selectionCutoff": "same as daily feature cutoff; no same-slate settlement",
    "finalUpdate": "fixed executable/formulas; eligible prior-day final raw history advances automatically; no evaluation feedback",
    "settlement": "gameState OFF, regular season, exact game/date/teams, explicit integer BLK and valid positive TOI; missing is unknown",
    "revisions": "first eligible valid final response; no refresh of settled games; preserve failed/nonfinal first response and optional second response",
    "additionalRead": "at 10:00 Eastern on gameDate+2, only if gameDate+1 first attempt failed/nonfinal/incomplete; at most one per pinned game; no retry",
    "missedRead": "record missed window, do not catch up first attempts; a missed first attempt remains unresolved for its one second window",
    "readWindowMinutes": 30, "budgets": {"schedule": 12, "roster": 104, "boxscore_first": 52, "boxscore_second": 52},
    "requestMaxBytes": 2 * 1024 * 1024, "requestTimeoutSeconds": 20,
    "requestConcurrency": 1, "retries": 0, "promotionEligible": False,
}


def stamp(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timezone-qualified timestamp required")
    return result.astimezone(timezone.utc)


def now() -> datetime:
    return datetime.now(timezone.utc)


def digest(value) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path: Path):
    return json.loads(path.read_text())


def exclusive_json(path: Path, value) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = (canonical_json(value) + "\n").encode()
    with path.open("xb") as handle:
        handle.write(body)
        handle.flush()
        os.fsync(handle.fileno())
    return hashlib.sha256(body).hexdigest()


def exposure(root: Path, *, actor: str, action: str, artifacts: list[str], period: str,
             consequence: str, clock: datetime | None = None) -> None:
    record = {"at": (clock or now()).isoformat(), "actor": actor, "action": action,
              "artifacts": artifacts, "period": period, "consequence": consequence}
    with (root / "exposure-ledger.jsonl").open("a") as handle:
        handle.write(canonical_json(record) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def protected(day: str) -> bool:
    return LOCKBOX_START <= day <= LOCKBOX_END


def allowed_history_date(day: str) -> bool:
    return "2025-10-07" <= day <= "2026-10-25" and not protected(day) and day != "2026-10-13"


def minutes_seconds(value) -> int | None:
    if not isinstance(value, str) or not re.fullmatch(r"\d+:[0-5]\d", value):
        return None
    minute, second = map(int, value.split(":"))
    return minute * 60 + second


def normalize_blocked_shots(body: dict, game: dict, received_at: str, validated_at: str,
                            cohort: dict[int, int] = COHORT) -> dict:
    """Narrow settlement: raw final boxscore only; absence never supplies a zero."""
    received, validated = stamp(received_at), stamp(validated_at)
    if validated < received or not allowed_history_date(game["gameDate"]):
        raise ValueError("invalid settlement chronology or excluded game date")
    if (body.get("id") != game["id"] or body.get("gameDate") != game["gameDate"]
            or body.get("gameType") != 2 or body.get("season") != game["seasonId"]
            or stamp(body["startTimeUTC"]) != stamp(game["scheduledStartAt"])):
        raise ValueError("boxscore game identity mismatch")
    if body.get("gameState") != "OFF" or received <= stamp(body["startTimeUTC"]):
        return {"status": "unsettled", "reason": "official_final_unavailable", "rows": []}
    expected = {"homeTeam": game["homeTeamId"], "awayTeam": game["awayTeamId"]}
    if any(body.get(side, {}).get("id") != team for side, team in expected.items()):
        raise ValueError("boxscore historical teams mismatch")
    inverse = {nhl: player for player, nhl in cohort.items()}
    rows, seen = [], set()
    for side, team_id in expected.items():
        groups = body.get("playerByGameStats", {}).get(side, {})
        if any(not isinstance(groups.get(group), list) for group in ("forwards", "defense")):
            return {"status": "unsettled", "reason": "incomplete_skater_body", "rows": []}
        for group in ("forwards", "defense"):
            for player in groups[group]:
                nhl = player.get("playerId")
                if type(nhl) is not int or nhl <= 0 or nhl in seen:
                    raise ValueError("duplicate or invalid official player ID")
                seen.add(nhl)
                if nhl not in inverse:
                    continue
                seconds, count = minutes_seconds(player.get("toi")), player.get("blockedShots")
                valid_count = type(count) is int and count >= 0
                status = "positive_TOI" if seconds and valid_count else "zero_TOI" if seconds == 0 else "unknown"
                rows.append({"playerId": inverse[nhl], "nhlPlayerId": nhl, "gameId": game["id"],
                    "gameDate": game["gameDate"], "seasonId": game["seasonId"], "teamId": team_id,
                    "position": player.get("position"), "toiSeconds": seconds,
                    "value": count if status == "positive_TOI" else None, "status": status,
                    "receivedAt": received_at, "availableAt": validated_at,
                    "sourceHash": digest(body), "scheduledStartAt": game["scheduledStartAt"]})
    return {"status": "final", "receivedAt": received_at, "validatedAt": validated_at,
            "sourceHash": digest(body), "rows": rows,
            "unknownPlayerIds": sorted(set(cohort) - {row["playerId"] for row in rows})}


def normalize_seed(root: Path, clock: datetime) -> tuple[list[dict], list[dict], dict]:
    originals = root / "sources/original"
    for name, expected in INPUT_HASHES.items():
        if file_hash(originals / name) != expected:
            raise ValueError(f"retained source hash changed: {name}")
    history, cohort, seen, protected_n = [], [], set(), 0
    for name in tuple(INPUT_HASHES)[:3]:
        for observation in read(originals / name):
            payload = observation["payload"]
            pid, nhl = payload["playerId"], payload["nhlPlayerId"]
            if COHORT.get(pid) != nhl or any(row["playerId"] == pid for row in cohort) or payload["projections"]:
                raise ValueError("frozen cohort or native input mismatch")
            cohort.append({"playerId": pid, "nhlPlayerId": nhl, "teamId": payload["teamId"],
                           "rookieStatus": "unverified", "returnStatus": "unverified"})
            for appearance in payload["appearances"]:
                day = appearance["gameDate"]
                if protected(day):
                    protected_n += 1
                    continue  # Reject on metadata before inspecting any protected label.
                if day >= "2026-10-13" or not allowed_history_date(day):
                    raise ValueError("unexpected seed date")
                receipt = appearance["finalBoxscore"]
                raw, old_game = receipt["rawRow"]["payload"], receipt["game"]
                game = {"id": appearance["gameId"], "gameDate": day, "seasonId": appearance["seasonId"],
                        "scheduledStartAt": old_game["startTime"], "homeTeamId": old_game["homeTeamId"],
                        "awayTeamId": old_game["awayTeamId"]}
                settlement = normalize_blocked_shots(raw, game, receipt["fetchedAt"], clock.isoformat(), {pid: nhl})
                rows = settlement["rows"]
                if len(rows) != 1 or rows[0]["status"] != "positive_TOI":
                    raise ValueError("seed lacks a verified positive-TOI native label")
                row = rows[0]
                if row["value"] != appearance["targets"].get("BLOCKED_SHOTS") or row["teamId"] != appearance["teamId"]:
                    raise ValueError("seed historical team or blocked shots mismatch")
                key = pid, appearance["gameId"]
                if key in seen:
                    raise ValueError("duplicate seed player-game")
                seen.add(key)
                if stamp(payload["capturedAt"]) > clock or stamp(appearance["availableAt"]) > clock:
                    raise ValueError("seed materialization clock lies in the future")
                history.append({**row, "originalAvailableAt": appearance["availableAt"], "capturedAt": payload["capturedAt"],
                    "sourceArtifact": f"sources/original/{name}", "appearance": appearance})
    if len(cohort) != 17 or len(history) != 703 or protected_n != 628:
        raise ValueError("source counts changed; protocol revision required")
    return sorted(history, key=lambda r: (r["gameDate"], r["gameId"], r["playerId"])), sorted(cohort, key=lambda r: r["playerId"]), {
        "permittedRows": len(history), "protectedRowsExcluded": protected_n,
        "historicalAsOfQualifiedRows": 0, "sourceHashes": INPUT_HASHES}


def schedule_protocol(calendar: dict, cohort: list[dict]) -> list[dict]:
    days = []
    for offset in range(12):
        day = (date(2026, 10, 14) + timedelta(days=offset)).isoformat()
        league = [g for g in calendar["data"] if g["gameDate"] == day]
        if not league or len({g["id"] for g in league}) != len(league):
            raise ValueError("missing/duplicate calendar slate")
        first = min(datetime.fromisoformat(g["easternStartTime"]).replace(tzinfo=EASTERN) for g in league)
        games = []
        for g in league:
            players = [p["playerId"] for p in cohort if p["teamId"] in (g["homeTeamId"], g["visitingTeamId"])]
            if players:
                games.append({"id": g["id"], "gameDate": day, "seasonId": 20262027,
                    "scheduledStartAt": datetime.fromisoformat(g["easternStartTime"]).replace(tzinfo=EASTERN).isoformat(),
                    "homeTeamId": g["homeTeamId"], "awayTeamId": g["visitingTeamId"],
                    "plannedPlayerIds": sorted(players)})
        days.append({"date": day, "phase": "adaptive" if offset < 5 else "final",
            "firstLeagueStartAt": first.isoformat(), "captureAt": (first - timedelta(minutes=100)).isoformat(),
            "featureCutoffAt": (first - timedelta(minutes=75)).isoformat(),
            "selectionCutoffAt": (first - timedelta(minutes=75)).isoformat(),
            "issueDeadlineAt": (first - timedelta(minutes=60)).isoformat(),
            "leagueGames": len(league), "games": sorted(games, key=lambda g: g["id"])})
    if [sum(len(d["games"]) for d in days[:5]), sum(len(d["games"]) for d in days[5:])] != [20, 32]:
        raise ValueError("pinned game opportunity scope changed")
    return days


def initialize(root: Path, owners: dict, clock: datetime | None = None) -> dict:
    clock = clock or now()
    assert_output_outside_repository(root, repository_root())
    if set(owners) != {"training", "capture", "evaluator"} or len(set(owners.values())) != 3:
        raise ValueError("three distinct owner identities required")
    history, cohort, audit = normalize_seed(root, clock)
    days = schedule_protocol(read(root / "sources/original/participation-source-feasibility/official-calendar.body"), cohort)
    seed_hash = exclusive_json(root / "history/seed.json", history)
    protocol = {"version": VERSION, "createdAt": clock.isoformat(), "policy": POLICY,
        "policyHash": digest(POLICY), "cohort": cohort, "days": days, "owners": owners,
        "seedHash": seed_hash, "audit": audit, "isolation": "procedural_shared_filesystem"}
    exclusive_json(root / "protocol/experiment.json", protocol)
    exposure(root, actor=owners["training"], action="initialize_permitted_history", artifacts=["history/seed.json"],
             period="development", consequence="permitted historical labels exposed; protected labels excluded", clock=clock)
    return {"status": "initialized", **audit, "policyHash": protocol["policyHash"]}


def load_protocol(root: Path) -> dict:
    protocol = read(root / "protocol/experiment.json")
    if protocol["version"] != VERSION or protocol["policy"] != POLICY or protocol["policyHash"] != digest(POLICY):
        raise ValueError("protocol policy mismatch")
    if file_hash(root / "history/seed.json") != protocol["seedHash"]:
        raise ValueError("permitted history changed")
    return protocol


def eligible_history(history: list[dict], cutoff_at: str, *, mode="prospective", maximum_day: str | None = None) -> list[dict]:
    cutoff = stamp(cutoff_at)
    day = cutoff.astimezone(EASTERN).date().isoformat()
    if mode not in ("prospective", "hindcast"):
        raise ValueError("unknown chronology mode")
    selected, seen = [], set()
    for row in history:
        key = row["playerId"], row["gameId"]
        if key in seen:
            raise ValueError("duplicate history player-game")
        seen.add(key)
        if not allowed_history_date(row["gameDate"]):
            raise ValueError("excluded history date")
        if COHORT.get(row["playerId"]) != row["nhlPlayerId"]:
            raise ValueError("history outside frozen cohort")
        if row["gameDate"] >= day or maximum_day and row["gameDate"] > maximum_day:
            continue
        if row["status"] != "positive_TOI" or type(row["value"]) is not int or row["value"] < 0 or not row["toiSeconds"]:
            continue
        if mode == "prospective" and max(stamp(row["receivedAt"]), stamp(row["availableAt"]),
                                         stamp(row.get("originalAvailableAt", row["availableAt"])),
                                         stamp(row.get("capturedAt", row["availableAt"]))) >= cutoff:
            continue
        selected.append(row)
    return sorted(selected, key=lambda r: (r["gameDate"], r["gameId"], r["playerId"]))


def native_estimates(history: list[dict], candidates: list[dict], cutoff_at: str, mode: str) -> dict[int, dict]:
    if not candidates:
        return {}
    groups = defaultdict(list)
    for row in history:
        groups[row["playerId"]].append(row["appearance"])
    players = [{"playerId": c["playerId"], "nhlPlayerId": c["nhlPlayerId"],
                "sourceWatermark": digest(groups[c["playerId"]]), "appearances": groups[c["playerId"]]}
               for c in candidates]
    year = stamp(cutoff_at).astimezone(EASTERN).year
    season = 20252026 if year == 2025 or cutoff_at[:10] < "2026-07-01" else 20262027
    request = {"version": "forge-walk-forward-native-v1", "mode": mode,
               "cutoffAt": cutoff_at, "seasonId": season, "players": players}
    result = call_native(request)
    if result["mode"] != mode or result["cutoffAt"] != cutoff_at:
        raise ValueError("native adapter receipt mismatch")
    indexed = {row["playerId"]: row for row in result["rows"]}
    if len(indexed) != len(candidates) or set(indexed) != {c["playerId"] for c in candidates}:
        raise ValueError("native adapter candidate mismatch")
    return indexed


def call_native(request: dict) -> dict:
    web = repository_root() / "web"
    environment = {**os.environ, "NODE_PATH": str(web), "TS_NODE_COMPILER_OPTIONS": '{"module":"commonjs","moduleResolution":"node"}'}
    process = subprocess.run([str(web / "node_modules/.bin/ts-node"), "--transpile-only",
                              str(web / "scripts/forge-walk-forward-native.ts")], input=canonical_json(request),
                             text=True, capture_output=True, cwd=web, env=environment, timeout=120)
    if process.returncode:
        raise RuntimeError(f"native adapter failed: {process.stderr[-1200:]}")
    return json.loads(process.stdout)


def quantile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    return sorted(values)[max(0, math.ceil(probability * len(values)) - 1)]


def predict(history: list[dict], candidates: list[dict], cutoff_at: str, *, mode="prospective",
            methods=METHODS, native: Callable = native_estimates, maximum_day: str | None = None) -> list[dict]:
    if not methods or any(m not in METHODS for m in methods) or len(set(methods)) != len(methods):
        raise ValueError("unsupported method set")
    if len({c["playerId"] for c in candidates}) != len(candidates):
        raise ValueError("duplicate candidate player")
    permitted = eligible_history(history, cutoff_at, mode=mode, maximum_day=maximum_day)
    pooled = [row["value"] for row in permitted]
    native_rows = native(permitted, candidates, cutoff_at, mode) if "A" in methods else {}
    result = []
    for candidate in candidates:
        individual = [row for row in permitted if row["playerId"] == candidate["playerId"]]
        estimates = {}
        for method in methods:
            support = individual[-5:] if method == "C" else individual
            if method == "A":
                native_ids = set(native_rows[candidate["playerId"]].get("historyGameIds", []))
                support = [row for row in individual if row["gameId"] in native_ids]
            mean = native_rows[candidate["playerId"]]["mean"] if method == "A" else (
                sum(row["value"] for row in support) / len(support) if support else None)
            prior_only = mean is None
            if prior_only:
                mean = sum(pooled) / len(pooled) if pooled else None
            values = pooled if prior_only or len(support) < 5 else [row["value"] for row in support]
            if mean is not None and (not math.isfinite(mean) or mean < 0):
                raise ValueError("invalid native estimate")
            estimates[method] = {"mean": mean, "basis": "prior_only" if prior_only else "individual",
                "individualN": len(support), "pooledN": len(pooled), "bandN": len(values),
                "bandSource": "pool" if prior_only or len(support) < 5 else "individual",
                "p10": quantile(values, .1), "p90": quantile(values, .9), "intervalCalibrated": False,
                "status": "available" if mean is not None else "unavailable"}
        season = 20262027 if cutoff_at[:10] >= "2026-07-01" else 20252026
        current_n = sum(row["seasonId"] == season for row in individual)
        previous = [row for row in individual if row["seasonId"] < season]
        result.append({**candidate, "cutoffAt": cutoff_at, "mode": mode, "estimates": estimates,
            "permittedIndividualHistoryN": len(individual), "currentSeasonHistoryN": current_n,
            "currentHistoryBand": "0" if current_n == 0 else "1-4" if current_n < 5 else "5+",
            "priorSeasonTeamDifference": candidate.get("teamId") != previous[-1]["teamId"] if previous else None,
            "historyHash": digest([{k: row[k] for k in ("playerId", "gameId", "value", "teamId", "receivedAt", "availableAt")} for row in permitted]),
            "historyN": len(permitted), "conditioning": "positive_TOI"})
    return result


def metrics(pairs: list[tuple[float, float]]) -> dict:
    if not pairs:
        return {"rows": 0, "mae": None, "rmse": None, "bias": None}
    errors = [p - y for p, y in pairs]
    return {"rows": len(errors), "mae": sum(abs(e) for e in errors) / len(errors),
            "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)), "bias": sum(errors) / len(errors)}


def select_method(rows: list[dict], labels: list[dict], cutoff_at: str) -> dict:
    cutoff = stamp(cutoff_at)
    indexed, seen = {}, set()
    for label in labels:
        key = label["playerId"], label["gameId"]
        if key in seen:
            raise ValueError("duplicate selection outcome")
        seen.add(key)
        if ("2026-10-14" <= label["gameDate"] <= "2026-10-18" and label["status"] == "positive_TOI"
                and stamp(label["availableAt"]) < cutoff):
            indexed[key] = label
    eligible = []
    forecast_keys = set()
    for row in rows:
        key = row["playerId"], row["gameId"]
        if key in forecast_keys:
            raise ValueError("duplicate selection forecast")
        forecast_keys.add(key)
        label = indexed.get(key)
        if (label and row.get("membershipValid") is True and row.get("onTime") is True
                and row["teamId"] == label["teamId"] and row["estimates"].get("A", {}).get("mean") is not None
                and stamp(row["issuedAt"]) < cutoff):
            eligible.append((row, label))
    reports = {}
    for method in METHODS:
        missing = sum(row["estimates"].get(method, {}).get("mean") is None for row, _ in eligible)
        pairs = [(row["estimates"][method]["mean"], label["value"]) for row, label in eligible
                 if row["estimates"].get(method, {}).get("mean") is not None]
        reports[method] = {**metrics(pairs if missing == 0 else []), "eligible": missing == 0,
                           "missingForecasts": missing, "comparisonRows": len(eligible)}
    selected = min((m for m in METHODS if reports[m]["eligible"]),
                   key=lambda m: (reports[m]["mae"] if reports[m]["mae"] is not None else math.inf, METHODS.index(m)))
    return {"selected": selected, "comparisonRows": len(eligible), "methods": reports,
            "comparisonKeys": sorted([row["playerId"], row["gameId"]] for row, _ in eligible),
            "selectionCutoffAt": cutoff_at}


def develop(root: Path, clock: datetime | None = None) -> dict:
    clock = clock or now()
    protocol = load_protocol(root)
    history = read(root / "history/seed.json")
    report, outputs = [], []
    if (root / "development/hindcasts.json").exists() or (root / "development/report.json").exists():
        raise FileExistsError("historical development has already run")
    execution = {"startedAt": now().isoformat(), "protocolHash": file_hash(root / "protocol/experiment.json"),
                 "codeState": code_state(), "sourceHashes": INPUT_HASHES, "seedHash": protocol["seedHash"]}
    execution_hash = exclusive_json(root / "development/execution-start.json", execution)
    for start, end in FOLDS:
        cutoff = datetime.combine(date.fromisoformat(start), datetime.min.time(), EASTERN).isoformat()
        candidates = [c for c in protocol["cohort"] if any(r["playerId"] == c["playerId"] and start <= r["gameDate"] <= end for r in history)]
        predictions = predict(history, candidates, cutoff, mode="hindcast", maximum_day=(date.fromisoformat(start) - timedelta(days=1)).isoformat())
        lookup = {p["playerId"]: p for p in predictions}
        fold_rows = []
        for row in history:
            if start <= row["gameDate"] <= end:
                prediction = lookup[row["playerId"]]
                fold_rows.append({"playerId": row["playerId"], "gameId": row["gameId"], "gameDate": row["gameDate"],
                    "historicalTeamId": row["teamId"], "outcome": row["value"], "estimates": prediction["estimates"],
                    "simulatedCutoffAt": cutoff, "computedAt": clock.isoformat(), "historyHash": prediction["historyHash"],
                    "evidence": "retrospective_hindcast", "asOfQualified": False})
        report.append({"start": start, "end": end, "rows": len(fold_rows),
            "players": len({r["playerId"] for r in fold_rows}), "games": len({r["gameId"] for r in fold_rows}),
            "methods": {m: metrics([(r["estimates"][m]["mean"], r["outcome"]) for r in fold_rows if r["estimates"][m]["mean"] is not None]) for m in METHODS}})
        outputs.extend(fold_rows)
    result = {"version": VERSION, "createdAt": clock.isoformat(), "evidence": "retrospective_hindcast",
        "executionHash": execution_hash, "finishedAt": now().isoformat(),
        "asOfQualifiedRows": 0, "folds": report, "selectionUse": "development_only; prospective starts A",
        "limitations": ["Current retained cohort creates survivor/selection bias.",
                        "Prior-season 2024-25 inputs unavailable: historical A uses marked pooled fallback.",
                        "No proof for rookies, return from absence, new roles, or production readiness."]}
    verify_code_state(execution["codeState"])
    exclusive_json(root / "development/hindcasts.json", outputs)
    exclusive_json(root / "development/report.json", result)
    exposure(root, actor=protocol["owners"]["training"], action="historical_development", artifacts=["development/report.json"],
             period="2025-10-07_through_2026-01-02", consequence="retrospective development scores exposed; no as-of qualification", clock=clock)
    return result


def source_request(root: Path, key: str, kind: str, url: str, start: str, end: str,
                   *, clock: Callable = now, transport: Callable | None = None) -> dict:
    """Reserve an immutable attempt before I/O. An interrupted attempt is not retried."""
    if kind not in POLICY["budgets"] or not re.fullmatch(r"[a-zA-Z0-9_-]+", key):
        raise ValueError("invalid acquisition scope")
    allowed_url = (re.fullmatch(r"https://api-web\.nhle\.com/v1/score/2026-10-(?:1[4-9]|2[0-5])", url)
                   if kind == "schedule" else re.fullmatch(r"https://api-web\.nhle\.com/v1/roster/[A-Z]{2,3}/20262027", url)
                   if kind == "roster" else re.fullmatch(r"https://api-web\.nhle\.com/v1/gamecenter/202602\d{4}/boxscore", url))
    if not allowed_url:
        raise ValueError("source URL is outside official allowlist")
    directory = root / "sources/acquisitions" / key
    attempt_path = directory / "attempt.json"
    receipt_path = directory / "receipt.json"
    if attempt_path.exists():
        attempt = read(attempt_path)
        if attempt["url"] != url or attempt["kind"] != kind:
            raise ValueError("existing request identity mismatch")
        return read(receipt_path) if receipt_path.exists() else {"status": "interrupted", "kind": kind, "url": url}
    instant = clock()
    if not stamp(start) <= instant < stamp(end):
        return {"status": "not_due" if instant < stamp(start) else "missed", "kind": kind, "url": url}
    (root / "protocol").mkdir(parents=True, exist_ok=True)
    with (root / "protocol/request.lock").open("a") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        if attempt_path.exists():
            attempt = read(attempt_path)
            if attempt["url"] != url or attempt["kind"] != kind:
                raise ValueError("existing request identity mismatch")
            return read(receipt_path) if receipt_path.exists() else {"status": "interrupted", "kind": kind, "url": url}
        used = sum(read(p)["kind"] == kind for p in (root / "sources/acquisitions").glob("*/attempt.json"))
        if used >= POLICY["budgets"][kind]:
            raise ValueError("acquisition budget exhausted")
        if clock() >= stamp(end):
            return {"status": "missed", "kind": kind, "url": url}
        exclusive_json(attempt_path, {"kind": kind, "url": url, "startedAt": clock().isoformat(),
                                     "key": key, "windowStart": start, "windowEnd": end})
        if transport is None:
            process = subprocess.run(["/usr/bin/curl", "--disable", "--silent", "--show-error", "--fail", "--proto", "=https",
                "--max-time", str(POLICY["requestTimeoutSeconds"]), "--max-filesize", str(POLICY["requestMaxBytes"]), url],
                capture_output=True, timeout=POLICY["requestTimeoutSeconds"] + 5)
            code, body, error = process.returncode, process.stdout, process.stderr.decode(errors="replace")[:500]
        else:
            code, body, error = transport(url)
        received = clock()
        with (directory / "body").open("xb") as handle:
            handle.write(body)
        receipt = {"kind": kind, "url": url, "receivedAt": received.isoformat(), "bodyHash": hashlib.sha256(body).hexdigest(),
            "bodyBytes": len(body), "bodyPath": str((directory / "body").relative_to(root)), "exitCode": code,
            "status": "received" if code == 0 and len(body) <= POLICY["requestMaxBytes"] and received < stamp(end) else "failed",
            "error": error, "withinWindow": received < stamp(end)}
        exclusive_json(receipt_path, receipt)
        return receipt


def source_body(root: Path, receipt: dict) -> dict:
    if receipt.get("status") != "received":
        raise ValueError("successful original source receipt required")
    path = root / receipt["bodyPath"]
    if path.resolve().is_relative_to((root / "sources/acquisitions").resolve()) is False or file_hash(path) != receipt["bodyHash"]:
        raise ValueError("source body hash/path mismatch")
    return read(path)


def capture_day(root: Path, protocol: dict, day: dict, *, clock: Callable = now) -> dict:
    from .daily_board_candidates import normalize_candidate_pool
    target = root / "sources/days" / f'{day["date"]}.json'
    if target.exists():
        return {"status": "already_captured", "date": day["date"]}
    instant = clock()
    if instant < stamp(day["captureAt"]):
        return {"status": "not_due", "date": day["date"]}
    if instant >= stamp(day["featureCutoffAt"]):
        exclusive_json(target, {"status": "missed", "date": day["date"], "at": instant.isoformat(), "candidates": [],
                                "exclusions": [{"reason": "capture_window_missed"}]})
        return {"status": "missed", "date": day["date"]}
    schedule = source_request(root, f'schedule-{day["date"]}', "schedule", f'https://api-web.nhle.com/v1/score/{day["date"]}',
                              day["captureAt"], day["featureCutoffAt"], clock=clock)
    try:
        body = source_body(root, schedule)
        league_games = body["games"]
        if body["currentDate"] != day["date"] or len(league_games) != day["leagueGames"]:
            raise ValueError("calendar slate changed")
        if min(stamp(g["startTimeUTC"]) for g in league_games) != stamp(day["firstLeagueStartAt"]):
            raise ValueError("earliest game changed; no silent freeze adjustment")
        by_id = {g["id"]: g for g in league_games}
        if len(by_id) != len(league_games):
            raise ValueError("duplicate schedule game")
        relevant = []
        teams = {}
        for expected in day["games"]:
            game = by_id.get(expected["id"])
            if (not game or stamp(game["startTimeUTC"]) != stamp(expected["scheduledStartAt"])
                    or game.get("gameState") not in ("FUT", "PRE") or game.get("gameScheduleState") != "OK"
                    or game["homeTeam"]["id"] != expected["homeTeamId"] or game["awayTeam"]["id"] != expected["awayTeamId"]):
                raise ValueError("pinned game identity/start/postponement mismatch")
            relevant.append((expected, game))
            for side in ("homeTeam", "awayTeam"):
                team = game[side]
                if team["id"] in teams and teams[team["id"]] != team["abbrev"]:
                    raise ValueError("conflicting scheduled club identity")
                teams[team["id"]] = team["abbrev"]
        rosters = {}
        for team_id, abbrev in sorted(teams.items()):
            rosters[team_id] = source_request(root, f'roster-{day["date"]}-{team_id}', "roster",
                f'https://api-web.nhle.com/v1/roster/{abbrev}/20262027', day["captureAt"], day["featureCutoffAt"], clock=clock)
        candidates, exclusions = [], []
        cohort = {p["playerId"]: p for p in protocol["cohort"]}
        for expected, game in relevant:
            try:
                sources = {"schedule": {**schedule, "payload": body}}
                for name, side in (("homeRoster", "homeTeam"), ("awayRoster", "awayTeam")):
                    receipt = rosters[game[side]["id"]]
                    sources[name] = {**receipt, "payload": source_body(root, receipt)}
                pool = normalize_candidate_pool(sources, expected["id"], day["date"])
                validated = clock()
                if validated >= stamp(day["featureCutoffAt"]):
                    raise ValueError("candidate validation missed cutoff")
                pool_hash = digest(pool)
                for pid in expected["plannedPlayerIds"]:
                    identity = cohort[pid]
                    matches = [p for p in pool["players"] if p["playerId"] == identity["nhlPlayerId"]]
                    if len(matches) != 1 or matches[0]["teamId"] != identity["teamId"] or matches[0]["population"] != "skater":
                        exclusions.append({"playerId": pid, "gameId": expected["id"], "reason": "pregame_membership_unavailable_or_changed"})
                        continue
                    candidates.append({"playerId": pid, "nhlPlayerId": identity["nhlPlayerId"], "gameId": expected["id"],
                        "gameDate": day["date"], "teamId": matches[0]["teamId"], "position": matches[0]["position"],
                        "membershipValid": True, "membershipAvailableAt": validated.isoformat(), "candidatePoolHash": pool_hash,
                        "scheduledStartAt": expected["scheduledStartAt"], "rookieStatus": "unverified", "returnStatus": "unverified"})
            except (ValueError, KeyError, TypeError) as error:
                exclusions.extend({"playerId": pid, "gameId": expected["id"], "reason": str(error)} for pid in expected["plannedPlayerIds"])
        if len({c["playerId"] for c in candidates}) != len(candidates):
            raise ValueError("duplicate slate candidate")
        result = {"status": "captured", "date": day["date"], "validatedAt": clock().isoformat(),
                  "scheduleHash": schedule["bodyHash"], "candidates": candidates, "exclusions": exclusions}
    except (ValueError, KeyError, TypeError) as error:
        result = {"status": "failed", "date": day["date"], "candidates": [], "exclusions": [{"reason": str(error)}]}
    exclusive_json(target, result)
    return {"status": result["status"], "date": day["date"], "candidates": len(result["candidates"]), "exclusions": len(result["exclusions"])}


def load_history(root: Path) -> list[dict]:
    history = read(root / "history/seed.json")
    first = {(r["playerId"], r["gameId"]): r for r in history}
    records = [read(path) for path in (root / "history/settlements").glob("*.json")]
    for record in sorted(records, key=lambda r: stamp(r["availableAt"])):
        if digest(record["rows"]) != record["rowsHash"]:
            raise ValueError("settlement history content changed")
        for row in record["rows"]:
            if row["status"] in ("positive_TOI", "zero_TOI"):
                first.setdefault((row["playerId"], row["gameId"]), row)
    return list(first.values())


def settle_game(root: Path, protocol: dict, game: dict, attempt: int, *, clock: Callable = now) -> dict:
    if attempt not in (1, 2):
        raise ValueError("only two settlement slots exist")
    day = date.fromisoformat(game["gameDate"]) + timedelta(days=attempt)
    start = datetime.combine(day, datetime.min.time(), EASTERN).replace(hour=10)
    end = start + timedelta(minutes=30)
    target = root / "sources/settlements" / f'{game["id"]}-{attempt}.json'
    if target.exists():
        return {"status": "already_settled_attempt", "gameId": game["id"], "attempt": attempt}
    if clock() < start:
        return {"status": "not_due", "gameId": game["id"]}
    first_path = root / "sources/settlements" / f'{game["id"]}-1.json'
    if attempt == 2 and first_path.exists() and read(first_path).get("complete") is True:
        exclusive_json(target, {"status": "second_read_not_needed", "gameId": game["id"], "attempt": attempt,
                                "complete": True, "rows": [], "at": clock().isoformat()})
        return {"status": "second_read_not_needed", "gameId": game["id"]}
    receipt = source_request(root, f'boxscore-{game["id"]}-{attempt}', "boxscore_first" if attempt == 1 else "boxscore_second",
        f'https://api-web.nhle.com/v1/gamecenter/{game["id"]}/boxscore', start.isoformat(), end.isoformat(), clock=clock)
    try:
        body = source_body(root, receipt)
        result = normalize_blocked_shots(body, game, receipt["receivedAt"], clock().isoformat())
        result["complete"] = result["status"] == "final" and all(any(r["playerId"] == p and r["status"] in ("positive_TOI", "zero_TOI") for r in result["rows"]) for p in game["plannedPlayerIds"])
        positives = [r for r in result["rows"] if r["status"] == "positive_TOI"]
        appearances = {}
        if positives:
            raw_row = {"id": game["id"], "game_id": game["id"], "season_id": game["seasonId"],
                       "fetched_at": receipt["receivedAt"], "payload_hash": receipt["bodyHash"], "payload": body}
            canonical_game = {"id": game["id"], "date": game["gameDate"], "seasonId": game["seasonId"], "type": 2,
                              "startTime": game["scheduledStartAt"], "homeTeamId": game["homeTeamId"], "awayTeamId": game["awayTeamId"]}
            normalized = call_native({"version": "forge-walk-forward-native-v1", "mode": "normalize", "seasonId": 20262027,
                "players": [{"playerId": r["playerId"], "nhlPlayerId": r["nhlPlayerId"], "sourceWatermark": receipt["bodyHash"],
                    "rawGames": [{"rawRow": raw_row, "game": canonical_game, "teamId": r["teamId"]}]} for r in positives]})
            appearances = {r["playerId"]: r["appearances"][0] for r in normalized["rows"]}
        known = [r for r in result["rows"] if r["status"] in ("positive_TOI", "zero_TOI")]
        if known:
            available = clock().isoformat()
            history_rows = [{**r, "availableAt": available,
                             "originalAvailableAt": appearances.get(r["playerId"], {}).get("availableAt", available),
                             "appearance": appearances.get(r["playerId"]), "sourceArtifact": receipt["bodyPath"]} for r in known]
            exclusive_json(root / "history/settlements" / f'{game["id"]}-{attempt}.json', {
                "availableAt": available, "rows": history_rows, "rowsHash": digest(history_rows), "sourceReceipt": receipt})
        result.update(gameId=game["id"], attempt=attempt, receipt=receipt)
    except (ValueError, KeyError, TypeError, RuntimeError) as error:
        result = {"status": "unresolved", "complete": False, "gameId": game["id"], "attempt": attempt,
                  "reason": str(error), "receipt": receipt, "rows": []}
    exclusive_json(target, result)
    # Operational output is deliberately independent of count values and errors.
    return {"status": result["status"], "gameId": game["id"], "attempt": attempt, "complete": result["complete"]}


def code_state() -> dict:
    base = repository_root()
    paths = [base / "modeling/player_forecasts/forge_walk_forward.py",
             base / "modeling/player_forecasts/tests/test_harness.py",
             base / "modeling/player_forecasts/contract.py", base / "modeling/player_forecasts/io.py",
             base / "modeling/player_forecasts/daily_board_candidates.py",
             base / "modeling/player_forecasts/daily_board_settlement.py",
             base / "modeling/player_forecasts/daily_board_data.py",
             base / "modeling/player_forecasts/daily_board_roster_report.py",
             base / "modeling/player_forecasts/daily_board.py"]
    probe = call_native({"version": "forge-walk-forward-native-v1", "mode": "prospective",
        "cutoffAt": now().isoformat(), "seasonId": 20262027,
        "players": [{"playerId": 9711, "nhlPlayerId": 8479400, "sourceWatermark": "runtime-probe-no-history", "appearances": []}]})
    return {"checkout": {"branch": subprocess.check_output(["git", "branch", "--show-current"], cwd=base, text=True).strip(),
                "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=base, text=True).strip(),
                "dirtyStatus": subprocess.check_output(["git", "status", "--short"], cwd=base, text=True),
                "dirtyCodeHashes": "Executed files, including dirty files, are individually pinned below."},
            "python": {"executable": sys.executable, "version": sys.version, "executableHash": file_hash(Path(sys.executable))},
            "pythonFiles": {str(p): file_hash(p) for p in paths}, "native": probe["runtimeDependencies"]}


def verify_code_state(expected: dict) -> None:
    paths = {**expected["pythonFiles"], **expected["native"]["modules"],
        expected["python"]["executable"]: expected["python"]["executableHash"],
        expected["native"]["node"]["executablePath"]: expected["native"]["node"]["sha256"],
        expected["native"]["packageLock"]["path"]: expected["native"]["packageLock"]["sha256"]}
    for path, expected_hash in paths.items():
        if file_hash(Path(path)) != expected_hash:
            raise ValueError(f"locked executable/dependency changed: {path}")


def readiness(root: Path) -> dict:
    result = read(root / "protocol/readiness.json")
    protocol = load_protocol(root)
    if result["status"] != "accepted" or result["protocolHash"] != file_hash(root / "protocol/experiment.json"):
        raise ValueError("accepted preparation receipt required")
    if not result["independentReviewHashes"]:
        raise ValueError("independent review required before prospective launch")
    for relative, expected in result["independentReviewHashes"].items():
        if file_hash(root / relative) != expected:
            raise ValueError("preparation review changed")
    verify_code_state(result["codeState"])
    return {**result, "protocol": protocol}


def freeze_pairs(candidates: list[dict]) -> list[list[list[int]]]:
    return [[[left["playerId"], left["gameId"]], [right["playerId"], right["gameId"]]]
            for left, right in combinations(sorted(candidates, key=lambda c: c["nhlPlayerId"]), 2)
            if left.get("position") in ("C", "L", "R", "F", "D") and left["position"] == right.get("position")]


def adaptive_rows(root: Path) -> list[dict]:
    rows = []
    for path in sorted((root / "predictions").glob("2026-10-*.json")):
        packet = issued_packet(root, path)
        if packet is None:
            continue
        if packet["phase"] == "adaptive":
            if digest(packet["rows"]) != packet["rowsHash"]:
                raise ValueError("issued prediction content changed")
            rows.extend(packet["rows"])
    return rows


def issued_packet(root: Path, path: Path) -> dict | None:
    """Only a durable packet with a successful completion receipt is issued."""
    receipt_path = root / "predictions/receipts" / path.name
    if not receipt_path.exists():
        return None
    receipt = read(receipt_path)
    if receipt["status"] != "issued":
        return None
    packet = read(path)
    if (receipt["packetHash"] != file_hash(path) or digest(packet["rows"]) != packet["rowsHash"]
            or stamp(receipt["completedAt"]) >= stamp(packet["issueDeadlineAt"])
            or stamp(receipt["completedAt"]) < stamp(packet["issuedAt"])):
        raise ValueError("invalid durable issuance receipt")
    return packet


def final_lock(root: Path, protocol: dict, history: list[dict], *, clock: Callable = now) -> dict:
    path = root / "protocol/final-lock.json"
    if path.exists():
        return read(path)
    day = protocol["days"][5]
    instant = clock()
    if not stamp(day["selectionCutoffAt"]) <= instant < stamp(day["issueDeadlineAt"]):
        raise ValueError("final policy lock is outside its selection/issuance window")
    accepted = readiness(root)
    choice = select_method(adaptive_rows(root), history, day["selectionCutoffAt"])
    permitted = eligible_history(history, day["featureCutoffAt"], maximum_day="2026-10-18")
    result = {"version": VERSION, "lockedAt": instant.isoformat(), "selected": choice["selected"],
        "selection": choice, "protocolHash": file_hash(root / "protocol/experiment.json"),
        "codeState": accepted["codeState"], "policyHash": protocol["policyHash"],
        "historyHash": digest(permitted), "historyRows": len(permitted), "tuningPermitted": False,
        "automaticUpdate": POLICY["finalUpdate"], "readoutAt": POLICY["readoutAt"]}
    exclusive_json(path, result)
    return result


def review_final_lock(root: Path, protocol: dict, *, clock: Callable = now) -> dict:
    """Evaluator-owned mechanical verification after independent source review."""
    target = root / "protocol/final-lock-review.json"
    if target.exists():
        return {"status": "already_reviewed"}
    day = protocol["days"][5]
    if not stamp(day["selectionCutoffAt"]) <= clock() < stamp(day["issueDeadlineAt"]):
        return {"status": "outside_final_lock_review_window"}
    path = root / "protocol/final-lock.json"
    if not path.exists():
        return {"status": "awaiting_final_lock"}
    locked, accepted = read(path), readiness(root)
    history = load_history(root)
    choice = select_method(adaptive_rows(root), history, day["selectionCutoffAt"])
    permitted = eligible_history(history, day["featureCutoffAt"], maximum_day="2026-10-18")
    if (locked["selection"] != choice or locked["selected"] != choice["selected"]
            or locked["codeState"] != accepted["codeState"] or locked["tuningPermitted"] is not False
            or locked["historyHash"] != digest(permitted) or locked["policyHash"] != protocol["policyHash"]
            or locked["protocolHash"] != file_hash(root / "protocol/experiment.json")
            or not stamp(day["selectionCutoffAt"]) <= stamp(locked["lockedAt"]) <= clock()):
        raise ValueError("final lock fails independent receipt verification")
    reviewed = clock()
    if reviewed >= stamp(day["issueDeadlineAt"]):
        return {"status": "missed_final_lock_review"}
    exclusive_json(target, {"status": "accepted", "reviewer": protocol["owners"]["evaluator"],
        "reviewedAt": reviewed.isoformat(), "lockHash": file_hash(path),
        "scope": "Independent evaluator rerun of policy, selection denominator, history, code and chronology bindings."})
    return {"status": "accepted_final_lock", "reviewedAt": reviewed.isoformat()}


def issue_day(root: Path, protocol: dict, day: dict, *, clock: Callable = now,
              predictor: Callable = predict) -> dict:
    target = root / "predictions" / f'{day["date"]}.json'
    attempt = root / "predictions/attempts" / f'{day["date"]}.json'
    if target.exists():
        return {"status": "already_issued" if issued_packet(root, target) else "previous_attempt_terminal",
                "date": day["date"], "hash": file_hash(target)}
    if attempt.exists():
        return {"status": "previous_attempt_terminal", "date": day["date"]}
    instant = clock()
    if instant < stamp(day["featureCutoffAt"]):
        return {"status": "not_due", "date": day["date"]}
    if instant >= stamp(day["issueDeadlineAt"]):
        exclusive_json(attempt, {"status": "missed", "at": instant.isoformat(), "date": day["date"]})
        return {"status": "missed", "date": day["date"]}
    accepted = readiness(root)
    if day["phase"] == "final":
        lock_path = root / "protocol/final-lock.json"
        review_path = root / "protocol/final-lock-review.json"
        if not lock_path.exists() or not review_path.exists():
            return {"status": "awaiting_independent_final_lock_review", "date": day["date"]}
        locked, reviewed = read(lock_path), read(review_path)
        if (reviewed["status"] != "accepted" or reviewed["lockHash"] != file_hash(lock_path)
                or reviewed["reviewer"] != protocol["owners"]["evaluator"]
                or stamp(reviewed["reviewedAt"]) >= stamp(protocol["days"][5]["issueDeadlineAt"])):
            raise ValueError("final lock review is invalid or late")
        if day["date"] != "2026-10-19" and not issued_packet(root, root / "predictions/2026-10-19.json"):
            return {"status": "blocked_unready_final_launch", "date": day["date"]}
        verify_code_state(locked["codeState"])
        selection = {"selected": locked["selected"], "finalLockHash": file_hash(lock_path)}
        methods = tuple(m for m in METHODS if m in ("A", locked["selected"]))
    else:
        methods = METHODS
        selection = None
    candidate_path = root / "sources/days" / f'{day["date"]}.json'
    if not candidate_path.exists():
        return {"status": "awaiting_candidate_receipt", "date": day["date"]}
    captured = read(candidate_path)
    if captured["status"] != "captured" or stamp(captured["validatedAt"]) >= stamp(day["featureCutoffAt"]):
        exclusive_json(attempt, {"status": "unavailable", "date": day["date"], "reason": "no_cutoff_valid_candidates"})
        return {"status": "unavailable", "date": day["date"]}
    candidates = captured["candidates"]
    if not candidates:
        exclusive_json(attempt, {"status": "unavailable", "date": day["date"], "reason": "no_membership_valid_candidates"})
        return {"status": "unavailable", "date": day["date"]}
    if any(stamp(c["membershipAvailableAt"]) >= stamp(day["featureCutoffAt"]) for c in candidates):
        raise ValueError("late membership cannot bind forecast")
    exclusive_json(attempt, {"status": "started", "date": day["date"], "at": instant.isoformat(),
                             "candidateHash": file_hash(candidate_path), "codeStateHash": digest(accepted["codeState"])})
    history = load_history(root)
    if selection is None:
        selection = select_method(adaptive_rows(root), history, day["selectionCutoffAt"])
    rows = predictor(history, candidates, day["featureCutoffAt"], methods=methods)
    issued = clock()
    if issued >= stamp(day["issueDeadlineAt"]):
        exclusive_json(root / "predictions/rejected" / f'{day["date"]}.json', {
            "status": "missed_during_calculation", "finishedAt": issued.isoformat(), "date": day["date"]})
        return {"status": "missed_during_calculation", "date": day["date"]}
    for row in rows:
        row.update(issuedAt=issued.isoformat(), onTime=True)
    packet = {"version": VERSION, "date": day["date"], "phase": day["phase"], "issuedAt": issued.isoformat(),
        "featureCutoffAt": day["featureCutoffAt"], "issueDeadlineAt": day["issueDeadlineAt"],
        "selected": selection["selected"], "selection": selection, "rows": rows, "rowsHash": digest(rows),
        "pairs": freeze_pairs(candidates), "candidateHash": file_hash(candidate_path),
        "exclusions": captured["exclusions"], "codeStateHash": digest(accepted["codeState"]), "policyHash": protocol["policyHash"]}
    packet_hash = exclusive_json(target, packet)
    completed = clock()
    status = "issued" if completed < stamp(day["issueDeadlineAt"]) else "missed_during_write"
    exclusive_json(root / "predictions/receipts" / target.name, {
        "status": status, "completedAt": completed.isoformat(), "packetHash": packet_hash})
    return {"status": status, "date": day["date"], "forecasts": len(rows), "hash": packet_hash}


def cluster_difference(rows: list[tuple[str, int, float]], unit: str) -> dict:
    groups = defaultdict(list)
    for day, game, difference in rows:
        groups[day if unit == "slate" else (day, game)].append(difference)
    if len(groups) < 2:
        return {"units": len(groups), "interval": None, "reason": "fewer_than_two_clusters"}
    values = [v for _, v in sorted(groups.items())]
    rng = random.Random(POLICY["clusterBootstrap"]["seed"])
    samples = []
    for _ in range(POLICY["clusterBootstrap"]["draws"]):
        sampled = [rng.choice(values) for _ in values]
        samples.append(sum(sum(v) for v in sampled) / sum(len(v) for v in sampled))
    return {"units": len(values), "meanLossReduction": sum(sum(v) for v in values) / sum(len(v) for v in values),
            "lower95": quantile(samples, .025), "upper95": quantile(samples, .975), "smallSample": True}


def final_report(root: Path, protocol: dict, *, clock: Callable = now) -> dict:
    if clock() < READOUT:
        return {"status": "sealed_until_readout", "readoutAt": READOUT.isoformat()}
    target = root / "reports/final-report.json"
    if target.exists():
        return {"status": "already_released", "report": str(target), "hash": file_hash(target)}
    lock_path = root / "protocol/final-lock.json"
    locked = read(lock_path) if lock_path.exists() else None
    scoring_code = locked["codeState"] if locked else code_state()
    verify_code_state(scoring_code)
    selected = locked["selected"] if locked else None
    history = [r for r in load_history(root) if stamp(r["availableAt"]) < READOUT]
    labels = {(r["playerId"], r["gameId"]): r for r in history if r["status"] == "positive_TOI"}
    observed_status = {(r["playerId"], r["gameId"]): r["status"] for r in history}
    packets = [p for path in sorted((root / "predictions").glob("2026-10-*.json")) if (p := issued_packet(root, path))]
    final = [p for p in packets if p["phase"] == "final"]
    all_rows, matched, exclusions, pairs = [], [], [], []
    for packet in final:
        if digest(packet["rows"]) != packet["rowsHash"]:
            raise ValueError("issued forecast changed before scoring")
        lookup = {(r["playerId"], r["gameId"]): r for r in packet["rows"]}
        all_rows.extend(packet["rows"])
        exclusions.extend(packet["exclusions"])
        for row in packet["rows"]:
            label = labels.get((row["playerId"], row["gameId"]))
            if not label or label["teamId"] != row["teamId"]:
                exclusions.append({"playerId": row["playerId"], "gameId": row["gameId"], "reason": "positive_TOI_label_unavailable_or_team_conflict"})
            elif row["estimates"].get("A", {}).get("mean") is not None:
                matched.append((row, label))
        for pair in packet["pairs"]:
            keys = [tuple(k) for k in pair]
            observed = [labels.get(k) for k in keys]
            predicted = [lookup[k] for k in keys]
            if not all(observed[i] and observed[i]["teamId"] == predicted[i]["teamId"] for i in range(2)):
                pairs.append({"keys": pair, "status": "unavailable"})
                continue
            regrets = {}
            for method in dict.fromkeys(("A", selected)):
                if method is None or any(p["estimates"].get(method, {}).get("mean") is None for p in predicted):
                    continue
                chosen = min(range(2), key=lambda i: (-predicted[i]["estimates"][method]["mean"], predicted[i]["nhlPlayerId"]))
                regrets[method] = max(o["value"] for o in observed) - observed[chosen]["value"]
            complete = selected is not None and all(m in regrets for m in ("A", selected))
            pairs.append({"keys": pair, "status": "evaluated" if complete else "forecast_unavailable", "regret": regrets,
                          "improvementOverA": regrets["A"] - regrets[selected] if complete else None})
    methods = {}
    for method in dict.fromkeys(("A", selected)):
        if method is None:
            continue
        missing = sum(r["estimates"].get(method, {}).get("mean") is None for r, _ in matched)
        comparison = [(r["estimates"][method]["mean"], y["value"]) for r, y in matched if r["estimates"].get(method, {}).get("mean") is not None]
        methods[method] = {**metrics(comparison if not missing else []), "missingOnBaselineSet": missing}
        if not missing:
            differences = [(r["gameDate"], r["gameId"], abs(r["estimates"]["A"]["mean"] - y["value"]) - abs(r["estimates"][method]["mean"] - y["value"])) for r, y in matched]
            methods[method]["pairedClusters"] = {unit: cluster_difference(differences, unit) for unit in ("game", "slate")}
            bands = [(r["estimates"][method], y["value"]) for r, y in matched if r["estimates"][method]["p10"] is not None]
            methods[method]["descriptiveBandCoverage"] = sum(e["p10"] <= y <= e["p90"] for e, y in bands) / len(bands) if bands else None
    def subgroup(group):
        subset = [(r, y) for r, y in matched if group(r)]
        return {"rows": len(subset), "players": len({r["playerId"] for r, _ in subset}),
                "methods": {m: metrics([(r["estimates"][m]["mean"], y["value"]) for r, y in subset])
                    for m in methods if all(r["estimates"].get(m, {}).get("mean") is not None for r, _ in subset)}}
    acquisition_counts = Counter(read(p)["kind"] for p in (root / "sources/acquisitions").glob("*/attempt.json"))
    issued = {(r["playerId"], r["gameId"]): r for p in packets for r in p["rows"]}
    coverage = [{"date": d["date"], "phase": d["phase"], "playerId": pid, "gameId": g["id"],
                 "issued": (pid, g["id"]) in issued, "observedStatus": observed_status.get((pid, g["id"]), "unknown"),
                 "matchedTeam": labels.get((pid, g["id"]), {}).get("teamId") == issued[(pid, g["id"])]["teamId"]
                     if (pid, g["id"]) in issued and (pid, g["id"]) in labels else None}
                for d in protocol["days"] for g in d["games"] for pid in g["plannedPlayerIds"]]
    report = {"version": VERSION, "releasedAt": clock().isoformat(), "readoutAt": READOUT.isoformat(),
        "scoringCodeState": scoring_code, "scoringCodeBasis": "final_lock" if locked else "current_code_for_blocked_launch_report",
        "status": "completed_finite_pilot" if issued_packet(root, root / "predictions/2026-10-19.json") else "blocked_unready_final_launch",
        "selected": selected, "issuedSlates": len(final), "issuedPlayerGames": len(all_rows), "pairedPositiveTOIRows": len(matched),
        "evaluatedPlayers": len({r["playerId"] for r, _ in matched}), "methods": methods, "pairs": pairs, "exclusions": exclusions,
        "frozenPairs": len(pairs), "evaluatedPairs": sum(p["status"] == "evaluated" for p in pairs),
        "pairMeanImprovementOverA": (sum(p["improvementOverA"] for p in pairs if p["status"] == "evaluated") /
                                     sum(p["status"] == "evaluated" for p in pairs)) if any(p["status"] == "evaluated" for p in pairs) else None,
        "scheduledOpportunities": {phase: sum(len(g["plannedPlayerIds"]) for d in protocol["days"] if d["phase"] == phase for g in d["games"])
                                   for phase in ("adaptive", "final")},
        "acquisitionAttempts": dict(acquisition_counts), "acquisitionLimits": POLICY["budgets"],
        "inputManifestHash": file_hash(root / "protocol/experiment.json"),
        "predictionHashes": {p.name: file_hash(p) for p in sorted((root / "predictions").glob("2026-10-*.json"))},
        "historicalReport": "development/report.json",
        "opportunityCoverage": coverage,
        "attempts": [read(p) for p in sorted((root / "predictions/attempts").glob("*.json"))],
        "missingSlates": [d["date"] for d in protocol["days"] if d["phase"] == "final" and not any(p["date"] == d["date"] for p in final)],
        "cohorts": {"rookies": "not_estimable_unverified", "returning": "not_estimable_unverified", "verifiedTrades": "not_estimable_unverified",
                    "currentHistoryBands": {band: subgroup(lambda r, band=band: r["currentHistoryBand"] == band) for band in ("0", "1-4", "5+")},
                    "descriptivePriorTeamDifference": {str(flag): subgroup(lambda r, flag=flag: r["priorSeasonTeamDifference"] is flag) for flag in (True, False, None)}},
        "promotionEligible": False, "limitations": ["17 retained skaters; narrow conditional target and small dependent sample.",
            "Historical results are retrospective; no causal as-of qualification.", "Procedural shared-filesystem evaluator isolation.",
            "No unconditional fantasy, FORGE-wide, production or RSO readiness claim."],
        "nextExperiment": "Separately preregister native G,A,PPP,SOG,HIT,BLK with fresh untouched dates, target provenance and newcomer evidence; participation/league eligibility required for RSO."}
    exclusive_json(root / "evaluator-sealed/final-report.json", report)
    exclusive_json(target, report)
    exposure(root, actor=protocol["owners"]["evaluator"], action="single_final_readout", artifacts=["reports/final-report.json"],
             period="final", consequence="final scores exposed after fixed readout; no further tuning authorized", clock=clock())
    return {"status": "released", "report": str(target), "hash": file_hash(target)}


def tick(root: Path, role: str, owner: str, *, clock: Callable = now) -> dict:
    protocol = load_protocol(root)
    if role not in protocol["owners"] or protocol["owners"][role] != owner:
        raise ValueError("assigned role owner required")
    if role == "evaluator":
        return final_report(root, protocol, clock=clock) if clock() >= READOUT else review_final_lock(root, protocol, clock=clock)
    readiness(root)
    results = []
    instant = clock()
    if instant >= READOUT:
        return {"status": "operations_closed", "role": role}
    if role == "capture":
        for day in protocol["days"]:
            if stamp(day["captureAt"]) <= instant and not (root / "sources/days" / f'{day["date"]}.json').exists():
                results.append(capture_day(root, protocol, day, clock=clock))
            for game in day["games"]:
                for attempt in (1, 2):
                    due = datetime.combine(date.fromisoformat(game["gameDate"]) + timedelta(days=attempt), datetime.min.time(), EASTERN).replace(hour=10)
                    if due <= instant and not (root / "sources/settlements" / f'{game["id"]}-{attempt}.json').exists():
                        results.append(settle_game(root, protocol, game, attempt, clock=clock))
    day = protocol["days"][5]
    if role == "training" and stamp(day["selectionCutoffAt"]) <= instant < stamp(day["issueDeadlineAt"]):
        results.append({"status": "final_policy_locked", "selected": final_lock(root, protocol, load_history(root), clock=clock)["selected"]})
    for day in protocol["days"]:
        assigned = role == ("training" if day["phase"] == "adaptive" else "capture")
        if assigned and stamp(day["featureCutoffAt"]) <= instant:
            results.append(issue_day(root, protocol, day, clock=clock))
    return {"status": "tick_complete", "role": role, "results": results}


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("init", "develop", "status", "tick", "code-state"))
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--training-owner")
    parser.add_argument("--capture-owner")
    parser.add_argument("--evaluator-owner")
    parser.add_argument("--role", choices=("training", "capture", "evaluator"))
    parser.add_argument("--owner")
    args = parser.parse_args(argv)
    if args.root.resolve() != ROOT.resolve():
        raise ValueError("CLI execution is restricted to the approved private artifact root")
    if args.command == "init":
        result = initialize(args.root, {"training": args.training_owner, "capture": args.capture_owner, "evaluator": args.evaluator_owner})
    elif args.command == "develop":
        result = develop(args.root)
    elif args.command == "tick":
        result = tick(args.root, args.role, args.owner)
    elif args.command == "code-state":
        result = code_state()
    else:
        protocol = load_protocol(args.root)
        result = {"status": "protocol_loaded", "policyHash": protocol["policyHash"],
                  "preparationAccepted": (args.root / "protocol/readiness.json").exists(), "readoutAt": POLICY["readoutAt"]}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

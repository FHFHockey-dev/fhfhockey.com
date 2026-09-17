"""Bounded candidate/baseline capture and settlement; scheduler activation is separate.

One bounded Eastern slate, at most 16 games and two workers. No serving forecast,
database, roster or production configuration writes occur. Artifacts stay private.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import os
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from .contract import repository_root
from .daily_board_data import validate_range
from .daily_board_settlement import (capture_final, fetch_official_json, settle_forecast_artifact,
    verify_forecast_export, verify_settlement_capture, _timestamp)
from .io import assert_output_outside_repository, canonical_json, read_json, read_jsonl, write_json

VERSION = "starter-board-daily-settlement-v1"


def slate_games(payload: dict, slate_date: str) -> list[dict]:
    if payload.get("currentDate") != slate_date or not isinstance(payload.get("games"), list) or len(payload["games"]) > 16:
        raise ValueError("a complete exact-date slate of at most 16 games is required")
    seen = set()
    for game in payload["games"]:
        game_id = game.get("id")
        if type(game_id) is not int or game_id <= 0 or game_id in seen or game.get("gameDate") != slate_date:
            raise ValueError("invalid, duplicate or wrong-date official game")
        _timestamp(game["startTimeUTC"])
        if type(game.get("gameType")) is not int or not isinstance(game.get("gameState"), str) or not isinstance(game.get("gameScheduleState"), str):
            raise ValueError("official game type and state are required")
        seen.add(game_id)
    return sorted(payload["games"], key=lambda game: game["id"])


def _export_forecasts(game_id: int, slate_date: str, output: Path) -> None:
    web = repository_root() / "web"
    result = subprocess.run(["node", str(web / "node_modules/ts-node/dist/bin.js"), "--transpile-only", "--compiler-options",
        '{"module":"commonjs","moduleResolution":"node"}', "scripts/export-starter-board-forecasts.ts", slate_date, str(game_id), str(output)],
        cwd=web, env={**os.environ, "NODE_PATH": str(web)}, capture_output=True, timeout=70)
    if result.returncode:
        # Child output may contain connection details; retain only stage/type in the report.
        raise RuntimeError("frozen forecast export unavailable")


def _artifact(destination: Path, build, verify):
    if destination.exists():
        return verify(destination)
    staging = destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")
    try:
        build(staging)
        result = verify(staging)
        if destination.exists():
            raise ValueError("artifact appeared while the slate lock was held")
        staging.rename(destination)
        return result
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _capture_game_candidates(game: dict, slate_date: str, slate_root: Path, score: dict, run_id: str, now: datetime) -> dict:
    from .daily_board_candidates import capture_candidates, verify_candidate_capture
    result = {"gameId": game["id"], "gameType": game["gameType"]}
    if game["gameType"] not in (1, 2):
        return {**result, "status": "unsupported", "reason": "game_type_outside_daily_board_contract"}
    if game["gameState"] not in ("FUT", "PRE") or game["gameScheduleState"] != "OK" or _timestamp(game["startTimeUTC"]) <= now:
        return {**result, "status": "skipped", "reason": "game_not_confirmed_pregame"}
    try:
        root = slate_root / str(game["id"]) / "candidates"
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        output = root / f"capture-{run_id}"
        pool, checksum = _artifact(output,
            lambda path: capture_candidates(game["id"], slate_date, path, schedule_source=score), verify_candidate_capture)
        return {**result, "status": "captured", "candidateDirectory": str(output), "candidateManifestSha256": checksum,
            "candidates": len(pool["players"]), "capturedAt": pool["capturedAt"]}
    except Exception as error:
        return {**result, "status": "failed", "stage": "candidate_capture", "errorType": type(error).__name__}


def _select_candidate_capture(game_root: Path, game: dict, slate_date: str, forecast_file: Path | None = None) -> tuple[Path | None, dict]:
    from .daily_board_candidates import verify_candidate_capture
    captures = sorted((game_root / "candidates").glob("capture-*"))
    if len(captures) > 128:
        raise ValueError("candidate capture inspection exceeds 128 snapshots for one game")
    forecasts = list(read_jsonl(forecast_file)) if forecast_file else None
    if forecasts is not None and not 1 <= len(forecasts) <= 5000:
        raise ValueError("bounded issued forecast rows required for candidate selection")
    # Frozen exports share a cutoff; mixed caller artifacts use the earliest so
    # no included forecast receives identity evidence collected after issuance.
    cutoff = min(_timestamp(row["cutoff_at"]) for row in forecasts) if forecasts else _timestamp(game["startTimeUTC"])
    selected = None
    for path in captures:
        pool, checksum = verify_candidate_capture(path)
        if pool["gameId"] != game["id"] or pool["gameDate"] != slate_date or pool["gameType"] != game["gameType"] or _timestamp(pool["scheduledStartAt"]) != _timestamp(game["startTimeUTC"]):
            raise ValueError("candidate capture disagrees with the settled game")
        captured_at = _timestamp(pool["capturedAt"])
        if captured_at <= cutoff and (selected is None or (captured_at, checksum) > selected[:2]):
            selected = captured_at, checksum, path
    if selected is None:
        return None, {"status": "unavailable", "reason": "no_verified_candidate_capture_before_cutoff", "cutoffAt": cutoff.isoformat(), "capturesChecked": len(captures)}
    captured_at, checksum, path = selected
    return path, {"status": "selected", "capturedAt": captured_at.isoformat(), "cutoffAt": cutoff.isoformat(), "manifestSha256": checksum, "capturesChecked": len(captures)}


def _capture_game_baselines(game: dict, slate_date: str, slate_root: Path, score: dict, run_id: str, now: datetime, freeze: Path) -> dict:
    from .daily_board_baseline_issuance import issue_baselines
    captured = _capture_game_candidates(game, slate_date, slate_root, score, run_id, now)
    if captured["status"] != "captured":
        return captured
    try:
        output = slate_root / str(game["id"]) / "baselines" / f"issue-{run_id}"
        output.parent.mkdir(exist_ok=True, mode=0o700)
        # Issuer uses its own actual clock and writes the completion manifest
        # last, fencing publication at puck drop. Do not rename it afterward.
        manifest = issue_baselines(freeze, Path(captured["candidateDirectory"]), output)
        return {**captured, "status": "issued", "baselineDirectory": str(output),
            "baselineManifestSha256": hashlib.sha256((output / "manifest.json").read_bytes()).hexdigest(),
            "forecastSkaters": manifest["forecastSkaters"], "targetRows": manifest["targetRows"],
            "issuedAt": manifest["issuedAt"], "historyAgeDays": manifest["historyAgeDays"], "promotionEligible": False}
    except Exception as error:
        return {**captured, "status": "failed", "stage": "baseline_issuance", "errorType": type(error).__name__}


def _settle_game_baselines(game: dict, slate_date: str, game_root: Path) -> dict:
    from . import daily_board_baseline_issuance, daily_board_candidates, daily_board_settlement
    bundles = sorted((game_root / "baselines").glob("issue-*"))
    if len(bundles) > 128:
        return {"status": "failed", "reason": "baseline_checkpoint_limit_exceeded", "artifacts": []}
    results = []
    for bundle in bundles:
        try:
            forecast_file, provenance = daily_board_baseline_issuance.verify_issued_baselines(bundle)
            manifest = read_json(bundle / "manifest.json")
            if (manifest["gameId"] != game["id"] or manifest["gameDate"] != slate_date or manifest["gameType"] != game["gameType"]
                or _timestamp(manifest["scheduledStartAt"]) != _timestamp(game["startTimeUTC"])):
                raise ValueError("baseline checkpoint and official slate disagree")
            # Use the actual source candidate pool, not a later roster capture
            # selected using information received after this forecast's cutoff.
            candidate = Path(manifest["sourcePaths"]["candidate"])
            version = hashlib.sha256(canonical_json({"forecast": provenance["manifestSha256"],
                "joiner": hashlib.sha256(Path(daily_board_settlement.__file__).read_bytes()).hexdigest(),
                "matcher": hashlib.sha256(Path(daily_board_candidates.__file__).read_bytes()).hexdigest(),
                "verifier": hashlib.sha256(Path(daily_board_baseline_issuance.__file__).read_bytes()).hexdigest()}).encode()).hexdigest()[:16]
            joined = game_root / "baseline-joins" / f"joined-{version}"
            joined.parent.mkdir(exist_ok=True, mode=0o700)
            def join(path):
                return settle_forecast_artifact(forecast_file, game_root / "official", path,
                    forecast_bundle=bundle, candidate_bundle=candidate)
            settled = _artifact(joined, join, join)
            results.append({"status": "settled", "baselineDirectory": str(bundle), "joinDirectory": str(joined),
                "forecastManifestSha256": provenance["manifestSha256"], "issuedAt": manifest["issuedAt"],
                "settledTargets": settled["settledTargetRows"], "unresolvedTargets": settled["unresolvedTargetRows"],
                "joinManifestSha256": hashlib.sha256((joined / "manifest.json").read_bytes()).hexdigest()})
        except Exception as error:
            results.append({"status": "failed", "baselineDirectory": str(bundle), "errorType": type(error).__name__})
    return {"status": "failed" if any(r["status"] == "failed" for r in results) else "settled" if results else "unavailable",
        "artifacts": results, "promotionEligible": False,
        "limitation": "Checkpoints share game outcomes; they are not independent evaluation samples or paired FORGE comparisons."}


def _settle_game(game: dict, slate_date: str, slate_root: Path, now: datetime) -> dict:
    game_id = game["id"]
    result = {"gameId": game_id, "gameType": game["gameType"]}
    if game["gameType"] not in (1, 2):
        return {**result, "status": "unsupported", "reason": "game_type_outside_daily_board_contract"}
    if game["gameScheduleState"] != "OK" or game["gameState"] != "OFF" or _timestamp(game["startTimeUTC"]) >= now:
        return {**result, "status": "pending", "reason": "official_game_not_final"}
    game_root = slate_root / str(game_id)
    stage = "official_capture"
    try:
        game_root.mkdir(exist_ok=True, mode=0o700)
        def check_outcomes(path):
            settlement, checksum = verify_settlement_capture(path)
            if settlement["gameId"] != game_id or settlement["gameDate"] != slate_date or settlement["gameType"] != game["gameType"]:
                raise ValueError("captured outcome does not match official slate")
            return checksum
        official_hash = _artifact(game_root / "official", lambda path: capture_final(game_id, slate_date, path), check_outcomes)
        stage = "baseline_settlement"
        result["baselineForecasts"] = _settle_game_baselines(game, slate_date, game_root)
        stage = "candidate_labels"
        from . import daily_board_candidates
        candidate, selection = _select_candidate_capture(game_root, game, slate_date)
        result["candidateLabels"] = {"status": "unavailable", "selection": selection}
        if candidate:
            version = hashlib.sha256(canonical_json({"candidate": selection["manifestSha256"], "official": official_hash,
                "labeler": hashlib.sha256(Path(daily_board_candidates.__file__).read_bytes()).hexdigest()}).encode()).hexdigest()[:16]
            labels = game_root / f"candidate-labels-{version}"
            def label(path):
                return daily_board_candidates.settle_candidate_artifact(candidate, game_root / "official", path)
            labeled = _artifact(labels, label, label)
            result["candidateLabels"] = {"status": "captured", "selection": selection, "directory": str(labels),
                "manifestSha256": hashlib.sha256((labels / "manifest.json").read_bytes()).hexdigest(), "counts": labeled["counts"]}
        # Candidate observations survive missing serving forecasts. Their labels
        # are data collection, not evidence that a prediction was issued.
        stage = "forecast_export"
        def check_forecasts(path):
            _, provenance = verify_forecast_export(path)
            manifest = read_json(path / "manifest.json")
            if provenance["sourceOrigin"] != "immutable_database_records" or manifest["gameId"] != game_id or manifest["gameDate"] != slate_date:
                raise ValueError("daily settlement requires this game's immutable database export")
            return manifest
        forecast = _artifact(game_root / "forecasts", lambda path: _export_forecasts(game_id, slate_date, path), check_forecasts)
        stage = "candidate_selection"
        candidate, candidate_selection = _select_candidate_capture(game_root, game, slate_date, game_root / "forecasts/forecasts.jsonl")
        stage = "outcome_join"
        # Keep previous joins when implementation changes; never rewrite their labels/history.
        from . import daily_board_settlement
        join_version = hashlib.sha256(canonical_json({
            "joiner": hashlib.sha256(Path(daily_board_settlement.__file__).read_bytes()).hexdigest(),
            "candidate": candidate_selection.get("manifestSha256"),
            "matcher": hashlib.sha256(Path(daily_board_candidates.__file__).read_bytes()).hexdigest() if candidate else None,
        }).encode()).hexdigest()[:16]
        joined = game_root / f"joined-{join_version}"
        def join(path):
            return settle_forecast_artifact(game_root / "forecasts/forecasts.jsonl", game_root / "official", path,
                forecast_bundle=game_root / "forecasts", candidate_bundle=candidate)
        manifest = _artifact(joined, join, join)
        baseline_failed = result["baselineForecasts"]["status"] == "failed"
        return {**result, "status": "failed" if baseline_failed else "settled", "servingForecastStatus": "settled",
            **({"stage": "baseline_settlement"} if baseline_failed else {}), "revisionId": forecast["revisionId"], "joinDirectory": str(joined),
            "joinManifestSha256": hashlib.sha256((joined / "manifest.json").read_bytes()).hexdigest(),
            "forecastPlayers": manifest["forecastPlayers"], "settledTargets": manifest["settledTargetRows"],
            "unresolvedTargets": manifest["unresolvedTargetRows"], "candidateSelection": candidate_selection, "promotionEligible": False}
    except Exception as error:
        return {**result, "status": "failed", "stage": stage, "errorType": type(error).__name__,
            "reason": "inspect_or_retry_stage_without_overwriting_verified_artifacts"}


def run_daily(slate_date: str, output_root: Path, *, game_ids: list[int] | None = None, now: datetime | None = None,
              mode: str = "settle", history_freeze: Path | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("timezone-qualified run time required")
    validate_range(slate_date, slate_date)
    today = now.astimezone(ZoneInfo("America/New_York")).date()
    if mode not in ("settle", "capture-candidates", "capture-baselines"):
        raise ValueError("unknown daily runner mode")
    if mode == "settle" and not today - timedelta(days=2) <= date.fromisoformat(slate_date) <= today:
        raise ValueError("daily runner is limited to today and the previous two Eastern dates; no backfills")
    if mode != "settle" and not today <= date.fromisoformat(slate_date) <= today + timedelta(days=7):
        raise ValueError("candidate capture is limited to today and the next seven Eastern dates")
    if (mode == "capture-baselines") != (history_freeze is not None):
        raise ValueError("capture-baselines requires --history-freeze; other modes do not accept it")
    if history_freeze is not None:
        assert_output_outside_repository(history_freeze, repository_root())
        if not all((history_freeze / name).is_file() for name in ("manifest.json", "history.jsonl")):
            raise ValueError("an existing private history freeze is required")
    if game_ids is not None and (not 1 <= len(game_ids) <= 16 or len(set(game_ids)) != len(game_ids)
        or any(type(value) is not int or value <= 0 for value in game_ids)):
        raise ValueError("select 1–16 distinct game IDs")
    assert_output_outside_repository(output_root, repository_root())
    output_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    slate_root = output_root / slate_date
    assert_output_outside_repository(slate_root, repository_root())
    slate_root.mkdir(exist_ok=True, mode=0o700)
    lock = os.open(slate_root / (".settlement.lock" if mode == "settle" else ".candidates.lock"), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        stage = "schedule"
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"version": VERSION, "mode": mode, "slateDate": slate_date, "status": "already_running"}
        run_id = uuid4().hex
        run_root = slate_root / f"run-{run_id}"
        run_root.mkdir(mode=0o700)
        report = {"version": VERSION, "mode": mode, "slateDate": slate_date, "startedAt": now.isoformat(), "games": [],
            "runnerCodeHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "requestedGameIds": sorted(game_ids) if game_ids else None,
            "scope": "selected_games" if game_ids else "official_slate", "promotionEligible": False,
            **({"historyFreeze": str(history_freeze.resolve())} if history_freeze is not None else {}),
            "limitations": ["Settled targets do not establish candidate completeness, calibration or model superiority.",
                "No challenger fitting, model promotion, production writes or scheduler activation occurs."]}
        try:
            score = fetch_official_json(f"https://api-web.nhle.com/v1/score/{slate_date}")
            write_json(run_root / "schedule.json", score)
            (run_root / "schedule.json").chmod(0o600)
            report["scheduleFileSha256"] = hashlib.sha256((run_root / "schedule.json").read_bytes()).hexdigest()
            games = slate_games(score["payload"], slate_date)
            if game_ids and not set(game_ids) <= {game["id"] for game in games}:
                raise ValueError("selected game is not on the official slate")
            if game_ids:
                games = [game for game in games if game["id"] in game_ids]
            stage = "settlement_dispatch" if mode == "settle" else "baseline_dispatch" if mode == "capture-baselines" else "candidate_dispatch"
            with ThreadPoolExecutor(max_workers=2) as executor:
                if mode == "settle":
                    work = lambda game: _settle_game(game, slate_date, slate_root, now)
                elif mode == "capture-baselines":
                    work = lambda game: _capture_game_baselines(game, slate_date, slate_root, score, run_id, now, history_freeze)
                else:
                    work = lambda game: _capture_game_candidates(game, slate_date, slate_root, score, run_id, now)
                report["games"] = list(executor.map(work, games))
            statuses = ("settled", "pending", "failed", "unsupported") if mode == "settle" else (
                "issued" if mode == "capture-baselines" else "captured", "skipped", "failed", "unsupported")
            counts = {status: sum(game["status"] == status for game in report["games"]) for status in statuses}
            report.update(counts=counts, status="failed" if counts["failed"] else "pending" if counts.get("pending") else "finished")
        except Exception as error:
            report.update(status="failed", stage=stage, errorType=type(error).__name__)
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        write_json(run_root / "report.json", report)
        (run_root / "report.json").chmod(0o600)
        return {**report, "reportPath": str(run_root / "report.json")}
    finally:
        os.close(lock)  # Kernel lock ownership ends even after a crash; stale files never block retries.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date")
    parser.add_argument("--mode", choices=("settle", "capture-candidates", "capture-baselines"), default="settle")
    parser.add_argument("--history-freeze", type=Path, help="Required only for private baseline issuance.")
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--game-id", type=int, action="append", help="Optional canary scope; repeat for multiple games.")
    args = parser.parse_args()
    today = datetime.now(ZoneInfo("America/New_York")).date()
    slate_date = args.date or (today - timedelta(days=1) if args.mode == "settle" else today).isoformat()
    report = run_daily(slate_date, args.output_root, game_ids=args.game_id, mode=args.mode, history_freeze=args.history_freeze)
    print(canonical_json(report))
    if report["status"] == "failed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import hashlib
from contextlib import contextmanager
from pathlib import Path

import pytest


def official_settlement_fixture():
    from modeling.player_forecasts.daily_board_settlement import normalize_settlement
    box = {"id": 1, "gameDate": "2026-10-10", "gameType": 2, "gameState": "OFF", "startTimeUTC": "2026-10-10T23:00:00Z",
        "homeTeam": {"id": 10, "abbrev": "TOR"}, "awayTeam": {"id": 8, "abbrev": "MTL"}, "playerByGameStats": {}}
    skaters, goalies = [], []
    for side, team, offset in (("homeTeam", "TOR", 0), ("awayTeam", "MTL", 10)):
        rows = {"forwards": [], "defense": [], "goalies": []}
        for group, index in (("forwards", 1), ("defense", 2)):
            rows[group] = [{"playerId": offset + index, "goals": 1, "assists": 0, "sog": 2, "hits": 1, "blockedShots": 1, "pim": 0}]
            skaters.append({"playerId": offset + index, "gameId": 1, "gameDate": "2026-10-10", "gamesPlayed": 1,
                "teamAbbrev": team, "timeOnIcePerGame": 1200, "ppPoints": 1})
        rows["goalies"] = [{"playerId": offset + index, "starter": index == 3, "shotsAgainst": 30 if index == 3 else 0,
            "saves": 28 if index == 3 else 0, "goalsAgainst": 2 if index == 3 else 0} for index in (3, 4)]
        goalies.append({"playerId": offset + 3, "gameId": 1, "gameDate": "2026-10-10", "gamesPlayed": 1,
            "teamAbbrev": team, "gamesStarted": 1, "shotsAgainst": 30, "saves": 28, "goalsAgainst": 2,
            "timeOnIce": 3600, "wins": int(side == "homeTeam"), "shutouts": 0})
        box["playerByGameStats"][side] = rows
    summaries = [{"total": len(rows), "data": rows} for rows in (skaters, goalies)]
    def normalize():
        return normalize_settlement(box, *summaries, game_id=1, game_date="2026-10-10", received_at="2026-10-11T05:00:00Z")
    return box, summaries, normalize


def test_daily_board_settlement_uses_explicit_starter_labels_and_preserves_missing_participation():
    _, _, normalize = official_settlement_fixture()
    result = normalize()
    players = {row["playerId"]: row for row in result["players"]}
    assert players[3]["goalieStart"] == 1 and players[4]["goalieStart"] == 0
    assert players[4]["participation"] is None
    assert players[4]["outcomes"]["SHUTOUTS_GOALIE"] is None
    assert players[3]["outcomes"]["WINS_GOALIE"] == 1
    assert players[1]["outcomes"]["PP_POINTS"] == 1
    assert players[1]["outcomes"]["TIME_ON_ICE_PER_GAME"] == 20
    assert normalize() == result


def test_daily_board_settlement_rejects_nonfinal_conflicts_and_incomplete_source_responses():
    box, summaries, normalize = official_settlement_fixture()
    box["gameState"] = "LIVE"
    with pytest.raises(ValueError, match="final"):
        normalize()
    box["gameState"] = "OFF"
    summaries[0]["total"] += 1
    with pytest.raises(ValueError, match="complete"):
        normalize()
    summaries[0]["total"] -= 1
    summaries[1]["data"][0]["gamesStarted"] = 0
    with pytest.raises(ValueError, match="starter"):
        normalize()
    summaries[1]["data"][0]["gamesStarted"] = 1
    box["playerByGameStats"]["homeTeam"]["goalies"][0]["saves"] = 31
    with pytest.raises(ValueError, match="accounting"):
        normalize()


def roster_report_fixture():
    box, summaries, _ = official_settlement_fixture()
    box["id"] = 2026020001
    for payload in summaries:
        for row in payload["data"]:
            row["gameId"] = box["id"]
    for side, place, common in (("homeTeam", "Toronto", "Maple Leafs"), ("awayTeam", "Montréal", "Canadiens")):
        box[side].update(placeName={"default": place}, commonName={"default": common})
    html = '''<table id="GameInfo"><tr><td>Saturday, October 10, 2026</td><td>Game 0001</td><td>Final</td></tr></table>
        <table id="Visitor"><tr><td><img alt="MONTRÉAL CANADIENS"></td></tr></table>
        <table id="Home"><tr><td><img alt="TORONTO MAPLE LEAFS"></td></tr></table>
        <table><tr id="Scratches"><td><table><tr><td>#</td><td>Pos</td><td>Name</td></tr>
        <tr><td>25</td><td>C</td><td>AWAY SCRATCH</td></tr></table></td>
        <td><table><tr><td>#</td><td>Pos</td><td>Name</td></tr>
        <tr><td>34</td><td>D</td><td>HOME SCRATCH</td></tr></table></td></tr></table>'''
    return box, summaries, html


def test_daily_board_roster_report_keeps_explicit_scratches_separate_from_candidate_and_player_ids():
    from modeling.player_forecasts.daily_board_roster_report import normalize_roster_report
    from modeling.player_forecasts.daily_board_settlement import normalize_settlement
    box, summaries, html = roster_report_fixture()
    report = normalize_roster_report(html, box)
    assert report["status"] == "verified" and [r["teamId"] for r in report["scratches"]] == [8, 10]
    assert all(row["participation"] == 0 and "playerId" not in row for row in report["scratches"])
    assert all(row["identityStatus"] == "requires_pregame_candidate_match" for row in report["scratches"])
    result = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
        received_at="2026-10-11T05:00:00Z", roster_report={"payload": html})
    assert result["scratchEvidence"] == report
    assert len(result["players"]) == 8
    assert all(player["participation"] in (1, None) for player in result["players"])
    assert normalize_roster_report(html, box) == report


def test_daily_board_roster_report_rejects_wrong_game_sides_duplicates_and_playing_conflicts():
    from modeling.player_forecasts.daily_board_roster_report import normalize_roster_report
    box, _, html = roster_report_fixture()
    for invalid in (html.replace("Game 0001", "Game 0002"), html.replace("October 10", "October 11"),
        html.replace("Final", "In Progress"), html.replace("TORONTO MAPLE LEAFS", "MONTRÉAL CANADIENS"),
        html.replace('id="Scratches"', 'id="NotScratches"'), html.replace("<td>34</td>", "<td>unknown</td>"),
        html.replace('<tr><td>34</td><td>D</td><td>HOME SCRATCH</td></tr>',
            '<tr><td>34</td><td>D</td><td>HOME SCRATCH</td></tr>' * 2)):
        with pytest.raises(ValueError):
            normalize_roster_report(invalid, box)
    box["playerByGameStats"]["homeTeam"]["forwards"][0]["sweaterNumber"] = 34
    with pytest.raises(ValueError, match="contradictory"):
        normalize_roster_report(html, box)


def test_daily_board_roster_report_failure_retains_outcomes_without_negative_labels():
    from modeling.player_forecasts.daily_board_settlement import normalize_settlement
    box, summaries, _ = roster_report_fixture()
    for payload, status in ((None, "unavailable"), ("<html>unavailable</html>", "unusable")):
        result = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
            received_at="2026-10-11T05:00:00Z", roster_report={"payload": payload})
        assert result["scratchEvidence"]["status"] == status
        assert result["scratchEvidence"]["scratches"] == [] and len(result["players"]) == 8
        assert all(player["participation"] != 0 for player in result["players"])


def test_daily_board_roster_report_capture_is_replayed_and_covered_by_source_checksums(tmp_path, monkeypatch):
    import subprocess
    import modeling.player_forecasts.daily_board_settlement as module
    box, summaries, html = roster_report_fixture()
    monkeypatch.setattr(module, "fetch_official_json", lambda url: {"url": url, "receivedAt": "2026-10-11T05:00:00Z",
        "payload": box if "gamecenter" in url else summaries[0] if "/skater/" in url else summaries[1]})
    monkeypatch.setattr(module.subprocess, "check_output", lambda *args, **kwargs: html.encode())
    # Keep the report receipt after the fixture game; capture uses the actual clock.
    from datetime import datetime, timezone
    class ReceiptClock:
        @staticmethod
        def now(tz):
            return datetime(2026, 10, 11, 6, tzinfo=timezone.utc)
        fromisoformat = datetime.fromisoformat
    monkeypatch.setattr(module, "datetime", ReceiptClock)
    bundle = tmp_path / "report-capture"
    module.capture_final(box["id"], box["gameDate"], bundle)
    result, _ = module.verify_settlement_capture(bundle)
    assert result["scratchEvidence"]["status"] == "verified"
    sources = json.loads((bundle / "sources.json").read_text())
    assert sources["rosterReport"]["url"].endswith("/20262027/RO020001.HTM")
    assert result["receivedAt"] == "2026-10-11T06:00:00+00:00"
    sources["rosterReport"]["payload"] = html.replace("HOME SCRATCH", "CHANGED")
    (bundle / "sources.json").write_text(json.dumps(sources))
    with pytest.raises(ValueError, match="checksum"):
        module.verify_settlement_capture(bundle)
    monkeypatch.setattr(module.subprocess, "check_output", lambda *a, **kw: (_ for _ in ()).throw(subprocess.CalledProcessError(22, "curl")))
    unavailable = tmp_path / "missing-report"
    module.capture_final(box["id"], box["gameDate"], unavailable)
    assert module.verify_settlement_capture(unavailable)[0]["scratchEvidence"]["status"] == "unavailable"


def candidate_pool_fixture():
    from modeling.player_forecasts.daily_board_candidates import normalize_candidate_pool
    box, summaries, html = roster_report_fixture()
    game = {**box, "season": 20262027, "gameState": "FUT", "gameScheduleState": "OK"}
    sources = {"schedule": {"url": "https://api-web.nhle.com/v1/score/2026-10-10", "receivedAt": "2026-10-10T18:00:00Z",
        "payload": {"currentDate": "2026-10-10", "games": [game]}}}
    for key, abbreviation, offset, side in (("homeRoster", "TOR", 0, "Home"), ("awayRoster", "MTL", 10, "Away")):
        def player(id, position, number, last):
            return {"id": id, "positionCode": position, "sweaterNumber": number, "firstName": {"default": side}, "lastName": {"default": last}}
        roster = {"forwards": [player(offset + 1, "C", 11, "Forward")], "defensemen": [player(offset + 2, "D", 12, "Defender")],
            "goalies": [player(offset + 3, "G", 35, "Goalie")]}
        roster["defensemen" if side == "Home" else "forwards"].append(player(99 if side == "Home" else 199,
            "D" if side == "Home" else "C", 34 if side == "Home" else 25, "Scratch"))
        sources[key] = {"url": f"https://api-web.nhle.com/v1/roster/{abbreviation}/20262027",
            "receivedAt": "2026-10-10T18:01:00Z", "payload": roster}
    return sources, normalize_candidate_pool(sources, box["id"], box["gameDate"]), box, summaries, html


def test_daily_board_candidates_are_pregame_bounded_and_reject_partial_duplicate_or_wrong_club_sources():
    import copy
    from modeling.player_forecasts.daily_board_candidates import normalize_candidate_pool
    sources, pool, box, _, _ = candidate_pool_fixture()
    assert len(pool["players"]) == 8 and pool["capturedAt"] == "2026-10-10T18:01:00+00:00"
    assert all("participation" not in row for row in pool["players"])
    invalid = []
    wrong = copy.deepcopy(sources); wrong["homeRoster"]["payload"]["goalies"] = []; invalid.append(wrong)
    wrong = copy.deepcopy(sources); wrong["homeRoster"]["receivedAt"] = "2026-10-10T23:01:00Z"; invalid.append(wrong)
    wrong = copy.deepcopy(sources); wrong["homeRoster"]["url"] = wrong["awayRoster"]["url"]; invalid.append(wrong)
    wrong = copy.deepcopy(sources); wrong["homeRoster"]["payload"]["forwards"][0]["id"] = 11; invalid.append(wrong)
    wrong = copy.deepcopy(sources); wrong["schedule"]["payload"]["games"][0]["gameState"] = "OFF"; invalid.append(wrong)
    for source in invalid:
        with pytest.raises(ValueError):
            normalize_candidate_pool(source, box["id"], box["gameDate"])


def test_daily_board_candidates_label_only_unique_explicit_scratches_known_before_forecast_cutoff():
    import copy
    from modeling.player_forecasts.daily_board_settlement import normalize_settlement, attach_official_outcomes
    from modeling.player_forecasts.daily_board_candidates import match_explicit_scratches
    _, pool, box, summaries, html = candidate_pool_fixture()
    settlement = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
        received_at="2026-10-11T05:00:00Z", roster_report={"payload": html})
    row = {"game_id": box["id"], "game_date": box["gameDate"], "team_id": 10, "population": "skater", "player_id": 99,
        "target_key": "participation", "conditioning": "probability", "maximum_feature_available_at": "2026-10-10T20:00:00Z",
        "cutoff_at": "2026-10-10T21:00:00Z", "issued_at": "2026-10-10T21:01:00Z", "estimates": {"forge": 0.5}}
    rows = [row, {**row, "target_key": "GOALS", "conditioning": "unconditional"},
        {**row, "target_key": "GOALS", "conditioning": "conditional_playing"}, {**row, "player_id": 500}]
    assert not attach_official_outcomes(rows, settlement)["rows"]
    result = attach_official_outcomes(rows, settlement, candidate_pool=pool)
    assert len(result["rows"]) == 2 and all(r["outcome"] == 0 and r["played"] is False for r in result["rows"])
    assert all(r["participation_label_source"] == "explicit_official_scratch" and r["candidate_pool_hash"] for r in result["rows"])
    assert {r["reason"] for r in result["unresolved"]} == {"conditioning_not_observed", "official_label_unavailable"}
    assert all(r["player_id"] != 199 for r in result["rows"])
    backup = {**row, "player_id": 4, "population": "goalie", "target_key": "SAVES_GOALIE", "conditioning": "conditional_start"}
    assert attach_official_outcomes([backup], settlement)["unresolved"][0]["reason"] == "conditioning_not_observed"
    late = {**pool, "capturedAt": "2026-10-10T21:30:00Z"}
    assert attach_official_outcomes([row], settlement, candidate_pool=late)["unresolved"][0]["reason"] == "candidate_capture_after_forecast_cutoff"
    ambiguous = copy.deepcopy(pool)
    duplicate = next(r for r in pool["players"] if r["playerId"] == 99)
    ambiguous["players"].append({**duplicate, "playerId": 999})
    assert 99 not in match_explicit_scratches(ambiguous, settlement)["labels"]
    conflict = {**settlement, "players": [*settlement["players"], {"playerId": 99}]}
    assert 99 not in match_explicit_scratches(pool, conflict)["labels"]
    with pytest.raises(ValueError, match="game mismatch"):
        match_explicit_scratches({**pool, "gameId": 2}, settlement)


def test_daily_board_candidate_capture_is_private_immutable_and_offline_verifiable(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    import modeling.player_forecasts.daily_board_candidates as module
    sources, _, box, _, _ = candidate_pool_fixture()
    class Clock:
        @staticmethod
        def now(tz):
            return datetime(2026, 10, 10, 18, 2, tzinfo=timezone.utc).astimezone(tz)
    monkeypatch.setattr(module, "datetime", Clock)
    requests = []
    def fetch(url):
        requests.append(url)
        return next(row for row in sources.values() if row["url"] == url)
    monkeypatch.setattr(module, "fetch_official_json", fetch)
    output = tmp_path / "candidates"
    manifest = module.capture_candidates(box["id"], box["gameDate"], output)
    assert len(requests) == 3 and manifest["candidates"] == 8
    pool, _ = module.verify_candidate_capture(output)
    assert len(pool["players"]) == 8 and len(requests) == 3
    assert output.stat().st_mode & 0o777 == 0o700
    assert all(path.stat().st_mode & 0o777 == 0o600 for path in output.iterdir())
    with pytest.raises(ValueError, match="immutable"):
        module.capture_candidates(box["id"], box["gameDate"], output)
    with pytest.raises(ValueError, match="seven Eastern"):
        module.capture_candidates(box["id"], "2026-10-01", tmp_path / "historical")
    assert len(requests) == 3
    (output / "candidates.json").write_text("{}")
    with pytest.raises(ValueError, match="checksum"):
        module.verify_candidate_capture(output)


def test_daily_board_candidate_bundle_provenance_is_preserved_in_immutable_forecast_join(tmp_path, monkeypatch):
    import shutil
    from modeling.player_forecasts.daily_board_candidates import VERSION as CANDIDATES_VERSION, settle_candidate_artifact
    from modeling.player_forecasts.daily_board_settlement import VERSION, normalize_settlement, settle_forecast_artifact
    from modeling.player_forecasts.io import write_json, write_jsonl, read_jsonl
    sources, pool, box, summaries, html = candidate_pool_fixture()
    candidate = tmp_path / "candidate"
    capture = tmp_path / "settlement"
    candidate.mkdir(); capture.mkdir()
    official = {key: {"payload": payload, "receivedAt": "2026-10-11T05:00:00Z"}
        for key, payload in zip(("boxscore", "skaters", "goalies"), (box, *summaries))}
    official["rosterReport"] = {"payload": html, "receivedAt": "2026-10-11T05:01:00Z"}
    normalized = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
        received_at="2026-10-11T05:01:00Z", roster_report=official["rosterReport"])
    for directory, data, payload, filename, version, counts in ((candidate, sources, pool, "candidates.json", CANDIDATES_VERSION, {"candidates": 8}),
        (capture, official, normalized, "settlement.json", VERSION, {"players": 8})):
        write_json(directory / "sources.json", data)
        write_json(directory / filename, payload)
        write_json(directory / "manifest.json", {"version": version, "gameId": box["id"], "gameDate": box["gameDate"], **counts,
            "files": {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in ("sources.json", filename)}})
    row = daily_board_row(game_id=box["id"], team_id=10, player_id=99, population="skater", target_key="participation", conditioning="probability",
        cutoff_at="2026-10-10T21:00:00Z", issued_at="2026-10-10T21:01:00Z")
    for key in ("outcome", "played", "started", "settlement_status", "settlement_hash", "settlement_received_at"):
        row.pop(key, None)
    row["estimates"] = {"forge": 0.7}
    forecast = tmp_path / "issued.jsonl"
    write_jsonl(forecast, [row])
    output = tmp_path / "joined"
    result = settle_forecast_artifact(forecast, capture, output, candidate_bundle=candidate)
    assert result["settledTargetRows"] == 1 and result["unresolvedTargetRows"] == 0
    assert result["inputs"]["candidatePoolManifestSha256"] == hashlib.sha256((candidate / "manifest.json").read_bytes()).hexdigest()
    assert result["inputs"]["candidateMatcherSha256"]
    assert list(read_jsonl(output / "settled.jsonl"))[0]["outcome"] == 0
    assert settle_forecast_artifact(forecast, capture, output, candidate_bundle=candidate) == result
    with pytest.raises(ValueError, match="immutable"):
        settle_forecast_artifact(forecast, capture, output)
    labels = tmp_path / "labels"
    labeled = settle_candidate_artifact(candidate, capture, labels)
    assert labeled["counts"]["participation"] == {"positive": 6, "negative": 2, "unknown": 0}
    assert labeled["inputs"]["candidateManifestSha256"] == result["inputs"]["candidatePoolManifestSha256"]
    assert labels.stat().st_mode & 0o777 == 0o700
    assert all(path.stat().st_mode & 0o777 == 0o600 for path in labels.iterdir())
    before = (labels / "manifest.json").stat().st_mtime_ns
    assert settle_candidate_artifact(candidate, capture, labels) == labeled
    assert (labels / "manifest.json").stat().st_mtime_ns == before
    # Probability data collection must work even without any serving forecast.
    from modeling.player_forecasts import daily_board_daily as daily
    from modeling.player_forecasts.daily_board_settlement import _timestamp
    slate = tmp_path / "daily"
    game_root = slate / str(box["id"])
    shutil.copytree(candidate, game_root / "candidates/capture-pregame")
    shutil.copytree(capture, game_root / "official")
    def unavailable(*args):
        raise RuntimeError("private export details")
    monkeypatch.setattr(daily, "_export_forecasts", unavailable)
    game = {"id": box["id"], "gameType": 2, "gameState": "OFF", "gameScheduleState": "OK", "startTimeUTC": box["startTimeUTC"]}
    attempt = daily._settle_game(game, box["gameDate"], slate, _timestamp("2026-10-11T06:00:00Z"))
    assert attempt["status"] == "failed" and attempt["stage"] == "forecast_export"
    assert attempt["candidateLabels"]["status"] == "captured"
    assert attempt["candidateLabels"]["counts"] == labeled["counts"]
    assert "private export" not in json.dumps(attempt)
    again = daily._settle_game(game, box["gameDate"], slate, _timestamp("2026-10-11T06:00:00Z"))
    assert again["candidateLabels"] == attempt["candidateLabels"]
    (labels / "labels.jsonl").write_text("modified")
    with pytest.raises(ValueError, match="checksum"):
        settle_candidate_artifact(candidate, capture, labels)


def test_daily_board_candidate_labels_preserve_unknowns_conflicts_and_postgame_pool_exclusions():
    import copy
    from modeling.player_forecasts.daily_board_candidates import candidate_label_rows
    from modeling.player_forecasts.daily_board_settlement import normalize_settlement
    _, pool, box, summaries, html = candidate_pool_fixture()
    settlement = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
        received_at="2026-10-11T05:00:00Z", roster_report={"payload": html})
    pool["players"].extend([{**pool["players"][0], "playerId": 999},
        {**next(row for row in pool["players"] if row["playerId"] == 3), "playerId": 4}])
    result = candidate_label_rows(pool, settlement)
    assert result["officialPlayersOutsideCandidatePool"] == [14]
    assert not any(row["player_id"] == 14 for row in result["rows"])
    assert next(row for row in result["rows"] if row["player_id"] == 999)["label"] is None
    assert next(row for row in result["rows"] if row["player_id"] == 4 and row["target_key"] == "participation")["label"] is None
    assert next(row for row in result["rows"] if row["player_id"] == 4 and row["target_key"] == "goalie_start")["label"] == 0
    conflict = copy.deepcopy(settlement)
    conflict["players"][0]["teamId"] = 123
    conflict_id = conflict["players"][0]["playerId"]
    row = next(row for row in candidate_label_rows(pool, conflict)["rows"] if row["player_id"] == conflict_id)
    assert row["label"] is None and row["unresolved_reason"] == "candidate_outcome_identity_conflict"
    with pytest.raises(ValueError, match="game mismatch"):
        candidate_label_rows(pool, {**settlement, "gameType": 1})


def test_daily_board_settlement_keeps_frozen_forecast_pool_and_excludes_late_predictions():
    from modeling.player_forecasts.daily_board_settlement import attach_official_outcomes
    _, _, normalize = official_settlement_fixture()
    base = {"game_id": 1, "game_date": "2026-10-10", "team_id": 10, "population": "goalie", "player_id": 4,
        "target_key": "goalie_start", "maximum_feature_available_at": "2026-10-10T20:00:00Z", "cutoff_at": "2026-10-10T21:00:00Z",
        "issued_at": "2026-10-10T21:01:00Z", "estimates": {"forge": 0.1}}
    rows = [base, {**base, "player_id": 99}, {**base, "target_key": "participation"}]
    result = attach_official_outcomes(rows, normalize())
    assert len(result["rows"]) == 1 and result["rows"][0]["outcome"] == 0
    assert result["rows"][0]["started"] is False and result["rows"][0]["played"] is None
    assert len(result["unresolved"]) == 2
    assert result["outcomePlayersOutsideForecastPool"] == [1, 2, 3, 11, 12, 13, 14]
    assert all("outcome" not in row for row in rows)
    for patch in ({"issued_at": "2026-10-11T02:00:00Z"}, {"maximum_feature_available_at": "2026-10-10T22:00:00Z"}):
        with pytest.raises(ValueError, match="pregame"):
            attach_official_outcomes([{**base, **patch}], normalize())
    with pytest.raises(ValueError, match="membership"):
        attach_official_outcomes([{**base, "team_id": 8}], normalize())


def test_daily_board_settlement_capture_protects_holdout_repository_and_existing_artifacts(tmp_path, monkeypatch):
    from modeling.player_forecasts.daily_board_settlement import capture_final
    import modeling.player_forecasts.daily_board_settlement as module
    fetch = lambda *args, **kwargs: pytest.fail("network must not be called")
    monkeypatch.setattr(module.subprocess, "check_output", fetch)
    with pytest.raises(ValueError, match="protected"):
        capture_final(1, "2026-02-01", tmp_path / "capture")
    with pytest.raises(RuntimeError, match="outside"):
        capture_final(1, "2026-10-10", Path(__file__).parent / "forbidden")
    with pytest.raises(ValueError, match="immutable"):
        capture_final(1, "2026-10-10", tmp_path)


def settlement_artifact_fixture(tmp_path):
    from modeling.player_forecasts.daily_board_settlement import VERSION
    from modeling.player_forecasts.io import write_json, write_jsonl
    box, summaries, normalize = official_settlement_fixture()
    bundle = tmp_path / "official"
    bundle.mkdir()
    write_json(bundle / "sources.json", {key: {"payload": payload, "receivedAt": "2026-10-11T05:00:00Z"}
        for key, payload in zip(("boxscore", "skaters", "goalies"), (box, *summaries))})
    write_json(bundle / "settlement.json", normalize())
    manifest = {"version": VERSION, "gameId": 1, "gameDate": "2026-10-10", "players": 8,
        "files": {name: hashlib.sha256((bundle / name).read_bytes()).hexdigest() for name in ("sources.json", "settlement.json")}}
    write_json(bundle / "manifest.json", manifest)
    row = daily_board_row(player_id=1, team_id=10, population="skater", target_key="GOALS")
    for key in ("outcome", "played", "started", "settlement_status", "settlement_hash", "settlement_received_at"):
        row.pop(key, None)
    forecasts = tmp_path / "issued.jsonl"
    write_jsonl(forecasts, [row, {**row, "conditioning": "unconditional"}, {**row, "player_id": 99},
        {**row, "player_id": 4, "population": "goalie", "target_key": "goalie_start", "conditioning": "probability"}])
    return forecasts, bundle, row


def test_daily_board_settlement_artifact_is_private_replayable_and_idempotent(tmp_path, monkeypatch):
    from modeling.player_forecasts.daily_board_settlement import settle_forecast_artifact
    from modeling.player_forecasts.io import read_jsonl
    import modeling.player_forecasts.daily_board_settlement as module
    monkeypatch.setattr(module.subprocess, "check_output", lambda *a, **kw: pytest.fail("join must be offline"))
    forecasts, bundle, _ = settlement_artifact_fixture(tmp_path)
    output = tmp_path / "joined"
    manifest = settle_forecast_artifact(forecasts, bundle, output)
    assert manifest["issuedTargetRows"] == 4 and manifest["settledTargetRows"] == 3 and manifest["unresolvedTargetRows"] == 1
    assert manifest["evidenceClassification"] == "captured_live" and not manifest["promotionEligible"]
    assert manifest["outcomePlayersOutsideForecastPool"] == [2, 3, 11, 12, 13, 14]
    assert (output / "forecasts.jsonl").read_bytes() == forecasts.read_bytes()
    before = {file.name: (file.read_bytes(), file.stat().st_mtime_ns) for file in output.iterdir()}
    assert settle_forecast_artifact(forecasts, bundle, output) == manifest
    assert before == {file.name: (file.read_bytes(), file.stat().st_mtime_ns) for file in output.iterdir()}
    assert output.stat().st_mode & 0o777 == 0o700
    assert all(file.stat().st_mode & 0o777 == 0o600 for file in output.iterdir())
    rows = list(read_jsonl(output / "settled.jsonl"))
    assert rows[-1]["started"] is False and rows[-1]["played"] is None
    assert daily_board_evaluate(rows)["evaluatedRows"] == 3
    (output / "settled.jsonl").write_text("corrupt")
    with pytest.raises(ValueError, match="checksum"):
        settle_forecast_artifact(forecasts, bundle, output)


def test_daily_board_settlement_scores_the_issued_profile_and_withholds_missing_categories(tmp_path):
    from modeling.player_forecasts.daily_board_settlement import settle_forecast_artifact
    from modeling.player_forecasts.io import read_jsonl, write_jsonl
    forecasts, bundle, row = settlement_artifact_fixture(tmp_path)
    write_jsonl(forecasts, [{**row, "target_key": "FANTASY_POINTS", "scoring_weights": {
        "GOALS": 3, "ASSISTS": 2, "PP_POINTS": 1, "SHOTS_ON_GOAL": 0.2, "HITS": 0.2, "BLOCKED_SHOTS": 0.25}},
        {**row, "player_id": 3, "population": "goalie", "conditioning": "unconditional", "target_key": "FANTASY_POINTS",
            "scoring_weights": {"SAVES_GOALIE": 0.2, "GOALS_AGAINST_GOALIE": -1, "WINS_GOALIE": 4, "SHUTOUTS_GOALIE": 3}},
        {**row, "player_id": 4, "population": "goalie", "conditioning": "unconditional", "target_key": "FANTASY_POINTS",
            "scoring_weights": {"WINS_GOALIE": 4}}])
    manifest = settle_forecast_artifact(forecasts, bundle, tmp_path / "joined")
    assert manifest["settledTargetRows"] == 2 and manifest["unresolvedTargetRows"] == 1
    rows = list(read_jsonl(tmp_path / "joined/settled.jsonl"))
    assert rows[0]["outcome"] == pytest.approx(4.85)
    assert rows[1]["outcome"] == pytest.approx(7.6)


def frozen_forecast_bundle_fixture(tmp_path, row, origin="provided_capture"):
    from modeling.player_forecasts.io import write_json, write_jsonl
    bundle = tmp_path / "forecast-export"
    bundle.mkdir()
    write_jsonl(bundle / "forecasts.jsonl", [{**row, "revision_id": "revision-1", "model_code_version": "commit-1",
        "checkpoint": "frozen_final_pregame", "model_id": "forge:default:commit-1", "opponent_team_id": 8,
        "source_query_cutoff_at": row["maximum_feature_available_at"]}])
    write_json(bundle / "source.json", {"game": {"id": 1, "date": row["game_date"], "type": 2, "homeTeamId": 10, "awayTeamId": 8},
        "revision": {"id": "revision-1", "input_snapshot_id": "snapshot-1", "published_at": row["issued_at"],
        "decision_as_of": row["cutoff_at"], "game_id": 1, "slate_date": row["game_date"], "run_id": "run-1",
        "payload": {"codeVersion": "commit-1", "modelMode": "default"}},
        "observation": {"id": "snapshot-1", "payload_hash": row["snapshot_hash"], "entity_key": "run-1",
            "provider": "forge", "dataset_key": "forge-run-inputs-v1", "available_at": row["issued_at"], "payload": {
            "version": "forge-inputs-v1", "replayClassification": "captured_live", "horizonGames": 1,
            "runId": "run-1", "codeVersion": "commit-1", "decisionAsOf": row["cutoff_at"], "modelMode": "default",
            "slateDate": row["game_date"], "inputCutoff": row["maximum_feature_available_at"], "capturedAt": row["cutoff_at"],
            "reads": [{"receivedAt": row["maximum_feature_available_at"]}]}},
        "frozen": {"game_id": 1, "revision_id": "revision-1", "scheduled_start_at": row["scheduled_start_at"], "frozen_at": row["scheduled_start_at"]}})
    manifest = {"version": "starter-board-issued-forecasts-v1", "sourceOrigin": origin, "gameDate": row["game_date"], "gameId": 1, "gameType": 2,
        "frozenAt": row["scheduled_start_at"],
        "revisionId": "revision-1", "inputSnapshotHash": row["snapshot_hash"], "issuedAt": row["issued_at"], "targetRows": 1,
        "codeVersion": "commit-1", "sourceHash": "fixture-source", "exporterHash": "fixture-exporter", "completeParticipationCandidatePool": False,
        "files": {name: hashlib.sha256((bundle / name).read_bytes()).hexdigest() for name in ("source.json", "forecasts.jsonl")}}
    write_json(bundle / "manifest.json", manifest)
    return bundle, manifest


def test_daily_board_settlement_verifies_frozen_forecast_bundle_links(tmp_path):
    from modeling.player_forecasts.daily_board_settlement import settle_forecast_artifact
    from modeling.player_forecasts.io import read_json, write_json
    _, official, row = settlement_artifact_fixture(tmp_path)
    bundle, manifest = frozen_forecast_bundle_fixture(tmp_path, row)
    result = settle_forecast_artifact(bundle / "forecasts.jsonl", official, tmp_path / "joined", forecast_bundle=bundle)
    assert result["inputs"]["forecastProvenance"]["revisionId"] == "revision-1"
    assert result["inputs"]["forecastProvenance"]["sourceOrigin"] == "provided_capture"
    source = read_json(bundle / "source.json")
    source["frozen"]["revision_id"] = "substituted-revision"
    write_json(bundle / "source.json", source)
    with pytest.raises(ValueError, match="checksum"):
        settle_forecast_artifact(bundle / "forecasts.jsonl", official, tmp_path / "bad", forecast_bundle=bundle)
    manifest["files"]["source.json"] = hashlib.sha256((bundle / "source.json").read_bytes()).hexdigest()
    write_json(bundle / "manifest.json", manifest)
    with pytest.raises(ValueError, match="provenance mismatch"):
        settle_forecast_artifact(bundle / "forecasts.jsonl", official, tmp_path / "bad", forecast_bundle=bundle)


@pytest.mark.parametrize("part,path,value,message", [
    ("source", "observation.available_at", "2026-10-10T23:01:00Z", "precede frozen"),
    ("source", "observation.payload.capturedAt", "2026-10-10T12:02:00Z", "precede frozen"),
    ("source", "observation.payload.capturedAt", "2026-10-10T11:59:00Z", "precede frozen"),
    ("source", "observation.payload.inputCutoff", "2026-10-10T12:00:01Z", "precede frozen"),
    ("source", "revision.decision_as_of", "2026-10-10T11:59:00Z", "precede frozen"),
    ("source", "frozen.frozen_at", "2026-10-10T22:59:00Z", "precede frozen"),
    ("source", "observation.payload.reads.0.receivedAt", "2026-10-10T12:00:01Z", "receipt is after"),
    ("source", "observation.payload.reads", [], "receipt evidence"),
    ("source", "observation.payload.replayClassification", "historical_reconstruction", "provenance mismatch"),
    ("source", "observation.provider", "other-provider", "provenance mismatch"),
    ("source", "observation.payload.modelMode", "different-model", "provenance mismatch"),
    ("source", "game.id", 2, "provenance mismatch"),
    ("forecast", "maximum_feature_available_at", "2026-10-10T10:59:00Z", "rows do not match"),
    ("forecast", "source_query_cutoff_at", "2026-10-10T10:59:00Z", "rows do not match"),
    ("forecast", "evidence_classification", "historical_reconstruction", "rows do not match"),
    ("forecast", "checkpoint", "reconstructed", "rows do not match"),
    ("forecast", "opponent_team_id", 99, "rows do not match"),
    ("forecast", "game_type", 1, "rows do not match"),
])
def test_daily_board_settlement_rechecks_saved_capture_timing_and_scope(tmp_path, part, path, value, message):
    from modeling.player_forecasts.daily_board_settlement import verify_forecast_export
    from modeling.player_forecasts.io import read_json, read_jsonl, write_json, write_jsonl
    _, _, row = settlement_artifact_fixture(tmp_path)
    bundle, manifest = frozen_forecast_bundle_fixture(tmp_path, row)
    filename = "source.json" if part == "source" else "forecasts.jsonl"
    content = read_json(bundle / filename) if part == "source" else list(read_jsonl(bundle / filename))[0]
    target = content
    *parents, leaf = path.split(".")
    for key in parents:
        target = target[int(key)] if isinstance(target, list) else target[key]
    target[leaf] = value
    if part == "source":
        write_json(bundle / filename, content)
    else:
        write_jsonl(bundle / filename, [content])
    # Even a newly checksummed artifact must satisfy the saved provenance chain.
    manifest["files"][filename] = hashlib.sha256((bundle / filename).read_bytes()).hexdigest()
    write_json(bundle / "manifest.json", manifest)
    with pytest.raises(ValueError, match=message):
        verify_forecast_export(bundle)


def test_daily_board_settlement_artifact_rejects_modified_sources_and_forecast_leakage(tmp_path):
    from modeling.player_forecasts.daily_board_settlement import settle_forecast_artifact
    from modeling.player_forecasts.io import read_json, write_json, write_jsonl
    forecasts, bundle, row = settlement_artifact_fixture(tmp_path)
    output = tmp_path / "joined"
    for patch, message in [({"outcome": 0}, "outcome information"), ({"issued_at": "2026-10-11T02:00:00Z"}, "pregame"),
        ({"scheduled_start_at": "2026-10-11T23:00:00Z"}, "scheduled start"),
        ({"game_type": 1}, "game type"),
        ({"historical_team_membership_verified": False}, "membership")]:
        write_jsonl(forecasts, [{**row, **patch}])
        with pytest.raises(ValueError, match=message):
            settle_forecast_artifact(forecasts, bundle, output)
        assert not output.exists()
    write_jsonl(forecasts, [row, {**row, "evidence_classification": "historical_reconstruction", "player_id": 2}])
    with pytest.raises(ValueError, match="separate artifacts"):
        settle_forecast_artifact(forecasts, bundle, output)
    write_jsonl(forecasts, [row])
    settlement = read_json(bundle / "settlement.json")
    settlement["players"][0]["outcomes"]["GOALS"] = 99
    write_json(bundle / "settlement.json", settlement)
    with pytest.raises(ValueError, match="checksum"):
        settle_forecast_artifact(forecasts, bundle, output)
    manifest = read_json(bundle / "manifest.json")
    manifest["files"]["settlement.json"] = hashlib.sha256((bundle / "settlement.json").read_bytes()).hexdigest()
    write_json(bundle / "manifest.json", manifest)
    with pytest.raises(ValueError, match="normalization mismatch"):
        settle_forecast_artifact(forecasts, bundle, output)
    assert not output.exists()


def daily_schedule_fixture(count=1):
    return {"currentDate": "2026-10-10", "games": [{"id": number, "gameDate": "2026-10-10", "gameType": 2,
        "gameState": "OFF", "gameScheduleState": "OK", "startTimeUTC": "2026-10-10T23:00:00Z"} for number in range(1, count + 1)]}


def test_daily_board_daily_runner_reuses_verified_artifacts_and_isolates_failures(tmp_path, monkeypatch):
    import shutil
    from modeling.player_forecasts import daily_board_daily as module
    from modeling.player_forecasts.daily_board_settlement import _timestamp
    _, official, row = settlement_artifact_fixture(tmp_path)
    forecasts, _ = frozen_forecast_bundle_fixture(tmp_path, row, "immutable_database_records")
    schedule = daily_schedule_fixture(3)
    schedule["games"][2]["gameState"] = "LIVE"
    monkeypatch.setattr(module, "fetch_official_json", lambda url: {"payload": schedule})
    calls = []
    def export(game_id, slate, path):
        calls.append(("export", game_id))
        if game_id == 2:
            raise RuntimeError("private credential must never reach telemetry")
        shutil.copytree(forecasts, path)
    def capture(game_id, slate, path):
        calls.append(("capture", game_id))
        if game_id == 2:
            raise RuntimeError("private credential must never reach telemetry")
        shutil.copytree(official, path)
    monkeypatch.setattr(module, "_export_forecasts", export)
    monkeypatch.setattr(module, "capture_final", capture)
    now = _timestamp("2026-10-11T06:00:00Z")
    result = module.run_daily("2026-10-10", tmp_path / "daily", now=now)
    assert result["status"] == "failed" and result["counts"] == {"settled": 1, "pending": 1, "failed": 1, "unsupported": 0}
    assert result["games"][1]["stage"] == "official_capture" and result["games"][2]["reason"] == "official_game_not_final"
    assert "private credential" not in json.dumps(result)
    assert Path(result["reportPath"]).stat().st_mode & 0o777 == 0o600
    joined = Path(result["games"][0]["joinDirectory"])
    before = (joined / "manifest.json").stat().st_mtime_ns
    second = module.run_daily("2026-10-10", tmp_path / "daily", game_ids=[1], now=now)
    assert second["status"] == "finished" and second["scope"] == "selected_games"
    assert sorted(calls) == [("capture", 1), ("capture", 2), ("export", 1)]
    assert (joined / "manifest.json").stat().st_mtime_ns == before
    assert second["reportPath"] != result["reportPath"]
    (tmp_path / "daily/2026-10-10/1/baselines/issue-incomplete").mkdir(parents=True)
    partial = module.run_daily("2026-10-10", tmp_path / "daily", game_ids=[1], now=now)
    assert partial["games"][0]["status"] == "failed" and partial["games"][0]["stage"] == "baseline_settlement"
    assert partial["games"][0]["servingForecastStatus"] == "settled"
    assert (joined / "manifest.json").stat().st_mtime_ns == before
    # A cached export is checked again before an existing successful join is reused.
    from modeling.player_forecasts.io import read_json, write_json
    cached = tmp_path / "daily/2026-10-10/1/forecasts"
    source = read_json(cached / "source.json")
    source["observation"]["available_at"] = "2026-10-11T00:00:00Z"
    write_json(cached / "source.json", source)
    manifest = read_json(cached / "manifest.json")
    manifest["files"]["source.json"] = hashlib.sha256((cached / "source.json").read_bytes()).hexdigest()
    write_json(cached / "manifest.json", manifest)
    rejected = module.run_daily("2026-10-10", tmp_path / "daily", game_ids=[1], now=now)
    assert rejected["games"][0]["status"] == "failed" and rejected["games"][0]["stage"] == "forecast_export"
    assert (joined / "manifest.json").stat().st_mtime_ns == before


def test_daily_board_daily_runner_limits_concurrency_and_respects_kernel_lock(tmp_path, monkeypatch):
    import fcntl
    import threading
    import time
    from modeling.player_forecasts import daily_board_daily as module
    from modeling.player_forecasts.daily_board_settlement import _timestamp
    now = _timestamp("2026-10-11T06:00:00Z")
    monkeypatch.setattr(module, "fetch_official_json", lambda url: {"payload": daily_schedule_fixture(16)})
    counts = {"active": 0, "max": 0}
    mutex = threading.Lock()
    def settle(game, *args):
        with mutex:
            counts["active"] += 1
            counts["max"] = max(counts["max"], counts["active"])
        time.sleep(0.005)
        with mutex:
            counts["active"] -= 1
        return {"gameId": game["id"], "status": "settled"}
    monkeypatch.setattr(module, "_settle_game", settle)
    result = module.run_daily("2026-10-10", tmp_path, now=now)
    assert result["counts"]["settled"] == 16 and counts["max"] == 2
    with (tmp_path / "2026-10-10/.settlement.lock").open("r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        assert module.run_daily("2026-10-10", tmp_path, now=now)["status"] == "already_running"
    assert module.run_daily("2026-10-10", tmp_path, now=now)["status"] == "finished"


def test_daily_board_daily_runner_rejects_backfills_and_invalid_slates_before_work(tmp_path, monkeypatch):
    from modeling.player_forecasts import daily_board_daily as module
    from modeling.player_forecasts.daily_board_settlement import _timestamp
    monkeypatch.setattr(module, "fetch_official_json", lambda *args: pytest.fail("no provider request allowed"))
    with pytest.raises(ValueError, match="no backfills"):
        module.run_daily("2025-12-30", tmp_path, now=_timestamp("2026-10-11T06:00:00Z"))
    with pytest.raises(ValueError, match="holdout"):
        module.run_daily("2026-02-01", tmp_path)
    with pytest.raises(ValueError, match="1–16"):
        module.run_daily("2026-10-10", tmp_path, game_ids=list(range(1, 18)), now=_timestamp("2026-10-11T06:00:00Z"))
    with pytest.raises(ValueError, match="at most 16"):
        module.slate_games(daily_schedule_fixture(17), "2026-10-10")
    with pytest.raises(ValueError, match="exact-date"):
        module.slate_games(daily_schedule_fixture(), "2026-10-11")
    with pytest.raises(ValueError, match="requires --history-freeze"):
        module.run_daily("2026-10-11", tmp_path, mode="capture-baselines", now=_timestamp("2026-10-11T06:00:00Z"))
    with pytest.raises(ValueError, match="other modes"):
        module.run_daily("2026-10-10", tmp_path, history_freeze=tmp_path, now=_timestamp("2026-10-11T06:00:00Z"))
    with pytest.raises(ValueError, match="existing private history"):
        module.run_daily("2026-10-11", tmp_path, mode="capture-baselines", history_freeze=tmp_path,
            now=_timestamp("2026-10-11T06:00:00Z"))


def test_daily_board_daily_baselines_capture_and_settle_without_serving_forecasts(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    from modeling.player_forecasts import daily_board_daily as daily, daily_board_candidates as candidates, daily_board_baseline_issuance as issuer
    from modeling.player_forecasts.daily_board_settlement import VERSION, normalize_settlement
    from modeling.player_forecasts.io import read_jsonl, write_json
    freeze, _ = baseline_issuance_fixture(tmp_path)
    sources, _, box, summaries, _ = candidate_pool_fixture()
    now = datetime(2026, 10, 10, 20, tzinfo=timezone.utc)
    class Clock:
        @staticmethod
        def now(tz):
            return now.astimezone(tz)
    monkeypatch.setattr(candidates, "datetime", Clock)
    monkeypatch.setattr(issuer, "datetime", Clock)
    requests = []
    def fetch(url):
        requests.append(url)
        return next(source for source in sources.values() if source["url"] == url)
    monkeypatch.setattr(daily, "fetch_official_json", fetch)
    monkeypatch.setattr(candidates, "fetch_official_json", fetch)
    root = tmp_path / "daily"
    issued = daily.run_daily(box["gameDate"], root, mode="capture-baselines", history_freeze=freeze, now=now)
    assert issued["counts"] == {"issued": 1, "skipped": 0, "failed": 0, "unsupported": 0}
    assert len(requests) == 3 and issued["games"][0]["forecastSkaters"] == 4
    bundle = Path(issued["games"][0]["baselineDirectory"])
    rows = list(read_jsonl(bundle / "forecasts.jsonl"))
    assert len(rows) == 28 and all("outcome" not in row for row in rows)
    assert (bundle.parent).stat().st_mode & 0o777 == 0o700
    def capture(game_id, slate, output):
        assert game_id == box["id"] and slate == box["gameDate"]
        output.mkdir()
        received = "2026-10-11T05:00:00Z"
        write_json(output / "sources.json", {key: {"payload": payload, "receivedAt": received}
            for key, payload in zip(("boxscore", "skaters", "goalies"), (box, *summaries))})
        settled = normalize_settlement(box, *summaries, game_id=game_id, game_date=slate, received_at=received)
        write_json(output / "settlement.json", settled)
        write_json(output / "manifest.json", {"version": VERSION, "gameId": game_id, "gameDate": slate, "players": len(settled["players"]),
            "files": {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ("sources.json", "settlement.json")}})
    monkeypatch.setattr(daily, "capture_final", capture)
    def unavailable(*args):
        raise RuntimeError("private provider details")
    monkeypatch.setattr(daily, "_export_forecasts", unavailable)
    sources["schedule"]["payload"]["games"][0]["gameState"] = "OFF"
    now = datetime(2026, 10, 11, 6, tzinfo=timezone.utc)
    first = daily.run_daily(box["gameDate"], root, now=now)
    game = first["games"][0]
    assert game["stage"] == "forecast_export" and game["status"] == "failed"
    assert game["baselineForecasts"]["status"] == "settled" and "private provider details" not in json.dumps(first)
    result = game["baselineForecasts"]["artifacts"][0]
    assert result["settledTargets"] == 28 and result["unresolvedTargets"] == 0
    joined = Path(result["joinDirectory"])
    data = list(read_jsonl(joined / "settled.jsonl"))
    assert all(set(row["estimates"]) == set(issuer.BASELINES) for row in data)
    before = (joined / "manifest.json").stat().st_mtime_ns
    second = daily.run_daily(box["gameDate"], root, now=now)
    assert second["games"][0]["baselineForecasts"] == game["baselineForecasts"]
    assert (joined / "manifest.json").stat().st_mtime_ns == before
    # An interrupted checkpoint fails visibly without discarding successful peers.
    (bundle.parent / "issue-incomplete").mkdir()
    third = daily.run_daily(box["gameDate"], root, now=now)
    research = third["games"][0]["baselineForecasts"]
    assert research["status"] == "failed" and sorted(r["status"] for r in research["artifacts"]) == ["failed", "settled"]
    assert (joined / "manifest.json").stat().st_mtime_ns == before


def test_daily_board_daily_baseline_settlement_bounds_checkpoint_scan(tmp_path):
    from modeling.player_forecasts.daily_board_daily import _settle_game_baselines
    root = tmp_path / "baselines"
    root.mkdir()
    for index in range(129):
        (root / f"issue-{index}").mkdir()
    result = _settle_game_baselines({}, "2026-10-10", tmp_path)
    assert result["status"] == "failed" and result["reason"] == "baseline_checkpoint_limit_exceeded"


def test_daily_board_daily_artifacts_are_atomic_and_retry_after_partial_failure(tmp_path):
    from modeling.player_forecasts.daily_board_daily import _artifact
    target = tmp_path / "artifact"
    def partial(path):
        path.mkdir()
        (path / "incomplete").write_text("partial")
        raise RuntimeError("worker failed")
    with pytest.raises(RuntimeError):
        _artifact(target, partial, lambda path: None)
    assert not target.exists() and list(tmp_path.iterdir()) == []
    def complete(path):
        path.mkdir()
        (path / "complete").write_text("verified")
    verify = lambda path: (path / "complete").read_text()
    assert _artifact(target, complete, verify) == "verified"
    assert _artifact(target, lambda path: pytest.fail("must reuse verified artifact"), verify) == "verified"


def test_daily_board_daily_candidate_capture_shares_schedule_and_keeps_immutable_snapshots(tmp_path, monkeypatch):
    import fcntl
    from datetime import datetime, timezone
    from modeling.player_forecasts import daily_board_daily as daily, daily_board_candidates as candidates
    sources, _, box, _, _ = candidate_pool_fixture()
    now = datetime(2026, 10, 10, 18, 2, tzinfo=timezone.utc)
    class Clock:
        @staticmethod
        def now(tz):
            return now.astimezone(tz)
    monkeypatch.setattr(candidates, "datetime", Clock)
    requests = []
    def fetch(url):
        requests.append(url)
        return next(source for source in sources.values() if source["url"] == url)
    monkeypatch.setattr(daily, "fetch_official_json", fetch)
    monkeypatch.setattr(candidates, "fetch_official_json", fetch)
    def run(**kwargs):
        return daily.run_daily(box["gameDate"], tmp_path, mode="capture-candidates", now=now, **kwargs)
    first = run(game_ids=[box["id"]])
    assert first["counts"] == {"captured": 1, "skipped": 0, "failed": 0, "unsupported": 0}
    assert len(requests) == 3 and first["scope"] == "selected_games"
    path = Path(first["games"][0]["candidateDirectory"])
    before = (path / "manifest.json").read_bytes()
    assert candidates.verify_candidate_capture(path)[1] == first["games"][0]["candidateManifestSha256"]
    # Capturing candidates must not contend with outcome settlement's lock.
    with (tmp_path / box["gameDate"] / ".settlement.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        second = run()
    assert second["counts"]["captured"] == 1 and len(requests) == 6
    assert second["games"][0]["candidateDirectory"] != str(path)
    assert (path / "manifest.json").read_bytes() == before
    with (tmp_path / box["gameDate"] / ".candidates.lock").open("r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        assert run()["status"] == "already_running"
    assert len(requests) == 6
    sources["schedule"]["payload"]["games"][0]["gameState"] = "LIVE"
    assert run()["counts"]["skipped"] == 1 and len(requests) == 7
    for invalid in ("2026-10-09", "2026-10-18"):
        with pytest.raises(ValueError, match="next seven"):
            daily.run_daily(invalid, tmp_path, mode="capture-candidates", now=now)
    assert len(requests) == 7


def test_daily_board_daily_selects_latest_verified_candidates_before_every_forecast_cutoff(tmp_path, monkeypatch):
    from modeling.player_forecasts import daily_board_daily as daily, daily_board_candidates as candidates
    from modeling.player_forecasts.io import write_jsonl
    _, pool, box, _, _ = candidate_pool_fixture()
    forecast = tmp_path / "forecasts.jsonl"
    write_jsonl(forecast, [{"cutoff_at": "2026-10-10T21:00:00Z"}, {"cutoff_at": "2026-10-10T20:00:00Z"}])
    game = {"id": box["id"], "gameType": 2, "startTimeUTC": box["startTimeUTC"]}
    root = tmp_path / "candidates"
    root.mkdir()
    records = {}
    for name, time in (("old", "18:01"), ("selected", "19:00"), ("late", "20:30")):
        path = root / f"capture-{name}"
        path.mkdir()
        records[path] = ({**pool, "capturedAt": f"2026-10-10T{time}:00Z"}, name)
    monkeypatch.setattr(candidates, "verify_candidate_capture", lambda path: records[path])
    selected, info = daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)
    assert selected == root / "capture-selected" and info["manifestSha256"] == "selected"
    assert info["capturesChecked"] == 3
    write_jsonl(forecast, [{"cutoff_at": "2026-10-10T17:00:00Z"}])
    assert daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)[1]["status"] == "unavailable"
    records[root / "capture-old"] = ({**pool, "gameId": 123}, "wrong-game")
    with pytest.raises(ValueError, match="disagrees"):
        daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)
    def corrupt(path):
        raise ValueError("checksum mismatch")
    monkeypatch.setattr(candidates, "verify_candidate_capture", corrupt)
    with pytest.raises(ValueError, match="checksum"):
        daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)
    write_jsonl(forecast, [])
    with pytest.raises(ValueError, match="bounded issued"):
        daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)
    for number in range(126):
        (root / f"capture-extra-{number}").mkdir()
    with pytest.raises(ValueError, match="128 snapshots"):
        daily._select_candidate_capture(tmp_path, game, box["gameDate"], forecast)


def test_daily_board_export_bounds_and_historical_identity(tmp_path):
    from modeling.player_forecasts.daily_board_data import freeze_history, validate_range
    row = {"game_id": 1, "game_date": "2025-10-07", "player_id": 7, "team_id": 10, "opponent_team_id": 8,
        "population": "skater", "source_recorded_at": "2026-09-15T00:00:00Z", "outcomes": {"toi": "20:30", "pp_toi": "2:00", "pk_toi": "1:30", "GOALS": 1}}
    manifest = freeze_history([row], tmp_path / "freeze", "2025-10-07", "2025-10-08")
    assert manifest["rows"] == 1 and manifest["membershipMissingRows"] == 0
    exported = json.loads((tmp_path / "freeze/history.jsonl").read_text())
    assert all(exported["outcomes"][key] is None for key in ("EV_TOI", "PP_TOI", "PK_TOI"))
    assert exported["outcomes"]["TIME_ON_ICE_PER_GAME"] == 20.5
    assert exported["legacy_strength_times"] == {"pp_toi": "2:00", "pk_toi": "1:30"}
    assert manifest["strengthUsageVerifiedRows"] == 0
    assert exported["source_recorded_at"] == row["source_recorded_at"]
    assert not exported["participation_label_eligible"]
    with pytest.raises(ValueError, match="protected"):
        validate_range("2025-10-01", "2026-02-01")
    with pytest.raises(ValueError, match="duplicate"):
        freeze_history([row, row], tmp_path / "duplicate", "2025-10-07", "2025-10-08")


def strength_history_fixture():
    identity = {"game_id": 1, "game_date": "2025-10-07", "player_id": 7, "team_id": 10, "opponent_team_id": 8}
    derived = {**identity, "updated_at": "2026-02-01T12:00:00Z",
        "toi_es_seconds": 1020, "toi_pp_seconds": 120, "toi_pk_seconds": 90,
        "goals_es": 0, "goals_pp": 1, "goals_pk": 0,
        "assists_es": 1, "assists_pp": 0, "assists_pk": 0,
        "shots_es": 1, "shots_pp": 2, "shots_pk": 0}
    shift = {**identity, "id": 1, "season_id": 20252026, "game_type": "2", "home_or_away": "home",
        "team_abbreviation": "TOR", "opponent_team_abbreviation": "MTL", "updated_at": "2026-01-31T12:00:00Z",
        "total_es_toi": "17:00", "total_pp_toi": "2:00", "total_pk_toi": "1:30"}
    return {**identity, "season_id": 20252026, "game_type": 2, "home": True, "population": "skater", "position": "C",
        "source_recorded_at": "2025-10-08T02:00:00Z",
        "outcomes": {"toi": "20:30", "pp_toi": "00:00", "pk_toi": "00:00", "GOALS": 1, "ASSISTS": 1,
            "SHOTS_ON_GOAL": 3, "PP_POINTS": 1}, "strength_evidence": {"derived": [derived], "shifts": [shift]}}


def test_daily_board_export_reconciles_strength_sources_and_preserves_real_zero_usage(tmp_path):
    from modeling.player_forecasts.daily_board_data import normalize_history, freeze_history
    row = strength_history_fixture()
    normalized = normalize_history(row)
    assert normalized["outcomes"]["EV_TOI"] == 17
    assert normalized["outcomes"]["PP_TOI"] == 2
    assert normalized["outcomes"]["PK_TOI"] == 1.5
    assert normalized["outcomes"]["PP_GOALS"] == 1
    assert normalized["outcomes"]["EV_ASSISTS"] == 1
    assert normalized["strength_status"]["usage"] == normalized["strength_status"]["rates"] == "verified"
    assert normalized["strength_status"]["provenance"]["derivedRecordedAt"] == "2026-02-01T12:00:00Z"
    assert normalized == normalize_history(row)
    row["strength_evidence"]["shifts"][0]["game_type"] = None
    assert normalize_history(row)["strength_status"]["provenance"]["missingShiftMetadata"] == ["game_type"]
    assert normalize_history(row)["strength_status"]["usage"] == "verified"
    row["game_type"] = None
    assert normalize_history(row)["strength_status"]["usage"] == "unavailable"
    row["game_type"] = 2
    row["strength_evidence"]["shifts"][0]["game_type"] = "2"
    manifest = freeze_history([row], tmp_path / "strength", "2025-10-07", "2025-10-07")
    assert manifest["strengthUsageVerifiedRows"] == manifest["strengthRatesVerifiedRows"] == 1
    assert manifest["strengthExclusions"] == {}
    assert (tmp_path / "strength").stat().st_mode & 0o777 == 0o700
    assert all(path.stat().st_mode & 0o777 == 0o600 for path in (tmp_path / "strength").iterdir())
    derived = row["strength_evidence"]["derived"][0]
    shift = row["strength_evidence"]["shifts"][0]
    derived.update(toi_es_seconds=1230, toi_pp_seconds=0, toi_pk_seconds=0, goals_es=1, goals_pp=0, shots_es=3, shots_pp=0)
    shift.update(total_es_toi="20:30", total_pp_toi="00:00", total_pk_toi="00:00")
    row["outcomes"]["PP_POINTS"] = 0
    real_zero = normalize_history(row)
    assert real_zero["outcomes"]["PP_TOI"] == real_zero["outcomes"]["PK_TOI"] == 0
    assert real_zero["strength_status"]["rates"] == "verified"


def test_daily_board_export_withholds_conflicting_strengths_without_discarding_box_totals():
    import copy
    from modeling.player_forecasts.daily_board_data import normalize_history
    base = strength_history_fixture()
    for source, field, value, reason in (
        ("derived", "team_id", 8, "strength_identity_conflict"),
        ("shifts", "game_type", "1", "strength_identity_conflict"),
        ("shifts", "season_id", 20242025, "strength_identity_conflict"),
        ("derived", "updated_at", None, "strength_source_provenance_missing"),
        ("shifts", "total_pp_toi", "2:0", "strength_usage_accounting_mismatch"),
        ("derived", "toi_pp_seconds", 121, "strength_usage_accounting_mismatch"),
        ("derived", "shots_pp", 3, "strength_category_accounting_mismatch"),
        ("derived", "goals_pp", 2, "strength_category_accounting_mismatch"),
    ):
        row = copy.deepcopy(base)
        row["strength_evidence"][source][0][field] = value
        result = normalize_history(row)
        assert result["outcomes"]["TIME_ON_ICE_PER_GAME"] == 20.5
        assert result["outcomes"]["GOALS"] == 1
        assert result["outcomes"]["PP_GOALS"] is None
        assert reason in result["strength_status"]["reasons"]
        assert result["strength_status"]["rates"] == "unavailable"
    row = copy.deepcopy(base)
    row["strength_evidence"]["shifts"].append(row["strength_evidence"]["shifts"][0])
    assert normalize_history(row)["strength_status"]["reasons"] == ["missing_or_ambiguous_strength_sources"]
    row = copy.deepcopy(base)
    row["outcomes"]["toi"] = "21:00"
    assert normalize_history(row)["strength_status"]["reasons"] == ["strength_usage_accounting_mismatch"]


def strength_sequence_fixture():
    rows = []
    for day, pp_minutes in ((1, 2), (3, 4), (5, 6), (7, 4)):
        row = strength_history_fixture()
        row.update(game_id=day, game_date=f"2025-10-{day:02}")
        for source in ("derived", "shifts"):
            row["strength_evidence"][source][0].update(game_id=day, game_date=row["game_date"])
        row["strength_evidence"]["derived"][0].update(toi_pp_seconds=pp_minutes * 60, toi_es_seconds=(19 - pp_minutes) * 60)
        row["strength_evidence"]["shifts"][0].update(total_pp_toi=f"{pp_minutes}:00", total_es_toi=f"{19 - pp_minutes}:00")
        rows.append(row)
    return rows


def test_daily_board_strength_separates_usage_and_rates_without_future_leakage():
    import copy
    from modeling.player_forecasts.daily_board_data import normalize_history
    from modeling.player_forecasts.daily_board_strength import strength_baselines, MODELS
    rows = list(map(normalize_history, strength_sequence_fixture()))
    result = strength_baselines(rows, recent_games=1, recent_weight=1)
    target = result["rows"][1]
    estimates = target["estimates"]
    assert target["game_id"] == 5 and target["maximum_feature_game_date"] == "2025-10-03"
    assert estimates["PP_TOI"]["strength_usage_rate"] == 4
    assert estimates["PP_SHOTS_ON_GOAL"]["strength_usage_rate"] == pytest.approx(4 * 4 / 6)
    assert estimates["SHOTS_ON_GOAL"]["total_usage_rate"] == 3
    assert estimates["SHOTS_ON_GOAL"]["strength_usage_rate"] == pytest.approx(15 * 2 / 32 + 4 * 4 / 6)
    for model in MODELS:
        assert estimates["GOALS"][model] == pytest.approx(sum(estimates[f"{s}_GOALS"][model] for s in ("EV", "PP", "PK")))
        assert estimates["PP_POINTS"][model] == pytest.approx(estimates["PP_GOALS"][model] + estimates["PP_ASSISTS"][model])
        assert estimates["GOALS"][model] <= estimates["SHOTS_ON_GOAL"][model]
        assert estimates["TIME_ON_ICE_PER_GAME"][model] == pytest.approx(20.5)
    poisoned = copy.deepcopy(rows)
    for row in poisoned[2:]:
        row["outcomes"] = {key: 999 for key in row["outcomes"]}
        row["row_hash"] = "future-poison"
        row["position"] = "D"
    after = strength_baselines(poisoned, recent_games=1, recent_weight=1)["rows"][1]
    assert after["estimates"] == estimates and after["feature_hash"] == target["feature_hash"]
    assert target["segments"]["position"] == after["segments"]["position"] == "C"
    assert result == strength_baselines(rows, recent_games=1, recent_weight=1)
    other = strength_history_fixture()
    other.update(player_id=8, game_id=1, game_date="2025-10-01")
    for source in ("derived", "shifts"):
        other["strength_evidence"][source][0].update(player_id=8, game_id=1, game_date="2025-10-01")
    other["strength_evidence"]["derived"][0].update(goals_pp=0, assists_es=0, shots_es=10, shots_pp=0)
    other["outcomes"].update(GOALS=0, ASSISTS=0, SHOTS_ON_GOAL=10, PP_POINTS=0)
    pooled = next(r for r in strength_baselines([*rows, normalize_history(other)], recent_games=1, recent_weight=1)["rows"] if r["game_id"] == 5)
    assert pooled["estimates"]["PP_SHOTS_ON_GOAL"]["strength_usage_rate"] == estimates["PP_SHOTS_ON_GOAL"]["strength_usage_rate"]
    assert pooled["estimates"]["PP_SHOTS_ON_GOAL"]["strength_shrinkage"] == pytest.approx(4 * (4 + 180 * 4 / 8) / (6 + 180))


def test_daily_board_strength_excludes_missing_recent_usage_and_unverified_exports():
    import copy
    from modeling.player_forecasts.daily_board_data import normalize_history
    from modeling.player_forecasts.daily_board_strength import strength_baselines
    raw = strength_sequence_fixture()
    raw[1]["strength_evidence"] = {}
    rows = list(map(normalize_history, raw))
    result = strength_baselines(rows)
    assert result["exclusions"]["recent_usage_incomplete"] == 2
    assert [row["game_id"] for row in result["rows"]] == [3]
    with pytest.raises(ValueError, match="duplicate"):
        strength_baselines([rows[0], rows[0]])
    old = copy.deepcopy(rows[0])
    old["normalizerVersion"] = "legacy"
    with pytest.raises(ValueError, match="corrected"):
        strength_baselines([old])
    protected = copy.deepcopy(rows[0])
    protected["game_date"] = "2026-01-03"
    with pytest.raises(ValueError, match="protected"):
        strength_baselines([protected])
    zero_raw = strength_sequence_fixture()
    for row in zero_raw:
        row["strength_evidence"]["derived"][0].update(toi_pp_seconds=0, toi_pk_seconds=0, toi_es_seconds=1230,
            goals_es=1, goals_pp=0, shots_es=3, shots_pp=0)
        row["strength_evidence"]["shifts"][0].update(total_pp_toi="0:00", total_pk_toi="0:00", total_es_toi="20:30")
        row["outcomes"]["PP_POINTS"] = 0
    zero = strength_baselines(list(map(normalize_history, zero_raw)))
    assert len(zero["rows"]) == 3
    assert all(r["estimates"]["PP_SHOTS_ON_GOAL"]["strength_shrinkage"] == 0 for r in zero["rows"])


def test_daily_board_strength_reports_are_private_reproducible_and_fail_closed(tmp_path):
    from modeling.player_forecasts.daily_board_data import freeze_history
    from modeling.player_forecasts.daily_board_strength import evaluate_strength_freeze
    freeze = tmp_path / "freeze"
    freeze_history(strength_sequence_fixture(), freeze, "2025-10-01", "2025-10-07")
    a = evaluate_strength_freeze(freeze, tmp_path / "a", "2025-10-05", "2025-10-07")
    b = evaluate_strength_freeze(freeze, tmp_path / "b", "2025-10-05", "2025-10-07")
    assert a == b and a["evaluatedGames"] == 2 and not a["promotionEligible"]
    assert (tmp_path / "a/evaluation.jsonl").read_bytes() == (tmp_path / "b/evaluation.jsonl").read_bytes()
    assert (tmp_path / "a").stat().st_mode & 0o777 == 0o700
    assert all(p.stat().st_mode & 0o777 == 0o600 for p in (tmp_path / "a").iterdir())
    empty = evaluate_strength_freeze(freeze, tmp_path / "empty", "2025-10-01", "2025-10-01")
    assert empty["status"] == "insufficient_eligible_history" and empty["reports"] == {}
    with pytest.raises(FileExistsError):
        evaluate_strength_freeze(freeze, tmp_path / "a", "2025-10-05", "2025-10-07")
    with pytest.raises(ValueError, match="inside"):
        evaluate_strength_freeze(freeze, tmp_path / "outside", "2025-10-01", "2025-10-08")
    with (freeze / "history.jsonl").open("a") as handle:
        handle.write("\n")
    with pytest.raises(ValueError, match="checksum"):
        evaluate_strength_freeze(freeze, tmp_path / "corrupt", "2025-10-05", "2025-10-07")


def test_daily_board_baselines_do_not_read_current_or_future_outcomes():
    from modeling.player_forecasts.daily_board_models import historical_baselines
    rows = [{"game_id": day, "player_id": 7, "game_date": f"2025-10-{day:02}", "season_id": 20252026,
        "team_id": 10, "opponent_team_id": 8, "position": "C", "population": "skater", "historical_team_membership_verified": True,
        "outcomes": {"GOALS": 1 if day < 6 else 50, "TIME_ON_ICE_PER_GAME": 20}, "row_hash": str(day)} for day in range(1, 8)]
    before = historical_baselines(rows)
    rows[-1]["outcomes"]["GOALS"] = 999
    after = historical_baselines(rows)
    assert before[-1]["estimates"] == after[-1]["estimates"]
    assert after[-1]["maximum_feature_game_date"] == "2025-10-05"
    assert after[-1]["estimates"]["GOALS"]["role_aware"] == 1


def test_daily_board_context_uses_only_lagged_opponent_residuals():
    import copy
    from modeling.player_forecasts.daily_board_context import context_features
    from modeling.player_forecasts.daily_board_data import normalize_history
    rows = [normalize_history({"game_id": day, "game_date": f"2025-10-{day:02}", "player_id": 7,
        "team_id": 10, "opponent_team_id": 8, "home": bool(day % 2), "season_id": 20252026,
        "position": "C", "population": "skater", "outcomes": {"toi": "20:00", "GOALS": day % 2,
        "ASSISTS": 1, "SHOTS_ON_GOAL": 3, "PP_POINTS": 0, "HITS": 2, "BLOCKED_SHOTS": 1}}) for day in range(1, 13)]
    before = context_features(rows)
    assert before["rows"][0]["game_date"] == "2025-10-06"
    assert before["rows"][0]["opponent_history_games"] == [3, 4]
    assert before["rows"][0]["player_residual_history_games"] == [3, 4]
    assert before["rows"][-1]["player_residual_history_games"] == [6, 7, 8, 9, 10]
    changed = copy.deepcopy(rows)
    for row in changed[-2:]:
        row["outcomes"]["HITS"] = 500
        row["row_hash"] = "changed"
    after = context_features(changed)
    assert before["rows"][-1]["features"] == after["rows"][-1]["features"]
    assert before["rows"][-1]["feature_hash"] == after["rows"][-1]["feature_hash"]
    assert before["rows"][-1]["maximum_feature_game_date"] == "2025-10-10"
    assert before["rows"][-1]["features"]["HITS"]["opponent_residual"] == 0
    assert before["rows"][-1]["features"]["HITS"]["player_residual"] == 0
    changed[9]["outcomes"]["HITS"] = 10
    assert context_features(changed)["rows"][-1]["features"]["HITS"]["opponent_residual"] > 0
    assert context_features(changed)["rows"][-1]["features"]["HITS"]["player_residual"] == pytest.approx(1.6)
    other = copy.deepcopy(rows)
    for row in other:
        row["player_id"] = 8
        row["outcomes"]["HITS"] = 500 if row["game_date"] == "2025-10-10" else 2
    isolated = context_features(rows + other)
    own = next(r for r in isolated["rows"] if r["player_id"] == 7 and r["game_date"] == "2025-10-12")
    assert own["features"]["HITS"]["player_residual"] == 0
    assert own["features"]["HITS"]["opponent_residual"] > 0
    sparse = copy.deepcopy(rows[-4:])
    for row in sparse:
        row["player_id"] = 9
    sparse_result = context_features(rows + sparse)
    assert sparse_result["exclusions"]["insufficient_player_residual_history"] > 0
    assert all(r["player_id"] != 9 for r in sparse_result["rows"])
    # Changing teams preserves the player's own recent signal, but a new season
    # must not reuse it even when old-season player history exists.
    traded = copy.deepcopy(rows)
    traded[-1].update(team_id=9)
    assert context_features(traded)["rows"][-1]["player_residual_history_games"] == [6, 7, 8, 9, 10]
    new_season = copy.deepcopy(rows)
    for row in new_season[-4:]:
        row["season_id"] = 20262027
    season_rows = [r for r in context_features(new_season)["rows"] if r["season_id"] == 20262027]
    assert [r["game_date"] for r in season_rows] == ["2025-10-12"]
    assert season_rows[0]["player_residual_history_games"] == [9, 10]
    missing = copy.deepcopy(rows)
    missing[-1]["home"] = None
    assert context_features(missing)["exclusions"]["missing_home_context"] == 1
    invalid = copy.deepcopy(rows)
    invalid[-1]["outcomes"]["PP_POINTS"] = 50
    filtered = context_features(invalid)
    assert filtered["exclusions"]["category_accounting_conflict"] == 1
    assert filtered["rows"][-1]["game_date"] == "2025-10-11"
    assert filtered["rows"] == before["rows"][:-1]
    with pytest.raises(ValueError, match="duplicate"):
        context_features(rows + rows[:1])
    bad = copy.deepcopy(rows)
    bad[-1]["game_date"] = "2026-01-03"
    with pytest.raises(ValueError, match="holdout"):
        context_features(bad)
    opposite = copy.deepcopy(rows[-1])
    opposite.update(player_id=8, team_id=8, opponent_team_id=10)
    with pytest.raises(ValueError, match="opposing-team"):
        context_features(rows + [opposite])


def test_daily_board_context_ridge_has_known_solution_and_reconciles_categories():
    from modeling.player_forecasts.daily_board_context import CATEGORIES, fit_context, predict_context
    rows = [{"game_id": i, "player_id": 7, "feature_hash": str(i),
        "features": {c: {"home": i % 2, "opponent_residual": 0, "player_residual": 0} for c in CATEGORIES},
        "estimates": {c: {"recent_season": 10} for c in CATEGORIES},
        "outcomes": {c: 10 + 2 * (i % 2) for c in CATEGORIES}} for i in range(40)]
    artifact = fit_context(rows)
    fitted = artifact["models"]["HITS"]["home_only"]
    assert fitted["means"] == [0.5] and fitted["scales"] == [0.5]
    assert fitted["weights"] == pytest.approx([1, 0.8])
    prediction = predict_context(rows[-1], artifact)
    assert prediction["estimates"]["HITS"]["home_only"] == pytest.approx(11.8)
    assert prediction["estimates"]["HITS"]["opponent_only"] == pytest.approx(11)
    assert prediction["estimates"]["HITS"]["recent_residual_only"] == pytest.approx(11)
    assert prediction["estimates"]["HITS"]["home_opponent_recent"] == pytest.approx(11.8)
    residual_rows = [{**r, "features": {c: {"home": 0, "opponent_residual": 0, "player_residual": r["game_id"] % 2}
        for c in CATEGORIES}} for r in rows]
    residual_artifact = fit_context(residual_rows)
    assert residual_artifact["models"]["HITS"]["recent_residual_only"]["weights"] == pytest.approx([1, 0.8])
    assert predict_context(residual_rows[-1], residual_artifact)["estimates"]["HITS"]["home_opponent_recent"] == pytest.approx(11.8)
    with pytest.raises(ValueError, match="policy"):
        predict_context(rows[-1], {**artifact, "policy": {"version": "starter-board-context-v1"}})
    artifact["models"]["GOALS"]["home_only"]["weights"][0] = 500
    artifact["models"]["PP_POINTS"]["home_only"]["weights"][0] = 500
    reconciled = predict_context(rows[-1], artifact)
    assert reconciled["estimates"]["GOALS"]["home_only"] == reconciled["estimates"]["SHOTS_ON_GOAL"]["home_only"]
    assert reconciled["estimates"]["PP_POINTS"]["home_only"] == pytest.approx(23.6)
    assert reconciled["reconciliationCounts"]["home_only"] == 2


def test_daily_board_context_freeze_keeps_fit_separate_and_replay_private(tmp_path):
    from modeling.player_forecasts.daily_board_context import evaluate_context_freeze
    from modeling.player_forecasts.daily_board_data import freeze_history
    rows = [{"game_id": day, "game_date": f"2025-10-{day:02}", "player_id": 7,
        "team_id": 10, "opponent_team_id": 8, "home": bool(day % 2), "season_id": 20252026,
        "position": "C", "population": "skater", "outcomes": {"toi": "20:00", "GOALS": day % 2,
        "ASSISTS": 1, "SHOTS_ON_GOAL": 3, "PP_POINTS": 0, "HITS": 2, "BLOCKED_SHOTS": 1}} for day in range(1, 13)]
    freeze = tmp_path / "freeze"
    freeze_history(rows, freeze, "2025-10-01", "2025-10-12")
    split = {"training_end": "2025-10-08", "evaluation_start": "2025-10-10", "evaluation_end": "2025-10-12"}
    first = evaluate_context_freeze(freeze, tmp_path / "first", **split)
    assert first == evaluate_context_freeze(freeze, tmp_path / "replay", **split)
    assert first["evaluatedGames"] == 3 and not first["promotionEligible"]
    for name in ("evaluation.jsonl", "model.json", "report.json"):
        assert (tmp_path / "first" / name).read_bytes() == (tmp_path / "replay" / name).read_bytes()
        assert (tmp_path / "first" / name).stat().st_mode & 0o777 == 0o600
    assert (tmp_path / "first").stat().st_mode & 0o777 == 0o700
    rows[-1]["outcomes"]["HITS"] = 100
    freeze_history(rows, tmp_path / "changed", "2025-10-01", "2025-10-12")
    changed = evaluate_context_freeze(tmp_path / "changed", tmp_path / "second", **split)
    a = json.loads((tmp_path / "first/model.json").read_text())
    b = json.loads((tmp_path / "second/model.json").read_text())
    assert a["models"] == b["models"] and a["trainingHash"] == b["trainingHash"]
    assert first["reports"]["HITS"] != changed["reports"]["HITS"]
    with pytest.raises(ValueError, match="lag"):
        evaluate_context_freeze(freeze, tmp_path / "bad-lag", **{**split, "training_end": "2025-10-09"})
    with (freeze / "history.jsonl").open("a") as handle:
        handle.write("\n")
    with pytest.raises(ValueError, match="checksum"):
        evaluate_context_freeze(freeze, tmp_path / "corrupt", **split)


def baseline_issuance_fixture(tmp_path):
    from modeling.player_forecasts.daily_board_candidates import VERSION
    from modeling.player_forecasts.daily_board_data import freeze_history
    from modeling.player_forecasts.io import write_json
    sources, pool, _, _, _ = candidate_pool_fixture()
    candidate = tmp_path / "candidates"
    candidate.mkdir()
    for name, content in (("sources.json", sources), ("candidates.json", pool)):
        write_json(candidate / name, content)
    write_json(candidate / "manifest.json", {"version": VERSION, "gameId": pool["gameId"], "gameDate": pool["gameDate"],
        "candidates": len(pool["players"]), "files": {name: hashlib.sha256((candidate / name).read_bytes()).hexdigest()
            for name in ("sources.json", "candidates.json")}})
    freeze = tmp_path / "history"
    rows = [{"game_id": day, "game_date": f"2025-10-{day:02}", "player_id": player, "team_id": 10 if player < 10 else 8,
        "opponent_team_id": 8 if player < 10 else 10, "season_id": 20252026, "position": "C", "population": "skater",
        "outcomes": {"toi": "20:00", "GOALS": 1, "ASSISTS": 1, "PP_POINTS": 1, "SHOTS_ON_GOAL": 3, "HITS": 2, "BLOCKED_SHOTS": 1}}
        for day in (1, 3, 5) for player in (1, 2, 11, 12)]
    freeze_history(rows, freeze, "2025-10-01", "2025-10-05")
    return freeze, candidate


def test_daily_board_baselines_forecast_candidates_without_current_outcome_placeholders():
    from modeling.player_forecasts.daily_board_models import historical_baselines
    rows = [{"game_id": 1, "player_id": 7, "game_date": "2025-10-01", "season_id": 20252026,
        "team_id": 10, "position": "C", "population": "skater", "historical_team_membership_verified": True,
        "outcomes": {"GOALS": 1, "TIME_ON_ICE_PER_GAME": 20}, "row_hash": "one"}]
    candidate = {k: v for k, v in rows[0].items() if k not in ("outcomes", "row_hash")}
    candidate.update(game_id=2, game_date="2025-10-03")
    future = {**candidate, "game_id": 3, "game_date": "2025-10-05"}
    result = historical_baselines(rows, candidates=[candidate, future])
    assert len(result) == 2 and result[0]["outcomes"] == result[1]["outcomes"] == {}
    assert result[0]["estimates"] == result[1]["estimates"]
    assert result[1]["maximum_feature_game_date"] == "2025-10-01"
    assert result[0]["estimates"]["GOALS"]["season_rate"] == 1
    with pytest.raises(ValueError, match="must not contain outcomes"):
        historical_baselines(rows, candidates=[{**candidate, "outcomes": {"GOALS": 0}}])


def test_daily_board_baseline_issuance_is_private_replayable_and_settles_all_models(tmp_path, monkeypatch):
    from datetime import datetime, timezone
    from modeling.player_forecasts import daily_board_baseline_issuance as module
    from modeling.player_forecasts.daily_board_settlement import attach_official_outcomes, normalize_settlement, verify_forecast_export
    from modeling.player_forecasts.io import read_jsonl
    freeze, candidate = baseline_issuance_fixture(tmp_path)
    class Clock:
        @staticmethod
        def now(tz):
            return datetime(2026, 10, 10, 20, tzinfo=timezone.utc)
    monkeypatch.setattr(module, "datetime", Clock)
    output = tmp_path / "issued"
    result = module.issue_baselines(freeze, candidate, output)
    assert result["forecastSkaters"] == 4 and result["candidateSkaters"] == 6
    assert result["excludedPlayerIds"] == [99, 199] and not result["promotionEligible"]
    path, provenance = verify_forecast_export(output)
    assert provenance["sourceOrigin"] == "private_pregame_baseline_artifact"
    rows = list(read_jsonl(path))
    assert len(rows) == 28 and all("outcome" not in row and "forge" not in row["estimates"] for row in rows)
    fantasy = next(r for r in rows if r["target_key"] == "FANTASY_POINTS")
    assert fantasy["estimates"]["season_rate"] == pytest.approx(7.25)
    assert fantasy["conditioning"] == "conditional_playing"
    _, _, box, summaries, html = candidate_pool_fixture()
    settled = normalize_settlement(box, *summaries, game_id=box["id"], game_date=box["gameDate"],
        received_at="2026-10-11T05:00:00Z", roster_report={"payload": html})
    joined = attach_official_outcomes(rows, settled)
    assert len(joined["rows"]) == 28 and not joined["unresolved"]
    assert all(set(r["estimates"]) == set(module.BASELINES) for r in joined["rows"])
    assert output.stat().st_mode & 0o777 == 0o700
    assert all(p.stat().st_mode & 0o777 == 0o600 for p in output.iterdir())
    before = (output / "manifest.json").stat().st_mtime_ns
    assert module.issue_baselines(freeze, candidate, output) == result
    assert (output / "manifest.json").stat().st_mtime_ns == before
    with pytest.raises(ValueError, match="replace issued forecast sources"):
        module.issue_baselines(tmp_path / "other-history", candidate, output)
    with (output / "forecasts.jsonl").open("a") as handle:
        handle.write("\n")
    with pytest.raises(ValueError, match="checksum"):
        verify_forecast_export(output)


def test_daily_board_baseline_issuance_rejects_late_sources_and_crossing_puck_drop(tmp_path, monkeypatch):
    from datetime import datetime
    from modeling.player_forecasts import daily_board_baseline_issuance as module
    from modeling.player_forecasts.io import read_json, write_json
    freeze, candidate = baseline_issuance_fixture(tmp_path)
    with pytest.raises(ValueError, match="candidate capture"):
        module.baseline_rows(freeze, candidate, cutoff_at="2026-10-10T17:00:00Z", issued_at="2026-10-10T20:00:00Z")
    with pytest.raises(ValueError, match="issuance must precede"):
        module.baseline_rows(freeze, candidate, cutoff_at="2026-10-10T20:00:00Z", issued_at="2026-10-10T23:00:00Z")
    times = iter(["2026-10-10T20:00:00+00:00", "2026-10-10T20:01:00+00:00", "2026-10-10T23:00:00+00:00"])
    class Clock:
        @staticmethod
        def now(tz):
            return datetime.fromisoformat(next(times))
    monkeypatch.setattr(module, "datetime", Clock)
    with pytest.raises(ValueError, match="publication passed puck drop"):
        module.issue_baselines(freeze, candidate, tmp_path / "expired")
    assert not (tmp_path / "expired/manifest.json").exists()
    manifest = read_json(freeze / "manifest.json")
    manifest["createdAt"] = "2026-10-10T21:00:00Z"
    write_json(freeze / "manifest.json", manifest)
    with pytest.raises(ValueError, match="not available"):
        module.baseline_rows(freeze, candidate, cutoff_at="2026-10-10T20:00:00Z", issued_at="2026-10-10T20:01:00Z")


def test_daily_board_logistic_requires_trustworthy_labels_and_is_reproducible():
    from modeling.player_forecasts.daily_board_models import fit_logistic, logistic_probability
    rows = [{"label": int(i >= 10), "label_verified": True, "candidate_list_complete": True,
        "maximum_feature_available_at": "2026-10-01T10:00:00Z", "cutoff_at": "2026-10-01T12:00:00Z",
        "scheduled_start_at": "2026-10-01T20:00:00Z", "features": {"prior_appearances": i}} for i in range(20)]
    artifact = fit_logistic(rows, ["prior_appearances"])
    assert artifact == fit_logistic(rows, ["prior_appearances"])
    assert logistic_probability(artifact, {"prior_appearances": 19}) > logistic_probability(artifact, {"prior_appearances": 1})
    assert logistic_probability(artifact, {}) is None
    with pytest.raises(ValueError, match="both positive and negative"):
        fit_logistic(rows[:10], ["prior_appearances"])
    rows[0]["candidate_list_complete"] = False
    with pytest.raises(ValueError, match="complete candidate"):
        fit_logistic(rows, ["prior_appearances"])


def test_daily_board_goalie_calibration_preserves_team_probability_mass():
    from modeling.player_forecasts.daily_board_models import fit_goalie_temperature, goalie_start_probabilities
    assert sum(goalie_start_probabilities([0.7, 0.2, 0.1], 2)) == pytest.approx(1)
    assert goalie_start_probabilities([1, 0], 2) == [1, 0]
    with pytest.raises(ValueError, match="complete team"):
        goalie_start_probabilities([0.6, 0.2])
    fitted = fit_goalie_temperature([{"probabilities": [0.9, 0.1], "labels": [i % 2, 1 - i % 2], "label_verified": True} for i in range(10)])
    assert fitted["temperature"] > 1
    assert not fitted["promotionEligible"]
    assert goalie_start_probabilities([0.7, 0.3], 1e-300) == [1, 0]
    assert len(fitted["selectionTrials"]) == 7
    for temperature in (True, 0, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            goalie_start_probabilities([0.7, 0.3], temperature)
    for labels in ([True, False], [1], [1, 1], [0, 0]):
        with pytest.raises(ValueError, match="official starter"):
            fit_goalie_temperature([{"probabilities": [0.7, 0.3], "labels": labels, "label_verified": True}])


def goalie_calibration_fixture(game=1, date="2026-10-10", starter=0):
    issued = [daily_board_row(game_id=game, game_date=date, player_id=player, team_id=10,
        population="goalie", target_key="goalie_start", conditioning="probability",
        checkpoint="frozen_final_pregame", revision_id=f"revision-{game}",
        cutoff_at=f"{date}T12:00:00Z", maximum_feature_available_at=f"{date}T11:00:00Z",
        issued_at=f"{date}T12:01:00Z", scheduled_start_at=f"{date}T20:00:00Z",
        estimates={"forge": probability}) for player, probability in enumerate((0.9, 0.1))]
    for row in issued:
        for key in ("outcome", "played", "settlement_status", "settlement_received_at", "settlement_hash", "samples"):
            row.pop(key, None)
    settled = [{**row, "outcome": int(row["player_id"] == starter), "settlement_status": "final",
        "settlement_hash": "official-fixture", "settlement_received_at": f"{date}T23:00:00Z"} for row in issued]
    return issued, settled


def test_daily_board_goalie_groups_preserve_issued_pool_and_checkpoint():
    from modeling.player_forecasts.daily_board_goalies import goalie_groups
    issued, settled = goalie_calibration_fixture()
    assert len(goalie_groups(issued, settled)["groups"]) == 1
    missing = goalie_groups(issued, settled[:1])
    assert missing["groups"] == [] and missing["exclusions"] == {"incomplete_candidate_labels": 1}
    with pytest.raises(ValueError, match="duplicate issued"):
        goalie_groups(issued + issued[:1], settled)
    with pytest.raises(ValueError, match="differs from issued"):
        goalie_groups(issued, [{**settled[0], "estimates": {"forge": 0.8}}, settled[1]])
    with pytest.raises(ValueError, match="future goalie"):
        goalie_groups([{**issued[0], "maximum_feature_available_at": "2026-10-10T13:00:00Z"}, issued[1]], settled)
    with pytest.raises(ValueError, match="mixed goalie"):
        goalie_groups(issued + [{**issued[0], "team_id": 8, "player_id": 100, "revision_id": "other"}], settled)
    with pytest.raises(ValueError, match="official preseason"):
        goalie_groups([{**row, "game_type": True} for row in issued], [])


def test_daily_board_goalie_training_is_chronological_private_and_retrospective(tmp_path):
    from modeling.player_forecasts.daily_board_goalies import train_goalie_calibration
    from modeling.player_forecasts.daily_board_settlement import JOIN_VERSION
    from modeling.player_forecasts.io import read_json, write_json, write_jsonl
    def bundle(name, game, date, starter):
        # Synthetic contract fixtures; these do not authenticate a real database export.
        root = tmp_path / name
        root.mkdir()
        issued, settled = goalie_calibration_fixture(game, date, starter)
        write_jsonl(root / "forecasts.jsonl", issued)
        write_jsonl(root / "settled.jsonl", settled)
        write_json(root / "unresolved.json", [])
        manifest = {"version": JOIN_VERSION, "evidenceClassification": "captured_live", "gameId": game,
            "gameDate": date, "gameType": 2, "issuedTargetRows": 2, "settledTargetRows": 2,
            "inputs": {"forecastProvenance": {"status": "artifact_integrity_revision_links_and_pregame_timing_verified",
                "sourceOrigin": "immutable_database_records"}},
            "files": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in root.iterdir()}}
        write_json(root / "manifest.json", manifest)
        return root
    calibration = bundle("calibration", 1, "2026-10-10", 1)
    evaluation = bundle("evaluation", 2, "2026-10-12", 0)
    changed = bundle("changed", 2, "2026-10-12", 1)
    dates = dict(calibration_start="2026-10-10", calibration_end="2026-10-10",
        evaluation_start="2026-10-12", evaluation_end="2026-10-12")
    first = train_goalie_calibration([calibration, evaluation], tmp_path / "first", **dates)
    replay = train_goalie_calibration([calibration, evaluation], tmp_path / "replay", **dates)
    second = train_goalie_calibration([calibration, changed], tmp_path / "second", **dates)
    assert first == replay
    assert first["modelChecksum"] == second["modelChecksum"]
    assert first["models"] != second["models"]
    assert first["evaluatedGames"] == first["evaluatedSlates"] == 1
    assert first["prospectiveChallengerGames"] == 0 and not first["promotionEligible"]
    assert first["servingDecision"] == "retain_FORGE"
    rows = [json.loads(line) for line in (tmp_path / "first/evaluation.jsonl").read_text().splitlines()]
    assert sum(row["estimates"]["calibrated"] for row in rows) == pytest.approx(1)
    assert all(row["challengerEvidence"] == "retrospective_not_issued" and row["challengerIssuedAt"] is None for row in rows)
    assert all(path.stat().st_mode & 0o777 == 0o600 for path in (tmp_path / "first").iterdir())
    missing = train_goalie_calibration([evaluation], tmp_path / "missing", **dates)
    assert missing["status"] == "insufficient_evidence" and missing["evaluatedGames"] == 0
    with pytest.raises(ValueError, match="one frozen revision"):
        train_goalie_calibration([calibration, calibration], tmp_path / "duplicate", **dates)
    with pytest.raises(ValueError, match="chronological"):
        train_goalie_calibration([calibration], tmp_path / "overlap", **{**dates, "calibration_end": "2026-10-12"})
    # Re-hash a late-arriving label: checksum validity does not permit future information.
    records = [json.loads(line) for line in (calibration / "settled.jsonl").read_text().splitlines()]
    records[0]["settlement_received_at"] = "2026-10-12T15:00:00Z"
    _, checksum = write_jsonl(calibration / "settled.jsonl", records)
    manifest = read_json(calibration / "manifest.json")
    manifest["files"]["settled.jsonl"] = checksum
    write_json(calibration / "manifest.json", manifest)
    with pytest.raises(ValueError, match="arrived after"):
        train_goalie_calibration([calibration, evaluation], tmp_path / "late", **dates)
    (calibration / "settled.jsonl").write_text("corrupted")
    with pytest.raises(ValueError, match="checksum"):
        train_goalie_calibration([calibration, evaluation], tmp_path / "corrupt", **dates)


def test_daily_board_training_artifacts_keep_development_separate(tmp_path):
    from modeling.player_forecasts.daily_board_data import freeze_history
    from modeling.player_forecasts.daily_board_training import train_daily_baselines
    rows = [{"game_id": day, "game_date": f"2025-10-{day:02}", "player_id": 7,
        "team_id": 10, "opponent_team_id": 8, "season_id": 20252026, "position": "C", "population": "skater",
        "outcomes": {"toi": "20:00", "GOALS": day % 2, "ASSISTS": 1, "SHOTS_ON_GOAL": 3,
            "PP_POINTS": 0, "HITS": 2, "BLOCKED_SHOTS": 1}} for day in range(1, 13)]
    freeze_history(rows, tmp_path / "freeze", "2025-10-01", "2025-10-12")
    first = train_daily_baselines(tmp_path / "freeze", tmp_path / "first", development_end="2025-10-07",
        evaluation_start="2025-10-08", evaluation_end="2025-10-12")
    rows[-1]["outcomes"]["GOALS"] = 20
    freeze_history(rows, tmp_path / "changed-freeze", "2025-10-01", "2025-10-12")
    second = train_daily_baselines(tmp_path / "changed-freeze", tmp_path / "second", development_end="2025-10-07",
        evaluation_start="2025-10-08", evaluation_end="2025-10-12")
    a = json.loads((tmp_path / "first/baseline-policy.json").read_text())
    b = json.loads((tmp_path / "second/baseline-policy.json").read_text())
    assert a["selectionTrials"] == b["selectionTrials"]
    assert first["evaluatedGames"] == second["evaluatedGames"] == 5
    assert not first["promotionEligible"]
    assert first["reports"]["skater:GOALS"] != second["reports"]["skater:GOALS"]

from modeling.player_forecasts.daily_board import VERSION as DAILY_BOARD_VERSION, evaluate_daily_board, joint_fantasy_samples, crps


def daily_board_row(**changes):
    row = {"contractVersion": DAILY_BOARD_VERSION, "game_id": 1, "player_id": 7, "game_date": "2026-10-10", "game_type": 2,
        "target_key": "goals", "conditioning": "conditional_playing", "played": True,
        "historical_team_membership_verified": True, "snapshot_hash": "fixture-hash",
        "cutoff_at": "2026-10-10T12:00:00Z", "maximum_feature_available_at": "2026-10-10T11:00:00Z",
        "scheduled_start_at": "2026-10-10T23:00:00Z", "settlement_status": "final",
        "issued_at": "2026-10-10T12:01:00Z", "settlement_received_at": "2026-10-11T05:00:00Z", "settlement_hash": "fixture-settlement",
        "evidence_classification": "captured_live", "outcome": 1,
        "estimates": {"forge": 0.8, "season_rate": 0.5, "recent_season": 0.6, "role_aware": 0.7, "empirical_bayes": 0.75},
        "segments": {"position": "C", "rookie": False}, "samples": {"forge": [0, 1, 2]}}
    return {**row, **changes}


def daily_board_evaluate(rows):
    return evaluate_daily_board(rows, training_end="2026-10-01", validation_start="2026-10-02", validation_end="2026-10-31")


def test_daily_board_preserves_timing_holdout_and_conditioning():
    with pytest.raises(ValueError, match="future"):
        daily_board_evaluate([daily_board_row(maximum_feature_available_at="2026-10-10T13:00:00Z")])
    with pytest.raises(ValueError, match="issuance"):
        daily_board_evaluate([daily_board_row(issued_at=None)])
    with pytest.raises(ValueError, match="puck drop"):
        daily_board_evaluate([daily_board_row(issued_at="2026-10-10T23:00:00Z")])
    with pytest.raises(ValueError, match="protected"):
        daily_board_evaluate([daily_board_row(game_date="2026-02-10")])
    with pytest.raises(ValueError, match="training"):
        daily_board_evaluate([daily_board_row(trained_through="2026-10-15")])
    result = daily_board_evaluate([daily_board_row(played=False)])
    assert result["evaluatedRows"] == 0
    assert result["excluded"]["did_not_play_or_unknown"] == 1


def test_daily_board_evaluation_keeps_preseason_and_regular_season_separate():
    rows = [daily_board_row(), daily_board_row(game_id=2, game_type=1)]
    report = daily_board_evaluate(rows)
    assert report["gameType"] == 2 and report["evaluatedRows"] == 1
    assert report["excluded"]["different_game_type"] == 1
    assert report["prospectiveRegularSeasonEvidence"]["games"] == 1
    preseason = evaluate_daily_board(rows, training_end="2026-10-01", validation_start="2026-10-02", validation_end="2026-10-31", game_type=1)
    assert preseason["gameType"] == 1 and preseason["evaluatedRows"] == 1
    assert preseason["prospectiveRegularSeasonEvidence"]["games"] == 0
    with pytest.raises(ValueError, match="official game type"):
        daily_board_evaluate([daily_board_row(game_type=None)])


def test_daily_board_reports_reproducible_paired_and_segment_results():
    rows = [daily_board_row(), daily_board_row(game_id=2, player_id=8, outcome=0)]
    result = daily_board_evaluate(rows)
    assert result == daily_board_evaluate(rows)
    assert result["promotionEligible"] is False
    report = result["reports"]["goals:conditional_playing:captured_live"]
    assert report["models"]["forge"]["mae"] == pytest.approx(0.5)
    assert report["paired"]["season_rate"]["game"]["units"] == 2
    assert report["paired"]["season_rate"]["slate"]["units"] == 1
    assert report["segments"]["position"]["C"]["forge"]["rows"] == 2
    assert report["ablations"]["without_trend"]["rows"] == 0
    assert report["models"]["forge"]["distribution"]["coverage80"] == pytest.approx(0.5)
    assert result["evidence"] == {"targetRows": 2, "playerGames": 2, "games": 2, "slates": 1}
    assert report["evidence"] == result["evidence"]
    assert result["checkpointStatus"] == "unspecified"

    multi_target = daily_board_evaluate([daily_board_row(checkpoint="final_pregame"),
        daily_board_row(checkpoint="final_pregame", target_key="assists"),
        daily_board_row(checkpoint="final_pregame", player_id=8)])
    assert multi_target["evidence"] == {"targetRows": 3, "playerGames": 2, "games": 1, "slates": 1}
    assert multi_target["checkpointStatus"] == "declared"
    assert multi_target["checkpoint"] == "final_pregame"
    historical = daily_board_evaluate([daily_board_row(evidence_classification="historical_reconstruction")])
    assert historical["evidence"]["games"] == 1
    assert historical["prospectiveRegularSeasonEvidence"]["games"] == 0

    probabilities = [daily_board_row(player_id=i, target_key="participation", conditioning="probability", outcome=label)
        for i, label in enumerate([1, 1, 0])]
    for inputs, positives, negatives in [(probabilities[:2], 2, 0), (probabilities, 2, 1)]:
        probability = daily_board_evaluate(inputs)["reports"]["participation:probability:captured_live"]
        assert probability["probabilityLabels"] == {"positive": positives, "negative": negatives, "bothClassesObserved": negatives > 0}


def test_daily_board_never_fills_missing_comparators_with_zero():
    result = daily_board_evaluate([daily_board_row(estimates={"forge": 1})])
    assert result["evaluatedRows"] == 0
    assert result["excluded"]["missing_comparator_or_outcome"] == 1
    assert result["missingComparatorRows"] == {"season_rate": 1, "recent_season": 1, "role_aware": 1, "empirical_bayes": 1}
    assert result["prospectiveRegularSeasonEvidence"]["games"] == 0
    with pytest.raises(ValueError, match="duplicate"):
        daily_board_evaluate([daily_board_row(), daily_board_row()])
    with pytest.raises(ValueError, match="duplicate"):
        daily_board_evaluate([daily_board_row(estimates={"forge": 1}), daily_board_row(estimates={"forge": 1})])
    for change in [{"issued_at": "2026-10-10T12:02:00Z"}, {"snapshot_hash": "other-inputs"},
        {"cutoff_at": "2026-10-10T12:00:30Z"}, {"checkpoint": "other_checkpoint"},
        {"game_date": "2026-10-11"}]:
        with pytest.raises(ValueError, match="mixed decision checkpoints"):
            daily_board_evaluate([daily_board_row(checkpoint="final_pregame"),
                daily_board_row(**{"player_id": 8, "checkpoint": "final_pregame", **change})])
    with pytest.raises(ValueError, match="mixed decision checkpoints"):
        daily_board_evaluate([daily_board_row(checkpoint="final_pregame"), daily_board_row(game_id=2, checkpoint="daily_candidate_capture")])
    with pytest.raises(ValueError, match="invalid decision checkpoint"):
        daily_board_evaluate([daily_board_row(checkpoint=" ")])


def test_daily_board_review_cli_combines_games_privately_and_preserves_input_identity(tmp_path, monkeypatch):
    import hashlib
    from modeling.player_forecasts.daily_board import main
    from modeling.player_forecasts.io import write_jsonl
    sources = [tmp_path / "first.jsonl", tmp_path / "second.jsonl"]
    for game, path in enumerate(sources, 1):
        write_jsonl(path, [daily_board_row(game_id=game, checkpoint="final_pregame")])
    output = tmp_path / "review.json"
    args = ["review", "--input", str(sources[0]), "--input", str(sources[1]), "--output", str(output),
        "--training-end", "2026-10-01", "--validation-start", "2026-10-02", "--validation-end", "2026-10-31"]
    monkeypatch.setattr("sys.argv", args)
    main()
    report = json.loads(output.read_text())
    assert report["prospectiveRegularSeasonEvidence"] == {"targetRows": 2, "playerGames": 2, "games": 2, "slates": 1}
    assert report["inputFiles"] == [{"path": str(path.resolve()), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "rows": 1}
        for path in sources]
    assert len(report["evaluatorChecksum"]) == 64
    assert output.stat().st_mode & 0o777 == 0o600
    first = output.read_bytes()
    written_at = output.stat().st_mtime_ns
    main()
    assert output.read_bytes() == first
    assert output.stat().st_mtime_ns == written_at
    write_jsonl(sources[0], [daily_board_row(game_id=1, checkpoint="final_pregame", outcome=2)])
    with pytest.raises(ValueError, match="replace"):
        main()
    assert output.read_bytes() == first
    from modeling.player_forecasts.contract import repository_root
    monkeypatch.setattr("sys.argv", [*args[:6], str(repository_root() / "forbidden-review.json"), *args[7:]])
    with pytest.raises(RuntimeError, match="outside"):
        main()


def test_daily_board_scores_probabilities_and_keeps_reconstruction_separate():
    row = daily_board_row(target_key="participation", conditioning="probability", evidence_classification="historical_reconstruction")
    report = daily_board_evaluate([row])["reports"]["participation:probability:historical_reconstruction"]
    assert report["models"]["forge"]["brier"] == pytest.approx(0.04)
    assert report["models"]["forge"]["calibrationBins"][0]["rows"] == 1


def test_daily_board_scores_joint_draws_before_quantiles_and_checks_identities():
    assert joint_fantasy_samples([{"GOALS": 0, "ASSISTS": 3}, {"GOALS": 2, "ASSISTS": 0}], {"GOALS": 3, "ASSISTS": 2}) == [6, 6]
    assert crps([0, 2], 1) == pytest.approx(0.5)
    with pytest.raises(ValueError, match="missing"):
        joint_fantasy_samples([{"GOALS": 1}], {"ASSISTS": 2})
    with pytest.raises(ValueError, match="identity"):
        joint_fantasy_samples([{"SHOTS_AGAINST_GOALIE": 30, "SAVES_GOALIE": 29, "GOALS_AGAINST_GOALIE": 2}], {"SAVES_GOALIE": 0.2})


def joint_game_fixture():
    import copy
    teams = []
    for side, offset, team_id in (("home", 0, 10), ("away", 100, 8)):
        teams.append({"side": side, "teamId": team_id,
            "skaters": [{"playerId": offset + i, "hitsPerMinute": 0.02, "blocksPerMinute": 0.01,
                "strengths": {s: {"shotsPerMinute": 0.05, "goalProbability": 0.1, "assistWeight": 1} for s in ("EV", "PP", "PK")}} for i in range(1, 7)],
            "goalies": [{"playerId": offset + i, "goalOddsMultiplier": {s: 1 for s in ("EV", "PP", "PK")}} for i in (90, 91)],
            "assistCountProbabilities": {s: [0.1, 0.3, 0.6] for s in ("EV", "PP", "PK")}})
    first = {"probability": 0.5, "regulationMinutes": {"EV": 52, "homePP": 4, "awayPP": 4}}
    for side, offset in (("home", 0), ("away", 100)):
        first[side] = {"goalieId": offset + 90, "usage": [{"playerId": offset + i,
            "minutes": {"EV": 52, "PP": 4, "PK": 3.2}, "overtimeShare": 0.6} for i in range(1, 6)]}
    second = copy.deepcopy(first)
    second["home"]["usage"][0]["playerId"] = 6
    second["home"]["goalieId"] = 91
    return {"gameId": 2026020001, "gameDate": "2026-10-10", "gameType": 2,
        "scheduledStartAt": "2026-10-10T23:00:00Z", "cutoffAt": "2026-10-10T20:00:00Z",
        "maximumFeatureAvailableAt": "2026-10-10T19:00:00Z", "evidenceClassification": "controlled_fixture",
        "probabilityStatus": "controlled_fixture", "scenarioArtifactId": "controlled-joint-fixture",
        "policy": {"reliefAssumption": "none", "paceShape": 2, "overtimeShotRateMultiplier": 1.5, "homeShootoutWinProbability": 0.5},
        "teams": teams, "scenarios": [first, second]}


def test_daily_board_joint_scenarios_preserve_game_and_probability_accounting():
    from modeling.player_forecasts.daily_board_scenarios import simulate_game
    game = joint_game_fixture()
    result = simulate_game(game, seed=71, draws=500)
    assert result == simulate_game(game, seed=71, draws=500)
    assert result["distributionStatus"] == "unvalidated_research_only" and not result["promotionEligible"]
    starts = 0
    shot_pairs = []
    for draw in result["draws"]:
        players = draw["players"]
        scenario = game["scenarios"][draw["scenario"]]
        starts += int(players["90"]["TIME_ON_ICE_PER_GAME"] > 0)
        assert (players["1"]["TIME_ON_ICE_PER_GAME"] > 0) == (players["90"]["TIME_ON_ICE_PER_GAME"] > 0)
        assert sum(players[str(pid)]["WINS_GOALIE"] for pid in (90, 91, 190, 191)) == 1
        for team in game["teams"]:
            side = team["side"]
            other = "away" if side == "home" else "home"
            active = {p["playerId"] for p in scenario[side]["usage"]}
            skaters = [players[str(p["playerId"])] for p in team["skaters"]]
            assert sum(p["GOALS"] for p in skaters) == draw["hockeyGoals"][side]
            assert sum(p["ASSISTS"] for p in skaters) <= 2 * draw["hockeyGoals"][side]
            assert sum(p["TIME_ON_ICE_PER_GAME"] for p in skaters) == pytest.approx(296 + 3 * draw["overtimeMinutes"])
            for p in team["skaters"]:
                row = players[str(p["playerId"])]
                assert row["GOALS"] <= row["SHOTS_ON_GOAL"]
                assert row["PP_POINTS"] <= row["GOALS"] + row["ASSISTS"]
                assert row["PP_POINTS"] == row["PP_GOALS"] + row["PP_ASSISTS"]
                for category in ("GOALS", "ASSISTS", "SHOTS_ON_GOAL"):
                    assert row[category] == sum(row[f"{s}_{category}"] for s in ("EV", "PP", "PK"))
                assert row["TIME_ON_ICE_PER_GAME"] == pytest.approx(sum(row[f"{s}_TOI"] for s in ("EV", "PP", "PK")))
                assert row["TIME_ON_ICE_PER_GAME"] <= 60 + draw["overtimeMinutes"]
                if p["playerId"] not in active:
                    assert all(value == 0 for value in row.values())
            opposing_goalie = players[str(scenario[other]["goalieId"])]
            assert sum(p["SHOTS_ON_GOAL"] for p in skaters) == opposing_goalie["SHOTS_AGAINST_GOALIE"]
            assert opposing_goalie["SAVES_GOALIE"] + opposing_goalie["GOALS_AGAINST_GOALIE"] == opposing_goalie["SHOTS_AGAINST_GOALIE"]
            assert opposing_goalie["SHUTOUTS_GOALIE"] == int(draw["hockeyGoals"][side] == 0)
            assert opposing_goalie["TIME_ON_ICE_PER_GAME"] == 60 + draw["overtimeMinutes"]
            for goalie in team["goalies"]:
                if goalie["playerId"] != scenario[side]["goalieId"]:
                    assert all(v == 0 for v in players[str(goalie["playerId"])].values())
        shot_pairs.append(tuple(sum(players[str(p["playerId"])]["SHOTS_ON_GOAL"] for p in team["skaters"]) for team in game["teams"]))
    assert 0.43 < starts / 500 < 0.57
    # The single shared game-pace draw produces positive cross-team covariance.
    means = [sum(pair[i] for pair in shot_pairs) / len(shot_pairs) for i in (0, 1)]
    covariance = sum((a - means[0]) * (b - means[1]) for a, b in shot_pairs) / len(shot_pairs)
    assert covariance > 10


def test_daily_board_joint_scenarios_distinguish_shootouts_and_stop_overtime_on_goal():
    from modeling.player_forecasts.daily_board_scenarios import simulate_game
    game = joint_game_fixture()
    for team in game["teams"]:
        for p in team["skaters"]:
            for rates in p["strengths"].values():
                rates["goalProbability"] = 0
    result = simulate_game(game, seed=71, draws=1000)
    for draw in result["draws"]:
        assert draw["shootout"] and draw["overtimeMinutes"] == 5
        assert sum(draw["officialScore"].values()) == 1 and sum(draw["hockeyGoals"].values()) == 0
        assert all(p["GOALS"] == p["ASSISTS"] == 0 for p in draw["players"].values() if "GOALS" in p)
        assert sum(p["SHUTOUTS_GOALIE"] for p in draw["players"].values() if "SHUTOUTS_GOALIE" in p) == 2
    # 50% participation × (59.2 regulation minutes + 3 OT minutes) ×
    # 0.05 shots/minute; the OT shot-rate multiplier is separately 1.5.
    expected_shots = 0.5 * (59.2 * 0.05 + 3 * 0.05 * 1.5)
    observed_shots = sum(d["players"]["1"]["SHOTS_ON_GOAL"] for d in result["draws"]) / 1000
    assert observed_shots == pytest.approx(expected_shots, abs=0.2)
    for team in game["teams"]:
        for p in team["skaters"]:
            for rates in p["strengths"].values():
                rates["goalProbability"] = 1
    result = simulate_game(game, seed=19, draws=500)
    overtime = [d for d in result["draws"] if 0 < d["overtimeMinutes"] < 5]
    assert overtime
    assert all(not d["shootout"] and abs(d["hockeyGoals"]["home"] - d["hockeyGoals"]["away"]) == 1 for d in overtime)
    changed_goalie = joint_game_fixture()
    changed_goalie["teams"][0]["goalies"][1]["goalOddsMultiplier"] = {s: 4 for s in ("EV", "PP", "PK")}
    result = simulate_game(changed_goalie, seed=71, draws=1000)
    conceded = {pid: [d["players"][pid]["GOALS_AGAINST_GOALIE"] for d in result["draws"] if d["players"][pid]["TIME_ON_ICE_PER_GAME"] > 0] for pid in ("90", "91")}
    assert sum(conceded["91"]) / len(conceded["91"]) > 1.5 * sum(conceded["90"]) / len(conceded["90"])


def test_daily_board_joint_scenarios_reject_incomplete_or_inconsistent_inputs():
    import copy
    from modeling.player_forecasts.daily_board_scenarios import simulate_game
    base = joint_game_fixture()
    mutations = [
        (lambda g: g.update(maximumFeatureAvailableAt="2026-10-10T21:00:00Z"), "future"),
        (lambda g: g.update(probabilityStatus="parser_confidence"), "modeled participation"),
        (lambda g: g["scenarios"][0].update(probability=None), "probabilities"),
        (lambda g: g["scenarios"][0].update(probability=0.4), "sum to one"),
        (lambda g: g["scenarios"][0]["home"].update(goalieId=190), "team candidate"),
        (lambda g: g["scenarios"][0]["home"]["usage"][0]["minutes"].update(EV=51), "team strength"),
        (lambda g: g["scenarios"][0]["home"]["usage"][0].update(overtimeShare=0), "three skaters"),
        (lambda g: g["teams"][0]["skaters"][0]["strengths"]["EV"].update(shotsPerMinute=None), "strength rates"),
        (lambda g: g["policy"].update(reliefAssumption=None), "no-relief"),
        (lambda g: g.update(gameDate="2026-01-03"), "protected"),
    ]
    for mutate, message in mutations:
        game = copy.deepcopy(base)
        mutate(game)
        with pytest.raises(ValueError, match=message):
            simulate_game(game, seed=1, draws=1)


def test_daily_board_joint_scenario_artifacts_score_complete_draws_and_stay_private(tmp_path, monkeypatch):
    from modeling.player_forecasts.daily_board_scenarios import write_game_scenarios
    game = joint_game_fixture()
    source = tmp_path / "source.json"
    source.write_text(json.dumps(game))
    weights = {"skater": {"GOALS": 3, "ASSISTS": 2, "PP_POINTS": 1, "SHOTS_ON_GOAL": 0.2, "HITS": 0.2, "BLOCKED_SHOTS": 0.25},
        "goalie": {"SAVES_GOALIE": 0.2, "GOALS_AGAINST_GOALIE": -1, "WINS_GOALIE": 3, "SHUTOUTS_GOALIE": 2}}
    a = write_game_scenarios(source, tmp_path / "a", seed=19, draws=100, weights=weights)
    b = write_game_scenarios(source, tmp_path / "b", seed=19, draws=100, weights=weights)
    assert a == b and (tmp_path / "a/draws.jsonl").read_bytes() == (tmp_path / "b/draws.jsonl").read_bytes()
    assert a["players"]["1"]["participationProbability"] == a["players"]["90"]["goalieStartProbability"] == 0.5
    assert a["players"]["191"]["fantasyMean"] == a["players"]["191"]["goalieStartProbability"] == 0
    draws = [json.loads(line) for line in (tmp_path / "a/draws.jsonl").read_text().splitlines()]
    values = joint_fantasy_samples([d["players"]["1"] for d in draws], weights["skater"])
    assert a["players"]["1"]["fantasyMean"] == pytest.approx(sum(values) / len(values))
    assert (tmp_path / "a").stat().st_mode & 0o777 == 0o700
    assert all(p.stat().st_mode & 0o777 == 0o600 for p in (tmp_path / "a").iterdir())
    weights["skater"]["PENALTY_MINUTES"] = 1
    with pytest.raises(ValueError, match="missing"):
        write_game_scenarios(source, tmp_path / "unsupported", seed=19, draws=1, weights=weights)
    assert not (tmp_path / "unsupported").exists()
    game.update(evidenceClassification="captured_live", probabilityStatus="modeled", gameDate="2025-10-10",
        cutoffAt="2025-10-10T20:00:00Z", maximumFeatureAvailableAt="2025-10-10T19:00:00Z", scheduledStartAt="2025-10-10T23:00:00Z")
    source.write_text(json.dumps(game))
    with pytest.raises(ValueError, match="before puck drop"):
        write_game_scenarios(source, tmp_path / "late", seed=19, draws=1, weights=weights)
    assert not (tmp_path / "late").exists()
    from datetime import datetime
    from unittest.mock import Mock
    from modeling.player_forecasts import daily_board_scenarios
    weights["skater"].pop("PENALTY_MINUTES")
    for stage, instants in (("during_data", ["20:00:00", "23:00:01"]), ("during_report", ["20:00:00", "22:59:59", "23:00:01"])):
        clock = Mock()
        clock.now.side_effect = [datetime.fromisoformat(f"2025-10-10T{instant}+00:00") for instant in instants]
        monkeypatch.setattr(daily_board_scenarios, "datetime", clock)
        with pytest.raises(ValueError, match="publication passed puck drop"):
            write_game_scenarios(source, tmp_path / stage, seed=19, draws=1, weights=weights)
        assert not (tmp_path / stage / "report.json").exists()

from modeling.player_forecasts.contract import (
    ADVANCED_SEASON_CONTRACT_SHA256,
    ADVANCED_SEASON_CONTRACT_VERSION,
    CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_VERSION,
    SEASON_CONTRACT_SHA256,
    VALIDATION_CONTRACT_SHA256,
    load_and_verify_contract,
)
from modeling.player_forecasts.advanced import (
    GOALIE_ADVANCED_TARGETS,
    SKATER_ADVANCED_TARGETS,
    TEAM_ADVANCED_TARGETS,
    _advanced_reconcile,
    _build_edge_contexts,
    _reconciled_quantiles,
    _simulation_quantiles,
    build_advanced_settlement_bundle,
    evaluate_advanced_batch,
    evaluate_fantasy_batch,
    freeze_advanced_sources,
)
from modeling.player_forecasts.contract import load_and_verify_validation_contract
from modeling.player_forecasts.contract import load_and_verify_season_contract
from modeling.player_forecasts.aggregation import aggregate_rest_of_season
from modeling.player_forecasts.challenger_math import (
    assist_candidate_features,
    fit_hierarchical_hits,
    fit_horizon_residual_quantiles,
    hierarchical_hits_prediction,
    official_assist_expectation,
)
from modeling.player_forecasts.challenger_features import build_validation_features
from modeling.player_forecasts.challenger_inference import infer_conditional_game
from modeling.player_forecasts.challenger_model import verify_validation_challenger_artifact
from modeling.player_forecasts.features import build_features, parse_toi
from modeling.player_forecasts.horizons import reconstructed_vintages, team_schedules
from modeling.player_forecasts import freeze as freeze_module
from modeling.player_forecasts import season as season_module
from modeling.player_forecasts.freeze import freeze_prospective_dataset
from modeling.player_forecasts.io import canonical_json, read_json, read_jsonl, write_json
from modeling.player_forecasts.lockbox import evaluate_lockbox_once, evaluate_prospective_once
from modeling.player_forecasts.model import train_baseline
from modeling.player_forecasts.season import (
    _adjusted_defense_ratings,
    _assist_label_audit,
    _actuals_by_player,
    _fit_context_profile,
    _fit_penalized_negative_binomial_glm,
    _fit_penalized_rate_glm,
    _fit_regularized_hurdle_glm,
    _glm_prediction,
    _hurdle_prediction,
    _deployment_evidence,
    _normalized_role_probabilities,
    _official_landing_assist_labels,
    _roster_adjusted_team_contexts,
    _official_game_status,
    _portable_canonical_json,
    _quantiles,
    _reconcile,
    _schedule_contexts_by_team,
    _season_player_fallback_flags,
    _select_rate_policy,
    _team_contexts,
    _target_multiplier,
    _weighted_exposure_summary,
    evaluate_season_game,
    freeze_season_dataset,
)
from modeling.player_forecasts.rookies import (
    capture_player_landings,
    evaluate_rookie_transition_model,
    learn_rookie_transition_model,
    normalize_player_landing,
    rookie_projection_profile,
)


def _jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(f"{json.dumps(row)}\n" for row in rows), encoding="utf-8")


def _freeze(tmp_path: Path) -> Path:
    write_json(tmp_path / "manifest.json", {"contractChecksum": CONTRACT_SHA256, "files": {}})
    _jsonl(tmp_path / "skaters.jsonl", [
        {"game_date": "2025-12-01", "season_id": 20252026, "game_id": 1, "player_id": 10, "position": "C", "goals": 1, "assists": 0, "shots_on_goal": 3, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "18:00"},
        {"game_date": "2025-12-03", "season_id": 20252026, "game_id": 2, "player_id": 10, "position": "C", "goals": 0, "assists": 1, "shots_on_goal": 2, "blocked_shots": 1, "hits": 2, "penalty_minutes": 2, "toi": "17:30"},
        {"game_date": "2026-01-04", "season_id": 20252026, "game_id": 3, "player_id": 10, "position": "C", "goals": 1, "assists": 1, "shots_on_goal": 4, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "19:00"},
    ])
    _jsonl(tmp_path / "goalies.jsonl", [])
    features = build_features(tmp_path)
    manifest = read_json(tmp_path / "manifest.json")
    manifest["features"] = features
    write_json(tmp_path / "manifest.json", manifest)
    train_baseline(tmp_path)
    return tmp_path


def test_contract_checksum_is_bound_to_canonical_document():
    assert load_and_verify_contract()["contractVersion"] == "player-forecasts-research-v1"


def test_validation_contract_preserves_consumed_lockbox():
    contract = load_and_verify_validation_contract()
    assert contract["evidencePolicy"]["consumedPrimaryLockbox"]["additionalEvaluationsAllowed"] == 0
    assert contract["acceptance"]["promotionEligible"] is False


def test_season_contract_preserves_raw_assist_identity_and_zero_cost_boundary():
    contract = load_and_verify_season_contract()
    assert contract["seasonGamesPerTeam"] == 84
    assert contract["targets"]["derived"]["ASSISTS"] == "PRIMARY_ASSISTS + SECONDARY_ASSISTS"
    assert contract["targets"]["assistPolicy"].endswith("fixed 70:30 and 80:20 weighting is prohibited.")
    settled = contract["evidencePolicy"]["settledOutcomeLabels"]
    assert settled[0]["source"] == "WGO"
    assert "predictive feature" in settled[0]["scope"]
    assert "WGO" not in contract["evidencePolicy"]["excludedWithoutSeparateApproval"]
    assert contract["security"]["cronCanEditOrPublish"] is False


def test_season_team_query_uses_current_utah_mammoth_identity():
    assert "54, 55, 68" in season_module.TEAM_QUERY
    assert "54, 55, 59" not in season_module.TEAM_QUERY


def test_v4_season_contract_requires_learned_rookie_translations():
    contract = load_and_verify_season_contract(FANTASY_SEASON_CONTRACT_VERSION)
    assert contract["rookieModel"]["layers"] == [
        "nhl_roster_probability",
        "expected_nhl_games",
        "conditional_deployment_and_toi",
        "conditional_nhl_rate",
    ]
    assert "chronologically learned" in contract["rookieModel"]["translation"]
    assert contract["modeling"]["sourceEligibility"] == (
        season_module.FANTASY_SOURCE_ELIGIBILITY_POLICY
    )
    assert contract["modeling"]["sourceEligibility"]["minimumEligibleValidationFolds"] == 2


def test_team_contexts_return_schedule_neutral_ratings():
    teams = [
        {"team_id": 1, "abbreviation": "NJD", "name": "New Jersey"},
        {"team_id": 2, "abbreviation": "NYI", "name": "Islanders"},
    ]
    rows = [
        {
            "season_id": 20252026,
            "team_id": 1,
            "opponent_team_id": 2,
            "goals_for": 4,
            "goals_against": 2,
            "shots_for": 32,
            "shots_against": 28,
            "pp_goals": 1,
            "pp_opportunities": 3,
            "pk_goals_against": 0,
            "pk_opportunities": 2,
        },
        {
            "season_id": 20252026,
            "team_id": 2,
            "opponent_team_id": 1,
            "goals_for": 2,
            "goals_against": 4,
            "shots_for": 28,
            "shots_against": 32,
            "pp_goals": 0,
            "pp_opportunities": 2,
            "pk_goals_against": 1,
            "pk_opportunities": 3,
        },
    ]
    contexts = _team_contexts(rows, teams)
    assert set(contexts) == {"1", "2"}
    assert contexts["1"]["ratings"]["overall"] > contexts["2"]["ratings"]["overall"]
    assert contexts["1"]["sampleGames"] == 1


def test_rookie_model_learns_league_transitions_and_separates_roster_probability():
    captures = []
    for player_id in range(100, 140):
        made_nhl = player_id % 2 == 0
        totals = [{
            "season": 20232024,
            "league": "AHL",
            "teamName": "Affiliate",
            "gamesPlayed": 60,
            "goals": 20,
            "assists": 30,
            "points": 50,
            "penaltyMinutes": 40,
            "plusMinus": 0,
        }]
        if made_nhl:
            totals.append({
                "season": 20242025,
                "league": "NHL",
                "teamName": "NHL Club",
                "gamesPlayed": 40,
                "goals": 8,
                "assists": 12,
                "points": 20,
                "penaltyMinutes": 16,
                "plusMinus": 0,
            })
        captures.append({
            "nhlPlayerId": player_id,
            "position": "C",
            "birthDate": "2002-01-01",
            "draftOverall": 64,
            "seasonTotals": totals,
        })
    model = learn_rookie_transition_model(captures)
    assert model["transitionCount"] == 40
    assert 0 < model["leagues"]["AHL"]["rosterProbability"] < 1
    assert 0 < model["leagues"]["AHL"]["equivalencyFactors"]["GOALS"] < 1

    prospect = {
        "nhlPlayerId": 999,
        "position": "C",
        "birthDate": "2003-01-01",
        "draftOverall": 80,
        "seasonTotals": [{
            "season": 20252026,
            "league": "AHL",
            "teamName": "Affiliate",
            "gamesPlayed": 65,
            "goals": 22,
            "assists": 28,
            "points": 50,
            "penaltyMinutes": 30,
            "plusMinus": 5,
        }],
    }
    profile = rookie_projection_profile(prospect, model)
    assert profile["rookie"] is True
    assert 0 < profile["rosterProbability"] < 1
    assert 0 < profile["expectedNhlGames"] <= 84
    assert profile["translatedConditionalRates"]["GOALS"] > 0
    assert profile["nhleMethod"] == "historical_league_transition_empirical_bayes_v1"


def test_rookie_validation_retains_generic_prior_when_holdout_support_is_missing():
    report = evaluate_rookie_transition_model([])
    assert report["eligibleForServing"] is False
    assert report["sufficientSupport"] is False
    assert report["fallbackPolicy"] == "retain_generic_prior_with_wider_uncertainty"


def test_rookie_capture_resume_reuses_verified_rows_and_retries_only_failures(
    tmp_path,
    monkeypatch,
):
    season_freeze = tmp_path / "season"
    season_freeze.mkdir()
    player_pool = [
        {"nhl_player_id": 1},
        {"nhl_player_id": 2},
    ]
    write_json(season_freeze / "player-pool.json", player_pool)
    player_pool_checksum = hashlib.sha256(
        (season_freeze / "player-pool.json").read_bytes()
    ).hexdigest()
    write_json(season_freeze / "manifest.json", {
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "files": {
            "player_pool": {
                "path": "player-pool.json",
                "sha256": player_pool_checksum,
            },
        },
    })

    attempts: list[int] = []

    def capture(player_id, fetched_at):
        attempts.append(player_id)
        if player_id == 2 and attempts.count(2) == 1:
            raise OSError("transient")
        return {
            "nhlPlayerId": player_id,
            "position": "C",
            "birthDate": "2003-01-01",
            "draftOverall": 50,
            "fetchedAt": fetched_at,
            "availableAt": fetched_at,
            "seasonTotals": [],
        }

    monkeypatch.setattr("modeling.player_forecasts.rookies._capture_one", capture)
    first = tmp_path / "first"
    first_result = capture_player_landings(season_freeze, first, max_workers=1)
    assert first_result["complete"] is False
    assert first_result["capturedPlayers"] == 1

    second = tmp_path / "second"
    second_result = capture_player_landings(
        season_freeze,
        second,
        max_workers=1,
        base_freeze=first,
    )
    assert second_result["complete"] is True
    assert second_result["requestedFromNetwork"] == 1
    assert second_result["reusedPlayers"] == 1
    assert attempts == [1, 2, 2]


def test_advanced_freeze_rejects_an_unapproved_v4_receipt(tmp_path):
    receipt = tmp_path / "receipt.json"
    write_json(receipt, {
        "schemaVersion": "player-forecast-fantasy-v4-evaluation-v1",
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": "invalid",
        "eligibleForAdvancedBatch": True,
        "receiptHash": "0" * 64,
    })
    with pytest.raises(RuntimeError, match="passing checksum-bound v4 receipt"):
        freeze_advanced_sources("postgresql://unused", tmp_path / "advanced", [], receipt)


def test_nhl_edge_context_is_cutoff_safe_and_never_a_projected_total(tmp_path):
    freeze = tmp_path / "edge"
    freeze.mkdir()
    _jsonl(freeze / "edge_skater_context.jsonl", [
        {
            "snapshot_date": "2026-04-16",
            "player_id": 1001,
            "games_played": 82,
            "top_shot_speed_mph": 99.5,
            "source_url": "https://www.nhl.com/edge",
            "source_available_at": "2026-05-01T12:00:00+00:00",
        },
        {
            "snapshot_date": "2026-04-16",
            "player_id": 1001,
            "games_played": 82,
            "top_shot_speed_mph": 101.0,
            "source_url": "https://www.nhl.com/edge",
            "source_available_at": "2026-09-01T12:00:00+00:00",
        },
    ])
    _jsonl(freeze / "edge_goalie_context.jsonl", [{
        "snapshot_date": "2026-04-16",
        "goalie_id": 2001,
        "games_played": 52,
        "all_save_pct": 0.918,
        "source_url": "https://www.nhl.com/edge",
        "source_available_at": "2026-05-01T12:00:00+00:00",
    }])
    _jsonl(freeze / "edge_team_context.jsonl", [{
        "snapshot_date": "2026-04-16",
        "team_id": 1,
        "games_played": 82,
        "max_skating_speed_mph": 24.1,
        "source_url": "https://www.nhl.com/edge",
        "source_available_at": "2026-05-01T12:00:00+00:00",
    }])
    contexts = _build_edge_contexts(
        freeze,
        {
            10: {"nhlPlayerId": 1001},
            20: {"nhlPlayerId": 2001},
        },
        "2026-08-20T12:00:00+00:00",
    )
    assert contexts["players"]["10"]["metrics"]["top_shot_speed_mph"] == 99.5
    assert contexts["players"]["20"]["metrics"]["all_save_pct"] == 0.918
    assert contexts["teams"]["1"]["metrics"]["max_skating_speed_mph"] == 24.1
    assert contexts["coverage"]["excludedPostCutoffRows"] == 1
    assert contexts["players"]["10"]["usage"] == (
        "cutoff_safe_feature_context_not_projected_total"
    )


def test_v5_contract_and_derived_advanced_metrics_reconcile():
    contract = load_and_verify_season_contract(ADVANCED_SEASON_CONTRACT_VERSION)
    assert contract["contractVersion"] == ADVANCED_SEASON_CONTRACT_VERSION
    assert contract["metricSet"] == "advanced-v5"
    assert contract["targets"]["skaterIndividualPrimitive"] == list(
        SKATER_ADVANCED_TARGETS[:11]
    )
    assert contract["targets"]["teamPrimitive"] == list(TEAM_ADVANCED_TARGETS)

    skater = _advanced_reconcile({
        "EXPECTED_PRIMARY_ASSISTS": 24,
        "EXPECTED_SECONDARY_ASSISTS": 16,
        "ON_ICE_SHOT_ATTEMPTS_FOR": 600,
        "ON_ICE_SHOT_ATTEMPTS_AGAINST": 400,
        "ON_ICE_UNBLOCKED_ATTEMPTS_FOR": 450,
        "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST": 350,
        "ON_ICE_EXPECTED_GOALS_FOR": 60,
        "ON_ICE_EXPECTED_GOALS_AGAINST": 40,
    }, "forward")
    assert skater["EXPECTED_ASSISTS"] == 40
    assert skater["ON_ICE_CF_PERCENTAGE"] == pytest.approx(0.6)
    assert skater["ON_ICE_FF_PERCENTAGE"] == pytest.approx(0.5625)
    assert skater["ON_ICE_XGF_PERCENTAGE"] == pytest.approx(0.6)

    goalie = _advanced_reconcile({
        "EXPECTED_GOALS_AGAINST_GOALIE": 150,
        "GOALS_AGAINST_GOALIE": 140,
        "HIGH_DANGER_SHOTS_AGAINST_GOALIE": 100,
        "HIGH_DANGER_GOALS_AGAINST_GOALIE": 20,
    }, "goalie")
    assert goalie["GOALS_SAVED_ABOVE_EXPECTED"] == 10
    assert goalie["HIGH_DANGER_SAVES_GOALIE"] == 80
    assert goalie["HIGH_DANGER_SAVE_PERCENTAGE_GOALIE"] == pytest.approx(0.8)

    low, median, high = _reconciled_quantiles(
        {"EXPECTED_PRIMARY_ASSISTS": 20, "EXPECTED_SECONDARY_ASSISTS": 10},
        {"EXPECTED_PRIMARY_ASSISTS": 25, "EXPECTED_SECONDARY_ASSISTS": 15},
        {"EXPECTED_PRIMARY_ASSISTS": 30, "EXPECTED_SECONDARY_ASSISTS": 20},
        "forward",
    )
    assert low["EXPECTED_ASSISTS"] <= median["EXPECTED_ASSISTS"] <= high["EXPECTED_ASSISTS"]


def test_v5_correlated_simulation_reconciles_each_draw_and_is_deterministic():
    means = {
        "GAMES_PLAYED": 80,
        "EV_GOALS": 20,
        "PP_GOALS": 8,
        "SH_GOALS": 1,
        "EMPTY_NET_GOALS": 1,
        "EV_PRIMARY_ASSISTS": 24,
        "PP_PRIMARY_ASSISTS": 8,
        "SH_PRIMARY_ASSISTS": 1,
        "EN_PRIMARY_ASSISTS": 1,
        "EV_SECONDARY_ASSISTS": 18,
        "PP_SECONDARY_ASSISTS": 6,
        "SH_SECONDARY_ASSISTS": 1,
        "EN_SECONDARY_ASSISTS": 1,
        "SHOTS_ON_GOAL": 250,
        "EXPECTED_PRIMARY_ASSISTS": 35,
        "EXPECTED_SECONDARY_ASSISTS": 25,
    }
    variances = {target: max(1.0, value) for target, value in means.items()}
    first = _simulation_quantiles(
        means,
        variances,
        "reconciled-seed",
        "forward",
        maximum_games=84,
        draws=300,
    )
    second = _simulation_quantiles(
        means,
        variances,
        "reconciled-seed",
        "forward",
        maximum_games=84,
        draws=300,
    )
    assert first == second
    low, median, high = first
    assert high["GAMES_PLAYED"] <= 84
    assert low["POINTS"] <= median["POINTS"] <= high["POINTS"]
    assert high["POINTS"] < high["GOALS"] + high["ASSISTS"]


def test_v5_evaluation_receipt_requires_every_advanced_target(tmp_path):
    artifact_dir = tmp_path / "advanced-artifact"
    artifact_dir.mkdir()
    required = {
        "forward": SKATER_ADVANCED_TARGETS,
        "defense": SKATER_ADVANCED_TARGETS,
        "goalie": GOALIE_ADVANCED_TARGETS,
        "team": TEAM_ADVANCED_TARGETS,
    }
    policies = {
        population: {
            target: {
                "validationMae": 0.9,
                "baselineMae": 1.0,
                "calibration80Coverage": 0.8,
                "calibrationObservedCoverage": 0.8,
                "sourceGameCoverage": 1.0,
                "eligibleForServing": True,
            }
            for target in targets
        }
        for population, targets in required.items()
    }
    vector_input = {"players": [1, 2, 3], "teams": [1, 2]}
    artifact = {
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "targetPolicies": policies,
        "goldenVectors": [{
            "input": vector_input,
            "expectedHash": hashlib.sha256(
                canonical_json(vector_input).encode()
            ).hexdigest(),
        }],
        "review": {"sourceAudit": {"eligibleForFreeze": True}},
    }
    write_json(artifact_dir / "season-artifact.json", artifact)
    checksum = hashlib.sha256(
        (artifact_dir / "season-artifact.json").read_bytes()
    ).hexdigest()
    write_json(artifact_dir / "artifact-manifest.json", {
        "artifactChecksum": checksum,
    })

    receipt = evaluate_advanced_batch(
        artifact_dir,
        tmp_path / "advanced-receipt.json",
    )
    assert receipt["eligibleForRelease"] is True
    assert receipt["blockers"] == []
    assert len(receipt["targetResults"]) == sum(map(len, required.values()))
    assert receipt["evidencePolicy"].startswith("2025-26 is validation/training")


def test_v5_settlement_merges_cutoff_safe_advanced_actuals(tmp_path):
    game_id = 2026020001
    base = tmp_path / "base-settlement"
    base.mkdir()
    base_rows = []
    for fhfh_id, nhl_id, population, values in (
        (
            1,
            1001,
            "forward",
            {"GAMES_PLAYED": 1, "GOALS": 1, "PRIMARY_ASSISTS": 1, "SECONDARY_ASSISTS": 0},
        ),
        (
            2,
            2001,
            "goalie",
            {"GAMES_PLAYED": 1, "GOALS_AGAINST_GOALIE": 1},
        ),
    ):
        unsigned = {
            "gameId": game_id,
            "fhfhPlayerId": fhfh_id,
            "nhlPlayerId": nhl_id,
            "population": population,
            "primitiveValues": values,
            "observedAt": "2026-10-02T07:00:00+00:00",
            "availableAt": "2026-10-02T07:00:00+00:00",
            "eligibleFinality": "provisional",
            "source": "nhl_gamecenter_normalized_from_immutable_capture",
            "sourceRevisionKey": f"base-{fhfh_id}",
        }
        base_rows.append({
            **unsigned,
            "revisionHash": hashlib.sha256(
                _portable_canonical_json(unsigned).encode()
            ).hexdigest(),
            "provenance": {},
        })
    _jsonl(base / "outcomes.jsonl", base_rows)
    base_manifest = {
        "schemaVersion": "player-forecast-season-settlement-v1",
        "createdAt": "2026-10-02T10:00:00+00:00",
        "seasonId": 20262027,
        "cutoffAt": "2026-10-02T10:00:00+00:00",
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": FANTASY_SEASON_CONTRACT_SHA256,
        "scheduleRevisionHash": "schedule",
        "outcomes": {
            "path": "outcomes.jsonl",
            "rows": len(base_rows),
            "sha256": hashlib.sha256((base / "outcomes.jsonl").read_bytes()).hexdigest(),
        },
        "completedGames": [{
            "gameId": game_id,
            "availableAt": "2026-10-02T07:00:00+00:00",
            "finality": "provisional",
        }],
        "skippedUnmappedNhlPlayerIds": [],
    }
    base_manifest["bundleHash"] = hashlib.sha256(
        _portable_canonical_json(base_manifest).encode()
    ).hexdigest()
    write_json(base / "settlement-manifest.json", base_manifest)

    advanced = tmp_path / "advanced-freeze"
    advanced.mkdir()
    source_time = "2026-10-02T08:00:00+00:00"
    sources = {
        "player_on_ice": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "player_id": 1001,
            "team_id": 1,
            "on_ice_shot_attempts_for": 10,
            "on_ice_shot_attempts_against": 8,
            "on_ice_unblocked_attempts_for": 7,
            "on_ice_unblocked_attempts_against": 6,
            "on_ice_expected_goals_for": 1.2,
            "on_ice_expected_goals_against": 0.8,
            "source_available_at": source_time,
        }],
        "team_xg": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "team_id": 1,
            "opponent_team_id": 2,
            "xg_for": 2.5,
            "xg_against": 2.0,
            "source_available_at": source_time,
        }],
        "shot_features": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "event_owner_team_id": 1,
            "shooter_player_id": 1001,
            "goalie_in_net_id": 2001,
            "is_goal": True,
            "is_shot_on_goal": True,
            "is_unblocked_shot_attempt": True,
            "is_rebound_shot": False,
            "is_rush_shot": True,
            "shot_distance_feet": 15,
            "is_penalty_shot_event": False,
            "is_shootout_event": False,
            "is_empty_net_event": False,
            "source_available_at": source_time,
        }],
        "shot_predictions": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "event_owner_team_id": 1,
            "shooter_player_id": 1001,
            "model_version": "xg-v1",
            "prediction_type": "shot_goal",
            "xg": 0.25,
            "source_available_at": source_time,
        }],
        "player_rebounds": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "player_id": 1001,
            "team_id": 1,
            "expected_rebounds_created": 0.2,
            "source_available_at": source_time,
        }],
        "goalie_xg": [{
            "season_id": 20262027,
            "game_id": game_id,
            "game_date": "2026-10-01",
            "goalie_player_id": 2001,
            "team_id": 2,
            "xg_against": 0.25,
            "source_available_at": source_time,
        }],
    }
    files = {}
    for name, rows in sources.items():
        path = advanced / f"{name}.jsonl"
        _jsonl(path, rows)
        files[name] = {
            "path": path.name,
            "rows": len(rows),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    source_audit = {
        "eligibleForFreeze": True,
        "approvedModels": [{
            "prediction_type": "shot_goal",
            "model_version": "xg-v1",
            "is_champion": True,
        }],
    }
    write_json(advanced / "source-audit.json", source_audit)
    advanced_manifest = {
        "schemaVersion": "player-forecast-advanced-source-freeze-v1",
        "createdAt": source_time,
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "historySeasons": [20262027],
        "sourceAudit": {
            "path": "source-audit.json",
            "sha256": hashlib.sha256((advanced / "source-audit.json").read_bytes()).hexdigest(),
        },
        "files": files,
    }
    advanced_manifest["manifestHash"] = hashlib.sha256(
        canonical_json(advanced_manifest).encode()
    ).hexdigest()
    write_json(advanced / "manifest.json", advanced_manifest)

    result = build_advanced_settlement_bundle(
        base,
        advanced,
        tmp_path / "v5-settlement",
    )
    assert result["contractVersion"] == ADVANCED_SEASON_CONTRACT_VERSION
    assert result["advancedPendingGameIds"] == []
    settled = list(read_jsonl(tmp_path / "v5-settlement" / "outcomes.jsonl"))
    skater = next(row for row in settled if row["population"] == "forward")
    goalie = next(row for row in settled if row["population"] == "goalie")
    assert skater["primitiveValues"]["SHOT_ATTEMPTS"] == 1
    assert skater["primitiveValues"]["UNBLOCKED_SHOT_ATTEMPTS"] == 1
    assert skater["primitiveValues"]["EXPECTED_GOALS"] == pytest.approx(0.25)
    assert skater["primitiveValues"]["EXPECTED_PRIMARY_ASSISTS"] == 1
    assert goalie["primitiveValues"]["EXPECTED_GOALS_AGAINST_GOALIE"] == pytest.approx(0.25)
    assert goalie["primitiveValues"]["HIGH_DANGER_SHOTS_AGAINST_GOALIE"] == 1
    assert season_module.verify_season_settlement_bundle(
        tmp_path / "v5-settlement"
    )["valid"] is True

    sources["player_on_ice"][0]["source_available_at"] = (
        "2026-10-02T11:00:00+00:00"
    )
    player_on_ice_path = advanced / "player_on_ice.jsonl"
    _jsonl(player_on_ice_path, sources["player_on_ice"])
    files["player_on_ice"]["sha256"] = hashlib.sha256(
        player_on_ice_path.read_bytes()
    ).hexdigest()
    advanced_manifest["files"] = files
    advanced_manifest.pop("manifestHash", None)
    advanced_manifest["manifestHash"] = hashlib.sha256(
        canonical_json(advanced_manifest).encode()
    ).hexdigest()
    write_json(advanced / "manifest.json", advanced_manifest)
    held = build_advanced_settlement_bundle(
        base,
        advanced,
        tmp_path / "v5-settlement-held",
    )
    assert held["advancedPendingGameIds"] == [game_id]
    assert held["outcomes"]["rows"] == 0


def test_v4_batch_receipt_reports_target_and_rookie_gates(tmp_path):
    artifact_dir = tmp_path / "artifact"
    artifact_dir.mkdir()
    policies = {}
    for population, targets in {
        "forward": season_module.SKATER_TARGETS + season_module.SKATER_FANTASY_V4_TARGETS,
        "defense": season_module.SKATER_TARGETS + season_module.SKATER_FANTASY_V4_TARGETS,
        "goalie": season_module.GOALIE_TARGETS + season_module.GOALIE_FANTASY_V4_TARGETS,
    }.items():
        policies[population] = {
            target: {
                "rows": 100,
                "players": 20,
                "modelFamily": "empirical_bayes_rate",
                "baselineModel": "population_rate",
                "validationMae": 0.9,
                "baselineMae": 1.0,
                "chronologicalLift": 0.1,
                "calibration80Coverage": 0.8,
                "calibrationMethod": "rolling_origin_randomized_conformal_p10_p90",
                "fallback": False,
            }
            for target in targets
        }
    artifact = {
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": FANTASY_SEASON_CONTRACT_SHA256,
        "selectionEvidence": policies,
        "review": {"rookieModel": {"validation": {"eligibleForServing": True}}},
    }
    write_json(artifact_dir / "season-artifact.json", artifact)
    artifact_checksum = hashlib.sha256(
        (artifact_dir / "season-artifact.json").read_bytes()
    ).hexdigest()
    write_json(
        artifact_dir / "artifact-manifest.json",
        {"artifactChecksum": artifact_checksum},
    )
    write_json(artifact_dir / "training-report.json", {"targetPolicies": policies})
    receipt = evaluate_fantasy_batch(artifact_dir, tmp_path / "receipt.json")
    assert receipt["eligibleForAdvancedBatch"] is True
    assert receipt["blockers"] == []
    assert len(receipt["receiptHash"]) == 64


def test_official_player_landing_capture_keeps_actual_availability_and_non_nhl_history():
    capture = normalize_player_landing(
        {
            "playerId": 8481538,
            "firstName": {"default": "Judd"},
            "lastName": {"default": "Caulfield"},
            "position": "R",
            "birthDate": "2001-03-19",
            "currentTeamId": 24,
            "draftDetails": {"overallPick": 145},
            "seasonTotals": [{
                "season": 20252026,
                "leagueAbbrev": "AHL",
                "gameTypeId": 2,
                "gamesPlayed": 71,
                "goals": 17,
                "assists": 21,
                "points": 38,
            }],
        },
        expected_player_id=8481538,
        fetched_at="2026-08-18T12:00:00+00:00",
        source_hash="a" * 64,
    )
    assert capture["availableAt"] == "2026-08-18T12:00:00+00:00"
    assert capture["seasonTotals"][0]["league"] == "AHL"


def test_season_assist_label_audit_accepts_settled_disagreements_and_rejects_missing(
    tmp_path,
):
    rows = [
        {
            "season_id": 20232024,
            "game_id": 1,
            "game_date": "2024-01-01",
            "nhl_player_id": 10,
            "PRIMARY_ASSISTS": 1,
            "SECONDARY_ASSISTS": 1,
            "ASSIST_LABEL_ASSISTS": 2,
            "BOX_SCORE_ASSISTS": 1,
            "ASSIST_LABEL_SOURCE": "wgo_frozen_settled_outcome",
        },
        {
            "season_id": 20252026,
            "game_id": 2,
            "game_date": "2026-01-01",
            "nhl_player_id": 11,
            "PRIMARY_ASSISTS": 0,
            "SECONDARY_ASSISTS": 0,
            "ASSIST_LABEL_ASSISTS": 0,
            "BOX_SCORE_ASSISTS": 0,
            "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
        },
    ]
    path = tmp_path / "skaters.jsonl"
    _jsonl(path, rows)
    audit = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    assert audit["eligibleForTraining"] is True
    assert audit["resolvedBoxScoreDisagreements"] == 1
    assert audit["unresolvedRows"] == 0
    assert audit["sourceCounts"]["wgo_frozen_settled_outcome"] == 1
    assert audit["predictiveFeatureUse"] is False

    rows[1]["PRIMARY_ASSISTS"] = None
    rows[1]["ASSIST_LABEL_SOURCE"] = "unresolved"
    _jsonl(path, rows)
    invalid = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    assert invalid["eligibleForTraining"] is False
    assert invalid["unresolvedRows"] == 1


def test_official_landing_resolution_preserves_assist_order_and_special_teams():
    labels = _official_landing_assist_labels({
        "summary": {
            "scoring": [{
                "goals": [
                    {
                        "playerId": 10,
                        "strength": "pp",
                        "assists": [{"playerId": 11}, {"playerId": 12}],
                    },
                    {
                        "playerId": 11,
                        "strength": "sh",
                        "assists": [{"playerId": 12}],
                    },
                ]
            }]
        }
    })
    assert labels[10] == {
        "primary": 0,
        "secondary": 0,
        "pp": 0,
        "sh": 0,
        "ppGoals": 1,
        "shGoals": 0,
    }
    assert labels[11] == {
        "primary": 1,
        "secondary": 0,
        "pp": 1,
        "sh": 0,
        "ppGoals": 0,
        "shGoals": 1,
    }
    assert labels[12] == {
        "primary": 1,
        "secondary": 1,
        "pp": 1,
        "sh": 1,
        "ppGoals": 0,
        "shGoals": 0,
    }


def test_official_resolution_closes_source_conflicts_and_settled_disagreements(
    tmp_path,
    monkeypatch,
):
    path = tmp_path / "skaters.jsonl"
    _jsonl(path, [
        {
            "season_id": 20252026,
            "game_id": 2025020001,
            "game_date": "2026-01-01",
            "nhl_player_id": 10,
            "PRIMARY_ASSISTS": None,
            "SECONDARY_ASSISTS": None,
            "ASSIST_LABEL_ASSISTS": None,
            "BOX_SCORE_ASSISTS": 1,
            "ASSIST_LABEL_SOURCE": "source_conflict",
            "PP_ASSISTS": None,
            "SH_ASSISTS": None,
            "PP_GOALS": None,
            "SH_GOALS": None,
        },
        {
            "season_id": 20252026,
            "game_id": 2025020001,
            "game_date": "2026-01-01",
            "nhl_player_id": 11,
            "PRIMARY_ASSISTS": 1,
            "SECONDARY_ASSISTS": 0,
            "ASSIST_LABEL_ASSISTS": 1,
            "BOX_SCORE_ASSISTS": 0,
            "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
            "PP_ASSISTS": 0,
            "SH_ASSISTS": 0,
            "PP_GOALS": 0,
            "SH_GOALS": 0,
        },
    ])
    payload = {
        "id": 2025020001,
        "gameState": "OFF",
        "summary": {"scoring": [{"goals": [{
            "playerId": 12,
            "strength": "ev",
            "assists": [{"playerId": 10}],
        }]}]},
    }
    monkeypatch.setattr(
        season_module,
        "_fetch_json_capture",
        lambda _url: (payload, "a" * 64),
    )
    initial = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    captures = season_module._resolve_unresolved_assist_labels(
        path,
        initial,
        "2026-08-13T12:00:00+00:00",
    )
    final = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    rows = list(season_module.read_jsonl(path))
    assert final["eligibleForTraining"] is True
    assert final["resolvedBoxScoreDisagreements"] == 0
    assert [row["ASSIST_LABEL_SOURCE"] for row in rows] == [
        "official_gamecenter_landing_resolution",
        "official_gamecenter_landing_resolution",
    ]
    assert captures[0]["checkedRows"] == 2
    assert captures[0]["correctedRows"] == 2
    assert captures[0]["resolvedUnresolvedRows"] == 1


def test_season_freeze_can_refresh_current_state_from_verified_historical_core(
    tmp_path, monkeypatch
):
    base = tmp_path / "base"
    base.mkdir()
    _jsonl(base / "games.jsonl", [{"season_id": 20252026, "game_id": 1}])
    _jsonl(base / "skaters.jsonl", [{
        "season_id": 20252026,
        "game_id": 1,
        "game_date": "2026-01-01",
        "nhl_player_id": 8480001,
        "PRIMARY_ASSISTS": 0,
        "SECONDARY_ASSISTS": 0,
        "ASSIST_LABEL_ASSISTS": 0,
        "BOX_SCORE_ASSISTS": 0,
        "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
    }])
    _jsonl(base / "goalies.jsonl", [])
    _jsonl(base / "team_history.jsonl", [{"season_id": 20252026, "team_id": 1}])
    base_audit = _assist_label_audit(
        base / "skaters.jsonl", "2026-08-01T00:00:00+00:00"
    )
    base_audit["preResolutionSourceCounts"] = {
        "normalized_play_by_play": 1,
        "source_conflict": 2,
    }
    base_audit["officialGamecenterResolutions"] = [{
        "checkedRows": 3,
        "correctedRows": 2,
    }]
    write_json(base / "assist-label-audit.json", base_audit)
    write_json(base / "teams.json", [{"team_id": 1, "abbreviation": "AAA", "name": "A"}])
    write_json(base / "season.json", {"id": 20262027, "number_of_games": 84})
    files = {}
    for name, path, rows in (
        ("games", base / "games.jsonl", 1),
        ("skaters", base / "skaters.jsonl", 1),
        ("goalies", base / "goalies.jsonl", 0),
        ("team_history", base / "team_history.jsonl", 1),
        ("assist_label_audit", base / "assist-label-audit.json", 1),
        ("teams", base / "teams.json", 1),
        ("season", base / "season.json", 1),
    ):
        files[name] = {
            "path": path.name,
            "rows": rows,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    write_json(base / "manifest.json", {
        "createdAt": "2026-08-01T00:00:00+00:00",
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "seasonId": 20262027,
        "trainingCutoffSeason": 20252026,
        "historySeasons": [20232024, 20242025, 20252026, 20262027],
        "files": files,
    })

    class Result:
        def fetchall(self):
            return [
                {
                    "fhfh_player_id": 9,
                    "nhl_player_id": 8480001,
                    "canonical_name": "Resolved Player",
                    "position": "C",
                    "team_id": 1,
                    "lifecycle_status": "active_nhl",
                    "verification_status": "verified",
                    "source_provenance": {},
                },
                {
                    "fhfh_player_id": 10,
                    "nhl_player_id": 8480002,
                    "canonical_name": "Roster Omission Player",
                    "position": "D",
                    "team_id": 1,
                    "lifecycle_status": "active_nhl",
                    "verification_status": "verified",
                    "source_provenance": {},
                },
            ]

    class Connection:
        def execute(self, _query, _parameters=()):
            return Result()

    @contextmanager
    def fake_connection(_database_url):
        yield Connection()

    monkeypatch.setattr(season_module, "readonly_connection", fake_connection)
    monkeypatch.setattr(season_module, "stream_query", lambda *_args: iter(()))
    monkeypatch.setattr(season_module, "_official_state", lambda _teams: ([{
        "game_id": 2026020001,
        "game_type": 2,
        "scheduled_start_at": "2026-10-01T23:00:00Z",
        "home_team_id": 1,
        "away_team_id": 2,
        "game_status": "scheduled",
        "source_revision_key": "revision",
    }], [{
        "nhl_player_id": 8480001,
        "team_id": 1,
        "position": "C",
        "player_name": "Resolved Player",
        "official_roster": True,
    }], []))

    output = tmp_path / "refreshed"
    manifest = freeze_season_dataset("postgresql://local", output, [], base)

    assert manifest["baseFreeze"]["inheritedHistoricalFiles"] == [
        "games", "skaters", "goalies", "team_history"
    ]
    assert manifest["publicationBlockers"]["unmappedOfficialRosterPlayers"] == 0
    assert manifest["assistLabelPolicy"]["detectedSourceConflictRows"] == 2
    assert manifest["assistLabelPolicy"]["officialGamecenterCheckedRows"] == 3
    assert manifest["assistLabelPolicy"]["officialGamecenterCorrectedRows"] == 2
    assert [
        player["fhfh_player_id"] for player in read_json(output / "player-pool.json")
    ] == [9, 10]
    assert (output / "skaters.jsonl").read_bytes() == (base / "skaters.jsonl").read_bytes()


def test_season_game_evaluation_is_deterministic_and_uses_portable_hashing():
    player = {
        "fhfhPlayerId": 10,
        "population": "forward",
        "playProbability": 0.75,
        "conditionalRates": {
            "GAMES_PLAYED": 1,
            "GOALS": 0.25,
            "PRIMARY_ASSISTS": 0.2,
            "SECONDARY_ASSISTS": 0.1,
        },
        "conditionalVariances": {},
        "deployment": {"roleProbabilities": {"F1": 0.7, "alternative": 0.3}},
        "fallbackFlags": [],
    }
    artifact = {
        "teams": {
            "1": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
            "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
        }
    }
    game = {"game_id": 2026020001, "team_id": 1, "opponent_team_id": 2}
    first = evaluate_season_game(artifact, player, game)
    second = evaluate_season_game(artifact, player, game)
    assert first == second
    assert first["unconditionalMeans"]["ASSISTS"] == pytest.approx(0.225)
    assert first["quantiles"]["p90"]["GAMES_PLAYED"] <= 1
    assert "e-" not in _portable_canonical_json({"small": 0.0000560308})


def test_season_game_does_not_apply_own_team_offense_to_player_rates_twice():
    player = {
        "fhfhPlayerId": 10,
        "population": "forward",
        "playProbability": 1,
        "conditionalRates": {"GAMES_PLAYED": 1, "GOALS": 0.5},
        "conditionalVariances": {},
        "deployment": {},
        "fallbackFlags": [],
    }
    game = {"game_id": 2026020001, "team_id": 1, "opponent_team_id": 2}
    neutral = evaluate_season_game({"teams": {
        "1": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
        "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
    }}, player, game)
    strong_team = evaluate_season_game({"teams": {
        "1": {"offenseMultiplier": 1.3, "defenseMultiplier": 1, "paceMultiplier": 1},
        "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
    }}, player, game)
    assert strong_team["conditionalMeans"]["GOALS"] == neutral["conditionalMeans"]["GOALS"]


def test_season_rest_context_is_schedule_derived_and_candidate_only():
    schedule = [
        {
            "game_id": 1,
            "scheduled_start_at": "2026-10-01T23:00:00Z",
            "home_team_id": 1,
            "away_team_id": 2,
            "game_status": "scheduled",
        },
        {
            "game_id": 2,
            "scheduled_start_at": "2026-10-03T23:00:00Z",
            "home_team_id": 3,
            "away_team_id": 1,
            "game_status": "scheduled",
        },
        {
            "game_id": 3,
            "scheduled_start_at": "2026-10-04T23:00:00Z",
            "home_team_id": 1,
            "away_team_id": 4,
            "game_status": "scheduled",
        },
    ]
    games = _schedule_contexts_by_team(schedule)[1]
    assert [game["rest_days"] for game in games] == [None, 2, 1]
    assert [game["is_back_to_back"] for game in games] == [False, False, True]

    player = {
        "fhfhPlayerId": 10,
        "population": "forward",
        "playProbability": 1,
        "baselinePlayProbability": 1,
        "conditionalRates": {"GAMES_PLAYED": 1, "GOALS": 0.8},
        "baselineConditionalRates": {"GAMES_PLAYED": 1, "GOALS": 0.5},
        "conditionalVariances": {},
        "contextEffects": {
            "GOALS": {"selected": True, "backToBackMultiplier": 0.9},
        },
        "deployment": {},
        "fallbackFlags": [],
    }
    artifact = {"teams": {
        "1": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
        "4": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
    }}
    result = evaluate_season_game(artifact, player, games[-1])
    assert result["conditionalMeans"]["GOALS"] == pytest.approx(0.72)
    assert result["baselineUnconditionalMeans"]["GOALS"] == pytest.approx(0.5)


def test_season_context_profile_obeys_chronological_cutoff():
    rows = [
        {
            "nhl_player_id": 10,
            "game_date": "2025-12-30",
            "position": "C",
            "GOALS": 1,
            "is_back_to_back": False,
        },
        {
            "nhl_player_id": 10,
            "game_date": "2026-01-03",
            "position": "C",
            "GOALS": 4,
            "is_back_to_back": True,
        },
    ]
    profile = _fit_context_profile(rows, "GOALS", {10: "1995-09-01"}, "2026-01-03")
    assert profile["rows"] == 1
    assert profile["backToBackMultiplier"] == 1


def test_sparse_count_context_preserves_the_mean_one_identity():
    rows = []
    for player_id in range(40):
        scoring_game = player_id % 20
        for game in range(20):
            rows.append({
                "nhl_player_id": player_id,
                "game_date": f"2025-10-{game + 1:02d}",
                "position": "C",
                "GOALS": 1 if game == scoring_game else 0,
                "is_home": game % 2 == 0,
                "is_back_to_back": False,
            })
    profile = _fit_context_profile(rows, "GOALS", {}, None)
    assert profile["homeMultiplier"] == pytest.approx(1)
    assert profile["awayMultiplier"] == pytest.approx(1)


def test_season_scoring_uses_exposure_rates_and_reconciles_strength_residuals():
    summaries, (prior, observed) = _weighted_exposure_summary([
        {
            "nhl_player_id": 10,
            "season_id": 20242025,
            "GAMES_PLAYED": 80,
            "TOTAL_TOI": 80 * 1200,
            "GOALS": 40,
        },
        {
            "nhl_player_id": 10,
            "season_id": 20252026,
            "GAMES_PLAYED": 80,
            "TOTAL_TOI": 80 * 1200,
            "GOALS": 48,
        },
    ], "GOALS", "TOTAL_TOI", 0.5)
    assert observed == 2
    assert prior == pytest.approx(summaries[10][0])
    assert summaries[10][0] * 1200 == pytest.approx(68 / 120)

    reconciled = _reconcile({
        "GOALS": 0.6,
        "PRIMARY_ASSISTS": 0.7,
        "SECONDARY_ASSISTS": 0.3,
        "EV_GOALS": 0.1,
        "PP_GOALS": 0.15,
        "SH_GOALS": 0.01,
        "EMPTY_NET_GOALS": 0.04,
        "EV_PRIMARY_ASSISTS": 0.1,
        "PP_PRIMARY_ASSISTS": 0.2,
        "SH_PRIMARY_ASSISTS": 0.01,
        "EN_PRIMARY_ASSISTS": 0.04,
        "EV_SECONDARY_ASSISTS": 0.1,
        "PP_SECONDARY_ASSISTS": 0.08,
        "SH_SECONDARY_ASSISTS": 0.01,
        "EN_SECONDARY_ASSISTS": 0.01,
    }, "forward")
    assert reconciled["GOALS"] == pytest.approx(0.6)
    assert reconciled["PRIMARY_ASSISTS"] == pytest.approx(0.7)
    assert reconciled["SECONDARY_ASSISTS"] == pytest.approx(0.3)
    assert reconciled["EV_GOALS"] == pytest.approx(0.4)
    assert reconciled["EV_PRIMARY_ASSISTS"] == pytest.approx(0.45)
    assert reconciled["EV_SECONDARY_ASSISTS"] == pytest.approx(0.2)
    assert reconciled["POINTS"] == pytest.approx(1.6)


def test_season_toi_does_not_scale_with_event_pace():
    team = {"paceMultiplier": 1.21}
    opponent = {"paceMultiplier": 0.81}

    assert _target_multiplier("TOTAL_TOI", "forward", team, opponent) == 1.0
    assert _target_multiplier("PP_TOI", "forward", team, opponent) == 1.0
    assert _target_multiplier(
        "SHOTS_ON_GOAL", "forward", team, opponent
    ) == pytest.approx((1.21 * 0.81) ** 0.5)


def test_season_derived_quantiles_are_ordered_and_propagate_primitive_uncertainty():
    goalie = _quantiles(
        {
            "SHOTS_AGAINST_GOALIE": 1000,
            "GOALS_AGAINST_GOALIE": 90,
            "TOTAL_TOI": 120000,
        },
        {
            "SHOTS_AGAINST_GOALIE": 10000,
            "GOALS_AGAINST_GOALIE": 400,
            "TOTAL_TOI": 1000000,
        },
        "goalie",
    )
    for target in ("SAVES_GOALIE", "SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"):
        assert goalie["p10"][target] <= goalie["p50"][target] <= goalie["p90"][target]

    skater = _quantiles(
        {"GOALS": 20, "PRIMARY_ASSISTS": 25, "SECONDARY_ASSISTS": 15},
        {"GOALS": 9, "PRIMARY_ASSISTS": 16, "SECONDARY_ASSISTS": 9},
        "forward",
    )
    assert skater["p10"]["ASSISTS"] < skater["p50"]["ASSISTS"] < skater["p90"]["ASSISTS"]
    assert skater["p50"]["POINTS"] == pytest.approx(60)


def test_season_defense_rating_rewards_team_and_opponent_adjusted_suppression():
    common = {
        "season_id": 20252026,
        "game_id": 1,
        "game_date": "2026-01-01",
        "team_id": 1,
        "opponent_team_id": 2,
        "position": "D",
        "toi_seconds": 1200,
        "team_chances_against": 30,
        "team_goals_against": 3,
    }
    ratings = _adjusted_defense_ratings([
        {**common, "nhl_player_id": 10, "chances_against": 5, "goals_against": 0},
        {**common, "nhl_player_id": 11, "chances_against": 15, "goals_against": 2},
    ])
    assert ratings[10] > ratings[11]
    assert _season_player_fallback_flags(False, "defense", 10, ratings) == []
    assert _season_player_fallback_flags(False, "forward", 99, ratings) == [
        "defense_rating_plus_minus_fallback"
    ]


def test_season_actuals_require_pregame_completion_and_source_availability(tmp_path):
    _jsonl(tmp_path / "games.jsonl", [
        {"game_id": 1, "start_time": "2026-10-01T23:00:00+00:00"},
        {"game_id": 2, "start_time": "2026-10-02T23:00:00+00:00"},
    ])
    _jsonl(tmp_path / "skaters.jsonl", [
        {
            "season_id": 20262027,
            "game_id": 1,
            "nhl_player_id": 10,
            "source_available_at": "2026-10-02T07:00:00+00:00",
            "GOALS": 1,
        },
        {
            "season_id": 20262027,
            "game_id": 2,
            "nhl_player_id": 10,
            "source_available_at": "2026-10-02T07:00:00+00:00",
            "GOALS": 99,
        },
    ])
    _jsonl(tmp_path / "goalies.jsonl", [])
    before_available = _actuals_by_player(tmp_path, "2026-10-02T06:00:00+00:00")
    after_available = _actuals_by_player(tmp_path, "2026-10-02T10:00:00+00:00")
    assert before_available == {}
    assert after_available[10]["GOALS"] == 1


@pytest.mark.parametrize(("payload", "expected"), [
    ({"gameState": "FUT", "gameScheduleState": "OK"}, "scheduled"),
    ({"gameState": "LIVE", "gameScheduleState": "OK"}, "started"),
    ({"gameState": "OFF", "gameScheduleState": "OK"}, "final"),
    ({"gameState": "FUT", "gameScheduleState": "PPD"}, "postponed"),
])
def test_season_schedule_normalizes_official_game_state(payload, expected):
    assert _official_game_status(payload) == expected


def test_season_penalized_glm_fits_a_finite_nonnegative_rate():
    rows = [
        {
            "game_date": f"2025-10-{game + 1:02d}",
            "season_id": 20252026,
            "nhl_player_id": player,
            "GOALS": (player + game) % 3,
            "TOTAL_TOI": 900 + player * 10,
        }
        for player in range(1, 13)
        for game in range(2)
    ]
    coefficients = _fit_penalized_rate_glm(rows, "GOALS", 0.85, 10.0, None)
    assert coefficients is not None
    prediction = _glm_prediction(coefficients, 0.5, 1000, "GOALS")
    assert 0 <= prediction < 100

    negative_binomial = _fit_penalized_negative_binomial_glm(
        rows,
        "GOALS",
        0.85,
        10.0,
        None,
    )
    assert negative_binomial is not None
    assert 0 <= _glm_prediction(negative_binomial, 0.5, 1000, "GOALS") < 100


def test_season_hurdle_glm_fits_zero_heavy_penalty_counts():
    rows = [
        {
            "game_date": f"2025-10-{game + 1:02d}",
            "season_id": 20252026,
            "nhl_player_id": player,
            "PENALTY_MINUTES": 2 if (player + game) % 4 == 0 else 0,
            "TOTAL_TOI": 800 + player * 20,
        }
        for player in range(1, 17)
        for game in range(4)
    ]
    coefficients = _fit_regularized_hurdle_glm(
        rows,
        "PENALTY_MINUTES",
        0.85,
        10.0,
        None,
    )
    assert coefficients is not None
    prediction = _hurdle_prediction(
        coefficients,
        0.5,
        1000,
        "PENALTY_MINUTES",
    )
    assert 0 <= prediction < 100


def test_season_target_tournament_serves_population_baseline_when_challengers_lose():
    rows = []
    for player in range(1, 13):
        historical = 0 if player % 2 else 10
        rows.append({
            "game_date": "2025-10-01",
            "season_id": 20252026,
            "nhl_player_id": player,
            "GOALS": historical,
            "TOTAL_TOI": 1000,
        })
        for game_date in ("2025-11-01", "2025-12-16", "2026-02-16"):
            rows.append({
                "game_date": game_date,
                "season_id": 20252026,
                "nhl_player_id": player,
                "GOALS": 10 - historical,
                "TOTAL_TOI": 1000,
            })
    policy = _select_rate_policy(rows, "GOALS")
    assert policy["modelFamily"] == "population_rate"
    assert policy["baselineModel"] == "population_rate"
    assert policy["validationMae"] == pytest.approx(policy["baselineMae"])
    assert policy["chronologicalLift"] == 0
    assert policy["fallback"] is True
    assert 0.75 <= policy["calibration80Coverage"] <= 0.85
    assert policy["calibrationMethod"] == "rolling_origin_randomized_conformal_p10_p90"
    assert policy["intervalVarianceScale"] >= 0


def test_season_deployment_evidence_uses_processed_sources_and_reconciles_roles():
    evidence = _deployment_evidence(
        [{
            "season_id": 20252026,
            "nhl_player_id": 10,
            "deployment_group": "forward",
            "deployment_code": "F2_C",
            "share": 0.6,
            "games": 20,
            "team_ids": [1],
            "source_table": "lineCombinations",
        }],
        [{
            "source_table": "lines_nhl",
            "capture_key": "trusted-1",
            "team_id": 1,
            "available_at": "2026-08-12T12:00:00+00:00",
            "line_1_player_ids": [10],
            "line_2_player_ids": [],
            "line_3_player_ids": [],
            "line_4_player_ids": [],
            "pair_1_player_ids": [],
            "pair_2_player_ids": [],
            "pair_3_player_ids": [],
            "goalie_1_player_id": None,
            "goalie_2_player_id": None,
            "scratches_player_ids": [],
            "injured_player_ids": [],
        }],
        "2026-08-13T12:00:00+00:00",
    )
    probabilities = _normalized_role_probabilities(
        dict(evidence[(10, 1)]["families"]["forwardLine"])
    )
    assert max(probabilities, key=probabilities.get) == "F1"
    assert sum(probabilities.values()) == pytest.approx(1)


def test_season_team_context_is_recomputed_from_current_roster_membership():
    contexts = {
        str(team_id): {
            "teamId": team_id,
            "offenseMultiplier": 1,
            "defenseMultiplier": 1,
            "paceMultiplier": 1,
            "ratings": {"pace": 50},
            "projectedGoalsFor": 3,
            "projectedGoalsAgainst": 3,
            "sampleGames": 82,
        }
        for team_id in (1, 2)
    }
    players = {
        "10": {
            "teamId": 1,
            "poolStatus": "verified_active",
            "population": "forward",
            "playProbability": 1,
            "conditionalRates": {"GOALS": 2, "PP_GOALS": 1, "PP_ASSISTS": 0, "TOTAL_TOI": 1200, "PK_TOI": 0},
            "ratingSignals": {"defenseSuppressionPer60": 0},
        },
        "11": {
            "teamId": 2,
            "poolStatus": "verified_active",
            "population": "forward",
            "playProbability": 1,
            "conditionalRates": {"GOALS": 1, "PP_GOALS": 0, "PP_ASSISTS": 0, "TOTAL_TOI": 1200, "PK_TOI": 0},
            "ratingSignals": {"defenseSuppressionPer60": 0},
        },
    }
    adjusted = _roster_adjusted_team_contexts(contexts, players)
    assert adjusted["1"]["ratings"]["offense"] > adjusted["2"]["ratings"]["offense"]
    assert adjusted["1"]["scheduleNeutralGoalDifferential"] > adjusted["2"]["scheduleNeutralGoalDifferential"]


def test_validation_challenger_verifier_enforces_lockbox_and_promotion_guards(tmp_path):
    payload = {
        "contractVersion": "player-forecasts-research-v2-validation",
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "evidenceClassification": "validation_not_blind_evidence",
        "consumedLockboxRead": False,
        "promotionEligible": False,
        "segments": {"forward": {"hits": {"candidate": "career_rate"}}},
        "horizonCalibration": {"calibrations": {"forward:hits:H1": {"rows": 1}}},
    }
    payload["artifactChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    artifact_path = tmp_path / "artifact.json"
    write_json(artifact_path, payload)
    assert verify_validation_challenger_artifact(artifact_path)["promotionEligible"] is False
    payload["promotionEligible"] = True
    write_json(artifact_path, payload)
    with pytest.raises(RuntimeError, match="checksum mismatch"):
        verify_validation_challenger_artifact(artifact_path)


def test_assist_decomposition_preserves_official_total_and_keeps_weighted_features_separate():
    assert official_assist_expectation(0.4, 0.2) == pytest.approx(0.6)
    features = assist_candidate_features(0.4, 0.2)
    assert features["decomposed_sum"] == pytest.approx(0.6)
    assert features["play_driver_70_30"] == pytest.approx(0.34)
    assert features["play_driver_80_20"] == pytest.approx(0.36)


def test_reconstructed_horizons_are_game_specific_and_stop_before_puck_drop():
    games = [
        {"id": index, "date": f"2025-10-{index:02d}", "start_time": f"2025-10-{index:02d}T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2}
        for index in range(1, 13)
    ]
    schedule = team_schedules(games)[1]
    vintages = reconstructed_vintages(schedule, 12)
    checkpoints = [row for row in vintages if row["vintage_kind"] == "horizon_checkpoint"]
    assert [row["team_game_horizon"] for row in checkpoints] == list(range(10, 0, -1))
    assert all(row["opponent_team_id"] == 2 for row in vintages)
    assert all(row["issued_at"] < "2025-10-12T23:00:00+00:00" for row in vintages)


def test_horizon_calibration_does_not_invent_monotonic_widening():
    calibration = fit_horizon_residual_quantiles([
        {"population": "forward", "target_key": "hits", "team_game_horizon": 1, "outcome": 2, "prediction": 1},
        {"population": "forward", "target_key": "hits", "team_game_horizon": 10, "outcome": 1, "prediction": 1},
    ])
    assert calibration["monotonicWideningAssumed"] is False
    assert calibration["calibrations"]["forward:hits:H2"]["pooledFallback"] is True
    assert calibration["calibrations"]["forward:hits:H10"]["pooledFallback"] is False
    assert calibration["calibrations"]["forward:hits:H1"]["residualVariance"] == 0


def test_rest_of_season_keeps_conditional_and_unconditional_semantics_distinct():
    games = [
        {"mean": 1.0, "variance": 1.5, "plays_probability": 0.5, "schedule_revision_id": "r1"},
        {"mean": 2.0, "variance": 2.5, "plays_probability": 0.75, "schedule_revision_id": "r1"},
    ]
    conditional = aggregate_rest_of_season(games, semantics="conditional", season_to_date_actual=10)
    unconditional = aggregate_rest_of_season(games, semantics="unconditional", season_to_date_actual=10)
    assert conditional["remainingMean"] == pytest.approx(3)
    assert unconditional["remainingMean"] == pytest.approx(2)
    assert conditional["fullSeasonMean"] == pytest.approx(13)
    with pytest.raises(ValueError, match="plays_probability"):
        aggregate_rest_of_season([{"mean": 1, "variance": 1}], semantics="unconditional")


def test_hits_partial_pooling_learns_prior_strength_from_development_records():
    artifact = fit_hierarchical_hits([
        {"position": "C", "player_id": 1, "hits": 1, "time_on_ice_seconds": 1000},
        {"position": "C", "player_id": 2, "hits": 5, "time_on_ice_seconds": 1000},
        {"position": "C", "player_id": 3, "hits": 10, "time_on_ice_seconds": 1000},
    ])
    sparse = hierarchical_hits_prediction(
        artifact,
        position="C",
        prior_hits=0,
        prior_time_on_ice_seconds=10,
        projected_time_on_ice_seconds=1000,
    )
    established = hierarchical_hits_prediction(
        artifact,
        position="C",
        prior_hits=100,
        prior_time_on_ice_seconds=10000,
        projected_time_on_ice_seconds=1000,
    )
    position_mean = artifact["priors"]["C"]["meanRatePerSecond"] * 1000
    assert abs(sparse - position_mean) < abs(established - position_mean)


def test_validation_features_are_rebuilt_at_each_issued_cutoff(tmp_path):
    write_json(tmp_path / "manifest.json", {
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "targetSeason": 20252026,
    })
    _jsonl(tmp_path / "games.jsonl", [
        {"id": 1, "date": "2025-10-01", "season_id": 20252026, "start_time": "2025-10-01T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2},
        {"id": 2, "date": "2025-10-03", "season_id": 20252026, "start_time": "2025-10-03T23:00:00+00:00", "home_team_id": 2, "away_team_id": 1},
        {"id": 3, "date": "2025-10-05", "season_id": 20252026, "start_time": "2025-10-05T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2},
    ])
    common = {
        "season_id": 20252026,
        "player_id": 10,
        "position": "C",
        "team_id": 1,
        "goals": 0,
        "shots_on_goal": 2,
        "blocked_shots": 0,
        "hits": 1,
        "penalty_minutes": 0,
        "toi": "18:00",
        "official_assist_decomposition_complete": True,
    }
    _jsonl(tmp_path / "skaters.jsonl", [
        {**common, "game_date": "2025-10-01", "start_time": "2025-10-01T23:00:00+00:00", "game_id": 1, "assists": 1, "primary_assists": 1, "secondary_assists": 0},
        {**common, "game_date": "2025-10-05", "start_time": "2025-10-05T23:00:00+00:00", "game_id": 3, "assists": 1, "primary_assists": 0, "secondary_assists": 1},
    ])
    result = build_validation_features(tmp_path)
    rows = [json.loads(line) for line in (tmp_path / result["path"]).read_text().splitlines()]
    target_assists = [row for row in rows if row["game_id"] == 3 and row["target_key"] == "assists"]
    by_horizon = {row["team_game_horizon"]: row for row in target_assists if row["vintage_kind"] == "horizon_checkpoint"}
    assert by_horizon[3]["features"]["history_count"] == 0
    assert by_horizon[2]["features"]["history_count"] == 1
    assert by_horizon[1]["cutoff_at"] < by_horizon[1]["game_start_time"]
    assert by_horizon[2]["features"]["decomposed_sum_career_rate"] == pytest.approx(1)


def test_validation_inference_is_horizon_bound_and_stays_non_promotable():
    unsigned = {
        "modelVersion": "test-v1",
        "contractVersion": "player-forecasts-research-v2-validation",
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "promotionEligible": False,
        "segments": {"forward": {"hits": {"candidate": "career_rate"}}},
        "horizonCalibration": {"calibrations": {"forward:hits:H3": {
            "residualQuantileOffsets": {"p10": -1, "p50": 0, "p90": 2},
            "residualVariance": 1.5,
            "pooledFallback": False,
        }}},
    }
    artifact = {**unsigned, "artifactChecksum": hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()}
    result = infer_conditional_game(artifact, {
        "player_id": 10,
        "target_game_id": 20,
        "population": "forward",
        "target_key": "hits",
        "team_game_horizon": 3,
        "issued_at": "2026-10-01T10:00:00+00:00",
        "cutoff_at": "2026-10-01T10:00:00+00:00",
        "game_start_time": "2026-10-05T23:00:00+00:00",
        "team_id": 1,
        "opponent_team_id": 2,
        "home_away": "home",
        "rest_days": 1,
        "features": {"career_rate": 1.25, "position_prior": 0.9},
    })
    assert result["pointEstimate"] == pytest.approx(1.25)
    assert result["quantiles"]["p10"] == pytest.approx(0.25)
    assert result["variance"] == pytest.approx(1.5)
    assert result["promotionEligible"] is False


def test_toi_parser_uses_seconds():
    assert parse_toi("18:30") == 1110


def test_features_never_use_same_day_or_future_outcomes(tmp_path):
    freeze = _freeze(tmp_path)
    rows = [json.loads(line) for line in (freeze / "features.jsonl").read_text().splitlines()]
    first_goals = next(row for row in rows if row["game_id"] == 1 and row["target_key"] == "goals")
    second_goals = next(row for row in rows if row["game_id"] == 2 and row["target_key"] == "goals")
    assert first_goals["features"]["history_count"] == 0
    assert second_goals["features"]["career_mean"] == 1


def test_training_replay_is_checksum_deterministic(tmp_path):
    freeze = _freeze(tmp_path)
    first = train_baseline(freeze)["artifactChecksum"]
    second = train_baseline(freeze)["artifactChecksum"]
    assert first == second


def test_lockbox_requires_confirmation_and_is_single_use(tmp_path, monkeypatch):
    freeze = _freeze(tmp_path / "freeze")
    receipt = tmp_path / "receipt.json"
    with pytest.raises(RuntimeError, match="confirmation"):
        evaluate_lockbox_once(freeze, receipt)
    monkeypatch.setenv("PLAYER_FORECAST_LOCKBOX_CONFIRM", "2025-26-primary-once")
    with pytest.raises(RuntimeError, match="not approved"):
        evaluate_lockbox_once(freeze, receipt)
    artifact = read_json(freeze / "model-artifact.json")
    artifact["lockboxReady"] = True
    artifact.pop("artifactChecksum")
    import hashlib
    artifact["artifactChecksum"] = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
    write_json(freeze / "model-artifact.json", artifact)
    evaluate_lockbox_once(freeze, receipt)
    with pytest.raises(RuntimeError, match="already exists"):
        evaluate_lockbox_once(freeze, receipt)

    monkeypatch.setenv("PLAYER_FORECAST_PROSPECTIVE_CONFIRM", "2026-27-fixed-artifact-once")
    with pytest.raises(RuntimeError, match="2026-27 target season"):
        evaluate_prospective_once(
            freeze,
            receipt,
            tmp_path / "prospective.json",
            "2026-10-01",
            "2026-10-31",
        )


def test_prospective_freeze_binds_fixed_artifact_and_target_season(tmp_path, monkeypatch):
    unsigned_artifact = {
        "contractChecksum": CONTRACT_SHA256,
        "contractVersion": "player-forecasts-research-v1",
        "modelKey": "fixed-test",
        "modelVersion": "v1",
        "featureSchemaVersion": "historical-core-v2",
        "promotionEligible": False,
        "targets": {"goals": {"candidate": "position_prior"}},
        "segments": {"forward": {"goals": {"candidate": "position_prior"}}},
    }
    artifact = {
        **unsigned_artifact,
        "artifactChecksum": hashlib.sha256(canonical_json(unsigned_artifact).encode()).hexdigest(),
    }
    unsigned_receipt = {
        "contractChecksum": CONTRACT_SHA256,
        "artifactChecksum": artifact["artifactChecksum"],
        "primaryEvaluationOrdinal": 1,
    }
    receipt = {
        **unsigned_receipt,
        "receiptChecksum": hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest(),
    }
    artifact_path = tmp_path / "fixed-artifact.json"
    receipt_path = tmp_path / "primary-receipt.json"
    write_json(artifact_path, artifact)
    write_json(receipt_path, receipt)

    @contextmanager
    def fake_connection(_database_url):
        yield object()

    rows = {
        "player_forecast_games": [
            {"id": 1, "date": "2026-04-01", "season_id": 20252026, "start_time": "2026-04-01T23:00:00Z", "type": 2, "home_team_id": 1, "away_team_id": 2},
            {"id": 2, "date": "2026-10-10", "season_id": 20262027, "start_time": "2026-10-10T23:00:00Z", "type": 2, "home_team_id": 1, "away_team_id": 2},
        ],
        "player_forecast_skaters": [
            {"game_date": "2026-04-01", "season_id": 20252026, "game_id": 1, "player_id": 10, "position": "C", "goals": 1, "assists": 0, "shots_on_goal": 2, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "18:00"},
            {"game_date": "2026-10-10", "season_id": 20262027, "game_id": 2, "player_id": 10, "position": "C", "goals": 2, "assists": 1, "shots_on_goal": 4, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "19:00"},
        ],
        "player_forecast_goalies": [],
    }
    monkeypatch.setattr(freeze_module, "readonly_connection", fake_connection)
    monkeypatch.setattr(
        freeze_module,
        "stream_query",
        lambda _connection, name, _query, _parameters: iter(rows[name]),
    )
    freeze = tmp_path / "prospective-freeze"
    manifest = freeze_prospective_dataset(
        "read-only-test",
        freeze,
        [20252026],
        artifact_path,
        receipt_path,
    )
    assert manifest["targetSeason"] == 20262027
    assert manifest["prospective"]["artifactChecksum"] == artifact["artifactChecksum"]
    features = build_features(freeze)
    manifest = read_json(freeze / "manifest.json")
    manifest["features"] = features
    write_json(freeze / "manifest.json", manifest)
    monkeypatch.setenv("PLAYER_FORECAST_PROSPECTIVE_CONFIRM", "2026-27-fixed-artifact-once")
    evidence = evaluate_prospective_once(
        freeze,
        receipt_path,
        tmp_path / "prospective-evidence.json",
        "2026-10-01",
        "2026-10-31",
    )
    assert evidence["evidenceKind"] == "untouched_prospective"
    assert evidence["tuningPermitted"] is False
    assert evidence["metrics"]["targets"]["goals"]["rows"] == 1

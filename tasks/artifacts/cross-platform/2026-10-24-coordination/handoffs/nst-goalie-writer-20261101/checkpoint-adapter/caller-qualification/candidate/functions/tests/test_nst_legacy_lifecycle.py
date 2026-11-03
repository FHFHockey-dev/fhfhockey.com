"""Execute real legacy function ASTs with isolated dependencies, never .env or NST.

The historical entrypoints are not imported: several create production clients at
module scope. This proves lifecycle settlement, not their old data semantics.
"""
import ast
import asyncio
from datetime import datetime, timedelta
import inspect
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
from typing import Dict, List, Optional
from unittest.mock import AsyncMock, Mock
import pytest
from bs4 import BeautifulSoup
from lib import nst_admission as admission

ROOT = Path(__file__).resolve().parents[2]
SKATER = "web/pages/api/v1/db/nst_gamelog_scraper.py"
GOALIE = "web/pages/api/v1/db/nst_gamelog_goalie_scraper.py"
PLAYER = "web/pages/api/ThreeYearAverages/nstgamelog.py"
TABLE = "web/scripts/fetch_team_table.py"
EXPERIMENT = "web/pages/api/ThreeYearAverages/nsttest.py"


@pytest.fixture
def lifecycle(monkeypatch):
    monkeypatch.setenv("NST_JOB_LIFECYCLE_ENABLED", "true")
    monkeypatch.setenv("NST_KEY", "offline-fixture")
    calls = []
    def rpc(name, body, deadline):
        calls.append((name, body))
        return {"status": "started" if "begin" in name else "finished" if "finish" in name else "held", "token": body["p_token"]}
    monkeypatch.setattr(admission, "_job_rpc", rpc)
    monkeypatch.setattr(admission.requests, "get", Mock(side_effect=AssertionError("Unexpected NST request")))
    monkeypatch.setattr(admission.requests, "post", Mock(side_effect=AssertionError("Unexpected database request")))
    return calls


def load_functions(path, names, extra=None):
    tree = ast.parse((ROOT / path).read_text())
    selected = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in names]
    assert {n.name for n in selected} == set(names)
    namespace = {
        "nst_job_scope": admission.nst_job_scope, "assert_nst_job_active": admission.assert_nst_job_active,
        "mark_nst_job_uncertain": admission.mark_nst_job_uncertain, "Dict": Dict, "List": List, "Optional": Optional,
        "datetime": datetime, "timedelta": timedelta, "time": SimpleNamespace(time=lambda: 0),
        "print": Mock(), "troublesome_players": [], "DELAY_SECONDS": 21,
    }
    namespace.update(extra or {})
    exec(compile(ast.Module(body=selected, type_ignores=[]), path, "exec"), namespace)
    return namespace


@pytest.mark.parametrize("path", [SKATER, GOALIE, PLAYER])
@pytest.mark.parametrize("failed", [False, True])
def test_writer_entrypoint_encloses_every_output_and_holds_swallowed_failure(lifecycle, path, failed):
    seen = []
    def output(*args):
        admission.assert_nst_job_active()
        seen.append(admission._job.get()["token"])
        assert [n for n, _ in lifecycle] == ["nst_job_begin_v1"]
        if failed:
            admission.mark_nst_job_uncertain()
    extra = {"get_dates_between": lambda *a: ["2024-10-01"],
        "construct_urls_for_date": lambda *a: {"first": "fixture-one", "second": "fixture-two"},
        "print_delay_countdown": lambda: None, "get_latest_date_supabase": AsyncMock(return_value=None),
        "get_player_ids": lambda: [1, 2], "scrape_player_stats": lambda *a: [{}], "upsert_player_stats": output,
        "process_url": AsyncMock(side_effect=output) if path == SKATER else output}
    fn = load_functions(path, ["main"], extra)["main"]
    def run():
        if inspect.iscoroutinefunction(fn): asyncio.run(fn())
        else: fn()
    if failed:
        with pytest.raises(admission.NstAdmissionError): run()
    else:
        run()
    assert len(seen) == (1 if failed else 2)
    assert len(set(seen)) == 1
    assert [n for n, _ in lifecycle] == ["nst_job_begin_v1", "nst_job_hold_v1" if failed else "nst_job_finish_v1"]


@pytest.mark.parametrize("path, name", [(SKATER, "upsert_data"), (PLAYER, "upsert_player_stats"), (GOALIE, "process_url")])
@pytest.mark.parametrize("failure", ["exception", "error"])
def test_real_legacy_output_functions_cannot_clear_failed_writes(lifecycle, path, name, failure):
    execute = Mock(side_effect=RuntimeError("write unknown")) if failure == "exception" else Mock(return_value=SimpleNamespace(error="write rejected"))
    builder = SimpleNamespace(upsert=lambda *a, **kw: SimpleNamespace(execute=execute))
    ns = load_functions(path, [name], {
        "supabase": SimpleNamespace(table=lambda *a: builder), "get_table_name": lambda *a: "fixture",
        "check_data_exists": lambda *a: False, "nst_get": lambda *a: SimpleNamespace(status_code=200, text="fixture"),
        "parse_html": lambda *a: [{"player_name": "Fixture", "team": "BOS"}], "get_goalie_id_by_name": lambda *a: 1,
    })
    with pytest.raises((admission.NstAdmissionError, RuntimeError)):
        with admission.nst_job("fixture"):
            if name == "upsert_data": asyncio.run(ns[name]("fixture", [{"player_id": 1}]))
            elif name == "upsert_player_stats": ns[name]([{"player_id": 1}])
            else: ns[name]({"datasetType": "fixture", "url": "fixture", "date": "2024-10-01", "seasonId": "20242025"}, 1, 1, {})
    assert execute.call_count == 1
    assert [n for n, _ in lifecycle] == ["nst_job_begin_v1", "nst_job_hold_v1"]


def test_goalie_write_rechecks_expiry_after_identity_lookup(lifecycle, monkeypatch):
    now = [0.0]; monkeypatch.setattr(admission.time, "monotonic", lambda: now[0])
    execute = Mock()
    def identity(*args):
        now[0] = 20
        return 1
    ns = load_functions(GOALIE, ["process_url"], {
        "supabase": SimpleNamespace(table=lambda *a: SimpleNamespace(upsert=lambda *a, **kw: SimpleNamespace(execute=execute))),
        "get_table_name": lambda *a: "fixture", "check_data_exists": lambda *a: False,
        "nst_get": lambda *a: SimpleNamespace(status_code=200, text="fixture"),
        "parse_html": lambda *a: [{"player_name": "Fixture", "team": "BOS"}], "get_goalie_id_by_name": identity,
    })
    with pytest.raises(admission.NstAdmissionError):
        with admission.nst_job("fixture", deadline_at=10):
            ns["process_url"]({"datasetType": "fixture", "url": "fixture", "date": "2024-10-01", "seasonId": "20242025"}, 1, 1, {})
    execute.assert_not_called()
    assert lifecycle[-1][0] == "nst_job_hold_v1"


@pytest.mark.parametrize("missing_table", [False, True])
def test_legacy_team_cli_finishes_after_json_or_holds_system_exit(lifecycle, missing_table):
    events = []
    html = "<table id='teams'><thead><tr><th>Team</th></tr></thead><tbody><tr><td>BOS</td></tr></tbody></table>"
    def provider(*a, **kw):
        events.append("body")
        return SimpleNamespace(text="" if missing_table else html, raise_for_status=lambda: None)
    def output(value):
        events.append("json"); assert lifecycle[-1][0] == "nst_job_begin_v1"
        assert isinstance(json.loads(value), dict)
    ns = load_functions(TABLE, ["fetch_team_table"], {"nst_get": provider, "BeautifulSoup": BeautifulSoup,
        "clean_header": lambda v: v, "validate_percentage": lambda v: v, "ensure_loaded_for": lambda *a: None,
        "os": os, "sys": sys, "json": json, "requests": admission.requests, "print": output})
    if missing_table:
        with pytest.raises(SystemExit): ns["fetch_team_table"]()
    else: ns["fetch_team_table"]()
    assert events == ["body", "json"]
    assert lifecycle[-1][0] == ("nst_job_hold_v1" if missing_table else "nst_job_finish_v1")


def test_experiment_is_import_inert_and_holds_parse_failure(lifecycle):
    tree = ast.parse((ROOT / EXPERIMENT).read_text())
    # Only function definitions/the explicit __main__ block may contain NST calls.
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.If)): continue
        assert not any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "nst_get" for n in ast.walk(node))
    ns = load_functions(EXPERIMENT, ["main"], {"nst_get": lambda *a: SimpleNamespace(status_code=200, content=b""), "BeautifulSoup": BeautifulSoup})
    with pytest.raises(AttributeError): ns["main"]()
    assert [n for n, _ in lifecycle] == ["nst_job_begin_v1", "nst_job_hold_v1"]


def test_enabled_unscoped_provider_is_rejected_before_any_io(lifecycle):
    with pytest.raises(admission.NstAdmissionError, match="enclosing job"):
        admission.nst_get("https://data.naturalstattrick.com/teamtable.php")
    admission.requests.get.assert_not_called()
    admission.requests.post.assert_not_called()
    assert lifecycle == []

import importlib
import socket
from unittest.mock import Mock

import pytest
import requests


CALLER_SECRET = "test-caller-secret"
PROVIDER_KEY = "test-provider-key"


@pytest.fixture(autouse=True)
def local_only(monkeypatch):
    """Install IO guards before importing any application entrypoint."""
    def denied(*_args, **_kwargs):
        raise AssertionError("Unmocked IO is forbidden in team-table contract tests")

    monkeypatch.setattr(requests.sessions.Session, "request", denied)
    monkeypatch.setattr(socket, "create_connection", denied)
    monkeypatch.setattr(socket, "getaddrinfo", denied)
    for method in ("connect", "connect_ex", "send", "sendall", "sendto", "sendmsg"):
        if hasattr(socket.socket, method):
            monkeypatch.setattr(socket.socket, method, denied)

    env_loader = importlib.import_module("lib.env_loader")
    ensure_loaded = Mock()
    monkeypatch.setattr(env_loader, "ensure_loaded_for", ensure_loaded)
    monkeypatch.setattr(env_loader, "load_web_env_local", denied)
    monkeypatch.setenv("NST_TEAM_TABLE_SECRET", CALLER_SECRET)
    monkeypatch.setenv("NST_KEY", PROVIDER_KEY)

    postgres = importlib.import_module("lib.postgres")
    db_connect = Mock(side_effect=denied)
    monkeypatch.setattr(postgres, "ensure_loaded_for", ensure_loaded)
    monkeypatch.setattr(postgres, "get_conn", db_connect)
    if postgres.psycopg is not None:
        monkeypatch.setattr(postgres.psycopg, "connect", db_connect)

    global team_table_module, standalone_app, aggregate_app
    team_table_module = importlib.import_module("api.fetch_team_table")
    aggregate_module = importlib.import_module("api.index")
    standalone_app = team_table_module.app
    aggregate_app = aggregate_module.app
    monkeypatch.setattr(team_table_module, "ensure_loaded_for", ensure_loaded)
    monkeypatch.setattr(team_table_module, "get_conn", db_connect)
    season_lookup = Mock(side_effect=denied)
    monkeypatch.setattr(team_table_module, "_get_current_and_last_season_ids", season_lookup)
    provider_get = Mock(side_effect=denied)
    monkeypatch.setattr(team_table_module.requests, "get", provider_get)
    parser = Mock(wraps=team_table_module.BeautifulSoup)
    monkeypatch.setattr(team_table_module, "BeautifulSoup", parser)
    return {
        "season_lookup": season_lookup,
        "db_connect": db_connect,
        "ensure_loaded": ensure_loaded,
        "provider_get": provider_get,
        "parser": parser,
    }


QUERY = (
    "sit=5v5&rate=n&from_season=20252026&thru_season=20252026"
    "&fd=2026-01-14&td=2026-01-14"
)

TEAM_TABLE_HTML = """
<html>
  <body>
    <table id="teams">
      <thead>
        <tr><th>Team</th><th>GP</th><th>CF%</th><th>Ignored</th></tr>
      </thead>
      <tbody>
        <tr><td>Boston Bruins</td><td>10</td><td>52.5</td><td>x</td></tr>
      </tbody>
    </table>
  </body>
</html>
"""


def _responses(path: str):
    headers = {"Authorization": f"Bearer {CALLER_SECRET}"}
    standalone_response = standalone_app.test_client().get(
        f"/api/fetch_team_table?{path}", headers=headers
    )
    aggregate_response = aggregate_app.test_client().get(
        f"/fetch_team_table?{path}", headers=headers
    )
    return standalone_response, aggregate_response


def _assert_same_json_response(responses, expected_status: int):
    standalone_response, aggregate_response = responses
    assert standalone_response.status_code == expected_status
    assert aggregate_response.status_code == expected_status
    assert isinstance(standalone_response.get_json(), dict)
    assert standalone_response.get_json() == aggregate_response.get_json()
    return standalone_response.get_json()


HTTP_ENTRIES = [
    ("standalone", "/"),
    ("standalone", "/api/fetch_team_table"),
    ("standalone", "/api/fetch_team_table/"),
    ("aggregate", "/fetch_team_table"),
]


def _assert_no_source_work(local_only):
    for mock in local_only.values():
        mock.assert_not_called()


@pytest.mark.parametrize("entry,path", HTTP_ENTRIES)
@pytest.mark.parametrize("configured", [None, "", " \t\r\n", "two words", "invalid\x7fsecret"])
def test_http_entries_fail_closed_without_valid_caller_config(monkeypatch, local_only, entry, path, configured):
    if configured is None:
        monkeypatch.delenv("NST_TEAM_TABLE_SECRET")
    else:
        monkeypatch.setenv("NST_TEAM_TABLE_SECRET", configured)
    app = standalone_app if entry == "standalone" else aggregate_app
    # Missing thru_season and required params must not discover DB seasons.
    response = app.test_client().get(
        f"{path}?from_season=20252026", headers={"Authorization": f"Bearer {CALLER_SECRET}"}
    )
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "caller_auth_unavailable"
    assert CALLER_SECRET not in response.get_data(as_text=True)
    assert PROVIDER_KEY not in response.get_data(as_text=True)
    _assert_no_source_work(local_only)


@pytest.mark.parametrize("entry,path", HTTP_ENTRIES)
@pytest.mark.parametrize("authorization", [None, "", "Bearer wrong-token", f"Bearer {PROVIDER_KEY}", "Basic token", "bearer test-caller-secret", "Bearer caf\u00e9"])
def test_http_entries_reject_missing_wrong_or_malformed_credentials(local_only, entry, path, authorization):
    app = standalone_app if entry == "standalone" else aggregate_app
    headers = {} if authorization is None else {"Authorization": authorization}
    response = app.test_client().get(f"{path}?sit=5v5&rate=n", headers=headers)
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "caller_unauthorized"
    assert CALLER_SECRET not in response.get_data(as_text=True)
    assert PROVIDER_KEY not in response.get_data(as_text=True)
    if authorization:
        assert authorization not in response.get_data(as_text=True)
    _assert_no_source_work(local_only)


def test_authorized_invalid_parameters_do_not_discover_seasons(local_only):
    _assert_same_json_response(_responses("from_season=20252026"), 400)
    _assert_no_source_work(local_only)


def test_authorized_dynamic_seasons_use_only_the_mocked_resolver(monkeypatch, local_only):
    local_only["season_lookup"].side_effect = None
    local_only["season_lookup"].return_value = ("20252026", "20242025")
    upstream = Mock(status_code=200, text=TEAM_TABLE_HTML)
    monkeypatch.setattr(team_table_module.requests, "get", Mock(return_value=upstream))
    response = standalone_app.test_client().get(
        "/api/fetch_team_table?sit=5v5&rate=n",
        headers={"Authorization": f"Bearer {CALLER_SECRET}"},
    )
    assert response.status_code == 200
    assert response.get_json()["debug"]["Resolved from_season"] == "20252026"
    local_only["season_lookup"].assert_called_once()
    local_only["db_connect"].assert_not_called()


def test_direct_provider_helper_does_not_require_the_http_caller_secret(monkeypatch):
    monkeypatch.delenv("NST_TEAM_TABLE_SECRET")
    upstream = Mock(status_code=200, text=TEAM_TABLE_HTML)
    monkeypatch.setattr(team_table_module.requests, "get", Mock(return_value=upstream))
    result = team_table_module.fetch_team_table(sit="5v5", rate="n")
    assert result.status_code == 200
    assert result.payload["data"][0]["Team"] == "Boston Bruins"


def test_both_entrypoints_serialize_one_success_payload(monkeypatch):
    monkeypatch.setenv("NST_KEY", "test-key")
    upstream = Mock(status_code=200, text=TEAM_TABLE_HTML)
    upstream.raise_for_status.return_value = None
    get = Mock(return_value=upstream)
    monkeypatch.setattr(team_table_module.requests, "get", get)

    payload = _assert_same_json_response(_responses(QUERY), 200)

    assert payload["data"] == [
        {
            "date": "2026-01-14",
            "situation": "5v5",
            "Team": "Boston Bruins",
            "GP": "10",
            "CFPct": 52.5,
        }
    ]
    assert payload["debug"]["Number of rows parsed"] == 1
    assert payload["debug"]["Resolved from_season"] == "20252026"
    assert payload["debug"]["Resolved thru_season"] == "20252026"
    assert "error" not in payload
    assert get.call_count == 2


def test_both_entrypoints_return_the_same_invalid_request_shape():
    payload = _assert_same_json_response(_responses("from_season=20252026"), 400)

    assert payload["data"] == []
    assert payload["error"] == {
        "code": "invalid_request",
        "message": "Missing required parameters: 'sit' and 'rate'.",
    }


def test_missing_dependency_is_not_embedded_in_http_200(monkeypatch):
    monkeypatch.delenv("NST_KEY", raising=False)
    monkeypatch.setattr(
        team_table_module,
        "ensure_loaded_for",
        lambda _keys: None,
    )
    get = Mock()
    monkeypatch.setattr(team_table_module.requests, "get", get)

    payload = _assert_same_json_response(_responses(QUERY), 503)

    assert payload["error"]["code"] == "missing_key"
    get.assert_not_called()


def test_upstream_timeout_is_a_named_gateway_timeout(monkeypatch):
    monkeypatch.setenv("NST_KEY", "test-key")
    monkeypatch.setattr(
        team_table_module.requests,
        "get",
        Mock(side_effect=requests.exceptions.Timeout("timed out")),
    )

    payload = _assert_same_json_response(_responses(QUERY), 504)

    assert payload["error"]["code"] == "upstream_timeout"


def test_upstream_http_failure_is_a_named_bad_gateway(monkeypatch):
    monkeypatch.setenv("NST_KEY", "test-key")
    upstream = Mock(status_code=429, text="rate limited")
    upstream.raise_for_status.side_effect = requests.exceptions.HTTPError(
        response=upstream
    )
    monkeypatch.setattr(team_table_module.requests, "get", Mock(return_value=upstream))

    payload = _assert_same_json_response(_responses(QUERY), 502)

    assert payload["error"]["code"] == "upstream_http_error"
    assert payload["debug"]["Error"] == "Upstream status: 429"


def test_missing_upstream_table_is_a_named_parser_failure(monkeypatch):
    monkeypatch.setenv("NST_KEY", "test-key")
    upstream = Mock(status_code=200, text="<html><body>No table</body></html>")
    upstream.raise_for_status.return_value = None
    monkeypatch.setattr(team_table_module.requests, "get", Mock(return_value=upstream))

    payload = _assert_same_json_response(_responses(QUERY), 502)

    assert payload["error"]["code"] == "missing_table"
    assert payload["data"] == []


def test_parser_exception_is_a_named_bad_gateway(monkeypatch):
    monkeypatch.setenv("NST_KEY", "test-key")
    upstream = Mock(status_code=200, text=TEAM_TABLE_HTML)
    upstream.raise_for_status.return_value = None
    monkeypatch.setattr(team_table_module.requests, "get", Mock(return_value=upstream))
    monkeypatch.setattr(
        team_table_module,
        "BeautifulSoup",
        Mock(side_effect=ValueError("invalid markup")),
    )

    payload = _assert_same_json_response(_responses(QUERY), 502)

    assert payload["error"]["code"] == "parse_error"
    assert payload["data"] == []

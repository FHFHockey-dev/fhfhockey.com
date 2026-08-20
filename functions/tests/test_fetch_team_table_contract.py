from unittest.mock import Mock

import requests

from api import fetch_team_table as team_table_module
from api.fetch_team_table import app as standalone_app
from api.index import app as aggregate_app


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
    standalone_response = standalone_app.test_client().get(
        f"/api/fetch_team_table?{path}"
    )
    aggregate_response = aggregate_app.test_client().get(
        f"/fetch_team_table?{path}"
    )
    return standalone_response, aggregate_response


def _assert_same_json_response(responses, expected_status: int):
    standalone_response, aggregate_response = responses
    assert standalone_response.status_code == expected_status
    assert aggregate_response.status_code == expected_status
    assert isinstance(standalone_response.get_json(), dict)
    assert standalone_response.get_json() == aggregate_response.get_json()
    return standalone_response.get_json()


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

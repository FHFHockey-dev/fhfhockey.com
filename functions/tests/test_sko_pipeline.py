from unittest.mock import Mock

from api.index import app
from lib import sko_pipeline


def test_orchestrator_fails_closed_without_secret(monkeypatch):
    monkeypatch.setenv("SKO_PIPELINE_ENDPOINT", "https://pipeline.example.test/run")
    monkeypatch.delenv("SKO_PIPELINE_SECRET", raising=False)
    post = Mock()
    monkeypatch.setattr(sko_pipeline.requests, "post", post)

    result = sko_pipeline.trigger_sko_step_forward({"step": "score"})

    assert result == {
        "success": False,
        "message": "SKO pipeline authentication is not configured.",
        "steps": [],
    }
    post.assert_not_called()


def test_orchestrator_rejects_unknown_step_before_request(monkeypatch):
    monkeypatch.setenv("SKO_PIPELINE_ENDPOINT", "https://pipeline.example.test/run")
    monkeypatch.setenv("SKO_PIPELINE_SECRET", "test-secret")
    post = Mock()
    monkeypatch.setattr(sko_pipeline.requests, "post", post)

    result = sko_pipeline.trigger_sko_step_forward({"step": "unknown"})

    assert result == {
        "success": False,
        "message": "Unsupported SKO pipeline step requested.",
        "steps": [],
    }
    post.assert_not_called()


def test_orchestrator_sends_only_allowed_step_with_required_auth(monkeypatch):
    monkeypatch.setenv("SKO_PIPELINE_ENDPOINT", "https://pipeline.example.test/run")
    monkeypatch.setenv("SKO_PIPELINE_SECRET", "test-secret")
    response = Mock(
        ok=True,
        status_code=200,
        json=Mock(return_value={"message": "score complete"}),
    )
    post = Mock(return_value=response)
    monkeypatch.setattr(sko_pipeline.requests, "post", post)

    result = sko_pipeline.trigger_sko_step_forward(
        {"step": "score", "asOfDate": "2026-07-22", "secret": "drop-me"}
    )

    assert result["success"] is True
    assert result["steps"][0]["step"] == "score"
    post.assert_called_once_with(
        "https://pipeline.example.test/run",
        json={"asOfDate": "2026-07-22", "step": "score"},
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer test-secret",
        },
        timeout=120,
    )


def test_pipeline_routes_fail_closed_without_configured_secret(monkeypatch):
    monkeypatch.delenv("SKO_PIPELINE_SECRET", raising=False)
    client = app.test_client()

    response = client.post("/sko/pipeline", json={"step": "score"})

    assert response.status_code == 401
    assert response.get_json() == {
        "success": False,
        "message": "pipeline authentication is not configured",
    }


def test_pipeline_routes_reject_missing_bearer_when_secret_is_configured(monkeypatch):
    monkeypatch.setenv("SKO_PIPELINE_SECRET", "test-secret")
    client = app.test_client()

    response = client.post("/sko/pipeline", json={"step": "score"})

    assert response.status_code == 401
    assert response.get_json() == {
        "success": False,
        "message": "missing bearer token",
    }


def test_pipeline_step_reports_not_implemented_after_auth(monkeypatch):
    monkeypatch.setenv("SKO_PIPELINE_SECRET", "test-secret")
    client = app.test_client()

    response = client.post(
        "/sko/pipeline-step",
        json={"step": "score", "asOfDate": "2026-07-22"},
        headers={"Authorization": "Bearer test-secret"},
    )

    assert response.status_code == 501
    assert response.get_json() == {
        "success": False,
        "message": "SKO pipeline stage execution is not implemented.",
        "step": "score",
        "implemented": False,
    }

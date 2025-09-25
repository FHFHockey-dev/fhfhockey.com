import os
from typing import Any, Dict

import requests


def trigger_sko_step_forward(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Invoke the sKO step-forward pipeline endpoint and return the response."""

    endpoint = os.environ.get("SKO_PIPELINE_ENDPOINT")
    if not endpoint:
        return {
            "success": False,
            "message": "SKO_PIPELINE_ENDPOINT environment variable is not set."
        }

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    secret = os.environ.get("SKO_PIPELINE_SECRET")
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    json_payload = payload or {}

    try:
        response = requests.post(endpoint, json=json_payload, headers=headers, timeout=15)
        try:
            data = response.json()
        except ValueError:
            data = {}

        if response.ok:
            return {
                "success": True,
                "message": data.get("message") or "sKO pipeline dispatched",
                "response": data
            }

        return {
            "success": False,
            "message": data.get("message")
            or data.get("error")
            or f"Pipeline trigger failed with status {response.status_code}",
            "response": data
        }
    except requests.RequestException as exc:  # pragma: no cover - network failure path
        return {
            "success": False,
            "message": f"Pipeline trigger request failed: {exc}"
        }

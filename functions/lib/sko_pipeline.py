"""Helpers for orchestrating the sKO modeling pipeline via HTTP triggers."""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Iterable, List

import requests

DEFAULT_STEPS: tuple[str, ...] = ("backfill", "train", "score", "upload")
STEP_TIMEOUTS: dict[str, int] = {
    "backfill": 120,
    "train": 240,
    "score": 120,
    "upload": 120,
}
SENSITIVE_KEYS = {"secret", "token", "authorization", "sko_pipeline_secret", "api_key"}


def _sanitize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Remove sensitive keys and orchestration controls from the outbound payload."""

    sanitized: Dict[str, Any] = {}
    for key, value in payload.items():
        lowered = key.lower()
        if lowered in SENSITIVE_KEYS:
            continue
        if lowered in {"step", "steps"}:
            continue
        sanitized[key] = value
    return sanitized


def _normalize_steps(payload: Dict[str, Any]) -> List[str]:
    steps_value = payload.get("steps") or payload.get("step")
    if steps_value is None:
        return list(DEFAULT_STEPS)
    if isinstance(steps_value, str):
        return [steps_value]
    if isinstance(steps_value, Iterable):
        normalized: List[str] = []
        for item in steps_value:
            if not item:
                continue
            normalized.append(str(item))
        return normalized or list(DEFAULT_STEPS)
    return list(DEFAULT_STEPS)


def _post_step(endpoint: str, headers: Dict[str, str], payload: Dict[str, Any], step: str) -> Dict[str, Any]:
    timeout = STEP_TIMEOUTS.get(step, 180)
    envelope = {**payload, "step": step}
    started = time.perf_counter()

    try:
        response = requests.post(endpoint, json=envelope, headers=headers, timeout=timeout)
        duration = time.perf_counter() - started
        try:
            data = response.json()
        except ValueError:
            data = {}

        step_result = {
            "step": step,
            "status": "ok" if response.ok else "error",
            "duration_sec": round(duration, 2),
            "response": data,
            "status_code": response.status_code,
        }
        if response.ok:
            step_result["message"] = data.get("message") or f"{step} step completed"
        else:
            step_result["message"] = data.get("message") or data.get("error") or "Pipeline step failed"
        return step_result
    except requests.RequestException as exc:  # pragma: no cover - network failure path
        duration = time.perf_counter() - started
        return {
            "step": step,
            "status": "error",
            "duration_sec": round(duration, 2),
            "message": f"Request failed: {exc}",
            "response": {},
            "status_code": None,
        }


def trigger_sko_step_forward(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Invoke the sKO pipeline in segmented fashion to stay within runtime limits."""

    endpoint = os.environ.get("SKO_PIPELINE_ENDPOINT")
    if not endpoint:
        return {
            "success": False,
            "message": "SKO_PIPELINE_ENDPOINT environment variable is not set.",
            "steps": [],
        }

    headers: Dict[str, str] = {"Content-Type": "application/json"}
    secret = os.environ.get("SKO_PIPELINE_SECRET")
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    payload = payload or {}
    steps = _normalize_steps(payload)
    sanitized_payload = _sanitize_payload(payload)

    results: list[Dict[str, Any]] = []
    overall_success = True

    for step in steps:
        step_result = _post_step(endpoint, headers, sanitized_payload, step)
        results.append(step_result)
        if step_result["status"] != "ok":
            overall_success = False
            break

    message = (
        results[-1]["message"]
        if results
        else "No pipeline steps executed"
    )

    total_duration = round(sum(result.get("duration_sec", 0.0) for result in results), 2)

    return {
        "success": overall_success,
        "message": message,
        "steps": results,
        "total_duration_sec": total_duration,
    }


__all__ = ["trigger_sko_step_forward"]

import os
import secrets

from flask import Flask, jsonify, request

from lib.player_forecasts import (
    APPROVED_RESEARCH_CONTRACTS,
    RESEARCH_CONTRACT_SHA256,
    RESEARCH_CONTRACT_VERSION,
    run_inference_contract,
    validate_inference_job,
)

app = Flask(__name__)


def _authorized() -> bool:
    expected = (os.environ.get("PLAYER_FORECAST_INFERENCE_SECRET") or "").strip()
    if not expected:
        return False
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return False
    return secrets.compare_digest(authorization.removeprefix("Bearer ").strip(), expected)


@app.post("/")
def infer():
    if not _authorized():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    try:
        job = validate_inference_job(request.get_json(silent=True) or {})
        result = run_inference_contract(job)
    except ValueError as error:
        return jsonify({"success": False, "message": str(error)}), 400
    return jsonify(result), 200


@app.get("/")
def health():
    if not _authorized():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    return jsonify({
        "success": True,
        "mode": "contract_only",
        "researchGate": "approved",
        "contractVersion": RESEARCH_CONTRACT_VERSION,
        "contractChecksum": RESEARCH_CONTRACT_SHA256,
        "supportedContracts": APPROVED_RESEARCH_CONTRACTS,
        "inferenceEnabled": (
            os.environ.get("PLAYER_FORECAST_ENABLE_INFERENCE", "").strip().lower() == "true"
        ),
    }), 200

from flask import Flask, request, jsonify
import os
from lib.sko_pipeline import trigger_sko_step_forward

app = Flask(__name__)


def _check_auth(req) -> tuple[bool, str]:
    expected = os.environ.get("SKO_PIPELINE_SECRET")
    if not expected:
        return True, "no secret configured"
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False, "missing bearer token"
    token = auth.split(" ", 1)[1]
    if token != expected:
        return False, "invalid token"
    return True, "ok"


@app.route("/", methods=["POST"]) 
def run_sko_pipeline():
    ok, msg = _check_auth(request)
    if not ok:
        return jsonify({"success": False, "message": msg}), 401

    payload = dict(request.get_json(silent=True) or {})

    # Support query-string steps/step like ...?steps=a,b,c
    if 'step' not in payload and 'steps' not in payload:
        if 'step' in request.args:
            payload['step'] = request.args['step']
        elif 'steps' in request.args:
            payload['steps'] = [value.strip() for value in request.args['steps'].split(',') if value.strip()]

    result = trigger_sko_step_forward(payload)
    status = 200 if result.get("success") else 500
    return jsonify(result), status

from flask import Flask, request, jsonify
import os

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
def run_sko_pipeline_step():
    ok, msg = _check_auth(request)
    if not ok:
        return jsonify({"success": False, "message": msg}), 401

    payload = dict(request.get_json(silent=True) or {})
    step = (payload.get("step") or "").strip()
    if not step:
        return jsonify({"success": False, "message": "Missing 'step' in payload"}), 400

    allowed = {"backfill", "train", "score", "upload"}
    if step not in allowed:
        return jsonify({
            "success": False,
            "message": f"Unknown step '{step}'. Allowed: {sorted(list(allowed))}",
        }), 400

    as_of_date = payload.get("asOfDate") or payload.get("as_of_date")
    horizon = payload.get("horizon")
    season_cutoff = payload.get("seasonCutoff") or payload.get("season_cutoff")

    return jsonify({
        "success": True,
        "message": f"Accepted step '{step}'",
        "step": step,
        "echo": {
            "asOfDate": as_of_date,
            "horizon": horizon,
            "seasonCutoff": season_cutoff,
        },
    }), 200

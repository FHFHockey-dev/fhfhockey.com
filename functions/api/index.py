from flask import Flask, request, jsonify
try:
    from vercel_wsgi import handle as _vercel_handle
except Exception:
    _vercel_handle = None
from api.fetch_team_table import fetch_team_table
from lib.sko_pipeline import trigger_sko_step_forward
import os

app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello, fhfh functions!'


@app.route('/healthz')
def healthz():
    return jsonify({"ok": True}), 200


def _check_auth() -> tuple[bool, str]:
    """Validate optional bearer token against SKO_PIPELINE_SECRET.

    Returns (ok, message).
    """
    expected = os.environ.get("SKO_PIPELINE_SECRET")
    if not expected:
        # No secret configured; allow by default
        return True, "no secret configured"
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False, "missing bearer token"
    token = auth.split(" ", 1)[1]
    if token != expected:
        return False, "invalid token"
    return True, "ok"


@app.route('/fetch_team_table', methods=['GET'])
def fetch_team_table_api():
    # Get arguments from query parameters, use defaults if not provided
    from_season = request.args.get('from_season', '20242025')
    thru_season = request.args.get('thru_season', '20242025')
    stype = request.args.get('stype', '2')
    sit = request.args.get('sit')  # This is required
    score = request.args.get('score', 'all')
    rate = request.args.get('rate')  # This is required
    team = request.args.get('team', 'all')
    loc = request.args.get('loc', 'B')
    gpf = request.args.get('gpf', '410')
    fd = request.args.get('fd', '')
    td = request.args.get('td', '')

    # Check if required parameters are present
    if not sit or not rate:
        return jsonify({"error": "Missing required parameters: 'sit' and 'rate'"}), 400

    # Call fetch_team_table with the parameters
    result = fetch_team_table(
        from_season=from_season,
        thru_season=thru_season,
        stype=stype,
        sit=sit,
        score=score,
        rate=rate,
        team=team,
        loc=loc,
        gpf=gpf,
        fd=fd,
        td=td
    )
    
    # Return the result as JSON response
    return jsonify(result)


@app.route('/sko/pipeline', methods=['POST'])
def run_sko_pipeline():
    ok, msg = _check_auth()
    if not ok:
        return jsonify({"success": False, "message": msg}), 401
    payload = dict(request.get_json(silent=True) or {})

    # Allow callers to pass ?step=score or ?steps=backfill,train,score via query string.
    if 'step' not in payload and 'steps' not in payload:
        if 'step' in request.args:
            payload['step'] = request.args['step']
        elif 'steps' in request.args:
            payload['steps'] = [value.strip() for value in request.args['steps'].split(',') if value.strip()]

    result = trigger_sko_step_forward(payload)
    status = 200 if result.get("success") else 500
    return jsonify(result), status


@app.route('/sko/pipeline-step', methods=['POST'])
def run_sko_pipeline_step():
    """Lightweight segmented step handler.

    Accepts JSON like { "step": "backfill", ... }. This endpoint should
    kick off only the requested slice and return quickly so that upstream
    orchestrators can chain steps without hitting timeouts.

    NOTE: This implementation is a fast placeholder that simply validates
    input and returns 200. Replace the body where indicated to actually
    perform work (enqueue a job, call a quick sub-task, etc.).
    """
    ok, msg = _check_auth()
    if not ok:
        return jsonify({"success": False, "message": msg}), 401

    payload = dict(request.get_json(silent=True) or {})
    step = (payload.get("step") or "").strip()
    if not step:
        return jsonify({"success": False, "message": "Missing 'step' in payload"}), 400

    # Optional: basic allow-list
    allowed = {"backfill", "train", "score", "upload"}
    if step not in allowed:
        return jsonify({
            "success": False,
            "message": f"Unknown step '{step}'. Allowed: {sorted(list(allowed))}",
        }), 400

    # Extract commonly used parameters (pass-through)
    as_of_date = payload.get("asOfDate") or payload.get("as_of_date")
    horizon = payload.get("horizon")
    season_cutoff = payload.get("seasonCutoff") or payload.get("season_cutoff")

    # TODO: Replace this placeholder with actual work. For example:
    # - Enqueue a job in your DB/queue and let a cron/worker process it.
    # - Trigger a smaller internal function that completes within ~10-30s.
    # - Write a row to Supabase to signal a background processor.
    # For now we return immediately to prove the segmented flow works end-to-end.

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


if __name__ == '__main__':
    app.run(debug=True)

# Expose a Vercel-compatible handler
if _vercel_handle:
    handler = _vercel_handle(app)

from flask import Flask, jsonify
try:
    from vercel_wsgi import handle as _vercel_handle
except Exception:  # local dev without vercel-wsgi
    _vercel_handle = None

app = Flask(__name__)


@app.route("/", methods=["GET"]) 
@app.route("/healthz", methods=["GET"]) 
@app.route("/api/healthz", methods=["GET"]) 
def healthz():
    return jsonify({"ok": True}), 200

# Expose a Vercel-compatible handler
if _vercel_handle:
    handler = _vercel_handle(app)

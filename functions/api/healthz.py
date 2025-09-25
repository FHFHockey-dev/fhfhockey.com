from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/", methods=["GET"]) 
def healthz():
    return jsonify({"ok": True}), 200


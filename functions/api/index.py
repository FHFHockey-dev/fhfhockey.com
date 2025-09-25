from flask import Flask, request, jsonify
from api.fetch_team_table import fetch_team_table
from api.sko_pipeline import trigger_sko_step_forward

app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello, fhfh functions!'


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
    payload = request.get_json(silent=True) or {}
    result = trigger_sko_step_forward(payload)
    status = 200 if result.get("success") else 500
    return jsonify(result), status


if __name__ == '__main__':
    app.run(debug=True)

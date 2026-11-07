"""Explain saved Game Score operands; never calculate or admit a score."""
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
FIELDS = {
    'goals': 'Goals',
    'total_primary_assists': 'Primary assists',
    'total_secondary_assists': 'Secondary assists',
    'shots': 'Shots on goal',
    'blocked_shots': 'Blocked shots',
    'penalties_drawn': 'Penalties drawn',
    'penalties': 'Penalties taken',
    'total_fow': 'Faceoff wins',
    'total_fol': 'Faceoff losses',
    'sat_for': 'Shot attempts for',
    'sat_against': 'Shot attempts against',
    'es_goals_for': 'On-ice goals for — even strength',
    'pp_goals_for': 'On-ice goals for — power play',
    'sh_goals_for': 'On-ice goals for — short-handed',
    'es_goals_against': 'On-ice goals against — even strength',
    'pp_goals_against': 'On-ice goals against — power play',
    'sh_goals_against': 'On-ice goals against — short-handed',
}


def need(ok, reason):
    if not ok:
        raise ValueError(reason)


def diagnostic(counts):
    need(isinstance(counts, dict), 'invalid_counts_object')
    states = {}
    for field in FIELDS:
        if field not in counts:
            states[field] = 'absent'
        elif counts[field] is None:
            states[field] = 'missing'
        elif type(counts[field]) not in (int, float) or not math.isfinite(counts[field]) or counts[field] < 0:
            states[field] = 'invalid'
        else:
            states[field] = 'observed'
    observed = sum(state == 'observed' for state in states.values())
    return dict(
        counts={key: deepcopy(counts[key]) for key in FIELDS if key in counts},
        states=states, observed=observed, required=len(FIELDS), complete=observed == len(FIELDS),
    )


def attach(display, sources):
    need(display['version'] == 'fhfh.blsh.evidence-visual-review.v1' and display['scoreAdmission'] is False,
         'unsupported_display')
    need(len({r['id'] for r in sources}) == len(sources), 'duplicate_source_id')
    by_id = {r['id']: r for r in sources}
    result = deepcopy(display)
    selected_ids = set()
    counters = dict(records=0, completeRecords=0, incompleteRecords=0, profilesWithIncompleteRecords=0,
                    nullFields=0, absentFields=0, invalidFields=0, zeroFields=0,
                    missingByField={key: 0 for key in FIELDS})
    for profile in result['profiles']:
        need(profile['score'] is None and profile['support'] is None and profile['baselineComparison'] is None,
             'unexpected_score_or_comparison')
        incomplete = 0
        for game in profile['games']:
            sid = game['sourceId']
            need(sid not in selected_ids and sid in by_id, 'missing_or_duplicate_selected_source')
            selected_ids.add(sid)
            row = by_id[sid]
            need(row['player_id'] == profile['playerId'] and row['game_id'] == game['gameId'] and
                 row['date'] == game['date'] and row['team_abbrev'] == game['team'], 'source_identity_drift')
            need(row['toi_per_game'] == game['capturedSeconds'], 'source_exposure_drift')
            value = diagnostic(row['counts'])
            game['savedGameScoreInputs'] = value
            counters['records'] += 1
            counters['completeRecords' if value['complete'] else 'incompleteRecords'] += 1
            incomplete += int(not value['complete'])
            for field, state in value['states'].items():
                if state == 'observed':
                    counters['zeroFields'] += int(value['counts'][field] == 0)
                else:
                    counters[{'absent': 'absentFields', 'missing': 'nullFields', 'invalid': 'invalidFields'}[state]] += 1
                    counters['missingByField'][field] += 1
        counters['profilesWithIncompleteRecords'] += int(incomplete > 0)
    need(counters['records'] == display['totals']['selectedRecords'], 'selected_record_count_mismatch')
    result['savedGameScoreOperandLabels'] = FIELDS.copy()
    result['savedGameScoreInputSummary'] = counters
    # This equality protects every pre-existing display value and qualification.
    before = deepcopy(result)
    before.pop('savedGameScoreOperandLabels')
    before.pop('savedGameScoreInputSummary')
    for p in before['profiles']:
        for g in p['games']:
            g.pop('savedGameScoreInputs')
    need(before == display, 'existing_display_changed')
    return result


def script_json(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False, allow_nan=False).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def main():
    for path, expected in json.loads((ROOT / 'INPUT-PINS.json').read_text()).items():
        need(hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, 'input_hash_drift')
    contract = Path('/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentInput.ts').read_text()
    match = re.search(r'wigoGameScore:\s*\[([^]]+)\]', contract)
    need(match is not None and re.findall(r'"([a-z_]+)"', match.group(1)) == list(FIELDS), 'operand_contract_drift')
    display = json.loads((BASE / 'current-evidence-visual-candidate-20261101-01/DISPLAY-DATA.json').read_text())
    request = json.loads((BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json').read_text())
    data = attach(display, request['wgo']['rows'])
    template = (ROOT / 'template.html').read_text()
    need(template.count('__DATA__') == 1, 'template_binding')
    with (ROOT / 'DISPLAY-DATA.json').open('x') as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    with (ROOT / 'candidate.html').open('x') as f:
        f.write(template.replace('__DATA__', script_json(data)))
    summary = dict(data['savedGameScoreInputSummary'], profiles=len(data['profiles']),
                   zeroShotProfiles=sum(p['shots'] == 0 for p in data['profiles']),
                   existingDisplayUnchanged=True, sourceValuesUnchanged=True,
                   scoresComputed=0, sourceAdmission=False, applicationInstalled=False)
    with (ROOT / 'RESULT.json').open('x') as f:
        f.write(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()

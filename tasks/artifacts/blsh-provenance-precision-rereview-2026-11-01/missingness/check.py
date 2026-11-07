import sys
sys.dont_write_bytecode = True
from pathlib import Path
import hashlib, json, re, socket, unittest, math, copy
from collections import Counter
ROOT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
SOURCE = BASE / 'game-score-missingness-visual-20261101-01'
def deny(*args, **kwargs):
    raise AssertionError('Independent review forbids network')
socket.socket = deny
socket.create_connection = deny
from diagnose import attach
import test_diagnose
pins = json.loads((ROOT / 'PINS.json').read_text())
def verify():
    for p, expected in pins.items():
        assert hashlib.sha256(Path(p).read_bytes()).hexdigest() == expected, p
verify()
with (ROOT / 'TESTS.log').open('w') as stream:
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(test_diagnose))
assert result.wasSuccessful()
raw = json.loads((BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json').read_text())
old = json.loads((BASE / 'current-evidence-visual-candidate-20261101-01/DISPLAY-DATA.json').read_text())
shown = json.loads((SOURCE / 'DISPLAY-DATA.json').read_text())
assert attach(old, raw['wgo']['rows']) == shown
contract = Path('/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentInput.ts').read_text()
fields = re.findall(r'"([a-z_]+)"', re.search(r'wigoGameScore:\s*\[([^]]+)\]',contract)[1])
assert len(fields) == 17 and fields == list(shown['savedGameScoreOperandLabels'])
rows = {r['id']:r for r in raw['wgo']['rows']}
counts = Counter(); missing = Counter(); incomplete_profiles = 0; seen = set()
for p in shown['profiles']:
    incomplete = False
    assert p['score'] is None and p['support'] is None and p['baselineComparison'] is None
    for g in p['games']:
        assert g['sourceId'] not in seen
        seen.add(g['sourceId']); row = rows[g['sourceId']]
        assert (row['player_id'],row['game_id'],row['date'],row['team_abbrev'],row['toi_per_game']) == (p['playerId'],g['gameId'],g['date'],g['team'],g['capturedSeconds'])
        states = {}; observed = 0
        for f in fields:
            v = row['counts'].get(f)
            state = 'absent' if f not in row['counts'] else 'missing' if v is None else 'invalid' if type(v) not in (int,float) or not math.isfinite(v) or v < 0 else 'observed'
            states[f] = state
            if state == 'observed':
                observed += 1; counts['zeroFields'] += int(v == 0)
            else:
                counts[{'absent':'absentFields','missing':'nullFields','invalid':'invalidFields'}[state]] += 1
                missing[f] += 1
        v = g['savedGameScoreInputs']
        assert v == dict(states=states, counts={f:row['counts'][f] for f in fields if f in row['counts']}, observed=observed, required=17, complete=observed==17)
        counts['records'] += 1; counts['completeRecords' if observed==17 else 'incompleteRecords'] += 1
        incomplete |= observed < 17
    incomplete_profiles += int(incomplete)
summary = shown['savedGameScoreInputSummary']
for k in ['records','completeRecords','incompleteRecords','nullFields','absentFields','invalidFields','zeroFields']:assert summary[k] == counts[k], k
assert summary['profilesWithIncompleteRecords'] == incomplete_profiles == 228
assert {f:missing[f] for f in fields} == summary['missingByField']
assert counts['incompleteRecords']==280 and counts['completeRecords']==3181 and counts['nullFields']==1680 and counts['zeroFields']==36992
assert len(seen)==3461 and len(shown['profiles'])==740 and sum(p['shots']==0 for p in shown['profiles'])==20
assert shown['totals']['fpWindows']==482 and shown['totals']['unresolvedPPP']==212
assert set(f for f in fields if missing[f])=={'es_goals_for','pp_goals_for','sh_goals_for','es_goals_against','pp_goals_against','sh_goals_against'}
before=copy.deepcopy(shown)
before.pop('savedGameScoreOperandLabels');before.pop('savedGameScoreInputSummary')
for p in before['profiles']:
    for g in p['games']:g.pop('savedGameScoreInputs')
assert before==old
html=(SOURCE/'candidate.html').read_text();template=(SOURCE/'template.html').read_text()
payload=re.search(r'<script id="payload" type="application/json">(.*?)</script>',html,re.S)[1]
assert json.loads(payload)==shown
assert template.replace('__DATA__',payload)==html
previous=(BASE/'current-evidence-visual-candidate-20261101-01/pagination-focus-fix-01/template.html').read_text()
def handler(text):return text.split("$('load-more').addEventListener('click',")[1].split("document.addEventListener('keydown'")[0]
assert handler(previous)==handler(template)
verify()
report=dict(state='PASS', tests=result.testsRun, pins=len(pins), profiles=740, records=3461, zeroShotProfiles=20, **{k:counts[k] for k in counts if k!='records'}, profilesWithIncompleteRecords=incomplete_profiles, missingByField=dict(missing), originalDisplayIdentical=True, htmlPayloadAndTemplateExact=True, acceptedPaginationHandlerIdentical=True, fpWindows=482, unresolvedPPP=212, scoresComputed=0, networkRequests=0)
(ROOT/'RESULT.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))

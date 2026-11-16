"""Real retained NST pages through the PINNED lineage parser (nst_lineage.py), against REAL stored rows.

Read-only, offline. Aggregate counts only (no names or player IDs): stdout, and the file given as argv[1] if any.
Usage: python3 real_fixture_lineage.py [out.json]   (regenerate the committed copy with: ... REAL-FIXTURE-LINEAGE.json)
The receipt below is a test construct: it asserts TLS/producer facts only so the parser reaches the cells;
it is not evidence. Gate freshness is out of scope here (the page was retrieved 10 days after its date).
"""
import hashlib
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
PINS = json.loads((HERE.parent / 'blsh-native-packet-preparation-2026-11-08' / 'SOURCE-PINS.json').read_text())
NST = Path('/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/nst-source-capture-v3')
REQUEST = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')


def load_lineage():
    source = Path(PINS['lineage']['path']).read_bytes()
    assert hashlib.sha256(source).hexdigest() == PINS['lineage']['sha256'], 'lineage_source_drift'
    spec = importlib.util.spec_from_loader('pinned_lineage', loader=None)
    module = importlib.util.module_from_spec(spec)
    exec(compile(source, PINS['lineage']['path'], 'exec'), module.__dict__)
    return module


def receipt(body, url, at):
    return {'status': 'success', 'httpStatus': 200, 'TLSVerified': True, 'representation': 'parser_input_after_redaction',
            'parserInputSHA256': hashlib.sha256(body).hexdigest(), 'parserInputBytes': len(body), 'producerSHA256': 'a' * 64,
            'redactorSHA256': 'b' * 64, 'retrievedAtUTC': at, 'url': url, 'toiParsingContract': 'minutes_decimal_or_mmss_to_seconds_half_up'}


def expected(group, w, stored):
    return {'group': group, 'season': 20262027, 'date': w['date'], 'playerId': w['player_id'], 'gameId': w['game_id'], 'team': w['team_abbrev'],
            'stored': stored, 'officialFrameSHA256': 'c' * 64, 'officialSafeAfterUTC': w['date'] + 'T23:59:59Z', 'officialToiSeconds': w['toi_per_game'],
            'officialFrameQualified': True, 'gamesOnNativeDate': 1, 'evidenceAsOfUTC': '2026-11-01T00:00:00Z'}


def main():
    lineage = load_lineage()
    request = json.loads(REQUEST.read_text())
    out = {'version': 'fhfh.blsh.evidence-bridge.real-fixture-lineage.v1', 'lineageSHA256': PINS['lineage']['sha256'], 'fixtures': {}}
    def page(name):
        body = (NST / f'{name}.html').read_bytes(); meta = json.loads((NST / f'{name}.json').read_text())
        out['fixtures'][name] = {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'sourceUrl': meta['sourceUrl'], 'receivedAt': meta['receivedAt']}
        assert out['fixtures'][name]['sha256'] == meta['sourceSha256']
        return body, meta
    body, meta = page('2026-10-01-allStrengthsCounts')
    date = '2026-10-01'
    wgo = [w for w in request['wgo']['rows'] if w['date'] == date]
    stored = {}
    for row in request['individual']['rows']:
        if row['date_scraped'] == date: stored.setdefault(row['player_id'], []).append(row)
    outcomes, fields, held_teams = Counter(), Counter(), Counter()
    # The real page's own URL (it carries tgp=410, which the gate and parser permit).
    r = receipt(body, meta['sourceUrl'], meta['receivedAt'])
    for w in wgo:
        rows = stored.get(w['player_id'], [])
        if len(rows) != 1: outcomes['stored_row_missing_or_duplicate'] += 1; continue
        result = lineage.check(expected('individual', w, rows[0]), body, r, ['a' * 64])
        if result['state'] == 'held':
            outcomes[result['reason']] += 1
            if result['reason'] == 'native_team_mismatch_or_ambiguous': held_teams[w['team_abbrev']] += 1
            continue
        bad = [k for k, v in result['fields'].items() if v['state'] != 'literal_match']
        outcomes[result['state'] + (':all_fields_literal_match' if not bad else ':mismatch:' + ','.join(sorted(bad)))] += 1
        for k, v in result['fields'].items(): fields[f'{k}:{v["state"]}'] += 1
    out['counts'] = {'wgoRows': len(wgo), 'byOutcome': dict(outcomes), 'fieldStates': dict(fields),
                     'heldTeamCodes': dict(held_teams), 'note': 'NST prints N.J / S.J / T.B / L.A; WGO stores NJD / SJS / TBL / LAK'}
    # Wrong count scope (rates) and wrong strength (PK on-ice): refused before any cell is read.
    for key, name, group in [('ratesPage', '2026-10-01-allStrengthsRates', 'individual'), ('pkOnIcePage', '2026-09-30-penaltyKillRatesOi', 'onIce')]:
        b, m = page(name); d = name[:10]
        w = next(x for x in request['wgo']['rows'] if x['date'] == d)
        s = next(x for x in request[group]['rows'] if x['date_scraped'] == d and x['player_id'] == w['player_id'])
        res = lineage.check(expected(group, w, s), b, receipt(b, m['sourceUrl'], m['receivedAt']), ['a' * 64])
        out[key] = {'outcome': res['reason'] if res['state'] == 'held' else res['state']}
    # Writes ONLY to an explicit path (tests pass a scratch path; the committed copy was regenerated by hand).
    if len(sys.argv) > 1: Path(sys.argv[1]).write_text(json.dumps(out, indent=2, sort_keys=True) + '\n')
    print(json.dumps(out, sort_keys=True))


if __name__ == '__main__':
    sys.addaudithook(lambda event, _a: (_ for _ in ()).throw(RuntimeError('offline')) if event.startswith('socket.') else None)
    main()

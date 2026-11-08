"""Offline metadata recount at the retained request's original time. No score or policy change."""
from datetime import date, datetime
from pathlib import Path
from collections import Counter
import hashlib
import json
import sys

BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
INPUTS = {
    'request': ('current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json', 'c6d1d13dc7327baa54742c3eb7efe0a1e5d96c6ef6ffefc66de23f4092c12ba2'),
    'profiles': ('nst-selected-receipt-intake-20261101-01/intake-02/PROFILES.json', '7cbd9fafc6be4e858817072c0d3004ab3468db4d2c497ba2262dcbd03162735b'),
    'rows': ('nst-selected-receipt-intake-20261101-01/intake-02/ROWS.json', 'c019d4647c3cab1b4d76a0756e83be07464fe80171be5b86980b72fc548ffd6a'),
}


def main():
    data = {}
    for key, (relative, sha) in INPUTS.items():
        raw = (BASE / relative).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == sha, f'{key}: input drift'
        data[key] = json.loads(raw)
    request = data['request']
    assert request['seasonId'] == 20262027
    as_of = datetime.fromisoformat(request['asOfUTC']).date()
    cutoff = date.fromisoformat(request['eventThroughDate'])
    limit = request['freshnessPolicy']['maxEventAgeDays']
    rows = {row['sourceId']: row for row in data['rows']}
    assert len(rows) == len(data['rows']) == 3461
    assert all('2026-07-01' <= row['date'] < '2027-07-01' for row in rows.values())
    five = [profile for profile in data['profiles'] if len(profile['sourceIds']) == 5]
    windows = [sorted(rows[sid]['date'] for sid in profile['sourceIds']) for profile in five]
    # Minimum/maximum dates give an independent equivalent of the per-row age count.
    last_recent = sum((as_of - date.fromisoformat(days[-1])).days <= limit for days in windows)
    all_recent_as_of = sum(all((as_of - date.fromisoformat(day)).days <= limit for day in days) for days in windows)
    all_recent_cutoff = sum((cutoff - date.fromisoformat(days[0])).days <= limit for days in windows)
    assert all_recent_as_of == sum((as_of - date.fromisoformat(days[0])).days <= limit for days in windows)
    example = next((profile, days) for profile, days in zip(five, windows) if (as_of - date.fromisoformat(days[0])).days == limit + 1)
    return {
        'scope': 'Retained current-season window membership at the original November 1 as-of, not current eligibility or empirical validation',
        'asOfUTC': request['asOfUTC'], 'eventThroughDate': request['eventThroughDate'],
        'maxEventAgeDays': limit, 'profiles': len(data['profiles']), 'fiveRecordProfiles': len(five),
        'lastEventWithinLimitAtAsOf': last_recent,
        'everyEventWithinLimitAtAsOf': all_recent_as_of,
        'everyEventWithinLimitAtEventCutoff': all_recent_cutoff,
        'oldestEventAgeAtAsOfDistribution': dict(sorted(Counter((as_of - date.fromisoformat(days[0])).days for days in windows).items())),
        'example': {'playerId': example[0]['playerId'], 'name': example[0]['name'], 'dates': example[1]},
        'inputPins': INPUTS, 'sourceQualifiedRows': 0, 'scoresComputed': 0,
        'policyChanged': False, 'holdoutRead': False, 'networkCalls': 0,
    }


if __name__ == '__main__':
    def offline(event, _args):
        if event.startswith('socket.'):
            raise RuntimeError('offline_only')
    sys.addaudithook(offline)
    print(json.dumps(main(), indent=2))

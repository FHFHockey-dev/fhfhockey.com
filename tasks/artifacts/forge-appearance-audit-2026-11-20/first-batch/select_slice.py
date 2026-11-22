"""Reproduce pilot 1 offline from the sealed decision manifest."""
import csv
import gzip
import hashlib
import sys
from collections import defaultdict
from pathlib import Path

parent, target = map(Path, sys.argv[1:])
assert hashlib.sha256(parent.read_bytes()).hexdigest() == 'f71f2e195731677664ddaa5419c710bfd43d74b1523832ef74cd81e6ae95e275'
groups = defaultdict(list)
with gzip.open(parent, 'rt') as stream:
    reader = csv.DictReader(stream)
    fields = reader.fieldnames
    for row in reader:
        if row['window_scope'] == 'absence1095':
            assert row['game_id'] == row['new_game'] == row['source_game']
            assert row['season'] == row['new_season'] == row['source_season']
            assert row['team_id'] != row['new_team'] == row['source_team'] and row['status'] == 'resolved'
            groups[row['player_id'], row['game_date']].append(row)
assert len(groups) == 2900 and all(sorted(r['strength_state'] for r in g) == ['all','ev','pp'] for g in groups.values())

# Both sides, both membership flags and latest/deeper lookup. All wrong-team events belong to one player.
strata = [
    ('wrong_team','t','f','away'), ('wrong_team','f','f','home'),
    ('missing_team','t','t','home'), ('missing_team','t','t','away'),
    ('missing_team','t','f','home'), ('missing_team','f','t','away'),
    ('missing_team','f','t','home'), ('missing_team','f','t','away'),
    ('missing_team','f','f','away'), ('missing_team','f','f','home'),
    ('missing_team','f','f','away'), ('missing_team','f','f','home'),
]
picked = []
for stratum in strata:
    candidates = [k for k, g in groups.items() if k not in picked and
                  tuple(g[0][c] for c in ('defects','latest','current_member','event_side')) == stratum]
    def rank(k):
        return (k[0] in {p[0] for p in picked},
                groups[k][0]['new_team'] in {groups[p][0]['new_team'] for p in picked},
                hashlib.sha256('|'.join(('FORGE team pilot 1', *k)).encode()).digest())
    picked.append(min(candidates, key=rank))
with target.open('x', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    for key in sorted(picked):
        writer.writerows(sorted(groups[key], key=lambda r: r['strength_state']))
print(hashlib.sha256(target.read_bytes()).hexdigest())

"""Bounded local SoS evidence inventory. No network, credentials, models or DB imports."""
import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(repo, derived):
    manifest_path = repo / 'tasks/artifacts/forge-skater-candidates-2026-10-22/task3-local-search.json'
    manifest = json.loads(manifest_path.read_text())
    old_hashes = {r['sha256'] for g in manifest['groups'] for r in g['captures']}
    groups = []
    for group in manifest['groups']:
        paths = [Path(row['path']) for row in group['captures']]
        groups.append({'variant': group['variant'], 'listed': len(paths),
                       'present': sum(p.is_file() for p in paths),
                       'missing_paths': [str(p) for p in paths if not p.is_file()]})
    planner_path = repo / 'tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/schedule-2025-03-17_04-07.json'
    planner = json.loads(planner_path.read_text())
    cells = [(team, date, cell) for team, dates in planner['schedule'].items() for date, cell in dates.items()]
    reciprocity = []
    for team, date, cell in cells:
        other = planner['schedule'].get(cell['opponent'], {}).get(date)
        if not other or other['opponent'] != team or other['home'] == cell['home']:
            reciprocity.append([team, date])
    by_date = Counter(date for _, date, _ in cells)
    planner_result = {'path': str(planner_path), 'sha256': digest(planner_path),
        'dates': [min(planner['dates']), max(planner['dates'])], 'date_count': len(planner['dates']),
        'team_count': len(planner['teams']), 'team_date_cells': len(cells),
        'reciprocity_errors': reciprocity, 'games_from_reciprocal_cells': len(cells) // 2 if not reciprocity else None,
        'per_date_counts_match': [by_date[d] / 2 for d in planner['dates']] == planner['gamesPerDate'],
        'cell_keys': sorted({key for _, _, cell in cells for key in cell}),
        'qualification': 'calendar-only; lacks canonical fixture IDs, precise starts, outcomes and revision availability'}
    derived_manifest_path = derived / 'TRANSFORMATION-MANIFEST.json'
    derived_manifest = json.loads(derived_manifest_path.read_text())
    samples = []
    # Exactly two already identified bookend files; never parse the whole 1 GiB cohort.
    for entry in [derived_manifest['files'][0], derived_manifest['files'][-1]]:
        path = derived / entry['file']
        raw = path.read_bytes()
        data = json.loads(raw)
        sources = {}
        for read in data['reads']:
            first = read.get('request', [{}])[0]
            table = first.get('args', [None])[0] if first.get('method') == 'from' else None
            if table not in {'games', 'teams', 'pbp_games', 'nhl_team_data', 'wgo_team_stats',
                             'nst_team_all', 'forge_team_game_strength', 'nhl_api_game_payloads_raw',
                             'player_forecast_season_schedule_snapshots', 'player_forecast_schedule_revisions'}:
                continue
            values = read.get('result', {}).get('data')
            rows = values if isinstance(values, list) else [values] if isinstance(values, dict) else []
            info = sources.setdefault(table, {'reads': 0, 'returned_rows': 0, 'keys': set()})
            info['reads'] += 1
            info['returned_rows'] += len(rows)
            for row in rows:
                info['keys'].update(row)
        for info in sources.values():
            info['keys'] = sorted(info['keys'])
        acquired = data['originalAcquiredAt']
        cutoff = data['declaredInputCutoff']
        samples.append({'file': str(path), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest(),
            'matches_transformation_manifest': hashlib.sha256(raw).hexdigest() == entry['derivedFileSha256'],
            'classification': data['classification'], 'heldout': data['heldout'], 'prospective': data['prospective'],
            'original_acquired_at': acquired, 'declared_input_cutoff': cutoff,
            'acquired_after_cutoff': datetime.fromisoformat(acquired.replace('Z', '+00:00')) > datetime.fromisoformat(cutoff.replace('Z', '+00:00')),
            'sources': sources})
    return {'generated_at': datetime.now(timezone.utc).isoformat(), 'mode': 'local metadata and two derived samples only',
        'old_capture_manifest': {'path': str(manifest_path), 'sha256': digest(manifest_path), 'groups': groups},
        'old_audit_extract': {'path': manifest['audit']['path'], 'present': Path(manifest['audit']['path']).is_file()},
        'planner': planner_result,
        'durable_derived': {'manifest': str(derived_manifest_path), 'manifest_sha256': digest(derived_manifest_path),
            'classification': derived_manifest['classification'], 'files_listed': len(derived_manifest['files']),
            'files_present': sum((derived / e['file']).is_file() for e in derived_manifest['files']),
            'total_bytes': sum((derived / e['file']).stat().st_size for e in derived_manifest['files'] if (derived / e['file']).is_file()),
            'original_hash_overlap_with_old_248': sum(e['originalFileSha256'] in old_hashes for e in derived_manifest['files']),
            'samples': samples, 'all_payloads_parsed_or_hash_verified': False},
        'decision': 'No qualified as-of NHL SoS comparison cohort established by inspected local evidence',
        'model_experiments': 0, 'synthetic_tests_added': 0, 'network_requests': 0, 'production_reads': 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--derived', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = inventory(args.repo, args.derived)
    with args.out.open('x') as handle:
        json.dump(result, handle, indent=2)
        handle.write('\n')
    print(json.dumps({'output': str(args.out), 'old_captures_present': sum(g['present'] for g in result['old_capture_manifest']['groups']),
                      'derived_files_present': result['durable_derived']['files_present'], 'planner': result['planner'],
                      'decision': result['decision']}))

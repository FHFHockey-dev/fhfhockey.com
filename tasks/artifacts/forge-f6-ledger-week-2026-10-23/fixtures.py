#!/usr/bin/env python3
"""Generate small, deterministic synthetic exports. No retained/production data."""
from datetime import date, timedelta
import json
import sys
from audit import BASELINE, SCHEMA, SKATER, GOALIE, CAPS, fingerprint, pk


def build():
    b = {'schema_version': SCHEMA, 'meta': {
        'synthetic': True, 'release_sha': BASELINE, 'from_date': '2026-10-23', 'to_date': '2026-10-29',
        'season_id': 20262027, 'observed_at': '2026-10-30T12:00:00+00:00',
        'complete_export': True, 'truncated': False, 'export_receipt_ref': 'synthetic:export'},
         'calendar': [], **{k: [] for k in CAPS}}
    for i in range(7):
        day = str(date(2026, 10, 23) + timedelta(days=i))
        nxt = str(date(2026, 10, 24) + timedelta(days=i))
        issued, served = day+'T12:00:00+00:00', day+'T12:30:00+00:00'
        scheduled, final, settled = day+'T23:00:00+00:00', nxt+'T02:00:00+00:00', nxt+'T11:00:00+00:00'
        run, game = 'synthetic-run-'+str(i), 9000+i
        b['runs'].append({'run_id': run, 'git_sha': BASELINE, 'status': 'succeeded',
                          'created_at': issued, 'as_of_date': day})
        b['calendar'].append({'date': day, 'game_ids': [game], 'complete': True, 'receipt_ref': 'synthetic:schedule'})
        b['games'].append({'game_id': game, 'date': day, 'team_ids': [1, 2], 'scheduled_at': scheduled,
                          'final_at': final, 'final': True, 'skater_population_complete': True,
                          'dressed_skater_ids_by_team': {'1': list(range(100, 106)), '2': list(range(106, 110))},
                          'receipt_ref': 'synthetic:complete-ingestion'})
        for j in range(12):
            cls, dressed = ('goalie' if j == 11 else 'skater'), j != 10
            heads = ({'goals': .1*(j+1), 'assists': .2*(j+1), 'pp_points': .285,
                      'shots': j+1, 'hits': 1, 'blocks': 1} if cls == 'skater' else
                     {'saves': 25, 'goals_against': 2, 'win': .5, 'shutout': .1})
            weights = SKATER if cls == 'skater' else GOALIE
            u = {'season_id': 20262027, 'served_date': day, 'player_class': cls,
                 'player_id': j+100, 'game_id': game, 'team_id': 1 if j < 6 else 2,
                 'dressed': dressed, 'position_at_game': 'D' if j % 3 == 0 else 'F',
                 'receipt_ref': 'synthetic:independent-population',
                 **{'act_'+h: v if dressed else 0 for h, v in heads.items()}}
            b['universe'].append(u)
            for source in ['bridge_exact', 'naive_last5', 'naive_season']:
                r = {k: u[k] for k in ['season_id', 'served_date', 'player_class', 'player_id', 'game_id', 'team_id', 'dressed']}
                r.update(source=source, scheduled_at=scheduled, issued_at=issued, cutoff_at=issued,
                         expires_at=scheduled, run_id=run if source == 'bridge_exact' else None,
                         source_watermark='synthetic', method_version='synthetic-v1', participation_probability=1,
                         start_probability=1 if cls == 'goalie' else None, started=True if cls == 'goalie' else None,
                         settled_at=settled, outcome_source='synthetic:actuals')
                for h, v in heads.items():
                    r['exp_'+({'win': 'win_prob', 'shutout': 'shutout_prob'}.get(h, h))] = v
                    r['act_'+h] = u['act_'+h]
                r['exp_fantasy_points'] = sum(heads[h]*w for h, w in weights.items())
                r['act_fantasy_points'] = sum(u['act_'+h]*w for h, w in weights.items())
                b['ledger'].append(r)
                b['issuance'].append({'key': list(pk(r)), 'forecast_sha256': fingerprint(r), 'revision_count': 1,
                                      'complete_history': True, 'served_at': served, 'receipt_ref': 'synthetic:archive'})
            if cls == 'skater':
                b['projections'].append({'run_id': run, 'as_of_date': day, 'horizon_games': 1, 'game_id': game,
                    'player_id': j+100, 'team_id': u['team_id'], 'created_at': issued, 'updated_at': issued,
                    'proj_goals_es': heads['goals'], 'proj_goals_pp': .1,
                    'proj_assists_es': heads['assists'], 'proj_assists_pp': .185,
                    'proj_shots_es': heads['shots'], 'proj_shots_pp': .2, 'proj_hits': 1, 'proj_blocks': 1})
                b['rolling'].append({'season': 20262027, 'game_date': day, 'game_id': game, 'player_id': j+100,
                    'strength_state': 'ev', 'updated_at': nxt+'T10:00:00+00:00',
                    'sog_per_60_last5': 4, 'hits_per_60_last5': None if j == 0 else 0 if j == 1 else 2,
                    'blocks_per_60_last5': 0 if j == 2 else 1})
    b['baseline_receipt'] = {'verified': True, 'git_sha': BASELINE, 'run_id': b['runs'][0]['run_id'],
        'issued_at': b['runs'][0]['created_at'], 'first_served_date': '2026-10-23',
        'served_at': '2026-10-23T12:30:00+00:00',
        'receipt_ref': 'synthetic:first-issued-not-a-production-claim', 'earlier_release_rows_checked': True}
    recount(b)
    return b


def recount(b):
    b['meta']['row_counts'] = {k: len(b[k]) for k in CAPS}


def resign(b):
    by_key = {pk(r): r for r in b['ledger']}
    for receipt in b['issuance']:
        r = by_key.get(tuple(receipt['key']))
        if r:
            receipt['forecast_sha256'] = fingerprint(r)


if __name__ == '__main__':
    b = build()
    if len(sys.argv) > 1:
        case = sys.argv[1]
        if case == 'mixed':
            b['runs'][-1]['git_sha'] = 'a'*40
        elif case == 'incomplete':
            b['games'][0]['skater_population_complete'] = False
        elif case == 'unverified-issuance':
            b['baseline_receipt']['verified'] = False
        else:
            raise SystemExit('cases: mixed, incomplete, unverified-issuance')
    print(json.dumps(b, indent=2, sort_keys=True))

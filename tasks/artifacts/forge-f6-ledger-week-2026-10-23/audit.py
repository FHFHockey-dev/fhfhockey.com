#!/usr/bin/env python3
"""F6 offline evaluator. Reads one JSON file; never imports a DB/network client."""
import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import sys

BASELINE = 'd4c2632d39ee8a59fa683f44a0e1d21c55db66bd'
SCHEMA = 'f6-ledger-week-v1'
SKATER = {'goals': 3, 'assists': 2, 'pp_points': 1, 'shots': .2, 'hits': .2, 'blocks': .25}
GOALIE = {'saves': .2, 'goals_against': -1, 'win': 4, 'shutout': 3}
RATES = ['sog_per_60_last5', 'hits_per_60_last5', 'blocks_per_60_last5']
PROJECTIONS = ['proj_goals_es', 'proj_goals_pp', 'proj_assists_es', 'proj_assists_pp',
               'proj_shots_es', 'proj_shots_pp', 'proj_hits', 'proj_blocks']
CAPS = {'ledger': 20000, 'runs': 500, 'projections': 10000, 'rolling': 12000,
        'games': 250, 'universe': 6000, 'issuance': 20000}
IDENTITY = ['season_id', 'served_date', 'player_class', 'player_id', 'game_id']
FORECAST_FIELDS = IDENTITY + ['source', 'team_id', 'scheduled_at', 'run_id', 'method_version',
    'source_watermark', 'cutoff_at', 'issued_at', 'expires_at', 'participation_probability',
    'start_probability'] + ['exp_' + h for h in list(SKATER) +
    ['saves', 'goals_against', 'shots_against', 'win_prob', 'shutout_prob', 'fantasy_points']]


def number(v):
    return type(v) in (int, float) and math.isfinite(v)


def stamp(s):
    if not isinstance(s, str):
        raise ValueError('timestamp missing')
    v = datetime.fromisoformat(s.replace('Z', '+00:00'))
    if v.tzinfo is None:
        raise ValueError('timestamp requires timezone')
    return v


def key(row):
    return tuple(row.get(k) for k in IDENTITY)


def pk(row):
    return tuple(row.get(k) for k in ['served_date', 'player_id', 'game_id', 'source'])


def fingerprint(row):
    # Numeric JSON variants (1 versus 1.0) must not change a forecast digest.
    obj = {k: float(row[k]) if number(row.get(k)) else row.get(k) for k in FORECAST_FIELDS}
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def exp_key(head):
    return 'exp_' + ({'win': 'win_prob', 'shutout': 'shutout_prob'}.get(head, head))


def stats(rows):
    pairs = [(r.get('exp_fantasy_points'), r.get('act_fantasy_points')) for r in rows]
    pairs = [(e, a) for e, a in pairs if number(e) and number(a)]
    n = len(pairs)
    if not n:
        return {'n': 0, 'bias': None, 'actual_over_expected': None, 'mae': None, 'rmse': None}
    e, a = sum(x[0] for x in pairs), sum(x[1] for x in pairs)
    return {'n': n, 'expected_sum': e, 'actual_sum': a, 'bias': (e-a)/n,
            'actual_over_expected': a/e if e else None,
            'mae': sum(abs(x-y) for x, y in pairs)/n,
            'rmse': math.sqrt(sum((x-y)**2 for x, y in pairs)/n),
            'median_actual': statistics.median(y for _, y in pairs),
            'share_below_expected': sum(y < x for x, y in pairs)/n}


def missingness(rows, fields):
    return {f: {'rows': len(rows), 'missing': sum(r.get(f) is None for r in rows),
                'invalid': sum(r.get(f) is not None and not number(r.get(f)) for r in rows),
                'zero': sum(number(r.get(f)) and r[f] == 0 for r in rows)} for f in fields}


def deciles(rows):
    # PostgreSQL ntile(10): larger buckets first, stable identity tie breaker; no outcome sorting.
    rows = sorted(rows, key=lambda r: (r['exp_fantasy_points'], key(r)))
    q, rem = divmod(len(rows), 10)
    out, offset = [], 0
    for i in range(10):
        size = q + (i < rem)
        chunk = rows[offset:offset+size]
        out.append({'decile': i+1, **stats(chunk)})
        offset += size
    return out


def q3(rows):
    dressed = [r for r in rows if r.get('dressed') is True]
    weights = SKATER if rows[0]['player_class'] == 'skater' else GOALIE
    weighted = {}
    for head, w in weights.items():
        pairs = [(r.get(exp_key(head)), r.get('act_'+head)) for r in dressed]
        pairs = [(e, a) for e, a in pairs if number(e) and number(a)]
        weighted[head] = {'n': len(pairs), 'weighted_bias':
                         w*sum(e-a for e, a in pairs)/len(pairs) if pairs else None}
    return {'dressed_only': stats(dressed), 'pooled_diagnostic': stats(rows),
            'non_dressed': sum(r.get('dressed') is False for r in rows),
            'unknown_participation': sum(type(r.get('dressed')) is not bool for r in rows),
            'weighted_bias': weighted,
            'category_presence': missingness(rows, [f for h in weights for f in [exp_key(h), 'act_'+h]]),
            'goalie_per_start': stats([r for r in dressed if r.get('started') is True])
                                if rows[0]['player_class'] == 'goalie' else None}


def audit(bundle):
    issues = []
    def require(condition, code):
        if not condition:
            issues.append(code)
    require(bundle.get('schema_version') == SCHEMA, 'unsupported_schema')
    meta = bundle['meta']
    start, end = date.fromisoformat(meta['from_date']), date.fromisoformat(meta['to_date'])
    require(6 <= (end-start).days <= 13, 'window_must_span_7_to_14_calendar_days')
    days = [(start+timedelta(days=i)).isoformat() for i in range((end-start).days+1)]
    observed = stamp(meta['observed_at'])
    require(meta.get('release_sha') == BASELINE, 'wrong_release_baseline')
    require(type(meta.get('synthetic')) is bool, 'missing_synthetic_provenance')
    require(meta.get('complete_export') is True and meta.get('truncated') is False,
            'incomplete_export')
    require(bool(meta.get('export_receipt_ref')), 'missing_export_receipt')
    for table, cap in CAPS.items():
        require(isinstance(bundle.get(table), list), 'missing_table:'+table)
        require(len(bundle[table]) <= cap, 'row_cap_exceeded:'+table)
        require(meta.get('row_counts', {}).get(table) == len(bundle[table]), 'row_count_mismatch:'+table)
    ledger = bundle['ledger']
    def unique_index(rows, fn, label):
        counts = Counter(fn(r) for r in rows)
        require(all(v == 1 for v in counts.values()), 'duplicate_or_reissued:'+label)
        return {fn(r): r for r in rows if counts[fn(r)] == 1}
    unique_index(ledger, pk, 'ledger_primary_key')
    # One appearance cannot be counted on multiple served days in this game-day audit.
    unique_index(ledger, lambda r: (r.get('season_id'), r.get('player_class'), r.get('player_id'),
                                   r.get('game_id'), r.get('source')), 'repeated_player_game')
    runs = unique_index(bundle['runs'], lambda r: r.get('run_id'), 'run_id')
    universe = unique_index(bundle['universe'], key, 'universe')
    games = unique_index(bundle['games'], lambda r: r.get('game_id'), 'game_id')
    receipts = unique_index(bundle['issuance'], lambda r: tuple(r['key']), 'issuance')
    selected = [r for r in ledger if r['source'] == 'bridge_exact' and r['player_class'] == 'skater']
    require(bool(selected), 'no_primary_cohort')
    cohort_shas = {runs.get(r.get('run_id'), {}).get('git_sha') for r in selected}
    require(cohort_shas == {BASELINE}, 'incomplete_or_mixed_version_primary_cohort')
    methods = {r.get('method_version') for r in selected}
    require(len(methods) == 1 and all(isinstance(m, str) and m for m in methods), 'mixed_or_unknown_serving_method')
    first = bundle.get('baseline_receipt', {})
    require(first.get('verified') is True and bool(first.get('receipt_ref')), 'unverified_first_issuance')
    require(first.get('git_sha') == BASELINE, 'first_issuance_wrong_sha')
    require(first.get('first_served_date') == meta['from_date'], 'window_not_from_first_served_day')
    first_run = runs.get(first.get('run_id'), {})
    require(first_run.get('created_at') == first.get('issued_at') and first_run.get('git_sha') == BASELINE,
            'first_issuance_run_receipt_mismatch')
    require(any(r.get('run_id') == first.get('run_id') and r.get('issued_at') == first.get('issued_at')
                and r.get('served_date') == meta['from_date'] and r['source'].startswith('bridge_')
                for r in ledger), 'first_issuance_not_in_ledger')
    # These are external proof references, not booleans invented from current ledger rows.
    require(first.get('earlier_release_rows_checked') is True, 'first_issuance_lower_bound_unproven')
    baseline_rows = [r for r in ledger if r['source'].startswith('bridge_')
                     and runs.get(r.get('run_id'), {}).get('git_sha') == BASELINE]
    require(bool(baseline_rows) and first.get('issued_at') == min(r['issued_at'] for r in baseline_rows),
            'first_issuance_not_earliest_retained')
    require(first.get('served_at') == min((receipts.get(pk(r), {}).get('served_at', '')
            for r in baseline_rows), default=None), 'first_served_receipt_mismatch')
    calendar = bundle['calendar']
    require([d.get('date') for d in calendar] == days, 'incomplete_or_unordered_calendar')
    for d in calendar:
        expected = set(d['game_ids'])
        actual = {g['game_id'] for g in bundle['games'] if g['date'] == d['date']}
        require(expected == actual and d.get('complete') is True and bool(d.get('receipt_ref')),
                'incomplete_schedule:'+d['date'])
    for g in bundle['games']:
        require(g['date'] in days, 'game_outside_window')
        for team in g['team_ids']:
            listed = g.get('dressed_skater_ids_by_team', {}).get(str(team))
            actual_ids = [u['player_id'] for u in bundle['universe'] if u['game_id'] == g['game_id']
                          and u['team_id'] == team and u['player_class'] == 'skater' and u.get('dressed') is True]
            require(isinstance(listed, list) and len(listed) == len(set(listed))
                    and set(listed) == set(actual_ids), 'independent_dressed_population_mismatch')
        require(g.get('final') is True and g.get('skater_population_complete') is True
                and bool(g.get('receipt_ref')), 'incomplete_settlement_scope:'+str(g['game_id']))
        require(stamp(g['final_at']) <= observed, 'future_finality')
        require(stamp(g['scheduled_at']) < stamp(g['final_at']), 'final_before_start')
        require(bool([u for u in bundle['universe'] if u['game_id'] == g['game_id']
                      and u['player_class'] == 'skater' and u.get('dressed') is True]), 'empty_game_universe')
    for u in bundle['universe']:
        g = games.get(u['game_id'])
        require(g is not None and u['served_date'] == g['date'] and u['team_id'] in g['team_ids'],
                'universe_game_identity')
        require(type(u.get('dressed')) is bool and u.get('season_id') == meta['season_id']
                and bool(u.get('receipt_ref')), 'unproven_universe_membership')
        require(u.get('position_at_game') in ('F', 'D', None), 'invalid_historical_position')
    for r in ledger:
        require(r['served_date'] in days and r['season_id'] == meta['season_id'], 'ledger_outside_window')
        require(r['player_class'] in ('skater', 'goalie'), 'invalid_player_class')
        require(r['source'] in ('bridge_exact', 'bridge_reaimed', 'native', 'naive_last5', 'naive_season'), 'unsupported_source')
        g, u = games.get(r['game_id']), universe.get(key(r))
        require(g is not None and r['served_date'] == g['date'] and r['scheduled_at'] == g['scheduled_at'],
                'ledger_game_identity')
        require(u is not None and type(r.get('dressed')) is bool and r.get('dressed') == u.get('dressed')
                and r['team_id'] == u.get('team_id'), 'participation_or_denominator_conflict')
        receipt = receipts.get(pk(r), {})
        require(receipt.get('revision_count') == 1 and receipt.get('complete_history') is True
                and bool(receipt.get('receipt_ref')), 'unproven_or_reissued_forecast')
        require(receipt.get('forecast_sha256') == fingerprint(r), 'forecast_receipt_hash_mismatch')
        issued, cutoff = stamp(r['issued_at']), stamp(r['cutoff_at'])
        snapshot, scheduled = stamp(receipt['served_at']), stamp(r['scheduled_at'])
        require(cutoff <= issued <= snapshot < scheduled and snapshot <= observed, 'invalid_forecast_chronology')
        settled = stamp(r['settled_at'])
        require(g is not None and stamp(g['final_at']) <= settled <= observed, 'unsettled_or_nonfinal_row')
        require(bool(r.get('outcome_source')), 'missing_outcome_source')
        if r['source'].startswith('bridge_'):
            run = runs.get(r.get('run_id'), {})
            require(run.get('status') == 'succeeded' and bool(re.fullmatch('[0-9a-f]{40}', run.get('git_sha') or '')),
                    'unversioned_or_failed_run')
            require(run.get('created_at') == r['issued_at'], 'run_issuance_mismatch')
            require(r['source'] != 'bridge_exact' or run.get('as_of_date') == r['served_date'], 'not_exact_run_date')
        weights = SKATER if r['player_class'] == 'skater' else GOALIE
        for prefix in ['exp', 'act']:
            fields = [exp_key(h) if prefix == 'exp' else 'act_'+h for h in weights]
            valid = all(number(r.get(f)) and r[f] >= 0 for f in fields)
            require(valid, 'missing_or_invalid_category:'+prefix+':'+r['source'])
            fp = r.get(prefix+'_fantasy_points')
            require(number(fp) and valid and abs(fp-sum(r[f]*w for f, w in zip(fields, weights.values()))) <= .00011,
                    'fp_weight_or_missingness_mismatch:'+prefix)
        if u:
            for h in weights:
                require(number(u.get('act_'+h)) and u['act_'+h] == r.get('act_'+h), 'actual_receipt_conflict:'+h)
    eligible = [u for u in bundle['universe'] if u['player_class'] == 'skater' and u.get('dressed') is True]
    dressed = [r for r in selected if r.get('dressed') is True]
    require({key(r) for r in dressed} == {key(u) for u in eligible}, 'incomplete_primary_dressed_coverage')
    settled_days = sorted({r['served_date'] for r in dressed})
    require(len(settled_days) >= 7, 'fewer_than_seven_settled_game_days')
    # No first/last cherry-picking or skipping an unsettled scheduled game.
    require(set(settled_days) == {g['date'] for g in bundle['games']}, 'missing_game_day')

    # Q6: all served h1 physical/PP lines; per-run duplicates are errors. Extra reissued runs
    # remain separately visible rather than changing the denominator by pooling all runs.
    projections = unique_index(bundle['projections'], lambda p: (p['run_id'], p['game_id'], p['player_id'], p['horizon_games']), 'h1')
    h1 = []
    for r in selected:
        p = projections.get((r['run_id'], r['game_id'], r['player_id'], 1))
        require(p is not None, 'missing_served_h1_projection')
        if p is not None:
            require(p['as_of_date'] == r['served_date'] and p['team_id'] == r['team_id'], 'h1_identity_mismatch')
            require(stamp(p['created_at']) <= stamp(p['updated_at']) <= stamp(receipts.get(pk(r), {})['served_at']),
                    'h1_modified_after_serving')
            require(all(number(p.get(f)) and p[f] >= 0 for f in PROJECTIONS), 'missing_h1_category')
            h1.append((r, p))
    for p in bundle['projections']:
        require(p['run_id'] in runs and p['horizon_games'] == 1, 'unknown_run_or_non_h1')
    rolling = bundle['rolling']
    unique_index(rolling, lambda r: (r['season'], r['game_date'], r['game_id'], r['player_id'], r['strength_state']), 'rolling_ev')
    for r in rolling:
        require(r['strength_state'] == 'ev' and r['season'] == meta['season_id']
                and start-timedelta(days=7) <= date.fromisoformat(r['game_date']) <= end, 'rolling_scope_mismatch')
        require(stamp(r['updated_at']) <= observed, 'future_rolling_update')
    require(bool(rolling), 'missing_q5_diagnostic')
    q5 = [{'game_date': day, 'rates': missingness([r for r in rolling if r['game_date'] == day], RATES)}
          for day in sorted({r['game_date'] for r in rolling})]
    groups = defaultdict(list)
    for r in ledger:
        sha = runs.get(r.get('run_id'), {}).get('git_sha') or 'UNVERSIONED_CONTROL_OR_NATIVE'
        groups[(sha, r['source'], r['player_class'])].append(r)
    parts = [{'git_sha': s, 'source': src, 'player_class': cls, 'q3': q3(rows),
              'q4': deciles([r for r in rows if r.get('dressed') is True
                        and number(r.get('exp_fantasy_points')) and number(r.get('act_fantasy_points'))])
                        if cls == 'skater' else None}
             for (s, src, cls), rows in sorted(groups.items())]
    q6 = []
    for sha, run_id in sorted({(runs[p['run_id']].get('git_sha') or 'UNKNOWN', p['run_id'])
                              for p in bundle['projections'] if p['run_id'] in runs}):
        ps = [p for p in bundle['projections'] if p['run_id'] == run_id]
        known = [p for p in ps if all(number(p.get(f)) for f in PROJECTIONS)]
        pg = sum(p['proj_goals_pp'] for p in known)
        q6.append({'git_sha': sha, 'run_id': run_id, 'as_of_date': runs[run_id]['as_of_date'],
                   'rows': len(ps), 'complete_category_rows': len(known), 'missingness': missingness(ps, PROJECTIONS),
                   'mean_fp': sum(3*(p['proj_goals_es']+p['proj_goals_pp'])
                        +2*(p['proj_assists_es']+p['proj_assists_pp'])+p['proj_goals_pp']+p['proj_assists_pp']
                        +.2*(p['proj_shots_es']+p['proj_shots_pp'])+.2*p['proj_hits']+.25*p['proj_blocks']
                        for p in known)/len(known) if known else None,
                   'mean_hits': sum(p['proj_hits'] for p in known)/len(known) if known else None,
                   'mean_blocks': sum(p['proj_blocks'] for p in known)/len(known) if known else None,
                   'served_rows': sum(p['run_id'] == run_id for _, p in h1),
                   'pp_a_per_pp_g': sum(p['proj_assists_pp'] for p in known)/pg if pg else None,
                   'zero_hit_fraction': sum(p.get('proj_hits') == 0 for p in known)/len(known) if known else None,
                   'zero_blk_fraction': sum(p.get('proj_blocks') == 0 for p in known)/len(known) if known else None})
    # All diagnostics above may be partial. Qualification uses the same complete dressed denominator.
    metrics = q3(selected) if selected else {}
    bins = deciles([r for r in dressed if number(r.get('exp_fantasy_points')) and number(r.get('act_fantasy_points'))])
    complete_h1 = [p for r, p in h1 if r.get('dressed') is True and all(number(p.get(f)) for f in PROJECTIONS)]
    pg = sum(p['proj_goals_pp'] for p in complete_h1)
    pp_ratio = sum(p['proj_assists_pp'] for p in complete_h1)/pg if pg else None
    zero = {h: sum(p['proj_'+h] == 0 for p in complete_h1)/len(complete_h1) if complete_h1 else None for h in ['hits', 'blocks']}
    def between(v, lo, hi):
        return number(v) and lo-1e-12 <= v <= hi+1e-12
    s = metrics.get('dressed_only', {})
    targets = {'fp_abs_bias_le_0_10': between(s.get('bias'), -.1, .1),
               'fp_actual_expected_0_95_to_1_05': between(s.get('actual_over_expected'), .95, 1.05),
               'decile_10_0_9_to_1_1': between(bins[9].get('actual_over_expected'), .9, 1.1),
               'each_weighted_bias_le_0_03': all(between(v['weighted_bias'], -.03, .03)
                        for v in metrics.get('weighted_bias', {}).values()) and bool(metrics),
               'zero_hit_lt_0_10': number(zero['hits']) and zero['hits'] < .1,
               'zero_blk_lt_0_10': number(zero['blocks']) and zero['blocks'] < .1,
               'pp_assists_per_goal_1_8_to_1_91': between(pp_ratio, 1.8, 1.91)}
    pairs = []
    for source in ['bridge_reaimed', 'naive_last5', 'naive_season']:
        source_groups = defaultdict(list)
        for r in ledger:
            if r['source'] == source and r['player_class'] == 'skater':
                source_groups[runs.get(r.get('run_id'), {}).get('git_sha') or 'UNVERSIONED_CONTROL_OR_NATIVE'].append(r)
        if not source_groups:
            source_groups['UNAVAILABLE'] = []
        for comparison_sha, rows in sorted(source_groups.items()):
            other = {key(r): r for r in rows}
            shared = [(r, other[key(r)]) for r in dressed if key(r) in other and other[key(r)].get('dressed') is True]
            pairs.append({'source': source, 'comparison_git_sha': comparison_sha,
                          'paired_n': len(shared), 'baseline_only': len(dressed)-len(shared),
                          'baseline': stats([a for a, _ in shared]), 'comparison': stats([b for _, b in shared]),
                          'qualification': 'diagnostic_only_same_player_games'})
    positions = {}
    for pos in ['F', 'D', 'UNKNOWN']:
        rs = [r for r in dressed if (universe.get(key(r), {}).get('position_at_game') or 'UNKNOWN') == pos]
        positions[pos] = stats(rs)
    return {'schema_version': SCHEMA, 'synthetic': meta.get('synthetic') is True,
            'release_baseline': BASELINE, 'qualification': 'REFUSED' if issues else
                ('SYNTHETIC_TARGETS_PASS' if meta.get('synthetic') is True else 'TARGETS_PASS')
                if all(targets.values()) else 'TARGETS_FAIL',
            'production_qualified': False,  # An offline diagnostic never authorizes release.
            'metric_status': 'diagnostic_only_ineligible' if issues else 'eligible_for_descriptive_targets',
            'issues': sorted(set(issues)), 'window': {'from': str(start), 'to': str(end), 'game_days': settled_days},
            'denominator': {'eligible_dressed': len(eligible), 'scored_dressed': len(dressed),
                            'coverage': len(dressed)/len(eligible) if eligible else None},
            'primary_q3': metrics, 'primary_q4': bins, 'historical_position': positions,
            'chronological_primary_days': [{'date': day, **stats([r for r in dressed if r['served_date'] == day])} for day in days],
            'partitions_by_git_sha_source_class': parts, 'matched_controls': pairs,
            'q5_current_state_only_not_issue_time': q5, 'q6_by_run': q6,
            'q6_served_dressed': {'n': len(complete_h1), 'pp_a_per_pp_g': pp_ratio, 'zero_fraction': zero},
            'targets': targets, 'baseline_receipt': first}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('bundle', type=Path)
    args = ap.parse_args()
    try:
        if args.bundle.stat().st_size > 50_000_000:
            raise ValueError('bundle exceeds 50 MB')
        data = json.loads(args.bundle.read_text())
        result = audit(data)
    except (ValueError, KeyError, TypeError, AttributeError, OverflowError, OSError) as e:
        result = {'qualification': 'REFUSED', 'production_qualified': False,
                  'issues': ['invalid_or_incomplete_input:'+str(e)]}
    print(json.dumps(result, indent=2, sort_keys=True, allow_nan=False))
    return 2 if result['qualification'] == 'REFUSED' else 1 if result['qualification'] == 'TARGETS_FAIL' else 0

if __name__ == '__main__':
    sys.exit(main())

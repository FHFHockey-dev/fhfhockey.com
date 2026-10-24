import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from audit import audit, BASELINE, deciles, fingerprint, pk, stats
from fixtures import build, recount, resign

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.b = build()

    def refused(self, code):
        recount(self.b)
        report = audit(self.b)
        self.assertEqual(report['qualification'], 'REFUSED')
        self.assertIn(code, report['issues'])
        self.assertFalse(report['production_qualified'])
        return report

    def test_valid_synthetic_chronological_week(self):
        r = audit(self.b)
        self.assertEqual(r['qualification'], 'SYNTHETIC_TARGETS_PASS', r['issues'])
        self.assertEqual(r['issues'], [])
        self.assertEqual(r['denominator'], {'eligible_dressed': 70, 'scored_dressed': 70, 'coverage': 1.0})
        self.assertEqual(r['primary_q3']['dressed_only']['bias'], 0)
        self.assertGreater(r['primary_q3']['pooled_diagnostic']['bias'], 0)
        self.assertEqual(r['primary_q4'][-1]['n'], 7)
        self.assertAlmostEqual(r['q6_served_dressed']['pp_a_per_pp_g'], 1.85)
        self.assertFalse(r['production_qualified'])

    def test_mixed_full_sha_not_pooled(self):
        self.b['runs'][-1]['git_sha'] = 'a'*40
        r = self.refused('incomplete_or_mixed_version_primary_cohort')
        parts = [p for p in r['partitions_by_git_sha_source_class'] if p['source'] == 'bridge_exact']
        self.assertEqual({p['git_sha'] for p in parts}, {BASELINE, 'a'*40})

    def test_mixed_serving_method_refuses(self):
        self.b['ledger'][0]['method_version'] = 'new-method'
        resign(self.b)
        self.refused('mixed_or_unknown_serving_method')

    def test_paired_reaimed_versions_stay_separate(self):
        self.b['runs'][0]['git_sha'] = 'b'*40
        original = list(self.b['ledger'])
        receipts = {tuple(x['key']): x for x in self.b['issuance']}
        for r in original:
            if r['source'] == 'bridge_exact':
                clone = {**r, 'source': 'bridge_reaimed'}
                self.b['ledger'].append(clone)
                self.b['issuance'].append({**receipts[pk(r)], 'key': list(pk(clone)),
                                           'forecast_sha256': fingerprint(clone)})
        r = self.refused('incomplete_or_mixed_version_primary_cohort')
        pairs = [p for p in r['matched_controls'] if p['source'] == 'bridge_reaimed']
        self.assertEqual({p['comparison_git_sha'] for p in pairs}, {BASELINE, 'b'*40})
        self.assertEqual(sorted(p['paired_n'] for p in pairs), [10, 60])

    def test_short_or_missing_sha(self):
        for value in [BASELINE[:9], None, 'local:unknown']:
            with self.subTest(value=value):
                self.b = build()
                self.b['runs'][0]['git_sha'] = value
                self.refused('unversioned_or_failed_run')

    def test_missing_universe_cannot_claim_full_coverage(self):
        self.b['universe'].append({**self.b['universe'][0], 'player_id': 555})
        self.refused('incomplete_primary_dressed_coverage')

    def test_finality_and_completeness_are_independent_of_settled_at(self):
        self.b['games'][0]['skater_population_complete'] = False
        self.refused('incomplete_settlement_scope:9000')

    def test_denominator_participation_conflict(self):
        self.b['ledger'][0]['dressed'] = False
        self.refused('participation_or_denominator_conflict')

    def test_null_is_not_zero_even_when_fp_is_present(self):
        self.b['ledger'][0]['exp_hits'] = None
        resign(self.b)
        r = self.refused('missing_or_invalid_category:exp:bridge_exact')
        self.assertEqual(r['primary_q3']['category_presence']['exp_hits']['missing'], 1)
        self.assertEqual(r['primary_q3']['category_presence']['exp_hits']['zero'], 0)

    def test_nan_boolean_string_are_not_numbers(self):
        for value in [float('nan'), True, '0']:
            with self.subTest(value=str(value)):
                self.b = build()
                self.b['ledger'][0]['act_hits'] = value
                self.refused('missing_or_invalid_category:act:bridge_exact')

    def test_wrong_fp_weights(self):
        self.b['ledger'][0]['act_fantasy_points'] += .5
        self.refused('fp_weight_or_missingness_mismatch:act')

    def test_duplicates_and_reissued_snapshot_not_deduped(self):
        self.b['ledger'].append(copy.deepcopy(self.b['ledger'][0]))
        self.refused('duplicate_or_reissued:ledger_primary_key')

    def test_overwritten_forecast_receipt(self):
        self.b['ledger'][0]['exp_hits'] += 1
        self.refused('forecast_receipt_hash_mismatch')

    def test_reissue_history_required(self):
        self.b['issuance'][0]['revision_count'] = 2
        self.refused('unproven_or_reissued_forecast')

    def test_receipt_is_not_cron_time(self):
        self.b['baseline_receipt']['issued_at'] = '2026-10-23T12:30:00+00:00'
        self.refused('first_issuance_run_receipt_mismatch')

    def test_unverified_receipt(self):
        self.b['baseline_receipt']['verified'] = False
        self.refused('unverified_first_issuance')

    def test_after_puckdrop_snapshot(self):
        self.b['issuance'][0]['served_at'] = '2026-10-24T00:00:00+00:00'
        self.refused('invalid_forecast_chronology')

    def test_no_skipping_first_unsettled_day(self):
        self.b['calendar'][0]['complete'] = False
        self.refused('incomplete_schedule:2026-10-23')

    def test_export_truncation(self):
        self.b['meta']['truncated'] = True
        self.refused('incomplete_export')

    def test_h1_missing_and_duplicate(self):
        self.b['projections'].pop(0)
        self.refused('missing_served_h1_projection')
        self.b = build()
        self.b['projections'].append(copy.deepcopy(self.b['projections'][0]))
        self.refused('duplicate_or_reissued:h1')

    def test_q5_missing_zero_distinction(self):
        q5 = audit(self.b)['q5_current_state_only_not_issue_time'][0]['rates']['hits_per_60_last5']
        self.assertEqual(q5, {'rows': 11, 'missing': 1, 'invalid': 0, 'zero': 1})

    def test_zero_projection_gate_strict_at_ten_percent(self):
        ps = [p for p in self.b['projections'] if p['player_id'] == 100]
        for p in ps:
            p['proj_hits'] = 0
        r = audit(self.b)
        self.assertEqual(r['qualification'], 'TARGETS_FAIL')
        self.assertEqual(r['q6_served_dressed']['zero_fraction']['hits'], .1)
        self.assertFalse(r['targets']['zero_hit_lt_0_10'])

    def test_h1_mutated_after_serving(self):
        self.b['projections'][0]['updated_at'] = '2026-10-24T12:00:00+00:00'
        self.refused('h1_modified_after_serving')

    def test_independent_population_ids_required(self):
        self.b['games'][0]['dressed_skater_ids_by_team']['1'].pop()
        self.refused('independent_dressed_population_mismatch')

    def test_duplicate_rolling_not_silently_latest(self):
        self.b['rolling'].append(copy.deepcopy(self.b['rolling'][0]))
        self.refused('duplicate_or_reissued:rolling_ev')

    def test_zero_expected_is_unavailable_ratio(self):
        self.assertIsNone(stats([{'exp_fantasy_points': 0, 'act_fantasy_points': 0}])['actual_over_expected'])

    def test_only_six_days_cannot_qualify(self):
        for k in ['ledger', 'universe']:
            self.b[k] = [r for r in self.b[k] if r['served_date'] != '2026-10-29']
        self.refused('fewer_than_seven_settled_game_days')

    def test_ratio_of_sums_not_mean_of_ratios(self):
        r = stats([{'exp_fantasy_points': 1, 'act_fantasy_points': 2},
                   {'exp_fantasy_points': 9, 'act_fantasy_points': 8}])
        self.assertEqual(r['actual_over_expected'], 1)
        self.assertEqual(r['bias'], 0)

    def test_ntile_remainder_stable_and_expected_sorted(self):
        rows = []
        for i in range(23):
            rows.append({'exp_fantasy_points': i, 'act_fantasy_points': 23-i,
                         'season_id': 1, 'served_date': '2026-10-23', 'player_class': 'skater',
                         'player_id': i, 'game_id': 1})
        bins = deciles(list(reversed(rows)))
        self.assertEqual([b['n'] for b in bins], [3, 3, 3, 2, 2, 2, 2, 2, 2, 2])
        self.assertEqual(bins[-1]['expected_sum'], 43)

    def test_fingerprint_ignores_settlement_but_not_forecast(self):
        row = copy.deepcopy(self.b['ledger'][0])
        h = fingerprint(row)
        row['settled_at'] = '2026-11-01T12:00:00+00:00'
        self.assertEqual(h, fingerprint(row))
        row['run_id'] = 'different'
        self.assertNotEqual(h, fingerprint(row))

    def test_cli_missing_settlement_refuses_nonzero(self):
        self.b['ledger'][0]['settled_at'] = None
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'bad.json'
            path.write_text(json.dumps(self.b))
            p = subprocess.run([sys.executable, str(Path(__file__).with_name('audit.py')), str(path)],
                               capture_output=True, text=True)
        self.assertEqual(p.returncode, 2)
        self.assertEqual(json.loads(p.stdout)['qualification'], 'REFUSED')

if __name__ == '__main__':
    unittest.main(verbosity=2)

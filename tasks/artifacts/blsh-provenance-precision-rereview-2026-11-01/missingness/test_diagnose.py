from copy import deepcopy
import unittest
from diagnose import FIELDS, attach, diagnostic, script_json


def fixture():
    row = dict(id=1, player_id=10, game_id=2026020001, date='2026-10-31', team_abbrev='TST', toi_per_game=600,
               counts={key: 0 for key in FIELDS})
    game = dict(sourceId=1, gameId=row['game_id'], date=row['date'], team='TST', capturedSeconds=600,
                fields={'goals': {'captured': 0, 'state': 'unknown'}}, exposureState='held', officialSeconds=599,
                additionalReviewNote={'faceoffs': 'difference retained'})
    p = dict(playerId=10, name='Fixture', shots=0, games=[game], score=None, support=None, baselineComparison=None,
             gameScore={'total': None, 'perAppearance': None, 'per60': None, 'coveredRecords': 0},
             fp={'capturedMetric': {'total': 0}})
    data = dict(version='fhfh.blsh.evidence-visual-review.v1', scoreAdmission=False, profiles=[p],
                totals={'selectedRecords': 1, 'fpWindows': 0, 'unresolvedPPP': 1})
    return data, [row]


class DiagnosticTests(unittest.TestCase):
    def test_zero_is_observed_and_complete(self):
        result = diagnostic({k: 0 for k in FIELDS})
        self.assertTrue(result['complete'])
        self.assertEqual(result['observed'], 17)
        self.assertEqual(set(result['states'].values()), {'observed'})

    def test_null_absent_invalid_and_zero_stay_distinct(self):
        counts = {k: 0 for k in FIELDS}
        counts['es_goals_for'] = None
        counts.pop('pp_goals_for')
        counts['sh_goals_for'] = -1
        result = diagnostic(counts)
        self.assertEqual([result['states'][k] for k in ['es_goals_for', 'pp_goals_for', 'sh_goals_for', 'shots']],
                         ['missing', 'absent', 'invalid', 'observed'])
        self.assertNotIn('pp_goals_for', result['counts'])
        self.assertIsNone(result['counts']['es_goals_for'])
        self.assertEqual(result['counts']['sh_goals_for'], -1)

    def test_boolean_string_nonfinite_invalid_without_coercion(self):
        for value in [False, True, '0', float('nan'), float('inf'), -0.1]:
            with self.subTest(value=value):
                self.assertEqual(diagnostic({'shots': value})['states']['shots'], 'invalid')

    def test_matches_existing_finite_nonnegative_operand_rule(self):
        self.assertEqual(diagnostic({'shots': 0.5})['states']['shots'], 'observed')
        self.assertEqual(diagnostic({'shots': -0.0})['states']['shots'], 'observed')

    def test_preserves_all_old_values_and_does_not_admit_complete_rows(self):
        data, sources = fixture()
        before = deepcopy((data, sources))
        out = attach(data, sources)
        self.assertEqual((data, sources), before)
        self.assertIsNone(out['profiles'][0]['gameScore']['total'])
        self.assertEqual(out['profiles'][0]['games'][0]['exposureState'], 'held')
        self.assertEqual(out['profiles'][0]['games'][0]['additionalReviewNote'], {'faceoffs': 'difference retained'})
        self.assertEqual(out['savedGameScoreInputSummary']['completeRecords'], 1)
        self.assertFalse(out['scoreAdmission'])
        self.assertEqual(out['profiles'][0]['shots'], 0)

    def test_incomplete_rows_profiles_and_fields_reconciled(self):
        data, sources = fixture()
        sources[0]['counts']['es_goals_for'] = None
        sources[0]['counts'].pop('pp_goals_for')
        sources[0]['counts']['sh_goals_for'] = '0'
        summary = attach(data, sources)['savedGameScoreInputSummary']
        self.assertEqual([summary[k] for k in ['incompleteRecords', 'profilesWithIncompleteRecords', 'nullFields', 'absentFields', 'invalidFields']], [1, 1, 1, 1, 1])
        self.assertEqual(summary['zeroFields'], 14)

    def test_duplicate_or_missing_selected_source_rejected(self):
        data, sources = fixture()
        with self.assertRaisesRegex(ValueError, 'duplicate_source_id'):
            attach(data, sources + sources)
        with self.assertRaisesRegex(ValueError, 'missing_or_duplicate_selected_source'):
            attach(data, [])
        data['profiles'][0]['games'] *= 2
        with self.assertRaisesRegex(ValueError, 'missing_or_duplicate_selected_source'):
            attach(data, sources)

    def test_identity_and_exposure_drift_rejected(self):
        for key, value in [('player_id', 11), ('game_id', 2026020002), ('date', '2026-10-30'), ('team_abbrev', 'ZZZ'), ('toi_per_game', 601)]:
            data, sources = fixture()
            sources[0][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'source_.*_drift'):
                attach(data, sources)

    def test_score_promotion_and_population_change_rejected(self):
        data, sources = fixture()
        data['profiles'][0]['score'] = 0
        with self.assertRaisesRegex(ValueError, 'unexpected_score_or_comparison'):
            attach(data, sources)
        data, sources = fixture()
        data['totals']['selectedRecords'] = 2
        with self.assertRaisesRegex(ValueError, 'selected_record_count_mismatch'):
            attach(data, sources)

    def test_script_payload_escaped_and_nonfinite_output_rejected(self):
        self.assertNotIn('<', script_json({'name': '</script>', 'value': None}))
        with self.assertRaises(ValueError):
            script_json({'value': float('nan')})


if __name__ == '__main__':
    unittest.main()

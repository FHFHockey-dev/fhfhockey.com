import copy
import json
import unittest
from pathlib import Path

from verify_benchmark import validate, verify_files

HERE = Path(__file__).resolve().parent


class Boundaries(unittest.TestCase):
    def setUp(self):
        self.benchmark = json.loads((HERE / 'benchmark.json').read_text())
        self.inputs = json.loads((HERE / 'evaluation-inputs.json').read_text())

    def reject(self, change):
        changed = copy.deepcopy(self.benchmark)
        change(changed)
        with self.assertRaises(AssertionError):
            validate(changed, self.inputs)

    def test_frozen_sources_annotations_ledger_and_proposal(self):
        self.assertEqual(verify_files()['source_units'], 50)

    def test_publication_grade_cannot_be_invented(self):
        self.reject(lambda b: b['groups'][0].update(owner_publication_readiness='ready'))

    def test_world_truth_cannot_be_invented(self):
        self.reject(lambda b: b['groups'][1].update(independent_world_truth=True))

    def test_confirmed_category_is_not_probability(self):
        self.reject(lambda b: b.update(calibrated_starter_probability=1.0))

    def test_duration_cannot_be_strengthened(self):
        self.reject(lambda b: b['groups'][4]['observed_source_claims'][0].update(time_literal='at least 4 weeks'))

    def test_rest_of_season_is_not_entire_season(self):
        self.reject(lambda b: b['groups'][4]['observed_source_claims'][2].update(time_literal='entire 2026-27 season'))

    def test_timing_alone_cannot_confirm(self):
        self.reject(lambda b: b['groups'][7]['hockey_parsing_conventions'][1]['confirmation_rule'].update(timing_alone_sufficient=True))

    def test_correction_cannot_be_discarded(self):
        self.reject(lambda b: b['groups'][9]['hockey_parsing_conventions'][0]['final_state'].update(retain_both_sources=False))

    def test_sanderson_inference_is_not_source_fact(self):
        self.reject(lambda b: b['groups'][1]['analyst_inferences'][0].update(expected_source_extraction=True))

    def test_source_quote_must_remain_exact(self):
        self.reject(lambda b: b['groups'][6]['observed_source_claims'][0]['evidence'].update(quote='Dubois will suit up tomorrow.'))

    def test_source_only_inputs_may_not_include_answers(self):
        self.inputs[0]['expected_category'] = 'confirmed'
        with self.assertRaises(AssertionError):
            validate(self.benchmark, self.inputs)


if __name__ == '__main__':
    unittest.main()

"""Offline regressions for admission preparation across release-base changes."""
import copy
import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location('admission', Path(__file__).with_name('prepare-committed-admission.py'))
admission = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admission)


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {'candidateTree': 'a' * 40, 'selectedCommittedBase': 'b' * 40}
        self.required = {'candidateTree': 'a' * 40, 'selectedBase': 'b' * 40}
        self.custody = {'candidateBaseStatus': 'SELECTED_REPLACEMENT_PENDING_HANDOFF',
                       'candidateTree': 'a' * 40,
                       'replacementProposal': {'candidateTree': 'a' * 40, 'base': 'b' * 40}}

    def test_consistent_selected_records(self):
        admission.validate_candidate_selection(self.manifest, self.required, self.custody)

    def test_future_release_hold_is_rejected(self):
        for status in ['SUPERSEDED_BY_PR403', 'SUPERSEDED_BY_PR999', '']:
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, 'not selected'):
                self.custody['candidateBaseStatus'] = status
                admission.validate_candidate_selection(self.manifest, self.required, self.custody)

    def test_stale_requirements_are_rejected(self):
        self.required['candidateTree'] = 'c' * 40
        with self.assertRaisesRegex(ValueError, 'records disagree'):
            admission.validate_candidate_selection(self.manifest, self.required, self.custody)

    def test_old_base_with_same_candidate_tree_is_rejected(self):
        self.required['selectedBase'] = 'c' * 40
        with self.assertRaisesRegex(ValueError, 'records disagree'):
            admission.validate_candidate_selection(self.manifest, self.required, self.custody)

    def test_stale_custody_proposal_is_rejected(self):
        for field in ['base', 'candidateTree']:
            custody = copy.deepcopy(self.custody)
            custody['replacementProposal'][field] = 'c' * 40
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'records disagree'):
                admission.validate_candidate_selection(self.manifest, self.required, custody)

    def test_incomplete_custody_record_is_rejected(self):
        self.custody.pop('replacementProposal')
        with self.assertRaisesRegex(ValueError, 'records disagree'):
            admission.validate_candidate_selection(self.manifest, self.required, self.custody)


if __name__ == '__main__':
    unittest.main()

"""Authored failure cases using authenticated current evidence; never reads holdout data."""
import sys
sys.dont_write_bytecode = True
from copy import deepcopy
from datetime import timedelta
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from compose import (canonical_hash, compose_profiles, compose_rows, stamp,
                     validate_selection)
from run import Inputs, authenticate_native, load_inputs


class CompositionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_inputs()
        cls.capture = cls.data['capture_at']
        cls.as_of = '2026-11-07T12:00:00.000000+00:00'
        cls.good = next(p for p in cls.data['comparisons'] if p['laterMatchingEvidenceCandidate'] and p['nativePPP'] == 0)
        cls.nonzero = next(p for p in cls.data['comparisons'] if p['laterMatchingEvidenceCandidate'] and p['nativePPP'] > 0)
        cls.held = next(p for p in cls.data['comparisons'] if p['sourceId'] == 5598688)
        cls.sources = {s['id']: s for s in cls.data['sources']}

    def setUp(self):
        self.proof = deepcopy(self.good)
        self.row = deepcopy(self.proof['priorSidecar'])
        self.source = deepcopy(self.sources[self.proof['sourceId']])

    def compose(self, proofs=None, rows=None, sources=None):
        return compose_rows([self.row] if rows is None else rows,
                            [self.source] if sources is None else sources,
                            [self.proof] if proofs is None else proofs,
                            self.capture, self.as_of, {'syntheticTestBinding': 'retained_inputs_authenticated'})

    def bad(self, reason):
        with self.assertRaisesRegex(ValueError, reason):
            self.compose()

    def test_zero_and_nonzero_and_inputs_unchanged(self):
        for proof in (self.good, self.nonzero):
            self.proof = deepcopy(proof)
            self.row = deepcopy(proof['priorSidecar'])
            self.source = deepcopy(self.sources[proof['sourceId']])
            before = deepcopy((self.row, self.source, self.proof))
            rows, decisions = self.compose()
            self.assertEqual((self.row, self.source, self.proof), before)
            self.assertEqual(rows[0]['fields']['pp_points']['official'], proof['nativePPP'])
            self.assertEqual(rows[0]['laterPPPEvidence']['priorFieldEvidence'], self.row['fields']['pp_points'])
            self.assertFalse(rows[0]['scoringAdmission'])
            self.assertFalse(rows[0]['fullProfileQualified'])
            self.assertFalse(rows[0]['laterPPPEvidence']['sourceFreshnessEstablished'])
            self.assertEqual(decisions[0]['state'], 'later_field_evidence_composed')

    def test_zero_shots_not_excluded(self):
        self.assertEqual(self.source['counts']['shots'], 0)
        rows, _ = self.compose()
        self.assertTrue(rows[0]['tracks']['fantasyPoints']['corroboratedForThisRow'])

    def test_real_exposure_hold_preserved(self):
        proof = deepcopy(self.held)
        row = deepcopy(proof['priorSidecar'])
        rows, decisions = self.compose([proof], [row], [deepcopy(self.sources[proof['sourceId']])])
        self.assertEqual(rows, [row])
        self.assertEqual(decisions[0]['admissionHolds'], proof['admissionHolds'])

    def test_duplicate_proof(self):
        with self.assertRaisesRegex(ValueError, 'duplicate_identity'):
            self.compose([self.proof, self.proof])

    def test_duplicate_row_or_source(self):
        with self.assertRaisesRegex(ValueError, 'duplicate_identity'):
            self.compose(rows=[self.row, self.row])
        with self.assertRaisesRegex(ValueError, 'duplicate_identity'):
            self.compose(sources=[self.source, self.source])

    def test_outside_selected_scope(self):
        self.proof['sourceId'] = -1
        self.bad('proof_outside_selected_scope')

    def test_wrong_identity_or_team(self):
        for field in ('playerId', 'gameId', 'date', 'team'):
            with self.subTest(field=field):
                self.proof = deepcopy(self.good)
                self.proof[field] = 'wrong'
                self.bad('proof_identity_drift')

    def test_source_hash_drift(self):
        self.source['counts']['hits'] += 1
        self.bad('source_row_hash_drift')

    def test_wrong_capture_timestamp(self):
        self.proof['sourceCaptureAtUTC'] = '2026-11-01T19:57:38.026059+00:00'
        self.bad('source_capture_drift')

    def test_old_sidecar_equality(self):
        self.proof['priorSidecar']['boxEvidenceVersion'] = 'wrong'
        self.bad('prior_sidecar_drift')

    def test_bool_null_or_negative_PPP(self):
        for value in (True, None, -1, 0.0):
            with self.subTest(value=value):
                self.proof['nativePPP'] = value
                self.bad('invalid_PPP_operand')

    def test_different_PPP(self):
        self.proof['nativePPP'] += 1
        self.bad('PPP_comparison_drift')

    def test_naive_time(self):
        self.proof['observedAtUTC'] = '2026-11-02T00:40:41.314036'
        self.bad('naive_timestamp')

    def test_microsecond_pre_capture_hold_and_exact_equal_rejected(self):
        self.proof['observedAtUTC'] = (stamp(self.capture) - timedelta(microseconds=1)).isoformat()
        self.proof['observationPrecedesCapture'] = True
        self.proof['admissionHolds'] = ['observation_precedes_source_capture']
        self.proof['laterMatchingEvidenceCandidate'] = False
        rows, _ = self.compose()
        self.assertEqual(rows, [self.row])
        self.proof = deepcopy(self.good)
        self.proof['observedAtUTC'] = self.capture
        self.bad('later_evidence_must_follow_capture')

    def test_microsecond_after_and_offset_normalization(self):
        self.proof['observedAtUTC'] = '2026-11-01T20:57:38.026059+01:00'
        rows, _ = self.compose()
        self.assertEqual(rows[0]['fields']['pp_points']['state'], 'matched')

    def test_future_or_forged_chronology(self):
        self.proof['observedAtUTC'] = '2026-11-08T00:00:00+00:00'
        self.bad('evidence_after_composition')
        self.proof = deepcopy(self.good)
        self.proof['observationPrecedesCapture'] = True
        self.bad('chronology_flag_drift')

    def test_forged_candidate_or_removed_hold(self):
        self.proof['laterMatchingEvidenceCandidate'] = False
        self.bad('candidate_flag_drift')
        self.proof = deepcopy(self.held)
        self.row = deepcopy(self.proof['priorSidecar'])
        self.source = deepcopy(self.sources[self.proof['sourceId']])
        self.proof['admissionHolds'] = []
        self.bad('admission_holds_drift')

    def test_forged_exposure_or_count_flag(self):
        self.proof['exposureComparison']['native'] -= 1
        self.bad('exposure_flag_drift')
        self.proof = deepcopy(self.good)
        self.proof['countComparisons']['goals']['native'] += 1
        self.bad('count_flag_drift')

    def test_finality_hold_cannot_be_removed(self):
        self.proof['priorCombined']['boxQualification']['gameFinality'] = 'unknown'
        self.bad('admission_holds_drift')

    def test_admission_or_scoring_flags(self):
        for field in ('sourceValuesChanged', 'scoringAdmission', 'wholeProfileQualification'):
            with self.subTest(field=field):
                self.proof = deepcopy(self.good)
                self.proof[field] = True
                self.bad('proof_admission_not_allowed')

    def test_prior_operand_drift_even_with_valid_source_hash(self):
        self.source['counts']['hits'] += 1
        self.proof['sourceRowSHA256'] = canonical_hash(self.source)
        self.bad('prior_count_operand_drift')

    def test_preserve_all_unchanged_rows_and_profile_fields(self):
        d = self.data
        rows, decisions = compose_rows(d['rows'], d['sources'], d['comparisons'], self.capture, self.as_of, {})
        changed = {v['sourceId'] for v in decisions if v['state'] == 'later_field_evidence_composed'}
        self.assertEqual(len(changed), 44)
        for old, new in zip(d['rows'], rows):
            if old['sourceId'] not in changed:
                self.assertEqual(old, new)
            else:
                new = deepcopy(new)
                new.pop('laterPPPEvidence')
                new['fields']['pp_points'] = old['fields']['pp_points']
                new['tracks']['fantasyPoints'] = old['tracks']['fantasyPoints']
                self.assertEqual(new, old)
        profiles = compose_profiles(d['profiles'], d['rows'], rows)
        for old, new in zip(d['profiles'], profiles):
            new = deepcopy(new)
            self.assertEqual(new['tracks']['fantasyPoints']['capturedMetric'], old['tracks']['fantasyPoints']['capturedMetric'])
            new['tracks']['fantasyPoints'] = old['tracks']['fantasyPoints']
            self.assertEqual(new, old)

    def test_selected_identity_and_metrics_failure_cases(self):
        d = self.data
        for field in ('sourceIds', 'dates', 'seconds', 'shots'):
            with self.subTest(field=field):
                contexts = deepcopy(d['contexts']['profiles'])
                if isinstance(contexts[0][field], list):
                    contexts[0][field] = contexts[0][field][:-1]
                else:
                    contexts[0][field] += 1
                with self.assertRaises(ValueError):
                    validate_selection(d['rows'], d['sources'], contexts, d['profiles'], self.capture)

    def test_duplicate_profile_and_old_window_drift(self):
        d = self.data
        with self.assertRaisesRegex(ValueError, 'duplicate_identity'):
            validate_selection(d['rows'], d['sources'], d['contexts']['profiles'] + [d['contexts']['profiles'][0]],
                               d['profiles'], self.capture)
        profiles = deepcopy(d['profiles'])
        profiles[0]['tracks']['fantasyPoints']['matchedSelectedRecords'] -= 1
        with self.assertRaisesRegex(ValueError, 'old_window_reconstruction_drift'):
            compose_profiles(profiles, d['rows'], d['rows'])

    def test_authenticated_file_drift(self):
        with patch.object(Path, 'read_bytes', return_value=b'drift'):
            with self.assertRaisesRegex(ValueError, 'authenticated_file_drift'):
                Inputs().checked(Path('unused'), '0' * 64, 'test')

    def native_failure(self, mutate, reason):
        d = self.data
        proof = deepcopy(self.good)
        files = dict(d['inputs'].bytes)
        evidence = proof['nativeEvidence']
        body_path, receipt_path = evidence['bodyPath'], evidence['receiptPath']
        body = json.loads(files[body_path])
        mutate(body)
        files[body_path] = json.dumps(body).encode()
        evidence['bodySHA256'] = hashlib.sha256(files[body_path]).hexdigest()
        receipt = json.loads(files[receipt_path])
        receipt.update(sha256=evidence['bodySHA256'], bytes=len(files[body_path]))
        files[receipt_path] = json.dumps(receipt).encode()
        evidence['receiptSHA256'] = hashlib.sha256(files[receipt_path]).hexdigest()
        pins = dict(d['pins'])
        pins[body_path] = evidence['bodySHA256']
        pins[receipt_path] = evidence['receiptSHA256']
        from run import DIRECT
        final_receipt = json.loads(files[str(DIRECT / 'FINAL-RECEIPT.json')])
        for path in (body_path, receipt_path):
            final_receipt['files'][str(Path(path).relative_to(DIRECT))] = pins[path]
        # A memory-only authenticated reader exposes intentionally re-bound malformed payloads.
        class MemoryInputs:
            def checked(self, path, expected, binding):
                self_data = files[str(path)]
                if hashlib.sha256(self_data).hexdigest() != expected:
                    raise ValueError('test_binding_error')
                return self_data
            def json(self, path, expected, binding):
                return json.loads(self.checked(path, expected, binding))
        with self.assertRaisesRegex(ValueError, reason):
            authenticate_native(MemoryInputs(), pins, final_receipt, proof, self.sources[proof['sourceId']])

    def test_native_duplicate_or_partial_payload(self):
        self.native_failure(lambda b: b.update(total=2), 'native_partial_or_duplicate_payload')
        def duplicate(body):
            body['data'].append(deepcopy(body['data'][0]))
            body['total'] = 2
        self.native_failure(duplicate, 'native_partial_or_duplicate_payload')

    def test_native_identity_team_and_partition(self):
        self.native_failure(lambda b: b['data'][0].update(gameId=1), 'native_identity_drift')
        self.native_failure(lambda b: b['data'][0].update(teamAbbrev='WRONG'), 'native_team_drift')
        self.native_failure(lambda b: b['data'][0].update(evPoints=999), 'native_point_partition_drift')

    def test_native_TOI_and_PPP_operand_drift(self):
        self.native_failure(lambda b: b['data'][0].update(timeOnIcePerGame=1), 'native_TOI_drift')
        self.native_failure(lambda b: b['data'][0].update(ppPoints=True), 'native_count_type_drift')


if __name__ == '__main__':
    unittest.main(verbosity=2)

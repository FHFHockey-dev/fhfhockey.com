import copy
from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from intake_check import CASES, TASKS, check, template


def complete_metadata():
    """Fictional declarations only, deliberately never treated as trusted approvals."""
    data = template()
    for case in data['cases']:
        case.update({key: 'a' * 64 if key.endswith('Sha256') else 'fictional-owner' for key in case if key != 'kind'})
    for index, row in enumerate(data['allocations']):
        for key in ['custodian', 'datasetSha256', 'exposureRegisterSha256', 'rightsReceiptSha256', 'scopeApprovalSha256']:
            row[key] = 'b' * 64 if key.endswith('Sha256') else 'fictional-custodian'
        row.update(startUtc=f'2030-0{index + 1}-02T00:00:00Z', endUtc=f'2030-0{index + 1}-20T00:00:00Z', seasonIds=[20292030], gameIds=[2030000001 + index])
    data['chronology'].update(developmentProtocolRegisteredAt='2029-12-01T00:00:00Z', meanModelAvailableAt='2030-02-21T00:00:00Z', calibratorAvailableAt='2030-03-21T00:00:00Z', finalProtocolFrozenAt='2030-03-22T00:00:00Z', independentReviewSha256='c' * 64, developmentJustificationSha256='d' * 64)
    classes = ['source', 'custody', 'protocol', 'development', 'development', 'development', 'development', 'representative_local', 'untouched_final', 'approval', 'prospective_issued', 'qualification', 'release_receipt', 'qualification', 'rso_owner_acceptance']
    for task, kind in zip(TASKS, classes):
        data['evidence'][task] = dict(owner='fictional-owner', artifactSha256='e' * 64, receiptSha256='f' * 64, evidenceClass=kind)
    data['shadow'].update(environmentOwner='fictional-owner', environmentId='isolated-fiction', approvalSha256='a' * 64, startUtc='2030-05-02T00:00:00Z', endUtc='2030-05-03T00:00:00Z', maximumAttempts=10, maximumWorkerSeconds=30, maximumRetainedBytes=10000, maximumStoreOperations=100, currencyBudget=0, reservationReceiptSha256='a' * 64, retentionOwner='fictional-owner')
    return data


class IntakeTests(unittest.TestCase):
    def test_template_retains_every_task_as_incomplete(self):
        result = check(template())
        self.assertEqual(result['status'], 'BLOCKED_METADATA')
        self.assertEqual([row['id'] for row in result['tasks']], TASKS)
        self.assertTrue(all(row['metadataIssueCount'] > 0 and row['state'] == 'INCOMPLETE' for row in result['tasks']))

    def test_complete_metadata_is_never_authorization_or_qualification(self):
        result = check(complete_metadata())
        self.assertEqual(result['issues'], [])
        self.assertEqual(result['status'], 'METADATA_REVIEW_REQUIRED')
        self.assertFalse(result['executionAuthorized'])
        self.assertFalse(result['scientificallyQualified'])
        self.assertEqual(result['referencedArtifactsOpened'], 0)
        self.assertTrue(all(row['state'] == 'INCOMPLETE' for row in result['tasks']))

    def test_duplicate_game_and_overlap_are_rejected(self):
        data = complete_metadata()
        data['allocations'][1]['gameIds'] = data['allocations'][0]['gameIds']
        data['allocations'][1]['startUtc'] = '2030-01-15T00:00:00Z'
        reasons = [row['reason'] for row in check(data)['issues']]
        self.assertIn('game_leakage_or_duplicate', reasons)
        self.assertIn('chronological_partitions_overlap', reasons)

    def test_existing_hold_cannot_be_cleared_by_metadata_receipt(self):
        for season in [20242025, 20252026]:
            data = complete_metadata(); data['allocations'][0]['seasonIds'] = [season]
            self.assertIn('existing_hold_requires_separate_custodian_resolution', [row['reason'] for row in check(data)['issues']])

    def test_same_period_fitted_model_and_calibrator_backdating_are_rejected(self):
        data = complete_metadata()
        data['chronology']['meanModelAvailableAt'] = '2030-04-01T00:00:00Z'
        data['chronology']['calibratorAvailableAt'] = '2030-03-10T00:00:00Z'
        reasons = [row['reason'] for row in check(data)['issues']]
        self.assertIn('must_precede_interval_calibration', reasons)
        self.assertIn('calibrator_must_follow_calibration_outcomes', reasons)

    def test_final_protocol_cannot_be_frozen_after_final_access_window(self):
        data = complete_metadata(); data['chronology']['finalProtocolFrozenAt'] = '2030-04-03T00:00:00Z'
        self.assertIn('must_precede_untouched_final', [row['reason'] for row in check(data)['issues']])

    def test_fixtures_cannot_fill_real_evidence_roles(self):
        data = complete_metadata()
        for row in data['evidence'].values(): row['evidenceClass'] = 'fixture'
        issues = check(data)['issues']
        self.assertEqual({row['task'] for row in issues}, set(TASKS))

    def test_unknown_extra_partition_and_missing_case_are_rejected(self):
        data = complete_metadata(); data['allocations'].append(copy.deepcopy(data['allocations'][0])); data['cases'].pop()
        reasons = [row['reason'] for row in check(data)['issues']]
        self.assertIn('exact_five_partition_inventory_required', reasons)
        self.assertIn('exactly_one_case_metadata_required', reasons)

    def test_bad_shapes_dates_hashes_and_bounds_do_not_pass(self):
        data = complete_metadata(); data['shadow']['maximumAttempts'] = True; data['shadow']['currencyBudget'] = float('nan')
        data['cases'][0]['rawCaptureSha256'] = '/do/not/open/protected.json'; data['allocations'][0]['startUtc'] = '2030-01-01'
        self.assertGreaterEqual(len(check(data)['issues']), 4)
        self.assertEqual(check([])['status'], 'BLOCKED_METADATA')
        self.assertEqual(check({'schemaVersion': 'wrong'})['status'], 'BLOCKED_METADATA')

    def test_malformed_utc_suffix_never_reaches_naive_datetime_comparison(self):
        for stamp in ['2030-01-01Z', '2030-01-01T00:00Z', '2030-13-01T00:00:00Z']:
            data = complete_metadata(); data['allocations'][0]['startUtc'] = stamp
            self.assertIn('missing_or_invalid_time', [row['reason'] for row in check(data)['issues']])

    def test_runner_replaces_old_pass_after_timeout_or_launch_failure(self):
        original_path = Path
        for failure in [subprocess.TimeoutExpired('fixture-command', 1), OSError('fixture-launch-failure')]:
            with tempfile.TemporaryDirectory(prefix='forge-runner-regression-') as scratch:
                directory = original_path(scratch) / 'tasks/artifacts/preparation'; directory.mkdir(parents=True)
                runner = directory / 'run_continuation.py'; shutil.copyfile(original_path(__file__).with_name('run_continuation.py'), runner)
                receipt = directory / 'continuation-intake-receipt.json'
                receipt.write_text(json.dumps({'status': 'passed', 'exit': 0, 'logSha256': 'old'}))
                isolated_lock = original_path(scratch) / 'test-owned-lock'
                def relocated_path(value):
                    return isolated_lock if str(value) == '/private/tmp/fhfh-heavy.lock' else original_path(value)
                with patch('pathlib.Path', side_effect=relocated_path), patch('sys.argv', [str(runner), 'intake']), patch('subprocess.run', side_effect=failure), redirect_stdout(io.StringIO()):
                    with self.assertRaises(SystemExit) as raised:
                        runpy.run_path(str(runner), run_name='__main__')
                self.assertEqual(raised.exception.code, 1)
                current = json.loads(receipt.read_text())
                self.assertEqual(current['status'], 'failed'); self.assertEqual(current['exit'], 1)
                self.assertEqual(current['errorKind'], type(failure).__name__)
                self.assertEqual(current['logSha256'], hashlib.sha256((directory / 'continuation-intake.txt').read_bytes()).hexdigest())
                self.assertFalse(isolated_lock.exists())


if __name__ == '__main__':
    unittest.main()

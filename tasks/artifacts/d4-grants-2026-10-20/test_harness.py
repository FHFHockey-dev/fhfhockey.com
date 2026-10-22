"""Read-only D4 preflight regressions; no cluster, network, or external dependencies."""
import json
from pathlib import Path
import subprocess
import sys
import unittest


BASE = Path(__file__).resolve().parent
PAIR = ['20261020224500_data_api_explicit_default_privileges.sql',
        '20261020224600_data_api_reviewed_object_grants.sql']
RUN_ID = 'v900000001'


class HarnessPreflightTests(unittest.TestCase):
    def check(self, files, *, negative=False, run_id=RUN_ID):
        result = subprocess.run(
            [sys.executable, '-I', str(BASE / 'harness.py'), run_id, *files, '--check'],
            env={'PATH': '/usr/bin:/bin', 'D4_NEGATIVE': '1' if negative else '0'},
            text=True, capture_output=True, timeout=10,
        )
        self.assertFalse((BASE / f'run-{RUN_ID}').exists(), 'preflight must not create a receipt directory')
        return result

    def test_pair_keeps_current_suffix_and_hashes_all_migrations(self):
        result = self.check(PAIR)
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertGreaterEqual(plan['chainFiles'], 97)
        self.assertEqual(plan['firstPassOrder'], list(range(1, plan['chainFiles'] + 1)))
        self.assertEqual(plan['d4Orders'], [89, 90])
        self.assertEqual(plan['suffixOrders'], list(range(91, plan['chainFiles'] + 1)))
        hashes = {p: h for p, h in plan['sourceSha256'].items() if p.startswith('supabase/migrations/')}
        self.assertEqual(len(hashes), plan['chainFiles'])
        self.assertTrue(all(len(h) == 64 for h in hashes.values()))

    def test_negative_control_omits_only_d4(self):
        result = self.check(PAIR, negative=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertEqual(plan['firstPassOrder'],
                         [n for n in range(1, plan['chainFiles'] + 1) if n not in (89, 90)])

    def test_reordered_partial_duplicate_and_foreign_pairs_are_rejected(self):
        for files in [PAIR[::-1], PAIR[:1], PAIR + PAIR, [PAIR[0], '../other.sql']]:
            with self.subTest(files=files):
                result = self.check(files)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('provide exactly D4 defaults then reviewed grants', result.stderr)

    def test_historical_receipt_cannot_be_overwritten(self):
        result = self.check(PAIR, run_id='v7')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('preserve prior receipts', result.stderr)

    def test_snapshot_mode_keeps_whole_chain(self):
        result = self.check([])
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertEqual(plan['firstPassOrder'], list(range(1, plan['chainFiles'] + 1)))
        self.assertEqual(plan['d4Orders'], [])

    def test_negative_control_requires_pair(self):
        result = self.check([], negative=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('negative control requires the exact D4 pair', result.stderr)


if __name__ == '__main__':
    unittest.main()

"""Writes LIVE-READ-SCOPE.json: the read's bounds, window and every pin the live wrapper checks before connecting.
Offline; reads files only. Run after tests/run_all.sh has written TESTS-RECEIPT.json:
    env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B make_scope.py
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import capture_reader as c   # noqa: E402
import read_only_session as ros  # noqa: E402
import run_live_read as w    # noqa: E402

WEB = Path('/Users/tim/Code/fhfhockey.com/web')
EXTERNAL = {
    'trustBundle': {'path': str(ros.BUNDLE)},
    'python': {'path': w.EXPECTED_PYTHON},
    'psycopg2': {'path': '/opt/anaconda3/lib/python3.13/site-packages/psycopg2', 'kind': 'tree'},
    'node': {'path': w.NODE},
    'projectRef': {'path': str(ros.REPO / 'supabase/.temp/project-ref')},
    'poolerUrl': {'path': str(ros.REPO / 'supabase/.temp/pooler-url')},
    'currentInput.ts': {'path': str(WEB / 'lib/buyLowSellHigh/currentInput.ts')},
    'productionReference.ts': {'path': str(WEB / 'lib/buyLowSellHigh/productionReference.ts')},
    'typescript.js': {'path': str(WEB / 'node_modules/typescript/lib/typescript.js')},
}
# Values that must hold independently of what is on disk today (the generated pins are checked against these).
KNOWN = {'trustBundle': ros.BUNDLE_SHA256, 'node': 'daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef',
         'currentInput.ts': '58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232',
         'productionReference.ts': 'ec3afb69ff6001068586d50faf718585f17392524196cb343020f3b98eda192e',
         'typescript.js': '0fba5508ecbe50cd00a45f132a76582fb22a4ec55769fd3d794fd0e026f9fb67'}


def local_pins():
    return {name: w.sha_file(ROOT / name) for name in w.LOCAL_PINNED}


def external_pins():
    out = {}
    for key, e in EXTERNAL.items():
        digest = w.tree_sha(e['path']) if e.get('kind') == 'tree' else w.sha_file(e['path'])
        if key in KNOWN and digest != KNOWN[key]:
            raise SystemExit('known_pin_mismatch:' + key)
        out[key] = {**e, 'sha256': digest}
    return out


def build(receipt_sha):
    return {
        'version': 'fhfh.blsh.request-reader-read-scope.20261111',
        'adaptedFrom': {'path': '/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01',
                        'LIVE-READ-SCOPE.json': '4fff47f62df59c574ba3d752f92ede4fe135d5087ee1ecfd8fd198eed104145a',
                        'capture_reader.py': '9b5a9550749e5bc962b4a0ee0c73047ad1c01fa008dc9912af907acf7d64d231',
                        'read_only_session.py': 'c5dbb850b8da135b13090f3a03c8d92b802296087120ffb55cf44451506ed9ec'},
        'root': w.PINNED_ROOT, 'pycachePrefix': w.PYCACHE_PREFIX, 'candidates': w.CANDIDATES,
        'custody': 'Not pinned (RUNBOOK "Custody"): stdlib source/lib-dynload under /opt/anaconda3 (user-owned), the libcrypto '
                   'hashlib uses, and .pth start-up hooks (recorded as startupNonStdlibModules).',
        'project': ros.PROJECT, 'endpoint': ros.HOST + ':5432 session pooler', 'tls': 'verify-full; hash-pinned trust bundle',
        'seasonId': c.SEASON, 'dateFrom': c.DATE_MIN, 'dateThrough': c.DATE_MAX,
        'tables': c.TABLES, 'columns': c.COLUMNS,
        'bounds': {'maxConnectionAttempts': 1, 'maxWgoRows': c.MAX_ROWS, 'pageKeys': c.PAGE_KEYS, 'maxSQLDispatches': c.MAX_QUERIES,
                   'maxTotalSourceBytes': c.MAX_TOTAL_BYTES, 'maxSinglePageBytes': c.MAX_PAGE_BYTES, 'maxKeyBytes': c.MAX_KEY_BYTES,
                   'querySeconds': c.QUERY_SECONDS, 'lockTimeoutSeconds': 1, 'idleInTransactionSeconds': 10,
                   'collectionSeconds': c.TOTAL_SECONDS, 'connectionSeconds': 4, 'closeSeconds': 2,
                   'maxLinkedRowsPerSourcePerKey': c.MAX_LINKED, 'concurrency': 1, 'automaticRetries': 0},
        'transaction': 'REPEATABLE READ READ ONLY; rollback at completion; transaction-local settings only',
        'window': {'open': w.WINDOW_OPEN.isoformat(), 'close': w.WINDOW_CLOSE.isoformat(),
                   'afterLatestNativeRetrieval': True, 'maxHoursAfterEarliestNativeRetrieval': w.MAX_HOURS_AFTER_EARLIEST_NATIVE},
        'action': 'One new current capture only; no repairs, writes, migration, provider fetch, settings persistence, scores',
        'authority': 'None by this file. The single live read needs TJ approval of the exact RUNBOOK command and this file hash.',
        'pins': {'local': local_pins(), 'external': external_pins()},
        'testsReceiptSHA256': receipt_sha,
    }


def encode(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()


if __name__ == '__main__':
    receipt = (ROOT / 'TESTS-RECEIPT.json').read_bytes()
    body = encode(build(hashlib.sha256(receipt).hexdigest()))
    (ROOT / 'LIVE-READ-SCOPE.json').write_bytes(body)
    print(json.dumps({'ok': True, 'scopeSHA256': hashlib.sha256(body).hexdigest()}))

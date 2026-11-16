"""Offline tests: retargeted capture core, ReadOnlySession and the live wrapper's gates. No network, no credentials.

Run (from anywhere): env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B <folder>/tests/test_reader.py
"""
import asyncio
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path[:0] = [str(ROOT), str(HERE)]
import capture_reader as c          # noqa: E402
import fake_db as f                 # noqa: E402
import read_only_session as ros     # noqa: E402
import run_live_read as w           # noqa: E402
import make_scope                   # noqa: E402

SCRATCH = Path(os.environ.get('READER_TEST_SCRATCH') or tempfile.mkdtemp(prefix='blsh-reader-tests-'))
CLOCK = '2026-11-17T14:20:00.000000+00:00'
FAKE_DSN = 'postgresql://postgres:offline-fake-password-not-real@db.fyhftlxokyjtpndbkfse.supabase.co:5432/postgres'
UTC = dt.timezone.utc


def no_network(*_a, **_k):
    raise AssertionError('network attempted in an offline test')


def sha(b):
    return hashlib.sha256(b).hexdigest()


BASE_DB = f.FakeDB()  # parse the retained RAW once


def fresh_db(data=None):
    db = f.FakeDB.__new__(f.FakeDB)
    f.FakeDB.__init__(db, data if data is not None else copy.deepcopy(BASE_DB.data))
    return db


class Base(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix='t-', dir=SCRATCH))
        self.p1 = patch.object(c, 'utc_now', f.fixed_clock(CLOCK)); self.p1.start()
        self.p2 = patch.object(socket.socket, 'connect', no_network); self.p2.start()

    def tearDown(self):
        self.p1.stop(); self.p2.stop()

    async def cap(self, session=None, event_through=c.DATE_MAX):
        self.session = session or f.FakeSession(fresh_db())
        self.out = self.dir / 'attempt'
        self.result = await c.capture(self.session, self.out, event_through)
        return self.result

    def held(self, code=None):
        self.assertNotIn(self.result['state'], ('OFFLINE_CAPTURE_SIMULATION_COMPLETE', 'CAPTURED_READ_ONLY_UNQUALIFIED'))
        self.assertFalse((self.out / 'SIMULATED-REQUEST.json').exists())
        self.assertFalse((self.out / 'CURRENT-REQUEST.json').exists())
        self.assertTrue(self.result['sessionClosed'])
        if code:
            self.assertEqual(self.result['errorCode'], code)


class CoreTests(Base):
    async def test_happy_window_dates_and_counts(self):
        r = await self.cap()
        self.assertEqual(r['state'], 'OFFLINE_CAPTURE_SIMULATION_COMPLETE')
        self.assertEqual(r['rows'], {'wgo': 7199, 'individual': 6731, 'onIce': 6551, 'calendar': 200})
        self.assertEqual(r['queriesDispatched'], 28)  # 6 control + meta + key + 18 pages + meta + rollback
        req = json.loads((self.out / 'SIMULATED-REQUEST.json').read_text())
        dates = {x['date'] for x in req['wgo']['rows']}
        self.assertEqual((min(dates), max(dates)), ('2026-10-14', '2026-11-11'))
        self.assertNotIn('2026-11-12', dates)
        self.assertEqual(sum(x['date'] == '2026-11-11' for x in req['wgo']['rows']), 288)
        self.assertEqual(req['eventThroughDate'], '2026-11-11'); self.assertEqual(req['asOfUTC'], CLOCK)
        self.assertEqual(req['freshnessPolicy'], {'id': 'blsh-capture-reader-v1-event7days-capture24hours', 'maxEventAgeDays': 7, 'maxCaptureAgeHours': 24})
        self.assertEqual(self.session.db.calls[-1][0], 'ROLLBACK'); self.assertEqual(self.session.closes, 1)
        self.assertFalse((self.out / 'CURRENT-REQUEST.json').exists())
        self.assertLessEqual(r['sourceBytes'], c.MAX_TOTAL_BYTES)

    def test_date_from_is_the_justified_choice(self):
        import justify_date_from as j
        a = j.analyse()
        self.assertEqual((a['choice']['dateFrom'], c.DATE_MIN, c.DATE_MAX), ('2026-10-14', '2026-10-14', '2026-11-11'))
        self.assertTrue(a['projection']['fullSeasonExceedsCap']); self.assertLessEqual(a['choice']['projectedRows'], 0.75 * c.MAX_ROWS)
        self.assertLessEqual(a['choice']['dispatches'], c.MAX_QUERIES)
        self.assertEqual(json.loads((ROOT / 'DATE-FROM.json').read_text()), json.loads(json.dumps(a)))

    async def test_sql_text_identical_to_the_retained_live_dispatches(self):
        await self.cap()
        def disp(n):
            return json.loads((f.RETAINED / ('query-%02d-DISPATCH.json' % n)).read_text())['querySHA256']
        for n, sql in enumerate(c.INIT_SQL, 1):
            self.assertEqual(sha(sql.encode()), disp(n))
        self.assertEqual(sha(c.META_SQL.encode()), disp(7)); self.assertEqual(sha(c.KEY_SQL.encode()), disp(8))
        self.assertEqual(sha(c.PAGE_SQL.encode()), disp(9)); self.assertEqual(sha(b'ROLLBACK'), disp(31))

    async def test_parameters_are_the_narrowed_scope(self):
        await self.cap()
        keys = [p for s, p in self.session.db.calls if s == c.KEY_SQL]
        self.assertEqual(keys, [(20262027, '2026-10-14', '2026-11-11')])
        pages = [p for s, p in self.session.db.calls if s == c.PAGE_SQL]
        self.assertTrue(all(p[1:] == (20262027, '2026-10-14', '2026-11-11') and len(p[0]) <= 400 for p in pages))

    def window_rows(self, n):
        data = copy.deepcopy(BASE_DB.data)
        inside = [r for r in data['wgo'] if '2026-10-14' <= r['date'] <= '2026-11-11']
        extra = []
        k = 0
        while len(inside) + len(extra) < n:
            r = inside[k % len(inside)]; extra.append({**r, 'id': r['id'] + 60_000_000 + 10_000_000 * (k // len(inside))}); k += 1
        data['wgo'] += extra[: max(0, n - len(inside))]
        return data

    async def test_row_cap_refuses_before_any_page(self):
        db = fresh_db(self.window_rows(10001))
        await self.cap(f.FakeSession(db)); self.held('cohort_bound_or_id')
        self.assertFalse(any(s == c.PAGE_SQL for s, _ in db.calls))
        self.assertEqual(self.result['queriesDispatched'], 8)

    async def test_exactly_10000_rows_uses_exactly_35_dispatches(self):
        r = await self.cap(f.FakeSession(fresh_db(self.window_rows(10000))))
        self.assertEqual(r['state'], 'OFFLINE_CAPTURE_SIMULATION_COMPLETE')
        self.assertEqual(r['rows']['wgo'], 10000); self.assertEqual(r['queriesDispatched'], c.MAX_QUERIES)

    async def test_dispatch_budget_refuses_without_dispatch(self):
        with patch.object(c, 'MAX_QUERIES', 27):
            await self.cap()
        self.held('dispatch_budget'); self.assertEqual(self.result['queriesDispatched'], 27)
        self.assertNotIn('uncertainDispatch', self.result)

    async def test_client_page_byte_cap(self):
        db = fresh_db(); db.mutate['page'] = lambda v: [(v[0][0][:-1] + ',"pad":"' + 'x' * c.MAX_PAGE_BYTES + '"}',)]
        await self.cap(f.FakeSession(db)); self.held('client_response_bound')

    async def test_server_page_byte_cap_and_error_payload(self):
        db = fresh_db(); db.mutate['page'] = lambda v: [('{"error":"response_bound_exceeded"}',)]
        await self.cap(f.FakeSession(db)); self.held('server_response_bound_or_error')

    async def test_key_byte_cap(self):
        db = fresh_db(); db.mutate['key'] = lambda v: [('{"ids":[' + ','.join(['1'] * 70000) + '],"rows":70000}',)]
        await self.cap(f.FakeSession(db)); self.held('client_response_bound')

    async def test_total_byte_cap(self):
        # By construction 25 pages x 256 KiB + 128 KiB key + 2 x 8 KiB meta < 8 MiB, so only a lowered cap can reach it.
        self.assertLess(25 * c.MAX_PAGE_BYTES + c.MAX_KEY_BYTES + 2 * 8192, c.MAX_TOTAL_BYTES)
        with patch.object(c, 'MAX_TOTAL_BYTES', 1_000_000):
            await self.cap()
        self.held('total_response_bound')

    async def test_statement_timeout_is_an_uncertain_dispatch_without_retry(self):
        db = fresh_db(); db.delay['page'] = 0.3
        with patch.object(c, 'QUERY_SECONDS', 0.05):
            await self.cap(f.FakeSession(db))
        self.held(); self.assertEqual(self.result['state'], 'DISPATCH_OUTCOME_UNKNOWN_NO_RETRY')
        self.assertEqual(sum(s == c.PAGE_SQL for s, _ in db.calls), 1)
        self.assertTrue((self.out / 'query-09-DISPATCH.json').exists()); self.assertFalse((self.out / 'query-09-RECEIPT.json').exists())

    async def test_total_deadline_stops_before_dispatch(self):
        with patch.object(c, 'TOTAL_SECONDS', 0):
            await self.cap()
        self.held('dispatch_budget'); self.assertEqual(self.result['queriesDispatched'], 0)

    async def test_session_contract_lock_and_statement_timeouts(self):
        for key, bad in (('lockTimeout', '2s'), ('statementTimeout', '0'), ('readOnly', 'off'), ('isolation', 'read committed')):
            db = fresh_db(); db.meta[key] = bad
            self.out = self.dir / ('a-' + key); s = f.FakeSession(db)
            self.result = await c.capture(s, self.out); self.held('session_contract_' + key)
            self.assertFalse(any(q == c.KEY_SQL for q, _ in db.calls))

    async def test_missing_meta_key(self):
        db = fresh_db(); del db.meta['timezone']
        await self.cap(f.FakeSession(db)); self.held('session_contract_timezone')

    async def test_snapshot_drift(self):
        db = fresh_db(); db.final_meta = {**db.meta, 'snapshot': '901:901:'}
        await self.cap(f.FakeSession(db)); self.held('session_or_snapshot_drift')

    async def test_query_shape_two_cells(self):
        db = fresh_db(); db.mutate['key'] = lambda v: [(v[0][0], 'extra')]
        await self.cap(f.FakeSession(db)); self.held('query_shape')

    async def test_row_group_shape(self):
        db = fresh_db()
        def drop_calendar(v):
            d = json.loads(v[0][0]); d['rows'][0] = d['rows'][0][:3]; return [(json.dumps(d),)]
        db.mutate['page'] = drop_calendar
        await self.cap(f.FakeSession(db)); self.held('row_group_shape')

    async def test_extra_wgo_column(self):
        db = fresh_db()
        def extra(v):
            d = json.loads(v[0][0]); d['rows'][0][0].append(1); return [(json.dumps(d),)]
        db.mutate['page'] = extra
        await self.cap(f.FakeSession(db)); self.held('wgo_row_shape')

    async def test_missing_process_column(self):
        db = fresh_db()
        def missing(v):
            d = json.loads(v[0][0])
            g = next(x for x in d['rows'] if x[1]); g[1][0] = g[1][0][:-1]; return [(json.dumps(d),)]
        db.mutate['page'] = missing
        await self.cap(f.FakeSession(db)); self.held('source_row_shape')

    async def test_missing_sealed_key(self):
        db = fresh_db()
        def drop(v):
            d = json.loads(v[0][0]); d['rows'].pop(); return [(json.dumps(d),)]
        db.mutate['page'] = drop
        await self.cap(f.FakeSession(db)); self.held('missing_or_added_sealed_key')

    async def test_added_sealed_key(self):
        db = fresh_db()
        def add(v):
            d = json.loads(v[0][0]); d['rows'].append(copy.deepcopy(d['rows'][0])); return [(json.dumps(d),)]
        db.mutate['page'] = add
        await self.cap(f.FakeSession(db)); self.held('missing_or_added_sealed_key')

    async def test_reordered_sealed_keys(self):
        db = fresh_db()
        def swap(v):
            d = json.loads(v[0][0]); d['rows'][0], d['rows'][1] = d['rows'][1], d['rows'][0]; return [(json.dumps(d),)]
        db.mutate['page'] = swap
        await self.cap(f.FakeSession(db)); self.held('sealed_key_order_or_identity')

    async def test_key_seal_count_mismatch(self):
        db = fresh_db()
        def lie(v):
            d = json.loads(v[0][0]); d['rows'] += 1; return [(json.dumps(d),)]
        db.mutate['key'] = lie
        await self.cap(f.FakeSession(db)); self.held('key_seal_shape')

    async def test_post_cutoff_row_in_a_page_is_refused(self):
        db = fresh_db()
        def leak(v):
            d = json.loads(v[0][0]); d['rows'][0][0][c.COLUMNS['wgo'].index('date')] = '2026-11-12'; return [(json.dumps(d),)]
        db.mutate['page'] = leak
        await self.cap(f.FakeSession(db)); self.held('wgo_out_of_scope')

    async def test_frozen_scope_refuses_other_dates_before_dispatch(self):
        for date in ('2026-11-12', '2026-10-13', '2026-11-31', '2026-11-11; SELECT 1'):
            s = f.FakeSession(fresh_db()); self.out = self.dir / ('fz' + str(abs(hash(date))))
            self.result = await c.capture(s, self.out, date)
            self.assertEqual(self.result['errorCode'], 'frozen_current_date_scope'); self.assertEqual(self.result['queriesDispatched'], 0)

    async def test_close_failure_never_publishes(self):
        s = f.FakeSession(fresh_db()); s.close_fail = True
        await self.cap(s)
        self.assertEqual(self.result['state'], 'SESSION_CLOSE_UNCONFIRMED')
        self.assertFalse((self.out / 'SIMULATED-REQUEST.json').exists())
        self.assertNotIn('secret connection', (self.out / 'RESULT.json').read_text())

    async def test_existing_attempt_never_overwritten(self):
        await self.cap(); before = (self.out / 'RESULT.json').read_bytes()
        r = await c.capture(f.FakeSession(fresh_db()), self.out)
        self.assertEqual(r['queriesDispatched'], 0); self.assertEqual((self.out / 'RESULT.json').read_bytes(), before)


class SessionTests(Base):
    async def test_allowlist_and_parameter_scope(self):
        s = ros.ReadOnlySession(f.FakeRaw(fresh_db(), ros.HOST))
        cases = [('SELECT 1', None, 'capture_sql_allowlist'),
                 (c.KEY_SQL, (20262027, '2026-07-01', '2026-10-31'), 'key_parameter_scope'),
                 (c.KEY_SQL, (20262027, '2026-10-14', '2026-11-12'), 'key_parameter_scope'),
                 (c.PAGE_SQL, ([3, 2], 20262027, '2026-10-14', '2026-11-11'), 'page_key_scope'),
                 (c.PAGE_SQL, (list(range(1, 402)), 20262027, '2026-10-14', '2026-11-11'), 'page_key_scope'),
                 (c.PAGE_SQL, ([1], 20252026, '2026-10-14', '2026-11-11'), 'page_parameter_scope'),
                 ('ROLLBACK', ('x',), 'control_parameter_scope')]
        for sql, params, code in cases:
            with self.assertRaisesRegex(c.CaptureError, code):
                await s.query(sql, params)
        self.assertEqual(s.raw.executed, [])

    async def test_full_capture_through_read_only_session(self):
        raw = f.FakeRaw(fresh_db(), ros.HOST)
        r = await self.cap(ros.ReadOnlySession(raw))
        self.assertEqual(r['state'], 'CAPTURED_READ_ONLY_UNQUALIFIED'); self.assertEqual(r['rows']['wgo'], 7199)
        self.assertTrue((self.out / 'CURRENT-REQUEST.json').exists()); self.assertTrue(raw.closed)
        self.assertEqual(len(raw.executed), 28)

    def test_bind(self):
        route = 'postgresql://postgres.fyhftlxokyjtpndbkfse@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
        self.assertEqual(ros.bind(ros.PROJECT, route, FAKE_DSN), ('postgres.fyhftlxokyjtpndbkfse', 'offline-fake-password-not-real'))
        for project, rt, dsn, code in [('other', route, FAKE_DSN, 'project_binding_drift'),
                                       (ros.PROJECT, route.replace('aws-0', 'aws-9'), FAKE_DSN, 'session_pooler_binding_drift'),
                                       (ros.PROJECT, route, FAKE_DSN.replace('db.fyh', 'db.xyz'), 'existing_credential_binding_drift'),
                                       (ros.PROJECT, route, FAKE_DSN.replace(':offline-fake-password-not-real', ''), 'existing_credential_binding_drift')]:
            with self.assertRaisesRegex(c.CaptureError, code):
                ros.bind(project, rt, dsn)

    async def test_open_uses_verify_full_pinned_bundle_and_read_only_options(self):
        seen = {}
        def connect(**kw):
            seen.update(kw); return f.FakeRaw(fresh_db(), ros.HOST)
        with patch.object(ros.psycopg2, 'connect', connect):
            s = await ros.open_existing_read_only(FAKE_DSN)
        self.assertIsInstance(s, ros.ReadOnlySession)
        self.assertEqual((seen['sslmode'], seen['sslrootcert'], seen['host'], seen['port'], seen['dbname']),
                         ('verify-full', str(ros.BUNDLE), ros.HOST, 5432, 'postgres'))
        self.assertEqual(seen['application_name'], 'BLSH_READONLY_CAPTURE_20261111')
        self.assertEqual(seen['options'], '-c default_transaction_read_only=on -c statement_timeout=5000')
        self.assertEqual(seen['async_'], 1); self.assertEqual(seen['connect_timeout'], 3)

    async def test_open_refuses_unverified_endpoint(self):
        def connect(**kw):
            raw = f.FakeRaw(fresh_db(), ros.HOST); raw.info.ssl_in_use = False; return raw
        with patch.object(ros.psycopg2, 'connect', connect):
            with self.assertRaisesRegex(c.CaptureError, 'verified_TLS_endpoint_required'):
                await ros.open_existing_read_only(FAKE_DSN)


def make_conversion(directory, *, date='2026-11-11', klass='candidate_pending_independent_review',
                    natives=('2026-11-17T14:05:20.000Z', '2026-11-17T14:05:41.000Z'), candidate='v5', **over):
    d = Path(directory); d.mkdir(parents=True)
    approved = {k: v for k, v in w.CANDIDATES[candidate].items()}
    conv = {'evidenceClass': klass, 'approvedInputs': True, 'date': date, **approved, **over}
    files = {'CONVERSION.json': json.dumps(conv).encode(),
             'receipt-individual.json': json.dumps({'retrievedAtUTC': natives[0]}).encode(),
             'receipt-onIce.json': json.dumps({'retrievedAtUTC': natives[1]}).encode()}
    for n, b in files.items():
        (d / n).write_bytes(b)
    (d / 'MANIFEST.json').write_text(json.dumps({'files': [{'file': n, 'sha256': sha(b), 'bytes': len(b)} for n, b in files.items()]}))
    return d


class WrapperTests(Base):
    def setUp(self):
        super().setUp()
        self.pins = make_scope.local_pins()
        self.receipt = self.dir / 'TESTS-RECEIPT.json'
        self.receipt.write_text(json.dumps({'passed': 1, 'failed': 0, 'pins': self.pins}))
        self.scope = self.dir / 'LIVE-READ-SCOPE.json'
        self.scope.write_bytes(make_scope.encode(make_scope.build(sha(self.receipt.read_bytes()))))
        self.env = self.dir / 'env.local'
        self.env.write_text('# test\nNEXT_PUBLIC_SUPABASE_URL=https://x\nexport SUPABASE_DB_URL="%s"\n' % FAKE_DSN); os.chmod(self.env, 0o600)
        self.conv = make_conversion(self.dir / 'conversion')
        self.work = self.dir / 'work'; self.work.mkdir()
        self.locks = self.dir / 'locks'
        self.logs = []; self.exported = []

    def args(self, **over):
        a = {'execute-read-only': True, 'candidate': 'v5', 'scope-sha': sha(self.scope.read_bytes()), 'conversion': str(self.conv),
             'out': str(self.work / 'request-read'), 'request-out': str(self.work / 'request.json'), 'context-out': str(self.work / 'context.json')}
        a.update(over); return a

    def go(self, args=None, *, now=dt.datetime(2026, 11, 17, 14, 20, tzinfo=UTC), env=None, connect=None):
        def export(args, summary):
            self.exported.append(summary); return {'ok': True}
        def default_connect(**kw):
            return f.FakeRaw(fresh_db(), ros.HOST)
        with patch.object(ros.psycopg2, 'connect', connect or default_connect):
            return w.run(args or self.args(), own_env=env if env is not None else {'PATH': '/usr/bin:/bin', 'LC_CTYPE': 'UTF-8'},
                         now=lambda: now, env_file=self.env, lock_dir=self.locks, export=export,
                         scope_path=self.scope, tests_receipt=self.receipt, startup_modules=frozenset(sys.modules),
                         log=self.logs.append)

    def refused(self, code, **kw):
        with self.assertRaises(w.Refuse) as e:
            self.go(**kw)
        self.assertTrue(str(e.exception).startswith(code), str(e.exception))
        self.assertFalse((self.work / 'request-read').exists())
        return str(e.exception)

    def no_lock_taken(self):
        self.assertFalse(self.locks.exists() and any(self.locks.iterdir()))

    def test_happy_path_one_connection_lock_and_release(self):
        rc = self.go()
        self.assertEqual(rc, 0)
        res = json.loads((self.work / 'request-read/RESULT.json').read_text())
        self.assertEqual(res['state'], 'REQUEST_AND_CONTEXT_EXPORTED'); self.assertEqual(res['connectionAttempts'], 1)
        self.assertEqual(res['rows']['wgo'], 7199); self.assertTrue(res['sessionClosed'])
        self.assertTrue((self.work / 'request-read/capture/CURRENT-REQUEST.json').exists())
        self.assertTrue((self.locks / 'fhfh-blsh-native-20261117T140500Z.lock').exists())
        self.assertEqual(res['candidate'], 'v5')
        blob = ''.join(p.read_text() for p in (self.work / 'request-read').rglob('*.json')) + json.dumps(self.logs)
        self.assertNotIn('offline-fake-password-not-real', blob)
        # second run: new output paths, same packet -> refused on its lock, no connection
        with self.assertRaisesRegex(w.Refuse, 'packet_lock_exists_no_second_read'):
            self.go(self.args(out=str(self.work / 'r2'), **{'request-out': str(self.work / 'q2.json'), 'context-out': str(self.work / 'c2.json')}))
        self.assertFalse((self.work / 'r2').exists())

    def test_connection_failure_is_final_and_value_free(self):
        def boom(**kw):
            raise RuntimeError('password=offline-fake-password-not-real host detail')
        self.assertEqual(self.go(connect=boom), 1)
        res = (self.work / 'request-read/RESULT.json').read_text()
        self.assertIn('CONNECTION_OR_WRAPPER_STOPPED_NO_RETRY', res); self.assertNotIn('offline-fake-password', res)
        self.assertEqual(self.exported, [])

    def test_env_allowlist(self):
        for key in ('DYLD_INSERT_LIBRARIES', 'PGSSLMODE', 'PGOPTIONS', 'PYTHONPATH', 'SSL_CERT_FILE', 'HOME'):
            code = self.refused('env_key_not_allowed', env={'PATH': '/usr/bin:/bin', key: 'v'})
            self.assertEqual(code, 'env_key_not_allowed:' + key)
        self.no_lock_taken()

    def test_flag_scope_and_pins(self):
        self.refused('explicit_execute_flag_required', args=self.args(**{'execute-read-only': False}))
        self.refused('usage', args=self.args(out='relative/out'))
        self.refused('scope_sha_mismatch', args=self.args(**{'scope-sha': '0' * 64}))
        bad = json.loads(self.scope.read_text()); bad['pins']['local']['capture_reader.py'] = '0' * 64
        self.scope.write_bytes(make_scope.encode(bad))
        self.refused('local_pin_drift:capture_reader.py', args=self.args(**{'scope-sha': sha(self.scope.read_bytes())}))
        bad['pins']['local'] = self.pins; bad['pins']['external']['trustBundle']['sha256'] = '1' * 64
        self.scope.write_bytes(make_scope.encode(bad))
        self.refused('external_pin_drift:trustBundle', args=self.args(**{'scope-sha': sha(self.scope.read_bytes())}))
        self.no_lock_taken()

    def test_preflight_is_value_free_and_checks_pins(self):
        self.env.unlink()  # proves the env file is never opened
        rc = w.run({'preflight': True, 'scope-sha': sha(self.scope.read_bytes())}, own_env={'PATH': '/usr/bin:/bin'},
                   lock_dir=self.locks, scope_path=self.scope, tests_receipt=self.receipt,
                   startup_modules=frozenset(sys.modules), log=self.logs.append)
        self.assertEqual(rc, 0); self.assertEqual(self.logs[-1]['reader'], 'preflight_ok')
        with self.assertRaisesRegex(w.Refuse, 'usage'):
            w.run({'preflight': True, 'scope-sha': 'x', 'conversion': '/x'}, own_env={}, log=self.logs.append)
        with self.assertRaisesRegex(w.Refuse, 'scope_sha_mismatch'):
            w.run({'preflight': True, 'scope-sha': '0' * 64}, own_env={}, scope_path=self.scope, tests_receipt=self.receipt, log=self.logs.append)
        self.no_lock_taken()

    def test_libpq_client_dir_refused(self):
        home = self.dir / 'home'; (home / '.postgresql').mkdir(parents=True)
        with self.assertRaisesRegex(w.Refuse, 'libpq_client_dir_present'):
            w.check_no_libpq_client_dir(str(home))
        w.check_no_libpq_client_dir(str(self.dir))

    def test_parse_args(self):
        self.assertEqual(w.parse_args(['--preflight', '--scope-sha', 'a']), {'preflight': True, 'scope-sha': 'a'})
        for bad in (['--scope-sha'], ['--out', 'a', '--out', 'b'], ['--preflight', '--preflight'], ['--password', 'x']):
            with self.assertRaisesRegex(w.Refuse, 'usage'):
                w.parse_args(bad)

    def test_tests_receipt(self):
        self.receipt.write_text(json.dumps({'passed': 1, 'failed': 1, 'pins': self.pins}))
        self.refused('tests_receipt_not_pinned')
        self.scope.write_bytes(make_scope.encode(make_scope.build(sha(self.receipt.read_bytes()))))
        self.refused('tests_receipt_not_green_for_these_pins', args=self.args(**{'scope-sha': sha(self.scope.read_bytes())}))

    def test_conversion_gates(self):
        self.refused('candidate_required', args=self.args(candidate=''))
        self.refused('candidate_unknown', args=self.args(candidate='v6'))
        for name, kw, code in [('c1', {'klass': 'diagnostic_only_synthetic_adapter'}, 'conversion_not_candidate'),
                               ('c2', {'date': '2026-10-01'}, 'conversion_date_not_20261111'),
                               # A3: the class as written is not enough; the approved hashes are re-derived per candidate
                               ('c5', {'pinsSHA256': '0' * 64}, 'conversion_not_approved_for_candidate'),
                               ('c6', {'verifierSHA256': '0' * 64}, 'conversion_not_approved_for_candidate'),
                               ('c7', {'lineageSHA256': '0' * 64}, 'conversion_not_approved_for_candidate'),
                               ('c8', {'candidate': 'v5-1118'}, 'conversion_not_approved_for_candidate'),
                               ('c9', {'packet': 'fhfh-blsh-native-TEST'}, 'conversion_packet_not_candidate_slot')]:
            self.conv = make_conversion(self.dir / name, **kw); self.refused(code)
        self.conv = make_conversion(self.dir / 'c3'); (self.conv / 'receipt-onIce.json').write_text('{}')
        self.refused('conversion_hash_drift')
        self.conv = make_conversion(self.dir / 'c4'); (self.conv / 'stray.json').write_text('{}')
        self.refused('conversion_unlisted_file')
        self.no_lock_taken()

    def test_time_window(self):
        t = lambda *a: dt.datetime(*a, tzinfo=UTC)
        self.refused('outside_read_window', now=t(2026, 11, 17, 14, 4, 59))
        self.refused('outside_read_window', now=t(2026, 11, 19, 0, 0, 0))
        self.refused('read_before_native_capture', now=t(2026, 11, 17, 14, 5, 30))
        self.refused('read_too_late_after_native_capture', now=t(2026, 11, 18, 2, 5, 21))
        self.no_lock_taken()

    def test_outputs_and_env_file_never_take_the_packet_lock(self):
        (self.work / 'request.json').write_text('{}'); self.refused('output_exists_no_retry'); (self.work / 'request.json').unlink()
        os.chmod(self.env, 0o644); self.refused('env_file_not_private_regular_file'); os.chmod(self.env, 0o600)
        link = self.dir / 'env.link'; link.symlink_to(self.env); good = self.env; self.env = link
        self.refused('env_file_not_private_regular_file'); self.env = good
        for text, code in (('SUPABASE_DB_URL=a\nSUPABASE_DB_URL=b\n', 'SUPABASE_DB_URL_missing_or_duplicate'),
                           ('OTHER=1\n', 'SUPABASE_DB_URL_missing_or_duplicate'),
                           ('SUPABASE_DB_URL=abc # comment\n', 'SUPABASE_DB_URL_shape_suspect')):
            self.env.write_text(text); self.refused(code)
        self.no_lock_taken()


PY = ['/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', '/opt/anaconda3/bin/python3', '-I', '-B']
NOBC = ['-X', 'pycache_prefix=/var/empty']


def planted_pyc(directory, name, source, tampered):
    """A timestamp-valid .pyc whose header matches the source mtime/size but whose code differs (RECHECK-11 A1)."""
    import importlib._bootstrap_external as b
    import importlib.util
    d = Path(directory); d.mkdir(parents=True, exist_ok=True)
    src = d / (name + '.py'); src.write_text(source)
    st = os.stat(src)
    pyc = Path(importlib.util.cache_from_source(str(src)))
    pyc.parent.mkdir(exist_ok=True)
    pyc.write_bytes(b._code_to_timestamp_pyc(compile(tampered, str(src), 'exec'), int(st.st_mtime), st.st_size))
    return src


class IntegrityTests(Base):
    """RECHECK-11 A1: every module the reader imports comes from a pinned source file."""
    def run_py(self, *args, cwd=None):
        import subprocess
        return subprocess.run([*PY, *args], capture_output=True, text=True, timeout=120, cwd=cwd)

    def test_planted_pyc_never_runs_for_pinned_modules(self):
        src = planted_pyc(self.dir / 'pyc', 'probe_mod', "X = 'pinned-source'\n", "X = 'TAMPERED-pyc'\n")
        # control: an ordinary import under -I -B does load the planted bytecode
        ctl = self.run_py('-c', 'import sys; sys.path.insert(0, %r); import probe_mod; print(probe_mod.X)' % str(src.parent))
        self.assertEqual(ctl.stdout.strip(), 'TAMPERED-pyc')
        # the reader's loader executes the hashed source bytes, so the .pyc is never consulted
        m = w.load_pinned_module('probe_mod', sha(src.read_bytes()), root=src.parent)
        try:
            self.assertEqual(m.X, 'pinned-source')
        finally:
            sys.modules.pop('probe_mod', None)
        with self.assertRaisesRegex(w.Refuse, 'module_source_not_pinned:probe_mod'):
            w.load_pinned_module('probe_mod', '0' * 64, root=src.parent)
        # and with the documented flag, even ordinary imports compile from source
        fixed = self.run_py(*NOBC, '-c', 'import sys; sys.path.insert(0, %r); import probe_mod; print(probe_mod.X)' % str(src.parent))
        self.assertEqual(fixed.stdout.strip(), 'pinned-source')

    def test_entry_refuses_without_the_empty_pycache_prefix(self):
        r = self.run_py(str(ROOT / 'run_live_read.py'), '--preflight', '--scope-sha', '0' * 64)
        self.assertEqual(json.loads(r.stdout)['code'], 'bytecode_cache_not_disabled'); self.assertEqual(r.returncode, 2)
        r = self.run_py('-X', 'pycache_prefix=%s' % (self.dir / 'mine'), str(ROOT / 'run_live_read.py'), '--preflight', '--scope-sha', '0' * 64)
        self.assertEqual(json.loads(r.stdout)['code'], 'bytecode_cache_not_disabled')
        r = self.run_py(*NOBC, str(ROOT / 'run_live_read.py'), '--preflight', '--scope-sha', '0' * 64)
        self.assertEqual(json.loads(r.stdout)['code'], 'scope_sha_mismatch')  # gate passed; refused later

    def test_copied_folder_with_shadow_module_refuses_and_plant_never_runs(self):
        import shutil
        copy = self.dir / 'reader-copy'
        shutil.copytree(ROOT, copy, ignore=shutil.ignore_patterns('locks'))
        (copy / 'psycopg2.py').write_text('print("PLANTED psycopg2.py ran")\nraise SystemExit(0)\n')
        scope_sha = sha((copy / 'LIVE-READ-SCOPE.json').read_bytes())
        for flags in ([], NOBC):
            r = self.run_py(*flags, str(copy / 'run_live_read.py'), '--preflight', '--scope-sha', scope_sha)
            self.assertNotIn('PLANTED', r.stdout + r.stderr); self.assertEqual(r.returncode, 2)
        self.assertEqual(json.loads(r.stdout)['code'], 'reader_root_not_pinned')

    def test_real_entry_loads_pinned_sources_and_pinned_psycopg2(self):
        # The real file, run as a fresh isolated process with the documented flags, through its own loader + origin check.
        code = ("import importlib.util,json,sys; s=importlib.util.spec_from_file_location('run_live_read', %r); "
                "w=importlib.util.module_from_spec(s); s.loader.exec_module(w); "
                "scope={'pins':{'local':{n:w.sha_file(w.ROOT/n) for n in w.LOCAL_PINNED}}}; "
                "c,r,cust=w.load_and_check_modules(scope, w.STARTUP_MODULES); import psycopg2; "
                "print(json.dumps({'c':c.__file__,'r':r.__file__,'p':psycopg2.__file__,'x':psycopg2._psycopg.__file__,"
                "'path':str(w.ROOT) in sys.path,'cust':cust,'prefix':sys.pycache_prefix}))") % str(ROOT / 'run_live_read.py')
        r = self.run_py(*NOBC, '-c', code)
        out = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertEqual((out['c'], out['r']), (w.PINNED_ROOT + '/capture_reader.py', w.PINNED_ROOT + '/read_only_session.py'))
        self.assertTrue(out['p'].startswith(w.PSYCOPG2_TREE) and out['x'].startswith(w.PSYCOPG2_TREE))
        self.assertFalse(out['path']); self.assertEqual(out['prefix'], '/var/empty')

    def test_origin_check_refuses_shadow_wrong_origin_and_site_packages(self):
        import types
        def mod(name, f):
            m = types.ModuleType(name); m.__file__ = f; return m
        good = {'capture_reader': mod('capture_reader', w.PINNED_ROOT + '/capture_reader.py'),
                'read_only_session': mod('read_only_session', w.PINNED_ROOT + '/read_only_session.py'),
                'psycopg2': mod('psycopg2', w.PSYCOPG2_TREE + '__init__.py'),
                'psycopg2._psycopg': mod('psycopg2._psycopg', w.PSYCOPG2_TREE + '_psycopg.cpython-313-darwin.so'),
                'json': mod('json', w.STDLIB + 'json/__init__.py'),
                '_distutils_hack': mod('_distutils_hack', w.STDLIB + 'site-packages/_distutils_hack/__init__.py')}
        self.assertEqual(w.check_import_origins(good, frozenset({'_distutils_hack'})), ['_distutils_hack'])  # custody, recorded
        cases = [({'psycopg2': mod('psycopg2', w.PINNED_ROOT + '/psycopg2.py')}, 'module_origin_not_pinned:psycopg2'),
                 ({'psycopg2': mod('psycopg2', str(self.dir / 'site/psycopg2/__init__.py'))}, 'module_origin_not_pinned:psycopg2'),
                 ({'capture_reader': mod('capture_reader', str(self.dir / 'capture_reader.py'))}, 'module_origin_not_pinned:capture_reader'),
                 ({'six': mod('six', w.STDLIB + 'site-packages/six.py')}, 'module_origin_not_pinned:six'),
                 ({'_distutils_hack': mod('_distutils_hack', w.STDLIB + 'site-packages/_distutils_hack/__init__.py')}, 'module_origin_not_pinned:_distutils_hack')]
        for over, code in cases:
            startup = frozenset() if code.endswith('_distutils_hack') else frozenset({'_distutils_hack'})
            with self.assertRaisesRegex(w.Refuse, code):
                w.check_import_origins({**good, **over}, startup)
        missing = dict(good); del missing['psycopg2._psycopg']
        with self.assertRaisesRegex(w.Refuse, 'psycopg2_origin_not_pinned_tree'):
            w.check_import_origins(missing, frozenset({'_distutils_hack'}))

    def test_loader_refuses_a_preloaded_module_from_elsewhere(self):
        import types
        fake = types.ModuleType('capture_reader'); fake.__file__ = str(self.dir / 'capture_reader.py')
        with patch.dict(sys.modules, {'capture_reader': fake}):
            with self.assertRaisesRegex(w.Refuse, 'module_origin_not_pinned:capture_reader'):
                w.load_pinned_module('capture_reader', w.sha_file(ROOT / 'capture_reader.py'))


if __name__ == '__main__':
    unittest.main(verbosity=2)

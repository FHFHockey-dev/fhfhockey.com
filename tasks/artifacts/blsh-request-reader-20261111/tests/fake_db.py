"""TEST-ONLY offline database, rebuilt from the retained 2026-11-01 RAW rows (Codex live-read-01, read only).

Re-stamping (dates only; every stored value, id and join key stays real):
  * 2026-10-01 -> 2026-11-11 (+41 d): the only date with a real retained NST page, so the e2e can reach prepare_packet;
  * every other retained date -> +10 d (09-29..10-31 -> 10-09..11-10), so the narrowed window 10-14..11-11 holds a
    realistic ~7,200 rows and the dates before 10-14 test the dateFrom filter;
  * a post-cutoff copy of the retained 10-30 slate on 2026-11-12 (ids offset) tests the eventThroughDate filter.
The map is injective, so player/date uniqueness is preserved. No network, no credentials.

FakeDB executes the reader's five SQL shapes by their semantics (season/date parameters, LIMIT 10001, id subset,
linked LIMIT 9, server-side byte bounds) and answers with single-cell JSON text like Postgres would.
"""
import asyncio
import copy
import datetime as dt
import json
from pathlib import Path

import capture_reader as c

RETAINED = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture')
POST_CUTOFF_ID = 50_000_000
POST_CUTOFF_GAME = 1000


def restamp(day):
    d = dt.date.fromisoformat(day)
    if day == '2026-10-01':
        return '2026-11-11'
    return (d + dt.timedelta(days=10)).isoformat()


def load_retained():
    raw = {feed: json.loads((RETAINED / ('RAW-%s.json' % feed)).read_text())['records'] for feed in c.TABLES}
    out = {feed: [] for feed in c.TABLES}
    for r in raw['wgo']:
        out['wgo'].append({**r, 'date': restamp(r['date'])})
    for feed in ('individual', 'onIce'):
        for r in raw[feed]:
            out[feed].append({**r, 'date_scraped': restamp(r['date_scraped'])})
    for g in raw['calendar']:
        out['calendar'].append({**g, 'date': restamp(g['date'])})
    # Post-cutoff slate (2026-11-12) from the retained 10-30 rows (re-stamped 11-09).
    for r in [r for r in raw['wgo'] if r['date'] == '2026-10-30']:
        out['wgo'].append({**r, 'id': r['id'] + POST_CUTOFF_ID, 'date': '2026-11-12', 'game_id': r['game_id'] + POST_CUTOFF_GAME})
    for feed in ('individual', 'onIce'):
        for r in [r for r in raw[feed] if r['date_scraped'] == '2026-10-30']:
            out[feed].append({**r, 'id': r['id'] + POST_CUTOFF_ID, 'date_scraped': '2026-11-12'})
    for g in [g for g in raw['calendar'] if g['date'] == '2026-10-30']:
        out['calendar'].append({**g, 'id': g['id'] + POST_CUTOFF_GAME, 'date': '2026-11-12'})
    return out


def meta(snapshot_utc='2026-11-17T14:19:59.500000+00:00'):
    return dict(readOnly='on', isolation='repeatable read', statementTimeout='5s', lockTimeout='1s', idleTimeout='10s',
                searchPath='pg_catalog', timezone='UTC', pid=4242, snapshotUTC=snapshot_utc, snapshot='900:900:')


def bounded(value, cap):
    text = json.dumps(value, separators=(',', ':'))
    return text if len(text.encode()) <= cap else '{"error":"response_bound_exceeded"}'


class FakeDB:
    """Semantics of KEY_SQL / PAGE_SQL / META_SQL / INIT_SQL / ROLLBACK over in-memory rows."""
    def __init__(self, data=None):
        self.data = data if data is not None else load_retained()
        self.meta = meta(); self.final_meta = None; self.meta_calls = 0
        self.calls = []; self.delay = {}; self.mutate = {}; self.fail = set()
        self.index = {feed: {} for feed in ('individual', 'onIce')}
        for feed in self.index:
            for r in self.data[feed]:
                self.index[feed].setdefault((r['player_id'], r['date_scraped']), []).append(r)
        self.games = {}
        for g in self.data['calendar']:
            self.games.setdefault(g['id'], []).append(g)

    def answer(self, sql, params):
        if sql in c.INIT_SQL or sql == 'ROLLBACK':
            return None
        if sql == c.META_SQL:
            self.meta_calls += 1
            m = self.final_meta if self.meta_calls > 1 and self.final_meta else self.meta
            return json.dumps(m, separators=(',', ':'))
        if sql == c.KEY_SQL:
            season, dmin, dmax = params
            ids = sorted(r['id'] for r in self.data['wgo'] if r['season_id'] == season and dmin <= r['date'] <= dmax)[:10001]
            return bounded({'ids': ids, 'rows': len(ids)}, c.MAX_KEY_BYTES)
        if sql == c.PAGE_SQL:
            ids, season, dmin, dmax = params
            wanted = set(ids); rows = []
            for w in sorted(self.data['wgo'], key=lambda r: r['id']):
                if w['id'] in wanted and w['season_id'] == season and dmin <= w['date'] <= dmax:
                    linked = []
                    for feed in ('individual', 'onIce'):
                        hits = sorted((n for n in self.index[feed].get((w['player_id'], w['date']), []) if n['season'] == 20262027),
                                      key=lambda n: n['id'])[:9]
                        linked.append([[n[k] for k in c.COLUMNS[feed]] for n in hits])
                    games = sorted((g for g in self.games.get(w['game_id'], []) if g['seasonId'] == 20262027), key=lambda g: g['id'])[:9]
                    rows.append([[w[k] for k in c.COLUMNS['wgo']], linked[0], linked[1], [[g[k] for k in c.COLUMNS['calendar']] for g in games]])
            return bounded({'rows': rows}, c.MAX_PAGE_BYTES)
        raise AssertionError('unexpected SQL')

    async def query(self, sql, params=None):
        self.calls.append((sql, params))
        kind = self.kind(sql)
        if kind in self.delay:
            await asyncio.sleep(self.delay[kind])
        if kind in self.fail:
            raise asyncio.TimeoutError()
        value = self.answer(sql, params)
        result = [] if value is None else [(value,)]
        return self.mutate[kind](result) if kind in self.mutate else result

    @staticmethod
    def kind(sql):
        return {c.META_SQL: 'meta', c.KEY_SQL: 'key', c.PAGE_SQL: 'page', 'ROLLBACK': 'rollback'}.get(sql, 'init')


class FakeSession:
    """capture_kind offline_fixture: the core writes SIMULATED-REQUEST.json."""
    capture_kind = 'offline_fixture'

    def __init__(self, db=None):
        self.db = db or FakeDB(); self.closes = 0; self.close_fail = False

    async def query(self, sql, params=None):
        return await self.db.query(sql, params)

    async def close(self):
        self.closes += 1
        if self.close_fail:
            raise RuntimeError('secret connection detail must not be logged')


class FakeCursor:
    def __init__(self, raw):
        self.raw = raw; self.description = None; self.result = None

    def execute(self, sql, params=None):
        self.raw.executed.append((sql, params))
        value = self.raw.db.answer(sql, params)
        self.description = None if value is None else [('data',)]
        self.result = [] if value is None else [(value,)]

    def fetchall(self):
        return self.result

    def close(self):
        pass


class FakeInfo:
    ssl_in_use = True; port = 5432; dbname = 'postgres'

    def __init__(self, host):
        self.host = host


class FakeRaw:
    """psycopg2 async-connection lookalike for read_only_session.ReadOnlySession and the wrapper."""
    def __init__(self, db, host):
        self.db = db; self.info = FakeInfo(host); self.closed = 0; self.executed = []

    def poll(self):
        from psycopg2 import extensions
        return extensions.POLL_OK

    def get_transaction_status(self):
        from psycopg2 import extensions
        return extensions.TRANSACTION_STATUS_IDLE

    def cursor(self):
        return FakeCursor(self)

    def close(self):
        self.closed = 1


def fixed_clock(iso='2026-11-17T14:20:00.000000+00:00'):
    return lambda: iso


def deep(x):
    return copy.deepcopy(x)

from lib.sustainability import db_adapter


class FakeConn:
    def __init__(self):
        self.executed = 0
        self.closed = False
    def execute(self, sql, params=None):  # pragma: no cover - simple counter
        self.executed += 1
    def transaction(self):  # context manager stub
        class _T:
            def __enter__(self_inner): return None
            def __exit__(self_inner, exc_type, exc, tb): return False
        return _T()


class FakeContext:
    def __init__(self, conn):
        self.conn = conn
    def __enter__(self):
        return self.conn
    def __exit__(self, exc_type, exc, tb):
        return False


def test_upsert_barometers_batch_builds_multi_insert(monkeypatch):
    fake = FakeConn()
    monkeypatch.setattr(db_adapter, 'get_conn', lambda: FakeContext(fake))
    rows = []
    for i in range(3):
        rows.append({
            'player_id': i+1,
            'season_id': 2025,
            'position_code': 'F',
            'window_type': 'GAME',
            'game_date': f'2025-01-0{i+1}',
            'score_raw': 0.1 * i,
            'score': 10 + i,
            'contrib_total': 0.5 * i,
            'model_version': 1,
            'config_hash': 'hash',
            'rookie_status': False,
            'components_json': {'k':'v'}
        })
    count = db_adapter.upsert_barometers(rows, batch_size=10)
    assert count == 3
    # Single batch should result in exactly one execute call
    assert fake.executed == 1
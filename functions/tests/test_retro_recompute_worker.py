from lib.sustainability.retro_recompute import run_worker_once, QueueEntry
from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import DEFAULT_CONFIG, SustainabilityConfig


def fake_cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG['model_version'],
        weights=DEFAULT_CONFIG['weights_json'],
        toggles=DEFAULT_CONFIG['toggles_json'],
        constants=DEFAULT_CONFIG['constants_json'],
        sd_mode='fixed',
        freshness_days=DEFAULT_CONFIG['freshness_days'],
        config_hash='hash',
        source='default'
    )


class FakeDB:
    def __init__(self):
        self.upsert_calls = 0
    # mimic required adapter functions optionally used inside pipeline
    def fetch_max_barometer_game_date(self, model_version, window_type):
        return None
    def upsert_barometers(self, rows):  # not used directly due to module-level call
        self.upsert_calls += len(rows)


def test_run_worker_once_player_entry(monkeypatch):
    # Provide a queue with a single player entry
    entries = [QueueEntry(id=1, player_id=123, season_id=2025, reason='data_backfill')]

    def qp(limit):
        return entries

    # Provide a game fetcher returning minimal valid games
    def gf(player_id, season_id):
        return [
            {"player_id": player_id, "season_id": season_id, "position_code": "F", "game_id": "G1", "game_date": "2025-01-01",
             "shots":3, "goals":1, "onice_goals_for":2, "onice_shots_for":12, "points":1, "ixg":0.5, "icf":4, "hdcf":1}
        ]

    # Patch load_config to avoid DB dependency
    from lib.sustainability import config_loader
    monkeypatch.setattr(config_loader, 'load_config', lambda db_client=None: fake_cfg())

    count = run_worker_once(batch_limit=5, game_fetcher=gf, queue_provider=qp)
    assert count == 1
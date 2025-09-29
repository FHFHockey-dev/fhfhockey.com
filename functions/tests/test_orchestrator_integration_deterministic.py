"""Task 5.9: Deterministic orchestrator integration test.

Validates end‑to‑end determinism of snapshot persistence + reuse:
  * First run builds & persists snapshot (snapshot_persist phase)
  * Second run skips build and reuses identical snapshot (snapshot_reuse phase)
  * Total scored rows, snapshot thresholds, and anomaly stats are identical
Notes: Orchestrator deliberately does not expose per-window rows; we assert determinism
via stable aggregate invariants (counts, thresholds, anomaly stats). This guards that the
post‑reuse reassignment logic produces consistent tiering without needing row inspection.
"""
from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import SustainabilityConfig, DEFAULT_CONFIG


def _cfg():
    return SustainabilityConfig(
        model_version=DEFAULT_CONFIG["model_version"],
        weights=DEFAULT_CONFIG["weights_json"],
        toggles=DEFAULT_CONFIG["toggles_json"],
        constants=DEFAULT_CONFIG["constants_json"],
        sd_mode="fixed",
        freshness_days=DEFAULT_CONFIG["freshness_days"],
        config_hash="hash",  # fixed for determinism
        source="default",
    )


class _FakeDB:
    """Captures snapshot for persistence + supplies it for reuse."""

    def __init__(self):
        self.snapshot = None

    # Persist path
    def upsert_distribution_snapshot(self, snap):  # signature shape only
        self.snapshot = snap
        return 1

    # Reuse path
    def fetch_latest_distribution_snapshot(self, window_type, model_version, config_hash):
        return self.snapshot


def test_orchestrator_deterministic_snapshot_persist_and_reuse():
    games = [
        {"player_id": 1, "season_id": 2025, "position_code": "F", "game_id": "G1", "game_date": "2025-01-01", "shots": 3, "goals": 1, "onice_goals_for": 2, "onice_shots_for": 12, "points": 1, "ixg": 0.5, "icf": 4, "hdcf": 1},
        {"player_id": 2, "season_id": 2025, "position_code": "F", "game_id": "G1", "game_date": "2025-01-01", "shots": 4, "goals": 0, "onice_goals_for": 1, "onice_shots_for": 14, "points": 0, "ixg": 0.6, "icf": 5, "hdcf": 2},
        {"player_id": 1, "season_id": 2025, "position_code": "F", "game_id": "G2", "game_date": "2025-01-02", "shots": 2, "goals": 0, "onice_goals_for": 1, "onice_shots_for": 10, "points": 0, "ixg": 0.2, "icf": 2, "hdcf": 0},
    ]
    db = _FakeDB()
    cfg = _cfg()

    # Run 1: build + persist snapshot
    r1 = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=db,
        cfg=cfg,
        persist=True,
        build_snapshot=True,
        persist_snapshot=True,
        reuse_snapshot=True,  # allowed (snapshot present so build path used)
        assign_tiers=True,
    )
    d1 = r1.to_dict()
    assert db.snapshot is not None, "Snapshot not persisted in first run"
    assert "snapshot_persist" in d1["phases"], "First run missing snapshot_persist phase"
    assert r1.snapshot_thresholds is not None and len(r1.snapshot_thresholds) == 4, "Snapshot thresholds incomplete"

    # Run 2: reuse snapshot (skip build)
    r2 = orchestrate_full_run(
        season_id=2025,
        games=games,
        db_client=db,
        cfg=cfg,  # same config hash
        persist=True,
        build_snapshot=False,
        persist_snapshot=False,
        reuse_snapshot=True,
        assign_tiers=True,
    )
    d2 = r2.to_dict()
    assert "snapshot_reuse" in d2["phases"], "Second run missing snapshot_reuse phase"
    assert d2["phases"]["snapshot_reuse"]["status"] == "reused"

    # Determinism assertions
    assert r1.total_rows_scored == r2.total_rows_scored, "Row count changed between runs"
    assert r1.snapshot_thresholds == r2.snapshot_thresholds, "Snapshot thresholds diverged on reuse"
    a1 = d1["phases"].get("anomalies", {})
    a2 = d2["phases"].get("anomalies", {})
    assert a1.get("extreme_raw_z") == a2.get("extreme_raw_z"), "Extreme z anomaly count changed"
    assert a1.get("clip_saturation") == a2.get("clip_saturation"), "Clip saturation changed"

    # Persisted count should be non-negative and stable (best-effort upsert returns 0 when DB unavailable)
    assert r1.persisted_count == r2.persisted_count, "Persisted count differs (unexpected without DB variability)"
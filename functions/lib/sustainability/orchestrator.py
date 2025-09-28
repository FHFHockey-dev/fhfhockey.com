"""Pipeline Orchestrator (begins Task 5.1).

Provides a single entry point to execute the sustainability pipeline end‑to‑end
from a caller (CLI, scheduled job, or Next.js endpoint trigger).

Scope (initial implementation):
  * Load config (or accept injected cfg)
  * Execute full scoring pipeline (priors + windows + scoring + snapshot + tiers)
  * (Optional) persist barometer rows (controlled by `persist` flag)
  * Return structured run summary with timings & counts

Deferred (future subtasks 5.x):
  * New game detection (incremental processing)
  * Distribution snapshot persistence & reuse across runs
  * Retro recompute queue & worker
  * DB locking / concurrency guard
  * Run log persistence table (sustainability_run_logs)

Design: kept thin so individual phases remain testable in their own modules.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional

from .pipeline import run_full_scoring_pipeline
from .config_loader import load_config, SustainabilityConfig
from . import db_adapter
from .distribution import assign_quintiles


@dataclass
class OrchestratorResult:
    season_id: int
    model_version: int
    config_hash: str
    total_rows_scored: int
    persisted_count: int
    snapshot_n: int | None
    snapshot_thresholds: Dict[str, float] | None
    duration_ms: int
    phases: Dict[str, Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:  # Serialization helper
        return asdict(self)


def orchestrate_full_run(
    season_id: int,
    games: Iterable[Dict[str, Any]],
    db_client=None,
    persist: bool = False,
    build_snapshot: bool = True,
    assign_tiers: bool = True,
    cfg: SustainabilityConfig | None = None,
    incremental: bool = False,
    snapshot_window_type: str = "GAME",
    persist_snapshot: bool = False,
    use_lock: bool = False,
    log_run: bool = False,
    lock_timeout_seconds: int = 0,
    reuse_snapshot: bool = True,
) -> OrchestratorResult:
    t0 = time.time()
    started_iso = None
    finished_iso = None
    lock_acquired = False
    try_release_lock = False
    if use_lock and persist:
        getter = getattr(db_client, "acquire_run_lock", None) if db_client else db_adapter.acquire_run_lock
        if callable(getter):
            try:
                lock_acquired = getter(lock_timeout_seconds)
                try_release_lock = lock_acquired
            except Exception:  # pragma: no cover
                lock_acquired = True  # fail-open
        phases["lock"] = {"requested": True, "acquired": lock_acquired}

    started_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
    phases: Dict[str, Dict[str, Any]] = {}

    # Config phase (explicit to capture timing and because run_full_scoring_pipeline will load if None)
    t_cfg = time.time()
    if cfg is None:
        cfg = load_config(db_client=db_client)
    phases["config"] = {"duration_ms": int((time.time() - t_cfg) * 1000)}

    # Incremental filter: if enabled and DB accessible, drop games with game_date <= last processed
    game_list = list(games)
    if incremental and persist:
        getter = getattr(db_client, "fetch_max_barometer_game_date", None) if db_client else db_adapter.fetch_max_barometer_game_date
        try:
            last_date = getter(cfg.model_version, "GAME") if callable(getter) else None
        except Exception:
            last_date = None
        if last_date:
            game_list = [g for g in game_list if g.get("game_date") > last_date]
            phases["incremental_filter"] = {"last_processed": last_date, "games_after_filter": len(game_list)}

    t_pipeline = time.time()
    result = run_full_scoring_pipeline(
        season_id=season_id,
        games=game_list,
        db_client=db_client,
        cfg=cfg,
        persist=persist,
        build_snapshot=build_snapshot,
        assign_tiers=assign_tiers,
        snapshot_window_type=snapshot_window_type,
    )
    phases["scoring_pipeline"] = {
        "duration_ms": int((time.time() - t_pipeline) * 1000),
        "windows": len(result.get("windows", [])),
        "windows_scored": len(result.get("windows_scored", [])),
    }

    snapshot = result.get("snapshot")
    snapshot_n = snapshot.get("n") if snapshot else None
    snapshot_thresholds = None
    if snapshot:
        snapshot_thresholds = {k: snapshot[k] for k in ("t20", "t40", "t60", "t80") if k in snapshot}

    # Persist snapshot thresholds if requested and available
    if persist_snapshot and snapshot and persist:
        try:
            db_snapshot = {
                **snapshot,
            }
            saver = getattr(db_client, "upsert_distribution_snapshot", None) if db_client else db_adapter.upsert_distribution_snapshot
            if callable(saver):
                saver(db_snapshot)
                phases["snapshot_persist"] = {"status": "ok"}
        except Exception as e:  # pragma: no cover
            phases["snapshot_persist"] = {"status": "error", "error": str(e)}

    # Snapshot reuse path (5.4/5.5): if we did not build a snapshot but want tiers, try fetching existing
    if reuse_snapshot and assign_tiers and not snapshot and persist and build_snapshot is False:
        fetcher = getattr(db_client, "fetch_latest_distribution_snapshot", None) if db_client else db_adapter.fetch_latest_distribution_snapshot
        try:
            existing = fetcher(snapshot_window_type, cfg.model_version, cfg.config_hash) if callable(fetcher) else None
        except Exception:  # pragma: no cover
            existing = None
        if existing:
            phases["snapshot_reuse"] = {"status": "reused", "n": existing.get("n")}
            # reassign quintiles on GAME window rows only
            windows_scored = result.get("windows_scored", [])
            reassigned = assign_quintiles(windows_scored, type("Obj", (), existing)(), window_filter=snapshot_window_type)  # dynamic simple object
            # mutate in-place for return coherence
            result["windows_scored"] = reassigned
            snapshot_n = existing.get("n")
            snapshot_thresholds = {k: existing[k] for k in ("t20", "t40", "t60", "t80") if k in existing}
        else:
            phases["snapshot_reuse"] = {"status": "none_available"}

    total_ms = int((time.time() - t0) * 1000)
    finished_iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
    result_obj = OrchestratorResult(
        season_id=season_id,
        model_version=cfg.model_version,
        config_hash=cfg.config_hash,
        total_rows_scored=len(result.get("windows_scored", [])),
        persisted_count=result.get("persisted_count", 0),
        snapshot_n=snapshot_n,
        snapshot_thresholds=snapshot_thresholds,
        duration_ms=total_ms,
        phases=phases,
    )
    # Run log persistence
    if log_run and persist:
        entry = {
            "season_id": season_id,
            "model_version": cfg.model_version,
            "config_hash": cfg.config_hash,
            "started_at": started_iso,
            "finished_at": finished_iso,
            "duration_ms": total_ms,
            "total_rows_scored": result_obj.total_rows_scored,
            "persisted_count": result_obj.persisted_count,
            "snapshot_n": snapshot_n,
            "status": "ok",
            "meta_json": {"phases": phases},
        }
        saver = getattr(db_client, "insert_run_log", None) if db_client else db_adapter.insert_run_log
        if callable(saver):
            try:
                saver(entry)
                phases["run_log"] = {"status": "ok"}
            except Exception as e:  # pragma: no cover
                phases["run_log"] = {"status": "error", "error": str(e)}
    if try_release_lock:
        rel = getattr(db_client, "release_run_lock", None) if db_client else db_adapter.release_run_lock
        if callable(rel):
            try:
                rel()
            except Exception:  # pragma: no cover
                pass
    return result_obj


__all__ = ["orchestrate_full_run", "OrchestratorResult"]

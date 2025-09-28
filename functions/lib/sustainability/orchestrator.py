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
) -> OrchestratorResult:
    t0 = time.time()
    phases: Dict[str, Dict[str, Any]] = {}

    # Config phase (explicit to capture timing and because run_full_scoring_pipeline will load if None)
    t_cfg = time.time()
    if cfg is None:
        cfg = load_config(db_client=db_client)
    phases["config"] = {"duration_ms": int((time.time() - t_cfg) * 1000)}

    t_pipeline = time.time()
    result = run_full_scoring_pipeline(
        season_id=season_id,
        games=games,
        db_client=db_client,
        cfg=cfg,
        persist=persist,
        build_snapshot=build_snapshot,
        assign_tiers=assign_tiers,
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

    total_ms = int((time.time() - t0) * 1000)
    return OrchestratorResult(
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


__all__ = ["orchestrate_full_run", "OrchestratorResult"]

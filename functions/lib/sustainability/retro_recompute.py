"""Retro Recompute Worker (Task 5.7)

Purpose:
  Process entries from sustainability_recompute_queue in small batches.
  Each entry represents either a global config change (player_id NULL) or
  a targeted player/season backfill (player_id set).

Initial Simplified Implementation (stub):
  * fetch_pending(limit)
  * mark_running(id)
  * perform recompute (placeholder: currently a NO-OP returning success)
  * mark_done(id) or mark_error(id, msg)

Future Enhancements:
  * Actually refetch historical games for targeted player/seasons.
  * Re-run pipeline limited to that scope; persist updated barometer rows.
  * Support config_change entries by enqueuing per-player tasks (fan-out) or doing full recompute batch.
  * Backoff / retry with exponential delays.
  * Metrics emission & anomaly detection.

This stub enables integration wiring & unit test scaffolding.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import logging

from . import db_adapter

logger = logging.getLogger("sustainability.retro")


@dataclass
class QueueEntry:
    id: int
    player_id: Optional[int]
    season_id: Optional[int]
    reason: str


def fetch_pending(limit: int = 10, db_client=None) -> List[QueueEntry]:
    sql = """
        SELECT id, player_id, season_id, reason
        FROM sustainability_recompute_queue
        WHERE status='pending'
        ORDER BY id ASC
        LIMIT %(limit)s
    """
    getter = getattr(db_client, "get_conn", None)
    if getter is None:
        from .db_adapter import get_conn  # type: ignore
    else:
        # assume db_client implements context manager returning connection
        def get_conn():
            return db_client.get_conn()
    out: List[QueueEntry] = []
    with db_adapter.get_conn() as conn:  # reuse adapter context
        if conn is None:
            return out
        try:
            cur = conn.execute(sql, {"limit": limit})
            for row in cur.fetchall():
                out.append(QueueEntry(id=row[0], player_id=row[1], season_id=row[2], reason=row[3]))
        except Exception as e:  # pragma: no cover
            logger.error("fetch_pending failed: %s", e)
    return out


def _update_status(entry_id: int, status: str, db_client=None, error_message: str | None = None):
    sql = """
        UPDATE sustainability_recompute_queue
        SET status=%(status)s,
            started_at = COALESCE(started_at, NOW()),
            finished_at = CASE WHEN %(status)s IN ('done','error') THEN NOW() ELSE finished_at END,
            error_message = COALESCE(%(error_message)s, error_message)
        WHERE id=%(id)s
    """
    with db_adapter.get_conn() as conn:
        if conn is None:
            return
        try:
            conn.execute(sql, {"status": status, "id": entry_id, "error_message": error_message})
        except Exception as e:  # pragma: no cover
            logger.error("_update_status failed: %s", e)


def process_entry(entry: QueueEntry, db_client=None):
    _update_status(entry.id, "running", db_client=db_client)
    try:
        # Placeholder: in future run targeted recompute logic.
        logger.info("Processing retro entry id=%s reason=%s player_id=%s", entry.id, entry.reason, entry.player_id)
        # Simulate success
        _update_status(entry.id, "done", db_client=db_client)
    except Exception as e:  # pragma: no cover
        _update_status(entry.id, "error", db_client=db_client, error_message=str(e))


def run_worker_once(batch_limit: int = 10, db_client=None) -> int:
    entries = fetch_pending(limit=batch_limit, db_client=db_client)
    for e in entries:
        process_entry(e, db_client=db_client)
    return len(entries)

__all__ = [
    "QueueEntry",
    "fetch_pending",
    "process_entry",
    "run_worker_once",
]

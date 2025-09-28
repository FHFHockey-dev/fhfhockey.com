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
from typing import List, Dict, Any, Optional, Callable
import logging

from . import db_adapter
from .pipeline import run_full_scoring_pipeline
from .config_loader import load_config

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


def process_entry(
    entry: QueueEntry,
    db_client=None,
    game_fetcher: Optional[Callable[[int, int], List[Dict[str, Any]]]] = None,
    season_fallback: int | None = None,
):
    """Process a single queue entry.

    For player-specific entries: fetch that player's historical games, run scoring pipeline limited to those games.
    For config_change global entries (player_id None): currently mark done (future expansion: fan-out).
    """
    _update_status(entry.id, "running", db_client=db_client)
    try:
        logger.info("Processing retro entry id=%s reason=%s player_id=%s", entry.id, entry.reason, entry.player_id)
        if entry.player_id is None:
            # Global config change - future expansion could fan out
            _update_status(entry.id, "done", db_client=db_client)
            return
        # Player-specific recompute
        season_id = entry.season_id or season_fallback
        if season_id is None:
            _update_status(entry.id, "error", db_client=db_client, error_message="missing_season_id")
            return
        # Acquire games
        if game_fetcher is None:
            games = fetch_player_games(db_client=db_client, player_id=entry.player_id, season_id=season_id)
        else:
            games = game_fetcher(entry.player_id, season_id)
        if not games:
            _update_status(entry.id, "done", db_client=db_client, )
            return
        cfg = load_config(db_client=db_client)
        # Run scoring pipeline ONLY for this player's games. Snapshot & tiers skipped; global snapshot unaffected.
        run_full_scoring_pipeline(
            season_id=season_id,
            games=games,
            db_client=db_client,
            cfg=cfg,
            persist=True,
            include_components=False,
            build_snapshot=False,
            assign_tiers=False,
        )
        _update_status(entry.id, "done", db_client=db_client)
    except Exception as e:  # pragma: no cover
        _update_status(entry.id, "error", db_client=db_client, error_message=str(e))


def run_worker_once(
    batch_limit: int = 10,
    db_client=None,
    game_fetcher: Optional[Callable[[int, int], List[Dict[str, Any]]]] = None,
    queue_provider: Optional[Callable[[int], List[QueueEntry]]] = None,
) -> int:
    """Run one worker tick.

    queue_provider: optional injection for tests returning list[QueueEntry].
    game_fetcher: optional injection to supply games per player.
    """
    if queue_provider is not None:
        entries = queue_provider(batch_limit)
    else:
        entries = fetch_pending(limit=batch_limit, db_client=db_client)
    for e in entries:
        process_entry(e, db_client=db_client, game_fetcher=game_fetcher)
    return len(entries)


def fetch_player_games(db_client, player_id: int, season_id: int) -> List[Dict[str, Any]]:
    """Attempt to fetch historical games for a player.

    This is a placeholder; adjust the FROM clause to match your canonical game stats table.
    Fails open (returns empty) if table/query not available.
    Required columns for pipeline: player_id, season_id, position_code, game_id, game_date,
      shots, goals, onice_goals_for, onice_shots_for, points, ixg, icf, hdcf.
    """
    sql = """
        SELECT player_id, season_id, position_code, game_id, game_date::text, shots, goals,
               onice_goals_for, onice_shots_for, points, ixg, icf, hdcf
        FROM player_game_stats
        WHERE season_id=%(season_id)s AND player_id=%(player_id)s
        ORDER BY game_date ASC
    """
    with db_adapter.get_conn() as conn:
        if conn is None:
            return []
        try:
            cur = conn.execute(sql, {"season_id": season_id, "player_id": player_id})
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
        except Exception:  # pragma: no cover
            return []

__all__ = [
    "QueueEntry",
    "fetch_pending",
    "process_entry",
    "run_worker_once",
    "fetch_player_games",
]

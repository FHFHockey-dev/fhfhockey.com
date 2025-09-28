"""Lightweight DB adapter for Supabase Postgres access.

Uses psycopg (psycopg 3) with a DSN provided via SUPABASE_DB_URL env var.
Provides helper methods used by sustainability modules:
  * fetch_active_config_row
  * fetch_league_aggregates
  * upsert_league_priors (batch upsert)

All methods are safe no-ops if connection can't be established (return empty / 0)
so the pipeline can still run in dry/test mode.
"""
from __future__ import annotations

import os
import json
import logging
from contextlib import contextmanager
from typing import Any, Dict, Iterable, List, Optional

try:
    from lib.env_loader import ensure_loaded_for  # absolute import relative to functions package
except Exception:  # pragma: no cover
    ensure_loaded_for = lambda *a, **k: None  # type: ignore

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore

logger = logging.getLogger("sustainability.db")

DSN_ENV = "SUPABASE_DB_URL"


@contextmanager
def get_conn():
    dsn = os.getenv(DSN_ENV)
    if not dsn:
        # Attempt to load from web/.env.local
        ensure_loaded_for([DSN_ENV])
        dsn = os.getenv(DSN_ENV)
    if not dsn or psycopg is None:
        yield None
        return
    try:
        with psycopg.connect(dsn) as conn:  # type: ignore[attr-defined]
            yield conn
    except Exception as e:  # pragma: no cover
        logger.error("DB connection failed: %s", e)
        yield None


def fetch_active_config_row() -> Optional[Dict[str, Any]]:
    sql = """
        SELECT model_version, weights_json, toggles_json, constants_json, sd_mode, freshness_days
        FROM model_sustainability_config
        WHERE active = TRUE
        ORDER BY model_version DESC
        LIMIT 1
    """
    with get_conn() as conn:
        if conn is None:
            return None
        cur = conn.execute(sql)
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))


def fetch_league_aggregates(season_id: int) -> Iterable[Dict[str, Any]]:
    sql = """
        -- Replace this stub aggregation with real fact table logic.
        SELECT
          %(season_id)s AS season_id,
          position_code,
          SUM(player_goals) AS sh_pct_successes,
          SUM(player_shots) AS sh_pct_trials,
          SUM(onice_goals_for) AS oish_pct_successes,
            SUM(onice_shots_for) AS oish_pct_trials,
          SUM(player_points) AS ipp_successes,
          SUM(onice_goals_for) AS ipp_trials
        FROM hockey_player_season_aggregates
        WHERE season_id = %(season_id)s
        GROUP BY position_code
    """
    with get_conn() as conn:
        if conn is None:
            return []
        try:
            cur = conn.execute(sql, {"season_id": season_id})
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]
        except Exception as e:  # pragma: no cover
            logger.error("fetch_league_aggregates failed: %s", e)
            return []


def upsert_league_priors(priors: List[Dict[str, Any]]) -> int:
    if not priors:
        return 0
    sql = """
        INSERT INTO priors_cache(season_id, position_code, stat_code, alpha0, beta0, k, league_mu)
        VALUES (%(season_id)s, %(position_code)s, %(stat_code)s, %(alpha0)s, %(beta0)s, %(k)s, %(league_mu)s)
        ON CONFLICT (season_id, position_code, stat_code)
        DO UPDATE SET alpha0=EXCLUDED.alpha0, beta0=EXCLUDED.beta0, k=EXCLUDED.k, league_mu=EXCLUDED.league_mu, updated_at=NOW();
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                for p in priors:
                    conn.execute(sql, p)
            return len(priors)
        except Exception as e:  # pragma: no cover
            logger.error("upsert_league_priors failed: %s", e)
            return 0


def upsert_player_priors(rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    sql = """
        INSERT INTO player_priors_cache(
            player_id, season_id, position_code, stat_code,
            successes_blend, trials_blend, post_mean, rookie_status, model_version
        ) VALUES (
            %(player_id)s, %(season_id)s, %(position_code)s, %(stat_code)s,
            %(successes_blend)s, %(trials_blend)s, %(post_mean)s, %(rookie_status)s, %(model_version)s
        )
        ON CONFLICT (player_id, season_id, stat_code)
        DO UPDATE SET successes_blend=EXCLUDED.successes_blend,
                      trials_blend=EXCLUDED.trials_blend,
                      post_mean=EXCLUDED.post_mean,
                      rookie_status=EXCLUDED.rookie_status,
                      model_version=EXCLUDED.model_version,
                      updated_at=NOW();
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                for r in rows:
                    conn.execute(sql, r)
            return len(rows)
        except Exception as e:  # pragma: no cover
            logger.error("upsert_player_priors failed: %s", e)
            return 0


def upsert_barometers(rows: List[Dict[str, Any]]) -> int:
    """Upsert final scoring rows into model_player_game_barometers.

    Expected keys (subset used): player_id, season_id, position_code, window_type, game_date,
      score_raw, score, contrib_total, model_version, config_hash, components_json (optional), rookie_status
    """
    if not rows:
        return 0
    sql = """
        INSERT INTO model_player_game_barometers(
          player_id, season_id, position_code, window_type, game_date,
          score_raw, score, contrib_total, model_version, config_hash, rookie_status, components_json
        ) VALUES (
          %(player_id)s, %(season_id)s, %(position_code)s, %(window_type)s, %(game_date)s,
          %(score_raw)s, %(score)s, %(contrib_total)s, %(model_version)s, %(config_hash)s, %(rookie_status)s, %(components_json)s::jsonb
        )
        ON CONFLICT (player_id, window_type, game_date, model_version)
        DO UPDATE SET score_raw=EXCLUDED.score_raw,
                      score=EXCLUDED.score,
                      contrib_total=EXCLUDED.contrib_total,
                      config_hash=EXCLUDED.config_hash,
                      components_json=COALESCE(EXCLUDED.components_json, model_player_game_barometers.components_json),
                      updated_at=NOW();
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                payloads = []
                for r in rows:
                    if isinstance(r.get("components_json"), (dict, list)):
                        r = {**r, "components_json": json.dumps(r["components_json"]) }
                    payloads.append(r)
                for p in payloads:
                    conn.execute(sql, p)
            return len(rows)
        except Exception as e:  # pragma: no cover
            logger.error("upsert_barometers failed: %s", e)
            return 0


def fetch_max_barometer_game_date(model_version: int, window_type: str = "GAME") -> Optional[str]:
    """Return latest game_date processed for given model_version & window_type.

    Used for incremental detection. Returns ISO date string or None if no rows / unavailable.
    """
    sql = """
        SELECT MAX(game_date)::text
        FROM model_player_game_barometers
        WHERE model_version = %(model_version)s AND window_type = %(window_type)s
    """
    with get_conn() as conn:
        if conn is None:
            return None
        try:
            cur = conn.execute(sql, {"model_version": model_version, "window_type": window_type})
            row = cur.fetchone()
            if row and row[0]:
                return row[0]
            return None
        except Exception as e:  # pragma: no cover
            logger.error("fetch_max_barometer_game_date failed: %s", e)
            return None


def upsert_distribution_snapshot(snapshot: Dict[str, Any]) -> int:
    """Persist distribution snapshot thresholds.

    Expects keys: window_type, model_version, config_hash, n, t20, t40, t60, t80, created_at
    Upsert on (window_type, model_version, config_hash).
    """
    sql = """
        INSERT INTO sustainability_distribution_snapshots(
          window_type, model_version, config_hash, n, t20, t40, t60, t80, created_at
        ) VALUES (
          %(window_type)s, %(model_version)s, %(config_hash)s, %(n)s, %(t20)s, %(t40)s, %(t60)s, %(t80)s, %(created_at)s
        )
        ON CONFLICT (window_type, model_version, config_hash)
        DO UPDATE SET n=EXCLUDED.n, t20=EXCLUDED.t20, t40=EXCLUDED.t40, t60=EXCLUDED.t60, t80=EXCLUDED.t80, updated_at=NOW();
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                conn.execute(sql, snapshot)
            return 1
        except Exception as e:  # pragma: no cover
            logger.error("upsert_distribution_snapshot failed: %s", e)
            return 0


def fetch_latest_distribution_snapshot(window_type: str, model_version: int, config_hash: str) -> Optional[Dict[str, Any]]:
    sql = """
        SELECT window_type, model_version, config_hash, n, t20, t40, t60, t80, created_at
        FROM sustainability_distribution_snapshots
        WHERE window_type=%(window_type)s AND model_version=%(model_version)s AND config_hash=%(config_hash)s
        ORDER BY created_at DESC
        LIMIT 1
    """
    with get_conn() as conn:
        if conn is None:
            return None
        try:
            cur = conn.execute(sql, {"window_type": window_type, "model_version": model_version, "config_hash": config_hash})
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        except Exception as e:  # pragma: no cover
            logger.error("fetch_latest_distribution_snapshot failed: %s", e)
            return None


# --- Locking & Run Log (Task 5.1 extension) -----------------------------------------------------

LOCK_KEY = 834271  # arbitrary unique int for sustainability orchestrator advisory lock


def acquire_run_lock(timeout_seconds: int = 0) -> bool:
    """Attempt to acquire an advisory lock.

    Returns True if lock acquired or DB unavailable (fail-open so pipeline can still run dry).
    When timeout_seconds > 0 will poll until acquired or timeout.
    """
    sql_try = "SELECT pg_try_advisory_lock(%(k)s)"
    sql_lock = "SELECT pg_advisory_lock(%(k)s)"  # blocking
    with get_conn() as conn:
        if conn is None:
            return True
        try:
            if timeout_seconds <= 0:
                cur = conn.execute(sql_try, {"k": LOCK_KEY})
                row = cur.fetchone()
                return bool(row and row[0])
            else:  # blocking attempt with timeout by using timeout on connection
                # Psycopg3 supports statement timeout via SET
                conn.execute("SET LOCAL statement_timeout = %s", (timeout_seconds * 1000,))
                conn.execute(sql_lock, {"k": LOCK_KEY})
                return True
        except Exception as e:  # pragma: no cover
            logger.error("acquire_run_lock failed: %s", e)
            return True  # fail-open


def release_run_lock():
    sql = "SELECT pg_advisory_unlock(%(k)s)"
    with get_conn() as conn:
        if conn is None:
            return
        try:
            conn.execute(sql, {"k": LOCK_KEY})
        except Exception as e:  # pragma: no cover
            logger.error("release_run_lock failed: %s", e)


def insert_run_log(entry: Dict[str, Any]) -> int:
    """Persist a run log entry.

    Expected keys: season_id, model_version, config_hash, started_at, finished_at, duration_ms,
                   total_rows_scored, persisted_count, snapshot_n, status, meta_json
    meta_json may be a dict and will be serialized.
    """
    if not entry:
        return 0
    if isinstance(entry.get("meta_json"), (dict, list)):
        entry = {**entry, "meta_json": json.dumps(entry["meta_json"]) }
    sql = """
        INSERT INTO sustainability_run_logs(
          season_id, model_version, config_hash, started_at, finished_at, duration_ms,
          total_rows_scored, persisted_count, snapshot_n, status, meta_json
        ) VALUES (
          %(season_id)s, %(model_version)s, %(config_hash)s, %(started_at)s, %(finished_at)s, %(duration_ms)s,
          %(total_rows_scored)s, %(persisted_count)s, %(snapshot_n)s, %(status)s, %(meta_json)s::jsonb
        )
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                conn.execute(sql, entry)
            return 1
        except Exception as e:  # pragma: no cover
            logger.error("insert_run_log failed: %s", e)
            return 0

__all__ = [
    "fetch_active_config_row",
    "fetch_league_aggregates",
    "upsert_league_priors",
    "upsert_player_priors",
    "upsert_barometers",
    "fetch_max_barometer_game_date",
    "upsert_distribution_snapshot",
    "fetch_latest_distribution_snapshot",
    "acquire_run_lock",
    "release_run_lock",
    "insert_run_log",
    "enqueue_retro_task",
]


def enqueue_retro_task(reason: str, player_id: int | None = None, season_id: int | None = None) -> int:
    """Insert a retro recompute queue entry.

    reason: 'config_change' | 'data_backfill'
    Returns 1 if inserted else 0. Fails open if DB unavailable.
    """
    sql = """
        INSERT INTO sustainability_recompute_queue(player_id, season_id, reason)
        VALUES (%(player_id)s, %(season_id)s, %(reason)s)
    """
    with get_conn() as conn:
        if conn is None:
            return 0
        try:
            with conn.transaction():  # type: ignore[attr-defined]
                conn.execute(sql, {"player_id": player_id, "season_id": season_id, "reason": reason})
            return 1
        except Exception as e:  # pragma: no cover
            logger.error("enqueue_retro_task failed: %s", e)
            return 0

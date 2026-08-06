"""Shared Postgres connection helper for Python endpoints.

This module is intentionally domain-neutral. Sustainability production reads and
writes are owned by the TypeScript/Supabase pipeline; Python callers may use this
helper only when they have their own current schema contract.
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager

from lib.env_loader import ensure_loaded_for

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore


logger = logging.getLogger("postgres")
DSN_ENV = "SUPABASE_DB_URL"


@contextmanager
def get_conn():
    """Yield a psycopg connection, or ``None`` when configuration is unavailable."""

    ensure_loaded_for([DSN_ENV])
    dsn = os.getenv(DSN_ENV)
    if not dsn or psycopg is None:
        yield None
        return

    try:
        with psycopg.connect(dsn) as conn:  # type: ignore[attr-defined]
            yield conn
    except Exception as error:  # pragma: no cover
        logger.error("DB connection failed: %s", error)
        yield None


__all__ = ["get_conn"]

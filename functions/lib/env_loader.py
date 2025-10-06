"""Local environment variable loader.

Purpose:
  Allow Python functions code to pick up values from the frontend `web/.env.local`
  during local development without exporting them manually.

Security Notes:
  * This should only be used for local/dev workflows. In deployed environments,
    rely on real environment variables injected by the platform (e.g., Vercel).
  * We DO NOT hardcode secrets here; we only read from the file if it exists.
  * If a variable is already present in os.environ we do not override it.

Parsing Rules:
  * Lines beginning with `#` ignored.
  * Accept KEY=VALUE or KEY="VALUE" style. Surrounding quotes are stripped.
  * Escaped literal `\n` sequences inside quoted values are converted to actual newlines
    for keys that look like private keys (contain `_PRIVATE_KEY` or end with `_KEY`).

Usage:
  from lib.env_loader import load_web_env_local
  load_web_env_local()  # safe no-op if file missing

You can force reload (ignoring already-set keys) with force=True (not recommended by default).
"""
from __future__ import annotations

import os
from pathlib import Path
import re
from typing import Dict

_ENV_FILENAME = ".env.local"
_ROOT = Path(__file__).resolve().parents[2]  # functions/ -> repo root
_WEB_ENV_PATH = _ROOT / "web" / _ENV_FILENAME

_LINE_RE = re.compile(r"^([A-Z0-9_]+)=(.*)$")


def _parse_value(raw: str, key: str) -> str:
    raw = raw.strip()
    if raw.startswith(("'", '"')) and raw.endswith(("'", '"')) and len(raw) >= 2:
        raw = raw[1:-1]
    # Convert escaped \n to actual newline for keys that likely store PEM/private keys
    if "PRIVATE_KEY" in key or key.endswith("_KEY"):
        raw = raw.replace("\\n", "\n")
    return raw


def load_web_env_local(force: bool = False) -> Dict[str, str]:
    """Load variables from web/.env.local if present.

    Returns dict of variables inserted. Existing os.environ keys are preserved unless force=True.
    """
    inserted: Dict[str, str] = {}
    if not _WEB_ENV_PATH.exists():
        return inserted
    try:
        for line in _WEB_ENV_PATH.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            m = _LINE_RE.match(line)
            if not m:
                continue
            key, val_raw = m.group(1), m.group(2)
            if not force and key in os.environ:
                continue
            val = _parse_value(val_raw, key)
            os.environ[key] = val
            inserted[key] = val
    except Exception:  # pragma: no cover
        pass
    return inserted


def ensure_loaded_for(keys, force: bool = False):
    """Load .env.local only if any of the specified keys are missing."""
    missing = [k for k in keys if k not in os.environ]
    if missing:
        load_web_env_local(force=force)


__all__ = ["load_web_env_local", "ensure_loaded_for"]

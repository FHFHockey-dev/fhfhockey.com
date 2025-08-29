#!/usr/bin/env python3
"""Yahoo NHL ownership HISTORY ingester (rate-limit aware, batched).

What this does
--------------
- For each day in the target season, queries Yahoo:
    /league/{league_key}/players;player_keys=.../percent_owned;type=date;date=YYYY-MM-DD
  (i.e., asks explicitly for the ownership snapshot ON THAT DATE)
- Writes ONE ROW PER PLAYER PER DAY into yahoo_player_ownership_daily.
- Uses batching (up to 25 keys) and robust rate-limit handling.
- Re-sweeps dates to close gaps until complete (or exhausted).
- Returns explicit status per date: "complete" | "incomplete" | "stagnant".

Env knobs (defaults shown)
--------------------------
  YFPY_MAX_KEYS_PER_REQUEST=25        # clamp to [1, 25]
  YHO_MIN_INTERVAL_SECONDS=1.0        # min seconds between any two Yahoo API calls
  YHO_MAX_CALLS_PER_MINUTE=60         # 0 disables the per-minute gate
  YHO_RATE_LIMIT_PAUSE_SECONDS=1500   # fallback long sleep (~25m) if no Retry-After
  YHO_SLEEP_SECONDS=0.5               # gentle pause between sub-batches
  YHO_SAMPLE_PLAYER_LIMIT=0           # 0 = no limit
  YHO_SAMPLE_DATES_LIMIT=0            # 0 = no limit
  YHO_RESUME=1                        # 1=resume from last date in table (overwrite that day), else start season start
  YHO_DUMP_SAMPLE=0                   # 1=run sample probe instead of full main
  YHO_SOCKET_TIMEOUT=45               # global default socket timeout (seconds)
  YHO_STAGNANT_LIMIT=5                # stop date loop if no progress N consecutive cycles
  YHO_LOG_MISSING_KEYS=1
  YHO_MISSING_KEYS_LIMIT=10

In-file knobs (no env required)
-------------------------------
  DEFAULT_MAX_SWEEPS_PER_DATE=20      # resweeps per date before logging incomplete
  FINAL_STRAGGLER_PASSES=1            # extra full passes over incomplete dates at end

Run
---
python web/lib/supabase/Upserts/Yahoo/yahooHistoricalOwnership.py
"""
import os
import socket
import logging
import time
import random
from collections import deque
from datetime import datetime, timedelta, timezone, date
from email.utils import parsedate_to_datetime
from pathlib import Path
from dotenv import load_dotenv
import json
from typing import Optional, Tuple, List, Dict, Any

from supabase import create_client, Client
from yfpy.query import YahooFantasySportsQuery

# NEW: progress bars
try:
    from tqdm.auto import tqdm
except Exception:
    tqdm = None  # fallback

# ---------- Logging ----------
# Default to WARNING to keep terminal clean; override via YHO_LOG_LEVEL=INFO if you want verbosity.
_LOG_LEVEL = os.getenv("YHO_LOG_LEVEL", "WARNING").upper()
logging.basicConfig(level=getattr(logging, _LOG_LEVEL, logging.WARNING),
                    format="%(asctime)s - %(levelname)s - %(message)s")

# ---------- Global socket timeout to prevent hangs ----------
try:
    _SOCK_TIMEOUT = float(os.getenv('YHO_SOCKET_TIMEOUT', '45'))
except Exception:
    _SOCK_TIMEOUT = 45.0
socket.setdefaulttimeout(_SOCK_TIMEOUT)
logging.info('Global socket timeout set to %ss', _SOCK_TIMEOUT)

# ---------- In-file behavior knobs (no env required) ----------
DEFAULT_MAX_SWEEPS_PER_DATE = 20         # resweeps per date before logging incomplete
FINAL_STRAGGLER_PASSES = 1               # extra full passes over incomplete dates at end

# ---------- Telemetry ----------
def _get_progress_log_path():
    try:
        repo_root = Path(__file__).resolve().parents[6]
        return repo_root / 'yahoo_historical_progress.log'
    except Exception:
        return Path.cwd() / 'yahoo_historical_progress.log'

def telemetry_write(obj: dict):
    try:
        p = _get_progress_log_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        obj.setdefault('ts', datetime.now(timezone.utc).isoformat())
        with open(p, 'a', encoding='utf-8') as f:
            f.write(json.dumps(obj, separators=(',', ':'), default=str) + "\n")
    except Exception:
        pass

# ---------- Config / ENV ----------
def load_env_candidates():
    try:
        repo_root = Path(__file__).resolve().parents[6]
    except Exception:
        repo_root = Path.cwd()
    candidates = [
        repo_root / 'web' / ".env.local",
        Path.cwd() / 'web' / ".env.local",
        repo_root / ".env.local",
        Path.cwd() / ".env.local",
        Path(__file__).resolve().parents[4] / ".env.local" if len(Path(__file__).resolve().parents) >= 5 else Path.cwd() / ".env.local",
    ]
    for p in candidates:
        try:
            if p.exists():
                load_dotenv(p)
                logging.info(f"Loaded env from {p}")
                return p
        except Exception:
            continue
    logging.info("No .env.local found in candidates; relying on environment variables.")
    return None

# Manual overrides mapping season_start_year -> { game_id_prefix, league_id }
GAME_LEAGUE_OVERRIDES = {
    2024: {"game_id_prefix": "453", "league_id": "105954"},
    2025: {"game_id_prefix": "465", "league_id": "858"},
}

# Debug printing for troubleshooting returned ownership objects when percent is missing.
DEBUG_PRINT_OBJECTS = os.getenv('YHO_DEBUG_PRINT_OBJECTS', '0') == '1'
try:
    DEBUG_PRINT_LIMIT = int(os.getenv('YHO_DEBUG_PRINT_LIMIT', '10'))
except Exception:
    DEBUG_PRINT_LIMIT = 10
_debug_print_count = 0

# Missing-keys logging
LOG_MISSING_KEYS = os.getenv('YHO_LOG_MISSING_KEYS', '1') == '1'
try:
    MISSING_KEYS_LOG_LIMIT = int(os.getenv('YHO_MISSING_KEYS_LIMIT', '10'))
except Exception:
    MISSING_KEYS_LOG_LIMIT = 10

# ---------- Clients ----------
def init_clients() -> Tuple[Client, YahooFantasySportsQuery]:
    load_env_candidates()

    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not all([SUPABASE_URL, SUPABASE_KEY]):
        logging.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
        raise SystemExit(1)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    YFPY_CONSUMER_KEY = os.getenv("YFPY_CONSUMER_KEY")
    YFPY_CONSUMER_SECRET = os.getenv("YFPY_CONSUMER_SECRET")
    YFPY_ACCESS_TOKEN = os.getenv("YFPY_ACCESS_TOKEN")
    YFPY_REFRESH_TOKEN = os.getenv("YFPY_REFRESH_TOKEN")

    if not (YFPY_CONSUMER_KEY and YFPY_CONSUMER_SECRET):
        try:
            creds = supabase.table('yahoo_api_credentials').select(
                'consumer_key,consumer_secret,access_token,refresh_token'
            ).limit(1).single().execute()
            if hasattr(creds, 'data') and creds.data:
                row = creds.data
                YFPY_CONSUMER_KEY = YFPY_CONSUMER_KEY or row.get('consumer_key')
                YFPY_CONSUMER_SECRET = YFPY_CONSUMER_SECRET or row.get('consumer_secret')
                YFPY_ACCESS_TOKEN = YFPY_ACCESS_TOKEN or row.get('access_token')
                YFPY_REFRESH_TOKEN = YFPY_REFRESH_TOKEN or row.get('refresh_token')
                logging.info('Loaded Yahoo API credentials from Supabase')
        except Exception as e:
            logging.warning('Could not load yahoo_api_credentials from Supabase: %s', e)

    if not (YFPY_CONSUMER_KEY and YFPY_CONSUMER_SECRET):
        logging.error('Missing Yahoo consumer key/secret (env or Supabase).')
        raise SystemExit(1)

    GAME_ID = os.getenv("YFPY_GAME_ID", "465")
    LEAGUE_ID = os.getenv("YFPY_LEAGUE_ID", "858")

    yahoo_query = YahooFantasySportsQuery(
        league_id=LEAGUE_ID,
        game_code="nhl",
        game_id=GAME_ID,
        yahoo_consumer_key=YFPY_CONSUMER_KEY,
        yahoo_consumer_secret=YFPY_CONSUMER_SECRET,
        save_token_data_to_env_file=False,
        env_file_location=Path.cwd(),
    )

    try:
        if YFPY_ACCESS_TOKEN:
            yahoo_query._yahoo_access_token_dict = yahoo_query._get_dict_from_access_token_json(
                {'access_token': YFPY_ACCESS_TOKEN, 'refresh_token': YFPY_REFRESH_TOKEN}
            )
    except Exception:
        pass

    try:
        yahoo_query.save_access_token_data_to_env_file(env_file_location=Path.cwd(), env_file_name='.env.local')
    except Exception:
        pass

    return supabase, yahoo_query

def _refresh_token_if_possible(yahoo_query: YahooFantasySportsQuery) -> bool:
    """Try to refresh Yahoo access token using whatever yfpy exposes."""
    for attr in ('refresh_access_token', '_refresh_access_token', '_refresh_yahoo_access_token'):
        fn = getattr(yahoo_query, attr, None)
        if callable(fn):
            try:
                fn()
                logging.info('Yahoo access token refreshed via %s()', attr)
                return True
            except Exception as e:
                logging.warning('Token refresh via %s() failed: %s', attr, e)

    # Fallback: reinit the query object from env/Supabase creds
    try:
        _, new_yq = init_clients()
        yahoo_query._yahoo_access_token_dict = getattr(new_yq, '_yahoo_access_token_dict', None)
        yahoo_query.oauth = getattr(new_yq, 'oauth', getattr(new_yq, '_oauth', None))
        logging.info('Reinitialized Yahoo client to refresh token')
        return True
    except Exception as e:
        logging.error('Failed to reinitialize Yahoo client: %s', e)
        return False

# ---------- Rate/Pacing Controls ----------
try:
    _MIN_INTERVAL = max(0.0, float(os.getenv('YHO_MIN_INTERVAL_SECONDS', '1.0')))
except Exception:
    _MIN_INTERVAL = 1.0
try:
    _MAX_PER_MINUTE = int(os.getenv('YHO_MAX_CALLS_PER_MINUTE', '60'))  # 0 disables
except Exception:
    _MAX_PER_MINUTE = 60

_last_request_ts = 0.0
_minute_window = deque()  # monotonic timestamps of recent calls

def time_sleep(seconds: float):
    try:
        time.sleep(seconds)
    except Exception:
        pass

def _respect_request_pacing():
    """Block until we're allowed to make the next Yahoo API call."""
    global _last_request_ts, _minute_window

    # Enforce min interval between calls
    now = time.monotonic()
    elapsed = now - _last_request_ts
    if elapsed < _MIN_INTERVAL:
        time_sleep((_MIN_INTERVAL - elapsed) + random.uniform(0, 0.05))
        now = time.monotonic()

    # Enforce per-minute cap (if enabled)
    if _MAX_PER_MINUTE > 0:
        cutoff = now - 60.0
        while _minute_window and _minute_window[0] < cutoff:
            _minute_window.popleft()
        if len(_minute_window) >= _MAX_PER_MINUTE:
            sleep_for = (_minute_window[0] + 60.0) - now
            if sleep_for > 0:
                time_sleep(sleep_for + random.uniform(0, 0.05))
            now = time.monotonic()
            cutoff = now - 60.0
            while _minute_window and _minute_window[0] < cutoff:
                _minute_window.popleft()

    _last_request_ts = time.monotonic()
    _minute_window.append(_last_request_ts)

def _extract_retry_after_seconds(e) -> Optional[int]:
    try:
        resp = getattr(e, 'response', None)
        if resp is not None and hasattr(resp, 'headers'):
            ra = resp.headers.get('Retry-After') or resp.headers.get('retry-after')
            if ra:
                try:
                    return int(ra)
                except Exception:
                    try:
                        dt = parsedate_to_datetime(ra)
                        return max(0, int((dt - datetime.now(timezone.utc)).total_seconds()))
                    except Exception:
                        return None
    except Exception:
        return None
    return None

def _should_retry(msg: str) -> bool:
    low = msg.lower()
    return (
        ('rate limit' in low) or ('429' in low) or ('temporarily' in low) or
        ('try again later' in low) or ('timed out' in low) or ('connection' in low) or
        ('token_expired' in low) or ('oauth_problem' in low) or ('invalid_token' in low) or ('401' in low)
    )

def _long_pause_after_rate_limit():
    try:
        pause_seconds = int(os.getenv('YHO_RATE_LIMIT_PAUSE_SECONDS', '1500'))
    except Exception:
        pause_seconds = 1500
    pause_seconds = int(pause_seconds + random.uniform(0, 30))
    logging.info('Rate-limit fallback pause: sleeping %ds', pause_seconds)
    time_sleep(pause_seconds)

def _perform_yahoo_query(yahoo_query: YahooFantasySportsQuery, url: str, path, return_class=None, max_tries: int = 4):
    base = 1.0
    max_tries = max(1, max_tries)
    attempt = 1

    while attempt <= max_tries:
        try:
            _respect_request_pacing()
            if return_class is None:
                return yahoo_query.query(url, path)
            else:
                return yahoo_query.query(url, path, return_class)
        except Exception as e:
            msg = str(e); low = msg.lower()

            # Token problems: try refresh, then count an attempt (prevents infinite loops)
            if any(s in low for s in ('token_expired', 'oauth_problem', 'invalid_token', '401')):
                ok = _refresh_token_if_possible(yahoo_query)
                logging.info('Refreshed Yahoo OAuth token.' if ok else 'Yahoo OAuth refresh failed.')
                time_sleep(2.0)
                attempt += 1
                continue

            retryable = _should_retry(low)
            logging.warning('Yahoo query failed (attempt %d/%d): %s', attempt, max_tries, e)

            if not retryable or attempt == max_tries:
                raise

            # Honor Retry-After header (don’t advance attempt here)
            if ('rate limit' in low or '429' in low or 'try again later' in low):
                ra = _extract_retry_after_seconds(e)
                if ra and ra > 0:
                    ra = int(ra + random.uniform(0, 5))
                    logging.info('Honoring Retry-After=%ds', ra)
                    time_sleep(ra)
                    continue
                # No Retry-After? courtesy pause once, then continue backoff
                _long_pause_after_rate_limit()
                attempt += 1
                continue

            # Generic exponential backoff with jitter
            jitter = random.uniform(0, 0.75)
            sleep_for = base * (2 ** (attempt - 1)) + jitter
            logging.info('Retrying after %.2fs (attempt %d/%d)', sleep_for, attempt, max_tries)
            time_sleep(sleep_for)
            attempt += 1

def print_section(title: str):
    line = "─" * max(10, len(title) + 8)
    msg = f"\n{line}\n  {title}\n{line}"
    if tqdm:
        tqdm.write(msg)
    else:
        print(msg)

# ---------- Extraction helpers ----------
def _extract_player_key(obj: Any) -> Optional[str]:
    for cand in ("player_key", "key", "playerKey"):
        try:
            if isinstance(obj, dict) and obj.get(cand):
                return obj[cand]
            val = getattr(obj, cand, None)
            if val:
                return val
        except Exception:
            pass
    return None

def _extract_player_name(obj: Any) -> Optional[str]:
    try:
        if isinstance(obj, dict):
            n = obj.get("name")
            if isinstance(n, dict):
                full = n.get("full")
                if full:
                    return full
                first, last = (n.get("first") or "").strip(), (n.get("last") or "").strip()
                both = f"{first} {last}".strip()
                return both or None
            elif n is not None:
                try:
                    full = getattr(n, 'full', None)
                    if not full and hasattr(n, 'get'):
                        full = n.get('full')
                    if full:
                        return full
                    first = getattr(n, 'first', None) or (n.get('first') if hasattr(n, 'get') else None)
                    last  = getattr(n, 'last',  None) or (n.get('last')  if hasattr(n, 'get') else None)
                    if first or last:
                        return f"{(first or '').strip()} {(last or '').strip()}".strip() or None
                except Exception:
                    pass
        else:
            n = getattr(obj, "name", None)
            full = getattr(n, "full", None) if n else None
            if full:
                return full
            return str(n) if n else None
    except Exception:
        return None

def _extract_percent_owned(obj: Any, *, key: Optional[str] = None, date_str: Optional[str] = None) -> Tuple[Optional[float], Optional[str]]:
    """
    Returns (value, coverage_type) where value is float|None and coverage_type is 'date'|'week'|'season'|None.
    Accepts YFPY model objects or raw dicts. Warns if coverage_type != 'date' for a date query.
    """
    value = None
    coverage = None
    try:
        if isinstance(obj, dict):
            po = obj.get("percent_owned")
            if isinstance(po, dict):
                coverage = po.get("coverage_type") or coverage or po.get("coverageType")
                v = po.get("value") if "value" in po else po.get("Value")
                if v is not None:
                    try:
                        value = float(v)
                    except Exception:
                        pass
            elif isinstance(po, (int, float, str)):
                try:
                    value = float(po)
                except Exception:
                    pass
            elif po is not None:
                try:
                    coverage = getattr(po, 'coverage_type', None) or getattr(po, 'coverageType', None) or \
                               (po.get('coverage_type') if hasattr(po, 'get') else None) or \
                               (po.get('coverageType') if hasattr(po, 'get') else None)
                    v_attr = getattr(po, 'value', None) or (po.get('value') if hasattr(po, 'get') else None) or getattr(po, 'Value', None)
                    if v_attr is not None:
                        try:
                            value = float(v_attr)
                        except Exception:
                            pass
                except Exception:
                    pass

            if value is None:
                own = obj.get("ownership")
                if isinstance(own, dict):
                    coverage = own.get("coverage_type") or coverage or own.get("coverageType")
                    v = own.get("value")
                    if v is not None:
                        try:
                            value = float(v)
                        except Exception:
                            pass
                elif own is not None:
                    try:
                        coverage = getattr(own, 'coverage_type', None) or getattr(own, 'coverageType', None) or \
                                   (own.get('coverage_type') if hasattr(own, 'get') else None) or \
                                   (own.get('coverageType') if hasattr(own, 'get') else None)
                        v_attr = getattr(own, 'value', None) or (own.get('value') if hasattr(own, 'get') else None)
                        if v_attr is not None:
                            try:
                                value = float(v_attr)
                            except Exception:
                                pass
                    except Exception:
                        pass
        else:
            po = getattr(obj, "percent_owned", None)
            if po is not None:
                coverage = getattr(po, "coverage_type", None) or getattr(po, "coverageType", None)
                v_attr = getattr(po, "value", None)
                if v_attr is not None:
                    try:
                        value = float(v_attr)
                    except Exception:
                        pass

            if value is None:
                own = getattr(obj, "ownership", None)
                if own is not None:
                    coverage = getattr(own, "coverage_type", None) or getattr(own, "coverageType", None)
                    v_attr = getattr(own, "value", None)
                    if v_attr is not None:
                        try:
                            value = float(v_attr)
                        except Exception:
                            pass
    except Exception as e:
        logging.debug("extract_percent_owned error for %s on %s: %s", key, date_str, e)

    if coverage and (coverage.lower() not in ("date", "week")) and key and date_str:
        logging.warning("Unexpected coverage_type=%s for %s on %s", coverage, key, date_str)
    return value, coverage

# ---------- Supabase helpers ----------
def get_second_most_recent_season(supabase: Client):
    resp = supabase.table('seasons').select('*').order('startDate', desc=True).range(1, 1).execute()
    if hasattr(resp, 'data') and resp.data:
        return resp.data[0]
    return None

def get_game_id_for_season(supabase: Client, season_start_year: int, default_league_id: str):
    if season_start_year in GAME_LEAGUE_OVERRIDES:
        o = GAME_LEAGUE_OVERRIDES[season_start_year]
        return o['game_id_prefix'], o['league_id']
    resp = supabase.table('yahoo_game_keys').select('game_id, game_key, season').eq('season', season_start_year).limit(1).execute()
    if hasattr(resp, 'data') and resp.data:
        row = resp.data[0]
        game_id = str(row.get('game_id') or row.get('game_key'))
        return game_id, default_league_id
    return None, default_league_id

def _try_fetch_player_keys_eq_prefix(supabase: Client, game_id_prefix: str):
    """Fast path if you added a generated column game_prefix = split_part(player_key,'.',1)."""
    try:
        resp = supabase.table('yahoo_player_keys').select('player_key,player_name').eq('game_prefix', game_id_prefix).range(0, 999).execute()
        data = getattr(resp, 'data', None) or []
        results = [(r['player_key'], r.get('player_name')) for r in data if 'player_key' in r]
        offset = 1000
        while len(data) == 1000:
            resp = supabase.table('yahoo_player_keys').select('player_key,player_name').eq('game_prefix', game_id_prefix).range(offset, offset+999).execute()
            data = getattr(resp, 'data', None) or []
            results.extend([(r['player_key'], r.get('player_name')) for r in data if 'player_key' in r])
            offset += 1000
        return results
    except Exception:
        return None  # fall back to LIKE

def get_player_keys_for_game(supabase: Client, game_id_prefix: str, limit: int = None):
    # Return list of (player_key, player_name|None)
    rows = _try_fetch_player_keys_eq_prefix(supabase, game_id_prefix)
    if rows is None:
        page_size = 1000
        offset = 0
        results = []
        base = supabase.table('yahoo_player_keys').select('player_key,player_name').like('player_key', f"{game_id_prefix}.%")
        if limit:
            collected = 0
            while True:
                end = min(page_size, limit - collected)
                if end <= 0:
                    break
                resp = base.range(offset, offset + end - 1).execute()
                data = getattr(resp, 'data', None)
                if not data:
                    break
                for r in data:
                    if 'player_key' in r:
                        results.append((r['player_key'], r.get('player_name')))
                        collected += 1
                        if collected >= limit:
                            return results
                if len(data) < end:
                    break
                offset += end
            rows = results
        else:
            while True:
                resp = base.range(offset, offset + page_size - 1).execute()
                data = getattr(resp, 'data', None)
                if not data:
                    break
                for r in data:
                    if 'player_key' in r:
                        results.append((r['player_key'], r.get('player_name')))
                if len(data) < page_size:
                    break
                offset += page_size
            rows = results
    return rows[:limit] if limit else rows

def upsert_ownership_batch_daily(supabase: Client, records: List[Dict[str, Any]]):
    if not records:
        return
    max_tries = 5
    base_sleep = 0.5
    for attempt in range(1, max_tries + 1):
        try:
            resp = supabase.table('yahoo_player_ownership_daily') \
                           .upsert(records, on_conflict='player_key,ownership_date') \
                           .execute()
            if hasattr(resp, 'error') and resp.error:
                logging.warning('Upsert error (attempt %d/%d): %s', attempt, max_tries, resp.error)
                raise Exception(resp.error)
            logging.info('Upserted %d rows', len(records))
            return
        except Exception as e:
            logging.warning('Upsert failed (attempt %d/%d): %s', attempt, max_tries, e)
            if attempt < max_tries:
                sleep_for = base_sleep * (2 ** (attempt - 1)) + (0.1 * attempt)
                time_sleep(sleep_for)
            else:
                logging.error('Upsert permanently failed after %d attempts', max_tries)

def get_existing_player_keys_for_date(supabase: Client, date_str: str) -> set:
    page_size = 1000
    offset = 0
    acc = set()
    while True:
        resp = supabase.table('yahoo_player_ownership_daily') \
                       .select('player_key') \
                       .eq('ownership_date', date_str) \
                       .range(offset, offset + page_size - 1) \
                       .execute()
        data = getattr(resp, 'data', None) or []
        for r in data:
            pk = r.get('player_key')
            if pk:
                acc.add(pk)
        if len(data) < page_size:
            break
        offset += page_size
    return acc

# ---------- Response shape helpers ----------
def _flatten_players_payload(data: Any) -> List[Any]:
    """
    After path ["league","players"] via yfpy, we usually get a list of dicts
    each holding a "player" key. This flattens to a list of player dicts/objects.
    """
    if data is None:
        return []
    out: List[Any] = []

    def push_player(p):
        if p is None:
            return
        if isinstance(p, list):
            for x in p:
                push_player(x)
        else:
            out.append(p)

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "player" in item:
                push_player(item["player"])
            else:
                push_player(item)
        return out

    if isinstance(data, dict):
        if "player" in data:
            push_player(data["player"])
        else:
            push_player(data)
        return out

    return [data]

# ---------- Yahoo fetchers (HISTORICAL by date) ----------
def fetch_players_percent_owned_batch_for_date(
    yahoo_query: YahooFantasySportsQuery,
    player_keys: List[str],
    date_str: str,
    explicit_league_id: Optional[str] = None,
    max_tries: int = 4
) -> List[Any]:
    if not player_keys:
        return []

    try:
        game_prefix = player_keys[0].split('.p.')[0]
    except Exception:
        game_prefix = None

    league_key = yahoo_query.get_league_key() if not game_prefix else f"{game_prefix}.l.{(explicit_league_id or yahoo_query.league_id)}"

    keys_param = ','.join(player_keys)
    url = (
        f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_key}/players;"
        f"player_keys={keys_param}/percent_owned;type=date;date={date_str}"
    )

    # request the collection and flatten later
    raw = _perform_yahoo_query(
        yahoo_query, url, ["league", "players"], return_class=None, max_tries=max_tries
    )
    players = _flatten_players_payload(raw)
    return players

# ---------- Core ingest (completeness per date) ----------
def fetch_and_upsert_missing_for_date(
    supabase: Client,
    yahoo_query: YahooFantasySportsQuery,
    date_str: str,
    missing_keys: List[str],
    season_start_year: int,
    season_row: dict,
    mapped_league_id: str,
    current_max_keys: int,
    per_call_pause: float,
    name_lookup: Dict[str, Optional[str]]
) -> Tuple[int, int]:
    """Fetch ownership for 'missing_keys' for that specific date and upsert into daily table."""
    batch: List[Dict[str, Any]] = []
    success = 0
    failure = 0

    for j in range(0, len(missing_keys), current_max_keys):
        subkeys = missing_keys[j:j+current_max_keys]
        logging.info('Yahoo fetch %s: requesting %d keys (j=%d..%d)',
                     date_str, len(subkeys), j, j+len(subkeys)-1)
        try:
            returned = fetch_players_percent_owned_batch_for_date(
                yahoo_query, subkeys, date_str, explicit_league_id=mapped_league_id, max_tries=4
            )

            # Requested vs returned diagnostics
            if LOG_MISSING_KEYS:
                try:
                    requested_set = set(subkeys)
                    returned_keys = set()
                    for obj in (returned or []):
                        k = _extract_player_key(obj)
                        if k:
                            returned_keys.add(k)
                    missing_in_response = list(requested_set - returned_keys)
                    if missing_in_response:
                        sample_missing = missing_in_response[:MISSING_KEYS_LOG_LIMIT]
                        logging.info('Batch %s: returned %d/%d; missing sample: %s',
                                     date_str, len(returned_keys), len(requested_set), sample_missing)
                except Exception:
                    pass

            # Map returned objects by player_key
            by_key: Dict[str, Any] = {}
            for obj in (returned or []):
                k = _extract_player_key(obj)
                if k:
                    by_key[k] = obj

            for key in subkeys:
                obj = by_key.get(key)  # may be None if Yahoo didn't return a record
                player_name = _extract_player_name(obj) if obj else (name_lookup.get(key) if name_lookup else None)
                value, coverage = _extract_percent_owned(obj, key=key, date_str=date_str) if obj else (None, None)

                # derive ids from the key
                derived_game_id = None
                derived_player_id = None
                try:
                    if key and ".p." in key:
                        g, pid = key.split(".p.")
                        derived_game_id = g
                        derived_player_id = int(pid)
                except Exception:
                    pass

                rec = {
                    'player_key': key,
                    'player_name': player_name,
                    'player_id': derived_player_id,
                    'game_id': derived_game_id,
                    'season_start_year': season_start_year,
                    'season_id': (
                        season_row.get('id')
                        if season_row and season_row.get('id') is not None
                        else (season_row.get('seasonId') if season_row and season_row.get('seasonId') is not None
                              else (season_row.get('season_id') if season_row and season_row.get('season_id') is not None else None))
                    ),
                    'league_id': mapped_league_id,
                    'ownership_date': date_str,
                    'ownership_pct': float(value) if value is not None else None,
                    'source': 'yahoo',
                    'inserted_at': datetime.now(timezone.utc).isoformat(),
                }
                batch.append(rec)
                success += 1

                # Debug raw object when no value extracted
                global _debug_print_count
                if DEBUG_PRINT_OBJECTS and value is None and _debug_print_count < DEBUG_PRINT_LIMIT:
                    try:
                        logging.info('DEBUG: ownership object for %s on %s: repr=%s', key, date_str, repr(obj))
                        attrs = dir(obj) if not isinstance(obj, dict) else list(obj.keys())
                        logging.info('DEBUG: ownership object attrs for %s: %s', key, attrs)
                        _debug_print_count += 1
                    except Exception:
                        pass
        except Exception as e:
            logging.warning('Fetch error for keys %s on %s: %s', subkeys[:3], date_str, e)
            failure += len(subkeys)

        # gentle pause between sub-batches (global pacing still enforced)
        time_sleep(per_call_pause)

    if batch:
        upsert_ownership_batch_daily(supabase, batch)

    return success, failure

def ensure_full_coverage_for_date(
    supabase: Client,
    yahoo_query: YahooFantasySportsQuery,
    date_str: str,
    expected_keys_set: set,
    season_start_year: int,
    season_row: dict,
    mapped_league_id: str,
    current_max_keys: int,
    per_call_pause: float,
    name_lookup: Dict[str, Optional[str]],
    max_sweeps: Optional[int] = None,
    pbar=None  # NEW: optional tqdm progress bar passed from main
) -> Tuple[str, int]:
    """
    Guarantee one row per expected player for date_str, with bounded resweeps.
    Returns: (status, missing_count) where status in {"complete", "incomplete", "stagnant"}.
    """
    if max_sweeps is None:
        max_sweeps = DEFAULT_MAX_SWEEPS_PER_DATE

    expected = expected_keys_set
    existing = get_existing_player_keys_for_date(supabase, date_str)

    try:
        STAGNANT_LIMIT = int(os.getenv('YHO_STAGNANT_LIMIT', '5'))
    except Exception:
        STAGNANT_LIMIT = 5

    # ----- 3-tier batch sizing (env-tunable) -----
    def tiered_batch_size(sweep_num: int) -> int:
        try:
            first  = int(os.getenv('YHO_FIRST_SWEEP_KEYS', str(current_max_keys)))  # default: current_max_keys (<=25)
        except Exception:
            first = current_max_keys
        try:
            later  = int(os.getenv('YHO_LATER_SWEEP_KEYS', '15'))
        except Exception:
            later = 15
        try:
            much_later = int(os.getenv('YHO_MUCH_LATER_SWEEP_KEYS', '10'))
        except Exception:
            much_later = 10

        # clamp all to [1, current_max_keys]
        first = max(1, min(current_max_keys, first))
        later = max(1, min(current_max_keys, later))
        much_later = max(1, min(current_max_keys, much_later))

        if sweep_num == 1:
            return first
        elif sweep_num < 4:  # 2–3
            return later
        else:                # 4+
            return much_later

    last_missing_count: Optional[int] = None
    stagnant_cycles = 0
    sweep = 0

    while True:
        missing_list = list(expected - existing)
        missing_count = len(missing_list)
        if missing_count == 0:
            if tqdm:
                tqdm.write(f"✓ {date_str} complete after sweep {sweep}")
            else:
                logging.info('Date %s complete after sweep %d', date_str, sweep)
            telemetry_write({'type': 'date_complete', 'date': date_str, 'sweeps': sweep})
            return ("complete", 0)

        # Progress tracking
        if last_missing_count is not None and missing_count >= last_missing_count:
            stagnant_cycles += 1
        else:
            stagnant_cycles = 0
        last_missing_count = missing_count

        if STAGNANT_LIMIT and stagnant_cycles >= STAGNANT_LIMIT:
            if tqdm:
                tqdm.write(f"⚠ {date_str} appears stagnant with {missing_count} missing.")
            logging.error('Date %s stuck with %d missing after %d sweeps (no progress %d cycles).',
                          date_str, missing_count, sweep, stagnant_cycles)
            telemetry_write({'type': 'date_stagnant', 'date': date_str, 'missing': missing_count})
            return ("stagnant", missing_count)

        if sweep >= max_sweeps:
            if tqdm:
                tqdm.write(f"⚠ {date_str} incomplete: {missing_count} missing after {sweep} sweeps.")
            logging.error('Date %s still missing %d players after %d sweeps', date_str, missing_count, sweep)
            telemetry_write({'type': 'date_incomplete', 'date': date_str, 'missing': missing_count})
            return ("incomplete", missing_count)

        sweep += 1
        if tqdm:
            tqdm.write(f"→ {date_str} sweep {sweep}: {missing_count} missing...")

        # -- size per sweep via 3-tier schedule --
        sub_batch_size = tiered_batch_size(sweep)
        pause_more = max(per_call_pause, 1.0 if sweep < 3 else 1.5)

        # remember how many rows we had before the sweep
        before = len(existing)

        _success, _failure = fetch_and_upsert_missing_for_date(
            supabase, yahoo_query, date_str, missing_list, season_start_year, season_row,
            mapped_league_id, sub_batch_size, pause_more, name_lookup
        )

        # refresh existing & update per-date bar by the *true* delta
        existing = get_existing_player_keys_for_date(supabase, date_str)
        delta = max(0, len(existing) - before)
        if pbar and delta:
            # clamp to avoid going past total if Yahoo returns dupes
            remaining = max(0, pbar.total - pbar.n)
            pbar.update(min(delta, remaining))

# ---------- Diagnostics ----------
def dump_sample_for_first_key(supabase: Client, yahoo_query: YahooFantasySportsQuery, date_str: Optional[str] = None):
    season_row = get_second_most_recent_season(supabase)
    test_date = (date_str if isinstance(date_str, str) and date_str
                 else (season_row['startDate'] if season_row and 'startDate' in season_row
                       else datetime.now(timezone.utc).strftime('%Y-%m-%d')))
    season_start_year = datetime.fromisoformat(test_date).year if test_date else None
    game_id_prefix, mapped_league_id = get_game_id_for_season(
        supabase, season_start_year, default_league_id=yahoo_query.league_id
    )
    rows = get_player_keys_for_game(supabase, game_id_prefix, limit=10)
    if not rows:
        print('No player keys found for sample')
        return

    sample_key = rows[0][0]
    print('Sample player_key:', sample_key)
    print('Test date:', test_date)

    try:
        batch = None
        try:
            batch = fetch_players_percent_owned_batch_for_date(
                yahoo_query, [sample_key], test_date, explicit_league_id=mapped_league_id, max_tries=2
            )
        except Exception as e:
            print('Batch fetch raised:', repr(e))

        print('\n--- BATCH RESULT ---')
        print(repr(batch))
        try:
            if isinstance(batch, list) and len(batch) > 0:
                b0 = batch[0]
                val, cov = _extract_percent_owned(b0, key=sample_key, date_str=test_date)
                print('percent_owned value:', val, 'coverage:', cov)
                print('player_name:', _extract_player_name(b0))
                print('player_key from API:', _extract_player_key(b0))
        except Exception as e:
            print('Error extracting fields from batch result:', e)

        telemetry_write({'type': 'dump_sample', 'player_key': sample_key, 'date': test_date,
                         'batch_present': bool(batch)})
    except Exception as e:
        print('Unexpected error in dump_sample_for_first_key:', e)

# ---------- Entrypoint helpers ----------
def daterange(start_date: date, end_date: date):
    for n in range(int((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)

def get_most_recent_ownership_date(supabase: Client):
    try:
        resp = supabase.table('yahoo_player_ownership_daily').select('ownership_date').order('ownership_date', desc=True).limit(1).execute()
        if hasattr(resp, 'data') and resp.data:
            ds = resp.data[0].get('ownership_date')
            if isinstance(ds, str):
                try:
                    return datetime.fromisoformat(ds).date()
                except Exception:
                    return None
            return ds
    except Exception as e:
        logging.warning('Could not query most recent ownership_date: %s', e)
    return None

def delete_rows_for_date(supabase: Client, date_str: str):
    try:
        supabase.table('yahoo_player_ownership_daily').delete().eq('ownership_date', date_str).execute()
        logging.info('Deleted rows for date %s (fresh re-ingest)', date_str)
    except Exception as e:
        logging.warning('Failed to delete rows for %s: %s', date_str, e)

# ---------- Main ----------
def main(sample_player_limit: Optional[int] = None,
         sample_dates_limit: Optional[int] = None,
         batch_size: int = 25,
         sleep_seconds: float = 0.5,
         resume: bool = True):
    supabase, yahoo_query = init_clients()

    # Choose 2nd-most-recent season
    season_row = get_second_most_recent_season(supabase)
    if not season_row:
        logging.error('Could not find second-most-recent season in seasons table')
        raise SystemExit(1)

    start_date = season_row.get('startDate')
    end_date = season_row.get('regularSeasonEndDate') or season_row.get('endDate')
    if isinstance(start_date, str):
        start_date = datetime.fromisoformat(start_date).date()
    if isinstance(end_date, str):
        end_date = datetime.fromisoformat(end_date).date()
    logging.info('Using season from %s to %s', start_date, end_date)

    season_start_year = start_date.year
    game_id_prefix, mapped_league_id = get_game_id_for_season(
        supabase, season_start_year, default_league_id=yahoo_query.league_id
    )
    if not game_id_prefix:
        logging.error('Could not find yahoo_game_keys entry for season %s', season_start_year)
        raise SystemExit(1)
    logging.info('Mapped season %s -> game id prefix %s (league_id=%s)',
                 season_start_year, game_id_prefix, mapped_league_id)

    # ALL players + name map
    rows = get_player_keys_for_game(supabase, game_id_prefix)
    if not rows:
        logging.error('No player keys found for game id prefix %s', game_id_prefix)
        raise SystemExit(1)

    if sample_player_limit:
        rows = rows[:sample_player_limit]
    player_keys = [rk for rk, _ in rows]
    name_lookup = {rk: nm for rk, nm in rows}

    logging.info('Expected players for game %s: %d', game_id_prefix, len(player_keys))

    # Request size (clamped to Yahoo max 25). Use env if set; else fall back to batch_size arg.
    try:
        current_max_keys = int(os.getenv('YFPY_MAX_KEYS_PER_REQUEST', str(batch_size)))
    except Exception:
        current_max_keys = batch_size
    current_max_keys = max(1, min(25, current_max_keys))  # clamp
    current_sleep_seconds = float(os.getenv('YHO_SLEEP_SECONDS', str(sleep_seconds)))

    # Dates to process
    all_dates = list(daterange(start_date, end_date))
    if sample_dates_limit:
        all_dates = all_dates[:sample_dates_limit]
    logging.info('Will iterate %d dates (historical by-date requests)', len(all_dates))

    # Resume: overwrite the most recent date and continue forward
    if resume:
        most_recent = get_most_recent_ownership_date(supabase)
        if most_recent:
            logging.info('Most recent ownership_date in table: %s - will overwrite and continue', most_recent)
            try:
                start_index = all_dates.index(most_recent)
                delete_rows_for_date(supabase, most_recent.isoformat())
                all_dates = all_dates[start_index:]
            except ValueError:
                logging.info('Most recent date %s not in season range; starting from season start.', most_recent)

    expected_keys_set = set(player_keys)
    if not expected_keys_set:
        logging.error('No expected players; aborting.')
        raise SystemExit(1)

    # Process dates (ensure completeness per date)
    incomplete_dates: List[str] = []

    # Outer progress over dates (falls back to plain loop if tqdm missing)
    date_iter = tqdm(all_dates, desc="Dates", unit="date", position=0, leave=True) if tqdm else all_dates

    for d in date_iter:
        date_str = d.strftime('%Y-%m-%d')

        # Divider for non-tqdm terminals
        if not tqdm:
            print_section(f"{date_str} • Ensuring completeness")

        # Per-date bar (rows == expected players)
        total_rows = len(expected_keys_set)
        if tqdm:
            # If resuming and the date already has some rows, reflect that in the bar
            existing_count = len(get_existing_player_keys_for_date(supabase, date_str))
            pbar = tqdm(
                total=total_rows,
                desc=date_str,
                unit="rows",
                position=1,      # stack under the dates bar
                leave=False,
                dynamic_ncols=True,
            )
            if existing_count:
                # clamp to total to avoid overflows if table had extras
                pbar.update(min(existing_count, total_rows))
        else:
            pbar = None

        try:
            status, miss = ensure_full_coverage_for_date(
                supabase=supabase,
                yahoo_query=yahoo_query,
                date_str=date_str,
                expected_keys_set=expected_keys_set,
                season_start_year=season_start_year,
                season_row=season_row,
                mapped_league_id=mapped_league_id,
                current_max_keys=current_max_keys,
                per_call_pause=current_sleep_seconds,
                name_lookup=name_lookup,
                pbar=pbar,  # pass the per-date tqdm bar
            )
        except Exception as e:
            # Date-level auth guard: wipe & retry once on auth problems
            if any(s in str(e).lower() for s in ('oauth', 'token_expired', 'invalid_token', '401')):
                logging.warning('Auth error on %s; wiping and retrying once.', date_str)
                delete_rows_for_date(supabase, date_str)
                status, miss = ensure_full_coverage_for_date(
                    supabase=supabase,
                    yahoo_query=yahoo_query,
                    date_str=date_str,
                    expected_keys_set=expected_keys_set,
                    season_start_year=season_start_year,
                    season_row=season_row,
                    mapped_league_id=mapped_league_id,
                    current_max_keys=current_max_keys,
                    per_call_pause=max(current_sleep_seconds, 1.0),
                    name_lookup=name_lookup,
                    pbar=pbar,  # pass bar again
                )
            else:
                if tqdm and pbar is not None:
                    pbar.close()
                raise

        # Post-check + visible summary line
        existing_count = len(get_existing_player_keys_for_date(supabase, date_str))
        if tqdm:
            # ensure the bar shows final count (clamped)
            pbar.n = min(existing_count, total_rows)
            pbar.refresh()
            pbar.close()
            tqdm.write(f"{date_str}: {existing_count}/{total_rows} • {status} • missing={miss}")
            # Safely set a postfix on the outer bar if available
            try:
                if hasattr(date_iter, "set_postfix_str"):
                    date_iter.set_postfix_str(f"last={date_str}:{existing_count}/{total_rows} {status}")
            except Exception:
                pass
        else:
            logging.info('Post-check %s: %d/%d rows present (status=%s, missing=%d)',
                         date_str, existing_count, total_rows, status, miss)

        if status != "complete" or existing_count < total_rows:
            incomplete_dates.append(date_str)

        # small pause between dates
        time_sleep(current_sleep_seconds)

    # One or more passes over any stragglers
    for pass_num in range(1, FINAL_STRAGGLER_PASSES + 1):
        if not incomplete_dates:
            break
        logging.info('Revisiting %d incomplete dates (pass %d/%d)...', len(incomplete_dates), pass_num, FINAL_STRAGGLER_PASSES)
        still_incomplete: List[str] = []
        for date_str in incomplete_dates:
            status, miss = ensure_full_coverage_for_date(
                supabase=supabase,
                yahoo_query=yahoo_query,
                date_str=date_str,
                expected_keys_set=expected_keys_set,
                season_start_year=season_start_year,
                season_row=season_row,
                mapped_league_id=mapped_league_id,
                current_max_keys=current_max_keys,
                per_call_pause=max(current_sleep_seconds, 1.0),
                name_lookup=name_lookup
            )
            existing_count = len(get_existing_player_keys_for_date(supabase, date_str))
            logging.info('Post-revisit %s: %d/%d rows present (status=%s, missing=%d)',
                         date_str, existing_count, len(expected_keys_set), status, miss)
            if status != "complete" or existing_count < len(expected_keys_set):
                still_incomplete.append(date_str)
            time_sleep(current_sleep_seconds)
        incomplete_dates = still_incomplete

    if incomplete_dates:
        logging.warning('Run finished with %d incomplete dates (see logs): %s', len(incomplete_dates), incomplete_dates)
        telemetry_write({'type': 'run_incomplete_dates', 'dates': incomplete_dates})
    else:
        logging.info('Run finished: all dates complete.')

# ---------- Entrypoint ----------
if __name__ == '__main__':
    sample_player_limit = int(os.getenv('YHO_SAMPLE_PLAYER_LIMIT', '0')) or None
    sample_dates_limit = int(os.getenv('YHO_SAMPLE_DATES_LIMIT', '0')) or None
    batch_size = int(os.getenv('YHO_BATCH_SIZE', '25'))
    sleep_seconds = float(os.getenv('YHO_SLEEP_SECONDS', '0.5'))
    resume_flag = bool(int(os.getenv('YHO_RESUME', '1')))

    logging.info('Starting ingestion with batch_size=%d, sleep_seconds=%.2f, resume=%s, '
                 'min_interval=%.2fs, max_calls_per_minute=%s, max_keys_per_request<=%d',
                 batch_size, sleep_seconds, resume_flag, _MIN_INTERVAL,
                 (_MAX_PER_MINUTE if _MAX_PER_MINUTE > 0 else 'disabled'),
                 int(os.getenv('YFPY_MAX_KEYS_PER_REQUEST', '25')))

    supabase, yahoo_query = init_clients()
    if os.getenv('YHO_DUMP_SAMPLE') == '1':
        dump_sample_for_first_key(supabase, yahoo_query)
    else:
        main(sample_player_limit=sample_player_limit,
             sample_dates_limit=sample_dates_limit,
             batch_size=batch_size,
             sleep_seconds=sleep_seconds,
             resume=resume_flag)
#!/usr/bin/env python3
"""
Yahoo NHL ownership HISTORY ingester — WEEKLY (batched, rate-limit aware).

What this does
--------------
- Discovers Yahoo NHL "game weeks".
- For each week, fetches percent_owned for players in batches (<=25 keys).
- Writes ONE ROW PER PLAYER PER WEEK, stamping ownership_date = WEEK_END.
- Robust OAuth refresh + retry/backoff + re-sweeps for completeness.

Schema assumption
-----------------
Table: yahoo_player_ownership_daily
Unique key: (player_key, ownership_date)
We write the weekly snapshot with ownership_date = week_end (ISO date).

Env knobs (defaults shown)
--------------------------
  YFPY_MAX_KEYS_PER_REQUEST=25
  YHO_MIN_INTERVAL_SECONDS=1.0
  YHO_MAX_CALLS_PER_MINUTE=60
  YHO_SLEEP_SECONDS=0.5
  YHO_SAMPLE_PLAYER_LIMIT=0
  YHO_SAMPLE_WEEKS_LIMIT=0
  YHO_RESUME=1

Required env
------------
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  YFPY_CONSUMER_KEY
  YFPY_CONSUMER_SECRET
  (optional) YFPY_ACCESS_TOKEN, YFPY_REFRESH_TOKEN
  (optional) YFPY_GAME_ID, YFPY_LEAGUE_ID   # only for bootstrap client
"""
import os, time, random, json, logging
from collections import deque
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
from email.utils import parsedate_to_datetime
from typing import Optional, Dict, List, Tuple, Any

from dotenv import load_dotenv
from supabase import create_client, Client
from yfpy.query import YahooFantasySportsQuery

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# ---------- Config ----------
DEFAULT_MAX_SWEEPS_PER_WEEK = 10
FINAL_STRAGGLER_PASSES = 1

def _get_progress_log_path():
    try:
        return Path(__file__).resolve().parents[6] / 'yahoo_historical_progress.log'
    except Exception:
        return Path.cwd() / 'yahoo_historical_progress.log'

def telemetry_write(obj: dict):
    try:
        p = _get_progress_log_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        obj.setdefault('ts', datetime.now(timezone.utc).isoformat())
        p.write_text(p.read_text() + json.dumps(obj, separators=(',', ':'), default=str) + "\n" if p.exists() else json.dumps(obj, separators=(',', ':'), default=str) + "\n", encoding='utf-8')
    except Exception:
        pass

def load_env_candidates():
    try:
        repo_root = Path(__file__).resolve().parents[6]
    except Exception:
        repo_root = Path.cwd()
    for p in [
        repo_root / 'web' / ".env.local",
        Path.cwd() / 'web' / ".env.local",
        repo_root / ".env.local",
        Path.cwd() / ".env.local",
    ]:
        try:
            if p.exists():
                load_dotenv(p)
                logging.info(f"Loaded env from {p}")
                return p
        except Exception:
            continue
    logging.info("No .env.local found in candidates; relying on environment variables.")
    return None

# Manual overrides: season_start_year -> { game_id_prefix, league_id }
GAME_LEAGUE_OVERRIDES = {
    2024: {"game_id_prefix": "453", "league_id": "105954"},
    2025: {"game_id_prefix": "465", "league_id": "858"},
}

LOG_MISSING_KEYS = os.getenv('YHO_LOG_MISSING_KEYS', '1') == '1'
MISSING_KEYS_LOG_LIMIT = int(os.getenv('YHO_MISSING_KEYS_LIMIT', '10') or '10')

# ---------- Clients ----------
def init_clients():
    load_env_candidates()
    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not all([SUPABASE_URL, SUPABASE_KEY]):
        logging.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
        raise SystemExit(1)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Bootstrap Yahoo client (may be different season than we ingest)
    YCK, YCS = os.getenv("YFPY_CONSUMER_KEY"), os.getenv("YFPY_CONSUMER_SECRET")
    YAT, YRT = os.getenv("YFPY_ACCESS_TOKEN"), os.getenv("YFPY_REFRESH_TOKEN")
    if not (YCK and YCS):
        try:
            creds = supabase.table('yahoo_api_credentials').select(
                'consumer_key,consumer_secret,access_token,refresh_token'
            ).limit(1).single().execute()
            if getattr(creds, 'data', None):
                row = creds.data
                YCK = YCK or row.get('consumer_key')
                YCS = YCS or row.get('consumer_secret')
                YAT = YAT or row.get('access_token')
                YRT = YRT or row.get('refresh_token')
                logging.info('Loaded Yahoo API credentials from Supabase')
        except Exception as e:
            logging.warning('Could not load yahoo_api_credentials from Supabase: %s', e)
    if not (YCK and YCS):
        logging.error('Missing Yahoo consumer key/secret (env or Supabase).')
        raise SystemExit(1)

    GAME_ID = os.getenv("YFPY_GAME_ID", "465")
    LEAGUE_ID = os.getenv("YFPY_LEAGUE_ID", "858")

    yq = YahooFantasySportsQuery(
        league_id=LEAGUE_ID, game_code="nhl", game_id=GAME_ID,
        yahoo_consumer_key=YCK, yahoo_consumer_secret=YCS,
        save_token_data_to_env_file=False, env_file_location=Path.cwd()
    )
    try:
        if YAT:
            yq._yahoo_access_token_dict = yq._get_dict_from_access_token_json({'access_token': YAT, 'refresh_token': YRT})
    except Exception:
        pass
    try:
        yq.save_access_token_data_to_env_file(env_file_location=Path.cwd(), env_file_name='.env.local')
    except Exception:
        pass
    return supabase, yq

def init_yahoo_query_for(game_id: str, league_id: str) -> YahooFantasySportsQuery:
    YCK, YCS = os.getenv("YFPY_CONSUMER_KEY"), os.getenv("YFPY_CONSUMER_SECRET")
    YAT, YRT = os.getenv("YFPY_ACCESS_TOKEN"), os.getenv("YFPY_REFRESH_TOKEN")
    if not (YCK and YCS):
        raise RuntimeError("Missing Yahoo consumer key/secret in env")
    yq = YahooFantasySportsQuery(
        league_id=league_id, game_code="nhl", game_id=game_id,
        yahoo_consumer_key=YCK, yahoo_consumer_secret=YCS,
        save_token_data_to_env_file=False, env_file_location=Path.cwd()
    )
    try:
        if YAT:
            yq._yahoo_access_token_dict = yq._get_dict_from_access_token_json({'access_token': YAT, 'refresh_token': YRT})
    except Exception:
        pass
    try:
        yq.save_access_token_data_to_env_file(env_file_location=Path.cwd(), env_file_name='.env.local')
    except Exception:
        pass
    return yq

def _refresh_token_if_possible(yq: YahooFantasySportsQuery) -> bool:
    for attr in ('refresh_access_token', '_refresh_access_token', '_refresh_yahoo_access_token'):
        fn = getattr(yq, attr, None)
        if callable(fn):
            try:
                fn(); logging.info('Yahoo access token refreshed via %s()', attr); return True
            except Exception as e:
                logging.warning('Token refresh via %s() failed: %s', attr, e)
    try:
        new = init_yahoo_query_for(yq.game_id, yq.league_id)
        yq.__dict__.update(new.__dict__)
        logging.info('Reinitialized Yahoo client to refresh token')
        return True
    except Exception as e:
        logging.error('Failed to reinitialize Yahoo client: %s', e)
        return False

# ---------- Rate limits ----------
_MIN_INTERVAL = max(0.0, float(os.getenv('YHO_MIN_INTERVAL_SECONDS', '1.0')))
_MAX_PER_MINUTE = int(os.getenv('YHO_MAX_CALLS_PER_MINUTE', '60'))
_last_request_ts = 0.0
_minute_window = deque()

def _sleep(s: float):
    try: time.sleep(s)
    except Exception: pass

def _respect_request_pacing():
    global _last_request_ts, _minute_window
    now = time.monotonic()
    elapsed = now - _last_request_ts
    if elapsed < _MIN_INTERVAL:
        _sleep((_MIN_INTERVAL - elapsed) + random.uniform(0, 0.05))
        now = time.monotonic()
    if _MAX_PER_MINUTE > 0:
        cutoff = now - 60.0
        while _minute_window and _minute_window[0] < cutoff:
            _minute_window.popleft()
        if len(_minute_window) >= _MAX_PER_MINUTE:
            _sleep((_minute_window[0] + 60.0) - now + random.uniform(0, 0.05))
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
    return ('rate limit' in low) or ('429' in low) or ('temporarily' in low) or ('try again later' in low) or \
           ('timed out' in low) or ('connection' in low) or ('token_expired' in low) or ('oauth_problem' in low) or \
           ('invalid_token' in low) or ('401' in low)

# ---------- Supabase ----------
def upsert_batch(supabase: Client, rows: list):
    if not rows: return
    for attempt in range(1, 6):
        try:
            resp = supabase.table('yahoo_player_ownership_daily') \
                           .upsert(rows, on_conflict='player_key,ownership_date') \
                           .execute()
            if getattr(resp, 'error', None):
                raise Exception(resp.error)
            logging.info('Upserted %d rows', len(rows))
            return
        except Exception as e:
            logging.warning('Upsert failed (attempt %d/5): %s', attempt, e)
            if attempt == 5: logging.error('Giving up upsert after 5 attempts'); return
            _sleep(0.5 * (2 ** (attempt - 1)) + 0.1 * attempt)

def get_second_most_recent_season(supabase: Client):
    resp = supabase.table('seasons').select('*').order('startDate', desc=True).range(1, 1).execute()
    return resp.data[0] if getattr(resp, 'data', None) else None

def get_game_id_for_season(supabase: Client, season_start_year: int, default_league_id: str):
    if season_start_year in GAME_LEAGUE_OVERRIDES:
        o = GAME_LEAGUE_OVERRIDES[season_start_year]
        return o['game_id_prefix'], o['league_id']
    resp = supabase.table('yahoo_game_keys').select('game_id, game_key, season').eq('season', season_start_year).limit(1).execute()
    if getattr(resp, 'data', None):
        row = resp.data[0]
        return str(row.get('game_id') or row.get('game_key')), default_league_id
    return None, default_league_id

def get_player_keys_for_game(supabase: Client, game_id_prefix: str, limit: int = None):
    # Prefer pre-split 'game_prefix' column if present; fall back to LIKE.
    try:
        resp = supabase.table('yahoo_player_keys').select('player_key,player_name').eq('game_prefix', game_id_prefix).range(0, 999).execute()
        data = getattr(resp, 'data', None) or []
        out = [(r['player_key'], r.get('player_name')) for r in data if 'player_key' in r]
        off = 1000
        while len(data) == 1000:
            resp = supabase.table('yahoo_player_keys').select('player_key,player_name').eq('game_prefix', game_id_prefix).range(off, off+999).execute()
            data = getattr(resp, 'data', None) or []
            out += [(r['player_key'], r.get('player_name')) for r in data if 'player_key' in r]
            off += 1000
        return out[:limit] if limit else out
    except Exception:
        pass
    # Fallback LIKE
    out, page, page_size = [], 0, 1000
    while True:
        resp = supabase.table('yahoo_player_keys').select('player_key,player_name').like('player_key', f"{game_id_prefix}.%").range(page*page_size, (page+1)*page_size-1).execute()
        data = getattr(resp, 'data', None) or []
        out += [(r['player_key'], r.get('player_name')) for r in data if 'player_key' in r]
        if len(data) < page_size: break
        page += 1
        if limit and len(out) >= limit: return out[:limit]
    return out[:limit] if limit else out

def get_existing_player_keys_for_date(supabase: Client, date_str: str) -> set:
    page_size, off, acc = 1000, 0, set()
    while True:
        resp = supabase.table('yahoo_player_ownership_daily').select('player_key').eq('ownership_date', date_str).range(off, off+page_size-1).execute()
        data = getattr(resp, 'data', None) or []
        acc.update([r.get('player_key') for r in data if r.get('player_key')])
        if len(data) < page_size: break
        off += page_size
    return acc

# ---------- Yahoo low-level ----------
def _perform_yahoo_query(yq: YahooFantasySportsQuery, url: str, path, return_class=None, max_tries: int = 4):
    base, attempt = 1.0, 1
    while attempt <= max_tries:
        try:
            _respect_request_pacing()
            return yq.query(url, path) if return_class is None else yq.query(url, path, return_class)
        except Exception as e:
            msg = str(e); low = msg.lower()
            logging.error("%s", msg)
            if any(s in low for s in ('token_expired', 'oauth_problem', 'invalid_token', '401')):
                ok = _refresh_token_if_possible(yq); logging.info('Refreshed OAuth.' if ok else 'OAuth refresh failed.')
                _sleep(2.0); attempt += 1; continue
            if not _should_retry(low) or attempt == max_tries: raise
            ra = _extract_retry_after_seconds(e)
            if ra and attempt == 1:
                logging.info('Honoring Retry-After=%ds', ra); _sleep(ra + random.uniform(0, 5)); continue
            _sleep(base * (2 ** (attempt - 1)) + random.uniform(0, 0.75)); attempt += 1

# ---------- Week discovery ----------
def _flatten_game_weeks_payload(payload: Any) -> List[dict]:
    def to_dictish(x):
        if isinstance(x, dict): return x
        try: return {k: getattr(x, k) for k in dir(x) if not k.startswith("_")}
        except Exception: return {"value": x}
    if payload is None: return []
    if isinstance(payload, list): return [to_dictish(it) for it in payload]
    if isinstance(payload, dict):
        gw = payload.get("game_week")
        if isinstance(gw, list): return [to_dictish(it) for it in gw]
        if isinstance(gw, dict): return [to_dictish(gw)]
        gws = payload.get("game_weeks")
        if isinstance(gws, list): return [to_dictish(it) for it in gws]
        if isinstance(gws, dict): return _flatten_game_weeks_payload(gws)
        if "week" in payload and ("start" in payload or "end" in payload): return [payload]
    return [to_dictish(payload)]

def _extract_weeks_from_nodes(nodes: List[Any]) -> List[Tuple[int, date, date]]:
    results: List[Tuple[int, date, date]] = []
    for node in nodes:
        for wk in _flatten_game_weeks_payload(node):
            try:
                w = wk.get("week"); sd = wk.get("start"); ed = wk.get("end")
                if w is None or sd is None or ed is None: continue
                results.append((int(str(w)), datetime.fromisoformat(str(sd)).date(), datetime.fromisoformat(str(ed)).date()))
            except Exception:
                continue
    return results

def fetch_game_weeks(yq: YahooFantasySportsQuery, game_id_prefix: str) -> List[Tuple[int, date, date]]:
    # Try helpers first (yfpy typically supports these)
    for helper_name in ("get_game_weeks", "get_game_weeks_by_game_key"):
        fn = getattr(yq, helper_name, None)
        if callable(fn):
            try:
                _respect_request_pacing()
                gw = fn() if helper_name == "get_game_weeks" else fn(game_id_prefix)
                weeks = _extract_weeks_from_nodes([gw] if gw is not None else [])
                if weeks: return sorted(weeks, key=lambda t: t[0])
            except Exception as e:
                logging.warning("%s failed: %s", helper_name, e)

    # Raw REST fallbacks
    candidates = [
        (f"https://fantasysports.yahooapis.com/fantasy/v2/game/{game_id_prefix}/game_weeks",
         [["game","game_weeks","game_week"],["game","game_weeks"],["game_weeks","game_week"],["game","game_weeks"]]),
        (f"https://fantasysports.yahooapis.com/fantasy/v2/game/{game_id_prefix};out=game_weeks",
         [["game","game_weeks","game_week"],["game","game_weeks"],["game_weeks","game_week"],["game","game_weeks"]]),
        (f"https://fantasysports.yahooapis.com/fantasy/v2/game/nhl;game_keys={game_id_prefix}/game_weeks",
         [["game","game_weeks","game_week"],["game","game_weeks"],["game_weeks","game_week"],["game","game_weeks"]]),
    ]
    collected: List[Tuple[int, date, date]] = []
    for url, paths in candidates:
        for path in paths:
            try:
                data = _perform_yahoo_query(yq, url, path)
                if data is None: continue
                weeks = _extract_weeks_from_nodes([data])
                if weeks: collected.extend(weeks); break
            except Exception as e:
                logging.warning("Week discovery attempt failed (%s %s): %s", url, path, e)
        if collected: break
    dedup = {w:(w,s,e) for (w,s,e) in collected}
    return sorted(dedup.values(), key=lambda t: t[0])

# ---------- Weekly, batched percent_owned ----------
def _extract_player_key(obj):
    for cand in ("player_key", "key", "playerKey"):
        try:
            if isinstance(obj, dict) and obj.get(cand): return obj[cand]
            val = getattr(obj, cand, None)
            if val: return val
        except Exception: pass
    return None

def _extract_player_name(obj):
    try:
        n = obj.get("name") if isinstance(obj, dict) else getattr(obj, "name", None)
        if isinstance(n, dict):
            return n.get("full") or f"{(n.get('first') or '').strip()} {(n.get('last') or '').strip()}".strip() or None
        if n is not None:
            full = getattr(n, 'full', None)
            if full: return full
            first = getattr(n, 'first', None); last = getattr(n, 'last', None)
            if first or last: return f"{(first or '').strip()} {(last or '').strip()}".strip() or None
    except Exception: pass
    return None

def _extract_percent_owned(obj):
    value, coverage = None, None
    try:
        po = (obj.get("percent_owned") if isinstance(obj, dict) else getattr(obj, "percent_owned", None))
        if isinstance(po, dict):
            coverage = po.get("coverage_type") or po.get("coverageType") or None
            v = po.get("value") if "value" in po else po.get("Value")
            if v is not None:
                try: value = float(v)
                except Exception: pass
        elif isinstance(po, (int, float, str)):
            try: value = float(po)
            except Exception: pass
        elif po is not None:
            coverage = getattr(po, "coverage_type", None) or getattr(po, "coverageType", None)
            v_attr = getattr(po, "value", None)
            if v_attr is not None:
                try: value = float(v_attr)
                except Exception: pass
    except Exception:
        pass
    return value, coverage

def fetch_percent_owned_by_week_batched(yq: YahooFantasySportsQuery, player_keys: List[str], week_no: int) -> Dict[str, dict]:
    if not player_keys: return {}
    url = (f"https://fantasysports.yahooapis.com/fantasy/v2/"
           f"league/{yq.get_league_key()}/players;"
           f"player_keys={','.join(player_keys)}/percent_owned;"
           f"type=week;week={week_no}")
    data = _perform_yahoo_query(yq, url, ["league", "players"])
    items = []
    if isinstance(data, list): items = data
    elif isinstance(data, dict): items = data["player"] if isinstance(data.get("player"), list) else [data]
    else: items = [data]

    out: Dict[str, dict] = {}
    for it in items:
        pk = _extract_player_key(it)
        val, cov = _extract_percent_owned(it)
        out[pk] = {"value": val, "coverage": cov, "raw": it}
    return out

# ---------- Core ingest (per-week completeness) ----------
def fetch_and_upsert_missing_for_week(
    supabase: Client,
    yq: YahooFantasySportsQuery,
    week_no: int,
    week_end_iso: str,
    missing_keys: list[str],
    season_start_year: int,
    season_row: dict,
    mapped_league_id: str,
    current_max_keys: int,
    per_call_pause: float,
    name_lookup: dict[str, Optional[str]]
):
    batch, success = [], 0
    for j in range(0, len(missing_keys), current_max_keys):
        subkeys = missing_keys[j:j+current_max_keys]
        po_map = {}
        try:
            po_map = fetch_percent_owned_by_week_batched(yq, subkeys, week_no)
        except Exception as e:
            logging.warning('Week-batched fetch failed for %s keys (W%s): %s', len(subkeys), week_no, e)

        returned_keys = set(po_map.keys())
        for key in subkeys:
            info = po_map.get(key, {})
            value, coverage = info.get("value"), (info.get("coverage") or "").lower()
            if coverage and coverage != "week":
                logging.warning("Coverage mismatch for %s (W%s): got %s, expected week", key, week_no, coverage)

            player_name = name_lookup.get(key)
            raw_obj = info.get("raw")
            if not player_name and raw_obj:
                player_name = _extract_player_name(raw_obj)

            game_id, player_id = None, None
            try:
                if key and ".p." in key:
                    game_id, pid = key.split(".p.")
                    player_id = int(pid)
            except Exception:
                pass

            batch.append({
                'player_key': key,
                'player_name': player_name,
                'player_id': player_id,
                'game_id': game_id,
                'season_start_year': season_start_year,
                'season_id': (season_row.get('id') or season_row.get('seasonId') or season_row.get('season_id')),
                'league_id': mapped_league_id,
                'ownership_date': week_end_iso,       # stamp weekly snapshot on WEEK_END
                'ownership_pct': float(value) if value is not None else None,
                'source': 'yahoo',
                'inserted_at': datetime.now(timezone.utc).isoformat(),
            })
            success += 1

        if LOG_MISSING_KEYS:
            missing_in_response = list(set(subkeys) - returned_keys)
            if missing_in_response:
                logging.info('Batch W%s: returned %d/%d; missing sample: %s',
                             week_no, len(returned_keys), len(subkeys),
                             missing_in_response[:MISSING_KEYS_LOG_LIMIT])

        if batch:
            upsert_batch(supabase, batch); batch.clear()
        _sleep(per_call_pause)
    return success

def ensure_full_coverage_for_week(
    supabase: Client,
    yq: YahooFantasySportsQuery,
    week_no: int,
    week_start: date,
    week_end: date,
    expected_keys_set: set[str],
    season_start_year: int,
    season_row: dict,
    mapped_league_id: str,
    current_max_keys: int,
    per_call_pause: float,
    name_lookup: dict[str, Optional[str]],
    max_sweeps: int = None
):
    if max_sweeps is None: max_sweeps = DEFAULT_MAX_SWEEPS_PER_WEEK
    week_end_iso = week_end.isoformat()

    existing = get_existing_player_keys_for_date(supabase, week_end_iso)
    expected = expected_keys_set
    sweep = 0

    while True:
        missing = list(expected - existing)
        if not missing:
            logging.info('Week %s (%s → %s) complete after sweep %d', week_no, week_start, week_end, sweep)
            telemetry_write({'type': 'week_complete', 'week': week_no, 'date': week_end_iso, 'sweeps': sweep})
            return

        if sweep >= max_sweeps:
            logging.error('Week %s (%s → %s) still missing %d players after %d sweeps', week_no, week_start, week_end, len(missing), sweep)
            telemetry_write({'type': 'week_incomplete', 'week': week_no, 'date': week_end_iso, 'missing': len(missing)})
            return

        sweep += 1
        logging.warning('Week %s still missing %d players after sweep %d; retrying...', week_no, len(missing), sweep)

        smaller = max(1, min(current_max_keys, 25 if sweep < 2 else 15 if sweep < 4 else 10))
        pause_more = max(per_call_pause, 0.8 if sweep < 3 else 1.2)

        _ = fetch_and_upsert_missing_for_week(
            supabase=supabase, yq=yq, week_no=week_no, week_end_iso=week_end_iso,
            missing_keys=missing, season_start_year=season_start_year, season_row=season_row,
            mapped_league_id=mapped_league_id, current_max_keys=smaller, per_call_pause=pause_more,
            name_lookup=name_lookup
        )
        existing = get_existing_player_keys_for_date(supabase, week_end_iso)

# ---------- Entrypoint ----------
def main(sample_player_limit: Optional[int] = None,
         sample_weeks_limit: Optional[int] = None,
         batch_size: int = 25,
         sleep_seconds: float = 0.5,
         resume: bool = True):
    supabase, bootstrap_yq = init_clients()

    season_row = get_second_most_recent_season(supabase)
    if not season_row:
        logging.error('Could not find second-most-recent season in seasons table')
        raise SystemExit(1)

    start_date = season_row.get('startDate'); end_date = season_row.get('regularSeasonEndDate') or season_row.get('endDate')
    if isinstance(start_date, str): start_date = datetime.fromisoformat(start_date).date()
    if isinstance(end_date, str):   end_date   = datetime.fromisoformat(end_date).date()
    logging.info('Using season from %s to %s', start_date, end_date)

    season_start_year = start_date.year
    game_id_prefix, mapped_league_id = get_game_id_for_season(supabase, season_start_year, default_league_id=bootstrap_yq.league_id)
    if not game_id_prefix:
        logging.error('Could not find yahoo_game_keys entry for season %s', season_start_year)
        raise SystemExit(1)
    logging.info('Mapped season %s -> game id prefix %s (league_id=%s)', season_start_year, game_id_prefix, mapped_league_id)

    # Season-bound client
    yq = init_yahoo_query_for(game_id_prefix, mapped_league_id)

    # Players
    rows = get_player_keys_for_game(supabase, game_id_prefix)
    if not rows:
        logging.error('No player keys found for game id prefix %s', game_id_prefix)
        raise SystemExit(1)
    if sample_player_limit: rows = rows[:sample_player_limit]
    player_keys = [rk for rk, _ in rows]
    name_lookup = {rk: nm for rk, nm in rows}
    logging.info('Expected players for game %s: %d', game_id_prefix, len(player_keys))

    # Batch & pacing knobs
    try: current_max_keys = int(os.getenv('YFPY_MAX_KEYS_PER_REQUEST', str(batch_size)))
    except Exception: current_max_keys = batch_size
    current_max_keys = max(1, min(25, current_max_keys))
    current_sleep_seconds = float(os.getenv('YHO_SLEEP_SECONDS', str(sleep_seconds)))

    # Weeks
    all_weeks = fetch_game_weeks(yq, game_id_prefix)  # list of (week_no, start, end)
    if not all_weeks:
        logging.error('Could not discover Yahoo game weeks for game %s', game_id_prefix)
        raise SystemExit(1)

    # Keep only weeks overlapping the season window
    weeks = [(w,s,e) for (w,s,e) in all_weeks if not (e < start_date or s > end_date)]
    if sample_weeks_limit: weeks = weeks[:sample_weeks_limit]
    logging.info('Will ingest %d weeks (from discovered %d)', len(weeks), len(all_weeks))

    # Resume mode: overwrite last stamped week_end we have, then continue
    if resume:
        try:
            resp = supabase.table('yahoo_player_ownership_daily').select('ownership_date').order('ownership_date', desc=True).limit(1).execute()
            if getattr(resp, 'data', None):
                most_recent_ds = resp.data[0].get('ownership_date')
                if isinstance(most_recent_ds, str):
                    logging.info('Most recent ownership_date in table: %s - will overwrite and continue', most_recent_ds)
                    try:
                        # Keep only weeks whose end date >= most_recent_ds
                        weeks = [(w,s,e) for (w,s,e) in weeks if e >= datetime.fromisoformat(most_recent_ds).date()]
                        # hard overwrite the last date to avoid duplicates
                        supabase.table('yahoo_player_ownership_daily').delete().eq('ownership_date', most_recent_ds).execute()
                        logging.info('Deleted rows for %s (fresh re-ingest of that week)', most_recent_ds)
                    except Exception as e:
                        logging.warning('Resume trim failed: %s', e)
        except Exception as e:
            logging.warning('Resume discovery failed: %s', e)

    expected_keys_set = set(player_keys)
    if not expected_keys_set:
        logging.error('No expected players; aborting.')
        raise SystemExit(1)

    # Process weeks
    incomplete = []
    for w, ws, we in weeks:
        logging.info('=== Ensuring completeness for WEEK %s (%s → %s) ===', w, ws, we)
        ensure_full_coverage_for_week(
            supabase=supabase, yq=yq, week_no=w, week_start=ws, week_end=we,
            expected_keys_set=expected_keys_set, season_start_year=season_start_year,
            season_row=season_row, mapped_league_id=mapped_league_id,
            current_max_keys=current_max_keys, per_call_pause=current_sleep_seconds,
            name_lookup=name_lookup, max_sweeps=DEFAULT_MAX_SWEEPS_PER_WEEK
        )
        existing_count = len(get_existing_player_keys_for_date(supabase, we.isoformat()))
        logging.info('Post-check W%s: %d/%d rows present', w, existing_count, len(expected_keys_set))
        if existing_count < len(expected_keys_set): incomplete.append((w, we.isoformat()))
        _sleep(current_sleep_seconds)

    # Straggler passes
    for pass_num in range(1, FINAL_STRAGGLER_PASSES + 1):
        if not incomplete: break
        logging.info('Revisiting %d incomplete weeks (pass %d/%d)...', len(incomplete), pass_num, FINAL_STRAGGLER_PASSES)
        still = []
        for w, week_end_iso in incomplete:
            # find week tuple
            match = next(((ww, ws, we) for (ww, ws, we) in weeks if ww == w), None)
            if not match: continue
            _, ws, we = match
            ensure_full_coverage_for_week(
                supabase=supabase, yq=yq, week_no=w, week_start=ws, week_end=we,
                expected_keys_set=expected_keys_set, season_start_year=season_start_year,
                season_row=season_row, mapped_league_id=mapped_league_id,
                current_max_keys=current_max_keys, per_call_pause=max(current_sleep_seconds, 1.0),
                name_lookup=name_lookup, max_sweeps=DEFAULT_MAX_SWEEPS_PER_WEEK
            )
            existing_count = len(get_existing_player_keys_for_date(supabase, week_end_iso))
            logging.info('Post-revisit W%s: %d/%d rows present', w, existing_count, len(expected_keys_set))
            if existing_count < len(expected_keys_set): still.append((w, week_end_iso))
            _sleep(current_sleep_seconds)
        incomplete = still

    if incomplete:
        logging.warning('Run finished with %d incomplete weeks: %s', len(incomplete), incomplete)
        telemetry_write({'type': 'run_incomplete_weeks', 'weeks': incomplete})
    else:
        logging.info('Run finished: all weeks complete.')

# ---------- CLI ----------
if __name__ == '__main__':
    sample_player_limit = int(os.getenv('YHO_SAMPLE_PLAYER_LIMIT', '0')) or None
    sample_weeks_limit  = int(os.getenv('YHO_SAMPLE_WEEKS_LIMIT', '0')) or None
    batch_size = int(os.getenv('YHO_BATCH_SIZE', '25'))
    sleep_seconds = float(os.getenv('YHO_SLEEP_SECONDS', '0.5'))
    resume_flag = bool(int(os.getenv('YHO_RESUME', '1')))

    logging.info('Starting WEEKLY ingestion with batch_size=%d, sleep_seconds=%.2f, resume=%s, '
                 'min_interval=%.2fs, max_calls_per_minute=%s, max_keys_per_request<=%d',
                 batch_size, sleep_seconds, resume_flag, _MIN_INTERVAL,
                 (_MAX_PER_MINUTE if _MAX_PER_MINUTE > 0 else 'disabled'),
                 int(os.getenv('YFPY_MAX_KEYS_PER_REQUEST', '25')))

    supabase, _ = init_clients()
    main(sample_player_limit=sample_player_limit,
         sample_weeks_limit=sample_weeks_limit,
         batch_size=batch_size,
         sleep_seconds=sleep_seconds,
         resume=resume_flag)
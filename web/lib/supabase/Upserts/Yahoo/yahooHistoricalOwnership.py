#!/usr/bin/env python3
"""Quick experiment: query Yahoo percent_owned by DATE for a small sample of players.

This mirrors the existing project auth wiring and uses yfpy's underlying query call to
ask for percent_owned;type=date;date=YYYY-MM-DD. It prints results and optionally
upserts to a table named `yahoo_player_percent_owned_history` if it exists.

Run: python web/lib/supabase/Upserts/Yahoo/yahooHistoricalOwnership.py
"""
import os
import logging
import time
import math
import random
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

from supabase import create_client, Client
from yfpy.query import YahooFantasySportsQuery
from yfpy.models import Player


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


def load_env_candidates():
    # Try a few sensible locations for .env.local used by other scripts
    repo_root = Path(__file__).resolve().parents[6]
    candidates = [
        repo_root / 'web' / ".env.local",
        Path.cwd() / 'web' / ".env.local",
        repo_root / ".env.local",
        Path.cwd() / ".env.local",
        Path(__file__).resolve().parents[4] / ".env.local",
    ]
    for p in candidates:
        try:
            if p.exists():
                load_dotenv(p)
                logging.info(f"Loaded env from {p}")
                return p
        except Exception:
            continue
    # fallback to default (already loaded into environment or via developer tools)
    logging.info("No .env.local found in candidates; relying on environment variables.")
    return None


# Optional manual overrides mapping season_start_year -> { game_id_prefix, league_id }
# Use this to force the correct Yahoo game and league IDs when Supabase rows don't match.
# Example: user-provided mapping:
# 2024 -> game_id 435 and league_id 105954 (for 2024-25 season),
# 2025 -> game_id 465 and league_id 858 (for 2025-26 season)
GAME_LEAGUE_OVERRIDES = {
    2024: {"game_id_prefix": "453", "league_id": "105954"},
    2025: {"game_id_prefix": "465", "league_id": "858"},
}


def init_clients():
    load_env_candidates()

    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not all([SUPABASE_URL, SUPABASE_KEY]):
        logging.error("Missing required Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        raise SystemExit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Yahoo credentials: prefer env, otherwise fetch from Supabase table yahoo_api_credentials
    YFPY_CONSUMER_KEY = os.getenv("YFPY_CONSUMER_KEY")
    YFPY_CONSUMER_SECRET = os.getenv("YFPY_CONSUMER_SECRET")
    YFPY_ACCESS_TOKEN = os.getenv("YFPY_ACCESS_TOKEN")
    YFPY_REFRESH_TOKEN = os.getenv("YFPY_REFRESH_TOKEN")

    if not (YFPY_CONSUMER_KEY and YFPY_CONSUMER_SECRET):
        try:
            creds = supabase.table('yahoo_api_credentials').select('consumer_key,consumer_secret,access_token,refresh_token').limit(1).single().execute()
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
        logging.error('Missing Yahoo consumer key/secret (env or Supabase). Cannot continue.')
        raise SystemExit(1)

    # Default game/league ids used elsewhere in repo; override via env if present
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

    # If we have saved access/refresh tokens from the credentials table, set them on the query instance
    try:
        if YFPY_ACCESS_TOKEN:
            yahoo_query._yahoo_access_token_dict = yahoo_query._get_dict_from_access_token_json({'access_token': YFPY_ACCESS_TOKEN, 'refresh_token': YFPY_REFRESH_TOKEN})
    except Exception:
        pass

    # Persist token data similar to other scripts (no-op if not relevant)
    try:
        yahoo_query.save_access_token_data_to_env_file(env_file_location=Path.cwd(), env_file_name='.env.local')
    except Exception:
        pass

    return supabase, yahoo_query


def get_player_percent_owned_by_date(yahoo_query: YahooFantasySportsQuery, player_key: str, date_str: str, explicit_league_id: str | None = None) -> Player:
    """Query percent_owned for a specific date. Returns a Player instance with percent_owned attribute.

    The Yahoo API requires the league key to match the player_key's game prefix. If the provided
    yahoo_query was constructed with a different game_id than the player_key prefix (e.g. player_key=453.p.xxx
    but yahoo_query is for game 465), the API will reject the request with "Multiple game keys". To avoid this,
    derive the game_id from player_key and create a short-lived YahooFantasySportsQuery with matching game_id.
    """
    # player_key format: <game_id>.p.<player_id>
    try:
        game_prefix = player_key.split('.p.')[0]
    except Exception:
        game_prefix = None

    if not game_prefix:
        # fallback to the original query's league key
        league_key = yahoo_query.get_league_key()
    else:
        # decide which league_id to use
        lid = explicit_league_id if explicit_league_id else yahoo_query.league_id
        # league key should be <game_id>.l.<league_id>
        league_key = f"{game_prefix}.l.{lid}"

    # Build the URL using the per-player league_key
    url = (
        f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_key}/players;"
        f"player_keys={player_key}/percent_owned;type=date;date={date_str}"
    )

    return yahoo_query.query(url, ["league", "players", "0", "player"], Player)


def fetch_player_percent_owned_with_retries(yahoo_query: YahooFantasySportsQuery, player_key: str, date_str: str, explicit_league_id: str | None = None, max_tries: int = 4):
    """Fetch percent_owned with retries and exponential backoff for transient Yahoo errors."""
    # improved retry/backoff with jitter
    base = 1.0
    max_tries = max(4, max_tries)
    for attempt in range(1, max_tries + 1):
        try:
            return get_player_percent_owned_by_date(yahoo_query, player_key, date_str, explicit_league_id=explicit_league_id)
        except Exception as e:
            msg = str(e)
            retryable = False
            try:
                low = msg.lower()
                retryable = ('rate limit' in low) or ('429' in low) or ('temporarily' in low) or ('try again later' in low) or ('timed out' in low) or ('connection' in low)
            except Exception:
                retryable = False

            logging.warning('Attempt %d/%d failed for %s on %s: %s', attempt, max_tries, player_key, date_str, e)
            if attempt == max_tries or not retryable:
                raise

            # If the failure looks like a Yahoo rate-limit on the first attempt,
            # back off for a longer conservative window (15 minutes) before trying again.
            # This prevents hammering the API when the service has signalled throttling.
            if attempt == 1 and retryable and ('rate limit' in low or '429' in low or 'try again later' in low or 'temporarily' in low):
                sleep_for = 15 * 60  # 15 minutes
                # small jitter so resumed requests across workers aren't perfectly aligned
                sleep_for += random.uniform(0, 30)
                logging.info('Rate-limit detected on first attempt for %s on %s; sleeping %.1fs before next try', player_key, date_str, sleep_for)
                time.sleep(sleep_for)
                continue

            # exponential backoff with jitter for normal retryable failures
            jitter = random.uniform(0, 0.75)
            sleep_for = base * (2 ** (attempt - 1)) + jitter
            logging.info('Retrying %s after %.2fs (attempt %d/%d)', player_key, sleep_for, attempt, max_tries)
            time.sleep(sleep_for)


def get_existing_player_keys_for_date(supabase: Client, date_str: str):
    """Return a set of player_keys that are already present in yahoo_player_ownership_history for date_str."""
    try:
        resp = supabase.table('yahoo_player_ownership_history').select('player_key').eq('ownership_date', date_str).execute()
        if hasattr(resp, 'data') and resp.data:
            return set(r['player_key'] for r in resp.data if 'player_key' in r)
    except Exception as e:
        logging.warning('Could not fetch existing ownership rows for %s: %s', date_str, e)
    return set()


def get_most_recent_ownership_date(supabase: Client):
    """Return the most recent ownership_date present in yahoo_player_ownership_history as a date object, or None."""
    try:
        resp = supabase.table('yahoo_player_ownership_history').select('ownership_date').order('ownership_date', desc=True).limit(1).execute()
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
        resp = supabase.table('yahoo_player_ownership_history').delete().eq('ownership_date', date_str).execute()
        logging.info('Deleted rows for date %s (response: %s)', date_str, getattr(resp, 'status_code', 'ok'))
    except Exception as e:
        logging.warning('Failed to delete rows for %s: %s', date_str, e)


def daterange(start_date, end_date):
    for n in range(int((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)


def get_second_most_recent_season(supabase: Client):
    # Fetch seasons ordered by startDate desc, take the 2nd entry
    resp = supabase.table('seasons').select('*').order('startDate', desc=True).range(1, 1).execute()
    if hasattr(resp, 'data') and resp.data:
        return resp.data[0]
    return None


def get_game_id_for_season(supabase: Client, season_start_year: int, default_league_id: str):
    # Check manual overrides first
    if season_start_year in GAME_LEAGUE_OVERRIDES:
        o = GAME_LEAGUE_OVERRIDES[season_start_year]
        return o['game_id_prefix'], o['league_id']

    # Try to find a yahoo_game_keys row for the given season year
    resp = supabase.table('yahoo_game_keys').select('game_id, game_key, season').eq('season', season_start_year).limit(1).execute()
    if hasattr(resp, 'data') and resp.data:
        row = resp.data[0]
        # prefer game_id if available
        game_id = str(row.get('game_id') or row.get('game_key'))
        return game_id, default_league_id
    # fallback to default league id and None game id
    return None, default_league_id


def get_player_keys_for_game(supabase: Client, game_id_prefix: str, limit: int = None):
    # Query yahoo_player_keys for keys starting with the game_id prefix
    query = supabase.table('yahoo_player_keys').select('player_key')
    query = query.like('player_key', f"{game_id_prefix}.%")
    if limit:
        resp = query.limit(limit).execute()
    else:
        # fetch up to 5000 rows in pages
        resp = query.execute()

    if hasattr(resp, 'data') and resp.data:
        return [r['player_key'] for r in resp.data if 'player_key' in r]
    return []


def upsert_ownership_batch(supabase: Client, records: list):
    if not records:
        return
    max_tries = 5
    base_sleep = 0.5
    for attempt in range(1, max_tries + 1):
        try:
            resp = supabase.table('yahoo_player_ownership_history').upsert(records).execute()
            if hasattr(resp, 'error') and resp.error:
                logging.warning('Upsert returned error (attempt %d/%d): %s', attempt, max_tries, resp.error)
                raise Exception(resp.error)
            else:
                logging.info('Upserted %d rows to yahoo_player_ownership_history', len(records))
                return
        except Exception as e:
            logging.warning('Upsert failed (attempt %d/%d): %s', attempt, max_tries, e)
            if attempt < max_tries:
                sleep_for = base_sleep * (2 ** (attempt - 1)) + (0.1 * attempt)
                logging.info('Retrying upsert after %.2fs', sleep_for)
                time.sleep(sleep_for)
            else:
                logging.error('Upsert permanently failed after %d attempts', max_tries)


def main(sample_player_limit: int | None = None, sample_dates_limit: int | None = None, batch_size: int = 25, sleep_seconds: float = 0.15, resume: bool = True):
    supabase, yahoo_query = init_clients()

    # 1) Find the 2nd-most-recent season
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

    # Map season to yahoo_game_keys via season start year
    season_start_year = start_date.year
    game_id_prefix, mapped_league_id = get_game_id_for_season(supabase, season_start_year, default_league_id=yahoo_query.league_id)
    if not game_id_prefix:
        logging.error('Could not find yahoo_game_keys entry for season %s', season_start_year)
        raise SystemExit(1)

    logging.info('Mapped season %s -> game id prefix %s (league_id=%s)', season_start_year, game_id_prefix, mapped_league_id)

    # Fetch player keys for that game
    player_keys = get_player_keys_for_game(supabase, game_id_prefix)
    if not player_keys:
        logging.error('No player keys found for game id prefix %s', game_id_prefix)
        raise SystemExit(1)

    logging.info('Found %d player keys; limiting to %s for this run', len(player_keys), sample_player_limit or 'ALL')
    player_keys = player_keys[:sample_player_limit]

    # Build list of dates
    all_dates = list(daterange(start_date, end_date))
    if sample_dates_limit:
        all_dates = all_dates[:sample_dates_limit]

    logging.info('Will iterate %d dates (sample limit=%s)', len(all_dates), sample_dates_limit)

    # If resume requested, check the most recent ownership_date and start from there (overwrite that date)
    if resume:
        most_recent = get_most_recent_ownership_date(supabase)
        if most_recent:
            # start at the most recent date to overwrite it, then proceed to later dates
            logging.info('Most recent ownership_date in table: %s - will overwrite that date and continue', most_recent)
            # find index in all_dates
            try:
                start_index = all_dates.index(most_recent)
                # delete existing rows for that date so we re-ingest fresh
                delete_rows_for_date(supabase, most_recent.isoformat())
                # slice all_dates to start from that date
                all_dates = all_dates[start_index:]
            except ValueError:
                # if the date isn't in the range (odd), continue from the beginning
                logging.info('Most recent date %s not in season range; starting from season start.', most_recent)

    # Iterate dates and players, processing players in fixed chunks per date
    for d in all_dates:
        date_str = d.strftime('%Y-%m-%d')
        logging.info('Processing date %s', date_str)

        # If resuming, fetch already processed player_keys for this date and skip them
        existing_keys = set()
        if resume:
            existing_keys = get_existing_player_keys_for_date(supabase, date_str)
            if existing_keys:
                logging.info('Found %d existing ownership rows for %s; will skip', len(existing_keys), date_str)

        # iterate player keys in chunks of batch_size
        total_players = len(player_keys)
        for i in range(0, total_players, batch_size):
            chunk = player_keys[i:i+batch_size]
            logging.info('Processing players %d-%d of %d for date %s', i+1, min(i+batch_size, total_players), total_players, date_str)
            batch = []
            success_count = 0
            failure_count = 0
            for key in chunk:
                if key in existing_keys:
                    logging.debug('Skipping already-processed %s for date %s', key, date_str)
                    continue
                try:
                    player_on_date = fetch_player_percent_owned_with_retries(yahoo_query, key, date_str, explicit_league_id=mapped_league_id)
                    po = getattr(player_on_date, 'percent_owned', None)
                    value = getattr(po, 'value', None) if po else None

                    # derive player_id and game_id from player_key (format: <game_id>.p.<player_id>)
                    try:
                        game_part, pid_part = key.split('.p.')
                        derived_game_id = game_part
                        derived_player_id = int(pid_part)
                    except Exception:
                        derived_game_id = None
                        derived_player_id = None

                    # try to extract display name
                    try:
                        name_obj = getattr(player_on_date, 'name', None)
                        player_name = name_obj.full if (name_obj and hasattr(name_obj, 'full')) else str(name_obj)
                    except Exception:
                        player_name = None

                    rec = {
                        'player_key': key,
                        'player_name': player_name,
                        'player_id': derived_player_id,
                        'game_id': derived_game_id,
                        'season_start_year': season_start_year,
                        'season_id': season_row.get('seasonId') if season_row and 'seasonId' in season_row else None,
                        'league_id': mapped_league_id,
                        'ownership_date': date_str,
                        'ownership_pct': float(value) if value is not None else None,
                        'source': 'yahoo',
                        'inserted_at': datetime.utcnow().isoformat(),
                    }
                    batch.append(rec)
                    success_count += 1
                except Exception as e:
                    logging.warning('Error fetching %s for %s: %s', key, date_str, e)
                    failure_count += 1

            # upsert this chunk
            if batch:
                upsert_ownership_batch(supabase, batch)
            logging.info('Chunk complete for date %s: success=%d failure=%d', date_str, success_count, failure_count)
            # If this chunk had many failures, escalate pause to avoid further rate limits
            total = success_count + failure_count
            if total > 0 and (failure_count / total) > 0.4:
                extra = min(60, sleep_seconds * 10)
                logging.warning('High failure rate (%.0f%%) in chunk for %s; sleeping extra %.1fs before continuing', 100.0 * (failure_count / total), date_str, extra)
                time_sleep(extra)
            # pause between chunks to respect rate limits
            time_sleep(sleep_seconds)

        # small pause between dates to avoid hammering API
        time_sleep(sleep_seconds)


def time_sleep(seconds: float):
    try:
        import time
        time.sleep(seconds)
    except Exception:
        pass


if __name__ == '__main__':
    # Safe defaults for a full run. Adjust via environment variables if needed:
    # YHO_SAMPLE_PLAYER_LIMIT (int), YHO_SAMPLE_DATES_LIMIT (int), YHO_BATCH_SIZE (int), YHO_SLEEP_SECONDS (float), YHO_RESUME (1/0)
    sample_player_limit = int(os.getenv('YHO_SAMPLE_PLAYER_LIMIT', '0')) or None
    sample_dates_limit = int(os.getenv('YHO_SAMPLE_DATES_LIMIT', '0')) or None
    batch_size = int(os.getenv('YHO_BATCH_SIZE', '25'))
    sleep_seconds = float(os.getenv('YHO_SLEEP_SECONDS', '0.5'))
    resume_flag = bool(int(os.getenv('YHO_RESUME', '1')))

    logging.info('Starting full ingestion with batch_size=%d, sleep_seconds=%.2f, resume=%s', batch_size, sleep_seconds, resume_flag)
    main(sample_player_limit=sample_player_limit, sample_dates_limit=sample_dates_limit, batch_size=batch_size, sleep_seconds=sleep_seconds, resume=resume_flag)

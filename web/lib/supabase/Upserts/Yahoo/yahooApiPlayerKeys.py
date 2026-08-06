#!/usr/bin/env python3

import os
import time
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

from yfpy.query import YahooFantasySportsQuery

# -----------------------------------------------------------------------------
# CONFIG & ENV
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

LEGACY_WRITER_FLAG = "YAHOO_LEGACY_PYTHON_WRITER_ENABLED"


def _load_environment():
    """Load only an explicitly selected local env file or the current directory."""
    env_file = os.getenv("YFPY_ENV_FILE") or os.getenv("YAHOO_ENV_FILE")
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv()
        load_dotenv(".env.local")


def _required_config():
    required = {
        "NEXT_PUBLIC_SUPABASE_URL": os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "YFPY_CONSUMER_KEY": os.getenv("YFPY_CONSUMER_KEY"),
        "YFPY_CONSUMER_SECRET": os.getenv("YFPY_CONSUMER_SECRET"),
        "YFPY_GAME_ID": os.getenv("YFPY_GAME_ID") or os.getenv("YAHOO_GAME_ID"),
        "YFPY_LEAGUE_ID": os.getenv("YFPY_LEAGUE_ID") or os.getenv("YAHOO_LEAGUE_ID"),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "Legacy Yahoo player-key maintenance configuration is incomplete: "
            + ", ".join(missing)
        )
    return required


def _env_file_location():
    configured = os.getenv("YFPY_ENV_FILE_LOCATION") or os.getenv(
        "YAHOO_ENV_FILE_LOCATION"
    )
    return Path(configured).expanduser() if configured else Path.cwd()

# -----------------------------------------------------------------------------
# FETCH & UPSERT ALL PLAYER KEYS
# -----------------------------------------------------------------------------
def fetch_all_player_keys(yahoo_query):
    """
    Fetch all players via large-batch pagination, then return
    a list of records for upserting to yahoo_player_keys.
    """
    logging.info("Fetching all player keys from Yahoo...")

    all_players = []
    player_count_start = 0
    player_batch_limit = 2000  # Big batch size

    while True:
        players = yahoo_query.get_league_players(
            player_count_limit=player_batch_limit,
            player_count_start=player_count_start
        )
        fetched_count = len(players)
        logging.info(f"Fetched {fetched_count} players at offset {player_count_start}")

        if not players:
            break

        all_players.extend(players)
        player_count_start += fetched_count

        if fetched_count < player_batch_limit:
            # Likely no more players
            break

        time.sleep(1)  # Respect rate limit if needed

    logging.info(f"Total players fetched: {len(all_players)}")

    # Convert to upsert-ready dicts
    records = []
    for p in all_players:
        data = p.__dict__
        key = data.get("player_key")
        pid = data.get("player_id")
        name_obj = data.get("name")
        full_name = getattr(name_obj, "full", None) if name_obj else None

        if key:
            records.append({
                "player_key": key,
                "player_id": pid,
                "player_name": full_name,
                "last_updated": datetime.now().isoformat()
            })

    return records

def upsert_player_keys(supabase: Client, records):
    """
    Upsert the list of player-key records into the yahoo_player_keys table.
    """
    if not records:
        logging.info("No player-key records to upsert.")
        return

    try:
        resp = supabase.table("yahoo_player_keys").upsert(records).execute()
        if hasattr(resp, "error") and resp.error:
            logging.error(f"Error upserting yahoo_player_keys: {resp.error}")
        else:
            logging.info("Successfully upserted player keys into 'yahoo_player_keys'.")
    except Exception as e:
        logging.error(f"Exception while upserting to yahoo_player_keys: {e}")

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main():
    if os.getenv(LEGACY_WRITER_FLAG) != "1":
        logging.info(
            "Legacy Yahoo player-key maintenance is disabled; set %s=1 for "
            "an explicitly authorized run.",
            LEGACY_WRITER_FLAG,
        )
        return

    _load_environment()
    config = _required_config()
    supabase: Client = create_client(
        config["NEXT_PUBLIC_SUPABASE_URL"],
        config["SUPABASE_SERVICE_ROLE_KEY"],
    )
    yahoo_query = YahooFantasySportsQuery(
        league_id=config["YFPY_LEAGUE_ID"],
        game_code="nhl",
        game_id=config["YFPY_GAME_ID"],
        yahoo_consumer_key=config["YFPY_CONSUMER_KEY"],
        yahoo_consumer_secret=config["YFPY_CONSUMER_SECRET"],
        save_token_data_to_env_file=False,
        env_file_location=_env_file_location(),
    )
    start_time = datetime.now()

    # Fetch all players from Yahoo & build records
    records = fetch_all_player_keys(yahoo_query)

    # Upsert into yahoo_player_keys table
    upsert_player_keys(supabase, records)

    # Timer
    elapsed = datetime.now() - start_time
    minutes = int(elapsed.total_seconds() // 60)
    seconds = elapsed.total_seconds() % 60
    logging.info(f"Completed in {minutes} min {seconds:.2f} sec.")

if __name__ == "__main__":
    main()

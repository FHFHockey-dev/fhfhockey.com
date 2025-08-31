#!/usr/bin/env python3



import os
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

ENV_FILE = "/Users/tim/Desktop/FHFH/fhfhockey.com/web/.env.local"
load_dotenv(ENV_FILE)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
YFPY_CONSUMER_KEY = os.getenv('YFPY_CONSUMER_KEY')
YFPY_CONSUMER_SECRET = os.getenv('YFPY_CONSUMER_SECRET')

if not all([SUPABASE_URL, SUPABASE_KEY, YFPY_CONSUMER_KEY, YFPY_CONSUMER_SECRET]):
    logging.error("Missing one or more required environment variables.")
    exit(1)

# Yahoo API constants
GAME_ID = '465'
LEAGUE_ID = '858'
ENV_FILE_LOCATION = Path("/Users/tim/Desktop/FHFH/fhfhockey.com/web/")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# FUNCTIONS
# -----------------------------------------------------------------------------
def build_rows_from_games(games):
    """Builds rows for the yahoo_game_keys table."""
    rows = []
    for game in games:
        pdata = game.__dict__

        # Convert stat_categories to a JSON-serializable dict.
        sc = pdata.get("stat_categories")
        if sc and hasattr(sc, "serialized"):
            stat_categories = sc.serialized()
        elif sc and hasattr(sc, "_extracted_data"):
            stat_categories = sc._extracted_data
        elif isinstance(sc, dict):
            stat_categories = sc
        else:
            stat_categories = None

        row = {
            "game_id": pdata.get("game_id"),
            "game_key": pdata.get("game_key"),  # Not NULL in table
            "name": pdata.get("name"),
            "code": pdata.get("code"),
            "type": pdata.get("type"),
            "url": pdata.get("url"),
            "season": pdata.get("season"),
            "is_registration_over": pdata.get("is_registration_over"),
            "is_game_over": pdata.get("is_game_over"),
            "is_offseason": pdata.get("is_offseason"),
            "contest_group_id": pdata.get("contest_group_id"),
            "current_week": pdata.get("current_week"),
            "editorial_season": pdata.get("editorial_season"),
            "game_weeks": [],  # Placeholder (will be updated in second pass)
            "has_schedule": pdata.get("has_schedule"),
            "is_contest_over": pdata.get("is_contest_over"),
            "is_contest_reg_active": pdata.get("is_contest_reg_active"),
            "is_live_draft_lobby_active": pdata.get("is_live_draft_lobby_active"),
            "leagues": pdata.get("leagues") or [],
            "picks_status": pdata.get("picks_status"),
            "players": pdata.get("players") or [],
            "position_types": pdata.get("position_types") or [],
            "roster_positions": pdata.get("roster_positions") or [],
            "scenario_generator": pdata.get("scenario_generator"),
            "stat_categories": stat_categories,
            "teams": pdata.get("teams") or [],
            "last_updated": datetime.now().isoformat()
        }
        rows.append(row)
    return rows

def update_game_weeks(yahoo_query, game_map):
    """
    Fetches game weeks for each game_id and updates the table by upserting
    both game_id (PK) and the not-null game_key.
    
    game_map = { <game_id>: <game_key> }
    """
    updates = []
    
    for game_id, game_key in game_map.items():
        game_weeks = yahoo_query.get_game_weeks_by_game_id(game_id)

        if isinstance(game_weeks, list):
            # Expect a list of GameWeek objects
            game_weeks_serialized = []
            for gw in game_weeks:
                if hasattr(gw, "__dict__"):
                    game_weeks_serialized.append(gw.__dict__)
                else:
                    # fallback if gw is not a custom object
                    game_weeks_serialized.append(gw)

            updates.append({
                "game_id": game_id,         # must include for primary key
                "game_key": game_key,       # must include because it's NOT NULL
                "game_weeks": game_weeks_serialized,
                "last_updated": datetime.now().isoformat()
            })
            logging.info(
                f"Fetched {len(game_weeks_serialized)} game weeks for game_id={game_id}."
            )
        else:
            # Not the expected format - maybe a string or None
            logging.warning(
                f"game_id={game_id} returned unexpected type ({type(game_weeks)}). "
                "Storing empty list."
            )
            updates.append({
                "game_id": game_id,
                "game_key": game_key,
                "game_weeks": [],
                "last_updated": datetime.now().isoformat()
            })
    
    # Upsert into `yahoo_game_keys` table
    if updates:
        response = supabase.table("yahoo_game_keys").upsert(updates).execute()
        if hasattr(response, "error") and response.error:
            logging.error(f"Failed to update game_weeks: {response.error}")
        else:
            logging.info(f"Updated game_weeks for {len(updates)} games.")

# -----------------------------------------------------------------------------
# MAIN LOGIC
# -----------------------------------------------------------------------------
def main():
    # Initialize YahooFantasySportsQuery
    yahoo_query = YahooFantasySportsQuery(
        league_id=LEAGUE_ID,
        game_code="nhl",
        game_id=GAME_ID,
        yahoo_consumer_key=YFPY_CONSUMER_KEY,
        yahoo_consumer_secret=YFPY_CONSUMER_SECRET,
        save_token_data_to_env_file=False,
        env_file_location=ENV_FILE_LOCATION
    )

    # 1) Fetch all game keys (list of Game objects)
    games = yahoo_query.get_all_yahoo_fantasy_game_keys()
    logging.info(f"Fetched {len(games)} games in total.")

    # 2) Build initial rows for upsert
    rows = build_rows_from_games(games)
    logging.info(f"Prepared {len(rows)} game records for upsert.")

    # 3) Upsert initial game data (including game_key, which is NOT NULL)
    response = supabase.table("yahoo_game_keys").upsert(rows).execute()
    if hasattr(response, "error") and response.error:
        logging.error(f"Failed to upsert yahoo_game_keys: {response.error}")
        return
    logging.info(f"Upserted {len(rows)} game records into 'yahoo_game_keys'.")

    # 4) Fetch both game_id + game_key from Supabase
    game_keys_response = supabase.table("yahoo_game_keys").select("game_id, game_key").execute()
    if hasattr(game_keys_response, "data") and game_keys_response.data:
        # Build a dict: { game_id: game_key } 
        # so we can provide both columns in the second pass
        game_map = {
            record["game_id"]: record["game_key"] 
            for record in game_keys_response.data
            if record["game_id"] is not None and record["game_key"] is not None
        }
        logging.info(f"Fetched {len(game_map)} (game_id, game_key) pairs from Supabase.")
    else:
        logging.error("Failed to retrieve game keys from Supabase.")
        return

    # 5) Fetch and update the game weeks (with both ID + KEY included)
    update_game_weeks(yahoo_query, game_map)

if __name__ == "__main__":
    main()
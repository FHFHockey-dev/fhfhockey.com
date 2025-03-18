#!/usr/bin/env python3
# /Users/tim/Desktop/FHFH/fhfhockey.com/web/lib/supabase/Upserts/Yahoo/yahooAPI.py

import os
import time
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm
from supabase import create_client, Client

from yfpy.query import YahooFantasySportsQuery
from yfpy.models import DraftAnalysis

# -----------------------------------------------------------------------------
# CUSTOM SUBCLASS: MyYahooQuery
# -----------------------------------------------------------------------------
class MyYahooQuery(YahooFantasySportsQuery):
    """
    A custom subclass that can fetch multiple players at once via
    a single request to the Yahoo Fantasy API.
    """
    def get_multiple_players(self, player_keys, subresources=None):
        """
        GET player data from Yahoo.
        
        For debugging, we construct the URL using only the first player key.
        (The original approach joined all keys with commas.)
        """
        # For debugging, use a single key (remove this line to revert to multi-key requests)
        single_key = player_keys[0]
        resource_path = f"players;player_keys={single_key}"
        if subresources:
            resource_path += f";out={','.join(subresources)}"
        url = f"https://fantasysports.yahooapis.com/fantasy/v2/{resource_path}"
        print("Constructed URL (single key):", url)  # Debug print
        
        # Execute the query and print the raw returned data
        data = self.query(url, ["players"])
        print("Raw data returned for key", single_key, ":", data)  # Debug print
        
        # Wrap the data in a list if it isn't already
        if isinstance(data, list):
            return data
        else:
            return [data]

# -----------------------------------------------------------------------------
# CONFIG & ENV SETUP
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
    logging.error("Missing environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Yahoo API constants
GAME_ID = '453'
LEAGUE_ID = '105954'
ENV_FILE_LOCATION = Path("/Users/tim/Desktop/FHFH/fhfhockey.com/web/")

# -----------------------------------------------------------------------------
# INIT YFPY (Custom) QUERY INSTANCE
# -----------------------------------------------------------------------------
yahoo_query = MyYahooQuery(
    league_id=LEAGUE_ID,
    game_code="nhl",
    game_id=GAME_ID,
    yahoo_consumer_key=YFPY_CONSUMER_KEY,
    yahoo_consumer_secret=YFPY_CONSUMER_SECRET,
    save_token_data_to_env_file=False,
    env_file_location=ENV_FILE_LOCATION
)

# Save token data (if applicable)
yahoo_query.save_access_token_data_to_env_file(
    env_file_location=ENV_FILE_LOCATION,
    env_file_name='.env.local'
)

# -----------------------------------------------------------------------------
# FETCHING PLAYER KEYS FROM SUPABASE IN PAGES OF 1000
# -----------------------------------------------------------------------------
def get_player_keys_from_supabase():
    """
    Retrieve all player keys from 'yahoo_player_keys' via Supabase in increments
    of 1000, since that's Supabase's default maximum per request.
    Returns a list of all player_key strings.
    """
    logging.info("Fetching all player keys from Supabase...")
    all_keys = []
    page_size = 1000
    start = 0

    while True:
        resp = supabase.table("yahoo_player_keys") \
                       .select("*") \
                       .range(start, start + page_size - 1) \
                       .execute()
        data = resp.data
        if not data:
            break

        for row in data:
            if "player_key" in row and row["player_key"]:
                all_keys.append(row["player_key"])

        fetched = len(data)
        logging.info(f"Fetched {fetched} keys from offset {start}")
        start += page_size

        if fetched < page_size:
            break

    logging.info(f"Total keys fetched from Supabase: {len(all_keys)}")
    return all_keys

# -----------------------------------------------------------------------------
# BUILD ROWS FROM A PLAYERS BATCH
# -----------------------------------------------------------------------------
def build_rows_from_batch(players_batch):
    """
    Given a list of YFPY Player objects, build a list of rows (dicts)
    matching the schema of the 'yahoo_players' table.
    """
    rows = []
    for player in players_batch:
        pdata = player.__dict__

        # Extract name fields
        name_obj = pdata.get("name")
        full_name = getattr(name_obj, "full", None) if name_obj else None

        # Extract draft analysis data
        da = pdata.get("draft_analysis")
        if da and isinstance(da, DraftAnalysis):
            average_draft_pick = float(da.average_pick)
            average_draft_round = float(da.average_round)
            average_draft_cost = float(da.average_cost)
            percent_drafted = float(da.percent_drafted)
        else:
            average_draft_pick = 0.0
            average_draft_round = 0.0
            average_draft_cost = 0.0
            percent_drafted = 0.0

        # Extract percent ownership
        percent_owned_obj = pdata.get("percent_owned")
        if percent_owned_obj and isinstance(percent_owned_obj, dict):
            percent_owned_value = float(percent_owned_obj.get("value", 0) or 0)
        else:
            percent_owned_value = 0.0
        percent_ownership = percent_owned_value

        # Process eligible positions
        eligible_positions = pdata.get("eligible_positions")
        if eligible_positions is None:
            eligible_positions = []
        if isinstance(eligible_positions, dict):
            eligible_positions = [eligible_positions.get("position")]

        # Extract headshot URL
        headshot_obj = pdata.get("headshot")
        headshot_url = headshot_obj.url if headshot_obj and hasattr(headshot_obj, "url") else None

        # Convert uniform number
        uniform_num = pdata.get("uniform_number")
        try:
            uniform_number = int(uniform_num) if uniform_num is not None else None
        except (ValueError, TypeError):
            uniform_number = None

        row = {
            "player_key": pdata.get("player_key"),
            "player_id": str(pdata.get("player_id", "")),
            "player_name": full_name,
            "draft_analysis": da._extracted_data if da and hasattr(da, "_extracted_data") else {},
            "average_draft_pick": average_draft_pick,
            "average_draft_round": average_draft_round,
            "average_draft_cost": average_draft_cost,
            "percent_drafted": percent_drafted,
            "editorial_player_key": pdata.get("editorial_player_key"),
            "editorial_team_abbreviation": pdata.get("editorial_team_abbr"),
            "editorial_team_full_name": pdata.get("editorial_team_full_name"),
            "eligible_positions": eligible_positions,
            "display_position": pdata.get("display_position"),
            "headshot_url": headshot_url,
            "injury_note": pdata.get("injury_note"),
            "full_name": full_name,
            "percent_ownership": percent_ownership,
            "percent_owned_value": percent_owned_value,
            "position_type": pdata.get("position_type"),
            "status": pdata.get("status"),
            "status_full": pdata.get("status_full"),
            "last_updated": datetime.now().isoformat(),
            "uniform_number": uniform_number
        }
        rows.append(row)
    return rows

# -----------------------------------------------------------------------------
# MAIN LOGIC
# -----------------------------------------------------------------------------
def main():
    start_time = datetime.now()

    # 1) Fetch all player keys from Supabase in pages of 1000
    all_player_keys = get_player_keys_from_supabase()
    if not all_player_keys:
        logging.info("No player keys found. Exiting.")
        return

    # 2) Define the subresources to request from Yahoo
    subresources = ["draft_analysis", "percent_owned"]

    # 3) Fetch players (for debugging, we use a single key per request)
    all_rows = []   # Accumulate all rows for upsert later
    logging.info("Fetching players (one key at a time) from Yahoo...")

    for key in all_player_keys:
        logging.info(f"Processing player key: {key}")
        players_batch = yahoo_query.get_multiple_players([key], subresources=subresources)
        logging.info(f"Data returned for {key}: {players_batch}")
        batch_rows = build_rows_from_batch(players_batch)
        all_rows.extend(batch_rows)
        time.sleep(0.5)  # Respect rate limits

    # 4) Perform a single upsert with all records
    if all_rows:
        try:
            response = supabase.table("yahoo_players").upsert(all_rows).execute()
            if hasattr(response, "error") and response.error:
                logging.error(f"Failed to upsert yahoo_players: {response.error}")
            else:
                logging.info(f"Upserted {len(all_rows)} player records into 'yahoo_players'.")
        except Exception as e:
            logging.error(f"Exception upserting players: {e}")
    else:
        logging.info("No rows to upsert.")

    elapsed = datetime.now() - start_time
    minutes = int(elapsed.total_seconds() // 60)
    seconds = elapsed.total_seconds() % 60
    logging.info(f"Completed in {minutes} min {seconds:.2f} sec.")

if __name__ == "__main__":
    main()
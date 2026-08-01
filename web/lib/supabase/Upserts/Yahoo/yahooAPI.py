#!/usr/bin/env python3
# Opt-in compatibility writer. The scheduled TypeScript route remains canonical.

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
        For efficiency, construct multi-player requests by joining player keys with commas.
        If the list is large, break into chunks controlled by env var YFPY_MAX_KEYS_PER_REQUEST
        (default 25) to avoid overly long URLs.
        """
        max_keys = int(os.getenv('YFPY_MAX_KEYS_PER_REQUEST', '25'))
        if not player_keys:
            return []

        # Helper to build URL for a list of keys
        def _build_url(keys_subset):
            resource_path = f"players;player_keys={','.join(keys_subset)}"
            if subresources:
                resource_path += f";out={','.join(subresources)}"
            return f"https://fantasysports.yahooapis.com/fantasy/v2/{resource_path}"

        results = []
        # Chunk keys if larger than max_keys
        for i in range(0, len(player_keys), max_keys):
            chunk = player_keys[i:i+max_keys]
            url = _build_url(chunk)
            logging.info('Querying Yahoo for %d players (keys %d-%d)', len(chunk), i+1, i+len(chunk))
            try:
                data = self.query(url, ["players"])
                # Ensure returned data is iterable; wrap single objects
                if isinstance(data, list):
                    results.extend(data)
                else:
                    results.append(data)
            except Exception as e:
                logging.warning('Failed to fetch players for keys %d-%d: %s', i+1, i+len(chunk), e)
                # propagate the exception so callers can decide to retry
                raise

        return results

# -----------------------------------------------------------------------------
# CONFIG & ENV SETUP
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# -----------------------------------------------------------------------------
# FETCHING PLAYER KEYS FROM SUPABASE IN PAGES OF 1000
# -----------------------------------------------------------------------------
def get_player_keys_from_supabase(supabase: Client, game_id: str):
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
                       .select("player_key") \
                       .like("player_key", f"{game_id}.%") \
                       .order("player_key") \
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
def _optional_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_percent_owned(percent_owned):
    if isinstance(percent_owned, list):
        for item in percent_owned:
            if isinstance(item, dict) and (
                item.get("value") is not None or item.get("Value") is not None
            ):
                return _optional_float(item.get("value", item.get("Value")))
        return None
    if isinstance(percent_owned, dict):
        return _optional_float(
            percent_owned.get("value", percent_owned.get("Value"))
        )
    return _optional_float(percent_owned)


def build_rows_from_batch(
    players_batch,
    current_date: str,
    game_id: str,
    season: int,
):
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
            average_draft_pick = _optional_float(da.average_pick)
            average_draft_round = _optional_float(da.average_round)
            average_draft_cost = _optional_float(da.average_cost)
            percent_drafted = _optional_float(da.percent_drafted)
        else:
            average_draft_pick = None
            average_draft_round = None
            average_draft_cost = None
            percent_drafted = None

        # Extract percent ownership
        percent_ownership = _extract_percent_owned(pdata.get("percent_owned"))

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
            "draft_analysis": da._extracted_data if da and hasattr(da, "_extracted_data") else None,
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
            "snapshot_status": "observed" if percent_ownership is not None else "omitted",
            "game_id": game_id,
            "season": season,
            "position_type": pdata.get("position_type"),
            "status": pdata.get("status"),
            "status_full": pdata.get("status_full"),
            "last_updated": datetime.now().isoformat(),
            "uniform_number": uniform_number,
            "current_date": current_date,
        }
        rows.append(row)
    return rows

# -----------------------------------------------------------------------------
# MAIN LOGIC
# -----------------------------------------------------------------------------
def main():
    start_time = datetime.now()

    if os.getenv("YAHOO_PLAYER_MAINTENANCE_WRITE_ENABLED") != "1":
        logging.info(
            "Yahoo player maintenance is disabled; set "
            "YAHOO_PLAYER_MAINTENANCE_WRITE_ENABLED=1 to run."
        )
        return

    load_dotenv()
    required = {
        "NEXT_PUBLIC_SUPABASE_URL": os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "YFPY_CONSUMER_KEY": os.getenv("YFPY_CONSUMER_KEY"),
        "YFPY_CONSUMER_SECRET": os.getenv("YFPY_CONSUMER_SECRET"),
        "YAHOO_GAME_ID": os.getenv("YAHOO_GAME_ID"),
        "YAHOO_LEAGUE_ID": os.getenv("YAHOO_LEAGUE_ID"),
        "YAHOO_SEASON": os.getenv("YAHOO_SEASON"),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "Yahoo player maintenance configuration is incomplete."
        )

    game_id = str(required["YAHOO_GAME_ID"])
    league_id = str(required["YAHOO_LEAGUE_ID"])
    season = int(str(required["YAHOO_SEASON"]))
    supabase: Client = create_client(
        str(required["NEXT_PUBLIC_SUPABASE_URL"]),
        str(required["SUPABASE_SERVICE_ROLE_KEY"]),
    )
    yahoo_query = MyYahooQuery(
        league_id=league_id,
        game_code="nhl",
        game_id=game_id,
        yahoo_consumer_key=str(required["YFPY_CONSUMER_KEY"]),
        yahoo_consumer_secret=str(required["YFPY_CONSUMER_SECRET"]),
        save_token_data_to_env_file=False,
        env_file_location=Path(
            os.getenv("YAHOO_ENV_FILE_LOCATION", str(Path.cwd()))
        ),
    )

    # 1) Fetch all player keys from Supabase in pages of 1000
    all_player_keys = get_player_keys_from_supabase(supabase, game_id)
    if not all_player_keys:
        logging.info("No player keys found. Exiting.")
        return

    # 2) Define the subresources to request from Yahoo
    subresources = ["draft_analysis", "percent_owned"]

    # 3) Any provider failure aborts before persistence so a partial snapshot
    # cannot masquerade as complete.
    all_rows = []
    current_date = datetime.now().date().isoformat()
    provider_batch_size = int(os.getenv("YFPY_MAX_KEYS_PER_REQUEST", "25"))
    logging.info("Fetching %d Yahoo player keys.", len(all_player_keys))

    for start in range(0, len(all_player_keys), provider_batch_size):
        keys = all_player_keys[start:start + provider_batch_size]
        players_batch = yahoo_query.get_multiple_players(
            keys,
            subresources=subresources,
        )
        batch_rows = build_rows_from_batch(
            players_batch,
            current_date,
            game_id,
            season,
        )
        all_rows.extend(batch_rows)
        time.sleep(0.5)

    # 4) Use the same fail-closed atomic writer as the canonical TypeScript route.
    if all_rows:
        rpc_batch_size = 500
        for start in range(0, len(all_rows), rpc_batch_size):
            rows = all_rows[start:start + rpc_batch_size]
            response = supabase.rpc(
                "upsert_yahoo_players_atomic",
                {"players_data": rows},
            ).execute()
            receipt = response.data
            if not isinstance(receipt, dict) or receipt.get("processed") != len(rows):
                raise RuntimeError(
                    "Yahoo atomic writer returned an invalid receipt."
                )
        logging.info(
            "Persisted %d Yahoo player rows through the atomic writer.",
            len(all_rows),
        )
    else:
        logging.info("No rows to upsert.")

    elapsed = datetime.now() - start_time
    minutes = int(elapsed.total_seconds() // 60)
    seconds = elapsed.total_seconds() % 60
    logging.info(f"Completed in {minutes} min {seconds:.2f} sec.")

if __name__ == "__main__":
    main()

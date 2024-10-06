# C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\lib\supabase\yahooAPI.py

import os
import time
import logging
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
from yfpy.query import YahooFantasySportsQuery
from yfpy.models import YahooFantasyObject, DraftAnalysis, PercentOwned, Ownership  # Import relevant models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables from .env.local
load_dotenv('C:/Users/timbr/Desktop/FHFH/fhfhockey.com-3/web/.env.local')

# Constants from environment variables
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
YFPY_CONSUMER_KEY = os.getenv('YFPY_CONSUMER_KEY')
YFPY_CONSUMER_SECRET = os.getenv('YFPY_CONSUMER_SECRET')

# Validate environment variables
if not all([SUPABASE_URL, SUPABASE_KEY, YFPY_CONSUMER_KEY, YFPY_CONSUMER_SECRET]):
    logging.error("One or more environment variables are missing. Please check your .env.local file.")
    exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Yahoo API Constants
GAME_ID = '453'  # Update this with your actual game ID
LEAGUE_ID = '105954'  # Update this with your actual league ID

# Initialize YahooFantasySportsQuery
auth_dir = 'C:/Users/timbr/Desktop/FHFH/fhfhockey.com-3/web/lib/supabase/Upserts/yahooAuth'
yahoo_query = YahooFantasySportsQuery(
    auth_dir=auth_dir,
    league_id=LEAGUE_ID,
    game_code="nhl",
    game_id=GAME_ID,
    consumer_key=YFPY_CONSUMER_KEY,
    consumer_secret=YFPY_CONSUMER_SECRET
)

# Function to upsert a single player to Supabase
def upsert_players_batch(players_batch: list):
    try:
        response = supabase.table('yahoo_players').upsert(players_batch).execute()
        
        # Check if 'error' attribute exists and is not None
        if hasattr(response, 'error') and response.error is not None:
            logging.error(f"Failed to upsert batch. Error: {response.error}")
        else:
            logging.info(f"Successfully upserted batch of {len(players_batch)} players.")
    except Exception as e:
        logging.error(f"Error upserting batch: {e}")



# Fetch and process free agents, upserting each player as it's processed
def fetch_and_upsert_free_agents():
    try:
        players = yahoo_query.get_league_players()
        if not players:
            logging.warning("No players found in the league. Please check the league ID and game ID.")
            return

        batch_size = 100
        batch = []

        for player in players:
            player_data = player.__dict__

            # Extract player name
            name = getattr(player_data.get('name'), 'full', None)
            if not name:
                logging.warning("Missing player name. Skipping player.")
                continue  # Skip players without a valid name

            # Extract player key
            player_key = player_data.get('player_key')
            if not player_key:
                logging.warning(f"Missing player_key for player {name}. Skipping player.")
                continue

            # Extract draft analysis if available
            try:
                draft_analysis = yahoo_query.get_player_draft_analysis(player_key)
                if isinstance(draft_analysis, DraftAnalysis):
                    average_draft_pick = draft_analysis.average_pick
                    average_draft_round = draft_analysis.average_round
                    average_draft_cost = draft_analysis.average_cost
                    percent_drafted = draft_analysis.percent_drafted
                else:
                    average_draft_pick = None
                    average_draft_round = None
                    average_draft_cost = None
                    percent_drafted = None
            except Exception as e:
                logging.warning(f"Could not retrieve draft analysis for player {name}: {e}")
                average_draft_pick = None
                average_draft_round = None
                average_draft_cost = None
                percent_drafted = None

            # Extracting headshot URL
            headshot = player_data.get('headshot')
            headshot_url = getattr(headshot, 'url', None)

            # Extract ownership if available using the get_player_percent_owned_by_week method
            try:
                percent_owned_info = yahoo_query.get_player_percent_owned_by_week(player_key, chosen_week="current")
                if isinstance(percent_owned_info, YahooFantasyObject):
                    percent_owned_serialized = percent_owned_info.serialized()
                    percent_ownership = percent_owned_serialized.get("percent_owned", {}).get("value")
                    percent_owned_value = percent_ownership
                else:
                    percent_ownership = None
                    percent_owned_value = None
            except Exception as e:
                logging.warning(f"Could not retrieve ownership information for player {name}: {e}")
                percent_ownership = None
                percent_owned_value = None

            # Prepare player info dictionary
            player_info = {
                'player_name': name,
                'player_id': player_key,
                'draft_analysis': draft_analysis.serialized() if draft_analysis else None,  # Convert draft analysis to JSONB
                'average_draft_pick': draft_analysis.average_draft_pick if draft_analysis else None,
                'average_draft_round': draft_analysis.average_draft_round if draft_analysis else None,
                'average_draft_cost': draft_analysis.average_draft_cost if draft_analysis else None,
                'percent_drafted': draft_analysis.percent_drafted if draft_analysis else None,
                'editorial_player_key': player_data.get('editorial_player_key'),
                'editorial_team_abbreviation': player_data.get('editorial_team_abbr'),
                'editorial_team_full_name': player_data.get('editorial_team_full_name'),
                'eligible_positions': player_data.get('eligible_positions', []),
                'display_position': player_data.get('display_position'),
                'headshot_url': headshot_url,
                'injury_note': player_data.get('injury_note'),
                'full_name': name,
                'percent_ownership': percent_ownership,
                'percent_owned_value': percent_owned_value,
                'player_key': player_key,
                'position_type': player_data.get('position_type'),
                'primary_position': player_data.get('primary_position'),
                'status': player_data.get('status'),
                'status_full': player_data.get('status_full'),
                'last_updated': datetime.now().isoformat()  # Convert datetime to ISO string
            }

            # Log processing information
            logging.info(f"Processing player: {name}")
            # logging.info(f"Player Info: {player_info}")

            # Upsert the player into Supabase
            batch.append(player_info)

            # If batch size is reached, upsert the batch
            if len(batch) >= batch_size:
                upsert_players_batch(batch)
                batch = []
                # Add a delay between API requests to avoid rate limiting
                
            time.sleep(5)  # 1-second delay; adjust if needed based on API rate limits

        # Upsert any remaining players in the batch
        if batch:
            upsert_players_batch(batch)

    except Exception as e:
        logging.error(f"Error fetching data: {e}")

def main():
    fetch_and_upsert_free_agents()

if __name__ == '__main__':
    main()

import os
import logging
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
from yfpy.query import YahooFantasySportsQuery
import time
from pathlib import Path
from tqdm import tqdm


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables from .env.local
ENV_FILE = "/Users/tim/Desktop/FHFH/fhfhockey.com/web/.env.local"
load_dotenv(ENV_FILE)

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
GAME_ID = '465'  # Update this with your actual game ID
LEAGUE_ID = '858'  # Update this with your actual league ID
ENV_FILE_LOCATION = Path("/Users/tim/Desktop/FHFH/fhfhockey.com/web/")


# Initialize YahooFantasySportsQuery
# auth_dir = 'C:/Users/timbr/Desktop/FHFH/fhfhockey.com-3/web/lib/supabase/Upserts/yahooAuth'
yahoo_query = YahooFantasySportsQuery(
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

# Function to upsert uniform numbers into Supabase
def upsert_uniform_numbers(players_batch: list):
    try:
        response = supabase.table('yahoo_players').upsert(players_batch).execute()
        
        # Check if 'error' attribute exists and is not None
        if hasattr(response, 'error') and response.error is not None:
            logging.error(f"Failed to upsert uniform numbers. Error: {response.error}")
        else:
            logging.info(f"Successfully upserted batch of {len(players_batch)} players.")
    except Exception as e:
        logging.error(f"Error upserting uniform numbers: {e}")

# Fetch and upsert uniform numbers
def fetch_and_upsert_uniform_numbers():
    try:
        players = yahoo_query.get_league_players()
        if not players:
            logging.warning("No players found in the league. Please check the league ID and game ID.")
            return

        batch_size = 100
        batch = []

        for player in players:
            player_data = player.__dict__

            # Extract player key and uniform number
            player_key = player_data.get('player_key')
            uniform_number = player_data.get('uniform_number')

            if not player_key:
                logging.warning(f"Missing player_key for player. Skipping.")
                continue

            if uniform_number is None:
                logging.warning(f"Uniform number not available for player with key {player_key}. Skipping.")
                continue

            # Prepare uniform number info for upserting
            player_info = {
                'player_key': player_key,
                'uniform_number': uniform_number,
                'last_updated': datetime.now().isoformat()  # Convert datetime to ISO string
            }

            # Add player to batch
            batch.append(player_info)

            # If batch size is reached, upsert the batch
            if len(batch) >= batch_size:
                upsert_uniform_numbers(batch)
                batch = []

        # Upsert any remaining players in the batch
        if batch:
            upsert_uniform_numbers(batch)

    except Exception as e:
        logging.error(f"Error fetching uniform numbers: {e}")

def main():
    fetch_and_upsert_uniform_numbers()

if __name__ == '__main__':
    main()

import os
import json
import logging
import time
from typing import List, Optional, Dict
from supabase import create_client, Client
from dotenv import load_dotenv
from yfpy.query import YahooFantasySportsQuery
from yfpy.models import YahooFantasyObject

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for detailed logs
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("yahoo_fantasy.log")  # Logs to a file
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from .env.local
env_path = 'C:/Users/timbr/Desktop/FHFH/fhfhockey.com-3/web/.env.local'
load_dotenv(env_path)

# Constants from environment variables
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_PUBLIC_KEY')
YFPY_CONSUMER_KEY = os.getenv('YFPY_CONSUMER_KEY')
YFPY_CONSUMER_SECRET = os.getenv('YFPY_CONSUMER_SECRET')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Yahoo API Constants
GAME_ID = '453'  # Update this with your actual game ID
LEAGUE_ID = '105954'  # Update this with your actual league ID

# Initialize YahooFantasySportsQuery with corrected parameter names
auth_dir = 'C:/Users/timbr/Desktop/FHFH/fhfhockey.com-3/web/lib/supabase/Upserts/yahooAuth'
try:
    yahoo_query = YahooFantasySportsQuery(
        auth_dir=auth_dir,
        league_id=LEAGUE_ID,
        game_code="nhl",
        game_id=int(GAME_ID),
        consumer_key=YFPY_CONSUMER_KEY,          # Corrected parameter name
        consumer_secret=YFPY_CONSUMER_SECRET     # Corrected parameter name
    )
    # Manually override league key if necessary
    yahoo_query.league_key = f"{GAME_ID}.l.{LEAGUE_ID}"
except TypeError as te:
    logger.critical(f"Initialization Error: {te}")
    exit(1)

# Helper functions to convert nested objects to dictionaries
def draft_analysis_to_dict(draft_analysis) -> Optional[Dict]:
    if draft_analysis and hasattr(draft_analysis, 'average_draft_pick'):
        return {
            'average_pick': getattr(draft_analysis, 'average_draft_pick', None),
            'average_round': getattr(draft_analysis, 'average_draft_round', None),
            'average_cost': getattr(draft_analysis, 'average_draft_cost', None),
            'percent_drafted': getattr(draft_analysis, 'percent_drafted', None)
        }
    return None

def ownership_to_dict(ownership) -> Optional[Dict]:
    if ownership and hasattr(ownership, 'percent_owned'):
        return {
            'percent_owned': getattr(ownership, 'percent_owned', None),
            'value': getattr(ownership, 'value', None)
        }
    return None

# Retry decorator with exponential backoff
def retry(max_retries=5, backoff_factor=2, status_codes=None):
    """
    Decorator to retry a function upon encountering specific exceptions or status codes.
    """
    if status_codes is None:
        status_codes = []

    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            delay = 1  # Initial delay in seconds
            while retries < max_retries:
                try:
                    response = func(*args, **kwargs)
                    return response
                except Exception as e:
                    # Check if the exception message indicates rate limiting
                    if any(code in str(e).lower() for code in ['rate limit', 'rate-limiting', 'too many requests', '999']):
                        logger.warning(f"Rate limit encountered: {e}. Retrying in {delay} seconds...")
                        time.sleep(delay)
                        retries += 1
                        delay *= backoff_factor  # Exponential backoff
                    else:
                        logger.error(f"Non-retryable error occurred: {e}")
                        break
            logger.error(f"Failed after {max_retries} retries.")
            return None
        return wrapper
    return decorator

# Fetch player ownership separately with retry
@retry(max_retries=5, backoff_factor=2)
def get_player_ownership(player_key: str) -> Optional[Dict]:
    try:
        player = yahoo_query.get_player_ownership(player_key)
        return ownership_to_dict(player.ownership)
    except Exception as e:
        logger.error(f"Error fetching ownership for player {player_key}: {e}")
        raise  # Propagate exception to trigger retry
    return None

# Fetch player draft analysis separately with retry
@retry(max_retries=5, backoff_factor=2)
def get_player_draft_analysis(player_key: str) -> Optional[Dict]:
    try:
        player = yahoo_query.get_player_draft_analysis(player_key)
        return draft_analysis_to_dict(player.draft_analysis)
    except Exception as e:
        logger.error(f"Error fetching draft analysis for player {player_key}: {e}")
        raise  # Propagate exception to trigger retry
    return None

# Fetch free agents with rate limiting handling
def fetch_free_agents() -> Optional[List[Dict]]:
    try:
        players = yahoo_query.get_league_players()
        logger.info(f"Number of players fetched: {len(players)}")
        player_info = []
        for player in players:
            original_player_key = None  # Initialize here
            try:
                # Ensure the player is an instance of YahooFantasyObject
                if not isinstance(player, YahooFantasyObject):
                    logger.warning(f"Player object is not an instance of YahooFantasyObject: {player}")
                    continue  # Skip if not the expected type

                # Access data using attributes
                name = player.full_name
                original_player_key = player.player_key
                player_id = player.player_id

                # Reconstruct player_key to ensure consistency
                if player_id:
                    reconstructed_player_key = f"{GAME_ID}.p.{player_id}"
                else:
                    reconstructed_player_key = None  # Handle missing player_id

                # Validate essential fields
                if not reconstructed_player_key or not player_id or not name:
                    logger.warning(f"Skipping player due to missing essential fields: {original_player_key}")
                    continue  # Skip this player

                # Handle eligible_positions
                eligible_positions = player.eligible_positions
                if isinstance(eligible_positions, dict):
                    eligible_positions = [eligible_positions]
                elif isinstance(eligible_positions, list):
                    eligible_positions = eligible_positions
                else:
                    eligible_positions = []

                # Fetch draft analysis and ownership separately with retry
                draft_analysis = get_player_draft_analysis(reconstructed_player_key)
                ownership = get_player_ownership(reconstructed_player_key)

                # Append player data
                player_info.append({
                    'player_name': name,
                    'player_id': player_id,
                    'draft_analysis': draft_analysis,
                    'average_draft_pick': draft_analysis.get('average_pick') if draft_analysis else None,
                    'average_draft_round': draft_analysis.get('average_round') if draft_analysis else None,
                    'average_draft_cost': draft_analysis.get('average_cost') if draft_analysis else None,
                    'percent_drafted': draft_analysis.get('percent_drafted') if draft_analysis else None,
                    'editorial_player_key': player.editorial_player_key,
                    'editorial_team_abbreviation': player.editorial_team_abbr,
                    'editorial_team_full_name': player.editorial_team_full_name,
                    'eligible_positions': eligible_positions if eligible_positions else [],
                    'headshot_url': player.headshot.url if player.headshot else None,
                    'injury_note': player.injury_note,
                    'full_name': name,
                    'percent_ownership': ownership.get('percent_owned') if ownership else None,
                    'percent_owned_value': ownership.get('value') if ownership else None,
                    'player_key': reconstructed_player_key,
                    'position_type': player.position_type,
                    'primary_position': player.primary_position,
                    'status': player.status,
                    'status_full': player.status_full
                })

                # Optional: Throttle requests to avoid hitting rate limits
                time.sleep(0.5)  # Adjust based on API's rate limit policy

            except Exception as inner_e:
                if original_player_key:
                    logger.error(f"Error processing player {original_player_key}: {inner_e}")
                else:
                    logger.error(f"Error processing a player without a valid player_key: {inner_e}")
        return player_info
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        return None

# Validate player data before upserting
def validate_player_data(player: Dict) -> bool:
    required_fields = ['player_key', 'player_id', 'player_name', 'full_name', 'position_type', 'primary_position']
    missing_fields = [field for field in required_fields if not player.get(field)]
    if missing_fields:
        logger.warning(f"Player {player.get('player_key')} is missing required fields: {missing_fields}")
        return False
    return True

# Upsert players to Supabase
def upsert_to_supabase(players: List[Dict]):
    for player in players:
        if not validate_player_data(player):
            logger.warning(f"Skipping upsert for player {player.get('player_key')} due to missing fields.")
            continue  # Skip this player and proceed to the next
        try:
            # Validate JSON serialization
            json.dumps(player)  # This will raise a TypeError if not serializable

            # Perform the upsert operation with conflict target
            response = supabase.table('yahoo_players').upsert(player, on_conflict='player_key').execute()

            # Debug: Log the response object
            logger.debug(f"Response for player {player['player_key']}: {response}")

            # Check for errors
            if hasattr(response, 'error') and response.error:
                logger.error(f"Error upserting player {player['player_key']}: {response.error}")
                logger.debug(f"Player Data: {json.dumps(player, indent=2)}")
            else:
                logger.info(f"Successfully upserted player {player['player_key']}")
        except TypeError as te:
            logger.error(f"Serialization error for player {player['player_key']}: {te}")
            logger.debug(f"Player Data: {json.dumps(player, indent=2)}")
        except AttributeError as ae:
            logger.error(f"Attribute error upserting player {player['player_key']}: {ae}")
            logger.debug(f"Player Data: {json.dumps(player, indent=2)}")
        except Exception as e:
            logger.error(f"Unexpected error upserting player {player['player_key']}: {e}")
            logger.debug(f"Player Data: {json.dumps(player, indent=2)}")

def main():
    players = fetch_free_agents()
    if players:
        # Test with the first 10 players
        test_players = players[:10]
        logger.info("Testing upsert with a subset of players...")
        upsert_to_supabase(test_players)

        # Once confirmed, proceed with the full upsert
        logger.info("Proceeding with full upsert of all players...")
        upsert_to_supabase(players)
    else:
        logger.critical("No players fetched. Exiting.")

if __name__ == '__main__':
    main()

import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv
from yfpy.query import YahooFantasySportsQuery
from yfpy.models import YahooFantasyObject

# Load environment variables from .env.local
load_dotenv('C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/.env.local')

# Constants from environment variables
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
YFPY_CONSUMER_KEY = os.getenv('YFPY_CONSUMER_KEY')
YFPY_CONSUMER_SECRET = os.getenv('YFPY_CONSUMER_SECRET')
print(SUPABASE_URL)
print(SUPABASE_KEY)
print(YFPY_CONSUMER_KEY)
print(YFPY_CONSUMER_SECRET)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Yahoo API Constants
GAME_ID = '427'  # Update this with your actual game ID
LEAGUE_ID = '117061'  # Update this with your actual league ID

# Initialize YahooFantasySportsQuery
auth_dir = 'C:/Users/timbr/OneDrive/Desktop/fhfhockey.com-3/web/auth'
yahoo_query = YahooFantasySportsQuery(
    auth_dir=auth_dir,
    league_id=LEAGUE_ID,
    game_code="nhl",
    game_id=GAME_ID,
    consumer_key=os.environ["YFPY_CONSUMER_KEY"],
    consumer_secret=os.environ["YFPY_CONSUMER_SECRET"]
)

# Manually override league key for example code to work
#yahoo_query.league_key = f"{GAME_ID}.l.{LEAGUE_ID}"

# Fetch free agents
def fetch_free_agents():
    try:
        players = yahoo_query.get_league_players()
        player_info = []
        for player in players:
            player_data = player.__dict__
            name = player_data['name']['full']
            player_id = player_data['player_key']
            draft_analysis = player_data.get('draft_analysis', {})
            headshot = player_data.get('headshot', {})
            ownership = player_data.get('ownership', {})

            player_info.append({
                'player_name': name,
                'player_id': player_id,
                'draft_analysis': draft_analysis,
                'average_draft_pick': draft_analysis.get('average_pick'),
                'average_draft_round': draft_analysis.get('average_round'),
                'average_draft_cost': draft_analysis.get('average_cost'),
                'percent_drafted': draft_analysis.get('percent_drafted'),
                'editorial_player_key': player_data.get('editorial_player_key'),
                'editorial_team_abbreviation': player_data.get('editorial_team_abbr'),
                'editorial_team_full_name': player_data.get('editorial_team_full_name'),
                'eligible_positions': player_data.get('eligible_positions', []),
                'headshot_url': headshot.get('url'),
                'injury_note': player_data.get('injury_note'),
                'full_name': name,
                'percent_ownership': ownership.get('percent_owned'),
                'percent_owned_value': ownership.get('value'),
                'player_key': player_data.get('player_key'),
                'position_type': player_data.get('position_type'),
                'primary_position': player_data.get('primary_position'),
                'status': player_data.get('status'),
                'status_full': player_data.get('status_full')
            })
        return player_info
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def upsert_to_supabase(players):
    for player in players:
        response = supabase.table('yahoo_players').upsert(player).execute()
        print(response)

def main():
    players = fetch_free_agents()
    if players:
        upsert_to_supabase(players)

if __name__ == '__main__':
    main()

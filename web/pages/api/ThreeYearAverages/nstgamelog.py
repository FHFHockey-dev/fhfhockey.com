import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_API_KEY = os.getenv('SUPABASE_API_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

# Function to fetch player IDs from Supabase
def get_player_ids():
    response = supabase.table('players').select('id').execute()
    if response.error:
        print(f"Error fetching player IDs: {response.error}")
        return []
    return [player['id'] for player in response.data]

# Function to scrape player stats from Natural Stat Trick
def scrape_player_stats(player_id):
    url = f"https://naturalstattrick.com/playerreport.php?fromseason=20232024&thruseason=20232024&stype=2&sit=5v5&stdoi=std&rate=n&v=g&playerid={player_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' 
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/58.0.3029.110 Safari/537.3'
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch data for player ID {player_id}: Status code {response.status_code}")
        return []
    
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find the table with id 'indreg'
    table = soup.find('table', id='indreg')
    if not table:
        print(f"No table found for player ID {player_id}")
        return []
    
    # Extract headers
    headers = []
    thead = table.find('thead')
    if thead:
        header_row = thead.find('tr')
        for th in header_row.find_all('th'):
            header_text = th.get_text(strip=True).replace(' ', '_').lower()
            headers.append(header_text)
    else:
        print(f"No table headers found for player ID {player_id}")
        return []
    
    # Extract data rows
    tbody = table.find('tbody')
    data = []
    if tbody:
        for row in tbody.find_all('tr'):
            cols = row.find_all('td')
            if len(cols) != len(headers):
                continue  # Skip rows that don't match the header length
            
            row_data = {}
            for header, col in zip(headers, cols):
                text = col.get_text(strip=True)
                row_data[header] = text
            
            # Add player_id to the row data
            row_data['player_id'] = player_id
            
            # Parse game_date from game_description
            game_desc = row_data.get('game', '')
            try:
                game_date_str = game_desc.split(' ')[0]
                game_date = datetime.strptime(game_date_str, '%Y-%m-%d').date()
                row_data['game_date'] = game_date
                row_data['game_description'] = game_desc
            except Exception as e:
                row_data['game_date'] = None
                row_data['game_description'] = game_desc
            
            data.append(row_data)
    else:
        print(f"No table body found for player ID {player_id}")
    
    return data

# Function to upsert data into Supabase
def upsert_player_stats(stats):
    if not stats:
        return
    
    # Define the columns to insert/update
    # Assuming 'player_id' and 'game_description' uniquely identify a record
    for stat in stats:
        # Prepare the data by converting data types as necessary
        # Example: Convert numeric fields
        try:
            stat['goals'] = int(stat.get('goals', 0))
            stat['total_assists'] = int(stat.get('total_assists', 0))
            stat['first_assists'] = int(stat.get('first_assists', 0))
            stat['second_assists'] = int(stat.get('second_assists', 0))
            stat['total_points'] = int(stat.get('total_points', 0))
            # Handle 'ipp' which can be '-'
            ipp = stat.get('ipp', '-')
            stat['ipp'] = None if ipp == '-' else ipp
            stat['shots'] = int(stat.get('shots', 0))
            stat['shooting_percentage'] = stat.get('s%', '0')
            stat['ixg'] = stat.get('ixg', '0')
            stat['icf'] = int(stat.get('icf', 0))
            stat['iff'] = int(stat.get('iff', 0))
            stat['iscf'] = int(stat.get('iscf', 0))
            stat['ihcdf'] = int(stat.get('ihcdf', 0))
            stat['rebounds_created'] = int(stat.get('rebounds_created', 0))
            stat['pim'] = int(stat.get('pim', 0))
            stat['total_penalties'] = int(stat.get('total_penalties', 0))
            stat['minor'] = int(stat.get('minor', 0))
            stat['major'] = int(stat.get('major', 0))
            stat['misconduct'] = int(stat.get('misconduct', 0))
            stat['penalties_drawn'] = int(stat.get('penalties_drawn', 0))
            stat['giveaways'] = int(stat.get('giveaways', 0))
            stat['takeaways'] = int(stat.get('takeaways', 0))
            stat['hits'] = int(stat.get('hits', 0))
            stat['hits_taken'] = int(stat.get('hits_taken', 0))
            stat['shots_blocked'] = int(stat.get('shots_blocked', 0))
            stat['faceoffs_won'] = int(stat.get('faceoffs_won', 0))
            stat['faceoffs_lost'] = int(stat.get('faceoffs_lost', 0))
            stat['faceoffs_percentage'] = stat.get('faceoffs_%', '0')
        except ValueError as ve:
            print(f"Value error while processing stat: {ve}")
            continue
        
        # Upsert based on player_id and game_description
        supabase.table('player_stats') \
            .upsert(stat, on_conflict=['player_id', 'game_description']) \
            .execute()

def main():
    player_ids = get_player_ids()
    print(f"Found {len(player_ids)} players.")

    for idx, player_id in enumerate(player_ids, start=1):
        print(f"Processing player {idx}/{len(player_ids)} with ID: {player_id}")
        stats = scrape_player_stats(player_id)
        print(f"Found {len(stats)} records for player ID {player_id}")
        upsert_player_stats(stats)
        print(f"Upserted data for player ID {player_id}\n")

if __name__ == "__main__":
    main()

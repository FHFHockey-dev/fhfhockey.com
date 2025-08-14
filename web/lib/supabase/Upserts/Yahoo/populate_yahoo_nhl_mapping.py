#!/usr/bin/env python3
# /Users/tim/Desktop/fhfhockey.com/web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py

import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from fuzzywuzzy import fuzz, process
import re

# -----------------------------------------------------------------------------
# CONFIG & ENV
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

ENV_FILE = "/Users/tim/Desktop/fhfhockey.com/web/.env.local"
load_dotenv(ENV_FILE)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_PUBLIC_KEY')

if not all([SUPABASE_URL, SUPABASE_KEY]):
    logging.error("Missing environment variables. Need NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLIC_KEY")
    exit(1)

logging.info(f"Using Supabase URL: {SUPABASE_URL}")
logging.info(f"Using key type: {'SERVICE_ROLE' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'PUBLIC'}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------
def clean_name(name):
    """Clean and normalize player names for matching."""
    if not name:
        return ""
    
    # Remove common suffixes and prefixes
    name = re.sub(r'\s+(Jr\.?|Sr\.?|II|III|IV)$', '', name, flags=re.IGNORECASE)
    # Remove extra whitespace and convert to lowercase
    name = ' '.join(name.split()).lower()
    return name

def get_nhl_players():
    """Fetch NHL player data from projection sources."""
    logging.info("Fetching NHL players from projection sources...")
    
    # Get players from your actual projection tables based on the config
    projection_tables = [
        'projections_apples_ginos',
        'projections_cullen', 
        'projections_cullen_goalies',
        'projections_cullen_top_400',
        'projections_dom_skaters',
        'projections_dom_goalies',
        'projections_dtz_skaters',
        'projections_dtz_goalies'
    ]
    
    all_nhl_players = {}
    
    for table in projection_tables:
        try:
            logging.info(f"Fetching from {table}...")
            
            # Use different column names based on the table
            if table == 'projections_cullen_goalies':
                name_col = 'Goalie'  # Special case for this table
            else:
                name_col = 'Player_Name'
            
            # Build the select query based on available columns
            select_cols = f"player_id, {name_col}"
            
            # Add team and position if they exist
            if table in ['projections_apples_ginos', 'projections_cullen', 'projections_cullen_goalies', 
                        'projections_cullen_top_400', 'projections_dom_goalies', 'projections_dtz_skaters', 'projections_dtz_goalies']:
                if table == 'projections_dom_skaters':
                    # Dom skaters doesn't have Team_Abbreviation
                    select_cols += ", Position"
                else:
                    select_cols += ", Team_Abbreviation, Position"
            elif table == 'projections_dom_skaters':
                select_cols += ", Position"
            
            resp = supabase.table(table).select(select_cols).execute()
            
            for player in resp.data:
                nhl_id = player.get('player_id')
                name = player.get(name_col)
                team = player.get('Team_Abbreviation')
                position = player.get('Position')
                
                if nhl_id and name:
                    if nhl_id not in all_nhl_players:
                        all_nhl_players[nhl_id] = {
                            'nhl_id': nhl_id,
                            'name': name,
                            'team': team,
                            'position': position,
                            'clean_name': clean_name(name)
                        }
        except Exception as e:
            logging.warning(f"Could not fetch from {table}: {e}")
            continue
    
    logging.info(f"Found {len(all_nhl_players)} unique NHL players")
    return all_nhl_players

def get_yahoo_players():
    """Fetch Yahoo player data."""
    logging.info("Fetching Yahoo players...")
    
    all_yahoo_players = {}
    page_size = 1000
    start = 0
    
    while True:
        resp = supabase.table("yahoo_players") \
                       .select("player_id, full_name, editorial_team_abbreviation, display_position") \
                       .range(start, start + page_size - 1) \
                       .execute()
        
        data = resp.data
        if not data:
            break
            
        for player in data:
            yahoo_id = player.get('player_id')
            name = player.get('full_name')
            team = player.get('editorial_team_abbreviation')
            position = player.get('display_position')
            
            if yahoo_id and name:
                all_yahoo_players[yahoo_id] = {
                    'yahoo_id': yahoo_id,
                    'name': name,
                    'team': team,
                    'position': position,
                    'clean_name': clean_name(name)
                }
        
        start += page_size
        if len(data) < page_size:
            break
    
    logging.info(f"Found {len(all_yahoo_players)} Yahoo players")
    return all_yahoo_players

def match_players(nhl_players, yahoo_players):
    """Match NHL players to Yahoo players using fuzzy name matching."""
    logging.info("Matching NHL players to Yahoo players...")
    
    mappings = []
    yahoo_names = {pid: player['clean_name'] for pid, player in yahoo_players.items()}
    yahoo_name_to_id = {player['clean_name']: pid for pid, player in yahoo_players.items()}
    
    matched_count = 0
    unmatched_count = 0
    
    for nhl_id, nhl_player in nhl_players.items():
        nhl_name = nhl_player['clean_name']
        
        # Try exact match first
        if nhl_name in yahoo_name_to_id:
            yahoo_id = yahoo_name_to_id[nhl_name]
            yahoo_player = yahoo_players[yahoo_id]
            
            mappings.append({
                'nhl_player_id': str(nhl_id),
                'yahoo_player_id': yahoo_id,
                'nhl_player_name': nhl_player['name'],
                'yahoo_player_name': yahoo_player['name'],
                'nhl_team_abbreviation': nhl_player.get('team'),
                'mapped_position': nhl_player.get('position'),
                'match_confidence': 100.0,
                'last_updated': datetime.now().isoformat()
            })
            matched_count += 1
            continue
        
        # Try fuzzy matching with high threshold
        match_result = process.extractOne(
            nhl_name, 
            yahoo_names.values(), 
            scorer=fuzz.ratio,
            score_cutoff=85  # High threshold for confidence
        )
        
        if match_result:
            matched_name, confidence = match_result
            yahoo_id = yahoo_name_to_id[matched_name]
            yahoo_player = yahoo_players[yahoo_id]
            
            mappings.append({
                'nhl_player_id': str(nhl_id),
                'yahoo_player_id': yahoo_id,
                'nhl_player_name': nhl_player['name'],
                'yahoo_player_name': yahoo_player['name'],
                'nhl_team_abbreviation': nhl_player.get('team'),
                'mapped_position': nhl_player.get('position'),
                'match_confidence': float(confidence),
                'last_updated': datetime.now().isoformat()
            })
            matched_count += 1
        else:
            logging.debug(f"No match found for NHL player: {nhl_player['name']}")
            unmatched_count += 1
    
    logging.info(f"Matched {matched_count} players, {unmatched_count} unmatched")
    return mappings

def upsert_mappings(mappings):
    """Upsert the mappings to the yahoo_nhl_player_map_mat table."""
    if not mappings:
        logging.info("No mappings to upsert.")
        return
    
    try:
        # Upsert in batches to avoid hitting Supabase limits
        batch_size = 1000
        total_batches = (len(mappings) + batch_size - 1) // batch_size
        
        for i in range(0, len(mappings), batch_size):
            batch = mappings[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            
            logging.info(f"Upserting batch {batch_num}/{total_batches} ({len(batch)} records)")
            
            resp = supabase.table("yahoo_nhl_player_map_mat").upsert(batch).execute()
            
            if hasattr(resp, "error") and resp.error:
                logging.error(f"Error upserting batch {batch_num}: {resp.error}")
            else:
                logging.info(f"Successfully upserted batch {batch_num}")
                
    except Exception as e:
        logging.error(f"Exception while upserting mappings: {e}")

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main():
    start_time = datetime.now()
    
    # 1. Fetch NHL players from projection sources
    nhl_players = get_nhl_players()
    if not nhl_players:
        logging.error("No NHL players found. Check your projection source tables.")
        return
    
    # 2. Fetch Yahoo players
    yahoo_players = get_yahoo_players()
    if not yahoo_players:
        logging.error("No Yahoo players found. Run yahooAPI.py first to populate yahoo_players table.")
        return
    
    # 3. Match players using fuzzy name matching
    mappings = match_players(nhl_players, yahoo_players)
    
    # 4. Upsert mappings to database
    upsert_mappings(mappings)
    
    # Timer
    elapsed = datetime.now() - start_time
    minutes = int(elapsed.total_seconds() // 60)
    seconds = elapsed.total_seconds() % 60
    logging.info(f"Completed in {minutes} min {seconds:.2f} sec.")

if __name__ == "__main__":
    main()
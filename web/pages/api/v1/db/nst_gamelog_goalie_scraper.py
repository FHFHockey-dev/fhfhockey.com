import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('C:/Users/timbr/Desktop/FHFH/fhfhockey.com/web/.env.local')

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY is missing.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Rate limiting configuration
REQUEST_INTERVAL_MS = 21000  # 21 seconds
DELAY_SECONDS = REQUEST_INTERVAL_MS / 1000

BASE_URL = "https://www.naturalstattrick.com/playerteams.php"

# --- Header Mappings for Goalie Data ---
goalie_counts_map: Dict[str, str] = {
    "GP": "gp",
    "TOI": "toi",
    "Shots Against": "shots_against",
    "Saves": "saves",
    "Goals Against": "goals_against",
    "SV%": "sv_percentage",
    "GAA": "gaa",
    "GSAA": "gsaa",
    "xG Against": "xg_against",
    "HD Shots Against": "hd_shots_against",
    "HD Saves": "hd_saves",
    "HDSV%": "hd_sv_percentage",
    "HDGAA": "hd_gaa",
    "HDGSAA": "hd_gsaa",
    "MD Shots Against": "md_shots_against",
    "MD Saves": "md_saves",
    "MD Goals Against": "md_goals_against",
    "MDSV%": "md_sv_percentage",
    "MDGAA": "md_gaa",
    "MDGSAA": "md_gsaa",
    "LD Shots Against": "ld_shots_against",
    "LDSV%": "ld_sv_percentage",
    "LDGAA": "ld_gaa",
    "LDGSAA": "ld_gsaa",
    "Rush Attempts Against": "rush_attempts_against",
    "Rebound Attempts Against": "rebound_attempts_against",
    "Avg. Shot Distance": "avg_shot_distance",
    "Avg. Goal Distance": "avg_goal_distance"
}

goalie_rates_map: Dict[str, str] = {
    "GP": "gp",
    "TOI": "toi",
    "TOI/GP": "toi_per_gp",
    "Shots Against/60": "shots_against_per_60",
    "Saves/60": "saves_per_60",
    "SV%": "sv_percentage",
    "GAA": "gaa",
    "GSAA/60": "gsaa_per_60",
    "xG Against/60": "xg_against_per_60",
    "HD Shots Against/60": "hd_shots_against_per_60",
    "HD Saves/60": "hd_saves_per_60",
    "HDSV%": "hd_sv_percentage",
    "HDGAA": "hd_gaa",
    "HDGSAA/60": "hd_gsaa_per_60",
    "MD Shots Against/60": "md_shots_against_per_60",
    "MD Saves/60": "md_saves_per_60",
    "MDSV%": "md_sv_percentage",
    "MDGAA": "md_gaa",
    "MDGSAA/60": "md_gsaa_per_60",
    "LD Shots Against/60": "ld_shots_against_per_60",
    "LD Saves/60": "ld_saves_per_60",
    "LDSV%": "ld_sv_percentage",
    "LDGAA": "ld_gaa",
    "LDGSAA/60": "ld_gsaa_per_60",
    "Rush Attempts Against/60": "rush_attempts_against_per_60",
    "Rebound Attempts Against/60": "rebound_attempts_against_per_60",
    "Avg. Shot Distance": "avg_shot_distance",
    "Avg. Goal Distance": "avg_goal_distance"
}

def map_header_to_column(header: str, dataset_type: str) -> Optional[str]:
    if header in ["Player", "Team"]:
        return None
    if dataset_type.endswith("Counts"):
        return goalie_counts_map.get(header)
    elif dataset_type.endswith("Rates"):
        return goalie_rates_map.get(header)
    return None

def get_table_name(dataset_type: str) -> str:
    mapping = {
        "5v5Counts": "nst_gamelog_goalie_5v5_counts",
        "5v5Rates": "nst_gamelog_goalie_5v5_rates",
        "evCounts": "nst_gamelog_goalie_ev_counts",
        "evRates": "nst_gamelog_goalie_ev_rates",
        "allCounts": "nst_gamelog_goalie_all_counts",
        "allRates": "nst_gamelog_goalie_all_rates",
        "ppCounts": "nst_gamelog_goalie_pp_counts",
        "ppRates": "nst_gamelog_goalie_pp_rates",
        "pkCounts": "nst_gamelog_goalie_pk_counts",
        "pkRates": "nst_gamelog_goalie_pk_rates"
    }
    return mapping.get(dataset_type, "unknown_table")

def get_dates_between(start_date: datetime, end_date: datetime) -> List[str]:
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates

def construct_urls_for_date(date: str, season_id: str) -> Dict[str, str]:
    from_season = season_id
    thru_season = season_id
    common_params = f"fromseason={from_season}&thruseason={thru_season}&stype=2&score=all&stdoi=g&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd={date}&td={date}&tgp=410&lines=single&draftteam=ALL"
    
    situations = [
        {"sit": "5v5", "label": "5v5"},
        {"sit": "ev", "label": "ev"},
        {"sit": "all", "label": "all"},
        {"sit": "pp", "label": "pp"},
        {"sit": "pk", "label": "pk"}
    ]
    
    urls = {}
    for situation in situations:
        label = situation["label"]
        sit = situation["sit"]
        # Counts
        dataset_type_counts = f"{label}Counts"
        url_counts = f"{BASE_URL}?{common_params}&sit={sit}&rate=n"
        urls[dataset_type_counts] = url_counts
        # Rates
        dataset_type_rates = f"{label}Rates"
        url_rates = f"{BASE_URL}?{common_params}&sit={sit}&rate=y"
        urls[dataset_type_rates] = url_rates
    return urls

def parse_html(html_content: str, dataset_type: str, date: str, season_id: str) -> List[Dict]:
    soup = BeautifulSoup(html_content, "html.parser")
    table = soup.find("table")
    if not table:
        print("No table found in HTML content.")
        return []
    headers = [th.get_text(strip=True) for th in table.find("thead").find_all("th")]
    mapped_headers = [map_header_to_column(header, dataset_type) for header in headers]
    
    data_rows = []
    for tr in table.find("tbody").find_all("tr"):
        row_data = {}
        player_name = None
        team = None
        tds = tr.find_all("td")
        for i, td in enumerate(tds):
            column = mapped_headers[i] if i < len(mapped_headers) else None
            if column is None:
                original = headers[i]
                if original == "Player":
                    player_name = td.get_text(strip=True)
                elif original == "Team":
                    team = td.get_text(strip=True)
                continue
            cell_text = td.get_text(strip=True)
            if cell_text in ["-", "\\-"]:
                cell_text = None
            if cell_text is not None:
                try:
                    row_data[column] = float(cell_text.replace(",", ""))
                except ValueError:
                    row_data[column] = cell_text
            else:
                row_data[column] = None
        if player_name and team and row_data:
            row_data["player_name"] = player_name
            row_data["team"] = team
            row_data["date_scraped"] = date
            row_data["season"] = int(season_id)
            data_rows.append(row_data)
    return data_rows

# --- Player Name Mapping for Goalies ---
# The key is the name as it appears on NaturalStatTrick (NST),
# and the value is the official NHL API name.
# Example: "NaturalStatTrick Name": {"fullName": "NHL API Name"}
goalie_name_mapping: Dict[str, Dict[str, str]] = {
    # Add additional goalie mappings here.
}

def normalize_name(name: str) -> str:
    import unicodedata
    return ''.join(
        c for c in unicodedata.normalize('NFD', name.lower())
        if unicodedata.category(c) != 'Mn'
    ).replace(" ", "").replace("-", "").replace("'", "")

# Array to record problematic goalie names.
troublesome_players: List[str] = []

def get_goalie_id_by_name(fullName: str, team: str) -> Optional[int]:
    mappedName = goalie_name_mapping.get(fullName, {"fullName": fullName})["fullName"]
    normalized_fullName = normalize_name(mappedName)
    goaliePosition = "G"  # Ensure we only get goalies
    try:
        response = supabase.table("players").select("id").ilike("fullName", f"%{mappedName}%").eq("position", goaliePosition).limit(1).execute()
        if response.data:
            return response.data[0]["id"]
        else:
            troublesome_players.append(f"{fullName} ({team})")
            return None
    except Exception as e:
        print(f"Error fetching goalie ID for {fullName}: {e}")
        troublesome_players.append(f"{fullName} ({team})")
        return None

def print_delay_countdown():
    for i in range(int(DELAY_SECONDS), 0, -1):
        print(f"\rWaiting: {i}s remaining", end="")
        time.sleep(1)
    print("\nDelay complete.")

def check_data_exists(dataset_type: str, date: str) -> bool:
    """Check if data already exists in the database for the given dataset type and date."""
    table_name = get_table_name(dataset_type)
    try:
        response = supabase.table(table_name).select("id").eq("date_scraped", date).limit(1).execute()
        return len(response.data) > 0
    except Exception as e:
        print(f"Error checking if data exists: {e}")
        return False

def process_url(url_info: Dict, current_url_num: int, total_urls: int, date_counts: Dict[str, Dict[str, int]]):
    dataset_type = url_info["datasetType"]
    url = url_info["url"]
    date = url_info["date"]
    season_id = url_info["seasonId"]
    
    print(f"\nProcessing URL {current_url_num}/{total_urls}: {dataset_type} for {date}")
    if check_data_exists(dataset_type, date):
        print(f"Data already exists for {dataset_type} on {date}. Skipping.")
        return
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data_rows = parse_html(response.text, dataset_type, date, season_id)
            if data_rows:
                # Process each row to assign player_id
                data_rows_with_ids = []
                for row in data_rows:
                    goalie_id = get_goalie_id_by_name(row["player_name"], row["team"])
                    if not goalie_id:
                        print(f"Goalie ID not found for {row['player_name']} ({row['team']})")
                        continue
                    row["player_id"] = goalie_id
                    data_rows_with_ids.append(row)
                table_name = get_table_name(dataset_type)
                res = supabase.table(table_name).upsert(data_rows_with_ids, on_conflict=["player_id", "date_scraped"]).execute()
                print(f"Upserted {len(data_rows_with_ids)} rows into {table_name}.")
            else:
                print("No rows parsed.")
        else:
            print(f"Failed to fetch {url}: Status Code {response.status_code}")
    except Exception as e:
        print(f"Error processing URL {url}: {e}")

def main():
    start_time = time.time()
    # For example purposes, assume season_id "20242025" and season start "2024-10-01"
    season_id = "20242025"
    season_start_date = datetime.strptime("2024-10-01", "%Y-%m-%d")
    today = datetime.utcnow()
    scraping_end_date = today if today < datetime.strptime("2025-04-15", "%Y-%m-%d") else datetime.strptime("2025-04-15", "%Y-%m-%d")
    
    start_date = season_start_date  # In production, adjust using latest data from Supabase.
    dates_to_scrape = get_dates_between(start_date, scraping_end_date)
    if not dates_to_scrape:
        print("No new dates to scrape.")
        return
    
    urls_queue = []
    date_counts = {}
    for date in dates_to_scrape:
        urls = construct_urls_for_date(date, season_id)
        date_counts[date] = {"total": len(urls), "processed": 0}
        for dataset_type, url in urls.items():
            urls_queue.append({
                "datasetType": dataset_type,
                "url": url,
                "date": date,
                "seasonId": season_id
            })
    total_urls = len(urls_queue)
    print(f"Total URLs to process: {total_urls}")
    for i, url_info in enumerate(urls_queue):
        if i > 0:
            print(f"\nWaiting {DELAY_SECONDS} seconds before next request...")
            print_delay_countdown()
        process_url(url_info, i + 1, total_urls, date_counts)
    end_time = time.time()
    print(f"Total processing time: {end_time - start_time:.2f} seconds")
    if troublesome_players:
        unique = list(set(troublesome_players))
        print("Troublesome Players (require manual mapping):")
        for p in unique:
            print(f"- {p}")

if __name__ == "__main__":
    main()
# nst_gamelog_scraper.py - Refactored for improved rate limiting

import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
import asyncio

# Load environment variables from .env file
load_dotenv('C:/Users/timbr/Desktop/FHFH/fhfhockey.com/web/.env.local')

# Supabase Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_KEY is missing in environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Rate Limiting Configuration (strict enforcement)
REQUEST_INTERVAL_MS = 21000  # 21 seconds
DELAY_SECONDS = REQUEST_INTERVAL_MS / 1000

# Base URL
BASE_URL = "https://www.naturalstattrick.com/playerteams.php"

# Player Name Mapping
player_name_mapping: Dict[str, Dict[str, str]] = {
    "Matthew Benning": {"fullName": "Matt Benning"},
    "Alex Kerfoot": {"fullName": "Alexander Kerfoot"},
    "Zach Aston-Reese": {"fullName": "Zachary Aston-Reese"},
    "Oskar Back": {"fullName": "Oskar Bäck"},
    "Cameron Atkinson": {"fullName": "Cam Atkinson"},
    "Nicholas Paul": {"fullName": "Nick Paul"},
    "Janis Moser": {"fullName": "J.J. Moser"},
    "Nathan Légaré": {"fullName": "Nathan Legare"},
    "Mat?j Blümel": {"fullName": "Matěj Blümel"},
    "Alex Petrovic": {"fullName": "Alexander Petrovic"},
    "Olli Maatta": {"fullName": "Olli Määttä"},
    "Pierre-Olivier Joseph": {"fullName": "P.O. Joseph"},
}

# Troublesome Players
troublesome_players: List[str] = []

def normalize_name(name: str) -> str:
    """Normalizes a name by lowercasing, removing spaces/hyphens/apostrophes, and stripping diacritics."""
    import unicodedata
    return ''.join(
        c for c in unicodedata.normalize('NFD', name.lower())
        if unicodedata.category(c) != 'Mn'
    ).replace(' ', '').replace('-', '').replace("'", "")

def get_dates_between(start_date: datetime, end_date: datetime) -> List[str]:
    """Generates a list of date strings in 'YYYY-MM-DD' format between start_date and end_date inclusive."""
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates

def map_header_to_column(header: str) -> Optional[str]:
    """Maps table headers to database column names."""
    header_map: Dict[str, str] = {
        # Define all necessary header mappings here...
        "GP": "gp",
        "TOI": "toi",
        "TOI/GP": "toi_per_gp",
        "Goals": "goals",
        "Goals/60": "goals_per_60",
        "Total Assists": "total_assists",
        "Total Assists/60": "total_assists_per_60",
        "First Assists": "first_assists",
        "First Assists/60": "first_assists_per_60",
        "Second Assists": "second_assists",
        "Second Assists/60": "second_assists_per_60",
        "Total Points": "total_points",
        "Total Points/60": "total_points_per_60",
        "IPP": "ipp",
        "Shots": "shots",
        "Shots/60": "shots_per_60",
        "SH%": "sh_percentage",
        "ixG": "ixg",
        "ixG/60": "ixg_per_60",
        "iCF": "icf",
        "iCF/60": "icf_per_60",
        "iFF": "iff",
        "iFF/60": "iff_per_60",
        "iSCF": "iscfs",
        "iSCF/60": "iscfs_per_60",
        "iHDCF": "hdcf",
        "iHDCF/60": "hdcf_per_60",
        "HDCF": "hdcf",
        "HDCF/60": "hdcf_per_60",
        "Rush Attempts": "rush_attempts",
        "Rush Attempts/60": "rush_attempts_per_60",
        "Rebounds Created": "rebounds_created",
        "Rebounds Created/60": "rebounds_created_per_60",
        "PIM": "pim",
        "PIM/60": "pim_per_60",
        "Total Penalties": "total_penalties",
        "Total Penalties/60": "total_penalties_per_60",
        "Minor": "minor_penalties",
        "Minor/60": "minor_penalties_per_60",
        "Major": "major_penalties",
        "Major/60": "major_penalties_per_60",
        "Misconduct": "misconduct_penalties",
        "Misconduct/60": "misconduct_penalties_per_60",
        "Penalties Drawn": "penalties_drawn",
        "Penalties Drawn/60": "penalties_drawn_per_60",
        "Giveaways": "giveaways",
        "Giveaways/60": "giveaways_per_60",
        "Takeaways": "takeaways",
        "Takeaways/60": "takeaways_per_60",
        "Hits": "hits",
        "Hits/60": "hits_per_60",
        "Hits Taken": "hits_taken",
        "Hits Taken/60": "hits_taken_per_60",
        "Shots Blocked": "shots_blocked",
        "Shots Blocked/60": "shots_blocked_per_60",
        "Faceoffs Won": "faceoffs_won",
        "Faceoffs Won/60": "faceoffs_won_per_60",
        "Faceoffs Lost": "faceoffs_lost",
        "Faceoffs Lost/60": "faceoffs_lost_per_60",
        "Faceoffs %": "faceoffs_percentage",
        # Continue with remaining mappings...
        "CF": "cf",
        "CF%": "cf_pct",
        "CA": "ca",
        "FF": "ff",
        "FF%": "ff_pct",
        "FA": "fa",
        "SF": "sf",
        "SF%": "sf_pct",
        "SA": "sa",
        "GF": "gf",
        "GF%": "gf_pct",
        "GA": "ga",
        "xGF": "xgf",
        "xGF%": "xgf_pct",
        "xGA": "xga",
        "xGA%": "xga_pct",
        "SCF": "scf",
        "SCA": "sca",
        "SCF%": "scf_pct",
        "HDCA": "hdca",
        "HDCF%": "hdcf_pct",
        "HDGF": "hdgf",
        "HDGA": "hdga",
        "HDGF%": "hdgf_pct",
        "MDCF": "mdcf",
        "MDCA": "mdca",
        "MDCF%": "mdcf_pct",
        "MDGF": "mdgf",
        "MDGA": "mdga",
        "MDGF%": "mdgf_pct",
        "LDCF": "ldcf",
        "LDCA": "ldca",
        "LDCF%": "ldcf_pct",
        "LDGF": "ldgf",
        "LDGA": "ldga",
        "LDGF%": "ldgf_pct",
        "On-Ice SH%": "on_ice_sh_pct",
        "On-Ice SV%": "on_ice_sv_pct",
        "PDO": "pdo",
        "Off. Zone Starts": "off_zone_starts",
        "Neu. Zone Starts": "neu_zone_starts",
        "Def. Zone Starts": "def_zone_starts",
        "Off. Zone Start %": "off_zone_start_pct",
        "Off. Zone Faceoffs": "off_zone_faceoffs",
        "Neu. Zone Faceoffs": "neu_zone_faceoffs",
        "Def. Zone Faceoffs": "def_zone_faceoffs",
        "Off. Zone Faceoff %": "off_zone_faceoff_pct",
        "CF/60": "cf_per_60",
        "CA/60": "ca_per_60",
        "FF/60": "ff_per_60",
        "FA/60": "fa_per_60",
        "SF/60": "sf_per_60",
        "SA/60": "sa_per_60",
        "GF/60": "gf_per_60",
        "GA/60": "ga_per_60",
        "xGF/60": "xgf_per_60",
        "xGA/60": "xga_per_60",
        "SCF/60": "scf_per_60",
        "SCA/60": "sca_per_60",
        "HDCA/60": "hdca_per_60",
        "HDGF/60": "hdgf_per_60",
        "HDGA/60": "hdga_per_60",
        "MDCF/60": "mdcf_per_60",
        "MDCA/60": "mdca_per_60",
        "MDGF/60": "mdgf_per_60",
        "MDGA/60": "mdga_per_60",
        "LDCF/60": "ldcf_per_60",
        "LDCA/60": "ldca_per_60",
        "LDGF/60": "ldgf_per_60",
        "LDGA/60": "ldga_per_60",
        "On-Ice SH%/60": "on_ice_sh_pct_per_60",
        "On-Ice SV%/60": "on_ice_sv_pct_per_60",
        "PDO/60": "pdo_per_60",
        "Off. Zone Starts/60": "off_zone_starts_per_60",
        "Neu. Zone Starts/60": "neu_zone_starts_per_60",
        "Def. Zone Starts/60": "def_zone_starts_per_60",
        "Off. Zone Start %/60": "off_zone_start_pct_per_60",
        "Off. Zone Faceoffs/60": "off_zone_faceoffs_per_60",
        "Neu. Zone Faceoffs/60": "neu_zone_faceoffs_per_60",
        "Def. Zone Faceoffs/60": "def_zone_faceoffs_per_60"
    }

    if header == "Player":
        return None

    return header_map.get(header, None)

def get_table_name(dataset_type: str) -> str:
    """Maps datasetType to the corresponding Supabase table name."""
    mapping = {
        # Existing mappings
        "allStrengthsCounts": "nst_gamelog_as_counts",
        "allStrengthsRates": "nst_gamelog_as_rates",
        "powerPlayCounts": "nst_gamelog_pp_counts",
        "powerPlayRates": "nst_gamelog_pp_rates",
        "allStrengthsCountsOi": "nst_gamelog_as_counts_oi",
        "allStrengthsRatesOi": "nst_gamelog_as_rates_oi",
        "powerPlayCountsOi": "nst_gamelog_pp_counts_oi",
        "powerPlayRatesOi": "nst_gamelog_pp_rates_oi",
        # New mappings for es and pk
        "evenStrengthCounts": "nst_gamelog_es_counts",
        "evenStrengthRates": "nst_gamelog_es_rates",
        "penaltyKillCounts": "nst_gamelog_pk_counts",
        "penaltyKillRates": "nst_gamelog_pk_rates",
        "evenStrengthCountsOi": "nst_gamelog_es_counts_oi",
        "evenStrengthRatesOi": "nst_gamelog_es_rates_oi",
        "penaltyKillCountsOi": "nst_gamelog_pk_counts_oi",
        "penaltyKillRatesOi": "nst_gamelog_pk_rates_oi"
    }

    return mapping.get(dataset_type, "unknown_table")

async def get_latest_date_supabase() -> Optional[str]:
    """Retrieves the latest date_scraped from all relevant Supabase tables."""
    table_names = [
        "nst_gamelog_as_counts",
        "nst_gamelog_as_rates",
        "nst_gamelog_pp_counts",
        "nst_gamelog_pp_rates",
        "nst_gamelog_as_counts_oi",
        "nst_gamelog_as_rates_oi",
        "nst_gamelog_pp_counts_oi",
        "nst_gamelog_pp_rates_oi",
        # New tables for es and pk
        "nst_gamelog_es_counts",
        "nst_gamelog_es_rates",
        "nst_gamelog_pk_counts",
        "nst_gamelog_pk_rates",
        "nst_gamelog_es_counts_oi",
        "nst_gamelog_es_rates_oi",
        "nst_gamelog_pk_counts_oi",
        "nst_gamelog_pk_rates_oi",
    ]
    latest_date = None

    for table in table_names:
        try:
            response = supabase.table(table).select("date_scraped").order("date_scraped", desc=True).limit(1).execute()
            if response.data:
                table_latest_date = response.data[0]['date_scraped']
                table_latest_datetime = datetime.strptime(table_latest_date, "%Y-%m-%d")
                if not latest_date or table_latest_datetime > latest_date:
                    latest_date = table_latest_datetime
        except Exception as e:
            print(f"Error fetching latest date from {table}: {e}")
            continue

    return latest_date.strftime("%Y-%m-%d") if latest_date else None

def construct_urls_for_date(date: str, season_id: str) -> Dict[str, str]:
    """Constructs URLs for scraping based on strengths, stdoi, and rates."""
    from_season = season_id
    thru_season = season_id
    common_params = f"fromseason={from_season}&thruseason={thru_season}&stype=2&pos=S&loc=B&toi=0&gpfilt=gpdate&fd={date}&td={date}&lines=single&draftteam=ALL"

    strengths = ["allStrengths", "evenStrength", "powerPlay", "penaltyKill"]
    stdoi_options = ["std", "oi"]
    rates = ["n", "y"]

    urls = {}

    for strength in strengths:
        for stdoi in stdoi_options:
            for rate in rates:
                dataset_type = ""
                tgp = "10" if rate == "n" else "410"

                # Determine datasetType based on strength and stdoi
                if stdoi == "std":
                    if strength == "allStrengths":
                        dataset_type = "allStrengthsCounts"
                    elif strength == "evenStrength":
                        dataset_type = "evenStrengthCounts"
                    elif strength == "powerPlay":
                        dataset_type = "powerPlayCounts"
                    else:
                        dataset_type = "penaltyKillCounts"
                else:
                    if strength == "allStrengths":
                        dataset_type = "allStrengthsCountsOi"
                    elif strength == "evenStrength":
                        dataset_type = "evenStrengthCountsOi"
                    elif strength == "powerPlay":
                        dataset_type = "powerPlayCountsOi"
                    else:
                        dataset_type = "penaltyKillCountsOi"

                # Append rate information only for rate 'y'
                if rate == "y":
                    if strength == "allStrengths":
                        dataset_type = "allStrengthsRates"
                    elif strength == "evenStrength":
                        dataset_type = "evenStrengthRates"
                    elif strength == "powerPlay":
                        dataset_type = "powerPlayRates"
                    else:
                        dataset_type = "penaltyKillRates"

                    if stdoi == "oi":
                        dataset_type += "Oi"

                # Construct the URL
                sit_param = get_sit_param(strength)
                url = f"{BASE_URL}?sit={sit_param}&score=all&stdoi={stdoi}&rate={rate}&team=ALL&{common_params}&tgp={tgp}"
                urls[dataset_type] = url

    return urls

def get_sit_param(strength: str) -> str:
    """Maps strength to 'sit' parameter in URL."""
    mapping = {
        "allStrengths": "all",
        "evenStrength": "ev",
        "powerPlay": "pp",
        "penaltyKill": "pk",
    }
    return mapping.get(strength, "all")

def print_info_block(params: Dict):
    """Prints an information block about the current processing state."""
    print("""
|==========================|
Date: {date}

URL: {url}

Iteration: {datasetType}
Destination: {tableName}

Date URL Count: {dateUrlCount_current}/{dateUrlCount_total}
Total URL Count: {totalUrlCount_current}/{totalUrlCount_total}

Rows Processed: {rowsProcessed}
Rows Prepared: {rowsPrepared}
Rows Upserted: {rowsUpserted}

|==========================|
""".format(
        date=params['date'],
        url=params['url'],
        datasetType=params['datasetType'],
        tableName=params['tableName'],
        dateUrlCount_current=params['dateUrlCount']['current'],
        dateUrlCount_total=params['dateUrlCount']['total'],
        totalUrlCount_current=params['totalUrlCount']['current'],
        totalUrlCount_total=params['totalUrlCount']['total'],
        rowsProcessed=params['rowsProcessed'],
        rowsPrepared=params['rowsPrepared'],
        rowsUpserted=params['rowsUpserted'],
    ))

def print_total_progress(current: int, total: int):
    """Prints the total progress of the scraping process."""
    percentage = (current / total) * 100
    filled = int((percentage / 100) * 20)
    bar = "|" + "=" * filled + "-" * (20 - filled) + "|"
    print(f"Total Progress: {percentage:.2f}% Complete")
    print(f"{bar}  ({current}/{total} URLs)\n")

def print_delay_countdown():
    """Prints a countdown for the delay between requests."""
    delay_seconds = DELAY_SECONDS
    for i in range(int(delay_seconds), 0, -1):
        filled = int(((delay_seconds - i) / delay_seconds) * 20)
        bar = "|" + "=" * filled + "-" * (20 - filled) + "|"
        print(f"\rWaiting: {bar} {i}s remaining", end="")
        time.sleep(1)
    print("\rRequest delay completed" + " " * 30)

def parse_html(html_content: str, dataset_type: str, date: str, season_id: str) -> List[Dict]:
    """Parses the HTML content and extracts data into a list of dictionaries."""
    soup = BeautifulSoup(html_content, "html.parser")
    table = soup.find("table")
    if not table:
        print("No table found in the HTML content.")
        return []

    # Extract headers
    headers = []
    for th in table.find("thead").find_all("th"):
        header = th.get_text(strip=True)
        mapped = map_header_to_column(header)
        headers.append(mapped)

    data_rows_collected = []
    # Extract rows
    for tr in table.find("tbody").find_all("tr"):
        row_data = {}
        player_full_name = None
        player_position = None
        player_team = None

        tds = tr.find_all("td")
        for i, td in enumerate(tds):
            column = headers[i] if i < len(headers) else None
            if column is None:
                original_header = table.find("thead").find_all("th")[i].get_text(strip=True)
                if original_header == "Player":
                    player_full_name = td.get_text(strip=True)
                elif original_header == "Position":
                    player_position = td.get_text(strip=True)
                elif original_header == "Team":
                    player_team = td.get_text(strip=True)
                continue

            cell_text = td.get_text(strip=True)
            if cell_text in ["-", "\\-"]:
                cell_text = None

            if cell_text is not None:
                try:
                    num = float(cell_text.replace(",", ""))
                    row_data[column] = num
                except ValueError:
                    row_data[column] = cell_text
            else:
                row_data[column] = None

        if player_full_name and player_position and player_team and row_data:
            row_data["player_full_name"] = player_full_name
            row_data["player_position"] = player_position
            row_data["player_team"] = player_team
            row_data["date_scraped"] = date
            row_data["season"] = season_id
            data_rows_collected.append(row_data)

    return data_rows_collected

async def get_player_id_by_name(full_name: str, position: str) -> Optional[int]:
    """Retrieves the player ID from Supabase based on full name and position."""
    mapped_name = player_name_mapping.get(full_name, {"fullName": full_name})["fullName"]
    normalized_full_name = normalize_name(mapped_name)
    normalized_position = position.upper()

    requires_position_check = mapped_name in ["Elias Pettersson", "Sebastian Aho"]

    try:
        query = supabase.table("players").select("id").ilike("fullName", f"%{mapped_name}%")
        if requires_position_check:
            query = query.eq("position", normalized_position)
        response = query.limit(1).execute()
        if response.data:
            return response.data[0]['id']
        else:
            troublesome_players.append(f"{full_name} ({position})")
            return None
    except Exception as e:
        print(f"Error fetching player ID for {full_name}: {e}")
        troublesome_players.append(f"{full_name} ({position})")
        return None

async def upsert_data(dataset_type: str, data_rows: List[Dict]):
    """Upserts data rows into the corresponding Supabase table."""
    if not data_rows:
        return 0

    table_name = get_table_name(dataset_type)
    if table_name == "unknown_table":
        print(f"Unknown table for datasetType: {dataset_type}. Skipping upsert.")
        return 0
    

    # ─── strip out unwanted columns for rates_oi ──────────────────────
    if table_name == "nst_gamelog_as_rates_oi":
        drop_cols = [
            # raw counts
            "goals","total_assists","first_assists","second_assists","total_points",
            "shots","icf","iff","iscfs","hdcf","rush_attempts","rebounds_created",
            "pim","total_penalties","minor_penalties","major_penalties",
            "misconduct_penalties","penalties_drawn","giveaways","takeaways",
            "hits","hits_taken","shots_blocked","faceoffs_won","faceoffs_lost",
            "cf","ca","ff","fa","sf","sa","gf","ga","scf","sca","hdca","hdgf",
            "hdga","mdcf","mdca","mdgf","mdga","ldcf","ldca","ldgf","ldga",
            "off_zone_starts","neu_zone_starts","def_zone_starts",
            "off_zone_faceoffs","neu_zone_faceoffs","def_zone_faceoffs",
            # per-60 rates & percentages
            "goals_per_60","total_assists_per_60","first_assists_per_60",
            "second_assists_per_60","total_points_per_60","ipp","shots_per_60",
            "sh_percentage","ixg","ixg_per_60","iff_per_60","iscfs_per_60",
            "rush_attempts_per_60","rebounds_created_per_60","pim_per_60",
            "total_penalties_per_60","minor_penalties_per_60",
            "major_penalties_per_60","misconduct_penalties_per_60",
            "penalties_drawn_per_60","giveaways_per_60","takeaways_per_60",
            "hits_per_60","hits_taken_per_60","shots_blocked_per_60",
            "faceoffs_won_per_60","faceoffs_lost_per_60","faceoffs_percentage",
            "xgf","xga","xga_pct","on_ice_sh_pct_per_60","on_ice_sv_pct_per_60",
            "pdo_per_60","off_zone_start_pct_per_60"
        ]
        for row in data_rows:
            for col in drop_cols:
                row.pop(col, None)
    # ────────────────────────────────────────────────────────────────

    try:
        response = supabase.table(table_name).upsert(data_rows, on_conflict=["player_id", "date_scraped"]).execute()
        return len(data_rows)
    except Exception as e:
        print(f"Error upserting data into {table_name}: {e}")
        return 0

async def check_data_exists(dataset_type: str, date: str) -> bool:
    """Checks if data already exists for the specific dataset type and date."""
    table_name = get_table_name(dataset_type)
    if table_name == "unknown_table":
        return False
    
    try:
        response = supabase.table(table_name).select("player_id").eq("date_scraped", date).limit(1).execute()
        return len(response.data) > 0
    except Exception as e:
        print(f"Error checking data existence: {e}")
        return False

async def process_url(url_info: Dict, current_url_num: int, total_urls: int, date_counts: Dict[str, Dict[str, int]]):
    """Process a single URL with proper rate limiting."""
    dataset_type = url_info['datasetType']
    url = url_info['url']
    date = url_info['date']
    season_id = url_info['seasonId']
    
    # Update counters for date
    if date not in date_counts:
        date_counts[date] = {"current": 0, "total": 0, "processed": 0}
    date_counts[date]["current"] += 1
    
    print(f"\nProcessing URL {current_url_num}/{total_urls}: {dataset_type} for date {date}")
    
    # Check if data already exists
    data_exists = await check_data_exists(dataset_type, date)
    
    rows_processed = 0
    rows_prepared = 0
    rows_upserted = 0
    
    if not data_exists:
        try:
            # Make the request to fetch data
            response = requests.get(url)
            if response.status_code == 200:
                # Parse HTML and extract data
                data_rows = parse_html(response.text, dataset_type, date, season_id)
                rows_processed = len(data_rows)
                
                # Process player IDs
                data_rows_with_ids = []
                for row in data_rows:
                    player_id = await get_player_id_by_name(row["player_full_name"], row["player_position"])
                    if player_id:
                        row["player_id"] = player_id
                        # Remove temporary fields
                        del row["player_full_name"]
                        del row["player_position"]
                        del row["player_team"]
                        data_rows_with_ids.append(row)
                
                rows_prepared = len(data_rows_with_ids)
                
                # Upsert to database
                rows_upserted = await upsert_data(dataset_type, data_rows_with_ids)
            else:
                print(f"Failed to fetch {url}: Status Code {response.status_code}")
        except Exception as e:
            print(f"Error processing URL {url}: {e}")
    else:
        print(f"Data already exists for {dataset_type} on date {date}. Skipping.")
    
    date_counts[date]["processed"] += 1
    
    # Print information block
    print_info_block({
        'date': date,
        'url': url,
        'datasetType': dataset_type,
        'tableName': get_table_name(dataset_type),
        'dateUrlCount': {
            'current': date_counts[date]["current"],
            'total': date_counts[date]["total"]
        },
        'totalUrlCount': {
            'current': current_url_num,
            'total': total_urls
        },
        'rowsProcessed': rows_processed,
        'rowsPrepared': rows_prepared,
        'rowsUpserted': rows_upserted,
    })
    
    # Print total progress
    print_total_progress(current_url_num, total_urls)
    
    return {
        "dataset_type": dataset_type,
        "rows_upserted": rows_upserted
    }

async def main():
    """Main function to orchestrate scraping and upserting."""
    start_time = time.time()
    
    try:
        # Fetch current season info
        # For illustration, let's assume:
        season_id = "20242025"
        season_start_date = datetime.strptime("2024-10-01", "%Y-%m-%d")
        season_end_date = datetime.strptime("2025-04-15", "%Y-%m-%d")  # Example end date

        today = datetime.utcnow()
        scraping_end_date = today if today < season_end_date else season_end_date

        # Determine start date
        latest_date_str = await get_latest_date_supabase()
        if latest_date_str:
            latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d")
            start_date = latest_date + timedelta(days=1)
            print(f"Latest date in Supabase is {latest_date_str}. Starting from {start_date.strftime('%Y-%m-%d')}.")
        else:
            start_date = season_start_date
            print(f"No existing data in Supabase. Starting from season start date {start_date.strftime('%Y-%m-%d')}.")

        dates_to_scrape = get_dates_between(start_date, scraping_end_date)
        if not dates_to_scrape:
            print("No new dates to scrape.")
            return

        # Prepare the URLs queue
        urls_queue = []
        date_counts = {}

        for date in dates_to_scrape:
            urls = construct_urls_for_date(date, season_id)
            
            # Initialize date counts
            if date not in date_counts:
                date_counts[date] = {"current": 0, "total": len(urls), "processed": 0}
            else:
                date_counts[date]["total"] = len(urls)
            
            for dataset_type, url in urls.items():
                urls_queue.append({
                    'datasetType': dataset_type,
                    'url': url,
                    'date': date,
                    'seasonId': season_id
                })

        # Deduplicate URLs
        unique_urls = set()
        unique_urls_queue = []
        for url_info in urls_queue:
            key = f"{url_info['datasetType']}-{url_info['url']}-{url_info['date']}-{url_info['seasonId']}"
            if key not in unique_urls:
                unique_urls.add(key)
                unique_urls_queue.append(url_info)

        total_urls = len(unique_urls_queue)
        print(f"Total URLs to process: {total_urls}")

        # Process URLs sequentially with proper rate limiting
        for i, url_info in enumerate(unique_urls_queue):
            # Apply wait time between requests (except for the first one)
            if i > 0:
                print(f"\nWaiting {DELAY_SECONDS} seconds before next request...")
                print_delay_countdown()
            
            # Process the URL
            await process_url(url_info, i + 1, total_urls, date_counts)
            
        end_time = time.time()
        total_duration = end_time - start_time
        print(f"Total processing time: {total_duration:.2f} seconds")
        
        # Final logging for troublesome players
        if troublesome_players:
            unique_troublesome_players = list(set(troublesome_players))
            print("Troublesome Players (require manual mapping):")
            for player in unique_troublesome_players:
                print(f"- {player}")
    
    except Exception as e:
        print(f"An error occurred in main(): {e}")
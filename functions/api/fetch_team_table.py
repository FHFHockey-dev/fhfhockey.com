# scripts/fetch_team_table.py

import requests
from bs4 import BeautifulSoup
import json
import argparse
import re
import sys

def clean_header(header: str) -> str:
    """
    Replace '/60' with '_perSixty' and '%' with 'Pct' in the header names.
    """
    header = header.replace('/60', '_perSixty')  # Added underscore
    header = header.replace('/GP', '_perGame')  # Added underscore
    header = header.replace('%', 'Pct')
    return header

def validate_percentage(value):
    try:
        num = float(value)
        if 0 <= num <= 100:
            return num
        else:
            return None
    except:
        return None

def fetch_team_table(from_season='20242025', thru_season='20242025',
                    stype='2', sit='pk', score='all', rate='n',
                    team='all', loc='B', gpf='410', fd='', td=''):
    result = {
        "debug": {},
        "data": []
    }

    # Construct the URL with query parameters
    url = (
        f"https://www.naturalstattrick.com/teamtable.php?"
        f"fromseason={from_season}&thruseason={thru_season}&"
        f"stype={stype}&sit={sit}&score={score}&rate={rate}&"
        f"team={team}&loc={loc}&gpf={gpf}&fd={fd}&td={td}"
    )

    # Log the URL being fetched
    result["debug"]["Fetching URL"] = url

    # Define headers to mimic a real browser
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/90.0.4430.93 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;"
            "q=0.9,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.naturalstattrick.com/",
        "Connection": "keep-alive",
    }

    # Start a session to handle cookies
    session = requests.Session()
    session.headers.update(headers)

    try:
        # Initial request to establish session cookies
        response = session.get("https://www.naturalstattrick.com/", timeout=10)
        response.raise_for_status()

        # Fetch the team table page
        response = session.get(url, timeout=10)
        response.raise_for_status()

        # Parse the HTML content
        soup = BeautifulSoup(response.text, 'html.parser')

        # Locate the table by ID
        table = soup.find('table', id='teams')
        if not table:
            result["debug"]["Error"] = f"No table found for sit={sit}, rate={rate}"
            print(json.dumps(result))
            sys.exit(1)  # Exit with non-zero status

        # Extract table headers and clean them
        headers = []
        for th in table.find('thead').find_all('th'):
            raw_header = th.get_text(strip=True)
            cleaned_header = clean_header(raw_header)
            headers.append(cleaned_header)

        # Log the table headers
        result["debug"]["Table headers"] = headers

        # Define necessary columns
        necessary_columns = {
            "Team", "GP", "TOI", "W", "L", "OTL", "Points",
            "CF", "CA", "CFPct", "FF", "FA", "FFPct",
            "SF", "SA", "SFPct", "GF", "GA", "GFPct",
            "xGF", "xGA", "xGFPct", "SCF", "SCA", "SCFPct",
            "HDCF", "HDCA", "HDCFPct", "HDSF", "HDSA", "HDSFPct",
            "HDGF", "HDGA", "HDGFPct", "SHPct", "SVPct", "PDO"
        }

        # Extract table rows
        rows = []
        for tr in table.find('tbody').find_all('tr'):
            cells = tr.find_all('td')
            row = {}
            row['date'] = fd  # Assign the fetch date
            row['situation'] = sit  # Assign the situation

            for i, th in enumerate(headers):
                if th not in necessary_columns:
                    continue  # Skip unnecessary columns
                if i < len(cells):
                    cell_text = cells[i].get_text(strip=True)
                    # Convert '-' to None
                    cell_text = cell_text if cell_text != '-' else None
                    # Validate percentage fields
                    if th.endswith('Pct'):
                        cell_text = validate_percentage(cell_text)
                    row[th] = cell_text
                else:
                    # Assign default value if cell is missing
                    row[th] = None

            if row:  # Ensure row is not empty
                rows.append(row)

        # Log the number of rows parsed
        result["debug"]["Number of rows parsed"] = len(rows)

        # Assign the data
        result["data"] = rows


    except requests.exceptions.HTTPError as http_err:
        result["debug"]["HTTP error"] = f"HTTP error occurred: {http_err} - Status Code: {response.status_code}"
    except Exception as err:
        result["debug"]["Exception"] = f"An error occurred: {err}"

    # Output the data as JSON
    # print(json.dumps(result))
    
    return json.dumps(result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fetch team table data.')
    parser.add_argument('--from_season', default='20242025', help='From season')
    parser.add_argument('--thru_season', default='20242025', help='Thru season')
    parser.add_argument('--stype', default='2', help='SType')
    parser.add_argument('--sit', required=True, help='Situation')
    parser.add_argument('--score', default='all', help='Score')
    parser.add_argument('--rate', required=True, help='Rate')
    parser.add_argument('--team', default='all', help='Team')
    parser.add_argument('--loc', default='B', help='Location')
    parser.add_argument('--gpf', default='410', help='GPF')
    parser.add_argument('--fd', default='', help='FD')
    parser.add_argument('--td', default='', help='TD')
    
    args = parser.parse_args()
    
    fetch_team_table(
        from_season=args.from_season,
        thru_season=args.thru_season,
        stype=args.stype,
        sit=args.sit,
        score=args.score,
        rate=args.rate,
        team=args.team,
        loc=args.loc,
        gpf=args.gpf,
        fd=args.fd,
        td=args.td
    )

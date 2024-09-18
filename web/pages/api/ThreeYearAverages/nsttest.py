# Import necessary modules
import requests
from bs4 import BeautifulSoup
import pandas as pd

# URL for the data
url = "https://naturalstattrick.com/playerreport.php?fromseason=20232024&thruseason=20232024&stype=2&sit=5v5&stdoi=std&rate=n&v=g&playerid=8478402"
req = requests.get(url)

# Check if the request was successful
if req.status_code == 200:
    print("Successfully fetched the webpage.")
else:
    print(f"Failed to fetch the webpage. Status code: {req.status_code}")

# Parse the HTML content using BeautifulSoup
soup = BeautifulSoup(req.content, 'html.parser')

# Find the target table
target_table = soup.find('table')

# Extract initial headers from <th> elements
headers = [header.get_text(strip=True) for header in target_table.find_all('th')]

# Extract data rows
table_data = []
extra_headers_added = False  # Flag to check if extra headers have been added

for row in target_table.find_all('tr'):
    cells = row.find_all('td')
    if cells:
        cell_data = [cell.get_text(strip=True) for cell in cells]
        # Check if this row contains the extra headers
        if cell_data == ['On-Ice SH%', 'On-Ice SV%', 'PDO']:
            # Append these to the headers
            headers.extend(cell_data)
            extra_headers_added = True
            continue  # Skip this row as it's part of the headers
        else:
            table_data.append(cell_data)

# Now, check for mismatches and adjust rows if necessary
print(f"Number of headers: {len(headers)}")
print(f"Number of data rows: {len(table_data)}")
for i, row in enumerate(table_data):
    if len(row) != len(headers):
        print(f"Row {i} has {len(row)} columns, expected {len(headers)}.")
        # Adjust the row length
        if len(row) < len(headers):
            row += [None] * (len(headers) - len(row))
        elif len(row) > len(headers):
            row = row[:len(headers)]
        table_data[i] = row  # Update the row

# Create DataFrame
df = pd.DataFrame(table_data, columns=headers)

# Display the first few rows of the DataFrame
print("\nFirst 5 rows of the DataFrame:")
print(df.head())

# Proceed with restructuring the data as needed
# For example, extract 'homeTeam' and 'awayTeam' from 'Game' column
structured_data = {}

for index, row in df.iterrows():
    game_info = row['Game']
    if pd.isna(game_info):
        continue  # Skip rows with missing game information
    date_and_teams = game_info.split()
    if len(date_and_teams) >= 2:
        date = date_and_teams[0]
        teams = ' '.join(date_and_teams[1:])
        if ' at ' in teams:
            away_team, home_team = teams.split(' at ')
        else:
            continue  # Skip if the format is unexpected
        # Remove 'Game' column from row data
        row_data = row.drop(labels=['Game']).to_dict()
        # Add 'homeTeam' and 'awayTeam'
        row_data['homeTeam'] = home_team
        row_data['awayTeam'] = away_team
        structured_data[date] = row_data

# Output the restructured data
print("\nRestructured Data:")
print(pd.DataFrame(structured_data).transpose())

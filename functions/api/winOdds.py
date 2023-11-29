from http.server import BaseHTTPRequestHandler
import requests
import json 
from urllib.parse import urlparse, parse_qs

import pandas as pd
import numpy as np

class handler(BaseHTTPRequestHandler):

  def do_GET(self):
    self.send_response(200)
    
    self.send_header('Content-type', 'application/json')
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Cache-Control", "max-age=86400")

    self.end_headers()
    # get season, home_team and away_team
    url = urlparse(self.path)
    query = parse_qs(url.query)
    try:
        self.wfile.write(get_game_scores(query["HomeTeam"][0],query["AwayTeam"][0], query["Season"][0]).encode())
    except Exception as e:
        self.wfile.write(json.dumps({
            "success":False,
            "message":"Invalid request" + str(e)
        }).encode())
        
    return

cache = {}
def fetch_data(season_id):
    if season_id in cache:
        return cache[season_id]
    # seasonId<=20212022 and seasonId>=20212022
    start_season_id = season_id
    end_season_id = season_id
    query = 'isAggregate=false&isGame=false&sort=[{"property":"points","direction":"DESC"},{"property":"wins","direction":"DESC"},{"property":"teamId","direction":"ASC"}]&start=0&limit=50&factCayenneExp=gamesPlayed>=1&cayenneExp=gameTypeId=2 and '+ \
            f'seasonId<={end_season_id} and seasonId>={start_season_id}'
    url =  f"https://api.nhle.com/stats/rest/en/team/summary?{query}"

    data = requests.get(url).json()
    data = data["data"]

    df = pd.DataFrame.from_dict(data)

    # Make team name display at the first column
    columns = df.columns.tolist()
    columns.remove("teamFullName")
    columns = ["teamFullName", *columns]

    # remove ties
    if "ties" in columns:
        columns.remove("ties")

    df = df[columns]

    df["O-Strength"] = df["goalsForPerGame"] / df["goalsForPerGame"].mean()
    df["D-Strength"] = df["goalsAgainstPerGame"] / df["goalsAgainstPerGame"].mean()
    cache[season_id] = df
    return df


def get_XGF(home_team, away_team, df):
    avgGFperGame = df["goalsForPerGame"].mean()
    home_team_data = df[df["teamFullName"]==home_team]
    away_team_data = df[df["teamFullName"]==away_team]

    home_OScore = home_team_data["O-Strength"].iloc[0]
    away_DScore = away_team_data["D-Strength"].iloc[0]

    xGF = (home_OScore * away_DScore) * avgGFperGame

    return xGF

def pmf(k,mu):
    return np.exp(-1*mu) * mu**k / np.math.factorial(k)

def get_game_scores_(home_team, away_team,season_id):
    df = fetch_data(season_id)
    
    home_xGF = get_XGF(home_team, away_team,df)
    away_xGF = get_XGF(away_team, home_team,df)

    num_rows = 10
    num_cols = 10
    table = []

    for row_idx in range(num_rows):
        col = []
        for col_idx in range(num_cols):
            first = pmf(mu=home_xGF, k=row_idx)
            second = pmf(mu=away_xGF, k=col_idx)
            r = first*second
            col.append(r)
        table.append(col)

    table = np.array(table)


    red = 0
    row_idx = 1
    for col_idx in range(table.shape[1]-1):
        col = table[row_idx:, col_idx]
        red += np.sum(col)
        row_idx += 1
        
    blue = np.sum(table.diagonal())

    yellow = 0

    row_idx = 1
    for col_idx in range(1, table.shape[1]):
        col = table[:row_idx, col_idx]
        yellow += np.sum(col)
        row_idx += 1

    home_score = red + blue/2
    away_score = yellow + blue/2
    odds = home_score + away_score
    
    return [odds, home_score, away_score]


def get_game_scores(home_team, away_team,season_id):
    # global df
    # if type(df) == type(None):
    #     print("df is None, fetching data")
    #     df= await fetch_data()
    scores = get_game_scores_(home_team,away_team,season_id)
    return json.dumps({
        "winOdds":scores[1]
    })
# from http.server import HTTPServer

# server_address = ('0.0.0.0', 3003)
# httpd = HTTPServer(server_address, handler)
# httpd.serve_forever() 
"""Bounded, read-only source capture and identity-only SQL preparation. Never executes SQL."""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parent
EXPECTED_ROWS = 273
EXPECTED_PLAYERS = 33
EXPECTED_PLAYER_SEASONS = 45
IDENTITY = ('game_id', 'team_abbrev', 'opponent_team_abbrev', 'home_road')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def source_url(player, season):
    if not isinstance(player, int) or not isinstance(season, int):
        raise ValueError('Invalid player/season identity')
    return f'https://api-web.nhle.com/v1/player/{player}/game-log/{season}/2'


def capture(rows):
    pairs = sorted({(r['player_id'], r['season_id']) for r in rows})
    if len(pairs) != EXPECTED_PLAYER_SEASONS:
        raise ValueError('Player-season scope changed')
    directory = ROOT / 'source'
    directory.mkdir(exist_ok=True)
    for player, season in pairs:
        path = directory / f'{player}-{season}.json'
        if path.exists():
            continue
        if (player, season) == (8481004, 20212022):
            print('Skipped 8481004/20212022 after two bounded TLS/connect timeouts; alternative official source pending', flush=True)
            continue
        # System curl uses its trusted certificate store; verification is never disabled.
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--connect-timeout', '15', '--max-time', '45', source_url(player, season)], check=True, capture_output=True)
        payload = json.loads(result.stdout)
        if payload.get('seasonId') != season or payload.get('gameTypeId') != 2 or not isinstance(payload.get('gameLog'), list):
            raise ValueError(f'Wrong source identity: {player}/{season}')
        path.write_bytes(result.stdout)
        print(f'Captured {player}/{season}: {len(payload["gameLog"])} games', flush=True)
        time.sleep(1)


def match(row, source, allow_season_correction=False):
    if any(row.get(k) is not None for k in IDENTITY) or row['games_played'] != 1:
        raise ValueError('Row no longer belongs to the all-null appearance scope')
    season = source.get('seasonId')
    if not isinstance(season, int):
        raise ValueError('Season/type mismatch')
    year = season // 10000
    if season != year * 10000 + year + 1 or source.get('gameTypeId') != 2 or (row['season_id'] != season and not allow_season_correction):
        raise ValueError('Season/type mismatch')
    matches = [g for g in source['gameLog'] if g.get('gameDate') == row['date']]
    if len(matches) != 1:
        raise ValueError(f'Expected one exact source date, found {len(matches)}')
    game = matches[0]
    if not isinstance(game.get('gameId'), int) or not re.fullmatch(f'{year}02[0-9]{{4}}', str(game['gameId'])):
        raise ValueError('Invalid regular-season game ID')
    for field in ('teamAbbrev', 'opponentAbbrev'):
        if not isinstance(game.get(field), str) or not re.fullmatch('[A-Z]{2,3}', game[field]):
            raise ValueError(f'Invalid {field}')
    if game['teamAbbrev'] == game['opponentAbbrev'] or game.get('homeRoadFlag') not in ('H', 'R'):
        raise ValueError('Invalid matchup')
    fields = [('goals', 'goals'), ('assists', 'assists'), ('points', 'points'), ('shots', 'shots'), ('plus_minus', 'plusMinus'), ('penalty_minutes', 'pim')]
    for stored, official in fields:
        if row.get(stored) is None or game.get(official) is None or row[stored] != game[official]:
            raise ValueError(f'Stat mismatch: {stored} stored={row.get(stored)} official={game.get(official)}')
    toi = game.get('toi', '')
    if not re.fullmatch(r'\d+:\d{2}', toi):
        raise ValueError('Invalid official TOI')
    minutes, seconds = map(int, toi.split(':'))
    if seconds >= 60 or row.get('toi_per_game') != minutes * 60 + seconds:
        raise ValueError(f'TOI mismatch: {row.get("toi_per_game")} vs {toi}')
    return {**{k: row[k] for k in ('id', 'player_id', 'date', 'season_id', 'before_md5', 'preserved_md5')}, 'season_id': season, 'original_season_id': row['season_id'], 'game_id': game['gameId'], 'team_abbrev': game['teamAbbrev'], 'opponent_team_abbrev': game['opponentAbbrev'], 'home_road': game['homeRoadFlag']}



def normalize_summary(payload, player, season):
    data = payload.get('data')
    if not isinstance(data, list) or payload.get('total') != len(data) or len(data) > 100:
        raise ValueError('Incomplete official summary response')
    games = []
    for row in data:
        if row.get('playerId') != player or row.get('gamesPlayed') != 1 or not re.fullmatch(f'{season//10000}02[0-9]{{4}}', str(row.get('gameId'))):
            raise ValueError('Official summary player/season/type mismatch')
        toi = row.get('timeOnIcePerGame')
        if not isinstance(toi, (float, int)) or toi < 0 or int(toi) != toi:
            raise ValueError('Invalid summary TOI')
        minutes, seconds = divmod(int(toi), 60)
        games.append({**row, 'opponentAbbrev': row.get('opponentTeamAbbrev'), 'homeRoadFlag': row.get('homeRoad'), 'pim': row.get('penaltyMinutes'), 'toi': f'{minutes}:{seconds:02d}'})
    return {'seasonId': season, 'gameTypeId': 2, 'gameLog': games}


def load_source(player, season):
    path = ROOT/'source'/f'{player}-{season}.json'
    if path.exists():
        raw = path.read_bytes()
        return path, raw, json.loads(raw), source_url(player, season)
    path = ROOT/'source'/f'{player}-{season}-summary.json'
    raw = path.read_bytes()
    url = (ROOT/'source'/f'{player}-{season}-summary.url.txt').read_text().strip()
    return path, raw, normalize_summary(json.loads(raw), player, season), url


def prepare(rows):
    if len(rows) != EXPECTED_ROWS or len({r['player_id'] for r in rows}) != EXPECTED_PLAYERS or len({r['id'] for r in rows}) != EXPECTED_ROWS:
        raise ValueError('Frozen row/player scope changed')
    repairs, rejected, sources = [], [], {}
    for row in rows:
        try:
            path, raw, source, url = load_source(row['player_id'], row['season_id'])
            # A source-confirmed correction may use an already-captured log for this
            # exact player. Never manufacture a season or resolve by current team.
            if not any(g.get('gameDate') == row['date'] for g in source['gameLog']):
                alternatives = []
                for other in sorted((ROOT/'source').glob(f'{row["player_id"]}-*.json')):
                    if other.name.endswith('-summary.json'):
                        continue
                    candidate = json.loads(other.read_bytes())
                    if any(g.get('gameDate') == row['date'] for g in candidate.get('gameLog', [])):
                        alternatives.append((other, candidate))
                if len(alternatives) != 1:
                    raise ValueError(f'No unique authoritative alternate season: {len(alternatives)}')
                path, source = alternatives[0]
                raw = path.read_bytes()
                url = source_url(row['player_id'], source['seasonId'])
            repair = match(row, source, allow_season_correction=True)
            repairs.append(repair)
            sources[path.name] = {'url': url, 'sha256': sha256(raw), 'bytes': len(raw), 'captured_at': datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat()}
        except (ValueError, OSError, KeyError) as error:
            rejected.append({'id': row['id'], 'player_id': row['player_id'], 'date': row['date'], 'reason': str(error)})
    keys = [(r['player_id'], r['game_id']) for r in repairs]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate player/game in proposed repair')
    report = {'status': 'blocked' if rejected else 'source_validated_not_executed', 'scope_rows': len(rows), 'matched_rows': len(repairs), 'rejected': rejected, 'sources': sources, 'repairs': repairs, 'captured_rows_sha256': sha256((ROOT/'captured-rows.json').read_bytes())}
    (ROOT/'source-plan.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('repairs', 'sources')}, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch-source', action='store_true', help='Fetch at most 45 public NHL logs, sequentially; never writes production data')
    args = parser.parse_args()
    rows = json.loads((ROOT/'captured-rows.json').read_text())
    if args.fetch_source:
        capture(rows)
    prepare(rows)

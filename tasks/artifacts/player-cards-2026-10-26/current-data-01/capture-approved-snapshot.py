"""One owner-approved public NHL snapshot. Exclusive intent prevents duplicate execution."""
from pathlib import Path
from datetime import datetime, timezone
import urllib.request, urllib.error, json, hashlib, time, signal, socket

root = Path(__file__).resolve().parent
dest = root / 'approved-snapshot-01'
dest.mkdir(exist_ok=True)
intent = dest / 'EXECUTION-INTENT.json'
started = time.monotonic()
utc = lambda: datetime.now(timezone.utc).isoformat()
approval = {'assistantMessage': 'Sentinel_96ec1a4dd0d08191bfb33a1897f3dc87', 'userReply': 'Sentinel_fca3d11ad3988191b3fa135d5eaf3f1b', 'userAnswer': 'yes', 'approvedAt': '2026-10-26T22:57:28Z', 'source': 'Scout trusted delegation quoting direct owner response'}
receipt = {'startedAt': utc(), 'approval': approval, 'calls': [], 'status': 'started', 'limits': {'calls': 3, 'concurrency': 1, 'perRequestSeconds': 5, 'totalSeconds': 15, 'perResponseBytes': 524288, 'totalBytes': 1572864, 'gameLogRows': 100, 'scheduleRows': 140, 'redirects': 0, 'retries': 0}, 'databaseReads': 0, 'remoteWrites': 0, 'authOrProfileChanges': 0}
with intent.open('x') as output:
    json.dump({'startedAt': receipt['startedAt'], 'approval': approval, 'oneExecutionNoRetry': True}, output, indent=2)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise RuntimeError('Redirect refused; no alternate URL requested')

def timeout(_signal, _frame):
    raise TimeoutError('Approved overall 15-second limit reached')

signal.signal(signal.SIGALRM, timeout)
signal.setitimer(signal.ITIMER_REAL, 15)
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
total = 0

def fetch(name, url):
    global total
    call = {'name': name, 'url': url, 'startedAt': utc(), 'bytes': 0, 'status': 'started'}
    receipt['calls'].append(call)
    (dest / 'RECEIPT.json').write_text(json.dumps(receipt, indent=2) + '\n')
    start = time.monotonic()
    request = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'fhfhockey-player-cards/1.0'})
    chunks = []
    with opener.open(request, timeout=min(5, 15 - (time.monotonic() - started))) as response:
        call['httpStatus'] = response.status
        if response.status != 200 or response.geturl() != url or 'application/json' not in response.headers.get('Content-Type', ''):
            raise RuntimeError('Unexpected HTTP status, URL or content type')
        announced = response.headers.get('Content-Length')
        if announced and int(announced) > 524288:
            raise RuntimeError('Announced response exceeds approved byte cap')
        while True:
            remaining = min(5 - (time.monotonic() - start), 15 - (time.monotonic() - started))
            if remaining <= 0:
                raise TimeoutError('Approved request/overall time limit reached')
            connection = response.fp.raw._sock
            connection.settimeout(remaining)
            part = response.read1(min(65536, 524289 - call['bytes']))
            if not part:
                break
            call['bytes'] += len(part)
            total += len(part)
            if call['bytes'] > 524288 or total > 1572864:
                raise RuntimeError('Approved response/total byte cap exceeded')
            chunks.append(part)
    raw = b''.join(chunks)
    (dest / (name + '.json')).write_bytes(raw)
    call.update({'status': 'received', 'finishedAt': utc(), 'elapsedSeconds': round(time.monotonic() - start, 4), 'sha256': hashlib.sha256(raw).hexdigest()})
    (dest / 'RECEIPT.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return json.loads(raw)

try:
    identity = fetch('landing', 'https://api-web.nhle.com/v1/player/8476453/landing')
    if identity.get('playerId') != 8476453 or identity.get('currentTeamAbbrev') != 'TBL':
        raise RuntimeError('Player/team identity mismatch; stopped without other URLs')
    seasons = [row for row in identity.get('seasonTotals', []) if row.get('season') == 20262027 and row.get('gameTypeId') == 2 and row.get('leagueAbbrev') == 'NHL']
    if len(seasons) != 1 or not isinstance(seasons[0].get('gamesPlayed'), int):
        raise RuntimeError('Current season appearance-total identity unavailable; stopped')
    history = fetch('game-log', 'https://api-web.nhle.com/v1/player/8476453/game-log/20262027/2')
    if history.get('seasonId') != 20262027 or history.get('gameTypeId') != 2 or not isinstance(history.get('gameLog'), list) or len(history['gameLog']) > 100:
        raise RuntimeError('Game-log season/type/row-cap mismatch; stopped')
    if seasons[0]['gamesPlayed'] != len(history['gameLog']):
        raise RuntimeError('Season GP does not reconcile with game-log count; stopped')
    schedule = fetch('team-schedule', 'https://api-web.nhle.com/v1/club-schedule-season/TBL/20262027')
    if schedule.get('currentSeason') != 20262027 or not isinstance(schedule.get('games'), list) or len(schedule['games']) > 140:
        raise RuntimeError('Schedule season/row-cap mismatch; stopped')
    ids = [row.get('gameId') for row in history['gameLog']]
    if len(ids) != len(set(ids)):
        raise RuntimeError('Duplicate game-log identities; stopped')
    for row in history['gameLog']:
        matches = [game for game in schedule['games'] if game.get('id') == row.get('gameId')]
        if len(matches) != 1:
            raise RuntimeError('Missing or duplicate final-game schedule identity; stopped')
        game = matches[0]
        if game.get('season') != 20262027 or game.get('gameType') != 2 or game.get('gameDate') != row.get('gameDate') or game.get('gameState') not in ['OFF', 'FINAL'] or row.get('teamAbbrev') not in [game.get('homeTeam', {}).get('abbrev'), game.get('awayTeam', {}).get('abbrev')]:
            raise RuntimeError('Game season/date/finality/team mismatch; stopped')
    receipt.update({'status': 'received-and-identity-validated', 'playerId': 8476453, 'season': 20262027, 'seasonGp': seasons[0]['gamesPlayed'], 'gameLogRows': len(history['gameLog']), 'scheduleRows': len(schedule['games']), 'actualGameEndsQualified': False, 'leagueRanksQualified': False})
except Exception as error:
    receipt.update({'status': 'stopped', 'error': f'{type(error).__name__}: {error}', 'retryPermitted': False})
finally:
    signal.setitimer(signal.ITIMER_REAL, 0)
    receipt.update({'finishedAt': utc(), 'elapsedSeconds': round(time.monotonic() - started, 4), 'totalBytes': total, 'callsStarted': len(receipt['calls'])})
    (dest / 'RECEIPT.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)

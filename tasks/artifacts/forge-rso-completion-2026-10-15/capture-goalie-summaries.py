"""Two explicitly approved credited-stat reads; default is plan-only."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import time
from urllib.parse import parse_qs, urlsplit

spec = importlib.util.spec_from_file_location('native_capture', Path(__file__).with_name('capture-native-sources.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def validate(allocation):
    version = allocation.get('version')
    if version not in ('forge-rso-goalie-summary-allocation-v1', 'forge-rso-goalie-summary-continuation-v1'):
        raise ValueError('Unexpected allocation')
    rows = allocation['players']
    expected_ids = {8479979} if version == 'forge-rso-goalie-summary-continuation-v1' else {8479394, 8479979}
    if len(rows) != len(expected_ids) or {row['nhlPlayerId'] for row in rows} != expected_ids:
        raise ValueError('Unexpected goalie scope')
    for row in rows:
        url = urlsplit(row['url'])
        expected = {'isAggregate': ['false'], 'isGame': ['true'], 'start': ['0'], 'limit': ['50'],
                    'factCayenneExp': ['gamesPlayed>=1'], 'cayenneExp': [
                        f'playerId={row["nhlPlayerId"]} and seasonId=20262027 and gameDate>="2026-09-29" and gameDate<="2026-10-12" and gameTypeId=2']}
        if (url.scheme != 'https' or url.netloc != 'api.nhle.com' or url.path != '/stats/rest/en/goalie/summary'
                or url.fragment or parse_qs(url.query) != expected):
            raise ValueError('Unexpected goalie summary URL')
    games = allocation['games']
    if len(games) != 60 or len({game['id'] for game in games}) != 60 or any(
            game['seasonId'] != 20262027 or game['type'] != 2 or not '2026-09-29' <= game['date'] <= '2026-10-12'
            for game in games):
        raise ValueError('Unexpected admitted game metadata')
    return rows


def run(allocation, digest, approval, output, fetch=base.transport):
    players = validate(allocation)
    reservation = allocation['reservationMetadata']
    raw = Path(reservation['path']).read_bytes()
    if base.sha(raw) != reservation['sha256']:
        raise ValueError('Reservation metadata changed')
    reserved = {g['id'] for day in json.loads(raw)['days'] for g in day['games']}
    games = {g['id']: g for g in allocation['games']}
    if reserved.intersection(games):
        raise ValueError('Reserved game overlap')
    output.mkdir(mode=0o700)
    base.private_write(output / 'allocation.json', json.dumps(allocation).encode())
    ledger = output / 'exposure-ledger.jsonl'
    base.private_write(ledger, b'')
    started = time.monotonic()
    receipts, failures = [], []
    attempted = 0
    def event(action, player, **extra):
        with ledger.open('a') as stream:
            stream.write(json.dumps({'atUTC': base.clock(), 'action': action, 'nhlPlayerId': player['nhlPlayerId'],
                'sourceURL': player['url'], 'approvalRef': approval, 'allocationSHA256': digest,
                'use': 'development_only', **extra}) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
    for index, player in enumerate(players):
        if index:
            time.sleep(1)
        event('acquisition_intent', player)
        path = output / f'{player["nhlPlayerId"]}-summary.json'
        try:
            remaining = 20 - (time.monotonic() - started)
            if remaining <= 0:
                raise TimeoutError('Total budget exhausted')
            attempted += 1
            fetch(player['url'], path, base.MAX_BODY, min(8, remaining))
            raw = path.read_bytes()
            receipt = {'url': player['url'], 'capturedAt': base.clock(), 'bodySha256': base.sha(raw), 'rawBody': raw.decode('utf8')}
            event('retained_whole_body_decode_intent', player, bodyBytes=len(raw), bodySHA256=receipt['bodySha256'],
                  decodedScope='entire_original_summary_body_all_present_fields')
            body = json.loads(receipt['rawBody'])
            rows = body.get('data')
            if (not isinstance(rows, list) or type(body.get('total')) is not int
                    or body['total'] != len(rows) or not 0 <= len(rows) < 50
                    or len({row.get('gameId') for row in rows}) != len(rows)):
                raise ValueError('Incomplete or ambiguous per-game page')
            for row in rows:
                game = games.get(row.get('gameId'))
                if (not game or row.get('playerId') != player['nhlPlayerId']
                        or ('seasonId' in row and row['seasonId'] != game['seasonId'])
                        or row.get('gameDate') != game['date']):
                    raise ValueError('Per-game row outside exact allocated player/game/date scope')
            receipts.append(receipt)
            event('whole_body_decode_completed', player, rows=len(rows))
        except Exception as error:
            reason = str(error) if isinstance(error, base.TransportFailure) else type(error).__name__
            failures.append({'url': player['url'], 'reason': reason})
            event('failed_stopped', player, reason=reason, retainedPath=str(path), bodyBytes=path.stat().st_size if path.exists() else 0)
            break
    result = {'receipts': receipts, 'failures': failures, 'completedAt': base.clock(),
              'unattemptedRequests': len(players) - attempted, 'publicUsesApproved': False}
    base.private_write(output / 'receipts.json', json.dumps(result).encode())
    return {'successfulRequests': len(receipts), 'failures': failures,
            'unattemptedRequests': result['unattemptedRequests'], 'publicUsesApproved': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allocation', type=Path, required=True)
    parser.add_argument('--execute-approved-sha256')
    parser.add_argument('--approval-ref')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    raw = args.allocation.read_bytes()
    if len(raw) > 128 * 1024:
        raise ValueError('Allocation too large')
    allocation = json.loads(raw)
    validate(allocation)
    digest = base.sha(raw)
    if not args.execute_approved_sha256:
        print(json.dumps({'mode': 'plan_only', 'allocationSHA256': digest, 'requests': len(allocation['players']), 'sourceRequests': 0}))
    else:
        if args.execute_approved_sha256 != digest or not args.approval_ref or not args.out:
            raise ValueError('Exact approved hash, approval reference and exclusive output required')
        print(json.dumps(run(allocation, digest, args.approval_ref, args.out)))

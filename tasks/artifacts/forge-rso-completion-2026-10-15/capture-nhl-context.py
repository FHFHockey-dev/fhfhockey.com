"""Private NHL context proposal/capture. Plan mode makes no network requests.

Whole-body execution requires a new exact allocation approval. No inference,
forecast evaluation, database access, credentials, redirects or retries.
"""
import argparse
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import http.client
import json
import os
from pathlib import Path
import re
import runpy
import socket
import ssl
import sys
import time
from urllib.parse import urlsplit

BASE = runpy.run_path(str(Path(__file__).with_name('capture-native-sources.py')))
sha, clock, private_write = BASE['sha'], BASE['clock'], BASE['private_write']
TransportFailure = BASE['TransportFailure']
HOST = 'api-web.nhle.com'
MAX_BODY = 1024 * 1024
MAX_TOTAL = 24 * MAX_BODY
TOTAL_SECONDS = 240
HISTORICAL = ['2026-09-29', '2026-10-06']
FUTURE = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04', '2026-12-11']
CLUBS = [4, 8, 9, 10, 14, 15, 16, 17, 22, 25, 26, 30, 54]


def positive(value):
    return type(value) is int and 0 < value < 2**53


def validate(data):
    continuation = data.get('version') == 'forge-rso-nhl-context-continuation-v1'
    extra_keys = {'reuse', 'priorCaptureLedger'} if continuation else set()
    if (set(data) != extra_keys | {'version', 'seasonId', 'historicalDates', 'futureDates', 'protectedOutcomeDates', 'scheduleDates', 'rosterClubIds', 'teamDirectory', 'roster', 'bindingSources', 'wholeBodyExposure', 'requests'}
            or not continuation and data.get('version') != 'forge-rso-nhl-context-allocation-v1' or data.get('seasonId') != 20262027
            or data.get('historicalDates') != ['2026-09-29', '2026-10-12']
            or data.get('futureDates') != ['2026-10-16', '2026-12-17']
            or data.get('protectedOutcomeDates') != ['2026-10-13', '2026-10-25']
            or data.get('scheduleDates') != (FUTURE[1:] if continuation else HISTORICAL + FUTURE) or data.get('rosterClubIds') != CLUBS
            or not isinstance(data.get('wholeBodyExposure'), str) or not data['wholeBodyExposure'].strip()):
        raise ValueError('Invalid finite context allocation')
    directory = data['teamDirectory']
    if (len(directory) != 32 or len({row['teamId'] for row in directory}) != 32
            or len({row['abbreviation'] for row in directory}) != 32
            or any(not positive(row['teamId']) or not re.fullmatch('[A-Z]{3}', row['abbreviation']) for row in directory)):
        raise ValueError('Canonical club directory is incomplete or conflicting')
    teams = {row['teamId']: row['abbreviation'] for row in directory}
    roster = data['roster']
    if (len(roster) != 19 or len({row['playerId'] for row in roster}) != 19
            or len({row['nhlPlayerId'] for row in roster}) != 19
            or {row['teamId'] for row in roster} != set(CLUBS)
            or any(not all(positive(row[key]) for key in ('playerId', 'nhlPlayerId', 'teamId')) for row in roster)):
        raise ValueError('Exact nineteen-player canonical roster required')
    sources = data['bindingSources']
    if len(sources) != 2 or any(not isinstance(row['path'], str) or not re.fullmatch('[a-f0-9]{64}', row['sha256']) for row in sources):
        raise ValueError('Approved binding metadata references required')
    requests = [{'kind': 'historical' if day in HISTORICAL else 'future', 'date': day,
                 'url': f'https://{HOST}/v1/schedule/{day}'} for day in HISTORICAL + FUTURE]
    requests += [{'kind': 'roster', 'teamId': team, 'abbreviation': teams[team],
                  'url': f'https://{HOST}/v1/roster/{teams[team]}/20262027'} for team in CLUBS]
    if continuation:
        reuse = data['reuse']
        if not isinstance(reuse, list) or len(reuse) != 3:
            raise ValueError('Continuation requires exact three retained original sources')
        for index, row in enumerate(reuse):
            expected_status = 'successful_historical' if index < 2 else 'quarantined_pregame_requires_new_approval'
            if (set(row) != {'url', 'path', 'bodySha256', 'capturedAt', 'status'}
                    or row['url'] != requests[index]['url'] or row['status'] != expected_status
                    or not Path(row['path']).is_absolute() or not re.fullmatch('[a-f0-9]{64}', row['bodySha256'])
                    or datetime.fromisoformat(row['capturedAt'].replace('Z', '+00:00')).tzinfo is None):
                raise ValueError('Retained source scope or original provenance invalid')
        ledger = data['priorCaptureLedger']
        if set(ledger) != {'path', 'sha256'} or not Path(ledger['path']).is_absolute() or not re.fullmatch('[a-f0-9]{64}', ledger['sha256']):
            raise ValueError('Prior exposure ledger reference invalid')
        requests = requests[3:]
    if data.get('requests') != [row['url'] for row in requests] or len(requests) != (21 if continuation else 24):
        raise ValueError('Exact context URL allowlist mismatch')
    return requests


def validate_payload(payload, request, allocation, captured_at):
    teams = {row['teamId']: row['abbreviation'] for row in allocation['teamDirectory']}
    if request['kind'] == 'roster':
        if (not isinstance(payload, dict) or any(not isinstance(payload.get(key), list) for key in ('forwards', 'defensemen', 'goalies'))
                or payload.get('teamId', request['teamId']) != request['teamId']
                or payload.get('teamAbbrev', request['abbreviation']) != request['abbreviation']
                or payload.get('seasonId', 20262027) != 20262027 or payload.get('season', 20262027) != 20262027):
            raise ValueError('Roster endpoint identity or arrays incompatible')
        rows = [row for key in ('forwards', 'defensemen', 'goalies') for row in payload[key]]
        if not 1 <= len(rows) <= 100 or any(not positive(row.get('id')) for row in rows) or len({row['id'] for row in rows}) != len(rows):
            raise ValueError('Roster player identity scope invalid')
        observed = {row['id'] for row in rows}
        return {'clubId': request['teamId'], 'playerRows': len(rows), 'bindings': [
            {'playerId': row['playerId'], 'nhlPlayerId': row['nhlPlayerId'], 'present': row['nhlPlayerId'] in observed}
            for row in allocation['roster'] if row['teamId'] == request['teamId']],
            'historicalEligibilityEstablished': False, 'absenceMeaning': 'unknown'}
    first = date.fromisoformat(request['date'])
    expected = [(first + timedelta(days=i)).isoformat() for i in range(7)]
    days = payload.get('gameWeek') if isinstance(payload, dict) else None
    if not isinstance(days, list) or len(days) != 7 or sorted(day.get('date', '') for day in days) != expected:
        raise ValueError('Whole-body schedule dates exceed or omit exact approved week')
    seen = set()
    games = []
    now = datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
    for day in days:
        if not isinstance(day.get('games'), list):
            raise ValueError('Schedule day games missing')
        if 'numberOfGames' in day and (type(day['numberOfGames']) is not int or day['numberOfGames'] != len(day['games'])):
            raise ValueError('Declared daily game count conflicts with complete frame')
        for game in day['games']:
            if (not positive(game.get('id')) or game['id'] in seen or game.get('season') != 20262027
                    or game.get('gameDate') is not None and game['gameDate'] != day['date'] or game.get('gameType') not in (1, 2, 3)
                    or game['id'] // 1000000 != 2026 or (game['id'] // 10000) % 100 != game['gameType']):
                raise ValueError('Schedule game identity or season invalid')
            seen.add(game['id'])
            home, away = game.get('homeTeam', {}), game.get('awayTeam', {})
            if (home.get('id') == away.get('id') or any(team.get('id') not in teams
                    or team.get('abbrev') != teams[team['id']] for team in (home, away))):
                raise ValueError('Schedule club identity mismatch')
            start = datetime.fromisoformat(game.get('startTimeUTC', '').replace('Z', '+00:00'))
            if start.tzinfo is None or abs((start.astimezone(timezone.utc).date() - date.fromisoformat(day['date'])).days) > 1:
                raise ValueError('Schedule game clock invalid')
            if request['kind'] == 'future' and (game.get('gameState') not in ('FUT', 'PRE') or start <= now
                    or any('score' in team for team in (home, away)) or any(key in game for key in ('winningGoalie', 'winningGoalScorer', 'gameOutcome'))
                    or 'periodDescriptor' in game and (not isinstance(game['periodDescriptor'], dict)
                        or game['periodDescriptor'] != {'number': 1, 'periodType': 'REG', 'maxRegulationPeriods': 3}
                        or type(game['periodDescriptor'].get('number')) is not int
                        or type(game['periodDescriptor'].get('maxRegulationPeriods')) is not int)):
                raise ValueError('Future whole body contains started game or outcome fields')
            games.append(game['id'])
    if 'numberOfGames' in payload and (type(payload['numberOfGames']) is not int or payload['numberOfGames'] != len(games)):
        raise ValueError('Declared weekly game count conflicts with complete frame')
    return {'dates': expected, 'games': len(games), 'gameIds': sorted(games), 'emptyDates': [day['date'] for day in days if not day['games']]}


def worker_entry(url, path, maximum, allocation_path, allocation_hash):
    diagnostic = {'ok': False}
    conn = None
    try:
        raw = Path(allocation_path).read_bytes()
        if not 0 < maximum <= MAX_BODY or len(raw) > 128 * 1024 or sha(raw) != allocation_hash or url not in [row['url'] for row in validate(json.loads(raw))]:
            raise TransportFailure('child_scope_denied')
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != HOST or parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise TransportFailure('child_scope_denied')
        context = ssl.create_default_context()
        if not context.get_ca_certs():
            context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
        if not context.get_ca_certs():
            raise TransportFailure('trusted_certificate_store_unavailable')
        conn = http.client.HTTPSConnection(HOST, timeout=8, context=context)
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb', buffering=0) as out:
            conn.request('GET', parsed.path, headers={'Accept': 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'FHFH-bounded-context-capture/1'})
            response = conn.getresponse()
            diagnostic.update({'status': response.status, 'sourceDate': response.getheader('Date'), 'age': response.getheader('Age')})
            if response.status != 200:
                raise TransportFailure(f'http_status_{int(response.status)}')
            if response.getheader('Content-Encoding', 'identity') != 'identity':
                raise TransportFailure('unsupported_content_encoding')
            size = 0
            while size < maximum:
                chunk = response.read1(min(65536, maximum - size))
                if not chunk:
                    diagnostic['ok'] = True
                    break
                out.write(chunk)
                size += len(chunk)
            else:
                raise TransportFailure('body_byte_ceiling_reached')
    except TransportFailure as error:
        diagnostic['reason'] = str(error)
    except ssl.SSLCertVerificationError:
        diagnostic['reason'] = 'tls_certificate_verification_failed'
    except socket.gaierror:
        diagnostic['reason'] = 'dns_resolution_failed'
    except (TimeoutError, socket.timeout):
        diagnostic['reason'] = 'socket_timeout'
    except Exception:
        diagnostic['reason'] = 'transport_failed'
    finally:
        if conn:
            conn.close()
    private_write(Path(str(path) + '.transport.json'), json.dumps(diagnostic).encode())


def transport(url, path, maximum, timeout, allocation_path, allocation_hash):
    command = "import runpy,sys,pathlib; m=runpy.run_path(sys.argv[1]); m['worker_entry'](sys.argv[2],pathlib.Path(sys.argv[3]),int(sys.argv[4]),sys.argv[5],sys.argv[6])"
    BASE['bounded_process']([sys.executable, '-c', command, str(Path(__file__).resolve()), url, str(path), str(maximum), str(allocation_path), allocation_hash], timeout)
    diagnostic = json.loads(Path(str(path) + '.transport.json').read_bytes())
    if not diagnostic.get('ok'):
        raise TransportFailure(diagnostic.get('reason', 'transport_failed'))
    return diagnostic


def capture(raw, approved_hash, approval_ref, output, fetch_body=transport, monotonic=time.monotonic, sleep=time.sleep):
    if len(raw) > 128 * 1024 or sha(raw) != approved_hash or not approval_ref.strip():
        raise ValueError('Exact approved allocation hash and human approval required')
    data = json.loads(raw)
    requests = validate(data)
    for source in data['bindingSources']:
        if sha(Path(source['path']).read_bytes()) != source['sha256']:
            raise ValueError('Approved binding metadata changed')
    output.mkdir(mode=0o700)
    private_write(output / 'allocation.json', raw)
    ledger = output / 'exposure-ledger.jsonl'
    private_write(ledger, b'')
    continuation = data['version'] == 'forge-rso-nhl-context-continuation-v1'
    total_seconds, max_total = (210, 21 * MAX_BODY) if continuation else (TOTAL_SECONDS, MAX_TOTAL)
    started, total, attempted = monotonic(), 0, 0
    receipts, failures, reused_receipts = [], [], []
    seen_games = set()
    collector_hash = sha(Path(__file__).read_bytes())
    reused_collector_hash = sha(Path(__file__).with_name('capture-native-sources.py').read_bytes())

    def event(action, request, **extra):
        with ledger.open('a') as out:
            out.write(json.dumps({'atUTC': clock(), 'action': action, 'approvalRef': approval_ref,
                'allocationSHA256': approved_hash, 'collectorSHA256': collector_hash, 'reusedCollectorSHA256': reused_collector_hash, **request, **extra}) + '\n')
            out.flush()
            os.fsync(out.fileno())

    # This branch runs only after a NEW exact continuation approval. Plan mode
    # never reads these retained bodies or treats quarantine as admitted evidence.
    if continuation:
        try:
            proof = data['priorCaptureLedger']
            ledger_bytes = Path(proof['path']).read_bytes()
            if sha(ledger_bytes) != proof['sha256']:
                raise ValueError('Prior exposure ledger changed')
            old_events = [json.loads(line) for line in ledger_bytes.decode().splitlines()]
            for index, retained in enumerate(data['reuse']):
                request = {'kind': 'historical' if index < 2 else 'future', 'date': (HISTORICAL + FUTURE)[index], 'url': retained['url']}
                recorded = [row for row in old_events if row.get('action') == 'original_body_retained' and row.get('url') == retained['url']]
                if (len(recorded) != 1 or recorded[0].get('bodySha256') != retained['bodySha256']
                        or recorded[0].get('capturedAt') != retained['capturedAt']
                        or not any(row.get('url') == retained['url'] and row.get('action') == ('whole_body_validated' if index < 2 else 'failed_stopped') for row in old_events)):
                    raise ValueError('Retained source is not bound to original capture ledger')
                event('approved_reuse_decode_intent', request, originalStatus=retained['status'], originalCapturedAt=retained['capturedAt'], bodySha256=retained['bodySha256'])
                with Path(retained['path']).open('rb') as source:
                    original = source.read(MAX_BODY)
                if not 0 < len(original) < MAX_BODY or sha(original) != retained['bodySha256']:
                    raise ValueError('Retained original body changed or exceeds scope')
                text = original.decode('utf-8')
                payload = json.loads(text)
                coverage = validate_payload(payload, request, data, retained['capturedAt'])
                revalidated_at = clock()
                if request['kind'] == 'future':
                    validate_payload(payload, request, data, revalidated_at)
                game_ids = set(coverage.get('gameIds', []))
                if seen_games.intersection(game_ids):
                    raise ValueError('Conflicting retained schedule identity')
                seen_games.update(game_ids)
                reused_receipts.append({key: retained[key] for key in ('url', 'capturedAt', 'bodySha256')} | {
                    'rawBody': text, 'revalidatedAt': revalidated_at, 'coverage': coverage, 'sourceStatus': 'approved_original_reuse_no_new_request'})
                event('approved_reuse_validated', request, coverage=coverage, originalCapturedAt=retained['capturedAt'], bodySha256=retained['bodySha256'])
        except Exception as error:
            failed_url = data['reuse'][len(reused_receipts)]['url'] if len(reused_receipts) < 3 else None
            failures.append({'url': failed_url, 'reason': 'approved_reuse_validation_failed'})
            event('approved_reuse_failed_stopped', {'kind': 'reuse', 'url': failed_url}, reason=type(error).__name__)
    for index, request in enumerate(requests if not failures else []):
        if index:
            sleep(1)
        remaining = total_seconds - (monotonic() - started)
        if remaining <= 0 or total >= max_total:
            failures.append({'url': request['url'], 'reason': 'total_budget_exhausted'})
            break
        path = output / f'{index + 1:02d}-{request["kind"]}.json'
        event('acquisition_intent', request, wholeBodyExposure=True)
        # The durable intent write is part of the total budget. Do not launch a
        # child with a stale allowance after a slow flush/fsync.
        remaining = total_seconds - (monotonic() - started)
        if remaining <= 0:
            failures.append({'url': request['url'], 'reason': 'total_time_exhausted_before_request'})
            event('acquisition_not_started', request, reason='total_time_exhausted_before_request')
            break
        attempted += 1
        body = b''
        counted = False
        try:
            diagnostic = fetch_body(request['url'], path, min(MAX_BODY, max_total - total), min(8, remaining), output / 'allocation.json', approved_hash)
            body = path.read_bytes()
            total += len(body)
            counted = True
            captured_at = clock()
            event('original_body_retained', request, capturedAt=captured_at, bodyBytes=len(body), bodySha256=sha(body), path=str(path))
            source_date = parsedate_to_datetime(diagnostic.get('sourceDate', ''))
            captured = datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
            age = diagnostic.get('age')
            if source_date.tzinfo is None or abs((captured - source_date).total_seconds()) > 120 or age is not None and not 0 <= float(age) <= 60:
                raise ValueError('Source freshness unverified')
            event('whole_body_decode_intent', request, decodedScope='all_clubs_all_players_all_present_fields')
            text = body.decode('utf-8')
            coverage = validate_payload(json.loads(text), request, data, captured_at)
            game_ids = set(coverage.get('gameIds', []))
            if seen_games.intersection(game_ids):
                raise ValueError('Conflicting cross-page schedule game identity')
            seen_games.update(game_ids)
            event('whole_body_validated', request, coverage=coverage)
            receipts.append({'url': request['url'], 'capturedAt': captured_at, 'bodySha256': sha(body), 'rawBody': text, 'sourceDate': diagnostic.get('sourceDate'), 'coverage': coverage})
        except Exception as error:
            if path.exists() and not counted:
                body = path.read_bytes()
                total += len(body)
            if not path.exists():
                private_write(path, b'')
            reason = str(error) if isinstance(error, TransportFailure) else type(error).__name__
            failures.append({'url': request['url'], 'reason': reason})
            event('failed_stopped', request, reason=reason, bodyBytes=len(body), bodySha256=sha(body), path=str(path), unexpectedScopeMustBeReviewed=True)
            break
    result = {'version': 'forge-rso-nhl-context-receipts-v1', 'allocationSHA256': approved_hash, 'completedAt': clock(),
        'receipts': receipts, 'reusedReceipts': reused_receipts, 'failures': failures, 'plannedRequests': len(requests), 'attemptedRequests': attempted,
        'unattemptedRequests': len(requests) - attempted, 'bodyBytes': total, 'sourceAcquisitionOnly': True, 'publicUsesApproved': False, 'databaseWrites': 0}
    private_write(output / 'receipts.json', json.dumps(result).encode())
    return {key: result[key] for key in ('attemptedRequests', 'unattemptedRequests', 'bodyBytes', 'publicUsesApproved', 'databaseWrites')} | {'successfulRequests': len(receipts), 'failures': len(failures), 'output': str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allocation', type=Path, required=True)
    parser.add_argument('--execute-approved-sha256')
    parser.add_argument('--approval-ref')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    with args.allocation.open('rb') as source:
        raw = source.read(128 * 1024 + 1)
    if len(raw) > 128 * 1024:
        raise ValueError('Allocation too large')
    requests = validate(json.loads(raw))
    if not args.execute_approved_sha256:
        print(json.dumps({'mode': 'plan_only', 'allocationSHA256': sha(raw), 'requests': len(requests), 'sourceRequests': 0}))
        return
    if not args.out or not args.approval_ref:
        raise ValueError('Exclusive private output and approval reference required')
    print(json.dumps(capture(raw, args.execute_approved_sha256, args.approval_ref, args.out)))


if __name__ == '__main__':
    main()

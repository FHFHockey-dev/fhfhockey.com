"""Finite development capture. Default validates only; execution needs explicit approval.

This does not grant authority, publish forecasts, or contact any application/DB.
"""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

HOST = 'api-web.nhle.com'
MAX_BODY = 1024 * 1024
MAX_TOTAL = 32 * MAX_BODY


class SourceHTTPError(Exception):
    def __init__(self, status):
        self.status = status


class TransportFailure(Exception):
    pass


def sha(data):
    return hashlib.sha256(data).hexdigest()


def clock():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def private_write(path, data):
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as out:
        out.write(data)


def validate(data):
    prior = data.get('version') == 'forge-rso-prior-landing-allocation-v1'
    season = 20252026 if prior else 20262027
    if (not prior and data.get('version') != 'forge-rso-native-capture-allocation-v1'
            or data.get('seasonId') != season):
        raise ValueError('Unexpected allocation version or season')
    games = data['games']
    maximum = 20 if prior else 60
    if not 1 <= len(games) <= maximum or len({g['id'] for g in games}) != len(games):
        raise ValueError('Game count or identity scope invalid')
    reserved = set(data['reservedGameIds'])
    requests = []
    for game in games:
        first_id = 2025020001 if prior else 2026020001
        first_date, last_date = ('2025-10-01', '2026-01-02') if prior else ('2026-09-29', '2026-10-12')
        if (type(game['id']) is not int or not first_id <= game['id'] <= first_id + 9998
                or game['id'] in reserved or game['seasonId'] != season or game['type'] != 2
                or not first_date <= game['date'] <= last_date
                or game['homeTeamId'] == game['awayTeamId']):
            raise ValueError('Game outside finite development allocation')
        if prior:
            try:
                game_date = datetime.strptime(game['date'], '%Y-%m-%d').date()
                start = datetime.fromisoformat(game['startTime'].replace('Z', '+00:00'))
                if (game_date.isoformat() != game['date'] or start.tzinfo is None
                        or abs((start.astimezone(timezone.utc).date() - game_date).days) > 1
                        or any(type(game[key]) is not int or game[key] <= 0 for key in ('homeTeamId', 'awayTeamId'))):
                    raise ValueError('Invalid bound prior canonical metadata')
            except (KeyError, TypeError, AttributeError, ValueError) as error:
                raise ValueError('Prior landing requires original canonical game date/start/teams') from error
        for endpoint in ('landing',) if prior else ('boxscore', 'landing'):
            requests.append((game, endpoint, f'https://{HOST}/v1/gamecenter/{game["id"]}/{endpoint}'))
    if data['requests'] != [url for _, _, url in requests]:
        raise ValueError('Exact URL allowlist mismatch')
    return requests


def transport_worker(url, path, maximum):
    """Only the controller starts this subprocess; its lifetime bounds DNS/TLS/headers too."""
    parsed = urlsplit(url)
    approved_route = (parsed.hostname == HOST and parsed.path.startswith('/v1/gamecenter/')) or (
        parsed.hostname == 'api.nhle.com' and parsed.path == '/stats/rest/en/goalie/summary')
    if (parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port or parsed.fragment
            or not approved_route or not 0 < maximum <= MAX_BODY):
        raise ValueError('Invalid child transport scope')
    context = ssl.create_default_context()
    if not context.get_ca_certs():
        # This Mac's standalone Python has no default CA bundle. Use the OS
        # bundle without weakening certificate or hostname verification.
        context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    if not context.get_ca_certs():
        raise TransportFailure('trusted_certificate_store_unavailable')
    conn = http.client.HTTPSConnection(parsed.hostname, timeout=8, context=context)
    try:
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb', buffering=0) as out:
            conn.request('GET', parsed.path + ('?' + parsed.query if parsed.query else ''), headers={
                'Accept': 'application/json', 'Accept-Encoding': 'identity',
                'User-Agent': 'FHFH-bounded-development-capture/1'})
            response = conn.getresponse()
            if response.status != 200:
                raise SourceHTTPError(response.status)
            if response.getheader('Content-Encoding', 'identity') != 'identity':
                raise TransportFailure('unsupported_content_encoding')
            size = 0
            while size < maximum:
                chunk = response.read1(min(65536, maximum - size))
                if not chunk:
                    return
                out.write(chunk)
                size += len(chunk)
            raise TransportFailure('body_byte_ceiling_reached')
    finally:
        conn.close()


def bounded_process(command, timeout):
    # subprocess.run kills and waits for this single child on TimeoutExpired.
    subprocess.run(command, timeout=timeout, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)


def worker_entry(url, path, maximum):
    """Only safe error classes/status leave the child; never exception text or headers."""
    diagnostic = {'ok': False}
    try:
        transport_worker(url, path, maximum)
        diagnostic = {'ok': True}
    except SourceHTTPError as error:
        diagnostic['reason'] = f'http_status_{int(error.status)}'
    except ssl.SSLCertVerificationError:
        diagnostic['reason'] = 'tls_certificate_verification_failed'
    except socket.gaierror:
        diagnostic['reason'] = 'dns_resolution_failed'
    except TransportFailure as error:
        diagnostic['reason'] = str(error)
    except (TimeoutError, socket.timeout):
        diagnostic['reason'] = 'socket_timeout'
    except Exception as error:
        diagnostic['reason'] = type(error).__name__
    private_write(Path(str(path) + '.transport.json'), json.dumps(diagnostic).encode())


def transport(url, path, maximum, timeout):
    worker = "import runpy,sys,pathlib; m=runpy.run_path(sys.argv[1]); m['worker_entry'](sys.argv[2],pathlib.Path(sys.argv[3]),int(sys.argv[4]))"
    bounded_process([sys.executable, '-c', worker, str(Path(__file__).resolve()), url, str(path), str(maximum)], timeout)
    diagnostic = json.loads(Path(str(path) + '.transport.json').read_text())
    if not diagnostic.get('ok'):
        raise TransportFailure(diagnostic['reason'])


def capture(data, allocation_hash, approval_ref, output, fetch_body=transport):
    requests = validate(data)
    reservation_bytes = Path(data['reservationMetadata']['path']).read_bytes()
    if sha(reservation_bytes) != data['reservationMetadata']['sha256']:
        raise ValueError('Reservation metadata changed; re-review required')
    reservation = json.loads(reservation_bytes)
    reserved = {game['id'] for day in reservation['days'] for game in day['games']}
    if reserved != set(data['reservedGameIds']):
        raise ValueError('Reservation ID inventory mismatch')
    output.mkdir(mode=0o700)  # Exclusive directory prevents accidental replay/overwrite.
    private_write(output / 'allocation.json', json.dumps(data, indent=2).encode())
    ledger_path = output / 'exposure-ledger.jsonl'
    private_write(ledger_path, b'')
    collector_hash = sha(Path(__file__).read_bytes())
    started = time.monotonic()
    total = 0
    attempted = 0
    receipts, failures = [], []

    def event(action, game, endpoint, url, **extra):
        row = {'atUTC': clock(), 'action': action, 'approvalRef': approval_ref,
               'allocationSHA256': allocation_hash, 'collectorSHA256': collector_hash,
               'gameId': game['id'], 'gameDate': game['date'], 'seasonId': game['seasonId'],
               'endpoint': endpoint, 'sourceURL': url, 'use': 'development_only', **extra}
        with ledger_path.open('a') as out:
            out.write(json.dumps(row) + '\n')
            out.flush()
            os.fsync(out.fileno())

    for index, (game, endpoint, url) in enumerate(requests):
        if time.monotonic() - started >= 300 or total >= MAX_TOTAL:
            failures.append({'url': url, 'reason': 'total_budget_exhausted'})
            break
        if index:
            time.sleep(1)  # One concurrent request, no retry or burst.
        request_started = time.monotonic()
        if request_started - started >= 300:
            failures.append({'url': url, 'reason': 'total_time_exhausted_before_request'})
            break
        event('acquisition_intent', game, endpoint, url)
        body = bytearray()
        path = output / f'{game["id"]}-{endpoint}.json'
        try:
            remaining = 300 - (time.monotonic() - started)
            if remaining <= 0:
                raise TimeoutError('Total budget exhausted before transport')
            attempted += 1
            fetch_body(url, path, min(MAX_BODY, MAX_TOTAL - total), min(8, remaining))
            body = path.read_bytes()
            total += len(body)
            captured_at = clock()
            body_hash = sha(body)
            event('acquisition_retained', game, endpoint, url, receivedAtUTC=captured_at,
                  retainedPath=str(path), bodyBytes=len(body), bodySHA256=body_hash)
            event('whole_body_decode_intent', game, endpoint, url,
                  decodedScope='entire_original_body_all_players_all_present_fields', analystVisibility='none')
            raw_body = bytes(body).decode('utf-8')
            payload = json.loads(raw_body)
            if (payload.get('id') != game['id'] or payload.get('season') != game['seasonId']
                    or payload.get('gameType') != 2 or payload.get('gameDate') != game['date']
                    or payload.get('homeTeam', {}).get('id') != game['homeTeamId']
                    or payload.get('awayTeam', {}).get('id') != game['awayTeamId']
                    or payload.get('gameState') not in ('OFF', 'FINAL')):
                raise ValueError('Source game identity/finality mismatch')
            if data['version'] == 'forge-rso-prior-landing-allocation-v1':
                actual_start = datetime.fromisoformat(payload.get('startTimeUTC', '').replace('Z', '+00:00'))
                expected_start = datetime.fromisoformat(game['startTime'].replace('Z', '+00:00'))
                if actual_start.tzinfo is None or actual_start != expected_start:
                    raise ValueError('Prior source start conflicts with bound canonical metadata')
            event('whole_body_decode_completed', game, endpoint, url, analystVisibility='none')
            receipts.append({'url': url, 'capturedAt': captured_at, 'bodySha256': body_hash, 'rawBody': raw_body})
        except Exception as error:
            # Keep partial/error bytes as exposure evidence without presenting outcome values.
            if not body and path.exists():
                body = path.read_bytes()
                total += len(body)
            if not path.exists():
                private_write(path, b'')
            reason = str(error) if isinstance(error, TransportFailure) else type(error).__name__
            failures.append({'url': url, 'reason': reason})
            event('failed_stopped', game, endpoint, url, reason=reason, bodyBytes=len(body),
                  bodySHA256=sha(body), retainedPath=str(path))
            break
    result = {'version': 'forge-rso-native-source-receipts-v1', 'allocationSHA256': allocation_hash,
              'completedAt': clock(), 'receipts': receipts, 'failures': failures,
              'plannedRequests': len(requests), 'attemptedRequests': attempted, 'unattemptedRequests': len(requests) - attempted,
              'bodyBytes': total, 'publicUsesApproved': False, 'databaseWrites': 0}
    private_write(output / 'receipts.json', json.dumps(result).encode())
    return {'successfulRequests': len(receipts), 'failures': len(failures),
            'unattemptedRequests': result['unattemptedRequests'], 'bodyBytes': total, 'output': str(output)}


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
    requests = validate(allocation)
    digest = sha(raw)
    if not args.execute_approved_sha256:
        print(json.dumps({'mode': 'plan_only', 'allocationSHA256': digest, 'requests': len(requests), 'sourceRequests': 0}))
    else:
        if args.execute_approved_sha256 != digest or not args.approval_ref or not args.out:
            raise ValueError('Exact approved allocation hash, human approval reference and exclusive output required')
        print(json.dumps(capture(allocation, digest, args.approval_ref, args.out)))

"""File-only proposed native-evidence bundle. Never creates an acceptance policy."""
import argparse
import base64
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import types

ROOT = Path(__file__).resolve().parent
GROUPS = ('individual', 'onIce')
REFS = ('nativeBodySHA256', 'nativeReceiptSHA256', 'producerSHA256',
        'redactorSHA256', 'definitionSHA256', 'officialFrameSHA256')
MIB = 1024 * 1024


class PreparationError(ValueError):
    pass


def need(condition, reason):
    if not condition:
        raise PreparationError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        need(key not in result, 'duplicate_json_key')
        result[key] = value
    return result


def parse(data):
    def reject(_value):
        raise PreparationError('nonfinite_json_number')
    try:
        result = json.loads(data.decode('utf-8'), object_pairs_hook=pairs, parse_constant=reject)
    except (ValueError, UnicodeError) as error:
        raise PreparationError('invalid_json') from error
    def numbers(value):
        if type(value) is int:
            need(abs(value) <= 2**53 - 1, 'unsafe_json_integer')
        elif type(value) is float:
            need(math.isfinite(value), 'nonfinite_json_number')
        elif isinstance(value, dict):
            for item in value.values(): numbers(item)
        elif isinstance(value, list):
            for item in value: numbers(item)
    numbers(result)
    return result


def encode(value):
    return (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + '\n').encode('utf-8')


def read_bound(path, maximum):
    # Refuse final symlinks and non-regular files before reading, including FIFOs.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        need(stat.S_ISREG(info.st_mode) and 0 < info.st_size <= maximum, 'file_byte_or_type_bound')
        data = handle.read(maximum + 1)
        need(len(data) == info.st_size and len(data) <= maximum, 'file_changed_or_oversized')
        return data


def hash_value(value):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value) is not None


def exact(value, keys):
    need(isinstance(value, dict) and set(value) == set(keys), 'unexpected_or_missing_fields')


def load_validators(intake_path, lineage_path):
    pins = parse(read_bound(ROOT / 'SOURCE-PINS.json', 64 * 1024))
    modules, sources = {}, {}
    for key, path in [('intake', intake_path), ('lineage', lineage_path)]:
        source = read_bound(path, 128 * 1024)
        need(sha(source) == pins[key]['sha256'], 'validator_source_drift')
        module = types.ModuleType('pinned_' + key)
        exec(compile(source, str(path), 'exec'), module.__dict__)
        modules[key], sources[key + '.py'] = module, source
    return modules, sources


def bridge(request_bytes, evaluated_at, bundle_bytes=None):
    payload = {'requestBase64': base64.b64encode(request_bytes).decode('ascii'), 'evaluatedAtUTC': evaluated_at,
               'bundleBase64': base64.b64encode(bundle_bytes).decode('ascii') if bundle_bytes else None}
    result = subprocess.run(['node', str(ROOT / 'closed_gate.cjs')], input=json.dumps(payload).encode(),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=False)
    need(result.returncode == 0, 'closed_gate_replay_failed')
    need(len(result.stdout) <= 32 * MIB, 'bridge_output_bound')
    return parse(result.stdout)


def artifacts_from(manifest, directory):
    entries = manifest['artifacts']
    need(isinstance(entries, list) and len(entries) <= 10000, 'artifact_count_bound')
    result, total = {}, 0
    directory = directory.resolve()
    for entry in entries:
        exact(entry, ['path', 'sha256', 'bytes'])
        need(hash_value(entry['sha256']) and entry['sha256'] not in result, 'duplicate_or_invalid_artifact_hash')
        need(type(entry['bytes']) is int and 0 < entry['bytes'] <= 8 * MIB, 'artifact_byte_bound')
        rel = Path(entry['path'])
        need(not rel.is_absolute() and '..' not in rel.parts and rel.parts, 'artifact_path_escape')
        target = directory
        for part in rel.parts:
            target = target / part
            need(not target.is_symlink(), 'artifact_symlink')
        need(target.resolve().is_relative_to(directory), 'artifact_path_escape')
        total += entry['bytes']; need(total <= 64 * MIB, 'artifact_total_bound')
        data = read_bound(target, 8 * MIB)
        need(len(data) == entry['bytes'] and sha(data) == entry['sha256'], 'artifact_hash_or_size_drift')
        result[entry['sha256']] = data
    return result


def stamp(value):
    # Match the pinned TypeScript gate before Python can normalize offset overflow,
    # accept alternate separators or silently truncate sub-microsecond precision.
    match = re.fullmatch(r'\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(Z|([+-])(\d{2}):(\d{2}))',
                         value, flags=re.ASCII) if isinstance(value, str) else None
    need(match is not None, 'invalid_evidence_clock')
    if match[1] != 'Z':
        hours, minutes = int(match[3]), int(match[4])
        need(hours <= 14 and minutes <= 59 and (hours < 14 or minutes == 0) and match[1] != '-00:00',
             'invalid_evidence_clock')
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)
    except (ValueError, OverflowError) as error:
        raise PreparationError('invalid_evidence_clock') from error


def frame_matches(frame, row, observed, evaluated_at):
    expected = {'seasonId': 20262027, 'playerId': row['player_id'], 'gameId': row['game_id'],
                'date': row['date'], 'team': row['team_abbrev']}
    need(isinstance(frame, dict) and all(type(frame.get(k)) is type(v) and frame[k] == v for k, v in expected.items()),
         'official_frame_identity_mismatch')
    need(frame.get('final') is True and type(frame.get('gamesPlayed')) is int and frame['gamesPlayed'] == 1,
         'official_frame_participation_unqualified')
    toi = frame.get('totalToiSeconds')
    need(type(toi) is int and toi > 0 and toi == row['toi_per_game'] == observed['toi'], 'official_exposure_hold')
    # These supplied frame assertions remain subject to independent evidence review.
    # The lineage validator checks completedByUTC against native retrieval/evaluation.
    need(isinstance(frame.get('completedByUTC'), str) and isinstance(frame.get('observedAtUTC'), str),
         'official_frame_clock_missing')
    completed, seen = stamp(frame['completedByUTC']), stamp(frame['observedAtUTC'])
    need(completed <= seen <= stamp(evaluated_at) and row['date'] <= completed.date().isoformat(), 'official_frame_chronology_unqualified')
    need(type(frame.get('gamesOnNativeDate')) is int and frame['gamesOnNativeDate'] == 1 and frame.get('dateMembershipComplete') is True,
         'official_player_date_membership_unestablished')


def compose(request_bytes, context_bytes, manifest, artifact_bytes, allowlist, evaluated_at, validators):
    exact(manifest, ['version', 'sourceRequestSHA256', 'contextSHA256', 'producerAllowlistSHA256', 'artifacts', 'rows'])
    need(manifest['version'] == 'fhfh.blsh.native-packet-inputs.v1', 'manifest_version')
    need(sha(request_bytes) == manifest['sourceRequestSHA256'] and sha(context_bytes) == manifest['contextSHA256'], 'input_pin_drift')
    exact(allowlist, ['producerSHA256', 'redactorSHA256'])
    for values in allowlist.values():
        need(isinstance(values, list) and len(values) <= 100 and all(hash_value(v) for v in values) and len(set(values)) == len(values),
             'invalid_supplied_allowlist')
    request, context = parse(request_bytes), parse(context_bytes)
    intake = validators['intake'].build(request, context)
    need(len(intake['rows']) <= 5000, 'selected_row_bound')
    hashes = bridge(request_bytes, evaluated_at)['hashes']
    row_hashes = {group: {r['id']: r['sha256'] for r in rows} for group, rows in hashes.items()}
    wgo = {row['id']: row for row in request['wgo']['rows']}
    selected = {row['sourceId'] for row in intake['rows']}
    entries = {}; need(isinstance(manifest['rows'], list) and len(manifest['rows']) <= 10000, 'witness_count_bound')
    for entry in manifest['rows']:
        exact(entry, ['group', 'wgoSourceId', 'processSourceId', *REFS])
        need(entry['group'] in GROUPS and type(entry['wgoSourceId']) is int and entry['wgoSourceId'] in selected,
             'entry_outside_selected_scope')
        need(type(entry['processSourceId']) is int and entry['processSourceId'] > 0, 'invalid_process_id')
        need(all(hash_value(entry[k]) and entry[k] in artifact_bytes for k in REFS), 'unbound_entry_artifact')
        key = (entry['wgoSourceId'], entry['group']); need(key not in entries, 'duplicate_row_group_entry'); entries[key] = entry
    witnesses, decisions = [], []
    for selection in intake['rows']:
        row = wgo[selection['sourceId']]
        for group in GROUPS:
            decision = {'wgoSourceId': row['id'], 'group': group, 'state': 'held', 'reasons': [], 'lineage': None}
            decisions.append(decision)
            note = selection['groups'][group]; entry = entries.get((row['id'], group))
            if note['structuralReasons']:
                decision['reasons'] = note['structuralReasons']; continue
            if not entry:
                decision['reasons'] = ['native_receipt_not_supplied']; continue
            try:
                observed = note['storedNSTRow']
                need(entry['processSourceId'] == observed['id'], 'process_row_binding_mismatch')
                body = artifact_bytes[entry['nativeBodySHA256']]
                need(len(body) <= 2 * MIB, 'native_body_byte_bound'); body.decode('utf-8')
                need(len(artifact_bytes[entry['nativeReceiptSHA256']]) <= 64 * 1024 and len(artifact_bytes[entry['officialFrameSHA256']]) <= 64 * 1024,
                     'receipt_or_frame_byte_bound')
                receipt = parse(artifact_bytes[entry['nativeReceiptSHA256']]); need(isinstance(receipt, dict), 'invalid_receipt_object')
                stamp(receipt.get('retrievedAtUTC'))
                need(receipt.get('producerSHA256') == entry['producerSHA256'] and receipt.get('redactorSHA256') == entry['redactorSHA256'],
                     'producer_or_redactor_binding_mismatch')
                need(entry['redactorSHA256'] in allowlist['redactorSHA256'], 'redactor_not_in_supplied_allowlist')
                frame = parse(artifact_bytes[entry['officialFrameSHA256']]); frame_matches(frame, row, observed, evaluated_at)
                expected = {'group': group, 'season': 20262027, 'date': row['date'], 'playerId': row['player_id'],
                            'gameId': row['game_id'], 'team': row['team_abbrev'], 'stored': observed,
                            'officialFrameSHA256': entry['officialFrameSHA256'], 'officialSafeAfterUTC': frame['completedByUTC'],
                            'officialToiSeconds': frame['totalToiSeconds'], 'officialFrameQualified': True,
                            'gamesOnNativeDate': frame['gamesOnNativeDate'], 'evidenceAsOfUTC': evaluated_at}
                lineage = validators['lineage'].check(expected, body, receipt, allowlist['producerSHA256'])
                decision['lineage'] = lineage
                need(lineage['state'] == 'row_lineage_checked_proposed_contract', lineage['reason'] or 'native_lineage_held')
                required = validators['lineage'].FIELDS[group]
                mismatches = [name for name in required if lineage['fields'].get(name, {}).get('state') != 'literal_match']
                need(not mismatches, 'native_fields_not_literal_match:' + ','.join(mismatches))
                # Proposal only: no policy, model approval or complete census is created here.
                witnesses.append({**entry, 'playerId': row['player_id'], 'gameId': row['game_id'], 'date': row['date'], 'team': row['team_abbrev'],
                                  'wgoRowSHA256': row_hashes['wgo'][row['id']], 'processRowSHA256': row_hashes[group][observed['id']],
                                  'nativeValuesMatched': True,
                                  'qualifiedScope': {'strengthScope': 'all_strength', 'dateMeaning': 'game_date', 'toiUnit': 'seconds'}})
                decision.update(state='literal_match_proposal_pending_independent_review', reasons=[])
            except PreparationError as error:
                decision['reasons'] = [str(error)]
            except (KeyError, TypeError, ValueError, UnicodeError):
                decision['reasons'] = ['invalid_supplied_evidence_schema']
    bundle = {'version': 'fhfh.blsh.reviewed-process-evidence.v1', 'sourceRequestSHA256': sha(request_bytes), 'witnesses': witnesses}
    bundle_bytes = encode(bundle); need(len(bundle_bytes) <= 8 * MIB, 'bundle_byte_bound')
    replay = bridge(request_bytes, evaluated_at, bundle_bytes)['replay']
    return {'bundle': bundle, 'decisions': decisions, 'intakeSummary': intake['summary'], 'replay': replay,
            'summary': {'status': 'proposal_only_independent_acceptance_required', 'selectedRows': len(intake['rows']),
                        'proposedWitnesses': len(witnesses), 'heldGroups': sum(d['state'] == 'held' for d in decisions),
                        'holdReasons': dict(Counter(r for d in decisions for r in d['reasons'])),
                        'evaluatedAtUTC': evaluated_at, 'sourceRequestAsOfUTC': request['asOfUTC'],
                        'sourceRequestSHA256': sha(request_bytes), 'contextSHA256': sha(context_bytes),
                        'bundleSHA256': sha(bundle_bytes), 'reviewedProducerAllowlistIsCallerSupplied': True,
                        'officialFrameAndSourceModelReview': 'supplied_assertions_require_independent_review', 'completeLatestFiveEstablished': False,
                        'scoresComputed': 0, 'sourceAdmissions': 0, 'productionAdopted': False, 'networkRequests': 0}}


def prepare(args):
    request_bytes = read_bound(args.request, 32 * MIB)
    request = parse(request_bytes)
    need(isinstance(request, dict) and type(request.get('seasonId')) is int and request['seasonId'] == 20262027, 'outside_current_season')
    context_bytes = read_bound(args.context, 8 * MIB)
    manifest_bytes = read_bound(args.receipt_manifest, 4 * MIB); manifest = parse(manifest_bytes)
    exact(manifest, ['version', 'sourceRequestSHA256', 'contextSHA256', 'producerAllowlistSHA256', 'artifacts', 'rows'])
    need(sha(request_bytes) == manifest['sourceRequestSHA256'] and sha(context_bytes) == manifest['contextSHA256'], 'input_pin_drift')
    allowlist_bytes = read_bound(args.producer_allowlist, 64 * 1024)
    need(sha(allowlist_bytes) == manifest['producerAllowlistSHA256'], 'allowlist_pin_drift')
    validators, sources = load_validators(args.intake_source, args.lineage_source)
    artifacts = artifacts_from(manifest, args.receipt_manifest.parent)
    result = compose(request_bytes, context_bytes, manifest, artifacts, parse(allowlist_bytes), args.evaluated_at, validators)
    output = args.out
    output.mkdir(mode=0o700)  # Existing directory or symlink fails; no overwrite or cleanup.
    def write(name, data, sync=False):
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            if sync:
                handle.flush()
                os.fsync(handle.fileno())
    write('STARTED.json', encode({'state': 'writing_offline_proposal', 'retainedAtUTC': datetime.now(timezone.utc).isoformat()}))
    files = {'CURRENT-REQUEST.json': request_bytes, 'CONTEXTS.json': context_bytes, 'INPUT-MANIFEST.json': manifest_bytes,
             'SUPPLIED-PRODUCER-ALLOWLIST.json': allowlist_bytes, 'PROPOSED-BUNDLE.json': encode(result['bundle']),
             'ROW-DECISIONS.json': encode(result['decisions']), 'INTAKE-SUMMARY.json': encode(result['intakeSummary']),
             'CLOSED-GATE-REPLAY.json': encode(result['replay']), 'SUMMARY.json': encode(result['summary']), **sources}
    files.update({name: read_bound(ROOT / name, 256 * 1024) for name in ['prepare_packet.py', 'closed_gate.cjs', 'SOURCE-PINS.json']})
    for name, data in files.items(): write(name, data)
    (output / 'artifacts').mkdir(mode=0o700)
    for digest, data in artifacts.items(): write('artifacts/' + digest, data)
    manifest_out = {'status': 'offline_proposal_written_not_accepted', 'files':
                    [{'path':str(p.relative_to(output)), 'bytes':p.stat().st_size, 'sha256':sha(p.read_bytes())}
                     for p in sorted(output.rglob('*')) if p.is_file()]}
    write('.MANIFEST.json.tmp', encode(manifest_out), sync=True)
    # A same-directory hard link publishes the complete file atomically and fails
    # if a final name already exists. Partial writes/fsync failures stay temporary.
    os.link(output / '.MANIFEST.json.tmp', output / 'MANIFEST.json')
    (output / '.MANIFEST.json.tmp').unlink()
    return result['summary']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ['request', 'context', 'receipt-manifest', 'producer-allowlist', 'intake-source', 'lineage-source', 'out']:
        parser.add_argument('--' + flag, required=True, type=Path)
    parser.add_argument('--evaluated-at', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args), sort_keys=True))
    except PreparationError as error:
        print(str(error), file=sys.stderr); return 1
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError):
        print('packet_preparation_failed_no_acceptance_created', file=sys.stderr); return 1
    return 0


if __name__ == '__main__':
    def offline(event, _args):
        if event.startswith('socket.'): raise RuntimeError('offline_network_denied')
    sys.addaudithook(offline)
    sys.exit(main())

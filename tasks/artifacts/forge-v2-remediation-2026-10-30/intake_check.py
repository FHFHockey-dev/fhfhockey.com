"""Metadata-only FORGE v2 intake. Never opens referenced files, URLs, or labels.

Passing this check means shape/chronology is reviewable, never that evidence is
authentic, scientifically adequate, or authorized for execution.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re

TASKS = ['2.2', '2.4', '2.5', '7.1', '7.3', '8.3', '8.5', '13.2', '13.4', '14.1', '14.2', '14.3', '14.4', '14.5', '14.6']
CASES = ['official_appearance', 'zero_minute_penalty_credit', 'dressed_unused', 'nonappearance', 'ambiguous_incomplete', 'game_not_played']
PARTITIONS = ['training', 'development', 'interval_calibration', 'untouched_final', 'prospective']
HELD_SEASONS = {20242025, 20252026}
HASH = re.compile(r'^[0-9a-f]{64}$')


def utc_time(item):
    if not isinstance(item, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z', item):
        return None
    try:
        parsed = datetime.fromisoformat(item.replace('Z', '+00:00'))
        return parsed if parsed.utcoffset() is not None and parsed.utcoffset().total_seconds() == 0 else None
    except ValueError:
        return None


def template():
    proof = lambda: {'owner': None, 'artifactSha256': None, 'receiptSha256': None, 'evidenceClass': None}
    return {
        'schemaVersion': 'forge-v2-metadata-intake-v1',
        'note': 'Metadata only; leave unknowns null. Do not include raw source rows, labels, credentials, or private account data. Referenced artifacts are never opened.',
        'codeCommit': '7113329d2c24b8629f54484df37441f95a63d853',
        'cases': [{'kind': kind, 'owner': None, 'rawCaptureSha256': None, 'rightsReceiptSha256': None, 'semanticsReviewSha256': None, 'completeFeedProofSha256': None} for kind in CASES],
        'allocations': [{'purpose': purpose, 'custodian': None, 'datasetSha256': None, 'exposureRegisterSha256': None, 'rightsReceiptSha256': None, 'scopeApprovalSha256': None, 'startUtc': None, 'endUtc': None, 'seasonIds': [], 'gameIds': [], 'wholeGames': True} for purpose in PARTITIONS],
        'chronology': {'developmentProtocolRegisteredAt': None, 'meanModelAvailableAt': None, 'calibratorAvailableAt': None, 'finalProtocolFrozenAt': None, 'independentReviewSha256': None, 'developmentJustificationSha256': None},
        'evidence': {task: proof() for task in TASKS},
        'shadow': {'environmentOwner': None, 'environmentId': None, 'approvalSha256': None, 'startUtc': None, 'endUtc': None, 'maximumAttempts': None, 'maximumWorkerSeconds': None, 'maximumRetainedBytes': None, 'maximumStoreOperations': None, 'currencyBudget': None, 'reservationReceiptSha256': None, 'retentionOwner': None},
    }


def check(value):
    issues = []

    def issue(task, path, reason):
        issues.append({'task': task, 'path': path, 'reason': reason})

    def required(task, path, item, kind='text'):
        valid = isinstance(item, str) and bool(item.strip())
        if kind == 'hash':
            valid = isinstance(item, str) and bool(HASH.fullmatch(item))
        elif kind == 'positive':
            valid = type(item) is int and item > 0
        elif kind == 'budget':
            valid = type(item) in (int, float) and item >= 0 and item < float('inf')
        elif kind == 'time':
            valid = utc_time(item) is not None
        if not valid:
            issue(task, path, 'missing_or_invalid_' + kind)
        return valid

    def when(item):
        return utc_time(item)

    if not isinstance(value, dict) or value.get('schemaVersion') != 'forge-v2-metadata-intake-v1':
        issue('2.4', '/', 'unsupported_metadata_schema')
        value = {}
    if not re.fullmatch(r'[0-9a-f]{40}', str(value.get('codeCommit', ''))):
        issue('14.1', 'codeCommit', 'exact_local_commit_required')
    cases = value.get('cases', [])
    if not isinstance(cases, list):
        cases = []
    if len(cases) != len(CASES) or any(not isinstance(row, dict) or row.get('kind') not in CASES for row in cases):
        issue('2.2', 'cases', 'only_the_six_named_cases_are_accepted')
    for kind in CASES:
        matching = [row for row in cases if isinstance(row, dict) and row.get('kind') == kind]
        if len(matching) != 1:
            issue('2.2', 'cases.' + kind, 'exactly_one_case_metadata_required')
            continue
        for key in ['owner', 'rawCaptureSha256', 'rightsReceiptSha256', 'semanticsReviewSha256', 'completeFeedProofSha256']:
            required('2.2', 'cases.' + kind + '.' + key, matching[0].get(key), 'hash' if key.endswith('Sha256') else 'text')
    allocations = value.get('allocations', [])
    if not isinstance(allocations, list):
        allocations = []
    if len(allocations) != len(PARTITIONS) or any(not isinstance(row, dict) or row.get('purpose') not in PARTITIONS for row in allocations):
        issue('2.4', 'allocations', 'exact_five_partition_inventory_required')
    by_purpose = {}; seen_games = set(); previous_end = None
    for purpose in PARTITIONS:
        matches = [row for row in allocations if isinstance(row, dict) and row.get('purpose') == purpose]
        path = 'allocations.' + purpose
        if len(matches) != 1:
            issue('2.4', path, 'one_chronological_allocation_required')
            continue
        row = by_purpose[purpose] = matches[0]
        for key in ['custodian', 'datasetSha256', 'exposureRegisterSha256', 'rightsReceiptSha256', 'scopeApprovalSha256']:
            required('2.4', path + '.' + key, row.get(key), 'hash' if key.endswith('Sha256') else 'text')
        for key in ['startUtc', 'endUtc']:
            required('2.4', path + '.' + key, row.get(key), 'time')
        start, end = when(row.get('startUtc')), when(row.get('endUtc'))
        if start and end and start >= end:
            issue('2.4', path, 'empty_or_reversed_partition')
        if start and previous_end and start < previous_end:
            issue('2.4', path, 'chronological_partitions_overlap')
        previous_end = end
        seasons = row.get('seasonIds')
        if not isinstance(seasons, list) or not seasons or any(type(x) is not int for x in seasons):
            issue('2.4', path + '.seasonIds', 'explicit_seasons_required')
        elif HELD_SEASONS.intersection(seasons):
            issue('2.4', path + '.seasonIds', 'existing_hold_requires_separate_custodian_resolution')
        games = row.get('gameIds')
        if not isinstance(games, list) or not games or any(type(x) is not int or x < 1 for x in games):
            issue('2.4', path + '.gameIds', 'complete_game_membership_metadata_required')
        else:
            if len(games) != len(set(games)) or seen_games.intersection(games):
                issue('2.4', path + '.gameIds', 'game_leakage_or_duplicate')
            seen_games.update(games)
        if row.get('wholeGames') is not True:
            issue('2.4', path + '.wholeGames', 'all_player_horizon_profile_rows_must_stay_with_game')
    clocks = value.get('chronology', {})
    if not isinstance(clocks, dict):
        clocks = {}
    for key in ['developmentProtocolRegisteredAt', 'meanModelAvailableAt', 'calibratorAvailableAt', 'finalProtocolFrozenAt']:
        required('2.5', 'chronology.' + key, clocks.get(key), 'time')
    for key in ['independentReviewSha256', 'developmentJustificationSha256']:
        required('2.5', 'chronology.' + key, clocks.get(key), 'hash')
    # Distinct model/interval-calibration/final clocks prohibit same-window backdating.
    dependencies = [('developmentProtocolRegisteredAt', 'development', 'startUtc'), ('meanModelAvailableAt', 'interval_calibration', 'startUtc'), ('calibratorAvailableAt', 'untouched_final', 'startUtc'), ('finalProtocolFrozenAt', 'untouched_final', 'startUtc')]
    for clock, purpose, bound in dependencies:
        left, right = when(clocks.get(clock)), when(by_purpose.get(purpose, {}).get(bound))
        if left and right and left >= right:
            issue('2.5', 'chronology.' + clock, 'must_precede_' + purpose)
    calibration_end = when(by_purpose.get('interval_calibration', {}).get('endUtc'))
    available = when(clocks.get('calibratorAvailableAt'))
    if calibration_end and available and available <= calibration_end:
        issue('8.3', 'chronology.calibratorAvailableAt', 'calibrator_must_follow_calibration_outcomes')
    development_end = when(by_purpose.get('development', {}).get('endUtc'))
    mean_available = when(clocks.get('meanModelAvailableAt'))
    if development_end and mean_available and mean_available <= development_end:
        issue('2.5', 'chronology.meanModelAvailableAt', 'selected_model_must_follow_development_outcomes')
    freeze = when(clocks.get('finalProtocolFrozenAt'))
    if freeze and available and freeze < available:
        issue('2.5', 'chronology.finalProtocolFrozenAt', 'final_freeze_must_bind_available_calibrator')
    evidence = value.get('evidence', {})
    if not isinstance(evidence, dict):
        evidence = {}
    permitted = {'2.2': ['source'], '2.4': ['custody'], '2.5': ['protocol'], '7.1': ['development'], '7.3': ['development'], '8.3': ['development'], '8.5': ['development'], '13.2': ['representative_local'], '13.4': ['untouched_final'], '14.1': ['approval'], '14.2': ['prospective_issued'], '14.3': ['qualification'], '14.4': ['release_receipt'], '14.5': ['qualification'], '14.6': ['rso_owner_acceptance']}
    for task in TASKS:
        row = evidence.get(task, {})
        if not isinstance(row, dict):
            row = {}
        for key in ['owner', 'artifactSha256', 'receiptSha256']:
            required(task, 'evidence.' + task + '.' + key, row.get(key), 'hash' if key.endswith('Sha256') else 'text')
        if row.get('evidenceClass') not in permitted[task]:
            issue(task, 'evidence.' + task + '.evidenceClass', 'needs_' + '_or_'.join(permitted[task]))
    shadow = value.get('shadow', {})
    if not isinstance(shadow, dict):
        shadow = {}
    for key in ['environmentOwner', 'environmentId', 'approvalSha256', 'reservationReceiptSha256', 'retentionOwner']:
        required('14.1', 'shadow.' + key, shadow.get(key), 'hash' if key.endswith('Sha256') else 'text')
    for key in ['maximumAttempts', 'maximumWorkerSeconds', 'maximumRetainedBytes', 'maximumStoreOperations']:
        required('14.1', 'shadow.' + key, shadow.get(key), 'positive')
    required('14.1', 'shadow.currencyBudget', shadow.get('currencyBudget'), 'budget')
    for key in ['startUtc', 'endUtc']:
        required('14.1', 'shadow.' + key, shadow.get(key), 'time')
    start, end = when(shadow.get('startUtc')), when(shadow.get('endUtc'))
    if start and end and start >= end:
        issue('14.1', 'shadow', 'empty_or_reversed_shadow_window')
    return {'schemaVersion': 'forge-v2-metadata-intake-report-v1', 'status': 'BLOCKED_METADATA' if issues else 'METADATA_REVIEW_REQUIRED', 'executionAuthorized': False, 'scientificallyQualified': False, 'referencedArtifactsOpened': 0, 'issues': issues, 'tasks': [{'id': task, 'state': 'INCOMPLETE', 'metadataIssueCount': sum(row['task'] == task for row in issues)} for task in TASKS], 'limitation': 'Hashes/owner strings are unverified declarations. Custodians must verify actual evidence and permissions. This tool never qualifies models, clears holds, opens data, or executes approvals.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('metadata', type=Path)
    args = parser.parse_args()
    if args.metadata.stat().st_size > 1024 * 1024:
        raise SystemExit('Metadata file exceeds 1 MiB; do not submit research rows')
    result = check(json.loads(args.metadata.read_text()))
    print(json.dumps(result, indent=2))
    return 2 if result['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())

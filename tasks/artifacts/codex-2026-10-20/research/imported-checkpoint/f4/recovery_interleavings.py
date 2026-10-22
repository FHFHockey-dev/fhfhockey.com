#!/usr/bin/env python3
"""Deterministic protocol model, not a database/application integration test.

No imports beyond Python's standard library, no network, no application imports.
Each actor preserves its own order; merge enumeration explores all schedules.
A logical commit event abstracts an atomic mutation. Only the explicitly
server-fenced variants couple ownership/status validation to that mutation.
"""
from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


@dataclass
class State:
    owner: str = 'A'
    epoch: int = 1
    status: str = 'running'
    old_status: str = 'running'
    run: str = 'R'
    rows: dict[str, str] = field(default_factory=lambda: {'R': 'partial-A'})
    sidecar: str | None = 'partial-A'
    completed: bool = False
    selected: str | None = None
    allow_a: bool = True
    receipts: dict[str, dict] = field(default_factory=dict)


def merges(left: tuple[str, ...], right: tuple[str, ...]) -> Iterable[tuple[str, ...]]:
    if not left:
        yield right
    elif not right:
        yield left
    else:
        for tail in merges(left[1:], right):
            yield (left[0],) + tail
        for tail in merges(left, right[1:]):
            yield (right[0],) + tail


B_STEPS = ('B.takeover', 'B.clear_projection', 'B.put_projection',
           'B.delete_sidecar', 'B.put_sidecar', 'B.checkpoint', 'B.succeed')


def exercise(variant: str, mutation: str = 'full_tail') -> dict:
    precheck = variant in {'client_precheck', 'server_check_without_lock'}
    fenced = variant == 'server_fenced'
    fresh = variant.startswith('fresh_run')
    sidecars_count = variant == 'fresh_run_with_global_sidecar'
    # One representative projection table and one representative sidecar are
    # retained in actual relative caller order; additional tables are omitted.
    if mutation == 'full_tail':
        commits = ('A.put_projection', 'A.delete_sidecar', 'A.put_sidecar', 'A.checkpoint')
        dangerous_event = 'A.put_projection'
    elif mutation == 'cleanup_tail':
        # An old resumed worker dispatches a cleanup delete, then dies. Its
        # already-dispatched request can commit later; no invented checkpoint.
        commits = ('A.delete_projection',)
        dangerous_event = 'A.delete_projection'
    else:
        assert mutation == 'sidecar_delete_tail'
        # Old projection stages already ran; sidecar delete is in flight and
        # the old worker dies before the next upsert.
        commits = ('A.delete_sidecar',)
        dangerous_event = 'A.delete_sidecar'
    a_steps = ((('A.precheck',) if precheck else ()) + ('A.dispatch',) + commits)
    failures = []
    total = 0
    for schedule in merges(a_steps, B_STEPS):
        total += 1
        s = State()
        if fresh:
            s.rows = {'R1': 'partial-A'}
        trace = []
        for event in schedule:
            detail = ''
            if event == 'A.precheck':
                s.allow_a = s.owner == 'A' and s.status == 'running'
                detail = f'permission_cached={s.allow_a}'
            elif event == 'A.dispatch':
                detail = 'first request may be delayed after dispatch'
            elif event in {'A.put_projection', 'A.delete_projection', 'A.delete_sidecar', 'A.put_sidecar'}:
                allowed = s.allow_a
                if fenced:
                    allowed = allowed and s.owner == 'A' and s.epoch == 1 and s.status == 'running'
                    # A rejected fenced write throws; later old-worker calls
                    # never run. Skipping them cannot change a counterexample.
                    s.allow_a = allowed
                if allowed:
                    key = 'R1' if fresh else 'R'
                    if event == 'A.put_projection':
                        s.rows[key] = 'A-old'
                    elif event == 'A.delete_projection':
                        s.rows.pop(key, None)
                    elif event == 'A.put_sidecar':
                        s.sidecar = 'A-old'
                    else:
                        s.sidecar = None
                detail = f'accepted={allowed}'
            elif event == 'A.checkpoint':
                # Current writeClaimedRun tests status+owner only; no row write
                # is undone when this compare-and-swap fails.
                ok = (s.old_status == 'running' if fresh else s.status == 'running') and s.owner == 'A'
                if ok:
                    s.completed = True
                detail = f'metadata_CAS={ok}'
            elif event == 'B.takeover':
                s.owner, s.epoch = 'B', 2
                s.completed = False
                if fresh:
                    s.old_status, s.run = 'failed', 'R2'
            elif event == 'B.clear_projection':
                s.rows.pop('R2' if fresh else 'R', None)
            elif event == 'B.put_projection':
                s.rows['R2' if fresh else 'R'] = 'B-new'
            elif event == 'B.delete_sidecar':
                s.sidecar = None
            elif event == 'B.put_sidecar':
                s.sidecar = 'B-new'
            elif event == 'B.checkpoint':
                assert s.owner == 'B' and s.status == 'running'
                s.completed = True
            elif event == 'B.succeed':
                assert s.completed
                s.status = 'succeeded'
                s.selected = 'R2' if fresh else 'R'
            trace.append(f'{event}' + (f' [{detail}]' if detail else ''))
        output_ok = s.selected is not None and s.rows.get(s.selected) == 'B-new'
        if sidecars_count:
            output_ok = output_ok and s.sidecar == 'B-new'
        metadata_ok = s.status == 'succeeded' and s.owner == 'B' and s.completed
        if not output_ok or not metadata_ok:
            failures.append({'trace': trace, 'rows': s.rows, 'sidecar': s.sidecar,
                             'selected': s.selected, 'metadata_ok': metadata_ok})
    # Prefer a witness with an actual request dispatched before takeover and
    # its commit delayed until after B's successful finalization.
    def is_late(witness: dict) -> bool:
        events = [x.split(' [')[0] for x in witness['trace']]
        return (events.index('A.dispatch') < events.index('B.takeover')
                < events.index('B.succeed') < events.index(dangerous_event))
    witness = next((x for x in failures if is_late(x)), failures[0] if failures else None)
    return {'variant': variant, 'mutation': mutation, 'schedules': total,
            'unsafe_schedules': len(failures), 'safe_for_modeled_observable': not failures,
            'witness': witness}


def fenced_operation(s: State, operation_id: str, payload: str, epoch: int) -> dict:
    """Abstract ONE serializable critical section shared with takeover.

    The model assumes a real implementation locks/serializes the SAME authority
    scope for takeover and writes and atomically stores receipt+mutation. It does
    not prove that a SELECT predicate, a trigger, or proposed SQL does this.
    """
    digest = hashlib.sha256(payload.encode()).hexdigest()
    prior = s.receipts.get(operation_id)
    if prior:
        if prior['payload_hash'] != digest:
            return {'outcome': 'intent_mismatch'}
        return {'outcome': 'duplicate_receipt', **prior}
    if s.epoch != epoch or s.status != 'running':
        return {'outcome': 'fenced'}
    s.rows['R'] = payload
    receipt = {'operation_id': operation_id, 'payload_hash': digest, 'epoch': epoch}
    s.receipts[operation_id] = receipt
    return {'outcome': 'committed', **receipt}


def lost_ack_experiments() -> dict:
    # Current metadata behavior at two different lost-response boundaries.
    running_checkpoint = State(rows={'R': 'A-complete'})
    running_checkpoint.completed = True  # checkpoint COMMITTED, response lost
    # Catch path still owns a running run and records failed.
    running_checkpoint.status = 'failed'
    final_checkpoint = State(rows={'R': 'A-complete'}, completed=True, status='succeeded')
    failed_rewrite_matches = final_checkpoint.status == 'running'  # false

    s = State(rows={})
    first = fenced_operation(s, 'game-write-A', 'A-complete', 1)
    # First response is dropped. Ownership changes; B commits a new payload.
    s.owner, s.epoch = 'B', 2
    second = fenced_operation(s, 'game-write-B', 'B-complete', 2)
    before_retry = dict(s.rows)
    same_retry = fenced_operation(s, 'game-write-A', 'A-complete', 1)
    changed_retry = fenced_operation(s, 'game-write-A', 'different', 1)
    late_new = fenced_operation(s, 'late-new-A', 'A-late', 1)
    assert s.rows == before_retry == {'R': 'B-complete'}
    assert first['outcome'] == second['outcome'] == 'committed'
    assert same_retry['outcome'] == 'duplicate_receipt'
    assert changed_retry['outcome'] == 'intent_mismatch'
    assert late_new['outcome'] == 'fenced'
    return {
        'current_running_checkpoint_ack_lost': {
            'durable_output': running_checkpoint.rows['R'], 'durable_progress': running_checkpoint.completed,
            'catch_path_status': running_checkpoint.status,
            'meaning': 'committed progress can be relabeled failed; this model does not call it data loss'},
        'current_final_success_ack_lost': {
            'durable_status': final_checkpoint.status, 'failure_rewrite_matches': failed_rewrite_matches,
            'meaning': 'success survives but caller may receive an error; exact readback is required'},
        'atomic_fenced_receipt': {'first': first, 'second': second, 'retry_old_after_takeover': same_retry,
                                  'changed_payload_same_id': changed_retry, 'new_old_epoch_operation': late_new,
                                  'final_rows': s.rows,
                                  'meaning': 'old receipt proves historical commit, not current selection'},
    }


def quiescent_handoff_experiments() -> list[dict]:
    # A normal release is an application protocol, not an inference from time.
    cases = [
        {'name': 'clean_release', 'normal_terminal_path': True, 'outstanding': 0, 'unknown_outcomes': 0,
         'release_receipt_exact': True},
        {'name': 'expired_with_inflight_write', 'normal_terminal_path': False, 'outstanding': 1,
         'unknown_outcomes': 0, 'release_receipt_exact': False},
        {'name': 'request_threw_but_write_may_commit', 'normal_terminal_path': True, 'outstanding': 0,
         'unknown_outcomes': 1, 'release_receipt_exact': False},
        {'name': 'release_ack_lost_unreconciled', 'normal_terminal_path': True, 'outstanding': 0,
         'unknown_outcomes': 0, 'release_receipt_exact': False},
    ]
    for case in cases:
        case['safe_to_reuse_run'] = (case['normal_terminal_path'] and case['outstanding'] == 0
                                     and case['unknown_outcomes'] == 0 and case['release_receipt_exact'])
    assert [x['safe_to_reuse_run'] for x in cases] == [True, False, False, False]
    return cases


def main() -> None:
    results = [exercise(v, mutation) for v, mutation in [
        ('metadata_only', 'full_tail'), ('metadata_only', 'cleanup_tail'),
        ('client_precheck', 'full_tail'), ('server_check_without_lock', 'full_tail'),
        ('same_run_scoped', 'full_tail'), ('fresh_run_projection_isolation', 'full_tail'),
        ('fresh_run_with_global_sidecar', 'full_tail'),
        ('fresh_run_with_global_sidecar', 'sidecar_delete_tail'),
        ('server_fenced', 'full_tail'), ('server_fenced', 'cleanup_tail')]]
    for result in results:
        expected = result['variant'] in {'fresh_run_projection_isolation', 'server_fenced'}
        assert result['safe_for_modeled_observable'] == expected, result
    report = {
        'model_version': 'fhfh-takeover-model-v1',
        'assumptions': [
            'Two actors A(old) and B(new); one game, representative projection row and shared sidecar; mutation ordering follows the actual caller.',
            'All merges preserve each actor order. DB operations terminate; no fairness/timing claim is modeled.',
            'Both actors have the SAME issuance identity. A-old vs B-new can arise from uncaptured mutable inputs.',
            'B takeover is one atomic ownership transition. Current output writes are modeled without a DB ownership predicate.',
            'Server-fenced validation+mutation is abstractly atomic and serialized with takeover on the same authority; no SQL isolation proof.',
            'Fresh-run projection isolation presumes R1 is permanently nonadmissible and all selected FORGE reads use R2; it excludes sidecar observers.',
            'Safety is checked after all modeled events, so late corruptions after B succeeds are not hidden by early termination.',
            'Enumeration counts measure this finite model, not incident probabilities or exhaustive application coverage.',
        ],
        'interleavings': results,
        'lost_acknowledgements': lost_ack_experiments(),
        'quiescent_handoff': quiescent_handoff_experiments(),
    }
    path = Path(__file__).with_name('recovery-interleavings-results.json')
    path.write_text(json.dumps(report, indent=2) + '\n')
    for result in results:
        print(f"{result['variant']:34} {result['mutation']:6} unsafe={result['unsafe_schedules']:3}/{result['schedules']} expected_observation={'PASS' if result['safe_for_modeled_observable'] else 'COUNTEREXAMPLE'}")
    print('All model assertions passed. Results:', path)


if __name__ == '__main__':
    main()

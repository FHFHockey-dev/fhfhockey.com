"""Verify the documentary checkpoint and record its bounded handback."""
from pathlib import Path
import collections, datetime, hashlib, json, subprocess

R = Path('/Users/tim/Code/fhfhockey.com')
S = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-08-cleanup-drm-tasks'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda n: json.loads((S / n).read_text())
dump = lambda n, d: (S / n).write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
v = load('VALIDATION-CANONICAL.json')
actual = {p: sha((R / p).read_bytes()) for p in v['candidate_hashes']}
assert actual == v['candidate_hashes']
current = json.loads((R / 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
baseline = load('BASELINE-LEDGER.json')
assert len(current['tasks']) == 207 and sum(len(t['evidence']) for t in current['tasks']) == 982
new_refs = 0
for a, b in zip(baseline['tasks'], current['tasks']):
    assert a['taskID'] == b['taskID'] and a['scope'] == b['scope']
    assert b['evidence'][:len(a['evidence'])] == a['evidence']
    for e in b['evidence'][len(a['evidence']):]:
        raw = (R / e['path']).read_bytes()
        assert sha(raw) == e['sha256'] and 1 <= e['line'] <= len(raw.decode().splitlines())
        new_refs += 1
assert new_refs == 27
pins = load('SOURCE-PINS.json')
assert all(sha((R / p).read_bytes()) == h for p, h in pins.items())
cov = load('COVERAGE.json')
counts = dict(collections.Counter(e['status'] for e in cov['entries']))
assert counts == cov['counts']
drift = []
for e in cov['entries']:
    p = R / e['path']
    h = sha(p.read_bytes()) if p.is_file() else None
    if h != e['sha256']:
        drift.append(dict(path=e['path'], reviewed_sha256=e['sha256'], current_sha256=h,
                          action='Retain frozen evidence and queue changed content; no automatic status inference.'))
delivery = load('LIBRARY-DELIVERY.json')
rec = delivery['result']
assert rec['status'] == 'succeeded' and rec['current_version_number'] == 8
assert delivery['helper']['exit_code'] == 0
attrs = []
for a in rec['xattrs']:
    result = subprocess.run(['/usr/bin/xattr', '-p', a['name'], str(R / delivery['local_path'])],
                            capture_output=True, text=True)
    ok = result.returncode == 0 and result.stdout.rstrip('\n') == a['value'].rstrip('\n')
    attrs.append(dict(name=a['name'], matches_returned_value=ok, exit_code=result.returncode))
    assert ok
assert sha((R / delivery['local_path']).read_bytes()) == actual[delivery['local_path']]
dump('LIVE-CHANGES.json', dict(at=now, scope='Only already-reviewed selected sources; no recursive rescan', changes=drift))
cont = load('CONTINUATION.json')
cont.update(at=now, canonical_checkpoint_pending=False, canonical_hashes=actual, library_version=8,
            library_delivery='LIBRARY-DELIVERY.json', no_pending_audit_mutation=True)
dump('CONTINUATION.json', cont)
final = dict(at=now, checkpoint='segment08 complete; overall audit unfinished', canonical_hashes=actual,
             ids_before=207, ids_after=207, evidence_before=955, evidence_after=982, added_ids=[],
             changed_ids=v['changed_ids'], all_207_prior_ids_scopes_evidence_prefixes_preserved=True,
             legacy_blocks_each_markdown_byte_identical=32, unchanged_existing_rows_identical=200,
             new_evidence_references_verified=new_refs, frozen_source_pins_verified=len(pins),
             coverage_counts=counts, full_content_bytes=240914, bounded_historical_index_disposition=1,
             known_support_metadata_role_dispositions=39, selected_unique_report_candidates_still_pending=8,
             historical_unique_text_candidates_remaining=1723,
             historical_raw_queue_records_remaining_not_deep_document_obligations=12153,
             current_reviewed_source_drift=drift,
             library=dict(library_file_id=rec['library_file_id'], current_version=8, status=rec['status'],
                          native_download='https://chatgpt.com/api/library/files/' + rec['library_file_id'] + '/download',
                          native_xattr_readback=attrs, local_bytes_unchanged_after_xattrs=True),
             next_cursor='tasks/TASKS/draft-dashboard-yahoo/docs/DraftDashboard_Audit.md',
             whole_tree_full_content_review_complete=False, application_test_git_or_production_operations=0,
             pending_mutation=False,
             resolved_verification_issue='Initial handback check used nonexistent coverage key; corrected to existing status schema. No writes occurred in failed check; canonical and Library were already successful, neither retried.')
dump('FINAL-CHECKPOINT.json', final)
report = S / 'REPORT.md'
marker = '## Verified canonical delivery'
if marker not in report.read_text():
    report.write_text(report.read_text() + '\n' + marker + '\n\nCanonical207IDs/982evidence installed and read back; all27new evidence references and frozen source pins matched. Library replacementv7→v8 succeeded on the existing identity; returned metadata applied with helper exit0 and native attribute readback matched. [FINAL-CHECKPOINT.json](FINAL-CHECKPOINT.json) records exact hashes, live-source change check and no pending mutation. No overall coverage completion is claimed.\n')
diary = R / 'tasks/diaries/2026-10-24-codex-task-artifact-audit.md'
if 'Segment08handback' not in diary.read_text():
    diary.write_text(diary.read_text() + '\n- Segment08handback ' + now + ': canonical207IDs/982evidence verified;7existingrows changed,noIDsadded,200unchangedrows,32legacyblocks perMarkdown andallprior207scopes/evidenceprefixes preserved.27new snapshot references verified. Librarysameidentityv7→v8 succeeded;helper0/nativeattribute readbackmatch/bytesunchanged.13full240914bytes,1boundedhistoricalindex,39supportrolemetadatadispositions;8selecteduniquereportsand1723historicaluniquetextcandidates remain. Noapp/tests/Git/productionoperation,no pendingwrite. NextDraftDashboard_Audit.md via segment08CONTINUATION; overall auditunfinished.\n')
files = sorted(p for p in S.rglob('*') if p.is_file() and p.name not in ['OWN-OUTPUTS.json', 'SHA256SUMS'])
dump('OWN-OUTPUTS.json', dict(at=now, exclusion='Own audit outputs/snapshots excluded from recursive source re-audit.',
                             files=[dict(path=str(p.relative_to(R)), bytes=p.stat().st_size,
                                         sha256=sha(p.read_bytes())) for p in files]))
(S / 'SHA256SUMS').write_text(''.join(sha(p.read_bytes()) + '  ' + str(p.relative_to(S)) + '\n'
                                     for p in files + [S / 'OWN-OUTPUTS.json']))
print(json.dumps(dict(canonical_hashes=actual, coverage=counts, new_refs_verified=new_refs,
                      source_drift=len(drift), library_version=8, metadata_readback_matches=True,
                      next_cursor=final['next_cursor'], pending_mutation=False), indent=2))

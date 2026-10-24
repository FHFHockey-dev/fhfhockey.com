"""Read back the documentary checkpoint and finalize bounded coverage."""
from pathlib import Path
import collections, datetime, hashlib, json, re, subprocess
R = Path('/Users/tim/Code/fhfhockey.com')
S = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-10-draft-debug'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda n: json.loads((S / n).read_text())
dump = lambda n, d: (S / n).write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
v = load('VALIDATION-CANONICAL.json')
actual = {p: sha((R / p).read_bytes()) for p in v['candidate_hashes']}
assert actual == v['candidate_hashes']
j = json.loads((R / 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
old = load('BASELINE-LEDGER.json')
assert len(j['tasks']) == 209 and sum(len(t['evidence']) for t in j['tasks']) == 1030
ids = [t['taskID'] for t in j['tasks']]
assert ids[:208] == [t['taskID'] for t in old['tasks']]
new_refs = []
for a, b in zip(old['tasks'], j['tasks']):
    assert a['scope'] == b['scope'] and b['evidence'][:len(a['evidence'])] == a['evidence']
    new_refs += b['evidence'][len(a['evidence']):]
for t in j['tasks'][208:]:
    new_refs += t['evidence']
assert len(new_refs) == 17
for e in new_refs:
    raw = (R / e['path']).read_bytes()
    assert sha(raw) == e['sha256'] and 1 <= e['line'] <= len(raw.decode().splitlines())
pins = load('SOURCE-PINS.json')
assert all(sha((R / p).read_bytes()) == h for p, h in pins.items())
for p in list(actual)[:2]:
    assert collections.Counter(re.findall(r'^### (\S+) —', (R / p).read_text(), re.M)) == collections.Counter(ids)
assert j['master_consolidation_plan']['after_sha256'] == actual['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md']
delivery = load('LIBRARY-DELIVERY.json')
rec = delivery['result']
assert rec['status'] == 'succeeded' and rec['current_version_number'] == 10 and delivery['helper']['exit_code'] == 0
attrs = []
for a in rec['xattrs']:
    out = subprocess.run(['/usr/bin/xattr', '-p', a['name'], str(R / delivery['local_path'])], capture_output=True, text=True)
    ok = out.returncode == 0 and out.stdout.rstrip('\n') == a['value'].rstrip('\n')
    attrs.append(dict(name=a['name'], matches_returned_value=ok, exit_code=out.returncode))
    assert ok
assert sha((R / delivery['local_path']).read_bytes()) == actual[delivery['local_path']]
cov = load('COVERAGE.json')
counts = dict(collections.Counter(e['status'] for e in cov['entries']))
assert counts == {'content-reviewed': 7}
drift = []
for e in cov['entries'] + cov['reused_prior_full_documentary_review'] + [load('NARROW-SOURCE-COVERAGE.json')]:
    p = R / e['path']
    h = sha(p.read_bytes()) if p.is_file() else None
    if h != e['sha256']:
        drift.append(dict(path=e['path'], reviewed_sha256=e['sha256'], current_sha256=h,
                          action='Preserve frozen reviewed bytes; changed contents require next scoped review.'))
dump('LIVE-CHANGES.json', dict(at=now, scope='Already-reviewed sources only; no recursive inventory', changes=drift))
cont = load('CONTINUATION.json')
cont.update(at=now, status='Segment10 substantive checkpoint delivered; overall audit unfinished.',
            canonical_checkpoint_pending=False, canonical_hashes=actual, library_version=10,
            library_delivery='LIBRARY-DELIVERY.json', no_pending_audit_mutation=True)
cont['resume_rule'] = cont['resume_rule'].replace('after this checkpoint is installed', 'in the installed checkpoint')
dump('CONTINUATION.json', cont)
final = dict(at=now, checkpoint='Segment10 complete; overall audit unfinished', canonical_hashes=actual,
             ids_before=208, ids_after=209, evidence_before=1013, evidence_after=1030,
             added_ids=v['added_ids'], changed_existing_ids=v['changed_existing_ids'],
             all_208_prior_ids_scopes_evidence_prefixes_preserved=True,
             legacy_blocks_each_markdown_byte_identical=32, unchanged_existing_rows_identical=204,
             new_evidence_references_verified=17, frozen_source_pins_verified=len(pins),
             coverage_counts=counts, full_content_bytes=196822,
             prior_full_reviews_reused_without_new_unique_credit=2,
             application_source_coverage='One partial ImportCsvModal source inspection, exact ranges in NARROW-SOURCE-COVERAGE.json; no runtime/source-wide acceptance',
             current_selected_source_drift=drift,
             historical_unique_text_candidates_remaining=cont['unique_text_review_candidates'],
             historical_raw_queue_records_remaining_not_deep_document_obligations=cont['remaining_base_queue_items'],
             known_support_metadata_dispositions_carried=39, selected_unique_report_candidates_remaining=8,
             library=dict(library_file_id=rec['library_file_id'], current_version=10, status=rec['status'],
                          native_download='https://chatgpt.com/api/library/files/' + rec['library_file_id'] + '/download',
                          native_xattr_readback=attrs, local_bytes_unchanged_after_xattrs=True),
             next_cursor=cont['next_cursor'], whole_tree_full_content_review_complete=False,
             application_edits_tests_git_or_production_operations=0, pending_mutation=False)
dump('FINAL-CHECKPOINT.json', final)
report = S / 'REPORT.md'
if '## Verified delivery' not in report.read_text():
    report.write_text(report.read_text() + '\n## Verified delivery\n\nCanonical209IDs/1030evidence installed/read back exactly;17new references and frozen source pins matched. All208 prior scopes/evidence prefixes,204unchanged row objects and32legacy blocks per Markdown remain intact. Same Library identity replacedv9→v10 successfully; returned metadata helper exit0/native readback match and local bytes unchanged. [FINAL-CHECKPOINT.json](FINAL-CHECKPOINT.json) records exact hashes, selected-source change detection and no pending mutation. Overall content audit remains unfinished.\n')
diary = R / 'tasks/diaries/2026-10-24-codex-task-artifact-audit.md'
if 'Segment10handback' not in diary.read_text():
    diary.write_text(diary.read_text() + '\n- Segment10handback ' + now + ':209IDs/1030evidence verified,1proposedP2CSVresolverrow/4existingrows,208prior scopes/prefixes,204unchangedrows,32legacyblocks preserved.7newfull196822bytes;2unchangedpriorfullreviewsreused/onecurrentappfilepartial, no newuniquecreditforreuse. SHA/perfclosure/Phase8retirement andcarddesignunresolved retained. Librarysameidentityv9→v10 succeeded/helper0/nativeattrs/bytesmatch, no pendingmutation. Noappedit/tests/Git/production/newworker. Resume ranker/progress.md thenPRD/discovery/technical via segment10CONTINUATION;1706historicaluniquetextcandidates remain, notwholeauditcomplete.\n')
files = sorted(p for p in S.rglob('*') if p.is_file() and p.name not in ['OWN-OUTPUTS.json', 'SHA256SUMS'])
dump('OWN-OUTPUTS.json', dict(at=now, exclusion='Own audit outputs/snapshots excluded from recursive source re-audit.',
    files=[dict(path=str(p.relative_to(R)), bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in files]))
(S / 'SHA256SUMS').write_text(''.join(sha(p.read_bytes()) + '  ' + str(p.relative_to(S)) + '\n' for p in files + [S / 'OWN-OUTPUTS.json']))
print(json.dumps(dict(canonical_hashes=actual, coverage=counts, prior_reviews_reused=2,
                      source_drift=len(drift), library_version=10, pending_mutation=False,
                      next_cursor=cont['next_cursor']), indent=2))

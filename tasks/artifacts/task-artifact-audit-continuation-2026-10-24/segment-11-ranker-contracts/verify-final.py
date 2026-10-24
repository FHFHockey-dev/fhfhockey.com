"""Finalize the guarded same-identity documentary checkpoint."""
from pathlib import Path
import collections, datetime, hashlib, json, re, subprocess
R = Path('/Users/tim/Code/fhfhockey.com')
S = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-11-ranker-contracts'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda n: json.loads((S / n).read_text())
dump = lambda n, d: (S / n).write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
v = load('VALIDATION-CANONICAL.json')
actual = {p: sha((R / p).read_bytes()) for p in v['candidate_hashes']}
assert actual == v['candidate_hashes']
j = json.loads((R / 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
old = load('BASELINE-LEDGER.json')
ids = [t['taskID'] for t in j['tasks']]
assert len(ids) == 209 and ids == [t['taskID'] for t in old['tasks']]
assert sum(len(t['evidence']) for t in j['tasks']) == 1058
refs = []
for a, b in zip(old['tasks'], j['tasks']):
    assert a['scope'] == b['scope'] and b['evidence'][:len(a['evidence'])] == a['evidence']
    refs += b['evidence'][len(a['evidence']):]
assert len(refs) == 28
for e in refs:
    raw = (R / e['path']).read_bytes()
    assert sha(raw) == e['sha256'] and 1 <= e['line'] <= len(raw.decode().splitlines())
pins = load('SOURCE-PINS.json')
assert all(sha((R / p).read_bytes()) == h for p, h in pins.items())
children = [c for t in j['tasks'] for c in t.get('children', [])]
assert len(children) == 10 and len({c['child_id'] for c in children}) == 10
for p in list(actual)[:2]:
    content = (R / p).read_text()
    assert collections.Counter(re.findall(r'^### (\S+) —', content, re.M)) == collections.Counter(ids)
    assert all(content.count('**' + c['child_id'] + ' —') == 1 for c in children)
assert j['master_consolidation_plan']['after_sha256'] == actual['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md']
d = load('LIBRARY-DELIVERY.json')
rec = d['result']
assert rec['status'] == 'succeeded' and rec['current_version_number'] == 11 and d['helper']['exit_code'] == 0
attrs = []
for a in rec['xattrs']:
    out = subprocess.run(['/usr/bin/xattr', '-p', a['name'], str(R / d['local_path'])], capture_output=True, text=True)
    ok = out.returncode == 0 and out.stdout.rstrip('\n') == a['value'].rstrip('\n')
    attrs.append(dict(name=a['name'], matches_returned_value=ok, exit_code=out.returncode))
    assert ok
assert sha((R / d['local_path']).read_bytes()) == actual[d['local_path']]
cov = load('COVERAGE.json')
counts = dict(collections.Counter(e['status'] for e in cov['entries']))
assert counts == {'content-reviewed': 11, 'content-reviewed-via-common-text-and-delta': 1}
comparison = load('REPOSITORY-VARIANT-COMPARISON.json')
a = (R / comparison['representative']['path']).read_text().splitlines(True)
b = (R / comparison['variant']['path']).read_text().splitlines(True)
for op in comparison['opcodes']:
    if op['operation'] == 'equal':
        x, y = op['representative_range'], op['variant_range']
        assert a[x[0]-1:x[1]] == b[y[0]-1:y[1]]
drift = []
for e in cov['entries'] + cov.get('reused_prior_full_documentary_review', []):
    p = R / e['path']
    h = sha(p.read_bytes()) if p.is_file() else None
    if h != e['sha256']:
        drift.append(dict(path=e['path'], reviewed_sha256=e['sha256'], current_sha256=h,
                          action='Retain frozen reviewed evidence; changed contents require scoped continuation.'))
dump('LIVE-CHANGES.json', dict(at=now, scope='Selected already-reviewed sources; no recursive inventory', changes=drift))
cont = load('CONTINUATION.json')
cont.update(at=now, status='Segment11 canonical and Library checkpoint complete; overall audit unfinished.',
            canonical_checkpoint_pending=False, canonical_hashes=actual, library_version=11,
            library_checkpoint_pending=False, library_replacement_started=True, library_replacement_completed=True,
            library_delivery='LIBRARY-DELIVERY.json', no_pending_audit_mutation=True,
            next_safe_action='Prioritize remaining unique text candidates using saved inventory only, then continue next_cursor; no new tree scan or application/external action.')
dump('CONTINUATION.json', cont)
final = dict(at=now, checkpoint='Segment11 complete; overall audit unfinished', canonical_hashes=actual,
             ids_before=209, ids_after=209, evidence_before=1030, evidence_after=1058,
             added_ids=[], changed_existing_ids=v['changed_existing_ids'], readable_children=10,
             all_209_prior_ids_scopes_evidence_prefixes_preserved=True, legacy_blocks_each_markdown_byte_identical=32,
             unchanged_existing_rows_identical=204, new_evidence_references_verified=28,
             frozen_source_pins_verified=len(pins), coverage_counts=counts, full_document_bytes=251521,
             prior_full_reviews_reused_without_new_unique_credit=3, current_selected_source_drift=drift,
             historical_unique_text_candidates_remaining=1694,
             historical_raw_queue_records_remaining_not_deep_document_obligations=cont['remaining_base_queue_items'],
             known_support_metadata_dispositions_carried=39, selected_unique_reports_pending=8,
             library=dict(library_file_id=rec['library_file_id'], current_version=11, status=rec['status'],
                          native_download='https://chatgpt.com/api/library/files/' + rec['library_file_id'] + '/download',
                          native_xattr_readback=attrs, local_bytes_unchanged_after_xattrs=True),
             next_cursor=cont['next_cursor'], whole_tree_full_content_review_complete=False,
             application_reads_edits_tests_git_or_production_operations=0, pending_mutation=False)
dump('FINAL-CHECKPOINT.json', final)
dump('COUNTS-CHECKPOINT-RESULT.json', dict(at=now, baseline_parent_ids=189, current_parent_ids=209,
     audit_added_parent_ids=20, original_existing_materially_changed=18, original_existing_status_corrected=13,
     count_categories_overlap=True, legacy_reopened=0, readable_children_added=10,
     current_evidence_entries=1058, library_version=11, comparison_receipt='COUNTS-EXPLANATION.json'))
report = S / 'REPORT.md'
if '## Verified delivery' not in report.read_text():
    report.write_text(report.read_text() + '\n## Verified delivery\n\nCanonical209parentIDs/1058evidence/10readablechildren installed and read back exactly. All28new references and frozen snapshots match; all209prior scopes/prefixes,204unchanged row objects and32legacy blocks per Markdown are preserved. Existing Library identity replacedv10→v11 successfully; metadata helper exit0/native readback match and local bytes unchanged. [FINAL-CHECKPOINT.json](FINAL-CHECKPOINT.json) records exact hashes and selected-source drift. Count handback was delivered before replacement; no uncertain or pending operation remains.\n')
diary = R / 'tasks/diaries/2026-10-24-codex-task-artifact-audit.md'
if 'Segment11deliverycomplete' not in diary.read_text():
    diary.write_text(diary.read_text() + '\n- Segment11deliverycomplete ' + now + ':209parentIDs/1058evidence/10children readback; all209old scopes/prefixes,204unchangedrows/32legacyblocks preserved. Librarysameidentityv10→v11 succeeded/helper0/nativeattrs/bytesmatch, no pendingmutation.12Ranker docs covered(11direct+1exactshared/delta),251521bytes;1694textcandidates remain. Next: saved-inventory-only family/role prioritization then ForgeCommandCenter uniquePRD/task batch. Noapp/Git/production/newworkers.\n')
files = sorted(p for p in S.rglob('*') if p.is_file() and p.name not in ['OWN-OUTPUTS.json', 'SHA256SUMS'])
dump('OWN-OUTPUTS.json', dict(at=now, exclusion='Own audit outputs/snapshots excluded from recursive source re-audit.',
    files=[dict(path=str(p.relative_to(R)), bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in files]))
(S / 'SHA256SUMS').write_text(''.join(sha(p.read_bytes()) + '  ' + str(p.relative_to(S)) + '\n' for p in files + [S / 'OWN-OUTPUTS.json']))
print(json.dumps(dict(canonical_hashes=actual, readable_children=10, coverage=counts,
                      source_drift=len(drift), library_version=11, pending_mutation=False), indent=2))

"""Final readback and handback for this documentary checkpoint."""
from pathlib import Path
import collections, datetime, hashlib, json, re, subprocess
R = Path('/Users/tim/Code/fhfhockey.com')
S = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-09-draft-yahoo-audit'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda n: json.loads((S / n).read_text())
dump = lambda n, d: (S / n).write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
v = load('VALIDATION-CANONICAL.json')
actual = {p: sha((R / p).read_bytes()) for p in v['candidate_hashes']}
assert actual == v['candidate_hashes']
old = load('BASELINE-LEDGER.json')
j = json.loads((R / 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
assert len(j['tasks']) == 208 and sum(len(t['evidence']) for t in j['tasks']) == 1013
ids = [t['taskID'] for t in j['tasks']]
assert ids[:207] == [t['taskID'] for t in old['tasks']]
new_refs = []
for a, b in zip(old['tasks'], j['tasks']):
    assert a['scope'] == b['scope'] and b['evidence'][:len(a['evidence'])] == a['evidence']
    new_refs += b['evidence'][len(a['evidence']):]
for t in j['tasks'][207:]:
    new_refs += t['evidence']
assert len(new_refs) == 31
for e in new_refs:
    raw = (R / e['path']).read_bytes()
    assert sha(raw) == e['sha256'] and 1 <= e['line'] <= len(raw.decode().splitlines())
pins = load('SOURCE-PINS.json')
assert all(sha((R / p).read_bytes()) == h for p, h in pins.items())
for p in list(actual)[:2]:
    text = (R / p).read_text()
    assert collections.Counter(re.findall(r'^### (\S+) —', text, re.M)) == collections.Counter(ids)
assert j['master_consolidation_plan']['after_sha256'] == actual['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md']
delivery = load('LIBRARY-DELIVERY.json')
record = delivery['result']
assert record['status'] == 'succeeded' and record['current_version_number'] == 9
assert delivery['helper']['exit_code'] == 0
attrs = []
for a in record['xattrs']:
    out = subprocess.run(['/usr/bin/xattr', '-p', a['name'], str(R / delivery['local_path'])],
                         capture_output=True, text=True)
    ok = out.returncode == 0 and out.stdout.rstrip('\n') == a['value'].rstrip('\n')
    attrs.append(dict(name=a['name'], matches_returned_value=ok, exit_code=out.returncode))
    assert ok
assert sha((R / delivery['local_path']).read_bytes()) == actual[delivery['local_path']]

# Keep partial task-file coverage in the same ledger, without promotion to full-content review.
cov = load('COVERAGE.json')
status = load('STATUS-SOURCE-EXTRACT.json')
partial = [dict(e, status='partially-inspected', scope='Only selected coordinator source fields/ranges in STATUS-SOURCE-EXTRACT reviewed; no full-file or authority claim.') for e in status['sources']]
alias = load('SUPER-ALIAS-EXTRACT.json')
partial.append(dict(path=alias['path'], sha256=alias['sha256'], status='partially-inspected',
                    reviewed_ranges=[[e['line'], e['line']] for e in alias['selected_lines']], scope=alias['scope']))
seen = {e['path'] for e in cov['entries']}
cov['entries'].extend(e for e in partial if e['path'] not in seen)
cov['counts'] = dict(collections.Counter(e['status'] for e in cov['entries']))
cov['outside_tasks_narrow_source_coverage'] = 'NARROW-SOURCE-COVERAGE.json'
dump('COVERAGE.json', cov)
drift = []
for e in cov['entries']:
    p = R / e['path']
    current = sha(p.read_bytes()) if p.is_file() else None
    if current != e['sha256']:
        drift.append(dict(path=e['path'], reviewed_sha256=e['sha256'], current_sha256=current,
                          reviewed_scope=e['status'], action='Retain exact frozen extracts; later content is queued, never silently accepted.'))
narrow = load('NARROW-SOURCE-COVERAGE.json')
assert sha((R / narrow['path']).read_bytes()) == narrow['sha256']
dump('LIVE-CHANGES.json', dict(at=now, scope='Selected already-reviewed sources only; no recursive scan', changes=drift))
cont = load('CONTINUATION.json')
cont.update(at=now, status='Segment09 coherent checkpoint delivered; overall audit unfinished.',
            canonical_checkpoint_pending=False, canonical_hashes=actual, library_version=9,
            library_delivery='LIBRARY-DELIVERY.json', no_pending_audit_mutation=True)
cont['resume_rule'] = cont['resume_rule'].replace('if this checkpoint is installed; until then207/982 canonical remains.', 'canonical checkpoint; original207 scopes and all982 earlier evidence entries preserved.')
dump('CONTINUATION.json', cont)
limits = load('LIMITATIONS.json')
limits['pending_audit_write'] = None
dump('LIMITATIONS.json', limits)
final = dict(at=now, checkpoint='segment09 complete; overall audit unfinished', canonical_hashes=actual,
             ids_before=207, ids_after=208, evidence_before=982, evidence_after=1013,
             added_ids=v['added_ids'], changed_existing_ids=v['changed_existing_ids'],
             all_207_prior_ids_scopes_evidence_prefixes_preserved=True,
             legacy_blocks_each_markdown_byte_identical=32, unchanged_existing_rows_identical=202,
             new_evidence_references_verified=31, frozen_source_pins_verified=len(pins),
             coverage_counts=cov['counts'], full_content_bytes=372245,
             application_source_inspected_only='Read-only23-line SCSS contradiction check1744–1766; no other app content acceptance',
             historical_unique_text_candidates_remaining=cont['unique_text_review_candidates'],
             historical_raw_queue_records_remaining_not_deep_document_obligations=cont['remaining_base_queue_items'],
             known_support_metadata_role_dispositions_carried=39, selected_unique_report_candidates_remaining=8,
             current_reviewed_source_drift=drift,
             library=dict(library_file_id=record['library_file_id'], current_version=9, status=record['status'],
                          native_download='https://chatgpt.com/api/library/files/' + record['library_file_id'] + '/download',
                          native_xattr_readback=attrs, local_bytes_unchanged_after_xattrs=True),
             next_cursor=cont['next_cursor'], whole_tree_full_content_review_complete=False,
             application_edits_tests_git_or_production_operations=0, pending_mutation=False)
dump('FINAL-CHECKPOINT.json', final)
report = S / 'REPORT.md'
marker = '## Verified delivery'
if marker not in report.read_text():
    report.write_text(report.read_text() + '\n' + marker + '\n\nCanonical208IDs/1013evidence read back exactly. All31new references and16frozen snapshots match; all207 prior scopes/evidence prefixes,202unchanged rows and32legacy blocks per Markdown are preserved. Same Library identity replacedv8→v9 successfully; metadata helper exit0 and native readback match, local bytes unchanged. [FINAL-CHECKPOINT.json](FINAL-CHECKPOINT.json) records all hashes and selected-source live-change detection. No pending audit mutation. Coverage is16full documents and three partial task-file extracts plus the separately bounded23-line application-source check.\n')
diary = R / 'tasks/diaries/2026-10-24-codex-task-artifact-audit.md'
if 'Segment09handback' not in diary.read_text():
    diary.write_text(diary.read_text() + '\n- Segment09handback ' + now + ':208IDs/1013evidence verified, oneproposedP3SITE-PICKUP-TOKENS,5existingrows reconciled;207prior scopes/prefixes,202unchangedrows,32legacyblocks preserved.16full372245bytes/3partialtaskextracts plus23-lineCSScheck; noappedit/test/Git/productionaction. Librarysameidentityv8→v9 succeeded/helper0/nativeattrs/bytesmatch, no pendingmutation. Yahoo no-pruning/provider/historygates, explicitSavedDraftprivate-importexception and S05R1/S01/S02R1limitedlocalacceptance retained; S03/live/owneractivation0of1blocked remain separate. Resume embeddedprd-draft-dash-debug.md from segment09CONTINUATION; overallauditunfinished.\n')
files = sorted(p for p in S.rglob('*') if p.is_file() and p.name not in ['OWN-OUTPUTS.json', 'SHA256SUMS'])
dump('OWN-OUTPUTS.json', dict(at=now, exclusion='Own audit outputs/snapshots excluded from recursive source re-audit.',
    files=[dict(path=str(p.relative_to(R)), bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in files]))
(S / 'SHA256SUMS').write_text(''.join(sha(p.read_bytes()) + '  ' + str(p.relative_to(S)) + '\n'
                                    for p in files + [S / 'OWN-OUTPUTS.json']))
print(json.dumps(dict(canonical_hashes=actual, coverage=cov['counts'], new_evidence_verified=31,
                      source_drift=len(drift), library_version=9, pending_mutation=False,
                      next_cursor=cont['next_cursor']), indent=2))

import pathlib,json,re,hashlib,datetime,sys
root=pathlib.Path('/Users/tim/Code/fhfhockey.com'); r=root/'tasks/artifacts/fhfh-sprint-ledger-2026-10-22'
d=json.loads((r/'LEDGER.json').read_text()); inv=json.loads((r/'CHECKPOINT-INVENTORY.json').read_text());watch=json.loads((r/'USAGE-WATCH.json').read_text());plan=d['master_consolidation_plan'];target=root/plan['target'];current_before=target.read_bytes();assert hashlib.sha256(current_before).hexdigest()==plan.get('after_sha256',plan['before_sha256']),'Concurrent master change: reconcile before replacement'
archive_rel='tasks/artifacts/fhfh-sprint-ledger-2026-10-22/archive/MASTER-TASKLIST-2026-10-20.before-2026-10-23.md';archive=root/archive_rel
before=archive.read_bytes() if archive.exists() else current_before;assert hashlib.sha256(before).hexdigest()==plan['before_sha256'],'Original archive pin mismatch'
old=before.decode();ids=[x['taskID'] for x in d['tasks']];legacy=plan['legacy_ids'];assert len(ids)==len(set(ids))==188;assert all('MASTER-'+x in ids for x in legacy)
archive_rel='tasks/artifacts/fhfh-sprint-ledger-2026-10-22/archive/MASTER-TASKLIST-2026-10-20.before-2026-10-23.md';archive=root/archive_rel
now=datetime.datetime.now(datetime.timezone.utc).isoformat();last=watch['records'][-1]
def rel_link(path):
 p=pathlib.Path(path);return str(p) if p.is_absolute() else '../../'+path
lines=['# FHFH master task list — consolidated 2026-10-23','',f'As of `{now}`. Canonical checkout `{d["branch"]}`; observed HEAD `{d["head"]}`. This replaces the old master view using the existing sprint ledger IDs. Implementation, independent acceptance and release are separate. FA Portal is excluded.','',f'All **{len(legacy)} original master IDs** and **{len(ids)} current ledger rows** are preserved. The exact prior master is retained in [the archival snapshot]({rel_link(archive_rel)}) (SHA256 `{plan["before_sha256"]}`). Older source findings and scopes remain available there; absence of a fresh review is not completion. Rows marked inventoried only have not received a file-health audit.','', '## Stop and resume control','',f'TJ threshold:5% remaining. Latest meter `{last["at"]}`: `{last["remaining_percent"]}%` remaining; actual threshold status `{watch["threshold_reached"]}`. The meter describes account usage, never task completion. Protected release/RSO/consolidation lanes may continue to0% under TJ’s latest instruction; other lanes checkpoint naturally at5%. No worker operation is interrupted. See [watch evidence](../artifacts/fhfh-sprint-ledger-2026-10-22/USAGE-WATCH.json) and [handoff inventory](../artifacts/fhfh-sprint-ledger-2026-10-22/CHECKPOINT-INVENTORY.json).','', 'Release owner `01a1637a-4222-70c0-8439-cb3cc46b20c4` retains Git/index and exact-candidate composition. This consolidation performs no application changes, tests, production calls, migration application, capture, paid call, commit, push or deployment. Resume only from each pinned handoff; confirm any recorded operation completed before restarting it.','', 'Every model capture, including baseline recapture, requires TJ approval. Native numeric use requires target-by-target review; preserve the approved interim bridge and Start Chart. D4 hosted89→90 before October30 requires its separate bounded approval; local PG17 stand-ins are not hosted/PG15/PostgREST/JWT acceptance. Keep billing enforcement and Luna activation gates as recorded. No retroactive private-league export or automatic league-analytics collection.','', '## Current checkpoint summary','', '| Lane | Supported result | Remaining gate |','| --- | --- | --- |','| Release composition | Accepted packets exist locally; exact final candidate is separate | Latest release handoff, static/browser acceptance and exact publication gates |','| Selected Release C / trusted Yahoo / billing | Scoped independent acceptance; historical release identity retained | Coherent composition; browser/current service boundaries remain scoped |','| Game Grid R5 | Local independent acceptance and TJ visual acceptance reported | Exact integration; production refresh latency not measured |','| News attribution | Serialization P2 closed with9+10 independent checks | Metadata sync loss, trusted public-claim contract and source identity |','| Offline model variants | All186 calculations finished; DU/DUK HOLD | PPP and defender representation failures; no promotion/capture |','| Gate kit / conservation / SoS | Offline scoped acceptance | No predictive qualification from synthetic checks; SoS data eligibility held |','| F6 / Luna / league analytics | Local tooling or design complete | Independent review, actual data/source/budget/privacy and rollout gates |','', '## Saved lane checkpoints','', '| Lane | State at checkpoint | Pinned handoff |','| --- | --- | --- |']
for x in inv['participants']:
 h=x.get('handoff',{}); path=h.get('path'); reference=f'[{path}]({rel_link(path)}) · `{h.get("sha256")}`' if path else 'Final handoff pending'
 lines.append(f'| {x["title"]} (`{x["thread"]}`) | {x.get("diary_status","unverified").replace("|","/")} | {reference} |')
lines+=['','Retained approved task3 pilot:5,219rows; Library export `libfile_bdb4847bbdbc8191b5a958bce4ab9fde` (3,363,725bytes including newline), executedSQL `libfile_abe8480e81248191989de2276fa092cd`. Materialize the existing files if needed; do not execute a second production query.','', 'Scout is a separately coordinated project; its checkpoint remains in the roster without adding a FHFH application task. Adjacent Quest work retains its own handoff and does not acquire a FHFH implementation assignment.','', '## Task ownership and evidence','', 'The task sections below are the same stable IDs as [LEDGER.json](../artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json), with full dated receipts in [LEDGER.md](../artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md). CR-* and handover R*/F* labels remain source aliases, not a second register. Named custodians are not proof of an active edit lease. `UNASSIGNED` is explicit. Historical source pins identify reviewed bytes; they do not silently qualify later changes.','']
prev=None
for t in d['tasks']:
 if t['group']!=prev:lines+=['## '+t['group'],''];prev=t['group']
 lines+=['### '+t['taskID']+' — '+t['scope'],'']
 own=d['owners'][t['owner']];review=d['owners'][t['reviewer']]
 lines+=[f'- **Owner:** {t["owner"]} (`{own.get("thread") or "unassigned"}`); reviewer {t["reviewer"]} (`{review.get("thread") or "unassigned"}`).',f'- **Implementation:** {t["implementation"]}',f'- **Acceptance:** {t["acceptance"]}',f'- **Release:** {t["release"]}',f'- **Evidence level / limits:** {t["evidence_level"]}. {t["evidence_scope"]}',f'- **Verification:** {t["verification"]}',f'- **Dependencies / gate:** {t["dependencies"]} {t["acceptance_release_gate"]}',f'- **Next:** {t["next_action"]}',f'- **Status evidence date:** `{t["as_of"]}`.']
 evidence=[]
 for e in t['evidence'][-3:]:
  if 'path' in e:
   path=archive_rel if e['path']==plan['target'] and e.get('sha256')==plan['before_sha256'] else e['path'];evidence.append(f'[{path}:{e.get("line",1)}]({rel_link(path)}) SHA256 `{e.get("sha256","unavailable")}`')
  elif 'sha'in e:evidence.append('commit `'+e['sha']+'`')
 lines.append('- **Pinned references:** '+'; '.join(evidence)+'.')
 if t['taskID'].startswith('MASTER-'):
  key=t['taskID'][7:];m=re.search(r'^### '+re.escape(key)+r' —.*?(?=^### |^## |\Z)',old,re.M|re.S)
  assert m,key
  original_lines=m.group(0).splitlines()
  scope=[line.split(': ',1)[1] for line in original_lines if line.startswith('- Scope') and ': ' in line]
  verify=[line.removeprefix('- ') for line in original_lines if line.startswith('- Verify')]
  extra=[line.removeprefix('- ') for line in original_lines if line.strip() and not line.startswith(('### ','- Impact:','- Evidence:','- Additional evidence:','- Scope','- Verify','- Dependencies:'))]
  if scope:lines.append('- **Preserved original scope:** '+' '.join(scope)+' Current status and authorization above control; original scope is not new authority.')
  if verify:lines.append('- **Original acceptance requirements:** '+' '.join(verify)+' These remain proposed unless a current receipt above establishes execution.')
  if extra:lines.append('- **Retained additional requirements:** '+' '.join(extra))
 lines+=['']
output='\n'.join(lines).rstrip()+'\n';outids=re.findall(r'^### (\S+) —',output,re.M);assert outids==ids
preview=pathlib.Path('/tmp/fhfh-master-preview.md');preview.write_text(output)
if '--install' in sys.argv:
 assert watch['threshold_reached'],'No verified threshold event'
 protected=set(watch.get('protected_threads',[]))
 assert all(x.get('handoff') for x in inv['participants']), 'Missing current diary path'
 assert all(x.get('natural_checkpoint_verified') or x['thread'] in protected for x in inv['participants']), 'Noncritical natural handoff incomplete'
 partial=not all(x.get('natural_checkpoint_verified') for x in inv['participants'])
 if partial: output=output.replace('# FHFH master task list — consolidated 2026-10-23', '# FHFH master task list — incremental checkpoint 2026-10-23',1);output=output.replace('## Stop and resume control','**PARTIAL CONSOLIDATION:** all lane diaries are accounted for, but protected RSO/release work remains active; this ledger consolidation is saved. This is not an all-workers-finished or release-acceptance claim. Running handles and failed checks below remain open.\n\n## Stop and resume control',1)
 if not partial: output=output.replace('## Stop and resume control', '**CHECKPOINT AGGREGATION COMPLETE:** all 19 lane handoffs are accounted for and current turns ended at natural checkpoints. All 188 task IDs and 32 original scopes remain preserved. Coherent release assembly and broader release acceptance are unfinished; this is not deployment approval.\n\n## Stop and resume control',1)
 archive.parent.mkdir(exist_ok=True)
 if archive.exists():assert archive.read_bytes()==before,'Archive differs'
 else:archive.write_bytes(before)
 assert target.read_bytes()==current_before,'Concurrent master change'
 # Preserve the original ledger for receipt-path provenance before repointing historical master citations.
 snap=r/'archive/LEDGER.before-master-consolidation-2026-10-23.json'
 if not snap.exists():snap.write_bytes((r/'LEDGER.json').read_bytes())
 oldmd=(r/'LEDGER.md').read_text()
 for t in d['tasks']:
  for e in t['evidence']:
   if e.get('path')==plan['target'] and e.get('sha256')==plan['before_sha256']:
    e['original_path']=e['path'];e['path']=archive_rel
 oldmd=oldmd.replace('`'+plan['target']+':','`'+archive_rel+':')
 plan.update({'status':('Partial consolidation: noncritical natural handoffs complete; protected lanes active' if partial else 'Consolidated after verified natural handoffs; all original/current task IDs preserved'),'archive':archive_rel,'after_sha256':hashlib.sha256(output.encode()).hexdigest(),'completed_at':now,'git_status':'Local documentation only; release owner holds index, no ledger commit/push'})
 d['as_of']=now;(r/'LEDGER.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');(r/'LEDGER.md').write_text(oldmd)
 target.write_text(output)
 print('INSTALLED',str(target),'archive',str(archive))
print(json.dumps({'preview':str(preview),'bytes':len(output.encode()),'rows':len(ids),'legacy':len(legacy),'sha256':hashlib.sha256(output.encode()).hexdigest(),'installed':'--install'in sys.argv}))

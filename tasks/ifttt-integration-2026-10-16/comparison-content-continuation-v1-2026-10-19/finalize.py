"""Consolidate authentic results and source-grounded assistant observations.

No provider client/credential call; no automatic semantic grader or winner.
"""
import copy
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

from adapter import HERE, BASE, bridge, p, response_view
sys.path.insert(0,str(HERE/'diagnostic-2'))
import diagnostic
sys.path.insert(0,str(BASE/'comparison-adjudication-bridge-v1-2026-10-19'))
import adjudication


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(name,value):
    with (HERE/name).open('x',encoding='utf-8') as f:f.write(value if isinstance(value,str) else json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def main():
    plan=json.loads((HERE/'PLAN.json').read_text())
    first=BASE/'comparison-approved-execution-2026-10-19'
    first_result=json.loads((first/'run-01/result.json').read_text())
    current=json.loads((HERE/'pass-1/result.json').read_text())
    extra=json.loads((HERE/'diagnostic-2/run-01/result.json').read_text())
    assert current['status']=='completed_bounded_continuation' and extra['status']=='completed_single_revision_diagnostic'
    raw=json.loads((first/'raw-producers.json').read_text())
    selected=json.loads((first/'aligned-producers.json').read_text())
    modes={k:'frozen_unique_quote_v1' for k in raw}
    normalized={k:p.normalize_family(plan['envelopes'][k],selected[k]) for k in raw}
    reviews={};calls=[]
    for r in first_result['records']:
        group=['S01','S02','S03','S04','S05'][r['stage']//3]
        kind='extraction' if r['endpoint']=='responses' else 'rules_decisions' if r['stage']%3==1 else 'extraction_decisions'
        calls.append(dict(r,group=group,kind=kind,origin='original_pass'))
        if r['endpoint']=='decisions':reviews[(group,kind)]=r['verifierReview']
    s05=response_view(plan['envelopes']['S05'],plan['saved_S05_response'])
    raw['S05']=s05['raw_body'];selected['S05']=s05['revised_body'];normalized['S05']=s05['normalization'];modes['S05']='subject_adjacent_parenthesis_v2_saved_response'
    content_audits={'S05':s05}
    for r in current['records']:
        calls.append(dict(r,origin='continuation_pass'))
        if r['endpoint']=='responses':
            group=r['group'];view=r['content'];raw[group]=view['raw_body'];selected[group]=view['revised_body']
            normalized[group]=view['normalization'];modes[group]='subject_adjacent_parenthesis_v2';content_audits[group]=view
        else:reviews[(r['group'],r['kind'])]=r['verifierReview']
    diag=extra['record'];calls.append(dict(diag,group='S10',kind='extraction_decisions_revision_v3',endpoint='decisions',origin='revision_diagnostic'))
    diagplan=json.loads((HERE/'diagnostic-2/PLAN.json').read_text())
    selected['S10']=diagplan['revised_body'];normalized['S10']=p.normalize_family(plan['envelopes']['S10'],selected['S10'])
    modes['S10']='unique_quote_revision_v3_saved_response';reviews[('S10','extraction_decisions')]=diag['review']
    assert set(raw)==set(selected)==set(plan['envelopes']) and all(not n['errors'] for n in normalized.values())
    assert sum(len(n['claims']) for n in normalized.values())==51
    assert len(normalized['S10']['revisions'])==1
    write('all-raw-producers.json',raw);write('selected-aligned-producers.json',selected);write('selected-adapter-versions.json',modes)
    write('content-audits.json',content_audits)
    compact=[]
    for r in calls:
        body=r['response'];charge=bridge.usage_cost(r['endpoint'],body)
        assert charge==r['conservativeChargeCeilingNanoUsd']
        compact.append({'group':r['group'],'kind':r['kind'],'origin':r['origin'],'endpoint':r['endpoint'],
            'request_sha256':r['requestHash'],'usage':body['usage'],'charge_ceiling_nano_usd':charge,
            'latency_ms':r['latencyMs'],'safe_provider_metadata':r['audit']['providerMetadata']})
    assert len(compact)==31 and sum(r['endpoint']=='responses' for r in compact)==10
    write('all-authentic-call-usage.json',compact)
    model_cost=sum(r['charge_ceiling_nano_usd'] for r in compact if r['endpoint']=='responses')
    rules_check_cost=sum(r['charge_ceiling_nano_usd'] for r in compact if r['kind']=='rules_decisions')
    extraction_check_all=sum(r['charge_ceiling_nano_usd'] for r in compact if r['endpoint']=='decisions' and r['kind']!='rules_decisions')
    previous_s10_check=next(r['conservativeChargeCeilingNanoUsd'] for r in current['records'] if r['group']=='S10' and r['kind']=='extraction_decisions')
    costs={'sample_total_nano_usd':sum(r['charge_ceiling_nano_usd'] for r in compact),
        'original_pass_nano_usd':sum(r['charge_ceiling_nano_usd'] for r in compact if r['origin']=='original_pass'),
        'continuation_pass_nano_usd':sum(r['charge_ceiling_nano_usd'] for r in compact if r['origin']=='continuation_pass'),
        'revision_diagnostic_nano_usd':diag['conservativeChargeCeilingNanoUsd'],
        'rules_only_paid_nano_usd':0,'rules_plus_decisions_nano_usd':rules_check_cost,
        'extraction_only_shared_nano_usd':model_cost,
        'extraction_plus_all_checks_incurred_nano_usd':model_cost+extraction_check_all,
        'extraction_plus_selected_checks_attribution_nano_usd':model_cost+extraction_check_all-previous_s10_check,
        'superseded_S10_checker_still_charged_nano_usd':previous_s10_check,
        'shared_cost_rule':'Extraction is shared with extraction+Decisions and billed once; do not sum path attributions as independent spends.',
        'charge_kind':'Conservative safely usage-priced ceilings, not final invoices.'}
    assert costs['sample_total_nano_usd']==7369315
    before=sqlite3.connect('file:'+str((HERE/'baseline-budget.sqlite').resolve())+'?mode=ro',uri=True)
    live=sqlite3.connect('file:'+str(bridge.LIVE.resolve())+'?mode=ro',uri=True)
    try:
        baseline_rows=before.execute('select * from attempts order by id').fetchall();ids=[r[0] for r in baseline_rows];slots=','.join('?' for _ in ids)
        assert live.execute('select * from attempts where id in ('+slots+') order by id',ids).fetchall()==baseline_rows
        assert live.execute('select * from experiment order by id').fetchall()==before.execute('select * from experiment order by id').fetchall()
        assert live.execute('select * from attempt_reconciliations order by id').fetchall()==before.execute('select * from attempt_reconciliations order by id').fetchall()
        exposure=live.execute("select sum(case when state='settled' then actual else max(reserve,coalesce(actual,0)) end) from attempts").fetchone()[0]
        unknown=live.execute("select id,reserve,state,actual from attempts where state<>'settled'").fetchall()
        assert unknown==[('lindgren-0',254394800,'uncertain',None)]
        ordered=live.execute("select reserve,actual from attempts where id like 'human-benchmark-v2-%' or id like 'content-cont-v1-%' or id='s10-revision-diagnostic-0' order by rowid").fetchall()
        running=254807878;peak=running
        for reserve,actual in ordered:peak=max(peak,running+reserve);running+=actual
        assert running==exposure==262177193 and peak==518504664
        assert live.execute('select count(*) from attempts').fetchone()[0]==36
    finally:before.close();live.close()
    costs.update({'all_known_experiment_ceilings_nano_usd':7782393,'original_unknown_reservation_nano_usd':254394800,
        'aggregate_exposure_nano_usd':exposure,'peak_reserved_exposure_nano_usd':peak,'cap_nano_usd':520000000,
        'headroom_nano_usd':520000000-exposure,'live_ledger_sha256':sha(bridge.LIVE),'new_uncertain_reservations':0,
        'all_prior_18_attempts_unchanged':True,'new_continuation_calls':18,'no_more_paid_passes_planned':True})
    write('cost-and-ledger-reconciliation.json',costs)
    with (HERE/'final-budget-evidence.sqlite').open('xb') as f:f.write(bridge.LIVE.read_bytes())
    coverage={'groups':10,'source_records':12,'benchmark_source_units':50,
        'rules':{'outputs':10,'missing':0,'raw_proposals':sum(len(c['claims']) for b in plan['rules_outputs'].values() for c in b['records'])},
        'rules_decisions':{'outputs':10,'missing':0,'calls':10,'scope':'four nonempty-set support checks; six empty-output source-relevance checks'},
        'extraction':{'outputs':10,'missing':0,'calls':10,'raw_proposals':51,'aligned_claims_strictly_valid':51,
            'notes':'S05 saved output reused with v2 numeric proof; S01–S04 frozen v1; S10 saved revision repaired in v3. Original failures remain preserved.'},
        'extraction_decisions':{'outputs':10,'missing':0,'calls':11,'selected_checks':10,'extra_diagnostic':1,'selected_all_record_sets_checked':True},
        'all_selected_revisions_strictly_valid':1,'source_content_or_quality_certified':False,'world_truth':None,'publication_readiness':None}
    write('coverage.json',coverage)
    verifier={g:{kind:adjudication.verifier_columns(reviews[(g,kind)]) for kind in ['rules_decisions','extraction_decisions']} for g in plan['envelopes']}
    for g in verifier:
        # A high relevance score for an empty set is not successful extraction.
        r=next(x for x in calls if x['group']==g and x['kind']=='rules_decisions')
        verifier[g]['rules_decisions']['question_name']=r['request']['questions'][0]['name']
    write('verifier-results-private.json',verifier)
    gold=json.loads((BASE/'human-adjudicated-benchmark-v1-2026-10-19/benchmark.json').read_text())
    diagnostic_rows=[]
    for group in gold['groups']:
        g=group['sample_id'];r=p.normalize_family(plan['envelopes'][g],plan['rules_outputs'][g])
        diagnostic_rows.append({'group':g,'rules':adjudication.diagnostic_grade(group,r),
            'rules_decisions':adjudication.diagnostic_grade(group,r,review=reviews[(g,'rules_decisions')]),
            'raw_extraction':adjudication.diagnostic_grade(group,p.normalize_family(plan['envelopes'][g],raw[g])),
            'selected_extraction':adjudication.diagnostic_grade(group,normalized[g]),
            'selected_extraction_decisions':adjudication.diagnostic_grade(group,normalized[g],review=reviews[(g,'extraction_decisions')]),
            'adapter_version':modes[g]})
    write('lexical-diagnostics-only.json',{'meaning':'Lexical contract diagnostics only; not factual-error counts or a quality ranking.',
        'automatic_factual_winner':None,'groups_denominator':10,'source_units_denominator':50,'rows':diagnostic_rows})
    seed=json.loads((first/'private-mapping.json').read_text())['blinding_seed']
    bodies={'rules':plan['rules_outputs'],'rules_decisions':plan['rules_outputs'],'extraction':raw,'extraction_decisions':raw}
    public,private=adjudication.blind_sheet(plan['envelopes'],bodies,reviews,seed=seed)
    # Append revised numeric-anchor variants; keep all original raw/v1 rows and
    # their neutral IDs. No semantic field, grade or actor is changed.
    for group in public['groups']:
        g=group['group_id'];rows=group['proposals']
        def key(row):return p.digest({'kind':row['kind'],'record_id':row['record_id'],'fields':row['asserted_fields_exact']})
        existing={key(row):row for row in rows}
        variants=[]
        for doc in selected[g]['records']:
            variants += [('claim',doc['record_id'],i,c) for i,c in enumerate(doc['claims'])]
        variants += [('revision',rev['to_record_id'],i,rev) for i,rev in enumerate(selected[g]['revisions'])]
        for kind,record_id,index,item in variants:
            fields=copy.deepcopy(item);original_id=fields.pop('id',None)
            fingerprint=p.digest({'kind':kind,'record_id':record_id,'fields':fields})
            if fingerprint not in existing:
                proposal_id=g+'-P'+str(len(rows)+1).zfill(3)
                row={'proposal_id':proposal_id,'kind':kind,'record_id':record_id,'asserted_fields_exact':fields,
                    'appearances':[],'human_verdict':None,'error_categories':[],'source_quote':None,'reason':None}
                rows.append(row);existing[fingerprint]=row;private['proposal_mapping'][proposal_id]=[]
            row=existing[fingerprint]
            for arm in ['extraction','extraction_decisions']:
                appearance={'neutral_arm':private['arm_mapping'][arm],'variant':modes[g]}
                if appearance not in row['appearances']:row['appearances'].append(appearance)
                private['proposal_mapping'][row['proposal_id']].append({'arm':arm,'variant':modes[g],'original_id':original_id,'record_id':record_id,'index':index})
    previous_public=json.loads((first/'BLINDED-SHEET.json').read_text())
    old003=next(r for r in previous_public['groups'][0]['proposals'] if r['proposal_id']=='S01-P003')
    new003=next(r for r in public['groups'][0]['proposals'] if r['proposal_id']=='S01-P003')
    assert old003['asserted_fields_exact']==new003['asserted_fields_exact']
    private['blinding_seed']=seed;private['raw_outputs_unchanged']=True
    write('COMPLETE-BLINDED-SHEET.json',public);write('COMPLETE-BLINDED-SHEET.md',adjudication.render_sheet(public));write('private-mapping.json',private)
    queue=[]
    for group,player,value in [('S01','Anthony Stolarz','for the Leafs'),('S08','Bussi','listed as goalie'),('S09','Carter Hart','first goaltender off the ice')]:
        g=next(x for x in public['groups'] if x['group_id']==group)
        matches=[r for r in g['proposals'] if r['kind']=='claim' and r['asserted_fields_exact']['player']==player and r['asserted_fields_exact']['value']==value]
        preferred=next((r for r in matches if any(a['variant']==modes[group] for a in r['appearances'])),matches[-1])
        queue.append({'source':g['full_source'],'proposal':preferred,'owner_verdict':None,'question':'What normalized goalie category does this encoding express in the intended contract? Mark supported/equivalent, classification/qualification error, or unresolved. This is not a real-world verification question.'})
    write('FOCUSED-HUMAN-QUEUE.json',{'purpose':'Only unresolved output-encoding judgments, not regrading every row.','items':queue,
        'P003_owner_classification_error_preserved_separately':True,'P004_not_inferred_approved':True,'arm_mapping_hidden':True})
    # Original frozen benchmark, original pass and owner adjudication are read
    # only throughout; dynamic canonical budget changes were the authorized work.
    bridge.check_pins(bridge.load_plan())
    owner=first/'human-adjudications/0001-S01-P003-classification/manifest.json'
    write('owner-adjudication-reference.json',{'path':str(owner),'sha256':sha(owner),'proposal':'S01-P003','verdict':'classification_error','other_proposals_not_owner_graded':True})
    print(json.dumps({'paths_completed_each':10,'missing_outputs':0,'sample_calls':31,'sample_cost_ceiling_usd':costs['sample_total_nano_usd']/1e9,
        'all_known_experiment_ceilings_usd':costs['all_known_experiment_ceilings_nano_usd']/1e9,
        'aggregate_exposure_usd':exposure/1e9,'peak_reserved_usd':peak/1e9,'live_ledger_sha256':sha(bridge.LIVE),
        'blinded_proposals':sum(len(g['proposals']) for g in public['groups']),'focused_human_items':len(queue)},indent=2))


if __name__=='__main__':main()

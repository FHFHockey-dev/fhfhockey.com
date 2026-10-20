"""Exactly one correction-check diagnostic; no extraction or automatic retry."""
import copy
import hashlib
import json
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
from adapter import bridge,p,response_view
pilot=bridge.pilot
IDENT='s10-revision-diagnostic-0'
PREFIX='s10-revision-diagnostic-'
RESERVE=231000000


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def repair_revision(envelope,body):
    original=p.digest(body); revised=copy.deepcopy(body); audits=[]
    for r in revised['revisions']:
        record=next(x for x in envelope['records'] if x['record_id']==r['to_record_id'])
        p.require({'from':r['to_record_id'],'relation':'quotes','to':r['from_record_id']} in envelope['retained_relations'],'retained lineage absent')
        e=r['evidence'];text=record['text']
        try:p.evidence_slice(text,e)
        except (ValueError,KeyError,TypeError):
            p.require(set(e)=={'start','end','text'} and type(e['start']) is int and type(e['end']) is int and 0<=e['start']<e['end'],'invalid revision evidence shape')
            p.require(isinstance(e['text'],str) and text.count(e['text'])==1,'revision quote not unique/exact')
            start=text.index(e['text']);before=copy.deepcopy(e)
            r['evidence']={'start':len(text[:start].encode('utf-16-le'))//2,'end':len(text[:start+len(e['text'])].encode('utf-16-le'))//2,'text':e['text']}
            p.evidence_slice(text,r['evidence'])
            audits.append({'kind':'unique-exact-revision-quote-v3','record_id':record['record_id'],'source_text_sha256':hashlib.sha256(text.encode()).hexdigest(),'before':before,'after':copy.deepcopy(r['evidence']),'semantic_fields_changed':False})
    p.require(p.digest(body)==original,'raw revision mutated')
    n=p.normalize_family(envelope,revised)
    p.require(not n['errors'],'repaired family still invalid')
    return revised,n,audits


def run_once(path,plan,auth,*,transport,credential_loader,output):
    live=Path(path).samefile(bridge.LIVE)
    p.require(auth.get('plan_hash')==p.digest(plan) and auth.get('maximum_calls')==1 and auth.get('cap_nano_usd')==520000000
              and auth.get('preserve_unknown_nano_usd')==254394800,'diagnostic approval scope')
    if auth.get('test_only'):
        p.require(not live and getattr(transport,'offline_fake',False),'test authority/path mismatch')
    else:
        p.require(live and auth.get('approved') is True and auth.get('owner_messages')==['Sentinel_ebb4741523d08191a5c1758e396d6513','Sentinel_310f334b9f788191b3953303dbe16e1d'],'bounded second-pass authority absent')
    for file,h in plan['runtime_pins'].items():p.require(sha(file)==h,'diagnostic pin drift')
    output=Path(output);output.mkdir(exist_ok=False)
    ledger=object.__new__(pilot.Ledger)
    ledger.db=sqlite3.connect('file:'+str(Path(path).resolve())+'?mode=rw',uri=True,timeout=2,isolation_level=None)
    ledger.db.execute('PRAGMA synchronous=FULL')
    request=plan['request'];wire=p.canonical(request).encode();sealed=pilot.SealedPayload('decisions',wire,hashlib.sha256(wire).hexdigest())
    def baseline():
        rows=ledger.db.execute('SELECT * FROM attempts WHERE id<>? ORDER BY id',(IDENT,)).fetchall()
        p.require(p.digest(rows)==plan['baseline_attempts_hash'],'diagnostic historical attempts changed')
        for table,key,order in [('experiment','baseline_experiment_hash','id'),('attempt_reconciliations','baseline_reconciliations_hash','id')]:
            p.require(p.digest(ledger.db.execute('SELECT * FROM '+table+' ORDER BY '+order).fetchall())==plan[key],'diagnostic budget/history changed')
        p.require(p.digest(ledger.db.execute('SELECT * FROM continuation_authorizations WHERE attempt_prefix<>? ORDER BY attempt_prefix',(PREFIX,)).fetchall())==plan['baseline_authorizations_hash'],'diagnostic prior authorization changed')
    def admit(endpoint,payload):
        for file,h in plan['runtime_pins'].items():p.require(sha(file)==h,'diagnostic dependency drift')
        p.require(endpoint=='decisions' and payload==request,'diagnostic exact request changed')
        return sealed
    key=None;status='not_dispatched';record=None;failure=None
    try:
        with ledger.tx():
            baseline()
            p.require(not ledger.db.execute('SELECT 1 FROM attempts WHERE id=?',(IDENT,)).fetchone(),'diagnostic already attempted; no resend')
            if ledger._exposure()+RESERVE>520000000:raise pilot.BudgetStop('diagnostic full reservation cannot fit')
            ledger.db.execute('INSERT OR IGNORE INTO continuation_authorizations VALUES(?,?,?,?)',(PREFIX,plan['baseline_ledger_sha256'],p.digest(auth),p.digest(plan)))
            p.require(ledger.db.execute('SELECT authorization_sha,manifest_sha FROM continuation_authorizations WHERE attempt_prefix=?',(PREFIX,)).fetchone()==(p.digest(auth),p.digest(plan)),'diagnostic registration changed')
            ledger.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",(IDENT,PREFIX,'decisions',wire.decode(),p.digest(request),RESERVE))
        key=credential_loader()
        with ledger.tx():
            baseline();p.require(ledger.db.execute('SELECT state FROM attempts WHERE id=?',(IDENT,)).fetchone()==('reserved',),'diagnostic state changed')
            ledger.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?",(datetime.now(timezone.utc).isoformat(),IDENT))
        started=time.monotonic()
        try:
            body,audit=transport('decisions',sealed,key,admit);body=pilot.redact_tree(body,key)
            charge=bridge.usage_cost('decisions',body)
        except Exception as exc:
            failure=exc.metadata if isinstance(exc,pilot.PilotFailure) else pilot.failure_metadata('revision_diagnostic_transport_or_usage',exc,key,opened=True)
            ledger.uncertain(IDENT,'diagnostic_unknown_spend',{'failure':failure});status='stopped_uncertain';return {'status':status,'failure':failure,'ledger':dict(ledger.snapshot(),cap_nano_usd=520000000)}
        meta=audit.get('providerMetadata',{}) if isinstance(audit,dict) else {}
        if not isinstance(meta,dict):meta={}
        try:review=p.parse_decisions(request,body)
        except (ValueError,TypeError,KeyError):review={'status':'content_invalid','probability':None}
        record=pilot.redact_tree({'request':request,'requestHash':sealed.sha256,'response':body,'latencyMs':(time.monotonic()-started)*1000,'conservativeChargeCeilingNanoUsd':charge,
            'review':review,'audit':{'headersRetained':False,'providerMetadata':pilot.provider_metadata(key,status=meta.get('httpStatus'),headers={'x-request-id':meta.get('requestId')},body=body)}},key)
        ledger.settle(IDENT,record,charge);status='completed_single_revision_diagnostic'
        with (output/'record.json').open('x') as f:json.dump(record,f,ensure_ascii=False,indent=2)
    except pilot.BudgetStop:status='stopped_budget'
    finally:
        result={'status':status,'record':record,'failure':failure,'ledger':dict(ledger.snapshot(),cap_nano_usd=520000000),'calls_maximum':1,'automatic_retries':0,'factual_quality_winner':None}
        ledger.close()
        with (output/'result.json').open('x') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    return result

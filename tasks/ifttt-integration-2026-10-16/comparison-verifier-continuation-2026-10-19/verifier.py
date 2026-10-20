"""Exactly two approved Decisions checks; no extraction or automatic resend."""
import argparse
import hashlib
import json
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
sys.path.insert(0,str(ROOT/'comparison-sequential-pilot-2026-10-19'))
import pilot
sys.path.insert(0,str(ROOT/'comparison-source-anchoring-2026-10-19'))
from evaluate import evaluate

LEDGER=ROOT/'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
BASELINE=HERE/'before/aggregate-budget.sqlite'
BASELINE_SHA='2da989c4526fdc0316af78242c9a0fc3d766607e363d88863d65aca7d3a627ce'
OUTPUT=ROOT/'comparison-verifier-execution-2026-10-19'
PREFIX='lindgren-verifier-support-'
CAP=520000000
RESERVE=231000000
BASE_IDS=('lindgren-0','lindgren-approved-retry-0','lindgren-certifi-attempt-0')
QUESTION='Approve those two checks within the existing $0.52 total cap, with no automatic retries?'
MANIFEST=HERE/'execution-manifest.json'
AUTHORIZATION=HERE/'authorization.json'
REQUESTS=[HERE/'rules-decisions-request.json',HERE/'aligned-extraction-decisions-request.json']


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def inputs():
    anchor=ROOT/'comparison-source-anchoring-2026-10-19'
    return [Path(__file__),HERE/'test_verifier.py',*REQUESTS,*pilot.execution_paths(),
            anchor/'anchors.py',anchor/'evaluate.py',anchor/'offline-four-arm-results.json',anchor/'source-manifest.json',
            ROOT/'comparison-certifi-execution-2026-10-19/run-01/attempt-0.json',
            ROOT/'comparison-certifi-execution-2026-10-19/source-fidelity-grades.json',
            HERE/'review-evidence/REVIEW.md',BASELINE]


def check_files(manifest):
    pilot.require([e['path'] for e in manifest['files']]==[str(p.resolve()) for p in inputs()],'missing continuation dependency')
    for e in manifest['files']:pilot.require(sha(Path(e['path']))==e['sha256'],'continuation dependency drift')


def prepare_inputs():
    report=evaluate()
    saved=json.loads((ROOT/'comparison-source-anchoring-2026-10-19/offline-four-arm-results.json').read_text())
    pilot.require(report==saved,'accepted alignment/grade changed')
    rows=[];requests=[]
    for arm in ('rules_only','extraction_only'):
        item=report['arms'][arm]
        pilot.require(item['alignment']['allAnchorsValid'],'source anchors invalid')
        rows.append(item['correctedQualification'])
        requests.append(pilot.decisions_request(item['alignment']['body'],pilot.PROFILE['source']))
    pilot.require([r['holds'] for r in rows[1]]==[['unresolved_time'],['single_subject_evidence_unproved']],'reviewed holds changed')
    pilot.require(all(not r['accepted'] for group in rows for r in group),'held proposal became eligible')
    return report,rows,requests


def verify():
    auth=json.loads(AUTHORIZATION.read_text());manifest=json.loads(MANIFEST.read_text())
    pilot.require(auth.get('userReply')=='yes' and auth.get('approvalQuestion')==QUESTION,'specific two-check approval absent')
    pilot.require(auth.get('checksAuthorized')==2 and auth.get('totalCapNanoUsd')==CAP,'scope/cap changed')
    pilot.require(auth.get('manifestSha256')==sha(MANIFEST),'manifest not bound to approval')
    check_files(manifest)
    pilot.require(sha(LEDGER)==BASELINE_SHA and sha(BASELINE)==BASELINE_SHA,'ledger changed; inspect any prior outcome before repeating')
    report,rows,expected=prepare_inputs()
    requests=[json.loads(p.read_text()) for p in REQUESTS]
    pilot.require(requests==expected,'sealed source/proposal/question drift')
    return {'manifest':manifest,'manifestSha256':sha(MANIFEST),'authorizationSha256':sha(AUTHORIZATION),
            'requests':requests,'rows':rows,'offlineReport':report}


class VerifierLedger(pilot.Ledger):
    def __init__(self,plan):
        pilot.require(sha(BASELINE)==BASELINE_SHA,'baseline evidence changed')
        before=sqlite3.connect('file:'+str(BASELINE.resolve())+'?mode=ro',uri=True)
        try:
            self.baseline_rows=before.execute('SELECT * FROM attempts ORDER BY id').fetchall()
            self.baseline_experiment=before.execute('SELECT * FROM experiment').fetchone()
            self.reconciliation=before.execute('SELECT * FROM attempt_reconciliations').fetchall()
        finally:before.close()
        pilot.require([r[0] for r in self.baseline_rows]==list(BASE_IDS),'unexpected baseline inventory')
        pilot.require(self.baseline_experiment[2:]==(CAP,'unknown billed outcome'),'baseline cap/block changed')
        pilot.require([(r[6],r[7]) for r in self.baseline_rows]==[('uncertain',None),('settled',0),('settled',256988)],'baseline accounting changed')
        self.db=sqlite3.connect('file:'+str(LEDGER.resolve())+'?mode=rw',uri=True,timeout=2,isolation_level=None)
        try:
            self.db.execute('PRAGMA synchronous=FULL')
            with self.tx():
                self.check_baseline()
                self.db.execute('INSERT OR IGNORE INTO continuation_authorizations VALUES(?,?,?,?)',(PREFIX,BASELINE_SHA,plan['authorizationSha256'],plan['manifestSha256']))
                pilot.require(self.db.execute('SELECT baseline_sha,authorization_sha,manifest_sha FROM continuation_authorizations WHERE attempt_prefix=?',(PREFIX,)).fetchone()==
                              (BASELINE_SHA,plan['authorizationSha256'],plan['manifestSha256']),'continuation authorization changed')
        except BaseException:
            self.db.close();raise

    def check_baseline(self):
        rows=self.db.execute('SELECT * FROM attempts WHERE id IN (?,?,?) ORDER BY id',BASE_IDS).fetchall()
        pilot.require(rows==self.baseline_rows,'prior attempt changed')
        pilot.require(self.db.execute('SELECT * FROM experiment').fetchone()==self.baseline_experiment,'cap/block changed')
        pilot.require(self.db.execute('SELECT * FROM attempt_reconciliations').fetchall()==self.reconciliation,'reconciliation history changed')

    def reserve(self,index,payload):
        pilot.require(type(index) is int and index in (0,1),'only two checks authorized')
        with self.tx():
            self.check_baseline()
            rows=self.db.execute('SELECT id,state FROM attempts WHERE id NOT IN (?,?,?) ORDER BY id',BASE_IDS).fetchall()
            pilot.require(rows==[(PREFIX+str(i),'settled') for i in range(index)],'prior check exists or unresolved; no resend')
            if self._exposure()+RESERVE>CAP:raise pilot.BudgetStop('aggregate cannot cover full next Decisions reservation')
            self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                            (PREFIX+str(index),'approved-verifier-only','decisions',pilot.canonical(payload),pilot.digest(payload),RESERVE))

    def begin(self,ident,request):
        with self.tx():
            self.check_baseline()
            pilot.require(ident in (PREFIX+'0',PREFIX+'1'),'unapproved attempt ID')
            pilot.require(not self.db.execute("SELECT 1 FROM attempts WHERE id NOT IN (?,?,?) AND state IN ('sent','uncertain')",BASE_IDS).fetchone(),'new unresolved call; no resend')
            pilot.require(self.db.execute('SELECT state,request_hash FROM attempts WHERE id=?',(ident,)).fetchone()==('reserved',pilot.digest(request)),'request changed or sent')
            self.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?",(datetime.now(timezone.utc).isoformat(),ident))

    def snapshot(self):
        value=super().snapshot();value['cap_nano_usd']=CAP
        value['originalUnknownReservationNanoUsd']=254394800
        return value


def reviewed_rows(rows,review):
    result=pilot.apply_review(rows,review)
    pilot.require(len(result)==len(rows),'verifier dropped proposals')
    for before,after in zip(rows,result):
        pilot.require(set(before['holds']).issubset(after['holds']),'verifier cleared a hold')
        pilot.require(before['accepted'] or not after['accepted'],'verifier promoted held claim')
        pilot.require(before['claim']==after['claim'],'verifier changed a claim')
    return result


def response_metadata(body,audit,key):
    value=audit.get('providerMetadata',{}) if isinstance(audit,dict) else {}
    if not isinstance(value,dict):value={}
    return pilot.provider_metadata(key,status=value.get('httpStatus'),headers={'x-request-id':value.get('requestId')},body=body)


def run(plan,transport=pilot.post_once,key_loader=pilot.load_key):
    directory=OUTPUT/'run-01';directory.mkdir(parents=True,exist_ok=False)
    ledger=VerifierLedger(plan);key=None;reviews=[];records=[];failure=None;stage='reserve';body=audit=None
    try:
        for i in range(2):
            check_files(plan['manifest'])
            sealed=pilot.seal_payload('decisions',plan['requests'][i]);request=sealed.as_dict()
            stage='reserve';ledger.reserve(i,request)
            if key is None:key=key_loader()
            ident=PREFIX+str(i);ledger.begin(ident,request);start=time.monotonic();body=audit=None;stage='transport'
            try:
                body,audit=transport('decisions',sealed,key)
                stage='usage_validation';body=pilot.redact_tree(body,key);audit=pilot.redact_tree(audit,key)
                charge=pilot.usage_cost('decisions',body,1050000,0)
            except Exception as exc:
                failure=exc.metadata if isinstance(exc,pilot.PilotFailure) else pilot.failure_metadata(stage,exc,key,opened=True,provider=response_metadata(body,audit,key))
                ledger.uncertain(ident,'PilotFailure',{'requestHash':sealed.sha256,'failure':failure})
                raise pilot.PilotFailure(failure) from None
            record=pilot.redact_tree({'arm':('rules_decisions','extraction_decisions')[i],'request':request,'requestHash':sealed.sha256,
                'manifestSha256':plan['manifestSha256'],'response':body,'audit':audit,'latencyMs':round((time.monotonic()-start)*1000),'conservativeChargeCeilingNanoUsd':charge},key)
            ledger.settle(ident,record,charge);records.append(record)
            (directory/f'check-{i}.json').write_text(json.dumps(record,indent=2))
            stage='answer_validation';reviews.append(pilot.parse_decisions(request,body))
        original=plan['offlineReport'];source=pilot.PROFILE['source'];labels=pilot.PROFILE['labels']
        rows=[plan['rows'][0],reviewed_rows(plan['rows'][0],reviews[0]),plan['rows'][1],reviewed_rows(plan['rows'][1],reviews[1])]
        names=('rules_only','rules_decisions','extraction_only','extraction_decisions')
        result={'status':'two_authentic_decisions_checks_completed','verdict':'inconclusive_single_exposed_development_family','nativeEligible':False,
                'manifestSha256':plan['manifestSha256'],'reviews':reviews,'calls':records,
                'arms':{name:{'grade':pilot.grade(source,labels,rows[i],original['arms']['rules_only' if i<2 else 'extraction_only']['alignment']['normalization']['material']),'rows':rows[i],
                             'producer':'rules' if i<2 else 'retained_luna_plus_explicit_unique_quote_alignment'} for i,name in enumerate(names)},
                'originalRawModelGrade':original['arms']['extraction_only']['originalGrade'],
                'labelProvenance':labels['provenance'],'canonicalIds':'retained, unverified, excluded by support question; no identity proof',
                'ledger':ledger.snapshot()}
        (directory/'report.json').write_text(json.dumps(result,indent=2));return result
    except Exception as exc:
        if failure is None and key is not None and stage=='answer_validation':failure=pilot.failure_metadata(stage,exc,key,opened=True,provider=response_metadata(body,audit,key))
        result={'status':'stopped_budget' if isinstance(exc,pilot.BudgetStop) else 'stopped_partial_comparison','verdict':'inconclusive','failure':failure,
                'completedReviews':reviews,'knownRecords':records,'goldClaimsInDenominator':2,'familyMustNotBeExcluded':True,'ledger':ledger.snapshot()}
        (directory/'stopped-partial-comparison.json').write_text(json.dumps(result,indent=2));return result
    finally:
        (directory/'final-ledger.json').write_text(json.dumps(ledger.snapshot(),indent=2));ledger.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute:print(json.dumps({'status':'paused','keyRead':False,'providerCalls':0}))
    else:
        result=run(verify());print(json.dumps({'status':result['status'],'verdict':result['verdict'],'aggregateExposureNanoUsd':result['ledger']['exposure_nano_usd']}))

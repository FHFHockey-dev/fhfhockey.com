"""One retained-family pilot. Offline preparation by default; no SDK/retries.

Execute requires a separately reviewed parent clearance/cost-proof file. No such
file is shipped. A byte length, caller assertion or usual token count is not a
billing proof; parent must verify its documentary evidence before approval.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, math, re, ssl, subprocess, sys, time
from fractions import Fraction
from pathlib import Path
from urllib import request, error

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
BASE=HERE.parent/'comparison-preflight-2026-10-19'
POLICY=HERE.parent/'comparison-pilot-rules-2026-10-19'
sys.path.insert(0,str(BASE))
from comparison import (CAP, Ledger, canonical, ceiling, digest, integer, normalize,
                        qualify, apply_decisions, grade, request_input, statement)

MODEL='gpt-6-luna'
STATE=HERE/'experiment-state'
PROFILE=json.loads((POLICY/'pilot-rules.json').read_text())
TEMPLATE=json.loads((POLICY/'pilot-decisions-template.json').read_text())
EXTRACTION=json.loads((POLICY/'pilot-extraction-request.json').read_text())


def require(condition, message):
    if not condition: raise ValueError(message)


def json_strict(text):
    def pairs(items):
        d={}
        for k,v in items:
            require(k not in d,'duplicate JSON key')
            d[k]=v
        return d
    def bad(_):raise ValueError('nonfinite JSON number')
    return json.loads(text,object_pairs_hook=pairs,parse_constant=bad)


def decisions_request(proposals):
    normalized=normalize(PROFILE['source'],proposals)
    require(not normalized['errors'],'invalid producer output; never dispatch rejected proposals')
    claims=normalized['claims'];questions=[]
    for template in TEMPLATE['questions']:
        if 'repeat' not in template:
            questions.append(copy.deepcopy(template));continue
        for i,_ in enumerate(claims):
            q={k:copy.deepcopy(v) for k,v in template.items() if k!='repeat'}
            q['name']=q['name'].replace('_i_',f'_{i}_')
            q['instructions']=f'Evaluate only proposals[{i}]; other proposals are not evidence. '+q['instructions'].replace('proposal i',f'proposal {i}')
            questions.append(q)
    source=request_input(PROFILE['source'])
    evidence={'source':source,'proposals':[{'claim':c,'statement':statement(c)} for c in claims]}
    return {'model':MODEL,'input':canonical(evidence),'questions':questions}


def probability(v):
    return type(v) in (int,float) and math.isfinite(v) and 0<=v<=1


def parse_decisions(expected, body):
    require(body.get('model')==MODEL,'unexpected model')
    answers=body.get('answers');qs=expected['questions']
    require(isinstance(answers,list) and len(answers)==len(qs),'answer cardinality mismatch')
    require([a.get('name') for a in answers if isinstance(a,dict)]==[q['name'] for q in qs],'answer order/name binding mismatch')
    scored={};unknown=[]
    for q,a in zip(qs,answers):
        if a.get('type')=='refusal':unknown.append(q['name']);continue
        require(a.get('type')==q['type'],'answer type mismatch')
        if q['type']=='predicate':require(probability(a.get('probability')),'invalid predicate');continue
        choices=[c['value'] for c in q['choices']];ps=a.get('probabilities')
        require(isinstance(a.get('choice'),str) and a['choice'] in choices and probability(a.get('confidence')),'invalid choice/confidence')
        require(isinstance(ps,list) and len(ps)==len(choices),'distribution cardinality')
        require(all(isinstance(p,dict) and isinstance(p.get('value'),str) and p['value'] in choices and probability(p.get('probability')) for p in ps),'invalid distribution')
        require(len({p['value'] for p in ps})==len(choices) and abs(sum(p['probability'] for p in ps)-1)<.001,'incomplete distribution')
        scored[q['name']]=a
    claims=json_strict(expected['input'])['proposals'];result={}
    for i,entry in enumerate(claims):
        s=scored.get(f'proposal_{i}_support');w=scored.get(f'proposal_{i}_wording')
        if s and w:result[entry['claim']['id']]={'supported':s['choice']=='supported','confidence':s['confidence'],'wording':w['choice']}
    return result,unknown


def parse_extraction(body):
    require(body.get('model')==MODEL and body.get('status')=='completed','unexpected/incomplete extraction')
    messages=[x for x in body.get('output',[]) if x.get('type')=='message']
    require(len(messages)==1 and messages[0].get('role')=='assistant','unexpected response messages')
    require(all(x.get('type') in ('message','reasoning') for x in body['output']),'unexpected tool output')
    contents=messages[0].get('content',[])
    require(len(contents)==1 and contents[0].get('type')=='output_text','refused or non-text extraction')
    result=json_strict(contents[0]['text']);n=normalize(PROFILE['source'],result)
    require(not n['errors'],'invalid extraction schema/source/span')
    return result


def price(endpoint, inputs, outputs=0):
    require(endpoint in ('responses','decisions'),'unapproved billing endpoint')
    integer(inputs);integer(outputs)
    long=inputs>272000
    if endpoint=='decisions':
        require(outputs==0,'Decisions output billing unexpected')
        dollars=inputs*Fraction('.20' if long else '.10')/1_000_000
    else:
        dollars=(inputs*Fraction('.25' if long else '.125')+outputs*Fraction('.75' if long else '.50'))/1_000_000
    return ceiling(dollars*Fraction('1.10')*1_000_000_000)


def usage_cost(endpoint, body, maximum_input, maximum_output):
    require(body.get('model')==MODEL,'unknown billed model')
    u=body.get('usage');require(isinstance(u,dict),'unknown billed usage')
    n=integer(u.get('input_tokens'));o=integer(u.get('output_tokens'));total=integer(u.get('total_tokens'))
    require(total==n+o and n<=maximum_input and o<=maximum_output,'usage total/bound violation')
    d=u.get('input_tokens_details');od=u.get('output_tokens_details')
    require(isinstance(d,dict) and isinstance(od,dict),'missing usage details')
    cached=integer(d.get('cached_tokens'));written=integer(d.get('cache_write_tokens'));reasoning=integer(od.get('reasoning_tokens'))
    require(cached+written<=n and reasoning<=o,'inconsistent usage details')
    if endpoint=='decisions':
        require(o==0 and cached==0 and written==0 and reasoning==0,'unexpected Decisions usage categories')
        return price(endpoint,n)
    # Fully itemized counts, exact published token rates; reserve regional uplift
    # even if actual account is global. This is a charge ceiling, not a final bill.
    long=n>272000
    ordinary=Fraction('.20' if long else '.10');read=Fraction('.02' if long else '.01')
    write=Fraction('.25' if long else '.125');output=Fraction('.75' if long else '.50')
    return ceiling(((n-cached-written)*ordinary+cached*read+written*write+o*output)/1_000_000*Fraction('1.10')*1_000_000_000)


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


def post_once(endpoint, payload, key):
    require(endpoint in ('responses','decisions'),'unapproved endpoint')
    # Fixed HTTPS destination, verified TLS, no env proxy/base-URL, redirects,
    # SDK retries, fallback hosts, debug logs or auth-header persistence.
    opener=request.build_opener(request.ProxyHandler({}),request.HTTPSHandler(context=ssl.create_default_context()),NoRedirect())
    req=request.Request('https://api.openai.com/v1/'+endpoint,data=canonical(payload).encode(),method='POST',
                        headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    try:
        with opener.open(req,timeout=20) as response:
            raw=response.read(1_048_577)
            require(len(raw)<=1_048_576,'reply overflow; unknown billed result')
            # A server error must never cause the supplied secret to be retained.
            redacted=raw.decode('utf-8').replace(key,'[REDACTED]')
            return json_strict(redacted),{'requestId':response.headers.get('x-request-id'),'rawRedactedReply':redacted}
    except Exception as exc:
        # Do not expose request/header/error representations (or echo bodies).
        raise RuntimeError('transport_or_reply_'+type(exc).__name__) from None


def load_key():
    path=REPO/'web/.env.local'
    require(subprocess.run(['git','check-ignore','-q','--','web/.env.local'],cwd=REPO).returncode==0,'key file not ignored')
    require(subprocess.run(['git','ls-files','--error-unmatch','--','web/.env.local'],cwd=REPO,capture_output=True).returncode!=0,'key file tracked')
    values=[]
    for line in path.read_text().splitlines():
        m=re.match(r'^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$',line)
        if m:values.append(m[1].strip().strip('\"\''))
    require(len(values)==1 and bool(values[0]) and '\n' not in values[0] and '\r' not in values[0],'key unavailable or invalid')
    return values[0]


def validate_clearance(c):
    require(c.get('authority')=='parent-final-clearance' and c.get('approved') is True,'parent clearance absent')
    require(c.get('policy_sha256')==hashlib.sha256((POLICY/'pilot-rules.json').read_bytes()).hexdigest(),'policy changed')
    require(c.get('binding_sha256')==hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'binding code changed')
    require(c.get('billing_documentation_verified') is True and c.get('all_fees_within_110_percent') is True,'unproved billing contract')
    require(isinstance(c.get('complete_input_bound_evidence'),str) and c['complete_input_bound_evidence'].startswith('https://'),'documentary input bound missing')
    x=integer(c.get('responses_input_max'),1);d=integer(c.get('decisions_input_max'),1)
    require(x<=922000 and d<=922000,'unverified model bound')
    reserves=[price('responses',x,1024),price('decisions',d),price('decisions',d)]
    require(sum(reserves)<=CAP,'whole paired bundle exceeds $0.26 before dispatch')
    return x,d,reserves


def run(clearance, rules_body, directory, transport=post_once, key_loader=load_key):
    xcap,dcap,reserves=validate_clearance(clearance)
    rules=normalize(PROFILE['source'],rules_body);require(not rules['errors'],'invalid rules output')
    rd=decisions_request(rules_body);directory.mkdir(exist_ok=False,parents=True)
    # Fixed state across output directories/restarts; an output path cannot reset
    # the user's single aggregate experiment budget or allocate a retry bundle.
    STATE.mkdir(exist_ok=True)
    ledger=Ledger(STATE/'budget.sqlite','approved-ifttt-comparison-USD0.26')
    bodies=[EXTRACTION,rd,None];endpoints=['responses','decisions','decisions']
    attempts=[{'id':f'lindgren-{i}','endpoint':endpoints[i],'request':bodies[i],'reserve':reserves[i]} for i in range(3)]
    try:
        ledger.reserve_bundle('lindgren-only',attempts)
        key=key_loader()  # Only after clearance, cost proof and durable reservation.
        parsed=[]
        for i in range(3):
            if i==2:
                bodies[i]=decisions_request(parsed[0]);ledger.bind(attempts[i]['id'],bodies[i])
            ident=attempts[i]['id'];ledger.begin(ident,bodies[i]);started=time.monotonic()
            body,audit=None,None
            try:
                body,audit=transport(endpoints[i],bodies[i],key)
                charge=usage_cost(endpoints[i],body,xcap if i==0 else dcap,1024 if i==0 else 0)
            except Exception as exc:
                ledger.uncertain(ident,type(exc).__name__,{'request':bodies[i],'response':body,'audit':audit})
                raise RuntimeError('stopped: unknown billed outcome; reservation retained') from None
            record={'request':bodies[i],'requestHash':digest(bodies[i]),'response':body,'audit':audit,
                    'latencyMs':round((time.monotonic()-started)*1000),'observedChargeUpperNanoUsd':charge}
            ledger.settle(ident,record,charge)
            with (directory/f'attempt-{i}.json').open('x') as f:json.dump(record,f,indent=2)
            # A known billed malformed/refused result stops without another call.
            parsed.append(parse_extraction(body) if i==0 else parse_decisions(bodies[i],body)[0])
        xr=normalize(PROFILE['source'],parsed[0]);rq=qualify(PROFILE['source'],rules);xq=qualify(PROFILE['source'],xr)
        rows=[rq,apply_decisions(rq,parsed[1]),xq,apply_decisions(xq,parsed[2])]
        result={'status':'provisional_development_only','nativeEligible':False,'verdict':'inconclusive_single_exposed_family',
                'chargeAccounting':'published usage-based conservative charge ceilings, not final account bill',
                'arms':{a:grade(PROFILE['source'],PROFILE['labels'],r,(rules if i<2 else xr)['material']) for i,(a,r) in enumerate(zip(PROFILE['arms'],rows))},'ledger':ledger.snapshot()}
        with (directory/'report.json').open('x') as f:json.dump(result,f,indent=2)
        return result
    except Exception as exc:
        with (directory/'stopped-partial-pair.json').open('x') as f:
            json.dump({'status':'stopped_partial_pair','errorType':type(exc).__name__,
                       'family':PROFILE['source']['family_id'],'goldClaimsInDenominator':len(PROFILE['labels']['claims']),
                       'familyMustNotBeExcluded':True,'verdict':'inconclusive','ledger':ledger.snapshot()},f,indent=2)
        raise
    finally:
        with (directory/'final-ledger.json').open('x') as f:json.dump(ledger.snapshot(),f,indent=2)
        ledger.close()


def main():
    p=argparse.ArgumentParser();p.add_argument('--clearance',type=Path);p.add_argument('--rules-output',type=Path);p.add_argument('--output',type=Path)
    a=p.parse_args()
    if not a.clearance:
        print(canonical({'status':'paid_paused','providerKeyLocation':'web/.env.local','keyRead':False,
                         'remaining':'reviewed complete billing bound and live binding, then parent final clearance','paidCalls':0}));return
    require(a.rules_output and a.output,'rules output and new output directory required')
    result=run(json.loads(a.clearance.read_text()),json.loads(a.rules_output.read_text()),a.output)
    print(canonical({'status':result['status'],'verdict':result['verdict']}))


if __name__=='__main__':main()

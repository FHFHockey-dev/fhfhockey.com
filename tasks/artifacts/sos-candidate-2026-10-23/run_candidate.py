#!/usr/bin/env python3
"""Local JSON CLI. No network; imports only the pure candidate and synthetic fixtures."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from sos_candidate import calculate, colley
from record_core import Game
from test_sos_candidate import balanced, confounded, fixture, METRICS


def brief(result):
    return {t: {k: row[k] for k in ('state','fixture_count','direct_sos','rpi_sos','colley_sos',
                                  'direct_sos_rank','rpi_sos_rank','colley_sos_rank')}
            for t,row in result['teams'].items()}


def demo():
    p=balanced(); p['schedule']['fixtures']=[fixture('fAC','A','C'),fixture('fBD','B','D'),fixture('fEF','E','F')]
    a=calculate(p); changed=copy.deepcopy(p); changed['history']['results'][0]['outcome']='away_reg'
    b=calculate(changed)
    stability={m: {'max_absolute_score_change':max(abs(a['teams'][t][m]-b['teams'][t][m]) for t in p['teams']),
                  'max_rank_change':max(abs(a['teams'][t][m+'_rank']-b['teams'][t][m+'_rank']) for t in p['teams']),
                  'before':{t:a['teams'][t][m+'_rank'] for t in p['teams']},
                  'after':{t:b['teams'][t][m+'_rank'] for t in p['teams']}} for m in METRICS}
    unbalanced=calculate(confounded())
    chain=[Game(f'{h}{a}{i}',h,a,'home_reg') for h,a in [('A','B'),('B','C'),('C','D')] for i in range(100)]
    sensitivity={}
    for kappa in ('0','2','8','16'):
        q=confounded(); q['config']['kappa']=kappa
        sensitivity[kappa]=brief(calculate(q))
    return {'version':'sos-synthetic-characterization-v1','data':'invented fixtures only; no NHL validation',
            'balanced':brief(calculate(balanced())),
            'confounding':{'own_record':{t:row['own_record']['value'] for t,row in unbalanced['teams'].items()},
                           'colley_team_quality':unbalanced['quality_colley']['ratings'],
                           'future_sos':brief(unbalanced)},
            'single_result_perturbation':stability,
            'colley_unbounded_chain':colley('ABCD',chain),
            'prior_sensitivity':sensitivity,
            'limits':['No model selected','No calibrated probability/interval','No fantasy utility evidence',
                      'Rank movement at ties is not statistical significance','No production I/O']}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    source=parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--input',type=Path,help='Read a local snapshot JSON matching CONTRACT.md')
    source.add_argument('--demo',action='store_true',help='Emit reproducible synthetic characterization')
    parser.add_argument('--output',type=Path,help='Write JSON locally; otherwise stdout')
    args=parser.parse_args()
    if args.demo:
        out=demo()
    else:
        raw=args.input.read_bytes()
        out={'input_sha256':hashlib.sha256(raw).hexdigest(),'result':calculate(json.loads(raw))}
    body=json.dumps(out,indent=2,sort_keys=True,allow_nan=False)+'\n'
    if args.output: args.output.write_text(body)
    else: print(body,end='')

if __name__=='__main__': main()

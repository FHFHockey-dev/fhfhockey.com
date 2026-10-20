import { afterAll, describe, expect, it, vi } from '../../../web/node_modules/vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rules, type Source } from '../comparison-preflight-2026-10-19/rules-adapter';

const path=(name:string)=>fileURLToPath(new URL(name,import.meta.url));
type Envelope={group_id:string; records:Array<{record_id:string;original_id:string;text:string;author:string;url:string;published_at:string;received_at:string|null;identity_hints:Array<{fullName:string;lastName:string;position:string|null}>}>};
const inputs=JSON.parse(readFileSync(path('./prepared/inputs.json'),'utf8')) as Record<string,Envelope>;
// Network denial is an assertion boundary, not a dry-run flag on a live client.
vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('offline preflight: fetch forbidden');}));
const outputs:Record<string,unknown>={};
const timings:Record<string,unknown>={};
describe('unchanged actual repository rules under equal retained context',()=>{
  for(const [key,envelope] of Object.entries(inputs)) it(`preserves every complete record and source anchor in ${key}`,()=>{
    const start=performance.now();
    const records=envelope.records.map(r=>{
      const source:Source={source_id:`x:${r.original_id}`,text:r.text,author:r.author,url:r.url,published_at:r.published_at,
        received_at:r.received_at??'',attribution_status:'retained_only',
        players:r.identity_hints.map((p,i)=>({playerId:i+1,fullName:p.fullName,lastName:p.lastName,position:p.position,teamId:null}))};
      const result=rules(source);
      expect(result.overflow).toBe(false);
      for(const c of result.claims){expect(source.text.slice(c.evidence.start,c.evidence.end)).toBe(c.evidence.text);expect(c.player_id).toBeNull();}
      return {record_id:r.record_id,...result};
    });
    outputs[key]={records,revisions:[]};
    timings[key]={local_parser_ms:performance.now()-start,provider_calls:0,kind:'observed local pure parser; no HTTP latency'};
    expect(records).toHaveLength(envelope.records.length);
  });
  it('retains the full 19-player lineup context without a 16-row grading cap',()=>{
    expect(inputs.S08.records[0]!.identity_hints).toHaveLength(19);
    const body=outputs.S08 as {records:Array<{claims:Array<{player:string}>}>};
    expect(body.records[0]!.claims.length).toBeGreaterThan(16);
  });
  it('retains both separate reports and both quoted-thread documents',()=>{
    expect((outputs.S05 as {records:unknown[]}).records).toHaveLength(2);
    expect((outputs.S10 as {records:unknown[]}).records).toHaveLength(2);
  });
  it('does not invent roster hints for records lacking retained context',()=>{
    expect(inputs.S01.records[0]!.identity_hints).toEqual([]);
    expect(inputs.S09.records[0]!.identity_hints).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  afterAll(()=>{const out=process.env.IFTTT_OFFLINE_RULES_OUTPUT;if(!out)throw new Error('create-only output path required');writeFileSync(out,JSON.stringify(outputs,null,2),{flag:'wx'});writeFileSync(out+'.timings.json',JSON.stringify(timings,null,2),{flag:'wx'});vi.unstubAllGlobals();});
});

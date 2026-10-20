import { describe,it,expect } from '../../../web/node_modules/vitest';
import { readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rules,decisionsRequest,statement,type Source } from './rules-adapter';

const path=(name:string)=>fileURLToPath(new URL(name,import.meta.url));
const fixtures=JSON.parse(readFileSync(path('./fixtures.json'),'utf8')).fixtures as Array<{source:Source}>;
describe('actual repository extraction projected without network or native effects',()=>{
  for(const {source} of fixtures) it(`retains valid evidence for ${source.source_id}`,()=>{
    const result=rules(source);
    for(const claim of result.claims){
      expect(source.text.slice(claim.evidence.start,claim.evidence.end)).toBe(claim.evidence.text);
      expect(claim.source_id).toBe(source.source_id);
      expect(claim.player_id).toBeNull();
      expect(claim.source_author).toBe(source.author);
    }
    expect(JSON.stringify(result)).not.toContain('gold-');
  });
  it('uses actual rule extraction for an explicit out claim',()=>{
    expect(rules(fixtures[1].source).claims.some(c=>c.player==='Arden Vale'&&c.value==='out')).toBe(true);
  });
  it('keeps missing publication clocks held instead of borrowing receipt time',()=>{
    expect(decisionsRequest(fixtures[5].source,[])).toEqual({status:'held',reason:'original_metadata_unresolved'});
  });
  it('holds unresolved original relay attribution',()=>{
    expect(decisionsRequest(fixtures[10].source,[]).status).toBe('held');
  });
  it('preserves source-only relevance when no canonical identity is bound',()=>{
    const raw=rules(fixtures[1].source);
    const plan=decisionsRequest(fixtures[1].source,raw.claims);
    expect(plan.status).toBe('prepared');
    if(plan.status==='prepared'){
      expect(plan.request.questions).toHaveLength(1);
      expect(plan.heldClaimIds).toHaveLength(raw.claims.length);
    }
  });
  it('serializes every declared field without converting a conditional to asserted',()=>{
    const claim={...rules(fixtures[1].source).claims[0],certainty:'conditional',condition:'if unavailable'};
    const parsed=JSON.parse(statement(claim).split('proposition: ')[1]);
    expect(parsed.certainty).toBe('conditional');expect(parsed.condition).toBe('if unavailable');
    expect(parsed.player).toBe(claim.player);expect(parsed.source_id).toBe(claim.source_id);
  });
  it('exports actual baseline outputs into a new evidence file',()=>{
    const output=process.env.IFTTT_COMPARISON_RULES_OUTPUT;
    expect(output).toBeTruthy();
    writeFileSync(output!,JSON.stringify(Object.fromEntries(fixtures.map(f=>[f.source.source_id,rules(f.source)])),null,2),{flag:'wx'});
  });
});

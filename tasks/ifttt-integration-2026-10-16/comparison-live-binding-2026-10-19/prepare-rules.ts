import {readFileSync,writeFileSync} from 'node:fs';
import {rules,type Source} from '../comparison-preflight-2026-10-19/rules-adapter';
const profile=JSON.parse(readFileSync(new URL('../comparison-pilot-rules-2026-10-19/pilot-rules.json',import.meta.url),'utf8'));
const output=process.env.IFTTT_PILOT_RULES_OUTPUT;
if(!output) throw new Error('New IFTTT_PILOT_RULES_OUTPUT path required');
writeFileSync(output,JSON.stringify(rules(profile.source as Source),null,2),{flag:'wx'});

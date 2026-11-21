import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PostgrestClient } from '@supabase/postgrest-js';
import { fetchRollingRows, fetchSkaterRecencyEvents, ROLLING_ROW_SELECT_CLAUSE } from 'lib/projections/queries/skater-queries';
import { installProjectionReadOnlyProbe } from 'lib/projections/queryCaptureHook';
import { readAlignedCountSupport } from 'lib/rollingPlayerCountSupport';
import readline from 'node:readline';

async function main() {
  if (process.argv[2] === 'aligned') {
    let present = 0;
    const bad = [];
    for await (const line of readline.createInterface({input:process.stdin})) {
      const [playerId,gameDate,gameId,seasonId,strengthState,value] = JSON.parse(line);
      present++;
      if (!readAlignedCountSupport(value,{playerId,strengthState,anchor:{gameDate,gameId,seasonId}}))
        bad.push({playerId,gameDate,gameId,seasonId,strengthState});
    }
    console.log(JSON.stringify({present, bad}));
    return;
  }
  const [endpoint,scopes,receipt] = process.argv.slice(2);
  const url = new URL(endpoint);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw Error('local PostgREST required');
  let requests = 0;
  const db = new PostgrestClient(url.origin, {fetch:async (input, init) => {
    if (new URL(String(input)).origin !== url.origin || init?.method !== 'GET') throw Error('local GET required');
    requests++;
    return fetch(input,init);
  }});
  const results = [];
  for (const s of JSON.parse(fs.readFileSync(scopes,'utf8'))) {
    for (const path of ['rpc','window']) {
      installProjectionReadOnlyProbe(() => path === 'window');
      const start=requests;
      try {
        const rows = await fetchRollingRows(s.ids,s.strength,s.cutoff,db as any,{lookbackDays:s.days});
        const latest = new Map();
        for (const row of rows) if (!latest.has(row.player_id)) latest.set(row.player_id,row);
        const picked=Array.from(latest.values()).sort((a,b)=>a.player_id-b.player_id);
        const events = await fetchSkaterRecencyEvents(picked,db as any);
        const identity=picked.map(r=>[r.player_id,r.game_date,r.game_id,r.season,events.has(r.player_id)]);
        const digest=createHash('sha256').update(JSON.stringify(picked.map(r=>[...ROLLING_ROW_SELECT_CLAUSE.split(',').map(k=>r[k]),r.aligned_count_support??null]))).digest('hex');
        results.push({name:s.name,path,rows:rows.length,latest:picked.length,events:events.size,digest,identity:s.sample?identity:undefined,requests:requests-start});
      } catch (e:any) { results.push({name:s.name,path,reason:e.reason??e.message,requests:requests-start}); }
    }
  }
  fs.writeFileSync(receipt,JSON.stringify({fields:ROLLING_ROW_SELECT_CLAUSE.split(','),requests,results})+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

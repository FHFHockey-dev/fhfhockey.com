const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const directory = '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/0ab9b1ac-962e-4536-a8bc-32510240d760/scratchpad/recon/out/b';
const files = fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort();
const file = path.join(directory,files[0]);
const captured = JSON.parse(fs.readFileSync(file,'utf8'));
for(const [name,value] of Object.entries(captured.payload.modelEnvironment)) { if(value===null) delete process.env[name]; else process.env[name]=value; }
process.env.STARTER_BOARD_CAPTURE_ENABLED='true';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://offline.supabase.invalid';
process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY='offline-synthetic-public-key';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline-synthetic-service-key';
const {replayForgeSnapshot} = require(root+'/lib/projections/run-forge-projections');
const {installOfflineFence} = require(root+'/scripts/qualify-native-players-offline');
const fence=installOfflineFence();
(async()=>{
 let result;
 try { result={status:'completed',result:await replayForgeSnapshot(captured.payload,captured.payload_hash)}; }
 catch(error){result={status:'blocked',error:error.message,cause:error.cause?.message};}
 finally{fence.restore();}
 result={...result,capture:file,retainedCaptures:files.length,capturedAt:captured.payload.capturedAt,networkOrProcessAttempts:fence.attempts,
 limitations:['This is a current-code replay attempt against retained R18 inputs, not a post-R19 c reconstruction.','No live data was fetched; snapshots were not modified.']};
 fs.writeFileSync(path.join(root,'../tasks/artifacts/forge-task2-2026-10-22/CURRENT-REPLAY.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result));
})();

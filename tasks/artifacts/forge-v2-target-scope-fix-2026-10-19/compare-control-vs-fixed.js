const fs=require('fs');const [c,n]=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p+'/outputs/pending-plan.json')));
const src=p=>p.rows.filter(r=>r.entity_kind==='seasonal_rate_bundle').flatMap(r=>r.payload.sources.map(s=>JSON.stringify([r.payload.manifest?.policyVersion,s.playerId,s.nhlPlayerId,s.teamId,s.rosterRevision,s.targetKey??s.target,s.mean,s.cutoffAt,s.expiresAt])));
const part=p=>p.rows.filter(r=>r.entity_kind==='participation_bundle').flatMap(r=>r.payload.entries.map(e=>JSON.stringify([e.input.scope,e.receipt.probability,e.receipt.reasons])));
const nine=new Set([8769,9392,9806,9936,10134,10590,10637,9682,10622]);
const cs=src(c),ns=new Set(src(n));const keptControl=cs.filter(x=>!nine.has(JSON.parse(x)[1]));
console.log('control sources',cs.length,'control minus 9',keptControl.length,'fixed',ns.size,'equal',keptControl.length===ns.size&&keptControl.every(x=>ns.has(x)));
const cp=part(c).sort(),np=part(n).sort();console.log('participation entries',cp.length,np.length,'equal',JSON.stringify(cp)===JSON.stringify(np));
const kinds=p=>p.rows.reduce((a,r)=>(a[r.entity_kind]=(a[r.entity_kind]||0)+1,a),{});console.log(kinds(c),kinds(n));

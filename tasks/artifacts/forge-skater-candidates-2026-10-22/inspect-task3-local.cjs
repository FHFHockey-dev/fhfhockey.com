// Local metadata-only inspection. No environment, database, network or subprocess calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const retained = '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/0ab9b1ac-962e-4536-a8bc-32510240d760/scratchpad/recon/out';
const audit = '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/36e743be-fccb-484b-8982-5ef9e7a9ba43/scratchpad/fp-audit/rows.json';
const required = ['nst_gamelog_es_counts','nst_gamelog_es_counts_oi','nst_gamelog_pp_counts','nst_gamelog_pp_counts_oi'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function keysOf(value, keys = new Set()) {
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (/ipp|on_ice.*(goals|gf)/i.test(key)) keys.add(key);
    keysOf(child, keys);
  }
  return [...keys].sort();
}
const groups = ['a','b','a0','b0','c'].map(variant => {
  const dir = path.join(retained,variant);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => /^\d{4}-\d{2}-\d{2}-\d+\.json$/.test(name)).sort() : [];
  const rawReads = Object.fromEntries(required.map(table => [table,0]));
  const summaryKeys = new Set(), capturedDates = new Set();
  const captures = files.map(name => {
    const file = path.join(dir,name), bytes = fs.readFileSync(file), data = JSON.parse(bytes);
    capturedDates.add(data.payload.capturedAt.slice(0,10));
    for (const read of data.payload.reads) {
      const first = read.request[0];
      if (first.method !== 'from') continue;
      const table = first.args[0];
      if (required.includes(table)) rawReads[table]++;
      if (/rolling_player/.test(table)) keysOf(read.result.data).forEach(key => summaryKeys.add(key));
    }
    return {path:file,sha256:sha(bytes)};
  });
  return {variant,captures,captureCount:captures.length,capturedDates:[...capturedDates].sort(),rawReads,rollingSummaryKeys:[...summaryKeys].sort()};
});
const auditBytes=fs.readFileSync(audit), auditRows=JSON.parse(auditBytes);
const syntheticPath=path.join(root,'web/scripts/fixtures/native-player-offline-synthetic.json');
const syntheticBytes=fs.readFileSync(syntheticPath), synthetic=JSON.parse(syntheticBytes);
const result = {
  purpose:'Exact local task3 source search; metadata only, no observed data invented.',
  groups,
  audit:{path:audit,sha256:sha(auditBytes),rows:auditRows.length,keys:Object.keys(auditRows[0]),classification:'historical_reconstruction_not_training_frames'},
  nativeFixture:{path:syntheticPath,sha256:sha(syntheticBytes),classification:synthetic.classification,
    requiredTableRows:Object.fromEntries(required.map(table=>[table,synthetic.tables[table]?.rows?.length??0]))},
  outcome:'No raw aligned individual+on-ice count pairs in retained real captures. Synthetic fixtures cannot fit empirical priors. Cumulative rolling summaries cannot recover independent split halves or value availability.',
};
const output=path.join(__dirname,'task3-local-search.json');
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({captures:groups.map(({variant,captureCount,rawReads,rollingSummaryKeys})=>({variant,captureCount,rawReads,rollingSummaryKeys})),auditRows:auditRows.length,nativeClassification:synthetic.classification}));

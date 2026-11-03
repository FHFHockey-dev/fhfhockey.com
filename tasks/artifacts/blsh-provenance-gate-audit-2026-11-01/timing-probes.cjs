const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture,AT}=require('./compiled/syntheticFixture.js');
const {createCurrentProcessEvidenceGate}=require('./compiled/currentProcessEvidence.server.js');
const records=[];
const probes=[
 {name:'native receipt 1us after evaluation',change:s=>{s.receipts.individual.retrievedAtUTC='2026-11-01T20:00:00.000001Z';},at:AT,expected:'individual withheld'},
 {name:'official frame 1us after evaluation',change:s=>{s.frame.observedAtUTC='2026-11-01T20:00:00.000001Z';},at:AT,expected:'both groups withheld'},
 {name:'receipt 1us before completion',change:s=>{s.frame.completedByUTC='2026-11-01T19:10:00.000001Z';},at:AT,expected:'both groups withheld'},
 {name:'evaluation 1us before source request',change:s=>{s.request.asOfUTC='2026-11-01T20:00:00.000001Z';},at:AT,expected:'evaluation rejected'},
 {name:'source capture 1us after evaluation',change:s=>{s.request.individual.capture.retrievedAtUTC='2026-11-01T20:00:00.000001Z';},at:AT,expected:'individual withheld'},
 {name:'capture age 1us over one-hour policy',change:s=>{s.request.freshnessPolicy.maxCaptureAgeHours=1;},at:'2026-11-01T20:00:00.000001Z',expected:'both groups withheld'},
 {name:'native receipt 1ms after evaluation control',change:s=>{s.receipts.individual.retrievedAtUTC='2026-11-01T20:00:00.001Z';},at:AT,expected:'individual withheld',control:true},
 {name:'official frame 1ms after evaluation control',change:s=>{s.frame.observedAtUTC='2026-11-01T20:00:00.001Z';},at:AT,expected:'both groups withheld',control:true},
 {name:'receipt 1ms before completion control',change:s=>{s.frame.completedByUTC='2026-11-01T19:10:00.001Z';},at:AT,expected:'both groups withheld',control:true},
 {name:'evaluation 1ms before source request control',change:s=>{s.request.asOfUTC='2026-11-01T20:00:00.001Z';},at:AT,expected:'evaluation rejected',control:true},
 {name:'source capture 1ms after evaluation control',change:s=>{s.request.individual.capture.retrievedAtUTC='2026-11-01T20:00:00.001Z';},at:AT,expected:'individual withheld',control:true},
 {name:'capture age 1ms over one-hour policy control',change:s=>{s.request.freshnessPolicy.maxCaptureAgeHours=1;},at:'2026-11-01T20:00:00.001Z',expected:'both groups withheld',control:true},
];
for(const p of probes){const f=fixture(p.change);let output,error;try{output=createCurrentProcessEvidenceGate(f.policy)(f.requestBytes,p.at,f.bundleBytes,f.artifacts);}catch(e){error=e.message;}
 const accepted=output?.coverage.individualQualified||0;const onIce=output?.coverage.onIceQualified||0;
 const rejected=p.expected==='evaluation rejected'?error==='evaluation_precedes_source_request':p.expected==='both groups withheld'?accepted===0&&onIce===0&&!error:accepted===0&&!error;
 records.push({name:p.name,expected:p.expected,actualError:error||null,individualQualified:accepted,onIceQualified:onIce,unexpectedAdmission:!rejected,
   requestAsOf:f.s.request.asOfUTC,evaluatedAt:p.at,nativeAt:f.s.receipts.individual.retrievedAtUTC,officialAt:f.s.frame.observedAtUTC,completedBy:f.s.frame.completedByUTC,individualCaptureAt:f.s.request.individual.capture.retrievedAtUTC,maxCaptureAgeHours:f.s.request.freshnessPolicy.maxCaptureAgeHours,
   provenance:output?.records[0].individual.provenance||null});
 if(p.control)assert(rejected,p.name);else assert(!rejected,p.name+' did not reproduce');
 if(output){assert.equal(output.score,null);assert.equal(output.trusted,false);assert.equal(output.productionAdopted,false);}
}
const outcome={timezone:process.env.TZ||'unset',fixture:'explicitly synthetic original test fixture; no native evidence or real acceptance',unexpectedAdmissions:records.filter(r=>r.unexpectedAdmission).length,controlsPassed:6,records};
fs.writeFileSync(path.join(__dirname,`TIMING-${(process.env.TZ||'unset').replaceAll('/','-')}.json`),JSON.stringify(outcome,null,2)+'\n');
console.log(JSON.stringify({timezone:outcome.timezone,unexpectedAdmissions:outcome.unexpectedAdmissions,controlsPassed:6}));

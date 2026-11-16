const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const ROOT=__dirname,WEB='/Users/tim/Code/fhfhockey.com/web',OUT=path.join(ROOT,'production-context-02');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const ts=require(path.join(WEB,'node_modules/typescript'));
function load(name,pin){const p=path.join(WEB,'lib/buyLowSellHigh',name+'.ts'),src=fs.readFileSync(p,'utf8');if(sha(src)!==pin)throw Error('Shared source changed');const m=new Module(p);m._compile(ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,p);return m.exports;}
const {qualifyCurrentInputs}=load('currentInput','58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232');
const {outcomes,FHFH_WEIGHTS}=load('productionReference','9a56af85486c850aebc2df4d3ad218b43ca2bbeb3a7073453a0c38189a4be85e');
const capture=path.join(ROOT,'live-read-01/capture'),receipt=read(path.join(capture,'RESULT.json')),bytes=fs.readFileSync(path.join(capture,'CURRENT-REQUEST.json'));
if(sha(bytes)!==receipt.artifacts['CURRENT-REQUEST.json'])throw Error('Capture changed');
const request=JSON.parse(bytes),qualified=qualifyCurrentInputs(request);
const discrepancyPath=path.resolve(ROOT,'../current-box-provenance-20261101-01/DISCREPANCIES.json');
const differences=read(path.join(ROOT,'qualification-01/SOURCE-DIFFERENCES.json'));
if(differences.wgo.changedCount||differences.wgo.missingCount)throw Error('Prior data binding needs review');
const {buildProductionContexts}=require('./production_context.cjs');
const contexts=buildProductionContexts(qualified.records,{outcomes,eventThroughDate:request.eventThroughDate,capturedAtUTC:request.asOfUTC,discrepancies:read(discrepancyPath)});
if(contexts.length!==740||contexts.some(p=>p.supportScore!==null||p.buySellLabel!==null))throw Error('Unsupported scoring or population');
fs.mkdirSync(OUT);
fs.writeFileSync(path.join(OUT,'CONTEXTS.json'),JSON.stringify({version:'fhfh.blsh.current-production-context.v1',scoring:'FHFH Standard',weights:FHFH_WEIGHTS,captureSHA256:sha(bytes),profiles:contexts})+'\n',{flag:'wx'});
const headers=['player_id','name','team','first_selected_date','last_selected_date','selected_records','appearances','minutes','FHFH_FP_total','FHFH_FP_per_appearance','FHFH_FP_per_60','raw_points_total','Game_Score_total','shots','known_discrepant_fields','support_score_state'];
const cell=v=>v===null?'':('"'+String(v).replaceAll('"','""')+'"');
const rows=contexts.map(p=>[p.playerId,p.name,p.team,p.dates[0],p.dates.at(-1),p.selectedRecords,p.appearances,p.minutes,p.metrics[0].total,p.metrics[0].perAppearance,p.metrics[0].per60,p.metrics[1].total,p.metrics[2].total,p.shots,p.sourceDiscrepancies.map(d=>d.source_id+':'+d.field).join(';'),p.supportStatus]);
fs.writeFileSync(path.join(OUT,'CURRENT-PRODUCTION.csv'),[headers,...rows].map(r=>r.map(cell).join(',')).join('\n')+'\n',{flag:'wx'});
const summary={asOfUTC:request.asOfUTC,eventThroughDate:request.eventThroughDate,profiles:contexts.length,selectedSourceRows:contexts.reduce((n,p)=>n+p.selectedRecords,0),
  fullFiveRecords:contexts.filter(p=>p.selectedRecords===5).length,zeroShotWindows:contexts.filter(p=>p.shots===0).length,
  fantasyPointsComplete:contexts.filter(p=>p.metrics[0].total!==null).length,rawPointsComplete:contexts.filter(p=>p.metrics[1].total!==null).length,
  gameScoreComplete:contexts.filter(p=>p.metrics[2].total!==null).length,profilesWithKnownDiscrepancies:contexts.filter(p=>p.sourceDiscrepancies.length).length,
  knownDiscrepantFieldsRetained:contexts.reduce((n,p)=>n+p.sourceDiscrepancies.length,0),supportScores:0,buySellLabels:0,
  sourceIdScope:'Last five captured records ordered by date then source ID; no per-game cold/hot episode claim.',
  noReferenceFitOrCombinedScoreRun:true,baselineComparisonUnavailable:true,officialTruthNotInferred:true,
  contextSHA256:sha(fs.readFileSync(path.join(OUT,'CONTEXTS.json'))),discrepancyEvidenceSHA256:sha(fs.readFileSync(discrepancyPath))};
fs.writeFileSync(path.join(OUT,'SUMMARY.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));

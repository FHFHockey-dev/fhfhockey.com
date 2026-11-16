// Pure source extraction; no app module imports, request handlers or persistence.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const receipts=[];
function load(path){const text=fs.readFileSync(path,'utf8');receipts.push({path,sha256:crypto.createHash('sha256').update(text).digest('hex')});return ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);}
function node(sf,predicate){let found;function walk(n){if(!found&&predicate(n))found=n;ts.forEachChild(n,walk);}walk(sf);assert(found);return found.getText(sf).replace(/^export /,'');}
const reg=load('web/lib/projectionsConfig/statsMasterList.ts');
const declarations=['canonicalStatKey','getCategoryRegistryEntry','statAppliesToRole','resolveStatDirection'].map(name=>node(reg,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name));
const ga=node(reg,n=>ts.isObjectLiteralExpression(n)&&n.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(reg)==='key'&&p.initializer.getText(reg)==='"GOALS_AGAINST_GOALIE"'));
const scoring=load('web/lib/scoring/categoryScores.ts');
const applies=node(scoring,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='categoryAppliesToRole');
const scenario=load('web/lib/draft-pro/scenarios.ts');
const scenarioCode=scenario.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(scenario).replace(/^export /,'')).join('\n');
const reports=load('web/lib/draft-pro/reports.ts');
const reportFn=node(reports,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildDraftProReport');
const label=node(reports,n=>ts.isVariableDeclaration(n)&&n.name.getText(reports)==='label');
const code=`const stat=${ga}; const REGISTRY_ALIASES={};
const CATEGORY_REGISTRY=new Map([[stat.key,{key:stat.key,role:'goalie',direction:stat.higherIsBetter?'higher':'lower',aggregation:'count'}]]);
${declarations.join('\n')}
${applies}
${scenarioCode}
const ${label}; ${reportFn}; globalThis.compare=compareDraftProScenarios; globalThis.report=buildDraftProReport;`;
const context=vm.createContext({});vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText,context,{timeout:1000});
const player=(id,goals)=>({id,name:id,role:'goalie',eligiblePositions:['G'],teamAbbreviation:'TOR',projectionSeason:'20262027',globalVorp:1,rankValue:1,projectedPoints:-3*goals,categoryValues:{GOALS_AGAINST_GOALIE:goals}});
const source={projection:{id:'fixture',version:'v1',origin:'server'},schedule:{season:'20262027',startWeek:1,endWeek:2,lineupMode:'daily',rosterSlots:{G:1}}};
const input={roster:[player('ours',10)],referenceRoster:[player('peer',20)],referenceBasis:'Peer roster',leagueType:'points',season:'20262027',scoring:{GOALS_AGAINST_GOALIE:-3},categoryWeights:{GOALS_AGAINST_GOALIE:-3},source};
const report=context.report('draft_summary',input,new Date('2026-11-14T00:00:00Z'));
assert(report.weaknesses.includes('goals against goalie is weaker than Peer roster'));
assert.equal(report.totals.projectedPoints,-30);assert.equal(input.referenceRoster[0].projectedPoints,-60);
const comparison=context.compare({...input,candidateA:player('candidateA',5),candidateB:player('candidateB',10)});
assert.equal(comparison.candidates[0].categories.GOALS_AGAINST_GOALIE.direction,'higher');
assert.equal(comparison.candidates[0].projectedPointsDelta,-15);
console.log(JSON.stringify({receipts,report:{ourPoints:-30,peerPoints:-60,strengths:report.strengths,weaknesses:report.weaknesses},scenario:{goalsAgainstAdded:5,pointEffect:comparison.candidates[0].projectedPointsDelta,claimedDirection:comparison.candidates[0].categories.GOALS_AGAINST_GOALIE.direction},boundary:'Synthetic ordinary points scoring; exact pure source; registry setup from exact GA entry; no API/server/React/persistence.'},null,2));

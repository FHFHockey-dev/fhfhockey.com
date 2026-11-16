// Read-only audit probes: exact source declarations/expressions, no application imports.
const fs = require('fs'), cp = require('child_process'), vm = require('vm'), crypto = require('crypto');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const hashes = {};
function source(path) {
  const b = fs.readFileSync(path);
  if (!b.equals(cp.execFileSync('git', ['show', '89da739cb:' + path]))) throw Error('target drift ' + path);
  hashes[path] = crypto.createHash('sha256').update(b).digest('hex');
  return ts.createSourceFile(path, b.toString(), ts.ScriptTarget.Latest, true);
}
function nodes(sf, test) { const out=[]; function walk(n) { if(test(n)) out.push(n); ts.forEachChild(n,walk); } walk(sf); return out; }
function named(sf, name) { const n=nodes(sf,n=>(ts.isVariableDeclaration(n)||ts.isFunctionDeclaration(n))&&n.name?.getText(sf)===name); if(n.length!==1) throw Error(name+' matches '+n.length); return n[0]; }
function declarations(sf, names) { return names.map(name=>{const n=named(sf,name); return ts.isVariableDeclaration(n)?'const '+n.getText(sf)+';':n.getText(sf).replace(/^export\s+/,'');}).join('\n'); }
function evalCode(code, names, bindings={}) {
  const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return vm.runInNewContext(js+'\n;({'+names.join(',')+'})',{...bindings,exports:{}},{timeout:1000});
}
const shot=source('web/components/ShotVisualization/ShotVisualization.tsx');
const shotSummary=evalCode(declarations(shot,['shotSummary']),['shotSummary']).shotSummary;
const eventFilter=[{typedesckey:'shot-on-goal'},{typedesckey:'shot-on-goal'}];
const selectedSaves=shotSummary(eventFilter), completeEvents=shotSummary([...eventFilter,{typedesckey:'goal'}]);
const scaleProp=nodes(shot,n=>ts.isJsxAttribute(n)&&n.name.getText(shot)==='scaleValues')[0].initializer.expression.getText(shot);
const passedScale=evalCode('const scaleValues = '+scaleProp,['scaleValues'],{teamScaleValues:{min:0,mid:5,max:9}}).scaleValues;
const legendMax=nodes(shot,n=>ts.isVariableDeclaration(n)&&n.name.getText(shot)==='maxVal'&&n.initializer.getText(shot).includes('scaleValues.opponent'))[0].initializer.getText(shot);
const opponentLegend=evalCode('const maxVal = '+legendMax,['maxVal'],{scaleValues:passedScale,fallbackMax:9}).maxVal;
const skater=source('web/components/SkaterPage/skaterMetrics.ts');
const skaterNames=['EMPTY_BUCKET','finiteOrZero','average','sum','getTeam','getPlayerKey','groupRowsByPlayer','getLatestContextByPlayer','getValuation','getValuationLabel','sortByBucketThenName','buildSkaterMetricsRows'];
const sk=evalCode(declarations(skater,skaterNames),['buildSkaterMetricsRows']);
const row={player_id:1,player_name:'Fixture',team_abbrev:'TOR',date:'2026-11-01',games_played:1,goals:null,shots:null,points:null,hits:null,toi_per_game:null};
const unknown=sk.buildSkaterMetricsRows([row],[],'ownership')[0];
const mixed=sk.buildSkaterMetricsRows([{...row,goals:1,shots:2,toi_per_game:60},{...row,date:'2026-11-02',shots:8}],[],'ownership')[0];
const advanced=source('web/components/SkaterPage/SkaterAdvancedMetricsTable.tsx');
const compareValues=evalCode(declarations(advanced,['compareValues']),['compareValues']).compareValues;
const ordinal=nodes(advanced,n=>ts.isBinaryExpression(n)&&n.getText(advanced)==='index + 1')[0].getText(advanced);
const ranked=[{id:'A',value:2},{id:'B',value:2},{id:'C',value:null}].sort((a,b)=>compareValues(a.value,b.value,'descending')).map((r,index)=>({...r,rank:evalCode('const rank = '+ordinal,['rank'],{index}).rank}));
const social=source('web/components/SocialShare/SocialShare.tsx');
const clock=evalCode(declarations(social,['clock']),['clock']).clock;
const clocks=[59.6,119.7,719.6].map(seconds=>({seconds,actual:clock(seconds),roundedSeconds:Math.round(seconds)}));
if(selectedSaves.shootingPct!=='0.0'||completeEvents.shootingPct!=='33.3'||opponentLegend!==9||unknown.points!==0||unknown.hits!==0||mixed.shootingPercentage!==0.1||mixed.averageTimeOnIce!==60||ranked.map(x=>x.rank).join(',')!=='1,2,3'||clocks[1].actual!=='1:60') throw Error('unexpected probe result');
console.log(JSON.stringify({target:'89da739cb',mode:'exact-source offline VM; no app imports, requests or React',hashes,selectedSaves,completeEvents,opponentScale:{actualBinMaximum:1,passedScale,legendMaximum:opponentLegend},unknown,mixed,ranked,clocks},null,2));

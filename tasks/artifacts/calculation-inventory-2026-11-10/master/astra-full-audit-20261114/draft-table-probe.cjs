const fs=require('fs'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const root='/Users/tim/Code/fhfhockey.com';
function source(p){const bytes=fs.readFileSync(root+'/'+p);assert(bytes.equals(cp.execFileSync('git',['show','89da739cb:'+p],{cwd:root})));return {sf:ts.createSourceFile(p,bytes.toString(),ts.ScriptTarget.Latest,true),hash:crypto.createHash('sha256').update(bytes).digest('hex')};}
function decl(sf,name){let hit;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)===name)hit=n;ts.forEachChild(n,visit)}visit(sf);assert(hit);return hit;}
function calc(expr,context){return vm.runInNewContext(ts.transpileModule('('+expr+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context,{timeout:1000});}
const table=source('web/components/DraftDashboard/ProjectionsTable.tsx');
const suggestion=source('web/components/DraftDashboard/SuggestedPicks.tsx');
const proration=source('web/lib/projectionsConfig/proration.ts');
const availability=source('web/lib/draftDashboard/availability.ts');
const getFunction=(sf,name)=>sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name).getText(sf).replace(/^export /,'');
const getProratedStat=calc(getFunction(proration.sf,'getProratedStat'),{});
const estimatePlayerAvailability=vm.runInNewContext(ts.transpileModule(availability.sf.text.replaceAll('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';estimatePlayerAvailability',{},{timeout:1000});
const players=[{playerId:1,fullName:'Known',displayPosition:'C',combinedStats:{GOALS:{projected:10}},fantasyPoints:{projected:10},yahooAvgPick:20},{playerId:2,fullName:'Unknown',displayPosition:'C',combinedStats:{GOALS:{projected:null}},fantasyPoints:{projected:null},yahooAvgPick:null}];
const base={players,activePositionFilter:'ALL',debouncedSearchTerm:'',favoritesOnly:false,favoriteIds:new Set(),sortField:'yahooAvgPick',sortDirection:'asc',statSortKey:'GOALS',prorate84:false,getProratedStat,vorpMap:new Map(),riskMap:new Map(),leagueRankByPlayerId:new Map()};
const tableSort=decl(table.sf,'filteredAndSortedPlayers').initializer.arguments[0].getText(table.sf);
const statOrder=calc('('+tableSort+')()',base).map(x=>x.playerId);
const adpOrder=calc('('+tableSort+')()',{...base,statSortKey:'',sortDirection:'desc'}).map(x=>x.playerId);
assert.deepEqual(statOrder,[2,1]);assert.deepEqual(adpOrder,[2,1]);
const sSort=decl(suggestion.sf,'sorted').initializer.arguments[0].getText(suggestion.sf);
const sbase={filtered:players.map(player=>({player,score:1})),sortDir:'asc',sortField:'avail',dustSort:'ordinary',dustInsights:null,estimatePlayerAvailability,selectionHorizon:{currentPick:1,targetPick:10,opposingPicks:9},availabilitySpread:12};
const availabilityOrder=calc('('+sSort+')()',sbase).map(x=>x.player.playerId);
const sadpOrder=calc('('+sSort+')()',{...sbase,sortField:'adp',sortDir:'desc'}).map(x=>x.player.playerId);assert.deepEqual(availabilityOrder,[2,1]);assert.deepEqual(sadpOrder,[2,1]);
let formatExpr;const pill=decl(table.sf,'StatPill');function visit(n){if(ts.isConditionalExpression(n)&&n.getText(table.sf).startsWith('value == null'))formatExpr=n.getText(table.sf);ts.forEachChild(n,visit)}visit(pill);assert(formatExpr);
const priorSeason=[0.918,2.42,12.3,null,0].map(value=>({input:value,display:calc(formatExpr,{value})}));assert.equal(priorSeason[0].display,'1');assert.equal(priorSeason[1].display,'2');
const categoryPlayers=[{...players[0],fantasyPoints:{projected:100}},{...players[1],fantasyPoints:{projected:10}}];
const categoryMap=new Map([['1',{value:-1}],['2',{value:1}]]);
const categoryFpOrder=calc('('+tableSort+')()',{...base,players:categoryPlayers,statSortKey:'',sortField:'fantasyPoints',sortDirection:'desc',vorpMap:categoryMap}).map(x=>({id:x.playerId,displayedFp:x.fantasyPoints.projected}));assert.equal(categoryFpOrder[0].displayedFp,10);
const bands=calc('('+decl(table.sf,'percentileBands').initializer.arguments[0].getText(table.sf)+')()',{filteredAndSortedPlayers:categoryPlayers,draftedIdSet:new Set(),getPrimaryPos:()=> 'C',vorpMap:new Map([['1',{value:null}],['2',{value:1}]])});assert.equal(bands.valBandById.get('1'),'valueSuccess');
const offPlayers=Array.from({length:5},(_,i)=>({playerId:i+1}));const off=calc('('+decl(table.sf,'offNightRankById').initializer.arguments[0].getText(table.sf)+')()',{filteredAndSortedPlayers:offPlayers,scheduleMetrics:new Map(offPlayers.map((p,i)=>[String(p.playerId),{off:5-i}])),getOffNightRankColor:rank=>String(rank)});assert.equal(off.get('4').quartile,4);
assert(!table.sf.text.includes('NODE_ENV'));assert(table.sf.text.includes('{showDiagnostics && ('));
console.log(JSON.stringify({target:'89da739cb',hashes:{table:table.hash,suggested:suggestion.hash,proration:proration.hash,availability:availability.hash},statAscending:statOrder,tableAdpDescending:adpOrder,suggestedAvailabilityAscending:availabilityOrder,suggestedAdpDescending:sadpOrder,priorSeason,categoryFpDescending:categoryFpOrder,categoryBandKnownNull:Array.from(bands.valBandById),offNightFivePlayerQuartiles:Array.from(off),execution:'Pinned extracted AST expressions only; synthetic local inputs; no app imports, JSX rendering, DB or network'},null,2));

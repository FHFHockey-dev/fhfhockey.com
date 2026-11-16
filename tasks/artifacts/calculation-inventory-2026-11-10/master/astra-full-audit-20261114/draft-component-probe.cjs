const fs=require('fs'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const root='/Users/tim/Code/fhfhockey.com';
function source(p){const bytes=fs.readFileSync(root+'/'+p);assert(bytes.equals(cp.execFileSync('git',['show','89da739cb:'+p],{cwd:root})));return {sf:ts.createSourceFile(p,bytes.toString(),ts.ScriptTarget.Latest,true),hash:crypto.createHash('sha256').update(bytes).digest('hex')};}
function decl(sf,name){let hit;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)===name)hit=n;ts.forEachChild(n,visit)}visit(sf);assert(hit);return hit;}
function calc(expr,context){return vm.runInNewContext(ts.transpileModule('('+expr+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context,{timeout:1000});}
const c=source('web/components/DraftDashboard/ComparePlayersModal.tsx');
const callback=decl(c.sf,'{ labels, rows, leftAvg, rightAvg }').initializer.arguments[0].getText(c.sf);
const allPlayers=[{playerId:1,combinedStats:{GOALS:{projected:30}}},{playerId:2,combinedStats:{}},{playerId:3,combinedStats:{GOALS:{projected:10}}}];
const compare=calc('('+callback+')()',{players:allPlayers.slice(0,2),allPlayers,metricKeys:['GOALS'],STATS_MASTER_LIST:[{key:'GOALS',displayName:'G',higherIsBetter:true}]});
assert.equal(compare.rows[0].p1,75);assert.equal(compare.rows[0].p2,null);assert.equal(compare.leftAvg,0);assert.equal(compare.rightAvg,0);assert(c.sf.text.includes('It’s a tie on average percentile.'));
const l=source('web/components/DraftDashboard/LeagueStandings.tsx');
const teams=[{teamId:'A',projectedPoints:10,unknownProjectionCount:0,teamVorp:-5,unknownVorpCount:0},{teamId:'B',projectedPoints:10,unknownProjectionCount:0,teamVorp:-5,unknownVorpCount:0},{teamId:'C',projectedPoints:0,unknownProjectionCount:1,teamVorp:0,unknownVorpCount:1}];
const values=calc('('+decl(l.sf,'values').initializer.arguments[0].getText(l.sf)+')()',{teams,leagueType:'points'});
const standingOrder=calc(decl(l.sf,'standingOrder').initializer.getText(l.sf),{teams,values});
const sorted=calc(decl(l.sf,'sorted').initializer.getText(l.sf),{teams,values,sort:{key:'vorp',ascending:false},scheduleTotals:new Map()});
let rankExpr,vorpExpr;function visit(n){const text=n.getText(l.sf);if(ts.isBinaryExpression(n)&&text.startsWith('standingOrder.findIndex')&&text.endsWith('+ 1'))rankExpr=text;if(ts.isCallExpression(n)&&text==='(team.teamVorp ?? 0).toFixed(1)')vorpExpr=text;ts.forEachChild(n,visit)}visit(l.sf);assert(rankExpr&&vorpExpr);
const rows=teams.map(team=>({team:team.teamId,value:values[team.teamId],rank:calc(rankExpr,{team,standingOrder}),vorp:calc(vorpExpr,{team})}));
assert.deepEqual(rows.map(x=>x.rank),[1,2,3]);assert.equal(rows[2].value,null);assert.equal(rows[2].vorp,'0.0');assert.equal(sorted[0].teamId,'C');
console.log(JSON.stringify({target:'89da739cb',sourceHashes:{compare:c.hash,standings:l.hash},compare,standingRows:rows,vorpSort:sorted.map(x=>x.teamId),execution:'Exact extracted AST expressions in isolated VM; no application imports, React rendering, DB or network'},null,2));

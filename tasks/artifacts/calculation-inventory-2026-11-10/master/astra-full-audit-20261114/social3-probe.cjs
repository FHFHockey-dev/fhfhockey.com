const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb',read=p=>cp.execFileSync('git',['show',pin+':'+p],{encoding:'utf8'});
function run(source,deps={},globals={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Intl,...globals,require:k=>{if(!(k in deps))throw Error('Unexpected dependency '+k);return deps[k]}});return m.exports;}
function extract(path,names){const source=read(path),sf=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),nodes=sf.statements.filter(n=>names.includes(n.name?.text??(ts.isVariableStatement(n)?n.declarationList.declarations[0].name.getText(sf):null)));assert.equal(nodes.length,names.length);return nodes.map(n=>n.getText(sf)).join('\n');}
const dates=run(read('web/lib/rosterScheduleOptimizer/planningDates.ts'));
const normalize=run(extract('web/lib/rankings/skaterDeploymentAggregation.ts',['finiteNumber','normalizeEvDeploymentBucket','normalizePpDeploymentBucket']));
const streak=run(read('web/lib/socialShare/streak.ts'));
const config=run(read('web/lib/projectionsConfig/fantasyPointsConfig.ts'));
const score=run(read('web/lib/socialShare/score.ts'),{'lib/projectionsConfig/fantasyPointsConfig':config});
const players=run(extract('web/lib/socialShare/players.ts',['isDate','count','streakInputs','RECENT_MAX_AGE_DAYS','attachRecent']),{}, {...dates,...normalize,STREAK:streak.STREAK,SHARE_TIME_ZONE:'America/New_York',goalieRecent:()=>{throw Error('Unexpected goalie branch')}});
const player={nhlId:1,name:'Synthetic',team:'NJD',group:'F',pointsPerGame:1,gamesPlayed:10};
const layer={season:20262027,state:'ready',players:[player]};
const row={player_id:1,season:20262027,game_date:'2026-11-13',strength_state:'all',season_games_played:null,goals_total_last5:5,assists_total_last5:0,points_total_last5:5,shots_total_last5:0,hits_avg_last5:0,blocks_avg_last5:0,toi_seconds_avg_last5:960,pp_points_total_last5:0,toi_seconds_avg_season:null,line_combo_slot:null,line_combo_group:null,pp_unit:null,goals_total_all:5,assists_total_all:0,toi_seconds_total_last5:null,pp_toi_seconds_total_last5:null,pp_toi_seconds_avg_season:null};
function check(gp){const got=players.attachRecent(layer,{rolling:[{...row,season_games_played:gp}],goalieGames:[]},'2026-11-14T12:00:00Z');return {sourceGP:gp,recentState:got.recentState,games:got.players[0].recent.games,fpPerGame:score.fantasyPointsPerGame(got.players[0]),streak:streak.streakOf(got.players[0],'pickup')};}
const unknown=check(null),knownFive=check(5),knownOne=check(1);
assert.equal(unknown.games,5);assert.equal(unknown.fpPerGame,3);assert.equal(unknown.streak.kind,'hot');assert.equal(unknown.streak.reasons[0],'1.0 P/GP');assert.equal(knownFive.fpPerGame,3);assert.equal(knownOne.games,1);assert.equal(knownOne.streak,null);
const result={pin,status:'passed',unknown,knownFive,knownOne,limits:'Exact extracted attachRecent and streakInputs plus full frozen score/streak/config/calendar and exact normalizers. Synthetic single skater bypasses source fetch and buildPlayerLayer. Goalie branch denied. No app imports, network, Vitest or UI.'};
fs.writeFileSync('/tmp/astra-social3-probe-output.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

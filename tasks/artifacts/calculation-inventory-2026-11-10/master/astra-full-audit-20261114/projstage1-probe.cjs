const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function src(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');return ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);}
function load(p,globals={},names=null,extra=''){const sf=src(p),nodes=sf.statements.filter(n=>!ts.isImportDeclaration(n)&&(!names||names.includes(n.name?.text)));const m={exports:{}};vm.runInNewContext(ts.transpileModule(nodes.map(n=>n.getText(sf)).join('\n')+'\n'+extra,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,...globals},{timeout:1000});return m.exports;}

const root='web/lib/projections/';const num=load(root+'utils/number-utils.ts');
const preflight=load(root+'stages/preflight-stage.ts',num,['scratchGameIdOf','availabilityMultiplierForEvent','selectRosterEventsForSlate']);
const ev={event_id:1,team_id:10,player_id:100,event_type:'GOALIE_START_CONFIRMED',confidence:1,payload:{},effective_from:'2026-11-13T04:00:00Z',effective_to:'2026-11-14T10:00:00Z'};
const select=at=>preflight.selectRosterEventsForSlate({events:[ev],startTs:at,gameIds:[2026029999],goalieLikelyOverrides:false});assert.equal(select('2026-11-14T00:00:00Z').goalieOverrideByTeamId.get(10).starterProb,1);assert.equal(select('2026-11-14T20:00:00Z').goalieOverrideByTeamId.size,0);
const mixtures=load(root+'calculators/goalie-starter.ts',num,['buildTopStarterScenarios','blendTopStarterScenarioOutputs']);
const contracts=load(root+'goalie/goalieCandidates.ts');
const prop=load(root+'utils/market-output-builders.ts',{},['getProjectionValueForPropMarket']);
const writes=[],lambdaCalls=[];
const globals={...num,...mixtures,...contracts,...prop,
 starterBoardFlags:()=>({compute:false}),getSeasonLeagueSavePct:async()=>({savePct:.9}),
 computeTeamStrengthContextAdjustment:()=>({shotsAgainstPctAdjustment:0,teamGoalsForPctAdjustment:0,opponentGoalsForPctAdjustment:0}),
 computeTeamFiveOnFiveContextAdjustment:()=>({contextPctAdjustment:0,leagueSavePctAdjustment:0}),computeNstOpponentDangerAdjustment:()=>({contextPctAdjustment:0}),
 OPPONENT_RESTED_BOOST:0,OPPONENT_B2B_PENALTY:0,DEFENSE_B2B_FATIGUE_BOOST:0,OPPONENT_HOME_BOOST:0,OPPONENT_AWAY_PENALTY:0,
 TEAM_STRENGTH_WEAKER_GAP:.2,WEAK_OPPONENT_GF_THRESHOLD:2.8,GOALIE_CONTEXT_SAVE_PCT_PASS_THROUGH:0,STARTER_DECISION_SHARE:.97,
 marketTeamWinProbability:()=>null,teamWinProbability:(a,b)=>{lambdaCalls.push([a,b]);return .5},goalieConditionalWinProbability:()=>.5,goalieWinPopulations:()=>null,
 computeStarterProbabilities:args=>new Map(args.priorStartProbByGoalieId),daysBetweenDates:()=>3,
 buildStarterHeuristicMetadata:()=>({}),buildStarterOverrideMetadata:()=>({}),augmentStarterModelMetaWithScenarioProjections:()=>({}),
 goalieConfirmationFromEvidence:()=>[],goalieRestSavePctAdjustment:()=>0,computeGoalieRestSplitSavePctAdjustment:()=>0,toGoalieRestSplitBucket:()=>null,
 computeModeledSavePct:({evidence})=>evidence.syntheticSavePct,
 computeGoalieProjectionModel:({projectedShotsAgainst:s,evidence,starterProbability:p})=>({modeledSavePct:evidence.syntheticSavePct,projectedSaves:s*evidence.syntheticSavePct,projectedGoalsAllowed:s*(1-evidence.syntheticSavePct),winProbability:.5*p,shutoutProbability:.05}),
 buildGoalieUncertainty:()=>({}),buildGoalieUncertaintyWithModel:()=>({}),forgeReservePassEnabled:()=>false,
 persistForgeGoalieProjection:async row=>{writes.push(row);return 1},persistForgeReserveProjectionRows:()=>{throw Error('unexpected reserve')},
 getConsensusLineValue:()=>null,quotesFromMarketSummary:()=>[],forgePropOverProbability:()=>()=>.5,compareModelWithMarket:()=>null,
 ANALYTICS_MODEL_NAME:'forge',ANALYTICS_MODEL_VERSION:'synthetic-probe',
};
for(const name of ['fetchTeamStrengthPrior','fetchTeamFiveOnFiveProfile','fetchTeamNstExpectedGoalsProfile','fetchTeamDefensiveEnvironment','fetchTeamOffenseEnvironment','fetchTeamRestDays','fetchTeamGoalieStarterContext','fetchGoalieEvidence','fetchGoalieWorkloadContext','fetchGoalieRestSplitProfile','loadSeasonBootstrap'])globals[name]=()=>{throw Error('unexpected query '+name)};
const stage=load(root+'stages/goalie-stage.ts',globals,['runPerGameGoalieStage']);
function args(horizon){const date='2026-11-14',game={id:2026029999,date,homeTeamId:10,awayTeamId:11},team=value=>new Map([[`10:${date}`,value],[`11:${date}`,value]]);return {
 asOfDate:date,runId:'synthetic',horizonGames:horizon,game,deadlineMs:Infinity,seasonBootstrap:false,
 goalieCandidates:[{teamId:10,opponentTeamId:11,candidateGoalieIds:[100,101],priorStartProbByGoalieId:new Map([[100,.6],[101,.4]]),confirmedStarterByGoalieId:new Map(),lineComboPriorByGoalieId:new Map(),projectedGsaaPer60ByGoalieId:new Map(),seasonStartPctByGoalieId:new Map(),seasonGamesPlayedByGoalieId:new Map(),override:null}],
 teamShotsByTeamId:new Map([[11,{shotsEs:25*horizon,shotsPp:5*horizon,shotsPk:0}]]),teamGoalsByTeamId:new Map([[10,3*horizon],[11,2*horizon]]),teamAbbreviationById:new Map(),
 teamStrengthPriorCache:team(null),teamFiveOnFiveProfileCache:team(null),teamNstExpectedGoalsCache:team(null),teamDefensiveEnvironmentCache:team({avgShotsAgainstLast10:null,avgShotsAgainstLast5:null}),teamOffenseEnvironmentCache:team({avgShotsForLast10:null,avgShotsForLast5:null,avgGoalsForLast10:null,avgGoalsForLast5:null}),teamRestDaysCache:team(null),teamGoalieStarterContextCache:team({previousGameDate:null}),
 goalieEvidenceCache:new Map([[`100:${date}`,{syntheticSavePct:.9}],[`101:${date}`,{syntheticSavePct:.8}]]),goalieWorkloadContextCache:new Map([100,101].map(id=>[`${id}:${date}`,{daysSinceLastStart:3}])),goalieRestSplitProfileCache:new Map([100,101].map(id=>[`${id}:${date}`,null])),
 teamHorizonScalarsCache:team(Array(horizon).fill(1)),leagueSavePctCache:new Map(),selectedGoalieByTeamId:new Map(),playerPredictionOutputRows:[],modelMarketFlagRows:[],metrics:{warnings:[]},
 playerPropContextByGamePlayerKey:new Map([[`${game.id}:100`,{player_total_saves:{sourceNames:['synthetic-book']}}]])
};}
(async()=>{const one=args(1),five=args(5);await stage.runPerGameGoalieStage(one);await stage.runPerGameGoalieStage(five);const a=writes[0],b=writes[1];assert.equal(a.proj_shots_against,30);assert.equal(b.proj_shots_against,750);assert.equal(one.playerPredictionOutputRows[0].expected_value,25.8);assert.equal(a.uncertainty.goalie_candidates.rows.find(r=>r.goalie_id===100).if_starts.saves,27);assert.equal(five.playerPredictionOutputRows[0].expected_value,645);assert.deepEqual(lambdaCalls,[[3,2],[15,10]]);
 console.log(JSON.stringify({pin,hashes,checks:{expiredEvent:{expiredAt:ev.effective_to,decisionCutoff:'2026-11-14T20:00:00Z',slateStartAdmits:true,decisionCutoffWouldExclude:true},horizon:{h1Shots:a.proj_shots_against,h5Shots:b.proj_shots_against,linearH5Expected:150,winLambdaInputs:lambdaCalls},namedGoalieProp:{goalie:100,ownIfStartsSaves:27,mixtureSaves:a.proj_saves,propExpectedValue:one.playerPredictionOutputRows[0].expected_value,h5PropExpectedValue:five.playerPredictionOutputRows[0].expected_value}},boundaries:['Exact isolated full goalie-stage control flow, exact mixture, candidate contract and prop-selector helpers','Neutral context and synthetic save-rate model stubs; not model qualification','All evidence caches synthetic; every query dependency throws if reached; writes collected in memory','No full skater/runner, Vitest, application module import, database/provider/page, actual environment, server/build or app edit']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

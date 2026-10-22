// Read-only, offline boundary audit. Exact current pure declarations are compiled;
// no application imports, server clients, env files, network or database are loaded.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const pins = {};
const coverage = [];
function compile(relative, names, dependencies = {}) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  pins[relative] = crypto.createHash('sha256').update(text).digest('hex');
  const tree = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const wanted = new Set(names);
  const snippets = [];
  for (const node of tree.statements) {
    const found = ts.isFunctionDeclaration(node) && node.name ? [node.name.text]
      : ts.isVariableStatement(node) ? node.declarationList.declarations.map(item => item.name.getText(tree)) : [];
    if (found.some(name => wanted.has(name))) {
      snippets.push(node.getText(tree));
      for (const name of found) wanted.delete(name);
    }
  }
  assert.equal(wanted.size, 0, `Missing declarations: ${[...wanted]}`);
  const output = ts.transpileModule(snippets.join('\n') + `\nglobalThis.selected = {${names.join(',')}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const context = vm.createContext({exports:{}, ...dependencies});
  vm.runInContext(output, context, {timeout:1000});
  coverage.push({path:relative,declarations:names});
  return context.selected;
}
const time = compile('web/lib/projections/evidenceTime.ts', ['timestampMicros','acceptedNewsSupersedes']);
const hash = compile('web/lib/player-forecasts/sourceSnapshot.ts', ['canonicalize','playerForecastSourcePayloadHash'], {crypto});
const identities = compile('web/lib/projections/issuedContext.ts', ['forgeScheduleRevision','forgeRosterRevision'], hash);
const policy = compile('web/lib/projections/calibrationEligibility.ts', ['FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT']);
const contribution = compile('web/lib/player-forecasts/contributions.ts', [
  'CONTRIBUTION_RESOLVER_POLICY_VERSION','CURRENT_SEASON_SOG_CONTRIBUTION_VERSION',
  'forecastCalendarPolicy','validForecastCalendarPolicy','calendarLeadDay','validTime','milliseconds','DAY_MS','utcDay',
  'assessSource','participationProbability','participationFor','resolveContribution'
], time);
const board = compile('web/lib/projections/starterBoardScoring.ts', [
  'BOARD_CATEGORIES','integrateBoardParticipation','scopedEvidence','assertionKeys','skaterParticipationFromEvidence',
  'boardSkaterForecast','goalieConfirmationFromEvidence','boardGoalieForecast','boardSkaterStatsFromProjection',
  'completeBoardSkaterStatsFromProjection'
], time);
const admission = compile('web/lib/projections/consumerRevisionAdmission.ts', ['numberOrNull','validCapturedTime','publicPlanningForecasts'], {
  ...time,...identities,...policy,...board,...contribution
});
const planner = compile('web/lib/rosterScheduleOptimizer/planning.ts', ['forecastAllows']);
// These are the existing repository's explicitly fictional fixture declarations.
const fixtures = compile('web/lib/rosterScheduleData/planning.test.ts', ['membershipCreatedAt','rosterRevision','player','rows','issuedContext','revision'], {...identities,...policy});
const now = new Date('2026-10-10T12:00:00Z');
const player = fixtures.player;
const game = {id:'2026020001',date:'2026-10-10',startsAt:'2026-10-10T23:00:00.000Z',teamAbbreviation:'TOR',opponent:'MTL',status:'scheduled',scheduleRevision:fixtures.issuedContext.schedule[0].revision};
const candidate = {playerId:847001,startingProbability:0.5,conditional:{SAVES_GOALIE:30},probabilityStatus:'uncalibrated_model'};
const base = fixtures.revision([candidate]);
const admit = revision => admission.publicPlanningForecasts([revision],[player],[game],now,{},[],20262027);
const results = [];
function check(id, description, run) {
  results.push({id,description,observed:run(),assertions:'matched current behavior'});
}
check('P07-1','No target/use approval receipt in synthetic issued fixture; admission still grants all three uses',()=>{
  const output=admit(base)[0];
  assert.ok(output);
  assert.equal(output.stats.SAVES_GOALIE,15);
  for(const use of ['assignment','totals','comparison']) assert.equal(planner.forecastAllows(output,'SAVES_GOALIE',use),true);
  assert.equal(planner.forecastAllows(output,'SAVES_GOALIE','conditionalTieBreak'),false);
  return {fixtureProvenanceKeys:Object.keys(base.payload.inputProvenance),stats:output.stats,allowedUses:output.allowedUses,consumerTotals:true,consumerComparison:true};
});
check('P07-2','Changing actual modelMode/codeVersion fields to an unreviewed synthetic candidate does not narrow permission',()=>{
  const changed=structuredClone(base);
  changed.payload.modelMode='candidate';changed.payload.codeVersion='synthetic-unreviewed-candidate';
  const evidence={informationCutoffAt:'2026-10-10T10:00:00Z',assertions:[{
    gameId:2026020001,teamId:1,playerId:847001,dimension:'ev',value:'L1',confirmed:true,
    evidenceId:'synthetic-confirmed-line',sourceKey:'fictional-source',sourceUrl:null,
    publishedAt:'2026-10-10T09:00:00Z',receivedAt:'2026-10-10T09:01:00Z'
  }],conflicts:[]};
  changed.payload.goalies=[];changed.payload.evidence=evidence;
  changed.payload.players=[{game_id:2026020001,team_id:1,player_id:847001,horizon_games:1,as_of_date:'2026-10-10',run_id:'run-1',
    proj_hits:3,proj_blocks:2,uncertainty:{model:{skater_selection:{production_conditioning:'conditional_playing',
      same_day_evidence:evidence,evidence_cutoff_at:evidence.informationCutoffAt,
      participation:{version:'skater-participation-v1',status:'confirmed_evidence',probability:1,evidenceIds:['synthetic-confirmed-line']},participation_probability:1}}}}];
  const output=admission.publicPlanningForecasts([changed],[{...player,playerClass:'skater',eligiblePositions:['LW']}],[game],now,{},[],20262027)[0];
  assert.equal(output.modelVersion,'synthetic-unreviewed-candidate');
  assert.equal(output.stats.HITS,3);assert.equal(output.appearanceProbability,1);
  assert.equal(planner.forecastAllows(output,'HITS','comparison'),true);
  return {inputMode:changed.payload.modelMode,inputCodeVersion:changed.payload.codeVersion,hits:output.stats.HITS,appearanceProbability:output.appearanceProbability,allowedUses:output.allowedUses};
});
check('P07-3','Existing external-fantasy input-contract guard still rejects a missing contract',()=>{
  const changed=structuredClone(base);delete changed.payload.inputProvenance.external_fantasy_input_contract;
  assert.equal(admit(changed).length,0);return {admitted:0};
});
check('P07-4','Existing schedule identity and future-publication guards still reject invalid fixtures',()=>{
  const wrong=structuredClone(base);wrong.payload.inputProvenance.issuedContexts[0].schedule[0].revision='wrong';
  assert.equal(admit(wrong).length,0);
  const future=structuredClone(base);future.published_at='2026-10-11T10:00:00Z';assert.equal(admit(future).length,0);
  return {wrongSchedule:0,futurePublication:0};
});
const output=admit(base)[0];
const identity={playerId:7,nhlPlayerId:847001,seasonId:20262027,teamId:1,gameId:2026020001,scheduledAt:game.startsAt,scheduleRevision:game.scheduleRevision,rosterRevision:player.rosterRevision};
// Mirrors the inspected adapter fields at planningContributions.ts:182–197.
// Full resolvePlanningContributions and whole-plan evaluation are not executed.
const detailed={...identity,kind:'detailed',sourceId:output.revisionId,policyVersion:output.modelVersion,released:true,
  targetKey:'SAVES_GOALIE',unit:'count',basis:'per_start',mean:30,participationIntegrated:false,
  cutoffAt:output.cutoffAt,issuedAt:output.issuedAt,expiresAt:output.expiresAt,sourceWatermark:output.sourceWatermark,allowedUses:output.allowedUses};
const participation={...identity,released:true,allowedUses:output.allowedUses,issuedAt:output.issuedAt,basis:'start',probability:0.5,
  revisionId:output.revisionId+':participation',cutoffAt:output.cutoffAt,expiresAt:output.expiresAt};
function resolveWith(uses){return contribution.resolveContribution({game:identity,targetKey:'SAVES_GOALIE',now:now.toISOString(),detailed:{...detailed,allowedUses:uses},participation:{...participation,allowedUses:uses}});}
check('P07-5','Adapter all-use grant survives actual pure contribution resolver',()=>{
  const r=resolveWith(output.allowedUses);assert.equal(r.unconditionalMean,15);
  assert.equal(r.allowedUses.totals,true);assert.equal(r.allowedUses.comparison,true);
  return {mean:r.unconditionalMean,allowedUses:r.allowedUses,exclusions:r.exclusionReasons};
});
check('P07-6','Resolver control: assignment-only denies totals/comparison without erasing known mean',()=>{
  const r=resolveWith({assignment:true,totals:false,comparison:false,conditionalTieBreak:false});
  assert.equal(r.unconditionalMean,15);assert.equal(r.allowedUses.assignment,true);
  assert.equal(r.allowedUses.totals,false);assert.equal(r.allowedUses.comparison,false);
  assert.ok(r.exclusionReasons.includes('use_not_approved'));
  return {mean:r.unconditionalMean,allowedUses:r.allowedUses,exclusions:r.exclusionReasons};
});
check('P07-7','Resolver control: absent permission denies every quality use',()=>{
  const r=resolveWith(undefined);assert.equal(r.allowedUses.assignment,false);assert.equal(r.allowedUses.totals,false);assert.equal(r.allowedUses.comparison,false);
  return {mean:r.unconditionalMean,allowedUses:r.allowedUses,exclusions:r.exclusionReasons};
});
for(const [relative,pin] of Object.entries(pins)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex'),pin,'Source changed during probe');
const receipt={as_of:new Date().toISOString(),node:process.version,method:'Selected exact current TypeScript declarations in isolated VM contexts; real pure identity, admission, participation math, permission resolver and planner helper. Existing fictional test fixture. No service or full application imports.',results,source_pins:pins,executed_declarations:coverage,limitations:'Demonstrates local boundary cannot distinguish target-use/model approval scopes. Does not prove deployed unauthorized recommendations, a bypass of an existing recognized receipt, model inaccuracy, or a full-plan outcome. Synthetic resolver inputs mirror inspected adapter fields; full adapter/UI/DB/RPC not executed.'};
fs.writeFileSync(path.join(__dirname,'P07-PROBES.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({checks:results.length,node:process.version,pinnedSources:Object.keys(pins).length,result:'counterexample and controls reproduced'},null,2));

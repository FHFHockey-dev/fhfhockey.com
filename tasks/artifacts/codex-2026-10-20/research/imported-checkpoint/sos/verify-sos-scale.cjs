// Offline isolated actual-helper check. Reads source only; imports no app modules.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('/workspace/shared/fhfhockey.com/web/node_modules/typescript/lib/typescript.js');
const root = '/workspace/shared/fhfhockey.com/';
function extractFunctions(path, names) {
  const source = fs.readFileSync(root + path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const found = ast.statements.filter(s => ts.isFunctionDeclaration(s) && s.name && names.includes(s.name.text));
  if (found.length !== names.length) throw Error('Missing isolated helper');
  const selected = found.map(s => s.getText(ast)).join('\n') + '\nexports.isolated = {' + names.join(',') + '};';
  const code = ts.transpileModule(selected, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const sandbox = {exports:{}};
  vm.runInNewContext(code, sandbox, {timeout:1000});
  return {functions:sandbox.exports.isolated, sourceSha256:crypto.createHash('sha256').update(source).digest('hex')};
}
const producer = extractFunctions('web/lib/power-ratings.ts', ['calculateFinalRating']);
const consumer = extractFunctions('web/lib/game-predictions/featureBuilder.ts', ['toNumber','averageNullable','teamPowerComposite','adjustGoalDifferentialForOpponentQuality','adjustXgfPctForOpponentQuality']);
const ratings = producer.functions.calculateFinalRating({team_abbreviation:'AAA',date:'2026-10-01',off_raw:0,def_raw:0,pace_raw:0,z:{}},{off_raw_avg:0,off_raw_stddev:1,def_raw_avg:0,def_raw_stddev:1,pace_raw_avg:0,pace_raw_stddev:1});
const composite = consumer.functions.teamPowerComposite(ratings);
const gd = consumer.functions.adjustGoalDifferentialForOpponentQuality;
const xgf = consumer.functions.adjustXgfPctForOpponentQuality;
const pairs = [{name:'interior',homeRaw:0.55,awayRaw:0.50},{name:'upper_boundary',homeRaw:0.98,awayRaw:0.95}].map(x=>({...x,homeAdjusted:xgf(x.homeRaw,composite),awayAdjusted:xgf(x.awayRaw,composite),rawDifference:x.homeRaw-x.awayRaw,adjustedDifference:xgf(x.homeRaw,composite)-xgf(x.awayRaw,composite)}));
const result={scope:'Isolated source helpers only; no app module imports, DB/provider calls, or model inference.',sourceHashes:{powerRatings:producer.sourceSha256,featureBuilder:consumer.sourceSha256},neutralProducerRatings:{off_rating:ratings.off_rating,def_rating:ratings.def_rating,goalie_rating:ratings.goalie_rating,special_rating:ratings.special_rating},untransformedConsumerComposite:composite,neutralRawInputs:{goalDifferential:0,xgfShare:0.5},adjustedOutputs:{goalDifferential:gd(0,composite),xgfShare:xgf(0.5,composite)},goalDifferentialPair:{rawDifference:0.4-0.2,adjustedDifference:gd(0.4,composite)-gd(0.2,composite)},xgfPairs:pairs,caveat:'Shows nonneutral per-team feature offset and a possible clipping distortion; does not establish biased game predictions. Home-away additive constants cancel away from clipping, training standardization may absorb remaining shifts, and selected model/version/calibration are unknown.'};
fs.writeFileSync('/workspace/shared/fhfh-research-2026-10-20/SOS-SCALE-FIXTURE.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

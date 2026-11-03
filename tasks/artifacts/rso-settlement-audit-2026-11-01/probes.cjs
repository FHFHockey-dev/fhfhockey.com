const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { normalizeStartChartReadback } = require('../rso-resume-2026-11-01/release-prep/qualification-capture/normalize-readbacks.ts');
const root = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-resume-2026-11-01/release-prep';
const fixture = () => ({
  capture: { date: '2026-11-02', observedAt: '2026-11-03T17:00:00Z', gameIds: [2026020232], settlementVersion: 1 },
  issued: [{ playerId: '1', gameId: '2026020232', target: 'SHOTS_ON_GOAL', gameDate: '2026-11-02', revisionId: 'synthetic',
    method: 'baseline', codeVersion: 'a'.repeat(40), configurationHash: 'b'.repeat(64), artifactHash: 'c'.repeat(64), horizon: 1,
    participationRevisionId: 'synthetic-participation', cutoffAt: '2026-11-02T22:00:00Z', issuedAt: '2026-11-02T22:05:00Z',
    scheduledAt: '2026-11-03T00:00:00Z', value: { unconditionalMean: 2.5 } }],
  outcomes: [{ player_id: 1, game_id: 2026020232, shots_es: 2, shots_pp: 1, shots_pk: 0, updated_at: '2026-11-03T03:00:00Z' }],
});
async function main() {
  const importModule = new Function('path', 'return import(path)');
  const { normalizeSettlement } = await importModule(root + '/qualification-capture/normalize-settlement.mjs');
  const { checkReadbacks } = await importModule(root + '/qualification-readbacks/tooling/check-readbacks.mjs');
  if (process.argv[2] === 'timezone-child') {
    const i=fixture(); const capture={date:i.capture.date, observedAt:'2026-11-02T18:00:00', gameIds:i.capture.gameIds};
    const b={publishedForecastsEnabled:true,contractVersion:2,dateUsed:capture.date,resolvedDate:capture.date,fallbackApplied:false,
      gameRevisions:[{gameId:2026020232,revisionId:'synthetic',modelMode:'baseline',codeVersion:'a'.repeat(40),inputCutoff:i.issued[0].cutoffAt}],
      players:[{player_id:1,game_id:2026020232,proj_shots:2.5,forecast:{expected:{SHOTS_ON_GOAL:2.5},conditioning:'unconditional'}}]};
    const rows=normalizeStartChartReadback(b,capture);
    const report=checkReadbacks({issued:i.issued,consumers:{start_chart:rows}});
    console.log(JSON.stringify({TZ:process.env.TZ,acceptedCapture:true,observedAt:rows[0].observedAt,interpretedUTC:new Date(rows[0].observedAt).toISOString(),summary:report.summary}));
    return;
  }
  const dst=[];
  for (const [date,next,noon] of [['2026-10-31','2026-11-01',17],['2027-03-13','2027-03-14',16],['2027-01-15','2027-01-16',17],['2027-07-01','2027-07-02',16]]) {
    const i=fixture(); i.capture.date=i.issued[0].gameDate=date;
    i.issued[0].issuedAt=date+'T22:05:00Z'; i.issued[0].scheduledAt=next+'T00:00:00Z'; i.outcomes[0].updated_at=next+'T03:00:00Z';
    i.capture.observedAt=next+'T'+String(noon-1).padStart(2,'0')+':59:59Z';
    assert.throws(()=>normalizeSettlement(i),/declared_read_window/);
    i.capture.observedAt=next+'T'+noon+':00:00Z'; assert.equal(normalizeSettlement(i).rows[0].actual,3);
    dst.push({date,beforeNoonRejected:true,atNoonAcceptedUTC:i.capture.observedAt});
  }
  for (const field of ['shots_es','shots_pp','shots_pk']) { const i=fixture();delete i.outcomes[0][field];assert.equal(normalizeSettlement(i).rows[0].actual,null); }
  for (const value of [true,false,-0.5]) { const i=fixture();i.outcomes[0].shots_es=value;assert.throws(()=>normalizeSettlement(i),/shots_invalid/); }
  const overflow=fixture();overflow.outcomes[0].shots_es=Number.MAX_SAFE_INTEGER;assert.throws(()=>normalizeSettlement(overflow),/total_invalid/);
  const identity=fixture();identity.outcomes.push({...identity.outcomes[0],player_id:'1'});assert.throws(()=>normalizeSettlement(identity),/duplicate_settlement_source/);
  const timezone=[];
  for (const TZ of ['UTC','America/New_York']) {
    const p=spawnSync(process.execPath,['-r','ts-node/register','-r','tsconfig-paths/register',__filename,'timezone-child'],{encoding:'utf8',env:{...process.env,TZ}});
    assert.equal(p.status,0,p.stderr);timezone.push(JSON.parse(p.stdout));
  }
  assert.equal(timezone[0].summary.pass,false); assert.equal(timezone[1].summary.pass,true);
  const impossible=fixture();impossible.capture.date=impossible.issued[0].gameDate='2026-11-30';
  impossible.issued[0].cutoffAt='2026-11-30T22:00:00Z';impossible.issued[0].issuedAt='2026-11-30T22:05:00Z';impossible.issued[0].scheduledAt='2026-12-01T00:00:00Z';
  impossible.capture.observedAt='2026-11-31T17:00:00Z';impossible.outcomes[0].updated_at='2026-11-31T03:00:00Z';
  const invalid=normalizeSettlement(impossible);
  const readback={...impossible.issued[0],observedAt:'2026-11-30T23:00:00Z'};
  const invalidReport=checkReadbacks({issued:impossible.issued,consumers:{rso:[readback],start_chart:[readback]},settlement:invalid.rows});
  assert.equal(invalidReport.summary.pass,true);assert.equal(invalidReport.summary.settled,1);
  const cli=spawnSync(process.execPath,[root+'/qualification-capture/normalize-settlement.mjs'],{encoding:'utf8'});
  assert.equal(cli.status,1);assert.equal(cli.stdout,'');
  console.log(JSON.stringify({dst,missingComponentKeysRemainUnknown:true,booleanFractionalAndOverflowCountsRejected:true,canonicalDuplicateIdsRejected:true,invalidCliExitWithoutRows:true,timezoneDependence:timezone,impossibleCalendarTimestamp:{rows:invalid.rows,interpretedCaptureUTC:new Date(impossible.capture.observedAt).toISOString(),checker:invalidReport.summary}},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});

const assert=require('node:assert/strict');
const {normalizeStartChartReadback,normalizeRsoReadback}=require('../../rso-resume-2026-11-01/release-prep/qualification-capture/normalize-readbacks.ts');
const root='/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-resume-2026-11-01/release-prep';
const fixture=()=>({capture:{date:'2026-11-02',observedAt:'2026-11-03T17:00:00Z',gameIds:[2026020232],settlementVersion:1},issued:[{
  playerId:'1',gameId:'2026020232',target:'SHOTS_ON_GOAL',gameDate:'2026-11-02',revisionId:'synthetic',method:'baseline',codeVersion:'a'.repeat(40),configurationHash:'b'.repeat(64),artifactHash:'c'.repeat(64),horizon:1,
  participationRevisionId:'synthetic-participation',cutoffAt:'2026-11-02T22:00:00Z',issuedAt:'2026-11-02T22:05:00Z',scheduledAt:'2026-11-03T00:00:00Z',value:{unconditionalMean:2.5}}],
  outcomes:[{player_id:1,game_id:2026020232,shots_es:2,shots_pp:1,shots_pk:0,updated_at:'2026-11-03T03:00:00Z'}]});
const board=i=>({publishedForecastsEnabled:true,contractVersion:2,dateUsed:i.capture.date,resolvedDate:i.capture.date,fallbackApplied:false,
  gameRevisions:[{gameId:2026020232,revisionId:'synthetic',modelMode:'baseline',codeVersion:'a'.repeat(40),inputCutoff:i.issued[0].cutoffAt}],
  players:[{player_id:1,game_id:2026020232,proj_shots:2.5,forecast:{expected:{SHOTS_ON_GOAL:2.5},conditioning:'unconditional'}}]});
const rejected=(fn,pattern)=>{let error;try{fn()}catch(e){error=e.message}assert.match(error||'',pattern);return error};
async function main(){
  const load=new Function('path','return import(path)');
  const {normalizeSettlement}=await load(root+'/qualification-capture/normalize-settlement.mjs');
  const {checkReadbacks}=await load(root+'/qualification-readbacks/tooling/check-readbacks.mjs');
  const i=fixture(),badCapture={date:i.capture.date,gameIds:i.capture.gameIds,observedAt:'2026-11-02T18:00:00'};
  const originalP2={startChart:rejected(()=>normalizeStartChartReadback(board(i),badCapture),/capture_time/),rso:rejected(()=>normalizeRsoReadback({},badCapture),/capture_time/)};
  const impossible=fixture();impossible.capture.date=impossible.issued[0].gameDate='2026-11-30';impossible.issued[0].issuedAt='2026-11-30T22:05:00Z';impossible.issued[0].scheduledAt='2026-12-01T00:00:00Z';impossible.capture.observedAt='2026-11-31T17:00:00Z';impossible.outcomes[0].updated_at='2026-11-31T03:00:00Z';
  const originalP3=rejected(()=>normalizeSettlement(impossible),/capture_time_invalid/);
  const offset={date:i.capture.date,gameIds:i.capture.gameIds,observedAt:'2026-11-02T18:00:00.123456-05:00'};
  const validReadback=normalizeStartChartReadback(board(i),offset);assert.equal(validReadback[0].observedAt,offset.observedAt);
  const invalidDates=[];
  for(const value of ['2026-11-31T17:00:00Z','2027-02-29T17:00:00Z','2028-02-30T17:00:00Z','2026-13-01T17:00:00Z','2026-11-03T17:00:00.1234567Z']){
    const x=fixture();x.capture.observedAt=value;invalidDates.push(rejected(()=>normalizeSettlement(x),/capture_time_invalid/));
  }
  const leap=fixture();leap.capture.date=leap.issued[0].gameDate='2028-02-28';leap.capture.observedAt='2028-02-29T12:00:00-05:00';leap.issued[0].issuedAt='2028-02-28T22:05:00Z';leap.issued[0].scheduledAt='2028-02-29T00:00:00Z';leap.outcomes[0].updated_at='2028-02-29T03:00:00.123456Z';assert.equal(normalizeSettlement(leap).rows[0].actual,3);
  const micro=fixture();micro.capture.observedAt='2026-11-03T17:00:00.000001Z';micro.outcomes[0].updated_at='2026-11-03T17:00:00.000002Z';
  const microFuture=rejected(()=>normalizeSettlement(micro),/source_from_future/);
  micro.outcomes[0].updated_at=micro.capture.observedAt;assert.equal(normalizeSettlement(micro).rows[0].actual,3);
  micro.outcomes[0].updated_at='2026-11-03T00:00:00.000001Z';
  const settlement=normalizeSettlement(micro).rows;assert.equal(settlement[0].actual,3);
  const readback={...micro.issued[0],observedAt:'2026-11-02T23:00:00Z'};
  const settlementCheck=checkReadbacks({issued:micro.issued,consumers:{rso:[readback],start_chart:[readback]},settlement});
  assert.equal(settlementCheck.summary.pass,false);assert.equal(settlementCheck.summary.findingCodes.settlement_before_game,1);
  const e2=fixture();e2.issued[0].issuedAt='2026-11-02T22:05:00.000002Z';
  const e2Capture={date:e2.capture.date,gameIds:e2.capture.gameIds,observedAt:'2026-11-02T22:05:00.000001Z'};
  const e2Rows=normalizeStartChartReadback(board(e2),e2Capture);
  const readbackCheck=checkReadbacks({issued:e2.issued,consumers:{start_chart:e2Rows}});assert.equal(readbackCheck.summary.pass,true);
  console.log(JSON.stringify({TZ:process.env.TZ,originalP2,originalP3,validOffsetRetained:validReadback[0].observedAt,invalidDatesRejected:invalidDates.length,leapDayAccepted:true,microsecondFutureRejected:microFuture,microsecondEqualityAccepted:true,
    downstreamPrecision:{preIssueReadback:{issuedAt:e2.issued[0].issuedAt,observedAt:e2Rows[0].observedAt,summary:readbackCheck.summary},postStartSettlement:{scheduledAt:micro.issued[0].scheduledAt,recordedAt:settlement[0].recordedAt,adapterActual:settlement[0].actual,summary:settlementCheck.summary}}},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});

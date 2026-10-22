const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = '/workspace/shared/fhfhockey.com/web';
const {computeSosRatings} = require(root+'/lib/trends/strengthOfSchedule.ts');
const {computeUnderlyingStatsTeamScheduleStrength} = require(root+'/lib/underlying-stats/teamScheduleStrength.ts');
const date='2026-10-20';
function row(team,id,w,l,otl,opponent) { return {season_id:20262027,team_abbrev:team,team_id:id,game_date:date,past_opponent_total_wins:w,past_opponent_total_losses:l,past_opponent_total_ot_losses:otl,future_opponent_total_wins:0,future_opponent_total_losses:0,future_opponent_total_ot_losses:0,past_opponents:opponent?[{opponent,date:'2026-10-10'}]:[],future_opponents:[]}; }
// Controlled descriptive snapshots, not an internally reconstructed season/game ledger.
const rows=[row('TOR',10,5,5,0,'BOS'),row('MTL',8,4,0,6,'NYR'),row('BOS',6,5,5,0),row('NYR',3,5,5,0)];
const trends=computeSosRatings(rows);const underlying=computeUnderlyingStatsTeamScheduleStrength({date,scheduleRows:rows});
const a=trends.find(r=>r.team==='TOR').past.winPct;const b=trends.find(r=>r.team==='MTL').past.winPct;
const aa=underlying.get('TOR').past.sos;const bb=underlying.get('MTL').past.sos;
assert(a>b);assert(aa<bb);
const empty=[row('SEA',55,0,0,0)];
const emptyTrend=computeSosRatings(empty)[0].past.winPct;const emptyUnderlying=computeUnderlyingStatsTeamScheduleStrength({date,scheduleRows:empty}).get('SEA').past.sos;
assert.equal(emptyTrend,0);assert.equal(emptyUnderlying,null);
const guard=globalThis.__FHFH_OFFLINE_GUARD;assert.equal(guard.blockedClientCreates,0);assert.equal(guard.blockedEnvLoads,0);assert.deepEqual(guard.blockedNetwork,[]);
const result={kind:'actual_export_SOS_definition_counterexample',scope:'Synthetic snapshot-shaped fixtures only, no season reconstruction, DB or network.',comparison:{trendsWinPct:{TOR:a,MTL:b},underlyingPointsTwoHop:{TOR:aa,MTL:bb},rankOrderReverses:true},empty:{trends:emptyTrend,underlying:emptyUnderlying},guard,limitation:'Different definitions can legitimately rank differently; this proves ambiguous cross-surface SOS semantics, not which metric predicts NHL outcomes better.'};
fs.writeFileSync('/workspace/shared/fhfh-research-2026-10-20/SOS-DEFINITION-FIXTURE.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

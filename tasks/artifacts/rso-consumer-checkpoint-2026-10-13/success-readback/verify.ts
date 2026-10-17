import fs from 'node:fs';
import crypto from 'node:crypto';
import { normalizePlanningGames } from '../../../../web/lib/rosterScheduleData/planningInputs';

const directory = process.argv[2];
const data = JSON.parse(fs.readFileSync(`${directory}/database-readback.json`, 'utf8'));
const rows = data.rows;
const expectedIds = Array.from({length:57}, (_,i) => 2026020084+i);
const expectedHash = 'cd6c7d7ea561a3aaafc9fd7a5289beda09572e4adf6767feefec9f5ce3731adf';
const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
assert(rows.length === 114, 'Expected 114 rows');
const ids = [...new Set<number>(rows.map((r:any) => r.source_game_id))].sort((a,b)=>a-b);
assert(JSON.stringify(ids) === JSON.stringify(expectedIds), 'Exact game IDs mismatch');
for (const id of ids) {
  const sides = rows.filter((r:any)=>r.source_game_id===id);
  const home = sides.find((r:any)=>r.home_away==='home');
  const away = sides.find((r:any)=>r.home_away==='away');
  assert(sides.length===2 && home && away && home.team_id===away.opponent_team_id && away.team_id===home.opponent_team_id, 'Reciprocal sides mismatch');
}
assert(rows.every((r:any)=>r.game_key==='477' && r.season==='2026' && r.source_season_id===20262027 && r.game_date>='2026-10-11' && r.game_date<='2026-10-19' && r.mapping_status==='mapped' && r.is_countable===true), 'Stored bounds/mapping/countability mismatch');
// Reconstruct the deployed normalizer's exact property order and timestamp representation.
// PostgreSQL adds id/inserted_at/updated_at and JSONB reorders keys; those were never hashed.
const keys = ['yahoo_matchup_week_id','game_key','season','week','source_game_id','source_season_id','game_date','start_time','game_type','game_status','schedule_status','mapping_status','is_countable','source_url','source_updated_at','source_metadata','team_id','team_abbreviation','opponent_team_id','opponent_abbreviation','home_away'];
const metadataKeys = ['canonicalDateSource','mappingReason','venue','venueUTCOffset','easternUTCOffset','syncMode'];
const content = rows.map((row:any)=>Object.fromEntries(keys.map(key=>[key,
  ['start_time','source_updated_at'].includes(key) ? (row[key]===null ? null : new Date(row[key]).toISOString()) :
  key==='source_metadata' ? Object.fromEntries(metadataKeys.map(k=>[k,row[key][k]])) : row[key]
])));
const hashed = {version:'rso-refresh-scope-v1',mode:'bounded',gameKey:'477',startDate:'2026-10-11',endDate:'2026-10-19',seasonId:20262027,gameIds:expectedIds,maxSides:114,rows:content};
const hash = crypto.createHash('sha256').update(JSON.stringify(hashed)).digest('hex');
assert(hash===expectedHash, 'Stored normalized content hash mismatch');
const audit = data.audits.find((a:any)=>a.status==='success' && a.rows_affected===114);
const response = JSON.parse(audit.details.response);
assert(response.data.scope.scopeHash===hash && response.data.rowsDeleted===0 && response.finalAudit.status==='persisted', 'Success audit mismatch');
const timeZone = 'America/Chicago';
const games = normalizePlanningGames(rows,timeZone).filter(g=>g.date>='2026-10-12' && g.date<='2026-10-18');
const gameIds = [...new Set(games.map(g=>g.id))];
const freshnessSeconds = (Date.parse(data.observedAt)-Date.parse(rows[0].fetched_at))/1000;
assert(rows.every((r:any)=>r.fetched_at===rows[0].fetched_at) && freshnessSeconds>=0 && freshnessSeconds<36*3600,'Freshness mismatch');
const byDate:Record<string,number> = {};
const byTeam:Record<string,number> = {};
for(const g of games){byDate[g.date]=(byDate[g.date]??0)+1;byTeam[g.teamAbbreviation]=(byTeam[g.teamAbbreviation]??0)+1;}
const result = {observedAt:data.observedAt,expectedRows:114,actualRows:rows.length,exact57GameIdsMatch:true,reciprocalSides:true,allBoundsMatch:true,allMappedCountable:true,reconstructedStoredScopeHash:hash,scopeHashMatchesUserInspection:true,fetchedAt:rows[0].fetched_at,freshnessSeconds,reader36HourFreshnessPass:true,audit:{runTime:audit.run_time,status:audit.status,rowsAffected:audit.rows_affected,rowsDeleted:response.data.rowsDeleted,finalAudit:response.finalAudit},consumerReplay:{source:'actual normalizePlanningGames on stored rows; no HTTP/provider/DB writes',timeZone,startDate:'2026-10-12',endDate:'2026-10-18',uniqueGames:gameIds.length,teamGameCells:games.length,byDate,byTeam,allStartTimesKnown:games.every(g=>g.startsAt!==null)},changes:response.data.changes};
fs.writeFileSync(`${directory}/verification.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

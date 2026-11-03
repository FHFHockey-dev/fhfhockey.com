// Owner-authorized bounded current observation. Default TLS verification; no redirects/retries.
import https from 'node:https';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dest=path.join(path.dirname(fileURLToPath(import.meta.url)),'current-snapshot-15');
await mkdir(dest,{recursive:true});
const approval={sourceThread:'01a16eed-60f6-7096-879f-696c469db015',scope:'TJ explicitly requested current player data; bounded ordinary public NHL reads authorized by current delegation. One exact three-GET Kucherov/TBL batch; no retries or redirects.'};
const started=performance.now(),receipt={startedAt:new Date().toISOString(),approval,client:'node:https; rejectUnauthorized:true; no custom trust store',calls:[],limits:{requests:3,concurrency:1,requestMs:5000,totalMs:15000,bytesPerResponse:524288,totalBytes:1572864,gameLogRows:100,scheduleRows:140,redirects:0,retries:0},status:'started',totalBytes:0,databaseReads:0,remoteWrites:0,authOrProfileChanges:0};
await writeFile(path.join(dest,'EXECUTION-INTENT.json'),JSON.stringify({startedAt:receipt.startedAt,approval,oneExecution:true},null,2),{flag:'wx'});
const save=()=>writeFile(path.join(dest,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
async function get(name,url){
 const call={name,url,startedAt:new Date().toISOString(),bytes:0,status:'started'};receipt.calls.push(call);await save();
 const remaining=15000-(performance.now()-started);if(remaining<=0)throw Error('Overall limit reached');
 const raw=await new Promise((resolve,reject)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(5000,remaining)),chunks=[];
  const req=https.get(url,{agent:false,rejectUnauthorized:true,signal:controller.signal,headers:{Accept:'application/json','User-Agent':'fhfhockey-player-cards/1.0'}},res=>{
   call.httpStatus=res.statusCode;
   if(res.statusCode!==200||!String(res.headers['content-type']).includes('application/json')||Number(res.headers['content-length']||0)>524288){res.destroy();reject(Error('Unexpected status/content-type/announced size; no redirect'));return;}
   res.on('data',part=>{call.bytes+=part.length;receipt.totalBytes+=part.length;if(call.bytes>524288||receipt.totalBytes>1572864){req.destroy(Error('Byte cap exceeded'));return;}chunks.push(part);});
   res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
  });req.on('error',reject);req.on('close',()=>clearTimeout(timer));
 });
 await writeFile(path.join(dest,name+'.json'),raw,{flag:'wx'});call.sha256=createHash('sha256').update(raw).digest('hex');call.status='received';call.finishedAt=new Date().toISOString();await save();return JSON.parse(raw.toString('utf8'));
}
try{
 const identity=await get('landing','https://api-web.nhle.com/v1/player/8476453/landing');
 if(identity.playerId!==8476453||identity.currentTeamAbbrev!=='TBL')throw Error('Player/team mismatch; stopped before next URL');
 const seasons=(identity.seasonTotals||[]).filter(r=>r.season===20262027&&r.gameTypeId===2&&r.leagueAbbrev==='NHL');if(seasons.length!==1||!Number.isInteger(seasons[0].gamesPlayed))throw Error('Season appearance total unavailable; stopped');
 const history=await get('game-log','https://api-web.nhle.com/v1/player/8476453/game-log/20262027/2');
 if(history.seasonId!==20262027||history.gameTypeId!==2||!Array.isArray(history.gameLog)||history.gameLog.length>100||seasons[0].gamesPlayed!==history.gameLog.length)throw Error('History identity/count mismatch; stopped');
 const schedule=await get('team-schedule','https://api-web.nhle.com/v1/club-schedule-season/TBL/20262027');
 if(schedule.currentSeason!==20262027||!Array.isArray(schedule.games)||schedule.games.length>140)throw Error('Schedule scope mismatch');
 const ids=history.gameLog.map(r=>r.gameId);if(new Set(ids).size!==ids.length)throw Error('Duplicate game identities');
 for(const row of history.gameLog){const matches=schedule.games.filter(g=>g.id===row.gameId),g=matches[0];if(matches.length!==1||g.season!==20262027||g.gameType!==2||g.gameDate!==row.gameDate||!['OFF','FINAL'].includes(g.gameState)||![g.homeTeam?.abbrev,g.awayTeam?.abbrev].includes(row.teamAbbrev))throw Error('Final schedule/game/date/team mismatch');}
 Object.assign(receipt,{status:'received-and-identity-validated',seasonGp:seasons[0].gamesPlayed,gameLogRows:history.gameLog.length,scheduleRows:schedule.games.length,actualGameEndsQualified:false,leagueRanksQualified:false});
}catch(e){receipt.status='stopped';receipt.error=String(e);receipt.furtherRetryPermitted=false;}
finally{receipt.finishedAt=new Date().toISOString();receipt.elapsedMs=Math.round(performance.now()-started);receipt.callsStarted=receipt.calls.length;await save();console.log(JSON.stringify(receipt));}

// Loopback preview transport only. Application qualification remains in currentNhl.server.ts.
import https from 'node:https';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';

const sourcePath=/^\/(?:player\/[1-9]\d{6}\/(?:landing|game-log\/\d{8}\/2)|club-schedule-season\/[A-Z]{2,3}\/\d{8})$/;
export async function readSecureNhlJson(source,signal,{get=https.get,onResponse=async()=>{}}={}){
 if(!sourcePath.test(source))throw new Error('Unsupported NHL source path.');
 const startedAt=new Date().toISOString();
 const bytes=await new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  const request=get('https://api-web.nhle.com/v1'+source,{agent:false,rejectUnauthorized:true,signal,headers:{Accept:'application/json','User-Agent':'fhfhockey-player-cards/1.0'}},response=>{
   if(response.statusCode!==200||!String(response.headers['content-type']).includes('application/json')||Number(response.headers['content-length']||0)>524288){response.destroy();reject(new Error(`NHL source returned status ${response.statusCode} or unsupported content. No redirect or retry performed.`));return;}
   response.on('data',part=>{size+=part.length;if(size>524288){const error=new Error('NHL response exceeded 512 KiB.');reject(error);request.destroy(error);response.destroy();return;}chunks.push(part);});
   response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
  });request.on('error',reject);
 });
 const parsed=JSON.parse(bytes.toString('utf8'));
 await onResponse({source,startedAt,finishedAt:new Date().toISOString(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},bytes);
 return parsed;
}
export function createLiveLoader(provider,{reader=readSecureNhlJson,directory,now=()=>Date.now(),maxMinuteReads=12,maxSessionReads=60}={}){
 const cache=new Map(),timestamps=[];let busy=false,totalReads=0;
 return async request=>{
  const key=`${request.playerId}:${request.season}`,cached=cache.get(key);
  const view=card=>{const selected=card.windows?.find(v=>v.request.count===request.count);if(!selected)throw new Error('Captured window unavailable.');return {...selected,windows:card.windows};};
  if(cached&&now()-cached.at<300000)return{card:view(cached.card),cacheHit:true,sourceReads:0};
  if(busy)throw new Error('Another player is loading. Wait for it to finish, then try again.');
  while(timestamps.length&&now()-timestamps[0]>=60000)timestamps.shift();
  if(timestamps.length+3>maxMinuteReads)throw new Error('Local preview read limit reached. Wait one minute before loading another player.');
  if(totalReads+3>maxSessionReads)throw new Error('Local preview source budget reached. Previously loaded cards remain available.');
  busy=true;
  const receipt={id:randomUUID(),startedAt:new Date(now()).toISOString(),request,limits:{requests:3,requestMs:5000,totalMs:15000,bytesPerResponse:524288,concurrency:1,retries:0,redirects:0},calls:[],status:'started',sourceReads:0,remoteWrites:0};
  const folder=directory?path.join(directory,receipt.id):null;
  const save=async()=>{if(folder)await writeFile(path.join(folder,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');};
  try{
   if(folder){await mkdir(folder,{recursive:false});await save();}
   const card=await provider(request,async(source,signal)=>{
    if(receipt.sourceReads>=3)throw new Error('Source request bound exceeded.');
    totalReads++;timestamps.push(now());receipt.sourceReads++;const call={source,status:'started'};receipt.calls.push(call);await save();
    try{return await reader(source,signal,{onResponse:async(metadata,bytes)=>{Object.assign(call,metadata,{status:'received'});if(folder)await writeFile(path.join(folder,`${receipt.sourceReads}.json`),bytes,{flag:'wx'});await save();}});}
    catch(error){call.status='failed';call.error=String(error);throw error;}
   },()=>new Date(now()),'nhl-current');
   receipt.status='qualified-response';receipt.observedAt=card.observedAt;receipt.cardState=card.state;receipt.issues=card.issues;receipt.finishedAt=new Date(now()).toISOString();
   if(folder)await writeFile(path.join(folder,'CARD.json'),JSON.stringify(card,null,2)+'\n');await save();
   if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),card});
   return{card,cacheHit:false,sourceReads:receipt.sourceReads,receiptId:receipt.id};
  }catch(error){receipt.status='failed';receipt.error=String(error);receipt.finishedAt=new Date(now()).toISOString();await save();
   if(/CERT|TLS|certificate/i.test(String(error)))throw new Error('Secure NHL connection failed certificate verification. No substitute data or insecure retry was used.');
   throw error;
  }finally{busy=false;}
 };
}

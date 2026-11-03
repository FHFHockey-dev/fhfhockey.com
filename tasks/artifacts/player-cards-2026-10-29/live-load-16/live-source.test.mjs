import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';import {EventEmitter} from 'node:events';
import {createLiveLoader,readSecureNhlJson} from './live-source.mjs';
const request={playerId:8484387,season:20262027,count:5};
const card=r=>({request:r,observedAt:'2026-10-29T19:00:00Z',state:'ready',issues:[],windows:[5,10,20].map(count=>({request:{...r,count},observedAt:'2026-10-29T19:00:00Z',state:'ready'}))});
test('isolates selected players, caches same-capture windows and makes no automatic retry',async()=>{
 let reads=0,now=0;const paths=[];
 const loader=createLiveLoader(async(r,read)=>{await read(`/player/${r.playerId}/landing`);return card(r);},{reader:async p=>{reads++;paths.push(p);return{};},now:()=>now});
 assert.equal((await loader(request)).sourceReads,1);assert.equal((await loader({...request,count:10})).cacheHit,true);assert.equal(reads,1);
 assert.equal((await loader({...request,playerId:8478439})).card.request.playerId,8478439);assert.equal(reads,2);assert.notEqual(paths[0],paths[1]);
 now=300001;await loader(request);assert.equal(reads,3);
 const failed=createLiveLoader(async(r,read)=>{await read(`/player/${r.playerId}/landing`);throw new Error('must not reach');},{reader:async()=>{throw new Error('CERT_HAS_EXPIRED');}});
 await assert.rejects(failed(request),/certificate verification/);
});
test('serializes active loads and applies explicit preview budget instead of source fanout',async()=>{
 let finish;const hold=new Promise(resolve=>finish=resolve);let calls=0;
 const loader=createLiveLoader(async(r,read)=>{await read(`/player/${r.playerId}/landing`);await hold;return card(r);},{reader:async()=>{calls++;return{};},maxSessionReads:3});
 const pending=loader(request);await assert.rejects(loader({...request,playerId:8478439}),/Another player/);finish();await pending;
 await assert.rejects(loader({...request,playerId:8478439}),/budget/);assert.equal(calls,1);
});
function mockGet(body,status=200){return(url,options,callback)=>{assert.ok(url.startsWith('https://api-web.nhle.com/v1/player/'));assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);assert.ok(options.signal instanceof AbortSignal);const req=new EventEmitter();req.destroy=e=>queueMicrotask(()=>req.emit('error',e));queueMicrotask(()=>{const res=Readable.from([Buffer.from(body)]);res.statusCode=status;res.headers={'content-type':'application/json'};callback(res);});return req;};}
test('secure transport verifies certificates, fixed paths, bytes and refuses redirects',async()=>{
 const signal=AbortSignal.timeout(1000),reports=[];
 assert.deepEqual(await readSecureNhlJson('/player/8484387/landing',signal,{get:mockGet('{"playerId":8484387}'),onResponse:async meta=>reports.push(meta)}),{playerId:8484387});assert.equal(reports.length,1);assert.equal(reports[0].bytes,20);
 await assert.rejects(readSecureNhlJson('//evil.example',signal,{get:()=>{throw new Error('must not run');}}),/Unsupported/);
 await assert.rejects(readSecureNhlJson('/player/8484387/landing',signal,{get:mockGet('{}',302)}),/No redirect/);
 await assert.rejects(readSecureNhlJson('/player/8484387/landing',signal,{get:mockGet('x'.repeat(524289))}),/512 KiB/);
});

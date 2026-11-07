import {createRequire} from 'node:module';import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath}from'node:url';import path from'node:path';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const own=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(own,'../../../..'),packet=path.join(own,'../portrait-treatments-01');const require=createRequire(path.join(repo,'web/package.json')),sharp=require('sharp');
const source=await sharp(path.join(repo,'web/public/player-cards/hero-samples/8478864.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});const results=[];let body,snapshot;
for(const style of ['posterized','pixelated','team-colors']){
 const bytes=readFileSync(path.join(packet,style+'-portrait.png')),m=JSON.parse(readFileSync(path.join(packet,style+'-manifest.json'))),p=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(p.info.width,source.info.width);assert.equal(p.info.height,source.info.height);let alphaDifferences=0,rgbDifferences=0;for(let i=0;i<p.data.length;i++)if(p.data[i]!==source.data[i]){if(i%4===3)alphaDifferences++;else rgbDifferences++;}assert.equal(alphaDifferences,0);assert.ok(rgbDifferences>0);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.artwork.treatment.renderedSha256);
 assert.equal(m.artwork.id,8478864);assert.equal(m.liveActivation,false);assert.equal(m.premiumActivation,false);assert.equal(m.statistics.representsPicturedPlayer,false);if(snapshot)assert.deepEqual(m.snapshot,snapshot);else snapshot=m.snapshot;
 const card=sharp(path.join(packet,style+'-card.png'));const meta=await card.metadata();assert.equal(meta.width,1200);assert.equal(meta.height,1020);const pixels=await card.extract({left:0,top:338,width:1200,height:682}).raw().toBuffer();if(body)assert.deepEqual(pixels,body);else body=pixels;
 results.push({style,dimensions:[p.info.width,p.info.height],alphaDifferences,rgbDifferences,manifestHashMatches:true,analyticsPixelsMatch:true});
}
assert.deepEqual(readFileSync(path.join(packet,'share-fallback.png')),readFileSync(path.join(packet,'reload-card.png')));
writeFileSync(path.join(own,'pixel-results.json'),JSON.stringify({results,shareFallbackEqualsReload:true,scope:'Readbacks of frozen existing PNGs; no browser rerun'},null,2)+'\n');console.log(JSON.stringify(results));

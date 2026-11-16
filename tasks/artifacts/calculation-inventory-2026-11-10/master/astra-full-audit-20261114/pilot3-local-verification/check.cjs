const fs=require('fs'),cp=require('child_process'),vm=require('vm'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),assert=require('assert');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const root='/Users/tim/forge-pilot/capture-2026020328-20261115T201009Z';
const pin='29451c57304866d54abd2a3302625f0696472ab0', cache={},sourceHashes={};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function load(name){
 if(name==='node:crypto')return crypto;
 if(!['der','rfc3161','tsaProfiles'].includes(name))throw Error('Unapproved module '+name);
 if(cache[name])return cache[name].exports;
 const source=cp.execFileSync('git',['show',pin+':web/lib/projections/pregameCapture/'+name+'.ts']).toString();sourceHashes[name]=sha(source);
 const m={exports:{}};cache[name]=m;
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,Buffer,require:x=>load(x.replace(/^\.\//,''))},{timeout:3000});return m.exports;
}
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)]));return x}
const receipt=JSON.parse(fs.readFileSync(path.join(root,'capture-receipt.json'),'utf8'));
const post=JSON.parse(fs.readFileSync(path.join(root,'postrun-verify.json'),'utf8'));
const bytes=fs.readFileSync(path.join(root,'committed-packet.json.gz'));
const json=zlib.gunzipSync(bytes,{maxOutputLength:512*1024*1024}).toString('utf8');const packet=JSON.parse(json);
const statementText=fs.readFileSync(path.join(root,'witness-statement.json'),'utf8'), statement=JSON.parse(statementText);
const token=fs.readFileSync(path.join(root,'witness-token.der'));
assert.equal(JSON.stringify(canonical(packet)),json);assert.equal(JSON.stringify(canonical(statement)),statementText);
assert.equal(sha(bytes),statement.rawSha256);assert.equal(sha(json),statement.canonicalSha256);assert.equal(bytes.length,statement.byteLength);
assert.equal(statement.rawSha256,post.packet.rawSha256);assert.equal(statement.canonicalSha256,post.packet.canonicalSha256);assert.equal(sha(statementText),post.statementSha256);
assert.equal(packet.binding.claimId,statement.claimId);assert.equal(statement.claimId,receipt.claimId);assert.equal(statement.rowVersion,post.rowVersion);
assert.equal(packet.binding.codeVersion,pin);assert.equal(String(packet.binding.gameId),statement.gameId);assert.equal(statement.policyId,packet.binding.policyId);
assert.equal(packet.binding.gameId,2026020328);assert.equal(packet.binding.slateDate,'2026-11-15');assert.equal(packet.reads.length,133);
const profiles=load('tsaProfiles'),trust=profiles.trustFromProfile(profiles.tsaProfile('digicert-g4-v1'),'capture');
const stamp=load('rfc3161').verifyTimeStampToken(token,{sha256Digest:Buffer.from(sha(statementText),'hex'),nonce:BigInt(statement.nonce)},trust);
const bound=new Date(Number(stamp.upperMicros/1000n)).toISOString();assert.equal(bound,'2026-11-15T20:11:33.000Z');
assert(stamp.upperMicros<=BigInt(Date.parse(post.ackDeadline))*1000n);assert.equal(stamp.tokenSha256,post.reverify.tokenSha256);assert.equal(stamp.signerSha256,post.reverify.signerSha256);
const result={approvedBy:'TJ direct reply call_2beaf6a2f149491c99bee823cd9e74d4',candidate:pin,passed:true,sourceHashes,openssl:{version:'OpenSSL 4.1.0 23 Oct 2026',observedResult:'Verification: OK',mode:'ts -verify -token_in -data witness-statement.json -CAfile candidate-pinned public root; no external call'},checks:['raw packet hash matches signed statement and retained metadata','canonical packet hash matches signed statement','canonical statement hash matches retained metadata','byte length, claim, game, policy, row version and exact candidate binding match','nonce and imprint verified by exact candidate verifier','conservative timestamp upper bound within recorded T-minus-60'],hashes:{rawPacket:sha(bytes),canonicalPacket:sha(json),statement:sha(statementText),token:sha(token),signer:stamp.signerSha256},timestamp:{upperBound:bound,withinRecordedDeadline:true,accuracyMicros:stamp.accuracyMicros.toString(),resolutionMicros:stamp.resolutionMicros.toString()},boundary:'Local retained files only. This verifies retained cryptographic custody, not a fresh database read, current row immutability, model correctness, forecast qualification or release approval. No private payload reproduced.'};
fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/pilot3-local-verification/result.json',JSON.stringify(result,null,2)+'\n');console.log({passed:true,hashes:result.hashes,timestamp:result.timestamp});

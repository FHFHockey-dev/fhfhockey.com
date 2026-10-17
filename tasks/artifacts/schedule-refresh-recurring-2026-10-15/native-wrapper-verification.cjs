// Focused native wrapper integration. The candidate, auth, audit and timing
// modules execute unchanged; Supabase/auth/NHL transports remain synthetic.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const BASE = __dirname, ROOT = path.resolve(BASE, '../../..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(path.join(BASE,'FROZEN-V2.json')), '2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41');
const freeze = JSON.parse(fs.readFileSync(path.join(BASE,'FROZEN-V2.json')));
for (const [file,hash] of Object.entries(freeze.files)) assert.equal(sha(path.join(BASE,file)),hash,file);
const sourcePins = JSON.parse(fs.readFileSync(path.join(BASE,'NATIVE-WRAPPER-PINS.json')));
for (const [file,hash] of Object.entries(sourcePins.sourceSha256)) assert.equal(sha(path.join(ROOT,file)),hash,file);
assert.equal(sha(__filename), sourcePins.harnessSha256);

// Reuse the frozen fixture without registering/rerunning its 32 prior checks.
const fixturePath = path.join(BASE,'verify-offline.cjs');
let fixtureText = fs.readFileSync(fixturePath,'utf8').split("test('selected Oct 12")[0];
function replaceOnce(before, after) {
  assert.equal(fixtureText.split(before).length,2,`Expected one fixture seam: ${before.slice(0,70)}`);
  fixtureText = fixtureText.replace(before,after);
}
replaceOnce('const calls = { pages: [], reads: [], writes: [], rpcs: [], audits: 0, timers: [] };',
  'const calls = { pages: [], reads: [], writes: [], rpcs: [], audits: 0, timers: [], auditRows: [], persistedAuditRows: [], events: [], auth: [], flushes: 0 };');
replaceOnce('const fixed = options.now', `
  const originalFrom = db.from.bind(db);
  db.from = table => table === 'cron_job_audit' ? { insert: async row => {
    calls.audits++; calls.auditRows.push(structuredClone(row)); calls.events.push('audit_submit');
    if (options.onAuditInsert) await options.onAuditInsert(row,calls);
    if (options.auditThrow) throw new Error('synthetic audit transport failure');
    if (options.auditError) return { error: { message: 'synthetic audit insert rejection' } };
    calls.persistedAuditRows.push(structuredClone(row)); calls.events.push('audit_persisted');
    return { error: null };
  } } : originalFrom(table);
  const fixed = options.now`);
replaceOnce('const context = vm.createContext({ Date: Clock,',
  `const context = vm.createContext({ process: { env: { CRON_SECRET: options.cronSecret ?? 'synthetic-recurring-token', NODE_ENV: options.nodeEnv ?? 'production' } }, Date: Clock,`);
replaceOnce("const allowed = relative.startsWith('web/lib/rosterScheduleData/')", `const allowed = [
    'web/lib/cron/withOperationalRouteAuth.ts', 'web/lib/cron/withCronJobAudit.ts',
    'web/lib/cron/timingContract.ts', 'web/lib/cron/formatDuration.ts', 'web/utils/adminOnlyMiddleware.ts'
  ].includes(relative) || relative.startsWith('web/lib/rosterScheduleData/')`);
const shimStart = fixtureText.indexOf("      if (name === 'lib/cron/withOperationalRouteAuth')");
const shimEnd = fixtureText.indexOf("      if (name === 'lib/rosterScheduleData')",shimStart);
assert.ok(shimStart>=0 && shimEnd>shimStart);
fixtureText = fixtureText.slice(0,shimStart) + `
      if (name === 'lib/supabase/server') return { default: db };
      if (name === 'lib/supabase') return { createClientWithToken: token => {
        calls.auth.push('client');
        assert.ok(token.startsWith('synthetic-'), 'Only synthetic bearer credentials allowed');
        return { auth: { getUser: async () => { calls.auth.push('getUser');
          return { data: { user: options.authValid ? { id: 'synthetic-admin' } : null }, error: options.authValid ? null : { message: 'synthetic invalid bearer' } };
        } }, from: table => { assert.equal(table,'users'); return { select: column => {
          assert.equal(column,'role'); return { maybeSingle: async () => { calls.auth.push('role');
            return { data: { role: options.authRole ?? 'viewer' }, error: null };
          } };
        } }; } };
      } };
      if (name === 'lib/cron/withOperationalRouteAuth') return load('web/lib/cron/withOperationalRouteAuth.ts');
      if (name === 'utils/adminOnlyMiddleware') return load('web/utils/adminOnlyMiddleware.ts');
` + fixtureText.slice(shimEnd);
replaceOnce('const res = { statusCode: 200, body: null, status(value)',
  'const res = { statusCode: 200, body: null, headers: {}, headersSent: false, setHeader(key,value) { this.headers[key]=value; }, status(value)');
replaceOnce('json(value) { this.body = value; return this; }',
  "json(value) { calls.flushes++; calls.events.push('response_flush'); this.headersSent=true; this.body = value; return this; }");
replaceOnce(".default({ query, method: 'POST',", ".default({ query, method: 'POST', url: '/api/v1/db/refresh-roster-optimizer-schedule?' + new URLSearchParams(query), socket: { remoteAddress: '203.0.113.17' },");
const moduleFixture = { exports: {} };
vm.runInThisContext(`(function(require,module,exports,__dirname){${fixtureText}\nmodule.exports={fixture,game};})`,
  { filename: fixturePath })(createRequire(fixturePath),moduleFixture,moduleFixture.exports,BASE);
const { fixture,game } = moduleFixture.exports;
const serial = value => JSON.parse(JSON.stringify(value));

test('real auth/audit chain acknowledges cron write and persists one exact scheduled audit before response', async () => {
  const f=fixture(), res=await f.invoke();
  assert.equal(res.statusCode,200); assert.equal(res.body.data.writeOutcome,'acknowledged');
  assert.equal(res.body.finalAudit.status,'persisted'); assert.equal(res.body.finalAudit.owner,'withCronJobAudit');
  assert.equal(f.calls.auth.length,0); assert.equal(f.calls.writes.length,1); assert.equal(f.calls.audits,1);
  assert.equal(f.calls.persistedAuditRows.length,1); assert.equal(f.calls.flushes,1);
  const row=f.calls.persistedAuditRows[0];
  assert.equal(row.job_name,'refresh-roster-optimizer-schedule'); assert.equal(row.status,'success'); assert.equal(row.rows_affected,2);
  assert.equal(row.details.method,'POST'); assert.ok(row.details.url.includes('profile=current-next-v1&dryRun=false'));
  assert.equal(row.details.finalAudit.status,'persisted'); assert.equal(row.details.timing.source,'audit');
  assert.equal(JSON.parse(row.details.response).data.rowsUpserted,2);
  assert.deepEqual(f.calls.events,['audit_submit','audit_persisted','response_flush']);
});

test('real wrapper withholds response until the synthetic audit acknowledgement arrives', {timeout:2000}, async () => {
  let reached, release; const entered=new Promise(resolve=>reached=resolve), gate=new Promise(resolve=>release=resolve);
  const f=fixture({onAuditInsert:async (_row,calls)=>{assert.equal(calls.flushes,0);reached();await gate;}});
  const pending=f.invoke(); await entered; assert.equal(f.calls.flushes,0); release();
  const res=await pending; assert.equal(res.body.finalAudit.status,'persisted'); assert.equal(f.calls.flushes,1);
});

test('failed or thrown audit transport preserves cache acknowledgement but marks final audit failed once', async () => {
  for (const options of [{auditError:true},{auditThrow:true}]) {
    const f=fixture(options), res=await f.invoke();
    assert.equal(res.statusCode,200); assert.equal(res.body.success,true); assert.equal(res.body.data.writeOutcome,'acknowledged');
    assert.equal(res.body.finalAudit.status,'failed'); assert.equal(f.calls.audits,1); assert.equal(f.calls.persistedAuditRows.length,0);
    assert.equal(f.calls.writes.length,1); assert.equal(f.boundary.applied,2); assert.equal(f.calls.flushes,1);
  }
});

test('stale busy and rejected transaction receipts remain zero-row HTTP409 failure audits', async () => {
  for (const outcome of ['skipped_stale','skipped_busy','rejected']) {
    const f=fixture({onCommit:async()=>({data:{outcome,rowsUpserted:0},error:null})}), res=await f.invoke();
    assert.equal(res.statusCode,409); assert.equal(res.body.success,false); assert.equal(res.body.writeOutcome,'not_applied');
    assert.equal(res.body.data.outcome,outcome); assert.equal(res.body.finalAudit.status,'persisted');
    const row=f.calls.persistedAuditRows[0]; assert.equal(row.status,'failure'); assert.equal(row.rows_affected,0);
    assert.equal(JSON.parse(row.details.response).data.outcome,outcome); assert.equal(f.calls.writes.length,1);
  }
});

test('committed but lost RPC acknowledgement stays unknown and is recorded as failure without invented zero rows', async () => {
  const f=fixture({games:[{...game(),gameState:'LIVE'}],onCommit:async(args,_signal,boundary)=>{
    boundary.commit(args); return {data:null,error:{message:'synthetic lost acknowledgement'}};
  }}), res=await f.invoke();
  assert.equal(res.statusCode,409); assert.equal(res.body.writeOutcome,'unknown'); assert.equal(f.boundary.applied,2);
  assert.equal(res.body.finalAudit.status,'persisted'); assert.equal(f.calls.writes.length,1); assert.equal(f.calls.audits,1);
  assert.equal(f.calls.persistedAuditRows[0].status,'failure'); assert.equal(f.calls.persistedAuditRows[0].rows_affected,null);
  assert.equal(JSON.parse(f.calls.persistedAuditRows[0].details.response).writeOutcome,'unknown');
});

test('default inspection traverses real authentication with no commit or audit insertion', async () => {
  const f=fixture(), res=await f.invoke({profile:'current-next-v1'});
  assert.equal(res.statusCode,200); assert.equal(res.body.data.dryRun,true); assert.equal(res.body.finalAudit,undefined);
  assert.equal(f.calls.pages.length,3); assert.equal(f.calls.reads.length,5); assert.equal(f.calls.writes.length,0); assert.equal(f.calls.audits,0);
});

test('real authentication rejects absent invalid unverified nonadmin and empty-secret callers before schedule/audit work', async () => {
  const cases=[ [{}, {headers:{}},401], [{}, {headers:{authorization:'Bearer synthetic-invalid'}},401],
    [{authValid:true,authRole:'viewer'}, {headers:{authorization:'Bearer synthetic-viewer'}},403],
    [{authValid:false,authRole:'admin'}, {headers:{authorization:'Bearer synthetic-unverified-admin'}},401],
    [{cronSecret:''}, {},401] ];
  for (const [options,request,status] of cases) {
    const f=fixture(options),res=await f.invoke(undefined,request);
    assert.equal(res.statusCode,status); assert.equal(f.calls.reads.length,0); assert.equal(f.calls.rpcs.length,0);
    assert.equal(f.calls.pages.length,0); assert.equal(f.calls.writes.length,0); assert.equal(f.calls.audits,0);
  }
});

test('real verified administrator authorization retains the existing browser-admin contract', async () => {
  const f=fixture({authValid:true,authRole:'admin'}),res=await f.invoke(undefined,{headers:{authorization:'Bearer synthetic-verified-admin'}});
  assert.equal(res.statusCode,200); assert.deepEqual(f.calls.auth,['client','getUser','role']);
  assert.equal(res.body.finalAudit.status,'persisted'); assert.equal(f.calls.audits,1);
});

test('authentication precedes real method enforcement and rejected methods cannot audit or call sources', async () => {
  const authorized=fixture(), method=await authorized.invoke(undefined,{method:'GET'});
  assert.equal(method.statusCode,405); assert.deepEqual(serial(method.headers.Allow),['POST']);
  assert.equal(authorized.calls.rpcs.length,0); assert.equal(authorized.calls.audits,0);
  const anonymous=fixture(), auth=await anonymous.invoke(undefined,{method:'GET',headers:{}});
  assert.equal(auth.statusCode,401); assert.equal(auth.headers.Allow,undefined); assert.equal(anonymous.calls.audits,0);
});

test('localhost headers cannot create a development bypass for a nonloopback peer', async () => {
  const f=fixture({nodeEnv:'development'}),res=await f.invoke(undefined,{headers:{host:'localhost'},socket:{remoteAddress:'203.0.113.17'}});
  assert.equal(res.statusCode,401); assert.equal(f.calls.rpcs.length,0); assert.equal(f.calls.audits,0);
});

test('malformed explicit write is audited as not-attempted failure before any source or transaction', async () => {
  const f=fixture(),res=await f.invoke({profile:'wrong',dryRun:'false'});
  assert.equal(res.statusCode,409); assert.equal(res.body.writeOutcome,'not_attempted'); assert.equal(res.body.finalAudit.status,'persisted');
  assert.equal(f.calls.reads.length,0); assert.equal(f.calls.rpcs.length,0); assert.equal(f.calls.pages.length,0);
  assert.equal(f.calls.persistedAuditRows[0].status,'failure'); assert.equal(f.calls.persistedAuditRows[0].rows_affected,null);
});

// Artifact-only harness: exact sources, synthetic process.env and dependency mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const util = require('node:util');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');

const reviewRoot = path.resolve(__dirname, '..');
const webRoot = '/Users/tim/Code/fhfhockey.com/web';
const fakeSecret = 'FAKE_ONLY_REVIEW_SECRET_6c9d2';
const endpoint = `wss://FAKE_ONLY_USER:FAKE_ONLY_PASSWORD@browserless.invalid/chromium?token=${fakeSecret}&api_key=FAKE_ONLY_KEY#FAKE_ONLY_FRAGMENT`;
const encoded = encodeURIComponent(encodeURIComponent(endpoint));
const helperSource = fs.readFileSync(path.join(webRoot, 'lib/lines/webhookErrorDiagnostic.ts'), 'utf8');
const patchSource = fs.readFileSync(path.join(webRoot, 'pages/api/v1/webhooks/on-new-line-combo.ts'), 'utf8');
const baseSource = fs.readFileSync(path.join(__dirname, 'base-route.ts'), 'utf8');
const results = [];

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true
  }}).outputText;
}
function moduleFrom(source, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(compile(source), {
    exports, module: { exports }, Error, Buffer,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import blocked: ${name}`);
      return imports[name];
    }, ...globals
  }, { timeout: 5000 });
  return exports;
}
const diagnostic = moduleFrom(helperSource).webhookErrorDiagnostic;
const allowedStrings = new Set([
  'UnknownError', 'Error', 'ErrorEvent', 'TypeError', 'RangeError', 'TimeoutError',
  'ProtocolError', 'AggregateError', 'NonRetryableWebhookError',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ERR_INVALID_URL',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'connect', 'getaddrinfo', 'read', 'write',
  'matrix_not_found', 'endpoint_not_configured', 'browser_endpoint_unavailable'
]);
function validateShape(value, depth = 0) {
  assert.ok(value && typeof value === 'object');
  assert.ok(depth <= 4);
  for (const [key, field] of Object.entries(value)) {
    assert.ok(['name','code','syscall','status','reason','cause','error'].includes(key), key);
    if (key === 'cause' || key === 'error') validateShape(field, depth + 1);
    else if (key === 'status') assert.ok(Number.isInteger(field) && field >= 400 && field <= 599);
    else if (field !== undefined) assert.ok(allowedStrings.has(field), `Untrusted diagnostic value for ${key}`);
  }
}
function safe(value) {
  const output = `${JSON.stringify(value)}\n${util.inspect(value, { depth: null })}`;
  for (const marker of ['FAKE_ONLY_', 'browserless.invalid', 'proxy.invalid', endpoint, encoded]) {
    assert.ok(!output.includes(marker), `Synthetic secret escaped: ${marker}`);
  }
}
function checked(value) {
  const result = diagnostic(value);
  validateShape(result);
  safe(result);
  return result;
}
function check(name, action) {
  action();
  results.push({ name, result: 'passed' });
}

check('reject secret strings in every normally allowed field and nested error', () => {
  const variants = [endpoint, encodeURIComponent(endpoint), encoded,
    `https://proxy.invalid/?connection=${encodeURIComponent(endpoint)}`,
    `wss://browserless.invalid/?%74oken=${fakeSecret}&ToKeN=${fakeSecret}`,
    `Bearer ${fakeSecret}\nAuthorization: ${fakeSecret}`];
  for (const secret of variants) {
    for (const field of ['name','code','syscall','status','statusCode']) {
      const output = checked({ [field]: secret, cause: { [field]: secret }, error: { [field]: secret } });
      assert.equal(output.name, 'UnknownError');
    }
  }
});
check('retain every known code and name only by exact allowlist membership', () => {
  for (const code of [...allowedStrings].filter(x => /^(E[A-Z_]+|CERT_|DEPTH_|UNABLE_)/.test(x) && x !== 'Error' && x !== 'ErrorEvent')) {
    assert.equal(checked({ code, message: endpoint }).code, code);
    assert.equal(checked({ message: `connect ${code}: ${encoded}` }).code, code);
    assert.equal(checked({ code: `${code} ${endpoint}`, message: endpoint }).code, undefined);
  }
  for (const name of ['Error','ErrorEvent','TypeError','RangeError','TimeoutError','ProtocolError','AggregateError','NonRetryableWebhookError']) {
    assert.equal(checked({ name }).name, name);
    assert.equal(checked({ name: `${name}${endpoint}` }).name, 'UnknownError');
  }
});
check('ignore untrusted stacks, headers, targets and serialization hooks without reading them', () => {
  let forbiddenReads = 0;
  const object = { code: 'ECONNRESET', message: endpoint };
  for (const key of ['stack','target','url','headers','toJSON',Symbol.for('nodejs.util.inspect.custom')]) {
    Object.defineProperty(object, key, { get() { forbiddenReads++; throw new Error(endpoint); } });
  }
  const output = checked(object);
  assert.equal(output.code, 'ECONNRESET');
  assert.equal(forbiddenReads, 0);
});
check('do not coerce objects supplied as names codes syscalls statuses or messages', () => {
  let coercions = 0;
  const poison = { toString() { coercions++; return endpoint; }, valueOf() { coercions++; throw new Error(endpoint); } };
  checked({ name:poison, code:poison, syscall:poison, status:poison, message:poison });
  assert.equal(coercions, 0);
});
check('survive throwing accessors and revoked proxies', () => {
  const object = {};
  for (const key of ['name','code','message','syscall','status','statusCode','cause','error']) {
    Object.defineProperty(object, key, { get() { throw new Error(endpoint); } });
  }
  assert.equal(checked(object).name, 'UnknownError');
  const {proxy, revoke} = Proxy.revocable({}, {});
  revoke();
  assert.equal(checked(proxy).name, 'UnknownError');
});
check('bound fresh binary cause/error getters as well as cycles', () => {
  let reads = 0;
  function fresh() { return { get cause() { reads++; return fresh(); }, get error() { reads++; return fresh(); } }; }
  const output = checked(fresh());
  assert.equal(reads, 30);
  assert.ok(JSON.stringify(output).length < 2000);
  const cycle = {}; cycle.cause = cycle; cycle.error = cycle;
  checked(cycle);
});
check('retain only numeric integer HTTP failures, never boxed or secret-bearing values', () => {
  for (const status of [400, 404, 500, 599]) assert.equal(checked({status}).status, status);
  for (const status of [399,600,NaN,Infinity,-Infinity,500.5,'500',new Number(500),endpoint]) {
    assert.equal(checked({status}).status, undefined);
  }
  assert.equal(checked({statusCode:502}).status,502);
});
check('handle arbitrary primitive throws without serialization', () => {
  for (const value of [undefined,null,0,NaN,false,100n,Symbol(fakeSecret),()=>endpoint,endpoint,encoded]) checked(value);
});

function fakeError() {
  return Object.assign(new Error(`dependency failed ${encoded}`), {
    code: 'ECONNRESET', syscall:'read', statusCode:502,
    stack: `Error: ${endpoint}\n at proxy (${encoded})`,
    cause: { name: endpoint, code: endpoint, message:endpoint, headers:{Authorization:`Bearer ${fakeSecret}`},
      error: { code:'ETIMEDOUT', stack:encoded, target:{_url:endpoint} } }
  });
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
async function runRoute(source, scenario) {
  let clock = 0;
  const trace = [], delays = [], logs = [], errors = [], response = [];
  const counts = {};
  let hookCalls = 0;
  function call(name, result) {
    return async (...args) => {
      counts[name] = (counts[name] || 0) + 1;
      trace.push({ name, time:clock });
      if (scenario.failure === name && counts[name] <= (scenario.failures ?? Infinity)) {
        let error = scenario.error ? scenario.error() : fakeError();
        if (scenario.poison) {
          error = { get name() { return endpoint; }, get message() { return encoded; },
            get code() { throw new Error(endpoint); }, get syscall() { return endpoint; },
            get status() { return endpoint; }, get cause() { return fakeError(); },
            get stack() { hookCalls++; throw new Error(endpoint); },
            get target() { hookCalls++; throw new Error(endpoint); },
            toJSON() { hookCalls++; throw new Error(endpoint); },
            [Symbol.for('nodejs.util.inspect.custom')]() { hookCalls++; return endpoint; } };
        }
        if (name === 'upload-return') return {data:null,error};
        throw error;
      }
      return typeof result === 'function' ? result(...args) : result;
    };
  }
  const screenshot = call('screenshot', Buffer.from('FAKE_IMAGE'));
  const page = {
    setViewport:call('viewport'), goto:call('goto'), waitForSelector:call('selector'),
    evaluate:call('evaluate'), $:call('element', () => scenario.missingElement ? null : {screenshot})
  };
  const browser = {newPage:call('newPage',page),close:call('close')};
  const uploadName = scenario.failure === 'upload-return' ? 'upload-return' : 'upload';
  const imports = {
    'puppeteer-core':{connect:call('connect',browser)},
    'utils/adminOnlyMiddleware':(handler)=>handler,
    'lib/supabase/server':{storage:{from:()=>({upload:call(uploadName,{data:{path:'synthetic.png'},error:null})})}},
    'lib/lines/webhookErrorDiagnostic':{webhookErrorDiagnostic:diagnostic},
    'lib/lines/matrixCapture':moduleFrom(fs.readFileSync(path.join(webRoot, 'lib/lines/matrixCapture.ts'), 'utf8')),
    util
  };
  const env = {PUPPETEER_ENDPOINT:scenario.missingConfig?'':endpoint,CRON_SECRET:'FAKE_ONLY_CRON'};
  const handler = moduleFrom(source,imports,{
    process:{env}, Date:{now:()=>clock}, performance:{now:()=>clock},
    setTimeout(callback,delay) {delays.push(delay);clock+=delay;callback();},
    console:{log:(...args)=>logs.push(args),error:(...args)=>errors.push(args)},
    fetch:call('fetch',{json:call('json',{success:true})})
  }).default;
  const res = { status(value) {response.push({status:value});return this;},json(value) {response.push({json:plain(value)});} };
  await handler({query:{gameId:'2026020001',teamId:'10'}},res);
  return {trace,delays,logs,errors,response,counts,hookCalls};
}

(async () => {
  const scenarios = [
    {name:'success'}, {name:'missing config',missingConfig:true},
    {name:'connection failure',failure:'connect'},
    {name:'connection string',failure:'connect',error:()=>`ECONNREFUSED ${encoded}`},
    {name:'connection ws event',failure:'connect',error:()=>({message:endpoint,error:fakeError(),target:{_url:endpoint}})},
    ...['newPage','viewport','goto','selector','evaluate','element','screenshot','upload-return','upload','close','fetch','json'].map(failure=>({name:`persistent ${failure}`,failure})),
    {name:'missing matrix',missingElement:true},
    {name:'nonretryable Error',failure:'goto',error:()=>new Error(`ECONNREFUSED ${endpoint}`)},
    {name:'nonretryable string',failure:'goto',error:()=>`browser endpoint is unavailable ${encoded}`},
    {name:'screenshot recovery on third attempt',failure:'screenshot',failures:2},
    {name:'Discord recovery on third attempt',failure:'fetch',failures:2}
  ];
  for (const scenario of scenarios) {
    const base = await runRoute(baseSource,scenario);
    const patched = await runRoute(patchSource,scenario);
    assert.deepEqual(patched.trace,base.trace,`${scenario.name}: operation/time changes`);
    assert.deepEqual(patched.delays,base.delays,`${scenario.name}: retry delay changes`);
    assert.deepEqual(patched.response,base.response,`${scenario.name}: HTTP response changes`);
    assert.deepEqual(patched.counts,base.counts,`${scenario.name}: operation counts changed`);
    safe({logs:patched.logs,errors:patched.errors,response:patched.response});
    for (const [label,fields] of patched.errors) {
      validateShape(label.startsWith('Attempt ') ? fields : fields.error);
    }
    if (scenario.failure && scenario.failures === undefined && !['connect'].includes(scenario.failure) && !scenario.name.startsWith('nonretryable')) {
      assert.deepEqual(patched.delays,[1000,1000,1000]);
      assert.equal(patched.counts[scenario.failure],4);
    }
    results.push({name:`route base parity and safe logs/response: ${scenario.name}`,result:'passed',delays:patched.delays,counts:patched.counts});
  }
  for (const failure of ['connect','goto','upload-return','fetch']) {
    const patched = await runRoute(patchSource,{failure,poison:true});
    safe({logs:patched.logs,errors:patched.errors,response:patched.response});
    assert.equal(patched.hookCalls,0);
    assert.deepEqual(patched.response,[{status:500},{json:{success:false,error:'Line-combination webhook processing failed.'}}]);
    results.push({name:`route hostile metadata/getters: ${failure}`,result:'passed'});
  }
  // Distinguish the existing secondary logging exception on null/undefined from
  // the intended retry algorithm: new safe diagnostics allow all four attempts.
  for (const thrown of [null,undefined]) {
    const scenario = {failure:'goto',error:()=>thrown};
    const base = await runRoute(baseSource,scenario);
    const patched = await runRoute(patchSource,scenario);
    assert.equal(base.counts.goto,1);
    assert.equal(patched.counts.goto,4);
    assert.deepEqual(patched.delays,[1000,1000,1000]);
    assert.deepEqual(patched.response,base.response);
    safe({logs:patched.logs,errors:patched.errors,response:patched.response});
    results.push({name:`edge behavior: ${thrown === null ? 'null' : 'undefined'} throw now survives diagnostic logging`,result:'passed',baseAttempts:1,patchedAttempts:4});
  }
  const output = {result:'passed',tests:results.length,syntheticOnly:true,liveCalls:0,results};
  fs.writeFileSync(path.join(__dirname,'independent-results.json'),JSON.stringify(output,null,2)+'\n');
  console.log(`Independent synthetic review: ${results.length} checks passed; 0 live calls.`);
})().catch(error => {console.error(error);process.exitCode=1;});

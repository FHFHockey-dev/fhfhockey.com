const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {performance} = require('node:perf_hooks');
const {read,fixedTime} = require('./fixture.cjs');
const hash = bytes=>createHash('sha256').update(bytes).digest('hex');
const sortKeys = x=>Array.isArray(x) ? x.map(sortKeys) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortKeys(x[k])])) : x;
const digest = x=>hash(JSON.stringify(sortKeys(x)));

async function start(tmp) {
  const RealDate = Date;
  const realStart = RealDate.now();
  class FixtureDate extends RealDate {
    constructor(...args){super(...(args.length ? args : [FixtureDate.now()]));}
    static now(){return RealDate.parse(fixedTime) + (RealDate.now()-realStart);}
  }
  global.Date = FixtureDate;
  const api = require(path.join(tmp,'handler.cjs'));
  const pg = process.env.TREND_LOCAL_PG === '1' ? await require('../pg-fixture.cjs').createFixture() : null;
  const records = [];
  let queries = [];
  const server = http.createServer(async (req,res)=>{
    try {
      const url = new URL(req.url,origin);
      if (url.pathname.startsWith('/rest/v1/')) {
        const start = performance.now();
        const chunks = [];
        for await(const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
        const {data,stage} = pg ? await pg.read(url,req.headers,body) : read(url,req.headers);
        const queryMs = performance.now()-start;
        const json = JSON.stringify(data);
        queries.push({stage,rows:data.length,bytes:Buffer.byteLength(json),ms:queryMs});
        res.writeHead(200,{'Content-Type':'application/json'}).end(json);
      } else if (url.pathname === '/api/v1/transactions/ownership-trends') {
        const started = performance.now();
        queries = [];
        req.query = Object.fromEntries(url.searchParams);
        res.status = function(code){this.statusCode=code;return this;};
        res.json = (payload)=>{
          const encoded = JSON.stringify(payload);
          records.push({url:url.search,payload,status:res.statusCode,queries,ms:performance.now()-started,
            bytes:Buffer.byteLength(encoded)});
          res.setHeader('Content-Type','application/json');res.end(encoded);
        };
        await api.default(req,res);
      } else if (url.pathname === '/') {
        res.setHeader('Content-Type','text/html');
        res.end('<!doctype html><link rel="stylesheet" href="/home.css"><div id="root"></div><script src="/home.js"></script>');
      } else if (['/home.js','/home.css'].includes(url.pathname)) {
        res.setHeader('Content-Type',url.pathname.endsWith('css')?'text/css':'text/javascript');
        res.end(fs.readFileSync(path.join(tmp,url.pathname.slice(1))));
      } else res.writeHead(404).end();
    } catch(e) {console.error(e);res.writeHead(500).end(String(e));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin = 'http://127.0.0.1:'+server.address().port;
  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-fixture-only';
  const realFetch = global.fetch;
  global.fetch = function(input,...rest){
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert.equal(url.origin,origin,'External request rejected');
    return realFetch(input,...rest);
  };
  return {origin,records,reset(){api.clearOwnershipTrendCache();},
    async close(){global.fetch=realFetch;global.Date=RealDate;if(pg)await pg.close();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}

function aggregate(records){
  const stages = {};
  for (const {stage,rows,bytes} of records.flatMap(r=>r.queries)) {
    const s=stages[stage]??={queries:0,rows:0,bytes:0};
    s.queries++; s.rows+=rows; s.bytes+=bytes;
  }
  return stages;
}
module.exports = {start,aggregate,digest};

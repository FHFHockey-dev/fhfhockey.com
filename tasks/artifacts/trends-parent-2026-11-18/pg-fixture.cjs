// Isolated PostgreSQL 15 fixture for the local HTTP/browser benchmark.
// No inherited connection string, no TCP listener, one private socket directory.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { players, mappings, adp } = require('./benchmark/fixture.cjs');
const { webRequire, web } = require('./benchmark/build.cjs');
const { Client } = webRequire('pg');
const migrations = path.resolve(web, '../supabase/migrations');
const fields = {
  yahoo_players_with_normalized_history: ['player_key', 'player_id', 'season', 'full_name', 'display_position', 'headshot_url', 'editorial_team_full_name', 'editorial_team_abbreviation', 'eligible_positions', 'uniform_number', 'average_draft_pick', 'normalized_ownership_timeline'],
  yahoo_nhl_player_map_read: ['nhl_player_id', 'yahoo_player_id'],
  yahoo_player_draft_analysis_history: ['player_key', 'captured_at', 'average_draft_pick'],
};
const columnTypes = 'player_key varchar primary key, player_id varchar, season integer, full_name varchar, display_position text, headshot_url text, editorial_team_full_name varchar, editorial_team_abbreviation varchar, eligible_positions jsonb, uniform_number smallint, average_draft_pick double precision';
async function createFixture() {
  const bin = process.env.TREND_PG_BIN || '/opt/homebrew/opt/postgresql@15/bin';
  const socket = fs.mkdtempSync('/tmp/trendpg-');
  const dir = path.join(socket, 'cluster');
  const pg = (name, args) => execFileSync(path.join(bin, name), args, {stdio:'pipe', env:{PATH:process.env.PATH, LC_ALL:'C'}});
  let started = false;
  const localClient = () => new Client({host:socket, port:55431, user:'fixture', database:'postgres', ssl:false});
  let db = localClient();
  async function close() {
    try { await db.end(); } finally {
      if (started) pg('pg_ctl', ['-D',dir,'-m','fast','-w','stop']);
      fs.rmSync(socket, {recursive:true, force:true});
    }
  }
  try {
    pg('initdb', ['-D',dir,'-A','trust','-U','fixture','--no-locale','--encoding=UTF8']);
    pg('pg_ctl', ['-D',dir,'-l',path.join(socket,'server.log'),'-o',"-c listen_addresses='' -k "+socket+' -p 55431','-w','start']);
    started = true;
    await db.connect();
    await db.query(`
      create role anon; create role authenticated; create role service_role;
      create table yahoo_players (${columnTypes});
      create unique index fixture_id_season on yahoo_players(player_id,season);
      create table yahoo_player_ownership_history (player_key text, ownership_date date, ownership_pct float8, primary key(player_key,ownership_date));
      create index on yahoo_player_ownership_history(player_key);
      create table yahoo_nhl_player_map_read (yahoo_player_id text, nhl_player_id text);
      create index on yahoo_nhl_player_map_read(yahoo_player_id);
      create table yahoo_player_draft_analysis_history(player_key text, captured_at timestamptz, average_draft_pick float8);
    `);
    await db.query('insert into yahoo_players select * from jsonb_populate_recordset(null::yahoo_players, $1)', [JSON.stringify(players.map(({normalized_ownership_timeline,...meta})=>meta))]);
    await db.query(`insert into yahoo_player_ownership_history
      select p.player_key,h.date,h.value from jsonb_to_recordset($1) p(player_key text,normalized_ownership_timeline jsonb)
      cross join lateral jsonb_to_recordset(p.normalized_ownership_timeline) h(date date,value float8)`, [JSON.stringify(players)]);
    for (const [table,rows] of [['yahoo_nhl_player_map_read',mappings],['yahoo_player_draft_analysis_history',adp]]) {
      await db.query('insert into '+table+' select * from jsonb_populate_recordset(null::'+table+', $1)', [JSON.stringify(rows)]);
    }
    await db.query(fs.readFileSync(path.join(migrations, '20260725235646_add_normalized_yahoo_ownership_reader.sql'),'utf8'));
    const candidate = fs.readdirSync(migrations).find(name=>name.endsWith('_homepage_yahoo_ownership_page.sql'));
    if (candidate) await db.query(fs.readFileSync(path.join(migrations,candidate),'utf8'));
    await db.query('analyze');
    if (process.env.TREND_PG_FRESH === '1') {
      await db.end();
      pg('pg_ctl', ['-D',dir,'-m','fast','-l',path.join(socket,'server.log'),'-w','restart']);
      db = localClient();
      await db.connect();
    }
    async function read(url, headers, body) {
      const table = url.pathname.split('/').at(-1);
      const params = url.searchParams;
      let statement, stage, values = [];
      if (table === 'homepage_yahoo_ownership_page') {
        const args = body || Object.fromEntries(params);
        statement = 'select * from public.homepage_yahoo_ownership_page($1,$2)';
        values = [args.p_offset,args.p_season ?? null];
        stage = 'ownership-history';
      } else {
        const allowed = fields[table];
        assert(allowed, table);
        const check = s=>{assert(allowed.includes(s), s);return s;};
        const columns = params.get('select').split(',').map(s=>{
          const [alias, field=alias] = s.trim().split(':');
          assert(/^[a-z_]+$/.test(alias));
          return check(field)+' as '+alias;
        });
        const predicates = [];
        for (const [key,filter] of params) {
          if (['select','order','offset','limit'].includes(key)) continue;
          check(key);
          const i = filter.indexOf('.'), op = filter.slice(0,i), value = filter.slice(i+1);
          if (op === 'in') {
            values.push(value.slice(1,-1).split(',').map(s=>s.replace(/^"|"$/g,'')));
            predicates.push(key+' = any($'+values.length+'::text[])');
          } else {
            const operators = {eq:'=',gte:'>=',gt:'>'};
            assert(Object.hasOwn(operators,op));
            values.push(value);
            predicates.push(key+operators[op]+'$'+values.length);
          }
        }
        statement = 'select '+columns.join(',')+' from '+table;
        if (predicates.length) statement += ' where '+predicates.join(' and ');
        if (params.has('order')) {
          const order = params.get('order').split(',').map(s=>{
            const [column,dir,nulls] = s.split('.');
            assert(['asc','desc'].includes(dir));
            return check(column)+' '+dir+(nulls==='nullsfirst'?' nulls first':'');
          });
          statement += ' order by '+order.join(',');
        }
        const range = headers.range?.split('-').map(Number);
        values.push(Number(params.get('limit') ?? (range ? range[1]-range[0]+1 : 1000)),Number(params.get('offset') ?? range?.[0] ?? 0));
        statement += ' limit $'+(values.length-1)+' offset $'+values.length;
        stage = table === 'yahoo_nhl_player_map_read' ? 'mapping' : table === 'yahoo_player_draft_analysis_history' ? 'adp-history' : columns.join(',').includes('normalized_ownership_timeline') ? 'ownership-history' : columns.length===1 ? 'keys' : 'player-metadata';
      }
      const result = await db.query("select coalesce(json_agg(r),'[]') as data from ("+statement+') r', values);
      return {data:result.rows[0].data,stage};
    }
    async function verifySql() {
      const observations = new Map(players.map(row=>[row.player_key,row.normalized_ownership_timeline]));
      let pointCount = 0;
      for (let offset = 0; offset < players.length; offset += 1000) {
        const {data} = await read(new URL('http://localhost/rest/v1/rpc/homepage_yahoo_ownership_page?p_offset='+offset),{});
        assert.equal(data.length,Math.min(1000,players.length-offset));
        for (const row of data) {
          const expected = observations.get(row.player_key);
          assert(expected, 'Duplicate or unknown key');
          observations.delete(row.player_key);
          assert.equal(row.page_count,data.length);
          assert.deepEqual(row.observation_dates,expected.map(p=>p.date));
          assert.deepEqual(row.observation_values,expected.map(p=>p.value));
          pointCount += expected.length;
        }
      }
      assert.equal(observations.size,0);
      assert.equal(pointCount,74332);
      // Local-only edge case outside the timed population: nulls must never
      // become observations; absolute zero and a distant prior must survive.
      await db.query(`insert into yahoo_players(player_key,season) values ('477.p.9',1999);
        insert into yahoo_player_ownership_history values
        ('477.p.9','2021-01-01',0),('477.p.9','2022-01-01',null),('477.p.9','2024-01-01',89);
        create role no_trends_access;
        grant select on yahoo_players,yahoo_player_ownership_history to anon,authenticated,service_role;
        alter table yahoo_players enable row level security;
        alter table yahoo_player_ownership_history enable row level security;
        create policy sample on yahoo_players for select using (season=1999);
        create policy sample on yahoo_player_ownership_history for select using (ownership_date < '2023-01-01' or current_user='service_role');`);
      await db.query('set role no_trends_access');
      await assert.rejects(db.query('select * from homepage_yahoo_ownership_page(0)'),err=>err.code==='42501');
      await db.query('reset role');
      for (const role of ['anon','authenticated','service_role']) {
        await db.query('set role '+role);
        const {data} = await read(new URL('http://localhost/rest/v1/rpc/homepage_yahoo_ownership_page?p_offset=0'),{});
        assert.deepEqual(data.map(r=>r.player_key),['477.p.9']);
        assert.deepEqual(data[0].observation_dates,role==='service_role'?['2021-01-01','2024-01-01']:['2021-01-01']);
        assert.deepEqual(data[0].observation_values,role==='service_role'?[0,89]:[0]);
        await db.query('reset role');
      }
      return {sourceRows:players.length,pointCount,invokerRoles:['anon','authenticated','service_role'],ungrantedRole:'denied',nullAndZero:'passed'};
    }
    return {read,close,verifySql};
  } catch(e) { await close(); throw e; }
}
module.exports = {createFixture};

if (require.main === module) {
  (async () => {
    const fixture = await createFixture();
    try { console.log(JSON.stringify(await fixture.verifySql())); }
    finally { await fixture.close(); }
  })().catch(error=>{console.error(error); process.exitCode=1;});
}

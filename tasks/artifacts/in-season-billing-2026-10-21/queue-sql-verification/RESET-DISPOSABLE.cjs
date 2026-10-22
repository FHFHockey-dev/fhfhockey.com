// Only resets this task's freshly created failed test database, never a shared target.
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { Client } = require(path.resolve(__dirname, '../../../../web/node_modules/pg'));
const t = JSON.parse(fs.readFileSync(path.join(__dirname, 'TARGET.json'), 'utf8'));
assert.equal(t.root, '/tmp/fhfh-queue-sql-v5pk45ug'); assert.equal(t.host, '127.0.0.1'); assert.equal(t.port, 65447); assert.equal(t.database, 'fhfh_queue_check');
const c = new Client({ host: t.host, port: t.port, user: t.user, password: 'unused-local-trust', database: 'postgres', ssl: false });
async function guard() {
  const r = (await c.query('select host(inet_server_addr()) as host,inet_server_port() as port,current_database() as db')).rows[0];
  assert.deepEqual(r, { host: t.host, port: t.port, db: 'postgres' });
  assert.equal(fs.realpathSync((await c.query('show data_directory')).rows[0].data_directory), fs.realpathSync(path.join(t.root, 'data')));
}
(async () => {
  await c.connect(); await guard();
  assert.equal((await c.query('select count(*)::int n from pg_stat_activity where datname=$1', [t.database])).rows[0].n, 0);
  await c.query('drop database fhfh_queue_check');
  await guard(); await c.query('drop role anon,authenticated,service_role');
  console.log('Reset only the task-created failed test database and its local fixture roles; private cluster identity verified.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => c.end());

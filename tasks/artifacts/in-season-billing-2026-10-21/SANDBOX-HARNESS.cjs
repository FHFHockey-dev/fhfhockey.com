// Temporary loopback HTTP adapter for the real application routes + Stripe CLI.
// No .env loading, public webhook registration, automatic jobs or monthly route.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const root = '/tmp/fhfh-billing-e2e-qh0ri7vv';
const db = JSON.parse(fs.readFileSync(root + '/supabase-status.json', 'utf8'));
assert.equal(db.API_URL, 'http://127.0.0.1:56421');
const secret = fs.readFileSync(root + '/stripe-restricted-key', 'utf8').trim();
assert.match(secret, /^rk_test_/);
Object.assign(process.env, { NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: db.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: db.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: db.SERVICE_ROLE_KEY,
  IN_SEASON_BILLING_SANDBOX_ENABLED: 'true', IN_SEASON_SANDBOX_ORIGIN: 'http://127.0.0.1:3107',
  IN_SEASON_STRIPE_SECRET_KEY: secret, NODE_PATH: path.join(repo, 'web') });
require('node:module').Module._initPaths();
require(path.join(repo, 'web/node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const routes = {
  '/api/v1/account/in-season/checkout': require(path.join(repo, 'web/pages/api/v1/account/in-season/checkout.ts')).default,
  '/api/v1/account/in-season/cancel': require(path.join(repo, 'web/pages/api/v1/account/in-season/cancel.ts')).default,
  '/api/v1/webhooks/in-season-stripe': require(path.join(repo, 'web/pages/api/v1/webhooks/in-season-stripe.ts')).default,
};
const receipt = path.join(__dirname, 'SANDBOX-HTTP-RESULTS.jsonl');
function record(value) { fs.appendFileSync(receipt, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); }
const server = http.createServer(async (req, res) => {
  const route = new URL(req.url, 'http://127.0.0.1:3107').pathname;
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
  res.once('finish', () => record({ route, method: req.method, status: res.statusCode }));
  if (route === '/account') { res.setHeader('Content-Type', 'text/html'); return res.end('<h1>FHFH isolated sandbox return</h1><p>Payment status is verified from the signed webhook and stored grant.</p>'); }
  const handler = routes[route]; if (!handler) return res.status(404).json({ error: 'Not found' });
  try {
    if (route.endsWith('/in-season-stripe')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks); if (bytes.length > 1024 * 1024) throw Error('Too large');
      // Filter unrelated sandbox events before any account/customer reads. This
      // adapter never edits the signed body; the actual route verifies it again.
      const Stripe = require(path.join(repo, 'web/node_modules/stripe'));
      const stripe = new Stripe(secret, { maxNetworkRetries: 0, timeout: 10000 });
      const event = stripe.webhooks.constructEvent(bytes, req.headers['stripe-signature'], process.env.IN_SEASON_STRIPE_WEBHOOK_SECRET);
      const ownedUsers = JSON.parse(fs.readFileSync(root + '/synthetic-users.json', 'utf8')).map(u => u.id);
      const object = event.data.object;
      const registry = fs.existsSync(root + '/stripe-objects.json') ? JSON.parse(fs.readFileSync(root + '/stripe-objects.json', 'utf8')) : { ids: [] };
      const owned = ownedUsers.includes(object.metadata?.in_season_user_id)
        || [object.id, object.customer, object.payment_intent, object.parent?.subscription_details?.subscription].some(id => registry.ids.includes(id));
      if (!owned) return res.status(200).json({ ignored: true });
      record({ eventId: event.id, eventType: event.type, apiVersion: event.api_version, owned: true });
      for (const file of ['monthly-target.json', 'monthly-natural-target.json']) {
        if (!fs.existsSync(root + '/' + file)) continue;
        const target = JSON.parse(fs.readFileSync(root + '/' + file));
        if ((object.customer === target.customerId || object.id === target.subscriptionId)
          && Math.max(object.created ?? 0, object.canceled_at ?? 0, object.status_transitions?.paid_at ?? 0) > Date.now() / 1000) {
          record({ eventId: event.id, deferredToVerifiedVirtualClock: true });
          return res.status(200).json({ deferredToTestClockHarness: true });
        }
      }
      req[Symbol.asyncIterator] = async function* () { yield bytes; };
    } else if (req.method === 'POST') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    }
    await handler(req, res);
  } catch (error) {
    record({ route, harnessError: error.type ?? error.code ?? error.name });
    if (!res.headersSent) res.status(400).json({ error: 'Isolated request rejected.' }); else res.end();
  }
});
const events = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.payment_action_required', 'customer.subscription.updated', 'customer.subscription.deleted', 'refund.created', 'refund.updated', 'refund.failed', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'];
const cli = spawn('stripe', ['listen', '--events', events.join(','), '--forward-to', 'http://127.0.0.1:3107/api/v1/webhooks/in-season-stripe', '--skip-update'], { env: { ...process.env, STRIPE_API_KEY: secret, XDG_CONFIG_HOME: root + '/stripe-cli-config' }, stdio: ['ignore', 'pipe', 'pipe'] });
let ready = false, buffer = '';
function capture(chunk) {
  buffer = (buffer + chunk.toString()).slice(-8192);
  const signing = buffer.match(/whsec_[A-Za-z0-9_]+/);
  if (signing && !ready) {
    ready = true; process.env.IN_SEASON_STRIPE_WEBHOOK_SECRET = signing[0];
    fs.writeFileSync(root + '/stripe-webhook-secret', signing[0], { mode: 0o600 });
    server.listen(3107, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, host: '127.0.0.1', port: 3107, temporaryForwarding: true, publicEndpointCreated: false })));
    buffer = '';
  }
}
cli.stdout.on('data', capture); cli.stderr.on('data', capture);
cli.once('exit', code => { console.log(JSON.stringify({ listenerExited: true, code, ready })); server.close(); });
const deadline = setTimeout(() => { if (!ready) { console.log(JSON.stringify({ ready: false, reason: 'Listener did not initialize within 30 seconds' })); cli.kill('SIGINT'); } }, 30000);
function shutdown() { clearTimeout(deadline); cli.kill('SIGINT'); server.close(() => process.exit(0)); }
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);

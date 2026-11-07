// Offline-only preload, loaded after deny-network.cjs. Never delegates to fetch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
assert(!process.execArgv.some(arg => arg.includes("--env-file")));
assert.equal(process.env.OPENAI_API_KEY, "offline-not-a-credential");
const fixture = JSON.parse(fs.readFileSync(process.env.LUNA_OFFLINE_FIXTURE, "utf8"));
const fixedTime = Date.parse("2026-10-31T23:00:00Z"), OriginalDate = Date;
globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return fixedTime; }
};
let calls = [];
globalThis.fetch = async (url, init) => {
  const expected = fixture.requests[calls.length];
  assert(expected, "extra_mock_request");
  assert.equal(String(url), `https://api.openai.com/v1/${expected.endpoint}`);
  assert.equal(init.headers.Authorization, "Bearer offline-not-a-credential");
  const body = JSON.parse(init.body);
  assert.deepEqual(body, expected.body);
  const hash = crypto.createHash("sha256").update(JSON.stringify({ endpoint: expected.endpoint, body })).digest("hex");
  assert.equal(hash, expected.hash);
  calls.push({ endpoint: expected.endpoint, hash });
  fs.writeFileSync(process.env.LUNA_OFFLINE_CALLS, JSON.stringify({ calls, actualProviderRequests: 0 }) + "\n");
  if (expected.throwUncertain) throw new Error("synthetic_uncertain_outcome");
  return new Response(JSON.stringify(expected.reply), { headers: { "x-request-id": expected.requestId } });
};

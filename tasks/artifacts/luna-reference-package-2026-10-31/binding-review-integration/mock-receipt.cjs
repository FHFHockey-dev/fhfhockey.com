// Test-only preload. Network denial is loaded first; this fetch has no fallback.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const fixture = JSON.parse(fs.readFileSync(process.env.LUNA_REPLAY_RESPONSE, "utf8"));
let calls = 0;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  assert.equal(++calls, 1);
  const body = JSON.parse(init.body);
  assert.deepEqual(body, fixture.requestBody);
  assert.equal(init.headers.Authorization, "Bearer offline-not-a-credential");
  const hash = crypto.createHash("sha256").update(JSON.stringify({ endpoint: "responses", body })).digest("hex");
  assert.equal(hash, fixture.requestHash);
  fs.writeFileSync(process.env.LUNA_REPLAY_CALLLOG, JSON.stringify({ mockCalls: calls, actualProviderRequests: 0, requestHash: hash }) + "\n", { flag: "wx" });
  return new Response(JSON.stringify(fixture.receipt.body), { headers: { "x-request-id": fixture.receipt.requestId } });
};

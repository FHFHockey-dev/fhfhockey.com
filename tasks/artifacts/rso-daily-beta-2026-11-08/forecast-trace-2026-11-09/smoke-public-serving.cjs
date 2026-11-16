// One bounded public GET after the approved release is READY. No Yahoo, credentials, or writes.
// Run against an exact exported release; the saved workspace stays on disk unchanged.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const [mode, sourceRoot, savedInput, outputDirectory] = process.argv.slice(2);
if (mode !== "--execute-public-read" || !sourceRoot || !savedInput || !outputDirectory)
  throw new Error("Explicit public-read mode, exact release source, saved input, and output directory required.");
const output = path.resolve(outputDirectory);
if (fs.existsSync(path.join(output, "public-serving-smoke.json")))
  throw new Error("Existing smoke receipt: inspect it instead of repeating the request.");
const inputBytes = fs.readFileSync(savedInput);
assert(inputBytes.length <= 16_000_000);
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
assert.equal(hash(inputBytes), "124984ee2f1f59916c6233566cd896826a91359980bc657531c55f04702db1de");
const saved = JSON.parse(inputBytes.toString("utf8"));
const snapshot = saved.snapshot;
const beforeInput = JSON.stringify(saved);
const load = file => require(path.resolve(sourceRoot, "web", file));
const { withCurrentPlanningRead } = load("lib/rosterScheduleOptimizer/currentPlanningRead.ts");
const { evaluatePlan } = load("lib/rosterScheduleOptimizer/planning.ts");
const { candidatePlanMetrics } = load("lib/rosterScheduleOptimizer/candidatePlanMetrics.ts");
const { currentRsoUsePolicy } = load("lib/player-forecasts/rsoUsePolicy.ts");
const { bridgeRunProofs } = load("lib/rosterScheduleData/bridgeForecastWire.ts");
const originalFetch = globalThis.fetch;
let requests = 0, responseReceipt = null, servedProofs = [];
const params = new URLSearchParams({ seasonId: String(snapshot.context.seasonId), startDate: snapshot.context.startDate,
  endDate: snapshot.context.endDate, timeZone: snapshot.context.timeZone });
const relativeUrl = `/api/v1/roster-schedule-optimizer/data?${params}`;
globalThis.fetch = async (input, options) => {
  assert.equal(input, relativeUrl);
  assert.equal(options?.method, "GET");
  assert.equal(++requests, 1);
  assert.equal(new Headers(options.headers).has("Cookie"), false);
  assert.equal(new Headers(options.headers).has("Authorization"), false);
  const startedAt = new Date().toISOString();
  const response = await originalFetch(new URL(relativeUrl, "https://fhfhockey.com"), {
    method: "GET", redirect: "error", signal: options.signal, headers: options.headers, credentials: "omit",
  });
  const text = await response.text();
  assert(Buffer.byteLength(text) <= 4_000_000);
  const body = JSON.parse(text);
  servedProofs = bridgeRunProofs(body.bridgeForecasts);
  responseReceipt = { startedAt, completedAt: new Date().toISOString(), route: relativeUrl, method: "GET",
    status: response.status, bytes: Buffer.byteLength(text), sha256: hash(text),
    cacheControl: response.headers.get("cache-control"), vercelId: response.headers.get("x-vercel-id"),
    forecastSource: body.forecastSource, runProofCount: servedProofs.length };
  fs.writeFileSync(path.join(output, "public-planning-response.json"), text);
  return { ok: response.ok, json: async () => body };
};
const coverage = input => {
  const keys = new Set(input.forecasts.map(row => `${row.playerId}|${row.gameId}`));
  const players = new Map(input.players.map(row => [row.id, row]));
  let activePlayersMissing = 0, activePlayerGamesMissing = 0;
  for (const row of input.roster.filter(row => ["active", "bench"].includes(row.position))) {
    const player = players.get(row.playerId);
    const missing = input.games.filter(game => game.teamAbbreviation === player?.teamAbbreviation
      && !keys.has(`${row.playerId}|${game.id}`)).length;
    if (missing) activePlayersMissing++;
    activePlayerGamesMissing += missing;
  }
  return { activePlayersMissing, activePlayerGamesMissing };
};
(async () => {
  const result = await withCurrentPlanningRead(snapshot, { allowRead: true, publicContext: false },
    currentRsoUsePolicy().revision, new AbortController().signal, (input, data, readError) => {
      const baseline = evaluatePlan(input, saved.intent, "outcome", [], false);
      const candidates = candidatePlanMetrics(input, saved.intent, { maxCandidates: 3, maxEvaluations: 12, maxProposalsPerCandidate: 4 });
      return { readError, currentPublicDataReceived: data !== null,
        beforeCoverage: coverage(snapshot), afterCoverage: coverage(input),
        baseline: { legal: baseline.legal, comparisonEligible: baseline.comparisonEligible,
          projectedPointsKnown: Number.isFinite(baseline.projectedValue) },
        candidates: { count: candidates.activePoints.length,
          finiteNetPoints: candidates.activePoints.filter(([, value]) => Number.isFinite(value)).length,
          evaluated: candidates.search.evaluated, eligibleCandidates: candidates.search.eligibleCandidates,
          searchComplete: candidates.search.complete },
        currentWeekProofs: servedProofs.filter(row => row.closureSha256 === "9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219").length };
    });
  assert.equal(JSON.stringify(saved), beforeInput);
  assert.equal(hash(fs.readFileSync(savedInput)), hash(inputBytes));
  const report = { completedAt: new Date().toISOString(), requests, response: responseReceipt, ...result,
    originalInputUnchanged: true, yahooRequests: 0, credentialAccess: false, authenticatedYahooAcceptance: false,
    scope: "Current public serving plus bounded arithmetic using previously saved league inputs; no lineup change." };
  fs.writeFileSync(path.join(output, "public-serving-smoke.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
})().catch(error => {
  fs.writeFileSync(path.join(output, "public-serving-smoke.json"), JSON.stringify({ requests, response: responseReceipt,
    failed: true, error: error.message, authenticatedYahooAcceptance: false }, null, 2) + "\n");
  console.error(error.message); process.exitCode = 1;
}).finally(() => { globalThis.fetch = originalFetch; });

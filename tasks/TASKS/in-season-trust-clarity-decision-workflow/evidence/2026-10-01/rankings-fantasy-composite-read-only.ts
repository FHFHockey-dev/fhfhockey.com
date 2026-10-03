const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());

const output = process.argv[2];
if (!output) throw new Error("An output JSON path is required.");
const startedAt = new Date().toISOString();
const startedMs = Date.now();
const reads = new Map();
let blockedNonReadRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    blockedNonReadRequests++;
    throw new Error("Read-only audit blocked a non-read HTTP request.");
  }
  const url = new URL(input instanceof Request ? input.url : String(input));
  const response = await originalFetch(input, init);
  const key = `${method} ${url.pathname} ${response.status}`;
  reads.set(key, (reads.get(key) ?? 0) + 1);
  return response;
};

async function main() {
  const { buildSkaterCompositeRatingRows } = require("lib/rankings/skaterCompositeWriter");
  const { MCM_COMPONENTS } = require("lib/rankings/skaterCompositeMethodology");
  const request = { season: 20252026, asOfDate: "2026-04-16", window: "season", position: "all",
    deployment: "all", strength: "all", minGp: 1, minToiSeconds: 600, teamId: null,
    peerGroupType: "all_skaters", limit: 1000 };
  const built = await buildSkaterCompositeRatingRows(request);
  const componentKeys = [...MCM_COMPONENTS.riff, ...MCM_COMPONENTS.scoring];
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const percentiles = row => row.components_json?.percentiles ?? {};
  const scores = built.rows.map(row => row.mcm_score).filter(finite).sort((a, b) => a - b);
  const componentCoverage = Object.fromEntries(componentKeys.map(key => [key, {
    finitePercentileRows: built.rows.filter(row => finite(percentiles(row)[key])).length,
    missingPercentileRows: built.rows.filter(row => !finite(percentiles(row)[key])).length,
  }]));
  const quantile = p => scores.length ? scores[Math.floor((scores.length - 1) * p)] : null;
  const sourceHashes = Object.fromEntries(Object.keys(require.cache)
    .filter(file => file.startsWith(process.cwd() + path.sep) && !file.includes(path.sep + "node_modules" + path.sep))
    .map(file => [path.relative(process.cwd(), file), crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
  const receipt = {
    startedAt, completedAt: new Date().toISOString(), elapsedMs: Date.now() - startedMs,
    mode: "pure builder; network limited to GET/HEAD; no publisher endpoint or upsert called",
    nodeVersion: process.version, request, snapshotDate: built.snapshotDate,
    snapshotUpdatedAt: built.snapshotUpdatedAt, generatedRows: built.rows.length,
    finiteMcmRows: scores.length, nullMcmRows: built.rows.length - scores.length,
    componentCoverage, allSevenComponentsRows: built.rows.filter(row => componentKeys.every(key => finite(percentiles(row)[key]))).length,
    scoreDistribution: { min: quantile(0), p25: quantile(0.25), median: quantile(0.5), p75: quantile(0.75), max: quantile(1) },
    sourceFreshness: built.sourceFreshness, unavailableMetrics: built.unavailableMetrics,
    readRequests: Object.fromEntries(reads), blockedNonReadRequests, sourceHashes,
    limits: ["Scores are unpersisted builder output, not published Rankings availability.",
      "Partial component sets can yield MCM; finite scores alone do not certify full fantasy coverage.",
      "No stability, predictive evaluation, early-season reliability or complete-game ingestion is certified."]
  };
  fs.writeFileSync(output, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ output, generatedRows: receipt.generatedRows, finiteMcmRows: receipt.finiteMcmRows,
    allSevenComponentsRows: receipt.allSevenComponentsRows, snapshotDate: receipt.snapshotDate, elapsedMs: receipt.elapsedMs }));
}
main().catch(error => {
  console.error(JSON.stringify({ failed: true, code: error?.code ?? null,
    message: error?.message ?? "Read-only audit failed", blockedNonReadRequests, elapsedMs: Date.now() - startedMs }));
  process.exitCode = 1;
});

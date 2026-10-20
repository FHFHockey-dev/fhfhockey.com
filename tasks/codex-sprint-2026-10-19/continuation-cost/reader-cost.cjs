// Network-free actual-reader workload measurement. Writes only beside this script.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { createRequire } = require("node:module");
const os = require("node:os");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "web");
const ts = createRequire(path.join(web, "package.json"))("typescript");
globalThis.fetch = () => { throw new Error("Network forbidden in cost harness"); };
let workload;
let stats;
const loaded = new Map();
const hashes = {};
const singleRanking = process.argv.includes("--single-ranking");
const outputName = process.argv[2] || "reader-cost-results.json";
assert.equal(path.basename(outputName), outputName);
const metricKeys = ["points_per_60", "goals_per_60", "assists_per_60", "sog_per_60", "shot_attempts_per_60", "hits_per_60", "blocks_per_60", "ixg_per_60"];

function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  const source = fs.readFileSync(file, "utf8");
  hashes[path.relative(root, file)] = crypto.createHash("sha256").update(source).digest("hex");
  const module = { exports: {} };
  loaded.set(file, module);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = (name) => {
    if (name === "lib/supabase/server") return { __esModule: true, default: { from: query } };
    if (name === "./rankingMetadata") {
      const metadataFile = path.join(web, "lib/rankings/rankingMetadata.ts");
      const text = fs.readFileSync(metadataFile, "utf8");
      hashes[path.relative(root, metadataFile)] = crypto.createHash("sha256").update(text).digest("hex");
      return { CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT: text.match(/CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT = "([^"]+)"/)[1] };
    }
    assert(["./rankingCalculator", "./metricDefinitions"].includes(name), `Unexpected module: ${name}`);
    return load(path.resolve(path.dirname(file), `${name}.ts`));
  };
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  if (file.endsWith("/rankingCalculator.ts")) {
    const actual = module.exports.buildContextualRankingRows;
    module.exports.buildContextualRankingRows = (args) => {
      const start = performance.now();
      try { return actual(args); }
      finally { stats.rankCalls += 1; stats.rankCandidates += args.candidates.length; stats.rankingMs += performance.now() - start; }
    };
  }
  return module.exports;
}

function query(table) {
  const state = { table, fields: null, filters: {}, from: null, to: null, limit: null, orders: [] };
  const q = {
    select(fields) { state.fields = fields; return q; },
    eq(key, value) { state.filters[key] = value; return q; },
    lte() { return q; },
    in(key, values) { state.filters[key] = values; return q; },
    order(key, options) { state.orders.push([key, options?.ascending ?? true]); return q; },
    range(from, to) { state.from = from; state.to = to; return q; },
    limit(value) { state.limit = value; return q; },
    then(resolve, reject) {
      const start = performance.now();
      try {
        let data;
        let kind;
        if (table === "entity_metric_rankings" && state.fields === "snapshot_date") {
          kind = "snapshot"; data = [{ snapshot_date: "2026-04-16" }];
        } else if (table === "entity_metric_rankings") {
          kind = "rankingPages";
          assert.deepEqual(state.orders, [["metric_key", true], ["entity_id", true]]);
          assert.equal(state.limit, null);
          assert.equal(state.filters.entity_id, undefined);
          // Pre-indexed mock backend: no synthetic full-table sort on every page.
          data = workload.rows.slice(state.from, state.to + 1).map((row) => Object.fromEntries(state.fields.split(",").map((key) => [key, row[key]])));
        } else if (table === "players") {
          kind = "playerPages";
          data = state.filters.id.filter((id) => !workload.missingMetadata || id % 2 === 0).map((id) => ({ id, fullName: workload.missingMetadata ? null : `Fixture ${id}`, position: "C", team_id: 999, image_url: workload.missingMetadata ? "https://fixture.invalid/player.png" : null })).slice(state.from, state.to + 1);
        } else if (table === "teams") {
          kind = "teamPages";
          data = state.filters.id.filter((id) => !workload.missingMetadata || id % 2 === 0).map((id) => ({ id, abbreviation: `T${id}`, name: workload.missingMetadata ? null : `Fixture team ${id}` })).slice(state.from, state.to + 1);
        } else throw new Error(`Unexpected table ${table}`);
        const bytes = Buffer.byteLength(JSON.stringify(data));
        stats.queries += 1;
        stats[kind] += 1;
        stats.rowsByKind[kind] = (stats.rowsByKind[kind] ?? 0) + data.length;
        stats.estimatedJsonBytes += bytes;
        stats.mockMs += performance.now() - start;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } catch (error) { return Promise.reject(error).then(resolve, reject); }
    },
  };
  return q;
}

function fixture(size, metrics) {
  const rows = [];
  for (const metric_key of [...metrics].sort()) for (let entity_id = 1; entity_id <= size; entity_id += 1) {
    rows.push({ entity_id, team_id: (entity_id % 32) + 1, snapshot_date: "2026-04-16", metric_key,
      peer_group_type: "all_skaters", peer_group_key: "all", position_group: "forward", deployment_bucket: "L1",
      raw_value: (entity_id % 97) / 10, raw_rank: entity_id, percentile: 0, qualified_peer_count: size,
      minimum_sample_met: true, sample_confidence: "high", games_played: entity_id % 10 === 0 ? 1 : 10,
      toi_seconds: 7200, tags: ["fixture"], explanation_items: ["Synthetic stored rank; reader must recompute."], updated_at: "2026-04-16T06:00:00.000Z" });
  }
  return { rows };
}

const reader = load(path.join(web, "lib/rankings/entityMetricRankingReader.ts"));
const definitions = load(path.join(web, "lib/rankings/metricDefinitions.ts"));
for (const key of metricKeys) assert.equal(definitions.getContextualRankingMetricDefinition(key).availabilityStatus, "available");
const request = { entity: "skaters", season: 20252026, asOfDate: "2026-04-16", window: "last5", position: "all", deployment: "all", strength: "5v5", metric: "points_per_60", minGp: 5, minToiSeconds: 300, teamId: null, peerGroupType: "all_skaters", sort: "percentile", direction: "desc", limit: 25, entityIds: null };

async function run(metrics, hydrateMetadata, cache, overrides = {}) {
  if (cache === "cold") reader.clearEntityMetricRankingReaderCachesForTests();
  stats = { queries: 0, snapshot: 0, rankingPages: 0, playerPages: 0, teamPages: 0, rowsByKind: {}, estimatedJsonBytes: 0, rankCalls: 0, rankCandidates: 0, rankingMs: 0, mockMs: 0 };
  const start = performance.now();
  const surfaces = await reader.buildEntityMetricRankingSurfaces({ ...request, ...overrides }, metrics, { hydrateMetadata });
  const elapsedMs = performance.now() - start;
  return { surfaces, measurement: { hydrateMetadata, cache, ...stats, elapsedMs, readerOutsideMockMs: elapsedMs - stats.mockMs, responseJsonBytes: Buffer.byteLength(JSON.stringify([...surfaces])) } };
}

const normalize = (surfaces) => JSON.parse(JSON.stringify([...surfaces], (key, value) => key === "generatedAt" ? undefined : value));
const normalizedResponses = [];
const signature = (surfaces) => [...surfaces].map(([key, value]) => [key, value.rankings.map((row) => [row.entity.id, row.metric.rawRank, row.metric.percentile, row.metric.qualifiedPeerCount])]);

(async () => {
  const scenarios = [];
  for (const [label, size, metricCount] of [["small", 100, 1], ["representative-synthetic", 1000, 4], ["stress-synthetic", 10000, 8]]) {
    const metrics = metricKeys.slice(0, metricCount);
    workload = fixture(size, metrics);
    const measurements = [];
    let expected;
    for (let trial = 0; trial < 3; trial += 1) for (const hydrate of [false, true]) for (const cache of ["cold", "warm"]) {
      const result = await run(metrics, hydrate, cache);
      if (!expected) expected = signature(result.surfaces);
      assert.deepEqual(signature(result.surfaces), expected);
      assert.equal(result.measurement.snapshot, cache === "cold" ? metricCount : 0);
      assert.equal(result.measurement.rankingPages, Math.floor(size * metricCount / 1000) + 1);
      assert.equal(result.measurement.rowsByKind.rankingPages, size * metricCount);
      assert.equal(result.measurement.rankCalls, metricCount * (hydrate && !singleRanking ? 2 : 1));
      assert.equal(result.measurement.rankCandidates, size * metricCount * (hydrate && !singleRanking ? 2 : 1));
      for (const [, surface] of result.surfaces) {
        assert.equal(surface.rankings.length, 25);
        assert.equal(surface.rankings[0].metric.qualifiedPeerCount, size - size / 10);
        if (hydrate) assert.match(surface.rankings[0].entity.name, /^Fixture /);
      }
      if (trial === 0) normalizedResponses.push({ label, hydrate, cache, value: normalize(result.surfaces) });
      measurements.push({ trial, ...result.measurement });
    }
    // Display selection must preserve the complete cohort and selected minimums.
    const selectedId = size - 1;
    const selected = await run(metrics, false, "cold", { entityIds: [selectedId], limit: 1 });
    for (const [, surface] of selected.surfaces) {
      assert.equal(surface.rankings[0].entity.id, selectedId);
      assert.equal(surface.rankings[0].metric.qualifiedPeerCount, size - size / 10);
    }
    assert.equal(selected.measurement.rowsByKind.rankingPages, size * metricCount);
    scenarios.push({ label, entities: size, metrics, sourceRows: workload.rows.length, measurements, selectedEntityWorkload: selected.measurement });
  }
  workload = fixture(20, metricKeys.slice(0, 2));
  workload.missingMetadata = true;
  workload.rows[0].raw_value = null;
  for (const overrides of [{}, { entityIds: [1, 2, 19], limit: 2 }, { minGp: 100 }, { strength: "pp" }]) {
    const value = await run(metricKeys.slice(0, 2), true, "cold", overrides);
    normalizedResponses.push({ label: "metadata-missing-null-image-conflicting-player-team", overrides, value: normalize(value.surfaces) });
  }
  const output = { normalizedResponses, capturedAt: new Date().toISOString(), runtime: { executable: process.execPath, node: process.version, typescript: ts.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model, logicalCpuCount: os.cpus().length }, config: { trials: 3, readerPageSize: 1000, metadataChunkSize: 500, snapshotCacheTtlMs: 30000, displayLimit: 25, transport: "in-memory indexed query mock; JSON byte estimate excludes HTTP/compression/DB plan", timing: "rankingMs wraps actual calculator; elapsed includes mock serialization; no hosted latency/cost" }, sourceSha256: hashes, assertions: "passed: exact full cohort/pages, min-sample qualification, display selection, hydrated/unhydrated ranking equality, cold/warm snapshot behavior", scenarios };
  fs.writeFileSync(path.join(__dirname, outputName), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ assertions: "PASS", scenarios: scenarios.map((s) => ({ label: s.label, sourceRows: s.sourceRows, measurements: s.measurements.length })), output: path.join(__dirname, outputName) }));
})().catch((error) => { console.error(error); process.exitCode = 1; });

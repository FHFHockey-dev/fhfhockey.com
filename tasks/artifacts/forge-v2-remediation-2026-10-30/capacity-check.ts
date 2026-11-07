/** Bounded synthetic native-storage measurement. Never accepts a connection URL. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { fixtureVintage, FIXTURE_TARGET } from "../../../web/lib/forge-v2/fixtures";
import { PostgresHistoryStore, SqlConnection } from "../../../web/lib/forge-v2/history.server";
import { FileArtifactStore } from "../../../web/lib/forge-v2/artifacts.server";
import { canonicalJson, DEFAULT_SCORING } from "../../../web/lib/forge-v2/identity";
import { contentHash } from "../../../web/lib/forge-v2/hash.server";
import { PreparedForgeReadRepository, PreparedPlayerContext } from "../../../web/lib/forge-v2/api.server";
import { fixtureOpportunity } from "../../../web/lib/forge-v2/fixtures";

const exec = promisify(execFile), bin = "/opt/homebrew/opt/postgresql@17/bin";
const repositoryRoot = process.env.FORGE_FIXTURE_ROOT!;
const cleanEnvironment: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
const summary = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, mean: samples.reduce((s, x) => s + x, 0) / samples.length, p50: sorted[Math.ceil(sorted.length * 0.5) - 1], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], maximum: sorted.at(-1)! };
};

async function main() {
  assert.ok(repositoryRoot?.endsWith("/fhfhockey.com"), "Explicit local fixture repository required");
  const root = await mkdtemp(join(tmpdir(), "forge-capacity-")), socket = join(root, "socket"), start = performance.now();
  let admin: Pool | undefined, db: Pool | undefined, started = false, statements = 0;
  const deadline = () => { if (performance.now() - start > 90000) throw new Error("synthetic_capacity_wall_limit"); };
  try {
    await mkdir(socket, { mode: 0o700 });
    await exec(join(bin, "initdb"), ["-D", join(root, "data"), "--no-locale", "--encoding=UTF8", "--auth-local=trust", "--auth-host=reject", "-U", "forge_capacity_fixture"], { env: cleanEnvironment, timeout: 20000 });
    await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-l", join(root, "server.log"), "-w", "-t", "10", "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -c forge_v2.fixture=capacity-isolated -p 65442`, "start"], { env: cleanEnvironment, timeout: 20000 });
    started = true;
    admin = new Pool({ host: socket, port: 65442, user: "forge_capacity_fixture", database: "postgres", max: 1, query_timeout: 5000 });
    assert.equal((await admin.query("select current_setting('forge_v2.fixture') as marker")).rows[0].marker, "capacity-isolated");
    await admin.query("create role anon; create role authenticated; create role service_role login");
    await admin.query(await readFile(join(repositoryRoot, "supabase/migrations/20261029235656_forge_v2_immutable_history.sql"), "utf8"));
    db = new Pool({ host: socket, port: 65442, user: "service_role", database: "postgres", max: 1, query_timeout: 5000 });
    const counted: SqlConnection = { query: <T extends Record<string, unknown>>(text: string, values?: unknown[]) => { deadline(); assert.ok(++statements <= 500, "hard statement cap"); return db!.query<T>(text, values); } };
    const store = new PostgresHistoryStore(counted);
    const sample = (n: number) => fixtureVintage({ id: `capacity-vintage-${n}`, issuanceKey: `capacity-issuance-${n}`, sequence: n, limitations: ["synthetic_capacity_only_not_issued_forecast_evidence"] });
    const publicationMs: number[] = [];
    for (let n = 1; n <= 25; n++) {
      const at = performance.now(); await store.publish(sample(n)); publicationMs.push(performance.now() - at);
    }
    // Bulk fixture rows test retained-history scale, not generation/issuance throughput.
    const bulk = Array.from({ length: 3005 }, (_, i) => sample(i + 100)), atBulk = performance.now();
    await counted.query(`insert into forge_v2_private.forge_v2_vintages(id,issuance_key,issuance_sequence,player_id,game_id,payload)
      select v->>'id',v->>'issuanceKey',(v->>'sequence')::bigint,(v->>'playerId')::bigint,(v->>'gameId')::bigint,p from jsonb_array_elements_text($1::jsonb) p cross join lateral (select p::jsonb v) x`, [JSON.stringify(bulk.map(canonicalJson))]);
    await counted.query("insert into forge_v2_private.forge_v2_publication_receipts(vintage_id,output_hash,confirmed_at,witness) select id,output_hash,clock_timestamp(),'committed_readback' from forge_v2_private.forge_v2_vintages where issuance_sequence>=100");
    const bulkInsertMs = performance.now() - atBulk;
    const pageMs: number[] = []; let cursor: string | undefined, totalRows = 0, totalBytes = 0;
    do {
      const at = performance.now(), page = await store.history(FIXTURE_TARGET.playerId, FIXTURE_TARGET.gameId, 200, cursor);
      pageMs.push(performance.now() - at); totalRows += page.revisions.length; totalBytes += Buffer.byteLength(JSON.stringify(page)); cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(totalRows, 3030);
    const relationBytes = (await admin.query("select c.relname,pg_total_relation_size(c.oid)::text as bytes from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='forge_v2_private' and c.relkind='r' order by c.relname")).rows;
    const artifacts = new FileArtifactStore(join(root, "online"), join(root, "archive"));
    const artifactPayload = { schemaVersion: "synthetic-capacity-only", data: "x".repeat(1024 * 1024) };
    const reference = { id: "capacity-artifact", sha256: contentHash(artifactPayload), version: "synthetic-v1", kind: "joint_distribution" as const, schemaVersion: artifactPayload.schemaVersion, decoderVersion: "synthetic-only", calculationVersion: "synthetic-only", targetVersion: FIXTURE_TARGET.targetVersion, conditioning: FIXTURE_TARGET.conditioning, categories: ["G" as const], horizons: [10 as const], cohorts: ["capacity"], profileIds: [DEFAULT_SCORING.id] };
    const artifactTimings: Record<string, number> = {};
    for (const [name, action] of [["put", () => artifacts.put(reference, artifactPayload)], ["archive", () => artifacts.archive(reference)], ["archivedRead", async () => { const r = await artifacts.read(reference); assert.equal(r.state, "available"); assert.equal(r.state === "available" && r.location, "archived"); }], ["restore", () => artifacts.restore(reference)]] as const) {
      deadline(); const at = performance.now(); await action(); artifactTimings[name] = performance.now() - at;
    }
    const restored = await artifacts.read(reference); assert.equal(restored.state, "available");
    if (restored.state === "available") assert.equal(contentHash(JSON.parse(restored.bytes)), reference.sha256);
    // Ten-game read payload measured with actual repository projection; unsupported values stay unavailable.
    const context: PreparedPlayerContext = { id: "synthetic-ten-game-context", player: { id: FIXTURE_TARGET.playerId, name: "Synthetic capacity skater" }, publicApproved: true, asOf: new Date().toISOString(), games: Array.from({ length: 10 }, (_, i) => ({ opportunity: fixtureOpportunity({ gameId: FIXTURE_TARGET.gameId + i, horizon: (10 - i) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 }), latestVintageId: null, finalVintageId: null, outcome: null, epochs: [], events: [], freshness: { state: "unavailable" as const, asOf: new Date().toISOString(), reason: "synthetic_capacity_no_qualified_vintage" } })), excluded: [], qualifications: [], accountability: { requested: 0, forecastCount: 0, outcomeCount: 0, abstentions: 0, mae: { state: "unavailable", reason: "fixture" }, rmse: { state: "unavailable", reason: "fixture" }, bias: { state: "unavailable", reason: "fixture" }, evidenceClass: "fixture", limitations: ["synthetic_only"] } };
    const repository = new PreparedForgeReadRepository({ players: async () => [context.player], read: async () => context, readGame: async () => context }, store, artifacts);
    const apiAt = performance.now(), view = await repository.player(FIXTURE_TARGET.playerId, DEFAULT_SCORING), apiMs = performance.now() - apiAt;
    assert.equal(view!.games.length, 10);
    console.log(JSON.stringify({ status: "SYNTHETIC_CAPACITY_MEASURED", evidenceClass: "fixture", codeCandidate: "7113329d2c24b8629f54484df37441f95a63d853", limits: { maxStatements: 500, maxWallMs: 90000, concurrency: 1, nativeRows: 3030, artifactPayloadBytes: Buffer.byteLength(canonicalJson(artifactPayload)), externalRequests: 0 }, measured: { storageStatements: statements, publicationMs: summary(publicationMs), bulkFixtureInsertMs: bulkInsertMs, historyPageMs: summary(pageMs), historyRows: totalRows, historySerializedBytes: totalBytes, relationBytes, artifactMs: artifactTimings, unqualifiedTenGameProjectionMs: apiMs, unqualifiedTenGamePayloadBytes: Buffer.byteLength(JSON.stringify(view)), elapsedMs: performance.now() - start, nodeResourceUsage: process.resourceUsage() }, activationQualified: false, limitations: ["Local native database, not hosted latency or billing", "25 publication-barrier calls measured separately from 3005 bulk fixture inserts", "1 MiB artifact measures verified I/O only, not calibrated inference", "Ten-game view has unqualified values and is not a qualified full-population payload benchmark", "Real model size, final scope, full-scale browser, remote storage pricing and v1/RSO reservations remain unmeasured"] }, null, 2));
  } finally {
    await db?.end(); await admin?.end();
    if (started) await exec(join(bin, "pg_ctl"), ["-D", join(root, "data"), "-w", "-t", "10", "stop", "-m", "fast"], { env: cleanEnvironment, timeout: 20000 });
    await rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

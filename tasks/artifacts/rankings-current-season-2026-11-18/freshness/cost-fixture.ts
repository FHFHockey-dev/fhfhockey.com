import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { runDailyRankingPublication } from "lib/rankings/dailyPublicationDispatch";
import { seedDailyRankingInput } from "lib/rankings/__acceptance__/dailyRankingInput";
import { MAX_DISPATCH_REQUESTS } from "lib/rankings/dailyPublicationPolicy";
import type { FakeDb } from "lib/rankings/__acceptance__/fakeSupabase";

const season = 20262027, cutoff = "2026-11-17", prior = "2026-11-14", size = 800;
type Row = Record<string, any>;
const db: FakeDb = { tables: Object.fromEntries(["players", "teams", "wgo_skater_stats", "rolling_player_game_metrics",
  "rolling_player_metric_support_payloads", "entity_metric_rankings", "skater_composite_ratings", "ranking_publications"]
  .map(table => [table, []])), calls: [] };
const expectedRollingSources: Row[] = [];
const windows = ["season", "last_5", "last_10", "last_20"];
for (let index = 0; index < size; index++) {
  const id = 8470000 + index, team = 1 + index % 32, group = (team - 1) >> 1;
  const date = new Date(Date.parse(cutoff) - (group % 5) * 86400000).toISOString().slice(0, 10);
  const gameId = 2026020050 + 50 * group;
  seedDailyRankingInput(db, season, id, date, 1 + index % 22, gameId);
  db.tables.players.push({ id, fullName: "Fixture " + id, position: index % 3 === 0 ? "D" : "C", team_id: team, image_url: null });
  const rolling = db.tables.rolling_player_game_metrics.at(-1)!;
  const support = db.tables.rolling_player_metric_support_payloads.at(-1)!;
  rolling.team_id = team; support.team_id = team;
  const history = (support.windowCountSupport as Row).windows.last20;
  for (let i = 0; i < 19; i++) db.tables.wgo_skater_stats.push({
    player_id: id, season_id: season, date: history.gameDates[i], game_id: history.gameIds[i], games_played: 1,
  });
  expectedRollingSources.push({ playerId: id, gameId, gameDate: date, updatedAt: rolling.updated_at, supportUpdatedAt: support.updated_at });
}
for (let id = 1; id <= 32; id++) db.tables.teams.push({ id, abbreviation: "T" + id, name: "Fixture team " + id });

const indexByTable = new Map<string, Map<string, Row>>();
const stats = new Map<string, { calls: number; inputRows: number; outputRows: number; requestBytes: number; responseBytes: number }>();
const ledger: Row[] = [], phases: Row[] = [];
let stage = "admission", stageStart = performance.now();
function phase(next: string) {
  phases.push({ phase: stage, elapsedMs: Math.round(performance.now() - stageStart) });
  stage = next; stageStart = performance.now();
}

function readRows(table: string, url: URL) {
  let rows = db.tables[table];
  assert.ok(rows, "unknown table " + table);
  for (const [field, expr] of url.searchParams) {
    if (["select","order","limit","offset"].includes(field)) continue;
    if (field === "or") {
      const ids = new Set([...expr.matchAll(/and\(player_id\.eq\.(\d+),game_date\.eq\.([0-9-]+)\)/g)].map(m => m[1] + ":" + m[2]));
      assert.ok(ids.size); rows = rows.filter(r => ids.has(r.player_id + ":" + r.game_date)); continue;
    }
    const [op, ...pieces] = expr.split("."), val = pieces.join(".");
    if (op === "eq") rows = rows.filter(r => String(r[field]) === val);
    else if (op === "gte") rows = rows.filter(r => String(r[field]) >= val);
    else if (op === "lte") rows = rows.filter(r => String(r[field]) <= val);
    else if (op === "in") { const set = new Set(val.slice(1, -1).split(",")); rows = rows.filter(r => set.has(String(r[field]))); }
    else throw Error("unknown query " + field + " " + expr);
  }
  const count = rows.length;
  const order = url.searchParams.get("order")?.split(",").map(k => k.split("."));
  if (order) rows = [...rows].sort((a,b) => {
    for (const [field, dir] of order) if (a[field] !== b[field]) return (a[field]! < b[field]! ? -1 : 1) * (dir === "desc" ? -1 : 1);
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") || 0), limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 1000));
  return { count, rows: rows.slice(offset, offset + limit) };
}
function verifyComplete() {
  const markers = db.tables.ranking_publications.filter(r => r.snapshot_date === cutoff);
  assert.equal(markers.length, 5);
  const expectedIds = new Set(expectedRollingSources.map(s => s.playerId));
  const rankRows = db.tables.entity_metric_rankings, composites = db.tables.skater_composite_ratings;
  for (const window of windows) {
    const marker = markers.find(m => m.surface === "entity_metric_rankings" && m.window_type === window)!;
    assert.equal(marker.status, "complete"); assert.equal(marker.written_entities, size); assert.equal(marker.db_written_rows, size * 17);
    assert.equal(marker.metric_set.length, 17);
    const seen = new Map<string, Set<number>>();
    for (const r of rankRows.filter(r => r.window_type === window)) {
      assert.equal(r.snapshot_date, cutoff); assert.equal(r.peer_group_key, "all");
      const ids = seen.get(String(r.metric_key)) ?? new Set(); ids.add(Number(r.entity_id)); seen.set(String(r.metric_key), ids);
    }
    assert.equal(seen.size, 17);
    for (const metric of marker.metric_set as string[]) assert.deepEqual(seen.get(metric), expectedIds);
  }
  const m = markers.find(m => m.surface === "skater_composite_ratings")!;
  assert.equal(m.status,"complete"); assert.equal(m.db_written_rows,size); assert.equal(m.written_entities,size);
  assert.equal(rankRows.length, size * 17 * 4); assert.equal(composites.length, size);
  assert.deepEqual(new Set(composites.map(r => r.player_id)), expectedIds);
  assert.ok(composites.every(r => r.snapshot_date === cutoff && r.peer_group_key === "all_skaters" && Number.isFinite(r.mcm_score)));
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, "http://fixture.invalid");
  assert.ok(url.pathname.startsWith("/rest/v1/"));
  const target = url.pathname.replace("/rest/v1/", ""), op = init.method || "GET";
  const key = op + " " + target;
  const tally = stats.get(key) ?? { calls: 0, inputRows: 0, outputRows: 0, requestBytes: 0, responseBytes: 0 };
  stats.set(key,tally); tally.calls++;
  const headers = new Headers(init.headers);
  const body = init.body ? JSON.parse(String(init.body)) : null;
  tally.requestBytes += init.body ? Buffer.byteLength(String(init.body)) : 0;
  let payload: unknown = null, count = 0, status = 200;
  if (target.startsWith("rpc/")) {
    if (target.endsWith("/claim_ranking_publication_dispatch")) payload = { outcome: "claimed", id: "fixture-claim", priorCutoff: prior };
    else if (target.endsWith("/read_rankings_publication_readiness")) payload = {
      status:"ready", cutoffDate:cutoff, readyAt:cutoff + "T12:00:00Z", evidence:{ fixture:true }, expectedRollingSources,
    };
    else if (target.endsWith("/latest_ranking_publication_cutoff")) {
      verifyComplete(); payload = cutoff;
    } else if (target.endsWith("/record_ranking_publication_dispatch")) {
      ledger.push(body); phase(body.p_status === "complete" ? "terminal" : body.p_stage);
    } else throw Error("unexpected RPC " + target);
  } else if (op === "POST") {
    assert.ok(["entity_metric_rankings","skater_composite_ratings","ranking_publications"].includes(target));
    const keys = url.searchParams.get("on_conflict")!.split(",");
    const index = indexByTable.get(target) ?? new Map<string, Row>(); indexByTable.set(target,index);
    for (const row of body) {
      const compositeKey = JSON.stringify(keys.map(k => row[k]));
      const existing = index.get(compositeKey);
      if (existing) Object.assign(existing,row);
      else { index.set(compositeKey,row); db.tables[target].push(row); }
    }
    count = body.length; tally.inputRows += count; status = 201;
  } else {
    assert.ok(op === "GET" || op === "HEAD");
    const read = readRows(target,url); count = read.count;
    if (op === "GET") {
      const fields = (url.searchParams.get("select") ?? "*").split(",");
      payload = read.rows.map(r => fields[0] === "*" ? r : Object.fromEntries(fields.map(f => {
        const key = f.split(":")[0]; return [key, r[key] ?? null];
      })));
      tally.outputRows += read.rows.length;
    }
  }
  const text = payload === null ? null : JSON.stringify(payload);
  tally.responseBytes += text ? Buffer.byteLength(text) : 0;
  const sentHeaders: Record<string,string> = { "Content-Type":"application/json" };
  if (headers.get("prefer")?.includes("count=exact")) sentHeaders["Content-Range"] = "*/" + count;
  return new Response(text, { status, headers: sentHeaders });
};

async function main() {
  const NativeDate = Date;
  const start = performance.now(), pinned = Date.parse("2026-11-18T13:46:05Z");
  globalThis.Date = class extends NativeDate {
    constructor(...args: any[]) { super(...(args.length ? args : [pinned + performance.now() - start]) as [number]); }
    static now() { return Math.floor(pinned + performance.now() - start); }
  } as DateConstructor;
  stageStart = start;
  const result = await runDailyRankingPublication();
  assert.equal(result.status, "complete", JSON.stringify(result));
  const elapsedMs = Math.round(performance.now() - start);
  assert.equal(ledger.at(-1)?.p_status,"complete");
  const total = [...stats.values()].reduce((n, s) => n + s.calls, 0);
  assert.equal(ledger.at(-1)?.p_evidence.dbRequestsBeforeReceipt + 1, total);
  verifyComplete();
  const report = {
    checkoutBase: process.env.CHECKOUT_BASE, runtimeGraphSha256: process.env.GRAPH_SHA256, runtimeSourceFiles: Number(process.env.GRAPH_FILES),
    node: process.version, season, cutoff, skaters: size, wgoAppearances: db.tables.wgo_skater_stats.length, metrics: 17,
    totalDbRequests: total, hardBudget: MAX_DISPATCH_REQUESTS, remaining: MAX_DISPATCH_REQUESTS - total,
    elapsedMs, phases, maxRSSKiB: process.resourceUsage().maxRSS,
    requestBodyBytes: [...stats.values()].reduce((n,s)=>n+s.requestBytes,0),
    responseBodyBytes: [...stats.values()].reduce((n,s)=>n+s.responseBytes,0),
    operations: Object.fromEntries(stats), verified: {
      rankings: db.tables.entity_metric_rankings.length, composites: db.tables.skater_composite_ratings.length,
      completeMarkers: db.tables.ranking_publications.length, allMetricsMatchEveryExpectedPlayer: true,
      terminalEvidence: ledger.at(-1)?.p_evidence,
    },
  };
  writeFileSync(process.env.COST_OUTPUT!, JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ total, elapsedMs, remaining:report.remaining, rankings:report.verified.rankings, composites:report.verified.composites }));
}
main().catch(error => { console.error(error); process.exitCode=1; });

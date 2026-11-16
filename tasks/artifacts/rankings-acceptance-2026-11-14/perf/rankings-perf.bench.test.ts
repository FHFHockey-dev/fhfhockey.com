/*
 * OFFLINE micro-benchmark of the Rankings skater read paths at 89da739cb.
 * NOT production latency. A fake Supabase client serves a synthetic cohort
 * (750 skaters, 32 teams, 60 game dates) and counts every round trip.
 * It fails closed: unknown tables throw, and globalThis.fetch throws and is
 * counted, so an unmocked network call cannot succeed.
 *
 * Run from web/ (no GIT_DIR):
 *   npx vitest run --globals --environment node \
 *     --dir ../tasks/artifacts/rankings-acceptance-2026-11-14/perf
 * Results: perf/bench-results.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const WEB = "/Users/tim/Code/fhfhockey.com/web";

const H = vi.hoisted(() => {
  const state = {
    latencyMs: 0,
    mode: "durable" as "durable" | "fallback",
    nullMetricPrefix: null as string | null, // e.g. "ixg_per_60" -> never calculable
    calls: [] as Array<{ table: string; rows: number; bytes: number; filters: string }>,
    fetchCalls: 0,
    mockMs: 0,
    seasonTotals: true, // L6 currentSeason.seasonTotals present (SAX% calculable)
  };
  const PLAYERS = 750;
  const TEAMS = 32;
  const DATES: string[] = [];
  for (let d = 0; d < 60; d += 1) {
    const date = new Date(Date.UTC(2026, 10, 13) - d * 86_400_000);
    DATES.push(date.toISOString().slice(0, 10));
  }
  const playerId = (i: number) => 8470000 + i;
  const teamOf = (i: number) => (i % TEAMS) + 1;
  const isD = (i: number) => i % 3 === 2;
  const playsOn = (i: number, dateIndex: number) => (i + dateIndex) % 2 === 0;
  function rnd(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  function rollingRow(i: number, dateIndex: number, fields: string[], strength: string) {
    const row: Record<string, unknown> = {};
    for (const f of fields) {
      let v: unknown;
      if (f === "player_id") v = playerId(i);
      else if (f === "game_date") v = DATES[dateIndex];
      else if (f === "updated_at") v = `${DATES[dateIndex]}T08:00:00.000Z`;
      else if (f === "game_id") v = 2026020000 + dateIndex * 40 + (i % 40);
      else if (f === "season") v = 20262027;
      else if (f === "team_id") v = teamOf(i);
      else if (f === "strength_state") v = strength;
      else if (f === "line_combo_group") v = isD(i) ? "defense" : "forward";
      else if (f === "line_combo_slot") v = (i % 4) + 1;
      else if (f === "pp_unit") v = i % 5 === 0 ? 1 : i % 5 === 1 ? 2 : null;
      else if (/games_played|participation_games/.test(f)) v = 14;
      else if (/^toi_seconds_avg/.test(f)) v = 600 + Math.round(rnd(i * 7 + f.length) * 900);
      else if (/^toi_seconds_total/.test(f)) v = 6000 + Math.round(rnd(i * 11 + f.length) * 9000);
      else if (state.nullMetricPrefix && f.startsWith(state.nullMetricPrefix)) v = null;
      else v = Math.round(rnd(i * 13 + dateIndex + f.length * 3) * 1000) / 100;
      row[f] = v;
    }
    return row;
  }
  function supportRow(i: number, dateIndex: number, strength: string) {
    const win = (n: number) => ({
      appearances: n,
      gameIds: Array.from({ length: n }, (_, k) => 2026020000 + k),
      gameDates: Array.from({ length: n }, (_, k) => DATES[Math.min(59, dateIndex + 2 * k)]),
      ratio: {},
      secondary: {},
    });
    return {
      player_id: playerId(i),
      game_date: DATES[dateIndex],
      game_id: 2026020000 + dateIndex * 40 + (i % 40),
      windowCountSupport: {
        version: "rolling-player-window-counts-v1",
        strengthState: strength,
        anchor: { gameId: null, gameDate: DATES[dateIndex], season: 20262027 },
        selection: "chronological_appearances_in_strength_state",
        game: { appeared: true, ratio: {}, additive: {} },
        windows: { last5: win(5), last10: win(10), last20: win(20) },
        ...(state.seasonTotals ? { currentSeason: {
          version: "rolling-player-window-counts-current-season-v1", season: 20262027,
          selection: "chronological_appearances_in_strength_state_current_season",
          windows: { last5: win(5), last10: win(10), last20: win(20) },
          seasonTotals: { ratio: {
            expected_sh_pct: [3.1 + (i % 7) / 10, 40 + (i % 9), 14],
            goals_per_60: [4 + (i % 5), 12000, 14],
          }, secondary: {} },
        } } : {}),
      },
    };
  }
  function playerIndex(id: unknown) {
    return Number(id) - 8470000;
  }
  function project(row: Record<string, unknown>, select: string | null) {
    if (!select || /[:>(]/.test(select)) return row;
    const out: Record<string, unknown> = {};
    for (const f of select.split(",")) out[f] = row[f];
    return out;
  }

  function resolve(q: any): any[] {
    const f = q.filters;
    const t = q.table;
    if (t === "rolling_player_game_metrics") {
      const strength = String(f.eq.strength_state ?? "5v5");
      const fields = String(q.select).split(",");
      if (q.select === "game_date") return [{ game_date: DATES[0] }];
      if (f.eq.player_id != null) {
        const i = playerIndex(f.eq.player_id);
        const d = DATES.findIndex((_, k) => playsOn(i, k));
        return [rollingRow(i, d, fields, strength)];
      }
      const d = DATES.indexOf(String(f.eq.game_date));
      const rows: any[] = [];
      for (let i = 0; i < PLAYERS; i += 1) {
        if (playsOn(i, d)) rows.push(rollingRow(i, d, fields, strength));
      }
      return rows;
    }
    if (t === "rolling_player_metric_support_payloads") {
      const strength = String(f.eq.strength_state ?? "5v5");
      if (f.eq.player_id != null) {
        return [{ appearances: 10 }];
      }
      const d = DATES.indexOf(String(f.eq.game_date));
      const rows: any[] = [];
      for (let i = 0; i < PLAYERS; i += 1) if (playsOn(i, d)) rows.push(supportRow(i, d, strength));
      return rows;
    }
    if (t === "games") {
      const rows: any[] = [];
      for (const date of DATES) for (let g = 0; g < 4; g += 1) rows.push({ date });
      return rows;
    }
    if (t === "players") {
      const ids: number[] = f.in.id ?? [];
      return ids.map((id) => {
        const i = playerIndex(id);
        return {
          id, fullName: `Skater ${i}`, position: isD(i) ? "D" : ["C", "L", "R"][i % 3],
          team_id: teamOf(i), image_url: `https://example.invalid/${id}.png`,
        };
      });
    }
    if (t === "teams") {
      const all = Array.from({ length: TEAMS }, (_, k) => ({
        id: k + 1, abbreviation: `T${String(k + 1).padStart(2, "0")}`, name: `Team ${k + 1}`,
      }));
      const ids: number[] | undefined = f.in.id;
      return ids ? all.filter((r) => ids.includes(r.id)) : all;
    }
    if (t === "skater_composite_ratings") return [];
    if (t === "entity_metric_rankings") {
      if (state.mode === "fallback") return [];
      if (q.select === "snapshot_date") return [{ snapshot_date: DATES[0] }];
      const keys: string[] = f.in.metric_key ?? [];
      const rows: any[] = [];
      for (const metricKey of keys) {
        if (state.nullMetricPrefix && metricKey.startsWith(state.nullMetricPrefix)) continue;
        const order = Array.from({ length: PLAYERS }, (_, i) => i)
          .sort((a, b) => rnd(b * 13 + metricKey.length) - rnd(a * 13 + metricKey.length));
        order.forEach((i, rank) => rows.push({
          entity_id: playerId(i), team_id: teamOf(i), snapshot_date: DATES[0], metric_key: metricKey,
          peer_group_type: f.eq.peer_group_type, peer_group_key: f.eq.peer_group_key,
          position_group: isD(i) ? "D" : "F", deployment_bucket: `L${(i % 4) + 1}`,
          raw_value: Math.round(rnd(i * 13 + metricKey.length) * 1000) / 100, raw_rank: rank + 1,
          percentile: Math.round((1 - rank / PLAYERS) * 1000) / 10, qualified_peer_count: PLAYERS,
          minimum_sample_met: true, sample_confidence: "high", games_played: 14, toi_seconds: 12000,
          tags: [], explanation_items: [], updated_at: `${DATES[0]}T09:00:00.000Z`,
        }));
      }
      return rows.sort((a, b) => (a.metric_key < b.metric_key ? -1 : a.metric_key > b.metric_key ? 1 : a.entity_id - b.entity_id));
    }
    throw new Error(`FAIL-CLOSED: unexpected table ${t}`);
  }

  function makeQuery(table: string) {
    const q: any = { table, select: null, filters: { eq: {}, in: {}, lte: {} }, range: null, limit: null };
    const exec = async () => {
      if (state.latencyMs > 0) await new Promise((r) => setTimeout(r, state.latencyMs));
      const m0 = performance.now();
      let rows = resolve(q);
      rows = rows.map((r) => project(r, q.select));
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
      else if (q.limit != null) rows = rows.slice(0, q.limit);
      else rows = rows.slice(0, 1000); // PostgREST max_rows
      const bytes = JSON.stringify(rows).length;
      state.calls.push({ table, rows: rows.length, bytes, filters: JSON.stringify(q.filters.eq) });
      state.mockMs += performance.now() - m0;
      return { data: q.single ? rows[0] ?? null : rows, error: null };
    };
    const chain: any = {
      select(s: string) { q.select = s; return chain; },
      eq(k: string, v: unknown) { q.filters.eq[k] = v; return chain; },
      lte(k: string, v: unknown) { q.filters.lte[k] = v; return chain; },
      gte(k: string, v: unknown) { q.filters.lte[`>=${k}`] = v; return chain; },
      lt: (k: string, v: unknown) => chain.lte(k, v),
      in(k: string, v: unknown) { q.filters.in[k] = v; return chain; },
      order() { return chain; },
      not() { return chain; },
      is() { return chain; },
      range(a: number, b: number) { q.range = [a, b]; return chain; },
      limit(n: number) { q.limit = n; return chain; },
      maybeSingle() { q.single = true; return chain; },
      single() { q.single = true; return chain; },
      then(res: any, rej: any) { return exec().then(res, rej); },
    };
    return chain;
  }
  const client = { from: (table: string) => makeQuery(table), rpc: () => { throw new Error("FAIL-CLOSED: rpc"); } };
  return { state, client, DATES };
});

vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/supabase/server", () => ({
  default: H.client,
  supabase: H.client,
  getServiceRoleClient: () => H.client,
}));

import { writeFileSync } from "node:fs";
import {
  buildPlayerMatrixSurface,
  clearPlayerMatrixSurfaceCachesForTests,
  parsePlayerMatrixRequest,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/playerMatrix";
import { clearContextualRankingsQueryCachesForTests } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/entityMetricRankingReader";
import { buildContextualRankingSnapshotSurface } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/snapshot";
import { buildContextualRankingComparisonSurface } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/comparison";
import { buildTrendingSurface, parseTrendingRequest } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/trending";

const BASE = {
  entity: "skaters", season: "20262027", window: "season", position: "all", deployment: "all",
  strength: "5v5", min_gp: "10", min_toi: "300", sort_metric: "points_per_60", sort_direction: "desc",
  page: "1", page_size: "10", ranking_source: "entity_metric_rankings",
};

function clearAll() {
  clearPlayerMatrixSurfaceCachesForTests();
  clearContextualRankingsQueryCachesForTests();
  clearEntityMetricRankingReaderCachesForTests();
}

type Result = Record<string, unknown>;
const results: Result[] = [];

async function measure(name: string, run: () => Promise<unknown>, opts: { warm?: boolean } = {}) {
  const out: Result = { name };
  for (const latency of opts.warm ? [0] : [0, 20]) {
    if (!opts.warm) clearAll();
    H.state.latencyMs = latency;
    H.state.calls = [];
    H.state.mockMs = 0;
    const t0 = performance.now();
    const payload = await run();
    const ms = performance.now() - t0;
    const s0 = performance.now();
    const body = JSON.stringify(payload);
    const serializeMs = performance.now() - s0;
    const byTable: Record<string, { calls: number; rows: number; bytes: number }> = {};
    for (const c of H.state.calls) {
      byTable[c.table] ??= { calls: 0, rows: 0, bytes: 0 };
      byTable[c.table].calls += 1;
      byTable[c.table].rows += c.rows;
      byTable[c.table].bytes += c.bytes;
    }
    if (latency === 0) {
      Object.assign(out, {
        roundTrips: H.state.calls.length,
        rowsRead: H.state.calls.reduce((n, c) => n + c.rows, 0),
        mockBytesRead: H.state.calls.reduce((n, c) => n + c.bytes, 0),
        byTable,
        totalMsNoLatency: Math.round(ms),
        mockMs: Math.round(H.state.mockMs),
        computeMs: Math.round(ms - H.state.mockMs),
        serializeMs: Math.round(serializeMs * 10) / 10,
        responseBytes: body.length,
        status: (payload as any)?.status ?? (payload as any)?.meta?.rankingSource ?? null,
        rows: (payload as any)?.rows?.length ?? (payload as any)?.subjects?.length ?? null,
      });
    } else {
      out.msAt20msPerTrip = Math.round(ms);
      out.serialDepthEstimate = Math.round((ms - H.state.mockMs - (out.computeMs as number)) / 20);
    }
  }
  results.push(out);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
  return out;
}

const realFetch = globalThis.fetch;

describe("offline rankings perf (synthetic, not production)", () => {
  beforeAll(() => {
    globalThis.fetch = (async () => {
      H.state.fetchCalls += 1;
      throw new Error("FAIL-CLOSED: network fetch blocked");
    }) as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
    writeFileSync(
      `${__dirname}/bench-results.json`,
      JSON.stringify({ label: "OFFLINE synthetic cohort; not production latency", fetchCalls: H.state.fetchCalls, results }, null, 2),
    );
  });

  it("matrix durable p1 size10", async () => {
    H.state.mode = "durable"; H.state.nullMetricPrefix = null;
    await measure("matrix.durable.page1.size10", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any)));
    expect(H.state.fetchCalls).toBe(0);
  }, 600_000);
  it("matrix durable p1 size50", async () => {
    await measure("matrix.durable.page1.size50", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest({ ...BASE, page_size: "50" } as any)));
  }, 600_000);
  it("matrix durable warm repeat", async () => {
    await buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any));
    await measure("matrix.durable.page1.size10.warm-repeat(within 30s)", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any)), { warm: true });
  }, 600_000);
  it("matrix durable page2 after page1 (warm caches, new response key)", async () => {
    clearAll();
    await buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any));
    await measure("matrix.durable.page2.size10.after-page1", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest({ ...BASE, page: "2" } as any)), { warm: true });
  }, 600_000);
  it("matrix fallback p1 size10", async () => {
    H.state.mode = "fallback";
    await measure("matrix.fallback.page1.size10.common(ladder stops at date 0)", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any)));
  }, 600_000);
  it("matrix fallback p1 size50", async () => {
    await measure("matrix.fallback.page1.size50.common", () => buildPlayerMatrixSurface(parsePlayerMatrixRequest({ ...BASE, page_size: "50" } as any)));
  }, 600_000);
  it("matrix fallback full ladder (SAX% never calculable: no L6 season totals)", async () => {
    H.state.seasonTotals = false;
    let payload: any = null;
    await measure("matrix.fallback.page1.size10.full-ladder(no season totals)", async () => {
      payload = await buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any));
      return payload;
    });
    const metaText = JSON.stringify(payload.meta);
    const saxCell = payload.rows[0] && JSON.stringify(payload.rows[0]).match(/.{0,200}sax_percentage.{0,400}/)?.[0];
    const probe = {
      name: "discriminator.sax_percentage.full-ladder",
      metaKeys: Object.keys(payload.meta),
      unavailableMetrics: payload.meta.unavailableMetrics?.filter((m: any) => /sax/i.test(JSON.stringify(m))) ?? null,
      metaMentionsSax: (metaText.match(/.{0,160}sax.{0,240}/gi) ?? []).slice(0, 4),
      firstRowSaxFragment: saxCell ?? null,
      rankingSource: payload.meta.rankingSource, snapshotDate: payload.meta.snapshotDate,
      latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    };
    results.push(probe);
    console.log(JSON.stringify(probe));
    H.state.seasonTotals = true;
  }, 600_000);
  it("snapshot last-page player, durable", async () => {
    H.state.mode = "durable";
    const sorted = await buildPlayerMatrixSurface(parsePlayerMatrixRequest({ ...BASE, page_size: "50", page: "1" } as any));
    const last = sorted.meta.pageCount;
    const lastPage = await buildPlayerMatrixSurface(parsePlayerMatrixRequest({ ...BASE, page_size: "50", page: String(last) } as any));
    const target = lastPage.rows.at(-1)!.entity.id;
    (globalThis as any).__lastTarget = target;
    await measure(`snapshot.durable.last-page-player(pages=${last})`, () =>
      buildContextualRankingSnapshotSurface({ ...BASE, selected_player: String(target) } as any));
  }, 600_000);
  it("snapshot last-page player, fallback common", async () => {
    H.state.mode = "fallback";
    await measure("snapshot.fallback.last-page-player.common", () =>
      buildContextualRankingSnapshotSurface({ ...BASE, selected_player: String((globalThis as any).__lastTarget) } as any));
  }, 600_000);
  it("snapshot last-page player, fallback full ladder", async () => {
    H.state.seasonTotals = false;
    await measure("snapshot.fallback.last-page-player.full-ladder", () =>
      buildContextualRankingSnapshotSurface({ ...BASE, selected_player: String((globalThis as any).__lastTarget) } as any));
    H.state.seasonTotals = true;
  }, 600_000);
  it("comparison as the page sends it on default load (selected + first 5 rows), durable and fallback", async () => {
    H.state.mode = "durable";
    clearAll();
    const top = await buildPlayerMatrixSurface(parsePlayerMatrixRequest(BASE as any));
    const pageIds = top.rows.slice(0, 6).map((r: any) => r.entity.id).join(",");
    await measure("comparison.durable.default-load(top-6 ids)", () => buildContextualRankingComparisonSurface({ ...BASE, player_ids: pageIds } as any));
    H.state.mode = "fallback";
    await measure("comparison.fallback.default-load(top-6 ids).common", () => buildContextualRankingComparisonSurface({ ...BASE, player_ids: pageIds } as any));
    H.state.mode = "durable";
  }, 600_000);
  it("comparison 6 players spread across cohort, durable", async () => {
    H.state.mode = "durable";
    const ids = [8470000, 8470150, 8470300, 8470450, 8470600, (globalThis as any).__lastTarget].join(",");
    await measure("comparison.durable.6-way", () => buildContextualRankingComparisonSurface({ ...BASE, player_ids: ids } as any));
  }, 600_000);
  it("comparison 10 ids (server cap check; the page slices to 6)", async () => {
    const ids = Array.from({ length: 10 }, (_, k) => 8470000 + k).join(",");
    let error: unknown = null;
    H.state.calls = [];
    try { await buildContextualRankingComparisonSurface({ ...BASE, player_ids: ids } as any); } catch (e) { error = e; }
    const out = { name: "comparison.10-ids", threw: error instanceof Error ? error.message : null, statusCode: (error as any)?.statusCode ?? null, roundTrips: H.state.calls.length };
    results.push(out);
    console.log(JSON.stringify(out));
  }, 600_000);
  it("trending (page default request), durable rows present", async () => {
    H.state.mode = "durable";
    const req = parseTrendingRequest({ entity: "skaters", season: "20262027", position: "all", deployment: "all", strength: "5v5", min_gp: "10", min_toi: "300", sort_direction: "desc", limit: "25" } as any);
    await measure("trending.default", () => buildTrendingSurface(req));
  }, 600_000);
});

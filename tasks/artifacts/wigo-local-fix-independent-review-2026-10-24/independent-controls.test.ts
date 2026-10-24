import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), season: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));
vi.mock("lib/supabase", () => ({ default: { from: () => { throw new Error("Unexpected reader I/O"); } } }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.season }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));

import handler from "../../../web/pages/api/v1/db/calculate-wigo-stats";
import { buildPlayerAggregatedStats } from "../../../web/utils/fetchWigoPlayerStats";

type Row = Record<string, any>;
const playerId = 8476453;
function game(date: string, serial: number, season = 20262027): Row {
  return {
    player_id: playerId, game_id: Math.floor(season / 10000) * 1000000 + 20000 + serial,
    games_played: 1, season_id: season, season, date, date_scraped: date,
    goals: 0, assists: 1, points: 1, total_primary_assists: 1, shots: 0,
    pp_goals: 0, pp_assists: 0, pp_points: 0, pp_toi: 60, pp_toi_pct_per_game: 0,
    hits: 0, blocked_shots: 0, penalty_minutes: 0,
    toi: 1200, ixg: 0, icf: 0, iscfs: 0, hdcf: 0,
    gf: 2, sf: 10, off_zone_starts: 0, def_zone_starts: 2
  };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function fixture(nhl: Row[], individual: Row[], onIce = individual,
  fail?: { table: string; reject?: boolean }) {
  const tables: Record<string, Row[]> = freeze({
    players: [{ id: playerId, position: "R" }],
    wgo_skater_stats: nhl, nst_gamelog_as_counts: individual, nst_gamelog_as_counts_oi: onIce
  });
  const original = JSON.stringify(tables);
  const writes: Array<{ table: string; rows: Row[] }> = [];
  const traces: Array<{ table: string; calls: unknown[][] }> = [];
  mocks.from.mockImplementation((table: string) => {
    const calls: unknown[][] = [];
    traces.push({ table, calls });
    const filters: Array<(r: Row) => boolean> = [];
    const orders: Array<[string, boolean]> = [];
    let columns = "*", max = Infinity, begin = 0, end = Infinity;
    const q: any = {
      select(v: string) { columns = v; calls.push(["select", v]); return q; },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); calls.push(["eq", k, v]); return q; },
      neq(k: string, v: unknown) { filters.push(r => r[k] !== v); return q; },
      in(k: string, v: unknown[]) { filters.push(r => v.includes(r[k])); calls.push(["in", k, v]); return q; },
      order(k: string, o: { ascending: boolean }) { orders.push([k, o.ascending]); return q; },
      limit(n: number) { max = n; calls.push(["limit", n]); return q; },
      range(b: number, e: number) { begin = b; end = e; return q; },
      upsert(rows: Row[]) { writes.push({ table, rows }); return Promise.resolve({ error: null }); },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        if (fail?.table === table && fail.reject) return Promise.reject(new Error("synthetic rejection")).then(resolve, reject);
        let rows = (tables[table] ?? []).filter(r => filters.every(fn => fn(r)));
        rows.sort((a, b) => {
          for (const [k, asc] of orders) {
            const cmp = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
            if (cmp) return asc ? cmp : -cmp;
          }
          return 0;
        });
        const count = rows.length;
        rows = rows.slice(begin, Math.min(end + 1, begin + max));
        if (columns !== "*") rows = rows.map(r => Object.fromEntries(columns.split(",").map(k => k.trim()).map(k => [k, r[k]])));
        return Promise.resolve({ data: rows, error: fail?.table === table ? { message: "synthetic data-plus-error" } : null, count }).then(resolve, reject);
      }
    };
    return q;
  });
  return { tables, original, writes, traces };
}
async function run() {
  const response = {
    statusCode: 200, body: null as any,
    status(n: number) { this.statusCode = n; return this; },
    json(body: unknown) { this.body = body; return this; }
  };
  await handler({ method: "GET", query: {}, headers: {} } as any, response as any);
  return response;
}
function recent(f: ReturnType<typeof fixture>) { return f.writes.find(w => w.table === "wigo_recent")!.rows[0]; }

beforeEach(() => {
  mocks.from.mockReset();
  mocks.season.mockResolvedValue({ seasonId: 20262027, lastSeasonId: 20252026 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("independent WiGO builder boundaries", () => {
  it("joins exact season/date pairs despite Cartesian filter poisons; does not mutate frozen inputs", async () => {
    const a = game("2026-10-23", 1), b = game("2026-04-15", 1, 20252026);
    const poisons = [
      { ...a, season: 20252026, toi: 999999, gf: 999 },
      { ...b, season: 20262027, toi: 999999, gf: 999 },
      { ...a, player_id: 1, toi: 999999, gf: 999 }
    ];
    const f = fixture([a, b], [a, b, ...poisons]);
    expect((await run()).statusCode).toBe(200);
    expect(recent(f)).toMatchObject({ l5_gp: 2, l5_atoi: 20, l5_pts_per_60: 3, l5_ipp: 0.5 });
    expect(JSON.stringify(f.tables)).toBe(f.original);
  });

  it("distinguishes observed NST zero from missing/null numerator without erasing independent supported metrics", async () => {
    for (const ixg of [0, null, undefined]) {
      const g = game("2026-10-23", 1);
      const f = fixture([g], [{ ...g, ixg }], [g]);
      expect((await run()).statusCode).toBe(200);
      expect(recent(f).l5_ixg).toBe(ixg === 0 ? 0 : null);
      expect(recent(f).l5_ixg_per_60).toBe(ixg === 0 ? 0 : null);
      expect(recent(f)).toMatchObject({ l5_atoi: 20, l5_sog: 0, l5_sog_per_60: 0, l5_ipp: 0.5 });
    }
  });

  it("filters scratches before the NHL top-20 limit", async () => {
    const played = [1, 2, 3, 4, 5].map(n => game(`2026-10-${String(n).padStart(2, "0")}`, n));
    const scratches = Array.from({ length: 21 }, (_, i) => ({ ...game(`2026-11-${String(i + 1).padStart(2, "0")}`, i + 100), games_played: 0 }));
    const f = fixture([...scratches, ...played], played);
    expect((await run()).statusCode).toBe(200);
    expect(recent(f)).toMatchObject({ l5_gp: 5, l5_atoi: 20, l5_pts: 5 });
  });

  it.each([
    { game_id: "2026020001" }, { game_id: 2026020001.5 },
    { season_id: 20262028 }, { season_id: -1 }
  ])("rejects malformed NHL identity %j before publication", async (invalid) => {
    const g = game("2026-10-23", 1);
    const f = fixture([{ ...g, ...invalid }], [g]);
    expect((await run()).statusCode).toBe(500);
    expect(f.writes).toEqual([]);
  });

  it.each(["wgo_skater_stats_totals", "nst_seasonal_individual_counts", "nst_seasonal_on_ice_counts", "wgo_skater_stats", "nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"])("fails closed on simultaneous data and error from %s", async table => {
    const g = game("2026-10-23", 1);
    const f = fixture([g], [g], [g], { table });
    expect((await run()).statusCode).toBe(500);
    expect(f.writes).toEqual([]);
  });

  it("does not publish after a rejected NST read promise", async () => {
    const g = game("2026-10-23", 1);
    const f = fixture([g], [g], [g], { table: "nst_gamelog_as_counts", reject: true });
    expect((await run()).statusCode).toBe(500);
    expect(f.writes).toEqual([]);
  });
});

describe("independent WiGO reader snapshot authority", () => {
  it("never reads legacy recent rates, preserves historical precedence and leaves frozen inputs unchanged", () => {
    const input: any = { careerData: { player_id: playerId, ly_pts_per_60: 2 }, recentData: { player_id: playerId }, ratesData: { pts_per_60_ly: 4 }, totalsData: null };
    for (const n of [5, 10, 20]) {
      Object.assign(input.recentData, { [`l${n}_gp`]: 5, [`l${n}_atoi`]: 20, [`l${n}_pptoi`]: 60, [`l${n}_g_per_60`]: 0, [`l${n}_pts_per_60`]: 3, [`l${n}_ppp_per_60`]: 0 });
      for (const base of ["g", "pts", "ppp"]) Object.defineProperty(input.ratesData, `${base}_per_60_l${n}`, { get() { throw new Error("Legacy recent rates were read"); } });
    }
    freeze(input);
    const original = JSON.stringify(input);
    const rows = buildPlayerAggregatedStats(input);
    expect(rows.find(r => r.label === "PTS/60")?.LY).toBe(4);
    for (const col of ["L5", "L10", "L20"] as const) {
      expect(rows.find(r => r.label === "G/60")?.[col]).toBe(0);
      expect(rows.find(r => r.label === "PTS/60")?.[col]).toBe(3);
      expect(rows.find(r => r.label === "PPP/60")?.[col]).toBe(0);
    }
    expect(JSON.stringify(input)).toBe(original);
  });

  it("does not manufacture recent rates from historical data when the recent snapshot is absent", () => {
    const rows = buildPlayerAggregatedStats({ careerData: { player_id: playerId, std_pts_per_60: 2 } as any, recentData: null, ratesData: { pts_per_60_std: 4, pts_per_60_l5: 999 }, totalsData: null });
    const points = rows.find(r => r.label === "PTS/60")!;
    expect(points).toMatchObject({ STD: 4, L5: null, L10: null, L20: null });
  });

  it("keeps infinite recent rates unavailable despite finite legacy rates and valid exposure", () => {
    const rows = buildPlayerAggregatedStats({ careerData: null, recentData: { player_id: playerId, l5_gp: 1, l5_atoi: 20, l5_pts_per_60: Infinity } as any, ratesData: { pts_per_60_l5: 3 }, totalsData: null });
    expect(rows.find(r => r.label === "PTS/60")?.L5).toBeNull();
  });
});

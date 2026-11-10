import { describe, expect, it, vi } from "vitest";
import { checkSkaterCompositeSourceCoverage, loadSkaterCompositeSeasonSources } from "./skaterCompositeSourceCoverage";

const args = { season: 20262027, strength: "5v5" as const, cutoffDate: "2026-11-07" };
const game = (player_id: number, date = "2026-11-07", game_id = 2026020001) =>
  ({ player_id, date, game_id, season_id: 20262027, games_played: 1 });
const rolling = (player_id: number, game_date = "2026-11-07", strength_state = "5v5") =>
  ({ player_id, game_date, strength_state, season: 20262027, updated_at: "2026-11-08T08:00:00Z" });

function clientFor(wgo: ReturnType<typeof game>[], rollingRows: ReturnType<typeof rolling>[], errorTable?: string) {
  const calls: any[] = [];
  const client = { from: vi.fn((table: string) => {
    const call = { table, filters: [] as any[], orders: [] as any[], range: [0, Infinity] };
    calls.push(call);
    const chain: any = {};
    chain.select = (fields: string) => { (call as any).select = fields; return chain; };
    chain.or = (filter: string) => {
      (call as any).identityFilter = filter;
      const pairs = [...filter.matchAll(/and\(player_id.eq.(\d+),game_date.eq.([0-9-]+)\)/g)]
        .map((match) => ({ playerId: Number(match[1]), date: match[2] }));
      call.filters.push({ op: "identities", value: pairs });
      return chain;
    };
    chain.abortSignal = () => chain;
    for (const op of ["eq", "gte", "lte", "in"]) {
      chain[op] = (field: string, value: unknown) => { call.filters.push({ op, field, value }); return chain; };
    }
    chain.order = (field: string, options: any) => { call.orders.push({ field, ...options }); return chain; };
    chain.range = (from: number, to: number) => { call.range = [from, to]; return chain; };
    chain.limit = (size: number) => { call.range = [0, size - 1]; return chain; };
    chain.then = (resolve: any) => {
      if (table === errorTable) return Promise.resolve(resolve({ error: { message: "fixture read failure" }, data: null }));
      const rows = (table === "wgo_skater_stats" ? wgo : rollingRows) as any[];
      const data = rows.filter((row) => call.filters.every(({ op, field, value }) =>
        op === "identities" ? value.some((pair: any) => row.player_id === pair.playerId && row.game_date === pair.date) :
        op === "eq" ? row[field] === value : op === "gte" ? row[field] >= value : op === "lte" ? row[field] <= value : value.includes(row[field]),
      )).sort((a, b) => {
        for (const { field, ascending } of call.orders) {
          if (a[field] !== b[field]) return (a[field] < b[field] ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      }).slice(call.range[0], call.range[1] + 1);
      return Promise.resolve(resolve({ data, error: null }));
    };
    return chain;
  }) };
  return { client: client as any, calls };
}

describe("composite source coverage", () => {
  it("checks each player's latest played date, not a global timestamp", async () => {
    const { client } = clientFor(
      [game(1), game(2), game(3, "2026-11-01"), game(1, "2026-11-01", 2026020002)],
      [rolling(1), rolling(2, "2026-11-06"), rolling(3, "2026-11-01")],
    );
    const report = await checkSkaterCompositeSourceCoverage(client, args);
    expect(report.verified).toBe(false);
    expect(report.expectedPlayerCount).toBe(3);
    expect(report.staleOrMissingPlayerIds).toEqual([2]);
  });

  it("finds players missing entirely from rolling and ignores wrong-season/strength rows", async () => {
    const { client } = clientFor([game(1), game(2), game(3)], [rolling(1), rolling(2, undefined, "all"), { ...rolling(3), season: 20252026 }]);
    const report = await checkSkaterCompositeSourceCoverage(client, args);
    expect(report.staleOrMissingPlayerIds).toEqual([2, 3]);
    expect(report.verified).toBe(false);
  });

  it("rejects a stale cached source even when a newer rolling row now exists", async () => {
    const { client } = clientFor([game(1), game(2)], [rolling(1), rolling(2)]);
    const report = await checkSkaterCompositeSourceCoverage(client, {
      ...args,
      usedSnapshots: new Map([
        [1, { date: "2026-11-06", updatedAt: "2026-11-08T08:00:00Z" }],
        [2, { date: "2026-11-07", updatedAt: "2026-11-08T07:00:00Z" }],
      ]),
    });
    expect(report.verified).toBe(false);
    expect(report.staleOrMissingPlayerIds).toEqual([1, 2]);
  });

  it("rejects omitted and extra players in the unfiltered complete population", async () => {
    const { client } = clientFor([game(1), game(2)], [rolling(1), rolling(2)]);
    const report = await checkSkaterCompositeSourceCoverage(client, {
      ...args, requireCompletePopulation: true,
      usedSnapshots: new Map([[1, { date: "2026-11-07", updatedAt: "2026-11-08T08:00:00Z" }], [3, { date: "2026-11-07", updatedAt: "2026-11-08T08:00:00Z" }]]),
    });
    expect(report.verified).toBe(false);
    expect(report.blockers.join()).toContain("absent from the complete ranking cohort");
    expect(report.blockers.join()).toContain("no matching regular-season WGO");
  });

  it("uses regular-season appearances at or before the explicit cutoff", async () => {
    const { client } = clientFor([game(1), game(2, "2026-11-08"), game(3, undefined, 2026010001), game(4, undefined, 2026030001)], [rolling(1)]);
    const report = await checkSkaterCompositeSourceCoverage(client, args);
    expect(report).toMatchObject({ verified: true, expectedPlayerCount: 1, staleOrMissingPlayerIds: [] });
  });

  it("pages beyond 1000 source rows and bounds each rolling query to 50 exact identities", async () => {
    const wgo = Array.from({ length: 1001 }, (_, index) => game(index + 1));
    const { client, calls } = clientFor(wgo, wgo.map((row) => rolling(row.player_id)));
    const report = await checkSkaterCompositeSourceCoverage(client, args);
    expect(report).toMatchObject({ verified: true, expectedPlayerCount: 1001, scannedSourceRows: 1001 });
    expect(calls.filter((call) => call.table === "wgo_skater_stats").map((call) => call.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(calls.filter((call) => call.table === "rolling_player_game_metrics")).toHaveLength(21);
  });

  it("loads exact complete-season source rows, including long-idle players, without wide-history fallback", async () => {
    const wgo = [game(1), game(2, "2026-09-15"), game(1, "2026-10-01", 2026020002), game(3, "2026-09-20", 2026010001)];
    const { client, calls } = clientFor(wgo, [rolling(1), rolling(1, "2026-10-01"), rolling(2, "2026-09-15"), rolling(3, "2026-09-20")]);
    const { report, rows } = await loadSkaterCompositeSeasonSources(client, args);
    expect(report).toMatchObject({ verified: true, expectedPlayerCount: 2 });
    expect(rows.map((row) => [row.player_id, row.game_date])).toEqual([[1, "2026-11-07"], [2, "2026-09-15"]]);
    const reads = calls.filter((call) => call.table === "rolling_player_game_metrics");
    expect(reads).toHaveLength(1);
    expect(reads[0].select).toContain("goals_per_60_season");
  });

  it("keeps full-cohort query URIs below common 8 KiB limits", async () => {
    const wgo = Array.from({ length: 101 }, (_, i) => game(8470000 + i));
    const { client, calls } = clientFor(wgo, wgo.map((row) => rolling(row.player_id)));
    const { report } = await loadSkaterCompositeSeasonSources(client, args);
    expect(report.verified).toBe(true);
    const reads = calls.filter((call) => call.table === "rolling_player_game_metrics");
    expect(reads).toHaveLength(3);
    for (const read of reads) {
      const query = new URLSearchParams({ select: read.select, or: `(${read.identityFilter})`, season: "eq.20262027", strength_state: "eq.5v5", order: "player_id.asc,game_date.asc", limit: "51" });
      expect(query.toString().length).toBeLessThan(7500);
    }
  });

  it("does not exhaust the query budget merely because idle players span more than 40 dates", async () => {
    const dates = Array.from({ length: 45 }, (_, i) => new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10));
    const { client, calls } = clientFor(dates.map((date, i) => game(i + 1, date)), dates.map((date, i) => rolling(i + 1, date)));
    const { report, rows } = await loadSkaterCompositeSeasonSources(client, args);
    expect(report.verified).toBe(true);
    expect(rows).toHaveLength(45);
    expect(calls.filter((call) => call.table === "rolling_player_game_metrics")).toHaveLength(1);
  });

  it.each(["wgo_skater_stats", "rolling_player_game_metrics"])("fails closed on %s read errors", async (table) => {
    const { client } = clientFor([game(1)], [rolling(1)], table);
    const report = await checkSkaterCompositeSourceCoverage(client, args);
    expect(report.verified).toBe(false);
    expect(report.blockers.join()).toContain("read failed");
  });

  it("fails closed on empty, unknown-identity and duplicate appearances", async () => {
    for (const rows of [[], [{ ...game(1), game_id: null }], [game(1), game(1)]]) {
      const { client } = clientFor(rows as any, []);
      const report = await checkSkaterCompositeSourceCoverage(client, args);
      expect(report.verified).toBe(false);
      expect(report.blockers.length).toBeGreaterThan(0);
    }
  });
});

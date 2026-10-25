import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake anon client: no Supabase read ever leaves this test.
const source = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], count: 0 as number | null, ranges: [] as [number, number][], columns: "" }));
vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: (table: string) => {
      if (table !== "nst_team_stats") throw new Error(`unexpected table ${table}`);
      const query = {
        select: (columns: string) => { source.columns = columns; return query; },
        eq: () => query,
        order: () => query,
        range: async (from: number, to: number) => { source.ranges.push([from, to]); return { data: source.rows.slice(from, to + 1), error: null, count: source.count }; },
      };
      return query;
    },
  },
}));
import { loadShareTeamRates, TEAM_RATE_ROW_LIMIT } from "./teamRates";

const row = (abbreviation: string, extra: Record<string, unknown> = {}) => ({ team_abbreviation: abbreviation, gp: 10, xgf: 30, xga: 28, season: 20262027, situation: "all", updated_at: "2026-10-26T08:00:00Z", ...extra });
const teams = Array.from({ length: 32 }, (_, i) => `T${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

beforeEach(() => { source.rows = teams.map(team => row(team)); source.count = 32; source.ranges = []; });

describe("social-share team rate loader", () => {
  it("reads only the rate columns in one page bounded by an explicit 64-row limit", async () => {
    const rates = await loadShareTeamRates(20262027);
    expect(TEAM_RATE_ROW_LIMIT).toBe(64);
    expect(source.ranges).toEqual([[0, 63]]);
    expect(source.columns).toBe("team_abbreviation,gp,xgf,xga,gf,ga,sf,sa,season,situation,updated_at");
    expect(Object.keys(rates)).toHaveLength(32);
    expect(rates.TAA).toEqual({ gp: 10, xgf: 30, xga: 28, season: 20262027, situation: "all", updated_at: "2026-10-26T08:00:00Z" });
  });

  it("fails closed when the source holds more rows than the limit instead of paging on", async () => {
    source.rows = Array.from({ length: 70 }, (_, i) => row(`X${i}`)); source.count = 70;
    await expect(loadShareTeamRates(20262027)).rejects.toThrow("over the row limit");
    expect(source.ranges).toEqual([[0, 63]]);
  });

  it("rejects missing counts, wrong seasons or situations, and duplicate teams", async () => {
    source.count = null;
    await expect(loadShareTeamRates(20262027)).rejects.toThrow("completeness");
    source.count = 32; source.rows[3] = row(teams[3], { season: 20252026 });
    await expect(loadShareTeamRates(20262027)).rejects.toThrow("identity");
    source.rows[3] = row(teams[3], { situation: "5v5" });
    await expect(loadShareTeamRates(20262027)).rejects.toThrow("identity");
    source.rows[3] = row(teams[2]);
    await expect(loadShareTeamRates(20262027)).rejects.toThrow("identity");
  });
});

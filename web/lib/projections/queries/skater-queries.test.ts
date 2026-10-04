import { describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as Array<[string, unknown[]]> }));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    dbState.calls.push(["from", [table]]);
    const query: Record<string, unknown> = { then(resolve: (value: unknown) => void) {
      resolve({ data: dbState.rows, error: null });
    } };
    for (const name of ["select", "in", "lte", "gte", "order", "limit"]) {
      query[name] = (...args: unknown[]) => { dbState.calls.push([name, args]); return query; };
    }
    return query;
  },
} }));

import { ROLLING_ROW_SELECT_CLAUSE, fetchCurrentRosterPlayerIds, fetchSkaterRecencyEvents, fetchLatestSkaterContextProfiles } from "./skater-queries";

describe("native skater recency event identity", () => {
  const rows = [{ player_id: 7, game_id: 2026020025, season: 20262027, game_date: "2026-10-03" }] as any;
  const game = { id: 2026020025, seasonId: 20262027, date: "2026-10-03", type: 2 };
  function client(data: any, error: Error | null = null) {
    const query: any = { select: vi.fn(), in: vi.fn(), limit: vi.fn().mockResolvedValue({ data, error }) };
    query.select.mockReturnValue(query); query.in.mockReturnValue(query);
    return { from: vi.fn().mockReturnValue(query), query };
  }
  it("retains the exact native event and holds date or season mismatch", async () => {
    const db = client([game]);
    expect(await fetchSkaterRecencyEvents(rows, db as any)).toEqual(new Map([[7, { date: game.date, seasonId: game.seasonId, type: 2 }]]));
    expect(db.from).toHaveBeenCalledWith("games");
    expect(db.query.in).toHaveBeenCalledWith("id", [2026020025]);
    expect(db.query.limit).toHaveBeenCalledWith(1);
    for (const changed of [{ date: "2026-10-01" }, { seasonId: 20252026 }, { seasonId: null }]) {
      expect((await fetchSkaterRecencyEvents(rows, client([{ ...game, ...changed }]) as any)).size).toBe(0);
    }
  });
  it("rejects incomplete, duplicated, wrong, denied or unbounded source reads", async () => {
    for (const data of [[], [game, game], [{ ...game, id: 123 }], null]) {
      await expect(fetchSkaterRecencyEvents(rows, client(data) as any)).rejects.toThrow("Incomplete");
    }
    await expect(fetchSkaterRecencyEvents(rows, client(null, new Error("denied")) as any)).rejects.toThrow("denied");
    await expect(fetchSkaterRecencyEvents([{ ...rows[0], game_id: null }] as any, client([]) as any)).rejects.toThrow("Invalid");
    await expect(fetchSkaterRecencyEvents(Array.from({ length: 501 }, (_, id) => ({ ...rows[0], game_id: id + 1 })) as any, client([]) as any)).rejects.toThrow("Invalid");
  });
});

describe("complete current roster membership", () => {
  const members = (count: number) => Array.from({ length: count }, (_, index) => ({ playerId: index + 1, teamId: 4, seasonId: 20262027 }));
  function client(rows: ReturnType<typeof members>, counts = [rows.length], emptySecondPage = false) {
    const reads: number[][] = [];
    const from = vi.fn((table: string) => {
      expect(table).toBe("rosters");
      const query: Record<string, any> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.range = async (start: number, end: number) => {
        reads.push([start, end]);
        return { data: emptySecondPage && start > 0 ? [] : rows.slice(start, end + 1),
          count: counts[Math.min(reads.length - 1, counts.length - 1)], error: null };
      };
      return query;
    });
    return { db: { from } as any, reads, from };
  }

  it("retains members after the first24 without filtering by canonical mapping", async () => {
    const db = client(members(49));
    const ids = await fetchCurrentRosterPlayerIds(4, 20262027, db.db);
    expect(ids).toEqual(members(49).map(row => row.playerId));
    expect(ids).toContain(49);
    expect(db.reads).toEqual([[0, 499]]);
    expect(db.from).toHaveBeenCalledWith("rosters");
    const query = db.from.mock.results[0].value;
    expect(query.select).toHaveBeenCalledWith("playerId,teamId,seasonId", { count: "exact" });
    expect(query.eq.mock.calls).toEqual([["teamId", 4], ["seasonId", 20262027], ["is_current", true]]);
    expect(query.order).toHaveBeenCalledWith("playerId", { ascending: true });
  });

  it("pages the complete counted scope in stable NHL ID order", async () => {
    const db = client(members(501));
    expect(await fetchCurrentRosterPlayerIds(4, 20262027, db.db)).toHaveLength(501);
    expect(db.reads).toEqual([[0, 499], [500, 999]]);
  });

  it("rejects count drift, unknown coverage, overflow and truncated pages", async () => {
    await expect(fetchCurrentRosterPlayerIds(4, 20262027, client(members(501), [501, 502]).db)).rejects.toThrow("incomplete");
    await expect(fetchCurrentRosterPlayerIds(4, 20262027, client(members(1), [null as any]).db)).rejects.toThrow("incomplete");
    await expect(fetchCurrentRosterPlayerIds(4, 20262027, client(members(1201)).db)).rejects.toThrow("incomplete");
    await expect(fetchCurrentRosterPlayerIds(4, 20262027, client(members(501), [501], true).db)).rejects.toThrow("truncated");
  });

  it("rejects duplicate or missing NHL IDs and out-of-scope memberships", async () => {
    for (const bad of [{ playerId: 0 }, { playerId: 1 }, { playerId: undefined }, { teamId: 14 }, { seasonId: 20252026 }]) {
      const rows = members(2); Object.assign(rows[1], bad);
      await expect(fetchCurrentRosterPlayerIds(4, 20262027, client(rows).db)).rejects.toThrow("malformed or duplicated");
    }
  });

  it("propagates permission errors and retains a proven empty roster", async () => {
    const db = { from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; },
      range: async () => ({ error: new Error("permission denied"), data: null, count: null }) }) } as any;
    await expect(fetchCurrentRosterPlayerIds(4, 20262027, db)).rejects.toThrow("permission denied");
    expect(await fetchCurrentRosterPlayerIds(4, 20262027, client([]).db)).toEqual([]);
  });
});

describe("fetchRollingRows compatibility select clause", () => {
  it("includes both canonical and legacy fallback columns for promised /60 consumers", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_all");
  });

  it("keeps weighted-rate fields canonical-first while leaving TOI and additive totals on their authoritative legacy surfaces", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_avg_last5")
    );

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("goals_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("shots_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("assists_total_last5");
  });
});

describe("combined skater context read", () => {
  it("uses one cutoff-bounded query and preserves both latest-player maps with missing fields", async () => {
    dbState.calls = [];
    dbState.rows = [
      { player_id: 7, date: "2026-09-28", nst_shots_per_60: 12, nst_ixg_per_60: 1.1,
        nst_oi_xgf_per_60: 3.2, nst_oi_cf_pct_rates: 0.55, possession_pct_safe: 0.54 },
      { player_id: 7, date: "2026-09-27", nst_shots_per_60: 99, nst_oi_xgf_per_60: 99 },
      { player_id: 8, date: "2026-09-28", nst_oi_cf_pct: 0.49 },
    ];
    const result = await fetchLatestSkaterContextProfiles([7, 8], "2026-09-29");
    expect(dbState.calls.filter(([name]) => name === "from")).toEqual([["from", ["player_stats_unified"]]]);
    expect(dbState.calls).toContainEqual(["lte", ["date", "2026-09-29"]]);
    expect(dbState.calls).toContainEqual(["gte", ["date", "2025-09-29"]]);
    expect(dbState.calls).toContainEqual(["limit", [5000]]);
    expect(result.shotQuality.get(7)).toEqual({ sourceDate: "2026-09-28", nstShotsPer60: 12,
      nstIxgPer60: 1.1, nstRushAttemptsPer60: null, nstReboundsCreatedPer60: null });
    expect(result.onIceContext.get(7)).toEqual({ sourceDate: "2026-09-28", nstOiXgfPer60: 3.2,
      nstOiXgaPer60: null, nstOiCfPct: 0.55, possessionPctSafe: 0.54 });
    expect(result.shotQuality.get(8)?.nstShotsPer60).toBeNull();
    expect(result.onIceContext.get(8)?.nstOiCfPct).toBe(0.49);
  });
});

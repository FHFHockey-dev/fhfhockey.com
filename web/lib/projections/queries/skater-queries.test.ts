import { describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as Array<[string, unknown[]]>,
  rollingFrom: null as null | ((table: string) => unknown) }));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    if (table === "rolling_player_game_metrics" && dbState.rollingFrom) return dbState.rollingFrom(table);
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

import { ROLLING_ROW_SELECT_CLAUSE, fetchRollingRows, fetchCurrentRosterPlayerIds, fetchSkaterRecencyEvents, fetchLatestSkaterContextProfiles } from "./skater-queries";

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

// Fictional ordered rows test read mechanics, not NHL appearances or model support.
describe("counted rolling skater history", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({
    player_id: 7, game_id: 2026000000 + count - index, season: 20262027,
    strength_state: "ev", game_date: "2026-10-06", sog_per_60_all: index % 2 ? null : 6.25,
    sog_per_60_avg_all: 7.5, goals_total_all: 0, toi_seconds_avg_all: 900,
  }));
  type Reply = { data?: unknown; count?: unknown; error?: unknown; thrown?: Error };
  function fixture(source = rows(501), replies: Reply[] = []) {
    const reads: number[][] = [];
    const queries: Array<Record<string, any>> = [];
    const from = vi.fn((table: string) => {
      expect(table).toBe("rolling_player_game_metrics");
      const query: Record<string, any> = {};
      for (const name of ["select", "in", "eq", "lt", "gt", "order", "limit"]) query[name] = vi.fn(() => query);
      query.range = vi.fn(async (start: number, end: number) => {
        const reply = replies[reads.length] ?? {};
        reads.push([start, end]);
        if (reply.thrown) throw reply.thrown;
        return { data: source.slice(start, end + 1), count: source.length, error: null, ...reply };
      });
      // Reproduce the old limit(5000) expression against a server returning at most 1000 rows.
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: source.slice(0, 1000), count: null, error: null, ...replies[0],
      }).then(resolve);
      queries.push(query);
      return query;
    });
    dbState.rollingFrom = from;
    return { reads, queries, from };
  }
  const fetch = (ids = [7]) => fetchRollingRows(ids, "ev", "2026-10-07");

  it.each([0, 1, 499, 500, 501, 1000, 1001, 5000])("completes the exact bounded scope at %s rows", async count => {
    const source = rows(count), db = fixture(source);
    const actual = await fetch();
    expect(actual).toHaveLength(source.length);
    expect(actual).toEqual(source);
    expect(db.reads).toEqual(Array.from({ length: Math.max(1, Math.ceil(count / 500)) }, (_, page) => [page * 500, page * 500 + 499]));
    for (const query of db.queries) {
      expect(query.select).toHaveBeenCalledWith(ROLLING_ROW_SELECT_CLAUSE, { count: "exact" });
      expect(query.eq).toHaveBeenCalledWith("strength_state", "ev");
      expect(query.lt).toHaveBeenCalledWith("game_date", "2026-10-07");
      expect(query.gt).toHaveBeenCalledWith("game_date", "2025-10-07");
      expect(query.limit).not.toHaveBeenCalled();
    }
  });
  it("crosses the retained 1000-row cap shape rather than returning the old-expression prefix", async () => {
    const source = rows(1501), db = fixture(source);
    const actual = await fetch();
    expect(actual).toHaveLength(source.length);
    expect(actual).toEqual(source);
    expect(db.reads).toEqual([[0, 499], [500, 999], [1000, 1499], [1500, 1999]]);
  });
  it("does not treat a count-less retained read shape as complete", async () => {
    const db = fixture(rows(1501), [{ data: rows(1000), count: null }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_count" });
    expect(db.reads).toEqual([[0, 499]]);
  });
  it("deduplicates requested IDs and orders date/player/game ties deterministically", async () => {
    const source = [rows(2)[0], rows(2)[1], { ...rows(1)[0], player_id: 8 }];
    const db = fixture(source);
    expect(await fetch([8, 7, 8])).toEqual(source);
    expect(db.queries[0].in).toHaveBeenCalledWith("player_id", [7, 8]);
    expect(db.queries[0].order.mock.calls).toEqual([["game_date", { ascending: false }],
      ["player_id", { ascending: true }], ["game_id", { ascending: false }]]);
    expect(await fetch([])).toEqual([]);
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("retains the requested PP scope and existing row values", async () => {
    const source = rows(1).map(row => ({ ...row, strength_state: "pp" }));
    const db = fixture(source);
    expect(await fetchRollingRows([7], "pp", "2026-10-07")).toEqual(source);
    expect(db.queries[0].eq).toHaveBeenCalledWith("strength_state", "pp");
  });
  it.each([null, undefined, -1, 1.5, NaN, "1"])("rejects unproved exact count %s", async count => {
    fixture(rows(1), [{ count }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_count" });
  });
  it("rejects history exceeding the old 5000-row bound before returning a capped prefix", async () => {
    const db = fixture(rows(5001));
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "row_limit_exceeded" });
    expect(db.reads).toEqual([[0, 499]]);
  });
  it.each([500, 502])("rejects count drift to %s after the first page", async count => {
    const db = fixture(rows(501), [{ count: 501 }, { count }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "count_drift" });
    expect(db.reads).toHaveLength(2);
  });
  it.each([null, {}, [], rows(499), rows(501)].map(data => ({ data })))("rejects a malformed, short or overfull first page", async ({ data }) => {
    fixture(rows(501), [{ data, count: 501 }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_page" });
  });
  it("rejects a missing terminal row and a duplicate across the page boundary", async () => {
    fixture(rows(501), [{}, { data: [] }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_page" });
    fixture(rows(501), [{}, { data: [rows(501)[0]] }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "duplicate_row" });
  });
  it("rejects an unproved zero count and a malformed row", async () => {
    fixture(rows(1), [{ count: 0 }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_page" });
    fixture(rows(1), [{ data: [null] }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_row" });
  });
  it("rejects identical or conflicting duplicate identities within a page", async () => {
    for (const second of [rows(1)[0], { ...rows(1)[0], sog_per_60_all: 99 }]) {
      fixture([rows(1)[0], second]);
      await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "duplicate_row" });
    }
  });
  it("rejects unstable ordering within and across pages", async () => {
    fixture(rows(2).reverse());
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "unstable_order" });
    fixture([{ ...rows(2)[0], player_id: 8 }, rows(2)[1]]);
    await expect(fetch([7, 8])).rejects.toMatchObject({ status: "incomplete", reason: "unstable_order" });
    fixture([{ ...rows(2)[0], game_date: "2026-10-05" }, rows(2)[1]]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "unstable_order" });
    fixture(rows(501), [{}, { data: [{ ...rows(501)[500], game_id: 2026001000 }] }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "unstable_order" });
  });
  it.each([
    { player_id: 8 }, { game_id: null }, { game_id: -1 }, { season: null }, { strength_state: "pk" },
    { game_date: "2026-10-07" }, { game_date: "2025-10-07" }, { game_date: "2025-10-06" }, { game_date: "2026-02-30" },
  ])("rejects substituted or malformed row scope %j", async changed => {
    fixture([{ ...rows(1)[0], ...changed } as any]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_row" });
  });
  it("rejects provider errors and transport failures after a successful page without returning partial rows", async () => {
    const providerError = { message: "synthetic permission denied", code: "42501" };
    fixture(rows(501), [{}, { error: providerError, data: null, count: null }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "read_failed", cause: providerError });
    const transportError = new Error("synthetic interrupted read");
    fixture(rows(501), [{}, { thrown: transportError }]);
    await expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "read_failed", cause: transportError });
  });
  it.each([[0], [-7], [NaN], [1.5], Array.from({ length: 501 }, (_, index) => index + 1)].map(ids => ({ ids })))("rejects invalid or unbounded requested IDs", async ({ ids }) => {
    const db = fixture();
    await expect(fetch(ids)).rejects.toMatchObject({ status: "incomplete", reason: "invalid_scope" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("rejects an unsupported strength scope before reading", async () => {
    const db = fixture();
    await expect(fetchRollingRows([7], "pk" as any, "2026-10-07")).rejects.toMatchObject({ status: "incomplete", reason: "invalid_scope" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "not-a-date", "2026-10-07T00:00:00Z"])("rejects invalid date scope %s before reading", async date => {
    const db = fixture();
    await expect(fetchRollingRows([7], "ev", date)).rejects.toMatchObject({ status: "incomplete", reason: "invalid_scope" });
    expect(db.from).not.toHaveBeenCalled();
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

import { describe, expect, it, vi } from "vitest";
import { createAlignedCountSupportBuilder } from "lib/rollingPlayerCountSupport";

const dbState = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as Array<[string, unknown[]]>,
  rollingFrom: null as null | ((table: string) => unknown), rollingRpc: null as null | ((...args: any[]) => unknown) }));
vi.mock("lib/supabase/server", () => ({ default: {
  rpc(...args: unknown[]) {
    if (dbState.rollingRpc) return dbState.rollingRpc(...args);
    // Without a handler the latest-row RPC is not deployed, so reads take the legacy window scan.
    return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function in the schema cache" } });
  },
  from(table: string) {
    if (["rolling_player_game_metrics", "rolling_player_metric_support_payloads"].includes(table) && dbState.rollingFrom) return dbState.rollingFrom(table);
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

import { ROLLING_ROW_SELECT_CLAUSE, fetchRollingRows, fetchCurrentRosterPlayerIds, fetchSkaterRecencyEvents, fetchLatestSkaterContextProfiles,
  fetchLeaguePhysicalTotals } from "./skater-queries";
import { captureProjectionInputs, interceptProjectionQuery, replayProjectionInputs } from "../inputCapture";
import { pickLatestByPlayer } from "../utils/collection-utils";

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
// The latest-row RPC is not deployed here (PGRST202), so these cover the legacy window scan.
describe("counted rolling skater history (legacy window scan)", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({
    player_id: 7, game_id: 2026000000 + count - index, season: 20262027,
    strength_state: "ev", game_date: "2026-10-06", sog_per_60_all: index % 2 ? null : 6.25,
    sog_per_60_avg_all: 7.5, goals_total_all: 0, toi_seconds_avg_all: 900,
  }));
  type Reply = { data?: unknown; count?: unknown; error?: unknown; thrown?: Error };
  function fixture(source: Record<string, any>[] = rows(501), replies: Reply[] = [], supportRows: any[] = [], supportReplies: Reply[] = []) {
    const reads: number[][] = [];
    const queries: Array<Record<string, any>> = [];
    const from = vi.fn((table: string) => {
      if (table === "rolling_player_metric_support_payloads") {
        const query: Record<string, any> = {};
        for (const name of ["select", "in", "eq", "lt", "gt", "order"]) query[name] = vi.fn(() => query);
        query.range = vi.fn(async (start: number, end: number) => ({ data: supportRows.slice(start, end + 1), count: supportRows.length,
          error: null, ...supportReplies[Math.floor(start / 500)] }));
        return query;
      }
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
    dbState.rollingRpc = null;
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
  it("hydrates pruned conversion counts without overwriting authoritative values or imputing missing fields", async () => {
    const source = [{ ...rows(1)[0], goals_total_all: null, shots_total_all: null, assists_total_all: null, goals_total_last5: 0 }];
    const support = [{ ...source[0], payload_schema_version: 1, support_payload: { historicalCompatibility: {
      goals_total_all: 331, shots_total_all: 510, assists_total_all: 63, goals_total_last5: 0, toi_seconds_avg_all: 900,
      shots_total_last5: null, player_id: 999, arbitrary_projection: 999,
    } } }];
    fixture(source, [], support);
    const actual = await fetch();
    expect(actual[0]).toMatchObject({ goals_total_all: 331, shots_total_all: 510, assists_total_all: 63,
      goals_total_last5: 0, toi_seconds_avg_all: 900, player_id: 7 });
    expect(actual[0]).not.toHaveProperty("arbitrary_projection");
    expect(actual[0].shots_total_last5).toBeUndefined();
    expect(source[0].goals_total_all).toBeNull();
    fixture(source);
    expect((await fetch())[0].goals_total_all).toBeNull();
  });

  it("hydrates only exact-anchor aligned support without converting legacy scalars into proof", async () => {
    const source = rows(1), row = source[0];
    const aligned = createAlignedCountSupportBuilder({ playerId: row.player_id, strengthState: "ev", sourceTable: "nst_gamelog_es_counts",
      startDate: row.game_date, canonicalGames: [{ id: row.game_id, date: row.game_date, seasonId: row.season }],
      countsRows: [{ id: 1, player_id: row.player_id, date_scraped: row.game_date, season: row.season, goals: 0, shots: 4, total_assists: null }],
    }).push({ player_id: row.player_id, game_id: row.game_id, date: row.game_date, season_id: row.season })!;
    const sidecar = { ...row, payload_schema_version: 1, support_payload: { alignedCountSupport: aligned } };
    fixture(source, [], [sidecar]);
    expect((await fetch())[0].aligned_count_support).toEqual(aligned);
    expect(source[0]).not.toHaveProperty("aligned_count_support");
    fixture(source, [], [{ ...sidecar, support_payload: { alignedCountSupport: { ...aligned, anchor: { ...aligned.anchor, gameId: 99 } } } }]);
    expect((await fetch())[0]).toMatchObject({ aligned_count_support: null, goals_total_all: 0, sog_per_60_all: 6.25 });
    fixture(source);
    expect((await fetch())[0]).not.toHaveProperty("aligned_count_support");
  });

  it("pages sidecars independently when only a subset of history has durable payloads", async () => {
    const source = rows(501).map(row => ({ ...row, goals_total_all: null }));
    const support = source.map(row => ({ ...row, payload_schema_version: 1,
      support_payload: { historicalCompatibility: { goals_total_all: 0 } } }));
    const db = fixture(source, [], support);
    expect((await fetch()).every(row => row.goals_total_all === 0)).toBe(true);
    expect(db.from).toHaveBeenCalledWith("rolling_player_metric_support_payloads");
  });

  it.each([{ game_id: 99 }, { season: 20252026 }, { payload_schema_version: 2 }, { support_payload: null },
    { support_payload: { historicalCompatibility: [] } }, { support_payload: { historicalCompatibility: { goals_total_all: -1 } } },
    { support_payload: { historicalCompatibility: { goals_total_all: "331" } } },
    { support_payload: { historicalCompatibility: { goals_total_all: 9 } } }])("rejects malformed or substituted sidecar %j", changed => {
    const source = rows(1), support = { ...source[0], payload_schema_version: 1, support_payload: { historicalCompatibility: { goals_total_all: 1 } }, ...changed };
    fixture(source, [], [support]);
    return expect(fetch()).rejects.toMatchObject({ status: "incomplete", reason: "invalid_support_row" });
  });

  it("rejects duplicate, truncated, uncounted and denied sidecar reads", async () => {
    const source = rows(1), support = { ...source[0], payload_schema_version: 1, support_payload: { historicalCompatibility: {} } };
    fixture(source, [], [support, support]);
    await expect(fetch()).rejects.toMatchObject({ reason: "duplicate_row" });
    for (const reply of [{ count: null }, { count: 1, data: [] }, { error: new Error("denied") }]) {
      fixture(source, [], [support], [reply]);
      await expect(fetch()).rejects.toMatchObject({ status: "incomplete" });
    }
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
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it("retains the requested PP scope and existing row values", async () => {
    const source = rows(1).map(row => ({ ...row, strength_state: "pp" }));
    const db = fixture(source);
    expect(await fetchRollingRows([7], "pp", "2026-10-07")).toEqual(source);
    expect(db.queries[0].eq).toHaveBeenCalledWith("strength_state", "pp");
  });
  it("reads the all-strength scope with pruned three-season hit and block totals but no aligned NST support", async () => {
    const source = rows(1).map(row => ({ ...row, strength_state: "all", toi_seconds_total_last5: 6600 }));
    const support = [{ ...source[0], payload_schema_version: 1, support_payload: { alignedCountSupport: null,
      historicalCompatibility: { hits_per_60_hits_3ya: 220, hits_per_60_toi_seconds_3ya: 300000,
        blocks_per_60_blocks_3ya: 380, blocks_per_60_toi_seconds_3ya: 300000 } } }];
    const db = fixture(source, [], support);
    const [row] = await fetchRollingRows([7], "all", "2026-10-07");
    expect(db.queries[0].eq).toHaveBeenCalledWith("strength_state", "all");
    expect(row).toMatchObject({ strength_state: "all", toi_seconds_total_last5: 6600, hits_per_60_hits_3ya: 220,
      hits_per_60_toi_seconds_3ya: 300000, blocks_per_60_blocks_3ya: 380, blocks_per_60_toi_seconds_3ya: 300000 });
    expect(row).not.toHaveProperty("aligned_count_support");
    for (const field of ["toi_seconds_total_last5", "hits_per_60_hits_3ya", "hits_per_60_toi_seconds_3ya",
      "blocks_per_60_blocks_3ya", "blocks_per_60_toi_seconds_3ya", "hits_per_60_hits_season", "hits_per_60_toi_seconds_season",
      "blocks_per_60_blocks_season", "blocks_per_60_toi_seconds_season"]) expect(ROLLING_ROW_SELECT_CLAUSE.split(",")).toContain(field);
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

// Fictional multi-game history. The fake RPC applies the migration's contract to the same rows the legacy scan reads.
describe("latest rolling row per player (forge_latest_rolling_rows)", () => {
  type Row = Record<string, any>;
  const cutoff = "2026-10-07";
  const columns = ROLLING_ROW_SELECT_CLAUSE.split(",");
  const wide = (player_id: number, game_date: string, game_id: number, values: Row = {}): Row => ({
    ...Object.fromEntries(columns.map(column => [column, null])), player_id, game_id, strength_state: "ev", game_date,
    season: game_date >= "2026-09-01" ? 20262027 : game_date >= "2025-09-01" ? 20252026 : 20242025,
    sog_per_60_last5: (game_id % 97) / 10, goals_total_all: 3, ...values,
  });
  const sidecar = (row: Row, support_payload: Row) => ({ player_id: row.player_id, game_id: row.game_id, game_date: row.game_date,
    season: row.season, strength_state: row.strength_state, payload_schema_version: 1, support_payload });
  // Scan order (newest first, then player, then game). Player 11's only row predates the 365-day scope.
  const history = [
    wide(7, "2026-10-06", 2026020030, { goals_total_all: null, shots_total_all: null }),
    wide(8, "2026-10-06", 2026020030),
    wide(7, "2026-10-03", 2026020010, { goals_total_all: null }),
    wide(8, "2026-10-02", 2026020005),
    wide(9, "2026-04-12", 2025021310),
    wide(7, "2026-04-10", 2025021300),
    wide(9, "2025-12-01", 2025020400),
    wide(11, "2025-04-01", 2024021100),
  ];
  const aligned = createAlignedCountSupportBuilder({ playerId: 8, strengthState: "ev", sourceTable: "nst_gamelog_es_counts",
    startDate: "2026-10-06", canonicalGames: [{ id: 2026020030, date: "2026-10-06", seasonId: 20262027 }],
    countsRows: [{ id: 1, player_id: 8, date_scraped: "2026-10-06", season: 20262027, goals: 0, shots: 4, total_assists: null }],
  }).push({ player_id: 8, game_id: 2026020030, date: "2026-10-06", season_id: 20262027 })!;
  const sidecars = [
    sidecar(history[0], { historicalCompatibility: { goals_total_all: 12, shots_total_all: 80,
      sog_per_60_last5: history[0].sog_per_60_last5, arbitrary_projection: 999 }, unreadKey: { large: true } }),
    sidecar(history[1], { alignedCountSupport: aligned, historicalCompatibility: { shots_total_all: 55 } }),
    sidecar(history[2], { historicalCompatibility: { goals_total_all: 11 } }),
    sidecar(history[7], { historicalCompatibility: { goals_total_all: 40 } }),
  ];
  const has = (row: Row, key: string) => Object.prototype.hasOwnProperty.call(row, key);
  const pick = (row: Row, keys: string[]) => Object.fromEntries(keys.filter(key => has(row, key)).map(key => [key, row[key]]));
  const latestRowsRpc = (rows: Row[], supports: Row[]) => async (_name: string, args: Row) => ({ error: null,
    data: [...new Set<number>(args.p_player_ids)].sort((a, b) => a - b).map(player_id => {
      const latest = rows.filter(row => row.player_id === player_id && row.strength_state === args.p_strength
        && row.game_date < args.p_before).sort((a, b) => b.game_date.localeCompare(a.game_date))[0];
      const support = latest && supports.find(row => row.player_id === player_id && row.game_date === latest.game_date
        && row.strength_state === latest.strength_state);
      const payload = support?.support_payload;
      return { player_id, rolling_row: latest ? pick(latest, args.p_columns) : null, support_row: support ? {
        ...pick(support, ["player_id", "game_id", "game_date", "season", "strength_state", "payload_schema_version"]),
        support_payload: Object.fromEntries(["historicalCompatibility", "alignedCountSupport"].filter(key => has(payload, key))
          .map(key => [key, key === "historicalCompatibility" && payload[key] && typeof payload[key] === "object"
            && !Array.isArray(payload[key]) ? pick(payload[key], args.p_columns) : payload[key]])),
      } : null };
    }) });
  /** Legacy tables answer the 365-day scope in scan order; without `rpc` the function is not deployed. */
  function backend(rpc?: (...args: any[]) => unknown) {
    const inScope = (row: Row) => row.game_date < cutoff && row.game_date > "2025-10-07";
    const from = vi.fn((table: string) => {
      const source = (table === "rolling_player_game_metrics" ? history : sidecars).filter(inScope);
      const query: Row = {};
      for (const name of ["select", "in", "eq", "lt", "gt", "order"]) query[name] = vi.fn(() => query);
      query.range = vi.fn(async (start: number, end: number) => ({ data: source.slice(start, end + 1), count: source.length, error: null }));
      return query;
    });
    const db = { from, rpc: rpc ? vi.fn(rpc) : null };
    dbState.rollingFrom = from;
    dbState.rollingRpc = db.rpc;
    return db;
  }

  it("returns the legacy scan's latest row per player, hydrated identically, from one RPC call", async () => {
    const ids = [11, 9, 8, 7, 10, 8];
    backend();
    const legacy = await fetchRollingRows(ids, "ev", cutoff);
    expect(legacy).toHaveLength(7);
    const db = backend(latestRowsRpc(history, sidecars));
    const latest = await fetchRollingRows(ids, "ev", cutoff);
    expect(latest).toEqual([...pickLatestByPlayer(legacy).values()]);
    expect(pickLatestByPlayer(latest)).toEqual(pickLatestByPlayer(legacy));
    expect(latest.map(row => [row.player_id, row.game_date])).toEqual([[7, "2026-10-06"], [8, "2026-10-06"], [9, "2026-04-12"]]);
    expect(latest[0]).toMatchObject({ goals_total_all: 12, shots_total_all: 80 });
    expect(latest[0]).not.toHaveProperty("arbitrary_projection");
    expect(latest[1]).toMatchObject({ aligned_count_support: aligned, shots_total_all: 55 });
    expect(latest[2]).toEqual(history[4]);
    expect(latest[2]).not.toHaveProperty("aligned_count_support");
    expect(history[0].goals_total_all).toBeNull();
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("forge_latest_rolling_rows", { p_player_ids: [7, 8, 9, 10, 11], p_strength: "ev",
      p_before: cutoff, p_columns: columns }, { get: true });
    expect(db.from).not.toHaveBeenCalled();
  });

  const entry = (rolling_row: unknown = { ...history[0] }, support_row: unknown = null, player_id = 7) => ({ player_id, rolling_row, support_row });
  const support7 = (changed: Row = {}) => ({ ...sidecar(history[0], { historicalCompatibility: { goals_total_all: 12 } }), ...changed });

  it("returns exactly the selected columns and omits players without history or outside the 365-day scope", async () => {
    backend(async () => ({ error: null, data: [entry({ ...history[0], unselected_metric: 5 }), entry(null, null, 8),
      entry({ ...history[7] }, null, 11)] }));
    const rows = await fetchRollingRows([7, 8, 11], "ev", cutoff);
    expect(rows).toEqual([history[0]]);
    expect(rows[0]).not.toHaveProperty("unselected_metric");
  });

  it.each<[string, unknown, number[], string]>([
    ["no data", null, [7], "invalid_page"],
    ["an object", {}, [7], "invalid_page"],
    ["a missing player", [], [7], "invalid_page"],
    ["an extra entry", [entry(), entry()], [7], "invalid_page"],
    ["a repeated player", [entry(), entry()], [7, 8], "duplicate_row"],
    ["descending players", [entry({ ...history[0], player_id: 8 }, null, 8), entry()], [7, 8], "unstable_order"],
    ["an unrequested player", [entry({ ...history[0], player_id: 99 }, null, 99)], [7], "invalid_row"],
    ["a null entry", [null], [7], "invalid_row"],
    ["no support_row key", [{ player_id: 7, rolling_row: { ...history[0] } }], [7], "invalid_row"],
    ["a missing selected column", [entry(pick(history[0], columns.filter(column => column !== "blocks_per_60_toi_seconds_season")))], [7], "invalid_row"],
    ["an array row", [entry([])], [7], "invalid_row"],
    ["another player's row", [entry({ ...history[0], player_id: 8 })], [7], "invalid_row"],
    ["a row at the cutoff", [entry({ ...history[0], game_date: cutoff })], [7], "invalid_row"],
    ["another strength", [entry({ ...history[0], strength_state: "pp" })], [7], "invalid_row"],
    ["no game identity", [entry({ ...history[0], game_id: null })], [7], "invalid_row"],
    ["no season", [entry({ ...history[0], season: null })], [7], "invalid_row"],
    ["an impossible date", [entry({ ...history[0], game_date: "2026-02-30" })], [7], "invalid_row"],
    ["a sidecar without its row", [entry(null, support7())], [7], "invalid_support_row"],
    ["a sidecar for another game", [entry(undefined, support7({ game_id: 99 }))], [7], "invalid_support_row"],
    ["a sidecar from another season", [entry(undefined, support7({ season: 20252026 }))], [7], "invalid_support_row"],
    ["a newer payload schema", [entry(undefined, support7({ payload_schema_version: 2 }))], [7], "invalid_support_row"],
    ["a missing payload", [entry(undefined, support7({ support_payload: null }))], [7], "invalid_support_row"],
    ["a non-object historical payload", [entry(undefined, support7({ support_payload: { historicalCompatibility: [] } }))], [7], "invalid_support_row"],
    ["a conflicting value", [entry(undefined, support7({ support_payload: { historicalCompatibility: { sog_per_60_last5: 99 } } }))], [7], "invalid_support_row"],
    ["a negative value", [entry(undefined, support7({ support_payload: { historicalCompatibility: { goals_total_all: -1 } } }))], [7], "invalid_support_row"],
    ["a non-object sidecar", [entry(undefined, "sidecar")], [7], "invalid_support_row"],
  ])("rejects %s without falling back", async (_label, data, ids, reason) => {
    const db = backend(async () => ({ data, error: null }));
    await expect(fetchRollingRows(ids, "ev", cutoff)).rejects.toMatchObject({ status: "incomplete", reason });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("raises provider errors and transport failures without falling back", async () => {
    const providerError = { code: "42501", message: "synthetic permission denied" };
    let db = backend(async () => ({ data: null, error: providerError }));
    await expect(fetchRollingRows([7], "ev", cutoff)).rejects.toMatchObject({ status: "incomplete", reason: "read_failed", cause: providerError });
    expect(db.from).not.toHaveBeenCalled();
    const transportError = new Error("synthetic interrupted read");
    db = backend(async () => { throw transportError; });
    await expect(fetchRollingRows([7], "ev", cutoff)).rejects.toMatchObject({ status: "incomplete", reason: "read_failed", cause: transportError });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("reads through the legacy scan while PostgREST cannot find the RPC", async () => {
    const db = backend(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }));
    const rows = await fetchRollingRows([7, 8, 9], "ev", cutoff);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.from.mock.calls).toEqual([["rolling_player_game_metrics"], ["rolling_player_metric_support_payloads"]]);
    expect(rows).toHaveLength(7);
    expect([...pickLatestByPlayer(rows).values()]).toEqual(
      await fetchRollingRows([7, 8, 9], "ev", cutoff, { rpc: latestRowsRpc(history, sidecars) } as any));
  });

  it("reads through the legacy scan when FORGE reconstruction refuses RPCs, and replays that capture", async () => {
    const db: Row = backend(latestRowsRpc(history, sidecars));
    const client = Object.fromEntries(["from", "rpc"].map(method => [method, (...args: unknown[]) =>
      interceptProjectionQuery(method as "from" | "rpc", args, () => db[method](...args)) ?? db[method](...args)]));
    const read = () => fetchRollingRows([7, 8, 9], "ev", cutoff, client as any);
    const captured = await captureProjectionInputs(read, { suppressWrites: true });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(captured.reads.map(input => input.request[0].args[0])).toEqual(["rolling_player_game_metrics", "rolling_player_metric_support_payloads"]);
    const replayed = await replayProjectionInputs(captured.reads, read);
    expect(replayed.result).toEqual(captured.result);
    expect([...pickLatestByPlayer(captured.result).values()]).toEqual(await fetchRollingRows([7, 8, 9], "ev", cutoff));
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

describe("league physical totals", () => {
  const rows = [
    { scope: "prior2", position_group: "D", player_games: 9000, hits: 3200, blocks: 4400, toi_seconds: 3_600_000 },
    { scope: "prior2", position_group: "F", player_games: 18000, hits: 4900, blocks: 2100, toi_seconds: 3_600_000 },
    { scope: "to_date", position_group: "D", player_games: 900, hits: 280, blocks: 440, toi_seconds: 360_000 },
    { scope: "to_date", position_group: "F", player_games: 1800, hits: "490", blocks: "210", toi_seconds: 360_000 },
  ];
  const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });

  it("reads this season to date and the prior two seasons by position in one call", async () => {
    const db = client(rows);
    await expect(fetchLeaguePhysicalTotals(20262027, "2026-10-20", db as any)).resolves.toEqual({
      F: { toDate: { hits: 490, blocks: 210, toiSeconds: 360_000 }, prior: { hits: 4900, blocks: 2100, toiSeconds: 3_600_000 } },
      D: { toDate: { hits: 280, blocks: 440, toiSeconds: 360_000 }, prior: { hits: 3200, blocks: 4400, toiSeconds: 3_600_000 } },
    });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("forge_league_skater_physical_totals", { p_season_id: 20262027, p_cutoff: "2026-10-20" });
  });

  it("rejects an invalid scope before reading, and missing, extra, duplicate or negative rows", async () => {
    for (const [season, cutoff] of [[20262026, "2026-10-20"], [2026, "2026-10-20"], [20262027, "10/20/2026"]] as const) {
      const db = client(rows);
      await expect(fetchLeaguePhysicalTotals(season, cutoff, db as any)).rejects.toMatchObject({ reason: "invalid_scope" });
      expect(db.rpc).not.toHaveBeenCalled();
    }
    for (const data of [rows.slice(1), [...rows, rows[0]], [rows[0], rows[0], rows[2], rows[3]],
      [{ ...rows[0], hits: -1 }, ...rows.slice(1)], [{ ...rows[0], toi_seconds: null }, ...rows.slice(1)],
      [{ ...rows[0], scope: "career" }, ...rows.slice(1)], null]) {
      await expect(fetchLeaguePhysicalTotals(20262027, "2026-10-20", client(data) as any)).rejects.toMatchObject({ reason: "invalid_rows" });
    }
    await expect(fetchLeaguePhysicalTotals(20262027, "2026-10-20", client(null, { code: "PGRST202" }) as any))
      .rejects.toMatchObject({ reason: "read_failed" });
  });
});

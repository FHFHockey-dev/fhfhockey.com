import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake anon client records every read; no Supabase request ever leaves this test.
const source = vi.hoisted(() => ({ calls: [] as { table: string; columns: string; filters: [string, string, unknown][]; orders: [string, boolean][]; range: [number, number] }[], rows: {} as Record<string, Record<string, unknown>[]>, count: {} as Record<string, number | null>, errors: {} as Record<string, unknown>, inflight: 0, maxInflight: 0 }));
vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: (table: string) => {
      const call = { table, columns: "", filters: [] as [string, string, unknown][], orders: [] as [string, boolean][], range: [0, 0] as [number, number] };
      const query = {
        select: (columns: string) => { call.columns = columns; return query; },
        eq: (column: string, value: unknown) => { call.filters.push(["eq", column, value]); return query; },
        lt: (column: string, value: unknown) => { call.filters.push(["lt", column, value]); return query; },
        in: (column: string, value: unknown) => { call.filters.push(["in", column, value]); return query; },
        gte: (column: string, value: unknown) => { call.filters.push(["gte", column, value]); return query; },
        order: (column: string, options?: { ascending?: boolean }) => { call.orders.push([column, options?.ascending ?? true]); return query; },
        range: async (from: number, to: number) => {
          call.range = [from, to]; source.calls.push(call);
          source.inflight++; source.maxInflight = Math.max(source.maxInflight, source.inflight);
          await new Promise(resolve => setTimeout(resolve, 1));
          source.inflight--;
          const error = typeof source.errors[table] === "function" ? (source.errors[table] as (ids: unknown) => unknown)(call.filters.find(item => item[0] === "in")?.[2]) : source.errors[table];
          if (error) return { data: null, error, count: null };
          const recentKey = table === "rolling_player_game_metrics" ? "player_id" : table === "wgo_goalie_stats" ? "goalie_id" : null;
          if (recentKey) {
            // Recent reads: honour the chunk's IN list and its (id asc, date desc) order, like PostgREST would.
            const ids = call.filters.find(item => item[0] === "in")![2] as number[], dateKey = recentKey === "player_id" ? "game_date" : "date";
            const rows = (source.rows[table] ?? []).filter(row => ids.includes(row[recentKey] as number))
              .sort((a, b) => (a[recentKey] as number) - (b[recentKey] as number) || String(b[dateKey] ?? "").localeCompare(String(a[dateKey] ?? "")));
            if (from > 0 && from >= rows.length) return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null };
            return { data: rows.slice(from, to + 1), error: null, count: rows.length };
          }
          const all = table === "yahoo_nhl_player_map_read" ? (source.rows[table] ?? []).filter(row => (call.filters.find(item => item[0] === "in")![2] as string[]).includes(row.yahoo_player_id as string)) : source.rows[table] ?? [];
          // Like PostgREST: a range that starts past the last row is 416 Range Not Satisfiable (PGRST103).
          if (from > 0 && from >= all.length) return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null };
          return { data: all.slice(from, to + 1), error: null, count: source.count[table] === undefined ? all.length : source.count[table] };
        },
      };
      return query;
    },
  },
}));
import { loadSharePlayerRecent, loadSharePlayerSources, PLAYER_SOURCE_LIMITS, RECENT_CHUNK_CONCURRENCY, RECENT_ID_CHUNK, RECENT_LIMITS } from "./playerSources";

const yahoo = (id: number, team: string) => ({ player_key: `465.p.${id}`, player_id: String(id), editorial_team_abbreviation: team, percent_ownership: 20 });
beforeEach(() => {
  source.calls = []; source.count = {}; source.errors = {}; source.inflight = 0; source.maxInflight = 0;
  source.rows = {
    yahoo_players: [yahoo(1, "NJ"), yahoo(2, "TOR")],
    yahoo_nhl_player_map_read: [{ yahoo_player_id: "465.p.1", nhl_player_id: "8470001" }, { yahoo_player_id: "2", nhl_player_id: "8470002" }],
    wgo_skater_stats_totals: [{ player_id: 8470001 }], wgo_goalie_stats_totals: [{ goalie_id: 8470002 }],
  };
});

describe("live player source loader (mocked client)", () => {
  it("filters server-side to the season, under-50% ownership and the edition's teams, with explicit limits", async () => {
    const result = await loadSharePlayerSources(20262027, ["NJD", "TOR"]);
    const call = (table: string) => source.calls.find(item => item.table === table)!;
    // Pages never exceed the API's 1,000-row cap (ticket 15); the explicit limit still bounds the total.
    expect(call("yahoo_players")).toMatchObject({ range: [0, Math.min(PLAYER_SOURCE_LIMITS.yahoo, 1000) - 1], filters: [["eq", "season", 2026], ["lt", "percent_ownership", 50], ["in", "editorial_team_abbreviation", ["NJD", "NJ", "TOR"]]] });
    expect(call("yahoo_players").columns).not.toMatch(/ownership_timeline|player_name|injury_note|headshot/);
    expect(call("wgo_skater_stats_totals")).toMatchObject({ range: [0, Math.min(PLAYER_SOURCE_LIMITS.skaters, 1000) - 1], filters: [["eq", "season", "20262027"], ["in", "current_team_abbreviation", ["NJD", "TOR"]]] });
    expect(call("wgo_goalie_stats_totals")).toMatchObject({ range: [0, PLAYER_SOURCE_LIMITS.goalies - 1], filters: [["eq", "season_id", 20262027], ["in", "current_team_abbreviation", ["NJD", "TOR"]]] });
    expect(call("yahoo_nhl_player_map_read")).toMatchObject({ columns: "yahoo_player_id,nhl_player_id", filters: [["in", "yahoo_player_id", ["465.p.1", "1", "465.p.2", "2"]]], range: [0, 7] });
    expect(result.map).toHaveLength(2);
    expect(source.calls).toHaveLength(4);
  });

  it("chunks the id map and fails closed when a source exceeds its limit", async () => {
    source.rows.yahoo_players = Array.from({ length: 100 }, (_, i) => yahoo(i + 10, "TOR"));
    await loadSharePlayerSources(20262027, ["TOR"]);
    const chunks = source.calls.filter(item => item.table === "yahoo_nhl_player_map_read");
    expect(chunks.map(item => (item.filters[0][2] as string[]).length)).toEqual([150, 50]);
    source.count.yahoo_players = PLAYER_SOURCE_LIMITS.yahoo + 1;
    await expect(loadSharePlayerSources(20262027, ["TOR"])).rejects.toThrow("over its 2000-row limit");
    source.count = { wgo_goalie_stats_totals: null };
    await expect(loadSharePlayerSources(20262027, ["TOR"])).rejects.toThrow("completeness");
  });

  it("reads last-five-games rows per id chunk, within the lookback, with explicit limits and index order (SS1-24)", async () => {
    source.rows = { rolling_player_game_metrics: [{ player_id: 1 }, { player_id: 3 }], wgo_goalie_stats: [{ goalie_id: 2 }] };
    const recent = await loadSharePlayerRecent(20262027, [3, 1], [2], "2026-10-05");
    const call = (table: string) => source.calls.find(item => item.table === table)!;
    expect(call("rolling_player_game_metrics")).toMatchObject({ range: [0, 2 * RECENT_LIMITS.skaterRowsPerPlayer - 1], filters: [["eq", "season", 20262027], ["eq", "strength_state", "all"], ["in", "player_id", [1, 3]], ["gte", "game_date", "2026-10-05"]] });
    expect(call("wgo_goalie_stats")).toMatchObject({ range: [0, RECENT_LIMITS.goalieRowsPerPlayer - 1], filters: [["eq", "season_id", 20262027], ["in", "goalie_id", [2]], ["gte", "date", "2026-10-05"]] });
    expect(call("rolling_player_game_metrics").columns).not.toMatch(/name|team|ownership/);
    // Unique order in index order (idx_rpgm_player_date / goalie PK): id ascending, newest first (C7 SS1-15-F2).
    expect(call("rolling_player_game_metrics").orders).toEqual([["player_id", true], ["game_date", false]]);
    expect(call("wgo_goalie_stats").orders).toEqual([["goalie_id", true], ["date", false]]);
    expect(recent).toEqual({ rolling: [{ player_id: 1 }, { player_id: 3 }], goalieGames: [{ goalie_id: 2 }], failedIds: [] });
    source.calls = [];
    expect(await loadSharePlayerRecent(20262027, [], [], "2026-10-05")).toEqual({ rolling: [], goalieGames: [], failedIds: [] });
    expect(source.calls).toHaveLength(0);
  });

  it.each([[0, 0], [1, 1], [20, 1], [21, 2], [84, 5]])("splits %i skater ids into %i chunks of at most RECENT_ID_CHUNK, at most 2 at a time", async (count, chunks) => {
    const ids = Array.from({ length: count }, (_, i) => 1000 + i);
    source.rows = { rolling_player_game_metrics: ids.map(id => ({ player_id: id, game_date: "2026-10-20" })), wgo_goalie_stats: [] };
    const recent = await loadSharePlayerRecent(20262027, [...ids].reverse(), [], "2026-10-05");
    const reads = source.calls.filter(call => call.table === "rolling_player_game_metrics");
    expect(RECENT_ID_CHUNK).toBe(20);
    expect(reads).toHaveLength(chunks);
    expect(reads.map(call => (call.filters.find(item => item[0] === "in")![2] as number[]).length)).toEqual(Array.from({ length: chunks }, (_, i) => Math.min(RECENT_ID_CHUNK, count - i * RECENT_ID_CHUNK)));
    expect(reads.every(call => call.range[1] < (call.filters.find(item => item[0] === "in")![2] as number[]).length * RECENT_LIMITS.skaterRowsPerPlayer)).toBe(true);
    expect(source.maxInflight).toBeLessThanOrEqual(RECENT_CHUNK_CONCURRENCY);
    expect(recent.rolling).toHaveLength(count);
    expect(recent.failedIds).toEqual([]);
  });

  it("merges chunks in a stable order: player id ascending, newest game first, whatever the input order", async () => {
    const rows = [5, 30, 1, 22].flatMap(id => ["2026-10-10", "2026-10-20"].map(game_date => ({ player_id: id, game_date })));
    source.rows = { rolling_player_game_metrics: rows, wgo_goalie_stats: [] };
    const recent = await loadSharePlayerRecent(20262027, [30, 22, 5, 1, ...Array.from({ length: 20 }, (_, i) => 100 + i)], [], "2026-10-05");
    expect(recent.rolling!.map(row => `${row.player_id}@${row.game_date}`)).toEqual(["1@2026-10-20", "1@2026-10-10", "5@2026-10-20", "5@2026-10-10", "22@2026-10-20", "22@2026-10-10", "30@2026-10-20", "30@2026-10-10"]);
  });

  it("isolates a failed chunk: only its players lose recent form, with the logged reason (SS1-24 production 57014)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ids = Array.from({ length: 45 }, (_, i) => 1 + i);
    source.rows = { rolling_player_game_metrics: ids.map(id => ({ player_id: id, game_date: "2026-10-20" })), wgo_goalie_stats: [{ goalie_id: 900 }] };
    // The second chunk (ids 21–40) times out like production did.
    source.errors = { rolling_player_game_metrics: (chunk: unknown) => (chunk as number[]).includes(21) ? { code: "57014", message: "canceling statement due to statement timeout" } : null };
    const recent = await loadSharePlayerRecent(20262027, ids, [900], "2026-10-05");
    expect(recent.failedIds).toEqual(ids.slice(20, 40));
    expect(recent.rolling!.map(row => row.player_id)).toEqual([...ids.slice(0, 20), ...ids.slice(40)]);
    expect(recent.goalieGames).toEqual([{ goalie_id: 900 }]);
    expect(warn).toHaveBeenCalledWith("[social-share] Skater recent games unavailable for 20 players (chunk 2 of 3): 57014 canceling statement due to statement timeout");
    // Every chunk failing makes the source unavailable as a whole.
    source.errors = { rolling_player_game_metrics: { code: "57014", message: "timeout" } };
    const down = await loadSharePlayerRecent(20262027, ids, [], "2026-10-05");
    expect(down.rolling).toBeNull();
    expect(down.failedIds).toEqual(ids);
    warn.mockRestore();
  });

  it("fails closed per chunk when its rows exceed the per-player limit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    source.rows = { rolling_player_game_metrics: Array.from({ length: 2 * RECENT_LIMITS.skaterRowsPerPlayer + 1 }, (_, i) => ({ player_id: 1, game_date: `d${i}` })), wgo_goalie_stats: [{ goalie_id: 2 }] };
    expect(await loadSharePlayerRecent(20262027, [1, 3], [2], "2026-10-05")).toEqual({ rolling: null, goalieGames: [{ goalie_id: 2 }], failedIds: [1, 3] });
    expect(warn).toHaveBeenCalledWith(`[social-share] Skater recent games unavailable for 2 players (chunk 1 of 1): Skater recent games response was incomplete or over its ${2 * RECENT_LIMITS.skaterRowsPerPlayer}-row limit.`);
    warn.mockRestore();
  });

  it("a chunk whose rows exactly fill its limit makes one request, never a page past the end (SS1-20 per chunk)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // 20 ids × 22 rows = 440 rows = the chunk's limit and page size.
    const ids = Array.from({ length: 20 }, (_, i) => 1 + i);
    source.rows = { rolling_player_game_metrics: ids.flatMap(id => Array.from({ length: RECENT_LIMITS.skaterRowsPerPlayer }, (_, day) => ({ player_id: id, game_date: `2026-10-${String(1 + day).padStart(2, "0")}` }))), wgo_goalie_stats: [] };
    const recent = await loadSharePlayerRecent(20262027, ids, [], "2026-10-01");
    expect(recent.rolling).toHaveLength(20 * RECENT_LIMITS.skaterRowsPerPlayer);
    expect(source.calls.filter(call => call.table === "rolling_player_game_metrics").map(call => call.range)).toEqual([[0, 20 * RECENT_LIMITS.skaterRowsPerPlayer - 1]]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("derives the per-player cap from the true grain: one row per player per date over the lookback", () => {
    expect(RECENT_LIMITS.skaterRowsPerPlayer).toBe(RECENT_LIMITS.lookbackDays + 1);
    expect(RECENT_LIMITS.goalieRowsPerPlayer).toBe(RECENT_LIMITS.lookbackDays + 1);
  });

  it("makes no read without teams", async () => {
    expect(await loadSharePlayerSources(20262027, [])).toEqual({ yahoo: [], map: [], skaters: [], goalies: [] });
    expect(source.calls).toHaveLength(0);
  });
});

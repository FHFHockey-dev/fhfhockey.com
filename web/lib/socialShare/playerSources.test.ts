import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake anon client records every read; no Supabase request ever leaves this test.
const source = vi.hoisted(() => ({ calls: [] as { table: string; columns: string; filters: [string, string, unknown][]; orders: [string, boolean][]; range: [number, number] }[], rows: {} as Record<string, Record<string, unknown>[]>, count: {} as Record<string, number | null>, errors: {} as Record<string, unknown> }));
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
          if (source.errors[table]) return { data: null, error: source.errors[table], count: null };
          const all = table === "yahoo_nhl_player_map_read" ? (source.rows[table] ?? []).filter(row => (call.filters.find(item => item[0] === "in")![2] as string[]).includes(row.yahoo_player_id as string)) : source.rows[table] ?? [];
          return { data: all.slice(from, to + 1), error: null, count: source.count[table] === undefined ? all.length : source.count[table] };
        },
      };
      return query;
    },
  },
}));
import { loadSharePlayerRecent, loadSharePlayerSources, PLAYER_SOURCE_LIMITS, RECENT_LIMITS } from "./playerSources";

const yahoo = (id: number, team: string) => ({ player_key: `465.p.${id}`, player_id: String(id), editorial_team_abbreviation: team, percent_ownership: 20 });
beforeEach(() => {
  source.calls = []; source.count = {}; source.errors = {};
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

  it("reads last-five-games rows only for the shown players, within the lookback, with explicit limits", async () => {
    source.rows = { rolling_player_game_metrics: [{ player_id: 1 }], wgo_goalie_stats: [{ goalie_id: 2 }] };
    const recent = await loadSharePlayerRecent(20262027, [1, 3], [2], "2026-10-05");
    const call = (table: string) => source.calls.find(item => item.table === table)!;
    expect(call("rolling_player_game_metrics")).toMatchObject({ range: [0, 2 * RECENT_LIMITS.skaterRowsPerPlayer - 1], filters: [["eq", "season", 20262027], ["eq", "strength_state", "all"], ["in", "player_id", [1, 3]], ["gte", "game_date", "2026-10-05"]] });
    expect(call("wgo_goalie_stats")).toMatchObject({ range: [0, RECENT_LIMITS.goalieRowsPerPlayer - 1], filters: [["eq", "season_id", 20262027], ["in", "goalie_id", [2]], ["gte", "date", "2026-10-05"]] });
    expect(call("rolling_player_game_metrics").columns).not.toMatch(/name|team|ownership/);
    // Multi-page reads need a unique order: date, then the player id (C7 SS1-15-F2).
    expect(call("rolling_player_game_metrics").orders).toEqual([["game_date", false], ["player_id", true]]);
    expect(call("wgo_goalie_stats").orders).toEqual([["date", false], ["goalie_id", true]]);
    expect(recent).toEqual({ rolling: [{ player_id: 1 }], goalieGames: [{ goalie_id: 2 }] });
    source.calls = [];
    expect(await loadSharePlayerRecent(20262027, [], [], "2026-10-05")).toEqual({ rolling: [], goalieGames: [] });
    expect(source.calls).toHaveLength(0);
  });

  it("fails closed per source when recent-form rows exceed the per-player limit, logging the reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    source.rows = { rolling_player_game_metrics: Array.from({ length: 2 * RECENT_LIMITS.skaterRowsPerPlayer + 1 }, () => ({ player_id: 1 })), wgo_goalie_stats: [{ goalie_id: 2 }] };
    expect(await loadSharePlayerRecent(20262027, [1, 3], [2], "2026-10-05")).toEqual({ rolling: null, goalieGames: [{ goalie_id: 2 }] });
    expect(warn).toHaveBeenCalledWith(`[social-share] Skater recent games unavailable: Skater recent games response was incomplete or over its ${2 * RECENT_LIMITS.skaterRowsPerPlayer}-row limit.`);
    warn.mockRestore();
  });

  it("SS1-17 reproduction: one failing source used to blank every tile; now the other source still answers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Live-shaped grain: one strength-all row per skater per game date, a full 22-day window for a busy player.
    const days = Array.from({ length: RECENT_LIMITS.lookbackDays + 1 }, (_, i) => `2026-10-${String(4 + i).padStart(2, "0")}`);
    source.rows = { rolling_player_game_metrics: days.map(game_date => ({ player_id: 1, game_date, strength_state: "all" })), wgo_goalie_stats: [] };
    // A PostgREST error on the goalie read (e.g. a timeout or a missing column) no longer rejects the whole load.
    source.errors = { wgo_goalie_stats: { code: "57014", message: "canceling statement due to statement timeout" } };
    const recent = await loadSharePlayerRecent(20262027, [1], [2], "2026-10-04");
    expect(recent.rolling).toHaveLength(days.length);
    expect(recent.goalieGames).toBeNull();
    expect(warn).toHaveBeenCalledWith("[social-share] Goalie recent games unavailable: 57014 canceling statement due to statement timeout");
    // And the reverse: a skater error leaves goalies answering.
    source.errors = { rolling_player_game_metrics: { code: "42703", message: "column rolling_player_game_metrics.x does not exist" } };
    source.rows.wgo_goalie_stats = [{ goalie_id: 2 }];
    expect(await loadSharePlayerRecent(20262027, [1], [2], "2026-10-04")).toEqual({ rolling: null, goalieGames: [{ goalie_id: 2 }] });
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

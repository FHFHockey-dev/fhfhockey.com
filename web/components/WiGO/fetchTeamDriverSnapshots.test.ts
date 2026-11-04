import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTeamDriverSnapshots } from "./fetchTeamDriverSnapshots";

const { from, rows, calls } = vi.hoisted(() => ({
  from: vi.fn(), rows: {} as Record<string, any[]>, calls: [] as any[][]
}));
vi.mock("lib/supabase", () => ({ default: { from } }));

describe("team driver source scope", () => {
  beforeEach(() => {
    calls.length = 0;
    rows.games = [
      { id: 1, date: "2026-01-01", homeTeamId: 1, awayTeamId: 2 },
      { id: 2, date: "2026-01-02", homeTeamId: 1, awayTeamId: 2 }
    ];
    rows.nst_team_5v5 = [{ team_abbreviation: "A", date: "2026-01-02", gp: 2, xgf: 4, xga: 3, gf: 4 }];
    const game = { team_id: 1, date: "2026-01-01", pp_opportunities: 1, power_play_goals_for: 1, times_shorthanded: 1, pp_goals_against: 0 };
    rows.wgo_team_stats = [
      { ...game, game_id: 1 },
      { ...game, game_id: 2, date: "2026-01-02", pp_opportunities: 9, power_play_goals_for: 0 },
      { ...game, game_id: 999, power_play_goals_for: 1 } // Not in regular-season game metadata.
    ];
    from.mockImplementation((table: string) => {
      let rangeStart = 0;
      let rangeEnd = 999;
      let latestFirst = false;
      const builder: any = {};
      for (const method of ["select", "eq", "gte", "lte", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push([table, method, ...args]);
          if (method === "order" && args[0] === "date" && (args[1] as any)?.ascending === false) latestFirst = true;
          return builder;
        };
      }
      builder.range = (start: number, end: number) => { rangeStart = start; rangeEnd = end; return builder; };
      builder.maybeSingle = () => {
        const source = latestFirst ? [...rows[table]].sort((a, b) => b.date.localeCompare(a.date)) : rows[table];
        return Promise.resolve({ data: source[0] ?? null, error: null });
      };
      builder.then = (resolve: any, reject: any) => Promise.resolve({ data: rows[table].slice(rangeStart, rangeEnd + 1), error: null }).then(resolve, reject);
      return builder;
    });
  });

  it("uses regular-season metadata, season bounds and a shared cutoff", async () => {
    const result = await fetchTeamDriverSnapshots(20252026);
    expect(result.specialTeamsRows).toEqual([{ team_id: 1, date: "2026-01-02", power_play_pct: 10, penalty_kill_pct: 100, coveredGames: 2, expectedGames: 2 }]);
    expect(calls).toContainEqual(["games", "eq", "type", 2]);
    expect(calls).toContainEqual(["games", "eq", "seasonId", 20252026]);
    expect(calls).toContainEqual(["nst_team_5v5", "gte", "date", "2025-09-01"]);
    expect(calls).toContainEqual(["wgo_team_stats", "eq", "season_id", 20252026]);
    // One parallel stage: no "latest date" probes.
    expect(calls.some(call => call[1] === "limit")).toBe(false);
  });

  it("drops preseason rows and rows past the last regular-season game", async () => {
    rows.nst_team_5v5 = [
      { team_abbreviation: "A", date: "2025-09-28", gp: 1, xgf: 9, xga: 9, gf: 9 },
      ...rows.nst_team_5v5
    ];
    rows.wgo_team_stats = [...rows.wgo_team_stats,
      { team_id: 1, game_id: 3, date: "2026-04-30", pp_opportunities: 5, power_play_goals_for: 5, times_shorthanded: 0, pp_goals_against: 0 }];
    const result = await fetchTeamDriverSnapshots(20252026);
    expect(result.specialTeamsRows).toEqual([{ team_id: 1, date: "2026-01-02", power_play_pct: 10, penalty_kill_pct: 100, coveredGames: 2, expectedGames: 2 }]);
  });

  it("keeps a team below 90% coverage incomplete (1 of 2 games before the cutoff)", async () => {
    // A missing latest game is writer lag (see the cutoff test); a gap before the cutoff still excludes the team.
    rows.wgo_team_stats = rows.wgo_team_stats.filter(row => row.game_id !== 1);
    expect((await fetchTeamDriverSnapshots(20252026)).specialTeamsRows).toEqual([]);
  });

  it("cuts both sources at the earlier latest date when the WGO team writer lags a night", async () => {
    rows.wgo_team_stats = rows.wgo_team_stats.filter(row => row.date === "2026-01-01" && row.game_id !== 999);
    const result = await fetchTeamDriverSnapshots(20252026);
    // Before: cutoff 2026-01-02 from NST alone, so game 2 counted as missing and the team was dropped.
    expect(result.specialTeamsRows).toEqual([{ team_id: 1, date: "2026-01-01", power_play_pct: 100, penalty_kill_pct: 100, coveredGames: 1, expectedGames: 1 }]);
    // The NST row on 2026-01-02 is past the shared cutoff, so it is left out.
    expect(result.fiveOnFiveRows).toEqual([]);
  });

  it("does not substitute another season when the requested season has no games", async () => {
    rows.games = [];
    expect(await fetchTeamDriverSnapshots(20262027)).toEqual({ fiveOnFiveRows: [], specialTeamsRows: [] });
  });
});

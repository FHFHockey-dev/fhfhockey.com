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
      const builder: any = {};
      for (const method of ["select", "eq", "gte", "lte", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => { calls.push([table, method, ...args]); return builder; };
      }
      builder.range = (start: number, end: number) => { rangeStart = start; rangeEnd = end; return builder; };
      builder.maybeSingle = () => Promise.resolve({ data: rows[table][0] ?? null, error: null });
      builder.then = (resolve: any, reject: any) => Promise.resolve({ data: rows[table].slice(rangeStart, rangeEnd + 1), error: null }).then(resolve, reject);
      return builder;
    });
  });

  it("uses regular-season metadata, season bounds and a shared cutoff", async () => {
    const result = await fetchTeamDriverSnapshots(20252026);
    expect(result.specialTeamsRows).toEqual([{ team_id: 1, date: "2026-01-02", power_play_pct: 10, penalty_kill_pct: 100 }]);
    expect(calls).toContainEqual(["games", "eq", "type", 2]);
    expect(calls).toContainEqual(["games", "eq", "seasonId", 20252026]);
    expect(calls).toContainEqual(["nst_team_5v5", "gte", "date", "2026-01-01"]);
    expect(calls).toContainEqual(["wgo_team_stats", "lte", "date", "2026-01-02"]);
    expect(calls).toContainEqual(["wgo_team_stats", "eq", "season_id", 20252026]);
  });

  it("excludes a team when one expected game is absent", async () => {
    rows.wgo_team_stats = rows.wgo_team_stats.filter(row => row.game_id !== 2);
    expect((await fetchTeamDriverSnapshots(20252026)).specialTeamsRows).toEqual([]);
  });

  it("does not substitute another season when the requested season has no games", async () => {
    rows.games = [];
    expect(await fetchTeamDriverSnapshots(20262027)).toEqual({ fiveOnFiveRows: [], specialTeamsRows: [] });
    expect(calls.every(call => call[0] === "games")).toBe(true);
  });
});

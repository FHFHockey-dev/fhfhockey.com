import { describe, expect, it } from "vitest";
import { buildTeamGames, teamGamesWindow } from "./teamGames";

const teams = ["NJD", "NYI", "NYR"];
const base = { from: "2026-10-24", through: "2026-10-30", teams, updatedAt: null };

describe("team games example post", () => {
  it("runs through yesterday in New York", () => {
    expect(teamGamesWindow("2026-11-01T02:00:00Z", 7)).toEqual({ from: "2026-10-24", through: "2026-10-30", season: 20262027 });
  });
  it("counts distinct games, shares tied ranks and keeps a proven zero", () => {
    const result = buildTeamGames({ ...base, scheduledGames: 1, rows: [{ team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 2, game_id: 5, date: "2026-10-30" }] });
    expect(result.state).toBe("ready");
    expect(result.data?.rows.map(row => [row.team, row.games, row.rank])).toEqual([["NJD", 1, 1], ["NYI", 1, 1], ["NYR", 0, 3]]);
    expect(result.evidence.coverage).toEqual({ observed: 2, expected: 2, missing: 0, unit: "team games" });
  });
  it("is partial, not ready, when scheduled games have no result", () => {
    const result = buildTeamGames({ ...base, scheduledGames: 2, rows: [{ team_id: 1, game_id: 5, date: "2026-10-30" }, { team_id: 2, game_id: 5, date: "2026-10-30" }] });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/2 of 4/);
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  buildProjectionRows,
  runSustainabilityRecompute
} from "./recompute";

const source = {
  player_id: 8478402,
  date: "2026-03-20",
  games_played: 70,
  toi_per_game: 20,
  goals_per_game: 0.5,
  assists_per_game: 0.7,
  points_per_game: 1.2,
  shots_per_game: 3,
  pp_points: 28,
  hits_per_game: 1.1,
  blocks_per_game: 0.6
};

describe("sustainability recompute", () => {
  it("builds five/ten-game snapshots and opponent-game rows", () => {
    const rows = buildProjectionRows({
      source,
      teamId: 14,
      snapshotDate: "2026-03-21",
      upcoming: [
        {
          gameId: 2025021001,
          gameDate: "2026-03-22",
          teamId: 14,
          opponentTeamId: 8,
          isHome: true,
          opponentTeamAbbreviation: "MTL",
          opponentStrength: null
        }
      ]
    });

    expect(rows).toHaveLength(21);
    expect(rows.filter((row) => row.projection_type === "snapshot")).toHaveLength(14);
    expect(rows.filter((row) => row.projection_type === "opponent_game")).toHaveLength(7);
    expect(rows).toContainEqual(
      expect.objectContaining({
        metric_key: "goals",
        horizon_games: 5,
        projection_type: "snapshot",
        expected_value: 2.5
      })
    );
  });

  it("keeps player failures explicit and persists successful rows", async () => {
    const persist = vi.fn().mockResolvedValue({ inserted: 14, chunks: 1 });
    const result = await runSustainabilityRecompute({
      client: {} as any,
      snapshotDate: "2026-03-21",
      offset: 0,
      limit: 2,
      dry: false,
      dependencies: {
        loadPlayers: vi.fn().mockResolvedValue([
          { playerId: 8478402, teamId: 14 },
          { playerId: 999, teamId: 8 }
        ]),
        loadSource: vi.fn().mockImplementation(async ({ playerId }) => {
          if (playerId === 999) throw new Error("source unavailable");
          return source;
        }),
        loadUpcoming: vi.fn().mockResolvedValue([]),
        persist
      }
    });

    expect(result.rowsBuilt).toBe(14);
    expect(result.rowsUpserted).toBe(14);
    expect(result.failures).toEqual([
      { playerId: 999, message: "source unavailable" }
    ]);
    expect(result.hasMore).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });
});

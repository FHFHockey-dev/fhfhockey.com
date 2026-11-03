import { describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { calculateGameScore } from "./calculations";
import { fetchLegacySkoGameLogs } from "./dataFetching";
import { computeCharacteristicResults } from "./statistics";
import type { PlayerGameLog } from "./types";

function tableQuery(rows: unknown[]) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn().mockResolvedValue({ data: rows, error: null });
  return builder;
}

function gameLog(date: string, shootingPercentage: number): PlayerGameLog {
  return {
    player_id: 8478402,
    player_name: "Test Skater",
    season_id: 20252026,
    date,
    games_played: 1,
    goals: 0,
    assists: 0,
    points: 0,
    shots: 2,
    time_on_ice: 1080,
    es_goals_for: 0,
    pp_goals_for: 0,
    sh_goals_for: 0,
    total_primary_assists: 1,
    total_secondary_assists: 1,
    shooting_percentage: shootingPercentage,
    on_ice_shooting_pct: 9,
    zone_start_pct: 50,
    pp_toi_pct_per_game: 40,
    ipp: 50,
    sog_per_60: 6.7,
  };
}

describe("legacy sKO helpers", () => {
  it("takes goals against from wgo_skater_stats so GameScore keeps its GA term", async () => {
    const date = "2026-01-10";
    fromMock.mockImplementation((table: string) =>
      table === "wgo_skater_stats"
        ? tableQuery([
            {
              player_id: 8478402,
              player_name: "Test Skater",
              date,
              es_goals_against: 2,
              pp_goals_against: 0,
              sh_goals_against: 1,
            },
          ])
        : // sko_skater_stats rows have no goals-against columns.
          tableQuery([{ player_id: 8478402, date, es_goals_for: 1 }]),
    );

    const { combinedGameLogs } = await fetchLegacySkoGameLogs(
      8478402,
      20252026,
    );
    const game = combinedGameLogs![0];

    expect(game).toMatchObject({
      es_goals_for: 1,
      es_goals_against: 2,
      pp_goals_against: 0,
      sh_goals_against: 1,
    });
    // 0.15 * GF - 0.15 * GA with every other input 0.
    expect(calculateGameScore(game)).toBeCloseTo(0.15 * 1 - 0.15 * 3, 10);
  });

  it("scores each game against earlier games only", () => {
    const early = [
      gameLog("2026-01-01", 10),
      gameLog("2026-01-03", 12),
      gameLog("2026-01-05", 30),
    ];
    const withFuture = [
      ...early.map((game) => ({ ...game })),
      gameLog("2026-01-07", 90),
      gameLog("2026-01-09", 95),
    ];

    const earlyOnly = computeCharacteristicResults(early).results;
    const full = computeCharacteristicResults(withFuture).results;

    expect(full[0].overallStatus).toBe("Insufficient History");
    expect(Number.isNaN(full[0].sumOfWeightedSquaredZScores)).toBe(true);
    for (const index of [1, 2]) {
      expect(full[index].sumOfWeightedSquaredZScores).toBe(
        earlyOnly[index].sumOfWeightedSquaredZScores,
      );
      expect(full[index].overallStatus).toBe(earlyOnly[index].overallStatus);
    }
  });
});

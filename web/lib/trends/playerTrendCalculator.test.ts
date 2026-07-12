import { describe, expect, it } from "vitest";

import { buildPlayerTrendRecords } from "./playerTrendCalculator";

describe("buildPlayerTrendRecords incremental emission", () => {
  it("uses full history for accumulators while emitting only the repair window", () => {
    const rows = [
      {
        player_id: 8470001,
        date: "2026-03-01",
        season_id: 20252026,
        position_code: "C",
        games_played: 1,
        shots: 2,
        toi_per_game: 20,
      },
      {
        player_id: 8470001,
        date: "2026-03-10",
        season_id: 20252026,
        position_code: "C",
        games_played: 2,
        shots: 4,
        toi_per_game: 20,
      },
    ] as any;

    const records = buildPlayerTrendRecords(rows, {
      emitFromDate: "2026-03-08",
    });
    const shotRate = records.find(
      (record) => record.metric_key === "shots_per_60",
    );

    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((record) => record.game_date))).toEqual(
      new Set(["2026-03-10"]),
    );
    expect(shotRate).toMatchObject({
      raw_value: 12,
      average_value: 9,
      sample_size: 2,
    });
  });
});

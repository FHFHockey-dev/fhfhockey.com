import { describe, expect, it } from "vitest";

import { buildPlayerTrendRecords } from "./playerTrendCalculator";

describe("buildPlayerTrendRecords incremental emission", () => {
  it("uses ixG per unblocked attempt for expected shooting percentage", () => {
    const records = buildPlayerTrendRecords([
      {
        player_id: 8470001,
        date: "2026-03-10",
        season_id: 20252026,
        position_code: "C",
        nst_ixg: 2.5,
        nst_iff: 10,
        shots: 4,
      },
    ] as any);

    expect(
      records.find((record) => record.metric_key === "expected_shooting_pct"),
    ).toMatchObject({
      raw_value: 25,
      average_value: 25,
      sample_size: 1,
    });
  });

  it("fails closed when the unblocked-attempt denominator is missing or non-positive", () => {
    const records = buildPlayerTrendRecords([
      {
        player_id: 8470001,
        date: "2026-03-10",
        season_id: 20252026,
        position_code: "C",
        nst_ixg: 2.5,
        nst_iff: 0,
      },
      {
        player_id: 8470001,
        date: "2026-03-11",
        season_id: 20252026,
        position_code: "C",
        nst_ixg: 1.5,
        nst_iff: -2,
      },
      {
        player_id: 8470001,
        date: "2026-03-12",
        season_id: 20252026,
        position_code: "C",
        nst_ixg: 1,
      },
    ] as any);

    expect(
      records
        .filter((record) => record.metric_key === "expected_shooting_pct")
        .map((record) => record.raw_value),
    ).toEqual([null, null, null]);
  });

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

import { describe, expect, it } from "vitest";

import {
  buildPlayerTrendRecords,
  normalizePlayoffSkaterTrendRow,
} from "./playerTrendCalculator";

function metric(records: ReturnType<typeof buildPlayerTrendRecords>, key: string) {
  return records.filter((record) => record.metric_key === key);
}

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
      calculation_version: "player-trend-v3-toi-seconds",
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
        toi_per_game: 1200,
      },
      {
        player_id: 8470001,
        date: "2026-03-10",
        season_id: 20252026,
        position_code: "C",
        games_played: 2,
        shots: 4,
        toi_per_game: 1200,
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

describe("per-60 fallback and TOI units (W1 P0 #9, BA W1-3 D1/D8)", () => {
  it("computes the regular-season shots/60 fallback from TOI seconds", () => {
    // McDavid 2026-11-09: 4 shots in 1,474 s, no NST rate yet.
    const records = buildPlayerTrendRecords([
      {
        player_id: 8478402,
        date: "2026-11-09",
        season_id: 20252026,
        position_code: "C",
        shots: 4,
        toi_per_game: 1474,
      },
    ] as any);

    expect(metric(records, "shots_per_60")[0].raw_value).toBeCloseTo(
      (4 * 3600) / 1474,
      6,
    );
    expect(metric(records, "shots_per_60")[0].raw_value).toBeCloseTo(9.77, 2);
  });

  it("agrees with the NST rate when both are available", () => {
    // McDavid 2026-11-07: 3 shots, 1,515 s, NST shots/60 7.13.
    const base = {
      player_id: 8478402,
      season_id: 20252026,
      position_code: "C",
      shots: 3,
      toi_per_game: 1515,
    };
    const [withNst, fallbackOnly] = [
      buildPlayerTrendRecords([
        { ...base, date: "2026-11-07", nst_shots_per_60: 7.13 },
      ] as any),
      buildPlayerTrendRecords([{ ...base, date: "2026-11-07" }] as any),
    ].map((records) => metric(records, "shots_per_60")[0].raw_value!);

    expect(Math.abs(withNst - fallbackOnly)).toBeLessThan(0.05);
  });

  it("computes the ixG/60 fallback from TOI seconds", () => {
    const records = buildPlayerTrendRecords([
      {
        player_id: 8478402,
        date: "2026-11-09",
        season_id: 20252026,
        position_code: "C",
        nst_ixg: 0.8,
        toi_per_game: 1200,
      },
    ] as any);

    expect(metric(records, "ixg_per_60")[0].raw_value).toBeCloseTo(2.4, 6);
  });

  it("keeps playoff TOI in seconds so one unit holds across a season", () => {
    const playoffRow = normalizePlayoffSkaterTrendRow({
      player_id: 8478402,
      date: "2026-05-08",
      season_id: 20252026,
      position_code: "C",
      games_played: 1,
      shots: 4,
      toi_per_game: 1203,
    } as any);
    const records = buildPlayerTrendRecords([
      {
        player_id: 8478402,
        date: "2026-04-14",
        season_id: 20252026,
        position_code: "C",
        shots: 3,
        toi_per_game: 1400,
      },
      {
        player_id: 8478402,
        date: "2026-04-16",
        season_id: 20252026,
        position_code: "C",
        shots: 2,
        toi_per_game: 1450,
      },
      playoffRow,
    ] as any);

    expect(playoffRow.toi_per_game).toBe(1203);
    const toi = metric(records, "toi");
    expect(toi[2].average_value).toBeCloseTo((1400 + 1450 + 1203) / 3, 6);
    expect(metric(records, "shots_per_60")[2].raw_value).toBeCloseTo(
      (4 * 3600) / 1203,
      6,
    );
  });

  it("leaves the fallback unknown when TOI is missing or zero", () => {
    const records = buildPlayerTrendRecords([
      {
        player_id: 1,
        date: "2026-11-01",
        season_id: 20252026,
        position_code: "C",
        shots: 2,
        toi_per_game: 0,
      },
      {
        player_id: 1,
        date: "2026-11-02",
        season_id: 20252026,
        position_code: "C",
        shots: 2,
      },
    ] as any);

    expect(metric(records, "shots_per_60").map((r) => r.raw_value)).toEqual([
      null,
      null,
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildSkaterWindowAggregatesFromRollingRow,
  getSkaterWindowSemantics,
  isSupportedSkaterWindowStrengthState,
  SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES,
  type RollingPlayerGameMetricRow,
} from "./skaterWindowAggregation";
import { ROLLING_RANKING_SELECT_FIELDS } from "./rollingRankingSelectFields";
import {
  ROLLING_WINDOW_COUNT_CURRENT_SEASON_VERSION,
  ROLLING_WINDOW_COUNT_SUPPORT_VERSION,
  type RollingWindowCountSupport,
} from "lib/rollingPlayerWindowCountSupport";

type SupportWindowInput = {
  gameIds: number[];
  ratio?: Record<string, [number, number, number]>;
};

// L6 explicit window counts (rolling-player-window-counts-v1).
function windowSupport(
  windows: Partial<Record<"last5" | "last10" | "last20", SupportWindowInput>>,
): RollingWindowCountSupport {
  const build = (input?: SupportWindowInput) => ({
    appearances: input?.gameIds.length ?? 0,
    gameIds: input?.gameIds ?? [],
    gameDates: (input?.gameIds ?? []).map((_, index) => `2026-01-${String(index + 1).padStart(2, "0")}`),
    ratio: input?.ratio ?? {},
    secondary: {},
  });
  return {
    version: ROLLING_WINDOW_COUNT_SUPPORT_VERSION,
    strengthState: "all",
    anchor: { gameId: 2025020500, gameDate: "2026-01-15", season: 20252026 },
    selection: "chronological_appearances_in_strength_state",
    game: { appeared: true, ratio: {}, additive: {} },
    windows: {
      last5: build(windows.last5),
      last10: build(windows.last10),
      last20: build(windows.last20),
    },
  };
}

const gameIds = (count: number, startYear = 2025, first = 400) =>
  Array.from({ length: count }, (_, index) => startYear * 1_000_000 + 20_000 + first + index);

function rollingRow(
  overrides: Partial<RollingPlayerGameMetricRow> = {},
): RollingPlayerGameMetricRow {
  return {
    player_id: 1,
    team_id: 10,
    season: 20252026,
    game_date: "2026-01-15",
    strength_state: "all",
    season_games_played: 30,
    season_participation_games: null,
    games_played: 30,
    toi_seconds_avg_season: 900,
    toi_seconds_total_last5: 4500,
    toi_seconds_total_last10: 9000,
    toi_seconds_total_last20: 18000,
    goals_per_60_last5: 2.4,
    // `<metric>_total_lastN` aliases hold the RATE (L6 contract), never a count.
    goals_per_60_total_last5: 2.4,
    goals_per_60_season: 1.2,
    goals_per_60_goals_season: 9,
    goals_per_60_toi_seconds_season: 27000,
    points_total_last5: 8,
    points_avg_season: 0.75,
    pp_points_total_last5: 4,
    pp_points_avg_season: 0.35,
    pp_toi_seconds_total_last5: 1200,
    pp_toi_seconds_avg_season: 180,
    shot_attempts_per_60_last5: 8,
    shot_attempts_per_60_total_last5: 8,
    shot_attempts_per_60_season: 6,
    shot_attempts_per_60_shot_attempts_season: 45,
    shot_attempts_per_60_toi_seconds_season: 27000,
    penalties_taken_per_60_last5: 2.4,
    penalties_taken_per_60_total_last5: 2.4,
    penalties_taken_per_60_season: 1.6,
    penalties_taken_per_60_penalties_taken_season: 12,
    penalties_taken_per_60_toi_seconds_season: 27000,
    ixg_per_60_total_last5: 2,
    ixg_per_60_ixg_season: 7.5,
    ixg_per_60_toi_seconds_season: 27000,
    oi_gf_total_last5: 6,
    oi_ga_total_last5: 4,
    oi_gf_avg_season: 2,
    oi_ga_avg_season: 1,
    oi_xgf_total_last5: 5,
    oi_xga_total_last5: 3,
    oi_xgf_avg_season: 1.4,
    oi_xga_avg_season: 1.1,
    windowCountSupport: windowSupport({
      last5: {
        gameIds: gameIds(5),
        ratio: {
          goals_per_60: [3, 4500, 5],
          ixg_per_60: [2.5, 4500, 5],
          shot_attempts_per_60: [10, 4500, 5],
          penalties_taken_per_60: [3, 4500, 5],
          expected_sh_pct: [2.5, 8, 5],
        },
      },
      last10: { gameIds: gameIds(10) },
      last20: { gameIds: gameIds(20) },
    }),
    ...overrides,
  } as RollingPlayerGameMetricRow;
}

describe("skaterWindowAggregation", () => {
  it("keeps last-N production windows on player appearance semantics", () => {
    expect(getSkaterWindowSemantics("season")).toBe("season_to_date");
    expect(getSkaterWindowSemantics("last5")).toBe(
      "player_last_n_games_played",
    );

    const [goalsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["goals_per_60"] },
    );

    expect(goalsLast5).toMatchObject({
      playerId: 1,
      teamId: 10,
      seasonId: 20252026,
      snapshotDate: "2026-01-15",
      strengthState: "all",
      window: "last5",
      windowType: "last_5",
      windowSize: 5,
      windowSemantics: "player_last_n_games_played",
      metricKey: "goals_per_60",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      gamesPlayed: 5,
      toiSeconds: 4500,
    });
  });

  it("derives points per 60 from verified points and TOI fields", () => {
    const [pointsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["points_per_60"] },
    );

    expect(pointsLast5).toMatchObject({
      metricKey: "points_per_60",
      rawValue: 6.4,
      numerator: 8,
      denominator: 4500,
      sourceFields: ["points_total_last5", "toi_seconds_total_last5"],
    });
  });

  it("derives PP points per 60 from verified PP points and PP TOI fields", () => {
    const [ppPointsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "pp", season_games_played: null }),
      { windows: ["last5"], metricKeys: ["pp_points_per_60"] },
    );

    expect(ppPointsLast5).toMatchObject({
      metricKey: "pp_points_per_60",
      strengthState: "pp",
      rawValue: 12,
      numerator: 4,
      denominator: 1200,
      toiSeconds: 1200,
      sourceFields: ["pp_points_total_last5", "pp_toi_seconds_total_last5"],
    });
  });

  it("keeps every PP-points input inside the ranking select list", () => {
    const ppInputs = [
      "pp_points_avg_season",
      "pp_toi_seconds_avg_season",
      ...(["last5", "last10", "last20"] as const).flatMap((window) => [
        `pp_points_total_${window}`,
        `pp_toi_seconds_total_${window}`,
      ]),
    ];
    expect(ROLLING_RANKING_SELECT_FIELDS).toEqual(expect.arrayContaining(ppInputs));

    // Drift guard: record every row field the aggregator reads for any
    // window/strength and require the ranking reader to select it.
    const read = new Set<string>();
    for (const strength_state of ["all", "5v5", "ev", "pp", "pk"]) {
      const row = new Proxy(rollingRow({ strength_state }), {
        get(target, key, receiver) {
          if (typeof key === "string") read.add(key);
          return Reflect.get(target, key, receiver);
        },
      });
      buildSkaterWindowAggregatesFromRollingRow(row);
    }
    expect(read).toContain("pp_points_total_last20");
    const selected = new Set<string>(ROLLING_RANKING_SELECT_FIELDS);
    // `windowCountSupport` is joined from the support-payload table, not selected.
    expect(
      [...read].filter((field) => !selected.has(field) && field !== "windowCountSupport"),
    ).toEqual([]);
  });

  it("derives season PP points per 60 from PP average fields", () => {
    const [ppPointsSeason] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "pp", season_games_played: null }),
      { windows: ["season"], metricKeys: ["pp_points_per_60"] },
    );

    expect(ppPointsSeason).toMatchObject({
      metricKey: "pp_points_per_60",
      strengthState: "pp",
      rawValue: 7,
      numerator: 10.5,
      denominator: 5400,
      toiSeconds: 5400,
      sourceFields: ["pp_points_avg_season", "pp_toi_seconds_avg_season"],
    });
  });

  it("uses selected-window NST ICF for shot attempts per 60", () => {
    const [attemptsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["shot_attempts_per_60"] },
    );

    expect(attemptsLast5).toMatchObject({
      metricKey: "shot_attempts_per_60",
      rawValue: 8,
      numerator: 10,
      denominator: 4500,
      sourceFields: [
        "shot_attempts_per_60_last5",
        "rolling_player_metric_support_payloads.windowCountSupport.last5.shot_attempts_per_60",
      ],
    });
  });

  it("uses selected-window total penalties for penalties taken per 60", () => {
    const [penaltiesLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["penalties_taken_per_60"] },
    );

    expect(penaltiesLast5).toMatchObject({
      metricKey: "penalties_taken_per_60",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      sourceFields: [
        "penalties_taken_per_60_last5",
        "rolling_player_metric_support_payloads.windowCountSupport.last5.penalties_taken_per_60",
      ],
    });
  });

  it("derives xG finishing metrics from L6 window counts in goals and Fenwick (W2-P0-11, D5)", () => {
    const aggregates = buildSkaterWindowAggregatesFromRollingRow(rollingRow(), {
      windows: ["last5"],
      metricKeys: [
        "expected_shooting_percentage",
        "sax_percentage",
        "goals_above_expected",
        "unrealized_xg",
        "goals_above_expected_per_60",
        "unrealized_xg_per_60",
      ],
    });

    expect(aggregates).toHaveLength(6);
    const byKey = new Map(aggregates.map((aggregate) => [aggregate.metricKey, aggregate]));
    // xS% = ixG ÷ unblocked attempts × 100 (decision 17), not ÷ all attempts.
    expect(byKey.get("expected_shooting_percentage")).toMatchObject({
      rawValue: 31.25,
      numerator: 2.5,
      denominator: 8,
    });
    // SAX% = (goals − ixG) ÷ unblocked attempts × 100 on the same games.
    expect(byKey.get("sax_percentage")).toMatchObject({
      rawValue: 6.25,
      numerator: 0.5,
      denominator: 8,
    });
    // Counts in goals (3 − 2.5), not the per-60 alias difference (2.4 − 2).
    expect(byKey.get("goals_above_expected")).toMatchObject({
      rawValue: 0.5,
      numerator: 3,
      denominator: 2.5,
    });
    expect(byKey.get("unrealized_xg")).toMatchObject({ rawValue: -0.5 });
    expect(byKey.get("goals_above_expected_per_60")).toMatchObject({
      rawValue: 0.4,
      numerator: 0.5,
      denominator: 4500,
    });
    expect(byKey.get("unrealized_xg_per_60")).toMatchObject({ rawValue: -0.4 });
  });

  it("gives identical season and last-20 GAx for the same 20 games, in goals (W2-P0-11)", () => {
    const row = rollingRow({
      season: 20262027,
      season_games_played: 20,
      season_participation_games: 20,
      games_played: 20,
      goals_per_60_goals_season: 6,
      goals_per_60_toi_seconds_season: 18000,
      ixg_per_60_ixg_season: 4,
      ixg_per_60_toi_seconds_season: 18000,
      goals_per_60_total_last20: 1.2,
      ixg_per_60_total_last20: 0.8,
      windowCountSupport: windowSupport({
        last20: {
          gameIds: gameIds(20, 2026, 1),
          ratio: { goals_per_60: [6, 18000, 20], ixg_per_60: [4, 18000, 20] },
        },
      }),
    });
    const [season, last20] = buildSkaterWindowAggregatesFromRollingRow(row, {
      windows: ["season", "last20"],
      metricKeys: ["goals_above_expected"],
    });
    expect(season.rawValue).toBe(2);
    expect(last20.rawValue).toBe(2);
  });

  it("leaves last-N counts unknown without L6 support and never divides a rate alias by seconds (W3-6 N1)", () => {
    const [goals] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ windowCountSupport: null, goals_per_60_last5: null }),
      { windows: ["last5"], metricKeys: ["goals_per_60"] },
    );
    // Old fallback: 2.4 (a rate) ÷ 4500 s × 3600 = 1.92, exported as a "count".
    expect(goals).toMatchObject({ rawValue: null, numerator: null, denominator: null });

    const [gax] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ windowCountSupport: null }),
      { windows: ["last5"], metricKeys: ["goals_above_expected"] },
    );
    expect(gax.rawValue).toBeNull();

    // Count specs keep the fallback: 3 points over 6,852 s → 1.576 per 60.
    const [points] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ windowCountSupport: null, points_total_last5: 3, toi_seconds_total_last5: 6852 }),
      { windows: ["last5"], metricKeys: ["points_per_60"] },
    );
    expect(points).toMatchObject({ numerator: 3, denominator: 6852 });
    expect(points.rawValue).toBeCloseTo(1.576182, 5);
  });

  it("treats a covered subset of the window as unknown (rule 22)", () => {
    const [goals] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        goals_per_60_last5: null,
        windowCountSupport: windowSupport({
          last5: { gameIds: gameIds(5), ratio: { goals_per_60: [3, 3600, 4] } },
        }),
      }),
      { windows: ["last5"], metricKeys: ["goals_per_60"] },
    );
    expect(goals).toMatchObject({ rawValue: null, numerator: null });
  });

  it("serves season xS% only from rows written with the Fenwick definition (D5)", () => {
    const [withSupport] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ expected_sh_pct_season: 9.5 } as Partial<RollingPlayerGameMetricRow>),
      { windows: ["season"], metricKeys: ["expected_shooting_percentage"] },
    );
    expect(withSupport.rawValue).toBe(9.5);
    const [legacy] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ windowCountSupport: null, expected_sh_pct_season: 0.095 } as Partial<RollingPlayerGameMetricRow>),
      { windows: ["season"], metricKeys: ["expected_shooting_percentage", "sax_percentage"] },
    );
    expect(legacy.rawValue).toBeNull();
  });

  it("gates season xGA/60 on the season's exposure, not one game's TOI (D6)", () => {
    const [xga] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        strength_state: "5v5",
        season_games_played: null,
        season_participation_games: 40,
        toi_seconds_avg_season: 550,
        oi_xga_avg_season: 0.5,
      }),
      { windows: ["season"], metricKeys: ["xga_per_60"] },
    );
    expect(xga.toiSeconds).toBe(22000);
    expect(xga.rawValue).toBeCloseTo((0.5 / 550) * 3600, 6);
  });

  it("derives on-ice GF percentage from selected-window on-ice goal totals", () => {
    const [onIceGf] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "5v5", season_games_played: null }),
      { windows: ["last5"], metricKeys: ["on_ice_gf_percentage"] },
    );

    expect(onIceGf).toMatchObject({
      metricKey: "on_ice_gf_percentage",
      strengthState: "5v5",
      rawValue: 60,
      numerator: 6,
      denominator: 10,
      toiSeconds: 4500,
      sourceFields: ["oi_gf_total_last5", "oi_ga_total_last5"],
    });
  });

  it("derives true 5v5 on-ice xG metrics from selected-window support totals", () => {
    const [xgaPer60, onIceXgf] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "5v5", season_games_played: null }),
      {
        windows: ["last5"],
        metricKeys: ["xga_per_60", "on_ice_xgf_percentage"],
      },
    );

    expect(xgaPer60).toMatchObject({
      metricKey: "xga_per_60",
      strengthState: "5v5",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      sourceFields: ["oi_xga_total_last5", "toi_seconds_total_last5"],
    });
    expect(onIceXgf).toMatchObject({
      metricKey: "on_ice_xgf_percentage",
      strengthState: "5v5",
      rawValue: 62.5,
      numerator: 5,
      denominator: 8,
      sourceFields: ["oi_xgf_total_last5", "oi_xga_total_last5"],
    });
  });

  it("does not calculate rates when denominator samples are missing or zero", () => {
    const [pointsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ toi_seconds_total_last5: 0 }),
      { windows: ["last5"], metricKeys: ["points_per_60"] },
    );

    expect(pointsLast5.rawValue).toBeNull();
    expect(pointsLast5.denominator).toBe(0);
  });

  it("preserves split-strength participation samples and supported strength states", () => {
    expect(isSupportedSkaterWindowStrengthState("ev")).toBe(true);
    expect(isSupportedSkaterWindowStrengthState("5v5")).toBe(true);

    const [goalsLast10] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        strength_state: "ev",
        season_games_played: null,
        season_participation_games: 6,
        toi_seconds_total_last10: 5400,
        goals_per_60_last10: 1,
        goals_per_60_total_last10: 1,
        windowCountSupport: windowSupport({ last10: { gameIds: gameIds(6) } }),
      }),
      { windows: ["last10"], metricKeys: ["goals_per_60"] },
    );

    expect(goalsLast10.gamesPlayed).toBe(6);
    expect(goalsLast10.strengthState).toBe("ev");
  });

  it("counts last-N games from persisted window membership across seasons (W2-4 A2, D8)", () => {
    // Three lifetime appearances: one in 2025-26, two in 2026-27, 900 s each.
    const [goalsLast20] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        season: 20262027,
        strength_state: "5v5",
        season_games_played: 2,
        season_participation_games: 2,
        toi_seconds_avg_season: 900,
        toi_seconds_total_last20: 2700,
        toi_seconds_avg_last20: null,
        windowCountSupport: windowSupport({
          last20: {
            gameIds: [2025020900, 2026020010, 2026020020],
            ratio: { goals_per_60: [1, 2700, 3] },
          },
        }),
      }),
      { windows: ["last20"], metricKeys: ["goals_per_60"], windowScope: "cross_season" },
    );

    // The old heuristic reported a full 20-game window here.
    expect(goalsLast20.gamesPlayed).toBe(3);
    expect(goalsLast20.toiSeconds).toBe(2700);
    expect(goalsLast20.windowMembership).toMatchObject({
      scope: "cross_season",
      requested: 20,
      appearances: 3,
      currentSeasonAppearances: 2,
      crossesSeasons: true,
    });

    // A stored total and mean for the same window still give the exact count.
    const [withAverage] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        windowCountSupport: null,
        toi_seconds_total_last20: 11925,
        toi_seconds_avg_last20: 596.25,
      }),
      { windows: ["last20"], metricKeys: ["goals_per_60"] },
    );
    expect(withAverage.gamesPlayed).toBe(20);

    // Neither support nor a window mean: unknown, never inferred from TOI magnitudes.
    const [unknown] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        windowCountSupport: null,
        season_games_played: 4,
        toi_seconds_avg_season: 503.25,
        toi_seconds_total_last20: 11925,
        toi_seconds_avg_last20: null,
      }),
      { windows: ["last20"], metricKeys: ["goals_per_60"] },
    );
    expect(unknown.gamesPlayed).toBeNull();
  });

  // Decision 103 fixture: season 2026-27, the last-20 window holds 5 games from
  // 2025-26 and 15 from 2026-27. Cross-season: G 8, A 6, ixG 5 over 18,000 s;
  // current season: G 6, A 3, ixG 4 over 13,500 s (the actual n is 15).
  function crossingRow(currentSeason = true) {
    const ids = [...gameIds(5, 2025, 1200), ...gameIds(15, 2026, 1)];
    const support = windowSupport({
      last20: {
        gameIds: ids,
        ratio: {
          goals_per_60: [8, 18000, 20],
          assists_per_60: [6, 18000, 20],
          ixg_per_60: [5, 18000, 20],
        },
      },
    });
    if (currentSeason) {
      support.currentSeason = {
        version: ROLLING_WINDOW_COUNT_CURRENT_SEASON_VERSION,
        season: 20262027,
        selection: "chronological_appearances_in_strength_state_current_season",
        windows: Object.fromEntries((["last5", "last10", "last20"] as const).map((key) => [key, {
          requested: Number(key.slice(4)) as 5 | 10 | 20,
          appearances: 15,
          gameIds: ids.slice(5),
          gameDates: Array(15).fill("2026-11-10"),
          ratio: {
            goals_per_60: [6, 13500, 15],
            assists_per_60: [3, 13500, 15],
            ixg_per_60: [4, 13500, 15],
          } as Record<string, [number, number, number]>,
          secondary: {},
        }])) as NonNullable<RollingWindowCountSupport["currentSeason"]>["windows"],
        seasonTotals: { ratio: {}, secondary: {} },
      };
    }
    return rollingRow({
      season: 20262027,
      season_games_played: 15,
      // Cross-season wide columns (the default view must not read them).
      goals_per_60_last20: 1.6,
      points_total_last20: 14,
      toi_seconds_total_last20: 18000,
      windowCountSupport: support,
    });
  }

  it("defaults last-N to the current season with the actual n (decision 103)", () => {
    const aggregates = buildSkaterWindowAggregatesFromRollingRow(crossingRow(), {
      windows: ["last20"],
      metricKeys: ["goals_per_60", "points_per_60", "goals_above_expected"],
    });
    const byKey = new Map(aggregates.map((aggregate) => [aggregate.metricKey, aggregate]));
    // 6 goals over 13,500 s = 1.6/60 happens to match; GP and counts differ.
    expect(byKey.get("goals_per_60")).toMatchObject({
      numerator: 6, denominator: 13500, gamesPlayed: 15, toiSeconds: 13500,
    });
    // Points = goals + assists on the current-season games (9), not the
    // cross-season total (14).
    expect(byKey.get("points_per_60")).toMatchObject({ numerator: 9, denominator: 13500, rawValue: 2.4 });
    expect(byKey.get("goals_above_expected")?.rawValue).toBe(2);
    expect(byKey.get("goals_per_60")?.windowMembership).toMatchObject({
      scope: "current_season", requested: 20, appearances: 15, crossesSeasons: false,
    });

    const [crossGoals] = buildSkaterWindowAggregatesFromRollingRow(crossingRow(), {
      windows: ["last20"], metricKeys: ["goals_per_60"], windowScope: "cross_season",
    });
    expect(crossGoals).toMatchObject({ numerator: 8, gamesPlayed: 20 });
    expect(crossGoals.windowMembership).toMatchObject({
      scope: "cross_season", appearances: 20, currentSeasonAppearances: 15, crossesSeasons: true,
    });

    // Rows written before the current-season block: unknown, never the
    // cross-season value.
    const [unknown] = buildSkaterWindowAggregatesFromRollingRow(crossingRow(false), {
      windows: ["last20"], metricKeys: ["goals_per_60"],
    });
    expect(unknown).toMatchObject({ rawValue: null, numerator: null, gamesPlayed: null });
  });

  it("serves season xS% and SAX% from the L6 season iFF pair on the same games (D5)", () => {
    const row = rollingRow({ season_games_played: 30 });
    row.windowCountSupport!.currentSeason = {
      version: ROLLING_WINDOW_COUNT_CURRENT_SEASON_VERSION,
      season: 20252026,
      selection: "chronological_appearances_in_strength_state_current_season",
      windows: row.windowCountSupport!.windows as never,
      seasonTotals: {
        ratio: { expected_sh_pct: [7.5, 60, 30], goals_per_60: [9, 27000, 30] },
        secondary: {},
      },
    };
    const aggregates = buildSkaterWindowAggregatesFromRollingRow(row, {
      windows: ["season"],
      metricKeys: ["expected_shooting_percentage", "sax_percentage"],
    });
    const byKey = new Map(aggregates.map((aggregate) => [aggregate.metricKey, aggregate]));
    expect(byKey.get("expected_shooting_percentage")).toMatchObject({
      rawValue: 12.5, numerator: 7.5, denominator: 60,
    });
    // (9 − 7.5) ÷ 60 × 100.
    expect(byKey.get("sax_percentage")).toMatchObject({ rawValue: 2.5, numerator: 1.5, denominator: 60 });

    // A covered subset (29 of 30 games for the iFF pair) is unknown.
    row.windowCountSupport!.currentSeason!.seasonTotals.ratio.expected_sh_pct = [7.5, 60, 29];
    const [sax] = buildSkaterWindowAggregatesFromRollingRow(row, {
      windows: ["season"], metricKeys: ["sax_percentage"],
    });
    expect(sax.rawValue).toBeNull();
  });

  it("documents the existing refresh surfaces instead of adding a redundant rebuild path", () => {
    expect(SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES).toEqual({
      endpoint: "/api/v1/db/update-rolling-player-averages",
      truncateRpc: "truncate_rolling_player_game_metrics",
      sourceTable: "rolling_player_game_metrics",
    });
  });
});

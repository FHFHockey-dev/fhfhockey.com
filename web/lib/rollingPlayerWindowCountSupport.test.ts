import { describe, expect, it } from "vitest";

import {
  buildRollingWindowCountSupport,
  poolCalendarWindow,
  readWindowCountSupportGame,
  type RollingWindowCountSupport
} from "./rollingPlayerWindowCountSupport";

type Game = RollingWindowCountSupport["game"];

const game = (goals: number | null, toiSeconds: number, appeared = true): Game => ({
  appeared,
  ratio: {
    goals_per_60: goals == null ? null : [goals, toiSeconds, 0, 0]
  },
  additive: { goals, toi_seconds: toiSeconds }
});

describe("poolCalendarWindow (decision 18, P0 #11)", () => {
  // Today 2026-11-11; L7 = 2026-11-05 … 2026-11-11 inclusive.
  const rows = [
    { gameDate: "2026-11-03", game: game(3, 1200) },
    { gameDate: "2026-11-06", game: game(1, 1000) },
    // 11-07 and 11-09 are gap days with no game.
    { gameDate: "2026-11-08", game: game(0, 1100) },
    { gameDate: "2026-11-10", game: game(2, 1300) }
  ];

  it("pools counts and TOI over calendar days ending today", () => {
    const result = poolCalendarWindow(rows, "goals_per_60", {
      todayIso: "2026-11-11",
      days: 7
    });
    // (1 + 0 + 2) × 3600 ÷ (1000 + 1100 + 1300), not a mean of game rates.
    expect(result.value).toBeCloseTo((3 * 3600) / 3400, 6);
    expect(result).toMatchObject({ games: 3, observations: 3, unsupportedRows: 0 });

    const goals = poolCalendarWindow(rows, "goals", { todayIso: "2026-11-11", days: 7 });
    expect(goals.value).toBe(1);
  });

  it("ends at today, not at the player's last game", () => {
    // An idle player: last game 11-03, so L7 ending 11-11 has no games.
    const idle = poolCalendarWindow(rows.slice(0, 1), "goals_per_60", {
      todayIso: "2026-11-11",
      days: 7
    });
    expect(idle).toMatchObject({ value: null, games: 0 });
  });

  it("reports a covered subset when a game's components are unknown", () => {
    const withUnknown = [...rows, { gameDate: "2026-11-11", game: game(null, 900) }];
    const result = poolCalendarWindow(withUnknown, "goals_per_60", {
      todayIso: "2026-11-11",
      days: 7
    });
    expect(result).toMatchObject({ games: 4, observations: 3 });
    expect(result.value).toBeCloseTo((3 * 3600) / 3400, 6);
  });

  it("counts rows without stored window counts as unsupported", () => {
    const result = poolCalendarWindow(
      [{ gameDate: "2026-11-10", game: null }],
      "goals_per_60",
      { todayIso: "2026-11-11", days: 7 }
    );
    expect(result).toMatchObject({ value: null, games: 0, unsupportedRows: 1 });
  });
});

describe("buildRollingWindowCountSupport", () => {
  it("records appearance membership and paired counts per window", () => {
    const support = buildRollingWindowCountSupport({
      strengthState: "all",
      anchor: { gameId: 3, gameDate: "2026-11-10", season: 20262027 },
      appeared: true,
      gameRatio: { goals_per_60: [1, 1000, 0, 0] },
      gameAdditive: { goals: 1 },
      appearances: Array.from({ length: 7 }, (_, index) => ({
        gameId: index + 1,
        gameDate: `2026-11-0${index + 1}`
      })),
      windowComponents: {
        goals_per_60: {
          5: { numerator: 4, denominator: 5100, secondaryNumerator: 0, secondaryDenominator: 0, count: 5 },
          10: { numerator: 6, denominator: 7000, secondaryNumerator: 0, secondaryDenominator: 0, count: 7 },
          20: { numerator: 6, denominator: 7000, secondaryNumerator: 0, secondaryDenominator: 0, count: 7 }
        }
      }
    });

    expect(support.windows.last5.gameIds).toEqual([3, 4, 5, 6, 7]);
    expect(support.windows.last5.ratio.goals_per_60).toEqual([4, 5100, 5]);
    expect(support.windows.last10.appearances).toBe(7);
    expect(readWindowCountSupportGame(support)).toEqual(support.game);
    expect(readWindowCountSupportGame({ version: "other", game: support.game })).toBeNull();
  });
});

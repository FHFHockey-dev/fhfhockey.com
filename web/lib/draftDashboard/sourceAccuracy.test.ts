import { describe, expect, it } from "vitest";

import { calculateSourceAccuracy } from "./sourceAccuracy";

type SourceValues = Record<string, number>;

/** One player; each stat lists the value each source supplied and the actual. */
function player(
  playerId: number,
  games: { actual: number | null; bySource: SourceValues },
  stats: Record<string, { actual: number | null; bySource: SourceValues; dataType?: string }>
) {
  const stat = (key: string, actual: number | null, bySource: SourceValues, dataType = "numeric") => ({
    projected: null,
    actual,
    diffPercentage: null,
    projectedDetail: {
      value: null,
      contributingSources: Object.entries(bySource).map(([name, value]) => ({ name, weight: 1, value })),
      missingFromSelectedSources: [],
      statDefinition: { key, dataType }
    }
  });
  return {
    playerId,
    fullName: `Player ${playerId}`,
    displayTeam: "TST",
    displayPosition: "C",
    fantasyPoints: {} as any,
    combinedStats: {
      GAMES_PLAYED: stat("GAMES_PLAYED", games.actual, games.bySource),
      ...Object.fromEntries(
        Object.entries(stats).map(([key, s]) => [key, stat(key, s.actual, s.bySource, s.dataType)])
      )
    }
  } as any;
}

const row = (rows: ReturnType<typeof calculateSourceAccuracy>, statKey: string, sourceName: string) =>
  rows.find((r) => r.statKey === statKey && r.sourceName === sourceName);

describe("source accuracy repair (W2-5 D1, §1.2)", () => {
  it("scores an exactly right per-game source as perfect at 15 of 84 games", () => {
    const players = [
      player(1, { actual: 15, bySource: { A: 84 } }, { GOALS: { actual: 7.5, bySource: { A: 42 } } })
    ];
    for (const mode of ["perGame", "proratedTotal"] as const) {
      expect(row(calculateSourceAccuracy(players, mode), "GOALS", "A")).toMatchObject({
        comparedPlayers: 1,
        meanSquaredError: 0,
        rank: 1
      });
    }
  });

  it("uses squared error, so a zero actual is an exact finite loss, not a 10,000% error", () => {
    const players = [
      player(1, { actual: 82, bySource: { A: 82 } }, { SH_GOALS: { actual: 0, bySource: { A: 1 } } })
    ];
    expect(row(calculateSourceAccuracy(players, "proratedTotal"), "SH_GOALS", "A")?.meanSquaredError).toBe(1);
    expect(row(calculateSourceAccuracy(players, "perGame"), "SH_GOALS", "A")?.meanSquaredError).toBeCloseTo((1 / 82) ** 2, 12);
  });

  it("compares sources on common support, so omitting the hard stat does not win", () => {
    // Astra §1.2: A supplies goals 10 and assists 20; B supplies only goals 11; actuals 10 and 10.
    const players = [
      player(
        1,
        { actual: 82, bySource: { A: 82, B: 82 } },
        {
          GOALS: { actual: 10, bySource: { A: 10, B: 11 } },
          ASSISTS: { actual: 10, bySource: { A: 20 } }
        }
      )
    ];
    const rows = calculateSourceAccuracy(players, "proratedTotal");
    expect(row(rows, "GOALS", "A")).toMatchObject({ rank: 1, meanSquaredError: 0, comparedPlayers: 1 });
    expect(row(rows, "GOALS", "B")).toMatchObject({ rank: 2, meanSquaredError: 1, comparedPlayers: 1 });
    expect(row(rows, "ASSISTS", "A")).toMatchObject({ rank: 1, meanSquaredError: 100, unmatchedPlayers: 0 });
    // B did not project assists: reported as unmatched, never as a better score.
    expect(row(rows, "ASSISTS", "B")).toMatchObject({ comparedPlayers: 0, unmatchedPlayers: 1, meanSquaredError: null, rank: null });
    expect(rows.some((r) => "accuracyScorePercent" in r)).toBe(false);
  });

  it("restricts every source to the players all of them projected, and counts the rest as unmatched", () => {
    const players = [
      player(1, { actual: 10, bySource: { A: 10, B: 10 } }, { GOALS: { actual: 5, bySource: { A: 5, B: 7 } } }),
      // Only A projects player 2; A missing badly here must not penalise A against B.
      player(2, { actual: 10, bySource: { A: 10 } }, { GOALS: { actual: 0, bySource: { A: 9 } } })
    ];
    const rows = calculateSourceAccuracy(players, "proratedTotal");
    expect(row(rows, "GOALS", "A")).toMatchObject({ comparedPlayers: 1, universePlayers: 2, unmatchedPlayers: 0, meanSquaredError: 0, rank: 1 });
    expect(row(rows, "GOALS", "B")).toMatchObject({ comparedPlayers: 1, universePlayers: 2, unmatchedPlayers: 1, meanSquaredError: 4, rank: 2 });
  });

  it("gives tied sources the same rank and compares rate stats directly", () => {
    const players = [
      player(1, { actual: 30, bySource: { A: 60, B: 50 } }, {
        SAVE_PERCENTAGE: { actual: 0.875, bySource: { A: 0.75, B: 1 }, dataType: "percentage" }
      })
    ];
    const rows = calculateSourceAccuracy(players, "perGame");
    expect(row(rows, "SAVE_PERCENTAGE", "A")?.rank).toBe(1);
    expect(row(rows, "SAVE_PERCENTAGE", "B")?.rank).toBe(1);
    expect(row(rows, "SAVE_PERCENTAGE", "A")?.meanSquaredError).toBe(0.015625);
  });

  it("skips counting stats without known games, instead of comparing them as totals", () => {
    const players = [
      player(1, { actual: null, bySource: { A: 82 } }, { GOALS: { actual: 7, bySource: { A: 41 } } })
    ];
    expect(row(calculateSourceAccuracy(players, "proratedTotal"), "GOALS", "A")).toMatchObject({
      comparedPlayers: 0,
      universePlayers: 0,
      meanSquaredError: null
    });
  });
});

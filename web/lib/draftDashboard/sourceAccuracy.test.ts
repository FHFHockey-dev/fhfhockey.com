import { describe, expect, it } from "vitest";

import { calculateSourceAccuracy } from "./sourceAccuracy";

function player(actualGames: number, projectedGames: number) {
  const statDefinition = { key: "GOALS", dataType: "number" } as any;
  return {
    playerId: 1,
    fullName: "Player",
    displayTeam: "TST",
    displayPosition: "C",
    fantasyPoints: {} as any,
    combinedStats: {
      GAMES_PLAYED: {
        projected: projectedGames,
        actual: actualGames,
        diffPercentage: null,
        projectedDetail: {
          value: projectedGames,
          contributingSources: [
            { name: "Source A", weight: 1, value: projectedGames }
          ],
          missingFromSelectedSources: [],
          statDefinition: { key: "GAMES_PLAYED", dataType: "number" }
        }
      },
      GOALS: {
        projected: 20,
        actual: 10,
        diffPercentage: null,
        projectedDetail: {
          value: 20,
          contributingSources: [
            { name: "Source A", weight: 1, value: 20 },
            { name: "Source B", weight: 1, value: 15 }
          ],
          missingFromSelectedSources: [],
          statDefinition
        }
      },
      ASSISTS: {
        projected: 30,
        actual: null,
        diffPercentage: null,
        projectedDetail: {
          value: 30,
          contributingSources: [
            { name: "Source A", weight: 1, value: 30 }
          ],
          missingFromSelectedSources: [],
          statDefinition: { key: "ASSISTS", dataType: "number" }
        }
      }
    }
  } as any;
}

describe("source accuracy analysis", () => {
  it("reports comparison coverage independently from accuracy", () => {
    const rows = calculateSourceAccuracy([player(50, 100)], "total");
    expect(rows.find((row) => row.sourceName === "Source A")).toMatchObject({
      projectionObservations: 2,
      matchedActualObservations: 1,
      coveragePercent: 50,
      meanNormalizedErrorPercent: 100,
      accuracyScorePercent: 0
    });
    expect(rows.find((row) => row.sourceName === "Source B")).toMatchObject({
      projectionObservations: 1,
      matchedActualObservations: 1,
      coveragePercent: 100,
      meanNormalizedErrorPercent: 50,
      accuracyScorePercent: 50
    });
  });

  it("uses each source's projected GP and actual GP in per-game mode", () => {
    const total = calculateSourceAccuracy([player(50, 100)], "total");
    const perGame = calculateSourceAccuracy([player(50, 100)], "perGame");
    expect(total.find((row) => row.sourceName === "Source A")?.accuracyScorePercent).toBe(0);
    expect(perGame.find((row) => row.sourceName === "Source A")?.accuracyScorePercent).toBe(100);
    expect(perGame.find((row) => row.sourceName === "Source B")?.matchedActualObservations).toBe(0);
  });
});

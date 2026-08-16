import { describe, expect, it } from "vitest";

import {
  FANTASY_PROJECTION_SCORING_V1_KEY,
  FANTASY_PROJECTION_SCORING_V2_KEY,
  readFantasyProjectionScoringSettings,
  saveFantasyProjectionScoringSettings,
} from "./scoringSettings";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("Fantasy Projections scoring storage", () => {
  it("migrates a legacy combined map without losing shared or role-only values", () => {
    const storage = memoryStorage({
      [FANTASY_PROJECTION_SCORING_V1_KEY]: JSON.stringify({
        version: 1,
        scoring: {
          GAMES_PLAYED: 0.5,
          GOALS: 5,
          WINS_GOALIE: 6,
        },
      }),
    });

    const result = readFantasyProjectionScoringSettings(storage);

    expect(result.source).toBe("v1");
    expect(result.settings.skaterPoints).toMatchObject({
      GAMES_PLAYED: 0.5,
      GOALS: 5,
    });
    expect(result.settings.goaliePoints).toMatchObject({
      GAMES_PLAYED: 0.5,
      WINS_GOALIE: 6,
    });
    expect(result.settings.skaterPoints.WINS_GOALIE).toBeUndefined();
    expect(result.settings.goaliePoints.GOALS).toBeUndefined();
    expect(storage.values.has(FANTASY_PROJECTION_SCORING_V1_KEY)).toBe(false);
    expect(storage.values.has(FANTASY_PROJECTION_SCORING_V2_KEY)).toBe(true);
  });

  it("round-trips the versioned points/category shape", () => {
    const storage = memoryStorage();
    saveFantasyProjectionScoringSettings(storage, {
      version: 2,
      leagueType: "categories",
      skaterPoints: { GOALS: 7 },
      goaliePoints: { WINS_GOALIE: 8 },
      categoryWeights: { GOALS: 2, WINS_GOALIE: 3 },
    });

    const result = readFantasyProjectionScoringSettings(storage);

    expect(result.source).toBe("v2");
    expect(result.settings).toMatchObject({
      version: 2,
      leagueType: "categories",
      skaterPoints: { GOALS: 7 },
      goaliePoints: { WINS_GOALIE: 8 },
      categoryWeights: { GOALS: 2, WINS_GOALIE: 3 },
    });
    expect(result.settings.skaterPoints).toEqual({ GOALS: 7 });
    expect(result.settings.goaliePoints).toEqual({ WINS_GOALIE: 8 });
  });

  it("falls back safely when browser storage contains malformed JSON", () => {
    const result = readFantasyProjectionScoringSettings(
      memoryStorage({ [FANTASY_PROJECTION_SCORING_V2_KEY]: "{" }),
    );

    expect(result.source).toBe("default");
    expect(result.settings.skaterPoints.GOALS).toBe(3);
    expect(result.settings.goaliePoints.WINS_GOALIE).toBe(4);
  });
});

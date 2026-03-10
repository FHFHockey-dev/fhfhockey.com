import { describe, expect, it } from "vitest";
import {
  getAssistsValue,
  getBlocksValue,
  getGoalsValue,
  getHitsValue,
  getIxgValue,
  getPointsValue,
  getPpPointsValue,
  getShotsValue,
  type AdditiveMetricSourceGame
} from "./rollingPlayerSourceSelection";

function createGame(
  overrides: Partial<AdditiveMetricSourceGame> = {}
): AdditiveMetricSourceGame {
  return {
    strength: "all",
    counts: {},
    wgo: {},
    ...overrides
  };
}

describe("rollingPlayerSourceSelection", () => {
  it("prefers NST counts over WGO for healthy additive families", () => {
    const game = createGame({
      counts: {
        total_points: 5,
        shots: 6,
        goals: 2,
        total_assists: 3,
        hits: 4,
        shots_blocked: 7,
        ixg: 1.8
      },
      wgo: {
        points: 50,
        shots: 60,
        goals: 20,
        assists: 30,
        hits: 40,
        blocked_shots: 70,
        ixg: 9.9
      }
    });

    expect(getPointsValue(game)).toBe(5);
    expect(getShotsValue(game)).toBe(6);
    expect(getGoalsValue(game)).toBe(2);
    expect(getAssistsValue(game)).toBe(3);
    expect(getHitsValue(game)).toBe(4);
    expect(getBlocksValue(game)).toBe(7);
    expect(getIxgValue(game)).toBe(1.8);
  });

  it("falls back to WGO for all-strength additive families when counts are missing", () => {
    const game = createGame({
      strength: "all",
      counts: {},
      wgo: {
        points: 2,
        shots: 3,
        goals: 1,
        assists: 1,
        hits: 4,
        blocked_shots: 5,
        ixg: 0.7,
        pp_points: 2
      }
    });

    expect(getPointsValue(game)).toBe(2);
    expect(getShotsValue(game)).toBe(3);
    expect(getGoalsValue(game)).toBe(1);
    expect(getAssistsValue(game)).toBe(1);
    expect(getHitsValue(game)).toBe(4);
    expect(getBlocksValue(game)).toBe(5);
    expect(getIxgValue(game)).toBe(0.7);
    expect(getPpPointsValue(game)).toBe(2);
  });

  it("does not use WGO fallback for split-strength additive families that require NST counts", () => {
    const game = createGame({
      strength: "ev",
      counts: {},
      wgo: {
        points: 2,
        shots: 3,
        goals: 1,
        assists: 1,
        hits: 4,
        blocked_shots: 5,
        ixg: 0.7
      }
    });

    expect(getPointsValue(game)).toBe(null);
    expect(getShotsValue(game)).toBe(null);
    expect(getGoalsValue(game)).toBe(null);
    expect(getAssistsValue(game)).toBe(null);
    expect(getHitsValue(game)).toBe(null);
    expect(getBlocksValue(game)).toBe(null);
    expect(getIxgValue(game)).toBe(null);
  });

  it("uses PP counts on pp rows but WGO pp_points on all-strength rows", () => {
    const ppGame = createGame({
      strength: "pp",
      counts: { total_points: 4 },
      wgo: { pp_points: 9 }
    });
    const allGame = createGame({
      strength: "all",
      counts: { total_points: 4 },
      wgo: { pp_points: 2 }
    });

    expect(getPpPointsValue(ppGame)).toBe(4);
    expect(getPpPointsValue(allGame)).toBe(2);
  });
});

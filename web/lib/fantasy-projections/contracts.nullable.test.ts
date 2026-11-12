import { describe, expect, it } from "vitest";

import {
  FANTASY_PROJECTION_SUMMARY_ENCODING,
  FANTASY_PROJECTION_SUMMARY_ENCODING_V2,
  expandFantasyProjectionSummaryNullable,
  fantasyProjectionTotal,
  fantasyProjectionTotalNullable,
  nullableProjectionNumber,
  type FantasyProjectionCompactPlayersResponseV2,
  type FantasyProjectionRelease,
} from "./contracts";

const release = { id: "release-1" } as FantasyProjectionRelease;

function tuple(values: Array<number | null>) {
  return [
    10, 1, "ANA", "Skater", "C", "forward", "verified_active", "active_nhl",
    1, null, 0, 50, 0.4, [1, null, null, null, null], 0, [], values,
  ] as FantasyProjectionCompactPlayersResponseV2["players"][number];
}

describe("nullable projection contract (W3-5 F6 / PR3)", () => {
  it("does not score an unknown weighted value as zero (TAKEAWAYS)", () => {
    const scoring = { GOALS: 3, TAKEAWAYS: 1 };
    const values = { GOALS: 2, TAKEAWAYS: null };
    // The legacy reader silently counts TAKEAWAYS as 0: total 6.
    expect(
      fantasyProjectionTotal(values as unknown as Record<string, number>, scoring),
    ).toBe(6);
    expect(fantasyProjectionTotalNullable(values, scoring)).toEqual({
      value: null,
      complete: false,
      missingKeys: ["TAKEAWAYS"],
      invalidWeightKeys: [],
    });
    expect(fantasyProjectionTotalNullable({ GOALS: 2 }, scoring).missingKeys).toEqual([
      "TAKEAWAYS",
    ]);
  });

  it("ignores absence of a zero-weighted key and keeps a real zero", () => {
    expect(
      fantasyProjectionTotalNullable({ GOALS: 2, TAKEAWAYS: 0 }, { GOALS: 3, TAKEAWAYS: 1, HITS: 0 }),
    ).toEqual({ value: 6, complete: true, missingKeys: [], invalidWeightKeys: [] });
  });

  it("treats non-finite values and weights as unknown", () => {
    expect(nullableProjectionNumber(Number.NaN)).toBeNull();
    expect(nullableProjectionNumber("")).toBeNull();
    expect(nullableProjectionNumber("1.5")).toBe(1.5);
    const result = fantasyProjectionTotalNullable(
      { GOALS: Number.POSITIVE_INFINITY, HITS: 1 },
      { GOALS: 1, HITS: Number.NaN },
    );
    expect(result).toMatchObject({
      value: null,
      missingKeys: ["GOALS"],
      invalidWeightKeys: ["HITS"],
    });
  });

  it("round-trips null and absent compact values as null (v2 and v1)", () => {
    const metricKeys = ["GAMES_PLAYED", "TAKEAWAYS", "GOALS", "PP_TOI"];
    const v2 = expandFantasyProjectionSummaryNullable({
      success: true,
      betaLabel: "beta",
      release,
      encoding: FANTASY_PROJECTION_SUMMARY_ENCODING_V2,
      metricKeys,
      players: [tuple([70, null, 0])],
    });
    expect(v2.players[0].publishedValues).toEqual({
      GAMES_PLAYED: 70,
      TAKEAWAYS: null,
      GOALS: 0,
      PP_TOI: null,
    });
    expect(v2.players[0].expectedToi.powerPlay).toBeNull();
    expect(v2.players[0].expectedGames).toBe(70);
    const v1 = expandFantasyProjectionSummaryNullable({
      success: true,
      betaLabel: "beta",
      release,
      encoding: FANTASY_PROJECTION_SUMMARY_ENCODING,
      metricKeys,
      players: [tuple([70, null as unknown as number, 0]) as never],
    });
    expect(v1.players[0].publishedValues.TAKEAWAYS).toBeNull();
    expect(
      fantasyProjectionTotalNullable(v1.players[0].publishedValues, { TAKEAWAYS: 1 }).value,
    ).toBeNull();
  });
});

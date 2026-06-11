import { describe, expect, it } from "vitest";

import {
  ContextualRankingsQueryError,
  parseContextualRankingsRequest,
} from "./rankingTypes";

describe("rankingTypes", () => {
  it("parses required season and safe defaults", () => {
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
      }),
    ).toMatchObject({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "season",
      position: "all",
      deployment: "all",
      strength: "all",
      metric: "goals_per_60",
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: 100,
      entityIds: null,
    });
  });

  it("parses fixed-list entity ids for comparison requests", () => {
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
        entity_ids: "8478402, 8478483,8478402",
      }).entityIds,
    ).toEqual([8478402, 8478483]);

    expect(() =>
      parseContextualRankingsRequest({
        season: "20252026",
        entity_ids: "0",
      }),
    ).toThrow(/entity_ids/);
  });

  it("derives peer groups from team, deployment, and position filters", () => {
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
        team: "10",
      }).peerGroupType,
    ).toBe("team");
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
        deployment: "L2",
      }).peerGroupType,
    ).toBe("deployment");
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
        position: "D",
      }).peerGroupType,
    ).toBe("position");
  });

  it("throws clear 400 errors for invalid params", () => {
    expect(() => parseContextualRankingsRequest({})).toThrow(
      ContextualRankingsQueryError,
    );
    expect(() =>
      parseContextualRankingsRequest({
        season: "20252026",
        metric: "not_a_metric",
      }),
    ).toThrow(/metric/);
  });

  it("accepts true 5v5 strength after the verified 5v5 source rollout", () => {
    expect(
      parseContextualRankingsRequest({
        season: "20252026",
        strength: "5v5",
      }).strength,
    ).toBe("5v5");
  });

  it("caps limit to the validated top-100 API contract", () => {
    expect(() =>
      parseContextualRankingsRequest({
        season: "20252026",
        limit: "101",
      }),
    ).toThrow(/limit/);
  });
});

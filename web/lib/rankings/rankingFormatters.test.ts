import { describe, expect, it } from "vitest";

import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "./rankingTypes";
import {
  buildRankingExplanationItems,
  formatDeploymentLabel,
  formatPercentile,
  formatSampleConfidence,
  formatSampleMinimums,
  formatToiClock,
} from "./rankingFormatters";

const baseRow: ContextualRankingApiRow = {
  entity: {
    id: 1,
    name: "Test Skater",
    position: "C",
    positionGroup: "forward",
    imageUrl: null,
  },
  team: {
    id: 10,
    abbreviation: "TST",
    name: "Test Team",
  },
  deployment: {
    ev: "L3",
    pp: "PP2",
    pk: null,
    confidence: "medium",
  },
  sample: {
    gamesPlayed: 8,
    toiSeconds: 4800,
    toiPerGameSeconds: 600,
    confidence: "medium",
    minimumSampleMet: true,
  },
  metric: {
    key: "goals_per_60",
    value: 1.23,
    formattedValue: "1.23",
    rawRank: 4,
    percentile: 81.25,
    qualifiedPeerCount: 24,
  },
  peerGroup: {
    type: "deployment",
    key: "L3",
  },
  tags: ["L3", "PP2"],
  warnings: [],
  explanationItems: ["Rank 4 of 24 in deployment:L3."],
};

const baseRequest: ContextualRankingsRequest = {
  entity: "skaters",
  season: 20252026,
  asOfDate: null,
  window: "last10",
  position: "F",
  deployment: "L3",
  strength: "ev",
  metric: "goals_per_60",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "deployment",
  sort: "percentile",
  direction: "desc",
  limit: 100,
  entityIds: null,
};

describe("rankingFormatters", () => {
  it("formats TOI, percentiles, sample confidence, and deployment labels", () => {
    expect(formatToiClock(754)).toBe("12:34");
    expect(formatToiClock(null)).toBe("-");
    expect(formatPercentile(81.25)).toBe("81.3%");
    expect(formatPercentile(null)).toBe("-");
    expect(formatSampleConfidence("medium")).toBe("Meets selected minimums");
    expect(formatDeploymentLabel(baseRow.deployment)).toBe("L3 / PP2");
  });

  it.each([
    { gp: 1, toi: 600, met: true, label: "Meets selected minimums" },
    { gp: 1, toi: 599, met: false, label: "Below selected minimums" },
    { gp: null, toi: 600, met: true, label: "Sample unavailable" },
    { gp: 1, toi: null, met: true, label: "Sample unavailable" },
    { gp: NaN, toi: 600, met: true, label: "Sample unavailable" },
    { gp: 1, toi: Infinity, met: true, label: "Sample unavailable" },
  ])("formats sample minimum status without a reliability claim: %j", ({ gp, toi, met, label }) => {
    expect(formatSampleMinimums({ gamesPlayed: gp, toiSeconds: toi, minimumSampleMet: met })).toBe(label);
  });

  it("explains metric sample tiers through their minimum-relative contract", () => {
    expect(formatSampleConfidence("high")).toBe("At least twice selected minimums");
    expect(formatSampleConfidence("medium")).toBe("Meets selected minimums");
    expect(formatSampleConfidence("low")).toBe("Below selected minimums or sample unavailable");
    expect(formatSampleConfidence(undefined)).toBe("Sample unavailable");
  });

  it("builds explanation text from response fields and request context", () => {
    const items = buildRankingExplanationItems({
      row: {
        ...baseRow,
        warnings: ["small_peer_group"],
        sample: {
          ...baseRow.sample,
          confidence: "low",
          minimumSampleMet: false,
        },
      },
      request: baseRequest,
    });

    expect(items).toContain("Window: last 10 player games at EV strength.");
    expect(items).toContain("Peer group: deployment:L3.");
    expect(items).toContain(
      "Raw rank 4 of 24; better than 81.3% of other qualified peers.",
    );
    expect(items).toContain(
      "Sample caveat: minimum GP or TOI was not met before ranking.",
    );
    expect(items).toContain(
      "Peer caveat: this peer group is small, so percentile movement can be noisy.",
    );
  });
});

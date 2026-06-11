import { describe, expect, it } from "vitest";

import { buildContextualRankingsMetadataSurface } from "./rankingMetadata";

describe("rankingMetadata", () => {
  it("exposes team-style and adjusted-defense roadmap limitations", () => {
    const payload = buildContextualRankingsMetadataSurface();

    expect(payload.glossary.map((entry) => entry.key)).toContain(
      "raw_contextual_team_style",
    );
    expect(payload.glossary.map((entry) => entry.key)).toContain(
      "contextual_defensive_impact",
    );
    expect(payload.teamStyle.currentLabel).toBe("raw_contextual_5v5");
    expect(payload.teamStyle.adjustedTargetLabel).toContain(
      "Score- and venue-adjusted",
    );
    expect(
      payload.defensiveComposites.adjustedModelRoadmap.validationCriteria,
    ).toContain("held-out error improvement over raw on-ice xGA/xGF baselines");
    expect(
      payload.defensiveComposites.adjustedImpactPromotion.readiness.status,
    ).toBe("blocked_missing_controls");
    expect(
      payload.defensiveComposites.adjustedImpactPromotion.controls,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "defense_specific_target",
          status: "missing",
        }),
      ]),
    );
  });

  it("exposes verified live goalie and team source contracts with caveats", () => {
    const payload = buildContextualRankingsMetadataSurface();

    expect(payload.glossary.map((entry) => entry.key)).toContain(
      "goalie_rankings_source_contract",
    );
    expect(payload.glossary.map((entry) => entry.key)).toContain(
      "team_rankings_source_contract",
    );

    const goalie = payload.entityCoverage.find(
      (contract) => contract.entity === "goalie",
    );
    expect(goalie?.status).toBe("live");
    expect(goalie?.currentUiState).toBe("live");
    expect(goalie?.verifiedSources.map((source) => source.name)).toContain(
      "goalie_stats_unified",
    );
    expect(goalie?.liveRankingGates.join(" ")).toContain(
      "goalie latest-snapshot reader",
    );

    const team = payload.entityCoverage.find(
      (contract) => contract.entity === "team",
    );
    expect(team?.status).toBe("live");
    expect(team?.currentUiState).toBe("live");
    expect(team?.verifiedSources.map((source) => source.name)).toContain(
      "team_power_ratings_daily",
    );
    expect(team?.caveats.join(" ")).toContain(
      "team_underlying_stats_summary currently lags",
    );
  });
});

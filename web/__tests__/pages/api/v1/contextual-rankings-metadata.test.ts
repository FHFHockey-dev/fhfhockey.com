import { describe, expect, it } from "vitest";

import handler from "../../../../pages/api/v1/contextual-rankings/metadata";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/contextual-rankings/metadata", () => {
  it("returns 405 for unsupported methods", () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
  });

  it("publishes filters, metric methodology, glossary, and comparison metadata", () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.filters.entities).toEqual(["skaters", "goalies", "teams"]);
    expect(res.body.filters.strengths).toContain("5v5");
    expect(res.body.filters.windows).toContain("last10");
    expect(res.body.availableFilters).toMatchObject({
      success: true,
      version: "contextual_rankings_available_filters_v1",
    });
    expect(res.body.availableFilters.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "goalies", status: "available" }),
        expect.objectContaining({ value: "teams", status: "available" }),
      ]),
    );
    expect(res.body.comparison).toMatchObject({
      endpoint: "/api/v1/contextual-rankings/comparison",
      version: "contextual_ranking_comparison_v1",
      status: "available",
      supportedEntities: ["skaters", "goalies", "teams"],
      maxSubjects: 6,
      subjectParams: {
        skaters: ["player_ids", "entity_ids"],
        goalies: ["goalie_ids", "entity_ids"],
        teams: ["teams", "team_abbreviations"],
      },
      legacyListComparison: {
        endpoint: "/api/v1/contextual-rankings",
        entityIdsParam: "entity_ids",
        maxEntityIds: 25,
        supportedEntities: ["skaters"],
      },
    });
    expect(res.body.snapshot).toMatchObject({
      endpoint: "/api/v1/contextual-rankings/snapshot",
      supportedEntities: ["skaters", "goalies", "teams"],
      status: "available",
    });
    expect(res.body.defensiveComposites).toMatchObject({
      labels: {
        overall: "Defensive Impact in Context",
        deployment: "Deployment Defensive Impact in Context",
      },
      sourceQualityFlags: ["context_influenced_unadjusted_on_ice"],
    });
    expect(res.body.defensiveComposites.adjustedImpactPromotion).toMatchObject({
      currentStatus: "diagnostic_live",
      currentTargetFamily: "on_ice_xg_differential_v1",
      readiness: {
        status: "blocked_missing_controls",
        missingControlCount: 1,
        unjoinedControlCount: 2,
      },
    });
    expect(res.body.defensiveComposites.adjustedImpactPromotion.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "rest_days", status: "available_not_joined" }),
        expect.objectContaining({ key: "zone_starts", status: "available_not_joined" }),
        expect.objectContaining({ key: "defense_specific_target", status: "missing" }),
      ])
    );
    expect(res.body.glossary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "better_than_percentile" }),
        expect.objectContaining({ key: "source_quality_flags" }),
        expect.objectContaining({ key: "wins_above_replacement_source_pending" }),
        expect.objectContaining({ key: "comparison_payload_contract" }),
      ]),
    );
    expect(res.body.war).toMatchObject({
      status: "source_pending",
      methodology: {
        key: "wins_above_replacement",
        sourceStatus: "source_pending",
        formula: null,
      },
      meta: {
        rowCount: 0,
      },
    });
    expect(res.body.war.rows).toEqual([]);
    expect(res.body.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "shot_attempts_per_60",
          denominatorKey: "toi_seconds",
          methodologyVersion: "contextual_rankings_v1",
          methodologyUpdatedAt: "2026-06-09",
        }),
        expect.objectContaining({
          key: "mcm_score",
          sourceQualityFlags: expect.arrayContaining([
            "rink_scorekeeper_sensitive_unadjusted",
          ]),
        }),
      ]),
    );
    expect(
      res.body.metrics.map((metric: { key: string }) => metric.key),
    ).not.toContain("adjusted_xg_impact");
    expect(
      res.body.metrics.map((metric: { key: string }) => metric.key),
    ).not.toContain("adjusted_defensive_impact");
  });
});

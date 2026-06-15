import { describe, expect, it } from "vitest";

import handler from "../../../../pages/api/v1/contextual-rankings/available-filters";

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

describe("/api/v1/contextual-rankings/available-filters", () => {
  it("returns 405 for unsupported methods", () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
  });

  it("publishes entity-aware filter availability without inventing unsupported data", () => {
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      version: "contextual_rankings_available_filters_v1",
      defaults: {
        entity: "skaters",
        tab: "rankings",
        strength: "5v5",
        skaterMetric: "points_per_60",
        goalieMetric: "save_percentage",
        teamMetric: "off_rating",
      },
    });
    expect(res.body.shared.windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "last10", label: "Last 10 GP" }),
      ]),
    );
    expect(res.body.shared.search).toMatchObject({
      status: "available",
      label: "Search",
    });
    expect(res.body.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "war",
          status: "source_pending",
        }),
      ]),
    );

    const skaters = res.body.entities.find(
      (entity: { value: string }) => entity.value === "skaters",
    );
    const goalies = res.body.entities.find(
      (entity: { value: string }) => entity.value === "goalies",
    );
    const teams = res.body.entities.find(
      (entity: { value: string }) => entity.value === "teams",
    );

    expect(skaters.supportedTabs).toContain("deployment_tiers");
    expect(skaters.filters.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "mcm_score", status: "available" }),
      ]),
    );
    expect(skaters.filters.archetypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "shoot_first",
          label: "Shoot First",
          status: "available",
        }),
        expect.objectContaining({ value: "pass_first", label: "Pass First" }),
        expect.objectContaining({ value: "play_driver", label: "Play Driver" }),
      ]),
    );
    expect(goalies.supportedTabs).toEqual(["rankings", "war"]);
    expect(goalies.filters.deployments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "all",
          label: "All Goalie Roles",
          status: "available",
        }),
        expect.objectContaining({
          value: "g1_workhorse",
          label: "G1 Workhorse",
          status: "available",
        }),
        expect.objectContaining({
          value: "g2_reserve",
          label: "G2 Reserve",
          status: "available",
        }),
      ]),
    );
    expect(goalies.filters.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "save_percentage", status: "available" }),
        expect.objectContaining({ value: "under_pressure", status: "source_pending" }),
      ]),
    );
    expect(teams.supportedTabs).toEqual(["rankings", "war"]);
    expect(teams.filters.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "off_rating", status: "available" }),
        expect.objectContaining({ value: "home_road_split", status: "source_pending" }),
      ]),
    );
  });
});

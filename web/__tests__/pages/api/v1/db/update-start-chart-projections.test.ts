import { beforeAll, describe, expect, it, vi } from "vitest";

let projectFromRolling: typeof import("../../../../../pages/api/v1/db/update-start-chart-projections").__testables.projectFromRolling;
let START_CHART_ROLLING_SELECT_CLAUSE: typeof import("../../../../../pages/api/v1/db/update-start-chart-projections").START_CHART_ROLLING_SELECT_CLAUSE;
let buildLatestRollingMetricsByPlayer: typeof import("../../../../../pages/api/v1/db/update-start-chart-projections").__testables.buildLatestRollingMetricsByPlayer;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.resetModules();
  ({
    __testables: { projectFromRolling, buildLatestRollingMetricsByPlayer },
    START_CHART_ROLLING_SELECT_CLAUSE
  } = await import("../../../../../pages/api/v1/db/update-start-chart-projections"));
});

describe("update-start-chart-projections compatibility", () => {
  it("falls back to legacy shot-rate fields when canonical values are absent", () => {
    const projection = projectFromRolling(
      {
        goals_avg_all: 0.3,
        goals_avg_last5: 0.4,
        assists_avg_all: 0.5,
        assists_avg_last5: 0.4,
        points_avg_all: 0.8,
        points_avg_last5: 0.8,
        sog_per_60_all: null,
        sog_per_60_last5: null,
        sog_per_60_avg_all: 9,
        sog_per_60_avg_last5: 12,
        toi_seconds_avg_all: 900,
        toi_seconds_avg_last5: 900
      },
      1,
      1
    );

    expect(projection.proj_shots).toBeGreaterThan(0);
  });

  it("keeps both canonical and legacy shot-rate columns in the compatibility select clause", () => {
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("sog_per_60_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("sog_per_60_all");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("sog_per_60_avg_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("sog_per_60_avg_all");
  });

  it("orders weighted-rate fields canonical-first while keeping additive and TOI inputs legacy-shaped", () => {
    expect(
      START_CHART_ROLLING_SELECT_CLAUSE.indexOf("sog_per_60_last5")
    ).toBeLessThan(START_CHART_ROLLING_SELECT_CLAUSE.indexOf("sog_per_60_avg_last5"));
    expect(
      START_CHART_ROLLING_SELECT_CLAUSE.indexOf("sog_per_60_all")
    ).toBeLessThan(START_CHART_ROLLING_SELECT_CLAUSE.indexOf("sog_per_60_avg_all"));

    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("goals_avg_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("assists_avg_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("points_avg_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).toContain("toi_seconds_avg_last5");
    expect(START_CHART_ROLLING_SELECT_CLAUSE).not.toContain("toi_seconds_last5");
  });

  it("keeps the first row for each player when rows are already sorted newest-first", () => {
    const result = buildLatestRollingMetricsByPlayer([
      {
        player_id: 10,
        goals_avg_last5: 1.2,
        goals_avg_all: 0.8,
        assists_avg_last5: 1.1,
        assists_avg_all: 0.7,
        points_avg_last5: 2.3,
        points_avg_all: 1.5,
        sog_per_60_last5: 12,
        sog_per_60_all: 10,
        sog_per_60_avg_last5: 11,
        sog_per_60_avg_all: 9,
        toi_seconds_avg_last5: 1000,
        toi_seconds_avg_all: 950
      },
      {
        player_id: 10,
        goals_avg_last5: 0.2,
        goals_avg_all: 0.3,
        assists_avg_last5: 0.4,
        assists_avg_all: 0.5,
        points_avg_last5: 0.6,
        points_avg_all: 0.7,
        sog_per_60_last5: 8,
        sog_per_60_all: 7,
        sog_per_60_avg_last5: 8,
        sog_per_60_avg_all: 7,
        toi_seconds_avg_last5: 800,
        toi_seconds_avg_all: 820
      },
      {
        player_id: 20,
        goals_avg_last5: 0.9,
        goals_avg_all: 0.6,
        assists_avg_last5: 0.9,
        assists_avg_all: 0.6,
        points_avg_last5: 1.8,
        points_avg_all: 1.2,
        sog_per_60_last5: 11,
        sog_per_60_all: 9,
        sog_per_60_avg_last5: 10,
        sog_per_60_avg_all: 8,
        toi_seconds_avg_last5: 1100,
        toi_seconds_avg_all: 1000
      }
    ]);

    expect(result.size).toBe(2);
    expect(result.get(10)?.goals_avg_last5).toBe(1.2);
    expect(result.get(20)?.goals_avg_last5).toBe(0.9);
  });
});

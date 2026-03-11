import { beforeAll, describe, expect, it, vi } from "vitest";

let projectFromRolling: typeof import("./update-start-chart-projections").__testables.projectFromRolling;
let START_CHART_ROLLING_SELECT_CLAUSE: typeof import("./update-start-chart-projections").START_CHART_ROLLING_SELECT_CLAUSE;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.resetModules();
  ({
    __testables: { projectFromRolling },
    START_CHART_ROLLING_SELECT_CLAUSE
  } = await import("./update-start-chart-projections"));
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
});

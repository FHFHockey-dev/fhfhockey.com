// Open-defect reproductions (R01 WAR season and static metadata, F10). Pure
// functions only. A PASSING "DEFECT PRESENT" test means the defect still exists.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch } from "./fakeSupabase";
import { parseWarSurfaceRequest } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/war";
import { buildContextualRankingsMetadataSurface } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingMetadata";

const fetchSpy = vi.fn(failClosedFetch());

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-14T12:00:00.000Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Open: R01 WAR season and static metadata (F10)", () => {
  it("DEFECT PRESENT R01-WAR-SEASON: the WAR request silently falls back to 2025-26 when season is missing or invalid", () => {
    expect(parseWarSurfaceRequest({}).season).toBe(20252026);
    expect(parseWarSurfaceRequest({ season: "not-a-season" }).season).toBe(20252026);
    // Paired control: an explicit season is honoured.
    expect(parseWarSurfaceRequest({ season: "20262027" }).season).toBe(20262027);
  });

  it("DEFECT PRESENT R01-STATIC-METADATA: on 2026-11-14 the metadata route still serves June 2026 coverage counts and a 2025-26 WAR season as current", () => {
    const metadata = buildContextualRankingsMetadataSurface() as any;
    expect(metadata.war.request.season).toBe(20252026);
    const [goalie, team] = metadata.entityCoverage;
    expect(goalie.verifiedAt).toBe("2026-06-09");
    expect(team.verifiedAt).toBe("2026-06-09");
    expect(goalie.verifiedSources.some((source: any) => source.rowCount === 139893)).toBe(true);
    expect(team.caveats).toContain(
      "Team power ratings are current through 2026-06-09, while team_underlying_stats_summary currently lags at 2026-04-07.",
    );
    // The contract shape has no generation time, as-of or historical marker.
    for (const contract of metadata.entityCoverage) {
      expect(Object.keys(contract).sort()).toEqual([
        "caveats", "currentUiState", "entity", "initialMetricPlan", "liveRankingGates",
        "sourceSummary", "status", "verifiedAt", "verifiedSources",
      ]);
    }
  });
});

import { describe, expect, it } from "vitest";

import { buildContextualRankingsAvailableFilters } from "./availableFilters";
import {
  buildClientRankingsRequest,
  buildGoalieMatrixRequestPath,
  buildMatrixRequestPath,
  buildRankingsRequestPath,
  buildRankingsContextSummary,
  buildSnapshotRequestPath,
  buildTeamMatrixRequestPath,
  buildWarRequestPath,
  DEFAULT_RANKINGS_FILTERS,
  normalizeRankingsFilters,
  type RankingsFilterState,
  minGpForComparisonWindow,
} from "./rankingUrlState";

describe("rankingUrlState", () => {
  it("scales Min GP for comparison windows", () => {
    expect(minGpForComparisonWindow(10, "season", "last5")).toBe(2);
    expect(minGpForComparisonWindow(10, "season", "last20")).toBe(5);
    expect(minGpForComparisonWindow(10, "season", "season")).toBe(10);
    expect(minGpForComparisonWindow(8, "season", "last5")).toBe(5);
    expect(minGpForComparisonWindow(8, "season", "last20")).toBe(8);
    expect(minGpForComparisonWindow(null, "season", "last5")).toBeNull();
  });

  it("keeps season and both selected minimums in matrix and explorer summaries", () => {
    const filters = normalizeRankingsFilters({ season: "20252026", strength: "all", min_gp: "1", min_toi: "600", sort_metric: "mcm_score" });
    expect(buildRankingsContextSummary(filters, 0)).toBe("2025–2026 performance · No eligible values for MCM Score across all skaters · All strengths · Season · Min 1 GP · Min 10:00 TOI");
    expect(buildRankingsContextSummary({ ...filters, tab: "metric_explorer", metric: "sog_per_60", window: "last5" })).toContain("2025–2026 performance · SOG/60 explorer across all skaters · All strengths · Last 5 games · Min 1 GP · Min 10:00 TOI");
    expect(buildRankingsContextSummary({ ...filters, minGp: "0", minToi: "0" })).toContain("Min 0 GP · Min 0:00 TOI");
  });

  it("summarizes only the context applied by advanced views", () => {
    const filters = normalizeRankingsFilters({ window: "last20", deployment: "L1", sample_confidence: "high", source_quality: "clean_only" });
    expect(buildRankingsContextSummary(filters)).toContain("2× selected minimums · Excludes source caveats");
    expect(buildRankingsContextSummary({ ...filters, tab: "trending" })).not.toContain("Last 20");
    expect(buildRankingsContextSummary({ ...filters, tab: "deployment_tiers" })).toContain("Deployment tiers across all skaters");
    const planned = buildRankingsContextSummary({ ...filters, tab: "war" });
    expect(planned).toContain("Planned WAR");
    expect(planned).not.toContain("Min ");
    expect(planned).not.toContain("explorer");
  });

  const publishedTeamMetricOptions =
    buildContextualRankingsAvailableFilters()
      .entities.find((entity) => entity.value === "teams")
      ?.filters.metrics.filter((metric) => metric.status === "available")
      .map((metric) => metric.value) ?? [];

  it("scales the default minimum games with the window but keeps an explicit value", () => {
    expect(normalizeRankingsFilters({}).minGp).toBe("10");
    expect(normalizeRankingsFilters({ window: "last20" }).minGp).toBe("5");
    expect(normalizeRankingsFilters({ window: "last10" }).minGp).toBe("3");
    expect(normalizeRankingsFilters({ window: "last5" }).minGp).toBe("2");
    expect(normalizeRankingsFilters({ window: "season", min_gp: "1" }).minGp).toBe("1");
  });

  it("normalizes URL query defaults for a first-load skater leaderboard", () => {
    // The resolved current season stands in for /api/v1/season (D12).
    expect(normalizeRankingsFilters({}, { currentSeasonId: 20252026 })).toMatchObject({
      entity: "skaters",
      season: "20252026",
      window: "season",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "goals_per_60",
      minGp: "10",
      minToi: "300",
      team: "",
      search: "",
      displayMode: "both",
      goalieRole: "all",
      sort: "percentile",
      direction: "desc",
    });
  });

  it("falls back from invalid URL query values without throwing", () => {
    expect(
      normalizeRankingsFilters({
        entity: "bad",
        window: "last30",
        position: "G",
        deployment: "L9",
        strength: "bad_strength",
        metric: "missing_metric",
        sort: "bad_sort",
        direction: "sideways",
      }),
    ).toMatchObject({
      entity: "skaters",
      window: "season",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "goals_per_60",
      sort: "percentile",
      direction: "desc",
    });
  });

  it("accepts true 5v5 strength and serializes the matrix request path", () => {
    const filters = normalizeRankingsFilters({
      season: "20252026",
      strength: "5v5",
      sort_metric: "xga_per_60",
      sort_direction: "asc",
      sample_confidence: "high",
      page: "2",
      page_size: "25",
      selected_player: "8478402",
      search: "Savoie",
    });

    expect(filters.strength).toBe("5v5");
    expect(filters.matrixSortMetric).toBe("xga_per_60");
    expect(filters.matrixSortDirection).toBe("asc");
    expect(filters.sampleConfidence).toBe("high");
    expect(filters.page).toBe("2");
    expect(filters.pageSize).toBe("25");
    expect(buildMatrixRequestPath(filters)).toBe(
      "/api/v1/contextual-rankings/matrix?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=xga_per_60&sort_direction=asc&page=2&page_size=25&ranking_source=entity_metric_rankings&search=Savoie&sample_confidence=high&selected_player=8478402",
    );
  });

  it("normalizes unsupported matrix page sizes from stale URL state", () => {
    const filters = normalizeRankingsFilters({
      page_size: "5",
    });

    expect(filters.pageSize).toBe("10");
    expect(buildMatrixRequestPath(filters)).toContain("page_size=10");
  });

  it("preserves selected skater snapshot state across matrix pagination and filters", () => {
    const filters = normalizeRankingsFilters({
      selected_player: "8478402",
      page: "3",
      page_size: "25",
      search: "Savoie",
      display: "metric_value",
    });

    expect(buildMatrixRequestPath(filters)).toContain(
      "selected_player=8478402",
    );
    expect(buildMatrixRequestPath(filters)).toContain("page=3");
    expect(buildSnapshotRequestPath(filters)).toContain(
      "selected_player=8478402",
    );

    const changedPage: RankingsFilterState = {
      ...filters,
      page: "1",
      matrixSortMetric: "xga_per_60",
    };

    expect(buildMatrixRequestPath(changedPage)).toContain(
      "selected_player=8478402",
    );
    expect(buildSnapshotRequestPath(changedPage)).toContain(
      "selected_player=8478402",
    );
  });

  it("normalizes advanced display filter URL values", () => {
    const filters = normalizeRankingsFilters({
      sample_confidence: "medium_plus",
      source_quality: "clean_only",
      groups: "offense,missing,defense_on_ice,offense",
      columns: "points_per_60,missing,xga_per_60,points_per_60",
      display: "raw_rank",
    });

    expect(filters.sampleConfidence).toBe("medium_plus");
    expect(filters.sourceQuality).toBe("clean_only");
    expect(filters.displayMode).toBe("raw_rank");
    expect(filters.metricGroups).toBe("offense,defense_on_ice");
    expect(filters.metricColumns).toBe("points_per_60,xga_per_60");
  });

  it("resets invalid position and deployment combinations", () => {
    expect(
      normalizeRankingsFilters({
        position: "D",
        deployment: "L2",
      }).deployment,
    ).toBe("all");
    expect(
      normalizeRankingsFilters({
        position: "F",
        deployment: "P2",
      }).deployment,
    ).toBe("all");
  });

  it("serializes skater filters into the API request path and client request", () => {
    const filters = normalizeRankingsFilters({
      season: "20252026",
      window: "last10",
      position: "F",
      deployment: "L3",
      strength: "ev",
      metric: "ixg_per_60",
      min_gp: "3",
      min_toi: "600",
      team: "7",
      sort: "gp",
      direction: "asc",
    });

    expect(buildRankingsRequestPath(filters)).toBe(
      "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=last10&position=F&deployment=L3&strength=ev&metric=ixg_per_60&min_gp=3&min_toi=600&sort=gp&direction=asc&limit=100&team=7",
    );
    expect(buildClientRankingsRequest(filters)).toMatchObject({
      season: 20252026,
      window: "last10",
      position: "F",
      deployment: "L3",
      strength: "ev",
      metric: "ixg_per_60",
      minGp: 3,
      minToiSeconds: 600,
      teamId: 7,
      peerGroupType: "team",
      sort: "gp",
      direction: "asc",
    });
  });

  it("preserves text team tokens in shareable URLs without creating client NaN ids", () => {
    const filters = normalizeRankingsFilters({
      team: "BOS",
    });

    expect(buildMatrixRequestPath(filters)).toContain("team=BOS");
    expect(buildRankingsRequestPath(filters)).toContain("team=BOS");
    expect(buildClientRankingsRequest(filters)).toMatchObject({
      teamId: null,
      peerGroupType: "team",
    });
  });

  it("does not build an API path for coming-soon entity types", () => {
    const filters = normalizeRankingsFilters({ entity: "goalies" });

    expect(buildRankingsRequestPath(filters)).toBeNull();
  });

  it("serializes search for goalie and team matrix requests", () => {
    const goalieFilters = normalizeRankingsFilters({
      entity: "goalies",
      team: "DAL",
      search: "Shesterkin",
      goalie_metric: "relative_save_percentage",
      goalie_role: "g1_workhorse",
    });
    const teamFilters = normalizeRankingsFilters({
      entity: "teams",
      search: "DAL",
      team_metric: "home_road_point_pct_gap",
    });

    expect(buildGoalieMatrixRequestPath(goalieFilters)).toContain(
      "search=Shesterkin",
    );
    expect(buildGoalieMatrixRequestPath(goalieFilters)).toContain("team=DAL");
    expect(buildGoalieMatrixRequestPath(goalieFilters)).toContain(
      "metric=relative_save_percentage",
    );
    expect(buildGoalieMatrixRequestPath(goalieFilters)).toContain(
      "role=g1_workhorse",
    );
    expect(buildTeamMatrixRequestPath(teamFilters)).toContain("search=DAL");
    expect(buildTeamMatrixRequestPath(teamFilters)).toContain(
      "metric=home_road_point_pct_gap",
    );
  });

  it("round-trips every published live team metric through URL state and request paths", () => {
    expect(publishedTeamMetricOptions).toEqual(
      expect.arrayContaining([
        "forward_top_load_index",
        "defense_pair_top_load_index",
        "pp1_pp2_usage_share",
      ]),
    );

    for (const metric of publishedTeamMetricOptions) {
      const filters = normalizeRankingsFilters({
        entity: "teams",
        team_metric: metric,
      });

      expect(filters.teamMetric).toBe(metric);
      expect(buildTeamMatrixRequestPath(filters)).toContain(`metric=${metric}`);
      expect(buildSnapshotRequestPath({ ...filters, selectedTeam: "CAR" })).toContain(
        `team_metric=${metric}`,
      );
    }
  });

  it("serializes the WAR source-pending contract path for every entity type", () => {
    const filters = normalizeRankingsFilters({
      entity: "teams",
      tab: "war",
      season: "20252026",
      window: "last20",
      strength: "5v5",
    });

    expect(buildWarRequestPath(filters)).toBe(
      "/api/v1/contextual-rankings/war?entity=teams&season=20252026&window=last20&position=all&deployment=all&strength=5v5",
    );
  });

  it("serializes selected snapshot paths only when an entity is explicitly selected", () => {
    expect(buildSnapshotRequestPath(normalizeRankingsFilters({}))).toBeNull();

    const filters = normalizeRankingsFilters({
      entity: "goalies",
      selected_goalie: "32",
      goalie_metric: "gsax",
      goalie_role: "g1_workhorse",
      team: "DAL",
      search: "DeSmith",
    }, { currentSeasonId: 20252026 });

    expect(buildSnapshotRequestPath(filters)).toBe(
      "/api/v1/contextual-rankings/snapshot?entity=goalies&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=points_per_60&goalie_metric=gsax&goalie_role=g1_workhorse&team_metric=off_rating&sort_direction=desc&team=DAL&search=DeSmith&selected_goalie=32",
    );
  });

  it("resolves the default season from the current-season lookup, never a hard-coded season (W2-4 D12)", () => {
    // The defect: an empty query always produced 20252026.
    expect(normalizeRankingsFilters({}).season).toBe("");
    expect(normalizeRankingsFilters({}, { currentSeasonId: 20262027 }).season).toBe("20262027");
    // Rollover: the default follows the resolver when the active season changes.
    expect(normalizeRankingsFilters({}, { currentSeasonId: 20272028 }).season).toBe("20272028");
    // An explicit historical URL season is preserved.
    expect(
      normalizeRankingsFilters({ season: "20242025" }, { currentSeasonId: 20262027 }).season,
    ).toBe("20242025");
    // A failed or missing lookup stays unknown rather than guessing.
    expect(normalizeRankingsFilters({}, { currentSeasonId: null }).season).toBe("");
    expect(normalizeRankingsFilters({ season: "garbage" }, { currentSeasonId: 20262027 }).season).toBe(
      "20262027",
    );
    expect(DEFAULT_RANKINGS_FILTERS.season).toBe("");
  });

  it("forwards a visible, user-lowerable team sample floor (decision 98)", () => {
    const defaults = normalizeRankingsFilters({ entity: "teams" }, { currentSeasonId: 20262027 });
    expect(defaults.teamMinGp).toBe("5");
    expect(buildTeamMatrixRequestPath(defaults)).toContain("min_gp=5");
    const lowered = normalizeRankingsFilters(
      { entity: "teams", team_min_gp: "2" },
      { currentSeasonId: 20262027 },
    );
    expect(buildTeamMatrixRequestPath(lowered)).toContain("min_gp=2");
    // The skater Min GP default (10 for a season) is not the team floor.
    expect(buildTeamMatrixRequestPath(lowered)).not.toContain("min_gp=10");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildTeamStatsSearchParams,
  createDefaultTeamLandingFilterState,
  getDefaultTeamLandingSortState,
  getTeamStatsMinimumToiControlState,
  parseTeamStatsFilterStateFromQuery,
  serializeTeamStatsFilterStateToQuery,
  validateTeamStatsFilterState,
} from "./teamStatsFilters";

describe("teamStatsFilters", () => {
  it("serializes landing filters and only the active scope payload", () => {
    const state = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });

    state.primary.displayMode = "rates";
    state.primary.scoreState = "withinOne";
    state.expandable.teamId = 8;
    state.expandable.againstTeamId = 14;
    state.expandable.venue = "away";
    state.expandable.minimumToiSeconds = 900;
    state.expandable.scope = {
      kind: "teamGameRange",
      value: 7,
    };
    state.expandable.advancedOpen = true;
    state.view.sort = { sortKey: "cfPer60", direction: "asc" };
    state.view.pagination = { page: 3, pageSize: 100 };

    expect(serializeTeamStatsFilterStateToQuery(state)).toEqual({
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "withinOne",
      displayMode: "rates",
      teamId: "8",
      againstTeamId: "14",
      venue: "away",
      minimumToiSeconds: "900",
      scope: "teamGameRange",
      teamGameRange: "7",
      sortKey: "cfPer60",
      sortDirection: "asc",
      page: "3",
      pageSize: "100",
    });
    expect(serializeTeamStatsFilterStateToQuery(state)).not.toHaveProperty("startDate");
    expect(serializeTeamStatsFilterStateToQuery(state)).not.toHaveProperty("endDate");
    expect(serializeTeamStatsFilterStateToQuery(state)).not.toHaveProperty("gameRange");
  });

  it("round-trips canonical state through URL search params", () => {
    const state = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 25,
    });

    state.primary.displayMode = "rates";
    state.expandable.teamId = 5;
    state.expandable.againstTeamId = 19;
    state.expandable.venue = "home";
    state.expandable.minimumToiSeconds = 1200;
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01",
    };
    state.view.sort = { sortKey: "xgfPct", direction: "desc" };
    state.view.pagination = { page: 2, pageSize: 25 };

    const params = buildTeamStatsSearchParams(state);
    const parsed = parseTeamStatsFilterStateFromQuery(
      params,
      createDefaultTeamLandingFilterState({
        currentSeasonId: 20252026,
        pageSize: 25,
      })
    );

    expect(params.get("againstTeamId")).toBe("19");
    expect(params.get("scope")).toBe("dateRange");
    expect(parsed).toEqual(state);
  });

  it("infers mutually exclusive scope from query payload and falls back invalid rate sorts", () => {
    const fallback = createDefaultTeamLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });

    const parsed = parseTeamStatsFilterStateFromQuery(
      new URLSearchParams({
        displayMode: "rates",
        startDate: "2025-11-15",
        endDate: "2025-12-15",
        gameRange: "9",
        teamGameRange: "4",
        sortKey: "cf",
        sortDirection: "asc",
      }),
      fallback
    );

    expect(parsed.expandable.scope).toEqual({
      kind: "dateRange",
      startDate: "2025-11-15",
      endDate: "2025-12-15",
    });
    expect(parsed.view.sort).toEqual({ sortKey: "xgfPct", direction: "desc" });
  });

  it("exposes the locked v1 default sort contract by display mode", () => {
    expect(getDefaultTeamLandingSortState("counts")).toEqual({
      sortKey: "points",
      direction: "desc",
    });
    expect(getDefaultTeamLandingSortState("rates")).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
  });

  it("validates bad date ranges and preserves post-aggregation minimum toi semantics", () => {
    const state = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    state.expandable.minimumToiSeconds = 600;
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    };

    expect(validateTeamStatsFilterState(state)).toEqual({
      isValid: false,
      issues: ["dateRangeOrder"],
    });
    expect(getTeamStatsMinimumToiControlState(state)).toEqual({
      supported: true,
      visible: true,
      disabled: false,
      retainedValue: 600,
      appliesAfterAggregation: true,
    });
  });
});
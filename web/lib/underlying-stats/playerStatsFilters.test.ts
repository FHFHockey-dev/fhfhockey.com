import { describe, expect, it } from "vitest";

import {
  applyPlayerStatsModeChange,
  applyPlayerStatsScopeChange,
  buildPlayerStatsDetailHref,
  buildPlayerStatsSearchParams,
  createDefaultDetailFilterState,
  createDetailFilterStateFromLandingContext,
  createDefaultLandingFilterState,
  getPlayerStatsMinimumToiControlState,
  isPlayerStatsScopeModifierActive,
  normalizePlayerStatsFilterStateForMode,
  parsePlayerStatsFilterStateFromQuery,
  PLAYER_STATS_DETAIL_FILTER_MODEL,
  serializePlayerStatsFilterStateToQuery,
  validatePlayerStatsFilterState,
} from "./playerStatsFilters";

describe("serializePlayerStatsFilterStateToQuery", () => {
  it("serializes landing data-shaping state and excludes UI-only state", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });

    state.primary.statMode = "individual";
    state.primary.displayMode = "rates";
    state.primary.scoreState = "withinOne";
    state.expandable.teamId = 8;
    state.expandable.positionGroup = "centers";
    state.expandable.venue = "away";
    state.expandable.minimumToiSeconds = 600;
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    };
    state.expandable.tradeMode = "split";
    state.expandable.advancedOpen = true;
    state.view.sort = { sortKey: "totalPointsPer60", direction: "asc" };
    state.view.pagination = { page: 3, pageSize: 100 };

    expect(serializePlayerStatsFilterStateToQuery(state)).toEqual({
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "withinOne",
      statMode: "individual",
      displayMode: "rates",
      teamId: "8",
      positionGroup: "centers",
      venue: "away",
      minimumToiSeconds: "600",
      scope: "dateRange",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      tradeMode: "split",
      sortKey: "totalPointsPer60",
      sortDirection: "asc",
      page: "3",
      pageSize: "100",
    });
  });

  it("serializes only the active scope payload", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "gameRange",
      value: 7,
    };

    expect(serializePlayerStatsFilterStateToQuery(state)).toMatchObject({
      scope: "gameRange",
      gameRange: "7",
    });
    expect(serializePlayerStatsFilterStateToQuery(state)).not.toHaveProperty("startDate");
    expect(serializePlayerStatsFilterStateToQuery(state)).not.toHaveProperty("endDate");
    expect(serializePlayerStatsFilterStateToQuery(state)).not.toHaveProperty("byTeamGames");
  });
});

describe("buildPlayerStatsSearchParams", () => {
  it("builds shareable search params from the serialized state", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    const params = buildPlayerStatsSearchParams(state);

    expect(params.get("fromSeasonId")).toBe("20252026");
    expect(params.get("throughSeasonId")).toBe("20252026");
    expect(params.get("scope")).toBe("none");
    expect(params.has("advancedOpen")).toBe(false);
  });

  it("round-trips a detail state through URL search params without leaking landing-only fields", () => {
    const state = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
      pageSize: 25,
    });

    state.primary.statMode = "individual";
    state.primary.displayMode = "rates";
    state.expandable.againstTeamId = 14;
    state.expandable.positionGroup = "rightWings";
    state.expandable.minimumToiSeconds = 900;
    state.expandable.scope = {
      kind: "byTeamGames",
      value: 12,
    };
    state.view.sort = { sortKey: "totalPointsPer60", direction: "asc" };
    state.view.pagination = { page: 2, pageSize: 25 };

    const params = buildPlayerStatsSearchParams(state);
    const parsed = parsePlayerStatsFilterStateFromQuery(
      params,
      createDefaultDetailFilterState({
        currentSeasonId: 20252026,
        pageSize: 25,
      })
    );

    expect(params.get("againstTeamId")).toBe("14");
    expect(params.has("teamId")).toBe(false);
    expect(parsed).toEqual(state);
  });
});

describe("createDetailFilterStateFromLandingContext", () => {
  it("preserves overlapping landing filters and resets detail-incompatible state", () => {
    const landingState = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });

    landingState.primary.statMode = "individual";
    landingState.primary.displayMode = "rates";
    landingState.primary.scoreState = "withinOne";
    landingState.expandable.teamId = 8;
    landingState.expandable.positionGroup = "centers";
    landingState.expandable.venue = "away";
    landingState.expandable.minimumToiSeconds = 600;
    landingState.expandable.scope = {
      kind: "gameRange",
      value: 9,
    };
    landingState.expandable.tradeMode = "split";
    landingState.expandable.advancedOpen = true;
    landingState.view.sort = { sortKey: "totalPointsPer60", direction: "asc" };
    landingState.view.pagination = { page: 4, pageSize: 100 };

    expect(createDetailFilterStateFromLandingContext(landingState)).toEqual({
      surface: "detail",
      primary: {
        seasonRange: {
          fromSeasonId: 20252026,
          throughSeasonId: 20252026,
        },
        seasonType: "regularSeason",
        strength: "fiveOnFive",
        scoreState: "withinOne",
        statMode: "individual",
        displayMode: "rates",
      },
      expandable: {
        againstTeamId: null,
        positionGroup: "centers",
        venue: "away",
        minimumToiSeconds: 600,
        scope: {
          kind: "gameRange",
          value: 9,
        },
        tradeMode: "split",
        advancedOpen: false,
      },
      view: {
        sort: {
          sortKey: "totalPointsPer60",
          direction: "asc",
        },
        pagination: {
          page: 1,
          pageSize: 100,
        },
      },
    });
  });
});

describe("createDefaultDetailFilterState", () => {
  it("defines the direct-load detail filter model with againstTeamId in place of teamId", () => {
    expect(
      createDefaultDetailFilterState({
        currentSeasonId: 20252026,
        pageSize: 25,
      })
    ).toEqual({
      surface: "detail",
      primary: {
        seasonRange: {
          fromSeasonId: 20252026,
          throughSeasonId: 20252026,
        },
        seasonType: "regularSeason",
        strength: "fiveOnFive",
        scoreState: "allScores",
        statMode: "onIce",
        displayMode: "counts",
      },
      expandable: {
        againstTeamId: null,
        positionGroup: null,
        venue: "all",
        minimumToiSeconds: null,
        scope: { kind: "none" },
        tradeMode: "combine",
        advancedOpen: false,
      },
      view: {
        sort: {
          sortKey: "xgfPct",
          direction: "desc",
        },
        pagination: {
          page: 1,
          pageSize: 25,
        },
      },
    });
  });
});

describe("PLAYER_STATS_DETAIL_FILTER_MODEL", () => {
  it("documents the detail-only replacement contract", () => {
    expect(PLAYER_STATS_DETAIL_FILTER_MODEL).toEqual({
      teamFilterReplacement: "againstTeamId",
      againstTeamQuerySemantics: "matchesOpponentTeamId",
      landingTeamCarryoverSemantics: "dropTeamIdResetAgainstTeam",
      landingOnlyExpandableFilters: ["teamId"],
      detailOnlyExpandableFilters: ["againstTeamId"],
      carriedExpandableFilters: [
        "positionGroup",
        "venue",
        "minimumToiSeconds",
        "scope",
        "tradeMode",
      ],
      sortCarryover: "preserve",
      paginationCarryover: "resetPagePreservePageSize",
    });
  });
});

describe("buildPlayerStatsDetailHref", () => {
  it("builds a detail href with recoverable landing context in the query string", () => {
    const landingState = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    landingState.primary.statMode = "goalies";
    landingState.expandable.teamId = 5;
    landingState.expandable.minimumToiSeconds = 1800;
    landingState.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01",
    };

    const href = buildPlayerStatsDetailHref(8478402, landingState);

    expect(href).toBe(
      "/underlying-stats/playerStats/8478402?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=counts&venue=all&minimumToiSeconds=1800&tradeMode=combine&scope=dateRange&startDate=2025-11-01&endDate=2026-02-01&sortKey=xgfPct&sortDirection=desc&page=1&pageSize=50"
    );
  });
});

describe("parsePlayerStatsFilterStateFromQuery", () => {
  it("parses landing query params into the canonical landing state shape", () => {
    const fallback = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    const state = parsePlayerStatsFilterStateFromQuery(
      new URLSearchParams({
        fromSeasonId: "20232024",
        throughSeasonId: "20252026",
        seasonType: "playoffs",
        strength: "powerPlay",
        scoreState: "trailing",
        statMode: "goalies",
        displayMode: "rates",
        teamId: "4",
        positionGroup: "goalies",
        venue: "home",
        minimumToiSeconds: "900",
        scope: "byTeamGames",
        byTeamGames: "12",
        tradeMode: "split",
        sortKey: "savePct",
        sortDirection: "asc",
        page: "2",
        pageSize: "25",
      }),
      fallback
    );

    expect(state).toEqual({
      surface: "landing",
      primary: {
        seasonRange: {
          fromSeasonId: 20232024,
          throughSeasonId: 20252026,
        },
        seasonType: "playoffs",
        strength: "powerPlay",
        scoreState: "trailing",
        statMode: "goalies",
        displayMode: "rates",
      },
      expandable: {
        teamId: 4,
        positionGroup: null,
        venue: "home",
        minimumToiSeconds: 900,
        scope: {
          kind: "byTeamGames",
          value: 12,
        },
        tradeMode: "split",
        advancedOpen: false,
      },
      view: {
        sort: {
          sortKey: "savePct",
          direction: "asc",
        },
        pagination: {
          page: 2,
          pageSize: 25,
        },
      },
    });
  });

  it("keeps scope intent while nulling invalid scope-specific values", () => {
    const fallback = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    const state = parsePlayerStatsFilterStateFromQuery(
      {
        scope: "gameRange",
        gameRange: "not-a-number",
        sortKey: "xgfPct",
      },
      fallback
    );

    expect(state.expandable.scope).toEqual({
      kind: "gameRange",
      value: null,
    });
    expect(state.view.sort).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
  });

  it("uses only the declared scope when stale params for other scopes are present", () => {
    const fallback = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    const state = parsePlayerStatsFilterStateFromQuery(
      {
        scope: "dateRange",
        startDate: "2025-11-01",
        endDate: "2025-12-01",
        gameRange: "5",
        byTeamGames: "9",
      },
      fallback
    );

    expect(state.expandable.scope).toEqual({
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: "2025-12-01",
    });
  });

  it("clears incompatible position filters after parsing a mode-mismatched URL", () => {
    const fallback = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    const state = parsePlayerStatsFilterStateFromQuery(
      {
        statMode: "goalies",
        positionGroup: "centers",
      },
      fallback
    );

    expect(state.primary.statMode).toBe("goalies");
    expect(state.expandable.positionGroup).toBeNull();
  });

  it("uses the detail-specific opponent filter and ignores landing team ids", () => {
    const fallback = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
    });

    const state = parsePlayerStatsFilterStateFromQuery(
      {
        againstTeamId: "14",
        teamId: "7",
        positionGroup: "leftWings",
        scope: "dateRange",
        startDate: "2025-10-01",
        endDate: "2025-12-01",
      },
      fallback
    );

    expect(state.surface).toBe("detail");
    expect(state.expandable).toEqual({
      againstTeamId: 14,
      positionGroup: "leftWings",
      venue: "all",
      minimumToiSeconds: null,
      scope: {
        kind: "dateRange",
        startDate: "2025-10-01",
        endDate: "2025-12-01",
      },
      tradeMode: "combine",
      advancedOpen: false,
    });
  });
});

describe("normalizePlayerStatsFilterStateForMode", () => {
  it("leaves display mode unchanged when the next mode still supports it", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "goalies";
    state.primary.displayMode = "rates";

    const result = normalizePlayerStatsFilterStateForMode(state);

    expect(result.state.primary.displayMode).toBe("rates");
    expect(result.resetReasons).toEqual([]);
  });

  it("clears an incompatible position group for goalie mode and reports the reset", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "goalies";
    state.expandable.positionGroup = "leftWings";

    const result = normalizePlayerStatsFilterStateForMode(state);

    expect(result.state.expandable.positionGroup).toBeNull();
    expect(result.resetReasons).toEqual(["positionGroupClearedForMode"]);
  });
});

describe("applyPlayerStatsModeChange", () => {
  it("switches to goalie mode and clears incompatible position state", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "individual";
    state.expandable.teamId = 10;
    state.expandable.positionGroup = "centers";

    const result = applyPlayerStatsModeChange(state, "goalies");

    expect(result.state.primary.statMode).toBe("goalies");
    expect(result.state.expandable.teamId).toBe(10);
    expect(result.state.expandable.positionGroup).toBeNull();
    expect(result.resetReasons).toEqual(["positionGroupClearedForMode"]);
  });

  it("switches away from goalie mode without inventing a replacement position filter", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "goalies";
    state.expandable.minimumToiSeconds = 1800;
    state.expandable.positionGroup = null;

    const result = applyPlayerStatsModeChange(state, "onIce");

    expect(result.state.primary.statMode).toBe("onIce");
    expect(result.state.expandable.minimumToiSeconds).toBe(1800);
    expect(result.state.expandable.positionGroup).toBeNull();
    expect(result.resetReasons).toEqual([]);
  });
});

describe("applyPlayerStatsScopeChange", () => {
  it("switches from date range to game range as one exclusive scope", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: "2025-12-01",
    };

    const nextState = applyPlayerStatsScopeChange(state, {
      kind: "gameRange",
      value: 5,
    });

    expect(nextState.expandable.scope).toEqual({
      kind: "gameRange",
      value: 5,
    });
  });

  it("switches from by-team-games to none without retaining stale scoped values", () => {
    const state = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "byTeamGames",
      value: 10,
    };

    const nextState = applyPlayerStatsScopeChange(state, {
      kind: "none",
    });

    expect(nextState.expandable.scope).toEqual({
      kind: "none",
    });
  });
});

describe("isPlayerStatsScopeModifierActive", () => {
  it("reports whether a non-default scope is active for UI highlighting", () => {
    expect(isPlayerStatsScopeModifierActive({ kind: "none" })).toBe(false);
    expect(
      isPlayerStatsScopeModifierActive({
        kind: "byTeamGames",
        value: 10,
      })
    ).toBe(true);
  });
});

describe("getPlayerStatsMinimumToiControlState", () => {
  it("keeps minimum TOI available for goalie mode and retains the active threshold", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "goalies";
    state.expandable.minimumToiSeconds = 2400;

    expect(getPlayerStatsMinimumToiControlState(state)).toEqual({
      supported: true,
      visible: true,
      disabled: false,
      retainedValue: 2400,
      appliesAfterAggregation: true,
    });
  });

  it("keeps minimum TOI semantics identical for counts and rates", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.statMode = "individual";
    state.primary.displayMode = "rates";
    state.expandable.minimumToiSeconds = 600;

    expect(getPlayerStatsMinimumToiControlState(state)).toEqual({
      supported: true,
      visible: true,
      disabled: false,
      retainedValue: 600,
      appliesAfterAggregation: true,
    });
  });
});

describe("validatePlayerStatsFilterState", () => {
  it("accepts a valid regular-season date range inside the selected season span", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-10-15",
      endDate: "2026-02-01",
    };

    const result = validatePlayerStatsFilterState(state, {
      seasonWindowsById: {
        20252026: {
          seasonId: 20252026,
          regularSeasonStartDate: "2025-10-07",
          regularSeasonEndDate: "2026-04-17",
          seasonEndDate: "2026-06-20",
        },
      },
    });

    expect(result).toEqual({
      isValid: true,
      issues: [],
    });
  });

  it("rejects inverted season ranges before querying", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.seasonRange = {
      fromSeasonId: 20252026,
      throughSeasonId: 20242025,
    };

    expect(validatePlayerStatsFilterState(state)).toEqual({
      isValid: false,
      issues: ["seasonRangeOrder"],
    });
  });

  it("rejects incomplete date ranges", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: null,
    };

    expect(validatePlayerStatsFilterState(state)).toEqual({
      isValid: false,
      issues: ["dateRangeMissingEnd"],
    });
  });

  it("rejects reversed date ranges", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2026-03-01",
      endDate: "2026-02-01",
    };

    expect(validatePlayerStatsFilterState(state)).toEqual({
      isValid: false,
      issues: ["dateRangeOrder"],
    });
  });

  it("rejects date ranges outside the selected regular-season span", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.seasonRange = {
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    };
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2024-09-20",
      endDate: "2026-04-20",
    };

    const result = validatePlayerStatsFilterState(state, {
      seasonWindowsById: {
        20242025: {
          seasonId: 20242025,
          regularSeasonStartDate: "2024-10-04",
          regularSeasonEndDate: "2025-04-17",
          seasonEndDate: "2025-06-24",
        },
        20252026: {
          seasonId: 20252026,
          regularSeasonStartDate: "2025-10-07",
          regularSeasonEndDate: "2026-04-17",
          seasonEndDate: "2026-06-20",
        },
      },
    });

    expect(result).toEqual({
      isValid: false,
      issues: ["dateRangeOutsideSeasonSpan"],
    });
  });

  it("uses playoff season end dates when validating playoff date ranges", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });

    state.primary.seasonType = "playoffs";
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2026-04-20",
      endDate: "2026-06-10",
    };

    const result = validatePlayerStatsFilterState(state, {
      seasonWindowsById: {
        20252026: {
          seasonId: 20252026,
          regularSeasonStartDate: "2025-10-07",
          regularSeasonEndDate: "2026-04-17",
          seasonEndDate: "2026-06-20",
        },
      },
    });

    expect(result).toEqual({
      isValid: true,
      issues: [],
    });
  });
});

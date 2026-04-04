import { describe, expect, it } from "vitest";

import { createDefaultLandingFilterState } from "./playerStatsFilters";
import {
  buildLandingTradeDisplay,
  buildPlayerStatsLandingApiPath,
  createEmptyPlayerStatsLandingResponse,
  matchesPlayerStatsPositionGroup,
  normalizeCanonicalPlayerPositionCode,
  parseLandingApiRequest,
} from "./playerStatsQueries";

describe("buildPlayerStatsLandingApiPath", () => {
  it("builds the landing API path from canonical landing state", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });

    state.primary.statMode = "goalies";
    state.primary.displayMode = "rates";
    state.expandable.teamId = 5;
    state.view.sort = { sortKey: "savePct", direction: "desc" };
    state.view.pagination = { page: 2, pageSize: 100 };

    expect(buildPlayerStatsLandingApiPath(state)).toBe(
      "/api/v1/underlying-stats/players?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=rates&teamId=5&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=2&pageSize=100"
    );
  });
});

describe("createEmptyPlayerStatsLandingResponse", () => {
  it("returns a server-sort/server-pagination response envelope", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });

    state.primary.statMode = "individual";
    state.primary.displayMode = "rates";
    state.view.sort = { sortKey: "totalPointsPer60", direction: "desc" };
    state.view.pagination = { page: 3, pageSize: 50 };

    expect(createEmptyPlayerStatsLandingResponse(state)).toMatchObject({
      family: "individualRates",
      rows: [],
      sort: {
        sortKey: "totalPointsPer60",
        direction: "desc",
      },
      pagination: {
        page: 3,
        pageSize: 50,
        totalRows: 0,
        totalPages: 0,
      },
      placeholder: true,
    });
  });
});

describe("buildLandingTradeDisplay", () => {
  it("keeps a single-team combine row attached to that team", () => {
    expect(
      buildLandingTradeDisplay({
        playerId: 8478402,
        tradeMode: "combine",
        teamContexts: [
          {
            teamId: 13,
            teamAbbrev: "FLA",
            firstGameDate: "2025-10-08",
          },
        ],
      })
    ).toEqual({
      aggregationUnit: "player",
      rowKey: "landing:player:8478402",
      teamId: 13,
      teamAbbrev: "FLA",
      teamLabel: "FLA",
    });
  });

  it("builds a deterministic combined label ordered by first included game date", () => {
    expect(
      buildLandingTradeDisplay({
        playerId: 8478402,
        tradeMode: "combine",
        teamContexts: [
          {
            teamId: 3,
            teamAbbrev: "NYR",
            firstGameDate: "2026-03-02",
          },
          {
            teamId: 13,
            teamAbbrev: "FLA",
            firstGameDate: "2025-10-08",
          },
          {
            teamId: 13,
            teamAbbrev: "FLA",
            firstGameDate: "2025-10-18",
          },
        ],
      })
    ).toEqual({
      aggregationUnit: "player",
      rowKey: "landing:player:8478402",
      teamId: null,
      teamAbbrev: null,
      teamLabel: "FLA / NYR",
    });
  });

  it("creates split rows with playerTeam identity and a single-team label", () => {
    expect(
      buildLandingTradeDisplay({
        playerId: 8478402,
        tradeMode: "split",
        splitTeamId: 3,
        teamContexts: [
          {
            teamId: 13,
            teamAbbrev: "FLA",
            firstGameDate: "2025-10-08",
          },
          {
            teamId: 3,
            teamAbbrev: "NYR",
            firstGameDate: "2026-03-02",
          },
        ],
      })
    ).toEqual({
      aggregationUnit: "playerTeam",
      rowKey: "landing:playerTeam:8478402:3",
      teamId: 3,
      teamAbbrev: "NYR",
      teamLabel: "NYR",
    });
  });
});

describe("normalizeCanonicalPlayerPositionCode", () => {
  it("normalizes canonical roster positions for skaters and goalies", () => {
    expect(normalizeCanonicalPlayerPositionCode("C")).toBe("C");
    expect(normalizeCanonicalPlayerPositionCode("l")).toBe("LW");
    expect(normalizeCanonicalPlayerPositionCode("RW")).toBe("RW");
    expect(normalizeCanonicalPlayerPositionCode("LD")).toBe("D");
    expect(normalizeCanonicalPlayerPositionCode("goalie")).toBe("G");
  });

  it("forces goalie mode to canonical goalie position", () => {
    expect(normalizeCanonicalPlayerPositionCode("C", "goalies")).toBe("G");
  });

  it("returns null for non-canonical aggregate labels", () => {
    expect(normalizeCanonicalPlayerPositionCode("F")).toBeNull();
    expect(normalizeCanonicalPlayerPositionCode("W")).toBeNull();
    expect(normalizeCanonicalPlayerPositionCode(null)).toBeNull();
  });
});

describe("matchesPlayerStatsPositionGroup", () => {
  it("matches skater groups from canonical roster-position logic", () => {
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "C",
        positionGroup: "centers",
        mode: "individual",
      })
    ).toBe(true);
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "L",
        positionGroup: "leftWings",
        mode: "onIce",
      })
    ).toBe(true);
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "RD",
        positionGroup: "defensemen",
        mode: "individual",
      })
    ).toBe(true);
  });

  it("keeps skater filters from matching goalies or non-canonical aggregate labels", () => {
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "G",
        positionGroup: "skaters",
        mode: "individual",
      })
    ).toBe(false);
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "F",
        positionGroup: "centers",
        mode: "individual",
      })
    ).toBe(false);
  });

  it("treats goalie mode as goalie-only regardless of incoming raw labels", () => {
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "C",
        positionGroup: null,
        mode: "goalies",
      })
    ).toBe(true);
    expect(
      matchesPlayerStatsPositionGroup({
        rawPosition: "C",
        positionGroup: "goalies",
        mode: "goalies",
      })
    ).toBe(true);
  });
});

describe("parseLandingApiRequest", () => {
  it("parses a valid landing request into canonical state", () => {
    const result = parseLandingApiRequest({
      fromSeasonId: "20242025",
      throughSeasonId: "20252026",
      statMode: "individual",
      displayMode: "counts",
      page: "2",
      pageSize: "25",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.primary.seasonRange).toEqual({
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    });
    expect(result.state.view.pagination).toEqual({
      page: 2,
      pageSize: 25,
    });
  });

  it("rejects invalid date-range combinations before query execution", () => {
    const result = parseLandingApiRequest({
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      error: {
        error: "Invalid player stats filter combination.",
        issues: ["dateRangeOrder"],
      },
    });
  });
});

import { describe, expect, it } from "vitest";

import { createDefaultLandingFilterState } from "./playerStatsFilters";
import {
  buildGoalieStatsDetailApiPath,
  buildGoalieStatsDetailHref,
  buildGoalieStatsLandingApiPath,
  buildGoalieStatsLandingChartApiPath,
  buildGoalieStatsLandingHref,
  createDefaultGoalieDetailFilterState,
  createDefaultGoalieLandingFilterState,
  parseGoalieDetailApiRequest,
  parseGoalieLandingApiRequest,
  parseGoalieLandingChartApiRequest,
} from "./goalieStatsQueries";

describe("goalieStatsQueries", () => {
  it("creates goalie-first default landing and detail states", () => {
    expect(
      createDefaultGoalieLandingFilterState({ currentSeasonId: 20252026 }).primary
        .statMode
    ).toBe("goalies");
    expect(
      createDefaultGoalieDetailFilterState({ currentSeasonId: 20252026 }).primary
        .statMode
    ).toBe("goalies");
  });

  it("builds dedicated goalie landing and detail api paths", () => {
    const landingState = createDefaultGoalieLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });
    landingState.primary.displayMode = "rates";
    landingState.expandable.teamId = 5;
    landingState.view.sort = { sortKey: "savePct", direction: "desc" };
    landingState.view.pagination = { page: 2, pageSize: 100 };

    const detailState = createDefaultGoalieDetailFilterState({
      currentSeasonId: 20252026,
    });
    detailState.expandable.againstTeamId = 7;

    expect(buildGoalieStatsLandingApiPath(landingState)).toBe(
      "/api/v1/underlying-stats/goalies?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=rates&teamId=5&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=2&pageSize=100"
    );
    expect(buildGoalieStatsDetailApiPath(8475883, detailState)).toBe(
      "/api/v1/underlying-stats/goalies/8475883?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=counts&againstTeamId=7&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=50"
    );
  });

  it("builds dedicated goalie page and chart hrefs", () => {
    const landingState = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 100,
    });
    landingState.primary.statMode = "individual";
    landingState.primary.displayMode = "rates";
    landingState.expandable.teamId = 3;
    landingState.view.sort = { sortKey: "savePct", direction: "desc" };
    landingState.view.pagination = { page: 1, pageSize: 100 };

    expect(buildGoalieStatsLandingHref(landingState)).toBe(
      "/underlying-stats/goalieStats?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=rates&teamId=3&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=100"
    );
    expect(buildGoalieStatsDetailHref(8475883, landingState)).toBe(
      "/underlying-stats/goalieStats/8475883?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=rates&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=100"
    );
    expect(
      buildGoalieStatsLandingChartApiPath({
        playerId: 8475883,
        state: landingState,
        splitTeamId: 9,
      })
    ).toBe(
      "/api/v1/underlying-stats/goalies/8475883/chart?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=rates&teamId=3&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=100&splitTeamId=9"
    );
  });

  it("forces goalie mode when parsing dedicated goalie api requests", () => {
    const landing = parseGoalieLandingApiRequest({
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      statMode: "individual",
    });
    const detail = parseGoalieDetailApiRequest({
      playerId: "8475883",
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      statMode: "individual",
    });
    const chart = parseGoalieLandingChartApiRequest({
      playerId: "8475883",
      splitTeamId: "7",
      statMode: "individual",
    });

    expect(landing.ok && landing.state.primary.statMode).toBe("goalies");
    expect(detail.ok && detail.state.primary.statMode).toBe("goalies");
    expect(chart.ok && chart.state.primary.statMode).toBe("goalies");
    expect(chart.ok && chart.splitTeamId).toBe(7);
  });
});

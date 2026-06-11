import { describe, expect, it } from "vitest";

import {
  aggregateTeamStyleRows,
  parseTeamMatrixRequest,
} from "./teamMatrix";

describe("teamMatrix", () => {
  it("aggregates five-on-five team style rows by team abbreviation", () => {
    const teamsById = new Map([
      [1, { id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
      [2, { id: 2, abbreviation: "TOR", name: "Toronto Maple Leafs" }],
    ]);
    const aggregates = aggregateTeamStyleRows({
      teamsById,
      rows: [
        {
          game_date: "2026-04-01",
          team_id: 1,
          xgf: 2,
          xga: 1,
          gf: 3,
          ga: 1,
          ff: 20,
          fa: 10,
          cf: 30,
          ca: 15,
        },
        {
          game_date: "2026-04-03",
          team_id: 1,
          xgf: 1.5,
          xga: 2,
          gf: 1,
          ga: 2,
          ff: 18,
          fa: 22,
          cf: 28,
          ca: 31,
        },
        {
          game_date: "2026-04-02",
          team_id: 2,
          xgf: 3,
          xga: 1,
          gf: 2,
          ga: 0,
          ff: 25,
          fa: 12,
          cf: 33,
          ca: 20,
        },
      ],
    });

    expect(aggregates.get("BOS")).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      latestDate: "2026-04-03",
      xgf: 3.5,
      xga: 3,
      gf: 4,
      ga: 3,
      ff: 38,
      fa: 32,
      source: "team_underlying_stats_summary",
    });
    expect(aggregates.get("TOR")?.gamesCount).toBe(1);
  });

  it("parses team matrix requests with conservative defaults", () => {
    const request = parseTeamMatrixRequest({
      season: "20252026",
      metric: "xgf_percentage",
      page_size: "25",
    });

    expect(request).toMatchObject({
      season: 20252026,
      metric: "xgf_percentage",
      sortDirection: "desc",
      page: 1,
      pageSize: 25,
    });
  });
});

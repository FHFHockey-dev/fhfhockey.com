import { describe, expect, it } from "vitest";

import {
  aggregateGoalieGameRows,
  parseGoalieMatrixRequest,
  rankGoalieMetricValues,
} from "./goalieMatrix";

describe("goalieMatrix", () => {
  it("aggregates latest-window goalie rows and preserves partial NST warnings", () => {
    const rows = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 28,
          goals_against: 2,
          shots_against: 30,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2.4,
          nst_5v5_counts_goals_against: 2,
          nst_5v5_counts_gsaa: 0.7,
        },
        {
          player_id: 1,
          date: "2026-04-02",
          season_id: 20252026,
          team_id: 10,
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 24,
          goals_against: 3,
          shots_against: 27,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2.1,
          nst_5v5_counts_goals_against: 3,
          nst_5v5_counts_gsaa: -0.4,
        },
      ],
      "season",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 1,
      gamesPlayed: 2,
      gamesStarted: 2,
      saves: 52,
      shotsAgainst: 57,
      qualityStarts: 1,
      reallyBadStarts: 0,
      stealGames: 0,
      nst5v5Gsaa: 0.3,
      nst5v5Gsax: -0.5,
    });
    expect(rows[0].sourceWarnings).toEqual([]);
  });

  it("parses goalie matrix requests with conservative defaults", () => {
    const request = parseGoalieMatrixRequest({
      season: "20252026",
      metric: "really_bad_start_rate",
      window: "last10",
      goalie_role: "g1a_tandem_lead",
      team: "DAL",
      search: "Shesterkin",
      page_size: "25",
    });

    expect(request).toMatchObject({
      season: 20252026,
      metric: "really_bad_start_rate",
      window: "last10",
      role: "g1a_tandem_lead",
      team: "DAL",
      minStarts: 3,
      minShots: 100,
      search: "Shesterkin",
      page: 1,
      pageSize: 25,
    });
  });

  it("counts modern really bad starts from existing goalie game rows", () => {
    const rows = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 18,
          goals_against: 4,
          shots_against: 22,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 1.5,
          nst_5v5_counts_goals_against: 4,
          nst_5v5_counts_gsaa: -2,
        },
      ],
      "season",
    );

    expect(rows[0]).toMatchObject({
      gamesStarted: 1,
      reallyBadStarts: 1,
      nst5v5Gsax: -2.5,
    });
  });

  it("ranks lower-is-better goalie metrics with higher percentiles for lower raw values", () => {
    const ranks = rankGoalieMetricValues(
      [
        { id: 1, value: 0.1 },
        { id: 2, value: 0.1 },
        { id: 3, value: 0.3 },
        { id: 4, value: null },
      ],
      true,
    );

    expect(ranks.get(1)).toMatchObject({
      rank: 1,
      percentile: 100,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(2)).toMatchObject({
      rank: 1,
      percentile: 100,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(3)).toMatchObject({
      rank: 2,
      percentile: 33.333,
      qualifiedPeerCount: 3,
    });
    expect(ranks.has(4)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  aggregateGoalieGameRows,
  buildGoalieRelativeSaveContexts,
  buildGoalieRoleContextForTests,
  calculateGoalieHighDangerSavePercentage,
  calculateGoalieRelativeSavePercentage,
  calculateGoalieValueSignal,
  calculateGoalieXgaPerShotAgainst,
  GOALIE_SOURCE_PENDING_METRIC_CONTRACTS,
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
          nst_5v5_counts_saves: 22,
          nst_5v5_counts_shots_against: 24,
          nst_5v5_counts_hd_saves: 7,
          nst_5v5_counts_hd_shots_against: 8,
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
          nst_5v5_counts_saves: 18,
          nst_5v5_counts_shots_against: 21,
          nst_5v5_counts_hd_saves: 5,
          nst_5v5_counts_hd_shots_against: 7,
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
      nst5v5XgAgainst: 4.5,
      nst5v5Saves: 40,
      nst5v5ShotsAgainst: 45,
      nst5v5HighDangerSaves: 12,
      nst5v5HighDangerShotsAgainst: 15,
    });
    expect(rows[0].sourceWarnings).toEqual([]);
  });

  it("calculates next-set goalie metrics from verified NST fields and publishes pending contracts", () => {
    expect(
      calculateGoalieXgaPerShotAgainst({
        xgAgainst: 4.5,
        shotsAgainst: 45,
      }),
    ).toBe(0.1);
    expect(calculateGoalieValueSignal({ gsax: -0.5, gsaa: 0.3 })).toBe(-0.1);
    expect(
      calculateGoalieHighDangerSavePercentage({
        saves: 12,
        shotsAgainst: 15,
      }),
    ).toBe(0.8);
    expect(
      calculateGoalieRelativeSavePercentage({
        goalieSaves: 92,
        goalieShotsAgainst: 100,
        teamWithoutGoalieSaves: 83,
        teamWithoutGoalieShotsAgainst: 100,
      }),
    ).toBe(0.09);
    expect(GOALIE_SOURCE_PENDING_METRIC_CONTRACTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: "under_pressure_profile",
          status: "source_pending",
          requiredFields: expect.arrayContaining([
            "pressure_bucket",
            "screen_or_traffic_label",
            "shot_result_save_or_goal",
          ]),
        }),
      ]),
    );
    expect(GOALIE_SOURCE_PENDING_METRIC_CONTRACTS).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: "relative_save_percentage" }),
      ]),
    );
  });

  it("builds same-team other-goalie relative save baselines with low-sample gating", () => {
    const [starter, backup, thinBaseline] = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Starter",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 26,
          goals_against: 2,
          shots_against: 28,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2,
          nst_5v5_counts_goals_against: 2,
          nst_5v5_counts_gsaa: 0.5,
          nst_5v5_counts_saves: 92,
          nst_5v5_counts_shots_against: 100,
        },
        {
          player_id: 2,
          date: "2026-04-02",
          season_id: 20252026,
          team_id: 10,
          player_name: "Backup",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 22,
          goals_against: 5,
          shots_against: 27,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 3,
          nst_5v5_counts_goals_against: 5,
          nst_5v5_counts_gsaa: -1,
          nst_5v5_counts_saves: 83,
          nst_5v5_counts_shots_against: 100,
        },
        {
          player_id: 3,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 20,
          player_name: "Thin Baseline",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 19,
          goals_against: 1,
          shots_against: 20,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 1,
          nst_5v5_counts_goals_against: 1,
          nst_5v5_counts_gsaa: 0.2,
          nst_5v5_counts_saves: 19,
          nst_5v5_counts_shots_against: 20,
        },
      ],
      "season",
    );
    const contexts = buildGoalieRelativeSaveContexts([
      starter,
      backup,
      thinBaseline,
    ]);

    expect(contexts.get(1)).toMatchObject({
      goalieSavePercentage: 0.92,
      teamWithoutGoalieSavePercentage: 0.83,
      relativeSavePercentage: 0.09,
      warnings: [],
    });
    expect(contexts.get(2)).toMatchObject({
      goalieSavePercentage: 0.83,
      teamWithoutGoalieSavePercentage: 0.92,
      relativeSavePercentage: -0.09,
      warnings: [],
    });
    expect(contexts.get(3)).toMatchObject({
      relativeSavePercentage: null,
      warnings: ["low_team_without_goalie_5v5_save_sample"],
    });
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
          nst_5v5_counts_saves: 14,
          nst_5v5_counts_shots_against: 18,
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
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(2)).toMatchObject({
      rank: 1,
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(3)).toMatchObject({
      rank: 2,
      percentile: 0,
      qualifiedPeerCount: 3,
    });
    expect(ranks.has(4)).toBe(false);
  });

  it("builds raw and inferred top-two/core start-share role context", () => {
    const aggregates = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Starter",
          games_played: 6,
          games_started: 6,
          wins: 4,
          saves: 150,
          goals_against: 12,
          shots_against: 162,
          time_on_ice: 21600,
          quality_start: 4,
          nst_5v5_counts_toi: 18000,
          nst_5v5_counts_xg_against: 11,
          nst_5v5_counts_goals_against: 12,
          nst_5v5_counts_gsaa: 1,
        },
        {
          player_id: 2,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Backup",
          games_played: 3,
          games_started: 3,
          wins: 1,
          saves: 75,
          goals_against: 8,
          shots_against: 83,
          time_on_ice: 10800,
          quality_start: 1,
          nst_5v5_counts_toi: 9000,
          nst_5v5_counts_xg_against: 7,
          nst_5v5_counts_goals_against: 8,
          nst_5v5_counts_gsaa: -1,
        },
        {
          player_id: 3,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10,
          player_name: "Call Up",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 20,
          goals_against: 4,
          shots_against: 24,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 3,
          nst_5v5_counts_goals_against: 4,
          nst_5v5_counts_gsaa: -1,
        },
      ],
      "season",
    );

    const starter = buildGoalieRoleContextForTests({
      aggregate: aggregates.find((row) => row.playerId === 1)!,
      projection: null,
      aggregates,
    });
    const callUp = buildGoalieRoleContextForTests({
      aggregate: aggregates.find((row) => row.playerId === 3)!,
      projection: null,
      aggregates,
    });

    expect(starter).toMatchObject({
      deploymentBucket: "g1_workhorse",
      deploymentSource: "adjusted_core_start_share",
      rawStartShare: 0.6,
      adjustedStartShare: 0.666667,
      coreStartShare: 0.666667,
      coreGoalieIds: [1, 2],
      excludedTeamStarts: 1,
      roleConfidence: "medium",
    });
    expect(starter.roleNotes.join(" ")).toContain("inferred top-two");
    expect(callUp).toMatchObject({
      deploymentBucket: "g2_backup",
      deploymentSource: "selected_window_team_start_share",
      rawStartShare: 0.1,
      adjustedStartShare: 0.1,
      coreStartShare: null,
      roleConfidence: "low",
    });
    expect(callUp.roleNotes.join(" ")).toContain("outside the inferred top-two");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildSeasonDecayedPlayerImpactPriors,
  buildPlayerImpactRatings,
  defaultPlayerImpactSeasonDecayWeight,
  uniqueSnapshotDatesFromSources,
  type PlayerImpactRatingRow,
  type PlayerImpactSourceRow,
} from "./playerImpactRatings";

function skaterRow(
  playerId: number,
  date: string,
  toiSeconds: number,
  offense: number,
  defense: number,
): PlayerImpactSourceRow {
  return {
    player_id: playerId,
    team_id: playerId,
    position_code: "C",
    date,
    games_played: 1,
    nst_toi: toiSeconds,
    toi_per_game: toiSeconds,
    nst_points_per_60: offense,
    nst_goals_per_60: offense,
    nst_first_assists_per_60: offense,
    nst_ixg_per_60: offense,
    nst_icf_per_60: offense,
    nst_shots_per_60: offense,
    nst_oi_xgf_per_60: offense,
    nst_oi_xga_per_60: defense,
    nst_oi_ca_per_60: defense,
    nst_oi_sca_per_60: defense,
    nst_oi_xgf_pct_rates: 50 + offense,
    nst_oi_cf_pct_rates: 50 + offense,
    nst_shots_blocked_per_60: offense,
    nst_takeaways_per_60: offense,
    nst_giveaways_per_60: defense,
    nst_oi_def_zone_starts_per_60: offense,
  };
}

function goalieRow(
  playerId: number,
  date: string,
  toiSeconds: number,
  gsaaPer60: number,
  savePct: number,
): PlayerImpactSourceRow {
  const shotsAgainst = 30;
  return {
    player_id: playerId,
    team_id: playerId,
    date,
    games_played: 1,
    games_started: 1,
    time_on_ice: toiSeconds,
    saves: Math.round(shotsAgainst * savePct),
    shots_against: shotsAgainst,
    goals_against: shotsAgainst - Math.round(shotsAgainst * savePct),
    quality_starts_pct: savePct >= 0.9 ? 1 : 0,
    nst_all_rates_gsaa_per_60: gsaaPer60,
    nst_all_counts_gsaa: (gsaaPer60 * toiSeconds) / 3600,
  };
}

function ratingRow(args: {
  playerId: number;
  seasonId: number;
  snapshotDate: string;
  ratingRaw: number;
  rating0To100: number;
  teamId?: number;
}): PlayerImpactRatingRow {
  return {
    snapshot_date: args.snapshotDate,
    season_id: args.seasonId,
    player_id: args.playerId,
    team_id: args.teamId ?? args.playerId,
    rating_0_to_100: args.rating0To100,
    rating_raw: args.ratingRaw,
    league_rank: 1,
    percentile: 1,
    sample_games: 10,
    sample_toi_seconds: 6000,
    model_name: "skater_offense",
    model_version: "skater_impact_v1_game_log_toi_shrunk",
    source_window: "season_to_date",
    components: {},
    provenance: {},
    metadata: { ratingKind: "skater_offense" },
  };
}

describe("player impact ratings", () => {
  it("builds TOI-shrunk skater and goalie ratings as of a snapshot date", () => {
    const result = buildPlayerImpactRatings({
      seasonId: 20252026,
      snapshotDate: "2026-01-03",
      skaterRows: [
        skaterRow(1, "2026-01-01", 1200, 5, 2),
        skaterRow(1, "2026-01-02", 1200, 5, 2),
        skaterRow(2, "2026-01-01", 120, 5, 2),
        skaterRow(3, "2026-01-01", 1200, 1, 6),
        skaterRow(4, "2026-01-04", 1200, 10, 1),
      ],
      goalieRows: [
        goalieRow(10, "2026-01-01", 3600, 1.5, 0.94),
        goalieRow(11, "2026-01-01", 3600, -1, 0.85),
        goalieRow(12, "2026-01-04", 3600, 5, 1),
      ],
      minSkaterToiSeconds: 600,
      minGoalieToiSeconds: 600,
    });

    expect(result.skaterOffenseRows.map((row) => row.player_id)).toEqual([
      1,
      2,
      3,
    ]);
    expect(result.skaterOffenseRows[0].rating_raw).toBeGreaterThan(
      result.skaterOffenseRows[1].rating_raw,
    );
    expect(result.skaterDefenseRows[0].player_id).toBe(1);
    expect(result.goalieRows.map((row) => row.player_id)).toEqual([10, 11]);
    expect(result.goalieRows[0].rating_0_to_100).toBe(100);
  });

  it("returns unique source dates inside a requested window", () => {
    expect(
      uniqueSnapshotDatesFromSources(
        [
          { player_id: 1, team_id: 1, date: "2026-01-01" },
          { player_id: 2, team_id: 2, date: "2026-01-03T00:00:00Z" },
          { player_id: 3, team_id: 3, date: "2026-01-03" },
          { player_id: 4, team_id: 4, date: "2026-01-04" },
        ],
        "2026-01-02",
        "2026-01-03",
      ),
    ).toEqual(["2026-01-03"]);
  });

  it("applies default season recency decay to player priors", () => {
    expect(defaultPlayerImpactSeasonDecayWeight(20252026, 20252026)).toBe(1);
    expect(defaultPlayerImpactSeasonDecayWeight(20252026, 20242025)).toBe(0.65);
    expect(defaultPlayerImpactSeasonDecayWeight(20252026, 20232024)).toBe(0.35);
    expect(defaultPlayerImpactSeasonDecayWeight(20252026, 20222023)).toBe(0.2);
    expect(defaultPlayerImpactSeasonDecayWeight(20252026, 20212022)).toBe(0);

    const decayed = buildSeasonDecayedPlayerImpactPriors({
      targetSeasonId: 20252026,
      snapshotDate: "2025-10-10",
      ratingRows: [
        ratingRow({
          playerId: 1,
          seasonId: 20252026,
          snapshotDate: "2025-10-10",
          ratingRaw: 0.5,
          rating0To100: 70,
          teamId: 22,
        }),
        ratingRow({
          playerId: 1,
          seasonId: 20242025,
          snapshotDate: "2025-04-17",
          ratingRaw: 1.5,
          rating0To100: 90,
          teamId: 21,
        }),
        ratingRow({
          playerId: 2,
          seasonId: 20252026,
          snapshotDate: "2025-10-10",
          ratingRaw: 0.7,
          rating0To100: 80,
        }),
        ratingRow({
          playerId: 3,
          seasonId: 20212022,
          snapshotDate: "2022-04-29",
          ratingRaw: 10,
          rating0To100: 100,
        }),
      ],
    });

    expect(decayed.map((row) => row.player_id)).toEqual([1, 2]);
    expect(decayed[0].rating_raw).toBeCloseTo(
      (0.5 * 1 + 1.5 * 0.65) / 1.65,
      5,
    );
    expect(decayed[0].team_id).toBe(22);
    expect(decayed[0].source_window).toBe("season_decayed");
    expect(decayed[0].metadata.seasonDecayVersion).toBeDefined();
  });
});

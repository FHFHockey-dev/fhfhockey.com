import { describe, expect, it, vi } from "vitest";

import {
  buildSkoSkaterStatsRow,
  hasFullSkoSourcePage,
  isTruthyQueryFlag,
  resolveSkaterIncrementalWindow,
  upsertSkoSkaterStats,
} from "../../../../../pages/api/v1/db/update-sko-stats";

describe("/api/v1/db/update-sko-stats helpers", () => {
  it("treats common full-refresh flags as truthy", () => {
    expect(isTruthyQueryFlag("1")).toBe(true);
    expect(isTruthyQueryFlag("true")).toBe(true);
    expect(isTruthyQueryFlag("full")).toBe(true);
    expect(isTruthyQueryFlag(["no", "yes"])).toBe(true);
    expect(isTruthyQueryFlag(undefined)).toBe(false);
  });

  it("starts from the season start when no current-season snapshot exists", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: null,
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: "2025-10-07",
      endDate: "2026-03-14",
      upToDate: false,
    });
  });

  it("resumes from the day after the latest stored snapshot", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-10",
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: "2026-03-11",
      endDate: "2026-03-14",
      upToDate: false,
    });
  });

  it("reports up-to-date when the latest stored snapshot already reaches the bounded end date", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-14",
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: null,
      endDate: "2026-03-14",
      upToDate: true,
    });
  });

  it("continues pagination while any source family returns a full page", () => {
    expect(hasFullSkoSourcePage([99, 100, 12], 100)).toBe(true);
    expect(hasFullSkoSourcePage([99, 42, 0], 100)).toBe(false);
  });

  it("maps one source snapshot to the exact 28-column live contract", () => {
    const row = buildSkoSkaterStatsRow({
      stat: {
        playerId: 8478402,
        skaterFullName: "Test Skater",
        positionCode: "C",
        gamesPlayed: 12,
        goals: 4,
        assists: 6,
        points: 10,
        shots: 20,
        shootingPct: 20,
      } as any,
      goalsForAgainstStat: {
        evenStrengthGoalsFor: 12,
        powerPlayGoalFor: 6,
        shortHandedGoalsFor: 2,
      } as any,
      powerPlayStat: { ppTimeOnIcePctPerGame: 25 } as any,
      puckPossessionStat: {
        onIceShootingPct: 11.5,
        zoneStartPct: 52,
      } as any,
      scoringRatesStat: {
        assists5v5: 3,
        assistsPer605v5: 1.2,
        primaryAssists5v5: 2,
        primaryAssistsPer605v5: 0.8,
        secondaryAssists5v5: 1,
        secondaryAssistsPer605v5: 0.4,
      } as any,
      scoringPerGameStat: {
        totalPrimaryAssists: 4,
        totalSecondaryAssists: 2,
      } as any,
      timeOnIceStat: { timeOnIce: 2400 } as any,
      formattedDate: "2026-03-14",
      seasonId: 20252026,
    });

    expect(Object.keys(row).sort()).toEqual(
      [
        "assists",
        "assists_5v5",
        "assists_per_60_5v5",
        "date",
        "es_goals_for",
        "games_played",
        "goals",
        "ipp",
        "on_ice_shooting_pct",
        "player_id",
        "player_name",
        "points",
        "position_code",
        "pp_goals_for",
        "pp_toi_pct_per_game",
        "primary_assists_5v5",
        "primary_assists_per_60_5v5",
        "season_id",
        "secondary_assists_5v5",
        "secondary_assists_per_60_5v5",
        "sh_goals_for",
        "shooting_percentage",
        "shots",
        "sog_per_60",
        "time_on_ice",
        "total_primary_assists",
        "total_secondary_assists",
        "zone_start_pct",
      ].sort(),
    );
    expect(row).toMatchObject({
      player_id: 8478402,
      date: "2026-03-14",
      season_id: 20252026,
      time_on_ice: 2400,
      ipp: 50,
      sog_per_60: 30,
    });
  });

  it("submits an exact mapped batch once and fails closed on upsert errors", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("schema mismatch") });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as any;
    const payload = [
      buildSkoSkaterStatsRow({
        stat: {
          playerId: 8478402,
          skaterFullName: "Test Skater",
          points: 0,
          shots: 0,
        } as any,
        formattedDate: "2026-03-14",
        seasonId: 20252026,
      }),
    ];

    await upsertSkoSkaterStats(client, payload);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenLastCalledWith(payload);

    await expect(upsertSkoSkaterStats(client, payload)).rejects.toThrow(
      "schema mismatch",
    );
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

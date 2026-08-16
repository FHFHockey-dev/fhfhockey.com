import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, fromMock, upsertMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  fromMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: { from: fromMock },
}));

vi.mock("lib/cors-fetch", () => ({
  default: fetchMock,
}));

import {
  fetchDataForGameType,
  processAndUpsertGameTypeData,
  type AllSkaterStats,
} from "../../../../../pages/api/v1/db/update-wgo-skaters";

function createSkaterData(gameId = 2025020001): AllSkaterStats {
  return {
    skaterStats: [
      {
        playerId: 8478402,
        skaterFullName: "Connor McDavid",
        shootsCatches: "L",
        positionCode: "C",
        gamesPlayed: 1,
        points: 2,
        pointsPerGame: 2,
        goals: 1,
        assists: 1,
        shots: 4,
        shootingPct: 0.25,
        plusMinus: 1,
        otGoals: 0,
        gameWinningGoals: 1,
        ppPoints: 1,
        faceoffWinPct: 0.55,
        timeOnIcePerGame: 20.5,
        teamAbbrev: "EDM",
        gameId,
        opponentTeamAbbrev: "CGY",
        homeRoad: "H",
        evGoals: 1,
        evPoints: 1,
      },
    ],
    skatersBio: [],
    miscSkaterStats: [],
    faceOffStats: [],
    faceoffWinLossStats: [],
    goalsForAgainstStats: [
      {
        gameId,
        playerId: 8478402,
        evenStrengthGoalDifference: 1,
        evenStrengthGoalsAgainst: 2,
        evenStrengthGoalsFor: 3,
        evenStrengthGoalsForPct: 0.6,
        evenStrengthTimeOnIcePerGame: 10.25,
        powerPlayGoalsAgainst: 0,
        powerPlayGoalFor: 1,
        powerPlayTimeOnIcePerGame: 2.5,
        shortHandedGoalsAgainst: 0,
        shortHandedGoalsFor: 0,
        shortHandedTimeOnIcePerGame: 1.25,
      },
    ],
    penaltiesStats: [],
    penaltyKillStats: [
      {
        gameId,
        playerId: 8478402,
        ppGoalsAgainstPer60: 0,
        shAssists: 0,
        shGoals: 0,
        shPoints: 0,
        shGoalsPer60: 0,
        shIndividualSatFor: 1,
        shIndividualSatForPer60: 1,
        shPointsPer60: 0,
        shPrimaryAssists: 0,
        shPrimaryAssistsPer60: 0,
        shSecondaryAssists: 0,
        shSecondaryAssistsPer60: 0,
        shShootingPct: 0,
        shShots: 1,
        shShotsPer60: 1,
        shTimeOnIce: 60,
        shTimeOnIcePctPerGame: 0.05,
      },
    ],
    powerPlayStats: [
      {
        gameId,
        playerId: 8478402,
        ppAssists: 1,
        ppGoals: 0,
        ppGoalsForPer60: 1,
        ppGoalsPer60: 0,
        ppIndividualSatFor: 2,
        ppIndividualSatForPer60: 2,
        ppPointsPer60: 1,
        ppPrimaryAssists: 1,
        ppPrimaryAssistsPer60: 1,
        ppSecondaryAssists: 0,
        ppSecondaryAssistsPer60: 0,
        ppShootingPct: 0,
        ppShots: 2,
        ppShotsPer60: 2,
        ppTimeOnIce: 120,
        ppTimeOnIcePctPerGame: 0.1,
      },
    ],
    puckPossessionStats: [
      {
        gameId,
        playerId: 8478402,
        goalsPct: 0.6,
        faceoffPct5v5: 0.55,
        individualSatForPer60: 10,
        individualShotsForPer60: 8,
        onIceShootingPct: 0.1,
        satPct: 0.58,
        timeOnIcePerGame5v5: 12.5,
        usatPct: 0.57,
        offensiveZoneStartRatio: 0.52,
      },
    ],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [
      {
        gameId,
        playerId: 8478402,
        goalsBackhand: 0,
        goalsBat: 0,
        goalsBetweenLegs: 0,
        goalsCradle: 0,
        goalsDeflected: 0,
        goalsPoke: 0,
        goalsSlap: 1,
        goalsSnap: 0,
        goalsTipIn: 0,
        goalsWrapAround: 0,
        goalsWrist: 0,
        shootingPctBackhand: 0,
        shootingPctBat: 0,
        shootingPctBetweenLegs: 0,
        shootingPctCradle: 0,
        shootingPctDeflected: 0,
        shootingPctPoke: 0,
        shootingPctSlap: 0.125,
        shootingPctSnap: 0,
        shootingPctTipIn: 0,
        shootingPctWrapAround: 0,
        shootingPctWrist: 0,
        shotsOnNetBackhand: 0,
        shotsOnNetBat: 0,
        shotsOnNetBetweenLegs: 0,
        shotsOnNetCradle: 0,
        shotsOnNetDeflected: 0,
        shotsOnNetPoke: 0,
        shotsOnNetSlap: 8,
        shotsOnNetSnap: 0,
        shotsOnNetTipIn: 0,
        shotsOnNetWrapAround: 0,
        shotsOnNetWrist: 0,
      },
    ],
    timeOnIceStats: [
      {
        gameId,
        playerId: 8478402,
        evTimeOnIce: 900,
        evTimeOnIcePerGame: 900,
        otTimeOnIce: 30,
        otTimeOnIcePerOtGame: 30,
        shifts: 20,
        shiftsPerGame: 20,
        timeOnIcePerShift: 45,
      },
    ],
  };
}

describe("WGO skater generated insert contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      json: async () => ({ data: [], total: 0 }),
    });
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });
  });

  it("fetches a complete date window without 100-row pagination", async () => {
    await expect(
      fetchDataForGameType(2, "2026-01-18", -1, "2026-01-12"),
    ).resolves.toEqual(
      expect.objectContaining({
        skaterStats: [],
        timeOnIceStats: [],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(16);
    for (const [url] of fetchMock.mock.calls) {
      const decodedUrl = decodeURIComponent(String(url));
      expect(decodedUrl).toContain("limit=-1");
      expect(decodedUrl).toContain('gameDate>="2026-01-12"');
      expect(decodedUrl).toContain('gameDate<="2026-01-18 23:59:59"');
    }
  });

  it("rejects an incomplete unbounded NHL response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      json: async () => ({ data: [{}], total: 2 }),
    });

    await expect(
      fetchDataForGameType(2, "2026-01-18", -1, "2026-01-12"),
    ).rejects.toThrow("returned 1/2");
  });

  it("writes numeric time fields through the regular-season table contract", async () => {
    await expect(
      processAndUpsertGameTypeData(
        createSkaterData(),
        "wgo_skater_stats",
        "2025-10-08",
        20252026,
      ),
    ).resolves.toBe(1);

    expect(fromMock).toHaveBeenCalledWith("wgo_skater_stats");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_id: 8478402,
          season_id: 20252026,
          game_id: 2025020001,
          es_toi_per_game: 10.25,
          ev_time_on_ice: 900,
          ot_time_on_ice: 30,
          pp_toi: 120,
          sh_time_on_ice: 60,
          time_on_ice_per_shift: 45,
          toi_per_game_5v5: 12.5,
          zone_start_pct: 0.52,
          shooting_pct_slap: 0.125,
        }),
      ],
      { onConflict: "player_id, date" },
    );
  });

  it("normalizes time fields to text through the playoff table contract", async () => {
    await expect(
      processAndUpsertGameTypeData(
        createSkaterData(2025030001),
        "wgo_skater_stats_playoffs",
        "2026-05-01",
        20252026,
      ),
    ).resolves.toBe(1);

    expect(fromMock).toHaveBeenCalledWith("wgo_skater_stats_playoffs");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_id: 8478402,
          season_id: 20252026,
          game_id: 2025030001,
          es_toi_per_game: "10.25",
          ev_time_on_ice: "900",
          ot_time_on_ice: "30",
          pp_toi: "120",
          sh_time_on_ice: "60",
          time_on_ice_per_shift: "45",
          toi_per_game_5v5: "12.5",
        }),
      ],
      { onConflict: "player_id, date" },
    );
  });
});

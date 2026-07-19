import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: { from: fromMock },
}));

import {
  processAndUpsertGameTypeData,
  type AllSkaterStats,
} from "../../../../../pages/api/v1/db/update-wgo-skaters";

function createSkaterData(): AllSkaterStats {
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
        gameId: 2025020001,
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
        playerId: 8478402,
        goalsPct: 0.6,
        faceoffPct5v5: 0.55,
        individualSatForPer60: 10,
        individualShotsForPer60: 8,
        onIceShootingPct: 0.1,
        satPct: 0.58,
        timeOnIcePerGame5v5: 12.5,
        usatPct: 0.57,
        zoneStartPct: 0.52,
      },
    ],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [],
    timeOnIceStats: [
      {
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
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });
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
          es_toi_per_game: 10.25,
          ev_time_on_ice: 900,
          ot_time_on_ice: 30,
          pp_toi: 120,
          sh_time_on_ice: 60,
          time_on_ice_per_shift: 45,
          toi_per_game_5v5: 12.5,
        }),
      ],
      { onConflict: "player_id, date" },
    );
  });

  it("normalizes time fields to text through the playoff table contract", async () => {
    await expect(
      processAndUpsertGameTypeData(
        createSkaterData(),
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

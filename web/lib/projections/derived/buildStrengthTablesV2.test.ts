import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  state,
  playerDeleteEqMock,
  playerUpsertMock,
  teamDeleteEqMock,
  teamUpsertMock,
} = vi.hoisted(() => {
  const state = {
    shifts: [] as any[],
    rawShifts: [] as any[],
    plays: [] as any[],
    playerStrengthRows: [] as any[],
    pbpGame: null as any,
    playerDeleteError: null as Error | null,
    teamDeleteError: null as Error | null,
  };
  return {
    state,
    playerDeleteEqMock: vi.fn(async () => ({
      error: state.playerDeleteError,
    })),
    playerUpsertMock: vi.fn().mockResolvedValue({ error: null }),
    teamDeleteEqMock: vi.fn(async () => ({ error: state.teamDeleteError })),
    teamUpsertMock: vi.fn().mockResolvedValue({ error: null }),
  };
});

const game = {
  id: 2025020001,
  date: "2025-10-07",
  homeTeamId: 1,
  awayTeamId: 2,
};

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      const query: any = {
        select: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: table === "pbp_games" ? state.pbpGame : null,
          error: null,
        })),
        range: vi.fn(async () => {
          if (table === "games") return { data: [game], error: null };
          if (table === "shift_charts") {
            return { data: state.shifts, error: null };
          }
          if (table === "nhl_api_shift_rows") {
            return { data: state.rawShifts, error: null };
          }
          if (table === "pbp_plays") {
            return { data: state.plays, error: null };
          }
          if (table === "forge_player_game_strength") {
            return { data: state.playerStrengthRows, error: null };
          }
          return { data: [], error: null };
        }),
        delete: vi.fn(() => ({
          eq:
            table === "forge_team_game_strength"
              ? teamDeleteEqMock
              : playerDeleteEqMock,
        })),
        upsert:
          table === "forge_team_game_strength"
            ? teamUpsertMock
            : playerUpsertMock,
      };
      return query;
    }),
  },
}));

import {
  buildPlayerGameStrengthV2ForDateRange,
  buildTeamGameStrengthV2ForDateRange,
} from "./buildStrengthTablesV2";

function completeShiftRows() {
  return [
    ...Array.from({ length: 5 }, (_, index) => ({
      playerId: 10 + index,
      teamId: 1,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      playerId: 20 + index,
      teamId: 2,
    })),
  ].map(({ playerId, teamId }, index) => {
    const home = teamId === 1;
    return {
      id: index + 1,
      game_id: game.id,
      player_id: playerId,
      team_id: teamId,
      opponent_team_id: home ? 2 : 1,
      season_id: 20252026,
      game_date: game.date,
      game_type: "2",
      home_or_away: home ? "home" : "away",
      team_abbreviation: home ? "AAA" : "BBB",
      opponent_team_abbreviation: home ? "BBB" : "AAA",
      total_es_toi: home ? "10:00" : "11:00",
      total_pp_toi: home ? "0:00" : "1:00",
      total_pk_toi: home ? "1:00" : "0:00",
    };
  });
}

function completeRawShiftRows() {
  return completeShiftRows().map((row) => ({
    shift_id: row.id,
    game_id: row.game_id,
    player_id: row.player_id,
    team_id: row.team_id,
  }));
}

function completePlayerStrengthRows() {
  return completeShiftRows().map((row) => ({
    game_id: game.id,
    player_id: row.player_id,
    team_id: row.team_id,
    opponent_team_id: row.opponent_team_id,
    game_date: game.date,
    toi_es_seconds: 600,
    toi_pp_seconds: 0,
    toi_pk_seconds: 0,
    shots_es: 0,
    shots_pp: 0,
    shots_pk: 0,
    goals_es: 0,
    goals_pp: 0,
    goals_pk: 0,
  }));
}

function completePlay() {
  return {
    id: 1,
    gameid: game.id,
    situationcode: "1551",
    typedesckey: "shot-on-goal",
    eventownerteamid: 1,
    shootingplayerid: 10,
    scoringplayerid: null,
    assist1playerid: null,
    assist2playerid: null,
  };
}

function completeGameEndPlay() {
  return {
    id: 2,
    gameid: game.id,
    situationcode: null,
    typedesckey: "game-end",
    eventownerteamid: null,
    shootingplayerid: null,
    scoringplayerid: null,
    assist1playerid: null,
    assist2playerid: null,
  };
}

function completePbpGame() {
  return {
    id: game.id,
    date: game.date,
    hometeamid: game.homeTeamId,
    awayteamid: game.awayTeamId,
    type: 2,
    season: "20252026",
    hometeamabbrev: "AAA",
    awayteamabbrev: "BBB",
    hometeamscore: 2,
    awayteamscore: 1,
  };
}

describe("derived strength fail-closed contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.shifts = completeShiftRows();
    state.rawShifts = completeRawShiftRows();
    state.plays = [completePlay(), completeGameEndPlay()];
    state.playerStrengthRows = [];
    state.pbpGame = completePbpGame();
    state.playerDeleteError = null;
    state.teamDeleteError = null;
  });

  it("rejects a partial strength game before any player upsert", async () => {
    state.shifts[0] = { ...state.shifts[0], total_pk_toi: null };

    await expect(
      buildPlayerGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).rejects.toThrow("Shift-strength rows are partial");
    expect(teamDeleteEqMock).toHaveBeenCalledWith("game_id", game.id);
    expect(playerDeleteEqMock).toHaveBeenCalledWith("game_id", game.id);
    expect(playerUpsertMock).not.toHaveBeenCalled();
  });

  it("stops before source materialization when exact-scope invalidation fails", async () => {
    state.teamDeleteError = new Error("team scope delete failed");

    await expect(
      buildPlayerGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).rejects.toThrow("team scope delete failed");
    expect(playerDeleteEqMock).not.toHaveBeenCalled();
    expect(playerUpsertMock).not.toHaveBeenCalled();
    expect(teamUpsertMock).not.toHaveBeenCalled();
  });

  it("rejects empty PBP instead of materializing zero counting stats", async () => {
    state.plays = [];

    await expect(
      buildPlayerGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).rejects.toThrow("PBP evidence is incomplete");
    expect(playerUpsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["malformed", "bad"],
  ])(
    "rejects a %s situation on a countable event while allowing null game-end metadata",
    async (_label, situationcode) => {
      state.plays = [
        { ...completePlay(), situationcode },
        completeGameEndPlay(),
      ];

      await expect(
        buildPlayerGameStrengthV2ForDateRange({
          startDate: game.date,
          endDate: game.date,
        }),
      ).rejects.toThrow("Countable PBP event is incomplete");
      expect(playerUpsertMock).not.toHaveBeenCalled();
    },
  );

  it("preserves valid zero strength clocks as numeric zero", async () => {
    await expect(
      buildPlayerGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).resolves.toEqual({ gamesProcessed: 1, rowsUpserted: 10 });

    expect(playerUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 10,
          toi_pp_seconds: 0,
          toi_pk_seconds: 60,
        }),
      ]),
      { onConflict: "game_id,player_id" },
    );
  });

  it("rejects nullable player metrics before team aggregation", async () => {
    state.playerStrengthRows = completePlayerStrengthRows();
    state.playerStrengthRows[0] = {
      ...state.playerStrengthRows[0],
      toi_es_seconds: null,
    };

    await expect(
      buildTeamGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).rejects.toThrow("Incomplete ES TOI player-strength metric");
    expect(teamDeleteEqMock).toHaveBeenCalledWith("game_id", game.id);
    expect(teamUpsertMock).not.toHaveBeenCalled();
  });

  it("rejects stale extra derived players before team aggregation", async () => {
    state.playerStrengthRows = completePlayerStrengthRows();
    state.playerStrengthRows.push({
      ...state.playerStrengthRows[0],
      player_id: 999,
    });

    await expect(
      buildTeamGameStrengthV2ForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).rejects.toThrow("Stale player-strength player set");
    expect(teamUpsertMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, mutationMock, orMock } = vi.hoisted(() => ({
  state: {
    games: [] as any[],
    shifts: [] as any[],
    rawShifts: [] as any[],
    plays: [] as any[],
    pbpGame: null as any,
  },
  mutationMock: vi.fn(),
  orMock: vi.fn(),
}));

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
        or: vi.fn((filter: string) => {
          orMock(filter);
          return query;
        }),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: table === "pbp_games" ? state.pbpGame : null,
          error: null,
        })),
        range: vi.fn(async () => {
          if (table === "games") return { data: state.games, error: null };
          if (table === "shift_charts") {
            return { data: state.shifts, error: null };
          }
          if (table === "nhl_api_shift_rows") {
            return { data: state.rawShifts, error: null };
          }
          if (table === "pbp_plays") {
            return { data: state.plays, error: null };
          }
          return { data: [], error: null };
        }),
        delete: mutationMock,
        insert: mutationMock,
        update: mutationMock,
        upsert: mutationMock,
      };
      return query;
    }),
  },
}));

import {
  fetchProjectionDerivedGamesForDateRange,
  preparePlayerGameStrengthV2,
  prepareTeamGameStrengthV2,
  type ProjectionPlayerStrengthRow,
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
    goalieinnetid: 20,
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
    goalieinnetid: null,
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

describe("derived strength preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.games = [game];
    state.shifts = completeShiftRows();
    state.rawShifts = completeRawShiftRows();
    state.plays = [completePlay(), completeGameEndPlay()];
    state.pbpGame = completePbpGame();
  });

  it("discovers games with bounded paginated reads", async () => {
    await expect(
      fetchProjectionDerivedGamesForDateRange({
        startDate: game.date,
        endDate: game.date,
      }),
    ).resolves.toEqual([game]);
  });

  it("rejects a partial strength source without any pre-delete or upsert", async () => {
    state.shifts[0] = { ...state.shifts[0], total_pk_toi: null };
    await expect(preparePlayerGameStrengthV2({ game })).rejects.toThrow(
      "Shift-strength rows are partial",
    );
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete PBP instead of preparing zero counting stats", async () => {
    state.plays = [];
    await expect(preparePlayerGameStrengthV2({ game })).rejects.toThrow(
      "PBP evidence is incomplete",
    );
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects malformed situation metadata on a countable event", async () => {
    state.plays = [
      { ...completePlay(), situationcode: "bad" },
      completeGameEndPlay(),
    ];
    await expect(preparePlayerGameStrengthV2({ game })).rejects.toThrow(
      "Countable PBP event is incomplete",
    );
  });

  it("prepares deterministic player rows without mutating derived tables", async () => {
    const result = await preparePlayerGameStrengthV2({ game });
    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.player_id)).toEqual([
      10, 11, 12, 13, 14, 20, 21, 22, 23, 24,
    ]);
    expect(result.rows[0]).toMatchObject({
      game_id: game.id,
      player_id: 10,
      toi_es_seconds: 600,
      toi_pp_seconds: 0,
      toi_pk_seconds: 60,
      shots_es: 1,
    });
    expect(mutationMock).not.toHaveBeenCalled();
    expect(orMock).toHaveBeenCalledWith(
      "total_es_toi.not.is.null,total_pp_toi.not.is.null,total_pk_toi.not.is.null",
    );
  });

  it("reduces the prepared player scope into exactly two team rows", async () => {
    const player = await preparePlayerGameStrengthV2({ game });
    const teams = prepareTeamGameStrengthV2({
      game,
      playerRows: player.rows,
    });
    expect(teams).toHaveLength(2);
    expect(teams).toEqual([
      expect.objectContaining({
        team_id: 1,
        opponent_team_id: 2,
        shots_es: 1,
      }),
      expect.objectContaining({
        team_id: 2,
        opponent_team_id: 1,
        shots_es: 0,
      }),
    ]);
  });

  it("fails team preparation on a stale or duplicate player identity", async () => {
    const player = await preparePlayerGameStrengthV2({ game });
    const duplicate = {
      ...player.rows[0],
      team_id: 2,
      opponent_team_id: 1,
    } as ProjectionPlayerStrengthRow;
    expect(() =>
      prepareTeamGameStrengthV2({
        game,
        playerRows: [...player.rows, duplicate],
      }),
    ).toThrow("Invalid player-strength identity");
  });
});

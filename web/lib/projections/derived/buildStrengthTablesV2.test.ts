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
    periodnumber: 1,
    periodtype: "REG",
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
    periodnumber: 3,
    periodtype: "REG",
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

  it("rejects a countable event without a period number", async () => {
    state.plays = [
      { ...completePlay(), periodnumber: null },
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

  describe("EDM power-play regressions (RESULTS.md section 7)", () => {
    // Event shapes come from the 2026-11-07 data-checks diagnosis: the three EDM
    // games where forge disagreed with skatersGameStats. NHL counts none of these
    // events as power-play scoring, so McDavid and Draisaitl must show 0 PPG/PPA.
    const EDM = 22;
    const OPP = 99;
    const MCDAVID = 8478402;
    const DRAISAITL = 8477934;

    function setEdmGame(id: number, plays: any[]) {
      const edmGame = {
        id,
        date: "2026-11-01",
        homeTeamId: EDM,
        awayTeamId: OPP,
      };
      const skaters = [
        ...[MCDAVID, DRAISAITL, 101, 102, 103].map((playerId) => ({
          playerId,
          teamId: EDM,
        })),
        ...[201, 202, 203, 204, 205].map((playerId) => ({
          playerId,
          teamId: OPP,
        })),
      ];
      state.shifts = skaters.map(({ playerId, teamId }, index) => {
        const home = teamId === EDM;
        return {
          ...completeShiftRows()[0],
          id: index + 1,
          game_id: id,
          player_id: playerId,
          team_id: teamId,
          opponent_team_id: home ? OPP : EDM,
          season_id: 20262027,
          game_date: edmGame.date,
          home_or_away: home ? "home" : "away",
          team_abbreviation: home ? "EDM" : "OPP",
          opponent_team_abbreviation: home ? "OPP" : "EDM",
          total_pp_toi: home ? "2:30" : "0:00",
        };
      });
      state.rawShifts = state.shifts.map((row) => ({
        shift_id: row.id,
        game_id: id,
        player_id: row.player_id,
        team_id: row.team_id,
      }));
      state.plays = [
        ...plays.map((play, index) => ({
          ...completePlay(),
          id: index + 1,
          gameid: id,
          eventownerteamid: EDM,
          goalieinnetid: null,
          ...play,
        })),
        { ...completeGameEndPlay(), id: plays.length + 1, gameid: id },
      ];
      state.pbpGame = {
        ...completePbpGame(),
        id,
        date: edmGame.date,
        hometeamid: EDM,
        awayteamid: OPP,
        season: "20262027",
        hometeamabbrev: "EDM",
        awayteamabbrev: "OPP",
      };
      return edmGame;
    }

    async function rowFor(edmGame: any, playerId: number) {
      const { rows } = await preparePlayerGameStrengthV2({ game: edmGame });
      return rows.find((row) => row.player_id === playerId)!;
    }

    it("2026020163: McDavid's 6v5 extra-attacker goal (1560) is even strength", async () => {
      const edmGame = setEdmGame(2026020163, [
        {
          typedesckey: "goal",
          periodnumber: 3,
          situationcode: "1560",
          shootingplayerid: null,
          scoringplayerid: MCDAVID,
        },
      ]);
      expect(await rowFor(edmGame, MCDAVID)).toMatchObject({
        goals_es: 1,
        goals_pp: 0,
        shots_es: 1,
        shots_pp: 0,
        toi_pp_seconds: 150,
      });
    });

    it("2026020239: McDavid's shootout goal (period 5, 0101) is not counted anywhere", async () => {
      const edmGame = setEdmGame(2026020239, [
        {
          typedesckey: "goal",
          periodnumber: 5,
          periodtype: "SO",
          situationcode: "0101",
          shootingplayerid: null,
          scoringplayerid: MCDAVID,
          goalieinnetid: 300,
        },
        {
          typedesckey: "shot-on-goal",
          periodnumber: 5,
          periodtype: null,
          situationcode: "0101",
          shootingplayerid: DRAISAITL,
          goalieinnetid: 300,
        },
      ]);
      const { rows } = await preparePlayerGameStrengthV2({ game: edmGame });
      for (const row of rows) {
        expect(
          row.shots_es + row.shots_pp + row.shots_pk,
        ).toBe(0);
        expect(row.goals_es + row.goals_pp + row.goals_pk).toBe(0);
      }
    });

    describe("penalty shots: all-situations only (decision 149, Astra AF-07)", () => {
      // Shapes from the stored 2026-27 play-by-play: a penalty-shot goal has a
      // scorer and no shooter id; a penalty-shot save has a shooter.
      const plays = [
        {
          // 2026020065-style home penalty-shot goal (EDM is home: 1010).
          typedesckey: "goal",
          periodnumber: 2,
          situationcode: "1010",
          shootingplayerid: null,
          scoringplayerid: MCDAVID,
          goalieinnetid: 300,
        },
        {
          // Away penalty-shot save (0101).
          typedesckey: "shot-on-goal",
          periodnumber: 2,
          situationcode: "0101",
          eventownerteamid: OPP,
          shootingplayerid: 201,
          goalieinnetid: 400,
        },
        {
          // Home penalty-shot miss: not a shot on goal, counts nowhere.
          typedesckey: "missed-shot",
          periodnumber: 2,
          situationcode: "1010",
          shootingplayerid: DRAISAITL,
          goalieinnetid: 300,
        },
        {
          // Shootout goal with the same code: excluded before classification.
          typedesckey: "goal",
          periodnumber: 5,
          periodtype: "SO",
          situationcode: "1010",
          shootingplayerid: null,
          scoringplayerid: DRAISAITL,
          goalieinnetid: 300,
        },
        {
          // Control: an ordinary 5v5 shot stays ES.
          typedesckey: "shot-on-goal",
          periodnumber: 1,
          situationcode: "1551",
          shootingplayerid: DRAISAITL,
          goalieinnetid: 300,
        },
      ];

      it("counts a penalty-shot goal and save only in PS, and a miss or shootout attempt nowhere", async () => {
        const edmGame = setEdmGame(2026020065, plays);
        const { rows } = await preparePlayerGameStrengthV2({ game: edmGame });
        const byId = new Map(rows.map((row) => [row.player_id, row]));
        expect(byId.get(MCDAVID)).toMatchObject({
          shots_es: 0,
          shots_pp: 0,
          shots_pk: 0,
          goals_es: 0,
          goals_pp: 0,
          goals_pk: 0,
          shots_ps: 1,
          goals_ps: 1,
          penalty_shot_split_version: 1,
        });
        expect(byId.get(201)).toMatchObject({
          shots_es: 0,
          shots_ps: 1,
          goals_ps: 0,
        });
        // The 5v5 shot is ES; the miss and the shootout goal count nowhere.
        expect(byId.get(DRAISAITL)).toMatchObject({
          shots_es: 1,
          goals_es: 0,
          shots_ps: 0,
          goals_ps: 0,
        });
        for (const row of rows) {
          expect(row.penalty_shot_split_version).toBe(1);
          expect(row.assists_es + row.assists_pp + row.assists_pk).toBe(0);
        }

        const teams = prepareTeamGameStrengthV2({ game: edmGame, playerRows: rows });
        const allSituation = (team: (typeof teams)[number]) => ({
          shots: team.shots_es + team.shots_pp + team.shots_pk + team.shots_ps,
          goals: team.goals_es + team.goals_pp + team.goals_pk + team.goals_ps,
        });
        const edm = teams.find((team) => team.team_id === EDM)!;
        const opp = teams.find((team) => team.team_id === OPP)!;
        expect(edm).toMatchObject({ shots_es: 1, shots_ps: 1, goals_ps: 1 });
        expect(opp).toMatchObject({ shots_es: 0, shots_ps: 1, goals_ps: 0 });
        // Official totals: a scored penalty shot is 1 goal and 1 shot, a saved
        // one is 1 shot, a miss and a shootout attempt are neither.
        expect(allSituation(edm)).toEqual({ shots: 2, goals: 1 });
        expect(allSituation(opp)).toEqual({ shots: 1, goals: 0 });
      });

      it("refuses an assisted penalty-shot goal (the NHL awards none)", async () => {
        const edmGame = setEdmGame(2026020131, [
          { ...plays[0], assist1playerid: DRAISAITL },
        ]);
        await expect(
          preparePlayerGameStrengthV2({ game: edmGame }),
        ).rejects.toThrow("Penalty-shot goal carries an assist");
      });

      it("refuses team aggregation of a row without the split marker", async () => {
        const edmGame = setEdmGame(2026020065, plays);
        const { rows } = await preparePlayerGameStrengthV2({ game: edmGame });
        const legacy = { ...rows[0], penalty_shot_split_version: null };
        expect(() =>
          prepareTeamGameStrengthV2({
            game: edmGame,
            playerRows: [legacy as unknown as ProjectionPlayerStrengthRow, ...rows.slice(1)],
          }),
        ).toThrow("not penalty-shot split");
      });
    });

    it("2026020260: Draisaitl's 1560 goal and McDavid's assist are even strength; a real 5v4 stays PP", async () => {
      const edmGame = setEdmGame(2026020260, [
        {
          typedesckey: "goal",
          periodnumber: 3,
          situationcode: "1560",
          shootingplayerid: null,
          scoringplayerid: DRAISAITL,
          assist1playerid: MCDAVID,
        },
        {
          // Synthetic control: EDM at home 5v4 with both goalies in.
          typedesckey: "goal",
          periodnumber: 2,
          situationcode: "1451",
          shootingplayerid: null,
          scoringplayerid: DRAISAITL,
          assist1playerid: MCDAVID,
          goalieinnetid: 300,
        },
      ]);
      expect(await rowFor(edmGame, DRAISAITL)).toMatchObject({
        goals_es: 1,
        goals_pp: 1,
      });
      expect(await rowFor(edmGame, MCDAVID)).toMatchObject({
        assists_es: 1,
        assists_pp: 1,
      });
      const { rows } = await preparePlayerGameStrengthV2({ game: edmGame });
      const teams = prepareTeamGameStrengthV2({ game: edmGame, playerRows: rows });
      expect(teams.find((team) => team.team_id === EDM)).toMatchObject({
        goals_es: 1,
        goals_pp: 1,
        toi_pp_seconds: 750,
      });
    });
  });
});

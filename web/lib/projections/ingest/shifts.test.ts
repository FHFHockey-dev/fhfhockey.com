import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const state = {
    invalidateError: null as Error | null,
    upsertError: null as Error | null,
  };
  const invalidateEq = vi.fn(async () => ({ error: state.invalidateError }));
  const update = vi.fn(() => ({ eq: invalidateEq }));
  const upsert = vi.fn(async () => ({ error: state.upsertError }));
  const from = vi.fn(() => ({ update, upsert }));
  return { state, invalidateEq, update, upsert, from };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: db.from },
}));

import {
  buildShiftStrengthUpserts,
  replaceShiftStrengthRowsForGame,
  type NhleShiftRow,
} from "./shifts";

const GAME_ID = 2025020001;

type TestPbp = Parameters<typeof buildShiftStrengthUpserts>[1];
type TestPlay = TestPbp["plays"][number];

function play(args: {
  eventId: number;
  typeDescKey: string;
  timeInPeriod: string;
  timeRemaining: string;
  situationCode?: string;
  sortOrder?: number;
  period?: number;
  periodType?: string;
}): TestPlay {
  return {
    eventId: args.eventId,
    typeDescKey: args.typeDescKey,
    periodDescriptor: {
      number: args.period ?? 1,
      periodType: args.periodType ?? "REG",
    },
    timeInPeriod: args.timeInPeriod,
    timeRemaining: args.timeRemaining,
    situationCode: args.situationCode ?? "1551",
    sortOrder: args.sortOrder,
  };
}

function finalPbp(
  overrides: Partial<TestPbp> = {},
  plays: TestPlay[] = [
    play({
      eventId: 1,
      typeDescKey: "period-start",
      timeInPeriod: "00:00",
      timeRemaining: "20:00",
    }),
    play({
      eventId: 2,
      typeDescKey: "game-end",
      timeInPeriod: "20:00",
      timeRemaining: "00:00",
    }),
  ],
): TestPbp {
  return {
    id: GAME_ID,
    season: 20252026,
    gameType: 2,
    gameState: "OFF",
    gameDate: "2025-10-07",
    startTimeUTC: "2025-10-07T23:00:00Z",
    awayTeam: {
      id: 2,
      abbrev: "BBB",
      commonName: { default: "B" },
      score: 1,
    },
    homeTeam: {
      id: 1,
      abbrev: "AAA",
      commonName: { default: "A" },
      score: 2,
    },
    plays,
    ...overrides,
  };
}

function shift(overrides: Partial<NhleShiftRow> = {}): NhleShiftRow {
  return {
    gameId: GAME_ID,
    playerId: 10,
    teamId: 1,
    teamAbbrev: "AAA",
    firstName: "Home",
    lastName: "Player",
    period: 1,
    startTime: "0:00",
    endTime: "0:30",
    duration: "0:30",
    typeCode: 517,
    ...overrides,
  };
}

function awayShift(overrides: Partial<NhleShiftRow> = {}): NhleShiftRow {
  return shift({
    playerId: 20,
    teamId: 2,
    teamAbbrev: "BBB",
    firstName: "Away",
    ...overrides,
  });
}

function bothTeams(homeOverrides: Partial<NhleShiftRow> = {}): NhleShiftRow[] {
  return [shift(homeOverrides), awayShift()];
}

describe("projection shift strength ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.state.invalidateError = null;
    db.state.upsertError = null;
  });

  it("uses only interval rows and assigns every interval second to ES/PP/PK", () => {
    const pbp = finalPbp({}, [
      play({
        eventId: 1,
        typeDescKey: "period-start",
        timeInPeriod: "00:00",
        timeRemaining: "20:00",
      }),
      play({
        eventId: 2,
        typeDescKey: "penalty",
        timeInPeriod: "00:30",
        timeRemaining: "19:30",
        situationCode: "1451",
      }),
      play({
        eventId: 3,
        typeDescKey: "faceoff",
        timeInPeriod: "01:00",
        timeRemaining: "19:00",
      }),
      play({
        eventId: 4,
        typeDescKey: "game-end",
        timeInPeriod: "20:00",
        timeRemaining: "00:00",
      }),
    ]);
    const nonIntervalGoalMarker = shift({
      playerId: 0,
      teamId: 999,
      teamAbbrev: "",
      firstName: "",
      lastName: "",
      startTime: "00:30",
      endTime: "00:30",
      duration: null,
      typeCode: 505,
    });

    const rows = buildShiftStrengthUpserts(
      GAME_ID,
      pbp,
      [
        shift({ endTime: "1:30", duration: "1:30" }),
        awayShift({ endTime: "1:30", duration: "1:30" }),
        nonIntervalGoalMarker,
      ],
      "2026-07-19T00:00:00.000Z",
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.player_id === 10)).toMatchObject({
      game_id: GAME_ID,
      game_type: "2",
      season_id: 20252026,
      team_id: 1,
      opponent_team_id: 2,
      home_or_away: "home",
      total_es_toi: "1:00",
      total_pp_toi: "0:30",
      total_pk_toi: "0:00",
    });
    expect(rows.find((row) => row.player_id === 20)).toMatchObject({
      total_es_toi: "1:00",
      total_pp_toi: "0:00",
      total_pk_toi: "0:30",
    });
    for (const row of rows) {
      expect(row).not.toHaveProperty("line_combination");
      expect(row).not.toHaveProperty("pairing_combination");
      expect(row).not.toHaveProperty("time_spent_with");
      expect(row).not.toHaveProperty("game_length");
    }
  });

  it("uses canonical sort order for same-timestamp situation transitions", () => {
    const pbp = finalPbp({}, [
      play({
        eventId: 1,
        typeDescKey: "period-start",
        timeInPeriod: "00:00",
        timeRemaining: "20:00",
        sortOrder: 1,
      }),
      // Deliberately reverse source order: sortOrder 3 must own the following
      // interval even though sortOrder 2 appears later in the payload.
      play({
        eventId: 3,
        typeDescKey: "faceoff",
        timeInPeriod: "00:30",
        timeRemaining: "19:30",
        situationCode: "1551",
        sortOrder: 3,
      }),
      play({
        eventId: 2,
        typeDescKey: "penalty",
        timeInPeriod: "00:30",
        timeRemaining: "19:30",
        situationCode: "1451",
        sortOrder: 2,
      }),
      play({
        eventId: 4,
        typeDescKey: "game-end",
        timeInPeriod: "20:00",
        timeRemaining: "00:00",
        sortOrder: 4,
      }),
    ]);

    const rows = buildShiftStrengthUpserts(GAME_ID, pbp, [
      shift({ startTime: "0:30", endTime: "1:00", duration: "0:30" }),
      awayShift({
        startTime: "0:30",
        endTime: "1:00",
        duration: "0:30",
      }),
    ]);

    expect(rows.map((row) => row.total_es_toi)).toEqual(["0:30", "0:30"]);
    expect(rows.map((row) => row.total_pp_toi)).toEqual(["0:00", "0:00"]);
    expect(rows.map((row) => row.total_pk_toi)).toEqual(["0:00", "0:00"]);
  });

  it("rejects payloads with no type-517 interval rows", () => {
    expect(() =>
      buildShiftStrengthUpserts(GAME_ID, finalPbp(), [
        shift({
          startTime: "10:00",
          endTime: "10:00",
          duration: null,
          typeCode: 505,
        }),
      ]),
    ).toThrow("No NHL shift interval rows");
  });

  it("fails closed on malformed clocks and one-team source coverage", () => {
    expect(() =>
      buildShiftStrengthUpserts(
        GAME_ID,
        finalPbp(),
        bothTeams({ duration: "bad" }),
      ),
    ).toThrow("Invalid duration shift clock");

    expect(() =>
      buildShiftStrengthUpserts(GAME_ID, finalPbp(), [shift()]),
    ).toThrow("do not cover both teams");
  });

  it("accumulates consecutive shifts but rejects contradictory player metadata", () => {
    const rows = buildShiftStrengthUpserts(GAME_ID, finalPbp(), [
      shift(),
      shift({ startTime: "0:30", endTime: "1:00" }),
      awayShift(),
    ]);
    expect(rows.find((row) => row.player_id === 10)?.total_es_toi).toBe("1:00");

    expect(() =>
      buildShiftStrengthUpserts(GAME_ID, finalPbp(), [
        shift(),
        shift({ firstName: "Different" }),
        awayShift(),
      ]),
    ).toThrow("Contradictory NHL shift metadata");
  });

  it.each([
    {
      name: "malformed elapsed clock",
      plays: [
        {
          ...play({
            eventId: 1,
            typeDescKey: "period-start",
            timeInPeriod: "00:00",
            timeRemaining: "20:00",
          }),
          timeInPeriod: "bad",
        },
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Invalid PBP timeInPeriod clock/,
    },
    {
      name: "malformed remaining clock",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:0",
        }),
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Invalid PBP timeRemaining clock/,
    },
    {
      name: "inconsistent nominal period length",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "faceoff",
          timeInPeriod: "01:00",
          timeRemaining: "18:00",
        }),
        play({
          eventId: 3,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Inconsistent PBP period length/,
    },
    {
      name: "missing situation code",
      plays: [
        {
          ...play({
            eventId: 1,
            typeDescKey: "period-start",
            timeInPeriod: "00:00",
            timeRemaining: "20:00",
          }),
          situationCode: undefined,
        },
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Invalid PBP situation code/,
    },
    {
      name: "out-of-domain situation code",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
          situationCode: "1751",
        }),
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Invalid PBP situation code/,
    },
    {
      name: "missing period-start",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "faceoff",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /exactly one PBP period-start/,
    },
    {
      name: "period-start after zero",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:01",
          timeRemaining: "19:59",
        }),
        play({
          eventId: 2,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /period-start is not at 0:00/,
    },
    {
      name: "duplicate period-start",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 3,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /exactly one PBP period-start/,
    },
    {
      name: "missing terminal for the shift-bearing period",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "faceoff",
          timeInPeriod: "01:00",
          timeRemaining: "19:00",
        }),
        play({
          eventId: 3,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
          period: 2,
        }),
        play({
          eventId: 4,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
          period: 2,
        }),
      ],
      error: /Missing PBP period terminal/,
    },
    {
      name: "conflicting terminal clocks",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "period-end",
          timeInPeriod: "19:59",
          timeRemaining: "00:01",
        }),
        play({
          eventId: 3,
          typeDescKey: "game-end",
          timeInPeriod: "20:00",
          timeRemaining: "00:00",
        }),
      ],
      error: /Inconsistent PBP period terminal/,
    },
    {
      name: "event after the terminal",
      plays: [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: "20:00",
        }),
        play({
          eventId: 2,
          typeDescKey: "period-end",
          timeInPeriod: "10:00",
          timeRemaining: "10:00",
        }),
        play({
          eventId: 3,
          typeDescKey: "shot-on-goal",
          timeInPeriod: "11:00",
          timeRemaining: "09:00",
        }),
        play({
          eventId: 4,
          typeDescKey: "game-end",
          timeInPeriod: "10:00",
          timeRemaining: "10:00",
        }),
      ],
      error: /event occurs after the period terminal/,
    },
  ])("fails closed on $name", ({ plays, error }) => {
    expect(() =>
      buildShiftStrengthUpserts(GAME_ID, finalPbp({}, plays), bothTeams()),
    ).toThrow(error);
  });

  it.each([
    {
      name: "a shortened regular-season overtime",
      gameType: 2,
      nominal: "05:00",
      played: "03:30",
      remaining: "01:30",
      start: "03:00",
      duration: "00:30",
      expected: "0:30",
    },
    {
      name: "a shortened playoff overtime",
      gameType: 3,
      nominal: "20:00",
      played: "12:34",
      remaining: "07:26",
      start: "12:00",
      duration: "00:34",
      expected: "0:34",
    },
  ])(
    "derives the played end and nominal length for $name",
    ({ gameType, nominal, played, remaining, start, duration, expected }) => {
      const pbp = finalPbp({ gameType }, [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: nominal,
          situationCode: "1331",
          period: 4,
          periodType: "OT",
        }),
        play({
          eventId: 2,
          typeDescKey: "goal",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period: 4,
          periodType: "OT",
        }),
        play({
          eventId: 3,
          typeDescKey: "period-end",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period: 4,
          periodType: "OT",
        }),
        play({
          eventId: 4,
          typeDescKey: "game-end",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period: 4,
          periodType: "OT",
        }),
      ]);
      const rows = buildShiftStrengthUpserts(GAME_ID, pbp, [
        shift({
          period: 4,
          startTime: start,
          endTime: "00:00",
          duration,
        }),
        awayShift({
          period: 4,
          startTime: start,
          endTime: "00:00",
          duration,
        }),
      ]);

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.total_es_toi)).toEqual([expected, expected]);
    },
  );

  it.each([
    {
      name: "zero duration",
      override: { duration: "0:00" },
      error: /duration must be positive/,
    },
    {
      name: "duration that disagrees with the endpoints",
      override: { endTime: "0:29", duration: "0:30" },
      error: /clock\/duration mismatch/,
    },
    {
      name: "end before start",
      override: { startTime: "0:30", endTime: "0:15", duration: "0:15" },
      error: /clock\/duration mismatch/,
    },
    {
      name: "interval beyond the played period",
      override: { startTime: "19:50", endTime: "20:10", duration: "0:20" },
      error: /outside played period/,
    },
    {
      name: "zero-end sentinel before the played end",
      override: { startTime: "0:30", endTime: "0:00", duration: "0:30" },
      error: /Invalid zero-end shift sentinel/,
    },
  ])("rejects $name", ({ override, error }) => {
    expect(() =>
      buildShiftStrengthUpserts(GAME_ID, finalPbp(), bothTeams(override)),
    ).toThrow(error);
  });

  it("accepts a zero-end sentinel only when duration lands on the played end", () => {
    const rows = buildShiftStrengthUpserts(GAME_ID, finalPbp(), [
      shift({
        startTime: "19:30",
        endTime: "00:00",
        duration: "00:30",
      }),
      awayShift({
        startTime: "19:30",
        endTime: "00:00",
        duration: "00:30",
      }),
    ]);

    expect(rows.map((row) => row.total_es_toi)).toEqual(["0:30", "0:30"]);
  });

  it("invalidates only strength-owned columns before exact player-scope upsert", async () => {
    const rows = buildShiftStrengthUpserts(
      GAME_ID,
      finalPbp(),
      bothTeams(),
      "2026-07-19T00:00:00.000Z",
    );

    await expect(
      replaceShiftStrengthRowsForGame(GAME_ID, rows),
    ).resolves.toEqual({ rowsUpserted: 2 });

    expect(db.update).toHaveBeenCalledWith({
      total_es_toi: null,
      total_pp_toi: null,
      total_pk_toi: null,
      updated_at: expect.any(String),
    });
    expect(db.invalidateEq).toHaveBeenCalledWith("game_id", GAME_ID);
    expect(db.upsert).toHaveBeenCalledWith(rows, {
      onConflict: "game_id,player_id",
    });
  });

  it("fails closed when strength invalidation or replacement fails", async () => {
    const rows = buildShiftStrengthUpserts(GAME_ID, finalPbp(), bothTeams());
    db.state.invalidateError = new Error("invalidation failed");

    await expect(
      replaceShiftStrengthRowsForGame(GAME_ID, rows),
    ).rejects.toThrow("invalidation failed");
    expect(db.upsert).not.toHaveBeenCalled();

    vi.clearAllMocks();
    db.state.invalidateError = null;
    db.state.upsertError = new Error("replacement failed");
    await expect(
      replaceShiftStrengthRowsForGame(GAME_ID, rows),
    ).rejects.toThrow("replacement failed");
    expect(db.invalidateEq).toHaveBeenCalledWith("game_id", GAME_ID);
  });
});

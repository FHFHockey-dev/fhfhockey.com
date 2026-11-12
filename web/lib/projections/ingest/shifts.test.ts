import { beforeEach, describe, expect, it, vi } from "vitest";

const nhleFetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("./nhleFetch", () => ({
  nhleFetchJson: nhleFetchJsonMock,
}));

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
  buildCanonicalShiftIntervals,
  buildShiftRelationshipStrengthSegments,
  buildShiftSnapshotFromRawPayload,
  buildShiftStrengthUpserts,
  fetchAllNhleShiftChartsForGame,
  fetchAllNhleShiftChartsSnapshotForGame,
  replaceShiftStrengthRowsForGame,
  upsertShiftTotalsForGameFromPbp,
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
  details?: Record<string, unknown>;
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
    details: args.details,
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
    shiftNumber: 1,
    period: 1,
    startTime: "0:00",
    endTime: "0:30",
    duration: "0:30",
    typeCode: 517,
    ...overrides,
  };
}

function homeMinorEndedByGoalPbp(situationCode = "1451"): TestPbp {
  return finalPbp({}, [
    play({ eventId: 1, typeDescKey: "period-start", timeInPeriod: "00:00", timeRemaining: "20:00" }),
    play({ eventId: 2, typeDescKey: "penalty", timeInPeriod: "00:30", timeRemaining: "19:30", details: { eventOwnerTeamId: 2, committedByPlayerId: 20, typeCode: "MIN", duration: 2 } }),
    play({ eventId: 3, typeDescKey: "faceoff", timeInPeriod: "00:30", timeRemaining: "19:30", situationCode }),
    play({ eventId: 4, typeDescKey: "goal", timeInPeriod: "01:00", timeRemaining: "19:00", situationCode, details: { eventOwnerTeamId: 1, scoringPlayerId: 10 } }),
    play({ eventId: 5, typeDescKey: "faceoff", timeInPeriod: "01:00", timeRemaining: "19:00" }),
    play({ eventId: 6, typeDescKey: "game-end", timeInPeriod: "20:00", timeRemaining: "00:00" }),
  ]);
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
    nhleFetchJsonMock.mockReset();
  });

  it("requires every declared shift page and returns one stable source order", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      shift({ shiftNumber: 1000 - index }),
    );
    nhleFetchJsonMock
      .mockResolvedValueOnce({ total: 1001, data: firstPage })
      .mockResolvedValueOnce({
        total: 1001,
        data: [shift({ shiftNumber: 1001 })],
      });

    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    const rows = snapshot.rows;

    expect(rows).toHaveLength(1001);
    expect(rows[0].shiftNumber).toBe(1);
    expect(rows.at(-1)?.shiftNumber).toBe(1001);
    expect(snapshot.rawPayload).toMatchObject({
      total: 1001,
      source: "json-api",
    });
    expect(snapshot.rawPayload.data[0].shiftNumber).toBe(1000);
    expect(snapshot.rawPayload.data.at(-1)?.shiftNumber).toBe(1001);
    expect(nhleFetchJsonMock).toHaveBeenCalledTimes(2);
    expect(nhleFetchJsonMock.mock.calls[1][0]).toContain("start=1000");
  });

  it("rejects premature short pages and total drift, while counting duplicate intervals once", async () => {
    nhleFetchJsonMock.mockResolvedValueOnce({
      total: 2,
      data: [shift()],
    });
    await expect(fetchAllNhleShiftChartsForGame(GAME_ID)).rejects.toThrow(
      "Incomplete NHL shift pagination",
    );

    nhleFetchJsonMock
      .mockResolvedValueOnce({
        total: 1001,
        data: Array.from({ length: 1000 }, (_, index) =>
          shift({ shiftNumber: index + 1 }),
        ),
      })
      .mockResolvedValueOnce({
        total: 1002,
        data: [shift({ shiftNumber: 1001 })],
      });
    await expect(fetchAllNhleShiftChartsForGame(GAME_ID)).rejects.toThrow(
      "Invalid NHL shift pagination metadata",
    );

    nhleFetchJsonMock.mockResolvedValueOnce({
      total: 2,
      data: [shift(), shift()],
    });
    const snapshot = await fetchAllNhleShiftChartsSnapshotForGame(GAME_ID);
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rawPayload.data).toHaveLength(2);
  });

  it("uses only interval rows and assigns every interval second to ES/PP/PK", () => {
    const pbp = homeMinorEndedByGoalPbp();
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

  it.each([
    // Home goalie pulled at 5v5 (1560): ES for both, not a home PP (W2-6 §1, decision 70).
    { code: "1560", home: { es: "1:30", pp: "0:00", pk: "0:00" }, away: { es: "1:30", pp: "0:00", pk: "0:00" } },
    // Home goalie pulled during a home 5v4 (1460): still a home PP / away PK.
    { code: "1460", home: { es: "1:00", pp: "0:30", pk: "0:00" }, away: { es: "1:00", pp: "0:00", pk: "0:30" } },
  ])("classifies ice time with the events' pulled-goalie rule ($code)", ({ code, home, away }) => {
    const pbp = code === "1460" ? homeMinorEndedByGoalPbp(code) : finalPbp({}, [
      play({ eventId: 1, typeDescKey: "period-start", timeInPeriod: "00:00", timeRemaining: "20:00" }),
      play({ eventId: 2, typeDescKey: "stoppage", timeInPeriod: "00:30", timeRemaining: "19:30", situationCode: code }),
      play({ eventId: 3, typeDescKey: "faceoff", timeInPeriod: "01:00", timeRemaining: "19:00" }),
      play({ eventId: 4, typeDescKey: "game-end", timeInPeriod: "20:00", timeRemaining: "00:00" }),
    ]);
    const rows = buildShiftStrengthUpserts(GAME_ID, pbp,
      [shift({ endTime: "1:30", duration: "1:30" }), awayShift({ endTime: "1:30", duration: "1:30" })], "2026-07-19T00:00:00.000Z");
    expect(rows.find((row) => row.player_id === 10)).toMatchObject({ total_es_toi: home.es, total_pp_toi: home.pp, total_pk_toi: home.pk });
    expect(rows.find((row) => row.player_id === 20)).toMatchObject({ total_es_toi: away.es, total_pp_toi: away.pp, total_pk_toi: away.pk });
  });

  it("derives relationship PP/ES segments from the manifest-bound PBP timeline", () => {
    const pbp = homeMinorEndedByGoalPbp();

    const segments = buildShiftRelationshipStrengthSegments(GAME_ID, pbp, [
      shift({ endTime: "1:30", duration: "1:30" }),
      awayShift({ endTime: "1:30", duration: "1:30" }),
    ]).filter((segment) => segment.playerId === 10);

    expect(segments).toEqual([
      expect.objectContaining({
        startTime: "0:00",
        endTime: "0:30",
        duration: "0:30",
        strength: "es",
      }),
      expect.objectContaining({
        startTime: "0:30",
        endTime: "1:00",
        duration: "0:30",
        strength: "pp",
      }),
      expect.objectContaining({
        startTime: "1:00",
        endTime: "1:30",
        duration: "0:30",
        strength: "es",
      }),
    ]);
  });

  it("uses penalty context despite reversed source order at the same timestamp", () => {
    const pbp = finalPbp({}, [
      play({
        eventId: 1,
        typeDescKey: "period-start",
        timeInPeriod: "00:00",
        timeRemaining: "20:00",
        sortOrder: 1,
      }),
      // Deliberately reverse source order; the penalty still starts at this clock.
      play({
        eventId: 3,
        typeDescKey: "faceoff",
        timeInPeriod: "00:30",
        timeRemaining: "19:30",
        situationCode: "1451",
        sortOrder: 3,
      }),
      play({
        eventId: 2,
        typeDescKey: "penalty",
        timeInPeriod: "00:30",
        timeRemaining: "19:30",
        situationCode: "1551",
        sortOrder: 2,
        details: { eventOwnerTeamId: 2, committedByPlayerId: 20, typeCode: "MIN", duration: 2 },
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

    expect(rows.map((row) => row.total_es_toi)).toEqual(["0:00", "0:00"]);
    expect(rows.map((row) => row.total_pp_toi)).toEqual(["0:30", "0:00"]);
    expect(rows.map((row) => row.total_pk_toi)).toEqual(["0:00", "0:30"]);
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

  it("ends captured game 2026020009's 07:19 minor at 09:19 before the next 09:24 event", () => {
    const pbp = finalPbp({}, [
      play({ eventId: 52, typeDescKey: "period-start", timeInPeriod: "00:00", timeRemaining: "20:00" }),
      play({ eventId: 211, typeDescKey: "penalty", timeInPeriod: "07:19", timeRemaining: "12:41", details: { eventOwnerTeamId: 2, committedByPlayerId: 20, typeCode: "MIN", duration: 2 } }),
      play({ eventId: 212, typeDescKey: "faceoff", timeInPeriod: "07:19", timeRemaining: "12:41", situationCode: "1451" }),
      play({ eventId: 237, typeDescKey: "faceoff", timeInPeriod: "09:17", timeRemaining: "10:43", situationCode: "1451" }),
      play({ eventId: 247, typeDescKey: "hit", timeInPeriod: "09:24", timeRemaining: "10:36" }),
      play({ eventId: 999, typeDescKey: "game-end", timeInPeriod: "20:00", timeRemaining: "00:00" }),
    ]);
    const rows = [shift({ startTime: "09:19", endTime: "09:24", duration: "00:05" }), awayShift({ startTime: "09:19", endTime: "09:24", duration: "00:05" })];
    expect(buildShiftStrengthUpserts(GAME_ID, pbp, rows).map((row) => [row.total_es_toi, row.total_pp_toi, row.total_pk_toi])).toEqual([["0:05", "0:00", "0:00"], ["0:05", "0:00", "0:00"]]);
    expect(buildShiftRelationshipStrengthSegments(GAME_ID, pbp, rows).map((segment) => segment.strength)).toEqual(["es", "es"]);
  });

  it.each([
    { name: "double minor first-half goal", typeCode: "MIN", duration: 4, afterGoal: "1451", expiry: "03:30", remaining: "16:30", next: "03:45", nextRemaining: "16:15", end: "04:00", shiftDuration: "03:00", pp: "2:30", es: "0:30" },
    { name: "major survives a goal", typeCode: "MAJ", duration: 5, afterGoal: "1451", expiry: "06:00", remaining: "14:00", next: "06:15", nextRemaining: "13:45", end: "06:30", shiftDuration: "05:30", pp: "5:00", es: "0:30" },
  ])("uses penalty boundaries for $name", ({ typeCode, duration, afterGoal, next, nextRemaining, end, shiftDuration, pp, es }) => {
    const pbp = finalPbp({}, [
      play({ eventId: 1, typeDescKey: "period-start", timeInPeriod: "00:00", timeRemaining: "20:00" }),
      play({ eventId: 2, typeDescKey: "penalty", timeInPeriod: "01:00", timeRemaining: "19:00", details: { eventOwnerTeamId: 2, committedByPlayerId: 20, typeCode, duration } }),
      play({ eventId: 3, typeDescKey: "faceoff", timeInPeriod: "01:00", timeRemaining: "19:00", situationCode: "1451" }),
      play({ eventId: 4, typeDescKey: "goal", timeInPeriod: "01:30", timeRemaining: "18:30", situationCode: "1451", details: { eventOwnerTeamId: 1, scoringPlayerId: 10 } }),
      play({ eventId: 5, typeDescKey: "faceoff", timeInPeriod: "01:30", timeRemaining: "18:30", situationCode: afterGoal }),
      play({ eventId: 6, typeDescKey: "hit", timeInPeriod: next, timeRemaining: nextRemaining }),
      play({ eventId: 7, typeDescKey: "game-end", timeInPeriod: "20:00", timeRemaining: "00:00" }),
    ]);
    const rows = [shift({ startTime: "01:00", endTime: end, duration: shiftDuration }), awayShift({ startTime: "01:00", endTime: end, duration: shiftDuration })];
    expect(buildShiftStrengthUpserts(GAME_ID, pbp, rows).find((row) => row.player_id === 10)).toMatchObject({ total_pp_toi: pp, total_es_toi: es });
    const seconds = (clock: string) => { const [m, s] = clock.split(":").map(Number); return m * 60 + s; };
    expect(buildShiftRelationshipStrengthSegments(GAME_ID, pbp, rows).filter((segment) => segment.playerId === 10 && segment.strength === "pp").reduce((sum, segment) => sum + seconds(segment.duration), 0)).toBe(seconds(pp));
  });

  it("expires a carried regulation minor inside sparse overtime events", () => {
    const pbp = finalPbp({}, [
      play({ eventId: 1, typeDescKey: "period-start", period: 3, timeInPeriod: "00:00", timeRemaining: "20:00" }),
      play({ eventId: 2, typeDescKey: "penalty", period: 3, timeInPeriod: "19:30", timeRemaining: "00:30", details: { eventOwnerTeamId: 2, committedByPlayerId: 20, typeCode: "MIN", duration: 2 } }),
      play({ eventId: 3, typeDescKey: "faceoff", period: 3, timeInPeriod: "19:30", timeRemaining: "00:30", situationCode: "1451" }),
      play({ eventId: 4, typeDescKey: "period-end", period: 3, timeInPeriod: "20:00", timeRemaining: "00:00", situationCode: "1451" }),
      play({ eventId: 5, typeDescKey: "period-start", period: 4, periodType: "OT", timeInPeriod: "00:00", timeRemaining: "05:00", situationCode: "1341" }),
      play({ eventId: 6, typeDescKey: "shot-on-goal", period: 4, periodType: "OT", timeInPeriod: "01:20", timeRemaining: "03:40", situationCode: "1341" }),
      play({ eventId: 7, typeDescKey: "hit", period: 4, periodType: "OT", timeInPeriod: "01:45", timeRemaining: "03:15", situationCode: "1441" }),
      play({ eventId: 8, typeDescKey: "game-end", period: 4, periodType: "OT", timeInPeriod: "03:00", timeRemaining: "02:00", situationCode: "1441" }),
    ]);
    const rows = [shift({ period: 4, startTime: "01:30", endTime: "01:45", duration: "00:15" }), awayShift({ period: 4, startTime: "01:30", endTime: "01:45", duration: "00:15" })];
    expect(buildShiftStrengthUpserts(GAME_ID, pbp, rows).map((row) => row.total_es_toi)).toEqual(["0:15", "0:15"]);
    expect(buildShiftRelationshipStrengthSegments(GAME_ID, pbp, rows).map((segment) => segment.strength)).toEqual(["es", "es"]);
  });

  it("rejects unexplained interior manpower changes before writing strength rows", async () => {
    const pbp = finalPbp({}, [
      play({ eventId: 1, typeDescKey: "period-start", timeInPeriod: "00:00", timeRemaining: "20:00" }),
      play({ eventId: 2, typeDescKey: "shot-on-goal", timeInPeriod: "00:15", timeRemaining: "19:45", situationCode: "1451" }),
      play({ eventId: 3, typeDescKey: "game-end", timeInPeriod: "20:00", timeRemaining: "00:00" }),
    ]);
    await expect(upsertShiftTotalsForGameFromPbp(GAME_ID, pbp, bothTeams())).rejects.toThrow(/penalty|manpower/i);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
    expect(() => buildShiftRelationshipStrengthSegments(GAME_ID, pbp, bothTeams())).toThrow(/penalty|manpower/i);
  });

  it.each([
    { name: "Woll", overtime: "3:23", extraPeriod: 3, extraStart: "18:06", extraDuration: "1:54", duplicateOvertime: true, expected: "63:23" },
    { name: "Saros", overtime: "5:00", duplicateOvertime: true, expected: "65:00" },
    { name: "Kuemper", overtime: "2:43", extraPeriod: 2, extraStart: "11:36", extraDuration: "8:24", expected: "62:43" },
    { name: "Cossa", overtime: "3:27", duplicateOvertime: true, expected: "63:27" },
  ])("unions duplicate and nested goalie intervals ($name shape)", ({ overtime, extraPeriod, extraStart, extraDuration, duplicateOvertime, expected }) => {
    const periods = ["20:00", "20:00", "20:00", overtime];
    const pbp = finalPbp({}, periods.flatMap((end, index) => {
      const [minutes, seconds] = end.split(":").map(Number);
      const remaining = (index === 3 ? 300 : 1200) - minutes * 60 - seconds;
      const periodType = index === 3 ? "OT" : "REG";
      return [
        play({ eventId: index * 2 + 1, typeDescKey: "period-start", period: index + 1, periodType, timeInPeriod: "00:00", timeRemaining: index === 3 ? "05:00" : "20:00" }),
        play({ eventId: index * 2 + 2, typeDescKey: index === 3 ? "game-end" : "period-end", period: index + 1, periodType, timeInPeriod: end, timeRemaining: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` }),
      ];
    }));
    const rows = periods.flatMap((end, index) => [
      shift({ period: index + 1, shiftNumber: index + 1, endTime: end, duration: end }),
      awayShift({ period: index + 1, shiftNumber: index + 1, endTime: end, duration: end }),
    ]);
    if (extraPeriod) rows.push(shift({ period: extraPeriod, shiftNumber: 6, startTime: extraStart!, endTime: "20:00", duration: extraDuration! }));
    if (duplicateOvertime) rows.push(shift({ period: 4, shiftNumber: 7, startTime: "00:00", endTime: "00:00", duration: overtime }));
    const before = JSON.stringify(rows);

    expect(buildShiftStrengthUpserts(GAME_ID, pbp, rows).find((row) => row.player_id === 10)?.total_es_toi).toBe(expected);
    const segments = buildShiftRelationshipStrengthSegments(GAME_ID, pbp, rows).filter((segment) => segment.playerId === 10);
    expect(segments).toHaveLength(4);
    expect(segments.map((segment) => segment.endTime)).toEqual(periods.map((end) => end.replace(/^0(?=\d:)/, "")));
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("unions partial overlaps before splitting the physical interval by strength", () => {
    const pbp = homeMinorEndedByGoalPbp();
    const rows = [shift({ endTime: "1:00", duration: "1:00" }), shift({ shiftNumber: 2, startTime: "0:30", endTime: "1:30", duration: "1:00" }), awayShift({ endTime: "1:30", duration: "1:30" })];
    expect(buildShiftStrengthUpserts(GAME_ID, pbp, rows).find((row) => row.player_id === 10)).toMatchObject({ total_es_toi: "1:00", total_pp_toi: "0:30" });
    expect(buildShiftRelationshipStrengthSegments(GAME_ID, pbp, rows).filter((segment) => segment.playerId === 10).map((segment) => [segment.startTime, segment.endTime, segment.strength])).toEqual([["0:00", "0:30", "es"], ["0:30", "1:00", "pp"], ["1:00", "1:30", "es"]]);
  });

  it("canonicalizes calculation clocks and adjacent intervals without changing the source snapshot", () => {
    const rows = [
      shift(),
      shift({ shiftNumber: 2, duration: "00:30" }),
      shift({ shiftNumber: 3, startTime: "00:30", endTime: "01:00", duration: "00:30" }),
      shift({ shiftNumber: 4, startTime: "02:00", endTime: "02:30" }),
      awayShift(),
    ];
    const snapshot = buildShiftSnapshotFromRawPayload(GAME_ID, { source: "json-api", total: rows.length, data: rows });
    const before = JSON.stringify(snapshot);
    const canonical = buildCanonicalShiftIntervals(GAME_ID, finalPbp(), snapshot.rows);
    expect(canonical.filter((row) => row.playerId === 10).map((row) => [row.startTime, row.endTime, row.duration])).toEqual([["0:00", "1:00", "1:00"], ["2:00", "2:30", "0:30"]]);
    expect(buildCanonicalShiftIntervals(GAME_ID, finalPbp(), [...snapshot.rows].reverse())).toEqual(canonical);
    expect(buildCanonicalShiftIntervals(GAME_ID, finalPbp(), canonical)).toEqual(canonical);
    expect(snapshot.rows).toHaveLength(5);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(() => buildCanonicalShiftIntervals(GAME_ID, finalPbp(), [...rows, shift({ shiftNumber: 5, duration: "1:00" })])).toThrow("clock/duration mismatch");
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
    { name: "21:40 regulation nominal", gameType: 2, period: 1, periodType: "REG", nominal: "21:40", played: "20:00", remaining: "01:40", error: /Invalid PBP nominal period length/ },
    { name: "20-minute regular-season overtime nominal", gameType: 2, period: 4, periodType: "OT", nominal: "20:00", played: "03:30", remaining: "16:30", error: /Invalid PBP nominal period length/ },
    { name: "five-minute playoff overtime nominal", gameType: 3, period: 4, periodType: "OT", nominal: "05:00", played: "03:30", remaining: "01:30", error: /Invalid PBP nominal period length/ },
    { name: "overtime type in regulation", gameType: 2, period: 1, periodType: "OT", nominal: "20:00", played: "20:00", remaining: "00:00", error: /Invalid PBP period definition/ },
    { name: "regulation type in overtime", gameType: 2, period: 4, periodType: "REG", nominal: "05:00", played: "03:30", remaining: "01:30", error: /Invalid PBP period definition/ },
    { name: "shootout physical shift period", gameType: 2, period: 5, periodType: "SO", nominal: "05:00", played: "03:30", remaining: "01:30", error: /Invalid PBP period definition/ },
    { name: "second regular-season overtime", gameType: 2, period: 5, periodType: "OT", nominal: "05:00", played: "03:30", remaining: "01:30", error: /Invalid PBP period definition/ },
  ])("rejects $name", ({ gameType, period, periodType, nominal, played, remaining, error }) => {
    const pbp = finalPbp({ gameType }, [
      play({ eventId: 1, typeDescKey: "period-start", period, periodType, timeInPeriod: "00:00", timeRemaining: nominal }),
      play({ eventId: 2, typeDescKey: "game-end", period, periodType, timeInPeriod: played, timeRemaining: remaining }),
    ]);
    expect(() => buildCanonicalShiftIntervals(GAME_ID, pbp, [shift({ period }), awayShift({ period })])).toThrow(error);
  });

  it.each([
    {
      name: "a shortened regular-season overtime",
      gameType: 2,
      period: 4,
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
      period: 4,
      nominal: "20:00",
      played: "12:34",
      remaining: "07:26",
      start: "12:00",
      duration: "00:34",
      expected: "0:34",
    },
    {
      name: "a shortened preseason overtime",
      gameType: 1,
      period: 4,
      nominal: "05:00",
      played: "03:30",
      remaining: "01:30",
      start: "03:00",
      duration: "00:30",
      expected: "0:30",
    },
    {
      name: "a shortened second playoff overtime",
      gameType: 3,
      period: 5,
      nominal: "20:00",
      played: "12:34",
      remaining: "07:26",
      start: "12:00",
      duration: "00:34",
      expected: "0:34",
    },
  ])(
    "derives the played end and nominal length for $name",
    ({ gameType, period, nominal, played, remaining, start, duration, expected }) => {
      const pbp = finalPbp({ gameType }, [
        play({
          eventId: 1,
          typeDescKey: "period-start",
          timeInPeriod: "00:00",
          timeRemaining: nominal,
          situationCode: "1331",
          period,
          periodType: "OT",
        }),
        play({
          eventId: 2,
          typeDescKey: "goal",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period,
          periodType: "OT",
        }),
        play({
          eventId: 3,
          typeDescKey: "period-end",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period,
          periodType: "OT",
        }),
        play({
          eventId: 4,
          typeDescKey: "game-end",
          timeInPeriod: played,
          timeRemaining: remaining,
          situationCode: "1331",
          period,
          periodType: "OT",
        }),
      ]);
      const rows = buildShiftStrengthUpserts(GAME_ID, pbp, [
        shift({
          period,
          startTime: start,
          endTime: "00:00",
          duration,
        }),
        awayShift({
          period,
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

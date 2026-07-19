import { beforeEach, describe, expect, it, vi } from "vitest";
import { teamsInfo } from "lib/teamsInfo";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queryLog: [] as Array<Record<string, any>>,
  shiftResponses: [] as Array<{ data: any[] | null; error: unknown }>,
  playerResponses: [] as Array<{ data: any[] | null; error: unknown }>,
}));

vi.mock("lib/supabase", () => ({
  default: { from: mocks.from },
}));

import { RAW_SHIFT_CHART_PAGE_SIZE, getTOIDataForGames } from "./useTOIData";

function buildShiftQuery(log: Record<string, any>) {
  const query = {
    select(fields: string) {
      log.select = fields;
      return query;
    },
    eq(column: string, value: unknown) {
      log.eq.push([column, value]);
      return query;
    },
    or(filter: string) {
      log.or.push(filter);
      return query;
    },
    gte(column: string, value: unknown) {
      log.gte.push([column, value]);
      return query;
    },
    lte(column: string, value: unknown) {
      log.lte.push([column, value]);
      return query;
    },
    order(column: string, options: unknown) {
      log.order.push([column, options]);
      return query;
    },
    range(from: number, to: number) {
      log.range = [from, to];
      const response = mocks.shiftResponses.shift();
      if (!response) throw new Error("Unexpected shift-chart page request.");
      return Promise.resolve(response);
    },
  };
  return query;
}

function buildPlayerQuery(log: Record<string, any>) {
  const query = {
    select(fields: string) {
      log.select = fields;
      return query;
    },
    in(column: string, values: number[]) {
      log.in.push([column, [...values]]);
      return query;
    },
    order(column: string, options: unknown) {
      log.order.push([column, options]);
      return query;
    },
    range(from: number, to: number) {
      log.range = [from, to];
      return Promise.resolve(
        mocks.playerResponses.shift() ?? { data: [], error: null },
      );
    },
  };
  return query;
}

function shiftRow(
  id: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    game_id: 2025020000 + id,
    game_type: "2",
    game_date: "2026-03-10",
    season_id: 20252026,
    player_id: 97,
    player_first_name: "Connor",
    player_last_name: "McDavid",
    team_id: teamsInfo.EDM.id,
    team_abbreviation: "EDM",
    game_toi: "10:00",
    game_length: "60:00",
    home_or_away: "home",
    display_position: "C",
    primary_position: "C",
    player_type: "F",
    time_spent_with: {},
    time_spent_with_mixed: {},
    line_combination: 1,
    pairing_combination: null,
    total_es_toi: "08:00",
    total_pp_toi: "02:00",
    total_pk_toi: "00:00",
    ...overrides,
  };
}

function pairedGameRows(
  gameId: number,
  date: string,
  firstRowId: number,
  sharedTime: string,
) {
  return [
    shiftRow(firstRowId, {
      game_id: gameId,
      game_date: date,
      player_id: 97,
      time_spent_with: { 29: sharedTime },
    }),
    shiftRow(firstRowId + 1, {
      game_id: gameId,
      game_date: date,
      player_id: 29,
      player_first_name: "Leon",
      player_last_name: "Draisaitl",
      time_spent_with: { 97: sharedTime },
    }),
  ];
}

function forwardDefenseGameRows(
  gameId: number,
  date: string,
  firstRowId: number,
  sharedTime: string,
  storedKind: "same" | "mixed",
  missingForwardPosition = false,
) {
  const forwardRelationships =
    storedKind === "same"
      ? { time_spent_with: { 29: sharedTime }, time_spent_with_mixed: {} }
      : { time_spent_with: {}, time_spent_with_mixed: { 29: sharedTime } };
  const defenseRelationships =
    storedKind === "same"
      ? { time_spent_with: { 97: sharedTime }, time_spent_with_mixed: {} }
      : { time_spent_with: {}, time_spent_with_mixed: { 97: sharedTime } };
  return [
    shiftRow(firstRowId, {
      game_id: gameId,
      game_date: date,
      primary_position: missingForwardPosition ? null : "C",
      display_position: missingForwardPosition ? null : "C",
      player_type: missingForwardPosition ? null : "F",
      ...forwardRelationships,
    }),
    shiftRow(firstRowId + 1, {
      game_id: gameId,
      game_date: date,
      player_id: 29,
      player_first_name: "Leon",
      player_last_name: "Draisaitl",
      primary_position: "D",
      display_position: "D",
      player_type: "D",
      line_combination: null,
      pairing_combination: 1,
      ...defenseRelationships,
    }),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryLog.length = 0;
  mocks.shiftResponses.length = 0;
  mocks.playerResponses.length = 0;
  mocks.from.mockImplementation((table: string) => {
    const log = {
      table,
      select: "",
      eq: [] as Array<[string, unknown]>,
      or: [] as string[],
      gte: [] as Array<[string, unknown]>,
      lte: [] as Array<[string, unknown]>,
      order: [] as Array<[string, unknown]>,
      range: null as [number, number] | null,
      in: [] as Array<[string, number[]]>,
    };
    mocks.queryLog.push(log);
    if (table === "shift_charts") return buildShiftQuery(log);
    if (table === "players") return buildPlayerQuery(log);
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("getTOIDataForGames", () => {
  it("reads deterministic inclusive pages through the first short page", async () => {
    const rows = Array.from(
      { length: RAW_SHIFT_CHART_PAGE_SIZE + 1 },
      (_, index) =>
        shiftRow(index + 1, {
          game_id: 2025000000 + index,
        }),
    );
    mocks.shiftResponses.push(
      { data: rows.slice(0, RAW_SHIFT_CHART_PAGE_SIZE), error: null },
      { data: rows.slice(RAW_SHIFT_CHART_PAGE_SIZE), error: null },
    );

    const result = await getTOIDataForGames(
      "edm",
      "2026-03-01",
      "2026-03-31",
      "regularSeason",
    );

    expect(result.roster).toHaveLength(1);
    expect(result.roster[0]).toMatchObject({
      id: 97,
      GP: RAW_SHIFT_CHART_PAGE_SIZE + 1,
      teamId: teamsInfo.EDM.id,
      franchiseId: teamsInfo.EDM.franchiseId,
    });
    expect(result.coverage).toEqual({
      inputRows: RAW_SHIFT_CHART_PAGE_SIZE + 1,
      rosterRows: 1,
      skippedRows: 0,
    });
    const shiftQueries = mocks.queryLog.filter(
      (query) => query.table === "shift_charts",
    );
    expect(shiftQueries.map((query) => query.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(shiftQueries.map((query) => query.order)).toEqual([
      [["id", { ascending: true }]],
      [["id", { ascending: true }]],
    ]);
    expect(shiftQueries[0].eq).toEqual([
      ["team_abbreviation", "EDM"],
      ["team_id", teamsInfo.EDM.id],
    ]);
    expect(shiftQueries[0].or).toEqual(["game_type.eq.2,game_type.is.null"]);
    expect(shiftQueries[0].gte).toEqual([["game_date", "2026-03-01"]]);
    expect(shiftQueries[0].lte).toEqual([["game_date", "2026-03-31"]]);
    expect(shiftQueries[0].select).not.toBe("*");
  });

  it("rejects the complete request when a later page fails", async () => {
    mocks.shiftResponses.push(
      {
        data: Array.from({ length: RAW_SHIFT_CHART_PAGE_SIZE }, (_, index) =>
          shiftRow(index + 1, { game_id: 2025000000 + index }),
        ),
        error: null,
      },
      { data: null, error: new Error("later page failed") },
    );

    await expect(
      getTOIDataForGames("EDM", "2026-03-01", "2026-03-31"),
    ).rejects.toThrow("later page failed");
    expect(mocks.queryLog.some((query) => query.table === "players")).toBe(
      false,
    );
  });

  it("aggregates one roster row per player and each mirrored pair-game once", async () => {
    mocks.shiftResponses.push({
      data: [
        ...pairedGameRows(2025020101, "2026-03-10", 1, "05:00"),
        ...pairedGameRows(2025020102, "2026-03-12", 3, "04:00"),
      ],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");
    const mcdavid = result.roster.find((player) => player.id === 97)!;
    const draisaitl = result.roster.find((player) => player.id === 29)!;

    expect(result.roster).toHaveLength(2);
    expect(mcdavid).toMatchObject({
      GP: 2,
      totalTOI: 1200,
      ATOI: "10:00",
      timeSpentWith: { 29: 540 },
      timesPlayedWith: { 29: 2 },
      timesOnLine: { 1: 2 },
      percentToiWith: { 29: 45 },
    });
    expect(draisaitl.timeSpentWith[97]).toBe(540);
    expect(result.toiData).toHaveLength(1);
    expect(result.toiData[0]).toMatchObject({ toi: 540 });
    expect([result.toiData[0].p1.id, result.toiData[0].p2.id]).toEqual([
      29, 97,
    ]);
    expect(result.homeAwayInfo).toEqual([
      { gameId: 2025020101, homeOrAway: "home" },
      { gameId: 2025020102, homeOrAway: "home" },
    ]);
    expect(result.team).toEqual({
      id: teamsInfo.EDM.id,
      name: teamsInfo.EDM.name,
    });
    expect(result.coverage).toEqual({
      inputRows: 4,
      rosterRows: 2,
      skippedRows: 0,
    });
  });

  it("distinguishes incomplete null relationship coverage from observed zero", async () => {
    mocks.shiftResponses.push({
      data: [
        ...pairedGameRows(2025020101, "2026-03-10", 1, "00:00"),
        ...pairedGameRows(2025020102, "2026-03-12", 3, "04:00").map((row) => ({
          ...row,
          game_type: null,
          time_spent_with: null,
          time_spent_with_mixed: null,
        })),
      ],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");

    expect(result.coverage).toEqual({
      inputRows: 4,
      rosterRows: 2,
      skippedRows: 2,
    });
    expect(result.roster.map((player) => player.GP)).toEqual([1, 1]);
    expect(result.toiData).toHaveLength(1);
    expect(result.toiData[0].toi).toBe(0);
  });

  it("keeps complete roster and pair facts when home/away metadata is absent", async () => {
    mocks.shiftResponses.push({
      data: pairedGameRows(2025020101, "2026-03-10", 1, "05:00").map((row) => ({
        ...row,
        home_or_away: null,
      })),
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");

    expect(result.coverage).toEqual({
      inputRows: 2,
      rosterRows: 2,
      skippedRows: 0,
    });
    expect(result.roster.map((player) => player.GP)).toEqual([1, 1]);
    expect(result.toiData).toHaveLength(1);
    expect(result.homeAwayInfo).toEqual([]);
  });

  it("uses the bounded player fallback for nullable names and positions", async () => {
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, {
          player_first_name: null,
          player_last_name: null,
          primary_position: null,
          display_position: null,
          player_type: null,
        }),
      ],
      error: null,
    });
    mocks.playerResponses.push({
      data: [{ id: 97, fullName: "Connor McDavid", position: "C" }],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");

    expect(result.roster[0]).toMatchObject({
      name: "Connor McDavid",
      playerAbbrevName: "C. McDavid",
      lastName: "McDavid",
      position: "C",
      playerType: "F",
    });
    const fallbackQuery = mocks.queryLog.find(
      (query) => query.table === "players",
    );
    if (!fallbackQuery) throw new Error("Expected a player fallback query.");
    expect(fallbackQuery.in).toEqual([["id", [97]]]);
    expect(fallbackQuery.order).toEqual([["id", { ascending: true }]]);
    expect(fallbackQuery.range).toEqual([0, 999]);
  });

  it("preserves surname particles in bounded fallback metadata", async () => {
    mocks.shiftResponses.push({
      data: [
        shiftRow(1, {
          player_first_name: null,
          player_last_name: null,
        }),
      ],
      error: null,
    });
    mocks.playerResponses.push({
      data: [{ id: 97, fullName: "James van Riemsdyk", position: "LW" }],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");

    expect(result.roster[0]).toMatchObject({
      name: "James van Riemsdyk",
      playerAbbrevName: "J. van Riemsdyk",
      lastName: "van Riemsdyk",
    });
  });

  it("canonicalizes a fallback-resolved forward-defense pair to mixed", async () => {
    mocks.shiftResponses.push({
      data: forwardDefenseGameRows(
        2025020101,
        "2026-03-10",
        1,
        "05:00",
        "same",
        true,
      ),
      error: null,
    });
    mocks.playerResponses.push({
      data: [{ id: 97, fullName: "Connor McDavid", position: "C" }],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");
    const forward = result.roster.find((player) => player.id === 97)!;
    const defense = result.roster.find((player) => player.id === 29)!;

    expect(forward.timeSpentWith).toEqual({});
    expect(forward.timeSpentWithMixed).toEqual({ 29: 300 });
    expect(defense.timeSpentWith).toEqual({});
    expect(defense.timeSpentWithMixed).toEqual({ 97: 300 });
  });

  it("merges cross-game stored category drift into one canonical bucket", async () => {
    mocks.shiftResponses.push({
      data: [
        ...forwardDefenseGameRows(
          2025020101,
          "2026-03-10",
          1,
          "05:00",
          "mixed",
        ),
        ...forwardDefenseGameRows(
          2025020102,
          "2026-03-12",
          3,
          "04:00",
          "same",
          true,
        ),
      ],
      error: null,
    });

    const result = await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31");
    const forward = result.roster.find((player) => player.id === 97)!;

    expect(forward.timeSpentWith).toEqual({});
    expect(forward.timeSpentWithMixed).toEqual({ 29: 540 });
    expect(forward.percentToiWithMixed).toEqual({ 29: 45 });
    expect(result.toiData).toHaveLength(1);
    expect(result.toiData[0].toi).toBe(540);
  });

  it.each([
    {
      name: "invalid identity",
      rows: [shiftRow(1, { player_id: null })],
      message: "invalid player ID",
    },
    {
      name: "duplicate player-game",
      rows: [
        shiftRow(1, { game_id: 2025020101 }),
        shiftRow(2, { game_id: 2025020101 }),
      ],
      message: "duplicate player-game",
    },
    {
      name: "malformed relationship JSON",
      rows: [shiftRow(1, { time_spent_with: [] })],
      message: "invalid same-position relationship",
    },
    {
      name: "unknown relationship partner",
      rows: [shiftRow(1, { time_spent_with: { 29: "01:00" } })],
      message: "unknown player",
    },
    {
      name: "contradictory mirrored relationships",
      rows: [
        ...pairedGameRows(2025020101, "2026-03-10", 1, "05:00").map(
          (row, index) =>
            index === 1 ? { ...row, time_spent_with: { 97: "04:00" } } : row,
        ),
      ],
      message: "contradictory mirrored relationships",
    },
    {
      name: "appearance TOI beyond game length",
      rows: [shiftRow(1, { game_toi: "61:00", game_length: "60:00" })],
      message: "game TOI exceeds game length",
    },
    {
      name: "nonpositive game length",
      rows: [shiftRow(1, { game_toi: "00:00", game_length: "00:00" })],
      message: "invalid game length",
    },
    {
      name: "clock overflow",
      rows: [
        shiftRow(1, {
          game_toi: "9007199254740991:00",
          game_length: "60:00",
        }),
      ],
      message: "invalid game TOI",
    },
  ])("fails closed for $name", async ({ rows, message }) => {
    mocks.shiftResponses.push({ data: rows, error: null });
    await expect(
      getTOIDataForGames("EDM", "2026-03-01", "2026-03-31"),
    ).rejects.toThrow(message);
  });

  it("uses the exact playoff game type without changing date semantics", async () => {
    mocks.shiftResponses.push({
      data: [shiftRow(1, { game_type: "3" })],
      error: null,
    });

    await getTOIDataForGames("EDM", "2026-03-01", "2026-03-31", "playoffs");

    expect(mocks.queryLog[0].or).toEqual(["game_type.eq.3,game_type.is.null"]);
  });
});

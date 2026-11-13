import { describe, expect, test, vi } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("lib/supabase", () => ({
  default: { from: fromMock }
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn()
}));
import { lineCombos_2023020951_2023020970 } from "./LineCombinationsData";
import {
  aggregateSkaterToiSeconds,
  convertToLines,
  getLatestLineChanges,
  getLineCombinations,
  getLineChanges,
  resolveLineCombinationSourceContext
} from "../utilities";

describe("getLineCombinations", () => {
  test("filters and orders through the selected game relationship alias", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const query: Record<string, any> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.returns = vi.fn(() => query);
    query.throwOnError = vi.fn(() =>
      Promise.reject(new Error("stop after relationship query"))
    );
    fromMock.mockReturnValue(query);

    await expect(getLineCombinations(22, 20252026)).rejects.toThrow(
      "stop after relationship query"
    );

    expect(query.eq).toHaveBeenCalledWith("game.seasonId", 20252026);
    expect(query.order).toHaveBeenCalledWith("game(startTime)", {
      ascending: false
    });
    errorSpy.mockRestore();
  });
});

describe("resolveLineCombinationSourceContext", () => {
  test("returns the exact requested source identity", () => {
    expect(
      resolveLineCombinationSourceContext({
        requestedTeamId: 59,
        requestedSeasonId: 20242025,
        sourceTeamId: 59,
        sourceSeasonId: 20242025
      })
    ).toEqual({ teamId: 59, seasonId: 20242025 });
  });

  test.each([
    { sourceTeamId: 68, sourceSeasonId: 20242025 },
    { sourceTeamId: 59, sourceSeasonId: 20252026 }
  ])("rejects mismatched source context %#", (source) => {
    expect(() =>
      resolveLineCombinationSourceContext({
        requestedTeamId: 59,
        requestedSeasonId: 20242025,
        ...source
      })
    ).toThrow("Line combination source context does not match the request.");
  });
});

describe("aggregateSkaterToiSeconds", () => {
  test("sums tracked game TOI for each player", () => {
    expect(
      Object.fromEntries(
        aggregateSkaterToiSeconds([
          { playerId: 1, toi: "12:30" },
          { playerId: 1, toi: "10:15" },
          { playerId: 2, toi: "08:00" }
        ])
      )
    ).toEqual({ 1: 1365, 2: 480 });
  });
});

describe("getLineChanges", () => {
  test("game 2023020951 vs 2023020970 | team 26", () => {
    const changes = getLineChanges(lineCombos_2023020951_2023020970 as any);
    expect(changes.promotions).toEqual([
      { playerId: 8482155, currentLine: 2, previousLine: 3 },
      { playerId: 8479400, currentLine: 2, previousLine: 3 },
      { playerId: 8479994, currentLine: 2, previousLine: 3 },
    ]);
    expect(changes.demotions).toEqual([
      { playerId: 8477942, currentLine: 3, previousLine: 2 },
      { playerId: 8479675, currentLine: 3, previousLine: 2 },
      { playerId: 8476479, currentLine: 3, previousLine: 2 },
    ]);
  });
});

describe("convertToLines", () => {
  test("game 2023020970 team 26", () => {
    const input = {
      forwards: [
        8482124, 8471685, 8481532, 8477942, 8479675, 8476479, 8482155, 8479400,
        8479994, 8473453, 8481481,
      ],
      defensemen: [
        8474563, 8479421, 8478882, 8478911, 8477971, 8481606, 8482730,
      ],
      goalies: [8479496, 8475660],
    };
    const expectedResult = {
      forwards: {
        line1: [8482124, 8471685, 8481532],
        line2: [8477942, 8479675, 8476479],
        line3: [8482155, 8479400, 8479994],
        line4: [8473453, 8481481],
      },
      defensemen: {
        line1: [8474563, 8479421],
        line2: [8478882, 8478911],
        line3: [8477971, 8481606],
      },
      goalies: {
        line1: [8479496],
        line2: [8475660],
      },
    };
    expect(convertToLines(input)).toEqual(expectedResult);
  });

  test("game 2023020974 team 22", () => {
    const input = {
      gameId: 2023020974,
      teamId: 22,
      forwards: [
        8477934, 8475786, 8478402, 8475169, 8476454, 8477406, 8477998, 8480802,
        8470621, 8482077, 8474040, 8477015,
      ],
      defensemen: [8475218, 8480803, 8477498, 8479576, 8476879, 8476967],
      goalies: [8475717, 8479973],
    };

    const expectedResult = {
      forwards: {
        line1: [8477934, 8475786, 8478402],
        line2: [8475169, 8476454, 8477406],
        line3: [8477998, 8480802, 8470621],
        line4: [8482077, 8474040, 8477015],
      },
      defensemen: {
        line1: [8475218, 8480803],
        line2: [8477498, 8479576],
        line3: [8476879, 8476967],
      },
      goalies: {
        line1: [8475717],
        line2: [8479973],
      },
    };

    expect(convertToLines(input)).toEqual(expectedResult);
  });
});

describe("getLineCombinations goalie card (W2-P0-12, decision 72)", () => {
  type Rows = Record<string, any[]>;
  function routeTables(
    rows: Rows,
    calls: { table: string; method: string; args: unknown[] }[],
    returned: { table: string; data: any[] }[] = []
  ) {
    fromMock.mockImplementation((table: string) => {
      const own: { method: string; args: unknown[] }[] = [];
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "in", "order", "limit", "range", "returns", "throwOnError", "not", "gt"]) {
        query[method] = vi.fn((...args: unknown[]) => {
          calls.push({ table, method, args });
          own.push({ method, args });
          return query;
        });
      }
      // Honour top-level eq/in filters so each goalie query sees only its rows.
      query.then = (resolve: (value: unknown) => unknown) => {
        const filters = own.filter(
          (call) => (call.method === "eq" || call.method === "in") && !String(call.args[0]).includes(".")
        );
        const matched = (rows[table] ?? []).filter((row) =>
          filters.every(({ method, args: [key, value] }) =>
            !(String(key) in row)
              ? true
              : method === "eq"
                ? row[String(key)] === value
                : (value as unknown[]).includes(row[String(key)])
          )
        );
        // Rows are given in the query's order; honour .range(from, to) paging.
        const range = own.find((call) => call.method === "range")?.args as [number, number] | undefined;
        const data = range ? matched.slice(range[0], range[1] + 1) : matched;
        returned.push({ table, data });
        return resolve({ data, error: null });
      };
      return query;
    });
  }

  const game = (id: number, startTime: string) => ({ id, seasonId: 20252026, startTime });
  const lineRow = (gameId: number, startTime: string) => ({
    gameId,
    teamId: 22,
    forwards: [],
    defensemen: [],
    goalies: ["1", "2"],
    game: { startTime, seasonId: 20252026 }
  });

  const baseRows = (): Rows => ({
    lineCombinations: [lineRow(102, "2026-11-10T00:00:00Z"), lineRow(101, "2026-11-08T00:00:00Z")],
    rosters: [],
    skatersGameStats: [],
    goaliesGameStats: [
      // Goalie 1: a 30-save shutout, then a 10-minute relief stint (1 save on 3 shots).
      { playerId: 1, playerName: "Alpha One", saveShotsAgainst: "30/30", savePctg: 1, toi: "60:00", goalsAgainst: 0, game: game(101, "2026-11-08T00:00:00Z") },
      { playerId: 1, playerName: "Alpha One", saveShotsAgainst: "1/3", savePctg: 1 / 3, toi: "10:00", goalsAgainst: 2, game: game(90, "2026-10-20T00:00:00Z") },
      // Goalie 2: one appearance with no credited decision on record.
      { playerId: 2, playerName: "Beta Two", saveShotsAgainst: "20/22", savePctg: 20 / 22, toi: "60:00", goalsAgainst: 2, game: game(102, "2026-11-10T00:00:00Z") }
    ],
    wgo_goalie_stats: [
      { goalie_id: 1, game_id: 101, wins: 1, losses: 0, ot_losses: 0 },
      { goalie_id: 1, game_id: 90, wins: 0, losses: 0, ot_losses: 0 }
    ],
    gameOutcomes: []
  });

  test("pools SV% and GAA over the goalie's own appearances and shows his credited record", async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    routeTables(baseRows(), calls);
    const result = await getLineCombinations(22, 20252026);
    const alpha = result.goalies.line1[0];

    // Pooled: 31 saves / 33 shots = .939; 2 GA x 3600 / 4200 s = 1.71 (not .667 / 6.00).
    expect(alpha.season.SVPercentage).toBeCloseTo(31 / 33, 6);
    expect(alpha.season.GAA).toBeCloseTo((2 * 3600) / 4200, 6);
    expect(alpha.last10Games.SVPercentage).toBeCloseTo(31 / 33, 6);
    expect(alpha.last10Games.GAA).toBeCloseTo((2 * 3600) / 4200, 6);
    expect(alpha.season.GP).toBe(2);
    expect(alpha.last10Games.SV).toBe(31);
    // Credited decisions: the relief stint is a no-decision, not a team win.
    expect(alpha.season.Record).toBe("1-0-0");

    // The season window is the goalie's season, not the team's line-data games.
    const goalieGameFilters = calls.filter(
      (call) => call.table === "goaliesGameStats" && call.method === "in" && call.args[0] === "gameId"
    );
    expect(goalieGameFilters).toEqual([]);
  });

  test("an appearance without a credited decision leaves the record unknown", async () => {
    routeTables(baseRows(), []);
    const result = await getLineCombinations(22, 20252026);
    const beta = result.goalies.line2[0];
    expect(beta.season.Record).toBeNull();
    expect(beta.last10Games.Record).toBeNull();
  });

  const skaterRows = () =>
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26].map((playerId) => ({
      playerId, numGames: 1, Goals: 0, Assists: 0, PTS: 0, PPP: 0, Shots: 0, Hits: 0, Blocks: 0,
      PlusMinus: 0, playerName: `Skater ${playerId}`, toi: "10:00"
    }));
  const unitRow = (
    game_id: number,
    unit_type: string,
    player_ids: number[],
    clockSeconds: number,
    snapshot_date = "2026-11-11",
    coverage_status = "complete"
  ) => ({
    season_id: 20252026, game_id, team_id: 22, snapshot_date, unit_type, unit_number: 1, player_ids,
    player_count: player_ids.length, unit_toi_seconds: clockSeconds * player_ids.length,
    coverage_status
  });
  // Rank each unit type's rows 1, 2, ... as the builder stores them.
  const ranked = (rows: ReturnType<typeof unitRow>[]) =>
    rows.map((row, index) => ({
      ...row,
      unit_number: rows.slice(0, index).filter((other) => other.unit_type === row.unit_type).length + 1
    }));
  // Overlapping observed units: the board must still place each player once.
  const overlappingUnits = (gameId: number, snapshotDate?: string, coverage?: string) => ranked([
    unitRow(gameId, "forward_line", [11, 12, 13], 300, snapshotDate, coverage),
    unitRow(gameId, "forward_line", [13, 14, 15], 250, snapshotDate, coverage),
    unitRow(gameId, "forward_line", [14, 15, 16], 200, snapshotDate, coverage),
    unitRow(gameId, "forward_line", [17, 18, 19], 100, snapshotDate, coverage),
    unitRow(gameId, "defense_pair", [21, 22], 200, snapshotDate, coverage),
    unitRow(gameId, "defense_pair", [22, 23], 150, snapshotDate, coverage),
    unitRow(gameId, "defense_pair", [23, 24], 100, snapshotDate, coverage),
    unitRow(gameId, "defense_pair", [25, 26], 50, snapshotDate, coverage)
  ]);

  test("by default the board is disjoint observed 5v5 units (decision 137 switch on)", async () => {
    const rows = baseRows();
    rows.skatersGameStats = skaterRows();
    rows.team_unit_toi = [101, 102].flatMap((gameId) => overlappingUnits(gameId));
    // The relief stint's TOI is unknown: GAA stays unknown on the 5v5 board too.
    rows.goaliesGameStats[1] = { ...rows.goaliesGameStats[1], toi: null };
    routeTables(rows, []);
    const result = await getLineCombinations(22, 20252026);
    const lineIds = (line: { playerId: number }[]) => line.map((player) => player.playerId);
    expect(result.lineSource).toBe("five_on_five_observed");
    // Each board unit's 5v5 seconds together in the last game, line 1 first.
    expect(result.fiveOnFiveUnitSeconds).toEqual({ forwards: [300, 200, 100], defense: [200, 100, 50] });
    expect(result.goalies.line1[0].season.GAA).toBeNull();
    expect(result.goalies.line1[0].season.SVPercentage).toBeCloseTo(31 / 33, 6);
    expect(lineIds(result.forwards.line1)).toEqual([11, 12, 13]);
    expect(lineIds(result.forwards.line2)).toEqual([14, 15, 16]);
    expect(lineIds(result.forwards.line3)).toEqual([17, 18, 19]);
    expect(lineIds(result.defensemen.line1)).toEqual([21, 22]);
    expect(lineIds(result.defensemen.line2)).toEqual([23, 24]);
    expect(lineIds(result.defensemen.line3)).toEqual([25, 26]);
    const boardIds = [
      ...Object.values(result.forwards).flatMap(lineIds),
      ...Object.values(result.defensemen).flatMap(lineIds)
    ];
    expect(new Set(boardIds).size).toBe(boardIds.length);
    expect(result.promotions).toEqual([]);
    expect(result.demotions).toEqual([]);
  });

  test("reads 5v5 units within the season and only each game's latest snapshot", async () => {
    const rows = baseRows();
    rows.skatersGameStats = skaterRows();
    rows.team_unit_toi = [
      ...overlappingUnits(102, "2026-11-12"),
      ...overlappingUnits(101, "2026-11-11"),
      // Superseded snapshots: game 101's 11-08 one, and game 102's 11-11 one
      // (which shares its date with game 101's latest).
      ...overlappingUnits(101, "2026-11-08"),
      ...overlappingUnits(102, "2026-11-11")
    ];
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    const returned: { table: string; data: any[] }[] = [];
    routeTables(rows, calls, returned);
    const result = await getLineCombinations(22, 20252026);

    expect(result.lineSource).toBe("five_on_five_observed");
    // Every team_unit_toi read is season-scoped, so its season-led index serves it.
    const unitReads = calls.filter((call) => call.table === "team_unit_toi" && call.method === "select");
    const seasonFilters = calls.filter(
      (call) => call.table === "team_unit_toi" && call.method === "eq" && call.args[0] === "season_id"
    );
    expect(unitReads.length).toBeGreaterThan(0);
    expect(seasonFilters).toHaveLength(unitReads.length);
    expect(seasonFilters.every((call) => call.args[1] === 20252026)).toBe(true);
    // The unit read asks only for the games' latest snapshot dates; the old
    // query read every snapshot, 11-08 included.
    const unitRowsRead = returned
      .filter((entry) => entry.table === "team_unit_toi")
      .flatMap((entry) => entry.data)
      .filter((row) => row.unit_number !== 1);
    expect(unitRowsRead.length).toBeGreaterThan(0);
    expect(new Set(unitRowsRead.map((row) => row.snapshot_date))).toEqual(
      new Set(["2026-11-12", "2026-11-11"])
    );
  });

  test("unknown 5v5 time stays unknown: a partial latest snapshot keeps the labelled legacy board", async () => {
    fromMock.mockClear();
    const rows = baseRows();
    rows.skatersGameStats = skaterRows();
    rows.team_unit_toi = [
      ...overlappingUnits(102),
      // Game 101: an older complete snapshot, superseded by a partial one.
      ...overlappingUnits(101, "2026-11-08"),
      unitRow(101, "forward_line", [11, 12, 13], 40, "2026-11-11", "partial"),
      unitRow(101, "defense_pair", [21, 22], 40, "2026-11-11", "partial")
    ];
    routeTables(rows, []);
    const result = await getLineCombinations(22, 20252026);
    // The partial game is neither read as zero 5v5 time nor replaced by the
    // stale complete snapshot, so the board does not switch.
    expect(fromMock).toHaveBeenCalledWith("team_unit_toi");
    expect(result.lineSource).toBe("all_strength_legacy");
  });

  test("with the switch off, lines stay the labelled legacy grouping", async () => {
    fromMock.mockClear();
    routeTables(baseRows(), []);
    const result = await getLineCombinations(22, 20252026, { fiveOnFive: false });
    expect(result.lineSource).toBe("all_strength_legacy");
    expect(result.fiveOnFiveUnitSeconds).toBeNull();
    expect(fromMock).not.toHaveBeenCalledWith("team_unit_toi");
  });

  test("unknown goalie TOI leaves GAA unknown instead of dropping the game", async () => {
    const rows = baseRows();
    rows.goaliesGameStats[1] = { ...rows.goaliesGameStats[1], toi: null };
    routeTables(rows, []);
    const result = await getLineCombinations(22, 20252026);
    const alpha = result.goalies.line1[0];
    expect(alpha.season.GAA).toBeNull();
    expect(alpha.season.SVPercentage).toBeCloseTo(31 / 33, 6);
  });

  describe("getLatestLineChanges (batched /lines landing reader)", () => {
    const teamLineRow = (
      teamId: number,
      gameId: number,
      startTime: string,
      forwards: number[] = [],
      defensemen: number[] = []
    ) => ({
      gameId,
      teamId,
      forwards: forwards.map(String),
      defensemen: defensemen.map(String),
      goalies: ["1", "2"],
      game: { startTime, seasonId: 20252026 }
    });
    const forTeam = (teamId: number, rows: ReturnType<typeof unitRow>[]) =>
      rows.map((row) => ({ ...row, team_id: teamId }));
    // The lines of overlappingUnits, but the third line on top and the first third.
    const swappedUnits = (gameId: number, snapshotDate?: string) => ranked([
      unitRow(gameId, "forward_line", [17, 18, 19], 300, snapshotDate),
      unitRow(gameId, "forward_line", [14, 15, 16], 200, snapshotDate),
      unitRow(gameId, "forward_line", [11, 12, 13], 100, snapshotDate),
      unitRow(gameId, "defense_pair", [21, 22], 200, snapshotDate),
      unitRow(gameId, "defense_pair", [23, 24], 100, snapshotDate),
      unitRow(gameId, "defense_pair", [25, 26], 50, snapshotDate)
    ]);
    const TEAMS = [22, 10, 30, 40];

    // Newest first, as the queries order them. 22 and 10 meet in game 202.
    const landingRows = (): Rows => ({
      ...baseRows(),
      skatersGameStats: skaterRows(),
      lineCombinations: [
        teamLineRow(30, 203, "2026-11-12T02:00:00Z", [31, 32, 33, 34, 35, 36], [37, 38]),
        teamLineRow(22, 202, "2026-11-12T00:00:00Z", [11, 12, 13, 14, 15, 16], [21, 22]),
        teamLineRow(10, 202, "2026-11-12T00:00:00Z", [61, 62, 63, 64, 65, 66], [67, 68]),
        teamLineRow(40, 201, "2026-11-11T00:00:00Z", [41, 42, 43], [44, 45]),
        teamLineRow(22, 102, "2026-11-10T00:00:00Z", [11, 12, 13, 14, 15, 16], [21, 22]),
        teamLineRow(10, 101, "2026-11-09T00:00:00Z", [64, 65, 66, 61, 62, 63], [67, 68]),
        teamLineRow(30, 100, "2026-11-08T00:00:00Z", [34, 35, 36, 31, 32, 33], [37, 38]),
        // A third game: only each team's two latest count.
        teamLineRow(22, 99, "2026-11-06T00:00:00Z", [16, 15, 14, 13, 12, 11], [22, 21])
      ],
      team_unit_toi: [
        // Team 22: game 202 latest 11-13; its older 11-12 snapshot shares a
        // date with game 102's latest and must not be read as current.
        ...forTeam(22, overlappingUnits(202, "2026-11-13")),
        ...forTeam(22, swappedUnits(202, "2026-11-12")),
        ...forTeam(22, swappedUnits(102, "2026-11-12")),
        ...forTeam(22, overlappingUnits(102, "2026-11-11")),
        // Team 10 (same game 202): complete latest, but game 101's latest
        // snapshot is partial over an older complete one.
        ...forTeam(10, overlappingUnits(202, "2026-11-13")),
        ...forTeam(10, overlappingUnits(101, "2026-11-10")),
        ...forTeam(10, [unitRow(101, "forward_line", [11, 12, 13], 40, "2026-11-12", "partial")])
        // Team 30: no team_unit_toi rows. Team 40: one game this season.
      ]
    });

    const summary = (result: Awaited<ReturnType<typeof getLineCombinations>>) => ({
      lineSource: result.lineSource,
      fiveOnFiveUnitSeconds: result.fiveOnFiveUnitSeconds,
      promotions: result.promotions,
      demotions: result.demotions
    });

    test("gives every team the same result as the per-team path", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      routeTables(landingRows(), []);
      const batched = await getLatestLineChanges(TEAMS, 20252026);

      for (const teamId of [22, 10, 30]) {
        expect(batched.get(teamId)).toEqual(summary(await getLineCombinations(teamId, 20252026)));
      }
      // Fewer than two games: the per-team path throws, the batch leaves it out.
      await expect(getLineCombinations(40, 20252026)).rejects.toThrow(/at least 2 games/);
      expect(batched.has(40)).toBe(false);

      // The fixtures exercise both boards and the latest snapshot.
      expect(batched.get(22)).toMatchObject({
        lineSource: "five_on_five_observed",
        fiveOnFiveUnitSeconds: { forwards: [300, 200, 100], defense: [200, 100, 50] }
      });
      expect(batched.get(22)!.promotions.map((change) => change.playerId).sort()).toEqual([11, 12, 13]);
      expect(batched.get(10)!.lineSource).toBe("all_strength_legacy");
      expect(batched.get(10)!.promotions.map((change) => change.playerId).sort()).toEqual([61, 62, 63]);
      expect(batched.get(30)!.lineSource).toBe("all_strength_legacy");
      errorSpy.mockRestore();
    });

    test("reads a few queries for all teams instead of up to eight per team", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const batchedReads: { table: string; data: any[] }[] = [];
      routeTables(landingRows(), [], batchedReads);
      await getLatestLineChanges(TEAMS, 20252026);

      const perTeamReads: { table: string; data: any[] }[] = [];
      routeTables(landingRows(), [], perTeamReads);
      for (const teamId of TEAMS) await getLineCombinations(teamId, 20252026).catch(() => null);

      // Per team: lineCombinations, rosters, team_unit_toi x2 (x1 when a game
      // has no rows), skatersGameStats x2, goaliesGameStats, wgo_goalie_stats.
      expect(perTeamReads).toHaveLength(8 + 8 + 7 + 1);
      expect(batchedReads.map((read) => read.table)).toEqual([
        "lineCombinations",
        "team_unit_toi",
        "team_unit_toi"
      ]);
      errorSpy.mockRestore();
    });

    test("pages newest first until every team has its two latest games", async () => {
      const rows = landingRows();
      // 200 rows from another team, between its games, push team 22's second game to page 2.
      const filler = Array.from({ length: 200 }, (_, index) =>
        teamLineRow(50, 1000 - index, "2026-11-11T00:00:00Z")
      );
      rows.lineCombinations = [rows.lineCombinations[1], ...filler, rows.lineCombinations[4]];
      const reads: { table: string; data: any[] }[] = [];
      routeTables(rows, [], reads);
      const batched = await getLatestLineChanges([22, 50], 20252026);

      expect(reads.filter((read) => read.table === "lineCombinations")).toHaveLength(2);
      expect(batched.get(22)).toEqual(summary(await getLineCombinations(22, 20252026)));
      expect(batched.get(22)!.lineSource).toBe("five_on_five_observed");
    });
  });
});

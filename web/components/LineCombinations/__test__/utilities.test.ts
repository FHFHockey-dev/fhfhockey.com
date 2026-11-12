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
  function routeTables(rows: Rows, calls: { table: string; method: string; args: unknown[] }[]) {
    fromMock.mockImplementation((table: string) => {
      const own: { method: string; args: unknown[] }[] = [];
      const query: Record<string, any> = {};
      for (const method of ["select", "eq", "in", "order", "limit", "returns", "throwOnError", "not", "gt"]) {
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
        const data = (rows[table] ?? []).filter((row) =>
          filters.every(({ method, args: [key, value] }) =>
            !(String(key) in row)
              ? true
              : method === "eq"
                ? row[String(key)] === value
                : (value as unknown[]).includes(row[String(key)])
          )
        );
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

  test("unknown goalie TOI leaves GAA unknown instead of dropping the game", async () => {
    const rows = baseRows();
    rows.goaliesGameStats[1] = { ...rows.goaliesGameStats[1], toi: null };
    routeTables(rows, []);
    const result = await getLineCombinations(22, 20252026);
    const alpha = result.goalies.line1[0];
    expect(alpha.season.GAA).toBeNull();
    expect(alpha.season.SVPercentage).toBeCloseTo(31 / 33, 6);
  });
});

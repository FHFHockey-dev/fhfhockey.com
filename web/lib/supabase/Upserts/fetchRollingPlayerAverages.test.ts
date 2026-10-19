import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAlignedCountSupportBuilder } from "lib/rollingPlayerCountSupport";
import {
  createHistoricalRatioAccumulator,
  createRatioRollingAccumulator,
  updateHistoricalRatioAccumulator,
  updateRatioRollingAccumulator
} from "./rollingMetricAggregation";
import {
  createHistoricalAverageAccumulator,
  updateHistoricalAverageAccumulator
} from "./rollingHistoricalAverages";

let fetchCounts: typeof import("./fetchRollingPlayerAverages").__testables.fetchCounts;
let buildGameRecords: typeof import("./fetchRollingPlayerAverages").__testables.buildGameRecords;
let buildRunSummary: typeof import("./fetchRollingPlayerAverages").__testables.buildRunSummary;
let summarizeSourceTracking: typeof import("./fetchRollingPlayerAverages").__testables.summarizeSourceTracking;
let getGoalsPer60ToiSeconds: typeof import("./fetchRollingPlayerAverages").__testables.getGoalsPer60ToiSeconds;
let getToiSeconds: typeof import("./fetchRollingPlayerAverages").__testables.getToiSeconds;
let normalizeNumericFields: typeof import("./fetchRollingPlayerAverages").__testables.normalizeNumericFields;
let didPlayerCountAsAppearance: typeof import("./fetchRollingPlayerAverages").__testables.didPlayerCountAsAppearance;
let applyGpOutputs: typeof import("./fetchRollingPlayerAverages").__testables.applyGpOutputs;
let getGpOutputCompatibilityMode: typeof import("./fetchRollingPlayerAverages").__testables.getGpOutputCompatibilityMode;
let deriveOutputs: typeof import("./fetchRollingPlayerAverages").__testables.deriveOutputs;
let getOptionalPpContextOutputs: typeof import("./fetchRollingPlayerAverages").__testables.getOptionalPpContextOutputs;
let initAccumulator: typeof import("./fetchRollingPlayerAverages").__testables.initAccumulator;
let normalizeStrengthStates: typeof import("./fetchRollingPlayerAverages").__testables.normalizeStrengthStates;
let normalizePlayerIdList: typeof import("./fetchRollingPlayerAverages").__testables.normalizePlayerIdList;
let shouldUseDateScopedPlayerSelection: typeof import("./fetchRollingPlayerAverages").__testables.shouldUseDateScopedPlayerSelection;
let buildPlayerHistoryReadOptions: typeof import("./fetchRollingPlayerAverages").__testables.buildPlayerHistoryReadOptions;
let isWithinRequestedWriteWindow: typeof import("./fetchRollingPlayerAverages").__testables.isWithinRequestedWriteWindow;
let shouldWarnAboutDisabledImplicitAutoResume: typeof import("./fetchRollingPlayerAverages").__testables.shouldWarnAboutDisabledImplicitAutoResume;
let filterPlayerIdsForResume: typeof import("./fetchRollingPlayerAverages").__testables.filterPlayerIdsForResume;
let splitRollingUpsertRowForDurableStorage: typeof import("./fetchRollingPlayerAverages").__testables.splitRollingUpsertRowForDurableStorage;
let upsertRollingPlayerMetricsBatch: typeof import("./fetchRollingPlayerAverages").__testables.upsertRollingPlayerMetricsBatch;
let compactRollingUpsertRowForRankingStorage: typeof import("./fetchRollingPlayerAverages").compactRollingUpsertRowForRankingStorage;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.resetModules();
  ({
    __testables: {
      fetchCounts,
      buildGameRecords,
      buildRunSummary,
      summarizeSourceTracking,
      getGoalsPer60ToiSeconds,
      getToiSeconds,
      normalizeNumericFields,
      didPlayerCountAsAppearance,
      applyGpOutputs,
      getGpOutputCompatibilityMode,
      deriveOutputs,
      getOptionalPpContextOutputs,
      initAccumulator,
      normalizeStrengthStates,
      normalizePlayerIdList,
      shouldUseDateScopedPlayerSelection,
      buildPlayerHistoryReadOptions,
      isWithinRequestedWriteWindow,
      shouldWarnAboutDisabledImplicitAutoResume,
      filterPlayerIdsForResume,
      splitRollingUpsertRowForDurableStorage,
      upsertRollingPlayerMetricsBatch
    },
    compactRollingUpsertRowForRankingStorage
  } = await import("./fetchRollingPlayerAverages"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchRollingPlayerAverages fetchGames", () => {
  it("pages games by date with a unique id tie-breaker", async () => {
    const games = Array.from({ length: 1001 }, (_, index) => ({
      id: 2025020001 + index,
      date: "2026-01-01",
      homeTeamId: 1,
      awayTeamId: 2,
      seasonId: 20252026
    }));
    const pageOrders: Array<Array<{ key: string; ascending: boolean }>> = [];
    const client = {
      from(table: string) {
        expect(table).toBe("games");
        const orders: Array<{ key: string; ascending: boolean }> = [];
        const query = {
          select: () => query,
          order(key: string, options?: { ascending?: boolean }) {
            orders.push({ key, ascending: options?.ascending ?? true });
            return query;
          },
          async range(from: number, to: number) {
            pageOrders.push(orders);
            return { data: games.slice(from, to + 1), error: null };
          }
        };
        return query;
      }
    };

    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => client }));
    try {
      const { __testables } = await import("./fetchRollingPlayerAverages");
      const rows = await __testables.fetchGames();

      expect(rows).toHaveLength(1001);
      expect(pageOrders).toEqual([
        [
          { key: "date", ascending: true },
          { key: "id", ascending: true }
        ],
        [
          { key: "date", ascending: true },
          { key: "id", ascending: true }
        ]
      ]);
    } finally {
      vi.doUnmock("@supabase/supabase-js");
    }
  });
});

describe("fetchRollingPlayerAverages main full refresh", () => {
  function createEmptyClient() {
    const result = { data: [], error: null, count: 0 };
    const tables: string[] = [];
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      rpc,
      from(table: string) {
        tables.push(table);
        const query: Record<string, unknown> = {};
        for (const method of ["select", "eq", "neq", "in", "gt", "gte", "lt", "lte", "is", "not", "or", "order", "limit", "range", "delete"]) {
          query[method] = () => query;
        }
        query.maybeSingle = async () => ({ data: null, error: null });
        query.single = async () => ({ data: null, error: null });
        query.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject);
        return query;
      }
    };
    return { client, tables, rpc };
  }

  async function importMainWithClient(client: unknown) {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => client }));
    try {
      return (await import("./fetchRollingPlayerAverages")).main;
    } finally {
      vi.doUnmock("@supabase/supabase-js");
    }
  }

  it.each([
    [{ playerId: 8478402 }, "playerId"],
    [{ dryRunUpsert: true }, "dryRunUpsert"],
    [{ maxPlayers: 5 }, "maxPlayers"],
    [{ season: 20252026, startDate: "2026-03-01" }, "season, startDate"]
  ] as const)("refuses an explicit truncate with %o before touching the database", async (scope, flags) => {
    const { client, tables, rpc } = createEmptyClient();
    const main = await importMainWithClient(client);

    await expect(
      main({ forceFullRefresh: true, fullRefreshMode: "rpc_truncate", ...scope })
    ).rejects.toThrow(`cannot be combined with ${flags}`);
    expect(rpc).not.toHaveBeenCalled();
    expect(tables).toEqual([]);
  });

  it("never truncates for a full refresh that does not opt in", async () => {
    const { client, rpc } = createEmptyClient();
    const main = await importMainWithClient(client);

    await main({ forceFullRefresh: true, dryRunUpsert: true, playerId: 8478402 });

    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("fetchRollingPlayerAverages main runtime budget", () => {
  const PLAYER_IDS = [8470001, 8470002, 8470003, 8470004, 8470005, 8470006, 8470007];

  // Serves a 14-day window in which every player has one WGO game, so each
  // processed player yields exactly one dry-run batch.
  function createWindowClient(
    historyRows: (playerId: unknown) => Record<string, unknown>[] = (playerId) => [{
      player_id: playerId,
      game_id: 2026020100,
      date: "2026-10-15",
      season_id: 20262027,
      team_abbrev: "TOR",
      goals: 1,
      assists: 0,
      shots: 3,
      points: 1,
      toi_per_game: 1080
    }],
    games: Record<string, unknown>[] = []
  ) {
    return {
      rpc: vi.fn(async () => ({ data: null, error: null })),
      from(table: string) {
        const filters: Record<string, unknown> = {};
        let selected = "";
        let rangeFrom = 0;
        const query: Record<string, unknown> = {};
        for (const method of ["neq", "gt", "gte", "lt", "lte", "is", "not", "or", "order", "limit", "delete"]) {
          query[method] = () => query;
        }
        query.select = (fields: string) => { selected = fields; return query; };
        query.eq = (field: string, value: unknown) => { filters[field] = value; return query; };
        query.in = (field: string, values: unknown[]) => { filters[field] = values; return query; };
        query.range = (from: number) => { rangeFrom = from; return query; };
        const rows = () => {
          if (rangeFrom > 0) return [];
          if (table === "games") return games;
          if (table === "players") {
            return (filters.id as number[]).map((id) => ({ id }));
          }
          if (table !== "wgo_skater_stats") return [];
          if (selected === "player_id") {
            return PLAYER_IDS.map((player_id) => ({ player_id }));
          }
          return historyRows(filters.player_id);
        };
        query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
        return query;
      }
    };
  }

  async function importMainWithClient(client: unknown) {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => client }));
    try {
      return (await import("./fetchRollingPlayerAverages")).main;
    } finally {
      vi.doUnmock("@supabase/supabase-js");
    }
  }

  it("stops claiming at the budget and resumes so every player is processed exactly once", async () => {
    for (const method of ["info", "warn", "debug", "time", "timeEnd"] as const) {
      vi.spyOn(console, method).mockImplementation(() => undefined);
    }
    let fakeNow = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
    const processed: number[] = [];
    const observer = (batch: { playerId: number }) => {
      processed.push(batch.playerId);
      // Each player costs 10 fake ms of runtime.
      fakeNow += 10;
    };
    const main = await importMainWithClient(createWindowClient());
    const window = {
      startDate: "2026-10-05",
      endDate: "2026-10-19",
      dryRunUpsert: true,
      skipDiagnostics: true,
      playerConcurrency: 2,
      dryRunBatchObserver: observer
    };

    const first = await main({ ...window, stopClaimingPlayersAtMs: 1_025 });

    // With two workers, whatever was claimed before the deadline finished,
    // and the processed players are an id-ordered prefix.
    const firstCount = processed.length;
    expect(firstCount).toBeGreaterThan(0);
    expect(firstCount).toBeLessThan(PLAYER_IDS.length);
    expect(processed).toEqual(PLAYER_IDS.slice(0, firstCount));
    expect(first).toMatchObject({
      stoppedReason: "runtime_budget",
      processedPlayers: firstCount,
      lastProcessedPlayerId: PLAYER_IDS[firstCount - 1],
      nextResumeFrom: PLAYER_IDS[firstCount - 1],
      remainingPlayerCount: PLAYER_IDS.length - firstCount,
      totalPlayersAfterResumeFilter: PLAYER_IDS.length
    });

    const second = await main({
      ...window,
      resumePlayerId: first.nextResumeFrom ?? undefined,
      stopClaimingPlayersAtMs: fakeNow + 1_000
    });

    expect(second).toMatchObject({
      stoppedReason: "complete",
      processedPlayers: PLAYER_IDS.length - firstCount,
      nextResumeFrom: null,
      remainingPlayerCount: 0
    });
    expect(processed).toEqual(PLAYER_IDS);
    expect(new Set(processed).size).toBe(PLAYER_IDS.length);
  });

  it("writes the same window rows as a full-history run while skipping earlier output rows", async () => {
    for (const method of ["info", "warn", "debug", "time", "timeEnd"] as const) {
      vi.spyOn(console, method).mockImplementation(() => undefined);
    }
    const historyGames = [
      ["2025-11-02", 20252026, 2025020150, 2, 4, 1150],
      ["2026-01-12", 20252026, 2025020700, 0, 1, 990],
      ["2026-03-30", 20252026, 2025021150, 1, 5, 1210],
      ["2026-10-09", 20262027, 2026020020, 0, 2, 1040],
      ["2026-10-15", 20262027, 2026020100, 1, 3, 1080],
      ["2026-10-18", 20262027, 2026020140, 2, 6, 1300]
    ] as const;
    // Canonical games let the stateful aligned-count builder see every game.
    const games = historyGames.map(([date, seasonId, id]) => ({
      id,
      date,
      seasonId,
      homeTeamId: 10,
      awayTeamId: 8
    }));
    const history = (playerId: unknown) =>
      historyGames.map(([date, season_id, game_id, goals, shots, toi_per_game]) => ({
        player_id: playerId,
        game_id,
        date,
        season_id,
        team_abbrev: "TOR",
        goals,
        assists: 1,
        shots,
        points: Number(goals) + 1,
        toi_per_game
      }));
    const collect = async (scope: Record<string, unknown>) => {
      const rows: Record<string, unknown>[] = [];
      const main = await importMainWithClient(createWindowClient(history, games));
      await main({
        playerId: PLAYER_IDS[0],
        dryRunUpsert: true,
        skipDiagnostics: true,
        dryRunBatchObserver: (batch) => {
          rows.push(...batch.rankingRows, ...batch.supportRows);
        },
        ...scope
      });
      return rows;
    };

    const fullHistory = await collect({});
    const windowed = await collect({ startDate: "2026-10-10", endDate: "2026-10-19" });

    const inWindow = (row: Record<string, unknown>) =>
      String(row.game_date) >= "2026-10-10" && String(row.game_date) <= "2026-10-19";
    expect(fullHistory.filter((row) => !inWindow(row)).length).toBeGreaterThan(0);
    expect(windowed.length).toBeGreaterThan(0);
    expect(windowed).toEqual(fullHistory.filter(inWindow));
  });

  it("keeps WGO rows whose season label contradicts their date out of the three-season totals", async () => {
    for (const method of ["info", "warn", "debug", "time", "timeEnd"] as const) {
      vi.spyOn(console, method).mockImplementation(() => undefined);
    }
    // Production wgo_skater_stats labels its 2010-12-20..2017-01-16 rows
    // season_id 20242025, so veterans' 2014-15 games look like 2024-25 games.
    const historyGames = [
      ["2014-10-20", 20242025, 5, 1200],
      ["2014-11-03", 20242025, 5, 1200],
      ["2015-01-15", 20242025, 5, 1200],
      ["2024-11-02", 20242025, 1, 1000],
      ["2025-02-10", 20242025, 1, 1000],
      ["2025-11-02", 20252026, 1, 1000],
      ["2026-01-12", 20252026, 1, 1000],
      ["2026-10-09", 20262027, 1, 1000],
      ["2026-10-15", 20262027, 1, 1000]
    ] as const;
    const history = (playerId: unknown) =>
      historyGames.map(([date, season_id, hits, toi_per_game]) => ({
        player_id: playerId,
        game_id: null,
        date,
        season_id,
        team_abbrev: "TOR",
        goals: 0,
        assists: 0,
        shots: 1,
        points: 0,
        hits,
        blocked_shots: 1,
        toi_per_game
      }));
    const supportRows: Array<Record<string, any>> = [];
    const main = await importMainWithClient(createWindowClient(history));
    await main({
      playerId: PLAYER_IDS[0],
      strengths: ["all"],
      startDate: "2026-10-10",
      endDate: "2026-10-19",
      dryRunUpsert: true,
      skipDiagnostics: true,
      dryRunBatchObserver: (batch) => {
        supportRows.push(...batch.supportRows);
      }
    });

    expect(supportRows.map((row) => row.game_date)).toEqual(["2026-10-15"]);
    const historical = supportRows[0].support_payload.historicalCompatibility;
    // 2024-25 through 2026-27 hold six real games: 6 hits, 6000 s, 6 blocks.
    expect(historical).toMatchObject({
      hits_per_60_hits_3ya: 6,
      hits_per_60_toi_seconds_3ya: 6000,
      blocks_per_60_blocks_3ya: 6,
      three_year_games_played: 6,
      hits_per_60_hits_career: 21,
      career_games_played: 9
    });
  });

  it("keeps the incoming cursor when the budget is spent before any player is claimed", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const main = await importMainWithClient(createWindowClient());

    const summary = await main({
      startDate: "2026-10-05",
      endDate: "2026-10-19",
      dryRunUpsert: true,
      resumePlayerId: PLAYER_IDS[1],
      stopClaimingPlayersAtMs: 5_000
    });

    expect(summary).toMatchObject({
      stoppedReason: "runtime_budget",
      processedPlayers: 0,
      lastProcessedPlayerId: null,
      nextResumeFrom: PLAYER_IDS[1],
      remainingPlayerCount: 5
    });
  });
});

describe("fetchRollingPlayerAverages buildGameRecords", () => {
  it.each([
    ["ev", { es_toi_per_game: 866 }, 866],
    ["pp", { pp_toi: 0 }, 0],
    ["pp", { pp_toi: 207, pp_toi_per_game: 120 }, 207],
    ["pp", { pp_toi_per_game: 2.6 }, 2.6],
    ["pk", { sh_toi_per_game: 35 }, 35],
    ["5v5", { toi_per_game_5v5: 120 }, 120],
    ["ev", {}, null],
    ["pp", {}, null],
    ["pk", {}, null],
    ["5v5", {}, null],
    ["pp", { pp_toi: "" }, null],
    ["pp", { pp_toi: " " }, null],
    ["pp", { pp_toi: "120" }, 120],
    ["all", {}, 901]
  ] as const)("uses matching %s TOI without dropping the WGO appearance", (strength, fields, expected) => {
    const rows = buildGameRecords([
      normalizeNumericFields({
        player_id: 8476374,
        game_id: 2026020003,
        date: "2026-09-29",
        season_id: 20262027,
        team_abbrev: "BOS",
        current_team_abbreviation: "BOS",
        toi_per_game: 901,
        ...fields
      }) as any
    ], {}, {}, {}, [], [], strength, new Set([2026020003]));

    expect(rows).toHaveLength(1);
    expect(rows[0].gameId).toBe(2026020003);
    expect(rows[0].fallbackToiSeconds).toBe(expected);
    expect(getToiSeconds(rows[0])).toBe(expected);
    expect(rows[0].sourceContext.resolvedToiSource).toBe(expected == null ? "none" : "fallback");
    expect(rows[0].sourceContext.wgoToiNormalization).toBe(
      expected == null ? ("pp_toi" in fields ? "invalid" : "missing") : "already_seconds"
    );
  });

  it("preserves split-strength zero and NST precedence over conflicting fallbacks", () => {
    const date = "2026-10-03";
    const [game] = buildGameRecords([
      { player_id: 8473512, game_id: 2026020023, date, season_id: 20262027,
        team_abbrev: "OTT", toi_per_game: 1097, es_toi_per_game: 823, pp_toi: 207 } as any
    ], { [date]: { toi: 0 } as any }, { [date]: { toi_per_gp: 150 } as any },
    { [date]: { toi: 100 } as any }, [], [], "pp", new Set([2026020023]));

    expect(getToiSeconds(game)).toBe(0);
    expect(getGoalsPer60ToiSeconds(game)).toBe(0);
    expect(game.sourceContext.resolvedToiSource).toBe("counts");
    expect(game.sourceContext.toiTrustTier).toBe("authoritative");
    expect(didPlayerCountAsAppearance("pp", game)).toBe(false);
    expect(summarizeSourceTracking([game], "pp").toiSuspiciousReasons.non_positive).toBe(0);
  });

  it("uses the retained Giroux strength seconds and keeps the dedicated PP builder contract", () => {
    const wgo = {
      player_id: 8473512, game_id: 2026020023, date: "2026-10-03", season_id: 20262027,
      team_abbrev: "OTT", toi_per_game: 1097, es_toi_per_game: 823, pp_toi: 207
    };
    const pp = [{ gameId: 2026020023, playerId: 8473512, PPTOI: 207 } as any];
    for (const [strength, seconds] of [["all", 1097], ["ev", 823], ["pp", 207]] as const) {
      const [game] = buildGameRecords([wgo as any], {}, {}, {}, [], pp, strength, new Set([2026020023]));
      expect(getToiSeconds(game)).toBe(seconds);
      expect(didPlayerCountAsAppearance(strength, game)).toBe(true);
      if (strength === "pp") expect(getGoalsPer60ToiSeconds(game)).toBe(207);
    }
  });

  it("preserves the WGO row spine when NST enrichment rows are missing", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 42,
          game_id: 1001,
          date: "2026-01-10",
          season_id: 20252026,
          team_abbrev: "COL",
          current_team_abbreviation: "COL",
          toi_per_game: 18.5,
          pp_toi: 0,
          points: 1,
          shots: 2,
          goals: 0,
          assists: 1,
          hits: 3,
          blocked_shots: 1
        } as any
      ],
      {},
      {},
      {},
      [],
      [],
      "all",
      new Set([1001])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 42,
      gameId: 1001,
      gameDate: "2026-01-10",
      season: 20252026,
      strength: "all",
      counts: undefined,
      rates: undefined,
      countsOi: undefined
    });
    expect(rows[0].sourceContext.rowSpine).toBe("wgo");
    expect(rows[0].sourceContext.countsSourcePresent).toBe(false);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(false);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(false);
  });

  it("nulls unknown game ids in the stored row while preserving the source id for diagnostics", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 99,
          game_id: 5555,
          date: "2026-02-01",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: 20,
          pp_toi: 120
        } as any
      ],
      {},
      {},
      {},
      [],
      [],
      "all",
      new Set([7777])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].gameId).toBe(null);
    expect(rows[0].sourceContext.originalGameId).toBe(5555);
    expect(rows[0].sourceContext.hasKnownGameId).toBe(false);
  });

  it("merges counts, rates, on-ice, PP, and line data into a single row with explicit source context", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 7,
          game_id: 2001,
          date: "2026-01-15",
          season_id: null,
          team_abbrev: "COL",
          current_team_abbreviation: "COL",
          toi_per_game: 19,
          pp_toi: 150
        } as any
      ],
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          season: 20252026,
          goals: 1,
          shots: 5,
          toi: 1100
        } as any
      },
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          season: 20252026,
          toi_per_gp: 999,
          shots_per_60: 16
        } as any
      },
      {
        "2026-01-15": {
          date_scraped: "2026-01-15",
          toi: 1050,
          cf: 20
        } as any
      },
      [
        {
          gameId: 2001,
          teamId: 21,
          forwards: [7, 8, 9],
          defensemen: [10, 11],
          goalies: [12]
        }
      ],
      [
        {
          gameId: 2001,
          playerId: 7,
          PPTOI: 150,
          percentageOfPP: 1.2,
          unit: 1,
          pp_share_of_team: 0.65,
          pp_unit_usage_index: 1.2,
          pp_unit_relative_toi: 25,
          pp_vs_unit_avg: 0.2
        } as any
      ],
      "all",
      new Set([2001])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 7,
      gameId: 2001,
      season: 20252026,
      teamId: 21,
      strength: "all",
      ppCombination: {
        gameId: 2001,
        playerId: 7,
        PPTOI: 150,
        unit: 1,
        pp_share_of_team: 0.65,
        pp_unit_usage_index: 1.2,
        pp_unit_relative_toi: 25,
        pp_vs_unit_avg: 0.2
      },
      lineCombo: { slot: 1, positionGroup: "forward" }
    });
    expect(rows[0].ppCombination).not.toHaveProperty("percentageOfPP");
    expect(rows[0].counts?.goals).toBe(1);
    expect(rows[0].rates?.shots_per_60).toBe(16);
    expect(rows[0].countsOi?.cf).toBe(20);
    expect(rows[0].sourceContext.seasonSource).toBe("counts");
    expect(rows[0].sourceContext.countsSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(true);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppUnitSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineAssignmentSourcePresent).toBe(true);
    expect(rows[0].sourceContext.resolvedToiSource).toBe("counts");
    expect(rows[0].sourceContext.toiTrustTier).toBe("authoritative");
    expect(rows[0].sourceContext.wgoToiNormalization).toBe("missing");
  });

  it("preserves true 5v5 strength rows and on-ice xG enrichment", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 7,
          game_id: 2001,
          date: "2026-03-01",
          season_id: 20252026,
          team_abbrev: "COL",
          current_team_abbreviation: "COL",
          toi_per_game: 18
        } as any
      ],
      {
        "2026-03-01": {
          date_scraped: "2026-03-01",
          season: 20252026,
          goals: 1,
          toi: 900
        } as any
      },
      {
        "2026-03-01": {
          date_scraped: "2026-03-01",
          season: 20252026,
          toi_per_gp: 900,
          ixg_per_60: 0.9
        } as any
      },
      {
        "2026-03-01": {
          date_scraped: "2026-03-01",
          toi: 900,
          gf: 2,
          ga: 1,
          xgf: 1.7,
          xga: 0.8
        } as any
      },
      [],
      [],
      "5v5",
      new Set([2001])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 7,
      gameDate: "2026-03-01",
      strength: "5v5"
    });
    expect(rows[0].countsOi?.xgf).toBe(1.7);
    expect(rows[0].countsOi?.xga).toBe(0.8);
    expect(rows[0].sourceContext.countsSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ratesSourcePresent).toBe(true);
    expect(rows[0].sourceContext.countsOiSourcePresent).toBe(true);
  });

  it("maps optional PP context fields to row outputs without changing pp_share semantics", () => {
    expect(
      getOptionalPpContextOutputs({
        ppCombination: {
          gameId: 2001,
          playerId: 7,
          PPTOI: 150,
          unit: 1,
          pp_share_of_team: 0.65,
          pp_unit_usage_index: 1.2,
          pp_unit_relative_toi: 25,
          pp_vs_unit_avg: 0.2
        }
      } as any)
    ).toEqual({
      pp_share_of_team: 0.65,
      pp_unit_usage_index: 1.2,
      pp_unit_relative_toi: 25,
      pp_vs_unit_avg: 0.2
    });
  });

  it("treats pp_unit as an independently trusted contextual label", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 7,
          game_id: 2002,
          date: "2026-01-18",
          season_id: 20252026,
          team_abbrev: "NYR",
          current_team_abbreviation: "NYR",
          toi_per_game: 18,
          pp_toi: 120
        } as any
      ],
      {},
      {},
      {},
      [],
      [
        {
          gameId: 2002,
          playerId: 7,
          PPTOI: 120,
          unit: null,
          pp_share_of_team: 0.55
        } as any
      ],
      "all",
      new Set([2002])
    );

    expect(rows[0].sourceContext.ppSourcePresent).toBe(true);
    expect(rows[0].sourceContext.ppUnitSourcePresent).toBe(false);
  });

  it("uses PP TOI for PP goals per 60 fallback rows instead of all-situations TOI", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 88,
          game_id: 2004,
          date: "2026-01-21",
          season_id: 20252026,
          team_abbrev: "NYR",
          current_team_abbreviation: "NYR",
          goals: 2,
          pp_goals: 1,
          toi_per_game: 960,
          pp_toi: 120
        } as any
      ],
      {},
      {},
      {},
      [],
      [],
      "pp",
      new Set([2004])
    );

    expect(getGoalsPer60ToiSeconds(rows[0] as any)).toBe(120);
  });

  it("distinguishes line row presence from trusted player line assignment", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 77,
          game_id: 2003,
          date: "2026-01-20",
          season_id: 20252026,
          team_abbrev: "NYR",
          current_team_abbreviation: "NYR",
          toi_per_game: 15,
          pp_toi: 0
        } as any
      ],
      {},
      {},
      {},
      [
        {
          gameId: 2003,
          teamId: 3,
          forwards: [1, 2, 3],
          defensemen: [4, 5],
          goalies: [6]
        }
      ],
      [],
      "all",
      new Set([2003])
    );

    expect(rows[0].sourceContext.lineSourcePresent).toBe(true);
    expect(rows[0].sourceContext.lineAssignmentSourcePresent).toBe(false);
    expect(rows[0].lineCombo).toEqual({ slot: null, positionGroup: null });
  });

  it("tracks fallback-heavy rows and null-source gaps through sourceTracking summaries", () => {
    const rows = buildGameRecords(
      [
        {
          player_id: 55,
          game_id: 3001,
          date: "2026-02-10",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: 18,
          pp_toi: 90,
          goals: 1,
          assists: 2,
          total_primary_assists: 1,
          total_secondary_assists: 1,
          shots: 4,
          hits: 3,
          blocked_shots: 2,
          points: 3,
          ixg: 0.9
        } as any,
        {
          player_id: 55,
          game_id: 3002,
          date: "2026-02-12",
          season_id: 20252026,
          team_abbrev: "NJD",
          current_team_abbreviation: "NJD",
          toi_per_game: null,
          pp_toi: 0
        } as any
      ],
      {},
      {
        "2026-02-12": {
          date_scraped: "2026-02-12",
          season: 20252026,
          toi_per_gp: 900,
          shots_per_60: 12,
          ixg_per_60: 3
        } as any
      },
      {},
      [],
      [],
      "all",
      new Set([3001, 3002])
    );

    const summary = summarizeSourceTracking(rows, "all");

    expect(summary.missingSources.counts).toBe(2);
    expect(summary.missingSources.rates).toBe(1);
    expect(summary.missingSources.countsOi).toBe(2);
    expect(summary.missingSources.pp).toBe(1);
    expect(summary.missingSources.ppUnit).toBe(1);
    expect(summary.missingSources.line).toBe(2);
    expect(summary.missingSources.lineAssignment).toBe(0);
    expect(summary.wgoFallbacks.goals).toBe(1);
    expect(summary.wgoFallbacks.assists).toBe(1);
    expect(summary.wgoFallbacks.primary_assists).toBe(1);
    expect(summary.wgoFallbacks.secondary_assists).toBe(1);
    expect(summary.wgoFallbacks.shots).toBe(1);
    expect(summary.wgoFallbacks.hits).toBe(1);
    expect(summary.wgoFallbacks.blocks).toBe(1);
    expect(summary.wgoFallbacks.points).toBe(1);
    expect(summary.wgoFallbacks.ixg).toBe(1);
    expect(summary.rateReconstructions.sog_per_60).toBe(1);
    expect(summary.rateReconstructions.ixg_per_60).toBe(1);
    expect(summary.ixgPer60Sources.wgo_raw).toBe(1);
    expect(summary.ixgPer60Sources.rate_reconstruction).toBe(1);
    expect(summary.ixgPer60Sources.counts_raw).toBe(0);
    expect(summary.ixgPer60Sources.unavailable).toBe(0);
    expect(summary.toiSources.fallback).toBe(1);
    expect(summary.toiSources.rates).toBe(1);
    expect(summary.toiTrustTiers.fallback).toBe(1);
    expect(summary.toiTrustTiers.supplementary).toBe(1);
    expect(summary.toiFallbackSeeds.wgo).toBe(1);
    expect(summary.toiWgoNormalizations.minutes_to_seconds).toBe(1);
    expect(summary.toiWgoNormalizations.missing).toBe(1);
    expect(summary.toiSuspiciousReasons.non_finite).toBe(0);
    expect(summary.toiSuspiciousReasons.non_positive).toBe(0);
    expect(summary.toiSuspiciousReasons.above_max_seconds).toBe(0);
  });

  it("builds an exportable structured run summary with source-tracking detail", () => {
    const summary = buildRunSummary({
      rowsUpserted: 5452,
      processedPlayers: 3,
      playersWithRows: 2,
      coverageWarnings: 8,
      suspiciousOutputWarnings: 211766,
      unknownGameIds: 27,
      freshnessBlockers: 4,
      sourceTracking: {
        missingSources: {
          counts: 1176,
          rates: 1177,
          countsOi: 1176,
          pp: 1370,
          ppUnit: 423,
          line: 387,
          lineAssignment: 39,
          knownGameId: 1056
        },
        wgoFallbacks: {
          goals: 1176,
          assists: 1176,
          primary_assists: 0,
          secondary_assists: 0,
          shots: 1176,
          hits: 1176,
          blocks: 1176,
          points: 1176,
          ixg: 0
        },
        rateReconstructions: {
          sog_per_60: 2,
          ixg_per_60: 2
        },
        ixgPer60Sources: {
          counts_raw: 173,
          wgo_raw: 0,
          rate_reconstruction: 2,
          unavailable: 0
        },
        toiSources: {
          counts: 347,
          counts_oi: 2,
          rates: 0,
          fallback: 0,
          wgo: 1175,
          none: 1
        },
        toiFallbackSeeds: {
          counts: 0,
          counts_oi: 0,
          wgo: 0,
          none: 0
        },
        toiTrustTiers: {
          authoritative: 347,
          supplementary: 2,
          fallback: 1175,
          none: 1
        },
        toiWgoNormalizations: {
          minutes_to_seconds: 1175,
          already_seconds: 0,
          missing: 1,
          invalid: 0
        },
        toiSuspiciousReasons: {
          non_finite: 0,
          non_positive: 0,
          above_max_seconds: 0
        }
      }
    });

    expect(summary).toEqual({
      rowsUpserted: 5452,
      processedPlayers: 3,
      playersWithRows: 2,
      coverageWarnings: 8,
      suspiciousOutputWarnings: 211766,
      unknownGameIds: 27,
      freshnessBlockers: 4,
      lastProcessedPlayerId: null,
      nextResumeFrom: null,
      totalPlayersAfterResumeFilter: 0,
      remainingPlayerCount: 0,
      sourceTracking: expect.objectContaining({
        wgoFallbacks: expect.objectContaining({
          goals: 1176,
          points: 1176,
          primary_assists: 0,
          secondary_assists: 0
        }),
        rateReconstructions: expect.objectContaining({
          sog_per_60: 2,
          ixg_per_60: 2
        }),
        toiSources: expect.objectContaining({
          counts: 347,
          wgo: 1175
        })
      })
    });

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it("treats split-strength appearance as positive-TOI participation", () => {
    expect(
      didPlayerCountAsAppearance("all", {
        strength: "all",
        sourceContext: {}
      } as any)
    ).toBe(true);
    expect(
      didPlayerCountAsAppearance("ev", {
        strength: "ev",
        counts: { toi: 125 } as any,
        sourceContext: {}
      } as any)
    ).toBe(true);
    expect(
      didPlayerCountAsAppearance("ev", {
        strength: "ev",
        counts: { toi: 0 } as any,
        sourceContext: {}
      } as any)
    ).toBe(false);
    expect(
      didPlayerCountAsAppearance("pp", {
        strength: "pp",
        sourceContext: {}
      } as any)
    ).toBe(false);
  });

  it("suppresses availability-named aliases for split-strength participation outputs", () => {
    const output: Record<string, number | null> = {};

    applyGpOutputs(
      output,
      {
        season: 0.4,
        threeYear: 0.5,
        career: 0.6,
        seasonPlayerGames: 4,
        seasonTeamGames: 10,
        threeYearPlayerGames: 15,
        threeYearTeamGames: 30,
        careerPlayerGames: 40,
        careerTeamGames: 80
      },
      {
        windows: {
          3: { playerGames: 1, teamGames: 3, ratio: Number((1 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 3, teamGames: 10, ratio: 0.3 },
          20: { playerGames: 4, teamGames: 10, ratio: 0.4 }
        }
      },
      "ev"
    );

    expect(getGpOutputCompatibilityMode("ev")).toEqual({
      semanticType: "participation",
      emitAvailabilityAliases: false,
      legacyGpFieldMode: "legacy_gp_fields_only_until_participation_schema"
    });
    expect(output.games_played).toBe(4);
    expect(output.team_games_played).toBe(10);
    expect(output.season_games_played).toBe(4);
    expect(output.season_team_games_available).toBe(10);
    expect(output.three_year_games_played).toBe(15);
    expect(output.three_year_team_games_available).toBe(30);
    expect(output.career_games_played).toBe(40);
    expect(output.career_team_games_available).toBe(80);
    expect(output.gp_pct_total_all).toBe(0.4);
    expect(output.gp_pct_total_last3).toBe(Number((1 / 3).toFixed(6)));
    expect(output.games_played_last5_team_games).toBe(2);
    expect(output.team_games_available_last5).toBe(5);
    expect(output.games_played_last20_team_games).toBe(4);
    expect(output.team_games_available_last20).toBe(10);
    expect(output.season_availability_pct).toBeNull();
    expect(output.three_year_availability_pct).toBeNull();
    expect(output.career_availability_pct).toBeNull();
    expect(output.season_participation_pct).toBe(0.4);
    expect(output.three_year_participation_pct).toBe(0.5);
    expect(output.career_participation_pct).toBe(0.6);
    expect(output.season_participation_games).toBe(4);
    expect(output.three_year_participation_games).toBe(15);
    expect(output.career_participation_games).toBe(40);
    expect(output.participation_pct_last3_team_games).toBe(
      Number((1 / 3).toFixed(6))
    );
    expect(output.participation_games_last20_team_games).toBe(4);
    expect(output.availability_pct_last3_team_games).toBeNull();
    expect(output.availability_pct_last20_team_games).toBeNull();
  });

  it("derives all-strength legacy gp aliases from canonical availability fields", () => {
    const output: Record<string, number | null> = {};

    applyGpOutputs(
      output,
      {
        season: 0.7,
        threeYear: 0.5,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 15,
        threeYearTeamGames: 30,
        careerPlayerGames: 40,
        careerTeamGames: 80
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 3, teamGames: 5, ratio: 0.6 },
          10: { playerGames: 7, teamGames: 10, ratio: 0.7 },
          20: { playerGames: 7, teamGames: 10, ratio: 0.7 }
        }
      },
      "all"
    );

    expect(getGpOutputCompatibilityMode("all")).toEqual({
      semanticType: "availability",
      emitAvailabilityAliases: true,
      legacyGpFieldMode: "derived_aliases_from_canonical_availability"
    });
    expect(output.season_availability_pct).toBe(0.7);
    expect(output.three_year_availability_pct).toBe(0.5);
    expect(output.career_availability_pct).toBe(0.6);
    expect(output.three_year_games_played).toBe(15);
    expect(output.three_year_team_games_available).toBe(30);
    expect(output.career_games_played).toBe(40);
    expect(output.career_team_games_available).toBe(80);
    expect(output.availability_pct_last3_team_games).toBe(
      Number((2 / 3).toFixed(6))
    );
    expect(output.games_played_last10_team_games).toBe(7);
    expect(output.team_games_available_last10).toBe(10);
    expect(output.season_participation_pct).toBeNull();
    expect(output.participation_pct_last3_team_games).toBeNull();
    expect(output.gp_pct_total_all).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_season).toBe(output.season_availability_pct);
    expect(output.gp_pct_avg_3ya).toBe(output.three_year_availability_pct);
    expect(output.gp_pct_avg_career).toBe(output.career_availability_pct);
    expect(output.gp_pct_total_last3).toBe(
      output.availability_pct_last3_team_games
    );
    expect(output.gp_pct_avg_last3).toBe(output.gp_pct_total_last3);
  });

  it("emits canonical ratio snapshot fields and raw support columns from shared accumulators", () => {
    const ratioMetricsState = {
      primary_points_pct: createRatioRollingAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      primary_points_pct: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    updateRatioRollingAccumulator(
      ratioMetricsState.primary_points_pct,
      { numerator: 2, denominator: 4 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_points_pct,
      { numerator: 1, denominator: 1 },
      { windowFamily: "ratio_performance", anchor: true }
    );

    updateHistoricalRatioAccumulator(historicalRatioMetricsState.primary_points_pct, 20242025, {
      numerator: 3,
      denominator: 6
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.primary_points_pct, 20252026, {
      numerator: 2,
      denominator: 4
    });

    const output = deriveOutputs(
      {},
      ratioMetricsState,
      {},
      {},
      {},
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.primary_points_pct_all).toBe(0.6);
    expect(output.primary_points_pct_last3).toBe(0.6);
    expect(output.primary_points_pct_season).toBe(0.5);
    expect(output.primary_points_pct_3ya).toBe(0.5);
    expect(output.primary_points_pct_career).toBe(0.5);
    expect(output.primary_points_pct_primary_points_all).toBe(3);
    expect(output.primary_points_pct_points_all).toBe(5);
    expect(output.primary_points_pct_primary_points_last3).toBe(3);
    expect(output.primary_points_pct_points_last3).toBe(5);
    expect(output.primary_points_pct_primary_points_season).toBe(2);
    expect(output.primary_points_pct_points_season).toBe(4);
    expect(output.primary_points_pct_primary_points_3ya).toBe(5);
    expect(output.primary_points_pct_points_3ya).toBe(10);
  });

  it("stores canonical oz_start_pct support fields including neutral-zone counts", () => {
    const ratioMetricsState = {
      oz_start_pct: createRatioRollingAccumulator()
    } as Record<string, any>;
    const supportMetricsState = {
      oz_start_neutral_zone_starts: initAccumulator()
    } as Record<string, any>;
    const historicalSupportMetricsState = {
      oz_start_neutral_zone_starts: createHistoricalAverageAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      oz_start_pct: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    updateRatioRollingAccumulator(
      ratioMetricsState.oz_start_pct,
      { numerator: 3, denominator: 5 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.oz_start_pct,
      { numerator: 1, denominator: 3 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    supportMetricsState.oz_start_neutral_zone_starts.sumAll = 4;
    supportMetricsState.oz_start_neutral_zone_starts.countAll = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[3].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[3].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[5].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[5].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[10].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[10].count = 2;
    supportMetricsState.oz_start_neutral_zone_starts.windows[20].sum = 4;
    supportMetricsState.oz_start_neutral_zone_starts.windows[20].count = 2;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.careerSum = 7;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.careerCount = 3;
    historicalSupportMetricsState.oz_start_neutral_zone_starts.bySeason.set(20242025, {
      sum: 3,
      count: 1
    });
    historicalSupportMetricsState.oz_start_neutral_zone_starts.bySeason.set(20252026, {
      sum: 4,
      count: 2
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.oz_start_pct, 20242025, {
      numerator: 4,
      denominator: 9
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.oz_start_pct, 20252026, {
      numerator: 5,
      denominator: 8
    });

    const output = deriveOutputs(
      {},
      ratioMetricsState,
      supportMetricsState,
      {},
      historicalSupportMetricsState,
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.oz_start_pct_all).toBe(50);
    expect(output.oz_start_pct_off_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_def_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_neutral_zone_starts_all).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_def_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_neutral_zone_starts_last3).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_season).toBe(5);
    expect(output.oz_start_pct_def_zone_starts_season).toBe(3);
    expect(output.oz_start_pct_neutral_zone_starts_season).toBe(4);
    expect(output.oz_start_pct_off_zone_starts_3ya).toBe(9);
    expect(output.oz_start_pct_def_zone_starts_3ya).toBe(8);
    expect(output.oz_start_pct_neutral_zone_starts_3ya).toBe(7);
  });

  it("emits optional on-ice save percentage, additive support metrics, and weighted-rate families", () => {
    const simpleMetricsState = {
      pp_toi_seconds: initAccumulator(),
      primary_assists: initAccumulator(),
      secondary_assists: initAccumulator(),
      penalties_drawn: initAccumulator(),
      penalties_taken: initAccumulator(),
      oz_starts: initAccumulator(),
      dz_starts: initAccumulator(),
      nz_starts: initAccumulator(),
      oi_gf: initAccumulator(),
      oi_ga: initAccumulator(),
      oi_sf: initAccumulator(),
      oi_sa: initAccumulator()
    } as Record<string, any>;
    const ratioMetricsState = {
      on_ice_sv_pct: createRatioRollingAccumulator(),
      goals_per_60: createRatioRollingAccumulator(),
      assists_per_60: createRatioRollingAccumulator(),
      penalties_drawn_per_60: createRatioRollingAccumulator(),
      penalties_taken_per_60: createRatioRollingAccumulator(),
      primary_assists_per_60: createRatioRollingAccumulator(),
      secondary_assists_per_60: createRatioRollingAccumulator()
    } as Record<string, any>;
    const historicalSimpleMetricsState = {
      oz_starts: createHistoricalAverageAccumulator(),
      dz_starts: createHistoricalAverageAccumulator(),
      nz_starts: createHistoricalAverageAccumulator(),
      oi_gf: createHistoricalAverageAccumulator(),
      oi_ga: createHistoricalAverageAccumulator(),
      oi_sf: createHistoricalAverageAccumulator(),
      oi_sa: createHistoricalAverageAccumulator(),
      goals: createHistoricalAverageAccumulator(),
      assists: createHistoricalAverageAccumulator(),
      penalties_drawn: createHistoricalAverageAccumulator(),
      penalties_taken: createHistoricalAverageAccumulator(),
      primary_assists: createHistoricalAverageAccumulator(),
      secondary_assists: createHistoricalAverageAccumulator(),
      pp_toi_seconds: createHistoricalAverageAccumulator(),
      toi_seconds: createHistoricalAverageAccumulator(),
      primary_assists_per_60_primary_assists: createHistoricalAverageAccumulator(),
      secondary_assists_per_60_secondary_assists:
        createHistoricalAverageAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      on_ice_sv_pct: createHistoricalRatioAccumulator(),
      goals_per_60: createHistoricalRatioAccumulator(),
      assists_per_60: createHistoricalRatioAccumulator(),
      penalties_drawn_per_60: createHistoricalRatioAccumulator(),
      penalties_taken_per_60: createHistoricalRatioAccumulator(),
      primary_assists_per_60: createHistoricalRatioAccumulator(),
      secondary_assists_per_60: createHistoricalRatioAccumulator()
    } as Record<string, any>;

    const pushSimple = (acc: any, value: number) => {
      acc.sumAll += value;
      acc.countAll += 1;
      for (const size of [3, 5, 10, 20] as const) {
        acc.windows[size].values.push(value);
        acc.windows[size].sum += value;
        acc.windows[size].count += 1;
      }
    };

    pushSimple(simpleMetricsState.pp_toi_seconds, 120);
    pushSimple(simpleMetricsState.pp_toi_seconds, 60);
    pushSimple(simpleMetricsState.primary_assists, 2);
    pushSimple(simpleMetricsState.primary_assists, 1);
    pushSimple(simpleMetricsState.secondary_assists, 1);
    pushSimple(simpleMetricsState.secondary_assists, 0);
    pushSimple(simpleMetricsState.penalties_drawn, 1);
    pushSimple(simpleMetricsState.penalties_drawn, 2);
    pushSimple(simpleMetricsState.penalties_taken, 2);
    pushSimple(simpleMetricsState.penalties_taken, 3);
    pushSimple(simpleMetricsState.oz_starts, 4);
    pushSimple(simpleMetricsState.oz_starts, 2);
    pushSimple(simpleMetricsState.dz_starts, 3);
    pushSimple(simpleMetricsState.dz_starts, 1);
    pushSimple(simpleMetricsState.nz_starts, 5);
    pushSimple(simpleMetricsState.nz_starts, 2);
    pushSimple(simpleMetricsState.oi_gf, 2);
    pushSimple(simpleMetricsState.oi_gf, 1);
    pushSimple(simpleMetricsState.oi_ga, 1);
    pushSimple(simpleMetricsState.oi_ga, 0);
    pushSimple(simpleMetricsState.oi_sf, 12);
    pushSimple(simpleMetricsState.oi_sf, 8);
    pushSimple(simpleMetricsState.oi_sa, 15);
    pushSimple(simpleMetricsState.oi_sa, 5);

    updateRatioRollingAccumulator(
      ratioMetricsState.on_ice_sv_pct,
      { numerator: 14, denominator: 15 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.on_ice_sv_pct,
      { numerator: 5, denominator: 5 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.goals_per_60,
      { numerator: 2, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.goals_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.assists_per_60,
      { numerator: 3, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.assists_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_drawn_per_60,
      { numerator: 1, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_drawn_per_60,
      { numerator: 2, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_taken_per_60,
      { numerator: 2, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.penalties_taken_per_60,
      { numerator: 3, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_assists_per_60,
      { numerator: 2, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.primary_assists_per_60,
      { numerator: 1, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.secondary_assists_per_60,
      { numerator: 1, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.secondary_assists_per_60,
      { numerator: 0, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );

    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oz_starts, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oz_starts, 20252026, 6);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.dz_starts, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.dz_starts, 20252026, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.nz_starts, 20242025, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.nz_starts, 20252026, 7);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_gf, 20242025, 2);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_gf, 20252026, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_ga, 20242025, 2);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_ga, 20252026, 1);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sf, 20242025, 7);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sf, 20252026, 20);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sa, 20242025, 8);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.oi_sa, 20252026, 20);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.goals, 20242025, 3);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.goals, 20252026, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.assists, 20242025, 4);
    updateHistoricalAverageAccumulator(historicalSimpleMetricsState.assists, 20252026, 5);
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_drawn,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_drawn,
      20252026,
      4
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_taken,
      20242025,
      3
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.penalties_taken,
      20252026,
      5
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists,
      20252026,
      3
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists,
      20252026,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.pp_toi_seconds,
      20242025,
      90
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.pp_toi_seconds,
      20252026,
      120
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.toi_seconds,
      20242025,
      1800
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.toi_seconds,
      20252026,
      1500
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists_per_60_primary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.primary_assists_per_60_primary_assists,
      20252026,
      3
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists_per_60_secondary_assists,
      20242025,
      2
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.secondary_assists_per_60_secondary_assists,
      20252026,
      2
    );

    updateHistoricalRatioAccumulator(historicalRatioMetricsState.on_ice_sv_pct, 20242025, {
      numerator: 18,
      denominator: 20
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.on_ice_sv_pct, 20252026, {
      numerator: 19,
      denominator: 20
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.goals_per_60, 20242025, {
      numerator: 3,
      denominator: 1800
    });
    updateHistoricalRatioAccumulator(historicalRatioMetricsState.goals_per_60, 20252026, {
      numerator: 4,
      denominator: 1500
    });
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.assists_per_60,
      20242025,
      {
        numerator: 4,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.assists_per_60,
      20252026,
      {
        numerator: 5,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_drawn_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_drawn_per_60,
      20252026,
      {
        numerator: 4,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_taken_per_60,
      20242025,
      {
        numerator: 3,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.penalties_taken_per_60,
      20252026,
      {
        numerator: 5,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.primary_assists_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.primary_assists_per_60,
      20252026,
      {
        numerator: 3,
        denominator: 1500
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.secondary_assists_per_60,
      20242025,
      {
        numerator: 2,
        denominator: 1800
      }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.secondary_assists_per_60,
      20252026,
      {
        numerator: 2,
        denominator: 1500
      }
    );

    const output = deriveOutputs(
      simpleMetricsState,
      ratioMetricsState,
      {},
      historicalSimpleMetricsState,
      {},
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.6,
        career: 0.6,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 12,
        threeYearTeamGames: 20,
        careerPlayerGames: 12,
        careerTeamGames: 20
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.on_ice_sv_pct_total_all).toBe(95);
    expect(output.on_ice_sv_pct_all).toBe(95);
    expect(output.on_ice_sv_pct_total_last3).toBe(95);
    expect(output.on_ice_sv_pct_season).toBe(95);
    expect(output.on_ice_sv_pct_3ya).toBe(Number(((37 / 40) * 100).toFixed(6)));
    expect(output.oz_starts_total_all).toBe(6);
    expect(output.oz_starts_avg_all).toBe(3);
    expect(output.oz_starts_avg_season).toBe(6);
    expect(output.dz_starts_total_last3).toBe(4);
    expect(output.nz_starts_avg_career).toBe(5);
    expect(output.oi_gf_total_all).toBe(3);
    expect(output.oi_gf_avg_all).toBe(1.5);
    expect(output.oi_ga_total_all).toBe(1);
    expect(output.oi_sf_total_all).toBe(20);
    expect(output.oi_sa_total_all).toBe(20);
    expect(output.oi_sf_avg_season).toBe(20);
    expect(output.oi_sa_avg_3ya).toBe(14);
    expect(output.goals_per_60_total_all).toBe(6);
    expect(output.goals_per_60_all).toBe(6);
    expect(output.goals_per_60_season).toBe(9.6);
    expect(output.goals_per_60_3ya).toBe(Number(((7 / 3300) * 3600).toFixed(6)));
    expect(output.goals_per_60_goals_season).toBe(4);
    expect(output.goals_per_60_toi_seconds_season).toBe(1500);
    expect(output.assists_per_60_total_all).toBe(8);
    expect(output.assists_per_60_all).toBe(8);
    expect(output.assists_per_60_season).toBe(12);
    expect(output.assists_per_60_assists_career).toBe(9);
    expect(output.assists_per_60_toi_seconds_career).toBe(3300);
    expect(output.pp_toi_seconds_total_all).toBe(180);
    expect(output.pp_toi_seconds_avg_all).toBe(90);
    expect(output.pp_toi_seconds_avg_season).toBe(120);
    expect(output.pp_toi_seconds_avg_career).toBe(105);
    expect(output.penalties_drawn_total_all).toBe(3);
    expect(output.penalties_drawn_avg_all).toBe(1.5);
    expect(output.penalties_drawn_avg_season).toBe(4);
    expect(output.penalties_drawn_per_60_total_all).toBe(6);
    expect(output.penalties_drawn_per_60_all).toBe(6);
    expect(output.penalties_drawn_per_60_season).toBe(9.6);
    expect(output.penalties_drawn_per_60_penalties_drawn_career).toBe(6);
    expect(output.penalties_drawn_per_60_toi_seconds_career).toBe(3300);
    expect(output.penalties_taken_total_all).toBe(5);
    expect(output.penalties_taken_avg_all).toBe(2.5);
    expect(output.penalties_taken_avg_season).toBe(5);
    expect(output.penalties_taken_per_60_total_all).toBe(10);
    expect(output.penalties_taken_per_60_all).toBe(10);
    expect(output.penalties_taken_per_60_season).toBe(12);
    expect(output.penalties_taken_per_60_penalties_taken_career).toBe(8);
    expect(output.penalties_taken_per_60_toi_seconds_career).toBe(3300);
    expect(output.primary_assists_total_all).toBe(3);
    expect(output.primary_assists_avg_all).toBe(1.5);
    expect(output.primary_assists_avg_season).toBe(3);
    expect(output.secondary_assists_total_all).toBe(1);
    expect(output.secondary_assists_avg_all).toBe(0.5);
    expect(output.secondary_assists_avg_career).toBe(2);
    expect(output.primary_assists_per_60_total_all).toBe(6);
    expect(output.primary_assists_per_60_all).toBe(6);
    expect(output.primary_assists_per_60_primary_assists_season).toBe(3);
    expect(output.primary_assists_per_60_toi_seconds_season).toBe(1500);
    expect(output.secondary_assists_per_60_total_all).toBe(2);
    expect(output.secondary_assists_per_60_all).toBe(2);
    expect(output.secondary_assists_per_60_season).toBe(4.8);
    expect(output.secondary_assists_per_60_secondary_assists_career).toBe(4);
    expect(output.secondary_assists_per_60_toi_seconds_career).toBe(3300);
  });

  it("emits shot attempts per 60 from NST ICF components", () => {
    const ratioMetricsState = {
      shot_attempts_per_60: createRatioRollingAccumulator()
    } as Record<string, any>;
    const historicalRatioMetricsState = {
      shot_attempts_per_60: createHistoricalRatioAccumulator()
    } as Record<string, any>;
    const historicalSimpleMetricsState = {
      toi_seconds: createHistoricalAverageAccumulator()
    } as Record<string, any>;
    const historicalSupportMetricsState = {
      shot_attempts_per_60_shot_attempts: createHistoricalAverageAccumulator()
    } as Record<string, any>;

    updateRatioRollingAccumulator(
      ratioMetricsState.shot_attempts_per_60,
      { numerator: 6, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      ratioMetricsState.shot_attempts_per_60,
      { numerator: 4, denominator: 600 },
      { windowFamily: "weighted_rate_performance", anchor: true }
    );
    updateHistoricalRatioAccumulator(
      historicalRatioMetricsState.shot_attempts_per_60,
      20252026,
      {
        numerator: 10,
        denominator: 1800
      }
    );
    updateHistoricalAverageAccumulator(
      historicalSupportMetricsState.shot_attempts_per_60_shot_attempts,
      20252026,
      10
    );
    updateHistoricalAverageAccumulator(
      historicalSimpleMetricsState.toi_seconds,
      20252026,
      1800
    );

    const output = deriveOutputs(
      {},
      ratioMetricsState,
      {},
      historicalSimpleMetricsState,
      historicalSupportMetricsState,
      historicalRatioMetricsState,
      {
        season: 0.7,
        threeYear: 0.7,
        career: 0.7,
        seasonPlayerGames: 7,
        seasonTeamGames: 10,
        threeYearPlayerGames: 7,
        threeYearTeamGames: 10,
        careerPlayerGames: 7,
        careerTeamGames: 10
      },
      {
        windows: {
          3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
          5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
          10: { playerGames: 2, teamGames: 10, ratio: 0.2 },
          20: { playerGames: 2, teamGames: 20, ratio: 0.1 }
        }
      },
      20252026,
      "all"
    );

    expect(output.shot_attempts_per_60_total_all).toBe(20);
    expect(output.shot_attempts_per_60_all).toBe(20);
    expect(output.shot_attempts_per_60_last5).toBe(20);
    expect(output.shot_attempts_per_60_season).toBe(20);
    expect(output.shot_attempts_per_60_shot_attempts_season).toBe(10);
    expect(output.shot_attempts_per_60_toi_seconds_season).toBe(1800);
  });
});

describe("fetchRollingPlayerAverages upsertRollingPlayerMetricsBatch", () => {
  it("retains source identity in the aligned-count read instead of projecting it away", async () => {
    const raw = { id: 11, player_id: 7, date_scraped: "2026-10-03", season: 20262027, goals: 0, shots: 4, total_assists: null };
    const query: any = {};
    let fields: string[] = [];
    query.select = vi.fn((value: string) => { fields = value.split(",").map(field => field.trim()); return query; });
    for (const method of ["eq", "gte", "lte", "order"]) query[method] = vi.fn(() => query);
    query.range = vi.fn(async () => ({ error: null, data: [Object.fromEntries(Object.entries(raw).filter(([field]) => fields.includes(field)))] }));
    const db = { from: vi.fn(() => query) };
    const rows = await fetchCounts("nst_gamelog_pp_counts", 7, "2026-10-03", "2026-10-03", db as any);
    expect(rows).toEqual([raw]);
    expect(db.from).toHaveBeenCalledWith("nst_gamelog_pp_counts");
    expect(query.eq).toHaveBeenCalledWith("player_id", 7);
    expect(query.gte).toHaveBeenCalledWith("date_scraped", "2026-10-03");
    expect(query.lte).toHaveBeenCalledWith("date_scraped", "2026-10-03");
  });

  it("stores aligned count support only in the exact-anchor sidecar while preserving legacy scalars", () => {
    const game = { id: 1, date: "2026-10-03", seasonId: 20262027 };
    const aligned = createAlignedCountSupportBuilder({ playerId: 7, strengthState: "pp", sourceTable: "nst_gamelog_pp_counts", startDate: game.date,
      canonicalGames: [game], countsRows: [{ id: 11, player_id: 7, date_scraped: game.date, season: game.seasonId, goals: 0, shots: 4, total_assists: 1 }],
    }).push({ player_id: 7, game_id: 1, date: game.date, season_id: game.seasonId });
    const row = { player_id: 7, game_id: 1, game_date: game.date, season: game.seasonId, strength_state: "pp", aligned_count_support: aligned };
    const split = splitRollingUpsertRowForDurableStorage(row);
    expect(split.rankingRow).not.toHaveProperty("aligned_count_support");
    expect(compactRollingUpsertRowForRankingStorage(row)).not.toHaveProperty("aligned_count_support");
    expect(split.supportRow?.support_payload.alignedCountSupport).toEqual(aligned);
    expect(splitRollingUpsertRowForDurableStorage({ ...row, goals_total_all: 331 }).supportRow?.support_payload.historicalCompatibility?.goals_total_all).toBe(331);
    expect(row.aligned_count_support).toEqual(aligned);
    expect(() => splitRollingUpsertRowForDurableStorage({ ...row, game_id: 99 })).toThrow("storage anchor");
    expect(splitRollingUpsertRowForDurableStorage({ ...row, aligned_count_support: null }).supportRow?.support_payload.alignedCountSupport).toBeNull();
  });

  it.each([900, 0, null])("retains model TOI averages in both storage paths: %s", (seconds) => {
    const row = {
      player_id: 8470613,
      game_date: "2026-10-03",
      season: 20262027,
      strength_state: "pp",
      toi_seconds_avg_last5: seconds,
      toi_seconds_avg_all: seconds,
      goals_avg_all: 0.4
    };
    const compact = compactRollingUpsertRowForRankingStorage(row);
    const split = splitRollingUpsertRowForDurableStorage(row);

    expect(compact.toi_seconds_avg_last5).toBe(seconds);
    expect(compact.toi_seconds_avg_all).toBe(seconds);
    expect(split.rankingRow.toi_seconds_avg_last5).toBe(seconds);
    expect(split.rankingRow.toi_seconds_avg_all).toBe(seconds);
    expect(split.supportRow?.support_payload).toMatchObject({
      historicalCompatibility: { goals_avg_all: 0.4 },
      diagnostics: { prunedFieldCount: 1 }
    });
    expect(split.supportRow?.support_payload.historicalCompatibility).not.toHaveProperty("toi_seconds_avg_last5");
    expect(split.supportRow?.support_payload.historicalCompatibility).not.toHaveProperty("toi_seconds_avg_all");
  });

  it("compacts storage-heavy compatibility fields while preserving ranking fields", () => {
    expect(
      compactRollingUpsertRowForRankingStorage({
        player_id: 8470613,
        game_date: "2026-04-16",
        season: 20252026,
        strength_state: "all",
        points_avg_season: 1.2,
        goals_per_60_last5: 2.5,
        goals_per_60_total_last5: 3,
        toi_seconds_total_last5: 900,
        goals_avg_all: 0.4,
        goals_avg_3ya: 0.3,
        goals_total_last3: 1,
        goals_avg_career: 0.25,
        pp_share_of_team: 0.55
      })
    ).toEqual({
      player_id: 8470613,
      game_date: "2026-04-16",
      season: 20252026,
      strength_state: "all",
      points_avg_season: 1.2,
      goals_per_60_last5: 2.5,
      goals_per_60_total_last5: 3,
      toi_seconds_total_last5: 900,
      goals_avg_all: null,
      goals_avg_3ya: null,
      goals_total_last3: null,
      goals_avg_career: null,
      pp_share_of_team: 0.55
    });
  });

  it("splits pruned support fields into the durable support payload", () => {
    expect(
      splitRollingUpsertRowForDurableStorage({
        player_id: 8470613,
        game_date: "2026-04-16",
        season: 20252026,
        strength_state: "all",
        team_id: 14,
        game_id: 2025021301,
        goals_per_60_last5: 2.5,
        goals_avg_all: 0.4,
        goals_avg_3ya: 0.3,
        gp_pct_avg_all: 0.9,
        pp_share_of_team: 0.55
      })
    ).toEqual({
      rankingRow: {
        player_id: 8470613,
        game_date: "2026-04-16",
        season: 20252026,
        strength_state: "all",
        team_id: 14,
        game_id: 2025021301,
        goals_per_60_last5: 2.5,
        goals_avg_all: null,
        goals_avg_3ya: null,
        gp_pct_avg_all: null,
        pp_share_of_team: 0.55
      },
      supportRow: {
        player_id: 8470613,
        game_date: "2026-04-16",
        strength_state: "all",
        season: 20252026,
        team_id: 14,
        game_id: 2025021301,
        payload_schema_version: 1,
        support_payload: {
          historicalCompatibility: {
            goals_avg_all: 0.4,
            goals_avg_3ya: 0.3
          },
          deprecatedCompatibility: {
            gp_pct_avg_all: 0.9
          },
          diagnostics: {
            compactedFromWideRow: true,
            prunedFieldCount: 3,
            source: "fetchRollingPlayerAverages"
          }
        }
      }
    });
  });

  it("posts wide rolling metric rows through the direct PostgREST endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", fetchMock);

    const batch = [
      {
        player_id: 8470613,
        game_date: "2025-10-07",
        season: 20252026,
        strength_state: "all",
        goals_total_last20: 0,
        toi_seconds_total_last20: 1210,
        pp_share_pct_last20: 0.226,
        toi_seconds_avg_last5: 0,
        toi_seconds_avg_all: 605,
        goals_avg_all: 0.3
      }
    ];

    await expect(upsertRollingPlayerMetricsBatch(batch)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rolling_player_metric_support_payloads?on_conflict=player_id,game_date,strength_state",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "test-service-role-key",
          Authorization: "Bearer test-service-role-key",
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify([
          {
            player_id: 8470613,
            game_date: "2025-10-07",
            strength_state: "all",
            season: 20252026,
            team_id: null,
            game_id: null,
            payload_schema_version: 1,
            support_payload: {
              historicalCompatibility: {
                goals_avg_all: 0.3
              },
              diagnostics: {
                compactedFromWideRow: true,
                prunedFieldCount: 1,
                source: "fetchRollingPlayerAverages"
              }
            }
          }
        ])
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "test-service-role-key",
          Authorization: "Bearer test-service-role-key",
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify([
          {
            player_id: 8470613,
            game_date: "2025-10-07",
            season: 20252026,
            strength_state: "all",
            goals_total_last20: 0,
            toi_seconds_total_last20: 1210,
            pp_share_pct_last20: 0.226,
            toi_seconds_avg_last5: 0,
            toi_seconds_avg_all: 605,
            goals_avg_all: null
          }
        ])
      })
    );
  });

  it("surfaces structured response details when the direct upsert fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "column \"bogus_metric\" of relation \"rolling_player_game_metrics\" does not exist",
          code: "42703",
          details: "Failing row contains an unknown column.",
          hint: "Check generated types and migrations."
        }),
        {
          status: 400,
          statusText: "Bad Request",
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      upsertRollingPlayerMetricsBatch([
        {
          player_id: 8470613,
          game_date: "2025-10-07",
          season: 20252026,
          strength_state: "all",
          bogus_metric: 1
        }
      ])
    ).rejects.toSatisfy((error: unknown) => {
      const typed = error as Record<string, unknown>;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'column "bogus_metric" of relation "rolling_player_game_metrics" does not exist'
      );
      expect(typed.code).toBe("42703");
      expect(typed.details).toBe("Failing row contains an unknown column.");
      expect(typed.hint).toBe("Check generated types and migrations.");
      expect(typed.status).toBe(400);
      expect(typed.statusCode).toBe(400);
      expect(String(typed.responseText)).toContain("bogus_metric");
      return true;
    });
  });

  it("splits and retries timed-out direct upsert statements", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "canceling statement due to statement timeout",
            code: "57014"
          }),
          {
            status: 500,
            statusText: "Internal Server Error",
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      )
      .mockResolvedValue(new Response("", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", fetchMock);

    const firstRow = {
      player_id: 8470613,
      game_date: "2025-10-07",
      season: 20252026,
      strength_state: "5v5",
      goals_total_last20: 0
    };
    const secondRow = {
      player_id: 8470613,
      game_date: "2025-10-09",
      season: 20252026,
      strength_state: "5v5",
      goals_total_last20: 1
    };

    await expect(
      upsertRollingPlayerMetricsBatch([firstRow, secondRow])
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify([firstRow, secondRow])
      })
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify([firstRow])
      })
    );
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify([secondRow])
      })
    );
  });
});

describe("fetchRollingPlayerAverages resume behavior", () => {
  it("reads complete prior history while keeping the requested write window bounded", () => {
    const options = {
      season: 20252026,
      startDate: "2026-03-10",
      endDate: "2026-03-14",
      strengths: ["all" as const],
      maxPlayers: 25
    };

    expect(buildPlayerHistoryReadOptions(options)).toEqual({
      season: 20252026,
      endDate: "2026-03-14",
      strengths: ["all"],
      maxPlayers: 25
    });
    expect(isWithinRequestedWriteWindow("2026-03-09", options)).toBe(false);
    expect(isWithinRequestedWriteWindow("2026-03-10", options)).toBe(true);
    expect(isWithinRequestedWriteWindow("2026-03-14", options)).toBe(true);
    expect(isWithinRequestedWriteWindow("2026-03-15", options)).toBe(false);
  });

  it("uses date-scoped player selection only for incremental date-bounded runs", () => {
    expect(
      shouldUseDateScopedPlayerSelection({
        startDate: "2026-03-14",
        endDate: "2026-03-14"
      })
    ).toBe(true);
    expect(
      shouldUseDateScopedPlayerSelection({
        season: 20252026,
        startDate: "2026-03-10",
        endDate: "2026-03-14"
      })
    ).toBe(true);
    expect(
      shouldUseDateScopedPlayerSelection({
        season: 20252026
      })
    ).toBe(false);
    expect(
      shouldUseDateScopedPlayerSelection({
        startDate: "2026-03-14",
        forceFullRefresh: true
      })
    ).toBe(false);
    expect(
      shouldUseDateScopedPlayerSelection({
        playerId: 8470613,
        startDate: "2026-03-14"
      })
    ).toBe(false);
  });

  it("normalizes player-id lists into sorted unique values", () => {
    expect(normalizePlayerIdList([8470613, 8478398, 8470613, 8485702])).toEqual([
      8470613,
      8478398,
      8485702
    ]);
  });

  it("normalizes optional strength scopes for targeted rolling recomputes", () => {
    expect(normalizeStrengthStates(["5v5", "EV", "5v5", "bogus"])).toEqual([
      "5v5",
      "ev"
    ]);
    expect(normalizeStrengthStates(["bogus"])).toBeUndefined();
    expect(normalizeStrengthStates(undefined)).toBeUndefined();
  });

  it("does not infer an implicit auto-resume for broad runs", () => {
    expect(
      shouldWarnAboutDisabledImplicitAutoResume({
        playerId: undefined,
        season: undefined,
        startDate: undefined,
        endDate: undefined,
        forceFullRefresh: undefined,
        resumePlayerId: undefined
      })
    ).toBe(true);
    expect(filterPlayerIdsForResume([8478398, 8478402, 8485702])).toEqual([
      8478398,
      8478402,
      8485702
    ]);
  });

  it("still honors an explicit resume boundary when requested", () => {
    expect(
      shouldWarnAboutDisabledImplicitAutoResume({
        resumePlayerId: 8478402
      })
    ).toBe(false);
    expect(
      filterPlayerIdsForResume([8478398, 8478402, 8478403, 8485702], 8478402)
    ).toEqual([8478403, 8485702]);
  });
});

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPlanningData, normalizePlanningGames, parsePlanningDataQuery, publicPlanningForecasts } from "./planning";
import type { ForecastDiscoveryExclusion, PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "lib/projections/issuedContext";
import { acceptedNewsSupersedes, loadAcceptedForecastNews } from "lib/projections/acceptedNews";

const membershipCreatedAt = ["2026-09-01T00:00:00Z"];
const rosterRevision = forgeRosterRevision({ canonicalId: 7, nhlId: 847001, seasonId: 20262027, teamId: 1, membershipCreatedAt });
const player: PlanningPlayer = { id: "7", nhlId: 847001, nhlTeamId: 1, rosterRevision, name: "Goalie", playerClass: "goalie", teamAbbreviation: "TOR", eligiblePositions: ["G"], availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const rows = [{ id: 1, source_game_id: 2026020001, source_season_id: 20262027, game_date: "2026-10-10", start_time: "2026-10-10T23:00:00Z", team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT", schedule_status: "OK", is_countable: true, game_type: 2 }];
const issuedContext: ForgeIssuedContextV1 = { version: "forge-issued-context-v1", game: { id: 2026020001, date: "2026-10-10", seasonId: 20262027,
  startTime: "2026-10-10T23:00:00Z", homeTeamId: 1, awayTeamId: 2 },
  schedule: [
    { gameKey: "nhl", season: "2026", sourceSeasonId: 20262027, teamId: 1, opponentTeamId: 2,
      teamAbbreviation: "TOR", opponentAbbreviation: "MTL", startTime: "2026-10-10T23:00:00Z",
      gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z",
      revision: forgeScheduleRevision({ source_game_id: 2026020001, start_time: "2026-10-10T23:00:00Z",
        team_abbreviation: "TOR", opponent_abbreviation: "MTL", game_status: "FUT", schedule_status: "OK" }) },
    { gameKey: "nhl", season: "2026", sourceSeasonId: 20262027, teamId: 2, opponentTeamId: 1,
      teamAbbreviation: "MTL", opponentAbbreviation: "TOR", startTime: "2026-10-10T23:00:00Z",
      gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z",
      revision: forgeScheduleRevision({ source_game_id: 2026020001, start_time: "2026-10-10T23:00:00Z",
        team_abbreviation: "MTL", opponent_abbreviation: "TOR", game_status: "FUT", schedule_status: "OK" }) },
  ], roster: [{ canonicalId: 7, nhlId: 847001, seasonId: 20262027, teamId: 1,
    membershipCreatedAt, identityUpdatedAt: "2026-09-01T00:00:00Z", revision: rosterRevision }],
  observedAt: "2026-10-10T09:00:00Z" };
const revision = (candidates: unknown[]): ForgeGameRevision => ({ id: "issued-1", run_id: "run-1", game_id: 2026020001, decision_as_of: "2026-10-10T10:00:00Z", published_at: "2026-10-10T10:00:00Z", payload: { players: [], teams: [], goalies: [{ game_id: 2026020001, team_id: 1, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", uncertainty: { daily_board_candidates: candidates } }], codeVersion: "v1", inputProvenance: { rolling_player_history_contract: "test-history", private: "never expose", capturedReads: { version: "forge-captured-reads-v1", hash: "a".repeat(64), readCount: 2, firstReceivedAt: "2026-10-10T09:00:00Z", lastReceivedAt: "2026-10-10T09:01:00Z" }, issuedContexts: [issuedContext] } as ForgeGameRevision["payload"]["inputProvenance"] } });
function rpcResponse(value: unknown): any {
  const promise = Promise.resolve(value);
  return Object.assign(promise, { abortSignal: () => promise });
}
function formDb(historyGames: unknown[], stats: unknown[], fail?: "games" | "skatersGameStats",
  options: { cap?: number; badTable?: string; failure?: string; hangTable?: string } = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const tables: Record<string, unknown[]> = {
    roster_optimizer_team_games: rows,
    fhfh_player_identities: [{ id: 7, nhl_player_id: 847001, canonical_name: "Skater", canonical_position: "L" }],
    teams: [{ id: 1, abbreviation: "TOR" }], rosters: [{ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] }],
    yahoo_matchup_weeks: [], games: historyGames, skatersGameStats: stats,
  };
  const db = { from: (table: string) => {
    let start = 0, end = Infinity;
    let selected = tables[table] ?? [];
    const result = () => {
      if (table === options.hangTable) return new Promise<never>(() => {});
      const failure = table === options.badTable ? options.failure : undefined;
      const offset = failure === "duplicate" ? 0 : start;
      return Promise.resolve({ count: failure === "missing_count" ? null : failure === "overflow" ? 100000
        : selected.length + (failure === "count_drift" && start ? 1 : 0),
      data: failure === "null_data" ? null : failure === "no_progress" && start ? []
        : selected.slice(offset, offset + Math.min(end - start + 1, options.cap ?? Infinity)),
      error: table === fail || failure === "late_error" && start ? { message: "private database details" } : null });
    };
    const chain: any = new Proxy({}, { get: (_, method) => method === "then" ? Promise.resolve(result()).then.bind(Promise.resolve(result()))
      : (...args: any[]) => {
        calls.push({ table, method: String(method), args });
        if (method === "range") [start, end] = args;
        if (method === "in") selected = selected.filter((row: any) => args[1].includes(row[args[0]]));
        return chain;
      } });
    return chain;
  }, rpc: vi.fn().mockReturnValue(rpcResponse({ data: [], error: null })) };
  return { db, calls, tables };
}
function newsDb(events: Array<{ id: string; game_id: number; queue_version: number; accepted_at: string }>,
  options: { cap?: number; missingCount?: boolean; failPage?: number; duplicatePage?: boolean } = {}) {
  const result = formDb([], []);
  result.tables.fhfh_player_identities = [{ id: 7, nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }];
  const from = result.db.from;
  const reads: Array<{ ids: number[]; asOf: string; start: number }> = [];
  result.db.from = (table: string) => {
    if (table !== "forge_board_news_events") return from(table);
    let ids: number[] = [], asOf = "", start = 0, end = 0;
    const chain: any = new Proxy({}, { get: (_, method) => {
      if (method === "then") {
        reads.push({ ids, asOf, start });
        const selected = events.filter(row => ids.includes(row.game_id) && Date.parse(row.accepted_at) <= Date.parse(asOf));
        const offset = options.duplicatePage ? 0 : start;
        const response = { data: selected.slice(offset, offset + Math.min(end - start + 1, options.cap ?? 500)),
          count: options.missingCount ? null : selected.length,
          error: options.failPage === reads.length ? { message: "private failure" } : null };
        return Promise.resolve(response).then.bind(Promise.resolve(response));
      }
      return (...args: any[]) => {
        if (method === "in") ids = args[1];
        if (method === "lte") asOf = args[1];
        if (method === "range") [start, end] = args;
        return chain;
      };
    } });
    return chain;
  };
  result.db.rpc.mockReturnValue(rpcResponse({ data: [revision([{ playerId: 847001, startingProbability: 1,
    conditional: { SAVES_GOALIE: 30 } }])], error: null }));
  return { ...result, reads };
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("public RSO data boundary", () => {
  const publicQuery = { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-11" };
  const publicOptions = { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: false };

  function cappedInputs(options: Parameters<typeof formDb>[3] = {}) {
    const fixture = formDb([], [], undefined, { cap: 1, ...options });
    fixture.tables.roster_optimizer_team_games = [...rows, { ...rows[0], id: 2, source_game_id: 2026020002,
      game_date: "2026-10-11", start_time: "2026-10-11T23:00:00Z" }];
    fixture.tables.fhfh_player_identities = [7, 8].map(id => ({ id, nhl_player_id: 847001 + id - 7,
      canonical_name: `Player ${id}`, canonical_position: "L" }));
    fixture.tables.rosters = [847001, 847002].map(playerId => ({ playerId, teamId: 1, created_at: membershipCreatedAt[0] }));
    fixture.tables.teams = [{ id: 1, abbreviation: "TOR" }, { id: 2, abbreviation: "MTL" }];
    return fixture;
  }

  it("reflects corrected memberships without filling missing or conflicting teams from identity pointers", async () => {
    const { db, tables, calls } = formDb([], []);
    tables.fhfh_player_identities = [{ id: 7, nhl_player_id: 847001, canonical_name: "Skater", canonical_position: "L", current_nhl_team_id: 1 }];
    tables.teams = [{ id: 1, abbreviation: "TOR" }, { id: 2, abbreviation: "MTL" }];
    tables.rosters = [];
    const missing = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(missing.players[0]).toMatchObject({ id: "7", nhlId: 847001, teamAbbreviation: null, eligibilityVerified: false });
    expect(missing.evidence.identities.completeness).toBe("partial");
    tables.rosters = [{ playerId: 847001, teamId: 2, created_at: "2026-10-10T10:00:00Z" }];
    const corrected = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(corrected.players[0]).toMatchObject({ id: "7", nhlId: 847001, nhlTeamId: 2, teamAbbreviation: "MTL", eligibilityVerified: false });
    expect(corrected.players[0].rosterRevision).toBeTruthy();
    tables.rosters.push({ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] });
    const conflict = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(conflict.players[0].teamAbbreviation).toBeNull();
    expect(conflict.players[0].rosterRevision).toBeUndefined();
    expect(conflict.evidence.identities.completeness).toBe("partial");
    expect(calls).toContainEqual({ table: "rosters", method: "eq", args: ["is_current", true] });
    expect(calls).toContainEqual({ table: "rosters", method: "eq", args: ["seasonId", 20262027] });
  });

  it("includes a newly reconciled canonical player without promoting roster evidence to league eligibility or participation", async () => {
    const { db, tables, calls } = formDb([], []);
    tables.fhfh_player_identities.push({ id: 11482, nhl_player_id: 8486171, canonical_name: "New roster player", canonical_position: "C" });
    tables.rosters.push({ playerId: 8486171, teamId: 1, created_at: "2026-10-10T10:00:00Z" });
    const result = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(result.players.find(player => player.id === "11482")).toMatchObject({ nhlId: 8486171, teamAbbreviation: "TOR", availability: "unknown", eligibilityVerified: false });
    expect(result.forecasts).toEqual([]);
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "eq", args: ["lifecycle_status", "active_nhl"] });
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "eq", args: ["verification_status", "verified"] });
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "is", args: ["merged_into_id", null] });
  });

  it("checks freshness of returned league dates without letting unrelated padding stale the scope", async () => {
    const { db, tables } = cappedInputs();
    tables.roster_optimizer_team_games = [{ ...rows[0], fetched_at: "2026-10-10T09:00:00Z" },
      { ...rows[0], id: 2, source_game_id: 2026020002, game_date: "2026-10-09",
        start_time: "2026-10-09T23:00:00Z", fetched_at: "2026-08-29T17:57:18Z" }];
    const query = { ...publicQuery, timeZone: "UTC" };
    const fresh = await loadPlanningData(db as any, query, publicOptions);
    expect(fresh.games).toHaveLength(1);
    expect(fresh.evidence.schedule).toMatchObject({ completeness: "complete", asOf: "2026-10-10T09:00:00Z" });
    expect(fresh.forecastManifest?.exclusions?.some(row => row.reasons.includes("incomplete_refresh"))).toBe(false);
    (tables.roster_optimizer_team_games[1] as Record<string, unknown>).start_time = "2026-10-10T00:30:00Z";
    const crossing = await loadPlanningData(db as any, query, publicOptions);
    expect(crossing.games).toHaveLength(2);
    expect(crossing.evidence.schedule.completeness).toBe("partial");
    expect(crossing.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["incomplete_refresh"] });
  });

  it("rejects missing, malformed, future and stale source receipts for returned games", async () => {
    for (const fetched_at of [null, "not-a-time", "2026-10-10T13:00:00Z", "2026-08-29T17:57:18Z"]) {
      const { db, tables } = cappedInputs();
      tables.roster_optimizer_team_games = [{ ...rows[0], fetched_at }];
      const result = await loadPlanningData(db as any, publicQuery, publicOptions);
      expect(result.evidence.schedule.completeness).toBe("partial");
      expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["incomplete_refresh"] });
    }
  });

  it("completes capped required scopes before counting games and competing players", async () => {
    const { db, calls } = cappedInputs();
    const result = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(result.games).toHaveLength(2);
    expect(result.players).toHaveLength(2);
    expect(result.players.every(player => player.teamAbbreviation === "TOR")).toBe(true);
    expect(result.forecastManifest?.requiredOpportunities).toBe(4);
    for (const table of ["roster_optimizer_team_games", "fhfh_player_identities", "rosters", "teams"]) {
      expect(calls.filter(call => call.table === table && call.method === "range").map(call => call.args[0])).toEqual([0, 1]);
      expect(calls.filter(call => call.table === table && call.method === "select")
        .every(call => (call.args[1] as any).count === "exact")).toBe(true);
    }
  });

  it.each(["missing_count", "null_data", "count_drift", "late_error", "duplicate", "no_progress", "overflow"])(
    "does not certify a fresh snapshot after %s in a required scope", async failure => {
      for (const badTable of ["roster_optimizer_team_games", "fhfh_player_identities", "rosters", "teams"]) {
        const { db } = cappedInputs({ badTable, failure });
        await expect(loadPlanningData(db as any, publicQuery, publicOptions)).rejects.toThrow(/Planning source/);
      }
    });

  it("preserves complete schedule planning when optional reads are incomplete", async () => {
    for (const badTable of ["yahoo_player_ownership_daily", "yahoo_matchup_weeks", "games"]) {
      const { db } = cappedInputs({ badTable, failure: "missing_count" });
      const result = await loadPlanningData(db as any, publicQuery, publicOptions);
      expect(result.games).toHaveLength(2);
      expect(result.players).toHaveLength(2);
      expect(result.forecastManifest?.requiredOpportunities).toBe(4);
      const source = badTable === "games" ? "form" : badTable === "yahoo_matchup_weeks" ? "matchupWeeks" : "ownership";
      expect(result.evidence[source].limitations.length).toBeGreaterThan(0);
    }
  });

  it("bounds a hung required read and aborts its transport", async () => {
    vi.useFakeTimers();
    const { db, calls } = cappedInputs({ hangTable: "rosters" });
    const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, deadlineMs: Date.now() + 1000 });
    const rejected = expect(pending).rejects.toThrow("deadline");
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    const signal = calls.find(call => call.table === "rosters" && call.method === "abortSignal")?.args[0] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a hung revision RPC while retaining a separately verified game's forecast", async () => {
    vi.useFakeTimers();
    const { db, tables } = newsDb([]);
    tables.roster_optimizer_team_games = [...rows, { ...rows[0], id: 2, source_game_id: 2026020002,
      game_date: "2026-10-11", start_time: "2026-10-11T23:00:00Z" }];
    const complete = db.rpc.getMockImplementation()!();
    let hungSignal: AbortSignal | undefined;
    db.rpc.mockImplementation((_method: string, args: { p_slate_date: string }) => args.p_slate_date === "2026-10-10"
      ? complete : { abortSignal: (signal: AbortSignal) => { hungSignal = signal; return new Promise(() => {}); } });
    const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, forecastsEnabled: true });
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;
    expect(result.games).toHaveLength(2);
    expect(result.forecasts.map(row => row.gameId)).toEqual(["2026020001"]);
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["discovery_timeout"] });
    expect(result.forecastManifest?.exclusions).not.toContainEqual({ gameId: "2026020002", reasons: ["no_issued_revision"] });
    expect(hungSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["yahoo_player_ownership_daily", "player_forecast_source_observations"])(
    "degrades a hung optional %s read within its deadline", async hangTable => {
      vi.useFakeTimers();
      vi.stubEnv("PLAYER_FORECAST_BASELINE_RELEASE_IDS", "11111111-1111-4111-8111-111111111111");
      const { db, calls } = cappedInputs({ hangTable });
      const pending = loadPlanningData(db as any, publicQuery, publicOptions);
      await vi.advanceTimersByTimeAsync(8000);
      const result = await pending;
      expect(result.games).toHaveLength(2);
      expect(result.baselineSources).toEqual([]);
      const source = hangTable === "yahoo_player_ownership_daily" ? "ownership" : "baselines";
      expect(result.evidence[source].limitations.length).toBeGreaterThan(0);
      const signal = calls.find(call => call.table === hangTable && call.method === "abortSignal")?.args[0] as AbortSignal;
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

  it("invalidates an issued forecast after accepted news and restores only a refreshed revision", async () => {
    const events: Parameters<typeof newsDb>[0] = [];
    const { db } = newsDb(events);
    const query = { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" };
    const options = { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true };
    const before = await loadPlanningData(db as any, query, options);
    expect(before.forecasts).toHaveLength(1);
    events.push({ id: "accepted-news", game_id: 2026020001, queue_version: 1, accepted_at: "2026-10-10T10:01:00Z" });
    const invalidated = await loadPlanningData(db as any, query, options);
    expect(invalidated.games).toHaveLength(1);
    expect(invalidated.forecasts).toEqual([]);
    expect(invalidated.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["stale_source"] });
    expect(invalidated.forecastManifest?.id).not.toBe(before.forecastManifest?.id);
    expect(invalidated.forecastManifest?.acceptedNewsRevision).not.toBe(before.forecastManifest?.acceptedNewsRevision);
    expect(JSON.stringify(invalidated)).not.toContain("accepted-news");
    const next = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    next.id = "new-issuance"; next.published_at = "2026-10-10T10:30:00Z";
    next.payload.inputCutoff = "2026-10-10T10:02:00Z";
    db.rpc.mockReturnValue(rpcResponse({ data: [next], error: null }));
    expect((await loadPlanningData(db as any, query, options)).forecasts[0].revisionId).toBe("new-issuance");
  });

  it("completes bounded accepted-news reads under backend caps and rejects unverified reads", async () => {
    const events = [0, 1, 2].map(index => ({ id: `news-${index}`, game_id: 2026020001,
      queue_version: index + 1, accepted_at: `2026-10-10T10:0${index}:00Z` }));
    const { db, reads } = newsDb(events, { cap: 1 });
    const result = await loadAcceptedForecastNews(db as any, [2026020001], "2026-10-10T12:00:00Z");
    expect(result.latestAcceptedAt.get(2026020001)).toBe(events[2].accepted_at);
    expect(reads.map(row => row.start)).toEqual([0, 1, 2]);
    expect(reads.every(row => row.ids.length === 1 && row.ids[0] === 2026020001)).toBe(true);
    for (const failure of [{ missingCount: true }, { cap: 1, failPage: 2 }, { cap: 1, duplicatePage: true }]) {
      const broken = newsDb(events, failure);
      const response = await loadPlanningData(broken.db as any,
        { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
        { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
      expect(response.games).toHaveLength(1);
      expect(response.forecasts).toEqual([]);
      expect(response.forecastManifest?.acceptedNewsRevision).toBeNull();
      expect(response.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["incomplete_refresh"] });
      expect(JSON.stringify(response)).not.toContain("private failure");
    }
    await expect(loadAcceptedForecastNews(db as any, [2026020001], "2026-10-10T12:00:00Z", 0)).rejects.toThrow("deadline");
  });

  it("compares accepted news to the input cutoff with PostgreSQL timestamp precision", () => {
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001+00:00", "2026-10-10T10:00:00.000Z")).toBe(true);
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001+00:00", "2026-10-10T06:00:00.000001-04:00")).toBe(false);
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001Z", "2026-10-10T10:00:00.000002Z")).toBe(false);
    expect(acceptedNewsSupersedes("invalid", "2026-10-10T10:00:00Z")).toBe(true);
  });
  it("validates actual dates, season shape and bounded custom ranges", () => {
    expect(parsePlanningDataQuery({ seasonId: "20262027", startDate: "2026-10-10", endDate: "2026-11-05" }).seasonId).toBe(20262027);
    for (const input of [
      { seasonId: "20262028", startDate: "2026-10-10", endDate: "2026-11-05" },
      { seasonId: "20262027", startDate: "2026-02-30", endDate: "2026-03-01" },
      { seasonId: "20262027", startDate: "2026-10-10", endDate: "2028-11-05" },
    ]) expect(() => parsePlanningDataQuery(input)).toThrow();
  });
  it("retains game timing/opponents and deduplicates Yahoo mapping rows", () => {
    const games = normalizePlanningGames([...rows, ...rows]);
    expect(games).toHaveLength(1);
    expect(normalizePlanningGames([{ ...rows[0], is_countable: false }])).toHaveLength(1);
    expect(games[0]).toMatchObject({ startsAt: "2026-10-10T23:00:00.000Z", opponent: "MTL", status: "scheduled" });
    expect(normalizePlanningGames([{ ...rows[0], schedule_status: "PPD" }])[0].status).toBe("postponed");
    expect(normalizePlanningGames([{ ...rows[0], schedule_status: "SUSPENDED" }])[0].status).toBe("postponed");
    expect(() => normalizePlanningGames([{ ...rows[0], game_status: "UNKNOWN" }])).toThrow("status could not be verified");
  });
  it("uses the league-local game date across midnight and DST", () => {
    const shifted = normalizePlanningGames([{ ...rows[0], start_time: "2026-11-02T01:30:00Z", game_date: "2026-11-02" }], "America/Los_Angeles");
    expect(shifted[0].date).toBe("2026-11-01");
    expect(() => parsePlanningDataQuery({ seasonId: 20262027, startDate: "2026-11-01", endDate: "2026-11-07", timeZone: "bad/zone" })).toThrow(/time zone/);
  });
  it("uses issued goalie expectations once and never exposes research payloads", () => {
    const result = publicPlanningForecasts([revision([{ playerId: 847001, startingProbability: 0.5, conditional: { SAVES_GOALIE: 30 }, probabilityStatus: "uncalibrated_model" }])], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    expect(result[0]).toMatchObject({ playerId: "7", stats: { SAVES_GOALIE: 15 }, startProbability: 0.5, confirmedStart: false, revisionId: "issued-1" });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result[0].sourceWatermark).toBe(`forge-captured-reads-v1:${"a".repeat(64)}`);
    expect(JSON.stringify(result)).not.toContain("capturedReads");
    expect(result[0].limitations.join(" ")).toContain("not calibrated");
    expect(result[0].issuedContext).toMatchObject({ playerId: "7", gameId: "2026020001",
      scheduleSourceUpdatedAt: null, scheduleFetchedAt: "2026-10-10T09:00:00Z",
      membershipCreatedAt });
  });
  it("rejects legacy, ambiguous, postponed, traded and wrong-season issued context", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1,
      conditional: { SAVES_GOALIE: 30 } }]);
    const games = normalizePlanningGames(rows);
    const now = new Date("2026-10-10T12:00:00Z");
    const rejects = (input: ForgeGameRevision, currentPlayer = player, currentGames = games, season = 20262027) => {
      const exclusions: ForecastDiscoveryExclusion[] = [];
      expect(publicPlanningForecasts([input], [currentPlayer], currentGames, now, {}, exclusions, season)).toEqual([]);
      expect(exclusions.some(item => item.reasons.includes("identity_conflict"))).toBe(true);
    };
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { rolling_player_history_contract: "legacy" } } });
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, issuedContexts: [issuedContext, issuedContext] } } });
    rejects(row, player, normalizePlanningGames([{ ...rows[0], schedule_status: "PPD" }]));
    rejects(row, { ...player, nhlTeamId: 2 });
    rejects(row, player, games, 20272028);
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, issuedContexts: [
      { ...issuedContext, roster: [issuedContext.roster[0], issuedContext.roster[0]] }] } } });
    for (const context of [
      { ...issuedContext, schedule: [null, issuedContext.schedule[1]] },
      { ...issuedContext, roster: [null] },
      { ...issuedContext, roster: [{ ...issuedContext.roster[0], membershipCreatedAt: [null] }] },
      { ...issuedContext, schedule: issuedContext.schedule.map(item => ({ ...item, fetchedAt: "invalid" })) },
      { ...issuedContext, schedule: issuedContext.schedule.map(item => ({ ...item, sourceUpdatedAt: "2026-10-11T00:00:00Z" })) },
    ]) rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!,
      issuedContexts: [context as ForgeIssuedContextV1] } } });
  });
  it("rejects future issued revisions and conflicting team-game starter mass", () => {
    const row = revision([{ playerId: 847001, startingProbability: 0.8, conditional: { SAVES_GOALIE: 30 } }, { playerId: 847002, startingProbability: 0.8, conditional: { SAVES_GOALIE: 25 } }]);
    expect(publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"))).toEqual([]);
    expect(publicPlanningForecasts([revision([])], [player], normalizePlanningGames(rows), new Date("2026-10-09"))).toEqual([]);
  });
  it("requires a bounded timestamped captured-read receipt instead of inventing a source watermark", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const receipt = row.payload.inputProvenance!.capturedReads!;
    for (const capturedReads of [undefined, { ...receipt, hash: "not-a-hash" }, { ...receipt, readCount: 0 },
      { ...receipt, firstReceivedAt: "2026-10-10T09:30:00Z" },
      { ...receipt, lastReceivedAt: "2026-10-10T10:01:00Z" }]) {
      const excluded: ForecastDiscoveryExclusion[] = [];
      const input = { ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, capturedReads } } };
      expect(publicPlanningForecasts([input], [player], normalizePlanningGames(rows),
        new Date("2026-10-10T12:00:00Z"), {}, excluded)).toEqual([]);
      expect(excluded).toContainEqual({ gameId: "2026020001", reasons: ["identity_conflict"] });
    }
  });
  it("does not turn a conditional skater forecast into a certain appearance", () => {
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 1, uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing" } } } }];
    const exclusions: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), {}, exclusions)).toEqual([]);
    expect(exclusions).toContainEqual({ gameId: "2026020001", playerId: "7", reasons: ["missing_participation"] });
  });
  it("publishes confirmed skater participation once with sanitized lineage", () => {
    const skater = { ...player, playerClass: "skater" as const, eligiblePositions: ["LW"] };
    const forecast = (probability: 0 | 1) => {
      const row = revision([]);
      row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0,
        uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
          participation: { version: "skater-participation-v1", probability, status: "confirmed_evidence", evidenceIds: ["private-source-id"] },
          same_day_evidence: { assertions: [{ privateText: "never expose" }], conflicts: [] },
        } } } }];
      return publicPlanningForecasts([row], [skater], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    };
    expect(forecast(1)[0]).toMatchObject({ sourceKind: "detailed", stats: { GOALS: 2 }, conditionalStats: { GOALS: 2 },
      appearanceProbability: 1, cutoffAt: "2026-10-10T10:00:00Z", expiresAt: "2026-10-10T23:00:00.000Z" });
    expect(forecast(0)[0]).toMatchObject({ stats: { GOALS: 0 }, conditionalStats: { GOALS: 2 }, appearanceProbability: 0 });
    expect(JSON.stringify(forecast(1))).not.toMatch(/private-source-id|never expose|privateText|inputProvenance/);
  });
  it("keeps all-strength targets unknown when PK is unsupported", () => {
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
      proj_goals_es: 2, proj_goals_pp: 1, proj_goals_pk: null, proj_hits: 3,
      uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
        participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["e"] } } } } }];
    const result = publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    expect(result[0].stats).toMatchObject({ GOALS: null, HITS: 3 });
  });
  it.each([
    ["horizon_games", 5, "outside_horizon"], ["horizon_games", undefined, "outside_horizon"],
    ["as_of_date", "2026-10-11", "identity_conflict"], ["run_id", "different-run", "identity_conflict"],
  ].flatMap(fields => ["skater", "goalie"].map(kind => [kind, ...fields])))
  ("rejects incompatible issued %s scope: %s=%s", (kind, key, value, reason) => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    if (kind === "skater") {
      row.payload.goalies = [];
      row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
        proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0, uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
          participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["e"] } } } } }];
    }
    (kind === "skater" ? row.payload.players : row.payload.goalies)[0][key as string] = value;
    const exclusions: Record<string, number> = {};
    const currentPlayer = kind === "skater" ? { ...player, playerClass: "skater" as const } : player;
    expect(publicPlanningForecasts([row], [currentPlayer], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions[reason as string]).toBe(1);
  });
  it("keeps revision identity deterministic across equal issuance times and recovers with a later compatible revision", () => {
    const first = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const second = { ...first, id: "issued-2" }, later = { ...first, id: "issued-3", published_at: "2026-10-10T07:00:00-04:00" };
    const games = normalizePlanningGames(rows), now = new Date("2026-10-10T12:00:00Z"), exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([first, second], [player], games, now, exclusions)).toEqual([]);
    expect(publicPlanningForecasts([second, first], [player], games, now)).toEqual([]);
    expect(exclusions.conflicting_forecast).toBe(1);
    expect(publicPlanningForecasts([first, first], [player], games, now)).toHaveLength(1);
    expect(publicPlanningForecasts([first, second, later], [player], games, now)[0].revisionId).toBe("issued-3");
    expect(publicPlanningForecasts([later, first, second], [player], games, now)[0].revisionId).toBe("issued-3");
  });
  it("rejects a player/goalie class conflict without substituting team statistics", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    row.payload.teams = [{ game_id: 2026020001, team_id: 1, proj_goals_es: 5 }];
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows),
      new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions.identity_conflict).toBe(1);
  });
  it("preserves PostgreSQL microsecond revision ordering and rejects a future input cutoff", () => {
    const first = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    first.published_at = "2026-10-10T10:00:00.000001Z";
    const next = { ...first, id: "later-microsecond", published_at: "2026-10-10T06:00:00.000002-04:00" };
    const games = normalizePlanningGames(rows), now = new Date("2026-10-10T12:00:00Z");
    expect(publicPlanningForecasts([first, next], [player], games, now)[0].revisionId).toBe(next.id);
    expect(publicPlanningForecasts([next, first], [player], games, now)[0].revisionId).toBe(next.id);
    const invalid = { ...first, payload: { ...first.payload, inputCutoff: "2026-10-10T10:00:00.000002Z" } };
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([invalid], [player], games, now, exclusions)).toEqual([]);
    expect(exclusions.invalid_cutoff).toBe(1);
  });
  it.each([
    ["000001", "000002", "000001"], ["000002", "000001", "000003"],
  ])("rejects receipt chronology beyond issuance or with reversed microseconds (%s/%s/%s)", (first, last, published) => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    row.published_at = `2026-10-10T10:00:00.${published}Z`;
    row.payload.inputProvenance!.capturedReads!.firstReceivedAt = `2026-10-10T10:00:00.${first}Z`;
    row.payload.inputProvenance!.capturedReads!.lastReceivedAt = `2026-10-10T10:00:00.${last}Z`;
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions.identity_conflict).toBe(1);
  });
  it("rejects unsupported conditioning, invalid issue cutoffs, expiry, and identity conflicts", () => {
    const skater = { ...player, playerClass: "skater" as const, eligiblePositions: ["LW"] };
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0,
      uncertainty: { model: { skater_selection: { production_conditioning: "legacy_availability_adjusted" } } } }];
    const games = normalizePlanningGames(rows);
    const now = new Date("2026-10-10T12:00:00Z");
    const exclusions: Record<string, number> = {};
    const exclusionRows: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([row], [skater], games, now, exclusions, exclusionRows)).toEqual([]);
    expect(exclusions.unsupported_conditioning).toBe(1);
    expect(exclusionRows).toEqual([{ gameId: "2026020001", playerId: "7",
      reasons: ["unsupported_conditioning"] }]);
    row.payload.players[0].uncertainty.model.skater_selection = { production_conditioning: "conditional_playing",
      participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["e"] } };
    expect(publicPlanningForecasts([{ ...row, decision_as_of: "2026-10-10T09:00:00Z" }], [skater], games, now)[0]).toBeDefined();
    expect(publicPlanningForecasts([{ ...row, decision_as_of: "2026-10-10T13:00:00Z" }], [skater], games, now)).toEqual([]);
    expect(publicPlanningForecasts([row], [skater], games, new Date("2026-10-10T23:00:00Z"))).toEqual([]);
    expect(publicPlanningForecasts([row], [{ ...skater, nhlTeamId: 2 }], games, now)).toEqual([]);
    expect(publicPlanningForecasts([{ ...row, payload: { ...row.payload, players: [{ ...row.payload.players[0], game_id: 2026020999 }] } }], [skater], games, now)).toEqual([]);
    const horizonExclusions: Record<string, number> = {};
    const distantGames = games.map(game => ({ ...game, startsAt: "2026-10-24T00:00:00Z" }));
    expect(publicPlanningForecasts([row], [skater], distantGames, now, horizonExclusions)).toEqual([]);
    expect(horizonExclusions.outside_horizon).toBe(1);
  });
  it("preserves the shared serving canary without truncating the schedule", async () => {
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020001");
    const allowed = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const tables: Record<string, unknown[]> = {
      roster_optimizer_team_games: [...rows, { ...rows[0], id: 2, source_game_id: 2026020002 }],
      fhfh_player_identities: [{ id: 7, nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }],
      yahoo_matchup_weeks: [{ id: 1, game_key: "477", week: 1, start_date: "2026-09-29", end_date: "2026-10-04" }, { id: 2, game_key: "477", week: 2, start_date: "2026-10-05", end_date: "2026-10-11" }],
      teams: [{ id: 1, abbreviation: "TOR" }], rosters: [{ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] }],
    };
    const db = { from: (table: string) => {
      const result = Promise.resolve({ data: tables[table] ?? [], count: (tables[table] ?? []).length, error: null });
      const chain: any = new Proxy({}, { get: (_, key) => key === "then" ? result.then.bind(result) : () => chain });
      return chain;
    }, rpc: vi.fn().mockReturnValue(rpcResponse({ data: [allowed, { ...allowed, id: "not-enabled", game_id: 2026020002 }], error: null })) };
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" }, { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
    expect(result.games).toHaveLength(2);
    expect(result.forecasts.map(row => row.gameId)).toEqual(["2026020001"]);
    expect(result.forecastManifest).toMatchObject({ version: "planning-forecasts-v1", seasonId: 20262027,
      issuedRevisionIds: ["issued-1"], requiredOpportunities: 2, forecastedOpportunities: 1 });
    expect(result.forecastManifest?.scheduleRevision).toBeTruthy();
    expect(result.forecastManifest?.rosterRevision).toBeTruthy();
    expect(result.forecastManifest?.calendarPolicy).toEqual({ version: "forecast-calendar-v1", calendarDays: 14,
      overlapDays: 7, timeZone: "UTC" });
    vi.stubEnv("STARTER_BOARD_CALENDAR_HORIZON_DAYS", "21");
    const changedPolicy = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
    expect(changedPolicy.forecastManifest?.calendarPolicy?.calendarDays).toBe(21);
    expect(changedPolicy.forecastManifest?.id).not.toBe(result.forecastManifest?.id);
    expect(changedPolicy.forecasts).toEqual(result.forecasts);
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["canary_excluded"] });
    expect(JSON.stringify(result.forecastManifest)).not.toContain("private");
    expect(result.evidence.forecasts.limitations.join(" ")).toContain("rollout");
    expect(result.matchupWeeks).toEqual([{ gameKey: "477", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }, { gameKey: "477", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }]);
  });
  it("skips the skater stats read when no prior regular-season games are present", async () => {
    const { db, calls } = formDb([], []);
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(calls.some(call => call.table === "games")).toBe(true);
    expect(calls.some(call => call.table === "skatersGameStats")).toBe(false);
    expect(result.evidence.form.limitations.join(" ")).not.toContain("query_failed");
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["serving_disabled"] });
  });
  it("reports a safe recent-form failure stage without database details", async () => {
    for (const stage of ["games", "skatersGameStats"] as const) {
      const { db } = formDb([{ id: 100, date: "2026-10-09" }], [], stage);
      const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
        { now: new Date("2026-10-10T12:00:00Z") });
      expect(result.evidence.form.limitations).toContain(`recent_form_${stage === "games" ? "games" : "stats"}_query_failed`);
      expect(JSON.stringify(result.evidence.form)).not.toContain("private database details");
    }
  });
  it("orders NHL-identity game logs by actual date before deriving recent form", async () => {
    const history = [100, 200, 300, 400, 500, 600].map((id, index) => ({ id, date: `2026-10-0${9 - index}` }));
    const stats = [3, 3, 1, 0, 0, 0].map((points, index) => ({ playerId: 847001, gameId: history[index].id, points }));
    const { db, calls } = formDb(history, stats);
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(result.players[0].form).toEqual({ label: "Scoring hot", games: 3, points: 7, includedInForecast: null });
    expect(calls.find(call => call.table === "skatersGameStats" && call.method === "in")?.args[0]).toBe("gameId");
    expect(calls.filter(call => call.table === "skatersGameStats" && call.method === "in").every(call => (call.args[1] as number[]).length <= 100)).toBe(true);
  });
  it("bounds each skater stats lookup to 100 game IDs", async () => {
    const history = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, date: "2026-10-09" }));
    const { db, calls } = formDb(history, []);
    await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(calls.filter(call => call.table === "skatersGameStats" && call.method === "in").map(call => (call.args[1] as number[]).length))
      .toEqual([100, 1]);
  });
});

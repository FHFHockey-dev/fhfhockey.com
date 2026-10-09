import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAccountabilityCandles, buildPlayerForecastCandles } from "./accountability";
import { assignmentsFor, capturePlayerForecastSourceRows, goalieObservationStatus, injuryObservationStatus, type ForecastLineSourceRow } from "./sourceObservations";
import { createPlayerForecastReviewToken, verifyPlayerForecastReviewToken } from "./reviewToken";
import { probePlayerForecastTable } from "./readiness";
import {
  playerForecastErrorMessage,
  playerForecastRuntimeBoundary,
} from "./runtimeSafety";
import { buildCalendarGameScopes, buildNextTenGameScopes } from "./schedule";
import { inspectCalendarForgeCoverage, planPlayerForecastCalendarWork, seedCalendarForgeJobs } from "./orchestration";
import { ForecastScheduleError, readForecastSchedule } from "./scopeReads";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { actualForOutput, parseTimeOnIceSeconds, scoreForecast, settlePlayerForecasts } from "./settlement";
import {
  createPlayerForecastServingArtifact,
  ensureValidationFeatureSnapshots,
  playerForecastCanonicalHash,
  verifyPlayerForecastArtifact,
} from "./serving";
import { aggregatePlayerForecastRestOfSeason } from "./restOfSeason";
import type { PlayerForecastRevision } from "./contracts";

function scopeQuery(rows: any[], options: { cap?: number; failure?: string } = {}) {
  let selected = rows, start = 0, end = 499, head = false;
  const query: any = {};
  query.select = vi.fn((_: string, config: any) => { selected = rows; head = config?.head === true; return query; });
  query.eq = vi.fn((key: string, value: unknown) => { selected = selected.filter(row => row[key] === value); return query; });
  query.in = vi.fn((key: string, values: unknown[]) => { selected = selected.filter(row => values.includes(row[key])); return query; });
  query.gte = vi.fn((key: string, value: string) => { selected = selected.filter(row => row[key] >= value); return query; });
  query.lte = vi.fn((key: string, value: string) => { selected = selected.filter(row => row[key] <= value); return query; });
  query.or = vi.fn((expression: string) => {
    const teamId = Number(expression.split(",")[0].split(".")[2]);
    selected = selected.filter(row => row.homeTeamId === teamId || row.awayTeamId === teamId); return query;
  });
  query.order = vi.fn(() => query);
  query.abortSignal = vi.fn(() => query);
  query.range = vi.fn((first: number, last: number) => { start = first; end = last; return query; });
  query.then = (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
    const offset = options.failure === "duplicate" ? 0 : start;
    return Promise.resolve({ count: options.failure === "missing_count" ? null : options.failure === "overflow" ? 5001
      : selected.length + (options.failure === "drift" && start ? 1 : 0),
    error: options.failure === "late_error" && start ? { message: "private error" } : null,
    data: options.failure === "null_data" || head ? null : options.failure === "no_progress" && start ? []
      : selected.slice(offset, offset + Math.min(end - start + 1, options.cap ?? 500)) }).then(resolve, reject);
  };
  return query;
}

function scheduleRows(games: any[]) {
  const fetchedAt = new Date(Math.min(...games.map(game => Date.parse(`${game.date}T00:00:00Z`))) - 86400000).toISOString();
  return games.flatMap(game => [game.homeTeamId, game.awayTeamId].map((teamId, index) => ({
    id: game.id * 2 + index, source_game_id: game.id, source_season_id: game.seasonId,
    season: String(game.seasonId).slice(0, 4), game_type: 2, game_date: game.date,
    team_id: teamId, opponent_team_id: index === 0 ? game.awayTeamId : game.homeTeamId,
    team_abbreviation: index === 0 ? "TOR" : "MTL", opponent_abbreviation: index === 0 ? "MTL" : "TOR",
    home_away: index === 0 ? "home" : "away", start_time: game.startTime,
    game_status: "FUT", schedule_status: "OK", fetched_at: fetchedAt,
  })));
}
function scheduleDb(games: any[], query = scopeQuery(games), rows = scheduleRows(games), options = {}) {
  return { from: vi.fn((table: string) => table === "games" ? query : scopeQuery(rows, options)), rpc: vi.fn() } as any;
}

const baseRevision: PlayerForecastRevision = {
  outputId: "out-1",
  runId: "run-1",
  gameId: 100,
  teamId: 10,
  playerId: 20,
  playerName: "Test Player",
  population: "forward",
  targetKey: "shots",
  conditioning: "conditional_playing",
  teamGameHorizon: 10,
  pointEstimate: 2.4,
  probability: null,
  distributionKind: "research-test",
  distribution: null,
  quantiles: { p10: 1, p90: 5 },
  issuedAt: "2026-11-01T10:00:00Z",
  cutoffAt: "2026-11-01T10:00:00Z",
  scheduledStartAt: "2026-11-28T23:00:00Z",
  modelVersion: "test",
  artifactChecksum: "checksum",
  featureSchemaVersion: "test",
  sourceHighWatermark: "2026-11-01T09:59:00Z",
  fallbackFlags: [],
  degraded: false,
  degradedReasons: [],
};

describe("player forecast schedule", () => {
  it("opens each team's horizon at ten future scheduled games", () => {
    const games = Array.from({ length: 12 }, (_, index) => ({
      id: 100 + index,
      seasonId: 20262027,
      date: `2026-11-${String(index + 2).padStart(2, "0")}`,
      startTime: `2026-11-${String(index + 2).padStart(2, "0")}T23:00:00Z`,
      homeTeamId: index % 2 === 0 ? 10 : 20,
      awayTeamId: index % 2 === 0 ? 20 : 10,
      type: 2,
    }));
    const scopes = buildNextTenGameScopes({
      games: [
        { ...games[0], id: 99, type: 1 },
        { ...games[0], id: 98, seasonId: 20252026 },
        ...games,
      ],
      now: new Date("2026-11-01T10:00:00Z"),
      teamId: 10,
    });
    expect(scopes).toHaveLength(10);
    expect(scopes.map((scope) => scope.teamGameHorizon)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(scopes[9]?.scopeKey).toBe("game:109:team:10");
  });

  it("keeps UTC calendar days and team-game ordinal separate across season rollover", () => {
    const games = [
      { id: 1, seasonId: 20252026, date: "2026-06-30", startTime: "2026-06-30T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 },
      { id: 2, seasonId: 20262027, date: "2026-07-01", startTime: "2026-07-01T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 },
      { id: 3, seasonId: 20262027, date: "2026-07-02", startTime: "2026-07-02T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 1 },
      { id: 4, seasonId: 20252026, date: "2026-07-02", startTime: "2026-07-02T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 },
      { id: 5, seasonId: 20262027, date: "2026-07-03", startTime: "2026-07-03T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 },
      { id: 6, seasonId: 20262027, date: "2026-07-04", startTime: "2026-07-04T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 },
    ];
    const scopes = buildCalendarGameScopes({ games, now: new Date("2026-06-30T10:00:00Z"), days: 4, teamId: 10 });
    expect(scopes.map((scope) => [scope.gameId, scope.calendarLeadDay, scope.teamGameHorizon])).toEqual([
      [1, 0, 1], [2, 1, 2], [5, 3, 3],
    ]);
  });

  it("uses scheduled UTC day for calendar lead while retaining the source game date", async () => {
    const game = { id: 7, seasonId: 20262027, date: "2026-09-29",
      startTime: "2026-09-30T00:30:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 };
    const previousUtcDay = buildCalendarGameScopes({ games: [game], now: new Date("2026-09-29T20:00:00Z"), days: 2,
      teamId: 10 });
    expect(previousUtcDay).toMatchObject([{ gameDate: "2026-09-29", scheduledStartAt: "2026-09-30T00:30:00.000Z",
      calendarLeadDay: 1 }]);
    const query = scopeQuery([game]);
    const supabase = scheduleDb([game], query);
    const nextUtcDay = await planPlayerForecastCalendarWork({ supabase, now: new Date("2026-09-30T00:00:00Z"), days: 1 });
    expect(query.gte).toHaveBeenCalledWith("date", "2026-09-29");
    expect(nextUtcDay.scopes.filter((scope) => scope.teamId === 10)).toMatchObject([
      { gameId: 7, gameDate: "2026-09-29", calendarLeadDay: 0 },
    ]);
  });

  it("reports 7/14/21-day workload and queue overflow without enqueueing", async () => {
    const games = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1, seasonId: 20262027,
      date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      startTime: `2026-11-${String(index + 1).padStart(2, "0")}T20:00:00Z`,
      homeTeamId: 10, awayTeamId: 20, type: 2,
    }));
    const query = scopeQuery(games, { cap: 2 });
    const supabase = scheduleDb(games, query);
    const result = await planPlayerForecastCalendarWork({ supabase, now: new Date("2026-11-01T10:00:00Z") });
    expect(result).toMatchObject({ calendarDays: 14, dryRun: true, queueCompatibleScopes: 20, queueIncompatibleScopes: 4 });
    expect(result.workload.map((row) => [row.calendarDays, row.games, row.queueIncompatibleScopes])).toEqual([
      [7, 7, 0], [14, 12, 4], [21, 12, 4],
    ]);
    expect(query.lte).toHaveBeenCalledWith("date", "2026-11-21");
    expect(query.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects a calendar fetch that may have hidden games beyond its result cap", async () => {
    const query = scopeQuery([], { failure: "overflow" });
    await expect(planPlayerForecastCalendarWork({ supabase: { from: vi.fn(() => query) } as any,
      now: new Date("2026-09-29T10:00:00Z") })).rejects.toThrow("incomplete");
    expect(query.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
  });

  it("reconciles both schedule sides and reports excluded calendar games", async () => {
    const games = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, seasonId: 20262027,
      date: "2026-11-01", startTime: "2026-11-01T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 }));
    const rows = scheduleRows(games).map(row => ({ ...row,
      schedule_status: ["OK", "PPD", "CANCELLED", "SUSPENDED"][row.source_game_id - 1] }));
    const db = scheduleDb(games, scopeQuery(games, { cap: 1 }), rows, { cap: 1 });
    const now = new Date("2026-11-01T10:00:00Z");
    const result = await planPlayerForecastCalendarWork({ supabase: db, now });
    expect([...new Set(result.scopes.map(row => row.gameId))]).toEqual([1]);
    expect(result.scheduleCoverage).toMatchObject({ readStatus: "complete", discoveredGames: 4, eligibleGames: 1,
      excludedGames: [{ gameId: 2, status: "postponed" }, { gameId: 3, status: "cancelled" }, { gameId: 4, status: "postponed" }], staleGameIds: [] });
    const verified = await readForecastSchedule({ db, now, teamId: 10 });
    expect(buildNextTenGameScopes({ games: verified, now, teamId: 10 }).map(row => row.gameId)).toEqual([1]);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("fails closed on missing, conflicting, unknown or incompletely read schedule status", async () => {
    const games = [{ id: 1, seasonId: 20262027, date: "2026-11-01", startTime: "2026-11-01T20:00:00Z",
      homeTeamId: 10, awayTeamId: 20, type: 2 }];
    const rows = scheduleRows(games);
    const failures = [[], rows.slice(0, 1), [rows[0], { ...rows[1], schedule_status: "PPD" }],
      [...rows, { ...rows[0], id: 9, schedule_status: "PPD" }],
      rows.map(row => ({ ...row, game_status: "UNKNOWN" })), rows.map(row => ({ ...row, schedule_status: "UNKNOWN" })),
      rows.map(row => ({ ...row, source_season_id: 20252026 })), rows.map(row => ({ ...row, game_type: 1 })),
      rows.map(row => ({ ...row, start_time: "2026-11-01T21:00:00Z" })),
      rows.map(row => ({ ...row, fetched_at: "2026-11-01T11:00:00Z" })),
      [rows[0], { ...rows[1], opponent_abbreviation: "NYR" }]];
    for (const evidence of failures) await expect(planPlayerForecastCalendarWork({
      supabase: scheduleDb(games, scopeQuery(games), evidence), now: new Date("2026-11-01T10:00:00Z"),
    })).rejects.toThrow(/schedule/);
    for (const failure of ["missing_count", "null_data", "drift", "late_error", "duplicate", "no_progress", "overflow"]) {
      await expect(planPlayerForecastCalendarWork({ supabase: scheduleDb(games, scopeQuery(games), rows, { cap: 1, failure }),
        now: new Date("2026-11-01T10:00:00Z") })).rejects.toThrow(/scope/);
    }
    const duplicate = scheduleDb(games, scopeQuery(games), [...rows, { ...rows[0], id: 9 }]);
    expect((await planPlayerForecastCalendarWork({ supabase: duplicate, now: new Date("2026-11-01T10:00:00Z") })).scopes).toHaveLength(2);
  });

  it("discloses stale schedule receipts in preview and rejects generation writes", async () => {
    const games = [{ id: 1, seasonId: 20262027, date: "2026-11-01", startTime: "2026-11-01T20:00:00Z",
      homeTeamId: 10, awayTeamId: 20, type: 2 }];
    const db = scheduleDb(games, scopeQuery(games), scheduleRows(games).map(row => ({ ...row, fetched_at: "2026-09-01T00:00:00Z" })));
    const now = new Date("2026-11-01T10:00:00Z");
    expect((await seedCalendarForgeJobs({ supabase: db, now })).scheduleCoverage.staleGameIds).toEqual([1]);
    await expect(seedCalendarForgeJobs({ supabase: db, now, dryRun: false, environment: {
      STARTER_BOARD_CALENDAR_SCHEDULER_ENABLED: "true", STARTER_BOARD_CALENDAR_SEED_ENABLED: "true", STARTER_BOARD_SCHEDULER_ENABLED: "true",
      STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true", STARTER_BOARD_CANARY_GAME_IDS: "1",
      STARTER_BOARD_CALENDAR_BUDGET_APPROVED: "true",
    } })).rejects.toThrow("fresh authoritative schedule");
    expect(db.from.mock.calls.every(([table]: [string]) => table !== "forge_game_update_queue")).toBe(true);
  });

  it("reports all schedule mismatches across batches without issuing a partial scope", async () => {
    const games = Array.from({ length: 101 }, (_, index) => ({ id: 2026020200 + index, seasonId: 20262027,
      date: "2026-10-06", startTime: "2026-10-06T23:30:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 }));
    games[0].id = 2026020048;
    games[100].id = 2026020052;
    games[100].startTime = "2026-10-07T02:00:00Z";
    const rows = scheduleRows(games).map(row => ({ ...row, fetched_at: "2026-10-01T00:00:00Z",
      start_time: row.source_game_id === 2026020048 ? "2026-10-07T00:00:00Z"
        : row.source_game_id === 2026020052 ? "2026-10-07T02:30:00Z" : row.start_time }));
    const db = scheduleDb(games, scopeQuery(games, { cap: 1 }), rows, { cap: 1 });
    const now = new Date("2026-10-01T10:00:00Z");
    await expect(seedCalendarForgeJobs({ supabase: db, now, dryRun: false })).rejects.toMatchObject({
      name: "ForecastScheduleError", receipt: { readStatus: "complete", validationStatus: "rejected",
        stage: "reconciliation", discoveredGames: 101, checkedGames: 101, unreadGames: 0,
        scope: { fromDate: "2026-09-30", throughDate: "2026-10-21", teamId: null }, reasons: ["start_time_mismatch"],
        rejectedGames: [{ gameId: 2026020048, reasons: ["start_time_mismatch"] },
          { gameId: 2026020052, reasons: ["start_time_mismatch"] }] } });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from.mock.calls.every(([table]: [string]) => table !== "forge_game_update_queue")).toBe(true);

    let statusReads = 0;
    const partial = { from: vi.fn((table: string) => table === "games" ? scopeQuery(games)
      : scopeQuery(rows, statusReads++ === 0 ? {} : { failure: "null_data" })) } as any;
    await expect(readForecastSchedule({ db: partial, now, throughDate: "2026-10-21" })).rejects.toMatchObject({
      receipt: { readStatus: "incomplete", validationStatus: "rejected", stage: "team_game_status",
        discoveredGames: 101, checkedGames: 100, unreadGames: 1, reasons: ["incomplete_read"],
        rejectedGames: [{ gameId: 2026020048, reasons: ["start_time_mismatch"] }] } });
  });

  it("keeps unread discovery counts unknown and exposes only safe rejection codes", async () => {
    const db = { from: vi.fn(() => scopeQuery([], { failure: "missing_count" })) } as any;
    await expect(readForecastSchedule({ db, now: new Date("2026-10-01T10:00:00Z"), throughDate: "2026-10-21" }))
      .rejects.toMatchObject({ name: "ForecastScheduleError", receipt: { readStatus: "incomplete",
        validationStatus: "rejected", stage: "canonical_games", discoveredGames: null, checkedGames: 0,
        unreadGames: null, reasons: ["incomplete_read"], rejectedGames: [] } });
    const games = [{ id: 1, seasonId: 20262027, date: "2026-10-06", startTime: "2026-10-06T23:30:00Z",
      homeTeamId: 10, awayTeamId: 20, type: 2 }];
    const rows = scheduleRows(games).map(row => ({ ...row, fetched_at: "2026-10-01T00:00:00Z",
      source_season_id: 20252026, game_status: "private unsupported status" }));
    try {
      await readForecastSchedule({ db: scheduleDb(games, scopeQuery(games), rows),
        now: new Date("2026-10-01T10:00:00Z"), throughDate: "2026-10-21" });
      expect.fail("Invalid schedule must reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ForecastScheduleError);
      const receipt = (error as ForecastScheduleError).receipt;
      expect(receipt.rejectedGames).toEqual([{ gameId: 1, reasons: ["season_mismatch", "unknown_status"] }]);
      expect(JSON.stringify(receipt)).not.toContain("private");
    }
  });

  it("seeds each eligible calendar game once through the single-game FORGE queue", async () => {
    const games = [{ id: 1, seasonId: 20262027, date: "2026-11-01", startTime: "2026-11-01T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 }];
    const selectGames = scopeQuery(games);
    const queueSelect = vi.fn(async () => ({ data: [{ game_id: 1 }], error: null }));
    const upsert = vi.fn(() => ({ select: queueSelect }));
    const supabase = { from: vi.fn((table: string) => table === "games" ? selectGames
      : table === "roster_optimizer_team_games" ? scopeQuery(scheduleRows(games)) : { upsert }) } as any;
    const dryRun = await seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z") });
    expect(dryRun).toMatchObject({ dryRun: true, gameIds: [1], inserted: 0 });
    expect(upsert).not.toHaveBeenCalled();
    await expect(seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"), dryRun: false,
      environment: {} })).rejects.toThrow("budget approval");
    expect(upsert).not.toHaveBeenCalled();
    const environment = { STARTER_BOARD_CALENDAR_SCHEDULER_ENABLED: "true", STARTER_BOARD_CALENDAR_SEED_ENABLED: "true", STARTER_BOARD_SCHEDULER_ENABLED: "true",
      STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true",
      STARTER_BOARD_CANARY_GAME_IDS: "1", STARTER_BOARD_CALENDAR_BUDGET_APPROVED: "true" };
    await expect(seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"), dryRun: false,
      environment: { ...environment, STARTER_BOARD_CALENDAR_BUDGET_APPROVED: "false" } })).rejects.toThrow("budget approval");
    expect(upsert).not.toHaveBeenCalled();
    const result = await seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"), dryRun: false, environment });
    expect(result).toMatchObject({ dryRun: false, gameIds: [1], inserted: 1 });
    expect(result.calendarPolicy).toEqual({ version: "forecast-calendar-v1", calendarDays: 14, overlapDays: 7, timeZone: "UTC" });
    await expect(seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"), dryRun: false,
      days: 21, environment })).rejects.toThrow("configured serving horizon");
    const preview = await seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"),
      days: 21, environment });
    expect(preview.calendarPolicy.calendarDays).toBe(21);
    const configured = await seedCalendarForgeJobs({ supabase, now: new Date("2026-11-01T10:00:00Z"),
      environment: { ...environment, STARTER_BOARD_CALENDAR_HORIZON_DAYS: "7" } });
    expect(configured.calendarPolicy.calendarDays).toBe(7);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ game_id: 1 })], {
      onConflict: "game_id", ignoreDuplicates: true,
    });
  });

  it("reports queue receipts, projection rows, and issued revisions independently", async () => {
    const rows: Record<string, any[]> = {
      forge_game_update_queue: [{ game_id: 1, status: "succeeded" }],
      forge_game_revisions: [], forge_player_projections: [], forge_goalie_projections: [],
    };
    const db = { from: vi.fn((table: string) => scopeQuery(rows[table])) } as any;
    expect(await inspectCalendarForgeCoverage(db, [1, 1])).toMatchObject({ games: 1, queuedGames: 1,
      issuedGames: 0, unissuedGameIds: [1], projectionRows: 0, goalieProjectionRows: 0, complete: true,
      readStatus: "complete", coverageBasis: "storage_receipts", queueStatuses: { succeeded: 1 },
      consumerCoverage: { status: "not_evaluated", requiredPlayerGameTargets: null, eligiblePlayerGameTargets: null } });
  });

  it("reads only compact immutable target receipts and preserves unknown legacy issuance", async () => {
    const manifest = { version: "forge-issued-targets-v1", outputHash: "a".repeat(64), unmappedOutputs: 0,
      opportunities: [{ playerId: 7, nhlPlayerId: 77, gameId: 1, teamId: 10, seasonId: 20262027,
        population: "skater", conditioning: "conditional_playing", targetKeys: ["GOALS"], privateSource: "excluded" }] };
    const rows: Record<string, any[]> = { forge_game_update_queue: [{ game_id: 1, status: "failed" }],
      forge_game_revisions: [{ id: "new", game_id: 1, published_at: "2026-10-01T00:00:00Z", issued_targets: manifest },
        { id: "old", game_id: 1, published_at: "2026-09-30T00:00:00Z" }],
      forge_player_projections: [], forge_goalie_projections: [] };
    const queries = Object.fromEntries(Object.entries(rows).map(([table, data]) => [table, scopeQuery(data, { cap: 1 })]));
    const db = { from: vi.fn((table: string) => queries[table]) } as any;
    const result = await inspectCalendarForgeCoverage(db, [1]);
    expect(result.scopeReceipts).toMatchObject({ gameIds: [1], queue: [{ gameId: 1, status: "failed" }],
      revisions: [{ revisionId: "new", targetManifest: { opportunities: [{ targetKeys: ["GOALS"] }] } },
        { revisionId: "old", targetManifest: null }] });
    expect(result.scopeReceipts.revisions[0].targetManifest?.opportunities[0]).not.toHaveProperty("privateSource");
    expect(queries.forge_game_revisions.select).toHaveBeenCalledWith(
      "id,game_id,published_at,issued_targets:payload->inputProvenance->issuedTargets", { count: "exact" });
    expect(result).toMatchObject({ issuedGames: 1, issuedRevisions: 2, projectionRows: 0, queueStatuses: { failed: 1 } });
  });

  it.each(["missing_count", "null_data", "drift", "late_error", "duplicate", "no_progress"])(
    "rejects %s before calendar queue writes", async failure => {
      const games = [1, 2].map(id => ({ id, seasonId: 20262027, date: "2026-11-01",
        startTime: "2026-11-01T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 }));
      const query = scopeQuery(games, { cap: 1, failure });
      const db = { from: vi.fn(() => query), rpc: vi.fn() } as any;
      await expect(seedCalendarForgeJobs({ supabase: db, now: new Date("2026-11-01T10:00:00Z") })).rejects.toThrow(/scope/);
      expect(db.from.mock.calls.every(([table]: [string]) => table === "games")).toBe(true);
      expect(db.rpc).not.toHaveBeenCalled();
    });

  it("completes diagnostic pages and never counts historical revisions as usable forecasts", async () => {
    const rows: Record<string, any[]> = {
      forge_game_update_queue: [1, 2, 3].map(game_id => ({ game_id, status: "succeeded" })),
      forge_game_revisions: [{ id: "old", game_id: 1 }, { id: "new", game_id: 1 }, { id: "other", game_id: 2 }],
      forge_player_projections: [{ game_id: 1, horizon_games: 1 }, { game_id: 1, horizon_games: 5 }],
      forge_goalie_projections: [{ game_id: 2, horizon_games: 1 }],
    };
    const db = { from: vi.fn((table: string) => scopeQuery(rows[table], { cap: 1 })) } as any;
    const result = await inspectCalendarForgeCoverage(db, [3, 1, 2, 1]);
    expect(result).toMatchObject({ games: 3, queuedGames: 3, issuedGames: 2, issuedRevisions: 3,
      unissuedGameIds: [3], projectionRows: 1, goalieProjectionRows: 1, readStatus: "complete",
      consumerCoverage: { status: "not_evaluated", eligiblePlayerGameTargets: null } });
    for (const failure of ["missing_count", "drift", "late_error", "duplicate", "no_progress", "overflow"]) {
      for (const broken of ["forge_game_update_queue", "forge_game_revisions"]) {
        const bad = { from: (table: string) => scopeQuery(rows[table], { cap: 1, failure: table === broken ? failure : undefined }) } as any;
        await expect(inspectCalendarForgeCoverage(bad, [1, 2, 3])).rejects.toThrow(/scope/);
      }
    }
    for (const broken of ["forge_player_projections", "forge_goalie_projections"]) {
      const bad = { from: (table: string) => scopeQuery(rows[table], { failure: table === broken ? "missing_count" : undefined }) } as any;
      await expect(inspectCalendarForgeCoverage(bad, [1, 2, 3])).rejects.toThrow("count is unavailable");
    }
    const empty = { from: vi.fn() } as any;
    expect(await inspectCalendarForgeCoverage(empty, [])).toMatchObject({ games: 0, projectionRows: 0,
      consumerCoverage: { status: "not_evaluated" } });
    expect(empty.from).not.toHaveBeenCalled();
    await expect(inspectCalendarForgeCoverage(empty, [NaN])).rejects.toThrow("scope");
  });

  it("bounds a stalled calendar read even when the transport ignores cancellation", async () => {
    vi.useFakeTimers();
    try {
      const query = scopeQuery([]);
      query.then = () => new Promise(() => {});
      const result = planPlayerForecastCalendarWork({ supabase: { from: () => query } as any,
        now: new Date("2026-11-01T10:00:00Z") });
      const failure = expect(result).rejects.toThrow("deadline");
      await vi.advanceTimersByTimeAsync(8000);
      await failure;
      expect(query.abortSignal.mock.calls[0][0].aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("reads the requested team's whole bounded schedule before selecting its next ten games", async () => {
    const games = Array.from({ length: 150 }, (_, index) => ({ id: index + 1, seasonId: 20262027,
      date: "2026-10-11", startTime: "2026-10-11T20:00:00Z", homeTeamId: 10, awayTeamId: 20, type: 2 }));
    games.push(...Array.from({ length: 12 }, (_, index) => ({ id: 1000 + index, seasonId: 20262027,
      date: `2026-10-${index + 12}`, startTime: `2026-10-${index + 12}T20:00:00Z`, homeTeamId: 99, awayTeamId: 20, type: 2 })));
    const query = scopeQuery(games, { cap: 2 });
    const selected = await readForecastSchedule({ db: scheduleDb(games, query),
      now: new Date("2026-10-10T18:00:00Z"), teamId: 99 });
    expect(query.or).toHaveBeenCalledWith("homeTeamId.eq.99,awayTeamId.eq.99");
    expect(query.range.mock.calls.map((call: unknown[]) => call[0])).toEqual([0, 2, 4, 6, 8, 10]);
    expect(buildNextTenGameScopes({ games: selected, now: new Date("2026-10-10T18:00:00Z"), teamId: 99 })
      .map(row => row.gameId)).toEqual(Array.from({ length: 10 }, (_, index) => 1000 + index));
  });
});

describe("player forecast accountability", () => {
  it("uses only pregame revisions for candle OHLC and overlays the outcome", () => {
    const revisions = [
      baseRevision,
      { ...baseRevision, outputId: "out-2", issuedAt: "2026-11-20T10:00:00Z", teamGameHorizon: 3, pointEstimate: 1.8 },
      { ...baseRevision, outputId: "out-3", issuedAt: "2026-11-28T22:55:00Z", teamGameHorizon: 1, pointEstimate: 3.1 },
      { ...baseRevision, outputId: "out-4", issuedAt: "2026-11-28T23:01:00Z", teamGameHorizon: 1, pointEstimate: 99 },
    ];
    const candles = buildPlayerForecastCandles({
      revisions,
      outcomes: [{ gameId: 100, playerId: 20, targetKey: "shots", value: 4, settlementStatus: "provisional" }],
    });
    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({ open: 2.4, low: 1.8, high: 3.1, close: 3.1, actual: 4, revisionCount: 3 });
  });

  it("aggregates standardized checkpoint scores without per-player hindsight selection", () => {
    const candles = buildAccountabilityCandles([
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "H10", checkpointOrder: 10, compositeSkillScore: 48, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "provisional" },
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "H5", checkpointOrder: 20, compositeSkillScore: 61, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "provisional" },
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "final_pregame", checkpointOrder: 30, compositeSkillScore: 57, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "final" },
    ]);
    expect(candles[0]).toMatchObject({ open: 48, low: 48, high: 61, close: 57, settlementStatus: "final" });
  });
});

describe("source semantics", () => {
  afterEach(() => vi.unstubAllEnvs());
  const goalieRow = { status: "observed", nhl_filter_status: "accepted", classification: "goalie_start", game_id: 100, team_id: 10,
    capture_key: "goalie-retry", source_group: "gdl", source_key: "gamedaygoalies", source_account: "reporter", source_url: "https://x.com/reporter/status/123",
    observed_at: "2026-10-10T18:01:00.000Z", tweet_posted_at: "2026-10-10T18:00:00.000Z", raw_text: "Woll is confirmed to start tonight",
    goalie_1_player_id: 1, goalie_1_name: "Woll", goalie_2_player_id: null, goalie_2_name: null } as ForecastLineSourceRow;
  it("injury capture enqueues complete team scopes and does not enqueue after an incomplete read", async () => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    const row = { ...goalieRow, classification: "injury", injured_player_ids: [7], injured_player_names: ["Player"],
      raw_text: "Player is day-to-day" };
    const games = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, seasonId: 20262027,
      date: `2026-10-${index + 11}`, startTime: `2026-10-${index + 11}T20:00:00Z`, homeTeamId: 10, awayTeamId: 20, type: 2 }));
    for (const failure of [undefined, "missing_count"]) {
      const query = scopeQuery(games, { cap: 2, failure });
      const rpc = vi.fn(async (_name: string, _args: unknown) => ({ data: { insertedSnapshot: true, insertedAssignments: 1 }, error: null }));
      const pending = capturePlayerForecastSourceRows({ supabase: { ...scheduleDb(games, query), rpc } as any, rows: [row] });
      if (failure) await expect(pending).rejects.toThrow("incomplete");
      else expect((await pending).jobsQueued).toBe(10);
      const jobs = rpc.mock.calls.filter(([name]) => name === "enqueue_player_forecast_job").map(([, value]) => value as any);
      expect(jobs.map(job => job.p_team_game_horizon)).toEqual(failure ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(jobs.every(job => job.p_team_id === 10 && job.p_metadata.teamWide)).toBe(true);
    }
  });
  it("captures goalie evidence and conflicts through one atomic RPC before queueing research work", async () => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    const rpc = vi.fn(async (name: string) => ({ data: name === "capture_starter_board_goalies"
      ? { insertedObservations: 1, insertedConflicts: 1, observationIds: ["observation-1"] } : null, error: null }));
    const from = vi.fn(() => { throw new Error("No split table writes allowed"); });
    const result = await capturePlayerForecastSourceRows({ supabase: { rpc, from } as any, rows: [goalieRow] });
    expect(result).toMatchObject({ goalieObservations: 1, conflicts: 1, jobsQueued: 1 });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["capture_starter_board_goalies", "enqueue_player_forecast_job"]);
    expect(rpc).toHaveBeenNthCalledWith(1, "capture_starter_board_goalies", { p_observations: [expect.objectContaining({
      observation_status: "confirmed", confidence: null, observed_at: goalieRow.tweet_posted_at,
      available_at: goalieRow.observed_at, metadata: { sourceTiming: { sourcePublishedAt: goalieRow.tweet_posted_at,
        receivedAt: goalieRow.observed_at, sourceReference: "tweet:123" } },
    })] });
    expect(from).not.toHaveBeenCalled();
  });
  it("propagates atomic goalie failures so processing can retry the original receipt", async () => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    const error = { message: "member write failed" };
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(capturePlayerForecastSourceRows({ supabase: { rpc } as any, rows: [goalieRow] })).rejects.toEqual(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])("uses the primary report for goalie status and deduplication (quote=%s)", async (usesQuote) => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    const rpc = vi.fn().mockResolvedValue({ data: { insertedObservations: 1, insertedConflicts: 0, observationIds: ["obs"] }, error: null });
    await capturePlayerForecastSourceRows({ supabase: { rpc } as any, rows: [{ ...goalieRow,
      raw_text: "Woll is likely to start", primary_text_source: usesQuote ? "quoted_oembed" : "ifttt_text",
      quoted_tweet_id: "456", quoted_tweet_url: "https://x.com/original/status/456",
      quoted_author_handle: "Original",
      quoted_enriched_text: "Woll is confirmed to start tonight",
    }] });
    expect(rpc).toHaveBeenNthCalledWith(1, "capture_starter_board_goalies", { p_observations: [expect.objectContaining({
      observation_status: usesQuote ? "confirmed" : "likely",
      source_account: usesQuote ? "original" : "reporter",
      source_url: usesQuote ? "https://x.com/original/status/456" : goalieRow.source_url,
      metadata: expect.objectContaining({ sourceTiming: expect.objectContaining({ sourceReference: usesQuote ? "tweet:456" : "tweet:123" }) }),
    })] });
  });
  it("keeps multiple named goalies unconfirmed in a single capture transaction", async () => {
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    const rpc = vi.fn().mockResolvedValue({ data: { insertedObservations: 2, insertedConflicts: 0 }, error: null });
    await capturePlayerForecastSourceRows({ supabase: { rpc } as any, rows: [{ ...goalieRow, goalie_2_player_id: 2, goalie_2_name: "Other goalie" }] });
    expect(rpc.mock.calls[0][1].p_observations.map((row: any) => row.observation_status)).toEqual(["unconfirmed", "unconfirmed"]);
  });
  it("does not equate an injury mention with being out, and keeps PP separate from EV", () => {
    expect(injuryObservationStatus("Player is day-to-day with an injury")).toBe("observed");
    expect(injuryObservationStatus("Player leads the team out for warmups")).toBe("observed");
    expect(injuryObservationStatus("The org is hopeful Player will play this weekend")).toBe("observed");
    expect(injuryObservationStatus("Player is ruled out tonight")).toBe("ruled_out");
    expect(injuryObservationStatus("Player is cleared to play")).toBe("confirmed");
    const rows = assignmentsFor({
      line_1_player_ids: [1], line_1_player_names: ["A"],
      injured_player_ids: [2], injured_player_names: ["B"], raw_text: "B has an injury update",
      metadata: { powerPlayUnitPlayerIds: [[1, 3]], powerPlayUnits: [["A", "C"]], powerPlayUnitLabels: ["pp2"] },
    } as unknown as ForecastLineSourceRow);
    expect(rows.filter((r) => r.player_id === 1).map((r) => [r.unit_type, r.unit_number])).toEqual([["forward_line", 1], ["power_play", 2]]);
    expect(rows.find((r) => r.player_id === 2)?.assignment_status).toBe("observed");
    expect(rows.some((r) => r.unit_type === "scratch")).toBe(false);
  });
  it("keeps explicit goalie language separate from model probabilities", () => {
    expect(goalieObservationStatus("Joseph Woll is confirmed to start tonight")).toBe("confirmed");
    expect(goalieObservationStatus("Woll is expected in goal")).toBe("projected");
    expect(goalieObservationStatus("Woll will start if healthy")).toBe("projected");
    expect(goalieObservationStatus("Woll first off, coach did not confirm anything")).not.toBe("confirmed");
    expect(goalieObservationStatus("Woll and Stolarz led the skate")).toBe("unconfirmed");
  });

  it("hashes provider payloads independently of object key order", () => {
    expect(playerForecastSourcePayloadHash({ b: 2, a: { y: 1, x: 0 } })).toBe(
      playerForecastSourcePayloadHash({ a: { x: 0, y: 1 }, b: 2 }),
    );
  });
});

describe("player forecast serving artifact", () => {
  it("creates a deterministic, checksum-verified private-shadow identity", () => {
    const unsigned = {
      modelKey: "historical-core-baseline-tournament",
      modelVersion: "development-v2",
      featureSchemaVersion: "historical-core-v2",
      trainingCutoffInclusive: "2026-01-02",
      contractVersion: "player-forecasts-research-v1",
      contractChecksum: "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574",
      promotionEligible: false,
      targets: { goals: { candidate: "position_prior" } },
      segments: { forward: { goals: { candidate: "position_prior" } } },
    };
    const offlineArtifact = {
      ...unsigned,
      artifactChecksum: playerForecastCanonicalHash(unsigned),
    };
    const first = createPlayerForecastServingArtifact(offlineArtifact);
    const second = createPlayerForecastServingArtifact(offlineArtifact);
    expect(first).toEqual(second);
    const payload = JSON.parse(first.canonicalPayload);
    expect(payload.servingChannel).toBe("private_shadow");
    expect(payload.sourceArtifactChecksum).toBe(offlineArtifact.artifactChecksum);
    expect(() => verifyPlayerForecastArtifact(first)).not.toThrow();
    expect(() => verifyPlayerForecastArtifact({ ...first, canonicalPayload: `${first.canonicalPayload} ` })).toThrow(
      "checksum mismatch",
    );
  });

  it("accepts the checksum-bound validation challenger without making it promotable", () => {
    const unsigned = {
      modelKey: "assist-decomposition-hierarchical-hits-challenger",
      modelVersion: "development-validation-v1",
      featureSchemaVersion: "historical-core-issued-vintages-v3-validation",
      trainingCutoffInclusive: "2026-01-02",
      contractVersion: "player-forecasts-research-v2-validation",
      contractChecksum: "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed",
      promotionEligible: false,
      segments: { forward: { hits: { candidate: "career_rate" } } },
      evidenceClassification: "validation_not_blind_evidence",
    };
    const artifact = createPlayerForecastServingArtifact({
      ...unsigned,
      artifactChecksum: playerForecastCanonicalHash(unsigned),
    });
    const payload = JSON.parse(artifact.canonicalPayload);
    expect(payload.contractVersion).toBe("player-forecasts-research-v2-validation");
    expect(payload.promotionEligible).toBe(false);
    expect(() => verifyPlayerForecastArtifact(artifact)).not.toThrow();
  });

  it("builds deterministic cutoff-bound validation snapshots from the service-only RPC", async () => {
    let inserted: any[] = [];
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{
          player_id: 10,
          population: "forward",
          features: { assists: { multi_season_weighted_rate: 0.5, position_prior: 0.3 } },
          missingness: { no_completed_game_history: false },
          source_manifest: [{ source: "official_nhl_boxscore_history" }],
        }],
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation(async (rows: any[]) => {
          inserted = rows;
          return { error: null };
        }),
      }),
    } as any;
    const args = {
      supabase,
      artifactPayload: {
        contractChecksum: "contract-v2",
        segments: { forward: { assists: { candidate: "multi_season_weighted_rate" } } },
      },
      featureSchemaVersion: "historical-core-issued-vintages-v3-validation",
      gameId: 20,
      teamId: 1,
      horizon: 3,
      sourceHighWatermark: "2026-11-01T10:00:00.000Z",
      seasonId: 20262027,
      gameStartTime: "2026-11-04T23:00:00.000Z",
      opponentTeamId: 2,
      homeIndicator: 1,
      restDays: 1,
    };
    await ensureValidationFeatureSnapshots(args);
    const first = inserted[0];
    await ensureValidationFeatureSnapshots(args);
    expect(supabase.rpc).toHaveBeenCalledWith("build_player_forecast_runtime_features", {
      p_team_id: 1,
      p_opponent_team_id: 2,
      p_season_id: 20262027,
      p_cutoff_at: "2026-11-01T10:00:00.000Z",
    });
    expect(inserted[0].id).toBe(first.id);
    expect(inserted[0].content_hash).toBe(first.content_hash);
    expect(inserted[0].features.assists.multi_season_weighted_rate).toBe(0.5);
    expect(inserted[0].features.assists.home_indicator).toBe(1);
    expect(inserted[0].fallback_flags).toEqual(["validation_only"]);
  });
});

describe("forecast settlement scoring", () => {
  it("scores count forecasts and preserves baseline-relative accountability", () => {
    expect(scoreForecast({
      actual: 4,
      pointEstimate: 3,
      probability: null,
      conditioning: "conditional_playing",
      quantiles: { p10: 1, p90: 5 },
      baselinePointEstimate: 2,
    })).toEqual({
      metrics: { actual: 4, forecast: 3, absoluteError: 1, squaredError: 1, interval80Covered: true },
      baselineMetrics: { forecast: 2, absoluteError: 2, squaredError: 4 },
      compositeSkillScore: 75,
    });
  });

  it("uses clipped probabilities for log loss and parses time on ice", () => {
    const score = scoreForecast({
      actual: 1,
      pointEstimate: null,
      probability: 0.8,
      conditioning: "playing_probability",
    });
    expect(score?.metrics.brier).toBeCloseTo(0.04);
    expect(score?.metrics.logLoss).toBeCloseTo(-Math.log(0.8));
    expect(parseTimeOnIceSeconds("18:32")).toBe(1112);
    expect(parseTimeOnIceSeconds("invalid")).toBeNull();
    expect(parseTimeOnIceSeconds("18:60")).toBeNull();
    expect(parseTimeOnIceSeconds("18:")).toBeNull();
    expect(scoreForecast({ actual: 1, pointEstimate: null, probability: null, conditioning: "conditional_playing", quantiles: { p10: null, p90: null } })).toBeNull();
  });

  it("settles supported goalie components and ratios from observed game totals", () => {
    const goalie = { saveShotsAgainst: "28/30", goalsAgainst: 2, toi: "60:00" };
    const output = (target_key: string, conditioning = "conditional_playing") => ({ population: "goalie", target_key, conditioning }) as any;
    expect(actualForOutput(output("saves"), undefined, goalie)?.value).toBe(28);
    expect(actualForOutput(output("shots_against"), undefined, goalie)?.value).toBe(30);
    expect(actualForOutput(output("goals_against"), undefined, goalie)?.value).toBe(2);
    expect(actualForOutput(output("time_on_ice_seconds"), undefined, goalie)?.value).toBe(3600);
    expect(actualForOutput(output("save_percentage"), undefined, goalie)?.value).toBeCloseTo(28 / 30);
    expect(actualForOutput(output("goals_against_average"), undefined, goalie)?.value).toBe(2);
    expect(actualForOutput(output("plays", "playing_probability"), undefined, goalie)?.value).toBe(1);
    expect(actualForOutput(output("plays", "playing_probability"), undefined, undefined)).toBeNull();
    expect(actualForOutput(output("plays", "playing_probability"), undefined, { toi: "00:00" })?.value).toBe(0);
    expect(actualForOutput(output("saves", "unconditional"), undefined, { toi: "00:00", saveShotsAgainst: "0/0" })?.value).toBe(0);
  });

  it("keeps missing goalie data and unverified start outcomes unavailable", () => {
    const output = (target_key: string, conditioning = "conditional_playing") => ({ population: "goalie", target_key, conditioning }) as any;
    expect(actualForOutput(output("saves"), undefined, { saveShotsAgainst: null, toi: "60:00" })).toBeNull();
    expect(actualForOutput(output("save_percentage"), undefined, { saveShotsAgainst: "0/0", toi: "60:00" })).toBeNull();
    expect(actualForOutput(output("saves"), undefined, { saveShotsAgainst: "31/30", toi: "60:00" })).toBeNull();
    expect(actualForOutput(output("goals_against"), undefined, { goalsAgainst: null, toi: "60:00" })).toBeNull();
    expect(actualForOutput(output("time_on_ice_seconds"), undefined, { toi: "60:60" })).toBeNull();
    expect(actualForOutput(output("plays", "playing_probability"), undefined, { toi: null })).toBeNull();
    expect(actualForOutput(output("starts", "start_probability"), undefined, { saveShotsAgainst: "28/30", goalsAgainst: 2, toi: "60:00" })).toBeNull();
    expect(actualForOutput(output("saves", "conditional_start"), undefined, { saveShotsAgainst: "28/30", toi: "60:00" })).toBeNull();
    const absent = { game_id: 100, team_id: 10, player_id: 99, population: "goalie",
      target_key: "starts", conditioning: "start_probability" } as any;
    const boxscore = { payload: { id: 100, season: 20262027, gameState: "FINAL",
      homeTeam: { id: 10 }, awayTeam: { id: 20 }, playerByGameStats: {
        homeTeam: { goalies: [{ playerId: 7, starter: true }] },
        awayTeam: { goalies: [{ playerId: 8, starter: true }] },
      } }, payloadHash: "a".repeat(64), fetchedAt: "2026-10-06T12:00:00Z",
      seasonId: 20262027 };
    expect(actualForOutput(absent, undefined, undefined, boxscore)).toBeNull();
    expect(actualForOutput({ ...absent, target_key: "wins", conditioning: "unconditional" },
      undefined, undefined, boxscore)).toBeNull();
  });

  it("settles an absent normalized skater only from an explicit zero-TOI final boxscore row", () => {
    const output = (target_key: string, conditioning: string) => ({ id: "f", game_id: 100,
      team_id: 10, player_id: 77, population: "forward", target_key, conditioning }) as any;
    const zero = { playerId: 77, toi: "00:00", goals: 0, assists: 0, shots: 0,
      blockedShots: 0, hits: 0, pim: 0 };
    const payload = { id: 100, season: 20262027, gameState: "FINAL",
      homeTeam: { id: 10 }, awayTeam: { id: 20 }, playerByGameStats: {
        homeTeam: { forwards: [zero], defense: [], goalies: [{ playerId: 78 }] },
        awayTeam: { forwards: [{ playerId: 88 }], defense: [], goalies: [{ playerId: 89 }] },
      } };
    const source = { payload, payloadHash: "a".repeat(64), fetchedAt: "2026-10-06T12:00:00Z",
      seasonId: 20262027 };
    expect(actualForOutput(output("plays", "playing_probability"), undefined, undefined, source))
      .toMatchObject({ value: 0, payload: { sourceTable: "nhl_api_game_payloads_raw",
        payloadHash: "a".repeat(64) } });
    expect(actualForOutput(output("goals", "unconditional"), undefined, undefined, source)?.value).toBe(0);
    expect(actualForOutput(output("shots_on_goal", "unconditional"), undefined, undefined, source)?.value).toBe(0);
    expect(actualForOutput(output("time_on_ice_seconds", "unconditional"), undefined, undefined, source)?.value).toBe(0);
    expect(actualForOutput(output("goals", "conditional_playing"), undefined, undefined, source)).toBeNull();
    expect(actualForOutput(output("plays", "playing_probability"), undefined, undefined,
      { ...source, payload: { ...payload, playerByGameStats: { ...payload.playerByGameStats,
        homeTeam: { ...payload.playerByGameStats.homeTeam, forwards: [] } } } })).toBeNull();
    expect(actualForOutput(output("plays", "playing_probability"), undefined, undefined,
      { ...source, payload: { ...payload, gameState: "LIVE" } })).toBeNull();
    expect(actualForOutput(output("goals", "unconditional"), undefined, undefined,
      { ...source, payload: { ...payload, playerByGameStats: { ...payload.playerByGameStats,
        homeTeam: { ...payload.playerByGameStats.homeTeam,
          forwards: [{ ...zero, assists: 1 }] } } } })).toBeNull();
    expect(actualForOutput(output("goals", "unconditional"), undefined, undefined,
      { ...source, payload: { ...payload, homeTeam: { id: 30 } } })).toBeNull();
  });

  it("appends raw-backed skater zeros while leaving an absent player unresolved", async () => {
    const zero = { playerId: 77, toi: "00:00", goals: 0, assists: 0, shots: 0,
      blockedShots: 0, hits: 0, pim: 0 };
    const outputs = [
      { id: "plays", game_id: 100, team_id: 10, player_id: 77, population: "forward",
        target_key: "plays", conditioning: "playing_probability", point_estimate: null, probability: 0.5,
        distribution: null, quantiles: null },
      { id: "goals", game_id: 100, team_id: 10, player_id: 77, population: "forward",
        target_key: "goals", conditioning: "unconditional", point_estimate: 1, probability: null,
        distribution: null, quantiles: null },
      { id: "missing", game_id: 100, team_id: 10, player_id: 99, population: "forward",
        target_key: "plays", conditioning: "playing_probability", point_estimate: null, probability: 0.5,
        distribution: null, quantiles: null },
    ];
    const tables: Record<string, any[]> = {
      games: [{ id: 100, seasonId: 20262027, startTime: "2026-10-05T20:00:00Z",
        date: "2026-10-05", homeTeamId: 10, awayTeamId: 20 }],
      player_forecast_outputs: outputs, skatersGameStats: [], goaliesGameStats: [],
      nhl_api_game_payloads_raw: [{ id: "raw-1", game_id: 100, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-10-06T08:00:00Z",
        payload: { id: 100, season: 20262027, gameState: "FINAL",
          homeTeam: { id: 10 }, awayTeam: { id: 20 }, playerByGameStats: {
            homeTeam: { forwards: [zero], defense: [], goalies: [{ playerId: 78 }] },
            awayTeam: { forwards: [{ playerId: 88 }], defense: [], goalies: [{ playerId: 89 }] },
          } } }],
      player_forecast_outcome_revisions: [], player_forecast_evaluation_revisions: [],
    };
    const written: Array<{ table: string; row: Record<string, unknown> }> = [];
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) query[method] = () => query;
      query.range = async (from: number, to: number) => ({ data: tables[table].slice(from, to + 1),
        count: tables[table].length, error: null });
      query.then = (resolve: (value: unknown) => void) => resolve({ data: tables[table], error: null });
      query.upsert = (row: Record<string, unknown>) => ({ select: () => ({ maybeSingle: async () => {
        written.push({ table, row });
        return { data: { ...row, id: `${table}-${written.length}` }, error: null };
      } }) });
      return query;
    } };
    const result = await settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T12:00:00Z") });
    expect(result).toMatchObject({ eligibleOutputs: 3, outcomesAppended: 2,
      evaluationsAppended: 2, unsupportedOutputs: 1 });
    expect(written.filter((entry) => entry.table === "player_forecast_outcome_revisions")
      .map(({ row }) => [row.player_id, row.target_key, row.outcome_value, row.source])).toEqual([
        [77, "plays", 0, "nhl_raw_boxscore"], [77, "goals", 0, "nhl_raw_boxscore"],
      ]);
    tables.player_forecast_outcome_revisions = written
      .filter((entry) => entry.table === "player_forecast_outcome_revisions")
      .map(({ row }, index) => ({ ...row, id: `old-${index}`, available_at: "2026-10-06T12:00:00Z" }));
    tables.nhl_api_game_payloads_raw[0] = { ...tables.nhl_api_game_payloads_raw[0],
      payload_hash: "b".repeat(64), fetched_at: "2026-10-06T13:00:00Z" };
    written.length = 0;
    const corrected = await settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T14:00:00Z") });
    expect(corrected.outcomesAppended).toBe(2);
    expect(written.filter((entry) => entry.table === "player_forecast_outcome_revisions")
      .map(({ row }) => row.supersedes_id)).toEqual(["old-0", "old-1"]);
  });

  it("rejects an over-cap game scope before writing outcomes", async () => {
    let writes = 0;
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) query[method] = () => query;
      query.range = async (from: number, to: number) => ({ data: table === "games"
        ? Array.from({ length: 201 }, (_, index) => ({ id: index + 1 })).slice(from, to + 1)
        : [], count: table === "games" ? 201 : 0, error: null });
      query.upsert = () => { writes += 1; throw new Error("unexpected write"); };
      return query;
    } };
    await expect(settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T12:00:00Z") })).rejects.toThrow("Settlement games exceeded 200 rows.");
    expect(writes).toBe(0);
  });

  it("continues after a backend-shortened page until the exact count is read", async () => {
    const outputOffsets: number[] = [];
    const outputs = Array.from({ length: 3 }, (_, index) => ({ id: `f-${index}`,
      game_id: 100, team_id: 10, player_id: index + 1, population: "forward",
      target_key: "goals", conditioning: "unconditional", point_estimate: 1,
      probability: null, distribution: null, quantiles: null }));
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) query[method] = () => query;
      query.range = async (from: number, _to: number) => {
        if (table === "games") return { data: [{ id: 100, seasonId: 20262027,
          startTime: "2026-10-05T20:00:00Z", homeTeamId: 10, awayTeamId: 20 }], count: 1, error: null };
        if (table === "player_forecast_outputs") {
          outputOffsets.push(from);
          return { data: outputs.slice(from, from + 1), count: outputs.length, error: null };
        }
        return { data: [], count: 0, error: null };
      };
      return query;
    } };
    const result = await settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T12:00:00Z") });
    expect(outputOffsets).toEqual([0, 1, 2]);
    expect(result).toMatchObject({ eligibleOutputs: 3, unsupportedOutputs: 3 });
  });

  it("batches game IDs and rejects a failed later output page before writing", async () => {
    const games = Array.from({ length: 51 }, (_, index) => ({ id: index + 1,
      seasonId: 20262027, startTime: "2026-10-05T20:00:00Z" }));
    const batches: number[][] = [];
    let writes = 0;
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "eq", "order"]) query[method] = () => query;
      query.in = (_column: string, ids: number[]) => { if (table === "player_forecast_outputs") batches.push(ids); return query; };
      query.range = async (from: number, to: number) => {
        if (table === "games") return { data: games.slice(from, to + 1), count: games.length, error: null };
        if (table === "player_forecast_outputs" && from === 0) return { data: Array.from({ length: 500 }, (_, index) => ({ id: `f-${index}` })), count: 501, error: null };
        return { data: null, count: null, error: new Error("later page failed") };
      };
      query.upsert = () => { writes += 1; throw new Error("unexpected write"); };
      return query;
    } };
    await expect(settlePlayerForecasts({ supabase: db as never,
      now: new Date("2026-10-06T12:00:00Z") })).rejects.toThrow("Settlement outputs read failed");
    expect(batches).toEqual(Array(2).fill(games.slice(0, 50).map((game) => game.id)));
    expect(writes).toBe(0);

    const completeDb = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "eq", "order"]) query[method] = () => query;
      query.in = (_column: string, ids: number[]) => { if (table === "player_forecast_outputs") batches.push(ids); return query; };
      query.range = async (from: number, to: number) => ({ data: table === "games"
        ? games.slice(from, to + 1) : [], count: table === "games" ? games.length : 0, error: null });
      return query;
    } };
    await settlePlayerForecasts({ supabase: completeDb as never,
      now: new Date("2026-10-06T12:00:00Z") });
    expect(batches.slice(2)).toEqual([games.slice(0, 50).map((game) => game.id), [51]]);
  });

  it.each([false, true])("resolves a concurrent settlement winner instead of an older outcome (correction=%s)", async (correction) => {
    const old = { id: "old-outcome", game_id: 100, player_id: 77, target_key: "goals",
      target_version: "research-contract-v1", outcome_value: 1, finality: "provisional",
      available_at: "2026-10-06T09:00:00Z", source_revision_key: "old-source" };
    const tables: Record<string, any[]> = {
      games: [{ id: 100, seasonId: 20262027, startTime: "2026-10-05T20:00:00Z", homeTeamId: 10, awayTeamId: 20 }],
      player_forecast_outputs: [{ id: "f-1", game_id: 100, team_id: 10, player_id: 77,
        population: "forward", target_key: "goals", conditioning: "conditional_playing",
        point_estimate: 1, probability: null, distribution: null, quantiles: null }],
      nhl_api_game_payloads_raw: [{ id: "raw-1", game_id: 100, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-10-06T08:00:00Z",
        payload: { id: 100, season: 20262027, gameState: "FINAL", homeTeam: { id: 10 }, awayTeam: { id: 20 },
          playerByGameStats: { homeTeam: { forwards: [{ playerId: 77, goals: 2, toi: "12:00" }], defense: [], goalies: [{ playerId: 78 }] },
            awayTeam: { forwards: [{ playerId: 88 }], defense: [], goalies: [{ playerId: 89 }] } } } }],
      player_forecast_outcome_revisions: correction ? [old] : [],
    };
    let winner: any;
    let invalidWinner = false;
    const lookups: Record<string, unknown>[] = [];
    const evaluations: any[] = [];
    const db = { from(table: string) {
      const filters: Record<string, unknown> = {};
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "order"]) query[method] = () => query;
      query.eq = (column: string, value: unknown) => { filters[column] = value; return query; };
      query.range = async (from: number, to: number) => {
        if (table === "player_forecast_outcome_revisions") expect(filters.target_version).toBe("research-contract-v1");
        return { data: tables[table].slice(from, to + 1), count: tables[table].length, error: null };
      };
      query.maybeSingle = async () => {
        lookups.push(filters);
        return { data: invalidWinner ? old : winner, error: null };
      };
      query.upsert = (row: any) => ({ select: () => ({ maybeSingle: async () => {
        if (table === "player_forecast_outcome_revisions") {
          winner = { ...row, id: "concurrent-winner" };
          return { data: null, error: null };
        }
        evaluations.push(row);
        return { data: { id: "evaluation" }, error: null };
      } }) });
      return query;
    } };
    const scope = { supabase: db as never, now: new Date("2026-10-06T12:00:00Z") };
    await expect(settlePlayerForecasts(scope)).resolves.toMatchObject({ outcomesAppended: 0, evaluationsAppended: 1 });
    expect(lookups[0]).toEqual({ game_id: 100, player_id: 77, target_key: "goals",
      target_version: "research-contract-v1", source_revision_key: winner.source_revision_key });
    expect(winner).toMatchObject({ outcome_value: 2, finality: correction ? "corrected" : "provisional",
      supersedes_id: correction ? "old-outcome" : null });
    expect(evaluations[0]).toMatchObject({ outcome_revision_id: "concurrent-winner",
      settlement_status: winner.finality });
    invalidWinner = true;
    await expect(settlePlayerForecasts(scope)).rejects.toThrow("could not be resolved consistently");
    expect(evaluations).toHaveLength(1);
  });

  it("reuses a stored outcome after evaluation failure and retains final-boxscore provenance", async () => {
    const tables: Record<string, any[]> = {
      games: [{ id: 100, seasonId: 20262027, startTime: "2026-10-05T20:00:00Z",
        homeTeamId: 10, awayTeamId: 20 }],
      player_forecast_outputs: [
        { id: "f-1", game_id: 100, team_id: 10, player_id: 77,
          population: "forward", target_key: "goals", conditioning: "conditional_playing",
          point_estimate: 1, probability: null, distribution: null, quantiles: null },
        { id: "f-2", game_id: 100, team_id: 10, player_id: 77,
          population: "forward", target_key: "shots_on_goal", conditioning: "conditional_playing",
          point_estimate: 2, probability: null, distribution: null, quantiles: null },
        { id: "f-3", game_id: 100, team_id: 10, player_id: 78,
          population: "goalie", target_key: "saves", conditioning: "conditional_playing",
          point_estimate: 27, probability: null, distribution: null, quantiles: null },
        { id: "f-4", game_id: 100, team_id: 10, player_id: 78,
          population: "goalie", target_key: "save_percentage", conditioning: "conditional_playing",
          point_estimate: 0.9, probability: null, distribution: null, quantiles: null },
      ],
      skatersGameStats: [{ gameId: 100, playerId: 77, goals: 99, toi: "12:00" }],
      goaliesGameStats: [],
      nhl_api_game_payloads_raw: [{ id: "raw-1", game_id: 100, season_id: 20262027,
        payload_hash: "c".repeat(64), fetched_at: "2026-10-06T08:00:00Z",
        payload: { id: 100, season: 20262027, gameState: "FINAL",
          homeTeam: { id: 10 }, awayTeam: { id: 20 }, playerByGameStats: {
            homeTeam: { forwards: [{ playerId: 77, goals: 2, assists: 0, shots: 3,
              blockedShots: 0, hits: 1, pim: 0, toi: "12:00" }], defense: [], goalies: [
              { playerId: 78, saveShotsAgainst: "28/30", goalsAgainst: 2, toi: "60:00" }] },
            awayTeam: { forwards: [{ playerId: 88 }], defense: [], goalies: [{ playerId: 89 }] },
          } } }],
      player_forecast_outcome_revisions: [], player_forecast_evaluation_revisions: [],
    };
    let outcomeUpserts = 0;
    let failEvaluation = true;
    const db = { from(table: string) {
      const query: any = {};
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) query[method] = () => query;
      query.range = async (from: number, to: number) => ({ data: tables[table].slice(from, to + 1),
        count: tables[table].length, error: null });
      query.upsert = (row: Record<string, unknown>) => ({ select: () => ({ maybeSingle: async () => {
        if (table === "player_forecast_evaluation_revisions" && failEvaluation)
          return { data: null, error: new Error("evaluation failed") };
        if (table === "player_forecast_outcome_revisions") outcomeUpserts += 1;
        const stored = { ...row, id: `${table}-${tables[table].length + 1}` };
        tables[table].push(stored);
        return { data: stored, error: null };
      } }) });
      return query;
    } };
    const scope = { supabase: db as never, now: new Date("2026-10-06T12:00:00Z") };
    await expect(settlePlayerForecasts(scope)).rejects.toThrow("evaluation failed");
    expect(outcomeUpserts).toBe(1);
    expect(tables.player_forecast_outcome_revisions[0]).toMatchObject({ outcome_value: 2,
      source: "nhl_raw_boxscore", outcome_payload: { sourceTable: "nhl_api_game_payloads_raw",
        gameId: 100, seasonId: 20262027, gameState: "FINAL",
        payloadHash: "c".repeat(64), sourceFetchedAt: "2026-10-06T08:00:00Z" } });
    failEvaluation = false;
    await expect(settlePlayerForecasts(scope)).resolves.toMatchObject({ outcomesAppended: 3,
      evaluationsAppended: 4 });
    expect(outcomeUpserts).toBe(4);
    expect(tables.player_forecast_outcome_revisions.map((row) => row.outcome_value))
      .toEqual([2, 3, 28, 28 / 30]);
  });
});

describe("rest-of-season forecast aggregation", () => {
  const components = [
    { gameId: 1, scheduledStartAt: "2026-11-01T23:00:00Z", mean: 1, variance: 1.5, playsProbability: 0.5 },
    { gameId: 2, scheduledStartAt: "2026-11-03T23:00:00Z", mean: 2, variance: 2.5, playsProbability: 0.75, fallbackFlags: ["tail_h10_calibration"] },
  ];

  it("keeps conditional and unconditional totals separate", () => {
    const conditional = aggregatePlayerForecastRestOfSeason({
      components,
      conditioning: "conditional_playing",
      seasonToDateActual: 10,
      scheduleRevisionHash: "schedule-v1",
    });
    const unconditional = aggregatePlayerForecastRestOfSeason({
      components,
      conditioning: "unconditional",
      seasonToDateActual: 10,
      scheduleRevisionHash: "schedule-v1",
    });
    expect(conditional.remainingMean).toBe(3);
    expect(unconditional.remainingMean).toBe(2);
    expect(conditional.fullSeasonMean).toBe(13);
    expect(unconditional.fallbackFlags).toEqual(["tail_h10_calibration"]);
  });

  it("fails closed when unconditional availability is missing", () => {
    expect(() => aggregatePlayerForecastRestOfSeason({
      components: [{ gameId: 1, scheduledStartAt: "2026-11-01T23:00:00Z", mean: 1, variance: 1 }],
      conditioning: "unconditional",
      scheduleRevisionHash: "schedule-v1",
    })).toThrow("plays probability");
  });
});

describe("forecast review tokens", () => {
  afterEach(() => delete process.env.PLAYER_FORECAST_REVIEW_TOKEN_SECRET);

  it("binds a signed token to its conflict and expiry", () => {
    process.env.PLAYER_FORECAST_REVIEW_TOKEN_SECRET = "forecast-review-test";
    const token = createPlayerForecastReviewToken({ conflictId: "conflict-1", nowMs: 1_000, ttlSeconds: 10 });
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-1", nowMs: 5_000 })).toBe(true);
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-2", nowMs: 5_000 })).toBe(false);
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-1", nowMs: 12_000 })).toBe(false);
  });
});

describe("player forecast runtime safety", () => {
  it("blocks non-local Supabase targets outside production", () => {
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    })).toMatchObject({ allowed: false, databaseTarget: "hosted", localRequired: true });
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    })).toMatchObject({ allowed: true, databaseTarget: "local", localRequired: true });
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    })).toMatchObject({ allowed: true, databaseTarget: "hosted", localRequired: false });
  });

  it("normalizes PostgREST errors without rendering object Object", () => {
    const message = playerForecastErrorMessage({
      code: "42P01",
      message: 'relation "public.player_forecast_outputs" does not exist',
    });
    expect(message).toContain("database schema is unavailable");
    expect(message).toContain("42P01");
    expect(message).not.toContain("[object Object]");
  });

  it("detects a missing table with a non-HEAD probe", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { code: "42P01" } }),
        }),
      }),
    } as any;
    await expect(probePlayerForecastTable(supabase, "player_forecast_outputs"))
      .resolves.toEqual({
        table: "player_forecast_outputs",
        present: false,
        errorCode: "42P01",
      });
  });
});

describe("player forecast migration", () => {
  it("keeps tables service-only, immutable, and schedules dry-run orchestration", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "../supabase/migrations/20260802163747_add_player_forecast_foundation.sql"),
      "utf8",
    );
    expect(migration).toContain("create table public.player_forecast_goalie_start_observations");
    expect(migration).toContain("create table public.player_forecast_source_observations");
    expect(migration).toContain("create table public.player_forecast_lineup_assignments");
    expect(migration).toContain("create table public.player_forecast_outputs");
    expect(migration).toContain("alter table public.%I force row level security");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role;");
    expect(migration).toContain("PLAYER_FORECAST_IMMUTABLE_RECORD");
    expect(migration).toContain("create trigger player_forecast_goalie_observation_enqueue");
    expect(migration).toContain("create trigger player_forecast_lineup_observation_enqueue");
    expect(migration).toContain("normalized_observation_trigger");
    expect(migration).toContain("scheduled_game.\"startTime\" <= new.available_at");
    expect(migration).toContain("player-forecasts-queue-drain");
    expect(migration).toContain("jobs/drain?dryRun=true");
    expect(migration).not.toMatch(/grant\s+select[^;]+to\s+(anon|authenticated)/i);
  });

  it("keeps the season platform service-only and activation-gates Supabase Cron", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "../supabase/migrations/20260813001304_player_forecast_season_v3.sql"),
      "utf8",
    );
    expect(migration).toContain("create table public.player_forecast_season_game_outputs");
    expect(migration).toContain("create table public.player_forecast_season_outcome_revisions");
    expect(migration).toContain("create table public.player_forecast_season_evaluation_revisions");
    expect(migration).toContain("alter table public.%I force row level security");
    expect(migration).toContain("create trigger player_forecast_season_override_enqueue");
    expect(migration).toContain("snapshot.processing_status = 'trusted' and snapshot.forecast_relevant");
    expect(migration).toContain("perform cron.schedule(");
    expect(migration).toContain("Intentionally not invoked by this migration");
    expect(migration).not.toMatch(/insert\s+into\s+cron\.job/i);
    expect(migration).not.toMatch(/grant\s+select[^;]+to\s+(anon|authenticated)/i);
  });

  it("resolves season identities atomically without exposing the resolver to clients", () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "../supabase/migrations/20260813144701_player_forecast_season_identity_resolution.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "create or replace function public.resolve_player_forecast_season_identity",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).not.toMatch(
      /where superseding\.supersedes_id = review\.id\s*\)\s*for update/i,
    );
    expect(migration).toContain("from public.users editor_profile");
    expect(migration).not.toContain("from auth.users");
    expect(migration).toContain("PLAYER_FORECAST_SEASON_FHFH_IDENTITY_CONFLICT");
    expect(migration).toContain("season_editor_official_nhl_id");
    expect(migration).toContain("created_verified_identity");
    expect(migration).toContain("mapped_existing_identity");
    expect(migration).toContain("perform public.enqueue_player_forecast_season_job");
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
    expect(migration).toContain("to service_role;");
    expect(migration).not.toMatch(
      /grant\s+execute[^;]+to\s+(anon|authenticated)/i,
    );
  });
});

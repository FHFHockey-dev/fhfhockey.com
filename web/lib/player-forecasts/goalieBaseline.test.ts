// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildGoalieBaselineRates, buildGoalieContributionBundle,
  dryRunCapturedGoalieBundle } from "./goalieBaselineRates";
import { captureCurrentGoalieBaselineInputs, persistCapturedGoalieBaselineInputs } from "./goalieBaselineInputCapture";
import { BASELINE_CANDIDATE_POLICY, baselineDefinitionHash, baselineProjectionSchemas } from "./baselinePolicy";
import { baselineProjectionFromRow, baselineProjectionContentHash, baselineHistoricalSources,
  baselineHistoricalSourceLimitations, baselineProjectionSelectionReceipt,
  baselineProjectionSelectionLimitations } from "./baselineSourceLineage";
import { readStableCurrentInputs } from "./baselineInputCapture";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { resolvePlanningContributions } from "./planningContributions";
import type { ContributionSource } from "./contributions";
import type { GameForecast, PlanningSnapshot } from "../rosterScheduleOptimizer/planningTypes";

const cutoffAt = "2026-09-28T12:00:01Z";
const projection = { sourceId: "cullen_goalies", sourceRowId: "c-1", seasonId: 20262027,
  availableAt: cutoffAt, projectedAppearances: 40, projectedStarts: 30,
  totals: { SAVES_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, SHOTS_AGAINST_GOALIE: 1100,
    WINS_GOALIE: 15, SHUTOUTS_GOALIE: 3 } };

function goalieCaptureDb(rows: Record<string, any[]>,
  calls: Array<{ table: string; method: string; args: unknown[] }> = [], errors: Record<string, { code: string }> = {}) {
  for (const history of rows.goaliesGameStats ?? []) {
    const game = history.games;
    if (!game) continue;
    Object.assign(game, { startTime: game.startTime ?? `${game.date}T01:00:00Z`,
      homeTeamId: game.homeTeamId ?? 4, awayTeamId: game.awayTeamId ?? 5 });
    const rawRows = rows.nhl_api_game_payloads_raw ??= [];
    if (!rawRows.some(row => Number(row.game_id) === Number(history.gameId))) rawRows.push({
      id: Number(history.gameId) * 100 + 1, game_id: history.gameId, season_id: game.seasonId,
      payload_hash: "a".repeat(64), fetched_at: `${game.date}T10:00:00Z`, payload: {} });
    const match = /^(\d+)\/(\d+)$/.exec(String(history.saveShotsAgainst));
    for (const [index, raw] of rawRows.filter(row => Number(row.game_id) === Number(history.gameId)).entries()) {
      raw.id ??= Number(history.gameId) * 100 + index + 1;
      raw.payload = { id: history.gameId, season: game.seasonId, gameDate: game.date, gameType: 2,
        gameState: "FINAL", homeTeam: { id: game.homeTeamId }, awayTeam: { id: game.awayTeamId },
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 1001 }], defense: [], goalies: [{
          playerId: history.playerId, toi: history.toi, saveShotsAgainst: history.saveShotsAgainst,
          saves: match ? Number(match[1]) : undefined, shotsAgainst: match ? Number(match[2]) : undefined,
          goalsAgainst: history.goalsAgainst }] },
        awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } }, ...raw.payload };
    }
  }
  return { from(table: string) {
    const query: Record<string, (...args: any[]) => any> = {};
    const filters: Array<[string, unknown[]]> = [];
    for (const method of ["select", "in", "eq", "lte", "order", "limit"]) {
      query[method] = (...args) => { calls.push({ table, method, args });
        if (method === "in" && (table === "nhl_api_game_payloads_raw" || table === "games"
          || table === "nhl_api_game_normalization_status"
          || args[0] === "upload_batch_id")) filters.push([args[0], args[1]]);
        return query; };
    }
    const selected = () => (rows[table] ?? []).filter(row => filters.every(([column, values]) => values.includes(row[column])));
    query.range = (from: number, to: number) => Promise.resolve({ data: selected().slice(from, to + 1), count: selected().length, error: errors[table] ?? null });
    query.then = (resolve: (value: unknown) => void) => resolve({ data: selected(), count: selected().length, error: errors[table] ?? null });
    return query;
  } };
}

describe("goalie baseline denominators", () => {
  it("retains per-target source exclusions and never supplies missing priors or legacy starts", () => {
    const input = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection], appearances: [] };
    const result = buildGoalieBaselineRates(input);
    expect(result.definitionHash).toBe(baselineDefinitionHash("goalie", 20262027));
    expect(result.targets.find(row => row.targetKey === "SAVES_GOALIE")?.missingSourceIds)
      .toEqual(["dtz_goalies", "5v5_goalies"]);
    expect(result.missingTargetKeys).toContain("GOALIE_MINUTES");
    const legacy = buildGoalieBaselineRates({ ...input, seasonId: 20252026,
      projections: [{ ...projection, sourceId: "dtz_goalies", seasonId: 20252026 }] });
    expect(legacy.targets.find(row => row.targetKey === "SAVES_GOALIE")?.rate).toBe(25);
    expect(legacy.targets.some(row => row.basis === "per_start")).toBe(false);
    const wrongTable = buildGoalieBaselineRates({ ...input, projections: [{ ...projection,
      sourceTable: "PROJECTIONS_20252026_CULLEN_GOALIES" }] });
    expect(wrongTable.targets).toEqual([]);
    const future = buildGoalieBaselineRates({ ...input, seasonId: 20272028 });
    expect(future.targets).toEqual([]);
    expect(future.missingSourceIds).toEqual([...BASELINE_CANDIDATE_POLICY.sourceIds.goalie]);
    expect(future.definitionHash).not.toBe(result.definitionHash);
  });

  it("keeps per-appearance volumes separate from per-start outcomes", () => {
    const snapshot = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection], appearances: [{
        gameId: 2, seasonId: 20252026, gameDate: "2026-03-01", availableAt: cutoffAt,
        teamId: 1, regularSeason: true, saves: 20, goalsAgainst: 2, shotsAgainst: 22,
        toiMinutes: 60,
      }, { gameId: 3, seasonId: 20262027, gameDate: "2026-09-27", availableAt: cutoffAt,
        teamId: 1, regularSeason: true, saves: 10, goalsAgainst: 1, shotsAgainst: 11,
        toiMinutes: 30 }] });
    const saves = snapshot.targets.find((row) => row.targetKey === "SAVES_GOALIE")!;
    const wins = snapshot.targets.find((row) => row.targetKey === "WINS_GOALIE")!;
    expect(saves.basis).toBe("per_appearance");
    expect(saves.rate).toBeCloseTo((20 * (0.6 * 25 + 0.4 * 20) + 10) / 21);
    expect(wins.basis).toBe("per_start");
    expect(wins.rate).toBe(0.5);
    expect(wins.previousSeasonRate).toBeNull();
    expect(wins.recentGameIds).toEqual([]);
    expect(snapshot.targets.find((row) => row.targetKey === "GOALIE_MINUTES")?.rate)
      .toBeCloseTo((20 * 60 + 30) / 21);
    const noStarts = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [{ ...projection, projectedStarts: null }], appearances: [] });
    expect(noStarts.targets.some((row) => row.basis === "per_start")).toBe(false);
  });

  it("uses a final same-day appearance only when its boxscore predates the cutoff", () => {
    const appearance = { gameId: 30, seasonId: 20262027, gameDate: "2026-09-28",
      availableAt: cutoffAt, teamId: 1, regularSeason: true, saves: 12,
      goalsAgainst: 1, shotsAgainst: 13, toiMinutes: 42 };
    const input = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [projection] };
    expect(buildGoalieBaselineRates({ ...input, appearances: [appearance] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([]);
    const final = { ...appearance, finalBoxscore: { payloadHash: "a".repeat(64),
      fetchedAt: "2026-09-28T11:00:00Z" } };
    expect(buildGoalieBaselineRates({ ...input, appearances: [final] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([30]);
    expect(buildGoalieBaselineRates({ ...input, appearances: [{ ...final,
      finalBoxscore: { ...final.finalBoxscore, fetchedAt: "2026-09-28T13:00:00Z" } }] }).targets
      .find((row) => row.targetKey === "SAVES_GOALIE")?.recentGameIds).toEqual([]);
  });

  it("builds only unreleased dry-run sources with compatible bases", async () => {
    const databaseMustNotRun = new Proxy({}, { get() { throw new Error("database accessed"); } });
    const historicalSources = baselineHistoricalSources([], [], [],
      { nhlIds: [77], seasonId: 20262027, upperDate: cutoffAt.slice(0, 10) }, 77);
    const schemas = baselineProjectionSchemas("goalie", 20262027);
    const projectionRow = { player_id: 77, upload_batch_id: "c-1", Games_Played: 40, Games_Started_Goalie: 30,
      Saves_Goalie: 1000, Goals_Against_Goalie: 100, Wins_Goalie: 15, Shutouts_Goalie: 3 };
    const projectionSelection = baselineProjectionSelectionReceipt(schemas.map((schema, index) => ({
      schema, rows: index ? [] : [projectionRow], status: "available" })), 77, 20262027);
    const player = { playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "roster-a",
      definitionHash: baselineDefinitionHash("goalie", 20262027), projectionSources: schemas.map((schema, index) => ({
        sourceId: schema.id, tableName: schema.tableName, status: "available" as const, rowCount: index ? 0 : 1 })),
      historicalSources, projectionSelection, limitations: [...baselineHistoricalSourceLimitations(historicalSources),
        ...baselineProjectionSelectionLimitations(projectionSelection)],
      projections: [baselineProjectionFromRow(schemas[0], projectionRow, 20262027, cutoffAt, true)!], appearances: [] };
    const sourceWatermark = playerForecastSourcePayloadHash({ basis: "captured_current",
      capturedAt: cutoffAt, ...player });
    const result = await dryRunCapturedGoalieBundle(databaseMustNotRun as never, {
      seasonId: 20262027, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      capture: { basis: "captured_current", capturedAt: cutoffAt, cutoffAt,
        players: [{ ...player, sourceWatermark }] },
    });
    expect(result.receipt.dryRun).toBe(true);
    expect(result.manifest.released).toBe(false);
    expect(result.sources.find((row) => row.targetKey === "WINS_GOALIE")?.basis).toBe("per_start");
    expect(result.sources.find((row) => row.targetKey === "SAVES_GOALIE")?.basis).toBe("per_appearance");
    await expect(dryRunCapturedGoalieBundle(databaseMustNotRun as never, {
      seasonId: 20262027, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      capture: { basis: "captured_current", capturedAt: cutoffAt, cutoffAt,
        players: [{ ...player, sourceWatermark: "forged" }] },
    })).rejects.toThrow(/watermark/);
  });

  it("rejects forged goalie bundle identities, targets and lineage", () => {
    const snapshot = buildGoalieBaselineRates({ playerId: 7, nhlPlayerId: 77,
      seasonId: 20262027, cutoffAt, sourceWatermark: "w",
      projections: [projection], appearances: [] });
    const input = { seasonId: 20262027, cutoffAt, issuedAt: "2026-09-28T12:01:00Z",
      expiresAt: "2026-09-29T12:01:00Z", scheduleRevision: "schedule-a",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "r" }] };
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, nhlPlayerId: -1 } }] })).toThrow(/identity/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, definitionHash: undefined as never } }] })).toThrow(/identity/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, targets: [...snapshot.targets, snapshot.targets[0]] } }] })).toThrow(/target/);
    expect(() => buildGoalieContributionBundle({ ...input, snapshots: [{ ...input.snapshots[0],
      snapshot: { ...snapshot, targets: [{ ...snapshot.targets[0], basis: "per_start",
        sourceRows: [{ sourceId: "x", rowId: "y", availableAt: "invalid" }] }] } }] })).toThrow(/target/);
  });

  it("captures season-specific goalie schemas without inventing absent start denominators", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const tables: Record<string, any[]> = {
      PROJECTIONS_20252026_DTZ_GOALIES: [{ player_id: 77, upload_batch_id: "legacy",
        Games_Played: 40, Saves_Goalie: 1000, Ga: 100, Sa: 1100, Wins_Goalie: 15, Shutouts_Goalie: 3 }],
    };
    const errors: Record<string, { code: string }> = Object.fromEntries(
      baselineProjectionSchemas("goalie", 20272028).map(row => [row.tableName!, { code: "42P01" }]));
    const db = goalieCaptureDb(tables, calls, errors);
    const args = { db: db as never, now: () => new Date("2026-10-01T12:00:00Z"),
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }] };
    const legacy = await captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20252026 });
    expect(legacy.players[0].projections[0]).toMatchObject({ seasonId: 20252026,
      sourceTable: "PROJECTIONS_20252026_DTZ_GOALIES", projectedStarts: null,
      totals: { SAVES_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, SHOTS_AGAINST_GOALIE: 1100 } });
    const select = calls.find(row => row.table === "PROJECTIONS_20252026_DTZ_GOALIES" && row.method === "select");
    expect(select?.args[0]).toContain("Ga,Sa");
    expect(select?.args[0]).not.toContain("Games_Started_Goalie");
    const snapshot = buildGoalieBaselineRates({ ...legacy.players[0], seasonId: 20252026,
      cutoffAt: legacy.cutoffAt });
    expect(snapshot.targets.find(row => row.targetKey === "SAVES_GOALIE")?.rate).toBe(25);
    expect(snapshot.targets.some(row => row.basis === "per_start")).toBe(false);
    const bundle = buildGoalieContributionBundle({ seasonId: 20252026, cutoffAt: legacy.cutoffAt,
      issuedAt: "2026-10-01T12:01:00Z", expiresAt: "2026-10-02T00:00:00Z", scheduleRevision: "s",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "r" }] });
    expect(bundle.manifest.released).toBe(false);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026,
      capture: legacy })).resolves.toMatchObject({ dryRun: true });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026,
      capture: { ...legacy, players: [{ ...legacy.players[0], definitionHash: undefined as never }] } }))
      .rejects.toThrow(/definition/);
    tables.PROJECTIONS_20252026_DTZ_GOALIES.push({ ...tables.PROJECTIONS_20252026_DTZ_GOALIES[0],
      upload_batch_id: "another-batch" });
    await expect(captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20252026 }))
      .rejects.toThrow(/Ambiguous.*projection row/);
    tables.PROJECTIONS_20252026_DTZ_GOALIES.pop();
    calls.length = 0;
    const future = await captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20272028 });
    expect(future.players[0].projections).toEqual([]);
    expect(future.players[0].projectionSources.every(row => row.status === "table_unavailable")).toBe(true);
    expect(calls.some(row => row.table.includes("20262027"))).toBe(false);
    errors.PROJECTIONS_20272028_CULLEN_GOALIES = { code: "42703" };
    await expect(captureCurrentGoalieBaselineInputs({ ...args, seasonId: 20272028 }))
      .rejects.toThrow(/capture incomplete/);
  });

  it("captures current public goalie rows with historical team and explicit TOI", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const rows: Record<string, any[]> = {
      PROJECTIONS_20262027_CULLEN_GOALIES: [{ player_id: 77, upload_batch_id: "c-1",
        Games_Played: 40, Games_Started_Goalie: 30, Saves_Goalie: 1000,
        Goals_Against_Goalie: 100, Wins_Goalie: 15, Shutouts_Goalie: 3 }],
      goaliesGameStats: [{ playerId: 77, gameId: 2, saveShotsAgainst: "20/22",
        goalsAgainst: 2, toi: "60:30",
        games: { id: 2, date: "2026-03-01", seasonId: 20252026, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 2, player_id: 77, team_id: 4,
        season_id: 20252026, game_date: "2026-03-01" }],
    };
    const db = goalieCaptureDb(rows, calls);
    const times = [new Date("2026-09-28T12:00:00Z"), new Date("2026-09-28T12:00:01Z")];
    const capture = await captureCurrentGoalieBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => times.shift()! });
    expect(capture.basis).toBe("captured_current");
    expect(capture.players[0].projections[0].availableAt).toBe(capture.capturedAt);
    expect(capture.players[0].appearances[0].teamId).toBe(4);
    expect(capture.players[0].appearances[0].toiMinutes).toBe(60.5);
    expect(calls.find((call) => call.table === "goaliesGameStats" && call.method === "in"
      && call.args[0] === "playerId")?.args[1]).toEqual([77]);
    expect(calls.some((call) => call.table.includes("DOM") || call.table.includes("DOBBER"))).toBe(false);
    const crossing = [new Date("2026-09-28T23:59:59Z"), new Date("2026-09-29T00:00:01Z")];
    await expect(captureCurrentGoalieBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => crossing.shift()! })).rejects.toThrow(/crossed its UTC cutoff date/);
  });

  it("requires stable rows and final evidence for same-day capture", async () => {
    const sameDay = { playerId: 77, gameId: 30, saveShotsAgainst: "12/13",
      goalsAgainst: 1, toi: "42:00",
      games: { id: 30, date: "2026-09-28", seasonId: 20262027, type: 2 } };
    const tables: Record<string, any[]> = {
      goaliesGameStats: [sameDay],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-28" }],
      nhl_api_game_payloads_raw: [{ game_id: 30, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-09-28T11:00:00Z",
        payload: { id: 30, season: 20262027, gameState: "FINAL" } }],
    };
    const request = { seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const db = goalieCaptureDb(tables);
    const captured = await captureCurrentGoalieBaselineInputs({ ...request, db: db as never });
    expect(captured.players[0].appearances[0].finalBoxscore).toMatchObject({
      payloadHash: "a".repeat(64), fetchedAt: "2026-09-28T11:00:00Z" });
    tables.nhl_api_game_payloads_raw.unshift({ ...tables.nhl_api_game_payloads_raw[0],
      id: 3002,
      fetched_at: "2026-09-28T11:30:00Z",
      payload: { id: 30, season: 20262027, gameState: "LIVE" } });
    const unresolved = await captureCurrentGoalieBaselineInputs({ ...request, db: db as never });
    expect(unresolved.players[0].appearances).toEqual([]);
  });

  it("fails closed when a source changes between capture reads", async () => {
    let reads = 0;
    await expect(readStableCurrentInputs(async () => ({ rows: [{ value: ++reads }] })))
      .rejects.toThrow(/changed during reads/);
  });

  it("requires an explicit immutable goalie row selection for duplicate imports", async () => {
    const sourceRows = [
      { player_id: 77, upload_batch_id: "older", Games_Played: 40, Saves_Goalie: 2000, Ga: 200, Sa: 2200 },
      { player_id: 77, upload_batch_id: "selected", Games_Played: 40, Saves_Goalie: 1000, Ga: 100, Sa: 1100 },
    ];
    const db = goalieCaptureDb({ PROJECTIONS_20252026_DTZ_GOALIES: sourceRows });
    const schema = baselineProjectionSchemas("goalie", 20252026).find(row => row.id === "dtz_goalies")!;
    const args = { db: db as never, seasonId: 20252026,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-10-01T12:00:00Z") };
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/Ambiguous/);
    const projectionSelection = { dtz_goalies: { 77: { rowId: "selected",
      contentHash: baselineProjectionContentHash(schema, sourceRows[1]) } } };
    const capture = await captureCurrentGoalieBaselineInputs({ ...args, projectionSelection });
    expect(capture.players[0].projections[0]).toMatchObject({ projectedStarts: null,
      sourceRowId: "selected", sourceContentHash: projectionSelection.dtz_goalies[77].contentHash });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20252026, capture }))
      .resolves.toMatchObject({ dryRun: true });
    sourceRows[1].Saves_Goalie = 999;
    await expect(captureCurrentGoalieBaselineInputs({ ...args, projectionSelection })).rejects.toThrow(/missing or changed/);
  });

  it("binds measured goalie components, supersedes legacy logs and rejects rehashed disagreements", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].appearances[0]).toMatchObject({ saves: 20, shotsAgainst: 22,
      goalsAgainst: 2, toiMinutes: 30.5 });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const forged = structuredClone(capture);
    forged.players[0].appearances[0].toiMinutes = 60;
    const { sourceWatermark: _old, ...player } = forged.players[0];
    forged.players[0].sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis,
      capturedAt: forged.capturedAt, ...player });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
      .rejects.toThrow(/values do not match/);
    rows.goaliesGameStats[0].goalsAgainst = 3;
    const corrected = await captureCurrentGoalieBaselineInputs(args);
    expect(corrected.players[0].appearances[0].goalsAgainst).toBe(2);
    expect(corrected.limitations.join(" ")).toContain("supersede 1 disagreeing normalized");
    rows.goaliesGameStats[0].goalsAgainst = 2;
    rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam.goalies[0].shotsAgainst = 999;
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/conflicting boxscore goalie components/);
  });

  it("recovers a roster-only goalie appearance and excludes a verified zero-TOI backup", async () => {
    const rows: Record<string, any[]> = {
      PROJECTIONS_20262027_CULLEN_GOALIES: [{ player_id: 77, upload_batch_id: "c", Games_Played: 40,
        Saves_Goalie: 1000, Goals_Against_Goalie: 100 }],
      games: [{ id: 30, date: "2026-09-27", seasonId: 20262027, type: 2,
        startTime: "2026-09-27T01:00:00Z", homeTeamId: 4, awayTeamId: 5 }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
      nhl_api_game_payloads_raw: [{ id: 3001, game_id: 30, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-09-27T10:00:00Z",
        payload: { id: 30, season: 20262027, gameDate: "2026-09-27", gameType: 2, gameState: "FINAL",
          homeTeam: { id: 4 }, awayTeam: { id: 5 }, playerByGameStats: {
            homeTeam: { forwards: [{ playerId: 1001 }], defense: [], goalies: [{ playerId: 77, toi: "30:30", saves: 20,
              shotsAgainst: 22, goalsAgainst: 2 }] },
            awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } } } }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].appearances).toHaveLength(1);
    expect(capture.players[0].appearances[0]).toMatchObject({ gameId: 30, toiMinutes: 30.5, saves: 20 });
    expect(capture.players[0].historicalSources).toMatchObject({ populationCoverage: "unverified",
      games: [{ game: { id: 30 }, normalization: null, roster: { team_id: 4 } }] });
    expect(capture.limitations.join(" ")).toContain("Recovered 1 goalie appearances without normalized logs");
    const bundle = await dryRunCapturedGoalieBundle({} as never, { capture, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources.find(row => row.targetKey === "SAVES_GOALIE")?.limitations)
      .toContain("Recovered 1 goalie appearances without normalized logs.");
    expect(bundle.sources.find(row => row.targetKey === "SAVES_GOALIE")?.limitations)
      .toContain("Historical normalization lineage: 0 complete, 0 stale, 1 missing among 1 discovered games.");
    rows.nhl_api_game_payloads_raw[0].payload.playerByGameStats.homeTeam.goalies[0].toi = "00:00";
    const backup = await captureCurrentGoalieBaselineInputs(args);
    expect(backup.players[0].appearances).toEqual([]);
    expect(backup.limitations.join(" ")).not.toContain("Recovered 1");
  });

  it("binds goalie historical normalization versions and rejects conflicting or stripped lineage", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4, season_id: 20262027,
        game_date: "2026-09-27", source_play_by_play_hash: "a".repeat(64), parser_version: 1 }],
      nhl_api_game_normalization_status: [{ game_id: 30, season_id: 20262027, game_date: "2026-09-27",
        status: "complete", normalization_version: 3, normalization_fingerprint: "b".repeat(64),
        source_fingerprint: "c".repeat(64), parser_fingerprint: "d".repeat(64), parser_version: 1, strength_version: 1,
        materializer_version: "normalization-v1", pbp_raw_payload_id: 4001, pbp_raw_snapshot_version: 1,
        pbp_raw_payload_hash: "a".repeat(64), shift_raw_payload_id: 4002, shift_raw_snapshot_version: 1,
        shift_raw_payload_hash: "e".repeat(64), roster_fingerprint: "f".repeat(64), event_fingerprint: "1".repeat(64),
        shift_fingerprint: "2".repeat(64), expected_roster_rows: 4, observed_roster_rows: 4,
        expected_event_rows: 100, observed_event_rows: 100, expected_shift_rows: 200, observed_shift_rows: 200,
        completed_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-27T10:01:00Z" }],
    };
    const args = { db: goalieCaptureDb(rows) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentGoalieBaselineInputs(args);
    expect(capture.players[0].historicalSources?.games[0].normalization).toMatchObject({ normalization_version: 3 });
    expect(capture.players[0].appearances[0].toiMinutes).toBe(30.5);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const forged = structuredClone(capture), player = forged.players[0];
    delete player.historicalSources;
    const { sourceWatermark: _old, ...identity } = player;
    player.sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis, capturedAt: forged.capturedAt, ...identity });
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
      .rejects.toThrow(/historical source receipt/);
    rows.nhl_api_game_roster_spots[0].parser_version = 2;
    await expect(captureCurrentGoalieBaselineInputs(args)).rejects.toThrow(/conflicts with its complete normalization/);
  });

  it("rejects conflicting goalie historical scope before a roster map can hide it", async () => {
    const rows: Record<string, any[]> = {
      goaliesGameStats: [{ playerId: 77, gameId: 30, saveShotsAgainst: "20/22", goalsAgainst: 2, toi: "30:30",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [5, 4].map(team_id => ({ game_id: 30, player_id: 77, team_id,
        season_id: 20262027, game_date: "2026-09-27" })),
    };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    await expect(captureCurrentGoalieBaselineInputs({ db: goalieCaptureDb(rows, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/baseline historical/i);
    expect(calls.some(call => call.table === "nhl_api_game_payloads_raw")).toBe(false);
  });

  it("rejects a duplicated NHL request identity for goalies without database access", async () => {
    await expect(captureCurrentGoalieBaselineInputs({ db: {} as never, seasonId: 20262027,
      players: [7, 8].map(playerId => ({ playerId, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" })) }))
      .rejects.toThrow(/explicit canonical goalies/);
    const capture = await captureCurrentGoalieBaselineInputs({ db: goalieCaptureDb({}) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }] });
    const duplicate = { ...structuredClone(capture.players[0]), playerId: 8 };
    const { sourceWatermark: _old, ...identity } = duplicate;
    duplicate.sourceWatermark = playerForecastSourcePayloadHash({ basis: capture.basis,
      capturedAt: capture.capturedAt, ...identity });
    capture.players.push(duplicate);
    await expect(persistCapturedGoalieBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .rejects.toThrow(/Invalid current goalie capture receipt/);
  });
});

function goalieFixture(rates: ContributionSource[], original: GameForecast): PlanningSnapshot {
  return { id: "goalie", context: { provider: "manual", seasonId: 20262027,
    leagueId: "l", teamId: "t", startDate: "2026-10-03", endDate: "2026-10-03",
    timeZone: "UTC", asOf: "2026-09-29T00:00:00Z" },
  players: [{ id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Goalie",
    teamAbbreviation: "MIN", eligiblePositions: ["G"], playerClass: "goalie",
    availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
  games: [{ id: "30", date: "2026-10-03", startsAt: "2026-10-03T23:00:00Z",
    scheduleRevision: "schedule-a", teamAbbreviation: "MIN", opponent: "TOR", home: true,
    status: "scheduled" }], forecasts: [original], baselineSources: rates, roster: [],
  rules: {} as PlanningSnapshot["rules"], lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
}

describe("goalie planning use", () => {
  const source: ContributionSource = { kind: "baseline", sourceId: "goalie-rate", policyVersion: "g-v1",
    released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1,
    targetKey: "WINS_GOALIE", unit: "count", basis: "per_start", mean: 0.5,
    participationIntegrated: false, cutoffAt: "2026-09-28T00:00:00Z",
    issuedAt: "2026-09-28T12:00:00Z", expiresAt: "2026-10-04T00:00:00Z",
    sourceWatermark: "w", scheduleRevision: "schedule-a", rosterRevision: "roster-a" };
  const original: GameForecast = { playerId: "7", gameId: "30", stats: {}, sourceKind: "detailed", sourceWatermark: "captured-reads",
    issuedContext: { version: "forge-issued-context-v1", playerId: "7", gameId: "30", nhlPlayerId: 77,
      seasonId: 20262027, teamId: 1, scheduledAt: "2026-10-03T23:00:00Z", scheduleRevision: "schedule-a",
      rosterRevision: "roster-a", observedAt: "2026-09-28T12:00:00Z", scheduleSourceUpdatedAt: null,
      scheduleFetchedAt: "2026-09-28T12:00:00Z", identityUpdatedAt: null,
      membershipCreatedAt: ["2026-09-01T00:00:00Z"] },
    conditioning: "unconditional", startProbability: 0.6, confirmedStart: false,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    revisionId: "starter-mixture", issuedAt: "2026-09-28T13:00:00Z",
    cutoffAt: "2026-09-28T12:00:00Z", expiresAt: "2026-10-04T00:00:00Z",
    modelVersion: "starter-v1", limitations: [] };
  it("uses start probability for per-start rates without confirming a start", () => {
    const forecast = resolvePlanningContributions(goalieFixture([source], original)).forecasts[0];
    expect(forecast.stats.WINS_GOALIE).toBeCloseTo(0.3);
    expect(forecast.startProbability).toBe(0.6);
    expect(forecast.confirmedStart).toBe(false);
  });
  it("does not multiply per-appearance rates by start probability", () => {
    const appearance = { ...source, targetKey: "SAVES_GOALIE", basis: "per_appearance" as const, mean: 25 };
    const forecast = resolvePlanningContributions(goalieFixture([appearance], original)).forecasts[0];
    expect(forecast.stats.SAVES_GOALIE).toBeNull();
    expect(forecast.contributions?.SAVES_GOALIE.allowedUses.totals).toBe(false);
  });
  it("rejects overfull competing starter mass, including an unconditional original", () => {
    const snapshot = goalieFixture([source], { ...original, stats: { WINS_GOALIE: 0.3 } });
    snapshot.players.push({ ...snapshot.players[0], id: "8", nhlId: 88, name: "Other goalie" });
    snapshot.forecasts.push({ ...original, playerId: "8", revisionId: "other-starter",
      issuedContext: { ...original.issuedContext!, playerId: "8", nhlPlayerId: 88 } });
    const forecast = resolvePlanningContributions(snapshot).forecasts.find((row) => row.playerId === "7")!;
    expect(forecast.stats.WINS_GOALIE).toBeNull();
    expect(forecast.confirmedStart).toBe(false);
  });
  it("keeps overfull retained starter competition unavailable on repeated resolution", () => {
    const retained = resolvePlanningContributions(goalieFixture([source], original));
    retained.players.push({ ...retained.players[0], id: "8", nhlId: 88, name: "Other goalie" });
    retained.forecasts.push({ ...original, playerId: "8", revisionId: "other-starter",
      issuedContext: { ...original.issuedContext!, playerId: "8", nhlPlayerId: 88 } });
    const rejected = resolvePlanningContributions(retained);
    const replayed = resolvePlanningContributions(JSON.parse(JSON.stringify(rejected)));
    for (const result of [rejected, replayed]) {
      const forecast = result.forecasts.find(row => row.playerId === "7")!;
      expect(forecast.stats.WINS_GOALIE).toBeNull();
      expect(forecast.contributions?.WINS_GOALIE.allowedUses.comparison).toBe(false);
      expect(forecast.confirmedStart).toBe(false);
    }
  });
  it("withholds appearance-basis ratio supplements beside a detailed start branch", () => {
    const shots: ContributionSource = { ...source, sourceId: "shots-rate",
      targetKey: "SHOTS_AGAINST_GOALIE", basis: "per_appearance", mean: 30 };
    const minutes: ContributionSource = { ...source, sourceId: "minutes-rate",
      targetKey: "GOALIE_MINUTES", unit: "minutes", basis: "per_appearance", mean: 55 };
    const detailedStart: GameForecast = { ...original,
      stats: { SAVES_GOALIE: 12, GOALS_AGAINST_GOALIE: 1.2 },
      conditionalStats: { SAVES_GOALIE: 20, GOALS_AGAINST_GOALIE: 2 },
      appearanceProbability: 0.8 };
    const resolved = resolvePlanningContributions(goalieFixture([shots, minutes, source], detailedStart));
    const forecast = resolved.forecasts[0];
    expect(forecast.stats.SAVES_GOALIE).toBe(12);
    expect(forecast.stats.GOALS_AGAINST_GOALIE).toBe(1.2);
    expect(forecast.stats.WINS_GOALIE).toBeCloseTo(0.3);
    expect(forecast.stats.SHOTS_AGAINST_GOALIE).toBeNull();
    expect(forecast.stats.GOALIE_MINUTES).toBeNull();
    expect(forecast.contributions?.SHOTS_AGAINST_GOALIE.exclusionReasons)
      .toContain("incompatible_component_basis");
    expect(forecast.contributions?.SHOTS_AGAINST_GOALIE.allowedUses.comparison).toBe(false);
    expect(resolvePlanningContributions(JSON.parse(JSON.stringify(resolved))).forecasts).toEqual(resolved.forecasts);
  });
});

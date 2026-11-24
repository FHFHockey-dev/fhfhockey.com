// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DiagnosticReadError, loadForecastDiagnostics, parseDiagnosticQuery, type DiagnosticReadClient } from "./loader";

type Row = Record<string, unknown>;
const cutoffAt = "2026-01-10T11:45:00Z";
const gameId = 2025020001;
const fixtureTables = (): Record<string, Row[]> => ({
  games: [{ id: gameId, date: "2026-01-10", startTime: "2026-01-10T23:00:00Z", seasonId: 20252026, homeTeamId: 1, awayTeamId: 2, type: 2 },
    { id: gameId - 1, date: "2026-01-09", startTime: "2026-01-09T23:00:00Z", seasonId: 20252026, homeTeamId: 1, awayTeamId: 2, type: 2 }],
  teams: [{ id: 1, abbreviation: "BOS", name: "Boston" }, { id: 2, abbreviation: "OTT", name: "Ottawa" }],
  forge_game_revisions: [], game_prediction_history: [], game_prediction_feature_snapshots: [], player_forecast_source_observations: [],
  nst_team_gamelogs_as_counts: [{ season_id: 20252026, team_abbreviation: "BOS", date: "2026-01-09", gp: 3, gf: 9, ga: 8 },
    { season_id: 20252026, team_abbreviation: "OTT", date: "2026-01-09", gp: 1, gf: 2, ga: 3 }],
});

function reader(tables = fixtureTables(), failedTable?: string) {
  const operations: string[] = [];
  const client = { from(table: string) {
    operations.push(`from:${table}`);
    const filters: ((row: Row) => boolean)[] = [];
    let single = false, count = false, columns = "*", limit = Infinity;
    const query: Record<string, unknown> = {};
    const same = (a: unknown, b: unknown) => a === b || typeof a === "string" && typeof b === "string" && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
    query.select = (value: string, options?: { count?: string }) => { operations.push(`select:${table}`); columns = value; count = options?.count === "exact"; return query; };
    query.eq = (column: string, value: unknown) => { operations.push(`eq:${table}:${column}`); filters.push(row => same(row[column], value)); return query; };
    query.in = (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return query; };
    query.lt = (column: string, value: string) => { filters.push(row => String(row[column]) < value); return query; };
    query.lte = (column: string, value: string) => { filters.push(row => String(row[column]) <= value); return query; };
    query.or = () => query;
    query.order = () => query;
    query.range = (from: number, to: number) => { expect(from).toBe(0); limit = to + 1; return query; };
    query.limit = (value: number) => { limit = value; return query; };
    query.maybeSingle = () => { single = true; return query; };
    query.abortSignal = () => query;
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
      const rows = tables[table].filter(row => filters.every(test => test(row)));
      const project = (row: Row) => columns === "*" ? row : Object.fromEntries(columns.split(",").filter(key => key in row).map(key => [key, row[key]]));
      const data = single ? rows[0] ? project(rows[0]) : null : rows.slice(0, limit).map(project);
      return Promise.resolve({ data, error: table === failedTable ? { message: "private driver detail" } : null, count: count ? rows.length : null }).then(resolve, reject);
    };
    return query;
  } } as unknown as DiagnosticReadClient;
  return { client, operations };
}

describe("read-only diagnostic evidence loader", () => {
  it("requires an explicit canonical game and timezone-qualified cutoff", () => {
    expect(parseDiagnosticQuery({ gameId: String(gameId), cutoffAt: "2026-01-10T06:45:00-05:00" })).toEqual({ gameId, cutoffAt: "2026-01-10T11:45:00.000Z" });
    for (const bad of [{ gameId: String(gameId) }, { gameId: [String(gameId)], cutoffAt }, { gameId: "12", cutoffAt }, { gameId: String(gameId), cutoffAt: "2026-01-10T11:45:00" }, { gameId: String(gameId), cutoffAt: "2026-02-30T11:45:00Z" }]) expect(() => parseDiagnosticQuery(bad)).toThrow(DiagnosticReadError);
  });
  it("keeps missing history and unproved legacy exposure unavailable with only table reads", async () => {
    const mock = reader();
    const report = await loadForecastDiagnostics(mock.client, { gameId, cutoffAt });
    expect(report.evidenceKind).toBe("retained_records");
    expect(report.comparisons).toHaveLength(2);
    expect(report.comparisons.every(row => row.status === "unavailable" && row.difference === null)).toBe(true);
    expect(report.exposure[0]).toMatchObject({ legacyTotals: { gp: 3, gf: 9, ga: 8 }, correctedTotals: { gp: null, gf: null, ga: null }, coverage: "unavailable" });
    expect(report.sources.find(row => row.source === "nst_team_gamelogs_as_counts")).toMatchObject({ availabilityBasis: "unknown", availableAt: null });
    expect(mock.operations.every(op => /^(from|select|eq):/.test(op))).toBe(true);
    expect(report.replay).toMatchObject({ status: "not_verified" });
  });
  it("retains model base means without treating hindsight or missing endpoint metadata as aligned", async () => {
    const tables = fixtureTables();
    tables.game_prediction_history = [{ prediction_id: "historical", feature_snapshot_id: "snapshot", game_id: gameId, home_team_id: 1, away_team_id: 2, home_expected_goals: 3.25, away_expected_goals: 2.75, model_version: "retained-v1", prediction_cutoff_at: cutoffAt, computed_at: "2026-06-15T12:00:00Z" }];
    tables.game_prediction_feature_snapshots = [{ feature_snapshot_id: "snapshot", computed_at: "2026-06-15T12:00:00Z", feature_payload: { home: {} } }];
    const report = await loadForecastDiagnostics(reader(tables).client, { gameId, cutoffAt });
    expect(report.comparisons[0].team?.rawMean).toBe(3.25);
    expect(report.comparisons[0].team?.modelVersion).toBe("retained-v1");
    expect(report.comparisons[0].reasons).toContain("invalid_issuance");
    expect(report.comparisons[0].reasons).toContain("unsupported_goal_endpoint");
    expect(report.comparisons[0].teamMean).toBeNull();
  });
  it("fails closed for truncated inventories and source errors", async () => {
    const tables = fixtureTables(); tables.nst_team_gamelogs_as_counts = Array.from({ length: 1001 }, () => ({ ...tables.nst_team_gamelogs_as_counts[0] }));
    await expect(loadForecastDiagnostics(reader(tables).client, { gameId, cutoffAt })).rejects.toMatchObject({ status: 503 });
    await expect(loadForecastDiagnostics(reader(fixtureTables(), "forge_game_revisions").client, { gameId, cutoffAt })).rejects.toMatchObject({ status: 503, message: expect.not.stringContaining("private driver") });
  });
  it("rejects absent identities and post-start cutoffs", async () => {
    await expect(loadForecastDiagnostics(reader().client, { gameId: 2025029999, cutoffAt })).rejects.toMatchObject({ status: 404 });
    await expect(loadForecastDiagnostics(reader().client, { gameId, cutoffAt: "2026-01-10T23:00:00Z" })).rejects.toMatchObject({ status: 400 });
  });
});

import { describe, expect, it } from "vitest";
import { reconcileTeamPlayerForecast, summarizeTeamForecasts, TEAM_FORECAST_CATEGORIES,
  TEAM_FORECAST_CREDITS, type TeamForecastContext, type TeamForecastRecord } from "./teamForecasts";

const asOf = "2026-10-07T16:00:00Z";
const context: TeamForecastContext = { seasonId: 20262027, scheduleRevision: "schedule-r1",
  rosterRevision: "roster-r1", rosterScope: "skaters", games: [
    { gameId: 1, startsAt: "2026-10-07T23:00:00Z", state: "scheduled" },
    { gameId: 2, startsAt: "2026-10-09T23:00:00Z", state: "scheduled" },
  ] };

function record(overrides: Partial<TeamForecastRecord> = {}): TeamForecastRecord {
  return { teamId: 10, gameId: 1, seasonId: 20262027, category: "G", mean: 3,
    unit: "count", scope: "full_game_regulation_overtime", conditioning: "unconditional",
    creditDefinition: TEAM_FORECAST_CREDITS.G, rosterScope: "skaters", rosterRevision: "roster-r1",
    scheduleRevision: "schedule-r1", startsAt: context.games[0].startsAt, status: "qualified",
    allowedUses: { totals: true, comparison: true }, revisionId: "issued-r1", modelVersion: "model-v1",
    comparisonLineageId: "qualified-comparison-run-r1",
    sourceWatermark: "immutable-input-r1", sourceAvailableAt: "2026-10-07T13:00:00Z",
    cutoffAt: "2026-10-07T14:00:00Z", issuedAt: "2026-10-07T14:30:00Z",
    availableAt: "2026-10-07T14:31:00Z", expiresAt: "2026-10-07T22:00:00Z", ...overrides };
}

function summary(records?: TeamForecastRecord[], gameIds = [1, 2]) {
  return summarizeTeamForecasts({ teamId: 10, gameIds, asOf, records, context });
}

describe("Game Grid qualified team categories", () => {
  it("keeps absent forecasts null for every category and distinguishes an empty horizon", () => {
    for (const category of TEAM_FORECAST_CATEGORIES) {
      expect(summary()[category]).toMatchObject({ status: "unavailable", mean: null,
        knownGames: 0, expectedGames: 2 });
      expect(summary(undefined, [])[category]).toEqual({ status: "no_games", mean: 0,
        knownGames: 0, expectedGames: 0, limitations: [] });
    }
  });

  it("preserves true zero and exposes incomplete coverage as a known subtotal", () => {
    const partial = summary([record({ mean: 0 })]).G;
    expect(partial).toMatchObject({ status: "partial", mean: 0, knownGames: 1, expectedGames: 2 });
    expect(partial.limitations).toContain("Known subtotal, 1 of 2 games; missing games are not zero.");
    expect(summary([record({ mean: 0 })], [1]).G.status).toBe("available");
  });

  it("sums exact game means once, with category-specific units and coverage", () => {
    const rows = [record(), record({ gameId: 2, startsAt: context.games[1].startsAt, mean: 2 }),
      record({ category: "PIM", unit: "minutes", creditDefinition: TEAM_FORECAST_CREDITS.PIM, mean: 7 })];
    const result = summary(rows, [1, 1, 2]);
    expect(result.G).toMatchObject({ status: "available", mean: 5, knownGames: 2, expectedGames: 2 });
    expect(result.PIM).toMatchObject({ status: "partial", mean: 7, knownGames: 1 });
    expect(result.A.mean).toBeNull();
  });

  it.each([
    ["missing mean", { mean: null }], ["nonfinite mean", { mean: Infinity }], ["negative count", { mean: -1 }],
    ["wrong season", { seasonId: 20252026 }], ["changed schedule", { scheduleRevision: "schedule-r2" }],
    ["changed roster", { rosterRevision: "roster-r2" }], ["roster credit scope", { rosterScope: "all_players" }],
    ["postponed start identity", { startsAt: "2026-10-08T23:00:00Z" }],
    ["conditional ability", { conditioning: "conditional_playing" }],
    ["remaining game scope", { scope: "remaining_game" }],
    ["scoreboard shootout credit", { creditDefinition: "scoreboard_goals" }],
    ["wrong unit", { unit: "per_60" }], ["unqualified", { status: "unavailable" }],
    ["totals use denied", { allowedUses: { totals: false, comparison: true } }],
    ["missing revision", { revisionId: "" }], ["missing model", { modelVersion: "" }],
    ["missing comparison lineage", { comparisonLineageId: "" }],
    ["missing watermark", { sourceWatermark: "" }],
    ["future source availability", { sourceAvailableAt: "2026-10-07T15:00:00Z" }],
    ["future issuance", { issuedAt: "2026-10-07T17:00:00Z", availableAt: "2026-10-07T17:01:00Z" }],
    ["future reader availability", { availableAt: "2026-10-07T17:00:00Z" }],
    ["unknown availability", { availableAt: "unknown" }],
    ["inverted cutoff", { cutoffAt: "2026-10-07T15:00:00Z" }],
    ["stale at cutoff", { expiresAt: asOf }],
  ] as Array<[string, Partial<TeamForecastRecord>]>)("rejects %s", (_, overrides) => {
    expect(summary([record(overrides)], [1]).G).toMatchObject({ status: "unavailable", mean: null, knownGames: 0 });
  });

  it.each(["started", "completed", "postponed", "cancelled"] as const)("rejects %s games", state => {
    expect(summarizeTeamForecasts({ teamId: 10, gameIds: [1], asOf, records: [record()],
      context: { ...context, games: [{ ...context.games[0], state }] } }).G.mean).toBeNull();
  });

  it("rejects a game at puck drop and absent or ambiguous schedule context", () => {
    expect(summarizeTeamForecasts({ teamId: 10, gameIds: [1], asOf: context.games[0].startsAt,
      records: [record({ expiresAt: "2026-10-08T01:00:00Z" })], context }).G.mean).toBeNull();
    expect(summarizeTeamForecasts({ teamId: 10, gameIds: [1], asOf, records: [record()] }).G.mean).toBeNull();
    expect(summarizeTeamForecasts({ teamId: 10, gameIds: [1], asOf, records: [record()],
      context: { ...context, games: [context.games[0], context.games[0]] } }).G.mean).toBeNull();
  });

  it("rejects duplicates rather than double counting or choosing an unverified revision", () => {
    expect(summary([record(), record({ revisionId: "issued-r2" })], [1]).G).toMatchObject({
      status: "unavailable", mean: null, knownGames: 0 });
  });

  it("does not replace awarded assists or PPP credits with a multiple of goals", () => {
    expect(summary([record({ category: "A", creditDefinition: "two_assists_per_goal" }),
      record({ category: "PPP", creditDefinition: "team_power_play_goals" })], [1]).A.mean).toBeNull();
    expect(summary([record({ category: "PPP", creditDefinition: "team_power_play_goals" })], [1]).PPP.mean).toBeNull();
  });
});

describe("explicit team/player reconciliation", () => {
  const reconcile = (players: Array<TeamForecastRecord & { playerId: number }>,
    team = record(), expectedPlayerIds = [101, 102]) => reconcileTeamPlayerForecast({
      team, players, expectedPlayerIds, context, asOf });
  const player = (playerId: number, mean: number, overrides: Partial<TeamForecastRecord> = {}) =>
    ({ ...record({ mean, ...overrides }), playerId });

  it("preserves a partial roster subtotal and its identified residual without rescaling", () => {
    const result = reconcile([player(101, 1)]);
    expect(result).toMatchObject({ status: "partial", teamMean: 3, knownPlayerSubtotal: 1,
      residual: 2, knownPlayers: 1, expectedPlayers: 2 });
    expect(result.limitations.join(" ")).toContain("no rescaling");
    expect(reconcile([])).toMatchObject({ status: "unavailable", teamMean: 3,
      knownPlayerSubtotal: null, residual: null, knownPlayers: 0 });
  });

  it("retains real zero and negative discrepancies for a complete roster", () => {
    expect(reconcile([player(101, 0), player(102, 0)], record({ mean: 0 }))).toMatchObject({
      status: "available", knownPlayerSubtotal: 0, residual: 0 });
    expect(reconcile([player(101, 2), player(102, 2)])).toMatchObject({
      status: "available", knownPlayerSubtotal: 4, residual: -1 });
  });

  it("requires a shared qualified run and model while retaining distinct output revision identities", () => {
    expect(reconcile([player(101, 1, { revisionId: "player-issued-r1" })],
      record({ revisionId: "team-issued-r1" }), [101])).toMatchObject({
      status: "available", knownPlayerSubtotal: 1, residual: 2 });
    const otherRun = reconcile([player(101, 1, { comparisonLineageId: "qualified-comparison-run-r2" })],
      record(), [101]);
    expect(otherRun).toMatchObject({ status: "unavailable", knownPlayerSubtotal: null, residual: null });
    expect(otherRun.limitations).toContain("Team/player comparison lineage does not match.");
    const otherModel = reconcile([player(101, 1, { modelVersion: "model-v2" })], record(), [101]);
    expect(otherModel).toMatchObject({ status: "unavailable", knownPlayerSubtotal: null, residual: null });
    expect(otherModel.limitations).toContain("Team/player model versions do not match.");
    expect(reconcile([player(101, 1)], record({ comparisonLineageId: "" }), [101]).teamMean).toBeNull();
  });

  it.each([
    { conditioning: "conditional_playing" }, { scope: "remaining_game" },
    { creditDefinition: "scoreboard_goals" }, { rosterScope: "all_players" },
    { scheduleRevision: "schedule-r2" }, { rosterRevision: "roster-r2" }, { revisionId: "" },
    { comparisonLineageId: "" },
    { cutoffAt: "2026-10-07T13:30:00Z" }, { allowedUses: { totals: true, comparison: false } },
  ] as Partial<TeamForecastRecord>[])("rejects incompatible player record %j", overrides => {
    expect(reconcile([player(101, 1, overrides)], record(), [101])).toMatchObject({
      status: "unavailable", knownPlayerSubtotal: null, residual: null });
  });

  it("rejects team comparison without permission and handles unknown roster or duplicate players", () => {
    expect(reconcile([player(101, 1)], record({ allowedUses: { totals: true, comparison: false } }), [101])
      .teamMean).toBeNull();
    expect(reconcile([], record(), []).status).toBe("unavailable");
    expect(reconcile([player(101, 1), player(101, 1)], record(), [101]).knownPlayers).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import type { GameForecast, PlanningData, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { currentRsoUsePolicy } from "lib/player-forecasts/rsoUsePolicy";
import { withCurrentPlanningRead } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import { candidatePlanMetrics } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import { compactBridgeForecasts, expandBridgeForecasts, fitBridgeWire, jsonUtf8Bytes, PLANNING_RESPONSE_BYTE_BUDGET, reserveCodeOf } from "./bridgeForecastWire";
import { buildForgeDailyBridgeForecasts, FORGE_DAILY_BRIDGE_BYTE_BUDGET, FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET, FORGE_RESERVE_EXPANDED_BYTE_BUDGET, type ForgeDailyBridgeInputs } from "./forgeDailyBridge";
import { league, now, seasonId, SKATERS, LINEUP, type Shape } from "./forgeReservePayload.fixture";

function measure(days: number, expandedBudget = Number.POSITIVE_INFINITY, wireBudget = Number.POSITIVE_INFINITY, shape: Shape = "typical") {
  const { players, games, inputs } = league(days, shape);
  const policy = forecastCalendarPolicy(Math.min(21, Math.max(days + 1, 1)));
  const result = buildForgeDailyBridgeForecasts(inputs, players, games, now, seasonId, policy, wireBudget, expandedBudget);
  const { wire, forecasts: uncompacted } = compactBridgeForecasts(result.forecasts, { players, games }, seasonId);
  const opportunities = players.filter(player => player.teamAbbreviation).reduce((sum, player) =>
    sum + games.filter(game => game.teamAbbreviation === player.teamAbbreviation).length, 0);
  const expanded = result.forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0);
  const playersBytes = jsonUtf8Bytes(players), gamesBytes = jsonUtf8Bytes(games);
  const started = performance.now();
  const rebuilt = expandBridgeForecasts(wire, { players, games });
  const decodeMs = performance.now() - started;
  return { days, players, games, result, wire, uncompacted, rebuilt, opportunities, decodeMs,
    bytes: { expanded, wire: jsonUtf8Bytes(wire), players: playersBytes, games: gamesBytes,
      // The stored, validated snapshot is unpacked: every forecast plus players and games.
      snapshot: expanded + playersBytes + gamesBytes } };
}
/** The tightest unpacked ceiling: the preservation backup check (8 MiB), which holds the saved snapshot unpacked. */
const BACKUP_LIMIT = 8 * 1024 * 1024;
/** Kept free under that ceiling for workspace copies (local, history, journal), roster settings and selections. */
const HEADROOM = 1_500_000;

describe("FORGE reserve payload (full selected-horizon coverage)", () => {
  it("covers every rostered player's every game in a week, and fits the budgets with headroom", () => {
    const week = measure(7, FORGE_RESERVE_EXPANDED_BYTE_BUDGET, FORGE_DAILY_BRIDGE_BYTE_BUDGET);
    // Every player on an NHL roster has a line for every game of his team in the week: nothing trimmed or withheld.
    expect(week.result.forecasts.length).toBe(week.opportunities);
    const covered = new Set(week.result.forecasts.map(row => `${row.playerId}:${row.gameId}`));
    for (const player of week.players.filter(row => row.teamAbbreviation))
      for (const game of week.games.filter(row => row.teamAbbreviation === player.teamAbbreviation)) expect(covered.has(`${player.id}:${game.id}`)).toBe(true);
    expect(week.result.limitations.some(text => /withheld|trimmed/.test(text))).toBe(false);
    expect(week.result.forecasts.filter(row => reserveCodeOf(row)).length).toBe(week.games.length * (SKATERS - LINEUP + 2));
    // Lossless transport: everything compacts and rebuilds exactly.
    expect(week.uncompacted).toEqual([]);
    expect(week.rebuilt).toEqual(week.result.forecasts);
    expect(week.bytes.expanded).toBeLessThanOrEqual(FORGE_RESERVE_EXPANDED_BYTE_BUDGET);
    expect(week.bytes.wire).toBeLessThanOrEqual(FORGE_DAILY_BRIDGE_BYTE_BUDGET);
    expect(week.bytes.wire + week.bytes.players + week.bytes.games).toBeLessThan(PLANNING_RESPONSE_BYTE_BUDGET);
    expect(week.bytes.snapshot).toBeLessThan(BACKUP_LIMIT - HEADROOM);
  });

  it("uses one 6 MB expanded budget, with or without the reserve pass, now that every player has a row (TJ, option B)", () => {
    expect(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET).toBe(6_000_000);
    expect(FORGE_RESERVE_EXPANDED_BYTE_BUDGET).toBe(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET);
  });

  it("keeps the budget itself inside the saved-snapshot ceiling with headroom", () => {
    const week = measure(7);
    expect(FORGE_RESERVE_EXPANDED_BYTE_BUDGET + week.bytes.players + week.bytes.games).toBeLessThan(BACKUP_LIMIT - HEADROOM);
  });

  it.each([[7, "maximal"], [14, "typical"], [21, "typical"]] as const)("withholds every reserve line together, never the late games only, when %i days (%s) cannot fit", (days, shape) => {
    const full = measure(days, undefined, undefined, shape);
    const bounded = measure(days, FORGE_RESERVE_EXPANDED_BYTE_BUDGET, FORGE_DAILY_BRIDGE_BYTE_BUDGET, shape);
    if (full.bytes.expanded <= FORGE_RESERVE_EXPANDED_BYTE_BUDGET && full.bytes.wire <= FORGE_DAILY_BRIDGE_BYTE_BUDGET) {
      expect(bounded.result.forecasts).toEqual(full.result.forecasts);
      return;
    }
    expect(bounded.result.forecasts.some(row => reserveCodeOf(row))).toBe(false);
    expect(bounded.result.limitations.some(text => /^FORGE reserve lines for \d+ player-games were withheld/.test(text))).toBe(true);
  });

  it("reports the measurement", () => {
    const rows = ([[7, "typical"], [7, "maximal"], [14, "typical"], [21, "typical"]] as const).map(([days, shape]) => {
      const m = measure(days, undefined, undefined, shape);
      const reserves = m.result.forecasts.filter(row => reserveCodeOf(row));
      return { days, shape, gameCount: m.games.length / 2, opportunities: m.opportunities, forecasts: m.result.forecasts.length, reserveRows: reserves.length, ...m.bytes,
        expandedPerRow: Math.round(m.bytes.expanded / m.result.forecasts.length),
        reserveExpandedPerRow: Math.round(reserves.reduce((sum, row: GameForecast) => sum + jsonUtf8Bytes(row) + 1, 0) / reserves.length),
        decodeMs: Math.round(m.decodeMs) };
    });
    console.info(`FORGE_RESERVE_PAYLOAD ${JSON.stringify(rows)}`);
    expect(rows[0].forecasts).toBe(rows[0].opportunities);
  });

  it("with the reserve pass off, gives every rostered player a row so one scratched roster player no longer blanks every candidate", async () => {
    // P1 (2026-10-26): one rostered skater with no FORGE line used to null the roster baseline and every candidate's points.
    const { players: catalog, games, inputs } = league(7, "typical");
    const { reserves: _off, ...flagOff } = inputs;
    const built = buildForgeDailyBridgeForecasts(flagOff, catalog, games, now, seasonId, forecastCalendarPolicy(14));
    const teamed = catalog.filter(player => player.teamAbbreviation);
    const indexOf = (player: PlanningPlayer) => (player.nhlId! - 8470000) % 100;
    const lineupSkater = (player: PlanningPlayer) => player.playerClass === "skater" && indexOf(player) < LINEUP;
    // Full coverage with the pass off: a real line or a labelled 0 for every rostered player's every game, within budget.
    const opportunities = teamed.reduce((sum, player) => sum + games.filter(game => game.teamAbbreviation === player.teamAbbreviation).length, 0);
    expect(built.forecasts).toHaveLength(opportunities);
    expect(built.forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0)).toBeLessThanOrEqual(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET);
    const roster = [...teamed.filter(lineupSkater).filter((_, index) => index % 30 === 0).slice(0, 17),
      ...teamed.filter(player => player.playerClass === "goalie" && indexOf(player) === SKATERS).slice(0, 2)];
    const scratched = teamed.find(player => player.playerClass === "skater" && indexOf(player) >= LINEUP && !roster.includes(player))!;
    expect(built.forecasts.filter(row => row.playerId === scratched.id).every(row => reserveCodeOf(row) === "skater:no_forge_line")).toBe(true);
    const others = teamed.filter(player => !roster.includes(player) && player !== scratched && player.playerClass === "skater" && indexOf(player) < LINEUP)
      .filter((_, index) => index % 2 === 0).slice(0, 242);
    const owned = new Set([...roster, scratched, ...others].map(player => player.id));
    const free = new Set(teamed.filter(player => !owned.has(player.id)).slice(0, 815).map(player => player.id));
    const players = catalog.map(player => ({ ...player, eligibilityVerified: owned.has(player.id) || free.has(player.id),
      canDrop: owned.has(player.id) ? true : player.canDrop,
      availability: free.has(player.id) ? "free_agent" as const : owned.has(player.id) ? "rostered" as const : "unknown" as const }));
    const { wire } = compactBridgeForecasts(built.forecasts, { players, games }, seasonId);
    const revisions = [...new Set(built.forecasts.map(row => row.revisionId))].sort();
    const data: PlanningData = { players, games, forecasts: [], baselineSources: [], participationSources: [],
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId, completeness: "complete", limitations: [] } },
      forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId, asOf: now.toISOString(),
        scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: revisions, baselineChecksum: null,
        requiredOpportunities: built.forecasts.length, forecastedOpportunities: built.forecasts.length, exclusionCounts: {},
        rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: revisions } } };
    const body = fitBridgeWire(wire, value => ({ success: true, data, ...(value ? { bridgeForecasts: value } : {}) }), PLANNING_RESPONSE_BYTE_BUDGET)!;
    const intent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk" as const,
      goalieWindow: "any" as const, goalieSplit: "mon_wed" as const, alternativeCount: 5 as const, objective: "outcome" as const };
    // Goalie wins need team-strength priors this fixture lacks, so the league scores skater heads and saves.
    const snapshot: PlanningSnapshot = { id: "snap",
      context: { provider: "manual", seasonId, leagueId: "l", teamId: "t", startDate: "2026-10-27", endDate: "2026-11-02", timeZone: "UTC", asOf: now.toISOString() },
      players, games, forecasts: [], roster: [...roster, scratched].map(player => ({ playerId: player.id, position: "active" as const })),
      lockedAssignments: [], realized: {}, opponent: null,
      rules: { lineupMode: "daily", rosterSlots: { C: 6, D: 4, UTIL: 1, G: 2, BN: 7 }, acquisitionTiming: "next_day", acquisitionCost: 1,
        periods: [{ id: "w", start: "2026-10-26T00:00:00.000Z", end: "2026-11-03T00:00:00.000Z", remaining: 4, source: "provider" }],
        scoring: { mode: "points", weights: { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.4, HITS: 0.2, BLOCKED_SHOTS: 0.3, SAVES_GOALIE: 0.2 }, categories: [] },
        goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId, completeness: "complete", limitations: [] } } };
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => JSON.parse(JSON.stringify({ ...body,
      read: { nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now.toISOString() } })) }) as Response));
    try {
      const result = await withCurrentPlanningRead(snapshot, {}, currentRsoUsePolicy().revision, new AbortController().signal, (input, _data, readError) => {
        expect(readError).toBeNull();
        return { baseline: evaluatePlan(input, intent, "outcome", [], false), metrics: candidatePlanMetrics(input, intent, { maxCandidates: 8, maxEvaluations: 24 }) };
      });
      expect(result.baseline.comparisonEligible).toBe(true);
      expect(result.baseline.projectedValue).toBeGreaterThan(0);
      // Every evaluated candidate gets net points again (bounded here to keep the test fast; production evaluates 40).
      expect(result.metrics.search.candidates).toBe(8);
      expect(result.metrics.activePoints.filter(([, value]) => value != null)).toHaveLength(8);
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  }, 60000);
});

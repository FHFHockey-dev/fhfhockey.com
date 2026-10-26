import { describe, expect, it } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import type { GameForecast } from "lib/rosterScheduleOptimizer/planningTypes";
import { compactBridgeForecasts, expandBridgeForecasts, jsonUtf8Bytes, PLANNING_RESPONSE_BYTE_BUDGET, reserveCodeOf } from "./bridgeForecastWire";
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

  it("keeps the 4 MB expanded budget with the reserve pass off, and uses 6 MB only with it on", () => {
    expect(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET).toBe(4_000_000);
    expect(FORGE_RESERVE_EXPANDED_BYTE_BUDGET).toBe(6_000_000);
    // Two weeks of lineup rows alone exceed 4 MB, so the default budget decides how many are kept.
    const { players, games, inputs } = league(14);
    const kept = (reserves: ForgeDailyBridgeInputs["reserves"]) => {
      const { forecasts } = buildForgeDailyBridgeForecasts({ ...inputs, reserves }, players, games, now, seasonId, forecastCalendarPolicy(15));
      return forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0);
    };
    const off = kept(undefined), on = kept([]);
    expect(off).toBeLessThanOrEqual(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET);
    expect(off).toBeGreaterThan(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET - 3000);
    // With the pass on, every lineup row (about 5.9 MB here) is kept under the 6 MB budget.
    expect(on).toBeGreaterThan(FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET);
    expect(on).toBeLessThanOrEqual(FORGE_RESERVE_EXPANDED_BYTE_BUDGET);
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
});

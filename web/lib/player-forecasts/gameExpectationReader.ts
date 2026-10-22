import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlanningData, parsePlanningDataQuery } from "../rosterScheduleData/planning";
import { buildGameExpectations, type GameExpectationScope } from "./gameExpectations";
import type { ForecastServingSource } from "./forecastServingSource";

/** Calendar windows cover at most 21 days; next-N discovery is bounded to 60 days. */
export function parseGameExpectationScope(query: Record<string, unknown>, now = new Date()): GameExpectationScope {
  const range = parsePlanningDataQuery(query);
  const mode = query.mode ?? "next_n";
  const rawGames = query.games ?? "1";
  if (mode !== "next_n" && mode !== "calendar" || typeof rawGames !== "string" || !/^(?:[1-9]|1[0-9]|20)$/.test(rawGames)) {
    throw new Error("Choose next_n or calendar and 1–20 scheduled team games.");
  }
  const days = (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 + 1;
  if (days > (mode === "calendar" ? 21 : 60)) throw new Error("Forecast read range exceeds the selected mode's bound.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: range.timeZone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (mode === "next_n" && (range.startDate > today || range.endDate < today)) {
    throw new Error("Next-N discovery must include today's date; use calendar mode for a future window.");
  }
  const ids = query.playerIds;
  const playerIds = typeof ids === "string" ? ids.split(",") : undefined;
  if (ids !== undefined && (!playerIds || !playerIds.length || playerIds.length > 50
    || playerIds.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    || new Set(playerIds).size !== playerIds.length)) throw new Error("Provide up to 50 distinct canonical player IDs.");
  return { ...range, timeZone: range.timeZone ?? "UTC", mode, games: Number(rawGames), ...(playerIds ? { playerIds } : {}) };
}

/** Shared server entry point for FORGE/consumer adapters. No generation, writes or private artifact reads. */
export async function loadGameExpectations(db: SupabaseClient<any>, scope: GameExpectationScope, now = new Date(),
  options: { source?: ForecastServingSource } = {}) {
  const data = await loadPlanningData(db, scope, { now, skipOwnership: true, skipRecentForm: true, source: options.source, consumer: "start_chart" });
  return buildGameExpectations(data, scope, now);
}

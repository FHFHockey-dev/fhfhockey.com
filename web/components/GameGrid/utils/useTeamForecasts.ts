import { useEffect, useState } from "react";
import { z } from "zod";
import type { GameData } from "lib/NHL/types";
import { TEAM_FORECAST_CATEGORIES, type TeamForecastContext, type TeamForecastRecord } from "./teamForecasts";
import type { ScheduleArray } from "./useSchedule";

const text = z.string().min(1);
const instant = z.string().datetime({ offset: true });
// Accept explicit existing presentation-contract fields only. Legacy component
// goals/shots, research artifacts and player aggregates grant no serving use.
const recordSchema = z.object({
  teamId: z.number().int().positive(), gameId: z.number().int().positive(), seasonId: z.number().int().positive(),
  category: z.enum(TEAM_FORECAST_CATEGORIES), mean: z.number().finite().nonnegative().nullable(),
  unit: text, scope: text, conditioning: text, creditDefinition: text,
  rosterScope: z.enum(["skaters", "all_players"]), rosterRevision: text, scheduleRevision: text,
  startsAt: instant, status: z.enum(["qualified", "unavailable"]),
  allowedUses: z.object({ totals: z.boolean(), comparison: z.boolean() }),
  revisionId: text, modelVersion: text, comparisonLineageId: text, sourceWatermark: text,
  sourceAvailableAt: instant, cutoffAt: instant, issuedAt: instant, availableAt: instant, expiresAt: instant,
  limitations: z.array(z.string()).optional(),
});

const contextSchema = z.object({
  seasonId: z.number().int().positive(), scheduleRevision: text, rosterRevision: text,
  rosterScope: z.enum(["skaters", "all_players"]), games: z.array(z.object({
    gameId: z.number().int().positive(), startsAt: instant,
    state: z.enum(["scheduled", "started", "completed", "postponed", "cancelled"]),
  })).max(100),
});

export function decodeTeamForecastResponse(payload: unknown, games: readonly GameData[]) {
  const envelope = z.object({ asOfDate: text, horizonGames: z.literal(1), runId: text,
    data: z.array(z.unknown()).max(2000), context: contextSchema.optional() }).parse(payload);
  const records: TeamForecastRecord[] = [];
  let rejected = 0;
  for (const value of envelope.data) {
    const parsed = recordSchema.safeParse(value);
    if (!parsed.success || parsed.data.comparisonLineageId !== envelope.runId) { rejected++; continue; }
    if (games.some(game => game.id === parsed.data.gameId &&
      [game.homeTeam.id, game.awayTeam.id].includes(parsed.data.teamId))) records.push(parsed.data);
  }
  const contexts: Record<number, TeamForecastContext> = {};
  if (envelope.context) {
    for (const teamId of [...new Set(records.map(record => record.teamId))]) {
      contexts[teamId] = envelope.context;
    }
  }
  // Never manufacture a matching schedule/roster context from the forecasts
  // themselves. Current legacy rows do not supply this qualification evidence.
  return { records, contexts, inspected: envelope.data.length, rejected, asOfDate: envelope.asOfDate };
}

type ReaderState = {
  key: string; status: "loading" | "ready" | "error"; checkedAt: string;
  records: TeamForecastRecord[]; contexts: Record<number, TeamForecastContext>;
  inspected: number; rejected: number;
};
const empty: Pick<ReaderState, "records" | "contexts" | "inspected" | "rejected"> = { records: [], contexts: {}, inspected: 0, rejected: 0 };

/** One bounded read of the existing public team endpoint; no producer or player fallback. */
export default function useTeamForecasts(schedule: ScheduleArray, enabled: boolean, snapshotKey: string) {
  const [refresh, setRefresh] = useState(0);
  const now = new Date().toISOString();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const games = [...new Map(schedule.flatMap(row => Object.values(row).filter((game): game is GameData =>
    typeof game === "object" && game !== null && "id" in game)).map(game => [game.id, game])).values()]
    .sort((a, b) => a.id - b.id);
  const gameKey = JSON.stringify(games.map(game => [game.id, game.season, game.gameDate, game.startTimeUTC,
    game.gameState, game.gameScheduleState, game.homeTeam.id, game.awayTeam.id]));
  const key = `${date}/${snapshotKey}/${gameKey}/${refresh}/${enabled}`;
  const [state, setState] = useState<ReaderState>({ key: "", status: "loading", checkedAt: now, ...empty });
  useEffect(() => {
    if (!enabled || !games.length) return;
    const controller = new AbortController();
    let ignore = false;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    setState({ key, status: "loading", checkedAt: new Date().toISOString(), ...empty });
    void (async () => {
      const response = await fetch(`/api/v1/projections/teams?date=${date}&horizon=1`, { signal: controller.signal });
      if (!response.ok) throw new Error("Team forecast reader unavailable.");
      const decoded = decodeTeamForecastResponse(await response.json(), games);
      if (decoded.asOfDate !== date) throw new Error("Team forecast reader date does not match.");
      if (!ignore) setState({ key, status: "ready", checkedAt: new Date().toISOString(), ...decoded });
    })().catch(() => {
      if (!ignore) setState({ key, status: "error", checkedAt: new Date().toISOString(), ...empty });
    }).finally(() => clearTimeout(timeout));
    return () => { ignore = true; clearTimeout(timeout); controller.abort(); };
    // games are canonicalized in gameKey; table sorting never changes this read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!enabled) return;
    // Recheck at puck drop/expiry and at most five minutes between checks.
    // Timer invalidation removes elapsed values even if the next read fails.
    const checkAt = Date.now();
    const boundaries = [...games.map(game => Date.parse(game.startTimeUTC ?? "")),
      ...state.records.map(record => Date.parse(record.expiresAt))].filter(at => at > checkAt);
    const delay = Math.max(1, Math.min(300_000, ...boundaries.map(at => at - checkAt)));
    const timer = setTimeout(() => setRefresh(value => value + 1), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameKey, state.records, refresh]);
  const current = state.key === key;
  if (enabled && !games.length) return { key, status: "ready" as const, checkedAt: now, ...empty, retry: () => setRefresh(value => value + 1) };
  return { ...(current ? state : { key, status: "loading" as const, checkedAt: now, ...empty }),
    checkedAt: now, retry: () => setRefresh(value => value + 1) };
}

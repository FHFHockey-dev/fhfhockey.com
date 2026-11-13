import { z } from "zod";
import type { GoalieGridReader } from "./useGoalieGameView";
import { decodeGoalieGridSnapshot } from "./useGoalieGameView";
import type { GoalieWorkloadSnapshot } from "./goalieWorkloadView";

const timestamp = z.string().datetime({ offset: true }), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id = z.number().int().positive();
const count = z.number().finite().nonnegative().nullable();
const historySchema = z.object({
  version: z.literal("goalie-workload-view-v1"), seasonId: id, seasonStartsOn: date, teamId: id,
  source: z.string().min(1), revision: z.string().min(1), observedAt: timestamp, dataThrough: date.nullable(),
  basis: z.literal("current_recorded_results"), coverageBasis: z.literal("stored_regular_season_schedule"),
  scheduleVerifiedThrough: date, scheduleComplete: z.boolean(), appearancesComplete: z.boolean(),
  scheduleCoverage: z.object({ version: z.literal("stored-team-schedule-v1"), from: date, through: date,
    scheduledGames: z.number().int().nonnegative().max(100),
    gaps: z.array(z.object({ gameId: id, date, reason: z.enum(["unreported", "not_final"]) })).max(100) }).optional(),
  games: z.array(z.object({ gameId: id, team: z.string().min(1), date, seasonId: id, state: z.literal("final"), completedAt: timestamp.nullable(),
    finality: z.object({ basis: z.literal("single_stored_game_end"), observedAt: timestamp }) })).max(100),
  appearances: z.array(z.object({ goalieId: id, name: z.string().nullable(), gameId: id, date, team: z.string().min(1),
    opponent: z.string().nullable(), home: z.boolean().nullable(), started: z.boolean().nullable(),
    wins: count, losses: count, otLosses: count, saves: count, shotsAgainst: count, goalsAgainst: count, toiSeconds: count, shutouts: count, qualityStart: count })).max(400),
});
export type GoalieWorkloadReader = (request: { teamId: number; seasonId: number; through: string }, signal: AbortSignal) => Promise<GoalieWorkloadSnapshot>;

async function read(params: URLSearchParams, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/v1/forge/goalies?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Goalie source unavailable.");
  return response.json();
}

/** The server supplies its own schedule identities; the client key only guards this request's lifetime. */
export const readGoalieGrid: GoalieGridReader = async ({ games, contextKey }, signal) => {
  const dates = [...new Set(games.filter(game => Date.parse(game.startTimeUTC ?? "") > Date.now()
    && ["FUT", "PRE"].includes(game.gameState ?? "") && game.gameScheduleState === "OK").map(game => game.gameDate)
    .filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
  if (!dates.length) return { version: "goalie-grid-v1", contextKey, boards: [] };
  const lastAllowed = new Date(`${dates[0]}T00:00:00Z`);
  lastAllowed.setUTCDate(lastAllowed.getUTCDate() + 9);
  const requestedRange = { from: dates[0], through: [dates.at(-1)!, lastAllowed.toISOString().slice(0, 10)].sort()[0] };
  const raw = await read(new URLSearchParams({ view: "game-grid", ...requestedRange }), signal);
  if (!raw || typeof raw !== "object") throw new Error("Invalid goalie response.");
  return decodeGoalieGridSnapshot({ ...raw, contextKey, requestedRange });
};

export const readGoalieWorkload: GoalieWorkloadReader = async (request, signal) => {
  const raw = await read(new URLSearchParams({ view: "game-grid-workload", teamId: String(request.teamId), season: String(request.seasonId), through: request.through }), signal);
  const snapshot = historySchema.parse(raw);
  if (snapshot.teamId !== request.teamId || snapshot.seasonId !== request.seasonId || snapshot.scheduleVerifiedThrough !== request.through)
    throw new Error("Historical source does not match the requested team, season and cutoff.");
  return snapshot;
};

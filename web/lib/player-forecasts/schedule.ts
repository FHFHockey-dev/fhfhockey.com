import crypto from "crypto";

import { PLAYER_FORECAST_MAX_HORIZON } from "./contracts";
import { forecastCalendarPolicy } from "./contributions";

export type PlayerForecastScheduleGame = {
  id: number;
  seasonId: number;
  date: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
  type: number | null;
  /** Present on operational reads, absent on legacy pure schedule inputs. */
  scheduleEvidence?: {
    status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
    fetchedAt: string;
    teams: Array<{ teamId: number; abbreviation: string; revision: string }>;
  };
};

export type PlayerForecastGameScope = {
  scopeKey: string;
  gameId: number;
  teamId: number;
  opponentTeamId: number;
  teamGameHorizon: number;
  scheduledStartAt: string;
  gameDate: string;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
  scheduleRevision?: string;
  teamAbbreviation?: string;
};

export const PLAYER_FORECAST_CALENDAR_HORIZON_DAYS = forecastCalendarPolicy().calendarDays;
export const PLAYER_FORECAST_CALENDAR_COMPARISON_DAYS = [7, 14, 21] as const;

export type PlayerForecastCalendarScope = PlayerForecastGameScope & {
  calendarLeadDay: number;
  queueCompatible: boolean;
};

export function regularSeasonForDate(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 7 ? year * 10000 + year + 1 : (year - 1) * 10000 + year;
}

/** A UTC calendar scope is separate from the existing next-ten-team-games scope. */
export function buildCalendarGameScopes(args: {
  games: PlayerForecastScheduleGame[];
  now?: Date;
  days?: number;
  teamId?: number;
}): PlayerForecastCalendarScope[] {
  const now = args.now ?? new Date();
  const days = args.days ?? PLAYER_FORECAST_CALENDAR_HORIZON_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 21) throw new RangeError("Calendar horizon must be 1–21 days.");
  const firstDay = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const lastDay = firstDay + days * 86_400_000;
  const eligible = args.games.filter((game) => {
    const start = parsePlayerForecastGameStart(game.startTime, game.date);
    const startMs = start ? Date.parse(start) : NaN;
    return (!game.scheduleEvidence || game.scheduleEvidence.status === "scheduled")
      && game.type === 2 && game.seasonId === regularSeasonForDate(game.date) &&
      startMs >= firstDay && startMs < lastDay && startMs > now.getTime() &&
      game.homeTeamId !== game.awayTeamId;
  });
  // The ordinal is measured over the eligible team schedule, never over calendar days.
  const ordered = eligible.sort((a, b) =>
    (parsePlayerForecastGameStart(a.startTime, a.date) ?? "").localeCompare(
      parsePlayerForecastGameStart(b.startTime, b.date) ?? "",
    ) || a.id - b.id);
  const ordinals = new Map<number, number>();
  const scopes: PlayerForecastCalendarScope[] = [];
  for (const game of ordered) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (args.teamId != null && args.teamId !== teamId) continue;
      const teamGameHorizon = (ordinals.get(teamId) ?? 0) + 1;
      ordinals.set(teamId, teamGameHorizon);
      scopes.push({
        scopeKey: `game:${game.id}:team:${teamId}`,
        gameId: game.id,
        teamId,
        opponentTeamId: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
        teamGameHorizon,
        calendarLeadDay: Math.floor((Date.parse(parsePlayerForecastGameStart(game.startTime, game.date)!) - firstDay) / 86_400_000),
        queueCompatible: teamGameHorizon <= PLAYER_FORECAST_MAX_HORIZON,
        scheduledStartAt: parsePlayerForecastGameStart(game.startTime, game.date)!,
        gameDate: game.date,
        seasonId: game.seasonId,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        scheduleRevision: game.scheduleEvidence?.teams.find(team => team.teamId === teamId)?.revision,
        teamAbbreviation: game.scheduleEvidence?.teams.find(team => team.teamId === teamId)?.abbreviation,
      });
    }
  }
  return scopes.sort((a, b) => a.teamId - b.teamId || a.teamGameHorizon - b.teamGameHorizon);
}

export function parsePlayerForecastGameStart(
  startTime: string | null | undefined,
  gameDate: string,
): string | null {
  if (!startTime) return null;
  const direct = Date.parse(startTime);
  if (Number.isFinite(direct)) return new Date(direct).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return null;
  const normalized = startTime.trim();
  if (!normalized) return null;
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const parsed = Date.parse(
    `${gameDate}T${normalized}${hasTimeZone ? "" : "Z"}`,
  );
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function buildNextTenGameScopes(args: {
  games: PlayerForecastScheduleGame[];
  now?: Date;
  teamId?: number;
}): PlayerForecastGameScope[] {
  const nowMs = (args.now ?? new Date()).getTime();
  const games = args.games
    .flatMap((game) => {
      if (game.scheduleEvidence && game.scheduleEvidence.status !== "scheduled"
          || game.type !== 2 || game.seasonId !== regularSeasonForDate(game.date) ||
          game.homeTeamId === game.awayTeamId) return [];
      const scheduledStartAt = parsePlayerForecastGameStart(
        game.startTime,
        game.date,
      );
      if (!scheduledStartAt || Date.parse(scheduledStartAt) <= nowMs) return [];
      return [{ game, scheduledStartAt }];
    })
    .sort((left, right) =>
      left.scheduledStartAt === right.scheduledStartAt
        ? left.game.id - right.game.id
        : left.scheduledStartAt.localeCompare(right.scheduledStartAt),
    );

  const byTeam = new Map<
    number,
    Array<{ game: PlayerForecastScheduleGame; scheduledStartAt: string }>
  >();
  for (const entry of games) {
    for (const teamId of [entry.game.homeTeamId, entry.game.awayTeamId]) {
      if (args.teamId != null && teamId !== args.teamId) continue;
      const teamGames = byTeam.get(teamId) ?? [];
      teamGames.push(entry);
      byTeam.set(teamId, teamGames);
    }
  }

  return Array.from(byTeam.entries())
    .flatMap(([teamId, teamGames]) =>
      teamGames.slice(0, PLAYER_FORECAST_MAX_HORIZON).map((entry, index) => ({
        scopeKey: `game:${entry.game.id}:team:${teamId}`,
        gameId: entry.game.id,
        teamId,
        opponentTeamId:
          entry.game.homeTeamId === teamId
            ? entry.game.awayTeamId
            : entry.game.homeTeamId,
        teamGameHorizon: index + 1,
        scheduledStartAt: entry.scheduledStartAt,
        gameDate: entry.game.date,
        seasonId: entry.game.seasonId,
        homeTeamId: entry.game.homeTeamId,
        awayTeamId: entry.game.awayTeamId,
      })),
    )
    .sort((left, right) =>
      left.teamId === right.teamId
        ? left.teamGameHorizon - right.teamGameHorizon
        : left.teamId - right.teamId,
    );
}

export function scheduleRevisionHash(scope: PlayerForecastGameScope): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        gameId: scope.gameId,
        scheduledStartAt: scope.scheduledStartAt,
        gameDate: scope.gameDate,
        homeTeamId: scope.homeTeamId,
        awayTeamId: scope.awayTeamId,
      }),
    )
    .digest("hex");
}

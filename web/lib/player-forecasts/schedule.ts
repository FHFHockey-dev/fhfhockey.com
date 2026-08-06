import crypto from "crypto";

import { PLAYER_FORECAST_MAX_HORIZON } from "./contracts";

export type PlayerForecastScheduleGame = {
  id: number;
  seasonId: number;
  date: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
  type: number | null;
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
};

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


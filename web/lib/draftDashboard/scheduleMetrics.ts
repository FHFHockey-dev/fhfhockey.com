import type { GameData } from "lib/NHL/types";

export type DashboardMatchupWeek = { week: number; start_date: string; end_date: string };
export type ScheduleMetrics = { games: number; off: number; b2b: number };
export type PlayerScheduleMetrics = ReadonlyMap<string, ScheduleMetrics>;

export function shiftScheduleDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function normalizeScheduleSettings(settings: {
  playoffWeeks?: number[]; scheduleScope?: "season" | "playoffs";
}) {
  const playoffWeeks = [...new Set(Array.isArray(settings.playoffWeeks)
    ? settings.playoffWeeks.filter((week) => Number.isInteger(week) && week > 0)
    : [])].sort((a, b) => a - b);
  return {
    playoffWeeks,
    scheduleScope: settings.scheduleScope === "playoffs" && playoffWeeks.length
      ? "playoffs" as const : "season" as const,
  };
}

/** Count NHL opportunities, not predicted player/goalie appearances. */
export function calculateScheduleMetrics(
  source: readonly GameData[], weeks: readonly DashboardMatchupWeek[],
): Map<number, ScheduleMetrics> {
  const games = [...new Map(source.map((game) => [game.id, game])).values()]
    .filter((game) => game.gameType === 2 && game.gameDate &&
      !["PPD", "CNCL", "CANCELLED", "POSTPONED"].includes(game.gameScheduleState ?? "") &&
      !["PPD", "CNCL", "CANCELLED", "POSTPONED"].includes(game.gameState ?? ""));
  const daily = new Map<string, number>();
  const dates = new Map<number, Set<string>>();
  for (const game of games) {
    const date = game.gameDate!;
    daily.set(date, (daily.get(date) ?? 0) + 1);
    for (const team of [game.homeTeam.id, game.awayTeam.id]) {
      if (!dates.has(team)) dates.set(team, new Set());
      dates.get(team)!.add(date);
    }
  }
  const result = new Map<number, ScheduleMetrics>();
  for (const [team, teamDates] of dates) {
    const metrics = { games: 0, off: 0, b2b: 0 };
    for (const date of teamDates) {
      if (!weeks.some((week) => date >= week.start_date && date <= week.end_date)) continue;
      metrics.games++;
      if ((daily.get(date) ?? 0) <= 8) metrics.off++;
      if (teamDates.has(shiftScheduleDate(date, -1))) metrics.b2b++;
    }
    result.set(team, metrics);
  }
  return result;
}

export function totalRosterScheduleMetrics(
  playerIds: readonly string[], metrics?: PlayerScheduleMetrics,
): ScheduleMetrics | null {
  const total = { games: 0, off: 0, b2b: 0 };
  for (const id of new Set(playerIds)) {
    const player = metrics?.get(id);
    if (!player) return null;
    total.games += player.games;
    total.off += player.off;
    total.b2b += player.b2b;
  }
  return metrics ? total : null;
}

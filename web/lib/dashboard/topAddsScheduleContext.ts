import { parseISO, startOfWeek } from "date-fns";

import type { ScheduleArray } from "components/GameGrid/utils/useSchedule";
import { DAYS, type DAY_ABBREVIATION } from "lib/NHL/types";
import { isRegularSeasonOrPlayoffGameType } from "lib/NHL/playoffs";
import { teamsInfo } from "lib/teamsInfo";

export type TopAddsScheduleContext = {
  teamAbbr: string;
  gamesRemaining: number;
  offNightsRemaining: number;
  summaryLabel: string;
};

export type TopAddsScheduleContextMap = Record<string, TopAddsScheduleContext>;

const OFF_NIGHT_GAME_THRESHOLD = 8;

function resolveSelectedDayIndex(selectedDate: string): number {
  const date = parseISO(selectedDate);
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const diffDays = Math.floor(
    (date.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (!Number.isFinite(diffDays)) return 0;
  return Math.max(0, Math.min(DAYS.length - 1, diffDays));
}

function getTeamAbbr(teamId: number): string | null {
  const match = Object.values(teamsInfo).find((team) => team.id === teamId);
  return match?.abbrev ?? null;
}

export function buildTopAddsScheduleContextMap(
  scheduleArray: ScheduleArray,
  numGamesPerDay: number[],
  selectedDate: string
): TopAddsScheduleContextMap {
  if (!Array.isArray(scheduleArray) || scheduleArray.length === 0) return {};

  const selectedDayIndex = resolveSelectedDayIndex(selectedDate);
  const remainingDays = DAYS.slice(selectedDayIndex);

  return scheduleArray.reduce<TopAddsScheduleContextMap>((acc, row) => {
    const teamAbbr = getTeamAbbr(row.teamId);
    if (!teamAbbr) return acc;

    let gamesRemaining = 0;
    let offNightsRemaining = 0;

    remainingDays.forEach((dayKey, offset) => {
      const game = row[dayKey as DAY_ABBREVIATION];
      if (!game || !isRegularSeasonOrPlayoffGameType(game.gameType)) return;

      gamesRemaining += 1;

      const gamesOnDay = numGamesPerDay[selectedDayIndex + offset] ?? 0;
      if (gamesOnDay <= OFF_NIGHT_GAME_THRESHOLD) {
        offNightsRemaining += 1;
      }
    });

    acc[teamAbbr] = {
      teamAbbr,
      gamesRemaining,
      offNightsRemaining,
      summaryLabel: `${gamesRemaining}G • ${offNightsRemaining} off`
    };
    return acc;
  }, {});
}

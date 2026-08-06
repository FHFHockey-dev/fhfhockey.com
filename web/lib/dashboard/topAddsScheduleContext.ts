import { differenceInCalendarDays, parseISO, startOfWeek } from "date-fns";

import type { ScheduleArray } from "components/GameGrid/utils/useSchedule";
import { DAYS, type DAY_ABBREVIATION } from "lib/NHL/types";
import { isRegularSeasonOrPlayoffGameType } from "lib/NHL/playoffs";
import {
  resolveCanonicalTeamIdentityForSource,
  resolveScheduleGameTeamIdentity,
} from "lib/NHL/seasonAwareScheduleTeam";

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
  const diffDays = differenceInCalendarDays(date, monday);

  if (!Number.isFinite(diffDays)) return 0;
  return Math.max(0, Math.min(DAYS.length - 1, diffDays));
}

function isEligibleGameForSeason(
  game: ScheduleArray[number][DAY_ABBREVIATION],
  selectedSeasonId: number,
): game is NonNullable<ScheduleArray[number][DAY_ABBREVIATION]> {
  return Boolean(
    game &&
    game.season === selectedSeasonId &&
    isRegularSeasonOrPlayoffGameType(game.gameType),
  );
}

function buildEligibleGameCountsByDay(
  scheduleArray: ScheduleArray,
  selectedSeasonId: number,
): number[] {
  return DAYS.map((dayKey) => {
    const gameIds = new Set<number>();
    scheduleArray.forEach((row) => {
      const game = row[dayKey as DAY_ABBREVIATION];
      if (
        !isEligibleGameForSeason(game, selectedSeasonId) ||
        (game.homeTeam.id !== row.teamId && game.awayTeam.id !== row.teamId)
      ) {
        return;
      }
      gameIds.add(game.id);
    });
    return gameIds.size;
  });
}

export function buildTopAddsScheduleContextMap(
  scheduleArray: ScheduleArray,
  _numGamesPerDay: number[],
  selectedDate: string,
  selectedSeasonId: number,
): TopAddsScheduleContextMap {
  if (!Array.isArray(scheduleArray) || scheduleArray.length === 0) return {};

  const selectedDayIndex = resolveSelectedDayIndex(selectedDate);
  const remainingDays = DAYS.slice(selectedDayIndex);
  const eligibleGameCountsByDay = buildEligibleGameCountsByDay(
    scheduleArray,
    selectedSeasonId,
  );

  return scheduleArray.reduce<TopAddsScheduleContextMap>((acc, row) => {
    const sourceIdentity = resolveScheduleGameTeamIdentity(
      row.teamId,
      selectedSeasonId,
    );
    const canonicalIdentity = sourceIdentity
      ? resolveCanonicalTeamIdentityForSource(sourceIdentity)
      : null;
    if (!sourceIdentity || !canonicalIdentity) return acc;

    let gamesRemaining = 0;
    let offNightsRemaining = 0;

    remainingDays.forEach((dayKey, offset) => {
      const game = row[dayKey as DAY_ABBREVIATION];
      if (
        !isEligibleGameForSeason(game, selectedSeasonId) ||
        (game.homeTeam.id !== row.teamId && game.awayTeam.id !== row.teamId)
      ) {
        return;
      }

      gamesRemaining += 1;

      const gamesOnDay =
        eligibleGameCountsByDay[selectedDayIndex + offset] ?? 0;
      if (gamesOnDay <= OFF_NIGHT_GAME_THRESHOLD) {
        offNightsRemaining += 1;
      }
    });

    acc[canonicalIdentity.abbreviation] = {
      teamAbbr: canonicalIdentity.abbreviation,
      gamesRemaining,
      offNightsRemaining,
      summaryLabel: `${gamesRemaining}G • ${offNightsRemaining} off`,
    };
    return acc;
  }, {});
}

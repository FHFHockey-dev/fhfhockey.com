import { DAYS, EXTENDED_DAY_ABBREVIATION, WeekData } from "lib/NHL/types";
import { calcTotalOffNights, calcWeightedOffNights, getTotalGamePlayed } from "./helper";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";
import calcWeekScore from "./calcWeekScore";

/** Repeated opponents count once per included regular-season game. */
export function getSelectedOpponentIds(
  row: WeekData & { teamId: number },
  excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS
) {
  return days.flatMap((day) => {
    const game = row[day];
    if (excludedDays.includes(day) || game?.gameType !== 2) return [];
    return [game.homeTeam.id === row.teamId ? game.awayTeam.id : game.homeTeam.id];
  });
}

/** Every score input uses the same visible horizon and included-day selection. */
export function getTeamScheduleSummary(
  row: WeekData & { teamId: number },
  regularGamesPerDay: number[],
  excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS
) {
  const totalGamesPlayed = getTotalGamePlayed(row, excludedDays, days);
  const totalOffNights = calcTotalOffNights(row, regularGamesPerDay, excludedDays, days);
  const weightedOffNights = calcWeightedOffNights(row, regularGamesPerDay, excludedDays, days);
  const winOdds = convertTeamRowToWinOddsList({ ...row, weekNumber: 1 }, excludedDays, days);
  const totalLeagueGames = days.reduce((sum, day, i) =>
    sum + (excludedDays.includes(day) ? 0 : regularGamesPerDay[i] ?? 0), 0);

  return {
    totalGamesPlayed,
    totalOffNights,
    weekScore: calcWeekScore(winOdds, weightedOffNights, totalLeagueGames, totalGamesPlayed)
  };
}

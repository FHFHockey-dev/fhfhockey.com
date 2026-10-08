import { DAYS, EXTENDED_DAY_ABBREVIATION, TeamDataWithTotals, WeekData } from "lib/NHL/types";
import { calcTotalOffNights, getTotalGamePlayed, isRegularScheduleGame } from "./helper";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";
import calcWeekScore, { calculateSlateCrowding, calculateMatchupBonus, WEEK_SCORE_VERSION } from "./calcWeekScore";

/** Keep missing standings separate from genuine zero points percentages. */
export function getOpponentPointPct(
  opponents: { teamId: number }[],
  pointPctByTeamId: Record<number, number>
) {
  const values = opponents.map(({ teamId }) => pointPctByTeamId[teamId])
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  return {
    value: values.length > 0 && values.length === opponents.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    coverage: { known: values.length, expected: opponents.length }
  };
}

/** The OPP baseline is a mean of complete observed rows, not zero-filled rows. */
export function getFourWeekAverages(teams: TeamDataWithTotals[]) {
  const completeTeams = teams.filter((team) => !team.totals.scheduleCoverage ||
    team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected);
  const opponentValues = completeTeams.map((team) => team.avgOpponentPointPct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1);
  return {
    gamesPlayed: completeTeams.length ? completeTeams.reduce((sum, team) => sum + team.totals.gamesPlayed, 0) / completeTeams.length : null,
    offNights: completeTeams.length ? completeTeams.reduce((sum, team) => sum + team.totals.offNights, 0) / completeTeams.length : null,
    avgOpponentPointPct: opponentValues.length
      ? opponentValues.reduce((sum, value) => sum + value, 0) / opponentValues.length : null,
    score: completeTeams.length ? 0 : null
  };
}

export function getFourWeekScore(team: TeamDataWithTotals, averages: ReturnType<typeof getFourWeekAverages>) {
  if (averages.gamesPlayed == null || averages.offNights == null ||
      (team.totals.scheduleCoverage && team.totals.scheduleCoverage.known < team.totals.scheduleCoverage.expected)) return null;
  const opponentContribution = team.avgOpponentPointPct != null && Number.isFinite(team.avgOpponentPointPct) && averages.avgOpponentPointPct != null
    ? averages.avgOpponentPointPct - team.avgOpponentPointPct : 0;
  return team.totals.gamesPlayed - averages.gamesPlayed +
    team.totals.offNights - averages.offNights + opponentContribution;
}

/** Repeated opponents count once per included regular-season game. */
export function getSelectedOpponentIds(
  row: WeekData & { teamId: number },
  excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS
) {
  return days.flatMap((day) => {
    const game = row[day];
    if (excludedDays.includes(day) || !isRegularScheduleGame(game)) return [];
    return [game.homeTeam.id === row.teamId ? game.awayTeam.id : game.homeTeam.id];
  });
}

/** Every score input uses the same visible horizon and included-day selection. */
export function getTeamScheduleSummary(
  row: WeekData & { teamId: number },
  regularGamesPerDay: number[],
  excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS,
  coveredDays?: readonly boolean[]
) {
  const totalGamesPlayed = getTotalGamePlayed(row, excludedDays, days);
  const totalOffNights = calcTotalOffNights(row, regularGamesPerDay, excludedDays, days);
  const winOdds = convertTeamRowToWinOddsList({ ...row, weekNumber: 1 }, excludedDays, days);
  const totalLeagueGames = days.reduce((sum, day, i) =>
    sum + (excludedDays.includes(day) ? 0 : regularGamesPerDay[i] ?? 0), 0);
  const scheduleComplete = days.every((day, i) => excludedDays.includes(day) || coveredDays?.[i] === true);
  const slateCounts = days.flatMap((day, i) =>
    excludedDays.includes(day) || !isRegularScheduleGame(row[day]) ? [] :
      [coveredDays?.[i] ? regularGamesPerDay[i] : null]);
  const crowding = calculateSlateCrowding(slateCounts, totalGamesPlayed, scheduleComplete);

  return {
    totalGamesPlayed,
    totalOffNights,
    weekScore: calcWeekScore(winOdds, totalOffNights, totalLeagueGames, totalGamesPlayed, slateCounts, scheduleComplete),
    crowding,
    scoreDecomposition: {
      version: WEEK_SCORE_VERSION,
      games: 6 * (totalGamesPlayed - totalLeagueGames / 16),
      offNights: 4 * totalOffNights,
      matchup: calculateMatchupBonus(winOdds, totalGamesPlayed),
      crowding: crowding.adjustment
    }
  };
}

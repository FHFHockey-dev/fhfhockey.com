import type { TeamDataWithTotals } from "lib/NHL/types";

export type FourWeekGridView = "summary" | "weekly";

export interface FourWeekDetailCell {
  weekNumber: number;
  gamesPlayed: number;
  offNights: number;
  opponents: string[];
}

export const getFourWeekNumbers = (teams: TeamDataWithTotals[]): number[] =>
  Array.from(
    new Set(
      teams.flatMap((team) =>
        team.weeks.map((week) => week.weekNumber).filter(Number.isFinite),
      ),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, 4);

export const buildFourWeekDetailCells = (
  team: TeamDataWithTotals,
  weekNumbers: number[],
): FourWeekDetailCell[] => {
  const byWeek = new Map(team.weeks.map((week) => [week.weekNumber, week]));

  return weekNumbers.map((weekNumber) => {
    const week = byWeek.get(weekNumber);
    return {
      weekNumber,
      gamesPlayed: week?.gamesPlayed ?? 0,
      offNights: week?.offNights ?? 0,
      opponents: (week?.opponents ?? []).map(
        (opponent) => opponent.abbreviation,
      ),
    };
  });
};

export const buildFourWeekDetailAverages = (
  teams: TeamDataWithTotals[],
  weekNumbers: number[],
): Array<{ weekNumber: number; gamesPlayed: number; offNights: number }> => {
  const divisor = teams.length || 1;

  return weekNumbers.map((weekNumber) => {
    const totals = teams.reduce(
      (acc, team) => {
        const week = team.weeks.find(
          (candidate) => candidate.weekNumber === weekNumber,
        );
        acc.gamesPlayed += week?.gamesPlayed ?? 0;
        acc.offNights += week?.offNights ?? 0;
        return acc;
      },
      { gamesPlayed: 0, offNights: 0 },
    );

    return {
      weekNumber,
      gamesPlayed: totals.gamesPlayed / divisor,
      offNights: totals.offNights / divisor,
    };
  });
};

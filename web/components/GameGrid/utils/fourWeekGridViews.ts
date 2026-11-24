import type { TeamDataWithTotals } from "lib/NHL/types";

export type FourWeekGridView = "summary" | "weekly";

export interface FourWeekDetailCell {
  weekNumber: number;
  gamesPlayed: number | null;
  offNights: number | null;
  opponents: string[];
  coverage?: { known: number; expected: number };
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
    const complete = !!week && (week.scheduleCoverage != null && week.scheduleCoverage.known === week.scheduleCoverage.expected);
    return {
      weekNumber,
      gamesPlayed: complete ? week.gamesPlayed : null,
      offNights: complete ? week.offNights : null,
      coverage: week?.scheduleCoverage ?? (week ? undefined : { known: 0, expected: 7 }),
      opponents: (week?.opponents ?? []).map(
        (opponent) => opponent.abbreviation,
      ),
    };
  });
};

export const buildFourWeekDetailAverages = (
  teams: TeamDataWithTotals[],
  weekNumbers: number[],
): Array<{ weekNumber: number; gamesPlayed: number | null; offNights: number | null; teamCount: number }> => {

  return weekNumbers.map((weekNumber) => {
    const totals = teams.reduce(
      (acc, team) => {
        const week = team.weeks.find(
          (candidate) => candidate.weekNumber === weekNumber,
        );
        const coverage = week?.scheduleCoverage;
        if (week && coverage && coverage.expected > 0 && coverage.known === coverage.expected) {
          acc.gamesPlayed += week.gamesPlayed;
          acc.offNights += week.offNights;
          acc.known++;
        }
        return acc;
      },
      { gamesPlayed: 0, offNights: 0, known: 0 },
    );

    return {
      weekNumber,
      teamCount: totals.known,
      gamesPlayed: totals.known ? totals.gamesPlayed / totals.known : null,
      offNights: totals.known ? totals.offNights / totals.known : null,
    };
  });
};

import { resolveStatDirection, type StatDirection } from "lib/projectionsConfig/statsMasterList";

/**
 * Projected category standings (owner decision 114; audit W2-5 D6).
 *
 * Each team's category totals come from its starting slots (ratio categories
 * as team totals, so SV% and GAA count by their effect on the team's saves,
 * shots, goals against and minutes, decision 62). Teams are ranked per
 * category in the league's direction; a team earns (teams − rank + 1) points
 * with tied teams sharing the average of the points their places span. The
 * standings are incomplete (no total, no winner) when any team's total for an
 * enabled category is unknown: an unknown is never ranked as a 0.
 */
export type CategoryStandingTeam = {
  teamId: string;
  /** Starting-slot totals per category; null = unknown. */
  starterTotals: Readonly<Record<string, number | null | undefined>>;
};

export type CategoryStanding = {
  teamId: string;
  /** Roto points, or null when any enabled category is unknown for any team. */
  points: number | null;
  categoryPoints: Record<string, number | null>;
};

export type CategoryStandingsResult = {
  standings: CategoryStanding[];
  complete: boolean;
  unknownCategories: string[];
};

export function projectCategoryStandings(
  teams: readonly CategoryStandingTeam[],
  categoryWeights: Readonly<Record<string, number>>,
  directions?: Readonly<Record<string, StatDirection>>,
): CategoryStandingsResult {
  const keys = Object.keys(categoryWeights).filter((key) => {
    const weight = categoryWeights[key];
    return Number.isFinite(weight) && weight !== 0;
  });
  const categoryPoints: Record<string, Record<string, number | null>> =
    Object.fromEntries(teams.map((team) => [team.teamId, {}]));
  const unknownCategories: string[] = [];
  for (const key of keys) {
    const totals = teams.map((team) => {
      const value = team.starterTotals[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    });
    if (totals.some((value) => value === null)) {
      unknownCategories.push(key);
      teams.forEach((team) => (categoryPoints[team.teamId][key] = null));
      continue;
    }
    const lower =
      resolveStatDirection(key, { overrides: directions, weight: categoryWeights[key] }) === "lower";
    teams.forEach((team, index) => {
      const value = totals[index] as number;
      let better = 0;
      let tied = 0;
      for (const other of totals as number[]) {
        if (other === value) tied += 1;
        else if (lower ? other < value : other > value) better += 1;
      }
      // Places better+1 … better+tied share the average of their points.
      const best = teams.length - better;
      const worst = teams.length - better - tied + 1;
      categoryPoints[team.teamId][key] = (best + worst) / 2;
    });
  }
  const complete = unknownCategories.length === 0 && keys.length > 0;
  return {
    complete,
    unknownCategories,
    standings: teams.map((team) => ({
      teamId: team.teamId,
      points: complete
        ? keys.reduce((sum, key) => sum + (categoryPoints[team.teamId][key] as number), 0)
        : null,
      categoryPoints: categoryPoints[team.teamId],
    })),
  };
}

/** The projected category-standings leader, or null when standings are incomplete. */
export function categoryStandingsLeader(result: CategoryStandingsResult) {
  if (!result.complete) return null;
  const ranked = [...result.standings].sort(
    (a, b) => (b.points as number) - (a.points as number) || a.teamId.localeCompare(b.teamId),
  );
  const leader = ranked[0];
  if (!leader) return null;
  const tiedWith = ranked.filter((team) => team.points === leader.points).map((team) => team.teamId);
  return { teamId: leader.teamId, points: leader.points as number, tiedWith };
}

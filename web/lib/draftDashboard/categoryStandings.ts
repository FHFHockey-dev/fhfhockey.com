import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";

export function categoryRankBand(rank: number, teamCount: number) {
  const percentile =
    teamCount <= 0 ? 100 : ((teamCount - rank + 1) / teamCount) * 100;
  return percentile <= 25
    ? "red"
    : percentile <= 50
      ? "orange"
      : percentile <= 75
        ? "yellow"
        : "green";
}

export function rankTeamCategories(
  teams: readonly { teamId: string; categoryTotals: Record<string, number> }[],
  categories: Record<string, number>,
  leagueType: "points" | "categories",
) {
  const result: Record<string, Record<string, number>> = Object.fromEntries(
    teams.map((team) => [team.teamId, {}]),
  );
  for (const [key, weight] of Object.entries(categories)) {
    const definition = STATS_MASTER_LIST.find((stat) => stat.key === key);
    const higherIsBetter =
      leagueType === "points" && weight < 0
        ? false
        : (definition?.higherIsBetter ?? true);
    const sorted = [...teams].sort(
      (a, b) =>
        (higherIsBetter ? -1 : 1) *
        ((a.categoryTotals[key] ?? 0) - (b.categoryTotals[key] ?? 0)),
    );
    let rank = 1;
    sorted.forEach((team, index) => {
      if (
        index > 0 &&
        (team.categoryTotals[key] ?? 0) !==
          (sorted[index - 1].categoryTotals[key] ?? 0)
      )
        rank = index + 1;
      result[team.teamId][key] = rank;
    });
  }
  return result;
}

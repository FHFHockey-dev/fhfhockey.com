import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";

export type AggregateQuality =
  | "exact-from-projected-inputs"
  | "estimated"
  | "unavailable";

export interface ProjectedCategoryPlayer {
  displayPosition?: string | null;
  eligiblePositions?: readonly string[] | null;
  combinedStats?: Record<string, { projected?: unknown }> | null;
}

export interface TeamCategoryAggregate {
  value: number | null;
  quality: AggregateQuality;
}

const RATE_CATEGORY_KEYS = new Set([
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
  "SHOOTING_PERCENTAGE",
  "FACEOFF_PERCENTAGE",
  "TIME_ON_ICE_PER_GAME",
  "TOI_PER_GAME",
]);

const RATE_INPUT_KEYS: Record<string, readonly string[]> = {
  SAVE_PERCENTAGE: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "SAVE_PERCENTAGE"],
  GOALS_AGAINST_AVERAGE: ["GOALS_AGAINST_GOALIE", "TOTAL_TOI", "GOALS_AGAINST_AVERAGE", "GAMES_STARTED_GOALIE", "GAMES_STARTED", "GAMES_PLAYED_GOALIE", "GAMES_PLAYED", "GP_GOALIE"],
  SHOOTING_PERCENTAGE: ["GOALS", "SHOTS_ON_GOAL", "SHOOTING_PERCENTAGE"],
  FACEOFF_PERCENTAGE: ["FACEOFFS_WON", "FACEOFFS_LOST", "FACEOFF_PERCENTAGE", "FACEOFF_ATTEMPTS", "FACEOFFS_TAKEN"],
  TIME_ON_ICE_PER_GAME: ["TOTAL_TOI", "GAMES_PLAYED", "TIME_ON_ICE_PER_GAME", "TOI_PER_GAME"],
  TOI_PER_GAME: ["TOTAL_TOI", "GAMES_PLAYED", "TIME_ON_ICE_PER_GAME", "TOI_PER_GAME"],
};

const finiteStat = (player: ProjectedCategoryPlayer, key: string) => {
  const value = player.combinedStats?.[key]?.projected;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const firstFiniteStat = (
  player: ProjectedCategoryPlayer,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = finiteStat(player, key);
    if (value != null) return value;
  }
  return null;
};

const isGoalie = (player: ProjectedCategoryPlayer) =>
  (player.eligiblePositions ?? [])
    .concat(player.displayPosition?.split(",") ?? [])
    .some((position) => position.trim().toUpperCase() === "G");

const ratioAggregate = (
  players: readonly ProjectedCategoryPlayer[],
  numerator: (player: ProjectedCategoryPlayer) => number | null,
  denominator: (player: ProjectedCategoryPlayer) => number | null,
  multiplier = 1,
): TeamCategoryAggregate | null => {
  if (!players.length) return null;
  let totalNumerator = 0;
  let totalDenominator = 0;
  let missingInputs = false;
  for (const player of players) {
    const top = numerator(player);
    const bottom = denominator(player);
    if ((top != null && (!Number.isFinite(top) || top < 0)) ||
      (bottom != null && (!Number.isFinite(bottom) || bottom < 0)) ||
      (top != null && bottom === 0 && top !== 0)) return { value: null, quality: "unavailable" };
    if (top == null || bottom == null) { missingInputs = true; continue; }
    // A known 0/0 contributor has no attempts and does not alter team totals.
    totalNumerator += top;
    totalDenominator += bottom;
  }
  if (!Number.isFinite(totalNumerator) || !Number.isFinite(totalDenominator)) return { value: null, quality: "unavailable" };
  // Choose an estimate only after every contributor has passed validation.
  if (missingInputs) return null;
  if (totalDenominator <= 0) return { value: null, quality: "unavailable" };
  const value = (totalNumerator / totalDenominator) * multiplier;
  if (!Number.isFinite(value)) return { value: null, quality: "unavailable" };
  return { value, quality: "exact-from-projected-inputs" };
};

const weightedRateAggregate = (
  players: readonly ProjectedCategoryPlayer[],
  rate: (player: ProjectedCategoryPlayer) => number | null,
  workload: (player: ProjectedCategoryPlayer) => number | null,
): TeamCategoryAggregate | null => {
  if (!players.length) return null;
  let weightedTotal = 0;
  let totalWorkload = 0;
  for (const player of players) {
    const value = rate(player);
    const weight = workload(player);
    if (value == null || weight == null) return null;
    if (value < 0 || weight < 0) return { value: null, quality: "unavailable" };
    weightedTotal += value * weight;
    totalWorkload += weight;
  }
  if (totalWorkload <= 0) return null;
  if (!Number.isFinite(weightedTotal) || !Number.isFinite(totalWorkload)) return { value: null, quality: "unavailable" };
  return { value: weightedTotal / totalWorkload, quality: "estimated" };
};

const goalieShotsAgainst = (player: ProjectedCategoryPlayer) => {
  const supplied = finiteStat(player, "SHOTS_AGAINST_GOALIE");
  if (supplied != null) return supplied;
  const saves = finiteStat(player, "SAVES_GOALIE");
  const goalsAgainst = finiteStat(player, "GOALS_AGAINST_GOALIE");
  return saves != null && goalsAgainst != null ? saves + goalsAgainst : null;
};

/**
 * Aggregates category projections without treating rates as counting stats.
 * A rate is unavailable whenever any roster contributor lacks usable inputs,
 * so a partial projection can never be mistaken for a complete team total.
 */
export function aggregateTeamCategoryTotals(
  players: readonly ProjectedCategoryPlayer[],
  categories: readonly string[],
): Record<string, TeamCategoryAggregate> {
  return Object.fromEntries(
    categories.map((key) => {
      if (!RATE_CATEGORY_KEYS.has(key)) {
        const value = players.reduce(
          (total, player) => total + (finiteStat(player, key) ?? 0),
          0,
        );
        return [
          key,
          {
            value,
            quality: "exact-from-projected-inputs",
          } satisfies TeamCategoryAggregate,
        ];
      }

      if (players.some((player) => !player.displayPosition && !player.eligiblePositions?.length)) {
        return [key, { value: null, quality: "unavailable" }];
      }
      const contributors = players.filter((player) =>
        ["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"].includes(key)
          ? isGoalie(player)
          : !isGoalie(player),
      );
      // Missing exact inputs may use an estimate; invalid supplied inputs may not.
      if (contributors.some((player) => RATE_INPUT_KEYS[key].some((input) => {
        const value = player.combinedStats?.[input]?.projected;
        return value != null && (typeof value !== "number" || !Number.isFinite(value) || value < 0);
      }))) return [key, { value: null, quality: "unavailable" }];
      let aggregate: TeamCategoryAggregate | null = null;

      if (key === "SAVE_PERCENTAGE") {
        aggregate = ratioAggregate(
          contributors,
          (player) => finiteStat(player, "SAVES_GOALIE"),
          goalieShotsAgainst,
        );
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) => finiteStat(player, "SAVE_PERCENTAGE"),
          goalieShotsAgainst,
        );
      } else if (key === "GOALS_AGAINST_AVERAGE") {
        aggregate = ratioAggregate(
          contributors,
          (player) => finiteStat(player, "GOALS_AGAINST_GOALIE"),
          (player) => finiteStat(player, "TOTAL_TOI"),
          3600,
        );
        const starts = (player: ProjectedCategoryPlayer) =>
          firstFiniteStat(player, ["GAMES_STARTED_GOALIE", "GAMES_STARTED"]);
        const appearances = (player: ProjectedCategoryPlayer) =>
          firstFiniteStat(player, [
            "GAMES_PLAYED_GOALIE",
            "GAMES_PLAYED",
            "GP_GOALIE",
          ]);
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) => finiteStat(player, "GOALS_AGAINST_AVERAGE"),
          starts,
        );
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) => finiteStat(player, "GOALS_AGAINST_AVERAGE"),
          appearances,
        );
      } else if (key === "SHOOTING_PERCENTAGE") {
        aggregate = ratioAggregate(
          contributors,
          (player) => finiteStat(player, "GOALS"),
          (player) => finiteStat(player, "SHOTS_ON_GOAL"),
        );
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) => finiteStat(player, "SHOOTING_PERCENTAGE"),
          (player) => finiteStat(player, "SHOTS_ON_GOAL"),
        );
      } else if (key === "FACEOFF_PERCENTAGE") {
        aggregate = ratioAggregate(
          contributors,
          (player) => finiteStat(player, "FACEOFFS_WON"),
          (player) => {
            const won = finiteStat(player, "FACEOFFS_WON");
            const lost = finiteStat(player, "FACEOFFS_LOST");
            return won != null && lost != null ? won + lost : null;
          },
        );
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) => finiteStat(player, "FACEOFF_PERCENTAGE"),
          (player) =>
            firstFiniteStat(player, ["FACEOFF_ATTEMPTS", "FACEOFFS_TAKEN"]),
        );
      } else {
        aggregate = ratioAggregate(
          contributors,
          (player) => finiteStat(player, "TOTAL_TOI"),
          (player) => finiteStat(player, "GAMES_PLAYED"),
        );
        aggregate ??= weightedRateAggregate(
          contributors,
          (player) =>
            firstFiniteStat(player, ["TIME_ON_ICE_PER_GAME", "TOI_PER_GAME"]),
          (player) => finiteStat(player, "GAMES_PLAYED"),
        );
      }

      return [
        key,
        aggregate ?? { value: null, quality: "unavailable" },
      ];
    }),
  );
}

export function categoryRankBand(rank: number | undefined, teamCount: number) {
  if (rank == null) return undefined;
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
  teams: readonly { teamId: string; categoryTotals: Record<string, number | null> }[],
  categories: Record<string, number>,
  leagueType: "points" | "categories",
) {
  const result: Record<string, Record<string, number | undefined>> = Object.fromEntries(
    teams.map((team) => [team.teamId, {}]),
  );
  for (const [key, weight] of Object.entries(categories)) {
    const definition = STATS_MASTER_LIST.find((stat) => stat.key === key);
    const higherIsBetter =
      leagueType === "points" && weight < 0
        ? false
        : (definition?.higherIsBetter ?? true);
    const value = (team: (typeof teams)[number]) =>
      team.categoryTotals[key] === null
        ? null
        : team.categoryTotals[key] ?? (RATE_CATEGORY_KEYS.has(key) ? null : 0);
    const sorted = teams.filter((team) => Number.isFinite(value(team))).sort(
      (a, b) =>
        (higherIsBetter ? -1 : 1) *
        (value(a)! - value(b)!),
    );
    let rank = 1;
    sorted.forEach((team, index) => {
      if (
        index > 0 &&
        value(team) !== value(sorted[index - 1])
      )
        rank = index + 1;
      result[team.teamId][key] = rank;
    });
  }
  return result;
}

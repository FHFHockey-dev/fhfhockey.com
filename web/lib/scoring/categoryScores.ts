export type CategoryScorePlayer = {
  id: string;
  role: "skater" | "goalie";
  values: Record<string, number | null | undefined>;
};

const DEFAULT_CATEGORIES = [
  "GOALS",
  "ASSISTS",
  "PP_POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
];

const PRIOR_SHOTS = 1200;
const PRIOR_STARTS = 25;
const SHARED_ROLE_CATEGORIES = new Set(["GAMES_PLAYED", "TOTAL_TOI"]);

export function isGoalieCategory(key: string) {
  return (
    key.endsWith("_GOALIE") ||
    key === "GAMES_STARTED" ||
    key === "GOALS_AGAINST_AVERAGE" ||
    key === "SAVE_PERCENTAGE" ||
    key === "GOALS_AGAINST_GOALIE" ||
    key === "SHOTS_AGAINST_GOALIE" ||
    key === "SHUTOUTS_GOALIE" ||
    key === "WINS_GOALIE" ||
    key === "LOSSES_GOALIE" ||
    key === "OTL_GOALIE"
  );
}

export function isInvertedCategory(key: string) {
  return (
    key === "GOALS_AGAINST_AVERAGE" ||
    key === "GOALS_AGAINST_GOALIE" ||
    key === "LOSSES_GOALIE"
  );
}

function categoryAppliesToRole(key: string, role: "skater" | "goalie") {
  if (SHARED_ROLE_CATEGORIES.has(key)) return true;
  return isGoalieCategory(key) === (role === "goalie");
}

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function regressedGoalieRate(
  key: string,
  value: number,
  player: CategoryScorePlayer,
  average: number,
) {
  if (key === "SAVE_PERCENTAGE") {
    const workload = Math.max(0, Number(player.values.SHOTS_AGAINST_GOALIE ?? 0));
    return (workload * value + PRIOR_SHOTS * average) / Math.max(1, workload + PRIOR_SHOTS);
  }
  if (key === "GOALS_AGAINST_AVERAGE") {
    const workload = Math.max(0, Number(player.values.GAMES_STARTED ?? 0));
    return (workload * value + PRIOR_STARTS * average) / Math.max(1, workload + PRIOR_STARTS);
  }
  return value;
}

export function calculateCategoryScores(
  players: CategoryScorePlayer[],
  categoryWeights: Record<string, number>,
) {
  const keys = Object.keys(categoryWeights).length
    ? Object.keys(categoryWeights)
    : DEFAULT_CATEGORIES;
  const populations: Record<"skater" | "goalie", Record<string, number[]>> = {
    skater: {},
    goalie: {},
  };
  for (const role of ["skater", "goalie"] as const) {
    for (const key of keys) populations[role][key] = [];
  }
  for (const player of players) {
    for (const key of keys) {
      if (!categoryAppliesToRole(key, player.role)) continue;
      const value = player.values[key];
      if (finite(value)) populations[player.role][key].push(value);
    }
  }
  const averages: Record<"skater" | "goalie", Record<string, number>> = {
    skater: {},
    goalie: {},
  };
  const deviations: Record<"skater" | "goalie", Record<string, number>> = {
    skater: {},
    goalie: {},
  };
  for (const role of ["skater", "goalie"] as const) {
    for (const key of keys) {
      averages[role][key] = mean(populations[role][key]);
      deviations[role][key] = standardDeviation(populations[role][key]);
    }
  }
  const result = new Map<string, number>();
  for (const player of players) {
    let score = 0;
    for (const key of keys) {
      if (!categoryAppliesToRole(key, player.role)) continue;
      const raw = player.values[key];
      const deviation = deviations[player.role][key];
      if (!finite(raw) || !finite(deviation) || deviation === 0) continue;
      const average = averages[player.role][key];
      const value =
        player.role === "goalie"
          ? regressedGoalieRate(key, raw, player, average)
          : raw;
      const zScore = isInvertedCategory(key)
        ? (average - value) / deviation
        : (value - average) / deviation;
      const weight = finite(categoryWeights[key]) ? categoryWeights[key] : 1;
      score += weight * zScore;
    }
    result.set(player.id, Number.isFinite(score) ? score : 0);
  }
  return result;
}

import { resolveIxgValue } from "./rollingPlayerMetricMath";

type StrengthState = "all" | "ev" | "pp" | "pk";

type CountsLike = {
  total_points?: number | null;
  shots?: number | null;
  goals?: number | null;
  total_assists?: number | null;
  hits?: number | null;
  shots_blocked?: number | null;
  total_points_pp?: number | null;
  ixg?: number | null;
};

type WgoLike = {
  points?: number | null;
  shots?: number | null;
  goals?: number | null;
  assists?: number | null;
  hits?: number | null;
  blocked_shots?: number | null;
  pp_points?: number | null;
  ixg?: number | string | null;
};

export type AdditiveMetricSourceGame = {
  strength: StrengthState;
  counts?: CountsLike;
  wgo?: WgoLike;
};

function getFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function getPointsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.total_points != null) {
    return game.counts.total_points;
  }
  if (game.strength === "all") {
    return game.wgo?.points ?? null;
  }
  return null;
}

export function getShotsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.shots != null) {
    return game.counts.shots;
  }
  if (game.strength === "all") {
    return game.wgo?.shots ?? null;
  }
  return null;
}

export function getGoalsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.goals != null) {
    return game.counts.goals;
  }
  if (game.strength === "all") {
    return game.wgo?.goals ?? null;
  }
  return null;
}

export function getAssistsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.total_assists != null) {
    return game.counts.total_assists;
  }
  if (game.strength === "all") {
    return game.wgo?.assists ?? null;
  }
  return null;
}

export function getHitsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.hits != null) {
    return game.counts.hits;
  }
  if (game.strength === "all") {
    return game.wgo?.hits ?? null;
  }
  return null;
}

export function getBlocksValue(game: AdditiveMetricSourceGame): number | null {
  if (game.counts?.shots_blocked != null) {
    return game.counts.shots_blocked;
  }
  if (game.strength === "all") {
    return game.wgo?.blocked_shots ?? null;
  }
  return null;
}

export function getPpPointsValue(game: AdditiveMetricSourceGame): number | null {
  if (game.strength === "pp") {
    return game.counts?.total_points ?? null;
  }
  if (game.strength === "all") {
    return game.wgo?.pp_points ?? null;
  }
  return null;
}

export function getIxgValue(game: AdditiveMetricSourceGame): number | null {
  return resolveIxgValue({
    strength: game.strength,
    countsIxg: game.counts?.ixg ?? null,
    wgoIxg: getFiniteNumber(game.wgo?.ixg)
  });
}

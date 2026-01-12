import {
  DEFAULT_GOALIE_FANTASY_POINTS,
  DEFAULT_SKATER_FANTASY_POINTS
} from "lib/projectionsConfig/fantasyPointsConfig";

type FantasyPointsConfig = Record<string, number>;

type SkaterStatLine = {
  goals: number;
  assists: number;
  ppPoints: number;
  shots: number;
  hits: number;
  blockedShots: number;
};

type GoalieStatLine = {
  saves: number;
  goalsAgainst: number;
  wins: number;
  shutouts: number;
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function computeSkaterFantasyPoints(
  stats: SkaterStatLine,
  config: FantasyPointsConfig = DEFAULT_SKATER_FANTASY_POINTS
): number {
  return (
    toNumber(config.GOALS) * toNumber(stats.goals) +
    toNumber(config.ASSISTS) * toNumber(stats.assists) +
    toNumber(config.PP_POINTS) * toNumber(stats.ppPoints) +
    toNumber(config.SHOTS_ON_GOAL) * toNumber(stats.shots) +
    toNumber(config.HITS) * toNumber(stats.hits) +
    toNumber(config.BLOCKED_SHOTS) * toNumber(stats.blockedShots)
  );
}

export function computeGoalieFantasyPoints(
  stats: GoalieStatLine,
  config: FantasyPointsConfig = DEFAULT_GOALIE_FANTASY_POINTS
): number {
  return (
    toNumber(config.SAVES_GOALIE) * toNumber(stats.saves) +
    toNumber(config.GOALS_AGAINST_GOALIE) * toNumber(stats.goalsAgainst) +
    toNumber(config.WINS_GOALIE) * toNumber(stats.wins) +
    toNumber(config.SHUTOUTS_GOALIE) * toNumber(stats.shutouts)
  );
}

export function computeAccuracyScore(
  predicted: number,
  actual: number
): number {
  const denom = Math.max(1, Math.abs(actual), Math.abs(predicted));
  const error = Math.abs(predicted - actual);
  const score = 1 - Math.min(1, error / denom);
  return Number.isFinite(score) ? score : 0;
}

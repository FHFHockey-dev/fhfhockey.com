import {
  GOALIE_BACK_TO_BACK_PENALTY,
  GOALIE_HEAVY_WORKLOAD_PENALTY,
  GOALIE_REST_SPLIT_MAX_ADJUSTMENT,
  GOALIE_REST_SPLIT_MIN_GAMES,
  GOALIE_VERY_HEAVY_WORKLOAD_PENALTY
} from "../constants/projection-weights";
import type {
  GoalieRestSplitBucket,
  GoalieRestSplitProfile,
  GoalieWorkloadContext
} from "../types/run-forge-projections.types";
import { clamp } from "../utils/number-utils";

export function computeWorkloadSavePctPenalty(
  workload: GoalieWorkloadContext
): number {
  let penalty = 0;
  if (workload.startsLast14Days >= 6) {
    penalty += GOALIE_VERY_HEAVY_WORKLOAD_PENALTY;
  } else if (workload.startsLast14Days >= 5) {
    penalty += GOALIE_HEAVY_WORKLOAD_PENALTY;
  }
  if (workload.isGoalieBackToBack) {
    penalty += GOALIE_BACK_TO_BACK_PENALTY;
  }
  return penalty;
}

export function toGoalieRestSplitBucket(
  daysSinceLastStart: number | null
): GoalieRestSplitBucket {
  if (daysSinceLastStart == null) return "4_plus";
  if (daysSinceLastStart <= 0) return "0";
  if (daysSinceLastStart === 1) return "1";
  if (daysSinceLastStart === 2) return "2";
  if (daysSinceLastStart === 3) return "3";
  return "4_plus";
}

export function computeGoalieRestSplitSavePctAdjustment(args: {
  profile: GoalieRestSplitProfile | null;
  daysSinceLastStart: number | null;
}): number {
  const { profile, daysSinceLastStart } = args;
  if (!profile) return 0;

  const bucket = toGoalieRestSplitBucket(daysSinceLastStart);
  const bucketGames = profile.gamesByBucket[bucket] ?? 0;
  const bucketSavePct = profile.savePctByBucket[bucket];
  if (
    !Number.isFinite(bucketGames) ||
    bucketGames < GOALIE_REST_SPLIT_MIN_GAMES ||
    !Number.isFinite(bucketSavePct)
  ) {
    return 0;
  }

  let weightedSavePctSum = 0;
  let weightedGames = 0;
  const buckets: GoalieRestSplitBucket[] = ["0", "1", "2", "3", "4_plus"];
  for (const b of buckets) {
    const games = profile.gamesByBucket[b] ?? 0;
    const savePct = profile.savePctByBucket[b];
    if (
      Number.isFinite(games) &&
      games > 0 &&
      Number.isFinite(savePct) &&
      savePct != null
    ) {
      weightedSavePctSum += games * savePct;
      weightedGames += games;
    }
  }
  if (weightedGames <= 0) return 0;

  const baselineSavePct = weightedSavePctSum / weightedGames;
  const sampleWeight = clamp(bucketGames / (bucketGames + 6), 0, 1);
  const delta = (bucketSavePct as number) - baselineSavePct;
  return clamp(
    delta * sampleWeight,
    -GOALIE_REST_SPLIT_MAX_ADJUSTMENT,
    GOALIE_REST_SPLIT_MAX_ADJUSTMENT
  );
}

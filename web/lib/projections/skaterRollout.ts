export const SKATER_MODEL_VERSION = "skater-role-scenario-v1";

export type SkaterModelMode = "candidate" | "baseline";

export type SkaterRolloutConfig = {
  modelVersion: string;
  mode: SkaterModelMode;
  featureFlag: "FORGE_SKATER_MODEL_MODE";
  rollbackMode: "baseline";
};

export function resolveSkaterRolloutConfig(
  rawMode = process.env.FORGE_SKATER_MODEL_MODE,
): SkaterRolloutConfig {
  return {
    modelVersion: SKATER_MODEL_VERSION,
    mode:
      rawMode?.trim().toLowerCase() === "baseline" ? "baseline" : "candidate",
    featureFlag: "FORGE_SKATER_MODEL_MODE",
    rollbackMode: "baseline",
  };
}

export function selectSkaterRolloutStatLine<T>(args: {
  config: SkaterRolloutConfig;
  candidate: T;
  baseline: T;
}): T {
  return args.config.mode === "baseline" ? args.baseline : args.candidate;
}

export const SKATER_ROLLOUT_GOVERNANCE = {
  shadowMinimumDays: 14,
  acceptance: [
    "At least 14 distinct matched holdout dates are available for both current and naive comparisons.",
    "Candidate MAE and RMSE do not regress versus the current baseline.",
    "Candidate MAE improves versus the naive prior and interval coverage remains inside approved launch bands.",
    "No blocking skater freshness gate or unexplained zero-row slate remains open.",
  ],
  rollbackTriggers: [
    "MAE or RMSE regresses versus the current baseline over the active 14-day window.",
    "Interval coverage leaves the approved calibration band.",
    "Scheduled slates repeatedly produce zero skater rows or require freshness bypasses.",
    "A model-version or response-contract defect breaks canonical readers.",
  ],
  monitoringCadence: {
    daily:
      "Review cron status, skater row counts, freshness gates, and holdout availability.",
    weekly:
      "Review 7/14/30-day MAE, RMSE, interval coverage, role buckets, miss attribution, and recalibration need.",
  },
} as const;

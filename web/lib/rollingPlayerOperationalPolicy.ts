export type RollingExecutionProfile =
  | "daily_incremental"
  | "overnight"
  | "targeted_repair";

export type RollingForgePipelineMode = RollingExecutionProfile;

export const ROLLING_EXECUTION_PROFILE_DEFAULTS: Record<
  RollingExecutionProfile,
  {
    playerConcurrency: number;
    upsertBatchSize: number;
    upsertConcurrency: number;
    skipDiagnostics: boolean;
  }
> = {
  daily_incremental: {
    playerConcurrency: 4,
    upsertBatchSize: 500,
    upsertConcurrency: 4,
    skipDiagnostics: true
  },
  overnight: {
    playerConcurrency: 4,
    upsertBatchSize: 250,
    upsertConcurrency: 2,
    skipDiagnostics: true
  },
  targeted_repair: {
    playerConcurrency: 4,
    upsertBatchSize: 500,
    upsertConcurrency: 4,
    skipDiagnostics: true
  }
};

export const ROLLING_EXECUTION_PROFILE_BUDGETS_MS: Record<
  RollingExecutionProfile,
  number
> = {
  daily_incremental: 270000,
  overnight: 1800000,
  targeted_repair: 600000
};

export const ROLLING_FORGE_PIPELINE_BUDGETS_MS: Record<
  RollingForgePipelineMode,
  number
> = {
  daily_incremental: 270000,
  overnight: 5400000,
  targeted_repair: 900000
};

export function parseRollingExecutionProfile(
  value: string | null | undefined,
  fallback: RollingExecutionProfile = "daily_incremental"
): RollingExecutionProfile {
  if (
    value === "daily_incremental" ||
    value === "overnight" ||
    value === "targeted_repair"
  ) {
    return value;
  }
  return fallback;
}

export function isRollingExecutionProfile(
  value: string | null | undefined
): value is RollingExecutionProfile {
  return (
    value === "daily_incremental" ||
    value === "overnight" ||
    value === "targeted_repair"
  );
}

export function inferRollingExecutionProfile(args: {
  playerId?: number;
  season?: number;
  startDate?: string;
  endDate?: string;
  fullRefresh?: boolean;
}): RollingExecutionProfile {
  if (args.playerId !== undefined) {
    return "targeted_repair";
  }
  if (
    args.fullRefresh ||
    (args.season !== undefined && !args.startDate && !args.endDate)
  ) {
    return "overnight";
  }
  if (args.startDate !== undefined || args.endDate !== undefined) {
    return "daily_incremental";
  }
  return "overnight";
}

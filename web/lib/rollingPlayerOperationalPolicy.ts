export type RollingExecutionProfile =
  | "daily_incremental"
  | "overnight"
  | "targeted_repair";

export type RollingForgePipelineMode = RollingExecutionProfile;

export const PROJECTION_ROUTE_DEFAULT_BUDGET_MS = 210_000;

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
    skipDiagnostics: true,
  },
  overnight: {
    playerConcurrency: 4,
    upsertBatchSize: 250,
    upsertConcurrency: 2,
    skipDiagnostics: true,
  },
  targeted_repair: {
    playerConcurrency: 4,
    upsertBatchSize: 500,
    upsertConcurrency: 4,
    skipDiagnostics: true,
  },
};

export const ROLLING_EXECUTION_PROFILE_BUDGETS_MS: Record<
  RollingExecutionProfile,
  number
> = {
  daily_incremental: 210000,
  overnight: 1800000,
  targeted_repair: 600000,
};

export const ROLLING_FORGE_PIPELINE_BUDGETS_MS: Record<
  RollingForgePipelineMode,
  number
> = {
  daily_incremental: 210000,
  overnight: 5400000,
  targeted_repair: 900000,
};

export function parseRollingExecutionProfile(
  value: string | null | undefined,
  fallback: RollingExecutionProfile = "daily_incremental",
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
  value: string | null | undefined,
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

export type RollingFullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";

const TABLE_CLEARING_FULL_REFRESH_MODES = new Set<RollingFullRefreshMode>([
  "rpc_truncate",
  "delete"
]);

/**
 * A rolling full refresh overwrites rows by upsert unless the caller explicitly
 * asks for a table-wide clear. Clearing is refused for dry runs and scoped
 * runs, because they would not rebuild everything the clear removes.
 */
export function resolveRollingFullRefreshMode(args: {
  fullRefreshMode?: RollingFullRefreshMode;
  dryRunUpsert?: boolean;
  playerId?: number;
  season?: number;
  startDate?: string;
  endDate?: string;
  strengths?: readonly string[];
  resumePlayerId?: number;
  maxPlayers?: number;
}): { mode: RollingFullRefreshMode; refusal: string | null } {
  const mode = args.fullRefreshMode ?? "overwrite_only";
  if (!TABLE_CLEARING_FULL_REFRESH_MODES.has(mode)) {
    return { mode, refusal: null };
  }

  const conflicts = Object.entries({
    dryRunUpsert: args.dryRunUpsert === true,
    playerId: args.playerId !== undefined,
    season: args.season !== undefined,
    startDate: args.startDate !== undefined,
    endDate: args.endDate !== undefined,
    strengths: (args.strengths?.length ?? 0) > 0,
    resumeFrom: args.resumePlayerId !== undefined,
    maxPlayers: args.maxPlayers !== undefined
  })
    .filter(([, present]) => present)
    .map(([flag]) => flag);

  return {
    mode,
    refusal:
      conflicts.length === 0
        ? null
        : `fullRefreshMode=${mode} clears the whole rolling table and cannot be combined with ${conflicts.join(", ")}. Use fullRefreshMode=overwrite_only for a dry-run or scoped refresh.`
  };
}

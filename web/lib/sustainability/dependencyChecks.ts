import supabase from "lib/supabase/server";

export type SustainabilityDependencyCode =
  | "missing_player_stats_unified"
  | "missing_player_totals_unified"
  | "missing_player_baselines_snapshot"
  | "missing_sustainability_priors"
  | "missing_sustainability_window_z";

export type SustainabilityDependencyIssue = {
  code: SustainabilityDependencyCode;
  message: string;
  detail: string;
  action: string;
};

export class SustainabilityDependencyError extends Error {
  statusCode: number;
  issue: SustainabilityDependencyIssue;

  constructor(issue: SustainabilityDependencyIssue, statusCode = 424) {
    super(issue.message);
    this.name = "SustainabilityDependencyError";
    this.statusCode = statusCode;
    this.issue = issue;
  }
}

async function countRows(
  table: string,
  applyBuilder?: (query: any) => any
): Promise<number> {
  let query = (supabase as any)
    .from(table)
    .select("*", { count: "exact", head: true });
  if (applyBuilder) query = applyBuilder(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function throwMissing(issue: SustainabilityDependencyIssue): never {
  throw new SustainabilityDependencyError(issue);
}

export async function assertBaselinesPrerequisites(snapshotDate: string) {
  const sinceDate = new Date(
    new Date(snapshotDate).getTime() - 365 * 24 * 3600 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const statsCount = await countRows("player_stats_unified", (query) =>
    query.gte("date", sinceDate).not("player_id", "is", null)
  );
  if (statsCount === 0) {
    throwMissing({
      code: "missing_player_stats_unified",
      message:
        "Missing prerequisite data in player_stats_unified for baseline rebuild.",
      detail: `No player_stats_unified rows were found on or after ${sinceDate}.`,
      action:
        "Refresh player_stats_unified before rebuilding sustainability baselines."
    });
  }

  const totalsCount = await countRows("player_totals_unified", (query) =>
    query.not("player_id", "is", null)
  );
  if (totalsCount === 0) {
    throwMissing({
      code: "missing_player_totals_unified",
      message:
        "Missing prerequisite data in player_totals_unified for baseline rebuild.",
      detail: "No player_totals_unified rows were found for any player.",
      action:
        "Refresh player_totals_unified before rebuilding sustainability baselines."
    });
  }
}

export async function assertPriorsPrerequisites(seasonId: number) {
  const totalsCount = await countRows("player_totals_unified", (query) =>
    query.eq("season_id", seasonId).not("player_id", "is", null)
  );
  if (totalsCount === 0) {
    throwMissing({
      code: "missing_player_totals_unified",
      message:
        "Missing prerequisite data in player_totals_unified for priors rebuild.",
      detail: `No player_totals_unified rows were found for season ${seasonId}.`,
      action:
        "Refresh player_totals_unified for the requested season before rebuilding priors."
    });
  }
}

export async function assertWindowZPrerequisites(
  seasonId: number,
  snapshotDate: string
) {
  const baselineCount = await countRows("player_baselines", (query) =>
    query.eq("snapshot_date", snapshotDate)
  );
  if (baselineCount === 0) {
    throwMissing({
      code: "missing_player_baselines_snapshot",
      message:
        "Missing player_baselines snapshot required for sustainability window-z rebuild.",
      detail: `No player_baselines rows were found for snapshot ${snapshotDate}.`,
      action:
        "Run /api/v1/db/sustainability/rebuild-baselines for the snapshot before rebuilding window-z."
    });
  }

  const priorCount = await countRows("sustainability_priors", (query) =>
    query.eq("season_id", seasonId)
  );
  if (priorCount === 0) {
    throwMissing({
      code: "missing_sustainability_priors",
      message:
        "Missing sustainability_priors required for sustainability window-z rebuild.",
      detail: `No sustainability_priors rows were found for season ${seasonId}.`,
      action:
        "Run /api/v1/sustainability/rebuild-priors for the requested season before rebuilding window-z."
    });
  }
}

export async function assertScorePrerequisites(
  seasonId: number,
  snapshotDate: string
) {
  await assertWindowZPrerequisites(seasonId, snapshotDate);

  const windowCount = await countRows("sustainability_window_z", (query) =>
    query.eq("season_id", seasonId).eq("snapshot_date", snapshotDate)
  );
  if (windowCount === 0) {
    throwMissing({
      code: "missing_sustainability_window_z",
      message:
        "Missing sustainability_window_z rows required for sustainability score rebuild.",
      detail: `No sustainability_window_z rows were found for season ${seasonId} and snapshot ${snapshotDate}.`,
      action:
        "Run /api/v1/sustainability/rebuild-window-z for the requested season and snapshot before rebuilding scores."
    });
  }
}

export async function assertTrendBandPrerequisites() {
  const statsCount = await countRows("player_stats_unified", (query) =>
    query.not("player_id", "is", null)
  );
  if (statsCount === 0) {
    throwMissing({
      code: "missing_player_stats_unified",
      message:
        "Missing prerequisite data in player_stats_unified for trend-band rebuild.",
      detail: "No player_stats_unified rows were found for any player.",
      action:
        "Refresh player_stats_unified before rebuilding sustainability trend bands."
    });
  }

  const totalsCount = await countRows("player_totals_unified", (query) =>
    query.not("player_id", "is", null)
  );
  if (totalsCount === 0) {
    throwMissing({
      code: "missing_player_totals_unified",
      message:
        "Missing prerequisite data in player_totals_unified for trend-band rebuild.",
      detail: "No player_totals_unified rows were found for any player.",
      action:
        "Refresh player_totals_unified before rebuilding sustainability trend bands."
    });
  }
}

export function isSustainabilityDependencyError(
  error: unknown
): error is SustainabilityDependencyError {
  return error instanceof SustainabilityDependencyError;
}

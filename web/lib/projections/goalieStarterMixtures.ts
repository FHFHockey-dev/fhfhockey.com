export type GoalieStarterMixtureSourceConfidence = "high" | "medium" | "low";

export type GoalieStarterProjectionInput = {
  game_id: number;
  game_date: string | null;
  team_id: number;
  player_id: number;
  start_probability: number | null;
  confirmed_status: boolean | null;
  l10_start_pct?: number | null;
  season_start_pct?: number | null;
  games_played?: number | null;
  projected_gsaa_per_60?: number | null;
  updated_at?: string | null;
};

export type GoalieStarterMixtureRow = {
  mixture_version: string;
  game_id: number;
  game_date: string | null;
  team_id: number;
  goalie_id: number;
  as_of_timestamp: string;
  source_name: string;
  source_updated_at: string | null;
  source_confidence: GoalieStarterMixtureSourceConfidence;
  raw_start_probability: number;
  adjusted_start_probability: number;
  normalized_start_probability: number;
  rank: number;
  confirmed_status: boolean;
  is_manual_override: boolean;
  is_stale: boolean;
  is_hard_stale: boolean;
  is_back_to_back: boolean;
  previous_game_starter_goalie_id: number | null;
  probability_mass: number;
  residual_probability_mass: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type GoalieStarterBranchProjectionInput = {
  mixture_version: string;
  game_id: number;
  game_date: string | null;
  team_id: number;
  goalie_id: number;
  as_of_timestamp: string;
  branch_rank: number;
  branch_probability: number;
  projection_version: string;
  proj_shots_against: number | null;
  proj_saves: number | null;
  proj_goals_allowed: number | null;
  proj_win_prob: number | null;
  proj_shutout_prob: number | null;
  modeled_save_pct: number | null;
  provenance?: Record<string, unknown>;
};

export type GoalieStarterBranchProjectionRow = GoalieStarterBranchProjectionInput & {
  branch_key: string;
  weighted_proj_shots_against: number | null;
  weighted_proj_saves: number | null;
  weighted_proj_goals_allowed: number | null;
  weighted_proj_win_prob: number | null;
  weighted_proj_shutout_prob: number | null;
  updated_at: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursBetween(left: string, right: string | null | undefined): number | null {
  const leftTime = parseTime(left);
  const rightTime = parseTime(right);
  if (leftTime == null || rightTime == null) return null;
  return (leftTime - rightTime) / 3600000;
}

function confidenceFor(args: {
  normalizedProbability: number;
  confirmed: boolean;
  staleHours: number | null;
  staleSoftHours: number;
  staleHardHours: number;
}): GoalieStarterMixtureSourceConfidence {
  if (args.confirmed) return "high";
  if (args.staleHours != null && args.staleHours >= args.staleHardHours) return "low";
  if (args.normalizedProbability >= 0.8) return "high";
  if (args.staleHours != null && args.staleHours >= args.staleSoftHours) return "medium";
  return args.normalizedProbability >= 0.6 ? "medium" : "low";
}

function weighted(value: number | null, probability: number): number | null {
  return value == null || !Number.isFinite(value) ? null : roundMetric(value * probability);
}

export function buildGoalieStarterMixtureRows(args: {
  projections: GoalieStarterProjectionInput[];
  mixtureVersion?: string;
  asOfTimestamp?: string;
  sourceName?: string;
  staleSoftHours?: number;
  staleHardHours?: number;
  manualOverridesByGameTeam?: Map<string, number>;
  previousGameStarterByGameTeam?: Map<string, number>;
  backToBackGameTeams?: Set<string>;
}): GoalieStarterMixtureRow[] {
  const mixtureVersion = args.mixtureVersion ?? "goalie_starter_mixture_v1";
  const asOfTimestamp = args.asOfTimestamp ?? new Date().toISOString();
  const sourceName = args.sourceName ?? "goalie_start_projections";
  const staleSoftHours = args.staleSoftHours ?? 12;
  const staleHardHours = args.staleHardHours ?? 36;
  const byGameTeam = new Map<string, GoalieStarterProjectionInput[]>();

  for (const row of args.projections) {
    if (!Number.isFinite(row.game_id) || !Number.isFinite(row.team_id) || !Number.isFinite(row.player_id)) {
      continue;
    }
    const key = `${row.game_id}:${row.team_id}`;
    const current = byGameTeam.get(key) ?? [];
    current.push(row);
    byGameTeam.set(key, current);
  }

  const output: GoalieStarterMixtureRow[] = [];
  for (const [key, rows] of byGameTeam) {
    const manualOverrideGoalieId = args.manualOverridesByGameTeam?.get(key) ?? null;
    const confirmedRows = rows.filter((row) => row.confirmed_status === true);
    const previousStarter = args.previousGameStarterByGameTeam?.get(key) ?? null;
    const isBackToBack = args.backToBackGameTeams?.has(key) ?? false;

    const adjusted = rows.map((row) => {
      const raw = clamp(Number(row.start_probability ?? 0), 0, 1);
      let probability = raw;
      if (manualOverrideGoalieId != null) {
        probability = row.player_id === manualOverrideGoalieId ? 1 : 0;
      } else if (confirmedRows.length > 0) {
        probability = row.confirmed_status ? 1 / confirmedRows.length : 0;
      } else if (isBackToBack && previousStarter === row.player_id && rows.length > 1) {
        probability *= 0.65;
      }
      return { row, raw, adjusted: probability };
    });

    const mass = adjusted.reduce((sum, row) => sum + Math.max(0, row.adjusted), 0);
    const denominator = mass > 0 ? mass : adjusted.length || 1;
    const ranked = adjusted
      .map((item) => ({
        ...item,
        normalized: clamp(Math.max(0, item.adjusted) / denominator, 0, 1),
      }))
      .sort((left, right) => {
        const probDelta = right.normalized - left.normalized;
        return probDelta !== 0 ? probDelta : left.row.player_id - right.row.player_id;
      });

    const topMass = ranked.reduce((sum, item) => sum + item.normalized, 0);
    ranked.forEach((item, index) => {
      const staleHours = hoursBetween(asOfTimestamp, item.row.updated_at);
      const isStale = staleHours != null && staleHours >= staleSoftHours;
      const isHardStale = staleHours != null && staleHours >= staleHardHours;
      const confirmed = item.row.confirmed_status === true;
      output.push({
        mixture_version: mixtureVersion,
        game_id: item.row.game_id,
        game_date: item.row.game_date,
        team_id: item.row.team_id,
        goalie_id: item.row.player_id,
        as_of_timestamp: asOfTimestamp,
        source_name: sourceName,
        source_updated_at: item.row.updated_at ?? null,
        source_confidence: confidenceFor({
          normalizedProbability: item.normalized,
          confirmed,
          staleHours,
          staleSoftHours,
          staleHardHours,
        }),
        raw_start_probability: roundMetric(item.raw),
        adjusted_start_probability: roundMetric(item.adjusted),
        normalized_start_probability: roundMetric(item.normalized),
        rank: index + 1,
        confirmed_status: confirmed,
        is_manual_override: manualOverrideGoalieId === item.row.player_id,
        is_stale: isStale,
        is_hard_stale: isHardStale,
        is_back_to_back: isBackToBack,
        previous_game_starter_goalie_id: previousStarter,
        probability_mass: roundMetric(topMass),
        residual_probability_mass: roundMetric(Math.max(0, 1 - topMass)),
        provenance: {
          sourceTable: "goalie_start_projections",
          mixtureVersion,
          manualOverrideApplied: manualOverrideGoalieId != null,
          confirmedStarterCount: confirmedRows.length,
          staleHours: staleHours == null ? null : roundMetric(staleHours),
          backToBackAdjustmentApplied:
            isBackToBack && previousStarter === item.row.player_id && manualOverrideGoalieId == null,
        },
        updated_at: asOfTimestamp,
      });
    });
  }

  return output.sort((left, right) => {
    const gameDelta = left.game_id - right.game_id;
    if (gameDelta !== 0) return gameDelta;
    const teamDelta = left.team_id - right.team_id;
    if (teamDelta !== 0) return teamDelta;
    return left.rank - right.rank;
  });
}

export function mixtureRowsToStarterScenarios(
  rows: GoalieStarterMixtureRow[],
  maxScenarios = 2
): Array<{ goalieId: number; probability: number; rawProbability: number; rank: number }> {
  return rows
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .slice(0, Math.max(1, maxScenarios))
    .map((row, index) => ({
      goalieId: row.goalie_id,
      probability: row.normalized_start_probability,
      rawProbability: row.adjusted_start_probability,
      rank: index + 1,
    }));
}

export function buildGoalieStarterBranchProjectionRows(
  rows: GoalieStarterBranchProjectionInput[],
  generatedAt?: string
): GoalieStarterBranchProjectionRow[] {
  const updatedAt = generatedAt ?? new Date().toISOString();
  return rows.map((row) => ({
    ...row,
    branch_key: [
      row.mixture_version,
      row.projection_version,
      row.game_id,
      row.team_id,
      row.goalie_id,
    ].join(":"),
    weighted_proj_shots_against: weighted(row.proj_shots_against, row.branch_probability),
    weighted_proj_saves: weighted(row.proj_saves, row.branch_probability),
    weighted_proj_goals_allowed: weighted(row.proj_goals_allowed, row.branch_probability),
    weighted_proj_win_prob: weighted(row.proj_win_prob, row.branch_probability),
    weighted_proj_shutout_prob: weighted(row.proj_shutout_prob, row.branch_probability),
    provenance: row.provenance ?? {},
    updated_at: updatedAt,
  }));
}

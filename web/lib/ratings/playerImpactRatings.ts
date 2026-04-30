type RatingKind = "skater_offense" | "skater_defense" | "goalie";

export type PlayerImpactSourceRow = {
  player_id: number | null;
  player_name?: string | null;
  team_id: number | null;
  position_code?: string | null;
  date: string | null;
  games_played?: number | null;
  [key: string]: unknown;
};

export type PlayerImpactRatingRow = {
  snapshot_date: string;
  season_id: number;
  player_id: number;
  team_id: number | null;
  rating_0_to_100: number;
  rating_raw: number;
  league_rank: number;
  percentile: number;
  sample_games: number;
  sample_toi_seconds: number;
  model_name: string;
  model_version: string;
  source_window: string;
  components: Record<string, number | null>;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type BuildPlayerImpactRatingsInput = {
  seasonId: number;
  snapshotDate: string;
  skaterRows: PlayerImpactSourceRow[];
  goalieRows: PlayerImpactSourceRow[];
  minSkaterToiSeconds?: number;
  minGoalieToiSeconds?: number;
};

export type BuildPlayerImpactRatingsResult = {
  skaterOffenseRows: PlayerImpactRatingRow[];
  skaterDefenseRows: PlayerImpactRatingRow[];
  goalieRows: PlayerImpactRatingRow[];
};

type SkaterAggregate = {
  playerId: number;
  teamId: number | null;
  positionCode: string | null;
  sourceRows: number;
  games: number;
  toiSeconds: number;
  weighted: Record<string, number>;
};

type GoalieAggregate = {
  playerId: number;
  teamId: number | null;
  sourceRows: number;
  games: number;
  starts: number;
  toiSeconds: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  gsaa: number;
  weighted: Record<string, number>;
};

const SKATER_MODEL_VERSION = "skater_impact_v1_game_log_toi_shrunk";
const GOALIE_MODEL_VERSION = "goalie_impact_v1_game_log_toi_shrunk";

const OFFENSE_COMPONENTS = [
  ["pointsPer60", 0.24],
  ["goalsPer60", 0.16],
  ["firstAssistsPer60", 0.12],
  ["ixgPer60", 0.16],
  ["shotsPer60", 0.1],
  ["icfPer60", 0.08],
  ["oiXgfPer60", 0.08],
  ["oiXgfPctEdge", 0.06],
] as const;

const DEFENSE_COMPONENTS = [
  ["negativeOiXgaPer60", 0.24],
  ["negativeOiCaPer60", 0.14],
  ["negativeOiScaPer60", 0.12],
  ["oiXgfPctEdge", 0.16],
  ["oiCfPctEdge", 0.12],
  ["shotsBlockedPer60", 0.1],
  ["takeawayGiveawayPer60", 0.08],
  ["defZoneStartPer60", 0.04],
] as const;

const GOALIE_COMPONENTS = [
  ["gsaaPer60", 0.5],
  ["savePct", 0.28],
  ["qualityStartPct", 0.12],
  ["negativeGoalsAgainstPer60", 0.1],
] as const;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round(value: number, decimals = 6): number {
  return Number(value.toFixed(decimals));
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function addWeighted(
  target: Record<string, number>,
  key: string,
  value: unknown,
  weight: number,
) {
  const numberValue = finiteNumber(value);
  if (numberValue == null || weight <= 0) return;
  target[key] = (target[key] ?? 0) + numberValue * weight;
}

function weightedAverage(
  weighted: Record<string, number>,
  key: string,
  totalWeight: number,
): number | null {
  if (totalWeight <= 0 || weighted[key] == null) return null;
  return weighted[key] / totalWeight;
}

function normalizeToiSeconds(value: unknown): number {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return 0;
  return n;
}

function zScore(value: number | null, mean: number, stdDev: number): number {
  if (value == null || stdDev <= 0) return 0;
  return (value - mean) / stdDev;
}

function meanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

function componentStats<T extends Record<string, number | null>>(
  rows: T[],
  keys: readonly string[],
): Record<string, { mean: number; stdDev: number }> {
  const stats: Record<string, { mean: number; stdDev: number }> = {};
  for (const key of keys) {
    stats[key] = meanAndStdDev(
      rows
        .map((row) => row[key])
        .filter((value): value is number => value != null),
    );
  }
  return stats;
}

function aggregateSkaters(
  rows: PlayerImpactSourceRow[],
  snapshotDate: string,
): SkaterAggregate[] {
  const aggregates = new Map<number, SkaterAggregate>();
  for (const row of rows) {
    const playerId = finiteNumber(row.player_id);
    const rowDate = dateOnly(row.date);
    if (playerId == null || !rowDate || rowDate > snapshotDate) continue;

    const toiSeconds = normalizeToiSeconds(row.nst_toi ?? row.toi_per_game);
    if (toiSeconds <= 0) continue;

    let aggregate = aggregates.get(playerId);
    if (!aggregate) {
      aggregate = {
        playerId,
        teamId: finiteNumber(row.team_id),
        positionCode:
          typeof row.position_code === "string" ? row.position_code : null,
        sourceRows: 0,
        games: 0,
        toiSeconds: 0,
        weighted: {},
      };
      aggregates.set(playerId, aggregate);
    }

    aggregate.teamId = finiteNumber(row.team_id) ?? aggregate.teamId;
    aggregate.sourceRows += 1;
    aggregate.games += Math.max(1, finiteNumber(row.games_played) ?? 1);
    aggregate.toiSeconds += toiSeconds;

    addWeighted(aggregate.weighted, "pointsPer60", row.nst_points_per_60, toiSeconds);
    addWeighted(aggregate.weighted, "goalsPer60", row.nst_goals_per_60, toiSeconds);
    addWeighted(
      aggregate.weighted,
      "firstAssistsPer60",
      row.nst_first_assists_per_60,
      toiSeconds,
    );
    addWeighted(aggregate.weighted, "ixgPer60", row.nst_ixg_per_60, toiSeconds);
    addWeighted(aggregate.weighted, "shotsPer60", row.nst_shots_per_60, toiSeconds);
    addWeighted(aggregate.weighted, "icfPer60", row.nst_icf_per_60, toiSeconds);
    addWeighted(
      aggregate.weighted,
      "oiXgfPer60",
      row.nst_oi_xgf_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "oiXgaPer60",
      row.nst_oi_xga_per_60,
      toiSeconds,
    );
    addWeighted(aggregate.weighted, "oiCaPer60", row.nst_oi_ca_per_60, toiSeconds);
    addWeighted(
      aggregate.weighted,
      "oiScaPer60",
      row.nst_oi_sca_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "oiXgfPct",
      row.nst_oi_xgf_pct_rates ?? row.nst_oi_xgf_pct,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "oiCfPct",
      row.nst_oi_cf_pct_rates ?? row.nst_oi_cf_pct,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "shotsBlockedPer60",
      row.nst_shots_blocked_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "takeawaysPer60",
      row.nst_takeaways_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "giveawaysPer60",
      row.nst_giveaways_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "defZoneStartPer60",
      row.nst_oi_def_zone_starts_per_60,
      toiSeconds,
    );
  }
  return Array.from(aggregates.values());
}

function aggregateGoalies(
  rows: PlayerImpactSourceRow[],
  snapshotDate: string,
): GoalieAggregate[] {
  const aggregates = new Map<number, GoalieAggregate>();
  for (const row of rows) {
    const playerId = finiteNumber(row.player_id);
    const rowDate = dateOnly(row.date);
    if (playerId == null || !rowDate || rowDate > snapshotDate) continue;

    const toiSeconds = normalizeToiSeconds(row.time_on_ice);
    if (toiSeconds <= 0) continue;

    let aggregate = aggregates.get(playerId);
    if (!aggregate) {
      aggregate = {
        playerId,
        teamId: finiteNumber(row.team_id),
        sourceRows: 0,
        games: 0,
        starts: 0,
        toiSeconds: 0,
        saves: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        gsaa: 0,
        weighted: {},
      };
      aggregates.set(playerId, aggregate);
    }

    aggregate.teamId = finiteNumber(row.team_id) ?? aggregate.teamId;
    aggregate.sourceRows += 1;
    aggregate.games += Math.max(1, finiteNumber(row.games_played) ?? 1);
    aggregate.starts += finiteNumber(row.games_started) ?? 0;
    aggregate.toiSeconds += toiSeconds;
    aggregate.saves += finiteNumber(row.saves) ?? 0;
    aggregate.shotsAgainst += finiteNumber(row.shots_against) ?? 0;
    aggregate.goalsAgainst += finiteNumber(row.goals_against) ?? 0;
    aggregate.gsaa +=
      finiteNumber(row.nst_all_counts_gsaa) ??
      finiteNumber(row.nst_5v5_counts_gsaa) ??
      0;

    addWeighted(
      aggregate.weighted,
      "gsaaPer60",
      row.nst_all_rates_gsaa_per_60 ?? row.nst_5v5_rates_gsaa_per_60,
      toiSeconds,
    );
    addWeighted(
      aggregate.weighted,
      "qualityStartPct",
      row.quality_starts_pct,
      toiSeconds,
    );
  }
  return Array.from(aggregates.values());
}

function skaterComponents(aggregate: SkaterAggregate) {
  const toi = aggregate.toiSeconds;
  const oiXgfPct = weightedAverage(aggregate.weighted, "oiXgfPct", toi);
  const oiCfPct = weightedAverage(aggregate.weighted, "oiCfPct", toi);
  const takeaways = weightedAverage(aggregate.weighted, "takeawaysPer60", toi);
  const giveaways = weightedAverage(aggregate.weighted, "giveawaysPer60", toi);

  return {
    playerId: aggregate.playerId,
    teamId: aggregate.teamId,
    positionCode: aggregate.positionCode,
    sourceRows: aggregate.sourceRows,
    sampleGames: aggregate.games,
    sampleToiSeconds: aggregate.toiSeconds,
    pointsPer60: weightedAverage(aggregate.weighted, "pointsPer60", toi),
    goalsPer60: weightedAverage(aggregate.weighted, "goalsPer60", toi),
    firstAssistsPer60: weightedAverage(aggregate.weighted, "firstAssistsPer60", toi),
    ixgPer60: weightedAverage(aggregate.weighted, "ixgPer60", toi),
    shotsPer60: weightedAverage(aggregate.weighted, "shotsPer60", toi),
    icfPer60: weightedAverage(aggregate.weighted, "icfPer60", toi),
    oiXgfPer60: weightedAverage(aggregate.weighted, "oiXgfPer60", toi),
    negativeOiXgaPer60:
      weightedAverage(aggregate.weighted, "oiXgaPer60", toi) == null
        ? null
        : -weightedAverage(aggregate.weighted, "oiXgaPer60", toi)!,
    negativeOiCaPer60:
      weightedAverage(aggregate.weighted, "oiCaPer60", toi) == null
        ? null
        : -weightedAverage(aggregate.weighted, "oiCaPer60", toi)!,
    negativeOiScaPer60:
      weightedAverage(aggregate.weighted, "oiScaPer60", toi) == null
        ? null
        : -weightedAverage(aggregate.weighted, "oiScaPer60", toi)!,
    oiXgfPctEdge: oiXgfPct == null ? null : oiXgfPct - 50,
    oiCfPctEdge: oiCfPct == null ? null : oiCfPct - 50,
    shotsBlockedPer60: weightedAverage(aggregate.weighted, "shotsBlockedPer60", toi),
    takeawayGiveawayPer60:
      takeaways == null && giveaways == null ? null : (takeaways ?? 0) - (giveaways ?? 0),
    defZoneStartPer60: weightedAverage(aggregate.weighted, "defZoneStartPer60", toi),
  };
}

function goalieComponents(aggregate: GoalieAggregate) {
  const savePct =
    aggregate.shotsAgainst > 0 ? aggregate.saves / aggregate.shotsAgainst : null;
  const goalsAgainstPer60 =
    aggregate.toiSeconds > 0
      ? (aggregate.goalsAgainst / aggregate.toiSeconds) * 3600
      : null;
  const gsaaPer60 =
    weightedAverage(aggregate.weighted, "gsaaPer60", aggregate.toiSeconds) ??
    (aggregate.toiSeconds > 0 ? (aggregate.gsaa / aggregate.toiSeconds) * 3600 : null);

  return {
    playerId: aggregate.playerId,
    teamId: aggregate.teamId,
    sourceRows: aggregate.sourceRows,
    sampleGames: aggregate.games,
    sampleToiSeconds: aggregate.toiSeconds,
    gsaaPer60,
    savePct,
    qualityStartPct: weightedAverage(
      aggregate.weighted,
      "qualityStartPct",
      aggregate.toiSeconds,
    ),
    negativeGoalsAgainstPer60:
      goalsAgainstPer60 == null ? null : -goalsAgainstPer60,
    gamesStarted: aggregate.starts,
  };
}

function scoreComponents(
  row: Record<string, number | null>,
  stats: Record<string, { mean: number; stdDev: number }>,
  weights: readonly (readonly [string, number])[],
): number {
  let score = 0;
  for (const [key, weight] of weights) {
    score += zScore(row[key], stats[key]?.mean ?? 0, stats[key]?.stdDev ?? 0) * weight;
  }
  return score;
}

function buildRows<T extends Record<string, any>>(args: {
  kind: RatingKind;
  seasonId: number;
  snapshotDate: string;
  componentRows: T[];
  scoreWeights: readonly (readonly [string, number])[];
  minToiSeconds: number;
}): PlayerImpactRatingRow[] {
  const componentKeys = args.scoreWeights.map(([key]) => key);
  const stats = componentStats(args.componentRows, componentKeys);
  const scoredRows = args.componentRows
    .map((row) => {
      const rawScore = scoreComponents(row, stats, args.scoreWeights);
      const shrinkage =
        row.sampleToiSeconds / (row.sampleToiSeconds + args.minToiSeconds);
      return {
        ...row,
        ratingRaw: rawScore * shrinkage,
        shrinkage,
      };
    })
    .sort((a, b) => b.ratingRaw - a.ratingRaw);

  const denominator = Math.max(1, scoredRows.length - 1);
  return scoredRows.map((row, index) => {
    const percentile = scoredRows.length === 1 ? 1 : 1 - index / denominator;
    const components: Record<string, number | null> = {};
    for (const key of componentKeys) {
      components[key] = row[key] == null ? null : round(row[key]);
    }

    return {
      snapshot_date: args.snapshotDate,
      season_id: args.seasonId,
      player_id: row.playerId,
      team_id: row.teamId,
      rating_0_to_100: round(percentile * 100, 3),
      rating_raw: round(row.ratingRaw),
      league_rank: index + 1,
      percentile: round(percentile, 6),
      sample_games: row.sampleGames,
      sample_toi_seconds: Math.round(row.sampleToiSeconds),
      model_name: args.kind,
      model_version:
        args.kind === "goalie" ? GOALIE_MODEL_VERSION : SKATER_MODEL_VERSION,
      source_window: "season_to_date",
      components: {
        ...components,
        shrinkage: round(row.shrinkage),
      },
      provenance: {
        sourceTables:
          args.kind === "goalie"
            ? ["vw_goalie_stats_unified"]
            : ["player_stats_unified"],
        sourceRows: row.sourceRows,
      },
      metadata: {
        ratingKind: args.kind,
        positionCode: row.positionCode ?? null,
        gamesStarted: row.gamesStarted ?? null,
        minToiSeconds: args.minToiSeconds,
      },
    };
  });
}

export function buildPlayerImpactRatings(
  input: BuildPlayerImpactRatingsInput,
): BuildPlayerImpactRatingsResult {
  const minSkaterToiSeconds = input.minSkaterToiSeconds ?? 3600;
  const minGoalieToiSeconds = input.minGoalieToiSeconds ?? 2400;
  const skaterComponentRows = aggregateSkaters(
    input.skaterRows,
    input.snapshotDate,
  ).map(skaterComponents);
  const goalieComponentRows = aggregateGoalies(
    input.goalieRows,
    input.snapshotDate,
  ).map(goalieComponents);

  return {
    skaterOffenseRows: buildRows({
      kind: "skater_offense",
      seasonId: input.seasonId,
      snapshotDate: input.snapshotDate,
      componentRows: skaterComponentRows,
      scoreWeights: OFFENSE_COMPONENTS,
      minToiSeconds: minSkaterToiSeconds,
    }),
    skaterDefenseRows: buildRows({
      kind: "skater_defense",
      seasonId: input.seasonId,
      snapshotDate: input.snapshotDate,
      componentRows: skaterComponentRows,
      scoreWeights: DEFENSE_COMPONENTS,
      minToiSeconds: minSkaterToiSeconds,
    }),
    goalieRows: buildRows({
      kind: "goalie",
      seasonId: input.seasonId,
      snapshotDate: input.snapshotDate,
      componentRows: goalieComponentRows,
      scoreWeights: GOALIE_COMPONENTS,
      minToiSeconds: minGoalieToiSeconds,
    }),
  };
}

export function uniqueSnapshotDatesFromSources(
  rows: PlayerImpactSourceRow[],
  startDate: string,
  endDate: string,
): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => dateOnly(row.date))
        .filter(
          (date): date is string =>
            date != null && date >= startDate && date <= endDate,
        ),
    ),
  ).sort();
}

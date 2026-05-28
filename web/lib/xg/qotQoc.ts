import type { NhlShiftStint } from "../supabase/Upserts/nhlShiftStints";

export type QotQocPositionGroup = "forward" | "defense" | "goalie" | "unknown";
export type QotQocToiBucket = "low" | "middle" | "high";
export type QotQocFeatureAvailability = "postgame_descriptive" | "pregame_safe_with_freshness";
export type QotQocUnitType = "line" | "pair";

export type QotQocRatingInput = {
  playerId: number;
  positionGroup: QotQocPositionGroup;
  toiSeconds: number;
  offensiveMetric: number;
  defensiveMetric: number;
};

export type QotQocPlayerRating = {
  player_id: number;
  position_group: QotQocPositionGroup;
  toi_bucket: QotQocToiBucket;
  sample_toi_seconds: number;
  offensive_metric: number;
  defensive_metric: number;
  offensive_percentile: number;
  defensive_percentile: number;
};

export type QotQocPlayerGameFeatureRow = {
  qot_qoc_version: string;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  player_id: number;
  team_id: number;
  source_scope: "postgame_shift_overlap";
  feature_availability: QotQocFeatureAvailability;
  rating_snapshot_date: string | null;
  toi_overlap_seconds: number;
  qot_offensive_percentile: number | null;
  qot_defensive_percentile: number | null;
  qoc_offensive_percentile: number | null;
  qoc_defensive_percentile: number | null;
  teammate_count_weighted: number;
  opponent_count_weighted: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type QotQocUnitGameFeatureRow = {
  qot_qoc_version: string;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  team_id: number;
  unit_type: QotQocUnitType;
  unit_key: string;
  player_ids: number[];
  source_scope: "postgame_shift_overlap";
  feature_availability: QotQocFeatureAvailability;
  rating_snapshot_date: string | null;
  toi_overlap_seconds: number;
  unit_offensive_percentile: number | null;
  unit_defensive_percentile: number | null;
  qoc_offensive_percentile: number | null;
  qoc_defensive_percentile: number | null;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type QotQocPlayerRollingFeatureRow = Omit<
  QotQocPlayerGameFeatureRow,
  "game_id" | "game_date" | "toi_overlap_seconds"
> & {
  as_of_game_id: number;
  as_of_game_date: string | null;
  window_games: number;
  games_count: number;
  toi_overlap_seconds: number;
};

export type BuildQotQocFeatureRowsResult = {
  playerGameRows: QotQocPlayerGameFeatureRow[];
  unitGameRows: QotQocUnitGameFeatureRow[];
  playerRollingRows: QotQocPlayerRollingFeatureRow[];
};

export type QotQocLeakageValidationReport = {
  passed: boolean;
  feature_availability: QotQocFeatureAvailability;
  usage_mode: "postgame_descriptive" | "pregame";
  blocking_reasons: string[];
};

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function gameSortValue(row: { game_date?: string | null; game_id: number }): string {
  return `${row.game_date ?? "9999-12-31"}:${String(row.game_id).padStart(10, "0")}`;
}

function percentileRank(sortedValues: number[], value: number): number {
  if (sortedValues.length <= 1) return 1;
  let belowOrEqual = 0;
  for (const candidate of sortedValues) {
    if (candidate <= value) belowOrEqual += 1;
  }
  return roundMetric((belowOrEqual - 1) / (sortedValues.length - 1));
}

function buildBucketByPlayer(rows: QotQocRatingInput[]): Map<number, QotQocToiBucket> {
  const bucketByPlayer = new Map<number, QotQocToiBucket>();
  const byPosition = new Map<QotQocPositionGroup, QotQocRatingInput[]>();

  for (const row of rows) {
    const current = byPosition.get(row.positionGroup) ?? [];
    current.push(row);
    byPosition.set(row.positionGroup, current);
  }

  for (const positionRows of byPosition.values()) {
    const sorted = [...positionRows].sort((left, right) => {
      const toiDelta = left.toiSeconds - right.toiSeconds;
      return toiDelta !== 0 ? toiDelta : left.playerId - right.playerId;
    });
    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index]!;
      const rank = sorted.length <= 1 ? 1 : index / (sorted.length - 1);
      const bucket: QotQocToiBucket =
        rank < 1 / 3 ? "low" : rank < 2 / 3 ? "middle" : "high";
      bucketByPlayer.set(row.playerId, bucket);
    }
  }

  return bucketByPlayer;
}

export function buildQotQocPlayerRatings(rows: QotQocRatingInput[]): QotQocPlayerRating[] {
  const validRows = rows.filter(
    (row) =>
      Number.isFinite(row.playerId) &&
      Number.isFinite(row.toiSeconds) &&
      row.toiSeconds >= 0 &&
      Number.isFinite(row.offensiveMetric) &&
      Number.isFinite(row.defensiveMetric)
  );
  const bucketByPlayer = buildBucketByPlayer(validRows);
  const byComparableGroup = new Map<string, QotQocRatingInput[]>();

  for (const row of validRows) {
    const bucket = bucketByPlayer.get(row.playerId);
    if (!bucket) continue;
    const key = `${row.positionGroup}:${bucket}`;
    const current = byComparableGroup.get(key) ?? [];
    current.push(row);
    byComparableGroup.set(key, current);
  }

  return validRows
    .map((row) => {
      const bucket = bucketByPlayer.get(row.playerId) ?? "middle";
      const comparable = byComparableGroup.get(`${row.positionGroup}:${bucket}`) ?? [row];
      const offensiveValues = comparable
        .map((item) => item.offensiveMetric)
        .sort((left, right) => left - right);
      const defensiveValues = comparable
        .map((item) => item.defensiveMetric)
        .sort((left, right) => left - right);

      return {
        player_id: row.playerId,
        position_group: row.positionGroup,
        toi_bucket: bucket,
        sample_toi_seconds: row.toiSeconds,
        offensive_metric: roundMetric(row.offensiveMetric),
        defensive_metric: roundMetric(row.defensiveMetric),
        offensive_percentile: percentileRank(offensiveValues, row.offensiveMetric),
        defensive_percentile: percentileRank(defensiveValues, row.defensiveMetric),
      };
    })
    .sort((left, right) => left.player_id - right.player_id);
}

function averageRating(
  playerIds: number[],
  ratingByPlayer: ReadonlyMap<number, QotQocPlayerRating>,
  metric: "offensive_percentile" | "defensive_percentile"
): number | null {
  const values = playerIds
    .map((playerId) => ratingByPlayer.get(playerId)?.[metric])
    .filter((value): value is number => Number.isFinite(value));
  if (values.length === 0) return null;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function weightedAverage(total: number, seconds: number): number | null {
  if (seconds <= 0) return null;
  return roundMetric(total / seconds);
}

function addWeightedMetric(
  current: { total: number; seconds: number },
  value: number | null,
  seconds: number
) {
  if (value == null || !Number.isFinite(value) || seconds <= 0) return;
  current.total += value * seconds;
  current.seconds += seconds;
}

function sourceProvenance(args: {
  version: string;
  generatedAt: string;
  rollingWindowGames?: number;
}) {
  return {
    sourceTables: ["nhl_api_shift_rows", "skater_offensive_ratings_daily", "skater_defensive_ratings_daily"],
    qotQocVersion: args.version,
    sourceScope: "postgame_shift_overlap",
    featureAvailability: "postgame_descriptive",
    rollingWindowGames: args.rollingWindowGames ?? null,
    generatedAt: args.generatedAt,
  };
}

type PlayerAccumulator = {
  qot_qoc_version: string;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  player_id: number;
  team_id: number;
  rating_snapshot_date: string | null;
  toi_overlap_seconds: number;
  qotOffense: { total: number; seconds: number };
  qotDefense: { total: number; seconds: number };
  qocOffense: { total: number; seconds: number };
  qocDefense: { total: number; seconds: number };
  teammateCountWeighted: { total: number; seconds: number };
  opponentCountWeighted: { total: number; seconds: number };
};

type UnitAccumulator = {
  qot_qoc_version: string;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  team_id: number;
  unit_type: QotQocUnitType;
  unit_key: string;
  player_ids: number[];
  rating_snapshot_date: string | null;
  toi_overlap_seconds: number;
  unitOffense: { total: number; seconds: number };
  unitDefense: { total: number; seconds: number };
  qocOffense: { total: number; seconds: number };
  qocDefense: { total: number; seconds: number };
};

function emptyWeighted() {
  return { total: 0, seconds: 0 };
}

function positionPlayers(
  playerIds: number[],
  ratingByPlayer: ReadonlyMap<number, QotQocPlayerRating>,
  positionGroup: QotQocPositionGroup
): number[] {
  return playerIds.filter((playerId) => ratingByPlayer.get(playerId)?.position_group === positionGroup);
}

function buildUnitKey(playerIds: number[]): string {
  return playerIds.slice().sort((left, right) => left - right).join("-");
}

function addUnitRows(args: {
  accumulators: Map<string, UnitAccumulator>;
  version: string;
  ratingSnapshotDate: string | null;
  teamId: number;
  opponentPlayerIds: number[];
  seasonId: number | null;
  gameId: number;
  gameDate: string | null;
  durationSeconds: number;
  playerIds: number[];
  unitType: QotQocUnitType;
  ratingByPlayer: ReadonlyMap<number, QotQocPlayerRating>;
}) {
  if (args.playerIds.length < 2) return;
  const unitKey = buildUnitKey(args.playerIds);
  const key = `${args.version}:${args.gameId}:${args.teamId}:${args.unitType}:${unitKey}`;
  const accumulator =
    args.accumulators.get(key) ??
    ({
      qot_qoc_version: args.version,
      season_id: args.seasonId,
      game_id: args.gameId,
      game_date: args.gameDate,
      team_id: args.teamId,
      unit_type: args.unitType,
      unit_key: unitKey,
      player_ids: args.playerIds.slice().sort((left, right) => left - right),
      rating_snapshot_date: args.ratingSnapshotDate,
      toi_overlap_seconds: 0,
      unitOffense: emptyWeighted(),
      unitDefense: emptyWeighted(),
      qocOffense: emptyWeighted(),
      qocDefense: emptyWeighted(),
    } satisfies UnitAccumulator);

  const seconds = args.durationSeconds;
  accumulator.toi_overlap_seconds += seconds;
  addWeightedMetric(
    accumulator.unitOffense,
    averageRating(args.playerIds, args.ratingByPlayer, "offensive_percentile"),
    seconds
  );
  addWeightedMetric(
    accumulator.unitDefense,
    averageRating(args.playerIds, args.ratingByPlayer, "defensive_percentile"),
    seconds
  );
  addWeightedMetric(
    accumulator.qocOffense,
    averageRating(args.opponentPlayerIds, args.ratingByPlayer, "offensive_percentile"),
    seconds
  );
  addWeightedMetric(
    accumulator.qocDefense,
    averageRating(args.opponentPlayerIds, args.ratingByPlayer, "defensive_percentile"),
    seconds
  );
  args.accumulators.set(key, accumulator);
}

function buildRollingRows(args: {
  rows: QotQocPlayerGameFeatureRow[];
  windows: number[];
  generatedAt: string;
}): QotQocPlayerRollingFeatureRow[] {
  const byPlayer = new Map<number, QotQocPlayerGameFeatureRow[]>();
  for (const row of args.rows) {
    const current = byPlayer.get(row.player_id) ?? [];
    current.push(row);
    byPlayer.set(row.player_id, current);
  }

  const out: QotQocPlayerRollingFeatureRow[] = [];
  for (const [playerId, rows] of byPlayer) {
    const sorted = [...rows].sort((left, right) =>
      gameSortValue(left).localeCompare(gameSortValue(right))
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      for (const windowGames of args.windows) {
        const windowRows = sorted.slice(Math.max(0, index - windowGames + 1), index + 1);
        const seconds = windowRows.reduce((sum, row) => sum + row.toi_overlap_seconds, 0);
        const weighted = (metric: keyof Pick<
          QotQocPlayerGameFeatureRow,
          | "qot_offensive_percentile"
          | "qot_defensive_percentile"
          | "qoc_offensive_percentile"
          | "qoc_defensive_percentile"
          | "teammate_count_weighted"
          | "opponent_count_weighted"
        >) =>
          weightedAverage(
            windowRows.reduce(
              (sum, row) => sum + ((row[metric] as number | null) ?? 0) * row.toi_overlap_seconds,
              0
            ),
            seconds
          );

        out.push({
          qot_qoc_version: current.qot_qoc_version,
          season_id: current.season_id,
          player_id: playerId,
          team_id: current.team_id,
          as_of_game_id: current.game_id,
          as_of_game_date: current.game_date,
          window_games: windowGames,
          games_count: windowRows.length,
          source_scope: current.source_scope,
          feature_availability: current.feature_availability,
          rating_snapshot_date: current.rating_snapshot_date,
          toi_overlap_seconds: seconds,
          qot_offensive_percentile: weighted("qot_offensive_percentile"),
          qot_defensive_percentile: weighted("qot_defensive_percentile"),
          qoc_offensive_percentile: weighted("qoc_offensive_percentile"),
          qoc_defensive_percentile: weighted("qoc_defensive_percentile"),
          teammate_count_weighted: weighted("teammate_count_weighted") ?? 0,
          opponent_count_weighted: weighted("opponent_count_weighted") ?? 0,
          provenance: sourceProvenance({
            version: current.qot_qoc_version,
            generatedAt: args.generatedAt,
            rollingWindowGames: windowGames,
          }),
          updated_at: args.generatedAt,
        });
      }
    }
  }
  return out;
}

export function buildQotQocFeatureRows(args: {
  version: string;
  stints: NhlShiftStint[];
  ratings: QotQocPlayerRating[];
  ratingSnapshotDate?: string | null;
  generatedAt?: string;
  rollingWindows?: number[];
}): BuildQotQocFeatureRowsResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const windows = args.rollingWindows?.length
    ? Array.from(new Set(args.rollingWindows.filter((value) => Number.isInteger(value) && value > 0)))
    : [5, 10, 20];
  const ratingByPlayer = new Map(args.ratings.map((row) => [row.player_id, row]));
  const playerAccumulators = new Map<string, PlayerAccumulator>();
  const unitAccumulators = new Map<string, UnitAccumulator>();

  for (const stint of args.stints) {
    if (stint.durationSeconds <= 0 || stint.teams.length < 2) continue;

    for (const team of stint.teams) {
      const opponentPlayers = stint.teams
        .filter((candidate) => candidate.teamId !== team.teamId)
        .flatMap((candidate) => candidate.playerIds);
      const skaterPlayers = team.playerIds.filter((playerId) => {
        const position = ratingByPlayer.get(playerId)?.position_group;
        return position !== "goalie";
      });

      for (const playerId of skaterPlayers) {
        const teammates = skaterPlayers.filter((candidate) => candidate !== playerId);
        const key = `${args.version}:${stint.gameId}:${playerId}`;
        const accumulator =
          playerAccumulators.get(key) ??
          ({
            qot_qoc_version: args.version,
            season_id: stint.seasonId,
            game_id: stint.gameId,
            game_date: stint.gameDate,
            player_id: playerId,
            team_id: team.teamId,
            rating_snapshot_date: args.ratingSnapshotDate ?? null,
            toi_overlap_seconds: 0,
            qotOffense: emptyWeighted(),
            qotDefense: emptyWeighted(),
            qocOffense: emptyWeighted(),
            qocDefense: emptyWeighted(),
            teammateCountWeighted: emptyWeighted(),
            opponentCountWeighted: emptyWeighted(),
          } satisfies PlayerAccumulator);

        accumulator.toi_overlap_seconds += stint.durationSeconds;
        addWeightedMetric(
          accumulator.qotOffense,
          averageRating(teammates, ratingByPlayer, "offensive_percentile"),
          stint.durationSeconds
        );
        addWeightedMetric(
          accumulator.qotDefense,
          averageRating(teammates, ratingByPlayer, "defensive_percentile"),
          stint.durationSeconds
        );
        addWeightedMetric(
          accumulator.qocOffense,
          averageRating(opponentPlayers, ratingByPlayer, "offensive_percentile"),
          stint.durationSeconds
        );
        addWeightedMetric(
          accumulator.qocDefense,
          averageRating(opponentPlayers, ratingByPlayer, "defensive_percentile"),
          stint.durationSeconds
        );
        addWeightedMetric(accumulator.teammateCountWeighted, teammates.length, stint.durationSeconds);
        addWeightedMetric(accumulator.opponentCountWeighted, opponentPlayers.length, stint.durationSeconds);
        playerAccumulators.set(key, accumulator);
      }

      addUnitRows({
        accumulators: unitAccumulators,
        version: args.version,
        ratingSnapshotDate: args.ratingSnapshotDate ?? null,
        teamId: team.teamId,
        opponentPlayerIds: opponentPlayers,
        seasonId: stint.seasonId,
        gameId: stint.gameId,
        gameDate: stint.gameDate,
        durationSeconds: stint.durationSeconds,
        playerIds: positionPlayers(skaterPlayers, ratingByPlayer, "forward"),
        unitType: "line",
        ratingByPlayer,
      });
      addUnitRows({
        accumulators: unitAccumulators,
        version: args.version,
        ratingSnapshotDate: args.ratingSnapshotDate ?? null,
        teamId: team.teamId,
        opponentPlayerIds: opponentPlayers,
        seasonId: stint.seasonId,
        gameId: stint.gameId,
        gameDate: stint.gameDate,
        durationSeconds: stint.durationSeconds,
        playerIds: positionPlayers(skaterPlayers, ratingByPlayer, "defense"),
        unitType: "pair",
        ratingByPlayer,
      });
    }
  }

  const playerGameRows = Array.from(playerAccumulators.values())
    .map((row) => ({
      qot_qoc_version: row.qot_qoc_version,
      season_id: row.season_id,
      game_id: row.game_id,
      game_date: row.game_date,
      player_id: row.player_id,
      team_id: row.team_id,
      source_scope: "postgame_shift_overlap" as const,
      feature_availability: "postgame_descriptive" as const,
      rating_snapshot_date: row.rating_snapshot_date,
      toi_overlap_seconds: row.toi_overlap_seconds,
      qot_offensive_percentile: weightedAverage(row.qotOffense.total, row.qotOffense.seconds),
      qot_defensive_percentile: weightedAverage(row.qotDefense.total, row.qotDefense.seconds),
      qoc_offensive_percentile: weightedAverage(row.qocOffense.total, row.qocOffense.seconds),
      qoc_defensive_percentile: weightedAverage(row.qocDefense.total, row.qocDefense.seconds),
      teammate_count_weighted: weightedAverage(
        row.teammateCountWeighted.total,
        row.teammateCountWeighted.seconds
      ) ?? 0,
      opponent_count_weighted: weightedAverage(
        row.opponentCountWeighted.total,
        row.opponentCountWeighted.seconds
      ) ?? 0,
      provenance: sourceProvenance({ version: row.qot_qoc_version, generatedAt }),
      updated_at: generatedAt,
    }))
    .sort((left, right) =>
      `${gameSortValue(left)}:${left.player_id}`.localeCompare(
        `${gameSortValue(right)}:${right.player_id}`
      )
    );

  const unitGameRows = Array.from(unitAccumulators.values())
    .map((row) => ({
      qot_qoc_version: row.qot_qoc_version,
      season_id: row.season_id,
      game_id: row.game_id,
      game_date: row.game_date,
      team_id: row.team_id,
      unit_type: row.unit_type,
      unit_key: row.unit_key,
      player_ids: row.player_ids,
      source_scope: "postgame_shift_overlap" as const,
      feature_availability: "postgame_descriptive" as const,
      rating_snapshot_date: row.rating_snapshot_date,
      toi_overlap_seconds: row.toi_overlap_seconds,
      unit_offensive_percentile: weightedAverage(row.unitOffense.total, row.unitOffense.seconds),
      unit_defensive_percentile: weightedAverage(row.unitDefense.total, row.unitDefense.seconds),
      qoc_offensive_percentile: weightedAverage(row.qocOffense.total, row.qocOffense.seconds),
      qoc_defensive_percentile: weightedAverage(row.qocDefense.total, row.qocDefense.seconds),
      provenance: sourceProvenance({ version: row.qot_qoc_version, generatedAt }),
      updated_at: generatedAt,
    }))
    .sort((left, right) =>
      `${gameSortValue(left)}:${left.team_id}:${left.unit_type}:${left.unit_key}`.localeCompare(
        `${gameSortValue(right)}:${right.team_id}:${right.unit_type}:${right.unit_key}`
      )
    );

  return {
    playerGameRows,
    unitGameRows,
    playerRollingRows: buildRollingRows({ rows: playerGameRows, windows, generatedAt }),
  };
}

export function validateQotQocLeakage(args: {
  featureAvailability: QotQocFeatureAvailability;
  usageMode: "postgame_descriptive" | "pregame";
}): QotQocLeakageValidationReport {
  const blockingReasons: string[] = [];
  if (
    args.usageMode === "pregame" &&
    args.featureAvailability === "postgame_descriptive"
  ) {
    blockingReasons.push("postgame_shift_overlap_qot_qoc_is_not_pregame_safe");
    blockingReasons.push("same_game_teammate_opponent_overlap_leakage");
  }

  return {
    passed: blockingReasons.length === 0,
    feature_availability: args.featureAvailability,
    usage_mode: args.usageMode,
    blocking_reasons: blockingReasons,
  };
}

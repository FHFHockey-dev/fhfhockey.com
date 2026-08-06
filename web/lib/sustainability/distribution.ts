export type SustainabilityDistributionSnapshot = {
  count: number;
  minimum: number;
  maximum: number;
  mean: number;
  stdev: number;
  percentiles: {
    p10: number;
    p20: number;
    p25: number;
    p40: number;
    p50: number;
    p60: number;
    p75: number;
    p80: number;
    p90: number;
  };
};

export type SustainabilityScoreWithQuintile = {
  player_id: number;
  window_code: string;
  s_100: number;
  sustainability_quintile?: number | null;
};

export type SustainabilityDistributionSnapshotRow = {
  config_revision: number;
  model_version: string;
  config_hash: string;
  season_id: number;
  snapshot_date: string;
  window_code: string;
  population_count: number;
  minimum: number;
  maximum: number;
  mean: number;
  stdev: number;
  percentiles: SustainabilityDistributionSnapshot["percentiles"];
};

type DistributionSnapshotClient = {
  from: (table: "sustainability_distribution_snapshots") => {
    upsert: (
      rows: SustainabilityDistributionSnapshotRow[],
      options: { onConflict: string },
    ) => PromiseLike<{ error: Error | null }>;
  };
};

function round(value: number) {
  return Number(value.toFixed(4));
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function buildSustainabilityDistributionSnapshot(
  scores: number[],
): SustainabilityDistributionSnapshot | null {
  const sorted = scores.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    minimum: sorted[0],
    maximum: sorted.at(-1)!,
    mean: round(mean),
    stdev: round(Math.sqrt(variance)),
    percentiles: {
      p10: round(percentile(sorted, 0.1)),
      p20: round(percentile(sorted, 0.2)),
      p25: round(percentile(sorted, 0.25)),
      p40: round(percentile(sorted, 0.4)),
      p50: round(percentile(sorted, 0.5)),
      p60: round(percentile(sorted, 0.6)),
      p75: round(percentile(sorted, 0.75)),
      p80: round(percentile(sorted, 0.8)),
      p90: round(percentile(sorted, 0.9)),
    },
  };
}

export function assignSustainabilityQuintiles<
  T extends SustainabilityScoreWithQuintile,
>(
  rows: T[],
  snapshots: Record<string, SustainabilityDistributionSnapshot | null>,
): Array<T & { sustainability_quintile: number | null }> {
  const quintileByKey = new Map<string, number>();
  for (const windowCode of Object.keys(snapshots)) {
    if (!snapshots[windowCode]) continue;
    const population = rows
      .filter(
        (row) => row.window_code === windowCode && Number.isFinite(row.s_100),
      )
      .sort((left, right) =>
        left.s_100 === right.s_100
          ? left.player_id - right.player_id
          : left.s_100 - right.s_100,
      );
    const baseSize = Math.floor(population.length / 5);
    const largerBuckets = population.length % 5;
    let index = 0;
    for (let quintile = 0; quintile < 5; quintile += 1) {
      const bucketSize = baseSize + (quintile < largerBuckets ? 1 : 0);
      for (let count = 0; count < bucketSize; count += 1) {
        const row = population[index];
        if (row) {
          quintileByKey.set(`${row.window_code}|${row.player_id}`, quintile);
        }
        index += 1;
      }
    }
  }
  return rows.map((row) => {
    const sustainabilityQuintile =
      quintileByKey.get(`${row.window_code}|${row.player_id}`) ?? null;
    return { ...row, sustainability_quintile: sustainabilityQuintile };
  });
}

export function toSustainabilityDistributionSnapshotRows(args: {
  configRevision: number;
  modelVersion: string;
  configHash: string;
  seasonId: number;
  snapshotDate: string;
  snapshots: Record<string, SustainabilityDistributionSnapshot | null>;
}): SustainabilityDistributionSnapshotRow[] {
  return Object.entries(args.snapshots).flatMap(([windowCode, snapshot]) =>
    snapshot
      ? [
          {
            config_revision: args.configRevision,
            model_version: args.modelVersion,
            config_hash: args.configHash,
            season_id: args.seasonId,
            snapshot_date: args.snapshotDate,
            window_code: windowCode,
            population_count: snapshot.count,
            minimum: snapshot.minimum,
            maximum: snapshot.maximum,
            mean: snapshot.mean,
            stdev: snapshot.stdev,
            percentiles: snapshot.percentiles,
          },
        ]
      : [],
  );
}

export async function persistSustainabilityDistributionSnapshots(args: {
  client: DistributionSnapshotClient;
  rows: SustainabilityDistributionSnapshotRow[];
  dry: boolean;
}): Promise<number> {
  if (args.dry || !args.rows.length) return 0;
  const { error } = await args.client
    .from("sustainability_distribution_snapshots")
    .upsert(args.rows, {
      onConflict: "config_revision,season_id,snapshot_date,window_code",
    });
  if (error) throw error;
  return args.rows.length;
}

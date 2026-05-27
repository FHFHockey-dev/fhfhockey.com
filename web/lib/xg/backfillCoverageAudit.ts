import type { SupabaseClient } from "@supabase/supabase-js";

type LooseSupabaseClient = SupabaseClient<any, any, any>;

export type XgBackfillCoverageAuditArgs = {
  supabase: LooseSupabaseClient;
  seasonId: number;
  gameTypes: number[] | null;
  featureVersion: number;
  parserVersion: number;
  strengthVersion: number;
  modelVersion: string | null;
  predictionType: "shot_goal" | "rebound_creation";
  sampleLimit: number;
};

type GameCoverageRow = {
  id: number;
  date: string | null;
  type: number | null;
};

type QueryFilter = {
  column: string;
  value: string | number | boolean | null;
};

export type XgBackfillCoverageAudit = {
  seasonId: number;
  gameTypes: number[] | null;
  featureVersion: number;
  parserVersion: number;
  strengthVersion: number;
  predictionType: "shot_goal" | "rebound_creation";
  modelVersion: string | null;
  eligibleGames: number;
  upstreamCoverage: {
    gamesWithNormalizedPbp: number;
    gamesMissingNormalizedPbp: number;
    gamesWithShiftRows: number;
    gamesMissingShiftRows: number;
    gamesReadyForFeatureBuild: number;
    missingNormalizedPbpSamples: number[];
    missingShiftRowSamples: number[];
  };
  featureCoverage: {
    gamesWithFeatures: number;
    gamesMissingFeatures: number;
    featureRows: number;
    unblockedTrainingEligibleRows: number;
    missingFeatureGameSamples: number[];
  };
  predictionCoverage: {
    checked: boolean;
    gamesWithPredictions: number;
    gamesMissingPredictions: number;
    predictionRows: number;
    rowsMissingCalibratedProbability: number | null;
    missingPredictionGameSamples: number[];
  };
  recommendedRoutes: {
    upstreamNormalizedData: string | null;
    featureBackfill: string;
    predictionBackfill: string;
  };
};

const PAGE_SIZE = 1000;

function uniqueSortedNumbers(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function sampleNumbers(values: Iterable<number>, limit: number): number[] {
  return uniqueSortedNumbers(values).slice(0, Math.max(0, limit));
}

function gameTypeParam(gameTypes: number[] | null): string {
  return gameTypes == null ? "all" : gameTypes.join(",");
}

function buildDateRangeRoute(args: {
  gameIds: number[];
  gameById: Map<number, GameCoverageRow>;
}): string | null {
  const dates = args.gameIds
    .map((gameId) => args.gameById.get(gameId)?.date ?? null)
    .filter((date): date is string => typeof date === "string")
    .sort();

  if (dates.length === 0) return null;

  return `/api/v1/db/ingest-projection-inputs?startDate=${dates[0]}&endDate=${dates[dates.length - 1]}&debug=true`;
}

async function fetchAllRows<T>(
  queryPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchEligibleGames(args: XgBackfillCoverageAuditArgs): Promise<GameCoverageRow[]> {
  return fetchAllRows(async (from, to) => {
    let query = args.supabase
      .from("games")
      .select("id,date,type")
      .eq("seasonId", args.seasonId)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (args.gameTypes != null) {
      query = query.in("type", args.gameTypes);
    }

    return await query;
  });
}

async function countRows(args: {
  supabase: LooseSupabaseClient;
  table: string;
  filters: QueryFilter[];
}): Promise<number> {
  let query = args.supabase.from(args.table).select("game_id", {
    count: "exact",
    head: true
  });

  for (const filter of args.filters) {
    query =
      filter.value === null
        ? query.is(filter.column, null)
        : query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function hasRowsForGame(args: {
  supabase: LooseSupabaseClient;
  table: string;
  gameId: number;
  filters: QueryFilter[];
}): Promise<boolean> {
  let query = (args.supabase.from(args.table) as any)
    .select("game_id", { count: "exact", head: true })
    .eq("game_id", args.gameId)
    .limit(1);

  for (const filter of args.filters) {
    query =
      filter.value === null
        ? query.is(filter.column, null)
        : query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function fetchCoveredGameIdsByProbe(args: {
  supabase: LooseSupabaseClient;
  table: string;
  gameIds: number[];
  filters: QueryFilter[];
  concurrency?: number;
}): Promise<Set<number>> {
  const covered = new Set<number>();
  const concurrency = Math.max(1, args.concurrency ?? 12);
  let index = 0;

  async function worker() {
    for (;;) {
      const gameId = args.gameIds[index];
      index += 1;
      if (gameId == null) return;

      if (
        await hasRowsForGame({
          supabase: args.supabase,
          table: args.table,
          gameId,
          filters: args.filters
        })
      ) {
        covered.add(gameId);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, args.gameIds.length) }, () => worker())
  );

  return covered;
}

export async function auditXgBackfillCoverage(
  args: XgBackfillCoverageAuditArgs
): Promise<XgBackfillCoverageAudit> {
  const eligibleGames = await fetchEligibleGames(args);
  const eligibleGameIds = eligibleGames.map((game) => game.id);
  const eligibleGameIdSet = new Set(eligibleGameIds);
  const gameById = new Map(eligibleGames.map((game) => [game.id, game]));

  const normalizedPbpGameIds = await fetchCoveredGameIdsByProbe({
    supabase: args.supabase,
    table: "nhl_api_pbp_events",
    gameIds: eligibleGameIds,
    filters: [
      { column: "parser_version", value: args.parserVersion },
      { column: "strength_version", value: args.strengthVersion }
    ]
  });
  const shiftGameIds = await fetchCoveredGameIdsByProbe({
    supabase: args.supabase,
    table: "nhl_api_shift_rows",
    gameIds: eligibleGameIds,
    filters: [
      { column: "parser_version", value: args.parserVersion }
    ]
  });
  const featureGameIds = await fetchCoveredGameIdsByProbe({
    supabase: args.supabase,
    table: "nhl_xg_shot_features",
    gameIds: eligibleGameIds,
    filters: [
      { column: "feature_version", value: args.featureVersion }
    ]
  });

  const featureRows = await countRows({
    supabase: args.supabase,
    table: "nhl_xg_shot_features",
    filters: [
      { column: "season_id", value: args.seasonId },
      { column: "feature_version", value: args.featureVersion }
    ]
  });
  const unblockedTrainingEligibleRows = await countRows({
    supabase: args.supabase,
    table: "nhl_xg_shot_features",
    filters: [
      { column: "season_id", value: args.seasonId },
      { column: "feature_version", value: args.featureVersion },
      { column: "is_unblocked_shot_attempt", value: true },
      { column: "is_penalty_shot_event", value: false },
      { column: "is_shootout_event", value: false }
    ]
  });

  const predictionFilters: QueryFilter[] = [
    { column: "season_id", value: args.seasonId },
    { column: "feature_version", value: args.featureVersion },
    { column: "prediction_type", value: args.predictionType }
  ];
  if (args.modelVersion != null) {
    predictionFilters.push({ column: "model_version", value: args.modelVersion });
  }

  const predictionGameIds = await fetchCoveredGameIdsByProbe({
    supabase: args.supabase,
    table: "nhl_xg_shot_predictions",
    gameIds: eligibleGameIds,
    filters: predictionFilters
  });
  const predictionRows = await countRows({
    supabase: args.supabase,
    table: "nhl_xg_shot_predictions",
    filters: predictionFilters
  });
  const rowsMissingCalibratedProbability =
    args.predictionType === "shot_goal"
      ? await countRows({
          supabase: args.supabase,
          table: "nhl_xg_shot_predictions",
          filters: [
            ...predictionFilters,
            { column: "model_approved", value: true },
            { column: "calibrated_probability", value: null }
          ]
        })
      : null;

  const gamesWithNormalizedPbp = [...eligibleGameIdSet].filter((gameId) =>
    normalizedPbpGameIds.has(gameId)
  );
  const gamesWithShiftRows = [...eligibleGameIdSet].filter((gameId) => shiftGameIds.has(gameId));
  const gamesWithFeatures = [...eligibleGameIdSet].filter((gameId) => featureGameIds.has(gameId));
  const gamesWithPredictions = gamesWithFeatures.filter((gameId) => predictionGameIds.has(gameId));

  const missingNormalizedPbp = [...eligibleGameIdSet].filter(
    (gameId) => !normalizedPbpGameIds.has(gameId)
  );
  const missingShiftRows = [...eligibleGameIdSet].filter((gameId) => !shiftGameIds.has(gameId));
  const missingFeatures = [...eligibleGameIdSet].filter((gameId) => !featureGameIds.has(gameId));
  const missingPredictions = gamesWithFeatures.filter((gameId) => !predictionGameIds.has(gameId));

  return {
    seasonId: args.seasonId,
    gameTypes: args.gameTypes,
    featureVersion: args.featureVersion,
    parserVersion: args.parserVersion,
    strengthVersion: args.strengthVersion,
    predictionType: args.predictionType,
    modelVersion: args.modelVersion,
    eligibleGames: eligibleGames.length,
    upstreamCoverage: {
      gamesWithNormalizedPbp: gamesWithNormalizedPbp.length,
      gamesMissingNormalizedPbp: missingNormalizedPbp.length,
      gamesWithShiftRows: gamesWithShiftRows.length,
      gamesMissingShiftRows: missingShiftRows.length,
      gamesReadyForFeatureBuild: gamesWithNormalizedPbp.filter((gameId) =>
        shiftGameIds.has(gameId)
      ).length,
      missingNormalizedPbpSamples: sampleNumbers(missingNormalizedPbp, args.sampleLimit),
      missingShiftRowSamples: sampleNumbers(missingShiftRows, args.sampleLimit)
    },
    featureCoverage: {
      gamesWithFeatures: gamesWithFeatures.length,
      gamesMissingFeatures: missingFeatures.length,
      featureRows,
      unblockedTrainingEligibleRows,
      missingFeatureGameSamples: sampleNumbers(missingFeatures, args.sampleLimit)
    },
    predictionCoverage: {
      checked: true,
      gamesWithPredictions: gamesWithPredictions.length,
      gamesMissingPredictions: missingPredictions.length,
      predictionRows,
      rowsMissingCalibratedProbability,
      missingPredictionGameSamples: sampleNumbers(missingPredictions, args.sampleLimit)
    },
    recommendedRoutes: {
      upstreamNormalizedData: buildDateRangeRoute({
        gameIds: uniqueSortedNumbers([...missingNormalizedPbp, ...missingShiftRows]),
        gameById
      }),
      featureBackfill:
        `/api/v1/db/update-nhl-xg-shot-features?backfill=true&seasonId=${args.seasonId}` +
        `&gameTypes=${gameTypeParam(args.gameTypes)}&featureVersion=${args.featureVersion}` +
        `&parserVersion=${args.parserVersion}&strengthVersion=${args.strengthVersion}`,
      predictionBackfill:
        `/api/v1/db/update-nhl-xg-shot-predictions?backfill=true&seasonId=${args.seasonId}` +
        `&gameTypes=${gameTypeParam(args.gameTypes)}&featureVersion=${args.featureVersion}` +
        `&predictionType=${args.predictionType}`
    }
  };
}

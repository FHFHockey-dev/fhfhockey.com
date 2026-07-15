import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import path from "node:path";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildArtifactDriftReport,
  buildTeamSurfaceDriftReport,
  buildXgAggregates,
  mergeXgFlurryMetadata,
  validateXgAggregateReconciliation,
  xgFeatureEventKey,
  type XgArtifactDriftBaseline,
  type XgAggregateGameRow,
  type XgAggregatePredictionRow,
  type XgExternalTeamComparisonRow,
  type XgFlurryMetadataRow,
} from "lib/xg/aggregates";
import { withXgExecutionLeaseApi } from "lib/xg/executionLease";
import adminOnly from "utils/adminOnlyMiddleware";

const PAGE_SIZE = 1000;
const DEFAULT_UPSERT_BATCH_SIZE = 500;
const MODEL_ARTIFACT_PATH_ENV_VAR = "NHL_XG_MODEL_ARTIFACT_PATH";

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseWindowGames(value: string | null): number[] {
  if (!value) return [5, 10, 20];
  const parsed = value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
  return parsed.length ? Array.from(new Set(parsed)) : [5, 10, 20];
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function fetchApprovedShotGoalPredictions(args: {
  modelVersion: string;
  featureVersion: number | null;
  seasonId: number | null;
  limit: number | null;
}): Promise<XgAggregatePredictionRow[]> {
  const rows: XgAggregatePredictionRow[] = [];

  for (
    let from = 0;
    args.limit == null || rows.length < args.limit;
    from += PAGE_SIZE
  ) {
    const pageSize = args.limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, args.limit - rows.length);
    let query = supabase
      .from("nhl_xg_shot_predictions" as any)
      .select(
        "model_version,prediction_type,feature_version,game_id,event_id,season_id,game_date,event_owner_team_id,shooter_player_id,goalie_in_net_id,label,xg,model_approved"
      )
      .eq("model_version", args.modelVersion)
      .eq("prediction_type", "shot_goal")
      .eq("model_approved", true)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.featureVersion != null) {
      query = query.eq("feature_version", args.featureVersion);
    }
    if (args.seasonId != null) {
      query = query.eq("season_id", args.seasonId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch approved xG predictions: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...((data ?? []) as unknown as XgAggregatePredictionRow[]));
    if (data.length < pageSize) break;
  }

  return rows;
}

async function attachFlurryMetadata(
  predictions: XgAggregatePredictionRow[]
): Promise<XgAggregatePredictionRow[]> {
  if (predictions.length === 0) return predictions;
  const metadataRows: XgFlurryMetadataRow[] = [];
  const gameIds = Array.from(new Set(predictions.map((row) => row.game_id)));
  const featureVersions = Array.from(
    new Set(predictions.map((row) => row.feature_version))
  );

  for (const gameIdChunk of chunkRows(gameIds, 200)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("nhl_xg_shot_features" as any)
        .select(
          "feature_version,game_id,event_id,flurry_sequence_id,flurry_shot_index"
        )
        .in("feature_version", featureVersions)
        .in("game_id", gameIdChunk)
        .order("game_id", { ascending: true })
        .order("event_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Failed to fetch flurry metadata: ${error.message}`);
      }
      if (!data?.length) break;
      metadataRows.push(...(data as unknown as XgFlurryMetadataRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  }

  return mergeXgFlurryMetadata(predictions, metadataRows);
}

async function fetchGames(gameIds: number[]): Promise<XgAggregateGameRow[]> {
  if (gameIds.length === 0) return [];
  const rows: XgAggregateGameRow[] = [];

  for (const chunk of chunkRows(Array.from(new Set(gameIds)), 200)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,seasonId,date,homeTeamId,awayTeamId")
      .in("id", chunk);

    if (error) {
      throw new Error(`Failed to fetch games for xG aggregates: ${error.message}`);
    }

    rows.push(
      ...((data ?? []) as Array<{
        id: number;
        seasonId: number | null;
        date: string | null;
        homeTeamId: number | null;
        awayTeamId: number | null;
      }>).map((row) => ({
        id: Number(row.id),
        seasonId: typeof row.seasonId === "number" ? row.seasonId : null,
        date: row.date ?? null,
        homeTeamId: typeof row.homeTeamId === "number" ? row.homeTeamId : null,
        awayTeamId: typeof row.awayTeamId === "number" ? row.awayTeamId : null,
      }))
    );
  }

  return rows;
}

async function fetchEmptyNetEventKeys(args: {
  seasonId: number | null;
  predictions: XgAggregatePredictionRow[];
}): Promise<Set<string>> {
  const keys = new Set<string>();
  const candidateRows = args.predictions.filter((row) => row.goalie_in_net_id == null);
  if (candidateRows.length === 0) return keys;

  const candidateKeys = new Set(
    candidateRows.map((row) =>
      xgFeatureEventKey({
        featureVersion: row.feature_version,
        gameId: row.game_id,
        eventId: row.event_id,
      })
    )
  );
  const featureVersions = Array.from(
    new Set(candidateRows.map((row) => row.feature_version))
  );
  const gameIds = Array.from(new Set(candidateRows.map((row) => row.game_id)));

  for (const gameIdChunk of chunkRows(gameIds, 200)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("nhl_xg_shot_features" as any)
        .select("feature_version,game_id,event_id")
        .in("feature_version", featureVersions)
        .in("game_id", gameIdChunk)
        .eq("is_empty_net_event", true)
        .eq("is_unblocked_shot_attempt", true);

      if (args.seasonId != null) {
        query = query.eq("season_id", args.seasonId);
      }

      const { data, error } = await query
        .order("game_id", { ascending: true })
        .order("event_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Failed to fetch empty-net xG feature rows: ${error.message}`);
      }
      if (!data?.length) break;

      for (const row of (data as unknown) as Array<{
        feature_version: number;
        game_id: number;
        event_id: number;
      }>) {
        const key = xgFeatureEventKey({
          featureVersion: Number(row.feature_version),
          gameId: Number(row.game_id),
          eventId: Number(row.event_id),
        });
        if (candidateKeys.has(key)) keys.add(key);
      }
      if (data.length < PAGE_SIZE) break;
    }
  }

  return keys;
}

function resolveModelArtifactPath(queryValue: string | null): string | null {
  const configuredPath =
    queryValue?.trim() || process.env[MODEL_ARTIFACT_PATH_ENV_VAR]?.trim() || null;
  if (!configuredPath) return null;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

function loadArtifactDriftBaseline(
  artifactPath: string | null
): XgArtifactDriftBaseline | null {
  if (!artifactPath) return null;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const evaluation = artifact?.evaluation?.overall ?? artifact?.holdoutEvaluation ?? null;
  if (!evaluation) return null;

  return {
    source: artifactPath,
    exampleCount: finiteOrNull(evaluation.exampleCount),
    averagePrediction: finiteOrNull(evaluation.averagePrediction),
    goalRate: finiteOrNull(evaluation.goalRate),
  };
}

async function fetchTeamAbbreviationsById(
  teamIds: number[]
): Promise<Map<number, string>> {
  const uniqueTeamIds = Array.from(new Set(teamIds)).filter((id) => Number.isFinite(id));
  if (uniqueTeamIds.length === 0) return new Map();

  const rows: Array<{ id: number; abbreviation: string | null }> = [];
  for (const chunk of chunkRows(uniqueTeamIds, 200)) {
    const { data, error } = await supabase
      .from("teams")
      .select("id,abbreviation")
      .in("id", chunk);
    if (error) throw new Error(`Failed to fetch teams for xG drift: ${error.message}`);
    rows.push(...((data ?? []) as Array<{ id: number; abbreviation: string | null }>));
  }

  return new Map(
    rows
      .map((row) => {
        const id = Number(row.id);
        const abbreviation =
          typeof row.abbreviation === "string" ? row.abbreviation.trim().toUpperCase() : "";
        return Number.isFinite(id) && abbreviation ? ([id, abbreviation] as const) : null;
      })
      .filter((entry): entry is readonly [number, string] => entry != null)
  );
}

async function fetchNstTeamXgComparisonRows(
  teamGameRows: Array<{ team_id: number; game_date: string | null }>
): Promise<XgExternalTeamComparisonRow[]> {
  if (teamGameRows.length === 0) return [];

  const teamAbbrevById = await fetchTeamAbbreviationsById(
    teamGameRows.map((row) => row.team_id)
  );
  const teamIdByAbbrev = new Map(
    Array.from(teamAbbrevById.entries()).map(([teamId, abbreviation]) => [
      abbreviation,
      teamId,
    ])
  );
  const teamAbbreviations = Array.from(new Set(teamAbbrevById.values()));
  const dates = Array.from(
    new Set(teamGameRows.map((row) => row.game_date).filter((date): date is string => !!date))
  );
  if (teamAbbreviations.length === 0 || dates.length === 0) return [];

  const rows: XgExternalTeamComparisonRow[] = [];
  for (const abbrevChunk of chunkRows(teamAbbreviations, 32)) {
    for (const dateChunk of chunkRows(dates, 200)) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("nst_team_gamelogs_as_counts" as any)
          .select("team_abbreviation,date,xgf,xga")
          .in("team_abbreviation", abbrevChunk)
          .in("date", dateChunk)
          .order("date", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          throw new Error(`Failed to fetch NST team xG drift rows: ${error.message}`);
        }
        if (!data?.length) break;

        for (const row of (data as unknown) as Array<{
          team_abbreviation: string | null;
          date: string | null;
          xgf: number | string | null;
          xga: number | string | null;
        }>) {
          const abbreviation =
            typeof row.team_abbreviation === "string"
              ? row.team_abbreviation.trim().toUpperCase()
              : "";
          const teamId = teamIdByAbbrev.get(abbreviation);
          if (teamId == null) continue;
          rows.push({
            team_id: teamId,
            game_date: row.date,
            xgf: finiteOrNull(row.xgf),
            xga: finiteOrNull(row.xga),
          });
        }
        if (data.length < PAGE_SIZE) break;
      }
    }
  }

  return rows;
}

async function upsertRows(table: string, rows: unknown[], onConflict: string, batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from(table as any)
      .upsert(batch as any, { onConflict });

    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }

    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const modelVersion = firstQueryValue(req.query.modelVersion);
  if (!modelVersion) {
    return res.status(400).json({
      success: false,
      error: "Provide modelVersion for approved shot-goal aggregate refresh.",
    });
  }

  const featureVersion = parseOptionalInteger(firstQueryValue(req.query.featureVersion));
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const rollingWindows = parseWindowGames(firstQueryValue(req.query.rollingWindows));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  const predictions = await attachFlurryMetadata(await fetchApprovedShotGoalPredictions({
    modelVersion,
    featureVersion,
    seasonId,
    limit,
  }));
  const games = await fetchGames(predictions.map((row) => row.game_id));
  const aggregates = buildXgAggregates(predictions, games, { rollingWindows });
  const emptyNetEventKeys = await fetchEmptyNetEventKeys({
    seasonId,
    predictions,
  });
  const qa = validateXgAggregateReconciliation(predictions, games, aggregates, {
    emptyNetEventKeys,
  });
  const artifactPath = resolveModelArtifactPath(
    firstQueryValue(req.query.modelArtifactPath)
  );
  let artifactBaseline: XgArtifactDriftBaseline | null = null;
  let artifactBaselineLoadWarning: string | null = null;
  try {
    artifactBaseline = loadArtifactDriftBaseline(artifactPath);
  } catch (error: any) {
    artifactBaselineLoadWarning =
      error?.message ?? "Failed to load xG model artifact drift baseline.";
  }

  const artifactBaselineDrift = buildArtifactDriftReport(
    predictions,
    artifactBaseline
  );
  if (artifactBaselineLoadWarning) {
    artifactBaselineDrift.warnings.push(artifactBaselineLoadWarning);
  }

  let nstTeamSurfaceDrift = buildTeamSurfaceDriftReport({
    source: "nst_team_gamelogs_as_counts",
    teamGameRows: aggregates.teamGameRows,
    externalRows: [],
    unavailableReason: "not_checked",
  });
  try {
    nstTeamSurfaceDrift = buildTeamSurfaceDriftReport({
      source: "nst_team_gamelogs_as_counts",
      teamGameRows: aggregates.teamGameRows,
      externalRows: await fetchNstTeamXgComparisonRows(aggregates.teamGameRows),
    });
  } catch (error: any) {
    nstTeamSurfaceDrift = buildTeamSurfaceDriftReport({
      source: "nst_team_gamelogs_as_counts",
      teamGameRows: aggregates.teamGameRows,
      externalRows: [],
      unavailableReason:
        error?.message ?? "NST team-game xG surface unavailable for drift comparison.",
    });
  }

  const drift = {
    artifactBaseline: artifactBaselineDrift,
    externalSurfaces: {
      nstTeamGamelogsAsCounts: nstTeamSurfaceDrift,
      wgoTeamStats: buildTeamSurfaceDriftReport({
        source: "wgo_team_stats",
        teamGameRows: aggregates.teamGameRows,
        externalRows: [],
        unavailableReason: "wgo_team_stats has no xG/xGA columns to compare.",
      }),
    },
  };

  const counts = {
    approvedShotGoalPredictionRows: predictions.length,
    games: games.length,
    skippedPredictionRows: aggregates.skippedPredictionRows.length,
    teamGameRows: aggregates.teamGameRows.length,
    playerGameRows: aggregates.playerGameRows.length,
    goalieGameRows: aggregates.goalieGameRows.length,
    teamRollingRows: aggregates.teamRollingRows.length,
    playerRollingRows: aggregates.playerRollingRows.length,
    goalieRollingRows: aggregates.goalieRollingRows.length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      modelVersion,
      featureVersion,
      seasonId,
      rollingWindows,
      counts,
      qa,
      drift,
      skippedPredictionRowSamples: aggregates.skippedPredictionRows.slice(0, 10),
    });
  }

  const upserted = {
    teamGameRows: await upsertRows(
      "nhl_xg_team_game_aggregates",
      aggregates.teamGameRows,
      "model_version,feature_version,game_id,team_id",
      upsertBatchSize
    ),
    playerGameRows: await upsertRows(
      "nhl_xg_player_game_aggregates",
      aggregates.playerGameRows,
      "model_version,feature_version,game_id,player_id",
      upsertBatchSize
    ),
    goalieGameRows: await upsertRows(
      "nhl_xg_goalie_game_aggregates",
      aggregates.goalieGameRows,
      "model_version,feature_version,game_id,goalie_player_id",
      upsertBatchSize
    ),
    teamRollingRows: await upsertRows(
      "nhl_xg_team_rolling_aggregates",
      aggregates.teamRollingRows,
      "model_version,feature_version,team_id,as_of_game_id,window_games",
      upsertBatchSize
    ),
    playerRollingRows: await upsertRows(
      "nhl_xg_player_rolling_aggregates",
      aggregates.playerRollingRows,
      "model_version,feature_version,player_id,as_of_game_id,window_games",
      upsertBatchSize
    ),
    goalieRollingRows: await upsertRows(
      "nhl_xg_goalie_rolling_aggregates",
      aggregates.goalieRollingRows,
      "model_version,feature_version,goalie_player_id,as_of_game_id,window_games",
      upsertBatchSize
    ),
  };

  return res.status(200).json({
    success: true,
    dryRun,
    modelVersion,
    featureVersion,
    seasonId,
    rollingWindows,
    counts,
    qa,
    drift,
    upserted,
    skippedPredictionRowSamples: aggregates.skippedPredictionRows.slice(0, 10),
  });
}

export default withCronJobAudit(adminOnly(withXgExecutionLeaseApi(handler, {
  leaseKey: "xg:aggregates",
  ttlSeconds: 1800,
}) as any), {
  jobName: "update-nhl-xg-aggregates",
});

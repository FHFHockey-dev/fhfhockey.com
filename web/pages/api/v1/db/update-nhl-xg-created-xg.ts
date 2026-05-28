import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildCreatedXgAggregates,
  type CreatedXgShotAssistRow,
  type CreatedXgShotIdentityRow,
  type CreatedXgTransitionEventRow,
} from "lib/xg/createdXg";

const PAGE_SIZE = 1000;
const DEFAULT_UPSERT_BATCH_SIZE = 500;

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null, fallback: number): number {
  return parseOptionalInteger(value) ?? fallback;
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

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchShotAssistRows(args: {
  modelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  limit: number | null;
}): Promise<CreatedXgShotAssistRow[]> {
  const rows: CreatedXgShotAssistRow[] = [];
  for (
    let from = 0;
    args.limit == null || rows.length < args.limit;
    from += PAGE_SIZE
  ) {
    const pageSize =
      args.limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, args.limit - rows.length);
    let query = supabase
      .from("nhl_xg_shot_assist_candidates" as any)
      .select(
        [
          "model_version",
          "feature_version",
          "game_id",
          "event_id",
          "season_id",
          "game_date",
          "event_owner_team_id",
          "shooter_player_id",
          "shot_assist_player_id",
          "expected_primary_assists",
        ].join(",")
      )
      .eq("model_version", args.modelVersion)
      .eq("feature_version", args.featureVersion)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch shot-assist created-xG rows: ${error.message}`);
    if (!data?.length) break;

    rows.push(
      ...((data as unknown) as Array<Record<string, unknown>>).map((row) => ({
        model_version: String(row.model_version),
        feature_version: Number(row.feature_version),
        game_id: Number(row.game_id),
        event_id: Number(row.event_id),
        season_id: numberOrNull(row.season_id),
        game_date: typeof row.game_date === "string" ? row.game_date : null,
        event_owner_team_id: numberOrNull(row.event_owner_team_id),
        shooter_player_id: numberOrNull(row.shooter_player_id),
        shot_assist_player_id: Number(row.shot_assist_player_id),
        expected_primary_assists: Number(row.expected_primary_assists),
      }))
    );
    if (data.length < pageSize) break;
  }
  return rows;
}

async function fetchTransitionRows(args: {
  modelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  limit: number | null;
}): Promise<CreatedXgTransitionEventRow[]> {
  const rows: CreatedXgTransitionEventRow[] = [];
  for (
    let from = 0;
    args.limit == null || rows.length < args.limit;
    from += PAGE_SIZE
  ) {
    const pageSize =
      args.limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, args.limit - rows.length);
    let query = supabase
      .from("nhl_xg_transition_events" as any)
      .select(
        [
          "model_version",
          "feature_version",
          "game_id",
          "event_id",
          "transition_type",
          "season_id",
          "game_date",
          "team_id",
          "player_id",
          "shot_event_id",
          "transition_created_xg",
        ].join(",")
      )
      .eq("model_version", args.modelVersion)
      .eq("feature_version", args.featureVersion)
      .in("transition_type", [
        "controlled_entry_proxy",
        "controlled_exit_proxy",
        "entry_assist_proxy",
      ])
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch transition created-xG rows: ${error.message}`);
    if (!data?.length) break;

    rows.push(
      ...((data as unknown) as Array<Record<string, unknown>>).map((row) => ({
        model_version: String(row.model_version),
        feature_version: Number(row.feature_version),
        game_id: Number(row.game_id),
        event_id: Number(row.event_id),
        transition_type: String(row.transition_type),
        season_id: numberOrNull(row.season_id),
        game_date: typeof row.game_date === "string" ? row.game_date : null,
        team_id: numberOrNull(row.team_id),
        player_id: numberOrNull(row.player_id),
        shot_event_id: Number(row.shot_event_id),
        transition_created_xg: Number(row.transition_created_xg),
      }))
    );
    if (data.length < pageSize) break;
  }
  return rows;
}

async function fetchShotIdentityRows(
  transitionRows: CreatedXgTransitionEventRow[]
): Promise<CreatedXgShotIdentityRow[]> {
  const byGame = new Map<number, Set<number>>();
  for (const row of transitionRows) {
    const current = byGame.get(row.game_id) ?? new Set<number>();
    current.add(row.shot_event_id);
    byGame.set(row.game_id, current);
  }

  const rows: CreatedXgShotIdentityRow[] = [];
  for (const [gameId, eventIds] of byGame) {
    for (const eventIdChunk of chunkRows(Array.from(eventIds), 500)) {
      const { data, error } = await supabase
        .from("nhl_xg_shot_features" as any)
        .select("feature_version,game_id,event_id,shooter_player_id,event_owner_team_id")
        .eq("game_id", gameId)
        .in("event_id", eventIdChunk);
      if (error) throw new Error(`Failed to fetch created-xG shot identities: ${error.message}`);

      rows.push(
        ...((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
          feature_version: Number(row.feature_version),
          game_id: Number(row.game_id),
          event_id: Number(row.event_id),
          shooter_player_id: numberOrNull(row.shooter_player_id),
          event_owner_team_id: numberOrNull(row.event_owner_team_id),
        }))
      );
    }
  }
  return rows;
}

async function upsertRows(table: string, rows: unknown[], onConflict: string, batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase.from(table as any).upsert(batch as any, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
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
      error: "Provide modelVersion for created-xG aggregate refresh.",
    });
  }

  const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const rollingWindows = parseWindowGames(firstQueryValue(req.query.rollingWindows));
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  const [shotAssistRows, transitionRows] = await Promise.all([
    fetchShotAssistRows({ modelVersion, featureVersion, seasonId, limit }),
    fetchTransitionRows({ modelVersion, featureVersion, seasonId, limit }),
  ]);
  const shotIdentityRows = await fetchShotIdentityRows(transitionRows);
  const aggregates = buildCreatedXgAggregates({
    shotAssistRows,
    transitionRows,
    shotIdentityRows,
    options: { rollingWindows },
  });
  const counts = {
    shotAssistRows: shotAssistRows.length,
    transitionRows: transitionRows.length,
    shotIdentityRows: shotIdentityRows.length,
    playerGameRows: aggregates.playerGameRows.length,
    playerRollingRows: aggregates.playerRollingRows.length,
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
      reconciliation: aggregates.reconciliation,
      samples: aggregates.playerGameRows.slice(0, 10),
    });
  }

  const upserted = {
    playerGameRows: await upsertRows(
      "nhl_xg_player_created_xg_game_aggregates",
      aggregates.playerGameRows,
      "model_version,feature_version,game_id,player_id",
      upsertBatchSize
    ),
    playerRollingRows: await upsertRows(
      "nhl_xg_player_created_xg_rolling_aggregates",
      aggregates.playerRollingRows,
      "model_version,feature_version,player_id,as_of_game_id,window_games",
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
    reconciliation: aggregates.reconciliation,
    upserted,
    samples: aggregates.playerGameRows.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-created-xg",
});

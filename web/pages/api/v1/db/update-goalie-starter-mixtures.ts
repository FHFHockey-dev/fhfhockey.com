import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import {
  buildGoalieStarterMixtureRows,
  type GoalieStarterProjectionInput,
} from "lib/projections/goalieStarterMixtures";

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

function parseIntegerList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
}

function parseGameTeamGoalieMap(value: string | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!value) return out;
  for (const item of value.split(",")) {
    const [gameId, teamId, goalieId] = item.split(":").map((part) => Number.parseInt(part, 10));
    if (Number.isInteger(gameId) && Number.isInteger(teamId) && Number.isInteger(goalieId)) {
      out.set(`${gameId}:${teamId}`, goalieId);
    }
  }
  return out;
}

function parseGameTeamSet(value: string | null): Set<string> {
  const out = new Set<string>();
  if (!value) return out;
  for (const item of value.split(",")) {
    const [gameId, teamId] = item.split(":").map((part) => Number.parseInt(part, 10));
    if (Number.isInteger(gameId) && Number.isInteger(teamId)) out.add(`${gameId}:${teamId}`);
  }
  return out;
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

async function fetchGoalieStartProjectionRows(args: {
  gameIds: number[];
  teamIds: number[];
  startDate: string | null;
  endDate: string | null;
  limit: number | null;
}): Promise<GoalieStarterProjectionInput[]> {
  let query = supabase
    .from("goalie_start_projections" as any)
    .select(
      [
        "game_id",
        "game_date",
        "team_id",
        "player_id",
        "start_probability",
        "confirmed_status",
        "l10_start_pct",
        "season_start_pct",
        "games_played",
        "projected_gsaa_per_60",
        "updated_at",
      ].join(",")
    )
    .order("game_date", { ascending: true })
    .order("game_id", { ascending: true })
    .order("team_id", { ascending: true });

  if (args.gameIds.length) query = query.in("game_id", args.gameIds);
  if (args.teamIds.length) query = query.in("team_id", args.teamIds);
  if (args.startDate) query = query.gte("game_date", args.startDate);
  if (args.endDate) query = query.lte("game_date", args.endDate);
  if (args.limit != null) query = query.limit(args.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch goalie starter projections: ${error.message}`);

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    game_id: Number(row.game_id),
    game_date: typeof row.game_date === "string" ? row.game_date : null,
    team_id: Number(row.team_id),
    player_id: Number(row.player_id),
    start_probability: numberOrNull(row.start_probability),
    confirmed_status: row.confirmed_status === true,
    l10_start_pct: numberOrNull(row.l10_start_pct),
    season_start_pct: numberOrNull(row.season_start_pct),
    games_played: numberOrNull(row.games_played),
    projected_gsaa_per_60: numberOrNull(row.projected_gsaa_per_60),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  }));
}

async function upsertRows(rows: unknown[], batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase
      .from("nhl_goalie_starter_mixture_distributions" as any)
      .upsert(batch as any, {
        onConflict: "mixture_version,game_id,team_id,goalie_id,as_of_timestamp",
      });
    if (error) throw new Error(`Failed to upsert goalie starter mixtures: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const gameIds = parseIntegerList(firstQueryValue(req.query.gameIds));
  const teamIds = parseIntegerList(firstQueryValue(req.query.teamIds));
  const startDate = firstQueryValue(req.query.startDate);
  const endDate = firstQueryValue(req.query.endDate);
  const limit = parseOptionalInteger(firstQueryValue(req.query.limit));
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const mixtureVersion =
    firstQueryValue(req.query.mixtureVersion) ?? "goalie_starter_mixture_v1";
  const asOfTimestamp = firstQueryValue(req.query.asOfTimestamp) ?? new Date().toISOString();
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );

  if (gameIds.length === 0 && (!startDate || !endDate)) {
    return res.status(400).json({
      success: false,
      error: "Provide gameIds or both startDate and endDate.",
    });
  }

  const projections = await fetchGoalieStartProjectionRows({
    gameIds,
    teamIds,
    startDate,
    endDate,
    limit,
  });
  const rows = buildGoalieStarterMixtureRows({
    projections,
    mixtureVersion,
    asOfTimestamp,
    manualOverridesByGameTeam: parseGameTeamGoalieMap(firstQueryValue(req.query.manualOverrides)),
    previousGameStarterByGameTeam: parseGameTeamGoalieMap(
      firstQueryValue(req.query.previousGameStarters)
    ),
    backToBackGameTeams: parseGameTeamSet(firstQueryValue(req.query.backToBackGameTeams)),
  });
  const counts = {
    sourceRows: projections.length,
    mixtureRows: rows.length,
    gameTeamDistributions: new Set(rows.map((row) => `${row.game_id}:${row.team_id}`)).size,
    confirmedRows: rows.filter((row) => row.confirmed_status).length,
    staleRows: rows.filter((row) => row.is_stale).length,
    hardStaleRows: rows.filter((row) => row.is_hard_stale).length,
    manualOverrideRows: rows.filter((row) => row.is_manual_override).length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      mixtureVersion,
      asOfTimestamp,
      counts,
      samples: rows.slice(0, 10),
    });
  }

  const rowsUpserted = await upsertRows(rows, upsertBatchSize);
  return res.status(200).json({
    success: true,
    dryRun,
    mixtureVersion,
    asOfTimestamp,
    counts,
    rowsUpserted,
    samples: rows.slice(0, 10),
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-goalie-starter-mixtures",
});

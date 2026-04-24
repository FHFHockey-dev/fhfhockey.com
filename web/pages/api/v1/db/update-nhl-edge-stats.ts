import type { NextApiRequest, NextApiResponse } from "next";
import pLimit from "p-limit";

import {
  EDGE_SHOT_LOCATION_VARIANTS,
  buildEdgeGoalieDetailRow,
  buildEdgeGoalieDetailNowRow,
  buildEdgeSkaterDetailRow,
  buildEdgeSkaterDetailNowRow,
  buildEdgeSkaterShotLocationRows,
  buildEdgeTeamDetailRow,
  buildEdgeTeamDetailNowRow,
  type NhlEdgeStatsFamily,
  type NhlEdgeStatsRow
} from "lib/NHL/edgeIngestion";
import {
  getEdgeGoalieDetail,
  getEdgeGoalieDetailNow,
  getEdgeSkaterDetail,
  getEdgeSkaterDetailNow,
  getEdgeSkaterShotLocationTop10,
  getEdgeTeamDetail,
  getEdgeTeamDetailNow,
  type EdgeGameType
} from "lib/NHL/edge";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";

type TargetMode = "all" | NhlEdgeStatsFamily;

type RosterTarget = {
  playerId: number;
  teamId: number | null;
  teamAbbreviation: string | null;
  fullName: string | null;
  position: string | null;
};

type RequestOptions = {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  target: TargetMode;
  limit: number;
  offset: number;
  concurrency: number;
  playerId: number | null;
  teamId: number | null;
  goalieId: number | null;
};

type DetailFetchResult = {
  rows: NhlEdgeStatsRow[];
  skipped: Array<{
    entityType: "skater" | "goalie";
    playerId: number;
    fullName: string | null;
    reason: string;
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTarget(value: string | null): TargetMode {
  switch (value) {
    case "skater-detail-now":
    case "skater-detail":
    case "team-detail-now":
    case "team-detail":
    case "goalie-detail-now":
    case "goalie-detail":
    case "skater-shot-location-top-10":
      return value;
    default:
      return "all";
  }
}

function parseGameType(value: string | null): EdgeGameType {
  return value === "3" ? 3 : 2;
}

function parseDate(value: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const normalized = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Invalid snapshot date");
  }
  return normalized;
}

async function getCurrentRosterTargets(): Promise<RosterTarget[]> {
  const { data, error } = await supabase
    .from("rosters")
    .select(
      "playerId, teamId, players(id, fullName, position), teams(id, abbreviation)"
    )
    .eq("is_current", true);

  if (error) {
    throw new Error(`Failed to load current rosters: ${error.message}`);
  }

  const deduped = new Map<number, RosterTarget>();

  for (const row of data ?? []) {
    const player = Array.isArray((row as any).players)
      ? (row as any).players[0]
      : (row as any).players;
    const team = Array.isArray((row as any).teams)
      ? (row as any).teams[0]
      : (row as any).teams;

    if (!player?.id) continue;

    deduped.set(player.id, {
      playerId: Number(player.id),
      teamId: typeof row.teamId === "number" ? row.teamId : null,
      teamAbbreviation:
        typeof team?.abbreviation === "string" ? team.abbreviation : null,
      fullName: typeof player.fullName === "string" ? player.fullName : null,
      position: typeof player.position === "string" ? player.position : null
    });
  }

  return [...deduped.values()].sort((a, b) => a.playerId - b.playerId);
}

function splitRosterTargets(targets: RosterTarget[]) {
  return {
    skaters: targets.filter((target) => target.position !== "G"),
    goalies: targets.filter((target) => target.position === "G")
  };
}

function applyBatch<T>(items: T[], limit: number, offset: number): T[] {
  return items.slice(offset, offset + limit);
}

async function upsertRows(rows: NhlEdgeStatsRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("nhl_edge_stats_daily" as any).upsert(rows as any, {
    onConflict:
      "snapshot_date,season_id,game_type,endpoint_family,endpoint_variant,entity_type,entity_id"
  });

  if (error) {
    throw new Error(`Failed to upsert nhl_edge_stats_daily rows: ${error.message}`);
  }

  return rows.length;
}

function isEdgeNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not found/i.test(message) || /\b404\b/.test(message);
}

async function fetchSkaterDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  targets: RosterTarget[];
  concurrency: number;
  nowMode?: boolean;
}): Promise<DetailFetchResult> {
  const limit = pLimit(args.concurrency);
  const results = await Promise.all(
    args.targets.map((target) =>
      limit(async () => {
        try {
          const payload = args.nowMode
            ? await getEdgeSkaterDetailNow(target.playerId)
            : await getEdgeSkaterDetail(
                target.playerId,
                args.seasonId,
                args.gameType
              );
          return {
            row: args.nowMode
              ? buildEdgeSkaterDetailNowRow({
                  snapshotDate: args.snapshotDate,
                  seasonId: args.seasonId,
                  gameType: args.gameType,
                  payload
                })
              : buildEdgeSkaterDetailRow({
                  snapshotDate: args.snapshotDate,
                  seasonId: args.seasonId,
                  gameType: args.gameType,
                  payload
                }),
            skipped: null
          };
        } catch (error) {
          if (!isEdgeNotFoundError(error)) {
            throw error;
          }
          return {
            row: null,
            skipped: {
              entityType: "skater" as const,
              playerId: target.playerId,
              fullName: target.fullName,
              reason: "Edge detail not available"
            }
          };
        }
      })
    )
  );

  return {
    rows: results.flatMap((result) => (result.row ? [result.row] : [])),
    skipped: results.flatMap((result) =>
      result.skipped ? [result.skipped] : []
    )
  };
}

async function fetchGoalieDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  targets: RosterTarget[];
  concurrency: number;
  nowMode?: boolean;
}): Promise<DetailFetchResult> {
  const limit = pLimit(args.concurrency);
  const results = await Promise.all(
    args.targets.map((target) =>
      limit(async () => {
        try {
          const payload = args.nowMode
            ? await getEdgeGoalieDetailNow(target.playerId)
            : await getEdgeGoalieDetail(
                target.playerId,
                args.seasonId,
                args.gameType
              );
          return {
            row: args.nowMode
              ? buildEdgeGoalieDetailNowRow({
                  snapshotDate: args.snapshotDate,
                  seasonId: args.seasonId,
                  gameType: args.gameType,
                  payload
                })
              : buildEdgeGoalieDetailRow({
                  snapshotDate: args.snapshotDate,
                  seasonId: args.seasonId,
                  gameType: args.gameType,
                  payload
                }),
            skipped: null
          };
        } catch (error) {
          if (!isEdgeNotFoundError(error)) {
            throw error;
          }
          return {
            row: null,
            skipped: {
              entityType: "goalie" as const,
              playerId: target.playerId,
              fullName: target.fullName,
              reason: "Edge detail not available"
            }
          };
        }
      })
    )
  );

  return {
    rows: results.flatMap((result) => (result.row ? [result.row] : [])),
    skipped: results.flatMap((result) =>
      result.skipped ? [result.skipped] : []
    )
  };
}

async function fetchTeamDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  teamId: number | null;
  nowMode?: boolean;
}): Promise<NhlEdgeStatsRow[]> {
  const teams = await getTeams(args.seasonId);
  const targets =
    args.teamId != null
      ? teams.filter((team) => team.id === args.teamId)
      : teams;

  const rows = await Promise.all(
    targets.map(async (team) =>
      args.nowMode
        ? buildEdgeTeamDetailNowRow({
            snapshotDate: args.snapshotDate,
            seasonId: args.seasonId,
            gameType: args.gameType,
            payload: await getEdgeTeamDetailNow(team.id)
          })
        : buildEdgeTeamDetailRow({
            snapshotDate: args.snapshotDate,
            seasonId: args.seasonId,
            gameType: args.gameType,
            payload: await getEdgeTeamDetail(team.id, args.seasonId, args.gameType)
          })
    )
  );

  return rows;
}

async function fetchSkaterShotLocationRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
}): Promise<NhlEdgeStatsRow[]> {
  const allRows = await Promise.all(
    EDGE_SHOT_LOCATION_VARIANTS.map(async (variant) =>
      buildEdgeSkaterShotLocationRows({
        snapshotDate: args.snapshotDate,
        seasonId: args.seasonId,
        gameType: args.gameType,
        variant,
        payload: await getEdgeSkaterShotLocationTop10(
          variant,
          args.seasonId,
          args.gameType
        )
      })
    )
  );

  return allRows.flat();
}

function parseRequest(
  req: NextApiRequest,
  overrides?: Partial<Pick<RequestOptions, "target">>
): RequestOptions {
  const snapshotDate = parseDate(firstQueryValue(req.query.date));
  const seasonId = parseInteger(firstQueryValue(req.query.seasonId), 0);
  return {
    snapshotDate,
    seasonId,
    gameType: parseGameType(firstQueryValue(req.query.gameType)),
    target: overrides?.target ?? parseTarget(firstQueryValue(req.query.target)),
    limit: Math.max(1, Math.min(250, parseInteger(firstQueryValue(req.query.limit), 100))),
    offset: Math.max(0, parseInteger(firstQueryValue(req.query.offset), 0)),
    concurrency: Math.max(
      1,
      Math.min(12, parseInteger(firstQueryValue(req.query.concurrency), 6))
    ),
    playerId: (() => {
      const value = firstQueryValue(req.query.playerId);
      return value ? parseInteger(value, 0) : null;
    })(),
    teamId: (() => {
      const value = firstQueryValue(req.query.teamId);
      return value ? parseInteger(value, 0) : null;
    })(),
    goalieId: (() => {
      const value = firstQueryValue(req.query.goalieId);
      return value ? parseInteger(value, 0) : null;
    })()
  };
}

export async function runNhlEdgeStatsSnapshot(
  req: NextApiRequest,
  res: NextApiResponse,
  overrides?: Partial<Pick<RequestOptions, "target">>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const options = parseRequest(req, overrides);
  const currentSeason =
    options.seasonId > 0 ? { seasonId: options.seasonId } : await getCurrentSeason();
  const seasonId = currentSeason.seasonId;
  const rosterTargets = await getCurrentRosterTargets();
  const { skaters, goalies } = splitRosterTargets(rosterTargets);

  const selectedSkaters =
    options.playerId != null
      ? skaters.filter((target) => target.playerId === options.playerId)
      : applyBatch(skaters, options.limit, options.offset);
  const selectedGoalies =
    options.goalieId != null
      ? goalies.filter((target) => target.playerId === options.goalieId)
      : applyBatch(goalies, options.limit, options.offset);

  const rows: NhlEdgeStatsRow[] = [];
  const executedTargets: string[] = [];
  const skippedDetails: DetailFetchResult["skipped"] = [];

  if (options.target === "all" || options.target === "team-detail") {
    const teamRows = await fetchTeamDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      teamId: options.teamId
    });
    rows.push(...teamRows);
    executedTargets.push("team-detail");
  }

  if (options.target === "team-detail-now") {
    const teamNowRows = await fetchTeamDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      teamId: options.teamId,
      nowMode: true
    });
    rows.push(...teamNowRows);
    executedTargets.push("team-detail-now");
  }

  if (options.target === "all" || options.target === "skater-shot-location-top-10") {
    const leaderboardRows = await fetchSkaterShotLocationRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType
    });
    rows.push(...leaderboardRows);
    executedTargets.push("skater-shot-location-top-10");
  }

  if (options.target === "all" || options.target === "skater-detail") {
    const skaterDetailResult = await fetchSkaterDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedSkaters,
      concurrency: options.concurrency
    });
    rows.push(...skaterDetailResult.rows);
    skippedDetails.push(...skaterDetailResult.skipped);
    executedTargets.push("skater-detail");
  }

  if (options.target === "skater-detail-now") {
    const skaterNowResult = await fetchSkaterDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedSkaters,
      concurrency: options.concurrency,
      nowMode: true
    });
    rows.push(...skaterNowResult.rows);
    skippedDetails.push(...skaterNowResult.skipped);
    executedTargets.push("skater-detail-now");
  }

  if (options.target === "all" || options.target === "goalie-detail") {
    const goalieDetailResult = await fetchGoalieDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedGoalies,
      concurrency: options.concurrency
    });
    rows.push(...goalieDetailResult.rows);
    skippedDetails.push(...goalieDetailResult.skipped);
    executedTargets.push("goalie-detail");
  }

  if (options.target === "goalie-detail-now") {
    const goalieNowResult = await fetchGoalieDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedGoalies,
      concurrency: options.concurrency,
      nowMode: true
    });
    rows.push(...goalieNowResult.rows);
    skippedDetails.push(...goalieNowResult.skipped);
    executedTargets.push("goalie-detail-now");
  }

  const rowsUpserted = await upsertRows(rows);

  return res.status(200).json({
    success: true,
    snapshotDate: options.snapshotDate,
    seasonId,
    gameType: options.gameType,
    target: options.target,
    executedTargets,
    rowsUpserted,
    counts: {
      currentSkaterTargets: skaters.length,
      currentGoalieTargets: goalies.length,
      processedTeams: executedTargets.includes("team-detail") || executedTargets.includes("team-detail-now")
        ? options.teamId != null
          ? 1
          : 32
        : 0,
      processedLeaderboardVariants: executedTargets.includes(
        "skater-shot-location-top-10"
      )
        ? EDGE_SHOT_LOCATION_VARIANTS.length
        : 0,
      processedSkaters:
        executedTargets.includes("skater-detail") || executedTargets.includes("skater-detail-now")
        ? selectedSkaters.length - skippedDetails.filter((entry) => entry.entityType === "skater").length
        : 0,
      processedGoalies:
        executedTargets.includes("goalie-detail") || executedTargets.includes("goalie-detail-now")
        ? selectedGoalies.length - skippedDetails.filter((entry) => entry.entityType === "goalie").length
        : 0
    },
    skipped: {
      total: skippedDetails.length,
      skaters: skippedDetails.filter((entry) => entry.entityType === "skater").length,
      goalies: skippedDetails.filter((entry) => entry.entityType === "goalie").length,
      samples: skippedDetails.slice(0, 15)
    },
    pagination: {
      limit: options.limit,
      offset: options.offset,
      nextOffset: options.offset + options.limit,
      skatersRemaining:
        options.playerId != null
          ? 0
          : Math.max(0, skaters.length - (options.offset + options.limit)),
      goaliesRemaining:
        options.goalieId != null
          ? 0
          : Math.max(0, goalies.length - (options.offset + options.limit))
    },
    notes: [
      "NHL Edge public endpoints are season-to-date snapshots. This route creates historical copies from the day it starts running; it does not reconstruct true historical daily Edge states for past dates."
    ]
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  return runNhlEdgeStatsSnapshot(req, res);
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-edge-stats"
});

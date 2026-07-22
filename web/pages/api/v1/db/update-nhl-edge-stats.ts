import type { NextApiRequest, NextApiResponse } from "next";
import pLimit from "p-limit";

import {
  EDGE_SHOT_LOCATION_VARIANTS,
  buildEdgeGoalieMetricRow,
  buildEdgeGoalieDetailRow,
  buildEdgeGoalieDetailNowRow,
  buildEdgeGoalieSupplementalDetailRow,
  buildEdgeSkaterMetricRow,
  buildEdgeSkaterDetailRow,
  buildEdgeSkaterDetailNowRow,
  buildEdgeSkaterSkatingDistanceGameRows,
  buildEdgeSkaterShotLocationLeaderMetricRows,
  buildEdgeSkaterShotLocationRows,
  buildEdgeSkaterSupplementalDetailRow,
  buildEdgeTeamMetricRow,
  buildEdgeTeamDetailRow,
  buildEdgeTeamDetailNowRow,
  buildEdgeTeamSkatingDistanceGameRows,
  buildEdgeTeamSupplementalDetailRow,
  type NhlEdgeStatsFamily,
  type NhlEdgeStatsRow
} from "lib/NHL/edgeIngestion";
import {
  getEdgeGoalie5v5Detail,
  getEdgeGoalieDetail,
  getEdgeGoalieDetailNow,
  getEdgeGoalieSavePercentageDetail,
  getEdgeGoalieShotLocationDetail,
  getEdgeSkaterDetail,
  getEdgeSkaterDetailNow,
  getEdgeSkaterShotLocationDetail,
  getEdgeSkaterShotLocationTop10,
  getEdgeSkaterShotSpeedDetail,
  getEdgeSkaterSkatingDistanceDetail,
  getEdgeSkaterSkatingSpeedDetail,
  getEdgeSkaterZoneTime,
  getEdgeTeamDetail,
  getEdgeTeamDetailNow,
  getEdgeTeamShotLocationDetail,
  getEdgeTeamShotSpeedDetail,
  getEdgeTeamSkatingDistanceDetail,
  getEdgeTeamSkatingSpeedDetail,
  getEdgeTeamZoneTimeDetails,
  type EdgeGameType
} from "lib/NHL/edge";
import {
  getCurrentSeason,
  getTeams,
  type GetTeamsMode,
} from "lib/NHL/server";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";

type SupplementalTargetMode =
  | "supplemental"
  | "skater-supplemental"
  | "team-supplemental"
  | "goalie-supplemental";

type TargetMode = "all" | NhlEdgeStatsFamily | SupplementalTargetMode;

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
    entityType: "skater" | "goalie" | "team";
    playerId?: number;
    teamId?: number;
    fullName: string | null;
    endpointFamily: NhlEdgeStatsFamily | "skater-detail" | "skater-detail-now" | "goalie-detail" | "goalie-detail-now";
    reason: string;
  }>;
};

type TeamTarget = {
  teamId: number;
  teamName: string | null;
  teamAbbreviation: string | null;
};

const SKATER_SUPPLEMENTAL_ENDPOINTS = [
  {
    family: "skater-shot-speed-detail" as const,
    fetch: getEdgeSkaterShotSpeedDetail
  },
  {
    family: "skater-skating-speed-detail" as const,
    fetch: getEdgeSkaterSkatingSpeedDetail
  },
  {
    family: "skater-skating-distance-detail" as const,
    fetch: getEdgeSkaterSkatingDistanceDetail
  },
  {
    family: "skater-shot-location-detail" as const,
    fetch: getEdgeSkaterShotLocationDetail
  },
  {
    family: "skater-zone-time" as const,
    fetch: getEdgeSkaterZoneTime
  }
] as const;

const TEAM_SUPPLEMENTAL_ENDPOINTS = [
  {
    family: "team-skating-distance-detail" as const,
    fetch: getEdgeTeamSkatingDistanceDetail
  },
  {
    family: "team-zone-time-details" as const,
    fetch: getEdgeTeamZoneTimeDetails
  },
  {
    family: "team-shot-location-detail" as const,
    fetch: getEdgeTeamShotLocationDetail
  },
  {
    family: "team-shot-speed-detail" as const,
    fetch: getEdgeTeamShotSpeedDetail
  },
  {
    family: "team-skating-speed-detail" as const,
    fetch: getEdgeTeamSkatingSpeedDetail
  }
] as const;

const GOALIE_SUPPLEMENTAL_ENDPOINTS = [
  {
    family: "goalie-shot-location-detail" as const,
    fetch: getEdgeGoalieShotLocationDetail
  },
  {
    family: "goalie-5v5-detail" as const,
    fetch: getEdgeGoalie5v5Detail
  },
  {
    family: "goalie-save-percentage-detail" as const,
    fetch: getEdgeGoalieSavePercentageDetail
  }
] as const;

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
    case "skater-shot-speed-detail":
    case "skater-skating-speed-detail":
    case "skater-skating-distance-detail":
    case "skater-shot-location-detail":
    case "skater-zone-time":
    case "team-detail-now":
    case "team-detail":
    case "team-skating-distance-detail":
    case "team-zone-time-details":
    case "team-shot-location-detail":
    case "team-shot-speed-detail":
    case "team-skating-speed-detail":
    case "goalie-detail-now":
    case "goalie-detail":
    case "goalie-shot-location-detail":
    case "goalie-5v5-detail":
    case "goalie-save-percentage-detail":
    case "skater-shot-location-top-10":
    case "supplemental":
    case "skater-supplemental":
    case "team-supplemental":
    case "goalie-supplemental":
      return value;
    default:
      return "all";
  }
}

function parseActionTarget(action: string | null, target: string | null): TargetMode {
  if (action === "all") return "all";
  if (action === "teams") return "team-detail";
  if (action === "skaters") return "skater-detail";
  if (action === "goalies") return "goalie-detail";
  if (action === "leaderboards") return "skater-shot-location-top-10";
  if (action === "supplemental") return "supplemental";
  if (action === "skater-supplemental") return "skater-supplemental";
  if (action === "team-supplemental") return "team-supplemental";
  if (action === "goalie-supplemental") return "goalie-supplemental";
  if (action === "skater-distance") return "skater-skating-distance-detail";
  if (action === "team-distance") return "team-skating-distance-detail";
  return parseTarget(target);
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

function notNull<T>(value: T | null | undefined): value is T {
  return value != null;
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

async function upsertTypedMetricRows(rows: NhlEdgeStatsRow[]) {
  const skaterRows = rows
    .map(buildEdgeSkaterMetricRow)
    .filter(notNull);
  const teamRows = rows
    .map(buildEdgeTeamMetricRow)
    .filter(notNull);
  const goalieRows = rows
    .map(buildEdgeGoalieMetricRow)
    .filter(notNull);
  const leaderboardRows = buildEdgeSkaterShotLocationLeaderMetricRows(rows);
  const skaterSkatingDistanceGameRows =
    buildEdgeSkaterSkatingDistanceGameRows(rows);
  const teamSkatingDistanceGameRows =
    buildEdgeTeamSkatingDistanceGameRows(rows);

  const upserts = [
    {
      table: "nhl_edge_skater_metrics_daily",
      rows: skaterRows,
      onConflict: "snapshot_date,season_id,game_type,player_id"
    },
    {
      table: "nhl_edge_team_metrics_daily",
      rows: teamRows,
      onConflict: "snapshot_date,season_id,game_type,team_id"
    },
    {
      table: "nhl_edge_goalie_metrics_daily",
      rows: goalieRows,
      onConflict: "snapshot_date,season_id,game_type,goalie_id"
    },
    {
      table: "nhl_edge_skater_shot_location_leaders_daily",
      rows: leaderboardRows,
      onConflict: "snapshot_date,season_id,game_type,metric_key,rank_order,player_id"
    },
    {
      table: "nhl_edge_skater_skating_distance_games_daily",
      rows: skaterSkatingDistanceGameRows,
      onConflict: "snapshot_date,season_id,game_type,player_id,game_id"
    },
    {
      table: "nhl_edge_team_skating_distance_games_daily",
      rows: teamSkatingDistanceGameRows,
      onConflict: "snapshot_date,season_id,game_type,team_id,game_id"
    }
  ];

  for (const upsert of upserts) {
    if (upsert.rows.length === 0) continue;
    const { error } = await supabase
      .from(upsert.table as any)
      .upsert(upsert.rows as any, { onConflict: upsert.onConflict });

    if (error) {
      throw new Error(`Failed to upsert ${upsert.table} rows: ${error.message}`);
    }
  }

  return {
    skaters: skaterRows.length,
    teams: teamRows.length,
    goalies: goalieRows.length,
    skaterShotLocationLeaders: leaderboardRows.length,
    skaterSkatingDistanceGames: skaterSkatingDistanceGameRows.length,
    teamSkatingDistanceGames: teamSkatingDistanceGameRows.length
  };
}

function isEdgeNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not found/i.test(message) || /\b404\b/.test(message);
}

export function buildEdgeUnavailableReason(endpointFamily: string) {
  return `${endpointFamily} not available`;
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
          const row = args.nowMode
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
              });

          return {
            row: {
              ...row,
              team_id: row.team_id ?? target.teamId,
              team_abbreviation: row.team_abbreviation ?? target.teamAbbreviation,
              metadata: {
                ...row.metadata,
                rosterTeamId: target.teamId,
                rosterTeamAbbreviation: target.teamAbbreviation
              }
            },
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
              endpointFamily: (args.nowMode
                ? "skater-detail-now"
                : "skater-detail") as NhlEdgeStatsFamily,
              reason: buildEdgeUnavailableReason(
                args.nowMode ? "skater-detail-now" : "skater-detail"
              )
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
          const row = args.nowMode
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
              });

          return {
            row: {
              ...row,
              team_id: row.team_id ?? target.teamId,
              team_abbreviation: row.team_abbreviation ?? target.teamAbbreviation,
              metadata: {
                ...row.metadata,
                rosterTeamId: target.teamId,
                rosterTeamAbbreviation: target.teamAbbreviation
              }
            },
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
              endpointFamily: (args.nowMode
                ? "goalie-detail-now"
                : "goalie-detail") as NhlEdgeStatsFamily,
              reason: buildEdgeUnavailableReason(
                args.nowMode ? "goalie-detail-now" : "goalie-detail"
              )
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
  teamsMode: GetTeamsMode;
  gameType: EdgeGameType;
  teamId: number | null;
  nowMode?: boolean;
}): Promise<NhlEdgeStatsRow[]> {
  const teams = await getTeams(args.seasonId, { mode: args.teamsMode });
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

async function fetchSkaterSupplementalDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  targets: RosterTarget[];
  concurrency: number;
  family: NhlEdgeStatsFamily | null;
}): Promise<DetailFetchResult> {
  const endpointSpecs = SKATER_SUPPLEMENTAL_ENDPOINTS.filter(
    (spec) => args.family == null || spec.family === args.family
  );
  const limit = pLimit(args.concurrency);
  const results = await Promise.all(
    args.targets.flatMap((target) =>
      endpointSpecs.map((spec) =>
        limit(async () => {
          try {
            const payload = await spec.fetch(
              target.playerId,
              args.seasonId,
              args.gameType
            );
            return {
              row: buildEdgeSkaterSupplementalDetailRow({
                snapshotDate: args.snapshotDate,
                seasonId: args.seasonId,
                gameType: args.gameType,
                playerId: target.playerId,
                playerName: target.fullName,
                teamId: target.teamId,
                teamAbbreviation: target.teamAbbreviation,
                position: target.position,
                endpointFamily: spec.family,
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
                endpointFamily: spec.family,
                reason: buildEdgeUnavailableReason(spec.family)
              }
            };
          }
        })
      )
    )
  );

  return {
    rows: results.flatMap((result) => (result.row ? [result.row] : [])),
    skipped: results.flatMap((result) =>
      result.skipped ? [result.skipped] : []
    )
  };
}

async function fetchTeamSupplementalDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  targets: TeamTarget[];
  concurrency: number;
  family: NhlEdgeStatsFamily | null;
}): Promise<DetailFetchResult> {
  const endpointSpecs = TEAM_SUPPLEMENTAL_ENDPOINTS.filter(
    (spec) => args.family == null || spec.family === args.family
  );
  const limit = pLimit(args.concurrency);
  const results = await Promise.all(
    args.targets.flatMap((target) =>
      endpointSpecs.map((spec) =>
        limit(async () => {
          try {
            return {
              row: buildEdgeTeamSupplementalDetailRow({
                snapshotDate: args.snapshotDate,
                seasonId: args.seasonId,
                gameType: args.gameType,
                teamId: target.teamId,
                teamName: target.teamName,
                teamAbbreviation: target.teamAbbreviation,
                endpointFamily: spec.family,
                payload: await spec.fetch(
                  target.teamId,
                  args.seasonId,
                  args.gameType
                )
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
                entityType: "team" as const,
                teamId: target.teamId,
                fullName: target.teamName,
                endpointFamily: spec.family,
                reason: buildEdgeUnavailableReason(spec.family)
              }
            };
          }
        })
      )
    )
  );

  return {
    rows: results.flatMap((result) => (result.row ? [result.row] : [])),
    skipped: results.flatMap((result) =>
      result.skipped ? [result.skipped] : []
    )
  };
}

async function fetchGoalieSupplementalDetailRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  targets: RosterTarget[];
  concurrency: number;
  family: NhlEdgeStatsFamily | null;
}): Promise<DetailFetchResult> {
  const endpointSpecs = GOALIE_SUPPLEMENTAL_ENDPOINTS.filter(
    (spec) => args.family == null || spec.family === args.family
  );
  const limit = pLimit(args.concurrency);
  const results = await Promise.all(
    args.targets.flatMap((target) =>
      endpointSpecs.map((spec) =>
        limit(async () => {
          try {
            const payload = await spec.fetch(
              target.playerId,
              args.seasonId,
              args.gameType
            );
            return {
              row: buildEdgeGoalieSupplementalDetailRow({
                snapshotDate: args.snapshotDate,
                seasonId: args.seasonId,
                gameType: args.gameType,
                goalieId: target.playerId,
                goalieName: target.fullName,
                teamId: target.teamId,
                teamAbbreviation: target.teamAbbreviation,
                endpointFamily: spec.family,
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
                endpointFamily: spec.family,
                reason: buildEdgeUnavailableReason(spec.family)
              }
            };
          }
        })
      )
    )
  );

  return {
    rows: results.flatMap((result) => (result.row ? [result.row] : [])),
    skipped: results.flatMap((result) =>
      result.skipped ? [result.skipped] : []
    )
  };
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
  const action = firstQueryValue(req.query.action);
  const target = parseActionTarget(action, firstQueryValue(req.query.target));
  const defaultLimit = action === "all" ? 1000 : 100;
  return {
    snapshotDate,
    seasonId,
    gameType: parseGameType(firstQueryValue(req.query.gameType)),
    target: overrides?.target ?? target,
    limit: Math.max(1, Math.min(1000, parseInteger(firstQueryValue(req.query.limit), defaultLimit))),
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
  const hasExplicitSeasonOverride = options.seasonId > 0;
  const currentSeason = hasExplicitSeasonOverride
    ? { seasonId: options.seasonId }
    : await getCurrentSeason();
  const seasonId = currentSeason.seasonId;
  const teamsMode: GetTeamsMode = hasExplicitSeasonOverride
    ? "season-exact"
    : "current-canonical";
  const rosterTargets = await getCurrentRosterTargets();
  const { skaters, goalies } = splitRosterTargets(rosterTargets);
  const teams = await getTeams(seasonId, { mode: teamsMode });

  const selectedSkaters =
    options.playerId != null
      ? skaters.filter((target) => target.playerId === options.playerId)
      : applyBatch(skaters, options.limit, options.offset);
  const selectedGoalies =
    options.goalieId != null
      ? goalies.filter((target) => target.playerId === options.goalieId)
      : applyBatch(goalies, options.limit, options.offset);
  const selectedTeams =
    options.teamId != null
      ? teams.filter((team) => team.id === options.teamId)
      : teams;
  const selectedTeamTargets = selectedTeams.map((team) => ({
    teamId: team.id,
    teamName: team.name ?? null,
    teamAbbreviation: team.abbreviation ?? null
  }));

  const rows: NhlEdgeStatsRow[] = [];
  const executedTargets: string[] = [];
  const skippedDetails: DetailFetchResult["skipped"] = [];

  if (options.target === "all" || options.target === "team-detail") {
    const teamRows = await fetchTeamDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      teamsMode,
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
      teamsMode,
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

  const skaterSupplementalFamily = SKATER_SUPPLEMENTAL_ENDPOINTS.some(
    (spec) => spec.family === options.target
  )
    ? (options.target as NhlEdgeStatsFamily)
    : null;
  if (
    options.target === "supplemental" ||
    options.target === "skater-supplemental" ||
    skaterSupplementalFamily != null
  ) {
    const skaterSupplementalResult = await fetchSkaterSupplementalDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedSkaters,
      concurrency: options.concurrency,
      family: skaterSupplementalFamily
    });
    rows.push(...skaterSupplementalResult.rows);
    skippedDetails.push(...skaterSupplementalResult.skipped);
    executedTargets.push(
      skaterSupplementalFamily ?? "skater-supplemental"
    );
  }

  const teamSupplementalFamily = TEAM_SUPPLEMENTAL_ENDPOINTS.some(
    (spec) => spec.family === options.target
  )
    ? (options.target as NhlEdgeStatsFamily)
    : null;
  if (
    options.target === "supplemental" ||
    options.target === "team-supplemental" ||
    teamSupplementalFamily != null
  ) {
    const teamSupplementalResult = await fetchTeamSupplementalDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedTeamTargets,
      concurrency: options.concurrency,
      family: teamSupplementalFamily
    });
    rows.push(...teamSupplementalResult.rows);
    skippedDetails.push(...teamSupplementalResult.skipped);
    executedTargets.push(teamSupplementalFamily ?? "team-supplemental");
  }

  const goalieSupplementalFamily = GOALIE_SUPPLEMENTAL_ENDPOINTS.some(
    (spec) => spec.family === options.target
  )
    ? (options.target as NhlEdgeStatsFamily)
    : null;
  if (
    options.target === "supplemental" ||
    options.target === "goalie-supplemental" ||
    goalieSupplementalFamily != null
  ) {
    const goalieSupplementalResult = await fetchGoalieSupplementalDetailRows({
      snapshotDate: options.snapshotDate,
      seasonId,
      gameType: options.gameType,
      targets: selectedGoalies,
      concurrency: options.concurrency,
      family: goalieSupplementalFamily
    });
    rows.push(...goalieSupplementalResult.rows);
    skippedDetails.push(...goalieSupplementalResult.skipped);
    executedTargets.push(
      goalieSupplementalFamily ?? "goalie-supplemental"
    );
  }

  const validRows = rows.filter(
    (row) => Number.isFinite(row.entity_id) && row.entity_id > 0
  );
  const invalidRows = rows.length - validRows.length;
  const rowsUpserted = await upsertRows(validRows);
  const typedRowsUpserted = await upsertTypedMetricRows(validRows);

  return res.status(200).json({
    success: true,
    snapshotDate: options.snapshotDate,
    seasonId,
    gameType: options.gameType,
    target: options.target,
    executedTargets,
    rowsUpserted,
    typedRowsUpserted,
    invalidRowsSkipped: invalidRows,
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
        : 0,
      processedSupplementalEndpoints: rows.filter((row) =>
        Boolean((row.metadata as Record<string, unknown>).supplementalDetail)
      ).length
    },
    skipped: {
      total: skippedDetails.length,
      skaters: skippedDetails.filter((entry) => entry.entityType === "skater").length,
      goalies: skippedDetails.filter((entry) => entry.entityType === "goalie").length,
      teams: skippedDetails.filter((entry) => entry.entityType === "team").length,
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

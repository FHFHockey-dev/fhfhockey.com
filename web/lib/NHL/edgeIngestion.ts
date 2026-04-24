import type {
  EdgeGameType,
  EdgeGoalieDetailResponse,
  EdgeSkaterDetailResponse,
  EdgeSkaterShotLocationLeaderRow,
  EdgeSkaterShotLocationSortKey,
  EdgeTeamDetailResponse
} from "lib/NHL/edge";

export type NhlEdgeStatsFamily =
  | "skater-detail-now"
  | "skater-detail"
  | "team-detail-now"
  | "team-detail"
  | "goalie-detail-now"
  | "goalie-detail"
  | "skater-shot-location-top-10";

export type NhlEdgeStatsEntityType = "skater" | "team" | "goalie";

export type NhlEdgeStatsRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  entity_type: NhlEdgeStatsEntityType;
  entity_id: number;
  entity_slug: string | null;
  entity_name: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  endpoint_family: NhlEdgeStatsFamily;
  endpoint_variant: string;
  rank_order: number;
  source: "nhl-edge";
  source_url: string;
  payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export const EDGE_SHOT_LOCATION_VARIANTS: readonly EdgeSkaterShotLocationSortKey[] =
  ["goals", "sog", "shooting-pctg"] as const;

function buildPlayerName(
  player:
    | EdgeSkaterDetailResponse["player"]
    | EdgeGoalieDetailResponse["player"]
    | EdgeSkaterShotLocationLeaderRow["player"]
): string | null {
  const firstName = player.firstName?.default?.trim() ?? "";
  const lastName = player.lastName?.default?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || null;
}

function extractTrailingId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-(\d+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTeamName(team: {
  commonName?: { default: string };
  placeNameWithPreposition?: { default: string };
} | null | undefined): string | null {
  const place = team?.placeNameWithPreposition?.default?.trim() ?? "";
  const commonName = team?.commonName?.default?.trim() ?? "";
  return [place, commonName].filter(Boolean).join(" ").trim() || null;
}

function isoNow(): string {
  return new Date().toISOString();
}

export function buildEdgeSkaterDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeSkaterDetailResponse;
}): NhlEdgeStatsRow {
  const { snapshotDate, seasonId, gameType, payload } = args;
  const player = payload.player;
  const playerId = player.id ?? extractTrailingId(player.slug);
  return {
    snapshot_date: snapshotDate,
    season_id: seasonId,
    game_type: gameType,
    entity_type: "skater",
    entity_id: playerId ?? 0,
    entity_slug: player.slug ?? null,
    entity_name: buildPlayerName(player),
    team_id: player.team?.id ?? null,
    team_abbreviation: player.team?.abbrev ?? null,
    endpoint_family: "skater-detail",
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/skater-detail/${playerId ?? player.id}/${seasonId}/${gameType}`,
    payload,
    metadata: {
      playerPosition: player.position ?? null,
      sweaterNumber: player.sweaterNumber ?? null,
      teamName: buildTeamName(player.team)
    },
    updated_at: isoNow()
  };
}

export function buildEdgeSkaterDetailNowRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeSkaterDetailResponse;
}): NhlEdgeStatsRow {
  const row = buildEdgeSkaterDetailRow(args);
  return {
    ...row,
    endpoint_family: "skater-detail-now",
    source_url: `https://api-web.nhle.com/v1/edge/skater-detail/${row.entity_id}/now`,
    metadata: {
      ...row.metadata,
      readMode: "now"
    }
  };
}

export function buildEdgeTeamDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeTeamDetailResponse;
}): NhlEdgeStatsRow {
  const { snapshotDate, seasonId, gameType, payload } = args;
  const team = payload.team;
  const teamId = team.id ?? extractTrailingId(team.slug);
  return {
    snapshot_date: snapshotDate,
    season_id: seasonId,
    game_type: gameType,
    entity_type: "team",
    entity_id: teamId ?? 0,
    entity_slug: team.slug ?? null,
    entity_name: buildTeamName(team),
    team_id: teamId,
    team_abbreviation: team.abbrev ?? null,
    endpoint_family: "team-detail",
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/team-detail/${teamId ?? team.id}/${seasonId}/${gameType}`,
    payload,
    metadata: {},
    updated_at: isoNow()
  };
}

export function buildEdgeTeamDetailNowRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeTeamDetailResponse;
}): NhlEdgeStatsRow {
  const row = buildEdgeTeamDetailRow(args);
  return {
    ...row,
    endpoint_family: "team-detail-now",
    source_url: `https://api-web.nhle.com/v1/edge/team-detail/${row.entity_id}/now`,
    metadata: {
      ...row.metadata,
      readMode: "now"
    }
  };
}

export function buildEdgeGoalieDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeGoalieDetailResponse;
}): NhlEdgeStatsRow {
  const { snapshotDate, seasonId, gameType, payload } = args;
  const player = payload.player;
  const playerId = player.id ?? extractTrailingId(player.slug);
  return {
    snapshot_date: snapshotDate,
    season_id: seasonId,
    game_type: gameType,
    entity_type: "goalie",
    entity_id: playerId ?? 0,
    entity_slug: player.slug ?? null,
    entity_name: buildPlayerName(player),
    team_id: player.team?.id ?? null,
    team_abbreviation: player.team?.abbrev ?? null,
    endpoint_family: "goalie-detail",
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/goalie-detail/${playerId ?? player.id}/${seasonId}/${gameType}`,
    payload,
    metadata: {
      playerPosition: player.position ?? null,
      sweaterNumber: player.sweaterNumber ?? null,
      teamName: buildTeamName(player.team)
    },
    updated_at: isoNow()
  };
}

export function buildEdgeGoalieDetailNowRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  payload: EdgeGoalieDetailResponse;
}): NhlEdgeStatsRow {
  const row = buildEdgeGoalieDetailRow(args);
  return {
    ...row,
    endpoint_family: "goalie-detail-now",
    source_url: `https://api-web.nhle.com/v1/edge/goalie-detail/${row.entity_id}/now`,
    metadata: {
      ...row.metadata,
      readMode: "now"
    }
  };
}

export function buildEdgeSkaterShotLocationRows(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  variant: EdgeSkaterShotLocationSortKey;
  payload: EdgeSkaterShotLocationLeaderRow[];
}): NhlEdgeStatsRow[] {
  const { snapshotDate, seasonId, gameType, variant, payload } = args;
  return payload.map((row, index) => ({
    snapshot_date: snapshotDate,
    season_id: seasonId,
    game_type: gameType,
    entity_type: "skater",
    entity_id: row.player.id ?? extractTrailingId(row.player.slug) ?? 0,
    entity_slug: row.player.slug ?? null,
    entity_name: buildPlayerName(row.player),
    team_id:
      row.player.team?.id ??
      extractTrailingId(row.player.team?.slug ?? null) ??
      null,
    team_abbreviation: row.player.team?.abbrev ?? null,
    endpoint_family: "skater-shot-location-top-10",
    endpoint_variant: variant,
    rank_order: index + 1,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/skater-shot-location-top-10/all/${variant}/all/${seasonId}/${gameType}`,
    payload: row,
    metadata: {
      teamName: buildTeamName(row.player.team),
      playerPosition: row.player.position ?? null,
      sweaterNumber: row.player.sweaterNumber ?? null
    },
    updated_at: isoNow()
  }));
}

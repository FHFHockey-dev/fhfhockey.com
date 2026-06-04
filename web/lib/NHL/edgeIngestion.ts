import type {
  EdgeGameType,
  EdgeGoalieDetailResponse,
  EdgeGoalieSupplementalDetailResponse,
  EdgeSkaterDetailResponse,
  EdgeSkaterShotLocationLeaderRow,
  EdgeSkaterShotLocationSortKey,
  EdgeSkaterSupplementalDetailResponse,
  EdgeTeamDetailResponse,
  EdgeTeamSupplementalDetailResponse
} from "lib/NHL/edge";

export type NhlEdgeStatsFamily =
  | "skater-detail-now"
  | "skater-detail"
  | "skater-shot-speed-detail"
  | "skater-skating-speed-detail"
  | "skater-skating-distance-detail"
  | "skater-shot-location-detail"
  | "skater-zone-time"
  | "team-detail-now"
  | "team-detail"
  | "team-skating-distance-detail"
  | "team-zone-time-details"
  | "team-shot-location-detail"
  | "team-shot-speed-detail"
  | "team-skating-speed-detail"
  | "goalie-detail-now"
  | "goalie-detail"
  | "goalie-shot-location-detail"
  | "goalie-5v5-detail"
  | "goalie-save-percentage-detail"
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

export type NhlEdgeSkaterMetricRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  player_id: number;
  player_name: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  position: string | null;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  top_shot_speed_mph: number | null;
  top_shot_speed_kph: number | null;
  top_shot_speed_percentile: number | null;
  top_shot_speed_league_avg_mph: number | null;
  max_skating_speed_mph: number | null;
  max_skating_speed_kph: number | null;
  max_skating_speed_percentile: number | null;
  max_skating_speed_league_avg_mph: number | null;
  bursts_over_20: number | null;
  bursts_over_20_percentile: number | null;
  bursts_over_20_league_avg: number | null;
  total_distance_miles: number | null;
  total_distance_km: number | null;
  total_distance_percentile: number | null;
  total_distance_league_avg_miles: number | null;
  max_game_distance_miles: number | null;
  max_game_distance_km: number | null;
  max_game_distance_percentile: number | null;
  max_game_distance_league_avg_miles: number | null;
  all_shots: number | null;
  all_goals: number | null;
  all_shooting_pct: number | null;
  high_danger_shots: number | null;
  high_danger_goals: number | null;
  high_danger_shooting_pct: number | null;
  mid_range_shots: number | null;
  mid_range_goals: number | null;
  mid_range_shooting_pct: number | null;
  long_range_shots: number | null;
  long_range_goals: number | null;
  long_range_shooting_pct: number | null;
  offensive_zone_pct: number | null;
  offensive_zone_percentile: number | null;
  offensive_zone_league_avg: number | null;
  offensive_zone_ev_pct: number | null;
  offensive_zone_ev_percentile: number | null;
  offensive_zone_ev_league_avg: number | null;
  neutral_zone_pct: number | null;
  neutral_zone_percentile: number | null;
  neutral_zone_league_avg: number | null;
  defensive_zone_pct: number | null;
  defensive_zone_percentile: number | null;
  defensive_zone_league_avg: number | null;
  source_url: string;
  raw_payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type NhlEdgeTeamMetricRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  team_id: number;
  team_abbreviation: string | null;
  team_name: string | null;
  conference: string | null;
  division: string | null;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  points: number | null;
  shot_attempts_over_90: number | null;
  shot_attempts_over_90_rank: number | null;
  top_shot_speed_mph: number | null;
  top_shot_speed_kph: number | null;
  top_shot_speed_rank: number | null;
  top_shot_speed_league_avg_mph: number | null;
  bursts_over_22: number | null;
  bursts_over_22_rank: number | null;
  bursts_over_20: number | null;
  bursts_over_20_rank: number | null;
  bursts_over_20_league_avg: number | null;
  max_skating_speed_mph: number | null;
  max_skating_speed_kph: number | null;
  max_skating_speed_rank: number | null;
  max_skating_speed_league_avg_mph: number | null;
  total_distance_miles: number | null;
  total_distance_km: number | null;
  total_distance_rank: number | null;
  total_distance_league_avg_miles: number | null;
  all_shots: number | null;
  all_goals: number | null;
  all_shooting_pct: number | null;
  all_shots_rank: number | null;
  all_goals_rank: number | null;
  all_shooting_pct_rank: number | null;
  high_danger_shots: number | null;
  high_danger_goals: number | null;
  high_danger_shooting_pct: number | null;
  high_danger_shots_rank: number | null;
  high_danger_goals_rank: number | null;
  high_danger_shooting_pct_rank: number | null;
  mid_range_shots: number | null;
  mid_range_goals: number | null;
  mid_range_shooting_pct: number | null;
  mid_range_shots_rank: number | null;
  mid_range_goals_rank: number | null;
  mid_range_shooting_pct_rank: number | null;
  long_range_shots: number | null;
  long_range_goals: number | null;
  long_range_shooting_pct: number | null;
  long_range_shots_rank: number | null;
  long_range_goals_rank: number | null;
  long_range_shooting_pct_rank: number | null;
  offensive_zone_pct: number | null;
  offensive_zone_rank: number | null;
  offensive_zone_league_avg: number | null;
  offensive_zone_ev_pct: number | null;
  offensive_zone_ev_rank: number | null;
  offensive_zone_ev_league_avg: number | null;
  neutral_zone_pct: number | null;
  neutral_zone_rank: number | null;
  neutral_zone_league_avg: number | null;
  defensive_zone_pct: number | null;
  defensive_zone_rank: number | null;
  defensive_zone_league_avg: number | null;
  source_url: string;
  raw_payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type NhlEdgeGoalieMetricRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  goalie_id: number;
  goalie_name: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  goals_against_avg: number | null;
  save_pct: number | null;
  edge_goals_against_avg: number | null;
  edge_goals_against_avg_percentile: number | null;
  edge_goals_against_avg_league_avg: number | null;
  games_above_900: number | null;
  games_above_900_percentile: number | null;
  games_above_900_league_avg: number | null;
  goal_differential_per_60: number | null;
  goal_differential_per_60_percentile: number | null;
  goal_differential_per_60_league_avg: number | null;
  goal_support_avg: number | null;
  goal_support_avg_percentile: number | null;
  goal_support_avg_league_avg: number | null;
  point_pct: number | null;
  point_pct_percentile: number | null;
  point_pct_league_avg: number | null;
  all_goals_against: number | null;
  all_saves: number | null;
  all_save_pct: number | null;
  high_danger_goals_against: number | null;
  high_danger_saves: number | null;
  high_danger_save_pct: number | null;
  mid_range_goals_against: number | null;
  mid_range_saves: number | null;
  mid_range_save_pct: number | null;
  long_range_goals_against: number | null;
  long_range_saves: number | null;
  long_range_save_pct: number | null;
  source_url: string;
  raw_payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type NhlEdgeSkaterShotLocationLeaderMetricRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  metric_key: string;
  rank_order: number;
  player_id: number;
  player_name: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  position: string | null;
  all_value: number | null;
  high_danger_value: number | null;
  mid_range_value: number | null;
  long_range_value: number | null;
  source_url: string;
  raw_payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type NhlEdgeSkaterSkatingDistanceGameRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  player_id: number;
  player_name: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  position: string | null;
  game_id: number;
  game_date: string | null;
  player_on_home_team: boolean | null;
  home_team_abbreviation: string | null;
  away_team_abbreviation: string | null;
  toi_all_seconds: number | null;
  distance_skated_all_miles: number | null;
  distance_skated_all_km: number | null;
  toi_even_seconds: number | null;
  distance_skated_even_miles: number | null;
  distance_skated_even_km: number | null;
  toi_pp_seconds: number | null;
  distance_skated_pp_miles: number | null;
  distance_skated_pp_km: number | null;
  toi_pk_seconds: number | null;
  distance_skated_pk_miles: number | null;
  distance_skated_pk_km: number | null;
  game_center_link: string | null;
  source_url: string;
  raw_payload: unknown;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type NhlEdgeTeamSkatingDistanceGameRow = {
  snapshot_date: string;
  season_id: number;
  game_type: EdgeGameType;
  team_id: number;
  team_abbreviation: string | null;
  team_name: string | null;
  game_id: number;
  game_date: string | null;
  is_home_team: boolean | null;
  home_team_abbreviation: string | null;
  away_team_abbreviation: string | null;
  toi_all_seconds: number | null;
  distance_skated_all_miles: number | null;
  distance_skated_all_km: number | null;
  toi_even_seconds: number | null;
  distance_skated_even_miles: number | null;
  distance_skated_even_km: number | null;
  toi_pp_seconds: number | null;
  distance_skated_pp_miles: number | null;
  distance_skated_pp_km: number | null;
  toi_pk_seconds: number | null;
  distance_skated_pk_miles: number | null;
  distance_skated_pk_km: number | null;
  game_center_link: string | null;
  source_url: string;
  raw_payload: unknown;
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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  const numberValue = numberOrNull(value);
  return numberValue == null ? null : Math.trunc(numberValue);
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseGameIdFromGameCenterLink(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/(\d{10})$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function edgeMeasure(value: unknown): { imperial: number | null; metric: number | null } {
  const measure = objectOrNull(value);
  return {
    imperial: numberOrNull(measure?.imperial),
    metric: numberOrNull(measure?.metric)
  };
}

function teamAbbreviationFromPayload(value: unknown): string | null {
  const team = objectOrNull(value);
  return stringOrNull(team?.abbrev);
}

function findLocationSummary(
  rows: unknown,
  locationCode: "all" | "high" | "mid" | "long"
): Record<string, unknown> {
  if (!Array.isArray(rows)) return {};
  return (
    (rows.find(
      (row) =>
        typeof row === "object" &&
        row != null &&
        (row as { locationCode?: unknown }).locationCode === locationCode
    ) as Record<string, unknown> | undefined) ?? {}
  );
}

function edgeStatTriple(
  stats: Record<string, unknown> | undefined,
  key: string
): { value: number | null; percentile: number | null; leagueAvg: number | null } {
  const stat = stats?.[key] as Record<string, unknown> | undefined;
  return {
    value: numberOrNull(stat?.value),
    percentile: numberOrNull(stat?.percentile),
    leagueAvg: numberOrNull(stat?.leagueAvg)
  };
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

export function buildEdgeSkaterSupplementalDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  playerId: number;
  playerName: string | null;
  teamId: number | null;
  teamAbbreviation: string | null;
  position: string | null;
  endpointFamily: Extract<
    NhlEdgeStatsFamily,
    | "skater-shot-speed-detail"
    | "skater-skating-speed-detail"
    | "skater-skating-distance-detail"
    | "skater-shot-location-detail"
    | "skater-zone-time"
  >;
  payload: EdgeSkaterSupplementalDetailResponse;
}): NhlEdgeStatsRow {
  return {
    snapshot_date: args.snapshotDate,
    season_id: args.seasonId,
    game_type: args.gameType,
    entity_type: "skater",
    entity_id: args.playerId,
    entity_slug: null,
    entity_name: args.playerName,
    team_id: args.teamId,
    team_abbreviation: args.teamAbbreviation,
    endpoint_family: args.endpointFamily,
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/${args.endpointFamily}/${args.playerId}/${args.seasonId}/${args.gameType}`,
    payload: args.payload,
    metadata: {
      playerPosition: args.position,
      supplementalDetail: true
    },
    updated_at: isoNow()
  };
}

export function buildEdgeTeamSupplementalDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  teamId: number;
  teamName: string | null;
  teamAbbreviation: string | null;
  endpointFamily: Extract<
    NhlEdgeStatsFamily,
    | "team-skating-distance-detail"
    | "team-zone-time-details"
    | "team-shot-location-detail"
    | "team-shot-speed-detail"
    | "team-skating-speed-detail"
  >;
  payload: EdgeTeamSupplementalDetailResponse;
}): NhlEdgeStatsRow {
  return {
    snapshot_date: args.snapshotDate,
    season_id: args.seasonId,
    game_type: args.gameType,
    entity_type: "team",
    entity_id: args.teamId,
    entity_slug: null,
    entity_name: args.teamName,
    team_id: args.teamId,
    team_abbreviation: args.teamAbbreviation,
    endpoint_family: args.endpointFamily,
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/${args.endpointFamily}/${args.teamId}/${args.seasonId}/${args.gameType}`,
    payload: args.payload,
    metadata: {
      supplementalDetail: true
    },
    updated_at: isoNow()
  };
}

export function buildEdgeGoalieSupplementalDetailRow(args: {
  snapshotDate: string;
  seasonId: number;
  gameType: EdgeGameType;
  goalieId: number;
  goalieName: string | null;
  teamId: number | null;
  teamAbbreviation: string | null;
  endpointFamily: Extract<
    NhlEdgeStatsFamily,
    | "goalie-shot-location-detail"
    | "goalie-5v5-detail"
    | "goalie-save-percentage-detail"
  >;
  payload: EdgeGoalieSupplementalDetailResponse;
}): NhlEdgeStatsRow {
  return {
    snapshot_date: args.snapshotDate,
    season_id: args.seasonId,
    game_type: args.gameType,
    entity_type: "goalie",
    entity_id: args.goalieId,
    entity_slug: null,
    entity_name: args.goalieName,
    team_id: args.teamId,
    team_abbreviation: args.teamAbbreviation,
    endpoint_family: args.endpointFamily,
    endpoint_variant: "",
    rank_order: 0,
    source: "nhl-edge",
    source_url: `https://api-web.nhle.com/v1/edge/${args.endpointFamily}/${args.goalieId}/${args.seasonId}/${args.gameType}`,
    payload: args.payload,
    metadata: {
      playerPosition: "G",
      supplementalDetail: true
    },
    updated_at: isoNow()
  };
}

export function buildEdgeSkaterMetricRow(row: NhlEdgeStatsRow): NhlEdgeSkaterMetricRow | null {
  if (row.entity_type !== "skater" || row.endpoint_family !== "skater-detail") return null;
  const payload = row.payload as EdgeSkaterDetailResponse;
  const player = payload.player;
  const all = findLocationSummary(payload.sogSummary, "all");
  const high = findLocationSummary(payload.sogSummary, "high");
  const mid = findLocationSummary(payload.sogSummary, "mid");
  const long = findLocationSummary(payload.sogSummary, "long");
  const zone = (payload.zoneTimeDetails ?? {}) as Record<string, unknown>;
  return {
    snapshot_date: row.snapshot_date,
    season_id: row.season_id,
    game_type: row.game_type,
    player_id: row.entity_id,
    player_name: row.entity_name,
    team_id: row.team_id,
    team_abbreviation: row.team_abbreviation,
    position: player.position ?? null,
    games_played: integerOrNull((player as any).gamesPlayed),
    goals: integerOrNull((player as any).goals),
    assists: integerOrNull((player as any).assists),
    points: integerOrNull((player as any).points),
    top_shot_speed_mph: numberOrNull(payload.topShotSpeed?.imperial),
    top_shot_speed_kph: numberOrNull(payload.topShotSpeed?.metric),
    top_shot_speed_percentile: numberOrNull(payload.topShotSpeed?.percentile),
    top_shot_speed_league_avg_mph: numberOrNull((payload.topShotSpeed?.leagueAvg as any)?.imperial),
    max_skating_speed_mph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.imperial),
    max_skating_speed_kph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.metric),
    max_skating_speed_percentile: numberOrNull((payload.skatingSpeed?.speedMax as any)?.percentile),
    max_skating_speed_league_avg_mph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.leagueAvg?.imperial),
    bursts_over_20: integerOrNull((payload.skatingSpeed?.burstsOver20 as any)?.value),
    bursts_over_20_percentile: numberOrNull((payload.skatingSpeed?.burstsOver20 as any)?.percentile),
    bursts_over_20_league_avg: numberOrNull((payload.skatingSpeed?.burstsOver20 as any)?.leagueAvg?.value),
    total_distance_miles: numberOrNull(payload.totalDistanceSkated?.imperial),
    total_distance_km: numberOrNull(payload.totalDistanceSkated?.metric),
    total_distance_percentile: numberOrNull(payload.totalDistanceSkated?.percentile),
    total_distance_league_avg_miles: numberOrNull((payload.totalDistanceSkated?.leagueAvg as any)?.imperial),
    max_game_distance_miles: numberOrNull(payload.distanceMaxGame?.imperial),
    max_game_distance_km: numberOrNull(payload.distanceMaxGame?.metric),
    max_game_distance_percentile: numberOrNull(payload.distanceMaxGame?.percentile),
    max_game_distance_league_avg_miles: numberOrNull((payload.distanceMaxGame?.leagueAvg as any)?.imperial),
    all_shots: integerOrNull(all.shots),
    all_goals: integerOrNull(all.goals),
    all_shooting_pct: numberOrNull(all.shootingPctg),
    high_danger_shots: integerOrNull(high.shots),
    high_danger_goals: integerOrNull(high.goals),
    high_danger_shooting_pct: numberOrNull(high.shootingPctg),
    mid_range_shots: integerOrNull(mid.shots),
    mid_range_goals: integerOrNull(mid.goals),
    mid_range_shooting_pct: numberOrNull(mid.shootingPctg),
    long_range_shots: integerOrNull(long.shots),
    long_range_goals: integerOrNull(long.goals),
    long_range_shooting_pct: numberOrNull(long.shootingPctg),
    offensive_zone_pct: numberOrNull(zone.offensiveZonePctg),
    offensive_zone_percentile: numberOrNull(zone.offensiveZonePercentile),
    offensive_zone_league_avg: numberOrNull(zone.offensiveZoneLeagueAvg),
    offensive_zone_ev_pct: numberOrNull(zone.offensiveZoneEvPctg),
    offensive_zone_ev_percentile: numberOrNull(zone.offensiveZoneEvPercentile),
    offensive_zone_ev_league_avg: numberOrNull(zone.offensiveZoneEvLeagueAvg),
    neutral_zone_pct: numberOrNull(zone.neutralZonePctg),
    neutral_zone_percentile: numberOrNull(zone.neutralZonePercentile),
    neutral_zone_league_avg: numberOrNull(zone.neutralZoneLeagueAvg),
    defensive_zone_pct: numberOrNull(zone.defensiveZonePctg),
    defensive_zone_percentile: numberOrNull(zone.defensiveZonePercentile),
    defensive_zone_league_avg: numberOrNull(zone.defensiveZoneLeagueAvg),
    source_url: row.source_url,
    raw_payload: row.payload,
    metadata: row.metadata,
    updated_at: row.updated_at
  };
}

export function buildEdgeTeamMetricRow(row: NhlEdgeStatsRow): NhlEdgeTeamMetricRow | null {
  if (row.entity_type !== "team" || row.endpoint_family !== "team-detail") return null;
  const payload = row.payload as EdgeTeamDetailResponse;
  const team = payload.team;
  const all = findLocationSummary(payload.sogSummary, "all");
  const high = findLocationSummary(payload.sogSummary, "high");
  const mid = findLocationSummary(payload.sogSummary, "mid");
  const long = findLocationSummary(payload.sogSummary, "long");
  const zone = (payload.zoneTimeDetails ?? {}) as Record<string, unknown>;
  return {
    snapshot_date: row.snapshot_date,
    season_id: row.season_id,
    game_type: row.game_type,
    team_id: row.entity_id,
    team_abbreviation: row.team_abbreviation,
    team_name: row.entity_name,
    conference: (team as any).conference ?? null,
    division: (team as any).division ?? null,
    games_played: integerOrNull((team as any).gamesPlayed),
    wins: integerOrNull((team as any).wins),
    losses: integerOrNull((team as any).losses),
    ot_losses: integerOrNull((team as any).otLosses),
    points: integerOrNull((team as any).points),
    shot_attempts_over_90: integerOrNull((payload.shotSpeed?.shotAttemptsOver90 as any)?.value),
    shot_attempts_over_90_rank: integerOrNull((payload.shotSpeed?.shotAttemptsOver90 as any)?.rank),
    top_shot_speed_mph: numberOrNull((payload.shotSpeed?.topShotSpeed as any)?.imperial),
    top_shot_speed_kph: numberOrNull((payload.shotSpeed?.topShotSpeed as any)?.metric),
    top_shot_speed_rank: integerOrNull((payload.shotSpeed?.topShotSpeed as any)?.rank),
    top_shot_speed_league_avg_mph: numberOrNull((payload.shotSpeed?.topShotSpeed as any)?.leagueAvg?.imperial),
    bursts_over_22: integerOrNull((payload.skatingSpeed?.burstsOver22 as any)?.value),
    bursts_over_22_rank: integerOrNull((payload.skatingSpeed?.burstsOver22 as any)?.rank),
    bursts_over_20: integerOrNull((payload.skatingSpeed?.burstsOver20 as any)?.value),
    bursts_over_20_rank: integerOrNull((payload.skatingSpeed?.burstsOver20 as any)?.rank),
    bursts_over_20_league_avg: numberOrNull((payload.skatingSpeed?.burstsOver20 as any)?.leagueAvg?.value),
    max_skating_speed_mph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.imperial),
    max_skating_speed_kph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.metric),
    max_skating_speed_rank: integerOrNull((payload.skatingSpeed?.speedMax as any)?.rank),
    max_skating_speed_league_avg_mph: numberOrNull((payload.skatingSpeed?.speedMax as any)?.leagueAvg?.imperial),
    total_distance_miles: numberOrNull((payload.distanceSkated?.total as any)?.imperial),
    total_distance_km: numberOrNull((payload.distanceSkated?.total as any)?.metric),
    total_distance_rank: integerOrNull((payload.distanceSkated?.total as any)?.rank),
    total_distance_league_avg_miles: numberOrNull((payload.distanceSkated?.total as any)?.leagueAvg?.imperial),
    all_shots: integerOrNull(all.shots),
    all_goals: integerOrNull(all.goals),
    all_shooting_pct: numberOrNull(all.shootingPctg),
    all_shots_rank: integerOrNull(all.shotsRank),
    all_goals_rank: integerOrNull(all.goalsRank),
    all_shooting_pct_rank: integerOrNull(all.shootingPctgRank),
    high_danger_shots: integerOrNull(high.shots),
    high_danger_goals: integerOrNull(high.goals),
    high_danger_shooting_pct: numberOrNull(high.shootingPctg),
    high_danger_shots_rank: integerOrNull(high.shotsRank),
    high_danger_goals_rank: integerOrNull(high.goalsRank),
    high_danger_shooting_pct_rank: integerOrNull(high.shootingPctgRank),
    mid_range_shots: integerOrNull(mid.shots),
    mid_range_goals: integerOrNull(mid.goals),
    mid_range_shooting_pct: numberOrNull(mid.shootingPctg),
    mid_range_shots_rank: integerOrNull(mid.shotsRank),
    mid_range_goals_rank: integerOrNull(mid.goalsRank),
    mid_range_shooting_pct_rank: integerOrNull(mid.shootingPctgRank),
    long_range_shots: integerOrNull(long.shots),
    long_range_goals: integerOrNull(long.goals),
    long_range_shooting_pct: numberOrNull(long.shootingPctg),
    long_range_shots_rank: integerOrNull(long.shotsRank),
    long_range_goals_rank: integerOrNull(long.goalsRank),
    long_range_shooting_pct_rank: integerOrNull(long.shootingPctgRank),
    offensive_zone_pct: numberOrNull(zone.offensiveZonePctg),
    offensive_zone_rank: integerOrNull(zone.offensiveZoneRank),
    offensive_zone_league_avg: numberOrNull(zone.offensiveZoneLeagueAvg),
    offensive_zone_ev_pct: numberOrNull(zone.offensiveZoneEvPctg),
    offensive_zone_ev_rank: integerOrNull(zone.offensiveZoneEvRank),
    offensive_zone_ev_league_avg: numberOrNull(zone.offensiveZoneEvLeagueAvg),
    neutral_zone_pct: numberOrNull(zone.neutralZonePctg),
    neutral_zone_rank: integerOrNull(zone.neutralZoneRank),
    neutral_zone_league_avg: numberOrNull(zone.neutralZoneLeagueAvg),
    defensive_zone_pct: numberOrNull(zone.defensiveZonePctg),
    defensive_zone_rank: integerOrNull(zone.defensiveZoneRank),
    defensive_zone_league_avg: numberOrNull(zone.defensiveZoneLeagueAvg),
    source_url: row.source_url,
    raw_payload: row.payload,
    metadata: row.metadata,
    updated_at: row.updated_at
  };
}

export function buildEdgeGoalieMetricRow(row: NhlEdgeStatsRow): NhlEdgeGoalieMetricRow | null {
  if (row.entity_type !== "goalie" || row.endpoint_family !== "goalie-detail") return null;
  const payload = row.payload as EdgeGoalieDetailResponse;
  const player = payload.player;
  const stats = payload.stats;
  const gaa = edgeStatTriple(stats, "goalsAgainstAvg");
  const gamesAbove900 = edgeStatTriple(stats, "gamesAbove900");
  const goalDiff = edgeStatTriple(stats, "goalDifferentialPer60");
  const goalSupport = edgeStatTriple(stats, "goalSupportAvg");
  const pointPct = edgeStatTriple(stats, "pointPctg");
  const all = findLocationSummary(payload.shotLocationSummary, "all");
  const high = findLocationSummary(payload.shotLocationSummary, "high");
  const mid = findLocationSummary(payload.shotLocationSummary, "mid");
  const long = findLocationSummary(payload.shotLocationSummary, "long");
  return {
    snapshot_date: row.snapshot_date,
    season_id: row.season_id,
    game_type: row.game_type,
    goalie_id: row.entity_id,
    goalie_name: row.entity_name,
    team_id: row.team_id,
    team_abbreviation: row.team_abbreviation,
    games_played: integerOrNull((player as any).gamesPlayed),
    wins: integerOrNull((player as any).wins),
    losses: integerOrNull((player as any).losses),
    ot_losses: integerOrNull((player as any).overtimeLosses),
    goals_against_avg: numberOrNull((player as any).goalsAgainstAvg),
    save_pct: numberOrNull((player as any).savePctg),
    edge_goals_against_avg: gaa.value,
    edge_goals_against_avg_percentile: gaa.percentile,
    edge_goals_against_avg_league_avg: gaa.leagueAvg,
    games_above_900: gamesAbove900.value,
    games_above_900_percentile: gamesAbove900.percentile,
    games_above_900_league_avg: gamesAbove900.leagueAvg,
    goal_differential_per_60: goalDiff.value,
    goal_differential_per_60_percentile: goalDiff.percentile,
    goal_differential_per_60_league_avg: goalDiff.leagueAvg,
    goal_support_avg: goalSupport.value,
    goal_support_avg_percentile: goalSupport.percentile,
    goal_support_avg_league_avg: goalSupport.leagueAvg,
    point_pct: pointPct.value,
    point_pct_percentile: pointPct.percentile,
    point_pct_league_avg: pointPct.leagueAvg,
    all_goals_against: integerOrNull(all.goalsAgainst),
    all_saves: integerOrNull(all.saves),
    all_save_pct: numberOrNull(all.savePctg),
    high_danger_goals_against: integerOrNull(high.goalsAgainst),
    high_danger_saves: integerOrNull(high.saves),
    high_danger_save_pct: numberOrNull(high.savePctg),
    mid_range_goals_against: integerOrNull(mid.goalsAgainst),
    mid_range_saves: integerOrNull(mid.saves),
    mid_range_save_pct: numberOrNull(mid.savePctg),
    long_range_goals_against: integerOrNull(long.goalsAgainst),
    long_range_saves: integerOrNull(long.saves),
    long_range_save_pct: numberOrNull(long.savePctg),
    source_url: row.source_url,
    raw_payload: row.payload,
    metadata: row.metadata,
    updated_at: row.updated_at
  };
}

export function buildEdgeSkaterShotLocationLeaderMetricRows(
  rows: NhlEdgeStatsRow[]
): NhlEdgeSkaterShotLocationLeaderMetricRow[] {
  return rows
    .filter((row) => row.endpoint_family === "skater-shot-location-top-10")
    .map((row) => {
      const payload = row.payload as EdgeSkaterShotLocationLeaderRow;
      return {
        snapshot_date: row.snapshot_date,
        season_id: row.season_id,
        game_type: row.game_type,
        metric_key: row.endpoint_variant,
        rank_order: row.rank_order,
        player_id: row.entity_id,
        player_name: row.entity_name,
        team_id: row.team_id,
        team_abbreviation: row.team_abbreviation,
        position: payload.player.position ?? null,
        all_value: numberOrNull(payload.all),
        high_danger_value: numberOrNull(payload.highDanger),
        mid_range_value: numberOrNull(payload.midRange),
        long_range_value: numberOrNull(payload.longRange),
        source_url: row.source_url,
        raw_payload: row.payload,
        metadata: row.metadata,
        updated_at: row.updated_at
      };
    });
}

export function buildEdgeSkaterSkatingDistanceGameRows(
  rows: NhlEdgeStatsRow[]
): NhlEdgeSkaterSkatingDistanceGameRow[] {
  return rows.flatMap((row) => {
    if (row.entity_type !== "skater" || row.endpoint_family !== "skater-skating-distance-detail") {
      return [];
    }
    const payload = row.payload as { skatingDistanceLast10?: unknown };
    if (!Array.isArray(payload.skatingDistanceLast10)) return [];

    return payload.skatingDistanceLast10.flatMap((gameRow) => {
      const game = objectOrNull(gameRow);
      const gameId = parseGameIdFromGameCenterLink(game?.gameCenterLink);
      if (!game || !gameId) return [];
      const all = edgeMeasure(game.distanceSkatedAll);
      const even = edgeMeasure(game.distanceSkatedEven);
      const pp = edgeMeasure(game.distanceSkatedPP);
      const pk = edgeMeasure(game.distanceSkatedPK);

      return [{
        snapshot_date: row.snapshot_date,
        season_id: row.season_id,
        game_type: row.game_type,
        player_id: row.entity_id,
        player_name: row.entity_name,
        team_id: row.team_id,
        team_abbreviation: row.team_abbreviation,
        position: stringOrNull(row.metadata.playerPosition),
        game_id: gameId,
        game_date: stringOrNull(game.gameDate),
        player_on_home_team: booleanOrNull(game.playerOnHomeTeam),
        home_team_abbreviation: teamAbbreviationFromPayload(game.homeTeam),
        away_team_abbreviation: teamAbbreviationFromPayload(game.awayTeam),
        toi_all_seconds: integerOrNull(game.toiAll),
        distance_skated_all_miles: all.imperial,
        distance_skated_all_km: all.metric,
        toi_even_seconds: integerOrNull(game.toiEven),
        distance_skated_even_miles: even.imperial,
        distance_skated_even_km: even.metric,
        toi_pp_seconds: integerOrNull(game.toiPP),
        distance_skated_pp_miles: pp.imperial,
        distance_skated_pp_km: pp.metric,
        toi_pk_seconds: integerOrNull(game.toiPK),
        distance_skated_pk_miles: pk.imperial,
        distance_skated_pk_km: pk.metric,
        game_center_link: stringOrNull(game.gameCenterLink),
        source_url: row.source_url,
        raw_payload: game,
        metadata: row.metadata,
        updated_at: row.updated_at
      }];
    });
  });
}

export function buildEdgeTeamSkatingDistanceGameRows(
  rows: NhlEdgeStatsRow[]
): NhlEdgeTeamSkatingDistanceGameRow[] {
  return rows.flatMap((row) => {
    if (row.entity_type !== "team" || row.endpoint_family !== "team-skating-distance-detail") {
      return [];
    }
    const payload = row.payload as { skatingDistanceLast10?: unknown };
    if (!Array.isArray(payload.skatingDistanceLast10)) return [];

    return payload.skatingDistanceLast10.flatMap((gameRow) => {
      const game = objectOrNull(gameRow);
      const gameId = parseGameIdFromGameCenterLink(game?.gameCenterLink);
      if (!game || !gameId) return [];
      const all = edgeMeasure(game.distanceSkatedAll);
      const even = edgeMeasure(game.distanceSkatedEven);
      const pp = edgeMeasure(game.distanceSkatedPP);
      const pk = edgeMeasure(game.distanceSkatedPK);

      return [{
        snapshot_date: row.snapshot_date,
        season_id: row.season_id,
        game_type: row.game_type,
        team_id: row.entity_id,
        team_abbreviation: row.team_abbreviation,
        team_name: row.entity_name,
        game_id: gameId,
        game_date: stringOrNull(game.gameDate),
        is_home_team: booleanOrNull(game.isHomeTeam),
        home_team_abbreviation: teamAbbreviationFromPayload(game.homeTeam),
        away_team_abbreviation: teamAbbreviationFromPayload(game.awayTeam),
        toi_all_seconds: integerOrNull(game.toiAll),
        distance_skated_all_miles: all.imperial,
        distance_skated_all_km: all.metric,
        toi_even_seconds: integerOrNull(game.toiEven),
        distance_skated_even_miles: even.imperial,
        distance_skated_even_km: even.metric,
        toi_pp_seconds: integerOrNull(game.toiPP),
        distance_skated_pp_miles: pp.imperial,
        distance_skated_pp_km: pp.metric,
        toi_pk_seconds: integerOrNull(game.toiPK),
        distance_skated_pk_miles: pk.imperial,
        distance_skated_pk_km: pk.metric,
        game_center_link: stringOrNull(game.gameCenterLink),
        source_url: row.source_url,
        raw_payload: game,
        metadata: row.metadata,
        updated_at: row.updated_at
      }];
    });
  });
}

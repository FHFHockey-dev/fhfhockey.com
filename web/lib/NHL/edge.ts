import { get } from "lib/NHL/base";

export type EdgeGameType = 2 | 3;

type EdgeLocalizedString = {
  default: string;
  fr?: string;
};

type EdgeImageVariant = {
  light?: string;
  dark?: string;
};

export type EdgeTeamSummary = {
  id?: number;
  abbrev: string;
  slug: string;
  commonName?: EdgeLocalizedString;
  placeNameWithPreposition?: EdgeLocalizedString;
  teamLogo?: EdgeImageVariant;
};

export type EdgePlayerSummary = {
  id: number;
  firstName: EdgeLocalizedString;
  lastName: EdgeLocalizedString;
  slug?: string;
  headshot?: string;
  position?: string;
  sweaterNumber?: number;
  team?: EdgeTeamSummary;
};

export type EdgeSkaterDetailResponse = {
  player: EdgePlayerSummary;
  seasonsWithEdgeStats?: number[];
  topShotSpeed?: Record<string, unknown>;
  skatingSpeed?: Record<string, unknown>;
  totalDistanceSkated?: Record<string, unknown>;
  distanceMaxGame?: Record<string, unknown>;
  sogSummary?: Record<string, unknown>;
  sogDetails?: unknown;
  zoneTimeDetails?: unknown;
};

export type EdgeTeamDetailResponse = {
  team: EdgeTeamSummary & { id: number };
  seasonsWithEdgeStats?: number[];
  shotSpeed?: Record<string, unknown>;
  skatingSpeed?: Record<string, unknown>;
  distanceSkated?: Record<string, unknown>;
  sogSummary?: Record<string, unknown>;
  sogDetails?: unknown;
  zoneTimeDetails?: unknown;
};

export type EdgeGoalieDetailResponse = {
  player: EdgePlayerSummary;
  seasonsWithEdgeStats?: number[];
  stats?: Record<string, unknown>;
  shotLocationSummary?: Record<string, unknown>;
  shotLocationDetails?: unknown;
};

export type EdgeShotLocationSplit = {
  all?: number;
  highDanger?: number;
  midRange?: number;
  longRange?: number;
};

export type EdgeSkaterShotLocationLeaderRow = EdgeShotLocationSplit & {
  player: EdgePlayerSummary;
};

export type EdgeSkaterShotLocationSortKey =
  | "goals"
  | "sog"
  | "shooting-pctg";

export type EdgeByTheNumbersNowResponse = {
  games?: unknown;
  gameDate?: string;
  hardestShotSkater?: unknown;
  maxSkatingSpeedSkater?: unknown;
  totalDistanceSkatedSkater?: unknown;
  totalDistanceSkatedTeam?: unknown;
  totalDistanceSkatedLeague?: unknown;
};

export async function getEdgeByTheNumbersNow(): Promise<EdgeByTheNumbersNowResponse> {
  return get<EdgeByTheNumbersNowResponse>("/edge/by-the-numbers/now");
}

export async function getEdgeSkaterDetailNow(
  playerId: number
): Promise<EdgeSkaterDetailResponse> {
  return get<EdgeSkaterDetailResponse>(`/edge/skater-detail/${playerId}/now`);
}

export async function getEdgeSkaterDetail(
  playerId: number,
  seasonId: number,
  gameType: EdgeGameType = 2
): Promise<EdgeSkaterDetailResponse> {
  return get<EdgeSkaterDetailResponse>(
    `/edge/skater-detail/${playerId}/${seasonId}/${gameType}`
  );
}

export async function getEdgeTeamDetail(
  teamId: number,
  seasonId: number,
  gameType: EdgeGameType = 2
): Promise<EdgeTeamDetailResponse> {
  return get<EdgeTeamDetailResponse>(
    `/edge/team-detail/${teamId}/${seasonId}/${gameType}`
  );
}

export async function getEdgeTeamDetailNow(
  teamId: number
): Promise<EdgeTeamDetailResponse> {
  return get<EdgeTeamDetailResponse>(`/edge/team-detail/${teamId}/now`);
}

export async function getEdgeGoalieDetail(
  goalieId: number,
  seasonId: number,
  gameType: EdgeGameType = 2
): Promise<EdgeGoalieDetailResponse> {
  return get<EdgeGoalieDetailResponse>(
    `/edge/goalie-detail/${goalieId}/${seasonId}/${gameType}`
  );
}

export async function getEdgeGoalieDetailNow(
  goalieId: number
): Promise<EdgeGoalieDetailResponse> {
  return get<EdgeGoalieDetailResponse>(`/edge/goalie-detail/${goalieId}/now`);
}

export async function getEdgeSkaterShotLocationTop10(
  stat: EdgeSkaterShotLocationSortKey,
  seasonId: number,
  gameType: EdgeGameType = 2
): Promise<EdgeSkaterShotLocationLeaderRow[]> {
  return get<EdgeSkaterShotLocationLeaderRow[]>(
    `/edge/skater-shot-location-top-10/all/${stat}/all/${seasonId}/${gameType}`
  );
}

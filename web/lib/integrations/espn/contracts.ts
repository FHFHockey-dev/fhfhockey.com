export type EspnLeagueType = "points" | "categories";
export type EspnDraftOrderType = "snake" | "straight" | "unknown";
export type EspnMappingStatus = "supported" | "partial" | "unsupported";

export type EspnUnsupportedItem = {
  kind: "scoring" | "roster" | "draft";
  code: string;
  label: string;
  reason: string;
};

export type EspnDiagnostics = {
  status: EspnMappingStatus;
  warnings: string[];
  unsupported: EspnUnsupportedItem[];
};

export type EspnLeagueTeam = {
  externalTeamKey: string;
  name: string;
  abbreviation: string | null;
  divisionId: number | null;
  isOwned: boolean;
};

export type EspnRosterEntry = {
  externalPlayerId: string;
  playerName: string | null;
  position: string | null;
  proTeamId: number | null;
  lineupSlotId: number | null;
  acquisitionType: string | null;
  injuryStatus: string | null;
};

export type EspnLeagueSettingsV1 = {
  version: 1;
  mappingVersion: "espn-fhl-v1";
  externalLeagueKey: string;
  espnLeagueId: string;
  leagueName: string;
  seasonKey: string;
  leagueType: EspnLeagueType;
  scoringType: string;
  teamCount: number | null;
  teams: EspnLeagueTeam[];
  skaterScoringCategories: Record<string, number>;
  goalieScoringCategories: Record<string, number>;
  categoryWeights: Record<string, number>;
  rosterConfig: Record<string, number>;
  draftOrderType: EspnDraftOrderType;
  draftOrder: string[];
  draftType: string | null;
  liveDraftSupported: boolean;
  sourceHash: string;
  fetchedAt: string;
  diagnostics: EspnDiagnostics;
};

export type EspnNormalizedPlayer = EspnRosterEntry & {
  fhfhPlayerId?: number | null;
  nhlPlayerId?: number | null;
  mappingStatus?: "mapped" | "unmapped" | "review_required";
};

export type EspnNormalizedTeamState = EspnLeagueTeam & {
  roster: EspnNormalizedPlayer[];
  record: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    percentage: number | null;
    rank: number | null;
  };
};

export type EspnNormalizedMatchup = {
  id: string;
  matchupPeriodId: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  playoffTierType: string | null;
};

export type EspnNormalizedTransaction = {
  id: string;
  type: string;
  status: string | null;
  teamId: string | null;
  proposedDate: string | null;
  scoringPeriodId: number | null;
  bidAmount: number | null;
  items: Array<{
    type: string | null;
    externalPlayerId: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
    fromLineupSlotId: number | null;
    toLineupSlotId: number | null;
    isKeeper: boolean;
  }>;
};

export type EspnDraftPick = {
  externalPickKey: string;
  pickNumber: number;
  roundNumber: number;
  pickInRound: number;
  externalTeamKey: string;
  externalPlayerId: string;
  playerName: string | null;
  position: string | null;
  proTeamId: number | null;
  isKeeper: boolean;
  bidAmount: number | null;
  fhfhPlayerId?: number | null;
  nhlPlayerId?: number | null;
  mappingStatus?: "mapped" | "unmapped" | "review_required";
};

export type EspnLeagueStateV1 = {
  version: 1;
  externalLeagueKey: string;
  espnLeagueId: string;
  seasonKey: string;
  currentScoringPeriodId: number | null;
  currentMatchupPeriodId: number | null;
  isActive: boolean;
  teams: EspnNormalizedTeamState[];
  matchups: EspnNormalizedMatchup[];
  transactions: EspnNormalizedTransaction[];
  draft: {
    drafted: boolean;
    inProgress: boolean;
    completeDate: string | null;
    picks: EspnDraftPick[];
  };
  sectionFreshness: Record<string, string>;
  cursor: { transactionCount: number; complete: boolean };
  sourceHash: string;
  fetchedAt: string;
};

export type EspnConnectionLeague = {
  id: string;
  connectedAccountId: string;
  externalLeagueKey: string;
  espnLeagueId: string;
  name: string;
  seasonKey: string;
  importedAt: string | null;
  settings: EspnLeagueSettingsV1;
  teams: Array<EspnLeagueTeam & { id: string }>;
  isDefault: boolean;
  settingsChanged: boolean;
  syncStatus: string | null;
  syncErrorCode: string | null;
  transactionBackfillComplete?: boolean | null;
  transactionBackfillErrorCode?: string | null;
};

export type EspnConnectionAccount = {
  id: string;
  label: string;
  status: string;
  lastSyncedAt: string | null;
  leagues: EspnConnectionLeague[];
};

export type EspnConnectionsResponse = {
  apiEnabled: boolean;
  liveDraftEnabled: boolean;
  accounts: EspnConnectionAccount[];
  defaultExternalLeagueId: string | null;
  defaultExternalTeamId: string | null;
};

export type EspnDraftSessionStatus =
  | "predraft"
  | "active"
  | "stopped"
  | "complete"
  | "error"
  | "reauth_required";

export type EspnDraftState = {
  session: {
    id: string;
    externalLeagueId: string;
    externalTeamId: string | null;
    status: EspnDraftSessionStatus;
    providerStatus: "predraft" | "drafting" | "postdraft" | "unknown";
    snapshotVersion: number;
    lastSnapshotAt: string | null;
    nextPollAt: string;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
  league: EspnConnectionLeague;
  picks: EspnDraftPick[];
  poll: { claimed: boolean; retryAfterSeconds: number };
};

export const ESPN_CONSENT_VERSION = "espn-fantasy-private-beta-v1";
export const ESPN_MAPPING_VERSION = "espn-fhl-v1";

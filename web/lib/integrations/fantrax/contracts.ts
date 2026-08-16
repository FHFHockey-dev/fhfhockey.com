export type FantraxLeagueType = "points" | "categories";
export type FantraxDraftOrderType = "snake" | "straight" | "unknown";
export type FantraxMappingStatus = "supported" | "partial" | "unsupported";

export type FantraxOwnedTeam = {
  externalTeamKey: string;
  name: string;
  division: string | null;
  isOwned: boolean;
};

export type FantraxDiscoveredLeague = {
  externalLeagueKey: string;
  name: string;
  sport: string | null;
  ownedTeams: FantraxOwnedTeam[];
};

export type FantraxUnsupportedItem = {
  kind: "scoring" | "roster" | "draft";
  code: string;
  label: string;
  reason: string;
};

export type FantraxDiagnostics = {
  status: FantraxMappingStatus;
  warnings: string[];
  unsupported: FantraxUnsupportedItem[];
};

export type FantraxLeagueSettingsV1 = {
  version: 1;
  mappingVersion: "fantrax-nhl-v1";
  externalLeagueKey: string;
  leagueName: string;
  seasonKey: string | null;
  leagueType: FantraxLeagueType;
  teamCount: number | null;
  teams: FantraxOwnedTeam[];
  skaterScoringCategories: Record<string, number>;
  goalieScoringCategories: Record<string, number>;
  categoryWeights: Record<string, number>;
  rosterConfig: Record<string, number>;
  draftOrderType: FantraxDraftOrderType;
  sourceHash: string;
  fetchedAt: string;
  diagnostics: FantraxDiagnostics;
};

export type FantraxStoredRawSettings = {
  scoringSystem: unknown;
  rosterInfo: unknown;
  draftSettings: unknown;
  draftType: unknown;
  teamInfo: unknown;
};

export type FantraxConnectionLeague = {
  id: string;
  connectedAccountId: string;
  externalLeagueKey: string;
  name: string;
  seasonKey: string | null;
  importedAt: string | null;
  settings: FantraxLeagueSettingsV1;
  teams: Array<FantraxOwnedTeam & { id: string }>;
  isDefault: boolean;
  settingsChanged: boolean;
};

export type FantraxConnectionAccount = {
  id: string;
  label: string;
  status: string;
  lastSyncedAt: string | null;
  integrationModes: string[];
  leagues: FantraxConnectionLeague[];
};

export type FantraxConnectionsResponse = {
  apiEnabled: boolean;
  accounts: FantraxConnectionAccount[];
  defaultExternalLeagueId: string | null;
  defaultExternalTeamId: string | null;
};

export const FANTRAX_CONSENT_VERSION = "fantrax-settings-v1";
export const FANTRAX_MAPPING_VERSION = "fantrax-nhl-v1";

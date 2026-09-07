import type {
  ProjectionSourceConfig,
  SourceStatMapping
} from "lib/projectionsConfig/projectionSourcesConfig";
import type { SessionCsvEntry } from "./csvImportSession";

export interface CustomAdditionalProjectionSource {
  id: string;
  displayName: string;
  playerType: "skater" | "goalie";
  rows: Array<Record<string, any>>;
  primaryPlayerIdKey: string;
  originalPlayerNameKey: string;
  teamKey?: string;
  positionKey?: string;
  statMappings: SourceStatMapping[];
  resolution?: {
    totalRows: number;
    idMatched: number;
    nameMatched: number;
    fuzzyMatched?: number;
    manualOverrides?: number;
    unresolved: number;
    invalidIds?: number;
    coverage: number;
    lastUpdated: number;
    unresolvedNames: string[];
  };
}

export function buildCustomProjectionSources(
  entries: readonly SessionCsvEntry[],
  playerType: "skater" | "goalie",
  statMappings: SourceStatMapping[],
): CustomAdditionalProjectionSource[] {
  return entries.flatMap((entry) => {
    const rows = (entry.rows || []).filter((row) => {
      const positions = String(row.Position || "")
        .toUpperCase()
        .split(",")
        .map((position) => position.trim());
      return playerType === "goalie" ? positions.includes("G") : !positions.includes("G");
    });
    if (!rows.length) return [];
    return [{
      id: entry.id,
      displayName: entry.label || entry.id,
      playerType,
      rows,
      primaryPlayerIdKey: "player_id",
      originalPlayerNameKey: "Player_Name",
      teamKey: "Team_Abbreviation",
      positionKey: "Position",
      statMappings,
      resolution: entry.resolution,
    }];
  });
}

export function buildActiveProjectionSources({
  baseSources,
  playerType,
  sourceControls,
  customSources = []
}: {
  baseSources: ProjectionSourceConfig[];
  playerType: "skater" | "goalie";
  sourceControls: Record<string, { isSelected: boolean; weight: number }>;
  customSources?: CustomAdditionalProjectionSource[];
}) {
  const activeSources = baseSources.filter(
    (source) =>
      source.playerType === playerType && sourceControls[source.id]?.isSelected
  );
  const customById = new Map<string, CustomAdditionalProjectionSource>();

  for (const source of customSources) {
    if (!source.id.startsWith("custom_csv")) continue;
    customById.set(source.id, source);
  }

  for (const source of customById.values()) {
    if (
      source.playerType !== playerType ||
      !sourceControls[source.id]?.isSelected
    ) {
      continue;
    }
    activeSources.push({
      id: source.id,
      displayName: source.displayName,
      tableName: "__custom_session__",
      playerType: source.playerType,
      primaryPlayerIdKey: source.primaryPlayerIdKey,
      originalPlayerNameKey: source.originalPlayerNameKey,
      teamKey: source.teamKey,
      positionKey: source.positionKey,
      statMappings: source.statMappings
    });
  }

  return { activeSources, customById };
}

export function buildProjectionInputCacheKey({
  playerType,
  activeSources,
  season,
  customFingerprint,
  refreshKey
}: {
  playerType: "skater" | "goalie";
  activeSources: ProjectionSourceConfig[];
  season?: string;
  customFingerprint: string;
  refreshKey?: number | string;
}) {
  return JSON.stringify({
    playerType,
    sourceIds: activeSources.map((source) => source.id).sort(),
    season: season || "",
    custom: customFingerprint,
    refreshKey: refreshKey ?? ""
  });
}

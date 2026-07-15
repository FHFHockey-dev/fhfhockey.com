import type {
  ProjectionSourceConfig,
  SourceStatMapping
} from "lib/projectionsConfig/projectionSourcesConfig";

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

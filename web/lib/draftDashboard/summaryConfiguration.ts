import type { ForwardGrouping } from "./forwardGrouping";
import type { SessionCsvEntry } from "./csvImportSession";

type SourceControl = { isSelected: boolean; weight: number };

type ProjectionSourceDescriptor = {
  id: string;
  displayName: string;
  playerType: "skater" | "goalie";
};

export type DraftConfigurationSource = {
  id: string;
  label: string;
  playerType: "skater" | "goalie";
  enabled: boolean;
  weight: number;
  custom: boolean;
};

export type DraftCustomSourceMetadata = {
  id: string;
  label: string;
  totalRows?: number;
  coverage?: number;
};

export type DraftConfigurationSummary = {
  forwardGrouping: ForwardGrouping;
  baselineMode: "remaining" | "full";
  personalizeReplacement: boolean;
  needWeightEnabled: boolean;
  needAlpha: number;
  sources: DraftConfigurationSource[];
  customSources: DraftCustomSourceMetadata[];
};

export function toCustomSourceMetadata(
  entries: SessionCsvEntry[],
): DraftCustomSourceMetadata[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    totalRows: entry.resolution?.totalRows,
    coverage: entry.resolution?.coverage,
  }));
}

export function buildDraftConfigurationSummary({
  projectionSources,
  sourceControls,
  goalieSourceControls,
  customCsvEntries,
  forwardGrouping,
  baselineMode,
  personalizeReplacement,
  needWeightEnabled,
  needAlpha,
}: {
  projectionSources: ProjectionSourceDescriptor[];
  sourceControls: Record<string, SourceControl>;
  goalieSourceControls: Record<string, SourceControl>;
  customCsvEntries: SessionCsvEntry[];
  forwardGrouping: ForwardGrouping;
  baselineMode: "remaining" | "full";
  personalizeReplacement: boolean;
  needWeightEnabled: boolean;
  needAlpha: number;
}): DraftConfigurationSummary {
  const customSources = toCustomSourceMetadata(customCsvEntries);
  const officialSources = projectionSources.map((source) => {
    const control =
      source.playerType === "goalie"
        ? goalieSourceControls[source.id]
        : sourceControls[source.id];
    return {
      id: source.id,
      label: source.displayName,
      playerType: source.playerType,
      enabled: control?.isSelected ?? false,
      weight: control?.weight ?? 0,
      custom: false,
    } satisfies DraftConfigurationSource;
  });
  const customControls = customSources.flatMap((source) => {
    const skater = sourceControls[source.id];
    const goalie = goalieSourceControls[source.id];
    return [
      ...(skater
        ? [
            {
              id: source.id,
              label: source.label,
              playerType: "skater" as const,
              enabled: skater.isSelected,
              weight: skater.weight,
              custom: true,
            },
          ]
        : []),
      ...(goalie
        ? [
            {
              id: source.id,
              label: source.label,
              playerType: "goalie" as const,
              enabled: goalie.isSelected,
              weight: goalie.weight,
              custom: true,
            },
          ]
        : []),
    ];
  });

  return {
    forwardGrouping,
    baselineMode,
    personalizeReplacement,
    needWeightEnabled,
    needAlpha,
    sources: [...officialSources, ...customControls],
    customSources,
  };
}

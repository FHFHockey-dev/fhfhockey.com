import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";

export type ProjectionIdentityIssue = {
  sourceId: string;
  name: string | null;
  rawId: unknown;
};

export type ProjectionInclusionDiagnostics = {
  rawRows: number;
  validIdRows: number;
  invalidIdRows: number;
  uniqueSourcePlayerIds: number;
  duplicateIdRows: number;
  processedPlayers: number;
  sourceIdsMissingFromProcessed: number;
  missingProcessedIdSamples: number[];
  invalidIdentitySamples: ProjectionIdentityIssue[];
  bySource: Record<
    string,
    {
      rawRows: number;
      validIdRows: number;
      invalidIdRows: number;
      uniquePlayerIds: number;
      duplicateIdRows: number;
    }
  >;
};

export function buildProjectionInclusionDiagnostics(
  activeSources: ProjectionSourceConfig[],
  rawBySource: Record<
    string,
    { data: Array<Record<string, unknown>>; config: ProjectionSourceConfig }
  >,
  processedPlayerIds: Iterable<string | number>,
  sampleLimit = 25
): ProjectionInclusionDiagnostics {
  const allIds = new Set<number>();
  const invalidIdentitySamples: ProjectionIdentityIssue[] = [];
  const bySource: ProjectionInclusionDiagnostics["bySource"] = {};
  let rawRows = 0;
  let validIdRows = 0;
  let invalidIdRows = 0;
  let duplicateIdRows = 0;

  for (const source of activeSources) {
    const rows = rawBySource[source.id]?.data ?? [];
    const sourceIds = new Set<number>();
    let sourceValid = 0;
    let sourceInvalid = 0;
    let sourceDuplicates = 0;
    for (const row of rows) {
      const rawId = row[source.primaryPlayerIdKey];
      const playerId = Number(rawId);
      if (
        rawId === null ||
        rawId === undefined ||
        rawId === "" ||
        !Number.isInteger(playerId) ||
        playerId <= 0
      ) {
        sourceInvalid += 1;
        if (invalidIdentitySamples.length < sampleLimit) {
          const rawName = row[source.originalPlayerNameKey];
          invalidIdentitySamples.push({
            sourceId: source.id,
            name:
              typeof rawName === "string" && rawName.trim()
                ? rawName.trim()
                : null,
            rawId
          });
        }
        continue;
      }
      sourceValid += 1;
      if (sourceIds.has(playerId)) sourceDuplicates += 1;
      sourceIds.add(playerId);
      allIds.add(playerId);
    }
    rawRows += rows.length;
    validIdRows += sourceValid;
    invalidIdRows += sourceInvalid;
    duplicateIdRows += sourceDuplicates;
    bySource[source.id] = {
      rawRows: rows.length,
      validIdRows: sourceValid,
      invalidIdRows: sourceInvalid,
      uniquePlayerIds: sourceIds.size,
      duplicateIdRows: sourceDuplicates
    };
  }

  const processedIds = new Set(
    Array.from(processedPlayerIds, (playerId) => Number(playerId)).filter(
      (playerId) => Number.isInteger(playerId) && playerId > 0
    )
  );
  const missingProcessedIds = Array.from(allIds)
    .filter((playerId) => !processedIds.has(playerId))
    .sort((left, right) => left - right);

  return {
    rawRows,
    validIdRows,
    invalidIdRows,
    uniqueSourcePlayerIds: allIds.size,
    duplicateIdRows,
    processedPlayers: processedIds.size,
    sourceIdsMissingFromProcessed: missingProcessedIds.length,
    missingProcessedIdSamples: missingProcessedIds.slice(0, sampleLimit),
    invalidIdentitySamples,
    bySource
  };
}

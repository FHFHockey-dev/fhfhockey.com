export type NhlRawGamecenterIngestTelemetry = {
  rosterCount: number;
  eventCount: number;
  shiftCount: number;
  rawEndpointsStored: number;
  idempotent: boolean;
};

export function summarizeNhlRawGamecenterIngestResults(
  results: readonly NhlRawGamecenterIngestTelemetry[],
) {
  return results.reduce(
    (summary, result) => {
      const normalizedRows =
        result.rosterCount + result.eventCount + result.shiftCount;
      summary.rowsVerified += normalizedRows + result.rawEndpointsStored;
      if (result.idempotent === false) {
        summary.rowsUpserted += normalizedRows;
      }
      return summary;
    },
    { rowsUpserted: 0, rowsVerified: 0 },
  );
}

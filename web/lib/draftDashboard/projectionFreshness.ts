type CustomSourceFreshness = {
  label: string;
  resolution?: { lastUpdated?: number };
};

export function buildProjectionFreshnessNotices({
  hasLoadedPlayers,
  hasOfficialSources,
  refreshFailed,
  customSources,
  formatTimestamp = (value: number) => new Date(value).toLocaleString(),
}: {
  hasLoadedPlayers: boolean;
  hasOfficialSources: boolean;
  refreshFailed: boolean;
  customSources: CustomSourceFreshness[];
  formatTimestamp?: (value: number) => string;
}) {
  const notices: string[] = [];
  if (hasLoadedPlayers && hasOfficialSources) {
    notices.push(
      refreshFailed
        ? "Previously loaded official projections may be stale because the latest refresh failed; provider update timestamps are not exposed by this dashboard."
        : "Official projection provider update timestamps are not exposed by this dashboard; upstream ingestion owns provider freshness.",
    );
  }

  for (const source of customSources) {
    const timestamp = source.resolution?.lastUpdated;
    notices.push(
      typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0
        ? `Custom source ${source.label} was imported into this tab at ${formatTimestamp(timestamp)}.`
        : `Custom source ${source.label} has no verified import timestamp; freshness is unknown.`,
    );
  }
  return notices;
}

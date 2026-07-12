export type NstTeamStatsSkip = {
  scope: "date" | "season";
  table: string;
  reason: "empty_source";
  date?: string;
  season?: number;
};

export function buildNstTeamStatsDiagnostics(args: {
  failures: string[];
  skips: NstTeamStatsSkip[];
  deferredDates: string[];
}) {
  return {
    failedRows: 0,
    failedRequests: args.failures.length,
    failures: args.failures.slice(0, 10).map((reason) => ({ reason })),
    skippedRequests: args.skips.length,
    skips: args.skips.slice(0, 10),
    deferredDatesCount: args.deferredDates.length,
    deferredDates: args.deferredDates,
  };
}

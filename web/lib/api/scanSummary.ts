export type EndpointScanSummaryStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "empty";

export type EndpointScanSummary = {
  surface: string;
  requestedDate: string | null;
  activeDataDate: string | null;
  fallbackApplied: boolean;
  status: EndpointScanSummaryStatus;
  rowCounts: Record<string, number | null>;
  blockingIssueCount: number;
  notes: string[];
};

export function buildEndpointScanSummary(args: {
  surface: string;
  requestedDate?: string | null;
  activeDataDate?: string | null;
  fallbackApplied?: boolean | null;
  status: EndpointScanSummaryStatus;
  rowCounts?: Record<string, unknown>;
  blockingIssueCount?: number | null;
  notes?: Array<string | null | undefined>;
}): EndpointScanSummary {
  const rowCounts = Object.fromEntries(
    Object.entries(args.rowCounts ?? {}).map(([key, value]) => {
      const numericValue = Number(value);
      return [key, Number.isFinite(numericValue) ? numericValue : null];
    })
  );

  return {
    surface: args.surface,
    requestedDate: args.requestedDate ?? null,
    activeDataDate: args.activeDataDate ?? null,
    fallbackApplied: Boolean(args.fallbackApplied),
    status: args.status,
    rowCounts,
    blockingIssueCount: Math.max(0, Number(args.blockingIssueCount ?? 0) || 0),
    notes: (args.notes ?? []).filter(
      (note): note is string => typeof note === "string" && note.trim().length > 0
    )
  };
}

export function countFailingPreflightGates(preflight: {
  gates?: Array<{ status?: string | null }> | null;
} | null | undefined): number {
  return (preflight?.gates ?? []).filter((gate) => gate?.status === "FAIL").length;
}

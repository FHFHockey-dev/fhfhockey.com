import { projectionInputHash } from "./inputCapture";

export type BoardOperationalEvent = {
  eventId: string; newsKey: string | null; changeKey: string | null; gameId: number; slateDate: string; gameType: number | null; queueVersion: number;
  categories: string[]; sourcePublishedAt: string | null; receivedAt: string | null; acceptedAt: string;
  firstDispatchedAt: string | null; successfulDispatchAt: string | null;
  revisionId: string | null; runId: string | null; inputCutoff: string | null;
  calculationStartedAt: string | null; calculationCompletedAt: string | null; publishedAt: string | null;
  browserRenderedAt: string | null; visibilityReceivedAt: string | null;
};
const TARGET_MS = 300_000;
const categories = ["pp", "availability", "goalie", "ev", "review", "unknown"] as const;
function timestamp(value: string | null) {
  if (value === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error("Operational timestamps require a timezone");
  return parsed;
}
function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (fraction: number) => sorted.length ? sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] : null;
  return { samples: sorted.length, p50: quantile(0.5), p95: quantile(0.95), p99: quantile(0.99) };
}

/** Private, reproducible reporting; missing deliveries stay in the denominator. */
export function buildStarterBoardOperationsReport(args: {
  events: BoardOperationalEvent[]; from: string; until: string; asOf: string;
}) {
  const from = timestamp(args.from)!, until = timestamp(args.until)!, asOf = timestamp(args.asOf)!;
  if (from >= until || until > asOf || until - from > 31 * 86_400_000 || args.events.length > 10000) throw new Error("Invalid operational window");
  const seen = new Set<string>();
  const newsSeen = new Map<string, string>();
  const events = [...args.events].sort((a, b) => Date.parse(a.acceptedAt) - Date.parse(b.acceptedAt) || a.eventId.localeCompare(b.eventId)).map((row) => {
    if (seen.has(row.eventId)) throw new Error("Duplicate operational event");
    seen.add(row.eventId);
    const duplicateOf = row.changeKey ? newsSeen.get(row.changeKey) ?? null : null;
    if (row.changeKey && !duplicateOf) newsSeen.set(row.changeKey, row.eventId);
    const accepted = timestamp(row.acceptedAt)!;
    if (accepted < from || accepted >= until) throw new Error("Event outside declared operational window");
    const published = timestamp(row.publishedAt), visible = timestamp(row.visibilityReceivedAt);
    const started = timestamp(row.calculationStartedAt), completed = timestamp(row.calculationCompletedAt);
    const cutoff = timestamp(row.inputCutoff), dispatched = timestamp(row.successfulDispatchAt);
    const firstDispatch = timestamp(row.firstDispatchedAt), received = timestamp(row.receivedAt), source = timestamp(row.sourcePublishedAt);
    const issues: string[] = [];
    if (visible != null && (published == null || visible < published || visible > asOf)) issues.push("invalid_visibility_sequence");
    if (published != null && (cutoff == null || cutoff < accepted || published < cutoff || published > asOf)) issues.push("invalid_publication_sequence");
    if (firstDispatch != null && (firstDispatch < accepted || firstDispatch > asOf)) issues.push("invalid_first_dispatch");
    if (published != null && (dispatched == null || started == null || completed == null)) issues.push("missing_calculation_timing");
    if (dispatched != null && (dispatched < accepted || dispatched > asOf || (started != null && started < dispatched))) issues.push("invalid_dispatch_sequence");
    if (completed != null && (started == null || completed < started || (published != null && completed > published))) issues.push("invalid_calculation_sequence");
    if (received != null && received > accepted) issues.push("receipt_after_acceptance");
    // Provider clocks can be wrong; keep that delay unknown without fabricating it.
    const providerDelayMs = received != null && source != null && received >= source ? received - source : null;
    const latencyMs = visible != null && visible >= accepted ? visible - accepted : null;
    const expired = asOf - accepted >= TARGET_MS;
    const status = issues.length ? "invalid_timing" : visible != null
      ? latencyMs! <= TARGET_MS ? "delivered_on_time" : "delivered_late"
      : expired ? "overdue_no_visibility" : "pending";
    return { ...row, duplicateOf, categories: [...new Set(row.categories.map((kind) => categories.includes(kind as any) ? kind : "unknown"))].sort(),
      status, timingIssues: issues, providerDelayMs, acceptanceToVisibleUpperBoundMs: latencyMs,
      acceptanceToFirstDispatchMs: firstDispatch == null ? null : firstDispatch - accepted,
      receiptToAcceptanceMs: received == null || received > accepted ? null : accepted - received,
      calculationMs: started == null || completed == null || completed < started ? null : completed - started,
      publicationToVisibleUpperBoundMs: published == null || visible == null || visible < published ? null : visible - published,
    };
  });
  const summarize = (rows: typeof events) => {
    const unique = rows.filter((row) => !row.duplicateOf);
    const count = (status: string) => unique.filter((row) => row.status === status).length;
    const eligible = unique.filter((row) => row.status !== "pending");
    const independent = eligible.filter((row) => row.newsKey != null && row.changeKey != null);
    const onTime = count("delivered_on_time");
    const byCategory = Object.fromEntries(categories.map((kind) => [kind, unique.filter((row) => row.categories.includes(kind)).length]));
    const values = (key: "acceptanceToVisibleUpperBoundMs" | "providerDelayMs" | "acceptanceToFirstDispatchMs" | "calculationMs" | "publicationToVisibleUpperBoundMs") =>
      unique.filter((row) => row.status !== "invalid_timing").flatMap((row) => row[key] == null ? [] : [row[key]!]);
    return {
      acceptedEvents: rows.length, evaluatedEvents: eligible.length, pendingEvents: count("pending"),
      uniqueNewsEvents: unique.length, repostEvents: rows.length - unique.length,
      unknownNewsIdentityEvents: unique.filter((row) => !row.newsKey || !row.changeKey).length,
      onTimeEvents: onTime, lateEvents: count("delivered_late"), unobservedOverdueEvents: count("overdue_no_visibility"),
      invalidTimingEvents: count("invalid_timing"), onTimeShare: eligible.length ? onTime / eligible.length : null,
      games: new Set(rows.map((row) => row.gameId)).size, byCategory,
      acceptanceToVisibleUpperBoundMs: percentiles(values("acceptanceToVisibleUpperBoundMs")),
      providerDelayMs: percentiles(values("providerDelayMs")), firstDispatchMs: percentiles(values("acceptanceToFirstDispatchMs")),
      calculationMs: percentiles(values("calculationMs")), publicationToVisibleUpperBoundMs: percentiles(values("publicationToVisibleUpperBoundMs")),
      unknownProviderDelayEvents: unique.filter((row) => row.providerDelayMs == null).length,
      independentReports: new Set(independent.map((row) => row.newsKey)).size,
      sampleGateMet: new Set(independent.map((row) => row.newsKey)).size >= 100 && ["pp", "availability", "goalie"].every((kind) =>
        independent.some((row) => row.categories.includes(kind))),
      measuredTargetMet: eligible.length > 0 && onTime / eligible.length >= 0.95 && count("invalid_timing") === 0,
    };
  };
  const cohorts = { regularSeason: summarize(events.filter((row) => row.gameType === 2)),
    preseason: summarize(events.filter((row) => row.gameType === 1)), other: summarize(events.filter((row) => ![1, 2].includes(row.gameType ?? 0))) };
  return {
    version: "starter-board-operations-v1", window: { from: args.from, until: args.until, asOf: args.asOf },
    inputHash: projectionInputHash([...args.events].sort((a, b) => a.eventId.localeCompare(b.eventId))),
    targetMs: TARGET_MS, targetShare: 0.95, percentileMethod: "nearest_rank",
    latencyBasis: "server_visibility_receipt_upper_bound", cohorts,
    reviewStatus: cohorts.regularSeason.sampleGateMet && cohorts.regularSeason.pendingEvents === 0 && cohorts.regularSeason.unknownNewsIdentityEvents === 0
      ? cohorts.regularSeason.measuredTargetMet ? "operational_target_met_for_window" : "operational_target_not_met_for_window"
      : "insufficient_operational_evidence",
    breaches: events.filter((row) => !row.duplicateOf && ["delivered_late", "overdue_no_visibility", "invalid_timing"].includes(row.status)),
    events,
    limitations: ["This selected acceptance window does not establish a validation start date or complete either milestone review.",
      "Render timestamps use the probe clock; SLO calculations use conservative server receipt times.",
      "Percentiles describe observed valid deliveries; overdue unobserved events remain failures in the on-time share.",
      "Identical repost assertions count once from first acceptance; changed assertions remain separate. The sample gate counts distinct original reports, and unknown source identity keeps evidence insufficient.",
      "Categories can overlap within one event. Preseason evidence never satisfies the regular-season sample gate."],
  };
}

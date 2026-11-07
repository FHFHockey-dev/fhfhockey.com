/**
 * True when a queue processor's summary says it loaded no events and wrote
 * nothing: a successful empty poll. Gate states (`mode`) keep their receipts.
 */
export function isEmptyQueueProcessorRun(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, any>;
  const summary = record.summary;
  if (record.success !== true || record.mode != null || !summary || typeof summary !== "object") return false;
  const zero = (value: unknown) => value === 0;
  const lineSync = summary.lineCombinationSync;
  return zero(summary.eventsLoaded) && zero(summary.eventsProcessed) &&
    (summary.rowsUpserted == null || zero(summary.rowsUpserted)) &&
    (summary.eventsRejected == null || zero(summary.eventsRejected)) &&
    (summary.eventsDeferred == null || zero(summary.eventsDeferred)) &&
    (lineSync == null || (zero(lineSync.written) && (lineSync.failures?.length ?? 0) === 0));
}

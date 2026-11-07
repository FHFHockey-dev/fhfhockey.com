// Request validation for the x-timeline-ingest edge function (layer 3 of the X intake safety net). Pure and
// import-free, so web/ Vitest can test it; the caller passes the tracked source keys (POLLED_ACCOUNTS).

export const MAX_INGEST_TWEETS = 100;

export type IngestRequest =
  | { mode: "health" }
  | { mode: "ingest"; sourceKey: string; tweets: unknown[] };

/** The parsed request, or an error naming what is wrong. Only the tracked accounts' source keys are accepted. */
export function parseIngestRequest(raw: string, sourceKeys: string[]): IngestRequest | { error: string } {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: "Body must be JSON" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be an object" };
  const record = body as Record<string, unknown>;
  if (record.mode === "health") return { mode: "health" };
  if (record.mode !== "ingest") return { error: "mode must be health or ingest" };
  const sourceKey = record.sourceKey;
  if (typeof sourceKey !== "string" || !sourceKeys.includes(sourceKey)) return { error: "Unknown sourceKey" };
  if (!Array.isArray(record.tweets)) return { error: "tweets must be an array" };
  if (record.tweets.length > MAX_INGEST_TWEETS) return { error: `At most ${MAX_INGEST_TWEETS} tweets per request` };
  return { mode: "ingest", sourceKey, tweets: record.tweets };
}

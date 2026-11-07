// Request validation for the x-timeline-ingest edge function (layer 3 of the X intake safety net). Pure and
// import-free, so web/ Vitest can test it; the caller passes the tracked source keys (POLLED_ACCOUNTS).

export const MAX_INGEST_TWEETS = 100;

export type IngestRequest =
  | { mode: "health" }
  | { mode: "anchors" }
  | { mode: "ingest"; sourceKey: string; tweets: unknown[] }
  | { mode: "observe"; sourceKey: string; tweets: unknown[]; runId: string };

/**
 * The parsed request, or an error naming what is wrong. Only the tracked accounts' source keys are accepted.
 *   health   which accounts are due for a live takeover (x_timeline_account_health)
 *   anchors  per account, the newest timeline id already observed, so the job pages back to an overlap with it
 *   observe  shadow mode: store the mapped posts in x_timeline_twscrape_observations only
 *   ingest   live mode: store in x_timeline_shadow_posts and queue (refused unless the function enables it)
 */
export function parseIngestRequest(raw: string, sourceKeys: string[]): IngestRequest | { error: string } {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: "Body must be JSON" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be an object" };
  const record = body as Record<string, unknown>;
  if (record.mode === "health" || record.mode === "anchors") return { mode: record.mode };
  if (record.mode !== "ingest" && record.mode !== "observe") return { error: "mode must be health, anchors, observe or ingest" };
  const sourceKey = record.sourceKey;
  if (typeof sourceKey !== "string" || !sourceKeys.includes(sourceKey)) return { error: "Unknown sourceKey" };
  if (!Array.isArray(record.tweets)) return { error: "tweets must be an array" };
  if (record.tweets.length > MAX_INGEST_TWEETS) return { error: `At most ${MAX_INGEST_TWEETS} tweets per request` };
  if (record.mode === "ingest") return { mode: "ingest", sourceKey, tweets: record.tweets };
  const runId = record.runId;
  if (typeof runId !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(runId)) return { error: "runId must be a short id" };
  return { mode: "observe", sourceKey, tweets: record.tweets, runId };
}

/** The newest of a set of X ids (snowflakes, compared as integers); null when there are none. */
export function newestId(ids: Array<string | null | undefined>): string | null {
  let best: bigint | null = null;
  for (const id of ids) {
    if (typeof id !== "string" || !/^\d{1,25}$/.test(id)) continue;
    const value = BigInt(id);
    if (best === null || value > best) best = value;
  }
  return best === null ? null : best.toString();
}

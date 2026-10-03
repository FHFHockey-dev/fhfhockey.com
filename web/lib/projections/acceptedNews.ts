import type { SupabaseClient } from "@supabase/supabase-js";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";

/** Preserve PostgreSQL sub-millisecond ordering when comparing issuance cutoffs. */
function timestampMicros(value: string): bigint | null {
  const match = typeof value === "string" && value.match(/T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/);
  const milliseconds = Date.parse(value);
  return match && Number.isFinite(milliseconds)
    ? BigInt(milliseconds) * BigInt(1000) + BigInt((match[1] ?? "").slice(3).padEnd(3, "0")) : null;
}

export function acceptedNewsSupersedes(acceptedAt: string, inputCutoff: string): boolean {
  const accepted = timestampMicros(acceptedAt), cutoff = timestampMicros(inputCutoff);
  return accepted === null || cutoff === null || accepted > cutoff;
}

/** Read immutable accepted-event receipts only; never enqueue or dispatch work. */
export async function loadAcceptedForecastNews(db: SupabaseClient<any>, gameIds: number[], asOf: string,
  deadlineMs = Date.now() + 2000): Promise<{ latestAcceptedAt: Map<number, string>; revisionHash: string }> {
  const ids = [...new Set(gameIds)].sort((a, b) => a - b);
  const cutoff = timestampMicros(asOf);
  if (cutoff === null || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Invalid accepted-news scope");
  }
  const receipts: Array<{ id: string; game_id: number; queue_version: number; accepted_at: string }> = [];
  const latestAcceptedAt = new Map<number, string>();
  const seen = new Set<string>();
  for (let start = 0; start < ids.length; start += 100) {
    const scope = ids.slice(start, start + 100);
    let read = 0, total: number | null = null;
    do {
      const remaining = deadlineMs - Date.now();
      if (remaining <= 0) throw new Error("Accepted-news read exceeded its deadline");
      const response = await db.from("forge_board_news_events")
        .select("id,game_id,queue_version,accepted_at", { count: "exact" })
        .in("game_id", scope).lte("accepted_at", asOf)
        .order("game_id").order("accepted_at").order("id")
        .range(read, read + 499).abortSignal(AbortSignal.timeout(Math.ceil(remaining)));
      if (response.error || !Array.isArray(response.data) || !Number.isSafeInteger(response.count)
        || response.count! < 0 || receipts.length - read + response.count! > 5000 || total !== null && response.count !== total
        || response.data.length > response.count! - read || !response.data.length && response.count! > read) {
        throw new Error("Accepted-news read is incomplete");
      }
      total = response.count!;
      for (const row of response.data) {
        const accepted = timestampMicros(row.accepted_at);
        if (typeof row.id !== "string" || !row.id || seen.has(row.id) || !scope.includes(row.game_id)
          || !Number.isSafeInteger(row.queue_version) || row.queue_version <= 0 || accepted === null || accepted > cutoff) {
          throw new Error("Accepted-news receipt is invalid");
        }
        seen.add(row.id);
        receipts.push({ id: row.id, game_id: row.game_id, queue_version: row.queue_version, accepted_at: row.accepted_at });
        const previous = latestAcceptedAt.get(row.game_id);
        if (!previous || acceptedNewsSupersedes(row.accepted_at, previous)) latestAcceptedAt.set(row.game_id, row.accepted_at);
      }
      read += response.data.length;
    } while (read < total);
  }
  return { latestAcceptedAt, revisionHash: playerForecastSourcePayloadHash(receipts) };
}

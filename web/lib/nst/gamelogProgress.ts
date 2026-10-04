export const NST_GAMELOG_PROGRESS_VERSION = 1;
export const NST_GAMELOG_BOOKMARK_TTL_MS = 72 * 60 * 60 * 1000;

export type NstGamelogItem = {
  seasonId: string;
  date: string;
  datasetType: string;
};

export type NstGamelogOutcome =
  | "rows_persisted"
  | "already_present"
  | "empty_unverified"
  | "unavailable"
  | "parse_or_identity_unresolved"
  | "fetch_or_write_failed";

export type NstGamelogBookmark = {
  version: number;
  scope: string;
  runId: string;
  next: NstGamelogItem;
};

export type NstGamelogAuditRow = {
  run_time: string;
  details?: { nstProgress?: { bookmark?: NstGamelogBookmark } };
};

export function buildNstGamelogScope(args: {
  seasonId: string;
  seasonStartDate: string;
  datasets: readonly string[];
  overwrite: boolean;
}): string {
  return JSON.stringify({
    version: NST_GAMELOG_PROGRESS_VERSION,
    seasonId: args.seasonId,
    seasonStartDate: args.seasonStartDate,
    datasets: [...args.datasets].sort(),
    overwrite: args.overwrite
  });
}

export function resolveNstGamelogBookmark(args: {
  rows: readonly NstGamelogAuditRow[];
  scope: string;
  now: number;
  readFailed?: boolean;
}): { bookmark: NstGamelogBookmark | null; state: string } {
  if (args.readFailed) return { bookmark: null, state: "read_unconfirmed" };
  const row = args.rows[0];
  if (!row) return { bookmark: null, state: "missing_or_retained_out" };
  const writtenAt = Date.parse(row.run_time);
  if (!Number.isFinite(writtenAt) || writtenAt > args.now || args.now - writtenAt > NST_GAMELOG_BOOKMARK_TTL_MS) {
    return { bookmark: null, state: "expired_or_invalid_time" };
  }
  if (args.rows[1]?.run_time === row.run_time) {
    return { bookmark: null, state: "ambiguous_concurrent_records" };
  }
  const bookmark = row.details?.nstProgress?.bookmark;
  if (!bookmark || bookmark.version !== NST_GAMELOG_PROGRESS_VERSION || bookmark.scope !== args.scope ||
    typeof bookmark.runId !== "string" || !bookmark.runId ||
    typeof bookmark.next?.seasonId !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(bookmark.next?.date ?? "") ||
    typeof bookmark.next?.datasetType !== "string") {
    return { bookmark: null, state: "invalid_or_changed_scope" };
  }
  return { bookmark, state: "resumed" };
}

export function rotateNstGamelogQueue<T extends NstGamelogItem>(
  queue: readonly T[], bookmark: NstGamelogBookmark | null
): { queue: T[]; matched: boolean } {
  if (!bookmark) return { queue: [...queue], matched: false };
  const index = queue.findIndex((item) => item.seasonId === bookmark.next.seasonId &&
    item.date === bookmark.next.date && item.datasetType === bookmark.next.datasetType);
  if (index < 0) return { queue: [...queue], matched: false };
  return { queue: [...queue.slice(index), ...queue.slice(0, index)], matched: true };
}

export function summarizeNstGamelogOutcomes(
  outcomes: ReadonlyMap<string, { item: NstGamelogItem; outcome: NstGamelogOutcome }>
) {
  const counts: Record<NstGamelogOutcome, number> = {
    rows_persisted: 0, already_present: 0, empty_unverified: 0,
    unavailable: 0, parse_or_identity_unresolved: 0, fetch_or_write_failed: 0
  };
  const unresolved: Array<{ item: NstGamelogItem; outcome: NstGamelogOutcome }> = [];
  for (const result of outcomes.values()) {
    counts[result.outcome]++;
    if (result.outcome !== "rows_persisted" && result.outcome !== "already_present") unresolved.push(result);
  }
  return { counts, unresolvedCount: unresolved.length, unresolved: unresolved.slice(0, 10), coverage: "not_verified" as const };
}

export function nstGamelogItemKey(item: NstGamelogItem): string {
  return `${item.seasonId}/${item.date}/${item.datasetType}`;
}

export function nstGamelogItemIdentity(item: NstGamelogItem): NstGamelogItem {
  return { seasonId: item.seasonId, date: item.date, datasetType: item.datasetType };
}

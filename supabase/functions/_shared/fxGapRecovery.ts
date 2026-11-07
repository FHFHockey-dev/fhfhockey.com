// Gap recovery for the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md §2.2). With IFTTT
// retired, a post is lost if an outage outlasts the 20-post page. After a good read whose page holds no stored post,
// older pages are fetched through cursor.bottom until one holds a stored post, at most GAP_MAX_EXTRA_PAGES.
// Import-free (Deno needs .ts import paths, web's tsc rejects them), so web/ Vitest can test it; the caller passes the
// poller's mapper (mapFxProfileFeed) as mapPage.

export const GAP_MAX_EXTRA_PAGES = 4;

/** The fields of a shadow row (x-timeline-poll/fxtwitter.ts ShadowPostRow) that gap recovery reads. */
export type GapRow = { tweet_id: string; raw_payload: Record<string, unknown> };

export type GapState =
  | "none" //        the page reaches posts already stored: nothing missed
  | "recovered" //   older pages were read back to a stored post
  | "unrecovered" // GAP_MAX_EXTRA_PAGES read (or no cursor to go further): the oldest missed posts are lost
  | "abandoned" //   an older page or lookup failed, or this run's page budget ran out: what was read is stored now
  //                 (fresh posts are never held back), and the older missed posts may be lost
  | "skipped"; //    the stored-post lookup failed, or the account has no stored posts yet

/** The `cursor.bottom` of a feed page, for the next (older) page; null when there is none. */
export function nextPageCursor(body: unknown): string | null {
  const bottom = (body as { cursor?: { bottom?: unknown } })?.cursor?.bottom;
  return typeof bottom === "string" && bottom.length > 0 && bottom.length < 512 ? bottom : null;
}

/** Ids that identify a row as already stored: its own id, and for a hydrated wrapper repost the wrapper's id. */
export function rowKeys(row: GapRow): string[] {
  const wrapper = row.raw_payload?.repost_wrapper_id;
  return typeof wrapper === "string" ? [row.tweet_id, wrapper] : [row.tweet_id];
}

/**
 * True when the page holds no stored post below its first row (the first may be a pinned old post, which is stored but
 * says nothing about the gap). A page of one row, or an empty page, never asks for more.
 */
export function pageReachesNoStoredPost(rows: GapRow[], stored: Set<string>): boolean {
  if (rows.length < 2) return false;
  return !rows.slice(1).some((row) => rowKeys(row).some((key) => stored.has(key)));
}

export type GapRecoveryInput<R extends GapRow> = {
  firstBody: unknown;
  firstRows: R[];
  /** One feed page as rows: mapFxProfileFeed(account, body). */
  mapPage: (body: unknown) => R[];
  /** Which of these ids are stored for the account, and whether it has any stored post. Null when the lookup failed. */
  lookupStored: (ids: string[]) => Promise<{ stored: Set<string>; hasHistory: boolean } | null>;
  /** One older page by cursor; null when it could not be read. */
  fetchPage: (cursor: string) => Promise<unknown | null>;
  /** Older pages this run may still read (the caller's share of the run budget); past it the gap is abandoned. */
  pageBudget?: number;
};

export type GapRecoveryResult<R extends GapRow> = { rows: R[]; state: GapState; extraPages: number };

/**
 * The rows to store: the first page's rows plus the missed older rows, newest first, each post once. The feed is
 * newest first, so on the page that reaches a stored post only the rows above that post are missed ones; rows below it
 * are older than the last post stored and are never added (they may predate the shadow, or belong to an earlier
 * outage). The rows are always stored in this run: a gap that cannot be finished is abandoned, never carried over, because
 * storing page 1 hides the gap from later runs and holding page 1 back would delay fresh posts.
 */
export async function recoverGap<R extends GapRow>(input: GapRecoveryInput<R>): Promise<GapRecoveryResult<R>> {
  const { firstBody, firstRows, mapPage, lookupStored, fetchPage, pageBudget = GAP_MAX_EXTRA_PAGES } = input;
  const first = await lookupStored(firstRows.flatMap(rowKeys));
  if (!first) return { rows: firstRows, state: "skipped", extraPages: 0 };
  if (!pageReachesNoStoredPost(firstRows, first.stored)) return { rows: firstRows, state: "none", extraPages: 0 };
  if (!first.hasHistory) return { rows: firstRows, state: "skipped", extraPages: 0 };

  const rows = [...firstRows];
  const seen = new Set(rows.map((row) => row.tweet_id));
  let cursor = nextPageCursor(firstBody);
  for (let page = 1; page <= GAP_MAX_EXTRA_PAGES; page++) {
    if (!cursor) return { rows, state: "unrecovered", extraPages: page - 1 };
    if (page > pageBudget) return { rows, state: "abandoned", extraPages: page - 1 };
    const body = await fetchPage(cursor);
    if (!body) return { rows, state: "abandoned", extraPages: page };
    const pageRows = mapPage(body);
    const lookup = await lookupStored(pageRows.flatMap(rowKeys));
    if (!lookup) return { rows, state: "abandoned", extraPages: page };
    for (const row of pageRows) {
      if (rowKeys(row).some((key) => lookup.stored.has(key))) return { rows, state: "recovered", extraPages: page };
      if (seen.has(row.tweet_id)) continue;
      seen.add(row.tweet_id);
      rows.push(row);
    }
    const next = nextPageCursor(body);
    cursor = next && next !== cursor ? next : null;
  }
  return { rows, state: "unrecovered", extraPages: GAP_MAX_EXTRA_PAGES };
}

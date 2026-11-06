// Pairs FxTwitter shadow sightings (x_timeline_shadow_posts) with IFTTT queue rows for the same post. Pure: used by
// the parity replay script (scripts/x-timeline-parity-replay.ts) and the cron report's poller-health section.
//
// Own posts and quotes pair by tweet id. Reposts cannot: IFTTT keys a repost by the wrapper's id, the scraper by the
// original's. They pair by the "RT @handle:" prefix plus the first 40 normalised characters of the text.

export type PairableShadow = {
  source_key: string;
  tweet_id: string;
  post_kind: string | null;
  full_text: string | null;
  original_author_handle: string | null;
};

export type PairableIfttt = {
  id: string;
  source_key: string;
  tweet_id: string | null;
  text: string | null;
};

export type PairedBy = "tweet_id" | "rt_text";

export type ShadowIftttPairing<S, I> = {
  pairs: Array<{ shadow: S; ifttt: I; by: PairedBy }>;
  unpairedShadow: S[];
  unpairedIfttt: I[];
};

/** Lower-cased text without the RT prefix, links, ellipses or repeated whitespace. */
export function normalisePostText(text: string): string {
  return text
    .replace(/^\s*RT\s+@\w+:\s*/i, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[…]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The reposted handle from IFTTT's "RT @handle: …" text, lower-cased; null for anything else. */
export function repostHandle(text: string | null): string | null {
  return text?.match(/^\s*RT\s+@(\w+):/i)?.[1]?.toLowerCase() ?? null;
}

/**
 * Greedy one-to-one pairing in shadow order (pass shadow rows sorted by first_seen_at). Each IFTTT row pairs at most
 * once. A repost pairs by text only when its normalised head is at least 10 characters; IFTTT's truncated text pairs
 * when it is a non-empty prefix of the shadow's head.
 */
export function pairShadowWithIfttt<S extends PairableShadow, I extends PairableIfttt>(
  shadow: S[],
  ifttt: I[],
): ShadowIftttPairing<S, I> {
  const used = new Set<string>();
  const pairs: ShadowIftttPairing<S, I>["pairs"] = [];
  const unpairedShadow: S[] = [];
  for (const row of shadow) {
    const candidates = ifttt.filter((event) => event.source_key === row.source_key && !used.has(event.id));
    let match = candidates.find((event) => event.tweet_id === row.tweet_id);
    let by: PairedBy = "tweet_id";
    if (!match && row.post_kind === "repost") {
      const head = normalisePostText(row.full_text ?? "").slice(0, 40);
      const handle = row.original_author_handle?.toLowerCase();
      match = candidates.find((event) => {
        const text = normalisePostText(event.text ?? "");
        return repostHandle(event.text) === handle && head.length >= 10 && text.length > 0 && text.startsWith(head.slice(0, Math.min(40, text.length)));
      });
      by = "rt_text";
    }
    if (match) {
      used.add(match.id);
      pairs.push({ shadow: row, ifttt: match, by });
    } else unpairedShadow.push(row);
  }
  return { pairs, unpairedShadow, unpairedIfttt: ifttt.filter((event) => !used.has(event.id)) };
}

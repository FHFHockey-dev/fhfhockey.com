import { describe, expect, it } from "vitest";

import {
  dedupeTweetCards,
  type LocalTweetCard,
} from "../../../pages/twitterEmbeds";

function buildCard(
  overrides: Partial<LocalTweetCard> = {},
): LocalTweetCard {
  return {
    key: overrides.key ?? "card-1",
    tweetId: overrides.tweetId ?? "tweet-1",
    authorName: overrides.authorName ?? "Author",
    authorHandle: overrides.authorHandle ?? "author",
    sourceAccount: overrides.sourceAccount ?? "Source",
    sourceLabel: overrides.sourceLabel ?? "Apr 30, 2026",
    tweetUrl: overrides.tweetUrl ?? "https://twitter.com/i/web/status/tweet-1",
    sourceUrl:
      overrides.sourceUrl ?? "https://twitter.com/Source/status/100",
    wrapperText: overrides.wrapperText ?? "wrapper",
    quotedAuthorName: overrides.quotedAuthorName ?? null,
    quotedAuthorHandle: overrides.quotedAuthorHandle ?? null,
    quotedTweetUrl: overrides.quotedTweetUrl ?? null,
    quotedText: overrides.quotedText ?? "",
    status: overrides.status ?? "accepted",
    observedAt: overrides.observedAt ?? "2026-04-30T12:00:00.000Z",
    rowStatus: overrides.rowStatus ?? "observed",
  };
}

describe("twitterEmbeds dedupeTweetCards", () => {
  it("keeps distinct CCC and GDL cards when they point to different canonical tweets", () => {
    const cards = dedupeTweetCards([
      buildCard({
        key: "ccc-card",
        sourceAccount: "CcCMiddleton",
        quotedTweetUrl: "https://twitter.com/i/web/status/300",
      }),
      buildCard({
        key: "gdl-card",
        sourceAccount: "GameDayLines",
        quotedTweetUrl: "https://twitter.com/i/web/status/301",
        sourceUrl: "https://twitter.com/GameDayLines/status/201",
      }),
    ]);

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.key)).toEqual(
      expect.arrayContaining(["ccc-card", "gdl-card"]),
    );
  });

  it("keeps the first accepted arrival for duplicate canonical tweets across sources", () => {
    const cards = dedupeTweetCards([
      buildCard({
        key: "ccc-first",
        sourceAccount: "CcCMiddleton",
        observedAt: "2026-04-30T12:00:00.000Z",
        sourceUrl: "https://twitter.com/BeatWriter/status/200",
        quotedTweetUrl: "https://twitter.com/i/web/status/300",
      }),
      buildCard({
        key: "gdl-later",
        sourceAccount: "GameDayLines",
        observedAt: "2026-04-30T12:03:00.000Z",
        sourceUrl: "https://twitter.com/GameDayLines/status/201",
        quotedTweetUrl: "https://twitter.com/i/web/status/300",
        quotedText: "better-enriched-quote",
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.key).toBe("ccc-first");
  });

  it("still prefers an accepted observed card over an earlier rejected duplicate", () => {
    const cards = dedupeTweetCards([
      buildCard({
        key: "rejected-first",
        observedAt: "2026-04-30T12:00:00.000Z",
        status: "rejected_ambiguous",
        rowStatus: "rejected",
        quotedTweetUrl: "https://twitter.com/i/web/status/400",
      }),
      buildCard({
        key: "accepted-later",
        observedAt: "2026-04-30T12:05:00.000Z",
        status: "accepted",
        rowStatus: "observed",
        quotedTweetUrl: "https://twitter.com/i/web/status/400",
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.key).toBe("accepted-later");
  });
});

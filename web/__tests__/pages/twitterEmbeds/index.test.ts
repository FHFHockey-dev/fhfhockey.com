import { describe, expect, it } from "vitest";

import {
  dedupeTweetCards,
  mapLineSourceSnapshotRowToCard,
  mapLinesCccRowToCard,
  sanitizeTwitterEmbedCardForPublic,
  selectFirstArrivalTweetCards,
  type LocalTweetCard,
} from "../../../pages/twitterEmbeds";

function buildCard(overrides: Partial<LocalTweetCard> = {}): LocalTweetCard {
  return {
    key: overrides.key ?? "card-1",
    sourceKey: overrides.sourceKey ?? "ccc",
    tweetId: overrides.tweetId ?? "tweet-1",
    authorName: overrides.authorName ?? "Author",
    authorHandle: overrides.authorHandle ?? "author",
    sourceAccount: overrides.sourceAccount ?? "Source",
    sourceLabel: overrides.sourceLabel ?? "Apr 30, 2026",
    tweetUrl: overrides.tweetUrl ?? "https://twitter.com/i/web/status/tweet-1",
    sourceUrl: overrides.sourceUrl ?? "https://twitter.com/Source/status/100",
    wrapperText: overrides.wrapperText ?? "wrapper",
    quotedAuthorName: overrides.quotedAuthorName ?? null,
    quotedAuthorHandle: overrides.quotedAuthorHandle ?? null,
    quotedTweetUrl: overrides.quotedTweetUrl ?? null,
    quotedText: overrides.quotedText ?? "",
    status: overrides.status ?? "accepted",
    snapshotDate: overrides.snapshotDate ?? "2026-04-30",
    teamId: overrides.teamId ?? 1,
    teamAbbreviation: overrides.teamAbbreviation ?? "BOS",
    gameId: overrides.gameId ?? 1000,
    signalType: overrides.signalType ?? "lineup",
    tweetPostedAt: overrides.tweetPostedAt ?? "2026-04-30T11:59:00.000Z",
    observedAt: overrides.observedAt ?? "2026-04-30T12:00:00.000Z",
    rowStatus: overrides.rowStatus ?? "observed",
    bucketKey: overrides.bucketKey ?? null,
    alternativeSources: overrides.alternativeSources ?? [],
  };
}

function buildLinesCccRow(
  overrides: Partial<Parameters<typeof mapLinesCccRowToCard>[0]> = {},
): Parameters<typeof mapLinesCccRowToCard>[0] {
  return {
    capture_key: "ccc-row",
    snapshot_date: "2026-04-30",
    team_id: 1,
    team_abbreviation: "BOS",
    game_id: 1000,
    classification: "lineup",
    tweet_posted_at: "2026-04-30T11:59:00.000Z",
    tweet_id: "100",
    tweet_url: "https://twitter.com/CcCMiddleton/status/100",
    source_url: "https://twitter.com/CcCMiddleton/status/100",
    quoted_tweet_id: "200",
    quoted_tweet_url: "https://twitter.com/BeatWriter/status/200",
    author_name: "CcCMiddleton",
    source_handle: "CcCMiddleton",
    quoted_author_name: "Beat Writer",
    quoted_author_handle: "BeatWriter",
    tweet_posted_label: "Apr 30, 2026",
    raw_text: "RT wrapper",
    enriched_text: "RT wrapper",
    quoted_raw_text: "Original lines",
    quoted_enriched_text: "Original lines enriched",
    nhl_filter_status: "accepted",
    observed_at: "2026-04-30T12:00:00.000Z",
    status: "observed",
    ...overrides,
  };
}

function buildLineSourceSnapshotRow(
  overrides: Partial<Parameters<typeof mapLineSourceSnapshotRowToCard>[0]> = {},
): Parameters<typeof mapLineSourceSnapshotRowToCard>[0] {
  return {
    capture_key: "gdl-row",
    snapshot_date: "2026-04-30",
    team_id: 1,
    team_abbreviation: "BOS",
    game_id: 1000,
    classification: "lineup",
    tweet_posted_at: "2026-04-30T11:59:00.000Z",
    source_key: "gamedaylines",
    source_account: "GameDayLines",
    tweet_id: "300",
    tweet_url: "https://twitter.com/GameDayLines/status/300",
    source_url: "https://twitter.com/GameDayLines/status/300",
    quoted_tweet_id: "400",
    quoted_tweet_url: "https://twitter.com/BeatWriter/status/400",
    author_name: "GameDayLines",
    source_handle: "GameDayLines",
    quoted_author_name: "Beat Writer",
    quoted_author_handle: "BeatWriter",
    tweet_posted_label: "Apr 30, 2026",
    raw_text: "Lines https://t.co/original",
    enriched_text: "Lines https://t.co/original",
    quoted_raw_text: "Original lineup",
    quoted_enriched_text: "Original lineup enriched",
    nhl_filter_status: "accepted",
    observed_at: "2026-04-30T12:00:00.000Z",
    status: "observed",
    ...overrides,
  };
}

describe("twitterEmbeds source attribution", () => {
  it("promotes CcCMiddleton retweets to the retweeted tweet author", () => {
    const card = mapLinesCccRowToCard(buildLinesCccRow());

    expect(card).toMatchObject({
      tweetId: "200",
      authorName: "Beat Writer",
      authorHandle: "BeatWriter",
      sourceAccount: "@BeatWriter",
      tweetUrl: "https://twitter.com/BeatWriter/status/200",
      sourceUrl: "https://twitter.com/BeatWriter/status/200",
      wrapperText: "Original lines enriched",
      quotedAuthorName: null,
      quotedAuthorHandle: null,
      quotedTweetUrl: null,
      quotedText: "",
    });
  });

  it("promotes GameDay source retweets to the retweeted tweet author", () => {
    const card = mapLineSourceSnapshotRowToCard(buildLineSourceSnapshotRow());

    expect(card).toMatchObject({
      tweetId: "400",
      authorName: "Beat Writer",
      authorHandle: "BeatWriter",
      sourceAccount: "@BeatWriter",
      tweetUrl: "https://twitter.com/BeatWriter/status/400",
      sourceUrl: "https://twitter.com/BeatWriter/status/400",
      wrapperText: "Original lineup enriched",
      quotedAuthorName: null,
      quotedAuthorHandle: null,
      quotedTweetUrl: null,
      quotedText: "",
    });
  });

  it("does not fall back to an aggregator handle as the card author", () => {
    const card = mapLineSourceSnapshotRowToCard(
      buildLineSourceSnapshotRow({
        quoted_tweet_id: null,
        quoted_tweet_url: null,
        quoted_author_name: null,
        quoted_author_handle: null,
        quoted_raw_text: null,
        quoted_enriched_text: null,
      }),
    );

    expect(card.authorName).toBe("Unknown author");
    expect(card.authorHandle).toBe("unknown");
  });

  it("removes relay identities from serialized public card data", () => {
    const card = sanitizeTwitterEmbedCardForPublic(
      mapLineSourceSnapshotRowToCard(buildLineSourceSnapshotRow()),
    );
    const serialized = JSON.stringify(card).toLowerCase();

    expect(card).toMatchObject({
      sourceKey: "original",
      sourceAccount: "@BeatWriter",
      tweetUrl: "https://twitter.com/BeatWriter/status/400",
      alternativeSources: [],
    });
    expect(serialized).not.toContain("gamedaylines");
  });
});

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

describe("twitterEmbeds first-arrival buckets", () => {
  it("selects the earliest source for a shared team/date/game/signal bucket", () => {
    const cards = selectFirstArrivalTweetCards([
      buildCard({
        key: "ccc-first",
        sourceKey: "ccc",
        sourceAccount: "CcCMiddleton",
        tweetId: "100",
        tweetUrl: "https://twitter.com/CcCMiddleton/status/100",
        tweetPostedAt: "2026-04-30T12:00:00.000Z",
      }),
      buildCard({
        key: "gdl-later",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "200",
        tweetUrl: "https://twitter.com/GameDayLines/status/200",
        tweetPostedAt: "2026-04-30T12:02:00.000Z",
      }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      key: "ccc-first",
      bucketKey: "2026-04-30|team:1|game:1000|lineup|none",
      alternativeSources: [
        {
          sourceKey: "gamedaylines",
          sourceAccount: "GameDayLines",
          tweetUrl: "https://twitter.com/GameDayLines/status/200",
        },
      ],
    });
  });

  it("keeps separate signal buckets for the same team and date", () => {
    const cards = selectFirstArrivalTweetCards([
      buildCard({ key: "lineup", signalType: "lineup" }),
      buildCard({
        key: "goalie",
        tweetId: "200",
        signalType: "goalie_start",
      }),
    ]);

    expect(cards.map((card) => card.key)).toEqual(
      expect.arrayContaining(["lineup", "goalie"]),
    );
  });
});

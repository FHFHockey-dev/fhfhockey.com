import { describe, expect, it } from "vitest";

import {
  getPublicNewsItemDetails,
  getPublicNewsSourceAttribution,
  sanitizePublicNewsFeedItem,
  type NewsFeedItem,
} from "./newsFeed";

function buildItem(overrides: Partial<NewsFeedItem> = {}): NewsFeedItem {
  return {
    id: "news-1",
    source_review_item_id: "review-1",
    source_tweet_id: "100",
    source_url: "https://x.com/GameDayNewsNHL/status/100",
    tweet_url: "https://x.com/GameDayNewsNHL/status/100",
    source_label: "GameDayNewsNHL",
    source_account: "GameDayNewsNHL",
    team_id: 1,
    team_abbreviation: "CHI",
    headline: "GameDayNewsNHL: Connor Bedard injury update",
    blurb: "Via @GameDayNewsNHL: a lower-body injury was reported.",
    category: "REPORTED INJURY",
    subcategory: "AWAITING OFFICIAL CONFIRMATION",
    card_status: "published",
    observed_at: "2026-07-14T12:00:00.000Z",
    published_at: "2026-07-14T12:01:00.000Z",
    metadata: {
      wrapperAuthorHandle: "GameDayNewsNHL",
      wrapperUrl: "https://x.com/GameDayNewsNHL/status/100",
      quotedAuthorName: "Ben Pope",
      quotedAuthorHandle: "BenPopeCST",
    },
    created_at: "2026-07-14T12:01:00.000Z",
    updated_at: "2026-07-14T12:01:00.000Z",
    players: [],
    ...overrides,
  };
}

describe("public NewsFeed source attribution", () => {
  it("prefers an AI summary and falls back to original post text", () => {
    expect(
      getPublicNewsItemDetails(
        buildItem({
          headline: "Nico Hischier news update",
          blurb: "Original post text about a possible extension.",
          metadata: {
            automation: {
              summary:
                "Nico Hischier and the Devils are closing in on a five-year extension.",
            },
          },
        }),
      ),
    ).toBe(
      "Nico Hischier and the Devils are closing in on a five-year extension.",
    );

    expect(
      getPublicNewsItemDetails(
        buildItem({
          headline: "Nico Hischier news update",
          blurb: "Original post text about a possible extension.",
          metadata: null,
        }),
      ),
    ).toBe("Original post text about a possible extension.");
  });

  it("removes retweet wrappers and media URLs from public details", () => {
    expect(
      getPublicNewsItemDetails(
        buildItem({
          headline: "Pavel Mintyukov news update",
          blurb:
            "RT @FriedgeHNIC: Hearing Pavel Mintyukov and Anaheim are getting an extension done. pic.twitter.com/example",
          metadata: null,
        }),
      ),
    ).toBe(
      "Hearing Pavel Mintyukov and Anaheim are getting an extension done.",
    );
  });

  it("never uses an AI summary for line-combination cards", () => {
    expect(
      getPublicNewsItemDetails(
        buildItem({
          headline: "CHI line combination update",
          blurb: "Bedard - Nazar - Teravainen\nBertuzzi - Dach - Mikheyev",
          category: "LINE COMBINATION",
          subcategory: "PROJECTED LINES",
          metadata: {
            automation: {
              summary:
                "AI-authored prose that must never appear on a lineup card.",
            },
          },
        }),
      ),
    ).toBe("Bedard - Nazar - Teravainen Bertuzzi - Dach - Mikheyev");
  });

  it("uses the original quoted author and URL instead of the relay account", () => {
    const item = buildItem();
    const source = getPublicNewsSourceAttribution({
      item,
      provenance: {
        source_handle: "GameDayNewsNHL",
        author_name: "GameDayNewsNHL",
        quoted_tweet_url: "https://x.com/BenPopeCST/status/200",
        metadata: item.metadata,
      },
    });

    expect(source).toEqual({
      displayName: "Ben Pope",
      account: "@BenPopeCST",
      url: "https://x.com/BenPopeCST/status/200",
    });
  });

  it("removes relay identities and wrapper URLs from public item data", () => {
    const item = sanitizePublicNewsFeedItem(buildItem(), {
      source_handle: "GameDayNewsNHL",
      author_name: "GameDayNewsNHL",
      quoted_tweet_url: "https://x.com/BenPopeCST/status/200",
    });
    const serialized = JSON.stringify(item);

    expect(item).toMatchObject({
      source_label: "Ben Pope",
      source_account: "@BenPopeCST",
      source_url: "https://x.com/BenPopeCST/status/200",
      tweet_url: "https://x.com/BenPopeCST/status/200",
      headline: "Connor Bedard injury update",
    });
    expect(serialized.toLowerCase()).not.toContain("gamedaynewsnhl");
  });

  it("hides attribution when no original author can be established", () => {
    const item = buildItem({
      metadata: null,
      headline: "Injury update",
      blurb: "Unconfirmed report.",
    });
    const source = getPublicNewsSourceAttribution({ item });

    expect(source).toEqual({ displayName: null, account: null, url: null });
  });

  it("removes appended relay bylines from public text", () => {
    const item = sanitizePublicNewsFeedItem(
      buildItem({
        headline: "Connor Bedard remains out",
        blurb:
          "Connor Bedard remains out tonight. — NHL Game Day News (@GameDayNewsNHL) Apr 20, 2026",
      }),
      {
        source_handle: "OriginalReporter",
        author_name: "Original Reporter",
        source_url: "https://x.com/OriginalReporter/status/300",
      },
    );

    expect(item.blurb).toBe("Connor Bedard remains out tonight.");
  });
});

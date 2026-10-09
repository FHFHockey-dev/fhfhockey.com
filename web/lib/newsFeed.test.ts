import { describe, expect, it, vi } from "vitest";

import {
  fetchNewsFeedItems,
  fetchLatestPlayerNewsFlags,
  getPublicNewsClaimPresentation,
  getPublicNewsItemDetails,
  getPublicNewsSourceAttribution,
  sanitizePublicNewsFeedItem,
  type NewsFeedItem,
} from "./newsFeed";

it("filters injury categories in the database query before limiting results", async () => {
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: (resolve: (result: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  const categories = ["INJURY", "REPORTED INJURY", "RETURN", "RETURNING"];

  await fetchNewsFeedItems({
    supabase: { from: vi.fn().mockReturnValue(query) },
    status: "published",
    categories,
    limit: 32,
  });

  expect(query.in).toHaveBeenCalledWith("category", categories);
  expect(query.eq).toHaveBeenCalledWith("card_status", "published");
  expect(query.limit).toHaveBeenCalledWith(32);
});

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
  it.each(["SOURCE_ACCOUNT", "@null", "undefined", "unknown", "N/A", "bad handle", "bad/handle", "<author>"])("rejects placeholder or malformed account %s", (account) => {
    expect(getPublicNewsSourceAttribution({ item: buildItem({ metadata: null, source_account: account, source_url: null, tweet_url: null }) }).account).toBeNull();
  });

  it.each(["javascript:alert(1)", "not a URL", "https://x.com/null/status/200"])("rejects unsafe or unverified attribution URL %s", (url) => {
    expect(getPublicNewsSourceAttribution({ item: buildItem({ metadata: null, source_account: null, source_url: url, tweet_url: null }) }).url).toBeNull();
  });

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


describe("public subject-to-claim presentation", () => {
  const barzalText = 'RT @AGrossNewsday: Mathew Barzal is with #Isles on trip, Pete DeBoer said he is attending all the meetings. Not on the ice yet but said to be "around the corner." So he won\'t play in the season opener tomorrow in Toronto.';
  it("does not turn the captured Kevin He or tentative Soucy headline into a supported claim", () => {
    for (const item of [
      { headline: "Kevin He injury update", blurb: barzalText, metadata: { automation: { primaryRuleId: "manual-review" } } },
      { headline: "Carson Soucy signing", blurb: 'RT @mark_scheig: Don Waddell on Carson Soucy: "Our goal is to get him signed." DW said they need to determine where the cap space will come from. #CBJ', metadata: null },
    ]) expect(getPublicNewsClaimPresentation(item)).toMatchObject({ headline: "Source report", claims: [], unresolvedReason: "Subject-to-claim evidence unavailable" });
  });
  it("retains a supported upstream claim and rejects mismatched, tentative-confirmed and unresolved payloads", () => {
    const event = { playerId: 8478445, playerName: "Mathew Barzal", kind: "injury", state: "ongoing",
      modality: "affirmative", availability: "out", evidence: { start: 0, end: barzalText.length, text: barzalText } };
    const makeItem = (events: unknown[], unresolved: unknown[] = []) => ({ headline: "Kevin He injury update", blurb: barzalText,
      metadata: { interpretation: { version: "2026-10-01.1", events, unresolved } } });
    expect(getPublicNewsClaimPresentation(makeItem([event]))).toMatchObject({ headline: "Mathew Barzal source report", claims: [event], unresolvedReason: null });
    for (const item of [makeItem([{ ...event, playerName: "Kevin He" }]),
      makeItem([{ ...event, state: "confirmed_return", modality: "tentative" }]),
      makeItem([event], [{ reason: "ambiguous" }]), makeItem([{ ...event, reviewReason: "conflicting_claims" }]),
      makeItem([{ ...event, evidence: { text: "Mathew Barzal has returned" } }]), makeItem([null])]) {
      expect(getPublicNewsClaimPresentation(item).claims).toEqual([]);
    }
  });
});


it("only emits player flags for bound claims and never borrows creation time for publication", async () => {
  const event = { playerId: 123, playerName: "Fixture Player", kind: "injury", state: "ongoing", modality: "affirmative",
    availability: "out", evidence: { start: 0, end: 21, text: "Fixture Player is out" } };
  const item = { id: "bound-item", headline: "Wrong Player injury update", blurb: "Fixture Player is out", category: "INJURY",
    metadata: { interpretation: { version: "2026-10-01.1", events: [event], unresolved: [] } },
    published_at: null, created_at: "2026-10-01T12:00:00Z", source_url: "https://x.com/Reporter/status/1" };
  const supabase = { from: (table: string) => {
    const query: any = { select: () => query, in: () => query, eq: () => query,
      then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "news_feed_item_players"
        ? [{ news_item_id: "bound-item", player_id: 123 }, { news_item_id: "bound-item", player_id: 456 }]
        : [item], error: null }) };
    return query;
  } };
  const flags = await fetchLatestPlayerNewsFlags({ supabase, playerIds: [123, 456] });
  expect(flags.has(456)).toBe(false);
  expect(flags.get(123)).toMatchObject({ headline: "Fixture Player source report", label: "Ongoing report", publishedAt: null, tone: "neutral" });
});

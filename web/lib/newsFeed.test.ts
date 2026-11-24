import { describe, expect, it, vi } from "vitest";

import {
  fetchNewsFeedItems,
  fetchLatestPlayerNewsFlags,
  getPublicNewsClaimPresentation,
  getPublicNewsItemDetails,
  getPublicNewsSourceAttribution,
  newsReportBlurb,
  sanitizePublicNewsFeedItem,
  type NewsFeedItem,
  sanitizePublicNewsText,
} from "./newsFeed";

import { selectReportedGameAbsences, selectReportedLineupEntries } from "./newsLineupRead";
import { extractTweetUnitChanges } from "./sources/tweetInterpretation";

it("keeps a DFO expectation tentative and checks its player, literal evidence and original clock", () => {
  const blurb = "Kevin Korchinski: Line Change: Korchinski is expected to draw back into the lineup vs. Carolina on Saturday.";
  const player = { player_id: 8483466, player_name: "Kevin Korchinski", team_id: 16 };
  const event = { playerId: player.player_id, playerName: player.player_name, teamId: 16, kind: "participation", state: "projected",
    evidence: { start: 0, end: blurb.length, text: blurb }, times: { observation: "2026-11-07T16:20:01Z" },
    availability: "uncertain", availabilityScope: "game", modality: "tentative" };
  const item = { headline: "Source report", blurb, source_tweet_id: "2119102582354591806", players: [player] };
  const read = (change = {}, card = {}) => getPublicNewsClaimPresentation({ ...item, ...card,
    metadata: { interpretation: { version: "2026-11-23.3", unresolved: [], events: [{ ...event, ...change }] } } }).claims;
  expect(read()).toMatchObject([{ playerId: 8483466, state: "projected" }]);
  for (const change of [{ modality: "affirmative" }, { observation: "practice" }, { availability: "available" },
    { teamId: 12 }, { playerId: 1 }, { evidence: { ...event.evidence, end: blurb.length - 1 } }]) expect(read(change)).toEqual([]);
  for (const card of [{ blurb: blurb + " Correction: out." }, { players: [] }, { source_tweet_id: "2119107768850518349" }]) expect(read({}, card)).toEqual([]);
});

it("checks a reported lineup entry against the original, reviewer, dated roster and scheduled opponent", () => {
  const text = "Owen Beck draws back into the lineup tonight against the Leafs.";
  const url = "https://x.com/CanadiensMTL/status/2119117441355714780";
  const originalId = "2119117441355714780", posted = "2026-11-07T17:19:03Z";
  const player = { playerId: 8483424, fullName: "Owen Beck", lastName: "Beck", teamId: 8, position: "C" };
  const changes = extractTweetUnitChanges(text, [player]);
  const game = { id: 2026020268, date: "2026-11-07", homeTeamId: 10, awayTeamId: 8 };
  const snapshot = { version: 1, binding: { teamId: 8, gameId: game.id, sourceTweetId: originalId }, interpretation: { context: "game", version: "original" } };
  const retained = { changes, events: [], version: "original", identityContext: { basis: "publication_roster", sourcePublishedAt: posted }, lineContext: { context: "game" } };
  const item = buildItem({ team_id: 8, metadata: { newsLineup: snapshot, retainedInterpretation: retained } });
  const roster = { source: "wrapper", text, publishedAt: posted, reviewSpans: [],
    players: [{ id: player.playerId, team_id: 8, fullName: player.fullName, lastName: player.lastName, position: "C" }] };
  const review = { metadata: { intakeRosterEvidence: roster }, enriched_text: text, source_url: url,
    review_status: "pending", parser_filter_status: "accepted", review_assignments: [] };
  const select = (r: Parameters<typeof selectReportedLineupEntries>[2], g = game, c = item) =>
    selectReportedLineupEntries(c, g, r, originalId, url, posted);
  expect(select(review)).toMatchObject([{ playerId: player.playerId, evidence: { text: "Owen Beck draws back into the lineup" } }]);
  for (const r of [{ ...review, enriched_text: "Different report" }, { ...review, review_status: "ignored" },
    { ...review, review_status: "reviewed" }, { ...review, review_assignments: [{ playerId: 99 }] },
    { ...review, source_url: url + "1" }, { ...review, parser_filter_status: "rejected_non_nhl" }]) {
    expect(select(r)).toEqual([]);
  }
  for (const evidence of [{ ...roster, publishedAt: "2026-11-07T17:20:03Z" }, { ...roster, reviewSpans: [{ start: 0, end: 9 }] },
    { ...roster, players: [{ ...roster.players[0]!, team_id: 10 }] },
    { ...roster, players: [...roster.players, { ...roster.players[0]!, id: 9 }] }]) {
    expect(select({ ...review, metadata: { intakeRosterEvidence: evidence } })).toEqual([]);
  }
  expect(select(review, { ...game, date: "2026-11-08" })).toEqual([]);
  expect(select(review, { ...game, homeTeamId: 3 })).toEqual([]);
  expect(select(review, game, { ...item, card_status: "draft" })).toEqual([]);
  expect(select(review, game, { ...item, metadata: { ...item.metadata, retainedInterpretation: { ...retained, lineContext: { context: "practice" } } } })).toEqual([]);
});

it("withholds a later absence when an older review row credits the earlier game-time decision", () => {
  const url = "https://x.com/Real_Max_Miller/status/2121664238527881291";
  const event = { playerId: 8477505, playerName: "Alexander Wennberg", kind: "injury", state: "unknown",
    availability: "out", modality: "affirmative", evidence: { start: 0, end: 23, text: "Wennberg is out tonight" },
    times: { observation: "2026-11-14T19:51:37Z" } };
  const metadata = { primaryTextSource: "quoted_oembed", originalPrimaryTextSource: "ifttt_text",
    quotedAuthorHandle: "Real_Max_Miller", quotedTweetUrl: url, interpretation: { version: "legacy", unresolved: [], events: [event] } };
  const item = sanitizePublicNewsFeedItem(buildItem({ source_url: url, blurb: event.evidence.text, metadata }));
  expect(item.source_attribution?.state).toBe("conflict");
  expect(getPublicNewsClaimPresentation(item).claims).toEqual([]);
});

it("requires the retained quote or its exact card preview before crediting a legacy relay summary", () => {
  const url = "https://x.com/patersonjeff/status/2121251629009957268";
  const text = "Filip Chytil is expected to return to #Canucks line-up tonight.";
  const long = text + " Additional source context.".repeat(12);
  const metadata = { primaryTextSource: "quoted_oembed", originalPrimaryTextSource: "ifttt_text",
    quotedAuthorHandle: "patersonjeff", quotedTweetUrl: url, interpretation: { version: "legacy", events: [], unresolved: [] } };
  const source = (blurb: string, quote: string | null) => sanitizePublicNewsFeedItem(buildItem({ metadata, blurb }),
    { quoted_tweet_url: url, quoted_text: quote }).source_attribution;
  expect(source("Vancouver is expected to activate Filip Chytil today. #Canucks", text)).toMatchObject({ state: "conflict", url: null });
  expect(source(text, null)).toMatchObject({ state: "conflict", url: null });
  expect(source(text, text)).toMatchObject({ state: "resolved", url });
  expect(source(newsReportBlurb(long), long)).toMatchObject({ state: "resolved", url });
  expect(source(text, long)).toMatchObject({ state: "conflict", url: null });
});

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
      primaryTextSource: "quoted_oembed",
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
  it.each(["GameDayLines", "GameDayGoalies", "GameDayNewsNHL", "CcCMiddleton", "DFOFantasy", "NHL_Rosters"])("never exposes ingest account %s in a public DTO", handle => {
    const item = buildItem({ source_label: handle, source_account: handle, source_url: `https://x.com/${handle}/status/100`, tweet_url: `https://x.com/${handle}/status/100`,
      headline: `Via @${handle}: Injury update`, blurb: `Via @${handle}: Player remains out`, metadata: { rawPayload: { account: handle }, sourceKey: handle } });
    const publicItem = sanitizePublicNewsFeedItem(item);
    expect(publicItem.source_label).toBe("Source link pending"); expect(publicItem.source_url).toBeNull();
    expect(JSON.stringify(publicItem).toLowerCase()).not.toContain(handle.toLowerCase());
    expect(item.source_account).toBe(handle);
  });
  it("selects the claim's author rather than the first handle or unrelated quoted author", () => {
    const item = buildItem({ source_url: "https://x.com/Reporter/status/100", source_account: "Reporter", source_label: "Reporter",
      metadata: { primaryTextSource: "wrapper_oembed", quotedAuthorHandle: "OtherWriter", quotedAuthorName: "Other Writer", quotedTweetUrl: "https://x.com/OtherWriter/status/200" } });
    expect(getPublicNewsSourceAttribution({ item })).toEqual({ displayName: "Reporter", account: "@Reporter", url: "https://x.com/Reporter/status/100" });
    expect(getPublicNewsSourceAttribution({ item: { ...item, metadata: { ...item.metadata, primaryTextSource: "quoted_oembed", quotedAuthorHandle: "WrongAuthor" } } }))
      .toEqual({ displayName: "Source link pending", account: null, url: null });
    expect(getPublicNewsSourceAttribution({ item: { ...item, blurb: "RT @OtherWriter: Practice update" } }))
      .toEqual({ displayName: "Source link pending", account: null, url: null });
  });
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

  it("suppresses conflicting retained original post IDs without hiding matching quote evidence", () => {
    const metadata = { primaryTextSource: "quoted_oembed", quotedTweetId: "999", quotedTweetUrl: "https://x.com/Reporter/status/1000", quotedAuthorHandle: "Reporter" };
    const item = buildItem({ metadata });
    const pending = { displayName: "Source link pending", account: null, url: null };
    expect(getPublicNewsSourceAttribution({ item })).toEqual(pending);
    const matching = buildItem({ metadata: { ...metadata, quotedTweetId: "1000" } });
    expect(getPublicNewsSourceAttribution({ item: matching })).toMatchObject({ account: "@Reporter", url: metadata.quotedTweetUrl });
    expect(getPublicNewsSourceAttribution({ item: matching, provenance: { metadata: { quotedTweetId: "999" } } })).toEqual(pending);
    expect(getPublicNewsSourceAttribution({ item: matching, provenance: { metadata: { quotedTweetUrl: "https://x.com/Reporter/status/999" } } })).toEqual(pending);
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

    expect(source).toEqual({ displayName: "Source link pending", account: null, url: null });
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
  const flyersClock = "2026-11-17T23:37:07Z";
  const backupReport = (wording = "Vladař backs him up", overrides = {}) => {
    const event = { playerId: 8478435, playerName: "Dan Vladar", teamId: 4, kind: "goalie", state: "confirmed",
      goalieRole: "backup", availability: "unknown", modality: "affirmative", resolutionBasis: "surname",
      times: { observation: flyersClock }, evidence: { start: 215, end: 215 + wording.length, text: wording }, ...overrides };
    return { headline: "Flyers warmups", blurb: wording, source_posted_at: flyersClock,
      metadata: { interpretation: { version: "retained", events: [event], unresolved: [] } } };
  };
  it.each(["Vladař", "Vladař".normalize("NFD")])("keeps the literal backup subject and original offsets for %s", subject => {
    const wording = `${subject} backs him up`;
    const item = backupReport(wording);
    expect(getPublicNewsClaimPresentation(item).claims).toEqual(item.metadata.interpretation.events);
    expect(getPublicNewsClaimPresentation({ ...item, blurb: "Vladar backs him up" }).claims).toEqual([]);
  });
  it("checks a full-name subject at its retained offset and rejects a second identity with the same spelling", () => {
    const subject = "Alberts Šmits";
    const wording = `Update: ${subject} is out 2–3 months.`;
    const start = 215 + wording.indexOf(subject);
    const item = backupReport(wording, { playerName: "Alberts Smits", playerId: 8485957, teamId: 3, kind: "injury",
      state: "unknown", availability: "out", resolutionBasis: "full_name",
      claimAnchor: { subjectSpan: { start, end: start + subject.length, text: subject } } });
    expect(getPublicNewsClaimPresentation(item).claims).toHaveLength(1);
    expect(getPublicNewsClaimPresentation({ ...item, players: [{ player_id: 100, player_name: subject }] }).claims).toEqual([]);
    expect(getPublicNewsClaimPresentation({ ...item, players: [{ player_id: 8485957, player_name: subject }] }).claims).toHaveLength(1);
  });
  it("withholds a surname shared across accented spellings and teams", () => {
    for (const spelling of ["Vladař", "Vladar"]) {
      const item = backupReport(`${spelling} backs him up`);
      expect(getPublicNewsClaimPresentation({ ...item, players: [
        { player_id: 100, player_name: "Another Vladař", team_id: 7 },
      ] }).claims).toEqual([]);
    }
  });
  it("withholds unbound, stale or altered spellings without substituting a different mention", () => {
    for (const item of [
      backupReport(undefined, { resolutionBasis: "alias" }), backupReport(undefined, { teamId: null }),
      backupReport(undefined, { times: { observation: "2026-11-16T23:37:07Z" } }),
      backupReport(undefined, { claimAnchor: { subjectSpan: { start: 216, end: 222, text: "Vladař" } } }),
      backupReport("Woll discusses Vladař"), backupReport("Vladař-Smith backs him up"), backupReport("Vladářová backs him up"),
    ]) expect(getPublicNewsClaimPresentation(item).claims).toEqual([]);
  });
  const barzalText = 'RT @AGrossNewsday: Mathew Barzal is with #Isles on trip, Pete DeBoer said he is attending all the meetings. Not on the ice yet but said to be "around the corner." So he won\'t play in the season opener tomorrow in Toronto.';
  it("does not turn the captured Kevin He or tentative Soucy headline into a supported claim", () => {
    for (const item of [
      { headline: "Kevin He injury update", blurb: barzalText, metadata: { automation: { primaryRuleId: "manual-review" } } },
      { headline: "Carson Soucy signing", blurb: 'RT @mark_scheig: Don Waddell on Carson Soucy: "Our goal is to get him signed." DW said they need to determine where the cap space will come from. #CBJ', metadata: null },
    ]) expect(getPublicNewsClaimPresentation(item)).toMatchObject({ headline: "Source report", claims: [], unresolvedReason: null });
  });
  it("matches evidence and blurb with URLs stripped on both sides", () => {
    const blurb = "Victor Hedman will not play tonight. https://t.co/abc123";
    const event = { playerId: 8475167, playerName: "Victor Hedman", kind: "injury", state: "unknown", modality: "affirmative",
      availability: "out", evidence: { text: "Victor Hedman will not play tonight. https://t.co/abc123", start: 0, end: 55 } };
    const item = (text: string) => ({ headline: "x", blurb: "Victor Hedman will not play tonight.",
      metadata: { interpretation: { version: "2026-10-13.1", unresolved: [], events: [{ ...event, evidence: { ...event.evidence, text } }] } } });
    expect(getPublicNewsClaimPresentation(item(event.evidence.text)).claims).toHaveLength(1);
    expect(getPublicNewsClaimPresentation({ ...item("Victor Hedman will not play tonight."), blurb }).claims).toHaveLength(1);
    // Different words are still a mismatch.
    expect(getPublicNewsClaimPresentation(item("Victor Hedman will play tonight. https://t.co/x")).claims).toEqual([]);
  });
  it("withholds an older clipped return and preserves another player's explicitly sourced claim", () => {
    const clipped = "Morgan Rielly will return to the lineup tonight.";
    const second = "Jake McCabe will return to the lineup tomorrow.";
    const blurb = `It looks like ${clipped} ${second}`;
    const postedAt = "2026-11-17T17:11:21Z";
    const events = ([[8476853, "Morgan Rielly", clipped], [8476931, "Jake McCabe", second]] as const).map(([id, name, text]) => ({
      playerId: id, playerName: name, kind: "injury", state: "confirmed_return", modality: "affirmative", availability: "available",
      evidence: { text, start: blurb.indexOf(text), end: blurb.indexOf(text) + text.length }, times: { observation: postedAt },
    }));
    const item = { headline: "Source report", blurb, metadata: { interpretation: { version: "2026-11-22.18", unresolved: [], events } } };
    expect(getPublicNewsClaimPresentation(item).claims.map(e => e.playerName)).toEqual(["Jake McCabe"]);
    const dated = getPublicNewsClaimPresentation({ ...item, source_posted_at: postedAt }).claims;
    expect(dated.map(e => e.state)).toEqual(["possible_return", "confirmed_return"]);
    expect(dated[0]!.evidence.text).toBe("looks like " + clipped);
    expect(blurb.slice(dated[0]!.evidence.start, dated[0]!.evidence.end)).toBe(dated[0]!.evidence.text);
    expect(events.map(e => e.state)).toEqual(["confirmed_return", "confirmed_return"]);
  });
  it("accepts a surname only when no other player in the card's context shares it", () => {
    const blurb = "Hughes will not play tonight.";
    const hughes = { playerId: 8481559, playerName: "Jack Hughes", kind: "injury", state: "unknown", modality: "affirmative",
      availability: "out", evidence: { text: blurb, start: 0, end: blurb.length } };
    const item = (extra: Record<string, unknown> = {}, events: unknown[] = [hughes]) => ({ headline: "x", blurb,
      metadata: { interpretation: { version: "2026-10-13.1", unresolved: [], events } }, ...extra });
    expect(getPublicNewsClaimPresentation(item())).toMatchObject({ headline: "Jack Hughes source report", unresolvedReason: null });
    // Another Hughes in the card's events or player rows makes the surname ambiguous: the full name is required.
    const luke = { ...hughes, playerId: 8482691, playerName: "Luke Hughes" };
    expect(getPublicNewsClaimPresentation(item({}, [hughes, luke]))).toMatchObject({ claims: [], unresolvedReason: "Subject-to-claim evidence unavailable" });
    expect(getPublicNewsClaimPresentation(item({ players: [{ player_id: 8482691, player_name: "Luke Hughes" }] }))).toMatchObject({ claims: [] });
    // The same player listed again is not ambiguity; a surname inside another word is not a match; no id, no claim.
    expect(getPublicNewsClaimPresentation(item({ players: [{ player_id: 8481559, player_name: "Jack Hughes" }] })).claims).toHaveLength(1);
    expect(getPublicNewsClaimPresentation({ ...item(), blurb: "Hughesville will not play tonight.", metadata: { interpretation: { version: "2026-10-13.1", unresolved: [],
      events: [{ ...hughes, evidence: { text: "Hughesville will not play tonight.", start: 0, end: 34 } }] } } }).claims).toEqual([]);
    expect(getPublicNewsClaimPresentation(item({}, [{ ...hughes, playerId: 0 }])).claims).toEqual([]);
  });
  it("calls a card unverified only when an interpretation exists and fails the check", () => {
    const base = { headline: "Kevin He injury update", blurb: barzalText };
    const reason = (interpretation: unknown) => getPublicNewsClaimPresentation({ ...base, metadata: { interpretation } }).unresolvedReason;
    expect(getPublicNewsClaimPresentation({ ...base, metadata: { automation: {} } }).unresolvedReason).toBeNull();
    expect(reason({ version: "2026-10-01.1", events: [], unresolved: [] })).toBeNull();
    for (const failing of [{ events: [], unresolved: [] }, { version: "2026-10-01.1", events: [], unresolved: [{ reason: "ambiguous" }] },
      { version: "2026-10-01.1", unresolved: [] }, { version: "2026-10-01.1", events: [{ playerId: 1 }], unresolved: [] }]) {
      expect(reason(failing)).toBe("Subject-to-claim evidence unavailable");
    }
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

it("checks the legacy quoted review before an old published card can create a player flag", async () => {
  const url = "https://x.com/patersonjeff/status/2121251629009957268";
  const posted = "2026-11-13T14:39:33.000Z", text = "Filip Chytil is expected to return to #Canucks line-up tonight.";
  const event = { playerId: 8480078, playerName: "Filip Chytil", kind: "injury", state: "possible_return",
    modality: "tentative", availability: "uncertain", evidence: { text, start: 0, end: text.length }, times: { observation: posted } };
  const item = buildItem({ source_url: url, blurb: text, metadata: { primaryTextSource: "quoted_oembed", originalPrimaryTextSource: "ifttt_text",
    quotedTweetUrl: url, quotedAuthorHandle: "patersonjeff", interpretation: { version: "legacy", events: [event], unresolved: [] } } });
  const read = async (quote: string) => {
    const tables: Record<string, unknown[]> = { news_feed_items: [item], news_feed_item_players: [{ news_item_id: item.id, player_id: event.playerId }],
      tweet_pattern_review_items: [{ id: item.source_review_item_id, quoted_tweet_url: url, quoted_text: quote }] };
    const supabase = { from(table: string) {
      const query = { select: () => query, in: () => query, eq: () => query,
        then: (resolve: (value: unknown) => unknown) => resolve({ data: tables[table] }) };
      return query;
    } };
    return fetchLatestPlayerNewsFlags({ supabase, playerIds: [event.playerId] });
  };
  expect((await read(text)).get(event.playerId)).toMatchObject({ sourceUrl: url, subcategory: "POSSIBLE_RETURN" });
  expect((await read("Vancouver is expected to activate Filip Chytil today.")).size).toBe(0);
});

it.each([
  ["backup", "Backup report"],
  [undefined, "Goalie report"],
])("keeps a latest-news flag with goalie role %s scoped to its report", async (role, label) => {
  const id = 8478024;
  const text = "Ville Husso is the backup.";
  const event = { playerId: id, playerName: "Ville Husso", kind: "goalie", state: "confirmed",
    goalieRole: role, availability: "unknown", modality: "affirmative", evidence: { start: 0, end: text.length, text } };
  const item = { id: "husso", blurb: text, metadata: { interpretation: { version: "retained", events: [event], unresolved: [] } } };
  const supabase = { from(table: string) {
    const rows = table === "news_feed_item_players" ? [{ news_item_id: item.id, player_id: id }] : [item];
    return { select: () => ({ in: () => table === "news_feed_item_players" ? { data: rows } : { eq: () => ({ data: rows }) } }) };
  } };
  const flags = await fetchLatestPlayerNewsFlags({ supabase, playerIds: [id] });
  expect(flags.get(id)).toMatchObject({ subcategory: label!.toUpperCase(), label, publishedAt: null });
});

describe("sanitizePublicNewsText quote-tweet scaffolding", () => {
  it("drops the Wrapper text / Quoted text labels and runs the quoted post on as a sentence", () => {
    expect(
      sanitizePublicNewsText(
        "Wrapper text\nMTL: Mike Matheson will not play tonight\n\nQuoted text\nMike Matheson n'est pas sur la glace.",
      ),
    ).toBe("MTL: Mike Matheson will not play tonight. Mike Matheson n'est pas sur la glace.");
    expect(sanitizePublicNewsText("Wrapper text\nLineup update!\n\nQuoted text\nStone is out.")).toBe(
      "Lineup update! Stone is out.",
    );
  });
});

it("recovers an old game-absence chip only from the original, matching roster and scheduled game", () => {
  const player = { id: 8482758, team_id: 5, fullName: "Ville Koivunen", lastName: "Koivunen" };
  const text = "Ville Koivunen is out day-to-day with an LBI and is out tonight.";
  const posted = "2026-11-08T23:10:43Z", original = "2119568328461254842";
  const url = "https://x.com/TheDanKingerski/status/" + original;
  const game = { id: 2026020282, date: "2026-11-08", homeTeamId: 24, awayTeamId: 5 };
  const item = buildItem({ team_id: 5, card_status: "published", metadata: { retainedInterpretation: { identityContext: { basis: "publication_roster", sourcePublishedAt: posted } }, newsLineup: { version: 1,
    binding: { teamId: 5, gameId: game.id, sourceTweetId: original }, interpretation: { context: "game" } } } });
  const e = { playerId: player.id, teamId: 5, playerName: player.fullName, kind: "injury", state: "ongoing", availability: "uncertain",
    resolutionBasis: "full_name", times: { observation: posted, reference: null, applicability: "unresolved" },
    evidence: { start: 0, end: text.length, text }, timeline: null, timelines: [] } as const;
  const roster = { source: "wrapper", text, publishedAt: posted, reviewSpans: [], players: [player] };
  const r = { metadata: { intakeRosterEvidence: roster }, enriched_text: text, parser_filter_status: "accepted", source_url: url, review_status: "pending" };
  const select = (review: Parameters<typeof selectReportedGameAbsences>[2], g = game) =>
    selectReportedGameAbsences(item, g, review, url, posted, [{ ...e, timelines: [] }]);
  expect(select(r)).toMatchObject([{ playerId: player.id, relative: "tonight", fields: { availability: "out", effectiveDate: game.date } }]);
  for (const changed of [{ ...r, source_url: url + "1" }, { ...r, enriched_text: text + " Correction." }, { ...r, review_status: "reviewed" },
    { ...r, review_assignments: [{ playerId: 9 }] }, { ...r, metadata: { intakeRosterEvidence: { ...roster, reviewSpans: [{ start: 0, end: 5 }] } } },
    { ...r, metadata: { intakeRosterEvidence: { ...roster, players: [player, { ...player, id: 123 }] } } }]) expect(select(changed)).toEqual([]);
  expect(select(r, { ...game, date: "2026-11-09" })).toEqual([]);
});

it("removes an old injury attributed to a bare pronoun and keeps the named source claim", () => {
  const blurb = "Dylan Guenther will not play tonight. He will miss approximately 2-4 weeks.";
  const injury = { kind: "injury", state: "unknown", modality: "affirmative", availability: "out" };
  const named = { ...injury, playerId: 8482699, playerName: "Dylan Guenther", evidence: { start: 0, end: blurb.indexOf("."), text: blurb.split(". ")[0]! } };
  const old = { ...injury, playerId: 8484864, playerName: "Kevin He",
    evidence: { start: blurb.indexOf("He will"), end: blurb.length, text: blurb.slice(blurb.indexOf("He will")) } };
  const present = (text: string, events: unknown[]) => getPublicNewsClaimPresentation({ blurb: text, headline: "Source report",
    metadata: { interpretation: { version: "2026-11-23.7", unresolved: [], events } } } as never).claims.map(e => e.playerId);
  expect(present(blurb, [named, old])).toEqual([8482699]);
  expect(present(old.evidence.text, [old])).toEqual([]);
  const oldDay = { ...old, playerId: 8484455, playerName: "Nathaniel Day", evidence: { start: 0, end: 10, text: "Day-to-day" } };
  expect(present("Day-to-day", [oldDay])).toEqual([]);
  const signed = "Kevin He will miss two games.";
  expect(present(signed, [{ ...old, evidence: { start: 0, end: signed.length, text: signed } }])).toEqual([8484864]);
});

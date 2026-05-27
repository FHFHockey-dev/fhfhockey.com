import { describe, expect, it, vi } from "vitest";

import { buildTeamDirectory } from "./lineupSourceIngestion";
import {
  applyLinesCccWrapperOEmbed,
  applyQuotedTweetPreference,
  buildLinesCccWrapperOEmbedDeferredState,
  buildLinesCccSourceFromIftttEvent,
  buildLinesCccWrapperOEmbedSuccessState,
  fetchLinesCccTweetOEmbedData,
  refreshLinesCccSourceFromPrimaryText,
  rejectInsufficientQuoteWrapper,
  readLinesCccWrapperOEmbedBackfillState,
  resolveLinesCccTeam,
  resolveLinesCccQuotedTweet,
  shouldAttemptLinesCccWrapperOEmbedBackfill,
  toLinesCccTweetOEmbedDataFromBackfillState,
  toLinesCccRow
} from "./linesCccIngestion";

const [canadiens, lightning, utah] = buildTeamDirectory([
  {
    id: 8,
    name: "Montréal Canadiens",
    abbreviation: "MTL",
    logo: "/teamLogos/MTL.png"
  },
  {
    id: 14,
    name: "Tampa Bay Lightning",
    abbreviation: "TBL",
    logo: "/teamLogos/TBL.png"
  },
  {
    id: 59,
    name: "Utah Mammoth",
    abbreviation: "UTA",
    logo: "/teamLogos/UTA.png"
  }
]);

const canadiensRoster = [
  { playerId: 1, fullName: "Cole Caufield", lastName: "Caufield" },
  { playerId: 2, fullName: "Nick Suzuki", lastName: "Suzuki" },
  { playerId: 3, fullName: "Juraj Slafkovsky", lastName: "Slafkovsky" },
  { playerId: 4, fullName: "Patrik Laine", lastName: "Laine" },
  { playerId: 5, fullName: "Kirby Dach", lastName: "Dach" },
  { playerId: 6, fullName: "Ivan Demidov", lastName: "Demidov" },
  { playerId: 7, fullName: "Mike Matheson", lastName: "Matheson" },
  { playerId: 8, fullName: "Lane Hutson", lastName: "Hutson" },
  { playerId: 9, fullName: "Jakub Dobes", lastName: "Dobes" },
  { playerId: 10, fullName: "Josh Anderson", lastName: "Anderson" },
  { playerId: 11, fullName: "Jake Evans", lastName: "Evans" },
  { playerId: 12, fullName: "Zach Bolduc", lastName: "Bolduc" },
  { playerId: 13, fullName: "Alex Newhook", lastName: "Newhook" },
  { playerId: 14, fullName: "Phillip Danault", lastName: "Danault" },
  { playerId: 15, fullName: "Brendan Gallagher", lastName: "Gallagher" },
  { playerId: 16, fullName: "Kaiden Guhle", lastName: "Guhle" },
  { playerId: 17, fullName: "Arber Xhekaj", lastName: "Xhekaj" },
  { playerId: 18, fullName: "Jayden Struble", lastName: "Struble" },
  { playerId: 19, fullName: "Jacob Fowler", lastName: "Fowler" },
  { playerId: 20, fullName: "Alexandre Carrier", lastName: "Carrier" },
  { playerId: 31, fullName: "Alexandre Texier", lastName: "Texier" }
];
const lightningRoster = [
  { playerId: 21, fullName: "Gage Goncalves", lastName: "Goncalves" },
  { playerId: 22, fullName: "Brayden Point", lastName: "Point" },
  { playerId: 23, fullName: "Nikita Kucherov", lastName: "Kucherov" },
  { playerId: 24, fullName: "Brandon Hagel", lastName: "Hagel" },
  { playerId: 25, fullName: "Anthony Cirelli", lastName: "Cirelli" },
  { playerId: 26, fullName: "Jake Guentzel", lastName: "Guentzel" },
  { playerId: 27, fullName: "Ryan McDonagh", lastName: "McDonagh" },
  { playerId: 28, fullName: "Erik Cernak", lastName: "Cernak" },
  { playerId: 29, fullName: "Andrei Vasilevskiy", lastName: "Vasilevskiy" },
  { playerId: 30, fullName: "Jonas Johansson", lastName: "Johansson" }
];
const utahRoster = [
  { playerId: 40, fullName: "Karel Vejmelka", lastName: "Vejmelka" },
  { playerId: 41, fullName: "Clayton Keller", lastName: "Keller" }
];

describe("linesCccIngestion", () => {
  it("fetches CCC wrapper tweet oEmbed data with author and posted metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          html: `
            <blockquote>
              <p>Lightning lines<br>https://t.co/9cZkBXydVn</p>
              <a href="https://twitter.com/CcCMiddleton/status/2047808711494902155">Apr 24, 2026</a>
            </blockquote>
          `,
          author_name: "LinesLinesLines",
          author_url: "https://twitter.com/CcCMiddleton"
        })
      })
    );

    await expect(
      fetchLinesCccTweetOEmbedData("https://x.com/CcCMiddleton/status/2047808711494902155")
    ).resolves.toEqual({
      text: "Lightning lines\nhttps://t.co/9cZkBXydVn",
      postedAt: "2026-04-24T00:00:00.000Z",
      postedLabel: "Apr 24, 2026",
      sourceTweetUrl: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
      authorName: "LinesLinesLines",
      authorHandle: "CcCMiddleton"
    });

    vi.unstubAllGlobals();
  });

  it("schedules exponential backoff for 429 wrapper oEmbed retries", () => {
    const deferred = buildLinesCccWrapperOEmbedDeferredState({
      tweetId: "2047808711494902155",
      tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
      existingState: {
        status: "deferred_429",
        tweetId: "2047808711494902155",
        tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
        attemptCount: 2,
        lastAttemptAt: "2026-04-24T12:00:00.000Z",
        nextAttemptAt: "2026-04-24T12:10:00.000Z"
      },
      nowIso: "2026-04-24T13:00:00.000Z",
      httpStatus: 429,
      error: "oembed_http_429"
    });

    expect(deferred).toMatchObject({
      status: "deferred_429",
      attemptCount: 3,
      httpStatus: 429,
      lastError: "oembed_http_429",
      nextAttemptAt: "2026-04-24T13:20:00.000Z"
    });
  });

  it("uses cached wrapper oEmbed success state and skips new attempts until due", () => {
    const state = readLinesCccWrapperOEmbedBackfillState({
      linesCccOembed: {
        wrapper: {
          status: "success",
          tweetId: "2047808711494902155",
          tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
          sourceTweetUrl: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
          attemptCount: 1,
          lastAttemptAt: "2026-04-24T12:00:00.000Z",
          fetchedAt: "2026-04-24T12:00:00.000Z",
          text: "Lightning lines",
          postedLabel: "Apr 24, 2026",
          authorName: "LinesLinesLines",
          authorHandle: "CcCMiddleton"
        }
      }
    });

    expect(shouldAttemptLinesCccWrapperOEmbedBackfill({
      tweetId: "2047808711494902155",
      tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
      existingState: state,
      nowIso: "2026-04-24T12:30:00.000Z"
    })).toBe(false);

    expect(toLinesCccTweetOEmbedDataFromBackfillState(state)).toMatchObject({
      text: "Lightning lines",
      postedLabel: "Apr 24, 2026",
      authorHandle: "CcCMiddleton"
    });
  });

  it("resolves NHL teams from known source handles when text labels are absent", () => {
    expect(
      resolveLinesCccTeam({
        text: "Starting Goalie: Andrei Vasilevskiy",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ]),
        sourceHandles: ["TBLightning"]
      })
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL"
    });
  });

  it("resolves NHL teams from roster density when text labels are absent", () => {
    expect(
      resolveLinesCccTeam({
        text:
          "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ])
      })
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL"
    });
  });

  it("uses the leading team nickname before vs when both teams are mentioned", () => {
    expect(
      resolveLinesCccTeam({
        text: "#Habs lines vs #Lightning\nCaufield - Suzuki - Slafkovsky",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ])
      })
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL"
    });
  });

  it("does not let conflicting lead-vs text outweigh stronger roster evidence", () => {
    expect(
      resolveLinesCccTeam({
        text:
          "Lightning lines vs #Habs\nCaufield - Suzuki - Slafkovsky\nMatheson - Hutson",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ])
      })
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL"
    });
  });

  it("accepts a single roster hit when a team hashtag supports it", () => {
    expect(
      resolveLinesCccTeam({
        text: "#TusksUp Vejmelka in the starter's net",
        teams: [canadiens!, lightning!, utah!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
          [59, utahRoster]
        ]),
        classification: "goalie_start"
      })
    ).toMatchObject({
      id: 59,
      abbreviation: "UTA"
    });
  });

  it("rejects injury tweets with only a last-name match and no team support", () => {
    expect(
      resolveLinesCccTeam({
        text: "Dach returns tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ]),
        classification: "injury"
      })
    ).toBeNull();
  });

  it("accepts injury tweets on a full-name match even without a team label", () => {
    expect(
      resolveLinesCccTeam({
        text: "Patrik Laine returns tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ]),
        classification: "injury"
      })
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL"
    });
  });

  it("accepts goalie-start tweets on a full-name match even without a team label", () => {
    expect(
      resolveLinesCccTeam({
        text: "Andrei Vasilevskiy gets the start tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster]
        ]),
        classification: "goalie_start"
      })
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL"
    });
  });

  it("refreshes team and roster fields from enriched Habs-vs-Lightning text", () => {
    const source = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "event-habs",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "Lightning lines https://t.co/example",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047814982583414912",
        tweet_id: "2047814982583414912",
        tweet_created_at: null,
        created_at_label: "April 24, 2026",
        raw_payload: {},
        received_at: "2026-04-24T22:00:00.000Z"
      },
      snapshotDate: "2026-04-25",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster]
      ])
    });
    const refreshed = refreshLinesCccSourceFromPrimaryText({
      source: {
        ...source,
        enrichedText:
          "#Habs lines vs #Lightning\nCaufield - Suzuki - Slafkovsky\nMatheson - Hutson",
        sourceHandle: "ChrisHabs360",
        authorName: "ChrisHabs360",
        primaryTextSource: "wrapper_oembed"
      },
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster]
      ])
    });

    expect(refreshed.team).toMatchObject({
      id: 8,
      abbreviation: "MTL"
    });
    expect(refreshed.forwards?.[0]).toEqual([
      "Cole Caufield",
      "Nick Suzuki",
      "Juraj Slafkovsky"
    ]);
    expect(refreshed.matchedPlayerIds).toContain(2);
    expect(refreshed.unmatchedNames).toEqual([]);
  });

  it("resolves quoted tweet urls from wrapper text and fetches quoted oEmbed data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "location"
                ? "https://twitter.com/BenjaminJReport/status/2047808467969220779"
                : null
          },
          url: "https://t.co/9cZkBXydVn"
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            html: `
              <blockquote>
                <p>
                  The #GoBolts lines unchanged in warmups:<br><br>
                  Goncalves-Point-Kucherov<br>
                  Hagel-Cirelli-Guentzel
                </p>
                <a href="https://twitter.com/BenjaminJReport/status/2047808467969220779">
                  Apr 24, 2026
                </a>
              </blockquote>
            `,
            author_name: "Benjamin Piercey",
            author_url: "https://twitter.com/BenjaminJReport"
          })
        })
    );

    await expect(
      resolveLinesCccQuotedTweet({
        wrapperText: "Lightning lines https://t.co/9cZkBXydVn"
      })
    ).resolves.toEqual({
      quotedTweetId: "2047808467969220779",
      quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
      quotedText:
        "The #GoBolts lines unchanged in warmups:\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
      quotedPostedAt: "2026-04-24T00:00:00.000Z",
      quotedPostedLabel: "Apr 24, 2026",
      quotedSourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779",
      quotedAuthorName: "Benjamin Piercey",
      quotedAuthorHandle: "BenjaminJReport"
    });

    vi.unstubAllGlobals();
  });

  it("prefers quoted tweet text when the wrapper is only a headline plus t.co link", () => {
    const preferred = applyQuotedTweetPreference({
      source: {
        snapshotDate: "2026-04-25",
        rawText: "Lightning lines https://t.co/9cZkBXydVn",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted"
      },
      quotedTweet: {
        quotedTweetId: "2047808467969220779",
        quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
        quotedText:
          "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
        quotedPostedAt: "2026-04-24T00:00:00.000Z",
        quotedPostedLabel: "Apr 24, 2026",
        quotedSourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        quotedAuthorName: "Benjamin Piercey",
        quotedAuthorHandle: "BenjaminJReport"
      }
    });

    expect(preferred).toMatchObject({
      primaryTextSource: "quoted_oembed",
      quotedTweetId: "2047808467969220779",
      quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
      quotedRawText:
        "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
      quotedEnrichedText:
        "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
      metadata: {
        preferredQuotedTweet: true,
        primaryTextSource: "quoted_oembed",
        primarySourceUrl: "https://twitter.com/i/web/status/2047808467969220779",
        quotedSourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779"
      }
    });
  });

  it("applies wrapper oEmbed content as cached enriched text and metadata", () => {
    const source = applyLinesCccWrapperOEmbed({
      source: {
        snapshotDate: "2026-04-25",
        rawText: "Lightning lines https://t.co/9cZkBXydVn",
        tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        metadata: {}
      },
      oembedData: toLinesCccTweetOEmbedDataFromBackfillState(
        buildLinesCccWrapperOEmbedSuccessState({
          tweetId: "2047808711494902155",
          tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
          nowIso: "2026-04-24T12:00:00.000Z",
          existingState: null,
          data: {
            text: "Lightning lines\nGoncalves-Point-Kucherov",
            postedAt: "2026-04-24T00:00:00.000Z",
            postedLabel: "Apr 24, 2026",
            sourceTweetUrl: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
            authorName: "LinesLinesLines",
            authorHandle: "CcCMiddleton"
          }
        })
      )!
    });

    expect(source).toMatchObject({
      enrichedText: "Lightning lines\nGoncalves-Point-Kucherov",
      primaryTextSource: "wrapper_oembed",
      sourceUrl: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
      authorName: "LinesLinesLines",
      sourceHandle: "CcCMiddleton",
      metadata: {
        primaryTextSource: "wrapper_oembed",
        primarySourceUrl: "https://twitter.com/i/web/status/2047808711494902155"
      }
    });
  });

  it("keeps wrapper text primary when it already has richer structure than the quote", () => {
    const preferred = applyQuotedTweetPreference({
      source: {
        snapshotDate: "2026-04-25",
        rawText: "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        metadata: {}
      },
      quotedTweet: {
        quotedTweetId: "2047808467969220779",
        quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
        quotedText: "Lightning lines",
        quotedPostedAt: "2026-04-24T00:00:00.000Z",
        quotedPostedLabel: "Apr 24, 2026",
        quotedSourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        quotedAuthorName: "Benjamin Piercey",
        quotedAuthorHandle: "BenjaminJReport"
      }
    });

    expect(preferred.primaryTextSource).toBe("ifttt_text");
    expect(preferred.metadata).toMatchObject({
      primaryTextSource: "ifttt_text",
      primaryText: "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
      quotedSourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779"
    });
    expect(preferred.quotedTweetId).toBe("2047808467969220779");
  });

  it("rejects headline-only quote wrappers when the quoted tweet cannot be resolved", () => {
    const rejected = rejectInsufficientQuoteWrapper({
      source: {
        snapshotDate: "2026-04-25",
        rawText: "Lightning lines https://t.co/9cZkBXydVn",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        metadata: {}
      },
      quotedTweet: null
    });

    expect(rejected).toMatchObject({
      nhlFilterStatus: "rejected_insufficient_text",
      nhlFilterReason: "unresolved_quoted_tweet",
      metadata: {
        unresolvedQuotedTweet: true
      }
    });
  });

  it("does not reject direct goalie wrappers that still contain useful wrapper text", () => {
    const preserved = rejectInsufficientQuoteWrapper({
      source: {
        snapshotDate: "2026-04-25",
        rawText: "confirmed Lightning Starting Goalie: Andrei Vasilevskiy https://t.co/SGBBO1KIsp",
        primaryTextSource: "ifttt_text",
        classification: "goalie_start",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        matchedPlayerIds: [7],
        metadata: {}
      },
      quotedTweet: null
    });

    expect(preserved.nhlFilterStatus).toBe("accepted");
    expect(preserved.nhlFilterReason).toBeUndefined();
  });

  it("parses IFTTT text into accepted NHL goalie candidates", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "32244dec-1064-4913-a98b-2611bcc9ea75",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text:
          "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        tweet_id: "2047809041154625899",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:44PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.954Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]]),
      gameIdByTeamId: new Map([[8, 2025030111]])
    });

    expect(parsed).toMatchObject({
      team: canadiens,
      gameId: 2025030111,
      tweetId: "2047809041154625899",
      tweetUrl: "https://twitter.com/i/web/status/2047809041154625899",
      classification: "goalie_start",
      detectedLeague: "NHL",
      nhlFilterStatus: "accepted",
      nhlFilterReason: null,
      goalies: ["Jakub Dobes"],
      matchedPlayerIds: [9],
      matchedNames: ["Jakub Dobes"],
      enrichedText:
        "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
      metadata: {
        primaryTextSource: "ifttt_text",
        wrapperKeywordHits: ["lines", "starting goalie", "starting"],
        primaryKeywordHits: ["lines", "starting goalie", "starting"],
        resolvedTweetUrls: {
          wrapperTweetUrl: "https://twitter.com/i/web/status/2047809041154625899",
          quotedTweetUrl: null,
          sourceUrl: "https://twitter.com/i/web/status/2047809041154625899"
        }
      }
    });
  });

  it("parses direct structured lineup text into forwards, pairs, and goalies", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "lightning-lines-direct",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text:
          "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nMcDonagh-Cernak\nVasilevskiy\nJohansson",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
        tweet_id: "2047808711494902155",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:43PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.726Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster]
      ])
    });

    expect(parsed).toMatchObject({
      team: lightning,
      classification: "lineup",
      nhlFilterStatus: "accepted",
      forwards: [
        ["Gage Goncalves", "Brayden Point", "Nikita Kucherov"],
        ["Brandon Hagel", "Anthony Cirelli", "Jake Guentzel"]
      ],
      defensePairs: [["Ryan McDonagh", "Erik Cernak"]],
      goalies: ["Andrei Vasilevskiy", "Jonas Johansson"]
    });
  });

  it("parses keywordless beat-writer lineup blocks through roster density and separator patterns", () => {
    const vegas = buildTeamDirectory([
      {
        id: 54,
        name: "Vegas Golden Knights",
        abbreviation: "VGK",
        logo: "/teamLogos/VGK.png"
      }
    ])[0]!;
    const vegasRoster = [
      { playerId: 1, fullName: "Ivan Barbashev", lastName: "Barbashev" },
      { playerId: 2, fullName: "Jack Eichel", lastName: "Eichel" },
      { playerId: 3, fullName: "Pavel Dorofeyev", lastName: "Dorofeyev" },
      { playerId: 4, fullName: "Brett Howden", lastName: "Howden" },
      { playerId: 5, fullName: "Mitchell Marner", lastName: "Marner" },
      { playerId: 6, fullName: "Mark Stone", lastName: "Stone" },
      { playerId: 7, fullName: "Tomas Hertl", lastName: "Hertl" },
      { playerId: 8, fullName: "William Karlsson", lastName: "Karlsson" },
      { playerId: 9, fullName: "Keegan Kolesar", lastName: "Kolesar" },
      { playerId: 10, fullName: "Cole Smith", lastName: "Smith", aliases: ["C Smith"] },
      { playerId: 11, fullName: "Nic Dowd", lastName: "Dowd" },
      { playerId: 12, fullName: "Colton Sissons", lastName: "Sissons" },
      { playerId: 13, fullName: "Brayden McNabb", lastName: "McNabb" },
      { playerId: 14, fullName: "Shea Theodore", lastName: "Theodore" },
      { playerId: 15, fullName: "Noah Hanifin", lastName: "Hanifin" },
      { playerId: 16, fullName: "Rasmus Andersson", lastName: "Andersson" },
      { playerId: 17, fullName: "Ben Hutton", lastName: "Hutton" },
      { playerId: 18, fullName: "Kaedan Korczak", lastName: "Korczak" },
      { playerId: 19, fullName: "Carter Hart", lastName: "Hart" }
    ];
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "vegas-keywordless-lines",
        source: "ifttt",
        source_account: "BeatWriterVGK",
        username: "BeatWriterVGK",
        text:
          "Barbashev—Eichel—Dorofeyev\n" +
          "Howden—Marner—Stone\n" +
          "Hertl—Karlsson—Kolesar\n" +
          "C Smith—Dowd—Sissons\n\n" +
          "McNabb—Theodore\n" +
          "Hanifin—Andersson\n" +
          "Hutton—Korczak\n\n" +
          "Hart",
        link_to_tweet: "https://twitter.com/BeatWriterVGK/status/2052196164116893794",
        tweet_id: "2052196164116893794",
        tweet_created_at: null,
        created_at_label: "August 29, 2026",
        raw_payload: {},
        received_at: "2026-08-29T14:30:00.000Z"
      },
      snapshotDate: "2026-08-29",
      teams: [vegas],
      rosterByTeam: new Map([[54, vegasRoster]])
    });

    expect(parsed).toMatchObject({
      team: vegas,
      classification: "lineup",
      nhlFilterStatus: "accepted",
      forwards: [
        ["Ivan Barbashev", "Jack Eichel", "Pavel Dorofeyev"],
        ["Brett Howden", "Mitchell Marner", "Mark Stone"],
        ["Tomas Hertl", "William Karlsson", "Keegan Kolesar"],
        ["Cole Smith", "Nic Dowd", "Colton Sissons"]
      ],
      defensePairs: [
        ["Brayden McNabb", "Shea Theodore"],
        ["Noah Hanifin", "Rasmus Andersson"],
        ["Ben Hutton", "Kaedan Korczak"]
      ],
      goalies: ["Carter Hart"]
    });
  });

  it("flags keyworded power-play text only when it resolves to five-player units", () => {
    const ducks = buildTeamDirectory([
      {
        id: 24,
        name: "Anaheim Ducks",
        abbreviation: "ANA",
        logo: "/teamLogos/ANA.png"
      }
    ])[0]!;
    const ducksRoster = [
      { playerId: 1, fullName: "Chris Kreider", lastName: "Kreider" },
      { playerId: 2, fullName: "Leo Carlsson", lastName: "Carlsson" },
      { playerId: 3, fullName: "Troy Terry", lastName: "Terry" },
      { playerId: 4, fullName: "Mikael Granlund", lastName: "Granlund" },
      { playerId: 5, fullName: "John Carlson", lastName: "Carlson" },
      { playerId: 6, fullName: "Beckett Sennecke", lastName: "Sennecke" },
      { playerId: 7, fullName: "Ryan Poehling", lastName: "Poehling" },
      { playerId: 8, fullName: "Alex Killorn", lastName: "Killorn" },
      { playerId: 9, fullName: "Cutter Gauthier", lastName: "Gauthier" },
      { playerId: 10, fullName: "Jackson LaCombe", lastName: "LaCombe" }
    ];
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "ducks-pp-units",
        source: "ifttt",
        source_account: "BeatWriterANA",
        username: "BeatWriterANA",
        text:
          "Ducks Game 2 power play units vs. #ForgedInGold:\n\n" +
          "Kreider\n" +
          "Carlsson-Terry-Granlund\n" +
          "Carlson\n\n" +
          "Sennecke\n" +
          "Poehling-Killorn-Gauthier\n" +
          "LaCombe\n\n" +
          "#FlyTogether",
        link_to_tweet: "https://twitter.com/BeatWriterANA/status/2052196164116893795",
        tweet_id: "2052196164116893795",
        tweet_created_at: null,
        created_at_label: "August 29, 2026",
        raw_payload: {},
        received_at: "2026-08-29T14:35:00.000Z"
      },
      snapshotDate: "2026-08-29",
      teams: [ducks],
      rosterByTeam: new Map([[24, ducksRoster]])
    });

    expect(parsed).toMatchObject({
      team: ducks,
      classification: "power_play",
      nhlFilterStatus: "accepted",
      metadata: {
        powerPlayUnitLabels: ["pp1", "pp2"],
        powerPlayUnits: [
          [
            "Chris Kreider",
            "Leo Carlsson",
            "Troy Terry",
            "Mikael Granlund",
            "John Carlson"
          ],
          [
            "Beckett Sennecke",
            "Ryan Poehling",
            "Alex Killorn",
            "Cutter Gauthier",
            "Jackson LaCombe"
          ]
        ]
      }
    });
  });

  it("parses IFTTT text into rejected non-NHL candidates", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "3ee6b7f3-34ba-43c5-be59-6042b73d8d38",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text:
          "AHL Crunch lines\nAHL Crunch Starting Goalie: Jon Gillies https://t.co/aATPLL0aCx",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047809990422147403",
        tweet_id: "2047809990422147403",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:48PM",
        raw_payload: {},
        received_at: "2026-04-24T22:51:13.800Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map()
    });

    expect(parsed).toMatchObject({
      team: null,
      classification: "goalie_start",
      detectedLeague: "AHL",
      nhlFilterStatus: "rejected_non_nhl",
      nhlFilterReason: "explicit_non_nhl_league_marker",
      goalies: ["Jon Gillies"]
    });
  });

  it("rejects non-NHL content from minor-league source handles with an auditable reason", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "15d482fd-0d90-46ca-bdfd-5522e409c13d",
        source: "ifttt",
        source_account: "InsideAhlHockey",
        username: "InsideAhlHockey",
        text: "Crunch lines\nStarting Goalie: Jon Gillies",
        link_to_tweet: "https://twitter.com/InsideAhlHockey/status/2047809493590065526",
        tweet_id: "2047809493590065526",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:46PM",
        raw_payload: {},
        received_at: "2026-04-24T22:51:13.176Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map()
    });

    expect(parsed).toMatchObject({
      team: null,
      detectedLeague: "AHL",
      nhlFilterStatus: "rejected_non_nhl",
      nhlFilterReason: "minor_league_source_handle",
      metadata: {
        nonNhlSourceHandle: "insideahlhockey"
      }
    });
  });

  it("rejects multi-team NHL text as ambiguous when no single team can be resolved", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "ambiguous-nhl-example",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "Lightning and Canadiens morning skate notes",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
        tweet_id: "2047808711494902155",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:43PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.726Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster]
      ])
    });

    expect(parsed).toMatchObject({
      team: null,
      detectedLeague: null,
      nhlFilterStatus: "rejected_ambiguous",
      nhlFilterReason: "ambiguous_multiple_team_labels",
      metadata: {
        teamLabelMatches: ["MTL", "TBL"]
      }
    });
  });

  it("uses decisive roster density over a lone opponent team label", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "canadiens-french-lines-vs-lightning",
        source: "ifttt",
        source_account: "GameDayLines",
        username: "GameDayLines",
        text:
          "La formation du CH à l'échauffement avant ce 6e match contre le Lightning\n" +
          "Caufield-Suzuki-Anderson\n" +
          "Slafkovsky-Evans-Demidov\n" +
          "Bolduc-Dach-Texier\n" +
          "Newhook-Danault-Gallagher\n" +
          "Matheson-Carrier\n" +
          "Guhle-Hutson\n" +
          "Xhekaj-Struble\n" +
          "Dobes\n" +
          "Fowler",
        link_to_tweet: "https://twitter.com/source/status/2050344773027033540",
        tweet_id: "2050344773027033540",
        tweet_created_at: null,
        created_at_label: "May 2, 2026",
        raw_payload: {},
        received_at: "2026-05-02T12:31:07.000Z"
      },
      snapshotDate: "2026-05-02",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster]
      ])
    });

    expect(parsed).toMatchObject({
      team: { abbreviation: "MTL" },
      nhlFilterStatus: "accepted",
      metadata: {
        teamLabelMatches: ["TBL"]
      }
    });
    expect(parsed.matchedNames).toEqual(
      expect.arrayContaining(["Cole Caufield", "Nick Suzuki", "Josh Anderson"])
    );
  });

  it("captures injury and transaction signals when the text has return-style status updates", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "injury-transaction-example",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "Canadiens injury update: Patrik Laine returns, Kirby Dach activated from IR",
        link_to_tweet: "https://twitter.com/CcCMiddleton/status/2047811111111111111",
        tweet_id: "2047811111111111111",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 07:00PM",
        raw_payload: {},
        received_at: "2026-04-24T23:00:00.000Z"
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]])
    });

    expect(parsed).toMatchObject({
      team: canadiens,
      classification: "injury",
      injuries: ["Patrik Laine", "Kirby Dach"],
      metadata: {
        transactionSignals: expect.arrayContaining([
          { signal: "return", playerName: "Patrik Laine" },
          { signal: "activated", playerName: "Kirby Dach" }
        ])
      }
    });
  });

  it("shapes accepted NHL rows with stable keys, roster ids, and quote provenance", () => {
    const row = toLinesCccRow({
      source: {
        snapshotDate: "2026-04-24",
        observedAt: "2026-04-24T22:46:29.954Z",
        tweetPostedAt: "April 24, 2026 at 06:44PM",
        tweetPostedLabel: "April 24, 2026 at 06:44PM",
        gameId: 2025030111,
        team: canadiens!,
        sourceUrl: "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        sourceHandle: "CcCMiddleton",
        authorName: "LinesLinesLines",
        tweetId: "2047809041154625899",
        tweetUrl: "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        quotedTweetId: "2047808888888888888",
        quotedTweetUrl: "https://twitter.com/HabsSource/status/2047808888888888888",
        quotedAuthorHandle: "HabsSource",
        quotedAuthorName: "Habs Source",
        primaryTextSource: "quoted_oembed",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        rawText:
          "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
        quotedEnrichedText:
          "Slafkovsky - Suzuki - Caufield\nDemidov - Dach - Laine\nMatheson - Hutson\nJakub Dobes",
        keywordHits: ["lines", "starting goalie"],
        matchedPlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        matchedNames: [
          "Cole Caufield",
          "Nick Suzuki",
          "Juraj Slafkovsky",
          "Patrik Laine",
          "Kirby Dach",
          "Ivan Demidov",
          "Mike Matheson",
          "Lane Hutson",
          "Jakub Dobes"
        ],
        forwards: [
          ["Juraj Slafkovsky", "Nick Suzuki", "Cole Caufield"],
          ["Ivan Demidov", "Kirby Dach", "Patrik Laine"]
        ],
        defensePairs: [["Mike Matheson", "Lane Hutson"]],
        goalies: ["Jakub Dobes"],
        rawPayload: {
          eventId: "32244dec-1064-4913-a98b-2611bcc9ea75"
        },
        metadata: {
          sourceEventTable: "lines_ccc_ifttt_events"
        }
      },
      rosterEntries: canadiensRoster
    });

    expect(row).toMatchObject({
      capture_key:
        "2026-04-24:8:2025030111:2047809041154625899:2047808888888888888:lineup:accepted",
      status: "observed",
      nhl_filter_status: "accepted",
      detected_league: "NHL",
      team_id: 8,
      team_abbreviation: "MTL",
      tweet_id: "2047809041154625899",
      quoted_tweet_id: "2047808888888888888",
      primary_text_source: "quoted_oembed",
      tweet_posted_at: null,
      tweet_posted_label: "April 24, 2026 at 06:44PM",
      line_1_player_names: ["Cole Caufield", "Nick Suzuki", "Juraj Slafkovsky"],
      line_1_player_ids: [1, 2, 3],
      pair_1_player_names: ["Lane Hutson", "Mike Matheson"],
      pair_1_player_ids: [8, 7],
      goalie_1_name: "Jakub Dobes",
      goalie_1_player_id: 9,
      raw_payload: {
        eventId: "32244dec-1064-4913-a98b-2611bcc9ea75"
      }
    });
    expect(row.metadata).toMatchObject({
      storedSkaterOrder: ["RW", "C", "LW"],
      storedDefenseOrder: ["RD", "LD"],
      matchedNames: [
        "Cole Caufield",
        "Nick Suzuki",
        "Juraj Slafkovsky",
        "Patrik Laine",
        "Kirby Dach",
        "Ivan Demidov",
        "Mike Matheson",
        "Lane Hutson",
        "Jakub Dobes"
      ],
      unmatchedNames: [],
      primaryText:
        "Slafkovsky - Suzuki - Caufield\nDemidov - Dach - Laine\nMatheson - Hutson\nJakub Dobes",
      sourceEventTable: "lines_ccc_ifttt_events"
    });
  });

  it("stores rejected non-NHL rows without requiring a team", () => {
    const row = toLinesCccRow({
      source: {
        snapshotDate: "2026-04-24",
        observedAt: "2026-04-24T22:51:13.800Z",
        tweetPostedLabel: "April 24, 2026 at 06:48PM",
        tweetId: "2047809990422147403",
        tweetUrl: "https://twitter.com/CcCMiddleton/status/2047809990422147403",
        primaryTextSource: "ifttt_text",
        classification: "goalie_start",
        detectedLeague: "AHL",
        nhlFilterStatus: "rejected_non_nhl",
        nhlFilterReason: "explicit_non_nhl_league_marker",
        rawText:
          "AHL Crunch lines\nAHL Crunch Starting Goalie: Jon Gillies https://t.co/aATPLL0aCx",
        keywordHits: ["lines", "starting goalie"],
        goalies: ["Jon Gillies"]
      }
    });

    expect(row).toMatchObject({
      capture_key:
        "2026-04-24:no-team:no-game:2047809990422147403:no-quoted-tweet:goalie_start:rejected_non_nhl",
      status: "rejected",
      team_id: null,
      team_abbreviation: null,
      detected_league: "AHL",
      nhl_filter_status: "rejected_non_nhl",
      nhl_filter_reason: "explicit_non_nhl_league_marker",
      goalie_1_name: "Jon Gillies",
      goalie_1_player_id: null
    });
  });
});

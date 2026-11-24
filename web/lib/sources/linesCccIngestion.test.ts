// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import datedIdentity from "./fixtures/novemberSourceIdentity.json";
import { extractDurableTweetClaims } from "./tweetClaimExtraction";
import { reduceTweetSemanticEvents } from "./tweetSemanticEvents";
import { createHash } from "node:crypto";

import { buildTeamDirectory } from "./lineupSourceIngestion";
import { isVerifiedRelayQuoteSummary, quotedTweetFromFxtwitterPayload } from "./fxtwitterQueuePayload";
import { buildGoalieBlendFeatures, type LinesCccRow } from "../game-predictions/featureBuilder";
import { edmontonSectionRoster, edmontonSectionText, explicit11F7DText, seattleSectionRoster, seattleSectionText } from "../../__tests__/fixtures/lineupSectionFixtures";
import { completeEvenStrengthUnits, interpretTweetUnits, type TweetInterpretation } from "./tweetInterpretation";
import { collectUnresolvedNamesFromLineRows, reviewTweetApplicability } from "./lineSourceProcessing";
import {
  applyLinesCccWrapperOEmbed,
  applyQuotedTweetPreference,
  buildLinesCccWrapperOEmbedDeferredState,
  buildLinesCccSourceFromIftttEvent,
  expandLinesCccGoalieClaims,
  isDisputedRetainedProjectionSubject,
  buildLinesCccWrapperOEmbedSuccessState,
  fetchLinesCccTweetApiData,
  fetchLinesCccTweetOEmbedData,
  refreshLinesCccSourceFromPrimaryText,
  rejectInsufficientQuoteWrapper,
  readLinesCccWrapperOEmbedBackfillState,
  resolveLinesCccTeam,
  resolveLinesCccQuotedTweet,
  shouldAttemptLinesCccWrapperOEmbedBackfill,
  toLinesCccTweetOEmbedDataFromBackfillState,
  toLinesCccRow,
  tweetPublicationFromUrl,
  buildTweetSourceProvenance,
} from "./linesCccIngestion";

const [canadiens, lightning, utah] = buildTeamDirectory([
  {
    id: 8,
    name: "Montréal Canadiens",
    abbreviation: "MTL",
    logo: "/teamLogos/MTL.png",
  },
  {
    id: 14,
    name: "Tampa Bay Lightning",
    abbreviation: "TBL",
    logo: "/teamLogos/TBL.png",
  },
  {
    id: 59,
    name: "Utah Mammoth",
    abbreviation: "UTA",
    logo: "/teamLogos/UTA.png",
  },
]);

it("selects Paterson's actual return report and keeps both publications on the retained Fx carrier", () => {
  const author = "patersonjeff", id = "2121251629009957268", relay = "NHL_Rosters", carrier = "2121255950682304702";
  const url = `https://x.com/${author}/status/${id}`, link = `https://x.com/${relay}/status/${carrier}`;
  const posted = "2026-11-13T14:39:33.000Z", wrapperTime = "2026-11-13T14:56:44.000Z";
  const body = "Vancouver is expected to activate Filip Chytil today. #Canucks";
  const quoteText = "Filip Chytil is expected to return to #Canucks line-up tonight.";
  const teams = buildTeamDirectory([{ id: 23, abbreviation: "VAN", name: "Vancouver Canucks", logo: "" }]);
  const player = { playerId: 8480078, fullName: "Filip Chytil", lastName: "Chytil", teamId: 23 };
  const parse = (wrapper: string, original: string) => {
    const raw = { provider: "fxtwitter", fx: { id: carrier, author: { screen_name: relay }, raw_text: { text: wrapper }, created_timestamp: 1794581804 },
      quote: { id, url, author_handle: author, created_at: posted, text: original } };
    const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-13", teams, rosterByTeam: new Map([[23, [player]]]),
      event: { id: "3f9ef9a8-ef71-4037-b90f-4712990c801e", source: "fxtwitter", source_account: relay, username: relay,
        text: wrapper + " " + url, link_to_tweet: link, tweet_id: carrier, tweet_created_at: wrapperTime, created_at_label: null,
        received_at: "2026-11-13T14:58:06.558Z", raw_payload: raw } });
    return { source, quotedTweet: quotedTweetFromFxtwitterPayload(raw)! };
  };
  const input = parse(body, quoteText);
  expect(applyQuotedTweetPreference(input)).toMatchObject({ primaryTextSource: "quoted_oembed", tweetId: carrier,
    tweetPostedAt: posted, rawText: body + " " + url, quotedRawText: quoteText, quotedAuthorHandle: author,
    metadata: { wrapperPostedAt: wrapperTime, publicationTimeBasis: "provider_timestamp" } });
  const accepts = (wrapper: string, original: string) => {
    const { source, quotedTweet } = parse(wrapper, original);
    return isVerifiedRelayQuoteSummary(source, quotedTweet);
  };
  expect(accepts("#Leafs update.", "McWard and Mermis will play tonight for Toronto")).toBe(true);
  expect(accepts("#Leafs update.", quoteText)).toBe(false);
  expect(accepts(body, quoteText.replace("Chytil", "Boeser"))).toBe(false);
  expect(accepts(body, quoteText.replace("#Canucks", "#Leafs"))).toBe(false);
  expect(accepts("Correction: Chytil is out tonight.", quoteText)).toBe(false);
  for (const change of [{ quotedPostedAt: wrapperTime }, { quotedTweetUrl: link }, { quotedAuthorHandle: "other" },
    { quotedText: "Unrelated report" }, { quotedTweetId: carrier }]) {
    expect(isVerifiedRelayQuoteSummary(input.source, { ...input.quotedTweet, ...change })).toBe(false);
  }
  expect(isVerifiedRelayQuoteSummary({ ...input.source, sourceHandle: "other" }, input.quotedTweet)).toBe(false);
});

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
  { playerId: 31, fullName: "Alexandre Texier", lastName: "Texier" },
].map((player) => ({ ...player, teamId: 8, position: [9, 19].includes(player.playerId) ? "G" : [7, 8, 16, 17, 18, 20].includes(player.playerId) ? "D" : "F" }));
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
  { playerId: 30, fullName: "Jonas Johansson", lastName: "Johansson" },
].map((player) => ({ ...player, teamId: 14, position: [29, 30].includes(player.playerId) ? "G" : [27, 28].includes(player.playerId) ? "D" : "F" }));
const utahRoster = [
  { playerId: 40, fullName: "Karel Vejmelka", lastName: "Vejmelka" },
  { playerId: 41, fullName: "Clayton Keller", lastName: "Keller" },
];

describe("IFTTT section boundaries and role-safe storage", () => {
  const sourceFor = (text: string, roster: typeof seattleSectionRoster, teamId: number, enabled: boolean) => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", String(enabled));
    const [team] = buildTeamDirectory([{ id: teamId, name: teamId === 55 ? "Seattle Kraken" : "Edmonton Oilers", abbreviation: teamId === 55 ? "SEA" : "EDM", logo: "" }]);
    return buildLinesCccSourceFromIftttEvent({ event: { id: "section-fixture", source: "gamedaylines", source_account: "fixture", username: "fixture", text, link_to_tweet: null, tweet_id: null, tweet_created_at: null, created_at_label: null, raw_payload: { text }, received_at: "2026-10-13T16:00:00Z" }, snapshotDate: "2026-10-13", teams: [team], rosterByTeam: new Map([[teamId, roster]]) });
  };
  afterEach(() => vi.unstubAllEnvs());
  it.each([false, true])("stores the exact Seattle slash fixture without inventing goalies or confirmed absence: interpretation %s", (enabled) => {
    const source = sourceFor(seattleSectionText, seattleSectionRoster, 55, enabled);
    expect(source.rawText).toBe(seattleSectionText);
    expect(source.rawPayload).toEqual({ text: seattleSectionText });
    expect(source.forwards).toHaveLength(4); expect(source.defensePairs).toHaveLength(3);
    expect(source.scratches).toEqual(["Fixture Douglas", "Fixture Fleury"]);
    expect(source.goalies).toEqual([]); expect(source.injuries).toEqual([]);
    const observations = enabled ? (source.metadata!.interpretation as TweetInterpretation).events : source.metadata!.participationObservations;
    expect(observations).toMatchObject([{ playerId: 1, kind: "participation", state: "observed", availability: "unknown", modality: "negated", times: { applicability: "unresolved", observation: null } }]);
    const row = toLinesCccRow({ source, rosterEntries: seattleSectionRoster });
    expect(row.goalie_1_player_id).toBeNull(); expect(row.goalie_2_player_id).toBeNull();
    expect(row.pair_1_player_ids).toEqual([201, 200]);
  });
  it.each([false, true])("does not shift Edmonton defense or goalie columns: interpretation %s", (enabled) => {
    const source = sourceFor(edmontonSectionText, edmontonSectionRoster, 22, enabled);
    expect(source.classification).toBe("practice_lines");
    expect(source.defensePairs).toEqual([["Fixture Ekholm", "Fixture Bouchard"], ["Fixture Shea", "Fixture Murphy"], ["Fixture Mukhamadullin", "Fixture Emberson"]]);
    expect(source.goalies).toEqual(["Fixture Levi", "Fixture Jarry"]);
    const row = toLinesCccRow({ source, rosterEntries: edmontonSectionRoster });
    expect(row.pair_1_player_ids).toEqual([201, 200]);
    expect(row.pair_3_player_ids).toEqual([205, 204]);
    expect(row.goalie_1_player_id).toBe(300); expect(row.goalie_2_player_id).toBe(301);
    if (enabled) expect((source.metadata!.interpretation as TweetInterpretation).events).toEqual([]);
  });
  it.each([false, true])("withholds all role columns when positions are unknown: interpretation %s", (enabled) => {
    const source = sourceFor(edmontonSectionText, edmontonSectionRoster.map((player) => ({ ...player, position: null })), 22, enabled);
    expect(source.forwards).toEqual([]); expect(source.defensePairs).toEqual([]); expect(source.goalies).toEqual([]);
    if (enabled) expect(completeEvenStrengthUnits(source.metadata!.interpretation as TweetInterpretation)).toEqual([]);
  });
  it("retains the full explicitly declared 11F-7D formation in interpretation metadata", () => {
    const source = sourceFor(explicit11F7DText, edmontonSectionRoster, 22, true);
    expect(source.forwards?.map((line) => line.length)).toEqual([3, 3, 3, 2]);
    expect(source.defensePairs?.map((line) => line.length)).toEqual([2, 2, 2, 1]);
    expect(completeEvenStrengthUnits(source.metadata!.interpretation as TweetInterpretation)).toHaveLength(8);
    expect(source.goalies).toEqual(["Fixture Levi", "Fixture Jarry"]);
  });
  it("filters a labelled position contradiction before serializing any unit", () => {
    const text = "@EdmontonOilers\nDefense:\nJones-Hyman\n\nD1: Ekholm-Bouchard\nGoalies:\nWalman";
    const source = sourceFor(text, edmontonSectionRoster, 22, true);
    expect(source.defensePairs).toEqual([["Fixture Ekholm", "Fixture Bouchard"]]);
    expect(source.goalies).toEqual([]);
    expect(toLinesCccRow({ source, rosterEntries: edmontonSectionRoster }).pair_1_player_ids).toEqual([201, 200]);
  });
  it.each([false, true])("stores shared names by slot: Hughes in a line and a pair, two Elias Petterssons: interpretation %s", (enabled) => {
    const players = ([
      [1, "Jesper Bratt", "Bratt", "L"], [2, "Nico Hischier", "Hischier", "C"], [3, "Timo Meier", "Meier", "R"],
      [4, "Dawson Mercer", "Mercer", "C"], [5, "Jack Hughes", "Hughes", "C"], [6, "Ondrej Palat", "Palat", "L"],
      [7, "Paul Cotter", "Cotter", "C"], [8, "Elias Pettersson", "Pettersson", "C"], [9, "Connor Brown", "Brown", "R"],
      [10, "Evgenii Dadonov", "Dadonov", "R"], [11, "Erik Haula", "Haula", "C"], [12, "Stefan Noesen", "Noesen", "R"],
      [20, "Luke Hughes", "Hughes", "D"], [21, "Dougie Hamilton", "Hamilton", "D"], [22, "Jonas Siegenthaler", "Siegenthaler", "D"],
      [23, "Brett Pesce", "Pesce", "D"], [24, "Simon Nemec", "Nemec", "D"], [25, "Elias Pettersson", "Pettersson", "D"],
    ] as const).map(([playerId, fullName, lastName, position]) => ({ playerId, fullName, lastName, position, teamId: 22 }));
    const text = "@EdmontonOilers lines tonight:\nBratt-Hischier-Meier\nMercer-Hughes-Palat\nCotter-Elias Pettersson-Brown\nDadonov-Haula-Noesen\n\nHughes-Hamilton\nSiegenthaler-Pesce\nNemec-Elias Pettersson";
    const source = sourceFor(text, players, 22, enabled);
    const row = toLinesCccRow({ source, rosterEntries: players });
    expect(row.line_2_player_ids).toEqual([6, 5, 4]);
    expect(row.line_3_player_ids).toEqual([9, 8, 7]);
    expect(row.pair_1_player_ids).toEqual([21, 20]);
    expect(row.pair_3_player_ids).toEqual([25, 24]);
  });
  it.each(["unknown position", "conflicting team", "headed contradiction", "numbered contradiction"])("leaves invalid source line 1 empty and stores source line 2 in its own slot: %s", (condition) => {
    const players = edmontonSectionRoster.map((player, index) => ({ ...player,
      position: condition === "unknown position" && index === 0 ? null : player.position,
      teamId: condition === "conflicting team" && index === 0 ? 30 : player.teamId }));
    const text = condition.endsWith("contradiction")
      ? `@EdmontonOilers\n${condition === "numbered contradiction" ? "F1:" : "Forwards:"}\nEkholm-McDavid-Draisaitl\nHallander-Dickinson-Kapanen`
      : edmontonSectionText;
    const source = sourceFor(text, players, 22, true);
    const row = toLinesCccRow({ source, rosterEntries: players });
    expect(row.line_1_player_names).toBeNull(); expect(row.line_1_player_ids).toBeNull();
    expect(row.line_2_player_names).toEqual(["Fixture Kapanen", "Fixture Dickinson", "Fixture Hallander"]);
    expect(row.line_2_player_ids).toEqual([105, 104, 103]);
  });
});

describe("linesCccIngestion", () => {
  it("normalizes only explicit-timezone X API created-at timestamps", async () => {
    vi.stubEnv("X_API_BEARER_TOKEN", "test-bearer-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "2047808467969220779",
            text: "Lightning lines",
            author_id: "author-1",
            created_at: "2026-04-24T18:44:00.000Z",
          },
          includes: {
            users: [
              {
                id: "author-1",
                name: "Benjamin Piercey",
                username: "BenjaminJReport",
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "2047808467969220779",
            text: "Lightning lines",
            created_at: "Apr 24, 2026 6:44 PM",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchLinesCccTweetApiData("2047808467969220779"),
    ).resolves.toMatchObject({
      text: "Lightning lines",
      postedAt: "2026-04-24T18:44:00.000Z",
      authorName: "Benjamin Piercey",
      authorHandle: "BenjaminJReport",
    });
    await expect(
      fetchLinesCccTweetApiData("2047808467969220779"),
    ).resolves.toMatchObject({
      text: "Lightning lines",
      postedAt: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-bearer-token",
        }),
      }),
    );

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

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
          author_url: "https://twitter.com/CcCMiddleton",
        }),
      }),
    );

    await expect(
      fetchLinesCccTweetOEmbedData(
        "https://x.com/CcCMiddleton/status/2047808711494902155",
      ),
    ).resolves.toEqual({
      text: "Lightning lines\nhttps://t.co/9cZkBXydVn",
      postedAt: "2026-04-24T22:43:37.923Z",
      postedLabel: "Apr 24, 2026",
      sourceTweetUrl:
        "https://twitter.com/CcCMiddleton/status/2047808711494902155",
      authorName: "LinesLinesLines",
      authorHandle: "CcCMiddleton",
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
        nextAttemptAt: "2026-04-24T12:10:00.000Z",
      },
      nowIso: "2026-04-24T13:00:00.000Z",
      httpStatus: 429,
      error: "oembed_http_429",
    });

    expect(deferred).toMatchObject({
      status: "deferred_429",
      attemptCount: 3,
      httpStatus: 429,
      lastError: "oembed_http_429",
      nextAttemptAt: "2026-04-24T13:20:00.000Z",
    });
  });

  it("uses cached wrapper oEmbed success state and skips new attempts until due", () => {
    const state = readLinesCccWrapperOEmbedBackfillState({
      linesCccOembed: {
        wrapper: {
          status: "success",
          tweetId: "2047808711494902155",
          tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
          sourceTweetUrl:
            "https://twitter.com/CcCMiddleton/status/2047808711494902155",
          attemptCount: 1,
          lastAttemptAt: "2026-04-24T12:00:00.000Z",
          fetchedAt: "2026-04-24T12:00:00.000Z",
          text: "Lightning lines",
          postedLabel: "Apr 24, 2026",
          authorName: "LinesLinesLines",
          authorHandle: "CcCMiddleton",
        },
      },
    });

    expect(
      shouldAttemptLinesCccWrapperOEmbedBackfill({
        tweetId: "2047808711494902155",
        tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
        existingState: state,
        nowIso: "2026-04-24T12:30:00.000Z",
      }),
    ).toBe(false);

    expect(toLinesCccTweetOEmbedDataFromBackfillState(state)).toMatchObject({
      text: "Lightning lines",
      postedLabel: "Apr 24, 2026",
      authorHandle: "CcCMiddleton",
    });
  });

  it("resolves NHL teams from known source handles when text labels are absent", () => {
    expect(
      resolveLinesCccTeam({
        text: "Starting Goalie: Andrei Vasilevskiy",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
        sourceHandles: ["TBLightning"],
      }),
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL",
    });
  });

  it("resolves NHL teams from roster density when text labels are absent", () => {
    expect(
      resolveLinesCccTeam({
        text: "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
      }),
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL",
    });
  });

  it("uses the leading team nickname before vs when both teams are mentioned", () => {
    expect(
      resolveLinesCccTeam({
        text: "#Habs lines vs #Lightning\nCaufield - Suzuki - Slafkovsky",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
      }),
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL",
    });
  });

  it("does not let conflicting lead-vs text outweigh stronger roster evidence", () => {
    expect(
      resolveLinesCccTeam({
        text: "Lightning lines vs #Habs\nCaufield - Suzuki - Slafkovsky\nMatheson - Hutson",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
      }),
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL",
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
          [59, utahRoster],
        ]),
        classification: "goalie_start",
      }),
    ).toMatchObject({
      id: 59,
      abbreviation: "UTA",
    });
  });

  it("rejects injury tweets with only a last-name match and no team support", () => {
    expect(
      resolveLinesCccTeam({
        text: "Dach returns tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
        classification: "injury",
      }),
    ).toBeNull();
  });

  it("accepts injury tweets on a full-name match even without a team label", () => {
    expect(
      resolveLinesCccTeam({
        text: "Patrik Laine returns tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
        classification: "injury",
      }),
    ).toMatchObject({
      id: 8,
      abbreviation: "MTL",
    });
  });

  it("accepts goalie-start tweets on a full-name match even without a team label", () => {
    expect(
      resolveLinesCccTeam({
        text: "Andrei Vasilevskiy gets the start tonight",
        teams: [canadiens!, lightning!],
        rosterByTeam: new Map([
          [8, canadiensRoster],
          [14, lightningRoster],
        ]),
        classification: "goalie_start",
      }),
    ).toMatchObject({
      id: 14,
      abbreviation: "TBL",
    });
  });

  // DFO relays RotoWire items: "Cole Reinhardt: Line Change: Reinhardt will draw back into the lineup vs. Washington"
  // was filed under Washington (tweet 2119115655333232899). The opponent is not the subject.
  it("files a lead-player news item under the player's team, not the opponent after vs.", () => {
    const rosterByTeam = new Map([[8, canadiensRoster], [14, lightningRoster]]);
    const teams = [canadiens!, lightning!];
    expect(resolveLinesCccTeam({ teams, rosterByTeam, classification: "lineup",
      text: "Josh Anderson: Line Change: Anderson will draw back into the lineup vs. Tampa Bay on Saturday. pic.twitter.com/bgm84UL8C6" }))
      .toMatchObject({ id: 8 });
    expect(resolveLinesCccTeam({ teams, rosterByTeam, classification: "lineup",
      text: "Brayden Point: Line Change: Point is expected to draw back into the lineup against the Canadiens on Saturday." }))
      .toMatchObject({ id: 14 });
  });

  it("does not use the lead player to override a team named outside an opponent cue", () => {
    const rosterByTeam = new Map([[8, canadiensRoster], [14, lightningRoster]]);
    expect(resolveLinesCccTeam({ teams: [canadiens!, lightning!], rosterByTeam, classification: "lineup",
      text: "Josh Anderson: Line Change: Anderson was traded to Tampa Bay on Saturday." })?.id).not.toBe(8);
  });

  it("refreshes team and roster fields from enriched Habs-vs-Lightning text", () => {
    const source = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "event-habs",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "Lightning lines https://t.co/example",
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047814982583414912",
        tweet_id: "2047814982583414912",
        tweet_created_at: null,
        created_at_label: "April 24, 2026",
        raw_payload: {},
        received_at: "2026-04-24T22:00:00.000Z",
      },
      snapshotDate: "2026-04-25",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster],
      ]),
    });
    const refreshed = refreshLinesCccSourceFromPrimaryText({
      source: {
        ...source,
        enrichedText:
          "#Habs lines vs #Lightning\nCaufield - Suzuki - Slafkovsky\nMatheson - Hutson",
        sourceHandle: "ChrisHabs360",
        authorName: "ChrisHabs360",
        primaryTextSource: "wrapper_oembed",
      },
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster],
      ]),
    });

    expect(refreshed.team).toMatchObject({
      id: 8,
      abbreviation: "MTL",
    });
    expect(refreshed.forwards?.[0]).toEqual([
      "Cole Caufield",
      "Nick Suzuki",
      "Juraj Slafkovsky",
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
                : null,
          },
          url: "https://t.co/9cZkBXydVn",
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
            author_url: "https://twitter.com/BenjaminJReport",
          }),
        }),
    );

    await expect(
      resolveLinesCccQuotedTweet({
        wrapperText: "Lightning lines https://t.co/9cZkBXydVn",
      }),
    ).resolves.toEqual({
      quotedTweetId: "2047808467969220779",
      quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
      quotedText:
        "The #GoBolts lines unchanged in warmups:\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
      quotedPostedAt: "2026-04-24T22:42:39.862Z",
      quotedPostedLabel: "Apr 24, 2026",
      quotedSourceTweetUrl:
        "https://twitter.com/BenjaminJReport/status/2047808467969220779",
      quotedAuthorName: "Benjamin Piercey",
      quotedAuthorHandle: "BenjaminJReport",
      resolvedUrl:
        "https://twitter.com/BenjaminJReport/status/2047808467969220779",
      shortUrl: "https://t.co/9cZkBXydVn",
      retrievalStatus: "oembed_success",
    });

    vi.unstubAllGlobals();
  });

  it("retains nested tweet identity when both API and oEmbed content are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "location"
                ? "https://twitter.com/NHLBlackhawks/status/2074932007746842910"
                : null,
          },
          url: "https://t.co/4qdCIOMuSt",
        })
        .mockResolvedValueOnce({ ok: false, status: 404 }),
    );

    await expect(
      resolveLinesCccQuotedTweet({
        wrapperText:
          "Puts a return around late October-ish… https://t.co/4qdCIOMuSt",
      }),
    ).resolves.toEqual({
      quotedTweetId: "2074932007746842910",
      quotedTweetUrl: "https://twitter.com/i/web/status/2074932007746842910",
      quotedText: null,
      quotedPostedAt: null,
      quotedPostedLabel: null,
      quotedSourceTweetUrl:
        "https://twitter.com/NHLBlackhawks/status/2074932007746842910",
      quotedAuthorName: null,
      quotedAuthorHandle: "NHLBlackhawks",
      resolvedUrl:
        "https://twitter.com/NHLBlackhawks/status/2074932007746842910",
      shortUrl: "https://t.co/4qdCIOMuSt",
      retrievalStatus: "resolved_url_only",
    });

    vi.unstubAllGlobals();
  });

  it("prefers quoted tweet text when the wrapper is only a headline plus t.co link", () => {
    const preferred = applyQuotedTweetPreference({
      source: {
        snapshotDate: "2026-04-25",
        tweetPostedAt: "2026-04-25T19:00:00.000Z",
        observedAt: "2026-04-25T19:01:00.000Z",
        rawText: "Lightning lines https://t.co/9cZkBXydVn",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
      },
      quotedTweet: {
        quotedTweetId: "2047808467969220779",
        quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
        quotedText:
          "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
        quotedPostedAt: "2026-04-24T00:00:00.000Z",
        quotedPostedLabel: "Apr 24, 2026",
        quotedSourceTweetUrl:
          "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        quotedAuthorName: "Benjamin Piercey",
        quotedAuthorHandle: "BenjaminJReport",
        resolvedUrl:
          "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        shortUrl: "https://t.co/9cZkBXydVn",
        retrievalStatus: "oembed_success",
      },
    });

    expect(preferred).toMatchObject({
      primaryTextSource: "quoted_oembed",
      tweetPostedAt: "2026-04-24T22:42:39.862Z",
      observedAt: "2026-04-25T19:01:00.000Z",
      quotedTweetId: "2047808467969220779",
      quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
      quotedRawText:
        "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
      quotedEnrichedText:
        "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nVasilevskiy\nJohansson",
      metadata: {
        preferredQuotedTweet: true,
        wrapperPostedAt: "2026-04-25T19:00:00.000Z",
        publicationTimeBasis: "tweet_id_or_unknown",
        primaryTextSource: "quoted_oembed",
        primarySourceUrl:
          "https://twitter.com/i/web/status/2047808467969220779",
        quotedSourceTweetUrl:
          "https://twitter.com/BenjaminJReport/status/2047808467969220779",
      },
    });
  });

  it("applies wrapper oEmbed content as cached enriched text and metadata", () => {
    const source = applyLinesCccWrapperOEmbed({
      source: {
        snapshotDate: "2026-04-25",
        tweetPostedAt: "2026-04-24T22:43:38.000Z",
        rawText: "Lightning lines https://t.co/9cZkBXydVn",
        tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        metadata: {},
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
            sourceTweetUrl:
              "https://twitter.com/CcCMiddleton/status/2047808711494902155",
            authorName: "LinesLinesLines",
            authorHandle: "CcCMiddleton",
          },
        }),
      )!,
    });

    expect(source).toMatchObject({
      enrichedText: "Lightning lines\nGoncalves-Point-Kucherov",
      tweetPostedAt: "2026-04-24T22:43:38.000Z",
      primaryTextSource: "wrapper_oembed",
      sourceUrl: "https://twitter.com/CcCMiddleton/status/2047808711494902155",
      authorName: "LinesLinesLines",
      sourceHandle: "CcCMiddleton",
      metadata: {
        primaryTextSource: "wrapper_oembed",
        primarySourceUrl:
          "https://twitter.com/i/web/status/2047808711494902155",
      },
    });
  });

  it("keeps wrapper text primary when it already has richer structure than the quote", () => {
    const preferred = applyQuotedTweetPreference({
      source: {
        snapshotDate: "2026-04-25",
        rawText:
          "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
        primaryTextSource: "ifttt_text",
        classification: "lineup",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        metadata: {},
      },
      quotedTweet: {
        quotedTweetId: "2047808467969220779",
        quotedTweetUrl: "https://twitter.com/i/web/status/2047808467969220779",
        quotedText: "Lightning lines",
        quotedPostedAt: "2026-04-24T00:00:00.000Z",
        quotedPostedLabel: "Apr 24, 2026",
        quotedSourceTweetUrl:
          "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        quotedAuthorName: "Benjamin Piercey",
        quotedAuthorHandle: "BenjaminJReport",
        resolvedUrl:
          "https://twitter.com/BenjaminJReport/status/2047808467969220779",
        shortUrl: null,
        retrievalStatus: "oembed_success",
      },
    });

    expect(preferred.primaryTextSource).toBe("ifttt_text");
    expect(preferred.metadata).toMatchObject({
      primaryTextSource: "ifttt_text",
      primaryText:
        "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
      quotedSourceTweetUrl:
        "https://twitter.com/BenjaminJReport/status/2047808467969220779",
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
        metadata: {},
      },
      quotedTweet: null,
    });

    expect(rejected).toMatchObject({
      nhlFilterStatus: "rejected_insufficient_text",
      nhlFilterReason: "unresolved_quoted_tweet",
      metadata: {
        unresolvedQuotedTweet: true,
      },
    });
  });

  it("does not reject direct goalie wrappers that still contain useful wrapper text", () => {
    const preserved = rejectInsufficientQuoteWrapper({
      source: {
        snapshotDate: "2026-04-25",
        rawText:
          "confirmed Lightning Starting Goalie: Andrei Vasilevskiy https://t.co/SGBBO1KIsp",
        primaryTextSource: "ifttt_text",
        classification: "goalie_start",
        detectedLeague: "NHL",
        nhlFilterStatus: "accepted",
        matchedPlayerIds: [7],
        metadata: {},
      },
      quotedTweet: null,
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
        text: "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        tweet_id: "2047809041154625899",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:44PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.954Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]]),
      gameIdByTeamId: new Map([[8, 2025030111]]),
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
          wrapperTweetUrl:
            "https://twitter.com/i/web/status/2047809041154625899",
          quotedTweetUrl: null,
          sourceUrl: "https://twitter.com/i/web/status/2047809041154625899",
        },
      },
    });
  });

  it("does not read the words power play as a mention of Owen Power", () => {
    const [sabres] = buildTeamDirectory([{ id: 7, name: "Buffalo Sabres", abbreviation: "BUF", logo: "/teamLogos/BUF.png" }]);
    const sabresRoster = [
      { playerId: 71, fullName: "Jiri Kulich", lastName: "Kulich", position: "C" },
      { playerId: 72, fullName: "Konsta Helenius", lastName: "Helenius", position: "C" },
      { playerId: 73, fullName: "Ryan McLeod", lastName: "McLeod", position: "C" },
      { playerId: 74, fullName: "Josh Doan", lastName: "Doan", position: "R" },
      { playerId: 75, fullName: "Peyton Krebs", lastName: "Krebs", position: "C" },
      { playerId: 76, fullName: "Owen Power", lastName: "Power", position: "D" },
      { playerId: 77, fullName: "Rasmus Dahlin", lastName: "Dahlin", position: "D" },
    ];
    const parse = (text: string) => buildLinesCccSourceFromIftttEvent({
      event: { id: `power-${text.length}`, source: "ifttt", source_account: "BuffaloSabres", username: "BuffaloSabres", text, link_to_tweet: null, tweet_id: null, tweet_created_at: null, created_at_label: null, raw_payload: {}, received_at: "2026-11-06T16:00:00Z" },
      snapshotDate: "2026-11-06",
      teams: [sabres!],
      rosterByTeam: new Map([[7, sabresRoster]]),
    });

    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    try {
      for (const text of [
        "Sabres: Kuluch and Krebs are now on tge No. 2 power play unit for McLeod and Doan",
        "Sabres: Kulich and Krebs are now on the second power-play unit for McLeod and Doan",
        "Sabres: Power play units today. Kulich and Krebs replace McLeod and Doan",
        "Sabres: kulich and krebs move to the second power unit for mcleod and doan",
      ]) {
        const parsed = parse(text);
        const interpretation = parsed.metadata?.interpretation as { events: Array<{ playerId: number }>; identityContext: { eventRosterRevision: string } };
        expect(parsed.matchedPlayerIds).not.toContain(76);
        expect(parsed.matchedNames).not.toContain("Owen Power");
        expect(interpretation.events.map((event) => event.playerId)).not.toContain(76);
        expect(interpretation.identityContext.eventRosterRevision).not.toContain("Owen Power");
      }
    } finally { vi.unstubAllEnvs(); }
    for (const text of [
      "Sabres: Owen Power is back on the top unit with Krebs, McLeod and Doan",
      "Sabres: Power (BUF D) returns to the top unit with Krebs, McLeod and Doan",
      "Sabres D: Power-Dahlin together again with Krebs, McLeod and Doan up front",
      "Sabres: power plays 24 minutes again with krebs, mcleod and doan on the top unit",
    ]) {
      expect(parse(text).matchedPlayerIds).toContain(76);
    }
    expect(parse("Sabres: kulich and krebs are now on the top unit for mcleod and doan").matchedPlayerIds).toEqual(expect.arrayContaining([71, 73, 74, 75]));
  });

  it("parses direct structured lineup text into forwards, pairs, and goalies", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "lightning-lines-direct",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "Lightning lines\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nMcDonagh-Cernak\nVasilevskiy\nJohansson",
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047808711494902155",
        tweet_id: "2047808711494902155",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:43PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.726Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster],
      ]),
    });

    expect(parsed).toMatchObject({
      team: lightning,
      classification: "lineup",
      nhlFilterStatus: "accepted",
      forwards: [
        ["Gage Goncalves", "Brayden Point", "Nikita Kucherov"],
        ["Brandon Hagel", "Anthony Cirelli", "Jake Guentzel"],
      ],
      defensePairs: [["Ryan McDonagh", "Erik Cernak"]],
      goalies: ["Andrei Vasilevskiy", "Jonas Johansson"],
    });
  });

  it("parses keywordless beat-writer lineup blocks through roster density and separator patterns", () => {
    const vegas = buildTeamDirectory([
      {
        id: 54,
        name: "Vegas Golden Knights",
        abbreviation: "VGK",
        logo: "/teamLogos/VGK.png",
      },
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
      {
        playerId: 10,
        fullName: "Cole Smith",
        lastName: "Smith",
        aliases: ["C Smith"],
      },
      { playerId: 11, fullName: "Nic Dowd", lastName: "Dowd" },
      { playerId: 12, fullName: "Colton Sissons", lastName: "Sissons" },
      { playerId: 13, fullName: "Brayden McNabb", lastName: "McNabb" },
      { playerId: 14, fullName: "Shea Theodore", lastName: "Theodore" },
      { playerId: 15, fullName: "Noah Hanifin", lastName: "Hanifin" },
      { playerId: 16, fullName: "Rasmus Andersson", lastName: "Andersson" },
      { playerId: 17, fullName: "Ben Hutton", lastName: "Hutton" },
      { playerId: 18, fullName: "Kaedan Korczak", lastName: "Korczak" },
      { playerId: 19, fullName: "Carter Hart", lastName: "Hart" },
    ].map((player) => ({ ...player, teamId: 54, position: player.playerId === 19 ? "G" : player.playerId >= 13 ? "D" : "F" }));
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
        link_to_tweet:
          "https://twitter.com/BeatWriterVGK/status/2052196164116893794",
        tweet_id: "2052196164116893794",
        tweet_created_at: null,
        created_at_label: "August 29, 2026",
        raw_payload: {},
        received_at: "2026-08-29T14:30:00.000Z",
      },
      snapshotDate: "2026-08-29",
      teams: [vegas],
      rosterByTeam: new Map([[54, vegasRoster]]),
    });

    expect(parsed).toMatchObject({
      team: vegas,
      classification: "lineup",
      nhlFilterStatus: "accepted",
      forwards: [
        ["Ivan Barbashev", "Jack Eichel", "Pavel Dorofeyev"],
        ["Brett Howden", "Mitchell Marner", "Mark Stone"],
        ["Tomas Hertl", "William Karlsson", "Keegan Kolesar"],
        ["Cole Smith", "Nic Dowd", "Colton Sissons"],
      ],
      defensePairs: [
        ["Brayden McNabb", "Shea Theodore"],
        ["Noah Hanifin", "Rasmus Andersson"],
        ["Ben Hutton", "Kaedan Korczak"],
      ],
      goalies: ["Carter Hart"],
    });
  });

  it("flags keyworded power-play text only when it resolves to five-player units", () => {
    const ducks = buildTeamDirectory([
      {
        id: 24,
        name: "Anaheim Ducks",
        abbreviation: "ANA",
        logo: "/teamLogos/ANA.png",
      },
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
      { playerId: 10, fullName: "Jackson LaCombe", lastName: "LaCombe" },
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
        link_to_tweet:
          "https://twitter.com/BeatWriterANA/status/2052196164116893795",
        tweet_id: "2052196164116893795",
        tweet_created_at: null,
        created_at_label: "August 29, 2026",
        raw_payload: {},
        received_at: "2026-08-29T14:35:00.000Z",
      },
      snapshotDate: "2026-08-29",
      teams: [ducks],
      rosterByTeam: new Map([[24, ducksRoster]]),
    });

    expect(parsed).toMatchObject({
      team: ducks,
      classification: "power_play",
      nhlFilterStatus: "accepted",
      metadata: {
        powerPlayUnitLabels: [null, null],
        powerPlayUnits: [
          [
            "Chris Kreider",
            "Leo Carlsson",
            "Troy Terry",
            "Mikael Granlund",
            "John Carlson",
          ],
          [
            "Beckett Sennecke",
            "Ryan Poehling",
            "Alex Killorn",
            "Cutter Gauthier",
            "Jackson LaCombe",
          ],
        ],
      },
    });
  });

  it("parses IFTTT text into rejected non-NHL candidates", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "3ee6b7f3-34ba-43c5-be59-6042b73d8d38",
        source: "ifttt",
        source_account: "CcCMiddleton",
        username: "CcCMiddleton",
        text: "AHL Crunch lines\nAHL Crunch Starting Goalie: Jon Gillies https://t.co/aATPLL0aCx",
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047809990422147403",
        tweet_id: "2047809990422147403",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:48PM",
        raw_payload: {},
        received_at: "2026-04-24T22:51:13.800Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map(),
    });

    expect(parsed).toMatchObject({
      team: null,
      classification: "goalie_start",
      detectedLeague: "AHL",
      nhlFilterStatus: "rejected_non_nhl",
      nhlFilterReason: "explicit_non_nhl_league_marker",
      goalies: [],
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
        link_to_tweet:
          "https://twitter.com/InsideAhlHockey/status/2047809493590065526",
        tweet_id: "2047809493590065526",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:46PM",
        raw_payload: {},
        received_at: "2026-04-24T22:51:13.176Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map(),
    });

    expect(parsed).toMatchObject({
      team: null,
      detectedLeague: "AHL",
      nhlFilterStatus: "rejected_non_nhl",
      nhlFilterReason: "minor_league_source_handle",
      metadata: {
        nonNhlSourceHandle: "insideahlhockey",
      },
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
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047808711494902155",
        tweet_id: "2047808711494902155",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 06:43PM",
        raw_payload: {},
        received_at: "2026-04-24T22:46:29.726Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster],
      ]),
    });

    expect(parsed).toMatchObject({
      team: null,
      detectedLeague: null,
      nhlFilterStatus: "rejected_ambiguous",
      nhlFilterReason: "ambiguous_multiple_team_labels",
      metadata: {
        teamLabelMatches: ["MTL", "TBL"],
      },
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
        received_at: "2026-05-02T12:31:07.000Z",
      },
      snapshotDate: "2026-05-02",
      teams: [canadiens!, lightning!],
      rosterByTeam: new Map([
        [8, canadiensRoster],
        [14, lightningRoster],
      ]),
    });

    expect(parsed).toMatchObject({
      team: { abbreviation: "MTL" },
      nhlFilterStatus: "accepted",
      metadata: {
        teamLabelMatches: ["TBL"],
      },
    });
    expect(parsed.matchedNames).toEqual(
      expect.arrayContaining(["Cole Caufield", "Nick Suzuki", "Josh Anderson"]),
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
        link_to_tweet:
          "https://twitter.com/CcCMiddleton/status/2047811111111111111",
        tweet_id: "2047811111111111111",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 07:00PM",
        raw_payload: {},
        received_at: "2026-04-24T23:00:00.000Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]]),
    });

    expect(parsed).toMatchObject({
      team: canadiens,
      classification: "injury",
      injuries: ["Patrik Laine", "Kirby Dach"],
      metadata: {
        transactionSignals: expect.arrayContaining([
          { signal: "return", playerName: "Patrik Laine" },
          { signal: "activated", playerName: "Kirby Dach" },
        ]),
      },
    });
  });

  it("stores explicit roster-move signals as canonical-player metadata", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "roster-move-example",
        source: "ifttt",
        source_account: "GameDayNewsNHL",
        username: "GameDayNewsNHL",
        text: "Canadiens recalled Kirby Dach. Patrik Laine was assigned to Laval. Nick Suzuki is a healthy scratch. Cole Caufield was placed on IR.",
        link_to_tweet:
          "https://twitter.com/GameDayNewsNHL/status/2047812222222222222",
        tweet_id: "2047812222222222222",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 08:00PM",
        raw_payload: {},
        received_at: "2026-04-25T00:00:00.000Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]]),
    });

    expect(parsed).toMatchObject({
      team: canadiens,
      metadata: {
        transactionSignals: expect.arrayContaining([
          { signal: "called_up", playerName: "Kirby Dach" },
          { signal: "sent_down", playerName: "Patrik Laine" },
          { signal: "healthy_scratch", playerName: "Nick Suzuki" },
          { signal: "ir", playerName: "Cole Caufield" },
        ]),
      },
    });
  });

  it("stores explicit trade, waiver, and signing signals as canonical-player metadata", () => {
    const parsed = buildLinesCccSourceFromIftttEvent({
      event: {
        id: "roster-transaction-example",
        source: "ifttt",
        source_account: "GameDayNewsNHL",
        username: "GameDayNewsNHL",
        text: "Canadiens traded Kirby Dach. Patrik Laine was claimed off waivers. Nick Suzuki signed a contract extension.",
        link_to_tweet:
          "https://twitter.com/GameDayNewsNHL/status/2047813333333333333",
        tweet_id: "2047813333333333333",
        tweet_created_at: null,
        created_at_label: "April 24, 2026 at 08:30PM",
        raw_payload: {},
        received_at: "2026-04-25T00:30:00.000Z",
      },
      snapshotDate: "2026-04-24",
      teams: [canadiens!],
      rosterByTeam: new Map([[8, canadiensRoster]]),
    });

    expect(parsed).toMatchObject({
      team: canadiens,
      metadata: {
        transactionSignals: expect.arrayContaining([
          { signal: "trade", playerName: "Kirby Dach" },
          { signal: "waiver", playerName: "Patrik Laine" },
          { signal: "signing", playerName: "Nick Suzuki" },
        ]),
      },
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
        sourceUrl:
          "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        sourceHandle: "CcCMiddleton",
        authorName: "LinesLinesLines",
        tweetId: "2047809041154625899",
        tweetUrl: "https://twitter.com/CcCMiddleton/status/2047809041154625899",
        quotedTweetId: "2047808888888888888",
        quotedTweetUrl:
          "https://twitter.com/HabsSource/status/2047808888888888888",
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
          "Jakub Dobes",
        ],
        forwards: [
          ["Juraj Slafkovsky", "Nick Suzuki", "Cole Caufield"],
          ["Ivan Demidov", "Kirby Dach", "Patrik Laine"],
        ],
        defensePairs: [["Mike Matheson", "Lane Hutson"]],
        goalies: ["Jakub Dobes"],
        rawPayload: {
          eventId: "32244dec-1064-4913-a98b-2611bcc9ea75",
        },
        metadata: {
          sourceEventTable: "lines_ccc_ifttt_events",
        },
      },
      rosterEntries: canadiensRoster,
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
        eventId: "32244dec-1064-4913-a98b-2611bcc9ea75",
      },
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
        "Jakub Dobes",
      ],
      unmatchedNames: [],
      primaryText:
        "Slafkovsky - Suzuki - Caufield\nDemidov - Dach - Laine\nMatheson - Hutson\nJakub Dobes",
      sourceEventTable: "lines_ccc_ifttt_events",
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
        goalies: ["Jon Gillies"],
      },
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
      goalie_1_player_id: null,
    });
  });
});

describe("tweet publication timing", () => {
  it("preserves current row ordinals after temporal review and never stores incomplete rows", () => {
    const players = canadiensRoster.slice(0, 3);
    const text = "Tomorrow's lines\nCaufield-Suzuki-Slafkovsky\nTonight's lines\nSlafkovsky-Suzuki-Caufield";
    const source = { snapshotDate: "2026-09-30", tweetPostedAt: "2026-10-01T03:30:00Z", nhlFilterStatus: "accepted" as const,
      rawText: text, metadata: { interpretation: interpretTweetUnits(text, players) } };
    expect(source.metadata.interpretation.units.map((unit) => ({ number: unit.number, complete: unit.complete }))).toEqual([{ number: 1, complete: true }, { number: 2, complete: true }]);
    reviewTweetApplicability([source], "2026-09-30");
    const row = toLinesCccRow({ source, rosterEntries: players });
    expect(row.line_1_player_names).toBeNull();
    expect(row.line_2_player_names).toEqual(["Cole Caufield", "Nick Suzuki", "Juraj Slafkovsky"]);
    const unknownPlayers = players.map((player) => ({ ...player, position: null }));
    const unknownSource = { ...source, metadata: { interpretation: interpretTweetUnits(text, unknownPlayers) } };
    reviewTweetApplicability([unknownSource], "2026-09-30");
    const unknownRow = toLinesCccRow({ source: unknownSource, rosterEntries: unknownPlayers });
    expect(unknownRow.line_1_player_names).toBeNull();
    expect(unknownRow.line_2_player_names).toBeNull();
  });
  it("decodes exact publication without rounding the tweet ID", () => {
    expect(tweetPublicationFromUrl("https://x.com/reporter/status/2047808467969220779")).toBe("2026-04-24T22:42:39.862Z");
    expect(tweetPublicationFromUrl("https://twitter.com/i/web/status/2047808467969220779")).toBe("2026-04-24T22:42:39.862Z");
  });
  it.each([null, "https://example.com/status/2047808467969220779", "https://x.com.evil.com/a/status/2047808467969220779", "https://x.com/a/status/123", "https://x.com/a/status/99999999999999999999", "https://x.com/a/status/2047808467969220779garbage"])("does not invent a publication time for %s", (url) => {
    expect(tweetPublicationFromUrl(url)).toBeNull();
  });
  it("rejects oEmbed content returned for a different tweet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      html: '<blockquote><p>Woll will start</p><a href="https://x.com/reporter/status/2047808467969220779">Apr 24, 2026</a></blockquote>',
    }) }));
    try {
      expect(await fetchLinesCccTweetOEmbedData("https://x.com/reporter/status/2047808711494902155")).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
  it("keeps missing quoted publication unknown without borrowing wrapper time", () => {
    const source = applyQuotedTweetPreference({ source: {
      snapshotDate: "2026-04-25", tweetPostedAt: "2026-04-25T19:00:00.000Z",
      rawText: "Lightning lines https://t.co/example", classification: "lineup", nhlFilterStatus: "accepted",
    }, quotedTweet: {
      quotedTweetId: "123", quotedTweetUrl: "https://x.com/reporter/status/123",
      quotedText: "Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel", quotedPostedAt: null,
      quotedPostedLabel: null, quotedSourceTweetUrl: null, quotedAuthorName: null, quotedAuthorHandle: null,
      resolvedUrl: "https://x.com/reporter/status/123", shortUrl: null, retrievalStatus: "x_api_success",
    } });
    expect(source.primaryTextSource).toBe("quoted_oembed");
    expect(source.tweetPostedAt).toBeNull();
    expect(source.metadata?.wrapperPostedAt).toBe("2026-04-25T19:00:00.000Z");
  });
});

describe("subject-specific goalie claim admission", () => {
  it("resolves surname-only affirmed starts and preserves both teams without weakening non-NHL rejection", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    try {
      const teams = buildTeamDirectory([
        { id: 4, name: "Philadelphia Flyers", abbreviation: "PHI", logo: "/teamLogos/PHI.png" },
        { id: 6, name: "Boston Bruins", abbreviation: "BOS", logo: "/teamLogos/BOS.png" },
      ]);
      const rosterByTeam = new Map([
        [4, [{ playerId: 8478435, fullName: "Dan Vladar", lastName: "Vladar", position: "G", teamId: 4 },
          { playerId: 8478439, fullName: "Travis Konecny", lastName: "Konecny", position: "R", teamId: 4 }]],
        [6, [{ playerId: 8480280, fullName: "Jeremy Swayman", lastName: "Swayman", position: "G", teamId: 6 }]],
      ]);
      const gameIdByTeamId = new Map([[4, 2026020070], [6, 2026020070]]);
      const build = (text: string) => buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-10-10", teams, rosterByTeam, gameIdByTeamId,
        event: { id: "retained", source: "ifttt", source_account: "CcCMiddleton", username: "CcCMiddleton", text,
          tweet_id: "2108958735309865096", link_to_tweet: "https://x.com/CcCMiddleton/status/2108958735309865096",
          tweet_created_at: "2026-10-10T16:31:00Z", received_at: "2026-10-10T16:39:40Z", created_at_label: null, raw_payload: { text } } });
      const single = build("RT @smclaughlin9: Sturm: Same lineup, Swayman in net.");
      expect(single).toMatchObject({ team: { id: 6 }, gameId: 2026020070, nhlFilterStatus: "accepted" });
      const text = "Confirmed Bruins Starting Goalie: Jeremy Swayman\nConfirmed Flyers Starting Goalie: Dan Vladar https://t.co/4hXg9xv9LV";
      const source = build(text);
      const claims = expandLinesCccGoalieClaims({ source, teams, gameIdByTeamId });
      expect(claims.map((claim) => claim.team!.id)).toEqual([6, 4]);
      expect(claims.map((claim) => claim.goalies)).toEqual([["Jeremy Swayman"], ["Dan Vladar"]]);
      expect(new Set(claims.map((claim) => toLinesCccRow({ source: claim, rosterEntries: rosterByTeam.get(claim.team!.id)! }).capture_key)).size).toBe(2);
      for (const claim of claims) expect(claim).toMatchObject({ rawText: text, tweetId: source.tweetId, observedAt: source.observedAt,
        tweetPostedAt: source.tweetPostedAt, gameId: 2026020070, classification: "goalie_start", metadata: { claimTeamIds: [6, 4] } });
      const rejected = { ...source, nhlFilterStatus: "rejected_non_nhl" as const };
      expect(expandLinesCccGoalieClaims({ source: rejected, teams, gameIdByTeamId })).toEqual([rejected]);
      expect(expandLinesCccGoalieClaims({ source: build("https://t.co/4hXg9xv9LV"), teams, gameIdByTeamId })).toHaveLength(1);
      const practice = build("At practice: Swayman is expected to start.");
      expect(expandLinesCccGoalieClaims({ source: practice, teams, gameIdByTeamId })[0]!.gameId).toBeNull();
      const mixed = expandLinesCccGoalieClaims({ source: build("Dan Vladar starts tonight. Travis Konecny is day-to-day."), teams, gameIdByTeamId })[0]!;
      expect((mixed.metadata!.interpretation as any).events).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: 8478435, kind: "goalie", goalieRole: "starter" }),
        expect.objectContaining({ playerId: 8478439, kind: "injury", availability: "uncertain" }),
      ]));
      expect(mixed.goalies).toEqual(["Dan Vladar"]);
      const conflict = build("Confirmed Flyers Starting Goalie: Jeremy Swayman");
      expect(expandLinesCccGoalieClaims({ source: conflict, teams, gameIdByTeamId })).toEqual([conflict]);
    } finally { vi.unstubAllEnvs(); }
  });

  it("splits an opposing 'A vs B in goal' post into one starter per side only when the game binds both teams", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    try {
      // Retained receipt: tweet 2119520323309617358, BUF @ VGK game 2026020278 on 2026-11-08.
      const teams = buildTeamDirectory([
        { id: 7, name: "Buffalo Sabres", abbreviation: "BUF", logo: "/teamLogos/BUF.png" },
        { id: 54, name: "Vegas Golden Knights", abbreviation: "VGK", logo: "/teamLogos/VGK.png" },
      ]);
      const rosterByTeam = new Map([
        [7, [{ playerId: 8481551, fullName: "Colten Ellis", lastName: "Ellis", position: "G", teamId: 7 }]],
        [54, [{ playerId: 8478499, fullName: "Adin Hill", lastName: "Hill", position: "G", teamId: 54 }]],
      ]);
      const text = "It’s Colten Ellis vs Adin Hill in goal. The Bills are en route to Minny for MNF, so it’s the #Sabres and #Vgk.";
      const build = (gameIdByTeamId: Map<number, number>) => buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-08", teams, rosterByTeam, gameIdByTeamId,
        event: { id: "retained", source: "fxtwitter", source_account: "ByMHarrington", username: "ByMHarrington", text,
          tweet_id: "2119520323309617358", link_to_tweet: "https://x.com/ByMHarrington/status/2119520323309617358",
          tweet_created_at: "2026-11-08T19:59:58Z", received_at: "2026-11-08T20:08:18Z", created_at_label: null, raw_payload: { text } } });
      const bound = new Map([[7, 2026020278], [54, 2026020278]]);
      const claims = expandLinesCccGoalieClaims({ source: build(bound), teams, gameIdByTeamId: bound });
      expect(claims.map((claim) => [claim.team!.id, claim.gameId, claim.goalies])).toEqual(expect.arrayContaining([
        [7, 2026020278, ["Colten Ellis"]], [54, 2026020278, ["Adin Hill"]]]));
      expect(claims).toHaveLength(2);
      for (const claim of claims) {
        const teamId = claim.team!.id;
        const roster = rosterByTeam.get(teamId)!;
        const row = toLinesCccRow({ source: claim, rosterEntries: roster });
        expect(buildGoalieBlendFeatures([], teamId, { gameId: 2026020278, linesCccRows: [row as unknown as LinesCccRow] }))
          .toMatchObject({ source: "lines_ccc", confirmed: true, topGoalieId: roster[0]!.playerId });
      }
      // Teams on different games: the post binds no single game with both sides, so "vs" shares nothing.
      const unbound = new Map([[7, 2026020270], [54, 2026020278]]);
      const events = (build(unbound).metadata!.interpretation as TweetInterpretation).events!.filter((event) => event.kind === "goalie");
      expect(events.map((event) => event.playerId)).toEqual([8478499]);
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("Lines IGA source metadata", () => {
  const [sabres] = buildTeamDirectory([{ id: 7, name: "Buffalo Sabres", abbreviation: "BUF", logo: "/teamLogos/BUF.png" }]);
  const rosterRows: Array<[number, string, string]> = [
    [1, "Tage Thompson", "C"], [2, "Alex Tuch", "R"], [3, "Jiri Kulich", "C"], [4, "Peyton Krebs", "C"], [5, "Josh Doan", "R"], [6, "Ryan McLeod", "C"],
    [7, "Zach Benson", "L"], [8, "Jason Zucker", "L"], [9, "Jordan Greenway", "L"], [10, "Beck Malenstyn", "L"], [11, "Jack Quinn", "R"], [12, "Josh Norris", "C"],
    [13, "Owen Power", "D"], [14, "Rasmus Dahlin", "D"], [15, "Mattias Samuelsson", "D"], [16, "Bowen Byram", "D"], [17, "Jacob Bryson", "D"], [18, "Conor Timmins", "D"],
    [19, "Ukko-Pekka Luukkonen", "G"], [20, "Alex Lyon", "G"],
  ];
  const roster = rosterRows.map(([playerId, fullName, position]) => ({ playerId, fullName, lastName: fullName.slice(fullName.lastIndexOf(" ") + 1), position, teamId: 7 }));
  const event = (overrides: Record<string, unknown>) => ({ id: "evt", source: "fxtwitter", source_account: "GameDayLines", username: "GameDayLines", text: "",
    link_to_tweet: null, tweet_id: null, tweet_created_at: null, created_at_label: null, raw_payload: {}, received_at: "2026-11-06T23:00:00Z", ...overrides }) as any;
  const parse = (text: string, overrides: Record<string, unknown> = {}) => buildLinesCccSourceFromIftttEvent({
    event: event({ text, ...overrides }), snapshotDate: "2026-11-06", teams: [sabres!], rosterByTeam: new Map([[7, roster]]),
  });
  const LINEUP = "#Sabres Lineup vs. BOS\nKulich - Krebs - Doan\nThompson - Norris - Tuch\nQuinn - McLeod - Benson\nZucker - Greenway - Malenstyn\n\nPower - Dahlin\nSamuelsson - Byram\nBryson - Timmins\n🥅: Luukkonen ✅";

  afterEach(() => { vi.unstubAllEnvs(); });

  it("stores the DFO 🥅 goalie and keeps the goalie on a lineup that also lists a PP unit", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const parsed = parse(LINEUP);
    expect(parsed.goalies).toEqual(["Ukko-Pekka Luukkonen"]);
    expect(parsed.metadata?.goalieStates).toMatchObject([{ playerId: 19, state: "confirmed", source: "unit", stored: true }]);
    const withPp = parse(`${LINEUP}\n\nPP1: Thompson - Tuch - Norris - Quinn - Dahlin`);
    expect(withPp.classification).toBe("lineup");
    expect(withPp.goalies).toEqual(["Ukko-Pekka Luukkonen"]);
    expect(toLinesCccRow({ source: withPp, rosterEntries: roster }).goalie_1_player_id).toBe(19);
    expect(withPp.forwards).toHaveLength(4);
  });

  it("never stores a ruled-out goalie as the starter and keeps each goalie's state", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const parsed = parse("#Sabres: Luukkonen will not be in net tonight; Lyon starts vs. Boston.");
    expect(parsed.goalies).toEqual(["Alex Lyon"]);
    expect(parsed.metadata?.goalieStates).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 20, stored: true }),
      expect.objectContaining({ playerId: 19, state: "ruled_out", stored: false }),
    ]));
  });

  it("exposes FxTwitter provenance: original and reposting author, quote, alt text, first sighting and provider clock", () => {
    const repost = buildTweetSourceProvenance(event({ tweet_id: "900", tweet_created_at: "2026-11-06T22:00:00.000Z",
      raw_payload: { provider: "fxtwitter", first_seen_at: "2026-11-06T22:01:30Z", quote: { id: "800", url: "https://x.com/BuffaloSabres/status/800", text: "Lines at practice", author_handle: "BuffaloSabres" },
        fx: { id: "900", author: { screen_name: "pham1717", name: "Pham" }, reposted_by: { screen_name: "GameDayLines" }, repost_wrapper_id: "555",
          media: { all: [{ altText: "Kulich - Krebs - Doan" }, { altText: " " }] } } } }));
    expect(repost).toEqual({ provider: "fxtwitter", postKind: "repost", originalAuthor: "pham1717", originalAuthorName: "Pham", relayAccount: "GameDayLines",
      originalTweetId: "900", relayTweetId: "555", dedupKey: "tweet:900", quotedTweetId: "800", quotedAuthor: "BuffaloSabres", quotedText: "Lines at practice",
      altTexts: ["Kulich - Krebs - Doan"], publishedAt: "2026-11-06T22:00:00.000Z", publicationTimeBasis: "provider_timestamp", timestampIsOriginal: true,
      ingestedAt: "2026-11-06T22:01:30Z", ingestedAtBasis: "first_seen_at" });
    const wrapper = buildTweetSourceProvenance(event({ tweet_id: "555", tweet_created_at: "2026-11-06T22:03:00Z",
      raw_payload: { provider: "fxtwitter", fx: { id: "555", author: { screen_name: "GameDayLines" }, text: "RT @pham1717: Kulich - Krebs - Doan" } } }));
    expect(wrapper).toMatchObject({ postKind: "repost_wrapper", originalAuthor: "pham1717", relayAccount: "GameDayLines", originalTweetId: null, relayTweetId: "555",
      dedupKey: "relay:555", timestampIsOriginal: false, ingestedAt: "2026-11-06T23:00:00Z", ingestedAtBasis: "received_at" });
    const relay = buildTweetSourceProvenance(event({ source: "ifttt", tweet_id: "556", text: "RT @pham1717: Kulich - Krebs - Doan" }));
    expect(relay).toMatchObject({ provider: "ifttt", postKind: "repost", originalAuthor: "pham1717", relayAccount: "GameDayLines", originalTweetId: null, relayTweetId: "556",
      publicationTimeBasis: "tweet_id_or_unknown", timestampIsOriginal: false });
    expect(parse("Kulich - Krebs - Doan", { tweet_id: "900", raw_payload: { provider: "fxtwitter", fx: { id: "900", author: { screen_name: "pham1717" }, reposted_by: { screen_name: "GameDayLines" } } } })
      .metadata?.sourceProvenance).toMatchObject({ originalAuthor: "pham1717", relayAccount: "GameDayLines", originalTweetId: "900" });
  });

  it("keys an FxTwitter repost's capture on the original tweet id and leaves IFTTT keys unchanged", () => {
    const fxRepost = parse("Kulich - Krebs - Doan", { tweet_id: "900", raw_payload: { provider: "fxtwitter", fx: { id: "900", author: { screen_name: "pham1717" }, reposted_by: { screen_name: "GameDayLines" }, repost_wrapper_id: "555" } } });
    expect(toLinesCccRow({ source: fxRepost }).capture_key).toContain(":900:");
    const ifttt = parse("Kulich - Krebs - Doan", { source: "ifttt", tweet_id: "556" });
    expect(toLinesCccRow({ source: ifttt }).capture_key).toContain(":556:");
  });
});

describe("goalie slots in a listed lineup (tweet 2118850118849864168)", () => {
  // @rachelmlenzi via @GameDayLines, 2026-11-06T23:36:49Z, exact text from the trainer answer key.
  const TEXT = "RT @rachelmlenzi: #Sabres lines, defensive pairs in warmups, ahead of Columbus:\nBenson-Krebs-Thompson\nDoan-Ostlund-Quinn\nKulich-Norris-Zucker\nMalenstyn-Kozak-Carrick\n\nSamuelsson-Dahlin\nZellweger-Power\nTimmins-Metsa\n\nUPL\nEllis";
  const [sabres] = buildTeamDirectory([{ id: 7, name: "Buffalo Sabres", abbreviation: "BUF", logo: "/teamLogos/BUF.png" }]);
  const skaters: Array<[string, string]> = [
    ["Zach Benson", "L"], ["Peyton Krebs", "C"], ["Tage Thompson", "C"], ["Josh Doan", "R"], ["Noah Ostlund", "C"], ["Jack Quinn", "R"],
    ["Jiri Kulich", "C"], ["Josh Norris", "C"], ["Jason Zucker", "L"], ["Beck Malenstyn", "L"], ["Tyson Kozak", "C"], ["Sam Carrick", "C"],
    ["Mattias Samuelsson", "D"], ["Rasmus Dahlin", "D"], ["Olen Zellweger", "D"], ["Owen Power", "D"], ["Conor Timmins", "D"], ["Michael Metsa", "D"],
  ];
  const roster = [
    ...skaters.map(([fullName, position], index) => ({ playerId: 100 + index, fullName, lastName: fullName.slice(fullName.lastIndexOf(" ") + 1), position, teamId: 7 })),
    { playerId: 8480045, fullName: "Ukko-Pekka Luukkonen", lastName: "Luukkonen", position: "G", teamId: 7 },
    { playerId: 8481551, fullName: "Colten Ellis", lastName: "Ellis", position: "G", teamId: 7 },
  ];
  const aliased = roster.map((player) => player.playerId === 8480045 ? { ...player, roleAliases: [{ alias: "UPL", role: "goalie" as const }] } : player);
  const parse = (entries: typeof roster) => buildLinesCccSourceFromIftttEvent({
    event: { id: "upl", source: "ifttt", source_account: "GameDayLines", username: "GameDayLines", text: TEXT, link_to_tweet: "https://x.com/GameDayLines/status/2118850118849864168",
      tweet_id: "2118850118849864168", tweet_created_at: "2026-11-06T23:36:49+00:00", created_at_label: null, raw_payload: {}, received_at: "2026-11-06T23:37:10Z" },
    snapshotDate: "2026-11-06", teams: [sabres!], rosterByTeam: new Map([[7, entries]]),
  });

  afterEach(() => { vi.unstubAllEnvs(); });

  it("pins the exact answer-key text", () => {
    expect(createHash("sha256").update(TEXT).digest("hex")).toBe("2da88835c3d8bd8c75fe07d77f039535d137e6ab44f437df832d41216cec7ab0");
  });

  it("keeps an unmatched first goalie as an unresolved slot-1 span and never moves the backup up", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const parsed = parse(roster);
    const interpretation = parsed.metadata?.interpretation as TweetInterpretation;
    expect(interpretation.lineContext?.context).toBe("warmup");
    expect(interpretation.units.filter((unit) => unit.situation === "goalie")).toMatchObject([{ number: 2, players: [{ playerId: 8481551 }] }]);
    const upl = interpretation.unresolved.find((entry) => entry.situation === "goalie");
    expect(upl).toMatchObject({ text: "UPL", number: 1, reason: "missing_player" });
    expect(TEXT.slice(upl!.start, upl!.end)).toBe("UPL");
    expect(parsed.goalies).toEqual(["UPL", "Colten Ellis"]);
    expect(parsed.metadata?.goalieStates).toMatchObject([
      { name: "UPL", playerId: null, state: "unresolved", role: "starter", slot: 1 },
      { name: "Colten Ellis", playerId: 8481551, role: "backup", slot: 2 },
    ]);
    const row = toLinesCccRow({ source: parsed, rosterEntries: roster });
    expect(row).toMatchObject({ goalie_1_name: "UPL", goalie_1_player_id: null, goalie_2_name: "Colten Ellis", goalie_2_player_id: 8481551 });
    expect(completeEvenStrengthUnits(interpretation)).toHaveLength(7);
  });

  it("resolves UPL through an approved goalie-scoped alias as the starter, Ellis the backup", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const parsed = parse(aliased);
    const interpretation = parsed.metadata?.interpretation as TweetInterpretation;
    expect(interpretation.units.filter((unit) => unit.situation === "goalie")).toMatchObject([
      { number: 1, players: [{ playerId: 8480045 }] }, { number: 2, players: [{ playerId: 8481551 }] },
    ]);
    expect(interpretation.unresolved.some((entry) => entry.situation === "goalie")).toBe(false);
    expect(parsed.goalies).toEqual(["Ukko-Pekka Luukkonen", "Colten Ellis"]);
    expect(toLinesCccRow({ source: parsed, rosterEntries: aliased })).toMatchObject({ goalie_1_player_id: 8480045, goalie_2_player_id: 8481551 });
  });
});

describe("lineup changes become player events (Owen Beck had 0 events, 2026-11-07)", () => {
  it("parses DFO IN/OUT into game-scoped participation events and persists them to tweet_player_events", async () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    vi.stubEnv("TWEET_CLAIMS_MODE", "");
    try {
      const { persistTweetProjectionReports } = await import("./tweetProjectionStorage");
      const teams = buildTeamDirectory([{ id: 8, name: "Montreal Canadiens", abbreviation: "MTL", logo: "/teamLogos/MTL.png" }]);
      const rosterByTeam = new Map([[8, [{ playerId: 8484838, fullName: "Owen Beck", lastName: "Beck", position: "C", teamId: 8 },
        { playerId: 8476981, fullName: "Josh Anderson", lastName: "Anderson", position: "R", teamId: 8 }]]]);
      const text = "#GoHabsGo lineup changes vs. TOR on Saturday: \n\nIN - Owen Beck\nOUT - Josh Anderson (personal) https://x.com/mndamico/status/2119116982951784842";
      const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-07", teams, rosterByTeam, gameIdByTeamId: new Map([[8, 2026020200]]),
        event: { id: "beck", source: "ifttt", source_account: "DFOFantasy", username: "DFOFantasy", text, tweet_id: "2119116982951784900",
          link_to_tweet: "https://x.com/DFOFantasy/status/2119116982951784900", tweet_created_at: "2026-11-07T15:00:00Z", received_at: "2026-11-07T15:01:00Z",
          created_at_label: null, raw_payload: { text } } });
      const events = (source.metadata!.interpretation as any).events;
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerId: 8484838, kind: "participation", availability: "available", availabilityScope: "game", evidence: expect.objectContaining({ text: "IN - Owen Beck" }) }),
        expect.objectContaining({ playerId: 8476981, kind: "participation", availability: "out", availabilityScope: "game" }),
      ]));
      const rows: any[] = [];
      const database = { from: (table: string) => ({
        upsert: async (values: any[]) => { if (table === "tweet_player_events") rows.push(...values); return { error: null }; },
        select: () => { const query: any = { eq: () => query, order: () => query, range: async () => ({ data: [], error: null }) }; return query; },
      }) };
      await persistTweetProjectionReports(database, [source]);
      expect(rows.map((row) => [row.player_id, row.availability, row.payload.kind])).toEqual(expect.arrayContaining([
        [8484838, "available", "participation"], [8476981, "out", "participation"]]));
      expect(rows.every((row) => row.event_key.endsWith(":participation"))).toBe(true);
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("league label on the wrapper of a quoted post (tweet 2119183971926130848, 2026-11-07)", () => {
  it("keeps an AHL-labelled wrapper rejected when the quoted original carries only the NHL affiliate's tag", () => {
    const teams = buildTeamDirectory([{ id: 3, name: "New York Rangers", abbreviation: "NYR", logo: "/teamLogos/NYR.png" }]);
    const rosterByTeam = new Map([[3, [{ playerId: 8480000, fullName: "Victor Mancini", lastName: "Mancini", position: "D", teamId: 3 }]]]);
    const wrapper = "AHL Wolf Pack lines\nAHL Wolf Pack Starting Goalie: Callum Tung https://x.com/TheKeeganJarvis/status/2119182685557977428";
    const quoted = "Wolf Pack lines tonight at Syracuse:\n\nMcConnell-Barker - Gawdin - Raddysh\nTerrance - Dowling - Greentree\nBlidh - Pärssinen - Aspinall\nNachbaur - Vanroboys - Lamb\n\nVaakanainen - Del Gaizo\nFortescue - Iorio\nDorrington - Frisch \n\nTung\nMartin\n\n#HFDvsSYR | #NYR";
    const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-07", teams, rosterByTeam, gameIdByTeamId: new Map([[3, 2026020267]]),
      event: { id: "wolfpack", source: "fxtwitter", source_account: "CcCMiddleton", username: "CcCMiddleton", text: wrapper, tweet_id: "2119183971926130848",
        link_to_tweet: "https://x.com/CcCMiddleton/status/2119183971926130848", tweet_created_at: "2026-11-07T21:40:00Z", created_at_label: null,
        received_at: "2026-11-07T21:44:06Z", raw_payload: {} } });
    expect(source).toMatchObject({ nhlFilterStatus: "rejected_non_nhl", team: null });
    // Before the fix the quoted-text refresh re-ran the league check on the quote alone and accepted it as NYR.
    const refreshed = refreshLinesCccSourceFromPrimaryText({ teams, rosterByTeam,
      source: { ...source, primaryTextSource: "quoted_oembed", quotedRawText: quoted, quotedAuthorHandle: "TheKeeganJarvis", quotedTweetId: "2119182685557977428" } });
    expect(refreshed).toMatchObject({ nhlFilterStatus: "rejected_non_nhl", nhlFilterReason: "explicit_non_nhl_league_marker", team: null });
    // The same quote relayed without a league label still resolves to the NHL club.
    const plain = refreshLinesCccSourceFromPrimaryText({ teams, rosterByTeam,
      source: { ...source, rawText: "Rangers lines https://x.com/x/status/1", enrichedText: null, primaryTextSource: "quoted_oembed", quotedRawText: quoted } });
    expect(plain.nhlFilterStatus).not.toBe("rejected_non_nhl");
  });
});

describe("validated goalie/injury rows keep the reporter (riskyStarts handle, 2026-11-07)", () => {
  it("credits the verified original author, never a relay or a pending original; quotes are left to the forecast capture", async () => {
    const { validatedEventReporter } = await import("./tweetProjectionStorage");
    // A reporter's own verified post: their handle (two reporters now stay two sources, so disagreement is detectable).
    expect(validatedEventReporter({}, { originalUrl: "https://x.com/PenguinsPR/status/1" })).toBe("penguinspr");
    // A relay's post or a pending original: no reporter, so the card shows no handle.
    expect(validatedEventReporter({}, { originalUrl: "https://x.com/GameDayGoalies/status/3" })).toBeNull();
    expect(validatedEventReporter({}, { originalUrl: null })).toBeNull();
    // Quote posts: the forecast capture credits the quoted author.
    expect(validatedEventReporter({ quotedAuthorHandle: "pham1717" }, { originalUrl: "https://x.com/pham1717/status/4" })).toBeNull();
  });
});

// Codex audit 2026-11-16 (FxTwitter/auto line assignment). The retained posts were not available offline, so these
// fixtures are synthetic reconstructions of the two reported shapes; player names are invented.
describe("team matching: league and opponent mentions (Codex audit 2026-11-16)", () => {
  const teams = buildTeamDirectory([
    { id: 21, name: "Colorado Avalanche", abbreviation: "COL", logo: "" },
    { id: 26, name: "Los Angeles Kings", abbreviation: "LAK", logo: "" },
    { id: 4, name: "Philadelphia Flyers", abbreviation: "PHI", logo: "" },
    { id: 22, name: "Edmonton Oilers", abbreviation: "EDM", logo: "" },
  ]);
  const player = (playerId: number, fullName: string, teamId: number, position = "F") =>
    ({ playerId, fullName, lastName: fullName.split(" ").slice(-1)[0]!, teamId, position });
  const rosterByTeam = new Map([
    [21, [player(2101, "Fixture Mackinnon", 21), player(2102, "Fixture Makar", 21, "D")]],
    [26, [player(2601, "Fixture Kopitar", 26), player(2602, "Fixture Doughty", 26, "D")]],
    [4, [player(401, "Fixture Couturier", 4), player(402, "Fixture Sanheim", 4, "D")]],
    [22, [player(2201, "Fixture McDavid", 22), player(2202, "Fixture Draisaitl", 22)]],
  ]);
  const ingest = (text: string, roster = rosterByTeam) => buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-15", teams, rosterByTeam: roster,
    event: { id: `audit-${text.length}`, source: "fxtwitter", source_account: "fixturebeat", username: "fixturebeat", text, tweet_id: "2119900000000000001",
      link_to_tweet: "https://x.com/fixturebeat/status/2119900000000000001", tweet_created_at: "2026-11-15T23:00:00Z", created_at_label: null,
      received_at: "2026-11-15T23:01:00Z", raw_payload: {} } });
  const aliasPrompts = (source: ReturnType<typeof ingest>) =>
    collectUnresolvedNamesFromLineRows([toLinesCccRow({ source, rosterEntries: source.team ? rosterByTeam.get(source.team.id) ?? [] : [] })] as any);
  afterEach(() => vi.unstubAllEnvs());

  it.each([false, true])("replays the Ontario and Hallander receipts against dated memberships, interpretation %s", enabled => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", String(enabled));
    const games = new Map([[4, 2026020326], [22, 2026020326]]);
    for (const receipt of [datedIdentity.ontario, datedIdentity.hallander]) {
      const roster = new Map(teams.map(team => [team.id, datedIdentity.memberships.filter(member =>
        member.teamId === team.id && Date.parse(member.created_at) <= Date.parse(receipt.postedAt)
        && (member.ended_at === null || Date.parse(member.ended_at) > Date.parse(receipt.postedAt)))]));
      const event = { id: receipt.id, source: "fxtwitter", source_account: receipt.handle, username: receipt.handle,
        text: receipt.text, tweet_id: receipt.id, link_to_tweet: `https://x.com/${receipt.handle}/status/${receipt.id}`,
        tweet_created_at: receipt.postedAt, received_at: receipt.postedAt, created_at_label: null, raw_payload: {} };
      const args = { snapshotDate: "2026-11-15", teams, rosterByTeam: roster, gameIdByTeamId: games };
      const first = buildLinesCccSourceFromIftttEvent({ ...args, event });
      for (const source of [first, refreshLinesCccSourceFromPrimaryText({ ...args, source: first })]) {
        if (receipt === datedIdentity.ontario) {
          expect(source).toMatchObject({ team: null, gameId: null, detectedLeague: "AHL", nhlFilterStatus: "rejected_non_nhl" });
        } else {
          expect(source).toMatchObject({ team: { id: 22 }, gameId: 2026020326, detectedLeague: "NHL", nhlFilterStatus: "accepted" });
          expect(source.matchedPlayerIds).toContain(8480842);
        }
        const row = toLinesCccRow({ source, rosterEntries: roster.get(source.team?.id ?? 0) ?? [] });
        expect(collectUnresolvedNamesFromLineRows([row] as any).filter(prompt => prompt.team_id === 4 || prompt.team_id === 21)).toEqual([]);
      }
      if (receipt === datedIdentity.hallander) {
        for (const text of [receipt.text.replace("Sunday", "Saturday"), receipt.text.replace("Philadelphia", "Colorado"),
          receipt.text.replace("Hallander will draw", "If traded Hallander will draw")]) {
          expect(buildLinesCccSourceFromIftttEvent({ ...args, event: { ...event, text } }).gameId).toBeNull();
        }
        expect(buildLinesCccSourceFromIftttEvent({ ...args, gameIdByTeamId: new Map([[22, 2026020326], [4, 2026020338]]), event }).gameId).toBeNull();
        expect(buildLinesCccSourceFromIftttEvent({ ...args, snapshotDate: "2026-11-16", event }).gameId).toBeNull();
      }
      const recall = buildLinesCccSourceFromIftttEvent({ ...args, event: { ...event,
        text: "The Oilers have recalled Filip Hallander from the AHL Bakersfield Condors." } });
      expect(recall).toMatchObject({ team: { id: 22 }, detectedLeague: "NHL", nhlFilterStatus: "accepted" });
    }
  });

  it("withholds the retained unbound COL/PHI projections from those teams while preserving independently supported NHL subjects", () => {
    const interpretation = { ...interpretTweetUnits("", []), units: [], events: [] };
    const hallander = { gameId: null, teamId: 4, teamAbbreviation: "PHI", originalUrl: null, interpretation, text: datedIdentity.hallander.text };
    const ontario = { ...hallander, teamId: 21, teamAbbreviation: "COL", text: datedIdentity.ontario.text,
      originalUrl: `https://x.com/ReignInsider/status/${datedIdentity.ontario.id}` };
    expect(isDisputedRetainedProjectionSubject(hallander)).toBe(true);
    expect(isDisputedRetainedProjectionSubject(ontario)).toBe(true);
    expect(isDisputedRetainedProjectionSubject({ ...ontario, text: ontario.text.replace(/^RT @ReignInsider: /, "") })).toBe(true);
    expect(isDisputedRetainedProjectionSubject({ ...hallander, teamId: 22, teamAbbreviation: "EDM" })).toBe(false);
    expect(isDisputedRetainedProjectionSubject({ ...hallander, text: "The Flyers recall Filip Hallander from the AHL. He skated today in Philadelphia." })).toBe(false);
    expect(isDisputedRetainedProjectionSubject({ ...hallander, text: "Filip Hallander: The Flyers signed Hallander in Philadelphia." })).toBe(false);
    expect(isDisputedRetainedProjectionSubject({ ...hallander, text: hallander.text + " #Flyers" })).toBe(false);
  });

  it.each([false, true])("retains NHL news that names an AHL club or a city, interpretation %s", enabled => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", String(enabled));
    const cases = [
      { id: "2072448279170748428", handle: "ChaseBeardsley_", team: { id: 68, name: "Utah Mammoth", abbreviation: "UTA", logo: "" },
        roster: [], text: "The Mammoth have signed Zac Jones to a two year, two way contract with a AAV of $875,000.\nJones had 62 points in 60 games last season with the Rochester Americans as a defenseman.#TusksUp #LetsGoTucson" },
      { id: "2054601760841638184", handle: "RussoHockey", team: { id: 30, name: "Minnesota Wild", abbreviation: "MIN", logo: "" },
        roster: [{ playerId: 8478493, fullName: "Joel Eriksson Ek", lastName: "Eriksson Ek", teamId: 30, position: "C" }],
        text: "Eriksson Ek skated today in Minnesota so they’re still hoping if they extend the series" },
    ];
    for (const item of cases) {
      const url = `https://x.com/${item.handle}/status/${item.id}`;
      const postedAt = tweetPublicationFromUrl(url)!;
      const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: postedAt.substring(0, 10), teams: buildTeamDirectory([...teams, item.team]),
        rosterByTeam: new Map([[item.team.id, item.roster]]), event: { id: item.id, source: "fxtwitter", source_account: item.handle, username: item.handle,
          text: item.text, tweet_id: item.id, link_to_tweet: url, tweet_created_at: postedAt, received_at: postedAt, created_at_label: null, raw_payload: {} } });
      expect(source).toMatchObject({ team: { id: item.team.id }, nhlFilterStatus: "accepted", detectedLeague: "NHL" });
    }
  });

  it.each([false, true])("rejects an AHL club's lineup as non-NHL, even when its name or tag matches an NHL label: interpretation %s", (enabled) => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", String(enabled));
    const lines = "Ostrander - Vaillancourt - Mercado\nBelisle - Okafor - Ruutu\nTrembley - Haskins - Lindqvist\n\nPrice - Moravec\nAbara - Kettering\n\nWestland";
    for (const text of [
      `Ontario Reign lines vs. Colorado Eagles\n\n${lines}`, // the label "Colorado" belongs to the AHL opponent
      `Colorado Eagles lines tonight\n\n${lines}`, // an AHL club whose name carries an NHL location
      `Reign lines tonight\n\n${lines}\n\n#OntarioReign #GoKingsGo`, // the NHL affiliate's tag is not the team
    ]) {
      const source = ingest(text);
      expect(source, text).toMatchObject({ team: null, detectedLeague: "AHL", nhlFilterStatus: "rejected_non_nhl", nhlFilterReason: "explicit_non_nhl_league_marker" });
      const refreshed = refreshLinesCccSourceFromPrimaryText({ teams, rosterByTeam, source });
      expect(refreshed, text).toMatchObject({ team: null, nhlFilterStatus: "rejected_non_nhl" });
      expect(aliasPrompts(source)).toEqual([]);
    }
    // An NHL club named in words keeps a transaction post in the NHL feed (the corpus has "The Mammoth have signed …
    // with the Rochester Americans").
    expect(ingest("Kings recall Fixture Kopitar from the Ontario Reign.").nhlFilterStatus).not.toBe("rejected_non_nhl");
  });

  it.each([false, true])("does not treat an opponent or location mention as the player's team, nor queue an alias under it: interpretation %s", (enabled) => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", String(enabled));
    // Hallander is on no roster here (the audit lists him as a roster gap), so "in Philadelphia" is the only team label.
    for (const text of [
      "Hallander was in Philadelphia with the team but did not dress tonight.",
      "Hallander skated on the fourth line in Philadelphia.",
    ]) {
      const source = ingest(text);
      expect(source.team?.abbreviation, text).not.toBe("PHI");
      expect(aliasPrompts(source).filter((prompt) => prompt.team_abbreviation === "PHI"), text).toEqual([]);
    }
    // With Hallander on the Oilers roster, a lead-player item is filed under his own team, not the city he played in.
    const withHallander = new Map([...rosterByTeam, [22, [...rosterByTeam.get(22)!, player(2203, "Filip Hallander", 22)]]]);
    expect(resolveLinesCccTeam({ teams, rosterByTeam: withHallander, classification: "lineup",
      text: "Filip Hallander: Scratched again - Hallander was a healthy scratch Saturday in Philadelphia." })?.abbreviation).toBe("EDM");
    // A team labelled outside an opponent/location cue still resolves, and "at <team> practice" names the subject.
    expect(resolveLinesCccTeam({ teams, rosterByTeam, classification: "lineup", text: "Flyers lineup in Philadelphia tonight" })?.abbreviation).toBe("PHI");
    expect(resolveLinesCccTeam({ teams, rosterByTeam, text: "Lines at Flyers practice" })?.abbreviation).toBe("PHI");
    expect(resolveLinesCccTeam({ teams, rosterByTeam, text: "Lines at Flyers training camp" })?.abbreviation).toBe("PHI");
    expect(resolveLinesCccTeam({ teams, rosterByTeam, text: "Hallander is back in the Flyers lineup tonight." })?.abbreviation).toBe("PHI");
    expect(resolveLinesCccTeam({ teams, rosterByTeam, text: "Westland in the Oilers net tonight" })?.abbreviation).toBe("EDM");
    expect(resolveLinesCccTeam({ teams, rosterByTeam, text: "Hallander back in Colorado's lineup" })?.abbreviation).toBe("COL");
    expect(resolveLinesCccTeam({ teams, rosterByTeam: withHallander, classification: "lineup",
      text: "Filip Hallander: Hallander is back in the Flyers lineup." })?.abbreviation).not.toBe("EDM");
    // In a contract post "in <team>" is where he signed.
    expect(resolveLinesCccTeam({ teams, rosterByTeam, classification: "other", text: "Fixture Benning signs in Philadelphia. 1 year, two way contract." })?.abbreviation).toBe("PHI");
    // A two-team post stays ambiguous: the team after "vs" is not dropped to promote the other one.
    expect(resolveLinesCccTeam({ teams, rosterByTeam, classification: "goalie_start",
      text: "NHL Starting Goalies COL Fixture Blackwood vs PHI Fixture Vladar" })).toBeNull();
  });
});

describe("Nov 5 Nashville at Colorado goalie statements", () => {
  const game = { id: 2026020261, date: "2026-11-05", startTime: "2026-11-06T02:30:00Z", homeTeamId: 21, awayTeamId: 18 };
  const teams = buildTeamDirectory([{ id: 18, name: "Nashville Predators", abbreviation: "NSH", logo: "" },
    { id: 21, name: "Colorado Avalanche", abbreviation: "COL", logo: "" }]);
  const goalies = [{ playerId: 8481020, fullName: "Justus Annunen", lastName: "Annunen", position: "G", teamId: 18 },
    { playerId: 8477424, fullName: "Juuse Saros", lastName: "Saros", position: "G", teamId: 18 }];
  // The parity archive retains the bodies and linked IDs. Receipt/interpretation clocks below are replay inputs.
  const dfo = "🥅: Justus Annunen (NSH) ✅ will start Thursday @ COL.\n\n2-1-0 | 3.89 GAA | .846 SV% | 0 SO https://x.com/PredsNHL/status/2118523662190223538";
  const ccc = "Predators lines\nConfirmed Predators Starting Goalie: Justus Annunen https://x.com/brooksbratten/status/2118525120075755876";
  const asOf = "2026-11-06T02:15:00Z";
  function replay(handle: string, id: string, text: string, requestedDate = game.date, rawPayload: Record<string, unknown> = {}) {
    const url = `https://x.com/${handle}/status/${id}`;
    const posted = tweetPublicationFromUrl(url)!;
    const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: requestedDate, teams, rosterByTeam: new Map([[18, goalies]]),
      gameIdByTeamId: new Map([[18, game.id], [21, game.id]]),
      event: { id, source: "fxtwitter", source_account: handle, username: handle, text, tweet_id: id,
        link_to_tweet: url, tweet_created_at: posted, received_at: posted, created_at_label: null, raw_payload: rawPayload } });
    reviewTweetApplicability([source], requestedDate);
    const row = toLinesCccRow({ source, rosterEntries: goalies });
    const prediction = buildGoalieBlendFeatures([], 18, { gameId: game.id, linesCccRows: [row as unknown as LinesCccRow] });
    const claims = extractDurableTweetClaims({ source, game, interpretedAt: asOf }).map(item => item.semantic);
    return { row, prediction, claims };
  }
  afterEach(() => vi.unstubAllEnvs());
  it("reads both relay assertions but finds no independent, explicit original in the retained source bodies", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const rows = [replay("DFOFantasy", "2118523774014530047", dfo), replay("CcCMiddleton", "2118526109264539958", ccc)];
    for (const { row, prediction, claims } of rows) {
      expect(row).toMatchObject({ game_id: game.id, team_id: 18, goalie_1_player_id: 8481020,
        metadata: { goalieStates: [{ source: "event", state: "confirmed" }], goalieClaimOrigin: { url: null } } });
      expect(claims[0]).toMatchObject({ fact: { kind: "starter", playerId: 8481020 }, support: { status: "pending", reason: "original_identity_unresolved" } });
      expect(prediction.confirmed).toBe(false);
    }
    const reduced = reduceTweetSemanticEvents(rows.flatMap(row => row.claims), asOf);
    expect(reduced.actions).toEqual([]);
    expect(reduced.associations.map(a => a.reason)).toEqual(["original_identity_unresolved", "original_identity_unresolved"]);
    const bratten = replay("brooksbratten", "2118525120075755876", "#Preds lineup in warmups:   \n\nStamkos-O'Reilly-Bourque \nForsberg-Wright-Hoglander \nSchaefer-Kerfoot-Pinchuk \nColton-Drury-Edstrom  \n\nJosi-Wilsby \nSkjei-Perbix \nHunt-Struble  \n\nAnnunen\nSaros");
    expect(bratten.claims.some(claim => claim.fact?.kind === "starter")).toBe(false);
    expect(bratten.prediction.confirmed).toBe(false);
    expect(replay("DFOFantasy", "2118523774014530047", dfo, "2026-11-06").row.game_id).toBeNull();
  });
  it("accepts a dated original assertion with or without the marker, and withholds marker-only and mismatched claims", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    // Controlled non-relay input, not the unretained PredsNHL original.
    const text = "🥅: Justus Annunen (NSH) ✅ will start Thursday @ COL.";
    for (const body of [text, text.replace("✅ ", "")]) {
      const direct = replay("FixtureReporter", "2118523774014530047", body);
      expect(direct.prediction).toMatchObject({ confirmed: true, topGoalieId: 8481020 });
      expect(reduceTweetSemanticEvents(direct.claims, asOf).actions).toHaveLength(1);
    }
    const id = "2118523774014530047";
    const original = replay("FixtureReporter", id, text);
    const copy = replay("GameDayGoalies", id, `RT @FixtureReporter: ${text}`, game.date, {
      data: { id, referenced_tweets: [{ id, type: "retweeted" }] },
      includes: { tweets: [{ id, text, author_id: "10", created_at: original.claims[0]!.original.publishedAt }],
        users: [{ id: "10", username: "FixtureReporter" }] },
    });
    const combined = reduceTweetSemanticEvents([...original.claims, ...copy.claims], asOf);
    expect(copy.prediction).toMatchObject({ confirmed: true, topGoalieId: 8481020 });
    expect(combined.actions).toHaveLength(1);
    expect(combined.scenarios[0]!.revisions[0]!.supportedOrigins).toMatchObject([{ originalTweetId: id, observationIndexes: [0, 1] }]);
    for (const body of ["NSH vs. COL\n🥅: Annunen ✅", text.replace("Thursday", "Friday"),
      text.replace("(NSH)", "(COL)"), text.replace("@ COL", "@ DAL"), text.replace("will start", "could start")]) {
      const held = replay("FixtureReporter", "2118523774014530047", body);
      expect(held.prediction.confirmed, body).toBe(false);
      expect(reduceTweetSemanticEvents(held.claims, asOf).actions, body).toEqual([]);
    }
  });
});

it("withholds a Buffalo starter and a skater absence on both Nov 6 morning-skate reports", () => {
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
  try {
    const game = { id: 2026020262, date: "2026-11-06", startTime: "2026-11-07T00:00:00Z", homeTeamId: 7, awayTeamId: 29 };
    const roster = ([["Ukko-Pekka Luukkonen", "Luukkonen", 8480045, "G"], ["Ryan McLeod", "McLeod", 8480802, "C"],
      ["Jiri Kulich", "Kulich", 8483468, "C"]] as const).map(([fullName, lastName, playerId, position]) => ({ fullName, lastName, playerId, position, teamId: 7 }));
    const teams = buildTeamDirectory([{ id: 7, name: "Buffalo Sabres", abbreviation: "BUF", logo: "" },
      { id: 29, name: "Columbus Blue Jackets", abbreviation: "CBJ", logo: "" }]);
    const posts = [
      ["GameDayGoalies", "2118727470493155634", "RT @rachelmlenzi: UPL is in the starter’s net for the morning skate #sabres https://t.co/S2VNvX7WJs"],
      ["GameDayNewsNHL", "2118731705632555008", "RT @MatthewFairburn: Looks like Jiri Kulich could be going in for Ryan McLeod tonight. McLeod wasn’t working on either of the top two PK units at morning skate. Ukko-Pekka Luukkonen in the starter’s net."],
    ] as const;
    for (const [handle, id, text] of posts) {
      const url = `https://x.com/${handle}/status/${id}`, posted = tweetPublicationFromUrl(url)!;
      const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: game.date, teams, rosterByTeam: new Map([[7, roster]]),
        gameIdByTeamId: new Map([[7, game.id], [29, game.id]]), event: { id, source: "fxtwitter", source_account: handle, username: handle,
          text, tweet_id: id, link_to_tweet: url, tweet_created_at: posted, received_at: posted, created_at_label: null, raw_payload: {} } });
      reviewTweetApplicability([source], game.date);
      const row = toLinesCccRow({ source, rosterEntries: roster });
      const claims = extractDurableTweetClaims({ source, game, interpretedAt: posted });
      expect(row.game_id).toBeNull();
      if (handle === "GameDayGoalies") expect(row.goalie_1_player_id).toBeNull();
      else expect(row.metadata.goalieStates).toMatchObject([{ playerId: 8480045, state: "projected" }]);
      expect(claims.some(c => c.semantic.fact?.kind === "availability" || c.semantic.fact?.kind === "starter")).toBe(false);
      expect(reduceTweetSemanticEvents(claims.map(c => c.semantic), posted).actions).toEqual([]);
      expect(buildGoalieBlendFeatures([], 7, { gameId: game.id, linesCccRows: [row as unknown as LinesCccRow] }).confirmed).toBe(false);
    }
  } finally { vi.unstubAllEnvs(); }
});

describe("pipe goalie pairs stay out of shared Lines goalie fields", () => {
  // Zach Cavanagh's Ducks warm-up post (11/15 vs CGY) ends "Husso | Dostál": who was listed, not who starts.
  const ANA = 24, GAME = 2026020328;
  const roster = ([["Judd Caulfield", "R"], ["Leo Carlsson", "C"], ["Cutter Gauthier", "L"], ["Jeffrey Malott", "L"], ["Mikael Granlund", "C"],
    ["Beckett Sennecke", "R"], ["Ian Moore", "D"], ["Tim Washe", "C"], ["Alex Killorn", "L"], ["Nikita Nesterenko", "C"], ["Jack McQueen", "C"],
    ["Troy Terry", "R"], ["Jackson LaCombe", "D"], ["Drew Helleson", "D"], ["Tyson Hinds", "D"], ["Tristan Luneau", "D"], ["Pavel Mintyukov", "D"],
    ["Noah Warren", "D"], ["Ville Husso", "G"], ["Lukas Dostál", "G"], ["Sam Colangelo", "R"], ["Frank Vatrano", "R"], ["Ian Mitchell", "D"]] as const)
    .map(([fullName, position], index) => ({ playerId: 9000 + index, fullName, lastName: fullName.split(" ").pop()!, position, teamId: ANA }));
  const teams = buildTeamDirectory([{ id: ANA, name: "Anaheim Ducks", abbreviation: "ANA", logo: "/teamLogos/ANA.png" },
    { id: 20, name: "Calgary Flames", abbreviation: "CGY", logo: "/teamLogos/CGY.png" }]);
  const post = (goalies: string) => `Anaheim Ducks warm-up line rushes 11/15 vs. #Flames:\n\nCaulfield-Carlsson-Gauthier\nMalott-Granlund-Sennecke\n`
    + `Moore-Washe-Killorn\nNesterenko-McQueen-Terry\n\nLaCombe-Helleson\nHinds-Luneau\nMintyukov-Warren\n\n${goalies}\n\nScratches: Colangelo, Vatrano, Mitchell`;
  // The real serializer, then the real game-prediction reader on the row it would store.
  const read = (goalies: string) => {
    const text = post(goalies);
    const source = buildLinesCccSourceFromIftttEvent({ snapshotDate: "2026-11-15", teams, rosterByTeam: new Map([[ANA, roster]]),
      gameIdByTeamId: new Map([[ANA, GAME], [20, GAME]]),
      event: { id: "pipe", source: "fxtwitter", source_account: "ZachCav", username: "ZachCav", text, tweet_id: "2122126809533923555",
        link_to_tweet: "https://x.com/ZachCav/status/2122126809533923555", tweet_created_at: "2026-11-16T03:40:00Z",
        received_at: "2026-11-16T03:41:00Z", created_at_label: null, raw_payload: { text } } });
    const row = toLinesCccRow({ source, rosterEntries: roster });
    const feature = buildGoalieBlendFeatures([], ANA, { gameId: GAME, linesCccRows: [row as unknown as LinesCccRow] });
    return { source, row, feature };
  };
  afterEach(() => { vi.unstubAllEnvs(); });

  it.each(["Husso | Dostál", "Dostál | Husso"])("'%s' fills neither goalie field and creates no starter", (goalies) => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const { source, row, feature } = read(goalies);
    expect(row).toMatchObject({ status: "observed", nhl_filter_status: "accepted", game_id: GAME,
      goalie_1_player_id: null, goalie_1_name: null, goalie_2_player_id: null, goalie_2_name: null });
    expect(feature).toMatchObject({ confirmed: false, topGoalieId: null });
    expect(feature.source).not.toBe("lines_ccc");
    // The pair is still interpreted, for News display only.
    const units = (source.metadata!.interpretation as TweetInterpretation).units.filter((unit) => unit.situation === "goalie");
    expect(units.map((unit) => [unit.players[0]!.name, unit.listing])).toEqual(goalies.startsWith("Husso")
      ? [["Ville Husso", "pipe_pair"], ["Lukas Dostál", "pipe_pair"]] : [["Lukas Dostál", "pipe_pair"], ["Ville Husso", "pipe_pair"]]);
  });

  it("keeps an unresolved pipe side out of the goalie fields", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    expect(read("Husso | Nobodyson").row).toMatchObject({ goalie_1_name: null, goalie_2_name: null });
  });

  it("control: an independently confirmed starter still reaches goalie_1 and the prediction reader", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const { row, feature } = read("Husso | Dostál\nHusso gets the start tonight.");
    expect(row).toMatchObject({ goalie_1_player_id: 9018, goalie_1_name: "Ville Husso", goalie_2_name: null });
    expect(feature).toMatchObject({ source: "lines_ccc", confirmed: true, topGoalieId: 9018, topGoalieName: "Ville Husso" });
  });
});

describe("shared publication-roster intake", () => {
  const teams = buildTeamDirectory([{ id: 17, abbreviation: "DET", name: "Detroit Red Wings", logo: "" }]);
  const detroit = [
    { playerId: 1, fullName: "Michael Brandsegg-Nygård", lastName: "Brandsegg-Nygård", position: "RW", teamId: 17 },
    { playerId: 2, fullName: "Dylan Larkin", lastName: "Larkin", position: "C", teamId: 17 },
    { playerId: 3, fullName: "Lucas Raymond", lastName: "Raymond", position: "RW", teamId: 17 },
  ];
  const rosterByTeam = new Map([[17, detroit]]);
  const at = "2026-11-18T16:30:00.000Z";
  const context = { teams, rosterByTeam, inferenceRosterByTeam: rosterByTeam, inferencePublishedAt: at };
  const build = (text: string, roster = context) => buildLinesCccSourceFromIftttEvent({
    ...roster, snapshotDate: "2026-11-18", event: { id: "example", source: "ifttt", username: "AnsarKhanMLive",
      source_account: "AnsarKhanMLive", text, tweet_created_at: at, received_at: at, created_at_label: null,
      raw_payload: {}, tweet_id: null, link_to_tweet: null },
  });
  afterEach(() => vi.unstubAllEnvs());

  it("admits a named NHL medical update after an affiliate recall only with a matching publication roster", () => {
    const clubs = buildTeamDirectory([{ id: 59, name: "Utah Hockey Club", abbreviation: "UTA", logo: "" },
      { id: 68, name: "Utah Mammoth", abbreviation: "UTA", logo: "" }]);
    const player = { playerId: 8479977, fullName: "Kailer Yamamoto", lastName: "Yamamoto", teamId: 68, position: "R" };
    const roster = new Map([[68, [player]]]);
    const text = "ROSTER UPDATE\n\nThe @utahmammoth have recalled defenseman Gregor Biber from the Tucson Roadrunners (AHL)\n\nForward Kailer Yamamoto has been placed on IR retroactive to 10/29.";
    const from = (body: string, dated = roster, rosterTime = at) => {
      const input = { teams: clubs, rosterByTeam: roster, inferenceRosterByTeam: dated, inferencePublishedAt: rosterTime };
      const source = build(body, input);
      return [source, refreshLinesCccSourceFromPrimaryText({ ...input, source })];
    };
    for (const source of from(text)) expect(source).toMatchObject({ nhlFilterStatus: "accepted", team: { id: 68 }, gameId: null });
    for (const pair of [from(text, new Map()), from(text, new Map([...roster, [59, [{ ...player, teamId: 59 }]]])),
      from(text, roster, "2026-11-19T16:30:00Z"), from(text + "\nTucson lines tonight"), from(text.replace("@utahmammoth", "@unverified"))])
      for (const source of pair) expect(source).toMatchObject({ nhlFilterStatus: "rejected_non_nhl", gameId: null });
  });

  it("admits Pittsburgh's own medical subject only when native FxTwitter evidence matches", () => {
    const at = "2026-11-20T16:06:02Z", id = "2123810106772955245";
    const body = "Forward Nick Robertson has been placed on Injured Reserve.\n\nForward Avery Hayes has been recalled from @WBSPenguins (AHL).";
    const player = { playerId: 8481582, fullName: "Nick Robertson", lastName: "Robertson", teamId: 5, position: "F" };
    const otherHayes = { playerId: 8485581, fullName: "Travis Hayes", lastName: "Hayes", teamId: 5, position: "F" };
    const roster = new Map([[5, [player, otherHayes]]]);
    const args = { teams: buildTeamDirectory([{ id: 5, name: "Pittsburgh Penguins", abbreviation: "PIT", logo: "" }]),
      snapshotDate: "2026-11-20", inferencePublishedAt: at, inferenceRosterByTeam: roster, rosterByTeam: roster };
    const fx = { id, author: { screen_name: "penguins" }, reposted_by: { screen_name: "GameDayNewsNHL" },
      raw_text: { text: body }, created_timestamp: Date.parse(at) / 1000 };
    const event = { id, source: "fxtwitter", source_account: "GameDayNewsNHL", username: "GameDayNewsNHL", text: "RT @penguins: " + body,
      link_to_tweet: "https://x.com/penguins/status/" + id, tweet_id: id, tweet_created_at: at, created_at_label: at,
      raw_payload: { provider: "fxtwitter", fx }, received_at: "2026-11-20T16:08:00Z" };
    const from = (input: typeof event, dated = roster) => {
      const context = { ...args, inferenceRosterByTeam: dated };
      const source = buildLinesCccSourceFromIftttEvent({ ...context, event: input });
      return [source, refreshLinesCccSourceFromPrimaryText({ ...context, source })];
    };
    for (const source of from(event)) {
      expect(source).toMatchObject({ nhlFilterStatus: "accepted", team: { id: 5 }, gameId: null,
        matchedPlayerIds: [8481582], metadata: { name_inference_review: expect.arrayContaining([
          expect.objectContaining({ rawName: "Avery Hayes", teamId: 5, reason: "conflicting_context", candidatePlayerIds: [8485581] }),
        ]) } });
    }
    for (const source of from(event, new Map([[5, [player]]]))) {
      expect(source.matchedPlayerIds).toEqual([8481582]);
      expect(source.metadata?.name_inference_review).toContainEqual(expect.objectContaining({
        rawName: "Avery Hayes", teamId: 5, reason: "no_dated_match", candidatePlayerIds: [],
      }));
    }
    for (const pair of [from(event, new Map()), from({ ...event, text: event.text.replace("Nick Robertson", "Another Robertson") }),
      from({ ...event, link_to_tweet: event.link_to_tweet.replace("penguins", "Reporter") }),
      from({ ...event, raw_payload: { ...event.raw_payload, fx: { ...fx, created_timestamp: fx.created_timestamp + 1 } } })]) {
      for (const source of pair) expect(source).toMatchObject({ nhlFilterStatus: "rejected_non_nhl", gameId: null });
    }
  });

  it("carries an independently established teammate match into the stored line while preserving its literal evidence", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const text = "Warmup lines tonight\nLarkin - MBN - Raymond";
    const source = build(text);
    const refreshed = refreshLinesCccSourceFromPrimaryText({ ...context, source });
    const row = toLinesCccRow({ source: refreshed, rosterEntries: detroit });
    expect(row).toMatchObject({ raw_text: text, team_id: 17, line_1_player_ids: [3, 1, 2] });
    const reading = refreshed.metadata?.interpretation as TweetInterpretation;
    const start = text.indexOf("MBN");
    expect(reading.identityContext).toMatchObject({ basis: "publication_roster", sourcePublishedAt: at,
      uniqueInitials: [{ text: "MBN", start, end: start + 3, playerId: 1, teamId: 17 }] });
    expect(reading.units[0]?.evidence.map((span) => text.slice(span.start, span.end))).toContain("MBN");
    expect(source.metadata?.interpretation).toEqual(reading);
    expect(detroit[0]).not.toHaveProperty("aliases");
  });

  it("uses an independently identified teammate to resolve an exact cross-team surname for News and Lines", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const home = { playerId: 4, fullName: "David Smith", lastName: "Smith", position: "LW", teamId: 17 };
    const away = { playerId: 5, fullName: "Adam Smith", lastName: "Smith", position: "LW", teamId: 21 };
    const combined = new Map([[17, [...detroit, home]], [21, [away]]]);
    const both = { ...context, teams: [...teams, ...buildTeamDirectory([{ id: 21, abbreviation: "COL", name: "Colorado Avalanche", logo: "" }])],
      rosterByTeam: combined, inferenceRosterByTeam: combined };
    expect(build("Larkin skates with Raymond.", both).team?.id).toBe(17);
    const parsed = build("Larkin skates with Raymond. Smith will not play tonight due to injury.", both);
    const reading = parsed.metadata?.interpretation as TweetInterpretation;
    expect(parsed.team?.id).toBe(17);
    expect(reading.events?.filter(event => event.availability === "out").map(event => event.playerId)).toEqual([4]);
    expect(toLinesCccRow({ source: parsed, rosterEntries: combined.get(17) })).toMatchObject({ injured_player_ids: [4] });
    const sides = build("Detroit Red Wings: Smith will not play tonight due to injury.\nvs Smith", both);
    expect((sides.metadata?.interpretation as TweetInterpretation).events?.filter(event => event.availability === "out").map(event => event.playerId)).toEqual([4]);
    expect(sides.metadata?.name_inference_review).toEqual(expect.arrayContaining([expect.objectContaining({ rawName: "Smith" })]));
    const neutral = build("Smith will not play tonight due to injury.", both);
    expect((neutral.metadata?.interpretation as TweetInterpretation).events).toEqual([]);
    expect(neutral.metadata?.name_inference_review).toEqual(expect.arrayContaining([expect.objectContaining({ candidatePlayerIds: [4, 5] })]));
  });

  it("preserves the same identity boundary on the legacy snapshot path", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "false");
    const parse = (text: string) => toLinesCccRow({ source: build(text), rosterEntries: detroit });
    const row = parse("Detroit Red Wings lines tonight\nLarkin - MBN - Raymond");
    expect(row.matched_player_ids).toEqual([1, 2, 3]);
    expect(row.line_1_player_ids).toEqual([3, 1, 2]);
    for (const text of ["MBN will not play tonight due to injury.", "Detroit Red Wings: Larkim will not play tonight due to injury."]) {
      const review = parse(text);
      expect(review.metadata.name_inference_review).toHaveLength(1);
      expect(review.matched_player_ids).toBeNull();
      expect(review.injured_player_ids).toBeNull();
      expect(review.goalie_1_player_id).toBeNull();
    }
  });

  it("binds an explicitly reported injury by initials, and sends the beat-only, fuzzy and ambiguous readings to review", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const explicit = build("Detroit Red Wings: MBN will not play tonight due to injury.");
    expect((explicit.metadata?.interpretation as TweetInterpretation).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 1, availability: "out" }),
    ]));
    const collision = new Map([[17, [...detroit, { ...detroit[0]!, playerId: 4, fullName: "Mark Barry-Nolan", lastName: "Barry-Nolan" }]]]);
    const reviews = [
      { text: "MBN will not play tonight due to injury.", reason: "beat_only", names: [1], roster: context },
      { text: "Detroit Red Wings: Larkim will not play tonight due to injury.", reason: "fuzzy_name", names: [2], roster: context },
      { text: "Detroit Red Wings: MBN will not play tonight due to injury.", reason: "ambiguous_initials", names: [1, 4],
        roster: { ...context, rosterByTeam: collision, inferenceRosterByTeam: collision } },
    ];
    for (const { text, reason, names, roster } of reviews) {
      const parsed = build(text, roster);
      const row = toLinesCccRow({ source: parsed, rosterEntries: roster.rosterByTeam.get(17) });
      expect(row.raw_text).toBe(text);
      expect(row.metadata.name_inference_review).toEqual(expect.arrayContaining([expect.objectContaining({ candidatePlayerIds: names, reason })]));
      expect((parsed.metadata?.interpretation as TweetInterpretation).events).toEqual([]);
      expect(row.injured_player_ids).toBeNull();
      expect(row.matched_player_ids).toBeNull();
    }
    const wrapper = build(reviews[0]!.text);
    const corrected = refreshLinesCccSourceFromPrimaryText({ ...context,
      source: { ...wrapper, primaryTextSource: "quoted_oembed", quotedRawText: "Detroit Red Wings: MBN will not play tonight due to injury." } });
    expect(corrected.metadata).not.toHaveProperty("name_inference_review");
    expect((corrected.metadata?.interpretation as TweetInterpretation).events?.map((event) => event.playerId)).toContain(1);
  });
});

describe("retained FxTwitter primary source links", () => {
  const id = "2121674596671947247";
  const url = `https://x.com/houston_brogan/status/${id}`;
  const generic = `https://twitter.com/i/web/status/${id}`;
  const text = "Logan Cooley: Day to day.";
  const fx = { id, author: { screen_name: "houston_brogan" }, raw_text: { text },
    reposted_by: { screen_name: "GameDayNewsNHL" }, created_timestamp: "1794681617" };
  const event = { id: "fixture-retained-fx-fields", created_at_label: "2026-11-14T18:40:17Z", source: "fxtwitter", source_account: "GameDayNewsNHL", username: "GameDayNewsNHL",
    text: `RT @houston_brogan: ${text}`, link_to_tweet: url, tweet_id: id,
    tweet_created_at: "2026-11-14T18:40:17Z", received_at: "2026-11-14T18:46:08.559355Z",
    raw_payload: { provider: "fxtwitter", fx } };
  const parsed = buildLinesCccSourceFromIftttEvent({ event, teams: [utah!], snapshotDate: "2026-11-14", rosterByTeam: new Map() });
  it("retains the exact original separately from the generic capture identity and arrival", () => {
    const row = toLinesCccRow({ source: parsed });
    expect(row.source_url).toBe(url);
    expect(row.tweet_url).toBe(generic);
    const expandedPayload = { provider: "fxtwitter", fx, data: { id, referenced_tweets: [{ type: "retweeted", id }] },
      includes: { tweets: [{ id, text, author_id: "31", created_at: event.tweet_created_at }], users: [{ id: "31", username: "houston_brogan" }] } };
    expect(toLinesCccRow({ source: { ...parsed, rawPayload: expandedPayload } }).source_url).toBe(url);
    expect(toLinesCccRow({ source: { ...parsed, rawPayload: { provider: "fxtwitter", fx: { ...fx, created_timestamp: 1794681617 } } } }).source_url).toBe(url);
  });
  it("keeps the primary byline when the poller appends exactly the linked quote", () => {
    const quotedTweetId = "2121664238527881291";
    const quotedTweetUrl = "https://x.com/Real_Max_Miller/status/" + quotedTweetId;
    const linked = { ...parsed, quotedTweetId, quotedTweetUrl, quotedAuthorHandle: "Real_Max_Miller",
      enrichedText: event.text + " " + quotedTweetUrl };
    expect(toLinesCccRow({ source: linked }).source_url).toBe(url);
    expect(toLinesCccRow({ source: { ...linked, quotedTweetId: id } }).source_url).toBe(generic);
    expect(toLinesCccRow({ source: { ...linked, quotedAuthorHandle: "other" } }).source_url).toBe(generic);
    expect(toLinesCccRow({ source: { ...linked, enrichedText: linked.enrichedText + " correction" } }).source_url).toBe(generic);
  });
  it("keeps the prior snapshot URL when a provider, author, post, primary text or clock witness conflicts", () => {
    const raw = (overrides: Record<string, unknown>) => ({ rawPayload: { provider: "fxtwitter", fx: { ...fx, ...overrides } } });
    const changes: Partial<typeof parsed>[] = [
      raw({ id: "2121674596671947248" }), raw({ author: { screen_name: "other" } }),
      raw({ raw_text: { text: "Different report" } }), raw({ reposted_by: { screen_name: "other" } }),
      raw({ created_timestamp: "1794681618" }), { tweetPostedAt: event.received_at },
      { rawPayload: { provider: "ifttt", fx } }, { rawPayload: {} },
      { rawPayload: { provider: "fxtwitter", fx, data: { id: "different" } } },
      { rawPayload: { provider: "fxtwitter", fx, data: { id, referenced_tweets: [null] } } },
      { rawPayload: { provider: "fxtwitter", fx, data: { id, referenced_tweets: [{ type: "retweeted", id }] },
        includes: { tweets: [{ id, text, author_id: "31" }], users: [{ id: "31", username: "other" }] } } },
      { primaryTextSource: "quoted_oembed" }, { enrichedText: "RT @other: " + text },
      { sourceHandle: "other" }, { metadata: { ...parsed.metadata, providerPostUrl: generic } },
      { tweetUrl: generic + "9" }, { sourceUrl: "https://x.com/other/status/" + id },
    ];
    for (const change of changes) {
      const altered = { ...parsed, ...change };
      expect(toLinesCccRow({ source: altered }).source_url).toBe(altered.sourceUrl ?? altered.tweetUrl);
    }
  });
});

it("keeps the schedule placeholder out of team matching on retained injury wording", () => {
  const [placeholder]=buildTeamDirectory([{id:70,name:"To be determined",abbreviation:"TBD",logo:""}]);
  const parse=(text:string)=>buildLinesCccSourceFromIftttEvent({event:{id:"injury",source:"fxtwitter",source_account:"GameDayNewsNHL",username:"GameDayNewsNHL",text,
    link_to_tweet:null,tweet_id:null,tweet_created_at:null,created_at_label:null,raw_payload:{},received_at:"2026-11-12T19:24:12Z"},
    snapshotDate:"2026-11-12",teams:[placeholder!,utah!],rosterByTeam:new Map()});
  for(const text of ["There are more exams that need to be done.", "Opponent TBD.", "Opponent to be determined."]) {
    const source=parse(text);
    expect(source.team?.id).toBeUndefined();
    expect(source.metadata?.teamLabelMatches).toEqual([]);
  }
  const club=parse("Utah Mammoth injury update. More exams need to be done.");
  expect(club.team?.abbreviation).toBe("UTA");
  expect(club.metadata?.teamLabelMatches).toEqual(["UTA"]);
});

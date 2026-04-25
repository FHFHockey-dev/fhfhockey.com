import { describe, expect, it } from "vitest";

import { buildTeamDirectory } from "./lineupSourceIngestion";
import { buildLinesCccSourceFromIftttEvent, toLinesCccRow } from "./linesCccIngestion";

const [canadiens] = buildTeamDirectory([
  {
    id: 8,
    name: "Montréal Canadiens",
    abbreviation: "MTL",
    logo: "/teamLogos/MTL.png"
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
  { playerId: 9, fullName: "Jakub Dobes", lastName: "Dobes" }
];

describe("linesCccIngestion", () => {
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
      matchedNames: ["Jakub Dobes"]
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

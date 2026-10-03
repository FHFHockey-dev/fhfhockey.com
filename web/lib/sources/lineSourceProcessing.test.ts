import { describe, expect, it } from "vitest";

import { collectUnresolvedNamesFromLineRows, reviewTweetApplicability } from "./lineSourceProcessing";
import { interpretTweetUnits } from "./tweetInterpretation";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { toLinesCccRow, type ParsedLinesCccSource } from "./linesCccIngestion";
import { projectionReportFromSource } from "./tweetProjectionStorage";

it("retains explicitly current claims while keeping future claims under temporal review", () => {
  const players = [{ playerId: 1, fullName: "Josh Norris", lastName: "Norris" }, { playerId: 2, fullName: "Ryan McLeod", lastName: "McLeod" }, { playerId: 3, fullName: "Konsta Helenius", lastName: "Helenius" }];
  const text = "Tonight's lines\nNorris-McLeod-Helenius\nTomorrow's lines\nHelenius-Norris-McLeod\nNorris will play tonight. McLeod will play tomorrow.";
  const interpretation = { ...interpretTweetUnits(text, players), events: extractTweetPlayerEvents({ text, players, publishedAt: "2026-10-01T03:30:00Z" }) };
  const source: ParsedLinesCccSource = { snapshotDate: "2026-09-30", tweetPostedAt: "2026-10-01T03:30:00Z", gameId: 10, team: { id: 2, abbreviation: "BUF", name: "Buffalo Sabres", logo: "", slug: "buf", location: "Buffalo", shortName: "Sabres", hashtags: [] }, nhlFilterStatus: "accepted", rawText: text, metadata: { interpretation } };
  reviewTweetApplicability([source], "2026-09-30");
  expect(source.nhlFilterStatus).toBe("accepted");
  expect(source.gameId).toBe(10);
  expect(source.metadata?.interpretation).toMatchObject({ units: [{ players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }] }], events: [{ playerId: 1 }] });
  expect((source.metadata?.interpretation as typeof interpretation).units).toHaveLength(1);
  expect((source.metadata?.interpretation as typeof interpretation).events).toHaveLength(1);
  expect(source.metadata?.temporalReview).toMatchObject({ interpretation });
  expect(source.rawText).toBe(text);
  const row = toLinesCccRow({ source, rosterEntries: players });
  expect(row.line_2_player_names).toBeNull();
  const report = projectionReportFromSource(source)!;
  expect(report.interpretation.events?.map((event) => event.playerId)).toEqual([1]);
  expect(report.interpretation.units).toHaveLength(1);
  const metadata = JSON.stringify(source.metadata);
  reviewTweetApplicability([source], "2026-09-30");
  expect(JSON.stringify(source.metadata)).toBe(metadata);
  reviewTweetApplicability([source], "2026-10-01");
  expect(source.nhlFilterStatus).toBe("rejected_ambiguous");
  expect(source.gameId).toBeNull();
  const futureText = "Tonight's lines\nNorris-McLeod-Helenius\nYesterday:\nHelenius-Norris-McLeod";
  const futureSource: ParsedLinesCccSource = { snapshotDate: "2026-09-30", tweetPostedAt: "2026-10-01T03:30:00Z", nhlFilterStatus: "accepted", rawText: futureText, metadata: { interpretation: interpretTweetUnits(futureText, players) } };
  reviewTweetApplicability([futureSource], "2026-09-30");
  expect((futureSource.metadata?.interpretation as typeof interpretation).units).toHaveLength(1);
  const reversedText = "Tomorrow's lines\nHelenius-Norris-McLeod\nTonight's lines\nNorris-McLeod-Helenius";
  const reversedSource: ParsedLinesCccSource = { ...futureSource, rawText: reversedText, metadata: { interpretation: interpretTweetUnits(reversedText, players) } };
  reviewTweetApplicability([reversedSource], "2026-09-30");
  const reversedRow = toLinesCccRow({ source: reversedSource, rosterEntries: players });
  expect(reversedRow.line_1_player_names).toBeNull();
  expect(reversedRow.line_2_player_names).not.toBeNull();
  const separateDatesText = "Norris will play tonight. Norris will not play tomorrow.";
  const separateDates: ParsedLinesCccSource = { ...source, nhlFilterStatus: "accepted", gameId: 10, rawText: separateDatesText, metadata: { interpretation: { ...interpretTweetUnits(separateDatesText, players), events: extractTweetPlayerEvents({ text: separateDatesText, players, publishedAt: source.tweetPostedAt ?? null }) } } };
  reviewTweetApplicability([separateDates], "2026-09-30");
  expect((separateDates.metadata?.interpretation as typeof interpretation).events).toMatchObject([{ playerId: 1, availability: "available" }]);
  expect((separateDates.metadata?.interpretation as typeof interpretation).events).toHaveLength(1);
});

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    capture_key: "capture-1",
    source: "gamedaylines",
    source_group: "gdl_suite",
    source_key: "gamedaylines",
    source_account: "GameDayLines",
    source_url: "https://twitter.com/i/web/status/2050267867149672449",
    tweet_id: "2050267867149672449",
    quoted_tweet_id: null,
    team_id: 54,
    team_abbreviation: "VGK",
    status: "observed",
    nhl_filter_status: "accepted",
    classification: "lineup",
    raw_text: null,
    enriched_text:
      "Karlsson didn’t take line rushes.\nR. Smith-Hertl-Kolesar\nC. Smith-Dowd-Sissons",
    quoted_raw_text: null,
    quoted_enriched_text: null,
    unmatched_names: null,
    line_1_player_ids: null,
    line_1_player_names: null,
    line_2_player_ids: null,
    line_2_player_names: null,
    line_3_player_ids: null,
    line_3_player_names: null,
    line_4_player_ids: null,
    line_4_player_names: null,
    pair_1_player_ids: null,
    pair_1_player_names: null,
    pair_2_player_ids: null,
    pair_2_player_names: null,
    pair_3_player_ids: null,
    pair_3_player_names: null,
    scratches_player_ids: null,
    scratches_player_names: null,
    injured_player_ids: null,
    injured_player_names: null,
    goalie_1_player_id: null,
    goalie_1_name: null,
    goalie_2_player_id: null,
    goalie_2_name: null,
    ...overrides,
  };
}

describe("lineSourceProcessing", () => {
  it("keeps source ordinals, candidate IDs and abbreviations in interpretation review", () => {
    const rows = collectUnresolvedNamesFromLineRows([buildRow({ metadata: { interpretation: {
      units: [], unresolved: [{ text: "LDBB", start: 10, end: 14, reason: "missing_player", number: 4, situation: "es_forward", candidates: [] }],
    } } })] as any);
    expect(rows).toMatchObject([{ raw_name: "LDBB", metadata: { sourceOrdinal: 4, situation: "es_forward", candidates: [], evidence: { start: 10, end: 14 } } }]);
  });
  it("expands ambiguous unmatched last names to initial-qualified context aliases", () => {
    const rows = collectUnresolvedNamesFromLineRows([
      buildRow({
        unmatched_names: ["Smith"],
      }),
    ] as any);

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw_name: "R. Smith",
          normalized_name: "r. smith",
          metadata: expect.objectContaining({
            reason: "unmatched_names",
            parserReason: "unmatched_names",
            contextAlias: "R. Smith",
            sourceGroup: "gdl_suite",
            sourceKey: "gamedaylines",
            sourceAccount: "GameDayLines",
          }),
        }),
        expect.objectContaining({
          raw_name: "C. Smith",
          normalized_name: "c. smith",
          metadata: expect.objectContaining({
            reason: "unmatched_names",
            contextAlias: "C. Smith",
          }),
        }),
      ]),
    );
  });
});

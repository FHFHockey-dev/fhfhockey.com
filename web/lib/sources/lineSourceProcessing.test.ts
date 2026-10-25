import { describe, expect, it } from "vitest";

import { applyPlayerNameAliasesToRosterMap, collectUnresolvedNamesFromLineRows, fetchPlayerNameAliases, persistUnresolvedPlayerNames, reviewTweetApplicability } from "./lineSourceProcessing";
import { resolvePlayerIdentity } from "./playerIdentity";
import { aliasReviewNameCandidates, getAliasReviewOccurrence, preferredAliasReviewCandidate } from "./playerAliasReview";
import { interpretTweetUnits } from "./tweetInterpretation";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { toLinesCccRow, type ParsedLinesCccSource } from "./linesCccIngestion";
import { projectionReportFromSource } from "./tweetProjectionStorage";

it("retains explicitly current claims while keeping future claims under temporal review", () => {
  const players = [{ playerId: 1, fullName: "Josh Norris", lastName: "Norris", position: "F", teamId: 2 }, { playerId: 2, fullName: "Ryan McLeod", lastName: "McLeod", position: "F", teamId: 2 }, { playerId: 3, fullName: "Konsta Helenius", lastName: "Helenius", position: "F", teamId: 2 }];
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
  const jack = { id: 8481559, fullName: "Jack Hughes", lastName: "Hughes", position: "C", team_id: 1 };
  const luke = { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes", position: "D", team_id: 1 };
  const hughesText = "Lineup\nMantha - Hughes - Bratt\nHughes - Pesce";
  const hughesIssues = [hughesText.indexOf("Hughes"), hughesText.lastIndexOf("Hughes")].map((start, index) => ({ text: "Hughes", start, end: start + 6, reason: "ambiguous", situation: index === 0 ? "es_forward" : "es_defense", number: 1, candidates: [jack.id, luke.id] }));

  it("retains each repeated surname occurrence and its parsed role under a distinct stable key", () => {
    const source = buildRow({ enriched_text: hughesText, metadata: { interpretation: { units: [], unresolved: hughesIssues } } });
    const rows = collectUnresolvedNamesFromLineRows([source] as any);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.dedupe_key)).toHaveLength(new Set(rows.map((row) => row.dedupe_key)).size);
    expect(rows.map((row) => row.metadata)).toMatchObject([
      { evidence: { start: hughesIssues[0].start, end: hughesIssues[0].end, text: "Hughes" }, situation: "es_forward" },
      { evidence: { start: hughesIssues[1].start, end: hughesIssues[1].end, text: "Hughes" }, situation: "es_defense" },
    ]);
    expect(collectUnresolvedNamesFromLineRows([source, source] as any).map((row) => row.dedupe_key)).toEqual(rows.map((row) => row.dedupe_key));
  });

  it.each(["es_forward", "es_defense"])("prefers the matching Hughes position for a recorded %s occurrence", (situation) => {
    const issue = hughesIssues[situation === "es_forward" ? 0 : 1];
    const row = { raw_name: "Hughes", context_text: hughesText, team_id: 1, metadata: { evidence: issue, situation } };
    const occurrence = getAliasReviewOccurrence(row);
    expect(preferredAliasReviewCandidate(row, [jack, luke], occurrence).playerId).toBe(situation === "es_forward" ? jack.id : luke.id);
  });

  it.each(["missing", "contradictory", "invalid", "unknown_position"])("does not prefer a Hughes identity with %s role evidence", (kind) => {
    const row = { raw_name: "Hughes", context_text: hughesText, team_id: 1, metadata: { evidence: hughesIssues[1], situation: kind === "missing" ? null : kind === "contradictory" ? "es_forward" : "es_defense", reason: kind === "invalid" ? "invalid_extraction" : "ambiguous" } };
    const candidates = kind === "unknown_position" ? [jack, { ...luke, position: null }] : [jack, luke];
    expect(preferredAliasReviewCandidate(row, candidates, getAliasReviewOccurrence(row)).playerId).toBeNull();
  });

  it("preserves a source initial when an older extraction retained only the surname", () => {
    const text = "B. Tkachuk - Eller - Reinhart\nVerhaeghe - Bennett - M. Tkachuk";
    const start = text.indexOf("Tkachuk");
    const source = buildRow({ enriched_text: text, metadata: { interpretation: { units: [], unresolved: [{ text: "Tkachuk", start, end: start + 7, reason: "ambiguous", situation: "es_forward" }] } } });
    const rows = collectUnresolvedNamesFromLineRows([source] as any);
    expect(rows).toMatchObject([{ raw_name: "B. Tkachuk", normalized_name: "b. tkachuk", metadata: { evidence: { start: 0, end: 10, text: "B. Tkachuk" } } }]);
    expect(aliasReviewNameCandidates("B. Tkachuk", [{ id: 1, fullName: "Brady Tkachuk", lastName: "Tkachuk", position: "L", team_id: 13 }, { id: 2, fullName: "Matthew Tkachuk", lastName: "Tkachuk", position: "L", team_id: 13 }]).map((player) => player.fullName)).toEqual(["Brady Tkachuk"]);
  });

  it("does not choose a repeated old occurrence without offsets or a trustworthy row target", () => {
    const row = { raw_name: "Hughes", context_text: hughesText, team_id: 1, metadata: { reason: "ambiguous" } };
    expect(getAliasReviewOccurrence(row)).toBeNull();
    expect(preferredAliasReviewCandidate(row, [jack, luke], null).playerId).toBeNull();
    expect(getAliasReviewOccurrence({ ...row, metadata: { reason: "pair_1_null_id" } })).toMatchObject({ start: hughesIssues[1].start, basis: "contextual_row" });
  });
  it("does not invent an initial-qualified token across different source rows", () => {
    expect(getAliasReviewOccurrence({ raw_name: "B. Tkachuk", context_text: "B.\nTkachuk - Eller - Reinhart", team_id: 13 })).toBeNull();
  });

  it("loads saved aliases afresh for future resolution while preserving team and membership boundaries", async () => {
    let aliases = [{ alias: "Troch", player_id: 8476389, team_id: 68 }];
    const query: any = { select: () => query, or: () => query, order: () => query, range: async () => ({ data: aliases, error: null }) };
    const supabase = { from: () => query };
    const roster = [{ playerId: 8476389, fullName: "Vincent Trocheck", lastName: "Trocheck", teamId: 68 }];
    const loaded = await fetchPlayerNameAliases({ supabase, teamIds: [68] });
    const enriched = applyPlayerNameAliasesToRosterMap({ rosterByTeam: new Map([[68, roster]]), aliases: loaded });
    expect(resolvePlayerIdentity("Troch", enriched.get(68)!)).toMatchObject({ status: "matched", basis: "alias", player: { playerId: 8476389 } });
    aliases = [{ alias: "Trochy", player_id: 8476389, team_id: 68 }];
    const refreshed = applyPlayerNameAliasesToRosterMap({ rosterByTeam: new Map([[68, roster], [4, []], [15, roster]]), aliases: await fetchPlayerNameAliases({ supabase, teamIds: [68] }) });
    expect(resolvePlayerIdentity("Trochy", refreshed.get(68)!)).toMatchObject({ status: "matched", basis: "alias" });
    expect(resolvePlayerIdentity("Troch", refreshed.get(68)!)).toMatchObject({ status: "missing_player" });
    expect(resolvePlayerIdentity("Trochy", refreshed.get(4)!)).toMatchObject({ status: "missing_player" });
    expect(resolvePlayerIdentity("Trochy", refreshed.get(15)!)).toMatchObject({ status: "missing_player" });
  });

  it("preserves a resolved receipt when the identical source is queued again", async () => {
    const source = buildRow({ unmatched_names: ["Bunting"] });
    const [pending] = collectUnresolvedNamesFromLineRows([source] as any);
    const receipt = { ...pending, id: "saved-receipt", status: "resolved", resolved_player_id: 8478047 };
    const stored = new Map([[String(pending.dedupe_key), receipt]]);
    const supabase = { from: () => ({ upsert: (rows: any[], options: { onConflict: string; ignoreDuplicates: boolean }) => ({ select: async () => {
      expect(options.onConflict).toBe("dedupe_key");
      const inserted: any[] = [];
      for (const row of rows) {
        if (stored.has(row.dedupe_key) && options.ignoreDuplicates) continue;
        stored.set(row.dedupe_key, row); inserted.push({ id: "new-receipt" });
      }
      return { data: inserted, error: null };
    } }) }) };
    expect(await persistUnresolvedPlayerNames({ supabase, rows: [source] as any })).toBe(0);
    expect(stored.get(String(pending.dedupe_key))).toEqual(receipt);
    const [otherTweet] = collectUnresolvedNamesFromLineRows([buildRow({ unmatched_names: ["Bunting"], tweet_id: "different-tweet" })] as any);
    expect(otherTweet.dedupe_key).not.toBe(pending.dedupe_key);
  });

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

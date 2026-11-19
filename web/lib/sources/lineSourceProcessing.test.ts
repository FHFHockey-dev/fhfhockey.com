import { describe, expect, it } from "vitest";
import { buildGoalieBlendFeatures, type LinesCccRow as PredictionLinesRow } from "../game-predictions/featureBuilder";

import { applyPlayerNameAliasesToRosterMap, collectUnresolvedNamesFromLineRows, fetchPlayerNameAliases, persistUnresolvedPlayerNames, reviewTweetApplicability } from "./lineSourceProcessing";
import { resolvePlayerIdentity } from "./playerIdentity";
import { aliasReviewNameCandidates, getAliasReviewOccurrence, preferredAliasReviewCandidate } from "./playerAliasReview";
import { interpretTweetUnits } from "./tweetInterpretation";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { buildLinesCccSourceFromIftttEvent, buildRowGoalies, toLinesCccRow, type ParsedLinesCccSource } from "./linesCccIngestion";
import { projectionReportFromSource } from "./tweetProjectionStorage";

// Source heading and reported personnel from Tampa's Nov 16 Washington preview.
// The same-day relay clock and roster IDs isolate the applicability check.
const previewPlayers = ([
  ["Brandon Hagel", "F"], ["Jake Guentzel", "F"], ["Nikita Kucherov", "F"],
  ["Victor Hedman", "D"], ["JJ Moser", "D"], ["Andrei Vasilevskiy", "G"], ["Dennis Hildeby", "G"],
] as const).map(([fullName, position], index) => ({
  fullName, lastName: fullName.split(" ").pop()!, position, playerId: index + 1, teamId: 14,
}));
const previousLineup = "Lines from Saturday's game (subject to change)\nForwards\nHagel-Guentzel-Kucherov\nDefensemen\nHedman-Moser\nGoaltenders\nVasilevskiy\nHildeby";
function previewSource(text: string): ParsedLinesCccSource {
  const publishedAt = "2026-11-17T15:00:00Z";
  const events = extractTweetPlayerEvents({ text, players: previewPlayers, publishedAt });
  const interpretation = { ...interpretTweetUnits(text, previewPlayers), events };
  const { goalies, states } = buildRowGoalies({ interpretation, events, rosterEntries: previewPlayers });
  return { snapshotDate: "2026-11-17", tweetPostedAt: publishedAt, gameId: 2026020334,
    tweetId: "101", tweetUrl: "https://x.com/FixtureReporter/status/101", sourceHandle: "FixtureReporter",
    rawText: text, team: { id: 14, abbreviation: "TBL", name: "Tampa Bay Lightning", location: "Tampa Bay",
      logo: "", shortName: "Lightning", slug: "tbl", hashtags: [] },
    nhlFilterStatus: "accepted", goalies, metadata: { interpretation, goalieStates: states } };
}

it("keeps Tampa's prior Saturday lineup out of Tuesday's game even under a current preview header", () => {
  const source = previewSource("Tonight's matchup: Washington at Tampa Bay\n" + previousLineup);
  expect((source.metadata!.interpretation as ReturnType<typeof interpretTweetUnits>).units.length).toBeGreaterThan(0);
  reviewTweetApplicability([source], source.snapshotDate);
  const row = toLinesCccRow({ source, rosterEntries: previewPlayers });
  expect([row.game_id, row.line_1_player_names, row.pair_1_player_names, row.goalie_1_name, row.goalie_2_name]).toEqual([null, null, null, null, null]);
  expect(projectionReportFromSource(source)).toBeNull();
  expect(row.raw_text).toContain(previousLineup);
});

it("does not attach last Saturday's archived section to a new Saturday on the relay weekday alone", () => {
  const source = previewSource("Tonight's matchup\n" + previousLineup);
  source.snapshotDate = "2026-11-21";
  source.tweetPostedAt = "2026-11-21T15:00:00Z";
  reviewTweetApplicability([source], source.snapshotDate);
  expect(source.gameId).toBeNull();
  expect(toLinesCccRow({ source, rosterEntries: previewPlayers }).raw_text).toContain(previousLineup);
});

it.each(["Vasilevskiy | Hildeby", "Hildeby | Vasilevskiy"])("keeps a current neutral listing out of shared goalie slots during temporal review: %s", pair => {
  const source = previewSource(`Tonight's lines\nGuentzel-Hagel-Kucherov\n${pair}\n${previousLineup}`);
  reviewTweetApplicability([source], source.snapshotDate);
  const row = toLinesCccRow({ source, rosterEntries: previewPlayers });
  expect(row.status).toBe("observed");
  expect(row.line_1_player_names).toHaveLength(3);
  expect(row.line_2_player_names).toBeNull();
  expect([row.goalie_1_name, row.goalie_2_name]).toEqual([null, null]);
  expect(buildGoalieBlendFeatures([], 14, { gameId: 2026020334, linesCccRows: [row as unknown as PredictionLinesRow] }).confirmed).toBe(false);
  const report = projectionReportFromSource(source)!;
  expect(report.interpretation.units.filter(unit => unit.situation === "goalie").map(unit => unit.players[0]!.name))
    .toEqual(pair.split(" | ").map(surname => previewPlayers.find(player => player.lastName === surname)!.fullName));
});

it("keeps an independent current confirmation and its evidence when the same source includes older goalies", () => {
  const source = previewSource("Vasilevskiy starts tonight.\n" + previousLineup);
  const original = source.metadata!.interpretation;
  reviewTweetApplicability([source], source.snapshotDate);
  const row = toLinesCccRow({ source, rosterEntries: previewPlayers });
  expect(row.goalie_1_name).toBe("Andrei Vasilevskiy");
  expect(row.goalie_2_name).toBeNull();
  expect(source.metadata!.temporalReview).toMatchObject({ interpretation: original });
  expect(buildGoalieBlendFeatures([], 14, { gameId: 2026020334, linesCccRows: [row as unknown as PredictionLinesRow] }).confirmed).toBe(true);
});

it("withholds legacy text-only slots when historical player spans are unavailable", () => {
  const source = previewSource(previousLineup);
  delete source.metadata!.interpretation;
  reviewTweetApplicability([source], source.snapshotDate);
  const row = toLinesCccRow({ source, rosterEntries: previewPlayers });
  expect(row).toMatchObject({ status: "rejected", game_id: null, goalie_1_name: null, raw_text: previousLineup });
});

it("treats a relative starter statement inside a previous game's section as historical", () => {
  const source = previewSource(previousLineup + "\nVasilevskiy starts tonight.");
  reviewTweetApplicability([source], source.snapshotDate);
  expect(projectionReportFromSource(source)).toBeNull();
  expect(toLinesCccRow({ source, rosterEntries: previewPlayers }).goalie_1_name).toBeNull();
});

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

  it("queues exact inferred occurrences from a rejected unbound quote without promoting its candidates", () => {
    const suggestion = { rawName: "UPL", teamId: null, reason: "beat_only", candidatePlayerIds: [100, 100] };
    const source = buildRow({ status: "rejected", nhl_filter_status: "rejected_ambiguous", team_id: null, primary_text_source: "quoted_oembed",
      raw_text: "Wrapper text includes UPL", quoted_raw_text: "  UPL and UPL  ", quoted_tweet_id: "original", quoted_tweet_url: "https://x.com/reporter/status/123",
      metadata: { name_inference_published_at: "2026-11-08T14:00:00Z", name_inference_review: [
        { ...suggestion, start: 0, end: 3 }, { ...suggestion, start: 8, end: 11 }, { ...suggestion, start: 1, end: 4 },
      ] } });
    const rows = collectUnresolvedNamesFromLineRows([source, source] as any);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => (row.metadata as any).evidence.start)).toEqual([0, 8]);
    for (const row of rows) expect(row).toMatchObject({ raw_name: "UPL", context_text: "UPL and UPL", team_id: null,
      status: "pending", source_url: "https://x.com/reporter/status/123", metadata: { occurrenceOnly: true, candidates: [100],
        sourcePublishedAt: "2026-11-08T14:00:00Z", reviewKind: "beat_only" } });
  });
  it("retains an actual beat-only UPL suggestion through the shared interpreter and row serializer", () => {
    const publishedAt = "2026-11-08T14:00:00Z";
    const roster = new Map([[7, [{ playerId: 8480045, fullName: "Ukko-Pekka Luukkonen", lastName: "Luukkonen", teamId: 7, position: "G" }]]]);
    const source = buildLinesCccSourceFromIftttEvent({
      event: { id: "event", source: "ifttt", source_account: "Reporter", username: "Reporter", tweet_id: "101", text: "UPL in the starter's net.",
        link_to_tweet: "https://x.com/Reporter/status/101", tweet_created_at: publishedAt, received_at: publishedAt, created_at_label: null, raw_payload: {} },
      snapshotDate: "2026-11-08", teams: [{ id: 7, abbreviation: "BUF", name: "Buffalo Sabres", shortName: "Sabres", location: "Buffalo", hashtags: [], slug: "buf", logo: "" }],
      rosterByTeam: roster, inferenceRosterByTeam: roster, inferencePublishedAt: publishedAt, inferredBeatTeamIds: [7],
    });
    const row = toLinesCccRow({ source, rosterEntries: [] });
    expect(row.game_id).toBeNull();
    expect(row.goalie_1_player_id).toBeNull();
    expect(collectUnresolvedNamesFromLineRows([row])).toMatchObject([{ team_id: null, raw_name: "UPL", status: "pending",
      metadata: { occurrenceOnly: true, reason: "beat_only", suggestedTeamId: 7, candidates: [8480045], sourcePublishedAt: publishedAt.replace("Z", ".000Z") } }]);
  });
  it("does not create a second learnable alias prompt for the same inferred and interpreted occurrence", () => {
    const text = "Hughes - Pesce";
    const issue = { text: "Hughes", start: 0, end: 6, reason: "ambiguous", candidates: [1, 2] };
    const source = buildRow({ enriched_text: text, metadata: { interpretation: { unresolved: [issue] },
      name_inference_review: [{ rawName: "Hughes", teamId: 1, start: 0, end: 6, reason: "ambiguous", candidatePlayerIds: [1, 2] }] } });
    expect(collectUnresolvedNamesFromLineRows([source] as any)).toMatchObject([{ metadata: { occurrenceOnly: true } }]);
  });
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

  it("applies a team + position-group alias only on that team and in that kind of slot", async () => {
    const aliases = [{ alias: "Hughes", player_id: 20, team_id: 1, position_group: "D" }, { alias: "Hughesy", player_id: 5, team_id: null, position_group: null }];
    const query: any = { select: () => query, or: () => query, order: () => query, range: async () => ({ data: aliases, error: null }) };
    const loaded = await fetchPlayerNameAliases({ supabase: { from: () => query }, teamIds: [1, 2] });
    const roster = (teamId: number) => [
      { playerId: 5, fullName: "Jack Hughes", lastName: "Hughes", position: "C", teamId },
      { playerId: 20, fullName: "Luke Hughes", lastName: "Hughes", position: null, teamId },
    ];
    const enriched = applyPlayerNameAliasesToRosterMap({ rosterByTeam: new Map([[1, roster(1)], [2, roster(2)]]), aliases: loaded });
    // Luke's position is unknown here, so only the scoped alias can place him in a pair.
    expect(resolvePlayerIdentity("Hughes", enriched.get(1)!, undefined, "es_defense")).toMatchObject({ status: "matched", basis: "alias", player: { playerId: 20 } });
    expect(resolvePlayerIdentity("Hughes", enriched.get(1)!, undefined, "es_forward").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Hughes", enriched.get(1)!).status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Hughes", enriched.get(2)!, undefined, "es_defense").status).toBe("ambiguous");
    expect(resolvePlayerIdentity("Hughesy", enriched.get(2)!)).toMatchObject({ status: "matched", player: { playerId: 5 } });
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

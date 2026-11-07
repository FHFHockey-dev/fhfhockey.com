import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
vi.mock("lib/sources/tweetProjectionStorage", () => ({ projectionReportFromSource: (source: any) => structuredClone(source.metadata.testReport) }));
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: any) => game }));
import { decideBinding, decideContext, produceLineEvidence } from "./decisions";
import { AUTHORITY_SEED, authorityTier, authorityWeight, RELAY_ACCOUNTS, RELAY_ONLY_WEIGHT, sourceAttribution, TEAM_ACCOUNTS } from "./authority";
import clubLedger from "./fixtures/clubHandles.ledger.json";
import { teamsInfo } from "lib/teamsInfo";
import { readReviewedDecision } from "./trainerDecisions";
import { detectTweetLineContext, extractTweetUnitChanges, lineupChangeEvents } from "lib/sources/tweetInterpretation";
import { processLineSnapshotEvidence } from "./processor";
import type { LineGame } from "./types";

const now = "2026-11-06T18:00:00Z";
const BUF = 7, BOS = 6;
const game: LineGame = { id: 2026020100, date: "2026-11-06", homeTeamId: BUF, awayTeamId: BOS, homeAbbreviation: "BUF", awayAbbreviation: "BOS",
  scheduledStart: "2026-11-07T00:00:00Z", phase: "unknown", actualStart: null, observedAt: null, stateSource: null, scheduleIdentity: "2026020100:2026-11-07T00:00:00Z:OK", replacesGameId: null };
const SABRES = "Kuluch and Krebs are now on the No. 2 power play unit for McLeod and Doan";
const players = [{ id: 101, fullName: "Jiri Kulich", lastName: "Kulich" }, { id: 102, fullName: "Josh Krebs", lastName: "Krebs" },
  { id: 103, fullName: "Ryan McLeod", lastName: "McLeod" }, { id: 104, fullName: "Josh Doan", lastName: "Doan" }];
const slot = (id: number, name: string) => ({ playerId: id, name });
const key = (version: 1 | 2, text: string, expected: Record<string, unknown>) => ({ version, verdict: "wrong", labeledAt: "2026-11-06T12:00:00Z", labeler: "TJ", tweetId: "900",
  textSha256: createHash("sha256").update(text).digest("hex"), input: { text, handles: [], publishedAt: null, hasMedia: false }, parsed: { ...emptyExtraction, powerPlay: [], offPowerPlay: [] },
  expected: { ...emptyExtraction, powerPlay: [], offPowerPlay: [], ...expected } });
const sabresV2 = () => key(2, SABRES, { context: "practice", scope: "change", game: null,
  powerPlaySwaps: [{ unit: 2, in: [slot(101, "Kuluch"), slot(102, "Krebs")], out: [slot(103, "McLeod"), slot(104, "Doan")] }] });
const emptyExtraction = { type: "line_combination", category: "LINE COMBINATION", subcategory: "POWER PLAY", players: [], forwards: [], defensePairs: [], goalies: [], extras: [], extraForwards: [], extraDefensemen: [] };

function database(extra: Record<string, any[]> = {}) {
  return lineTestDatabase({
    games: [{ id: game.id, date: game.date, startTime: game.scheduledStart, homeTeamId: BUF, awayTeamId: BOS, home: { abbreviation: "BUF" }, away: { abbreviation: "BOS" } }],
    line_game_state_observations: [], rosters: players.map((player) => ({ playerId: player.id, teamId: BUF, created_at: "2025-07-01T00:00:00Z", ended_at: null })),
    players: players.map((player) => ({ ...player, position: "C" })), lineup_player_name_aliases: [], tweet_pattern_review_items: [], ...extra,
  });
}
function source(text: string, overrides: Record<string, any> = {}) {
  return { team: { id: BUF, abbreviation: "BUF" }, observedAt: "2026-11-06T17:01:00Z", tweetPostedAt: "2026-11-06T17:00:00Z", tweetId: "900", sourceUrl: "https://x.com/pham1717/status/900",
    rawText: text, nhlFilterStatus: "accepted", rawPayload: {}, ...overrides,
    metadata: { publicationTimeBasis: "provider_timestamp", ...overrides.metadata,
      testReport: { key: `report:${text}`, teamId: BUF, teamAbbreviation: "BUF", gameId: null, session: null, date: game.date, receivedAt: "2026-11-06T17:01:00Z", interpretedAt: "2026-11-06T17:02:00Z",
        publishedAt: "2026-11-06T17:00:00Z", originalPublishedAt: "2026-11-06T17:00:00Z", originalUrl: "https://x.com/pham1717/status/900", text,
        provenance: { relayTweetId: "900", originalTweetId: "900", attributionStatus: "resolved" },
        interpretation: { version: "test", units: [], relationships: [], unresolved: [], certainty: "reported", context: "unknown" }, ...overrides.report } } } as any;
}
beforeEach(() => vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"));
afterEach(() => vi.unstubAllEnvs());

describe("context and binding spans", () => {
  it("reads practice, in-game and warmup only from words, practice first", () => {
    expect(decideContext("Lines at practice today: A-B-C")).toMatchObject({ context: "practice", phase: "pregame" });
    expect(decideContext("Second period: A moved up with B and C")).toMatchObject({ context: "game", phase: "in_game" });
    expect(decideContext("Practice notes: in-game they tried A-B-C")).toMatchObject({ context: "practice", phase: "pregame" });
    expect(decideContext("Warmup lines: A-B-C").context).toBe("warmup");
    // No cue: context stays null; "practice" is never invented.
    expect(decideContext(SABRES)).toMatchObject({ context: null, phase: "unknown", spans: [] });
  });
  it("binds from opponent + date or a relative day, never from nothing", () => {
    expect(decideBinding("Sabres vs Bruins on Nov. 6: lines", BUF, [game]).fields).toEqual({ opponentId: BOS, date: "2026-11-06" });
    expect(decideBinding("Lines tonight", BUF, [game]).fields).toMatchObject({ relative: "tonight", timezone: "America/New_York" });
    expect(decideBinding(SABRES, BUF, [game])).toMatchObject({ fields: {}, spans: [] });
  });
});

describe("original-author attribution", () => {
  it("takes the FxTwitter original author, never the relaying account", () => {
    const fx = source(SABRES, { sourceHandle: "GameDayLines", rawPayload: { provider: "fxtwitter", fx: { id: "900", author: { screen_name: "pham1717" }, reposted_by: { screen_name: "GameDayLines" }, repost_wrapper_id: "555" } } });
    expect(sourceAttribution(fx, SABRES)).toMatchObject({ originalAuthor: "pham1717", relayAccount: "gamedaylines", originalTweetId: "900", relayTweetId: "555", timestampIsOriginal: true });
    const ifttt = source(`RT @pham1717: ${SABRES}`, { tweetId: "555", sourceHandle: "GameDayLines" });
    expect(sourceAttribution(ifttt, ifttt.rawText)).toMatchObject({ originalAuthor: "pham1717", relayAccount: "gamedaylines", originalTweetId: null, relayTweetId: "555", timestampIsOriginal: false });
  });
  it("tiers by the approved seed: team > beat > aggregator; FHFHockey aggregator; relays never confer a tier", () => {
    expect(authorityTier("FHFHockey")).toBe("aggregator");
    expect(authorityTier("@BuffaloSabres")).toBe("team");
    for (const relay of RELAY_ACCOUNTS) expect(authorityTier(relay)).toBe("unknown");
    expect(authorityTier("pham1717")).toBe("unknown");
    expect([authorityWeight("team"), authorityWeight("beat"), authorityWeight("aggregator"), authorityWeight("excluded")]).toEqual([3, 2, 1, 0]);
  });
});

describe("decision producer through the processor", () => {
  it("keeps a timestamp-only tweet unbound even with a trusted provider clock", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [source("Power play units: Thompson Tuch Dahlin Benson Quinn")], [BUF], now);
    const claim = db.tables.line_claim_revisions?.[0]?.payload;
    // No units parsed → no claims; the producer still writes nothing it cannot support.
    expect(claim).toBeUndefined();
    const withUnit = source("Power play units: Kulich Krebs McLeod Doan Quinn", { report: { interpretation: { version: "test", unresolved: [], certainty: "reported", context: "unknown", relationships: [],
      units: [{ situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: players.map((player) => ({ playerId: player.id, name: player.lastName })), evidence: players.map((player) => {
        const start = "Power play units: Kulich Krebs McLeod Doan Quinn".indexOf(player.lastName); return { start, end: start + player.lastName.length, text: player.lastName }; }) }] } } });
    await processLineSnapshotEvidence(db, [withUnit], [BUF], now);
    const bound = db.tables.line_claim_revisions![0]!.payload;
    expect(bound.time.originalPublishedAt).toBe("2026-11-06T17:00:00Z");
    expect(bound.gameId).toBeNull(); expect(bound.binding.evidence).toContain("no_game_binding_evidence");
    expect(bound.reviewReasons).toContain("binding_decision_unverified");
  });
  it("Sabres PP2 swap: the reviewed v2 key makes it a practice-context pp claim, never an IGA, Kuluch unresolved without an approved alias", async () => {
    const answerKey = sabresV2();
    const db = database({ tweet_pattern_review_items: [{ id: "r1", tweet_id: "900", quoted_tweet_id: null, metadata: { answerKey } }] });
    await processLineSnapshotEvidence(db, [source(SABRES)], [BUF], now);
    const claims = db.tables.line_claim_revisions!.map((row) => row.payload);
    expect(claims).toHaveLength(1);
    const swap = claims[0]!;
    expect(swap).toMatchObject({ kind: "pp", context: "practice", phase: "pregame", relationAuthority: "reviewed", gameId: null });
    expect(swap.kind).not.toBe("iga");
    expect(swap.ppSwap).toMatchObject({ unitNumber: 2, playersOut: [103, 104] });
    expect(swap.reviewReasons).toContain("identity:Kuluch:missing_player");
    expect(swap.identityStatus).toBe("unresolved");
  });
  it("Sabres swap resolves Kuluch only through an approved alias (v1 key: partial PP2 plus offPowerPlay)", async () => {
    const answerKey = key(1, SABRES, { powerPlay: [[], [slot(101, "Kuluch"), slot(102, "Krebs")]], offPowerPlay: [slot(103, "McLeod"), slot(104, "Doan")] });
    const db = database({ tweet_pattern_review_items: [{ id: "r1", tweet_id: "900", quoted_tweet_id: null, metadata: { answerKey } }],
      lineup_player_name_aliases: [{ alias: "Kuluch", player_id: 101, created_at: "2026-11-01T00:00:00Z" }] });
    await processLineSnapshotEvidence(db, [source(SABRES)], [BUF], now);
    const swap = db.tables.line_claim_revisions![0]!.payload;
    expect(swap.ppSwap).toMatchObject({ unitNumber: 2, playersIn: [101, 102], playersOut: [103, 104], source: "trainer:r1" });
    expect(swap.ppSwap.names["101"]).toBe("Jiri Kulich");
    expect(swap.identityStatus).toBe("resolved_at_event");
    expect(swap.reviewReasons.some((reason: string) => reason.startsWith("identity:"))).toBe(false);
  });
  it("ignores an answer key whose text hash does not match", async () => {
    const answerKey = { ...sabresV2(), textSha256: "0".repeat(64) };
    const db = database({ tweet_pattern_review_items: [{ id: "r1", tweet_id: "900", quoted_tweet_id: null, metadata: { answerKey } }] });
    await processLineSnapshotEvidence(db, [source(SABRES)], [BUF], now);
    expect(db.tables.line_claim_revisions ?? []).toHaveLength(0);
  });
  it("rewrites relay provenance to the original so the IFTTT wrapper and the FxTwitter original share one identity", async () => {
    const db = database();
    const unit = (text: string) => ({ interpretation: { version: "test", unresolved: [], certainty: "reported", context: "unknown", relationships: [],
      units: [{ situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: players.map((player) => ({ playerId: player.id, name: player.lastName })),
        evidence: players.map((player) => { const start = text.indexOf(player.lastName); return { start, end: start + player.lastName.length, text: player.lastName }; }) }] } });
    const text = "PP1 tonight: Kulich Krebs McLeod Doan";
    const fx = source(text, { tweetId: "900", sourceHandle: "GameDayLines", rawPayload: { provider: "fxtwitter", fx: { id: "900", author: { screen_name: "pham1717" }, reposted_by: { screen_name: "GameDayLines" }, repost_wrapper_id: "555" } }, report: unit(text) });
    await processLineSnapshotEvidence(db, [fx], [BUF], now);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim.provenance).toEqual({ relayTweetId: "555", originalTweetId: "900", attributionStatus: "resolved" });
    expect(claim).toMatchObject({ originalAuthor: "pham1717", relayAccount: "gamedaylines", authorityTier: "unknown", gameId: game.id });
  });
  it("Sabres PP2 from the parser's pp_replace change: no context invented, Kuluch unresolved, resolved only by an approved alias", async () => {
    const at = (word: string) => { const start = SABRES.indexOf(word); return { start, end: start + word.length, text: word }; };
    const change = { kind: "pp_replace", scope: "partial", situation: "pp", number: 2, explicitNumber: true, numberEvidence: at("No. 2"),
      playersIn: [{ playerId: 102, name: "Josh Krebs", evidence: at("Krebs") }], playersOut: [{ playerId: 103, name: "Ryan McLeod", evidence: at("McLeod") }, { playerId: 104, name: "Josh Doan", evidence: at("Doan") }],
      unresolved: [{ ...at("Kuluch"), side: "in", reason: "missing_player", candidates: [] }], evidence: { start: 0, end: SABRES.length, text: SABRES } };
    const input = () => source(SABRES, { report: { interpretation: { version: "test", units: [], relationships: [], unresolved: [], certainty: "reported", context: "unknown", changes: [change] } } });
    const db = database();
    await processLineSnapshotEvidence(db, [input()], [BUF], now);
    const swap = db.tables.line_claim_revisions![0]!.payload;
    // No practice cue in the text: no context is invented, phase stays unresolved, so it is never selectable on its own.
    expect(swap).toMatchObject({ kind: "pp", phase: "unknown", gameId: null }); expect(swap.context).toBeUndefined();
    expect(swap.ppSwap).toMatchObject({ unitNumber: 2, playersOut: [103, 104], source: "parser:pp_replace" });
    expect(swap.reviewReasons).toEqual(expect.arrayContaining(["identity:Kuluch:missing_player", "claim_phase_unresolved", "binding_decision_unverified"]));
    const aliased = database({ lineup_player_name_aliases: [{ alias: "Kuluch", player_id: 101, created_at: "2026-11-01T00:00:00Z" }] });
    await processLineSnapshotEvidence(aliased, [input()], [BUF], now);
    const resolved = aliased.tables.line_claim_revisions![0]!.payload;
    expect(resolved.ppSwap).toMatchObject({ playersIn: [101, 102], playersOut: [103, 104] });
    expect(resolved.reviewReasons.some((reason: string) => reason.startsWith("identity:"))).toBe(false);
  });
  const roster = players.map((player) => ({ playerId: player.id, fullName: player.fullName, lastName: player.lastName, position: "C" }));
  const changeReport = (text: string) => ({ interpretation: { version: "test", units: [], relationships: [], unresolved: [], certainty: "reported", context: "unknown", changes: extractTweetUnitChanges(text, roster) } });
  it("an in-game 'X in for Y' becomes an IGA swap claim with no line number and no destination for the player out", async () => {
    const text = "Second period: Krebs in for Doan";
    const db = database();
    await processLineSnapshotEvidence(db, [source(text, { report: changeReport(text) })], [BUF], now);
    const rows = db.tables.line_claim_revisions!.map((row: any) => row.payload);
    expect(rows).toHaveLength(1);
    const claim = rows[0]!;
    expect(claim).toMatchObject({ kind: "iga", phase: "in_game", context: "game", unit: null, identityStatus: "resolved_at_event" });
    // Exact shape: the players and the words, no line number, unit or destination.
    expect(claim.relationship).toEqual({ kind: "substitution", playerIds: [102, 104], evidence: { start: 15, end: 32, text: "Krebs in for Doan" } });
    expect(claim.lineupChange).toEqual({ kind: "in_for", playersIn: [102], playersOut: [104], source: "parser:in_for", names: { 102: "Josh Krebs", 104: "Josh Doan" } });
    expect(claim.ppSwap).toBeUndefined();
    expect(claim.reviewReasons).not.toContain("incomplete_replacement");
    // Nothing is placed into a line: the entry lineup gets no unit from a swap.
    expect(db.tables.line_entry_revisions!.every((row: any) => row.payload.units.length === 0)).toBe(true);
  });
  it("a pregame IN/OUT list is an entry-phase change, never an IGA, and keeps unresolved names out of the ids", async () => {
    const text = "Lineup changes vs. BOS:\n\nIN - Josh Krebs\nOUT - Kuluch";
    const db = database();
    await processLineSnapshotEvidence(db, [source(text, { report: changeReport(text) })], [BUF], now);
    const claim = db.tables.line_claim_revisions!.map((row: any) => row.payload).find((row: any) => row.lineupChange)!;
    expect(claim.kind).not.toBe("iga"); expect(claim.unit).toBeNull();
    expect(claim.lineupChange).toMatchObject({ kind: "lineup_in_out", playersIn: [102], playersOut: [] });
    expect(claim.identityStatus).toBe("unresolved");
  });
  it("lineup changes give game-scoped participation events; PP changes give none", () => {
    const text = "#GoHabsGo lineup changes vs. TOR on Saturday: \n\nIN - Josh Krebs\nOUT - Josh Doan (personal)";
    const events = lineupChangeEvents(text, extractTweetUnitChanges(text, roster));
    expect(events).toMatchObject([
      { playerId: 102, kind: "participation", state: "observed", availability: "available", availabilityScope: "game", modality: "affirmative", evidence: { text: "IN - Josh Krebs" } },
      { playerId: 104, kind: "participation", availability: "out", availabilityScope: "game", evidence: { text: "OUT - Josh Doan (personal)" } }]);
    for (const event of events) expect(text.slice(event.evidence.start, event.evidence.end)).toBe(event.evidence.text);
    expect(lineupChangeEvents("Krebs draws in tonight", extractTweetUnitChanges("Krebs draws into the lineup tonight", roster))).toHaveLength(1);
    expect(lineupChangeEvents(SABRES, extractTweetUnitChanges(SABRES, roster))).toEqual([]);
  });
  it("prefers Lane D's sourceProvenance and its first-sighting clock", async () => {
    const text = "PP1 tonight: Kulich Krebs McLeod Doan";
    const units = { interpretation: { version: "test", unresolved: [], certainty: "reported", context: "unknown", relationships: [],
      units: [{ situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: players.map((player) => ({ playerId: player.id, name: player.lastName })),
        evidence: players.map((player) => { const start = text.indexOf(player.lastName); return { start, end: start + player.lastName.length, text: player.lastName }; }) }] } };
    const input = source(text, { sourceHandle: "GameDayLines", report: units, metadata: { sourceProvenance: { provider: "fxtwitter", postKind: "repost", originalAuthor: "pham1717", relayAccount: "GameDayLines",
      originalTweetId: "900", relayTweetId: "555", timestampIsOriginal: true, publicationTimeBasis: "provider_timestamp", ingestedAt: "2026-11-06T17:00:30Z", ingestedAtBasis: "first_seen_at" } } });
    expect(sourceAttribution(input, text)).toMatchObject({ originalAuthor: "pham1717", relayAccount: "gamedaylines", originalTweetId: "900", relayTweetId: "555", timestampIsOriginal: true });
    const db = database();
    await processLineSnapshotEvidence(db, [input], [BUF], now);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim.time.ingestedAt).toBe("2026-11-06T17:00:30Z");
    expect(claim.provenance).toEqual({ relayTweetId: "555", originalTweetId: "900", attributionStatus: "resolved" });
  });
});

describe("trainer answer key versions", () => {
  it("reads v2 context, game binding and powerPlaySwaps from the expected extraction", () => {
    const decision = readReviewedDecision("r2", { answerKey: { ...sabresV2(), expected: { ...sabresV2().expected, game: { gameId: null, opponentTeamId: BOS, date: "2026-11-06" } } } });
    expect(decision).toMatchObject({ version: 2, context: "practice", scope: "change", binding: { gameId: null, opponentId: BOS, date: "2026-11-06" } });
    expect(decision!.swaps).toEqual([{ unitNumber: 2, playersIn: [slot(101, "Kuluch"), slot(102, "Krebs")], playersOut: [slot(103, "McLeod"), slot(104, "Doan")] }]);
  });
  it("ignores unknown versions and a timestamp-only v2 binding", () => {
    expect(readReviewedDecision("r3", { answerKey: { ...sabresV2(), version: 3 } })).toBeNull();
    expect(readReviewedDecision("r4", { answerKey: key(2, SABRES, { game: { gameId: null, opponentTeamId: null, date: "2026-11-06" } }) })!.binding).toBeNull();
  });
  it("uses the parser's own context cues when the interpretation carries them", () => {
    expect(decideContext("Second period: Point up with Hagel", detectTweetLineContext("Second period: Point up with Hagel"))).toMatchObject({ context: "game", phase: "in_game" });
  });
  it("binds a reviewed v2 key through bindLineGame from opponent + date", async () => {
    const answerKey = { ...sabresV2(), expected: { ...sabresV2().expected, game: { gameId: null, opponentTeamId: BOS, date: game.date } } };
    const db = database({ tweet_pattern_review_items: [{ id: "r1", tweet_id: "900", quoted_tweet_id: null, metadata: { answerKey } }] });
    await processLineSnapshotEvidence(db, [source(SABRES)], [BUF], now);
    const swap = db.tables.line_claim_revisions![0]!.payload;
    expect(swap).toMatchObject({ gameId: game.id, context: "practice" }); expect(swap.binding.evidence).toContain(`opponent_date:${BOS}:${game.date}`);
  });
  it("maps a unit's source marker to certainty, with the marker as confirmation evidence", () => {
    const text = "PP1 tonight: Kulich Krebs McLeod Doan ✅";
    const unit = { situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: [], evidence: [], sourceMarker: { certainty: "confirmed", evidence: { start: text.indexOf("✅"), end: text.indexOf("✅") + 1, text: "✅" } } };
    const produced = produceLineEvidence(source(text), { ...source(text).metadata.testReport, interpretation: { ...source(text).metadata.testReport.interpretation, units: [unit] } }, [game]);
    expect(Object.values(produced.context.claimEvidence!)[0]).toMatchObject({ certainty: "confirmed", confirmationEvidence: ["source_marker:✅"] });
  });
});

describe("relay sourcing rule (TJ, 2026-11-06)", () => {
  const text = "PP1 tonight: Kulich Krebs McLeod Doan ✅";
  const unitReport = () => ({ interpretation: { version: "test", unresolved: [], certainty: "reported", context: "unknown", relationships: [],
    units: [{ situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: players.map((player) => ({ playerId: player.id, name: player.lastName })),
      evidence: players.map((player) => { const start = text.indexOf(player.lastName); return { start, end: start + player.lastName.length, text: player.lastName }; }),
      sourceMarker: { certainty: "confirmed", evidence: { start: text.indexOf("✅"), end: text.indexOf("✅") + 1, text: "✅" } } }] } });
  const post = (handle: string, extra: Record<string, any> = {}) => source(text, { tweetId: "700", sourceHandle: handle, sourceUrl: `https://x.com/${handle}/status/700`, ...extra,
    report: { ...unitReport(), originalUrl: `https://x.com/${handle}/status/700`, provenance: { relayTweetId: "700", originalTweetId: "700", attributionStatus: "resolved" } },
    metadata: { sourceProvenance: { provider: "fxtwitter", postKind: extra.quote ? "quote" : "post", originalAuthor: handle, relayAccount: null, originalTweetId: "700", relayTweetId: null,
      quotedTweetId: extra.quote?.id ?? null, quotedAuthor: extra.quote?.author ?? null, timestampIsOriginal: true, publicationTimeBasis: "provider_timestamp", ingestedAt: null, ingestedAtBasis: "received_at" } } });
  it("a relay-only post: unknown tier, null author, lowest weight, never confirmation, still usable evidence", async () => {
    expect(sourceAttribution(post("GameDayLines"), text)).toMatchObject({ originalAuthor: null, relayAccount: "gamedaylines", relayOnly: true, originalTweetId: null, relayTweetId: "700" });
    const db = database();
    await processLineSnapshotEvidence(db, [post("GameDayLines")], [BUF], now);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim).toMatchObject({ originalAuthor: null, author: null, authorityTier: "unknown", authority: RELAY_ONLY_WEIGHT, certainty: "reported", confirmationEvidence: [], gameId: game.id });
    expect(claim.provenance).toMatchObject({ originalTweetId: null, attributionStatus: "pending" });
    expect(claim.reviewReasons).not.toContain("original_provenance_unverified");
  });
  it("a relay quoting a beat reporter: beat tier and the beat author", () => {
    AUTHORITY_SEED.pham1717 = "beat";
    try {
      const attribution = sourceAttribution(post("CcCMiddleton", { quote: { id: "800", author: "pham1717" } }), text);
      expect(attribution).toMatchObject({ originalAuthor: "pham1717", relayAccount: "cccmiddleton", originalTweetId: "800", relayTweetId: "700", relayOnly: false });
      expect(authorityTier(attribution.originalAuthor)).toBe("beat");
    } finally { delete AUTHORITY_SEED.pham1717; }
  });
  it("an FHFHockey post counts at aggregator weight but does not confirm unless it quotes an original", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [post("FHFHockey")], [BUF], now);
    const own = db.tables.line_claim_revisions![0]!.payload;
    expect(own).toMatchObject({ originalAuthor: "fhfhockey", authorityTier: "aggregator", authority: 1, certainty: "reported", gameId: game.id });
    expect(own.reviewReasons).not.toContain("author_excluded");
    const quoting = database();
    await processLineSnapshotEvidence(quoting, [post("FHFHockey", { quote: { id: "800", author: "BuffaloSabres" } })], [BUF], now);
    expect(quoting.tables.line_claim_revisions![0]!.payload.certainty).toBe("confirmed");
  });
});

describe("club handles (ledger, checked live 2026-11-07)", () => {
  it("has exactly one live official account per club, matching the ledger", () => {
    const teams = clubLedger.teams as Record<string, { handle: string; screenName: string; userId: string; name: string }>;
    expect(Object.keys(teams).sort()).toEqual(Object.keys(teamsInfo).sort());
    expect([...TEAM_ACCOUNTS].sort()).toEqual(Object.values(teams).map((team) => team.handle).sort());
    for (const [abbreviation, team] of Object.entries(teams)) {
      expect(team.screenName.toLowerCase(), abbreviation).toBe(team.handle);
      expect(team.userId, abbreviation).toMatch(/^\d+$/);
      expect(authorityTier(team.screenName), abbreviation).toBe("team");
    }
    // Seed handles that were wrong: not found, or an unofficial lookalike.
    for (const handle of ["mnwild", "nhlcanes"]) expect(authorityTier(handle)).toBe("unknown");
  });
});

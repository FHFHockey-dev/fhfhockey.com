import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
vi.mock("lib/sources/tweetProjectionStorage", () => ({ projectionReportFromSource: (source: any) => structuredClone(source.metadata.testReport) }));
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: any) => game }));
import { decideBinding, decideContext } from "./decisions";
import { authorityTier, sourceAttribution } from "./authority";
import { readReviewedDecision } from "./trainerDecisions";
import { detectTweetLineContext } from "lib/sources/tweetInterpretation";
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
    expect(decideContext(SABRES)).toMatchObject({ context: "practice", phase: "unknown", spans: [] });
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
  it("excludes FHFHockey and keeps every other author unknown until the seed list is approved", () => {
    expect(authorityTier("FHFHockey")).toBe("excluded");
    expect(authorityTier("pham1717")).toBe("unknown");
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
  it("Sabres PP2 swap: practice-context pp claim, never an IGA, Kuluch unresolved without an approved alias", async () => {
    const answerKey = { version: 1, verdict: "wrong", textSha256: createHash("sha256").update(SABRES).digest("hex"), input: { text: SABRES },
      expected: { ...emptyExtraction, powerPlay: [[], [slot(101, "Kuluch"), slot(102, "Krebs")]], offPowerPlay: [slot(103, "McLeod"), slot(104, "Doan")] } };
    const db = database({ tweet_pattern_review_items: [{ id: "r1", tweet_id: "900", quoted_tweet_id: null, metadata: { answerKey } }] });
    await processLineSnapshotEvidence(db, [source(SABRES)], [BUF], now);
    const claims = db.tables.line_claim_revisions!.map((row) => row.payload);
    expect(claims).toHaveLength(1);
    const swap = claims[0]!;
    expect(swap).toMatchObject({ kind: "pp", context: "practice", relationAuthority: "reviewed" });
    expect(swap.kind).not.toBe("iga");
    expect(swap.ppSwap).toMatchObject({ unitNumber: 2, playersOut: [103, 104] });
    expect(swap.reviewReasons).toContain("identity:Kuluch:missing_player");
    expect(swap.identityStatus).toBe("unresolved");
  });
  it("Sabres swap resolves Kuluch only through an approved alias", async () => {
    const answerKey = { version: 1, verdict: "wrong", textSha256: createHash("sha256").update(SABRES).digest("hex"), input: { text: SABRES },
      expected: { ...emptyExtraction, powerPlay: [[], [slot(101, "Kuluch"), slot(102, "Krebs")]], offPowerPlay: [slot(103, "McLeod"), slot(104, "Doan")] } };
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
    const answerKey = { version: 1, verdict: "wrong", textSha256: "0".repeat(64), input: { text: "other" },
      expected: { ...emptyExtraction, powerPlay: [[], [slot(101, "Kuluch"), slot(102, "Krebs")]], offPowerPlay: [slot(103, "McLeod"), slot(104, "Doan")] } };
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
  it("Sabres PP2 from the parser's pp_replace change: practice-level, Kuluch unresolved, resolved only by an approved alias", async () => {
    const at = (word: string) => { const start = SABRES.indexOf(word); return { start, end: start + word.length, text: word }; };
    const change = { kind: "pp_replace", scope: "partial", situation: "pp", number: 2, explicitNumber: true, numberEvidence: at("No. 2"),
      playersIn: [{ playerId: 102, name: "Josh Krebs", evidence: at("Krebs") }], playersOut: [{ playerId: 103, name: "Ryan McLeod", evidence: at("McLeod") }, { playerId: 104, name: "Josh Doan", evidence: at("Doan") }],
      unresolved: [{ ...at("Kuluch"), side: "in", reason: "missing_player", candidates: [] }], evidence: { start: 0, end: SABRES.length, text: SABRES } };
    const input = () => source(SABRES, { report: { interpretation: { version: "test", units: [], relationships: [], unresolved: [], certainty: "reported", context: "unknown", changes: [change] } } });
    const db = database();
    await processLineSnapshotEvidence(db, [input()], [BUF], now);
    const swap = db.tables.line_claim_revisions![0]!.payload;
    expect(swap).toMatchObject({ kind: "pp", context: "practice", phase: "unknown", gameId: null });
    expect(swap.ppSwap).toMatchObject({ unitNumber: 2, playersOut: [103, 104], source: "parser:pp_replace" });
    expect(swap.reviewReasons).toEqual(expect.arrayContaining(["identity:Kuluch:missing_player", "claim_phase_unresolved", "binding_decision_unverified"]));
    const aliased = database({ lineup_player_name_aliases: [{ alias: "Kuluch", player_id: 101, created_at: "2026-11-01T00:00:00Z" }] });
    await processLineSnapshotEvidence(aliased, [input()], [BUF], now);
    const resolved = aliased.tables.line_claim_revisions![0]!.payload;
    expect(resolved.ppSwap).toMatchObject({ playersIn: [101, 102], playersOut: [103, 104] });
    expect(resolved.reviewReasons.some((reason: string) => reason.startsWith("identity:"))).toBe(false);
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
    const decision = readReviewedDecision("r2", { answerKey: { version: 2, verdict: "wrong", textSha256: "a".repeat(64), input: { text: SABRES },
      expected: { ...emptyExtraction, powerPlay: [], offPowerPlay: [], context: "practice", scope: "change", game: { gameId: null, opponentTeamId: BOS, date: "2026-11-06" },
        powerPlaySwaps: [{ unit: 2, in: [slot(101, "Kuluch"), slot(102, "Krebs")], out: [slot(103, "McLeod"), slot(104, "Doan")] }] } } });
    expect(decision).toMatchObject({ version: 2, context: "practice", scope: "change", binding: { gameId: null, opponentId: BOS, date: "2026-11-06" } });
    expect(decision!.swaps).toEqual([{ unitNumber: 2, playersIn: [slot(101, "Kuluch"), slot(102, "Krebs")], playersOut: [slot(103, "McLeod"), slot(104, "Doan")] }]);
  });
  it("ignores unknown versions and a timestamp-only v2 binding", () => {
    expect(readReviewedDecision("r3", { answerKey: { version: 3, textSha256: "a", expected: emptyExtraction } })).toBeNull();
    expect(readReviewedDecision("r4", { answerKey: { version: 2, textSha256: "a", expected: { ...emptyExtraction, game: { gameId: null, opponentTeamId: null, date: "2026-11-06" } } } })!.binding).toBeNull();
  });
  it("uses the parser's own context cues when the interpretation carries them", () => {
    expect(decideContext("Second period: Point up with Hagel", detectTweetLineContext("Second period: Point up with Hagel"))).toMatchObject({ context: "game", phase: "in_game" });
  });
});

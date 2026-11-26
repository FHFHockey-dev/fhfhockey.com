import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
import { curtisFive, game0356, game0392, game0397, game0406, html0356, html0392, pbp0356, pbp0392, silberFive, silberPostedAt, silberText, silberUrl, url0356, url0392, wshFiveRosterRows, wshPublicationRoster } from "./testPpFixtures";
import { interpretTweetUnits } from "lib/sources/tweetInterpretation";
import type { LineGame } from "./types";

// Local evidence only: fixtures stand in for the intake source and NHL reports. Not raw-text or live acceptance.
const state = vi.hoisted(() => ({ games: new Map<number, Partial<LineGame>>(), evidence: true, reads: [] as number[] }));
vi.mock("lib/sources/tweetProjectionStorage", () => ({ projectionReportFromSource: vi.fn((source: any) => structuredClone(source.metadata.testReport)) }));
vi.mock("./gameState", async (load) => ({ ...await load<object>(),
  observeLineGame: async (game: LineGame, now: string) => ({ ...game, phase: "scheduled", observedAt: now, stateSource: "fixture:state",
    scheduleIdentity: `${game.id}:${game.scheduledStart}:OK`, ...state.games.get(game.id) }) }));
vi.mock("./officialPowerPlay", async (load) => {
  const actual = await load<typeof import("./officialPowerPlay")>();
  return { ...actual, readOfficialPowerPlay: async () => null,
    readOfficialPowerPlayEvidence: async (game: LineGame) => { state.reads.push(game.id);
      if (!state.evidence) return null;
      return game.id === 2026020356 ? actual.officialPowerPlayEvidence(game, pbp0356, html0356, url0356) : game.id === 2026020392 ? actual.officialPowerPlayEvidence(game, pbp0392, html0392, url0392) : null; } };
});
import { processLineSnapshotEvidence } from "./processor";
import { activeLineClaims, eligibleClaim } from "./reconcile";
import { fetchLineClaims } from "./storage";
import { readGameLines } from "./service";

const COL = 21;
const players: [number, string, string, string][] = [[8486171, "T.J. Hughes", "Hughes", "R"], [8475172, "Nazem Kadri", "Kadri", "C"], [8477476, "Artturi Lehkonen", "Lehkonen", "L"],
  [8480039, "Martin Necas", "Necas", "C"], [8478038, "Devon Toews", "Toews", "D"], [8480069, "Cale Makar", "Makar", "D"], [8478462, "Nicolas Roy", "Roy", "C"],
  [8476455, "Gabriel Landeskog", "Landeskog", "L"], [8475754, "Brock Nelson", "Nelson", "C"], [8475768, "Jaden Schwartz", "Schwartz", "L"]];
const byName = new Map(players.map(([id, full, last]) => [last, { playerId: id, name: full }]));

function database() {
  return lineTestDatabase({
    games: [game0356, game0397].map((game) => ({ id: game.id, date: game.date, startTime: game.scheduledStart, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId,
      home: { abbreviation: game.homeAbbreviation }, away: { abbreviation: game.awayAbbreviation } })),
    line_game_state_observations: [], lineup_player_name_aliases: [],
    rosters: players.map(([id]) => ({ playerId: id, teamId: COL, seasonId: 20262027, created_at: "2026-09-19T00:57:00Z", ended_at: null })),
    players: players.map(([id, fullName, lastName, position]) => ({ id, fullName, lastName, position })),
  });
}
function unit(text: string, number: 1 | 2, label: string, names: string[]) {
  const listStart = text.indexOf(label) + label.length;
  return { situation: "pp", number, explicitNumber: true, complete: true, group: null,
    players: names.map((name) => byName.get(name)!),
    evidence: names.map((name) => { const start = text.indexOf(name, listStart); return { start, end: start + name.length, text: name }; }) };
}
function span(text: string, phrase: string) { const start = text.indexOf(phrase); return [{ start, end: start + phrase.length, text: phrase }]; }

/** FxTwitter repost mapping, as intake records it for a relayed original. */
const provenance = (originalAuthor: string, originalTweetId: string) => ({ provider: "fxtwitter", postKind: "repost", originalAuthor, relayAccount: "gamedaylines",
  originalTweetId, relayTweetId: null, timestampIsOriginal: true });
const curtisText = "RT @baileyycurtis: Nikita Nesterenko gets the call for high-sticking and the Avs PP will get another look.\n\nPP1: Hughes, Kadri, Lehkonen, Necas, Toews";
const curtisNow = "2026-11-20T02:40:15.833Z";
/** Curtis's source as intake receives it: no binding supplied (the decision's binding spans are empty, as in production). */
function curtisSource() {
  const originalUrl = "https://x.com/baileyycurtis/status/2123606497813053505";
  return { team: { id: COL }, observedAt: curtisNow, metadata: { publicationTimeBasis: "provider_timestamp", sourceProvenance: provenance("baileyycurtis", "2123606497813053505"), lineEvidence: {
    phase: "in_game", kind: "pp", specificity: "game", authority: 2,
    decisionEvidence: { producerVersion: "lines-decisions:2026-11-06.1", decisionId: "pp:1:main:in_game_span", sourceReferences: ["source:2123606497813053505", "in_game_span"],
      binding: [], phase: span(curtisText, "Nikita Nesterenko gets the call for high-sticking") },
    publication: { originalPublishedAt: "2026-11-20T02:36:58.000Z", relayPublishedAt: null, originalIdentity: "2123606497813053505", originalAuthor: "baileyycurtis", evidence: ["publication_basis:provider_timestamp"] } },
  testReport: { key: "curtis", teamId: COL, teamAbbreviation: "COL", gameId: null, date: "2026-11-19", receivedAt: curtisNow, interpretedAt: curtisNow,
    publishedAt: "2026-11-20T02:36:58.000Z", originalPublishedAt: "2026-11-20T02:36:58.000Z", originalUrl, text: curtisText,
    interpretation: { version: "2026-11-23.12", units: [unit(curtisText, 1, "PP1:", ["Hughes", "Kadri", "Lehkonen", "Necas", "Toews"])], unresolved: [], certainty: "reported", context: "game" } } } } as any;
}
const rawalText = "RT @evanrawal: New PP units at Avs practice today. \n\nPP1: Makar, Necas, Kadri, Roy, Landeskog\n\nPP2: Toews, Nelson, Schwartz, Hughes, Lehkonen";
const rawalNow = "2026-11-24T18:46:15.221Z";
/** Rawal's practice units. Original time 18:41:42Z is reconstructed from the snowflake ID in the capture key (fixture, not a production read). */
function rawalSource(names2 = ["Toews", "Nelson", "Schwartz", "Hughes", "Lehkonen"]) {
  const originalUrl = "https://x.com/evanrawal/status/2125298833580339606";
  const decision = (number: number) => ({ phase: "pregame", kind: "pp", specificity: "practice", authority: 2,
    decisionEvidence: { producerVersion: "lines-decisions:2026-11-06.1", decisionId: `pp:${number}:main:practice`, sourceReferences: ["source:2125298833580339606"],
      binding: [], phase: span(rawalText, "at Avs practice today") } });
  const pp2 = unit(rawalText, 2, "PP2:", names2.filter((name) => byName.has(name)));
  return { team: { id: COL }, observedAt: rawalNow, metadata: { publicationTimeBasis: "provider_timestamp", sourceProvenance: provenance("evanrawal", "2125298833580339606"), lineEvidence: {
    publication: { originalPublishedAt: "2026-11-24T18:41:42.000Z", relayPublishedAt: null, originalIdentity: "2125298833580339606", originalAuthor: "evanrawal", evidence: ["fixture:snowflake_reconstructed"] },
    claimEvidence: { "pp:1:main": decision(1), "pp:2:main": decision(2) } },
  testReport: { key: "rawal", teamId: COL, teamAbbreviation: "COL", gameId: null, date: "2026-11-24", receivedAt: rawalNow, interpretedAt: rawalNow,
    publishedAt: "2026-11-24T18:41:42.000Z", originalPublishedAt: "2026-11-24T18:41:42.000Z", originalUrl, text: rawalText,
    interpretation: { version: "2026-11-23.12", units: [unit(rawalText, 1, "PP1:", ["Makar", "Necas", "Kadri", "Roy", "Landeskog"]), pp2],
      unresolved: names2.filter((name) => !byName.has(name)).map((text) => ({ reason: "unknown_player", text, situation: "pp", number: 2 })), certainty: "reported", context: "practice" } } } } as any;
}

beforeEach(() => {
  vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_PP_CARRY_FORWARD_ENABLED", "true");
  state.games = new Map([[game0356.id, { phase: "live", actualStart: "2026-11-20T02:00:00Z" }]]); state.evidence = true; state.reads = [];
});
afterEach(() => { vi.unstubAllEnvs(); });
const curtisRows = (db: ReturnType<typeof database>) => db.tables.line_claim_revisions!.map((row) => row.payload).filter((claim: any) => claim.text === curtisText);

describe("PPCF intake binding (local evidence, not raw-text or live acceptance)", () => {
  it("binds an in-game PP report through intake with no binding supplied", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], curtisNow);
    const [claim] = curtisRows(db);
    expect(claim).toMatchObject({ gameId: 2026020356, explicit: true, binding: { status: "bound", scheduleIdentity: "2026020356:2026-11-20T02:00:00Z:OK" } });
    expect(claim.reviewReasons).toEqual([]);
    expect(claim.binding.evidence).toEqual(expect.arrayContaining(["nhl_penalty:320", "nhl_pp_faceoff:315", "faceoff_before_publication:unverified", `nhl_verified_at:${curtisNow}`]));
    expect(eligibleClaim(claim)).toBe(true);
    expect(state.reads).toEqual([2026020356]);
  });
  it("leaves the claim pending when NHL evidence is unavailable, with the production review reasons intact", async () => {
    state.evidence = false; const db = database();
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], curtisNow);
    const [claim] = curtisRows(db);
    expect(claim.gameId).toBeNull();
    expect(claim.reviewReasons).toEqual(["no_game_binding_evidence", "binding_decision_unverified", "nhl_corroboration_pending"]);
    expect(claim.explicit).toBe(false);
  });
  it("makes no new revision for identical evidence", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], curtisNow);
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], "2026-11-20T02:50:00.000Z");
    expect(curtisRows(db)).toHaveLength(1);
  });
  it("supersedes the pending claim when a later pass binds it", async () => {
    const db = database();
    state.evidence = false;
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], curtisNow);
    const pending = curtisRows(db)[0];
    state.evidence = true;
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], "2026-11-20T02:50:00.000Z");
    const bound = curtisRows(db).find((claim: any) => claim.gameId === 2026020356);
    expect(bound.supersedes).toEqual([pending.id]);
    expect(bound.reviewReasons).toEqual([]);
    expect(eligibleClaim(bound)).toBe(true);
    const active = activeLineClaims(await fetchLineClaims(db, [COL], "2026-11-20T03:00:00Z")).filter((claim) => claim.text === curtisText);
    expect(active.map((claim) => claim.id)).toEqual([bound.id]);
  });
  it("binds a qualifying claim without a penalty cue by period time (TJ 2026-11-25)", async () => {
    const db = database(), source = curtisSource();
    const text = "RT @baileyycurtis: Avs PP will get another look.\n\nPP1: Hughes, Kadri, Lehkonen, Necas, Toews";
    source.metadata.testReport.text = text;
    source.metadata.testReport.interpretation.units = [unit(text, 1, "PP1:", ["Hughes", "Kadri", "Lehkonen", "Necas", "Toews"])];
    source.metadata.lineEvidence.decisionEvidence.phase = span(text, "Avs PP will get another look");
    await processLineSnapshotEvidence(db, [source], [COL], curtisNow);
    expect(state.reads).toEqual([2026020356]);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim).toMatchObject({ gameId: 2026020356, reviewReasons: [] });
    expect(claim.binding.evidence).toEqual(expect.arrayContaining(["binding_basis:period_time", "personnel_verified_no_penalty_clue"]));
  });
  it("makes no NHL read when the post cannot fall inside an observed game", async () => {
    const db = database(), source = curtisSource();
    source.metadata.lineEvidence.publication.originalPublishedAt = "2026-11-20T12:00:00.000Z";
    await processLineSnapshotEvidence(db, [source], [COL], "2026-11-20T12:05:00.000Z");
    expect(state.reads).toEqual([]);
  });

  it("intake-stored Curtis carries to 0397 with PP2 blank and Rawal's practice note (local evidence)", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [curtisSource()], [COL], curtisNow);
    state.games = new Map([[game0356.id, { phase: "final", actualStart: "2026-11-20T02:00:00Z" }], [game0397.id, { phase: "scheduled" }]]);
    await processLineSnapshotEvidence(db, [rawalSource()], [COL], rawalNow);
    const response = await readGameLines(db, { gameId: game0397.id, teamId: COL, now: "2026-11-26T02:00:00Z" });
    const [pp1, pp2] = response.teams[0]!.ppDefaults;
    expect(pp1!.selection).toMatchObject({ designation: "carried", originGameId: 2026020356 });
    expect(pp1!.selection!.unit.players.map((player) => player.playerId)).toEqual(curtisFive);
    expect(pp1!.selection!.claims[0]).toMatchObject({ sourceUrl: "https://x.com/baileyycurtis/status/2123606497813053505", time: { originalPublishedAt: "2026-11-20T02:36:58.000Z" } });
    expect(pp2!.selection).toBeNull();
    expect(pp1!.practiceDiffers).toMatchObject({ sourceUrl: "https://x.com/evanrawal/status/2125298833580339606", author: "evanrawal", postedAt: "2026-11-24T18:41:42.000Z" });
    expect(pp1!.practiceDiffers!.units.map((item) => [item.number, item.players.map((player) => player.name)])).toEqual([
      [1, ["Cale Makar", "Martin Necas", "Nazem Kadri", "Nicolas Roy", "Gabriel Landeskog"]],
      [2, ["Devon Toews", "Brock Nelson", "Jaden Schwartz", "T.J. Hughes", "Artturi Lehkonen"]]]);
    expect(pp2!.practiceDiffers ?? null).toBeNull();
  });

  describe("Silber WSH PP1 (in-game, no penalty clue) → FLA@WSH 0406 (local evidence)", () => {
    const WSH = 15;
    const silberNow = "2026-11-26T00:28:07.950Z";
    const wshFive = wshPublicationRoster.filter((player) => silberFive.includes(player.playerId));
    function wshDatabase() {
      return lineTestDatabase({
        games: [game0392, game0406].map((game) => ({ id: game.id, date: game.date, startTime: game.scheduledStart, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId,
          home: { abbreviation: game.homeAbbreviation }, away: { abbreviation: game.awayAbbreviation } })),
        line_game_state_observations: [], lineup_player_name_aliases: [],
        rosters: wshFiveRosterRows,
        players: wshFive.map((player) => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName, position: player.position })),
      });
    }
    /** The production snapshot's shape (FxTwitter repost relayed by GameDayLines), with no line evidence supplied: the producer decides. */
    function silberSource(text = silberText) {
      const interpretation = { ...interpretTweetUnits(text, wshPublicationRoster), identityContext: { basis: "publication_roster", sourcePublishedAt: silberPostedAt, eventRosterRevision: "" } };
      return { team: { id: WSH }, observedAt: silberNow, tweetId: "2125747628642336776", tweetPostedAt: silberPostedAt,
        metadata: { publicationTimeBasis: "provider_timestamp", sourceProvenance: { provider: "fxtwitter", postKind: "repost", originalAuthor: "sammisilber", relayAccount: "GameDayLines",
          originalTweetId: "2125747628642336776", relayTweetId: null, timestampIsOriginal: true, ingestedAt: silberNow, ingestedAtBasis: "first_seen_at" },
        testReport: { key: "silber", teamId: WSH, teamAbbreviation: "WSH", gameId: null, date: "2026-11-25", receivedAt: silberNow, interpretedAt: silberNow,
          publishedAt: silberPostedAt, originalPublishedAt: silberPostedAt, originalUrl: silberUrl, text, interpretation,
          provenance: { relayTweetId: "2125747628642336776", originalTweetId: "2125747628642336776", attributionStatus: "resolved" } } } } as any;
    }
    const silberRows = (db: ReturnType<typeof wshDatabase>) => db.tables.line_claim_revisions!.map((row) => row.payload).filter((claim: any) => claim.text === silberText);
    beforeEach(() => { state.games = new Map([[game0392.id, { phase: "live", actualStart: "2026-11-26T00:17:00Z" }]]); });

    it("binds through intake by period time, in-game by timing, with the evidence stored", async () => {
      const db = wshDatabase();
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], silberNow);
      const [claim] = silberRows(db);
      expect(claim).toMatchObject({ gameId: 2026020392, explicit: true, phase: "in_game", context: "game", kind: "pp", identityStatus: "resolved_at_event",
        sourceUrl: silberUrl, time: { originalPublishedAt: silberPostedAt }, binding: { status: "bound", scheduleIdentity: "2026020392:2026-11-26T00:00:00Z:OK" } });
      expect(claim.reviewReasons).toEqual([]);
      expect(claim.unit.players.map((player: any) => player.playerId)).toEqual(silberFive);
      expect(claim.binding.evidence).toEqual(["live_game:2026020392", "binding_basis:period_time", "nhl_period:1:2026-11-26T00:17:00Z",
        "nhl_pp_on_ice:124", "nhl_pp_on_ice:201", "nhl_pp_on_ice:158", "nhl_pp_on_ice:10", `nhl_report:${url0392}`,
        "personnel_verified_no_penalty_clue", "faceoff_before_publication:unverified",
        "nhl_period_window:1:2026-11-26T00:17:00Z/2026-11-26T00:52:00Z", "session_context:in_game_by_time", `nhl_verified_at:${silberNow}`]);
      expect(eligibleClaim(claim)).toBe(true);
      expect(state.reads).toEqual([2026020392]);
    });
    it("stays pending when the NHL feed is late, then a reprocess binds it and retires the pending reading", async () => {
      const db = wshDatabase();
      state.evidence = false;
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], silberNow);
      const [pending] = silberRows(db);
      expect(pending).toMatchObject({ gameId: null, phase: "unknown" });
      expect(pending.reviewReasons).toContain("nhl_corroboration_pending");
      state.evidence = true;
      // A later pass over the same stored source while 0392 is still live (the trimmed report has no game-end row).
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], "2026-11-26T00:40:00.000Z");
      const bound = silberRows(db).find((claim: any) => claim.gameId === 2026020392);
      expect(bound.supersedes).toEqual([pending.id]);
      const active = activeLineClaims(await fetchLineClaims(db, [WSH], "2026-11-26T01:00:00Z")).filter((claim) => claim.text === silberText);
      expect(active.map((claim) => claim.id)).toEqual([bound.id]);
    });
    it("keeps one revision when a later pass sees the period closed (window is metadata, not identity)", async () => {
      const db = wshDatabase();
      // First pass mid-P1: the report has no P1 end yet, so the window is open.
      state.games = new Map([[game0392.id, { phase: "live", actualStart: "2026-11-26T00:17:00Z" }]]);
      const early = vi.spyOn(await import("./officialPowerPlay"), "readOfficialPowerPlayEvidence");
      const full = (await import("./officialPowerPlay")).officialPowerPlayEvidence(game0392, pbp0392, html0392, url0392)!;
      early.mockResolvedValueOnce({ ...full, periods: [{ ...full.periods[0]!, endedAt: null }], observations: full.observations.filter((item) => item.period === 1 && item.elapsed <= "09:00") });
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], silberNow);
      expect(silberRows(db)[0].binding.evidence).toContain("nhl_period_window:1:2026-11-26T00:17:00Z/open");
      early.mockRestore();
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], "2026-11-26T00:58:00.000Z");
      expect(silberRows(db)).toHaveLength(1);
    });
    it("makes no claim for an ambiguous surname on the publication roster", async () => {
      const db = wshDatabase();
      await processLineSnapshotEvidence(db, [silberSource(silberText.replace("Wilson", "Protas"))], [WSH], silberNow);
      expect((db.tables.line_claim_revisions ?? []).filter((row: any) => row.payload.kind === "pp" && row.payload.unit)).toEqual([]);
    });
    it("carries to 0406 as PP1 Strome, Wilson, Sourdif, Chychrun, Ovechkin with Silber's URL and time; PP2 blank", async () => {
      const db = wshDatabase();
      await processLineSnapshotEvidence(db, [silberSource()], [WSH], silberNow);
      const response = await readGameLines(db, { gameId: game0406.id, teamId: WSH, now: "2026-11-27T19:00:00Z" });
      const [pp1, pp2] = response.teams[0]!.ppDefaults;
      expect(pp1!.selection).toMatchObject({ designation: "carried", originGameId: 2026020392 });
      expect(pp1!.reason).toBe("Carried forward from accepted in-game PP evidence");
      expect(pp1!.selection!.unit.players.map((player) => player.name)).toEqual(["Dylan Strome", "Tom Wilson", "Justin Sourdif", "Jakob Chychrun", "Alex Ovechkin"]);
      expect(pp1!.selection!.claims[0]).toMatchObject({ sourceUrl: silberUrl, time: { originalPublishedAt: silberPostedAt } });
      expect(pp2!.selection).toBeNull();
    });
  });
});

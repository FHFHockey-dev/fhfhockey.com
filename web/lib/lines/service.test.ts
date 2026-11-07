import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: unknown) => game }));
import { readGameLines } from "./service";
import { reconcileEntry } from "./reconcile";
import { RELAY_ACCOUNTS } from "./authority";
import { lineTestDatabase } from "./testDatabase";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureResponse } from "./testFixtures";

export function serviceDatabase() {
  const response = fixtureResponse();
  const row = (game: typeof fixtureGame) => ({ id: game.id, date: game.date, startTime: game.scheduledStart, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, home: { abbreviation: game.homeAbbreviation }, away: { abbreviation: game.awayAbbreviation } });
  return lineTestDatabase({
    games: [row(fixtureGame), row(fixtureNext)],
    line_game_state_observations: [fixtureGame, fixtureNext].map((game) => ({ game_id: game.id, state_id: `state${game.id}`, observed_at: game.observedAt, payload: game })),
    line_claim_revisions: [fixtureClaim(), fixturePP(1), fixturePP(2), fixtureClaim("unknown", { gameId: null, reviewReasons: ["missing_timezone"] })].map((claim) => ({ team_id: claim.teamId, claim_id: claim.id, interpreted_at: claim.time.interpretedAt, payload: claim })),
    line_entry_revisions: [{ entry_id: response.teams[0]!.entry!.id, team_id: 14, game_id: fixtureGame.id, revision: 1, payload: response.teams[0]!.entry }],
    line_pp_decisions: [],
  });
}
beforeEach(() => { vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); vi.stubEnv("LINES_PP_CARRY_FORWARD_ENABLED", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("shared game/team response", () => {
  it.each(["GameDayLines", "GameDayGoalies", "GameDayNewsNHL", "CcCMiddleton", "DFOFantasy", "NHL_Rosters"])("removes relay %s from public author and fallback links, retaining internal lineage", async handle => {
    const db = serviceDatabase();
    const raw = db.tables.line_claim_revisions![0]!.payload;
    raw.author = handle; raw.sourceUrl = `https://x.com/${handle}/status/123`; raw.originalIdentity = raw.sourceUrl;
    raw.provenance = { relayTweetId: "123", originalTweetId: null, attributionStatus: "pending" };
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    const claim = response.teams[0]!.history.find(item => item.id === raw.id)!;
    expect(claim.author).toBe("Original source pending"); expect(claim.sourceUrl).toBeNull(); expect(claim.originalIdentity).toBeNull();
    expect(claim.provenance).toBeUndefined(); expect(raw.author).toBe(handle); expect(raw.provenance.relayTweetId).toBe("123");
  });
  it("defaults to live, keeps teams separated and never writes on GET", async () => {
    const db = serviceDatabase();
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.game?.id).toBe(fixtureGame.id); expect(response.teams).toHaveLength(1);
    expect(response.teams[0]!.entry?.status).toBe("frozen"); expect(response.teams[0]!.observations).toHaveLength(2);
    expect(response.teams[0]!.unresolved[0]!.reasons).toContain("missing_timezone");
    expect(db.writes).toHaveLength(0);
    const both = await readGameLines(db, { gameId: fixtureGame.id, now: fixtureNow });
    expect(both.teams.map((team) => team.teamId)).toEqual([14, 3]);
    // No stored entry for team 3, but the game is live: frozen in memory with what was known (nothing).
    expect(both.teams[1]!.entry).toMatchObject({ status: "frozen", units: [] }); expect(both.entryView).toMatchObject({ mode: "entering", basis: "read_time" });
    expect(both.teams[1]!.observations).toHaveLength(0);
  });
  it("selects next scheduled after final and labels previous-entry fallback and carried PP", async () => {
    const db = serviceDatabase(); db.tables.line_game_state_observations![0]!.payload.phase = "final";
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.game?.id).toBe(fixtureNext.id); expect(response.teams[0]!.fallback?.gameId).toBe(fixtureGame.id);
    expect(response.teams[0]!.ppDefaults.every((decision) => decision.selection?.designation === "carried")).toBe(true);
    expect(db.writes).toHaveLength(0);
  });
  it("freezes on LIVE at read time when no tweet arrived after puck drop, without writing", async () => {
    const db = serviceDatabase();
    const expected = reconcileEntry({ game: { ...fixtureGame, phase: "pregame" }, teamId: 14, claims: [fixtureClaim()], previous: null, now: "2026-10-01T22:50:00Z" });
    expect(expected.status).toBe("expected");
    db.tables.line_entry_revisions = [{ entry_id: expected.id, team_id: 14, game_id: fixtureGame.id, revision: 1, payload: expected }];
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.teams[0]!.entry).toMatchObject({ status: "frozen", cutoff: fixtureGame.actualStart, previousId: expected.id });
    expect(response.teams[0]!.entry!.units).toHaveLength(1);
    expect(response.entryView).toEqual({ mode: "entering", frozenAt: fixtureGame.actualStart, basis: "read_time" });
    expect(db.writes).toHaveLength(0);
    expect(db.tables.line_entry_revisions).toHaveLength(1);
  });
  it("stays expected before LIVE", async () => {
    const db = serviceDatabase(); db.tables.line_entry_revisions = [];
    db.tables.line_game_state_observations![0]!.payload = { ...fixtureGame, phase: "pregame", actualStart: null };
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.entryView).toEqual({ mode: "expected", frozenAt: null, basis: null }); expect(response.teams[0]!.entry).toBeNull();
  });
  it("feeds one item per original with relays collapsed, and keeps practice out of the IGA rail", async () => {
    const db = serviceDatabase();
    const base = fixtureClaim("relay-pair", { kind: "iga", phase: "in_game", unit: null, text: "Second period: Point with Hagel", relationship: { kind: "continuity", playerIds: [2], evidence: { start: 0, end: 13, text: "Second period" } } });
    const ifttt = { ...base, id: "ifttt", captureId: "c-ifttt", originalIdentity: "https://x.com/GameDayLines/status/555", relayAccount: "gamedaylines", originalAuthor: "fixtureauthor",
      provenance: { relayTweetId: "555", originalTweetId: null, attributionStatus: "pending" as const } };
    const fx = { ...base, id: "fx", captureId: "c-fx", originalIdentity: "123", relayAccount: "gamedaylines", originalAuthor: "fixtureauthor", authorityTier: "unknown" as const,
      provenance: { relayTweetId: "555", originalTweetId: "123", attributionStatus: "resolved" as const }, time: { ...base.time, interpretedAt: "2026-10-01T22:38:00Z" } };
    const practice = fixtureClaim("practice-iga", { kind: "iga", phase: "in_game", context: "practice", unit: null, originalIdentity: "practice", relationship: { kind: "continuity", playerIds: [3], evidence: { start: 0, end: 5, text: "Light" } } });
    const fhfh = fixtureClaim("fhfh", { originalIdentity: "fhfh", originalAuthor: "fhfhockey", authorityTier: "aggregator" });
    const relayOnly = fixtureClaim("relay-only", { originalIdentity: "https://x.com/GameDayLines/status/777", originalAuthor: null, author: null, relayAccount: "gamedaylines", sourceUrl: "https://x.com/GameDayLines/status/777",
      provenance: { relayTweetId: "777", originalTweetId: null, attributionStatus: "pending" } });
    for (const claim of [ifttt, fx, practice, fhfh, relayOnly]) db.tables.line_claim_revisions!.push({ team_id: 14, claim_id: claim.id, interpreted_at: claim.time.interpretedAt, payload: claim });
    const team = (await readGameLines(db, { teamId: 14, now: fixtureNow })).teams[0]!;
    const pair = team.feed.filter((item) => item.claimIds.includes("fx"));
    expect(pair).toHaveLength(1);
    expect(pair[0]).toMatchObject({ id: "123", claimIds: ["fx", "ifttt"], originalAuthor: "fixtureauthor", relays: [{ account: null, relayTweetId: "555" }] });
    expect(team.feed.find((item) => item.claimIds.includes("fhfh"))).toMatchObject({ originalAuthor: "fhfhockey", authorityTier: "aggregator" });
    expect(team.feed.find((item) => item.claimIds.includes("relay-only"))).toMatchObject({ originalAuthor: null, sourceUrl: null, authorityTier: "unknown" });
    expect(team.observations.some((claim) => claim.id === "practice-iga")).toBe(false);
    expect(team.observations.filter((claim) => ["fx", "ifttt"].includes(claim.id))).toHaveLength(1);
  });
  it.each([
    ["relay-only", { originalAuthor: null, author: null, originalIdentity: "https://x.com/GameDayLines/status/777", sourceUrl: "https://x.com/GameDayLines/status/777",
      provenance: { relayTweetId: "777", originalTweetId: null, attributionStatus: "pending" as const } }],
    ["relay-quoting", { originalAuthor: "fixtureauthor", author: "fixtureauthor", originalIdentity: "800", sourceUrl: "https://x.com/fixtureauthor/status/800",
      provenance: { relayTweetId: "777", originalTweetId: "800", attributionStatus: "resolved" as const } }],
  ])("no relay handle appears anywhere in the public JSON (%s)", async (_name, fields) => {
    const db = serviceDatabase();
    const text = "RT @GameDayLines: Lightning warmup lines: Mikheyev-Point-Kucherv via @DFOFantasy and DFO_Fantasy https://x.com/CcCMiddleton/status/9";
    const relay = fixtureClaim("relay", { ...fields, text, relayAccount: "gamedaylines", reviewReasons: ["extraction:missing_player:GameDayGoalies"],
      decisionEvidence: { producerVersion: "t", decisionId: "d", sourceReferences: ["source:https://x.com/NHL_Rosters/status/5"], binding: [], phase: [] },
      publicationEvidence: ["relay:GameDayNewsNHL"] });
    const entry = db.tables.line_entry_revisions![0]!.payload;
    entry.units[0].claims.push(relay); entry.evidenceClaims = [...entry.evidenceClaims ?? [], relay];
    db.tables.line_claim_revisions!.push({ team_id: 14, claim_id: relay.id, interpreted_at: relay.time.interpretedAt, payload: relay });
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.teams[0]!.feed.some((item) => item.claimIds.includes("relay"))).toBe(true);
    const json = JSON.stringify(response).toLowerCase();
    for (const handle of RELAY_ACCOUNTS) expect(json).not.toContain(handle);
    expect(response.teams[0]!.history.find((claim) => claim.id === "relay")!.text).toMatch(/^Lightning warmup lines/);
  });
  it("answers no-scope reads with the empty contract instead of guessing a game", async () => {
    const db = serviceDatabase();
    expect((await readGameLines(db, { now: fixtureNow })).status).toBe("no_game"); expect(db.from).not.toHaveBeenCalled();
  });
  it("scope mismatch cannot return the other team's lineup", async () => {
    expect((await readGameLines(serviceDatabase(), { teamId: 99, gameId: fixtureGame.id, now: fixtureNow })).game).toBeNull();
  });
  it("separate controls disable serving and observation history independently", async () => {
    const db = serviceDatabase(); vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "false");
    expect((await readGameLines(db, { teamId: 14, now: fixtureNow })).status).toBe("disabled"); expect(db.from).not.toHaveBeenCalled();
    vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "false");
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.teams[0]!.observations).toHaveLength(0); expect(response.teams[0]!.history).toHaveLength(0); expect(response.teams[0]!.entry).not.toBeNull();
  });
});

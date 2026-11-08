import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
vi.mock("lib/sources/tweetProjectionStorage", () => ({ projectionReportFromSource: (source: any) => source.metadata?.testReport ? structuredClone(source.metadata.testReport) : null }));
const observed = vi.fn();
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: any, now: string) => { observed(game.id); return { ...game, phase: "pregame", observedAt: now, stateSource: "fixture:nhl" }; } }));
import { processLineSnapshotEvidence } from "./processor";

// Production shape (incident 2026-11-07): the routes call the processor every minute with the whole scheduled slate.
const NOW = "2026-11-07T23:40:00Z";
const TEAMS = Array.from({ length: 16 }, (_, index) => index + 1);
const games = TEAMS.filter((team) => team % 2).flatMap((home) => [
  { id: 2026020000 + home, date: "2026-11-07", startTime: "2026-11-08T00:00:00Z", homeTeamId: home, awayTeamId: home + 1, home: { abbreviation: `H${home}` }, away: { abbreviation: `A${home}` } },
  // A full season of older games per team: the reads must not scale with it.
  ...Array.from({ length: 60 }, (_, day) => ({ id: 2025020000 + home * 100 + day, date: `2025-${String(10 + Math.floor(day / 28)).padStart(2, "0")}-${String(1 + (day % 28)).padStart(2, "0")}`,
    startTime: null, homeTeamId: home, awayTeamId: home + 1, home: { abbreviation: `H${home}` }, away: { abbreviation: `A${home}` } })),
]);
const text = "Lines tonight: Mikheyev-Point-Kucherov";
const source = (teamId: number) => ({ team: { id: teamId }, observedAt: "2026-11-07T23:30:00Z", tweetPostedAt: "2026-11-07T23:29:00Z", tweetId: `9${teamId}`, nhlFilterStatus: "accepted", rawText: text, rawPayload: {},
  metadata: { publicationTimeBasis: "provider_timestamp", testReport: { key: `r${teamId}`, teamId, teamAbbreviation: "X", gameId: null, date: "2026-11-07", receivedAt: "2026-11-07T23:30:00Z",
    interpretedAt: "2026-11-07T23:31:00Z", publishedAt: "2026-11-07T23:29:00Z", originalPublishedAt: "2026-11-07T23:29:00Z", originalUrl: `https://x.com/beat${teamId}/status/9${teamId}`, text,
    interpretation: { version: "t", unresolved: [], certainty: "reported", context: "game", relationships: [],
      units: [{ situation: "es_forward", number: 1, explicitNumber: false, complete: true, group: null, players: [1, 2, 3].map((id) => ({ playerId: teamId * 10 + id, name: `P${id}` })),
        evidence: ["Mikheyev", "Point", "Kucherov"].map((name) => ({ start: text.indexOf(name), end: text.indexOf(name) + name.length, text: name })) }] } } } }) as any;
function database() {
  return lineTestDatabase({ games, line_game_state_observations: [], line_claim_revisions: [], line_entry_revisions: [], line_pp_decisions: [], rosters: [], players: [], lineup_player_name_aliases: [], tweet_pattern_review_items: [] });
}
const calls = (db: ReturnType<typeof database>) => db.from.mock.calls.length + db.rpc.mock.calls.length;
beforeEach(() => { vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); observed.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

const tablesRead = (db: ReturnType<typeof database>) => db.from.mock.calls.map(([table]) => table);
const later = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();
const newSource = (teamId: number, tweetId: string) => { const next = source(teamId); next.tweetId = tweetId; next.metadata.testReport.key = `r${tweetId}`; next.metadata.testReport.text = `${text} `; return next; };

// HEAD before the fix, same fixture (16 scheduled teams, 8 games tonight, 60 older games per pair):
// empty call 112 DB + 16 NHL; one source 118 DB + 16 NHL; the same call a minute later 118 DB + 16 NHL and 8 new state rows.
describe("processor load shape (production incident 2026-11-07)", () => {
  it("an empty call makes no database or NHL request, whatever the scheduled slate", async () => {
    const db = database();
    expect(await processLineSnapshotEvidence(db, [], TEAMS, NOW)).toEqual({ enabled: true, claims: 0, reconciled: 0 });
    expect(calls(db)).toBe(0); expect(observed).not.toHaveBeenCalled();
    // A source with no accepted interpretation is no evidence either.
    expect(calls(db)).toBe(0);
    await processLineSnapshotEvidence(db, [{ ...source(3), metadata: {} }], TEAMS, NOW);
    expect(calls(db)).toBe(0);
  });
  it("one source touches one team: bounded reads, one NHL observation, one reconcile", async () => {
    const db = database();
    expect(await processLineSnapshotEvidence(db, [source(3)], TEAMS, NOW)).toMatchObject({ claims: 1, reconciled: 1 });
    expect(observed.mock.calls).toEqual([[2026020003]]);
    expect(db.tables.line_game_state_observations!.map((row) => row.game_id)).toEqual([2026020003]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(calls(db)).toBeLessThanOrEqual(15);
    // One games read, one latest-state read, no full observation or revision history.
    expect(tablesRead(db).filter((table) => table === "games")).toHaveLength(1);
    expect(tablesRead(db).filter((table) => table === "line_game_state_observations")).toHaveLength(2); // latest read + append
  });
  it("within the interval a repeat call neither re-observes nor re-reconciles; a new claim still reconciles", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [source(3)], TEAMS, NOW);
    observed.mockClear(); db.from.mockClear(); db.rpc.mockClear();
    expect(await processLineSnapshotEvidence(db, [source(3)], TEAMS, later(1))).toMatchObject({ reconciled: 0 });
    expect(observed).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
    expect(db.tables.line_game_state_observations).toHaveLength(1);
    expect(calls(db)).toBeLessThanOrEqual(8);
    expect(await processLineSnapshotEvidence(db, [newSource(3, "77")], TEAMS, later(2))).toMatchObject({ reconciled: 1 });
    expect(observed).not.toHaveBeenCalled();
  });
  it("after the interval it observes again, and a real phase change reconciles once", async () => {
    const db = database();
    await processLineSnapshotEvidence(db, [source(3)], TEAMS, NOW);
    observed.mockClear(); db.rpc.mockClear();
    // Same phase (pregame) after 6 minutes: observed and stored, but nothing to reconcile.
    expect(await processLineSnapshotEvidence(db, [source(3)], TEAMS, later(6))).toMatchObject({ reconciled: 0 });
    expect(observed).toHaveBeenCalledTimes(1); expect(db.tables.line_game_state_observations).toHaveLength(2);
    // The stored phase differs from the next observation: a transition, reconciled once.
    db.tables.line_game_state_observations!.forEach((row) => { row.payload = { ...row.payload, phase: "scheduled" }; });
    expect(await processLineSnapshotEvidence(db, [source(3)], TEAMS, later(12))).toMatchObject({ reconciled: 1 });
  });
});

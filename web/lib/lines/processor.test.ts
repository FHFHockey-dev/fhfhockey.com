import { afterEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
import { fixtureDecisionEvidence, fixtureGame, fixtureNow, fixtureUnit } from "./testFixtures";
vi.mock("lib/sources/tweetProjectionStorage", () => ({ projectionReportFromSource: (source: any) => structuredClone(source.metadata.testReport) }));
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: any) => ({ ...game, ...fixtureGame }) }));
import { processLineSnapshotEvidence } from "./processor";

function processorDatabase() {
  return lineTestDatabase({ games: [{ id: fixtureGame.id, date: fixtureGame.date, startTime: fixtureGame.scheduledStart, homeTeamId: 3, awayTeamId: 14, home: { abbreviation: "NYR" }, away: { abbreviation: "TBL" } }],
    line_game_state_observations: [], rosters: [1, 2, 3].map((id) => ({ playerId: id, teamId: 14, created_at: "2025-01-01T00:00:00Z", ended_at: null })),
    players: fixtureUnit().players.map((player) => ({ id: player.playerId, fullName: player.name, lastName: player.name, position: "C" })), lineup_player_name_aliases: [] });
}
function source() {
  return { team: { id: 14 }, observedAt: "2026-10-01T22:36:00Z", metadata: { publicationTimeBasis: "provider_timestamp", lineEvidence: { gameId: fixtureGame.id, phase: "pregame", kind: "entry",
    decisionEvidence: fixtureDecisionEvidence("Warmup lines: Mikheyev-Point-Kucherov"), publication: { originalPublishedAt: "2026-10-01T22:34:00Z", relayPublishedAt: null, originalIdentity: "https://x.com/fixture/status/123", originalAuthor: "fixture", evidence: ["fixture:primary-original-provider-clock"] } },
    testReport: { key: "report", teamId: 14, teamAbbreviation: "TBL", gameId: fixtureGame.id, date: fixtureGame.date, receivedAt: "2026-10-01T22:36:00Z", interpretedAt: "2026-10-01T22:37:00Z", publishedAt: "2026-10-01T22:34:00Z", originalPublishedAt: "2026-10-01T22:34:00Z", originalUrl: "https://x.com/fixture/status/123", text: "Warmup lines: Mikheyev-Point-Kucherov", interpretation: { version: "test", units: [fixtureUnit()], unresolved: [], certainty: "reported", context: "game" } } } } as any;
}
afterEach(() => vi.unstubAllEnvs());
describe("gated source processor integration", () => {
  it("does nothing while disabled", async () => {
    vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "false"); const db = processorDatabase();
    expect(await processLineSnapshotEvidence(db, [source()], [14], fixtureNow)).toEqual({ enabled: false, claims: 0, reconciled: 0 });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("captures event-date identity proof and appends frozen decisions without forecast writes", async () => {
    vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); const db = processorDatabase();
    const result = await processLineSnapshotEvidence(db, [source()], [14], fixtureNow);
    expect(result.claims).toBe(1); expect(result.reconciled).toBe(1);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim.identityStatus).toBe("resolved_at_event"); expect(claim.reviewReasons).toHaveLength(0);
    expect(db.tables.line_entry_revisions![0]!.payload.status).toBe("frozen");
    expect(db.writes.every((table) => table.startsWith("line_") || table === "append_line_decisions")).toBe(true);
  });
  it("preserves unknown publication and ingestion clocks as review evidence", async () => {
    vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); const db = processorDatabase(); const input = source();
    input.metadata.publicationTimeBasis = "tweet_id_or_unknown"; input.observedAt = null;
    await processLineSnapshotEvidence(db, [input], [14], fixtureNow);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim.time.originalPublishedAt).toBeNull(); expect(claim.reviewReasons).toContain("ingestion_time_unresolved");
    expect(db.tables.line_entry_revisions![0]!.payload.units).toHaveLength(0);
  });
  it("does not invent classifier binding or phase when the producer contract is absent", async () => {
    vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); const db = processorDatabase(); const input = source();
    delete input.metadata.lineEvidence;
    await processLineSnapshotEvidence(db, [input], [14], fixtureNow);
    const claim = db.tables.line_claim_revisions![0]!.payload;
    expect(claim.phase).toBe("unknown"); expect(claim.binding.status).toBe("unresolved");
    expect(claim.reviewReasons).toContain("original_provenance_unverified");
    expect(db.tables.line_entry_revisions![0]!.payload.units).toHaveLength(0);
  });
  it("requires existing persisted claim IDs for correction/retraction targets", async () => {
    vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); const db = processorDatabase(); const input = source();
    input.metadata.lineEvidence.kind = "entry_correction"; input.metadata.lineEvidence.supersedes = ["raw-tweet-id"];
    input.metadata.lineEvidence.relationAuthority = "original_author";
    await processLineSnapshotEvidence(db, [input], [14], fixtureNow);
    expect(db.tables.line_claim_revisions![0]!.payload.reviewReasons).toContain("relation_target_unresolved:raw-tweet-id");
    expect(db.tables.line_claim_revisions![0]!.payload.supersedes).toEqual(["raw-tweet-id"]);
    expect(db.tables.line_claim_relations ?? []).toHaveLength(0);
    expect(db.tables.line_game_state_observations).toHaveLength(1);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});

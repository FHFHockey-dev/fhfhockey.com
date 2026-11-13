import { describe, expect, it } from "vitest";
import { createMembershipSnapshot, readMembershipSnapshot } from "./membershipSnapshot";
import { membershipEventsFromStoredObservations, type StoredRosterObservation } from "./storedMembershipEvidence";
import type { GoalieWorkloadContractInput } from "./workloadContract";

function fixture(): GoalieWorkloadContractInput {
  const clock = "2026-10-24T12:00:00Z", hash = "a".repeat(64);
  const row: StoredRosterObservation = { id: "join", season_id: 20262027, fhfh_player_id: 501, nhl_player_id: 9001,
    observation_kind: "official_transaction", event_type: "membership", organization_team_id: 1, roster_status: "active_nhl",
    source_key: "join:1", source_url: "https://www.nhl.com/news/fixture", source_hash: hash,
    observed_at: clock, available_at: clock, created_at: clock, effective_at: "2026-09-01T00:00:00Z", supersedes_id: null };
  const normalized = membershipEventsFromStoredObservations({ identity: { goalieId: 101, fhfhPlayerId: 501, nhlPlayerId: 9001 },
    seasonId: 20262027, observedAt: clock, teams: [{ teamId: 1, abbreviation: "NJD" }, { teamId: 4, abbreviation: "PHI" }],
    observations: [row, { ...row, id: "trade", source_key: "trade:2", event_type: "trade", organization_team_id: 4,
      effective_at: "2026-10-20T12:00:00Z", supersedes_id: "join" }],
    resolutions: [{ resolutionId: "join-resolution", revision: "r1", observationId: "join", sourceHash: hash,
      basis: "official_nhl_membership_boundary", fromTeamId: null, toTeamId: 1, recordedAt: clock },
    { resolutionId: "trade-resolution", revision: "r1", observationId: "trade", sourceHash: hash,
      basis: "official_nhl_membership_boundary", fromTeamId: 1, toTeamId: 4, recordedAt: clock }] });
  const join = normalized.events.find(e => e.sourceRecordId === "join:1")!.evidenceId;
  const trade = normalized.events.find(e => e.sourceRecordId === "trade:2")!.evidenceId;
  const games = Array.from({ length: 15 }, (_, i) => ({ gameId: 100 + i, team: "NJD", seasonId: 20262027, gameType: 2,
    date: `2026-10-${String(i + 1).padStart(2, "0")}`, startsAt: `2026-10-${String(i + 1).padStart(2, "0")}T23:00:00Z`,
    final: true, reported: true, appearancesComplete: true, evidenceIds: [`final:${i}`] }));
  games.push(...games.map(g => ({ ...g, gameId: g.gameId + 100, team: "PHI" })));
  games.push({ ...games[0], gameId: 300, team: "PHI", date: "2026-10-22", startsAt: "2026-10-22T23:00:00Z" });
  return { goalieId: 101, scope: { seasonId: 20262027, gameType: 2, fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z" },
    observedAt: clock, scheduleComplete: true, scheduleEvidenceIds: ["schedule:r1"], games,
    appearances: games.map(g => ({ gameId: g.gameId, team: g.team, goalieId: g.gameId < 110 || g.gameId === 300 ? 101 : 102,
      started: true, evidenceIds: [`box:${g.gameId}`] })),
    membership: { events: normalized.events,
      // Independent synthetic coverage, deliberately not obtained from the old source adapter.
      coverage: { evidenceId: "coverage:1", sourceRecordId: "register:1", sourceRevision: "r1", goalieId: 101, seasonId: 20262027,
        fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z", recordedAt: clock, complete: true },
      stints: [{ stintId: "njd", team: "NJD", enteredBy: join, end: { kind: "departed", exitedBy: trade } },
        { stintId: "phi", team: "PHI", enteredBy: trade, end: { kind: "ongoing" } }] }
  };
}

function encode(input = fixture()) {
  const stored = createMembershipSnapshot("snapshot:r1", "2026-10-24T13:00:00Z", input);
  const expected = { snapshotId: stored.snapshot.snapshotId, sha256: stored.sha256, goalieId: input.goalieId,
    scope: input.scope, readAt: "2026-10-24T14:00:00Z" };
  return { ...stored, expected };
}

describe("immutable membership persistence and reader boundary", () => {
  it("round-trips stored observations through lineage to 11/16 without pre-trade PHI games", () => {
    const f = encode(); const r = readMembershipSnapshot(f.body, f.expected);
    expect(r.workload.history.total).toMatchObject({ starts: 11, appearances: 11, eligibleTeamGames: 16, startShare: 11 / 16 });
    expect(r.workload.history.stints.map(s => [s.team, s.starts, s.eligibleTeamGames])).toEqual([["NJD", 10, 15], ["PHI", 1, 1]]);
    expect(r.workload.future.startProbability).toBeNull();
    expect(r.sha256).toBe(f.sha256);
    expect(JSON.parse(f.body)).not.toHaveProperty("history");
  });

  it("requires the exact selected revision, content hash, player, season, game type and interval", () => {
    const f = encode();
    for (const patch of [{ snapshotId: "snapshot:r2" }, { sha256: "0".repeat(64) }, { goalieId: 501 },
      { scope: { ...f.expected.scope, seasonId: 20252026 } }, { scope: { ...f.expected.scope, gameType: 3 } },
      { scope: { ...f.expected.scope, throughAt: "2026-10-23T00:00:00Z" } }, { readAt: "2026-10-24T12:30:00Z" }]) {
      expect(() => readMembershipSnapshot(f.body, { ...f.expected, ...patch })).toThrow(/selection or integrity/);
    }
    const tampered = JSON.parse(f.body); tampered.input.appearances[0].goalieId = 102;
    expect(() => readMembershipSnapshot(JSON.stringify(tampered), f.expected)).toThrow(/integrity/);
  });

  it("rejects injected cached shares, malformed types, duplicate game identities and unbounded payloads", () => {
    const f = encode(); const injected = JSON.parse(f.body); injected.startProbability = 0.99;
    expect(() => readMembershipSnapshot(JSON.stringify(injected), f.expected)).toThrow();
    injected.input.scheduleComplete = "true"; delete injected.startProbability;
    expect(() => readMembershipSnapshot(JSON.stringify(injected), f.expected)).toThrow();
    const duplicate = fixture(); duplicate.games.push(duplicate.games[0]);
    expect(() => encode(duplicate)).toThrow(/Duplicate/);
    expect(() => readMembershipSnapshot(" ".repeat(2 * 1024 * 1024 + 1), f.expected)).toThrow(/bound/);
  });

  it("preserves membership uncertainty and absent coverage rather than persisting fabricated zero shares", () => {
    const unknown = fixture(); unknown.membership.events.find(e => e.toTeam === "PHI")!.effectiveAt = "2026-10-20";
    const f = encode(unknown); const r = readMembershipSnapshot(f.body, f.expected);
    expect(r.workload.membership.reasons).toContain("membership_effective_time_unknown");
    expect(r.workload.history.total.startShare).toBeNull();
    const missing = fixture(); missing.membership.coverage = null;
    const s = encode(missing);
    expect(readMembershipSnapshot(s.body, s.expected).workload.history.total.eligibleTeamGames).toBeNull();
  });

  it("retains injury/scratch opportunities and separates a relief appearance on the reader path", () => {
    const input = fixture(); input.appearances.push({ gameId: 110, team: "NJD", goalieId: 101, started: false, evidenceIds: ["relief:110"] });
    input.availability = [{ gameId: 111, team: "NJD", goalieId: 101, status: "injured", evidenceIds: ["injury:111"] },
      { gameId: 112, team: "NJD", goalieId: 101, status: "scratched", evidenceIds: ["scratch:112"] }];
    const f = encode(input); const r = readMembershipSnapshot(f.body, f.expected);
    expect(r.workload.history.total).toMatchObject({ starts: 11, appearances: 12, reliefAppearances: 1, eligibleTeamGames: 16,
      startShare: 11 / 16, appearanceShare: 12 / 16 });
    expect(r.workload.availability.map(a => a.status)).toEqual(["injured", "scratched"]);
  });

  it("produces deterministic canonical bytes and accepts equivalent offset scope instants", () => {
    const input = fixture(); const original = structuredClone(input); const f = encode(input);
    expect(input).toEqual(original);
    expect(encode({ ...input, scope: { throughAt: input.scope.throughAt, fromAt: input.scope.fromAt, gameType: 2, seasonId: 20262027 } }).body).toBe(f.body);
    expect(readMembershipSnapshot(f.body, { ...f.expected, scope: { ...f.expected.scope, fromAt: "2026-09-30T20:00:00-04:00" } }).sha256).toBe(f.sha256);
  });

  it("preserves exact immutable source coordinates in snapshot bytes", () => {
    const input = fixture(); input.membership.events[0].sourceRecordId = " source:key ";
    input.membership.events[0].sourceRevision = " source:revision ";
    input.membership.coverage!.sourceRecordId = " coverage:key ";
    const f = encode(input); const stored = JSON.parse(f.body);
    expect(stored.input.membership.events[0].sourceRecordId).toBe(" source:key ");
    expect(stored.input.membership.events[0].sourceRevision).toBe(" source:revision ");
    expect(stored.input.membership.coverage.sourceRecordId).toBe(" coverage:key ");
    expect(readMembershipSnapshot(f.body, f.expected).workload.history.total.startShare).toBe(11 / 16);
  });

  it("omits an explicitly undefined optional availability field from canonical JSON", () => {
    const input = fixture(); const f = encode({ ...input, availability: undefined });
    expect(() => readMembershipSnapshot(f.body, f.expected)).not.toThrow();
    expect(f.body).toBe(encode(input).body);
  });

  it("rejects orphan appearances instead of silently dropping contradictory game identity", () => {
    const input = fixture(); input.appearances.push({ ...input.appearances[0], gameId: 999 });
    expect(() => encode(input)).toThrow(/team-game/);
  });

  it("cannot admit a future snapshot by truncating sub-millisecond clocks", () => {
    const input = fixture();
    const f = createMembershipSnapshot("snapshot:r1", "2026-10-24T13:00:00.000001Z", input);
    expect(() => readMembershipSnapshot(f.body, { snapshotId: "snapshot:r1", sha256: f.sha256,
      goalieId: input.goalieId, scope: input.scope, readAt: "2026-10-24T13:00:00.000000Z" })).toThrow(/integrity/);
  });

  it("rejects unsafe numeric identities before encoding a snapshot", () => {
    const input = fixture(); input.goalieId = Number.MAX_SAFE_INTEGER + 1;
    expect(() => encode(input)).toThrow();
  });
});

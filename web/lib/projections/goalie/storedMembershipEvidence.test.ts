import { describe, expect, it } from "vitest";
import { membershipEventsFromStoredObservations, type StoredRosterObservation, type MembershipTransitionResolution } from "./storedMembershipEvidence";

const hash = "a".repeat(64);
function fixture() {
  const row: StoredRosterObservation = { id: "trade-row", season_id: 20262027, fhfh_player_id: 501, nhl_player_id: 9001,
    observation_kind: "official_transaction", event_type: "trade", organization_team_id: 4, roster_status: "active_nhl",
    source_key: "trade:42", source_url: "https://www.nhl.com/news/fixture", source_hash: hash,
    observed_at: "2026-10-20T13:00:00Z", available_at: "2026-10-20T13:00:00Z", created_at: "2026-10-20T14:00:00Z",
    effective_at: "2026-10-20T12:00:00Z", supersedes_id: "earlier-membership" };
  const resolution: MembershipTransitionResolution = { resolutionId: "resolution:42", revision: "r1", observationId: row.id,
    sourceHash: hash, basis: "official_nhl_membership_boundary", fromTeamId: 1, toTeamId: 4, recordedAt: "2026-10-20T15:00:00Z" };
  return { identity: { goalieId: 101, fhfhPlayerId: 501, nhlPlayerId: 9001 }, seasonId: 20262027, observedAt: "2026-10-24T12:00:00Z",
    teams: [{ teamId: 1, abbreviation: "NJD" }, { teamId: 4, abbreviation: "PHI" }], observations: [row], resolutions: [resolution] };
}

describe("stored membership evidence normalization", () => {
  it("maps explicit identities and keeps old/new clubs, effective time and source revision", () => {
    const r = membershipEventsFromStoredObservations(fixture());
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ goalieId: 101, fromTeam: "NJD", toTeam: "PHI", effectiveAt: "2026-10-20T12:00:00Z",
      recordedAt: "2026-10-20T15:00:00Z", sourceRecordId: "trade:42", sourceRevision: `${hash}:resolution:42:r1` });
    expect(r.records[0].disposition).toBe("boundary_evidence");
    expect(r.coverage).toBeNull(); expect(r.membershipComplete).toBe(false);
  });

  it("does not manufacture a boundary from the existing generator's null effective time and unresolved status", () => {
    const f = fixture(); f.observations[0].effective_at = null; f.observations[0].roster_status = "unresolved"; f.resolutions = [];
    const r = membershipEventsFromStoredObservations(f);
    expect(r.events).toEqual([]);
    expect(r.records[0].reasons).toEqual(["boundary_interpretation_missing", "effective_time_unknown"]);
    expect(r.records[0].observation.effective_at).toBeNull();
    expect(r.membershipComplete).toBe(false);
  });

  it("preserves an uncertain effective time even after the club interpretation is resolved", () => {
    const f = fixture(); f.observations[0].effective_at = null;
    const r = membershipEventsFromStoredObservations(f);
    expect(r.events[0].effectiveAt).toBeNull();
    expect(r.records[0].disposition).toBe("unresolved");
  });

  it.each(["official_roster", "player_landing", "trusted_ifttt"] as const)("keeps %s as context without promoting it to tenure", kind => {
    const f = fixture(); f.observations[0].observation_kind = kind;
    const r = membershipEventsFromStoredObservations(f);
    expect(r.events).toEqual([]); expect(r.records[0].disposition).toBe("context_only");
  });

  it("never closes membership on injury or guesses the effect of a waiver/affiliate assignment", () => {
    for (const type of ["injury", "waiver", "affiliate_assignment"] as const) {
      const f = fixture(); f.observations[0].event_type = type;
      expect(membershipEventsFromStoredObservations(f).events).toEqual([]);
    }
    const injured = fixture(); injured.observations[0].roster_status = "injured_nhl";
    expect(membershipEventsFromStoredObservations(injured).events[0].toTeam).toBe("PHI");
  });

  it("withholds mismatched identity, source hash, club, revision clock and nonofficial provenance", () => {
    const cases = [
      (f: ReturnType<typeof fixture>) => { f.observations[0].nhl_player_id = 101; },
      (f: ReturnType<typeof fixture>) => { f.resolutions[0].sourceHash = "b".repeat(64); },
      (f: ReturnType<typeof fixture>) => { f.resolutions[0].toTeamId = 1; },
      (f: ReturnType<typeof fixture>) => { f.resolutions[0].recordedAt = "2026-10-25T00:00:00Z"; },
      (f: ReturnType<typeof fixture>) => { f.observations[0].source_url = "https://nhl.com.example.test/article"; },
      (f: ReturnType<typeof fixture>) => { f.observations[0].available_at = "2026-10-19T00:00:00Z"; },
      (f: ReturnType<typeof fixture>) => { f.teams.pop(); }
    ];
    for (const change of cases) {
      const f = fixture(); change(f); const r = membershipEventsFromStoredObservations(f);
      expect(r.events).toEqual([]); expect(r.records[0].reasons.length).toBeGreaterThan(0);
    }
  });

  it("retains predecessor records instead of interpreting supersedes_id as deletion of historical membership", () => {
    const f = fixture();
    f.observations.push({ ...f.observations[0], id: "earlier-membership", source_key: "join:1", source_hash: "b".repeat(64),
      event_type: "membership", organization_team_id: 1, effective_at: "2026-09-01T00:00:00Z", supersedes_id: null });
    f.resolutions.push({ ...f.resolutions[0], observationId: "earlier-membership", resolutionId: "resolution:1", sourceHash: "b".repeat(64), fromTeamId: null, toTeamId: 1 });
    const r = membershipEventsFromStoredObservations(f);
    expect(r.events.map(e => e.toTeam)).toEqual(["NJD", "PHI"]);
    expect(r.records.find(record => record.observation.id === "trade-row")?.observation.supersedes_id).toBe("earlier-membership");
  });

  it("preserves the exact stored source key rather than trimming an immutable coordinate", () => {
    const f = fixture(); f.observations[0].source_key = " trade:42 ";
    const r = membershipEventsFromStoredObservations(f);
    expect(r.records[0].observation.source_key).toBe(" trade:42 ");
    expect(r.events[0].sourceRecordId).toBe(" trade:42 ");
  });

  it("rejects duplicate/oversized source sets and orphan resolutions", () => {
    const f = fixture(); f.observations.push(f.observations[0]);
    expect(() => membershipEventsFromStoredObservations(f)).toThrow(/Duplicate/);
    const orphan = fixture(); orphan.observations = [];
    expect(() => membershipEventsFromStoredObservations(orphan)).toThrow(/no source/);
    const oversized = fixture(); oversized.observations = Array(257).fill(oversized.observations[0]);
    expect(() => membershipEventsFromStoredObservations(oversized)).toThrow();
  });

  it("rejects aliased copies of one immutable source coordinate", () => {
    const f = fixture(); f.observations.push({ ...f.observations[0], id: "alias" });
    f.resolutions.push({ ...f.resolutions[0], observationId: "alias", resolutionId: "alias-resolution" });
    expect(() => membershipEventsFromStoredObservations(f)).toThrow(/Duplicate/);
  });

  it("rejects unsafe numeric identities", () => {
    const unsafe = fixture(); unsafe.identity.goalieId = Number.MAX_SAFE_INTEGER + 1;
    expect(() => membershipEventsFromStoredObservations(unsafe)).toThrow();
  });

  it("does not accept a resolution recorded after the read clock by one microsecond", () => {
    const f = fixture(); f.resolutions[0].recordedAt = "2026-10-24T12:00:00.000001Z";
    expect(membershipEventsFromStoredObservations(f).events).toEqual([]);
  });
});

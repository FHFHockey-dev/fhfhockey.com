import { describe, expect, it } from "vitest";
import { resolveGoalieMembershipLineage, membershipWorkloadFields, type GoalieMembershipLineageInput } from "./membershipLineage";

function fixture(): GoalieMembershipLineageInput {
  return {
    goalieId: 1, scope: { seasonId: 20262027, gameType: 2, fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z" },
    observedAt: "2026-10-24T12:00:00Z",
    coverage: { evidenceId: "coverage", sourceRecordId: "register:1", sourceRevision: "r1", goalieId: 1, seasonId: 20262027,
      fromAt: "2026-10-01T00:00:00Z", throughAt: "2026-10-24T00:00:00Z", recordedAt: "2026-10-24T01:00:00Z", complete: true },
    events: [
      { evidenceId: "join", source: "official_eligibility", sourceRecordId: "eligibility:1", sourceRevision: "r1", goalieId: 1,
        fromTeam: null, toTeam: "NJD", effectiveAt: "2026-09-01T00:00:00Z", recordedAt: "2026-09-01T01:00:00Z" },
      { evidenceId: "trade", source: "official_transaction", sourceRecordId: "transaction:2", sourceRevision: "r2", goalieId: 1,
        fromTeam: "NJD", toTeam: "PHI", effectiveAt: "2026-10-20T12:00:00Z", recordedAt: "2026-10-20T13:00:00Z" }
    ],
    stints: [
      { stintId: "njd", team: "NJD", enteredBy: "join", end: { kind: "departed", exitedBy: "trade" } },
      { stintId: "phi", team: "PHI", enteredBy: "trade", end: { kind: "ongoing" } }
    ]
  };
}

describe("authoritative membership lineage admission", () => {
  it("uses the same immutable trade record to close NJD and open PHI", () => {
    const r = resolveGoalieMembershipLineage(fixture());
    expect(r.complete).toBe(true);
    expect(r.stints.map(s => [s.team, s.fromAt, s.untilAt, s.evidenceIds])).toEqual([
      ["NJD", "2026-09-01T00:00:00.000Z", "2026-10-20T12:00:00.000Z", ["join", "trade"]],
      ["PHI", "2026-10-20T12:00:00.000Z", null, ["trade"]]
    ]);
    expect(r.events.find(e => e.evidenceId === "trade")).toMatchObject({ sourceRecordId: "transaction:2", sourceRevision: "r2", recordedAt: "2026-10-20T13:00:00Z" });
    expect(membershipWorkloadFields(r).membershipComplete).toBe(true);
  });

  it.each(["roster_snapshot", "appearance"] as const)("does not turn %s into tenure evidence", source => {
    const f = fixture(); f.events[1].source = source;
    const r = resolveGoalieMembershipLineage(f);
    expect(r.complete).toBe(false);
    expect(r.reasons).toContain("membership_source_not_authoritative");
    expect(r.stints.every(s => s.boundaryStatus === "unknown")).toBe(true);
  });

  it.each([null, "2026-10-20", "2026-02-30T12:00:00Z"])("keeps ambiguous/invalid effective time %s unknown", effectiveAt => {
    const f = fixture(); f.events[1].effectiveAt = effectiveAt;
    const r = resolveGoalieMembershipLineage(f);
    expect(r.complete).toBe(false);
    expect(r.reasons).toContain("membership_effective_time_unknown");
    expect(r.stints.find(s => s.team === "PHI")?.fromAt).toBeNull();
  });

  it("distinguishes an unknown departure from an evidenced ongoing membership", () => {
    const f = fixture(); f.stints[1].end = { kind: "unknown" };
    expect(resolveGoalieMembershipLineage(f).reasons).toContain("membership_end_unknown");
    f.stints[1].end = { kind: "ongoing" }; f.coverage = null;
    expect(resolveGoalieMembershipLineage(f).reasons).toContain("ongoing_membership_unproven");
  });

  it("requires coverage matching the player, season, full window, revision and observation clock", () => {
    for (const patch of [
      { goalieId: 2 }, { seasonId: 20252026 }, { fromAt: "2026-10-02T00:00:00Z" },
      { throughAt: "2026-10-23T00:00:00Z" }, { recordedAt: "2026-10-23T00:00:00Z" },
      { recordedAt: "2026-10-25T00:00:00Z" }, { sourceRevision: "" }, { complete: false }
    ]) {
      const f = fixture(); Object.assign(f.coverage!, patch);
      expect(resolveGoalieMembershipLineage(f).reasons).toContain("membership_coverage_unproven");
    }
  });

  it("fails closed on missing records, wrong identity, missing revision and post-observation evidence", () => {
    const patches = [{ goalieId: 2 }, { toTeam: "BOS" }, { sourceRevision: "" }, { recordedAt: "2026-10-25T00:00:00Z" }];
    for (const patch of patches) {
      const f = fixture(); Object.assign(f.events[1], patch);
      expect(resolveGoalieMembershipLineage(f).complete).toBe(false);
    }
    const f = fixture(); f.events.pop();
    expect(resolveGoalieMembershipLineage(f).reasons).toContain("membership_event_missing");
  });

  it("does not silently lose either side of a trade or overlap stints", () => {
    const f = fixture(); f.stints.pop();
    expect(resolveGoalieMembershipLineage(f).reasons).toContain("membership_event_unassigned");
    const overlap = fixture(); overlap.stints[0].end = { kind: "ongoing" };
    const r = resolveGoalieMembershipLineage(overlap);
    expect(r.reasons).toContain("membership_intervals_overlap");
    expect(r.stints.every(s => s.boundaryStatus === "unknown")).toBe(true);
  });

  it("does not omit the destination stint when a trade precedes the requested window", () => {
    const f = fixture(); f.scope.fromAt = "2026-10-21T00:00:00Z"; f.stints.pop();
    expect(resolveGoalieMembershipLineage(f).reasons).toContain("membership_event_unassigned");
  });

  it("rejects conflicting aliases for the same immutable source record and revision", () => {
    const f = fixture(); f.events[1].source = f.events[0].source;
    f.events[1].sourceRecordId = f.events[0].sourceRecordId;
    f.events[1].sourceRevision = f.events[0].sourceRevision;
    const r = resolveGoalieMembershipLineage(f);
    expect(r.reasons).toContain("membership_source_record_duplicate");
    expect(r.stints.every(s => s.boundaryStatus === "unknown")).toBe(true);
  });

  it("preserves a no-team gap and a return as separate episodes", () => {
    const f = fixture(); f.events[1].toTeam = null;
    f.events.push({ ...f.events[1], evidenceId: "return", sourceRecordId: "eligibility:3", source: "official_eligibility",
      fromTeam: null, toTeam: "NJD", effectiveAt: "2026-10-22T12:00:00Z", recordedAt: "2026-10-22T13:00:00Z" });
    f.stints[1] = { stintId: "njd-return", team: "NJD", enteredBy: "return", end: { kind: "ongoing" } };
    const r = resolveGoalieMembershipLineage(f);
    expect(r.complete).toBe(true);
    expect(r.stints.map(s => [s.stintId, s.fromAt, s.untilAt])).toEqual([
      ["njd", "2026-09-01T00:00:00.000Z", "2026-10-20T12:00:00.000Z"],
      ["njd-return", "2026-10-22T12:00:00.000Z", null]
    ]);
  });

  it("canonicalizes offset timestamps and preserves deterministic source ordering without mutating inputs", () => {
    const f = fixture(); const before = structuredClone(f);
    const expected = resolveGoalieMembershipLineage(f);
    expect(f).toEqual(before);
    f.stints.reverse(); f.events.reverse();
    expect(resolveGoalieMembershipLineage(f)).toEqual(expected);
    f.events[0].effectiveAt = "2026-10-20T08:00:00-04:00";
    expect(resolveGoalieMembershipLineage(f).stints).toEqual(expected.stints);
  });

  it("rejects duplicate receipt identities and future or ambiguous reporting scopes", () => {
    const f = fixture(); f.events.push(f.events[0]);
    expect(() => resolveGoalieMembershipLineage(f)).toThrow(/Duplicate/);
    const dateOnly = fixture(); dateOnly.scope.fromAt = "2026-10-01";
    expect(() => resolveGoalieMembershipLineage(dateOnly)).toThrow(/scope/);
    const future = fixture(); future.observedAt = "2026-10-23T00:00:00Z";
    expect(() => resolveGoalieMembershipLineage(future)).toThrow(/scope/);
  });

  it("does not round an effective boundary across puck drop at sub-millisecond precision", () => {
    const f = fixture(); f.events[1].effectiveAt = "2026-10-20T12:00:00.000001Z";
    const r = resolveGoalieMembershipLineage(f);
    expect(r.complete).toBe(false);
    expect(r.reasons).toContain("membership_effective_time_unknown");
    expect(r.stints.find(s => s.team === "PHI")?.fromAt).toBeNull();
    f.events[1].effectiveAt = "2026-10-20T12:00:00.000000Z";
    expect(resolveGoalieMembershipLineage(f).complete).toBe(true);
  });
});

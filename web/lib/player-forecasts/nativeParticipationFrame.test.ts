// @vitest-environment node
import { describe, expect, it } from "vitest";
import { timestampMicros } from "../projections/evidenceTime";
import { nativeParticipationCohortIds, nativeParticipationWindow, validateNativeParticipationFrame,
  type NativeParticipationFrameInput, type ParticipationEvidence } from "./nativeParticipationFrame";

// Synthetic scoped review fixtures verify mechanics; they authenticate no genuine frame.
const evidence = <T>(value: T, sourceId: string): ParticipationEvidence<T> => ({
  status: "complete", value, sourceIds: [sourceId], reasons: [],
  review: { id: "synthetic-review", bundleHash: "a".repeat(64), reviewedAt: "2026-10-13T20:00:00Z" },
});
function fixture(): NativeParticipationFrameInput {
  const cohort = nativeParticipationCohortIds.map((canonicalPlayerId, index) => ({ canonicalPlayerId, nhlPlayerId: 8_000_001 + index }));
  const gameId = 2026020078;
  return {
    trainingLockedAt: "2026-10-13T22:00:00.000002Z", cohort,
    sources: [
      { id: "schedule", kind: "independent_all_club_schedule", contentHash: "b".repeat(64),
        originalAvailableAt: "2026-10-13T06:00:00Z", capturedAt: "2026-10-13T10:00:00Z" },
      { id: "membership", kind: "dated_roster_membership", contentHash: "c".repeat(64),
        originalAvailableAt: "2026-10-12T12:00:00Z", capturedAt: "2026-10-13T10:00:00Z" },
      { id: "occurrence", kind: "game_occurrence", contentHash: "d".repeat(64),
        originalAvailableAt: "2026-10-10T11:00:00Z", capturedAt: "2026-10-13T10:00:00Z" },
      { id: "label", kind: "official_participation_resolution", contentHash: "e".repeat(64),
        originalAvailableAt: "2026-10-10T12:00:00Z", capturedAt: "2026-10-13T10:00:00Z" },
    ],
    universe: evidence({ ...nativeParticipationWindow, scope: "independent_all_club_games_cross_frozen_cohort",
      cohort: structuredClone(cohort), gameIds: [gameId], clubIds: [16, 17] }, "schedule"),
    opportunities: [{ gameId, schedule: evidence({ gameId, seasonId: 20262027, gameType: 2, revisionId: "original-revision",
      startAt: "2026-10-10T10:00:00.000002Z", homeTeamId: 16, awayTeamId: 17,
      selectionRule: "selected_before_decision_cutoff", selectedAt: "2026-10-10T08:00:00Z" }, "schedule") }],
    observations: cohort.map(player => ({ ...player, gameId, revisionId: "original-revision",
      membership: evidence({ ...player, scope: "participating_club_roster_listed_organization", scopeTeamIds: [16, 17],
        listed: true, teamId: 16, validFrom: "2026-07-01T00:00:00Z", validUntil: null }, "membership"),
      occurrence: evidence({ gameId, occurred: true, actualStartAt: "2026-10-10T10:00:00.000002Z" }, "occurrence"),
      label: evidence({ gameId, nhlPlayerId: player.nhlPlayerId, resolution: "explicit_official_toi", toiSeconds: 1 }, "label"),
    })),
  };
}
const first = (input: NativeParticipationFrameInput) => validateNativeParticipationFrame(input).candidates[0];

describe("native participation frame accounting", () => {
  it("counts explicit positive/zero TOI without mutation or probability/issuance", () => {
    const input = fixture(); input.observations[1].label.value!.toiSeconds = 0;
    const before = JSON.stringify(input), result = validateNativeParticipationFrame(input);
    expect(result).toMatchObject({ status: "complete", counts: { C: 17, P: 16, Z: 1, U_label: 0, U_frame: 0, O: 0, K: 0 },
      admittedCounts: { X: 16, N: 17 }, forecastIssued: false, qualificationEligible: false });
    expect(result.candidates[0].decisionCutoffMicros).toBe(timestampMicros("2026-10-10T09:00:00.000002Z")!.toString());
    expect(JSON.stringify(input)).toBe(before);
    expect(result.sources).toEqual(input.sources);
    expect(result).not.toHaveProperty("probability");
    expect(result).not.toHaveProperty("forecast");
  });
  it("accepts retrospectively available truth without claiming historical pregame features", () => {
    const input = fixture(), result = validateNativeParticipationFrame(input);
    expect(timestampMicros(input.sources[1].originalAvailableAt)! > BigInt(result.candidates[0].decisionCutoffMicros!)).toBe(true);
    expect(result.admittedCounts).toEqual({ X: 17, N: 17 });
    expect(result.limitations).toContain("Retrospective labels and membership truth do not establish historical pregame feature availability.");
  });
  it("requires an explicit complete nonappearance resolution for that zero label", () => {
    const input = fixture(); input.observations[0].label.value = { ...input.observations[0].label.value!,
      resolution: "explicit_complete_nonappearance", toiSeconds: 0 };
    expect(first(input).disposition).toBe("Z");
  });
  it("keeps absent labels unknown and withholds the aggregate denominator", () => {
    const input = fixture(); input.observations[0].label.status = "unknown"; input.observations[0].label.value = null;
    expect(validateNativeParticipationFrame(input)).toMatchObject({ status: "partial", admittedCounts: null,
      counts: { P: 16, Z: 0, U_label: 1 } });
    expect(first(input).disposition).toBe("U_label");
  });
  it("enumerates a missing observation as unknown rather than dropping it or inventing nonappearance", () => {
    const input = fixture(); input.observations.shift(); const result = validateNativeParticipationFrame(input);
    expect(result.counts).toMatchObject({ C: 17, P: 16, Z: 0, U_frame: 1 });
    expect(result.candidates[0]).toMatchObject({ disposition: "U_frame", observations: [] });
    expect(result.admittedCounts).toBeNull();
  });
  it.each(["partial", "unknown", "conflicting"] as const)("preserves %s universe evidence without admitting counts", status => {
    const input = fixture(); input.universe.status = status; const result = validateNativeParticipationFrame(input);
    expect(result.universe.status).toBe(status); expect(result.admittedCounts).toBeNull();
    expect(result.status).toBe(status === "unknown" ? "partial" : status);
    expect(result.counts.P).toBe(17); // Diagnostic positive candidates; no admitted denominator.
  });
  it("reports a wholly unknown frame", () => {
    const input = fixture(); input.universe.status = "unknown"; input.universe.value = null; input.observations = [];
    expect(validateNativeParticipationFrame(input)).toMatchObject({ status: "unknown", admittedCounts: null, counts: { U_frame: 17 } });
  });
  it("requires the fixed full window/cohort and independent enumeration", () => {
    const input = fixture(); input.universe.value!.startInclusive = "2026-10-01T00:00:00Z";
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
    input.universe.value!.startInclusive = nativeParticipationWindow.startInclusive;
    input.universe.value!.gameIds = [];
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
    input.universe.value!.gameIds = [input.opportunities[0].gameId];
    input.cohort.pop(); input.observations.pop(); input.universe.value!.cohort.pop();
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
  });
  it.each(["before", "at"] as const)("does not prove membership ending %s the half-open cutoff", placement => {
    const input = fixture(); input.observations[0].membership.value!.validUntil = placement === "before"
      ? "2026-10-10T09:00:00.000001Z" : "2026-10-10T09:00:00.000002Z";
    expect(first(input).disposition).toBe("U_frame");
  });
  it("preserves a membership starting exactly at the cutoff and ending one microsecond later", () => {
    const input = fixture(); Object.assign(input.observations[0].membership.value!, {
      validFrom: "2026-10-10T09:00:00.000002Z", validUntil: "2026-10-10T09:00:00.000003Z" });
    expect(first(input).disposition).toBe("P");
  });
  it("does not substitute current organization or one-club absence for the scoped membership frame", () => {
    const input = fixture(); input.observations[0].membership.value!.scopeTeamIds = [16];
    expect(first(input).disposition).toBe("U_frame");
    input.observations[0].membership.value!.scopeTeamIds = [16, 17];
    input.observations[0].membership.value!.validFrom = "2026-10-11T00:00:00Z";
    expect(first(input).disposition).toBe("U_frame");
  });
  it("retains outside-frame and nonoccurrence separately from negative outcomes, including N=0", () => {
    const input = fixture();
    for (const row of input.observations) { row.membership.value!.listed = false; row.membership.value!.teamId = null; }
    expect(validateNativeParticipationFrame(input)).toMatchObject({ status: "complete", counts: { O: 17, Z: 0 }, admittedCounts: null });
    for (const row of input.observations) {
      row.occurrence.value = { gameId: row.gameId, occurred: false, actualStartAt: null };
      row.label.status = "unknown"; row.label.value = null;
    }
    expect(validateNativeParticipationFrame(input)).toMatchObject({ status: "complete", counts: { K: 17, Z: 0 }, admittedCounts: null });
  });
  it("retains a nonoccurrence/complete participation contradiction as a conflict", () => {
    const input = fixture(); input.observations[0].occurrence.value = { gameId: input.observations[0].gameId,
      occurred: false, actualStartAt: null };
    expect(first(input)).toMatchObject({ disposition: "U_frame", evidenceStatus: "conflicting",
      reasons: ["game_occurrence_conflict"] });
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
  });
  it.each(["same", "distinct"])("withholds cross-player cancellation/occurrence with %s source IDs", sourceKind => {
    const input = fixture(), before = structuredClone(input);
    input.observations[0].occurrence.value = { gameId: input.observations[0].gameId, occurred: false, actualStartAt: null };
    input.observations[0].label.status = "unknown"; input.observations[0].label.value = null;
    if (sourceKind === "distinct") {
      input.sources.push({ ...input.sources[2], id: "cancellation-source", contentHash: "f".repeat(64) });
      input.observations[0].occurrence.sourceIds = ["cancellation-source"];
    }
    const original = JSON.stringify(input), result = validateNativeParticipationFrame(input);
    expect(result).toMatchObject({ status: "conflicting", counts: { C: 17, U_frame: 17, P: 0, Z: 0, K: 0 }, admittedCounts: null });
    expect(result.frameIssues).toContainEqual({ status: "conflicting", reason: "game_occurrence_conflict:2026020078:original-revision" });
    expect(result.perPlayer.every(player => player.admittedCounts === null)).toBe(true);
    expect(result.candidates[0].observations[0].occurrence.value!.occurred).toBe(false);
    expect(result.candidates[1].observations[0].occurrence).toEqual(before.observations[1].occurrence);
    expect(JSON.stringify(input)).toBe(original);
  });
  it("compares game actual-start instants at microsecond precision while preserving clock strings", () => {
    const input = fixture(); input.observations[0].occurrence.value!.actualStartAt = "2026-10-10T06:00:00.000002-04:00";
    expect(validateNativeParticipationFrame(input).admittedCounts).toEqual({ X: 17, N: 17 });
    expect(first(input).observations[0].occurrence.value!.actualStartAt).toBe("2026-10-10T06:00:00.000002-04:00");
    input.observations[0].occurrence.value!.actualStartAt = "2026-10-10T06:00:00.000003-04:00";
    expect(validateNativeParticipationFrame(input)).toMatchObject({ status: "conflicting", admittedCounts: null });
  });
  it("preserves a same-player nonoccurrence/participation conflict when no other game fact resolves it", () => {
    const input = fixture();
    for (const row of input.observations) row.occurrence.status = "unknown";
    input.observations[0].occurrence.status = "complete";
    input.observations[0].occurrence.value = { gameId: input.observations[0].gameId, occurred: false, actualStartAt: null };
    expect(first(input).reasons).toContain("nonoccurrence_conflicts_with_participation_resolution");
  });
  it("does not call an unproved cancellation a zero or remove its attempted slot", () => {
    const input = fixture(); input.observations[0].occurrence.status = "partial";
    expect(first(input)).toMatchObject({ disposition: "U_frame", evidenceStatus: "partial" });
    expect(validateNativeParticipationFrame(input).counts.C).toBe(17);
  });
  it("retains conflicting schedule revisions and their original evidence", () => {
    const input = fixture(), revised = structuredClone(input.opportunities[0]); revised.schedule.value!.revisionId = "replacement";
    input.opportunities.push(revised); input.universe.value!.gameIds.push(revised.gameId);
    const result = validateNativeParticipationFrame(input);
    expect(result).toMatchObject({ status: "conflicting", counts: { C: 34, U_frame: 34 }, admittedCounts: null });
    expect(result.candidates[17].schedule.value!.revisionId).toBe("replacement");
  });
  it("retains duplicate observations as a conflict instead of choosing the favorable label", () => {
    const input = fixture(), other = structuredClone(input.observations[0]); other.label.value!.toiSeconds = 0;
    input.observations.push(other); expect(first(input)).toMatchObject({ disposition: "U_frame", evidenceStatus: "conflicting" });
    expect(first(input).observations).toHaveLength(2);
  });
  it("retains observations outside the independent universe and withholds completeness", () => {
    const input = fixture(), extra = structuredClone(input.observations[0]); extra.gameId++;
    input.observations.push(extra); const result = validateNativeParticipationFrame(input);
    expect(result.status).toBe("conflicting"); expect(result.unmatchedObservations).toEqual([extra]);
    expect(result.admittedCounts).toBeNull();
  });
  it.each(["nhl", "revision", "label", "membership"])("withholds a conflicting %s tuple", field => {
    const input = fixture(), row = input.observations[0];
    if (field === "nhl") row.nhlPlayerId++;
    if (field === "revision") row.revisionId = "another";
    if (field === "label") row.label.value!.nhlPlayerId++;
    if (field === "membership") row.membership.value!.canonicalPlayerId++;
    expect(["U_frame", "U_label"]).toContain(first(input).disposition);
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
  });
  it.each([-1, 0.5, NaN])("rejects invalid official TOI seconds %s", seconds => {
    const input = fixture(); input.observations[0].label.value!.toiSeconds = seconds;
    expect(first(input)).toMatchObject({ disposition: "U_label", evidenceStatus: "conflicting" });
  });
  it("rejects a positive-minute purported nonappearance", () => {
    const input = fixture(); input.observations[0].label.value!.resolution = "explicit_complete_nonappearance";
    expect(first(input).disposition).toBe("U_label");
  });
  it.each(["missing", "future", "capture", "hash", "duplicate", "wrong-kind"])("withholds %s original source evidence", failure => {
    const input = fixture(), source = input.sources[3];
    if (failure === "missing") input.sources.pop();
    if (failure === "future") source.originalAvailableAt = "2026-10-14T00:00:00Z";
    if (failure === "capture") source.capturedAt = "2026-10-14T00:00:00Z";
    if (failure === "hash") source.contentHash = "provider-shaped-json";
    if (failure === "duplicate") input.sources.push(structuredClone(source));
    if (failure === "wrong-kind") source.kind = "dated_roster_membership";
    expect(first(input).disposition).toBe("U_label"); expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
  });
  it("requires a scoped review and actual review/training lock clocks", () => {
    const input = fixture(); input.observations[0].membership.review = null;
    expect(first(input).disposition).toBe("U_frame");
    input.observations[0].membership = fixture().observations[0].membership;
    input.trainingLockedAt = "2026-10-13T09:00:00Z";
    expect(validateNativeParticipationFrame(input).admittedCounts).toBeNull();
  });
  it("requires final labels and occurred-game evidence to follow actual start", () => {
    const input = fixture(); input.sources[3].originalAvailableAt = "2026-10-10T09:00:00Z";
    expect(first(input).disposition).toBe("U_label");
    input.sources[3] = fixture().sources[3]; input.sources[2].originalAvailableAt = "2026-10-10T09:00:00Z";
    expect(first(input).disposition).toBe("U_frame");
  });
  it("does not accept a revision selected one microsecond beyond the decision", () => {
    const input = fixture(); input.opportunities[0].schedule.value!.selectedAt = "2026-10-10T09:00:00.000003Z";
    expect(first(input).reasons).toContain("schedule_revision_selected_after_decision");
  });
  it("keeps accounting exact and individual unavailable counts when one player's label is missing", () => {
    const input = fixture(); input.observations[0].label.status = "unknown";
    const result = validateNativeParticipationFrame(input), c = result.counts;
    expect(c.C).toBe(c.P + c.Z + c.U_label + c.U_frame + c.O + c.K);
    expect(result.perPlayer[0].admittedCounts).toBeNull();
    expect(result.perPlayer[1].admittedCounts).toEqual({ X: 1, N: 1 });
    expect(result.admittedCounts).toBeNull();
  });
});

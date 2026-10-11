import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validatePrivateParticipationScenario, type PrivateParticipationConflict,
  type PrivateParticipationFact, type PrivateParticipationIntake } from "./privateParticipationScenario";

// Fictional controls test mechanics only; these are never actual participation receipts.
const fixture = (): PrivateParticipationIntake => ({
  target: { canonicalPlayerId: 9920, nhlPlayerId: 8471214, teamId: 15,
    gameId: 2026020084, seasonId: 20262027, gameStartsAt: "2026-10-11T21:00:00Z" },
  cutoffAt: "2026-10-11T20:15:00Z", evaluatedAt: "2026-10-11T20:18:00Z",
  evidenceObservedThroughAt: "2026-10-11T20:16:00Z", facts: [], conflicts: [],
});
const fact = (id = "fictional-ev"): PrivateParticipationFact => ({
  evidenceId: id, canonicalPlayerId: 9920, seasonId: 20262027, gameId: 2026020084, teamId: 15,
  source: { sourceId: id, sourceKey: "fictional-reporter", sourceUrl: "https://example.com/fictional-control",
    originalBody: "fictional accepted lineup control", bodySha256: createHash("sha256").update("fictional accepted lineup control").digest("hex"),
    parserVersion: "line-source-v2", publishedAt: "2026-10-11T20:00:00Z", receivedAt: "2026-10-11T20:01:00Z",
    createdAt: "2026-10-11T20:02:00Z", acceptedAt: "2026-10-11T20:03:00Z", accepted: true,
    expiresAt: "2026-10-11T20:45:00Z", authoritativeValidUntil: null },
  assignment: { id: `${id}-child`, snapshotId: id, playerId: 8471214, unitType: "forward_line",
    unitNumber: 1, status: "confirmed", createdAt: "2026-10-11T20:02:30Z" },
});
const populated = () => ({ ...fixture(), facts: [fact()] });
const conflict = (selected = "fictional-ev"): PrivateParticipationConflict => ({
  row: { id: "fictional-conflict", game_id: 2026020084, team_id: 15, player_id: 8471214,
    conflict_type: "lineup", detected_at: "2026-10-11T20:05:00Z", created_at: "2026-10-11T20:06:00Z",
    player_forecast_conflict_resolutions: [{ action: "select_observation", selected_observation_id: selected,
      resolved_at: "2026-10-11T20:08:00Z", created_at: "2026-10-11T20:09:00Z" }] },
  evidenceIds: ["fictional-ev", "fictional-out"], source: { ...fact().source,
    publishedAt: "2026-10-11T20:07:00Z", receivedAt: "2026-10-11T20:08:00Z",
    createdAt: "2026-10-11T20:09:00Z", acceptedAt: "2026-10-11T20:10:00Z" },
});
const excluded = () => {
  const row = fact("fictional-out");
  row.assignment = { ...row.assignment, unitType: "scratch", unitNumber: null, status: "ruled_out" };
  return row;
};
const blocked = (input: PrivateParticipationIntake, reason?: string) => {
  const result = validatePrivateParticipationScenario(input);
  expect(result).toMatchObject({ status: "BLOCKED", indicator: null, appearanceProbability: null,
    calibratedProbability: false, notReleasedGameForecast: true, publicAdmissionAllowed: false });
  if (reason) expect(result.blockReasons).toContain(reason);
  return result;
};

describe("private participation scenario intake — fictional mechanics only", () => {
  it("keeps missing actual evidence unknown instead of inferring exclusion", () => {
    blocked(fixture(), "confirmed_participation_missing_or_conflicting");
  });
  it("reuses the confirmed EV branch as scenario1 with no calibrated probability or public admission", () => {
    const result = validatePrivateParticipationScenario(populated());
    expect(result).toMatchObject({ status: "READY", indicator: 1, appearanceProbability: null,
      classification: "private_confirmed_participation_as_of_cutoff_scenario",
      evidencePolicy: "confirmed_evidence_0_or_1_not_calibrated_p_play", calibratedProbability: false,
      currentAbsenceOfNewsVerified: false, notReleasedGameForecast: true, publicAdmissionAllowed: false,
      evidenceIds: ["fictional-ev"], sourceValidity: [{ evidenceId: "fictional-ev", validUntil: "2026-10-11T20:45:00Z" }] });
  });
  it("preserves explicit exclusion as scenario0, rather than treating zero as unknown", () => {
    expect(validatePrivateParticipationScenario({ ...fixture(), facts: [excluded()] })).toMatchObject({ status: "READY", indicator: 0, appearanceProbability: null });
  });
  it("requires the v2 ruled-out injury semantics", () => {
    const input = { ...fixture(), facts: [excluded()] };
    input.facts[0].assignment.unitType = "injury";
    expect(validatePrivateParticipationScenario(input).indicator).toBe(0);
    input.facts[0].source.parserVersion = "line-source-v1";
    blocked(input, "participation_applicability_uncertain");
  });
  it.each(["power_play", "roster", "practice"])("does not promote %s evidence to appearance", unitType => {
    const input = populated(); input.facts[0].assignment.unitType = unitType;
    blocked(input, "confirmed_participation_missing_or_conflicting");
  });
  it("does not promote an injury return to appearance, or ignore a return beside an older exclusion", () => {
    const returning = fact("fictional-return"); returning.assignment.unitType = "injury";
    blocked({ ...fixture(), facts: [returning] });
    blocked({ ...fixture(), facts: [excluded(), returning] }, "exclusion_return_supersession_unresolved");
  });
  it.each(["canonicalPlayerId", "seasonId", "gameId", "teamId"] as const)("rejects a substituted %s", key => {
    const input = populated(); input.facts[0][key]++;
    blocked(input, "evidence_identity_mismatch");
  });
  it("binds the actual NHL child assignment and parent snapshot", () => {
    const input = populated(); input.facts[0].assignment.playerId++;
    blocked(input, "evidence_identity_mismatch");
    input.facts[0] = fact(); input.facts[0].assignment.snapshotId = "other-snapshot";
    blocked(input, "invalid_child_assignment_binding");
  });
  it.each(["publishedAt", "receivedAt", "createdAt", "acceptedAt"] as const)("withholds future or missing %s, even when publication is early", key => {
    const input = populated(); input.facts[0].source[key] = "2026-10-11T20:15:00.000001Z";
    blocked(input, "source_not_known_by_cutoff");
    input.facts[0].source[key] = null;
    blocked(input, "missing_or_invalid_source_clock");
  });
  it("rejects changed bodies, missing source identity, unaccepted rows and reversed source clocks", () => {
    const input = populated(); input.facts[0].source.originalBody += " changed";
    blocked(input, "source_body_hash_mismatch");
    input.facts[0] = fact(); input.facts[0].source.sourceUrl = "";
    blocked(input, "missing_source_identity");
    input.facts[0] = fact(); input.facts[0].source.accepted = false;
    blocked(input, "source_not_accepted");
    input.facts[0] = fact(); input.facts[0].source.receivedAt = "2026-10-11T19:59:00Z";
    blocked(input, "source_clock_order_invalid");
  });
  it("rejects missing/late/duplicate child receipts", () => {
    const input = populated(); input.facts[0].assignment.createdAt = null;
    blocked(input, "child_not_known_by_cutoff");
    input.facts[0] = fact(); input.facts[0].assignment.createdAt = "2026-10-11T20:15:00.000001Z";
    blocked(input, "child_not_known_by_cutoff");
    input.facts = [fact(), fact()]; blocked(input, "invalid_child_assignment_binding");
  });
  it("rechecks original expiry at evaluation, with the earliest source/authority/game boundary", () => {
    const input = populated(); input.facts[0].source.expiresAt = "2026-10-11T20:18:00Z";
    blocked(input, "source_expired_at_evaluation");
    input.facts[0] = fact(); input.facts[0].source.authoritativeValidUntil = "2026-10-11T20:17:00Z";
    blocked(input, "source_expired_at_evaluation");
    input.facts[0] = fact(); input.facts[0].source.expiresAt = null;
    blocked(input, "source_validity_unknown");
    input.facts[0].source.authoritativeValidUntil = "2026-10-11T22:00:00Z";
    expect(validatePrivateParticipationScenario(input).sourceValidity[0].validUntil).toBe(input.target.gameStartsAt);
  });
  it("rejects invalid evaluation/observation/start ordering and invalid target IDs", () => {
    for (const patch of [{ evaluatedAt: "2026-10-11T21:00:00Z" }, { evidenceObservedThroughAt: "2026-10-11T20:14:00Z" },
      { evidenceObservedThroughAt: "2026-10-11T20:19:00Z" }, { cutoffAt: "2026-11-31T20:15:00Z" }]) {
      blocked({ ...populated(), ...patch }, "invalid_scenario_clock_scope");
    }
    const input = populated(); input.target.canonicalPlayerId = 0;
    blocked(input, "invalid_target_identity");
  });
  it("withholds confirmed in/out contradictions and uncertain downgrades beside older EV", () => {
    blocked({ ...fixture(), facts: [fact(), excluded()] }, "confirmed_participation_missing_or_conflicting");
    for (const status of ["questionable", "dtd", "projected"]) {
      const uncertain = fact("fictional-downgrade"); uncertain.assignment.unitType = "injury"; uncertain.assignment.status = status;
      blocked({ ...fixture(), facts: [fact(), uncertain] }, "participation_applicability_uncertain");
    }
    const input = populated(); input.facts[0].assignment.status = "projected";
    blocked(input, "participation_applicability_uncertain");
  });
  it("uses only an exact accepted conflict resolution to supersede a contradictory expired observation", () => {
    const out = excluded(); out.source.expiresAt = "2026-10-11T20:10:00Z";
    const input = { ...fixture(), facts: [fact(), out], conflicts: [conflict()] };
    const before = JSON.stringify(input);
    expect(validatePrivateParticipationScenario(input)).toMatchObject({ status: "READY", indicator: 1,
      retainedFacts: input.facts, retainedConflicts: input.conflicts, evidenceIds: ["fictional-ev"] });
    expect(JSON.stringify(input)).toBe(before);
    input.conflicts[0].row.player_forecast_conflict_resolutions[0].selected_observation_id = "fictional-out";
    blocked(input, "source_expired_at_evaluation");
  });
  it("does not accept unresolved, late, expired or wrongly bound supersession receipts", () => {
    const input = { ...fixture(), facts: [fact(), excluded()], conflicts: [conflict()] };
    input.conflicts[0].row.player_forecast_conflict_resolutions = [];
    blocked(input, "conflict_resolution_missing_or_ambiguous");
    input.conflicts = [conflict()]; input.conflicts[0].source.acceptedAt = "2026-10-11T20:16:00Z";
    blocked(input, "source_not_known_by_cutoff");
    input.conflicts = [conflict()]; input.conflicts[0].source.expiresAt = "2026-10-11T20:17:00Z";
    blocked(input, "source_expired_at_evaluation");
    input.conflicts = [conflict()]; input.conflicts[0].evidenceIds = ["fictional-ev", "not-retained"];
    blocked(input, "conflict_evidence_binding_missing");
    input.conflicts = [conflict()]; input.conflicts[0].row.game_id++;
    blocked(input, "conflict_identity_mismatch");
  });
  it("rejects competing review versions and contradictory selections instead of choosing a favorable one", () => {
    const input = { ...fixture(), facts: [fact(), excluded()], conflicts: [conflict(), conflict("fictional-out")] };
    blocked(input, "conflict_version_unresolved");
    input.conflicts[1].row.id = "different-conflict";
    blocked(input, "contradictory_supersession_receipts");
  });
  it("withholds missing conflict children and invalid resolution chronology", () => {
    const input = { ...fixture(), facts: [fact(), excluded()], conflicts: [conflict()] };
    input.conflicts[0].row.player_forecast_conflict_resolutions = undefined as any;
    blocked(input, "conflict_resolution_missing_or_ambiguous");
    input.conflicts = [conflict()]; input.conflicts[0].evidenceIds = undefined as any;
    blocked(input, "conflict_evidence_binding_missing");
    input.conflicts = [conflict()];
    input.conflicts[0].row.player_forecast_conflict_resolutions[0].created_at = "2026-10-11T20:07:00Z";
    blocked(input, "conflict_resolution_not_applicable");
  });
});

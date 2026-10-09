import { describe, expect, it } from "vitest";
import { projectionInputHash } from "../projections/inputCapture";
import { buildHistoricalQualificationCohort, qualifyHistoricalFeatures,
  type HistoricalFeatureFact, type HistoricalFeatureRequirement, type QualificationCohortGame } from "./historicalQualification";

const cutoffAt = "2026-10-08T22:00:00Z", startAt = "2026-10-08T23:00:00Z";
const publishedAt = "2026-10-07T04:00:00Z", retrievedAt = "2026-10-09T12:00:00Z";
const scope = { gameId: 2026020060, seasonId: 20262027, phase: 2, homeTeamId: 1, awayTeamId: 2 };
function fact(payload: unknown = { gf: 3, ga: 0 }, revisionId = "official-final-v1"): HistoricalFeatureFact {
  const payloadHash = projectionInputHash(payload);
  return { factId: revisionId, revisionId, sourceVersion: "official-model-v1", payload, payloadHash,
    occurredAt: "2026-10-07T03:00:00Z", retrievedAt, correctionOf: null,
    availability: { basis: "versioned_source", publishedAt,
      proof: { revisionId, sourceVersion: "official-model-v1", payloadHash, publishedAt, immutable: true } } };
}
const feature = (facts = [fact()]): HistoricalFeatureRequirement => ({ featureId: "team_rates", kind: "team_rate", required: true, fallbackPolicy: null, facts });
const qualify = (features = [feature()]) => qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features });

describe("feature-specific historical qualification", () => {
  it("permits bound cutoff-safe reconstruction with truthful late retrieval and no unused player/starter requirements", () => {
    const report = qualify();
    expect(report).toMatchObject({ reconstructionEligible: true, issuanceStatus: "not_issued", evidenceClass: "cutoff_qualified_reconstruction" });
    expect(report.features[0]).toMatchObject({ status: "qualified", sourceRevisions: [{ retrievedAt }], facts: [{ availableAt: publishedAt }] });
    expect(report.features.map(row => row.featureId)).toEqual(["team_rates"]);
    expect(qualify().qualificationHash).toBe(report.qualificationHash);
  });
  it("keeps retained original issuance independent of unresolved feature qualification", () => {
    const input = fact(); input.availability = { basis: "unproved" };
    const payload = { homeMean: 3, awayMean: 2 };
    const report = qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features: [feature([input])],
      issuance: { revisionId: "original", cutoffAt, issuedAt: "2026-10-08T22:01:00Z", retainedAt: retrievedAt,
        payload, payloadHash: projectionInputHash(payload), immutable: true,
        proof: { revisionId: "original", payloadHash: projectionInputHash(payload), scopeHash: projectionInputHash({ ...scope, cutoffAt, startAt }), cutoffAt,
          issuedAt: "2026-10-08T22:01:00Z", firstReceivedAt: "2026-10-08T22:02:00Z", verifiedAt: retrievedAt, immutable: true } } });
    expect(report).toMatchObject({ issuanceStatus: "retained_original", reconstructionEligible: false, evidenceClass: "retained_issued_forecast" });
    expect(report.features[0].status).toBe("unproved");
  });
  it("rejects late corrections and unbound or changed source revisions", () => {
    const corrected = fact(); corrected.correctionOf = "prior-v0";
    if (corrected.availability.basis !== "versioned_source") throw new Error("fixture");
    corrected.availability.publishedAt = retrievedAt;
    corrected.availability.proof.publishedAt = retrievedAt;
    expect(qualify([feature([corrected])]).features[0].reasons).toContain("post_cutoff_correction");
    const changed = fact(); changed.payload = { gf: 99 };
    expect(qualify([feature([changed])]).features[0].reasons).toContain("revision_payload_hash_mismatch");
    const unbound = fact();
    if (unbound.availability.basis !== "versioned_source") throw new Error("fixture");
    unbound.availability.proof.revisionId = "other";
    expect(qualify([feature([unbound])]).features[0].reasons).toContain("unbound_source_revision_proof");
  });
  it("rejects late captures without backdating them and retains optional-feature fallback", () => {
    const late = fact(); late.availability = { basis: "retained_capture", receivedAt: retrievedAt, verifiedAt: retrievedAt };
    const optional: HistoricalFeatureRequirement = { featureId: "starter", kind: "starter", required: false, fallbackPolicy: "omit_unused_starter_feature", facts: [late] };
    const report = qualify([feature(), optional]);
    expect(report.reconstructionEligible).toBe(true);
    expect(report.features[1]).toMatchObject({ status: "rejected", use: "declared_fallback", fallbackPolicy: "omit_unused_starter_feature" });
    optional.required = true;
    expect(qualify([feature(), optional]).reconstructionEligible).toBe(false);
    expect(late.retrievedAt).toBe(retrievedAt);
  });
  it("fails closed on cutoff boundaries, duplicate facts and manifests without declared requirements", () => {
    const atCutoff = fact();
    if (atCutoff.availability.basis !== "versioned_source") throw new Error("fixture");
    atCutoff.availability.publishedAt = cutoffAt; atCutoff.availability.proof.publishedAt = cutoffAt;
    expect(qualify([feature([atCutoff])]).reconstructionEligible).toBe(false);
    expect(qualify([feature([fact(), fact()])]).features[0].reasons).toContain("duplicate_constituent_fact");
    expect(() => qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features: [] })).toThrow("feature manifest");
    expect(() => qualifyHistoricalFeatures({ scope, cutoffAt: startAt, startAt, features: [feature()] })).toThrow("pregame cutoff");
  });
  it("does not label an unbound or backdated issuance as an original forecast", () => {
    const payload = { homeMean: 3 }, payloadHash = projectionInputHash(payload);
    const issuance = { revisionId: "original", cutoffAt, issuedAt: "2026-10-08T22:01:00Z", retainedAt: retrievedAt,
      payload, payloadHash, immutable: true };
    expect(qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features: [feature()], issuance }).issuanceStatus).toBe("unproved_issuance");
    const proof = { revisionId: "original", payloadHash, scopeHash: projectionInputHash({ ...scope, cutoffAt, startAt }), cutoffAt,
      issuedAt: "2026-10-08T22:02:00Z", firstReceivedAt: "2026-10-08T22:03:00Z", verifiedAt: retrievedAt, immutable: true as const };
    expect(qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features: [feature()], issuance: { ...issuance, proof } }).issuanceStatus).toBe("unproved_issuance");
    const microCutoff = "2026-10-08T22:00:00.000002Z", earlyIssuedAt = "2026-10-08T22:00:00.000001Z";
    expect(qualifyHistoricalFeatures({ scope, cutoffAt: microCutoff, startAt, features: [feature()],
      issuance: { ...issuance, cutoffAt: microCutoff, issuedAt: earlyIssuedAt,
        proof: { ...proof, cutoffAt: microCutoff, issuedAt: earlyIssuedAt,
          scopeHash: projectionInputHash({ ...scope, cutoffAt: microCutoff, startAt }) } } }).issuanceStatus).toBe("unproved_issuance");
  });
  it("preserves strict microsecond availability and revision proof binding", () => {
    const input = fact(), cutoff = "2026-10-08T22:00:00.000002Z";
    if (input.availability.basis !== "versioned_source") throw new Error("fixture");
    input.availability.publishedAt = "2026-10-08T22:00:00.000001Z";
    input.availability.proof.publishedAt = input.availability.publishedAt;
    expect(qualifyHistoricalFeatures({ scope, cutoffAt: cutoff, startAt, features: [feature([input])] }).reconstructionEligible).toBe(true);
    input.availability.proof.publishedAt = "2026-10-08T22:00:00.000000Z";
    expect(qualifyHistoricalFeatures({ scope, cutoffAt: cutoff, startAt, features: [feature([input])] }).features[0].reasons)
      .toContain("unbound_source_revision_proof");
  });
});

function cohortGame(gameId: number, homeCount: number, awayCount: number, forecastStatus: QualificationCohortGame["forecastStatus"] = "available"): QualificationCohortGame {
  const inventories = [homeCount, awayCount].map((count, side) => ({ teamId: side + 1, featureId: `inventory:${side + 1}`, complete: true,
    gameIds: Array.from({ length: count }, (_, index) => 2026020001 + index) }));
  const features: HistoricalFeatureRequirement[] = inventories.map(inventory => ({ featureId: inventory.featureId, kind: "completed_game_inventory",
    required: true, fallbackPolicy: null, facts: [fact({ teamId: inventory.teamId, complete: true, gameIds: inventory.gameIds,
      seasonId: 20262027, phase: 2, cutoffAt }, inventory.featureId)] }));
  return { gameId, seasonId: 20262027, phase: 2, cutoffAt, startAt, homeTeamId: 1, awayTeamId: 2, inventories,
    qualification: qualifyHistoricalFeatures({ scope: { ...scope, gameId }, cutoffAt, startAt, features }), forecastStatus };
}

describe("paired early-season qualification ledger", () => {
  it("retains failures and cold/unknown cohorts, allows a later-season opponent and excludes both diagnostic games", () => {
    const first = cohortGame(2026020060, 2, 8), failed = cohortGame(2026020061, 3, 2, "failed");
    const unknown = cohortGame(2026020062, 2, 2); unknown.inventories[0].complete = false;
    const report = buildHistoricalQualificationCohort([first, failed, unknown, cohortGame(2026020063, 0, 2),
      cohortGame(2026020053, 2, 3), cohortGame(2026020055, 3, 2), cohortGame(2026020064, 5, 8)]);
    expect(report).toMatchObject({ pairedGames: 7, primaryPopulationGames: 2, evaluableGames: 1, coverageFailures: 1, unknownEligibilityGames: 1, coldStartGames: 1 });
    expect(report.ledger[0].teams).toEqual([{ teamId: 1, completedGames: 2, primaryTeam: true }, { teamId: 2, completedGames: 8, primaryTeam: false }]);
    expect(report.ledger[1].teams.every(team => team.primaryTeam)).toBe(true);
    expect(report.ledger[4].population).toBe("diagnostic_exclusion");
    expect(report.ledger[5].population).toBe("diagnostic_exclusion");
  });
  it("requires bound complete inventories and one row per game rather than dropping bad rows", () => {
    const game = cohortGame(2026020060, 2, 3); game.inventories[0].gameIds.pop();
    expect(buildHistoricalQualificationCohort([game]).ledger[0].population).toBe("unknown_eligibility");
    expect(() => buildHistoricalQualificationCohort([game, game])).toThrow("Duplicate paired game");
  });
  it("rejects inventories of the wrong phase and qualifications for a different paired game", () => {
    const game = cohortGame(2026020060, 2, 3);
    const features = game.qualification.features.map(row => ({ featureId: row.featureId, kind: row.kind, required: row.required,
      fallbackPolicy: null, facts: [fact({ ...(row.inputFacts[0].payload as Record<string, unknown>), phase: 1 }, row.featureId)] }));
    game.qualification = qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features });
    expect(buildHistoricalQualificationCohort([game]).ledger[0].population).toBe("unknown_eligibility");
    const wrongGame = cohortGame(2026020060, 2, 3); wrongGame.gameId = 2026020061;
    expect(buildHistoricalQualificationCohort([wrongGame]).ledger[0].population).toBe("invalid_scope");
  });
  it("keeps an originally issued forecast evaluable when population qualifies but reconstruction does not", () => {
    const game = cohortGame(2026020060, 2, 3), missing = fact(); missing.availability = { basis: "unproved" };
    const features = game.qualification.features.map(row => ({ featureId: row.featureId, kind: row.kind,
      required: row.required, fallbackPolicy: null, facts: row.inputFacts }));
    const payload = { homeMean: 3, awayMean: 2 }, payloadHash = projectionInputHash(payload), issuedAt = "2026-10-08T22:01:00Z";
    game.qualification = qualifyHistoricalFeatures({ scope, cutoffAt, startAt, features: [...features, feature([missing])],
      issuance: { revisionId: "original", cutoffAt, issuedAt, retainedAt: retrievedAt, payload, payloadHash, immutable: true,
        proof: { revisionId: "original", payloadHash, scopeHash: projectionInputHash({ ...scope, cutoffAt, startAt }), cutoffAt, issuedAt,
          firstReceivedAt: "2026-10-08T22:02:00Z", verifiedAt: retrievedAt, immutable: true } } });
    expect(buildHistoricalQualificationCohort([game]).ledger[0]).toMatchObject({ population: "early_season_target", evaluable: true,
      issuanceStatus: "retained_original", reconstructionEligible: false });
  });
});

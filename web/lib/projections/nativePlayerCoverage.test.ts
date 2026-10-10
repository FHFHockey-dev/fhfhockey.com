import { describe, expect, it } from "vitest";
import {
  NATIVE_PLAYER_COVERAGE_DOMAIN, NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, NATIVE_PLAYER_COVERAGE_VERSION,
  nativeCoverageAssumptionsHash, nativeCoverageBasisHash, nativeCoverageTextHash, validateNativePlayerCoverage,
  type NativeCoverageEstimatorApproval, type NativePlayerCoveragePacket, type NativePlayerCoverageScope,
} from "./nativePlayerCoverage";

// Entirely invented proof/model/population data. Never real input, approval or issuance.
const skater = { playerId: 101, nhlPlayerId: 10001, teamId: 1 };
const goalie = { playerId: 102, nhlPlayerId: 10002, teamId: 2 };
type Population = "skater" | "goalie";
function historicalBody(population: Population) {
  return { gameId: 2026020088, seasonId: 20262027, identity: population === "skater" ? skater : goalie,
    domain: structuredClone(NATIVE_PLAYER_COVERAGE_DOMAIN),
    rows: [1, 2, 3, 4].map(periodNumber => ({ rowId: `${population}-${periodNumber}`, historicalGameId: 2026020001,
      periodNumber, periodType: (periodNumber === 4 ? "OT" : "REG") as "REG" | "OT" | "SO", completedAt: "2026-10-08T01:00:00Z",
      exposureSeconds: periodNumber === 4 ? 80 : 600,
      counts: { HITS: population === "skater" ? 0 : null,
        SHOTS_AGAINST_GOALIE: population === "goalie" ? 4 : null,
        SAVES_GOALIE: population === "goalie" ? 3 : null,
        GOALS_AGAINST_GOALIE: population === "goalie" ? 1 : null,
        nonShotGoalsAgainst: population === "goalie" ? 0 : null },
    })), unclassifiedEvents: 0, unclassifiedSeconds: 0 };
}
function model(population: Population) {
  const assumptions = { occurrenceRuleId: "synthetic-occurrence", participationRuleId: `synthetic-${population}-participation`,
    exposureRuleId: `synthetic-${population}-exposure` };
  return { modelId: `synthetic-${population}`, modelHash: nativeCoverageTextHash(`synthetic-${population}-code`),
    domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, basisHash: nativeCoverageBasisHash(population),
    assumptionsHash: nativeCoverageAssumptionsHash(assumptions), assumptions };
}
function approved(value: ReturnType<typeof model>, categories: NativeCoverageEstimatorApproval["categories"]): NativeCoverageEstimatorApproval {
  return { modelId: value.modelId, modelHash: value.modelHash, domainHash: value.domainHash, basisHash: value.basisHash,
    assumptionsHash: value.assumptionsHash, categories, permittedUse: "offline_support_review", approvedAt: "2026-10-08T00:00:00Z" };
}
function fixture() {
  const coverage = (population: Population) => {
    const bodyUtf8 = JSON.stringify(historicalBody(population));
    return { proofId: `${population}-proof`, bodyUtf8, bodyHash: nativeCoverageTextHash(bodyUtf8), publishedAt: "2026-10-08T02:00:00Z",
      firstReceivedAt: "2026-10-08T02:01:00Z", verifiedAt: "2026-10-08T02:02:00Z",
      access: "available" as const, rights: "verified_for_intended_use" as const };
  };
  const packet: NativePlayerCoveragePacket = { version: NATIVE_PLAYER_COVERAGE_VERSION, declaredClassification: "synthetic",
    gameId: 2026020088, seasonId: 20262027, asOf: "2026-10-09T18:03:00Z", pGamePlayed: 0.8,
    skater: { identity: { ...skater }, model: model("skater"), coverage: coverage("skater"),
      pCreditGivenPlayed: 0.5, pDressGivenPlayed: 0.6, pPositiveMinutesGivenPlayed: 0.5,
      conditionalBasis: "statistical_credit_given_game_played", conditionalHits: 2, unconditionalHits: 0.8,
      conditionalSeconds: 1200, unconditionalSeconds: 480 },
    goalie: { identity: { ...goalie }, model: model("goalie"), coverage: coverage("goalie"),
      pStartGivenPlayed: 0.4, pReliefOnlyGivenPlayed: 0.1, pNoAppearanceGivenPlayed: 0.5,
      conditionalBasis: "start_or_relief_given_game_played",
      givenStart: { SHOTS_AGAINST_GOALIE: 30, SAVES_GOALIE: 27, GOALS_AGAINST_GOALIE: 3, nonShotGoalsAgainst: 0, seconds: 3300 },
      givenReliefOnly: { SHOTS_AGAINST_GOALIE: 10, SAVES_GOALIE: 9, GOALS_AGAINST_GOALIE: 1, nonShotGoalsAgainst: 0, seconds: 600 },
      unconditional: { SHOTS_AGAINST_GOALIE: 10.4, SAVES_GOALIE: 9.36, GOALS_AGAINST_GOALIE: 1.04, nonShotGoalsAgainst: 0, seconds: 1104 } },
  };
  const scope: NativePlayerCoverageScope = { gameId: packet.gameId, seasonId: packet.seasonId, teamIds: [1, 2],
    scheduledAt: "2026-10-12T23:00:00Z", asOf: packet.asOf, assessedAt: "2026-10-09T18:04:00Z",
    modelCutoffAt: "2026-10-09T18:00:00Z", featureCutoffAt: "2026-10-09T18:02:00Z", skater: { ...skater }, goalie: { ...goalie },
    proofs: (["skater", "goalie"] as Population[]).map(population => ({ proofId: packet[population].coverage!.proofId,
      bodyHash: packet[population].coverage!.bodyHash,
      expectedRows: historicalBody(population).rows.map(({ rowId, historicalGameId, periodNumber, periodType }) =>
        ({ rowId, historicalGameId, periodNumber, periodType })) })),
  };
  return { packet, scope, approvals: [approved(packet.skater.model, ["HITS"]), approved(packet.goalie.model, ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE"])] };
}
type Fixture = ReturnType<typeof fixture>;
const validate = (f: Fixture) => validateNativePlayerCoverage(f.packet, f.scope, f.approvals);
const codes = (f: Fixture) => validate(f).findings.map(item => item.code);
function rewriteProof(f: Fixture, population: Population, mutate: (value: ReturnType<typeof historicalBody>) => void) {
  const proof = f.packet[population].coverage!;
  const b: ReturnType<typeof historicalBody> = JSON.parse(proof.bodyUtf8);
  mutate(b); proof.bodyUtf8 = JSON.stringify(b); proof.bodyHash = nativeCoverageTextHash(proof.bodyUtf8);
  // Simulate an independently supplied population/body hash; approval remains separate.
  f.scope.proofs.find(item => item.proofId === proof.proofId)!.bodyHash = proof.bodyHash;
}

describe("independent estimator approval and mechanical evidence", () => {
  it("checks mechanics without claiming authenticity, execution, prediction or qualification; leaves inputs unchanged", () => {
    const f = fixture(), original = JSON.stringify(f);
    expect(validate(f)).toMatchObject({ mechanicalVerdict: "passed", estimatorApprovalMatched: true,
      status: "mechanically_consistent_for_independent_review", declaredClassification: "synthetic",
      qualificationEligible: false, sourceAuthenticity: "not_established", upstreamPopulationCompleteness: "not_established",
      estimatorExecution: "not_verified", predictiveQuality: "not_assessed", findings: [] });
    expect(JSON.stringify(f)).toBe(original);
    f.packet.declaredClassification = "retained_exports";
    expect(validate(f)).toMatchObject({ qualificationEligible: false, sourceAuthenticity: "not_established" });
  });
  it.each([undefined, null, []])("blocks absent approval %j despite internally consistent evidence", approvals => {
    const f = fixture();
    expect(validateNativePlayerCoverage(f.packet, f.scope, approvals)).toMatchObject({ mechanicalVerdict: "passed", estimatorApprovalMatched: false, status: "blocked" });
  });
  it.each(["modelId", "modelHash", "domainHash", "basisHash", "assumptionsHash"] as const)("rejects mismatched approval %s", key => {
    const f = fixture(); f.approvals[0][key] = key === "modelId" ? "other" : "a".repeat(64);
    expect(codes(f)).toContain("unapproved_estimator");
    expect(validate(f).categories.find(item => item.category === "HITS")!.estimatorApprovalMatched).toBe(false);
  });
  it("rejects packet self-authorization, malformed sets, duplicate approvals and late approval", () => {
    const f = fixture();
    expect(validateNativePlayerCoverage({ ...f.packet, approvedEstimators: f.approvals }, f.scope, [])).toMatchObject({ mechanicalVerdict: "failed", status: "blocked" });
    expect(validateNativePlayerCoverage(f.packet, f.scope, { approved: true }).findings.map(item => item.code)).toContain("malformed_approval_set");
    f.approvals.push(f.approvals[0]); expect(codes(f)).toContain("unapproved_estimator");
    f.approvals.pop(); f.approvals[0].approvedAt = "2026-10-09T18:01:00Z"; expect(codes(f)).toContain("unapproved_estimator");
  });
  it("rejects wrong use/category and body domain, basis or assumption bindings", () => {
    const f = fixture(); f.approvals[1].categories = ["SAVES_GOALIE"];
    expect(validate(f).categories.find(item => item.category === "GOALS_AGAINST_GOALIE")!.estimatorApprovalMatched).toBe(false);
    Object.assign(f.approvals[0], { permittedUse: "production" }); expect(validate(f).status).toBe("blocked");
    const wrong = fixture(); wrong.packet.skater.model.basisHash = nativeCoverageBasisHash("goalie");
    wrong.packet.skater.model.domainHash = "a".repeat(64); wrong.packet.skater.model.assumptions.exposureRuleId = "unapproved";
    expect(codes(wrong)).toContain("model_contract_hash_mismatch");
  });
});

describe("scope, history and information boundaries", () => {
  it.each([null, [], {}, { pGamePlayed: NaN }])("returns a blocked result for malformed input %j", input => {
    const f = fixture(); expect(validateNativePlayerCoverage(input, f.scope, f.approvals)).toMatchObject({ mechanicalVerdict: "failed", status: "blocked" });
  });
  it("rejects malformed scope and wrong game, season, player, NHL, team and cutoff identity", () => {
    const f = fixture(); expect(validateNativePlayerCoverage(f.packet, null, f.approvals).status).toBe("blocked");
    for (const key of ["gameId", "seasonId"] as const) { const x = fixture(); x.packet[key]++; expect(codes(x)).toContain("identity_scope_mismatch"); }
    for (const key of ["playerId", "nhlPlayerId", "teamId"] as const) { const x = fixture(); x.packet.skater.identity[key]++; expect(codes(x)).toContain("identity_scope_mismatch"); }
    f.packet.asOf = "2026-10-09T18:03:01Z"; expect(codes(f)).toContain("identity_scope_mismatch");
  });
  it("checks independent raw hashes, body identity and duplicate proof IDs", () => {
    const f = fixture(); f.packet.skater.coverage!.bodyUtf8 += " "; expect(codes(f)).toContain("proof_hash_or_scope_mismatch");
    const x = fixture(); rewriteProof(x, "skater", b => { b.identity.nhlPlayerId++; }); expect(codes(x)).toContain("proof_identity_mismatch");
    x.scope.proofs.push(x.scope.proofs[0]); expect(validate(x).status).toBe("blocked");
    const y = fixture(); y.packet.goalie.coverage!.proofId = y.packet.skater.coverage!.proofId; expect(codes(y)).toContain("duplicate_proof");
  });
  it("does not treat absent coverage, unknown expected population or empty history as zero", () => {
    const f = fixture(); f.packet.skater.coverage = null; expect(codes(f)).toContain("missing_whole_play_hit_coverage");
    f.packet.goalie.coverage = null; expect(codes(f)).toContain("missing_guarded_shot_spell_coverage");
    const x = fixture(); x.scope.proofs[0].expectedRows = null; expect(codes(x)).toContain("unknown_expected_population");
    rewriteProof(x, "skater", b => { b.rows = []; }); x.scope.proofs[0].expectedRows = [];
    expect(codes(x)).toContain("empty_history_not_a_zero_rate"); expect(validate(x).mechanicalVerdict).toBe("unknown");
  });
  it("distinguishes verified zero counts from unknown counts, missing exposure and quarantined data", () => {
    expect(validate(fixture()).mechanicalVerdict).toBe("passed");
    const f = fixture(); rewriteProof(f, "skater", b => { Object.assign(b.rows[0].counts, { HITS: null }); });
    expect(codes(f)).toContain("unknown_hit_count");
    rewriteProof(f, "skater", b => { Object.assign(b.rows[0], { exposureSeconds: null }); b.unclassifiedEvents = 1; });
    expect(codes(f)).toEqual(expect.arrayContaining(["unknown_exposure", "unclassified_event_or_exposure"]));
    const x = fixture(); rewriteProof(x, "skater", b => { b.rows.forEach(r => { r.exposureSeconds = 0; }); });
    expect(codes(x)).toContain("zero_exposure_denominator");
  });
  it("rejects omitted/duplicate population rows and mislabeled REG, OT, shootout or partial strengths", () => {
    const f = fixture(); rewriteProof(f, "skater", b => { b.rows.pop(); }); expect(codes(f)).toContain("population_mismatch");
    const x = fixture(); rewriteProof(x, "skater", b => { b.rows.push(b.rows[0]); }); expect(codes(x)).toContain("duplicate_history_row");
    const y = fixture(); rewriteProof(y, "skater", b => { b.rows[3].periodType = "SO"; }); expect(codes(y)).toContain("shootout_in_official_play");
    const z = fixture(); rewriteProof(z, "skater", b => { b.rows[3].periodType = "REG"; }); expect(codes(z)).toContain("period_boundary_mismatch");
    const w = fixture(); rewriteProof(w, "skater", b => { Object.assign(b.domain, { strengths: "ev_only" }); }); expect(codes(w)).toContain("malformed_coverage_body");
  });
  it("rejects excessive period exposure, fractional historical counts and bad guarded identities", () => {
    const f = fixture(); rewriteProof(f, "skater", b => { b.rows[3].exposureSeconds = 301; b.rows[0].counts.HITS = 0.5; });
    expect(codes(f)).toEqual(expect.arrayContaining(["period_exposure_exceeded", "noninteger_historical_count"]));
    const x = fixture(); rewriteProof(x, "goalie", b => { b.rows[0].counts.SAVES_GOALIE = 4; }); expect(codes(x)).toContain("guarded_shot_identity");
  });
  it("does not certify positive historical events at zero exposure in an otherwise nonempty history", () => {
    const f = fixture(); rewriteProof(f, "skater", b => { b.rows[0].exposureSeconds = 0; b.rows[0].counts.HITS = 1; });
    expect(codes(f)).toContain("unproved_hit_exposure");
    const x = fixture(); rewriteProof(x, "goalie", b => { b.rows[0].exposureSeconds = 0; });
    expect(codes(x)).toContain("unproved_guarded_exposure");
  });
  it("rejects future/reversed history and source chronology, including submillisecond future information", () => {
    const f = fixture(); f.packet.skater.coverage!.verifiedAt = "2026-10-09T18:00:00.000001Z";
    expect(codes(f)).toContain("future_or_reversed_information");
    const x = fixture(); x.packet.skater.coverage!.publishedAt = "2026-10-08T03:00:00Z"; expect(codes(x)).toContain("source_chronology");
    const y = fixture(); rewriteProof(y, "skater", b => { b.rows[0].completedAt = y.scope.modelCutoffAt; }); expect(codes(y)).toContain("future_history");
    const z = fixture(); z.scope.assessedAt = "2026-10-09T18:02:00Z"; expect(codes(z)).toContain("invalid_cutoff_order");
    z.scope.asOf = z.scope.scheduledAt; expect(codes(z)).toContain("invalid_cutoff_order");
  });
  it.each(["skater", "goalie"] as Population[])("rejects complete %s bodies published or received before completion", population => {
    const f = fixture(); rewriteProof(f, population, b => { b.rows.forEach(r => { r.completedAt = "2026-10-08T03:00:00Z"; }); });
    expect(codes(f)).toContain("completed_history_unavailable");
    expect(validate(f)).toMatchObject({ mechanicalVerdict: "failed", status: "blocked", qualificationEligible: false });
    const x = fixture(), proof = x.packet[population].coverage!;
    proof.publishedAt = proof.firstReceivedAt = proof.verifiedAt = "2026-10-08T02:02:00Z";
    rewriteProof(x, population, b => { b.rows.forEach(r => { r.completedAt = "2026-10-08T02:02:00.000000001Z"; }); });
    expect(codes(x)).toContain("completed_history_unavailable");
    const y = fixture(); rewriteProof(y, population, b => { b.rows.forEach(r => { r.completedAt = "2026-10-08T02:00:00.000000001Z"; }); });
    // Receipt follows completion, but this exact body could not have been published earlier.
    expect(codes(y)).toContain("completed_history_unavailable");
  });
  it("accepts completion at exact-body publication/receipt and one nanosecond before them", () => {
    for (const population of ["skater", "goalie"] as Population[]) {
      for (const completedAt of ["2026-10-08T02:02:00Z", "2026-10-08T02:01:59.999999999Z"]) {
        const f = fixture(), proof = f.packet[population].coverage!;
        proof.publishedAt = proof.firstReceivedAt = proof.verifiedAt = "2026-10-08T02:02:00Z";
        rewriteProof(f, population, b => { b.rows.forEach(r => { r.completedAt = completedAt; }); });
        expect(validate(f)).toMatchObject({ mechanicalVerdict: "passed", findings: [], qualificationEligible: false });
      }
    }
  });
  it.each([1e9, Number.MAX_SAFE_INTEGER])("rejects a one-count historical shot mismatch at %s", shots => {
    const f = fixture(); rewriteProof(f, "goalie", b => { Object.assign(b.rows[0].counts, {
      SHOTS_AGAINST_GOALIE: shots, SAVES_GOALIE: shots, GOALS_AGAINST_GOALIE: 1, nonShotGoalsAgainst: 0,
    }); });
    expect(codes(f)).toContain("guarded_shot_identity");
    expect(validate(f)).toMatchObject({ mechanicalVerdict: "failed", status: "blocked", qualificationEligible: false });
  });
  it("accepts exact large historical identities even when intermediate addition exceeds safe Number arithmetic", () => {
    for (const counts of [
      { SHOTS_AGAINST_GOALIE: 1e9 + 1, SAVES_GOALIE: 1e9, GOALS_AGAINST_GOALIE: 1, nonShotGoalsAgainst: 0 },
      { SHOTS_AGAINST_GOALIE: Number.MAX_SAFE_INTEGER, SAVES_GOALIE: Number.MAX_SAFE_INTEGER, GOALS_AGAINST_GOALIE: 2, nonShotGoalsAgainst: 2 },
    ]) {
      const f = fixture(); rewriteProof(f, "goalie", b => { Object.assign(b.rows[0].counts, counts); });
      expect(validate(f)).toMatchObject({ mechanicalVerdict: "passed", findings: [], qualificationEligible: false });
    }
  });
  it("blocks unsafe/fractional historical integers without throwing and preserves unknown counts", () => {
    for (const shots of [0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const f = fixture(); rewriteProof(f, "goalie", b => { b.rows[0].counts.SHOTS_AGAINST_GOALIE = shots; });
      expect(codes(f)).toContain("noninteger_historical_count");
    }
    const x = fixture(); rewriteProof(x, "goalie", b => { b.rows[0].counts.SHOTS_AGAINST_GOALIE = null; });
    expect(validate(x)).toMatchObject({ mechanicalVerdict: "unknown", status: "blocked" });
    expect(codes(x)).toContain("unknown_guarded_counts");
  });
  it("preserves unknown source publication/access/rights and rejects malformed JSON without throwing", () => {
    const f = fixture(); f.packet.skater.coverage!.publishedAt = null; f.packet.skater.coverage!.rights = "unknown";
    expect(codes(f)).toEqual(expect.arrayContaining(["unknown_publication_time", "unverified_access_or_rights"]));
    f.packet.skater.coverage!.bodyUtf8 = "{"; expect(codes(f)).toContain("malformed_proof_json");
  });
});

describe("occurrence, credit, relief and guarded-net arithmetic", () => {
  it("retains serialization tolerance for fractional forecast means", () => {
    const f = fixture(); f.packet.goalie.givenStart!.SHOTS_AGAINST_GOALIE = 30.000000001;
    f.packet.goalie.unconditional.SHOTS_AGAINST_GOALIE = 10.40000000032;
    expect(validate(f)).toMatchObject({ mechanicalVerdict: "passed", findings: [], qualificationEligible: false });
  });
  it.each([-0.1, 1.1, Infinity, NaN])("rejects invalid probability %s", value => {
    const f = fixture(); f.packet.pGamePlayed = value; expect(validate(f).mechanicalVerdict).toBe("failed");
  });
  it("preserves unknown occurrence/credit/relief rather than deriving it", () => {
    const f = fixture(); f.packet.pGamePlayed = null; f.packet.skater.pCreditGivenPlayed = null; f.packet.goalie.pReliefOnlyGivenPlayed = null;
    expect(codes(f)).toEqual(expect.arrayContaining(["unknown_game_occurrence", "unknown_skater_participation", "unknown_goalie_states"]));
    expect(validate(f).mechanicalVerdict).toBe("unknown");
  });
  it("rejects incompatible dress/positive-minute/credit probabilities and zero-minute positive exposure", () => {
    const f = fixture(); f.packet.skater.pDressGivenPlayed = 0.1; expect(codes(f)).toContain("incompatible_skater_participation");
    const x = fixture(); x.packet.skater.pPositiveMinutesGivenPlayed = 0; expect(codes(x)).toContain("incompatible_minutes");
  });
  it("detects game occurrence or participation integrated twice and start-only loss of relief", () => {
    const f = fixture(); f.packet.skater.unconditionalHits = 0.8 * 0.8; expect(codes(f)).toContain("occurrence_participation_integration");
    f.packet.skater.unconditionalHits = 0.4; expect(codes(f)).toContain("occurrence_participation_integration");
    const x = fixture(); x.packet.goalie.unconditional.SAVES_GOALIE = 0.8 * 0.4 * 27;
    expect(codes(x)).toContain("occurrence_participation_integration");
    const y = fixture(); y.packet.goalie.unconditional.seconds = 1104 * 0.4; expect(codes(y)).toContain("occurrence_participation_integration");
  });
  it("requires undefined conditional means at zero participation and permits zero occurrence exactly once", () => {
    const f = fixture(); f.packet.skater.pCreditGivenPlayed = 0; f.packet.skater.pPositiveMinutesGivenPlayed = 0;
    f.packet.skater.unconditionalHits = 0; f.packet.skater.unconditionalSeconds = 0;
    expect(codes(f)).toContain("undefined_zero_mass_condition");
    f.packet.skater.conditionalHits = null; f.packet.skater.conditionalSeconds = null;
    expect(validate(f).mechanicalVerdict).toBe("passed");
    const x = fixture(); x.packet.pGamePlayed = 0; x.packet.skater.unconditionalHits = 0; x.packet.skater.unconditionalSeconds = 0;
    Object.keys(x.packet.goalie.unconditional).forEach(key => Object.assign(x.packet.goalie.unconditional, { [key]: 0 }));
    expect(validate(x).mechanicalVerdict).toBe("passed");
  });
  it("rejects broken goalie state mass and absent relief kernels", () => {
    const f = fixture(); f.packet.goalie.pNoAppearanceGivenPlayed = 0.6; expect(codes(f)).toContain("goalie_state_mass");
    const x = fixture(); x.packet.goalie.givenReliefOnly = null; expect(codes(x)).toContain("unknown_goalie_conditional");
  });
  it("keeps credited non-shot GA separate and refuses impossible or unknown net credit/exposure", () => {
    const f = fixture(); f.packet.goalie.givenStart!.GOALS_AGAINST_GOALIE = 4; f.packet.goalie.givenStart!.nonShotGoalsAgainst = 1;
    f.packet.goalie.unconditional.GOALS_AGAINST_GOALIE = 1.36; f.packet.goalie.unconditional.nonShotGoalsAgainst = 0.32;
    expect(validate(f).mechanicalVerdict).toBe("passed");
    f.packet.goalie.givenStart!.nonShotGoalsAgainst = 5; expect(codes(f)).toContain("guarded_shot_identity");
    const x = fixture(); x.packet.goalie.givenStart!.seconds = 0; expect(codes(x)).toContain("unproved_guarded_exposure");
    const y = fixture(); y.packet.goalie.givenStart!.nonShotGoalsAgainst = null; expect(codes(y)).toContain("unknown_guarded_counts");
  });
  it("fails overflowed identities and retains unknown zero-time HIT exposure", () => {
    const f = fixture(); Object.assign(f.packet.goalie.givenStart!, { SHOTS_AGAINST_GOALIE: Number.MAX_VALUE,
      SAVES_GOALIE: Number.MAX_VALUE, GOALS_AGAINST_GOALIE: Number.MAX_VALUE });
    expect(codes(f)).toContain("guarded_shot_identity");
    const x = fixture(); x.packet.skater.pPositiveMinutesGivenPlayed = 0;
    x.packet.skater.conditionalSeconds = 0; x.packet.skater.unconditionalSeconds = 0;
    expect(codes(x)).toContain("unproved_hit_exposure"); expect(validate(x).status).toBe("blocked");
  });
});

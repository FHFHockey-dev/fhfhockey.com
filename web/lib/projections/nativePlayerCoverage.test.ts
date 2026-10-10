import { describe, expect, it } from "vitest";
import {
  NATIVE_PLAYER_COVERAGE_DOMAIN, NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, NATIVE_PLAYER_COVERAGE_VERSION,
  nativeCoverageAssumptionsHash, nativeCoverageBasisHash, nativeCoverageTextHash, validateNativePlayerCoverage,
  NATIVE_COVERAGE_PROOF_VERSION, checkNativeCoverageProof, checkNativeCoverageHistory, checkNativeCoverageSelection,
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
    const f = fixture(); f.packet.skater.coverage!.publishedAt = null; Object.assign(f.packet.skater.coverage!, { rights: "unknown" });
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

// Synthetic v2 provenance mechanics; these contracts are not real source-semantic approvals.
function observationFixture(lower: string | null = "2026-10-08T00:00:00Z",
  secondLower = "2026-10-07T01:00:00Z", secondUpper = "2026-10-07T02:00:00Z") {
  const f = fixture(), normalized = historicalBody("skater");
  const rawBody = { games: [{ gameId: 2026020001, seasonId: 20262027, teamId: 1, state: "OFF", lower,
    upper: "2026-10-08T03:00:00Z" }, { gameId: 2026020002, seasonId: 20262027, teamId: 1, state: "OFF",
    lower: secondLower, upper: secondUpper }], rows: normalized.rows };
  const raw = { proofId: "raw", bodyUtf8: JSON.stringify(rawBody), bodyHash: nativeCoverageTextHash(JSON.stringify(rawBody)),
    sourceSemanticVersion: "synthetic-final-v1", sourceSemanticHash: nativeCoverageTextHash("synthetic-final-semantics"),
    origin: "https://example.test/official", revision: "synthetic-revision", httpStatus: 200 as const,
    requestedAt: "2026-10-08T02:59:00Z", firstReceivedAt: "2026-10-08T03:00:00Z", verifiedAt: "2026-10-08T03:01:00Z",
    publishedAt: null, access: "available" as const, rights: "verified_for_intended_use" as const,
    finalGames: rawBody.games.map((game, i) => ({ historicalGameId: game.gameId, seasonId: game.seasonId, teamId: game.teamId,
      gameIdPointer: `/games/${i}/gameId`, seasonIdPointer: `/games/${i}/seasonId`, teamIdPointer: `/games/${i}/teamId`,
      finalStatePointer: `/games/${i}/state`, finalStateValue: "OFF" as const })),
    completionFacts: rawBody.games.flatMap((game, i) => [
      ...(game.lower === null ? [] : [{ historicalGameId: game.gameId, seasonId: game.seasonId, teamId: game.teamId,
        pointer: `/games/${i}/lower`, kind: "completion_lower" as const, at: game.lower }]),
      { historicalGameId: game.gameId, seasonId: game.seasonId, teamId: game.teamId,
        pointer: `/games/${i}/upper`, kind: "completion_upper" as const, at: game.upper },
    ]) };
  const completion = { kind: "supported_bounds" as const, completedAt: null,
    completedNoEarlierThan: lower, lowerEvidence: lower === null ? null : { proofId: raw.proofId, bodyHash: raw.bodyHash, pointer: "/games/0/lower" },
    completedNoLaterThan: raw.firstReceivedAt, upperEvidence: { kind: "final_body_receipt" as const, proofId: raw.proofId, bodyHash: raw.bodyHash },
    finalEvidence: { proofId: raw.proofId, bodyHash: raw.bodyHash, historicalGameId: 2026020001, seasonId: 20262027, teamId: 1 } };
  const rows = normalized.rows.map(row => ({ ...row, completedAt: null, completion }));
  const proof = { version: NATIVE_COVERAGE_PROOF_VERSION as typeof NATIVE_COVERAGE_PROOF_VERSION, mode: "prospective_public_observation" as const,
    evidenceType: "derived_normalized" as const, proofId: "skater-proof", bodyUtf8: JSON.stringify({ ...normalized, rows }), bodyHash: "",
    createdAt: "2026-10-08T03:02:00Z", verifiedAt: "2026-10-08T03:03:00Z", publishedAt: null, firstReceivedAt: null,
    transformation: { version: "synthetic-transform-v1", codeHash: nativeCoverageTextHash("code"), configHash: nativeCoverageTextHash("config"), semanticHash: nativeCoverageTextHash("meaning") },
    contributors: [raw], links: rows.map((_, i) => ({ proofId: raw.proofId, bodyHash: raw.bodyHash, pointer: `/rows/${i}`, derivedPointer: `/rows/${i}` })) };
  proof.bodyHash = nativeCoverageTextHash(proof.bodyUtf8);
  f.packet.skater.coverage = proof;
  const expected = { ...proof, bodyUtf8: undefined, contributors: proof.contributors.map(item => ({ ...item, bodyUtf8: undefined })) };
  // Remove rather than serialize undefined keys: expectation schemas are strict.
  const contract = JSON.parse(JSON.stringify(expected));
  Object.assign(f.scope.proofs[0], { bodyHash: proof.bodyHash, contract });
  return { f, raw, rawBody, proof, contract, rows, completion };
}
function observationIssues(x: ReturnType<typeof observationFixture>) {
  const findings: string[] = [], add = (_kind: "invalid" | "unknown", code: string) => findings.push(code);
  checkNativeCoverageProof(x.proof, x.contract, x.f.scope.modelCutoffAt, add);
  checkNativeCoverageHistory(x.rows[0], x.proof, x.f.scope.gameId, 1, x.f.scope.modelCutoffAt, add);
  return findings;
}
describe("versioned observations, completion bounds and derivation provenance", () => {
  it("accepts independently bound raw/derived mechanics with unknown publication and null exact completion", () => {
    const x = observationFixture(null), before = JSON.stringify(x.f);
    expect(validate(x.f)).toMatchObject({ mechanicalVerdict: "passed", qualificationEligible: false, sourceAuthenticity: "not_established" });
    expect(observationIssues(x)).toEqual([]); expect(JSON.stringify(x.f)).toBe(before);
    const raw = { ...x.raw, version: NATIVE_COVERAGE_PROOF_VERSION as typeof NATIVE_COVERAGE_PROOF_VERSION, mode: "prospective_public_observation" as const, evidenceType: "raw_official" as const };
    const { bodyUtf8: _bytes, ...expected } = raw;
    const found: string[] = [];
    checkNativeCoverageProof(raw, expected, x.f.scope.modelCutoffAt, (_kind, code) => found.push(code));
    checkNativeCoverageHistory(x.rows[0], raw, x.f.scope.gameId, 1, x.f.scope.modelCutoffAt, (_kind, code) => found.push(code));
    expect(found).toEqual([]);
    delete (x.f.scope.proofs[0] as { contract?: unknown }).contract;
    expect(codes(x.f)).toContain("proof_contract_binding");
  });
  it("accepts explicitly bound archival-v2 evidence and preserves unknown-publication blocking", () => {
    const f = fixture(), old = f.packet.skater.coverage!;
    if ("version" in old) throw new Error("Expected frozen archival-v1 fixture");
    const archival = { ...old, version: NATIVE_COVERAGE_PROOF_VERSION as typeof NATIVE_COVERAGE_PROOF_VERSION, mode: "archival_exact" as const };
    const { bodyUtf8: _bytes, ...contract } = archival;
    f.packet.skater.coverage = archival; Object.assign(f.scope.proofs[0], { contract });
    expect(validate(f).mechanicalVerdict).toBe("passed");
    archival.publishedAt = null; contract.publishedAt = null;
    expect(codes(f)).toContain("unknown_publication_time");
  });
  it("allows verification at the cutoff, while receipt-bound completion stays strictly earlier", () => {
    const x = observationFixture(); x.raw.verifiedAt = x.f.scope.modelCutoffAt;
    x.proof.createdAt = x.proof.verifiedAt = x.f.scope.modelCutoffAt;
    Object.assign(x.contract, JSON.parse(JSON.stringify({ ...x.proof, bodyUtf8: undefined,
      contributors: x.proof.contributors.map(raw => ({ ...raw, bodyUtf8: undefined })) })));
    expect(validate(x.f).mechanicalVerdict).toBe("passed");
    x.proof.verifiedAt = "2026-10-09T18:00:00.000000001Z";
    expect(observationIssues(x)).toContain("derived_chronology");
  });
  it("requires completion fields to be independently bound to this game and bound kind", () => {
    const x = observationFixture(); x.completion.lowerEvidence!.pointer = "/games/1/lower";
    x.completion.completedNoEarlierThan = x.rawBody.games[1].lower;
    expect(observationIssues(x)).toContain("unsupported_completion_lower");
    const y = observationFixture(); Object.assign(y.raw.completionFacts[0], { kind: "completion_upper" });
    expect(observationIssues(y)).toContain("unsupported_completion_lower");
  });
  it("keeps archival unknown-publication and exact-completion requirements", () => {
    const f = fixture(); f.packet.skater.coverage!.publishedAt = null;
    expect(codes(f)).toContain("unknown_publication_time");
    rewriteProof(f, "skater", b => Object.assign(b.rows[0], { completedAt: null }));
    expect(codes(f)).toContain("archival_completion_required");
  });
  it.each(["mode", "sourceSemanticHash", "revision", "bodyHash", "requestedAt"])("rejects independently unbound %s", field => {
    const x = observationFixture();
    if (field === "mode") Object.assign(x.proof, { mode: "archival_exact" });
    else Object.assign(x.raw, { [field]: field === "requestedAt" ? "2026-10-08T02:58:00Z" : "b".repeat(64) });
    expect(validate(x.f).mechanicalVerdict).toBe("failed");
  });
  it.each(["requestedAt", "firstReceivedAt", "verifiedAt"])("rejects reversal or +1ns late %s", field => {
    const x = observationFixture();
    x.raw[field as "requestedAt" | "firstReceivedAt" | "verifiedAt"] = field === "requestedAt" ? "2026-10-08T03:00:00.000000001Z" : "2026-10-09T18:00:00.000000001Z";
    expect(observationIssues(x)).toContain("observation_chronology");
  });
  it.each(["state", "gameId", "seasonId", "teamId"])("rejects a nonfinal or mismatched raw %s field", field => {
    const x = observationFixture(); Object.assign(x.rawBody.games[0], { [field]: field === "state" ? "LIVE" : 999 });
    x.raw.bodyUtf8 = JSON.stringify(x.rawBody);
    expect(observationIssues(x)).toContain("final_body_identity");
    expect(observationIssues(x)).toContain("raw_body_binding");
  });
  it("rejects unsupported earlier upper/lower, reversed bounds, exact invention and cutoff equality", () => {
    const x = observationFixture(); x.completion.completedNoLaterThan = "2026-10-08T02:00:00Z";
    expect(observationIssues(x)).toContain("unsupported_completion_upper");
    x.completion.completedNoEarlierThan = "2026-10-08T04:00:00Z";
    expect(observationIssues(x)).toContain("unsupported_completion_lower"); expect(observationIssues(x)).toContain("reversed_completion_bounds");
    Object.assign(x.rows[0], { completedAt: "2026-10-08T01:00:00Z" });
    expect(observationIssues(x)).toContain("bounds_exact_completion_not_null");
    x.completion.completedNoLaterThan = x.f.scope.modelCutoffAt;
    expect(observationIssues(x)).toContain("future_history");
  });
  it.each(["created_early", "verified_late", "raw_verify_late", "pointer_missing", "hash_substitution", "copied_receipt", "copied_publication"])("rejects invalid derived lineage %s", example => {
    const x = observationFixture();
    if (example === "created_early") x.proof.createdAt = "2026-10-08T02:59:59Z";
    if (example === "verified_late") x.proof.verifiedAt = "2026-10-09T18:00:00.000000001Z";
    if (example === "raw_verify_late") x.raw.verifiedAt = "2026-10-08T03:03:00.000000001Z";
    if (example === "pointer_missing") x.proof.links[0].pointer = "/absent";
    if (example === "hash_substitution") x.proof.links[0].bodyHash = "b".repeat(64);
    if (example === "copied_receipt") Object.assign(x.proof, { firstReceivedAt: x.raw.firstReceivedAt });
    if (example === "copied_publication") Object.assign(x.proof, { publishedAt: "2026-10-08T02:00:00Z" });
    expect(validate(x.f).mechanicalVerdict).toBe("failed");
    if (["created_early", "verified_late", "raw_verify_late"].includes(example)) expect(observationIssues(x)).toContain("derived_chronology");
  });
  it("does not make unknown rights, credit or estimator approval eligible", () => {
    const x = observationFixture(); Object.assign(x.raw, { rights: "unknown" });
    expect(observationIssues(x)).toContain("unverified_access_or_rights");
    x.f.packet.skater.pCreditGivenPlayed = null;
    expect(codes(x.f)).toContain("unknown_skater_participation");
    expect(validateNativePlayerCoverage(x.f.packet, x.f.scope, []).qualificationEligible).toBe(false);
  });
});

describe("explicit completion-based window and latest-count gates", () => {
  function selection(x: ReturnType<typeof observationFixture>) {
    const second = { historicalGameId: 2026020002, completedAt: null,
      completion: { ...x.completion, completedNoEarlierThan: x.rawBody.games[1].lower,
        lowerEvidence: { proofId: x.raw.proofId, bodyHash: x.raw.bodyHash, pointer: "/games/1/lower" },
        completedNoLaterThan: x.rawBody.games[1].upper,
        upperEvidence: { kind: "timestamp_field" as const, proofId: x.raw.proofId, bodyHash: x.raw.bodyHash, pointer: "/games/1/upper" },
        finalEvidence: { ...x.completion.finalEvidence, historicalGameId: 2026020002 } } };
    return { windowStartInclusive: "2026-10-06T00:00:00Z", windowEndExclusive: "2026-10-09T00:00:00Z",
      latestCount: 1, censusComplete: true as boolean | null, census: [{ historicalGameId: x.rows[0].historicalGameId, completedAt: x.rows[0].completedAt, completion: x.rows[0].completion }, second] };
  }
  function check(x: ReturnType<typeof observationFixture>, s: ReturnType<typeof selection>) {
    const found: string[] = [];
    checkNativeCoverageSelection(s, x.rows, x.proof, x.f.scope.gameId, 1, x.f.scope.modelCutoffAt, (_kind, code) => found.push(code));
    return found;
  }
  it("accepts a supported interval in the window with a complete separately supplied census", () => {
    const x = observationFixture(); expect(check(x, selection(x))).toEqual([]);
    Object.assign(x.f.scope.proofs[0], { selection: selection(x) }); expect(validate(x.f).mechanicalVerdict).toBe("passed");
  });
  it.each([null, "2026-10-05T23:59:59Z"])("keeps null/crossing lower membership unknown: %j", lower => {
    const x = observationFixture(lower); expect(check(x, selection(x))).toContain("unknown_window_membership");
  });
  it("keeps incomplete/insufficient census and overlapping selection order unresolved", () => {
    const x = observationFixture(), s = selection(x); s.censusComplete = null;
    expect(check(x, s)).toContain("unknown_selection_census"); s.censusComplete = true; s.latestCount = 3;
    expect(check(x, s)).toContain("insufficient_selection_census"); s.latestCount = 1;
    const overlapping = observationFixture("2026-10-08T00:00:00Z", "2026-10-08T01:00:00Z", "2026-10-08T02:00:00Z");
    expect(check(overlapping, selection(overlapping))).toEqual(["unknown_selection_order"]);
    expect(validateNativePlayerCoverage(x.f.packet, { ...x.f.scope, gameDayChronology: "approved-by-packet" }, x.f.approvals).mechanicalVerdict).toBe("failed");
  });
});

import { describe, expect, it } from "vitest";
import { NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, nativeCoverageTextHash, NATIVE_COVERAGE_PROOF_VERSION } from "./nativePlayerCoverage";
import { calculateNativePlayerCoverageKernel, NATIVE_COVERAGE_KERNEL_VERSION, NATIVE_COVERAGE_KERNEL_ALGORITHM_HASH,
  nativeCoverageKernelSourceSetHash, type NativeCoverageKernelSpecification, type NativeCoverageKernelScope,
  type NativeCoverageKernelApproval, type NativeCoverageKernelInput } from "./nativePlayerCoverageKernel";

// Entirely invented observations, modeled drivers, weights, source receipts and approvals.
const skater = { playerId: 101, nhlPlayerId: 10001, teamId: 1 };
const goalie = { playerId: 102, nhlPlayerId: 10002, teamId: 2 };
const other = { playerId: 103, nhlPlayerId: 10003, teamId: 2 };
function guarded(intervalId: string, startSecond: number, endSecond: number, roleId: string, sa: number, nonShot: number) {
  return { intervalId, startSecond, endSecond, presence: "goalie" as "goalie" | "empty_net" | "unknown", roleId: roleId as string | null,
    observedCounts: { shotsAgainst: 4 as number | null, saves: 3 as number | null, goalsAgainst: 1 as number | null, nonShotGoalsAgainst: 0 as number | null },
    modeledShotsAgainst: sa as number | null, modeledNonShotGoalsAgainst: nonShot as number | null, emptyNetGoalsAgainst: null as number | null };
}
type Spell = Omit<ReturnType<typeof guarded>, "observedCounts"> & { observedCounts: ReturnType<typeof guarded>["observedCounts"] | null };
function period(periodNumber: number, seconds: number, intervals: Spell[]) {
  return { periodNumber, periodType: (periodNumber === 4 ? "OT" : "REG") as "REG" | "OT" | "SO", seconds,
    teamShotsAgainst: intervals.reduce((sum, value) => sum + value.modeledShotsAgainst!, 0) as number | null,
    teamNonShotGoalsAgainst: intervals.reduce((sum, value) => sum + value.modeledNonShotGoalsAgainst!, 0) as number | null, intervals };
}
function scenario(rowId: string, historicalGameId: number, starterRoleId: string, periods: ReturnType<typeof period>[]) {
  return { rowId, historicalGameId, completedAt: "2026-10-08T01:00:00Z", starterRoleId: starterRoleId as string | null,
    periods, unclassifiedSeconds: 0 as number | null, unclassifiedOpportunities: 0 as number | null };
}
function fixture() {
  const hitBody = { kind: "hit_history", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, identity: { ...skater },
    rows: [{ rowId: "h1", historicalGameId: 2026020001, completedAt: "2026-10-08T01:00:00Z", statisticalCredit: true as boolean | null, hits: 2 as number | null, seconds: 300 as number | null },
      { rowId: "h2", historicalGameId: 2026020002, completedAt: "2026-10-08T01:00:00Z", statisticalCredit: true as boolean | null, hits: 6 as number | null, seconds: 1800 as number | null }],
    unclassifiedSeconds: 0 as number | null, unclassifiedHits: 0 as number | null };
  const scenarioBody = { kind: "goalie_scenarios", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, teamId: 2,
    rows: [scenario("s1", 2026020001, "A", [
      period(1, 1200, [guarded("s1-p1-a", 0, 600, "A", 6, 1), guarded("s1-p1-b", 600, 900, "B", 3, 0), guarded("s1-p1-return", 900, 1200, "A", 3, 0)]),
      period(2, 1200, [guarded("s1-p2", 0, 1200, "A", 12, 0)]),
      period(3, 1200, [guarded("s1-p3", 0, 1100, "A", 11, 0), { intervalId: "s1-empty", startSecond: 1100, endSecond: 1200,
        presence: "empty_net", roleId: null, observedCounts: null, modeledShotsAgainst: 1, modeledNonShotGoalsAgainst: 0, emptyNetGoalsAgainst: 1 }]),
      period(4, 120, [guarded("s1-ot", 0, 120, "A", 2, 0)]),
    ]), scenario("s2", 2026020002, "B", [
      period(1, 1200, [guarded("s2-p1", 0, 1200, "B", 12, 0)]),
      period(2, 1200, [guarded("s2-p2-b", 0, 600, "B", 6, 0), guarded("s2-p2-a", 600, 1200, "A", 6, 2)]),
      period(3, 1200, [guarded("s2-p3", 0, 1200, "A", 12, 0)]),
    ]), scenario("s3", 2026020003, "B", [1, 2, 3].map(n => period(n, 1200, [guarded(`s3-p${n}`, 0, 1200, "B", 12, 0)])))],
  };
  const conversionA = { kind: "save_conversion", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, identity: { ...goalie }, conversion: 0.8 as number | null };
  const conversionB = { kind: "save_conversion", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, identity: { ...other }, conversion: 0.9 as number | null };
  const bodies = { hits: hitBody, scenarios: scenarioBody, conversionA, conversionB };
  const scope: NativeCoverageKernelScope = { gameId: 2026020088, seasonId: 20262027, teamIds: [1, 2], skater: { ...skater }, goalie: { ...goalie },
    scheduledAt: "2026-10-12T23:00:00Z", asOf: "2026-10-09T18:03:00Z", assessedAt: "2026-10-09T18:04:00Z",
    modelCutoffAt: "2026-10-09T18:00:00Z", featureCutoffAt: "2026-10-09T18:02:00Z", specificationHash: "a".repeat(64), sources: [] };
  const specification: NativeCoverageKernelSpecification = { version: NATIVE_COVERAGE_KERNEL_VERSION,
    algorithmHash: NATIVE_COVERAGE_KERNEL_ALGORITHM_HASH, domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH,
    target: { gameId: scope.gameId, seasonId: scope.seasonId, skater: { ...skater }, goalie: { ...goalie }, asOf: scope.asOf,
      modelCutoffAt: scope.modelCutoffAt, featureCutoffAt: scope.featureCutoffAt },
    hitBasis: "statistical_credit_given_game_played", scenarioBasis: "game_played", timeUnit: "seconds", countUnit: "official_statistic",
    rules: { occurrence: "synthetic-occurrence", hitMembership: "synthetic-hit-census", hitWeighting: "synthetic-hit-weights",
      participation: "synthetic-credit", scenarioMembership: "synthetic-scenario-census", scenarioWeighting: "synthetic-scenario-weights",
      exposure: "synthetic-spell-time", shotOpportunity: "synthetic-supplied-driver-transform", saveConversion: "synthetic-conversion", nonShotCredit: "synthetic-explicit-credit" },
    pGamePlayed: 0.8, pCreditGivenPlayed: 0.6, pDressGivenPlayed: 0.8, pPositiveMinutesGivenPlayed: 0.6,
    hitRepresentation: "count_and_pooled_rate", hitRows: [{ rowId: "h1", proofId: "hits", weight: 0.25 }, { rowId: "h2", proofId: "hits", weight: 0.75 }],
    scenarios: [{ rowId: "s1", proofId: "scenarios", weight: 0.5 }, { rowId: "s2", proofId: "scenarios", weight: 0.3 }, { rowId: "s3", proofId: "scenarios", weight: 0.2 }],
    goalieBindings: [{ roleId: "A", identity: { ...goalie }, conversion: 0.8, conversionProofId: "conversionA" },
      { roleId: "B", identity: { ...other }, conversion: 0.9, conversionProofId: "conversionB" }],
  };
  const packet: NativeCoverageKernelInput = { declaredClassification: "synthetic", specificationUtf8: "{}",
    sources: Object.entries(bodies).map(([proofId, body]) => ({ proofId, bodyUtf8: JSON.stringify(body), bodyHash: "a".repeat(64),
      publishedAt: "2026-10-08T02:00:00Z", firstReceivedAt: "2026-10-08T02:01:00Z", verifiedAt: "2026-10-08T02:02:00Z",
      access: "available", rights: "verified_for_intended_use" })) };
  const approvals: NativeCoverageKernelApproval[] = [{ specificationHash: scope.specificationHash, algorithmHash: specification.algorithmHash,
    domainHash: specification.domainHash, sourceSetHash: "a".repeat(64), permittedUse: "offline_arithmetic_review", approvedAt: "2026-10-09T17:00:00Z" }];
  const f = { bodies, hitBody, scenarioBody, conversionA, conversionB, scope, specification, packet, approvals };
  refresh(f); return f;
}
type Fixture = ReturnType<typeof fixture>;
// Only synthetic tests imitate independent expectation/approval updates; real callers control them separately.
function refresh(f: Fixture) {
  f.packet.specificationUtf8 = JSON.stringify(f.specification);
  f.scope.specificationHash = nativeCoverageTextHash(f.packet.specificationUtf8);
  for (const proof of f.packet.sources) {
    proof.bodyUtf8 = JSON.stringify(f.bodies[proof.proofId as keyof typeof f.bodies]); proof.bodyHash = nativeCoverageTextHash(proof.bodyUtf8);
  }
  f.scope.sources = f.packet.sources.map(({ proofId, bodyHash }) => ({ proofId, bodyHash }));
  f.approvals[0].specificationHash = f.scope.specificationHash;
  f.approvals[0].sourceSetHash = nativeCoverageKernelSourceSetHash(f.scope.sources);
}
const run = (f: Fixture) => calculateNativePlayerCoverageKernel(f.packet, f.scope, f.approvals);
const codes = (f: Fixture) => run(f).findings.map(value => value.code);
const reject = (f: Fixture, code: string) => { expect(codes(f)).toContain(code); expect(run(f)).toMatchObject({ status: "blocked", bundle: null, qualificationEligible: false }); };

describe("explicit weighted arithmetic and qualification boundaries", () => {
  it("calculates individual HIT moments, start/relief with returning starter, and full guarded/empty-net accounting once", () => {
    const f = fixture(), before = JSON.stringify(f), result = run(f);
    expect(result).toMatchObject({ status: "numerically_consistent_for_independent_review", specificationApprovalMatched: true, findings: [],
      qualificationEligible: false, estimatorApproval: "not_established", sourceAuthenticity: "not_established", upstreamPopulationCompleteness: "not_established",
      predictiveQuality: "not_assessed", excludedCategories: "withheld" });
    const b = result.bundle!;
    expect(b.hits.conditionalHits).toBe(5); expect(b.hits.conditionalSeconds).toBe(1425);
    expect(b.hits.pooledHitsPerSecond).toBeCloseTo(5 / 1425, 12);
    expect(b.hits.pooledHitsPerSecond).not.toBeCloseTo(0.25 * 2 / 300 + 0.75 * 6 / 1800, 6);
    expect(b.hits.unconditionalHits).toBeCloseTo(2.4); expect(b.hits.unconditionalSeconds).toBeCloseTo(684);
    expect(b.goalie).toMatchObject({ pStartGivenPlayed: 0.5, pReliefOnlyGivenPlayed: 0.3, pNoAppearanceGivenPlayed: 0.2 });
    expect(b.goalie.givenStart!.seconds).toBeCloseTo(3320); expect(b.goalie.givenStart!.shotsAgainst).toBeCloseTo(34);
    expect(b.goalie.givenStart!.goalsAgainst).toBeCloseTo(7.8); expect(b.goalie.givenReliefOnly!.shotsAgainst).toBeCloseTo(18);
    expect(b.goalie.givenReliefOnly!.goalsAgainst).toBeCloseTo(5.6);
    expect(b.goalie.unconditional.seconds).toBeCloseTo(1760); expect(b.goalie.unconditional.shotsAgainst).toBeCloseTo(17.92);
    expect(b.goalie.unconditional.saves).toBeCloseTo(14.336); expect(b.goalie.unconditional.goalsAgainst).toBeCloseTo(4.464);
    expect(b.goalie.unconditional.nonShotGoalsAgainst).toBeCloseTo(0.88);
    expect(b.teamGivenPlayed.seconds).toBeCloseTo(3660); expect(b.teamGivenPlayed.guardedSeconds).toBeCloseTo(3610);
    expect(b.teamGivenPlayed.emptyNetSeconds).toBeCloseTo(50); expect(b.teamGivenPlayed.teamShotsAgainst).toBeCloseTo(37);
    expect(b.teamGivenPlayed.goalieSaves).toBeCloseTo(30.61); expect(b.teamGivenPlayed.goalieGoalsAgainst).toBeCloseTo(6.99);
    expect(b.teamGivenPlayed.emptyNetGoalsAgainst).toBeCloseTo(0.5); expect(b.teamGivenPlayed.teamGoalsAgainst).toBeCloseTo(7.49);
    expect(b.teamUnconditional.teamGoalsAgainst).toBeCloseTo(0.8 * 7.49); expect(JSON.stringify(f)).toBe(before);
  });
  it("is invariant to population, period, spell, role and source ordering without mutating them", () => {
    const f = fixture(), expected = run(f).bundle;
    f.hitBody.rows.reverse(); f.scenarioBody.rows.reverse(); f.specification.hitRows.reverse(); f.specification.scenarios.reverse();
    f.specification.goalieBindings.reverse(); f.packet.sources.reverse();
    f.scenarioBody.rows.forEach(r => { r.periods.reverse(); r.periods.forEach(p => p.intervals.reverse()); });
    refresh(f); expect(run(f).bundle).toEqual(expected);
  });
  it("keeps zero-mass conditionals undefined and zero occurrence distinct from missing probabilities", () => {
    const f = fixture(); f.specification.pGamePlayed = 0;
    f.specification.pCreditGivenPlayed = f.specification.pPositiveMinutesGivenPlayed = 0;
    f.specification.scenarios[0].weight = 0; f.specification.scenarios[1].weight = 0; f.specification.scenarios[2].weight = 1;
    refresh(f); const b = run(f).bundle!;
    expect(b.hits).toMatchObject({ conditionalHits: null, conditionalSeconds: null, pooledHitsPerSecond: null, unconditionalHits: 0, unconditionalSeconds: 0 });
    expect(b.goalie).toMatchObject({ pStartGivenPlayed: 0, pReliefOnlyGivenPlayed: 0, pNoAppearanceGivenPlayed: 1, givenStart: null, givenReliefOnly: null });
    expect(Object.values(b.goalie.unconditional).every(value => value === 0)).toBe(true);
    expect(Object.values(b.teamUnconditional).every(value => value === 0)).toBe(true);
  });
  it("distinguishes verified zero HIT counts and explicit count-only representation", () => {
    const f = fixture(); f.hitBody.rows.forEach(r => { r.hits = 0; }); f.specification.hitRepresentation = "count_only"; refresh(f);
    expect(run(f).bundle!.hits).toMatchObject({ conditionalHits: 0, unconditionalHits: 0, pooledHitsPerSecond: null });
  });
});

describe("required choices and independently bound specification/source receipts", () => {
  it.each([undefined, null, []])("blocks absent arithmetic approval %j", approvals => {
    const f = fixture(); expect(calculateNativePlayerCoverageKernel(f.packet, f.scope, approvals)).toMatchObject({ specificationApprovalMatched: false, bundle: null, status: "blocked" });
  });
  it.each(["specificationHash", "algorithmHash", "domainHash", "sourceSetHash"] as const)("rejects wrong approval %s", field => {
    const f = fixture(); f.approvals[0][field] = "a".repeat(64); reject(f, "unapproved_specification");
  });
  it("rejects malformed, self-supplied, duplicate, late and wrong-use approvals", () => {
    const f = fixture(); expect(calculateNativePlayerCoverageKernel({ ...f.packet, approvedSpecifications: f.approvals }, f.scope, f.approvals).bundle).toBeNull();
    expect(calculateNativePlayerCoverageKernel(f.packet, f.scope, { ok: true }).specificationApprovalMatched).toBe(false);
    f.approvals.push(f.approvals[0]); reject(f, "unapproved_specification"); f.approvals.pop();
    f.approvals[0].approvedAt = "2026-10-09T18:00:00.000000001Z"; reject(f, "unapproved_specification");
    Object.assign(f.approvals[0], { permittedUse: "production" }); reject(f, "malformed_approval_set");
  });
  it.each(["rules", "hitRows", "scenarios", "pGamePlayed", "pCreditGivenPlayed", "goalieBindings", "hitRepresentation"])("requires explicit %s", field => {
    const f = fixture(), value = JSON.parse(f.packet.specificationUtf8); delete value[field];
    f.packet.specificationUtf8 = JSON.stringify(value); reject(f, "malformed_specification");
  });
  it("binds algorithm/domain, target and conditional bases without accepting hidden parameters", () => {
    const f = fixture(); f.specification.algorithmHash = "a".repeat(64); refresh(f); reject(f, "specification_binding");
    const x = fixture(); x.scope.gameId++; reject(x, "target_binding");
    const y = fixture(); Object.assign(y.specification, { hitBasis: "positive_minutes", window: 20 }); refresh(y); reject(y, "malformed_specification");
    const z = fixture(); z.specification.target.modelCutoffAt = "2026-10-09T17:59:59Z"; refresh(z); reject(z, "target_binding");
  });
  it("binds raw bodies and requires the exact source population", () => {
    const f = fixture(); f.packet.sources[0].bodyUtf8 += " "; reject(f, "source_binding");
    const x = fixture(); x.packet.sources.pop(); reject(x, "source_population");
    const y = fixture(); y.packet.sources.push(y.packet.sources[0]); reject(y, "source_population");
    const z = fixture(); z.packet.sources[0].bodyUtf8 = "null"; reject(z, "malformed_source_body");
  });
  it("preserves chronology at nanosecond precision, publication unknown and access restrictions", () => {
    const f = fixture(); f.hitBody.rows[0].completedAt = "2026-10-08T02:01:00.000000001Z"; refresh(f); reject(f, "completed_history_unavailable");
    const x = fixture(); x.packet.sources[0].verifiedAt = "2026-10-09T18:00:00.000000001Z"; reject(x, "source_cutoff");
    const y = fixture(); y.packet.sources[0].publishedAt = null; Object.assign(y.packet.sources[0], { rights: "unknown" });
    reject(y, "unknown_publication"); reject(y, "source_access_or_rights");
    const z = fixture(); z.scope.asOf = z.scope.scheduledAt; reject(z, "cutoff_order");
  });
  it.each([null, {}, [], { specificationUtf8: "{" }])("blocks malformed packet %j without throwing", packet => {
    const f = fixture(); expect(calculateNativePlayerCoverageKernel(packet, f.scope, f.approvals)).toMatchObject({ status: "blocked", bundle: null });
  });
});

describe("population, integer history, conditioning and unknown mass", () => {
  it("rejects omitted/duplicate observations and negative or non-normalized weights", () => {
    const f = fixture(); f.hitBody.rows.pop(); refresh(f); reject(f, "observation_population");
    const x = fixture(); x.specification.scenarios.push(x.specification.scenarios[0]); refresh(x); reject(x, "observation_population");
    const y = fixture(); y.specification.hitRows[0].weight = 0.3; refresh(y); reject(y, "non_normalized_weights");
    const z = fixture(); z.specification.scenarios[0].weight = -0.1; refresh(z); reject(z, "malformed_specification");
  });
  it("rejects duplicated full player-game HIT observations under distinct row IDs", () => {
    const f = fixture(); f.hitBody.rows[1].historicalGameId = f.hitBody.rows[0].historicalGameId;
    refresh(f); reject(f, "duplicate_hit_game");
  });
  it("rejects fractional/unsafe observed counts and exact one-count historical goalie mismatch", () => {
    const f = fixture(); f.hitBody.rows[0].hits = 0.5; refresh(f); reject(f, "malformed_source_body");
    const x = fixture(); Object.assign(x.scenarioBody.rows[0].periods[0].intervals[0].observedCounts!, { shotsAgainst: 1e9, saves: 1e9, goalsAgainst: 1 });
    refresh(x); reject(x, "observed_guarded_identity");
    const y = fixture(); y.scenarioBody.rows[0].periods[0].intervals[0].observedCounts!.shotsAgainst = Number.MAX_SAFE_INTEGER + 1;
    refresh(y); reject(y, "malformed_source_body");
    Object.assign(x.scenarioBody.rows[0].periods[0].intervals[0].observedCounts!, { shotsAgainst: Number.MAX_SAFE_INTEGER, saves: Number.MAX_SAFE_INTEGER, goalsAgainst: 2, nonShotGoalsAgainst: 2 });
    refresh(x); expect(run(x).status).toBe("numerically_consistent_for_independent_review");
  });
  it("blocks unknown HIT counts/exposure, uncredited cohort and a zero denominator", () => {
    const f = fixture(); f.hitBody.rows[0].hits = null; refresh(f); reject(f, "unknown_hit_mass");
    const x = fixture(); x.hitBody.rows[0].statisticalCredit = false; refresh(x); reject(x, "wrong_hit_conditioning");
    const y = fixture(); y.hitBody.rows.forEach(r => { r.hits = 0; r.seconds = 0; }); refresh(y); reject(y, "zero_hit_denominator");
    const z = fixture(); z.hitBody.rows[0].seconds = 0; refresh(z); reject(z, "unproved_hit_exposure");
  });
  it("blocks null occurrence/participation and incompatible minutes", () => {
    const f = fixture(); f.specification.pGamePlayed = null; refresh(f); reject(f, "unknown_participation");
    const x = fixture(); x.specification.pPositiveMinutesGivenPlayed = 0.9; refresh(x); reject(x, "participation_mass");
    const y = fixture(); y.specification.pPositiveMinutesGivenPlayed = 0.1; refresh(y); reject(y, "hit_exposure_mass");
  });
  it("blocks any positive unknown scenario/starter mass even at tiny weight", () => {
    const f = fixture(); f.specification.scenarios[0].weight = 0.5; f.specification.scenarios[1].weight = 0.5 - 1e-12; f.specification.scenarios[2].weight = 1e-12;
    f.scenarioBody.rows[2].starterRoleId = null; refresh(f); reject(f, "unknown_scenario_mass");
    const x = fixture(); x.scenarioBody.rows[0].unclassifiedSeconds = null; refresh(x); reject(x, "unknown_scenario_mass");
  });
  it("permits an explicit zero-weight unknown branch without dropping it from the census", () => {
    const f = fixture(); f.specification.scenarios[0].weight = 0.7; f.specification.scenarios[2].weight = 0;
    const r = f.scenarioBody.rows[2]; r.starterRoleId = null; r.unclassifiedSeconds = null; r.unclassifiedOpportunities = null;
    r.periods.forEach(p => { p.teamShotsAgainst = p.teamNonShotGoalsAgainst = null; p.intervals.forEach(i => {
      i.presence = "unknown"; i.roleId = null; i.observedCounts = null; i.modeledShotsAgainst = i.modeledNonShotGoalsAgainst = null;
    }); }); refresh(f); expect(run(f).status).toBe("numerically_consistent_for_independent_review");
    f.scenarioBody.rows.pop(); refresh(f); reject(f, "observation_population");
  });
});

describe("joint spell and guarded/empty-net opportunity conservation", () => {
  it.each(["canonical", "nhl", "both"] as const)("rejects backup reusing the scoped skater's %s identity on the opposing team", collision => {
    const f = fixture(), backup = f.specification.goalieBindings[1].identity;
    if (collision !== "nhl") backup.playerId = f.scope.skater.playerId;
    if (collision !== "canonical") backup.nhlPlayerId = f.scope.skater.nhlPlayerId;
    Object.assign(f.conversionB.identity, backup); refresh(f);
    reject(f, "actor_identity_collision");
    expect(run(f).estimatorApproval).toBe("not_established");
  });
  it("permits the identical scoped selected-goalie role without treating it as a duplicate actor", () => {
    const f = fixture();
    expect(f.specification.goalieBindings[0].identity).toEqual(f.scope.goalie);
    expect(run(f)).toMatchObject({ status: "numerically_consistent_for_independent_review", findings: [], qualificationEligible: false });
    expect(run(f).bundle).not.toBeNull();
  });
  it("permits another consistently bound backup identity with distinct canonical and NHL IDs", () => {
    const f = fixture(); Object.assign(f.specification.goalieBindings[1].identity, { playerId: 104, nhlPlayerId: 10004 });
    Object.assign(f.conversionB.identity, f.specification.goalieBindings[1].identity); refresh(f);
    expect(run(f)).toMatchObject({ status: "numerically_consistent_for_independent_review", findings: [], qualificationEligible: false });
    expect(run(f).bundle).not.toBeNull();
  });
  it("permits distinct scoped skater and goalie identities on the same team", () => {
    const f = fixture(); f.scope.skater.teamId = f.scope.goalie.teamId;
    Object.assign(f.specification.target.skater, f.scope.skater); Object.assign(f.hitBody.identity, f.scope.skater); refresh(f);
    expect(run(f)).toMatchObject({ status: "numerically_consistent_for_independent_review", findings: [], qualificationEligible: false });
    expect(run(f).bundle).not.toBeNull();
  });
  it("rejects overlaps, gaps, duplicate spells and wrong exclusive starter", () => {
    const f = fixture(); f.scenarioBody.rows[0].periods[0].intervals[1].startSecond = 599; refresh(f); reject(f, "spell_partition");
    const x = fixture(); x.scenarioBody.rows[0].periods[0].intervals[1].startSecond = 601; refresh(x); reject(x, "spell_partition");
    const y = fixture(); y.scenarioBody.rows[0].periods[1].intervals[0].intervalId = "s1-p1-a"; refresh(y); reject(y, "spell_partition");
    const z = fixture(); z.scenarioBody.rows[0].starterRoleId = "B"; refresh(z); reject(z, "starter_not_on_ice");
  });
  it("rejects wrong/missing periods, excessive OT, shootout and role bindings", () => {
    const f = fixture(); f.scenarioBody.rows[0].periods[3].seconds = 301; refresh(f); reject(f, "official_period_domain");
    const x = fixture(); x.scenarioBody.rows[0].periods[3].periodType = "SO"; refresh(x); reject(x, "official_period_domain");
    const y = fixture(); y.specification.goalieBindings.push(y.specification.goalieBindings[0]); refresh(y); reject(y, "duplicate_role_binding");
    const z = fixture(); z.scenarioBody.rows[0].periods[0].intervals[1].roleId = "unknown-role"; refresh(z); reject(z, "unbound_goalie_spell");
  });
  it("rejects unreconciled team opportunities and goalie attribution to empty net", () => {
    const f = fixture(); f.scenarioBody.rows[0].periods[0].teamShotsAgainst!++; refresh(f); reject(f, "team_opportunity_conservation");
    const x = fixture(); x.scenarioBody.rows[0].periods[2].intervals[1].roleId = "A"; refresh(x); reject(x, "empty_net_goalie_credit");
    const y = fixture(); y.scenarioBody.rows[0].periods[2].intervals[1].emptyNetGoalsAgainst = 2; refresh(y); reject(y, "empty_net_goal_identity");
  });
  it("blocks positive unknown spells, modeled drivers, observed attribution or save conversion", () => {
    const f = fixture(); f.scenarioBody.rows[0].periods[0].intervals[1].presence = "unknown"; refresh(f); reject(f, "unknown_spell_mass");
    const x = fixture(); x.scenarioBody.rows[0].periods[0].intervals[1].roleId = null; refresh(x); reject(x, "unknown_goalie_role");
    const y = fixture(); y.scenarioBody.rows[0].periods[0].intervals[0].modeledNonShotGoalsAgainst = null; refresh(y); reject(y, "unknown_opportunities");
    const z = fixture(); z.conversionA.conversion = z.specification.goalieBindings[0].conversion = null; refresh(z); reject(z, "unknown_guarded_mass");
  });
  it("binds conversion to player and exact source value without fitting a fallback", () => {
    const f = fixture(); f.conversionA.identity.playerId++; refresh(f); reject(f, "conversion_binding");
    const x = fixture(); x.specification.goalieBindings[0].conversion = 0.81; refresh(x); reject(x, "conversion_binding");
  });
  it("rejects overflow rather than emitting infinite means", () => {
    const f = fixture(); const p = f.scenarioBody.rows[0].periods[0];
    p.intervals.forEach(i => { i.modeledShotsAgainst = Number.MAX_VALUE; }); p.teamShotsAgainst = Number.MAX_VALUE;
    refresh(f); reject(f, "nonfinite_arithmetic");
  });
});

function prospectiveKernelFixture() {
  const f = fixture(), old = f.packet.sources.find(item => item.proofId === "hits")!;
  const rawBody = { rows: f.hitBody.rows, games: f.hitBody.rows.map(row => ({ gameId: row.historicalGameId,
    seasonId: 20262027, teamId: 1, state: "OFF", lower: "2026-10-08T00:00:00Z" })) };
  const raw = { proofId: "raw-hits", bodyUtf8: JSON.stringify(rawBody), bodyHash: nativeCoverageTextHash(JSON.stringify(rawBody)),
    sourceSemanticVersion: "synthetic-final-v1", sourceSemanticHash: nativeCoverageTextHash("source-meaning"),
    origin: "https://example.test/official-hits", revision: "synthetic-revision", httpStatus: 200 as const,
    requestedAt: "2026-10-08T02:59:00Z", firstReceivedAt: "2026-10-08T03:00:00Z", verifiedAt: "2026-10-08T03:01:00Z",
    publishedAt: null, access: "available" as const, rights: "verified_for_intended_use" as const,
    finalGames: rawBody.games.map((g, i) => ({ historicalGameId: g.gameId, seasonId: g.seasonId, teamId: g.teamId,
      gameIdPointer: `/games/${i}/gameId`, seasonIdPointer: `/games/${i}/seasonId`, teamIdPointer: `/games/${i}/teamId`,
      finalStatePointer: `/games/${i}/state`, finalStateValue: "OFF" as const })),
    completionFacts: rawBody.games.map((g, i) => ({ historicalGameId: g.gameId, seasonId: g.seasonId, teamId: g.teamId,
      pointer: `/games/${i}/lower`, kind: "completion_lower" as const, at: g.lower })) };
  const rows = f.hitBody.rows.map((row, i) => ({ ...row, completedAt: null, completion: {
    kind: "supported_bounds" as const, completedAt: null, completedNoEarlierThan: "2026-10-08T00:00:00Z" as string | null,
    lowerEvidence: { proofId: raw.proofId, bodyHash: raw.bodyHash, pointer: `/games/${i}/lower` },
    completedNoLaterThan: raw.firstReceivedAt, upperEvidence: { kind: "final_body_receipt" as const, proofId: raw.proofId, bodyHash: raw.bodyHash },
    finalEvidence: { proofId: raw.proofId, bodyHash: raw.bodyHash, historicalGameId: row.historicalGameId, seasonId: 20262027, teamId: 1 } } }));
  const proof = { version: NATIVE_COVERAGE_PROOF_VERSION as typeof NATIVE_COVERAGE_PROOF_VERSION, mode: "prospective_public_observation" as const,
    evidenceType: "derived_normalized" as const, proofId: "hits", bodyUtf8: JSON.stringify({ ...f.hitBody, rows }), bodyHash: "",
    createdAt: "2026-10-08T03:02:00Z", verifiedAt: "2026-10-08T03:03:00Z", firstReceivedAt: null, publishedAt: null,
    transformation: { version: "synthetic-v1", codeHash: nativeCoverageTextHash("code"), configHash: nativeCoverageTextHash("config"), semanticHash: nativeCoverageTextHash("semantics") },
    contributors: [raw], links: rows.map((_, i) => ({ proofId: raw.proofId, bodyHash: raw.bodyHash, pointer: `/rows/${i}`, derivedPointer: `/rows/${i}` })) };
  proof.bodyHash = nativeCoverageTextHash(proof.bodyUtf8); f.packet.sources[f.packet.sources.indexOf(old)] = proof;
  function bind() {
    proof.bodyUtf8 = JSON.stringify({ ...f.hitBody, rows }); proof.bodyHash = nativeCoverageTextHash(proof.bodyUtf8);
    const expected = JSON.parse(JSON.stringify({ ...proof, bodyUtf8: undefined,
      contributors: proof.contributors.map(item => ({ ...item, bodyUtf8: undefined })) }));
    Object.assign(f.scope.sources.find(item => item.proofId === "hits")!, { bodyHash: proof.bodyHash, contract: expected });
    f.approvals[0].sourceSetHash = nativeCoverageKernelSourceSetHash(f.scope.sources);
  }
  bind(); return { f, raw, rows, proof, bind };
}
describe("kernel observation contracts preserve arithmetic and withholding", () => {
  it("admits truthful derivative timing with null completion/publication while preserving exact-mode means", () => {
    const x = prospectiveKernelFixture(), expected = run(fixture()).bundle, before = JSON.stringify(x.f);
    expect(run(x.f)).toMatchObject({ findings: [], bundle: expected, qualificationEligible: false, estimatorApproval: "not_established" });
    expect(JSON.stringify(x.f)).toBe(before);
  });
  it("binds observation mode/semantics into the independently approved source set", () => {
    const x = prospectiveKernelFixture(); x.raw.sourceSemanticHash = "b".repeat(64);
    reject(x.f, "proof_contract_binding");
    const oldHash = x.f.approvals[0].sourceSetHash; x.bind(); x.f.approvals[0].sourceSetHash = oldHash;
    reject(x.f, "unapproved_specification");
  });
  it.each(["raw_late", "derived_late", "created_early", "missing_link", "wrong_final_game"])("withholds the numerical bundle for %s", example => {
    const x = prospectiveKernelFixture();
    if (example === "raw_late") x.raw.firstReceivedAt = "2026-10-09T18:00:00.000000001Z";
    if (example === "derived_late") x.proof.verifiedAt = "2026-10-09T18:00:00.000000001Z";
    if (example === "created_early") x.proof.createdAt = "2026-10-08T02:59:00Z";
    if (example === "missing_link") x.proof.links[0].pointer = "/missing";
    if (example === "wrong_final_game") { x.rows[0].completion.finalEvidence.historicalGameId++; x.bind(); }
    expect(run(x.f)).toMatchObject({ status: "blocked", bundle: null, qualificationEligible: false });
  });
  it("keeps null window membership blocking with a separately supplied selection", () => {
    const x = prospectiveKernelFixture(); x.rows[0].completion.completedNoEarlierThan = null;
    Object.assign(x.rows[0].completion, { lowerEvidence: null }); x.bind();
    Object.assign(x.f.scope.sources.find(item => item.proofId === "hits")!, { selection: {
      windowStartInclusive: "2025-10-09T18:00:00Z", windowEndExclusive: x.f.scope.modelCutoffAt,
      latestCount: 2, censusComplete: true, census: x.rows.map(({ historicalGameId, completedAt, completion }) => ({ historicalGameId, completedAt, completion })) } });
    x.f.approvals[0].sourceSetHash = nativeCoverageKernelSourceSetHash(x.f.scope.sources);
    reject(x.f, "unknown_window_membership");
  });
  it("retains exact integer observation identity despite prospective source admission", () => {
    const x = prospectiveKernelFixture();
    x.f.scenarioBody.rows[0].periods[0].intervals[0].observedCounts = { shotsAgainst: 1e9, saves: 1e9, goalsAgainst: 1, nonShotGoalsAgainst: 0 };
    // Only this untouched archival scenario body is refreshed; v2 proof/approval are separately retained.
    const scenarioSource = x.f.packet.sources.find(item => item.proofId === "scenarios")!;
    scenarioSource.bodyUtf8 = JSON.stringify(x.f.scenarioBody); scenarioSource.bodyHash = nativeCoverageTextHash(scenarioSource.bodyUtf8);
    x.f.scope.sources.find(item => item.proofId === "scenarios")!.bodyHash = scenarioSource.bodyHash;
    x.f.approvals[0].sourceSetHash = nativeCoverageKernelSourceSetHash(x.f.scope.sources);
    reject(x.f, "observed_guarded_identity");
  });
});

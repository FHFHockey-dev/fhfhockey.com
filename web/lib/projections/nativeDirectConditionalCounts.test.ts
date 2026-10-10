import { afterEach, describe, expect, it, vi } from "vitest";
import { NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, nativeCoverageTextHash } from "./nativePlayerCoverage";
import { reduceNativeDirectConditionalCounts, NATIVE_DIRECT_CONDITIONAL_COUNT_SPEC_HASH,
  NATIVE_DIRECT_CONDITIONAL_COUNT_FACT_HASH, NATIVE_DIRECT_CONDITIONAL_COUNT_REVIEW_HASH,
  type NativeDirectConditionalCountInput, type NativeDirectConditionalCountExpectation } from "./nativeDirectConditionalCounts";

vi.mock("./nativePlayerCoverageKernel", () => { throw new Error("Disconnected reducer must not import the joint kernel"); });
vi.mock("./nativeCoverageAssembly", () => { throw new Error("Disconnected reducer must not import assembly/runtime"); });
afterEach(() => vi.unstubAllGlobals());

// Fictitious identities, games and counts only. No retained source body is read or reduced.
function fixture() {
  const scope = { targetGameId: 999, seasonId: 20262027, cutoffAt: "2026-10-10T16:15:00.000000001Z",
    skater: { playerId: 101, nhlPlayerId: 10001, teamId: 1 }, goalie: { playerId: 102, nhlPlayerId: 10002, teamId: 2 } };
  const hitBody = { kind: "hit_history", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, identity: { ...scope.skater },
    rows: Array.from({ length: 20 }, (_, i) => ({ historicalGameId: 101 + i,
      statisticalCredit: true as boolean | null | undefined, hits: 2 as number | null | undefined })) };
  const goalieBody = Array.from({ length: 20 }, (_, i) => ({ gameId: 201 + i, playerId: scope.goalie.nhlPlayerId,
    shotsAgainst: (i < 15 ? 4 : 0) as number | null | undefined,
    saves: (i < 15 ? 3 : 0) as number | null | undefined, goalsAgainst: (i < 15 ? 1 : 0) as number | null | undefined,
    starterAsHistoricalReported: (i < 15) as boolean | null | undefined, toiAsReported: i < 15 ? "60:00" : "0:00" }));
  const binding: NativeDirectConditionalCountInput["binding"] = { specificationHash: NATIVE_DIRECT_CONDITIONAL_COUNT_SPEC_HASH,
    factualBindingHash: NATIVE_DIRECT_CONDITIONAL_COUNT_FACT_HASH, factualReviewHash: NATIVE_DIRECT_CONDITIONAL_COUNT_REVIEW_HASH };
  const packet: NativeDirectConditionalCountInput = { binding: { ...binding }, scope: structuredClone(scope),
    classification: "synthetic", diagnosticUseStatus: "authorized_by_existing_user_task", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH,
    hit: { bodyUtf8: "", rights: "unknown" }, goalie: { bodyUtf8: "", rights: "unknown" } };
  const expected: NativeDirectConditionalCountExpectation = { binding: { ...binding }, scope: structuredClone(scope),
    classification: "synthetic", diagnosticUseStatus: "authorized_by_existing_user_task", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH,
    hit: { bodyHash: "", gameIds: hitBody.rows.map(row => row.historicalGameId), rights: "unknown" },
    goalie: { bodyHash: "", gameIds: goalieBody.map(row => row.gameId), rights: "unknown" } };
  const f = { packet, expected, hitBody, goalieBody };
  refresh(f); return f;
}
type Fixture = ReturnType<typeof fixture>;
// Synthetic tests alone imitate separately supplied trusted body expectations; this does not authenticate approval.
function refresh(f: Fixture) {
  f.packet.hit.bodyUtf8 = JSON.stringify(f.hitBody); f.packet.goalie.bodyUtf8 = JSON.stringify(f.goalieBody);
  f.expected.hit.bodyHash = nativeCoverageTextHash(f.packet.hit.bodyUtf8);
  f.expected.goalie.bodyHash = nativeCoverageTextHash(f.packet.goalie.bodyUtf8);
}
const run = (f: Fixture) => reduceNativeDirectConditionalCounts(f.packet, f.expected);
function withheld(f: Fixture, code: string) {
  const result = run(f);
  expect(result.findings.map(finding => finding.code)).toContain(code);
  expect(result).toMatchObject({ status: "withheld", hits: { mean: null }, goalie: { saves: null, goalsAgainst: null }, qualificationEligible: false });
}

describe("fixed-frame direct conditional count mechanics", () => {
  it("H01/G01 uses all20 credited HIT rows and the same15 historical starts for both goalie means", () => {
    const f = fixture(), result = run(f);
    expect(result).toMatchObject({ status: "conditional_means_available", purpose: "research_candidate",
      unit: "count_per_conditional_player_game", findings: [], hits: { mean: { numerator: "40", denominator: "20" } },
      goalie: { saves: { numerator: "45", denominator: "15" }, goalsAgainst: { numerator: "15", denominator: "15" } } });
    expect(result.hits.frameGameIds).toEqual(f.expected.hit.gameIds);
    expect(result.goalie.frameGameIds).toEqual(f.expected.goalie.gameIds);
    expect(result.goalie.historicalStartGameIds).toEqual(f.expected.goalie.gameIds.slice(0, 15));
    expect(result.goalie.historicalNonstartGameIds).toEqual(f.expected.goalie.gameIds.slice(15));
    expect(result.inputBodyHashes).toEqual({ hit: f.expected.hit.bodyHash, goalie: f.expected.goalie.bodyHash });
    expect(result.binding).toEqual(f.expected.binding);
  });
  it("H02 counts a credited zero in the denominator", () => {
    const f = fixture(); f.hitBody.rows.forEach((row, i) => { row.hits = i ? 1 : 0; }); refresh(f);
    expect(run(f).hits.mean).toEqual({ numerator: "19", denominator: "20" });
  });
  it("H03 rejects a scratch/noncredited frame member rather than inserting a zero appearance", () => {
    const f = fixture(); f.hitBody.rows[0].statisticalCredit = false; f.hitBody.rows[0].hits = 0; refresh(f);
    withheld(f, "uncredited_hit_frame_member");
  });
  it("G02 retains nonstart relief counts and zero-minute rows without treating them as starts or non-GP", () => {
    const f = fixture(); Object.assign(f.goalieBody[15], { shotsAgainst: 44, saves: 40, goalsAgainst: 4, toiAsReported: "20:00" }); refresh(f);
    const result = run(f);
    expect(result.goalie).toMatchObject({ saves: { numerator: "45", denominator: "15" }, goalsAgainst: { numerator: "15", denominator: "15" } });
    expect(result.goalie.frameGameIds).toHaveLength(20); expect(result.goalie.historicalNonstartGameIds).toHaveLength(5);
    expect(result.goalie).not.toHaveProperty("nonAppearanceGameIds");
  });
  it("G03 keeps an early-relieved starter's whole-game count without per-minute normalization", () => {
    const f = fixture(); Object.assign(f.goalieBody[0], { shotsAgainst: 24, saves: 19, goalsAgainst: 5, toiAsReported: "28:33" }); refresh(f);
    expect(run(f).goalie).toMatchObject({ saves: { numerator: "61", denominator: "15" }, goalsAgainst: { numerator: "19", denominator: "15" } });
  });
  it("G04 withholds zero conditioning mass without an older-game fallback or numeric zero", () => {
    const f = fixture(); f.goalieBody.forEach(row => { row.starterAsHistoricalReported = false; }); refresh(f);
    const result = run(f);
    expect(result).toMatchObject({ status: "partially_available", goalie: { historicalStartGameIds: [], saves: null, goalsAgainst: null } });
    expect(result.goalie.historicalNonstartGameIds).toHaveLength(20);
    expect(result.findings).toContainEqual({ kind: "unknown", code: "no_historical_start_mass", path: "goalie.rows" });
  });
  it.each([null, undefined])("G05 preserves unknown historical-start classification (%s) and withholds both paired means", flag => {
    const f = fixture(); f.goalieBody[0].starterAsHistoricalReported = flag; refresh(f);
    const result = run(f);
    expect(result).toMatchObject({ status: "partially_available", goalie: { historicalStartGameIds: null, historicalNonstartGameIds: null, saves: null, goalsAgainst: null } });
    expect(result.findings[0].code).toBe("unknown_history_start_classification");
  });
  it.each([null, undefined])("preserves unknown credited HIT counts (%s) without zero filling", count => {
    const f = fixture(); f.hitBody.rows[0].hits = count; refresh(f);
    expect(run(f)).toMatchObject({ status: "partially_available", hits: { mean: null }, findings: [{ kind: "unknown", code: "unknown_credited_hit_count" }] });
  });
  it("preserves unknown credit and nonstart counts rather than silently dropping either row", () => {
    const f = fixture(); f.hitBody.rows[0].statisticalCredit = null; f.goalieBody[19].saves = null; refresh(f);
    const result = run(f);
    expect(result.status).toBe("withheld");
    expect(result.findings.map(finding => finding.code)).toEqual(["unknown_credited_hit_count", "unknown_historical_goalie_count"]);
  });
  it.each(["duplicate", "missing", "older", "reordered", "extra"])("B01 rejects a %s HIT frame without reselection", variant => {
    const f = fixture();
    if (variant === "duplicate") f.hitBody.rows[1].historicalGameId = f.hitBody.rows[0].historicalGameId;
    if (variant === "missing") f.hitBody.rows.pop();
    if (variant === "older") f.hitBody.rows[19].historicalGameId = 90;
    if (variant === "reordered") f.hitBody.rows.reverse();
    if (variant === "extra") f.hitBody.rows.push({ ...f.hitBody.rows[0], historicalGameId: 90 });
    refresh(f); withheld(f, "selected_population_mismatch");
  });
  it.each(["duplicate", "missing", "older", "reordered"])("B01 rejects a %s goalie frame without appearance fallback", variant => {
    const f = fixture();
    if (variant === "duplicate") f.goalieBody[1].gameId = f.goalieBody[0].gameId;
    if (variant === "missing") f.goalieBody.pop();
    if (variant === "older") f.goalieBody[19].gameId = 90;
    if (variant === "reordered") f.goalieBody.reverse();
    refresh(f); withheld(f, "selected_population_mismatch");
  });
  it("B02 rejects NHL ID substitution for canonical application identity", () => {
    const f = fixture(); f.hitBody.identity.playerId = f.hitBody.identity.nhlPlayerId; refresh(f);
    withheld(f, "exact_binding_mismatch");
  });
  it.each(["canonical", "NHL", "both"])("R1 rejects shared %s IDs across scoped actors even when the expectation matches", variant => {
    const f = fixture();
    if (variant !== "NHL") f.packet.scope.goalie.playerId = f.packet.scope.skater.playerId;
    if (variant !== "canonical") {
      f.packet.scope.goalie.nhlPlayerId = f.packet.scope.skater.nhlPlayerId;
      f.goalieBody.forEach(row => { row.playerId = f.packet.scope.goalie.nhlPlayerId; });
    }
    f.expected.scope = structuredClone(f.packet.scope); refresh(f);
    withheld(f, "exact_binding_mismatch");
    expect(run(f).findings).toContainEqual({ kind: "invalid", code: "exact_binding_mismatch", path: "scope.identities" });
  });
  it("R1 permits distinct actors on the same team without comparing IDs across namespaces", () => {
    const f = fixture(); f.packet.scope.goalie.teamId = f.packet.scope.skater.teamId;
    f.packet.scope.goalie.playerId = f.packet.scope.skater.nhlPlayerId;
    f.expected.scope = structuredClone(f.packet.scope);
    expect(run(f)).toMatchObject({ status: "conditional_means_available", findings: [] });
  });
  it.each(["target", "team", "actor", "classification", "body"])("B02 rejects an independently expected %s mismatch", variant => {
    const f = fixture();
    if (variant === "target") f.packet.scope.targetGameId++;
    if (variant === "team") f.packet.scope.goalie.teamId++;
    if (variant === "actor") f.packet.scope.goalie.nhlPlayerId++;
    if (variant === "classification") f.packet.classification = "retained_exports";
    if (variant === "body") f.packet.hit.bodyUtf8 += " ";
    withheld(f, "exact_binding_mismatch");
  });
  it.each(["specificationHash", "factualBindingHash", "factualReviewHash"])("rejects a different pinned %s", key => {
    const f = fixture(); Object.assign(f.packet.binding, { [key]: "b".repeat(64) });
    withheld(f, "input_or_expectation_schema");
  });
  it("B03 requires a separate complete expectation; self-claimed hashes never authenticate approval", () => {
    const f = fixture();
    for (const expected of [null, undefined, { ...f.expected, binding: { ...f.expected.binding, factualReviewHash: undefined } },
      { ...f.expected, hit: { ...f.expected.hit, rights: undefined } }]) {
      expect(reduceNativeDirectConditionalCounts(f.packet, expected)).toMatchObject({ status: "withheld",
        hits: { mean: null }, goalie: { saves: null, goalsAgainst: null }, findings: [{ kind: "unknown", code: "independent_binding_required" }] });
    }
  });
  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])("B04 rejects invalid historical integer %s", count => {
    const f = fixture(); f.hitBody.rows[0].hits = count; refresh(f); withheld(f, "historical_count_or_body_schema");
  });
  it.each(["NaN", "Infinity"])("B04 rejects JSON containing %s", count => {
    const f = fixture(); f.packet.hit.bodyUtf8 = f.packet.hit.bodyUtf8.replace('"hits":2', `"hits":${count}`);
    f.expected.hit.bodyHash = nativeCoverageTextHash(f.packet.hit.bodyUtf8); withheld(f, "invalid_history_json");
  });
  it("B04 rejects an exact one-count identity difference despite the relative floating tolerance", () => {
    const f = fixture(); Object.assign(f.goalieBody[0], { shotsAgainst: 1000000000, saves: 1000000000, goalsAgainst: 1 }); refresh(f);
    withheld(f, "historical_count_identity");
  });
  it("checks the same exact identity on excluded nonstarts", () => {
    const f = fixture(); f.goalieBody[19].goalsAgainst = 1; refresh(f); withheld(f, "historical_count_identity");
  });
  it("B05 sums safe scalars beyond Number's aggregate precision as decimal BigInt rationals", () => {
    const f = fixture(); f.hitBody.rows.forEach(row => { row.hits = 1000000000000000; });
    f.goalieBody.slice(0, 15).forEach(row => { Object.assign(row, { shotsAgainst: 1000000000000001, saves: 1000000000000000, goalsAgainst: 1 }); });
    refresh(f);
    expect(run(f)).toMatchObject({ hits: { mean: { numerator: "20000000000000000", denominator: "20" } },
      goalie: { saves: { numerator: "15000000000000000", denominator: "15" }, goalsAgainst: { numerator: "15", denominator: "15" } } });
  });
  it("C01 binds exact cutoff text and consumes supplied frame order without Date-based reordering", () => {
    const f = fixture(); expect(run(f).scope?.cutoffAt).toBe(f.expected.scope.cutoffAt);
    f.packet.scope.cutoffAt = "2026-10-10T16:15:00.000000002Z"; withheld(f, "exact_binding_mismatch");
  });
  it("rejects a target game in the historical frame even when both bindings claim it", () => {
    const f = fixture(); f.hitBody.rows[0].historicalGameId = f.packet.scope.targetGameId;
    f.expected.hit.gameIds[0] = f.packet.scope.targetGameId; refresh(f); withheld(f, "selected_population_mismatch");
  });
  it("C02 leaves literal individual counts unchanged by SO/empty-net/TOI metadata", () => {
    const f = fixture(); Object.assign(f.goalieBody[0], { shootoutGoals: 2, teamEmptyNetGoalsAgainst: 3, toiAsReported: "62:25", unclassifiedNetSeconds: null }); refresh(f);
    expect(run(f).goalie).toMatchObject({ saves: { numerator: "45", denominator: "15" }, goalsAgainst: { numerator: "15", denominator: "15" } });
  });
  it("O01/O02 leaves unknown rights and predictive uncertainty explicit while conditional means remain available", () => {
    const result = run(fixture());
    expect(result).toMatchObject({ status: "conditional_means_available", arithmetic: "exact_integer_sums_and_rational_strings",
      predictiveUncertainty: "unestimated", predictiveQuality: "not_assessed", diagnosticUseStatus: "authorized_by_existing_user_task",
      contributorRights: { hit: "unknown", goalie: "unknown" }, scientificAdmission: "withheld", c2Admission: "withheld", qualificationEligible: false });
    for (const key of ["pGame", "pStart", "pCredit", "pDress", "pMinutes", "unconditional", "rosterRevision", "issuedAt", "forecast", "currentRole"]) {
      expect(result).not.toHaveProperty(key); expect(result.hits).not.toHaveProperty(key); expect(result.goalie).not.toHaveProperty(key);
    }
  });
  it("does not turn unknown diagnostic status or restricted rights into permission", () => {
    const f = fixture(); f.packet.diagnosticUseStatus = f.expected.diagnosticUseStatus = "unknown";
    f.packet.goalie.rights = f.expected.goalie.rights = "restricted";
    expect(run(f)).toMatchObject({ diagnosticUseStatus: "unknown", contributorRights: { goalie: "restricted" }, scientificAdmission: "withheld", qualificationEligible: false });
  });
  it.each(["hit", "goalie", "both"])("R2 rejects relabeling untrusted %s rights without changing independent expectations", variant => {
    const f = fixture(), bodyHashes = { hit: f.expected.hit.bodyHash, goalie: f.expected.goalie.bodyHash };
    if (variant !== "goalie") f.packet.hit.rights = "verified_for_intended_use";
    if (variant !== "hit") f.packet.goalie.rights = "verified_for_intended_use";
    withheld(f, "exact_binding_mismatch");
    expect(run(f)).toMatchObject({ contributorRights: { hit: "unknown", goalie: "unknown" },
      findings: [{ kind: "invalid", code: "exact_binding_mismatch", path: "contributorRights" }] });
    expect({ hit: f.expected.hit.bodyHash, goalie: f.expected.goalie.bodyHash }).toEqual(bodyHashes);
  });
  it("R2 treats correctly bound synthetic rights as metadata without granting scientific/C2 admission", () => {
    const f = fixture(); f.packet.hit.rights = f.expected.hit.rights = "verified_for_intended_use";
    expect(run(f)).toMatchObject({ status: "conditional_means_available", contributorRights: { hit: "verified_for_intended_use", goalie: "unknown" },
      scientificAdmission: "withheld", c2Admission: "withheld", qualificationEligible: false });
  });
  it("O03 does not mutate input/expectation or call network, kernel or assembly", () => {
    const fetch = vi.fn(() => { throw new Error("No network permitted"); }); vi.stubGlobal("fetch", fetch);
    const f = fixture(), before = JSON.stringify(f), result = run(f);
    expect(JSON.stringify(f)).toBe(before); expect(fetch).not.toHaveBeenCalled();
    result.hits.frameGameIds.reverse(); result.scope!.skater.playerId++;
    expect(JSON.stringify(f)).toBe(before);
  });
});

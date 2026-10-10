import { createHash } from "node:crypto";
import { z } from "zod";

/** Offline proof checks only. No producer imports, model defaults, inference or issuance. */
export const NATIVE_PLAYER_COVERAGE_VERSION = "native-player-category-coverage-v1";
const count = z.number().finite().nonnegative();
const id = z.number().int().positive().safe();
const text = z.string().trim().min(1).max(256);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value))
  && (value.match(/\.(\d+)/)?.[1].length ?? 0) <= 9, "Invalid or over-precise timestamp");
const probability = count.max(1).nullable();
const category = z.enum(["HITS", "SAVES_GOALIE", "GOALS_AGAINST_GOALIE"]);
type Category = z.infer<typeof category>;
const identity = z.object({ playerId: id, nhlPlayerId: id, teamId: id }).strict();
const domain = z.object({ competition: z.literal("regular_season"), periods: z.tuple([z.literal("REG"), z.literal("OT")]),
  strengths: z.literal("all"), netPresence: z.literal("all"), shootout: z.literal("excluded") }).strict();
export const NATIVE_PLAYER_COVERAGE_DOMAIN = domain.parse({ competition: "regular_season", periods: ["REG", "OT"],
  strengths: "all", netPresence: "all", shootout: "excluded" });
/** Hashes exact UTF-8 text, not the rolling pipeline's canonical object representation. */
export function nativeCoverageTextHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
export const NATIVE_PLAYER_COVERAGE_DOMAIN_HASH = nativeCoverageTextHash(JSON.stringify(NATIVE_PLAYER_COVERAGE_DOMAIN));
const bases = { skater: "statistical_credit_given_game_played", goalie: "start_or_relief_given_game_played" } as const;
export function nativeCoverageBasisHash(population: keyof typeof bases): string {
  return nativeCoverageTextHash(bases[population]);
}
const assumptions = z.object({ occurrenceRuleId: text, participationRuleId: text, exposureRuleId: text }).strict();
export function nativeCoverageAssumptionsHash(value: z.infer<typeof assumptions>): string {
  return nativeCoverageTextHash(JSON.stringify(assumptions.parse(value)));
}
const model = z.object({ modelId: text, modelHash: hash, domainHash: hash, basisHash: hash,
  assumptionsHash: hash, assumptions }).strict();
const approval = model.omit({ assumptions: true }).extend({ categories: z.array(category).min(1).max(3),
  permittedUse: z.literal("offline_support_review"), approvedAt: timestamp }).strict();
export type NativeCoverageEstimatorApproval = z.infer<typeof approval>;
const rowKey = z.object({ rowId: text, historicalGameId: id, periodNumber: id, periodType: z.enum(["REG", "OT", "SO"]) }).strict();
const scope = z.object({ gameId: id, seasonId: id, teamIds: z.tuple([id, id]), scheduledAt: timestamp,
  asOf: timestamp, assessedAt: timestamp, modelCutoffAt: timestamp, featureCutoffAt: timestamp,
  skater: identity, goalie: identity,
  proofs: z.array(z.object({ proofId: text, bodyHash: hash,
    // Supplied separately by the caller, never inferred from the evidence packet's rows.
    expectedRows: z.array(rowKey).max(20000).nullable() }).strict()).max(2) }).strict();
export type NativePlayerCoverageScope = z.infer<typeof scope>;
const counts = z.object({ HITS: count.nullable(), SHOTS_AGAINST_GOALIE: count.nullable(), SAVES_GOALIE: count.nullable(),
  GOALS_AGAINST_GOALIE: count.nullable(), nonShotGoalsAgainst: count.nullable() }).strict();
const row = rowKey.extend({ completedAt: timestamp, exposureSeconds: count.max(3900).nullable(),
  counts }).strict();
const body = z.object({ gameId: id, seasonId: id, identity, domain,
  rows: z.array(row).max(20000), unclassifiedEvents: count.nullable(), unclassifiedSeconds: count.nullable() }).strict();
const proof = z.object({ proofId: text, bodyUtf8: z.string().min(1).max(2000000), bodyHash: hash,
  // Publication and receipt refer to this exact completed-game body revision.
  publishedAt: timestamp.nullable(), firstReceivedAt: timestamp, verifiedAt: timestamp,
  access: z.enum(["available", "restricted", "unknown"]), rights: z.enum(["verified_for_intended_use", "restricted", "unknown"]) }).strict();
const goalieStats = z.object({ SHOTS_AGAINST_GOALIE: count.nullable(), SAVES_GOALIE: count.nullable(),
  GOALS_AGAINST_GOALIE: count.nullable(), nonShotGoalsAgainst: count.nullable(), seconds: count.max(3900).nullable() }).strict();
const skater = z.object({ identity, model, coverage: proof.nullable(), pCreditGivenPlayed: probability,
  pDressGivenPlayed: probability, pPositiveMinutesGivenPlayed: probability,
  conditionalBasis: z.literal(bases.skater), conditionalHits: count.nullable(), unconditionalHits: count.nullable(),
  conditionalSeconds: count.max(3900).nullable(), unconditionalSeconds: count.max(3900).nullable() }).strict();
const goalie = z.object({ identity, model, coverage: proof.nullable(), pStartGivenPlayed: probability,
  pReliefOnlyGivenPlayed: probability, pNoAppearanceGivenPlayed: probability,
  conditionalBasis: z.literal(bases.goalie), givenStart: goalieStats.nullable(), givenReliefOnly: goalieStats.nullable(),
  unconditional: goalieStats }).strict();
const packet = z.object({ version: z.literal(NATIVE_PLAYER_COVERAGE_VERSION),
  declaredClassification: z.enum(["synthetic", "retained_exports"]), gameId: id, seasonId: id,
  asOf: timestamp, pGamePlayed: probability, skater, goalie }).strict();
export type NativePlayerCoveragePacket = z.infer<typeof packet>;
type Finding = { kind: "invalid" | "unknown" | "approval"; code: string; path: string; categories?: Category[] };
export type NativePlayerCoverageResult = {
  version: typeof NATIVE_PLAYER_COVERAGE_VERSION;
  mechanicalVerdict: "passed" | "failed" | "unknown";
  estimatorApprovalMatched: boolean;
  status: "blocked" | "mechanically_consistent_for_independent_review";
  categories: { category: Category; mechanicalVerdict: "passed" | "failed" | "unknown"; estimatorApprovalMatched: boolean }[];
  findings: Finding[];
  qualificationEligible: false;
  sourceAuthenticity: "not_established";
  upstreamPopulationCompleteness: "not_established";
  predictiveQuality: "not_assessed";
  estimatorExecution: "not_verified";
  declaredClassification: "synthetic" | "retained_exports" | null;
};
const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
const sameIdentity = (a: z.infer<typeof identity>, b: z.infer<typeof identity>) =>
  a.playerId === b.playerId && a.nhlPlayerId === b.nhlPlayerId && a.teamId === b.teamId;
// Date.parse truncates fractions beyond milliseconds; retain up to nanosecond ordering.
function time(value: string): bigint {
  const fraction = (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(9, "0");
  return BigInt(Date.parse(value)) * BigInt(1000000) + BigInt(fraction.slice(3));
}

/** The scope and approval set MUST come from an independent, owner-controlled caller.
 * This function cannot authenticate that caller or verify unseen upstream populations.
 * Evidence cannot carry approvals: strict parsing rejects packet self-authorization.
 */
export function validateNativePlayerCoverage(input: unknown, expectedScope: unknown,
  approvedEstimators: unknown): NativePlayerCoverageResult {
  const findings: Finding[] = [];
  let declaredClassification: NativePlayerCoverageResult["declaredClassification"] = null;
  const add = (kind: Finding["kind"], code: string, path: string, categories?: Category[]) => findings.push({ kind, code, path, categories });
  const verdict = (items: Finding[]) => items.some(item => item.kind === "invalid") ? "failed" as const
    : items.some(item => item.kind === "unknown") ? "unknown" as const : "passed" as const;
  const result = (): NativePlayerCoverageResult => {
    const mechanicalVerdict = verdict(findings);
    const estimatorApprovalMatched = !findings.some(item => item.kind === "approval");
    return { version: NATIVE_PLAYER_COVERAGE_VERSION, mechanicalVerdict, estimatorApprovalMatched,
      status: mechanicalVerdict === "passed" && estimatorApprovalMatched ? "mechanically_consistent_for_independent_review" : "blocked",
      categories: (["HITS", "SAVES_GOALIE", "GOALS_AGAINST_GOALIE"] as Category[]).map(target => {
        const relevant = findings.filter(item => !item.categories || item.categories.includes(target));
        return { category: target, mechanicalVerdict: verdict(relevant), estimatorApprovalMatched: !relevant.some(item => item.kind === "approval") };
      }), findings, qualificationEligible: false, sourceAuthenticity: "not_established",
      upstreamPopulationCompleteness: "not_established", predictiveQuality: "not_assessed", estimatorExecution: "not_verified", declaredClassification };
  };
  const parsedScope = scope.safeParse(expectedScope), parsedPacket = packet.safeParse(input);
  const parsedApprovals = z.array(approval).max(1000).safeParse(approvedEstimators ?? []);
  if (!parsedScope.success) add("invalid", "malformed_scope", "scope");
  if (!parsedPacket.success) add("invalid", "malformed_packet", "packet");
  if (!parsedApprovals.success) add("approval", "malformed_approval_set", "approvals");
  if (!parsedScope.success || !parsedPacket.success) {
    add("approval", "unapproved_estimator", "packet");
    return result();
  }
  const s = parsedScope.data, p = parsedPacket.data;
  declaredClassification = p.declaredClassification;
  if (s.teamIds[0] === s.teamIds[1] || s.skater.playerId === s.goalie.playerId
    || s.skater.nhlPlayerId === s.goalie.nhlPlayerId
    || !s.teamIds.includes(s.skater.teamId) || !s.teamIds.includes(s.goalie.teamId)) add("invalid", "invalid_scope_identity", "scope");
  if (p.gameId !== s.gameId || p.seasonId !== s.seasonId || time(p.asOf) !== time(s.asOf)
    || !sameIdentity(p.skater.identity, s.skater) || !sameIdentity(p.goalie.identity, s.goalie)) add("invalid", "identity_scope_mismatch", "packet");
  if (time(s.modelCutoffAt) > time(s.featureCutoffAt) || time(s.featureCutoffAt) > time(s.asOf)
    || time(s.asOf) > time(s.assessedAt) || time(s.asOf) >= time(s.scheduledAt)) add("invalid", "invalid_cutoff_order", "scope");
  if (new Set(s.proofs.map(value => value.proofId)).size !== s.proofs.length) add("invalid", "duplicate_expected_proof", "scope.proofs");
  const usedProofs = new Set<string>();

  function checkModel(value: z.infer<typeof model>, population: keyof typeof bases, targets: Category[]) {
    if (value.domainHash !== NATIVE_PLAYER_COVERAGE_DOMAIN_HASH || value.basisHash !== nativeCoverageBasisHash(population)
      || value.assumptionsHash !== nativeCoverageAssumptionsHash(value.assumptions)) add("invalid", "model_contract_hash_mismatch", `${population}.model`, targets);
    for (const target of targets) {
      const matches = (parsedApprovals.success ? parsedApprovals.data : []).filter(item =>
        ["modelId", "modelHash", "domainHash", "basisHash", "assumptionsHash"].every(key =>
          item[key as keyof typeof item] === value[key as keyof typeof value]) && item.categories.includes(target)
          && time(item.approvedAt) <= time(s.modelCutoffAt));
      if (matches.length !== 1) add("approval", "unapproved_estimator", `${population}.model`, [target]);
    }
  }
  checkModel(p.skater.model, "skater", ["HITS"]);
  checkModel(p.goalie.model, "goalie", ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE"]);
  function checkCounts(value: z.infer<typeof counts> | z.infer<typeof goalieStats>, path: string, targets: Category[], historical = false) {
    const sa = value.SHOTS_AGAINST_GOALIE, sv = value.SAVES_GOALIE, ga = value.GOALS_AGAINST_GOALIE, nonShot = value.nonShotGoalsAgainst;
    const values = [sa, sv, ga, nonShot], missing = values.some(value => value === null);
    if (missing) add("unknown", "unknown_guarded_counts", path, targets);
    if (historical && values.some(value => value !== null && !Number.isSafeInteger(value))) {
      add("invalid", "noninteger_historical_count", path, targets); return;
    }
    if (!missing && (nonShot! > ga! || (historical
      ? BigInt(sa!) !== BigInt(sv!) + BigInt(ga!) - BigInt(nonShot!)
      : !equal(sa!, sv! + ga! - nonShot!)))) add("invalid", "guarded_shot_identity", path, targets);
  }
  function checkProof(value: z.infer<typeof proof> | null, actor: z.infer<typeof identity>, population: keyof typeof bases, targets: Category[]) {
    if (!value) { add("unknown", population === "skater" ? "missing_whole_play_hit_coverage" : "missing_guarded_shot_spell_coverage", `${population}.coverage`, targets); return; }
    if (usedProofs.has(value.proofId)) add("invalid", "duplicate_proof", `${population}.coverage`, targets);
    usedProofs.add(value.proofId);
    const expected = s.proofs.find(item => item.proofId === value.proofId);
    if (!expected || expected.bodyHash !== value.bodyHash || nativeCoverageTextHash(value.bodyUtf8) !== value.bodyHash)
      add("invalid", "proof_hash_or_scope_mismatch", `${population}.coverage`, targets);
    if (value.publishedAt === null) add("unknown", "unknown_publication_time", `${population}.coverage`, targets);
    else if (time(value.publishedAt) > time(value.firstReceivedAt)) add("invalid", "source_chronology", `${population}.coverage`, targets);
    if (time(value.firstReceivedAt) > time(value.verifiedAt) || time(value.verifiedAt) > time(s.modelCutoffAt))
      add("invalid", "future_or_reversed_information", `${population}.coverage`, targets);
    if (value.access !== "available" || value.rights !== "verified_for_intended_use") add("unknown", "unverified_access_or_rights", `${population}.coverage`, targets);
    let raw: unknown;
    try { raw = JSON.parse(value.bodyUtf8); } catch { add("invalid", "malformed_proof_json", `${population}.coverage`, targets); return; }
    const parsed = body.safeParse(raw);
    if (!parsed.success) { add("invalid", "malformed_coverage_body", `${population}.coverage`, targets); return; }
    const b = parsed.data;
    if (b.gameId !== s.gameId || b.seasonId !== s.seasonId || !sameIdentity(b.identity, actor)) add("invalid", "proof_identity_mismatch", `${population}.coverage`, targets);
    if (!expected?.expectedRows) add("unknown", "unknown_expected_population", `${population}.coverage`, targets);
    else {
      const key = (item: z.infer<typeof rowKey>) => JSON.stringify([item.rowId, item.historicalGameId, item.periodNumber, item.periodType]);
      const expectedKeys = expected.expectedRows.map(key).sort();
      const actualKeys = b.rows.map(key).sort();
      if (new Set(expected.expectedRows.map(item => item.rowId)).size !== expectedKeys.length
        || JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) add("invalid", "population_mismatch", `${population}.coverage`, targets);
    }
    if (!b.rows.length) add("unknown", "empty_history_not_a_zero_rate", `${population}.coverage`, targets);
    if (new Set(b.rows.map(item => item.rowId)).size !== b.rows.length
      || new Set(b.rows.map(item => `${item.historicalGameId}:${item.periodNumber}`)).size !== b.rows.length)
      add("invalid", "duplicate_history_row", `${population}.coverage`, targets);
    if (b.unclassifiedEvents !== 0 || b.unclassifiedSeconds !== 0) add("unknown", "unclassified_event_or_exposure", `${population}.coverage`, targets);
    let exposure = 0;
    for (const r of b.rows) {
      if (r.historicalGameId === s.gameId || time(r.completedAt) >= time(s.modelCutoffAt)) add("invalid", "future_history", `${population}.coverage`, targets);
      if (time(r.completedAt) > time(value.firstReceivedAt)
        || value.publishedAt !== null && time(r.completedAt) > time(value.publishedAt))
        add("invalid", "completed_history_unavailable", `${population}.coverage`, targets);
      if (r.periodType === "SO") { add("invalid", "shootout_in_official_play", `${population}.coverage`, targets); continue; }
      if (r.periodType === "REG" && r.periodNumber > 3 || r.periodType === "OT" && r.periodNumber !== 4)
        add("invalid", "period_boundary_mismatch", `${population}.coverage`, targets);
      if (r.exposureSeconds === null) add("unknown", "unknown_exposure", `${population}.coverage`, targets);
      else {
        exposure += r.exposureSeconds;
        if (r.exposureSeconds > (r.periodType === "REG" ? 1200 : 300)) add("invalid", "period_exposure_exceeded", `${population}.coverage`, targets);
      }
      if (population === "skater") {
        if (r.counts.HITS === null) add("unknown", "unknown_hit_count", `${population}.coverage`, targets);
        else if (!Number.isSafeInteger(r.counts.HITS)) add("invalid", "noninteger_historical_count", `${population}.coverage`, targets);
        if (r.exposureSeconds === 0 && (r.counts.HITS ?? 0) > 0) add("unknown", "unproved_hit_exposure", `${population}.coverage`, targets);
      } else {
        checkCounts(r.counts, `${population}.coverage`, targets, true);
        if (r.exposureSeconds === 0 && ((r.counts.SHOTS_AGAINST_GOALIE ?? 0) > 0 || (r.counts.GOALS_AGAINST_GOALIE ?? 0) > 0))
          add("unknown", "unproved_guarded_exposure", `${population}.coverage`, targets);
      }
    }
    if (exposure === 0) add("unknown", "zero_exposure_denominator", `${population}.coverage`, targets);
  }
  checkProof(p.skater.coverage, s.skater, "skater", ["HITS"]);
  checkProof(p.goalie.coverage, s.goalie, "goalie", ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE"]);
  if (s.proofs.some(value => !usedProofs.has(value.proofId))) add("unknown", "unused_expected_coverage", "scope.proofs");

  const g = p.pGamePlayed;
  if (g === null) add("unknown", "unknown_game_occurrence", "pGamePlayed");
  const sk = p.skater, cr = sk.pCreditGivenPlayed;
  if (cr === null || sk.pDressGivenPlayed === null || sk.pPositiveMinutesGivenPlayed === null) add("unknown", "unknown_skater_participation", "skater", ["HITS"]);
  else if (sk.pPositiveMinutesGivenPlayed > sk.pDressGivenPlayed || sk.pPositiveMinutesGivenPlayed > cr)
    add("invalid", "incompatible_skater_participation", "skater", ["HITS"]);
  function integrate(conditional: number | null, unconditional: number | null, mass: number | null, path: string, targets: Category[]) {
    if (mass === null || g === null || unconditional === null) { add("unknown", "unknown_integration", path, targets); return; }
    if (mass === 0) {
      if (conditional !== null || unconditional !== 0) add("invalid", "undefined_zero_mass_condition", path, targets);
    } else if (conditional === null) add("unknown", "unknown_conditional_mean", path, targets);
    else if (!equal(unconditional, g * mass * conditional)) add("invalid", "occurrence_participation_integration", path, targets);
  }
  integrate(sk.conditionalHits, sk.unconditionalHits, cr, "skater.HITS", ["HITS"]);
  integrate(sk.conditionalSeconds, sk.unconditionalSeconds, cr, "skater.seconds", ["HITS"]);
  if (sk.conditionalSeconds === 0 && (sk.conditionalHits ?? 0) > 0) add("unknown", "unproved_hit_exposure", "skater", ["HITS"]);
  if (sk.pPositiveMinutesGivenPlayed !== null && cr !== null && sk.conditionalSeconds !== null
    && (cr * sk.conditionalSeconds > 3900 * sk.pPositiveMinutesGivenPlayed
      || sk.pPositiveMinutesGivenPlayed > 0 && cr * sk.conditionalSeconds <= 0)) add("invalid", "incompatible_minutes", "skater.seconds", ["HITS"]);
  const go = p.goalie, targets: Category[] = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE"];
  if (go.pStartGivenPlayed === null || go.pReliefOnlyGivenPlayed === null || go.pNoAppearanceGivenPlayed === null)
    add("unknown", "unknown_goalie_states", "goalie", targets);
  else if (!equal(go.pStartGivenPlayed + go.pReliefOnlyGivenPlayed + go.pNoAppearanceGivenPlayed, 1)) add("invalid", "goalie_state_mass", "goalie", targets);
  for (const [stats, mass] of [[go.givenStart, go.pStartGivenPlayed], [go.givenReliefOnly, go.pReliefOnlyGivenPlayed]] as const) {
    if (mass === 0 && stats !== null) add("invalid", "undefined_zero_mass_condition", "goalie", targets);
    if (mass !== null && mass > 0 && stats === null) add("unknown", "unknown_goalie_conditional", "goalie", targets);
    if (stats) {
      checkCounts(stats, "goalie.conditional", targets);
      if (stats.seconds === null || stats.seconds === 0)
        add("unknown", "unproved_guarded_exposure", "goalie.conditional", targets);
    }
  }
  checkCounts(go.unconditional, "goalie.unconditional", targets);
  for (const key of Object.keys(go.unconditional) as (keyof typeof go.unconditional)[]) {
    const claimed = go.unconditional[key];
    if (g === null || go.pStartGivenPlayed === null || go.pReliefOnlyGivenPlayed === null || claimed === null
      || go.pStartGivenPlayed > 0 && go.givenStart?.[key] == null || go.pReliefOnlyGivenPlayed > 0 && go.givenReliefOnly?.[key] == null)
      add("unknown", "unknown_goalie_integration", `goalie.${key}`, targets);
    else if (!equal(claimed, g * (go.pStartGivenPlayed * (go.givenStart?.[key] ?? 0) + go.pReliefOnlyGivenPlayed * (go.givenReliefOnly?.[key] ?? 0))))
      add("invalid", "occurrence_participation_integration", `goalie.${key}`, targets);
  }
  return result();
}

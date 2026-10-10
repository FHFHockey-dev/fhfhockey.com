import { z } from "zod";
import { NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, nativeCoverageTextHash, nativeCoverageProofBindingHash } from "./nativePlayerCoverage";

/** Disconnected count arithmetic. Caller-controlled bindings do not authenticate approval or grant use. */
export const NATIVE_DIRECT_CONDITIONAL_COUNT_VERSION = "native-direct-conditional-count-baseline-v1";
export const NATIVE_DIRECT_CONDITIONAL_COUNT_SPEC_HASH = "d526f8b13ed3207e26bc734db79b3248e0cd9e2404936d0b246fed8b86d76c70";
export const NATIVE_DIRECT_CONDITIONAL_COUNT_FACT_HASH = "d1995bbaad1cbbe5e6f6c2e8ee73eeb1c9df3591f7c74cebb3b25ca6190e6aa5";
export const NATIVE_DIRECT_CONDITIONAL_COUNT_REVIEW_HASH = "f7120eb151e07f497e97745f495f7b0b38f4c1c104aafdd640912da3dcc25d46";
const integer = z.number().int().nonnegative().safe();
const id = integer.positive();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.object({ playerId: id, nhlPlayerId: id, teamId: id }).strict();
const binding = z.object({ specificationHash: z.literal(NATIVE_DIRECT_CONDITIONAL_COUNT_SPEC_HASH),
  factualBindingHash: z.literal(NATIVE_DIRECT_CONDITIONAL_COUNT_FACT_HASH),
  factualReviewHash: z.literal(NATIVE_DIRECT_CONDITIONAL_COUNT_REVIEW_HASH) }).strict();
const scope = z.object({ targetGameId: id, seasonId: id, cutoffAt: z.string().datetime({ offset: true }),
  skater: identity, goalie: identity }).strict();
const classification = z.enum(["synthetic", "retained_exports"]);
const diagnosticUse = z.enum(["authorized_by_existing_user_task", "unknown"]);
const rights = z.enum(["verified_for_intended_use", "unknown", "restricted"]);
const frame = z.array(id).length(20).refine(ids => new Set(ids).size === 20);
const expectedBody = z.object({ bodyHash: hash, gameIds: frame, rights }).strict();
const expectation = z.object({ binding, scope, classification, diagnosticUseStatus: diagnosticUse,
  domainHash: z.literal(NATIVE_PLAYER_COVERAGE_DOMAIN_HASH), hit: expectedBody, goalie: expectedBody }).strict();
export type NativeDirectConditionalCountExpectation = z.infer<typeof expectation>;
const source = z.object({ bodyUtf8: z.string().min(1).max(4000000), rights }).strict();
const input = z.object({ binding, scope, classification, diagnosticUseStatus: diagnosticUse,
  domainHash: z.literal(NATIVE_PLAYER_COVERAGE_DOMAIN_HASH), hit: source, goalie: source }).strict();
export type NativeDirectConditionalCountInput = z.infer<typeof input>;
const hitRow = z.object({ historicalGameId: id, statisticalCredit: z.boolean().nullish(), hits: integer.nullish() }).passthrough();
const hitBody = z.object({ kind: z.literal("hit_history"), domainHash: z.literal(NATIVE_PLAYER_COVERAGE_DOMAIN_HASH),
  identity, rows: z.array(hitRow).max(1000) }).passthrough();
const goalieRow = z.object({ gameId: id, playerId: id, shotsAgainst: integer.nullish(), saves: integer.nullish(),
  goalsAgainst: integer.nullish(), starterAsHistoricalReported: z.boolean().nullish() }).passthrough();
const goalieBody = z.array(goalieRow).max(1000);
type Rational = { numerator: string; denominator: string };
type Finding = { kind: "invalid" | "unknown"; code: string; path: string };
export type NativeDirectConditionalCountResult = {
  version: typeof NATIVE_DIRECT_CONDITIONAL_COUNT_VERSION; status: "conditional_means_available" | "partially_available" | "withheld";
  purpose: "research_candidate"; unit: "count_per_conditional_player_game";
  classification: z.infer<typeof classification> | null; binding: z.infer<typeof binding> | null;
  scope: z.infer<typeof scope> | null; inputBodyHashes: { hit: string; goalie: string } | null;
  hits: { conditioning: "game_played_and_named_skater_statistical_credit"; frameGameIds: number[]; mean: Rational | null };
  goalie: { conditioning: "game_played_and_named_goalie_starts"; frameGameIds: number[];
    historicalStartGameIds: number[] | null; historicalNonstartGameIds: number[] | null; saves: Rational | null; goalsAgainst: Rational | null };
  arithmetic: "exact_integer_sums_and_rational_strings"; predictiveUncertainty: "unestimated"; predictiveQuality: "not_assessed";
  diagnosticUseStatus: z.infer<typeof diagnosticUse> | null; contributorRights: { hit: z.infer<typeof rights>; goalie: z.infer<typeof rights> } | null;
  scientificAdmission: "withheld"; c2Admission: "withheld"; qualificationEligible: false; findings: Finding[];
};
const same = (a: unknown, b: unknown) => nativeCoverageProofBindingHash(a) === nativeCoverageProofBindingHash(b);
const rational = (sum: bigint, denominator: number): Rational => ({ numerator: sum.toString(), denominator: String(denominator) });

/** No selection, exposure transfer, probability multiplication, fitting or qualified C2 admission. */
export function reduceNativeDirectConditionalCounts(value: unknown, independentlyExpected: unknown): NativeDirectConditionalCountResult {
  const result: NativeDirectConditionalCountResult = { version: NATIVE_DIRECT_CONDITIONAL_COUNT_VERSION, status: "withheld",
    purpose: "research_candidate", unit: "count_per_conditional_player_game",
    classification: null, binding: null, scope: null, inputBodyHashes: null,
    hits: { conditioning: "game_played_and_named_skater_statistical_credit", frameGameIds: [], mean: null },
    goalie: { conditioning: "game_played_and_named_goalie_starts", frameGameIds: [], historicalStartGameIds: null,
      historicalNonstartGameIds: null, saves: null, goalsAgainst: null },
    arithmetic: "exact_integer_sums_and_rational_strings", predictiveUncertainty: "unestimated", predictiveQuality: "not_assessed",
    diagnosticUseStatus: null, contributorRights: null, scientificAdmission: "withheld", c2Admission: "withheld",
    qualificationEligible: false, findings: [] };
  const add = (kind: Finding["kind"], code: string, path: string) => result.findings.push({ kind, code, path });
  if (independentlyExpected === null || independentlyExpected === undefined) {
    add("unknown", "independent_binding_required", "expectation"); return result;
  }
  const expected = expectation.safeParse(independentlyExpected), parsed = input.safeParse(value);
  if (!expected.success) {
    const missing = expected.error.issues.some(issue =>
      issue.code === "invalid_type" && (issue.received === "undefined" || issue.received === "null")
      || issue.code === "invalid_literal" && (issue.received === undefined || issue.received === null));
    add(missing ? "unknown" : "invalid", missing ? "independent_binding_required" : "input_or_expectation_schema", "expectation");
    return result;
  }
  if (!parsed.success) { add("invalid", "input_or_expectation_schema", "input"); return result; }
  const e = expected.data, p = parsed.data;
  result.classification = e.classification;
  result.diagnosticUseStatus = e.diagnosticUseStatus;
  result.contributorRights = { hit: e.hit.rights, goalie: e.goalie.rights };
  if (!same(p.binding, e.binding) || !same(p.scope, e.scope) || p.classification !== e.classification
    || p.diagnosticUseStatus !== e.diagnosticUseStatus || p.domainHash !== e.domainHash) {
    add("invalid", "exact_binding_mismatch", "binding"); return result;
  }
  if (p.hit.rights !== e.hit.rights || p.goalie.rights !== e.goalie.rights) {
    add("invalid", "exact_binding_mismatch", "contributorRights"); return result;
  }
  if (e.scope.skater.playerId === e.scope.goalie.playerId || e.scope.skater.nhlPlayerId === e.scope.goalie.nhlPlayerId) {
    add("invalid", "exact_binding_mismatch", "scope.identities"); return result;
  }
  if (nativeCoverageTextHash(p.hit.bodyUtf8) !== e.hit.bodyHash || nativeCoverageTextHash(p.goalie.bodyUtf8) !== e.goalie.bodyHash) {
    add("invalid", "exact_binding_mismatch", "bodyHash"); return result;
  }
  result.binding = { ...e.binding };
  result.scope = { ...e.scope, skater: { ...e.scope.skater }, goalie: { ...e.scope.goalie } };
  result.inputBodyHashes = { hit: e.hit.bodyHash, goalie: e.goalie.bodyHash };
  result.hits.frameGameIds = [...e.hit.gameIds]; result.goalie.frameGameIds = [...e.goalie.gameIds];
  let hitJson: unknown, goalieJson: unknown;
  try { hitJson = JSON.parse(p.hit.bodyUtf8); goalieJson = JSON.parse(p.goalie.bodyUtf8); }
  catch { add("invalid", "invalid_history_json", "history"); return result; }
  const hits = hitBody.safeParse(hitJson), goalies = goalieBody.safeParse(goalieJson);
  if (!hits.success || !goalies.success) { add("invalid", "historical_count_or_body_schema", "history"); return result; }
  const hr = hits.data.rows, gr = goalies.data.filter(row => row.playerId === e.scope.goalie.nhlPlayerId);
  if (!same(hits.data.identity, e.scope.skater)) { add("invalid", "exact_binding_mismatch", "hit.identity"); return result; }
  if (!same(hr.map(row => row.historicalGameId), e.hit.gameIds) || !same(gr.map(row => row.gameId), e.goalie.gameIds)
    || e.hit.gameIds.includes(e.scope.targetGameId) || e.goalie.gameIds.includes(e.scope.targetGameId)) {
    add("invalid", "selected_population_mismatch", "history"); return result;
  }
  for (const row of gr) if (row.shotsAgainst != null && row.saves != null && row.goalsAgainst != null
    && BigInt(row.shotsAgainst) !== BigInt(row.saves) + BigInt(row.goalsAgainst)) {
    add("invalid", "historical_count_identity", `goalie.${row.gameId}`);
  }
  if (hr.some(row => row.statisticalCredit === false)) add("invalid", "uncredited_hit_frame_member", "hit.rows");
  if (result.findings.length) return result;
  if (hr.some(row => row.statisticalCredit == null || row.hits == null)) add("unknown", "unknown_credited_hit_count", "hit.rows");
  else result.hits.mean = rational(hr.reduce((sum, row) => sum + BigInt(row.hits!), BigInt(0)), 20);
  if (gr.some(row => row.starterAsHistoricalReported === null || row.starterAsHistoricalReported === undefined)) {
    add("unknown", "unknown_history_start_classification", "goalie.rows");
  } else {
    const starts = gr.filter(row => row.starterAsHistoricalReported);
    result.goalie.historicalStartGameIds = starts.map(row => row.gameId);
    result.goalie.historicalNonstartGameIds = gr.filter(row => !row.starterAsHistoricalReported).map(row => row.gameId);
    if (gr.some(row => row.shotsAgainst == null || row.saves == null || row.goalsAgainst == null)) {
      add("unknown", "unknown_historical_goalie_count", "goalie.rows");
    } else if (!starts.length) add("unknown", "no_historical_start_mass", "goalie.rows");
    else {
      result.goalie.saves = rational(starts.reduce((sum, row) => sum + BigInt(row.saves!), BigInt(0)), starts.length);
      result.goalie.goalsAgainst = rational(starts.reduce((sum, row) => sum + BigInt(row.goalsAgainst!), BigInt(0)), starts.length);
    }
  }
  const hasHits = result.hits.mean !== null, hasGoalie = result.goalie.saves !== null;
  result.status = hasHits && hasGoalie ? "conditional_means_available" : hasHits || hasGoalie ? "partially_available" : "withheld";
  return result;
}

import { z } from "zod";
import { NATIVE_PLAYER_COVERAGE_DOMAIN_HASH, nativeCoverageTextHash, nativeCoverageProofSchema,
  nativeCoverageProofExpectationSchema, nativeCoverageHistoryFields, nativeCoverageSelectionSchema,
  checkNativeCoverageProof, checkNativeCoverageHistory, checkNativeCoverageSelection, nativeCoverageProofBindingHash } from "./nativePlayerCoverage";

/** Disconnected arithmetic only; no population selection, fitting, sampling or issuance. */
export const NATIVE_COVERAGE_KERNEL_VERSION = "native-player-coverage-arithmetic-v1";
export const NATIVE_COVERAGE_KERNEL_ALGORITHM_HASH = nativeCoverageTextHash(
  "v1:credited-hit-weighted-moments;pooled-hits=sum(w*hits)/sum(w*seconds);played-joint-spell-mixture;sv=sa*conversion;ga=sa*(1-conversion)+nonshot;occurrence-once",
);
const number = z.number().finite().nonnegative();
const integer = number.int().safe();
const id = integer.positive();
const text = z.string().trim().min(1).max(256);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value))
  && (value.match(/\.(\d+)/)?.[1].length ?? 0) <= 9);
const probability = number.max(1).nullable();
const identity = z.object({ playerId: id, nhlPlayerId: id, teamId: id }).strict();
const member = z.object({ rowId: text, proofId: text, weight: number.max(1) }).strict();
const specification = z.object({ version: z.literal(NATIVE_COVERAGE_KERNEL_VERSION), algorithmHash: hash, domainHash: hash,
  target: z.object({ gameId: id, seasonId: id, skater: identity, goalie: identity, asOf: timestamp,
    modelCutoffAt: timestamp, featureCutoffAt: timestamp }).strict(),
  hitBasis: z.literal("statistical_credit_given_game_played"), scenarioBasis: z.literal("game_played"),
  timeUnit: z.literal("seconds"), countUnit: z.literal("official_statistic"),
  rules: z.object({ occurrence: text, hitMembership: text, hitWeighting: text, participation: text,
    scenarioMembership: text, scenarioWeighting: text, exposure: text, shotOpportunity: text, saveConversion: text, nonShotCredit: text }).strict(),
  pGamePlayed: probability, pCreditGivenPlayed: probability, pDressGivenPlayed: probability, pPositiveMinutesGivenPlayed: probability,
  hitRepresentation: z.enum(["count_only", "count_and_pooled_rate"]),
  hitRows: z.array(member).min(1).max(10000), scenarios: z.array(member).min(1).max(10000),
  goalieBindings: z.array(z.object({ roleId: text, identity, conversion: probability, conversionProofId: text }).strict()).min(1).max(20),
}).strict();
export type NativeCoverageKernelSpecification = z.infer<typeof specification>;
const scope = z.object({ gameId: id, seasonId: id, teamIds: z.tuple([id, id]), skater: identity, goalie: identity,
  scheduledAt: timestamp, asOf: timestamp, assessedAt: timestamp, modelCutoffAt: timestamp, featureCutoffAt: timestamp,
  specificationHash: hash, sources: z.array(z.object({ proofId: text, bodyHash: hash,
    contract: nativeCoverageProofExpectationSchema.optional(), selection: nativeCoverageSelectionSchema.optional() }).strict()).min(1).max(1000) }).strict();
export type NativeCoverageKernelScope = z.infer<typeof scope>;
const approval = z.object({ specificationHash: hash, algorithmHash: hash, domainHash: hash, sourceSetHash: hash,
  permittedUse: z.literal("offline_arithmetic_review"), approvedAt: timestamp }).strict();
export type NativeCoverageKernelApproval = z.infer<typeof approval>;
const source = z.object({ proofId: text, bodyUtf8: z.string().min(1).max(4000000), bodyHash: hash,
  // These times describe availability of this exact body revision.
  publishedAt: timestamp.nullable(), firstReceivedAt: timestamp, verifiedAt: timestamp,
  access: z.enum(["available", "unknown", "restricted"]), rights: z.enum(["verified_for_intended_use", "unknown", "restricted"]) }).strict();
const input = z.object({ declaredClassification: z.enum(["synthetic", "retained_exports"]), specificationUtf8: z.string().min(1).max(4000000),
  sources: z.array(z.union([source, nativeCoverageProofSchema])).min(1).max(1000) }).strict();
export type NativeCoverageKernelInput = z.infer<typeof input>;
const history = z.object({ rowId: text, historicalGameId: id, ...nativeCoverageHistoryFields });
const hitRow = history.extend({ statisticalCredit: z.boolean().nullable(), hits: integer.nullable(), seconds: integer.max(3900).nullable() }).strict();
const observed = z.object({ shotsAgainst: integer.nullable(), saves: integer.nullable(), goalsAgainst: integer.nullable(), nonShotGoalsAgainst: integer.nullable() }).strict();
const interval = z.object({ intervalId: text, startSecond: integer, endSecond: integer,
  presence: z.enum(["goalie", "empty_net", "unknown"]), roleId: text.nullable(), observedCounts: observed.nullable(),
  modeledShotsAgainst: number.nullable(), modeledNonShotGoalsAgainst: number.nullable(), emptyNetGoalsAgainst: number.nullable() }).strict();
const period = z.object({ periodNumber: id, periodType: z.enum(["REG", "OT", "SO"]), seconds: integer.positive().max(1200),
  teamShotsAgainst: number.nullable(), teamNonShotGoalsAgainst: number.nullable(),
  intervals: z.array(interval).min(1).max(1000) }).strict();
const scenario = history.extend({ starterRoleId: text.nullable(), periods: z.array(period).min(3).max(4),
  unclassifiedSeconds: number.nullable(), unclassifiedOpportunities: number.nullable() }).strict();
const sourceBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hit_history"), domainHash: hash, identity, rows: z.array(hitRow).max(10000),
    unclassifiedSeconds: number.nullable(), unclassifiedHits: number.nullable() }).strict(),
  z.object({ kind: z.literal("goalie_scenarios"), domainHash: hash, teamId: id, rows: z.array(scenario).max(10000) }).strict(),
  z.object({ kind: z.literal("save_conversion"), domainHash: hash, identity, conversion: probability }).strict(),
]);
export const nativeCoverageKernelSourceBodySchema = sourceBody;
export type NativeCoverageKernelSourceBody = z.infer<typeof sourceBody>;
type Finding = { kind: "invalid" | "unknown" | "approval"; code: string; path: string };
type GoalieMean = { seconds: number; shotsAgainst: number; saves: number; goalsAgainst: number; nonShotGoalsAgainst: number };
type TeamMean = { seconds: number; guardedSeconds: number; emptyNetSeconds: number; guardedShotsAgainst: number;
  goalieSaves: number; goalieGoalsAgainst: number; guardedNonShotGoalsAgainst: number;
  emptyNetShotsAgainst: number; emptyNetGoalsAgainst: number; emptyNetNonShotGoalsAgainst: number;
  teamShotsAgainst: number; teamGoalsAgainst: number; teamNonShotGoalsAgainst: number };
type Bundle = {
  hits: { conditionalHits: number | null; conditionalSeconds: number | null; pooledHitsPerSecond: number | null;
    unconditionalHits: number; unconditionalSeconds: number };
  goalie: { pStartGivenPlayed: number; pReliefOnlyGivenPlayed: number; pNoAppearanceGivenPlayed: number;
    givenStart: GoalieMean | null; givenReliefOnly: GoalieMean | null; unconditional: GoalieMean };
  teamGivenPlayed: TeamMean; teamUnconditional: TeamMean;
};
export type NativeCoverageKernelResult = { version: typeof NATIVE_COVERAGE_KERNEL_VERSION;
  status: "blocked" | "numerically_consistent_for_independent_review"; specificationApprovalMatched: boolean;
  findings: Finding[]; bundle: Bundle | null; qualificationEligible: false; estimatorApproval: "not_established";
  sourceAuthenticity: "not_established"; upstreamPopulationCompleteness: "not_established"; predictiveQuality: "not_assessed";
  excludedCategories: "withheld" };
// Floating serialization tolerance is for modeled means/weights, never observed integer identities.
const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
const sameIdentity = (a: z.infer<typeof identity>, b: z.infer<typeof identity>) =>
  a.playerId === b.playerId && a.nhlPlayerId === b.nhlPlayerId && a.teamId === b.teamId;
function time(value: string): bigint {
  const fraction = (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(9, "0");
  return BigInt(Date.parse(value)) * BigInt(1000000) + BigInt(fraction.slice(3));
}
export function nativeCoverageKernelSourceSetHash(sources: NativeCoverageKernelScope["sources"]): string {
  return nativeCoverageTextHash(JSON.stringify(sources.map(item => item.contract || item.selection
    ? [item.proofId, item.bodyHash, item.contract ? nativeCoverageProofBindingHash(item.contract) : null, item.selection ? nativeCoverageProofBindingHash(item.selection) : null] as const : [item.proofId, item.bodyHash] as const)
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}
const zeroGoalie = (): GoalieMean => ({ seconds: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, nonShotGoalsAgainst: 0 });
const zeroTeam = (): TeamMean => ({ seconds: 0, guardedSeconds: 0, emptyNetSeconds: 0, guardedShotsAgainst: 0,
  goalieSaves: 0, goalieGoalsAgainst: 0, guardedNonShotGoalsAgainst: 0, emptyNetShotsAgainst: 0,
  emptyNetGoalsAgainst: 0, emptyNetNonShotGoalsAgainst: 0, teamShotsAgainst: 0, teamGoalsAgainst: 0, teamNonShotGoalsAgainst: 0 });
function scaled<T extends object>(value: T, factor: number): T {
  return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, amount * factor])) as T;
}
function accumulate<T extends object>(to: T, from: T, weight: number) {
  for (const key of Object.keys(to) as (keyof T)[]) to[key] = (Number(to[key]) + Number(from[key]) * weight) as T[keyof T];
}

/** Scope, exact specification hash and approval records must be independently caller-controlled.
 * A matching record permits supplied arithmetic only; it never establishes estimator approval.
 */
export function calculateNativePlayerCoverageKernel(packet: unknown, expectedScope: unknown, approvedSpecifications: unknown): NativeCoverageKernelResult {
  const findings: Finding[] = [];
  const add = (kind: Finding["kind"], code: string, path: string) => findings.push({ kind, code, path });
  const finish = (bundle: Bundle | null = null): NativeCoverageKernelResult => ({ version: NATIVE_COVERAGE_KERNEL_VERSION,
    status: findings.length ? "blocked" : "numerically_consistent_for_independent_review",
    specificationApprovalMatched: !findings.some(value => value.kind === "approval"), findings,
    bundle: findings.length ? null : bundle, qualificationEligible: false, estimatorApproval: "not_established",
    sourceAuthenticity: "not_established", upstreamPopulationCompleteness: "not_established", predictiveQuality: "not_assessed", excludedCategories: "withheld" });
  const p = input.safeParse(packet), s = scope.safeParse(expectedScope), a = z.array(approval).max(1000).safeParse(approvedSpecifications ?? []);
  if (!p.success) add("invalid", "malformed_input", "packet");
  if (!s.success) add("invalid", "malformed_scope", "scope");
  if (!a.success) add("approval", "malformed_approval_set", "approvals");
  if (!p.success || !s.success) { add("approval", "unapproved_specification", "packet"); return finish(); }
  let raw: unknown;
  try { raw = JSON.parse(p.data.specificationUtf8); } catch { add("invalid", "malformed_specification_json", "specification"); }
  const spec = specification.safeParse(raw);
  if (!spec.success) { add("invalid", "malformed_specification", "specification"); add("approval", "unapproved_specification", "specification"); return finish(); }
  const q = spec.data, c = s.data;
  const specHash = nativeCoverageTextHash(p.data.specificationUtf8), sourceHash = nativeCoverageKernelSourceSetHash(c.sources);
  if (specHash !== c.specificationHash || q.algorithmHash !== NATIVE_COVERAGE_KERNEL_ALGORITHM_HASH
    || q.domainHash !== NATIVE_PLAYER_COVERAGE_DOMAIN_HASH) add("invalid", "specification_binding", "specification");
  if (q.target.gameId !== c.gameId || q.target.seasonId !== c.seasonId || !sameIdentity(q.target.skater, c.skater)
    || !sameIdentity(q.target.goalie, c.goalie) || time(q.target.asOf) !== time(c.asOf)
    || time(q.target.modelCutoffAt) !== time(c.modelCutoffAt) || time(q.target.featureCutoffAt) !== time(c.featureCutoffAt))
    add("invalid", "target_binding", "specification.target");
  const matches = (a.success ? a.data : []).filter(value => value.specificationHash === specHash
    && value.algorithmHash === q.algorithmHash && value.domainHash === q.domainHash && value.sourceSetHash === sourceHash
    && time(value.approvedAt) <= time(c.modelCutoffAt));
  if (matches.length !== 1) add("approval", "unapproved_specification", "specification");
  if (c.teamIds[0] === c.teamIds[1] || c.skater.playerId === c.goalie.playerId || c.skater.nhlPlayerId === c.goalie.nhlPlayerId
    || !c.teamIds.includes(c.skater.teamId) || !c.teamIds.includes(c.goalie.teamId)) add("invalid", "scope_identity", "scope");
  if (time(c.modelCutoffAt) > time(c.featureCutoffAt) || time(c.featureCutoffAt) > time(c.asOf)
    || time(c.asOf) > time(c.assessedAt) || time(c.asOf) >= time(c.scheduledAt)) add("invalid", "cutoff_order", "scope");
  const bodies = new Map<string, z.infer<typeof sourceBody>>(), envelopes = new Map<string, z.infer<typeof input>["sources"][number]>();
  const c2Teams = new Map<string, Map<number, number> | undefined>();
  const keys = (values: { proofId: string }[]) => values.map(value => value.proofId).sort();
  if (new Set(keys(c.sources)).size !== c.sources.length || new Set(keys(p.data.sources)).size !== p.data.sources.length
    || JSON.stringify(keys(c.sources)) !== JSON.stringify(keys(p.data.sources))) add("invalid", "source_population", "sources");
  for (const proof of p.data.sources) {
    const expected = c.sources.find(value => value.proofId === proof.proofId);
    if (!expected || proof.bodyHash !== expected.bodyHash || nativeCoverageTextHash(proof.bodyUtf8) !== proof.bodyHash) add("invalid", "source_binding", proof.proofId);
    checkNativeCoverageProof(proof, expected?.contract, c.modelCutoffAt, (kind, code) => {
      const legacyCodes: Record<string, string> = { unknown_publication_time: "unknown_publication",
        future_or_reversed_information: "source_cutoff", unverified_access_or_rights: "source_access_or_rights" };
      add(kind, legacyCodes[code] ?? code, proof.proofId);
    });
    let value: unknown;
    try { value = JSON.parse(proof.bodyUtf8); } catch { add("invalid", "malformed_source_json", proof.proofId); continue; }
    const b = sourceBody.safeParse(value);
    if (!b.success) { add("invalid", "malformed_source_body", proof.proofId); continue; }
    if (b.data.domainHash !== q.domainHash) add("invalid", "source_domain", proof.proofId);
    bodies.set(proof.proofId, b.data); envelopes.set(proof.proofId, proof);
    if (b.data.kind !== "save_conversion") {
      const teams = checkNativeCoverageSelection(expected?.selection, b.data.rows, proof, c.gameId,
        b.data.kind === "hit_history" ? c.skater.teamId : c.goalie.teamId, c.modelCutoffAt,
        (kind, code) => add(kind, code, proof.proofId), { contract: expected?.contract,
          population: b.data.kind === "hit_history" ? { kind: "credited_skater_games", identity: c.skater }
            : { kind: "defending_team_games", teamId: c.goalie.teamId },
          observedPopulation: b.data.kind === "hit_history" ? { kind: "credited_skater_games", identity: b.data.identity }
            : { kind: "defending_team_games", teamId: b.data.teamId } });
      if (expected?.selection && "version" in expected.selection) c2Teams.set(proof.proofId, teams);
    }
  }
  function historyTime(value: z.infer<typeof history>, proofId: string) {
    const proof = envelopes.get(proofId)!;
    if (c2Teams.has(proofId) && !c2Teams.get(proofId)?.has(value.historicalGameId)) { add("unknown", "unadmitted_c2_history_team", value.rowId); return; }
    checkNativeCoverageHistory(value, proof, c.gameId,
      c2Teams.get(proofId)?.get(value.historicalGameId) ?? (bodies.get(proofId)?.kind === "hit_history" ? c.skater.teamId : c.goalie.teamId), c.modelCutoffAt,
      (kind, code) => add(kind, code, value.rowId));
  }
  function membership(kind: "hit_history" | "goalie_scenarios", members: z.infer<typeof member>[]) {
    const key = (proofId: string, rowId: string) => JSON.stringify([proofId, rowId]);
    const wanted = members.map(value => key(value.proofId, value.rowId)).sort();
    const actual: string[] = [];
    for (const [proofId, b] of bodies) if (b.kind === kind) b.rows.forEach(row => actual.push(key(proofId, row.rowId)));
    if (new Set(wanted).size !== wanted.length || new Set(members.map(value => value.rowId)).size !== members.length
      || new Set(actual).size !== actual.length || JSON.stringify(wanted) !== JSON.stringify(actual.sort())) add("invalid", "observation_population", kind);
    if (!equal(members.reduce((sum, value) => sum + value.weight, 0), 1)) add("invalid", "non_normalized_weights", kind);
  }
  membership("hit_history", q.hitRows); membership("goalie_scenarios", q.scenarios);
  const ordered = (values: z.infer<typeof member>[]) => [...values].sort((a, b) => a.rowId < b.rowId ? -1 : a.rowId > b.rowId ? 1 : 0);
  const referencedSources = new Set([...q.hitRows, ...q.scenarios].map(value => value.proofId));
  q.goalieBindings.forEach(value => referencedSources.add(value.conversionProofId));
  if (c.sources.some(value => !referencedSources.has(value.proofId))) add("invalid", "unused_source", "sources");
  if ([q.pGamePlayed, q.pCreditGivenPlayed, q.pDressGivenPlayed, q.pPositiveMinutesGivenPlayed].some(value => value === null)) add("unknown", "unknown_participation", "specification");
  else if (q.pPositiveMinutesGivenPlayed! > q.pCreditGivenPlayed! || q.pPositiveMinutesGivenPlayed! > q.pDressGivenPlayed!) add("invalid", "participation_mass", "specification");
  let hitMean = 0, hitSeconds = 0;
  const hitGames = new Set<number>();
  for (const m of ordered(q.hitRows)) {
    const b = bodies.get(m.proofId);
    if (!b || b.kind !== "hit_history") { add("unknown", "missing_hit_source", m.rowId); continue; }
    if (!sameIdentity(b.identity, c.skater)) add("invalid", "hit_identity", m.proofId);
    const r = b.rows.find(value => value.rowId === m.rowId);
    if (!r) { add("unknown", "missing_hit_row", m.rowId); continue; }
    if (hitGames.has(r.historicalGameId)) add("invalid", "duplicate_hit_game", m.rowId);
    hitGames.add(r.historicalGameId);
    historyTime(r, m.proofId);
    if (r.statisticalCredit === false) add("invalid", "wrong_hit_conditioning", m.rowId);
    if (m.weight > 0 && (r.statisticalCredit === null || r.hits === null || r.seconds === null
      || b.unclassifiedHits !== 0 || b.unclassifiedSeconds !== 0)) add("unknown", "unknown_hit_mass", m.rowId);
    if (m.weight > 0 && r.seconds === 0 && (r.hits ?? 0) > 0) add("unknown", "unproved_hit_exposure", m.rowId);
    if (m.weight > 0 && r.hits !== null && r.seconds !== null) { hitMean += m.weight * r.hits; hitSeconds += m.weight * r.seconds; }
  }
  if (q.pCreditGivenPlayed! > 0 && hitSeconds === 0 || q.hitRepresentation === "count_and_pooled_rate" && hitSeconds === 0) add("unknown", "zero_hit_denominator", "hits");
  if (q.pCreditGivenPlayed !== null && q.pPositiveMinutesGivenPlayed !== null
    && (q.pCreditGivenPlayed * hitSeconds > 3900 * q.pPositiveMinutesGivenPlayed
      || q.pPositiveMinutesGivenPlayed > 0 && q.pCreditGivenPlayed * hitSeconds <= 0)) add("invalid", "hit_exposure_mass", "hits");
  const bindings = new Map(q.goalieBindings.map(value => [value.roleId, value]));
  const actors = [c.skater, c.goalie, ...q.goalieBindings.map(value => value.identity)];
  if (actors.some((actor, index) => actors.slice(0, index).some(known =>
    (known.playerId === actor.playerId || known.nhlPlayerId === actor.nhlPlayerId) && !sameIdentity(known, actor))))
    add("invalid", "actor_identity_collision", "identities");
  if (bindings.size !== q.goalieBindings.length || new Set(q.goalieBindings.map(value => value.identity.playerId)).size !== bindings.size
    || new Set(q.goalieBindings.map(value => value.identity.nhlPlayerId)).size !== bindings.size) add("invalid", "duplicate_role_binding", "goalieBindings");
  const selected = q.goalieBindings.filter(value => sameIdentity(value.identity, c.goalie));
  if (selected.length !== 1 || q.goalieBindings.some(value => value.identity.teamId !== c.goalie.teamId)) add("invalid", "goalie_identity", "goalieBindings");
  for (const binding of q.goalieBindings) {
    const b = bodies.get(binding.conversionProofId);
    if (!b || b.kind !== "save_conversion") add("unknown", "missing_conversion_source", binding.roleId);
    else if (!sameIdentity(b.identity, binding.identity) || b.conversion !== binding.conversion) add("invalid", "conversion_binding", binding.roleId);
  }
  let pStart = 0, pRelief = 0, pNone = 0;
  const startTotals = zeroGoalie(), reliefTotals = zeroGoalie(), goalieTotals = zeroGoalie(), teamTotals = zeroTeam();
  for (const m of ordered(q.scenarios)) {
    const b = bodies.get(m.proofId);
    if (!b || b.kind !== "goalie_scenarios") { add("unknown", "missing_scenario_source", m.rowId); continue; }
    if (b.teamId !== c.goalie.teamId) add("invalid", "scenario_team", m.rowId);
    const r = b.rows.find(value => value.rowId === m.rowId);
    if (!r) { add("unknown", "missing_scenario", m.rowId); continue; }
    historyTime(r, m.proofId);
    const active = m.weight > 0;
    if (r.starterRoleId !== null && !bindings.has(r.starterRoleId)) add("invalid", "unbound_starter", r.rowId);
    if (active && (r.starterRoleId === null || r.unclassifiedSeconds !== 0 || r.unclassifiedOpportunities !== 0)) add("unknown", "unknown_scenario_mass", r.rowId);
    const team = zeroTeam(), roles = new Map(q.goalieBindings.map(value => [value.roleId, zeroGoalie()]));
    const periods = [...r.periods].sort((a, b) => a.periodNumber - b.periodNumber);
    if (periods.some((value, i) => value.periodNumber !== i + 1 || (i < 3 ? value.periodType !== "REG" || value.seconds !== 1200
      : value.periodType !== "OT" || value.seconds > 300))) add("invalid", "official_period_domain", r.rowId);
    const intervalIds = new Set<string>();
    for (const per of periods) {
      team.seconds += per.seconds;
      let end = 0, periodShots = 0, periodNonShot = 0;
      for (const spell of [...per.intervals].sort((a, b) => a.startSecond - b.startSecond)) {
        if (intervalIds.has(spell.intervalId) || spell.startSecond !== end || spell.endSecond <= spell.startSecond || spell.endSecond > per.seconds)
          add("invalid", "spell_partition", spell.intervalId);
        intervalIds.add(spell.intervalId); end = spell.endSecond;
        const seconds = spell.endSecond - spell.startSecond;
        if (per.periodNumber === 1 && spell.startSecond === 0 && r.starterRoleId !== null
          && (spell.presence !== "goalie" || spell.roleId !== r.starterRoleId)) add("invalid", "starter_not_on_ice", r.rowId);
        if (spell.presence === "unknown") { if (active) add("unknown", "unknown_spell_mass", spell.intervalId); continue; }
        if (active && (spell.modeledShotsAgainst === null || spell.modeledNonShotGoalsAgainst === null)) add("unknown", "unknown_opportunities", spell.intervalId);
        const sa = spell.modeledShotsAgainst ?? 0, nonShot = spell.modeledNonShotGoalsAgainst ?? 0;
        periodShots += sa; periodNonShot += nonShot;
        if (spell.presence === "empty_net") {
          if (spell.roleId !== null || spell.observedCounts !== null) add("invalid", "empty_net_goalie_credit", spell.intervalId);
          if (active && spell.emptyNetGoalsAgainst === null) add("unknown", "unknown_empty_net_credit", spell.intervalId);
          if (spell.emptyNetGoalsAgainst !== null && (spell.emptyNetGoalsAgainst < nonShot || spell.emptyNetGoalsAgainst > sa + nonShot)) add("invalid", "empty_net_goal_identity", spell.intervalId);
          team.emptyNetSeconds += seconds; team.emptyNetShotsAgainst += sa; team.emptyNetGoalsAgainst += spell.emptyNetGoalsAgainst ?? 0;
          team.emptyNetNonShotGoalsAgainst += nonShot;
        } else {
          if (spell.roleId === null) { if (active) add("unknown", "unknown_goalie_role", spell.intervalId); continue; }
          const binding = spell.roleId === null ? undefined : bindings.get(spell.roleId), totals = spell.roleId === null ? undefined : roles.get(spell.roleId);
          if (!binding || !totals) { add("invalid", "unbound_goalie_spell", spell.intervalId); continue; }
          if (spell.emptyNetGoalsAgainst !== null) add("invalid", "guarded_empty_net_credit", spell.intervalId);
          const obs = spell.observedCounts;
          if (active && (!obs || Object.values(obs).some(value => value === null) || binding.conversion === null)) add("unknown", "unknown_guarded_mass", spell.intervalId);
          if (obs && Object.values(obs).every(value => value !== null)) {
            if (obs.nonShotGoalsAgainst! > obs.goalsAgainst! || BigInt(obs.shotsAgainst!) !== BigInt(obs.saves!) + BigInt(obs.goalsAgainst!) - BigInt(obs.nonShotGoalsAgainst!)) add("invalid", "observed_guarded_identity", spell.intervalId);
          }
          if (binding.conversion !== null) {
            const stats = { seconds, shotsAgainst: sa, saves: sa * binding.conversion,
              goalsAgainst: sa * (1 - binding.conversion) + nonShot, nonShotGoalsAgainst: nonShot };
            accumulate(totals, stats, 1); team.guardedSeconds += seconds;
            team.guardedShotsAgainst += sa; team.goalieSaves += stats.saves;
            team.goalieGoalsAgainst += stats.goalsAgainst; team.guardedNonShotGoalsAgainst += nonShot;
          }
        }
      }
      if (end !== per.seconds) add("invalid", "spell_partition", r.rowId);
      if (active && (per.teamShotsAgainst === null || per.teamNonShotGoalsAgainst === null)) add("unknown", "unknown_team_opportunities", r.rowId);
      if (per.teamShotsAgainst !== null && !equal(periodShots, per.teamShotsAgainst)
        || per.teamNonShotGoalsAgainst !== null && !equal(periodNonShot, per.teamNonShotGoalsAgainst)) add("invalid", "team_opportunity_conservation", r.rowId);
    }
    if (active && !equal(team.guardedSeconds + team.emptyNetSeconds, team.seconds)) add("unknown", "unaccounted_time", r.rowId);
    if (!equal(team.guardedShotsAgainst, team.goalieSaves + team.goalieGoalsAgainst - team.guardedNonShotGoalsAgainst)) add("invalid", "modeled_guarded_identity", r.rowId);
    team.teamShotsAgainst = team.guardedShotsAgainst + team.emptyNetShotsAgainst;
    team.teamGoalsAgainst = team.goalieGoalsAgainst + team.emptyNetGoalsAgainst;
    team.teamNonShotGoalsAgainst = team.guardedNonShotGoalsAgainst + team.emptyNetNonShotGoalsAgainst;
    const target = selected.length === 1 ? roles.get(selected[0].roleId)! : zeroGoalie();
    if (r.starterRoleId === selected[0]?.roleId) { pStart += m.weight; accumulate(startTotals, target, m.weight); }
    else if (target.seconds > 0) { pRelief += m.weight; accumulate(reliefTotals, target, m.weight); }
    else pNone += m.weight;
    accumulate(goalieTotals, target, m.weight); accumulate(teamTotals, team, m.weight);
  }
  if (!equal(pStart + pRelief + pNone, 1)) add("invalid", "goalie_state_mass", "goalie");
  const conditional = (value: GoalieMean, mass: number) => mass === 0 ? null : scaled(value, 1 / mass);
  const g = q.pGamePlayed ?? 0, credit = q.pCreditGivenPlayed ?? 0;
  const bundle: Bundle = { hits: { conditionalHits: credit === 0 ? null : hitMean, conditionalSeconds: credit === 0 ? null : hitSeconds,
    pooledHitsPerSecond: credit > 0 && q.hitRepresentation === "count_and_pooled_rate" && hitSeconds > 0 ? hitMean / hitSeconds : null,
    unconditionalHits: g * credit * hitMean, unconditionalSeconds: g * credit * hitSeconds },
    goalie: { pStartGivenPlayed: pStart, pReliefOnlyGivenPlayed: pRelief, pNoAppearanceGivenPlayed: pNone,
      givenStart: conditional(startTotals, pStart), givenReliefOnly: conditional(reliefTotals, pRelief), unconditional: scaled(goalieTotals, g) },
    teamGivenPlayed: teamTotals, teamUnconditional: scaled(teamTotals, g) };
  function finite(value: unknown): boolean {
    return value === null || typeof value === "number" && Number.isFinite(value) && value >= 0
      || typeof value === "object" && value !== null && Object.values(value).every(finite);
  }
  if (!finite(bundle)) add("invalid", "nonfinite_arithmetic", "bundle");
  return finish(bundle);
}

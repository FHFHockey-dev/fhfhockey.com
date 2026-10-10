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
const counts = z.object({ HITS: count.nullable(), SHOTS_AGAINST_GOALIE: count.nullable(), SAVES_GOALIE: count.nullable(),
  GOALS_AGAINST_GOALIE: count.nullable(), nonShotGoalsAgainst: count.nullable() }).strict();
const proof = z.object({ proofId: text, bodyUtf8: z.string().min(1).max(2000000), bodyHash: hash,
  // Publication and receipt refer to this exact completed-game body revision.
  publishedAt: timestamp.nullable(), firstReceivedAt: timestamp, verifiedAt: timestamp,
  access: z.enum(["available", "restricted", "unknown"]), rights: z.enum(["verified_for_intended_use", "restricted", "unknown"]) }).strict();
/** v2 admits independently bound observations; omitted contract preserves frozen v1 archival semantics. */
export const NATIVE_COVERAGE_PROOF_VERSION = "native-coverage-proof-v2";
const pointer = z.string().min(1).max(2000).regex(/^\//);
const reference = z.object({ proofId: text, bodyHash: hash, pointer }).strict();
const finalGame = z.object({ historicalGameId: id, seasonId: id, teamId: id,
  gameIdPointer: pointer, seasonIdPointer: pointer, teamIdPointer: pointer,
  finalStatePointer: pointer, finalStateValue: z.enum(["FINAL", "OFF", "final"]) }).strict();
const completionFact = z.object({ historicalGameId: id, seasonId: id, teamId: id, pointer,
  kind: z.enum(["completion_lower", "completion_upper", "completion_exact"]), at: timestamp }).strict();
const rawObservation = z.object({ proofId: text, bodyUtf8: z.string().min(1).max(4000000), bodyHash: hash,
  sourceSemanticVersion: text, sourceSemanticHash: hash, origin: z.string().url().max(2000), revision: text,
  httpStatus: z.literal(200), requestedAt: timestamp, firstReceivedAt: timestamp, verifiedAt: timestamp,
  publishedAt: timestamp.nullable(), access: z.enum(["available", "restricted", "unknown"]),
  rights: z.enum(["verified_for_intended_use", "restricted", "unknown"]), finalGames: z.array(finalGame).max(20000), completionFacts: z.array(completionFact).max(20000) }).strict();
export const nativeCoverageRawObservationSchema = rawObservation;
export type NativeCoverageRawObservation = z.infer<typeof rawObservation>;
const observationTag = { version: z.literal(NATIVE_COVERAGE_PROOF_VERSION), mode: z.literal("prospective_public_observation") };
const rawProof = rawObservation.extend({ ...observationTag, evidenceType: z.literal("raw_official") }).strict();
const transformation = z.object({ version: text, codeHash: hash, configHash: hash, semanticHash: hash }).strict();
const link = reference.extend({ derivedPointer: pointer }).strict();
const derivedProof = z.object({ ...observationTag, evidenceType: z.literal("derived_normalized"), proofId: text,
  bodyUtf8: z.string().min(1).max(4000000), bodyHash: hash, createdAt: timestamp, verifiedAt: timestamp,
  // A local derivative has no upstream publication or HTTP receipt of its own.
  publishedAt: z.null(), firstReceivedAt: z.null(), transformation,
  contributors: z.array(rawObservation).min(1).max(1000), links: z.array(link).min(1).max(20000) }).strict();
export const NATIVE_COVERAGE_SPAN_PROOF_VERSION = "native-coverage-proof-v3";
export const nativeCoverageSourceLocationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("json_pointer"), pointer }).strict(),
  z.object({ kind: z.literal("utf8_byte_span"), startByte: z.number().int().nonnegative().safe(),
    endByteExclusive: z.number().int().positive().safe(), spanHash: hash }).strict(),
]);
export type NativeCoverageSourceLocation = z.infer<typeof nativeCoverageSourceLocationSchema>;
const spanLink = z.object({ proofId: text, bodyHash: hash, location: nativeCoverageSourceLocationSchema,
  derivedPointer: pointer }).strict();
const spanDerivedProof = derivedProof.extend({ version: z.literal(NATIVE_COVERAGE_SPAN_PROOF_VERSION),
  links: z.array(spanLink).min(1).max(20000) }).strict();
export type NativeCoverageSpanProof = z.infer<typeof spanDerivedProof>;
const archivalProof = proof.extend({ version: z.literal(NATIVE_COVERAGE_PROOF_VERSION), mode: z.literal("archival_exact") }).strict();
export const nativeCoverageProofSchema = z.union([proof, archivalProof, rawProof, derivedProof, spanDerivedProof]);
export const nativeCoverageProofExpectationSchema = z.union([
  archivalProof.omit({ bodyUtf8: true }), rawProof.omit({ bodyUtf8: true }),
  derivedProof.omit({ bodyUtf8: true }).extend({ contributors: z.array(rawObservation.omit({ bodyUtf8: true })).min(1).max(1000) }).strict(),
  spanDerivedProof.omit({ bodyUtf8: true }).extend({ contributors: z.array(rawObservation.omit({ bodyUtf8: true })).min(1).max(1000) }).strict(),
]);
const finalReference = z.object({ proofId: text, bodyHash: hash, historicalGameId: id, seasonId: id, teamId: id }).strict();
const boundEvidence = z.union([
  z.object({ kind: z.literal("final_body_receipt"), proofId: text, bodyHash: hash }).strict(),
  reference.extend({ kind: z.literal("timestamp_field") }).strict(),
]);
const completion = z.union([
  z.object({ kind: z.literal("exact_instant"), completedAt: timestamp, evidence: reference, finalEvidence: finalReference }).strict(),
  z.object({ kind: z.literal("supported_bounds"), completedAt: z.null(), completedNoEarlierThan: timestamp.nullable(),
    lowerEvidence: reference.nullable(), completedNoLaterThan: timestamp, upperEvidence: boundEvidence,
    finalEvidence: finalReference }).strict(),
]);
export const nativeCoverageHistoryFields = { completedAt: timestamp.nullable(), completion: completion.optional() };
const historyEvidence = z.object({ historicalGameId: id, ...nativeCoverageHistoryFields }).strict();
const completionSelection = z.object({ windowStartInclusive: timestamp, windowEndExclusive: timestamp,
  latestCount: id, censusComplete: z.boolean().nullable(), census: z.array(historyEvidence).max(20000).nullable() }).strict();
const selectionPopulation = z.union([
  z.object({ kind: z.literal("credited_skater_games"), identity }).strict(),
  z.object({ kind: z.literal("defending_team_games"), teamId: id }).strict(),
]);
const fixtureKeyEvidence = z.object({ sourceKind: z.enum(["fixture", "box", "pbp"]), finalEvidence: finalReference,
  gameDatePointer: pointer, declaredStartPointer: pointer }).strict();
const fixtureRevision = z.union([
  z.object({ kind: z.literal("as_declared_snapshot") }).strict(),
  z.object({ kind: z.literal("reviewed_reschedule"), dispositionHash: hash,
    originalKeys: z.array(fixtureKeyEvidence).min(1).max(20) }).strict(),
  z.object({ kind: z.literal("unresolved_exception") }).strict(),
]);
const fixtureSelectionRow = historyEvidence.extend({ seasonId: id, historicalTeamId: id,
  gameDate: z.string().max(10).nullable(), declaredStartUTC: timestamp.nullable(),
  keyEvidence: z.array(fixtureKeyEvidence).min(1).max(20).nullable(), revision: fixtureRevision }).strict();
const fixtureSelection = z.object({ version: z.literal("native-coverage-selection-c2-v1"),
  chronology: z.literal("declared_fixture_date_start_id_desc"), researchDispositionHash: hash, censusDispositionHash: hash,
  population: selectionPopulation, windowStartInclusive: timestamp, windowEndExclusive: timestamp,
  latestCount: id, censusComplete: z.boolean().nullable(), census: z.array(fixtureSelectionRow).max(20000).nullable() }).strict();
export const nativeCoverageSelectionSchema = z.union([completionSelection, fixtureSelection]);
export type NativeCoverageSelectionPopulation = z.infer<typeof selectionPopulation>;
type CoverageProof = z.infer<typeof nativeCoverageProofSchema>;
type CoverageExpectation = z.infer<typeof nativeCoverageProofExpectationSchema>;
type HistoryEvidence = z.infer<typeof historyEvidence>;
type ProofFinding = (kind: "invalid" | "unknown", code: string) => void;
const prospective = (value: CoverageProof): value is z.infer<typeof rawProof> | z.infer<typeof derivedProof> | NativeCoverageSpanProof =>
  "mode" in value && value.mode === "prospective_public_observation";
const rawSources = (value: CoverageProof): z.infer<typeof rawObservation>[] => !prospective(value) ? []
  : value.evidenceType === "raw_official" ? [value] : value.contributors;
function jsonValue(bodyUtf8: string, path: string): unknown {
  try {
    let value: unknown = JSON.parse(bodyUtf8);
    for (const key of path.slice(1).split("/").map(value => value.replace(/~1/g, "/").replace(/~0/g, "~"))) {
      if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  } catch { return undefined; }
}
/** Locations prove original-byte integrity, never the meaning of an HTML field. */
export function nativeCoverageLocationValue(bodyUtf8: string, location: NativeCoverageSourceLocation): unknown {
  if (!nativeCoverageSourceLocationSchema.safeParse(location).success) return undefined;
  if (location.kind === "json_pointer") return jsonValue(bodyUtf8, location.pointer);
  const bytes = Buffer.from(bodyUtf8, "utf8");
  if (bytes.toString("utf8") !== bodyUtf8 || location.startByte >= location.endByteExclusive
    || location.endByteExclusive > bytes.length) return undefined;
  const span = bytes.subarray(location.startByte, location.endByteExclusive), decoded = span.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(Uint8Array.from(span)) || nativeCoverageTextHash(decoded) !== location.spanHash) return undefined;
  return decoded;
}
// Canonical metadata comparison ignores object key ordering, never byte hashes or array ordering.
function metadata(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(metadata).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${metadata(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
export function nativeCoverageProofBindingHash(value: unknown): string {
  return nativeCoverageTextHash(metadata(value));
}
function withoutBytes(value: CoverageProof): unknown {
  const { bodyUtf8: _bytes, ...rest } = value;
  return prospective(value) && value.evidenceType === "derived_normalized"
    ? { ...rest, contributors: value.contributors.map(({ bodyUtf8: _rawBytes, ...item }) => item) } : rest;
}
/** Shared only by the disconnected checker and kernel. The caller controls the expectation independently. */
export function checkNativeCoverageProof(value: CoverageProof, expected: CoverageExpectation | undefined,
  cutoff: string, add: ProofFinding): void {
  if (("version" in value) !== (expected !== undefined) || expected && metadata(withoutBytes(value)) !== metadata(expected))
    add("invalid", "proof_contract_binding");
  if (!prospective(value)) {
    if (value.publishedAt === null) add("unknown", "unknown_publication_time");
    else if (time(value.publishedAt) > time(value.firstReceivedAt)) add("invalid", "source_chronology");
    if (time(value.firstReceivedAt) > time(value.verifiedAt) || time(value.verifiedAt) > time(cutoff)) add("invalid", "future_or_reversed_information");
    if (value.access !== "available" || value.rights !== "verified_for_intended_use") add("unknown", "unverified_access_or_rights");
    return;
  }
  const raws = rawSources(value);
  if (nativeCoverageTextHash(value.bodyUtf8) !== value.bodyHash) add("invalid", "proof_body_binding");
  if (new Set(raws.map(item => item.proofId)).size !== raws.length) add("invalid", "duplicate_raw_observation");
  for (const raw of raws) {
    if (nativeCoverageTextHash(raw.bodyUtf8) !== raw.bodyHash) add("invalid", "raw_body_binding");
    if (time(raw.requestedAt) > time(raw.firstReceivedAt) || time(raw.firstReceivedAt) > time(raw.verifiedAt)
      || time(raw.verifiedAt) > time(cutoff)) add("invalid", "observation_chronology");
    if (raw.publishedAt !== null && time(raw.publishedAt) > time(raw.firstReceivedAt)) add("invalid", "source_chronology");
    if (raw.access !== "available" || raw.rights !== "verified_for_intended_use") add("unknown", "unverified_access_or_rights");
    if (new Set(raw.finalGames.map(item => `${item.historicalGameId}:${item.teamId}`)).size !== raw.finalGames.length)
      add("invalid", "duplicate_final_game");
    for (const fact of raw.completionFacts) {
      const field = jsonValue(raw.bodyUtf8, fact.pointer);
      if (typeof field !== "string" || !timestamp.safeParse(field).success || time(field) !== time(fact.at)
        || !raw.finalGames.some(game => game.historicalGameId === fact.historicalGameId && game.seasonId === fact.seasonId && game.teamId === fact.teamId))
        add("invalid", "completion_fact_binding");
    }
    for (const game of raw.finalGames) {
      if (jsonValue(raw.bodyUtf8, game.gameIdPointer) !== game.historicalGameId
        || jsonValue(raw.bodyUtf8, game.seasonIdPointer) !== game.seasonId
        || jsonValue(raw.bodyUtf8, game.teamIdPointer) !== game.teamId
        || jsonValue(raw.bodyUtf8, game.finalStatePointer) !== game.finalStateValue) add("invalid", "final_body_identity");
    }
  }
  if (value.evidenceType === "derived_normalized") {
    if (value.version === NATIVE_COVERAGE_SPAN_PROOF_VERSION
      && new Set(value.links.map(metadata)).size !== value.links.length) add("invalid", "duplicate_derived_link");
    if (raws.some(raw => raw.proofId === value.proofId || raw.bodyHash === value.bodyHash)) add("invalid", "derived_self_link");
    if (time(value.createdAt) > time(value.verifiedAt) || time(value.verifiedAt) > time(cutoff)
      || raws.some(raw => time(raw.firstReceivedAt) > time(value.createdAt) || time(raw.verifiedAt) > time(value.verifiedAt)))
      add("invalid", "derived_chronology");
    const normalizedRows = jsonValue(value.bodyUtf8, "/rows");
    if (Array.isArray(normalizedRows) && normalizedRows.some((_, i) => !value.links.some(ref =>
      ref.derivedPointer === `/rows/${i}` || ref.derivedPointer.startsWith(`/rows/${i}/`)))) add("invalid", "unlinked_derived_row");
    for (const ref of value.links) {
      const raw = raws.find(item => item.proofId === ref.proofId && item.bodyHash === ref.bodyHash);
      const sourceValue = raw && ("location" in ref ? nativeCoverageLocationValue(raw.bodyUtf8, ref.location) : jsonValue(raw.bodyUtf8, ref.pointer));
      if (!raw || sourceValue === undefined || jsonValue(value.bodyUtf8, ref.derivedPointer) === undefined)
        add("invalid", "derived_pointer_binding");
    }
    if (raws.some(raw => !value.links.some(ref => ref.proofId === raw.proofId && ref.bodyHash === raw.bodyHash)))
      add("invalid", "unlinked_contributor");
  }
}
export function checkNativeCoverageHistory(row: HistoryEvidence, value: CoverageProof, targetGameId: number,
  teamId: number, cutoff: string, add: ProofFinding): { lower: bigint | null; upper: bigint } | null {
  if (!prospective(value)) {
    if (row.completedAt === null || row.completion) { add("invalid", "archival_completion_required"); return null; }
    if (row.historicalGameId === targetGameId || time(row.completedAt) >= time(cutoff)) add("invalid", "future_history");
    if (time(row.completedAt) > time(value.firstReceivedAt)
      || value.publishedAt !== null && time(row.completedAt) > time(value.publishedAt)) add("invalid", "completed_history_unavailable");
    return { lower: time(row.completedAt), upper: time(row.completedAt) };
  }
  const c = row.completion;
  if (!c) { add("unknown", "unknown_completion_evidence"); return null; }
  const raws = rawSources(value), final = c.finalEvidence;
  const raw = raws.find(item => item.proofId === final.proofId && item.bodyHash === final.bodyHash);
  if (row.historicalGameId !== final.historicalGameId || final.teamId !== teamId
    || !raw?.finalGames.some(item => item.historicalGameId === final.historicalGameId && item.seasonId === final.seasonId && item.teamId === teamId))
    add("invalid", "completion_final_binding");
  const fieldTime = (ref: z.infer<typeof reference>, instant: string, kind: z.infer<typeof completionFact>["kind"]) => {
    const source = raws.find(item => item.proofId === ref.proofId && item.bodyHash === ref.bodyHash);
    const field = source && jsonValue(source.bodyUtf8, ref.pointer);
    return typeof field === "string" && timestamp.safeParse(field).success && time(field) === time(instant)
      && !!source?.completionFacts.some(fact => fact.pointer === ref.pointer && fact.kind === kind && time(fact.at) === time(instant)
        && fact.historicalGameId === final.historicalGameId && fact.seasonId === final.seasonId && fact.teamId === final.teamId);
  };
  let lower: bigint | null, upper: bigint;
  if (c.kind === "exact_instant") {
    if (row.completedAt === null || time(row.completedAt) !== time(c.completedAt) || !fieldTime(c.evidence, c.completedAt, "completion_exact"))
      add("invalid", "unsupported_exact_completion");
    lower = upper = time(c.completedAt);
  } else {
    if (row.completedAt !== null) add("invalid", "bounds_exact_completion_not_null");
    lower = c.completedNoEarlierThan === null ? null : time(c.completedNoEarlierThan); upper = time(c.completedNoLaterThan);
    if ((c.completedNoEarlierThan === null) !== (c.lowerEvidence === null)
      || c.completedNoEarlierThan !== null && c.lowerEvidence !== null && !fieldTime(c.lowerEvidence, c.completedNoEarlierThan, "completion_lower")) add("invalid", "unsupported_completion_lower");
    const e = c.upperEvidence;
    if (e.kind === "final_body_receipt" ? !raw || e.proofId !== final.proofId || e.bodyHash !== final.bodyHash
      || time(raw.firstReceivedAt) !== upper : !fieldTime(e, c.completedNoLaterThan, "completion_upper")) add("invalid", "unsupported_completion_upper");
    if (lower !== null && lower > upper) add("invalid", "reversed_completion_bounds");
  }
  if (row.historicalGameId === targetGameId || upper >= time(cutoff)) add("invalid", "future_history");
  if (raw && (upper > time(raw.firstReceivedAt) || raw.publishedAt !== null && lower !== null && lower > time(raw.publishedAt)))
    add("invalid", "completed_history_unavailable");
  return { lower, upper };
}
/** Optional explicit selection contract, never a default window/count or receipt-based ordering. */
export function checkNativeCoverageSelection(selection: z.infer<typeof nativeCoverageSelectionSchema> | undefined,
  rows: HistoryEvidence[], value: CoverageProof, targetGameId: number, teamId: number, cutoff: string, add: ProofFinding,
  context?: { population: NativeCoverageSelectionPopulation; observedPopulation: NativeCoverageSelectionPopulation;
    contract?: CoverageExpectation }): Map<number, number> | undefined {
  if (!selection) return;
  if ("version" in selection) return checkFixtureSelection(selection, rows, value, targetGameId, cutoff, add, context);
  const start = time(selection.windowStartInclusive), end = time(selection.windowEndExclusive);
  if (start >= end || end > time(cutoff)) add("invalid", "selection_window");
  if (selection.censusComplete !== true || selection.census === null) { add("unknown", "unknown_selection_census"); return; }
  const selected = new Set(rows.map(row => row.historicalGameId)), censusIds = selection.census.map(row => row.historicalGameId);
  if (new Set(censusIds).size !== censusIds.length || [...selected].some(gameId => !censusIds.includes(gameId))) add("invalid", "selection_census_binding");
  const inside: { gameId: number; lower: bigint; upper: bigint }[] = [];
  for (const row of selection.census) {
    const interval = checkNativeCoverageHistory(row, value, targetGameId, teamId, cutoff, add);
    if (!interval) continue;
    for (const actual of rows.filter(item => item.historicalGameId === row.historicalGameId))
      if (metadata({ completedAt: actual.completedAt, completion: actual.completion }) !== metadata({ completedAt: row.completedAt, completion: row.completion }))
        add("invalid", "selection_completion_binding");
    if (interval.upper < start || interval.lower !== null && interval.lower >= end) {
      if (selected.has(row.historicalGameId)) add("invalid", "selected_outside_window");
    } else if (interval.lower === null || interval.lower < start || interval.upper >= end) add("unknown", "unknown_window_membership");
    else inside.push({ gameId: row.historicalGameId, lower: interval.lower, upper: interval.upper });
  }
  if (inside.length < selection.latestCount || selected.size < selection.latestCount) add("unknown", "insufficient_selection_census");
  if (selected.size > selection.latestCount) add("invalid", "selection_count");
  for (const chosen of inside.filter(item => selected.has(item.gameId))) for (const other of inside.filter(item => !selected.has(item.gameId))) {
    if (chosen.upper < other.lower) add("invalid", "not_latest_selection");
    else if (chosen.lower <= other.upper) add("unknown", "unknown_selection_order");
  }
}

/** Opt-in research chronology. A failed admission never supplies historical-team authority. */
function checkFixtureSelection(selection: z.infer<typeof fixtureSelection>, rows: HistoryEvidence[], value: CoverageProof,
  targetGameId: number, cutoff: string, add: ProofFinding,
  context: { population: NativeCoverageSelectionPopulation; observedPopulation: NativeCoverageSelectionPopulation;
    contract?: CoverageExpectation } | undefined): Map<number, number> | undefined {
  let admitted = true;
  const fail: ProofFinding = (kind, code) => { admitted = false; add(kind, code); };
  if (!context || metadata(context.population) !== metadata(selection.population)
    || metadata(context.observedPopulation) !== metadata(selection.population)) fail("invalid", "selection_population_binding");
  if (!prospective(value)) { fail("invalid", "c2_prospective_evidence_required"); return; }
  checkNativeCoverageProof(value, context?.contract, cutoff, fail);
  const start = time(selection.windowStartInclusive), end = time(selection.windowEndExclusive);
  if (start >= end || end > time(cutoff)) fail("invalid", "selection_window");
  if (selection.censusComplete !== true || selection.census === null) { fail("unknown", "unknown_selection_census"); return; }
  const census = selection.census, selected = new Set(rows.map(row => row.historicalGameId));
  if (new Set(census.map(row => row.historicalGameId)).size !== census.length
    || [...selected].some(gameId => !census.some(row => row.historicalGameId === gameId))) fail("invalid", "selection_census_binding");
  const raws = rawSources(value), teams = new Map<number, number>();
  const inside: { gameId: number; date: string; declaredStart: bigint }[] = [];
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const boundKey = (ref: z.infer<typeof fixtureKeyEvidence>, row: z.infer<typeof fixtureSelectionRow>) => {
    const final = ref.finalEvidence, raw = raws.find(item => item.proofId === final.proofId && item.bodyHash === final.bodyHash);
    const game = raw?.finalGames.find(item => item.historicalGameId === row.historicalGameId
      && item.seasonId === row.seasonId && item.teamId === row.historicalTeamId);
    const parent = game?.gameIdPointer.slice(0, game.gameIdPointer.lastIndexOf("/"));
    if (!raw || !game || final.historicalGameId !== row.historicalGameId || final.seasonId !== row.seasonId
      || final.teamId !== row.historicalTeamId || game.seasonIdPointer.slice(0, game.seasonIdPointer.lastIndexOf("/")) !== parent
      || game.finalStatePointer.slice(0, game.finalStatePointer.lastIndexOf("/")) !== parent || !game.teamIdPointer.startsWith(`${parent}/`)
      || ref.gameDatePointer.slice(0, ref.gameDatePointer.lastIndexOf("/")) !== parent
      || ref.declaredStartPointer.slice(0, ref.declaredStartPointer.lastIndexOf("/")) !== parent) {
      fail("invalid", "fixture_key_identity_binding"); return null;
    }
    const date = jsonValue(raw.bodyUtf8, ref.gameDatePointer), declaredStart = jsonValue(raw.bodyUtf8, ref.declaredStartPointer);
    if (typeof date !== "string" || !validDate(date) || typeof declaredStart !== "string" || !timestamp.safeParse(declaredStart).success) {
      fail("invalid", "fixture_source_key"); return null;
    }
    return { date, declaredStart: time(declaredStart) };
  };
  for (const row of census) {
    if (selection.population.kind === "defending_team_games" && row.historicalTeamId !== selection.population.teamId)
      fail("invalid", "selection_historical_team_binding");
    if (row.completion && row.completion.finalEvidence.seasonId !== row.seasonId) fail("invalid", "completion_final_binding");
    checkNativeCoverageHistory(row, value, targetGameId, row.historicalTeamId, cutoff, fail);
    for (const actual of rows.filter(item => item.historicalGameId === row.historicalGameId))
      if (metadata({ completedAt: actual.completedAt, completion: actual.completion }) !== metadata({ completedAt: row.completedAt, completion: row.completion }))
        fail("invalid", "selection_completion_binding");
    if (row.revision.kind === "unresolved_exception") fail("unknown", "unresolved_fixture_revision");
    if (row.keyEvidence === null || row.declaredStartUTC === null) { fail("unknown", "unknown_fixture_key"); continue; }
    const keys = row.keyEvidence.map(ref => boundKey(ref, row));
    if (!row.keyEvidence.some(ref => ref.sourceKind === "fixture")) fail("invalid", "fixture_key_source_required");
    if (keys.some(key => key && key.declaredStart !== time(row.declaredStartUTC!))) fail("invalid", "fixture_key_conflict");
    if (row.revision.kind === "reviewed_reschedule") {
      const originals = row.revision.originalKeys.map(ref => boundKey(ref, row));
      if (!row.revision.originalKeys.some(ref => ref.sourceKind === "fixture") || originals.some(key => !key)
        || originals.some(key => key && originals[0] && (key.date !== originals[0].date || key.declaredStart !== originals[0].declaredStart)))
        fail("invalid", "fixture_original_revision_binding");
    }
    if (row.gameDate !== null) {
      if (!validDate(row.gameDate)) fail("invalid", "fixture_date");
      if (keys.some(key => key && key.date !== row.gameDate)) fail("invalid", "fixture_key_conflict");
    }
    const declaredStart = time(row.declaredStartUTC);
    if (declaredStart < start || declaredStart >= end) {
      if (selected.has(row.historicalGameId)) fail("invalid", "selected_outside_window");
      continue;
    }
    if (row.gameDate === null) { fail("unknown", "unknown_fixture_key"); continue; }
    if (selected.has(row.historicalGameId) && !["fixture", "box", "pbp"].every(kind => row.keyEvidence!.some(ref => ref.sourceKind === kind)))
      fail("unknown", "selected_fixture_key_sources_required");
    if (selected.has(row.historicalGameId) && row.keyEvidence.some(ref => row.keyEvidence!.some(other =>
      other.sourceKind !== ref.sourceKind && other.finalEvidence.proofId === ref.finalEvidence.proofId)))
      fail("invalid", "fixture_key_source_alias");
    inside.push({ gameId: row.historicalGameId, date: row.gameDate, declaredStart });
    teams.set(row.historicalGameId, row.historicalTeamId);
  }
  inside.sort((a, b) => a.date !== b.date ? a.date > b.date ? -1 : 1
    : a.declaredStart !== b.declaredStart ? a.declaredStart > b.declaredStart ? -1 : 1 : b.gameId - a.gameId);
  if (inside.length < selection.latestCount || selected.size < selection.latestCount) fail("unknown", "insufficient_selection_census");
  if (selected.size > selection.latestCount) fail("invalid", "selection_count");
  if (metadata([...selected].sort((a, b) => a - b)) !== metadata(inside.slice(0, selection.latestCount).map(row => row.gameId).sort((a, b) => a - b)))
    fail("invalid", "not_latest_selection");
  return admitted ? teams : undefined;
}

const scope = z.object({ gameId: id, seasonId: id, teamIds: z.tuple([id, id]), scheduledAt: timestamp,
  asOf: timestamp, assessedAt: timestamp, modelCutoffAt: timestamp, featureCutoffAt: timestamp,
  skater: identity, goalie: identity,
  proofs: z.array(z.object({ proofId: text, bodyHash: hash,
    // Supplied separately by the caller, never inferred from the evidence packet's rows.
    expectedRows: z.array(rowKey).max(20000).nullable(), contract: nativeCoverageProofExpectationSchema.optional(),
    selection: nativeCoverageSelectionSchema.optional() }).strict()).max(2) }).strict();
export type NativePlayerCoverageScope = z.infer<typeof scope>;
const row = rowKey.extend({ ...nativeCoverageHistoryFields, exposureSeconds: count.max(3900).nullable(),
  counts }).strict();
const body = z.object({ gameId: id, seasonId: id, identity, domain,
  rows: z.array(row).max(20000), unclassifiedEvents: count.nullable(), unclassifiedSeconds: count.nullable() }).strict();
export const nativeCoverageHistoryBodySchema = body;
export type NativeCoverageHistoryBody = z.infer<typeof body>;
const goalieStats = z.object({ SHOTS_AGAINST_GOALIE: count.nullable(), SAVES_GOALIE: count.nullable(),
  GOALS_AGAINST_GOALIE: count.nullable(), nonShotGoalsAgainst: count.nullable(), seconds: count.max(3900).nullable() }).strict();
const skater = z.object({ identity, model, coverage: nativeCoverageProofSchema.nullable(), pCreditGivenPlayed: probability,
  pDressGivenPlayed: probability, pPositiveMinutesGivenPlayed: probability,
  conditionalBasis: z.literal(bases.skater), conditionalHits: count.nullable(), unconditionalHits: count.nullable(),
  conditionalSeconds: count.max(3900).nullable(), unconditionalSeconds: count.max(3900).nullable() }).strict();
const goalie = z.object({ identity, model, coverage: nativeCoverageProofSchema.nullable(), pStartGivenPlayed: probability,
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
  function checkProof(value: z.infer<typeof nativeCoverageProofSchema> | null, actor: z.infer<typeof identity>, population: keyof typeof bases, targets: Category[]) {
    if (!value) { add("unknown", population === "skater" ? "missing_whole_play_hit_coverage" : "missing_guarded_shot_spell_coverage", `${population}.coverage`, targets); return; }
    if (usedProofs.has(value.proofId)) add("invalid", "duplicate_proof", `${population}.coverage`, targets);
    usedProofs.add(value.proofId);
    const expected = s.proofs.find(item => item.proofId === value.proofId);
    if (!expected || expected.bodyHash !== value.bodyHash || nativeCoverageTextHash(value.bodyUtf8) !== value.bodyHash)
      add("invalid", "proof_hash_or_scope_mismatch", `${population}.coverage`, targets);
    checkNativeCoverageProof(value, expected?.contract, s.modelCutoffAt,
      (kind, code) => add(kind, code, `${population}.coverage`, targets));
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
    const c2 = expected?.selection && "version" in expected.selection;
    const historicalTeams = c2 ? checkNativeCoverageSelection(expected.selection, b.rows, value, s.gameId, actor.teamId, s.modelCutoffAt,
      (kind, code) => add(kind, code, `${population}.coverage`, targets), { contract: expected.contract,
        population: population === "skater" ? { kind: "credited_skater_games", identity: actor }
          : { kind: "defending_team_games", teamId: actor.teamId },
        observedPopulation: population === "skater" ? { kind: "credited_skater_games", identity: b.identity }
          : { kind: "defending_team_games", teamId: b.identity.teamId } }) : undefined;
    let exposure = 0;
    for (const r of b.rows) {
      if (c2 && !historicalTeams?.has(r.historicalGameId)) add("unknown", "unadmitted_c2_history_team", `${population}.coverage`, targets);
      else checkNativeCoverageHistory(r, value, s.gameId, historicalTeams?.get(r.historicalGameId) ?? actor.teamId, s.modelCutoffAt,
        (kind, code) => add(kind, code, `${population}.coverage`, targets));
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
    if (!c2) checkNativeCoverageSelection(expected?.selection, b.rows, value, s.gameId, actor.teamId, s.modelCutoffAt,
      (kind, code) => add(kind, code, `${population}.coverage`, targets));
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

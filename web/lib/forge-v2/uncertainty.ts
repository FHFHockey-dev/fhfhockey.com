import { ArtifactReference, CATEGORIES, Category, Component, Interval, QualificationManifest, ScoringProfile, Target, Vintage, available, unavailable, assertArtifact, assertTarget, instant } from "./contracts";
import { contentHash } from "./hash.server";
import { scoringProfile, targetKey } from "./identity";
import { QualificationEvidence, assessQualification } from "./qualification";
import { CandidateModel, ModelAvailability, ModelContext, modelAvailableAtCutoff, predictConditional } from "./model";

export const JOINT_SCHEMA = "weighted-joint-counts-v1";
export const JOINT_DECODER = "weighted-joint-decoder-v1";
export const INTERVAL_CALCULATION = "left-cdf-equal-tail-v1";
export const JOINT_ALGORITHM = "empirical-kernel-joint-v1";
export interface JointDistribution extends Target {
  schemaVersion: typeof JOINT_SCHEMA;
  inputCutoffAt: string;
  modelVersion: string;
  modelArtifactHash: string;
  algorithmVersion: typeof JOINT_ALGORITHM;
  categories: Category[];
  outcomes: Array<{ probability: number; values: Partial<Record<Category, number>> }>;
}
export interface CalibrationArtifact extends ModelAvailability {
  schemaVersion: "profile-tail-padding-v1";
  calculationVersion: typeof INTERVAL_CALCULATION;
  modelVersion: string;
  profileId: string;
  horizon: number;
  cohort: string;
  protocolId: string;
  sampleIds: string[];
  evidence: "development_only";
  padding: Array<{ level: 0.5 | 0.9; lower: number; upper: number }>;
}
export interface PinnedArtifact<T> { reference: ArtifactReference; payload: T }

/** Resample entire observed outcome vectors, preserving their empirical dependence. */
export function predictJoint(model: CandidateModel, context: ModelContext, categories: Category[]): Component<JointDistribution> {
  if (!categories.length || categories.some(c => !CATEGORIES.includes(c)) || new Set(categories).size !== categories.length) return unavailable("invalid_joint_categories");
  const prediction = predictConditional(model, context);
  if (categories.some(c => prediction.means[c].state !== "available")) return unavailable("joint_head_unavailable");
  const rows = model.training.filter(row => row.appearance === "official_appearance" && row.gameId !== context.gameId && instant(row.outcomeAvailableAt) < instant(context.inputCutoffAt) && categories.every(c => row.values[c].state === "available") && model.recipe.featureNames.every(name => row.features[name]?.state === "available"));
  const weighted = rows.map(row => ({ row, weight: Math.exp(-model.recipe.featureNames.reduce((sum, name) => sum + (((row.features[name] as { value: number }).value - (context.features[name] as { value: number }).value) / model.recipe.bandwidth) ** 2, 0) / 2) })).filter(r => Number.isFinite(r.weight) && r.weight > 0);
  if (weighted.length < model.recipe.minimumSupport) return unavailable("sparse_joint_history");
  const mass = weighted.reduce((sum, r) => sum + r.weight, 0);
  const joint: JointDistribution = { playerId: context.playerId, gameId: context.gameId, seasonId: context.seasonId, targetVersion: context.targetVersion, conditioning: context.conditioning, schemaVersion: JOINT_SCHEMA, inputCutoffAt: context.inputCutoffAt, modelVersion: model.version, modelArtifactHash: contentHash(model), algorithmVersion: JOINT_ALGORITHM, categories, outcomes: weighted.map(({ row, weight }) => ({ probability: weight / mass, values: Object.fromEntries(categories.map(c => [c, (row.values[c] as { value: number }).value])) })) };
  try { validateJoint(joint); return available(joint); } catch { return unavailable("invalid_joint_support"); }
}

export function validateJoint(joint: JointDistribution): void {
  assertTarget(joint); instant(joint.inputCutoffAt);
  if (joint.schemaVersion !== JOINT_SCHEMA || joint.algorithmVersion !== JOINT_ALGORITHM || !/^[a-f0-9]{64}$/.test(joint.modelArtifactHash) || !joint.modelVersion || !joint.categories.length || new Set(joint.categories).size !== joint.categories.length || joint.categories.some(c => !CATEGORIES.includes(c)) || !joint.outcomes.length) throw new Error("Invalid joint representation");
  if (joint.categories.includes("PPP") && (!joint.categories.includes("G") || !joint.categories.includes("A"))) throw new Error("PPP requires joint G and A");
  let probability = 0;
  for (const row of joint.outcomes) {
    if (!Number.isFinite(row.probability) || row.probability <= 0 || row.probability > 1) throw new Error("Invalid joint probability");
    probability += row.probability;
    if (Object.keys(row.values).some(c => !joint.categories.includes(c as Category)) || joint.categories.some(c => !Number.isInteger(row.values[c]) || row.values[c]! < 0)) throw new Error("Incomplete joint count outcome");
    if (joint.categories.includes("PPP") && row.values.PPP! > row.values.G! + row.values.A!) throw new Error("PPP exceeds G+A in joint outcome");
  }
  if (Math.abs(probability - 1) > 1e-12) throw new Error("Joint probability mass must sum to one");
}

/** Left-continuous inverse CDF convention is pinned, including ties and discrete outcomes. */
function quantile(rows: Array<{ value: number; probability: number }>, q: number): number {
  const ordered = [...rows].sort((a, b) => a.value - b.value);
  let mass = 0;
  for (const row of ordered) { mass += row.probability; if (mass + 1e-12 >= q) return row.value; }
  return ordered[ordered.length - 1].value;
}

/** Arithmetic only: empirical bands are never presented as calibrated without qualification. */
export function scoreJoint(joint: JointDistribution, profile: ScoringProfile): Component<{ mean: number; intervals: Interval[] }> {
  try { validateJoint(joint); if (scoringProfile(profile.weights).id !== profile.id || profile.ruleVersion !== "linear-seven-v1") return unavailable("scoring_identity_mismatch"); }
  catch { return unavailable("invalid_joint_or_profile"); }
  if (CATEGORIES.some(c => profile.weights[c] !== 0 && !joint.categories.includes(c))) return unavailable("missing_contributing_joint_category");
  const rows = joint.outcomes.map(row => ({ probability: row.probability, value: CATEGORIES.reduce((sum, c) => sum + (profile.weights[c] === 0 ? 0 : profile.weights[c] * row.values[c]!), 0) }));
  if (rows.some(r => !Number.isFinite(r.value))) return unavailable("nonfinite_joint_score");
  return available({ mean: rows.reduce((sum, row) => sum + row.probability * row.value, 0), intervals: ([0.5, 0.9] as const).map(level => ({ level, lower: quantile(rows, (1 - level) / 2), upper: quantile(rows, (1 + level) / 2) })) });
}

export interface CalibrationObservation {
  id: string; target: Target; partition: "calibration"; gameStartAt: string; inputCutoffAt: string; outcomeAvailableAt: string; intervals: Interval[]; actual: number;
  modelVersion: string; profileId: string; horizon: number; cohort: string;
}
export interface CalibrationProtocol { id: string; registeredAt: string; independentlyReviewed: boolean; admissibleIds: string[]; admissibleHashes: Record<string, string>; startAt: string; endAt: string; fittedAt: string; availableAt: string; minimumSupport: number }

/** Fits finite-sample tail padding on supplied chronological calibration observations only.
 * No iid/exchangeability or public calibration claim is made by this development artifact. */
export function fitIntervalCalibration(rows: CalibrationObservation[], protocol: CalibrationProtocol, applicability: Pick<CalibrationArtifact, "modelVersion" | "profileId" | "horizon" | "cohort">): Component<CalibrationArtifact> {
  if (!protocol.independentlyReviewed || !protocol.id || instant(protocol.registeredAt) >= instant(protocol.startAt) || instant(protocol.startAt) >= instant(protocol.endAt) || instant(protocol.endAt) >= instant(protocol.fittedAt) || instant(protocol.availableAt) < instant(protocol.fittedAt) || !Number.isInteger(protocol.minimumSupport) || protocol.minimumSupport < 1) throw new Error("Invalid calibration protocol");
  if (new Set(rows.map(r => r.id)).size !== rows.length || new Set(rows.map(r => targetKey(r.target))).size !== rows.length) throw new Error("Repeated calibration target");
  for (const row of rows) {
    assertTarget(row.target);
    if (row.partition !== "calibration" || !protocol.admissibleIds.includes(row.id) || protocol.admissibleHashes[row.id] !== contentHash(row) || instant(row.inputCutoffAt) >= instant(row.gameStartAt) || instant(row.gameStartAt) < instant(protocol.startAt) || instant(row.outcomeAvailableAt) <= instant(row.gameStartAt) || instant(row.outcomeAvailableAt) >= instant(protocol.endAt) || row.modelVersion !== applicability.modelVersion || row.profileId !== applicability.profileId || row.horizon !== applicability.horizon || row.cohort !== applicability.cohort || !Number.isFinite(row.actual) || row.intervals.length !== 2 || ([0.5, 0.9] as const).some(level => row.intervals.filter(i => i.level === level).length !== 1) || row.intervals.some(i => !Number.isFinite(i.lower) || !Number.isFinite(i.upper) || i.lower > i.upper)) throw new Error("Inadmissible calibration observation");
  }
  if (rows.length < protocol.minimumSupport) return unavailable("sparse_interval_calibration");
  const padding = ([0.5, 0.9] as const).map(level => {
    const errors = rows.map(row => ({ actual: row.actual, interval: row.intervals.find(i => i.level === level)! }));
    const q = (1 + level) / 2;
    // Finite sample rank; if support cannot estimate the requested tail, refuse it.
    const rank = Math.ceil((rows.length + 1) * q);
    if (rank > rows.length) return null;
    const lower = errors.map(e => Math.max(0, e.interval.lower - e.actual)).sort((a, b) => a - b)[rank - 1];
    const upper = errors.map(e => Math.max(0, e.actual - e.interval.upper)).sort((a, b) => a - b)[rank - 1];
    return { level, lower, upper };
  });
  if (padding.some(p => p === null)) return unavailable("insufficient_tail_support");
  return available({ schemaVersion: "profile-tail-padding-v1", calculationVersion: INTERVAL_CALCULATION, ...applicability, fittedAt: protocol.fittedAt, availableAt: protocol.availableAt, dependencyAvailableAt: new Date(Math.max(...rows.map(row => instant(row.outcomeAvailableAt)))).toISOString(), protocolId: protocol.id, sampleIds: rows.map(r => r.id).sort(), evidence: "development_only", padding: padding as CalibrationArtifact["padding"] });
}

function verifyPin<T>(artifact: PinnedArtifact<T>, expected: ArtifactReference, vintage: Vintage, profile: ScoringProfile, manifest: QualificationManifest): boolean {
  try {
    assertArtifact(artifact.reference);
    const reference = artifact.reference;
    const fixedDependency = reference.kind !== "calibration" || manifest.artifactHashes.includes(reference.sha256);
    return contentHash(reference) === contentHash(expected) && contentHash(artifact.payload) === reference.sha256 && fixedDependency && reference.decoderVersion === JOINT_DECODER && reference.calculationVersion === INTERVAL_CALCULATION && reference.horizons.includes(vintage.horizon) && reference.cohorts.includes(vintage.cohort) && reference.profileIds.includes(profile.id) && CATEGORIES.every(c => profile.weights[c] === 0 || reference.categories.includes(c));
  } catch { return false; }
}

export function reproduceIntervals(vintage: Vintage, profile: ScoringProfile, manifest: QualificationManifest | null, evidence: QualificationEvidence[], joint: PinnedArtifact<JointDistribution> | null, calibration: PinnedArtifact<CalibrationArtifact> | null): Component<Interval[]> {
  const decision = assessQualification(vintage, manifest, evidence, profile);
  if (decision.state !== "available") return decision;
  if (!manifest!.profileIds.includes(profile.id) || ![0.5, 0.9].every(level => manifest!.intervalLevels.includes(level as 0.5 | 0.9))) return unavailable("uncalibrated_profile_or_levels");
  if (!joint || !calibration || vintage.distribution.state !== "available" || vintage.calibration.state !== "available") return unavailable("required_artifact_unavailable");
  if (joint.reference.kind !== "joint_distribution" || calibration.reference.kind !== "calibration" || joint.reference.schemaVersion !== JOINT_SCHEMA || calibration.reference.schemaVersion !== "profile-tail-padding-v1" || !verifyPin(joint, vintage.distribution.value, vintage, profile, manifest!) || !verifyPin(calibration, vintage.calibration.value, vintage, profile, manifest!)) return unavailable("artifact_integrity_or_applicability_mismatch");
  if (targetKey(joint.payload) !== targetKey(vintage) || joint.payload.inputCutoffAt !== vintage.inputCutoffAt || joint.payload.modelVersion !== vintage.modelVersion || contentHash([...joint.payload.categories].sort()) !== contentHash([...joint.reference.categories].sort())) return unavailable("joint_target_or_model_mismatch");
  const generator = manifest!.jointGenerator;
  if (joint.payload.modelArtifactHash !== generator.modelArtifactHash || joint.payload.algorithmVersion !== generator.algorithmVersion || joint.reference.schemaVersion !== generator.schemaVersion || joint.reference.decoderVersion !== generator.decoderVersion || joint.reference.calculationVersion !== generator.calculationVersion) return unavailable("joint_generator_mismatch");
  const fitted = calibration.payload;
  const protocolId = evidence.find(record => record.id === manifest!.finalEvaluationId)?.payload.protocolId;
  if (fitted.schemaVersion !== "profile-tail-padding-v1" || fitted.calculationVersion !== INTERVAL_CALCULATION || fitted.profileId !== profile.id || fitted.modelVersion !== vintage.modelVersion || fitted.horizon !== vintage.horizon || fitted.cohort !== vintage.cohort || fitted.protocolId !== protocolId || !fitted.sampleIds.length || fitted.padding.length !== 2) return unavailable("calibration_applicability_mismatch");
  if (!modelAvailableAtCutoff(fitted, vintage.inputCutoffAt)) return unavailable("calibration_not_available_at_cutoff");
  const score = scoreJoint(joint.payload, profile);
  if (score.state !== "available") return score;
  for (const c of CATEGORIES.filter(c => profile.weights[c] !== 0)) {
    const mean = vintage.means[c];
    const jointMean = joint.payload.outcomes.reduce((sum, row) => sum + row.probability * row.values[c]!, 0);
    if (mean.state !== "available" || Math.abs(mean.value - jointMean) > 1e-10) return unavailable("joint_mean_mismatch");
  }
  const intervals: Interval[] = [];
  for (const interval of score.value.intervals) {
    const matches = fitted.padding.filter(p => p.level === interval.level);
    if (matches.length !== 1 || [matches[0].lower, matches[0].upper].some(v => !Number.isFinite(v) || v < 0)) return unavailable("invalid_calibration_padding");
    intervals.push({ level: interval.level, lower: interval.lower - matches[0].lower, upper: interval.upper + matches[0].upper });
  }
  if (intervals[1].lower > intervals[0].lower || intervals[1].upper < intervals[0].upper) return unavailable("non_nested_calibrated_intervals");
  return available(intervals);
}

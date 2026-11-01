import { Appearance, CATEGORIES, CategoryMeans, Component, CONDITIONING, Participation, QualificationManifest, Target, Vintage, available, assertSource, assertTarget, instant, unavailable } from "./contracts";
import { CandidateRecipe, FitProtocol, ModelAvailability, ModelContext, ModelExample, modelAvailableAtCutoff, partitionExamples } from "./model";
import { contentHash } from "./hash.server";
import { targetKey } from "./identity";
import { QualificationEvidence, qualifiedParticipation, assessQualification } from "./qualification";

export function participationLabel(appearance: Appearance): Component<0 | 1> {
  if (appearance === "official_appearance") return available(1);
  if (appearance === "nonappearance" || appearance === "dressed_unused") return available(0);
  return unavailable(appearance === "game_not_played" ? "condition_game_did_not_occur" : "ambiguous_appearance");
}
export interface AppearanceModel extends ModelAvailability {
  version: string;
  algorithm: "appearance-kernel-bin-calibration-v1";
  recipe: CandidateRecipe;
  training: ModelExample[];
  bins: Array<{ lower: number; upper: number; probability: number; count: number }>;
  evidence: "development_only";
  protocolHash: string;
  calibrationDataHash: string;
}
function rawProbability(model: Pick<AppearanceModel, "recipe" | "training">, context: ModelContext): Component<number> {
  try {
    assertTarget(context); instant(context.inputCutoffAt);
    if (!context.sources.length || !Number.isFinite(model.recipe.bandwidth) || model.recipe.bandwidth <= 0 || !Number.isInteger(model.recipe.minimumSupport) || model.recipe.minimumSupport < 1) throw new Error("Invalid participation inputs");
    context.sources.forEach(s => assertSource(s, context.inputCutoffAt));
  } catch { return unavailable("inadmissible_participation_context"); }
  const names = model.recipe.featureNames;
  if (names.some(name => context.features[name]?.state !== "available" || !Number.isFinite((context.features[name] as { value: number }).value))) return unavailable("missing_participation_features");
  let mass = 0, weighted = 0, count = 0;
  for (const row of model.training) {
    try { row.sources.forEach(s => assertSource(s, row.inputCutoffAt)); assertSource(row.outcomeSource, row.outcomeAvailableAt); }
    catch { return unavailable("inadmissible_participation_history"); }
    const label = participationLabel(row.appearance);
    if (label.state !== "available" || row.gameId === context.gameId || instant(row.outcomeAvailableAt) >= instant(context.inputCutoffAt) || names.some(name => row.features[name]?.state !== "available")) continue;
    const distance = names.reduce((sum, name) => sum + (((row.features[name] as { value: number }).value - (context.features[name] as { value: number }).value) / model.recipe.bandwidth) ** 2, 0);
    const weight = Math.exp(-distance / 2);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    mass += weight; weighted += weight * label.value; count++;
  }
  return count >= model.recipe.minimumSupport && mass > 0 ? available(weighted / mass) : unavailable("sparse_participation_history");
}

export interface ParticipationFitProtocol extends FitProtocol { participationCalibration: { recipeId: string; binCount: number; minimumBinSupport: number } }
export function fitParticipation(rows: ModelExample[], protocol: ParticipationFitProtocol): Component<AppearanceModel> {
  const { train, calibration } = partitionExamples(rows, protocol);
  const { recipeId, binCount, minimumBinSupport } = protocol.participationCalibration;
  const recipe = protocol.recipes.find(r => r.id === recipeId);
  if (!recipe || !Number.isFinite(recipe.bandwidth) || recipe.bandwidth <= 0 || recipe.minimumSupport < 1 || !recipe.featureNames.length || !Number.isInteger(binCount) || binCount < 1 || !Number.isInteger(minimumBinSupport) || minimumBinSupport < 1) throw new Error("Invalid registered participation recipe");
  const bins = Array.from({ length: binCount }, (_, i) => ({ lower: i / binCount, upper: (i + 1) / binCount, probability: 0, count: 0 }));
  for (const row of calibration) {
    if (instant(protocol.registeredAt) > instant(row.inputCutoffAt)) continue;
    const label = participationLabel(row.appearance), probability = rawProbability({ recipe, training: train }, { ...row, limitations: [] });
    if (label.state !== "available" || probability.state !== "available") continue;
    const bin = bins[Math.min(binCount - 1, Math.floor(probability.value * binCount))];
    bin.probability += label.value; bin.count++;
  }
  const supported = bins.filter(bin => bin.count >= minimumBinSupport).map(bin => ({ ...bin, probability: bin.probability / bin.count }));
  if (!supported.length) return unavailable("no_calibration_support");
  const availability = { fittedAt: protocol.fitAt, availableAt: protocol.availableAt, dependencyAvailableAt: new Date(Math.max(instant(protocol.registeredAt), ...[...train, ...calibration].map(row => instant(row.outcomeAvailableAt)))).toISOString() };
  const provenance = { protocolHash: contentHash(protocol), calibrationDataHash: contentHash(calibration) };
  return available({ version: contentHash({ recipe, train, supported, protocolId: protocol.id, availability, provenance }), algorithm: "appearance-kernel-bin-calibration-v1", recipe, training: train, bins: supported, evidence: "development_only", ...availability, ...provenance });
}

export function predictParticipation(model: AppearanceModel | null, context: ModelContext, verifiedStatus: Participation["verifiedStatus"] = "unknown"): Participation {
  let probability: Component<number> = unavailable("participation_model_unavailable");
  if (model?.algorithm === "appearance-kernel-bin-calibration-v1") {
    if (!modelAvailableAtCutoff(model, context.inputCutoffAt) || model.training.some(row => instant(row.outcomeAvailableAt) > instant(model.dependencyAvailableAt))) return { event: CONDITIONING, probability: unavailable("participation_model_not_available_at_cutoff"), verifiedStatus, modelVersion: model.version, qualificationId: null, evidenceIds: [] };
    const raw = rawProbability(model, context);
    if (raw.state === "available") {
      const bin = model.bins.find(b => raw.value >= b.lower && (raw.value < b.upper || b.upper === 1 && raw.value === 1));
      probability = bin && Number.isFinite(bin.probability) && bin.probability >= 0 && bin.probability <= 1 ? available(bin.probability) : unavailable("unsupported_participation_calibration_bin");
    } else probability = raw;
  }
  return { event: CONDITIONING, probability, verifiedStatus, modelVersion: model?.version ?? "unavailable", qualificationId: null, evidenceIds: [] };
}

export interface AdjustedMeans extends Target { inputCutoffAt: string; basis: "availability_adjusted_once"; means: CategoryMeans; participationVintageId: string; performanceVintageId: string }
export function availabilityAdjusted(performance: Vintage | AdjustedMeans, participation: Vintage, manifest: QualificationManifest | null, evidence: QualificationEvidence[]): Component<AdjustedMeans> {
  if ("basis" in performance) return unavailable("participation_already_applied");
  if (targetKey(performance) !== targetKey(participation) || performance.inputCutoffAt !== participation.inputCutoffAt || performance.horizon !== participation.horizon || performance.cohort !== participation.cohort) return unavailable("participation_identity_or_cutoff_mismatch");
  const qualified = assessQualification(performance, manifest, evidence);
  if (qualified.state !== "available") return qualified;
  const probability = qualifiedParticipation(participation, manifest, evidence);
  if (probability.state !== "available") return probability;
  const means = Object.fromEntries(CATEGORIES.map(category => {
    const mean = performance.means[category];
    return [category, manifest!.categories.includes(category) && mean.state === "available" ? available(mean.value * probability.value) : unavailable(mean.state === "unavailable" ? mean.reason : "unqualified_category")];
  })) as CategoryMeans;
  return available({ playerId: performance.playerId, gameId: performance.gameId, seasonId: performance.seasonId, targetVersion: performance.targetVersion, conditioning: performance.conditioning, inputCutoffAt: performance.inputCutoffAt, basis: "availability_adjusted_once", means, participationVintageId: participation.id, performanceVintageId: performance.id });
}

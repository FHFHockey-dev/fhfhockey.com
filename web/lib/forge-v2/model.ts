import { Appearance, CATEGORIES, Categories, CategoryMeans, Component, SourceReference, Target, available, unavailable, assertTarget, assertSource, instant } from "./contracts";
import { DEFAULT_SCORING, scoreMeans, targetKey } from "./identity";
import { contentHash } from "./hash.server";

export const MODEL_ALGORITHM = "official-appearance-kernel-means-v1";
export interface ModelExample extends Target {
  id: string;
  inputCutoffAt: string;
  gameStartAt: string;
  outcomeAvailableAt: string;
  appearance: Appearance;
  features: Record<string, Component<number>>;
  values: CategoryMeans;
  sources: SourceReference[];
  outcomeSource: SourceReference;
}
export interface ModelContext extends Target {
  inputCutoffAt: string;
  features: Record<string, Component<number>>;
  sources: SourceReference[];
  limitations: string[];
}
export interface CandidateRecipe {
  id: string;
  featureNames: string[];
  bandwidth: number;
  minimumSupport: number;
}
export interface FitProtocol {
  id: string;
  registeredAt: string;
  independentlyReviewed: boolean;
  admissibleIds: string[];
  admissibleHashes: Record<string, string>;
  trainEndAt: string;
  developmentEndAt: string;
  calibrationEndAt: string;
  fitAt: string;
  availableAt: string;
  recipes: CandidateRecipe[];
}
export interface ModelAvailability {
  fittedAt: string;
  availableAt: string;
  dependencyAvailableAt: string;
}
export interface CandidateModel extends ModelAvailability {
  algorithm: typeof MODEL_ALGORITHM;
  version: string;
  recipe: CandidateRecipe;
  training: ModelExample[];
  evidence: "development_only";
  protocolId: string;
  selection: { kind: "development_mse"; protocolHash: string; developmentDataHash: string };
}
export interface FitResult {
  model: CandidateModel;
  trials: Array<{ recipeId: string; evaluation: "predeclared_recipe_replay"; mse: Component<number>; paired: number; requested: number }>;
}

export function modelAvailableAtCutoff(model: ModelAvailability, cutoffAt: string): boolean {
  try {
    return instant(model.dependencyAvailableAt) <= instant(model.fittedAt) && instant(model.fittedAt) <= instant(model.availableAt) && instant(model.availableAt) <= instant(cutoffAt);
  } catch { return false; }
}

const emptyMeans = (reason: string): CategoryMeans => Object.fromEntries(CATEGORIES.map(c => [c, unavailable(reason)])) as CategoryMeans;
function validateExample(row: ModelExample): void {
  assertTarget(row);
  if (!row.id || !row.sources.length) throw new Error("Missing example provenance");
  if (instant(row.inputCutoffAt) >= instant(row.gameStartAt) || instant(row.outcomeAvailableAt) <= instant(row.gameStartAt)) throw new Error("Invalid example chronology");
  row.sources.forEach(s => assertSource(s, row.inputCutoffAt));
  assertSource(row.outcomeSource, row.outcomeAvailableAt);
  for (const category of CATEGORIES) {
    const value = row.values[category];
    if (!value || (value.state === "available" && (!Number.isInteger(value.value) || value.value < 0))) throw new Error("Invalid count outcome");
  }
  const { G, A, PPP } = row.values;
  if (G.state === "available" && A.state === "available" && PPP.state === "available" && PPP.value > G.value + A.value) throw new Error("PPP exceeds G+A");
}

/** Only caller-supplied admitted data is read; final periods are never consumed. */
export function partitionExamples(rows: ModelExample[], protocol: FitProtocol): { train: ModelExample[]; development: ModelExample[]; calibration: ModelExample[] } {
  const times = [protocol.registeredAt, protocol.trainEndAt, protocol.developmentEndAt, protocol.calibrationEndAt, protocol.fitAt].map(instant);
  if (!protocol.id || !protocol.independentlyReviewed || times.some((v, i) => i > 0 && v <= times[i - 1])) throw new Error("Unregistered or invalid chronological protocol");
  if (instant(protocol.availableAt) < times[4]) throw new Error("Model availability precedes fitting");
  if (new Set(rows.map(r => r.id)).size !== rows.length || new Set(rows.map(targetKey)).size !== rows.length) throw new Error("Repeated target rows require a frozen selector");
  const result = { train: [] as ModelExample[], development: [] as ModelExample[], calibration: [] as ModelExample[] };
  const games = new Map<number, string>();
  for (const row of rows) {
    validateExample(row);
    if (!protocol.admissibleIds.includes(row.id) || protocol.admissibleHashes[row.id] !== contentHash(row) || instant(row.outcomeAvailableAt) > times[4]) throw new Error("Unadmitted data or unavailable outcome");
    const start = instant(row.gameStartAt);
    const partition = start < times[1] ? "train" : start < times[2] ? "development" : start < times[3] ? "calibration" : null;
    if (!partition) throw new Error("Protected/final data is not accepted by local fitting");
    const end = partition === "train" ? times[1] : partition === "development" ? times[2] : times[3];
    if (instant(row.outcomeAvailableAt) >= end) throw new Error("Outcome crosses partition boundary");
    if (games.has(row.gameId) && games.get(row.gameId) !== partition) throw new Error("Shared game crosses partitions");
    games.set(row.gameId, partition);
    result[partition].push(row);
  }
  for (const partition of Object.values(result)) partition.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

function validateRecipe(recipe: CandidateRecipe): void {
  if (!recipe.id || !recipe.featureNames.length || new Set(recipe.featureNames).size !== recipe.featureNames.length || !Number.isFinite(recipe.bandwidth) || recipe.bandwidth <= 0 || !Number.isInteger(recipe.minimumSupport) || recipe.minimumSupport < 1) throw new Error("Invalid candidate recipe");
}

/** Arithmetic for predeclared recipe replay; it is not an as-issued fitted model. */
function predictRecipe(model: Pick<CandidateModel, "recipe" | "training" | "algorithm">, context: ModelContext): { means: CategoryMeans; support: Categories<number>; limitations: string[] } {
  assertTarget(context); validateRecipe(model.recipe);
  if (model.algorithm !== MODEL_ALGORITHM) throw new Error("Unsupported model algorithm");
  const support = Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Categories<number>;
  try { if (!context.sources.length) throw new Error("missing_sources"); context.sources.forEach(s => assertSource(s, context.inputCutoffAt)); }
  catch { return { means: emptyMeans("inadmissible_context"), support, limitations: [...context.limitations, "inadmissible_context"] }; }
  const names = model.recipe.featureNames;
  if (names.some(name => context.features[name]?.state !== "available" || !Number.isFinite((context.features[name] as { value: number }).value))) return { means: emptyMeans("missing_context_feature"), support, limitations: [...context.limitations, "missing_context_feature"] };
  const eligible = model.training.filter(row => {
    validateExample(row);
    return row.appearance === "official_appearance" && instant(row.outcomeAvailableAt) < instant(context.inputCutoffAt) && row.gameId !== context.gameId && names.every(name => row.features[name]?.state === "available" && Number.isFinite((row.features[name] as { value: number }).value));
  });
  const weighted = eligible.map(row => ({ row, weight: Math.exp(-names.reduce((sum, name) => sum + (((row.features[name] as { value: number }).value - (context.features[name] as { value: number }).value) / model.recipe.bandwidth) ** 2, 0) / 2) })).filter(row => row.weight > 0);
  const means = Object.fromEntries(CATEGORIES.map(category => {
    const usable = weighted.filter(({ row }) => row.values[category].state === "available");
    support[category] = usable.length;
    if (usable.length < model.recipe.minimumSupport) return [category, unavailable("sparse_category_history")];
    const mass = usable.reduce((sum, r) => sum + r.weight, 0);
    return [category, available(usable.reduce((sum, r) => sum + r.weight * (r.row.values[category] as { value: number }).value, 0) / mass)];
  })) as CategoryMeans;
  // Missingness can differ by head; retain the structural points constraint explicitly.
  if (means.PPP.state === "available") {
    if (means.G.state !== "available" || means.A.state !== "available") means.PPP = unavailable("missing_points_constraint_inputs");
    else means.PPP = available(Math.min(means.PPP.value, means.G.value + means.A.value));
  }
  return { means, support, limitations: [...context.limitations, "development_only"] };
}

/** Fitted-model inference enforces availability of selection and all fitted dependencies. */
export function predictConditional(model: CandidateModel, context: ModelContext): ReturnType<typeof predictRecipe> {
  if (!modelAvailableAtCutoff(model, context.inputCutoffAt) || model.training.some(row => instant(row.outcomeAvailableAt) > instant(model.dependencyAvailableAt))) return { means: emptyMeans("model_not_available_at_cutoff"), support: Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Categories<number>, limitations: [...context.limitations, "model_not_available_at_cutoff"] };
  return predictRecipe(model, context);
}

export function fitCandidate(rows: ModelExample[], protocol: FitProtocol): Component<FitResult> {
  const { train, development } = partitionExamples(rows, protocol);
  if (!protocol.recipes.length || new Set(protocol.recipes.map(r => r.id)).size !== protocol.recipes.length) throw new Error("Finite unique registered recipes required");
  const candidates = protocol.recipes.map(recipe => {
    validateRecipe(recipe);
    const availability = { fittedAt: protocol.fitAt, availableAt: protocol.availableAt, dependencyAvailableAt: new Date(Math.max(instant(protocol.registeredAt), ...[...train, ...development].map(row => instant(row.outcomeAvailableAt)))).toISOString() };
    const selection = { kind: "development_mse" as const, protocolHash: contentHash(protocol), developmentDataHash: contentHash(development) };
    const model: CandidateModel = { algorithm: MODEL_ALGORITHM, version: contentHash({ algorithm: MODEL_ALGORITHM, recipe, train, protocolId: protocol.id, availability, selection }), recipe, training: train, evidence: "development_only", protocolId: protocol.id, ...availability, selection };
    // Every recipe was frozen before these cutoffs. Replay scores recipe arithmetic;
    // the selected model above only becomes usable at its actual availableAt.
    const pairs = development.filter(r => r.appearance === "official_appearance").map(row => ({ actual: scoreMeans(row.values, DEFAULT_SCORING), predicted: instant(protocol.registeredAt) > instant(row.inputCutoffAt) ? unavailable("recipe_not_predeclared_at_cutoff") : scoreMeans(predictRecipe({ algorithm: MODEL_ALGORITHM, recipe, training: train }, { ...row, limitations: ["predeclared_recipe_replay_not_as_issued"] }).means, DEFAULT_SCORING) }));
    const usable = pairs.filter(p => p.actual.state === "available" && p.predicted.state === "available");
    const mse = usable.length ? available(usable.reduce((sum, p) => sum + ((p.actual as { value: number }).value - (p.predicted as { value: number }).value) ** 2, 0) / usable.length) : unavailable("no_paired_development_support");
    return { model, trial: { recipeId: recipe.id, evaluation: "predeclared_recipe_replay" as const, mse, paired: usable.length, requested: pairs.length } };
  });
  // Comparing recipes on unequal populations invites selection bias; do not select them.
  const eligible = candidates.filter(c => c.trial.mse.state === "available" && c.trial.paired === c.trial.requested && c.trial.requested > 0);
  eligible.sort((a, b) => (a.trial.mse as { value: number }).value - (b.trial.mse as { value: number }).value || a.trial.recipeId.localeCompare(b.trial.recipeId));
  return eligible.length ? available({ model: eligible[0].model, trials: candidates.map(c => c.trial) }) : unavailable("no_complete_matched_development_candidate");
}

export function buildBaselines(history: ModelExample[], context: ModelContext): { lastFive: CategoryMeans; seasonRate: CategoryMeans; appearances: number } {
  assertTarget(context); instant(context.inputCutoffAt);
  const rows = history.filter(r => r.playerId === context.playerId && r.gameId !== context.gameId && r.appearance === "official_appearance" && instant(r.outcomeAvailableAt) < instant(context.inputCutoffAt));
  rows.forEach(validateExample);
  if (new Set(rows.map(targetKey)).size !== rows.length) throw new Error("Baseline requires one settled revision per target");
  rows.sort((a, b) => instant(b.gameStartAt) - instant(a.gameStartAt) || a.gameId - b.gameId);
  const average = (selected: ModelExample[], required: number): CategoryMeans => Object.fromEntries(CATEGORIES.map(category => {
    if (selected.length < required) return [category, unavailable("sparse_appearance_history")];
    if (selected.some(r => r.values[category].state !== "available")) return [category, unavailable("incomplete_category_history")];
    return [category, available(selected.reduce((sum, r) => sum + (r.values[category] as { value: number }).value, 0) / selected.length)];
  })) as CategoryMeans;
  return { lastFive: average(rows.slice(0, 5), 5), seasonRate: average(rows.filter(row => row.seasonId === context.seasonId), 1), appearances: rows.length };
}

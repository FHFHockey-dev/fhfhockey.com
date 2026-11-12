import { nullableProjectionNumber } from "./contracts";
import {
  scoreProperForecast,
  type ProperForecastScore,
} from "./properScore";

/**
 * v2 (W3-5 F7/PR4/PR5, decision 65): per-row losses only (no per-row skill
 * index), probabilities outside [0, 1] rejected, unavailable intervals never
 * covered, unknown outcomes/forecasts unscored, and editorial deltas allocated
 * over the remaining-model manifest at issuance. v1 rows stay as issued
 * (rule 21); this version is their successor.
 */
export const FANTASY_PROJECTION_SCORING_VERSION =
  "player-forecast-season-accountability-v2";

const PROBABILITY_TARGETS = new Set(["GAMES_PLAYED", "GAMES_STARTED"]);

export type SeasonGameOutput = {
  schedule_game_id?: unknown;
  fhfh_player_id: unknown;
  population?: unknown;
  playing_probability?: unknown;
  start_probability?: unknown;
  unconditional_means?: Record<string, unknown> | null;
  baseline_unconditional_means?: Record<string, unknown> | null;
  quantiles?: { p10?: Record<string, unknown>; p90?: Record<string, unknown> } | null;
  component_hash?: unknown;
};

export type SeasonReleasePlayer = {
  adjustment_delta?: Record<string, unknown> | null;
  component_manifest?: unknown;
};

export function isSeasonProbabilityTarget(target: string): boolean {
  return PROBABILITY_TARGETS.has(target);
}

/** The model's per-game forecast for a target, or null when unknown. */
export function seasonModelGameForecast(
  output: SeasonGameOutput,
  target: string,
): number | null {
  if (target === "GAMES_STARTED") return nullableProjectionNumber(output.start_probability);
  if (target === "GAMES_PLAYED") return nullableProjectionNumber(output.playing_probability);
  return nullableProjectionNumber(output.unconditional_means?.[target]);
}

/**
 * Scores one season primitive for one game. Returns null (unscored) when the
 * outcome or forecast is unknown, or a probability is outside [0, 1].
 */
export function scoreSeasonPrimitive(args: {
  actual: unknown;
  forecast: unknown;
  baselineForecast: unknown;
  p10?: unknown;
  p90?: unknown;
  probability?: boolean;
}): ProperForecastScore | null {
  return scoreProperForecast({ ...args, probability: Boolean(args.probability) });
}

export type RemainingModelManifestEntry = {
  /** Remaining games named by the release player's component manifest. */
  games: number;
  /** Σ model per-game forecast over those games; null when any is unknown. */
  totals: Record<string, number | null>;
};

/**
 * The remaining-model manifest at issuance (W3-5 PR5): the release player's
 * `component_manifest` names the remaining games (and component hashes) whose
 * forecasts make up the issued season total. Totals sum only those
 * components, so games already played (actuals) never enter the allocation
 * base. A manifest component that is missing from `outputs` makes every total
 * unknown rather than silently smaller.
 */
export function buildRemainingModelManifest(args: {
  releasePlayer: SeasonReleasePlayer | undefined;
  outputs: ReadonlyArray<SeasonGameOutput>;
  gameIdForOutput: (output: SeasonGameOutput) => number | null;
  targets: readonly string[];
}): RemainingModelManifestEntry | null {
  const manifest = args.releasePlayer?.component_manifest;
  if (!Array.isArray(manifest) || manifest.length === 0) return null;
  const byGame = new Map<number, SeasonGameOutput>();
  for (const output of args.outputs) {
    const gameId = args.gameIdForOutput(output);
    if (gameId != null) byGame.set(gameId, output);
  }
  const components: Array<SeasonGameOutput | null> = manifest.map((entry) => {
    const gameId = Number((entry as Record<string, unknown> | null)?.gameId);
    const hash = (entry as Record<string, unknown> | null)?.componentHash;
    const output = Number.isSafeInteger(gameId) ? byGame.get(gameId) : undefined;
    return output && (hash == null || String(output.component_hash) === String(hash))
      ? output
      : null;
  });
  const totals: Record<string, number | null> = {};
  for (const target of args.targets) {
    let total = 0;
    let known = true;
    for (const component of components) {
      const value = component ? seasonModelGameForecast(component, target) : null;
      if (value === null) {
        known = false;
        break;
      }
      total += value;
    }
    totals[target] = known ? total : null;
  }
  return { games: manifest.length, totals };
}

/**
 * Allocates a season-total editorial delta to one remaining game in
 * proportion to that game's share of the remaining-model total, so the
 * published remaining games sum to model remaining + delta (conservation).
 * Returns null when the allocation base is unknown.
 */
export function allocateSeasonTotalAdjustment(args: {
  modelGameForecast: number | null;
  remainingModelTotal: number | null;
  remainingGames: number;
  adjustmentDelta: number | null;
}): number | null {
  if (args.modelGameForecast === null) return null;
  if (args.adjustmentDelta === null || args.adjustmentDelta === 0) {
    return args.modelGameForecast;
  }
  if (args.remainingModelTotal === null || !(args.remainingGames >= 1)) return null;
  const share = Math.abs(args.remainingModelTotal) > 1e-9
    ? args.modelGameForecast / args.remainingModelTotal
    : 1 / args.remainingGames;
  return args.modelGameForecast + args.adjustmentDelta * share;
}

export type SeasonOutputEvaluation = {
  modelLosses: Record<string, ProperForecastScore>;
  publishedLosses: Record<string, ProperForecastScore>;
  /** Target → reason it was not scored (never scored as 0). */
  unscoredTargets: Record<string, string>;
};

/**
 * Scores one completed-game output for every target: the model forecast and
 * the published (editorially allocated) forecast against the settled
 * outcome. Null primitive outcomes, unknown forecasts and unknown allocation
 * bases are unscored, not coerced to 0 (L15 nullable contract, rule 5).
 */
export function evaluateSeasonOutput(args: {
  output: SeasonGameOutput;
  outcomePrimitiveValues: Record<string, unknown> | null | undefined;
  releasePlayer: SeasonReleasePlayer | undefined;
  manifest: RemainingModelManifestEntry | null;
  targets: readonly string[];
}): SeasonOutputEvaluation {
  const modelLosses: Record<string, ProperForecastScore> = {};
  const publishedLosses: Record<string, ProperForecastScore> = {};
  const unscoredTargets: Record<string, string> = {};
  for (const target of args.targets) {
    const actual = nullableProjectionNumber(args.outcomePrimitiveValues?.[target]);
    if (actual === null) {
      unscoredTargets[target] = "outcome_unknown";
      continue;
    }
    const probability = isSeasonProbabilityTarget(target);
    const modelForecast = seasonModelGameForecast(args.output, target);
    const common = {
      actual,
      baselineForecast: args.output.baseline_unconditional_means?.[target],
      p10: args.output.quantiles?.p10?.[target],
      p90: args.output.quantiles?.p90?.[target],
      probability,
    };
    const model = scoreSeasonPrimitive({ ...common, forecast: modelForecast });
    if (!model) {
      unscoredTargets[target] = "forecast_unknown_or_invalid";
      continue;
    }
    modelLosses[target] = model;
    const rawDelta = args.releasePlayer?.adjustment_delta?.[target];
    const adjustmentDelta = rawDelta == null ? 0 : nullableProjectionNumber(rawDelta);
    const publishedForecast = allocateSeasonTotalAdjustment({
      modelGameForecast: modelForecast,
      remainingModelTotal: args.manifest?.totals[target] ?? null,
      remainingGames: args.manifest?.games ?? 0,
      adjustmentDelta,
    });
    const published = scoreSeasonPrimitive({ ...common, forecast: publishedForecast });
    if (published) publishedLosses[target] = published;
    else unscoredTargets[target] = "published_allocation_unavailable";
  }
  return { modelLosses, publishedLosses, unscoredTargets };
}

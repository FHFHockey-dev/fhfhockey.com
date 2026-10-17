import { BASELINE_CANDIDATE_POLICY as POLICY, baselineDefinitionHash, baselineProjectionSchemas,
  validBaselineSeasonId } from "./baselinePolicy";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import type { BaselineBoxscoreReceipt } from "./baselineSourceLineage";

export const BASELINE_RATE_POLICY_VERSION = "skater-baseline-rates-v1";
export const PRIOR_APPEARANCE_POLICY_VERSION = "native-prior-appearance-skater-rates-v1";
export const priorAppearanceDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({
  version: PRIOR_APPEARANCE_POLICY_VERSION, seasonId, legacyDefinitionHash: baselineDefinitionHash("skater", seasonId),
  population: "verified_immediate_prior_regular_season_positive_minutes", maximumAppearances: POLICY.previousAppearanceWindow,
  externalProjections: "none", countHeads: "unchanged_legacy_prior_means", toi: "arithmetic_mean_original_appearance_seconds_divided_by_60",
  toiMissingness: "every_selected_appearance_requires_verified_positive_minutes", participation: "not_supplied", populationCoverage: "unverified" });
export const CURRENT_APPEARANCE_POLICY_VERSION = "current-appearance-skater-rates-v1";
export const CURRENT_APPEARANCE_POLICY = Object.freeze({ version: CURRENT_APPEARANCE_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes", maximumAppearances: 20, decay: 0.9,
  targets: ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"],
  missingness: "missing_target_skips_numerator_and_denominator_with_original_appearance_age",
  prior: "none", participation: "not_supplied", populationCoverage: "unverified" });
export const currentAppearanceDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({ policy: CURRENT_APPEARANCE_POLICY, seasonId });

export type BaselineProjectionInput = {
  sourceId: string;
  sourceRowId: string;
  sourceTable?: string;
  sourceContentHash?: string;
  sourcePayload?: Record<string, any>;
  seasonId: number;
  availableAt: string;
  projectedAppearances: number;
  totals: Record<string, number | null | undefined>;
};

export type BaselineAppearanceInput = {
  gameId: number;
  seasonId: number;
  gameDate: string;
  availableAt: string;
  teamId: number;
  regularSeason: boolean;
  finalBoxscore?: { payloadHash: string; fetchedAt: string };
  targets: Record<string, number | null | undefined>;
};

export type BaselineTargetRate = {
  targetKey: string;
  ratePerAppearance: number;
  consensusRate: number | null;
  previousSeasonRate: number | null;
  recentAppearanceCount: number;
  sourceRows: Array<{ sourceId: string; rowId: string; availableAt: string }>;
  sourceRowIds: string[];
  previousObservations: Array<{ gameId: number; teamId: number; gameDate: string; availableAt: string;
    finalBoxscore?: BaselineAppearanceInput["finalBoxscore"] }>;
  recentObservations: Array<{ gameId: number; teamId: number; gameDate: string; availableAt: string;
    finalBoxscore?: BaselineAppearanceInput["finalBoxscore"] }>;
  previousGameIds: number[];
  recentGameIds: number[];
  missingSourceIds: string[];
};

export type SkaterBaselineRateSnapshot = {
  policyVersion: typeof BASELINE_RATE_POLICY_VERSION | typeof CURRENT_APPEARANCE_POLICY_VERSION | typeof PRIOR_APPEARANCE_POLICY_VERSION;
  definitionHash: string;
  validation: "unvalidated";
  playerId: number;
  nhlPlayerId: number;
  seasonId: number;
  cutoffAt: string;
  sourceWatermark: string;
  targets: BaselineTargetRate[];
  limitations: string[];
  missingSourceIds: string[];
  missingTargetKeys: string[];
};

const ADDITIVE_SKATER_TARGETS = new Set(baselineProjectionSchemas("skater", 20262027)
  .flatMap((source) => source.statMappings.map((mapping) => mapping.key)));

const validTarget = (value: number | null | undefined, targetKey: string): value is number =>
  value != null && Number.isFinite(value) && (POLICY.negativeTargets.includes(targetKey) || value >= 0);

function rateBoxscoreReference(value: NonNullable<BaselineAppearanceInput["finalBoxscore"]>) {
  const retained = value as Partial<BaselineBoxscoreReceipt>;
  return { payloadHash: value.payloadHash, fetchedAt: value.fetchedAt,
    ...(retained.contentHash && retained.rawRow?.id != null
      ? { contentHash: retained.contentHash, rawRowId: retained.rawRow.id } : {}) };
}

/** A pure, cutoff-safe candidate. Inputs must retain their original availability timestamps. */
export function buildSkaterBaselineRates(input: {
  playerId: number;
  nhlPlayerId: number;
  seasonId: number;
  cutoffAt: string;
  sourceWatermark: string;
  projections: BaselineProjectionInput[];
  appearances: BaselineAppearanceInput[];
  limitations?: string[];
}): SkaterBaselineRateSnapshot {
  if (!Number.isInteger(input.playerId) || !Number.isInteger(input.nhlPlayerId)
    || !validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt))
    || !input.sourceWatermark) throw new Error("Baseline identity, cutoff and source watermark are required.");
  const schemas = new Map(baselineProjectionSchemas("skater", input.seasonId).map(row => [row.id, row]));
  const projections = input.projections.filter((row) =>
    row.seasonId === input.seasonId && Number.isFinite(Date.parse(row.availableAt))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && !!schemas.get(row.sourceId)?.tableName
    && (row.sourceTable == null || row.sourceTable === schemas.get(row.sourceId)?.tableName)
    && Number.isFinite(row.projectedAppearances) && row.projectedAppearances > 0);
  if (new Set(projections.map((row) => row.sourceId)).size !== projections.length) {
    throw new Error("Baseline requires one immutable row per approved source.");
  }
  const availableGames = input.appearances.filter((row) => row.regularSeason
    && Number.isFinite(Date.parse(row.availableAt)) && Number.isFinite(Date.parse(row.gameDate))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && (row.gameDate < input.cutoffAt.slice(0, 10)
      || row.gameDate === input.cutoffAt.slice(0, 10)
        && !!row.finalBoxscore && /^[a-f0-9]{64}$/i.test(row.finalBoxscore.payloadHash)
        && Number.isFinite(Date.parse(row.finalBoxscore.fetchedAt))
        && Date.parse(row.finalBoxscore.fetchedAt) <= Date.parse(input.cutoffAt))
    && [input.seasonId, input.seasonId - 10001].includes(row.seasonId))
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(availableGames.map((row) => row.gameId)).size !== availableGames.length) {
    throw new Error("Baseline appearances must have unique canonical game IDs.");
  }
  const previous = availableGames.filter((row) => row.seasonId === input.seasonId - 10001)
    .slice(0, POLICY.previousAppearanceWindow);
  const recent = availableGames.filter((row) => row.seasonId === input.seasonId)
    .slice(0, POLICY.recentAppearanceWindow);
  const targetKeys = new Set([
    ...projections.flatMap((row) => Object.keys(row.totals)),
    ...previous.flatMap((row) => Object.keys(row.targets)),
    ...recent.flatMap((row) => Object.keys(row.targets)),
  ]);
  const targets: BaselineTargetRate[] = [];
  for (const targetKey of [...targetKeys].filter((key) => ADDITIVE_SKATER_TARGETS.has(key)).sort()) {
    const sourceRows = projections.filter((row) => schemas.get(row.sourceId)!.statMappings
      .some(mapping => mapping.key === targetKey) && validTarget(row.totals[targetKey], targetKey));
    const consensusRate = sourceRows.length
      ? sourceRows.reduce((sum, row) => sum + row.totals[targetKey]! / row.projectedAppearances, 0) / sourceRows.length
      : null;
    const previousRows = previous.filter((row) => validTarget(row.targets[targetKey], targetKey));
    const previousSeasonRate = previousRows.length
      ? previousRows.reduce((sum, row) => sum + row.targets[targetKey]!, 0) / previousRows.length : null;
    if (consensusRate == null && previousSeasonRate == null) continue;
    const prior = consensusRate != null && previousSeasonRate != null
      ? POLICY.projectionPriorWeight * consensusRate + POLICY.historyPriorWeight * previousSeasonRate
      : consensusRate ?? previousSeasonRate!;
    let weightedRecent = 0;
    let recentWeight = 0;
    const recentGameIds: number[] = [];
    const recentObservations: BaselineTargetRate["recentObservations"] = [];
    // Missing targets contribute no value or weight; decay retains their appearance age.
    for (const [index, row] of recent.entries()) {
      const value = row.targets[targetKey];
      if (!validTarget(value, targetKey)) continue;
      const weight = POLICY.recentDecay ** index;
      weightedRecent += weight * value;
      recentWeight += weight;
      recentGameIds.push(row.gameId);
      recentObservations.push({ gameId: row.gameId, teamId: row.teamId,
        gameDate: row.gameDate, availableAt: row.availableAt,
        ...(row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}) });
    }
    targets.push({
      targetKey,
      ratePerAppearance: (POLICY.priorAppearanceWeight * prior + weightedRecent)
        / (POLICY.priorAppearanceWeight + recentWeight),
      consensusRate,
      previousSeasonRate,
      recentAppearanceCount: recentGameIds.length,
      sourceRows: sourceRows.map((row) => ({ sourceId: row.sourceId,
        rowId: row.sourceRowId, availableAt: row.availableAt })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      sourceRowIds: sourceRows.map((row) => row.sourceRowId).sort(),
      previousObservations: previousRows.map((row) => ({ gameId: row.gameId, teamId: row.teamId,
        gameDate: row.gameDate, availableAt: row.availableAt,
        ...(row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}) })),
      recentObservations,
      previousGameIds: previousRows.map((row) => row.gameId),
      recentGameIds,
      missingSourceIds: POLICY.sourceIds.skater.filter(id => !sourceRows.some(row => row.sourceId === id)),
    });
  }
  return {
    policyVersion: BASELINE_RATE_POLICY_VERSION,
    definitionHash: baselineDefinitionHash("skater", input.seasonId),
    validation: "unvalidated",
    playerId: input.playerId,
    nhlPlayerId: input.nhlPlayerId,
    seasonId: input.seasonId,
    cutoffAt: input.cutoffAt,
    sourceWatermark: input.sourceWatermark,
    targets,
    missingSourceIds: POLICY.sourceIds.skater.filter(id => !projections.some(row => row.sourceId === id)),
    missingTargetKeys: [...ADDITIVE_SKATER_TARGETS].filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Unvalidated per-appearance rates; no participation, role, opponent or deployment adjustment.",
      "Missing projection sources are renormalized per target; missing ability priors leave targets unavailable.",
      `Candidate definition: ${baselineDefinitionHash("skater", input.seasonId)}.`, ...(input.limitations ?? [])],
  };
}

/** Native prior-only extension. Caller authenticates original boxscores before this
 * calculation; every retained opportunity must carry positive original minutes. */
export function buildPriorAppearanceSkaterRates(input: Parameters<typeof buildSkaterBaselineRates>[0]): SkaterBaselineRateSnapshot {
  if (input.projections.length || !input.appearances.length || input.appearances.length > POLICY.previousAppearanceWindow
    || input.appearances.some(row => row.seasonId !== input.seasonId - 10001 || !row.regularSeason
      || !Number.isFinite(Date.parse(row.availableAt)) || Date.parse(row.availableAt) > Date.parse(input.cutoffAt)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) || row.gameDate < `${String(input.seasonId - 10001).slice(0, 4)}-07-01`
      || row.gameDate >= `${String(input.seasonId).slice(0, 4)}-07-01`
      || !row.finalBoxscore || !Number.isSafeInteger((row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds)
      || (row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds <= 0
      || (row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds > 65 * 60)) {
    throw new Error("Prior appearance baseline requires bounded previous-season original positive minutes and no projections.");
  }
  const legacy = buildSkaterBaselineRates(input);
  const previous = [...input.appearances].sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  const minutes = previous.reduce((sum, row) => sum + (row.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds, 0) / (60 * previous.length);
  const target: BaselineTargetRate = { targetKey: "TIME_ON_ICE_PER_GAME", ratePerAppearance: minutes,
    consensusRate: null, previousSeasonRate: minutes, recentAppearanceCount: 0,
    sourceRows: [], sourceRowIds: [], previousGameIds: previous.map(row => row.gameId), recentGameIds: [], recentObservations: [],
    previousObservations: previous.map(row => ({ gameId: row.gameId, teamId: row.teamId, gameDate: row.gameDate,
      availableAt: row.availableAt, finalBoxscore: rateBoxscoreReference(row.finalBoxscore!) })),
    missingSourceIds: [...POLICY.sourceIds.skater] };
  return { ...legacy, policyVersion: PRIOR_APPEARANCE_POLICY_VERSION, definitionHash: priorAppearanceDefinitionHash(input.seasonId),
    targets: [...legacy.targets, target].sort((a, b) => a.targetKey.localeCompare(b.targetKey)),
    limitations: [...legacy.limitations, "Prior-only native extension adds arithmetic mean verified positive appearance minutes; count heads use unchanged legacy calculation.",
      "Selected prior history coverage is unverified; no current role, injury, participation or deployment adjustment."] };
}

/** Explicit current-season-only mean. Callers authenticate retained receipts before deriving TOI. */
export function buildCurrentAppearanceSkaterRates(input: Parameters<typeof buildSkaterBaselineRates>[0]): SkaterBaselineRateSnapshot {
  if (!Number.isSafeInteger(input.playerId) || input.playerId <= 0 || !Number.isSafeInteger(input.nhlPlayerId) || input.nhlPlayerId <= 0
    || !validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark
    || input.projections.length || input.appearances.length > 200) throw new Error("Current appearance baseline requires bounded native identities and no projections.");
  const cutoff = Date.parse(input.cutoffAt);
  const eligible = input.appearances.filter(row => row.seasonId === input.seasonId && row.regularSeason
    && Number.isFinite(Date.parse(row.availableAt)) && Date.parse(row.availableAt) <= cutoff
    && /^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) && row.gameDate <= input.cutoffAt.slice(0, 10)
    && !!row.finalBoxscore && Number.isFinite(Date.parse(row.finalBoxscore.fetchedAt))
    && Date.parse(row.finalBoxscore.fetchedAt) <= cutoff)
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(eligible.map(row => row.gameId)).size !== eligible.length) throw new Error("Current appearance game IDs must be unique.");
  const recent = eligible.slice(0, CURRENT_APPEARANCE_POLICY.maximumAppearances);
  const targets: BaselineTargetRate[] = [];
  for (const targetKey of CURRENT_APPEARANCE_POLICY.targets) {
    let numerator = 0, denominator = 0;
    const selected: BaselineAppearanceInput[] = [];
    for (const [index, row] of recent.entries()) {
      const value = row.targets[targetKey];
      if (!validTarget(value, targetKey)) continue;
      const weight = CURRENT_APPEARANCE_POLICY.decay ** index;
      numerator += weight * value; denominator += weight; selected.push(row);
    }
    if (!denominator) continue;
    targets.push({ targetKey, ratePerAppearance: numerator / denominator, consensusRate: null, previousSeasonRate: null,
      recentAppearanceCount: selected.length, sourceRows: [], sourceRowIds: [], previousObservations: [], previousGameIds: [], missingSourceIds: [],
      recentGameIds: selected.map(row => row.gameId), recentObservations: selected.map(row => ({ gameId: row.gameId,
        teamId: row.teamId, gameDate: row.gameDate, availableAt: row.availableAt,
        ...(row.finalBoxscore ? { finalBoxscore: rateBoxscoreReference(row.finalBoxscore) } : {}) })) });
  }
  return { policyVersion: CURRENT_APPEARANCE_POLICY_VERSION, definitionHash: currentAppearanceDefinitionHash(input.seasonId),
    validation: "unvalidated", playerId: input.playerId, nhlPlayerId: input.nhlPlayerId, seasonId: input.seasonId,
    cutoffAt: input.cutoffAt, sourceWatermark: input.sourceWatermark, targets, missingSourceIds: [],
    missingTargetKeys: CURRENT_APPEARANCE_POLICY.targets.filter(key => !targets.some(row => row.targetKey === key)),
    limitations: ["Unvalidated weighted current-season positive-minute appearance means; no prior or external projections.",
      "Selected history coverage is unverified; sparse support is retained explicitly and no participation probability is inferred.",
      "Whole-game boxscore counts include all strengths; TOI is verified positive appearance minutes. Missing targets remain unavailable.", ...(input.limitations ?? [])] };
}

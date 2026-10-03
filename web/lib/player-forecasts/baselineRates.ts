import { BASELINE_CANDIDATE_POLICY as POLICY, baselineDefinitionHash, baselineProjectionSchemas,
  validBaselineSeasonId } from "./baselinePolicy";
import type { BaselineBoxscoreReceipt } from "./baselineSourceLineage";

export const BASELINE_RATE_POLICY_VERSION = "skater-baseline-rates-v1";

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
  policyVersion: typeof BASELINE_RATE_POLICY_VERSION;
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

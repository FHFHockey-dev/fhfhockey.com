import type { SupabaseClient } from "@supabase/supabase-js";

import { BASELINE_CANDIDATE_POLICY as POLICY, baselineDefinitionHash,
  baselineProjectionSchemas, validBaselineSeasonId } from "./baselinePolicy";
import { contributionBundleChecksum, persistContributionBundle,
  type ContributionBundleManifest } from "./contributionStore";
import type { ContributionSource } from "./contributions";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { persistCapturedGoalieBaselineInputs, type CapturedGoalieInput } from "./goalieBaselineInputCapture";

export const GOALIE_BASELINE_POLICY_VERSION = "goalie-baseline-rates-v1";
const APPEARANCE_TARGETS = POLICY.goalieVolumeTargets;
const START_TARGETS = POLICY.goalieStartTargets;
const validCount = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value >= 0;
const validTime = (value: string) => Number.isFinite(Date.parse(value));

export type GoalieProjectionInput = {
  sourceId: string; sourceRowId: string; seasonId: number; availableAt: string;
  sourceTable?: string;
  sourceContentHash?: string; sourcePayload?: Record<string, any>;
  projectedAppearances: number; projectedStarts: number | null;
  totals: Record<string, number | null | undefined>;
};
export type GoalieAppearanceInput = {
  gameId: number; seasonId: number; gameDate: string; availableAt: string;
  teamId: number; regularSeason: boolean;
  finalBoxscore?: { payloadHash: string; fetchedAt: string };
  saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null;
  toiMinutes: number | null;
};
export type GoalieTargetRate = {
  targetKey: string; basis: "per_appearance" | "per_start"; rate: number;
  consensusRate: number | null; previousSeasonRate: number | null;
  sourceRows: Array<{ sourceId: string; rowId: string; availableAt: string }>;
  previousGameIds: number[]; recentGameIds: number[];
  missingSourceIds: string[];
};
export type GoalieBaselineRateSnapshot = {
  policyVersion: typeof GOALIE_BASELINE_POLICY_VERSION; validation: "unvalidated";
  definitionHash: string;
  playerId: number; nhlPlayerId: number; seasonId: number; cutoffAt: string;
  sourceWatermark: string; targets: GoalieTargetRate[]; limitations: string[];
  missingSourceIds: string[]; missingTargetKeys: string[];
};

/** Volume rates use appearances; outcome counts use starts only when projected starts are explicit. */
export function buildGoalieBaselineRates(input: {
  playerId: number; nhlPlayerId: number; seasonId: number; cutoffAt: string;
  sourceWatermark: string; projections: GoalieProjectionInput[]; appearances: GoalieAppearanceInput[];
  limitations?: string[];
}): GoalieBaselineRateSnapshot {
  if (!Number.isSafeInteger(input.playerId) || input.playerId <= 0
    || !Number.isSafeInteger(input.nhlPlayerId) || input.nhlPlayerId <= 0
    || !validBaselineSeasonId(input.seasonId)
    || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark) {
    throw new Error("Goalie baseline identity and cutoff are required.");
  }
  const schemas = new Map(baselineProjectionSchemas("goalie", input.seasonId).map(row => [row.id, row]));
  const projections = input.projections.filter((row) => row.seasonId === input.seasonId
    && !!schemas.get(row.sourceId)?.tableName
    && (row.sourceTable == null || row.sourceTable === schemas.get(row.sourceId)?.tableName)
    && Number.isFinite(Date.parse(row.availableAt))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && Number.isFinite(row.projectedAppearances) && row.projectedAppearances > 0
    && row.projectedAppearances <= POLICY.maximumGoalieProjectedAppearances);
  if (new Set(projections.map((row) => row.sourceId)).size !== projections.length) {
    throw new Error("Goalie baseline requires one row per approved source.");
  }
  const appearances = input.appearances.filter((row) => row.regularSeason
    && [input.seasonId, input.seasonId - 10001].includes(row.seasonId)
    && Number.isFinite(Date.parse(row.availableAt))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && (row.gameDate < input.cutoffAt.slice(0, 10)
      || row.gameDate === input.cutoffAt.slice(0, 10)
        && !!row.finalBoxscore && /^[a-f0-9]{64}$/i.test(row.finalBoxscore.payloadHash)
        && validTime(row.finalBoxscore.fetchedAt)
        && Date.parse(row.finalBoxscore.fetchedAt) <= Date.parse(input.cutoffAt)))
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(appearances.map((row) => row.gameId)).size !== appearances.length) {
    throw new Error("Goalie baseline appearances must have unique games.");
  }
  const previous = appearances.filter((row) => row.seasonId === input.seasonId - 10001)
    .slice(0, POLICY.previousAppearanceWindow);
  const recent = appearances.filter((row) => row.seasonId === input.seasonId)
    .slice(0, POLICY.recentAppearanceWindow);
  const targets: GoalieTargetRate[] = [];
  for (const targetKey of [...APPEARANCE_TARGETS, ...START_TARGETS]) {
    const basis = (START_TARGETS as readonly string[]).includes(targetKey) ? "per_start" : "per_appearance";
    const rows = projections.filter((row) => schemas.get(row.sourceId)!.statMappings
      .some(mapping => mapping.key === targetKey) && validCount(row.totals[targetKey])
      && (basis === "per_appearance" || !!schemas.get(row.sourceId)!.startColumn && row.projectedStarts != null
        && Number.isFinite(row.projectedStarts) && row.projectedStarts > 0
        && row.projectedStarts <= row.projectedAppearances));
    const rates = rows.map((row) => ({ row, rate: row.totals[targetKey]!
      / (basis === "per_start" ? row.projectedStarts! : row.projectedAppearances) }))
      .filter((item) => basis !== "per_start" || item.rate <= 1);
    const sourceRates = rates.map((item) => item.rate);
    const consensusRate = sourceRates.length
      ? sourceRates.reduce((sum, value) => sum + value, 0) / sourceRates.length : null;
    const value = (row: GoalieAppearanceInput) => targetKey === "SAVES_GOALIE" ? row.saves
      : targetKey === "GOALS_AGAINST_GOALIE" ? row.goalsAgainst
        : targetKey === "GOALIE_MINUTES" ? row.toiMinutes : row.shotsAgainst;
    const previousRows = basis === "per_appearance" ? previous.filter((row) => validCount(value(row))) : [];
    const previousSeasonRate = previousRows.length
      ? previousRows.reduce((sum, row) => sum + value(row)!, 0) / previousRows.length : null;
    if (consensusRate == null && previousSeasonRate == null) continue;
    const prior = consensusRate != null && previousSeasonRate != null
      ? POLICY.projectionPriorWeight * consensusRate + POLICY.historyPriorWeight * previousSeasonRate
      : consensusRate ?? previousSeasonRate!;
    let recentWeighted = 0;
    let recentWeight = 0;
    const recentGameIds: number[] = [];
    if (basis === "per_appearance") for (const [index, row] of recent.entries()) {
      const observation = value(row);
      if (!validCount(observation)) continue;
      const weight = POLICY.recentDecay ** index;
      recentWeighted += weight * observation;
      recentWeight += weight;
      recentGameIds.push(row.gameId);
    }
    targets.push({ targetKey, basis,
      rate: (POLICY.priorAppearanceWeight * prior + recentWeighted)
        / (POLICY.priorAppearanceWeight + recentWeight),
      consensusRate, previousSeasonRate,
      sourceRows: rates.map(({ row }) => ({ sourceId: row.sourceId,
        rowId: row.sourceRowId, availableAt: row.availableAt })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      previousGameIds: previousRows.map((row) => row.gameId), recentGameIds,
      missingSourceIds: POLICY.sourceIds.goalie.filter(id => !rates.some(item => item.row.sourceId === id)) });
  }
  return { policyVersion: GOALIE_BASELINE_POLICY_VERSION, validation: "unvalidated",
    definitionHash: baselineDefinitionHash("goalie", input.seasonId),
    playerId: input.playerId, nhlPlayerId: input.nhlPlayerId, seasonId: input.seasonId,
    cutoffAt: input.cutoffAt, sourceWatermark: input.sourceWatermark, targets,
    missingSourceIds: POLICY.sourceIds.goalie.filter(id => !projections.some(row => row.sourceId === id)),
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS]
      .filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Goalie rates are unvalidated. Starts and appearances have separate denominators.",
      "Historical game logs do not establish starts, wins or shutouts; those start rates use public projection totals only.",
      "Save percentage and GAA require aggregate saves/shots and goals-against/TOI components; they are not direct baseline targets.",
      "Missing projection sources are renormalized per target; missing ability priors leave targets unavailable.",
      `Candidate definition: ${baselineDefinitionHash("goalie", input.seasonId)}.`, ...(input.limitations ?? [])] };
}

export function buildGoalieContributionBundle(input: {
  seasonId: number; cutoffAt: string; issuedAt: string; expiresAt: string; scheduleRevision: string;
  snapshots: Array<{ snapshot: GoalieBaselineRateSnapshot; teamId: number; rosterRevision: string }>;
}): { manifest: ContributionBundleManifest; sources: ContributionSource[] } {
  if (!validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt))
    || !Number.isFinite(Date.parse(input.issuedAt)) || !Number.isFinite(Date.parse(input.expiresAt))
    || Date.parse(input.cutoffAt) > Date.parse(input.issuedAt)
    || Date.parse(input.issuedAt) >= Date.parse(input.expiresAt)
    || !input.scheduleRevision || !input.snapshots.length || input.snapshots.length > 20) {
    throw new Error("Goalie bundle requires bounded snapshots and valid times.");
  }
  const sources: ContributionSource[] = [];
  const players = new Set<number>();
  for (const { snapshot, teamId, rosterRevision } of input.snapshots) {
    if (players.has(snapshot.playerId) || snapshot.policyVersion !== GOALIE_BASELINE_POLICY_VERSION
      || snapshot.validation !== "unvalidated"
      || snapshot.definitionHash !== baselineDefinitionHash("goalie", input.seasonId)
      || snapshot.seasonId !== input.seasonId || snapshot.cutoffAt !== input.cutoffAt
      || !Number.isSafeInteger(snapshot.playerId) || snapshot.playerId <= 0
      || !Number.isSafeInteger(snapshot.nhlPlayerId) || snapshot.nhlPlayerId <= 0
      || !snapshot.sourceWatermark || !Number.isSafeInteger(teamId) || teamId <= 0
      || !rosterRevision) throw new Error("Goalie bundle snapshot identity is inconsistent.");
    players.add(snapshot.playerId);
    const targetKeys = new Set<string>();
    for (const target of snapshot.targets) {
      const expectedBasis = (START_TARGETS as readonly string[]).includes(target.targetKey) ? "per_start"
        : (APPEARANCE_TARGETS as readonly string[]).includes(target.targetKey) ? "per_appearance" : null;
      if (!expectedBasis || target.basis !== expectedBasis || targetKeys.has(target.targetKey)
        || !Number.isFinite(target.rate) || target.rate < 0
        || target.basis === "per_start" && target.rate > 1
        || target.sourceRows.some((row) => !validTime(row.availableAt)
          || Date.parse(row.availableAt) > Date.parse(input.cutoffAt))) {
        throw new Error("Goalie bundle target is invalid or after cutoff.");
      }
      targetKeys.add(target.targetKey);
      sources.push({ kind: "baseline",
        sourceId: `baseline:${playerForecastSourcePayloadHash({ snapshot, teamId, rosterRevision, targetKey: target.targetKey })}`,
        policyVersion: GOALIE_BASELINE_POLICY_VERSION, released: false,
        playerId: snapshot.playerId, nhlPlayerId: snapshot.nhlPlayerId,
        seasonId: snapshot.seasonId, teamId, targetKey: target.targetKey,
        unit: target.targetKey === "GOALIE_MINUTES" ? "minutes" : "count",
        basis: target.basis, mean: target.rate, participationIntegrated: false,
        cutoffAt: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
        sourceWatermark: snapshot.sourceWatermark, scheduleRevision: input.scheduleRevision,
        rosterRevision, limitations: snapshot.limitations });
    }
  }
  if (!sources.length) throw new Error("Goalie bundle contains no supported rates.");
  sources.sort((a, b) => a.playerId - b.playerId || a.targetKey.localeCompare(b.targetKey));
  const unsigned = { seasonId: input.seasonId, policyVersion: GOALIE_BASELINE_POLICY_VERSION,
    inputCutoff: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    sourceCount: sources.length,
    sourceWatermarks: [...new Set(sources.map((source) => source.sourceWatermark))].sort(),
    rosterRevisions: [...new Set(sources.map((source) => source.rosterRevision))].sort(),
    evaluationPolicyId: null, reviewId: null, released: false };
  return { sources, manifest: { ...unsigned,
    checksum: contributionBundleChecksum({ manifest: unsigned, sources }) } };
}

export async function dryRunGoalieContributionBundle(db: SupabaseClient<any>,
  input: Parameters<typeof buildGoalieContributionBundle>[0]) {
  const bundle = buildGoalieContributionBundle(input);
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

export async function dryRunCapturedGoalieBundle(db: SupabaseClient<any>, input: {
  capture: { basis: "captured_current"; capturedAt: string; cutoffAt: string;
    players: CapturedGoalieInput[] };
  seasonId: number; issuedAt: string; expiresAt: string; scheduleRevision: string;
}) {
  if (input.capture.cutoffAt !== input.capture.capturedAt) {
    throw new Error("Goalie capture cutoff must equal its current receipt.");
  }
  await persistCapturedGoalieBaselineInputs({ db, seasonId: input.seasonId,
    capture: input.capture, dryRun: true });
  const bundle = buildGoalieContributionBundle({
    seasonId: input.seasonId, cutoffAt: input.capture.cutoffAt,
    issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    scheduleRevision: input.scheduleRevision,
    snapshots: input.capture.players.map((player) => ({ teamId: player.teamId,
      rosterRevision: player.rosterRevision, snapshot: buildGoalieBaselineRates({
        playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId: input.seasonId,
        cutoffAt: input.capture.cutoffAt, sourceWatermark: player.sourceWatermark,
        limitations: player.limitations,
        projections: player.projections, appearances: player.appearances,
      }) })),
  });
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

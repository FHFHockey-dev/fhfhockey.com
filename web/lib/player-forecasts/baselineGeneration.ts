import type { SupabaseClient } from "@supabase/supabase-js";

import { BASELINE_RATE_POLICY_VERSION, buildSkaterBaselineRates,
  type BaselineAppearanceInput, type BaselineProjectionInput,
  type SkaterBaselineRateSnapshot } from "./baselineRates";
import { contributionBundleChecksum, persistContributionBundle,
  type ContributionBundleManifest } from "./contributionStore";
import type { ContributionSource } from "./contributions";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { baselineDefinitionHash, validBaselineSeasonId, type BaselineProjectionReceipt } from "./baselinePolicy";
import { persistCapturedBaselineInputs } from "./baselineInputCapture";
import type { BaselineHistoricalSourceReceipt, BaselineProjectionSelectionReceipt } from "./baselineSourceLineage";

export type BaselinePlayerSnapshot = {
  snapshot: SkaterBaselineRateSnapshot;
  teamId: number;
  rosterRevision: string;
};

export type CapturedBaselinePlayerInput = Omit<BaselinePlayerSnapshot, "snapshot"> & {
  playerId: number;
  nhlPlayerId: number;
  sourceWatermark: string;
  definitionHash: string;
  limitations?: string[];
  historicalSources?: BaselineHistoricalSourceReceipt;
  projectionSelection?: BaselineProjectionSelectionReceipt;
  projectionSources: BaselineProjectionReceipt[];
  projections: BaselineProjectionInput[];
  appearances: BaselineAppearanceInput[];
};

export type BaselineBundleInput = {
  seasonId: number;
  cutoffAt: string;
  issuedAt: string;
  expiresAt: string;
  scheduleRevision: string;
  snapshots: BaselinePlayerSnapshot[];
};

function validTime(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** Build an unreleased bundle from immutable, cutoff-stamped rate snapshots. */
export function buildBaselineContributionBundle(input: BaselineBundleInput): {
  manifest: ContributionBundleManifest;
  sources: ContributionSource[];
} {
  if (!validBaselineSeasonId(input.seasonId)
    || !validTime(input.cutoffAt) || !validTime(input.issuedAt) || !validTime(input.expiresAt)
    || Date.parse(input.cutoffAt) > Date.parse(input.issuedAt)
    || Date.parse(input.issuedAt) >= Date.parse(input.expiresAt)
    || !input.scheduleRevision?.trim() || !input.snapshots.length || input.snapshots.length > 1000) {
    throw new Error("Baseline bundle requires bounded snapshots and valid issuance times.");
  }
  const sources: ContributionSource[] = [];
  const playerIds = new Set<number>();
  for (const { snapshot, teamId, rosterRevision } of input.snapshots) {
    if (snapshot.policyVersion !== BASELINE_RATE_POLICY_VERSION || snapshot.validation !== "unvalidated"
      || snapshot.definitionHash !== baselineDefinitionHash("skater", input.seasonId)
      || snapshot.seasonId !== input.seasonId || snapshot.cutoffAt !== input.cutoffAt
      || !snapshot.sourceWatermark || !Number.isSafeInteger(snapshot.playerId) || snapshot.playerId <= 0
      || !Number.isSafeInteger(snapshot.nhlPlayerId) || snapshot.nhlPlayerId <= 0
      || !Number.isSafeInteger(teamId) || teamId <= 0 || !rosterRevision?.trim()
      || playerIds.has(snapshot.playerId)) throw new Error("Baseline snapshot identity or cutoff is inconsistent.");
    playerIds.add(snapshot.playerId);
    const targetKeys = new Set<string>();
    for (const target of snapshot.targets) {
      if (targetKeys.has(target.targetKey) || !target.targetKey
        || !Number.isFinite(target.ratePerAppearance)
        || (target.ratePerAppearance < 0 && target.targetKey !== "PLUS_MINUS")
        || target.sourceRows.some((row) => !validTime(row.availableAt)
          || Date.parse(row.availableAt) > Date.parse(input.cutoffAt))
        || [...target.previousObservations, ...target.recentObservations].some((row) =>
          !validTime(row.availableAt) || Date.parse(row.availableAt) > Date.parse(input.cutoffAt))) {
        throw new Error("Baseline target lineage is incomplete or after the cutoff.");
      }
      targetKeys.add(target.targetKey);
      const sourceId = `baseline:${playerForecastSourcePayloadHash({
        snapshot, teamId, rosterRevision, targetKey: target.targetKey,
      })}`;
      sources.push({
        kind: "baseline", sourceId, policyVersion: BASELINE_RATE_POLICY_VERSION,
        released: false, playerId: snapshot.playerId, nhlPlayerId: snapshot.nhlPlayerId,
        seasonId: snapshot.seasonId, teamId, targetKey: target.targetKey,
        unit: "count", basis: "per_appearance", mean: target.ratePerAppearance,
        participationIntegrated: false, cutoffAt: input.cutoffAt,
        issuedAt: input.issuedAt, expiresAt: input.expiresAt,
        sourceWatermark: snapshot.sourceWatermark, scheduleRevision: input.scheduleRevision,
        rosterRevision, limitations: [...snapshot.limitations],
      });
    }
  }
  if (!sources.length) throw new Error("Baseline bundle has no supported target rates.");
  sources.sort((a, b) => a.playerId - b.playerId || a.targetKey.localeCompare(b.targetKey));
  const unsigned = {
    seasonId: input.seasonId, policyVersion: BASELINE_RATE_POLICY_VERSION,
    inputCutoff: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    sourceCount: sources.length,
    sourceWatermarks: [...new Set(sources.map((source) => source.sourceWatermark))].sort(),
    rosterRevisions: [...new Set(sources.map((source) => source.rosterRevision))].sort(),
    evaluationPolicyId: null, reviewId: null, released: false,
  };
  return { sources, manifest: { ...unsigned,
    checksum: contributionBundleChecksum({ manifest: unsigned, sources }) } };
}

/** Captured records are passed explicitly; mutable projection tables cannot supply cutoff timestamps. */
export function buildBaselineBundleFromCapturedInputs(input: Omit<BaselineBundleInput, "snapshots"> & {
  players: CapturedBaselinePlayerInput[];
}) {
  if (input.players.some((player) => [...player.projections, ...player.appearances]
    .some((row) => !validTime(row.availableAt)))) {
    throw new Error("Captured baseline inputs require original availability timestamps.");
  }
  if (input.players.some(player => player.definitionHash !== baselineDefinitionHash("skater", input.seasonId))) {
    throw new Error("Captured baseline candidate definition is missing or incompatible.");
  }
  return buildBaselineContributionBundle({
    ...input,
    snapshots: input.players.map((player) => ({
      teamId: player.teamId, rosterRevision: player.rosterRevision,
      snapshot: buildSkaterBaselineRates({
        playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
        seasonId: input.seasonId, cutoffAt: input.cutoffAt,
        sourceWatermark: player.sourceWatermark,
        limitations: player.limitations,
        projections: player.projections, appearances: player.appearances,
      }),
    })),
  });
}

/** Validate through the existing persistence boundary without a database write. */
export async function dryRunBaselineContributionBundle(db: SupabaseClient<any>, input: BaselineBundleInput) {
  const bundle = buildBaselineContributionBundle(input);
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

/** Consume a current read receipt directly; never assign an earlier cutoff to its rows. */
export async function dryRunCapturedBaselineBundle(db: SupabaseClient<any>, input: {
  capture: { basis: "captured_current"; capturedAt: string; cutoffAt: string;
    players: CapturedBaselinePlayerInput[] };
  seasonId: number;
  issuedAt: string;
  expiresAt: string;
  scheduleRevision: string;
}) {
  if (input.capture.cutoffAt !== input.capture.capturedAt) {
    throw new Error("Current capture cutoff must equal its receipt time.");
  }
  await persistCapturedBaselineInputs({ db, seasonId: input.seasonId,
    capture: { ...input.capture, limitations: [] }, dryRun: true });
  const bundle = buildBaselineBundleFromCapturedInputs({
    seasonId: input.seasonId, cutoffAt: input.capture.cutoffAt,
    issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    scheduleRevision: input.scheduleRevision, players: input.capture.players,
  });
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

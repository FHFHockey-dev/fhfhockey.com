import type { SupabaseClient } from "@supabase/supabase-js";

import { BASELINE_RATE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION, priorAppearanceDefinitionHash, buildPriorAppearanceSkaterRates, CURRENT_APPEARANCE_POLICY_VERSION, currentAppearanceDefinitionHash, buildCurrentAppearanceSkaterRates, buildSkaterBaselineRates,
  type BaselineAppearanceInput, type BaselineProjectionInput,
  type SkaterBaselineRateSnapshot } from "./baselineRates";
import { contributionBundleChecksum, persistContributionBundle,
  type ContributionBundleManifest } from "./contributionStore";
import type { ContributionSource } from "./contributions";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { baselineDefinitionHash, validBaselineSeasonId, type BaselineProjectionReceipt } from "./baselinePolicy";
import { persistCapturedBaselineInputs } from "./baselineInputCapture";
import { timestampMicros } from "../projections/evidenceTime";
import { baselineAppearanceFromBoxscore, verifyBaselineBoxscoreReceipt, verifyBaselineHistoricalSources,
  type BaselineBoxscoreReceipt,
  type BaselineHistoricalSourceReceipt, type BaselineProjectionSelectionReceipt } from "./baselineSourceLineage";
import { deriveNativePowerPlayPoints, type NativePowerPlayPointsInput } from "./nativePowerPlayPoints";

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
  policyVersion?: typeof CURRENT_APPEARANCE_POLICY_VERSION | typeof PRIOR_APPEARANCE_POLICY_VERSION;
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
  const cutoffAt = timestampMicros(input.cutoffAt), issuedAt = timestampMicros(input.issuedAt),
    expiresAt = timestampMicros(input.expiresAt);
  if (!validBaselineSeasonId(input.seasonId)
    || cutoffAt === null || issuedAt === null || expiresAt === null
    || cutoffAt > issuedAt || issuedAt >= expiresAt
    || !input.scheduleRevision?.trim() || !input.snapshots.length || input.snapshots.length > 1000) {
    throw new Error("Baseline bundle requires bounded snapshots and valid issuance times.");
  }
  const policyVersion = input.snapshots[0].snapshot.policyVersion;
  const currentAppearance = policyVersion === CURRENT_APPEARANCE_POLICY_VERSION;
  const priorAppearance = policyVersion === PRIOR_APPEARANCE_POLICY_VERSION;
  const sources: ContributionSource[] = [];
  const playerIds = new Set<number>();
  for (const { snapshot, teamId, rosterRevision } of input.snapshots) {
    if (![BASELINE_RATE_POLICY_VERSION, CURRENT_APPEARANCE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION].includes(snapshot.policyVersion) || snapshot.policyVersion !== policyVersion || snapshot.validation !== "unvalidated"
      || snapshot.definitionHash !== (currentAppearance ? currentAppearanceDefinitionHash(input.seasonId) : priorAppearance ? priorAppearanceDefinitionHash(input.seasonId) : baselineDefinitionHash("skater", input.seasonId))
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
        kind: "baseline", sourceId, policyVersion,
        released: false, playerId: snapshot.playerId, nhlPlayerId: snapshot.nhlPlayerId,
        seasonId: snapshot.seasonId, teamId, targetKey: target.targetKey,
        unit: target.targetKey === "PENALTY_MINUTES" || (currentAppearance || priorAppearance) && target.targetKey === "TIME_ON_ICE_PER_GAME" ? "minutes" : "count", basis: "per_appearance", mean: target.ratePerAppearance,
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
    seasonId: input.seasonId, policyVersion,
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

export type DerivedPowerPlayPointsInputs = {
  version: "native-power-play-points-inputs-v1";
  landings: NativePowerPlayPointsInput["landing"][];
};

/** Shared producer/reader calculation; original boxscore appearances remain immutable. */
export function buildNativeSkaterBaselineSnapshot(input: Parameters<typeof buildSkaterBaselineRates>[0] & {
  derivedPowerPlayPoints?: DerivedPowerPlayPointsInputs;
  policyVersion?: typeof CURRENT_APPEARANCE_POLICY_VERSION | typeof PRIOR_APPEARANCE_POLICY_VERSION;
}): SkaterBaselineRateSnapshot {
  if (input.projections.length) throw new Error("Native baseline excludes external projection inputs.");
  const derived = input.derivedPowerPlayPoints;
  for (const appearance of input.appearances) {
    if (derived !== undefined) {
      const available = timestampMicros(appearance.availableAt), cutoff = timestampMicros(input.cutoffAt);
      if (available === null || cutoff === null || available > cutoff) throw new Error("Native PPP base receipt exceeds capture cutoff.");
    }
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId,
      derived === undefined ? input.cutoffAt : appearance.availableAt, "skater");
  }
  let appearances = input.appearances;
  if (derived !== undefined) {
    if (!derived || derived.version !== "native-power-play-points-inputs-v1" || !Array.isArray(derived.landings)
      || !appearances.length || derived.landings.length !== appearances.length || derived.landings.length > 200) {
      throw new Error("Native PPP requires a versioned complete landing input set.");
    }
    const landings = new Map<number, NativePowerPlayPointsInput["landing"]>();
    for (const landing of derived.landings) {
      const gameId = landing?.rawRow?.game_id;
      if (!Number.isSafeInteger(gameId) || gameId <= 0 || landings.has(gameId)) {
        throw new Error("Native PPP landing game identities are invalid or duplicated.");
      }
      landings.set(gameId, landing);
    }
    appearances = appearances.map(appearance => {
      const landing = landings.get(appearance.gameId);
      if (!landing) throw new Error("Native PPP landing evidence is missing for an appearance.");
      const receipt = appearance.finalBoxscore as BaselineBoxscoreReceipt;
      const current = baselineAppearanceFromBoxscore({ rawRow: receipt.rawRow, game: receipt.game,
        nhlPlayerId: input.nhlPlayerId, teamId: appearance.teamId, cutoffAt: input.cutoffAt, population: "skater" });
      if (!current) throw new Error("Native PPP lacks a verified positive-minute appearance.");
      const counts = deriveNativePowerPlayPoints({ nhlPlayerId: input.nhlPlayerId, cutoffAt: input.cutoffAt,
        appearance: current, landing });
      if (appearance.targets.PP_POINTS != null && appearance.targets.PP_POINTS !== counts.powerPlayPoints) {
        throw new Error("Native PPP conflicts with the original boxscore target.");
      }
      // Newly materialized derived inputs are available at this capture; archived inputs/clocks stay unchanged.
      return { ...appearance, availableAt: input.cutoffAt,
        targets: { ...appearance.targets, PP_POINTS: counts.powerPlayPoints } };
    });
  }
  if (input.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION) {
    // Derive minutes only after exact original appearance receipt verification above.
    appearances = appearances.map(appearance => ({ ...appearance, targets: { ...appearance.targets,
      TIME_ON_ICE_PER_GAME: (appearance.finalBoxscore as BaselineBoxscoreReceipt).appearanceSeconds / 60 } }));
    return buildCurrentAppearanceSkaterRates({ ...input, appearances });
  }
  if (input.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION) return buildPriorAppearanceSkaterRates({ ...input, appearances });
  if (input.policyVersion !== undefined) throw new Error("Unsupported native appearance policy.");
  return buildSkaterBaselineRates({ ...input, appearances });
}

export type NativeSkaterBaselineObservation = {
  provider: string;
  dataset_key: string;
  entity_kind: string;
  entity_key: string;
  available_at: string;
  payload_hash: string;
  payload: Omit<CapturedBaselinePlayerInput, "sourceWatermark" | "projectionSources"> & {
    basis: "captured_current";
    capturedAt: string;
    derivedPowerPlayPoints?: DerivedPowerPlayPointsInputs;
  };
};

/** Private reproduction from retained native observations; grants neither issuance nor public use. */
export async function dryRunNativeSkaterBaselineBundle(db: SupabaseClient<any>,
  input: Omit<BaselineBundleInput, "snapshots"> & { observations: NativeSkaterBaselineObservation[] }) {
  const maximumPlayers = input.observations[0]?.payload?.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION ? 50 : 20;
  if (!input.observations.length || input.observations.length > maximumPlayers) {
    throw new Error(`Native baseline composition requires 1–${maximumPlayers} retained observations.`);
  }
  const snapshots = input.observations.map(row => {
    const payload = row.payload;
    const availableAt = timestampMicros(row.available_at);
    const capturedAt = timestampMicros(payload?.capturedAt);
    const cutoffAt = timestampMicros(input.cutoffAt);
    if (row.provider !== "fhfh" || row.dataset_key !== "baseline-inputs-v1"
      || row.entity_kind !== "player" || !payload || typeof payload !== "object" || Array.isArray(payload)
      || row.entity_key !== `${input.seasonId}:${payload.playerId}`
      || payload.basis !== "captured_current" || availableAt === null || capturedAt === null || cutoffAt === null
      || availableAt !== capturedAt || capturedAt !== cutoffAt
      || !/^[a-f0-9]{64}$/.test(row.payload_hash)
      || playerForecastSourcePayloadHash(payload) !== row.payload_hash
      || payload.definitionHash !== (payload.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION ? currentAppearanceDefinitionHash(input.seasonId) : payload.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION ? priorAppearanceDefinitionHash(input.seasonId) : baselineDefinitionHash("skater", input.seasonId))
      || !Array.isArray(payload.projections) || payload.projections.length !== 0
      || !Array.isArray(payload.appearances) || !payload.appearances.length && payload.policyVersion !== CURRENT_APPEARANCE_POLICY_VERSION || payload.appearances.length > 200) {
      throw new Error("Native baseline requires cutoff-matched observations without external projection inputs.");
    }
    if (payload.policyVersion !== CURRENT_APPEARANCE_POLICY_VERSION) verifyBaselineHistoricalSources(payload.historicalSources, payload.appearances,
      payload.nhlPlayerId, input.seasonId, input.cutoffAt, payload.limitations ?? []);
    const snapshot = buildNativeSkaterBaselineSnapshot({
      playerId: payload.playerId, nhlPlayerId: payload.nhlPlayerId, seasonId: input.seasonId,
      cutoffAt: input.cutoffAt, sourceWatermark: row.payload_hash,
      projections: [], appearances: payload.appearances, limitations: payload.limitations,
      derivedPowerPlayPoints: payload.derivedPowerPlayPoints, policyVersion: payload.policyVersion,
    });
    if (!snapshot.targets.length && payload.policyVersion !== CURRENT_APPEARANCE_POLICY_VERSION) throw new Error(`Native baseline has no supported rates for player ${payload.playerId}.`);
    return { snapshot, teamId: payload.teamId, rosterRevision: payload.rosterRevision };
  });
  if (new Set(snapshots.map(row => row.snapshot.nhlPlayerId)).size !== snapshots.length) {
    throw new Error("Native baseline contains duplicate NHL players.");
  }
  return dryRunBaselineContributionBundle(db, { ...input, snapshots });
}

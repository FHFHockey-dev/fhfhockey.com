import type { SupabaseClient } from "@supabase/supabase-js";
import { loadApprovedContributionBundle } from "./contributionStore";
import { BASELINE_RATE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION, CURRENT_APPEARANCE_POLICY_VERSION, type SkaterBaselineRateSnapshot } from "./baselineRates";
import { buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { buildGoalieBaselineRates, GOALIE_BASELINE_POLICY_VERSION, buildNativeGoalieWinRates, NATIVE_GOALIE_WIN_POLICY_VERSION, buildNativeGoalieSummaryWinRates, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, buildNativeGoalieVolumeRates, NATIVE_GOALIE_VOLUME_POLICY_VERSION, buildNativeGoalieShutoutRates, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION } from "./goalieBaselineRates";
import { verifyBaselineBoxscoreReceipt } from "./baselineSourceLineage";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import type { ContributionSource } from "./contributions";
import { timestampMicros } from "../projections/evidenceTime";
import { CURRENT_SEASON_SOG_CONTRIBUTION_VERSION } from "./contributions";
import { admitsCurrentSeasonSogContribution } from "./currentSeasonSogContribution";

type NativeRateCache = { payloadHashes: Map<object, string>; skaterSnapshots: Map<string, SkaterBaselineRateSnapshot> };

function nativeRate(source: ContributionSource, row: any, cache: NativeRateCache, now: Date): boolean {
  if (source.policyVersion === CURRENT_SEASON_SOG_CONTRIBUTION_VERSION) {
    return admitsCurrentSeasonSogContribution(source, row, now);
  }
  const goalieSummaryWin = source.policyVersion === NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION;
  const goalieWin = source.policyVersion === NATIVE_GOALIE_WIN_POLICY_VERSION;
  const goalieVolume = source.policyVersion === NATIVE_GOALIE_VOLUME_POLICY_VERSION;
  const goalieShutouts = source.policyVersion === NATIVE_GOALIE_SHUTOUT_POLICY_VERSION;
  const goalie = source.policyVersion === GOALIE_BASELINE_POLICY_VERSION || goalieWin || goalieSummaryWin || goalieVolume || goalieShutouts;
  const currentAppearance = source.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION;
  const priorAppearance = source.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION;
  const payload = row?.payload;
  if (![BASELINE_RATE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION, GOALIE_BASELINE_POLICY_VERSION, CURRENT_APPEARANCE_POLICY_VERSION, NATIVE_GOALIE_WIN_POLICY_VERSION, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, NATIVE_GOALIE_VOLUME_POLICY_VERSION, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION].includes(source.policyVersion)
    || row?.provider !== "fhfh" || row.dataset_key !== (goalie ? "goalie-baseline-inputs-v1" : "baseline-inputs-v1")
    || row.entity_kind !== "player" || row.entity_key !== `${source.seasonId}:${source.playerId}`
    || !payload || typeof payload !== "object" || Array.isArray(payload)
    || row.payload_hash !== source.sourceWatermark
    || currentAppearance !== (payload.policyVersion === CURRENT_APPEARANCE_POLICY_VERSION)
    || priorAppearance !== (payload.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION)
    || goalieSummaryWin !== (payload.policyVersion === NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION)
    || goalieWin !== (payload.policyVersion === NATIVE_GOALIE_WIN_POLICY_VERSION)
    || goalieVolume !== (payload.policyVersion === NATIVE_GOALIE_VOLUME_POLICY_VERSION)
    || goalieShutouts !== (payload.policyVersion === NATIVE_GOALIE_SHUTOUT_POLICY_VERSION)
    || payload?.basis !== "captured_current" || payload.playerId !== source.playerId || payload.nhlPlayerId !== source.nhlPlayerId
    || payload.teamId !== source.teamId || payload.rosterRevision !== source.rosterRevision
    || Date.parse(row.available_at) !== Date.parse(payload.capturedAt)
    || Date.parse(payload.capturedAt) !== Date.parse(source.cutoffAt)
    || !Array.isArray(payload.projections) || payload.projections.length !== 0
    || !Array.isArray(payload.appearances) || !payload.appearances.length || payload.appearances.length > 200) return false;
  const payloadHash = cache.payloadHashes.get(row) ?? playerForecastSourcePayloadHash(payload);
  cache.payloadHashes.set(row, payloadHash);
  if (payloadHash !== row.payload_hash) return false;
  if (!goalie && payload.derivedPowerPlayPoints !== undefined) {
    const capture = timestampMicros(payload.capturedAt), cutoff = timestampMicros(source.cutoffAt),
      available = timestampMicros(row.available_at);
    if (capture === null || cutoff === null || available === null || capture !== cutoff || available !== capture) return false;
  }
  try {
    if (goalie && !goalieWin && !goalieSummaryWin && !goalieVolume && !goalieShutouts) for (const appearance of payload.appearances) verifyBaselineBoxscoreReceipt(appearance, source.nhlPlayerId,
      source.cutoffAt, "goalie");
    const input = { playerId: source.playerId, nhlPlayerId: source.nhlPlayerId, seasonId: source.seasonId,
      cutoffAt: source.cutoffAt, sourceWatermark: source.sourceWatermark,
      projections: [], appearances: payload.appearances, limitations: payload.limitations, shutoutSummary: payload.shutoutSummary, winSummary: payload.winSummary };
    const key = `${source.policyVersion}:${source.sourceWatermark}:${source.seasonId}:${source.cutoffAt}`;
    const snapshot = goalie ? goalieSummaryWin ? buildNativeGoalieSummaryWinRates(input) : goalieShutouts ? buildNativeGoalieShutoutRates(input) : goalieWin ? buildNativeGoalieWinRates(input) : goalieVolume ? buildNativeGoalieVolumeRates(input) : buildGoalieBaselineRates(input) : cache.skaterSnapshots.get(key)
      ?? buildNativeSkaterBaselineSnapshot({ ...input, derivedPowerPlayPoints: payload.derivedPowerPlayPoints, policyVersion: payload.policyVersion });
    if (!goalie) cache.skaterSnapshots.set(key, snapshot as SkaterBaselineRateSnapshot);
    if (snapshot.definitionHash !== payload.definitionHash) return false;
    const target = snapshot.targets.find(value => value.targetKey === source.targetKey);
    if (!target) return false;
    const rate = "rate" in target ? target.rate : target.ratePerAppearance;
    const basis = "basis" in target ? target.basis : "per_appearance";
    return source.mean === rate && source.basis === basis
      && source.unit === (source.targetKey === "GOALIE_MINUTES" || source.targetKey === "PENALTY_MINUTES" || (currentAppearance || priorAppearance) && source.targetKey === "TIME_ON_ICE_PER_GAME" ? "minutes" : "count")
      && source.sourceId === `baseline:${playerForecastSourcePayloadHash({ snapshot, teamId: source.teamId,
        rosterRevision: source.rosterRevision, targetKey: source.targetKey })}`;
  } catch { return false; }
}

/** Product admission is stricter than receipt approval used by isolated comparisons. */
export async function loadNativeContributionBundle(db: SupabaseClient<any>, seasonId: number, now: Date,
  options?: { environment?: Record<string, string | undefined>; signal?: AbortSignal }) {
  const approved = await loadApprovedContributionBundle(db, seasonId, now, options);
  if (!approved.sources.length) return approved;
  const watermarks = [...new Set(approved.sources.map(source => source.sourceWatermark))].sort();
  const empty = (reason: string) => ({ sources: [] as ContributionSource[], manifests: [], checksum: null,
    limitations: [...approved.limitations, reason] });
  if (watermarks.length > 1020 || watermarks.some(value => !/^[a-f0-9]{64}$/.test(value))) {
    return empty("baseline_provenance_unverified");
  }
  let query = db.from("player_forecast_source_observations")
    .select("provider,dataset_key,entity_kind,entity_key,available_at,payload_hash,payload")
    .eq("provider", "fhfh").in("dataset_key", ["baseline-inputs-v1", "goalie-baseline-inputs-v1"])
    .eq("entity_kind", "player").in("payload_hash", watermarks).limit(1021);
  if (options?.signal) query = query.abortSignal(options.signal);
  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length > 1020) return empty("baseline_provenance_unverified");
  // One immutable receipt serves several heads; validate/hash its bodies once per read.
  const cache: NativeRateCache = { payloadHashes: new Map(), skaterSnapshots: new Map() };
  const sources = approved.sources.filter(source => {
    const matches = data.filter(row => row.payload_hash === source.sourceWatermark);
    return matches.length === 1 && nativeRate(source, matches[0], cache, now);
  });
  if (!sources.length) return empty("baseline_external_or_unclassified_inputs_excluded");
  return { ...approved, sources, checksum: playerForecastSourcePayloadHash({ approvedChecksum: approved.checksum,
    nativeSourceIds: sources.map(source => source.sourceId) }),
    limitations: [...approved.limitations, ...(sources.length < approved.sources.length
      ? ["baseline_external_or_unclassified_inputs_excluded"] : [])] };
}

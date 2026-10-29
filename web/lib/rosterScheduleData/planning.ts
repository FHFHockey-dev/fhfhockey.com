import { loadPlanningInputs, pages, withinDeadline, PlanningReadDeadlineError, type PlanningDataQuery } from "./planningInputs";
import { admitConsumerGameRevisions } from "lib/projections/consumerRevisionAdmission";
import { currentRsoUsePolicy, issuedParticipationLineage, restrictRsoForecast, type RsoUsePolicyManifest } from "lib/player-forecasts/rsoUsePolicy";
import { loadForgeDailyBridgeForecasts, type ForgeBridgeCapture } from "./forgeDailyBridge";
import type { BridgeRunProof } from "./bridgeForecastWire";
import { fitLaterImpactScenario, laterImpactScenarioEnabled, loadLaterImpactScenario, planningBodyBytes } from "./laterImpactInputs";
export { normalizePlanningGames } from "./planningInputs";
export { publicPlanningForecasts } from "lib/projections/consumerRevisionAdmission";
export type { PlanningDataQuery } from "./planningInputs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import { selectForecastServingSource, unavailableForecastServingSource, type ForecastServingSource } from "lib/player-forecasts/forecastServingSource";
import { loadNativeContributionBundle } from "lib/player-forecasts/nativeContributionAdmission";
import { loadModeledGoalieParticipation, loadFrozenWindowGoalieParticipation, loadFrozenWindowGoalieStarts, loadRosterObservationGoalieParticipation, loadRosterObservationGoalieStarts,
  loadRollingWindowGoalieParticipation, loadRollingWindowGoalieStarts } from "lib/player-forecasts/modeledGoalieParticipationStore";
import { loadModeledSkaterParticipation, loadFrozenWindowSkaterParticipation, loadRosterObservationSkaterParticipation,
  loadRollingWindowSkaterParticipation } from "lib/player-forecasts/modeledSkaterParticipationStore";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { starterBoardCanaryGameIds, starterBoardFlags } from "lib/projections/starterBoardFlags";
import type { ForecastDiscoveryExclusion, ForecastExclusionReason, ForecastManifest, PlanningData, SourceEvidence } from "lib/rosterScheduleOptimizer/planningTypes";
import { GOALIE_RECENT_COLUMNS, lastFiveTotals, recentTotals, SKATER_RECENT_COLUMNS } from "lib/rosterScheduleOptimizer/recentForm";

export function parsePlanningDataQuery(query: Record<string, unknown>): PlanningDataQuery {
  const seasonId = Number(query.seasonId);
  const season = String(seasonId);
  const startDate = typeof query.startDate === "string" ? query.startDate : "";
  const endDate = typeof query.endDate === "string" ? query.endDate : "";
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !validDate(startDate) || !validDate(endDate) || startDate > endDate
    || Date.parse(endDate) - Date.parse(startDate) > 366 * 86400000) {
    throw new Error("Provide a valid NHL season and a date range of at most 367 days.");
  }
  const timeZone = typeof query.timeZone === "string" ? query.timeZone : undefined;
  if (timeZone) { try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new Error("Provide a valid league time zone."); } }
  return { seasonId, startDate, endDate, ...(timeZone ? { timeZone } : {}) };
}

type Row = Record<string, any>;
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
/** Recent form reads 30 days of played games: about 10 for a regular, fewer after a layoff. At most 16 games a day
 * dress about 36 skaters and 4 goalies each, so these caps sit above any full window; a larger count fails the read. */
const RECENT_FORM_DAYS = 30, RECENT_SKATER_ROWS = 25000, RECENT_GOALIE_ROWS = 2500;
/** Deployment chips read every team's charted lineups over two weeks (about 8 games a team, 32 teams), then the PP units of
 * each team's newest one (5 per unit, with every skater who had PP time); both caps sit well above a full window. */
const DEPLOYMENT_DAYS = 14, DEPLOYMENT_STALE_DAYS = 7, DEPLOYMENT_LINE_ROWS = 600, DEPLOYMENT_PP_ROWS_PER_GAME = 40;
/** Provider ownership percentage: a finite 0–100 number or plain numeric string; anything else is unknown, never 0. */
const ownershipPct = (value: unknown) => {
  const parsed = typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : numberOrNull(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
};
/** A revision's declared FORGE model identity (TJ D3; written by `forgeModelIdentity` in run-forge-projections), taken whole or
 * not at all: an older revision without one, or an artifact hash that does not bind its own code version, stays unknown. */
function revisionModelIdentity(payload: ForgeGameRevision["payload"] | undefined): { configurationHash: string | null; artifactHash: string | null } {
  const identity = (payload?.inputProvenance as { modelIdentity?: Record<string, unknown> } | undefined)?.modelIdentity;
  const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (!identity || identity.version !== "forge-model-identity-v1" || identity.artifact !== "no_fitted_artifact"
    || !hex(identity.configurationHash) || !hex(identity.artifactHash) || typeof payload?.codeVersion !== "string"
    || identity.artifactHash !== playerForecastSourcePayloadHash({ codeVersion: payload.codeVersion, configurationHash: identity.configurationHash })) {
    return { configurationHash: null, artifactHash: null };
  }
  return { configurationHash: identity.configurationHash, artifactHash: identity.artifactHash };
}
function evidence(source: string, asOf: string | null, seasonId: number | null, limitations: string[] = []): SourceEvidence {
  return { source, asOf, seasonId, completeness: limitations.length ? "partial" : "complete", limitations };
}

export async function loadPlanningData(db: SupabaseClient<any>, query: PlanningDataQuery, options: { now?: Date; forecastsEnabled?: boolean; deadlineMs?: number; skipOwnership?: boolean; skipRecentForm?: boolean;
  consumer?: "rso" | "start_chart";
  /** A source the caller already selected for this request; otherwise it is selected here. */
  source?: ForecastServingSource;
  /** RSO only: serve interim FORGE daily projections while native forecasts are not activated. */
  forgeDailyBridge?: boolean;
  /** Receives the served bridge runs' proofs for the response wire; never stored on PlanningData or a snapshot. */
  onBridgeRunProofs?: (proofs: BridgeRunProof[]) => void } = {}): Promise<PlanningData> {
  const now = options.now ?? new Date();
  const deadline = Math.min(options.deadlineMs ?? Infinity, Date.now() + 20000);
  const source = options.source ?? await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => selectForecastServingSource(db, query.seasonId, now, process.env, signal))
    .catch(() => unavailableForecastServingSource(process.env));
  const nativeLimitation = source.kind === "legacy_flagged" || source.kind === "empty" ? source.reason : null;
  const inputDeadline = Math.min(deadline, Date.now() + 8000);
  const selectedEnvironment = source.environment;
  const calendarPolicy = forecastCalendarPolicy(Number(process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
  // VORP S3: the later-impact scenario's inputs, only with RSO_LATER_IMPACT_SCENARIO=on; off, nothing below changes.
  const scenarioOn = laterImpactScenarioEnabled();
  const [{ players, games, scheduleRows, scheduleProblems, evidence: sources }, weeks, baseline, skaterParticipation, goalieParticipation,
    frozenSkaterParticipation, frozenGoalieParticipation, frozenGoalieStarts,
    observedSkaterParticipation, observedGoalieParticipation, observedGoalieStarts,
    rollingSkaterParticipation, rollingGoalieParticipation, rollingGoalieStarts] = await Promise.all([
    loadPlanningInputs(db, query, now, inputDeadline),
    pages(() => db.from("yahoo_matchup_weeks").select("id,game_key,week,start_date,end_date", { count: "exact" })
      .eq("season", String(query.seasonId).slice(0, 4)).order("week").order("id"), inputDeadline, 500).catch(() => []),
    // Admission reads bundles, review receipts, then original inputs. Bound the
    // complete sequence by the route deadline rather than one 8-second stage.
    withinDeadline(deadline, signal => loadNativeContributionBundle(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], manifests: [], checksum: null, limitations: ["baseline_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadModeledSkaterParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadModeledGoalieParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["goalie_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadFrozenWindowSkaterParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["frozen_skater_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadFrozenWindowGoalieParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["frozen_goalie_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadFrozenWindowGoalieStarts(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["frozen_goalie_starts_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRosterObservationSkaterParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["roster_observation_skater_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRosterObservationGoalieParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["roster_observation_goalie_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRosterObservationGoalieStarts(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["roster_observation_goalie_starts_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRollingWindowSkaterParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["rolling_skater_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRollingWindowGoalieParticipation(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["rolling_goalie_participation_read_unavailable"] })),
    withinDeadline(inputDeadline, signal => loadRollingWindowGoalieStarts(db, query.seasonId, now, { signal, environment: selectedEnvironment }))
      .catch(() => ({ sources: [], checksum: null, limitations: ["rolling_goalie_starts_read_unavailable"] })),
  ]);
  const membershipAsOf = scenarioOn ? new Date().toISOString() : "";
  // Preserve the existing skater checksum and disabled behavior when no goalie
  // releases are admitted; goalie revisions are an independently pinned catalog.
  const legacyParticipationChecksum = goalieParticipation.checksum ? playerForecastSourcePayloadHash({ skater: skaterParticipation.checksum,
    goalie: goalieParticipation.checksum }) : skaterParticipation.checksum;
  const frozenParticipationChecksum = frozenSkaterParticipation.checksum || frozenGoalieParticipation.checksum || frozenGoalieStarts.checksum
    ? playerForecastSourcePayloadHash({ legacy: legacyParticipationChecksum, frozenSkater: frozenSkaterParticipation.checksum,
      frozenGoalie: frozenGoalieParticipation.checksum,
      ...(frozenGoalieStarts.checksum ? { frozenGoalieStarts: frozenGoalieStarts.checksum } : {}) }) : legacyParticipationChecksum;
  const observationEnabled = observedSkaterParticipation.checksum || observedGoalieParticipation.checksum || observedGoalieStarts.checksum;
  const observedParticipationChecksum = observationEnabled ? playerForecastSourcePayloadHash({ existing: frozenParticipationChecksum,
    observedSkater: observedSkaterParticipation.checksum, observedGoalie: observedGoalieParticipation.checksum,
    observedGoalieStarts: observedGoalieStarts.checksum }) : frozenParticipationChecksum;
  // Rolling catalogs extend the checksum only when admitted, so earlier manifests keep their identity.
  const rollingEnabled = rollingSkaterParticipation.checksum || rollingGoalieParticipation.checksum || rollingGoalieStarts.checksum;
  const participation = { sources: [...skaterParticipation.sources, ...goalieParticipation.sources,
    ...frozenSkaterParticipation.sources, ...frozenGoalieParticipation.sources, ...frozenGoalieStarts.sources,
    ...observedSkaterParticipation.sources, ...observedGoalieParticipation.sources, ...observedGoalieStarts.sources,
    ...rollingSkaterParticipation.sources, ...rollingGoalieParticipation.sources, ...rollingGoalieStarts.sources],
    checksum: rollingEnabled ? playerForecastSourcePayloadHash({ existing: observedParticipationChecksum,
      rollingSkater: rollingSkaterParticipation.checksum, rollingGoalie: rollingGoalieParticipation.checksum,
      rollingGoalieStarts: rollingGoalieStarts.checksum }) : observedParticipationChecksum,
    limitations: [...skaterParticipation.limitations, ...[...goalieParticipation.limitations,
      ...frozenSkaterParticipation.limitations, ...frozenGoalieParticipation.limitations, ...frozenGoalieStarts.limitations,
      ...observedSkaterParticipation.limitations, ...observedGoalieParticipation.limitations, ...observedGoalieStarts.limitations,
      ...rollingSkaterParticipation.limitations, ...rollingGoalieParticipation.limitations, ...rollingGoalieStarts.limitations]
      .filter(reason => reason !== "modeled_participation_serving_disabled")] };
  const revisions: ForgeGameRevision[] = [];
  const exclusionCounts: Record<string, number> = {};
  const exclusionRows: ForecastDiscoveryExclusion[] = [];
  const scheduledGameIds = [...new Set(games.filter(game => game.status === "scheduled").map(game => game.id))];
  const recordGameExclusion = (gameId: string, reason: ForecastExclusionReason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, reasons: [reason] });
  };
  const forecastProblems: string[] = [];
  let canary: number[] | null = null;
  let rolloutValid = true;
  try { canary = starterBoardCanaryGameIds(); }
  catch { rolloutValid = false; forecastProblems.push("Shared forecast rollout configuration could not be verified; schedule planning remains available."); }
  const selectedGameIds = new Set(scheduledGameIds.filter(id => canary === null || canary.includes(Number(id))));
  const discoveryUnavailable = new Set<string>();
  if (rolloutValid && (options.forecastsEnabled ?? starterBoardFlags().serving)) {
    // Revision slates retain the NHL source date even when the league-local date differs.
    for (const id of scheduledGameIds) if (!selectedGameIds.has(id)) recordGameExclusion(id, "canary_excluded");
    if (canary !== null) forecastProblems.push("Only games enabled by the shared forecast rollout are served.");
    const dates = [...new Set(scheduleRows.filter(row => selectedGameIds.has(String(row.source_game_id))).map(row => String(row.game_date)))];
    // Bounded concurrency, with no update/pipeline side effects.
    const discoveryDeadline = Math.min(deadline, Date.now() + 8000);
    for (let index = 0; index < dates.length; index += 4) {
      if (Date.now() >= discoveryDeadline) {
        forecastProblems.push("Forecast discovery reached its time budget; uncovered dates remain schedule-only.");
        for (const date of dates.slice(index)) for (const row of scheduleRows.filter(row => String(row.game_date) === date)) {
          const id = String(row.source_game_id);
          if (selectedGameIds.has(id)) { discoveryUnavailable.add(id); recordGameExclusion(id, "discovery_timeout"); }
        }
        break;
      }
      const results = await Promise.allSettled(dates.slice(index, index + 4).map(async (date) => {
        const response = await withinDeadline(discoveryDeadline, signal => db.rpc("read_forge_game_revisions", { p_slate_date: date }).abortSignal(signal));
        if (response.error) throw response.error;
        if (!Array.isArray(response.data)) throw new Error("Issued revision read is incomplete");
        return response.data as ForgeGameRevision[];
      }));
      for (const [offset, result] of results.entries()) {
        if (result.status === "fulfilled") revisions.push(...result.value.filter(revision => selectedGameIds.has(String(revision.game_id))));
        else {
          forecastProblems.push("Some issued game forecasts could not be read.");
          const date = dates[index + offset];
          for (const row of scheduleRows.filter(row => String(row.game_date) === date)) {
            const id = String(row.source_game_id);
            if (selectedGameIds.has(id)) { discoveryUnavailable.add(id); recordGameExclusion(id,
              result.reason instanceof PlanningReadDeadlineError ? "discovery_timeout" : "discovery_failed"); }
          }
        }
      }
    }
  } else {
    forecastProblems.push("Shared game-forecast serving is not enabled; schedule planning remains available.");
    for (const id of scheduledGameIds) recordGameExclusion(id, "serving_disabled");
  }
  const { forecasts: admitted, admittedSources, acceptedNewsRevision, limitations: admissionProblems } = await admitConsumerGameRevisions(
    db, revisions, players, games, now, query.seasonId, exclusionCounts, exclusionRows, deadline, calendarPolicy);
  forecastProblems.push(...admissionProblems);
  let forecasts = admitted, bridged = false;
  let observation: ForgeBridgeCapture | null = null, servedProofs: BridgeRunProof[] = [];
  // Interim RSO source (TJ, 2026-10-19): before native activation only; native and its fallbacks never fall back to it.
  if (options.forgeDailyBridge && source.kind === "legacy" && !admitted.length && !baseline.sources.length
    && process.env.RSO_FORGE_DAILY_BRIDGE !== "off") {
    try {
      const bridge = await (scenarioOn ? loadForgeDailyBridgeForecasts(db, players, games, now, query.seasonId, deadline, calendarPolicy, captured => { observation = captured; })
        : loadForgeDailyBridgeForecasts(db, players, games, now, query.seasonId, deadline, calendarPolicy));
      forecastProblems.push(...bridge.limitations);
      if (bridge.forecasts.length) {
        forecasts = bridge.forecasts; bridged = true;
        options.onBridgeRunProofs?.(bridge.runProofs);
        servedProofs = bridge.runProofs;
        const covered = new Set(forecasts.map(row => row.gameId));
        delete exclusionCounts.serving_disabled;
        for (let index = exclusionRows.length - 1; index >= 0; index--) if (exclusionRows[index].reasons.includes("serving_disabled")) exclusionRows.splice(index, 1);
        for (const id of scheduledGameIds) if (!covered.has(id)) recordGameExclusion(id, "no_issued_revision");
        const disabled = forecastProblems.indexOf("Shared game-forecast serving is not enabled; schedule planning remains available.");
        if (disabled >= 0) forecastProblems.splice(disabled, 1);
      }
    } catch { forecastProblems.push("Interim FORGE projections could not be read; schedule planning remains available."); }
  }
  // Permission denial is downstream of selection: it must never empty admission
  // and thereby invoke the separately approved interim bridge.
  let rsoUsePolicy: RsoUsePolicyManifest | undefined;
  if (options.consumer === "rso") {
    const policy = currentRsoUsePolicy();
    rsoUsePolicy = { version: policy.version, revision: policy.revision,
      bridgeRevisionIds: bridged ? [...new Set(forecasts.map(row => row.revisionId))].sort() : [] };
    if (!bridged) forecasts = forecasts.map(forecast => {
      const admitted = admittedSources.find(row => row.forecast === forecast);
      const rsoTargetBindings = Object.fromEntries(Object.keys(forecast.stats).map(targetKey => [targetKey, {
        component: `forge-detailed-${admitted?.source.kind ?? "unknown"}`,
        modelMode: admitted?.revision.payload.modelMode ?? "unknown", codeVersion: forecast.modelVersion ?? "unknown",
        // Only the revision's own declared model identity binds configuration and
        // artifact; issuance or captured-read hashes never stand in for it.
        ...revisionModelIdentity(admitted?.revision.payload), targetKey, horizonGames: 1,
        conditioning: admitted?.source.kind === "goalie" ? "start_only_zero_relief" : "conditional_playing",
        // Stable participation method for review; the issued revision is checked per row (Astra F3).
        participationLineage: issuedParticipationLineage(admitted?.source.kind ?? "unknown", forecast.revisionId), cutoffAt: forecast.cutoffAt ?? "",
      }]));
      const restricted = restrictRsoForecast({ ...forecast, rsoTargetBindings }, { rsoUsePolicy }, now.toISOString(), policy);
      for (const [targetKey, uses] of Object.entries(restricted.targetAllowedUses ?? {})) {
        if (uses.assignment && uses.totals && uses.comparison) continue;
        exclusionCounts.use_not_approved = (exclusionCounts.use_not_approved ?? 0) + 1;
        if (exclusionRows.length < 15000) exclusionRows.push({ gameId: forecast.gameId, playerId: forecast.playerId,
          targetKey, reasons: ["use_not_approved"] });
      }
      return restricted;
    });
    if (!bridged && forecasts.length) forecastProblems.push("Detailed target uses require an applicable reviewed scope; unapproved quality remains unavailable.");
  }
  if (rolloutValid && (options.forecastsEnabled ?? starterBoardFlags().serving)) {
    const issued = new Set(revisions.map(revision => String(revision.game_id)));
    for (const id of selectedGameIds) if (!issued.has(id) && !discoveryUnavailable.has(id)) recordGameExclusion(id, "no_issued_revision");
  }
  if (scheduleProblems.length) for (const id of scheduledGameIds) recordGameExclusion(id, "incomplete_refresh");
  exclusionRows.sort((a, b) => a.gameId.localeCompare(b.gameId) || (a.playerId ?? "").localeCompare(b.playerId ?? "")
    || (a.targetKey ?? "").localeCompare(b.targetKey ?? "") || a.reasons[0].localeCompare(b.reasons[0]));
  const scheduleRevision = playerForecastSourcePayloadHash(games.map(game => game.scheduleRevision).sort());
  const rosterRevision = playerForecastSourcePayloadHash(players.map(player => [player.id, player.rosterRevision]).sort());
  const manifestContent = { seasonId: query.seasonId, calendarPolicy, acceptedNewsRevision, scheduleRevision, rosterRevision,
    ...(rsoUsePolicy ? { rsoUsePolicy } : {}),
    issuedRevisionIds: [...new Set(forecasts.map(row => row.revisionId))].sort(), baselineChecksum: baseline.checksum,
    participationRevisionIds: participation.sources.map(source => source.revisionId).sort(), participationChecksum: participation.checksum,
    exclusions: exclusionRows };
  const forecastManifest: ForecastManifest = { ...manifestContent, version: "planning-forecasts-v1", id: playerForecastSourcePayloadHash(manifestContent), asOf: now.toISOString(),
    requiredOpportunities: players.reduce((sum, player) => sum + games.filter(game => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled").length, 0),
    forecastedOpportunities: forecasts.length, exclusionCounts, exclusions: exclusionRows };
  if (nativeLimitation) { baseline.limitations.push(nativeLimitation); participation.limitations.push(nativeLimitation); }
  sources.baselines = evidence("Approved contribution rate bundles", baseline.manifests.map(manifest => manifest.issuedAt).sort()[0] ?? null, query.seasonId, baseline.limitations);
  sources.participation = evidence(rollingEnabled ? "Released modeled participation with rolling 14-day history and official roster-observation continuation proxies"
    : observationEnabled ? "Released modeled participation with official roster-observation continuation proxies"
    : frozenSkaterParticipation.checksum || frozenGoalieParticipation.checksum || frozenGoalieStarts.checksum
    ? "Released modeled participation including explicit frozen history"
    : goalieParticipation.checksum ? "Released modeled skater and goalie participation" : "Released modeled skater participation",
    participation.sources.map(source => source.issuedAt).sort()[0] ?? null, query.seasonId, participation.limitations);
  forecastProblems.push("Only issued unconditional game forecasts are used. Conditional-only, missing, or out-of-horizon statistics are unknown, not zero.");
  sources.forecasts = evidence(bridged ? "Interim FORGE daily projections" : "selected FORGE game revisions", forecasts.map((row) => row.issuedAt).sort()[0] ?? null, query.seasonId, [...new Set(forecastProblems)]);

  // Ownership is platform-wide context, never league availability. This season-scoped view may be absent/stale.
  if (options.skipOwnership) {
    sources.ownership = evidence("not_requested", null, query.seasonId, ["Ownership context was not requested by this consumer."]);
  } else try {
    const ownershipDeadline = Math.min(deadline, Date.now() + 2000);
    const ownership = await pages(() => db.from("yahoo_player_ownership_daily").select("player_key,player_id,ownership_pct,ownership_date,updated_at", { count: "exact" })
      .eq("season_id", query.seasonId).gte("ownership_date", new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10))
      .order("ownership_date", { ascending: false }).order("player_key"), ownershipDeadline, 25000, row => [row.ownership_date, row.player_key]);
    const mapping = await pages(() => db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id", { count: "exact" })
      .order("nhl_player_id").order("yahoo_player_id"), ownershipDeadline, 25000, row => [row.nhl_player_id, row.yahoo_player_id]);
    const nhlByYahoo = new Map<string, Set<number>>();
    for (const row of mapping) nhlByYahoo.set(String(row.yahoo_player_id), new Set([...(nhlByYahoo.get(String(row.yahoo_player_id)) ?? []), Number(row.nhl_player_id)]));
    const latest = new Map<number, Row>();
    for (const row of ownership) {
      const matches = nhlByYahoo.get(String(row.player_id));
      if (matches?.size !== 1) continue;
      const nhl = [...matches][0];
      if (!latest.has(nhl)) latest.set(nhl, row);
    }
    // A reported 0 is a real 0%; missing, empty, invalid or future rows stay unknown. Only a fresh (≤3-day) reading sets
    // `ownership`; an older one is kept as labelled last-known evidence, never as a fresh value or ranking input.
    for (const player of players) {
      const row = player.nhlId === null ? null : latest.get(player.nhlId);
      const value = ownershipPct(row?.ownership_pct);
      const observedOn = typeof row?.ownership_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.ownership_date) ? row.ownership_date : null;
      const observedAt = observedOn ? Date.parse(`${observedOn}T00:00:00Z`) : NaN;
      if (value === null || !Number.isFinite(observedAt) || observedAt > now.getTime()) continue;
      if (observedAt >= now.getTime() - 3 * 86400000) player.ownership = value;
      else player.ownershipEvidence = { value, observedOn, provider: "yahoo", status: "stale" };
    }
    sources.ownership = evidence("Yahoo daily ownership", ownership[0]?.updated_at ?? null, query.seasonId, ["Ownership is not league availability; missing or older than three days is unknown."]);
  } catch { sources.ownership = evidence("Yahoo daily ownership", null, query.seasonId, ["Ownership could not be verified."]); }
  // Line and PP deployment: one season- and date-bounded read of charted lineups, then one read of the PP units in each
  // team's newest charted game. It runs beside the box-score reads and settles to null on any failure (never unhandled).
  const deploymentRead = options.skipRecentForm ? null : (async () => {
    const deploymentDeadline = Math.min(deadline, Date.now() + 2000);
    const since = new Date(now.getTime() - DEPLOYMENT_DAYS * 86400000).toISOString().slice(0, 10);
    const lineups = await pages(() => db.from("lineCombinations").select("gameId,teamId,forwards,defensemen,game:games!inner(date,seasonId)", { count: "exact" })
      .eq("game.seasonId", query.seasonId).gte("game.date", since).lte("game.date", now.toISOString().slice(0, 10))
      .order("gameId", { ascending: false }).order("teamId"), deploymentDeadline, DEPLOYMENT_LINE_ROWS, row => [row.gameId, row.teamId]);
    const newest = new Map<number, Row>();
    for (const row of lineups) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.game?.date))) continue;
      const current = newest.get(Number(row.teamId));
      if (!current || row.game.date > current.game.date) newest.set(Number(row.teamId), row);
    }
    const gameIds = [...new Set([...newest.values()].map(row => Number(row.gameId)))].sort((a, b) => a - b);
    const units = gameIds.length ? await pages(() => db.from("powerPlayCombinations").select("gameId,playerId,unit", { count: "exact" })
      .in("gameId", gameIds).order("gameId").order("playerId"), deploymentDeadline, gameIds.length * DEPLOYMENT_PP_ROWS_PER_GAME,
    row => [row.gameId, row.playerId]) : [];
    return { newest, units };
  })().catch(() => null);
  const lastPlayed = new Map<string, string>();
  let recentFormStage: "stats" | "processing" = "stats";
  if (options.skipRecentForm) {
    sources.form = evidence("not_requested", null, query.seasonId, ["Recent scoring context was not requested by this consumer."]);
  } else try {
    const formDeadline = Math.min(deadline, Date.now() + 2000);
    const start = new Date(now.getTime() - RECENT_FORM_DAYS * 86400000).toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString().slice(0, 10);
    // One newest-first date-window read per table for every player (date and games_played indexes), each capped;
    // every player keeps his last 10 played games (recentTotals). League weights are applied client-side.
    // Skater rows are keyed by `id` (player and date are not unique there); goalie rows by their unique goalie and date.
    const window = (table: string, id: string, key: string[], columns: Readonly<Record<string, string>>, maximum: number) => pages(() => db.from(table)
      .select([...new Set([...key, id, "date", "games_played", ...Object.values(columns)])].join(","), { count: "exact" })
      .eq("season_id", query.seasonId).eq("games_played", 1).gte("date", start).lte("date", cutoff)
      .order("date", { ascending: false }).order(key[0]), formDeadline, maximum, row => key.map(column => row[column]));
    const [skaterRows, goalieRows] = await Promise.all([
      window("wgo_skater_stats", "player_id", ["id"], SKATER_RECENT_COLUMNS, RECENT_SKATER_ROWS),
      window("wgo_goalie_stats", "goalie_id", ["goalie_id", "date"], GOALIE_RECENT_COLUMNS, RECENT_GOALIE_ROWS)]);
    recentFormStage = "processing";
    const byPlayer = (rows: Row[], id: string) => {
      const grouped = new Map<number, Row[]>();
      // One game per player per date: a repeated date is ignored rather than counted twice.
      for (const row of rows) if (/^\d{4}-\d{2}-\d{2}$/.test(String(row.date)) && !grouped.get(Number(row[id]))?.some(item => item.date === row.date))
        grouped.set(Number(row[id]), [...grouped.get(Number(row[id])) ?? [], row]);
      for (const samples of grouped.values()) samples.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return grouped;
    };
    const skaters = byPlayer(skaterRows, "player_id"), goalies = byPlayer(goalieRows, "goalie_id");
    for (const player of players) {
      const samples = player.nhlId === null ? [] : (player.playerClass === "goalie" ? goalies : skaters).get(player.nhlId) ?? [];
      const totals = recentTotals(samples, player.playerClass);
      if (totals) player.recentTotals = totals;
      const boxScore = lastFiveTotals(samples, player.playerClass);
      if (boxScore) { player.lastFive = boxScore; lastPlayed.set(player.id, String(samples.find(row => Number(row.games_played) > 0)?.date)); }
      if (player.playerClass === "goalie" || samples.length < 3 || samples.slice(0, 5).some(row => numberOrNull(row.points) === null)) continue;
      const lastThree = samples.slice(0, 3).reduce((sum, row) => sum + Number(row.points), 0);
      const lastFive = samples.slice(0, 5).reduce((sum, row) => sum + Number(row.points), 0);
      const hot = lastThree >= 6, cold = samples.length >= 5 && lastFive === 0;
      player.form = { label: hot ? "Scoring hot" : cold ? "Scoring cold" : "Recent scoring", games: hot ? 3 : Math.min(samples.length, 5), points: hot ? lastThree : lastFive, includedInForecast: null };
    }
    sources.form = evidence("Recent regular-season box scores", null, query.seasonId, ["Recent scoring uses available game logs before the previous day; projection incorporation is unknown and no form bonus is added."]);
  } catch { sources.form = evidence("Recent box scores", null, query.seasonId, [`recent_form_${recentFormStage}_query_failed`]); }
  if (deploymentRead) {
    const deployment = await deploymentRead;
    if (deployment) {
      const units = new Map(deployment.units.map(row => [`${row.gameId}:${row.playerId}`, Number(row.unit)]));
      const staleBefore = new Date(now.getTime() - DEPLOYMENT_STALE_DAYS * 86400000).toISOString().slice(0, 10);
      for (const player of players) {
        const lineup = player.nhlId === null || player.playerClass === "goalie" || player.nhlTeamId === undefined ? undefined : deployment.newest.get(player.nhlTeamId);
        if (!lineup) continue;
        // Lineups list forwards line by line (three a line) and defence pair by pair; extras past L4/D3 get no line.
        const forward = (lineup.forwards ?? []).map(Number).indexOf(player.nhlId), defence = (lineup.defensemen ?? []).map(Number).indexOf(player.nhlId);
        if (forward < 0 && defence < 0) continue;
        const line = forward >= 0 ? (forward < 12 ? `L${Math.floor(forward / 3) + 1}` : null) : defence < 6 ? `D${Math.floor(defence / 2) + 1}` : null;
        // Unit 3 collects every skater past the top ten, so only PP1 and PP2 are shown.
        const unit = units.get(`${lineup.gameId}:${player.nhlId}`), powerPlayUnit = unit === 1 || unit === 2 ? unit : null;
        if (!line && !powerPlayUnit) continue;
        const asOf: string = lineup.game.date;
        player.deployment = { line, powerPlayUnit, asOf, stale: asOf < staleBefore || (lastPlayed.get(player.id) ?? "") > asOf };
      }
    }
    sources.deployment = evidence("Charted line combinations and power-play units", null, query.seasonId, deployment
      ? ["Lines and PP units from each team's newest charted game in the last two weeks; older than a week or a player's last game is stale."]
      : ["deployment_query_failed"]);
  }
  const weekRows = weeks;
  const matchupWeeks = new Set(weekRows.map((row: Row) => row.game_key)).size === 1 ? weekRows
    .filter((row: Row) => Number.isInteger(row.week) && row.week > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date) && row.start_date <= row.end_date)
    .map((row: Row) => ({ gameKey: String(row.game_key), week: row.week, startDate: row.start_date, endDate: row.end_date })) : [];
  sources.matchupWeeks = evidence("Yahoo matchup weeks", null, query.seasonId, matchupWeeks.length ? [] : ["Matchup week presets are unavailable for this season; use custom dates."]);
  const data: PlanningData = { players, games, forecasts, baselineSources: baseline.sources, participationSources: participation.sources,
    forecastManifest, evidence: sources, matchupWeeks };
  if (!scenarioOn) return data;
  // Informational only: it rides beside the data, never in forecasts, and gives way (disclosed) before the bridge wire does.
  const scenario = await loadLaterImpactScenario(db, { query, players, weekRows, calendarPolicy, membershipAsOf, rosterRevision,
    observation: bridged ? observation : null, deadline }).catch(() => null);
  let baseBytes = Infinity;
  try { baseBytes = planningBodyBytes(data, query.seasonId, servedProofs); } catch { /* too large either way: nothing attached */ }
  const laterImpactScenario = fitLaterImpactScenario(scenario, baseBytes);
  return laterImpactScenario ? { ...data, laterImpactScenario } as PlanningData : data;
}

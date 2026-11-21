import type { SupabaseClient } from "@supabase/supabase-js";
import { forecastCalendarDate, forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { selectForecastServingSource } from "lib/player-forecasts/forecastServingSource";
import { FORGE_DAILY_BRIDGE_VERSION, reserveCodeOf, reserveParticipationUnknown } from "lib/rosterScheduleData/bridgeForecastWire";
import { loadForgeDailyBridgeForecasts } from "lib/rosterScheduleData/forgeDailyBridge";
import { loadPlanningData } from "lib/rosterScheduleData/planning";
import { withinDeadline } from "lib/rosterScheduleData/planningInputs";
import { canEligibilityOccupySlot, normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { forecastAllows, gameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import type { ForecastDiscoveryExclusion, GameForecast, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import { admitConsumerGameRevisions, RSO_ASSUMED_PARTICIPATION_POLICY } from "../consumerRevisionAdmission";
import type { ForgeGameRevision } from "../gameRevisions";
import { forgeEnv } from "../forgeEnvScope";
import { starterBoardFlags, starterBoardScopeAllowed } from "../starterBoardFlags";
import type { SignedVerdictDecision } from "./signedVerdictGate";
import { MICROS_PER_MS, parseInstantMicros } from "./time";

export const HOSTED_RSO_CONTEXT = "synthetic-single-center-points-v1";
const weights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export type HostedRsoTarget = {
  contextId: string; playerNhlId: number; seasonId: number; gameId: number; slateDate: string; scheduledStart: string;
  claimId: string; revisionId: string; codeVersion: string; observedAt: string;
};
export type HostedRsoReader = {
  selectedRun: string | null; revisionId: string | null; playerId: string | null;
  points: number | null; legalSlot: string | null; reason: string | null;
  /** Context only: confirmed exclusions of the game's revision that name no player. Never the asked player's reason. */
  gameExclusions?: string[];
};
const withheld = (reason: string, playerId: string | null = null, selectedRun: string | null = null,
  revisionId: string | null = null): HostedRsoReader => ({ reason, playerId, selectedRun, revisionId, points: null, legalSlot: null });

/** The detailed reader's reason for a player without a published row: only an exclusion that names this player and that
 * the planner itself reported. A game-level exclusion (no playerId) belongs to the revision, not to this player; it is
 * returned as context and never replaces "no_usable_target". */
export function attributeDetailedExclusion(exclusions: ForecastDiscoveryExclusion[], reported: ForecastDiscoveryExclusion[],
  gameId: string, playerId: string): { reason: string; gameExclusions: string[] } {
  const confirmedBy = (ex: ForecastDiscoveryExclusion) => reported.some(other => other.gameId === gameId
    && other.playerId === ex.playerId && other.targetKey === ex.targetKey && other.reasons.includes(ex.reasons[0]));
  const own = exclusions.find(ex => ex.playerId === playerId && confirmedBy(ex));
  const gameExclusions = [...new Set(exclusions.filter(ex => !ex.playerId && confirmedBy(ex)).map(ex => ex.reasons[0]))];
  return { reason: own?.reasons[0] ?? "no_usable_target", gameExclusions };
}

/** Read the two FORGE paths independently for a manual, explicitly synthetic one-player roster.
 * Points are the RSO readback of an admitted row. The slot is its legal position in this roster. */
export type HostedRsoOptions = {
  /** Live runs: each reader independently refuses unless the claim's signed verdict verifies (signedVerdictGate.ts). */
  verdictGate?: () => Promise<SignedVerdictDecision>;
};
export async function readHostedRsoConsumers(db: SupabaseClient, target: HostedRsoTarget, now = new Date(), options: HostedRsoOptions = {}) {
  const { seasonId, slateDate, gameId, playerNhlId, claimId, revisionId, codeVersion } = target;
  const evaluatedAt = now.toISOString();
  const report = (daily: HostedRsoReader, detailed: HostedRsoReader) =>
    ({ contextId: HOSTED_RSO_CONTEXT, playerNhlId, evaluatedAt, daily, detailed });
  const both = (reason: string, playerId?: string) => report(withheld(reason, playerId), withheld(reason, playerId));
  const calendar = forecastCalendarPolicy(Number(forgeEnv().STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
  try {
    if (target.contextId !== HOSTED_RSO_CONTEXT || !Number.isSafeInteger(playerNhlId) || playerNhlId <= 0 ||
        !Number.isSafeInteger(gameId) || gameId <= 0 || !Number.isSafeInteger(seasonId) || !uuid.test(claimId) ||
        !uuid.test(revisionId) || !/^[a-f0-9]{40}$/.test(codeVersion) || forecastCalendarDate(target.scheduledStart) !== slateDate) {
      return both("invalid_reader_binding");
    }
    const observed = parseInstantMicros(target.observedAt), clock = BigInt(now.getTime()) * MICROS_PER_MS;
    if (clock < observed) return both("publication_not_observed");
    if (clock >= parseInstantMicros(target.scheduledStart)) return both("stale_source");
    const query = { seasonId, startDate: slateDate, endDate: slateDate, timeZone: "America/New_York" };
    const deadline = Date.now() + 20_000;
    const source = await withinDeadline(deadline, signal => selectForecastServingSource(db, seasonId, now, forgeEnv(), signal));
    const data = await loadPlanningData(db, query, { now, deadlineMs: deadline, source, consumer: "rso", skipOwnership: true, skipRecentForm: true });
    const player = data.players.find(row => row.nhlId === playerNhlId);
    if (!player?.rosterRevision || !player.teamAbbreviation) return both("identity_conflict", player?.id);
    if (data.evidence.schedule?.completeness !== "complete") return both("incomplete_refresh", player.id);
    const sides = data.games.filter(row => row.id === String(gameId));
    const game = sides.find(row => row.teamAbbreviation === player.teamAbbreviation);
    if (!game || sides.length !== 2 || sides.some(row => row.status !== "scheduled" || !row.startsAt ||
        parseInstantMicros(row.startsAt) !== parseInstantMicros(target.scheduledStart))) return both("game_mismatch", player.id);
    const rules: PlanningSnapshot["rules"] = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1,
      periods: [], scoring: { mode: "points", weights, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] };
    const legalSlot = expandActiveSlots(rules.rosterSlots).activeSlots.find(slot => canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slot.type));
    if (!legalSlot) return both("ineligible_position", player.id);
    const snapshot: PlanningSnapshot = { id: HOSTED_RSO_CONTEXT, context: { provider: "manual", leagueId: HOSTED_RSO_CONTEXT, teamId: HOSTED_RSO_CONTEXT,
      ...query, asOf: evaluatedAt }, players: [player], games: [game], forecasts: [], rules, evidence: data.evidence,
      roster: [{ playerId: player.id, position: "active" }], lockedAssignments: [], opponent: null, realized: {} };
    const score = (row: GameForecast, selectedRun: string): HostedRsoReader => {
      const deny = (reason: string) => withheld(reason, player.id, selectedRun, row.revisionId);
      const issued = row.issuedContext;
      if (!issued || issued.nhlPlayerId !== playerNhlId || issued.seasonId !== seasonId || issued.teamId !== player.nhlTeamId ||
          issued.rosterRevision !== player.rosterRevision || issued.scheduleRevision !== game.scheduleRevision ||
          issued.scheduledAt !== game.startsAt || issued.playerId !== player.id || issued.gameId !== game.id) return deny("identity_conflict");
      if (!row.expiresAt || !(Date.parse(row.expiresAt) > now.getTime())) return deny("stale_source");
      if (reserveParticipationUnknown(reserveCodeOf(row))) return deny("missing_participation");
      if (!Object.keys(weights).every(key => forecastAllows(row, key, "assignment") && forecastAllows(row, key, "totals") && forecastAllows(row, key, "comparison"))) return deny("use_not_approved");
      const points = gameForecastPoints({ ...snapshot, forecasts: [row] }, row).expected;
      return points === null ? deny("missing_target") : { playerId: player.id, selectedRun, revisionId: row.revisionId, legalSlot: legalSlot.id, points, reason: null };
    };
    const verdictRefusal = async () => {
      if (!options.verdictGate) return null;
      const verdict = await options.verdictGate().catch(() => null);
      return verdict?.ok ? null : withheld(`signed_verdict:${verdict?.reason ?? "unverifiable"}`, player.id);
    };
    const daily = async () => {
      const refused = await verdictRefusal();
      if (refused) return refused;
      if (source.kind !== "legacy" || forgeEnv().RSO_FORGE_DAILY_BRIDGE === "off") return withheld("serving_disabled", player.id);
      const bridge = await loadForgeDailyBridgeForecasts(db, [player], [game], now, seasonId, deadline, calendar);
      const rows = bridge.forecasts.filter(row => row.playerId === player.id && row.gameId === game.id);
      if (rows.length !== 1) return withheld("no_usable_target", player.id);
      const [row] = rows;
      const proof = bridge.runProofs.find(item => row.revisionId === `${FORGE_DAILY_BRIDGE_VERSION}:${item.runId}`);
      const deny = (reason: string) => withheld(reason, player.id, proof?.runId, row.revisionId);
      if (!proof || proof.runId !== claimId) return deny("run_mismatch");
      if (proof.basis !== "captured_snapshot") return deny("capture_proof_missing");
      if (row.modelVersion !== `${FORGE_DAILY_BRIDGE_VERSION}:${codeVersion}`) return deny("release_mismatch");
      // The released bridge stamps a run's issuedAt with the run's created_at. Bind the row to the committed run of this
      // publication: same created_at, and created no later than the publication was observed.
      const run = await withinDeadline(deadline, signal => db.from("forge_runs").select("created_at").eq("run_id", claimId)
        .abortSignal(signal).maybeSingle());
      const createdAt = (run.data as { created_at?: string } | null)?.created_at;
      if (run.error || !createdAt || parseInstantMicros(createdAt) > observed
        || Date.parse(row.issuedAt) !== Date.parse(new Date(createdAt).toISOString())) return deny("publication_mismatch");
      return score(row, proof.runId);
    };
    const detailed = async () => {
      const refused = await verdictRefusal();
      if (refused) return refused;
      if (!starterBoardFlags().serving) return withheld("serving_disabled", player.id);
      if (!starterBoardScopeAllowed([gameId])) return withheld("canary_excluded", player.id);
      // A planner exclusion has no revision ID. Bind it to the selected SQL revision and repeat its native
      // admission before attributing a withheld player to this publication.
      const result = await withinDeadline(deadline, signal => db.rpc("read_forge_game_revisions", { p_slate_date: slateDate }).abortSignal(signal));
      if (result.error || !Array.isArray(result.data)) return withheld("discovery_failed", player.id);
      const selected = (result.data as ForgeGameRevision[]).filter(row => row.game_id === gameId);
      if (selected.length !== 1) return withheld("no_issued_revision", player.id);
      const [revision] = selected;
      const deny = (reason: string) => withheld(reason, player.id, revision.run_id, revision.id);
      if (revision.run_id !== claimId) return deny("run_mismatch");
      if (revision.id !== revisionId || parseInstantMicros(revision.published_at) !== observed) return deny("publication_mismatch");
      if (revision.payload.codeVersion !== codeVersion) return deny("release_mismatch");
      const rows = data.forecasts.filter(row => row.gameId === game.id && row.playerId === player.id);
      if (rows.length === 1 && rows[0].revisionId === revisionId && rows[0].modelVersion === codeVersion) return score(rows[0], claimId);
      if (rows.length) return deny("publication_mismatch");
      const exclusions: ForecastDiscoveryExclusion[] = [];
      await admitConsumerGameRevisions(db, selected, data.players, sides, now, seasonId, {}, exclusions, deadline, calendar,
        RSO_ASSUMED_PARTICIPATION_POLICY);
      const { reason, gameExclusions } = attributeDetailedExclusion(exclusions, data.forecastManifest?.exclusions ?? [], game.id, player.id);
      return gameExclusions.length ? { ...deny(reason), gameExclusions } : deny(reason);
    };
    const [bridge, primary] = await Promise.all([daily(), detailed()].map(read => read.catch(() => withheld("reader_unavailable", player.id))));
    return report(bridge, primary);
  } catch {
    return both("reader_unavailable");
  }
}

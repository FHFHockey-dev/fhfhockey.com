import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarLeadDay, forecastCalendarPolicy, validForecastCalendarPolicy, type AnyForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { boardGoalieForecast, boardSkaterForecast, completeBoardSkaterStatsFromProjection } from "./starterBoardScoring";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "./issuedContext";
import { acceptedNewsSupersedes, loadAcceptedForecastNews } from "./acceptedNews";
import { applyRsoParticipationOverlay, INJURY_EVENTS, loadRsoParticipationSources, type RsoParticipationSources } from "./rsoParticipationOverlay";
import { DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_LINE_ROLE_NOTE, DETAILED_PARTICIPATION_NOTES, overlayChangeNote,
  type RsoParticipationBasis } from "./rsoParticipationNotes";
import type { ForgeGameRevision } from "./gameRevisions";
import { withinDeadline } from "lib/rosterScheduleData/planningInputs";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "./calibrationEligibility";
import type { ForecastDiscoveryExclusion, ForecastExclusionReason, GameForecast, PlanningGame, PlanningIssuedContext, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";

type Row = Record<string, any>;
export type AdmittedConsumerSource = {
  forecast: GameForecast & { issuedContext: PlanningIssuedContext };
  revision: ForgeGameRevision;
  source: { kind: "skater" | "goalie"; row: Row };
};
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * TJ's Detailed RSO participation policy (2026-11-21, amends decisions 3 and 47 for Detailed RSO only). A skater on his
 * team's issued active roster with no active injury or confirmed exclusion is assumed to play; an active injury is assumed
 * out until a credible game-specific report confirms him back; confirmed scratches, suspensions and other exclusions
 * override the healthy default. Possible returns, projected lines, PP roles and practice never confirm anything. Later
 * changes are replayed at read time over the saved "if he plays" line (rsoParticipationOverlay.ts), each recorded as its
 * own timestamped limitation; the issued row is never rewritten. Opt-in per consumer.
 */
export const RSO_ASSUMED_PARTICIPATION_POLICY = "rso-assumed-participation-v1" as const;
export type DetailedParticipationPolicy = typeof RSO_ASSUMED_PARTICIPATION_POLICY;
export type DetailedParticipationBasis = RsoParticipationBasis;
/** Review scope of policy rows: the participation method a reviewed RSO use must name (decision D5 review lane). Defined
 * with the resolver, which requires an `@issuance` for it as for every issued method. */
export { RSO_PARTICIPATION_OVERLAY_METHOD } from "lib/player-forecasts/rsoUseResolver";
export const RSO_PARTICIPATION_OVERLAY_CONDITIONING = "rso_participation_overlay";
export { DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_LINE_ROLE_NOTE, DETAILED_PARTICIPATION_NOTES,
  detailedParticipationBasisOf, overlayChangeNote } from "./rsoParticipationNotes";
/** Read-time inputs for the policy. `sources` null means they could not be read: policy rows are then withheld.
 * `superseded` revisions have accepted news after their cutoff: their skater rows stay (the overlay applies the news),
 * every other row of theirs is withdrawn as stale. */
export type RsoParticipationContext = { sources: RsoParticipationSources | null; superseded: ReadonlySet<string> };

const validCapturedTime = (value: unknown, observedAt: string) => value === null
  || typeof value === "string" && !acceptedNewsSupersedes(value, observedAt);

/** Whitelist issued, selected FORGE outputs. Research/admin payloads never leave this boundary. */
export function publicPlanningForecasts(revisions: ForgeGameRevision[], players: PlanningPlayer[], games: PlanningGame[], now: Date,
  exclusions: Record<string, number> = {}, exclusionRows: ForecastDiscoveryExclusion[] = [], expectedSeasonId?: number,
  calendarPolicy: AnyForecastCalendarPolicy = forecastCalendarPolicy(),
  admittedSources: Map<string, AdmittedConsumerSource> = new Map(),
  rsoParticipation?: RsoParticipationContext): GameForecast[] {
  const excluded = (reason: ForecastExclusionReason, gameId: string, playerId?: string, targetKey?: string) => {
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, ...(playerId ? { playerId } : {}),
      ...(targetKey ? { targetKey } : {}), reasons: [reason] });
  };
  const byNhl = new Map(players.filter((player) => player.nhlId !== null).map((player) => [player.nhlId, player]));
  const nhlCounts = new Map<number, number>();
  for (const player of players) if (player.nhlId !== null) nhlCounts.set(player.nhlId, (nhlCounts.get(player.nhlId) ?? 0) + 1);
  const gamesById = new Map<string, PlanningGame[]>();
  for (const game of games) gamesById.set(game.id, [...(gamesById.get(game.id) ?? []), game]);
  const forecasts = new Map<string, GameForecast>();
  const conflictingIssueTimes = new Map<string, string>();
  for (const revision of revisions) {
    const gameId = String(revision.game_id);
    if (!revision.id || !revision.run_id || !Array.isArray(revision.payload?.players)
      || !Array.isArray(revision.payload?.goalies) || !Array.isArray(revision.payload?.teams)) {
      excluded("identity_conflict", gameId); continue;
    }
    if (!gamesById.has(gameId)) { excluded("game_mismatch", gameId); continue; }
    if (acceptedNewsSupersedes(revision.published_at, now.toISOString())) { excluded("future_input", gameId); continue; }
    const cutoffAt = revision.payload.inputCutoff ?? revision.decision_as_of;
    const currentGames = gamesById.get(gameId)!;
    if (new Set(currentGames.map(game => game.startsAt)).size !== 1) { excluded("game_mismatch", gameId); continue; }
    // Decision 127: the policy decides the date basis; v2 counts the schedule's own NHL date.
    const lead = calendarLeadDay(currentGames[0].startsAt ?? "", now.toISOString(), calendarPolicy, currentGames[0].date);
    if (!validForecastCalendarPolicy(calendarPolicy) || !Number.isFinite(lead) || lead >= calendarPolicy.calendarDays) {
      excluded("outside_horizon", gameId); continue;
    }
    const expiresAt = new Date(Math.min(Date.parse(revision.published_at) + 36 * 3600000, Date.parse(currentGames[0].startsAt ?? "") || Infinity)).toISOString();
    if (acceptedNewsSupersedes(cutoffAt, revision.published_at)) { excluded("invalid_cutoff", gameId); continue; }
    if (Date.parse(expiresAt) <= now.getTime()) { excluded("stale_source", gameId); continue; }
    const provenance = revision.payload.inputProvenance;
    const receipt = provenance?.capturedReads;
    if (!receipt || receipt.version !== "forge-captured-reads-v1" || !/^[a-f0-9]{64}$/.test(receipt.hash)
      || !Number.isSafeInteger(receipt.readCount) || receipt.readCount < 1
      || !Number.isFinite(Date.parse(receipt.firstReceivedAt)) || !Number.isFinite(Date.parse(receipt.lastReceivedAt))
      || acceptedNewsSupersedes(receipt.firstReceivedAt, receipt.lastReceivedAt)
      || acceptedNewsSupersedes(receipt.lastReceivedAt, revision.published_at)) {
      excluded("identity_conflict", gameId); continue;
    }
    const candidates = Array.isArray(provenance?.issuedContexts) ? provenance.issuedContexts.filter((row): row is ForgeIssuedContextV1 =>
      row?.game?.id === revision.game_id && row?.version === "forge-issued-context-v1") : [];
    if (candidates.length !== 1) { excluded("identity_conflict", gameId); continue; }
    const issued = candidates[0];
    if (!Number.isSafeInteger(issued.game.seasonId) || expectedSeasonId !== undefined && issued.game.seasonId !== expectedSeasonId
      || acceptedNewsSupersedes(issued.observedAt, revision.published_at)
      || !Number.isFinite(Date.parse(issued.game.startTime))
      || new Date(issued.game.startTime).toISOString() !== currentGames[0].startsAt
      || !Array.isArray(issued.schedule) || issued.schedule.length !== 2
      || !Array.isArray(issued.roster) || issued.roster.some(row => !row)
      || !Number.isSafeInteger(issued.game.homeTeamId) || !Number.isSafeInteger(issued.game.awayTeamId)
      || issued.game.homeTeamId === issued.game.awayTeamId
      || issued.schedule.some(row => !row || row.sourceSeasonId !== issued.game.seasonId
        || !Number.isFinite(Date.parse(row.startTime)) || Date.parse(row.startTime) !== Date.parse(issued.game.startTime)
        || ![issued.game.homeTeamId, issued.game.awayTeamId].includes(row.teamId)
        || row.opponentTeamId !== (row.teamId === issued.game.homeTeamId ? issued.game.awayTeamId : issued.game.homeTeamId)
        || !row.teamAbbreviation || !row.revision
        || !validCapturedTime(row.sourceUpdatedAt, issued.observedAt)
        || !validCapturedTime(row.fetchedAt, issued.observedAt)
        || row.revision !== forgeScheduleRevision({ source_game_id: issued.game.id, start_time: row.startTime,
          team_abbreviation: row.teamAbbreviation, opponent_abbreviation: row.opponentAbbreviation,
          game_status: row.gameStatus, schedule_status: row.scheduleStatus }))
      || new Set(issued.schedule.map(row => row.teamId)).size !== 2) { excluded("identity_conflict", gameId); continue; }
    if (provenance?.external_fantasy_input_contract !== FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT) {
      excluded("use_not_approved", gameId); continue;
    }
    const emit = (source: AdmittedConsumerSource["source"], nhlId: number, teamId: number, rowGameId: number, stats: Record<string, number | null> | null, startProbability: number | null, confirmedStart: boolean, limitations: string[], conditionalStats?: StatLine | null, appearanceProbability?: number | null, missingReason: ForecastExclusionReason = "unsupported_conditioning") => {
      const player = byNhl.get(nhlId);
      const currentGame = currentGames.find(game => game.teamAbbreviation === player?.teamAbbreviation);
      if (!player || nhlCounts.get(nhlId) !== 1 || player.nhlTeamId !== teamId || String(rowGameId) !== gameId || !currentGame
        || player.playerClass !== source.kind) { excluded("identity_conflict", gameId, player?.id); return; }
      const schedule = issued.schedule.find(row => row.teamId === teamId);
      const roster = issued.roster?.filter(row => row.nhlId === nhlId);
      if (!schedule || schedule.revision !== currentGame.scheduleRevision
        || schedule.teamAbbreviation !== player.teamAbbreviation || schedule.opponentAbbreviation !== currentGame.opponent
        || roster?.length !== 1 || String(roster[0].canonicalId) !== player.id
        || roster[0].seasonId !== issued.game.seasonId || roster[0].teamId !== teamId
        || !Array.isArray(roster[0].membershipCreatedAt)
        || !roster[0].membershipCreatedAt.length
        || roster[0].membershipCreatedAt.some(value => typeof value !== "string" || !validCapturedTime(value, issued.observedAt))
        || !validCapturedTime(roster[0].identityUpdatedAt, issued.observedAt)
        || roster[0].revision !== player.rosterRevision
        || roster[0].revision !== forgeRosterRevision(roster[0])) { excluded("identity_conflict", gameId, player.id); return; }
      if (!stats) { excluded(missingReason, gameId, player.id); return; }
      const safeStats = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, numberOrNull(value)]));
      for (const [targetKey, value] of Object.entries(safeStats)) if (value === null) excluded("missing_target", gameId, player.id, targetKey);
      if (!Object.values(safeStats).some((value) => value !== null)) { excluded("no_usable_target", gameId, player.id); return; }
      const issuedContext: PlanningIssuedContext = { version: "forge-issued-context-v1", playerId: player.id,
        gameId, nhlPlayerId: nhlId, seasonId: issued.game.seasonId, teamId,
        scheduledAt: new Date(issued.game.startTime).toISOString(), scheduleRevision: schedule.revision, rosterRevision: roster[0].revision,
        observedAt: issued.observedAt, scheduleSourceUpdatedAt: schedule.sourceUpdatedAt,
        scheduleFetchedAt: schedule.fetchedAt, identityUpdatedAt: roster[0].identityUpdatedAt,
        membershipCreatedAt: [...roster[0].membershipCreatedAt] };
      const output: AdmittedConsumerSource["forecast"] = {
        sourceKind: "detailed", cutoffAt, expiresAt, sourceWatermark: `forge-captured-reads-v1:${receipt.hash}`,
        issuedContext,
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
        ...(conditionalStats ? { conditionalStats: Object.fromEntries(Object.entries(conditionalStats).map(([key, value]) => [key, numberOrNull(value)])) } : {}),
        appearanceProbability: appearanceProbability ?? null,
        playerId: player.id, gameId, stats: safeStats, conditioning: "unconditional", startProbability, confirmedStart,
        revisionId: revision.id, issuedAt: revision.published_at,
        modelVersion: revision.payload.codeVersion ?? null,
        limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...limitations],
      };
      const key = `${player.id}:${gameId}`, previous = forecasts.get(key);
      const conflictingTime = conflictingIssueTimes.get(key);
      if (conflictingTime && !acceptedNewsSupersedes(output.issuedAt, conflictingTime)) {
        excluded("conflicting_forecast", gameId, player.id); return;
      }
      const later = previous && acceptedNewsSupersedes(output.issuedAt, previous.issuedAt);
      const sameTime = previous && !later && !acceptedNewsSupersedes(previous.issuedAt, output.issuedAt);
      if (previous && sameTime && (previous.revisionId !== output.revisionId
        || previous.sourceWatermark !== output.sourceWatermark || previous.modelVersion !== output.modelVersion
        || JSON.stringify(previous.stats) !== JSON.stringify(output.stats))) {
        forecasts.delete(key); admittedSources.delete(key); conflictingIssueTimes.set(key, output.issuedAt);
        excluded("conflicting_forecast", gameId, player.id); return;
      }
      if (!previous || later) {
        forecasts.set(key, output);
        admittedSources.set(key, { forecast: output, revision, source });
        conflictingIssueTimes.delete(key);
      }
    };
    const skaters = revision.payload.players.filter(row => {
      if (!row || typeof row !== "object") { excluded("identity_conflict", gameId); return false; }
      if (row.horizon_games !== 1) { excluded("outside_horizon", gameId, byNhl.get(row.player_id)?.id); return false; }
      if (row.as_of_date !== issued.game.date || row.run_id !== revision.run_id) {
        excluded("identity_conflict", gameId, byNhl.get(row.player_id)?.id); return false;
      }
      return true;
    });
    const skaterCounts = new Map<string, number>();
    for (const row of skaters) {
      const key = `${row.game_id}:${row.team_id}:${row.player_id}`;
      skaterCounts.set(key, (skaterCounts.get(key) ?? 0) + 1);
    }
    for (const row of skaters) {
      const schedule = issued.schedule.find(item => item.teamId === row.team_id);
      if (skaterCounts.get(`${row.game_id}:${row.team_id}:${row.player_id}`)! > 1
        || row.opponent_team_id != null && row.opponent_team_id !== schedule?.opponentTeamId) {
        excluded("identity_conflict", gameId, byNhl.get(row.player_id)?.id); continue;
      }
      const stats = completeBoardSkaterStatsFromProjection(row);
      const prediction = boardSkaterForecast(stats, row.uncertainty, { gameId: row.game_id, teamId: row.team_id,
        playerId: row.player_id, horizonGames: row.horizon_games, cutoffAt, evidence: revision.payload.evidence });
      // The shared skater model can be conditional-only. Do not assume participation = 1, except under the opted-in
      // Detailed RSO policy, which replays availability at read time over the saved line and labels every assumption.
      if (rsoParticipation) {
        const player = byNhl.get(row.player_id);
        const target = currentGames.find(game => game.teamAbbreviation === player?.teamAbbreviation);
        if (!rsoParticipation.sources) { excluded("incomplete_refresh", gameId, player?.id); continue; }
        const line = prediction.conditional;
        const overlay = line && target?.startsAt ? applyRsoParticipationOverlay({ coverage: row.uncertainty?.availability,
          playerNhlId: row.player_id, teamId: row.team_id, gameId: row.game_id, gameDate: target.date, gameStartsAt: target.startsAt,
          revisionCutoff: cutoffAt, sources: rsoParticipation.sources,
          teamGameStarts: games.filter(game => game.teamAbbreviation === target.teamAbbreviation && game.startsAt).map(game => game.startsAt!) }) : null;
        if (overlay && line) {
          const playing = overlay.basis.endsWith("_playing");
          const counted = Object.fromEntries(Object.entries(line).map(([key, value]) => [key, value == null ? null : playing ? value : 0]));
          emit({ kind: "skater", row }, row.player_id, row.team_id, row.game_id, counted, null, false, [...prediction.conflicts,
            ...overlay.changes.map(overlayChangeNote), ...(overlay.conflict ? [DETAILED_PARTICIPATION_CONFLICT_NOTE] : []),
            ...(overlay.lineRoleChanged ? [DETAILED_PARTICIPATION_LINE_ROLE_NOTE] : []), DETAILED_PARTICIPATION_NOTES[overlay.basis]],
          line, playing ? 1 : 0);
          continue;
        }
        // Without a replayable status, a revision that news has superseded is stale, as before.
        if (rsoParticipation.superseded.has(revision.id)) { excluded("stale_source", gameId, player?.id); continue; }
      }
      emit({ kind: "skater", row }, row.player_id, row.team_id, row.game_id, prediction.expected, null, false, prediction.conflicts,
        prediction.conditional, prediction.participationProbability,
        prediction.conditioning === "conditional_playing" ? "missing_participation" : "unsupported_conditioning");
    }
    // Goalie starts are not replayed: a revision superseded by news withdraws them until it is refreshed.
    if (rsoParticipation?.superseded.has(revision.id)) {
      if ((revision.payload.goalies ?? []).length) excluded("stale_source", gameId);
      continue;
    }
    const goalieGroups = new Map<string, { gameId: number; teamId: number; candidates: Row[] }>();
    for (const row of revision.payload.goalies ?? []) {
      if (!row || typeof row !== "object") { excluded("identity_conflict", gameId); continue; }
      if (row.horizon_games !== 1) { excluded("outside_horizon", gameId); continue; }
      if (row.as_of_date !== issued.game.date || row.run_id !== revision.run_id) { excluded("identity_conflict", gameId); continue; }
      const key = `${row.game_id}:${row.team_id}`;
      const group = goalieGroups.get(key) ?? { gameId: row.game_id, teamId: row.team_id, candidates: [] as Row[] };
      group.candidates.push(...(row.uncertainty?.daily_board_candidates ?? []));
      goalieGroups.set(key, group);
    }
    for (const group of goalieGroups.values()) {
      const { candidates } = group;
      const ids = candidates.map(candidate => candidate.playerId);
      const probabilities = candidates.map(candidate => numberOrNull(candidate.startingProbability));
      const mass = probabilities.reduce((sum: number, value: number | null) => sum + (value ?? 0), 0);
      if (new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        excluded("identity_conflict", gameId); continue;
      }
      if (mass > 1.000001 || probabilities.some((value: number | null) => value === null || value < 0 || value > 1)) {
        excluded("unsupported_conditioning", gameId); continue;
      }
      for (const candidate of candidates) {
        const prediction = boardGoalieForecast(candidate, { gameId: group.gameId, teamId: group.teamId,
          playerId: candidate.playerId, horizonGames: 1, cutoffAt, evidence: revision.payload.evidence });
        emit({ kind: "goalie", row: candidate }, candidate.playerId, group.teamId, group.gameId,
          prediction?.expected ?? null, prediction?.participationProbability ?? null,
          prediction?.probabilityStatus === "confirmed_evidence",
          ["Goalie start assignments share one team-game; no guaranteed future starts.", "Non-start relief contribution is unavailable."], prediction?.conditional);
      }
    }
  }
  return [...forecasts.values()];
}

/** Both public consumers use the same accepted-evidence and issued-output checks. */
export async function admitConsumerGameRevisions(db: SupabaseClient<any>, revisions: ForgeGameRevision[],
  players: PlanningPlayer[], games: PlanningGame[], now: Date, seasonId: number,
  exclusionCounts: Record<string, number> = {}, exclusionRows: ForecastDiscoveryExclusion[] = [],
  deadline = Date.now() + 2000, calendarPolicy: ForecastCalendarPolicy = forecastCalendarPolicy(),
  participationPolicy?: DetailedParticipationPolicy) {
  const limitations: string[] = [];
  const recordExclusion = (gameId: string, reason: ForecastExclusionReason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, reasons: [reason] });
  };
  let acceptedNewsRevision: string | null = null;
  let currentRevisions = revisions;
  const superseded = new Set<string>();
  if (revisions.length) {
    try {
      const newsDeadline = Math.min(deadline, Date.now() + 2000);
      const news = await withinDeadline(newsDeadline, () => loadAcceptedForecastNews(db, revisions.map(row => row.game_id), now.toISOString(), newsDeadline));
      acceptedNewsRevision = news.revisionHash;
      currentRevisions = revisions.filter(revision => {
        const acceptedAt = news.latestAcceptedAt.get(revision.game_id);
        if (!acceptedAt || !acceptedNewsSupersedes(acceptedAt, revision.payload.inputCutoff ?? revision.decision_as_of)) return true;
        // Under the RSO policy the overlay applies the news to skaters; only rows it cannot replay are withdrawn.
        if (participationPolicy) { superseded.add(revision.id); return true; }
        recordExclusion(String(revision.game_id), "stale_source");
        return false;
      });
      if (currentRevisions.length !== revisions.length || superseded.size) limitations.push("New accepted evidence supersedes some issued forecasts; affected decisions remain unresolved until refresh.");
    } catch {
      currentRevisions = [];
      for (const id of new Set(revisions.map(row => String(row.game_id)))) recordExclusion(id, "incomplete_refresh");
      limitations.push("Accepted evidence freshness could not be verified; issued forecasts are temporarily unavailable.");
    }
  }
  let rsoParticipation: RsoParticipationContext | undefined;
  if (participationPolicy) {
    let sources: RsoParticipationSources | null = null;
    if (currentRevisions.length) {
      try {
        const overlayDeadline = Math.min(deadline, Date.now() + 4000);
        // Only skaters this request can serve (its planning players), and appearances only for those the issued
        // rows show injured: an appearance lifts nothing else.
        const planned = new Set(players.map(player => player.nhlId));
        const rows = currentRevisions.flatMap(revision => (revision.payload?.players ?? []) as Row[])
          .filter(row => Number.isSafeInteger(row?.player_id) && planned.has(row.player_id));
        const injured = rows.filter(row => INJURY_EVENTS.has(row.uncertainty?.availability?.event_type)
          || row.uncertainty?.availability?.event_type === "RETURN");
        sources = await withinDeadline(overlayDeadline, () => loadRsoParticipationSources(db, { gameIds: currentRevisions.map(row => row.game_id),
          playerNhlIds: rows.map(row => row.player_id), appearancePlayerNhlIds: injured.map(row => row.player_id),
          readAt: now.toISOString(), deadlineMs: overlayDeadline }));
      } catch {
        limitations.push("Current player availability could not be read; affected skater forecasts are temporarily unavailable.");
      }
    }
    rsoParticipation = { sources, superseded };
  }
  const admittedSources = new Map<string, AdmittedConsumerSource>();
  const forecasts = publicPlanningForecasts(currentRevisions, players, games, now, exclusionCounts, exclusionRows,
    seasonId, calendarPolicy, admittedSources, rsoParticipation);
  return { forecasts, currentRevisions, acceptedNewsRevision, limitations, admittedSources: [...admittedSources.values()] };
}

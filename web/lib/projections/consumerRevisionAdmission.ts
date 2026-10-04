import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarLeadDay, forecastCalendarPolicy, validForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { boardGoalieForecast, boardSkaterForecast, completeBoardSkaterStatsFromProjection } from "./starterBoardScoring";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "./issuedContext";
import { acceptedNewsSupersedes, loadAcceptedForecastNews } from "./acceptedNews";
import type { ForgeGameRevision } from "./gameRevisions";
import { withinDeadline } from "lib/rosterScheduleData/planningInputs";
import type { ForecastDiscoveryExclusion, ForecastExclusionReason, GameForecast, PlanningGame, PlanningIssuedContext, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";

type Row = Record<string, any>;
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const validCapturedTime = (value: unknown, observedAt: string) => value === null
  || typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(observedAt);

/** Whitelist issued, selected FORGE outputs. Research/admin payloads never leave this boundary. */
export function publicPlanningForecasts(revisions: ForgeGameRevision[], players: PlanningPlayer[], games: PlanningGame[], now: Date,
  exclusions: Record<string, number> = {}, exclusionRows: ForecastDiscoveryExclusion[] = [], expectedSeasonId?: number,
  calendarPolicy: ForecastCalendarPolicy = forecastCalendarPolicy()): GameForecast[] {
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
  for (const revision of revisions) {
    const gameId = String(revision.game_id);
    if (!gamesById.has(gameId)) { excluded("game_mismatch", gameId); continue; }
    if (!Number.isFinite(Date.parse(revision.published_at)) || Date.parse(revision.published_at) > now.getTime()) { excluded("future_input", gameId); continue; }
    const cutoffAt = revision.payload.inputCutoff ?? revision.decision_as_of;
    const currentGames = gamesById.get(gameId)!;
    if (new Set(currentGames.map(game => game.startsAt)).size !== 1) { excluded("game_mismatch", gameId); continue; }
    const lead = calendarLeadDay(currentGames[0].startsAt ?? "", now.toISOString());
    if (!validForecastCalendarPolicy(calendarPolicy) || !Number.isFinite(lead) || lead >= calendarPolicy.calendarDays) {
      excluded("outside_horizon", gameId); continue;
    }
    const expiresAt = new Date(Math.min(Date.parse(revision.published_at) + 36 * 3600000, Date.parse(currentGames[0].startsAt ?? "") || Infinity)).toISOString();
    if (!Number.isFinite(Date.parse(cutoffAt)) || Date.parse(cutoffAt) > Date.parse(revision.published_at)) { excluded("invalid_cutoff", gameId); continue; }
    if (Date.parse(expiresAt) <= now.getTime()) { excluded("stale_source", gameId); continue; }
    const provenance = revision.payload.inputProvenance;
    const receipt = provenance?.capturedReads;
    if (!receipt || receipt.version !== "forge-captured-reads-v1" || !/^[a-f0-9]{64}$/.test(receipt.hash)
      || !Number.isSafeInteger(receipt.readCount) || receipt.readCount < 1
      || !Number.isFinite(Date.parse(receipt.firstReceivedAt)) || !Number.isFinite(Date.parse(receipt.lastReceivedAt))
      || Date.parse(receipt.firstReceivedAt) > Date.parse(receipt.lastReceivedAt)
      || Date.parse(receipt.lastReceivedAt) > Date.parse(revision.published_at)) {
      excluded("identity_conflict", gameId); continue;
    }
    const candidates = Array.isArray(provenance?.issuedContexts) ? provenance.issuedContexts.filter((row): row is ForgeIssuedContextV1 =>
      row?.game?.id === revision.game_id && row?.version === "forge-issued-context-v1") : [];
    if (candidates.length !== 1) { excluded("identity_conflict", gameId); continue; }
    const issued = candidates[0];
    if (!Number.isSafeInteger(issued.game.seasonId) || expectedSeasonId !== undefined && issued.game.seasonId !== expectedSeasonId
      || !Number.isFinite(Date.parse(issued.observedAt)) || Date.parse(issued.observedAt) > Date.parse(revision.published_at)
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
    const emit = (nhlId: number, teamId: number, rowGameId: number, stats: Record<string, number | null> | null, startProbability: number | null, confirmedStart: boolean, limitations: string[], conditionalStats?: StatLine | null, appearanceProbability?: number | null, missingReason: ForecastExclusionReason = "unsupported_conditioning") => {
      const player = byNhl.get(nhlId);
      const currentGame = currentGames.find(game => game.teamAbbreviation === player?.teamAbbreviation);
      if (!player || nhlCounts.get(nhlId) !== 1 || player.nhlTeamId !== teamId || String(rowGameId) !== gameId || !currentGame) { excluded("identity_conflict", gameId, player?.id); return; }
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
      const output: GameForecast = {
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
      if (!previous || previous.issuedAt < output.issuedAt) forecasts.set(key, output);
    };
    for (const row of revision.payload.players ?? []) {
      const stats = completeBoardSkaterStatsFromProjection(row);
      const prediction = boardSkaterForecast(stats, row.uncertainty);
      // The shared skater model can be conditional-only. Do not assume participation = 1.
      emit(row.player_id, row.team_id, row.game_id, prediction.expected, null, false, prediction.conflicts,
        prediction.conditional, prediction.participationProbability,
        prediction.conditioning === "conditional_playing" ? "missing_participation" : "unsupported_conditioning");
    }
    for (const row of revision.payload.goalies ?? []) {
      const candidates = row.uncertainty?.daily_board_candidates ?? [];
      const probabilities = candidates.map((candidate: Row) => numberOrNull(candidate.startingProbability));
      const mass = probabilities.reduce((sum: number, value: number | null) => sum + (value ?? 0), 0);
      if (mass > 1.000001 || probabilities.some((value: number | null) => value === null || value < 0 || value > 1)) {
        excluded("unsupported_conditioning", gameId); continue;
      }
      for (const candidate of candidates) {
        const prediction = boardGoalieForecast(candidate);
        emit(candidate.playerId, row.team_id, row.game_id, prediction?.expected ?? null, prediction?.participationProbability ?? null,
          prediction?.probabilityStatus === "confirmed_evidence" && prediction.participationProbability === 1,
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
  deadline = Date.now() + 2000, calendarPolicy: ForecastCalendarPolicy = forecastCalendarPolicy()) {
  const limitations: string[] = [];
  const recordExclusion = (gameId: string, reason: ForecastExclusionReason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, reasons: [reason] });
  };
  let acceptedNewsRevision: string | null = null;
  let currentRevisions = revisions;
  if (revisions.length) {
    try {
      const newsDeadline = Math.min(deadline, Date.now() + 2000);
      const news = await withinDeadline(newsDeadline, () => loadAcceptedForecastNews(db, revisions.map(row => row.game_id), now.toISOString(), newsDeadline));
      acceptedNewsRevision = news.revisionHash;
      currentRevisions = revisions.filter(revision => {
        const acceptedAt = news.latestAcceptedAt.get(revision.game_id);
        if (!acceptedAt || !acceptedNewsSupersedes(acceptedAt, revision.payload.inputCutoff ?? revision.decision_as_of)) return true;
        recordExclusion(String(revision.game_id), "stale_source");
        return false;
      });
      if (currentRevisions.length !== revisions.length) limitations.push("New accepted evidence supersedes some issued forecasts; affected decisions remain unresolved until refresh.");
    } catch {
      currentRevisions = [];
      for (const id of new Set(revisions.map(row => String(row.game_id)))) recordExclusion(id, "incomplete_refresh");
      limitations.push("Accepted evidence freshness could not be verified; issued forecasts are temporarily unavailable.");
    }
  }
  const forecasts = publicPlanningForecasts(currentRevisions, players, games, now, exclusionCounts, exclusionRows, seasonId, calendarPolicy);
  return { forecasts, currentRevisions, acceptedNewsRevision, limitations };
}

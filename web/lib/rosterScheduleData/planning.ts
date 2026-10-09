import { loadPlanningInputs, pages, withinDeadline, PlanningReadDeadlineError, type PlanningDataQuery } from "./planningInputs";
import { admitConsumerGameRevisions } from "lib/projections/consumerRevisionAdmission";
export { normalizePlanningGames } from "./planningInputs";
export { publicPlanningForecasts } from "lib/projections/consumerRevisionAdmission";
export type { PlanningDataQuery } from "./planningInputs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import { loadApprovedContributionBundle } from "lib/player-forecasts/contributionStore";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { starterBoardCanaryGameIds, starterBoardFlags } from "lib/projections/starterBoardFlags";
import type { ForecastDiscoveryExclusion, ForecastExclusionReason, ForecastManifest, PlanningData, SourceEvidence } from "lib/rosterScheduleOptimizer/planningTypes";

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
function evidence(source: string, asOf: string | null, seasonId: number | null, limitations: string[] = []): SourceEvidence {
  return { source, asOf, seasonId, completeness: limitations.length ? "partial" : "complete", limitations };
}

export async function loadPlanningData(db: SupabaseClient<any>, query: PlanningDataQuery, options: { now?: Date; forecastsEnabled?: boolean; deadlineMs?: number } = {}): Promise<PlanningData> {
  const now = options.now ?? new Date();
  const deadline = Math.min(options.deadlineMs ?? Infinity, Date.now() + 20000);
  const inputDeadline = Math.min(deadline, Date.now() + 8000);
  const calendarPolicy = forecastCalendarPolicy(Number(process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
  const [{ players, games, scheduleRows, scheduleProblems, evidence: sources }, weeks, baseline] = await Promise.all([
    loadPlanningInputs(db, query, now, inputDeadline),
    pages(() => db.from("yahoo_matchup_weeks").select("id,game_key,week,start_date,end_date", { count: "exact" })
      .eq("season", String(query.seasonId).slice(0, 4)).order("week").order("id"), inputDeadline, 500).catch(() => []),
    withinDeadline(inputDeadline, signal => loadApprovedContributionBundle(db, query.seasonId, now, { signal }))
      .catch(() => ({ sources: [], manifests: [], checksum: null, limitations: ["baseline_read_unavailable"] })),
  ]);
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
  const { forecasts, acceptedNewsRevision, limitations: admissionProblems } = await admitConsumerGameRevisions(
    db, revisions, players, games, now, query.seasonId, exclusionCounts, exclusionRows, deadline, calendarPolicy);
  forecastProblems.push(...admissionProblems);
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
    issuedRevisionIds: [...new Set(forecasts.map(row => row.revisionId))].sort(), baselineChecksum: baseline.checksum,
    exclusions: exclusionRows };
  const forecastManifest: ForecastManifest = { ...manifestContent, version: "planning-forecasts-v1", id: playerForecastSourcePayloadHash(manifestContent), asOf: now.toISOString(),
    requiredOpportunities: players.reduce((sum, player) => sum + games.filter(game => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled").length, 0),
    forecastedOpportunities: forecasts.length, exclusionCounts, exclusions: exclusionRows };
  sources.baselines = evidence("Approved contribution rate bundles", baseline.manifests.map(manifest => manifest.issuedAt).sort()[0] ?? null, query.seasonId, baseline.limitations);
  forecastProblems.push("Only issued unconditional game forecasts are used. Conditional-only, missing, or out-of-horizon statistics are unknown, not zero.");
  sources.forecasts = evidence("selected FORGE game revisions", forecasts.map((row) => row.issuedAt).sort()[0] ?? null, query.seasonId, [...new Set(forecastProblems)]);

  // Ownership is platform-wide context, never league availability. This season-scoped view may be absent/stale.
  try {
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
    for (const player of players) {
      const row = player.nhlId === null ? null : latest.get(player.nhlId);
      const value = numberOrNull(row?.ownership_pct);
      if (value !== null && value >= 0 && value <= 100 && Date.parse(`${row!.ownership_date}T00:00:00Z`) >= now.getTime() - 3 * 86400000) player.ownership = value;
    }
    sources.ownership = evidence("Yahoo daily ownership", ownership[0]?.updated_at ?? null, query.seasonId, ["Ownership is not league availability; missing or older than three days is unknown."]);
  } catch { sources.ownership = evidence("Yahoo daily ownership", null, query.seasonId, ["Ownership could not be verified."]); }
  let recentFormStage: "games" | "stats" | "processing" = "games";
  try {
    const formDeadline = Math.min(deadline, Date.now() + 2000);
    const start = new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString().slice(0, 10);
    const historyGames = await pages(() => db.from("games").select("id,date", { count: "exact" })
      .eq("seasonId", query.seasonId).eq("type", 2).gte("date", start).lte("date", cutoff)
      .order("date", { ascending: false }).order("id", { ascending: false }), formDeadline, 500);
    const gameDates = new Map<number, string>(historyGames.filter(row => Number.isSafeInteger(Number(row.id)) && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
      .map(row => [Number(row.id), row.date]));
    const gameIds = [...gameDates.keys()];
    recentFormStage = "stats";
    const recent: Row[] = [];
    for (let index = 0; index < gameIds.length; index += 100) {
      const batch = gameIds.slice(index, index + 100);
      recent.push(...await pages(() => db.from("skatersGameStats").select("playerId,gameId,points", { count: "exact" }).in("gameId", batch)
        .order("gameId", { ascending: false }).order("playerId"), formDeadline, 25000 - recent.length, row => [row.gameId, row.playerId]));
    }
    recentFormStage = "processing";
    const byPlayer = new Map<number, Row[]>();
    for (const row of recent) if (gameDates.has(Number(row.gameId))) {
      const playerId = Number(row.playerId);
      byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), row]);
    }
    for (const samples of byPlayer.values()) samples.sort((a, b) => gameDates.get(Number(b.gameId))!.localeCompare(gameDates.get(Number(a.gameId))!)
      || Number(b.gameId) - Number(a.gameId));
    for (const player of players) {
      const samples = player.nhlId === null ? [] : byPlayer.get(player.nhlId) ?? [];
      if (samples.length < 3 || samples.slice(0, 5).some(row => numberOrNull(row.points) === null)) continue;
      const lastThree = samples.slice(0, 3).reduce((sum, row) => sum + row.points, 0);
      const lastFive = samples.slice(0, 5).reduce((sum, row) => sum + row.points, 0);
      const hot = lastThree >= 6, cold = samples.length >= 5 && lastFive === 0;
      player.form = { label: hot ? "Scoring hot" : cold ? "Scoring cold" : "Recent scoring", games: hot ? 3 : Math.min(samples.length, 5), points: hot ? lastThree : lastFive, includedInForecast: null };
    }
    sources.form = evidence("Recent regular-season box scores", null, query.seasonId, ["Recent scoring uses available game logs before the previous day; projection incorporation is unknown and no form bonus is added."]);
  } catch { sources.form = evidence("Recent box scores", null, query.seasonId, [`recent_form_${recentFormStage}_query_failed`]); }
  const weekRows = weeks;
  const matchupWeeks = new Set(weekRows.map((row: Row) => row.game_key)).size === 1 ? weekRows
    .filter((row: Row) => Number.isInteger(row.week) && row.week > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date) && row.start_date <= row.end_date)
    .map((row: Row) => ({ gameKey: String(row.game_key), week: row.week, startDate: row.start_date, endDate: row.end_date })) : [];
  sources.matchupWeeks = evidence("Yahoo matchup weeks", null, query.seasonId, matchupWeeks.length ? [] : ["Matchup week presets are unavailable for this season; use custom dates."]);
  return { players, games, forecasts, baselineSources: baseline.sources, forecastManifest, evidence: sources, matchupWeeks };
}

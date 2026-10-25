import type { NextApiRequest, NextApiResponse } from "next";
import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import { inspectRefreshScope } from "lib/rosterScheduleData/refreshGuard";
import { mapGameDateToYahooWeek, normalizeNhlGameToTeamRows, planningScheduleStatus, type YahooMatchupWeekRow } from "lib/rosterScheduleData";
import { fetchBoundedNhlSchedule } from "lib/rosterScheduleData/source";
import { fetchRecurringSchedulePage, parseRecurringQuery, recurringRange, RECURRING_PROFILE } from "lib/rosterScheduleData/recurring";
import type { SupabaseClient } from "@supabase/supabase-js";

// Proposal only: independent of the exact-hash one-time repair route.
export async function refreshRosterOptimizerScheduleHandler(req: NextApiRequest, res: NextApiResponse) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECURRING_PROFILE.runMs);
  let writesAttempted = false;
  try {
    const { dryRun } = parseRecurringQuery(req.query);
    const db = (req as NextApiRequest & { supabase: SupabaseClient }).supabase;
    const signal = controller.signal;
    const read = async (builder: any, maximum: number): Promise<any[]> => {
      if (signal.aborted) throw new Error("Recurring refresh deadline exceeded.");
      const result = await builder.limit(maximum + 1).abortSignal(signal);
      if (signal.aborted || result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count)
        || result.count < 0 || result.count > maximum || result.data.length !== result.count) {
        throw new Error("Recurring database read is incomplete or over budget.");
      }
      return result.data;
    };
    const weeks = await read(db.from("yahoo_matchup_weeks")
      .select("id,game_key,season,week,start_date,end_date", { count: "exact" })
      .eq("game_key", RECURRING_PROFILE.gameKey), 64) as YahooMatchupWeekRow[];
    const request = recurringRange(new Date(), weeks);
    const seasons = await read(db.from("seasons").select("id,startDate,endDate", { count: "exact" })
      .eq("id", RECURRING_PROFILE.seasonId), 1);
    if (seasons.length !== 1 || typeof seasons[0].startDate !== "string" || typeof seasons[0].endDate !== "string"
      || seasons[0].startDate > request.startDate || seasons[0].endDate < request.endDate) {
      throw new Error("Recurring range is outside the pinned NHL season.");
    }
    const membership = await read(db.from("team_season").select("teamId", { count: "exact" })
      .eq("seasonId", RECURRING_PROFILE.seasonId), 64);
    const teamIds = membership.map(row => row.teamId);
    if (!teamIds.length || teamIds.some(id => !Number.isSafeInteger(id) || id <= 0)
      || new Set(teamIds).size !== teamIds.length) throw new Error("Recurring season teams are invalid.");
    const teams = await read(db.from("teams").select("id,abbreviation", { count: "exact" }).in("id", teamIds), 64);
    if (teams.length !== teamIds.length || new Set(teams.map(team => team.id)).size !== teamIds.length
      || teams.some(team => !teamIds.includes(team.id) || typeof team.abbreviation !== "string" || !team.abbreviation.trim())) {
      throw new Error("Recurring team directory is incomplete.");
    }
    // Obtain the ordering clock before any source page, from the same database
    // that enforces it. A delayed request cannot invent a later receipt at commit.
    const observation = await db.rpc("roster_schedule_observation_clock").abortSignal(signal);
    if (observation.error || typeof observation.data !== "string" || !Number.isFinite(Date.parse(observation.data))) {
      throw new Error("Database observation clock is unavailable.");
    }
    const fetchedAt = new Date(observation.data).toISOString();
    const source = await fetchBoundedNhlSchedule({ ...request, signal,
      readSchedulePage: date => fetchRecurringSchedulePage(date, signal) });
    if (!source.complete || !source.games.length || source.games.length * 2 > RECURRING_PROFILE.maxSides) {
      throw new Error("Recurring source is incomplete, empty or over budget.");
    }
    const rows = source.games.flatMap(entry => {
      if (entry.game.season !== RECURRING_PROFILE.seasonId || entry.game.gameType !== 2
        || teams.find(team => team.id === entry.game.homeTeam.id)?.abbreviation.trim() !== entry.game.homeTeam.abbrev
        || teams.find(team => team.id === entry.game.awayTeam.id)?.abbreviation.trim() !== entry.game.awayTeam.abbrev
        || !planningScheduleStatus(entry.game.gameState ?? "", entry.game.gameScheduleState ?? "")) {
        throw new Error("Recurring source has an unsupported season, game type or team.");
      }
      const mapping = mapGameDateToYahooWeek(entry.game.gameDate, weeks);
      return normalizeNhlGameToTeamRows({ ...entry, mapping, fetchedAt, gameKey: RECURRING_PROFILE.gameKey, yahooSeason: "2026" });
    });
    if (new TextEncoder().encode(JSON.stringify(rows)).byteLength > RECURRING_PROFILE.writeBytes) {
      throw new Error("Recurring upsert payload exceeds its approved byte budget.");
    }
    const scope = inspectRefreshScope({ request, seasonId: RECURRING_PROFILE.seasonId, yahooSeason: "2026",
      guard: { seasonId: RECURRING_PROFILE.seasonId, maxSides: RECURRING_PROFILE.maxSides, gameIds: source.games.map(entry => entry.game.id).sort((a, b) => a - b) },
      complete: source.complete, ignoredGames: 0, unmappedGames: rows.filter(row => row.mapping_status !== "mapped").length / 2, rows });
    if (dryRun) {
      const existing = await read(db.from("roster_optimizer_team_games")
        .select("source_game_id,team_id", { count: "exact" }).eq("game_key", request.gameKey).eq("season", "2026")
        .gte("game_date", request.startDate).lte("game_date", request.endDate), RECURRING_PROFILE.maxSides);
      const incoming = new Set(rows.map(row => `${row.source_game_id}:${row.team_id}`));
      if (existing.some(row => !incoming.has(`${row.source_game_id}:${row.team_id}`))) {
        throw new Error("A cached side disappeared from the source range; inspect its reschedule or cancellation separately.");
      }
    }
    if (signal.aborted) throw new Error("Recurring refresh deadline exceeded.");
    if (!dryRun) {
      writesAttempted = true;
      // The RPC checks range completeness and all timestamps while holding the
      // database lock shared with every ordinary writer's statement trigger.
      const result = await db.rpc("commit_recurring_roster_schedule", { p_rows: rows,
        p_observed_at: fetchedAt, p_start_date: request.startDate, p_end_date: request.endDate }).abortSignal(signal);
      if (result.error || signal.aborted || !result.data || typeof result.data !== "object") {
        throw new Error("Recurring transaction acknowledgement is unavailable.");
      }
      const receipt = result.data as { outcome?: string; rowsUpserted?: number };
      if (["skipped_busy", "skipped_stale", "rejected"].includes(receipt.outcome ?? "") && receipt.rowsUpserted === 0) {
        return res.status(409).json({ success: false, writeOutcome: "not_applied", data: {
          outcome: receipt.outcome, rowsUpserted: 0, rowsDeleted: 0, rowsPlanned: rows.length,
        }, error: { code: "RECURRING_TRANSACTION_NOT_APPLIED", message: "Transaction acknowledged no schedule changes; inspect the outcome before retrying." } });
      }
      if (receipt.outcome !== "applied" || receipt.rowsUpserted !== rows.length) {
        throw new Error("Recurring transaction acknowledgement is incomplete.");
      }
    }
    return res.status(200).json({ success: true, data: {
      profile: RECURRING_PROFILE.version, dryRun, gameKey: request.gameKey, sourceSeasonId: RECURRING_PROFILE.seasonId,
      refreshRange: { startDate: request.startDate, endDate: request.endDate }, fetchedAt,
      rowsPlanned: rows.length, rowsUpserted: dryRun ? 0 : rows.length, rowsDeleted: 0,
      writeOutcome: dryRun ? "not_attempted" : "acknowledged", scopeHash: scope.scopeHash,
      warnings: source.warnings, sourcePages: Math.ceil(((Date.parse(request.endDate) - Date.parse(request.startDate)) / 86400000 + 1) / 7),
    } });
  } catch (error) {
    return res.status(409).json({ success: false, writeOutcome: writesAttempted ? "unknown" : "not_attempted",
      error: { code: "RECURRING_REFRESH_REJECTED", message: error instanceof Error ? error.message.slice(0, 1000) : "Recurring schedule refresh failed." } });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

const writer = withOperationalRouteAuth(refreshRosterOptimizerScheduleHandler, {
  methods: ["POST"], audit: { jobName: "refresh-roster-optimizer-schedule", includeFinalAuditReceipt: true },
});
const inspection = withOperationalRouteAuth(refreshRosterOptimizerScheduleHandler, { methods: ["POST"], audit: false });
export default function handler(req: Parameters<typeof writer>[0], res: NextApiResponse) {
  return req.query.dryRun === "false" ? writer(req, res) : inspection(req, res);
}

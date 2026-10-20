import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { nhlCalendarDate, withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { hasScheduleCoverage, pages } from "lib/rosterScheduleData/planningInputs";
import { recurringRange, RECURRING_PROFILE } from "lib/rosterScheduleData/recurring";
import type { YahooMatchupWeekRow } from "lib/rosterScheduleData/types";
import adminOnly from "utils/adminOnlyMiddleware";
import { updateRosterOptimizerScheduleHandler, type ScheduleWriteControl } from "../update-roster-optimizer-schedule";

// Scheduled refresh of the RSO schedule cache. The planning reader calls a
// horizon complete only when every date carries an nhl-source-days-v1 witness
// fetched within 36 h, so each run rewrites the whole current + next week and
// active Yahoo period (recurringRange) through the existing bounded writer, then
// reads the window back through the reader's own coverage check.
const COVERAGE_TTL_MS = 36 * 3600000;
const SYNC_DEADLINE_MS = 120_000; // the NHL reads have no timeout of their own; maxDuration is 240 s
const READBACK_MS = 8000;
const MAX_SIDES = 1000; // 31 dates × 32 clubs ≤ 992 team sides
const RENEWAL_GRACE_DAYS = 90; // covers the playoffs after the last Yahoo period
const SCHEDULE_COLUMNS = "id,source_game_id,source_season_id,game_type,game_date,start_time,game_status,schedule_status,is_countable,team_abbreviation,opponent_abbreviation,home_away,fetched_at,source_metadata";

type Db = SupabaseClient<any>;
type SyncResult = { statusCode: number; body: any };

async function loadMatchupWeeks(db: Db): Promise<YahooMatchupWeekRow[]> {
  const { data, error } = await db.from("yahoo_matchup_weeks")
    .select("id,game_key,season,week,start_date,end_date")
    .eq("game_key", RECURRING_PROFILE.gameKey).order("week", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Runs the bounded writer in-process; it only reads `query`, `supabase` and `writeControl`.
async function runBoundedSync(db: Db, query: Record<string, string>, writeControl: ScheduleWriteControl): Promise<SyncResult> {
  const result: SyncResult = { statusCode: 200, body: null };
  const res = {
    status(code: number) { result.statusCode = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  };
  await updateRosterOptimizerScheduleHandler({ query, supabase: db, writeControl } as unknown as NextApiRequest,
    res as unknown as NextApiResponse);
  return result;
}

export async function updateRosterOptimizerScheduleDailyHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: `Method ${req.method} Not Allowed` } });
  }
  const unexpected = Object.keys(req.query).filter(key => key !== "ignoreOffSeason");
  if (unexpected.length) {
    return res.status(400).json({ success: false, error: { code: "INVALID_QUERY",
      message: `The daily refresh derives its own window; remove ${unexpected.join(", ")}.` } });
  }
  const db = (req as NextApiRequest & { supabase: Db }).supabase;
  let written = false;
  try {
    const now = new Date();
    const today = nhlCalendarDate(now);
    const weeks = await loadMatchupWeeks(db);
    if (!weeks.length) throw new Error(`No Yahoo matchup weeks exist for game key ${RECURRING_PROFILE.gameKey}.`);
    if (!weeks.some(week => week.start_date && week.end_date && week.start_date <= today && today <= week.end_date)) {
      // Playoffs and preseason skip; long after the last period, the pinned key is a past season.
      const lastEnd = weeks.map(week => week.end_date ?? "").sort().at(-1)!;
      if (today > new Date(Date.parse(`${lastEnd}T12:00:00Z`) + RENEWAL_GRACE_DAYS * 86400000).toISOString().slice(0, 10)) {
        return res.status(409).json({ success: false, error: { code: "PROFILE_RENEWAL_REQUIRED",
          message: `Yahoo game key ${RECURRING_PROFILE.gameKey} ended ${lastEnd}; pin the new season's game key.` } });
      }
      return res.status(200).json({ success: true, skipped: true, outcome: "skipped", reason: "no_active_yahoo_period",
        message: `Skipped: no Yahoo matchup period for game key ${RECURRING_PROFILE.gameKey} contains ${today}.` });
    }
    const window = recurringRange(now, weeks);
    // The deadline aborts the writer: it issues no write statement after this
    // point, but one already sent may still be acknowledged by the database.
    const controller = new AbortController();
    const writeControl: ScheduleWriteControl = { signal: controller.signal, writeStarted: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = await Promise.race([runBoundedSync(db, window, writeControl),
      new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, SYNC_DEADLINE_MS); })])
      .finally(() => clearTimeout(timer));
    if (!sync) {
      const limit = `The bounded refresh did not finish within ${SYNC_DEADLINE_MS / 1000} s`;
      return res.status(504).json({ success: false, writeOutcome: writeControl.writeStarted ? "unknown" : "not_attempted",
        error: { code: "DAILY_SCHEDULE_REFRESH_TIMEOUT", message: writeControl.writeStarted
          ? `${limit}; a write was already issued and its acknowledgment is unknown (cancellation does not undo it). Read the window back before any retry.`
          : `${limit} and was cancelled before any schedule write.` } });
    }
    if (sync.statusCode !== 200 || sync.body?.success !== true) {
      return res.status(sync.statusCode >= 400 ? sync.statusCode : 500).json(sync.body);
    }
    written = true;
    const data = sync.body.data;
    const rows = await pages(() => db.from("roster_optimizer_team_games")
      .select(SCHEDULE_COLUMNS, { count: "exact" })
      .eq("source_season_id", data.sourceSeasonId).gte("game_date", window.startDate).lte("game_date", window.endDate)
      .order("source_game_id").order("team_abbreviation").order("fetched_at").order("id"), Date.now() + READBACK_MS, MAX_SIDES);
    // No timeZone: check exactly the fetched dates, which already include the ±1 padding.
    const complete = hasScheduleCoverage(rows,
      { seasonId: data.sourceSeasonId, startDate: window.startDate, endDate: window.endDate }, new Date());
    return res.status(complete ? 200 : 409).json({
      success: complete,
      ...(complete ? {} : { error: { code: "SCHEDULE_COVERAGE_INCOMPLETE",
        message: "The refresh was written, but the read-back window lacks complete fresh source-day coverage." } }),
      writeOutcome: "acknowledged",
      rowsUpserted: data.rowsUpserted,
      data: {
        window: { startDate: window.startDate, endDate: window.endDate },
        sourceSeasonId: data.sourceSeasonId,
        fetchedAt: data.fetchedAt,
        coverage: complete
          ? { status: "complete", validUntil: new Date(Date.parse(data.fetchedAt) + COVERAGE_TTL_MS).toISOString() }
          : { status: "incomplete" },
        gamesFetched: data.gamesFetched,
        unmappedGames: data.unmappedGames,
        ignoredGames: data.ignoredGames,
        rowsRead: rows.length,
        warnings: data.warnings,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, ...(written ? { writeOutcome: "acknowledged" } : {}),
      error: { code: "DAILY_SCHEDULE_REFRESH_FAILED",
      message: error instanceof Error ? error.message.slice(0, 1000) : "Daily schedule refresh failed." } });
  }
}

// GET for Vercel cron, POST for pg_cron or a manual run.
export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(updateRosterOptimizerScheduleDailyHandler) as any), {
  jobName: "update-roster-optimizer-schedule-daily",
  includeFinalAuditReceipt: true,
});

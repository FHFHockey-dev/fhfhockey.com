import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { evaluateDailyAcceptance, type DailyAcceptanceKind } from "lib/cron/forgeDailyAcceptance";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { pages } from "lib/rosterScheduleData/planningInputs";

/** Read-only acceptance of one natural daily FORGE run (released off-day fix 096b78b62). Reads the official schedule,
 * the pipeline state, the run and writer rows and the NST audit, then GETs Start Chart and Daily RSO once each, and
 * evaluates them strictly (lib/cron/forgeDailyAcceptance.ts). Writes nothing itself; withCronJobAudit records the
 * response. 200 = pass, 422 = a check failed, 500 = evidence could not be read (acceptance pending). */
const SITE = "https://fhfhockey.com", NHL_SCHEDULE = "https://api-web.nhle.com/v1/schedule";
const param = (req: NextApiRequest, key: string) => { const value = req.query[key]; return Array.isArray(value) ? value[0] : value; };
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

async function getJson(url: string, timeoutMs: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" }, cache: "no-store" });
  const text = await response.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: response.status, body, sha256: sha256(text) };
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const runDate = param(req, "runDate"), sourceDate = param(req, "sourceDate"), kind = param(req, "kind");
  if (!validDate(runDate) || !validDate(sourceDate) || (kind !== "control" && kind !== "offday")) {
    return res.status(400).json({ success: false, error: "runDate and sourceDate (YYYY-MM-DD) and kind (control|offday) are required" });
  }
  try {
    const db = supabase as unknown as SupabaseClient<any>, deadline = Date.now() + 60000;
    const [scheduleRun, scheduleSource] = await Promise.all([getJson(`${NHL_SCHEDULE}/${runDate}`, 10000), getJson(`${NHL_SCHEDULE}/${sourceDate}`, 10000)]);
    const read = async <T,>(query: PromiseLike<{ data: T | null; error: unknown }>) => {
      const { data, error } = await query;
      if (error) throw error;
      if (data === null) throw new Error("read returned no data");
      return data;
    };
    const [pipeline, nst, runs, playerRows] = await Promise.all([
      read(db.from("projection_pipeline_state").select("scope_key,operation_key,status")
        .eq("pipeline_key", "rolling_forge_pipeline").eq("scope_key", `daily_incremental:${runDate}`)),
      read(db.from("cron_job_audit").select("run_time,status,nst:details->nstProgress").eq("job_name", "update-nst-gamelog")
        .gte("run_time", `${runDate}T09:30:00Z`).lt("run_time", `${runDate}T14:00:00Z`).order("run_time")),
      read(db.from("forge_runs").select("run_id,status,git_sha,created_at,scope:metrics->execution_scope").eq("as_of_date", runDate).order("created_at")),
      pages(() => db.from("forge_player_projections").select("run_id,game_id,player_id,horizon_games", { count: "exact" }).eq("as_of_date", runDate)
        .order("run_id").order("game_id").order("player_id").order("horizon_games"), deadline, 30000,
      row => `${row.run_id}:${row.game_id}:${row.player_id}:${row.horizon_games}`),
    ]);
    // Readers last and one at a time, as the local check does.
    const startChart = await getJson(`${SITE}/api/v1/start-chart?date=${runDate}`, 30000);
    const dailyRso = await getJson(`${SITE}/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=${runDate}&endDate=${runDate}`, 30000);
    const pairs = new Map<string, { run_id: string; game_id: number }>();
    for (const row of playerRows) pairs.set(`${row.run_id}:${row.game_id}`, { run_id: String(row.run_id), game_id: Number(row.game_id) });
    const result = evaluateDailyAcceptance({
      scheduleRun: scheduleRun.status === 200 ? scheduleRun.body : null,
      scheduleSource: scheduleSource.status === 200 ? scheduleSource.body : null,
      pipeline: (pipeline as any[]).map(row => ({ scope: row.scope_key, stage: row.operation_key, status: row.status })),
      nst: (nst as any[]).map(row => ({ run_time: row.run_time, status: row.status, state: row.nst?.state ?? null,
        verifiedOffDates: row.nst?.verifiedOffDates ?? null, missingScheduleDates: row.nst?.missingScheduleDates ?? null,
        planned: row.nst?.plannedRequestCount ?? null, networkAttempts: row.nst?.networkAttempts ?? null })),
      runs: (runs as any[]).map(row => ({ run_id: row.run_id, status: row.status, git_sha: row.git_sha, created_at: row.created_at, scope: row.scope })),
      playerRowKeys: [...pairs.values()],
      startChart: startChart.body, dailyRso: dailyRso.body, startChartHttp: startChart.status, dailyRsoHttp: dailyRso.status,
    }, runDate, sourceDate, kind as DailyAcceptanceKind);
    return res.status(result.pass ? 200 : 422).json({
      success: result.pass, pass: result.pass, runDate, sourceDate, kind, checks: result.checks, facts: result.facts,
      evidence: { scheduleHttp: [scheduleRun.status, scheduleSource.status], pipelineRows: (pipeline as any[]).length, nstRows: (nst as any[]).length,
        runsForDate: (runs as any[]).length, writerRows: playerRows.length, readerHttp: [startChart.status, dailyRso.status],
        bodySha256: { scheduleRun: scheduleRun.sha256, scheduleSource: scheduleSource.sha256, startChart: startChart.sha256, dailyRso: dailyRso.sha256 } },
    });
  } catch (error: any) {
    console.error("forge-daily-acceptance failed:", error);
    return res.status(500).json({ success: false, pass: false, pending: true, runDate, sourceDate, kind, error: error?.message ?? String(error) });
  }
};

export default withCronJobAudit(adminOnly(handler as any));

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { getQueryStringParam } from "lib/projections/apiHelpers";
import { scoreLedger, type LedgerRow } from "lib/player-forecasts/servedForecastLedger";
import { pages } from "lib/rosterScheduleData/planningInputs";

/** S-B2 scoreboard: served-forecast ledger scores (MAE/bias per head, fantasy points, coverage, calibration) per served
 * date × source, plus pooled over the window. Read-only. */
const DAY_MS = 86400000, MAX_ROWS = 120000;
const COLUMNS = "served_date,player_id,game_id,source,player_class,team_rest_days,start_probability,dressed,started,settled_at,"
  + "exp_goals,exp_assists,exp_pp_points,exp_shots,exp_hits,exp_blocks,exp_saves,exp_goals_against,exp_shots_against,exp_win_prob,exp_shutout_prob,exp_fantasy_points,"
  + "act_goals,act_assists,act_pp_points,act_shots,act_hits,act_blocks,act_saves,act_goals_against,act_shots_against,act_win,act_shutout,act_fantasy_points";
const NUMERIC = COLUMNS.split(",").filter(column => /^(exp_|act_|start_probability|team_rest_days|player_id|game_id)/.test(column));

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
  scope: z.enum(["skater", "goalie", "all"]).default("all")
});

function todayEtDateOnly(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const parsed = querySchema.safeParse({ days: getQueryStringParam(req.query.days), scope: getQueryStringParam(req.query.scope) });
  if (!parsed.success) {
    return res.status(400).json({ durationMs: formatDurationMsToMMSS(Date.now() - startedAt), error: "Invalid query parameters", details: parsed.error.flatten() });
  }
  const { days, scope } = parsed.data, endDate = todayEtDateOnly(new Date());
  const startDate = new Date(Date.parse(`${endDate}T12:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  try {
    const db = supabase as unknown as SupabaseClient<any>;
    const raw = await pages(() => {
      const query = db.from("forge_served_forecast_ledger").select(COLUMNS, { count: "exact" }).gte("served_date", startDate).lte("served_date", endDate)
        .not("settled_at", "is", null);
      return (scope === "all" ? query : query.eq("player_class", scope)).order("served_date").order("game_id").order("player_id").order("source");
    }, Date.now() + 45000, MAX_ROWS, row => [row.served_date, row.player_id, row.game_id, row.source]);
    // PostgREST returns numeric columns as strings; scoring needs numbers (null stays null).
    const rows = raw.map(row => { const out = { ...row }; for (const column of NUMERIC) out[column] = row[column] === null || row[column] === undefined ? null : Number(row[column]); return out as LedgerRow; });
    const dates = [...new Set(rows.map(row => row.served_date))].sort();
    const daily = dates.map(served_date => ({ served_date, scores: scoreLedger(rows.filter(row => row.served_date === served_date)) }));
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      scope, days, startDate, endDate,
      data: daily,
      pooled: rows.length ? scoreLedger(rows) : [],
      ...(rows.length ? {} : { empty: true })
    });
  } catch (e) {
    return res.status(500).json({ durationMs: formatDurationMsToMMSS(Date.now() - startedAt), error: (e as any)?.message ?? String(e) });
  }
}

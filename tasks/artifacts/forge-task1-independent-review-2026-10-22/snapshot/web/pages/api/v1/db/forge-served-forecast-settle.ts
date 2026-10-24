import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { settleLedgerRows, type LedgerRow } from "lib/player-forecasts/servedForecastLedger";
import { pages } from "lib/rosterScheduleData/planningInputs";

/** S-B2: settles forge_served_forecast_ledger for one ET served date and the two days before it (late WGO corrections).
 * Idempotent; writes only the settlement columns of rows whose game has actuals. */
const LEDGER_TABLE = "forge_served_forecast_ledger", UPSERT_BATCH = 500, DAY_MS = 86400000;
const SETTLED_COLUMNS = ["act_goals", "act_assists", "act_pp_points", "act_shots", "act_hits", "act_blocks", "act_saves", "act_goals_against",
  "act_shots_against", "act_win", "act_shutout", "act_fantasy_points", "dressed", "started", "settled_at", "outcome_source"] as const;
// The PK plus the NOT NULL columns, re-sent unchanged: Postgres checks NOT NULL on the proposed insert row before
// ON CONFLICT resolves, so a PK-plus-settlement payload would fail. The conflict update only sets the keys sent.
const CARRIED_COLUMNS = ["served_date", "player_id", "game_id", "source", "season_id", "player_class", "team_id", "opponent_team_id", "is_home", "scheduled_at"] as const;
type Row = Record<string, any>;

function yesterdayEtDateOnly(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - DAY_MS));
}
const param = (req: NextApiRequest, key: string) => { const value = req.query[key]; return Array.isArray(value) ? value[0] : value; };
const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const now = new Date(), date = param(req, "date") ?? yesterdayEtDateOnly(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))
    || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  const from = shift(date, -2), dates = [from, shift(date, -1), date];
  try {
    const db = supabase as unknown as SupabaseClient<any>, deadline = Date.now() + 45000;
    const ledger = await pages(() => db.from(LEDGER_TABLE).select([...CARRIED_COLUMNS, "settled_at"].join(","), { count: "exact" })
      .gte("served_date", from).lte("served_date", date).order("served_date").order("game_id").order("player_id").order("source"),
    deadline, 20000, row => [row.served_date, row.player_id, row.game_id, row.source]) as LedgerRow[];
    const empty = Object.fromEntries(dates.map(day => [day, { read: 0, settled: 0, unsettled: 0 }]));
    if (!ledger.length) return res.status(200).json({ success: true, date, dates, rowsRead: 0, rowsSettled: 0, rowsUnsettled: 0, rowsUpserted: 0, byDate: empty });
    const [skaters, goalieRows] = await Promise.all([
      pages(() => db.from("wgo_skater_stats").select("player_id,game_id,date,goals,assists,pp_points,shots,hits,blocked_shots", { count: "exact" })
        .gte("date", from).lte("date", date).order("date").order("player_id"), deadline, 5000, row => [row.player_id, row.date]),
      // goalie_stats_unified has no game_id, so goalie actuals come from wgo_goalie_stats (goalie_id is the NHL player id).
      pages(() => db.from("wgo_goalie_stats").select("goalie_id,game_id,date,games_started,saves,goals_against,shots_against,wins,shutouts", { count: "exact" })
        .gte("date", from).lte("date", date).order("date").order("goalie_id"), deadline, 1000, row => [row.goalie_id, row.date]),
    ]);
    const settledAt = now.toISOString();
    // No verified finality/completeness receipt is available here. Missing players remain unknown.
    const reconciled = settleLedgerRows(ledger, { skaters, goalies: goalieRows.map(row => ({ ...row, player_id: row.goalie_id })), goalieSource: "wgo_goalie_stats" }, settledAt);
    const settled = reconciled.filter(row => row.settled_at === settledAt);
    const changed = reconciled.filter((row, index) => row.settled_at === settledAt || ledger[index].settled_at !== null);
    const rowsCleared = changed.length - settled.length;
    let rowsUpserted = 0;
    for (const batch of chunks(changed, UPSERT_BATCH)) {
      const payload = batch.map(row => Object.fromEntries([...CARRIED_COLUMNS, ...SETTLED_COLUMNS].map(column => [column, (row as Row)[column]])));
      const { error } = await db.from(LEDGER_TABLE).upsert(payload, { onConflict: "served_date,player_id,game_id,source" });
      if (error) return res.status(rowsUpserted ? 207 : 500).json({ success: false, date, dates, rowsRead: ledger.length, rowsUpserted, error: error.message });
      rowsUpserted += batch.length;
    }
    const byDate = Object.fromEntries(dates.map(day => {
      const read = ledger.filter(row => row.served_date === day).length, done = settled.filter(row => row.served_date === day).length;
      return [day, { read, settled: done, unsettled: read - done }];
    }));
    return res.status(200).json({ success: true, date, dates, rowsRead: ledger.length, rowsSettled: settled.length, rowsUnsettled: ledger.length - settled.length, rowsUpserted, rowsCleared, byDate });
  } catch (error: any) {
    console.error("forge-served-forecast-settle failed:", error);
    return res.status(500).json({ success: false, date, error: error?.message ?? String(error) });
  }
};

export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(handler as any)));

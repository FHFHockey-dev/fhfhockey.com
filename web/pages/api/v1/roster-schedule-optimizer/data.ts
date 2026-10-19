import type { NextApiRequest, NextApiResponse } from "next";
import { encodePlanningDataTransport, PlanningDataTransportLimitError } from "lib/rosterScheduleData/planningDataTransport";
import serviceRoleClient from "lib/supabase/server";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { forecastSourceSummary, selectForecastServingSource } from "lib/player-forecasts/forecastServingSource";

/** Public shared inputs. No league/account data or admin/research payloads. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let query;
  try { query = parsePlanningDataQuery(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid planning range." }); }
  try {
    const now = new Date();
    // One server-side source per request; RSO has no legacy forecasts, so every fallback serves none.
    const source = await selectForecastServingSource(serviceRoleClient, query.seasonId, now);
    const data = await loadPlanningData(serviceRoleClient, query, { now, source });
    // A shared copy of native forecasts never outlives the selected catalog.
    const nativeMaxAge = source.kind === "native" ? Math.max(0, Math.min(300, Math.floor((Date.parse(source.expiresAt) - Date.now()) / 1000))) : null;
    res.setHeader("Cache-Control", nativeMaxAge === null ? "public, s-maxage=300, stale-while-revalidate=300" : `public, s-maxage=${nativeMaxAge}, stale-while-revalidate=0`);
    // Beside `data`, so clients decoding the strict transport keep working.
    return res.json({ success: true, data: encodePlanningDataTransport(data), forecastSource: forecastSourceSummary(source) });
  } catch (error) {
    if (error instanceof PlanningDataTransportLimitError) return res.status(503).json({ success: false, code: "planning_range_too_large", error: error.message });
    return res.status(503).json({ success: false, error: "Planning data is temporarily unavailable. Your saved manual workspace is preserved." });
  }
}

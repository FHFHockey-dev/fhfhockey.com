import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { compactBridgeForecasts, fitBridgeWire, PLANNING_RESPONSE_BYTE_BUDGET } from "lib/rosterScheduleData/bridgeForecastWire";
import { forecastSourceSummary, selectForecastServingSource } from "lib/player-forecasts/forecastServingSource";

/** Public shared inputs. No league/account data or admin/research payloads. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let query;
  try { query = parsePlanningDataQuery(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid planning range." }); }
  try {
    // One server-side source per request. Before activation it is `legacy` (no lookups) and the response is unchanged.
    const source = await selectForecastServingSource(serviceRoleClient, query.seasonId);
    const data = await loadPlanningData(serviceRoleClient, query, { source, forgeDailyBridge: true });
    // A shared copy of native forecasts never outlives the selected catalog.
    const nativeMaxAge = source.kind === "native" ? Math.max(0, Math.min(300, Math.floor((Date.parse(source.expiresAt) - Date.now()) / 1000))) : null;
    res.setHeader("Cache-Control", nativeMaxAge === null ? "public, s-maxage=300, stale-while-revalidate=300" : `public, s-maxage=${nativeMaxAge}, stale-while-revalidate=0`);
    const forecastSource = source.kind === "legacy" ? {} : { forecastSource: forecastSourceSummary(source) };
    // Interim bridge projections travel compactly beside `data`; clients rebuild them exactly.
    const bridge = compactBridgeForecasts(data.forecasts, data, query.seasonId);
    // The whole body, bridge wire included, must fit the platform response limit; the latest bridge rows give way first.
    const body = fitBridgeWire(bridge.wire, wire => ({ success: true, data: { ...data, forecasts: bridge.forecasts }, ...(wire ? { bridgeForecasts: wire } : {}), ...forecastSource }),
      PLANNING_RESPONSE_BYTE_BUDGET);
    if (!body) return res.status(503).json({ success: false, code: "planning_range_too_large", error: "This planning range is too large to display. Choose a shorter range." });
    return res.json(body);
  } catch {
    return res.status(503).json({ success: false, error: "Planning data is temporarily unavailable. Your saved manual workspace is preserved." });
  }
}

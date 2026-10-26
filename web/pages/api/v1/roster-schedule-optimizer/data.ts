import type { NextApiRequest, NextApiResponse } from "next";
import { encodePlanningDataTransport, PlanningDataTransportLimitError } from "lib/rosterScheduleData/planningDataTransport";
import { compactBridgeForecasts, fitBridgeWire, PLANNING_RESPONSE_BYTE_BUDGET, type BridgeRunProof } from "lib/rosterScheduleData/bridgeForecastWire";
import serviceRoleClient from "lib/supabase/server";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { forecastSourceSummary, selectForecastServingSource } from "lib/player-forecasts/forecastServingSource";

/** Public shared inputs. No league/account data or admin/research payloads. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let query;
  try { query = parsePlanningDataQuery(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid planning range." }); }
  const nonce = req.headers?.["x-rso-read-nonce"];
  if (nonce !== undefined && (typeof nonce !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce))) {
    return res.status(400).json({ success: false, error: "Invalid planning read nonce." });
  }
  try {
    const now = new Date();
    // One server-side source per request; RSO has no legacy forecasts, so every fallback serves none.
    const source = await selectForecastServingSource(serviceRoleClient, query.seasonId, now);
    let proofs: BridgeRunProof[] = [];
    const data = await loadPlanningData(serviceRoleClient, query, { now, source, forgeDailyBridge: true, consumer: "rso", onBridgeRunProofs: served => { proofs = served; } });
    // A shared copy of native forecasts never outlives the selected catalog.
    const nativeMaxAge = source.kind === "native" ? Math.max(0, Math.min(300, Math.floor((Date.parse(source.expiresAt) - Date.now()) / 1000))) : null;
    res.setHeader("Cache-Control", nonce || data.forecastManifest?.rsoUsePolicy ? "private, no-store"
      : nativeMaxAge === null ? "public, s-maxage=300, stale-while-revalidate=300" : `public, s-maxage=${nativeMaxAge}, stale-while-revalidate=0`);
    // Interim bridge projections travel compactly beside `data`; clients rebuild them, so the strict transport is unchanged.
    const bridge = compactBridgeForecasts(data.forecasts, data, query.seasonId, proofs);
    const transport = encodePlanningDataTransport({ ...data, forecasts: bridge.forecasts }), forecastSource = forecastSourceSummary(source);
    // The whole body, bridge wire included, must fit the platform response limit; the latest bridge rows give way first.
    const body = fitBridgeWire(bridge.wire, wire => ({ success: true, data: transport, ...(wire ? { bridgeForecasts: wire } : {}), forecastSource,
      ...(nonce ? { read: { nonce, evaluatedAt: now.toISOString() } } : {}) }),
      PLANNING_RESPONSE_BYTE_BUDGET);
    if (!body) throw new PlanningDataTransportLimitError();
    return res.json(body);
  } catch (error) {
    if (error instanceof PlanningDataTransportLimitError) return res.status(503).json({ success: false, code: "planning_range_too_large", error: error.message });
    return res.status(503).json({ success: false, error: "Planning data is temporarily unavailable. Your saved manual workspace is preserved." });
  }
}

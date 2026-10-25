import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { requireProviderSyncAccess } from "lib/integrations/providerSyncAccessServer";
import { loadYahooPlanningConfirmations } from "lib/integrations/yahoo/planningConfirmations";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { compactBridgeForecasts, fitBridgeWire, PLANNING_RESPONSE_BYTE_BUDGET } from "lib/rosterScheduleData/bridgeForecastWire";
import { encodePlanningDataTransport, PlanningDataTransportLimitError } from "lib/rosterScheduleData/planningDataTransport";
import serviceRoleClient from "lib/supabase/server";

/** Fresh private planning generation; never a cacheable public data response. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const user = await requireApiUser(req, res); if (!user) return;
  let query;
  const { teamId, leagueId, nonce } = req.body ?? {};
  try {
    query = parsePlanningDataQuery(req.body ?? {});
    if (typeof teamId !== "string" || !teamId || teamId.length > 100 || typeof leagueId !== "string" || !leagueId || leagueId.length > 100
      || typeof nonce !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)) throw new Error();
  } catch { return res.status(400).json({ success: false, error: "Select an owned Yahoo team and valid planning dates." }); }
  try {
    await requireProviderSyncAccess(user.id);
    const now = new Date();
    const current = await loadPlanningData(serviceRoleClient, query, { now, forgeDailyBridge: true, consumer: "rso" });
    const { data, expiresAt } = await loadYahooPlanningConfirmations({ db: serviceRoleClient, userId: user.id, teamId, leagueId, query, data: current, now });
    const bridge = compactBridgeForecasts(data.forecasts, data, query.seasonId);
    const transport = encodePlanningDataTransport({ ...data, forecasts: bridge.forecasts });
    const body = fitBridgeWire(bridge.wire, wire => ({ success: true, data: transport, ...(wire ? { bridgeForecasts: wire } : {}),
      read: { nonce, evaluatedAt: now.toISOString(), expiresAt, principalId: user.id, teamId, leagueId,
        seasonId: query.seasonId, startDate: query.startDate, endDate: query.endDate, timeZone: query.timeZone ?? "UTC" } }), PLANNING_RESPONSE_BYTE_BUDGET);
    if (!body) throw new PlanningDataTransportLimitError();
    return res.json(body);
  } catch (error) {
    const status = error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 503;
    return res.status(status).json({ success: false, error: "Current Yahoo planning inputs could not be verified. Your saved plan is preserved." });
  }
}

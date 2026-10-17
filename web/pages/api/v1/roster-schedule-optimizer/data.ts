import type { NextApiRequest, NextApiResponse } from "next";
import { encodePlanningDataTransport, PlanningDataTransportLimitError } from "lib/rosterScheduleData/planningDataTransport";
import serviceRoleClient from "lib/supabase/server";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";

/** Public shared inputs. No league/account data or admin/research payloads. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let query;
  try { query = parsePlanningDataQuery(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid planning range." }); }
  try {
    const data = await loadPlanningData(serviceRoleClient, query);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=300");
    return res.json({ success: true, data: encodePlanningDataTransport(data) });
  } catch (error) {
    if (error instanceof PlanningDataTransportLimitError) return res.status(503).json({ success: false, code: "planning_range_too_large", error: error.message });
    return res.status(503).json({ success: false, error: "Planning data is temporarily unavailable. Your saved manual workspace is preserved." });
  }
}

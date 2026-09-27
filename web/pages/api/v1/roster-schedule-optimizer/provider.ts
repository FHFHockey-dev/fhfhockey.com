import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadInSeasonAccess, requireInSeasonCapability } from "lib/in-season/server";
import { loadYahooPlanningSnapshot } from "lib/integrations/yahoo/rosterPlanning";
import { YahooLiveDraftError } from "lib/integrations/yahoo/liveDraft";
import serviceRoleClient from "lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization, Cookie");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const user = await requireApiUser(req, res); if (!user) return;
  try {
    const access = await loadInSeasonAccess(user.id);
    requireInSeasonCapability(access, "rso_sync");
    const body = req.body ?? {};
    if (body.provider === "fantrax") return res.status(409).json({ success: false, error: "Fantrax settings and identity imports remain available in account settings. This adapter has not verified authoritative in-season roster or availability feeds; use reviewed manual inputs.", capabilities: { roster: false, availability: false, rules: false, matchup: false, acquisitions: false, limitations: ["Draft results are not current rosters."] } });
    if (body.provider !== "yahoo" || typeof body.teamId !== "string" || typeof body.startDate !== "string" || typeof body.endDate !== "string") return res.status(400).json({ success: false, error: "Select a Yahoo team and planning dates." });
    const result = await loadYahooPlanningSnapshot({ db: serviceRoleClient, userId: user.id, teamId: body.teamId, startDate: body.startDate, endDate: body.endDate, timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined });
    return res.json({ success: true, ...result });
  } catch (error) {
    const status = error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 503;
    // Typed provider errors contain curated messages, never raw response bodies or credentials.
    const providerError = error instanceof YahooLiveDraftError;
    if (status >= 500) console.error("[rso/provider] snapshot failed", { status, code: providerError ? error.code : "snapshot_unavailable" });
    return res.status(status).json({ success: false, error: (providerError || status < 500) && error instanceof Error ? error.message : "Provider inputs could not be verified. Your selected plan is preserved.", ...(providerError ? { code: error.code } : {}) });
  }
}

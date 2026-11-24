import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { SqlConnection } from "lib/forge-v2/history.server";
import { handleH10Shadow, h10RouteConfig } from "lib/forge-v2/h10Route.server";
import { fetchOfficialRoster, readNewsRows } from "lib/forge-v2/h10NewsRoute.server";
import { beginH10Dispatch, finishH10Dispatch, verifyH10Dispatch } from "lib/forge-v2/h10Dispatch.server";

// FORGE Full-NHL H1–H10 prospective shadow issuance (private, never served).
// Off unless FORGE_H10_SHADOW_ENABLED=true and an approval id is set.
// Only a signed one-use dispatch from forge_v2_private.forge_h10_tick_v1 (pg_cron) is accepted: an HMAC over route,
// mode, run and a 90 s expiry, keyed by FORGE_H10_DISPATCH_SECRET. No bearer token is accepted. The signature is checked
// before any database or forecast work; the dispatch is then consumed once (a duplicate reports the same run).
// nightly reads every club's official NHL roster once, freezes, then resumes under a 200 s budget.
// material snapshots accepted news cards (FxTwitter via the existing poller), rechecks the official roster of clubs a
// pending trade/recall report names (at most 4), issues confirmed moves and roster events, and records
// availability/role overlays on the stored forecasts.
// Writes only forge_v2_private. The only outbound request is api-web.nhle.com (never NST); RSO, Daily and pregame
// never read the output. FORGE_H10_OFFICIAL_ROSTERS=false turns the official roster reads off.
export const config = { maxDuration: 300, api: { bodyParser: { sizeLimit: "1kb" } } };

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const now = Date.now();
  const verified = verifyH10Dispatch({ method: req.method, path: new URL(req.url ?? "/", "http://route.invalid").pathname, query: req.query, headers: req.headers, body: req.body },
    process.env.FORGE_H10_DISPATCH_SECRET, now);
  if (!verified.ok) {
    if (verified.status === 405) res.setHeader("Allow", "POST");
    return res.status(verified.status).json(verified.body);
  }
  const config = h10RouteConfig(process.env);
  if ("error" in config) return res.status(200).json({ success: true, status: "skipped", reason: config.error });
  // SUPABASE_DB_POOLER_URL (Supavisor transaction pooler, the one Vercel can reach: the direct db.<ref> host is
  // IPv6-only), else SUPABASE_DB_URL (local), else POSTGRES_URL, the pooler URL the Supabase integration syncs. The H10
  // code needs no session state: its two advisory locks are transaction-scoped.
  const databaseUrl = process.env.SUPABASE_DB_POOLER_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) return res.status(503).json({ success: false, status: "failed", reason: "database_url_missing" });
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 2 });
  const db = pool as unknown as SqlConnection;
  try {
    const begun = await beginH10Dispatch(db, verified.dispatch);
    if (!begun.ok) return res.status(begun.status).json(begun.body);
    let outcome = "failed";
    try {
      const result = await handleH10Shadow({ mode: verified.dispatch.mode, now, db, config, readNews: readNewsRows,
        fetchRoster: config.officialRosters ? fetchOfficialRoster : undefined });
      outcome = String(result.body.status ?? "unknown");
      return res.status(result.status).json({ ...result.body, runKey: verified.dispatch.runKey });
    } finally {
      await finishH10Dispatch(db, verified.dispatch.dispatchId, outcome).catch(() => undefined);
    }
  } catch (error) {
    return res.status(500).json({ success: false, status: "failed", reason: error instanceof Error ? error.message.slice(0, 200) : "h10_shadow_failed" });
  } finally {
    await pool.end();
  }
}

export default withCronJobAudit(handler, {
  jobName: "forge-h10-shadow",
  responsePreviewKeys: ["status", "reason", "runKey", "denominatorSha256", "scopes", "complete", "moved", "availability", "official", "news", "overlay"],
  skipAuditWhenNoOp: body => ["no_change", "skipped", "duplicate"].includes(String((body as { status?: string })?.status)),
});

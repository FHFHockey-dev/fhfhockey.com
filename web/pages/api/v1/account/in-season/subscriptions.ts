import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import { assertInSeasonSandboxConfiguration } from "lib/in-season/billingConfig";
import { monthlyManagementEnabled } from "lib/in-season/billingEntryConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  if (!req.headers.authorization) return res.status(401).json({ error: "Sign in to manage billing." });
  try {
    assertInSeasonSandboxConfiguration();
    if (!monthlyManagementEnabled()) throw new Error("Disabled");
  } catch { return res.status(503).json({ error: "Billing management is unavailable." }); }
  const user = await requireApiUser(req, res); if (!user) return;
  if (Object.keys(req.query ?? {}).length) return res.status(400).json({ error: "Unexpected subscription query." });
  try {
    // Service-only, owner-filtered RPC; no table grants or client-supplied owner.
    // The separate draft RPC must be reviewed/applied to isolated storage first.
    const { data, error } = await (serviceRoleClient as any).rpc("list_in_season_sandbox_subscriptions", { p_user_id: user.id });
    if (error || !Array.isArray(data) || data.length > 20) throw new Error("Subscription lookup failed");
    const subscriptions = data.map((row: any) => {
      const timestamp = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
      if (!row || row.userId !== user.id || typeof row.subscriptionId !== "string" || !/^sub_[a-zA-Z0-9]{1,150}$/.test(row.subscriptionId)
        || !timestamp(row.cancelledAt) || !timestamp(row.billingStoppedAt) || typeof row.stopComplete !== "boolean") throw new Error("Invalid subscription summary");
      return { subscriptionId: row.subscriptionId, cancelledAt: row.cancelledAt, billingStoppedAt: row.billingStoppedAt, stopComplete: row.stopComplete };
    });
    return res.status(200).json({ data: { subscriptions } });
  } catch { return res.status(503).json({ error: "Billing details could not be loaded. Please try again." }); }
}

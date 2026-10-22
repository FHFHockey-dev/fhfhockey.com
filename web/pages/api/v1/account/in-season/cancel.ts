import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { assertInSeasonSandboxConfiguration } from "lib/in-season/billingConfig";
import { monthlyBillingStore } from "lib/in-season/monthlyStore";
import { cancelMonthlyBilling } from "lib/in-season/monthlyWebhook";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!req.headers.authorization) return res.status(401).json({ error: "Sign in to manage billing." });
  try { assertInSeasonSandboxConfiguration(); } catch { return res.status(503).json({ error: "Sandbox billing is unavailable." }); }
  const user = await requireApiUser(req, res); if (!user) return;
  if (!req.body || Object.keys(req.body).some((key) => !["subscriptionId", "requestId"].includes(key))
    || typeof req.body.subscriptionId !== "string" || !/^sub_[a-zA-Z0-9]{1,150}$/.test(req.body.subscriptionId)
    || typeof req.body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(req.body.requestId)) return res.status(400).json({ error: "Invalid cancellation request." });
  try {
    const store = monthlyBillingStore(); const state = await store.load(req.body.subscriptionId);
    if (!state || state.binding.userId !== user.id) return res.status(404).json({ error: "Subscription not found." });
    await cancelMonthlyBilling(store, user.id, req.body.subscriptionId, req.body.requestId);
    return res.status(200).json({ data: { accepted: true } });
  } catch { return res.status(503).json({ error: "Cancellation could not be saved. Please try again." }); }
}

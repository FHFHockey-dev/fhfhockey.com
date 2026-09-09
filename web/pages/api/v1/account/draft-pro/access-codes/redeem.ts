import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";

const input = z.object({ code: z.string().trim().min(20).max(200) }).strict();
const attempts = new Map<string, { count: number; reset: number }>();
const invalid = { error: "Code could not be redeemed." };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method Not Allowed" }); }
  const user = await requireApiUser(req, res); if (!user) return;
  const now = Date.now(); const state = attempts.get(user.id);
  if (state && state.reset > now && state.count >= 8) return res.status(429).json(invalid);
  const parsed = input.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(invalid);
  const { data, error } = await serviceRoleClient.rpc("redeem_draft_pro_access_code", { p_user_id: user.id, p_code: parsed.data.code });
  if (error || !data) {
    attempts.set(user.id, { count: (state?.reset ?? 0) > now ? (state?.count ?? 0) + 1 : 1, reset: now + 60_000 });
    return res.status(400).json(invalid);
  }
  attempts.delete(user.id);
  return res.status(200).json({ redeemed: true });
}

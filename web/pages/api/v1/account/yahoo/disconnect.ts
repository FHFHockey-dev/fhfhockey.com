import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import { YAHOO_PROVIDER } from "lib/integrations/yahoo/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  const { data: connectedAccount, error: accountError } = await serviceRoleClient
    .from("connected_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();

  if (accountError) {
    return res.status(500).json({ error: accountError.message });
  }

  if (connectedAccount?.id) {
    const { error } = await serviceRoleClient
      .from("connected_accounts")
      .delete()
      .eq("id", connectedAccount.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  const { error: settingsError } = await serviceRoleClient
    .from("user_settings")
    .update({
      active_context: {},
    })
    .eq("user_id", user.id);

  if (settingsError) {
    return res.status(500).json({ error: settingsError.message });
  }

  return res.status(200).json({
    success: true,
    message: "Yahoo Fantasy disconnected.",
  });
}

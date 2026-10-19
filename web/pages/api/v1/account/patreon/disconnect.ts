import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { disconnectPatreonAccount } from "lib/integrations/patreon/sync";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const result = await disconnectPatreonAccount(user.id);
    return res.status(200).json({
      success: true,
      disconnected: result.disconnected,
      message:
        "Patreon disconnected. Credentials were removed and access history was retained.",
    });
  } catch (error) {
    console.error("Patreon disconnect failed", error);
    return res.status(500).json({
      error: "Patreon could not be disconnected.",
      code: "PATREON_DISCONNECT_UNAVAILABLE",
    });
  }
}

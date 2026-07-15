import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { isPatreonConfigured } from "lib/integrations/patreon/config";
import { getPatreonState } from "lib/integrations/patreon/sync";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const state = await getPatreonState(user.id);
    return res
      .status(200)
      .json({ ...state, configured: isPatreonConfigured() });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Patreon account state could not be loaded.",
    });
  }
}

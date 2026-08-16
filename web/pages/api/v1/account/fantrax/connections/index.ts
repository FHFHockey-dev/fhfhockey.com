import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import { respondWithFantraxError } from "lib/integrations/fantrax/http";
import { getFantraxConnections } from "lib/integrations/fantrax/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  try {
    return res.status(200).json(await getFantraxConnections({ userId: user.id }));
  } catch (error) {
    return respondWithFantraxError(
      res,
      error,
      "Fantrax connections could not be loaded.",
    );
  }
}

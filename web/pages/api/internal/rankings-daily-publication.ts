import type { NextApiRequest, NextApiResponse } from "next";
import { invokedByCron } from "utils/adminOnlyMiddleware";
import { runDailyRankingPublication } from "lib/rankings/dailyPublicationDispatch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!invokedByCron(req.headers.authorization ?? "")) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (Object.keys(req.query).length) {
    return res.status(400).json({ error: "Scheduled Rankings does not accept parameter overrides." });
  }
  try {
    const result = await runDailyRankingPublication();
    const failed = result.status === "ambiguous" || result.status === "failed";
    return res.status(failed ? 503 : 200).json(result);
  } catch {
    // A missing terminal receipt can mean the RPC committed without a response.
    // The durable claim prevents an automatic replay of the writes.
    return res.status(503).json({ error: "Rankings dispatch unavailable. Check the durable run receipt." });
  }
}

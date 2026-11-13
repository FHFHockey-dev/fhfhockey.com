import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { LineHistoryValidationError, parseLineHistoryQuery, readLineHistory } from "lib/sources/lineHistory";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    const scope = parseLineHistoryQuery(req.query);
    return res.json(await readLineHistory(supabase, scope));
  } catch (error) {
    if (error instanceof LineHistoryValidationError) return res.status(400).json({ error: error.message });
    return res.status(503).json({ error: "Historical reports are temporarily unavailable" });
  }
}

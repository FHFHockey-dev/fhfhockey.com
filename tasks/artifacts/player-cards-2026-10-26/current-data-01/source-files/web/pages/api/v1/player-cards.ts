import type { NextApiRequest, NextApiResponse } from "next";
import { parseCurrentNhlRequest } from "lib/player-cards/currentNhl";
import { loadCurrentNhlCard } from "lib/player-cards/currentNhl.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ error: "GET required." }); return; }
  let request;
  try { request = parseCurrentNhlRequest(req.query); }
  catch { res.status(400).json({ error: "Valid playerId, season and count (5, 10, 20) are required." }); return; }
  try { res.status(200).json(await loadCurrentNhlCard(request)); }
  catch { res.status(502).json({ error: "NHL player-card inputs are unavailable. No values or ranks were substituted." }); }
}

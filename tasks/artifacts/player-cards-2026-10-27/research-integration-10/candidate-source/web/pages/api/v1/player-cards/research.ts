import type { NextApiRequest, NextApiResponse } from "next";
import { loadResearchFixtureText } from "lib/player-cards/researchFixtures.server";
import { researchExample } from "lib/player-cards/researchExamples";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).json({ error: "GET required." }); return; }
  const example = typeof req.query.fixture === "string" ? researchExample(req.query.fixture) : undefined;
  if (!example || req.query.playerId !== String(example.playerId) || req.query.eventThroughDate !== example.eventThroughDate) { res.status(400).json({ error: "An exact approved historical research example is required." }); return; }
  try { res.status(200).json(await loadResearchFixtureText(example)); }
  catch { res.status(503).json({ error: "Manifest-bound research evidence unavailable. No current data or substitute scores were loaded." }); }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import { PublicationError, publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";

export const config = { maxDuration: 240, api: { bodyParser: { sizeLimit: "1kb" } } };

async function publish(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  const body = req.body;
  if (!body || typeof body.claimId !== "string" || !Number.isSafeInteger(body.gameId) ||
      Object.keys(body).length !== 2 || Object.keys(req.query).length) {
    return res.status(400).json({ error: "invalid_target" });
  }
  const codeVersion = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.VERCEL_ENV !== "production" || !codeVersion || !/^[a-f0-9]{40}$/.test(codeVersion)) {
    return res.status(503).json({ error: "release_pin_unavailable" });
  }
  try {
    const result = await publishQualifiedPregameCapture({ claimId: body.claimId, gameId: body.gameId, codeVersion });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof PublicationError) {
      if (error.message === "capture_cutoff_pending") res.setHeader("Retry-After", "1");
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(503).json({ error: "publication_unconfirmed" });
  }
}

// The durable FORGE receipt is the operation's audit record. Publication has no cron or GET entry point.
export default withOperationalRouteAuth(publish, { methods: ["POST"], audit: false });

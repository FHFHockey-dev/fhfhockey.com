import type { NextApiRequest, NextApiResponse } from "next";

import { requireApiUser } from "lib/api/requireApiUser";
import {
  FantraxImportError,
  getFantraxImportState,
  runFantraxManualImport,
  setFantraxActiveTeam,
  setFantraxDefaultTeam,
} from "lib/integrations/fantrax/manualImport";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    if (req.method === "GET") {
      return res
        .status(200)
        .json(await getFantraxImportState({ userId: user.id }));
    }

    if (req.body?.action === "set_default_team") {
      if (typeof req.body?.teamId !== "string" || !req.body.teamId.trim()) {
        return res.status(400).json({ error: "teamId is required." });
      }
      await setFantraxDefaultTeam({
        userId: user.id,
        teamId: req.body.teamId.trim(),
      });
      return res.status(200).json({
        success: true,
        message: "Fantrax default team updated.",
      });
    }

    if (req.body?.action === "set_active_team") {
      if (typeof req.body?.teamId !== "string" || !req.body.teamId.trim()) {
        return res.status(400).json({ error: "teamId is required." });
      }
      await setFantraxActiveTeam({
        userId: user.id,
        teamId: req.body.teamId.trim(),
      });
      return res.status(200).json({
        success: true,
        message: "Fantrax active context updated.",
      });
    }

    const result = await runFantraxManualImport({
      userId: user.id,
      content: req.body?.content,
      format: req.body?.format,
    });
    return res.status(200).json({
      success: true,
      message: `Imported ${result.teamCount} Fantrax team${result.teamCount === 1 ? "" : "s"} across ${result.leagueCount} league${result.leagueCount === 1 ? "" : "s"}.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof FantraxImportError) {
      if (error.retryAfterSeconds) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
      }
      return res.status(error.statusCode).json({
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds ?? null,
      });
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Fantrax import failed.",
    });
  }
}

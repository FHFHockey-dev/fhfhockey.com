import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";

import {
  buildPlayerGameStrengthV2ForDateRange,
  buildTeamGameStrengthV2ForDateRange
} from "lib/projections/derived/buildStrengthTablesV2";
import { buildGoalieGameV2ForDateRange } from "lib/projections/derived/buildGoalieGameV2";

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  player: { gamesProcessed: number; rowsUpserted: number };
  team: { gamesProcessed: number; rowsUpserted: number };
  goalie: { gamesProcessed: number; rowsUpserted: number };
  errors: string[];
};

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      startDate: "",
      endDate: "",
      player: { gamesProcessed: 0, rowsUpserted: 0 },
      team: { gamesProcessed: 0, rowsUpserted: 0 },
      goalie: { gamesProcessed: 0, rowsUpserted: 0 },
      errors: ["Method not allowed"]
    });
  }

  const startDate = getParam(req, "startDate") ?? isoDateOnly(new Date().toISOString());
  const endDate = getParam(req, "endDate") ?? startDate;

  const errors: string[] = [];
  let player = { gamesProcessed: 0, rowsUpserted: 0 };
  let team = { gamesProcessed: 0, rowsUpserted: 0 };
  let goalie = { gamesProcessed: 0, rowsUpserted: 0 };

  try {
    player = await buildPlayerGameStrengthV2ForDateRange({ startDate, endDate });
  } catch (e) {
    errors.push(`player: ${(e as any)?.message ?? String(e)}`);
  }

  try {
    team = await buildTeamGameStrengthV2ForDateRange({ startDate, endDate });
  } catch (e) {
    errors.push(`team: ${(e as any)?.message ?? String(e)}`);
  }

  try {
    goalie = await buildGoalieGameV2ForDateRange({ startDate, endDate });
  } catch (e) {
    errors.push(`goalie: ${(e as any)?.message ?? String(e)}`);
  }

  return res.status(errors.length ? 207 : 200).json({
    success: errors.length === 0,
    startDate,
    endDate,
    player,
    team,
    goalie,
    errors
  });
}

export default withCronJobAudit(handler, { jobName: "build-projection-derived-v2" });

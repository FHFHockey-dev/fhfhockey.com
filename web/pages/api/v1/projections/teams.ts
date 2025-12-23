import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import supabase from "lib/supabase/server";
import { dateSchema, getQueryStringParam, requireLatestSucceededRunId } from "./_helpers";

const querySchema = z.object({
  date: dateSchema,
  horizon: z.coerce.number().int().min(1).max(10).default(1),
  runId: z.string().uuid().optional(),
  gameId: z.coerce.number().int().optional(),
  teamId: z.coerce.number().int().optional()
});

function parseQuery(req: NextApiRequest) {
  const parsed = querySchema.safeParse({
    date: getQueryStringParam(req.query.date),
    horizon: getQueryStringParam(req.query.horizon),
    runId: getQueryStringParam(req.query.runId),
    gameId: getQueryStringParam(req.query.gameId),
    teamId: getQueryStringParam(req.query.teamId)
  });
  if (!parsed.success) {
    const err = new Error("Invalid query parameters");
    (err as any).statusCode = 400;
    (err as any).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabase) throw new Error("Supabase server client not available");
    const q = parseQuery(req);
    const runId = q.runId ?? (await requireLatestSucceededRunId(q.date));

    let query = supabase
      .from("team_projections_v2")
      .select("*")
      .eq("run_id", runId)
      .eq("as_of_date", q.date)
      .eq("horizon_games", q.horizon);

    if (q.gameId != null) query = query.eq("game_id", q.gameId);
    if (q.teamId != null) query = query.eq("team_id", q.teamId);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      runId,
      asOfDate: q.date,
      horizonGames: q.horizon,
      data: data ?? []
    });
  } catch (e) {
    const statusCode = (e as any)?.statusCode ?? 500;
    return res.status(statusCode).json({
      error: (e as any)?.message ?? String(e),
      details: (e as any)?.details
    });
  }
}


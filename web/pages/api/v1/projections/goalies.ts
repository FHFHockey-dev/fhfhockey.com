import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { requireExternalInputProvenRun, requireLatestExternalInputProvenRun,
  runProofDiagnostics } from "lib/projections/externalInputProof";
import {
  buildProjectionApiErrorResponse,
  dateSchema,
  getQueryStringParam,
} from "lib/projections/apiHelpers";

const querySchema = z.object({
  date: dateSchema,
  horizon: z.coerce.number().int().min(1).max(10).default(1),
  runId: z.string().uuid().optional(),
  gameId: z.coerce.number().int().optional(),
  teamId: z.coerce.number().int().optional(),
  goalieId: z.coerce.number().int().optional(),
});

function parseQuery(req: NextApiRequest) {
  const parsed = querySchema.safeParse({
    date: getQueryStringParam(req.query.date),
    horizon: getQueryStringParam(req.query.horizon),
    runId: getQueryStringParam(req.query.runId),
    gameId: getQueryStringParam(req.query.gameId),
    teamId: getQueryStringParam(req.query.teamId),
    goalieId: getQueryStringParam(req.query.goalieId),
  });
  if (!parsed.success) {
    const err = new Error("Invalid query parameters");
    (err as any).statusCode = 400;
    (err as any).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}

function applyDeprecationHeaders(res: NextApiResponse) {
  res.setHeader("Deprecation", "true");
  res.setHeader("X-FHF-Canonical-Route", "/api/v1/forge/goalies");
  res.setHeader("Link", '</api/v1/forge/goalies>; rel="successor-version"');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    applyDeprecationHeaders(res);
    if (!supabase) throw new Error("Supabase server client not available");
    const q = parseQuery(req);
    // Explicit and latest runs alike are served only with external-input exclusion proof (Astra F4): team totals sum
    // skater heads, and goalie lines use opponent shots derived from them, so they share the skater runs' provenance.
    const selected = q.runId ? await requireExternalInputProvenRun(q.runId) : await requireLatestExternalInputProvenRun(q.date);
    const runId = selected.runId;

    let query = supabase
      .from("forge_goalie_projections")
      .select("*")
      .eq("run_id", runId)
      .eq("as_of_date", q.date)
      .eq("horizon_games", q.horizon);

    if (q.gameId != null) query = query.eq("game_id", q.gameId);
    if (q.teamId != null) query = query.eq("team_id", q.teamId);
    if (q.goalieId != null) query = query.eq("goalie_id", q.goalieId);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      deprecated: true,
      canonicalRoute: "/api/v1/forge/goalies",
      runId,
      runProof: runProofDiagnostics(runId, selected.proof),
      asOfDate: q.date,
      horizonGames: q.horizon,
      data: data ?? [],
    });
  } catch (e) {
    applyDeprecationHeaders(res);
    const failure = buildProjectionApiErrorResponse(
      e,
      "PROJECTION_GOALIES_UNAVAILABLE",
    );
    return res.status(failure.statusCode).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      deprecated: true,
      canonicalRoute: "/api/v1/forge/goalies",
      error: failure.error,
      details: failure.details,
    });
  }
}

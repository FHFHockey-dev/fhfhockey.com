// Team and goalie sustainability producer for the unified entity tables.
//
// Dry run by default: rows are computed and summarized but nothing is
// written unless dryRun=false is passed explicitly. Reads existing database
// inputs only (no NST requests). Not scheduled: a cron entry needs approval.
//
//   GET /api/v1/sustainability/rebuild-entity-sustainability
//       ?season_id=20262027&end_date=2026-11-22[&start_date=2026-11-01]
//       [&entity=team|goalie|all][&dryRun=false]

import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import supabase from "lib/supabase/server";
import { computeEntitySustainability } from "lib/sustainability/entityProducerData";
import { upsertEntitySustainabilityRows } from "lib/sustainability/entityProducerWrite";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** One call covers at most this many snapshot dates. */
export const MAX_DATES_PER_CALL = 62;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function rebuildEntitySustainabilityHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const params = { ...req.query, ...(typeof req.body === "object" && req.body ? req.body : {}) };
  const seasonId = Number(first(params.season_id));
  const endDate = first(params.end_date);
  const startDate = first(params.start_date) ?? null;
  const entity = first(params.entity) ?? "all";
  const dryRun = first(params.dryRun) !== "false";

  if (!Number.isInteger(seasonId) || seasonId < 19000000) {
    return res.status(400).json({ success: false, message: "season_id is required" });
  }
  if (!endDate || !DATE_RE.test(endDate) || (startDate && !DATE_RE.test(startDate))) {
    return res
      .status(400)
      .json({ success: false, message: "end_date (and optional start_date) must be YYYY-MM-DD" });
  }
  if (!["team", "goalie", "all"].includes(entity)) {
    return res.status(400).json({ success: false, message: "entity must be team, goalie or all" });
  }

  try {
    const run = await computeEntitySustainability({
      client: supabase as any,
      seasonId,
      startDate,
      endDate,
      entityTypes: entity === "all" ? ["team", "goalie"] : [entity as "team" | "goalie"]
    });
    if (run.dates.length > MAX_DATES_PER_CALL) {
      return res.status(400).json({
        success: false,
        message: `This call would cover ${run.dates.length} dates; pass start_date so it covers at most ${MAX_DATES_PER_CALL}.`,
        firstDate: run.dates[0],
        lastDate: run.dates[run.dates.length - 1]
      });
    }
    const skipReasons: Record<string, number> = {};
    for (const skip of run.skips) skipReasons[skip.reason] = (skipReasons[skip.reason] ?? 0) + 1;

    const written = dryRun
      ? null
      : await upsertEntitySustainabilityRows(supabase as any, {
          scores: run.scores,
          bands: run.bands
        });

    return res.status(200).json({
      success: true,
      dryRun,
      seasonId: run.seasonId,
      readyThrough: run.readyThrough,
      firstDate: run.dates[0] ?? null,
      lastDate: run.dates[run.dates.length - 1] ?? null,
      dates: run.dates.length,
      scoreRows: run.scores.length,
      bandRows: run.bands.length,
      skipReasons,
      unmappedAbbrevs: run.unmappedAbbrevs,
      written
    });
  } catch (error: any) {
    console.error("rebuild-entity-sustainability error", error?.message ?? error);
    return res.status(500).json({ success: false, message: error?.message ?? String(error) });
  }
}

export default adminOnly(rebuildEntitySustainabilityHandler as any);

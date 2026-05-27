import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase/server";
import {
  auditXgBackfillCoverage,
  type XgBackfillCoverageAuditArgs
} from "lib/xg/backfillCoverageAudit";

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseGameTypes(query: NextApiRequest["query"]): number[] | null {
  const raw = firstQueryValue(query.gameTypes) ?? firstQueryValue(query.gameType);
  if (!raw) return [2, 3];
  if (["all", "full"].includes(raw.toLowerCase())) return null;

  const values = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? values : [2, 3];
}

function parsePredictionType(
  value: string | null
): XgBackfillCoverageAuditArgs["predictionType"] {
  return value === "rebound_creation" ? "rebound_creation" : "shot_goal";
}

async function resolveSeasonId(query: NextApiRequest["query"]): Promise<number> {
  const explicit = parseOptionalInteger(firstQueryValue(query.seasonId));
  if (explicit != null) return explicit;
  const season = await getCurrentSeason();
  return season.seasonId;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const seasonId = await resolveSeasonId(req.query);
    const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
    const parserVersion = parseInteger(firstQueryValue(req.query.parserVersion), 1);
    const strengthVersion = parseInteger(firstQueryValue(req.query.strengthVersion), 1);
    const sampleLimit = parseInteger(firstQueryValue(req.query.sampleLimit), 20);
    const predictionType = parsePredictionType(firstQueryValue(req.query.predictionType));
    const modelVersion = firstQueryValue(req.query.modelVersion);

    const audit = await auditXgBackfillCoverage({
      supabase,
      seasonId,
      gameTypes: parseGameTypes(req.query),
      featureVersion,
      parserVersion,
      strengthVersion,
      modelVersion,
      predictionType,
      sampleLimit
    });

    return res.status(200).json({
      success: true,
      ...audit
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export default withCronJobAudit(handler, {
  jobName: "audit-nhl-xg-backfill"
});

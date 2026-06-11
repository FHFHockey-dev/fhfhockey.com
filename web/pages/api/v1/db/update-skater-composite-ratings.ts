import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildSkaterCompositeRatingRows,
  upsertSkaterCompositeRatingRows,
  type SkaterCompositeBuildRequest,
} from "lib/rankings/skaterCompositeWriter";
import type { ContextualRankingPeerGroupType } from "lib/rankings/rankingCalculator";
import type {
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
} from "lib/rankings/rankingTypes";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 1000;

type RequestWithSupabase = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  supabase: SupabaseClient<Database>;
};

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readInteger(
  value: string | string[] | undefined,
  fallback: number | null,
  options: { min?: number; max?: number } = {},
) {
  const raw = first(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  if (options.min != null && parsed < options.min) return fallback;
  if (options.max != null && parsed > options.max) return fallback;
  return parsed;
}

function readBoolean(value: string | string[] | undefined, fallback: boolean) {
  const raw = first(value).toLowerCase();
  if (["1", "true", "yes"].includes(raw)) return true;
  if (["0", "false", "no"].includes(raw)) return false;
  return fallback;
}

function readDate(value: string | string[] | undefined) {
  const raw = first(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function readEnum<T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  const raw = first(value).toLowerCase();
  return allowed.find((entry) => entry.toLowerCase() === raw) ?? fallback;
}

function derivePeerGroupType(args: {
  teamId: number | null;
  deployment: ContextualRankingsDeploymentFilter;
  position: ContextualRankingsPositionFilter;
}): ContextualRankingPeerGroupType {
  if (args.teamId != null) return "team";
  if (args.deployment !== "all") return "deployment";
  if (args.position !== "all") return "position";
  return "all_skaters";
}

function parseRequest(query: RequestWithSupabase["query"]): SkaterCompositeBuildRequest {
  const season = readInteger(query.season, null, {
    min: 19000000,
    max: 21000000,
  });
  if (season == null) {
    throw new Error("A numeric season query parameter is required.");
  }
  const position = readEnum(query.position, ["all", "F", "D"] as const, "all");
  const deployment = readEnum(
    query.deployment,
    [
      "all",
      "L1",
      "L2",
      "L3",
      "L4",
      "P1",
      "P2",
      "P3",
      "PP1",
      "PP2",
      "PP3",
      "PK1",
      "PK2",
    ] as const,
    "all",
  );
  const teamId = readInteger(query.team, null, { min: 1 });

  return {
    season,
    asOfDate: readDate(query.as_of_date),
    window: readEnum(
      query.window,
      ["season", "last5", "last10", "last20"] as const,
      "season",
    ),
    position,
    deployment,
    strength: readEnum(
      query.strength,
      ["all", "5v5", "ev", "pp", "pk"] as const,
      "5v5",
    ),
    minGp: readInteger(query.min_gp, 1, { min: 0 }),
    minToiSeconds: readInteger(query.min_toi, 300, { min: 0 }),
    teamId,
    peerGroupType: derivePeerGroupType({ teamId, deployment, position }),
    limit:
      readInteger(query.limit, DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT }) ??
      DEFAULT_LIMIT,
  };
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const request = parseRequest(req.query);
    const dryRun = readBoolean(req.query.dryRun, true);
    const built = await buildSkaterCompositeRatingRows(request);
    const rowsUpserted = dryRun
      ? 0
      : await upsertSkaterCompositeRatingRows(req.supabase, built.rows);

    return res.status(200).json({
      success: true,
      dryRun,
      request,
      snapshotDate: built.snapshotDate,
      snapshotUpdatedAt: built.snapshotUpdatedAt,
      generatedRows: built.rows.length,
      rowsUpserted,
      sourceMetrics: built.sourceMetrics,
      sourceFreshness: built.sourceFreshness,
      unavailableMetrics: built.unavailableMetrics,
      sampleRows: built.rows.slice(0, 3),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update skater composite ratings.",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-skater-composite-ratings",
});

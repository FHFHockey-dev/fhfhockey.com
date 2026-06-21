import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildEntityMetricRankingRows,
  defaultEntityMetricRankingMetricKeys,
  upsertEntityMetricRankingRows,
  type EntityMetricRankingBuildRequest,
} from "lib/rankings/entityMetricRankingWriter";
import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "lib/rankings/metricDefinitions";
import type { ContextualRankingPeerGroupType } from "lib/rankings/rankingCalculator";
import type {
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
} from "lib/rankings/rankingTypes";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "lib/rankings/skaterWindowAggregation";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  supabase: SupabaseClient<Database>;
};

const DEFAULT_WINDOWS: SkaterProductionWindow[] = [
  "season",
  "last5",
  "last10",
  "last20",
];

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

function readCsv(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readWindows(query: RequestWithSupabase["query"]) {
  const raw = readCsv(query.windows);
  if (raw.length === 0 && first(query.window)) {
    raw.push(first(query.window));
  }
  if (raw.length === 0) return DEFAULT_WINDOWS;

  const allowed = new Set<SkaterProductionWindow>(DEFAULT_WINDOWS);
  const windows = raw.map((entry) => {
    const normalized = entry.toLowerCase();
    const match = DEFAULT_WINDOWS.find(
      (window) => window.toLowerCase() === normalized,
    );
    if (!match || !allowed.has(match)) {
      throw new Error(`Unsupported window for entity metric ranking writer: ${entry}`);
    }
    return match;
  });

  return Array.from(new Set(windows));
}

function readMetricKeys(
  value: string | string[] | undefined,
  strength: SkaterWindowStrengthState,
) {
  const raw = readCsv(value);
  if (raw.length === 0) {
    return defaultEntityMetricRankingMetricKeys({ strength });
  }

  return Array.from(new Set(raw)).map((metricKey) => {
    const definition = getContextualRankingMetricDefinition(metricKey);
    if (!definition) {
      throw new Error(`Unknown metric for entity metric ranking writer: ${metricKey}`);
    }
    if (definition.sourceTable !== "rolling_player_game_metrics") {
      throw new Error(
        `${metricKey} is not backed by the verified rolling ranking snapshot pipeline.`,
      );
    }
    return definition.metricKey as ContextualRankingMetricKey;
  });
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

function parseRequest(
  query: RequestWithSupabase["query"],
): EntityMetricRankingBuildRequest {
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
  const strength = readEnum(
    query.strength,
    ["all", "5v5", "ev", "pp", "pk"] as const,
    "5v5",
  );
  const teamId = readInteger(query.team, null, { min: 1 });
  const metricKeys = readMetricKeys(query.metrics ?? query.metric, strength);
  if (metricKeys.length === 0) {
    throw new Error("No rolling-backed metrics were selected for snapshot writing.");
  }

  return {
    season,
    asOfDate: readDate(query.as_of_date),
    windows: readWindows(query),
    position,
    deployment,
    strength,
    minGp: readInteger(query.min_gp, 1, { min: 0 }),
    minToiSeconds: readInteger(query.min_toi, 300, { min: 0 }),
    teamId,
    peerGroupType: derivePeerGroupType({ teamId, deployment, position }),
    metricKeys,
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
    const upsertChunkSize = readInteger(req.query.upsertChunkSize, null, {
      min: 1,
      max: 500,
    });
    const built = await buildEntityMetricRankingRows(request);
    const rowsUpserted = dryRun
      ? 0
      : await upsertEntityMetricRankingRows(req.supabase, built.rows, {
          chunkSize: upsertChunkSize ?? undefined,
        });

    return res.status(200).json({
      success: true,
      dryRun,
      request,
      upsertChunkSize,
      generatedRows: built.rows.length,
      rowsUpserted,
      contexts: built.contexts,
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
          : "Failed to update entity metric rankings.",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-entity-metric-rankings",
});

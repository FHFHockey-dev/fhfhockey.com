import { parseQueryBoolean } from "lib/api/queryParams";
import {
  buildEndpointScanSummary,
  type EndpointScanSummary
} from "lib/api/scanSummary";
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { FORGE_COMPATIBILITY_INVENTORY } from "lib/projections/compatibilityInventory";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  parseRollingExecutionProfile,
  ROLLING_FORGE_PIPELINE_BUDGETS_MS,
  type RollingForgePipelineMode
} from "lib/rollingPlayerOperationalPolicy";
import {
  getRollingForgeDependencyContract,
  getRollingForgePipelineSpec,
  getRollingForgeStagesForMode,
  type RollingForgePipelineStageId
} from "lib/rollingForgePipeline";

import updateGamesHandler from "./update-games";
import updateTeamsHandler from "./update-teams";
import updatePlayersHandler from "./update-players";
import updateNstGamelogHandler from "./update-nst-gamelog";
import updateWgoSkatersHandler from "./update-wgo-skaters";
import updateWgoTotalsHandler from "./update-wgo-totals";
import updateWgoAveragesHandler from "./update-wgo-averages";
import updateLineCombinationsHandler from "./update-line-combinations";
import updatePowerPlayCombinationsBatchHandler from "./update-power-play-combinations";
import updateRollingPlayerAveragesHandler from "./update-rolling-player-averages";
import ingestProjectionInputsHandler from "./ingest-projection-inputs";
import buildProjectionDerivedHandler from "./build-projection-derived-v2";
import updateGoalieProjectionsV2Handler from "./update-goalie-projections-v2";
import runProjectionV2Handler from "./run-projection-v2";
import runProjectionAccuracyHandler from "./run-projection-accuracy";

type StepStatus = "success" | "failed" | "skipped";
type StageStatus = StepStatus;

type StepResult = {
  id: string;
  route: string;
  status: StepStatus;
  statusCode: number;
  durationMs: number;
  summary: unknown;
  query: Record<string, string>;
  reason?: string;
};

type StageResult = {
  id: RollingForgePipelineStageId;
  label: string;
  status: StageStatus;
  blocking: boolean;
  durationMs: number;
  reason?: string;
  steps: StepResult[];
};

type ResponseBody = {
  success: boolean;
  mode: RollingForgePipelineMode;
  dateWindow: {
    startDate: string;
    endDate: string;
    date: string;
  };
  durationMs: string;
  runtimeBudget: {
    budgetMs: number;
    budgetLabel: string;
    durationMs: number;
    durationLabel: string;
    withinBudget: boolean;
  };
  executionControls: {
    includeDownstream: boolean;
    includeAccuracy: boolean;
    stopOnFailure: boolean;
  };
  downstreamSummary: {
    stageId: "downstream_projection_consumers";
    includesLegacyStartChartMaterialization: boolean;
    legacyStartChartMaterializerRetired: boolean;
    includesAccuracyRefresh: boolean;
    canonicalSkaterReadPath: string;
    legacyMaterializerRoute: string | null;
    notes: string[];
  };
  dependencyContract: ReturnType<typeof getRollingForgeDependencyContract>;
  pipeline: ReturnType<typeof getRollingForgePipelineSpec>;
  compatibilityInventory: typeof FORGE_COMPATIBILITY_INVENTORY;
  scanSummary: EndpointScanSummary;
  stages: StageResult[];
};

type RouteHandler = (req: any, res: any) => Promise<void>;

function getParam(req: NextApiRequest, key: string): string | null {
  const value = req.query[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function parseBooleanParam(value: string | null, fallback = false) {
  const parsed = parseQueryBoolean(value ?? undefined);
  return parsed ?? fallback;
}

function parseMode(value: string | null): RollingForgePipelineMode {
  return parseRollingExecutionProfile(value);
}

function isoDateOnly(input: Date | string) {
  const value = typeof input === "string" ? new Date(input) : input;
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, delta: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return isoDateOnly(value);
}

function parseDateWindow(req: NextApiRequest) {
  const date = getParam(req, "date") ?? isoDateOnly(new Date());
  const startDate = getParam(req, "startDate") ?? date;
  const endDate = getParam(req, "endDate") ?? date;
  return {
    date,
    startDate,
    endDate
  };
}

function buildRuntimeBudgetSummary(
  mode: RollingForgePipelineMode,
  durationMs: number
) {
  const budgetMs = ROLLING_FORGE_PIPELINE_BUDGETS_MS[mode];
  return {
    budgetMs,
    budgetLabel: formatDurationMsToMMSS(budgetMs),
    durationMs,
    durationLabel: formatDurationMsToMMSS(durationMs),
    withinBudget: durationMs <= budgetMs
  };
}

function buildQueryString(query: Record<string, string>) {
  const params = new URLSearchParams(query);
  const rendered = params.toString();
  return rendered ? `?${rendered}` : "";
}

function readNumeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPipelineScanSummary(args: {
  requestedDate: string;
  activeDataDate: string;
  success: boolean;
  stageResults: StageResult[];
}) {
  const failedStages = args.stageResults.filter(
    (stage) => stage.status === "failed"
  );
  const blockingFailures = failedStages.filter((stage) => stage.blocking);
  const stepSummaries = args.stageResults.flatMap((stage) => stage.steps);
  const rollingSummary = stepSummaries.find(
    (step) => step.id === "update-rolling-player-averages"
  )?.summary as Record<string, any> | undefined;
  const projectionSummary = stepSummaries.find(
    (step) => step.id === "run-projection-v2"
  )?.summary as Record<string, any> | undefined;
  const accuracySummary = stepSummaries.find(
    (step) => step.id === "run-projection-accuracy"
  )?.summary as Record<string, any> | undefined;

  const freshnessBlockers =
    readNumeric(rollingSummary?.freshnessGate?.blockerCount) ?? 0;
  const projectionPreflightFailures = Array.isArray(
    projectionSummary?.preflight?.gates
  )
    ? projectionSummary.preflight.gates.filter(
        (gate: any) => gate?.status === "FAIL"
      ).length
    : 0;
  const accuracyPreflightFailures = Array.isArray(
    accuracySummary?.preflight?.gates
  )
    ? accuracySummary.preflight.gates.filter(
        (gate: any) => gate?.status === "FAIL"
      ).length
    : 0;
  const blockingIssueCount =
    freshnessBlockers +
    projectionPreflightFailures +
    accuracyPreflightFailures +
    blockingFailures.length;

  return buildEndpointScanSummary({
    surface: "rolling_forge_pipeline_operator",
    requestedDate: args.requestedDate,
    activeDataDate: args.activeDataDate,
    fallbackApplied: false,
    status:
      blockingFailures.length > 0
        ? "blocked"
        : args.success
          ? "ready"
          : "partial",
    rowCounts: {
      rollingPlayerRowsUpserted: readNumeric(
        rollingSummary?.runSummary?.rowsUpserted
      ),
      projectionPlayerRowsUpserted: readNumeric(
        projectionSummary?.playerRowsUpserted
      ),
      projectionTeamRowsUpserted: readNumeric(
        projectionSummary?.teamRowsUpserted
      ),
      projectionGoalieRowsUpserted: readNumeric(
        projectionSummary?.goalieRowsUpserted
      ),
      accuracyRowsUpserted: readNumeric(accuracySummary?.rowsUpserted)
    },
    blockingIssueCount,
    notes: [
      ...blockingFailures.map(
        (stage) =>
          `${stage.label} failed${stage.reason ? `: ${stage.reason}` : "."}`
      ),
      freshnessBlockers > 0
        ? `Rolling freshness gate reported ${freshnessBlockers} blocker(s).`
        : null,
      projectionPreflightFailures > 0
        ? `Projection execution reported ${projectionPreflightFailures} failed preflight gate(s).`
        : null,
      accuracyPreflightFailures > 0
        ? `Accuracy refresh reported ${accuracyPreflightFailures} failed preflight gate(s).`
        : null
    ]
  });
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

function isSuccessStatus(statusCode: number, body: unknown) {
  if (statusCode >= 400) return false;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (record.success === false) return false;
    if (typeof record.error === "string" && record.error.trim()) return false;
  }
  return true;
}

async function invokeRouteStep(args: {
  id: string;
  route: string;
  handler: RouteHandler;
  query?: Record<string, string>;
}): Promise<StepResult> {
  const startedAt = Date.now();
  const query = args.query ?? {};
  const req: any = {
    method: "GET",
    query,
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`
    },
    url: `${args.route}${buildQueryString(query)}`
  };
  const res = createMockRes();

  await args.handler(req, res);

  return {
    id: args.id,
    route: args.route,
    status: isSuccessStatus(res.statusCode, res.body) ? "success" : "failed",
    statusCode: res.statusCode,
    durationMs: Date.now() - startedAt,
    summary: res.body,
    query
  };
}

async function listGameIdsInRange(startDate: string, endDate: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("games")
    .select("id")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => Number((row as { id: number }).id));
}

async function runStage(args: {
  id: RollingForgePipelineStageId;
  mode: RollingForgePipelineMode;
  startDate: string;
  endDate: string;
  date: string;
  includeDownstream: boolean;
  includeAccuracy: boolean;
}): Promise<StageResult> {
  const startedAt = Date.now();
  const steps: StepResult[] = [];
  const isSingleDateDailyIncremental =
    args.mode === "daily_incremental" && args.startDate === args.endDate;
  const projectionInputStartDate = isSingleDateDailyIncremental
    ? addDays(args.startDate, -14)
    : args.startDate;
  const projectionInputEndDate = args.endDate;
  const derivedBuildStartDate = isSingleDateDailyIncremental
    ? addDays(args.startDate, -7)
    : args.startDate;
  const derivedBuildEndDate = isSingleDateDailyIncremental
    ? addDays(args.endDate, -1)
    : args.endDate;

  const addStep = async (step: {
    id: string;
    route: string;
    handler: RouteHandler;
    query?: Record<string, string>;
  }) => {
    steps.push(await invokeRouteStep(step));
  };

  switch (args.id) {
    case "core_entity_freshness":
      await addStep({
        id: "update-games",
        route: "/api/v1/db/update-games",
        handler: updateGamesHandler
      });
      await addStep({
        id: "update-teams",
        route: "/api/v1/db/update-teams",
        handler: updateTeamsHandler
      });
      await addStep({
        id: "update-players",
        route: "/api/v1/db/update-players",
        handler: updatePlayersHandler
      });
      break;
    case "upstream_skater_sources":
      await addStep({
        id: "update-nst-gamelog",
        route: "/api/v1/db/update-nst-gamelog",
        handler: updateNstGamelogHandler,
        query: {
          runMode: "incremental",
          startDate: args.startDate
        }
      });
      await addStep({
        id: "update-wgo-skaters",
        route: "/api/v1/db/update-wgo-skaters",
        handler: updateWgoSkatersHandler,
        query: {
          action: "all",
          startDate: args.startDate
        }
      });
      await addStep({
        id: "update-wgo-totals",
        route: "/api/v1/db/update-wgo-totals",
        handler: updateWgoTotalsHandler,
        query: {
          season: "current"
        }
      });
      await addStep({
        id: "update-wgo-averages",
        route: "/api/v1/db/update-wgo-averages",
        handler: updateWgoAveragesHandler,
        query: {
          season: "current"
        }
      });
      break;
    case "contextual_builders": {
      await addStep({
        id: "update-line-combinations",
        route: "/api/v1/db/update-line-combinations",
        handler: updateLineCombinationsHandler,
        query: {
          count: args.mode === "overnight" ? "25" : "10"
        }
      });
      const gameIds = await listGameIdsInRange(args.startDate, args.endDate);
      if (gameIds.length === 0) {
        steps.push({
          id: "update-power-play-combinations-batch",
          route: "/api/v1/db/update-power-play-combinations",
          status: "skipped",
          statusCode: 200,
          durationMs: 0,
          summary: null,
          query: {},
          reason: "No games found in the selected date range."
        });
      } else {
        await addStep({
          id: "update-power-play-combinations-batch",
          route: "/api/v1/db/update-power-play-combinations",
          handler: updatePowerPlayCombinationsBatchHandler,
          query: {
            startDate: args.startDate,
            endDate: args.endDate
          }
        });
      }
      break;
    }
    case "rolling_player_recompute":
      await addStep({
        id: "update-rolling-player-averages",
        route: "/api/v1/db/update-rolling-player-averages",
        handler: updateRollingPlayerAveragesHandler,
        query: {
          startDate: args.startDate,
          endDate: args.endDate,
          fastMode: "true",
          executionProfile:
            args.mode === "overnight"
              ? "overnight"
              : args.mode === "targeted_repair"
                ? "targeted_repair"
                : "daily_incremental"
        }
      });
      break;
    case "projection_input_ingest":
      await addStep({
        id: "ingest-projection-inputs",
        route: "/api/v1/db/ingest-projection-inputs",
        handler: ingestProjectionInputsHandler,
        query: {
          startDate: projectionInputStartDate,
          endDate: projectionInputEndDate
        }
      });
      break;
    case "projection_derived_build":
      await addStep({
        id: "build-projection-derived-v2",
        route: "/api/v1/db/build-projection-derived-v2",
        handler: buildProjectionDerivedHandler,
        query: {
          startDate: derivedBuildStartDate,
          endDate: derivedBuildEndDate
        }
      });
      break;
    case "projection_execution":
      await addStep({
        id: "update-goalie-projections-v2",
        route: "/api/v1/db/update-goalie-projections-v2",
        handler: updateGoalieProjectionsV2Handler,
        query: {
          limit: args.mode === "overnight" ? "30" : "7"
        }
      });
      await addStep({
        id: "run-projection-v2",
        route: "/api/v1/db/run-projection-v2",
        handler: runProjectionV2Handler,
        query:
          args.startDate === args.endDate
            ? {
                date: args.date
              }
            : {
                startDate: args.startDate,
                endDate: args.endDate
              }
      });
      break;
    case "downstream_projection_consumers":
      if (!args.includeDownstream) {
        steps.push({
          id: "run-projection-accuracy",
          route: "/api/v1/db/run-projection-accuracy",
          status: "skipped",
          statusCode: 200,
          durationMs: 0,
          summary: null,
          query: {},
          reason:
            "Downstream accuracy refresh disabled by request."
        });
        break;
      }
      if (!args.includeAccuracy) {
        steps.push({
          id: "run-projection-accuracy",
          route: "/api/v1/db/run-projection-accuracy",
          status: "skipped",
          statusCode: 200,
          durationMs: 0,
          summary: null,
          query: {},
          reason: "Accuracy refresh disabled by request."
        });
      } else {
        await addStep({
          id: "run-projection-accuracy",
          route: "/api/v1/db/run-projection-accuracy",
          handler: runProjectionAccuracyHandler,
          query: {
            date: args.date,
            projectionOffsetDays: "0"
          }
        });
      }
      break;
    case "monitoring":
      steps.push({
        id: "cron-report",
        route: "/api/v1/db/cron-report",
        status: "skipped",
        statusCode: 200,
        durationMs: 0,
        summary: null,
        query: {},
        reason:
          "Monitoring remains a separate reporting surface and is not invoked recursively by the coordinator."
      });
      break;
  }

  const status = steps.some((step) => step.status === "failed")
    ? "failed"
    : steps.some((step) => step.status === "success")
      ? "success"
      : "skipped";

  return {
    id: args.id,
    label:
      getRollingForgePipelineSpec().stages.find((stage) => stage.id === args.id)
        ?.label ?? args.id,
    status,
    blocking:
      getRollingForgePipelineSpec().stages.find((stage) => stage.id === args.id)
        ?.blocking ?? true,
    durationMs: Date.now() - startedAt,
    steps
  };
}

export const __testables = {
  listGameIdsInRange,
  invokeRouteStep,
  runStage
};

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody>) {
  const startedAt = Date.now();
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      mode: "daily_incremental",
      dateWindow: {
        startDate: "",
        endDate: "",
        date: ""
      },
      durationMs: formatDurationMsToMMSS(0),
      runtimeBudget: buildRuntimeBudgetSummary("daily_incremental", 0),
      executionControls: {
        includeDownstream: false,
        includeAccuracy: false,
        stopOnFailure: true
      },
      downstreamSummary: {
        stageId: "downstream_projection_consumers",
        includesLegacyStartChartMaterialization: false,
        legacyStartChartMaterializerRetired: true,
        includesAccuracyRefresh: false,
        canonicalSkaterReadPath:
          "/api/v1/start-chart -> forge_player_projections",
        legacyMaterializerRoute: null,
        notes: []
      },
      dependencyContract: getRollingForgeDependencyContract(),
      pipeline: getRollingForgePipelineSpec(),
      compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
      scanSummary: buildEndpointScanSummary({
        surface: "rolling_forge_pipeline_operator",
        requestedDate: "",
        activeDataDate: "",
        fallbackApplied: false,
        status: "blocked",
        rowCounts: {},
        blockingIssueCount: 1,
        notes: ["Method not allowed."]
      }),
      stages: []
    });
  }

  const mode = parseMode(getParam(req, "mode"));
  const { startDate, endDate, date } = parseDateWindow(req);
  const includeDownstream = parseBooleanParam(
    getParam(req, "includeDownstream"),
    true
  );
  const includeAccuracy = parseBooleanParam(
    getParam(req, "includeAccuracy"),
    mode === "overnight"
  );
  const stopOnFailure = parseBooleanParam(getParam(req, "stopOnFailure"), true);

  const stageResults: StageResult[] = [];
  let blocked = false;

  for (const stage of getRollingForgeStagesForMode(mode)) {
    if (blocked) {
      stageResults.push({
        id: stage.id,
        label: stage.label,
        status: "skipped",
        blocking: stage.blocking,
        durationMs: 0,
        reason: "Skipped because an earlier blocking stage failed.",
        steps: []
      });
      continue;
    }

    const result = await runStage({
      id: stage.id,
      mode,
      startDate,
      endDate,
      date,
      includeDownstream,
      includeAccuracy
    });
    stageResults.push(result);

    if (stopOnFailure && stage.blocking && result.status === "failed") {
      blocked = true;
    }
  }

  const success = !stageResults.some(
    (stage) => stage.blocking && stage.status === "failed"
  );

  const downstreamNotes = [
    "Stage 8 is now an accuracy-only downstream validation stage, not a canonical skater projection writer.",
    "The Start Chart read layer resolves skaters from forge_player_projections.",
    "update-start-chart-projections has been retired; no live player_projections materializer remains in the rolling-to-FORGE pipeline."
  ];
  if (!includeDownstream) {
    downstreamNotes.push(
      "Downstream accuracy refresh was skipped by request."
    );
  } else if (!includeAccuracy) {
    downstreamNotes.push("Accuracy refresh was skipped by request.");
  }

  const durationMs = Date.now() - startedAt;
  const scanSummary = buildPipelineScanSummary({
    requestedDate: date,
    activeDataDate: endDate,
    success,
    stageResults
  });
  return res.status(success ? 200 : 207).json({
    success,
    mode,
    dateWindow: {
      startDate,
      endDate,
      date
    },
    durationMs: formatDurationMsToMMSS(durationMs),
    runtimeBudget: buildRuntimeBudgetSummary(mode, durationMs),
    executionControls: {
      includeDownstream,
      includeAccuracy,
      stopOnFailure
    },
    downstreamSummary: {
      stageId: "downstream_projection_consumers",
      includesLegacyStartChartMaterialization: false,
      legacyStartChartMaterializerRetired: true,
      includesAccuracyRefresh: includeDownstream && includeAccuracy,
      canonicalSkaterReadPath:
        "/api/v1/start-chart -> forge_player_projections",
      legacyMaterializerRoute: null,
      notes: downstreamNotes
    },
    dependencyContract: getRollingForgeDependencyContract(),
    pipeline: getRollingForgePipelineSpec(),
    compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
    scanSummary,
    stages: stageResults
  });
}

export default withCronJobAudit(handler, {
  jobName: "run-rolling-forge-pipeline"
});

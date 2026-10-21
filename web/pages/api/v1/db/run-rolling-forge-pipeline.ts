import { parseQueryBoolean } from "lib/api/queryParams";
import {
  buildEndpointScanSummary,
  type EndpointScanSummary
} from "lib/api/scanSummary";
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import adminOnly from "utils/adminOnlyMiddleware";
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
import {
  acquireRollingForgeStage,
  advanceRollingForgeStage,
  buildRollingForgeRunScopeKey,
  finishRollingForgeStage,
  readRollingForgeRunState,
  readRollingForgeStageFailedAttempts
} from "lib/rollingForgePipelineRunState";

import updateGamesHandler from "./update-games";
import updateTeamsHandler from "./update-teams";
import updatePlayersHandler from "./update-players";
import updateNstGamelogHandler from "./update-nst-gamelog";
import updateWgoSkatersHandler from "./update-wgo-skaters";
import updateWgoTotalsHandler from "./update-wgo-totals";
import updateLineCombinationsHandler from "./update-line-combinations";
import updatePowerPlayCombinationsBatchHandler from "./update-power-play-combinations";
import updateRollingPlayerAveragesHandler from "./update-rolling-player-averages";
import ingestProjectionInputsHandler from "./ingest-projection-inputs";
import shiftChartsHandler from "./shift-charts";
import buildProjectionDerivedHandler from "./build-projection-derived-v2";
import updateGoalieProjectionsV2Handler from "./update-goalie-projections-v2";
import runProjectionV2Handler from "./run-projection-v2";
import runProjectionAccuracyHandler from "./run-projection-accuracy";

type StepStatus = "success" | "failed" | "skipped" | "partial";
// "pending" stages wait for the next invocation of a resumable run.
type StageStatus = StepStatus | "pending";

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
  completedEarlier?: boolean;
  steps: StepResult[];
};

type TerminationReceipt = {
  state:
    | "not_started"
    | "completed"
    | "stopped_on_blocking_failure"
    | "continuation_required";
  resumeRequired: boolean;
  nextStartDate: string | null;
  // Set for the scheduled (resumable) run and for a partial one-shot stage.
  runKey?: string;
  stagesRun?: number;
  nextStageId?: RollingForgePipelineStageId | null;
  reason?:
    | "runtime_budget"
    | "stage_partial"
    | "stage_in_progress_elsewhere"
    | "state_error"
    | "retry_on_next_invocation"
    | "attempts_exhausted";
  rollingResumeFrom?: number | null;
  detail?: string;
};

type ResponseBody = {
  success: boolean;
  mode: RollingForgePipelineMode;
  dateWindow: {
    startDate: string;
    endDate: string;
    date: string;
    rollingStartDate: string;
    rollingEndDate: string;
    sourceStartDate: string;
    sourceEndDate: string;
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
  termination: TerminationReceipt;
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
  failureSummary?: {
    failedStepCount: number;
    firstFailure: { stageId: string; stepId: string; route: string; statusCode: number;
      error: string | null; gameId: number | null; stage: string | null; reportedErrorCount: number;
      code: string | null; endpoint: string | null; attempts: number | null; classification: string | null } | null;
  };
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

function todayEtDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDays(date: string, delta: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return isoDateOnly(value);
}

function parseDateWindow(req: NextApiRequest, implicitWindow: boolean) {
  const date = getParam(req, "date") ?? todayEtDateOnly();
  const startDate = getParam(req, "startDate") ?? date;
  const endDate = getParam(req, "endDate") ?? date;
  // The scheduled run fires before today's games, so its rolling step and the
  // source steps that read played games (NST and WGO skater ingestion,
  // power-play combinations) use the last completed day. Incremental NST from
  // today would not include yesterday. Explicit windows stay as requested.
  const completedDate = addDays(date, -1);
  return {
    date,
    startDate,
    endDate,
    rollingStartDate: implicitWindow ? completedDate : startDate,
    rollingEndDate: implicitWindow ? completedDate : endDate,
    sourceStartDate: implicitWindow ? completedDate : startDate,
    sourceEndDate: implicitWindow ? completedDate : endDate
  };
}

// The scheduled (implicit-window) run is resumable. Vercel kills the function
// at 240 s (vercel.json maxDuration), so each invocation stops taking work
// well before that, stores its progress, and the next invocation continues.
const RESUMABLE_INVOCATION_BUDGET_MS = 180_000;
// A stage of unknown length starts after the first one only while it still
// has about 150 s before the kill.
const RESUMABLE_STAGE_START_CUTOFF_MS = 90_000;
// The rolling step bounds itself; start it only with this much claim time left.
const MIN_ROLLING_CLAIM_MS = 30_000;
// run-projection-v2 stops at its own deadline and resumes its run on the next
// call; give it at least this long.
const MIN_PROJECTION_RUNTIME_MS = 30_000;
// Outlives the 240 s kill, so a dead invocation's stage frees up before the
// next 5-minute call.
const RESUMABLE_STAGE_LEASE_MS = 270_000;
// A failing blocking stage is retried once, on the next invocation.
const MAX_BLOCKING_STAGE_ATTEMPTS = 2;

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

// A budget stop from the rolling or projection route (207, operationStatus
// "partial", resume.required) is unfinished work, not a failure. The stage
// stays running, uses no failed attempt, and the next invocation resumes it.
function isPartialResume(statusCode: number, body: unknown) {
  if (statusCode !== 207 || !body || typeof body !== "object") return false;
  const record = body as Record<string, any>;
  return (
    record.operationStatus === "partial" && record.resume?.required === true
  );
}

/**
 * NST step resume: the consumer side of the pipeline <-> update-nst-gamelog
 * contract (tasks/artifacts/cross-platform/2026-10-21-claude-to-codex-pipeline-
 * nst-contract.md with its ~01:00Z amendment, accepted by Codex in
 * 2026-10-20-codex-to-claude-pipeline-nst-contract.md). INACTIVE until Codex
 * ships it; enable only after review. With it enabled:
 * - 200 with success true finishes the step (operationStatus
 *   "skipped_no_completed_games" is the expected no-work skip); WGO follows.
 * - 207, operationStatus "continuation_required", resume.required true and
 *   resume.request.query: the stage pauses, and the next invocation re-calls
 *   NST with that query and a fresh deadlineAt. WGO waits.
 * - Anything else (>= 400, success false, a malformed continuation) fails the
 *   step and blocks the stage: nothing advances.
 * The query is stored in the stage's projection_pipeline_state row, which has
 * no JSON column: the replay query must be the query this pipeline sent plus
 * one `cursor`, a positive integer past the cursor sent, kept in the
 * forward-only cursor_game_id. Any other query is uncertain and fails the step.
 */
const nstStepResume = { enabled: false };
// Terminal audit headroom kept back from the NST step's deadline.
const NST_DEADLINE_HEADROOM_MS = 20_000;
// vercel.json maxDuration: an explicit run never gets longer than this.
const FUNCTION_MAX_DURATION_MS = 240_000;

type NstOutcome =
  | { kind: "finished"; skipped: boolean }
  | { kind: "continuation"; cursor: number }
  | { kind: "blocked"; reason: string };

function readNstOutcome(step: StepResult, sentCursor: number | null): NstOutcome {
  const body = step.summary as Record<string, any> | null;
  const record = body && typeof body === "object" ? body : null;
  if (step.statusCode === 200 && record?.success !== false && !record?.error) {
    return { kind: "finished", skipped: record?.operationStatus === "skipped_no_completed_games" };
  }
  if (step.statusCode !== 207 || record?.operationStatus !== "continuation_required") {
    return { kind: "blocked", reason: "NST did not finish or return a continuation; the stage stops here." };
  }
  const query = record.resume?.required === true ? record.resume.request?.query : null;
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return { kind: "blocked", reason: "NST continuation has no replayable resume.request.query." };
  }
  const { cursor: rawCursor, deadlineAt: _replayDeadline, ...scope } = query as Record<string, unknown>;
  const { cursor: _sentCursor, deadlineAt: _sentDeadline, ...sentScope } = step.query;
  const sameScope =
    Object.keys(scope).length === Object.keys(sentScope).length &&
    Object.entries(sentScope).every(([key, value]) => scope[key] === value);
  if (!sameScope) {
    return { kind: "blocked", reason: "NST continuation query does not replay the request this pipeline sent." };
  }
  const cursor = typeof rawCursor === "string" && /^[1-9]\d*$/.test(rawCursor) ? Number(rawCursor) : NaN;
  if (!Number.isSafeInteger(cursor) || cursor <= (sentCursor ?? 0)) {
    return { kind: "blocked", reason: "NST continuation cursor is not a positive integer past the cursor sent." };
  }
  return { kind: "continuation", cursor };
}

function classifyStepStatus(statusCode: number, body: unknown): StepStatus {
  if (isPartialResume(statusCode, body)) return "partial";
  if (statusCode >= 400) return "failed";
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (record.success === false) return "failed";
    if (typeof record.error === "string" && record.error.trim()) return "failed";
  }
  return "success";
}

function readRollingNextResumeFrom(stage: StageResult): number | null {
  if (stage.id === "upstream_skater_sources") {
    const nst = stage.steps.find((step) => step.id === "update-nst-gamelog");
    const outcome = nst?.status === "partial" ? readNstOutcome(nst, null) : null;
    return outcome?.kind === "continuation" ? outcome.cursor : null;
  }
  const summary = stage.steps.find(
    (step) => step.id === "update-rolling-player-averages"
  )?.summary as Record<string, any> | undefined;
  const value = summary?.resume?.nextResumeFrom;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

async function invokeRouteStep(args: {
  id: string;
  route: string;
  handler: RouteHandler;
  method?: "GET" | "POST";
  query?: Record<string, string>;
}): Promise<StepResult> {
  const startedAt = Date.now();
  const query = args.query ?? {};
  const req: any = {
    method: args.method ?? "GET",
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
    status: classifyStepStatus(res.statusCode, res.body),
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
  rollingStartDate: string;
  rollingEndDate: string;
  sourceStartDate: string;
  sourceEndDate: string;
  rollingResumeFrom?: number | null;
  nstResumeCursor?: number | null;
  sourceDeadlineAtMs?: number;
  rollingMaxRuntimeMs?: number;
  projectionDeadlineMs?: number;
  includeDownstream: boolean;
  includeAccuracy: boolean;
  useDurableProjectionBacklog: boolean;
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
    method?: "GET" | "POST";
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
    case "upstream_skater_sources": {
      const nstCursor = nstStepResume.enabled ? (args.nstResumeCursor ?? null) : null;
      const nst = await invokeRouteStep({
        id: "update-nst-gamelog",
        route: "/api/v1/db/update-nst-gamelog",
        handler: updateNstGamelogHandler,
        query: {
          runMode: "incremental",
          startDate: args.sourceStartDate,
          // The implicit run names its one completed date; explicit windows
          // pass through as before.
          ...(args.useDurableProjectionBacklog ? { endDate: args.sourceEndDate } : {}),
          ...(nstCursor != null ? { cursor: String(nstCursor) } : {}),
          ...(args.sourceDeadlineAtMs != null
            ? { deadlineAt: String(args.sourceDeadlineAtMs - NST_DEADLINE_HEADROOM_MS) }
            : {})
        }
      });
      steps.push(nst);
      if (nstStepResume.enabled) {
        const outcome = readNstOutcome(nst, nstCursor);
        if (outcome.kind === "continuation") {
          // WGO waits until NST finishes.
          nst.status = "partial";
          break;
        }
        if (outcome.kind === "blocked") {
          nst.status = "failed";
          nst.reason = outcome.reason;
          break;
        }
        if (outcome.skipped) {
          nst.status = "skipped";
          nst.reason = "NST reported no completed games for the date.";
        }
      }
      await addStep({
        id: "update-wgo-skaters",
        route: "/api/v1/db/update-wgo-skaters",
        handler: updateWgoSkatersHandler,
        query: {
          action: "all",
          startDate: args.sourceStartDate
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
      break;
    }
    case "contextual_builders": {
      await addStep({
        id: "update-line-combinations",
        route: "/api/v1/db/update-line-combinations",
        handler: updateLineCombinationsHandler,
        query: {
          count: args.mode === "overnight" ? "25" : "10"
        }
      });
      const gameIds = await listGameIdsInRange(args.sourceStartDate, args.sourceEndDate);
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
            startDate: args.sourceStartDate,
            endDate: args.sourceEndDate
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
          startDate: args.rollingStartDate,
          endDate: args.rollingEndDate,
          fastMode: "true",
          executionProfile:
            args.mode === "overnight"
              ? "overnight"
              : args.mode === "targeted_repair"
                ? "targeted_repair"
                : "daily_incremental",
          ...(args.rollingMaxRuntimeMs != null
            ? { maxRuntimeMs: String(args.rollingMaxRuntimeMs) }
            : {}),
          ...(args.rollingResumeFrom != null
            ? { resumeFrom: String(args.rollingResumeFrom) }
            : {})
        }
      });
      break;
    case "projection_input_ingest":
      await addStep({
        id: "ingest-projection-inputs",
        route: "/api/v1/db/ingest-projection-inputs",
        handler: ingestProjectionInputsHandler,
        method: "POST",
        query: args.useDurableProjectionBacklog
          ? undefined
          : {
              startDate: projectionInputStartDate,
              endDate: projectionInputEndDate,
              maxGames: args.mode === "overnight" ? "80" : "50"
            }
      });
      break;
    case "projection_relationship_build":
      await addStep({
        id: "build-projection-relationships",
        route: "/api/v1/db/shift-charts",
        handler: shiftChartsHandler,
        method: "POST",
        query: {
          gameId: "all"
        }
      });
      break;
    case "projection_derived_build":
      await addStep({
        id: "build-projection-derived-v2",
        route: "/api/v1/db/build-projection-derived-v2",
        handler: buildProjectionDerivedHandler,
        method: "POST",
        query: args.useDurableProjectionBacklog
          ? undefined
          : {
              startDate: derivedBuildStartDate,
              endDate: derivedBuildEndDate,
              maxDays: args.mode === "overnight" ? "30" : "14"
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
                date: args.date,
                // Measured after the goalie step, which runs first.
                ...(args.projectionDeadlineMs != null
                  ? {
                      maxDurationMs: String(
                        Math.max(
                          MIN_PROJECTION_RUNTIME_MS,
                          args.projectionDeadlineMs - Date.now()
                        )
                      )
                    }
                  : {})
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
    : steps.some((step) => step.status === "partial")
      ? "partial"
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

type StageSpec = ReturnType<typeof getRollingForgeStagesForMode>[number];
type StageArgs = Omit<Parameters<typeof runStage>[0], "id">;

function notRunStage(
  stage: StageSpec,
  status: StageStatus,
  reason: string,
  completedEarlier = false
): StageResult {
  return {
    id: stage.id,
    label: stage.label,
    status,
    blocking: stage.blocking,
    durationMs: 0,
    reason,
    ...(completedEarlier ? { completedEarlier: true } : {}),
    steps: []
  };
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 512);
}

/**
 * Runs the scheduled pipeline as a sequence of short invocations. Each
 * invocation skips stages an earlier one finished, runs the rest in order
 * until its runtime budget is spent, and stores progress in
 * projection_pipeline_state (see lib/rollingForgePipelineRunState).
 */
async function runResumablePipeline(args: {
  startedAt: number;
  stageArgs: StageArgs;
}): Promise<{ stageResults: StageResult[]; termination: TerminationReceipt }> {
  if (!supabase) {
    throw new Error("The resumable pipeline requires the Supabase server client.");
  }
  const { mode, date } = args.stageArgs;
  const runKey = buildRollingForgeRunScopeKey(mode, date);
  const states = await readRollingForgeRunState({ supabase, scopeKey: runKey });
  const stageResults: StageResult[] = [];
  let termination: TerminationReceipt | null = null;
  let stagesRun = 0;
  const continuation = (
    reason: NonNullable<TerminationReceipt["reason"]>,
    nextStageId: RollingForgePipelineStageId,
    rollingResumeFrom: number | null,
    detail?: string
  ): TerminationReceipt => ({
    state: "continuation_required",
    resumeRequired: true,
    nextStartDate: null,
    runKey,
    nextStageId,
    reason,
    rollingResumeFrom,
    ...(detail ? { detail } : {})
  });

  for (const stage of getRollingForgeStagesForMode(mode)) {
    if (termination) {
      stageResults.push(
        termination.state === "stopped_on_blocking_failure"
          ? notRunStage(stage, "skipped", "Skipped because an earlier blocking stage failed.")
          : notRunStage(stage, "pending", "Waiting for the next invocation of this run.")
      );
      continue;
    }

    const state = states.get(stage.id);
    if (state?.status === "complete") {
      stageResults.push(
        notRunStage(stage, "success", "Completed by an earlier invocation of this run.", true)
      );
      continue;
    }
    const failedAttempts = readRollingForgeStageFailedAttempts(state);
    if (
      state?.status === "failed" &&
      (!stage.blocking || failedAttempts >= MAX_BLOCKING_STAGE_ATTEMPTS)
    ) {
      stageResults.push(
        notRunStage(
          stage,
          "failed",
          `Failed ${failedAttempts} time(s) in earlier invocations of this run; not retried.`,
          true
        )
      );
      if (stage.blocking) {
        termination = {
          state: "stopped_on_blocking_failure",
          resumeRequired: false,
          nextStartDate: null,
          runKey,
          nextStageId: stage.id,
          reason: "attempts_exhausted"
        };
      }
      continue;
    }

    const isRolling = stage.id === "rolling_player_recompute";
    const elapsedMs = Date.now() - args.startedAt;
    if (
      stagesRun > 0 &&
      (isRolling
        ? RESUMABLE_INVOCATION_BUDGET_MS - elapsedMs < MIN_ROLLING_CLAIM_MS
        : elapsedMs >= RESUMABLE_STAGE_START_CUTOFF_MS)
    ) {
      termination = continuation(
        "runtime_budget",
        stage.id,
        state?.cursorGameId ?? null
      );
      stageResults.push(
        notRunStage(stage, "pending", "Deferred to the next invocation by the runtime budget.")
      );
      continue;
    }

    let lease;
    try {
      lease = await acquireRollingForgeStage({
        supabase,
        scopeKey: runKey,
        stageId: stage.id,
        runDate: date,
        leaseExpiresAtMs: args.startedAt + RESUMABLE_STAGE_LEASE_MS
      });
    } catch (error) {
      const message = errorMessage(error);
      termination = continuation(
        /LEASE_HELD|REVISION_MISMATCH|CONCURRENT_CHANGE/.test(message)
          ? "stage_in_progress_elsewhere"
          : "state_error",
        stage.id,
        state?.cursorGameId ?? null,
        message
      );
      stageResults.push(
        notRunStage(stage, "pending", "Could not take this stage; see termination.detail.")
      );
      continue;
    }
    if (lease.status === "complete") {
      // Another invocation finished it between the read and the lease.
      stageResults.push(
        notRunStage(stage, "success", "Completed by an earlier invocation of this run.", true)
      );
      continue;
    }

    stagesRun += 1;
    const result = await runStage({
      ...args.stageArgs,
      id: stage.id,
      ...(stage.id === "upstream_skater_sources"
        ? {
            nstResumeCursor: lease.cursorGameId,
            sourceDeadlineAtMs: args.startedAt + RESUMABLE_INVOCATION_BUDGET_MS
          }
        : {}),
      ...(isRolling
        ? {
            rollingResumeFrom: lease.cursorGameId,
            rollingMaxRuntimeMs: Math.max(
              MIN_ROLLING_CLAIM_MS,
              RESUMABLE_INVOCATION_BUDGET_MS - (Date.now() - args.startedAt)
            )
          }
        : {}),
      ...(stage.id === "projection_execution"
        ? {
            projectionDeadlineMs:
              args.startedAt + RESUMABLE_INVOCATION_BUDGET_MS
          }
        : {})
    });
    stageResults.push(result);

    try {
      if (result.status === "partial") {
        const nextResumeFrom = readRollingNextResumeFrom(result);
        const advanced = await advanceRollingForgeStage({
          supabase,
          lease,
          cursorGameId: nextResumeFrom
        });
        termination = continuation(
          "stage_partial",
          stage.id,
          advanced.cursorGameId
        );
      } else if (result.status === "failed") {
        const attempt = failedAttempts + 1;
        await finishRollingForgeStage({
          supabase,
          lease,
          outcome: "failed",
          attempt
        });
        if (stage.blocking) {
          const willRetry = attempt < MAX_BLOCKING_STAGE_ATTEMPTS;
          termination = {
            state: "stopped_on_blocking_failure",
            resumeRequired: willRetry,
            nextStartDate: null,
            runKey,
            nextStageId: stage.id,
            reason: willRetry ? "retry_on_next_invocation" : "attempts_exhausted"
          };
        }
      } else {
        await finishRollingForgeStage({ supabase, lease, outcome: "complete" });
      }
    } catch (error) {
      // The stage itself ran; only its receipt was not stored. The next
      // invocation repeats it, which every stage tolerates.
      const message = errorMessage(error);
      termination = termination
        ? { ...termination, detail: `State write failed: ${message}` }
        : continuation("state_error", stage.id, lease.cursorGameId, message);
    }
  }

  return {
    stageResults,
    termination: {
      ...(termination ?? {
        state: "completed",
        resumeRequired: false,
        nextStartDate: null,
        runKey,
        nextStageId: null
      }),
      stagesRun
    }
  };
}

export const __testables = {
  listGameIdsInRange,
  invokeRouteStep,
  runStage,
  nstStepResume
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
        date: "",
        rollingStartDate: "",
        rollingEndDate: "",
        sourceStartDate: "",
        sourceEndDate: ""
      },
      durationMs: formatDurationMsToMMSS(0),
      runtimeBudget: buildRuntimeBudgetSummary("daily_incremental", 0),
      executionControls: {
        includeDownstream: false,
        includeAccuracy: false,
        stopOnFailure: true
      },
      termination: {
        state: "not_started",
        resumeRequired: false,
        nextStartDate: null
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
  const useDurableProjectionBacklog =
    getParam(req, "date") == null &&
    getParam(req, "startDate") == null &&
    getParam(req, "endDate") == null;
  const {
    startDate,
    endDate,
    date,
    rollingStartDate,
    rollingEndDate,
    sourceStartDate,
    sourceEndDate
  } = parseDateWindow(req, useDurableProjectionBacklog);
  const includeDownstream = parseBooleanParam(
    getParam(req, "includeDownstream"),
    true
  );
  const includeAccuracy = parseBooleanParam(
    getParam(req, "includeAccuracy"),
    mode === "overnight"
  );
  const requestedStopOnFailure = parseBooleanParam(
    getParam(req, "stopOnFailure"),
    true
  );
  const stopOnFailure = useDurableProjectionBacklog
    ? true
    : requestedStopOnFailure;

  const stageArgs: StageArgs = {
    mode,
    startDate,
    endDate,
    date,
    rollingStartDate,
    rollingEndDate,
    sourceStartDate,
    sourceEndDate,
    includeDownstream,
    includeAccuracy,
    useDurableProjectionBacklog
  };
  let stageResults: StageResult[] = [];
  let termination: TerminationReceipt;

  if (useDurableProjectionBacklog) {
    ({ stageResults, termination } = await runResumablePipeline({
      startedAt,
      stageArgs
    }));
  } else {
    let blocked = false;
    for (const stage of getRollingForgeStagesForMode(mode)) {
      if (blocked) {
        stageResults.push(
          notRunStage(
            stage,
            "skipped",
            "Skipped because an earlier blocking stage failed or stopped partway."
          )
        );
        continue;
      }

      const result = await runStage({
        ...stageArgs,
        id: stage.id,
        sourceDeadlineAtMs:
          startedAt +
          Math.min(ROLLING_FORGE_PIPELINE_BUDGETS_MS[mode], FUNCTION_MAX_DURATION_MS)
      });
      stageResults.push(result);

      if (
        stopOnFailure &&
        stage.blocking &&
        (result.status === "failed" || result.status === "partial")
      ) {
        blocked = true;
      }
    }

    const failedBlocking = stageResults.some(
      (stage) => stage.blocking && stage.status === "failed"
    );
    const partialBlocking = stageResults.find(
      (stage) => stage.blocking && stage.status === "partial"
    );
    termination = failedBlocking
      ? {
          state: "stopped_on_blocking_failure",
          resumeRequired: true,
          nextStartDate: null
        }
      : partialBlocking
        ? {
            state: "continuation_required",
            resumeRequired: true,
            nextStartDate: null,
            nextStageId: partialBlocking.id,
            reason: "stage_partial",
            rollingResumeFrom: readRollingNextResumeFrom(partialBlocking)
          }
        : { state: "completed", resumeRequired: false, nextStartDate: null };
  }

  const success = termination.state === "completed";

  const downstreamNotes = [
    "Stage 9 is an accuracy-only downstream validation stage, not a canonical skater projection writer.",
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
  const failedSteps = stageResults.flatMap(stage => stage.steps
    .filter(step => step.status === "failed").map(step => ({ stageId: stage.id, step })));
  const firstFailed = failedSteps[0];
  const summary = firstFailed?.step.summary && typeof firstFailed.step.summary === "object"
    ? firstFailed.step.summary as Record<string, unknown> : {};
  const errors = Array.isArray(summary.errors) ? summary.errors : [];
  const firstError = errors[0] && typeof errors[0] === "object" ? errors[0] as Record<string, unknown> : {};
  const dependencyError = summary.dependencyError && typeof summary.dependencyError === "object"
    ? summary.dependencyError as Record<string, unknown> : {};
  const message = [firstError.message, summary.error, summary.message, firstFailed?.step.reason]
    .find(value => typeof value === "string" && value.length > 0);
  // Put bounded, observed failure facts before verbose graphs for the existing
  // 4000 character cron audit. Full child receipts remain unchanged in stages below.
  const failureSummary = {
    failedStepCount: failedSteps.length,
    firstFailure: firstFailed ? { stageId: firstFailed.stageId, stepId: firstFailed.step.id,
      route: firstFailed.step.route, statusCode: firstFailed.step.statusCode,
      error: typeof message === "string" ? message.slice(0, 512) : null,
      gameId: typeof firstError.gameId === "number" ? firstError.gameId : null,
      stage: typeof firstError.stage === "string" ? firstError.stage.slice(0, 128) : null,
      code: typeof firstError.code === "string" ? firstError.code.slice(0, 128) : null,
      endpoint: typeof firstError.endpoint === "string" ? firstError.endpoint.slice(0, 128) : null,
      attempts: Number.isSafeInteger(firstError.attempts) && Number(firstError.attempts) > 0 ? Number(firstError.attempts) : null,
      classification: typeof dependencyError.classification === "string" ? dependencyError.classification.slice(0, 128) : null,
      reportedErrorCount: errors.length } : null,
  };
  return res.status(success ? 200 : 207).json({
    success,
    failureSummary,
    mode,
    dateWindow: {
      startDate,
      endDate,
      date,
      rollingStartDate,
      rollingEndDate,
      sourceStartDate,
      sourceEndDate
    },
    durationMs: formatDurationMsToMMSS(durationMs),
    runtimeBudget: buildRuntimeBudgetSummary(mode, durationMs),
    executionControls: {
      includeDownstream,
      includeAccuracy,
      stopOnFailure
    },
    termination,
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

export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(handler as any)), {
  jobName: "run-rolling-forge-pipeline",
  includeFinalAuditReceipt: true
});

import fs from "fs/promises";
import path from "path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { loadCronInventory, type CronInventoryJob } from "lib/cron/cronInventory";
import {
  runBenchmarkInventory,
  type BenchmarkExecutor,
  type BenchmarkRunResult,
  type BenchmarkRunSequence
} from "lib/cron/benchmarkRunner";
import { getNstTouchLevel } from "lib/cron/nstClassification";

type HttpBenchmarkSummary = {
  kind: "http";
  statusCode: number;
  ok: boolean;
  body: unknown;
};

type SqlBenchmarkSummary = {
  kind: "sql";
  dataPreview: unknown;
};

type PolicyBenchmarkSummary = {
  kind: "policy";
  action: "skip" | "observe_only" | "mock_fallback";
};

type BenchmarkSummary =
  | HttpBenchmarkSummary
  | SqlBenchmarkSummary
  | PolicyBenchmarkSummary;

const WEB_DIR = process.cwd();
const ROOT_DIR = path.resolve(WEB_DIR, "..");
const ARTIFACT_DIR = path.resolve(ROOT_DIR, "tasks", "artifacts");
const NST_MIN_GAP_MS = 15 * 60 * 1000;

dotenv.config({ path: path.resolve(WEB_DIR, ".env.local") });
dotenv.config({ path: path.resolve(ROOT_DIR, ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const baseUrl = (process.env.CRON_AUDIT_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

if (!cronSecret) {
  throw new Error("Missing CRON_SECRET. Local cron route execution requires bearer auth.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

function truncateText(value: string, maxLen = 500): string {
  return value.length <= maxLen ? value : `${value.slice(0, maxLen - 1)}…`;
}

function parseJsonMaybe(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return truncateText(trimmed, 1_000);
  }
}

function extractMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return truncateText(value.trim(), 240);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  for (const key of ["message", "error", "reason", "detail", "statusText"]) {
    const nested = candidate[key];
    if (typeof nested === "string" && nested.trim()) {
      return truncateText(nested.trim(), 240);
    }
  }

  return null;
}

function summarizeHttpBody(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    return body;
  }

  if (Array.isArray(body)) {
    return {
      type: "array",
      length: body.length
    };
  }

  const candidate = body as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const key of [
    "success",
    "message",
    "error",
    "reason",
    "status",
    "timer",
    "durationMs",
    "timing",
    "rowsAffected",
    "rowsUpserted",
    "count",
    "processed",
    "processedCount",
    "updatedCount",
    "insertedCount",
    "failedRows",
    "warnings"
  ]) {
    if (key in candidate) {
      summary[key] = candidate[key];
    }
  }

  return Object.keys(summary).length > 0 ? summary : candidate;
}

function formatStatusLine(args: {
  index: number;
  total: number;
  job: CronInventoryJob;
}): string {
  return `[${String(args.index).padStart(2, "0")}/${String(args.total).padStart(
    2,
    "0"
  )}] ${args.job.scheduleTimeDisplay} ${args.job.name}`;
}

function formatObservationNotes(notes: string[]): string {
  return notes.length > 0 ? notes.join(" | ") : "—";
}

function toArtifactStamp(iso: string): string {
  return iso.replace(/[:]/g, "-").replace(/\.\d{3}Z$/, "Z");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDirectNstGap(args: {
  job: CronInventoryJob;
  lastDirectNstFinishedAt: number | null;
}): Promise<string[]> {
  if (getNstTouchLevel(args.job.name) !== "direct_remote_nst_fetch") {
    return [];
  }

  if (args.lastDirectNstFinishedAt == null) {
    return ["Direct NST job started with no prior NST wait requirement."];
  }

  const elapsedMs = Date.now() - args.lastDirectNstFinishedAt;
  if (elapsedMs >= NST_MIN_GAP_MS) {
    return [
      `Direct NST gap already satisfied (${Math.floor(elapsedMs / 60000)}m elapsed).`
    ];
  }

  const waitMs = NST_MIN_GAP_MS - elapsedMs;
  console.log(
    `Waiting ${Math.ceil(waitMs / 1000)}s before ${args.job.name} to preserve the 15-minute NST gap.`
  );
  await sleep(waitMs);
  return [
    `Inserted ${Math.ceil(waitMs / 1000)}s NST safety wait before execution.`
  ];
}

function buildExecutor(): BenchmarkExecutor<BenchmarkSummary> & {
  onDirectNstCompleted(job: CronInventoryJob): void;
} {
  let lastDirectNstFinishedAt: number | null = null;

  return {
    async executeHttpJob(job) {
      const nstWaitNotes = await waitForDirectNstGap({
        job,
        lastDirectNstFinishedAt
      });
      const route = job.route ?? job.routePath;

      if (!route) {
        return {
          status: "failure",
          reason: "Benchmark HTTP job is missing a route path.",
          notes: nstWaitNotes
        };
      }

      const url = `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
      const response = await fetch(url, {
        method: job.method === "POST" ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`
        }
      });
      const rawBody = await response.text();
      const parsedBody = parseJsonMaybe(rawBody);
      const summaryBody = summarizeHttpBody(parsedBody);
      const message = extractMessage(parsedBody);

      return {
        status: response.ok ? "success" : "failure",
        reason: response.ok ? undefined : message ?? `HTTP ${response.status} from ${route}`,
        notes: [
          ...nstWaitNotes,
          `HTTP ${response.status} ${response.statusText}`.trim()
        ],
        summary: {
          kind: "http",
          statusCode: response.status,
          ok: response.ok,
          body: summaryBody
        },
        touchedSystems: ["supabase"]
      };
    },
    async executeSqlJob(job) {
      if (!job.sqlText) {
        return {
          status: "failure",
          reason: "SQL-only benchmark job is missing sqlText."
        };
      }

      const { data, error } = await supabase.rpc("execute_sql", {
        sql_statement: job.sqlText
      });

      if (error) {
        return {
          status: "failure",
          reason: error.message,
          notes: ["Supabase execute_sql RPC failed."]
        };
      }

      return {
        status: "success",
        notes: ["Executed through Supabase execute_sql RPC."],
        summary: {
          kind: "sql",
          dataPreview: data
        },
        touchedSystems: ["supabase", "local_database_functions"]
      };
    },
    async executePolicyJob(_job, action) {
      const policyAction =
        action === "observe_only" || action === "mock_fallback" ? action : "skip";

      return {
        status: "skipped",
        reason:
          policyAction === "observe_only"
            ? "Skipped unsafe local/dev side-effect route and recorded observation only."
            : policyAction === "mock_fallback"
              ? "Skipped direct side effect and recorded mock-fallback observation only."
              : "Skipped by benchmark execution policy.",
        notes: [`Policy action: ${policyAction}`],
        summary: {
          kind: "policy",
          action: policyAction
        }
      };
    },
    onDirectNstCompleted(job) {
      if (getNstTouchLevel(job.name) === "direct_remote_nst_fetch") {
        lastDirectNstFinishedAt = Date.now();
      }
    }
  };
}

function buildMarkdownReport(result: BenchmarkRunSequence<BenchmarkSummary>): string {
  const lines: string[] = [];

  lines.push("# Cron Audit Benchmark Run");
  lines.push("");
  lines.push(`- Started: ${result.startedAt}`);
  lines.push(`- Ended: ${result.endedAt}`);
  lines.push(`- Duration: ${result.timer} (${result.durationMs} ms)`);
  lines.push(`- Total jobs: ${result.report.counts.totalJobs}`);
  lines.push(`- Succeeded: ${result.report.counts.succeeded}`);
  lines.push(`- Failed: ${result.report.counts.failed}`);
  lines.push(`- Skipped: ${result.report.counts.skipped}`);
  lines.push(`- Slow jobs: ${result.report.counts.slowJobs}`);
  lines.push("");
  lines.push("| # | Time | Job | Status | Action | Timer | Method | Notes |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

  result.report.observations.forEach((observation, index) => {
    lines.push(
      `| ${index + 1} | ${result.observations[index]?.scheduleTimeDisplay ?? "—"} | ${
        observation.jobName
      } | ${observation.benchmarkStatus} | ${observation.executionAction} | ${
        observation.timing.timer
      } | ${observation.method ?? "—"} | ${formatObservationNotes(observation.notes)} |`
    );
  });

  lines.push("");
  lines.push("## Detailed Notes");
  lines.push("");

  result.report.observations.forEach((observation, index) => {
    lines.push(`### ${index + 1}. ${observation.jobName}`);
    lines.push(`- Schedule slot: ${result.observations[index]?.scheduleTimeDisplay ?? "—"}`);
    lines.push(`- Status: ${observation.benchmarkStatus}`);
    lines.push(`- Action: ${observation.executionAction}`);
    lines.push(`- Timer: ${observation.timing.timer} (${observation.durationMs} ms)`);
    lines.push(`- Method: ${observation.method ?? "—"}`);
    lines.push(`- Route: ${observation.route ?? "—"}`);
    lines.push(`- Local policy: ${observation.localRunPolicy}`);
    lines.push(`- Reason: ${observation.reason ?? "—"}`);
    lines.push(`- Notes: ${formatObservationNotes(observation.notes)}`);
    const summaryText =
      observation.summary == null ? "null" : JSON.stringify(observation.summary);
    lines.push(`- Summary: ${truncateText(summaryText, 400)}`);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

async function main() {
  const jobs = await loadCronInventory();
  const executor = buildExecutor();

  console.log(`Loaded ${jobs.length} scheduled jobs from cron-schedule.md`);

  const result = await runBenchmarkInventory(jobs, {
    executeHttpJob: async (job) => {
      const index = jobs.findIndex((candidate) => candidate.key === job.key) + 1;
      console.log(formatStatusLine({ index, total: jobs.length, job }));
      try {
        const runResult = await executor.executeHttpJob!(job);
        executor.onDirectNstCompleted(job);
        return runResult;
      } catch (error) {
        executor.onDirectNstCompleted(job);
        return {
          status: "failure",
          reason: error instanceof Error ? error.message : String(error)
        } satisfies BenchmarkRunResult<BenchmarkSummary>;
      }
    },
    executeSqlJob: async (job) => {
      const index = jobs.findIndex((candidate) => candidate.key === job.key) + 1;
      console.log(formatStatusLine({ index, total: jobs.length, job }));
      return executor.executeSqlJob!(job);
    },
    executePolicyJob: async (job, action) => {
      const index = jobs.findIndex((candidate) => candidate.key === job.key) + 1;
      console.log(`${formatStatusLine({ index, total: jobs.length, job })} [policy:${action}]`);
      return executor.executePolicyJob!(job, action);
    }
  });

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const stamp = toArtifactStamp(result.startedAt);
  const jsonPath = path.resolve(ARTIFACT_DIR, `cron-benchmark-run-${stamp}.json`);
  const markdownPath = path.resolve(ARTIFACT_DIR, `cron-benchmark-run-${stamp}.md`);
  const latestJsonPath = path.resolve(ARTIFACT_DIR, "cron-benchmark-run-latest.json");
  const latestMarkdownPath = path.resolve(ARTIFACT_DIR, "cron-benchmark-run-latest.md");

  await fs.writeFile(jsonPath, `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, buildMarkdownReport(result), "utf8");
  await fs.writeFile(latestJsonPath, `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  await fs.writeFile(latestMarkdownPath, buildMarkdownReport(result), "utf8");

  console.log(`Benchmark report written to ${jsonPath}`);
  console.log(`Benchmark notes written to ${markdownPath}`);
  console.log(
    `Completed benchmark run: ${result.report.counts.succeeded} succeeded, ${result.report.counts.failed} failed, ${result.report.counts.skipped} skipped.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

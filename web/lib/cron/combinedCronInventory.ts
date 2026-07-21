import fs from "fs/promises";
import path from "path";

import {
  CRON_SCHEDULE_RELATIVE_PATH,
  type CronInventoryMethod,
  parseCronInventoryFromMarkdown,
  readCronScheduleMarkdown,
} from "./cronInventory";
import {
  ROLLING_FORGE_PIPELINE_ORDER,
  type RollingForgePipelineStageId,
} from "../rollingForgePipeline";
import {
  isRollingExecutionProfile,
  PROJECTION_ROUTE_DEFAULT_BUDGET_MS,
  ROLLING_FORGE_PIPELINE_BUDGETS_MS,
} from "../rollingPlayerOperationalPolicy";

export type CombinedCronProvider = "pg_cron" | "vercel";

export type CombinedCronDomain =
  | RollingForgePipelineStageId
  | "sustainability_priors"
  | "sustainability_window_z"
  | "sustainability_score"
  | "sustainability_trend_bands"
  | "unclassified";

export type CombinedCronJob = {
  key: string;
  provider: CombinedCronProvider;
  sourcePath: string;
  active: boolean;
  name: string;
  method: CronInventoryMethod;
  cronExpression: string;
  normalizedCronExpression: string;
  utcHour: number | null;
  utcMinute: number | null;
  route: string | null;
  routePath: string | null;
  domains: CombinedCronDomain[];
};

export type CombinedCronInventory = {
  jobs: CombinedCronJob[];
  vercelMaxDurationMs: number;
};

export type CrossProviderCronCollision = {
  normalizedCronExpressions: string[];
  domain: CombinedCronDomain;
  jobs: Array<
    Pick<
      CombinedCronJob,
      "key" | "provider" | "sourcePath" | "name" | "method" | "routePath"
    >
  >;
};

export type ScheduledRuntimeBudgetFinding = {
  routePath: string;
  budgetSourcePath: string;
  budgetMs: number;
  platformLimitSourcePath: string;
  platformLimitMs: number;
  hasAuditFlushHeadroom: boolean;
  scheduledJobs: Array<
    Pick<CombinedCronJob, "key" | "provider" | "sourcePath" | "name">
  >;
};

export const VERCEL_CONFIG_RELATIVE_PATH = "web/vercel.json";
export const VERCEL_FUNCTION_DURATION_SOURCE_PATH = "web/vercel.json";
export const PROJECTION_ROUTE_RUNTIME_SOURCE_PATH =
  "web/pages/api/v1/db/run-projection-v2.ts";

const VERCEL_PAGES_FUNCTION_GLOB = "pages/api/**/*.ts";
const ROLLING_COORDINATOR_ROUTE = "/api/v1/db/run-rolling-forge-pipeline";
const PROJECTION_ROUTE = "/api/v1/db/run-projection-v2";

const PIPELINE_COMPATIBILITY_DOMAINS: Record<
  string,
  RollingForgePipelineStageId
> = {
  "/api/v1/db/update-shifts": "projection_relationship_build",
  "/api/v1/db/update-PbP": "projection_input_ingest",
};

const SUSTAINABILITY_DOMAINS: Array<{
  routePath: string;
  domain: CombinedCronDomain;
}> = [
  {
    routePath: "/api/v1/sustainability/rebuild-priors",
    domain: "sustainability_priors",
  },
  {
    routePath: "/api/v1/sustainability/rebuild-window-z",
    domain: "sustainability_window_z",
  },
  {
    routePath: "/api/v1/sustainability/rebuild-score",
    domain: "sustainability_score",
  },
  {
    routePath: "/api/v1/sustainability/rebuild-trend-bands",
    domain: "sustainability_trend_bands",
  },
];

const NATURAL_RUNTIME_CONTRACTS: Array<{
  routePath: string;
  budgetSourcePath: string;
  defaultBudgetMs: number;
}> = [
  {
    routePath: ROLLING_COORDINATOR_ROUTE,
    budgetSourcePath: "web/lib/rollingPlayerOperationalPolicy.ts",
    defaultBudgetMs: ROLLING_FORGE_PIPELINE_BUDGETS_MS.daily_incremental,
  },
  {
    routePath: PROJECTION_ROUTE,
    budgetSourcePath: PROJECTION_ROUTE_RUNTIME_SOURCE_PATH,
    defaultBudgetMs: PROJECTION_ROUTE_DEFAULT_BUDGET_MS,
  },
];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function getVercelConfigCandidates(
  cwd: string = process.cwd(),
): string[] {
  return unique([
    path.resolve(cwd, VERCEL_CONFIG_RELATIVE_PATH),
    path.resolve(cwd, "vercel.json"),
    path.resolve(cwd, "..", VERCEL_CONFIG_RELATIVE_PATH),
  ]);
}

type ParsedCronField = {
  normalized: string;
  values: Set<number>;
  wildcard: boolean;
  fixedValue: number | null;
};

type ParsedCronSchedule = {
  normalized: string;
  minute: ParsedCronField;
  hour: ParsedCronField;
  dayOfMonth: ParsedCronField;
  month: ParsedCronField;
  dayOfWeek: ParsedCronField;
};

const CRON_FIELD_RANGES = [
  { minimum: 0, maximum: 59 },
  { minimum: 0, maximum: 23 },
  { minimum: 1, maximum: 31 },
  { minimum: 1, maximum: 12 },
  { minimum: 0, maximum: 7 },
] as const;

function parseCronInteger(
  rawValue: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(rawValue)) {
    throw new Error("Cron fields support only numeric values and wildcards");
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("Cron field value is outside the supported range");
  }
  return value;
}

function inclusiveRange(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }
  return values;
}

function parseCronField(
  field: string,
  minimum: number,
  maximum: number,
): ParsedCronField {
  if (!field || /\s/.test(field)) {
    throw new Error("Cron field is empty or contains whitespace");
  }

  const normalizedParts: string[] = [];
  const values = new Set<number>();
  let usesWildcardBase = false;
  for (const part of field.split(",")) {
    if (!part) {
      throw new Error("Cron lists cannot contain empty entries");
    }

    const stepParts = part.split("/");
    if (stepParts.length > 2 || !stepParts[0]) {
      throw new Error("Cron step syntax is malformed");
    }
    const base = stepParts[0];
    const step = stepParts[1]
      ? parseCronInteger(stepParts[1], 1, maximum - minimum + 1)
      : 1;

    let start: number;
    let end: number;
    let normalizedBase: string;
    if (base === "*") {
      usesWildcardBase = true;
      start = minimum;
      end = maximum;
      normalizedBase = "*";
    } else if (base.includes("-")) {
      const rangeParts = base.split("-");
      if (rangeParts.length !== 2) {
        throw new Error("Cron range syntax is malformed");
      }
      start = parseCronInteger(rangeParts[0], minimum, maximum);
      end = parseCronInteger(rangeParts[1], minimum, maximum);
      if (start > end) {
        throw new Error("Cron ranges must be nondecreasing");
      }
      normalizedBase = `${start}-${end}`;
    } else {
      if (stepParts.length > 1) {
        throw new Error("Cron steps require a wildcard or range base");
      }
      start = parseCronInteger(base, minimum, maximum);
      end = start;
      normalizedBase = String(start);
    }

    for (const value of inclusiveRange(start, end, step)) {
      values.add(value);
    }
    normalizedParts.push(
      stepParts.length === 2 ? `${normalizedBase}/${step}` : normalizedBase,
    );
  }
  if (usesWildcardBase && normalizedParts.length > 1) {
    throw new Error(
      "Cron wildcard fields cannot contain additional list entries",
    );
  }

  return {
    normalized: normalizedParts.join(","),
    values,
    wildcard: usesWildcardBase,
    fixedValue: /^\d+$/.test(field)
      ? parseCronInteger(field, minimum, maximum)
      : null,
  };
}

function parseCronSchedule(cronExpression: string): ParsedCronSchedule {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5 || fields.some((field) => field.length === 0)) {
    throw new Error("Cron schedules must contain exactly five fields");
  }

  const parsedFields = fields.map((field, index) =>
    parseCronField(
      field,
      CRON_FIELD_RANGES[index].minimum,
      CRON_FIELD_RANGES[index].maximum,
    ),
  );
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsedFields;
  return {
    normalized: parsedFields.map((field) => field.normalized).join(" "),
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
  };
}

function parseVercelCronSchedule(cronExpression: string): ParsedCronSchedule {
  const schedule = parseCronSchedule(cronExpression);
  const fields = cronExpression.trim().split(/\s+/);

  parseCronField(fields[4], 0, 6);
  if (fields[2] !== "*" && fields[4] !== "*") {
    throw new Error(
      "Vercel cron schedules cannot restrict both day-of-month and day-of-week",
    );
  }

  return schedule;
}

export function normalizeCronExpression(cronExpression: string): string {
  return parseCronSchedule(cronExpression).normalized;
}

export function getFixedCronTime(cronExpression: string): {
  utcMinute: number | null;
  utcHour: number | null;
} {
  const parsed = parseCronSchedule(cronExpression);
  return {
    utcMinute: parsed.minute.fixedValue,
    utcHour: parsed.hour.fixedValue,
  };
}

function routePathFromRoute(route: string): string {
  if (
    !route.startsWith("/") ||
    route.startsWith("//") ||
    route.includes("://") ||
    route.includes("\\") ||
    route.includes("#") ||
    /\s/u.test(route) ||
    /[\u0000-\u001f\u007f]/.test(route)
  ) {
    throw new Error("Scheduled routes must be path-only values");
  }

  const queryIndex = route.indexOf("?");
  if (queryIndex >= 0 && route.indexOf("?", queryIndex + 1) >= 0) {
    throw new Error("Scheduled routes cannot contain repeated query markers");
  }
  const routePath = queryIndex >= 0 ? route.slice(0, queryIndex) : route;
  const normalizedRoutePath = new URL(route, "https://scheduled-route.invalid")
    .pathname;
  if (normalizedRoutePath !== routePath) {
    throw new Error("Scheduled route paths must use canonical URL syntax");
  }
  const rawQuery = queryIndex >= 0 ? route.slice(queryIndex + 1) : "";
  const query = new URLSearchParams(rawQuery);
  for (const key of query.keys()) {
    if (/(?:auth|credential|password|secret|token|api[_-]?key)/i.test(key)) {
      throw new Error("Scheduled routes cannot embed credential query fields");
    }
  }

  return routePath;
}

export function classifyCronDomains(
  routePath: string | null,
): CombinedCronDomain[] {
  if (!routePath) {
    return ["unclassified"];
  }

  if (routePath === ROLLING_COORDINATOR_ROUTE) {
    return ROLLING_FORGE_PIPELINE_ORDER.map((stage) => stage.id);
  }

  const compatibilityDomain = PIPELINE_COMPATIBILITY_DOMAINS[routePath];
  if (compatibilityDomain) {
    return [compatibilityDomain];
  }

  const pipelineDomains = ROLLING_FORGE_PIPELINE_ORDER.filter((stage) =>
    stage.routes.includes(routePath),
  ).map((stage) => stage.id);
  if (pipelineDomains.length > 0) {
    return pipelineDomains;
  }

  const sustainabilityDomain = SUSTAINABILITY_DOMAINS.find(
    (candidate) => candidate.routePath === routePath,
  );
  return sustainabilityDomain
    ? [sustainabilityDomain.domain]
    : ["unclassified"];
}

type CanonicalActivePgCronRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  normalizedSchedule: string;
  method: Exclude<CronInventoryMethod, "UNKNOWN">;
  route: string | null;
  routePath: string | null;
};

function parseCanonicalPgCronInventory(markdown: string): CombinedCronJob[] {
  const jsonMatch = markdown.match(
    /# ALL CRON JOBS:[\s\S]*?```json\s*([\s\S]*?)```/i,
  );
  if (!jsonMatch?.[1]) {
    throw new Error("Canonical pg_cron JSON inventory is missing");
  }

  let rows: unknown;
  try {
    rows = JSON.parse(jsonMatch[1]);
  } catch {
    throw new Error("Canonical pg_cron JSON inventory is malformed");
  }
  if (!Array.isArray(rows)) {
    throw new Error("Canonical pg_cron JSON inventory must be an array");
  }

  const canonicalRows = rows.map<CanonicalActivePgCronRow | null>((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error("Canonical pg_cron inventory contains a malformed row");
    }
    const candidate = row as {
      jobid?: unknown;
      jobname?: unknown;
      schedule?: unknown;
      active?: unknown;
      method?: unknown;
      route?: unknown;
    };
    if (
      typeof candidate.jobname !== "string" ||
      candidate.jobname.trim().length === 0 ||
      typeof candidate.schedule !== "string" ||
      typeof candidate.active !== "boolean"
    ) {
      throw new Error("Canonical pg_cron row identity is malformed");
    }
    if (candidate.route != null && typeof candidate.route !== "string") {
      throw new Error("Canonical pg_cron route is malformed");
    }

    const normalizedSchedule = normalizeCronExpression(candidate.schedule);
    if (!candidate.active) {
      return null;
    }

    if (
      !Number.isSafeInteger(candidate.jobid) ||
      Number(candidate.jobid) <= 0
    ) {
      throw new Error("Canonical active pg_cron job ID is malformed");
    }
    if (
      candidate.method !== "GET" &&
      candidate.method !== "POST" &&
      candidate.method !== "SQL"
    ) {
      throw new Error("Canonical active pg_cron method is malformed");
    }

    const isHttpJob = candidate.method === "GET" || candidate.method === "POST";
    if (isHttpJob && (!candidate.route || candidate.route.length === 0)) {
      throw new Error("Canonical HTTP pg_cron route is missing");
    }
    if (candidate.method === "SQL" && candidate.route != null) {
      throw new Error("Canonical SQL pg_cron row cannot define an HTTP route");
    }

    const route = isHttpJob ? (candidate.route as string) : null;
    const routePath = route ? routePathFromRoute(route) : null;
    return {
      jobid: Number(candidate.jobid),
      jobname: candidate.jobname.trim(),
      schedule: candidate.schedule,
      normalizedSchedule,
      method: candidate.method,
      route,
      routePath,
    };
  });
  const activeRows = canonicalRows.filter(
    (row): row is CanonicalActivePgCronRow => row !== null,
  );
  const activeIdentities = new Set<string>();
  const activeJobIds = new Set<number>();
  for (const row of activeRows) {
    const identity = `${row.jobname}::${row.normalizedSchedule}`;
    if (activeIdentities.has(identity)) {
      throw new Error("Canonical pg_cron inventory has a duplicate identity");
    }
    activeIdentities.add(identity);
    if (activeJobIds.has(row.jobid)) {
      throw new Error("Canonical pg_cron inventory has a duplicate job ID");
    }
    activeJobIds.add(row.jobid);
  }

  const parsed = parseCronInventoryFromMarkdown(markdown);
  if (parsed.length === 0 || parsed.length !== activeRows.length) {
    throw new Error("Canonical pg_cron inventory did not parse completely");
  }
  const parsedIdentities = new Set<string>();
  for (const job of parsed) {
    const identity = `${job.name}::${normalizeCronExpression(job.cronExpression)}`;
    if (parsedIdentities.has(identity)) {
      throw new Error("Parsed pg_cron inventory has a duplicate identity");
    }
    parsedIdentities.add(identity);
    const sourceRow = activeRows.find(
      (row) =>
        row.jobname === job.name &&
        row.normalizedSchedule === normalizeCronExpression(job.cronExpression),
    );
    if (!sourceRow) {
      throw new Error("Parsed pg_cron identity differs from the canonical row");
    }
    if (sourceRow.method !== job.method) {
      throw new Error("Parsed pg_cron method differs from the canonical row");
    }
  }
  if (parsedIdentities.size !== activeIdentities.size) {
    throw new Error("Parsed pg_cron identity set is incomplete");
  }

  return activeRows.map((row) => {
    const { utcMinute, utcHour } = getFixedCronTime(row.schedule);

    return {
      key: `pg_cron:${row.jobid}:${row.jobname}`,
      provider: "pg_cron",
      sourcePath: CRON_SCHEDULE_RELATIVE_PATH,
      active: true,
      name: row.jobname,
      method: row.method,
      cronExpression: row.schedule,
      normalizedCronExpression: row.normalizedSchedule,
      utcHour,
      utcMinute,
      route: row.route,
      routePath: row.routePath,
      domains: classifyCronDomains(row.routePath),
    } satisfies CombinedCronJob;
  });
}

export function parseVercelCronConfig(configJson: string): {
  jobs: CombinedCronJob[];
  maxDurationMs: number;
} {
  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    throw new Error("Vercel cron configuration is malformed");
  }

  if (typeof config !== "object" || config === null) {
    throw new Error("Vercel cron configuration must be an object");
  }

  const typedConfig = config as {
    functions?: Record<string, { maxDuration?: unknown }>;
    crons?: unknown;
  };
  const maxDurationSeconds =
    typedConfig.functions?.[VERCEL_PAGES_FUNCTION_GLOB]?.maxDuration;
  if (
    typeof maxDurationSeconds !== "number" ||
    !Number.isFinite(maxDurationSeconds) ||
    maxDurationSeconds <= 0
  ) {
    throw new Error("Vercel Pages function duration limit is missing");
  }
  if (!Array.isArray(typedConfig.crons) || typedConfig.crons.length === 0) {
    throw new Error("Vercel cron inventory is missing");
  }

  const jobs = typedConfig.crons.map((row, index) => {
    if (typeof row !== "object" || row === null) {
      throw new Error("Vercel cron entry is malformed");
    }
    const { path: route, schedule } = row as {
      path?: unknown;
      schedule?: unknown;
    };
    if (typeof route !== "string" || typeof schedule !== "string") {
      throw new Error("Vercel cron entry requires path and schedule strings");
    }

    const routePath = routePathFromRoute(route);
    const parsedSchedule = parseVercelCronSchedule(schedule);
    const normalizedCronExpression = parsedSchedule.normalized;
    const utcMinute = parsedSchedule.minute.fixedValue;
    const utcHour = parsedSchedule.hour.fixedValue;
    return {
      key: `vercel:${index + 1}:${routePath}`,
      provider: "vercel",
      sourcePath: VERCEL_CONFIG_RELATIVE_PATH,
      active: true,
      name: `vercel-cron-${index + 1}`,
      method: "GET",
      cronExpression: schedule,
      normalizedCronExpression,
      utcHour,
      utcMinute,
      route,
      routePath,
      domains: classifyCronDomains(routePath),
    } satisfies CombinedCronJob;
  });

  return {
    jobs,
    maxDurationMs: maxDurationSeconds * 1000,
  };
}

export function buildCombinedCronInventory(args: {
  cronScheduleMarkdown: string;
  vercelConfigJson: string;
}): CombinedCronInventory {
  const pgCronJobs = parseCanonicalPgCronInventory(args.cronScheduleMarkdown);
  const vercelInventory = parseVercelCronConfig(args.vercelConfigJson);

  return {
    jobs: [...pgCronJobs, ...vercelInventory.jobs],
    vercelMaxDurationMs: vercelInventory.maxDurationMs,
  };
}

async function readFirstAvailable(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // Try the next supported workspace root.
    }
  }

  throw new Error("Could not locate the canonical Vercel configuration");
}

export async function loadCombinedCronInventory(): Promise<CombinedCronInventory> {
  const [cronScheduleMarkdown, vercelConfigJson] = await Promise.all([
    readCronScheduleMarkdown(),
    readFirstAvailable(getVercelConfigCandidates()),
  ]);

  return buildCombinedCronInventory({
    cronScheduleMarkdown,
    vercelConfigJson,
  });
}

function setsOverlap(left: Set<number>, right: Set<number>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function cronScheduleMatchesDate(
  schedule: ParsedCronSchedule,
  date: Date,
): boolean {
  const month = date.getUTCMonth() + 1;
  if (!schedule.month.values.has(month)) {
    return false;
  }

  const dayOfMonthMatches = schedule.dayOfMonth.values.has(date.getUTCDate());
  const utcDay = date.getUTCDay();
  const dayOfWeekMatches =
    schedule.dayOfWeek.values.has(utcDay) ||
    (utcDay === 0 && schedule.dayOfWeek.values.has(7));

  if (schedule.dayOfMonth.wildcard || schedule.dayOfWeek.wildcard) {
    return dayOfMonthMatches && dayOfWeekMatches;
  }
  return dayOfMonthMatches || dayOfWeekMatches;
}

function cronSchedulesOverlap(
  left: ParsedCronSchedule,
  right: ParsedCronSchedule,
): boolean {
  if (
    !setsOverlap(left.minute.values, right.minute.values) ||
    !setsOverlap(left.hour.values, right.hour.values) ||
    !setsOverlap(left.month.values, right.month.values)
  ) {
    return false;
  }

  // This 28-year window starts at a 400-divisible leap year and contains every
  // valid month/day/weekday tuple supported by five-field cron expressions.
  const start = Date.UTC(2000, 0, 1);
  const end = Date.UTC(2028, 0, 1);
  for (let timestamp = start; timestamp < end; timestamp += 86_400_000) {
    const date = new Date(timestamp);
    if (
      cronScheduleMatchesDate(left, date) &&
      cronScheduleMatchesDate(right, date)
    ) {
      return true;
    }
  }
  return false;
}

export function findCrossProviderCronCollisions(
  jobs: CombinedCronJob[],
): CrossProviderCronCollision[] {
  const activeJobs = jobs.filter((candidate) => candidate.active);
  const parsedSchedules = new Map<string, ParsedCronSchedule>();
  for (const job of activeJobs) {
    parsedSchedules.set(
      job.normalizedCronExpression,
      parseCronSchedule(job.normalizedCronExpression),
    );
  }

  const collisions: CrossProviderCronCollision[] = [];
  for (let leftIndex = 0; leftIndex < activeJobs.length; leftIndex += 1) {
    const left = activeJobs[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < activeJobs.length;
      rightIndex += 1
    ) {
      const right = activeJobs[rightIndex];
      if (left.provider === right.provider) {
        continue;
      }

      const sharedDomains = left.domains.filter(
        (domain) => domain !== "unclassified" && right.domains.includes(domain),
      );
      if (sharedDomains.length === 0) {
        continue;
      }

      const leftSchedule = parsedSchedules.get(left.normalizedCronExpression);
      const rightSchedule = parsedSchedules.get(right.normalizedCronExpression);
      if (
        !leftSchedule ||
        !rightSchedule ||
        !cronSchedulesOverlap(leftSchedule, rightSchedule)
      ) {
        continue;
      }

      for (const domain of sharedDomains) {
        collisions.push({
          normalizedCronExpressions: unique([
            left.normalizedCronExpression,
            right.normalizedCronExpression,
          ]).sort(),
          domain,
          jobs: [left, right].map((job) => ({
            key: job.key,
            provider: job.provider,
            sourcePath: job.sourcePath,
            name: job.name,
            method: job.method,
            routePath: job.routePath,
          })),
        });
      }
    }
  }

  return collisions;
}

function rollingCoordinatorBudgetMsFromRoute(route: string): number {
  const queryIndex = route.indexOf("?");
  const query = new URLSearchParams(
    queryIndex >= 0 ? route.slice(queryIndex + 1) : "",
  );
  const modes = query.getAll("mode");
  if (modes.length !== 1) {
    throw new Error(
      "Scheduled rolling coordinator mode must be provided exactly once",
    );
  }
  const mode = modes[0];
  if (!isRollingExecutionProfile(mode)) {
    throw new Error("Scheduled rolling coordinator mode is unsupported");
  }
  return ROLLING_FORGE_PIPELINE_BUDGETS_MS[mode];
}

export function findScheduledRuntimeBudgetFindings(
  inventory: CombinedCronInventory,
): ScheduledRuntimeBudgetFinding[] {
  return NATURAL_RUNTIME_CONTRACTS.flatMap((contract) => {
    const scheduledJobs = inventory.jobs.filter(
      (job) => job.active && job.routePath === contract.routePath,
    );
    const jobsByBudget = new Map<number, CombinedCronJob[]>();
    for (const job of scheduledJobs) {
      let budgetMs = contract.defaultBudgetMs;
      if (contract.routePath === ROLLING_COORDINATOR_ROUTE) {
        if (!job.route) {
          throw new Error("Scheduled rolling coordinator route is missing");
        }
        budgetMs = rollingCoordinatorBudgetMsFromRoute(job.route);
      } else if (contract.routePath === PROJECTION_ROUTE && job.route) {
        const queryIndex = job.route.indexOf("?");
        const query = new URLSearchParams(
          queryIndex >= 0 ? job.route.slice(queryIndex + 1) : "",
        );
        const overrides = query.getAll("maxDurationMs");
        if (overrides.length > 1) {
          throw new Error("Scheduled projection runtime override is repeated");
        }
        if (overrides.length === 1) {
          if (!/^\d+$/.test(overrides[0])) {
            throw new Error("Scheduled projection runtime override is invalid");
          }
          budgetMs = Number(overrides[0]);
          if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0) {
            throw new Error("Scheduled projection runtime override is invalid");
          }
        }
      }

      const matchingJobs = jobsByBudget.get(budgetMs) ?? [];
      matchingJobs.push(job);
      jobsByBudget.set(budgetMs, matchingJobs);
    }

    return Array.from(jobsByBudget.entries()).flatMap(
      ([budgetMs, matchingJobs]) => {
        if (budgetMs < inventory.vercelMaxDurationMs) {
          return [];
        }

        return [
          {
            routePath: contract.routePath,
            budgetSourcePath: contract.budgetSourcePath,
            budgetMs,
            platformLimitSourcePath: VERCEL_FUNCTION_DURATION_SOURCE_PATH,
            platformLimitMs: inventory.vercelMaxDurationMs,
            hasAuditFlushHeadroom: false,
            scheduledJobs: matchingJobs.map((job) => ({
              key: job.key,
              provider: job.provider,
              sourcePath: job.sourcePath,
              name: job.name,
            })),
          },
        ];
      },
    );
  });
}

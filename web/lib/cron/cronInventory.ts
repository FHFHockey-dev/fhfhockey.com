import fs from "fs/promises";
import path from "path";

export type CronInventoryMethod = "GET" | "POST" | "SQL" | "UNKNOWN";

export type CronInventoryExecutionShape =
  | "HTTP route"
  | "SQL-only"
  | "wrapper-dependent"
  | "currently non-runnable in local/dev";

export type CronInventoryJob = {
  key: string;
  name: string;
  cronExpression: string;
  scheduleTimeDisplay: string;
  utcHour: number | null;
  utcMinute: number | null;
  slotIndex: number;
  sortOrder: number;
  method: CronInventoryMethod;
  executionShape: CronInventoryExecutionShape;
  url: string | null;
  route: string | null;
  routePath: string | null;
  sqlText: string | null;
  notes: string[];
};

function truncateText(value: string, maxLen = 180): string {
  return value.length <= maxLen ? value : `${value.slice(0, maxLen - 1)}…`;
}

function classifyExecutionShape(args: {
  method: CronInventoryMethod;
  notes: string[];
}): CronInventoryExecutionShape {
  const normalizedNotes = args.notes.map((note) => note.toLowerCase());
  const hasBrokenNote = normalizedNotes.some(
    (note) =>
      note.includes("404 not found") ||
      note.includes("not working") ||
      note.includes("broken")
  );

  if (hasBrokenNote) {
    return "currently non-runnable in local/dev";
  }

  if (args.method === "SQL") {
    return "SQL-only";
  }

  if (args.method === "GET" || args.method === "POST") {
    return "HTTP route";
  }

  return "wrapper-dependent";
}

export function parseUrlPieces(
  rawUrl: string | null
): { route: string | null; routePath: string | null } {
  if (!rawUrl) {
    return { route: null, routePath: null };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      route: `${parsed.pathname}${parsed.search}`,
      routePath: parsed.pathname
    };
  } catch {
    return {
      route: rawUrl,
      routePath: rawUrl.split("?")[0] ?? rawUrl
    };
  }
}

export function parseCronInvocation(sqlText: string | null): {
  method: CronInventoryMethod;
  url: string | null;
  route: string | null;
  routePath: string | null;
  sqlText: string | null;
} {
  if (!sqlText) {
    return {
      method: "UNKNOWN",
      url: null,
      route: null,
      routePath: null,
      sqlText: null
    };
  }

  const methodMatch = sqlText.match(/net\.http_(get|post)\s*\(/i);
  const method = methodMatch
    ? methodMatch[1].toUpperCase() === "POST"
      ? "POST"
      : "GET"
    : "SQL";

  const urlMatch = sqlText.match(/url\s*:?=\s*'([^']+)'/i);
  const url = urlMatch?.[1] ?? null;
  const { route, routePath } = parseUrlPieces(url);
  const normalizedSqlText =
    method === "SQL"
      ? truncateText(
          sqlText
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^'(.*)'$/, "$1"),
          180
        )
      : null;

  return {
    method,
    url,
    route,
    routePath,
    sqlText: normalizedSqlText
  };
}

export function parseScheduleTimeParts(
  cronExpression: string
): { minute: number | null; hour: number | null } {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 2) {
    return { minute: null, hour: null };
  }

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);

  return {
    minute: Number.isInteger(minute) ? minute : null,
    hour: Number.isInteger(hour) ? hour : null
  };
}

export function formatScheduleTime(cronExpression: string): string {
  const { minute, hour } = parseScheduleTimeParts(cronExpression);

  if (minute == null || hour == null) {
    return cronExpression;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
}

export function normalizeCronScheduleMarkdown(markdown: string): string {
  const activeMarkdown =
    markdown.split(/^# NEED TO ADD:?$/m)[0] ??
    markdown.split(/^# STATIC CRON SNIPPETS TO ADD$/m)[0] ??
    markdown;

  return activeMarkdown
    .split("\n")
    .map((line) => line.replace(/^\s*--\s?/, ""))
    .join("\n");
}

export function parseCronInventoryFromMarkdown(markdown: string): CronInventoryJob[] {
  const normalized = normalizeCronScheduleMarkdown(markdown);
  const scheduleRegex =
    /((?:[^\S\r\n]*[A-Z][^\n]*\n)*)[^\S\r\n]*SELECT\s+cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([\s\S]*?)\);\s*/gi;

  const jobs = Array.from(normalized.matchAll(scheduleRegex)).map((match, index) => {
    const noteBlock = match[1] ?? "";
    const notes = noteBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => Boolean(line));
    const name = match[2]?.trim() ?? "";
    const cronExpression = match[3]?.trim() ?? "";
    const body = match[4]?.trim() ?? "";
    const invocation = parseCronInvocation(body);
    const { hour, minute } = parseScheduleTimeParts(cronExpression);

    return {
      key: `${name}__${cronExpression}__${invocation.method}__${index}`,
      name,
      cronExpression,
      scheduleTimeDisplay: formatScheduleTime(cronExpression),
      utcHour: hour,
      utcMinute: minute,
      slotIndex:
        hour != null && minute != null ? hour * 60 + minute : Number.MAX_SAFE_INTEGER,
      sortOrder: index,
      method: invocation.method,
      executionShape: classifyExecutionShape({
        method: invocation.method,
        notes
      }),
      url: invocation.url,
      route: invocation.route,
      routePath: invocation.routePath,
      sqlText: invocation.sqlText,
      notes
    } satisfies CronInventoryJob;
  });

  return jobs.sort((left, right) => {
    if (left.slotIndex !== right.slotIndex) {
      return left.slotIndex - right.slotIndex;
    }

    return left.sortOrder - right.sortOrder;
  });
}

export async function readCronScheduleMarkdown(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "rules/cron-schedule.md"),
    path.resolve(process.cwd(), "web/rules/cron-schedule.md")
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // continue
    }
  }

  throw new Error("Could not locate rules/cron-schedule.md");
}

export async function loadCronInventory(): Promise<CronInventoryJob[]> {
  return parseCronInventoryFromMarkdown(await readCronScheduleMarkdown());
}

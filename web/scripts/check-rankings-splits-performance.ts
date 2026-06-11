type SplitsPayload = {
  success?: boolean;
  error?: string;
  rows?: Array<{
    entity?: { id?: number; name?: string | null };
    base?: unknown;
    splits?: Record<string, unknown>;
  }>;
  sections?: Array<{
    key?: string;
    sourceState?: "available" | "partial" | "unavailable";
    comparisons?: Array<{
      key?: string;
      sourceState?: "available" | "unavailable";
      snapshotDate?: string | null;
    }>;
  }>;
  meta?: {
    rowCount?: number;
    baseSnapshotDate?: string | null;
    latestAvailableSnapshotDate?: string | null;
    unsupportedSplits?: Array<{ key?: string; reason?: string }>;
  };
};

type Args = {
  coldBudgetMs: number;
  minRows: number;
  url: string;
  warmBudgetMs: number;
  warmRuns: number;
};

const DEFAULT_URL =
  "http://localhost:3000/api/v1/contextual-rankings/splits?entity=skaters&season=20252026&window=season&position=F&deployment=all&strength=5v5&metric=goals_per_60&min_gp=1&min_toi=300&limit=10";
const REQUIRED_SECTIONS = ["strength", "window", "deployment"];

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const next = argv[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
      continue;
    }
    if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    }
  }

  return {
    coldBudgetMs: parsePositiveInt(values.get("coldBudgetMs"), 45_000),
    minRows: parsePositiveInt(values.get("minRows"), 10),
    url: values.get("url") ?? DEFAULT_URL,
    warmBudgetMs: parsePositiveInt(values.get("warmBudgetMs"), 20_000),
    warmRuns: parsePositiveInt(values.get("warmRuns"), 1),
  };
}

async function fetchSplits(url: string) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as SplitsPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `Splits request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload };
}

function assertPayload(payload: SplitsPayload, args: Args) {
  const rows = payload.rows ?? [];
  if ((payload.meta?.rowCount ?? 0) < args.minRows || rows.length < args.minRows) {
    throw new Error(
      `Expected at least ${args.minRows} split rows, got rowCount=${payload.meta?.rowCount ?? 0} rows=${rows.length}.`,
    );
  }
  if (!payload.meta?.baseSnapshotDate || !payload.meta.latestAvailableSnapshotDate) {
    throw new Error("Expected base and latest available split snapshot dates.");
  }

  const sections = new Map((payload.sections ?? []).map((section) => [section.key, section]));
  for (const sectionKey of REQUIRED_SECTIONS) {
    const section = sections.get(sectionKey);
    if (!section) throw new Error(`Missing Splits section: ${sectionKey}.`);
    if (section.sourceState === "unavailable") {
      throw new Error(`Expected ${sectionKey} split section to be available or partial.`);
    }
    if (!section.comparisons || section.comparisons.length === 0) {
      throw new Error(`Expected ${sectionKey} split comparisons.`);
    }
  }

  const unsupportedHomeAway = payload.meta.unsupportedSplits?.find(
    (split) => split.key === "home_away" && split.reason,
  );
  if (!unsupportedHomeAway) {
    throw new Error("Expected explicit unsupported home_away split metadata.");
  }

  const first = rows[0];
  if (!first?.entity?.id || !first.entity.name) {
    throw new Error("Expected first split row to include entity identity.");
  }
  if (first.base == null || first.splits == null) {
    throw new Error("Expected first split row to include base and comparison values.");
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const timings: Array<{ durationMs: number; run: "cold" | "warm" }> = [];

  const cold = await fetchSplits(args.url);
  assertPayload(cold.payload, args);
  timings.push({ durationMs: cold.durationMs, run: "cold" });
  if (cold.durationMs > args.coldBudgetMs) {
    throw new Error(
      `Cold Splits request exceeded budget (${cold.durationMs}ms > ${args.coldBudgetMs}ms).`,
    );
  }

  for (let index = 0; index < args.warmRuns; index += 1) {
    const warm = await fetchSplits(args.url);
    assertPayload(warm.payload, args);
    timings.push({ durationMs: warm.durationMs, run: "warm" });
    if (warm.durationMs > args.warmBudgetMs) {
      throw new Error(
        `Warm Splits request exceeded budget (${warm.durationMs}ms > ${args.warmBudgetMs}ms).`,
      );
    }
  }

  console.info(
    "[check-rankings-splits-performance] summary",
    JSON.stringify({
      budgets: {
        coldBudgetMs: args.coldBudgetMs,
        warmBudgetMs: args.warmBudgetMs,
      },
      timings,
      url: args.url,
    }),
  );
}

run().catch((error) => {
  console.error(
    "[check-rankings-splits-performance] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};

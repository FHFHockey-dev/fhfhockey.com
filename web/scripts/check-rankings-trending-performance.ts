type TrendingPayload = {
  success?: boolean;
  error?: string;
  rows?: Array<{
    entity?: { id?: number; name?: string | null };
    trendScore?: number | null;
    metrics?: unknown[];
    toiTrend?: unknown;
  }>;
  meta?: {
    rowCount?: number;
    latestAvailableSnapshotDate?: string | null;
    windows?: string[];
    snapshotDates?: Record<string, string | null>;
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
  "http://localhost:3000/api/v1/contextual-rankings/trending?entity=skaters&season=20252026&position=all&deployment=all&strength=5v5&min_gp=1&min_toi=300&limit=25";
const REQUIRED_WINDOWS = ["season", "last20", "last10", "last5"];

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
    coldBudgetMs: parsePositiveInt(values.get("coldBudgetMs"), 25_000),
    minRows: parsePositiveInt(values.get("minRows"), 10),
    url: values.get("url") ?? DEFAULT_URL,
    warmBudgetMs: parsePositiveInt(values.get("warmBudgetMs"), 8_000),
    warmRuns: parsePositiveInt(values.get("warmRuns"), 2),
  };
}

async function fetchTrending(url: string) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as TrendingPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `Trending request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload };
}

function assertPayload(payload: TrendingPayload, args: Args) {
  const rows = payload.rows ?? [];
  if ((payload.meta?.rowCount ?? 0) < args.minRows || rows.length < args.minRows) {
    throw new Error(
      `Expected at least ${args.minRows} trending rows, got rowCount=${payload.meta?.rowCount ?? 0} rows=${rows.length}.`,
    );
  }
  if (!payload.meta?.latestAvailableSnapshotDate) {
    throw new Error("Expected a latest available trending snapshot date.");
  }
  for (const window of REQUIRED_WINDOWS) {
    if (!payload.meta.windows?.includes(window)) {
      throw new Error(`Expected trending window ${window}.`);
    }
    if (!payload.meta.snapshotDates || !(window in payload.meta.snapshotDates)) {
      throw new Error(`Expected snapshot metadata for trending window ${window}.`);
    }
  }

  const first = rows[0];
  if (!first?.entity?.id || !first.entity.name) {
    throw new Error("Expected first trending row to include entity identity.");
  }
  if (!Array.isArray(first.metrics) || first.metrics.length === 0) {
    throw new Error("Expected first trending row to include metric summaries.");
  }
  if (first.toiTrend == null) {
    throw new Error("Expected first trending row to include TOI trend data.");
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const timings: Array<{ durationMs: number; run: "cold" | "warm" }> = [];

  const cold = await fetchTrending(args.url);
  assertPayload(cold.payload, args);
  timings.push({ durationMs: cold.durationMs, run: "cold" });
  if (cold.durationMs > args.coldBudgetMs) {
    throw new Error(
      `Cold Trending request exceeded budget (${cold.durationMs}ms > ${args.coldBudgetMs}ms).`,
    );
  }

  for (let index = 0; index < args.warmRuns; index += 1) {
    const warm = await fetchTrending(args.url);
    assertPayload(warm.payload, args);
    timings.push({ durationMs: warm.durationMs, run: "warm" });
    if (warm.durationMs > args.warmBudgetMs) {
      throw new Error(
        `Warm Trending request exceeded budget (${warm.durationMs}ms > ${args.warmBudgetMs}ms).`,
      );
    }
  }

  console.info(
    "[check-rankings-trending-performance] summary",
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
    "[check-rankings-trending-performance] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};

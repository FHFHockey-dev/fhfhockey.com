type MatrixPayload = {
  success?: boolean;
  error?: string;
  rows?: Array<{
    metrics?: Record<string, { qualifiedPeerCount?: number }>;
  }>;
  meta?: {
    rowCount?: number;
    totalRankedRows?: number;
    pageCount?: number;
    snapshotDate?: string | null;
  };
};

type Args = {
  coldBudgetMs: number;
  expectedRows: number;
  minPageCount: number;
  minPeerCount: number;
  minTotalRows: number;
  url: string;
  warmBudgetMs: number;
  warmRuns: number;
};

const DEFAULT_URL =
  "http://localhost:3000/api/v1/contextual-rankings/matrix?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=1&min_toi=300&sort_metric=points_per_60&sort_direction=desc&page=1&page_size=10";

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
    coldBudgetMs: parsePositiveInt(values.get("coldBudgetMs"), 8000),
    expectedRows: parsePositiveInt(values.get("expectedRows"), 10),
    minPageCount: parsePositiveInt(values.get("minPageCount"), 70),
    minPeerCount: parsePositiveInt(values.get("minPeerCount"), 700),
    minTotalRows: parsePositiveInt(values.get("minTotalRows"), 700),
    url: values.get("url") ?? DEFAULT_URL,
    warmBudgetMs: parsePositiveInt(values.get("warmBudgetMs"), 2000),
    warmRuns: parsePositiveInt(values.get("warmRuns"), 2),
  };
}

async function fetchMatrix(url: string) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as MatrixPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `Matrix request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload };
}

function assertPayload(payload: MatrixPayload, args: Args) {
  const rowCount = payload.meta?.rowCount ?? 0;
  const totalRankedRows = payload.meta?.totalRankedRows ?? 0;
  const pageCount = payload.meta?.pageCount ?? 0;
  const peerCount =
    payload.rows?.[0]?.metrics?.goals_per_60?.qualifiedPeerCount ?? 0;

  if (rowCount !== args.expectedRows || payload.rows?.length !== args.expectedRows) {
    throw new Error(
      `Expected ${args.expectedRows} matrix rows, got rowCount=${rowCount} rows=${payload.rows?.length ?? 0}.`,
    );
  }
  if (totalRankedRows < args.minTotalRows) {
    throw new Error(
      `Expected at least ${args.minTotalRows} ranked rows, got ${totalRankedRows}.`,
    );
  }
  if (pageCount < args.minPageCount) {
    throw new Error(
      `Expected at least ${args.minPageCount} pages, got ${pageCount}.`,
    );
  }
  if (peerCount < args.minPeerCount) {
    throw new Error(
      `Expected at least ${args.minPeerCount} qualified peers, got ${peerCount}.`,
    );
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const timings: Array<{ durationMs: number; run: "cold" | "warm" }> = [];

  const cold = await fetchMatrix(args.url);
  assertPayload(cold.payload, args);
  timings.push({ durationMs: cold.durationMs, run: "cold" });
  if (cold.durationMs > args.coldBudgetMs) {
    throw new Error(
      `Cold matrix request exceeded budget (${cold.durationMs}ms > ${args.coldBudgetMs}ms).`,
    );
  }

  for (let index = 0; index < args.warmRuns; index += 1) {
    const warm = await fetchMatrix(args.url);
    assertPayload(warm.payload, args);
    timings.push({ durationMs: warm.durationMs, run: "warm" });
    if (warm.durationMs > args.warmBudgetMs) {
      throw new Error(
        `Warm matrix request exceeded budget (${warm.durationMs}ms > ${args.warmBudgetMs}ms).`,
      );
    }
  }

  console.info(
    "[check-rankings-matrix-performance] summary",
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
    "[check-rankings-matrix-performance] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};

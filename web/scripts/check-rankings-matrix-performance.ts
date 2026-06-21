type MatrixPayload = {
  success?: boolean;
  error?: string;
  rows?: unknown[];
  meta?: {
    rowCount?: number;
    totalRankedRows?: number;
    pageCount?: number;
    snapshotDate?: string | null;
    sourceTable?: string;
    sourceTables?: string[];
    rankingSource?: string;
  };
};

type MetricExplorerPayload = {
  success?: boolean;
  error?: string;
  rankings?: unknown[];
  meta?: {
    rowCount?: number;
    snapshotDate?: string | null;
    sourceTable?: string;
    sourceTables?: string[];
    rankingSource?: string;
  };
};

type Check = {
  coldBudgetMs: number;
  expectedRows: number;
  kind: "matrix" | "metric_explorer";
  label: string;
  minPageCount?: number;
  minTotalRows?: number;
  path: string;
  warmBudgetMs: number;
};

type Args = {
  baseUrl: string;
  coldBudgetMs: number | null;
  warmBudgetMs: number | null;
  warmRuns: number;
};

const DEFAULT_BASE_URL = "http://localhost:3000";

const CHECKS: Check[] = [
  {
    label: "skater matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/matrix?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=1&min_toi=300&sort_metric=points_per_60&sort_direction=desc&page=1&page_size=10",
    expectedRows: 10,
    minTotalRows: 700,
    minPageCount: 70,
    coldBudgetMs: 8000,
    warmBudgetMs: 2000,
  },
  {
    label: "Metric Explorer",
    kind: "metric_explorer",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=sog_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=100",
    expectedRows: 100,
    coldBudgetMs: 8000,
    warmBudgetMs: 3000,
  },
  {
    label: "goalie matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/goalies?season=20252026&window=season&metric=save_percentage&sort_direction=desc&role=all&min_starts=3&min_shots=100&page=1&page_size=10",
    expectedRows: 10,
    minTotalRows: 50,
    minPageCount: 5,
    coldBudgetMs: 18000,
    warmBudgetMs: 12000,
  },
  {
    label: "team matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=off_rating&sort_direction=desc&page=1&page_size=10",
    expectedRows: 10,
    minTotalRows: 30,
    minPageCount: 3,
    coldBudgetMs: 12000,
    warmBudgetMs: 5000,
  },
];

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInt(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
    baseUrl: values.get("baseUrl") ?? DEFAULT_BASE_URL,
    coldBudgetMs: parseOptionalPositiveInt(values.get("coldBudgetMs")),
    warmBudgetMs: parseOptionalPositiveInt(values.get("warmBudgetMs")),
    warmRuns: parsePositiveInt(values.get("warmRuns"), 2),
  };
}

function urlFor(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

async function fetchPayload<T extends MatrixPayload | MetricExplorerPayload>(
  url: string,
) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as T;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload };
}

function assertPayload(
  payload: MatrixPayload | MetricExplorerPayload,
  check: Check,
) {
  const rows =
    check.kind === "metric_explorer"
      ? (payload as MetricExplorerPayload).rankings
      : (payload as MatrixPayload).rows;
  const rowCount = payload.meta?.rowCount ?? 0;

  if (rowCount !== check.expectedRows || rows?.length !== check.expectedRows) {
    throw new Error(
      `${check.label} expected ${check.expectedRows} rows, got rowCount=${rowCount} rows=${rows?.length ?? 0}.`,
    );
  }

  if (check.kind === "matrix") {
    const matrixPayload = payload as MatrixPayload;
    const totalRankedRows = matrixPayload.meta?.totalRankedRows ?? 0;
    const pageCount = matrixPayload.meta?.pageCount ?? 0;
    if (check.minTotalRows != null && totalRankedRows < check.minTotalRows) {
      throw new Error(
        `${check.label} expected at least ${check.minTotalRows} ranked rows, got ${totalRankedRows}.`,
      );
    }
    if (check.minPageCount != null && pageCount < check.minPageCount) {
      throw new Error(
        `${check.label} expected at least ${check.minPageCount} pages, got ${pageCount}.`,
      );
    }
  }
}

async function runCheck(check: Check, args: Args) {
  const url = urlFor(args.baseUrl, check.path);
  const timings: Array<{ durationMs: number; run: "cold" | "warm" }> = [];
  const coldBudgetMs = args.coldBudgetMs ?? check.coldBudgetMs;
  const warmBudgetMs = args.warmBudgetMs ?? check.warmBudgetMs;

  const cold = await fetchPayload(url);
  assertPayload(cold.payload, check);
  timings.push({ durationMs: cold.durationMs, run: "cold" });
  if (cold.durationMs > coldBudgetMs) {
    throw new Error(
      `${check.label} cold request exceeded budget (${cold.durationMs}ms > ${coldBudgetMs}ms).`,
    );
  }

  for (let index = 0; index < args.warmRuns; index += 1) {
    const warm = await fetchPayload(url);
    assertPayload(warm.payload, check);
    timings.push({ durationMs: warm.durationMs, run: "warm" });
    if (warm.durationMs > warmBudgetMs) {
      throw new Error(
        `${check.label} warm request exceeded budget (${warm.durationMs}ms > ${warmBudgetMs}ms).`,
      );
    }
  }

  return {
    label: check.label,
    budgets: { coldBudgetMs, warmBudgetMs },
    sourceTable: cold.payload.meta?.sourceTable ?? null,
    sourceTables: cold.payload.meta?.sourceTables ?? [],
    rankingSource: cold.payload.meta?.rankingSource ?? null,
    snapshotDate: cold.payload.meta?.snapshotDate ?? null,
    timings,
    url,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  for (const check of CHECKS) {
    results.push(await runCheck(check, args));
  }

  console.info(
    "[check-rankings-matrix-performance] summary",
    JSON.stringify({ results }, null, 2),
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

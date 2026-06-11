type RankingsPayload = {
  success?: boolean;
  error?: string;
  rankings?: Array<{
    metric?: { value?: number | null; percentile?: number | null };
  }>;
  meta?: {
    rowCount?: number;
    snapshotDate?: string | null;
    latestAvailableSnapshotDate?: string | null;
    snapshotSelectionReason?: string;
    unavailable?: boolean;
    message?: string | null;
  };
};

type Args = {
  baseUrl: string;
  minRows: number;
};

const DEFAULT_BASE_URL = "http://localhost:3000";
const CHECKS = [
  {
    label: "5v5 goals/60",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=goals_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
  },
  {
    label: "5v5 shot attempts/60",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=shot_attempts_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
  },
  {
    label: "5v5 ixG/60",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=ixg_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
  },
  {
    label: "PP goals/60",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=pp&metric=goals_per_60&min_gp=1&min_toi=0&sort=percentile&direction=desc&limit=25",
  },
] as const;

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
    baseUrl: values.get("baseUrl") ?? DEFAULT_BASE_URL,
    minRows: parsePositiveInt(values.get("minRows"), 10),
  };
}

function finiteMetricRows(payload: RankingsPayload) {
  return (payload.rankings ?? []).filter(
    (row) =>
      row.metric?.value != null &&
      Number.isFinite(row.metric.value) &&
      row.metric?.percentile != null &&
      Number.isFinite(row.metric.percentile),
  ).length;
}

async function fetchCheck(baseUrl: string, path: string) {
  const url = new URL(path, baseUrl).toString();
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as RankingsPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload, url };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const results: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];

  for (const check of CHECKS) {
    const { durationMs, payload, url } = await fetchCheck(args.baseUrl, check.path);
    const rowCount = payload.meta?.rowCount ?? 0;
    const finiteRows = finiteMetricRows(payload);
    if (payload.meta?.unavailable) {
      throw new Error(`${check.label} is unavailable: ${payload.meta.message ?? ""}`);
    }
    if (rowCount < args.minRows || finiteRows < args.minRows) {
      throw new Error(
        `${check.label} returned too few calculable rows (rowCount=${rowCount}, finiteRows=${finiteRows}, min=${args.minRows}).`,
      );
    }
    if (
      payload.meta?.snapshotDate &&
      payload.meta.latestAvailableSnapshotDate &&
      payload.meta.snapshotDate < payload.meta.latestAvailableSnapshotDate
    ) {
      warnings.push(
        `${check.label} is using fallback snapshot ${payload.meta.snapshotDate}; latest available is ${payload.meta.latestAvailableSnapshotDate}.`,
      );
    }
    results.push({
      label: check.label,
      durationMs,
      rowCount,
      finiteRows,
      snapshotDate: payload.meta?.snapshotDate ?? null,
      latestAvailableSnapshotDate: payload.meta?.latestAvailableSnapshotDate ?? null,
      snapshotSelectionReason: payload.meta?.snapshotSelectionReason ?? null,
      url,
    });
  }

  console.info(
    "[check-rankings-source-health] summary",
    JSON.stringify({ results, warnings }, null, 2),
  );
}

run().catch((error) => {
  console.error(
    "[check-rankings-source-health] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};

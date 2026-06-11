type DeploymentTiersPayload = {
  success?: boolean;
  error?: string;
  sections?: Array<{
    key?: string;
    strength?: string;
    sourceState?: "available" | "partial" | "unavailable";
    buckets?: Array<{
      key?: string;
      playerCount?: number;
      averagePercentile?: number | null;
      sourceState?: "available" | "partial" | "unavailable";
    }>;
  }>;
  meta?: {
    latestAvailableSnapshotDate?: string | null;
    snapshotDates?: string[];
  };
};

type Args = {
  coldBudgetMs: number;
  url: string;
  warmBudgetMs: number;
  warmRuns: number;
};

const DEFAULT_URL =
  "http://localhost:3000/api/v1/contextual-rankings/deployment-tiers?entity=skaters&season=20252026&window=season&position=all&strength=5v5&min_gp=1&min_toi=300";

const REQUIRED_SECTIONS = new Map([
  ["ev_forwards", ["L1", "L2", "L3", "L4"]],
  ["ev_defense", ["P1", "P2", "P3"]],
  ["power_play", ["PP1", "PP2", "PP3"]],
  ["penalty_kill", ["PK1", "PK2"]],
]);

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
    url: values.get("url") ?? DEFAULT_URL,
    warmBudgetMs: parsePositiveInt(values.get("warmBudgetMs"), 5_000),
    warmRuns: parsePositiveInt(values.get("warmRuns"), 2),
  };
}

async function fetchDeploymentTiers(url: string) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as DeploymentTiersPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `Deployment Tiers request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload };
}

function assertPayload(payload: DeploymentTiersPayload) {
  if (!payload.meta?.latestAvailableSnapshotDate) {
    throw new Error("Expected a latest available deployment snapshot date.");
  }

  const sections = new Map((payload.sections ?? []).map((section) => [section.key, section]));
  for (const [sectionKey, bucketKeys] of REQUIRED_SECTIONS) {
    const section = sections.get(sectionKey);
    if (!section) throw new Error(`Missing Deployment Tiers section: ${sectionKey}.`);
    if (section.sourceState !== "available") {
      throw new Error(
        `Expected section ${sectionKey} to be available, got ${section.sourceState ?? "missing"}.`,
      );
    }

    const buckets = new Map((section.buckets ?? []).map((bucket) => [bucket.key, bucket]));
    for (const bucketKey of bucketKeys) {
      const bucket = buckets.get(bucketKey);
      if (!bucket) {
        throw new Error(`Missing ${sectionKey} bucket: ${bucketKey}.`);
      }
      if (bucket.sourceState !== "available") {
        throw new Error(
          `Expected ${bucketKey} to be available, got ${bucket.sourceState ?? "missing"}.`,
        );
      }
      if (!bucket.playerCount || bucket.playerCount <= 0) {
        throw new Error(`Expected ${bucketKey} to include players, got ${bucket.playerCount ?? 0}.`);
      }
      if (bucket.averagePercentile == null) {
        throw new Error(`Expected ${bucketKey} to include an average percentile.`);
      }
    }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const timings: Array<{ durationMs: number; run: "cold" | "warm" }> = [];

  const cold = await fetchDeploymentTiers(args.url);
  assertPayload(cold.payload);
  timings.push({ durationMs: cold.durationMs, run: "cold" });
  if (cold.durationMs > args.coldBudgetMs) {
    throw new Error(
      `Cold Deployment Tiers request exceeded budget (${cold.durationMs}ms > ${args.coldBudgetMs}ms).`,
    );
  }

  for (let index = 0; index < args.warmRuns; index += 1) {
    const warm = await fetchDeploymentTiers(args.url);
    assertPayload(warm.payload);
    timings.push({ durationMs: warm.durationMs, run: "warm" });
    if (warm.durationMs > args.warmBudgetMs) {
      throw new Error(
        `Warm Deployment Tiers request exceeded budget (${warm.durationMs}ms > ${args.warmBudgetMs}ms).`,
      );
    }
  }

  console.info(
    "[check-rankings-deployment-tiers-performance] summary",
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
    "[check-rankings-deployment-tiers-performance] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};

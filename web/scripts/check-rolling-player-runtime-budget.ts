import { main } from "lib/supabase/Upserts/fetchRollingPlayerAverages";

type ExecutionProfile = "daily_incremental" | "overnight" | "targeted_repair";

const PROFILE_BUDGETS_MS: Record<ExecutionProfile, number> = {
  daily_incremental: 270_000,
  overnight: 1_800_000,
  targeted_repair: 600_000
};

function parseProfile(value: unknown): ExecutionProfile {
  if (
    value === "daily_incremental" ||
    value === "overnight" ||
    value === "targeted_repair"
  ) {
    return value;
  }
  return "daily_incremental";
}

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string | boolean> = {
    profile: "daily_incremental",
    skipDiagnostics: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function run() {
  const argv = parseArgs(process.argv.slice(2));

  const profile = parseProfile(argv.profile);
  const date = typeof argv.date === "string" ? argv.date : undefined;
  const startDate =
    typeof argv.startDate === "string" ? argv.startDate : date;
  const endDate =
    typeof argv.endDate === "string" ? argv.endDate : date;

  if (!startDate || !endDate) {
    throw new Error(
      "Provide --date YYYY-MM-DD or both --startDate and --endDate."
    );
  }

  const playerConcurrency =
    parsePositiveInt(argv.playerConcurrency) ??
    (profile === "overnight" ? 4 : 4);
  const upsertBatchSize =
    parsePositiveInt(argv.upsertBatchSize) ??
    (profile === "overnight" ? 250 : 500);
  const upsertConcurrency =
    parsePositiveInt(argv.upsertConcurrency) ??
    (profile === "overnight" ? 2 : 4);
  const budgetMs =
    parsePositiveInt(argv.budgetMs) ?? PROFILE_BUDGETS_MS[profile];
  const skipDiagnostics = argv.skipDiagnostics !== "false";

  const startedAt = Date.now();
  await main({
    startDate,
    endDate,
    playerConcurrency,
    upsertBatchSize,
    upsertConcurrency,
    skipDiagnostics
  });
  const durationMs = Date.now() - startedAt;
  const withinBudget = durationMs <= budgetMs;

  const summary = {
    profile,
    startDate,
    endDate,
    playerConcurrency,
    upsertBatchSize,
    upsertConcurrency,
    skipDiagnostics,
    durationMs,
    durationLabel: formatDuration(durationMs),
    budgetMs,
    budgetLabel: formatDuration(budgetMs),
    withinBudget
  };

  console.info(
    "[check-rolling-player-runtime-budget] summary",
    JSON.stringify(summary)
  );

  if (!withinBudget) {
    throw new Error(
      `Rolling-player ${profile} runtime exceeded budget (${summary.durationLabel} > ${summary.budgetLabel}).`
    );
  }
}

run().catch((error) => {
  console.error(
    "[check-rolling-player-runtime-budget] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error)
    })
  );
  process.exit(1);
});

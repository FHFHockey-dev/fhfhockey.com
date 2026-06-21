import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  generatePregamePredictionsForWindow,
  type GeneratePredictionWindowResult,
} from "lib/game-predictions/workflow";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
} from "lib/game-predictions/baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "lib/game-predictions/featureSources";
import type { Database } from "lib/supabase/database-generated.types";

export type ForecastGamePredictionsCliOptions = {
  fromDate?: string;
  toDate?: string;
  fromOffsetDays?: number;
  toOffsetDays?: number;
  sourceAsOfDate?: string;
  predictionCutoffAt?: string;
  modelName?: string;
  modelVersion?: string;
  limit?: number;
  maxRuntimeMs?: number;
  dryRun: boolean;
  confirmWrite: boolean;
  failOnSkipped: boolean;
  allowBaselineBootstrap: boolean;
  help: boolean;
};

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function readFlagValue(argv: string[], index: number): {
  value: string | undefined;
  nextIndex: number;
} {
  const current = argv[index] ?? "";
  const equalsIndex = current.indexOf("=");
  if (equalsIndex >= 0) {
    return {
      value: current.slice(equalsIndex + 1),
      nextIndex: index,
    };
  }
  return {
    value: argv[index + 1],
    nextIndex: index + 1,
  };
}

function parseBooleanValue(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseIntegerValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parseForecastGamePredictionsArgs(
  argv: string[],
): ForecastGamePredictionsCliOptions {
  const options: ForecastGamePredictionsCliOptions = {
    dryRun: true,
    confirmWrite: false,
    failOnSkipped: false,
    allowBaselineBootstrap: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const flag = arg.split("=")[0];

    switch (flag) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--from-date": {
        const parsed = readFlagValue(argv, index);
        options.fromDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--to-date": {
        const parsed = readFlagValue(argv, index);
        options.toDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--from-offset-days": {
        const parsed = readFlagValue(argv, index);
        options.fromOffsetDays = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--to-offset-days": {
        const parsed = readFlagValue(argv, index);
        options.toOffsetDays = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--source-as-of-date": {
        const parsed = readFlagValue(argv, index);
        options.sourceAsOfDate = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--prediction-cutoff-at": {
        const parsed = readFlagValue(argv, index);
        options.predictionCutoffAt = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--model-name": {
        const parsed = readFlagValue(argv, index);
        options.modelName = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--model-version": {
        const parsed = readFlagValue(argv, index);
        options.modelVersion = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--limit": {
        const parsed = readFlagValue(argv, index);
        options.limit = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--max-runtime-ms": {
        const parsed = readFlagValue(argv, index);
        options.maxRuntimeMs = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--dry-run": {
        const parsed = arg.includes("=")
          ? readFlagValue(argv, index)
          : { value: "true", nextIndex: index };
        options.dryRun = parseBooleanValue(parsed.value, true);
        index = parsed.nextIndex;
        break;
      }
      case "--write":
        options.dryRun = false;
        break;
      case "--confirm-write":
        options.confirmWrite = true;
        break;
      case "--fail-on-skipped":
        options.failOnSkipped = true;
        break;
      case "--allow-baseline-bootstrap":
        options.allowBaselineBootstrap = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function isIsoDate(value: string | undefined): boolean {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateForecastGamePredictionsOptions(
  options: ForecastGamePredictionsCliOptions,
): void {
  if (options.help) return;
  if (!isIsoDate(options.fromDate) || !isIsoDate(options.toDate)) {
    throw new Error("--from-date and --to-date must use YYYY-MM-DD.");
  }
  if (
    (!options.fromDate && options.fromOffsetDays == null) ||
    (!options.toDate && options.toOffsetDays == null)
  ) {
    throw new Error(
      "--from-date/--to-date or --from-offset-days/--to-offset-days are required.",
    );
  }
  if (!options.dryRun && !options.confirmWrite) {
    throw new Error(
      "Refusing to write game predictions without --confirm-write.",
    );
  }
}

function addUtcDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function resolveForecastDateWindow(
  options: Pick<
    ForecastGamePredictionsCliOptions,
    "fromDate" | "toDate" | "fromOffsetDays" | "toOffsetDays"
  >,
  now = new Date(),
): { fromDate: string; toDate: string } {
  const fromDate =
    options.fromDate ?? addUtcDays(now, options.fromOffsetDays ?? 0);
  const toDate =
    options.toDate ??
    addUtcDays(now, options.toOffsetDays ?? options.fromOffsetDays ?? 0);
  return { fromDate, toDate };
}

function supabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export function resolveForecastModelIdentity(options: {
  modelName?: string;
  modelVersion?: string;
}) {
  return {
    modelName: options.modelName ?? BASELINE_MODEL_NAME,
    modelVersion: options.modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion: GAME_PREDICTION_FEATURE_SET_VERSION,
  };
}

function isCurrentCompiledBaseline(identity: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
}): boolean {
  return (
    identity.modelName === BASELINE_MODEL_NAME &&
    identity.modelVersion === BASELINE_MODEL_VERSION &&
    identity.featureSetVersion === GAME_PREDICTION_FEATURE_SET_VERSION
  );
}

async function assertServingWriteAllowed(args: {
  client: ReturnType<typeof supabaseClient>;
  modelName?: string;
  modelVersion?: string;
  allowBaselineBootstrap: boolean;
}): Promise<void> {
  const identity = resolveForecastModelIdentity(args);
  const { data, error } = await args.client
    .from("game_prediction_model_versions")
    .select("status")
    .eq("model_name", identity.modelName)
    .eq("model_version", identity.modelVersion)
    .eq("feature_set_version", identity.featureSetVersion)
    .maybeSingle();
  if (error) throw error;
  if (data?.status === "production") return;

  if (
    isCurrentCompiledBaseline(identity) &&
    args.allowBaselineBootstrap
  ) {
    return;
  }

  throw new Error(
    [
      "Refusing to write forecast predictions without an active production model-version row for",
      `${identity.modelName}/${identity.modelVersion}/${identity.featureSetVersion}.`,
      "Promote the model first, or pass --allow-baseline-bootstrap for the current compiled baseline only.",
    ].join(" "),
  );
}

export function summarizeForecastGamePredictionsResult(
  result: GeneratePredictionWindowResult,
) {
  const skippedReasons = result.results.reduce<Record<string, number>>(
    (counts, row) => {
      if (!row.skippedReason) return counts;
      counts[row.skippedReason] = (counts[row.skippedReason] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return {
    success: Object.keys(skippedReasons).length === 0,
    dryRun: result.dryRun,
    fromDate: result.fromDate,
    toDate: result.toDate,
    sourceAsOfDate: result.sourceAsOfDate,
    requestedGames: result.requestedGames,
    processedGames: result.processedGames,
    skippedGames: result.skippedGames,
    stoppedForDeadline: result.stoppedForDeadline,
    skippedReasons,
    predictions: result.results.map((row) => ({
      gameId: row.gameId,
      featureSnapshotId: row.featureSnapshotId,
      predictionId: row.predictionId,
      homeWinProbability: row.homeWinProbability,
      awayWinProbability: row.awayWinProbability,
      skippedReason: row.skippedReason,
      dryRun: row.dryRun,
    })),
  };
}

function usage(): string {
  return [
    "Usage:",
    "  npm run forecast:game-predictions -- --from-date 2026-06-15 --to-date 2026-06-22",
    "  npm run forecast:game-predictions -- --from-offset-days 0 --to-offset-days 7",
    "",
    "Writes are blocked unless both --write and --confirm-write are supplied.",
    "Baseline production bootstrap is blocked unless --allow-baseline-bootstrap is supplied.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseForecastGamePredictionsArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  validateForecastGamePredictionsOptions(options);
  loadEnv();

  const client = supabaseClient();
  if (!options.dryRun) {
    await assertServingWriteAllowed({
      client,
      modelName: options.modelName,
      modelVersion: options.modelVersion,
      allowBaselineBootstrap: options.allowBaselineBootstrap,
    });
  }

  const { fromDate, toDate } = resolveForecastDateWindow(options);
  const predictionCutoffAt = options.predictionCutoffAt ?? new Date().toISOString();
  const result = await generatePregamePredictionsForWindow({
    client,
    fromDate,
    toDate,
    sourceAsOfDate: options.sourceAsOfDate ?? predictionCutoffAt.slice(0, 10),
    predictionCutoffAt,
    modelName: options.modelName,
    modelVersion: options.modelVersion,
    allowBaselineBootstrap: options.allowBaselineBootstrap,
    limit: options.limit,
    maxRuntimeMs: options.maxRuntimeMs,
    dryRun: options.dryRun,
  });
  const summary = summarizeForecastGamePredictionsResult(result);

  console.log(JSON.stringify(summary, null, 2));
  if (options.failOnSkipped && result.skippedGames > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

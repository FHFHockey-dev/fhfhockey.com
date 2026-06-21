import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { backfillGamePredictionFeatureSnapshotsForWindow } from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";

export type BackfillFeatureSnapshotsCliOptions = {
  fromDate?: string;
  toDate?: string;
  dryRun: boolean;
  confirmWrite: boolean;
  modelName?: string;
  modelVersion?: string;
  cutoffHoursBeforeStart?: number;
  limit?: number;
  maxRuntimeMs?: number;
  skipExisting?: boolean;
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

function parseNumberValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBackfillFeatureSnapshotsArgs(
  argv: string[],
): BackfillFeatureSnapshotsCliOptions {
  const options: BackfillFeatureSnapshotsCliOptions = {
    dryRun: true,
    confirmWrite: false,
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
      case "--cutoff-hours-before-start": {
        const parsed = readFlagValue(argv, index);
        options.cutoffHoursBeforeStart = parseNumberValue(parsed.value);
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
      case "--skip-existing": {
        const parsed = arg.includes("=")
          ? readFlagValue(argv, index)
          : { value: "true", nextIndex: index };
        options.skipExisting = parseBooleanValue(parsed.value, true);
        index = parsed.nextIndex;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function validateBackfillFeatureSnapshotsOptions(
  options: BackfillFeatureSnapshotsCliOptions,
): void {
  if (options.help) return;
  if (!options.fromDate || !options.toDate) {
    throw new Error("--from-date and --to-date are required.");
  }
  if (!options.dryRun && !options.confirmWrite) {
    throw new Error(
      "Refusing to write feature snapshots without --confirm-write.",
    );
  }
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

function usage(): string {
  return [
    "Usage:",
    "  npm run backfill:game-prediction-feature-snapshots -- --from-date 2026-01-01 --to-date 2026-01-07",
    "",
    "Writes are blocked unless both --write and --confirm-write are supplied.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseBackfillFeatureSnapshotsArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  validateBackfillFeatureSnapshotsOptions(options);
  loadEnv();

  const result = await backfillGamePredictionFeatureSnapshotsForWindow({
    client: supabaseClient(),
    fromDate: options.fromDate!,
    toDate: options.toDate!,
    cutoffHoursBeforeStart: options.cutoffHoursBeforeStart,
    modelName: options.modelName,
    modelVersion: options.modelVersion,
    limit: options.limit,
    maxRuntimeMs: options.maxRuntimeMs,
    skipExisting: options.skipExisting,
    dryRun: options.dryRun,
  });

  console.log(
    JSON.stringify(
      {
        success: result.failedGames === 0,
        dryRun: result.dryRun,
        result,
      },
      null,
      2,
    ),
  );

  if (result.failedGames > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

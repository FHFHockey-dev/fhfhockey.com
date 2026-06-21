import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  previewGamePredictionModelVersionPromotion,
  promoteGamePredictionModelVersion,
  type PreviewGamePredictionModelVersionPromotionResult,
  type PromoteGamePredictionModelVersionResult,
} from "lib/game-predictions/workflow";
import type { Database } from "lib/supabase/database-generated.types";

export type PromoteModelVersionCliOptions = {
  modelName?: string;
  modelVersion?: string;
  featureSetVersion?: string;
  minEvaluatedGames?: number;
  dryRun: boolean;
  confirm: boolean;
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

function parseIntegerValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parsePromoteModelVersionArgs(
  argv: string[],
): PromoteModelVersionCliOptions {
  const options: PromoteModelVersionCliOptions = {
    dryRun: true,
    confirm: false,
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
      case "--feature-set-version": {
        const parsed = readFlagValue(argv, index);
        options.featureSetVersion = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--min-evaluated-games": {
        const parsed = readFlagValue(argv, index);
        options.minEvaluatedGames = parseIntegerValue(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--promote":
      case "--write":
        options.dryRun = false;
        break;
      case "--confirm":
        options.confirm = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function validatePromoteModelVersionOptions(
  options: PromoteModelVersionCliOptions,
): void {
  if (options.help) return;
  if (!options.modelName || !options.modelVersion || !options.featureSetVersion) {
    throw new Error(
      "--model-name, --model-version, and --feature-set-version are required.",
    );
  }
  if (!options.dryRun && !options.confirm) {
    throw new Error(
      "Refusing to promote model version without --confirm after previewing persisted evidence.",
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

export function summarizePromotionResult(
  result:
    | PreviewGamePredictionModelVersionPromotionResult
    | PromoteGamePredictionModelVersionResult,
  dryRun: boolean,
) {
  return {
    success: dryRun
      ? (result as PreviewGamePredictionModelVersionPromotionResult).wouldPromote
      : (result as PromoteGamePredictionModelVersionResult).promoted,
    dryRun,
    result,
  };
}

function usage(): string {
  return [
    "Usage:",
    "  npm run promote:game-prediction-model-version -- --model-name nhl_game_baseline_logistic --model-version candidate-v1 --feature-set-version game_features_v5_accuracy_candidates",
    "",
    "Promotion is blocked unless both --promote and --confirm are supplied after reviewing the preview.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parsePromoteModelVersionArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  validatePromoteModelVersionOptions(options);
  loadEnv();

  const client = supabaseClient();
  const args = {
    client,
    modelName: options.modelName!,
    modelVersion: options.modelVersion!,
    featureSetVersion: options.featureSetVersion!,
    minEvaluatedGames: options.minEvaluatedGames,
  };
  const result = options.dryRun
    ? await previewGamePredictionModelVersionPromotion(args)
    : await promoteGamePredictionModelVersion(args);

  const summary = summarizePromotionResult(result, options.dryRun);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.success) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

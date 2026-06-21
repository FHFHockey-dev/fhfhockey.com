import fs from "fs";
import path from "path";
import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Papa from "papaparse";

import {
  fetchAccuracyLoopExpectedMarketOddsGameIds,
  type AccuracyLoopExpectedMarketOddsGameIds,
  type AccuracyLoopExpectedMarketOddsGameWindow,
} from "lib/game-predictions/accountability";
import {
  importHistoricalMarketOddsSnapshots,
  type HistoricalMarketOddsImportRow,
} from "lib/game-predictions/espnOdds";
import type { Database, Json } from "lib/supabase/database-generated.types";

export type HistoricalMarketOddsImportManifest = {
  rows: HistoricalMarketOddsImportRow[];
  sourceFile?: {
    fileName: string;
    sha256: string;
    bytes: number;
    format: "csv" | "json";
  };
  expectedGameIds?: number[];
  expectedWindow?: Partial<AccuracyLoopExpectedMarketOddsGameWindow>;
  importedAt?: string;
  importBatchId?: string;
  dryRun?: boolean;
  allowPartialExpectedCoverage?: boolean;
};

export type HistoricalMarketOddsImportCliOptions = {
  file?: string;
  dryRun: boolean;
  confirmWrite: boolean;
  allowPartialExpectedCoverage?: boolean;
  printExpectedGames: boolean;
  importedAt?: string;
  importBatchId?: string;
  expectedGameIds?: number[];
  expectedWindow?: Partial<AccuracyLoopExpectedMarketOddsGameWindow>;
  help: boolean;
};

export type HistoricalMarketOddsExpectedGamesSummary = {
  success: true;
  dryRun: true;
  mode: "expected_games";
  expectedGameSource: "explicit_expected_game_ids" | "expected_window";
  expectedWindow: AccuracyLoopExpectedMarketOddsGameIds | null;
  expectedGameIds: number[];
  expectedGameCount: number;
  importContract: {
    requiredColumns: string[];
    optionalColumns: string[];
    guardrails: string[];
  };
};

const HISTORICAL_MARKET_ODDS_REQUIRED_COLUMNS = [
  "game_id",
  "provider",
  "captured_at",
  "source_url",
  "home_moneyline",
  "away_moneyline",
];

const HISTORICAL_MARKET_ODDS_OPTIONAL_COLUMNS = [
  "requested_date",
  "espn_game_id",
  "home_spread_line",
  "home_spread_odds",
  "away_spread_line",
  "away_spread_odds",
  "total_line",
  "over_odds",
  "under_odds",
  "source_payload",
  "metadata",
];

const HISTORICAL_MARKET_ODDS_GUARDRAILS = [
  "captured_at must be before the prediction cutoff and game start",
  "source_url must identify the historical odds source or archive",
  "current ESPN odds captures are rejected for historical training",
  "writes require --write and --confirm-write",
];

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

function parseIntegerList(value: string | undefined, minValue = 1): number[] | undefined {
  if (!value) return undefined;
  const values = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= minValue);
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

export function parseHistoricalMarketOddsImportArgs(
  argv: string[],
): HistoricalMarketOddsImportCliOptions {
  const options: HistoricalMarketOddsImportCliOptions = {
    dryRun: true,
    confirmWrite: false,
    printExpectedGames: false,
    help: false,
    expectedWindow: {},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const flag = arg.split("=")[0];

    switch (flag) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--file":
      case "-f": {
        const parsed = readFlagValue(argv, index);
        options.file = parsed.value;
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
      case "--allow-partial-expected-coverage":
        options.allowPartialExpectedCoverage = true;
        break;
      case "--print-expected-games":
        options.printExpectedGames = true;
        break;
      case "--imported-at": {
        const parsed = readFlagValue(argv, index);
        options.importedAt = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--import-batch-id": {
        const parsed = readFlagValue(argv, index);
        options.importBatchId = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--expected-game-ids": {
        const parsed = readFlagValue(argv, index);
        options.expectedGameIds = parseIntegerList(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--season-id": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          seasonId: parseIntegerValue(parsed.value),
        };
        index = parsed.nextIndex;
        break;
      }
      case "--game-type": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          gameType: parseIntegerValue(parsed.value),
        };
        index = parsed.nextIndex;
        break;
      }
      case "--train-start-date": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          trainStartDate: parsed.value,
        };
        index = parsed.nextIndex;
        break;
      }
      case "--blind-date": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          blindDate: parsed.value,
        };
        index = parsed.nextIndex;
        break;
      }
      case "--replay-end-date": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          replayEndDate: parsed.value,
        };
        index = parsed.nextIndex;
        break;
      }
      case "--analysis-end-date": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          analysisEndDate: parsed.value,
        };
        index = parsed.nextIndex;
        break;
      }
      case "--horizon-days": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          horizonDays: parseIntegerList(parsed.value, 0),
        };
        index = parsed.nextIndex;
        break;
      }
      case "--max-simulation-days": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          maxSimulationDays: parseIntegerValue(parsed.value),
        };
        index = parsed.nextIndex;
        break;
      }
      case "--max-training-games": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          maxTrainingGames: parseIntegerValue(parsed.value),
        };
        index = parsed.nextIndex;
        break;
      }
      case "--max-replay-games": {
        const parsed = readFlagValue(argv, index);
        options.expectedWindow = {
          ...options.expectedWindow,
          maxReplayGames: parseIntegerValue(parsed.value),
        };
        index = parsed.nextIndex;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (Object.keys(options.expectedWindow ?? {}).length === 0) {
    delete options.expectedWindow;
  }

  return options;
}

export function historicalMarketOddsImportContract(): HistoricalMarketOddsExpectedGamesSummary["importContract"] {
  return {
    requiredColumns: [...HISTORICAL_MARKET_ODDS_REQUIRED_COLUMNS],
    optionalColumns: [...HISTORICAL_MARKET_ODDS_OPTIONAL_COLUMNS],
    guardrails: [...HISTORICAL_MARKET_ODDS_GUARDRAILS],
  };
}

export function summarizeHistoricalMarketOddsExpectedGames(args: {
  expectedGameIds?: number[];
  expectedWindowResult?: AccuracyLoopExpectedMarketOddsGameIds | null;
}): HistoricalMarketOddsExpectedGamesSummary {
  const expectedGameIds = args.expectedGameIds?.length
    ? args.expectedGameIds
    : args.expectedWindowResult?.gameIds ?? [];

  return {
    success: true,
    dryRun: true,
    mode: "expected_games",
    expectedGameSource: args.expectedGameIds?.length
      ? "explicit_expected_game_ids"
      : "expected_window",
    expectedWindow: args.expectedWindowResult ?? null,
    expectedGameIds,
    expectedGameCount: expectedGameIds.length,
    importContract: historicalMarketOddsImportContract(),
  };
}

function stringField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numberField(row: Record<string, unknown>, keys: string[]): number | null {
  const value = stringField(row, keys);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function moneylineField(
  row: Record<string, unknown>,
  keys: string[],
): string | number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseJsonField(
  row: Record<string, unknown>,
  keys: string[],
): Json | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value == null || value === "") continue;
    if (typeof value === "string") {
      return JSON.parse(value) as Json;
    }
    return value as Json;
  }
  return undefined;
}

function normalizeImportRow(
  row: Record<string, unknown>,
  rowIndex: number,
): HistoricalMarketOddsImportRow {
  const gameId = numberField(row, ["gameId", "game_id", "game"]);
  const provider = stringField(row, ["provider", "sportsbook", "book"]);
  const capturedAt = stringField(row, [
    "capturedAt",
    "captured_at",
    "observedAt",
    "observed_at",
  ]);
  const sourceUrl = stringField(row, ["sourceUrl", "source_url", "url"]);
  const homeMoneyline = moneylineField(row, [
    "homeMoneyline",
    "home_moneyline",
    "homeMl",
    "home_ml",
  ]);
  const awayMoneyline = moneylineField(row, [
    "awayMoneyline",
    "away_moneyline",
    "awayMl",
    "away_ml",
  ]);

  if (!gameId) throw new Error(`Row ${rowIndex + 1} is missing gameId.`);
  if (!provider) throw new Error(`Row ${rowIndex + 1} is missing provider.`);
  if (!capturedAt) throw new Error(`Row ${rowIndex + 1} is missing capturedAt.`);
  if (!sourceUrl) throw new Error(`Row ${rowIndex + 1} is missing sourceUrl.`);

  return {
    gameId,
    provider,
    capturedAt,
    sourceUrl,
    homeMoneyline,
    awayMoneyline,
    requestedDate: stringField(row, ["requestedDate", "requested_date"]),
    espnGameId: stringField(row, ["espnGameId", "espn_game_id"]),
    homeSpreadLine: moneylineField(row, ["homeSpreadLine", "home_spread_line"]),
    homeSpreadOdds: moneylineField(row, ["homeSpreadOdds", "home_spread_odds"]),
    awaySpreadLine: moneylineField(row, ["awaySpreadLine", "away_spread_line"]),
    awaySpreadOdds: moneylineField(row, ["awaySpreadOdds", "away_spread_odds"]),
    totalLine: moneylineField(row, ["totalLine", "total_line"]),
    overOdds: moneylineField(row, ["overOdds", "over_odds"]),
    underOdds: moneylineField(row, ["underOdds", "under_odds"]),
    sourcePayload: parseJsonField(row, ["sourcePayload", "source_payload"]),
    metadata: parseJsonField(row, ["metadata"]),
  };
}

function normalizeRows(value: unknown): HistoricalMarketOddsImportRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Import file must contain a rows array or a top-level array.");
  }
  return value.map((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`Row ${index + 1} must be an object.`);
    }
    return normalizeImportRow(row as Record<string, unknown>, index);
  });
}

function parseExpectedWindow(value: unknown): Partial<AccuracyLoopExpectedMarketOddsGameWindow> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    seasonId: numberField(record, ["seasonId", "season_id"]) ?? undefined,
    gameType: numberField(record, ["gameType", "game_type"]) ?? undefined,
    trainStartDate:
      stringField(record, ["trainStartDate", "train_start_date"]) ?? undefined,
    blindDate: stringField(record, ["blindDate", "blind_date"]) ?? undefined,
    replayEndDate:
      stringField(record, ["replayEndDate", "replay_end_date"]) ?? undefined,
    analysisEndDate:
      stringField(record, ["analysisEndDate", "analysis_end_date"]) ??
      undefined,
    horizonDays: Array.isArray(record.horizonDays)
      ? record.horizonDays.filter(
          (item): item is number => Number.isInteger(item) && item >= 0,
        )
      : parseIntegerList(stringField(record, ["horizonDays", "horizon_days"]) ?? undefined, 0),
    maxSimulationDays:
      numberField(record, ["maxSimulationDays", "max_simulation_days"]) ??
      undefined,
    maxTrainingGames:
      numberField(record, ["maxTrainingGames", "max_training_games"]) ??
      undefined,
    maxReplayGames:
      numberField(record, ["maxReplayGames", "max_replay_games"]) ?? undefined,
  };
}

function compactExpectedWindow(
  value: Partial<AccuracyLoopExpectedMarketOddsGameWindow> | undefined,
): Partial<AccuracyLoopExpectedMarketOddsGameWindow> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue != null),
  ) as Partial<AccuracyLoopExpectedMarketOddsGameWindow>;
}

function sourceFileMetadata(content: string, filePath: string): HistoricalMarketOddsImportManifest["sourceFile"] {
  const extension = path.extname(filePath).toLowerCase();
  return {
    fileName: path.basename(filePath),
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content, "utf8"),
    format: extension === ".csv" ? "csv" : "json",
  };
}

export function parseHistoricalMarketOddsImportFileContent(
  content: string,
  filePath: string,
): HistoricalMarketOddsImportManifest {
  const extension = path.extname(filePath).toLowerCase();
  const sourceFile = sourceFileMetadata(content, filePath);
  if (extension === ".csv") {
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors.map((error) => error.message).join("; "));
    }
    return { rows: normalizeRows(parsed.data), sourceFile };
  }

  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    return { rows: normalizeRows(parsed), sourceFile };
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("JSON import file must be an array or object.");
  }

  const record = parsed as Record<string, unknown>;
  return {
    rows: normalizeRows(record.rows),
    sourceFile,
    expectedGameIds: Array.isArray(record.expectedGameIds)
      ? record.expectedGameIds.filter(
          (gameId): gameId is number => Number.isInteger(gameId) && gameId > 0,
        )
      : parseIntegerList(
          stringField(record, ["expectedGameIds", "expected_game_ids"]) ??
            undefined,
        ),
    expectedWindow: compactExpectedWindow(
      parseExpectedWindow(record.expectedWindow ?? record.expected_window),
    ),
    importedAt: stringField(record, ["importedAt", "imported_at"]) ?? undefined,
    importBatchId:
      stringField(record, ["importBatchId", "import_batch_id"]) ?? undefined,
    dryRun:
      typeof record.dryRun === "boolean"
        ? record.dryRun
        : typeof record.dry_run === "boolean"
          ? record.dry_run
          : undefined,
    allowPartialExpectedCoverage:
      typeof record.allowPartialExpectedCoverage === "boolean"
        ? record.allowPartialExpectedCoverage
        : typeof record.allow_partial_expected_coverage === "boolean"
          ? record.allow_partial_expected_coverage
          : undefined,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function attachHistoricalMarketOddsImportFileMetadata(
  rows: HistoricalMarketOddsImportRow[],
  sourceFile: HistoricalMarketOddsImportManifest["sourceFile"],
): HistoricalMarketOddsImportRow[] {
  if (!sourceFile) return rows;
  return rows.map((row) => ({
    ...row,
    metadata: {
      ...(isPlainRecord(row.metadata) ? row.metadata : {}),
      historical_market_odds_import_file: sourceFile,
    } as Json,
  }));
}

export function readHistoricalMarketOddsImportFile(
  filePath: string,
): HistoricalMarketOddsImportManifest {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  return parseHistoricalMarketOddsImportFileContent(
    fs.readFileSync(resolvedPath, "utf8"),
    resolvedPath,
  );
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
    "  npm run import:historical-market-odds -- --file odds.json --season-id 20252026 --blind-date 2026-01-15",
    "  npm run import:historical-market-odds -- --print-expected-games --season-id 20252026 --blind-date 2026-01-15",
    "",
    "Writes are blocked unless both --write and --confirm-write are supplied.",
    "Supported files: JSON array, JSON manifest object with rows, or CSV with header columns.",
    `Required columns: ${HISTORICAL_MARKET_ODDS_REQUIRED_COLUMNS.join(", ")}`,
  ].join("\n");
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseHistoricalMarketOddsImportArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.file && !options.printExpectedGames) {
    throw new Error("Missing required --file argument.");
  }

  const manifest = options.file
    ? readHistoricalMarketOddsImportFile(options.file)
    : null;
  const dryRun = options.printExpectedGames
    ? true
    : options.dryRun && manifest!.dryRun !== false;
  if (!dryRun && !options.confirmWrite) {
    throw new Error(
      "Refusing to write historical market odds without --confirm-write.",
    );
  }

  const expectedGameIds =
    options.expectedGameIds ?? manifest?.expectedGameIds ?? undefined;
  const expectedWindow = compactExpectedWindow({
    ...(manifest?.expectedWindow ?? {}),
    ...(options.expectedWindow ?? {}),
  });
  if (
    options.printExpectedGames &&
    !expectedGameIds?.length &&
    !expectedWindow?.seasonId
  ) {
    throw new Error(
      "--print-expected-games requires --expected-game-ids or --season-id with the accuracy-loop window options.",
    );
  }

  const needsSupabase = !expectedGameIds?.length && Boolean(expectedWindow?.seasonId);
  if (needsSupabase || !options.printExpectedGames) {
    loadEnv();
  }

  const client = needsSupabase || !options.printExpectedGames
    ? supabaseClient()
    : null;
  let expectedWindowResult: AccuracyLoopExpectedMarketOddsGameIds | null = null;
  if (!expectedGameIds?.length && expectedWindow?.seasonId) {
    expectedWindowResult = await fetchAccuracyLoopExpectedMarketOddsGameIds({
      client: client!,
      window: expectedWindow as AccuracyLoopExpectedMarketOddsGameWindow,
    });
  }

  if (options.printExpectedGames) {
    console.log(
      JSON.stringify(
        summarizeHistoricalMarketOddsExpectedGames({
          expectedGameIds,
          expectedWindowResult,
        }),
        null,
        2,
      ),
    );
    return;
  }

  const result = await importHistoricalMarketOddsSnapshots({
    client: client!,
    rows: attachHistoricalMarketOddsImportFileMetadata(
      manifest!.rows,
      manifest!.sourceFile,
    ),
    expectedGameIds: expectedGameIds ?? expectedWindowResult?.gameIds,
    importedAt: options.importedAt ?? manifest!.importedAt,
    importBatchId: options.importBatchId ?? manifest!.importBatchId,
    dryRun,
    allowIncompleteExpectedCoverage:
      options.allowPartialExpectedCoverage ??
      manifest!.allowPartialExpectedCoverage ??
      false,
  });

  console.log(
    JSON.stringify(
      {
        success: !result.blocked,
        dryRun: result.dryRun,
        expectedGameSource: expectedGameIds?.length
          ? "explicit_expected_game_ids"
          : expectedWindowResult
            ? "expected_window"
            : "none",
        expectedWindow: expectedWindowResult,
        result,
      },
      null,
      2,
    ),
  );

  if (result.blocked) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

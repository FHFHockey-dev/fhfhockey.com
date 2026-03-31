import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import { Client } from "pg";
import {
  compareLegacyAndNhlParitySamples,
  validateNormalizedEventBatchAgainstRawPayloads,
  type ParitySampleComparisonSummary,
  type NormalizedEventValidationSummary,
} from "../lib/supabase/Upserts/nhlXgValidation";
import { parseNhlPlayByPlayEvents } from "../lib/supabase/Upserts/nhlPlayByPlayParser";
import { buildShotFeatureRows } from "../lib/supabase/Upserts/nhlShotFeatureBuilder";
import { buildNstParityMetrics } from "../lib/supabase/Upserts/nhlNstParityMetrics";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DEFAULT_TRAINING_GAME_IDS = [
  2025021018,
  2025021103,
  2025021003,
  2025021119,
  2025021171,
  2025021140,
  2025020982,
  2025021172,
  2025021170,
  2025021169,
];

const DEFAULT_OVERLAP_GAME_IDS = [
  2025021018,
  2025021003,
  2025021119,
  2025021140,
  2025020982,
];

const SKATER_COUNT_KEYS = [
  "toi",
  "goals",
  "total_assists",
  "first_assists",
  "second_assists",
  "total_points",
  "shots",
  "icf",
  "iff",
  "pim",
  "total_penalties",
  "minor_penalties",
  "major_penalties",
  "misconduct_penalties",
  "penalties_drawn",
  "giveaways",
  "takeaways",
  "hits",
  "hits_taken",
  "shots_blocked",
  "faceoffs_won",
  "faceoffs_lost",
] as const;

const SKATER_OI_COUNT_KEYS = [
  "toi",
  "cf",
  "ca",
  "ff",
  "fa",
  "sf",
  "sa",
  "gf",
  "ga",
  "off_zone_starts",
  "neu_zone_starts",
  "def_zone_starts",
  "off_zone_faceoffs",
  "neu_zone_faceoffs",
  "def_zone_faceoffs",
  "shots_blocked",
] as const;

const GOALIE_COUNT_KEYS = ["shots_against", "saves", "goals_against"] as const;

type ValidationCliOptions = {
  environment: string;
  games: number[];
  overlapGames: number[];
  seasonStart: number | null;
  seasonEnd: number | null;
  parserVersion: number | null;
  strengthVersion: number | null;
  featureVersion: number | null;
  parityVersion: number | null;
  outputPath: string | null;
  manualAuditRef: string | null;
  approvedExceptionRefs: string[];
};

type DbConfig = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

type ValidationMetadata = {
  validationDate: string;
  environment: string;
  sampledGameIds: number[];
  overlapGameIds: number[];
  seasonRangeCovered: string;
  parserVersion: number | null;
  strengthVersion: number | null;
  featureVersion: number | null;
  parityVersion: number | null;
  sourceCodeCommitSha: string | null;
  manualAuditRef: string | null;
  approvedExceptionRefs: string[];
};

type ReleaseValidationReport = {
  metadata: ValidationMetadata;
  status: "pass" | "fail";
  rawValidationSummary: NormalizedEventValidationSummary;
  paritySummary: ParitySampleComparisonSummary | null;
  parityFamilyBreakdown: Record<string, number>;
  parityErrorsByMetric: Record<string, number>;
};

function printHelp(): void {
  console.log(`Usage: npm run validate:nhl-xg-release -- [options]

Options:
  --environment <name>        Validation environment label. Default: local
  --games <csv>               Raw-validation game ids. Default: sampled 10-game set
  --overlapGames <csv>        Legacy-overlap parity sample ids. Default: sampled 5-game set
  --seasonStart <season>      Start season id for metadata
  --seasonEnd <season>        End season id for metadata
  --parserVersion <n>         Parser version metadata
  --strengthVersion <n>       Strength version metadata
  --featureVersion <n>        Feature version metadata
  --parityVersion <n>         Parity version metadata
  --manualAuditRef <path>     Manual audit artifact path for metadata
  --approvedExceptionRefs <csv>
                              Artifact paths documenting approved exceptions
  --output <path>             Optional markdown output path
  --help                      Show this help
`);
}

function parseIntegerList(value: string | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function parseOptionalInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseCliArgs(argv: string[]): ValidationCliOptions {
  const options: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const withoutPrefix = token.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    const nextToken = argv[index + 1];
    const value =
      inlineValue ?? (nextToken && !nextToken.startsWith("--") ? nextToken : "true");

    options[key] = value;

    if (inlineValue == null && nextToken && !nextToken.startsWith("--")) {
      index += 1;
    }
  }

  if (options.help === "true") {
    printHelp();
    process.exit(0);
  }

  return {
    environment: options.environment ?? process.env.NODE_ENV ?? "local",
    games: parseIntegerList(options.games, DEFAULT_TRAINING_GAME_IDS),
    overlapGames: parseIntegerList(options.overlapGames, DEFAULT_OVERLAP_GAME_IDS),
    seasonStart: parseOptionalInteger(options.seasonStart),
    seasonEnd: parseOptionalInteger(options.seasonEnd),
    parserVersion: parseOptionalInteger(options.parserVersion),
    strengthVersion: parseOptionalInteger(options.strengthVersion),
    featureVersion: parseOptionalInteger(options.featureVersion),
    parityVersion: parseOptionalInteger(options.parityVersion),
    outputPath: options.output ?? null,
    manualAuditRef: options.manualAuditRef ?? null,
    approvedExceptionRefs: options.approvedExceptionRefs
      ? options.approvedExceptionRefs
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
  };
}

function readDbConfigFromEnv(): DbConfig {
  const rawUrl = process.env.SUPABASE_DB_URL;

  if (!rawUrl) {
    throw new Error(
      "Missing SUPABASE_DB_URL. Expected it in web/.env.local for the release-validation runner."
    );
  }

  const withoutPrefix = rawUrl.replace(/^postgresql:\/\//, "");
  const atIndex = withoutPrefix.lastIndexOf("@");

  if (atIndex === -1) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing credential delimiter.");
  }

  const creds = withoutPrefix.slice(0, atIndex);
  const hostPart = withoutPrefix.slice(atIndex + 1);
  const colonIndex = creds.indexOf(":");

  if (colonIndex === -1) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing password delimiter.");
  }

  const user = creds.slice(0, colonIndex);
  const password = creds.slice(colonIndex + 1);
  const hostMatch = hostPart.match(/^([^:]+):(\d+)\/([^?]+)(\?.*)?$/);

  if (!hostMatch) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing host, port, or database.");
  }

  const [, host, port, database] = hostMatch;

  return {
    user,
    password,
    host,
    port: Number(port),
    database,
  };
}

function getCommitSha(repoRoot: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function normalizeDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function pick(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

function buildSeasonRangeLabel(start: number | null, end: number | null): string {
  if (start == null && end == null) return "unspecified";
  if (start != null && end != null && start === end) return String(start);
  return `${start ?? "unspecified"}-${end ?? "unspecified"}`;
}

async function fetchRows<T extends Record<string, unknown>>(
  client: Client,
  query: string,
  params: unknown[]
): Promise<T[]> {
  const result = await client.query(query, params);
  return result.rows as T[];
}

function summarizeParityErrorsByMetric(summary: ParitySampleComparisonSummary | null): Record<string, number> {
  if (!summary) return {};

  const counts: Record<string, number> = {};

  for (const result of summary.results) {
    for (const mismatch of result.mismatches) {
      if (mismatch.severity !== "error") continue;
      counts[mismatch.metric] = (counts[mismatch.metric] ?? 0) + 1;
    }
  }

  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function buildMarkdownReport(report: ReleaseValidationReport): string {
  const {
    metadata,
    status,
    rawValidationSummary,
    paritySummary,
    parityFamilyBreakdown,
    parityErrorsByMetric,
  } = report;

  const passedLines = [
    `Raw validation games passed: \`${rawValidationSummary.passedGames}/${rawValidationSummary.totalGames}\``,
  ];

  if (paritySummary) {
    passedLines.push(
      `Parity samples evaluated: \`${paritySummary.totalSamples}\``
    );
  }

  const failedLines: string[] = [];

  if (rawValidationSummary.failedGames > 0) {
    failedLines.push(
      `Raw validation failed for game ids: \`${rawValidationSummary.failedGameIds.join(", ")}\``
    );
  }

  if (paritySummary && paritySummary.failedSamples > 0) {
    failedLines.push(
      `Parity failed samples: \`${paritySummary.failedSamples}/${paritySummary.totalSamples}\``
    );
    failedLines.push(
      `Parity family breakdown: \`${JSON.stringify(parityFamilyBreakdown)}\``
    );
    failedLines.push(
      `Top exact mismatch metrics: \`${JSON.stringify(parityErrorsByMetric)}\``
    );
  }

  if (!failedLines.length) {
    failedLines.push("- none");
  }

  const approvedExceptions =
    metadata.approvedExceptionRefs.length > 0
      ? metadata.approvedExceptionRefs.map((ref) => `- \`${ref}\``)
      : ["- none recorded in this run"];

  const nextActions =
    status === "pass"
      ? ["- proceed to release-gate review using this artifact"]
      : ["- review failed sections and approved-exception coverage before release-gate review"];

  return `# Validation Run

- Date: ${metadata.validationDate}
- Environment: ${metadata.environment}
- Commit: ${metadata.sourceCodeCommitSha ?? "unknown"}
- Parser version: ${metadata.parserVersion ?? "unspecified"}
- Strength version: ${metadata.strengthVersion ?? "unspecified"}
- Feature version: ${metadata.featureVersion ?? "unspecified"}
- Parity version: ${metadata.parityVersion ?? "unspecified"}
- Games sampled: ${metadata.sampledGameIds.join(", ")}
- Result: ${status.toUpperCase()}

## Validation Metadata

- Overlap games: ${metadata.overlapGameIds.join(", ")}
- Season range covered: ${metadata.seasonRangeCovered}
- Manual audit reference: ${metadata.manualAuditRef ?? "none"}

## Passed

${passedLines.map((line) => `- ${line}`).join("\n")}

## Failed

${failedLines.map((line) => (line.startsWith("-") ? line : `- ${line}`)).join("\n")}

## Approved Exceptions

${approvedExceptions.join("\n")}

## Next Actions

${nextActions.join("\n")}
`;
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const repoRoot = path.resolve(process.cwd(), "..");
  const dbConfig = readDbConfigFromEnv();

  const client = new Client({
    ...dbConfig,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const rawRows = await fetchRows<{
      game_id: number | string;
      payload_hash: string;
      payload: Record<string, unknown>;
    }>(
      client,
      `select game_id, payload_hash, payload
       from public.nhl_api_game_payloads_raw
       where game_id = any($1::bigint[])
         and endpoint = 'play-by-play'
       order by game_id, fetched_at desc`,
      [options.games]
    );

    const latestRawByGame = new Map<number, { payload_hash: string; payload: Record<string, unknown> }>();

    for (const row of rawRows) {
      const gameId = Number(row.game_id);
      if (!latestRawByGame.has(gameId)) {
        latestRawByGame.set(gameId, {
          payload_hash: row.payload_hash,
          payload: row.payload,
        });
      }
    }

    const normalizedRows = await fetchRows<Record<string, unknown>>(
      client,
      `select *
       from public.nhl_api_pbp_events
       where game_id = any($1::bigint[])
       order by game_id, sort_order nulls last, event_id`,
      [options.games]
    );

    const normalizedByGame = new Map<number, Record<string, unknown>[]>();

    for (const row of normalizedRows) {
      const gameId = Number(row.game_id);
      const current = normalizedByGame.get(gameId) ?? [];
      current.push(row);
      normalizedByGame.set(gameId, current);
    }

    const rawValidationSummary = validateNormalizedEventBatchAgainstRawPayloads(
      options.games.map((gameId) => ({
        rawPayload: latestRawByGame.get(gameId)?.payload ?? null,
        normalizedEvents: normalizedByGame.get(gameId) ?? [],
      }))
    );

    let paritySummary: ParitySampleComparisonSummary | null = null;
    let parityFamilyBreakdown: Record<string, number> = {};

    if (options.overlapGames.length > 0) {
      const games = await fetchRows<{
        id: number | string;
        date: string | Date;
        homeTeamId: number | string;
        awayTeamId: number | string;
        seasonId: number | string;
      }>(
        client,
        `select id, date, "homeTeamId", "awayTeamId", "seasonId"
         from public.games
         where id = any($1::bigint[])
         order by id`,
        [options.overlapGames]
      );

      const parityRows: Array<{
        family: string;
        entityType: "skater" | "goalie" | "team";
        entityId: number;
        sampleKey: string;
        legacyRow: Record<string, unknown>;
        newRow: Record<string, unknown>;
      }> = [];

      for (const game of games) {
        const gameId = Number(game.id);
        const raw = latestRawByGame.get(gameId);
        if (!raw) continue;

        const dateOnly = normalizeDateOnly(game.date);
        const homeTeamId = Number(game.homeTeamId);
        const awayTeamId = Number(game.awayTeamId);
        const season = Number(game.seasonId);

        const shiftRows = await fetchRows<Record<string, unknown>>(
          client,
          `select *
           from public.nhl_api_shift_rows
           where game_id = $1
           order by period nulls last, start_seconds nulls last, shift_id`,
          [gameId]
        );

        const parsedEvents = parseNhlPlayByPlayEvents(raw.payload, {
          sourcePlayByPlayHash: raw.payload_hash,
          now: new Date().toISOString(),
        });

        const shotFeatures = buildShotFeatureRows(
          parsedEvents,
          shiftRows,
          homeTeamId,
          awayTeamId
        );

        const parity = buildNstParityMetrics(parsedEvents, shotFeatures, shiftRows, {
          date: dateOnly,
          season,
          homeTeamId,
          awayTeamId,
        });

        const skaterIds = parity.skaters.all.counts.map((row) => Number(row.player_id));
        const goalieIds = parity.goalies.all.counts.map((row) => Number(row.player_id));

        const legacySkaterCounts = await fetchRows<Record<string, unknown>>(
          client,
          `select *
           from public.nst_gamelog_as_counts
           where date_scraped = $1
             and player_id = any($2::bigint[])`,
          [dateOnly, skaterIds]
        );

        const legacySkaterOiCounts = await fetchRows<Record<string, unknown>>(
          client,
          `select *
           from public.nst_gamelog_as_counts_oi
           where date_scraped = $1
             and player_id = any($2::bigint[])`,
          [dateOnly, skaterIds]
        );

        const legacyGoalieCounts = await fetchRows<Record<string, unknown>>(
          client,
          `select *
           from public.nst_gamelog_goalie_all_counts
           where date_scraped = $1
             and player_id = any($2::bigint[])`,
          [dateOnly, goalieIds]
        );

        const newSkaterCountsByPlayer = new Map(
          parity.skaters.all.counts.map((row) => [Number(row.player_id), row as Record<string, unknown>])
        );
        const newSkaterOiCountsByPlayer = new Map(
          parity.skaters.all.countsOi.map((row) => [Number(row.player_id), row as Record<string, unknown>])
        );
        const newGoalieCountsByPlayer = new Map(
          parity.goalies.all.counts.map((row) => [Number(row.player_id), row as Record<string, unknown>])
        );

        for (const legacyRow of legacySkaterCounts) {
          const playerId = Number(legacyRow.player_id);
          const newRow = newSkaterCountsByPlayer.get(playerId);
          if (!newRow) continue;

          parityRows.push({
            family: "nst_gamelog_as_counts",
            entityType: "skater",
            entityId: playerId,
            sampleKey: `${gameId}:${dateOnly}`,
            legacyRow: pick(legacyRow, SKATER_COUNT_KEYS),
            newRow: pick(newRow, SKATER_COUNT_KEYS),
          });
        }

        for (const legacyRow of legacySkaterOiCounts) {
          const playerId = Number(legacyRow.player_id);
          const newRow = newSkaterOiCountsByPlayer.get(playerId);
          if (!newRow) continue;

          parityRows.push({
            family: "nst_gamelog_as_counts_oi",
            entityType: "skater",
            entityId: playerId,
            sampleKey: `${gameId}:${dateOnly}`,
            legacyRow: pick(legacyRow, SKATER_OI_COUNT_KEYS),
            newRow: pick(newRow, SKATER_OI_COUNT_KEYS),
          });
        }

        for (const legacyRow of legacyGoalieCounts) {
          const playerId = Number(legacyRow.player_id);
          const newRow = newGoalieCountsByPlayer.get(playerId);
          if (!newRow) continue;

          parityRows.push({
            family: "nst_gamelog_goalie_all_counts",
            entityType: "goalie",
            entityId: playerId,
            sampleKey: `${gameId}:${dateOnly}`,
            legacyRow: pick(legacyRow, GOALIE_COUNT_KEYS),
            newRow: pick(newRow, GOALIE_COUNT_KEYS),
          });
        }
      }

      paritySummary = compareLegacyAndNhlParitySamples(parityRows);
      parityFamilyBreakdown = parityRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.family] = (acc[row.family] ?? 0) + 1;
        return acc;
      }, {});
    }

    const report: ReleaseValidationReport = {
      metadata: {
        validationDate: new Date().toISOString(),
        environment: options.environment,
        sampledGameIds: options.games,
        overlapGameIds: options.overlapGames,
        seasonRangeCovered: buildSeasonRangeLabel(options.seasonStart, options.seasonEnd),
        parserVersion: options.parserVersion,
        strengthVersion: options.strengthVersion,
        featureVersion: options.featureVersion,
        parityVersion: options.parityVersion,
        sourceCodeCommitSha: getCommitSha(repoRoot),
        manualAuditRef: options.manualAuditRef,
        approvedExceptionRefs: options.approvedExceptionRefs,
      },
      status:
        rawValidationSummary.failedGames === 0 &&
        (paritySummary == null || paritySummary.failedSamples === 0)
          ? "pass"
          : "fail",
      rawValidationSummary,
      paritySummary,
      parityFamilyBreakdown,
      parityErrorsByMetric: summarizeParityErrorsByMetric(paritySummary),
    };

    const markdown = buildMarkdownReport(report);

    if (options.outputPath) {
      const resolvedPath = path.isAbsolute(options.outputPath)
        ? options.outputPath
        : path.resolve(process.cwd(), options.outputPath);
      fs.writeFileSync(resolvedPath, markdown, "utf8");
      console.log(`Wrote validation report to ${resolvedPath}`);
    } else {
      console.log(markdown);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

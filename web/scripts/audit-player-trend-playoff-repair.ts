import { createHash } from "crypto";
import path from "path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "lib/supabase/database-generated.types";
import {
  PLAYER_TREND_CALCULATION_VERSION,
  SKATER_TREND_REQUIRED_COLUMNS,
  buildPlayerTrendRecords,
  normalizePlayoffSkaterTrendRow,
  type TrendRecord,
} from "lib/trends/playerTrendCalculator";

const DEFAULT_SEASON_ID = 20252026;
const DEFAULT_START_DATE = "2026-04-18";
const DEFAULT_END_DATE = "2026-06-14";
const PAGE_SIZE = 1000;
const PLAYER_CHUNK_SIZE = 75;

type RegularRow = Database["public"]["Views"]["player_stats_unified"]["Row"];
type PlayoffRow =
  Database["public"]["Tables"]["wgo_skater_stats_playoffs"]["Row"];
type PersistedRow = Omit<TrendRecord, "metric_type"> & {
  metric_type: string;
};

const VALUE_FIELDS = [
  "raw_value",
  "average_value",
  "rolling_avg_3",
  "rolling_avg_5",
  "rolling_avg_10",
  "variance_value",
  "std_dev_value",
  "sample_size",
] as const;

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

function parseArgs(argv: string[]) {
  const readValue = (name: string) => {
    const direct = argv.find((arg) => arg.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const seasonId = Number(readValue("--season") ?? DEFAULT_SEASON_ID);
  const startDate = readValue("--start") ?? DEFAULT_START_DATE;
  const endDate = readValue("--end") ?? DEFAULT_END_DATE;
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new Error("--season must be a positive integer.");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    startDate > endDate
  ) {
    throw new Error("--start and --end must be an ordered YYYY-MM-DD range.");
  }
  return { seasonId, startDate, endDate };
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchPlayoffRows(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  startDate: string;
  endDate: string;
}): Promise<PlayoffRow[]> {
  const rows: PlayoffRow[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await args.client
      .from("wgo_skater_stats_playoffs")
      .select("*")
      .eq("season_id", args.seasonId)
      .gte("date", args.startDate)
      .lte("date", args.endDate)
      .order("player_id", { ascending: true })
      .order("date", { ascending: true })
      .order("game_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchRegularHistory(args: {
  client: SupabaseClient<Database>;
  playerIds: number[];
  seasonId: number;
  seasonStart: string;
  throughDate: string;
}): Promise<RegularRow[]> {
  const rows: RegularRow[] = [];
  for (const playerIds of chunk(args.playerIds, PLAYER_CHUNK_SIZE)) {
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await args.client
        .from("player_stats_unified")
        .select(SKATER_TREND_REQUIRED_COLUMNS.join(","))
        .eq("season_id", args.seasonId)
        .in("player_id", playerIds)
        .gte("date", args.seasonStart)
        .lte("date", args.throughDate)
        .order("player_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
        .returns<RegularRow[]>();
      if (error) throw error;
      const pageRows = data ?? [];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function fetchPersistedRows(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  startDate: string;
  endDate: string;
}): Promise<PersistedRow[]> {
  const rows: PersistedRow[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await args.client
      .from("player_trend_metrics")
      .select(
        "player_id,season_id,game_date,position_code,metric_type,metric_key,metric_label,raw_value,average_value,rolling_avg_3,rolling_avg_5,rolling_avg_10,variance_value,std_dev_value,sample_size",
      )
      .eq("season_id", args.seasonId)
      .eq("metric_type", "skater")
      .gte("game_date", args.startDate)
      .lte("game_date", args.endDate)
      .order("player_id", { ascending: true })
      .order("game_date", { ascending: true })
      .order("metric_key", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<PersistedRow[]>();
    if (error) throw error;
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

function identity(
  row: Pick<PersistedRow, "player_id" | "game_date" | "metric_key">,
): string {
  return `${row.player_id}:${row.game_date}:${row.metric_key}`;
}

function numericEqual(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return left === right;
  return Math.abs(Number(left) - Number(right)) <= 1e-9;
}

function stableHash(rows: PersistedRow[]): string {
  const payload = [...rows]
    .sort((left, right) => identity(left).localeCompare(identity(right)))
    .map((row) =>
      JSON.stringify(
        Object.fromEntries([
          ["identity", identity(row)],
          ...VALUE_FIELDS.map((field) => [field, row[field]]),
        ]),
      ),
    )
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

function deduplicateRows(rows: PersistedRow[]) {
  const byIdentity = new Map<string, PersistedRow>();
  for (const row of rows) byIdentity.set(identity(row), row);
  return {
    rows: [...byIdentity.values()],
    duplicateRows: rows.length - byIdentity.size,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const { seasonId, startDate, endDate } = parseArgs(process.argv.slice(2));
  const client = createSupabaseClient();

  const [{ data: season, error: seasonError }, playoffRows, persistedRows] =
    await Promise.all([
      client.from("seasons").select("id,startDate").eq("id", seasonId).single(),
      fetchPlayoffRows({ client, seasonId, startDate, endDate }),
      fetchPersistedRows({ client, seasonId, startDate, endDate }),
    ]);
  if (seasonError) throw seasonError;

  const playerIds = [...new Set(playoffRows.map((row) => row.player_id))].sort(
    (left, right) => left - right,
  );
  const regularRows = await fetchRegularHistory({
    client,
    playerIds,
    seasonId,
    seasonStart: season.startDate.slice(0, 10),
    throughDate: endDate,
  });
  const normalizedPlayoffRows = playoffRows.map(normalizePlayoffSkaterTrendRow);
  const builtRows = buildPlayerTrendRecords(
    [...regularRows, ...normalizedPlayoffRows],
    { emitFromDate: startDate },
  )
    .filter(
      (row) =>
        row.metric_type === "skater" &&
        row.game_date >= startDate &&
        row.game_date <= endDate,
    )
    .map((row) => row as PersistedRow);
  const candidate = deduplicateRows(builtRows);
  const persisted = deduplicateRows(persistedRows);
  const persistedByIdentity = new Map(
    persisted.rows.map((row) => [identity(row), row]),
  );
  const candidateByIdentity = new Map(
    candidate.rows.map((row) => [identity(row), row]),
  );
  const changedByField = Object.fromEntries(
    VALUE_FIELDS.map((field) => [field, 0]),
  ) as Record<(typeof VALUE_FIELDS)[number], number>;
  let updates = 0;
  let repairedSixtyTimesLowShots = 0;
  for (const [key, candidateRow] of candidateByIdentity) {
    const existing = persistedByIdentity.get(key);
    if (!existing) continue;
    let changed = false;
    for (const field of VALUE_FIELDS) {
      if (!numericEqual(existing[field], candidateRow[field])) {
        changedByField[field] += 1;
        changed = true;
      }
    }
    if (changed) updates += 1;
    if (
      candidateRow.metric_key === "shots_per_60" &&
      existing.raw_value != null &&
      existing.raw_value > 0 &&
      candidateRow.raw_value != null &&
      Math.abs(candidateRow.raw_value / existing.raw_value - 60) <= 0.001
    ) {
      repairedSixtyTimesLowShots += 1;
    }
  }
  const inserts = [...candidateByIdentity.keys()].filter(
    (key) => !persistedByIdentity.has(key),
  ).length;
  const deletes = [...persistedByIdentity.keys()].filter(
    (key) => !candidateByIdentity.has(key),
  ).length;
  const comparableCandidate = candidate.rows.filter((row) =>
    persistedByIdentity.has(identity(row)),
  );
  const comparablePersisted = persisted.rows.filter((row) =>
    candidateByIdentity.has(identity(row)),
  );
  const candidatePlayerDates = new Set(
    candidate.rows.map((row) => `${row.player_id}:${row.game_date}`),
  );
  const persistedPlayerDates = new Set(
    persisted.rows.map((row) => `${row.player_id}:${row.game_date}`),
  );

  console.log(
    JSON.stringify(
      {
        audit: "player_trend_playoff_bounded_repair_v1",
        persistenceApplied: false,
        calculationVersion: PLAYER_TREND_CALCULATION_VERSION,
        seasonId,
        sourceHistoryStart: season.startDate.slice(0, 10),
        outputRange: { startDate, endDate },
        source: {
          regularRows: regularRows.length,
          playoffRows: playoffRows.length,
          normalizedPlayoffRows: normalizedPlayoffRows.length,
          players: playerIds.length,
          playoffPlayerDates: new Set(
            playoffRows.map((row) => `${row.player_id}:${row.date}`),
          ).size,
        },
        output: {
          builtRows: builtRows.length,
          candidateRows: candidate.rows.length,
          persistedRows: persisted.rows.length,
          candidateDuplicateRows: candidate.duplicateRows,
          persistedDuplicateRows: persisted.duplicateRows,
          candidatePlayerDates: candidatePlayerDates.size,
          persistedPlayerDates: persistedPlayerDates.size,
          sourceBackedMissingPlayerDates: [...candidatePlayerDates].filter(
            (key) => !persistedPlayerDates.has(key),
          ).length,
        },
        delta: {
          inserts,
          updates,
          unchanged: comparableCandidate.length - updates,
          deletes,
          repairedSixtyTimesLowShots,
          changedByField,
        },
        receipts: {
          persistedPayloadSha256: stableHash(persisted.rows),
          candidatePayloadSha256: stableHash(candidate.rows),
          persistedComparablePayloadSha256: stableHash(comparablePersisted),
          candidateComparablePayloadSha256: stableHash(comparableCandidate),
        },
        repairBoundary:
          "Read full selected-season history, normalize playoff TOI seconds to minutes, and exact-replace only the approved playoff output identities. Preserve all unrelated dates and never infer missing historical identities without separate approval.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

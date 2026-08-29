import { createHash } from "crypto";
import path from "path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "lib/supabase/database-generated.types";
import {
  PLAYER_TREND_CALCULATION_VERSION,
  buildPlayerTrendRecords,
} from "lib/trends/playerTrendCalculator";

const DEFAULT_SEASON_ID = 20252026;
const DEFAULT_DATE = "2026-02-05";
const PAGE_SIZE = 1000;
const PLAYER_CHUNK_SIZE = 100;

type SourceRow = {
  player_id: number;
  date: string;
  season_id: number | null;
  position_code: string | null;
  nst_ixg: number | null;
  nst_iff: number | null;
};

type PersistedRow = {
  player_id: number;
  season_id: number | null;
  game_date: string;
  position_code: string | null;
  metric_type: string;
  metric_key: string;
  metric_label: string;
  raw_value: number | null;
  average_value: number | null;
  rolling_avg_3: number | null;
  rolling_avg_5: number | null;
  rolling_avg_10: number | null;
  variance_value: number | null;
  std_dev_value: number | null;
  sample_size: number;
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
  const date = readValue("--date") ?? DEFAULT_DATE;
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new Error("--season must be a positive integer.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }
  return { seasonId, date };
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchSourceRows(args: {
  client: SupabaseClient<Database>;
  playerIds: number[];
  seasonId: number;
  seasonStart: string;
  throughDate: string;
}): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  for (const playerIds of chunk(args.playerIds, PLAYER_CHUNK_SIZE)) {
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await args.client
        .from("player_stats_unified")
        .select("player_id,date,season_id,position_code,nst_ixg,nst_iff")
        .eq("season_id", args.seasonId)
        .in("player_id", playerIds)
        .gte("date", args.seasonStart)
        .lte("date", args.throughDate)
        .order("player_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const pageRows = (data ?? []) as SourceRow[];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

function identity(
  row: Pick<PersistedRow, "player_id" | "game_date" | "metric_key">,
) {
  return `${row.player_id}:${row.game_date}:${row.metric_key}`;
}

function numericEqual(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return left === right;
  return Math.abs(Number(left) - Number(right)) <= 1e-9;
}

function stableHash(rows: PersistedRow[]): string {
  const serialized = [...rows]
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
  return createHash("sha256").update(serialized).digest("hex");
}

async function main(): Promise<void> {
  loadEnv();
  const { seasonId, date } = parseArgs(process.argv.slice(2));
  const client = createSupabaseClient();

  const [
    { data: season, error: seasonError },
    { data: persisted, error: persistedError },
  ] = await Promise.all([
    client.from("seasons").select("id,startDate").eq("id", seasonId).single(),
    client
      .from("player_trend_metrics")
      .select(
        "player_id,season_id,game_date,position_code,metric_type,metric_key,metric_label,raw_value,average_value,rolling_avg_3,rolling_avg_5,rolling_avg_10,variance_value,std_dev_value,sample_size",
      )
      .eq("season_id", seasonId)
      .eq("game_date", date)
      .eq("metric_key", "expected_shooting_pct")
      .order("player_id", { ascending: true })
      .range(0, 999),
  ]);
  if (seasonError) throw seasonError;
  if (persistedError) throw persistedError;

  const persistedRows = (persisted ?? []) as PersistedRow[];
  if (persistedRows.length === 1000) {
    throw new Error("Persisted target reached its 1,000-row safety bound.");
  }
  const playerIds = [...new Set(persistedRows.map((row) => row.player_id))];
  const sourceRows = await fetchSourceRows({
    client,
    playerIds,
    seasonId,
    seasonStart: season.startDate.slice(0, 10),
    throughDate: date,
  });

  const sourceRowsByPlayer = new Map<number, SourceRow[]>();
  for (const row of sourceRows) {
    const existing = sourceRowsByPlayer.get(row.player_id) ?? [];
    existing.push(row);
    sourceRowsByPlayer.set(row.player_id, existing);
  }
  const candidateRows = [...sourceRowsByPlayer.values()].flatMap((rows) =>
    buildPlayerTrendRecords(rows as never[], { emitFromDate: date })
      .filter(
        (row) =>
          row.game_date === date && row.metric_key === "expected_shooting_pct",
      )
      .map((row) => row as PersistedRow),
  );

  const persistedByIdentity = new Map(
    persistedRows.map((row) => [identity(row), row]),
  );
  const candidateByIdentity = new Map(
    candidateRows.map((row) => [identity(row), row]),
  );
  const changedByField = Object.fromEntries(
    VALUE_FIELDS.map((field) => [field, 0]),
  ) as Record<(typeof VALUE_FIELDS)[number], number>;
  let updates = 0;
  for (const [key, candidate] of candidateByIdentity) {
    const existing = persistedByIdentity.get(key);
    if (!existing) continue;
    let changed = false;
    for (const field of VALUE_FIELDS) {
      if (!numericEqual(existing[field], candidate[field])) {
        changedByField[field] += 1;
        changed = true;
      }
    }
    if (changed) updates += 1;
  }
  const inserts = [...candidateByIdentity.keys()].filter(
    (key) => !persistedByIdentity.has(key),
  ).length;
  const deletes = [...persistedByIdentity.keys()].filter(
    (key) => !candidateByIdentity.has(key),
  ).length;

  console.log(
    JSON.stringify(
      {
        audit: "expected_shooting_pct_bounded_repair_v1",
        persistenceApplied: false,
        calculationVersion: PLAYER_TREND_CALCULATION_VERSION,
        seasonId,
        targetDate: date,
        sourceHistoryStart: season.startDate.slice(0, 10),
        sourceRows: sourceRows.length,
        players: playerIds.length,
        persistedRows: persistedRows.length,
        candidateRows: candidateRows.length,
        delta: {
          inserts,
          updates,
          unchanged: candidateRows.length - inserts - updates,
          deletes,
          changedByField,
        },
        receipts: {
          persistedPayloadSha256: stableHash(persistedRows),
          candidatePayloadSha256: stableHash(candidateRows),
        },
        formula: "nst_ixg / nst_iff * 100",
        repairBoundary:
          "Replace only expected_shooting_pct identities for the approved date after reading full season history; preserve every other metric key.",
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

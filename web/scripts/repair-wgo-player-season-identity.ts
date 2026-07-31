import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  SKATER_TREND_REQUIRED_COLUMNS,
  buildPlayerTrendRecords,
} from "lib/trends/playerTrendCalculator";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: "../.env.local" });

const BAD_SEASON = 20242025;
const TARGET_SEASON = 20222023;
const BAD_START = "2023-04-01";
const BAD_END = "2023-04-06";
const EXPECTED_SOURCE_ROWS = 1905;
const EXPECTED_TREND_ROWS = 49410;
const EXPECTED_PLAYER_DATES = 1830;
const EXPECTED_METRIC_KEYS = 27;
const EXPECTED_SOURCE_MANIFEST_MD5 = "23394878da4315e9013533d460815b0a";
const EXPECTED_TREND_IDENTITY_MD5 = "cd94410ea3f8851b8d3155c9cb2299f1";
const REPAIR_TIMESTAMP = "2026-07-31T00:00:00.000Z";
const PAGE_SIZE = 1000;
const PLAYER_CHUNK_SIZE = 100;
const STAGE_CHUNK_SIZE = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnifiedRow = Database["public"]["Views"]["player_stats_unified"]["Row"];
type TrendRow = Database["public"]["Tables"]["player_trend_metrics"]["Row"];
type RepairTrendRow = Omit<TrendRow, "updated_at"> & { updated_at: string };
type WgoManifestRow = Pick<
  Database["public"]["Tables"]["wgo_skater_stats"]["Row"],
  "id" | "player_id" | "date"
>;

type RepairMode = "dry-run" | "execute" | "rollback";

type Arguments = {
  mode: RepairMode;
  forwardOperationId?: string;
  inverseOperationId?: string;
};

function parseArguments(argv: string[]): Arguments {
  const readValue = (prefix: string) =>
    argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const execute = argv.includes("--execute");
  const rollback = argv.includes("--rollback");

  if (execute && rollback) {
    throw new Error("Choose either --execute or --rollback.");
  }

  const args: Arguments = {
    mode: rollback ? "rollback" : execute ? "execute" : "dry-run",
    forwardOperationId: readValue("--forward-operation="),
    inverseOperationId: readValue("--inverse-operation="),
  };

  for (const [name, value] of [
    ["forward operation", args.forwardOperationId],
    ["inverse operation", args.inverseOperationId],
  ] as const) {
    if (value && !UUID_PATTERN.test(value)) {
      throw new Error(`${name} must be a UUID.`);
    }
  }

  if (
    args.mode === "execute" &&
    (!args.forwardOperationId || !args.inverseOperationId)
  ) {
    throw new Error(
      "--execute requires --forward-operation=<uuid> and --inverse-operation=<uuid>.",
    );
  }
  if (args.mode === "rollback" && !args.inverseOperationId) {
    throw new Error("--rollback requires --inverse-operation=<uuid>.");
  }

  return args;
}

function stableIdentity(row: {
  player_id: number;
  game_date: string;
  metric_key: string;
}) {
  return `${row.player_id}:${row.game_date}:${row.metric_key}`;
}

function digest(algorithm: "md5" | "sha256", value: string) {
  return createHash(algorithm).update(value).digest("hex");
}

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function fetchPaged<T>(
  createQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { code?: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await createQuery(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Supabase read failed (${error.code ?? "unknown"}).`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function stageRows({
  client,
  operationId,
  direction,
  rows,
}: {
  client: ReturnType<typeof createServiceClient>;
  operationId: string;
  direction: "forward" | "inverse";
  rows: RepairTrendRow[];
}) {
  let staged = 0;
  let changed = 0;
  for (const batch of chunk(rows, STAGE_CHUNK_SIZE)) {
    const { data, error } = await client.rpc(
      "stage_wgo_player_season_repair_trends",
      {
        p_operation_id: operationId,
        p_direction: direction,
        p_rows: batch as unknown as Json,
      },
    );
    if (error) {
      throw new Error(
        `Trend staging failed (${error.code ?? "unknown"}, ${direction}).`,
      );
    }
    const receipt = data as {
      totalStagedRows?: number;
      chunkRowsChanged?: number;
    };
    staged = Number(receipt.totalStagedRows ?? 0);
    changed += Number(receipt.chunkRowsChanged ?? 0);
  }
  return { staged, changed };
}

async function finalize({
  client,
  operationId,
  direction,
}: {
  client: ReturnType<typeof createServiceClient>;
  operationId: string;
  direction: "forward" | "inverse";
}) {
  const { data, error } = await client.rpc(
    "repair_wgo_player_season_identity",
    {
      p_operation_id: operationId,
      p_direction: direction,
      p_expected_source_manifest_md5: EXPECTED_SOURCE_MANIFEST_MD5,
      p_expected_trend_identity_md5: EXPECTED_TREND_IDENTITY_MD5,
    },
  );
  if (error) {
    throw new Error(
      `Season-identity finalization failed (${error.code ?? "unknown"}, ${direction}).`,
    );
  }
  return data;
}

async function preparePayloads(client: ReturnType<typeof createServiceClient>) {
  const [{ data: season, error: seasonError }, badWgoRows, badUnifiedRows] =
    await Promise.all([
      client
        .from("seasons")
        .select("startDate")
        .eq("id", TARGET_SEASON)
        .single(),
      fetchPaged<WgoManifestRow>((from, to) =>
        client
          .from("wgo_skater_stats")
          .select("id,player_id,date")
          .eq("season_id", BAD_SEASON)
          .gte("date", BAD_START)
          .lte("date", BAD_END)
          .order("id")
          .range(from, to),
      ),
      fetchPaged<UnifiedRow>((from, to) =>
        client
          .from("player_stats_unified")
          .select(SKATER_TREND_REQUIRED_COLUMNS.join(","))
          .eq("season_id", BAD_SEASON)
          .gte("date", BAD_START)
          .lte("date", BAD_END)
          .order("player_id")
          .order("date")
          .range(from, to)
          .returns<UnifiedRow[]>(),
      ),
    ]);

  if (seasonError || !season?.startDate) {
    throw new Error(
      `Season lookup failed (${seasonError?.code ?? "missing"}).`,
    );
  }
  if (
    badWgoRows.length !== EXPECTED_SOURCE_ROWS ||
    badUnifiedRows.length !== EXPECTED_SOURCE_ROWS
  ) {
    throw new Error("Source cohort count no longer matches the frozen scope.");
  }

  const playerIds = Array.from(
    new Set(badUnifiedRows.map((row) => row.player_id)),
  ).filter((playerId): playerId is number => Number.isInteger(playerId));
  const historyRows: UnifiedRow[] = [];
  for (const playerChunk of chunk(playerIds, PLAYER_CHUNK_SIZE)) {
    historyRows.push(
      ...(await fetchPaged<UnifiedRow>((from, to) =>
        client
          .from("player_stats_unified")
          .select(SKATER_TREND_REQUIRED_COLUMNS.join(","))
          .eq("season_id", TARGET_SEASON)
          .gte("date", season.startDate)
          .lte("date", BAD_END)
          .in("player_id", playerChunk)
          .order("player_id")
          .order("date")
          .range(from, to)
          .returns<UnifiedRow[]>(),
      )),
    );
  }

  const correctedRows = badUnifiedRows.map((row) => ({
    ...row,
    season_id: TARGET_SEASON,
  }));
  const replacementRows: RepairTrendRow[] = buildPlayerTrendRecords(
    [...historyRows, ...correctedRows],
    { emitFromDate: BAD_START },
  )
    .filter(
      (row) =>
        row.game_date <= BAD_END &&
        row.metric_type === "skater" &&
        playerIds.includes(row.player_id),
    )
    .map((row) => ({
      ...row,
      season_id: TARGET_SEASON,
      updated_at: REPAIR_TIMESTAMP,
    }));

  const inverseRows = await fetchPaged<TrendRow>((from, to) =>
    client
      .from("player_trend_metrics")
      .select("*")
      .eq("season_id", BAD_SEASON)
      .gte("game_date", BAD_START)
      .lte("game_date", BAD_END)
      .order("player_id")
      .order("game_date")
      .order("metric_key")
      .range(from, to),
  );

  const replacementIdentities = replacementRows.map(stableIdentity).sort();
  const inverseIdentities = inverseRows.map(stableIdentity).sort();
  const sourceManifestMd5 = digest(
    "md5",
    [...badWgoRows]
      .sort((a, b) => a.id - b.id)
      .map((row) => `${row.id}:${row.player_id}:${row.date}`)
      .join(","),
  );
  const trendIdentityMd5 = digest("md5", inverseIdentities.join(","));
  const playerDates = new Set(
    replacementRows.map((row) => `${row.player_id}:${row.game_date}`),
  );
  const metricKeys = new Set(replacementRows.map((row) => row.metric_key));

  if (
    replacementRows.length !== EXPECTED_TREND_ROWS ||
    inverseRows.length !== EXPECTED_TREND_ROWS ||
    playerDates.size !== EXPECTED_PLAYER_DATES ||
    metricKeys.size !== EXPECTED_METRIC_KEYS ||
    replacementIdentities.join("\n") !== inverseIdentities.join("\n") ||
    sourceManifestMd5 !== EXPECTED_SOURCE_MANIFEST_MD5 ||
    trendIdentityMd5 !== EXPECTED_TREND_IDENTITY_MD5
  ) {
    throw new Error(
      "Derived repair payload no longer matches frozen receipts.",
    );
  }

  return {
    replacementRows,
    inverseRows: inverseRows as RepairTrendRow[],
    receipt: {
      sourceRows: badWgoRows.length,
      unifiedRows: badUnifiedRows.length,
      affectedPlayers: playerIds.length,
      historyRows: historyRows.length,
      trendRows: replacementRows.length,
      playerDates: playerDates.size,
      metricKeys: metricKeys.size,
      sourceManifestMd5,
      trendIdentityMd5,
      replacementPayloadSha256: digest(
        "sha256",
        JSON.stringify(replacementRows),
      ),
      inversePayloadSha256: digest("sha256", JSON.stringify(inverseRows)),
      repairTimestamp: REPAIR_TIMESTAMP,
    },
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const client = createServiceClient();

  if (args.mode === "rollback") {
    if (process.env.ALLOW_WGO_PLAYER_SEASON_REPAIR !== "exact-april-2023") {
      throw new Error("Rollback confirmation environment value is missing.");
    }
    const receipt = await finalize({
      client,
      operationId: args.inverseOperationId as string,
      direction: "inverse",
    });
    console.log(JSON.stringify({ mode: args.mode, receipt }, null, 2));
    return;
  }

  const prepared = await preparePayloads(client);
  if (args.mode === "dry-run") {
    console.log(
      JSON.stringify({ mode: args.mode, ...prepared.receipt }, null, 2),
    );
    return;
  }

  if (process.env.ALLOW_WGO_PLAYER_SEASON_REPAIR !== "exact-april-2023") {
    throw new Error("Execution confirmation environment value is missing.");
  }

  const inverseStage = await stageRows({
    client,
    operationId: args.inverseOperationId as string,
    direction: "inverse",
    rows: prepared.inverseRows,
  });
  const forwardStage = await stageRows({
    client,
    operationId: args.forwardOperationId as string,
    direction: "forward",
    rows: prepared.replacementRows,
  });
  const receipt = await finalize({
    client,
    operationId: args.forwardOperationId as string,
    direction: "forward",
  });

  console.log(
    JSON.stringify(
      {
        mode: args.mode,
        manifest: prepared.receipt,
        inverseStage,
        forwardStage,
        receipt,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Repair failed.");
  process.exitCode = 1;
});

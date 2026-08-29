import { createHash } from "crypto";
import path from "path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database, Json } from "lib/supabase/database-generated.types";
import { SUSTAINABILITY_SCORE_PROVENANCE_VERSION } from "lib/sustainability/runtimeContract";

const DEFAULT_SEASON_ID = 20252026;
const DEFAULT_DATE = "2026-07-22";
const LEGACY_UNKNOWN_VERSION = "legacy_provenance_unknown";
const PAGE_SIZE = 1000;
const PLAYER_CHUNK_SIZE = 100;

type ScoreRow = Pick<
  Database["public"]["Tables"]["sustainability_scores"]["Row"],
  | "player_id"
  | "season_id"
  | "snapshot_date"
  | "window_code"
  | "s_raw"
  | "s_100"
  | "components"
  | "model_version"
  | "config_hash"
>;

type SourceRow = {
  player_id: number;
  date: string;
};

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

function asObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceCutoffVersion(components: Json): string | null {
  return readString(asObject(asObject(components)?.sourceCutoffs)?.version);
}

function claimedPlayerStatsCutoff(components: Json): string | null {
  const cutoffs = asObject(asObject(components)?.sourceCutoffs);
  if (!cutoffs) return null;
  const observed = asObject(cutoffs.observed);
  return (
    readString(observed?.player_stats_unified) ??
    readString(observed?.player_stats_source_date) ??
    readString(cutoffs.player_stats_unified) ??
    readString(cutoffs.player_stats_source_date)
  );
}

function embeddedValue(
  components: Json,
  key: "modelVersion" | "configHash",
): string | null {
  return readString(asObject(components)?.[key]);
}

function buildLegacyUnknownComponents(row: ScoreRow): Json {
  const components = asObject(row.components) ?? {};
  const priorWarnings = Array.isArray(components.warnings)
    ? components.warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
  const claimedCutoff = claimedPlayerStatsCutoff(row.components);
  return {
    ...components,
    sourceCutoffs: {
      version: LEGACY_UNKNOWN_VERSION,
      requested: { snapshot_date: row.snapshot_date },
      observed: { player_stats_unified: null },
      derived: { sustainability_window_z: row.snapshot_date },
      scopes: { player_totals_unified_season_id: row.season_id },
      age_days: { player_stats_unified: null },
      legacy_claims: {
        player_stats_unified: claimedCutoff,
      },
    },
    warnings: [
      ...new Set([...priorWarnings, "legacy_source_provenance_unknown"]),
    ],
  } as Json;
}

async function fetchScores(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  date: string;
}): Promise<ScoreRow[]> {
  const rows: ScoreRow[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await args.client
      .from("sustainability_scores")
      .select(
        "player_id,season_id,snapshot_date,window_code,s_raw,s_100,components,model_version,config_hash",
      )
      .eq("season_id", args.seasonId)
      .eq("snapshot_date", args.date)
      .order("player_id", { ascending: true })
      .order("window_code", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSourceRows(args: {
  client: SupabaseClient<Database>;
  playerIds: number[];
  seasonId: number;
  seasonStart: string;
  date: string;
}): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  for (const playerIds of chunk(args.playerIds, PLAYER_CHUNK_SIZE)) {
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await args.client
        .from("player_stats_unified")
        .select("player_id,date")
        .eq("season_id", args.seasonId)
        .in("player_id", playerIds)
        .gte("date", args.seasonStart)
        .lte("date", args.date)
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

function identity(row: ScoreRow): string {
  return `${row.player_id}:${row.snapshot_date}:${row.window_code}`;
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function stableHash(rows: ScoreRow[]): string {
  const payload = [...rows]
    .sort((left, right) => identity(left).localeCompare(identity(right)))
    .map((row) =>
      stableStringify({
        identity: identity(row),
        s_raw: row.s_raw,
        s_100: row.s_100,
        model_version: row.model_version,
        config_hash: row.config_hash,
        components: row.components,
      }),
    )
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

async function main(): Promise<void> {
  loadEnv();
  const { seasonId, date } = parseArgs(process.argv.slice(2));
  const client = createSupabaseClient();
  const [{ data: season, error: seasonError }, scoreRows] = await Promise.all([
    client.from("seasons").select("id,startDate").eq("id", seasonId).single(),
    fetchScores({ client, seasonId, date }),
  ]);
  if (seasonError) throw seasonError;

  const playerIds = [...new Set(scoreRows.map((row) => row.player_id))];
  const sourceRows = await fetchSourceRows({
    client,
    playerIds,
    seasonId,
    seasonStart: season.startDate.slice(0, 10),
    date,
  });
  const latestSourceByPlayer = new Map<number, string>();
  for (const row of sourceRows) {
    const current = latestSourceByPlayer.get(row.player_id);
    if (!current || row.date > current) {
      latestSourceByPlayer.set(row.player_id, row.date);
    }
  }

  let falseRequestedCutoffClaims = 0;
  let claimsMatchingCurrentSource = 0;
  let missingClaims = 0;
  let embeddedModelMismatches = 0;
  let embeddedConfigMismatches = 0;
  let preservedV2Rows = 0;
  let classifiedLegacyRows = 0;
  const candidateRows = scoreRows.map((row) => {
    const version = sourceCutoffVersion(row.components);
    if (version === SUSTAINABILITY_SCORE_PROVENANCE_VERSION) {
      preservedV2Rows += 1;
      return row;
    }
    classifiedLegacyRows += 1;
    const claimed = claimedPlayerStatsCutoff(row.components);
    const latest = latestSourceByPlayer.get(row.player_id) ?? null;
    if (!claimed) missingClaims += 1;
    if (claimed === row.snapshot_date && latest !== row.snapshot_date) {
      falseRequestedCutoffClaims += 1;
    }
    if (claimed != null && claimed === latest) {
      claimsMatchingCurrentSource += 1;
    }
    const embeddedModel = embeddedValue(row.components, "modelVersion");
    const embeddedConfig = embeddedValue(row.components, "configHash");
    if (embeddedModel && embeddedModel !== row.model_version) {
      embeddedModelMismatches += 1;
    }
    if (embeddedConfig && embeddedConfig !== row.config_hash) {
      embeddedConfigMismatches += 1;
    }
    return {
      ...row,
      components: buildLegacyUnknownComponents(row),
    };
  });
  const persistedV2Rows = scoreRows.filter(
    (row) =>
      sourceCutoffVersion(row.components) ===
      SUSTAINABILITY_SCORE_PROVENANCE_VERSION,
  );
  const candidateV2Rows = candidateRows.filter(
    (row) =>
      sourceCutoffVersion(row.components) ===
      SUSTAINABILITY_SCORE_PROVENANCE_VERSION,
  );

  console.log(
    JSON.stringify(
      {
        audit: "sustainability_score_provenance_bounded_repair_v1",
        persistenceApplied: false,
        seasonId,
        snapshotDate: date,
        sourceHistoryStart: season.startDate.slice(0, 10),
        coverage: {
          scoreRows: scoreRows.length,
          players: playerIds.length,
          sourceRows: sourceRows.length,
          playersWithObservedSource: latestSourceByPlayer.size,
        },
        classification: {
          preservedV2Rows,
          classifiedLegacyRows,
          falseRequestedCutoffClaims,
          claimsMatchingCurrentSource,
          missingClaims,
          embeddedModelMismatches,
          embeddedConfigMismatches,
        },
        receipts: {
          persistedPayloadSha256: stableHash(scoreRows),
          candidatePayloadSha256: stableHash(candidateRows),
          persistedV2PayloadSha256: stableHash(persistedV2Rows),
          candidateV2PayloadSha256: stableHash(candidateV2Rows),
        },
        repairBoundary:
          "Preserve proven v2 rows byte-for-byte. For unversioned rows on the approved snapshot only, preserve scores/model/config values, retain any old date solely under legacy_claims, set observed cutoff and age to null, and mark provenance legacy_provenance_unknown. Never infer historical observed provenance from today's source state.",
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

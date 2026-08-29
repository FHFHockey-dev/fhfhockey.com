import { createHash } from "crypto";
import path from "path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "lib/supabase/database-generated.types";
import {
  main as buildRollingPlayerAverages,
  type RollingPlayerDryRunBatch,
  type RollingPlayerRunSummary,
} from "lib/supabase/Upserts/fetchRollingPlayerAverages";

const DEFAULT_SEASON_ID = 20252026;
const DEFAULT_START_DATE = "2025-10-07";
const DEFAULT_END_DATE = "2026-04-16";
const DEFAULT_PLAYER_NAMES = [
  "Nick Suzuki",
  "Tyson Hinds",
  "Rasmus Dahlin",
  "Josh Norris",
] as const;
const PAGE_SIZE = 1000;
const PRIMARY_AUDIT_FIELDS = [
  "player_id",
  "game_date",
  "strength_state",
  "season",
  "team_id",
  "game_id",
  "sog_per_60_last5",
  "sog_per_60_total_last5",
  "sog_per_60_shots_season",
  "sog_per_60_toi_seconds_season",
  "games_played",
  "team_games_played",
] as const;

type GenericRow = Record<string, unknown>;
type SupportRow =
  Database["public"]["Tables"]["rolling_player_metric_support_payloads"]["Row"];

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
  const names = (readValue("--players") ?? DEFAULT_PLAYER_NAMES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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
  if (!names.length)
    throw new Error("--players must contain at least one name.");
  return { seasonId, startDate, endDate, names };
}

function primaryIdentity(row: GenericRow): string {
  return `${row.player_id}:${row.game_date}:${row.strength_state}`;
}

function supportIdentity(row: GenericRow): string {
  return `${row.player_id}:${row.game_date}:${row.strength_state}`;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "updated_at")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function stableHash(rows: GenericRow[], identity: (row: GenericRow) => string) {
  const payload = [...rows]
    .sort((left, right) => identity(left).localeCompare(identity(right)))
    .map((row) => stableStringify(row))
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

function pickPrimaryAuditFields(row: GenericRow): GenericRow {
  return Object.fromEntries(
    PRIMARY_AUDIT_FIELDS.map((field) => [field, row[field] ?? null]),
  );
}

function deduplicateRows(
  rows: GenericRow[],
  identity: (row: GenericRow) => string,
) {
  const byIdentity = new Map<string, GenericRow>();
  for (const row of rows) byIdentity.set(identity(row), row);
  return {
    rows: [...byIdentity.values()],
    duplicateRows: rows.length - byIdentity.size,
  };
}

async function fetchPaged<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await build(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchPersistedPrimary(args: {
  client: SupabaseClient<Database>;
  playerIds: number[];
  seasonId: number;
  startDate: string;
  endDate: string;
}): Promise<GenericRow[]> {
  return fetchPaged<GenericRow>(
    (from, to) =>
      args.client
        .from("rolling_player_game_metrics")
        .select(PRIMARY_AUDIT_FIELDS.join(","))
        .eq("season", args.seasonId)
        .in("player_id", args.playerIds)
        .gte("game_date", args.startDate)
        .lte("game_date", args.endDate)
        .order("player_id", { ascending: true })
        .order("game_date", { ascending: true })
        .order("strength_state", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: GenericRow[] | null;
        error: { message: string } | null;
      }>,
  );
}

async function fetchPersistedSupport(args: {
  client: SupabaseClient<Database>;
  playerIds: number[];
  seasonId: number;
  startDate: string;
  endDate: string;
}): Promise<SupportRow[]> {
  return fetchPaged<SupportRow>((from, to) =>
    args.client
      .from("rolling_player_metric_support_payloads")
      .select("*")
      .eq("season", args.seasonId)
      .in("player_id", args.playerIds)
      .gte("game_date", args.startDate)
      .lte("game_date", args.endDate)
      .order("player_id", { ascending: true })
      .order("game_date", { ascending: true })
      .order("strength_state", { ascending: true })
      .range(from, to),
  );
}

async function main(): Promise<void> {
  loadEnv();
  const { seasonId, startDate, endDate, names } = parseArgs(
    process.argv.slice(2),
  );
  const client = createSupabaseClient();
  const { data: players, error: playersError } = await client
    .from("players")
    .select("id,fullName")
    .in("fullName", names)
    .order("id", { ascending: true });
  if (playersError) throw playersError;
  if ((players ?? []).length !== names.length) {
    const resolved = new Set((players ?? []).map((row) => row.fullName));
    throw new Error(
      `Could not resolve canonical players: ${names
        .filter((name) => !resolved.has(name))
        .join(", ")}`,
    );
  }
  const playerIds = (players ?? []).map((row) => row.id);
  const candidatePrimary: GenericRow[] = [];
  const candidateSupport: GenericRow[] = [];
  const summaries: RollingPlayerRunSummary[] = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalTime = console.time;
  const originalTimeEnd = console.timeEnd;
  console.info = () => undefined;
  console.warn = () => undefined;
  console.time = () => undefined;
  console.timeEnd = () => undefined;
  try {
    for (const playerId of playerIds) {
      summaries.push(
        await buildRollingPlayerAverages({
          playerId,
          season: seasonId,
          startDate,
          endDate,
          strengths: ["all", "5v5", "ev", "pp", "pk"],
          playerConcurrency: 1,
          upsertBatchSize: 5000,
          upsertConcurrency: 1,
          skipDiagnostics: false,
          dryRunUpsert: true,
          dryRunBatchObserver: (batch: RollingPlayerDryRunBatch) => {
            candidatePrimary.push(...batch.rankingRows);
            candidateSupport.push(...batch.supportRows);
          },
        }),
      );
    }
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.time = originalTime;
    console.timeEnd = originalTimeEnd;
  }

  const [persistedPrimaryRows, persistedSupportRows] = await Promise.all([
    fetchPersistedPrimary({
      client,
      playerIds,
      seasonId,
      startDate,
      endDate,
    }),
    fetchPersistedSupport({
      client,
      playerIds,
      seasonId,
      startDate,
      endDate,
    }),
  ]);
  const primaryCandidate = deduplicateRows(candidatePrimary, primaryIdentity);
  const supportCandidate = deduplicateRows(candidateSupport, supportIdentity);
  const persistedPrimary = deduplicateRows(
    persistedPrimaryRows,
    primaryIdentity,
  );
  const persistedSupport = deduplicateRows(
    persistedSupportRows as unknown as GenericRow[],
    supportIdentity,
  );
  const primaryCandidateByIdentity = new Map(
    primaryCandidate.rows.map((row) => [primaryIdentity(row), row]),
  );
  const primaryPersistedByIdentity = new Map(
    persistedPrimary.rows.map((row) => [primaryIdentity(row), row]),
  );
  const supportCandidateByIdentity = new Map(
    supportCandidate.rows.map((row) => [supportIdentity(row), row]),
  );
  const supportPersistedByIdentity = new Map(
    persistedSupport.rows.map((row) => [supportIdentity(row), row]),
  );
  const primaryCriticalCandidate = primaryCandidate.rows.map(
    pickPrimaryAuditFields,
  );
  let changedPrimaryCriticalRows = 0;
  for (const candidate of primaryCriticalCandidate) {
    const persisted = primaryPersistedByIdentity.get(
      primaryIdentity(candidate),
    );
    if (
      persisted &&
      stableStringify(candidate) !==
        stableStringify(pickPrimaryAuditFields(persisted))
    ) {
      changedPrimaryCriticalRows += 1;
    }
  }
  let changedSupportRows = 0;
  for (const candidate of supportCandidate.rows) {
    const persisted = supportPersistedByIdentity.get(
      supportIdentity(candidate),
    );
    if (
      persisted &&
      stableStringify(candidate) !== stableStringify(persisted)
    ) {
      changedSupportRows += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        audit: "rolling_player_bounded_repair_v1",
        persistenceApplied: false,
        historyContract: "full_selected_scope_through_end_date_v1",
        seasonId,
        outputRange: { startDate, endDate },
        players: players ?? [],
        sourceGate: {
          freshnessBlockers: summaries.reduce(
            (total, summary) => total + summary.freshnessBlockers,
            0,
          ),
          coverageWarnings: summaries.reduce(
            (total, summary) => total + summary.coverageWarnings,
            0,
          ),
          suspiciousOutputWarnings: summaries.reduce(
            (total, summary) => total + summary.suspiciousOutputWarnings,
            0,
          ),
          byPlayer: (players ?? []).map((player, index) => ({
            playerId: player.id,
            playerName: player.fullName,
            freshnessBlockers: summaries[index]?.freshnessBlockers ?? 0,
            coverageWarnings: summaries[index]?.coverageWarnings ?? 0,
            suspiciousOutputWarnings:
              summaries[index]?.suspiciousOutputWarnings ?? 0,
            missingSources:
              summaries[index]?.sourceTracking.missingSources ?? null,
          })),
        },
        primary: {
          candidateRows: primaryCandidate.rows.length,
          persistedRows: persistedPrimary.rows.length,
          duplicateCandidateRows: primaryCandidate.duplicateRows,
          missingPersistedRows: [...primaryCandidateByIdentity.keys()].filter(
            (key) => !primaryPersistedByIdentity.has(key),
          ).length,
          stalePersistedRows: [...primaryPersistedByIdentity.keys()].filter(
            (key) => !primaryCandidateByIdentity.has(key),
          ).length,
          changedCriticalRows: changedPrimaryCriticalRows,
          candidatePayloadSha256: stableHash(
            primaryCandidate.rows,
            primaryIdentity,
          ),
          persistedCriticalPayloadSha256: stableHash(
            persistedPrimary.rows.map(pickPrimaryAuditFields),
            primaryIdentity,
          ),
          candidateCriticalPayloadSha256: stableHash(
            primaryCriticalCandidate,
            primaryIdentity,
          ),
        },
        support: {
          candidateRows: supportCandidate.rows.length,
          persistedRows: persistedSupport.rows.length,
          duplicateCandidateRows: supportCandidate.duplicateRows,
          missingPersistedRows: [...supportCandidateByIdentity.keys()].filter(
            (key) => !supportPersistedByIdentity.has(key),
          ).length,
          stalePersistedRows: [...supportPersistedByIdentity.keys()].filter(
            (key) => !supportCandidateByIdentity.has(key),
          ).length,
          changedRows: changedSupportRows,
          candidatePayloadSha256: stableHash(
            supportCandidate.rows,
            supportIdentity,
          ),
          persistedPayloadSha256: stableHash(
            persistedSupport.rows,
            supportIdentity,
          ),
        },
        parity: {
          candidatePrimaryWithoutSupport: [
            ...primaryCandidateByIdentity.keys(),
          ].filter((key) => !supportCandidateByIdentity.has(key)).length,
          candidateSupportWithoutPrimary: [
            ...supportCandidateByIdentity.keys(),
          ].filter((key) => !primaryCandidateByIdentity.has(key)).length,
        },
        repairBoundary:
          "Recompute primary and support payloads from complete selected-season history, emit only the approved season/date/player/strength identities, and keep dryRunUpsert=true until grouped mutation authorization quotes these receipts.",
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

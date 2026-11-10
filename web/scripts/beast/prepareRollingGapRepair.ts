import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
export type GapManifest = {
  version: 1;
  season: number;
  date: string;
  strength: "5v5";
  players: Array<{ playerId: number; gameId: number }>;
};
type InputSnapshot = { wgo: Row[]; counts: Row[] };
type ExistingKeys = { ranking: Row[]; support: Row[] };
type RecomputeOptions = {
  playerId: number;
  season: number;
  startDate: string;
  endDate: string;
  strengths: ["5v5"];
  playerConcurrency: 1;
  upsertConcurrency: 1;
  maxPlayers: 1;
  upsertBatchSize: 1;
  skipDiagnostics: false;
  dryRunUpsert: true;
  stopClaimingPlayersAtMs: number;
  abortInFlightAtMs: number;
  dryRunBatchObserver: (batch: {
    rankingRows: ReadonlyArray<Row>;
    supportRows: ReadonlyArray<Row>;
  }) => void;
};
export type RepairPreparationDependencies = {
  now: () => number;
  readInputs: (manifest: GapManifest, ids: number[], signal: AbortSignal) => Promise<InputSnapshot>;
  readExisting: (manifest: GapManifest, ids: number[], signal: AbortSignal) => Promise<ExistingKeys>;
  recompute: (options: RecomputeOptions) => Promise<{
    processedPlayers: number;
    rowsUpserted: number;
    freshnessBlockers: number;
    unknownGameIds: number;
    suspiciousOutputWarnings: number;
    stoppedReason?: string;
  }>;
};

const MAX_BATCH_PLAYERS = 25;
const MAX_RUNTIME_MS = 220_000;
const COUNT_FIELDS = ["goals", "first_assists", "total_points", "shots", "hits", "shots_blocked"];
const RATE_COMPONENTS = [
  ["goals_per_60_goals_season", "goals_per_60_toi_seconds_season"],
  ["primary_assists_per_60_primary_assists_season", "primary_assists_per_60_toi_seconds_season"],
  ["points_avg_season", "toi_seconds_avg_season"],
  ["sog_per_60_shots_season", "sog_per_60_toi_seconds_season"],
  ["hits_per_60_hits_season", "hits_per_60_toi_seconds_season"],
  ["blocks_per_60_blocks_season", "blocks_per_60_toi_seconds_season"],
] as const;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function evidenceHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function validateManifest(value: unknown): GapManifest {
  const manifest = value as GapManifest;
  if (!manifest || manifest.version !== 1 || manifest.strength !== "5v5" ||
      !Number.isSafeInteger(manifest.season) || manifest.season < 20002001 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(manifest.date ?? "") ||
      !Number.isFinite(Date.parse(`${manifest.date}T00:00:00Z`)) ||
      new Date(`${manifest.date}T00:00:00Z`).toISOString().slice(0, 10) !== manifest.date ||
      !Array.isArray(manifest.players) || !manifest.players.length || manifest.players.length > 1000) {
    throw new Error("Manifest must specify one valid date, season, 5v5 strength and 1–1000 exact player/game identities.");
  }
  const year = Math.floor(manifest.season / 10000);
  if (manifest.season % 10000 !== year + 1 || manifest.date < `${year}-09-01` || manifest.date > `${year + 1}-08-31`) {
    throw new Error("Manifest date and season disagree.");
  }
  const ids = new Set<number>();
  for (const player of manifest.players) {
    if (!Number.isSafeInteger(player.playerId) || player.playerId <= 0 || ids.has(player.playerId) ||
        !Number.isSafeInteger(player.gameId) || Math.floor(player.gameId / 1_000_000) !== year ||
        Math.floor(player.gameId / 10_000) % 100 !== 2) {
      throw new Error("Manifest contains duplicate/invalid players or non-regular-season game identities.");
    }
    ids.add(player.playerId);
  }
  return manifest;
}

function validateInputs(manifest: GapManifest, ids: number[], snapshot: InputSnapshot) {
  const expected = new Map(manifest.players.map((player) => [player.playerId, player.gameId]));
  if (snapshot.wgo.length !== ids.length || snapshot.counts.length !== ids.length) {
    throw new Error("Current WGO/NST 5v5 inputs are missing or duplicated; reconcile source ingestion first.");
  }
  for (const id of ids) {
    const appearances = snapshot.wgo.filter((row) => row.player_id === id);
    const counts = snapshot.counts.filter((row) => row.player_id === id);
    if (appearances.length !== 1 || counts.length !== 1) throw new Error(`Player ${id}: duplicate/missing source identity.`);
    const wgo = appearances[0];
    const nst = counts[0];
    if (wgo.game_id !== expected.get(id) || wgo.date !== manifest.date ||
        wgo.season_id !== manifest.season || wgo.games_played !== 1 || nst.date_scraped !== manifest.date ||
        nst.season !== manifest.season) {
      throw new Error(`Player ${id}: WGO/NST identity does not match the manifest.`);
    }
    if (!finite(nst.toi) || nst.toi <= 0 || nst.toi >= 4000 ||
        COUNT_FIELDS.some((field) => !finite(nst[field]) || (nst[field] as number) < 0)) {
      throw new Error(`Player ${id}: current 5v5 counts/TOI are incomplete or invalid. Never substitute zero.`);
    }
  }
}

function validateRows(manifest: GapManifest, playerId: number, ranking: Row[], support: Row[]) {
  const gameId = manifest.players.find((player) => player.playerId === playerId)!.gameId;
  if (ranking.length !== 1 || support.length !== 1) throw new Error(`Player ${playerId}: expected exactly one ranking and support row.`);
  for (const row of [...ranking, ...support]) {
    if (row.player_id !== playerId || row.game_id !== gameId || row.game_date !== manifest.date ||
        row.season !== manifest.season || row.strength_state !== "5v5") {
      throw new Error(`Player ${playerId}: recompute widened the approved identity scope.`);
    }
  }
  for (const [numerator, denominator] of RATE_COMPONENTS) {
    if (!finite(ranking[0][numerator]) || (ranking[0][numerator] as number) < 0 ||
        !finite(ranking[0][denominator]) || (ranking[0][denominator] as number) <= 0) {
      throw new Error(`Player ${playerId}: missing/invalid season BEAST component ${numerator}/${denominator}.`);
    }
  }
}

/** Preparation only: no external write dependency is exposed or called. */
export async function prepareRollingGapRepair(
  input: { manifest: GapManifest; offset: number; count: number; maxRuntimeMs?: number },
  deps: RepairPreparationDependencies,
) {
  const manifest = validateManifest(input.manifest);
  const runtimeMs = input.maxRuntimeMs ?? MAX_RUNTIME_MS;
  if (!Number.isSafeInteger(input.offset) || input.offset < 0 ||
      !Number.isSafeInteger(input.count) || input.count < 1 || input.count > MAX_BATCH_PLAYERS ||
      !Number.isSafeInteger(runtimeMs) || runtimeMs < 1 || runtimeMs > MAX_RUNTIME_MS) {
    throw new Error("Use offset ≥0, count 1–25 and a runtime budget of at most 220000 ms.");
  }
  const ids = manifest.players.slice(input.offset, input.offset + input.count).map((player) => player.playerId);
  if (!ids.length) throw new Error("The selected manifest batch is empty.");
  const startedAt = deps.now();
  const deadline = startedAt + runtimeMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), runtimeMs);
  const report = {
    version: 1,
    mode: "prepare_only" as const,
    generatedAt: new Date(startedAt).toISOString(),
    manifestHash: evidenceHash(manifest),
    scope: { season: manifest.season, date: manifest.date, strength: manifest.strength, playerIds: ids },
    readyForReview: false,
    productionWrites: 0,
    blockers: [] as string[],
    inputHash: null as string | null,
    rankingRows: [] as Row[],
    supportRows: [] as Row[],
    summaries: [] as Array<{ playerId: number; summary: Awaited<ReturnType<RepairPreparationDependencies["recompute"]>> }>,
    limitations: [
      "No publish mode. Existing rows must never be overwritten by the gap repair.",
      "Reads full player history to derive one date; 220s is a cooperative deadline, not a fixed query-count cap.",
      "Current-day source checks do not establish historical input completeness or resolve the independent TOI repair.",
      "An operator must reconcile source/TOI owners and approve exact reviewed payload hashes before any separate insert-only operation.",
    ],
  };
  try {
    const existing = await deps.readExisting(manifest, ids, controller.signal);
    if (existing.ranking.length || existing.support.length) throw new Error("At least one requested ranking/support key already exists. Reconcile the manifest; do not overwrite it.");
    const inputs = await deps.readInputs(manifest, ids, controller.signal);
    validateInputs(manifest, ids, inputs);
    report.inputHash = evidenceHash(inputs);
    for (const playerId of ids) {
      if (deps.now() >= deadline || controller.signal.aborted) throw new Error("Preparation runtime budget exhausted. No continuation was started.");
      const ranking: Row[] = [];
      const support: Row[] = [];
      const summary = await deps.recompute({
        playerId, season: manifest.season, startDate: manifest.date, endDate: manifest.date,
        strengths: ["5v5"], playerConcurrency: 1, upsertConcurrency: 1, maxPlayers: 1,
        upsertBatchSize: 1, skipDiagnostics: false, dryRunUpsert: true,
        stopClaimingPlayersAtMs: deadline, abortInFlightAtMs: deadline,
        dryRunBatchObserver: (batch) => { ranking.push(...batch.rankingRows); support.push(...batch.supportRows); },
      });
      report.summaries.push({ playerId, summary });
      if (summary.rowsUpserted !== 0 || summary.processedPlayers !== 1 || summary.freshnessBlockers ||
          summary.unknownGameIds || summary.suspiciousOutputWarnings || summary.stoppedReason === "runtime_budget") {
        throw new Error(`Player ${playerId}: recompute receipt is not clean; inspect the captured summary before continuing.`);
      }
      validateRows(manifest, playerId, ranking, support);
      report.rankingRows.push(...ranking);
      report.supportRows.push(...support);
    }
    if (deps.now() >= deadline || controller.signal.aborted) throw new Error("Preparation runtime budget exhausted before final verification.");
    const after = await deps.readExisting(manifest, ids, controller.signal);
    if (after.ranking.length || after.support.length) throw new Error("A requested key appeared during preparation. Reconcile concurrent writers; do not overwrite it.");
    const inputsAfter = await deps.readInputs(manifest, ids, controller.signal);
    if (evidenceHash(inputsAfter) !== report.inputHash) throw new Error("Current-day inputs changed during preparation. Let ingestion settle before regenerating.");
    report.readyForReview = true;
  } catch (error) {
    report.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
  return { ...report, payloadHash: evidenceHash({ ranking: report.rankingRows, support: report.supportRows }) };
}

async function cli() {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--manifest", "--offset", "--count", "--out"].includes(args[index]) || !args[index + 1]) {
      throw new Error("Usage: prepareRollingGapRepair.ts --manifest FILE --offset 0 --count 1 --out FILE. No write/publish mode exists.");
    }
    if (options.has(args[index])) throw new Error(`Duplicate option ${args[index]}`);
    options.set(args[index], args[index + 1]);
  }
  if (!options.get("--manifest") || !options.get("--out")) throw new Error("--manifest and --out are required.");
  const manifest = validateManifest(JSON.parse(fs.readFileSync(options.get("--manifest")!, "utf8")));
  const out = path.resolve(options.get("--out")!);
  if (fs.existsSync(out)) throw new Error("Output already exists; preserve prior evidence and choose a new path.");
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing configured Supabase URL/service credentials.");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { main } = await import("../../lib/supabase/Upserts/fetchRollingPlayerAverages");
  const read = async (table: string, fields: string, scope: GapManifest, ids: number[], signal: AbortSignal, kind: "wgo" | "counts" | "output") => {
    let query = client.from(table).select(fields).in("player_id", ids).order("player_id").limit(ids.length + 1).abortSignal(signal);
    if (kind === "wgo") query = query.eq("date", scope.date).eq("season_id", scope.season).eq("games_played", 1);
    else if (kind === "counts") query = query.eq("date_scraped", scope.date);
    else query = query.eq("game_date", scope.date).eq("strength_state", scope.strength);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows: Row[] = [];
    for (const value of (data ?? []) as unknown[]) {
      if (!value || typeof value !== "object" || Array.isArray(value) || !("player_id" in value)) {
        throw new Error(`${table}: malformed result row`);
      }
      rows.push(value as Row);
    }
    return rows;
  };
  const report = await prepareRollingGapRepair({ manifest, offset: Number(options.get("--offset") ?? 0), count: Number(options.get("--count") ?? 1) }, {
    now: Date.now,
    readInputs: async (scope, ids, signal) => ({
      wgo: await read("wgo_skater_stats", "player_id,game_id,date,season_id,games_played", scope, ids, signal, "wgo"),
      counts: await read("nst_gamelog_5v5_counts", `player_id,date_scraped,season,toi,${COUNT_FIELDS.join(",")}`, scope, ids, signal, "counts"),
    }),
    readExisting: async (scope, ids, signal) => ({
      ranking: await read("rolling_player_game_metrics", "player_id,game_date,strength_state,updated_at", scope, ids, signal, "output"),
      support: await read("rolling_player_metric_support_payloads", "player_id,game_date,strength_state,updated_at", scope, ids, signal, "output"),
    }),
    recompute: main as RepairPreparationDependencies["recompute"],
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ ...report, targetHost: new URL(url).host }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ readyForReview: report.readyForReview, blockers: report.blockers, players: report.scope.playerIds.length, payloadHash: report.payloadHash, output: out, productionWrites: 0 }));
  if (!report.readyForReview) process.exitCode = 2;
}

if (typeof require !== "undefined" && require.main === module) {
  cli().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

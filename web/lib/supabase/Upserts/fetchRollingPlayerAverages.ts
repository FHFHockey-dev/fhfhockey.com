import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { teamsInfo } from "lib/teamsInfo";
import {
  createHistoricalAverageAccumulator,
  createHistoricalGpPctAccumulator,
  getHistoricalAverageSnapshot,
  getHistoricalGpPctSnapshot,
  getRollingGpPctSnapshot,
  updateHistoricalAverageAccumulator,
  updateHistoricalGpPctAccumulator
} from "./rollingHistoricalAverages";
import {
  createHistoricalRatioAccumulator,
  getHistoricalRatioComponentSnapshot,
  createRatioRollingAccumulator,
  getRatioRollingComponentSnapshot,
  getHistoricalRatioSnapshot,
  getRatioRollingSnapshot,
  updateHistoricalRatioAccumulator,
  updateRatioRollingAccumulator,
  type HistoricalRatioAccumulator,
  type RatioAggregationSpec,
  type RatioComponentTotals,
  type RatioComponents,
  type RatioRollingAccumulator
} from "./rollingMetricAggregation";
import {
  type IxgPer60ResolutionSource,
  resolveIxgValue,
  resolveIxgPer60Components,
  resolvePer60Components,
} from "./rollingPlayerMetricMath";
import {
  type RollingPlayerPpContextRow,
  toRollingPlayerPpContextRow,
  resolvePpShareComponents
} from "./rollingPlayerPpShareContract";
import {
  hasTrustedPpUnitContext,
  resolvePpUnitLabel
} from "./rollingPlayerPpUnitContract";
import { resolveTrustedLineAssignment } from "./rollingPlayerLineContextContract";
import {
  type RollingPlayerFallbackToiSource,
  type RollingPlayerToiSource,
  type RollingPlayerToiSuspiciousReason,
  type RollingPlayerToiTrustTier,
  type RollingPlayerWgoToiNormalization,
  resolveFallbackToiSeed,
  resolveRollingPlayerToiContext
} from "./rollingPlayerToiContract";
import {
  getAssistsValue,
  getBlocksValue,
  getGoalsValue,
  getHitsValue,
  getIxgValue,
  getPointsValue,
  getPpPointsValue,
  getShotsValue
} from "./rollingPlayerSourceSelection";
import {
  ROLLING_PLAYER_AVAILABILITY_CONTRACT,
  type AvailabilitySemanticType
} from "./rollingPlayerAvailabilityContract";
import {
  summarizeCoverage,
  summarizeDerivedWindowDiagnostics,
  summarizeSourceTailFreshness,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";
import { type RollingMetricWindowFamily } from "./rollingWindowContract";

export type StrengthState = "all" | "ev" | "pp" | "pk";
type FullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";
type PowerPlayCombinationRow = RollingPlayerPpContextRow;

type RollingWindow = 3 | 5 | 10 | 20;

const ROLLING_WINDOWS: RollingWindow[] = [3, 5, 10, 20];
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const TRANSIENT_GATEWAY_STATUSES = [502, 503, 504, 520, 522, 524];
const SLOW_OPERATION_WARNING_MS = 15000;
type PipelinePhase = "bootstrap" | "fetch" | "merge" | "derive" | "upsert" | "summary";
type PipelinePhaseStatus = "start" | "complete" | "failed";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

function isTransientGatewayError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("bad gateway") ||
    message.includes("gateway timeout") ||
    message.includes("service unavailable") ||
    message.includes("cloudflare") ||
    message.includes("<!doctype html>")
  ) {
    return true;
  }
  return TRANSIENT_GATEWAY_STATUSES.some((status) =>
    message.includes(` ${status}`) || message.includes(`code ${status}`)
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function logPipelinePhase(args: {
  phase: PipelinePhase;
  status: PipelinePhaseStatus;
  durationMs?: number;
  details?: Record<string, unknown>;
}) {
  console.info(
    "[fetchRollingPlayerAverages] phase",
    JSON.stringify({
      phase: args.phase,
      status: args.status,
      ...(typeof args.durationMs === "number"
        ? {
            durationMs: args.durationMs,
            durationLabel: formatDuration(args.durationMs)
          }
        : {}),
      ...(args.details ?? {})
    })
  );
}

function createProgressLogger(options: {
  label: string;
  total?: number;
  width?: number;
  minIntervalMs?: number;
}) {
  const { label, total, width = 24, minIntervalMs = 1000 } = options;
  const startTime = Date.now();
  let lastLogTime = 0;
  let lastRenderedLength = 0;
  let finished = false;
  const isTty = Boolean(process.stdout?.isTTY);

  const render = (current: number, detail?: string) => {
    const elapsedMs = Date.now() - startTime;
    const baseDetail = detail ? ` ${detail}` : "";

    if (!total || total <= 0) {
      return `[${label}] ${current}${baseDetail} elapsed:${formatDuration(elapsedMs)}`;
    }

    const safeCurrent = Math.max(0, Math.min(current, total));
    const ratio = total > 0 ? safeCurrent / total : 0;
    const filled = Math.round(ratio * width);
    const bar = `${"#".repeat(filled)}${"-".repeat(Math.max(width - filled, 0))}`;
    const percent = (ratio * 100).toFixed(1).padStart(5, " ");
    const ratePerSec = elapsedMs > 0 ? safeCurrent / (elapsedMs / 1000) : 0;
    const remaining = Math.max(total - safeCurrent, 0);
    const etaMs =
      safeCurrent > 0 && ratePerSec > 0 ? (remaining / ratePerSec) * 1000 : 0;
    const etaLabel =
      safeCurrent > 0 && safeCurrent < total ? ` eta:${formatDuration(etaMs)}` : "";
    return `[${label}] [${bar}] ${percent}% (${safeCurrent}/${total})${baseDetail} elapsed:${formatDuration(elapsedMs)}${etaLabel}`;
  };

  const write = (line: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastLogTime < minIntervalMs) return;
    lastLogTime = now;

    if (isTty) {
      const padded =
        line.length < lastRenderedLength
          ? line + " ".repeat(lastRenderedLength - line.length)
          : line;
      process.stdout.write(`\r${padded}`);
      lastRenderedLength = padded.length;
      return;
    }

    console.info(line);
  };

  return {
    update(current: number, detail?: string) {
      if (finished) return;
      write(render(current, detail));
    },
    finish(current: number, detail?: string) {
      if (finished) return;
      finished = true;
      const line = render(current, detail);
      if (isTty) {
        const padded =
          line.length < lastRenderedLength
            ? line + " ".repeat(lastRenderedLength - line.length)
            : line;
        process.stdout.write(`\r${padded}\n`);
        lastRenderedLength = 0;
      } else {
        console.info(line);
      }
    }
  };
}

function normalizeNumericFields<T extends Record<string, any>>(row: T): T {
  const normalized: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (
      typeof value === "string" &&
      value !== "" &&
      !Number.isNaN(Number(value))
    ) {
      normalized[key] = Number(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized as T;
}

interface StrengthConfig {
  state: StrengthState;
  countsTable: string;
  ratesTable: string;
  countsOiTable: string;
}

const STRENGTH_CONFIGS: StrengthConfig[] = [
  {
    state: "all",
    countsTable: "nst_gamelog_as_counts",
    ratesTable: "nst_gamelog_as_rates",
    countsOiTable: "nst_gamelog_as_counts_oi"
  },
  {
    state: "ev",
    countsTable: "nst_gamelog_es_counts",
    ratesTable: "nst_gamelog_es_rates",
    countsOiTable: "nst_gamelog_es_counts_oi"
  },
  {
    state: "pp",
    countsTable: "nst_gamelog_pp_counts",
    ratesTable: "nst_gamelog_pp_rates",
    countsOiTable: "nst_gamelog_pp_counts_oi"
  },
  {
    state: "pk",
    countsTable: "nst_gamelog_pk_counts",
    ratesTable: "nst_gamelog_pk_rates",
    countsOiTable: "nst_gamelog_pk_counts_oi"
  }
];

// Try to load environment variables for local development. In Next.js these
// are usually already loaded, but this helps for direct Node runs. We attempt
// common locations relative to the app working directory.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "../.env.local" });
dotenv.config({ path: "../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  const details = {
    hasUrl: Boolean(supabaseUrl),
    hasKey: Boolean(supabaseKey)
  };
  throw new Error(
    `Supabase credentials are missing. Details: ${JSON.stringify(details)}`
  );
}

const supabaseServiceUrl: string = supabaseUrl;
const supabaseServiceRoleKey: string = supabaseKey;
const supabase: SupabaseClient = createClient(
  supabaseServiceUrl,
  supabaseServiceRoleKey
);
const rollingPlayerMetricsRestUrl = `${supabaseServiceUrl.replace(/\/$/, "")}/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state`;

interface FetchOptions {
  playerId?: number;
  season?: number;
  startDate?: string;
  endDate?: string;
  resumePlayerId?: number;
  forceFullRefresh?: boolean;
  fullRefreshMode?: FullRefreshMode;
  fullRefreshDeleteChunkSize?: number;
  playerConcurrency?: number;
  upsertBatchSize?: number;
  upsertConcurrency?: number;
  skipDiagnostics?: boolean;
  dryRunUpsert?: boolean;
  debugUpsertPayload?: boolean;
}

type RollingUpsertRow = Record<string, unknown>;

interface RollingRestUpsertError extends Error {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
  statusCode?: number | null;
  responseText?: string | null;
}

function toSerializableError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return {
      message: getErrorMessage(error)
    };
  }

  const record = error as Record<string, unknown>;
  const serialized: Record<string, unknown> = {
    message: getErrorMessage(error)
  };

  for (const key of Object.keys(record)) {
    const value = record[key];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      serialized[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      serialized[key] = value.slice(0, 10);
      continue;
    }
    if (value && typeof value === "object") {
      serialized[key] = "[object]";
    }
  }

  serialized.ownKeys = Object.keys(record);
  return serialized;
}

function summarizeUpsertBatch(batch: RollingUpsertRow[]) {
  const keyCounts = batch.map((row) => Object.keys(row).length);
  const firstRow = batch[0] ?? null;
  const firstRowKeys = firstRow ? Object.keys(firstRow).sort() : [];
  const firstRowKeySet = new Set(firstRowKeys);
  const unionKeys = new Set<string>();
  const keysOutsideFirstRow = new Set<string>();
  let rowsDifferingFromFirst = 0;

  for (const row of batch) {
    const rowKeys = Object.keys(row);
    let differsFromFirst = rowKeys.length !== firstRowKeys.length;
    for (const key of rowKeys) {
      unionKeys.add(key);
      if (!firstRowKeySet.has(key)) {
        keysOutsideFirstRow.add(key);
        differsFromFirst = true;
      }
    }
    if (!differsFromFirst) {
      for (const key of firstRowKeys) {
        if (!(key in row)) {
          differsFromFirst = true;
          break;
        }
      }
    }
    if (differsFromFirst) {
      rowsDifferingFromFirst += 1;
    }
  }

  return {
    rowCount: batch.length,
    keyCountMin: keyCounts.length ? Math.min(...keyCounts) : 0,
    keyCountMax: keyCounts.length ? Math.max(...keyCounts) : 0,
    firstRowKeyCount: firstRowKeys.length,
    unionKeyCount: unionKeys.size,
    rowsDifferingFromFirst,
    keysOutsideFirstRow: Array.from(keysOutsideFirstRow).sort(),
    firstRowIdentity: firstRow
      ? {
          player_id: firstRow.player_id ?? null,
          game_id: firstRow.game_id ?? null,
          game_date: firstRow.game_date ?? null,
          season: firstRow.season ?? null,
          strength_state: firstRow.strength_state ?? null
        }
      : null,
    sampleRowIdentities: batch.slice(0, 3).map((row) => ({
      player_id: row.player_id ?? null,
      game_id: row.game_id ?? null,
      game_date: row.game_date ?? null,
      season: row.season ?? null,
      strength_state: row.strength_state ?? null
    })),
    firstRowKeyPreview: firstRowKeys.slice(0, 40)
  };
}

async function upsertRollingPlayerMetricsBatch(
  batch: RollingUpsertRow[]
): Promise<void> {
  const response = await fetch(rollingPlayerMetricsRestUrl, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(batch)
  });

  if (response.ok) {
    return;
  }

  const responseText = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = responseText
      ? (JSON.parse(responseText) as Record<string, unknown>)
      : null;
  } catch {
    parsed = null;
  }

  const message =
    typeof parsed?.message === "string" && parsed.message.trim().length > 0
      ? parsed.message
      : `PostgREST upsert failed with ${response.status} ${response.statusText}`;
  const error = new Error(message) as RollingRestUpsertError;
  error.code = typeof parsed?.code === "string" ? parsed.code : null;
  error.details = typeof parsed?.details === "string" ? parsed.details : null;
  error.hint = typeof parsed?.hint === "string" ? parsed.hint : null;
  error.status = response.status;
  error.statusCode = response.status;
  error.responseText = responseText || null;
  throw error;
}

function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = async () => {
    if (active < concurrency) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
  };

  const release = () => {
    active = Math.max(active - 1, 0);
    const next = queue.shift();
    if (next) next();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export interface WgoSkaterRow {
  player_id: number;
  game_id: number | null;
  date: string;
  season_id: number | null;
  team_abbrev: string | null;
  current_team_abbreviation: string | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shooting_percentage: number | null;
  hits: number | null;
  blocked_shots: number | null;
  points: number | null;
  pp_points: number | null;
  pp_toi: number | null;
  pp_toi_pct_per_game: number | null;
  toi_per_game: number | null;
}

export interface NstCountsRow {
  date_scraped: string;
  season: number;
  toi: number | null;
  goals: number | null;
  total_assists: number | null;
  first_assists: number | null;
  second_assists: number | null;
  total_points: number | null;
  shots: number | null;
  sh_percentage: number | null;
  ixg: number | null;
  iscfs: number | null;
  hdcf: number | null;
  ipp: number | null;
  penalties_drawn: number | null;
  hits: number | null;
  shots_blocked: number | null;
}

export interface NstRatesRow {
  date_scraped: string;
  season: number;
  shots_per_60: number | null;
  ixg_per_60: number | null;
  toi_per_gp: number | null;
}

export interface NstCountsOiRow {
  date_scraped: string;
  season: number;
  toi: number | null;
  gf: number | null;
  ga: number | null;
  sf: number | null;
  sa: number | null;
  off_zone_starts: number | null;
  def_zone_starts: number | null;
  neu_zone_starts: number | null;
  off_zone_start_pct: number | null;
  on_ice_sh_pct: number | null;
  on_ice_sv_pct: number | null;
  pdo: number | null;
  cf: number | null;
  ca: number | null;
  cf_pct: number | null;
  ff: number | null;
  fa: number | null;
  ff_pct: number | null;
}

export interface GameRow {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  seasonId: number;
}

export interface LineCombinationRow {
  gameId: number;
  teamId: number;
  forwards: number[];
  defensemen: number[];
  goalies: number[];
}

type ToiSource = RollingPlayerToiSource;

export type SourceTrackingSummary = {
  missingSources: {
    counts: number;
    rates: number;
    countsOi: number;
    pp: number;
    ppUnit: number;
    line: number;
    lineAssignment: number;
    knownGameId: number;
  };
  wgoFallbacks: {
    goals: number;
    assists: number;
    shots: number;
    hits: number;
    blocks: number;
    points: number;
    ixg: number;
  };
  rateReconstructions: {
    sog_per_60: number;
    ixg_per_60: number;
  };
  ixgPer60Sources: Record<IxgPer60ResolutionSource, number>;
  toiSources: Record<ToiSource, number>;
  toiFallbackSeeds: Record<PlayerGameSourceContext["fallbackToiSource"], number>;
  toiTrustTiers: Record<PlayerGameSourceContext["toiTrustTier"], number>;
  toiWgoNormalizations: Record<PlayerGameSourceContext["wgoToiNormalization"], number>;
  toiSuspiciousReasons: Record<RollingPlayerToiSuspiciousReason, number>;
};

interface PlayerProcessingDiagnostics {
  coverageWarningCount: number;
  suspiciousOutputCount: number;
  unknownGameIdCount: number;
  freshnessBlockerCount: number;
  sourceTracking: SourceTrackingSummary;
}

export interface ProcessPlayerResult {
  rows: any[];
  diagnostics: PlayerProcessingDiagnostics;
}

export type RollingPlayerValidationSourceData = {
  games: GameRow[];
  knownGameIds: number[];
  wgoRows: WgoSkaterRow[];
  ppRows: PowerPlayCombinationRow[];
  lineRows: LineCombinationRow[];
  byStrength: Record<
    StrengthState,
    {
      countsRows: NstCountsRow[];
      ratesRows: NstRatesRow[];
      countsOiRows: NstCountsOiRow[];
      mergedGames: PlayerGameData[];
      coverageSummary: ReturnType<typeof summarizeCoverage>;
      sourceTailFreshness: ReturnType<typeof summarizeSourceTailFreshness>;
    }
  >;
};

type RollingPlayerRunSummary = {
  rowsUpserted: number;
  processedPlayers: number;
  playersWithRows: number;
  coverageWarnings: number;
  suspiciousOutputWarnings: number;
  unknownGameIds: number;
  freshnessBlockers: number;
  sourceTracking: SourceTrackingSummary;
};

const cachedPowerPlayCombos = new Map<string, PowerPlayCombinationRow>();
const cachedLineCombosByGame = new Map<number, LineCombinationRow[]>();

function getPowerPlayCacheKey(playerId: number, gameId: number): string {
  return `${playerId}:${gameId}`;
}

type PlayerGameSourceContext = {
  rowSpine: "wgo";
  originalGameId: number | null;
  hasKnownGameId: boolean;
  teamAbbrev: string | null;
  seasonSource: "wgo" | "counts" | "rates" | "missing";
  countsSourcePresent: boolean;
  ratesSourcePresent: boolean;
  countsOiSourcePresent: boolean;
  ppSourcePresent: boolean;
  ppUnitSourcePresent: boolean;
  lineSourcePresent: boolean;
  lineAssignmentSourcePresent: boolean;
  fallbackToiSource: RollingPlayerFallbackToiSource;
  resolvedToiSource: ToiSource;
  toiTrustTier: RollingPlayerToiTrustTier;
  wgoToiNormalization: RollingPlayerWgoToiNormalization;
};

export interface PlayerGameData {
  playerId: number;
  gameId: number | null;
  gameDate: string;
  season: number;
  teamId: number | null;
  strength: StrengthState;
  counts?: NstCountsRow;
  rates?: NstRatesRow;
  countsOi?: NstCountsOiRow;
  wgo?: WgoSkaterRow;
  ppCombination?: PowerPlayCombinationRow | null;
  lineCombo?: {
    slot: number | null;
    positionGroup: "forward" | "defense" | "goalie" | null;
  };
  fallbackToiSeconds?: number | null;
  sourceContext: PlayerGameSourceContext;
}

interface SimpleMetricDefinition {
  key: string;
  aggregation: "simple";
  windowFamily: RollingMetricWindowFamily;
  getValue: (game: PlayerGameData) => number | null;
}

interface RatioMetricDefinition {
  key: string;
  aggregation: "ratio";
  windowFamily: RollingMetricWindowFamily;
  ratioSpec: RatioAggregationSpec;
  getComponents: (game: PlayerGameData) => RatioComponents | null;
}

type MetricDefinition = SimpleMetricDefinition | RatioMetricDefinition;

type SupportMetricDefinition = {
  key: string;
  getValue: (game: PlayerGameData) => number | null;
};

interface RollingAccumulator {
  sumAll: number;
  countAll: number;
  windows: Record<
    RollingWindow,
    { values: number[]; sum: number; count: number }
  >;
}

// Source precedence contract for rolling player metrics:
// 1. WGO is the appearance/date spine. Every per-game rolling row starts from a
//    WGO skater row, even when NST coverage is missing for that date.
// 2. NST counts tables are authoritative for player event totals whenever raw
//    values exist. WGO only fills all-strength gaps for a narrow set of surface
//    stats when NST counts are absent.
// 3. NST on-ice counts tables are authoritative for territorial and on-ice
//    context metrics, and they are the secondary TOI source after NST counts.
// 4. NST rates tables are supplementary only. They may backfill `toi_per_gp`
//    and reconstruct raw numerators for certain `/60` families, but they should
//    not override directly observed raw totals.
// 5. Power-play combination rows provide preferred PP context when available.
//    `pp_share_pct` means player share of total team PP TOI only. Builder-derived
//    `pp_share_of_team` is authoritative, and WGO PPTOI/share reconstruction is
//    fallback-only when builder coverage is missing. Unit-relative fields such
//    as `percentageOfPP` are intentionally excluded from this metric contract.
// 6. Line-combination rows are contextual labels only. They affect role fields
//    such as `line_combo_slot` and `line_combo_group`, not metric math.
function getPoints(game: PlayerGameData): number | null {
  return getPointsValue(game);
}

function getShots(game: PlayerGameData): number | null {
  return getShotsValue(game);
}

function getGoals(game: PlayerGameData): number | null {
  return getGoalsValue(game);
}

function getAssists(game: PlayerGameData): number | null {
  return getAssistsValue(game);
}

function getHits(game: PlayerGameData): number | null {
  return getHitsValue(game);
}

function getBlocks(game: PlayerGameData): number | null {
  return getBlocksValue(game);
}

function getPpShareComponents(game: PlayerGameData): RatioComponents | null {
  if (game.strength !== "all" && game.strength !== "pp") return null;
  return resolvePpShareComponents({
    builderPlayerPpToi: game.ppCombination?.PPTOI ?? null,
    builderTeamShare: game.ppCombination?.pp_share_of_team ?? null,
    wgoPlayerPpToi: game.wgo?.pp_toi ?? null,
    wgoTeamShare: game.wgo?.pp_toi_pct_per_game ?? null
  });
}

function getOptionalPpContextOutputs(game: PlayerGameData): Record<
  "pp_share_of_team" | "pp_unit_usage_index" | "pp_unit_relative_toi" | "pp_vs_unit_avg",
  number | null
> {
  return {
    pp_share_of_team: game.ppCombination?.pp_share_of_team ?? null,
    pp_unit_usage_index: game.ppCombination?.pp_unit_usage_index ?? null,
    pp_unit_relative_toi: game.ppCombination?.pp_unit_relative_toi ?? null,
    pp_vs_unit_avg: game.ppCombination?.pp_vs_unit_avg ?? null
  };
}

const METRICS: MetricDefinition[] = [
  {
    key: "sog_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: getShots(game),
        toiSeconds: getToiSeconds(game),
        per60Rate: game.rates?.shots_per_60 ?? null
      })
  },
  {
    key: "ixg_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolveIxgPer60Components({
        strength: game.strength,
        countsIxg: game.counts?.ixg ?? null,
        wgoIxg: getWgoNumber(game, "ixg"),
        toiSeconds: getToiSeconds(game),
        per60Rate: game.rates?.ixg_per_60 ?? null
      }).components
  },
  {
    key: "goals_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: getGoals(game),
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "assists_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: game.counts?.total_assists ?? null,
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "primary_assists_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: game.counts?.first_assists ?? null,
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "secondary_assists_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: game.counts?.second_assists ?? null,
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "shooting_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "zero"
    },
    getComponents: (game) => ({
      numerator: getGoals(game),
      denominator: getShots(game)
    })
  },
  {
    key: "ixg",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getIxgValue(game)
  },
  {
    key: "primary_points_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 1,
      noPrimaryDenominatorBehavior: "zero"
    },
    getComponents: ({ counts }) => {
      if (!counts) return null;
      return {
        numerator: (counts.goals ?? 0) + (counts.first_assists ?? 0),
        denominator: counts.total_points ?? 0
      };
    }
  },
  {
    key: "expected_sh_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 1,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) => ({
      numerator: resolveIxgValue({
        strength: game.strength,
        countsIxg: game.counts?.ixg ?? null,
        wgoIxg: getWgoNumber(game, "ixg")
      }),
      denominator: getShots(game)
    })
  },
  {
    key: "ipp",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "zero"
    },
    getComponents: (game) => ({
      numerator: getPoints(game),
      denominator: game.countsOi?.gf ?? null
    })
  },
  {
    key: "iscf",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ counts }) => counts?.iscfs ?? null
  },
  {
    key: "ihdcf",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ counts }) => counts?.hdcf ?? null
  },
  {
    key: "oz_starts",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.off_zone_starts ?? null
  },
  {
    key: "dz_starts",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.def_zone_starts ?? null
  },
  {
    key: "nz_starts",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.neu_zone_starts ?? null
  },
  {
    key: "oi_gf",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.gf ?? null
  },
  {
    key: "oi_ga",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.ga ?? null
  },
  {
    key: "oi_sf",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.sf ?? null
  },
  {
    key: "oi_sa",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.sa ?? null
  },
  {
    key: "toi_seconds",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getToiSeconds(game)
  },
  {
    key: "hits_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: getHits(game),
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "blocks_per_60",
    aggregation: "ratio",
    windowFamily: "weighted_rate_performance",
    ratioSpec: {
      scale: 3600,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: getBlocks(game),
        toiSeconds: getToiSeconds(game)
      })
  },
  {
    key: "oz_start_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.off_zone_starts ?? null,
      denominator:
        (countsOi?.off_zone_starts ?? 0) + (countsOi?.def_zone_starts ?? 0)
    })
  },
  {
    key: "pp_share_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 1,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: (game) => getPpShareComponents(game)
  },
  {
    key: "on_ice_sh_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.gf ?? null,
      denominator: countsOi?.sf ?? null
    })
  },
  {
    key: "on_ice_sv_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator:
        countsOi?.sa != null && countsOi?.ga != null
          ? countsOi.sa - countsOi.ga
          : null,
      denominator: countsOi?.sa ?? null
    })
  },
  {
    key: "pdo",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      combine: "sum",
      outputScale: 0.01,
      noPrimaryDenominatorBehavior: "null",
      noSecondaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.gf ?? null,
      denominator: countsOi?.sf ?? null,
      secondaryNumerator:
        countsOi?.sa != null && countsOi?.ga != null
          ? countsOi.sa - countsOi.ga
          : null,
      secondaryDenominator: countsOi?.sa ?? null
    })
  },
  {
    key: "cf",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.cf ?? null
  },
  {
    key: "ca",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.ca ?? null
  },
  {
    key: "cf_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.cf ?? null,
      denominator: (countsOi?.cf ?? 0) + (countsOi?.ca ?? 0)
    })
  },
  {
    key: "ff",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.ff ?? null
  },
  {
    key: "fa",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: ({ countsOi }) => countsOi?.fa ?? null
  },
  {
    key: "ff_pct",
    aggregation: "ratio",
    windowFamily: "ratio_performance",
    ratioSpec: {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.ff ?? null,
      denominator: (countsOi?.ff ?? 0) + (countsOi?.fa ?? 0)
    })
  },
  {
    key: "goals",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getGoals(game)
  },
  {
    key: "assists",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getAssists(game)
  },
  {
    key: "shots",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getShots(game)
  },
  {
    key: "hits",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getHits(game)
  },
  {
    key: "blocks",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getBlocks(game)
  },
  {
    key: "pp_points",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getPpPointsValue(game)
  },
  {
    key: "points",
    aggregation: "simple",
    windowFamily: "additive_performance",
    getValue: (game) => getPoints(game)
  }
];

const SUPPORT_METRICS: SupportMetricDefinition[] = [
  {
    key: "oz_start_neutral_zone_starts",
    getValue: ({ countsOi }) => countsOi?.neu_zone_starts ?? null
  },
  {
    key: "primary_assists_per_60_primary_assists",
    getValue: ({ counts }) => counts?.first_assists ?? null
  },
  {
    key: "secondary_assists_per_60_secondary_assists",
    getValue: ({ counts }) => counts?.second_assists ?? null
  }
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeWithRetry<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt += 1;
      const isLastAttempt = attempt >= MAX_RETRIES;
      const rawMessage = getErrorMessage(error);
      const message =
        rawMessage.length > 800
          ? `${rawMessage.slice(0, 800)}... [truncated ${rawMessage.length - 800} chars]`
          : rawMessage;
      const isGatewayTransient = isTransientGatewayError(error);
      console.warn(
        `[fetchRollingPlayerAverages] ${label} failed (attempt ${attempt}/${MAX_RETRIES})${isGatewayTransient ? " [transient-gateway]" : ""}: ${message}`
      );
      if (isLastAttempt) {
        throw error;
      }
      const baseDelay = isGatewayTransient
        ? RETRY_BASE_DELAY_MS * 5
        : RETRY_BASE_DELAY_MS;
      const exponential = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * Math.min(baseDelay, 2000));
      const waitMs = Math.min(exponential + jitter, RETRY_MAX_DELAY_MS);
      console.info(
        `[fetchRollingPlayerAverages] ${label} retrying in ${waitMs}ms`
      );
      await delay(waitMs);
    }
  }
}

async function executeWithSlowLog<T>(
  label: string,
  fn: () => Promise<T>,
  warnAfterMs = SLOW_OPERATION_WARNING_MS
): Promise<T> {
  const startedAt = Date.now();
  let slowWarningEmitted = false;
  const timer = setTimeout(() => {
    slowWarningEmitted = true;
    console.warn(
      `[fetchRollingPlayerAverages] Slow operation still running after ${formatDuration(warnAfterMs)}: ${label}`
    );
  }, warnAfterMs);

  try {
    return await fn();
  } finally {
    clearTimeout(timer);
    const durationMs = Date.now() - startedAt;
    if (slowWarningEmitted || durationMs >= warnAfterMs) {
      console.info(
        `[fetchRollingPlayerAverages] Slow operation completed in ${formatDuration(durationMs)}: ${label}`
      );
    }
  }
}

function resolveToiContext(args: {
  counts?: NstCountsRow;
  countsOi?: NstCountsOiRow;
  rates?: NstRatesRow;
  fallbackToiSeconds?: number | null;
  wgo?: WgoSkaterRow;
}): {
  seconds: number | null;
  source: ToiSource;
  trustTier: RollingPlayerToiTrustTier;
  rejectedCandidates: {
    source: Exclude<RollingPlayerToiSource, "none">;
    reason: RollingPlayerToiSuspiciousReason;
  }[];
  wgoNormalization: RollingPlayerWgoToiNormalization;
} {
  return resolveRollingPlayerToiContext({
    countsToi: args.counts?.toi ?? null,
    countsOiToi: args.countsOi?.toi ?? null,
    ratesToiPerGp: args.rates?.toi_per_gp ?? null,
    fallbackToiSeconds: args.fallbackToiSeconds,
    wgoToiPerGame: args.wgo?.toi_per_game ?? null
  });
}

function getToiContext(game: PlayerGameData): {
  seconds: number | null;
  source: ToiSource;
  trustTier: RollingPlayerToiTrustTier;
  rejectedCandidates: {
    source: Exclude<RollingPlayerToiSource, "none">;
    reason: RollingPlayerToiSuspiciousReason;
  }[];
  wgoNormalization: RollingPlayerWgoToiNormalization;
} {
  return resolveToiContext({
    counts: game.counts,
    countsOi: game.countsOi,
    rates: game.rates,
    fallbackToiSeconds: game.fallbackToiSeconds,
    wgo: game.wgo
  });
}

function getToiSeconds(game: PlayerGameData): number | null {
  return getToiContext(game).seconds;
}

function getWgoNumber(game: PlayerGameData, key: string): number | null {
  const source = game.wgo as Record<string, unknown> | undefined;
  if (!source) return null;
  const raw = source[key];
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

const abbrevToTeamId = Object.entries(teamsInfo).reduce<Record<string, number>>(
  (acc, [abbr, info]) => {
    acc[abbr] = info.id;
    return acc;
  },
  {}
);

type TeamGameLedger = Record<
  string,
  {
    date: string;
    cumulative: number;
  }[]
>;

function buildTeamGameLedger(games: GameRow[]): TeamGameLedger {
  const ledger: TeamGameLedger = {};
  const pushGame = (teamId: number, seasonId: number, date: string) => {
    const key = `${teamId}:${seasonId}`;
    if (!ledger[key]) {
      ledger[key] = [];
    }
    ledger[key].push({ date, cumulative: 0 });
  };

  games.forEach((game) => {
    pushGame(game.homeTeamId, game.seasonId, game.date);
    pushGame(game.awayTeamId, game.seasonId, game.date);
  });

  for (const key of Object.keys(ledger)) {
    const entries = ledger[key];
    entries.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    for (const entry of entries) {
      running += 1;
      entry.cumulative = running;
    }
  }

  return ledger;
}

function getTeamGamesPlayed(
  ledger: TeamGameLedger,
  teamId: number | null,
  seasonId: number,
  date: string
): number {
  if (!teamId) return 0;
  const entries = ledger[`${teamId}:${seasonId}`];
  if (!entries) return 0;
  let left = 0;
  let right = entries.length - 1;
  let result = 0;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midDate = entries[mid].date;
    if (midDate <= date) {
      result = entries[mid].cumulative;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return result;
}

function initAccumulator(): RollingAccumulator {
  const windows: RollingAccumulator["windows"] = {
    3: { values: [], sum: 0, count: 0 },
    5: { values: [], sum: 0, count: 0 },
    10: { values: [], sum: 0, count: 0 },
    20: { values: [], sum: 0, count: 0 }
  };
  return { sumAll: 0, countAll: 0, windows };
}

function getSeasonWindowKey(season: number): number {
  if (!Number.isFinite(season)) return season;
  return season >= 10000000 ? Math.floor(season / 10000) : season;
}

function toStoredTotal(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Number(sum.toFixed(6));
}

function getRollingSimpleTotalSnapshot(acc: RollingAccumulator): {
  all: number | null;
  windows: Record<RollingWindow, number | null>;
} {
  return {
    all: toStoredTotal(acc.sumAll, acc.countAll),
    windows: ROLLING_WINDOWS.reduce<Record<RollingWindow, number | null>>(
      (result, size) => {
        result[size] = toStoredTotal(acc.windows[size].sum, acc.windows[size].count);
        return result;
      },
      {} as Record<RollingWindow, number | null>
    )
  };
}

function getHistoricalSimpleTotalSnapshot(
  acc: ReturnType<typeof createHistoricalAverageAccumulator>,
  currentSeason: number
): {
  season: number | null;
  threeYear: number | null;
  career: number | null;
} {
  const currentSeasonKey = getSeasonWindowKey(currentSeason);
  const seasonBucket = acc.bySeason.get(currentSeason);
  let threeYearSum = 0;
  let threeYearCount = 0;

  for (const [season, bucket] of acc.bySeason.entries()) {
    const seasonKey = getSeasonWindowKey(season);
    if (seasonKey < currentSeasonKey - 2 || seasonKey > currentSeasonKey) {
      continue;
    }
    threeYearSum += bucket.sum;
    threeYearCount += bucket.count;
  }

  return {
    season: seasonBucket ? toStoredTotal(seasonBucket.sum, seasonBucket.count) : null,
    threeYear: toStoredTotal(threeYearSum, threeYearCount),
    career: toStoredTotal(acc.careerSum, acc.careerCount)
  };
}

function applyCanonicalScopedSnapshotOutputs(
  output: Record<string, number | null>,
  metricKey: string,
  rollingSnapshot: {
    all: number | null;
    windows: Record<RollingWindow, number | null>;
  },
  historicalSnapshot: {
    season: number | null;
    threeYear: number | null;
    career: number | null;
  }
): void {
  output[`${metricKey}_all`] = rollingSnapshot.all;
  output[`${metricKey}_season`] = historicalSnapshot.season;
  output[`${metricKey}_3ya`] = historicalSnapshot.threeYear;
  output[`${metricKey}_career`] = historicalSnapshot.career;

  ROLLING_WINDOWS.forEach((size) => {
    output[`${metricKey}_last${size}`] = rollingSnapshot.windows[size];
  });
}

function getSupportAccumulatorTotal(
  acc: Record<string, RollingAccumulator>,
  key: string,
  size?: RollingWindow
): number | null {
  const target = acc[key];
  if (!target) return null;
  if (size) {
    return toStoredTotal(target.windows[size].sum, target.windows[size].count);
  }
  return toStoredTotal(target.sumAll, target.countAll);
}

function getHistoricalSupportAccumulatorTotal(
  acc: Record<string, ReturnType<typeof createHistoricalAverageAccumulator>>,
  key: string,
  currentSeason: number,
  scope: "season" | "threeYear" | "career"
): number | null {
  const target = acc[key];
  if (!target) return null;
  const snapshot = getHistoricalSimpleTotalSnapshot(target, currentSeason);
  if (scope === "season") return snapshot.season;
  if (scope === "threeYear") return snapshot.threeYear;
  return snapshot.career;
}

function getDerivedGoalsAgainstValue(totals: RatioComponentTotals): number | null {
  if (totals.count <= 0 || totals.secondaryDenominator <= 0) return null;
  return Number((totals.secondaryDenominator - totals.secondaryNumerator).toFixed(6));
}

function getRatioComponentValue(
  totals: RatioComponentTotals,
  key: keyof RatioComponentTotals
): number | null {
  if (totals.count <= 0) return null;
  return Number(totals[key].toFixed(6));
}

function applyRatioSupportOutputs(
  output: Record<string, number | null>,
  metricKey: string,
  rollingComponents: {
    all: RatioComponentTotals;
    windows: Record<RollingWindow, RatioComponentTotals>;
  },
  historicalComponents: {
    season: RatioComponentTotals;
    threeYear: RatioComponentTotals;
    career: RatioComponentTotals;
  },
  historicalSimpleMetricsState: Record<
    string,
    ReturnType<typeof createHistoricalAverageAccumulator>
  >,
  supportMetricsState: Record<string, RollingAccumulator>,
  historicalSupportMetricsState: Record<
    string,
    ReturnType<typeof createHistoricalAverageAccumulator>
  >,
  currentSeason: number
): void {
  const setWindowPair = (
    firstPrefix: string,
    secondPrefix: string,
    firstKey: keyof RatioComponentTotals,
    secondKey: keyof RatioComponentTotals
  ) => {
    output[`${firstPrefix}_all`] = getRatioComponentValue(
      rollingComponents.all,
      firstKey
    );
    output[`${secondPrefix}_all`] = getRatioComponentValue(
      rollingComponents.all,
      secondKey
    );

    ROLLING_WINDOWS.forEach((size) => {
      output[`${
        firstPrefix
      }_last${size}`] = getRatioComponentValue(rollingComponents.windows[size], firstKey);
      output[`${
        secondPrefix
      }_last${size}`] = getRatioComponentValue(
        rollingComponents.windows[size],
        secondKey
      );
    });

    output[`${firstPrefix}_season`] = getRatioComponentValue(
      historicalComponents.season,
      firstKey
    );
    output[`${secondPrefix}_season`] = getRatioComponentValue(
      historicalComponents.season,
      secondKey
    );
    output[`${firstPrefix}_3ya`] = getRatioComponentValue(
      historicalComponents.threeYear,
      firstKey
    );
    output[`${secondPrefix}_3ya`] = getRatioComponentValue(
      historicalComponents.threeYear,
      secondKey
    );
    output[`${firstPrefix}_career`] = getRatioComponentValue(
      historicalComponents.career,
      firstKey
    );
    output[`${secondPrefix}_career`] = getRatioComponentValue(
      historicalComponents.career,
      secondKey
    );
  };

  switch (metricKey) {
    case "primary_points_pct":
      setWindowPair(
        "primary_points_pct_primary_points",
        "primary_points_pct_points",
        "numerator",
        "denominator"
      );
      return;
    case "ipp":
      setWindowPair("ipp_points", "ipp_on_ice_goals_for", "numerator", "denominator");
      return;
    case "on_ice_sh_pct":
      setWindowPair(
        "on_ice_sh_pct_goals_for",
        "on_ice_sh_pct_shots_for",
        "numerator",
        "denominator"
      );
      return;
    case "pp_share_pct":
      setWindowPair(
        "pp_share_pct_player_pp_toi",
        "pp_share_pct_team_pp_toi",
        "numerator",
        "denominator"
      );
      return;
    case "pdo":
      output.pdo_goals_for_all = getRatioComponentValue(
        rollingComponents.all,
        "numerator"
      );
      output.pdo_shots_for_all = getRatioComponentValue(
        rollingComponents.all,
        "denominator"
      );
      output.pdo_shots_against_all = getRatioComponentValue(
        rollingComponents.all,
        "secondaryDenominator"
      );
      output.pdo_goals_against_all = getDerivedGoalsAgainstValue(rollingComponents.all);
      ROLLING_WINDOWS.forEach((size) => {
        output[`pdo_goals_for_last${size}`] = getRatioComponentValue(
          rollingComponents.windows[size],
          "numerator"
        );
        output[`pdo_shots_for_last${size}`] = getRatioComponentValue(
          rollingComponents.windows[size],
          "denominator"
        );
        output[`pdo_shots_against_last${size}`] = getRatioComponentValue(
          rollingComponents.windows[size],
          "secondaryDenominator"
        );
        output[`pdo_goals_against_last${size}`] = getDerivedGoalsAgainstValue(
          rollingComponents.windows[size]
        );
      });
      output.pdo_goals_for_season = getRatioComponentValue(
        historicalComponents.season,
        "numerator"
      );
      output.pdo_shots_for_season = getRatioComponentValue(
        historicalComponents.season,
        "denominator"
      );
      output.pdo_shots_against_season = getRatioComponentValue(
        historicalComponents.season,
        "secondaryDenominator"
      );
      output.pdo_goals_against_season = getDerivedGoalsAgainstValue(
        historicalComponents.season
      );
      output.pdo_goals_for_3ya = getRatioComponentValue(
        historicalComponents.threeYear,
        "numerator"
      );
      output.pdo_shots_for_3ya = getRatioComponentValue(
        historicalComponents.threeYear,
        "denominator"
      );
      output.pdo_shots_against_3ya = getRatioComponentValue(
        historicalComponents.threeYear,
        "secondaryDenominator"
      );
      output.pdo_goals_against_3ya = getDerivedGoalsAgainstValue(
        historicalComponents.threeYear
      );
      output.pdo_goals_for_career = getRatioComponentValue(
        historicalComponents.career,
        "numerator"
      );
      output.pdo_shots_for_career = getRatioComponentValue(
        historicalComponents.career,
        "denominator"
      );
      output.pdo_shots_against_career = getRatioComponentValue(
        historicalComponents.career,
        "secondaryDenominator"
      );
      output.pdo_goals_against_career = getDerivedGoalsAgainstValue(
        historicalComponents.career
      );
      return;
    case "oz_start_pct":
      output.oz_start_pct_off_zone_starts_all = getRatioComponentValue(
        rollingComponents.all,
        "numerator"
      );
      output.oz_start_pct_def_zone_starts_all =
        rollingComponents.all.denominator > 0
          ? Number(
              (rollingComponents.all.denominator - rollingComponents.all.numerator).toFixed(
                6
              )
            )
          : null;
      output.oz_start_pct_neutral_zone_starts_all = getSupportAccumulatorTotal(
        supportMetricsState,
        "oz_start_neutral_zone_starts"
      );
      ROLLING_WINDOWS.forEach((size) => {
        const components = rollingComponents.windows[size];
        output[`oz_start_pct_off_zone_starts_last${size}`] = getRatioComponentValue(
          components,
          "numerator"
        );
        output[`oz_start_pct_def_zone_starts_last${size}`] =
          components.denominator > 0
            ? Number((components.denominator - components.numerator).toFixed(6))
            : null;
        output[`oz_start_pct_neutral_zone_starts_last${size}`] =
          getSupportAccumulatorTotal(
            supportMetricsState,
            "oz_start_neutral_zone_starts",
            size
          );
      });
      output.oz_start_pct_off_zone_starts_season = getRatioComponentValue(
        historicalComponents.season,
        "numerator"
      );
      output.oz_start_pct_def_zone_starts_season =
        historicalComponents.season.denominator > 0
          ? Number(
              (
                historicalComponents.season.denominator -
                historicalComponents.season.numerator
              ).toFixed(6)
            )
          : null;
      output.oz_start_pct_neutral_zone_starts_season =
        getHistoricalSupportAccumulatorTotal(
          historicalSupportMetricsState,
          "oz_start_neutral_zone_starts",
          currentSeason,
          "season"
        );
      output.oz_start_pct_off_zone_starts_3ya = getRatioComponentValue(
        historicalComponents.threeYear,
        "numerator"
      );
      output.oz_start_pct_def_zone_starts_3ya =
        historicalComponents.threeYear.denominator > 0
          ? Number(
              (
                historicalComponents.threeYear.denominator -
                historicalComponents.threeYear.numerator
              ).toFixed(6)
            )
          : null;
      output.oz_start_pct_neutral_zone_starts_3ya =
        getHistoricalSupportAccumulatorTotal(
          historicalSupportMetricsState,
          "oz_start_neutral_zone_starts",
          currentSeason,
          "threeYear"
        );
      output.oz_start_pct_off_zone_starts_career = getRatioComponentValue(
        historicalComponents.career,
        "numerator"
      );
      output.oz_start_pct_def_zone_starts_career =
        historicalComponents.career.denominator > 0
          ? Number(
              (
                historicalComponents.career.denominator -
                historicalComponents.career.numerator
              ).toFixed(6)
            )
          : null;
      output.oz_start_pct_neutral_zone_starts_career =
        getHistoricalSupportAccumulatorTotal(
          historicalSupportMetricsState,
          "oz_start_neutral_zone_starts",
          currentSeason,
          "career"
        );
      return;
    case "shooting_pct":
    case "expected_sh_pct":
    case "cf_pct":
    case "ff_pct":
    case "sog_per_60":
    case "ixg_per_60":
    case "goals_per_60":
    case "assists_per_60":
    case "primary_assists_per_60":
    case "secondary_assists_per_60":
    case "hits_per_60":
    case "blocks_per_60":
      break;
    default:
      return;
  }

  const simpleSupportPairs: Record<
    string,
    { numeratorKey: string; denominatorKey: string; numeratorPrefix: string; denominatorPrefix: string }
  > = {
    shooting_pct: {
      numeratorKey: "goals",
      denominatorKey: "shots",
      numeratorPrefix: "shooting_pct_goals",
      denominatorPrefix: "shooting_pct_shots"
    },
    expected_sh_pct: {
      numeratorKey: "ixg",
      denominatorKey: "shots",
      numeratorPrefix: "expected_sh_pct_ixg",
      denominatorPrefix: "expected_sh_pct_shots"
    },
    cf_pct: {
      numeratorKey: "cf",
      denominatorKey: "ca",
      numeratorPrefix: "cf_pct_cf",
      denominatorPrefix: "cf_pct_ca"
    },
    ff_pct: {
      numeratorKey: "ff",
      denominatorKey: "fa",
      numeratorPrefix: "ff_pct_ff",
      denominatorPrefix: "ff_pct_fa"
    },
    sog_per_60: {
      numeratorKey: "shots",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "sog_per_60_shots",
      denominatorPrefix: "sog_per_60_toi_seconds"
    },
    ixg_per_60: {
      numeratorKey: "ixg",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "ixg_per_60_ixg",
      denominatorPrefix: "ixg_per_60_toi_seconds"
    },
    goals_per_60: {
      numeratorKey: "goals",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "goals_per_60_goals",
      denominatorPrefix: "goals_per_60_toi_seconds"
    },
    assists_per_60: {
      numeratorKey: "assists",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "assists_per_60_assists",
      denominatorPrefix: "assists_per_60_toi_seconds"
    },
    primary_assists_per_60: {
      numeratorKey: "primary_assists_per_60_primary_assists",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "primary_assists_per_60_primary_assists",
      denominatorPrefix: "primary_assists_per_60_toi_seconds"
    },
    secondary_assists_per_60: {
      numeratorKey: "secondary_assists_per_60_secondary_assists",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "secondary_assists_per_60_secondary_assists",
      denominatorPrefix: "secondary_assists_per_60_toi_seconds"
    },
    hits_per_60: {
      numeratorKey: "hits",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "hits_per_60_hits",
      denominatorPrefix: "hits_per_60_toi_seconds"
    },
    blocks_per_60: {
      numeratorKey: "blocks",
      denominatorKey: "toi_seconds",
      numeratorPrefix: "blocks_per_60_blocks",
      denominatorPrefix: "blocks_per_60_toi_seconds"
    }
  };

  const pair = simpleSupportPairs[metricKey];
  if (!pair) return;

  output[`${pair.numeratorPrefix}_season`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.numeratorKey,
    currentSeason,
    "season"
  );
  output[`${pair.denominatorPrefix}_season`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.denominatorKey,
    currentSeason,
    "season"
  );
  output[`${pair.numeratorPrefix}_3ya`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.numeratorKey,
    currentSeason,
    "threeYear"
  );
  output[`${pair.denominatorPrefix}_3ya`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.denominatorKey,
    currentSeason,
    "threeYear"
  );
  output[`${pair.numeratorPrefix}_career`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.numeratorKey,
    currentSeason,
    "career"
  );
  output[`${pair.denominatorPrefix}_career`] = getHistoricalSupportAccumulatorTotal(
    historicalSimpleMetricsState,
    pair.denominatorKey,
    currentSeason,
    "career"
  );
}

function createEmptySourceTrackingSummary(): SourceTrackingSummary {
  return {
    missingSources: {
      counts: 0,
      rates: 0,
      countsOi: 0,
      pp: 0,
      ppUnit: 0,
      line: 0,
      lineAssignment: 0,
      knownGameId: 0
    },
    wgoFallbacks: {
      goals: 0,
      assists: 0,
      shots: 0,
      hits: 0,
      blocks: 0,
      points: 0,
      ixg: 0
    },
    rateReconstructions: {
      sog_per_60: 0,
      ixg_per_60: 0
    },
    ixgPer60Sources: {
      counts_raw: 0,
      wgo_raw: 0,
      rate_reconstruction: 0,
      unavailable: 0
    },
    toiSources: {
      counts: 0,
      counts_oi: 0,
      rates: 0,
      fallback: 0,
      wgo: 0,
      none: 0
    },
    toiFallbackSeeds: {
      counts: 0,
      counts_oi: 0,
      wgo: 0,
      none: 0
    },
    toiTrustTiers: {
      authoritative: 0,
      supplementary: 0,
      fallback: 0,
      none: 0
    },
    toiWgoNormalizations: {
      minutes_to_seconds: 0,
      already_seconds: 0,
      missing: 0,
      invalid: 0
    },
    toiSuspiciousReasons: {
      non_finite: 0,
      non_positive: 0,
      above_max_seconds: 0
    }
  };
}

function mergeSourceTrackingSummary(
  target: SourceTrackingSummary,
  incoming: SourceTrackingSummary
): void {
  for (const key of Object.keys(
    target.missingSources
  ) as (keyof SourceTrackingSummary["missingSources"])[]) {
    target.missingSources[key] += incoming.missingSources[key];
  }
  for (const key of Object.keys(
    target.wgoFallbacks
  ) as (keyof SourceTrackingSummary["wgoFallbacks"])[]) {
    target.wgoFallbacks[key] += incoming.wgoFallbacks[key];
  }
  for (const key of Object.keys(
    target.rateReconstructions
  ) as (keyof SourceTrackingSummary["rateReconstructions"])[]) {
    target.rateReconstructions[key] += incoming.rateReconstructions[key];
  }
  for (const key of Object.keys(
    target.ixgPer60Sources
  ) as IxgPer60ResolutionSource[]) {
    target.ixgPer60Sources[key] += incoming.ixgPer60Sources[key];
  }
  for (const key of Object.keys(target.toiSources) as ToiSource[]) {
    target.toiSources[key] += incoming.toiSources[key];
  }
  for (const key of Object.keys(
    target.toiFallbackSeeds
  ) as PlayerGameSourceContext["fallbackToiSource"][]) {
    target.toiFallbackSeeds[key] += incoming.toiFallbackSeeds[key];
  }
  for (const key of Object.keys(
    target.toiTrustTiers
  ) as PlayerGameSourceContext["toiTrustTier"][]) {
    target.toiTrustTiers[key] += incoming.toiTrustTiers[key];
  }
  for (const key of Object.keys(
    target.toiWgoNormalizations
  ) as PlayerGameSourceContext["wgoToiNormalization"][]) {
    target.toiWgoNormalizations[key] += incoming.toiWgoNormalizations[key];
  }
  for (const key of Object.keys(
    target.toiSuspiciousReasons
  ) as RollingPlayerToiSuspiciousReason[]) {
    target.toiSuspiciousReasons[key] += incoming.toiSuspiciousReasons[key];
  }
}

function updateAccumulator(
  acc: RollingAccumulator,
  value: number | null
): void {
  if (value === null || Number.isNaN(value)) {
    return;
  }
  acc.sumAll += value;
  acc.countAll += 1;
  ROLLING_WINDOWS.forEach((size) => {
    const window = acc.windows[size];
    window.values.push(value);
    window.sum += value;
    window.count += 1;
    if (window.values.length > size) {
      const removed = window.values.shift();
      if (removed !== undefined) {
        window.sum -= removed;
        window.count -= 1;
      }
    }
  });
}

function buildRunSummary(args: RollingPlayerRunSummary): RollingPlayerRunSummary {
  return {
    rowsUpserted: args.rowsUpserted,
    processedPlayers: args.processedPlayers,
    playersWithRows: args.playersWithRows,
    coverageWarnings: args.coverageWarnings,
    suspiciousOutputWarnings: args.suspiciousOutputWarnings,
    unknownGameIds: args.unknownGameIds,
    freshnessBlockers: args.freshnessBlockers,
    sourceTracking: args.sourceTracking
  };
}

function didPlayerCountAsAppearance(
  strength: StrengthState,
  game: PlayerGameData
): boolean {
  if (strength === "all") {
    return true;
  }

  const toiSeconds = getToiSeconds(game);
  return toiSeconds != null && toiSeconds > 0;
}

type GpOutputCompatibilityMode = {
  semanticType: AvailabilitySemanticType;
  emitAvailabilityAliases: boolean;
  legacyGpFieldMode:
    | "derived_aliases_from_canonical_availability"
    | "legacy_gp_fields_only_until_participation_schema";
};

function getGpOutputCompatibilityMode(
  strength: StrengthState
): GpOutputCompatibilityMode {
  if (strength === "all") {
    return {
      semanticType:
        ROLLING_PLAYER_AVAILABILITY_CONTRACT.intendedReplacement.allStrength
          .semanticType,
      emitAvailabilityAliases: true,
      legacyGpFieldMode: "derived_aliases_from_canonical_availability"
    };
  }

  return {
    semanticType:
      ROLLING_PLAYER_AVAILABILITY_CONTRACT.intendedReplacement.splitStrength
        .semanticType,
    emitAvailabilityAliases: false,
    legacyGpFieldMode: "legacy_gp_fields_only_until_participation_schema"
  };
}

function applyLegacyGpAliases(
  output: Record<string, number | null>,
  historicalGpPctSnapshot: ReturnType<typeof getHistoricalGpPctSnapshot>,
  rollingGpPctSnapshot: ReturnType<typeof getRollingGpPctSnapshot>,
  mode: GpOutputCompatibilityMode
): void {
  if (mode.legacyGpFieldMode === "derived_aliases_from_canonical_availability") {
    // These legacy columns are transitional aliases only. `gp_pct_avg_*` does
    // not describe a distinct averaging pass; it mirrors the canonical
    // availability fields until schema cleanup removes the duplicate surface.
    output.gp_pct_total_all = output.season_availability_pct;
    output.gp_pct_avg_all = output.gp_pct_total_all;
    output.gp_pct_avg_season = output.season_availability_pct;
    output.gp_pct_avg_3ya = output.three_year_availability_pct;
    output.gp_pct_avg_career = output.career_availability_pct;

    ROLLING_WINDOWS.forEach((size) => {
      output[`gp_pct_total_last${size}`] =
        output[`availability_pct_last${size}_team_games`];
      output[`gp_pct_avg_last${size}`] = output[`gp_pct_total_last${size}`];
    });
    return;
  }

  output.gp_pct_total_all = historicalGpPctSnapshot.season;
  output.gp_pct_avg_all = output.gp_pct_total_all;
  output.gp_pct_avg_season = historicalGpPctSnapshot.season;
  output.gp_pct_avg_3ya = historicalGpPctSnapshot.threeYear;
  output.gp_pct_avg_career = historicalGpPctSnapshot.career;

  ROLLING_WINDOWS.forEach((size) => {
    const window = rollingGpPctSnapshot.windows[size];
    output[`gp_pct_total_last${size}`] = window.ratio;
    output[`gp_pct_avg_last${size}`] = output[`gp_pct_total_last${size}`];
  });
}

function applyGpOutputs(
  output: Record<string, number | null>,
  historicalGpPctSnapshot: ReturnType<typeof getHistoricalGpPctSnapshot>,
  rollingGpPctSnapshot: ReturnType<typeof getRollingGpPctSnapshot>,
  strength: StrengthState
): void {
  const mode = getGpOutputCompatibilityMode(strength);

  output.games_played = historicalGpPctSnapshot.seasonPlayerGames;
  output.team_games_played = historicalGpPctSnapshot.seasonTeamGames;
  // Raw numerator / denominator support fields stay populated for every
  // strength state so traded-player scope, missed games, and split-strength
  // participation windows can be audited directly from stored rows.
  output.season_games_played = historicalGpPctSnapshot.seasonPlayerGames;
  output.season_team_games_available = historicalGpPctSnapshot.seasonTeamGames;
  output.three_year_games_played = historicalGpPctSnapshot.threeYearPlayerGames;
  output.three_year_team_games_available =
    historicalGpPctSnapshot.threeYearTeamGames;
  output.career_games_played = historicalGpPctSnapshot.careerPlayerGames;
  output.career_team_games_available = historicalGpPctSnapshot.careerTeamGames;

  if (mode.emitAvailabilityAliases) {
    // All-strength rows use the replacement availability aliases directly.
    output.season_availability_pct = historicalGpPctSnapshot.season;
    output.three_year_availability_pct = historicalGpPctSnapshot.threeYear;
    output.career_availability_pct = historicalGpPctSnapshot.career;
  } else {
    // Split strengths are still stored through legacy GP fields during the
    // transition. Their ratios mean state participation with positive TOI, not
    // ordinary games played, so suppress the availability-named aliases until
    // the participation schema lands in a later migration task.
    output.season_availability_pct = null;
    output.three_year_availability_pct = null;
    output.career_availability_pct = null;
  }

  output.season_participation_games = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.seasonPlayerGames;
  output.three_year_participation_games = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.threeYearPlayerGames;
  output.career_participation_games = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.careerPlayerGames;
  output.season_participation_pct = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.season;
  output.three_year_participation_pct = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.threeYear;
  output.career_participation_pct = mode.emitAvailabilityAliases
    ? null
    : historicalGpPctSnapshot.career;

  ROLLING_WINDOWS.forEach((size) => {
    const window = rollingGpPctSnapshot.windows[size];
    output[`games_played_last${size}_team_games`] = window.playerGames;
    output[`team_games_available_last${size}`] = window.teamGames;
    output[`participation_games_last${size}_team_games`] = mode.emitAvailabilityAliases
      ? null
      : window.playerGames;
    output[`availability_pct_last${size}_team_games`] = mode.emitAvailabilityAliases
      ? window.ratio
      : null;
    output[`participation_pct_last${size}_team_games`] = mode.emitAvailabilityAliases
      ? null
      : window.ratio;
  });

  applyLegacyGpAliases(output, historicalGpPctSnapshot, rollingGpPctSnapshot, mode);
}

function deriveOutputs(
  simpleMetricsState: Record<string, RollingAccumulator>,
  ratioMetricsState: Record<string, RatioRollingAccumulator>,
  supportMetricsState: Record<string, RollingAccumulator>,
  historicalSimpleMetricsState: Record<
    string,
    ReturnType<typeof createHistoricalAverageAccumulator>
  >,
  historicalSupportMetricsState: Record<
    string,
    ReturnType<typeof createHistoricalAverageAccumulator>
  >,
  historicalRatioMetricsState: Record<string, HistoricalRatioAccumulator>,
  historicalGpPctSnapshot: ReturnType<typeof getHistoricalGpPctSnapshot>,
  rollingGpPctSnapshot: ReturnType<typeof getRollingGpPctSnapshot>,
  currentSeason: number,
  strength: StrengthState
) {
  const output: Record<string, number | null> = {};
  // Availability outputs are being migrated away from the legacy `gp_pct_*`
  // family. The canonical replacement contract is shared in
  // `rollingPlayerAvailabilityContract.ts`; legacy `gp_pct_*` fields remain as
  // compatibility aliases until later schema tasks complete the transition.
  // Split-strength rows intentionally suppress availability-named aliases here
  // because those rows represent positive-TOI participation, not ordinary
  // player availability.
  for (const metric of METRICS) {
    if (metric.aggregation === "ratio") {
      const acc = ratioMetricsState[metric.key];
      if (!acc) continue;
      const snapshot = getRatioRollingSnapshot(acc, metric.ratioSpec);
      const componentSnapshot = getRatioRollingComponentSnapshot(acc);
      output[`${metric.key}_total_all`] = snapshot.all;
      output[`${metric.key}_avg_all`] = snapshot.all;

      const historical = historicalRatioMetricsState[metric.key];
      const historicalSnapshot = getHistoricalRatioSnapshot(
        historical,
        currentSeason,
        metric.ratioSpec
      );
      const historicalComponentSnapshot = getHistoricalRatioComponentSnapshot(
        historical,
        currentSeason
      );
      output[`${metric.key}_avg_season`] = historicalSnapshot.season;
      output[`${metric.key}_avg_3ya`] = historicalSnapshot.threeYear;
      output[`${metric.key}_avg_career`] = historicalSnapshot.career;

      ROLLING_WINDOWS.forEach((size) => {
        output[`${metric.key}_total_last${size}`] = snapshot.windows[size];
        output[`${metric.key}_avg_last${size}`] = snapshot.windows[size];
      });
      applyCanonicalScopedSnapshotOutputs(
        output,
        metric.key,
        snapshot,
        historicalSnapshot
      );
      applyRatioSupportOutputs(
        output,
        metric.key,
        componentSnapshot,
        historicalComponentSnapshot,
        historicalSimpleMetricsState,
        supportMetricsState,
        historicalSupportMetricsState,
        currentSeason
      );
      continue;
    }

    const acc = simpleMetricsState[metric.key];
    if (!acc) continue;
    const totalAll = Number(acc.sumAll) || 0;
    output[`${metric.key}_total_all`] =
      acc.countAll > 0 ? Number(totalAll.toFixed(6)) : null;
    output[`${metric.key}_avg_all`] =
      acc.countAll > 0 ? Number((totalAll / acc.countAll).toFixed(6)) : null;
    const historical = historicalSimpleMetricsState[metric.key];
    const historicalSnapshot = getHistoricalAverageSnapshot(historical, currentSeason);
    output[`${metric.key}_avg_season`] = historicalSnapshot.season;
    output[`${metric.key}_avg_3ya`] = historicalSnapshot.threeYear;
    output[`${metric.key}_avg_career`] = historicalSnapshot.career;
    ROLLING_WINDOWS.forEach((size) => {
      const window = acc.windows[size];
      const windowSum = Number(window.sum) || 0;
      output[`${metric.key}_total_last${size}`] =
        window.count > 0 ? Number(windowSum.toFixed(6)) : null;
      output[`${metric.key}_avg_last${size}`] =
        window.count > 0 ? Number((windowSum / window.count).toFixed(6)) : null;
    });
  }
  // Season availability is intentionally player-season scoped across all team
  // stints represented in the accumulator. It should not collapse to the
  // current team only after a trade.
  applyGpOutputs(output, historicalGpPctSnapshot, rollingGpPctSnapshot, strength);
  return output;
}

async function fetchGames(): Promise<GameRow[]> {
  const rows: GameRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const chunk = await executeWithRetry<GameRow[]>(
      `games chunk offset:${from}`,
      async () => {
        const { data, error } = await supabase
          .from("games")
          .select("id, date, homeTeamId, awayTeamId, seasonId")
          .order("date", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return (data ?? []) as GameRow[];
      }
    );
    if (!chunk.length) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchWgoRowsForPlayer(
  playerId: number,
  options: FetchOptions
): Promise<WgoSkaterRow[]> {
  const rows: WgoSkaterRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("wgo_skater_stats")
      .select(
        "player_id, game_id, date, season_id, team_abbrev, current_team_abbreviation, goals, assists, shots, shooting_percentage, hits, blocked_shots, points, pp_points, pp_toi, pp_toi_pct_per_game, toi_per_game"
      )
      .eq("player_id", playerId)
      .order("date", { ascending: true })
      .order("game_id", { ascending: true, nullsFirst: true })
      .range(from, from + pageSize - 1);

    if (options.season) {
      query = query.eq("season_id", options.season);
    }
    if (options.startDate) {
      query = query.gte("date", options.startDate);
    }
    if (options.endDate) {
      query = query.lte("date", options.endDate);
    }

    const data = await executeWithRetry<WgoSkaterRow[]>(
      `wgo player:${playerId} offset:${from}`,
      async () => {
        const { data, error } = await query;
        if (error) throw error;
        return ((data ?? []) as WgoSkaterRow[]).map((row) =>
          normalizeNumericFields(row)
        );
      }
    );
    if (!data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchPlayerIds(options: FetchOptions): Promise<number[]> {
  if (options.playerId) return [options.playerId];
  const ids: number[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const data = await executeWithRetry<{ id: number }[]>(
      `players offset:${from}`,
      async () => {
        const { data, error } = await supabase
          .from("players")
          .select("id")
          .neq("position", "G")
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return (data ?? []) as { id: number }[];
      }
    );
    if (!data.length) break;
    ids.push(
      ...data.map((row) => row.id).filter((id) => typeof id === "number")
    );
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

function shouldWarnAboutDisabledImplicitAutoResume(options: FetchOptions): boolean {
  return (
    options.resumePlayerId === undefined &&
    !options.forceFullRefresh &&
    options.playerId === undefined &&
    options.season === undefined &&
    options.startDate === undefined &&
    options.endDate === undefined
  );
}

function filterPlayerIdsForResume(
  playerIds: number[],
  resumePlayerId?: number
): number[] {
  return resumePlayerId !== undefined
    ? playerIds.filter((id) => id > resumePlayerId)
    : playerIds;
}

async function fetchCounts(
  tableName: string,
  playerId: number,
  startDate: string,
  endDate: string
): Promise<NstCountsRow[]> {
  const rows: NstCountsRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const data = await executeWithRetry<NstCountsRow[]>(
      `${tableName} player:${playerId} offset:${from}`,
      async () => {
        const { data, error } = await supabase
          .from(tableName as any)
          .select(
            "date_scraped, season, toi, goals, total_assists, first_assists, second_assists, total_points, shots, ixg, iscfs, hdcf, ipp, penalties_drawn, hits, shots_blocked"
          )
          .eq("player_id", playerId)
          .gte("date_scraped", startDate)
          .lte("date_scraped", endDate)
          .order("date_scraped", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return ((data ?? []) as NstCountsRow[]).map((row) =>
          normalizeNumericFields(row)
        );
      }
    );
    if (!data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchRates(
  tableName: string,
  playerId: number,
  startDate: string,
  endDate: string
): Promise<NstRatesRow[]> {
  const rows: NstRatesRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const data = await executeWithRetry<NstRatesRow[]>(
      `${tableName} player:${playerId} offset:${from}`,
      async () => {
        const { data, error } = await supabase
          .from(tableName as any)
          .select("date_scraped, season, shots_per_60, ixg_per_60, toi_per_gp")
          .eq("player_id", playerId)
          .gte("date_scraped", startDate)
          .lte("date_scraped", endDate)
          .order("date_scraped", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return ((data ?? []) as NstRatesRow[]).map((row) =>
          normalizeNumericFields(row)
        );
      }
    );
    if (!data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchCountsOi(
  tableName: string,
  playerId: number,
  startDate: string,
  endDate: string
): Promise<NstCountsOiRow[]> {
  const rows: NstCountsOiRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const data = await executeWithRetry<NstCountsOiRow[]>(
      `${tableName} player:${playerId} offset:${from}`,
      async () => {
        const { data, error } = await supabase
          .from(tableName as any)
          .select(
            "date_scraped, season, toi, gf, ga, sf, sa, off_zone_starts, def_zone_starts, neu_zone_starts, off_zone_start_pct, on_ice_sh_pct, on_ice_sv_pct, pdo, cf, ca, cf_pct, ff, fa, ff_pct"
          )
          .eq("player_id", playerId)
          .gte("date_scraped", startDate)
          .lte("date_scraped", endDate)
          .order("date_scraped", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        return ((data ?? []) as NstCountsOiRow[]).map((row) =>
          normalizeNumericFields(row)
        );
      }
    );
    if (!data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchPowerPlayCombinations(
  playerId: number,
  gameIds: number[]
): Promise<PowerPlayCombinationRow[]> {
  if (gameIds.length === 0) return [];
  const rows: PowerPlayCombinationRow[] = [];
  const chunkSize = 100;
  const missing = gameIds.filter(
    (id) => !cachedPowerPlayCombos.has(getPowerPlayCacheKey(playerId, id))
  );
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const data = await executeWithRetry<PowerPlayCombinationRow[]>(
      `powerPlayCombinations player:${playerId} chunk:${i / chunkSize}`,
      async () => {
        const { data, error } = await supabase
          .from("powerPlayCombinations")
          .select(
            "gameId, playerId, PPTOI, unit, pp_share_of_team, pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg"
          )
          .eq("playerId", playerId)
          .in("gameId", chunk);
        if (error) throw error;
        return ((data ?? []) as RollingPlayerPpContextRow[]).map((row) =>
          toRollingPlayerPpContextRow(normalizeNumericFields(row))
        );
      }
    );
    for (const row of data) {
      cachedPowerPlayCombos.set(
        getPowerPlayCacheKey(playerId, row.gameId),
        row
      );
    }
  }
  for (const gameId of gameIds) {
    const cached = cachedPowerPlayCombos.get(
      getPowerPlayCacheKey(playerId, gameId)
    );
    if (cached) rows.push(cached);
  }
  return rows;
}

async function fetchLineCombinations(
  gameIds: number[]
): Promise<LineCombinationRow[]> {
  if (gameIds.length === 0) return [];
  const rows: LineCombinationRow[] = [];
  const chunkSize = 100;
  const missing = gameIds.filter((id) => !cachedLineCombosByGame.has(id));
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const data = await executeWithRetry<any[]>(
      `lineCombinations chunk:${i / chunkSize}`,
      async () => {
        const { data, error } = await supabase
          .from("lineCombinations")
          .select("gameId, teamId, forwards, defensemen, goalies")
          .in("gameId", chunk);
        if (error) throw error;
        return data ?? [];
      }
    );
    const grouped = new Map<number, LineCombinationRow[]>();
    for (const row of data) {
      const normalized: LineCombinationRow = {
        gameId: row.gameId,
        teamId: row.teamId,
        forwards: (row.forwards ?? []).map(Number),
        defensemen: (row.defensemen ?? []).map(Number),
        goalies: (row.goalies ?? []).map(Number)
      };
      const bucket = grouped.get(normalized.gameId) ?? [];
      bucket.push(normalized);
      grouped.set(normalized.gameId, bucket);
    }
    for (const gameId of chunk) {
      cachedLineCombosByGame.set(gameId, grouped.get(gameId) ?? []);
    }
  }

  for (const gameId of gameIds) {
    const cached = cachedLineCombosByGame.get(gameId);
    if (cached?.length) rows.push(...cached);
  }
  return rows;
}

function groupByDate<T extends { date_scraped: string }>(
  rows: T[]
): Record<string, T> {
  return rows.reduce<Record<string, T>>((acc, row) => {
    acc[row.date_scraped] = row;
    return acc;
  }, {});
}

function resolveSeasonValue(
  wgo: WgoSkaterRow,
  counts?: NstCountsRow,
  rates?: NstRatesRow
): { season: number; source: PlayerGameSourceContext["seasonSource"] } {
  if (wgo.season_id != null) {
    return { season: wgo.season_id, source: "wgo" };
  }
  if (counts?.season != null) {
    return { season: counts.season, source: "counts" };
  }
  if (rates?.season != null) {
    return { season: rates.season, source: "rates" };
  }
  return { season: 0, source: "missing" };
}

function resolveLineCombo(
  lineRows: LineCombinationRow[],
  gameId: number | null,
  teamId: number | null,
  playerId: number
): {
  lineCombo: PlayerGameData["lineCombo"];
  hasSourceRow: boolean;
  hasTrustedAssignment: boolean;
} {
  if (gameId === null || !teamId) {
    return {
      lineCombo: { slot: null, positionGroup: null },
      hasSourceRow: false,
      hasTrustedAssignment: false
    };
  }
  const match = lineRows.find(
    (row) => row.gameId === gameId && row.teamId === teamId
  );
  return resolveTrustedLineAssignment({
    row: match ?? null,
    playerId
  });
}

function resolveFallbackToiContext(
  wgo: WgoSkaterRow,
  counts?: NstCountsRow,
  countsOi?: NstCountsOiRow
): {
  fallbackToiSeconds: number | null;
  source: PlayerGameSourceContext["fallbackToiSource"];
  wgoNormalization: RollingPlayerWgoToiNormalization;
} {
  const seed = resolveFallbackToiSeed({
    countsToi: counts?.toi ?? null,
    countsOiToi: countsOi?.toi ?? null,
    wgoToiPerGame: wgo.toi_per_game ?? null
  });
  return {
    fallbackToiSeconds: seed.fallbackToiSeconds,
    source: seed.source,
    wgoNormalization: seed.wgoNormalization
  };
}

function summarizeSourceTracking(
  games: PlayerGameData[],
  strength: StrengthState
): SourceTrackingSummary {
  const summary = createEmptySourceTrackingSummary();

  for (const game of games) {
    if (!game.sourceContext.countsSourcePresent) summary.missingSources.counts += 1;
    if (!game.sourceContext.ratesSourcePresent) summary.missingSources.rates += 1;
    if (!game.sourceContext.countsOiSourcePresent) {
      summary.missingSources.countsOi += 1;
    }
    if (!game.sourceContext.hasKnownGameId) {
      summary.missingSources.knownGameId += 1;
    }

    if ((strength === "all" || strength === "pp") && !game.sourceContext.ppSourcePresent) {
      const wgoPpToi = Number(game.wgo?.pp_toi ?? 0);
      if (Number.isFinite(wgoPpToi) && wgoPpToi > 0) {
        summary.missingSources.pp += 1;
      }
    }
    if (
      (strength === "all" || strength === "pp") &&
      !game.sourceContext.ppUnitSourcePresent
    ) {
      const wgoPpToi = Number(game.wgo?.pp_toi ?? 0);
      if (Number.isFinite(wgoPpToi) && wgoPpToi > 0) {
        summary.missingSources.ppUnit += 1;
      }
    }

    if (game.gameId != null && game.teamId != null && !game.sourceContext.lineSourcePresent) {
      summary.missingSources.line += 1;
    }
    if (
      game.gameId != null &&
      game.teamId != null &&
      game.sourceContext.lineSourcePresent &&
      !game.sourceContext.lineAssignmentSourcePresent
    ) {
      summary.missingSources.lineAssignment += 1;
    }

    if (strength === "all") {
      if (game.counts?.goals == null && game.wgo?.goals != null) {
        summary.wgoFallbacks.goals += 1;
      }
      if (game.counts?.total_assists == null && game.wgo?.assists != null) {
        summary.wgoFallbacks.assists += 1;
      }
      if (game.counts?.shots == null && game.wgo?.shots != null) {
        summary.wgoFallbacks.shots += 1;
      }
      if (game.counts?.hits == null && game.wgo?.hits != null) {
        summary.wgoFallbacks.hits += 1;
      }
      if (game.counts?.shots_blocked == null && game.wgo?.blocked_shots != null) {
        summary.wgoFallbacks.blocks += 1;
      }
      if (game.counts?.total_points == null && game.wgo?.points != null) {
        summary.wgoFallbacks.points += 1;
      }
      if (game.counts?.ixg == null && getWgoNumber(game, "ixg") != null) {
        summary.wgoFallbacks.ixg += 1;
      }
    }

    const toiContext = getToiContext(game);
    summary.toiSources[game.sourceContext.resolvedToiSource] += 1;
    summary.toiTrustTiers[game.sourceContext.toiTrustTier] += 1;
    summary.toiWgoNormalizations[game.sourceContext.wgoToiNormalization] += 1;
    if (game.sourceContext.resolvedToiSource === "fallback") {
      summary.toiFallbackSeeds[game.sourceContext.fallbackToiSource] += 1;
    }
    for (const rejection of toiContext.rejectedCandidates) {
      summary.toiSuspiciousReasons[rejection.reason] += 1;
    }

    const shotsValue = getShots(game);
    if (
      toiContext.seconds != null &&
      shotsValue == null &&
      game.rates?.shots_per_60 != null
    ) {
      summary.rateReconstructions.sog_per_60 += 1;
    }

    const ixgPer60Resolution = resolveIxgPer60Components({
      strength: game.strength,
      countsIxg: game.counts?.ixg ?? null,
      wgoIxg: getWgoNumber(game, "ixg"),
      toiSeconds: toiContext.seconds,
      per60Rate: game.rates?.ixg_per_60 ?? null
    });
    summary.ixgPer60Sources[ixgPer60Resolution.source] += 1;
    if (ixgPer60Resolution.source === "rate_reconstruction") {
      summary.rateReconstructions.ixg_per_60 += 1;
    }
  }

  return summary;
}

function buildGameRecords(
  wgoRows: WgoSkaterRow[],
  countsByDate: Record<string, NstCountsRow>,
  ratesByDate: Record<string, NstRatesRow>,
  countsOiByDate: Record<string, NstCountsOiRow>,
  lineRows: LineCombinationRow[],
  ppRows: PowerPlayCombinationRow[],
  strength: StrengthState,
  knownGameIds: Set<number>
): PlayerGameData[] {
  const ppByGameId = ppRows.reduce<Record<number, PowerPlayCombinationRow>>(
    (acc, row) => {
      acc[row.gameId] = toRollingPlayerPpContextRow(row);
      return acc;
    },
    {}
  );

  return wgoRows.map((wgo) => {
    // Row assembly intentionally starts from WGO because it is the per-game
    // appearance spine. NST sources enrich the row when coverage exists, but
    // they do not decide whether the rolling row exists for that date.
    const teamAbbrev = wgo.team_abbrev ?? wgo.current_team_abbreviation ?? "";
    const teamId = abbrevToTeamId[teamAbbrev] ?? null;
    const counts = countsByDate[wgo.date];
    const rates = ratesByDate[wgo.date];
    const countsOi = countsOiByDate[wgo.date];
    const originalGameId = wgo.game_id;
    const hasKnownGameId =
      typeof originalGameId === "number" && knownGameIds.has(originalGameId);
    const ppCombination =
      originalGameId && ppByGameId[originalGameId]
        ? ppByGameId[originalGameId]
        : undefined;
    const {
      lineCombo,
      hasSourceRow: hasLineSourceRow,
      hasTrustedAssignment: hasTrustedLineAssignment
    } = resolveLineCombo(
      lineRows,
      originalGameId,
      teamId,
      wgo.player_id
    );
    const { season, source: seasonSource } = resolveSeasonValue(
      wgo,
      counts,
      rates
    );
    const {
      fallbackToiSeconds,
      source: fallbackToiSource,
      wgoNormalization: fallbackWgoToiNormalization
    } =
      resolveFallbackToiContext(wgo, counts, countsOi);
    const toiContext = resolveToiContext({
      counts,
      countsOi,
      rates,
      fallbackToiSeconds,
      wgo
    });
    return {
      playerId: wgo.player_id,
      gameId: hasKnownGameId ? originalGameId : null,
      gameDate: wgo.date,
      season,
      teamId,
      strength,
      counts,
      rates,
      countsOi,
      wgo,
      ppCombination: ppCombination ?? null,
      lineCombo,
      fallbackToiSeconds,
      sourceContext: {
        rowSpine: "wgo",
        originalGameId: originalGameId ?? null,
        hasKnownGameId,
        teamAbbrev: teamAbbrev || null,
        seasonSource,
        countsSourcePresent: Boolean(counts),
        ratesSourcePresent: Boolean(rates),
        countsOiSourcePresent: Boolean(countsOi),
        ppSourcePresent: Boolean(ppCombination),
        ppUnitSourcePresent: hasTrustedPpUnitContext({
          originalGameId,
          unit: ppCombination?.unit ?? null
        }),
        lineSourcePresent: hasLineSourceRow,
        lineAssignmentSourcePresent: hasTrustedLineAssignment,
        fallbackToiSource,
        resolvedToiSource: toiContext.source,
        toiTrustTier: toiContext.trustTier,
        wgoToiNormalization:
          toiContext.wgoNormalization === "missing"
            ? fallbackWgoToiNormalization
            : toiContext.wgoNormalization
      }
    };
  });
}

async function processPlayer(
  playerId: number,
  ledger: TeamGameLedger,
  knownGameIds: Set<number>,
  options: FetchOptions
): Promise<ProcessPlayerResult> {
  const wgoRows = await fetchWgoRowsForPlayer(playerId, options);
  if (wgoRows.length === 0) {
    return {
      rows: [],
      diagnostics: {
        coverageWarningCount: 0,
        suspiciousOutputCount: 0,
        unknownGameIdCount: 0,
        freshnessBlockerCount: 0,
        sourceTracking: createEmptySourceTrackingSummary()
      }
    };
  }
  const startDate = wgoRows[0].date;
  const endDate = wgoRows[wgoRows.length - 1].date;
  const gameIds = wgoRows
    .map((row) => row.game_id)
    .filter((id): id is number => typeof id === "number");
  const ppRows = await fetchPowerPlayCombinations(playerId, gameIds);
  const lineRows = await fetchLineCombinations(gameIds);

  const outputs: any[] = [];
  const diagnostics: PlayerProcessingDiagnostics = {
    coverageWarningCount: 0,
    suspiciousOutputCount: 0,
    unknownGameIdCount: 0,
    freshnessBlockerCount: 0,
    sourceTracking: createEmptySourceTrackingSummary()
  };
  for (const config of STRENGTH_CONFIGS) {
    const strengthLabel = `[fetchRollingPlayerAverages] player:${playerId} strength:${config.state}`;
    console.time(strengthLabel);
    try {
      const fetchPhaseStartedAt = Date.now();
      logPipelinePhase({
        phase: "fetch",
        status: "start",
        details: {
          playerId,
          strength: config.state,
          startDate,
          endDate,
          wgoRows: wgoRows.length,
          candidateGameIds: gameIds.length
        }
      });
      let countsRows: NstCountsRow[];
      let ratesRows: NstRatesRow[];
      let countsOiRows: NstCountsOiRow[];
      try {
        [countsRows, ratesRows, countsOiRows] = await Promise.all([
          fetchCounts(config.countsTable, playerId, startDate, endDate),
          fetchRates(config.ratesTable, playerId, startDate, endDate),
          fetchCountsOi(config.countsOiTable, playerId, startDate, endDate)
        ]);
      } catch (error) {
        logPipelinePhase({
          phase: "fetch",
          status: "failed",
          durationMs: Date.now() - fetchPhaseStartedAt,
          details: {
            playerId,
            strength: config.state,
            error: getErrorMessage(error)
          }
        });
        throw error;
      }
      logPipelinePhase({
        phase: "fetch",
        status: "complete",
        durationMs: Date.now() - fetchPhaseStartedAt,
        details: {
          playerId,
          strength: config.state,
          countsRows: countsRows.length,
          ratesRows: ratesRows.length,
          countsOiRows: countsOiRows.length,
          ppRows: ppRows.length,
          lineRows: lineRows.length
        }
      });

      const countsByDate = groupByDate(countsRows);
      const ratesByDate = groupByDate(ratesRows);
      const countsOiByDate = groupByDate(countsOiRows);

      if (!countsRows.length) {
        console.debug(
          `[fetchRollingPlayerAverages] No NST counts for player ${playerId} strength ${config.state}; relying on fallbacks where possible.`
        );
      }
      if (!ratesRows.length) {
        console.debug(
          `[fetchRollingPlayerAverages] No NST rates for player ${playerId} strength ${config.state}; relying on fallbacks where possible.`
        );
      }
      if (!countsOiRows.length) {
        console.debug(
          `[fetchRollingPlayerAverages] No NST on-ice counts for player ${playerId} strength ${config.state}; metrics may remain null.`
        );
      }

      if (!options.skipDiagnostics) {
        const coverageSummary = summarizeCoverage({
          playerId,
          strength: config.state,
          wgoRows,
          countsRows,
          ratesRows,
          countsOiRows,
          ppRows,
          knownGameIds
        });
        diagnostics.coverageWarningCount += coverageSummary.warnings.length;
        diagnostics.unknownGameIdCount += coverageSummary.counts.unknownGameIds;
        coverageSummary.warnings.forEach((warning) => console.warn(warning));
        const sourceTailSummary = summarizeSourceTailFreshness({
          playerId,
          strength: config.state,
          wgoRows,
          countsRows,
          ratesRows,
          countsOiRows,
          ppRows,
          lineRows
        });
        diagnostics.freshnessBlockerCount += sourceTailSummary.warnings.length;
        sourceTailSummary.warnings.forEach((warning) => console.warn(warning));
      }

      const mergePhaseStartedAt = Date.now();
      logPipelinePhase({
        phase: "merge",
        status: "start",
        details: {
          playerId,
          strength: config.state,
          wgoRows: wgoRows.length,
          ppRows: ppRows.length,
          lineRows: lineRows.length
        }
      });
      let games: PlayerGameData[];
      try {
        games = buildGameRecords(
          wgoRows,
          countsByDate,
          ratesByDate,
          countsOiByDate,
          lineRows,
          ppRows,
          config.state,
          knownGameIds
        );
      } catch (error) {
        logPipelinePhase({
          phase: "merge",
          status: "failed",
          durationMs: Date.now() - mergePhaseStartedAt,
          details: {
            playerId,
            strength: config.state,
            error: getErrorMessage(error)
          }
        });
        throw error;
      }
      logPipelinePhase({
        phase: "merge",
        status: "complete",
        durationMs: Date.now() - mergePhaseStartedAt,
        details: {
          playerId,
          strength: config.state,
          mergedRows: games.length
        }
      });
      let strengthSourceTracking = createEmptySourceTrackingSummary();
      if (!options.skipDiagnostics) {
        strengthSourceTracking = summarizeSourceTracking(games, config.state);
        mergeSourceTrackingSummary(diagnostics.sourceTracking, strengthSourceTracking);
        console.info(
          "[fetchRollingPlayerAverages] sourceTracking",
          JSON.stringify({
            playerId,
            strength: config.state,
            ...strengthSourceTracking
          })
        );
      }

      const simpleMetricsState: Record<string, RollingAccumulator> = {};
      const ratioMetricsState: Record<string, RatioRollingAccumulator> = {};
      const supportMetricsState: Record<string, RollingAccumulator> = {};
      const historicalSimpleMetricsState: Record<
        string,
        ReturnType<typeof createHistoricalAverageAccumulator>
      > = {};
      const historicalSupportMetricsState: Record<
        string,
        ReturnType<typeof createHistoricalAverageAccumulator>
      > = {};
      const historicalRatioMetricsState: Record<string, HistoricalRatioAccumulator> =
        {};
      METRICS.forEach((metric) => {
        if (metric.aggregation === "ratio") {
          ratioMetricsState[metric.key] = createRatioRollingAccumulator();
          historicalRatioMetricsState[metric.key] =
            createHistoricalRatioAccumulator();
          return;
        }
        simpleMetricsState[metric.key] = initAccumulator();
        historicalSimpleMetricsState[metric.key] =
          createHistoricalAverageAccumulator();
      });
      SUPPORT_METRICS.forEach((metric) => {
        supportMetricsState[metric.key] = initAccumulator();
        historicalSupportMetricsState[metric.key] =
          createHistoricalAverageAccumulator();
      });
      const strengthOutputs: any[] = [];
      const historicalGpPctState = createHistoricalGpPctAccumulator();
      const derivePhaseStartedAt = Date.now();
      logPipelinePhase({
        phase: "derive",
        status: "start",
        details: {
          playerId,
          strength: config.state,
          mergedRows: games.length
        }
      });
      try {
        for (const game of games) {
        const playedThisGame = didPlayerCountAsAppearance(config.state, game);

        METRICS.forEach((metric) => {
          if (metric.aggregation === "ratio") {
            const components = metric.getComponents(game);
            updateRatioRollingAccumulator(
              ratioMetricsState[metric.key],
              components,
              {
                windowFamily: metric.windowFamily,
                anchor: playedThisGame
              }
            );
            updateHistoricalRatioAccumulator(
              historicalRatioMetricsState[metric.key],
              game.season,
              components
            );
            return;
          }

          const value = metric.getValue(game);
          updateAccumulator(simpleMetricsState[metric.key], value);
          updateHistoricalAverageAccumulator(
            historicalSimpleMetricsState[metric.key],
            game.season,
            value
          );
        });
        SUPPORT_METRICS.forEach((metric) => {
          const value = metric.getValue(game);
          updateAccumulator(supportMetricsState[metric.key], value);
          updateHistoricalAverageAccumulator(
            historicalSupportMetricsState[metric.key],
            game.season,
            value
          );
        });

        const teamGamesPlayed = getTeamGamesPlayed(
          ledger,
          game.teamId ?? null,
          game.season,
          game.gameDate
        );
        updateHistoricalGpPctAccumulator(historicalGpPctState, {
          season: game.season,
          teamId: game.teamId ?? null,
          playedThisGame,
          teamGamesPlayed
        });

        const historicalGpPctSnapshot = getHistoricalGpPctSnapshot(
          historicalGpPctState,
          game.season
        );
        const rollingGpPctSnapshot = getRollingGpPctSnapshot(
          historicalGpPctState,
          {
            currentSeason: game.season,
            currentTeamId: game.teamId ?? null,
            currentTeamGamesPlayed: teamGamesPlayed
          }
        );

        const metricOutputs = deriveOutputs(
          simpleMetricsState,
          ratioMetricsState,
          supportMetricsState,
          historicalSimpleMetricsState,
          historicalSupportMetricsState,
          historicalRatioMetricsState,
          historicalGpPctSnapshot,
          rollingGpPctSnapshot,
          game.season,
          config.state
        );

        if (config.state !== "all" && config.state !== "pp") {
          Object.keys(metricOutputs).forEach((key) => {
            if (key.startsWith("pp_share_pct")) {
              metricOutputs[key] = null;
            }
          });
        }

        outputs.push({
          // The semantic type is intentionally sourced from the shared
          // availability contract so later GP% remediation tasks can update one
          // contract definition instead of re-deriving this meaning at call
          // sites.
          player_id: game.playerId,
          game_id: game.gameId,
          game_date: game.gameDate,
          season: game.season,
          team_id: game.teamId,
          strength_state: config.state,
          line_combo_slot: game.lineCombo?.slot ?? null,
          line_combo_group: game.lineCombo?.positionGroup ?? null,
          pp_unit: resolvePpUnitLabel({
            originalGameId: game.sourceContext.originalGameId,
            unit: game.ppCombination?.unit ?? null
          }),
          ...getOptionalPpContextOutputs(game),
          gp_semantic_type: getGpOutputCompatibilityMode(config.state).semanticType,
          ...metricOutputs
        });
          strengthOutputs.push(outputs[outputs.length - 1]);
        }
      } catch (error) {
        logPipelinePhase({
          phase: "derive",
          status: "failed",
          durationMs: Date.now() - derivePhaseStartedAt,
          details: {
            playerId,
            strength: config.state,
            error: getErrorMessage(error)
          }
        });
        throw error;
      }
      logPipelinePhase({
        phase: "derive",
        status: "complete",
        durationMs: Date.now() - derivePhaseStartedAt,
        details: {
          playerId,
          strength: config.state,
          derivedRows: strengthOutputs.length
        }
      });

      if (!options.skipDiagnostics) {
        const suspiciousSummary = summarizeSuspiciousOutputs({
          playerId,
          strength: config.state,
          rows: strengthOutputs
        });
        diagnostics.suspiciousOutputCount += suspiciousSummary.issueCount;
        suspiciousSummary.warnings.forEach((warning) => console.warn(warning));
        console.info(
          "[fetchRollingPlayerAverages] diagnosticDetail",
          JSON.stringify({
            playerId,
            strength: config.state,
            ...summarizeDerivedWindowDiagnostics({ rows: strengthOutputs }),
            toiSources: strengthSourceTracking.toiSources,
            toiFallbackSeeds: strengthSourceTracking.toiFallbackSeeds,
            toiTrustTiers: strengthSourceTracking.toiTrustTiers,
            rateReconstructions: strengthSourceTracking.rateReconstructions,
            ixgPer60Sources: strengthSourceTracking.ixgPer60Sources
          })
        );
      }
    } finally {
      console.timeEnd(strengthLabel);
    }
  }

  return { rows: outputs, diagnostics };
}

export async function recomputePlayerRowsForValidation(options: {
  playerId: number;
  season?: number;
  startDate?: string;
  endDate?: string;
  skipDiagnostics?: boolean;
}): Promise<ProcessPlayerResult> {
  const games = await fetchGames();
  const ledger = buildTeamGameLedger(games);
  const knownGameIds = new Set(games.map((game) => game.id));

  return processPlayer(options.playerId, ledger, knownGameIds, {
    playerId: options.playerId,
    season: options.season,
    startDate: options.startDate,
    endDate: options.endDate,
    skipDiagnostics: options.skipDiagnostics
  });
}

export async function fetchPlayerValidationSourceData(options: {
  playerId: number;
  season?: number;
  startDate?: string;
  endDate?: string;
}): Promise<RollingPlayerValidationSourceData> {
  const games = await fetchGames();
  const knownGameIds = new Set(games.map((game) => game.id));
  const wgoRows = await fetchWgoRowsForPlayer(options.playerId, {
    playerId: options.playerId,
    season: options.season,
    startDate: options.startDate,
    endDate: options.endDate
  });

  const emptyByStrength = STRENGTH_CONFIGS.reduce<
    RollingPlayerValidationSourceData["byStrength"]
  >((acc, config) => {
    acc[config.state] = {
      countsRows: [],
      ratesRows: [],
      countsOiRows: [],
      mergedGames: [],
      coverageSummary: summarizeCoverage({
        playerId: options.playerId,
        strength: config.state,
        wgoRows: [],
        countsRows: [],
        ratesRows: [],
        countsOiRows: [],
        ppRows: [],
        knownGameIds
      }),
      sourceTailFreshness: summarizeSourceTailFreshness({
        playerId: options.playerId,
        strength: config.state,
        wgoRows: [],
        countsRows: [],
        ratesRows: [],
        countsOiRows: [],
        ppRows: [],
        lineRows: []
      })
    };
    return acc;
  }, {} as RollingPlayerValidationSourceData["byStrength"]);

  if (wgoRows.length === 0) {
    return {
      games,
      knownGameIds: Array.from(knownGameIds).sort((a, b) => a - b),
      wgoRows,
      ppRows: [],
      lineRows: [],
      byStrength: emptyByStrength
    };
  }

  const firstDate = wgoRows[0]?.date;
  const lastDate = wgoRows[wgoRows.length - 1]?.date;
  const startDate = options.startDate ?? firstDate;
  const endDate = options.endDate ?? lastDate;
  const gameIds = wgoRows
    .map((row) => row.game_id)
    .filter((gameId): gameId is number => typeof gameId === "number");
  const ppRows = await fetchPowerPlayCombinations(options.playerId, gameIds);
  const lineRows = await fetchLineCombinations(gameIds);

  const byStrength = {} as RollingPlayerValidationSourceData["byStrength"];
  for (const config of STRENGTH_CONFIGS) {
    const [countsRows, ratesRows, countsOiRows] = await Promise.all([
      fetchCounts(config.countsTable, options.playerId, startDate, endDate),
      fetchRates(config.ratesTable, options.playerId, startDate, endDate),
      fetchCountsOi(config.countsOiTable, options.playerId, startDate, endDate)
    ]);
    const mergedGames = buildGameRecords(
      wgoRows,
      groupByDate(countsRows),
      groupByDate(ratesRows),
      groupByDate(countsOiRows),
      lineRows,
      ppRows,
      config.state,
      knownGameIds
    );
    byStrength[config.state] = {
      countsRows,
      ratesRows,
      countsOiRows,
      mergedGames,
      coverageSummary: summarizeCoverage({
        playerId: options.playerId,
        strength: config.state,
        wgoRows,
        countsRows,
        ratesRows,
        countsOiRows,
        ppRows,
        knownGameIds
      }),
      sourceTailFreshness: summarizeSourceTailFreshness({
        playerId: options.playerId,
        strength: config.state,
        wgoRows,
        countsRows,
        ratesRows,
        countsOiRows,
        ppRows,
        lineRows
      })
    };
  }

  return {
    games,
    knownGameIds: Array.from(knownGameIds).sort((a, b) => a - b),
    wgoRows,
    ppRows,
    lineRows,
    byStrength
  };
}

export async function main(options: FetchOptions = {}): Promise<void> {
  console.info(
    "[fetchRollingPlayerAverages] Starting run",
    JSON.stringify(options)
  );
  try {
    const urlHost = (() => {
      try {
        return new URL(supabaseUrl as string).host;
      } catch {
        return "<invalid-url>";
      }
    })();
    console.info(
      "[fetchRollingPlayerAverages] Supabase host",
      urlHost,
      "keyLen",
      (supabaseKey as string).length
    );
    const { error: preflightErr } = await supabase
      .from("games")
      .select("id")
      .limit(1);
    if (preflightErr) {
      console.error(
        "[fetchRollingPlayerAverages] Preflight failed against 'games' table:",
        preflightErr
      );
    }
  } catch (e) {
    console.warn("[fetchRollingPlayerAverages] Preflight probe threw:", e);
  }
  const bootstrapPhaseStartedAt = Date.now();
  logPipelinePhase({
    phase: "bootstrap",
    status: "start",
    details: {
      playerId: options.playerId ?? null,
      season: options.season ?? null,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      resumePlayerId: options.resumePlayerId ?? null,
      forceFullRefresh: Boolean(options.forceFullRefresh)
    }
  });
  let games: GameRow[];
  let playerIds: number[];
  try {
    games = await fetchGames();
    playerIds = await fetchPlayerIds(options);
  } catch (error) {
    logPipelinePhase({
      phase: "bootstrap",
      status: "failed",
      durationMs: Date.now() - bootstrapPhaseStartedAt,
      details: {
        error: getErrorMessage(error)
      }
    });
    throw error;
  }
  const ledger = buildTeamGameLedger(games);
  const knownGameIds = new Set(games.map((game) => game.id));
  logPipelinePhase({
    phase: "bootstrap",
    status: "complete",
    durationMs: Date.now() - bootstrapPhaseStartedAt,
    details: {
      games: games.length,
      players: playerIds.length,
      knownGameIds: knownGameIds.size
    }
  });
  let resumePlayerId = options.resumePlayerId;

  if (options.forceFullRefresh) {
    const requestedMode: FullRefreshMode = options.fullRefreshMode ?? "rpc_truncate";
    console.info(
      `[fetchRollingPlayerAverages] Full refresh requested: mode=${requestedMode}; skipping auto-resume.`
    );
    let mode = requestedMode;

    if (mode === "rpc_truncate") {
      try {
        await executeWithRetry("truncate rpc", async () => {
          const { error } = await supabase.rpc(
            "truncate_rolling_player_game_metrics"
          );
          if (error) throw error;
        });
        console.info(
          "[fetchRollingPlayerAverages] RPC truncate completed for rolling_player_game_metrics."
        );
      } catch (err: any) {
        console.warn(
          "[fetchRollingPlayerAverages] RPC truncate failed; falling back to overwrite-only for this run.",
          err?.message ?? err
        );
        mode = "overwrite_only";
      }
    }

    if (mode === "delete") {
      try {
        const chunkSize =
          options.fullRefreshDeleteChunkSize &&
          options.fullRefreshDeleteChunkSize > 0
            ? options.fullRefreshDeleteChunkSize
            : 50000;
        let deleteProgressTotal: number | undefined;
        try {
          const { count, error: countError } = await supabase
            .from("rolling_player_game_metrics")
            .select("player_id", { count: "exact", head: true });
          if (countError) throw countError;
          deleteProgressTotal =
            typeof count === "number" && count >= 0 ? count : undefined;
        } catch (countErr: any) {
          console.warn(
            "[fetchRollingPlayerAverages] Could not fetch row count for delete progress:",
            countErr?.message ?? countErr
          );
        }
        const deleteProgress = createProgressLogger({
          label: "rolling_player_game_metrics delete",
          total: deleteProgressTotal,
          minIntervalMs: 500
        });
        let deletedRows = 0;

        while (true) {
          const { data: firstRow, error: firstErr } = await supabase
            .from("rolling_player_game_metrics")
            .select("player_id")
            .order("player_id", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstErr) throw firstErr;
          if (!firstRow?.player_id) break;
          const lower = Number(firstRow.player_id);
          const upper = lower + chunkSize - 1;
          const { error, count } = await supabase
            .from("rolling_player_game_metrics")
            .delete({ count: "exact" })
            .gte("player_id", lower)
            .lte("player_id", upper);
          if (error) throw error;
          deletedRows += typeof count === "number" ? count : 0;
          deleteProgress.update(
            deletedRows,
            `lastRange:${lower}-${upper} lastRows:${count ?? "?"}`
          );
          console.info(
            `[fetchRollingPlayerAverages] Cleared chunk player_id ${lower}-${upper}, rows:${count}`
          );
          // small pause to reduce lock contention
          await delay(20);
        }
        deleteProgress.finish(deletedRows, "delete phase complete");
      } catch (err: any) {
        console.warn(
          "[fetchRollingPlayerAverages] Legacy delete mode failed; proceeding with overwrite-only for this run.",
          err?.message ?? err
        );
      }
    }

    if (mode === "overwrite_only") {
      console.info(
        "[fetchRollingPlayerAverages] Overwrite-only mode: skipping pre-delete; existing rows will be updated via upsert."
      );
    }
  } else if (shouldWarnAboutDisabledImplicitAutoResume(options)) {
    console.info(
      "[fetchRollingPlayerAverages] Implicit auto-resume is disabled because max-player-id inference can skip missed lower player_ids. Processed the full player set unless resumePlayerId/resumeFrom was provided explicitly."
    );
  }

  if (resumePlayerId !== undefined) {
    console.info(
      "[fetchRollingPlayerAverages] Resuming processing for player_id values >",
      resumePlayerId
    );
  }

  const filteredPlayerIds = filterPlayerIdsForResume(playerIds, resumePlayerId);

  if (!filteredPlayerIds.length) {
    console.info(
      "[fetchRollingPlayerAverages] No players to process after applying resume filter."
    );
    return;
  }

  console.info(
    "[fetchRollingPlayerAverages] Players to process",
    filteredPlayerIds.length
  );

  const defaultConcurrency = options.forceFullRefresh ? 4 : 1;
  const playerConcurrency = Math.min(
    Math.max(options.playerConcurrency ?? defaultConcurrency, 1),
    16
  );
  const upsertConcurrency = Math.min(
    Math.max(options.upsertConcurrency ?? 1, 1),
    4
  );
  const batchSize = Math.min(
    Math.max(options.upsertBatchSize ?? (options.forceFullRefresh ? 400 : 500), 1),
    5000
  );
  const upsertLimit = createConcurrencyLimiter(upsertConcurrency);
  console.info(
    "[fetchRollingPlayerAverages] Execution settings",
    JSON.stringify({ playerConcurrency, upsertConcurrency, batchSize })
  );

  let rowsUpserted = 0;
  let processedPlayers = 0;
  let playersWithRows = 0;
  let coverageWarnings = 0;
  let suspiciousOutputWarnings = 0;
  let unknownGameIds = 0;
  let freshnessBlockers = 0;
  const sourceTracking = createEmptySourceTrackingSummary();
  const playerProgress = createProgressLogger({
    label: "players",
    total: filteredPlayerIds.length,
    minIntervalMs: 1000
  });
  let nextPlayerIndex = 0;
  const runPlayerWorker = async () => {
    while (true) {
      const currentIndex = nextPlayerIndex;
      if (currentIndex >= filteredPlayerIds.length) return;
      nextPlayerIndex += 1;
      const playerId = filteredPlayerIds[currentIndex];

      const playerLabel = `[fetchRollingPlayerAverages] player:${playerId}`;
      console.time(playerLabel);
      try {
        const { rows, diagnostics } = await processPlayer(
          playerId,
          ledger,
          knownGameIds,
          options
        );
        coverageWarnings += diagnostics.coverageWarningCount;
        suspiciousOutputWarnings += diagnostics.suspiciousOutputCount;
        unknownGameIds += diagnostics.unknownGameIdCount;
        freshnessBlockers += diagnostics.freshnessBlockerCount;
        mergeSourceTrackingSummary(sourceTracking, diagnostics.sourceTracking);
        if (!rows.length) {
          processedPlayers += 1;
          playerProgress.update(
            processedPlayers,
            `player:${playerId} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
          );
          continue;
        }
        playersWithRows += 1;
        const totalBatches = Math.ceil(rows.length / batchSize);
        const upsertPhaseStartedAt = Date.now();
        logPipelinePhase({
          phase: "upsert",
          status: "start",
          details: {
            playerId,
            rows: rows.length,
            totalBatches,
            batchSize
          }
        });
        playerProgress.update(
          processedPlayers,
          `player:${playerId} preparedRows:${rows.length} batches:${totalBatches} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
        );
        try {
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const batchSummary = summarizeUpsertBatch(batch as RollingUpsertRow[]);
            if (options.debugUpsertPayload || options.dryRunUpsert) {
              console.info(
                "[fetchRollingPlayerAverages] upsertBatchSummary",
                JSON.stringify({
                  playerId,
                  batchNumber,
                  totalBatches,
                  dryRunUpsert: Boolean(options.dryRunUpsert),
                  ...batchSummary
                })
              );
            }
            if (options.dryRunUpsert) {
              playerProgress.update(
                processedPlayers,
                `player:${playerId} validatedBatch:${batchNumber}/${totalBatches} rowsPrepared:${rows.length} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
              );
              continue;
            }
            await upsertLimit(async () =>
              executeWithSlowLog(
                `upsert player:${playerId} batch:${batchNumber}/${totalBatches} rows:${batch.length}`,
                () =>
                  executeWithRetry(
                    `upsert player:${playerId} batch:${batchNumber}/${totalBatches}`,
                    async () => {
                      await upsertRollingPlayerMetricsBatch(
                        batch as RollingUpsertRow[]
                      );
                    }
                  )
              )
            );
            rowsUpserted += batch.length;
            playerProgress.update(
              processedPlayers,
              `player:${playerId} upsertedBatch:${batchNumber}/${totalBatches} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
            );
          }
        } catch (error) {
          const errorSummary = toSerializableError(error);
          logPipelinePhase({
            phase: "upsert",
            status: "failed",
            durationMs: Date.now() - upsertPhaseStartedAt,
            details: {
              playerId,
              rows: rows.length,
              totalBatches,
              rowsUpsertedSoFar: rowsUpserted,
              error: getErrorMessage(error)
            }
          });
          if (options.debugUpsertPayload || !options.skipDiagnostics) {
            console.error(
              "[fetchRollingPlayerAverages] upsertFailureDetail",
              JSON.stringify({
                playerId,
                rows: rows.length,
                totalBatches,
                rowsUpsertedSoFar: rowsUpserted,
                error: errorSummary
              })
            );
          }
          throw error;
        }
        logPipelinePhase({
          phase: "upsert",
          status: "complete",
          durationMs: Date.now() - upsertPhaseStartedAt,
          details: {
            playerId,
            rows: rows.length,
            totalBatches,
            rowsUpsertedSoFar: rowsUpserted
          }
        });
        // Keep a tiny pause between players to reduce lock contention spikes.
        await delay(20);
        processedPlayers += 1;
        playerProgress.update(
          processedPlayers,
          `player:${playerId} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
        );
      } finally {
        console.timeEnd(playerLabel);
      }
    }
  };

  const workerCount = Math.min(playerConcurrency, filteredPlayerIds.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => runPlayerWorker())
  );

  playerProgress.finish(
    processedPlayers,
    `rowsUpserted:${rowsUpserted} playersWithRows:${playersWithRows} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings} freshness:${freshnessBlockers}`
  );

  logPipelinePhase({
    phase: "summary",
    status: "start",
    details: {
      processedPlayers,
      playersWithRows,
      rowsUpserted
    }
  });
  console.info(
    "[fetchRollingPlayerAverages] Completed run",
    JSON.stringify(
      buildRunSummary({
        rowsUpserted,
        processedPlayers,
        playersWithRows,
        coverageWarnings,
        suspiciousOutputWarnings,
        unknownGameIds,
        freshnessBlockers,
        sourceTracking
      })
    )
  );
  logPipelinePhase({
    phase: "summary",
    status: "complete",
    details: {
      processedPlayers,
      playersWithRows,
      rowsUpserted,
      coverageWarnings,
      suspiciousOutputWarnings,
      unknownGameIds,
      freshnessBlockers
    }
  });
}

export const __testables = {
  buildGameRecords,
  buildRunSummary,
  summarizeSourceTracking,
  didPlayerCountAsAppearance,
  applyGpOutputs,
  getGpOutputCompatibilityMode,
  deriveOutputs,
  getOptionalPpContextOutputs,
  initAccumulator,
  shouldWarnAboutDisabledImplicitAutoResume,
  filterPlayerIdsForResume,
  upsertRollingPlayerMetricsBatch
};

export default { main };

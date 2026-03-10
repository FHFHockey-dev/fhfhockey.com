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
  createRatioRollingAccumulator,
  getHistoricalRatioSnapshot,
  getRatioRollingSnapshot,
  updateHistoricalRatioAccumulator,
  updateRatioRollingAccumulator,
  type HistoricalRatioAccumulator,
  type RatioAggregationSpec,
  type RatioComponents,
  type RatioRollingAccumulator
} from "./rollingMetricAggregation";
import {
  resolveIxgValue,
  resolvePer60Components,
  resolvePreferredShareComponents
} from "./rollingPlayerMetricMath";
import {
  summarizeCoverage,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";

type StrengthState = "all" | "ev" | "pp" | "pk";
type FullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";

type RollingWindow = 3 | 5 | 10 | 20;

const ROLLING_WINDOWS: RollingWindow[] = [3, 5, 10, 20];
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const TRANSIENT_GATEWAY_STATUSES = [502, 503, 504, 520, 522, 524];
const SLOW_OPERATION_WARNING_MS = 15000;

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

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

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

interface WgoSkaterRow {
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

interface NstCountsRow {
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

interface NstRatesRow {
  date_scraped: string;
  season: number;
  shots_per_60: number | null;
  ixg_per_60: number | null;
  toi_per_gp: number | null;
}

interface NstCountsOiRow {
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

interface GameRow {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  seasonId: number;
}

interface LineCombinationRow {
  gameId: number;
  teamId: number;
  forwards: number[];
  defensemen: number[];
  goalies: number[];
}

interface PowerPlayCombinationRow {
  gameId: number;
  playerId: number;
  percentageOfPP: number | null;
  PPTOI: number | null;
  unit: number | null;
  pp_share_of_team: number | null;
}

interface PlayerProcessingDiagnostics {
  coverageWarningCount: number;
  suspiciousOutputCount: number;
  unknownGameIdCount: number;
}

interface ProcessPlayerResult {
  rows: any[];
  diagnostics: PlayerProcessingDiagnostics;
}

const cachedPowerPlayCombos = new Map<string, PowerPlayCombinationRow>();
const cachedLineCombosByGame = new Map<number, LineCombinationRow[]>();

function getPowerPlayCacheKey(playerId: number, gameId: number): string {
  return `${playerId}:${gameId}`;
}

interface PlayerGameData {
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
}

interface SimpleMetricDefinition {
  key: string;
  aggregation: "simple";
  getValue: (game: PlayerGameData) => number | null;
}

interface RatioMetricDefinition {
  key: string;
  aggregation: "ratio";
  ratioSpec: RatioAggregationSpec;
  getComponents: (game: PlayerGameData) => RatioComponents | null;
}

type MetricDefinition = SimpleMetricDefinition | RatioMetricDefinition;

interface RollingAccumulator {
  sumAll: number;
  countAll: number;
  windows: Record<
    RollingWindow,
    { values: number[]; sum: number; count: number }
  >;
}

function getPoints(game: PlayerGameData): number | null {
  if (
    game.counts &&
    game.counts.total_points !== null &&
    game.counts.total_points !== undefined
  ) {
    return game.counts.total_points;
  }
  if (game.strength === "all") {
    return game.wgo?.points ?? null;
  }
  return null;
}

function getShots(game: PlayerGameData): number | null {
  if (game.counts && game.counts.shots !== null && game.counts.shots !== undefined) {
    return game.counts.shots;
  }
  if (game.strength === "all") {
    return game.wgo?.shots ?? null;
  }
  return null;
}

function getGoals(game: PlayerGameData): number | null {
  if (game.counts && game.counts.goals !== null && game.counts.goals !== undefined) {
    return game.counts.goals;
  }
  if (game.strength === "all") {
    return game.wgo?.goals ?? null;
  }
  return null;
}

function getAssists(game: PlayerGameData): number | null {
  if (
    game.counts &&
    game.counts.total_assists !== null &&
    game.counts.total_assists !== undefined
  ) {
    return game.counts.total_assists;
  }
  if (game.strength === "all") {
    return game.wgo?.assists ?? null;
  }
  return null;
}

function getHits(game: PlayerGameData): number | null {
  if (game.counts && game.counts.hits !== null && game.counts.hits !== undefined) {
    return game.counts.hits;
  }
  if (game.strength === "all") {
    return game.wgo?.hits ?? null;
  }
  return null;
}

function getBlocks(game: PlayerGameData): number | null {
  if (
    game.counts &&
    game.counts.shots_blocked !== null &&
    game.counts.shots_blocked !== undefined
  ) {
    return game.counts.shots_blocked;
  }
  if (game.strength === "all") {
    return game.wgo?.blocked_shots ?? null;
  }
  return null;
}

function getPpShareComponents(game: PlayerGameData): RatioComponents | null {
  if (game.strength !== "all" && game.strength !== "pp") return null;
  return resolvePreferredShareComponents({
    primaryNumeratorValue: game.ppCombination?.PPTOI ?? null,
    primaryShare: game.ppCombination?.pp_share_of_team ?? null,
    fallbackNumeratorValue: game.wgo?.pp_toi ?? null,
    fallbackShare: game.wgo?.pp_toi_pct_per_game ?? null
  });
}

const METRICS: MetricDefinition[] = [
  {
    key: "sog_per_60",
    aggregation: "ratio",
    ratioSpec: {
      scale: 3600
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
    ratioSpec: {
      scale: 3600
    },
    getComponents: (game) =>
      resolvePer60Components({
        rawValue: resolveIxgValue({
          strength: game.strength,
          countsIxg: game.counts?.ixg ?? null,
          wgoIxg: getWgoNumber(game, "ixg")
        }),
        toiSeconds: getToiSeconds(game),
        per60Rate: game.rates?.ixg_per_60 ?? null
      })
  },
  {
    key: "shooting_pct",
    aggregation: "ratio",
    ratioSpec: {
      scale: 100,
      zeroWhenNoDenominator: true
    },
    getComponents: (game) => ({
      numerator: getGoals(game),
      denominator: getShots(game)
    })
  },
  {
    key: "ixg",
    aggregation: "simple",
    getValue: (game) =>
      resolveIxgValue({
        strength: game.strength,
        countsIxg: game.counts?.ixg ?? null,
        wgoIxg: getWgoNumber(game, "ixg")
      })
  },
  {
    key: "primary_points_pct",
    aggregation: "ratio",
    ratioSpec: {
      scale: 1,
      zeroWhenNoDenominator: true
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
    ratioSpec: {
      scale: 1
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
    ratioSpec: {
      scale: 100,
      zeroWhenNoDenominator: true
    },
    getComponents: (game) => ({
      numerator: getPoints(game),
      denominator: game.countsOi?.gf ?? null
    })
  },
  {
    key: "iscf",
    aggregation: "simple",
    getValue: ({ counts }) => counts?.iscfs ?? null
  },
  {
    key: "ihdcf",
    aggregation: "simple",
    getValue: ({ counts }) => counts?.hdcf ?? null
  },
  {
    key: "toi_seconds",
    aggregation: "simple",
    getValue: (game) => getToiSeconds(game)
  },
  {
    key: "hits_per_60",
    aggregation: "ratio",
    ratioSpec: {
      scale: 3600
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
    ratioSpec: {
      scale: 3600
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
    ratioSpec: {
      scale: 100
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
    ratioSpec: {
      scale: 1
    },
    getComponents: (game) => getPpShareComponents(game)
  },
  {
    key: "on_ice_sh_pct",
    aggregation: "ratio",
    ratioSpec: {
      scale: 100
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.gf ?? null,
      denominator: countsOi?.sf ?? null
    })
  },
  {
    key: "pdo",
    aggregation: "ratio",
    ratioSpec: {
      scale: 100,
      combine: "sum",
      outputScale: 0.01
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
    getValue: ({ countsOi }) => countsOi?.cf ?? null
  },
  {
    key: "ca",
    aggregation: "simple",
    getValue: ({ countsOi }) => countsOi?.ca ?? null
  },
  {
    key: "cf_pct",
    aggregation: "ratio",
    ratioSpec: {
      scale: 100
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.cf ?? null,
      denominator: (countsOi?.cf ?? 0) + (countsOi?.ca ?? 0)
    })
  },
  {
    key: "ff",
    aggregation: "simple",
    getValue: ({ countsOi }) => countsOi?.ff ?? null
  },
  {
    key: "fa",
    aggregation: "simple",
    getValue: ({ countsOi }) => countsOi?.fa ?? null
  },
  {
    key: "ff_pct",
    aggregation: "ratio",
    ratioSpec: {
      scale: 100
    },
    getComponents: ({ countsOi }) => ({
      numerator: countsOi?.ff ?? null,
      denominator: (countsOi?.ff ?? 0) + (countsOi?.fa ?? 0)
    })
  },
  {
    key: "goals",
    aggregation: "simple",
    getValue: (game) => getGoals(game)
  },
  {
    key: "assists",
    aggregation: "simple",
    getValue: (game) => getAssists(game)
  },
  {
    key: "shots",
    aggregation: "simple",
    getValue: (game) => getShots(game)
  },
  {
    key: "hits",
    aggregation: "simple",
    getValue: (game) => getHits(game)
  },
  {
    key: "blocks",
    aggregation: "simple",
    getValue: (game) => getBlocks(game)
  },
  {
    key: "pp_points",
    aggregation: "simple",
    getValue: ({ counts, wgo, strength }) => {
      if (strength === "pp") {
        return counts?.total_points ?? null;
      }
      if (strength === "all") {
        return wgo?.pp_points ?? null;
      }
      return null;
    }
  },
  {
    key: "points",
    aggregation: "simple",
    getValue: (game) => getPoints(game)
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

function getToiSeconds(game: PlayerGameData): number | null {
  const sanitizeSeconds = (value: number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    // Ignore absurd TOI values that indicate bad source data (e.g., 60x inflation).
    // Cap well below marathon values; 4000s (~66 minutes) is a generous upper bound for a skater.
    if (num >= 4000) return null;
    return num;
  };

  const countsToi = sanitizeSeconds(game.counts?.toi);
  if (countsToi !== null) return countsToi;
  const countsOiToi = sanitizeSeconds(game.countsOi?.toi);
  if (countsOiToi !== null) return countsOiToi;
  const ratesToi = sanitizeSeconds(game.rates?.toi_per_gp);
  if (ratesToi !== null) return ratesToi;
  const fallbackToi = sanitizeSeconds(game.fallbackToiSeconds);
  if (fallbackToi !== null) return fallbackToi;
  const wgoToiMinutes = game.wgo?.toi_per_game;
  if (wgoToiMinutes != null) {
    const toiValue = Number(wgoToiMinutes);
    if (!Number.isFinite(toiValue)) return null;
    // Some WGO ingests already store seconds; anything well above realistic
    // per-game minutes (e.g., >200) is treated as seconds to avoid 60x blowups.
    const alreadySeconds = toiValue > 200;
    const seconds = Math.round(alreadySeconds ? toiValue : toiValue * 60);
    if (seconds <= 0 || seconds >= 4000) return null;
    return seconds;
  }
  return null;
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

function deriveOutputs(
  simpleMetricsState: Record<string, RollingAccumulator>,
  ratioMetricsState: Record<string, RatioRollingAccumulator>,
  historicalSimpleMetricsState: Record<
    string,
    ReturnType<typeof createHistoricalAverageAccumulator>
  >,
  historicalRatioMetricsState: Record<string, HistoricalRatioAccumulator>,
  historicalGpPctSnapshot: ReturnType<typeof getHistoricalGpPctSnapshot>,
  rollingGpPctSnapshot: ReturnType<typeof getRollingGpPctSnapshot>,
  currentSeason: number
) {
  const output: Record<string, number | null> = {};
  for (const metric of METRICS) {
    if (metric.aggregation === "ratio") {
      const acc = ratioMetricsState[metric.key];
      if (!acc) continue;
      const snapshot = getRatioRollingSnapshot(acc, metric.ratioSpec);
      output[`${metric.key}_total_all`] = snapshot.all;
      output[`${metric.key}_avg_all`] = snapshot.all;

      const historical = historicalRatioMetricsState[metric.key];
      const historicalSnapshot = getHistoricalRatioSnapshot(
        historical,
        currentSeason,
        metric.ratioSpec
      );
      output[`${metric.key}_avg_season`] = historicalSnapshot.season;
      output[`${metric.key}_avg_3ya`] = historicalSnapshot.threeYear;
      output[`${metric.key}_avg_career`] = historicalSnapshot.career;

      ROLLING_WINDOWS.forEach((size) => {
        output[`${metric.key}_total_last${size}`] = snapshot.windows[size];
        output[`${metric.key}_avg_last${size}`] = snapshot.windows[size];
      });
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
  output.games_played = historicalGpPctSnapshot.seasonPlayerGames;
  output.team_games_played = historicalGpPctSnapshot.seasonTeamGames;
  output.season_games_played = historicalGpPctSnapshot.seasonPlayerGames;
  output.season_team_games_available = historicalGpPctSnapshot.seasonTeamGames;
  output.three_year_games_played = historicalGpPctSnapshot.threeYearPlayerGames;
  output.three_year_team_games_available =
    historicalGpPctSnapshot.threeYearTeamGames;
  output.career_games_played = historicalGpPctSnapshot.careerPlayerGames;
  output.career_team_games_available = historicalGpPctSnapshot.careerTeamGames;
  output.season_availability_pct = historicalGpPctSnapshot.season;
  output.three_year_availability_pct = historicalGpPctSnapshot.threeYear;
  output.career_availability_pct = historicalGpPctSnapshot.career;
  output.gp_pct_total_all = historicalGpPctSnapshot.season;
  output.gp_pct_avg_all = output.gp_pct_total_all;
  output.gp_pct_avg_season = historicalGpPctSnapshot.season;
  output.gp_pct_avg_3ya = historicalGpPctSnapshot.threeYear;
  output.gp_pct_avg_career = historicalGpPctSnapshot.career;
  ROLLING_WINDOWS.forEach((size) => {
    const window = rollingGpPctSnapshot.windows[size];
    output[`games_played_last${size}_team_games`] = window.playerGames;
    output[`team_games_available_last${size}`] = window.teamGames;
    output[`availability_pct_last${size}_team_games`] = window.ratio;
    output[`gp_pct_total_last${size}`] = window.ratio;
    output[`gp_pct_avg_last${size}`] = output[`gp_pct_total_last${size}`];
  });
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
          .select("gameId, playerId, percentageOfPP, PPTOI, unit, pp_share_of_team")
          .eq("playerId", playerId)
          .in("gameId", chunk);
        if (error) throw error;
        return ((data ?? []) as PowerPlayCombinationRow[]).map((row) =>
          normalizeNumericFields(row)
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

function resolveLineCombo(
  lineRows: LineCombinationRow[],
  gameId: number | null,
  teamId: number | null,
  playerId: number
): PlayerGameData["lineCombo"] {
  if (gameId === null || !teamId) return { slot: null, positionGroup: null };
  const match = lineRows.find(
    (row) => row.gameId === gameId && row.teamId === teamId
  );
  if (!match) return { slot: null, positionGroup: null };

  const findSlot = (list: number[], groupSize: number): number | null => {
    const index = list.findIndex((value) => value === playerId);
    if (index === -1) return null;
    return Math.floor(index / groupSize) + 1;
  };

  const forwardSlot = findSlot(match.forwards, 3);
  if (forwardSlot) {
    return { slot: forwardSlot, positionGroup: "forward" };
  }
  const defenseSlot = findSlot(match.defensemen, 2);
  if (defenseSlot) {
    return { slot: defenseSlot, positionGroup: "defense" };
  }
  const goalieSlot = findSlot(match.goalies, 1);
  if (goalieSlot) {
    return { slot: goalieSlot, positionGroup: "goalie" };
  }
  return { slot: null, positionGroup: null };
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
      acc[row.gameId] = row;
      return acc;
    },
    {}
  );

  return wgoRows.map((wgo) => {
    const teamAbbrev = wgo.team_abbrev ?? wgo.current_team_abbreviation ?? "";
    const teamId = abbrevToTeamId[teamAbbrev] ?? null;
    const counts = countsByDate[wgo.date];
    const rates = ratesByDate[wgo.date];
    const countsOi = countsOiByDate[wgo.date];
    const originalGameId = wgo.game_id;
    const ppCombination =
      originalGameId && ppByGameId[originalGameId]
        ? ppByGameId[originalGameId]
        : undefined;
    const lineCombo = resolveLineCombo(
      lineRows,
      originalGameId,
      teamId,
      wgo.player_id
    );
    const fallbackToiSeconds =
      counts?.toi ??
      (countsOi as any)?.toi ??
      (wgo?.toi_per_game != null ? Math.round(wgo.toi_per_game * 60) : null);
    return {
      playerId: wgo.player_id,
      gameId:
        originalGameId && knownGameIds.has(originalGameId)
          ? originalGameId
          : null,
      gameDate: wgo.date,
      season: wgo.season_id ?? counts?.season ?? rates?.season ?? 0,
      teamId,
      strength,
      counts,
      rates,
      countsOi,
      wgo,
      ppCombination: ppCombination ?? null,
      lineCombo,
      fallbackToiSeconds
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
        unknownGameIdCount: 0
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
    unknownGameIdCount: 0
  };
  for (const config of STRENGTH_CONFIGS) {
    const strengthLabel = `[fetchRollingPlayerAverages] player:${playerId} strength:${config.state}`;
    console.time(strengthLabel);
    try {
      const [countsRows, ratesRows, countsOiRows] = await Promise.all([
        fetchCounts(config.countsTable, playerId, startDate, endDate),
        fetchRates(config.ratesTable, playerId, startDate, endDate),
        fetchCountsOi(config.countsOiTable, playerId, startDate, endDate)
      ]);

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

      const games = buildGameRecords(
        wgoRows,
        countsByDate,
        ratesByDate,
        countsOiByDate,
        lineRows,
        ppRows,
        config.state,
        knownGameIds
      );

      const simpleMetricsState: Record<string, RollingAccumulator> = {};
      const ratioMetricsState: Record<string, RatioRollingAccumulator> = {};
      const historicalSimpleMetricsState: Record<
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
      const historicalGpPctState = createHistoricalGpPctAccumulator();

      for (const game of games) {
        const playedThisGame = didPlayerCountAsAppearance(config.state, game);

        METRICS.forEach((metric) => {
          if (metric.aggregation === "ratio") {
            const components = metric.getComponents(game);
            updateRatioRollingAccumulator(
              ratioMetricsState[metric.key],
              components,
              {
                windowMode: "appearance",
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
          historicalSimpleMetricsState,
          historicalRatioMetricsState,
          historicalGpPctSnapshot,
          rollingGpPctSnapshot,
          game.season
        );

        if (config.state !== "all" && config.state !== "pp") {
          Object.keys(metricOutputs).forEach((key) => {
            if (key.startsWith("pp_share_pct")) {
              metricOutputs[key] = null;
            }
          });
        }

        outputs.push({
          player_id: game.playerId,
          game_id: game.gameId,
          game_date: game.gameDate,
          season: game.season,
          team_id: game.teamId,
          strength_state: config.state,
          line_combo_slot: game.lineCombo?.slot ?? null,
          line_combo_group: game.lineCombo?.positionGroup ?? null,
          pp_unit: game.ppCombination?.unit ?? null,
          gp_semantic_type:
            config.state === "all" ? "availability" : "participation",
          ...metricOutputs
        });
      }

      const suspiciousRows = outputs.filter(
        (row) => row.player_id === playerId && row.strength_state === config.state
      );
      const suspiciousSummary = summarizeSuspiciousOutputs({
        playerId,
        strength: config.state,
        rows: suspiciousRows
      });
      diagnostics.suspiciousOutputCount += suspiciousSummary.issueCount;
      suspiciousSummary.warnings.forEach((warning) => console.warn(warning));
    } finally {
      console.timeEnd(strengthLabel);
    }
  }

  return { rows: outputs, diagnostics };
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
  const games = await fetchGames();
  const ledger = buildTeamGameLedger(games);
  const knownGameIds = new Set(games.map((game) => game.id));

  const playerIds = await fetchPlayerIds(options);

  let resumePlayerId = options.resumePlayerId;
  const autoResumeEnabled =
    !options.forceFullRefresh &&
    options.playerId === undefined &&
    options.season === undefined &&
    options.startDate === undefined &&
    options.endDate === undefined;

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
  } else if (resumePlayerId === undefined && autoResumeEnabled) {
    const { data: resumeRow, error: resumeError } = await supabase
      .from("rolling_player_game_metrics")
      .select("player_id")
      .order("player_id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!resumeError && resumeRow?.player_id) {
      resumePlayerId = Number(resumeRow.player_id);
      console.info(
        "[fetchRollingPlayerAverages] Auto resume detected, last processed player_id:",
        resumePlayerId
      );
    }
  }

  if (resumePlayerId !== undefined) {
    console.info(
      "[fetchRollingPlayerAverages] Resuming processing for player_id values >",
      resumePlayerId
    );
  }

  const filteredPlayerIds =
    resumePlayerId !== undefined
      ? playerIds.filter((id) => id > resumePlayerId!)
      : playerIds;

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
        if (!rows.length) {
          processedPlayers += 1;
          playerProgress.update(
            processedPlayers,
            `player:${playerId} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings}`
          );
          continue;
        }
        playersWithRows += 1;
        const totalBatches = Math.ceil(rows.length / batchSize);
        playerProgress.update(
          processedPlayers,
          `player:${playerId} preparedRows:${rows.length} batches:${totalBatches} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings}`
        );

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          await upsertLimit(async () =>
            executeWithSlowLog(
              `upsert player:${playerId} batch:${batchNumber}/${totalBatches} rows:${batch.length}`,
              () =>
                executeWithRetry(
                  `upsert player:${playerId} batch:${batchNumber}/${totalBatches}`,
                  async () => {
                    const { error } = await supabase
                      .from("rolling_player_game_metrics")
                      .upsert(batch, {
                        onConflict: "player_id,game_date,strength_state"
                      });
                    if (error) {
                      throw error;
                    }
                  }
                )
            )
          );
          rowsUpserted += batch.length;
          playerProgress.update(
            processedPlayers,
            `player:${playerId} upsertedBatch:${batchNumber}/${totalBatches} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings}`
          );
        }
        // Keep a tiny pause between players to reduce lock contention spikes.
        await delay(20);
        processedPlayers += 1;
        playerProgress.update(
          processedPlayers,
          `player:${playerId} rowsUpserted:${rowsUpserted} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings}`
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
    `rowsUpserted:${rowsUpserted} playersWithRows:${playersWithRows} coverageWarn:${coverageWarnings} suspicious:${suspiciousOutputWarnings}`
  );

  console.info(
    "[fetchRollingPlayerAverages] Completed run",
    JSON.stringify({
      rowsUpserted,
      processedPlayers,
      playersWithRows,
      coverageWarnings,
      suspiciousOutputWarnings,
      unknownGameIds
    })
  );
}

export default { main };

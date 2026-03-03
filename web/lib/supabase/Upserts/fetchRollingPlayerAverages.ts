import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { parseISO, subDays, formatISO } from "date-fns";
import { teamsInfo } from "lib/teamsInfo";

type StrengthState = "all" | "ev" | "pp" | "pk";
type FullRefreshMode = "rpc_truncate" | "overwrite_only" | "delete";

type RollingWindow = 3 | 5 | 10 | 20;

const ROLLING_WINDOWS: RollingWindow[] = [3, 5, 10, 20];
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const TRANSIENT_GATEWAY_STATUSES = [502, 503, 504, 520, 522, 524];

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
  off_zone_start_pct: number | null;
  on_ice_sh_pct: number | null;
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
  unit: number | null;
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

interface MetricDefinition {
  key: string;
  getValue: (game: PlayerGameData) => number | null;
}

interface RollingAccumulator {
  sumAll: number;
  countAll: number;
  windows: Record<
    RollingWindow,
    { values: number[]; sum: number; count: number }
  >;
}

const METRICS: MetricDefinition[] = [
  {
    key: "sog_per_60",
    getValue: (game) => {
      if (game.rates?.shots_per_60 != null) return game.rates.shots_per_60;
      const shots = game.counts?.shots ?? game.wgo?.shots ?? null;
      const toiSeconds = getToiSeconds(game);
      if (shots == null || toiSeconds == null || toiSeconds === 0) return null;
      return (shots * 3600) / toiSeconds;
    }
  },
  {
    key: "ixg_per_60",
    getValue: (game) => {
      if (game.rates?.ixg_per_60 != null) return game.rates.ixg_per_60;
      const ixg = game.counts?.ixg ?? getWgoNumber(game, "ixg");
      const toiSeconds = getToiSeconds(game);
      if (ixg == null || toiSeconds == null || toiSeconds === 0) return null;
      return (ixg * 3600) / toiSeconds;
    }
  },
  {
    key: "shooting_pct",
    getValue: ({ counts, wgo, strength }) => {
      if (
        counts &&
        counts.sh_percentage !== null &&
        counts.sh_percentage !== undefined
      ) {
        return counts.sh_percentage;
      }
      if (strength === "all") {
        return wgo?.shooting_percentage ?? null;
      }
      return null;
    }
  },
  {
    key: "ixg",
    getValue: (game) => {
      if (game.counts?.ixg != null) return game.counts.ixg;
      return getWgoNumber(game, "ixg");
    }
  },
  {
    key: "primary_points_pct",
    getValue: ({ counts }) => {
      if (!counts) return null;
      const goals = counts.goals ?? 0;
      const firstAssists = counts.first_assists ?? 0;
      const totalPoints = counts.total_points ?? 0;
      if (totalPoints === 0) return 0;
      return (goals + firstAssists) / totalPoints;
    }
  },
  {
    key: "expected_sh_pct",
    getValue: (game) => {
      const ixg = game.counts?.ixg ?? getWgoNumber(game, "ixg");
      const shots = game.counts?.shots ?? game.wgo?.shots ?? null;
      if (shots === null || shots === 0 || ixg === null) return null;
      return ixg / shots;
    }
  },
  {
    key: "ipp",
    getValue: ({ counts }) => counts?.ipp ?? null
  },
  {
    key: "iscf",
    getValue: ({ counts }) => counts?.iscfs ?? null
  },
  {
    key: "ihdcf",
    getValue: ({ counts }) => counts?.hdcf ?? null
  },
  {
    key: "toi_seconds",
    getValue: (game) => getToiSeconds(game)
  },
  {
    key: "hits_per_60",
    getValue: (game) => {
      const hits = game.counts?.hits ?? game.wgo?.hits ?? null;
      const toiSeconds = getToiSeconds(game);
      if (hits == null || toiSeconds == null || toiSeconds === 0) return null;
      return (hits * 3600) / toiSeconds;
    }
  },
  {
    key: "blocks_per_60",
    getValue: (game) => {
      const blocks =
        game.counts?.shots_blocked ?? game.wgo?.blocked_shots ?? null;
      const toiSeconds = getToiSeconds(game);
      if (blocks == null || toiSeconds == null || toiSeconds === 0) return null;
      return (blocks * 3600) / toiSeconds;
    }
  },
  {
    key: "oz_start_pct",
    getValue: ({ countsOi }) => countsOi?.off_zone_start_pct ?? null
  },
  {
    key: "pp_share_pct",
    getValue: ({ ppCombination, strength }) => {
      if (strength !== "all" && strength !== "pp") return null;
      if (
        ppCombination?.percentageOfPP !== null &&
        ppCombination?.percentageOfPP !== undefined
      ) {
        return ppCombination.percentageOfPP;
      }
      return null;
    }
  },
  {
    key: "on_ice_sh_pct",
    getValue: ({ countsOi }) => countsOi?.on_ice_sh_pct ?? null
  },
  {
    key: "pdo",
    getValue: ({ countsOi }) => countsOi?.pdo ?? null
  },
  {
    key: "cf",
    getValue: ({ countsOi }) => countsOi?.cf ?? null
  },
  {
    key: "ca",
    getValue: ({ countsOi }) => countsOi?.ca ?? null
  },
  {
    key: "cf_pct",
    getValue: ({ countsOi }) => countsOi?.cf_pct ?? null
  },
  {
    key: "ff",
    getValue: ({ countsOi }) => countsOi?.ff ?? null
  },
  {
    key: "fa",
    getValue: ({ countsOi }) => countsOi?.fa ?? null
  },
  {
    key: "ff_pct",
    getValue: ({ countsOi }) => countsOi?.ff_pct ?? null
  },
  {
    key: "goals",
    getValue: ({ counts, wgo, strength }) => {
      if (counts && counts.goals !== null && counts.goals !== undefined) {
        return counts.goals;
      }
      if (strength === "all") {
        return wgo?.goals ?? null;
      }
      return null;
    }
  },
  {
    key: "assists",
    getValue: ({ counts, wgo, strength }) => {
      if (
        counts &&
        counts.total_assists !== null &&
        counts.total_assists !== undefined
      ) {
        return counts.total_assists;
      }
      if (strength === "all") {
        return wgo?.assists ?? null;
      }
      return null;
    }
  },
  {
    key: "shots",
    getValue: ({ counts, wgo, strength }) => {
      if (counts && counts.shots !== null && counts.shots !== undefined) {
        return counts.shots;
      }
      if (strength === "all") {
        return wgo?.shots ?? null;
      }
      return null;
    }
  },
  {
    key: "hits",
    getValue: ({ counts, wgo, strength }) => {
      if (counts && counts.hits !== null && counts.hits !== undefined) {
        return counts.hits;
      }
      if (strength === "all") {
        return wgo?.hits ?? null;
      }
      return null;
    }
  },
  {
    key: "blocks",
    getValue: ({ counts, wgo, strength }) => {
      if (
        counts &&
        counts.shots_blocked !== null &&
        counts.shots_blocked !== undefined
      ) {
        return counts.shots_blocked;
      }
      if (strength === "all") {
        return wgo?.blocked_shots ?? null;
      }
      return null;
    }
  },
  {
    key: "pp_points",
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
    getValue: ({ counts, wgo, strength }) => {
      if (
        counts &&
        counts.total_points !== null &&
        counts.total_points !== undefined
      ) {
        return counts.total_points;
      }
      if (strength === "all") {
        return wgo?.points ?? null;
      }
      return null;
    }
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

type TeamGameLedger = Record<number, { date: string; cumulative: number }[]>;

function buildTeamGameLedger(games: GameRow[]): TeamGameLedger {
  const ledger: TeamGameLedger = {};
  const pushGame = (teamId: number, date: string) => {
    if (!ledger[teamId]) {
      ledger[teamId] = [];
    }
    ledger[teamId].push({ date, cumulative: 0 });
  };

  games.forEach((game) => {
    pushGame(game.homeTeamId, game.date);
    pushGame(game.awayTeamId, game.date);
  });

  for (const teamIdStr of Object.keys(ledger)) {
    const teamId = Number(teamIdStr);
    const entries = ledger[teamId];
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
  date: string
): number {
  if (!teamId) return 0;
  const entries = ledger[teamId];
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

function getTeamGamesWindowCount(
  ledger: TeamGameLedger,
  teamId: number | null,
  startDate: string,
  endDate: string
): number {
  if (!teamId) return 0;
  const beforeStart = formatISO(subDays(parseISO(startDate), 1), {
    representation: "date"
  });
  const endCount = getTeamGamesPlayed(ledger, teamId, endDate);
  const startCount = getTeamGamesPlayed(ledger, teamId, beforeStart);
  return Math.max(endCount - startCount, 0);
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

function deriveOutputs(
  metricsState: Record<string, RollingAccumulator>,
  gamesPlayed: number,
  teamGamesPlayed: number,
  teamGamesWindow: Record<RollingWindow, number>,
  playerGamesWindow: Record<RollingWindow, number>
) {
  const output: Record<string, number | null> = {};
  for (const metric of METRICS) {
    const acc = metricsState[metric.key];
    if (!acc) continue;
    const totalAll = Number(acc.sumAll) || 0;
    output[`${metric.key}_total_all`] =
      acc.countAll > 0 ? Number(totalAll.toFixed(6)) : null;
    output[`${metric.key}_avg_all`] =
      acc.countAll > 0 ? Number((totalAll / acc.countAll).toFixed(6)) : null;
    ROLLING_WINDOWS.forEach((size) => {
      const window = acc.windows[size];
      const windowSum = Number(window.sum) || 0;
      output[`${metric.key}_total_last${size}`] =
        window.count > 0 ? Number(windowSum.toFixed(6)) : null;
      output[`${metric.key}_avg_last${size}`] =
        window.count > 0 ? Number((windowSum / window.count).toFixed(6)) : null;
    });
  }
  output.games_played = gamesPlayed;
  output.team_games_played = teamGamesPlayed;
  output.gp_pct_total_all =
    teamGamesPlayed > 0
      ? Number((gamesPlayed / teamGamesPlayed).toFixed(6))
      : null;
  output.gp_pct_avg_all = output.gp_pct_total_all;
  ROLLING_WINDOWS.forEach((size) => {
    const teamGames = teamGamesWindow[size] ?? 0;
    const playerGames = playerGamesWindow[size] ?? 0;
    output[`gp_pct_total_last${size}`] =
      teamGames > 0
        ? Number(Math.min(1, playerGames / teamGames).toFixed(6))
        : null;
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
          .select("id, date, homeTeamId, awayTeamId")
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
        "player_id, game_id, date, season_id, team_abbrev, current_team_abbreviation, goals, assists, shots, shooting_percentage, hits, blocked_shots, points, pp_points, toi_per_game"
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
            "date_scraped, season, toi, off_zone_start_pct, on_ice_sh_pct, pdo, cf, ca, cf_pct, ff, fa, ff_pct"
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
          .select("gameId, playerId, percentageOfPP, unit")
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
): Promise<any[]> {
  const wgoRows = await fetchWgoRowsForPlayer(playerId, options);
  if (wgoRows.length === 0) return [];
  const startDate = wgoRows[0].date;
  const endDate = wgoRows[wgoRows.length - 1].date;
  const gameIds = wgoRows
    .map((row) => row.game_id)
    .filter((id): id is number => typeof id === "number");
  const ppRows = await fetchPowerPlayCombinations(playerId, gameIds);
  const lineRows = await fetchLineCombinations(gameIds);

  const outputs: any[] = [];
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

      const metricsState: Record<string, RollingAccumulator> = {};
      METRICS.forEach((metric) => {
        metricsState[metric.key] = initAccumulator();
      });

      let gamesPlayed = 0;
      const appearanceDates: string[] = [];

      for (const game of games) {
        METRICS.forEach((metric) => {
          const value = metric.getValue(game);
          updateAccumulator(metricsState[metric.key], value);
        });

        const playedThisGame =
          config.state === "all"
            ? 1
            : (() => {
                const toiSeconds = getToiSeconds(game);
                return toiSeconds && toiSeconds > 0 ? 1 : 0;
              })();

        if (playedThisGame > 0) {
          gamesPlayed += 1;
          appearanceDates.push(game.gameDate);
        }

        const teamGamesPlayed = getTeamGamesPlayed(
          ledger,
          game.teamId ?? null,
          game.gameDate
        );

        const teamGamesWindow: Record<RollingWindow, number> = {
          3: 0,
          5: 0,
          10: 0,
          20: 0
        };
        const playerGamesWindow: Record<RollingWindow, number> = {
          3: 0,
          5: 0,
          10: 0,
          20: 0
        };

        ROLLING_WINDOWS.forEach((size) => {
          const windowDates = appearanceDates.slice(
            Math.max(appearanceDates.length - size, 0)
          );
          if (windowDates.length === 0) {
            teamGamesWindow[size] = 0;
            playerGamesWindow[size] = 0;
            return;
          }
          const windowStart = windowDates[0];
          teamGamesWindow[size] = getTeamGamesWindowCount(
            ledger,
            game.teamId ?? null,
            windowStart,
            game.gameDate
          );
          playerGamesWindow[size] = windowDates.length;
        });

        const metricOutputs = deriveOutputs(
          metricsState,
          gamesPlayed,
          teamGamesPlayed,
          teamGamesWindow,
          playerGamesWindow
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
          ...metricOutputs
        });
      }
    } finally {
      console.timeEnd(strengthLabel);
    }
  }

  return outputs;
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
        const rows = await processPlayer(playerId, ledger, knownGameIds, options);
        if (!rows.length) {
          processedPlayers += 1;
          playerProgress.update(
            processedPlayers,
            `player:${playerId} rowsUpserted:${rowsUpserted}`
          );
          continue;
        }
        playersWithRows += 1;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await upsertLimit(async () =>
            executeWithRetry(
              `upsert player:${playerId} batch:${i / batchSize}`,
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
          );
          rowsUpserted += batch.length;
        }
        // Keep a tiny pause between players to reduce lock contention spikes.
        await delay(20);
        processedPlayers += 1;
        playerProgress.update(
          processedPlayers,
          `player:${playerId} rowsUpserted:${rowsUpserted}`
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
    `rowsUpserted:${rowsUpserted} playersWithRows:${playersWithRows}`
  );

  console.info(
    "[fetchRollingPlayerAverages] Completed run",
    JSON.stringify({ rowsUpserted, processedPlayers, playersWithRows })
  );
}

export default { main };

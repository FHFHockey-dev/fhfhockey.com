import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

export type EspnMoneylineOdds = {
  home: string | null;
  away: string | null;
};

export type EspnLineOdds = {
  line: string | null;
  odds: string | null;
};

export type EspnGameOdds = {
  gameId: string;
  requestedDate: string;
  localDate: string | null;
  name: string | null;
  date: string | null;
  status: string | null;
  homeTeam: string;
  awayTeam: string;
  provider: string | null;
  moneyline: EspnMoneylineOdds;
  spread: {
    home: EspnLineOdds;
    away: EspnLineOdds;
  };
  total: {
    over: EspnLineOdds;
    under: EspnLineOdds;
  };
};

export type EspnOddsPayload = {
  success: boolean;
  generatedAt: string;
  count: number;
  odds: EspnGameOdds[];
  error?: string;
};

type EspnEvent = Record<string, any>;

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard";
export const ESPN_MARKET_ODDS_SOURCE_NAME = "espn_site_api_market_odds";
export const ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME =
  "espn_site_api_market_odds_rejected";
export const HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME =
  "historical_market_odds_import";
export const HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME =
  "historical_market_odds_import_rejected";
const MARKET_ODDS_CAPTURE_CLOCK_TOLERANCE_MS = 5 * 60_000;

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

type TeamRow = Pick<Tables<"teams">, "id" | "abbreviation">;
type GameRow = Pick<
  Tables<"games">,
  "id" | "date" | "startTime" | "homeTeamId" | "awayTeamId"
>;
type MarketOddsSnapshotInsert =
  Database["public"]["Tables"]["game_prediction_market_odds_snapshots"]["Insert"];
type SourceProvenanceInsert =
  Database["public"]["Tables"]["source_provenance_snapshots"]["Insert"];
type MarketOddsSnapshotRow = Pick<
  Tables<"game_prediction_market_odds_snapshots">,
  | "game_id"
  | "espn_game_id"
  | "provider"
  | "captured_at"
  | "requested_date"
  | "game_date"
  | "event_start_at"
  | "home_team_abbreviation"
  | "away_team_abbreviation"
  | "home_moneyline"
  | "away_moneyline"
  | "home_spread_line"
  | "home_spread_odds"
  | "away_spread_line"
  | "away_spread_odds"
  | "total_line"
  | "over_odds"
  | "under_odds"
  | "source_payload"
  | "metadata"
>;

type RejectedMarketOddsProvenanceInput = {
  odds: EspnGameOdds;
  capturedAt: string;
  captureRecordedAt: string;
  game: GameRow;
  rejectionReason: "post_start_capture" | "missing_moneyline";
};

type HistoricalMarketOddsRejectedProvenanceInput = {
  row: HistoricalMarketOddsImportRow;
  importedAt: string;
  importBatchId: string;
  game: GameRow;
  rejectionReason:
    | "invalid_captured_at"
    | "post_start_capture"
    | "missing_moneyline"
    | "missing_provider"
    | "missing_source_url"
    | "missing_team";
};

const MARKET_ODDS_PUBLIC_SELECT = [
  "game_id",
  "espn_game_id",
  "provider",
  "captured_at",
  "requested_date",
  "game_date",
  "event_start_at",
  "home_team_abbreviation",
  "away_team_abbreviation",
  "home_moneyline",
  "away_moneyline",
  "home_spread_line",
  "home_spread_odds",
  "away_spread_line",
  "away_spread_odds",
  "total_line",
  "over_odds",
  "under_odds",
  "source_payload",
  "metadata",
].join(",");

export type NoVigMoneylineProbabilities = {
  home: number;
  away: number;
  homeRaw: number;
  awayRaw: number;
  overround: number;
};

export type EspnOddsIngestionResult = {
  requestedDates: string[];
  capturedAt: string;
  captureRecordedAt: string;
  captureClockSkewMs: number;
  fetchedGames: number;
  insertedSnapshots: number;
  skippedSnapshots: number;
  postStartSkippedSnapshots: number;
  missingMoneylineSnapshots: number;
  unmappedGames: number;
  provenanceRows: number;
  rejectedProvenanceRows: number;
  dryRun: boolean;
};

export type EspnOddsWindowIngestionResult = EspnOddsIngestionResult & {
  batchCount: number;
  batches: EspnOddsIngestionResult[];
};

export type HistoricalMarketOddsImportRow = {
  gameId: number;
  provider: string;
  capturedAt: string;
  sourceUrl: string;
  homeMoneyline: number | string | null;
  awayMoneyline: number | string | null;
  requestedDate?: string | null;
  espnGameId?: string | null;
  homeSpreadLine?: number | string | null;
  homeSpreadOdds?: number | string | null;
  awaySpreadLine?: number | string | null;
  awaySpreadOdds?: number | string | null;
  totalLine?: number | string | null;
  overOdds?: number | string | null;
  underOdds?: number | string | null;
  sourcePayload?: Json;
  metadata?: Json;
};

export type HistoricalMarketOddsImportResult = {
  importedAt: string;
  importBatchId: string;
  requestedRows: number;
  candidateSnapshots: number;
  importedSnapshots: number;
  rowsInserted: number;
  skippedSnapshots: number;
  missingGameRows: number;
  invalidRows: number;
  postStartRejectedRows: number;
  provenanceRows: number;
  rejectedProvenanceRows: number;
  dryRun: boolean;
  rejectionReasons: Record<string, number>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/-/g, "");
  if (!/^\d{8}$/.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}`;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function addHoursIso(iso: string, hours: number): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed + hours * 3_600_000).toISOString();
}

function resolveMarketOddsCaptureTimestamps(args: {
  capturedAt?: string;
  now?: Date;
}): {
  capturedAt: string;
  captureRecordedAt: string;
  captureClockSkewMs: number;
} {
  const captureRecordedAt = (args.now ?? new Date()).toISOString();
  const capturedAt = args.capturedAt ?? captureRecordedAt;
  const capturedAtMs = Date.parse(capturedAt);
  const captureRecordedAtMs = Date.parse(captureRecordedAt);

  if (!Number.isFinite(capturedAtMs)) {
    throw new Error("capturedAt must be a valid ISO timestamp.");
  }

  const captureClockSkewMs = capturedAtMs - captureRecordedAtMs;
  if (Math.abs(captureClockSkewMs) > MARKET_ODDS_CAPTURE_CLOCK_TOLERANCE_MS) {
    throw new Error(
      "ESPN odds capturedAt must reflect the current observation time; backdated or future capture timestamps are not allowed for live ESPN odds ingestion.",
    );
  }

  return { capturedAt, captureRecordedAt, captureClockSkewMs };
}

function earliestIso(...values: Array<string | null | undefined>): string | null {
  const valid = values
    .map((value) => {
      if (!value) return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? { value, parsed } : null;
    })
    .filter((value): value is { value: string; parsed: number } => Boolean(value))
    .sort((left, right) => left.parsed - right.parsed);
  return valid[0]?.value ?? null;
}

function resolveRequestedOddsDateWindow(args: {
  fromDate?: string | string[];
  toDate?: string | string[];
  fromOffsetDays?: number;
  toOffsetDays?: number;
  now?: Date;
}): { fromDate: string; toDate: string } {
  const explicitFromDate = normalizeDate(firstParam(args.fromDate));
  const explicitToDate = normalizeDate(firstParam(args.toDate));
  const today = (args.now ?? new Date()).toISOString().slice(0, 10);
  const hasRelativeOffset =
    args.fromOffsetDays != null || args.toOffsetDays != null;
  const fromDate =
    explicitFromDate ?? addDays(today, args.fromOffsetDays ?? 0);
  const toDate =
    explicitToDate ??
    (explicitFromDate || !hasRelativeOffset
      ? addDays(fromDate, 7)
      : addDays(today, args.toOffsetDays ?? args.fromOffsetDays ?? 0));

  return { fromDate, toDate };
}

export function parseRequestedOddsDates(args: {
  dates?: string | string[];
  fromDate?: string | string[];
  toDate?: string | string[];
  fromOffsetDays?: number;
  toOffsetDays?: number;
  now?: Date;
}): string[] {
  const explicitDates = firstParam(args.dates)
    ?.split(",")
    .map((date) => normalizeDate(date.trim()))
    .filter((date): date is string => Boolean(date));
  if (explicitDates?.length) {
    return Array.from(new Set(explicitDates)).slice(0, 14);
  }

  const { fromDate, toDate } = resolveRequestedOddsDateWindow(args);
  const dates: string[] = [];
  for (
    let current = fromDate;
    current <= toDate && dates.length < 14;
    current = addDays(current, 1)
  ) {
    dates.push(current);
  }
  return dates;
}

export function parseRequestedOddsDateBatches(args: {
  dates?: string | string[];
  fromDate?: string | string[];
  toDate?: string | string[];
  fromOffsetDays?: number;
  toOffsetDays?: number;
  maxDates?: number;
  batchSize?: number;
  now?: Date;
}): string[][] {
  const maxDates = Math.min(Math.max(args.maxDates ?? 56, 1), 366);
  const batchSize = Math.min(Math.max(args.batchSize ?? 14, 1), 14);
  const explicitDates = firstParam(args.dates)
    ?.split(",")
    .map((date) => normalizeDate(date.trim()))
    .filter((date): date is string => Boolean(date));

  let requestedDates: string[];
  if (explicitDates?.length) {
    requestedDates = Array.from(new Set(explicitDates)).slice(0, maxDates);
  } else {
    const { fromDate, toDate } = resolveRequestedOddsDateWindow(args);
    requestedDates = [];
    for (
      let current = fromDate;
      current <= toDate && requestedDates.length < maxDates;
      current = addDays(current, 1)
    ) {
      requestedDates.push(current);
    }
  }

  const batches: string[][] = [];
  for (let index = 0; index < requestedDates.length; index += batchSize) {
    batches.push(requestedDates.slice(index, index + batchSize));
  }
  return batches;
}

function localDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function stringOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimLineNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function formatAmericanOdds(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  return value > 0 ? `+${Math.round(value)}` : String(Math.round(value));
}

function formatSpreadLine(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const formatted = trimLineNumber(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatTotalLine(
  prefix: "o" | "u",
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${prefix}${trimLineNumber(value)}`;
}

export function espnScoreboardUrlForDate(date: string): string {
  return `${ESPN_SCOREBOARD_URL}?dates=${date.replace(/-/g, "")}`;
}

export function parseAmericanOdds(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0 ? Math.round(value) : null;
  }
  const normalized = value.trim().replace(/^\+/, "");
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function parseLineNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value.trim().replace(/^[ou]/i, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundProbability(value: number): number {
  return Number(value.toFixed(6));
}

export function americanOddsToImpliedProbability(
  value: number | string | null | undefined,
): number | null {
  const odds = parseAmericanOdds(value);
  if (odds == null) return null;
  const probability = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  return roundProbability(probability);
}

export function calculateNoVigMoneylineProbabilities(args: {
  homeMoneyline: number | string | null | undefined;
  awayMoneyline: number | string | null | undefined;
}): NoVigMoneylineProbabilities | null {
  const homeRaw = americanOddsToImpliedProbability(args.homeMoneyline);
  const awayRaw = americanOddsToImpliedProbability(args.awayMoneyline);
  if (homeRaw == null || awayRaw == null) return null;
  const total = homeRaw + awayRaw;
  if (total <= 0) return null;
  return {
    home: roundProbability(homeRaw / total),
    away: roundProbability(awayRaw / total),
    homeRaw,
    awayRaw,
    overround: roundProbability(total - 1),
  };
}

function teamAbbreviation(competitor: Record<string, any>): string | null {
  return stringOrNull(competitor.team?.abbreviation);
}

function parseEvent(event: EspnEvent, requestedDate: string): EspnGameOdds | null {
  const competition = event.competitions?.[0];
  const competitors = Array.isArray(competition?.competitors)
    ? competition.competitors
    : [];
  const homeTeam =
    competitors.find((competitor: Record<string, any>) => competitor.homeAway === "home") ??
    competitors[0];
  const awayTeam =
    competitors.find((competitor: Record<string, any>) => competitor.homeAway === "away") ??
    competitors[1];
  const homeAbbreviation = homeTeam ? teamAbbreviation(homeTeam) : null;
  const awayAbbreviation = awayTeam ? teamAbbreviation(awayTeam) : null;
  if (!homeAbbreviation || !awayAbbreviation) return null;

  const oddsProvider = Array.isArray(competition?.odds)
    ? competition.odds[0]
    : null;

  return {
    gameId: String(event.id ?? ""),
    requestedDate,
    localDate: localDate(stringOrNull(event.date)),
    name: stringOrNull(event.name),
    date: stringOrNull(event.date),
    status: stringOrNull(event.status?.type?.description),
    homeTeam: homeAbbreviation,
    awayTeam: awayAbbreviation,
    provider: stringOrNull(
      oddsProvider?.provider?.displayName ?? oddsProvider?.provider?.name,
    ),
    moneyline: {
      home: stringOrNull(oddsProvider?.moneyline?.home?.close?.odds),
      away: stringOrNull(oddsProvider?.moneyline?.away?.close?.odds),
    },
    spread: {
      home: {
        line: stringOrNull(oddsProvider?.pointSpread?.home?.close?.line),
        odds: stringOrNull(oddsProvider?.pointSpread?.home?.close?.odds),
      },
      away: {
        line: stringOrNull(oddsProvider?.pointSpread?.away?.close?.line),
        odds: stringOrNull(oddsProvider?.pointSpread?.away?.close?.odds),
      },
    },
    total: {
      over: {
        line: stringOrNull(oddsProvider?.total?.over?.close?.line),
        odds: stringOrNull(oddsProvider?.total?.over?.close?.odds),
      },
      under: {
        line: stringOrNull(oddsProvider?.total?.under?.close?.line),
        odds: stringOrNull(oddsProvider?.total?.under?.close?.odds),
      },
    },
  };
}

export async function fetchEspnNhlOdds(dates: string[]): Promise<EspnGameOdds[]> {
  const games = await Promise.all(
    dates.map(async (date) => {
      const response = await fetch(
        espnScoreboardUrlForDate(date),
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
          },
        },
      );
      if (!response.ok) {
        throw new Error(`ESPN odds request failed with ${response.status}`);
      }
      const body = await response.json();
      const events = Array.isArray(body.events) ? body.events : [];
      return events.flatMap((event: EspnEvent) => {
        const parsed = parseEvent(event, date);
        return parsed ? [parsed] : [];
      });
    }),
  );

  const unique = new Map<string, EspnGameOdds>();
  for (const game of games.flat()) {
    const key = `${game.localDate ?? game.requestedDate}|${game.awayTeam}|${game.homeTeam}`;
    unique.set(key, game);
  }
  return Array.from(unique.values());
}

function publicOddsKey(
  game: Pick<
    EspnGameOdds,
    "requestedDate" | "localDate" | "awayTeam" | "homeTeam"
  >,
): string {
  return `${game.localDate ?? game.requestedDate}|${game.awayTeam}|${game.homeTeam}`;
}

export function mergeEspnOddsPreferPersisted(args: {
  persisted: EspnGameOdds[];
  live: EspnGameOdds[];
}): EspnGameOdds[] {
  const merged = new Map<string, EspnGameOdds>();
  for (const game of args.live) {
    merged.set(publicOddsKey(game), game);
  }
  for (const game of args.persisted) {
    merged.set(publicOddsKey(game), game);
  }
  return Array.from(merged.values());
}

export function marketOddsSnapshotRowToEspnGameOdds(
  row: MarketOddsSnapshotRow,
): EspnGameOdds {
  const sourcePayload = isRecord(row.source_payload) ? row.source_payload : {};
  const metadata = isRecord(row.metadata) ? row.metadata : {};

  return {
    gameId: row.espn_game_id ?? String(row.game_id),
    requestedDate: String(row.requested_date),
    localDate: String(row.game_date),
    name: stringOrNull(sourcePayload.name),
    date: stringOrNull(sourcePayload.date ?? row.event_start_at),
    status: stringOrNull(metadata.status),
    homeTeam: row.home_team_abbreviation,
    awayTeam: row.away_team_abbreviation,
    provider: row.provider,
    moneyline: {
      home: formatAmericanOdds(row.home_moneyline),
      away: formatAmericanOdds(row.away_moneyline),
    },
    spread: {
      home: {
        line: formatSpreadLine(row.home_spread_line),
        odds: formatAmericanOdds(row.home_spread_odds),
      },
      away: {
        line: formatSpreadLine(row.away_spread_line),
        odds: formatAmericanOdds(row.away_spread_odds),
      },
    },
    total: {
      over: {
        line: formatTotalLine("o", row.total_line),
        odds: formatAmericanOdds(row.over_odds),
      },
      under: {
        line: formatTotalLine("u", row.total_line),
        odds: formatAmericanOdds(row.under_odds),
      },
    },
  };
}

export async function fetchPersistedEspnNhlOddsSnapshots(args: {
  client: SupabaseClient<Database>;
  dates: string[];
}): Promise<EspnGameOdds[]> {
  const requestedDates = Array.from(new Set(args.dates)).slice(0, 14);
  if (requestedDates.length === 0) return [];

  const { data, error } = await args.client
    .from("game_prediction_market_odds_snapshots")
    .select(MARKET_ODDS_PUBLIC_SELECT)
    .in("game_date", requestedDates)
    .order("captured_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const latestByGame = new Map<string, EspnGameOdds>();
  for (const row of (data ?? []) as unknown as MarketOddsSnapshotRow[]) {
    if (
      row.event_start_at &&
      Date.parse(row.captured_at) >= Date.parse(row.event_start_at)
    ) {
      continue;
    }
    const odds = marketOddsSnapshotRowToEspnGameOdds(row);
    const key = publicOddsKey(odds);
    if (!latestByGame.has(key)) {
      latestByGame.set(key, odds);
    }
  }

  return Array.from(latestByGame.values());
}

function buildEspnMarketOddsSnapshotInsert(args: {
  odds: EspnGameOdds;
  capturedAt: string;
  captureRecordedAt: string;
  game: GameRow;
  homeTeamId: number;
  awayTeamId: number;
}): MarketOddsSnapshotInsert | null {
  const homeMoneyline = parseAmericanOdds(args.odds.moneyline.home);
  const awayMoneyline = parseAmericanOdds(args.odds.moneyline.away);
  if (homeMoneyline == null || awayMoneyline == null) return null;

  const noVig = calculateNoVigMoneylineProbabilities({
    homeMoneyline,
    awayMoneyline,
  });

  return {
    game_id: args.game.id,
    espn_game_id: args.odds.gameId,
    provider: args.odds.provider ?? "unknown",
    captured_at: args.capturedAt,
    requested_date: args.odds.requestedDate,
    game_date: args.game.date,
    event_start_at: args.odds.date ?? args.game.startTime ?? null,
    home_team_id: args.homeTeamId,
    away_team_id: args.awayTeamId,
    home_team_abbreviation: args.odds.homeTeam,
    away_team_abbreviation: args.odds.awayTeam,
    home_moneyline: homeMoneyline,
    away_moneyline: awayMoneyline,
    home_market_no_vig_probability: noVig?.home ?? null,
    away_market_no_vig_probability: noVig?.away ?? null,
    market_overround: noVig?.overround ?? null,
    home_spread_line: parseLineNumber(args.odds.spread.home.line),
    home_spread_odds: parseAmericanOdds(args.odds.spread.home.odds),
    away_spread_line: parseLineNumber(args.odds.spread.away.line),
    away_spread_odds: parseAmericanOdds(args.odds.spread.away.odds),
    total_line:
      parseLineNumber(args.odds.total.over.line) ??
      parseLineNumber(args.odds.total.under.line),
    over_odds: parseAmericanOdds(args.odds.total.over.odds),
    under_odds: parseAmericanOdds(args.odds.total.under.odds),
    source_url: espnScoreboardUrlForDate(args.odds.requestedDate),
    source_payload: args.odds as unknown as Json,
    provenance: {
      provider: "espn_site_api",
      source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
      endpoint: ESPN_SCOREBOARD_URL,
      guardrail:
        "eligible for model features only when captured_at is before prediction cutoff and puck drop",
      capture_recorded_at: args.captureRecordedAt,
    },
    metadata: {
      requested_local_date: args.odds.localDate,
      status: args.odds.status,
      no_vig_moneyline: noVig,
      capture_recorded_at: args.captureRecordedAt,
      source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
      capture_timestamp_guardrail:
        "captured_at must reflect the live ESPN observation time; backdated live captures are rejected",
    },
  };
}

function gameKey(date: string, awayTeamId: number, homeTeamId: number): string {
  return `${date}|${awayTeamId}|${homeTeamId}`;
}

export function buildMarketOddsSourceProvenanceRows(
  inserts: MarketOddsSnapshotInsert[],
  options?: { sourceName?: string },
): SourceProvenanceInsert[] {
  const updatedAt = new Date().toISOString();

  return inserts.map((insert) => ({
    snapshot_date: insert.game_date,
    source_type: "game_prediction_market_odds",
    entity_type: "game",
    entity_id: insert.game_id,
    game_id: insert.game_id,
    source_name: options?.sourceName ?? ESPN_MARKET_ODDS_SOURCE_NAME,
    source_url: insert.source_url,
    source_rank: 1,
    is_official: false,
    status: "observed",
    observed_at: insert.captured_at,
    freshness_expires_at: earliestIso(
      addHoursIso(insert.captured_at, 24),
      insert.event_start_at,
    ),
    payload: {
      provider: insert.provider,
      requestedDate: insert.requested_date,
      homeTeamAbbreviation: insert.home_team_abbreviation,
      awayTeamAbbreviation: insert.away_team_abbreviation,
      homeMoneyline: insert.home_moneyline,
      awayMoneyline: insert.away_moneyline,
      homeMarketNoVigProbability: insert.home_market_no_vig_probability,
      awayMarketNoVigProbability: insert.away_market_no_vig_probability,
      marketOverround: insert.market_overround,
    } as unknown as Json,
    metadata: {
      guardrail:
        "eligible for model features only when captured_at is before prediction cutoff and puck drop",
      oddsSnapshotSource: "game_prediction_market_odds_snapshots",
      eventStartAt: insert.event_start_at,
      captureRecordedAt:
        (isRecord(insert.metadata)
          ? stringOrNull(insert.metadata.capture_recorded_at)
          : null) ?? insert.captured_at,
      importRecordedAt:
        (isRecord(insert.metadata)
          ? stringOrNull(insert.metadata.import_recorded_at)
          : null) ?? null,
      importBatchId:
        (isRecord(insert.metadata)
          ? stringOrNull(insert.metadata.import_batch_id)
          : null) ??
        (isRecord(insert.provenance)
          ? stringOrNull(insert.provenance.import_batch_id)
          : null) ??
        null,
    } as unknown as Json,
    updated_at: updatedAt,
  }));
}

export function buildRejectedMarketOddsSourceProvenanceRows(
  inputs: RejectedMarketOddsProvenanceInput[],
): SourceProvenanceInsert[] {
  const updatedAt = new Date().toISOString();

  return inputs.map(
    ({ odds, capturedAt, captureRecordedAt, game, rejectionReason }) => ({
      snapshot_date: game.date,
      source_type: "game_prediction_market_odds",
      entity_type: "game",
      entity_id: game.id,
      game_id: game.id,
      source_name: ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME,
      source_url: espnScoreboardUrlForDate(odds.requestedDate),
      source_rank: 1,
      is_official: false,
      status: "rejected",
      observed_at: capturedAt,
      freshness_expires_at: earliestIso(
        addHoursIso(capturedAt, 24),
        game.startTime,
        odds.date,
      ),
      payload: {
        provider: odds.provider,
        requestedDate: odds.requestedDate,
        homeTeamAbbreviation: odds.homeTeam,
        awayTeamAbbreviation: odds.awayTeam,
        homeMoneyline: odds.moneyline.home,
        awayMoneyline: odds.moneyline.away,
        status: odds.status,
      } as unknown as Json,
      metadata: {
        rejectionReason,
        guardrail:
          "not eligible for model features; no pre-cutoff market odds snapshot was persisted",
        canonicalObservedSourceName: ESPN_MARKET_ODDS_SOURCE_NAME,
        eventStartAt: game.startTime ?? odds.date,
        captureRecordedAt,
      } as unknown as Json,
      updated_at: updatedAt,
    }),
  );
}

function buildHistoricalMarketOddsImportInsert(args: {
  row: HistoricalMarketOddsImportRow;
  importedAt: string;
  importBatchId: string;
  game: GameRow;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
}): { insert: MarketOddsSnapshotInsert } | { rejectionReason: HistoricalMarketOddsRejectedProvenanceInput["rejectionReason"] } {
  const provider = args.row.provider.trim();
  if (!provider) return { rejectionReason: "missing_provider" };
  const sourceUrl = args.row.sourceUrl.trim();
  if (!sourceUrl) return { rejectionReason: "missing_source_url" };

  const capturedAtMs = Date.parse(args.row.capturedAt);
  if (!Number.isFinite(capturedAtMs)) {
    return { rejectionReason: "invalid_captured_at" };
  }
  if (
    args.game.startTime &&
    capturedAtMs >= Date.parse(args.game.startTime)
  ) {
    return { rejectionReason: "post_start_capture" };
  }

  const homeMoneyline = parseAmericanOdds(args.row.homeMoneyline);
  const awayMoneyline = parseAmericanOdds(args.row.awayMoneyline);
  if (homeMoneyline == null || awayMoneyline == null) {
    return { rejectionReason: "missing_moneyline" };
  }

  const noVig = calculateNoVigMoneylineProbabilities({
    homeMoneyline,
    awayMoneyline,
  });
  const requestedDate =
    normalizeDate(args.row.requestedDate ?? undefined) ?? args.game.date;

  return {
    insert: {
      game_id: args.game.id,
      espn_game_id: args.row.espnGameId ?? null,
      provider,
      captured_at: args.row.capturedAt,
      requested_date: requestedDate,
      game_date: args.game.date,
      event_start_at: args.game.startTime ?? null,
      home_team_id: args.homeTeam.id,
      away_team_id: args.awayTeam.id,
      home_team_abbreviation: args.homeTeam.abbreviation,
      away_team_abbreviation: args.awayTeam.abbreviation,
      home_moneyline: homeMoneyline,
      away_moneyline: awayMoneyline,
      home_market_no_vig_probability: noVig?.home ?? null,
      away_market_no_vig_probability: noVig?.away ?? null,
      market_overround: noVig?.overround ?? null,
      home_spread_line: parseLineNumber(args.row.homeSpreadLine),
      home_spread_odds: parseAmericanOdds(args.row.homeSpreadOdds),
      away_spread_line: parseLineNumber(args.row.awaySpreadLine),
      away_spread_odds: parseAmericanOdds(args.row.awaySpreadOdds),
      total_line: parseLineNumber(args.row.totalLine),
      over_odds: parseAmericanOdds(args.row.overOdds),
      under_odds: parseAmericanOdds(args.row.underOdds),
      source_url: sourceUrl,
      source_payload:
        args.row.sourcePayload ??
        ({
          gameId: args.row.gameId,
          provider,
          capturedAt: args.row.capturedAt,
          sourceUrl,
        } as unknown as Json),
      provenance: {
        provider: "historical_market_odds_import",
        import_source_name: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
        import_recorded_at: args.importedAt,
        import_batch_id: args.importBatchId,
        guardrail:
          "eligible for model features only when captured_at is before prediction cutoff and puck drop",
      } as unknown as Json,
      metadata: {
        ...(isRecord(args.row.metadata) ? args.row.metadata : {}),
        import_recorded_at: args.importedAt,
        import_batch_id: args.importBatchId,
        import_source_name: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
        no_vig_moneyline: noVig,
        source_guardrail:
          "imported historical market odds must carry a real source observation captured_at before puck drop",
      } as unknown as Json,
    },
  };
}

export function buildHistoricalMarketOddsImportRejectedProvenanceRows(
  inputs: HistoricalMarketOddsRejectedProvenanceInput[],
): SourceProvenanceInsert[] {
  const updatedAt = new Date().toISOString();

  return inputs.map(({ row, importedAt, importBatchId, game, rejectionReason }) => {
    const observedAt =
      Number.isFinite(Date.parse(row.capturedAt)) ? row.capturedAt : importedAt;
    return {
      snapshot_date: game.date,
      source_type: "game_prediction_market_odds",
      entity_type: "game",
      entity_id: game.id,
      game_id: game.id,
      source_name: HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME,
      source_url: row.sourceUrl || null,
      source_rank: 1,
      is_official: false,
      status: "rejected",
      observed_at: observedAt,
      freshness_expires_at: earliestIso(
        addHoursIso(observedAt, 24),
        game.startTime,
      ),
      payload: {
        provider: row.provider,
        requestedDate: row.requestedDate ?? game.date,
        homeMoneyline: row.homeMoneyline,
        awayMoneyline: row.awayMoneyline,
      } as unknown as Json,
      metadata: {
        rejectionReason,
        importedAt,
        importBatchId,
        attemptedCapturedAt: row.capturedAt,
        canonicalObservedSourceName: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
        eventStartAt: game.startTime,
        guardrail:
          "not eligible for model features; imported historical market odds row failed pre-cutoff validation",
      } as unknown as Json,
      updated_at: updatedAt,
    };
  });
}

async function upsertMarketOddsSourceProvenanceRows(args: {
  client: SupabaseClient<Database>;
  rows: SourceProvenanceInsert[];
}): Promise<number> {
  if (args.rows.length === 0) return 0;
  const { error } = await args.client
    .from("source_provenance_snapshots" as any)
    .upsert(args.rows as any, {
      onConflict:
        "snapshot_date,source_type,entity_type,entity_id,source_name,game_id",
    });
  if (error) throw error;
  return args.rows.length;
}

function incrementRejectionReason(
  reasons: Record<string, number>,
  reason: string,
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function normalizeHistoricalMarketOddsImportBatchId(
  importedAt: string,
  importBatchId?: string,
): string {
  const trimmed = importBatchId?.trim();
  if (trimmed) return trimmed;
  return `historical_market_odds_import_${importedAt.replace(
    /[^0-9A-Za-z]/g,
    "",
  )}`;
}

export async function importHistoricalMarketOddsSnapshots(args: {
  client: SupabaseClient<Database>;
  rows: HistoricalMarketOddsImportRow[];
  importedAt?: string;
  importBatchId?: string;
  dryRun?: boolean;
}): Promise<HistoricalMarketOddsImportResult> {
  const importedAt = args.importedAt ?? new Date().toISOString();
  const importBatchId = normalizeHistoricalMarketOddsImportBatchId(
    importedAt,
    args.importBatchId,
  );
  const rows = args.rows.slice(0, 500);
  const gameIds = Array.from(
    new Set(
      rows
        .map((row) => row.gameId)
        .filter((gameId) => Number.isInteger(gameId) && gameId > 0),
    ),
  );
  const rejectionReasons: Record<string, number> = {};

  const { data: games, error: gamesError } = gameIds.length
    ? await args.client
        .from("games")
        .select("id,date,startTime,homeTeamId,awayTeamId")
        .in("id", gameIds)
    : { data: [], error: null };
  if (gamesError) throw gamesError;

  const gamesById = new Map(
    ((games ?? []) as GameRow[]).map((game) => [game.id, game]),
  );
  const teamIds = Array.from(
    new Set(
      ((games ?? []) as GameRow[]).flatMap((game) => [
        game.homeTeamId,
        game.awayTeamId,
      ]),
    ),
  );
  const { data: teams, error: teamsError } = teamIds.length
    ? await args.client
        .from("teams")
        .select("id,abbreviation")
        .in("id", teamIds)
    : { data: [], error: null };
  if (teamsError) throw teamsError;

  const teamsById = new Map(
    ((teams ?? []) as TeamRow[]).map((team) => [team.id, team]),
  );

  let missingGameRows = 0;
  let invalidRows = 0;
  let postStartRejectedRows = 0;
  const inserts: MarketOddsSnapshotInsert[] = [];
  const rejectedInputs: HistoricalMarketOddsRejectedProvenanceInput[] = [];

  for (const row of rows) {
    const game = gamesById.get(row.gameId);
    if (!game) {
      missingGameRows += 1;
      incrementRejectionReason(rejectionReasons, "missing_game");
      continue;
    }
    const homeTeam = teamsById.get(game.homeTeamId);
    const awayTeam = teamsById.get(game.awayTeamId);
    if (!homeTeam || !awayTeam) {
      invalidRows += 1;
      incrementRejectionReason(rejectionReasons, "missing_team");
      rejectedInputs.push({
        row,
        importedAt,
        importBatchId,
        game,
        rejectionReason: "missing_team",
      });
      continue;
    }

    const built = buildHistoricalMarketOddsImportInsert({
      row,
      importedAt,
      importBatchId,
      game,
      homeTeam,
      awayTeam,
    });
    if ("insert" in built) {
      inserts.push(built.insert);
      continue;
    }

    invalidRows += 1;
    if (built.rejectionReason === "post_start_capture") {
      postStartRejectedRows += 1;
    }
    incrementRejectionReason(rejectionReasons, built.rejectionReason);
    rejectedInputs.push({
      row,
      importedAt,
      importBatchId,
      game,
      rejectionReason: built.rejectionReason,
    });
  }

  let provenanceRows = 0;
  let rejectedProvenanceRows = 0;
  if (!args.dryRun) {
    if (inserts.length > 0) {
      const { error } = await args.client
        .from("game_prediction_market_odds_snapshots")
        .insert(inserts);
      if (error) throw error;
    }
    const observedRows = buildMarketOddsSourceProvenanceRows(inserts, {
      sourceName: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
    });
    const rejectedRows =
      buildHistoricalMarketOddsImportRejectedProvenanceRows(rejectedInputs);
    provenanceRows = await upsertMarketOddsSourceProvenanceRows({
      client: args.client,
      rows: [...observedRows, ...rejectedRows],
    });
    rejectedProvenanceRows = rejectedRows.length;
  }

  const importedSnapshots = args.dryRun ? 0 : inserts.length;
  return {
    importedAt,
    importBatchId,
    requestedRows: rows.length,
    candidateSnapshots: inserts.length,
    importedSnapshots,
    rowsInserted: importedSnapshots,
    skippedSnapshots: rows.length - inserts.length,
    missingGameRows,
    invalidRows,
    postStartRejectedRows,
    provenanceRows,
    rejectedProvenanceRows,
    dryRun: Boolean(args.dryRun),
    rejectionReasons,
  };
}

export async function ingestEspnNhlOddsSnapshots(args: {
  client: SupabaseClient<Database>;
  dates: string[];
  capturedAt?: string;
  now?: Date;
  dryRun?: boolean;
}): Promise<EspnOddsIngestionResult> {
  const requestedDates = Array.from(new Set(args.dates)).slice(0, 14);
  const { capturedAt, captureRecordedAt, captureClockSkewMs } =
    resolveMarketOddsCaptureTimestamps({
      capturedAt: args.capturedAt,
      now: args.now,
    });
  const odds = await fetchEspnNhlOdds(requestedDates);
  const abbreviations = Array.from(
    new Set(odds.flatMap((game) => [game.homeTeam, game.awayTeam])),
  );

  const { data: teams, error: teamsError } = abbreviations.length
    ? await args.client
        .from("teams")
        .select("id,abbreviation")
        .in("abbreviation", abbreviations)
    : { data: [], error: null };
  if (teamsError) throw teamsError;

  const teamsByAbbreviation = new Map(
    ((teams ?? []) as TeamRow[]).map((team) => [team.abbreviation, team]),
  );
  const localDates = Array.from(
    new Set(odds.map((game) => game.localDate ?? game.requestedDate)),
  );
  const { data: games, error: gamesError } = localDates.length
    ? await args.client
        .from("games")
        .select("id,date,startTime,homeTeamId,awayTeamId")
        .in("date", localDates)
    : { data: [], error: null };
  if (gamesError) throw gamesError;

  const gamesByKey = new Map(
    ((games ?? []) as GameRow[]).map((game) => [
      gameKey(game.date, game.awayTeamId, game.homeTeamId),
      game,
    ]),
  );

  let skippedSnapshots = 0;
  let postStartSkippedSnapshots = 0;
  let missingMoneylineSnapshots = 0;
  let unmappedGames = 0;
  const rejectedProvenanceInputs: RejectedMarketOddsProvenanceInput[] = [];
  const inserts = odds.flatMap((game) => {
    const homeTeam = teamsByAbbreviation.get(game.homeTeam);
    const awayTeam = teamsByAbbreviation.get(game.awayTeam);
    if (!homeTeam || !awayTeam) {
      unmappedGames += 1;
      return [];
    }
    const matchedGame = gamesByKey.get(
      gameKey(game.localDate ?? game.requestedDate, awayTeam.id, homeTeam.id),
    );
    if (!matchedGame) {
      unmappedGames += 1;
      return [];
    }
    if (
      matchedGame.startTime &&
      Date.parse(capturedAt) >= Date.parse(matchedGame.startTime)
    ) {
      skippedSnapshots += 1;
      postStartSkippedSnapshots += 1;
      rejectedProvenanceInputs.push({
        odds: game,
        capturedAt,
        captureRecordedAt,
        game: matchedGame,
        rejectionReason: "post_start_capture",
      });
      return [];
    }
    const insert = buildEspnMarketOddsSnapshotInsert({
      odds: game,
      capturedAt,
      captureRecordedAt,
      game: matchedGame,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    });
    if (!insert) {
      skippedSnapshots += 1;
      missingMoneylineSnapshots += 1;
      rejectedProvenanceInputs.push({
        odds: game,
        capturedAt,
        captureRecordedAt,
        game: matchedGame,
        rejectionReason: "missing_moneyline",
      });
      return [];
    }
    return [insert];
  });

  let provenanceRows = 0;
  let rejectedProvenanceRows = 0;
  if (!args.dryRun) {
    if (inserts.length > 0) {
      const { error } = await args.client
        .from("game_prediction_market_odds_snapshots")
        .insert(inserts);
      if (error) throw error;
    }
    const observedRows = buildMarketOddsSourceProvenanceRows(inserts);
    const rejectedRows = buildRejectedMarketOddsSourceProvenanceRows(
      rejectedProvenanceInputs,
    );
    provenanceRows = await upsertMarketOddsSourceProvenanceRows({
      client: args.client,
      rows: [...observedRows, ...rejectedRows],
    });
    rejectedProvenanceRows = rejectedRows.length;
  }

  return {
    requestedDates,
    capturedAt,
    captureRecordedAt,
    captureClockSkewMs,
    fetchedGames: odds.length,
    insertedSnapshots: args.dryRun ? 0 : inserts.length,
    skippedSnapshots,
    postStartSkippedSnapshots,
    missingMoneylineSnapshots,
    unmappedGames,
    provenanceRows,
    rejectedProvenanceRows,
    dryRun: Boolean(args.dryRun),
  };
}

export async function ingestEspnNhlOddsSnapshotsForWindow(args: {
  client: SupabaseClient<Database>;
  dateBatches: string[][];
  capturedAt?: string;
  now?: Date;
  dryRun?: boolean;
}): Promise<EspnOddsWindowIngestionResult> {
  const { capturedAt, captureRecordedAt, captureClockSkewMs } =
    resolveMarketOddsCaptureTimestamps({
      capturedAt: args.capturedAt,
      now: args.now,
    });
  const batches: EspnOddsIngestionResult[] = [];

  for (const dates of args.dateBatches) {
    if (dates.length === 0) continue;
    batches.push(
      await ingestEspnNhlOddsSnapshots({
        client: args.client,
        dates,
        capturedAt,
        now: new Date(captureRecordedAt),
        dryRun: args.dryRun,
      }),
    );
  }

  return {
    requestedDates: batches.flatMap((batch) => batch.requestedDates),
    capturedAt,
    captureRecordedAt,
    captureClockSkewMs,
    fetchedGames: batches.reduce((sum, batch) => sum + batch.fetchedGames, 0),
    insertedSnapshots: batches.reduce(
      (sum, batch) => sum + batch.insertedSnapshots,
      0,
    ),
    skippedSnapshots: batches.reduce(
      (sum, batch) => sum + batch.skippedSnapshots,
      0,
    ),
    postStartSkippedSnapshots: batches.reduce(
      (sum, batch) => sum + batch.postStartSkippedSnapshots,
      0,
    ),
    missingMoneylineSnapshots: batches.reduce(
      (sum, batch) => sum + batch.missingMoneylineSnapshots,
      0,
    ),
    unmappedGames: batches.reduce(
      (sum, batch) => sum + batch.unmappedGames,
      0,
    ),
    provenanceRows: batches.reduce(
      (sum, batch) => sum + batch.provenanceRows,
      0,
    ),
    rejectedProvenanceRows: batches.reduce(
      (sum, batch) => sum + batch.rejectedProvenanceRows,
      0,
    ),
    dryRun: Boolean(args.dryRun),
    batchCount: batches.length,
    batches,
  };
}

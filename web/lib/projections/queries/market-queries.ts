import supabase from "lib/supabase/server";

export type MarketPriceContextRow = {
  snapshot_date: string;
  game_id: number;
  market_type: string;
  sportsbook_key: string;
  outcome_key: string;
  line_value: number | null;
  price_american: number | null;
  implied_probability: number | null;
  source_rank: number | null;
  source_observed_at: string | null;
  freshness_expires_at: string | null;
  provenance: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type PropMarketPriceContextRow = MarketPriceContextRow & {
  player_id: number;
};

export type MarketOutcomeSummary = {
  outcomeKey: string;
  /**
   * The line when every book quotes this outcome at the same line; null when
   * books differ. Lines are never averaged across books (decision 30): use
   * MarketTypeSummary.quotes for per-book comparison.
   */
  averageLineValue: number | null;
  averagePriceAmerican: number | null;
  averageImpliedProbability: number | null;
  sportsbookCount: number;
};

export type MarketTypeSummary = {
  marketType: string;
  sourceRank: number;
  sourceNames: string[];
  sportsbookKeys: string[];
  observedAt: string | null;
  freshnessExpiresAt: string | null;
  outcomes: MarketOutcomeSummary[];
  /**
   * One quote per book, outcome and line (the latest observation), from the same
   * fresh best-rank rows as the outcomes. Comparisons use these, never the
   * cross-book outcome averages. Optional only for hand-built summaries.
   */
  quotes?: MarketSummaryQuote[];
};

export type MarketSummaryQuote = {
  sportsbook_key: string;
  outcome_key: string;
  line_value: number | null;
  price_american: number | null;
  /** The quote's own observation and expiry (ISO), so consumers can pair one book's sides from one observation. */
  source_observed_at?: string | null;
  freshness_expires_at?: string | null;
};

function toIsoTimestamp(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

/** Observed at or before now and not yet expired; rows missing either timestamp are never fresh. */
function isFreshAt(row: {
  freshness_expires_at: string | null;
  source_observed_at: string | null;
}, nowIso: string): boolean {
  const now = toIsoTimestamp(nowIso);
  const observedAt = toIsoTimestamp(row.source_observed_at);
  const freshnessExpiresAt = toIsoTimestamp(row.freshness_expires_at);
  if (!now || !observedAt || !freshnessExpiresAt) return false;
  return observedAt <= now && freshnessExpiresAt >= now;
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (finiteValues.length === 0) return null;
  const avg = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  return Number(avg.toFixed(4));
}

/** The shared line when all finite lines agree; null when none or when books differ. */
function commonLineValue(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (finiteValues.length === 0) return null;
  return finiteValues.every((value) => value === finiteValues[0]) ? finiteValues[0] : null;
}

/** Latest observation per book, outcome and line; ties keep the higher price so input order never matters. */
function perBookQuotes<T extends MarketPriceContextRow>(rows: T[]): MarketSummaryQuote[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.sportsbook_key}|${row.outcome_key}|${row.line_value ?? ""}`;
    const current = latest.get(key);
    const rowAt = toIsoTimestamp(row.source_observed_at) ?? "";
    const currentAt = current ? toIsoTimestamp(current.source_observed_at) ?? "" : null;
    if (
      currentAt == null ||
      rowAt > currentAt ||
      (rowAt === currentAt && (row.price_american ?? -Infinity) > (current?.price_american ?? -Infinity))
    ) {
      latest.set(key, row);
    }
  }
  return Array.from(latest.values())
    .map((row) => ({
      sportsbook_key: row.sportsbook_key,
      outcome_key: row.outcome_key,
      line_value: row.line_value,
      price_american: row.price_american,
      source_observed_at: toIsoTimestamp(row.source_observed_at),
      freshness_expires_at: toIsoTimestamp(row.freshness_expires_at)
    }))
    .sort(
      (a, b) =>
        a.sportsbook_key.localeCompare(b.sportsbook_key) ||
        a.outcome_key.localeCompare(b.outcome_key) ||
        (a.line_value ?? -Infinity) - (b.line_value ?? -Infinity)
    );
}

function summarizeRowsByMarketType<T extends MarketPriceContextRow>(
  rows: T[],
  nowIso: string
): Record<string, MarketTypeSummary> {
  // Stale or untimestamped rows are dropped, never used as a fallback (Astra AF-04).
  const activeRows = rows.filter((row) => isFreshAt(row, nowIso));
  if (activeRows.length === 0) return {};

  const bestSourceRank = activeRows.reduce((best, row) => {
    const sourceRank = Number.isFinite(row.source_rank) ? Number(row.source_rank) : Number.MAX_SAFE_INTEGER;
    return Math.min(best, sourceRank);
  }, Number.MAX_SAFE_INTEGER);

  const rankedRows = activeRows.filter((row) => {
    const sourceRank = Number.isFinite(row.source_rank) ? Number(row.source_rank) : Number.MAX_SAFE_INTEGER;
    return sourceRank === bestSourceRank;
  });

  const rowsByMarketType = new Map<string, T[]>();
  for (const row of rankedRows) {
    if (!rowsByMarketType.has(row.market_type)) {
      rowsByMarketType.set(row.market_type, []);
    }
    rowsByMarketType.get(row.market_type)?.push(row);
  }

  const summaries: Record<string, MarketTypeSummary> = {};
  for (const [marketType, marketRows] of rowsByMarketType.entries()) {
    const outcomeGroups = new Map<string, T[]>();
    for (const row of marketRows) {
      if (!outcomeGroups.has(row.outcome_key)) {
        outcomeGroups.set(row.outcome_key, []);
      }
      outcomeGroups.get(row.outcome_key)?.push(row);
    }

    const observedAtValues = marketRows
      .map((row) => toIsoTimestamp(row.source_observed_at))
      .filter((value): value is string => value != null)
      .sort();
    const freshnessValues = marketRows
      .map((row) => toIsoTimestamp(row.freshness_expires_at))
      .filter((value): value is string => value != null)
      .sort();
    const sourceNames = Array.from(
      new Set(
        marketRows
          .map((row) => {
            const provider = row.provenance?.provider;
            return typeof provider === "string" ? provider : null;
          })
          .filter((value): value is string => value != null)
      )
    ).sort();

    summaries[marketType] = {
      marketType,
      sourceRank: bestSourceRank,
      sourceNames,
      sportsbookKeys: Array.from(new Set(marketRows.map((row) => row.sportsbook_key))).sort(),
      observedAt: observedAtValues.at(-1) ?? null,
      freshnessExpiresAt: freshnessValues.at(-1) ?? null,
      outcomes: Array.from(outcomeGroups.entries())
        .map(([outcomeKey, outcomeRows]) => ({
          outcomeKey,
          averageLineValue: commonLineValue(outcomeRows.map((row) => row.line_value)),
          averagePriceAmerican: averageNullable(
            outcomeRows.map((row) => row.price_american)
          ),
          averageImpliedProbability: averageNullable(
            outcomeRows.map((row) => row.implied_probability)
          ),
          sportsbookCount: outcomeRows.length
        }))
        .sort((a, b) => a.outcomeKey.localeCompare(b.outcomeKey)),
      quotes: perBookQuotes(marketRows)
    };
  }

  return summaries;
}

export function summarizeGameMarketRows(
  rows: MarketPriceContextRow[],
  nowIso = new Date().toISOString()
): Record<string, MarketTypeSummary> {
  return summarizeRowsByMarketType(rows, nowIso);
}

export function summarizePropMarketRows(
  rows: PropMarketPriceContextRow[],
  nowIso = new Date().toISOString()
): Record<string, MarketTypeSummary> {
  return summarizeRowsByMarketType(rows, nowIso);
}

export async function fetchGameMarketContextByGameIds(args: {
  snapshotDate: string;
  gameIds: number[];
  decisionAsOf?: string;
}): Promise<Map<number, Record<string, MarketTypeSummary>>> {
  if (args.gameIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("market_prices_daily" as any)
    .select(
      "snapshot_date,game_id,market_type,sportsbook_key,outcome_key,line_value,price_american,implied_probability,source_rank,source_observed_at,freshness_expires_at,provenance,metadata"
    )
    .eq("snapshot_date", args.snapshotDate)
    .in("game_id", args.gameIds);
  if (error) throw error;

  const rowsByGameId = new Map<number, MarketPriceContextRow[]>();
  for (const row of (data ?? []) as unknown as MarketPriceContextRow[]) {
    if (!rowsByGameId.has(row.game_id)) rowsByGameId.set(row.game_id, []);
    rowsByGameId.get(row.game_id)?.push(row);
  }

  const result = new Map<number, Record<string, MarketTypeSummary>>();
  for (const [gameId, rows] of rowsByGameId.entries()) {
    result.set(gameId, summarizeGameMarketRows(rows.filter((row) => !args.decisionAsOf || !row.source_observed_at || row.source_observed_at <= args.decisionAsOf), args.decisionAsOf));
  }
  return result;
}

export async function fetchPlayerPropContextByGameIds(args: {
  snapshotDate: string;
  gameIds: number[];
  decisionAsOf?: string;
}): Promise<Map<string, Record<string, MarketTypeSummary>>> {
  if (args.gameIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("prop_market_prices_daily" as any)
    .select(
      "snapshot_date,game_id,player_id,market_type,sportsbook_key,outcome_key,line_value,price_american,implied_probability,source_rank,source_observed_at,freshness_expires_at,provenance,metadata"
    )
    .eq("snapshot_date", args.snapshotDate)
    .in("game_id", args.gameIds);
  if (error) throw error;

  const rowsByKey = new Map<string, PropMarketPriceContextRow[]>();
  for (const row of (data ?? []) as unknown as PropMarketPriceContextRow[]) {
    const key = `${row.game_id}:${row.player_id}`;
    if (!rowsByKey.has(key)) rowsByKey.set(key, []);
    rowsByKey.get(key)?.push(row);
  }

  const result = new Map<string, Record<string, MarketTypeSummary>>();
  for (const [key, rows] of rowsByKey.entries()) {
    result.set(key, summarizePropMarketRows(rows.filter((row) => !args.decisionAsOf || !row.source_observed_at || row.source_observed_at <= args.decisionAsOf), args.decisionAsOf));
  }
  return result;
}

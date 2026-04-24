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
};

function toIsoTimestamp(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function isFreshAt(row: {
  freshness_expires_at: string | null;
  source_observed_at: string | null;
}, nowIso: string): boolean {
  const freshnessExpiresAt = toIsoTimestamp(row.freshness_expires_at);
  if (freshnessExpiresAt) return freshnessExpiresAt >= nowIso;
  return toIsoTimestamp(row.source_observed_at) != null;
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (finiteValues.length === 0) return null;
  const avg = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  return Number(avg.toFixed(4));
}

function summarizeRowsByMarketType<T extends MarketPriceContextRow>(
  rows: T[],
  nowIso: string
): Record<string, MarketTypeSummary> {
  const freshRows = rows.filter((row) => isFreshAt(row, nowIso));
  const activeRows = freshRows.length > 0 ? freshRows : rows;
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
          averageLineValue: averageNullable(outcomeRows.map((row) => row.line_value)),
          averagePriceAmerican: averageNullable(
            outcomeRows.map((row) => row.price_american)
          ),
          averageImpliedProbability: averageNullable(
            outcomeRows.map((row) => row.implied_probability)
          ),
          sportsbookCount: outcomeRows.length
        }))
        .sort((a, b) => a.outcomeKey.localeCompare(b.outcomeKey))
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
    result.set(gameId, summarizeGameMarketRows(rows));
  }
  return result;
}

export async function fetchPlayerPropContextByGameIds(args: {
  snapshotDate: string;
  gameIds: number[];
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
    result.set(key, summarizePropMarketRows(rows));
  }
  return result;
}

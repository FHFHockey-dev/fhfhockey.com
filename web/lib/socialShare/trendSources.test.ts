import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/public-client", () => ({ default: { from: () => { throw new Error("The Tuesday loader test must never reach Supabase."); } } }));
import { fictionalTrendSources } from "./trendsFixture";
import { buildTrendLayer, type ShareTrendSources } from "./trends";
import { loadTrendLayer, sparklineReadsEnabled, TREND_LIMITS, type TrendReadClient } from "./trendSources";

const now = "2026-10-27T13:00:00Z", season = 20262027, context = { season, fetchedAt: now, generatedAt: now };
type Row = Record<string, unknown>;
type Statement = { table: string; columns: string; count: boolean; filters: string[]; order: string[]; range: [number, number] | null; limit: number | null };

/** In-memory PostgREST stand-in over fixture rows; records every statement the loader issues. */
function fakeClient(tables: Record<string, Row[]>, faults: { table?: string; error?: unknown; countDrift?: string } = {}) {
  const statements: Statement[] = [], flight = { now: 0, max: 0 };
  const client: TrendReadClient = { from(table: string) {
    const statement: Statement = { table, columns: "", count: false, filters: [], order: [], range: null, limit: null };
    const predicates: ((row: Row) => boolean)[] = [], orders: [string, boolean][] = [];
    const builder = {
      select(columns: string, options?: { count?: string }) { statement.columns = columns; statement.count = options?.count === "exact"; return builder; },
      eq(column: string, value: unknown) { statement.filters.push(`${column}=eq.${value}`); predicates.push(row => row[column] === value); return builder; },
      in(column: string, values: unknown[]) { statement.filters.push(`${column}=in.(${values.length})`); predicates.push(row => values.includes(row[column])); return builder; },
      gte(column: string, value: string) { statement.filters.push(`${column}=gte.${value}`); predicates.push(row => String(row[column]) >= value); return builder; },
      lte(column: string, value: string) { statement.filters.push(`${column}=lte.${value}`); predicates.push(row => String(row[column]) <= value); return builder; },
      order(column: string, options: { ascending: boolean }) { statement.order.push(`${column}.${options.ascending ? "asc" : "desc"}`); orders.push([column, options.ascending]); return builder; },
      limit(n: number) { statement.limit = n; return builder; },
      range(from: number, to: number) { statement.range = [from, to]; return builder; },
      then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
        statements.push(statement);
        // Each statement stays in flight for a macrotask, so overlapping statements are counted.
        flight.now++; flight.max = Math.max(flight.max, flight.now);
        const settle = <T,>(value: T) => new Promise<T>(done => setTimeout(() => { flight.now--; done(value); }, 0));
        return answer().then(settle).then(resolve, reject);
      },
    };
    const answer = () => {
        if (faults.table === table && faults.error) return Promise.resolve({ data: null, error: faults.error, count: null });
        const rows = (tables[table] ?? []).filter(row => predicates.every(test => test(row))).sort((a, b) => {
          for (const [column, ascending] of orders) { const x = a[column] as string | number, y = b[column] as string | number; if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1); }
          return 0;
        });
        const picked = statement.range ? rows.slice(statement.range[0], statement.range[1] + 1) : statement.limit ? rows.slice(0, statement.limit) : rows;
        const columns = statement.columns.split(","), data = picked.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
        const drift = faults.countDrift === table && statement.range && statement.range[0] > 0 ? 1 : 0;
        return Promise.resolve({ data, error: null, count: statement.count ? rows.length + drift : null });
    };
    return builder;
  } };
  return { client, statements, flight };
}
function tablesOf(sources: ShareTrendSources): Record<string, Row[]> {
  const rows = <T,>(read: { rows: T[] } | { failed: string }) => ("rows" in read ? read.rows : []) as Row[];
  return { rolling_player_game_metrics: [...rows(sources.rolling), ...rows(sources.ev)], powerPlayCombinations: rows(sources.ppc), yahoo_player_ownership_history: rows(sources.ownership),
    yahoo_nhl_player_map_read: rows(sources.map), players: rows(sources.players) };
}

afterEach(() => vi.restoreAllMocks());

describe("Tuesday live loader", () => {
  it("returns the same layer as the full fixture with bounded, exact-count, explicit-column reads", async () => {
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z"), { client, statements, flight } = fakeClient(tablesOf(sources));
    const layer = await loadTrendLayer(context, client, { sparklines: true });
    expect(layer).toEqual(buildTrendLayer(sources, context));
    expect(Object.values(layer.sections).every(section => section.state === "ready")).toBe(true);
    expect(new Set(statements.map(statement => statement.table))).toEqual(new Set(["rolling_player_game_metrics", "yahoo_player_ownership_history", "powerPlayCombinations", "yahoo_nhl_player_map_read", "players"]));
    for (const statement of statements) {
      expect(statement.columns).not.toMatch(/\*|PROJECTIONS|goalie_start/);
      // The two date probes read one ownership_date each (the first over the whole table, by the date index).
      if (statement.limit === 1) { expect(statement.columns).toBe("ownership_date"); continue; }
      expect(statement.filters.length).toBeGreaterThan(0);
      expect(statement.count).toBe(true);
      expect(statement.range![1] - statement.range![0]).toBeLessThan(1000);
    }
    const tally = (table: string) => statements.filter(statement => statement.table === table).length;
    // Rolling: strength-all window (pages of 1,000) plus one EV chunk for the shown deployment players.
    expect(statements.filter(statement => statement.table === "rolling_player_game_metrics" && statement.filters.includes("strength_state=eq.ev"))).toHaveLength(1);
    // Two date probes, the two-date read, and the movers' sparkline read (M2).
    expect(tally("yahoo_player_ownership_history")).toBe(2 + 1 + 1);
    // Sparkline game rows (S1): the listed skaters only, chunked by 20, 35 days.
    const s1 = statements.filter(statement => statement.table === "rolling_player_game_metrics" && statement.columns.includes("sog_per_60_shots_season"));
    expect(s1.length).toBeGreaterThanOrEqual(1); expect(s1.length).toBeLessThanOrEqual(2);
    for (const statement of s1) expect(statement.filters).toEqual(expect.arrayContaining(["strength_state=eq.all", "game_date=gte.2026-09-22"]));
    const listed = [...layer.sections.hot.hot, ...layer.sections.deployment.up, ...layer.sections.rates.sogPer60, ...layer.sections.movers.risers];
    expect(listed.filter(row => row.series?.length).length).toBeGreaterThan(listed.length / 2);
    expect(tally("players")).toBe(1);
    expect(tally("yahoo_nhl_player_map_read")).toBe(1);
    expect(tally("powerPlayCombinations")).toBeLessThanOrEqual(Math.ceil(32 * 4 / TREND_LIMITS.ppcGamesPerChunk));
    // TJ's approved ceiling (READ-APPROVAL.md): ≤ 40 statements, ≤ 1,000 rows each, concurrency 2.
    expect(statements.length).toBeLessThanOrEqual(16);
    expect(flight.max).toBe(TREND_LIMITS.concurrency);
  });

  it("sparkline reads are on by default; SOCIAL_SHARE_TUESDAY_SPARKLINES=0 turns them off with no S1/M2 statement (TT-6)", async () => {
    expect(sparklineReadsEnabled({})).toBe(true);
    expect(sparklineReadsEnabled({ SOCIAL_SHARE_TUESDAY_SPARKLINES: "1" })).toBe(true);
    expect(sparklineReadsEnabled({ SOCIAL_SHARE_TUESDAY_SPARKLINES: "0" })).toBe(false);
    // The loader itself reads S1/M2 only when the server passes sparklines: true (the kill-switch path below).
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z"), { client, statements } = fakeClient(tablesOf(sources));
    const layer = await loadTrendLayer(context, client);
    expect(statements.filter(statement => statement.columns.includes("sog_per_60_shots_season") || statement.filters.some(filter => filter.startsWith("player_key=")))).toEqual([]);
    expect(statements.length).toBeLessThanOrEqual(12);
    const listed = [...layer.sections.hot.hot, ...layer.sections.deployment.up, ...layer.sections.rates.sogPer60, ...layer.sections.movers.risers];
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every(row => row.series == null)).toBe(true);
    expect(layer).toEqual(buildTrendLayer({ ...sources, series: undefined, ownershipSeries: undefined }, context));
  });

  it("a failed source makes only its sections unavailable, with the reason and no fixture values", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z");
    const { client } = fakeClient(tablesOf(sources), { table: "powerPlayCombinations", error: { code: "57014", message: "canceling statement due to statement timeout" } });
    const layer = await loadTrendLayer(context, client);
    expect(layer.sections.deployment).toEqual({ state: "missing", reasons: ["Power-play combinations unavailable: Power-play combinations read failed (57014 canceling statement due to statement timeout)"], up: [], down: [] });
    expect([layer.sections.hot.state, layer.sections.rates.state, layer.sections.movers.state]).toEqual(["ready", "ready", "ready"]);
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/Fixture|848\d{4}/);
  });

  it("fails closed when a source exceeds its ceiling or its count changes between pages", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z"), rows = tablesOf(sources);
    const many = { ...rows, rolling_player_game_metrics: [...rows.rolling_player_game_metrics, ...Array.from({ length: TREND_LIMITS.rolling }, (_, i) => ({ ...rows.rolling_player_game_metrics.find(row => row.strength_state === "all" && row.game_date === "2026-10-26")!, player_id: 9000000 + i }))] };
    const over = await loadTrendLayer(context, fakeClient(many).client);
    expect(over.sections.hot).toMatchObject({ state: "missing", hot: [], cold: [] });
    expect(over.sections.hot.reasons[0]).toMatch(/over its 5000-row limit/);
    const drift = await loadTrendLayer(context, fakeClient(rows, { countDrift: "rolling_player_game_metrics" }).client);
    expect(drift.sections.rates.reasons[0]).toMatch(/completeness changed/);
    expect(drift.sections.movers.state).toBe("missing");
  });
});

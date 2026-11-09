import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("pages/api/v1/db/tweet-pattern-review", () => ({ syncTweetPatternReviewItems: vi.fn() }));

import { persistAutomatedNewsItem } from "pages/api/v1/db/auto-news-feed-items";

type Row = Record<string, any>;

/** A small in-memory news_feed_items / news_feed_item_players store that enforces the unique original_tweet_id. */
function fakeDb(items: Row[], players: Row[] = []) {
  const writes: string[] = [];
  const tables: Record<string, Row[]> = { news_feed_items: items, news_feed_item_players: players };
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let op: { kind: "select" | "update" | "insert" | "delete"; payload?: Row | Row[] } = { kind: "select" };
    const rows = () => tables[table]!.filter((row) => filters.every((filter) => filter(row)));
    const conflict = (row: Row, self?: Row) => table === "news_feed_items" && row.original_tweet_id != null
      && tables[table]!.some((other) => other !== self && other.original_tweet_id === row.original_tweet_id);
    const run = () => {
      if (op.kind === "update") {
        writes.push(`${table}.update`);
        for (const row of rows()) {
          if (conflict({ ...row, ...(op.payload as Row) }, row)) return { data: null, error: { code: "23505" } };
          Object.assign(row, op.payload);
        }
        return { data: null, error: null };
      }
      if (op.kind === "insert") {
        writes.push(`${table}.insert`);
        const inserted = (Array.isArray(op.payload) ? op.payload : [op.payload!]).map((row) => ({ id: `new-${tables[table]!.length}`, ...row }));
        if (inserted.some((row) => conflict(row))) return { data: null, error: { code: "23505" } };
        tables[table]!.push(...inserted);
        return { data: inserted, error: null };
      }
      if (op.kind === "delete") {
        writes.push(`${table}.delete`);
        tables[table] = tables[table]!.filter((row) => !filters.every((filter) => filter(row)));
        return { data: null, error: null };
      }
      return { data: rows(), error: null };
    };
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
      in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; },
      update: (payload: Row) => { op = { kind: "update", payload }; return builder; },
      insert: (payload: Row | Row[]) => { op = { kind: "insert", payload }; return builder; },
      delete: () => { op = { kind: "delete" }; return builder; },
      maybeSingle: async () => { const result = run(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
      single: async () => { const result = run(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return builder;
  };
  return { db: { from }, writes, tables };
}

const ORIGINAL = "2119866822602494164";
const metadata = (generatedAt: string) => ({ automation: { source: "tweet_news_phrase_dictionary", generatedAt, confidence: 0.9 } });
const candidate = (overrides: Row = {}) => ({
  reviewItemId: "review-relay",
  sourceTweetId: "dfo-1",
  sourceUrl: `https://x.com/AGrossNewsday/status/${ORIGINAL}`,
  tweetUrl: `https://x.com/AGrossNewsday/status/${ORIGINAL}`,
  sourceLabel: "DFO",
  sourceAccount: "DFOFantasy",
  teamId: 12,
  teamAbbreviation: "NYI",
  headline: "Ilya Sorokin dictionary review",
  blurb: "Sorokin expected to start.",
  category: "OTHER",
  subcategory: "AMBIGUOUS",
  cardStatus: "draft",
  observedAt: "2026-11-09T19:00:00.000Z",
  publishedAt: null,
  metadata: metadata("2026-11-09T20:00:11.000Z"),
  playerAssignments: [{ playerId: 8478009, playerName: "Ilya Sorokin", teamId: 12 }],
  ...overrides,
}) as any;
const storedCard = (overrides: Row = {}): Row => ({
  id: "card-relay",
  source_review_item_id: "review-relay",
  original_tweet_id: null,
  source_tweet_id: "dfo-1",
  source_url: `https://x.com/AGrossNewsday/status/${ORIGINAL}`,
  tweet_url: `https://x.com/AGrossNewsday/status/${ORIGINAL}`,
  source_label: "DFO",
  source_account: "DFOFantasy",
  team_id: 12,
  team_abbreviation: "NYI",
  headline: "Ilya Sorokin dictionary review",
  blurb: "Sorokin expected to start.",
  category: "OTHER",
  subcategory: "AMBIGUOUS",
  card_status: "draft",
  observed_at: "2026-11-09T19:00:00+00:00",
  published_at: null,
  metadata: metadata("2026-11-09T19:00:11.000Z"),
  ...overrides,
});
const holderCard = (overrides: Row = {}): Row => storedCard({
  id: "card-original", source_review_item_id: "review-original", original_tweet_id: ORIGINAL, source_account: "@AGrossNewsday",
  card_status: "published", headline: "NYI line combination update", ...overrides,
});
const sorokin = { player_id: 8478009, player_name: "Ilya Sorokin", team_id: 12, role: "subject" };
const persist = (db: unknown, existing: Row | null, next = candidate()) =>
  persistAutomatedNewsItem({ supabase: db, existing: existing as any, candidate: next, validTeamIds: new Set([12]), nowIso: "2026-11-09T20:00:11.000Z" });

describe("persistAutomatedNewsItem", () => {
  beforeEach(() => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("leaves a relay's own older card alone when another card holds its original (11-09 duplicate key)", async () => {
    const own = storedCard();
    const { db, writes } = fakeDb([own, holderCard()]);
    await expect(persist(db, { ...own, players: [sorokin] })).resolves.toEqual({ itemId: "card-original", action: "duplicate_original" });
    expect(writes).toEqual([]);
    expect(own.original_tweet_id).toBeNull();
  });

  it("treats a duplicate key on update (another run took the original first) as a duplicate, not a failure", async () => {
    const own = storedCard();
    const { db, tables } = fakeDb([own]);
    const holderAppears = db.from;
    let lookups = 0;
    // The first holder lookup sees nothing; the original is taken before the update lands.
    (db as any).from = (table: string) => {
      const builder = holderAppears(table);
      const maybeSingle = builder.maybeSingle;
      builder.maybeSingle = async () => {
        if (table === "news_feed_items" && lookups++ === 0) {
          const result = await maybeSingle();
          tables.news_feed_items!.push(holderCard());
          return result;
        }
        return maybeSingle();
      };
      return builder;
    };
    await expect(persist(db, { ...own, players: [sorokin] })).resolves.toEqual({ itemId: "card-original", action: "duplicate_original" });
  });

  it("writes nothing when the card and its players are unchanged apart from the run clock", async () => {
    const own = storedCard({ original_tweet_id: ORIGINAL });
    const { db, writes } = fakeDb([own], [{ news_item_id: own.id, ...sorokin }]);
    await expect(persist(db, { ...own, players: [sorokin] })).resolves.toEqual({ itemId: own.id, action: "unchanged" });
    expect(writes).toEqual([]);
  });

  it("updates a changed card without rewriting unchanged players", async () => {
    const own = storedCard({ original_tweet_id: ORIGINAL });
    const { db, writes } = fakeDb([own], [{ news_item_id: own.id, ...sorokin }]);
    await expect(persist(db, { ...own, players: [sorokin] }, candidate({ headline: "Sorokin starts" })))
      .resolves.toMatchObject({ action: "updated" });
    expect(writes).toEqual(["news_feed_items.update"]);
  });

  it("rewrites players only when they changed", async () => {
    const own = storedCard({ original_tweet_id: ORIGINAL });
    const { db, writes, tables } = fakeDb([own], [{ news_item_id: own.id, ...sorokin }]);
    const next = candidate({ playerAssignments: [{ playerId: 8478009, playerName: "Ilya Sorokin", teamId: 12 }, { playerId: 1, playerName: "Semyon Varlamov", teamId: 12 }] });
    await expect(persist(db, { ...own, players: [sorokin] }, next)).resolves.toMatchObject({ action: "updated" });
    expect(writes).toEqual(["news_feed_item_players.delete", "news_feed_item_players.insert"]);
    expect(tables.news_feed_item_players).toHaveLength(2);
  });

  it("does not hand a draft original card to a draft relay, but lets a relay publish it", async () => {
    const draftHolder = holderCard({ card_status: "draft" });
    const draft = fakeDb([draftHolder]);
    await expect(persist(draft.db, null)).resolves.toEqual({ itemId: "card-original", action: "duplicate_original" });
    expect(draft.writes).toEqual([]);

    const published = fakeDb([holderCard({ card_status: "draft" })]);
    await expect(persist(published.db, null, candidate({ cardStatus: "published", publishedAt: "2026-11-09T20:00:11.000Z" })))
      .resolves.toEqual({ itemId: "card-original", action: "updated" });
    expect(published.tables.news_feed_items![0]).toMatchObject({ source_review_item_id: "review-relay", card_status: "published" });
  });
});

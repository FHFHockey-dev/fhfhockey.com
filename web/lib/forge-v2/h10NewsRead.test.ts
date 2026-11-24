import { describe, expect, it } from "vitest";
import { SqlConnection } from "./history.server";
import { H10_NEWS_MAX_PAGES, H10_NEWS_PAGE, H10NewsReadOverflow, readNewsRows } from "./h10NewsRoute.server";

/** A news table of `count` cards, served the way H10_NEWS_SQL pages it: after the (updated_at, id) cursor, in order. */
function table(count: number) {
  const cards = Array.from({ length: count }, (_, i) => ({ id: `card-${String(i).padStart(6, "0")}`, updated_at: new Date(Date.UTC(2026, 10, 20) + Math.floor(i / 3) * 1000).toISOString() }));
  const calls: unknown[][] = [];
  const db = { query: async (_text: string, values: unknown[]) => {
    calls.push(values);
    const [, at, id, limit] = values as [string, string, string, number];
    const rows = cards.filter(c => c.updated_at > at || (c.updated_at === at && c.id > id)).slice(0, limit);
    return { rows };
  } } as unknown as SqlConnection;
  return { db, calls };
}

describe("news read paging", () => {
  it("reads every card across pages, in order, with no duplicate or gap (several cards share a timestamp)", async () => {
    const { db, calls } = table(1234);
    const rows = await readNewsRows(db, "2026-11-19T00:00:00.000Z");
    expect(rows).toHaveLength(1234);
    expect(new Set(rows.map(r => r.id)).size).toBe(1234);
    expect(calls).toHaveLength(Math.ceil(1234 / H10_NEWS_PAGE));
  });
  it("reads exactly the cap without refusing", async () => {
    const { db } = table(H10_NEWS_PAGE * H10_NEWS_MAX_PAGES);
    expect(await readNewsRows(db, "2026-11-19T00:00:00.000Z")).toHaveLength(5000);
  });
  it("refuses one card past the cap and reports where it stopped, never a silent truncation", async () => {
    const { db } = table(H10_NEWS_PAGE * H10_NEWS_MAX_PAGES + 1);
    const error = await readNewsRows(db, "2026-11-19T00:00:00.000Z").catch(e => e);
    expect(error).toBeInstanceOf(H10NewsReadOverflow);
    expect(error).toMatchObject({ message: "h10_news_read_cap_exceeded", since: "2026-11-19T00:00:00.000Z", read: 5000, through: { id: "card-004999" } });
  });
});

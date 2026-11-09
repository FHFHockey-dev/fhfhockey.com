import { describe, expect, it, vi } from "vitest";

// Offset paging over a non-unique ORDER BY lets Postgres break ties differently on each page
// request, repeating some rows and skipping others. This fake client does exactly that: ties
// left by the requested order flip direction on every page request.
const fake = vi.hoisted(() => {
  const state = { rows: [] as Array<Record<string, number>>, calls: 0 };
  function from() {
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
    const builder: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "order")
            return (column: string, options?: { ascending?: boolean }) => (
              orders.push({ column, ascending: options?.ascending !== false }), builder
            );
          if (prop === "range") return (start: number, end: number) => ((range = [start, end]), builder);
          if (prop === "then")
            return (resolve: (value: unknown) => unknown) => {
              const flip = state.calls++ % 2 === 0 ? -1 : 1;
              const sorted = state.rows
                .map((row, index) => ({ row, index }))
                .sort((a, b) => {
                  for (const { column, ascending } of orders) {
                    const diff = (a.row[column] ?? 0) - (b.row[column] ?? 0);
                    if (diff !== 0) return ascending ? diff : -diff;
                  }
                  return flip * (a.index - b.index);
                })
                .map(({ row }) => row);
              return Promise.resolve({ data: sorted.slice(range[0], range[1] + 1), error: null }).then(resolve);
            };
          return () => builder;
        },
      },
    );
    return builder;
  }
  return { state, client: { from } };
});

vi.mock("lib/supabase/server", () => ({ default: fake.client }));

import { fetchShiftRows as fetchAdjustedImpactShiftRows } from "pages/api/v1/db/update-nhl-xg-adjusted-impact";
import { fetchShiftRows as fetchQotQocShiftRows } from "pages/api/v1/db/update-nhl-xg-qot-qoc";

// 1,500 rows of one game that tie on (game_id, period, start_seconds), straddling the 1,000-row page.
function seedTiedShifts() {
  fake.state.calls = 0;
  fake.state.rows = Array.from({ length: 1500 }, (_, index) => ({
    game_id: 2025020001,
    shift_id: index + 1,
    period: 1,
    start_seconds: 0,
  }));
}

describe.each([
  ["update-nhl-xg-adjusted-impact", () => fetchAdjustedImpactShiftRows({ gameIds: [2025020001], seasonId: null })],
  ["update-nhl-xg-qot-qoc", () => fetchQotQocShiftRows({ gameIds: [2025020001], seasonId: null, limitGames: null })],
])("%s shift paging", (_name, fetchRows) => {
  it("returns every shift exactly once across a page boundary", async () => {
    seedTiedShifts();
    const rows = await fetchRows();
    const ids = rows.map((row) => Number(row.shift_id));
    expect(ids).toHaveLength(1500);
    expect(new Set(ids).size).toBe(1500);
    expect(fake.state.calls).toBe(2);
  });
});

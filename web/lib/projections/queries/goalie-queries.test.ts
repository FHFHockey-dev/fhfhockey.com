import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[] | Record<string, unknown> | null>,
  calls: [] as Array<[string, string, unknown[]]>
}));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    const result = () => ({ data: db.tables[table] ?? null, error: null });
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => resolve(result()),
      maybeSingle: () => Promise.resolve(result())
    };
    for (const name of ["select", "eq", "or", "lt", "lte", "in", "order", "limit"]) {
      query[name] = (...args: unknown[]) => { db.calls.push([table, name, args]); return query; };
    }
    return query;
  }
} }));

import { fetchGoalieRestSplitProfile, fetchTeamGoalieStarterContext } from "./goalie-queries";

const STARTER = 8001;
const RELIEVER = 8002;

function seed(appearances: Record<string, unknown>[], labels: Record<string, unknown>[], previousGame: Record<string, unknown> | null) {
  db.calls.length = 0;
  db.tables = { forge_goalie_game: appearances, wgo_goalie_stats: labels, games: previousGame };
}

describe("fetchTeamGoalieStarterContext: credited starts (W1-5)", () => {
  it("credits the pulled starter, not the long reliever with more minutes", async () => {
    // Starter pulled at 600 s, reliever plays 3,000 s; the official label says the starter started.
    seed(
      [
        { game_id: 2025020100, game_date: "2025-11-01", goalie_id: RELIEVER, toi_seconds: 3000 },
        { game_id: 2025020100, game_date: "2025-11-01", goalie_id: STARTER, toi_seconds: 600 }
      ],
      [
        { game_id: 2025020100, goalie_id: STARTER, games_started: 1 },
        { game_id: 2025020100, goalie_id: RELIEVER, games_started: 0 }
      ],
      { id: 2025020100, date: "2025-11-01" }
    );
    const context = await fetchTeamGoalieStarterContext(10, "2025-11-02");
    expect(context.startsByGoalie.get(STARTER)).toBe(1);
    expect(context.startsByGoalie.has(RELIEVER)).toBe(false);
    expect(context.previousGameStarterGoalieId).toBe(STARTER);
    // Last appearance and last credited start are kept apart.
    expect(context.lastPlayedDateByGoalie.get(RELIEVER)).toBe("2025-11-01");
    expect(context.lastCreditedStartDateByGoalie.has(RELIEVER)).toBe(false);
  });

  it("leaves a missing or contradictory label unknown and out of the L10 denominator", async () => {
    seed(
      [
        { game_id: 2025020103, game_date: "2025-11-07", goalie_id: STARTER },
        { game_id: 2025020102, game_date: "2025-11-05", goalie_id: STARTER },
        { game_id: 2025020102, game_date: "2025-11-05", goalie_id: RELIEVER },
        { game_id: 2025020101, game_date: "2025-11-03", goalie_id: RELIEVER }
      ],
      [
        // 103: no label row at all. 102: both labelled as starters (contradictory). 101: known.
        { game_id: 2025020102, goalie_id: STARTER, games_started: 1 },
        { game_id: 2025020102, goalie_id: RELIEVER, games_started: 1 },
        { game_id: 2025020101, goalie_id: RELIEVER, games_started: 1 }
      ],
      { id: 2025020103, date: "2025-11-07" }
    );
    const context = await fetchTeamGoalieStarterContext(10, "2025-11-08");
    expect(context.windowGames).toBe(3);
    expect(context.totalGames).toBe(1);
    expect(context.unknownStartGames).toBe(2);
    expect([...context.startsByGoalie.entries()]).toEqual([[RELIEVER, 1]]);
    // The previous game's starter is unknown, never the first row.
    expect(context.previousGameStarterGoalieId).toBeNull();
    expect(db.calls).toEqual(expect.arrayContaining([["wgo_goalie_stats", "in", ["game_id", [2025020103, 2025020102, 2025020101]]]]));
  });
});

describe("fetchGoalieRestSplitProfile: pregame cutoff", () => {
  it("reads only rows dated strictly before the slate", async () => {
    seed([], [{ date: "2025-11-07" }], null);
    await fetchGoalieRestSplitProfile(STARTER, "2025-11-08");
    const dateFilters = db.calls.filter(([table, name, args]) => table === "wgo_goalie_stats" && args[0] === "date" && (name === "lt" || name === "lte"));
    expect(dateFilters).toEqual([["wgo_goalie_stats", "lt", ["date", "2025-11-08"]]]);
  });
});

describe("credited-start source consolidation regressions", () => {
  it("does not silently resolve an incomplete appearance label set", async () => {
    seed([
      { game_id: 1, game_date: "2026-11-01", goalie_id: STARTER },
      { game_id: 1, game_date: "2026-11-01", goalie_id: RELIEVER }
    ], [{ game_id: 1, goalie_id: STARTER, games_started: 1 }], { id: 1, date: "2026-11-01" });
    const context = await fetchTeamGoalieStarterContext(10, "2026-11-02");
    expect(context.previousGameStarterGoalieId).toBeNull();
    expect(context.unknownStartGames).toBe(1);
  });
  it("does not overwrite conflicting official label rows", async () => {
    seed([{ game_id: 1, game_date: "2026-11-01", goalie_id: STARTER }], [
      { game_id: 1, goalie_id: STARTER, games_started: 0 },
      { game_id: 1, goalie_id: STARTER, games_started: 1 }
    ], { id: 1, date: "2026-11-01" });
    expect((await fetchTeamGoalieStarterContext(10, "2026-11-02")).previousGameStarterGoalieId).toBeNull();
  });
});

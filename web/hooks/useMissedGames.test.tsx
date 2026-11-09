import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; ops: Array<[string, ...unknown[]]> };

const { calls, fromMock } = vi.hoisted(() => {
  const calls: Call[] = [];
  const teamDates = Array.from({ length: 12 }, (_, i) =>
    `2025-10-${String(i + 10).padStart(2, "0")}`
  );
  const respond = (call: Call) => {
    const has = (method: string, column: string) =>
      call.ops.some(([m, c]) => m === method && c === column);
    if (call.table === "games") {
      return teamDates.map((date, i) => ({
        id: 2025020000 + i,
        date,
        seasonId: 20252026,
        type: 2,
        homeTeamId: 14,
        awayTeamId: 1
      }));
    }
    if (call.table === "wgo_skater_stats" && has("eq", "player_id")) {
      // Played the first two games only.
      return teamDates.slice(0, 2).map((date) => ({ date, games_played: 1 }));
    }
    if (call.table === "wgo_skater_stats" && has("eq", "team_abbrev")) {
      // Box scores loaded for every requested date except the last game.
      const dates = call.ops.find(([m]) => m === "in")?.[2] as string[];
      return dates
        .filter((date) => date !== teamDates[11])
        .map((date) => ({ date }));
    }
    return [];
  };
  const fromMock = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const builder: any = {};
    for (const method of ["select", "eq", "gt", "gte", "lt", "lte", "in", "or", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        call.ops.push([method, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: respond(call), error: null }).then(resolve);
    return builder;
  };
  return { calls, fromMock };
});

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { useMissedGames } from "./useMissedGames";

describe("useMissedGames", () => {
  afterEach(() => {
    calls.length = 0;
  });

  it("checks box-score coverage per team in small chunks and marks unloaded games unconfirmed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { result } = renderHook(() => useMissedGames(8478402, 14, 20252026));

    await waitFor(() => expect(result.current.missedGames).toHaveLength(10));

    const coverageCalls = calls.filter(
      (call) =>
        call.table === "wgo_skater_stats" &&
        call.ops.some(([m, c]) => m === "eq" && c === "team_abbrev")
    );
    expect(coverageCalls).toHaveLength(2);
    for (const call of coverageCalls) {
      expect(call.ops).toContainEqual(["eq", "team_abbrev", "TBL"]);
      expect((call.ops.find(([m]) => m === "in")?.[2] as string[]).length).toBeLessThanOrEqual(8);
    }

    const unconfirmed = result.current.missedGames.filter((game) => game.isUnconfirmed);
    expect(unconfirmed.map((game) => game.date)).toEqual(["2025-10-21"]);
    expect(result.current.error).toBeNull();
  });
});

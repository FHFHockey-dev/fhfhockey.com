import { describe, expect, it, vi } from "vitest";

import { loadPlayersForSnapshot } from "./windows";

describe("loadPlayersForSnapshot", () => {
  it("paginates until a short page and preserves position groups", async () => {
    const pages = [
      [
        { player_id: 1, position_code: "C" },
        { player_id: 2, position_code: "D" }
      ],
      [{ player_id: 3, position_code: "G" }]
    ];
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: pages[0], error: null })
      .mockResolvedValueOnce({ data: pages[1], error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const result = await loadPlayersForSnapshot("2026-03-21", {
      client,
      pageSize: 2
    });

    expect(range).toHaveBeenNthCalledWith(1, 0, 1);
    expect(range).toHaveBeenNthCalledWith(2, 2, 3);
    expect(result.ids).toEqual([1, 2]);
    expect(result.posMap.get(1)).toBe("F");
    expect(result.posMap.get(2)).toBe("D");
    expect(result.posMap.has(3)).toBe(false);
  });
});

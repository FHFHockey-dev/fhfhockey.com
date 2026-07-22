import { describe, expect, it, vi } from "vitest";

import { fetchSkillLeagueRef } from "./score";

describe("fetchSkillLeagueRef", () => {
  it("paginates the complete ordered position-group population", async () => {
    const range = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 1,
            nst_ixg_per_60: 1,
            nst_icf_per_60: 2,
            nst_hdcf_per_60: 3,
          },
          {
            player_id: 2,
            nst_ixg_per_60: 3,
            nst_icf_per_60: 4,
            nst_hdcf_per_60: 5,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            player_id: 3,
            nst_ixg_per_60: 5,
            nst_icf_per_60: 6,
            nst_hdcf_per_60: 7,
          },
        ],
        error: null,
      });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const result = await fetchSkillLeagueRef(20252026, "F", {
      client,
      pageSize: 2,
    });

    expect(query.order).toHaveBeenCalledWith("player_id", { ascending: true });
    expect(range).toHaveBeenNthCalledWith(1, 0, 1);
    expect(range).toHaveBeenNthCalledWith(2, 2, 3);
    expect(result).toEqual({
      ixg60: { mu: 3, sig: 2 },
      icf60: { mu: 4, sig: 2 },
      hdcf60: { mu: 5, sig: 2 },
    });
  });
});

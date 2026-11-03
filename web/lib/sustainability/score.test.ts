import { describe, expect, it, vi } from "vitest";

import {
  buildScoreSourceCutoffs,
  fetchSkillLeagueRef,
  fetchSkillWindowRates,
} from "./score";

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

describe("forwards and missing skill data", () => {
  it("includes WGO wingers in the forward reference and leaves players without an NST rate out of it", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({
        data: [
          { player_id: 1, nst_ixg_per_60: 1, nst_icf_per_60: 2, nst_hdcf_per_60: 3 },
          { player_id: 2, nst_ixg_per_60: null, nst_icf_per_60: null, nst_hdcf_per_60: null },
          { player_id: 3, nst_ixg_per_60: 3, nst_icf_per_60: 4, nst_hdcf_per_60: 5 },
        ],
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const result = await fetchSkillLeagueRef(20252026, "F", { client, pageSize: 5 });

    expect(query.in).toHaveBeenCalledWith("position_code", ["C", "L", "R", "LW", "RW"]);
    // Without the skip, the null row would count as 0 and pull the mean to 4/3.
    expect(result.ixg60).toEqual({ mu: 2, sig: Math.SQRT2 });
  });

  it("returns unavailable skill rates, not zero, when no game in the window has NST ice time", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { date: "2026-11-01", nst_ixg: null, nst_icf: null, nst_hdcf: null, nst_toi: null },
          { date: "2026-10-30", nst_ixg: null, nst_icf: null, nst_hdcf: null, nst_toi: 0 },
        ],
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const rates = await fetchSkillWindowRates(1, "2026-11-02", 10, { client });

    expect(rates).toMatchObject({ ixg60: null, icf60: null, hdcf60: null, appearanceCount: 2 });
  });

  it("computes per-60 rates only over games with NST ice time", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { date: "2026-11-01", nst_ixg: 0.5, nst_icf: 3, nst_hdcf: 1, nst_toi: 900 },
          { date: "2026-10-30", nst_ixg: null, nst_icf: null, nst_hdcf: null, nst_toi: null },
        ],
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const rates = await fetchSkillWindowRates(1, "2026-11-02", 10, { client });

    expect(rates.ixg60).toBeCloseTo(2);
    expect(rates.icf60).toBeCloseTo(12);
    expect(rates.hdcf60).toBeCloseTo(4);
  });
});

describe("score source provenance", () => {
  it("reports the observed player-stat cutoff separately from the request", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          date: "2026-04-16",
          nst_ixg: 1,
          nst_icf: 2,
          nst_hdcf: 3,
          nst_toi: 600,
        },
        {
          date: "2026-04-13",
          nst_ixg: 1,
          nst_icf: 2,
          nst_hdcf: 3,
          nst_toi: 600,
        },
      ],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const rates = await fetchSkillWindowRates(8478402, "2026-07-22", 10, {
      client,
    });
    const sourceCutoffs = buildScoreSourceCutoffs({
      snapshotDate: "2026-07-22",
      playerStatsSourceDate: rates.sourceDate,
      seasonId: 20252026,
    });

    expect(query.select).toHaveBeenCalledWith(
      "date, nst_ixg, nst_icf, nst_hdcf, nst_toi",
    );
    expect(rates).toMatchObject({
      sourceDate: "2026-04-16",
      appearanceCount: 2,
    });
    expect(sourceCutoffs).toEqual({
      version: "sustainability_score_provenance_v2",
      requested: { snapshot_date: "2026-07-22" },
      observed: { player_stats_unified: "2026-04-16" },
      derived: { sustainability_window_z: "2026-07-22" },
      scopes: { player_totals_unified_season_id: 20252026 },
      age_days: { player_stats_unified: 97 },
    });
  });
});

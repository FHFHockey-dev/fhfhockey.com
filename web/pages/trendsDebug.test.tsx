import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn()
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    from: supabaseFromMock
  }
}));

import TrendsDebugPage from "./trendsDebug";

const validationPayload = {
  generatedAt: "2026-03-12T12:00:00.000Z",
  request: {
    playerId: 8478402,
    season: 20252026,
    strength: "all",
    teamId: null,
    gameId: null,
    gameDate: null,
    startDate: null,
    endDate: null,
    metric: null,
    metricFamily: null
  },
  selected: {
    player: {
      id: 8478402,
      fullName: "Jesper Bratt",
      position: "RW"
    },
    focusedRow: {
      rowKey: "2026-03-11:all:2025031101",
      gameId: 2025031101,
      gameDate: "2026-03-11",
      strength: "all",
      season: 20252026,
      teamId: 1
    },
    metric: {
      key: "pp_share_pct_last5",
      family: "pp_usage",
      canonicalField: "pp_share_pct_last5",
      legacyFields: ["pp_share_pct_avg_last5"],
      supportFields: [
        "pp_share_pct_player_pp_toi_last5",
        "pp_share_pct_team_pp_toi_last5"
      ]
    }
  },
  readiness: {
    status: "BLOCKED",
    blockerReasons: ["ppTailLag > 0", "rolling rows stale"],
    cautionReasons: ["mixed-source PP window"],
    nextRecommendedAction:
      "Refresh powerPlayCombinations and recompute rolling_player_game_metrics."
  },
  stored: {
    focusedRow: {
      player_id: 8478402,
      game_id: 2025031101,
      game_date: "2026-03-11",
      season: 20252026,
      team_id: 1,
      strength_state: "all",
      pp_share_pct_last5: 0.52,
      pp_share_pct_player_pp_toi_last5: 156,
      pp_share_pct_team_pp_toi_last5: 300
    },
    rowHistory: [
      {
        player_id: 8478402,
        game_id: 2025031101,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength_state: "all",
        pp_share_pct_last5: 0.52,
        pp_share_pct_player_pp_toi_last5: 156,
        pp_share_pct_team_pp_toi_last5: 300
      }
    ]
  },
  recomputed: {
    focusedRow: {
      player_id: 8478402,
      game_id: 2025031101,
      game_date: "2026-03-11",
      season: 20252026,
      team_id: 1,
      strength: "all",
      pp_share_pct_last5: 0.495,
      pp_share_pct_player_pp_toi_last5: 149,
      pp_share_pct_team_pp_toi_last5: 301
    },
    rowHistory: [
      {
        player_id: 8478402,
        game_id: 2025031101,
        game_date: "2026-03-11",
        season: 20252026,
        team_id: 1,
        strength: "all",
        pp_share_pct_last5: 0.495,
        pp_share_pct_player_pp_toi_last5: 149,
        pp_share_pct_team_pp_toi_last5: 301
      }
    ],
    error: null
  },
  sourceRows: {
    shared: {
      wgoRows: [
        {
          game_date: "2026-03-11",
          pp_toi: 152,
          pp_toi_pct_per_game: 0.49
        }
      ],
      ppRows: [],
      lineRows: [],
      games: [{ game_date: "2026-03-11", game_id: 2025031101 }]
    },
    selectedStrength: {
      countsRows: [],
      ratesRows: [],
      countsOiRows: [],
      mergedGames: [
        {
          game_date: "2026-03-11",
          game_id: 2025031101,
          strength: "all",
          ppCombination: {
            PPTOI: 31.2,
            pp_share_of_team: 0.52
          },
          sourceContext: {
            countsSourcePresent: true,
            ratesSourcePresent: true,
            countsOiSourcePresent: true,
            resolvedToiSource: "counts",
            fallbackToiSource: "wgo",
            toiTrustTier: "trusted",
            wgoToiNormalization: "minutes_to_seconds",
            ppUnitSourcePresent: true,
            lineSourcePresent: false,
            lineAssignmentSourcePresent: false
          }
        }
      ]
    }
  },
  diagnostics: {
    coverage: {
      warnings: ["PP builder missing one trailing game."],
      counts: {
        unknownGameIds: 0
      }
    },
    sourceTailFreshness: {
      countsTailLag: 0,
      ratesTailLag: 0,
      countsOiTailLag: 0,
      ppTailLag: 1,
      lineTailLag: 0
    },
    derivedWindowCompleteness: {
      warnings: []
    },
    suspiciousOutputs: {
      issueCount: 0
    },
    targetFreshness: {
      latestStoredGameDate: "2026-03-11",
      latestRecomputedGameDate: "2026-03-11",
      latestSourceDate: "2026-03-10",
      storedRowCount: 1,
      recomputedRowCount: 1
    }
  },
  contracts: null,
  formulas: null,
  windows: null,
  comparisons: {
    focusedRow: {
      storedRowKey: "2026-03-11:all:2025031101",
      recomputedRowKey: "2026-03-11:all:2025031101",
      selectedMetric: {
        field: "pp_share_pct_last5",
        storedValue: 0.52,
        recomputedValue: 0.495,
        diff: 0.025
      }
    }
  },
  helpers: null
};

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

function buildPlayersQuery() {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.ilike = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => ({
    data: [
      {
        id: 8478402,
        fullName: "Jesper Bratt",
        position: "RW"
      }
    ],
    error: null
  }));
  return chain;
}

function buildFaceoffTotalsQuery() {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: {
      fow_percentage: 52.3,
      total_faceoffs: 143,
      games_played: 61
    },
    error: null
  }));
  return chain;
}

describe("TrendsDebugPage validation console", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "players") return buildPlayersQuery();
      if (table === "wgo_skater_stats_totals") return buildFaceoffTotalsQuery();
      throw new Error(`Unexpected supabase table: ${table}`);
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/debug/rolling-player-metrics")) {
        return jsonResponse({
          success: true,
          payload: validationPayload
        });
      }
      return jsonResponse({}, false, 404);
    }));

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined)
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders blocked freshness and comparison views from the validation payload", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    const playerButton = await screen.findByRole("button", {
      name: /Jesper Bratt/i
    });
    fireEvent.click(playerButton);

    expect(await screen.findByText("Copy Helpers")).toBeTruthy();
    expect(screen.getAllByText(/readiness BLOCKED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ppTailLag > 0/i)).toBeTruthy();
    expect(screen.getByText(/mixed-source PP window/i)).toBeTruthy();
    expect(screen.getAllByText("pp_share_pct_last5").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0\.025000/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /sum\(player_pp_toi_seconds\) \/ sum\(team_pp_toi_seconds_inferred_from_share\)/i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Refresh `powerPlayCombinations` for the selected validation games\./i)).toBeTruthy();
  });

  it("copies formula ledger entries, comparison blocks, and refresh prerequisites", async () => {
    render(<TrendsDebugPage />);

    fireEvent.change(screen.getByLabelText("Find Player"), {
      target: { value: "Jesper" }
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: /Jesper Bratt/i
      })
    );

    await screen.findByText("Copy Helpers");

    const writeTextMock = vi.mocked(window.navigator.clipboard.writeText);

    fireEvent.click(screen.getByRole("button", { name: "Copy Formula Audit Entry" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "- ⚠️ `pp_share_pct_last5`\n  - formula: `sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)`"
      );
    });
    expect(await screen.findByText("Formula audit entry copied.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy Comparison Block" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        [
          "- player: `Jesper Bratt`",
          "- season / strength: `20252026` / `all`",
          "- row: `2026-03-11:all:2025031101`",
          "- metric: `pp_share_pct_last5`",
          "- stored value: `0.520000`",
          "- reconstructed value: `0.495000`",
          "- diff: `0.025000`",
          "- readiness: `BLOCKED`"
        ].join("\n")
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy Refresh Prereqs" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        [
          "- metric family: `pp_usage`",
          "- Refresh `powerPlayCombinations` for the selected validation games.",
          "- Verify PP tail lag is zero and inspect PP builder coverage cautions.",
          "- Recompute `rolling_player_game_metrics` before validating PP-share metrics."
        ].join("\n")
      );
    });
  });
});

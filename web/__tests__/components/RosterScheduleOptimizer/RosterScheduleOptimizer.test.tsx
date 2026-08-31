import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState, projectionHook, supabaseFrom, vorpHook } = vi.hoisted(() => ({
  authState: { user: null as { id: string } | null, isLoading: false },
  projectionHook: vi.fn(),
  supabaseFrom: vi.fn(),
  vorpHook: vi.fn(),
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => authState,
}));
vi.mock("hooks/useCurrentSeason", () => ({
  default: () => ({ seasonId: 20262027 }),
}));
vi.mock("hooks/useProcessedProjectionsData", () => ({
  useProcessedProjectionsData: projectionHook,
}));
vi.mock("hooks/useVORPCalculations", () => ({
  useVORPCalculations: vorpHook,
}));
vi.mock("lib/supabase", () => ({
  default: { from: supabaseFrom },
}));

import RosterScheduleOptimizer from "components/RosterScheduleOptimizer/RosterScheduleOptimizer";

function processedPlayer(
  playerId: number,
  fullName: string,
  team: string,
  position: string,
  yahooPlayerId?: string,
) {
  return {
    playerId,
    fullName,
    displayTeam: team,
    displayPosition: position,
    eligiblePositions: [position],
    yahooPlayerId,
    combinedStats: {},
    fantasyPoints: {
      projected: 100 - playerId,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null,
    },
  };
}

function scheduleResponse(
  games = [
    {
      source_game_id: 1,
      game_date: "2026-10-08",
      game_status: "FUT",
      team_abbreviation: "CAR",
      week: 1,
    },
    {
      source_game_id: 2,
      game_date: "2026-10-08",
      game_status: "FUT",
      team_abbreviation: "NJD",
      week: 1,
    },
  ],
) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        gameKey: "477",
        startWeek: 1,
        endWeek: 30,
        version: "test-v1",
        freshness: {
          latestFetchedAt: new Date().toISOString(),
          oldestFetchedAt: new Date().toISOString(),
          rowCount: games.length,
        },
        games,
      },
    }),
  };
}

afterEach(() => {
  cleanup();
  authState.user = null;
  authState.isLoading = false;
  projectionHook.mockReset();
  vorpHook.mockReset();
  supabaseFrom.mockReset();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("RosterScheduleOptimizer", () => {
  it("loads the bulk schedule once and supports a local manual scenario", async () => {
    const alpha = processedPlayer(1, "Alpha Center", "CAR", "C", "101");
    const beta = processedPlayer(2, "Beta Wing", "NJD", "LW", "102");
    projectionHook.mockImplementation(({ activePlayerType }) => ({
      processedPlayers: activePlayerType === "skater" ? [alpha, beta] : [],
      tableColumns: [],
      isLoading: false,
      error: null,
    }));
    vorpHook.mockReturnValue({
      playerMetrics: new Map([
        ["1", { value: 77 }],
        ["2", { value: 66 }],
      ]),
      replacementByPos: {},
    });
    const fetchMock = vi.fn().mockResolvedValue(scheduleResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<RosterScheduleOptimizer />);

    expect(await screen.findByText(/Schedule cache is current/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("gameKey=477");
    expect(screen.getByText("Manual scenario · League Defaults")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Yahoo game key" }), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain("gameKey=999");

    fireEvent.change(screen.getByRole("searchbox", { name: "Add a projected player" }), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getAllByText("Alpha Center").length).toBeGreaterThan(0);
      const summary = screen.getByLabelText("Scenario summary");
      expect(summary.querySelector("article strong")?.textContent).toBe("1");
    });
    expect(screen.getByText("77")).toBeTruthy();
    expect(vorpHook).toHaveBeenCalledWith(expect.objectContaining({ baselineMode: "full" }));
    expect(screen.getByRole("button", { name: "Remove Alpha Center from scenario" })).toBeTruthy();
    expect(screen.getByLabelText("Daily roster congestion heatmap")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    expect(screen.getByText(/Add players to build a manual scenario/)).toBeTruthy();
  });

  it("reports a schedule failure and retries on request", async () => {
    projectionHook.mockReturnValue({
      processedPlayers: [],
      tableColumns: [],
      isLoading: false,
      error: null,
    });
    vorpHook.mockReturnValue({ playerMetrics: new Map(), replacementByPos: {} });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Schedule unavailable"))
      .mockResolvedValueOnce(scheduleResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<RosterScheduleOptimizer />);

    expect(await screen.findByText("Schedule unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry schedule" }));
    expect(await screen.findByText(/Schedule cache is current/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("updates before/after results for add, remove, and a lower-DUST swap", async () => {
    const anchor = processedPlayer(1, "Anchor Wing", "CAR", "RW", "101");
    const outgoing = processedPlayer(2, "Conflict Wing", "NJD", "RW", "102");
    const alternative = processedPlayer(3, "Off-night Wing", "NYR", "RW", "103");
    projectionHook.mockImplementation(({ activePlayerType }) => ({
      processedPlayers:
        activePlayerType === "skater" ? [anchor, outgoing, alternative] : [],
      tableColumns: [],
      isLoading: false,
      error: null,
    }));
    vorpHook.mockReturnValue({
      playerMetrics: new Map([
        ["1", { value: 110 }],
        ["2", { value: 100 }],
        ["3", { value: 98 }],
      ]),
      replacementByPos: {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        scheduleResponse([
          { source_game_id: 1, game_date: "2026-10-08", game_status: "FUT", team_abbreviation: "CAR", week: 1 },
          { source_game_id: 2, game_date: "2026-10-09", game_status: "FUT", team_abbreviation: "CAR", week: 1 },
          { source_game_id: 3, game_date: "2026-10-08", game_status: "FUT", team_abbreviation: "NJD", week: 1 },
          { source_game_id: 4, game_date: "2026-10-09", game_status: "FUT", team_abbreviation: "NJD", week: 1 },
          { source_game_id: 5, game_date: "2026-10-10", game_status: "FUT", team_abbreviation: "NYR", week: 1 },
          { source_game_id: 6, game_date: "2026-10-11", game_status: "FUT", team_abbreviation: "NYR", week: 1 },
        ]),
      ),
    );

    render(<RosterScheduleOptimizer />);
    expect(await screen.findByText(/Schedule cache is current/)).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton", { name: "RW" }), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "UTIL" }), {
      target: { value: "0" },
    });

    const addBySearch = (name: string) => {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Add a projected player" }),
        { target: { value: name } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    };
    addBySearch("Anchor");
    addBySearch("Conflict");

    await waitFor(() =>
      expect(
        screen.getByLabelText("Scenario comparison").textContent,
      ).toContain("+2 Bench Games"),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Conflict Wing from scenario",
      }),
    );
    expect(
      screen.getByLabelText("Scenario comparison").textContent,
    ).toContain("0 Bench Games");

    addBySearch("Conflict");
    fireEvent.change(screen.getByLabelText("Player to replace"), {
      target: { value: "2" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Swap" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Remove Conflict Wing from scenario",
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "Remove Off-night Wing from scenario",
        }),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("Scenario comparison").textContent,
      ).toContain("0 Bench Games");
    });
  });

  it("builds a connected Yahoo baseline from explicit IDs and preserves IR status", async () => {
    authState.user = { id: "user-1" };
    const player = processedPlayer(999, "Explicit ID Player", "CAR", "C", "123");
    projectionHook.mockImplementation(({ activePlayerType }) => ({
      processedPlayers: activePlayerType === "skater" ? [player] : [],
      tableColumns: [],
      isLoading: false,
      error: null,
    }));
    vorpHook.mockReturnValue({
      playerMetrics: new Map([["999", { value: 88 }]]),
      replacementByPos: {},
    });
    supabaseFrom.mockImplementation((table: string) => {
      const data = table === "user_settings"
        ? {
            league_type: "points",
            scoring_categories: {},
            goalie_scoring_categories: {},
            category_weights: {},
            roster_config: { C: 1, bench: 1, utility: 0 },
            team_count: 12,
            draft_order_type: "snake",
            ui_preferences: {},
            active_context: {
              source_type: "external-provider",
              provider: "yahoo",
              external_team_id: "team-1",
            },
          }
        : {
            id: "team-1",
            team_name: "ID League Team",
            roster_snapshot: {
              players: [
                {
                  editorial_player_id: "123",
                  name: { full: "A deliberately different name" },
                  selected_position: { position: "IR" },
                },
              ],
            },
          };
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => Promise.resolve({ data, error: null }),
      };
      return query;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(scheduleResponse()));

    render(<RosterScheduleOptimizer />);

    expect(await screen.findByText("Connected Yahoo roster · ID League Team")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Remove Explicit ID Player from scenario" })).toBeTruthy();
    expect(screen.queryByText(/not matched by explicit Yahoo\/NHL ID/)).toBeNull();
    expect(screen.getByLabelText("Scenario summary").textContent).toContain(
      "Scheduled0",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Explicit ID Player from scenario" }));
    expect(screen.getByText(/Add players to build a manual scenario/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    expect(await screen.findByRole("button", { name: "Remove Explicit ID Player from scenario" })).toBeTruthy();
  });
});

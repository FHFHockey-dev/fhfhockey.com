import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const routerState = vi.hoisted(() => ({
  query: {
    playerId: "88",
    date: "2026-03-14",
    mode: "tonight",
  },
}));
const useTeamScheduleMock = vi.hoisted(() => vi.fn());
const getLatestStartedSeasonForDateMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("components/GameGrid/utils/useSchedule", () => ({
  default: () => [
    [
      {
        teamId: 1,
        SAT: {
          id: 10,
          gameType: 2,
          homeTeam: { id: 1 },
          awayTeam: { id: 2 },
        },
        SUN: {
          id: 11,
          gameType: 2,
          homeTeam: { id: 3 },
          awayTeam: { id: 1 },
        },
      },
    ],
    [10, 10, 10, 10, 10, 4, 4],
    false,
  ],
}));

vi.mock("hooks/useTeamSchedule", () => ({
  useTeamSchedule: useTeamScheduleMock,
}));

vi.mock("lib/NHL/server", () => ({
  getLatestStartedSeasonForDate: getLatestStartedSeasonForDateMock,
}));

import ForgePlayerDetailPage, {
  getServerSideProps,
} from "../../../../pages/forge/player/[playerId]";

const scheduleResult = {
  games: [
    {
      id: 1,
      gameDate: "2026-03-15",
      homeTeam: { abbrev: "NJD" },
      awayTeam: { abbrev: "NYI" },
    },
  ],
  loading: false,
  error: null,
};

function jsonResponse(
  data: unknown,
  ok = true,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe("FORGE player detail page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
    routerState.query = {
      playerId: "88",
      date: "2026-03-14",
      mode: "tonight",
    };
    useTeamScheduleMock.mockReset();
    useTeamScheduleMock.mockReturnValue(scheduleResult);
    getLatestStartedSeasonForDateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders projection, ownership, and drill-in context for top-add cards", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-14",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.7,
              ppp: 0.8,
              sog: 3.6,
              hit: 0.4,
              blk: 0.2,
              uncertainty: 0.3,
            },
          ],
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({
          players: [{ playerId: 88, ownership: 42 }],
        });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          selectedPlayers: [
            {
              playerId: 88,
              latest: 42,
              delta: 5,
              sparkline: [
                { date: "2026-03-10", value: 37 },
                { date: "2026-03-14", value: 42 },
              ],
            },
          ],
          risers: [],
          fallers: [],
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(await screen.findByText("Projection and Ownership")).toBeTruthy();
    expect(screen.getByText("Top Add")).toBeTruthy();
    expect(screen.getByText("Upcoming Schedule")).toBeTruthy();
    expect(screen.getByText("5D +5.0 pts")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Legacy Dashboard" })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/forge/dashboard?date=2026-03-14&mode=tonight",
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Start Chart" })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/start-chart?date=2026-03-14&mode=tonight",
        ),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Team Detail" })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/forge/team/NJD?date=2026-03-14&mode=tonight",
        ),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Quick Read" }).getAttribute("href"),
    ).toBe("/FORGE?date=2026-03-14&mode=tonight");
    expect(
      screen
        .getByRole("link", { name: "Trends Player Page" })
        .getAttribute("href"),
    ).toBe(
      "/trends/player/88?date=2026-03-14&origin=forge-player-detail&returnTo=%2Fforge%2Fplayer%2F88%3Fdate%3D2026-03-14%26mode%3Dtonight",
    );
    expect(useTeamScheduleMock).toHaveBeenCalledWith("NJD", "20252026", "1");
    expect(screen.getByText("Schedule season: 20252026")).toBeTruthy();
  });

  it("keeps projection detail visible when ownership context is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-12",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.7,
              ppp: 0.8,
              sog: 3.6,
              hit: 0.4,
              blk: 0.2,
              uncertainty: 0.3,
            },
          ],
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({}, false, 500);
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({}, false, 500);
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(
      await screen.findByText(
        "Using latest available projections from 2026-03-12.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Ownership context unavailable for this player."),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Projection and Ownership").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Top Add")).toBeTruthy();
  });

  it("uses the same weekly schedule context in the player-detail add score", async () => {
    routerState.query = {
      playerId: "88",
      date: "2026-03-14",
      mode: "week",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-14",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.7,
              ppp: 0.8,
              sog: 3.6,
              hit: 0.4,
              blk: 0.2,
              uncertainty: 0.3,
            },
          ],
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({ players: [{ playerId: 88, ownership: 42 }] });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          selectedPlayers: [
            { playerId: 88, latest: 42, delta: 5, sparkline: [] },
          ],
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(
      await screen.findByText(/Weekly stream mode • 2G • 2 off/),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("horizon=5"),
      ),
    ).toBe(true);
  });

  it("resolves the persisted schedule season from the exact requested route date", async () => {
    getLatestStartedSeasonForDateMock.mockResolvedValue({ id: 20232024 });

    const result = await getServerSideProps({
      query: {
        playerId: "88",
        date: "2024-03-14",
        resolvedDate: "2026-03-14",
      },
    } as unknown as Parameters<typeof getServerSideProps>[0]);

    expect(getLatestStartedSeasonForDateMock).toHaveBeenCalledWith(
      "2024-03-14",
    );
    expect(result).toEqual({
      props: {
        scheduleSeasonId: "20232024",
      },
    });
  });

  it("fails the selected-date schedule closed when season resolution errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getLatestStartedSeasonForDateMock.mockRejectedValue(
      new Error("season lookup unavailable"),
    );
    const result = await getServerSideProps({
      query: {
        playerId: "88",
        date: "2024-03-14",
      },
    } as unknown as Parameters<typeof getServerSideProps>[0]);

    expect(result).toEqual({
      props: {
        scheduleSeasonId: null,
      },
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      "Forge player detail schedule season lookup failed.",
    );
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain(
      "season lookup unavailable",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(<ForgePlayerDetailPage scheduleSeasonId={null} />);

    expect(screen.getByText("Schedule season: unavailable")).toBeTruthy();
    expect(useTeamScheduleMock).toHaveBeenCalledWith(
      "",
      "unavailable",
      undefined,
    );
    expect(
      useTeamScheduleMock.mock.calls.every(
        ([, seasonId]) => seasonId !== undefined,
      ),
    ).toBe(true);
  });
});

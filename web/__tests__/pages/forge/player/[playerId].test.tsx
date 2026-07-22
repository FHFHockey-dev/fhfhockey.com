import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const routerState = vi.hoisted(
  (): {
    query: {
      playerId: string;
      date: string;
      mode: string;
      resolvedDate?: string;
    };
  } => ({
    query: {
      playerId: "88",
      date: "2026-03-14",
      mode: "tonight",
    },
  }),
);
const useTeamScheduleMock = vi.hoisted(() => vi.fn());
const useScheduleMock = vi.hoisted(() => vi.fn());
const getLatestStartedSeasonForDateMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("components/GameGrid/utils/useSchedule", () => ({
  default: useScheduleMock,
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

const currentWeekScheduleResult = [
  [
    {
      teamId: 1,
      SAT: {
        id: 10,
        season: 20252026,
        gameType: 2,
        homeTeam: { id: 1 },
        awayTeam: { id: 2 },
      },
      SUN: {
        id: 11,
        season: 20252026,
        gameType: 2,
        homeTeam: { id: 3 },
        awayTeam: { id: 1 },
      },
    },
  ],
  [10, 10, 10, 10, 10, 4, 4],
  false,
] as const;

const njdTeamIdentity = {
  source: {
    id: 1,
    abbreviation: "NJD",
    name: "New Jersey Devils",
  },
  canonical: {
    id: 1,
    abbreviation: "NJD",
    name: "New Jersey Devils",
  },
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
    useScheduleMock.mockReset();
    useScheduleMock.mockReturnValue(currentWeekScheduleResult);
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
          requestedDate: "2026-03-14",
          requestedSeasonId: 20252026,
          resolvedSeasonId: 20252026,
          horizonGames: 1,
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              teamIdentity: njdTeamIdentity,
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
    expect(useTeamScheduleMock).toHaveBeenCalledWith(
      "NJD",
      "20252026",
      "1",
      "2026-03-14",
    );
    expect(screen.getByText("Schedule season: 20252026")).toBeTruthy();
  });

  it.each([
    {
      date: "2024-03-14",
      seasonId: "20232024",
      source: { id: 53, abbreviation: "ARI", name: "Arizona Coyotes" },
    },
    {
      date: "2025-03-14",
      seasonId: "20242025",
      source: { id: 59, abbreviation: "UTA", name: "Utah Hockey Club" },
    },
    {
      date: "2026-03-14",
      seasonId: "20252026",
      source: { id: 68, abbreviation: "UTA", name: "Utah Mammoth" },
    },
  ])(
    "preserves $source.name display identity while routing through canonical UTA/68",
    async ({ date, seasonId, source }) => {
      routerState.query = {
        playerId: "88",
        date,
        mode: "tonight",
      };
      useTeamScheduleMock.mockReturnValue({
        games: [
          {
            id: 3,
            gameDate: date,
            homeTeam: { id: source.id, abbrev: source.abbreviation },
            awayTeam: { id: 6, abbrev: "BOS" },
          },
        ],
        loading: false,
        error: null,
        scheduleTeam: source,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("/api/v1/forge/players")) {
            return jsonResponse({
              asOfDate: date,
              requestedDate: date,
              requestedSeasonId: Number(seasonId),
              resolvedSeasonId: Number(seasonId),
              horizonGames: 1,
              data: [
                {
                  player_id: 88,
                  player_name: "Relocated Player",
                  team_name: source.name,
                  teamIdentity: {
                    source,
                    canonical: {
                      id: 68,
                      abbreviation: "UTA",
                      name: "Utah Mammoth",
                    },
                  },
                  position: "C",
                  pts: 2.1,
                  ppp: 0.4,
                  sog: 3.2,
                  hit: 0.5,
                  blk: 0.3,
                  uncertainty: 0.2,
                },
              ],
            });
          }
          if (url.includes("/api/v1/transactions/ownership-snapshots")) {
            return jsonResponse({ players: [] });
          }
          if (url.includes("/api/v1/transactions/ownership-trends")) {
            return jsonResponse({
              success: true,
              selectedPlayers: [],
              risers: [],
              fallers: [],
            });
          }
          return jsonResponse({}, false);
        }),
      );

      render(<ForgePlayerDetailPage scheduleSeasonId={seasonId} />);

      expect(await screen.findByText("Relocated Player")).toBeTruthy();
      expect(screen.getByText(source.name)).toBeTruthy();
      expect(screen.getByText("vs BOS")).toBeTruthy();
      expect(useTeamScheduleMock).toHaveBeenCalledWith(
        "UTA",
        seasonId,
        "68",
        date,
      );
    },
  );

  it("validates fallback projection identity against the resolved season while scheduling the requested season", async () => {
    routerState.query = {
      playerId: "88",
      date: "2025-03-14",
      mode: "tonight",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/forge/players")) {
          return jsonResponse({
            asOfDate: "2024-03-14",
            requestedDate: "2025-03-14",
            requestedSeasonId: 20242025,
            resolvedSeasonId: 20232024,
            horizonGames: 1,
            data: [
              {
                player_id: 88,
                player_name: "Fallback Arizona Player",
                team_name: "Arizona Coyotes",
                teamIdentity: {
                  source: {
                    id: 53,
                    abbreviation: "ARI",
                    name: "Arizona Coyotes",
                  },
                  canonical: {
                    id: 68,
                    abbreviation: "UTA",
                    name: "Utah Mammoth",
                  },
                },
                position: "C",
                pts: 2.1,
                ppp: 0.4,
                sog: 3.2,
                hit: 0.5,
                blk: 0.3,
                uncertainty: 0.2,
              },
            ],
          });
        }
        if (url.includes("/api/v1/transactions/ownership-trends")) {
          return jsonResponse({ success: true, selectedPlayers: [] });
        }
        if (url.includes("/api/v1/transactions/ownership-snapshots")) {
          return jsonResponse({ players: [] });
        }
        return jsonResponse({}, false);
      }),
    );

    render(<ForgePlayerDetailPage scheduleSeasonId="20242025" />);

    expect(await screen.findByText("Fallback Arizona Player")).toBeTruthy();
    expect(screen.getByText("Arizona Coyotes")).toBeTruthy();
    expect(useTeamScheduleMock).toHaveBeenCalledWith(
      "UTA",
      "20242025",
      "68",
      "2025-03-14",
    );
  });

  it("rejects a source identity from the wrong resolved season", async () => {
    routerState.query = {
      playerId: "88",
      date: "2025-03-14",
      mode: "tonight",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/forge/players")) {
          return jsonResponse({
            asOfDate: "2025-03-14",
            requestedDate: "2025-03-14",
            requestedSeasonId: 20242025,
            resolvedSeasonId: 20242025,
            horizonGames: 1,
            data: [
              {
                player_id: 88,
                player_name: "Wrong Era Player",
                team_name: "Arizona Coyotes",
                teamIdentity: {
                  source: {
                    id: 53,
                    abbreviation: "ARI",
                    name: "Arizona Coyotes",
                  },
                  canonical: {
                    id: 68,
                    abbreviation: "UTA",
                    name: "Utah Mammoth",
                  },
                },
                position: "C",
                pts: 2.1,
                ppp: 0.4,
                sog: 3.2,
                hit: 0.5,
                blk: 0.3,
                uncertainty: 0.2,
              },
            ],
          });
        }
        if (url.includes("/api/v1/transactions/ownership-trends")) {
          return jsonResponse({ success: true, selectedPlayers: [] });
        }
        if (url.includes("/api/v1/transactions/ownership-snapshots")) {
          return jsonResponse({ players: [] });
        }
        return jsonResponse({}, false);
      }),
    );

    render(<ForgePlayerDetailPage scheduleSeasonId="20242025" />);

    expect(await screen.findByText("Wrong Era Player")).toBeTruthy();
    expect(useTeamScheduleMock).toHaveBeenLastCalledWith(
      "",
      "20242025",
      undefined,
      "2025-03-14",
    );
    expect(screen.queryByRole("link", { name: "Team Detail" })).toBeNull();
  });

  it("fails route and schedule identity closed when structured identity is mismatched", async () => {
    routerState.query = {
      playerId: "88",
      date: "2024-03-14",
      mode: "tonight",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/forge/players")) {
          return jsonResponse({
            asOfDate: "2024-03-14",
            requestedDate: "2024-03-14",
            requestedSeasonId: 20232024,
            resolvedSeasonId: 20232024,
            horizonGames: 1,
            data: [
              {
                player_id: 88,
                player_name: "Invalid Identity",
                team_name: "Arizona Coyotes",
                teamIdentity: {
                  source: {
                    id: 53,
                    abbreviation: "ARI",
                    name: "Arizona Coyotes",
                  },
                  canonical: {
                    id: 1,
                    abbreviation: "NJD",
                    name: "New Jersey Devils",
                  },
                },
                position: "C",
                pts: 2.1,
                ppp: 0.4,
                sog: 3.2,
                hit: 0.5,
                blk: 0.3,
                uncertainty: 0.2,
              },
            ],
          });
        }
        if (url.includes("/api/v1/transactions/ownership-snapshots")) {
          return jsonResponse({ players: [] });
        }
        if (url.includes("/api/v1/transactions/ownership-trends")) {
          return jsonResponse({
            success: true,
            selectedPlayers: [],
            risers: [],
            fallers: [],
          });
        }
        return jsonResponse({}, false);
      }),
    );

    render(<ForgePlayerDetailPage scheduleSeasonId="20232024" />);

    expect(await screen.findByText("Invalid Identity")).toBeTruthy();
    expect(useTeamScheduleMock).toHaveBeenLastCalledWith(
      "",
      "20232024",
      undefined,
      "2024-03-14",
    );
    expect(screen.queryByRole("link", { name: "Team Detail" })).toBeNull();
  });

  it("uses the requested route date instead of resolved or projection dates", async () => {
    routerState.query.resolvedDate = "2026-03-13";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-12",
          requestedDate: "2026-03-14",
          requestedSeasonId: 20252026,
          resolvedSeasonId: 20252026,
          horizonGames: 1,
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              teamIdentity: njdTeamIdentity,
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
        return jsonResponse({ players: [] });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          selectedPlayers: [],
          risers: [],
          fallers: [],
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(await screen.findByText("Top Add")).toBeTruthy();
    expect(useTeamScheduleMock).toHaveBeenCalledWith(
      "NJD",
      "20252026",
      "1",
      "2026-03-14",
    );
    expect(useTeamScheduleMock).not.toHaveBeenCalledWith(
      "NJD",
      "20252026",
      "1",
      "2026-03-12",
    );
    expect(useTeamScheduleMock).not.toHaveBeenCalledWith(
      "NJD",
      "20252026",
      "1",
      "2026-03-13",
    );
  });

  it("keeps projection detail visible when ownership context is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-12",
          requestedDate: "2026-03-14",
          requestedSeasonId: 20252026,
          resolvedSeasonId: 20252026,
          horizonGames: 1,
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              teamIdentity: njdTeamIdentity,
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
          requestedDate: "2026-03-14",
          requestedSeasonId: 20252026,
          resolvedSeasonId: 20252026,
          horizonGames: 5,
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              teamIdentity: njdTeamIdentity,
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

  it("masks a prior same-season week until the selected-date schedule settles", async () => {
    routerState.query = {
      playerId: "88",
      date: "2026-03-14",
      mode: "week",
    };
    let selectedScheduleResult: unknown = currentWeekScheduleResult;
    useScheduleMock.mockImplementation(() => selectedScheduleResult);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        const requestedDate = new URL(url, "http://localhost").searchParams.get(
          "date",
        );
        return jsonResponse({
          asOfDate: requestedDate,
          requestedDate,
          requestedSeasonId: 20252026,
          resolvedSeasonId: 20252026,
          horizonGames: 5,
          data: [
            {
              player_id: 88,
              player_name: `Week ${requestedDate}`,
              team_name: "New Jersey Devils",
              teamIdentity: njdTeamIdentity,
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

    const { rerender } = render(
      <ForgePlayerDetailPage scheduleSeasonId="20252026" />,
    );

    expect(
      await screen.findByText(/Weekly stream mode • 2G • 2 off/),
    ).toBeTruthy();

    selectedScheduleResult = [
      currentWeekScheduleResult[0],
      currentWeekScheduleResult[1],
      true,
    ];
    routerState.query = {
      playerId: "88",
      date: "2026-03-21",
      mode: "week",
    };
    rerender(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(await screen.findByText("Week 2026-03-21")).toBeTruthy();
    expect(screen.queryByText(/Weekly stream mode • 2G • 2 off/)).toBeNull();

    selectedScheduleResult = [
      [
        {
          teamId: 1,
          SUN: {
            id: 13,
            season: 20252026,
            gameType: 2,
            homeTeam: { id: 1 },
            awayTeam: { id: 2 },
          },
        },
      ],
      [10, 10, 10, 10, 10, 10, 4],
      false,
    ];
    rerender(<ForgePlayerDetailPage scheduleSeasonId="20252026" />);

    expect(
      await screen.findByText(/Weekly stream mode • 1G • 1 off/),
    ).toBeTruthy();
    expect(useScheduleMock).toHaveBeenCalledWith("2026-03-09", false);
    expect(useScheduleMock).toHaveBeenCalledWith("2026-03-16", false);
  });

  it("uses the historical Arizona source schedule for 2023-24 weekly scoring", async () => {
    const date = "2024-03-14";
    routerState.query = {
      playerId: "88",
      date,
      mode: "week",
    };
    useScheduleMock.mockReturnValue([
      [
        {
          teamId: 53,
          FRI: {
            id: 12,
            season: 20232024,
            gameType: 2,
            homeTeam: { id: 53 },
            awayTeam: { id: 6 },
          },
        },
      ],
      [12, 12, 12, 12, 7, 12, 12],
      false,
    ]);
    useTeamScheduleMock.mockReturnValue({
      games: [
        {
          id: 12,
          gameDate: "2024-03-15",
          homeTeam: { id: 53, abbrev: "ARI" },
          awayTeam: { id: 6, abbrev: "BOS" },
        },
      ],
      loading: false,
      error: null,
      scheduleTeam: {
        id: 53,
        abbreviation: "ARI",
        name: "Arizona Coyotes",
      },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: date,
          requestedDate: date,
          requestedSeasonId: 20232024,
          resolvedSeasonId: 20232024,
          horizonGames: 5,
          data: [
            {
              player_id: 88,
              player_name: "Historical Streamer",
              team_name: "Arizona Coyotes",
              teamIdentity: {
                source: {
                  id: 53,
                  abbreviation: "ARI",
                  name: "Arizona Coyotes",
                },
                canonical: {
                  id: 68,
                  abbreviation: "UTA",
                  name: "Utah Mammoth",
                },
              },
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

    render(<ForgePlayerDetailPage scheduleSeasonId="20232024" />);

    expect(await screen.findByText("Historical Streamer")).toBeTruthy();
    expect(screen.getByText("Arizona Coyotes")).toBeTruthy();
    expect(screen.getByText(/Weekly stream mode • 1G • 1 off/)).toBeTruthy();
    expect(screen.getByText("vs BOS")).toBeTruthy();
    expect(useScheduleMock).toHaveBeenCalledWith("2024-03-11", false);
    expect(useTeamScheduleMock).toHaveBeenCalledWith(
      "UTA",
      "20232024",
      "68",
      date,
    );
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
      "2026-03-14",
    );
    expect(
      useTeamScheduleMock.mock.calls.every(
        ([, seasonId]) => seasonId !== undefined,
      ),
    ).toBe(true);
  });
});

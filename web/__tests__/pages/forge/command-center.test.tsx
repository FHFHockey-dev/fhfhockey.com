import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const routerState = vi.hoisted(() => ({
  query: {
    date: "2026-03-14",
    team: "CAR",
    position: "f",
    slate: "main",
    mode: "week"
  } as Record<string, string>,
  asPath:
    "/forge/command-center?date=2026-03-14&mode=week&slate=main&team=CAR&position=f",
  isReady: true,
  replace: vi.fn(async (href: string) => {
    routerState.asPath = href;
    return true;
  })
}));

const loadCommandCenterDataMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState
}));

vi.mock("lib/dashboard/commandCenterData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lib/dashboard/commandCenterData")>();
  return {
    ...actual,
    loadCommandCenterData: loadCommandCenterDataMock
  };
});

import ForgeCommandCenterPage from "../../../pages/forge/command-center";

const contract = (id: string, label: string) => ({
  id,
  label,
  sourceApis: [],
  sourceTables: [],
  freshnessExpectation: "",
  fallbackStrategy: "",
  emptyStateRule: `${label} is empty.`,
  clickDestination: "/"
});

function moduleState<T>(id: string, label: string, data: T, resolvedDate = "2026-03-14") {
  return {
    status: "ready" as const,
    data,
    requestedDate: "2026-03-14",
    resolvedDate,
    fallbackApplied: resolvedDate !== "2026-03-14",
    message: resolvedDate !== "2026-03-14" ? `${label} using ${resolvedDate}` : null,
    error: null,
    contract: contract(id, label) as never
  };
}

function buildCommandData() {
  return {
    routeState: {
      date: "2026-03-14",
      resolvedDate: null,
      team: "CAR",
      position: "f",
      slateMode: "main",
      addMode: "week"
    },
    mixedState: {
      requestedDate: "2026-03-14",
      resolvedDates: ["2026-03-13", "2026-03-14"],
      hasMixedDates: true,
      fallbackModuleIds: ["focused_slate"],
      message: "Some command-center modules are serving fallback dates: 2026-03-13, 2026-03-14."
    },
    modules: {
      teamPower: moduleState("team_power", "Team Power Terminal", {
        ratings: [
          {
            teamAbbr: "CAR",
            date: "2026-03-14",
            offRating: 82,
            defRating: 75,
            paceRating: 73,
            ppTier: 1,
            pkTier: 2,
            trend10: 3.2,
            finishingRating: 68,
            goalieRating: 62,
            dangerRating: null,
            specialRating: null,
            disciplineRating: null,
            varianceFlag: 44
          },
          {
            teamAbbr: "NJD",
            date: "2026-03-14",
            offRating: 72,
            defRating: 68,
            paceRating: 69,
            ppTier: 2,
            pkTier: 2,
            trend10: -1.1,
            finishingRating: 51,
            goalieRating: 58,
            dangerRating: null,
            specialRating: null,
            disciplineRating: null,
            varianceFlag: 55
          }
        ],
        ctpi: {
          generatedAt: "2026-03-14T12:00:00.000Z",
          teams: [
            {
              team: "CAR",
              ctpi_0_to_100: 78,
              offense: 80,
              defense: 75,
              luck: 49,
              sparkSeries: [
                { date: "2026-03-12", value: 70 },
                { date: "2026-03-14", value: 78 }
              ]
            }
          ]
        }
      }),
      focusedSlate: moduleState(
        "focused_slate",
        "Focused Slate + Goalie Context",
        {
          dateUsed: "2026-03-13",
          requestedDate: "2026-03-14",
          fallbackApplied: true,
          serving: null,
          games: [
            {
              id: 1,
              date: "2026-03-13",
              homeTeamId: 12,
              awayTeamId: 1,
              homeGoalies: [
                {
                  player_id: 30,
                  name: "Frederik Andersen",
                  start_probability: 0.72,
                  projected_gsaa_per_60: 0.2,
                  confirmed_status: false,
                  percent_ownership: 42
                }
              ],
              awayGoalies: [],
              homeRating: {
                offRating: 82,
                defRating: 75,
                paceRating: 73,
                trend10: 3.2,
                ppTier: 1,
                pkTier: 2
              },
              awayRating: {
                offRating: 72,
                defRating: 68,
                paceRating: 69,
                trend10: -1.1,
                ppTier: 2,
                pkTier: 2
              }
            }
          ]
        },
        "2026-03-13"
      ),
      topAdds: moduleState("top_adds", "Top Adds Watchlist", {
        forgePlayers: {
          asOfDate: "2026-03-14",
          data: [
            {
              player_id: 101,
              player_name: "Liam Marchenko",
              team_name: "Carolina Hurricanes",
              position: "RW",
              pts: 2.9,
              ppp: 0.4,
              sog: 3.1,
              hit: 0.8,
              blk: 0.2
            }
          ]
        },
        ownershipTrends: {
          selectedPlayers: [
            {
              playerId: 101,
              name: "Liam Marchenko",
              latest: 34,
              delta: 2.6,
              teamAbbrev: "CAR",
              sparkline: [
                { date: "2026-03-10", value: 28 },
                { date: "2026-03-14", value: 34 }
              ]
            }
          ]
        },
        ownershipSnapshots: null
      }),
      playerInsight: moduleState("player_insight", "Player Insight Core", {
        sustainable: {
          requested_snapshot_date: "2026-03-14",
          snapshot_date: "2026-03-14",
          serving: null,
          rows: [
            {
              player_id: 201,
              player_name: "William Nylander",
              position_group: "F",
              position_code: "RW",
              window_code: "l10",
              s_100: 84,
              luck_pressure: 0.4,
              z_shp: 0.2,
              z_oishp: 0.1,
              z_ipp: 0.3,
              z_ppshp: 0.2,
              guardrail_state: null,
              guardrail_warnings: []
            }
          ]
        },
        unsustainable: {
          requested_snapshot_date: "2026-03-14",
          snapshot_date: "2026-03-14",
          serving: null,
          rows: []
        },
        skaterTrends: {
          generatedAt: "2026-03-14T12:00:00.000Z",
          requestedDate: "2026-03-14",
          dateUsed: "2026-03-14",
          fallbackApplied: false,
          serving: null,
          categories: {
            shotsPer60: {
              rankings: [
                {
                  playerId: 201,
                  percentile: 82,
                  gp: 5,
                  rank: 1,
                  previousRank: 5,
                  delta: 2.2,
                  latestValue: 1
                }
              ],
              series: {
                "201": [
                  { gp: 1, percentile: 72 },
                  { gp: 5, percentile: 82 }
                ]
              }
            }
          },
          playerMetadata: {
            "201": {
              id: 201,
              fullName: "William Nylander",
              position: "RW",
              teamAbbrev: "TOR",
              imageUrl: null
            }
          }
        },
        ownershipTrends: {
          selectedPlayers: [{ playerId: 201, name: "William Nylander", latest: 41, delta: 2 }]
        }
      }),
      goalieContext: moduleState("goalie_context", "Goalie Context", {
        asOfDate: "2026-03-14",
        requestedDate: "2026-03-14",
        fallbackApplied: false,
        serving: null,
        data: [
          {
            goalie_id: 301,
            goalie_name: "Frederik Andersen",
            team_abbreviation: "CAR",
            team_name: "Carolina Hurricanes",
            opponent_team_abbreviation: "NJD",
            opponent_team_name: "New Jersey Devils",
            starter_probability: 0.72,
            proj_shots_against: 29.5,
            proj_saves: 26.8,
            proj_goals_allowed: 2.7,
            proj_win_prob: 0.58,
            proj_shutout_prob: 0.04,
            modeled_save_pct: 0.908,
            volatility_index: 1.05,
            blowup_risk: 0.22,
            confidence_tier: "HIGH",
            quality_tier: "A",
            reliability_tier: "B",
            recommendation: "Start",
            starter_selection: null
          }
        ]
      }),
      runStatus: moduleState("run_status", "Run Status", null)
    }
  };
}

describe("Forge command center page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    routerState.query = {
      date: "2026-03-14",
      team: "CAR",
      position: "f",
      slate: "main",
      mode: "week"
    };
    routerState.asPath =
      "/forge/command-center?date=2026-03-14&mode=week&slate=main&team=CAR&position=f";
    routerState.isReady = true;
    routerState.replace.mockClear();
    loadCommandCenterDataMock.mockResolvedValue(buildCommandData());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders loaded module states, mixed-date warning, and context-preserving links", async () => {
    render(<ForgeCommandCenterPage />);

    expect(await screen.findByText("Power + CTPI")).toBeTruthy();
    expect(screen.getByText("Some command-center modules are serving fallback dates: 2026-03-13, 2026-03-14.")).toBeTruthy();
    expect(screen.getByText("Carolina Hurricanes")).toBeTruthy();
    expect(screen.getByText("Liam Marchenko")).toBeTruthy();
    expect(screen.getByText("Own 25-75%")).toBeTruthy();
    expect(screen.getAllByText("Own 25-50%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("William Nylander").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Frederik Andersen").length).toBeGreaterThan(0);

    const startChartLink = screen.getByRole("link", { name: "Start Chart" });
    expect(startChartLink.getAttribute("href")).toContain("/start-chart?date=2026-03-14");
    expect(startChartLink.getAttribute("href")).toContain("team=CAR");

    const playerLink = screen.getByRole("link", { name: /Liam Marchenko/ });
    expect(playerLink.getAttribute("href")).toContain("/forge/player/101");
    expect(playerLink.getAttribute("href")).toContain("mode=week");
  });

  it("updates filter state through shallow route replacement", async () => {
    render(<ForgeCommandCenterPage />);

    await screen.findByText("Power + CTPI");
    fireEvent.change(screen.getByLabelText("Position"), {
      target: { value: "d" }
    });

    await waitFor(() => {
      expect(routerState.replace).toHaveBeenCalledWith(
        expect.stringContaining("position=d"),
        undefined,
        { shallow: true, scroll: false }
      );
    });
  });

  it("preserves upstream error states when row-driven modules have no rows", async () => {
    const data = buildCommandData();
    data.modules.topAdds = {
      ...data.modules.topAdds,
      status: "error",
      error: "Request failed (500) for top adds",
      data: {
        ...data.modules.topAdds.data,
        forgePlayers: { data: [] },
        ownershipTrends: null
      }
    };
    data.modules.playerInsight = {
      ...data.modules.playerInsight,
      status: "error",
      error: "Request failed (500) for skater power",
      data: {
        ...data.modules.playerInsight.data,
        sustainable: { ...data.modules.playerInsight.data.sustainable, rows: [] },
        unsustainable: { ...data.modules.playerInsight.data.unsustainable, rows: [] },
        skaterTrends: {
          ...data.modules.playerInsight.data.skaterTrends,
          categories: {},
          playerMetadata: {}
        }
      }
    };
    data.modules.goalieContext = {
      ...data.modules.goalieContext,
      status: "error",
      error: "Request failed (500) for goalie context",
      data: { ...data.modules.goalieContext.data, data: [] }
    };
    loadCommandCenterDataMock.mockResolvedValue(data);

    render(<ForgeCommandCenterPage />);

    expect((await screen.findAllByText("Error")).length).toBe(3);
    expect(screen.getByText("Request failed (500) for top adds")).toBeTruthy();
    expect(screen.getByText("Request failed (500) for skater power")).toBeTruthy();
    expect(screen.getByText("Request failed (500) for goalie context")).toBeTruthy();
    expect(screen.queryByText("Empty")).toBeNull();
  });
});

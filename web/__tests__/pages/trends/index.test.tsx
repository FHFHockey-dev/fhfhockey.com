import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const teamTrendsFixture = vi.hoisted(() => ({
  value: { generatedAt: "", categories: {} } as any
}));

const dashboardStateFixture = vi.hoisted(() => ({
  sectionErrors: {} as Record<string, string>,
  loadingSections: [] as string[],
  sectionUpdatedAt: {} as Record<string, string>,
  sectionResolvedFor: {} as Record<string, string>,
  recency: {
    status: "aligned",
    gapDays: 0,
    sourceDates: {},
    warning: null
  } as any,
  retrySection: vi.fn()
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    query: { date: "2026-04-08" }
  })
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />
}));

vi.mock("next/link", () => ({
  default: ({ href, className, children }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null
}));

vi.mock("components/SurfaceWorkflowLinks", () => ({
  default: () => <div>workflow links</div>
}));

vi.mock("components/GoalieShareChart", () => ({
  default: () => <div>goalie share chart</div>
}));

vi.mock("hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    isLoading: false,
    error: null,
    loadingSections: dashboardStateFixture.loadingSections,
    sectionErrors: dashboardStateFixture.sectionErrors,
    retrySection: dashboardStateFixture.retrySection,
    data: {
      teamRatings: [],
      teamCtpi: { teams: [] },
      teamSos: { teams: [] },
      teamTrends: teamTrendsFixture.value,
      forgePlayers: { data: [] },
      forgeGoalies: { data: [] },
      startChart: { players: [], games: [] },
      goalieTrends: {
        playerMetadata: {
          "30": {
            id: 30,
            fullName: "Stable Goalie",
            position: "G",
            teamAbbrev: "CAR",
            imageUrl: null
          }
        },
        categories: {
          savePct: {
            rankings: [
              {
                playerId: 30,
                percentile: 91.2,
                gp: 10,
                rank: 1,
                previousRank: 2,
                delta: 1,
                latestValue: 0.921,
                sampleSize: 10,
                confidence: "high",
                volatility: 5.7
              }
            ],
            series: {
              "30": [
                { gp: 9, percentile: 85.5 },
                { gp: 10, percentile: 91.2 }
              ]
            }
          }
        }
      },
      sectionUpdatedAt: dashboardStateFixture.sectionUpdatedAt,
      sectionResolvedFor: dashboardStateFixture.sectionResolvedFor,
      recency: dashboardStateFixture.recency,
      teamMeta: {},
      skaterTrends: {
        playerMetadata: {
          "88": {
            id: 88,
            fullName: "Usage Driver",
            position: "C",
            teamAbbrev: "NJD",
            imageUrl: null
          },
          "91": {
            id: 91,
            fullName: "Shot Driver",
            position: "RW",
            teamAbbrev: "CAR",
            imageUrl: null
          },
          "92": {
            id: 92,
            fullName: "PP Quarterback",
            position: "D",
            teamAbbrev: "EDM",
            imageUrl: null
          },
          "93": {
            id: 93,
            fullName: "Chance Creator",
            position: "LW",
            teamAbbrev: "VAN",
            imageUrl: null
          }
        },
        categories: {
          timeOnIce: {
            rankings: [
              { playerId: 88, percentile: 94.1, delta: 4, latestValue: 21.4 }
            ]
          },
          shotsPer60: {
            rankings: [
              { playerId: 91, percentile: 93.2, delta: 3, latestValue: 11.2 }
            ]
          },
          powerPlayTime: {
            rankings: [
              { playerId: 92, percentile: 91.4, delta: 2, latestValue: 3.7 }
            ]
          },
          ixgPer60: {
            rankings: [
              { playerId: 93, percentile: 89.7, delta: 1, latestValue: 1.5 }
            ]
          }
        }
      },
      sustainability: {
        hot: { rows: [] },
        cold: { rows: [] }
      }
    }
  })
}));

vi.mock("lib/teamRatingsService", () => ({
  fetchTeamRatings: vi.fn(async () => [])
}));

vi.mock("lib/dashboard/teamContext", () => ({
  computeTeamPowerScore: vi.fn(() => 0)
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }
}));

import TrendsDashboardPage, {
  getServerSideProps
} from "../../../pages/trends/index";

describe("Trends dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    teamTrendsFixture.value = { generatedAt: "", categories: {} };
    dashboardStateFixture.sectionErrors = {};
    dashboardStateFixture.loadingSections = [];
    dashboardStateFixture.sectionUpdatedAt = {};
    dashboardStateFixture.sectionResolvedFor = {};
    dashboardStateFixture.recency = {
      status: "aligned",
      gapDays: 0,
      sourceDates: {},
      warning: null
    };
    dashboardStateFixture.retrySection.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders recent-form summary cards and goalie workload context", () => {
    render(<TrendsDashboardPage initialDate="2026-04-08" />);

    expect(screen.getByText("Recent-Form Scan")).toBeTruthy();
    expect(screen.getByText("Usage Driver")).toBeTruthy();
    expect(screen.getByText("Shot Driver")).toBeTruthy();
    expect(screen.getByText(/Last Year stays out of strong v1/i)).toBeTruthy();
    expect(screen.getByText("Goalie Workload Share")).toBeTruthy();
    expect(screen.getByText("goalie share chart")).toBeTruthy();
    expect(screen.getByText("No team trend history yet.")).toBeTruthy();
    expect(screen.getByText("Source update unavailable")).toBeTruthy();
  });

  it("uses a valid query date as the server-rendered dashboard date", async () => {
    await expect(
      getServerSideProps({ query: { date: "2026-04-08" } } as any)
    ).resolves.toEqual({ props: { initialDate: "2026-04-08" } });
  });

  it("renders team rankings, movers, deltas, sample context, and source freshness", () => {
    teamTrendsFixture.value = {
      generatedAt: "2026-04-08T15:00:00.000Z",
      categories: {
        offense: {
          rankings: [
            {
              team: "CAR",
              percentile: 88.5,
              gp: 78,
              rank: 1,
              previousRank: 3,
              delta: 4.5
            },
            {
              team: "ANA",
              percentile: 24.2,
              gp: 78,
              rank: 32,
              previousRank: 29,
              delta: -3.2
            }
          ],
          series: {
            CAR: [
              { gp: 77, percentile: 84 },
              { gp: 78, percentile: 88.5 }
            ],
            ANA: [
              { gp: 77, percentile: 27.4 },
              { gp: 78, percentile: 24.2 }
            ]
          }
        }
      }
    };

    render(<TrendsDashboardPage initialDate="2026-04-08" />);

    expect(screen.getByText("Team Risers And Fallers")).toBeTruthy();
    expect(screen.getByText("Most Improved (last 5 GP)")).toBeTruthy();
    expect(screen.getByText("Most Degraded (last 5 GP)")).toBeTruthy();
    expect(screen.getAllByText("CAR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ANA").length).toBeGreaterThan(0);
    expect(screen.getByText("▲4.5%")).toBeTruthy();
    expect(screen.getByText("▼3.2%")).toBeTruthy();
    expect(screen.getByText("Rolling percentile by games played")).toBeTruthy();
    expect(screen.getByText("Source updated 2026-04-08")).toBeTruthy();
  });

  it("keeps stale section data visible with source context and a scoped retry", () => {
    dashboardStateFixture.sectionErrors = {
      team: "team sources are temporarily unavailable"
    };
    dashboardStateFixture.sectionUpdatedAt = {
      team: "2026-04-08T15:30:00.000Z"
    };
    dashboardStateFixture.sectionResolvedFor = { team: "2026-04-08" };

    render(<TrendsDashboardPage initialDate="2026-04-09" />);

    expect(
      screen.getByText(/Showing the last successful data from 2026-04-08 15:30/i)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry Team trends" }));
    expect(dashboardStateFixture.retrySection).toHaveBeenCalledWith("team");
  });

  it("shows goalie confidence and downgrades mixed-date context", () => {
    dashboardStateFixture.recency = {
      status: "mixed",
      gapDays: 19,
      sourceDates: { teamPower: "2026-03-20", startChart: "2026-04-08" },
      warning:
        "Source dates are not safely aligned; projection and start context is downgraded until the feeds converge."
    };

    render(<TrendsDashboardPage initialDate="2026-04-08" />);
    fireEvent.click(screen.getByRole("tab", { name: "Goalies" }));

    expect(screen.getByText(/high confidence \(10 GP\)/i)).toBeTruthy();
    expect(screen.getByText(/volatility 5.7/i)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(
      /Observed source-date gap:\s*19\s*days/i
    );
    expect(screen.getAllByText(/downgraded/i).length).toBeGreaterThan(0);
  });
});

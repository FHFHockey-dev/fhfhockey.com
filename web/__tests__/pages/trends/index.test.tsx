import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
    data: {
      teamRatings: [],
      teamCtpi: { teams: [] },
      teamSos: { teams: [] },
      teamTrends: { categories: {} },
      forgePlayers: { data: [] },
      forgeGoalies: { data: [] },
      startChart: { players: [], games: [] },
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

import TrendsDashboardPage from "../../../pages/trends/index";

describe("Trends dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders recent-form summary cards and goalie workload context", () => {
    render(<TrendsDashboardPage initialDate="2026-04-08" initialTeamRatings={[]} />);

    expect(screen.getByText("Recent-Form Scan")).toBeTruthy();
    expect(screen.getByText("Usage Driver")).toBeTruthy();
    expect(screen.getByText("Shot Driver")).toBeTruthy();
    expect(screen.getByText(/Last Year stays out of strong v1/i)).toBeTruthy();
    expect(screen.getByText("Goalie Workload Share")).toBeTruthy();
    expect(screen.getByText("goalie share chart")).toBeTruthy();
  });
});

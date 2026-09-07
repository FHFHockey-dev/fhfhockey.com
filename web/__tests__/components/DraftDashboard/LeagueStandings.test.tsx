import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LeagueStandings from "../../../components/DraftDashboard/LeagueStandings";

afterEach(cleanup);

const teams = [
  {
    teamId: "Team 1",
    teamName: "Estimated",
    owner: "Team 1",
    projectedPoints: 100,
    categoryTotals: { GOALS_AGAINST_AVERAGE: 2.5 },
    categoryAggregateQuality: { GOALS_AGAINST_AVERAGE: "estimated" as const },
    rosterSlots: {},
    bench: [],
    teamVorp: 12,
  },
  {
    teamId: "Team 2",
    teamName: "Unavailable",
    owner: "Team 2",
    projectedPoints: 90,
    categoryTotals: { GOALS_AGAINST_AVERAGE: null },
    categoryAggregateQuality: { GOALS_AGAINST_AVERAGE: "unavailable" as const },
    rosterSlots: {},
    bench: [],
    teamVorp: 8,
  },
];

describe("LeagueStandings rate quality", () => {
  it("visibly and accessibly marks estimated and unavailable rates", () => {
    render(
      <LeagueStandings
        teams={teams}
        categories={{ GOALS_AGAINST_AVERAGE: 1 }}
        leagueType="categories"
        myTeamId="Team 1"
        vorpMetrics={new Map()}
        onUpdateTeamName={vi.fn()}
        canEdit
        isLoading={false}
        error={null}
      />,
    );

    expect(
      screen.getByLabelText("Estimated team rate based on projected workload")
        .textContent,
    ).toBe("≈");
    expect(screen.getByLabelText("Unavailable team rate").textContent).toBe(
      "N/A",
    );
  });

  it("keeps rendered team totals independent of player-analysis metrics", () => {
    const { rerender } = render(
      <LeagueStandings
        teams={teams}
        categories={{ GOALS: 1 }}
        leagueType="points"
        myTeamId="Team 1"
        vorpMetrics={new Map([["1", { value: 400 } as any]])}
        onUpdateTeamName={vi.fn()}
        canEdit
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("12.0")).toBeTruthy();
    expect(screen.getByText("100.0")).toBeTruthy();
    rerender(
      <LeagueStandings
        teams={teams}
        categories={{ GOALS: 1 }}
        leagueType="points"
        myTeamId="Team 1"
        vorpMetrics={new Map([["1", { value: 999 } as any]])}
        onUpdateTeamName={vi.fn()}
        canEdit
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByText("12.0")).toBeTruthy();
    expect(screen.getByText("100.0")).toBeTruthy();
  });
});

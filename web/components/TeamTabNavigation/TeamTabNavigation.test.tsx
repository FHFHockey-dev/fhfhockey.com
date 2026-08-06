import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calendarPropsMock, routerState, useTeamScheduleMock } = vi.hoisted(
  () => ({
    calendarPropsMock: vi.fn(),
    routerState: {
      isReady: true,
      pathname: "/teams/[teamAbbrev]",
      query: { tab: "schedule" } as { tab?: string | string[] },
      replace: vi.fn(),
    },
    useTeamScheduleMock: vi.fn(),
  }),
);

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("hooks/useTeamSchedule", () => ({
  useTeamSchedule: useTeamScheduleMock,
}));

vi.mock("../TeamDashboard/TeamDashboard", () => ({
  TeamDashboard: () => <div>Team dashboard</div>,
}));

vi.mock("../GameStateAnalysis/GameStateAnalysis", () => ({
  GameStateAnalysis: () => <div>Game-state analysis</div>,
}));

vi.mock("../MetricsTimeline/MetricsTimeline", () => ({
  default: () => <div>Metrics timeline</div>,
}));

vi.mock("../RosterMatrix/RosterMatrixWrapper", () => ({
  default: () => <div>Roster matrix</div>,
}));

vi.mock("../ShotVisualization/ShotVisualization", () => ({
  ShotVisualization: () => <div>Shot visualization</div>,
}));

vi.mock("../LineCombinations/LineCombinationsGrid", () => ({
  LineCombinationsGrid: () => <div>Line combinations</div>,
}));

vi.mock("../TeamScheduleCalendar/TeamScheduleCalendar", () => ({
  TeamScheduleCalendar: (props: {
    teamId: number | string;
    teamAbbreviation: string;
    seasonId: string;
    standingsDetails?: { team_abbrev: string } | null;
  }) => {
    calendarPropsMock(props);
    return (
      <div
        data-testid="team-schedule-calendar"
        data-team-id={props.teamId}
        data-team-abbreviation={props.teamAbbreviation}
      />
    );
  },
}));

import { TeamTabNavigation } from "./TeamTabNavigation";

const baseScheduleResult = {
  games: [],
  loading: false,
  error: null,
  record: null,
  standingsDetails: null,
};

const baseProps = {
  filters: {},
  onFilterChange: vi.fn(),
};

describe("TeamTabNavigation schedule identity", () => {
  beforeEach(() => {
    routerState.isReady = true;
    routerState.pathname = "/teams/[teamAbbrev]";
    routerState.query = { tab: "schedule" };
    routerState.replace.mockReset();
    calendarPropsMock.mockReset();
    useTeamScheduleMock.mockReset();
  });

  afterEach(() => cleanup());

  it("forwards the synchronous Arizona source identity for canonical Utah's 2023-24 schedule", () => {
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      scheduleTeam: { id: 53, abbreviation: "ARI" },
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="68"
        teamAbbrev="UTA"
        seasonId="20232024"
      />,
    );

    expect(useTeamScheduleMock).toHaveBeenCalledWith("UTA", "20232024", "68");
    expect(screen.getByTestId("team-schedule-calendar")).toBeTruthy();

    const firstCalendarProps = calendarPropsMock.mock.calls[0]?.[0];
    expect(firstCalendarProps).toMatchObject({
      teamId: 53,
      teamAbbreviation: "ARI",
      seasonId: "20232024",
    });
    expect(calendarPropsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 68,
        teamAbbreviation: "UTA",
      }),
    );
  });

  it("preserves an ordinary current-team schedule identity", () => {
    const standingsDetails = { team_abbrev: "EDM" };
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      standingsDetails,
      scheduleTeam: { id: 22, abbreviation: "EDM" },
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="22"
        teamAbbrev="EDM"
        seasonId="20252026"
      />,
    );

    expect(useTeamScheduleMock).toHaveBeenCalledWith("EDM", "20252026", "22");
    expect(calendarPropsMock.mock.calls[0]?.[0]).toMatchObject({
      teamId: 22,
      teamAbbreviation: "EDM",
      seasonId: "20252026",
      standingsDetails,
    });
  });

  it("does not mount the calendar before a validated schedule identity exists", () => {
    useTeamScheduleMock.mockReturnValue({
      ...baseScheduleResult,
      loading: true,
      scheduleTeam: null,
    });

    render(
      <TeamTabNavigation
        {...baseProps}
        teamId="68"
        teamAbbrev="UTA"
        seasonId="20232024"
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Loading schedule...");
    expect(screen.queryByTestId("team-schedule-calendar")).toBeNull();
    expect(calendarPropsMock).not.toHaveBeenCalled();
  });
});

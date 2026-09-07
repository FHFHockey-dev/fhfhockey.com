import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import DustMatrix from "../../../components/DraftDashboard/DustMatrix";
import MyRoster from "../../../components/DraftDashboard/MyRoster";

vi.mock("components/PlayerAutocomplete", () => ({ default: () => null }));
vi.mock("hooks/usePlayerRecommendations", () => ({
  usePlayerRecommendations: () => ({ recommendations: [] }),
}));

afterEach(cleanup);

it("shows full eligibility independently of assigned slots, including bench players", () => {
  const props = {
    myTeamId: "1",
    nextPickByTeam: { "1": 4 },
    scheduleState: { status: "idle" },
    teamStatsList: [
      {
        teamId: "1",
        teamName: "My team",
        projectedPoints: 100,
        rosterSlots: { RW: [{ playerId: "11" }] },
        bench: [{ playerId: "12" }],
      },
    ],
    draftSettings: {
      teamCount: 2,
      rosterConfig: { LW: 1, RW: 1, D: 1, bench: 1 },
    },
    availablePlayers: [],
    allPlayers: [
      {
        playerId: 11,
        fullName: "Flexible winger",
        displayPosition: "RW",
        eligiblePositions: ["LW", "RW", "UTIL", "BN"],
        displayTeam: "CAR",
      },
      {
        playerId: 12,
        fullName: "Bench forward",
        displayPosition: "C, LW",
        displayTeam: "EDM",
      },
    ],
    onDraftPlayer: vi.fn(),
    canDraft: true,
    currentPick: 3,
    currentTurn: { round: 2, pickInRound: 1, teamId: "2", isMyTurn: false },
    teamOptions: [{ id: "1", label: "My team" }],
  } as unknown as ComponentProps<typeof MyRoster>;

  render(<MyRoster {...props} />);
  const assignedSlot = screen.getByRole("button", {
    name: "RW 1: Flexible winger",
  });
  expect(
    within(assignedSlot).getByTitle("Eligible positions: LW/RW").textContent,
  ).toBe("LW/RW");
  expect(screen.getByTitle("Eligible positions: C/LW").textContent).toBe(
    "C/LW",
  );
  expect(
    within(screen.getByRole("button", { name: "LW 1: Open" })).queryByTitle(
      /Eligible positions/,
    ),
  ).toBeNull();
});

it("shows and explains the roster DUST rate", () => {
  const props = {
    myTeamId: "1",
    nextPickByTeam: { "1": 1 },
    scheduleState: {
      status: "ready",
      baseline: {
        totalScheduledGames: 40,
        totalStartableGames: 35,
        totalBenchGames: 5,
        dustRate: 0.125,
      },
    },
    teamStatsList: [
      {
        teamId: "1",
        teamName: "My team",
        projectedPoints: 0,
        rosterSlots: {},
        bench: [],
      },
    ],
    draftSettings: {
      teamCount: 1,
      rosterConfig: { bench: 0 },
    },
    availablePlayers: [],
    allPlayers: [],
    onDraftPlayer: vi.fn(),
    canDraft: true,
    currentPick: 1,
    currentTurn: { round: 1, pickInRound: 1, teamId: "1", isMyTurn: true },
    teamOptions: [{ id: "1", label: "My team" }],
  } as unknown as ComponentProps<typeof MyRoster>;

  render(<MyRoster {...props} />);

  const dustMetric = screen.getByLabelText("DUST 13 percent");
  const tooltipId = dustMetric.getAttribute("aria-describedby");
  expect(dustMetric.tagName).toBe("BUTTON");
  expect(document.getElementById(tooltipId!)?.textContent).toContain(
    "Daily Unstartable Schedule Tax",
  );
});


it("shows every Yahoo week at once, highlights playoff weeks, and keeps baseline data unchanged", () => {
  const weeks = Array.from({ length: 27 }, (_, index) => ({ week: index + 1, start_date: "2027-02-01", end_date: "2027-02-14" }));
  const baseline = {
    complete: true,
    players: [{ playerId: "1", playerName: "Winger", benchGames: 2 }, { playerId: "2", playerName: "Goalie", benchGames: 0 }],
    daily: weeks.flatMap((week) => [
      { yahooWeek: week.week, scheduledPlayerIds: ["1"], assignments: [], benchedPlayerIds: week.week === 24 ? ["1"] : [], unresolvedPlayers: [] },
      { yahooWeek: week.week, scheduledPlayerIds: ["2"], assignments: [], benchedPlayerIds: [], unresolvedPlayers: week.week === 27 ? [{ playerId: "2" }] : [] },
    ]),
  };
  const before = JSON.stringify(baseline);
  const { container } = render(<DustMatrix state={{ status: "ready", stale: false, baseline } as any} weeks={weeks} selectedWeeks={[weeks[23], weeks[26]]} period="Playoffs · Weeks 24, 27" />);
  const toggle = screen.getByRole("button", { name: /DUST schedule overview/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelectorAll("[data-dust-state]")).toHaveLength(54);
  const cell = container.querySelector('[data-selected-week][data-dust-state="bench"]')!;
  expect(cell.getAttribute("data-selected-week")).toBe("true");
  expect(container.querySelector('[data-dust-state="zero"]')?.getAttribute("data-selected-week")).toBeNull();
  expect(container.querySelector('[data-dust-state="unresolved"]')).toBeTruthy();
  fireEvent.focus(within(cell as HTMLElement).getByRole("button"));
  expect(screen.getByRole("status").textContent).toContain("1 benched");
  expect(JSON.stringify(baseline)).toBe(before);
});

it("keeps an unknown-team roster player as unavailable intersections", () => {
  const weeks = Array.from({ length: 27 }, (_, index) => ({ week: index + 1, start_date: "2027-02-01", end_date: "2027-02-14" }));
  const baseline = {
    complete: false,
    players: [{ playerId: "1", playerName: "Known", benchGames: 0 }],
    daily: [],
    diagnostics: [{ code: "UNKNOWN_TEAM", severity: "error", playerId: "2", playerName: "Unknown" }],
  };
  const { container } = render(<DustMatrix state={{ status: "ready", stale: false, baseline } as any} weeks={weeks} roster={[{ playerId: "1", playerName: "Known" }, { playerId: "2", playerName: "Unknown" }]} period="Season" />);
  fireEvent.click(screen.getByRole("button", { name: /DUST schedule overview/ }));
  expect(container.querySelectorAll("[data-dust-state=unresolved]")).toHaveLength(54);
  expect(screen.getByText("W1 Unavailable", { exact: true })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Unknown · Week 27.*coverage unavailable/ })).toHaveLength(2);
});

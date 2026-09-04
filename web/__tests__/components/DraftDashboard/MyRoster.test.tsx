import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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
  expect(dustMetric.getAttribute("tabindex")).toBe("0");
  expect(document.getElementById(tooltipId!)?.textContent).toContain(
    "Daily Unstartable Schedule Tax",
  );
});

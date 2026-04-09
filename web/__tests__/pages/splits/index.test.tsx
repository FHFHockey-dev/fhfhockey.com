import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const replaceMock = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/splits",
    query: {
      team: "EDM",
      opponent: "VAN",
      playerId: "97",
    },
    replace: replaceMock,
  }),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: {
      generatedAt: "2026-04-08T12:00:00.000Z",
      seasonId: 20252026,
      selection: {
        teamAbbreviation: "EDM",
        opponentAbbreviation: "VAN",
        playerId: 97,
      },
      playerOptions: [
        {
          playerId: 97,
          playerName: "Connor McDavid",
          positionCode: "C",
        },
      ],
      matchupCards: [
        {
          key: "shots",
          label: "L10 Shot Pressure",
          description: "Shot context",
          teamValue: 33.1,
          opponentValue: 29.8,
          teamCaption: "Team SF/GP",
          opponentCaption: "Opp SA/GP",
          edge: "favorable",
        },
      ],
      teamLeaders: [
        {
          playerId: 97,
          playerName: "Connor McDavid",
          positionCode: "C",
          teamLabel: "EDM",
          fantasyPulse: 18.4,
          shotsPer60: 9.8,
          totalPointsPer60: 4.6,
          ixgPer60: 1.2,
          ppShotSharePct: 0.36,
        },
      ],
      ppShotShare: [
        {
          playerId: 97,
          playerName: "Connor McDavid",
          positionCode: "C",
          ppShots: 18,
          ppShotSharePct: 0.36,
        },
      ],
      playerVsTeam: {
        playerId: 97,
        playerName: "Connor McDavid",
        teamLabel: "EDM",
        opponentLabel: "VAN",
        season: {
          gamesPlayed: 70,
          toiPerGameSeconds: 1300,
          shotsPer60: 9.8,
          totalPointsPer60: 4.6,
          ixgPer60: 1.2,
          goalsPer60: 1.4,
          ppShotSharePct: 0.36,
        },
        versusOpponent: {
          gamesPlayed: 4,
          toiPerGameSeconds: 1320,
          shotsPer60: 10.4,
          totalPointsPer60: 5.1,
          ixgPer60: 1.5,
          goalsPer60: 1.8,
          ppShotSharePct: 0.36,
        },
      },
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("components/SurfaceWorkflowLinks", () => ({
  default: () => <div>workflow links</div>,
}));

import SplitsPage from "../../../pages/splits/index";

describe("Splits page", () => {
  it("renders the team leaders, matchup context, and player comparison sections", () => {
    render(<SplitsPage />);

    expect(screen.getByText("Splits & Matchup Context")).toBeTruthy();
    expect(screen.getByText("workflow links")).toBeTruthy();
    expect(screen.getByText("Team Leaders")).toBeTruthy();
    expect(screen.getByText("Power-Play Shot Share")).toBeTruthy();
    expect(screen.getByText("Team vs Team")).toBeTruthy();
    expect(screen.getByText("Player vs Team")).toBeTruthy();
    expect(screen.getAllByText("Connor McDavid").length).toBeGreaterThan(1);
    expect(screen.getByText("L10 Shot Pressure")).toBeTruthy();
    expect(screen.getByText("Versus VAN")).toBeTruthy();
  });
});

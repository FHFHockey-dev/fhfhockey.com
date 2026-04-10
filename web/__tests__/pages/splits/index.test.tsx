import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const replaceMock = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/splits",
    query: {
      team: "EDM",
    },
    replace: replaceMock,
  }),
}));

const landingData = {
  generatedAt: "2026-04-10T12:00:00.000Z",
  seasonId: 20252026,
  teamOptions: [
    { abbreviation: "ANA", name: "Anaheim Ducks" },
    { abbreviation: "BOS", name: "Boston Bruins" },
    { abbreviation: "EDM", name: "Edmonton Oilers" },
  ],
  selection: {
    teamAbbreviation: null,
    opponentAbbreviation: null,
    effectiveOpponentAbbreviation: null,
  },
  landing: {
    topSkaters: [
      {
        playerId: 97,
        playerName: "Connor McDavid",
        teamAbbreviation: "EDM",
        opponentAbbreviation: "SJS",
        positionCode: "C",
        gamesPlayed: 4,
        goals: 3,
        assists: 6,
        points: 9,
        pointsPerGame: 2.25,
      },
    ],
    topGoalies: [
      {
        playerId: 30,
        playerName: "Stuart Skinner",
        teamAbbreviation: "EDM",
        opponentAbbreviation: "ANA",
        gamesPlayed: 3,
        shotsAgainst: 92,
        goalsAgainst: 4,
        savePct: 0.957,
      },
    ],
  },
  ppShotShare: [],
  roster: null,
};

const rosterData = {
  generatedAt: "2026-04-10T12:00:00.000Z",
  seasonId: 20252026,
  teamOptions: landingData.teamOptions,
  selection: {
    teamAbbreviation: "EDM",
    opponentAbbreviation: null,
    effectiveOpponentAbbreviation: "ANA",
  },
  landing: {
    topSkaters: [],
    topGoalies: [],
  },
  ppShotShare: [],
  roster: {
    skaters: [
      {
        playerId: 97,
        playerName: "Connor McDavid",
        positionCode: "C",
        gamesPlayed: 4,
        averageToiSeconds: 1320,
        goals: 3,
        assists: 6,
        points: 9,
        pointsPerGame: 2.25,
        shotsOnGoal: 18,
        shootingPct: 0.167,
        powerPlayToiSecondsPerGame: 260,
        powerPlayPct: 0.197,
        powerPlayGoals: 1,
        powerPlayAssists: 3,
        powerPlayPoints: 4,
        plusMinus: 4,
        pim: 2,
        faceoffWinPct: 0.561,
        hits: 3,
        blocks: 2,
      },
    ],
    goalies: [
      {
        playerId: 30,
        playerName: "Stuart Skinner",
        gamesPlayed: 3,
        gamesStarted: 3,
        wins: 2,
        losses: 0,
        otl: 1,
        goalsAllowed: 4,
        shotsAgainst: 92,
        savePct: 0.957,
        goalsAllowedAverage: 1.33,
        shutouts: 1,
        qualityStarts: 2,
        qualityStartsPct: 0.667,
      },
    ],
  },
};

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (key === "/api/v1/splits") {
      return {
        data: landingData,
        error: null,
        isLoading: false,
      };
    }

    if (key === "/api/v1/splits?team=EDM&mode=roster") {
      return {
        data: rosterData,
        error: null,
        isLoading: false,
      };
    }

    return {
      data: null,
      error: null,
      isLoading: false,
    };
  },
}));

import SplitsPage from "../../../pages/splits/index";

describe("Splits page", () => {
  it("renders the team roster view without landing leaderboards", () => {
    render(<SplitsPage />);

    expect(screen.getByText("Team Roster vs Opponent")).toBeTruthy();
    expect(screen.getByText("Related Surfaces")).toBeTruthy();
    expect(screen.queryByText("Top Skaters vs Any Team")).toBeNull();
    expect(screen.queryByText("Top Goalies vs Any Team")).toBeNull();
    expect(screen.getByText("Skaters")).toBeTruthy();
    expect(screen.getByText("Goalies")).toBeTruthy();
    expect(screen.getByText("Connor McDavid")).toBeTruthy();
    expect(screen.getByText("Stuart Skinner")).toBeTruthy();
    expect(screen.getByText("EDM vs ANA")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Show EDM splits versus ANA",
      })
    ).toBeTruthy();
  });
});

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamDataWithTotals } from "lib/NHL/types";
import FourWeekGrid from "./FourWeekGrid";

vi.mock("hooks/useTeams", () => ({
  useTeamsMap: () => ({
    1: { id: 1, name: "Alpha", abbreviation: "ALP", logo: "/alpha.png" },
    2: { id: 2, name: "Beta", abbreviation: "BET", logo: "/beta.png" },
  }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

const teams: TeamDataWithTotals[] = [
  {
    teamId: 1,
    teamAbbreviation: "ALP",
    weeks: [
      {
        weekNumber: 1,
        gamesPlayed: 3,
        offNights: 2,
        opponents: [{ abbreviation: "BOS", teamId: 6 }],
      },
      {
        weekNumber: 2,
        gamesPlayed: 4,
        offNights: 1,
        opponents: [{ abbreviation: "NYR", teamId: 3 }],
      },
    ],
    totals: {
      gamesPlayed: 7,
      offNights: 3,
      opponents: [
        { abbreviation: "BOS", teamId: 6 },
        { abbreviation: "NYR", teamId: 3 },
      ],
    },
    avgOpponentPointPct: 0.55,
  },
  {
    teamId: 2,
    teamAbbreviation: "BET",
    weeks: [
      {
        weekNumber: 1,
        gamesPlayed: 2,
        offNights: 0,
        opponents: [{ abbreviation: "TOR", teamId: 10 }],
      },
    ],
    totals: {
      gamesPlayed: 2,
      offNights: 0,
      opponents: [{ abbreviation: "TOR", teamId: 10 }],
    },
    avgOpponentPointPct: 0.48,
  },
];

describe("FourWeekGrid", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
  });

  it("keeps the familiar summary as default and reveals weekly volume/opponents", () => {
    render(<FourWeekGrid teamDataArray={teams} />);

    expect(
      screen
        .getByRole("tab", { name: "4W Summary" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Sort by Games Played/ }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open Alpha Team HQ" })
        .getAttribute("href"),
    ).toBe("/stats/team/ALP");

    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));

    expect(
      screen
        .getByRole("tab", { name: "Weekly Detail" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("columnheader", { name: "W1" })).toBeTruthy();
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText("No games")).toBeTruthy();
  });

  it("preserves summary sorting when users inspect the alternate tab", () => {
    render(<FourWeekGrid teamDataArray={teams} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Sort by Games Played descending/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Weekly Detail" }));
    fireEvent.click(screen.getByRole("tab", { name: "4W Summary" }));

    expect(
      screen.getByRole("button", { name: /Sort by Games Played ascending/ }),
    ).toBeTruthy();
  });
});

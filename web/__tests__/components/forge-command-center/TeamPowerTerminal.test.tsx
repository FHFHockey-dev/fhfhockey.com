import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TeamPowerTerminal from "components/forge-command-center/TeamPowerTerminal";

afterEach(cleanup);

const rating = (teamAbbr: string, offRating: number, defRating: number, trend10: number) => ({
  teamAbbr, date: "2026-03-14", offRating, defRating, paceRating: 100, ppTier: 2, pkTier: 2, trend10,
  finishingRating: 100, goalieRating: 70, dangerRating: null, specialRating: null, disciplineRating: null, varianceFlag: 0
});

const moduleOf = <T,>(data: T) => ({
  status: "ready" as const, data, requestedDate: "2026-03-14", resolvedDate: "2026-03-14",
  fallbackApplied: false, message: null, error: null, contract: { id: "x", label: "x" } as never
});

const renderTerminal = () => render(
  <TeamPowerTerminal
    module={moduleOf({
      ratings: [
        rating("AAA", 130, 120, 0.5), // strongest, tiny riser
        rating("BBB", 100, 100, 6), // average, biggest riser
        rating("CCC", 90, 95, -4)
      ],
      ctpi: { teams: [] }
    }) as never}
    slateModule={moduleOf({ games: [] }) as never}
    selectedTeam="AAA"
    teamHref={(team) => `/forge/team/${team}`}
  />
);

describe("Team Power Terminal (W1 P0 #22, decision 58)", () => {
  it("draws ratings on a diverging bar centred at 100, never saturated as a percentile", () => {
    renderTerminal();
    const offense = screen.getByTestId("rating-bar-Offense");
    expect(offense.style.marginLeft).toBe("50%");
    expect(offense.style.width).toBe("50%"); // 130 = +2 SD reaches the edge
    expect(screen.queryByTestId("rating-bar-Pace")!.style.width).toBe("0%"); // exactly average
    const goalie = screen.getByTestId("rating-bar-5v5 Goalie");
    expect(goalie.style.marginLeft).toBe("0%");
    expect(goalie.style.width).toBe("50%");
  });

  it("orders risers by actual change, not by power", () => {
    renderTerminal();
    const risers = screen.getByLabelText(/risers/i);
    const links = within(risers).getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(["BBB", "AAA"]);
  });

  it("shows no synthetic trend line without real history", () => {
    const { container } = renderTerminal();
    expect(screen.getByText("Power history unavailable")).toBeTruthy();
    expect(container.querySelector("svg polyline")).toBeNull();
  });
});

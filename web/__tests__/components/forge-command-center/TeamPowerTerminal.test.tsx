import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TeamPowerTerminal from "components/forge-command-center/TeamPowerTerminal";

afterEach(cleanup);

const V4 = "team-power-v4-5v5-goaltending";

const rating = (
  teamAbbr: string,
  offRating: number,
  defRating: number,
  trend10: number,
  version: { calculationVersion?: string | null; sourceThroughDate?: string | null } = {
    calculationVersion: V4,
    sourceThroughDate: "2026-03-13"
  }
) => ({
  teamAbbr, date: "2026-03-14", offRating, defRating, paceRating: 100, ppTier: 2, pkTier: 2, trend10,
  finishingRating: 100, goalieRating: 70, dangerRating: null, specialRating: null, disciplineRating: null, varianceFlag: 0,
  ...version
});

const moduleOf = <T,>(data: T) => ({
  status: "ready" as const, data, requestedDate: "2026-03-14", resolvedDate: "2026-03-14",
  fallbackApplied: false, message: null, error: null, contract: { id: "x", label: "x" } as never
});

const renderTerminal = (
  selectedTeam = "AAA",
  ratings = [
    rating("AAA", 130, 120, 0.5), // strongest, tiny riser
    rating("BBB", 100, 100, 6), // average, biggest riser
    rating("CCC", 90, 95, -4)
  ]
) => render(
  <TeamPowerTerminal
    module={moduleOf({ ratings, ctpi: { teams: [] } }) as never}
    slateModule={moduleOf({ games: [] }) as never}
    selectedTeam={selectedTeam}
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

  it("labels goaltending 5v5 only on a verified v4 row (Astra #434 P1)", () => {
    const mixed = [
      rating("AAA", 130, 120, 0.5),
      rating("BBB", 100, 100, 6, {
        calculationVersion: "team-power-v3-all-team-baseline-prior-after-norm-pooled-st",
        sourceThroughDate: "2026-03-13"
      }),
      rating("CCC", 90, 95, -4, {
        calculationVersion: "legacy_unversioned",
        sourceThroughDate: "2026-08-29"
      }),
      rating("DDD", 95, 95, 0, { calculationVersion: null, sourceThroughDate: null })
    ];

    renderTerminal("AAA", mixed);
    expect(screen.getByTestId("rating-bar-5v5 Goalie")).toBeTruthy();
    expect(screen.queryByText("Goalie calc")).toBeNull();
    cleanup();

    for (const [team, note] of [
      ["BBB", "all situations, v3"],
      ["CCC", "carried from 2025-26 · as of Aug 29"],
      ["DDD", "version unverified"]
    ] as const) {
      renderTerminal(team, mixed);
      expect(screen.getByTestId("rating-bar-Goalie")).toBeTruthy();
      expect(screen.queryByText(/5v5/i)).toBeNull();
      expect(screen.getByText("Goalie calc")).toBeTruthy();
      expect(screen.getByText(note)).toBeTruthy();
      cleanup();
    }
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

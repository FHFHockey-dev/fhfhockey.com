import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchCachedJsonMock } = vi.hoisted(() => ({ fetchCachedJsonMock: vi.fn() }));

vi.mock("lib/dashboard/clientFetchCache", () => ({
  fetchCachedJson: fetchCachedJsonMock
}));

import TeamPowerCard from "components/forge-dashboard/TeamPowerCard";

const V4 = "team-power-v4-5v5-goaltending";
const V3 = "team-power-v3-all-team-baseline-prior-after-norm-pooled-st";

// Served /api/team-ratings rows (camelCase, from teamRatingsService).
const rating = (
  teamAbbr: string,
  offRating: number,
  calculationVersion: string | null,
  sourceThroughDate: string | null
) => ({
  teamAbbr,
  date: "2026-09-30",
  offRating,
  defRating: 100,
  paceRating: 100,
  ppTier: 2,
  pkTier: 2,
  trend10: 0,
  finishingRating: 100,
  goalieRating: 104,
  dangerRating: null,
  specialRating: null,
  disciplineRating: null,
  varianceFlag: 0,
  calculationVersion,
  sourceThroughDate
});

const renderCard = async (ratings: unknown[]) => {
  fetchCachedJsonMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/team-ratings")) return ratings;
    throw new Error("not needed");
  });
  render(<TeamPowerCard date="2026-09-30" team="all" />);
  const table = await screen.findByRole("table");
  const header = within(table)
    .getAllByRole("columnheader")
    .find((cell) => /goalie/i.test(cell.textContent ?? ""))!;
  const goalieCell = (team: string) => {
    const row = within(table).getByRole("link", { name: team }).closest("tr")!;
    const index = within(table).getAllByRole("columnheader").indexOf(header);
    return row.querySelectorAll("td")[index]!;
  };
  return { header, goalieCell };
};

afterEach(() => {
  cleanup();
  fetchCachedJsonMock.mockReset();
});

describe("TeamPowerCard goaltending labels (Astra #434 P1)", () => {
  it("tags each value when the shown rows mix calculation versions", async () => {
    const { header, goalieCell } = await renderCard([
      rating("TOR", 120, V4, "2026-09-29"),
      rating("VAN", 115, V3, "2026-09-29"),
      rating("SEA", 110, "legacy_unversioned", "2026-08-29"),
      rating("UTA", 105, null, null)
    ]);

    expect(header.textContent).toBe("Goalie");
    expect(goalieCell("TOR").textContent).toBe("104.05v5");
    expect(goalieCell("VAN").textContent).toBe("104.0all sit. · v3");
    expect(goalieCell("SEA").textContent).toBe("104.0carried · Aug 29");
    expect(goalieCell("UTA").textContent).toBe("104.0unverified");
    expect(within(goalieCell("SEA")).getByTitle(/Carried from 2025-26/)).toBeTruthy();
  });

  it("says 5v5 in the header only when every shown value is verified v4", async () => {
    const v3 = await renderCard([
      rating("TOR", 120, V3, "2026-11-12"),
      rating("VAN", 115, V3, "2026-11-12")
    ]);
    expect(v3.header.textContent).toBe("Goalieall sit. · v3");
    expect(v3.goalieCell("TOR").textContent).toBe("104.0");
    cleanup();

    const v4 = await renderCard([
      rating("TOR", 120, V4, "2026-11-12"),
      rating("VAN", 115, V4, "2026-11-12")
    ]);
    expect(v4.header.textContent).toBe("5v5 Goalie");
    expect(v4.goalieCell("TOR").textContent).toBe("104.0");
  });
});

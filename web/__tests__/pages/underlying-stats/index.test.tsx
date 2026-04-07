import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type {
  UnderlyingStatsLandingRating,
  UnderlyingStatsLandingSnapshot
} from "../../../lib/underlying-stats/teamLandingRatings";

const routerState = vi.hoisted(() => ({
  pathname: "/underlying-stats",
  query: { date: "2026-04-05" },
  replace: vi.fn()
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState
}));

import TeamPowerRankingsPage from "../../../pages/underlying-stats";

const buildRating = (
  teamAbbr: string,
  overrides: Partial<UnderlyingStatsLandingRating> = {}
): UnderlyingStatsLandingRating => ({
  teamAbbr,
  date: "2026-04-05",
  offRating: 100,
  defRating: 100,
  paceRating: 100,
  ppTier: 2,
  pkTier: 2,
  trend10: 0,
  components: {
    xgf60: 3.1,
    gf60: 3,
    sf60: 27,
    xga60: 3,
    ga60: 3,
    sa60: 28,
    pace60: 57
  },
  finishingRating: 100,
  goalieRating: 100,
  dangerRating: 100,
  specialRating: 100,
  disciplineRating: 100,
  varianceFlag: 0,
  sos: 100,
  ...overrides
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("/underlying-stats landing page", () => {
  beforeEach(() => {
    routerState.replace.mockReset();
    routerState.query = { date: "2026-04-05" };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders snapshot options plus the SoS and repaired trend values in the table", () => {
    render(
      <TeamPowerRankingsPage
        initialDate="2026-04-05"
        availableDates={["2026-04-05", "2026-04-04", "2026-04-03"]}
        initialRatings={[
          buildRating("TOR", {
            offRating: 110,
            defRating: 108,
            paceRating: 107,
            ppTier: 1,
            pkTier: 1,
            trend10: 2.34,
            sos: 117.59
          }),
          buildRating("VAN", {
            offRating: 102,
            defRating: 101,
            paceRating: 100,
            trend10: -1.12,
            sos: 98.41
          })
        ]}
      />
    );

    const select = screen.getByLabelText("Snapshot date");
    expect(within(select).getAllByRole("option")).toHaveLength(3);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "SoS" })).toBeTruthy();

    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]!).getByText("TOR")).toBeTruthy();
    expect(within(bodyRows[0]!).getByText("117.6")).toBeTruthy();
    expect(within(bodyRows[0]!).getByText("+2.3")).toBeTruthy();
  });

  it("fetches updated landing ratings when the snapshot date changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(
        "/api/underlying-stats/team-ratings?date=2026-04-04"
      );

      const payload: UnderlyingStatsLandingSnapshot = {
        requestedDate: "2026-04-04",
        resolvedDate: "2026-04-04",
        ratings: [
          buildRating("VAN", {
            date: "2026-04-04",
            offRating: 112,
            defRating: 110,
            paceRating: 108,
            trend10: 3.21,
            sos: 121.11
          })
        ]
      };

      return jsonResponse(payload);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeamPowerRankingsPage
        initialDate="2026-04-05"
        availableDates={["2026-04-05", "2026-04-04"]}
        initialRatings={[
          buildRating("TOR", {
            offRating: 110,
            defRating: 108,
            paceRating: 107,
            trend10: 2.34,
            sos: 117.59
          })
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Snapshot date"), {
      target: { value: "2026-04-04" }
    });

    await waitFor(() => {
      const table = screen.getByRole("table");
      const bodyRows = within(table).getAllByRole("row").slice(1);
      expect(within(bodyRows[0]!).getByText("VAN")).toBeTruthy();
      expect(within(bodyRows[0]!).getByText("121.1")).toBeTruthy();
      expect(within(bodyRows[0]!).getByText("+3.2")).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(routerState.replace).toHaveBeenCalledWith(
      {
        pathname: "/underlying-stats",
        query: { date: "2026-04-04" }
      },
      undefined,
      { shallow: true }
    );
  });
});

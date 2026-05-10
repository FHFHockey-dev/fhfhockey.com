import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type {
  UnderlyingStatsLandingRating,
  UnderlyingStatsLandingSnapshot
} from "../../../lib/underlying-stats/teamLandingRatings";
import type { UlsRouteStatus } from "../../../lib/underlying-stats/ulsRouteStatus";
import { buildUnderlyingStatsLandingDashboard } from "../../../lib/underlying-stats/teamLandingDashboard";

const routerState = vi.hoisted(() => ({
  pathname: "/underlying-stats",
  query: { date: "2026-04-05" },
  replace: vi.fn()
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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
  sosPast: 0.55,
  sosPastRank: 10,
  sosFuture: 0.53,
  sosFutureRank: 14,
  ppPct: 22.4,
  ppRank: 11,
  pkPct: 81.1,
  pkRank: 8,
  trendSeries: [
    { date: "2026-03-28", value: 99 },
    { date: "2026-04-01", value: 100 },
    { date: "2026-04-05", value: 101 }
  ],
  luckSeries: [
    { date: "2026-03-28", value: 99.5 },
    { date: "2026-04-01", value: 100.1 },
    { date: "2026-04-05", value: 100.4 }
  ],
  luckStatus: "normal",
  luckPdo: 100.4,
  luckPdoZ: 0.3,
  narrative: [
    "5v5 offense is rising as expected goals and shot volume improve.",
    "Upcoming schedule looks softer than league average."
  ],
  scheduleTexture: {
    backToBacksNext14: 1,
    gamesNext14: 5,
    gamesNext7: 3,
    homeGamesNext14: 2,
    restAdvantageGamesNext14: 1,
    restDisadvantageGamesNext14: 0,
    roadGamesNext14: 3,
    threeInFourNext14: 1
  },
  ...overrides
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

const buildSnapshot = (
  ratings: UnderlyingStatsLandingRating[],
  resolvedDate = "2026-04-05"
): UnderlyingStatsLandingSnapshot => ({
  dashboard: buildUnderlyingStatsLandingDashboard(ratings),
  requestedDate: resolvedDate,
  resolvedDate,
  ratings
});

const routeStatus: UlsRouteStatus = {
  teamRatings: { latestSnapshotDate: "2026-04-05", rowCount: 32, status: "ready" },
  skaterOffenseRatings: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
  skaterDefenseRatings: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
  goalieRatings: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
  gamePredictions: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
  playerPredictions: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
  modelMarketFlags: { latestSnapshotDate: null, rowCount: 0, status: "pending" }
};

describe("/underlying-stats landing page", () => {
  beforeEach(() => {
    routerState.replace.mockReset();
    routerState.query = { date: "2026-04-05" };
    vi.restoreAllMocks();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard modules plus the simple-mode table values", () => {
    render(
      <TeamPowerRankingsPage
        availableDates={["2026-04-05", "2026-04-04", "2026-04-03"]}
        routeStatus={routeStatus}
        initialSnapshot={buildSnapshot([
          buildRating("TOR", {
            offRating: 110,
            defRating: 108,
            paceRating: 107,
            ppTier: 1,
            pkTier: 1,
            trend10: 2.34,
            sosPast: 0.612,
            sosPastRank: 3,
            sosFuture: 0.558,
            sosFutureRank: 9
          }),
          buildRating("VAN", {
            offRating: 102,
            defRating: 101,
            paceRating: 100,
            trend10: -1.12,
            sosPast: 0.521,
            sosFuture: 0.509
          })
        ])}
      />
    );

    const select = screen.getByLabelText("Snapshot date");
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("Process quadrant")).toBeTruthy();
    expect(screen.getByText("Risers and fallers")).toBeTruthy();
    expect(screen.getByText("What looks real?")).toBeTruthy();
    expect(screen.getByText("Schedule texture")).toBeTruthy();
    expect(screen.getByText("Under the radar")).toBeTruthy();

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: /SoS Future/ })
    ).toBeTruthy();
    expect(
      within(table).getByRole("columnheader", { name: "Why moving" })
    ).toBeTruthy();

    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]!).getByText("TOR")).toBeTruthy();
    expect(within(bodyRows[0]!).getByText("55.8%")).toBeTruthy();
    expect(within(bodyRows[0]!).getByText("+2.3")).toBeTruthy();
    expect(
      within(bodyRows[0]!).getByText(
        "5v5 offense is rising as expected goals and shot volume improve."
      )
    ).toBeTruthy();
  });

  it("fetches updated landing ratings when the snapshot date changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(
        "/api/underlying-stats/team-ratings?date=2026-04-04"
      );

      const payload = buildSnapshot(
        [
          buildRating("VAN", {
            date: "2026-04-04",
            offRating: 112,
            defRating: 110,
            paceRating: 108,
            trend10: 3.21,
            sosPast: 0.621,
            sosFuture: 0.589
          })
        ],
        "2026-04-04"
      );

      return jsonResponse(payload);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeamPowerRankingsPage
        availableDates={["2026-04-05", "2026-04-04"]}
        routeStatus={routeStatus}
        initialSnapshot={buildSnapshot([
          buildRating("TOR", {
            offRating: 110,
            defRating: 108,
            paceRating: 107,
            trend10: 2.34,
            sosPast: 0.612,
            sosFuture: 0.558
          })
        ])}
      />
    );

    fireEvent.change(screen.getByLabelText("Snapshot date"), {
      target: { value: "2026-04-04" }
    });

    await waitFor(() => {
      const table = screen.getByRole("table");
      const bodyRows = within(table).getAllByRole("row").slice(1);
      expect(within(bodyRows[0]!).getByText("VAN")).toBeTruthy();
      expect(within(bodyRows[0]!).getByText("58.9%")).toBeTruthy();
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

  it("switches to advanced mode and reveals the component columns", () => {
    render(
      <TeamPowerRankingsPage
        availableDates={["2026-04-05"]}
        routeStatus={routeStatus}
        initialSnapshot={buildSnapshot([buildRating("TOR"), buildRating("VAN")])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: /SoS Past/ })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: /Pace/ })).toBeTruthy();
    expect(within(table).queryByRole("columnheader", { name: /Why moving/ })).toBeNull();
  });

  it("sorts simple mode rows by trend when the trend header is clicked", () => {
    render(
      <TeamPowerRankingsPage
        availableDates={["2026-04-05"]}
        routeStatus={routeStatus}
        initialSnapshot={buildSnapshot([
          buildRating("TOR", { trend10: 1.2 }),
          buildRating("VAN", { trend10: 4.4 })
        ])}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Trend/ }));

    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]!).getByText("VAN")).toBeTruthy();
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({
  Line: (props: any) => (
    <div data-testid="line-chart">{JSON.stringify(props.data.datasets[0].data)}</div>
  ),
}));
vi.mock("chartjs-adapter-date-fns", () => ({}));
vi.mock("hooks/useCurrentSeason", () => ({
  default: () => ({ seasonId: 20262027, regularSeasonStartDate: "2026-10-07" }),
}));
vi.mock("hooks/useScreenSize", () => ({
  default: () => ({ screen: "l" }),
  BreakPoint: { s: "s", m: "m", l: "l" },
}));

import TimeOnIceChart from "./TimeOnIceChart";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TimeOnIceChart PP share (W2-P0-13, decision 71)", () => {
  it("shows the API's unavailable reason instead of plotting a PP share", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          powerPlayStatus: { available: false, reason: "PP share unavailable: no qualified PP clock yet." },
          data: [{ date: "2026-11-01", toi: 22, powerPlayToi: null, powerPlayToiShare: null }],
        }),
      }))
    );
    render(<TimeOnIceChart playerId={8478402} timeOption="SEASON" chartType="POWER_PLAY_TOI" />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "PP share unavailable: no qualified PP clock yet."
      )
    );
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });

  it("decision 152: plots a served share with N/A and withheld games as gaps, and says why", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          powerPlayStatus: { available: true, reason: null },
          data: [
            { date: "2026-11-01", toi: 22, powerPlayToi: 2, powerPlayToiShare: 40,
              powerPlayShareStatus: { availability: "available", reason: null } },
            { date: "2026-11-03", toi: 20, powerPlayToi: 0, powerPlayToiShare: null,
              powerPlayShareStatus: { availability: "not_applicable", reason: null } },
            { date: "2026-11-05", toi: 21, powerPlayToi: null, powerPlayToiShare: null,
              powerPlayShareStatus: { availability: "unavailable", reason: "No stored PP clock for this team-game yet." } },
          ],
        }),
      }))
    );
    render(<TimeOnIceChart playerId={8478402} timeOption="SEASON" chartType="POWER_PLAY_TOI" />);
    await waitFor(() => expect(screen.getByTestId("line-chart").textContent).toBe("[40,null,null]"));
    expect(screen.getByRole("note").textContent).toBe(
      "N/A for 1 game with no power play. Withheld for 1 game: No stored PP clock for this team-game yet."
    );
  });

  it("serving off shows no per-game note", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          powerPlayStatus: { available: false, reason: "PP share unavailable." },
          data: [{ date: "2026-11-01", toi: 22, powerPlayToi: null, powerPlayToiShare: null }],
        }),
      }))
    );
    render(<TimeOnIceChart playerId={8478402} timeOption="SEASON" chartType="POWER_PLAY_TOI" />);
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("still plots TOI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          powerPlayStatus: { available: false, reason: "PP share unavailable." },
          data: [{ date: "2026-11-01", toi: 22, powerPlayToi: null, powerPlayToiShare: null }],
        }),
      }))
    );
    render(<TimeOnIceChart playerId={8478402} timeOption="SEASON" chartType="TOI" />);
    await waitFor(() => expect(screen.getByTestId("line-chart").textContent).toBe("[22]"));
  });
});

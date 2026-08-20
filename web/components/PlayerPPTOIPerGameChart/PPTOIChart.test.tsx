import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

import PPTOIChart from "./PPTOIChart";

function installRows(rows: unknown[], error: Error | null = null) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.range = vi.fn(async () => ({ data: rows, error }));
  fromMock.mockReturnValue(query);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PPTOIChart", () => {
  it("lists every visible plotted value in a named non-hover table", async () => {
    installRows([
      {
        player_id: 1,
        player_name: "Alex Forward",
        date: "2026-01-02",
        pp_toi_pct_per_game: 0.625,
        position_code: "C",
      },
      {
        player_id: 2,
        player_name: "Dana Defender",
        date: "2026-01-03",
        pp_toi_pct_per_game: 0.8,
        position_code: "D",
      },
    ]);

    render(<PPTOIChart teamAbbreviation="EDM" />);

    const table = await screen.findByRole("table", {
      name: "Exact power play time-on-ice values",
    });
    expect(within(table).getByText("Alex Forward")).toBeTruthy();
    expect(within(table).getByText("62.5%")).toBeTruthy();
    expect(within(table).getByText("Dana Defender")).toBeTruthy();
    expect(within(table).getByText("80.0%")).toBeTruthy();
    expect(
      screen.getByText(/Exact values are listed in the table that follows/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Alex Forward" }));
    await waitFor(() => {
      expect(within(table).queryByText("Dana Defender")).toBeNull();
    });
    expect(within(table).getByText("Alex Forward")).toBeTruthy();
  });

  it("renders an explicit empty state when no values are available", async () => {
    installRows([]);

    render(<PPTOIChart teamAbbreviation="EDM" />);

    const emptyState = await screen.findByText(
      "No PP TOI values are available for this view and player selection.",
    );
    expect(emptyState.getAttribute("role")).toBe("status");
    expect(
      screen.queryByRole("table", {
        name: "Exact power play time-on-ice values",
      }),
    ).toBeNull();
  });
});

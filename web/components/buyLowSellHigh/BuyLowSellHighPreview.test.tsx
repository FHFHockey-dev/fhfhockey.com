import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { BLSH_STORAGE_KEY } from "lib/buyLowSellHigh/storage";
import BuyLowSellHighPreview from "./BuyLowSellHighPreview";

afterEach(cleanup);

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key), clear: () => data.clear(), key: () => null, length: 0, data } as unknown as Storage & { data: Map<string, string> };
};

describe("BuyLowSellHighPreview", () => {
  it("shows the fixture disclaimer, watchlists and no implied market value without a reference", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    expect(screen.getByRole("note").textContent).toMatch(/FIXTURE DATA/);
    const table = screen.getByRole("table", { name: "Rebound watch" });
    expect(within(table).getAllByText("Market reference unavailable").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Cooling watch/ }));
    expect(within(screen.getByRole("table", { name: "Cooling watch" })).getByRole("rowheader", { name: /Fixture Forward Five/ })).toBeTruthy();
  });

  it("persists a watched player on this device and restores it", async () => {
    const storage = memory();
    render(<BuyLowSellHighPreview storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: /Cooling watch/ }));
    fireEvent.click(screen.getByRole("button", { name: "Watch Fixture Forward Five" }));
    await waitFor(() => expect(storage.data.get(BLSH_STORAGE_KEY)).toMatch(/fx-f5/));
    cleanup();
    render(<BuyLowSellHighPreview storage={storage} />);
    const watchlist = screen.getByRole("region", { name: "Local watchlist" });
    await waitFor(() => expect(within(watchlist).getByText(/Fixture Forward Five/)).toBeTruthy());
    fireEvent.click(within(watchlist).getByRole("button", { name: /Reset all/ }));
    expect(storage.data.has(BLSH_STORAGE_KEY)).toBe(true);
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Local watchlist" })).getByText("No watched players.")).toBeTruthy());
  });

  it("recovers visibly from unreadable saved data", async () => {
    const storage = memory();
    storage.setItem(BLSH_STORAGE_KEY, "{not json");
    render(<BuyLowSellHighPreview storage={storage} />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/unreadable/));
  });

  it("compares a manual trade and refuses a player on both sides", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    const trade = screen.getByRole("region", { name: "Trade comparison" });
    fireEvent.change(within(trade).getByLabelText("You give"), { target: { value: "fx-f5" } });
    fireEvent.click(within(trade).getByRole("button", { name: "Add to give" }));
    fireEvent.change(within(trade).getByLabelText("You receive"), { target: { value: "fx-f1" } });
    fireEvent.click(within(trade).getByRole("button", { name: "Add to receive" }));
    expect(within(trade).getByText(/Raw projected production/)).toBeTruthy();
    expect(within(trade).getByRole("table", { name: "Trade totals" })).toBeTruthy();
    fireEvent.change(within(trade).getByLabelText("You receive"), { target: { value: "fx-f5" } });
    fireEvent.click(within(trade).getByRole("button", { name: "Add to receive" }));
    expect(within(trade).getByText(/appears on both sides/)).toBeTruthy();
    expect(within(trade).queryByRole("table", { name: "Trade totals" })).toBeNull();
  });

  it("shows a market gap only after a comparable reference is entered", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: /Cooling watch/ }));
    const market = screen.getByRole("region", { name: "Market reference" });
    fireEvent.change(within(market).getByLabelText("Player"), { target: { value: "fx-f5" } });
    fireEvent.change(within(market).getByLabelText("Source"), { target: { value: "Fixture league offer" } });
    fireEvent.change(within(market).getByLabelText(/Value/), { target: { value: "40" } });
    fireEvent.change(within(market).getByLabelText("Captured at"), { target: { value: "2026-10-18T06:00" } });
    fireEvent.click(within(market).getByRole("button", { name: "Save reference" }));
    const row = within(screen.getByRole("table", { name: "Cooling watch" })).getByRole("rowheader", { name: /Fixture Forward Five/ }).closest("tr")!;
    expect(within(row).getByText(/vs reference 40.00 fantasy points over 10 team games/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Horizon \(scheduled/), { target: { value: "5" } });
    const after = within(screen.getByRole("table", { name: "Cooling watch" })).getByRole("rowheader", { name: /Fixture Forward Five/ }).closest("tr")!;
    expect(within(after).getByText("Market reference unavailable")).toBeTruthy();
    expect(within(after).getByText("horizon mismatch")).toBeTruthy();
  });
});

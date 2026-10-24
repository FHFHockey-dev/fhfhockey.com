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

  it("opens a candidate detail with passed-through opportunity, duration, variability and source clocks", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    const toggle = screen.getByRole("button", { name: "Details for Fixture Forward Three" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("blsh-player-detail");
    const detail = screen.getByRole("region", { name: "Fixture Forward Three" });
    expect(document.activeElement).toBe(within(detail).getByRole("heading", { name: "Fixture Forward Three" }));
    expect(within(detail).getByText(/Observed duration: 10 appearances .*History only; not a forecast of how long it lasts\./)).toBeTruthy();
    expect(within(detail).getByText(/Observed game-to-game SD \(Points\): \d+\.\d{2}\. Recent history, not forecast volatility\./)).toBeTruthy();
    expect(within(detail).getByText("Predictive spread: Unavailable (not supplied by forge v1).")).toBeTruthy();
    expect(within(detail).getByText(/Confidence: not supplied/)).toBeTruthy();
    expect(within(detail).getByText(/Fixture record \(synthetic\) as of 2026-10-18T15:00:00.000Z; contract sko-interpretation-v0.1/)).toBeTruthy();
    expect(within(detail).getByText(/Horizon: 10 of 10 requested team games scheduled/)).toBeTruthy();
    expect(within(detail).getByRole("heading", { name: "Limitations" })).toBeTruthy();
    expect(within(detail).queryByText(/\b(buy|sell) now\b/i)).toBeNull();
  });

  it("closes with Escape or Close and returns focus to the row toggle", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    const toggle = screen.getByRole("button", { name: "Details for Fixture Defense Two" });
    fireEvent.click(toggle);
    const detail = screen.getByRole("region", { name: "Fixture Defense Two" });
    expect(within(detail).getByText(/sparse sample/)).toBeTruthy();
    fireEvent.keyDown(within(detail).getByRole("heading", { name: "Fixture Defense Two" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Fixture Defense Two" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole("region", { name: "Fixture Defense Two" })).getByRole("button", { name: /Close details for Fixture Defense Two/ }));
    expect(screen.queryByRole("region", { name: "Fixture Defense Two" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("keeps the detail honest when the horizon leaves the player unranked", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Details for Fixture Forward Three" }));
    fireEvent.change(screen.getByLabelText(/^Horizon \(scheduled/), { target: { value: "20" } });
    const detail = screen.getByRole("region", { name: "Fixture Forward Three" });
    expect(within(detail).getByText(/Not in the current list/)).toBeTruthy();
    expect(within(detail).getByText(/Horizon: 14 of 20 requested team games scheduled/)).toBeTruthy();
    expect(within(detail).getByText(/^Unavailable \(expected incomplete horizon\) · Gap unavailable$/)).toBeTruthy();
  });

  it("reaches stale, conflicting and goalie records from the unranked list without inventing values", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Details for Fixture Defense Three" }));
    expect(within(screen.getByRole("region", { name: "Fixture Defense Three" })).getByText(/\(stale\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details for Fixture Forward Nine" }));
    expect(screen.queryByRole("region", { name: "Fixture Defense Three" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Fixture Forward Nine" })).getByText(/1 conflicting games/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details for Fixture Goalie One" }));
    const goalie = screen.getByRole("region", { name: "Fixture Goalie One" });
    expect(within(goalie).getByText("Opportunity unavailable for this record.")).toBeTruthy();
    expect(within(goalie).getByText("Observed game-to-game SD: unavailable for this record.")).toBeTruthy();
    expect(within(goalie).getAllByText(/Unavailable \(pending goalie adapter\)/).length).toBeGreaterThan(0);
  });

  it("lists per-category observed SD for weighted league points instead of deriving one", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    fireEvent.change(screen.getByLabelText("Ranked by"), { target: { value: "LEAGUE_POINTS" } });
    const toggle = screen.getAllByRole("button", { name: /^Details for Fixture Forward/ })[0];
    const name = toggle.textContent!.replace(/^Details for /, "");
    fireEvent.click(toggle);
    const detail = screen.getByRole("region", { name });
    expect(within(detail).getByText(/Observed game-to-game SD \(per category\): Points \d/)).toBeTruthy();
    expect(within(detail).getByRole("heading", { name: /Gap \(fixture league points, next 10\)/ })).toBeTruthy();
  });
});

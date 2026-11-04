import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { HORIZON_OPTIONS, type HorizonGames, type InterpretationRecord } from "lib/skoElement/contract";
import { fixtureRecords } from "lib/skoElement/fixtures";
import BlshTradeComparison from "./BlshTradeComparison";
import { FIXTURE_BLSH_EVIDENCE } from "./fixtureEvidence";

afterEach(cleanup);

const recordsByHorizon = Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, fixtureRecords(horizon)])) as Record<HorizonGames, InterpretationRecord[]>;
const renderView = (give: string[], receive: string[]) => render(
  <BlshTradeComparison recordsByHorizon={recordsByHorizon} evidence={FIXTURE_BLSH_EVIDENCE} fixtureBanner="FIXTURE DATA" initialGive={give} initialReceive={receive} />);
const card = (name: string) => screen.getByRole("article", { name });
const result = () => screen.getByRole("region", { name: /Forecast comparison/ });

describe("BlshTradeComparison", () => {
  it("defaults to FHFH Standard over the next 10 team games and labels the fixture forecast experimental", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    expect(screen.getByRole("button", { name: "FHFH Standard (default)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Next 10 team games (default)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: /^Next \d+ team games/ }).map(button => button.textContent)).toEqual(
      ["Next 5 team games", "Next 10 team games (default)", "Next 20 team games"]);
    expect(within(result()).getByText("Experimental forecast")).toBeTruthy();
    expect(within(result()).getByText(/^Experimental forecast\. Raw projected production/)).toBeTruthy();
    expect(within(card("Fixture Forward Five")).getByText(/Uncertainty/).nextSibling?.textContent).toMatch(/Not supplied by FORGE v1/);
    expect(within(card("Fixture Forward Five")).getByText(/uncalibrated/)).toBeTruthy();
  });

  it("keeps BLSH evidence in its own retrospective block, separate from the forecast", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    const f5 = card("Fixture Forward Five");
    const forecast = within(f5).getByRole("region", { name: "Forecast for Fixture Forward Five" });
    const evidence = within(f5).getByRole("region", { name: "Buy Low / Sell High evidence for Fixture Forward Five" });
    expect(within(evidence).getByText(/recorded games, not a forecast/)).toBeTruthy();
    expect(within(evidence).getByText(/Sell-high research candidate #2 among forwards/)).toBeTruthy();
    expect(within(forecast).queryByText(/Sell-high/)).toBeNull();
    expect(within(evidence).queryByText(/League points/)).toBeNull();
  });

  it("withholds an unavailable 20-game forecast, never shows zero, and offers a labelled retrospective comparison", () => {
    renderView(["fx-f5"], ["fx-f3"]);
    fireEvent.click(screen.getByRole("button", { name: "Next 20 team games" }));
    const f3 = card("Fixture Forward Three");
    expect(within(f3).getByText("Forecast unavailable")).toBeTruthy();
    expect(within(f3).getByText(/No forecast number is shown/)).toBeTruthy();
    expect(within(result()).getByText(/Fixture Forward Three has 14 of 20 scheduled games/)).toBeTruthy();
    expect(within(result()).getAllByText(/^Withheld/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Show a retrospective comparison instead/ }));
    const retro = screen.getByRole("region", { name: "Recorded FHFH Standard points per game" });
    expect(within(retro).getByText(/Retrospective · not a forecast/)).toBeTruthy();
    expect(within(retro).getByText("Receive − give, recorded per game").nextSibling?.textContent).toBe(String((4.6 / 5 - 26.2 / 5).toFixed(2)));
  });

  it("blocks a goalie under skater-only scoring and supports categories and custom weights", () => {
    renderView(["fx-g1"], ["fx-f1"]);
    expect(within(result()).getByText(/Fixture Goalie One has no scored statistic/)).toBeTruthy();
    expect(within(card("Fixture Goalie One")).getByText(/covers skaters only/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "SV%" }));
    expect(within(result()).getByRole("rowheader", { name: "SV%" })).toBeTruthy();
    expect(within(result()).getByText(/No overall winner/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Points weights" }));
    fireEvent.change(screen.getByLabelText("Saves"), { target: { value: "0.2" } });
    expect(within(result()).queryByText(/no scored statistic/)).toBeNull();
  });

  it("shows a withheld direction from v3 history gating as text, not as buy or sell evidence", () => {
    renderView(["fx-f5"], ["fx-d1"]);
    const evidence = within(card("Fixture Defense One")).getByRole("region", { name: /Buy Low \/ Sell High evidence/ });
    expect(within(evidence).getByText("Direction withheld: insufficient personal history")).toBeTruthy();
    expect(within(evidence).queryByText(/Buy-low evidence/)).toBeNull();
    expect(within(evidence).getAllByText(/no personal history/).length).toBe(1);
  });

  it("adds and removes players on either side", () => {
    renderView(["fx-f5"], []);
    expect(within(result()).getByText(/Add at least one player you receive/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a player you receive"), { target: { value: "fx-f6" } });
    expect(card("Fixture Forward Six")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Fixture Forward Six" }));
    expect(screen.queryByRole("article", { name: "Fixture Forward Six" })).toBeNull();
  });
});

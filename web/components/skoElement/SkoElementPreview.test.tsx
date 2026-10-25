import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { fixtureRecords } from "lib/skoElement/fixtures";
import SkoElementPreview, { DEFAULT_SKO_STATE, orderRows, parseSkoState, type SkoViewState } from "./SkoElementPreview";

afterEach(cleanup);

function Harness({ initial = DEFAULT_SKO_STATE, onChange }: { initial?: SkoViewState; onChange?: (state: SkoViewState) => void }) {
  const [state, setState] = useState(initial);
  return <SkoElementPreview state={state} onStateChange={next => { onChange?.(next); setState(next); }} />;
}

const rowFor = (name: string) => screen.getByRole("rowheader", { name: new RegExp(name) }).closest("tr")!;

describe("SkoElementPreview", () => {
  it("shows the fixture disclaimer and the 10-game default horizon with 5/20 options", () => {
    render(<Harness />);
    expect(screen.getByRole("note").textContent).toMatch(/FIXTURE DATA/);
    const horizon = screen.getByLabelText(/Future horizon/) as HTMLSelectElement;
    expect(horizon.value).toBe("10");
    expect([...horizon.options].map(option => option.value)).toEqual(["5", "10", "20"]);
  });

  it("labels gaps in text, not color alone, and shows unavailable states with reasons", () => {
    render(<Harness />);
    expect(within(rowFor("Fixture Forward Five")).getByText("Cooling watch")).toBeTruthy();
    expect(within(rowFor("Fixture Forward Eight")).getAllByText(/Unavailable \(unknown team game status\)/).length).toBeGreaterThan(0);
    expect(within(rowFor("Fixture Forward One")).getByText("Opportunity rising; durability uncertain", { exact: false })).toBeTruthy();
  });

  it("switches to the supplied 20-game bundle and withholds a short-season gap", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Future horizon/), { target: { value: "20" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ horizon: 20 }));
    expect(within(rowFor("Fixture Forward Three")).getAllByText(/expected incomplete horizon/).length).toBeGreaterThan(0);
  });

  it("separates defense and VuDu views; goalies show a pending-adapter state", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Defense" }));
    expect(screen.getByRole("table", { name: /Defense sustainability scan/ })).toBeTruthy();
    expect(screen.queryByText("Fixture Forward One")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "VuDu goalies" }));
    const table = screen.getByRole("table", { name: "VuDu goalie context" });
    expect(within(table).getByText(/Pending goalie adapter/)).toBeTruthy();
  });

  it("opens details with explanations, sources and limitations, and keeps a filtered-out selection visible", () => {
    render(<Harness />);
    const button = within(rowFor("Fixture Forward One")).getByRole("button", { name: /Details/ });
    fireEvent.click(button);
    const detail = screen.getByRole("region", { name: "Details for Fixture Forward One" });
    expect(within(detail).getByText(/Expected cooling from the recent run coexists/)).toBeTruthy();
    expect(within(detail).getByText(/PP1 \(fixture lineup report\)/)).toBeTruthy();
    expect(within(detail).getByText(/not supplied by FORGE game expectations v1/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Five" } });
    expect(screen.getByRole("region", { name: "Details for Fixture Forward One" })).toBeTruthy();
    expect(screen.getByText("This selected player is hidden by the current filters.")).toBeTruthy();
  });

  it("makes no network requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<Harness />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("URL state and ordering", () => {
  it("parses shareable state and reports invalid values instead of guessing", () => {
    expect(parseSkoState({ view: "D", horizon: "5", recent: "20", target: "HITS", player: "fx-d1" }))
      .toEqual({ state: { view: "D", horizon: 5, recent: 20, target: "HITS", q: "", player: "fx-d1" }, invalid: [] });
    expect(parseSkoState({ horizon: "7", view: "X" })).toEqual({ state: DEFAULT_SKO_STATE, invalid: ["view", "horizon"] });
  });

  it("orders by signed gap with unavailable gaps last", () => {
    const ordered = orderRows(fixtureRecords(10).filter(record => record.identity.modelClass !== "G"), "POINTS");
    const gaps = ordered.map(record => record.metrics.find(metric => metric.target === "POINTS")!.gapPerTeamGame.value);
    const firstNull = gaps.indexOf(null);
    expect(gaps.slice(firstNull).every(value => value === null)).toBe(true);
    const known = gaps.slice(0, firstNull) as number[];
    expect(known).toEqual([...known].sort((a, b) => b - a));
  });
});

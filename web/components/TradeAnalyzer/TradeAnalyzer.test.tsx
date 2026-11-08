import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TradeAnalyzer from "./TradeAnalyzer";

afterEach(cleanup);
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function enterOffer() {
  change("Proposed effective date", "2026-11-10");
  change("Team A name", "Alpha");
  change("Team B name", "Beta");
  change("Team A full before-roster", "A1 | C | active\nA2 | LW | bench");
  change("Team B full before-roster", "B1 | RW | active\nB2 | D | bench\nB3 | G | IR");
  for (const label of ["Team A", "Team B"]) {
    change(`${label} maximum total players`, label === "Team A" ? "2" : "3");
    fireEvent.click(screen.getByLabelText(`I reviewed ${label}'s complete roster and ownership.`));
    fireEvent.click(screen.getByLabelText(`I reviewed ${label}'s total-player limit.`));
  }
  for (const name of ["Offer A1 (C)", "Offer B1 (RW)", "Offer B2 (D)"]) fireEvent.click(screen.getByLabelText(name));
}

describe("manual Trade Analyzer", () => {
  it("keeps each textarea's accessible name stable after populated values and rerenders", () => {
    render(<TradeAnalyzer />); enterOffer();
    for (const side of ["A", "B"]) change(`Team ${side} picks or other assets`, `pick: Synthetic ${side} conditional pick`);
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    fireEvent.click(screen.getByLabelText("Drop Team A: A2"));
    for (const side of ["A", "B"]) {
      const roster = screen.getByRole("textbox", { name: `Team ${side} full before-roster` });
      const assets = screen.getByRole("textbox", { name: `Team ${side} picks or other assets` });
      expect(roster).toBe(screen.getByLabelText(`Team ${side} full before-roster`, { exact: true }));
      expect(assets).toBe(screen.getByLabelText(`Team ${side} picks or other assets`, { exact: true }));
      expect((roster as HTMLTextAreaElement).value).toContain(`${side}1`);
      expect((assets as HTMLTextAreaElement).value).toContain(`Synthetic ${side} conditional pick`);
    }
  });

  it("previews both full rosters, requires a selected drop and keeps incoming/outgoing assets out of drop controls", () => {
    render(<TradeAnalyzer />); enterOffer();
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    expect(screen.getByRole("status").textContent).toContain("Conditional preview");
    const a = screen.getByRole("region", { name: "Alpha before and after" });
    const b = screen.getByRole("region", { name: "Beta before and after" });
    expect(within(a).getByText(/after exchange: 3; after selected drops: 3/)).toBeTruthy();
    expect(within(b).getByText(/after exchange: 2; after selected drops: 2/)).toBeTruthy();
    expect(within(a).queryByLabelText("Drop Team A: A1")).toBeNull();
    expect(within(a).queryByLabelText("Drop Team A: B1")).toBeNull();
    expect((within(a).getByLabelText("Drop Team A: A2") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(a).getByLabelText("Drop Team A: A2"));
    expect(screen.getByRole("status").textContent).toContain("Entry and reviewed total-player counts are complete");
    expect(within(a).getByText(/after selected drops: 2/)).toBeTruthy();
    expect(within(a).getByText(/Selected drops: A2/)).toBeTruthy();
    expect(screen.getByText(/Drop costs, displaced starts and net production are unavailable/)).toBeTruthy();
  });

  it("retains picks and unknown assets on both sides without requiring or fabricating a value", () => {
    render(<TradeAnalyzer />); enterOffer();
    change("Team A picks or other assets", "pick: Conditional 2027 second\nFuture considerations");
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    expect(screen.getAllByText("Pick: Conditional 2027 second · value unavailable")).toHaveLength(2);
    expect(screen.getAllByText("Unknown asset: Future considerations · value unavailable")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "What this preview cannot establish" }).textContent).toContain("An entered offer is not a market sighting");
  });

  it("does not interpret blank/unreviewed capacity as an empty roster slot", () => {
    render(<TradeAnalyzer />); enterOffer();
    change("Team A maximum total players", "");
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    const a = screen.getByRole("region", { name: "Alpha before and after" });
    expect(within(a).getByText(/Capacity unresolved:.*No free capacity is assumed/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Conditional");
    change("Team A maximum total players", "4");
    expect(within(a).getByText(/Capacity unresolved/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("I reviewed Team A's total-player limit."));
    expect(within(a).getByText(/Reviewed total-player limit: 4/)).toBeTruthy();
  });

  it("clears stale exchange/drop selections on roster edits and uses only in-memory state", () => {
    const saved = vi.spyOn(Storage.prototype, "setItem");
    render(<TradeAnalyzer />); enterOffer();
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    fireEvent.click(screen.getByLabelText("Drop Team A: A2"));
    change("Team A full before-roster", "Replacement | C | active");
    expect((screen.getByLabelText("Offer Replacement (C)") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("I reviewed Team A's complete roster and ownership.") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText("Drop Team A: A2")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Conditional");
    expect(saved).not.toHaveBeenCalled();
    cleanup(); render(<TradeAnalyzer />);
    expect((screen.getByLabelText("Team A full before-roster") as HTMLTextAreaElement).value).toBe("");
    saved.mockRestore();
  });

  it("shows before/after starting-slot coverage per team only after slots are entered and reviewed", () => {
    render(<TradeAnalyzer />); enterOffer();
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    const coverage = () => screen.getByRole("region", { name: "Starting-slot coverage with reviewed positions" });
    expect(within(coverage()).getAllByText(/Coverage unavailable:.*No starting slots are assumed/)).toHaveLength(2);
    for (const label of ["Team A", "Team B"]) {
      for (const [type, count] of [["C", "1"], ["LW", "1"], ["RW", "1"], ["D", "1"], ["G", "0"], ["F", "0"], ["W", "0"], ["UTIL", "0"]]) change(`${label} ${type} starting slots`, count);
      fireEvent.click(screen.getByLabelText(`I reviewed ${label}'s starting slots.`));
    }
    fireEvent.click(screen.getByLabelText("Drop Team A: A2"));
    const alpha = within(coverage()).getByRole("region", { name: "Alpha starting-slot coverage" });
    const beta = within(coverage()).getByRole("region", { name: "Beta starting-slot coverage" });
    expect(alpha.textContent).toContain("Before: 2 of 4 starting slots filled. After: 2 of 4 filled (no change).");
    expect(alpha.textContent).toContain("Incoming: B1 (active), B2 (bench).");
    expect(alpha.textContent).toContain("reserve eligibility on the receiving roster unverified");
    expect(beta.textContent).toContain("Before: 2 of 4 starting slots filled. After: 1 of 4 filled (1 more unfilled).");
    expect(beta.textContent).toContain("Reserve-status players left out of coverage: 1 before, 1 after.");
    expect(coverage().textContent).not.toMatch(/legal|better/i);
    change("Team A D starting slots", "2");
    expect((screen.getByLabelText("I reviewed Team A's starting slots.") as HTMLInputElement).checked).toBe(false);
    expect(within(coverage()).getByText(/Alpha: review the starting-slot counts/)).toBeTruthy();
    expect(within(coverage()).getAllByText(/Coverage unavailable/)).toHaveLength(1);
    const limits = screen.getByRole("region", { name: "What this preview cannot establish" }).textContent;
    for (const label of ["Dated legality", "League valuation", "Roster impact", "Counterparty acceptance", "Market evidence"]) expect(limits).toContain(`${label}: unavailable.`);
  });

  it("shows no reviewed-position numbers for a team receiving players from an unreviewed roster", () => {
    render(<TradeAnalyzer />); enterOffer();
    for (const label of ["Team A", "Team B"]) {
      for (const type of ["C", "LW", "RW", "D", "G", "F", "W", "UTIL"]) change(`${label} ${type} starting slots`, ["C", "LW", "RW", "D"].includes(type) ? "1" : "0");
      fireEvent.click(screen.getByLabelText(`I reviewed ${label}'s starting slots.`));
    }
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    fireEvent.click(screen.getByLabelText("Drop Team A: A2"));
    const alpha = () => screen.getByRole("region", { name: "Alpha starting-slot coverage" });
    expect(alpha().textContent).toContain("starting slots filled");
    fireEvent.click(screen.getByLabelText("I reviewed Team B's complete roster and ownership."));
    expect(alpha().textContent).toContain("incoming players come from Beta's unreviewed roster");
    expect(alpha().textContent).not.toMatch(/starting slots filled|dedicated slots filled|Reserve-status players/);
  });
});

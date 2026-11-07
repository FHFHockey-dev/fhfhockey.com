import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultWorkspace, workspaceStorageKey } from "lib/rosterScheduleOptimizer/workspace";
import { storageKey } from "lib/rosterAutopsy/manual";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

const auth = vi.hoisted(() => ({ current: { user: null as { id: string } | null, isLoading: false } }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => auth.current }));

import RosterAutopsy from "./RosterAutopsy";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  auth.current = { user: null, isLoading: false };
});

function addPlayer(name: string, eligibility: string) {
  fireEvent.change(screen.getByLabelText("Player name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("League positions"), { target: { value: eligibility } });
  fireEvent.click(screen.getByRole("button", { name: "Add player" }));
}

describe("Roster Autopsy manual workspace", () => {
  it("requires valid positions and refuses an obvious duplicate", async () => {
    render(<RosterAutopsy />);
    await screen.findByRole("heading", { name: "Roster" });
    addPlayer("Example", "mystery");
    expect(screen.getByRole("alert").textContent).toContain("valid league positions");
    fireEvent.change(screen.getByLabelText("League positions"), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    addPlayer("example", "C");
    expect(screen.getByRole("alert").textContent).toContain("already on this roster");
    expect(screen.getAllByRole("button", { name: "Remove Example" })).toHaveLength(1);
  });

  it("checks dedicated slots without double-counting a multi-position player", async () => {
    render(<RosterAutopsy />);
    await screen.findByRole("heading", { name: "Roster" });
    addPlayer("Dual Player", "C/LW");
    fireEvent.change(screen.getByLabelText("C starting slots"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("LW starting slots"), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText("I reviewed these starting slots."));
    fireEvent.click(screen.getByLabelText("I reviewed this roster and its league positions."));
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    const coverage = screen.getByRole("heading", { name: "Coverage" }).closest("section")!;
    expect(within(coverage).getAllByText("Covered individually")).toHaveLength(2);
    expect(within(coverage).getByText(/only once in the simultaneous slot total/)).toBeTruthy();
    const weaknesses = screen.getByRole("region", { name: "Weaknesses" });
    expect(within(weaknesses).getByText("1 of 2 starting slots remain unfilled when each player is used once.")).toBeTruthy();
    const actions = screen.getByRole("region", { name: "Next actions" });
    fireEvent.click(within(actions).getByRole("link", { name: "Review simultaneous coverage" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Coverage" }));
    fireEvent.change(screen.getByLabelText("Dual Player positions"), { target: { value: "" } });
    expect(screen.getByText(/review needed/)).toBeTruthy();
    expect(within(coverage).queryByText("Covered individually")).toBeNull();
    expect(within(weaknesses).queryByText(/starting slots remain unfilled/)).toBeNull();
    expect(within(actions).getByRole("link", { name: "Review roster positions" })).toBeTruthy();
  });

  it("puts diagnosis before editing and focuses setup actions without discarding input", async () => {
    render(<RosterAutopsy />);
    const actions = await screen.findByRole("region", { name: "Next actions" });
    const roster = screen.getByRole("heading", { name: "Roster" });
    expect(screen.getByRole("heading", { name: "Your roster priorities" }).compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(actions).getByRole("link", { name: "Add roster players" }));
    expect(document.activeElement).toBe(roster);
    addPlayer("Keep Me", "D");
    fireEvent.click(within(actions).getByRole("link", { name: "Enter starting slots" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Starting slots" }));
    expect(screen.getByRole("button", { name: "Remove Keep Me" })).toBeTruthy();
    expect(screen.getByText(/Coverage describes eligibility, not player quality/)).toBeTruthy();
  });

  it("copies a manual RSO roster without modifying it and labels retained scoring", async () => {
    const source = defaultWorkspace(new Date("2026-10-29T12:00:00Z"));
    const player: PlanningPlayer = { id: "10", nhlId: 10, name: "Example Player", teamAbbreviation: "AAA", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [], recentTotals: { games: 5, stats: { GOALS: 4, ASSISTS: 6 } } };
    source.manualPlayers = [player];
    source.roster = [{ playerId: "10", position: "bench" }];
    source.rules.scoring = { mode: "points", weights: { GOALS: 3, ASSISTS: 2 }, categories: [] };
    const original = JSON.stringify(source);
    window.localStorage.setItem(workspaceStorageKey(null), original);
    render(<RosterAutopsy />);
    fireEvent.click(await screen.findByRole("button", { name: "Review manual RSO import" }));
    expect(screen.queryByRole("button", { name: "Remove Example Player" })).toBeNull();
    expect((screen.getByLabelText("Use RSO starting slots (replaces the counts shown here).") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add selected players" }));
    expect(screen.getByText("Example Player")).toBeTruthy();
    expect(screen.getByText(/4.80 recent league pts\/appearance · 5 games · saved RSO stats, date unknown/)).toBeTruthy();
    expect(screen.getByText(/historical hints, not projections/)).toBeTruthy();
    expect(window.localStorage.getItem(workspaceStorageKey(null))).toBe(original);
    expect((screen.getByLabelText("I reviewed these starting slots.") as HTMLInputElement).checked).toBe(false);
  });

  it("reviews a merge into a populated roster without silently replacing entries or slots", async () => {
    const source = defaultWorkspace(new Date("2026-10-29T12:00:00Z"));
    const item = (id: string, name: string): PlanningPlayer => ({ id, nhlId: Number(id), name, teamAbbreviation: "AAA", eligiblePositions: ["LW"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] });
    source.manualPlayers = [item("10", "Same Name"), item("11", "New Player")];
    source.roster = [{ playerId: "10", position: "bench" }, { playerId: "11", position: "bench" }];
    const original = JSON.stringify(source);
    window.localStorage.setItem(workspaceStorageKey(null), original);
    render(<RosterAutopsy />);
    await screen.findByRole("heading", { name: "Roster" });
    addPlayer("Same Name", "C");
    fireEvent.change(screen.getByLabelText("C starting slots"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Review manual RSO import" }));
    const review = screen.getByRole("region", { name: "Review RSO import" });
    expect((within(review).getByRole("checkbox", { name: /Same Name/ }) as HTMLInputElement).checked).toBe(false);
    expect((within(review).getByRole("checkbox", { name: /New Player/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(review).getByLabelText("Use RSO starting slots (replaces the counts shown here).") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(review).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Remove New Player" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review manual RSO import" }));
    fireEvent.click(screen.getByRole("button", { name: "Add selected players" }));
    expect(screen.getByRole("button", { name: "Remove Same Name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove New Player" })).toBeTruthy();
    expect((screen.getByLabelText("C starting slots") as HTMLInputElement).value).toBe("1");
    expect(window.localStorage.getItem(workspaceStorageKey(null))).toBe(original);
    fireEvent.click(screen.getByRole("button", { name: "Review manual RSO import" }));
    expect(screen.getByText("Already in your roster")).toBeTruthy();
  });

  it("requires a fresh review if the workspace changes before applying an import", async () => {
    const source = defaultWorkspace(new Date("2026-10-29T12:00:00Z"));
    window.localStorage.setItem(workspaceStorageKey(null), JSON.stringify(source));
    render(<RosterAutopsy />);
    fireEvent.click(await screen.findByRole("button", { name: "Review manual RSO import" }));
    fireEvent.change(screen.getByLabelText("C starting slots"), { target: { value: "3" } });
    expect((screen.getByRole("button", { name: "Add selected players" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Your workspace changed. Review the RSO import again before applying it.")).toBeTruthy();
    expect((screen.getByLabelText("C starting slots") as HTMLInputElement).value).toBe("3");
  });

  it("provides in-page links to roster and coverage", async () => {
    render(<RosterAutopsy />);
    const navigation = await screen.findByRole("navigation", { name: "Roster autopsy sections" });
    expect(within(navigation).getByRole("link", { name: "Roster" }).getAttribute("href")).toBe("#autopsy-roster-heading");
    expect(within(navigation).getByRole("link", { name: "Coverage" }).getAttribute("href")).toBe("#autopsy-coverage-heading");
  });

  it("preserves an unreadable saved workspace instead of overwriting it", async () => {
    window.localStorage.setItem(storageKey(null), "unreadable saved data");
    render(<RosterAutopsy />);
    expect((await screen.findByRole("alert")).textContent).toContain("has not been overwritten");
    addPlayer("Example", "D");
    expect(screen.getByText("Example")).toBeTruthy();
    expect(window.localStorage.getItem(storageKey(null))).toBe("unreadable saved data");
  });

  it("does not overwrite a roster changed by another tab", async () => {
    render(<RosterAutopsy />);
    await screen.findByRole("heading", { name: "Roster" });
    await waitFor(() => expect(window.localStorage.getItem(storageKey(null))).not.toBeNull());
    window.localStorage.setItem(storageKey(null), "newer external workspace");
    addPlayer("Unsaved Player", "C");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("changed in another tab"));
    expect(screen.getByText("Unsaved Player")).toBeTruthy();
    expect(window.localStorage.getItem(storageKey(null))).toBe("newer external workspace");
  });

  it("keeps account-scoped manual rosters separate when the account changes", async () => {
    auth.current = { user: { id: "alpha" }, isLoading: false };
    const source = defaultWorkspace(new Date("2026-10-29T12:00:00Z"));
    source.manualPlayers = [{ id: "10", nhlId: 10, name: "Alpha Import", teamAbbreviation: "AAA", eligiblePositions: ["C"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }];
    source.roster = [{ playerId: "10", position: "bench" }];
    window.localStorage.setItem(workspaceStorageKey("alpha"), JSON.stringify(source));
    const view = render(<RosterAutopsy />);
    await screen.findByRole("heading", { name: "Roster" });
    addPlayer("Alpha Player", "C");
    fireEvent.click(screen.getByRole("button", { name: "Review manual RSO import" }));
    expect(screen.getByText("Alpha Import")).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem(storageKey("alpha"))).toContain("Alpha Player"));
    auth.current = { user: { id: "beta" }, isLoading: false };
    view.rerender(<RosterAutopsy />);
    await waitFor(() => expect(screen.queryByText("Alpha Player")).toBeNull());
    expect(screen.queryByText("Alpha Import")).toBeNull();
    addPlayer("Beta Player", "D");
    await waitFor(() => expect(window.localStorage.getItem(storageKey("beta"))).toContain("Beta Player"));
    expect(window.localStorage.getItem(storageKey("alpha"))).not.toContain("Beta Player");
    auth.current = { user: { id: "alpha" }, isLoading: false };
    view.rerender(<RosterAutopsy />);
    expect(await screen.findByText("Alpha Player")).toBeTruthy();
    expect(screen.queryByText("Beta Player")).toBeNull();
  });
});

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameLineSnapshots, { mergeFrozenEntries } from "./GameLineSnapshots";
import ProjectedLineups from "./ProjectedLineups";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureResponse, fixtureUnit } from "lib/lines/testFixtures";
import { reconcileEntry, reconcilePP } from "lib/lines/reconcile";

vi.mock("next/script", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("game Lines presentation", () => {
  it("shows applicability, phase and review separately for mixed IGA and PP claims in one capture", () => {
    const data = fixtureResponse(0);
    const iga = fixtureClaim("iga", { kind: "iga", phase: "in_game", unit: null, text: "Mixed source evidence" });
    const pp = fixturePP(1, { captureId: iga.captureId, phase: "in_game", identityStatus: "unresolved", reviewReasons: ["event_membership_unverified"], text: iga.text });
    data.teams[0]!.observations = [iga, pp]; data.teams[0]!.history = [iga, pp];
    render(<GameLineSnapshots data={data} />);
    const rail = screen.getByLabelText("TBL in-game updates");
    const igaRow = within(rail).getByLabelText("In-game adjustment · Source claim");
    const ppRow = within(rail).getByLabelText("Power-play report · PP 1");
    expect(within(igaRow).getByText("Observed in game")).toBeTruthy();
    expect(within(ppRow).queryByText("Observed in game")).toBeNull();
    expect(within(ppRow).getByText(/event_membership_unverified/)).toBeTruthy();
    expect(within(ppRow).getByText(`In game · Applies to game ${fixtureGame.id}`)).toBeTruthy();
    expect(within(rail).getAllByText("Mixed source evidence")).toHaveLength(1);
  });
  it("shows frozen entry, supported IGA prose, source and separate PP defaults", () => {
    render(<GameLineSnapshots data={fixtureResponse()} />);
    const main = screen.getByLabelText("TBL game-entry lineup");
    expect(within(main).getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
    expect(within(main).queryByText(/Holmberg\/Point\/Guentzel together/)).toBeNull();
    expect(screen.getByText(/Holmberg\/Point\/Guentzel together/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "@fixtureauthor" }).length).toBeGreaterThan(0);
    expect(screen.getByText("PP2: No applicable report")).toBeTruthy();
  });
  it("does not hide older history and supports accessible expand/collapse", () => {
    render(<GameLineSnapshots data={fixtureResponse(10)} />);
    expect(screen.getAllByText(/Holmberg\/Point\/Guentzel together/)).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show earlier updates" }));
    expect(screen.getAllByText(/Holmberg\/Point\/Guentzel together/)).toHaveLength(10);
    const toggle = screen.getByRole("button", { name: "In-game updates (10)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle); expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.hidden).toBe(true);
  });
  it("keeps both game-route teams distinct", () => {
    const data = fixtureResponse();
    const other = { ...data.teams[0]!, teamId: 3, abbreviation: "NYR", entry: null, entryRevisions: [], observations: [], history: [] };
    data.teams.push(other);
    render(<GameLineSnapshots data={data} />);
    expect(within(screen.getByLabelText("NYR game-entry lineup")).queryByText("Mikheyev — Point — Kucherov")).toBeNull();
    expect(screen.getByLabelText("TBL in-game updates")).not.toBe(screen.getByLabelText("NYR in-game updates"));
  });
  it("labels carried PP origin and projected replacement independently", () => {
    const data = fixtureResponse(); data.game = fixtureNext;
    data.teams[0]!.entry = null;
    data.teams[0]!.ppDefaults = reconcilePP({ game: fixtureNext, games: data.games, teamId: 14, claims: [fixturePP(1), fixturePP(2)], now: fixtureNow, carryForward: true });
    render(<GameLineSnapshots data={data} />);
    expect(screen.getAllByText("Carried forward from 2026-10-01 · TBL at NYR")).toHaveLength(2);
    expect(screen.getByText(/Carried units have not been independently confirmed/)).toBeTruthy();
  });
  it("shows a previous-game fallback and never confirms goalie order", () => {
    const data = fixtureResponse(); const previous = data.teams[0]!.entry!;
    data.game = fixtureNext; data.teams[0]!.entry = null;
    data.teams[0]!.fallback = { gameId: fixtureGame.id, date: fixtureGame.date, entry: { ...previous, units: [{ ...previous.units[0]!, unit: fixtureUnit(["Vasilevskiy", "Hildeby"], "goalie") }] } };
    render(<GameLineSnapshots data={data} />);
    expect(screen.getByText(/Previous-game fallback/)).toBeTruthy();
    expect(screen.getByText(/Listed order; starter role requires separate evidence/)).toBeTruthy();
  });
  it("retains frozen entry if refresh lacks a correction chain, accepts a valid correction", () => {
    const previous = fixtureResponse(); const incoming = fixtureResponse();
    incoming.teams[0]!.entry = { ...incoming.teams[0]!.entry!, id: "unexpected", units: [] };
    expect(mergeFrozenEntries(previous, incoming).teams[0]!.entry!.id).toBe(previous.teams[0]!.entry!.id);
    const correction = fixtureClaim("correction", { kind: "entry_correction", supersedes: ["warmup"], relationAuthority: "original_author", unit: fixtureUnit(["Holmberg", "Point", "Kucherov"]) });
    const revised = reconcileEntry({ game: fixtureGame, teamId: 14, claims: [fixtureClaim(), correction], previous: previous.teams[0]!.entry, now: fixtureNow });
    incoming.teams[0]!.entry = revised; incoming.teams[0]!.entryRevisions = [previous.teams[0]!.entry!, revised];
    expect(mergeFrozenEntries(previous, incoming).teams[0]!.entry!.id).toBe(revised.id);
    render(<GameLineSnapshots data={incoming} />);
    expect(screen.getByRole("status").textContent).toContain("Entry lineup corrected");
  });
  it("switches games via selector and preserves empty history states", () => {
    const change = vi.fn(); const data = fixtureResponse(0);
    render(<GameLineSnapshots data={data} onGameChange={change} />);
    fireEvent.change(screen.getByLabelText("Game"), { target: { value: String(fixtureNext.id) } });
    expect(change).toHaveBeenCalledWith(fixtureNext.id);
    expect(screen.getByText("No in-game updates yet.")).toBeTruthy();
  });
});
describe("loading and automatic refresh", () => {
  it("distinguishes loading, disabled publishing and unavailable data", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    render(<ProjectedLineups teamId={14} />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    await act(async () => resolve({ ok: true, json: async () => ({ enabled: false, sets: [], reports: [] }) }));
    expect(screen.getByRole("status").textContent).toContain("disabled");
  });
  it("refreshes observations while retaining frozen entry", async () => {
    vi.useFakeTimers();
    const next = fixtureResponse(2); next.teams[0]!.entry = { ...next.teams[0]!.entry!, id: "silent-replacement", units: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => fixtureResponse() }).mockResolvedValueOnce({ ok: true, json: async () => next }));
    render(<ProjectedLineups teamId={14} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(60_000); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "In-game updates (2)" })).toBeTruthy();
    expect(screen.getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
  });
});

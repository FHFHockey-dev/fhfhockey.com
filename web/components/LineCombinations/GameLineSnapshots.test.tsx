import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameLineSnapshots, { mergeFrozenEntries } from "./GameLineSnapshots";
import ProjectedLineups from "./ProjectedLineups";
import { formatTime } from "./reviewReasonCopy";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureResponse, fixtureUnit } from "lib/lines/testFixtures";
import { reconcileEntry, reconcilePP } from "lib/lines/reconcile";
import type { GameLinesResponse, PPDecision } from "lib/lines/types";

vi.mock("next/script", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const expected = (data: GameLinesResponse) => { data.entryView = { mode: "expected", frozenAt: null, basis: null }; return data; };
const entryPanel = (name = "TBL · Lineup entering the game") => screen.getByRole("region", { name });
const updatesPanel = () => screen.getByRole("tabpanel", { name: /^In-game updates/ });
function stubNarrow(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe("game Lines presentation", () => {
  it("shows applicability, phase and plain-language review separately for mixed IGA and PP claims in one capture", () => {
    const data = fixtureResponse(0);
    const iga = fixtureClaim("iga", { kind: "iga", phase: "in_game", unit: null, text: "Mixed source evidence" });
    const pp = fixturePP(1, { captureId: iga.captureId, phase: "in_game", identityStatus: "unresolved", reviewReasons: ["event_membership_unverified"], text: iga.text });
    data.teams[0]!.observations = [iga, pp]; data.teams[0]!.history = [iga, pp];
    render(<GameLineSnapshots data={data} />);
    const rail = updatesPanel();
    const igaRow = within(rail).getByRole("group", { name: "In-game change · Line note" });
    const ppRow = within(rail).getByRole("group", { name: "Power play · PP 1" });
    expect(within(igaRow).getByText("Observed in game")).toBeTruthy();
    expect(within(ppRow).queryByText("Observed in game")).toBeNull();
    expect(within(ppRow).getByText("We haven't checked these players against the game roster yet.")).toBeTruthy();
    expect(within(ppRow).queryByText(/event_membership_unverified/)).toBeNull();
    expect(within(ppRow).getByText("During the game · Applies to 2026-10-01 · TBL at NYR")).toBeTruthy();
    expect(within(rail).getAllByText("Mixed source evidence")).toHaveLength(1);
  });
  it("shows the entering-game heading, grouped entry units, supported IGA prose, source and separate PP groups", () => {
    const data = fixtureResponse();
    render(<GameLineSnapshots data={data} />);
    const main = entryPanel();
    expect(within(main).getByText((_, node) => node?.tagName === "P" && node.textContent === `Set at ${formatTime(data.entryView.frozenAt!)}`)).toBeTruthy();
    expect(within(main).getByRole("heading", { level: 3, name: "Forwards" })).toBeTruthy();
    expect(within(main).getByRole("heading", { level: 3, name: "Power play 1" })).toBeTruthy();
    expect(within(main).getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
    expect(within(main).queryByText(/Holmberg\/Point\/Guentzel together/)).toBeNull();
    expect(screen.getByText(/Holmberg\/Point\/Guentzel together/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "@fixtureauthor" }).length).toBeGreaterThan(0);
    expect(within(main).getByText("No PP2 report yet.")).toBeTruthy();
  });
  it("lists each PP unit once even when the entry also carries it", () => {
    const data = fixtureResponse(0);
    const ppUnit = fixtureUnit(["Carlson", "Point", "Kucherov", "Guentzel", "Hagel"], "pp", 1);
    data.teams[0]!.entry = { ...data.teams[0]!.entry!, units: [...data.teams[0]!.entry!.units, { unit: ppUnit, claims: [fixturePP(1)], designation: "reported", originGameId: null }] };
    render(<GameLineSnapshots data={data} />);
    expect(within(entryPanel()).getAllByText("Carlson — Point — Kucherov — Guentzel — Hagel")).toHaveLength(1);
  });
  it("labels confirmed, practice and derived units, and an ended carry with its reason", () => {
    const data = fixtureResponse(0);
    const team = data.teams[0]!;
    team.entry = { ...team.entry!, units: [
      { ...team.entry!.units[0]!, designation: "confirmed" },
      { unit: fixtureUnit(["Hedman", "Raddysh"], "es_defense", 1), claims: [fixtureClaim("practice", { context: "practice", originalAuthor: "beatwriter" })], designation: "projected", originGameId: null },
    ] };
    const base = fixturePP(2, { id: "base" }); const swap = fixturePP(2, { id: "swap", author: "swapper" });
    const derived: PPDecision = { ...team.ppDefaults[0]!, unitNumber: 2, selection: { unit: base.unit!, claims: [base, swap], designation: "projected", originGameId: null },
      derivation: { baseClaimIds: ["base"], swapClaimIds: ["swap"], playersIn: [1], playersOut: [2] } };
    const ended: PPDecision = { ...team.ppDefaults[0]!, selection: null, endReason: { kind: "stale", gamesElapsed: 3, detail: "internal detail" } };
    team.ppDefaults = [ended, derived];
    render(<GameLineSnapshots data={data} />);
    const main = entryPanel();
    expect(within(main).getByText("Confirmed")).toBeTruthy();
    expect(within(main).getByText("Practice report, not game-confirmed")).toBeTruthy();
    expect(within(main).getByRole("link", { name: "@beatwriter" })).toBeTruthy();
    expect(within(main).getByText("Derived from PP swap")).toBeTruthy();
    expect(within(main).getByText(/Base unit:/)).toBeTruthy();
    expect(within(main).getByText(/Swap:/)).toBeTruthy();
    expect(within(main).getByText("Carried PP1 ended: not reaffirmed in 3 team games.")).toBeTruthy();
    expect(within(main).queryByText(/internal detail/)).toBeNull();
  });
  it("keeps entry and in-game publication times distinct from relay and ingestion times", () => {
    const data = fixtureResponse(0);
    const warmup = fixtureClaim();
    const observation = fixtureClaim("late-arrival", {
      kind: "iga", phase: "in_game", unit: null, text: "A later in-game change",
      time: { ...warmup.time, originalPublishedAt: "2026-10-01T23:20:00Z", relayPublishedAt: "2026-10-01T23:40:00Z", ingestedAt: "2026-10-01T23:45:00Z", interpretedAt: "2026-10-01T23:46:00Z", effectiveAt: "2026-10-01T23:20:00Z" },
    });
    data.teams[0]!.observations = [observation];
    data.teams[0]!.history = [warmup, observation];
    data.teams[0]!.ppDefaults = [];
    render(<GameLineSnapshots data={expected(data)} />);
    const entry = entryPanel("TBL · Expected game-entry lineup");
    const rail = updatesPanel();
    expect(Array.from(entry.querySelectorAll("time")).map((time) => time.getAttribute("datetime"))).toEqual([warmup.time.originalPublishedAt]);
    expect(Array.from(rail.querySelectorAll("time")).map((time) => time.getAttribute("datetime"))).toEqual([observation.time.originalPublishedAt]);
    expect(within(rail).getByText("Received " + formatTime(observation.time.ingestedAt))).toBeTruthy();
    expect(within(entry).queryByText(observation.text)).toBeNull();
    expect(within(rail).getByText(observation.text)).toBeTruthy();
  });
  it("does not substitute known relay or arrival times for unresolved publication time", () => {
    const data = expected(fixtureResponse(0));
    const warmup = fixtureClaim();
    const time = { ...warmup.time, originalPublishedAt: null, effectiveAt: null, rawDisplay: "6:34 PM", timezone: null, precision: "display" as const };
    data.teams[0]!.entry!.units[0]!.claims = [{ ...warmup, time }];
    data.teams[0]!.observations = [fixtureClaim("unknown-time", { kind: "iga", phase: "unknown", unit: null, time })];
    data.teams[0]!.ppDefaults = [];
    render(<GameLineSnapshots data={data} />);
    const entry = entryPanel("TBL · Expected game-entry lineup");
    const rail = updatesPanel();
    expect(within(entry).getByText("6:34 PM · time zone unknown")).toBeTruthy();
    expect(within(rail).getByText("6:34 PM · time zone unknown")).toBeTruthy();
    expect(entry.querySelector("time")).toBeNull();
    expect(rail.querySelector("time")).toBeNull();
    expect(within(rail).getByText("Received " + formatTime(time.ingestedAt))).toBeTruthy();
  });
  it("replaces a carried PP default with a projected report for the selected next game", () => {
    const data = expected(fixtureResponse(0));
    const priorBase = fixturePP(1);
    const prior = { ...priorBase, time: { ...priorBase.time, relayPublishedAt: "2026-10-01T23:34:00Z", ingestedAt: "2026-10-01T23:35:00Z", interpretedAt: "2026-10-01T23:36:00Z" } };
    const unit = fixtureUnit(["New A", "New B", "New C", "New D", "New E"], "pp", 1);
    unit.players = unit.players.map((player, index) => ({ ...player, playerId: 201 + index }));
    const replacement = fixturePP(1, {
      id: "next-game-projection", captureId: "capture:next-game-projection", originalIdentity: "original:next-game-projection",
      gameId: fixtureNext.id, phase: "pregame", certainty: "projected", unit,
      binding: { ...prior.binding, scheduleIdentity: fixtureNext.scheduleIdentity },
      time: { ...prior.time, originalPublishedAt: "2026-10-03T22:00:00Z", relayPublishedAt: "2026-10-03T22:01:00Z", ingestedAt: "2026-10-03T22:02:00Z", interpretedAt: "2026-10-03T22:03:00Z", effectiveAt: "2026-10-03T22:00:00Z" },
    });
    data.game = fixtureNext;
    data.teams[0]!.entry = null;
    const carried = reconcilePP({ game: fixtureNext, games: data.games, teamId: 14, claims: [prior], now: fixtureNow, carryForward: true });
    data.teams[0]!.ppDefaults = carried;
    const view = render(<GameLineSnapshots data={data} />);
    expect(screen.getByText("Carried forward from 2026-10-01 · TBL at NYR")).toBeTruthy();
    data.teams[0]!.ppDefaults = reconcilePP({ game: fixtureNext, games: data.games, teamId: 14, claims: [prior, replacement], previous: carried, now: "2026-10-03T22:30:00Z", carryForward: true });
    view.rerender(<GameLineSnapshots data={data} />);
    const entry = entryPanel("TBL · Expected game-entry lineup");
    expect(within(entry).getByText("New A — New B — New C — New D — New E")).toBeTruthy();
    expect(within(entry).getByText("Projected")).toBeTruthy();
    expect(within(entry).queryByText(/^Carried forward from/)).toBeNull();
    expect(within(entry).queryByText("Confirmed")).toBeNull();
    expect(entry.querySelector("time")?.getAttribute("datetime")).toBe(replacement.time.originalPublishedAt);
    expect(within(entry).getByText("No game-entry lineup has been reported yet.")).toBeTruthy();
    expect(data.teams[0]!.ppDefaults[0]!.replacesId).toBe(carried[0]!.id);
  });
  it("renders every report with no paging limit, behind accessible tabs", () => {
    const data = fixtureResponse(10);
    data.teams[0]!.feed = [{ id: "feed-1", originalIdentity: "o", originalAuthor: "CcCMiddleton", authorityTier: "aggregator", relays: [], text: "Raw line post", publishedAt: fixtureNow, ingestedAt: fixtureNow,
      binding: { status: "bound", gameId: fixtureGame.id, evidence: [] }, context: "game", claimIds: [], sourceUrl: null }];
    render(<GameLineSnapshots data={data} />);
    expect(within(updatesPanel()).getAllByText(/Holmberg\/Point\/Guentzel together/)).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /Show earlier/ })).toBeNull();
    const updates = screen.getByRole("tab", { name: "In-game updates (10)" });
    const feed = screen.getByRole("tab", { name: "Source feed (1)" });
    expect(updates.getAttribute("aria-selected")).toBe("true");
    expect(feed.getAttribute("tabindex")).toBe("-1");
    fireEvent.keyDown(updates, { key: "ArrowRight" });
    expect(feed.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(feed);
    const panel = screen.getByRole("tabpanel", { name: "Source feed (1)" });
    expect(within(panel).getByText("Raw line post")).toBeTruthy();
    expect(document.getElementById(updates.getAttribute("aria-controls")!)?.hidden).toBe(true);
  });
  it("on phones shows the entry first and both sidebar sections collapsed", async () => {
    stubNarrow(true);
    render(<GameLineSnapshots data={fixtureResponse(2)} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("tablist")).toBeNull();
    const toggle = screen.getByRole("button", { name: "In-game updates (2)" });
    const feed = screen.getByRole("button", { name: "Source feed (0)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(feed.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.hidden).toBe(false);
    const entry = entryPanel();
    expect(entry.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("marks partial units and keeps unassigned numbers unassigned", () => {
    const data = fixtureResponse(0);
    const partial = { ...fixtureUnit(["Hagel", "Cirelli"], "es_forward", null), complete: false };
    data.teams[0]!.observations = [fixtureClaim("partial", { kind: "iga", phase: "in_game", unit: partial })];
    render(<GameLineSnapshots data={data} />);
    const row = within(updatesPanel()).getByRole("group", { name: "In-game change · Line, unassigned" });
    expect(within(row).getByText("Partial")).toBeTruthy();
  });
  it("keeps both game-route teams distinct", () => {
    const data = fixtureResponse();
    const other = { ...data.teams[0]!, teamId: 3, abbreviation: "NYR", entry: null, entryRevisions: [], observations: [], history: [], feed: [] };
    data.teams.push(other);
    render(<GameLineSnapshots data={data} />);
    expect(within(entryPanel("NYR · Lineup entering the game")).queryByText("Mikheyev — Point — Kucherov")).toBeNull();
    expect(screen.getByRole("region", { name: "TBL updates and sources" })).not.toBe(screen.getByRole("region", { name: "NYR updates and sources" }));
  });
  it("labels carried PP origin for each unit", () => {
    const data = expected(fixtureResponse()); data.game = fixtureNext;
    data.teams[0]!.entry = null;
    data.teams[0]!.ppDefaults = reconcilePP({ game: fixtureNext, games: data.games, teamId: 14, claims: [fixturePP(1), fixturePP(2)], now: fixtureNow, carryForward: true });
    render(<GameLineSnapshots data={data} />);
    expect(screen.getAllByText("Carried forward from 2026-10-01 · TBL at NYR")).toHaveLength(2);
    expect(screen.getByText(/Carried units come from an earlier game/)).toBeTruthy();
  });
  it("shows a previous-game fallback and never confirms goalie order", () => {
    const data = expected(fixtureResponse()); const previous = data.teams[0]!.entry!;
    data.game = fixtureNext; data.teams[0]!.entry = null;
    data.teams[0]!.fallback = { gameId: fixtureGame.id, date: fixtureGame.date, entry: { ...previous, units: [{ ...previous.units[0]!, unit: fixtureUnit(["Vasilevskiy", "Hildeby"], "goalie") }] } };
    render(<GameLineSnapshots data={data} />);
    expect(screen.getByRole("heading", { name: /Previous game's lineup/ })).toBeTruthy();
    expect(screen.getByText("Listed order only; the starter isn't confirmed.")).toBeTruthy();
  });
  it("retains frozen entry if refresh lacks a correction chain, accepts a valid correction and keeps revision reasons", () => {
    const previous = fixtureResponse(); const incoming = fixtureResponse();
    incoming.teams[0]!.entry = { ...incoming.teams[0]!.entry!, id: "unexpected", units: [] };
    const retained = mergeFrozenEntries(previous, incoming);
    expect(retained.teams[0]!.entry!.id).toBe(previous.teams[0]!.entry!.id);
    const correction = fixtureClaim("correction", { kind: "entry_correction", supersedes: ["warmup"], relationAuthority: "original_author", unit: fixtureUnit(["Holmberg", "Point", "Kucherov"]) });
    const revised = reconcileEntry({ game: fixtureGame, teamId: 14, claims: [fixtureClaim(), correction], previous: previous.teams[0]!.entry, now: fixtureNow });
    incoming.teams[0]!.entry = revised; incoming.teams[0]!.entryRevisions = [previous.teams[0]!.entry!, revised];
    expect(mergeFrozenEntries(previous, incoming).teams[0]!.entry!.id).toBe(revised.id);
    render(<GameLineSnapshots data={incoming} />);
    expect(screen.getByText(/Lineup corrected · revision \d+ · Corrected by the original source/)).toBeTruthy();
    expect(screen.getByText("Revision history (2)")).toBeTruthy();
    expect(screen.getAllByText((_, node) => node?.tagName === "P" && /^Corrected by the original source · /.test(node.textContent ?? "")).length).toBeGreaterThan(0);
  });
  it("shows plain copy, never internal wording, for a retained frozen entry", () => {
    const previous = fixtureResponse(); const incoming = fixtureResponse();
    incoming.teams[0]!.entry = { ...incoming.teams[0]!.entry!, id: "unexpected", units: [] };
    render(<GameLineSnapshots data={mergeFrozenEntries(previous, incoming)} />);
    expect(screen.getByText("The lineup changed without a confirmed correction, so we kept the lineup set at puck drop.")).toBeTruthy();
    expect(screen.queryByText(/correction chain/)).toBeNull();
  });
  it("switches games via selector and preserves empty history states", () => {
    const change = vi.fn(); const data = fixtureResponse(0);
    render(<GameLineSnapshots data={data} onGameChange={change} />);
    fireEvent.change(screen.getByLabelText("Game"), { target: { value: String(fixtureNext.id) } });
    expect(change).toHaveBeenCalledWith(fixtureNext.id);
    expect(screen.getByText("No in-game updates yet.")).toBeTruthy();
  });
  it("distinguishes no game, unknown game state and disabled publishing", () => {
    const none = fixtureResponse(0); none.game = null; none.status = "no_game";
    const view = render(<GameLineSnapshots data={none} />);
    expect(screen.getByRole("status").textContent).toContain("No live or upcoming game for this team.");
    const unknown = fixtureResponse(0); unknown.game = { ...fixtureGame, phase: "unknown" };
    view.rerender(<GameLineSnapshots data={unknown} />);
    expect(screen.getByRole("status").textContent).toContain("can't read the game state");
    const disabled = fixtureResponse(0); disabled.enabled = false; disabled.status = "disabled";
    view.rerender(<GameLineSnapshots data={disabled} />);
    expect(view.container.innerHTML).toBe("");
  });
});
describe("loading and automatic refresh", () => {
  it("distinguishes loading and renders nothing when publishing is disabled", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => { resolve = done; })));
    const view = render(<ProjectedLineups teamId={14} />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    await act(async () => resolve({ ok: true, json: async () => ({ enabled: false, sets: [], reports: [] }) }));
    expect(view.container.innerHTML).toBe("");
    expect(screen.queryByText(/disabled/i)).toBeNull();
  });
  it("shows an unavailable state when the first load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<ProjectedLineups teamId={14} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("status").textContent).toContain("unavailable right now");
  });
  it("refreshes observations while retaining frozen entry, then shows a stale note when a refresh fails", async () => {
    vi.useFakeTimers();
    const next = fixtureResponse(2); next.teams[0]!.entry = { ...next.teams[0]!.entry!, id: "silent-replacement", units: [] };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => fixtureResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => next })
      .mockResolvedValueOnce({ ok: false }));
    render(<ProjectedLineups teamId={14} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(60_000); await Promise.resolve(); });
    expect(screen.getByRole("tab", { name: "In-game updates (2)" })).toBeTruthy();
    expect(screen.getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(60_000); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(/Couldn't refresh. Showing lineups as of/)).toBeTruthy();
    expect(screen.getByText("Mikheyev — Point — Kucherov")).toBeTruthy();
  });
});

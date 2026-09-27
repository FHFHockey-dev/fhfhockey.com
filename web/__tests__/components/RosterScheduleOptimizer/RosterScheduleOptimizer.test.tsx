import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanningData, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { WORKSPACE_KEY, defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";

const { authState } = vi.hoisted(() => ({ authState: { user: null as { id: string } | null } }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => authState }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: authState.user ? { access_token: `token-${authState.user.id}` } : null } }) }, from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) } }));
vi.mock("hooks/useRosterPlanning", () => ({ useRosterPlanning: () => ({ result: null, loading: false, error: null }) }));
import RosterScheduleOptimizer, { grossAcquisitionGames } from "components/RosterScheduleOptimizer/RosterScheduleOptimizer";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const data: PlanningData = { players: [player], games: [], forecasts: [], evidence: {} };
const fetchMock = vi.fn((url: string) => Promise.resolve({ ok: url.includes("/data?"), json: async () => ({ success: true, data }) }));
afterEach(() => { cleanup(); window.localStorage.clear(); vi.unstubAllGlobals(); fetchMock.mockClear(); authState.user = null; });

describe("RosterScheduleOptimizer workspace", () => {
  it("counts only acquired players' future games before their next drop", () => {
    const workspace = defaultWorkspace(new Date("2026-09-26T12:00:00Z"));
    const snapshot: PlanningSnapshot = { id: "gross", context: workspace.context, players: [player], roster: [], games: ["2026-09-27", "2026-09-29", "2026-10-01"].map((date, index) => ({ id: `g${index}`, date, startsAt: `${date}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" })), forecasts: [], rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    const steps = [
      { id: "add", type: "add" as const, playerId: player.id, at: "2026-09-28T12:00:00Z", effectiveAt: "2026-09-28T12:00:00Z", conditional: true, dependsOn: [] },
      { id: "drop", type: "drop" as const, playerId: player.id, at: "2026-09-30T12:00:00Z", effectiveAt: "2026-09-30T12:00:00Z", conditional: false, dependsOn: ["add"] },
    ];
    expect(grossAcquisitionGames(steps, snapshot)).toBe(1);
  });
  it("keeps exact canonical selections and unresolved pasted names across remount", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Search canonical player" });
    fireEvent.change(screen.getByRole("textbox", { name: "Paste roster names" }), { target: { value: "Alpha Center\nUnmatched Skater" } });
    fireEvent.click(screen.getByRole("button", { name: "Review pasted names" }));
    await waitFor(() => expect(screen.getByText("Unmatched Skater")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null");
    expect(saved.roster).toEqual([{ playerId: "fhfh:1", position: "bench" }]);
    expect(saved.manualPlayers).toEqual([player]);
    view.unmount(); render(<RosterScheduleOptimizer />);
    expect(await screen.findByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    expect(screen.getByText("Unmatched Skater")).toBeTruthy();
  });

  it("undoes local roster edits without changing the public snapshot", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Search canonical player" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search canonical player" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByRole("button", { name: "Remove Alpha Center" })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/data?")).length).toBe(1);
  });

  it("marks a future selected add conditional until the provider confirms it", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    await screen.findByRole("searchbox", { name: "Find candidate" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark available" }));
    fireEvent.click(screen.getByRole("button", { name: "Select add" }));
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null");
    expect(saved.intent.steps).toMatchObject([{ playerId: "fhfh:1", conditional: true }]);
  });

  it("uses the signed-in session for access and account reads, then refreshes after account switch", async () => {
    const authenticatedFetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data } : url.endsWith("/access") ? { data: { eligible: false, capabilities: [] } } : { data: null }, init }));
    vi.stubGlobal("fetch", authenticatedFetch);
    authState.user = { id: "first" };
    const view = render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/access") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-first")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-first")).toBe(true));
    authState.user = { id: "second" }; view.rerender(<RosterScheduleOptimizer />);
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/access") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.includes("/workspace?") && (init?.headers as Record<string, string>)?.Authorization === "Bearer token-second")).toBe(true));
  });

  it("explains access-service failures instead of silently disabling provider sync", async () => {
    authState.user = { id: "manager" };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: !url.endsWith("/access"), status: url.endsWith("/access") ? 503 : 200, json: async () => url.includes("/data?") ? { success: true, data } : { data: null } })));
    render(<RosterScheduleOptimizer />);
    expect((await screen.findByRole("alert")).textContent).toContain("in-season access could not be verified");
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "yahoo" } });
    expect((screen.getByRole("button", { name: "Refresh provider" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Saved inputs are read-only and may be stale.")).toBeNull();
  });

  it("sends the signed-in token when saving the workspace", async () => {
    authState.user = { id: "manager" };
    const authenticatedFetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve({ ok: true, status: 200, json: async () => url.includes("/data?") ? { success: true, data } : url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_account_save"] } } : { data: null }, init }));
    vi.stubGlobal("fetch", authenticatedFetch);
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "Save to account" }));
    await waitFor(() => expect(authenticatedFetch.mock.calls.some(([url, init]) => url.endsWith("/workspace") && init?.method === "PUT" && (init.headers as Record<string, string>).Authorization === "Bearer token-manager")).toBe(true));
  });

  it("keeps invalid zone and cleared period dates out of committed rules", async () => {
    vi.stubGlobal("fetch", fetchMock);
    render(<RosterScheduleOptimizer />);
    const zone = await screen.findByLabelText("Time zone") as HTMLInputElement;
    const original = zone.value;
    fireEvent.change(zone, { target: { value: "Not/A_Zone" } });
    fireEvent.blur(zone);
    expect(screen.getByText(/valid IANA time zone/)).toBeTruthy();
    expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).toBe(original);
    fireEvent.click(screen.getByText("Scoring, budgets, and lock windows"));
    fireEvent.click(screen.getByRole("button", { name: "Add acquisition period" }));
    const previous = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null").rules.periods[0].start;
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "" } });
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) ?? "null").rules.periods[0].start).toBe(previous);
  });

  it("opens a saved manual snapshot read-only until the manager explicitly forks it", async () => {
    authState.user = { id: "manager" };
    const saved = defaultWorkspace();
    saved.context.asOf = "2026-09-01T12:00:00.000Z";
    saved.roster = [{ playerId: player.id, position: "bench" }];
    saved.manualPlayers = [player];
    const snapshot = { id: "saved-1", context: saved.context, players: [player], roster: saved.roster, games: [], forecasts: [], rules: saved.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => url.includes("/data?") ? { success: true, data } : url.endsWith("/access") ? { data: { eligible: false, capabilities: [] } } : { data: { workspace: saved, snapshot, version: 1, updatedAt: saved.context.asOf } } })));
    render(<RosterScheduleOptimizer />);
    fireEvent.click(await screen.findByRole("button", { name: "View account save" }));
    expect(screen.getByText(/Saved evidence/)).toBeTruthy();
    expect((screen.getByLabelText("Planning setup") as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Continue manually" }));
    expect((screen.getByLabelText("Planning setup") as HTMLFieldSetElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Remove Alpha Center" })).toBeTruthy();
  });
});
